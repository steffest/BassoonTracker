// Prose interpretation (spec 005 design.md "Interpreting prose and
// generating bindings"). A small, tested phrase/recipe vocabulary maps
// recognized rule/action text to a binding; anything else is reported as an
// unresolved-interpretation warning and left inert. Descriptions/rules are
// never rewritten - the authored text is preserved verbatim on the node,
// these recipes only add a generated, inspectable binding alongside it.

// Rule names that are process/non-functional and never describe a control
// binding. Referencing them is not a warning; they simply produce no
// generated behavior binding.
const INFORMATIONAL_RULE_NAMES = new Set(["noDependencies"]);

// Rule names that are already fully expressed through independent layout
// fields (spec 005); referencing them by name adds provenance, not a new
// binding kind.
const LAYOUT_POLICY_RULE_NAMES = new Set(["horizontalResize"]);

const ACTION_RECIPES = [
    {
        code: "toggle-play-state",
        pattern: /toggle\s+play\s+state/i,
        bind: () => ({ kind: "command", command: "transport.toggle", mockField: "playback.status", mockValues: ["stopped", "playing"] })
    },
    {
        code: "toggle-recording",
        pattern: /toggle\s+recording/i,
        bind: () => ({ kind: "command", command: "record.toggle", mockField: "record.active", mockValues: [false, true] })
    },
    {
        code: "toggle-generic",
        pattern: /toggle\s+([a-z][a-z ]*?)\s+on\s+click/i,
        bind: match => {
            const subject = match[1].trim().replace(/\s+/g, "-");
            return { kind: "command", command: `${subject}.toggle`, mockField: `${subject}.active`, mockValues: [false, true] };
        }
    },
    {
        // Spec 014: what a `change` event asks for. The value comes from the
        // gesture, so there are no mock values to cycle through; the field is
        // named after the subject the way toggle-generic names its own.
        code: "set-value",
        pattern: /^set\s+(?:the\s+)?(?:number\s+of\s+)?([a-z][a-z0-9 ]*)$/i,
        bind: match => {
            const subject = match[1].trim().replace(/\s+/g, "-").toLowerCase();
            return { kind: "command", command: `${subject}.set`, mockField: `${subject}.value`, mockValues: [] };
        }
    }
];

// A visual-state rule ("highlighted when song playback is active") and the
// action that changes that state ("toggle play state") are authored as two
// unrelated pieces of prose; for the generated mock behavior to connect them
// they must resolve to the *same* mock field. This alias vocabulary is the
// deterministic bridge: a condition subject mentioning play/record maps to
// the field the matching ACTION_RECIPES entry toggles, with the value that
// counts as "active". Anything else gets a field derived from the subject
// text (active when truthy) so it stays inspectable, and simply won't be
// driven by any command until a recipe for it exists.
const CONDITION_FIELD_ALIASES = [
    { pattern: /\bplay/i, mockField: "playback.status", activeValue: "playing" },
    { pattern: /\brecord/i, mockField: "record.active", activeValue: true }
];

const RULE_RECIPES = [
    {
        code: "highlighted-when-active",
        pattern: /highlighted\s+when\s+(.+?)\s+is\s+active/i,
        bind: match => {
            const subject = match[1].trim();
            const alias = CONDITION_FIELD_ALIASES.find(a => a.pattern.test(subject));
            return {
                kind: "visual-state",
                state: "highlighted",
                mockField: alias ? alias.mockField : deriveMockFieldName(subject),
                activeValue: alias ? alias.activeValue : true,
                conditionText: subject
            };
        }
    }
];

function deriveMockFieldName(text) {
    return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}

function interpret(text, recipes) {
    for (const recipe of recipes) {
        const match = recipe.pattern.exec(text);
        if (match) return { supported: true, code: recipe.code, binding: recipe.bind(match) };
    }
    return { supported: false };
}

/**
 * @param {string} name the referenced rule's file name (e.g. "horizontalResize"), or null for inline rules
 * @param {string} text the rule's authored description/prose
 * @returns {{ supported: boolean, informational?: boolean, code?: string, binding?: object }}
 */
export function interpretRule(name, text) {
    if (name && INFORMATIONAL_RULE_NAMES.has(name)) return { supported: true, informational: true };
    if (name && LAYOUT_POLICY_RULE_NAMES.has(name)) return { supported: true, code: "layout-resize-policy", binding: { kind: "layout-policy", policy: "resize-to-fit" } };
    if (!text) return { supported: false };
    return interpret(text, RULE_RECIPES);
}

/**
 * @param {string} text the authored action description or inline action prose
 */
export function interpretAction(text) {
    if (!text) return { supported: false };
    return interpret(text, ACTION_RECIPES);
}

/**
 * An action referenced by name with no document behind it, read as prose:
 * `toggleRecording` becomes "toggle recording" (spec 014). Authors name
 * actions in camelCase and the recipe vocabulary is prose, so this is the
 * bridge between the two, and it is why the record button was inert.
 */
export function actionNameAsProse(name) {
    return String(name).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
