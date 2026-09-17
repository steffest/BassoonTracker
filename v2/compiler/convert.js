// Converts the YAML source graph rooted at app.yaml into a generic
// normalized tree plus a source-located diagnostics list (spec 005 Phase 1:
// "Source graph to simplified preview"). Pure with respect to its
// `readFile` dependency, so it can be tested against an in-memory file map
// as well as the real filesystem (see compiler/generate.js).

import { parseYamlDocument, mapGet, scalarValue } from "./yaml.js";
import { splitLabel } from "./labels.js";
import { resolveLayoutFields } from "./layoutFields.js";
import { interpretRule, interpretAction, actionNameAsProse } from "./recipes.js";
import { assignInstanceIds } from "./identity.js";
import { compileSkin, registerAssetUse, lookupStyle, styleLayoutDefaults, BUILTIN_SKIN } from "./skin.js";
import { componentType, isImplemented, isStyledType, childSlot, knownProperty, acceptedKeys, isAnyKnownKey, assetPropertyOf } from "../runtime/componentTypes.js";

// 0.2.0 (spec 008): the outline gained the compiled `skin` and a `style` on
// every styled node, and source offsets now include each line's indentation
// (they were short by it, which nothing noticed while only line numbers were
// read; splicing YAML needs them exact). Both are reasons a previously
// generated outline must not be reused.
export const COMPILER_VERSION = "0.2.0";
export const OUTLINE_SCHEMA_VERSION = 3;

// Spec 009: which component types exist, what each one accepts and how its
// children are authored all come from runtime/componentTypes.js. This file
// keeps no list of type names.

// The authored key that links a component to a style variant of its own
// type. `variant` is the documented spelling; `style` is accepted as an
// alias so either reads naturally on a component.
const VARIANT_KEYS = ["variant", "style"];
const NAME_LIKE = /^[A-Za-z][A-Za-z0-9]*$/;
const AUTO_LAYOUT = { width: { mode: "auto" }, height: { mode: "auto" } };

/**
 * @param {string} appYamlPath path passed to readFile for the entry document
 * @param {(path: string) => string|null} readFile returns file text, or null if it doesn't exist
 * @param {{ listAssets?: () => string[] }} [dependencies] `listAssets` returns the
 *   available skin source PNG base names (spec 008); Node callers supply it so
 *   unknown artwork is reported, the browser has no directory listing and omits it.
 * @returns {{ root: object|null, skin: object, diagnostics: Array, hardFailure: boolean }}
 */
export function compileApplication(appYamlPath, readFile, dependencies = {}) {
    const diagnostics = [];
    const parsedFiles = new Map();
    const resolving = new Set();
    const sourceFiles = new Set();
    // Replaced by the authored skin once app.yaml has been parsed (its
    // `skin:` key names the document); every node's style resolves against
    // whatever is in here when its mapping is converted.
    let skin = BUILTIN_SKIN;
    let layoutDefaults = styleLayoutDefaults(BUILTIN_SKIN);

    function addDiagnostic(severity, code, message, file, range, nodeRef) {
        diagnostics.push({ severity, code, message, file, range: range || null, nodeRef: nodeRef || null });
    }

    function parseFile(path) {
        if (parsedFiles.has(path)) return parsedFiles.get(path);
        const text = readFile(path);
        if (text === null || text === undefined) {
            parsedFiles.set(path, null);
            return null;
        }
        sourceFiles.add(path);
        const result = parseYamlDocument(text, path);
        parsedFiles.set(path, result);
        return result;
    }

    function loadNamed(kind, name) {
        const path = `${kind}/${name}.yaml`;
        const parsed = parseFile(path);
        if (!parsed) return null;
        for (const err of parsed.errors) {
            addDiagnostic("error", "yaml-syntax-error", err.message, err.file, err.range, null);
        }
        if (!parsed.root) return null;
        return { path, root: parsed.root };
    }

    function makePlaceholder(type, definitionName, file, range, refSource) {
        return {
            type,
            definitionName,
            labelVariants: definitionName ? [definitionName] : [],
            layout: AUTO_LAYOUT,
            children: [],
            bindings: [],
            source: { file, range },
            refSource: refSource || null,
            supported: false
        };
    }

    function definitionText(root) {
        if (root.kind === "scalar") return root.value || "";
        return scalarValue(mapGet(root, "description")) || "";
    }

    function resolveRuleText(refFile, ruleValueNode, node) {
        const text = scalarValue(ruleValueNode);
        if (text === null) return;
        const namedFile = NAME_LIKE.test(text) ? loadNamed("rules", text) : null;
        const description = namedFile ? definitionText(namedFile.root) : null;
        const result = namedFile ? interpretRule(text, description) : interpretRule(null, text);
        if (result.informational) return;
        if (result.supported) {
            // `origin` records where this binding came from (a rule vs. an
            // action); `...result.binding` supplies its own, more specific
            // `kind` (e.g. "visual-state") - keep `origin` a distinct key so
            // the spread can't silently overwrite it.
            node.bindings.push({ origin: "rule", code: result.code, ...result.binding, source: { file: namedFile ? namedFile.path : refFile, range: ruleValueNode.range } });
        } else {
            addDiagnostic("warning", "unresolved-rule", `unresolved rule interpretation: "${text}"`, refFile, ruleValueNode.range, node);
        }
    }

    function resolveActionRef(refFile, nameValueNode, node, event) {
        const name = scalarValue(nameValueNode);
        if (name === null) return;
        const namedFile = loadNamed("actions", name);
        if (namedFile) {
            const description = definitionText(namedFile.root);
            const result = interpretAction(description);
            if (result.supported) {
                node.bindings.push({ origin: "action", event, code: result.code, ...result.binding, source: { file: namedFile.path, range: nameValueNode.range } });
            } else {
                addDiagnostic("warning", "unresolved-action", `unresolved action interpretation: "${description}"`, namedFile.path, nameValueNode.range, node);
            }
            return;
        }
        // No document by that name: read the reference itself as prose (spec
        // 014). An author who writes `- click: toggleRecording` has said what
        // they mean, and a recipe already understands it.
        const prose = actionNameAsProse(name);
        const inferred = interpretAction(prose);
        if (inferred.supported) {
            node.bindings.push({ origin: "action", event, code: inferred.code, inferredFrom: prose, ...inferred.binding, source: { file: refFile, range: nameValueNode.range } });
            return;
        }
        addDiagnostic("warning", "unresolved-action-reference", `unresolved action reference "${name}": there is no actions/${name}.yaml, and "${prose}" matches no action recipe`, refFile, nameValueNode.range, node);
    }

    function resolveInlineAction(refFile, textValueNode, node, event) {
        const text = scalarValue(textValueNode);
        if (text === null) return;
        const result = interpretAction(text);
        if (result.supported) {
            node.bindings.push({ origin: "action", event, code: result.code, ...result.binding, source: { file: refFile, range: textValueNode.range } });
        } else {
            addDiagnostic("warning", "unresolved-action", `unresolved action interpretation: "${text}"`, refFile, textValueNode.range, node);
        }
    }

    function applyLabel(mapNode, key, file, fallbackName) {
        const labelValueNode = mapGet(mapNode, key);
        const labelText = scalarValue(labelValueNode);
        if (labelText === null) return fallbackName ? [fallbackName] : [];
        const { variants, warnings } = splitLabel(labelText);
        warnings.forEach(w => addDiagnostic("warning", "empty-label-variant", w, file, labelValueNode.range, null));
        return variants;
    }

    // Spec 008: a styled node records which skin style draws it, the
    // `style:` line that asked for it, and where that style is defined, so
    // the workbench can link a component to its graphical representation in
    // both directions.
    function variantNode(mapNode) {
        for (const key of VARIANT_KEYS) {
            const found = mapGet(mapNode, key);
            if (found) return found;
        }
        return null;
    }

    function attachStyle(node, styleType, styleNode, file, fallbackVariant) {
        if (!isStyledType(styleType)) return;
        const authored = scalarValue(styleNode);
        const requested = authored || fallbackVariant || null;
        const { style, resolvedVariant, found } = lookupStyle(skin, styleType, requested);
        if (requested && !found) {
            addDiagnostic("warning", "unknown-style-variant", `variant "${requested}" is not defined for component type "${styleType}"; drawing with "${resolvedVariant}"`, file, (styleNode || { range: node.source.range }).range, node);
        }
        node.style = {
            type: styleType,
            variant: resolvedVariant,
            requested: requested || "default",
            // Where the variant was asked for: the component's own key, or
            // nothing when it came from the group's itemStyle or the default.
            source: styleNode ? { file, range: styleNode.range } : null,
            inheritedFrom: !authored && fallbackVariant ? "group" : null,
            definition: style.source || null
        };
    }

    // A container whose `items:` become nodes of one declared child type
    // (radioGroup -> radioItem). The child type comes from the registry, so a
    // future list-shaped type reuses this without a new branch here.
    function convertItems(itemsNode, file, childType, itemVariant) {
        return itemsNode.items.map(item => {
            const itemName = scalarValue(mapGet(item, "name"));
            const child = {
                type: childType,
                definitionName: itemName,
                labelVariants: applyLabel(item, "label", file, itemName),
                layout: AUTO_LAYOUT,
                children: [],
                bindings: [],
                source: { file, range: item.range },
                refSource: null,
                supported: true
            };
            attachStyle(child, childType, variantNode(item), file, itemVariant);
            const ruleNode = mapGet(item, "rule");
            if (ruleNode) resolveRuleText(file, ruleNode, child);
            return child;
        });
    }

    function convertComponentMap(mapNode, file, mappingKey, refSource) {
        const explicitName = scalarValue(mapGet(mapNode, "name"));
        const explicitType = scalarValue(mapGet(mapNode, "type"));
        const definitionName = explicitName || mappingKey || null;
        const type = explicitType || `custom:${mappingKey || "node"}`;

        const layoutNode = mapGet(mapNode, "layout");
        const rawLayout = layoutNode
            ? {
                width: scalarValue(mapGet(layoutNode, "width")),
                height: scalarValue(mapGet(layoutNode, "height")),
                direction: scalarValue(mapGet(layoutNode, "direction")),
                resizable: scalarValue(mapGet(layoutNode, "resizable"))
            }
            : {};
        const { layout, warnings: layoutWarnings } = resolveLayoutFields(explicitType || mappingKey || "node", rawLayout, definitionName || mappingKey || "node", layoutDefaults);
        layoutWarnings.forEach(w => addDiagnostic("warning", "layout-default-fallback", w, file, (layoutNode || mapNode).range, null));

        // Spec 025: a declared breakpoint mechanism, replacing v1's
        // hand-written per-pixel cascade (script/src/ui/app/layout.js). Each
        // entry is a *partial* layout override, so only the fields the
        // author actually wrote under it are kept - `resolveLayoutFields`
        // itself always returns a complete, defaulted layout, which would
        // otherwise silently reset every field a breakpoint did not mention.
        const nodeLabel = definitionName || mappingKey || "node";
        const breakpointsNode = mapGet(mapNode, "breakpoints");
        let breakpoints;
        if (breakpointsNode && breakpointsNode.kind === "seq") {
            breakpoints = breakpointsNode.items.map(item => {
                const maxWidthNode = mapGet(item, "maxWidth");
                const maxWidth = Number(scalarValue(maxWidthNode));
                if (!maxWidthNode || !Number.isFinite(maxWidth)) {
                    addDiagnostic("warning", "invalid-breakpoint", `a breakpoint on ${nodeLabel} needs a numeric maxWidth`, file, item.range, null);
                    return null;
                }
                const bpLayoutNode = mapGet(item, "layout");
                const rawBpLayout = bpLayoutNode
                    ? {
                        width: scalarValue(mapGet(bpLayoutNode, "width")),
                        height: scalarValue(mapGet(bpLayoutNode, "height")),
                        direction: scalarValue(mapGet(bpLayoutNode, "direction")),
                        resizable: scalarValue(mapGet(bpLayoutNode, "resizable"))
                    }
                    : {};
                const { layout: resolvedBpLayout, warnings: bpWarnings } = resolveLayoutFields(
                    explicitType || mappingKey || "node", rawBpLayout, `${nodeLabel} breakpoint ${maxWidth}`, layoutDefaults
                );
                bpWarnings.forEach(w => addDiagnostic("warning", "layout-default-fallback", w, file, (bpLayoutNode || item).range, null));
                const partial = {};
                if (rawBpLayout.width !== undefined && rawBpLayout.width !== null) partial.width = resolvedBpLayout.width;
                if (rawBpLayout.height !== undefined && rawBpLayout.height !== null) partial.height = resolvedBpLayout.height;
                if (resolvedBpLayout.direction !== undefined) partial.direction = resolvedBpLayout.direction;
                if (resolvedBpLayout.resizable !== undefined) partial.resizable = resolvedBpLayout.resizable;
                return { maxWidth, layout: partial };
            }).filter(Boolean);
        }

        // Spec 025: the mechanism v1's EVENT.showView view-routing needs,
        // generalized to any node - visible only while a named state field
        // holds one of a declared set of values.
        const visibleWhenNode = mapGet(mapNode, "visibleWhen");
        let visibleWhen;
        if (visibleWhenNode && visibleWhenNode.kind === "map") {
            const field = scalarValue(mapGet(visibleWhenNode, "field"));
            const oneOfNode = mapGet(visibleWhenNode, "oneOf");
            let oneOf = [];
            if (oneOfNode && oneOfNode.kind === "seq") oneOf = oneOfNode.items.map(scalarValue).filter(v => v !== null);
            else if (oneOfNode) { const v = scalarValue(oneOfNode); if (v !== null) oneOf = [v]; }
            if (field && oneOf.length) visibleWhen = { field, oneOf };
            else addDiagnostic("warning", "invalid-visible-when", `visibleWhen on ${nodeLabel} needs both a field and oneOf`, file, visibleWhenNode.range, null);
        }

        const node = {
            type,
            definitionName,
            labelVariants: applyLabel(mapNode, "label", file, definitionName),
            layout,
            shortKey: scalarValue(mapGet(mapNode, "shortKey")),
            tooltip: scalarValue(mapGet(mapNode, "tooltip")),
            color: scalarValue(mapGet(mapNode, "color")),
            children: [],
            bindings: [],
            source: { file, range: mapNode.range },
            refSource: refSource || null,
            supported: isImplemented(explicitType)
        };
        if (breakpoints && breakpoints.length) node.breakpoints = breakpoints;
        if (visibleWhen) node.visibleWhen = visibleWhen;
        attachStyle(node, explicitType, variantNode(mapNode), file, null);

        // Spec 009/012: a type's own declared properties are carried onto the
        // node generically, so declaring a property is enough to author it.
        // `shortKey`, `tooltip` and `color` are universal properties already
        // in the literal above (spec 015 added `tooltip`) and keep their
        // place there, so the outline's shape does not shift.
        const typeEntry = componentType(explicitType);
        for (const property of Object.keys(typeEntry ? typeEntry.properties : {})) {
            if (property in node) continue;
            const valueNode = mapGet(mapNode, property);
            const value = scalarValue(valueNode);
            if (value === null) continue;
            // Spec 014: a property the registry declares as a number reaches
            // the node as one, so the renderer never has to guess whether it
            // is looking at 4 or "4". Anything else stays exactly as authored.
            if (typeEntry.properties[property].kind === "number") {
                const numeric = Number(value);
                if (Number.isFinite(numeric)) {
                    node[property] = numeric;
                    continue;
                }
                addDiagnostic("warning", "non-numeric-property", `${explicitType}.${property} expects a number; "${value}" is not one, so it is ignored`, file, valueNode.range, node);
                continue;
            }
            node[property] = value;
        }

        const ruleNode = mapGet(mapNode, "rule") || mapGet(mapNode, "rules");
        if (ruleNode) {
            if (ruleNode.kind === "seq") ruleNode.items.forEach(item => resolveRuleText(file, item, node));
            else resolveRuleText(file, ruleNode, node);
        }

        // `action` is the documented alias of `actions` (see
        // UNIVERSAL_PROPERTIES); before spec 014 only `actions` was read, so an
        // author who wrote the alias got no binding and no warning.
        const actionsNode = mapGet(mapNode, "actions") || mapGet(mapNode, "action");
        if (actionsNode) {
            if (actionsNode.kind === "seq") {
                actionsNode.items.forEach(item => {
                    if (item.kind === "map") item.entries.forEach(entry => resolveActionRef(file, entry.valueNode, node, entry.key));
                });
            } else if (actionsNode.kind === "scalar") {
                resolveInlineAction(file, actionsNode, node, "click");
            }
        }

        const entry = componentType(explicitType);
        // Children, per the type's declared container shape. A node with no
        // contract at all (no type, or a type the registry does not know)
        // keeps the pre-registry behavior: a `content:` sequence plus any
        // other mapping key as a named child.
        const slot = childSlot(explicitType) || (entry ? null : { childrenIn: "content", namedSlots: true });
        if (slot) {
            const childrenNode = mapGet(mapNode, slot.childrenIn);
            if (childrenNode && childrenNode.kind === "seq") {
                if (slot.childType) {
                    // The container's variant selects how its items look; an
                    // item may still name its own variant.
                    const containerStyle = lookupStyle(skin, explicitType, node.style ? node.style.variant : null).style;
                    node.children.push(...convertItems(childrenNode, file, slot.childType, containerStyle.itemStyle || null));
                } else if (slot.itemActions) {
                    // A declared-but-unrendered list whose items carry actions
                    // (menu): resolve them so they are reported, and attach
                    // them to this node rather than inventing child nodes.
                    childrenNode.items.forEach(item => {
                        const actionRef = mapGet(item, "action");
                        if (actionRef) resolveActionRef(file, actionRef, node, "click");
                    });
                } else {
                    childrenNode.items.forEach(item => {
                        const child = convertContentItem(item, file);
                        if (child) node.children.push(child);
                    });
                }
            }
        }

        // Any remaining key. On a container that allows named slots it is a
        // child (app.yaml's `top:` panel authors menu, volume meter and
        // notifications as sibling keys); on a leaf with a contract it is a
        // mistake. A node with no contract cannot be checked, so there any key
        // that some registered type declares is left alone, as before.
        mapNode.entries.forEach(mapEntry => {
            const isKnown = entry ? knownProperty(explicitType, mapEntry.key).known : isAnyKnownKey(mapEntry.key);
            if (isKnown) return;
            if (!entry || (slot && slot.namedSlots)) {
                if (mapEntry.valueNode.kind === "map") {
                    node.children.push(convertComponentMap(mapEntry.valueNode, file, mapEntry.key, null));
                } else if (mapEntry.valueNode.kind === "scalar") {
                    node.children.push(convertReference(scalarValue(mapEntry.valueNode), file, mapEntry.valueNode.range, mapEntry.key));
                }
                return;
            }
            addDiagnostic("warning", "unknown-component-property", `component type "${explicitType}" has no property "${mapEntry.key}"; it accepts ${acceptedKeys(explicitType).join(", ")}`, file, mapEntry.keyRange, node);
        });

        if (!explicitType) {
            addDiagnostic("warning", "unsupported-component", `node "${definitionName || mappingKey}" has no declared type; showing a placeholder`, file, mapNode.range, node);
        } else if (!entry) {
            addDiagnostic("warning", "unsupported-component", `"${explicitType}" is not a registered component type (see runtime/componentTypes.js); showing a placeholder`, file, mapNode.range, node);
        } else if (!entry.implemented) {
            addDiagnostic("warning", "unsupported-component", `component type "${explicitType}" is declared but not rendered yet; showing a placeholder`, file, mapNode.range, node);
        }

        return node;
    }

    function convertReference(name, refFile, refRange, slotKey) {
        if (resolving.has(name)) {
            addDiagnostic("error", "reference-cycle", `reference cycle detected at component "${name}"`, refFile, refRange, null);
            return makePlaceholder("reference-cycle", name, refFile, refRange, { file: refFile, range: refRange });
        }
        const resolved = loadNamed("components", name);
        if (!resolved) {
            const suffix = slotKey ? ` (referenced as "${slotKey}")` : "";
            addDiagnostic("warning", "unresolved-component-reference", `unresolved component reference "${name}"${suffix}`, refFile, refRange, null);
            return makePlaceholder(name, slotKey || name, refFile, refRange, { file: refFile, range: refRange });
        }
        resolving.add(name);
        const node = convertComponentMap(resolved.root, resolved.path, slotKey || null, { file: refFile, range: refRange });
        resolving.delete(name);
        return node;
    }

    function convertContentItem(item, file) {
        if (item.kind === "scalar") {
            return convertReference(scalarValue(item), file, item.range, null);
        }
        if (item.kind === "map" && item.entries.length === 1) {
            const [entry] = item.entries;
            if (entry.key === "text" && entry.valueNode.kind === "scalar") {
                const { variants, warnings } = splitLabel(scalarValue(entry.valueNode));
                warnings.forEach(w => addDiagnostic("warning", "empty-label-variant", w, file, entry.valueNode.range, null));
                const labelNode = { type: "label", definitionName: null, labelVariants: variants, layout: AUTO_LAYOUT, children: [], bindings: [], source: { file, range: item.range }, refSource: null, supported: true };
                attachStyle(labelNode, "label", null, file);
                return labelNode;
            }
            if (!isAnyKnownKey(entry.key) && entry.valueNode.kind === "map") {
                return convertComponentMap(entry.valueNode, file, entry.key, null);
            }
            if (!isAnyKnownKey(entry.key) && entry.valueNode.kind === "scalar") {
                return convertReference(scalarValue(entry.valueNode), file, entry.valueNode.range, entry.key);
            }
        }
        if (item.kind === "map") {
            return convertComponentMap(item, file, null, null);
        }
        addDiagnostic("error", "unsupported-content-item", "unrecognized content item shape", file, item.range, null);
        return null;
    }

    const appText = readFile(appYamlPath);
    if (appText === null || appText === undefined) {
        return { root: null, skin: BUILTIN_SKIN, diagnostics: [{ severity: "error", code: "missing-file", message: `cannot read ${appYamlPath}`, file: appYamlPath, range: null, nodeId: null }], hardFailure: true, sourceFiles: [] };
    }
    sourceFiles.add(appYamlPath);
    const parsedApp = parseYamlDocument(appText, appYamlPath);
    if (parsedApp.errors.length > 0) {
        return {
            root: null,
            skin: BUILTIN_SKIN,
            diagnostics: parsedApp.errors.map(e => ({ severity: "error", code: "yaml-syntax-error", message: e.message, file: e.file, range: e.range, nodeId: null })),
            hardFailure: true,
            sourceFiles: [...sourceFiles]
        };
    }

    const appNode = mapGet(parsedApp.root, "app");
    if (!appNode) {
        return { root: null, skin: BUILTIN_SKIN, diagnostics: [{ severity: "error", code: "missing-app-root", message: `${appYamlPath} has no top-level "app" key`, file: appYamlPath, range: parsedApp.root.range, nodeId: null }], hardFailure: true, sourceFiles: [...sourceFiles] };
    }
    const mainNode = mapGet(mapGet(appNode, "ui") || { kind: "map", entries: [] }, "main");
    if (!mainNode) {
        return { root: null, skin: BUILTIN_SKIN, diagnostics: [{ severity: "error", code: "missing-app-ui-main", message: `${appYamlPath} has no app.ui.main`, file: appYamlPath, range: appNode.range, nodeId: null }], hardFailure: true, sourceFiles: [...sourceFiles] };
    }

    // The skin must be compiled before the tree: every node's style and the
    // layout defaults for "fixed" dimensions come from it.
    const skinNameNode = mapGet(appNode, "skin");
    const skinName = scalarValue(skinNameNode) || "default";
    const skinPath = `skin/${skinName}.yaml`;
    const parsedSkin = parseFile(skinPath);
    if (!parsedSkin || !parsedSkin.root) {
        addDiagnostic("warning", "missing-skin", `cannot read ${skinPath}; drawing with the built-in fallback skin`, appYamlPath, (skinNameNode || appNode).range, null);
    } else {
        parsedSkin.errors.forEach(err => addDiagnostic("error", "yaml-syntax-error", err.message, err.file, err.range, null));
        skin = compileSkin({
            name: skinName,
            file: skinPath,
            root: parsedSkin.root,
            addDiagnostic: (severity, code, message, file, range) => addDiagnostic(severity, code, message, file, range, null),
            listAssets: dependencies.listAssets
        });
        layoutDefaults = { ...styleLayoutDefaults(BUILTIN_SKIN), ...styleLayoutDefaults(skin) };
    }

    const root = convertComponentMap(mainNode, appYamlPath, "main", null);

    // Spec 071: an image/icon node's own asset-naming property (declared
    // generically as assetPropertyOf(type), never branched on by type name -
    // see tests/componentTypes.test.js's own "no module outside the
    // registry branches on a component type name") also names a skin asset,
    // but compileSkin() above never sees the app tree at all - only
    // skin.yaml itself - so nothing before this point ever registered that
    // use. See registerAssetUse()'s own doc comment for why this is a real
    // gap, not a redundant check. Skipped entirely when skin compilation
    // itself failed (skin === BUILTIN_SKIN, the shared, frozen fallback
    // singleton) - mutating that would leak across every later compilation
    // in the process, not just this one.
    if (skin !== BUILTIN_SKIN) {
        (function registerImageAssetUses(node) {
            if (!node) return;
            const assetProperty = assetPropertyOf(node.type);
            const assetName = assetProperty ? node[assetProperty] : null;
            if (assetName) {
                registerAssetUse(skin, assetName, node.source?.file, node.source?.range, `${node.type} "${node.definitionName || "?"}"`, (severity, code, message, file, range) => addDiagnostic(severity, code, message, file, range, node), dependencies.listAssets);
            }
            (node.children || []).forEach(registerImageAssetUses);
        })(root);
    }

    const appRules = mapGet(appNode, "rules");
    if (appRules) {
        if (appRules.kind === "seq") appRules.items.forEach(item => resolveRuleText(appYamlPath, item, root));
        else resolveRuleText(appYamlPath, appRules, root);
    }

    const { diagnostics: identityDiagnostics } = assignInstanceIds(root);

    const finalDiagnostics = [...diagnostics, ...identityDiagnostics].map(d =>
        "nodeRef" in d
            ? { severity: d.severity, code: d.code, message: d.message, file: d.file, range: d.range, nodeId: d.nodeRef ? d.nodeRef.id : null }
            : d
    );

    return { root, skin, diagnostics: finalDiagnostics, hardFailure: false, sourceFiles: [...sourceFiles] };
}
