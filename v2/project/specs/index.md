# Specs index

## Steering and cumulative specification

- [Product](product.md): purpose, users and constraints.
- [Canonical YAML application](application/current/app.yaml): single authoring source, with referenced rules, actions, components and the skin.
- [Structured outline](application/app-outline.json): the development-time representation of the canonical YAML (schema version 3), written by `node v2/compiler/generate.js` or the workbench service; the release artifacts are the generated app in `v2/app/` and the bundle in `v2/dist/` (spec 007). Spec 003's earlier schema-version-1 example was retired by spec [011](011-retire-spec003-pipeline/requirements.md).
- [Port roadmap](010-port-roadmap/requirements.md): the ordered plan for moving the v1 application onto v2, and the definition of "ported".
- [Workflow](../documentation/specification-workflow.md): lifecycle, versioning and generation boundaries.
- [Progress](../progress.md): chronological work and evidence.

## Feature and research specs

| # | Slug | Kind | Specification status | Delivery status | Application revision |
|---|------|------|----------------------|-----------------|----------------------|
| 001 | [specification-lifecycle](001-specification-lifecycle/requirements.md) | Process/research | Requirements, design and tasks documented | Documentation delivered; runtime automation not implemented | 0.1.0 |
| 002 | [component-authoring](002-component-authoring/requirements.md) | Feature/research | Requirements, design and tasks documented | State gallery and Interaction log delivered via spec 005 Phase 4 (canvas only); schema/DOM/property editing not started | 0.2.0 |
| 003 | [live-workbench](003-live-workbench/requirements.md) | Feature/research | Requirements, design and tasks documented | Delivered, then **retired 2026-09-10 by spec [011](011-retire-spec003-pipeline/requirements.md)**: its runtime was superseded by spec 005's and removed. Its command-enablement and semantic-DOM ideas are carried in spec 010 | 0.3.0 |

| 004 | [yaml-source](004-yaml-source/requirements.md) | Architecture/research | Specified | Process updated; compiler pending | Git history |

| 005 | [interactive-workbench](005-interactive-workbench/requirements.md) | Feature/research | Requirements, design and tasks documented | All five phases implemented and verified 2026-09-10 (compiler, generic canvas preview, source inspection, Node save/convert service, Interact-mode tracing with Interaction log and State gallery, acceptance pass); known limits documented | Git history |

| 006 | [codemirror-editor](006-codemirror-editor/requirements.md) | Feature | Requirements, design and tasks documented | Implemented and verified 2026-09-10: vendored CodeMirror 6 with YAML highlighting, folding and compiler-backed lint replaces the workbench textarea | Git history |

| 007 | [release-build](007-release-build/requirements.md) | Feature | Requirements, design and tasks documented | Implemented and verified 2026-09-10: `node v2/build.mjs` emits the readable generated app (`v2/app/`) and the minified code-split bundle (`v2/dist/`); loose ends listed, never fatal | Git history |

| 008 | [skin-assets](008-skin-assets/requirements.md) | Feature | Requirements, design and tasks documented | Implemented and verified 2026-09-10: one source PNG per skin asset, authored component styles per visual state, loose PNGs in development and a packed atlas in the release, workbench Skin tab with per-state artwork pickers and the variant library | Git history |

| 009 | [component-registry](009-component-registry/requirements.md) | Feature | Requirements, design and tasks documented | Implemented and verified 2026-09-10: one declaration per component type read by the compiler, layout, renderer, emitter and workbench; property validation; declared-but-unimplemented types; Components tab; `checkbox` added through the registry alone | Git history |

| 010 | [port-roadmap](010-port-roadmap/requirements.md) | Architecture/research | Requirements, design and progress documented 2026-09-10 | In progress: the ordered plan from the current v2 to a v2 that runs the tracker, as twelve work packages plus a parity harness. P1 (spec 009), P2 (spec 012) and P3 (spec 013) are done and P4's pointer half is done (spec 014); P4's keyboard half is next, as spec 015. Six open decisions are still unanswered. Supersedes IMPLEMENTATION-PLAN.md steps 5-9 | Git history |

| 011 | [retire-spec003-pipeline](011-retire-spec003-pipeline/requirements.md) | Cleanup | Requirements, design and tasks documented | Implemented and verified 2026-09-10: spec 003's runtime, renderer, document and entry points removed (11 source files, 4 test files); the outline is byte-identical and the live pipeline unchanged; command enablement and the semantic DOM layer are carried forward in spec 010 | Git history |

| 012 | [playback-capability](012-playback-capability/requirements.md) | Feature | Requirements, design and tasks documented | Implemented and verified 2026-09-10: the adapted v1 sequencer behind `domain/playback/`, wired through `capabilities.js`, so the generated application plays real MOD and XM modules; a v2 lookahead clock replaces the vendored WAAClock; the engine is importable and unit-tested in Node for the first time | Git history |

| 013 | [layout-foundations](013-layout-foundations/requirements.md) | Feature | Requirements, design and tasks documented | Implemented and verified 2026-09-10: a clip per node honoured by drawing and hit-testing, a `viewport` type that clips and scrolls its content by a bound field, an overlay layer with one modal slot, and authored `layout.direction`. Interactive scrolling arrived with spec 014, which also amends one of this spec's claims | Git history |

| 014 | [pointer-interaction](014-pointer-interaction/requirements.md) | Feature | Requirements, design and tasks documented | Implemented and verified 2026-09-10: pointer capture and drag, wheel routing, a viewport scrolled by wheel, drag and thumb, double and secondary click, a behavior declared per component type, the `slider` type, `spinBox` promoted to working, declared cursors, and file drag-and-drop that loads a module. The pointer half of roadmap package P4; spec 015 is the keyboard half | Git history |

Next available number: 015. Git replaces copied revisions and manual application-spec version numbers. Earlier revision labels above are historical references.
