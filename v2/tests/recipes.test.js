import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretAction, interpretRule, actionNameAsProse } from "../compiler/recipes.js";

// Spec 022: two small additions to the prose-action vocabulary, made because
// authoring the screens surfaced real gaps - a bare `toggleX` name (the
// established authoring convention already used for `toggleplay`/
// `toggleRecording`) never matched `toggle-generic`, which required an
// "on click" suffix only an inline sentence would carry, and there was no
// recipe at all for a one-shot command with no value and no on/off state
// (clear a track, insert a pattern step).

test("toggle-generic matches a bare \"toggle X\" name, not only \"toggle X on click\"", () => {
    const bare = interpretAction(actionNameAsProse("toggleHelpBubbles"));
    assert.equal(bare.supported, true);
    assert.equal(bare.binding.command, "help-bubbles.toggle");
    assert.deepEqual(bare.binding.mockValues, [false, true]);

    // The original inline-sentence phrasing still matches too.
    const sentence = interpretAction("toggle the sidebar on click");
    assert.equal(sentence.supported, true);
    assert.equal(sentence.binding.command, "the-sidebar.toggle");
});

test("toggle-generic does not shadow the two specific toggle recipes", () => {
    assert.equal(interpretAction("toggle play state").binding.command, "transport.toggle");
    assert.equal(interpretAction("toggle recording").binding.command, "record.toggle");
});

test("a one-shot verb (clear/copy/paste/insert/delete/increment/decrement/save) resolves to a fire-and-forget command", () => {
    const cases = [
        ["clearTrack", "track.clear"],
        ["copyPattern", "pattern.copy"],
        ["pasteTrack", "track.paste"],
        ["insertPattern", "pattern.insert"],
        ["deletePattern", "pattern.delete"],
        ["incrementPattern", "pattern.increment"],
        ["decrementPattern", "pattern.decrement"],
        ["saveFile", "file.save"]
    ];
    for (const [name, command] of cases) {
        const result = interpretAction(actionNameAsProse(name));
        assert.equal(result.supported, true, name);
        assert.equal(result.binding.command, command, name);
        assert.equal(result.binding.mockField, null, `${name} has nothing to write, unlike set-value`);
        assert.deepEqual(result.binding.mockValues, []);
    }
});

test("an unrecognized verb still reports unresolved, rather than a false match", () => {
    assert.equal(interpretAction(actionNameAsProse("randomizeSample")).supported, false);
});

// Spec 042: the sample editor screen's own six zero-argument operations -
// the first time verb-action needed a two-word verb ("fade in"/"fade out"),
// so the verb itself is hyphenated the same way a multi-word subject already is.
test("verb-action's spec-042 additions (normalize/trim/reverse/invert/fade in/fade out) resolve the same way", () => {
    const cases = [
        ["normalizeSample", "sample.normalize"],
        ["trimSample", "sample.trim"],
        ["reverseSample", "sample.reverse"],
        ["invertSample", "sample.invert"],
        ["fadeInSample", "sample.fade-in"],
        ["fadeOutSample", "sample.fade-out"]
    ];
    for (const [name, command] of cases) {
        const result = interpretAction(actionNameAsProse(name));
        assert.equal(result.supported, true, name);
        assert.equal(result.binding.command, command, name);
        assert.equal(result.binding.mockField, null, name);
    }
});

// Spec 042: a rule condition and a toggle-generic action must resolve to the
// exact same mock field for a checkbox's own "on" state to reflect what its
// click actually toggles - deriveMockFieldName's dot-joining would otherwise
// never agree with toggle-generic's hyphen-joined "-active" field for a
// multi-word subject, so this is the first rule needing CONDITION_FIELD_ALIASES
// for anything other than transport state.
test("the loop-enabled alias agrees with toggle-generic's own derived field", () => {
    const toggle = interpretAction(actionNameAsProse("toggleLoopEnabled"));
    assert.equal(toggle.binding.command, "loop-enabled.toggle");
    assert.deepEqual(toggle.binding.mockValues, [false, true]);

    const rule = interpretRule(null, "highlighted when loop enabled is active");
    assert.equal(rule.supported, true);
    assert.equal(rule.binding.mockField, "loop-enabled.active");
    assert.equal(rule.binding.activeValue, true);
});

// Spec 045: the loop creator's own "Create Loop"/"Apply"/"Cancel" buttons
// need verb-action's first two new verbs since spec 042, and its own
// "Snap to zero" toggle needs the same alias seam "loop enabled" already did.
test("verb-action's spec-045 additions (open/cancel) resolve as fire-and-forget commands", () => {
    const cases = [
        ["openLoopCreator", "loop-creator.open"],
        ["cancelLoopCreator", "loop-creator.cancel"]
    ];
    for (const [name, command] of cases) {
        const result = interpretAction(actionNameAsProse(name));
        assert.equal(result.supported, true, name);
        assert.equal(result.binding.command, command, name);
        assert.equal(result.binding.mockField, null, name);
        assert.deepEqual(result.binding.mockValues, []);
    }
});

test("the snap-to-zero alias agrees with toggle-generic's own derived field", () => {
    const toggle = interpretAction(actionNameAsProse("toggleSnapToZero"));
    assert.equal(toggle.binding.command, "snap-to-zero.toggle");
    assert.deepEqual(toggle.binding.mockValues, [false, true]);

    const rule = interpretRule(null, "highlighted when snap to zero is active");
    assert.equal(rule.supported, true);
    assert.equal(rule.binding.mockField, "snap-to-zero.active");
    assert.equal(rule.binding.activeValue, true);
});

// Spec 046: the resample panel's own "Interpolate" toggle needs the same
// alias seam a third time - no new verb-action verbs are needed (open/save/
// cancel already exist from spec 045; set-value/toggle-generic are older still).
test("the resample-interpolate alias agrees with toggle-generic's own derived field", () => {
    const toggle = interpretAction(actionNameAsProse("toggleResampleInterpolate"));
    assert.equal(toggle.binding.command, "resample-interpolate.toggle");
    assert.deepEqual(toggle.binding.mockValues, [false, true]);

    const rule = interpretRule(null, "highlighted when resample interpolate is active");
    assert.equal(rule.supported, true);
    assert.equal(rule.binding.mockField, "resample-interpolate.active");
    assert.equal(rule.binding.activeValue, true);
});

test("the resample panel's own open/save/cancel/set actions resolve using existing verbs, with no new vocabulary", () => {
    assert.equal(interpretAction(actionNameAsProse("openResample")).binding.command, "resample.open");
    assert.equal(interpretAction(actionNameAsProse("saveResample")).binding.command, "resample.save");
    assert.equal(interpretAction(actionNameAsProse("cancelResample")).binding.command, "resample.cancel");
    const setIndex = interpretAction(actionNameAsProse("setResampleTargetIndex"));
    assert.equal(setIndex.binding.command, "resample-target-index.set");
    assert.equal(setIndex.binding.mockField, "resample-target-index.value");
});

// Spec 048: "show" is a new verb-action verb, resolving the View menu's own
// "showMain" for the first time (it never resolved at all before this spec -
// confirmed by running interpretAction directly, not assumed from its
// already-unresolved siblings). As a side effect, the same menu's own
// showOptions/showFileOperations/showSampleEditor now also resolve - none
// mapped in capabilities.js, so each becomes a mocked-command loose end
// instead of an unresolved-action-reference one; recorded here as the real
// side effect it is, not silently left unverified.
test("verb-action's spec-048 addition (show) resolves showMain and its already-authored siblings", () => {
    assert.equal(interpretAction(actionNameAsProse("showMain")).binding.command, "main.show");
    assert.equal(interpretAction(actionNameAsProse("showOptions")).binding.command, "options.show");
    assert.equal(interpretAction(actionNameAsProse("showFileOperations")).binding.command, "file-operations.show");
    assert.equal(interpretAction(actionNameAsProse("showSampleEditor")).binding.command, "sample-editor.show");
});

test("openNibbles resolves via the existing \"open\" verb, with no new vocabulary", () => {
    assert.equal(interpretAction(actionNameAsProse("openNibbles")).binding.command, "nibbles.open");
});

// Spec 049: the Nibbles screen's own single, state-dependent primary button
// needs a genuinely new verb-action verb, "start" (confirmed unsupported
// before this spec, the same discipline every prior verb addition used).
test("verb-action's spec-049 addition (start) resolves startNibbles", () => {
    const result = interpretAction(actionNameAsProse("startNibbles"));
    assert.equal(result.supported, true);
    assert.equal(result.binding.command, "nibbles.start");
    assert.equal(result.binding.mockField, null);
});

test("the wrap/grid aliases agree with toggle-generic's own derived fields", () => {
    assert.equal(interpretAction(actionNameAsProse("toggleWrap")).binding.command, "wrap.toggle");
    assert.equal(interpretAction(actionNameAsProse("toggleGrid")).binding.command, "grid.toggle");

    const wrapRule = interpretRule(null, "highlighted when wrap is active");
    assert.equal(wrapRule.binding.mockField, "wrap.active");
    const gridRule = interpretRule(null, "highlighted when grid is active");
    assert.equal(gridRule.binding.mockField, "grid.active");
});

test("setDifficulty and toggleHighScoreView resolve using existing verbs, with no new vocabulary", () => {
    const difficulty = interpretAction(actionNameAsProse("setDifficulty"));
    assert.equal(difficulty.binding.command, "difficulty.set");
    assert.equal(difficulty.binding.mockField, "difficulty.value");
    assert.equal(interpretAction(actionNameAsProse("toggleHighScoreView")).binding.command, "high-score-view.toggle");
});

// Spec 050: the first compiler path to disabledWhen (spec 015's own runtime
// mechanism, never authorable from YAML until now) - a new RULE_RECIPES
// entry, mirroring highlighted-when-active exactly except negated.
test("disabled-unless-active produces a negated visual-state binding for disabledWhen", () => {
    const rule = interpretRule(null, "disabled unless ft mode is active");
    assert.equal(rule.supported, true);
    assert.equal(rule.code, "disabled-unless-active");
    assert.equal(rule.binding.kind, "visual-state");
    assert.equal(rule.binding.state, "disabled");
    assert.equal(rule.binding.mockField, "ft-mode.active");
    assert.equal(rule.binding.activeValue, true);
});

test("the ft-mode alias agrees with what domain/playback publishes", () => {
    const rule = interpretRule(null, "disabled unless ft mode is active");
    assert.equal(rule.binding.mockField, "ft-mode.active");
});

test("the FT-only side panel's own eight set actions resolve using the existing set-value recipe, with no new vocabulary", () => {
    const cases = [
        ["setFinetune", "finetune.set", "finetune.value"],
        ["setPanning", "panning.set", "panning.value"],
        ["setFadeout", "fadeout.set", "fadeout.value"],
        ["setRelativeNote", "relative-note.set", "relative-note.value"],
        ["setVibratoSpeed", "vibrato-speed.set", "vibrato-speed.value"],
        ["setVibratoDepth", "vibrato-depth.set", "vibrato-depth.value"],
        ["setVibratoSweep", "vibrato-sweep.set", "vibrato-sweep.value"],
        ["setVibratoWave", "vibrato-wave.set", "vibrato-wave.value"]
    ];
    for (const [name, command, field] of cases) {
        const result = interpretAction(actionNameAsProse(name));
        assert.equal(result.supported, true, name);
        assert.equal(result.binding.command, command, name);
        assert.equal(result.binding.mockField, field, name);
    }
});

// Spec 057: the envelope screen's own +/- point buttons need two genuinely
// new verb-action verbs, "add"/"remove" (confirmed unsupported before this
// spec, the same discipline every prior verb addition used).
test("verb-action's spec-057 addition (add/remove) resolves the envelope screen's own point buttons, for both types", () => {
    const add = interpretAction(actionNameAsProse("addVolumeEnvelopePoint"));
    assert.equal(add.supported, true);
    assert.equal(add.binding.command, "volume-envelope-point.add");
    assert.equal(add.binding.mockField, null);

    const remove = interpretAction(actionNameAsProse("removePanningEnvelopePoint"));
    assert.equal(remove.supported, true);
    assert.equal(remove.binding.command, "panning-envelope-point.remove");
    assert.equal(remove.binding.mockField, null);
});

test("the envelope screen's own fourteen other actions resolve using the existing set-value recipe, with no new vocabulary", () => {
    const cases = [
        ["setVolumeEnvelopeEnabled", "volume-envelope-enabled.set", "volume-envelope-enabled.value"],
        ["setVolumeEnvelopeSustain", "volume-envelope-sustain.set", "volume-envelope-sustain.value"],
        ["setVolumeEnvelopeSustainPoint", "volume-envelope-sustain-point.set", "volume-envelope-sustain-point.value"],
        ["setVolumeEnvelopeLoop", "volume-envelope-loop.set", "volume-envelope-loop.value"],
        ["setVolumeEnvelopeLoopStart", "volume-envelope-loop-start.set", "volume-envelope-loop-start.value"],
        ["setVolumeEnvelopeLoopEnd", "volume-envelope-loop-end.set", "volume-envelope-loop-end.value"],
        ["setPanningEnvelopeEnabled", "panning-envelope-enabled.set", "panning-envelope-enabled.value"],
        ["setPanningEnvelopeSustain", "panning-envelope-sustain.set", "panning-envelope-sustain.value"],
        ["setPanningEnvelopeSustainPoint", "panning-envelope-sustain-point.set", "panning-envelope-sustain-point.value"],
        ["setPanningEnvelopeLoop", "panning-envelope-loop.set", "panning-envelope-loop.value"],
        ["setPanningEnvelopeLoopStart", "panning-envelope-loop-start.set", "panning-envelope-loop-start.value"],
        ["setPanningEnvelopeLoopEnd", "panning-envelope-loop-end.set", "panning-envelope-loop-end.value"]
    ];
    for (const [name, command, field] of cases) {
        const result = interpretAction(actionNameAsProse(name));
        assert.equal(result.supported, true, name);
        assert.equal(result.binding.command, command, name);
        assert.equal(result.binding.mockField, field, name);
    }
});

test("the six envelope highlight aliases agree with domain/sampleEditor's own published fields, for both types", () => {
    const cases = [
        ["volume envelope enabled", "volume-envelope-enabled.active"],
        ["volume envelope sustain", "volume-envelope-sustain.active"],
        ["volume envelope loop", "volume-envelope-loop.active"],
        ["panning envelope enabled", "panning-envelope-enabled.active"],
        ["panning envelope sustain", "panning-envelope-sustain.active"],
        ["panning envelope loop", "panning-envelope-loop.active"]
    ];
    for (const [subject, field] of cases) {
        const rule = interpretRule(null, `highlighted when ${subject} is active`);
        assert.equal(rule.supported, true, subject);
        assert.equal(rule.binding.mockField, field, subject);
        assert.equal(rule.binding.activeValue, true, subject);
    }
});

// Spec 063: the File menu's "Open Random MOD/XM Song" - the first action
// names in this port with no leading verb at all, needing a new verb-action
// verb, "random" (confirmed unsupported before this spec).
test("verb-action's spec-063 addition (random) resolves randomSong/randomSongXM", () => {
    const song = interpretAction(actionNameAsProse("randomSong"));
    assert.equal(song.supported, true);
    assert.equal(song.binding.command, "song.random");
    assert.equal(song.binding.mockField, null);

    const songXM = interpretAction(actionNameAsProse("randomSongXM"));
    assert.equal(songXM.supported, true);
    assert.equal(songXM.binding.command, "song-xm.random");
});

test("randomPlayList also resolves as a side effect of the same verb addition, left unmapped on purpose", () => {
    const result = interpretAction(actionNameAsProse("randomPlayList"));
    assert.equal(result.supported, true);
    assert.equal(result.binding.command, "play-list.random");
});

// Spec 067: the save/export screen's own Sample/Playlist export buttons need
// a new verb-action verb, "export" (confirmed unsupported before this spec -
// not in the pattern's own verb list until now).
test("verb-action's spec-067 addition (export) resolves exportSample", () => {
    const result = interpretAction(actionNameAsProse("exportSample"));
    assert.equal(result.supported, true);
    assert.equal(result.binding.command, "sample.export");
    assert.equal(result.binding.mockField, null);
});

test("exportPlayList resolves to play-list.export, the same noun spec 063's randomPlayList already established", () => {
    const result = interpretAction(actionNameAsProse("exportPlayList"));
    assert.equal(result.supported, true);
    assert.equal(result.binding.command, "play-list.export");
});

// Spec 072: the pattern sidebar's transport row needs a new verb-action
// verb, "play" (confirmed unsupported before this spec - "play previous
// track"/"play next track" matched none of the three recipes).
test("verb-action's spec-072 addition (play) resolves playPreviousTrack/playNextTrack", () => {
    const prev = interpretAction(actionNameAsProse("playPreviousTrack"));
    assert.equal(prev.supported, true);
    assert.equal(prev.binding.command, "previous-track.play");
    assert.equal(prev.binding.mockField, null);

    const next = interpretAction(actionNameAsProse("playNextTrack"));
    assert.equal(next.supported, true);
    assert.equal(next.binding.command, "next-track.play");
});

test("toggleShuffle resolves via toggle-generic as-is, no new verb needed", () => {
    const result = interpretAction(actionNameAsProse("toggleShuffle"));
    assert.equal(result.supported, true);
    assert.equal(result.binding.command, "shuffle.toggle");
    assert.deepEqual(result.binding.mockValues, [false, true]);
});

// Spec 072: the Shuffle button's own highlight rule needs the same
// bare-single-word CONDITION_FIELD_ALIASES seam wrap/grid already needed
// (spec 049) - deriveMockFieldName("shuffle") produces the bare field
// "shuffle", but toggleShuffle's own binding above writes "shuffle.active".
test("the shuffle alias agrees with what toggleShuffle actually writes", () => {
    const rule = interpretRule(null, "highlighted when shuffle is active");
    assert.equal(rule.supported, true);
    assert.equal(rule.binding.mockField, "shuffle.active");
    assert.equal(rule.binding.activeValue, true);
});
