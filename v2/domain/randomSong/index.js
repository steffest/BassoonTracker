// The File menu's "Open Random MOD Song"/"Open Random XM Song" capability
// (spec 063), continuing package P9 of the port roadmap. Ported from
// script/src/ui/diskOperations.js#playRandomSong (634-654), which hits this
// repo's own api/ server (kept as-is, the roadmap's own resolved open
// decision 4) and loads whatever module it returns.
//
// Not folded into domain/diskOperations/ (that module is scoped to the
// disk-operations screen specifically - see its own header comment) or
// domain/providers/ (deliberately kept to pure catalog-browsing functions
// with no loadModule side effect - see that folder's own README). This is
// its own small capability for the same reason domain/moduleExport/ is its
// own folder rather than a growth of something else: a distinct File-menu
// entry point, not a variant of an existing screen's own behavior.
//
// The random-song fetch itself lives in domain/providers/bassoon.js, not
// here - only domain/providers/ may name a remote-catalog host directly
// (tests/domainBoundary.test.js's own boundary check, the same rule
// domain/diskOperations/ already follows for ModArchive/modules.pl).

import { loadModule } from "../playback/index.js";
import { fetchRandomModuleUrl } from "../providers/index.js";

/** @param {object} [app] the generated application context */
export async function openRandomSong(app) {
    const url = await fetchRandomModuleUrl();
    if (!url) return false;
    try {
        await loadModule(app, url);
        return true;
    } catch {
        return false;
    }
}

/** The XM-catalog variant - script/src/ui/app/menu.js's own "Open Random XM Song". */
export async function openRandomSongXM(app) {
    const url = await fetchRandomModuleUrl("xm");
    if (!url) return false;
    try {
        await loadModule(app, url);
        return true;
    } catch {
        return false;
    }
}
