# Product steering

Current authoring direction (spec 005, 2026-09-10): develop canonical YAML beside its canvas preview, inspect components to edit their defining source, and save through a local Node service. Names/generated IDs, comma-separated labels and natural-language rules are supported authoring conventions; generation supplies outline bindings and warnings. Development-time generation is allowed, while generated app startup stays static. The existing canvas example is implemented; this interactive workflow is not yet implemented.

Appearance is authored too (spec 008, 2026-09-10): a skin document says which source PNG draws which visual state of which component type, a component links to a style variant by name, development loads the individual PNGs and the release packs them into one atlas, and the workbench edits that description beside the running preview.

The component catalogue is declared once (spec 009, 2026-09-10): a registry describes every component type, its property contract and how it is drawn, so adding a type is one declaration rather than six edits, a planned type can be recorded with its contract before it is implemented, and a mistyped property is reported as one.

It plays (spec 012, 2026-09-10): the adapted v1 sequencer sits behind one capability boundary, so the generated application loads and plays real MOD and XM modules while the authoring preview keeps its mock.

The route from here to the actual tracker is planned rather than assumed (spec 010, 2026-09-10): playback first because it is the largest risk and the most independent, then layout and interaction and the component catalogue, then the document model and the pattern grid, then delivery. Its definition of "ported" is musical, editing, file and delivery parity, with every screen authored rather than positioned.

BassoonTracker v2 is a research project exploring whether a complete application can be described through versioned specifications and rules, translated into a structured model, and realized through reusable behavior modules and interchangeable UI renderers.

Its first application is a browser music tracker for musicians familiar with Amiga/ProTracker/FastTracker workflows. Its authoring workbench serves the developer/researcher building and changing that application.

The value being tested is the ability to change app structure and presentation without manually laying out every screen or rewriting domain behavior. Canvas rendering, tracker performance and musical compatibility are essential, not optional demonstrations.

Core direction: a live specification workbench; automatic layout; canvas and DOM renderers; demand-loaded capabilities; reuse of existing playback where compatibility can be preserved; traceability from each change to the cumulative specification and observed results.

Constraints: plain JavaScript, direct execution from static HTTP source, no mandatory build, no edits outside v2, explicit version history, and separation of audio timing from UI updates. Optional packaging may improve delivery later.

Current status: design and process documents only. Existing BassoonTracker functionality is a reference and reuse candidate; it is not already implemented or fully specified in v2. Detailed tracker feature parity will require an inventory and later numbered specs.

The workbench also develops component contracts and variants through isolated previews. An optional Node authoring server saves specs directly; the generated application remains static.
