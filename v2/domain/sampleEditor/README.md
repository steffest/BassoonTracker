# Sample editor capability

The sample editor's own first slice: selection and the four core DSP operations. Spec [040](../../project/specs/040-sample-processing/requirements.md), continuing package **P10** (features and the plugin path) of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md), following spec 039 (the feature registry) - P10's first named tenant, started.

```
processing.js   pure DSP transforms - normalize, fades, boost/attenuate, trim
                bounds, reverse, invert. No Tracker, no domain/song.
index.js        the capability: selection, the four operations, undo registration
```

## The boundary

Only `index.js` may be imported from outside this folder. It never imports `domain/playback/engine/` directly - it reaches the current instrument and registers undo entries only through `domain/song/index.js`'s own public surface (`getCurrentInstrument`, `getCurrentInstrumentIndex`, `registerSampleEdit`, `EDITACTION`), an ordinary inter-domain-module dependency, not a documented exception to anything.

## Provenance

Ported from `script/plugins/sampleeditor/sampleProcessing.js` - four operations (`adjustVolume`, `trim`, `reverse`, `invert`), the single most directly portable file in the whole ~4,300-line plugin (confirmed by a dedicated research pass reading the entire plugin in full before scoping this spec). `context.splitRange()`/`joinRange()` (`waveform.js`'s own, in v1) become this module's own `splitRange`/`joinRange`, operating on `instrument.sample.data` directly - the exact array shape `domain/playback/engine/models/sample.js` already exposes.

## Undo: one shared stack, not v1's two

v1 keeps sample-edit undo (`StateManager.createSampleUndo`/`.registerEdit`, driven back in through `EVENT.commandProcessSample`) entirely separate from pattern-edit undo, and its own replay only runs while the sample editor's own view happens to be visible - a real limitation, not a design worth reproducing. `domain/song/editHistory.js` had an `EDITACTION.SAMPLE` constant and an explicit `// P10's own territory` comment planted two specs before P10 was ever allocated (spec 028) for exactly this moment: this spec wires it in, so a sample edit and a pattern edit share the exact same `Ctrl+Z` stack, unconditionally - a deliberate improvement, not a port of v1's own split.

## What this deliberately does not do

- **The waveform view** (`waveform.js`'s own drawing, zoom/scroll, per-pixel marker hit-testing, playback preview) - a real, third specialized-component candidate after `patternGrid`/`fileBrowser`; a later spec.
- **The rest of the sample-editor screen** (`sampleView.js`'s own menu, sliders, spinboxes, instrument-name field, envelope panels, transport buttons, draw-mode freehand editing) - ordinary, already-implemented v2 component-tree territory once authored; a later spec.
- **`loopCreator.js`, `resamplePanel.js`, `hissReductionPanel.js`** - each a separate, real feature (848, 116 and 443 lines respectively); each its own later spec.
- **`resample`/`resampleToRate`** - `waveform.js`'s own, not `sampleProcessing.js`'s; belongs with whichever spec ports the resample panel.
- **8-bit/16-bit conversion** - `sampleView.js`'s own `changeSampleBit`, notably *not* undoable in v1 either (a real inconsistency, recorded, not fixed here).
- **Where the eventual screen mounts** - intersects with `top-view.value`'s existing screen-switching (`sampleEditPanel.yaml`'s own placeholder since spec 026); a later spec's decision.
