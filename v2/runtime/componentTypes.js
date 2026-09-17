// The component catalogue (spec 009): one declaration per component type,
// read by the compiler, the layout engine, the canvas renderer, the runtime
// factories, the emitter and the workbench. Before this file each of those
// kept its own hardcoded list of type names, so adding a type meant six
// edits and nothing could check an authored property against a contract.
//
// It lives in runtime/ for the same reason skinModel.js does: the compiler
// and the renderer both need it, and the renderer must not import the
// compiler (its YAML parser never ships to the application). Data plus pure
// functions only: no DOM, no filesystem, no parser.
//
// Adding a type means adding an entry here. A type whose appearance is new
// also needs one draw kind in renderers/canvas/drawKinds.js, and a type with
// artwork needs styles in the authored skin. Nothing else.

/**
 * Properties every component accepts, declared once. `kind` is documentation
 * for the workbench catalogue, not a coercion: values are read exactly as
 * they are today.
 */
export const UNIVERSAL_PROPERTIES = {
    type: { kind: "reference", description: "The component type, which selects the contract below." },
    name: { kind: "text", description: "Identity within its parent. Also the fallback label." },
    label: { kind: "text", description: "Label text. Comma-separated alternatives are ordered longest/preferred first." },
    variant: { kind: "reference", description: "Skin style variant for this component's own type (spec 008)." },
    style: { kind: "reference", description: "Accepted alias of variant." },
    layout: { kind: "map", description: "width and height of fill/fixed/a number, and resizable of horizontal/vertical." },
    rule: { kind: "prose", description: "One rule, by name or as prose, interpreted into a binding where the vocabulary allows." },
    rules: { kind: "prose", description: "A sequence of rules, same interpretation as rule." },
    actions: { kind: "prose", description: "Event-to-action mapping, an action name, or inline prose." },
    action: { kind: "prose", description: "Accepted alias of actions." },
    description: { kind: "prose", description: "Prose documentation for this component. Not rendered." },
    shortKey: { kind: "key", description: "Keyboard shortcut, e.g. \"Ctrl+S\". Activates this component from anywhere, respecting disabled (spec 015)." },
    tooltip: { kind: "text", description: "Text shown after hovering this component for a delay (spec 015). No component declares the tooltip type itself yet (P5); this is a plain property any type can carry." },
    breakpoints: { kind: "map", description: "A declared breakpoint mechanism (spec 025): a sequence of { maxWidth, layout }, each a partial layout override applied when the viewport is at most maxWidth wide. The narrowest matching one wins, replacing v1's hand-written per-pixel cascade (script/src/ui/app/layout.js)." },
    visibleWhen: { kind: "map", description: "{ field, oneOf }: this node (and its subtree) is absent from layout, drawing and hit-testing entirely unless the named state field's current value is one of oneOf (spec 025) - the mechanism v1's EVENT.showView view-routing needs, generalized to any node rather than a fixed set of named regions." }
};

/**
 * @typedef {object} ComponentTypeEntry
 * @property {string} description prose shown in the workbench catalogue
 * @property {boolean} implemented false records a planned type: its properties are
 *   validated and documented, and the renderer draws its placeholder
 * @property {null|{ childrenIn: "content"|"items", childType?: string, namedSlots?: boolean, itemActions?: boolean }} container
 *   how children are authored; null for a leaf, which makes an unknown key a
 *   property mistake instead of a child
 * @property {boolean} styled whether the skin defines artwork for this type
 * @property {boolean} interactive whether the renderer gives it a behavior controller
 * @property {string} [behavior] which controller, from runtime/behaviors.js; an
 *   interactive type that names none gets "button" (spec 014)
 * @property {object} [behaviorOptions] passed straight to that behavior's factory
 * @property {string} [cursor] the CSS cursor keyword shown over this type (spec 014)
 * @property {null|"row"|"column"} direction a container's main axis; null keeps the
 *   documented default (a fixed-height container is one row, anything else a column)
 * @property {boolean} [clips] whether the node clips its content to its own box (spec 013)
 * @property {"flow"|"overlay"} [layer] "overlay" takes the node out of flow, painted
 *   above the tree and hit-tested before it (spec 013)
 * @property {boolean} [modal] an overlay that swallows input outside itself (spec 013)
 * @property {boolean} [dismissOnOutsideClick] a modal overlay that also closes on a
 *   click outside its own subtree (spec 020: dropdownPopup, submenu); a plain
 *   modalDialog does not declare this, matching v1, where only Escape/OK/Cancel
 *   close a message dialog
 * @property {boolean} [animated] the renderer's animation clock advances this node's
 *   bound `field` on a timer while it is mounted (spec 017); unrelated to `interactive`,
 *   since nothing about a frame counter takes pointer or keyboard input
 * @property {boolean} [ticks] the renderer's own second, independent clock (spec 047)
 *   calls this node's controller's `onFrame(deltaMs)` every animation frame while it is
 *   mounted - for a whole simulation step, not a bound field's frame count, which is
 *   what `animated` is for; the two are kept as separate clocks on purpose (see
 *   047's requirements.md)
 * @property {"popup"|"dialogParts"} [synthesizes] which shape of synthetic children
 *   runtime/overlaySynthesis.js gives this type at mount time (spec 020); absent for
 *   every type that authors its own children (or has none)
 * @property {{ height: number }} [tabHeader] only the active item's subtree is laid out,
 *   drawn or hit-testable; the rest are absent from layout entirely, and `height` is the
 *   reserved header strip both runtime/genericLayout.js and the draw kind read (spec 021)
 * @property {boolean} [wrapsFlyoutItems] this container's own children, wherever one's
 *   type declares `isMenuFlyout`, are wrapped into a menuTrigger + the original node as
 *   its synthesized child (spec 023: menu, submenu) - the trigger stays in flow and draws
 *   itself; the wrapped node keeps its own overlay/modal behaviour unchanged
 * @property {boolean} [isMenuFlyout] this type gets wrapped into a menuTrigger when found
 *   as a child of a `wrapsFlyoutItems` container (spec 023: submenu only, so far - a menu
 *   item or a nested submenu item)
 * @property {boolean} [exclusiveOverlayChildren] opening one child's own synthesized
 *   overlay (via a menuTrigger) closes any sibling's that was already open (spec 023),
 *   matching v1's "only one active choice at a time" menu/submenu behaviour
 * @property {boolean} [collapsible] whether this container's children may be absent from
 *   layout entirely, gated on `context.collapsed(node)` (spec 021)
 * @property {null|"exclusiveWithinParent"} selection how activating one instance
 *   affects its siblings; "exclusiveWithinParent" is radio behavior, which is UI
 *   state until an action gives it a command
 * @property {string} draw a kind in renderers/canvas/drawKinds.js
 * @property {string|null} authoredIn where instances come from, when not authored directly
 * @property {Record<string, { kind: string, description: string }>} properties this type's own contract
 */

/** @type {Record<string, ComponentTypeEntry>} */
export const COMPONENT_TYPES = {
    panel: {
        description: "A container that groups other components. Draws the skin's panel artwork behind them and contributes no behavior of its own.",
        implemented: true,
        container: { childrenIn: "content", namedSlots: true, ownModule: true },
        styled: true,
        interactive: false,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "background",
        authoredIn: null,
        properties: {
            color: { kind: "color", description: "Authored colour hint. Carried on the node; the skin decides the artwork." }
        }
    },

    button: {
        description: "A push button. Triggers an action when activated by pointer or keyboard, and can be lit by a visual-state rule. Its appearance per state comes from its skin style variant.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "button",
        selection: null,
        direction: null,
        cursor: "pointer",
        draw: "backgroundLabel",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "A state field to draw the value of, instead of a static label - the renderer's own text resolution (mountGeneric.js#textOf) already reads this generically for any type; documented here for the first authored use (spec 049's own state-dependent Start/Resume/Try Again/REMATCH button)." }
        }
    },

    label: {
        description: "Static text drawn in one of the skin's fonts. No background artwork and no behavior.",
        implemented: true,
        container: null,
        styled: true,
        interactive: false,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "label",
        authoredIn: null,
        properties: {
            text: { kind: "text", description: "The text to draw. A content item authored as `- text: ...` becomes one of these." },
            field: { kind: "reference", description: "A state field to draw the value of, instead of static text. The field becomes part of the application's state." }
        }
    },

    viewport: {
        description: "A clipping box that scrolls its content. Its children are laid out at their natural size, translated by the scroll offset its bound state field holds, and cut off at the viewport's edge. The wheel, a drag on its background and a drag on its scrollbar all move that offset; a viewport with no bound field is simply a clipping box and passes the wheel on.",
        implemented: true,
        container: { childrenIn: "content", namedSlots: true },
        styled: true,
        interactive: true,
        behavior: "scroll",
        selection: null,
        direction: "column",
        clips: true,
        cursor: "grab",
        draw: "background",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "A state field holding the vertical scroll offset in pixels. Clamped to the content extent, so a bad value cannot lose the content." }
        }
    },

    radioGroup: {
        description: "A row of mutually exclusive choices. Draws no artwork itself; its style variant chooses, through itemStyle, which radioItem style its choices are drawn with.",
        implemented: true,
        container: { childrenIn: "items", childType: "radioItem" },
        styled: true,
        interactive: false,
        selection: null,
        direction: "row",
        cursor: "default",
        draw: "none",
        authoredIn: null,
        properties: {}
    },

    radioItem: {
        description: "One choice in a radio group. Stays lit while selected. Selection is UI state only until a rule or action gives it a command.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "button",
        selection: "exclusiveWithinParent",
        direction: null,
        cursor: "pointer",
        draw: "backgroundLabel",
        authoredIn: "radioGroup.items",
        properties: {}
    },

    checkbox: {
        description: "An on/off box with a label beside it. Its artwork is drawn at its natural size rather than stretched, its on state comes from a visual-state rule, and clicking it runs its action.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "button",
        selection: null,
        direction: null,
        cursor: "pointer",
        draw: "spriteLabel",
        authoredIn: null,
        properties: {}
    },

    menu: {
        description: "A row of top-level items, each opening a submenu of commands (spec 023). Draws nothing of its own - each item is a synthesized menuTrigger, exactly as a dropdown's popup is synthesized, so a menu is composition of already-implemented mechanism (specs 013/015/020) rather than a new one. An item authored as type: submenu becomes a trigger that opens it; any other item (a plain button, say) stays exactly as authored and dispatches its own command normally.",
        implemented: true,
        container: { childrenIn: "items" },
        styled: false,
        interactive: false,
        wrapsFlyoutItems: true,
        exclusiveOverlayChildren: true,
        selection: null,
        direction: "row",
        cursor: "default",
        draw: "none",
        authoredIn: null,
        properties: {}
    },

    menuTrigger: {
        description: "The clickable top-level item a menu or a submenu wraps around a nested submenu (spec 023) - synthesized at mount time, never authored, from any item whose own type is submenu. A second use of dropdown's own \"disclose\" behavior: its click opens/closes its synthesized child (the original authored submenu), anchored per its own popupEdge instance property (\"below\" for a menu's own top-level items, \"right\" for one nested inside an already-open submenu) rather than dropdown's fixed \"below\".",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "disclose",
        selection: null,
        direction: null,
        cursor: "pointer",
        draw: "menuTrigger",
        authoredIn: "menu/submenu items whose own type is submenu (synthesized, spec 023) - never authored directly",
        properties: {}
    },

    slider: {
        description: "A horizontal track holding one bounded number. Pressing jumps to the pressed position, dragging follows the pointer, and the wheel moves one step per notch. The value lives in the bound state field, not in the component.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "value",
        behaviorOptions: { mode: "absolute", axis: "x" },
        selection: null,
        direction: null,
        cursor: "ew-resize",
        draw: "slider",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the value. Written on every change and read back as the authority for what the control shows." },
            min: { kind: "number", description: "Lowest value. Defaults to 0." },
            max: { kind: "number", description: "Highest value. Defaults to 100." },
            step: { kind: "number", description: "Granularity. Every value is snapped to it. Defaults to 1." }
        }
    },

    spinBox: {
        description: "A numeric readout with a stepper column. Pressing the upper or lower half of the stepper moves one step, dragging the readout moves continuously, and the wheel moves one step per notch. The value lives in the bound state field.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "value",
        behaviorOptions: { mode: "relative", axis: "y", stepper: true },
        selection: null,
        direction: null,
        cursor: "ns-resize",
        draw: "spinBox",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the value. Written on every change and read back as the authority for what the control shows." },
            min: { kind: "number", description: "Lowest value. Defaults to 0." },
            max: { kind: "number", description: "Highest value. Defaults to 100." },
            step: { kind: "number", description: "Increment per press of the stepper and per wheel notch. Defaults to 1." }
        }
    },

    inputbox: {
        description: "One line of editable text with a caret and a selection. Clicking places the caret, typing edits in place, and every keystroke writes the bound state field, which is the authority for what the control shows (spec 015).",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "text",
        selection: null,
        direction: null,
        cursor: "text",
        draw: "inputbox",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the text. Written on every keystroke and read back as the authority for what the control shows." },
            placeholder: { kind: "text", description: "Text shown, dimmed, when the field is empty." }
        }
    },

    // The fifteen entries below are declared, not drawn (spec 016, package
    // P5's first step): a contract and a placeholder box, exactly as `menu`
    // above has had since spec 009. Each is promoted to implemented: true,
    // with a draw kind, styles and a fuller contract, by its own later spec -
    // see 016's design.md for the rationale and the open questions for each.

    icon: {
        description: "A small representative icon, drawn from a named skin asset. Used inside a listbox row template, not usually on its own; shares image's draw kind, since both are \"draw this named sprite\" (spec 017).",
        implemented: true,
        container: null,
        styled: false,
        interactive: false,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "image",
        authoredIn: null,
        // Spec 071: which own property names a skin asset directly (as
        // opposed to a style state doing so) - declared generically so
        // compiler/convert.js's own registerImageAssetUses can register the
        // use without branching on this type's own name (the registry's
        // whole point - see tests/componentTypes.test.js's own "no module
        // outside the registry branches on a component type name").
        assetProperty: "icon",
        properties: {
            icon: { kind: "reference", description: "Which named skin asset to draw." }
        }
    },

    image: {
        description: "A named sprite, drawn at natural size (centred, or aligned by horizontalAlign/verticalAlign) or stretched to fill. No interaction state.",
        implemented: true,
        container: null,
        styled: false,
        interactive: false,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "image",
        authoredIn: null,
        assetProperty: "src", // see icon's own identical comment just above
        properties: {
            src: { kind: "reference", description: "The sprite to draw." },
            scale: { kind: "reference", description: "\"stretch\" to fill the box, or unset to draw at natural size." },
            horizontalAlign: { kind: "reference", description: "\"left\", \"right\" or unset (centred) when not stretched." },
            verticalAlign: { kind: "reference", description: "\"top\" or unset (centred) when not stretched." }
        }
    },

    numberDisplay: {
        description: "A digit-padded numeric readout (spec 027), editable by click-to-place-a-caret then digits/Backspace/Delete, ArrowUp/Down (+/-1) or the wheel (+/- step). Neither the value controller's bounds alone nor the text controller's caret alone fit - v1 re-parses its whole fixed-width padded string as an integer on every edit, clamped but never snapped to a step grid - so it gets its own controller (behavior \"digitEntry\") that borrows a bounds shape from one and a caret shape from the other.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "digitEntry",
        selection: null,
        direction: null,
        cursor: "text",
        draw: "numberDisplay",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the value. Written on every edit and read back as the authority for what the control shows." },
            min: { kind: "number", description: "Lowest value. Defaults to 0." },
            max: { kind: "number", description: "Highest value. Defaults to 100." },
            step: { kind: "number", description: "Increment per wheel notch (not per ArrowUp/Down, which v1 always moves by 1 regardless of step). Defaults to 1." },
            padLength: { kind: "number", description: "How many characters the value is left-padded with spaces to. Defaults to 4, matching v1's own default." },
            size: { kind: "reference", description: "\"small\", \"medium\" or \"big\" in v1, selecting an LED font size; accepted and validated but not yet drawn differently (spec 010's reduced-skin decision - no LED font asset exists yet)." }
        }
    },

    rangeSlider: {
        description: "A bounded value on a track with a knob-style thumb, optionally vertical (spec 018). Reuses slider's own \"value\" behavior unchanged - the controller already supported a vertical axis (spinBox's relative mode uses one) - so only a draw kind was new; the per-instance vertical property is read generically by the renderer and the draw kind, not by name. No sliderBox source exists anywhere in script/, so that half of the roadmap's \"rangeSlider and sliderBox\" is not declared here.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "value",
        behaviorOptions: { mode: "absolute", axis: "x" },
        selection: null,
        direction: null,
        cursor: "ew-resize",
        draw: "rangeSlider",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the value." },
            min: { kind: "number", description: "Lowest value. Defaults to 0." },
            max: { kind: "number", description: "Highest value. Defaults to 100." },
            vertical: { kind: "text", description: "Present to lay the track out top-to-bottom instead of left-to-right, and to drive the value from the vertical position." }
        }
    },

    knob: {
        description: "A rotary 0-100 control: a vertical drag changes the value, matching spinBox's own relative mode exactly (spec 018 reuses it unchanged, with no stepper). Drawn with canvas primitives, not skin artwork, since no rotary sprite exists in the built-in skin. v1's own version also toggles a disabled flag on a plain click, which is not carried forward - an unusual thing for a control to do to itself, flagged rather than silently ported when spec 016 declared this type.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "value",
        behaviorOptions: { mode: "relative", axis: "y" },
        selection: null,
        direction: null,
        cursor: "ns-resize",
        draw: "knob",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the value, 0 to 100 by default." }
        }
    },

    scrollbar: {
        description: "A standalone, resizable range: dragging the middle scrolls, dragging either edge zooms. Not a viewport's own thumb (spec 013/014 already gave viewport one) - this is for a track whose visible window and total extent are both authored, such as a waveform or arrangement view. Deliberately left declared-only by spec 018, which implemented rangeSlider and knob alongside it: with no waveform/arrangement view to need one yet, implementing it now would be shaping its contract to a guess rather than a real consumer.",
        implemented: false,
        container: null,
        styled: false,
        interactive: false,
        selection: null,
        direction: null,
        draw: "placeholder",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the scrolled/zoomed range." }
        }
    },

    patternGrid: {
        description: "The note grid (spec 030), the port's specialized-component contract: a leaf with no children, whose controller (behavior \"grid\") and draw kind read and write domain/song directly rather than a bound field, so it is always exactly one node (plus its synthesized selection menu) regardless of the loaded song's pattern length or track count. Draws only its visible rows/tracks, with the current pattern position always centered vertically; a horizontal window pans when tracks overflow. Ported from script/src/ui/app/components/patternView.js.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "grid",
        synthesizes: "selectionMenu",
        selection: null,
        direction: null,
        cursor: "default",
        draw: "patternGrid",
        authoredIn: null,
        properties: {}
    },

    fileBrowser: {
        description: "A scrollable, hierarchical list whose rows are runtime data (spec 035), not authored children - the port's second specialized-component leaf after patternGrid, for the same reason: an unbounded, dynamically-changing row count (a remote catalog listing, lazily expanded) cannot be authored YAML. Its own controller (behavior \"rowList\", named apart from this type so a type-name branch stays mechanically detectable) and draw kind read a bound row array instead of domain/song, so unlike patternGrid it is data-source-agnostic - any capability may publish rows to it. A row's own meaning (branch vs. leaf) is entirely opaque to this type: a bound change command decides what a click on a row means, the same as any other value-like control.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "rowList",
        selection: null,
        direction: null,
        cursor: "default",
        draw: "fileBrowser",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the selected row's index into the current row array. A change dispatches { value: index }; a capability decides what that row means." }
        }
    },

    waveformView: {
        description: "The current instrument's sample, drawn and range-selectable (spec 041) - the port's third specialized-component leaf after patternGrid and fileBrowser. Its own controller (behavior \"waveform\", named apart from this type for the same type-name-collision reason \"grid\"/\"rowList\" are) and draw kind read domain/song (the current instrument) and domain/sampleEditor (the current selection) directly, the same contract patternGrid already has - a waveform view is tied to exactly one thing, not a generic, data-source-agnostic container the way fileBrowser deliberately is.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "waveform",
        selection: null,
        direction: null,
        cursor: "default",
        draw: "waveformView",
        authoredIn: null,
        properties: {}
    },

    loopCreatorView: {
        description: "The loop creator's own interactive overlay (spec 044) - the port's fourth specialized-component leaf, after patternGrid, fileBrowser and waveformView. Its own controller (behavior \"loopCreator\", named apart from this type for the same type-name-collision reason \"waveform\"/\"rowList\"/\"grid\" are) and draw kind read domain/sampleEditor/loopCreator.js (spec 043's own state model and DSP) directly - eleven independent drag targets (two loop markers, three blend-size handles, three blend-volume lines, three \"original volume\" lines), each calling the exact domain setter spec 043 already built and clamps against. Not yet authored in any component tree - the menu-bar controls and screen wiring are a later spec's own, the same way waveformView's own screen (spec 042) followed its mechanism (spec 041).",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "loopCreator",
        selection: null,
        direction: null,
        cursor: "default",
        draw: "loopCreatorView",
        authoredIn: null,
        properties: {}
    },

    nibblesGrid: {
        description: "Nibbles' own playing field (spec 047) - the port's fifth specialized-component leaf, after patternGrid, fileBrowser, waveformView and loopCreatorView. A fixed 40x15 grid (the level layouts' own native size, not derived from any window or leaf pixel size - see 047's requirements.md). Its own controller (behavior \"nibbles\", named apart from this type for the same type-name-collision reason every other specialized leaf's own behavior is) and draw kind read domain/nibbles/index.js directly - the first specialized leaf whose domain module is not domain/song or domain/sampleEditor, since Nibbles shares nothing with the tracker's own document model. `ticks: true` keeps the renderer's own second clock alive while mounted, calling the controller's `onFrame(deltaMs)` every frame so the game keeps advancing without further input - independent of animSprite's own sprite-frame clock, which this is not (see requirements.md's Decisions). Not yet authored in any component tree - the screen (config panel, score/lives display, buttons, the high-score table, the menu action and feature-registry wiring) is a later spec's own.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "nibbles",
        ticks: true,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "nibblesGrid",
        authoredIn: null,
        properties: {}
    },

    multitrackView: {
        description: "The multitrack arrangement view's own interactive front end (spec 052) - the port's sixth specialized-component leaf, after patternGrid, fileBrowser, waveformView, loopCreatorView and nibblesGrid. Its own controller (behavior \"multitrack\", named apart from this type for the same type-name-collision reason every other specialized leaf's own behavior is) and draw kind read domain/song and domain/arrangement (spec 051's own headless engine) directly - scroll, horizontal zoom, seek-by-click, drag-to-move-note, a live per-track oscilloscope and a per-track solo/mute/record control strip. `ticks: true` keeps the renderer's own tick clock alive while mounted so the live oscilloscope keeps redrawing without further input, the same reason nibblesGrid needs it. Not yet authored in any component tree - the menu bar, the classic grid's own smaller mute/solo header and the screen wiring are a later spec's own.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "multitrack",
        ticks: true,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "multitrackView",
        authoredIn: null,
        properties: {}
    },

    volumeMeter: {
        description: "The stereo VU meter (spec 054) - the port's seventh specialized-component leaf, after patternGrid, fileBrowser, waveformView, loopCreatorView, nibblesGrid and multitrackView. Taps the mix's own final output (domain/playback#getMasterScopeData) directly, no bound field. Genuinely passive in v1 (no click/drag/keyboard at all) but still interactive:true/ticks:true - a controller (behavior \"vuMeter\", named apart from this type for the same type-name-collision reason every other specialized leaf's own behavior is) is required for `ticks` to take effect at all, even though it has almost nothing to do. Flat-colored dots, not skin-atlas sprites - see requirements.md's Decisions. Resolves app.yaml's own long-standing 'volume meter: volumemeter' unresolved-component-reference warning.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "vuMeter",
        ticks: true,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "volumeMeter",
        authoredIn: null,
        properties: {}
    },

    envelopeView: {
        description: "The envelope editor's own interactive graph (spec 056) - the port's eighth specialized-component leaf, after patternGrid, fileBrowser, waveformView, loopCreatorView, nibblesGrid, multitrackView and volumeMeter. Its own controller (behavior \"envelope\", named apart from this type for the same type-name-collision reason every other specialized leaf's own behavior is) and draw kind read domain/sampleEditor/envelope.js (spec 055) directly - drag a point, hover to find one. `envelopeType` (\"volume\"/\"panning\") is the first per-node property any specialized leaf in this port needs to pick which of two variants of the same domain concept it addresses, read the same way rangeSlider's own `vertical` override already is (mountGeneric.js's controller-construction loop, not a second component type). Not yet authored in any component tree - the surrounding panel and screen wiring are a later spec's own.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "envelope",
        selection: null,
        direction: null,
        cursor: "default",
        draw: "envelopeView",
        authoredIn: null,
        properties: {
            envelopeType: { kind: "text", description: "Which of the current instrument's two envelopes this view edits - \"volume\" or \"panning\". Defaults to \"volume\"." }
        }
    },

    scopesView: {
        description: "The live per-track oscilloscope grid (spec 058) - the port's ninth specialized-component leaf, after patternGrid, fileBrowser, waveformView, loopCreatorView, nibblesGrid, multitrackView, volumeMeter and envelopeView. Its own controller (behavior \"scopes\", named apart from this type for the same type-name-collision reason every other specialized leaf's own behavior is) and draw kind read domain/song/domain/arrangement directly (getTrackScopeData/getTrackMuteSolo/toggleTrackMute, specs 051/052) - no new domain work at all, the first specialized leaf needing none. Only v1's own \"tracks\" mode is ported - \"wave\"/\"spectrum\" are declared labels with no rendering path behind them in v1 itself (its own render() always calls the one render method the file defines, regardless of the cycled mode - confirmed by reading the whole file). A click toggles that track's own mute directly - no capabilities.js mapping, the same self-contained shape multitrackView's own control-strip clicks already have.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "scopes",
        ticks: true,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "scopesView",
        authoredIn: null,
        properties: {}
    },

    pianoView: {
        description: "The virtual piano keyboard (spec 061) - the port's tenth specialized-component leaf, after patternGrid, fileBrowser, waveformView, loopCreatorView, nibblesGrid, multitrackView, volumeMeter, envelopeView and scopesView. Its own controller (behavior \"piano\") and draw kind read domain/song#getCurrentOctave/domain/playback#previewNoteOn/previewNoteOff/isPreviewNoteActive (spec 060) directly - a click or drag plays a live-audition note through the current instrument, independent of the sequencer; releasing (or dragging onto a different key) stops it. Tiles as many octaves as the node's own real width fits, exactly like v1's own while-loop, rather than a fixed key count. Not yet authored in any component tree - the octave spinbox, close button and screen wiring are spec 062's own.",
        implemented: true,
        container: null,
        styled: false,
        interactive: true,
        behavior: "piano",
        selection: null,
        direction: null,
        cursor: "default",
        draw: "pianoView",
        authoredIn: null,
        properties: {}
    },

    listbox: {
        description: "A scrollable list of authored items, one selected at a time (spec 019). Reuses viewport's clip/scroll/overflow mechanism through the same generic clips flag rather than a name check - its own controller (behavior \"list\") adds click-to-select on top of the same wheel/drag/thumb scrolling. Items are ordinary child nodes of any type (spec 016 left the shape unconstrained), so a plain, non-interactive item still becomes selectable: a click bubbles up to the listbox that contains it.",
        implemented: true,
        container: { childrenIn: "items" },
        styled: false,
        interactive: true,
        behavior: "list",
        selection: null,
        direction: "column",
        clips: true,
        cursor: "default",
        draw: "listbox",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the selected index, 0-based into items. Falls back to a derived field, exactly as slider's does, when not authored." },
            reorderable: { kind: "text", description: "Declared, not yet wired to a behavior: dragging an item to reorder the list is a later spec's work (spec 019 design.md)." }
        }
    },

    dropdown: {
        description: "A closed control showing the selected item that opens a popup list of items on click, anchored below it (or above, if below would overflow the viewport). Builds on the layer: \"overlay\" / modal: true mechanism specs 013/015 shipped: its popup is a synthesized dropdownPopup child (spec 020), lifted from its own authored items at mount time, never authored directly.",
        implemented: true,
        container: { childrenIn: "items" },
        styled: true,
        interactive: true,
        behavior: "disclose",
        synthesizes: "popup",
        selection: null,
        direction: null,
        cursor: "pointer",
        draw: "dropdown",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the selected index, 0-based into items, exactly as listbox's own field does. Shared with the synthesized popup child, which resolves it the same way." }
        }
    },

    dropdownPopup: {
        description: "The popup a dropdown opens (spec 020): synthesized at mount time from the dropdown's own items, never authored - see runtime/overlaySynthesis.js. Visually and behaviorally the same as listbox (a dark backing, the selected row's tint, wheel/drag/thumb scrolling, the same \"list\" behavior), positioned as an anchored overlay instead of laid out in flow, and modal so a click outside it, or selecting one of its rows, closes it.",
        implemented: true,
        container: { childrenIn: "items" },
        styled: false,
        interactive: true,
        behavior: "list",
        selection: null,
        direction: "column",
        clips: true,
        layer: "overlay",
        modal: true,
        dismissOnOutsideClick: true,
        cursor: "default",
        draw: "dropdownPopup",
        authoredIn: "dropdown (synthesized, spec 020) - never authored directly",
        properties: {
            field: { kind: "reference", description: "Set by synthesis to the same field its owning dropdown resolves; never authored." }
        }
    },

    submenu: {
        description: "A flyout of commands (spec 020): hovering an item previews it, clicking a non-disabled item runs whatever command binding that item carries and closes the flyout, clicking a disabled one does nothing. Opened through the renderer's openOverlay API, or - since spec 023 - by a menu's own top-level item or a nested item whose type is itself submenu, each synthesized into a menuTrigger. Items are ordinary child nodes of any type, exactly as listbox's are, each free to carry its own actions binding.",
        implemented: true,
        container: { childrenIn: "items" },
        styled: false,
        interactive: true,
        behavior: "flyout",
        selection: null,
        direction: "column",
        layer: "overlay",
        modal: true,
        dismissOnOutsideClick: true,
        wrapsFlyoutItems: true,
        exclusiveOverlayChildren: true,
        isMenuFlyout: true,
        cursor: "default",
        draw: "submenu",
        authoredIn: null,
        properties: {}
    },

    modalDialog: {
        description: "A centred overlay: a message, and, per whichever of ok/cancel/input it declares, synthesized OK/Cancel buttons and an embedded text field (spec 020, runtime/overlaySynthesis.js). This is the type spec 015's Escape/Enter cascade and spec 013's modal gate were built for; both now actually close it, dispatching \"escape\"/\"enter\" first so an authored on.escape/on.enter still runs before the default close.",
        implemented: true,
        container: { childrenIn: "content" },
        styled: false,
        interactive: false,
        synthesizes: "dialogParts",
        selection: null,
        direction: "column",
        layer: "overlay",
        modal: true,
        cursor: "default",
        draw: "modalDialog",
        authoredIn: null,
        properties: {
            text: { kind: "prose", description: "Message text. Lines are separated by \"/\"; a line starting with \"*\" draws in the larger font, matching v1's own convention." },
            ok: { kind: "text", description: "Present to synthesize an OK button." },
            cancel: { kind: "text", description: "Present to synthesize a Cancel button." },
            input: { kind: "text", description: "Present to synthesize an embedded text field." }
        }
    },

    tabPanel: {
        description: "A row of tab buttons, each showing one child's own subtree; only the active one is laid out, drawn or hit-testable at all (spec 021). v1's version also hard-codes a footer strip and a tracker-specific layout constant, neither of which belongs in a generic catalogue type - both stay out of scope, an authored screen's concern rather than this type's.",
        implemented: true,
        container: { childrenIn: "items" },
        styled: false,
        interactive: true,
        behavior: "tabs",
        tabHeader: { height: 24 },
        selection: null,
        direction: "column",
        cursor: "default",
        draw: "tabPanel",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the active tab's index, 0-based into items. Falls back to a derived field, exactly as listbox's does, when not authored." }
        }
    },

    tooltip: {
        description: "Skinned, animated tooltip artwork (a Scale9 panel, an opacity fade). Spec 015 already shipped a plain-text, unskinned, unanimated hover-after-a-delay mechanism driven by a tooltip: property any type can carry - real and load-bearing today. This entry is for what v1's version adds on top; the gap between the two is deliberately visible here rather than only in prose.",
        implemented: false,
        container: null,
        styled: false,
        interactive: false,
        selection: null,
        direction: null,
        draw: "placeholder",
        authoredIn: null,
        properties: {}
    },

    collapsePanel: {
        description: "A panel with a labelled header whose click toggles whether its content is shown at all (spec 021). Nothing in v1's 33-line version actually collapsed anything; this spec decided it should, since the mechanism spec 020 built for showing/hiding an overlay generalizes cheaply to an in-flow container's children too.",
        implemented: true,
        container: { childrenIn: "content" },
        styled: false,
        interactive: true,
        behavior: "collapsible",
        collapsible: true,
        selection: null,
        direction: "column",
        cursor: "pointer",
        draw: "collapsePanel",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding whether the content is collapsed (truthy hides it). Falls back to a derived field when not authored; defaults to not collapsed." }
        }
    },

    animSprite: {
        description: "A frame strip stepped on a timer while mounted (spec 017's animation clock, the one piece of new renderer mechanism this type needed - see runtime/animationClock.js). The current frame lives in the bound field, exactly as a slider's value or a viewport's offset does, so nothing about how a draw kind reads state had to change.",
        implemented: true,
        container: null,
        styled: false,
        interactive: false,
        animated: true,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "animSprite",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the current frame index. Owned by the renderer's animation clock; not meant to be written from an action." },
            sprite: { kind: "reference", description: "The frame strip's sprite sheet." },
            frames: { kind: "number", description: "How many frames the strip holds." },
            frameDelay: { kind: "number", description: "Milliseconds per frame. Defaults to 120." }
        }
    },

    buttonGroup: {
        description: "Not a port: v1 has no formal grouping type, only ad hoc rows of buttons the layout code happens to place together. Items are ordinary child nodes (spec 021 dropped spec 016's guessed childType: \"button\", which turned out to be radioGroup's own \"the group dispatches, not the item\" shape - exactly wrong for independent buttons); buttonGroup itself draws nothing and adds no selection state, just a row default and no panel chrome.",
        implemented: true,
        container: { childrenIn: "items" },
        styled: false,
        interactive: false,
        selection: null,
        direction: "row",
        cursor: "default",
        draw: "none",
        authoredIn: null,
        properties: {}
    }
};

/** @returns {ComponentTypeEntry|null} */
export function componentType(type) {
    return (type && Object.prototype.hasOwnProperty.call(COMPONENT_TYPES, type) && COMPONENT_TYPES[type]) || null;
}

export function isKnownType(type) {
    return Boolean(componentType(type));
}

/** A declared type the renderer can actually draw. */
export function isImplemented(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.implemented);
}

export function isContainer(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.container);
}

/** How this type's children are authored, or null for a leaf. */
export function childSlot(type) {
    const entry = componentType(type);
    return entry && entry.container ? entry.container : null;
}

/** Which own property (if any) names a skin asset directly - image's "src", icon's "icon" (spec 071). Null for every other type. */
export function assetPropertyOf(type) {
    const entry = componentType(type);
    return entry && entry.assetProperty ? entry.assetProperty : null;
}

/** Artwork is only resolved for a type that both declares it and can be drawn. */
export function isStyledType(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.styled && entry.implemented);
}

export function isInteractiveType(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.interactive && entry.implemented);
}

/** Whether the renderer's animation clock owns this type's bound field (spec 017). */
export function isAnimatedType(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.animated && entry.implemented);
}

/** Whether the renderer's own second clock calls this type's controller every frame (spec 047). */
export function isTickingType(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.ticks && entry.implemented);
}

/**
 * Which controller this type gets (spec 014). An interactive type that names
 * no behavior gets "button", so every type that predates behaviors keeps its
 * controller without an entry of its own.
 * @returns {string|null} null for a type with no behavior at all
 */
export function behaviorOf(type) {
    const entry = componentType(type);
    if (!entry || !entry.interactive || !entry.implemented) return null;
    return entry.behavior || "button";
}

/** The options that behavior factory receives. Opaque to the renderer. */
export function behaviorOptionsOf(type) {
    const entry = componentType(type);
    return (entry && entry.behaviorOptions) || {};
}

/** The CSS cursor keyword shown over this type. */
export function cursorOf(type) {
    const entry = componentType(type);
    return (entry && entry.cursor) || "default";
}

export function interactiveTypeNames() {
    return Object.keys(COMPONENT_TYPES).filter(isInteractiveType);
}

/** A container's main axis, or null to use the renderer's documented default. */
export function typeDirection(type) {
    const entry = componentType(type);
    return (entry && entry.direction) || null;
}

/** How activating one instance affects its siblings, or null. */
export function selectionModeOf(type) {
    const entry = componentType(type);
    return (entry && entry.selection) || null;
}

/** Whether this type is the structural container the emitter gives its own module. */
export function ownsModule(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.container && entry.container.ownModule);
}

export function drawKindOf(type) {
    const entry = componentType(type);
    return entry ? entry.draw : "placeholder";
}

/**
 * Whether `key` is something this type accepts. Returns what it is, so a
 * caller can tell a property from a child slot from a mistake.
 * @returns {{ known: boolean, where: "universal"|"type"|"childSlot"|null }}
 */
export function knownProperty(type, key) {
    if (Object.prototype.hasOwnProperty.call(UNIVERSAL_PROPERTIES, key)) return { known: true, where: "universal" };
    const entry = componentType(type);
    if (entry && Object.prototype.hasOwnProperty.call(entry.properties, key)) return { known: true, where: "type" };
    if (entry && entry.container && entry.container.childrenIn === key) return { known: true, where: "childSlot" };
    return { known: false, where: null };
}

/**
 * Whether `key` names a property or child slot of *any* registered type.
 * Used where a single-key mapping has to be read as either a named child
 * slot or a property of an anonymous component, before its type is known.
 */
export function isAnyKnownKey(key) {
    if (Object.prototype.hasOwnProperty.call(UNIVERSAL_PROPERTIES, key)) return true;
    return Object.values(COMPONENT_TYPES).some(entry =>
        Object.prototype.hasOwnProperty.call(entry.properties, key) || (entry.container && entry.container.childrenIn === key));
}

/** Every property this type accepts, for a diagnostic message or the catalogue. */
export function acceptedKeys(type) {
    const entry = componentType(type);
    const own = entry ? Object.keys(entry.properties) : [];
    const slot = entry && entry.container ? [entry.container.childrenIn] : [];
    return [...Object.keys(UNIVERSAL_PROPERTIES), ...own, ...slot];
}

/** `[name, entry]` pairs, implemented types first, for the workbench catalogue. */
export function typeEntries() {
    return Object.entries(COMPONENT_TYPES).sort((a, b) => (a[1].implemented === b[1].implemented ? a[0].localeCompare(b[0]) : a[1].implemented ? -1 : 1));
}
