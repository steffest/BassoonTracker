import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import {
    COMPONENT_TYPES, UNIVERSAL_PROPERTIES, isKnownType, isImplemented,
    isContainer, childSlot, isStyledType, isInteractiveType, interactiveTypeNames,
    typeDirection, drawKindOf, knownProperty, acceptedKeys, isAnyKnownKey, typeEntries,
    selectionModeOf, ownsModule, behaviorOf, behaviorOptionsOf, cursorOf
} from "../runtime/componentTypes.js";
import { DRAW_KINDS, drawKind } from "../renderers/canvas/drawKinds.js";
import { BUILTIN_SKIN } from "../runtime/skinModel.js";

// Spec 009: the registry is the single description of every component type.
// These tests hold it to that: the entries are internally complete, the
// lookups answer what the compiler and the renderer ask, and no other module
// carries a list of type names or branches on one.

const __dirname = dirname(fileURLToPath(import.meta.url));
const V2 = join(__dirname, "..");
const LINE = /\r?\n/;

test("every entry is complete and internally consistent", () => {
    for (const [type, entry] of Object.entries(COMPONENT_TYPES)) {
        assert.ok(entry.description && entry.description.length > 20, `${type} has a description`);
        assert.equal(typeof entry.implemented, "boolean", `${type} declares implementation status`);
        assert.equal(typeof entry.styled, "boolean", `${type} declares styling`);
        assert.equal(typeof entry.interactive, "boolean", `${type} declares interactivity`);
        assert.ok(entry.properties && typeof entry.properties === "object", `${type} has a property map`);
        assert.ok([null, "row", "column"].includes(entry.direction), `${type} direction`);
        assert.ok([null, "exclusiveWithinParent"].includes(entry.selection), `${type} selection mode`);
        assert.ok(DRAW_KINDS[entry.draw], `${type} names an existing draw kind ("${entry.draw}")`);
        if (entry.container) {
            assert.ok(["content", "items"].includes(entry.container.childrenIn), `${type} children slot`);
            if (entry.container.childType) assert.ok(COMPONENT_TYPES[entry.container.childType], `${type} childType is registered`);
        }
        for (const [name, property] of Object.entries(entry.properties)) {
            assert.ok(!Object.prototype.hasOwnProperty.call(UNIVERSAL_PROPERTIES, name), `${type}.${name} must not shadow a universal property`);
            assert.ok(property.kind && property.description, `${type}.${name} documents kind and description`);
        }
    }
});

test("an implemented type is drawable and, when styled, has a fallback style", () => {
    for (const [type, entry] of typeEntries()) {
        if (!entry.implemented) {
            assert.equal(entry.draw, "placeholder", `${type} is not implemented, so it draws a placeholder`);
            assert.equal(isStyledType(type), false, "artwork is not resolved for a type that is not drawn");
            continue;
        }
        assert.notEqual(entry.draw, "placeholder", `${type} is implemented, so it has a real draw kind`);
        assert.equal(typeof drawKind(entry.draw).draw, "function");
        assert.equal(typeof drawKind(entry.draw).measure, "function");
        if (entry.styled) {
            assert.ok(BUILTIN_SKIN.styles[type], `${type} has a built-in fallback style, so it draws even with no authored skin`);
        }
    }
});

test("lookups answer what the compiler and the renderer ask", () => {
    assert.equal(isKnownType("button"), true);
    assert.equal(isKnownType("tooltip"), true, "a declared type is known even though it is not rendered");
    assert.equal(isKnownType("nonesuch"), false);
    assert.equal(isKnownType(null), false);

    assert.equal(isImplemented("button"), true);
    assert.equal(isImplemented("menu"), true, "promoted by spec 023");
    assert.equal(isImplemented("tooltip"), false);
    assert.equal(isImplemented("nonesuch"), false);

    assert.equal(isContainer("panel"), true);
    assert.equal(isContainer("button"), false);
    assert.equal(childSlot("radioGroup").childrenIn, "items");
    assert.equal(childSlot("radioGroup").childType, "radioItem");
    assert.equal(childSlot("button"), null);
    assert.equal(childSlot("panel").namedSlots, true);
    assert.equal(ownsModule("panel"), true, "the emitter gives the structural container its own module");
    assert.equal(ownsModule("radioGroup"), false, "a control group stays inline");

    assert.equal(typeDirection("radioGroup"), "row");
    assert.equal(typeDirection("panel"), null, "a panel keeps the renderer's fixed-height default");

    assert.equal(drawKindOf("checkbox"), "spriteLabel");
    assert.equal(drawKindOf("nonesuch"), "placeholder");

    // Derived from the registry rather than pinned, so adding an interactive
    // type does not fail this test; what is asserted is the *rule*.
    const interactive = interactiveTypeNames().sort();
    assert.deepEqual(interactive, typeEntries().filter(([, e]) => e.interactive && e.implemented).map(([t]) => t).sort());
    assert.ok(interactive.includes("button") && interactive.includes("radioItem") && interactive.includes("checkbox"));
    assert.equal(isInteractiveType("panel"), false);
    assert.equal(isInteractiveType("menu"), false, "menu itself draws nothing and has no controller; its synthesized menuTrigger children do (spec 023)");

    // Spec 014: a behavior and a cursor per type, both read by the renderer.
    assert.equal(behaviorOf("button"), "button", "an interactive type that names no behavior gets the button one");
    assert.equal(behaviorOf("slider"), "value");
    assert.equal(behaviorOf("viewport"), "scroll");
    assert.equal(behaviorOf("panel"), null);
    assert.equal(behaviorOf("menu"), null, "menu itself has no controller, only its synthesized menuTrigger children (spec 023)");
    assert.equal(behaviorOf("menuTrigger"), "disclose");
    assert.deepEqual(behaviorOptionsOf("spinBox"), { mode: "relative", axis: "y", stepper: true });
    assert.deepEqual(behaviorOptionsOf("button"), {});
    assert.equal(cursorOf("slider"), "ew-resize");
    assert.equal(cursorOf("nonesuch"), "default");

    assert.equal(selectionModeOf("radioItem"), "exclusiveWithinParent");
    assert.equal(selectionModeOf("button"), null);
    assert.equal(selectionModeOf("nonesuch"), null);
});

test("property classification separates a property, a child slot and a mistake", () => {
    assert.deepEqual(knownProperty("button", "label"), { known: true, where: "universal" });
    // shortKey moved to a universal property in spec 015, so any interactive
    // type can carry one, not only button.
    assert.deepEqual(knownProperty("button", "shortKey"), { known: true, where: "universal" });
    assert.deepEqual(knownProperty("panel", "content"), { known: true, where: "childSlot" });
    assert.deepEqual(knownProperty("button", "content"), { known: false, where: null }, "content is not a button property");
    assert.deepEqual(knownProperty("button", "labell"), { known: false, where: null });
    assert.deepEqual(knownProperty("nonesuch", "whatever"), { known: false, where: null });
    assert.deepEqual(knownProperty("nonesuch", "label"), { known: true, where: "universal" });

    const accepted = acceptedKeys("panel");
    assert.ok(accepted.includes("color") && accepted.includes("content") && accepted.includes("layout"));

    // Used where a single-key mapping must be read as either a named child
    // slot or a property of an anonymous component, before any type is known.
    for (const key of ["type", "label", "color", "shortKey", "text", "content", "items", "min"]) {
        assert.equal(isAnyKnownKey(key), true, key);
    }
    for (const key of ["volume meter", "notifications", "top", "nonesuch"]) {
        assert.equal(isAnyKnownKey(key), false, key);
    }
});

test("typeEntries lists implemented types first, then alphabetically", () => {
    const entries = typeEntries();
    const firstPlanned = entries.findIndex(([, entry]) => !entry.implemented);
    assert.ok(firstPlanned > 0, "some types are implemented");
    assert.ok(entries.slice(firstPlanned).every(([, entry]) => !entry.implemented), "planned types come last");
    const implemented = entries.slice(0, firstPlanned).map(([type]) => type);
    assert.deepEqual(implemented, [...implemented].sort());
});

test("the draw-kind table is total for the registry", () => {
    for (const entry of Object.values(COMPONENT_TYPES)) assert.ok(DRAW_KINDS[entry.draw], `draw kind "${entry.draw}" exists`);
    for (const [name, kind] of Object.entries(DRAW_KINDS)) {
        assert.equal(typeof kind.draw, "function", `${name}.draw`);
        assert.equal(typeof kind.measure, "function", `${name}.measure`);
    }
    assert.equal(drawKind("nonesuch"), DRAW_KINDS.placeholder, "an unknown kind degrades to the placeholder");
});

// --- the acceptance criterion for the registry itself -------------------

function sourceFiles() {
    const files = [join(V2, "build.mjs"), join(V2, "server.mjs"), join(V2, "capabilities.js")];
    const walk = dir => {
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.(js|mjs)$/.test(name)) files.push(full);
        }
    };
    ["compiler", "runtime", "renderers", "workbench"].forEach(dir => walk(join(V2, dir)));
    return files;
}

function scan(files, predicate) {
    const hits = [];
    for (const file of files) {
        readFileSync(file, "utf8").split(LINE).forEach((line, index) => {
            if (predicate(line, file)) hits.push(`${relative(V2, file)}:${index + 1} ${line.trim()}`);
        });
    }
    return hits;
}

test("no module outside the registry branches on a component type name", () => {
    // The registry's whole claim: behavior is chosen by a declared property
    // (implemented, styled, interactive, selection, container, draw kind),
    // never by comparing a type name. If a future type needs a branch, this
    // fails and names the file and line.
    //
    // Since spec 011 retired spec 003's renderer, this covers every module
    // with no exception.
    const names = Object.keys(COMPONENT_TYPES).join("|");
    const branch = new RegExp(`(?:===|!==|\\.has\\(|includes\\()\\s*"(?:${names})"`);
    const offenders = scan(sourceFiles(), line => branch.test(line));
    assert.deepEqual(offenders, [], `type-name branches found:${offenders.map(hit => `\n  ${hit}`).join("")}`);
});

test("adding a component type touches only the registry", () => {
    // `checkbox` was added by spec 009 through the registry alone: one entry,
    // a draw kind it shares with any other sprite-plus-label control, and skin
    // styles. No compiler, runtime, renderer or workbench module mentions it.
    // (`element.type = "checkbox"` is an HTML input, not a component type.)
    const allowed = new Set([
        join(V2, "runtime", "componentTypes.js"),
        join(V2, "runtime", "skinModel.js"),
        join(V2, "renderers", "canvas", "drawKinds.js")
    ]);
    const domInput = /\.type\s*=\s*"checkbox"/;
    const offenders = scan(
        sourceFiles().filter(file => !allowed.has(file)),
        line => /checkbox/i.test(line) && !domInput.test(line)
    );
    assert.deepEqual(offenders, [], `modules naming the new type:${offenders.map(hit => `\n  ${hit}`).join("")}`);
});

test("the lists the registry replaced stay gone", () => {
    const gone = [/SUPPORTED_TYPES/, /RESERVED_KEYS/, /STYLED_TYPES/, /INTERACTIVE_TYPES\s*=\s*new Set\(\[\s*"/];
    for (const file of sourceFiles()) {
        const text = readFileSync(file, "utf8");
        for (const pattern of gone) {
            assert.ok(!pattern.test(text), `${relative(V2, file)} still declares ${pattern}`);
        }
    }
});

test("spec 016/017/018/019/020/021/027: package P5's remaining declared-not-drawn types are all present and inert", () => {
    // icon, image and animSprite were promoted to implemented by spec 017;
    // rangeSlider and knob by spec 018; listbox by spec 019; dropdown,
    // submenu and modalDialog by spec 020; tabPanel, collapsePanel and
    // buttonGroup by spec 021; numberDisplay by spec 027. The other two spec
    // 016 declared are still placeholders, scrollbar deliberately among them
    // (spec 018 left it declared-only; see its requirements.md).
    const declared = ["scrollbar", "tooltip"];
    for (const type of declared) {
        assert.ok(Object.prototype.hasOwnProperty.call(COMPONENT_TYPES, type), `${type} is registered`);
        assert.equal(isImplemented(type), false, `${type} is not implemented yet`);
        assert.equal(drawKindOf(type), "placeholder", `${type} draws the placeholder box`);
        assert.equal(isStyledType(type), false, `${type} has no artwork to resolve while unimplemented`);
        assert.equal(behaviorOf(type), null, `${type} has no controller while unimplemented`);
    }
    // checkboxbutton is a documented decision, not an oversight: it is the
    // same shape as the already-implemented checkbox and is not carried
    // forward as a second entry (see 016's requirements.md/design.md).
    assert.ok(!Object.prototype.hasOwnProperty.call(COMPONENT_TYPES, "checkboxbutton"));
});
