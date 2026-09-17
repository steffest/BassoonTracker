# Generating a native C application from the v2 specification

Status: conceptual idea, not an implementation commitment.

The v2 architecture could support a fully native C application. However, v2 currently generates the application's structure and wiring, not 100% of its implementation.

## What is generated today

- YAML describes screens, components, layout, skin, rules and actions.
- The compiler generates component trees, state bindings and action wiring.
- Existing JavaScript implements the renderer, layout engine, interaction behavior and domain capabilities such as playback and editing.

For example, a generated Play button delegates to the playback capability. The ruleset does not itself contain everything needed to implement a tracker audio engine. The compiler recognizes supported rule recipes; it does not translate arbitrary prose into complete implementations.

## A possible native target

```text
                 Shared application specification
                               |
                      Compiled application model
                               |
                +--------------+--------------+
                |                             |
          JavaScript generator           C generator
                |                             |
          Browser runtime                Native runtime
          Canvas renderer                Native renderer
          WebAudio playback              Native audio engine
```

Screens, skin assets, component relationships and supported declarative rules could be shared. A native target would need a C generator and native implementations of the runtime and capabilities.

The existing compiler could still run in JavaScript during development. The resulting executable would not need JavaScript or a browser: it could contain generated C structures and bindings linked with a native runtime.

## What needs a native implementation

- Rendering sprites, bitmap fonts, clipping and visual states.
- Layout, state updates and component interaction behavior.
- Window creation, input events, file access and other host services.
- Domain capabilities, including playback, editing, file formats and sample processing.

Our custom pixel UI helps: a native renderer can draw the same sprites and bitmap fonts and preserve the tracker's appearance. A native executable does not require replacing those controls with operating-system widgets.

Playback would be a larger undertaking because the current engine relies on WebAudio's scheduling and audio processing. Preserving tracker effects, timing and compatibility would require explicit implementation and verification, not just emitting C syntax.

## What this would enable

Once the native foundation exists, changing an authored screen or binding could produce both browser and native versions from the same specification. Adding a new audio capability would still require implementation for both targets, unless its implementation is also shared through a suitable portable layer.

The ruleset gives us a strong basis for multiple platforms, but there is no existing "generate C" switch. The architectural direction is to keep application meaning in the specification and put platform details behind explicit runtime and capability contracts.

## Existing architecture references

- [Release generation and capability boundaries](../../project/specs/007-release-build/design.md)
- [YAML compiler](../../project/documentation/compiler.md)
- [Playback capability](../../project/specs/012-playback-capability/design.md)
