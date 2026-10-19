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
        // "on click" was originally required so this could not accidentally
        // swallow an inline sentence meant for another recipe; matched last
        // among the toggle recipes, an optional suffix is enough for that,
        // and it is what lets a bare authored name (`toggleHelpBubbles`
        // becomes "toggle help bubbles", spec 022) resolve without an author
        // having to write the "on click" a real sentence would carry.
        code: "toggle-generic",
        pattern: /^toggle\s+([a-z][a-z ]*?)(?:\s+on\s+click)?$/i,
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
    },
    {
        // Spec 022: the screens' one-shot commands (clear a track, copy a
        // pattern, insert a song step) - no value to cycle and no on/off
        // state, just "this ran", so `mockField` is null: `dispatch()`
        // already treats that as a fire-and-forget activation with nothing
        // to write, exactly like a plain click with no bound field at all.
        // Spec 037 adds "save" to the verb list (the File menu's own
        // `saveFile`, "save file" -> file.save) - the first genuinely new
        // authoring vocabulary any P9 spec has needed, since nothing existing
        // could express a one-shot save command. Spec 042 adds the sample
        // editor's own six zero-argument operations ("normalize", "trim",
        // "reverse", "invert", "fade in", "fade out" - the last two the
        // first multi-word verbs this recipe has matched, so the verb itself
        // is hyphenated the same way a multi-word subject already is,
        // keeping every generated field/command name space-free). Spec 045
        // adds "open"/"cancel" for the loop creator's own "Create Loop" and
        // "Cancel" buttons. Spec 048 adds "show" for the View menu's own
        // "showMain" (resolving it for the first time) - as a side effect,
        // the same menu's own already-authored, still-unmapped
        // showOptions/showFileOperations/showSampleEditor now resolve too
        // (each becomes a mocked-command loose end instead of an
        // unresolved-action-reference one); mapping those three is not this
        // spec's own concern - see its requirements.md. Spec 049 adds
        // "start" for the Nibbles screen's own single, state-dependent
        // primary button (Start/Resume/Try Again/REMATCH). Spec 057 adds
        // "add"/"remove" for the envelope screen's own +/- point buttons.
        // Spec 063 adds "random" for the File menu's own "Open Random MOD/XM
        // Song" ("randomSong"/"randomSongXM" have no leading verb at all in
        // v1's own action names, unlike every prior tenant - "random song"/
        // "random song xm" -> song.random/song-xm.random). Spec 067 adds
        // "export" for the save/export screen's own Sample/Playlist buttons
        // ("exportSample" -> "export sample" -> sample.export; "exportPlayList"
        // -> "export play list" -> play-list.export, keeping the same
        // "play-list" noun spec 063's own randomPlayList already established
        // rather than a second, inconsistent "playlist" spelling). Spec 072
        // adds "play" for the pattern sidebar's own transport row
        // ("playPreviousTrack"/"playNextTrack" -> "play previous track"/
        // "play next track" -> previous-track.play/next-track.play) - the
        // Play/Stop button itself keeps using the pre-existing named action
        // file `actions/toggleplay.yaml`, unaffected by this addition.
        code: "verb-action",
        pattern: /^(clear|copy|paste|insert|delete|increment|decrement|save|normalize|trim|reverse|invert|fade in|fade out|open|cancel|show|start|add|remove|random|export|play)\s+(?:the\s+)?([a-z][a-z0-9 ]*)$/i,
        bind: match => {
            const verb = match[1].trim().replace(/\s+/g, "-").toLowerCase();
            const subject = match[2].trim().replace(/\s+/g, "-").toLowerCase();
            return { kind: "command", command: `${subject}.${verb}`, mockField: null, mockValues: [] };
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
    { pattern: /\brecord/i, mockField: "record.active", activeValue: true },
    // Spec 042: the sample editor's loop-enabled toggle control is the
    // first authored rule to actually need this alias list for something
    // other than transport state - deriveMockFieldName's own dot-joining
    // would otherwise never agree with toggle-generic's hyphen-joined
    // "-active" field for a multi-word subject.
    { pattern: /\bloop enabled\b/i, mockField: "loop-enabled.active", activeValue: true },
    // Spec 045: the loop creator's own "Snap to zero" toggle control needs
    // the same seam.
    { pattern: /\bsnap to zero\b/i, mockField: "snap-to-zero.active", activeValue: true },
    // Spec 046: the resample panel's own "Interpolate" toggle control needs
    // the same seam a third time.
    { pattern: /\bresample interpolate\b/i, mockField: "resample-interpolate.active", activeValue: true },
    // Spec 057: the envelope screen's own enable/sustain/loop toggle
    // controls need the same seam, twice (volume and panning) - six entries, since
    // deriveMockFieldName's own dot-joining would otherwise never agree
    // with toggle-generic's hyphen-joined "-active" field for any of them,
    // the identical mismatch "loop enabled" already needed fixing above.
    { pattern: /\bvolume envelope enabled\b/i, mockField: "volume-envelope-enabled.active", activeValue: true },
    { pattern: /\bvolume envelope sustain\b/i, mockField: "volume-envelope-sustain.active", activeValue: true },
    { pattern: /\bvolume envelope loop\b/i, mockField: "volume-envelope-loop.active", activeValue: true },
    { pattern: /\bpanning envelope enabled\b/i, mockField: "panning-envelope-enabled.active", activeValue: true },
    { pattern: /\bpanning envelope sustain\b/i, mockField: "panning-envelope-sustain.active", activeValue: true },
    { pattern: /\bpanning envelope loop\b/i, mockField: "panning-envelope-loop.active", activeValue: true },
    // Spec 049: the Nibbles screen's own Wrap/Grid toggle controls need the
    // same seam - confirmed empirically (as every prior addition to this list
    // was) that a rule's own derived field for a bare, single-word subject
    // ("wrap"/"grid", no ".active" suffix at all) never agrees with
    // toggle-generic's own field either, the same as every multi-word
    // subject already in this list.
    { pattern: /^wrap$/i, mockField: "wrap.active", activeValue: true },
    { pattern: /^grid$/i, mockField: "grid.active", activeValue: true },
    // Spec 050: the FT-only side panel's own "disabled unless ft mode is
    // active" rule needs the same seam.
    { pattern: /\bft mode\b/i, mockField: "ft-mode.active", activeValue: true },
    // Spec 070's own UI-alignment pass (step 6): the control bar's own File
    // Operations/Options/Sample Edit buttons highlight based on which
    // *string value* their own section's shared field currently holds, not
    // a boolean ".active" flag - deriveMockFieldName's own dot-joining
    // would produce a stray, unrelated field name here regardless (the same
    // reason every entry above this one exists), so both the field name and
    // the value being compared against need spelling out explicitly.
    { pattern: /\bfile operations view\b/i, mockField: "song-properties-view.value", activeValue: "File Operations" },
    { pattern: /\boptions view\b/i, mockField: "song-properties-view.value", activeValue: "Options" },
    { pattern: /\bsample edit panel\b/i, mockField: "pattern-section-view.value", activeValue: "Sample Edit" },
    // Spec 072: the pattern sidebar's own Shuffle button needs the same
    // bare-single-word seam wrap/grid already needed (spec 049) -
    // deriveMockFieldName("shuffle") produces the bare field "shuffle", but
    // toggleShuffle's own toggle-generic binding writes "shuffle.active".
    { pattern: /^shuffle$/i, mockField: "shuffle.active", activeValue: true }
];

const RULE_RECIPES = [
    /**
     * Spec 098: v1's option groups light whichever choice currently matches
     * a value, not a boolean "is active" flag (script/src/ui/optionsPanel.js
     * sets `button.isActive = (b === option.def.getValue())` on every
     * resize). "highlighted when active" cannot express that, and the
     * CONDITION_FIELD_ALIASES list above cannot scale to one entry per
     * choice of every group. This recipe names the field and the value it
     * must hold outright - no derivation, no alias - and is the only rule
     * form that can say "this one of several". A bare integer is compared
     * as a number and "true"/"false" as booleans, because a domain module
     * that stores an index (domain/playback#setScreenRefresh) or a flag
     * (domain/settings#applyToggle) stores a real number or boolean, and
     * the runtime's own highlight check is a strict comparison.
     */
    {
        code: "highlighted-when-field-equals",
        pattern: /^highlighted\s+when\s+([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+)\s+is\s+"([^"]*)"$/i,
        bind: match => ({
            kind: "visual-state",
            state: "highlighted",
            mockField: match[1],
            activeValue: /^-?\d+$/.test(match[2]) ? Number(match[2])
                : match[2] === "true" ? true
                : match[2] === "false" ? false
                : match[2],
            conditionText: `${match[1]} is "${match[2]}"`
        })
    },
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
    },
    /**
     * Spec 050: the first compiler path to `disabledWhen` (spec 015's own
     * runtime mechanism, never authorable from YAML until now). Mirrors
     * "highlighted-when-active" exactly, except the generated check is
     * negated - "disabled unless X is active" reads more naturally for a
     * condition shaped like sampleView.js's own `disabled = !inFTMode()`
     * than a double-negative "disabled when not X".
     */
    {
        code: "disabled-unless-active",
        pattern: /disabled\s+unless\s+(.+?)\s+is\s+active/i,
        bind: match => {
            const subject = match[1].trim();
            const alias = CONDITION_FIELD_ALIASES.find(a => a.pattern.test(subject));
            return {
                kind: "visual-state",
                state: "disabled",
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
