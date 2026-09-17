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
    // Spec 031: keyboard note entry needs a real "recording" concept to
    // gate on; record.toggle flips it and mirrors to the store.
    "record.toggle": { module: "./domain/song/index.js", export: "recordToggle" },
    "current-octave.set": { module: "./domain/song/index.js", export: "applyOctaveChange" },
    // Spec 032: the mocked "Screen refresh" action could not guess a value
    // set for a radioGroup's own label payload and was a no-op; the real
    // module maps the label to the frame-skip count the renderer reads.
    // "high-dpi.toggle" stays a mock on purpose - it is a plain boolean the
    // generated mock already cycles correctly; see 032's design.md.
    "screen-refresh.set": { module: "./domain/playback/index.js", export: "setScreenRefresh" },

    // Spec 014: a module file dropped on the canvas is loaded and played.
    "host.openFiles": { module: "./domain/playback/index.js", export: "openFiles" },

    // Spec 033: the twelve settings-backed controls authored since specs
    // 026/032, each now real and persisted through domain/settings/index.js
    // instead of a GENERATED MOCK that only cycled its own field.
    // "high-dpi.toggle" supersedes spec 032's own "no capability needed"
    // note - persistence is real domain logic a mock cannot do.
    "vu-bars.set": { module: "./domain/settings/index.js", export: "setVuBars" },
    "help-bubbles.toggle": { module: "./domain/settings/index.js", export: "toggleHelpBubbles" },
    "stereo-separation.set": { module: "./domain/settings/index.js", export: "setStereoSeparation" },
    "show-key-input.toggle": { module: "./domain/settings/index.js", export: "toggleShowKeyInput" },
    "high-dpi.toggle": { module: "./domain/settings/index.js", export: "toggleHighDpi" },
    "dropbox-mode.set": { module: "./domain/settings/index.js", export: "setDropboxMode" },
    "midi-input.set": { module: "./domain/settings/index.js", export: "setMidiInput" },
    "show-midi-input.toggle": { module: "./domain/settings/index.js", export: "toggleShowMidiInput" },
    "play-from.set": { module: "./domain/settings/index.js", export: "setPlayFrom" },
    "editor-layout.set": { module: "./domain/settings/index.js", export: "setEditorLayout" },
    "piano.toggle": { module: "./domain/settings/index.js", export: "togglePiano" },

    // Spec 036: the disk-operation screen's own fileBrowser (spec 035) and
    // its target radioGroup, backed by domain/diskOperations/index.js.
    "disk-target.set": { module: "./domain/diskOperations/index.js", export: "setDiskTarget" },
    "browser-row.set": { module: "./domain/diskOperations/index.js", export: "setBrowserRow" },

    // Spec 037: the File menu's own "Save" item, previously an
    // unresolved-action-reference no-op (compiler/recipes.js's verb-action
    // recipe gained "save" to resolve it at all).
    "file.save": { module: "./domain/moduleExport/index.js", export: "exportModule" },
    "song.random": { module: "./domain/randomSong/index.js", export: "openRandomSong" },
    "song-xm.random": { module: "./domain/randomSong/index.js", export: "openRandomSongXM" },
    "play-list.random": { module: "./domain/playlist/index.js", export: "openGeneratedPlaylist" },

    // Spec 070's own UI-alignment pass (step 6, correcting step 4's own
    // mistaken assumption): v1's control bar has three genuinely
    // *independent* toggle buttons, not one mutually-exclusive radioGroup -
    // confirmed live against the real app (Sample Edit and File Operations
    // can both be open at once). File Operations/Options share one real
    // field (song-properties-view.value, since v1's own appMainPanel.js
    // hides one when showing the other - the same slot Nibbles now also
    // shares, see domain/nibbles/index.js); Sample Edit owns a second,
    // completely independent field (pattern-section-view.value) that
    // neither of the other two ever touches. See domain/appView/index.js's
    // own header comment for the full reasoning.
    "file-operations-view.toggle": { module: "./domain/appView/index.js", export: "toggleFileOperationsView" },
    "options-view.toggle": { module: "./domain/appView/index.js", export: "toggleOptionsView" },
    "sample-edit-panel.toggle": { module: "./domain/appView/index.js", export: "toggleSampleEditPanel" },

    // Spec 067: the save/export screen - the sample/playlist format
    // radioGroups and their own "Export Sample"/"Export Playlist" buttons.
    // "save-type.set"/"disk-action.set" are deliberately left mocked (pure
    // UI state, the same as pattern-view.set).
    "sample-format.set": { module: "./domain/moduleExport/index.js", export: "setSampleExportFormat" },
    "sample.export": { module: "./domain/moduleExport/index.js", export: "exportSampleSelection" },
    "playlist-format.set": { module: "./domain/playlist/index.js", export: "setPlaylistExportFormat" },
    "play-list.export": { module: "./domain/playlist/index.js", export: "exportPlaylistSelection" },

    // Spec 042: the sample-editor screen (P10) - the instrument selector/
    // name field, a handful of instrument-metadata fields, and the four
    // sample-processing operations spec 040 built headless, now reachable
    // for the first time. compiler/recipes.js's verb-action recipe gained
    // "normalize"/"trim"/"reverse"/"invert"/"fade in"/"fade out" to resolve
    // the last six; the loop-enabled toggle control needed one new
    // CONDITION_FIELD_ALIASES entry to reflect its own state correctly.
    "instrument-index.set": { module: "./domain/sampleEditor/index.js", export: "setInstrumentIndex" },
    "instrument-name.set": { module: "./domain/sampleEditor/index.js", export: "setInstrumentName" },
    "sample-volume.set": { module: "./domain/sampleEditor/index.js", export: "setVolume" },
    "loop-enabled.toggle": { module: "./domain/sampleEditor/index.js", export: "toggleLoopEnabled" },
    "loop-start.set": { module: "./domain/sampleEditor/index.js", export: "setLoopStart" },
    "loop-length.set": { module: "./domain/sampleEditor/index.js", export: "setLoopLength" },
    "sample.normalize": { module: "./domain/sampleEditor/index.js", export: "normalizeSample" },
    "sample.fade-in": { module: "./domain/sampleEditor/index.js", export: "fadeInSample" },
    "sample.fade-out": { module: "./domain/sampleEditor/index.js", export: "fadeOutSample" },
    "sample.trim": { module: "./domain/sampleEditor/index.js", export: "trimSample" },
    "sample.reverse": { module: "./domain/sampleEditor/index.js", export: "reverseSample" },
    "sample.invert": { module: "./domain/sampleEditor/index.js", export: "invertSample" },

    // Spec 045: the loop creator's own menu bar and screen wiring - spec
    // 043's own headless state model/DSP and spec 044's own interactive
    // overlay, both reachable for the first time. compiler/recipes.js's
    // verb-action recipe gained "open"/"cancel" to resolve the two new
    // fire-and-forget commands; the "Snap to zero" toggle needed one more
    // CONDITION_FIELD_ALIASES entry, the same seam spec 042 already used.
    "loop-creator.open": { module: "./domain/sampleEditor/index.js", export: "openLoopCreator" },
    "loop-creator.save": { module: "./domain/sampleEditor/index.js", export: "saveLoopCreator" },
    "loop-creator.cancel": { module: "./domain/sampleEditor/index.js", export: "cancelLoopCreator" },
    "snap-to-zero.toggle": { module: "./domain/sampleEditor/index.js", export: "toggleSnapToZero" },
    "loop-preset.set": { module: "./domain/sampleEditor/index.js", export: "setLoopPreset" },
    // Spec 046: the resample panel - the second of P10's three separable
    // sample-editor sub-features, following the loop creator above. The
    // "Interpolate" toggle needed one more CONDITION_FIELD_ALIASES entry,
    // the same seam "Snap to zero"/"Loop enabled" already used.
    "resample.open": { module: "./domain/sampleEditor/index.js", export: "openResample" },
    "resample-target-index.set": { module: "./domain/sampleEditor/index.js", export: "setResampleTargetIndex" },
    "resample-interpolate.toggle": { module: "./domain/sampleEditor/index.js", export: "toggleResampleInterpolate" },
    "resample.save": { module: "./domain/sampleEditor/index.js", export: "saveResample" },
    "resample.cancel": { module: "./domain/sampleEditor/index.js", export: "cancelResample" },
    // Spec 048: Nibbles' own screen-prerequisite view switch. Corrected in
    // spec 070's own UI-alignment pass (step 6): confirmed against the real
    // v1 source and live in the browser that Nibbles renders inside the
    // song-properties section's own bounded strip (appMainPanel.js's own
    // pluginRenderHook, target "main", sized to that panel's own
    // dimensions) - not a full main-content-area replacement, as originally
    // assumed here. "main.show" ports v1's own "main" showView broadcast
    // exactly: it resets *both* song-properties-view.value and
    // pattern-section-view.value, matching appMainPanel.js's and
    // patternPanel.js's own independent "main" cases.
    "nibbles.open": { module: "./domain/nibbles/index.js", export: "openNibblesView" },
    "main.show": { module: "./domain/nibbles/index.js", export: "showMain" },
    // Spec 049: the Nibbles screen itself, replacing spec 048's placeholder.
    "nibbles.start": { module: "./domain/nibbles/index.js", export: "startNibbles" },
    "wrap.toggle": { module: "./domain/nibbles/index.js", export: "toggleWrap" },
    "grid.toggle": { module: "./domain/nibbles/index.js", export: "toggleGrid" },
    "difficulty.set": { module: "./domain/nibbles/index.js", export: "setNibblesDifficulty" },
    "high-score-view.toggle": { module: "./domain/nibbles/index.js", export: "toggleHighScoreView" },
    // Spec 050: the FT-only side panel.
    "finetune.set": { module: "./domain/sampleEditor/index.js", export: "setFinetune" },
    "panning.set": { module: "./domain/sampleEditor/index.js", export: "setPanning" },
    "fadeout.set": { module: "./domain/sampleEditor/index.js", export: "setFadeout" },
    "relative-note.set": { module: "./domain/sampleEditor/index.js", export: "setRelativeNote" },
    "vibrato-speed.set": { module: "./domain/sampleEditor/index.js", export: "setVibratoSpeed" },
    "vibrato-depth.set": { module: "./domain/sampleEditor/index.js", export: "setVibratoDepth" },
    "vibrato-sweep.set": { module: "./domain/sampleEditor/index.js", export: "setVibratoSweep" },
    "vibrato-wave.set": { module: "./domain/sampleEditor/index.js", export: "setVibratoWave" },
    // Spec 057: the envelope screen, twice (volume and panning).
    "volume-envelope-enabled.set": { module: "./domain/sampleEditor/index.js", export: "setVolumeEnvelopeEnabled" },
    "volume-envelope-point.add": { module: "./domain/sampleEditor/index.js", export: "addVolumeEnvelopePoint" },
    "volume-envelope-point.remove": { module: "./domain/sampleEditor/index.js", export: "removeVolumeEnvelopePoint" },
    "volume-envelope-sustain.set": { module: "./domain/sampleEditor/index.js", export: "setVolumeEnvelopeSustain" },
    "volume-envelope-sustain-point.set": { module: "./domain/sampleEditor/index.js", export: "setVolumeEnvelopeSustainPoint" },
    "volume-envelope-loop.set": { module: "./domain/sampleEditor/index.js", export: "setVolumeEnvelopeLoop" },
    "volume-envelope-loop-start.set": { module: "./domain/sampleEditor/index.js", export: "setVolumeEnvelopeLoopStart" },
    "volume-envelope-loop-end.set": { module: "./domain/sampleEditor/index.js", export: "setVolumeEnvelopeLoopEnd" },
    "panning-envelope-enabled.set": { module: "./domain/sampleEditor/index.js", export: "setPanningEnvelopeEnabled" },
    "panning-envelope-point.add": { module: "./domain/sampleEditor/index.js", export: "addPanningEnvelopePoint" },
    "panning-envelope-point.remove": { module: "./domain/sampleEditor/index.js", export: "removePanningEnvelopePoint" },
    "panning-envelope-sustain.set": { module: "./domain/sampleEditor/index.js", export: "setPanningEnvelopeSustain" },
    "panning-envelope-sustain-point.set": { module: "./domain/sampleEditor/index.js", export: "setPanningEnvelopeSustainPoint" },
    "panning-envelope-loop.set": { module: "./domain/sampleEditor/index.js", export: "setPanningEnvelopeLoop" },
    "panning-envelope-loop-start.set": { module: "./domain/sampleEditor/index.js", export: "setPanningEnvelopeLoopStart" },
    "panning-envelope-loop-end.set": { module: "./domain/sampleEditor/index.js", export: "setPanningEnvelopeLoopEnd" },

    // Spec 071: the song-properties section's own always-present content -
    // the mod-name inputbox, six spinboxes, and the instrument/song-pattern
    // row lists (both fileBrowser-typed, reusing that mechanism's own
    // generic row-list support rather than listbox's fixed-item one - see
    // that spec's requirements.md). "logo.toggle" is deliberately left
    // unmapped (a real, permanently mocked, purely cosmetic local toggle -
    // confirmed reading v1's own source that nothing else ever reads it).
    "song-title.set": { module: "./domain/playback/index.js", export: "setSongTitle" },
    "bpm.set": { module: "./domain/playback/index.js", export: "setBPM" },
    "current-pattern-number.set": { module: "./domain/song/index.js", export: "setCurrentPatternNumber" },
    "song-length.set": { module: "./domain/song/index.js", export: "setSongLength" },
    "song-repeat.set": { module: "./domain/song/index.js", export: "setSongRepeat" },
    "pattern-length.set": { module: "./domain/song/index.js", export: "setPatternLength" },
    "instrument-row.set": { module: "./domain/song/index.js", export: "setInstrumentRow" },
    "instrument-in-sample-editor.open": { module: "./domain/song/index.js", export: "openInstrumentInSampleEditor" },
    "song-pattern-row.set": { module: "./domain/song/index.js", export: "setSongPatternRow" },
    // Real capabilities now - closing songPatternList.yaml's own four
    // pre-existing mocked commands as a side effect of building Song
    // Length's own spinbox correctly (see requirements.md).
    "pattern.increment": { module: "./domain/song/index.js", export: "incrementSelectedPatternRow" },
    "pattern.decrement": { module: "./domain/song/index.js", export: "decrementSelectedPatternRow" },
    "pattern.insert": { module: "./domain/song/index.js", export: "insertAtSelectedPatternRow" },
    "pattern.delete": { module: "./domain/song/index.js", export: "deleteSelectedPatternRow" }
};

/** Host hooks are named apart from compiled commands, and read as such. */
export const HOST_PREFIX = "host.";
