# 034 — Tasks

Status: implemented and verified 2026-09-13.

- [x] `domain/providers/bassoon.js` (new, pure): `proxyUrl`, `isProxyUrl`.
- [x] `domain/providers/formatFileSize.js` (new, pure): ported from `script/src/lib/util.js`.
- [x] `domain/providers/modArchive.js` (new): `browse(path)`.
- [x] `domain/providers/modulesPl.js` (new): `browse(path)`.
- [x] `domain/providers/hippo.js` (new): `browse(path)`.
- [x] `domain/providers/index.js` (new): `fetchModuleUrl`, re-exports `proxyUrl`/`isProxyUrl`.
- [x] `domain/providers/README.md` (new): boundary, provenance, the "no shared interface" and Dropbox-deferred notes, the hippo.js bug fix.
- [x] `domain/playback/index.js#loadModule`: swapped `fetch(target)` for `fetchModuleUrl(target)`; `domain/playback/README.md` cross-references `domain/providers/`.
- [x] `tests/providers.test.js` (new, 24 cases).
- [x] `tests/playback.test.js` (extended, +1): the proxy-retry integration case.
- [x] `tests/domainBoundary.test.js` (extended, +1): nothing outside `domain/providers/` names the provider hosts directly.
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`/`dist`: unaffected (no YAML/compiler change; loose-ends count unchanged at 76).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, same recorded reason as every spec since 019). A fake global `fetch`, swapped in per test and restored after, stands in for the three provider hosts and for `loadModule`'s own retry path; the retry integration test also uses a real fixture module (`wizballalt.mod`) so `Tracker.processFile` genuinely succeeds, not just "the right URL was requested."

## Evidence

`node --test tests/*.test.js`: 464 tests, all passing, up from 438 (24 new in `tests/providers.test.js` - `formatFileSize`, all three `browse()` functions including memoization/pagination/envelope-unwrap/error-fallback cases, and `proxyUrl`/`isProxyUrl`/`fetchModuleUrl`'s exact retry condition; 1 more in `tests/playback.test.js`; 1 more in `tests/domainBoundary.test.js`).

`node build.mjs app`: succeeds, exit 0. `app/LOOSE-ENDS.md`'s item count unchanged at 76 (no YAML authored, no command newly mapped that the compiler would have listed as mocked - none of `browse()`'s three providers has any command binding yet). `node build.mjs dist`: still fails on the same pre-existing `esbuild` host/binary version mismatch (`0.28.2` vs `0.25.4`) every spec since 019 has recorded; unrelated to this work.

## Found while doing it

- **v1 never built the "one interface" P9's own design sketch assumed.** Confirmed by reading all five provider modules in full before writing requirements.md, not by trusting the sketch - three providers share a real common shape, Dropbox and Bassoon each do not, and forcing symmetry across all five would have meant inventing structure the source code does not have.
- **Getting the retry condition right needed a careful two-path read of `filesystem.js#loadFile`**, not an assumption from its general shape: v1's `onerror` (network-level - CORS, DNS, mixed content) is the only path that retries through the proxy; its `onload`-with-bad-status path (a real HTTP response, just not 200) explicitly does not. `fetch()` splits these the same way (a rejected promise vs. a resolved one with `ok: false`), which is what let the port land as a `try/catch` around the fetch alone, not around the existing `if (!response.ok)` check.
- **`hippo.js`'s own `loadPlaylists` would throw on a network failure in v1** - no `if (result)` guard before `.forEach`, unlike `modarchive.js`/`modulespl.js`'s equivalents, which do guard. A real, latent defect, not a preserved quirk (see README.md) - fixed with one added `(result || [])`.
- **Testing `loadModule`'s own retry needed a small, real workaround, not a design change**: `ensureEngine()` requires a global `AudioContext` constructor to *exist* even when `app.audioContext` is supplied and actually used instead - a pre-existing quirk of code this spec did not otherwise touch. The test stubs a placeholder `globalThis.AudioContext` class that is never instantiated, rather than changing `ensureEngine`'s own guard order, which is out of this spec's scope.
- **Everything else matched design.md going in**: the three `browse()` functions needed no surprises beyond what reading v1's source in full already surfaced; `fetchModuleUrl`'s composition of `proxyUrl`/`isProxyUrl` needed no coordination beyond the one call-site change in `loadModule`.

## Known limits

Dropbox, Bassoon's render/export pipeline, the disk-operation screens, the static root-listing snapshot files, and `random.*`/`generatePlayList` command wiring are all deliberately out of scope - see requirements.md's Scope boundaries. Nothing in this spec is reachable from the UI yet (no disk-operation screen exists to call `browse()`); verified headless only, matching specs 028/033's own precedent of a capability landing before its UI. No browser verification occurred in this environment - the same recorded gap every spec since 019 has left.
