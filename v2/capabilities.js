// Capability manifest for the release build (spec 007).
//
// Maps a command id the compiler generated from the YAML (see the `command`
// field of action bindings in app-outline.json, e.g. "transport.toggle") to
// the hand-written module and export that implements it. `module` is a path
// relative to the v2 root. The implementation receives the app context
// ({ state, feature, log }, see app/main.js) and may be async.
//
// Commands that are not mapped here get a GENERATED MOCK action module and
// are listed in app/LOOSE-ENDS.md.
//
// A key beginning `host.` is a RESERVED HOST COMMAND (spec 014): it is not
// authored in YAML and is not compiled from a binding. It is a hook the
// renderer offers the application, and this is where the manifest says which
// module takes it. The emitter wires each one into the app context in
// `app/main.js`. Unmapped host hooks are simply absent, which is what keeps
// the authoring preview from reaching them.
export default {
    // Spec 012: the adapted v1 sequencer, behind domain/playback/index.js.
    // Only the generated application reaches it; the authoring preview keeps
    // the mock, so opening the workbench never starts an audio device.
    "transport.toggle": { module: "./domain/playback/index.js", export: "transportToggle" },
    // "record.toggle": still a generated mock; recording is not ported yet.

    // Spec 014: a module file dropped on the canvas is loaded and played.
    "host.openFiles": { module: "./domain/playback/index.js", export: "openFiles" }
};

/** Host hooks are named apart from compiled commands, and read as such. */
export const HOST_PREFIX = "host.";
