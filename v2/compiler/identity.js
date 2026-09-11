// Name-derived identity (spec 005 design.md "Source language and identity").
// No authored IDs are required. Definition identity prefers name, then
// mapping key, then filename. Instance identity combines reference
// ancestry and local name, falling back to type/first label, with an
// occurrence suffix only for otherwise-indistinguishable collisions.

/**
 * @param {string|null} explicitName the component's own `name:` field, if any
 * @param {string|null} mappingKey the key it was nested under (e.g. "top")
 * @param {string|null} fileBaseName the filename without extension, if this came from a referenced file
 */
export function definitionIdentity(explicitName, mappingKey, fileBaseName) {
    return explicitName || mappingKey || fileBaseName || null;
}

function localIdentity(node) {
    if (node.definitionName) return node.definitionName;
    if (node.labelVariants && node.labelVariants.length > 0) return `${node.type}.${node.labelVariants[0]}`;
    return node.type;
}

/**
 * Assigns a stable-within-this-compile instance id to every node in the
 * tree, using parent ancestry + local identity, and appends an occurrence
 * suffix only when siblings would otherwise collide. Emits a warning for
 * ambiguous duplicate authored names (ids assigned by suffix, not
 * silently merged).
 *
 * @param {object} root a tree of { type, definitionName, labelVariants, children }
 * @returns {{ diagnostics: Array }}
 */
export function assignInstanceIds(root) {
    const diagnostics = [];

    function visit(node, parentId) {
        const local = localIdentity(node);
        const candidate = parentId ? `${parentId}.${local}` : local;
        node.id = candidate;
        (node.children || []).forEach(child => visit(child, node.id));
    }

    visit(root, null);

    // Detect collisions across the whole tree (siblings sharing a parent are
    // the common case, but ancestry-qualified ids can still collide when two
    // otherwise-identical anonymous nodes sit under the same parent).
    const seen = new Map();
    const flat = [];
    (function collect(node) {
        flat.push(node);
        (node.children || []).forEach(collect);
    })(root);

    for (const node of flat) {
        const list = seen.get(node.id) || [];
        list.push(node);
        seen.set(node.id, list);
    }
    for (const [id, nodes] of seen) {
        if (nodes.length <= 1) continue;
        nodes.forEach((node, index) => {
            node.id = `${id}#${index + 1}`;
        });
        diagnostics.push({
            severity: "warning",
            code: "ambiguous-duplicate-name",
            message: `${nodes.length} nodes resolved to the same identity "${id}"; suffixed with #1.."#${nodes.length}"`,
            file: nodes[0].source?.file || null,
            range: nodes[0].source?.range || null,
            nodeId: id
        });
    }

    return { diagnostics };
}
