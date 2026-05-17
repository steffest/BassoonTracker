import Panel from "../../components/panel.js";
import Scale9Panel from "../../components/scale9.js";
import FxPanel from "../../fxpanel.js";
import Layout from "../layout.js";
import EventBus from "../../../eventBus.js";
import {cachedAssets, EVENT, NOTEOFF, SELECTION, SETTINGS} from "../../../enum.js";
import Note from "../../../models/note.js";
import Tracker, {FTNotes, FTPeriods, periodNoteTable} from "../../../tracker.js";
import Y from "../../yascal/yascal.js";
import Editor from "../../../editor.js";
import Input from "../../input.js";
import StateManager from "../../stateManager.js";
import UI from "../../ui.js";

export default class PatternView extends Panel {
    _visibleLines = 0;
    _visibleTracks = 8;
    _lineHeight = 13;
    _centerLineTop = 0;
    _scrollBarItemOffset = 0;
    _startTrack = 0;
    _max;
    _font;
    _displayVolume;
    _hasVU;
    _noteCache = {};
    _noteParamCache = {};
    _lineNumberCache = {};

    _range = {};
    _rangeNormalized = {};
    _rangeCopy = [];
    _hasRange = false;

    _trackLeft;
    _margin;

    _scrollBar;
    _scrollBarHor;
    _fxPanels = [];
    _trackVULevel = [];
    _trackVUHistory = [];
    _trackVULevelDecay = 5;
    _trackVULevelMax = 70;

    constructor(x, y, w, h) {
        super(x || 0, y || 0, w || 20, h || 20);

        this._scrollBar = new Scale9Panel(w - 28, 18, 16, h - 3, {
            img: Y.getImage("bar"),
            left: 2, top: 2, right: 3, bottom: 3
        });
        this._scrollBar.onDragStart = () => {
            if (Tracker.isPlaying()) return;
            this._scrollBar.startDragIndex = Tracker.getCurrentPatternPos();
        };
        this._scrollBar.onDrag = touchData => {
            if (Tracker.isPlaying()) return;
            if (this._visibleLines && this._scrollBarItemOffset) {
                const delta = touchData.deltaY;
                let pos = Math.floor(this._scrollBar.startDragIndex + delta / this._scrollBarItemOffset);
                pos = Math.min(pos, this._max - 1);
                pos = Math.max(pos, 0);
                Tracker.setCurrentPatternPos(pos);
            }
        };
        this.addChild(this._scrollBar);
        this._setScrollBarPosition();

        this._scrollBarHor = new Scale9Panel(w - 28, 18, 16, 16, {
            img: Y.getImage("bar"),
            left: 2, top: 2, right: 3, bottom: 3
        });
        this._scrollBarHor.onDragStart = () => {
            this._scrollBarHor.startDragIndex = this._startTrack;
        };
        this._scrollBarHor.onDrag = touchData => {
            const maxSteps = Tracker.getTrackCount() - this._visibleTracks;
            const delta = touchData.deltaX;
            const rest = this.width - this._scrollBarHor.width;
            const step = Math.floor(delta / (rest / maxSteps));
            this.setHorizontalScroll(this._scrollBarHor.startDragIndex + step);
            this.onResize();
        };
        this.addChild(this._scrollBarHor);

        for (let i = 0, len = Tracker.getTrackCount(); i < len; i++) {
            const fxPanel = FxPanel(i);
            this._fxPanels.push(fxPanel);
            this.addChild(fxPanel);
        }

        this.on(EVENT.patternPosChange, positions => {
                if (Input.isMetaKeyDown() && !Tracker.isPlaying()) {
                    this._initRange(positions);
                }
            });
        this.on(EVENT.cursorPositionChange, () => {
                if (Input.isMetaKeyDown() && !Tracker.isPlaying()) {
                    this._initRange({current: Tracker.getCurrentPatternPos(), prev: Tracker.getCurrentPatternPos()});
                }
            });
        this.on(EVENT.trackCountChange, trackCount => {
                if (this._visibleTracks < trackCount) this._visibleTracks = trackCount;
                this._startTrack = Math.min(this._startTrack, trackCount - this._visibleTracks);
                this._startTrack = Math.max(this._startTrack, 0);
                for (let i = this._fxPanels.length, len = trackCount; i < len; i++) {
                    const fxPanel = FxPanel(i);
                    this._fxPanels.push(fxPanel);
                    this.addChild(fxPanel);
                }
                this.onResize();
                this.refresh();
            });
        this.on(EVENT.songLoaded, () => { this.setHorizontalScroll(0); });
        this.on(EVENT.visibleTracksCountChange, () => {
                this._startTrack = 0;
                this.onResize();
                this.refresh();
            });
        this.on(EVENT.trackerModeChanged, () => { this.refresh(); });
        this.on(EVENT.fxPanelToggle, track => {
                const fxPanel = this._fxPanels[track];
                if (fxPanel.visible) {
                    fxPanel.hide();
                } else {
                    let visibleHeight = this.height;
                    const hasHorizontalScrollBar = this._visibleTracks < Tracker.getTrackCount();
                    if (hasHorizontalScrollBar) visibleHeight -= 24;
                    fxPanel.setPosition(fxPanel.left, 0);
                    fxPanel.setSize(Layout.trackWidth, visibleHeight);
                    fxPanel.setLayout();
                    fxPanel.show();
                }
                this.refresh();
            });
        this.on(EVENT.skipFrameChanged, value => {
                this._trackVULevelDecay = 5 * (value + 1);
            });
        this.on(EVENT.commandSelectAll, () => {
                if (this.isVisible()) {
                    UI.clearSelection();
                    this._range.start = [0, Editor.getCurrentTrack()];
                    this._range.end   = [Tracker.getCurrentPatternData().length - 1, Editor.getCurrentTrack()];
                    this._normalizeRange();
                    this._hasRange = true;
                    this._range.top = this._range.left = 100000;
                    this.showSelectionUI();
                    this.refresh();
                }
            });
    }

    setHorizontalScroll(newStartTrack) {
        const maxSteps = Tracker.getTrackCount() - this._visibleTracks;
        if (newStartTrack !== this._startTrack && newStartTrack >= 0 && newStartTrack <= maxSteps) {
            this._startTrack = newStartTrack;
            EventBus.trigger(EVENT.patternHorizontalScrollChange, this._startTrack);
            this._setScrollBarHorPosition();
        }
    }

    onResize() {
        this._trackLeft   = Layout.firstTrackOffsetLeft;
        this._margin      = Layout.trackMargin;
        this._visibleTracks = Layout.visibleTracks;

        let visibleHeight = this.height;
        const hasHorizontalScrollBar = this._visibleTracks < Tracker.getTrackCount();
        if (hasHorizontalScrollBar) visibleHeight -= 24;
        cachedAssets.darkPanel = null;

        for (let i = 0; i < this._visibleTracks; i++) {
            const trackIndex = this._startTrack + i;
            const fxPanel = this._fxPanels[trackIndex];
            if (fxPanel && fxPanel.visible) {
                const trackX = this._trackLeft + i * (Layout.trackWidth + this._margin);
                fxPanel.setPosition(trackX, 0);
                fxPanel.setSize(Layout.trackWidth, visibleHeight);
                fxPanel.setLayout();
                fxPanel.show();
            }
        }
    }

    render(internal) {
        if (!this.isVisible()) return;

        if (this.needsRendering) {
            this.clearCanvas();

            const index      = Tracker.getCurrentPattern() || 0;
            const patternPos = Tracker.getCurrentPatternPos() || 0;
            const song       = Tracker.getSong();
            if (!song) return;

            this._font = Layout.trackFont;
            this._max  = Tracker.getPatternLength();

            const hasHorizontalScrollBar = this._visibleTracks < Tracker.getTrackCount();
            let visibleHeight = this.height - 30;

            this._displayVolume = Tracker.inFTMode();
            let textWidth    = this._displayVolume ? 92 : 72;
            let cursorWidth1 = 9;
            let cursorWidth3 = 28;

            if (Layout.useCondensedTrackFont) {
                textWidth    = this._displayVolume ? 46 : 36;
                cursorWidth1 = 5;
                cursorWidth3 = 15;
            }

            let patternNumberLeft      = 10;
            let initialTrackTextOffset = Math.floor((Layout.trackWidth - textWidth) / 2) + patternNumberLeft;
            let lineNumbersToTheLeft   = false;

            if (this._trackLeft) {
                patternNumberLeft      = 0;
                initialTrackTextOffset = 0;
                lineNumbersToTheLeft   = true;
            }

            if (hasHorizontalScrollBar) visibleHeight -= 24;

            this._visibleLines = Math.ceil(visibleHeight / this._lineHeight);
            if (this._visibleLines % 2 === 0) this._visibleLines--;

            const topLines     = Math.floor(this._visibleLines / 2);
            const visibleStart = patternPos - topLines;
            const visibleEnd   = visibleStart + this._visibleLines;

            const centerLineHeight = this._lineHeight + 2;
            this._centerLineTop    = Math.floor((visibleHeight + centerLineHeight) / 2);

            const baseY     = this._centerLineTop - (topLines * this._lineHeight) + 4;
            const panelTop2 = this._centerLineTop + centerLineHeight;

            let darkPanel = cachedAssets.darkPanel;
            if (!darkPanel && Y.getImage("panel_dark")) {
                const p = new Scale9Panel(0, 0, Layout.trackWidth, this._centerLineTop, {
                    img: Y.getImage("panel_dark"), left: 3, top: 3, right: 2, bottom: 2
                });
                cachedAssets.darkPanel = p.render(true);
                darkPanel = cachedAssets.darkPanel;
            }

            const isTrackVisible = [];
            this._hasVU = false;

            this._trackVULevelMax   = 70;
            this._trackVULevelDecay = 5;
            if (this._trackVULevelMax > this._centerLineTop) {
                this._trackVULevelMax   = this._centerLineTop;
                this._trackVULevelDecay = this._trackVULevelMax / 10;
            }

            for (let i = 0; i < this._visibleTracks; i++) {
                const trackIndex = this._startTrack + i;
                isTrackVisible[trackIndex] = !(this._fxPanels[trackIndex] && this._fxPanels[trackIndex].visible);
                if (isTrackVisible[trackIndex] && darkPanel.height && darkPanel.width) {
                    const trackX = this._trackLeft + i * (Layout.trackWidth + this._margin);
                    this.ctx.drawImage(darkPanel, trackX, 0, Layout.trackWidth, this._centerLineTop);
                    this.ctx.drawImage(darkPanel, trackX, panelTop2, Layout.trackWidth, this._centerLineTop);
                    if (this._fxPanels[trackIndex]) this._fxPanels[trackIndex].left = trackX;
                }
            }

            const pattern = song.patterns[index];

            if (pattern) {
                this.ctx.fillStyle = Tracker.isRecording() ? "#A50B0F" : "#202E58";
                this.ctx.fillRect(0, this._centerLineTop, this.width, centerLineHeight);

                const cursorPos = Editor.getCurrentTrackPosition();
                let cursorWidth = cursorWidth1;
                let cursorX;

                if (lineNumbersToTheLeft) {
                    const trackX = this._trackLeft + (Editor.getCurrentTrack() - this._startTrack) * (Layout.trackWidth + this._margin);
                    cursorX = trackX + Math.floor((Layout.trackWidth - textWidth) / 2) + (cursorPos * cursorWidth) - 1;
                } else {
                    cursorX = this._trackLeft + initialTrackTextOffset + ((Editor.getCurrentTrack() - this._startTrack) * Layout.trackWidth) + (cursorPos * cursorWidth) - 1;
                }

                if (cursorPos > 0) {
                    cursorX += cursorWidth * 2 + 1;
                    if (cursorPos > 2) cursorX += 2;
                    if (cursorPos > 4 && this._displayVolume) cursorX += 2;
                } else {
                    cursorWidth = cursorWidth3;
                }

                this.ctx.fillStyle = "rgba(220,220,220,.3)";
                this.ctx.fillRect(cursorX, this._centerLineTop, cursorWidth, this._lineHeight + 2);

                this.ctx.fillStyle = "rgba(200,150,70,.3)";
                const noteWidth = this._font.charWidth * 8 + 14 + (this._displayVolume ? this._font.charWidth * 2 + 2 : 0);

                for (let i = visibleStart; i < visibleEnd; i++) {
                    if (i >= 0 && i < Tracker.getPatternLength()) {
                        const step = pattern[i];
                        const y    = baseY + ((i - visibleStart) * this._lineHeight);

                        let isCenter = true;
                        let drawY = y;
                        if (drawY < this._centerLineTop) {
                            drawY -= 3;
                            isCenter = false;
                        }
                        if (drawY > this._centerLineTop + this._lineHeight) {
                            drawY += 3;
                            isCenter = false;
                        }

                        this._renderLineNumber(i, patternNumberLeft, drawY);
                        if (isCenter) {
                            this._renderLineNumber(i, patternNumberLeft, drawY);
                            this._renderLineNumber(i, patternNumberLeft, drawY);
                        }

                        for (let j = 0; j < this._visibleTracks; j++) {
                            const trackIndex = j + this._startTrack;
                            if (isTrackVisible[trackIndex] && trackIndex < Tracker.getTrackCount()) {
                                const note = step[trackIndex] || Note();
                                let x;
                                if (lineNumbersToTheLeft) {
                                    const trackX = this._trackLeft + j * (Layout.trackWidth + this._margin);
                                    x = trackX + ((Layout.trackWidth - textWidth) >> 1);
                                } else {
                                    x = this._trackLeft + initialTrackTextOffset + (j * Layout.trackWidth);
                                }

                                if (this._hasRange && i >= this._rangeNormalized.start[0] && i <= this._rangeNormalized.end[0] && trackIndex >= this._rangeNormalized.start[1] && trackIndex <= this._rangeNormalized.end[1]) {
                                    this._range.top  = Math.min(this._range.top, drawY - 2);
                                    this._range.left = Math.min(this._range.left, x - 2);
                                    this.ctx.fillRect(x - 2, drawY - 2, noteWidth, this._lineHeight);
                                }

                                if (isCenter) {
                                    this._renderNote(note, x, drawY);
                                    this._renderNote(note, x, drawY);
                                    if (Tracker.isPlaying() || (this._trackVULevel[j] && SETTINGS.vubars !== "none")) {
                                        this._renderVU(note, x - 12, this._centerLineTop, j, index + "." + patternPos);
                                    }
                                }
                                this._renderNote(note, x, drawY);
                                this._renderNoteParam(note, x, drawY);
                            }
                        }

                        if (this._hasVU) {
                            setTimeout(() => { this.refresh(); }, 20);
                        }
                    }
                }
            }

            for (let j = 0; j < this._visibleTracks; j++) {
                const trackIndex = j + this._startTrack;
                if (!isTrackVisible[trackIndex]) {
                    this._fxPanels[trackIndex].render();
                }
            }

            this._setScrollBarPosition();
            this._scrollBar.render();
            if (hasHorizontalScrollBar) {
                this._setScrollBarHorPosition();
                this._scrollBarHor.render();
            }

            for (let j = 0; j < this._visibleTracks; j++) {
                const trackIndex = j + this._startTrack;
                if (isTrackVisible[trackIndex]) {
                    const trackX = this._trackLeft + j * (Layout.trackWidth + this._margin) + 2;
                    this._drawText("" + (trackIndex + 1), trackX, 2);
                }
            }
        }

        this.needsRendering = false;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }

    getStartTrack() { return this._startTrack; }

    processSelection(state) {
        if (!this.isVisible()) return;
        switch (state) {
            case SELECTION.RESET:
                this._hasRange = false;
                UI.hideContextMenu();
                this.refresh();
                return true;
            case SELECTION.CLEAR: {
                const pattern = Tracker.getCurrentPatternData();
                if (pattern && this._hasRange) {
                    const editAction = StateManager.createRangeUndo(Tracker.getCurrentPattern());
                    editAction.name = "Clear Selection";
                    for (let i = this._rangeNormalized.start[0]; i <= this._rangeNormalized.end[0]; i++) {
                        const step = pattern[i];
                        for (let j = this._rangeNormalized.start[1]; j <= this._rangeNormalized.end[1]; j++) {
                            const note = step[j];
                            if (note) { StateManager.addNote(editAction, j, i, note); note.clear(); }
                        }
                    }
                    StateManager.registerEdit(editAction);
                }
                this.refresh();
                break;
            }
            case SELECTION.COPY:
            case SELECTION.CUT: {
                this._rangeCopy = [];
                const pattern = Tracker.getCurrentPatternData();
                if (pattern && this._hasRange) {
                    for (let i = this._rangeNormalized.start[0]; i <= this._rangeNormalized.end[0]; i++) {
                        const step = pattern[i];
                        if (step) {
                            const stepCopy = [];
                            for (let j = this._rangeNormalized.start[1]; j <= this._rangeNormalized.end[1]; j++) {
                                const note = step[j] || new Note();
                                if (note) stepCopy.push(note.duplicate());
                            }
                            this._rangeCopy.push(stepCopy);
                        }
                    }
                }
                if (state === SELECTION.CUT && this._hasRange) {
                    const editAction = StateManager.createRangeUndo(Tracker.getCurrentPattern());
                    editAction.name = "Cut Selection";
                    for (let i = this._rangeNormalized.start[0]; i <= this._rangeNormalized.end[0]; i++) {
                        const step = pattern[i];
                        if (step) {
                            for (let j = this._rangeNormalized.start[1]; j <= this._rangeNormalized.end[1]; j++) {
                                const note = step[j];
                                StateManager.addNote(editAction, j, i, note);
                                if (note) note.clear();
                            }
                        }
                    }
                    StateManager.registerEdit(editAction);
                }
                this.refresh();
                break;
            }
            case SELECTION.PASTE: {
                const pattern = Tracker.getCurrentPatternData();
                if (pattern && this._hasRange && this._rangeCopy.length) {
                    const editAction = StateManager.createRangeUndo(Tracker.getCurrentPattern());
                    editAction.name = "Paste Selection";
                    for (let i = 0; i < this._rangeCopy.length; i++) {
                        const step     = pattern[this._rangeNormalized.start[0] + i];
                        const stepCopy = this._rangeCopy[i];
                        if (step) {
                            for (let j = 0; j < stepCopy.length; j++) {
                                const trackIndex = this._rangeNormalized.start[1] + j;
                                let note = step[trackIndex];
                                if (!note && trackIndex < Tracker.getTrackCount()) {
                                    note = new Note();
                                    step[trackIndex] = note;
                                }
                                if (note) {
                                    StateManager.addNote(editAction, trackIndex, this._rangeNormalized.start[0] + i, note);
                                    note.populate(stepCopy[j]);
                                }
                            }
                        }
                    }
                    StateManager.registerEdit(editAction);
                }
                this.refresh();
                break;
            }
            case SELECTION.POSITION:
                this._range.start = this._range.end = [Tracker.getCurrentPatternPos(), Editor.getCurrentTrack()];
                this._normalizeRange();
                this._hasRange = true;
                this.refresh();
                break;
        }
    }

    showSelectionUI() {
        UI.setSelection(state => this.processSelection(state));
        UI.showContextMenu({
            name: "patternActions",
            focus: false,
            align: "top",
            items: [
                {label: "Clear", onClick: () => { this.processSelection(SELECTION.CLEAR); }},
                {label: "Cut",   onClick: () => { this.processSelection(SELECTION.CUT); }},
                {label: "Copy",  onClick: () => { this.processSelection(SELECTION.COPY); }},
                {label: "Paste", onClick: () => { this.processSelection(SELECTION.PASTE); }}
            ],
            x: this._range.left + this.left + this.parent.left,
            y: this._range.top  + this.top  + this.parent.top
        });
    }

    onMouseWheel(touchData) {
        if (Tracker.isPlaying()) return;
        const pos = Tracker.getCurrentPatternPos();
        if (touchData.mouseWheels[0] > 0) {
            if (pos) Tracker.moveCurrentPatternPos(-1);
        } else {
            if (pos < this._max - 1) Tracker.moveCurrentPatternPos(1);
        }
    }

    onDragStart(touchData) {
        this._scrollBarHor.startDragIndex = this._startTrack;
        if (Tracker.isPlaying()) return;
        this.startDragPos = Tracker.getCurrentPatternPos();

        if (touchData.isMeta || Tracker.isRecording()) {
            const track = Math.floor((touchData.x - Layout.firstTrackOffsetLeft) / (Layout.trackWidth + Layout.trackMargin));
            const stepsPerTrack = Editor.getStepsPerTrack();
            Editor.setCurrentCursorPosition((this._startTrack + track) * stepsPerTrack);

            UI.clearSelection();
            this.startDragTrackX = (track * (Layout.trackWidth + Layout.trackMargin)) + Layout.firstTrackOffsetLeft;
            const offsetY = Math.floor((touchData.y - this._centerLineTop) / this._lineHeight);
            this._range.start = [Tracker.getCurrentPatternPos() + offsetY, Editor.getCurrentTrack()];
            this._range.end   = this._range.start;
            this._range.top   = this._range.left = 100000;
            this.refresh();
        }
    }

    onDrag(touchData) {
        if (this._visibleTracks < Tracker.getTrackCount() && !(touchData.isMeta || Tracker.isRecording())) {
            const maxSteps = Tracker.getTrackCount() - this._visibleTracks;
            const delta    = touchData.deltaX;
            const rest     = this.width - this._scrollBarHor.width;
            const step     = Math.floor(delta / (rest / maxSteps));
            this.setHorizontalScroll(this._scrollBarHor.startDragIndex - step);
        }

        if (Tracker.isPlaying()) return;

        const delta     = Math.round(touchData.deltaY / this._lineHeight);
        let targetPos   = this.startDragPos - delta;
        targetPos = Math.max(targetPos, 0);
        targetPos = Math.min(targetPos, this._max - 1);

        if (touchData.isMeta || Tracker.isRecording()) {
            this._hasRange = true;
            const dy = Math.floor(touchData.deltaY / this._lineHeight);
            const dx = Math.floor(touchData.deltaX / Layout.trackWidth);
            this._range.end = [this._range.start[0] + dy, Editor.getCurrentTrack() + dx];
            this._normalizeRange();
            this.refresh();
        } else {
            Tracker.setCurrentPatternPos(targetPos);
        }
    }

    onTouchUp() {
        if (this._hasRange) this.showSelectionUI();
    }

    onDown(touchData) {
        const track = Math.floor((touchData.x - Layout.firstTrackOffsetLeft) / (Layout.trackWidth + Layout.trackMargin));
        const stepsPerTrack = Editor.getStepsPerTrack();
        Editor.setCurrentCursorPosition((this._startTrack + track) * stepsPerTrack);
    }


    _renderNote(note, x, y) {
        let id;
        if (Tracker.inFTMode()) {
            id = "i" + note.index + "." + this._font.charWidth;
        } else {
            id = "p" + note.period + "." + this._font.charWidth;
        }

        if (!this._noteCache[id]) {
            const canvas = document.createElement("canvas");
            canvas.height = this._lineHeight;
            canvas.width  = this._font.charWidth * 3 + 2;
            const c = canvas.getContext("2d");

            let noteString;
            if (Tracker.inFTMode()) {
                if (note.index) {
                    const ftNote = note.index === 97 ? FTNotes[NOTEOFF] : FTNotes[note.index];
                    noteString = ftNote ? ftNote.name : "???";
                } else {
                    noteString = "---";
                    const baseNote = FTPeriods[note.period];
                    if (baseNote) {
                        const ftNote = FTNotes[baseNote];
                        if (ftNote) noteString = ftNote.name;
                    } else {
                        if (note.period > 0) console.error("no basenote for " + note.period);
                    }
                }
            } else {
                const baseNote = periodNoteTable[note.period];
                noteString = baseNote ? baseNote.name : "---";
            }

            this._font.write(c, noteString, 0, 0, 0);
            this._noteCache[id] = canvas;
        }

        this.ctx.drawImage(this._noteCache[id], x, y);
    }

    _renderNoteParam(note, x, y) {
        x += (this._font.charWidth * 3) + 4;
        const id = "n" + note.instrument + "." + (this._displayVolume ? note.volumeEffect : "") + "." + note.effect + "." + note.param + "." + this._font.charWidth;

        if (!this._noteParamCache[id]) {
            const canvas = document.createElement("canvas");
            canvas.height = this._lineHeight;
            canvas.width  = this._font.charWidth * 7 + 10;
            const c = canvas.getContext("2d");

            let noteString = this._formatHex(note.instrument, 2, "0");
            if (noteString === "00") noteString = "..";
            let nx = 0;
            this._font.write(c, noteString, nx, 0, 0, "green");

            if (this._displayVolume) {
                nx += (this._font.charWidth * 2) + 4;
                let value = note.volumeEffect || 0;
                if (value) value -= 16;

                if (value < 80) {
                    noteString = this._formatHex(value, 2, "0");
                } else {
                    const vuX = (value >> 4).toString(16).toUpperCase();
                    const vuY = (value & 0x0f).toString(16).toUpperCase();
                    const mapping = {"5":"-","6":"+","7":"↓","8":"↑","9":"S","A":"V","B":"P","C":"<","D":">","E":"M"};
                    noteString = (mapping[vuX] || vuX) + vuY;
                }

                if (!note.volumeEffect) noteString = "..";
                this._font.write(c, noteString, nx, 0, 0);
            }

            nx += (this._font.charWidth * 2) + 4;
            noteString = (note.effect > 15 ? this._formatHexExtended(note.effect) : this._formatHex(note.effect)) + this._formatHex(note.param, 2, "0");
            if (noteString === "000") noteString = "...";
            this._font.write(c, noteString, nx, 0, 0, "orange");

            this._noteParamCache[id] = canvas;
        }

        this.ctx.drawImage(this._noteParamCache[id], x, y);
    }

    _renderVU(note, x, y, track, index) {
        if (Tracker.isPlaying() && note && note.period && this._trackVUHistory[track] !== index) {
            let vu = 100;
            if (note.effect === 12) {
                vu = note.param * 100 / 64;
            } else {
                const instrument = Tracker.getInstrument(note.instrument);
                if (instrument) vu = instrument.sample.volume * 100 / 64;
            }
            this._trackVULevel[track]   = vu;
            this._trackVUHistory[track] = index;
        }

        if (this._trackVULevel[track]) {
            this._hasVU = true;
            const vuHeight = this._trackVULevel[track] * this._trackVULevelMax / 100;
            const sHeight  = vuHeight * 100 / this._trackVULevelMax;

            if (SETTINGS.vubars === "colour") {
                const bar = Y.getImage("vubar");
                this.ctx.drawImage(bar, 0, 100 - sHeight, 26, sHeight, x, y - vuHeight, 10, vuHeight);
            } else if (SETTINGS.vubars === "trans") {
                this.ctx.fillStyle = "rgba(120,190,255,0.3)";
                this.ctx.fillRect(x, y - vuHeight, 10, vuHeight);
            }

            this._trackVULevel[track] -= this._trackVULevelDecay;
            if (this._trackVULevel[track] < 0) this._trackVULevel[track] = 0;
        }
    }

    _renderLineNumber(nr, x, y) {
        const ti = (nr < 10 ? "0" : "") + nr;
        const id = ti + "." + this._font.charWidth;

        if (!this._lineNumberCache[id]) {
            const canvas = document.createElement("canvas");
            canvas.height = this._lineHeight;
            canvas.width  = this._font.charWidth * 3;
            const c = canvas.getContext("2d");
            this._font.write(c, ti, 0, 0, 0, (nr % 4 === 0 ? "orange" : false));
            this._lineNumberCache[id] = canvas;
        }

        this.ctx.drawImage(this._lineNumberCache[id], x, y);
    }

    _drawText(t, x, y, color) {
        this._font.write(this.ctx, t, x, y, 0, color);
    }

    _formatHex(i, length, padString) {
        let h = i.toString(16).toUpperCase();
        if (length && h.length < length) {
            padString = padString || "0";
            while (h.length < length) h = padString + h;
        }
        return h;
    }

    _formatHexExtended(i, length, padString) {
        let h = i.toString(36).toUpperCase();
        if (length && h.length < length) {
            padString = padString || "0";
            while (h.length < length) h = padString + h;
        }
        return h;
    }

    _setScrollBarPosition() {
        const patternPos = Tracker.getCurrentPatternPos() || 0;
        if (this._visibleLines) {
            let startTop   = 1;
            let top        = startTop;
            const startHeight = this.height - 2;
            let height     = startHeight;
            this._scrollBarItemOffset = 0;

            if (this._max > 1) {
                height = Math.floor((this._visibleLines / this._max) * startHeight);
                if (height < 12) height = 12;
                this._scrollBarItemOffset = (startHeight - height) / (this._max - 1);
            }

            if (patternPos && this._scrollBarItemOffset) {
                top = Math.floor(startTop + this._scrollBarItemOffset * patternPos);
            }

            this._scrollBar.setDimensions({
                left: this.width - 16, top, width: 16, height
            });
        }
    }

    _setScrollBarHorPosition() {
        const max   = this.width;
        const width = Math.floor((max / Tracker.getTrackCount()) * this._visibleTracks);
        const step  = (max - width) / (Tracker.getTrackCount() - this._visibleTracks);
        const top   = this._visibleTracks >= Tracker.getTrackCount() ? -200 : this.height - 20;

        this._scrollBarHor.setDimensions({
            top, width, left: Math.floor(this._startTrack * step)
        });
    }

    _normalizeRange() {
        this._rangeNormalized = {
            start: [this._range.start[0], this._range.start[1]],
            end:   [this._range.end[0],   this._range.end[1]]
        };
        for (let i = 0; i < 2; i++) {
            if (this._range.start[i] > this._range.end[i]) {
                this._rangeNormalized.start[i] = this._range.end[i];
                this._rangeNormalized.end[i]   = this._range.start[i];
            }
        }
    }

    _initRange(positions) {
        if (!this._hasRange) {
            this._range.start = [positions.prev || 0, Editor.getCurrentTrack()];
            this._range.end   = [positions.current,   Editor.getCurrentTrack()];
            this._range.top   = this._range.left = 100000;
            this._normalizeRange();
            this._hasRange = true;
            this.showSelectionUI();
            this.refresh();
        } else {
            this._range.end = [Tracker.getCurrentPatternPos(), Editor.getCurrentTrack()];
            this._normalizeRange();
            this.refresh();
        }
    }
}
