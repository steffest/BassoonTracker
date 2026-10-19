// Minimal, source-range-preserving parser for the block-YAML subset this
// project actually authors in project/specs/application/current/**.
//
// Provenance (spec 005 design.md: "Any YAML parser must be deliberately
// selected with license/provenance, kept out of the shipped app"): this is
// project-owned code (MIT, same as the repository), written from scratch
// rather than adding a third-party dependency to the zero-dependency v2
// tree. It is intentionally NOT a general YAML implementation. It never
// ships to the runtime app; only the compiler (a development-time tool)
// imports it.
//
// Supported: block mappings, block sequences (including a sequence at the
// same indentation as its parent key, which real YAML also allows), scalar
// sequence items, single-key "named node" sequence items
// (`- name:\n    prop: value`), multi-key mapping sequence items
// (`- name: x\n  prop: y`), plain scalars, quoted scalars (no escape
// processing), whole-line comments, and folded multi-line plain scalars
// (extra-indented continuation lines are joined with a space).
//
// Not supported (will report a parse error or misread the document):
// flow collections (`{}`/`[]`), anchors/aliases/tags, multi-document
// streams, block scalars (`|`/`>`), tabs in indentation, colons inside an
// unquoted key/value on the same line, and inline trailing comments.

function toLines(text) {
    const rawLines = text.replace(/\r\n/g, "\n").split("\n");
    let offset = 0;
    return rawLines.map((raw, idx) => {
        const lineNumber = idx + 1;
        const startOffset = offset;
        offset += raw.length + 1;
        if (raw.includes("\t")) {
            return { lineNumber, indent: 0, content: raw.trim(), raw, startOffset, isBlank: false, isComment: false, tabError: true };
        }
        const stripped = raw.replace(/\s+$/, "");
        const indent = /^ */.exec(stripped)[0].length;
        const content = stripped.slice(indent);
        return {
            lineNumber,
            indent,
            content,
            raw,
            startOffset,
            isBlank: content.length === 0,
            isComment: content.startsWith("#")
        };
    });
}

// `column` is counted from the start of the raw line, so an offset always
// lands on the character it names even on an indented line. Spec 008's Skin
// tab splices YAML at these offsets, which only works if they are exact;
// before that only the line number was used, and the columns were short by
// each line's indentation.
function pos(line, column) {
    return { line: line.lineNumber, column, offset: line.startOffset + column };
}

/** The column just past a line's last non-blank character. */
function endColumn(line) {
    return line.indent + line.content.length;
}

function isQuotedText(text) {
    if (text.length < 2) return false;
    const first = text[0];
    const last = text[text.length - 1];
    return (first === '"' && last === '"') || (first === "'" && last === "'");
}

function unquote(text) {
    return isQuotedText(text) ? text.slice(1, -1) : text;
}

// Splits "key: rest" / "key:" on the first colon that acts as a mapping
// delimiter (followed by whitespace or end of string).
function splitKeyValue(text) {
    for (let i = 0; i < text.length; i++) {
        if (text[i] !== ":") continue;
        const next = text[i + 1];
        if (next === undefined || next === " " || next === "\t") {
            return { key: text.slice(0, i).trim(), rest: text.slice(i + 1).trim() };
        }
    }
    return null;
}

export function parseYamlDocument(text, filePath) {
    const errors = [];
    const significant = toLines(text).filter(line => !line.isBlank && !line.isComment);

    for (const line of significant) {
        if (line.tabError) {
            errors.push({ file: filePath, message: "tab characters are not supported in indentation", range: { start: pos(line, 0), end: pos(line, line.raw.length) } });
        }
    }

    const state = { i: 0 };

    function peek() {
        return state.i < significant.length ? significant[state.i] : null;
    }

    function fail(line, message) {
        errors.push({ file: filePath, message, range: { start: pos(line, line.indent), end: pos(line, endColumn(line)) } });
    }

    // Reads a plain scalar that may fold across following, more-indented lines.
    function readFoldedScalar(keyIndent, firstLine, firstRestText, restStartColumn) {
        const quoted = isQuotedText(firstRestText);
        let value = unquote(firstRestText);
        const startPos = pos(firstLine, restStartColumn);
        let endLine = firstLine;
        let end = endColumn(firstLine);
        state.i++;
        while (peek() && peek().indent > keyIndent) {
            const line = peek();
            value += " " + unquote(line.content);
            endLine = line;
            end = endColumn(line);
            state.i++;
        }
        return { kind: "scalar", value, quoted, range: { start: startPos, end: pos(endLine, end) } };
    }

    // Parses the value belonging to a key whose own line had nothing after
    // the colon: either a nested mapping, a sequence (allowed at the same
    // indentation as the key), or an empty/null value.
    function readBlockValue(keyIndent, keyLine) {
        const next = peek();
        if (!next || next.indent < keyIndent) {
            return { kind: "scalar", value: null, range: { start: pos(keyLine, endColumn(keyLine)), end: pos(keyLine, endColumn(keyLine)) } };
        }
        if (next.content.startsWith("-") && next.indent >= keyIndent) {
            return parseSequence(next.indent);
        }
        if (next.indent > keyIndent) {
            return parseMapping(next.indent);
        }
        return { kind: "scalar", value: null, range: { start: pos(keyLine, endColumn(keyLine)), end: pos(keyLine, endColumn(keyLine)) } };
    }

    function parseMappingEntry(indent) {
        const line = peek();
        const split = splitKeyValue(line.content);
        if (!split) {
            fail(line, `expected "key: value" but found "${line.content}"`);
            state.i++;
            return null;
        }
        const keyRange = { start: pos(line, line.indent), end: pos(line, line.indent + split.key.length) };
        let valueNode;
        if (split.rest === "") {
            state.i++;
            valueNode = readBlockValue(indent, line);
        } else {
            // readFoldedScalar consumes the key line itself (state.i++ first).
            const restStartColumn = line.indent + line.content.length - split.rest.length;
            valueNode = readFoldedScalar(indent, line, split.rest, restStartColumn);
        }
        return { key: unquote(split.key), keyRange, valueNode };
    }

    function parseMapping(indent) {
        const startLine = peek();
        const entries = [];
        while (peek() && peek().indent === indent && !peek().content.startsWith("-")) {
            const entry = parseMappingEntry(indent);
            if (entry) entries.push(entry);
        }
        const endLine = entries.length ? significant[Math.max(0, state.i - 1)] : startLine;
        return {
            kind: "map",
            entries,
            range: { start: pos(startLine, indent), end: pos(endLine, endColumn(endLine)) }
        };
    }

    // Parses one `- ...` item, including the "dash line carries the first
    // key of a mapping" case.
    function parseSequenceItem(dashIndent) {
        const line = peek();
        const afterDash = line.content.replace(/^-\s?/, "");
        const dashContentColumn = line.indent + (line.content.length - afterDash.length);

        if (afterDash === "") {
            state.i++;
            return readBlockValue(dashIndent, line);
        }

        const split = splitKeyValue(afterDash);
        if (!split) {
            const scalarRange = { start: pos(line, dashContentColumn), end: pos(line, endColumn(line)) };
            state.i++;
            return { kind: "scalar", value: unquote(afterDash), quoted: isQuotedText(afterDash), range: scalarRange };
        }

        const keyRange = { start: pos(line, dashContentColumn), end: pos(line, dashContentColumn + split.key.length) };
        let firstValue;
        if (split.rest === "") {
            state.i++;
            firstValue = readBlockValue(dashContentColumn, line);
        } else {
            const restStartColumn = dashContentColumn + afterDash.length - split.rest.length;
            firstValue = readFoldedScalar(dashContentColumn, line, split.rest, restStartColumn);
        }
        const entries = [{ key: unquote(split.key), keyRange, valueNode: firstValue }];
        while (peek() && peek().indent === dashContentColumn && !peek().content.startsWith("-")) {
            const entry = parseMappingEntry(dashContentColumn);
            if (entry) entries.push(entry);
        }
        const lastLine = significant[Math.max(0, state.i - 1)];
        return {
            kind: "map",
            entries,
            range: { start: pos(line, dashContentColumn), end: pos(lastLine, endColumn(lastLine)) }
        };
    }

    function parseSequence(indent) {
        const startLine = peek();
        const items = [];
        while (peek() && peek().indent === indent && peek().content.startsWith("-")) {
            items.push(parseSequenceItem(indent));
        }
        const endLine = significant[Math.max(0, state.i - 1)] || startLine;
        return { kind: "seq", items, range: { start: pos(startLine, indent), end: pos(endLine, endColumn(endLine)) } };
    }

    let root = null;
    if (significant.length > 0) {
        const first = significant[0];
        if (first.content.startsWith("-")) {
            root = parseSequence(first.indent);
        } else if (splitKeyValue(first.content)) {
            root = parseMapping(first.indent);
        } else {
            // No top-level key: the whole document is bare prose. Fold every
            // remaining line into one scalar, same as a folded scalar value.
            let value = unquote(first.content);
            let endLine = first;
            state.i++;
            while (peek()) {
                const line = peek();
                value += " " + unquote(line.content);
                endLine = line;
                state.i++;
            }
            root = { kind: "scalar", value, range: { start: pos(first, first.indent), end: pos(endLine, endColumn(endLine)) } };
        }
        if (state.i < significant.length) {
            fail(significant[state.i], `unexpected indentation at "${significant[state.i].content}"`);
        }
    }

    if (root) rejectUnsupportedSyntax(root, errors, filePath);

    return { root, errors };
}

// This parser doesn't understand flow collections (`[...]`/`{...}`) at all -
// left unchecked, `key: [oops` would just be accepted as the plain scalar
// text "[oops" (see the module header). Rather than silently misreading
// content that used a construct this subset doesn't support (including
// simply-unterminated flow syntax), treat any *unquoted* scalar containing a
// flow indicator character as a parse error, so an unsupported/malformed
// value is rejected instead of saved. A quoted scalar (spec 076: a bitmap
// font's own `chars` glyph set can genuinely need a literal "[", "]", "{" or
// "}" character) can't be mistaken for flow syntax - real flow collections
// never start with a quote mark - so it's exempt.
function rejectUnsupportedSyntax(node, errors, filePath) {
    if (node.kind === "scalar") {
        if (!node.quoted && typeof node.value === "string" && /[[\]{}]/.test(node.value)) {
            errors.push({
                file: filePath,
                message: `flow collection syntax ("[", "]", "{", "}") is not supported: "${node.value}"`,
                range: node.range
            });
        }
        return;
    }
    if (node.kind === "map") node.entries.forEach(entry => rejectUnsupportedSyntax(entry.valueNode, errors, filePath));
    else if (node.kind === "seq") node.items.forEach(item => rejectUnsupportedSyntax(item, errors, filePath));
}

/** Looks up `map.get("key")` returning the entry's value node, or null. */
export function mapGet(mapNode, key) {
    if (!mapNode || mapNode.kind !== "map") return null;
    const entry = mapNode.entries.find(e => e.key === key);
    return entry ? entry.valueNode : null;
}

/** Returns the plain string value of a scalar node, or null. */
export function scalarValue(node) {
    return node && node.kind === "scalar" && typeof node.value === "string" ? node.value : null;
}
