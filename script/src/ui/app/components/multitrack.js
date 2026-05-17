import Panel from "../../components/panel.js";
import Scale9Panel from "../../components/scale9.js";
import EventBus from "../../../eventBus.js";
import {EVENT, SETTINGS} from "../../../enum.js";
import Tracker, {periodNoteTable, FTNotes} from "../../../tracker.js";
import Editor from "../../../editor.js";
import Audio from "../../../audio.js";
import Input from "../../input.js";
import UI from "../../ui.js";
import Layout from "../layout.js";
import Y from "../../yascal/yascal.js";
import DAWtrack, {CTRL_WIDTH, clearWaveformCache} from "./dawtrack.js";

export default class Multitrack extends Panel {
    _HEADER_HEIGHT = 20;
    _SCROLLBAR_SIZE = 16;
    _MIN_TRACK_H = 24;

    _pixelsPerStep = 14;
    _scrollX = 0;
    _scrollY = 0;
    _MIN_PPS = 4;
    _MAX_PPS = 128;

    _trackAnalyser = [];
    _trackMuteState = [];
    _trackSoloState = [];

    _trackDaws = [];
    _blocksDirty = true;
    _blockCanvasDirty = true;

    _blockCanvas;
    _blockCtx;

    _scrollBarH;
    _scrollBarV;

    _dragMode = null;
    _dragStartScrollX = 0;
    _dragStartScrollY = 0;
    _dragStartLocalX = 0;
    _dragStartLocalY = 0;

    constructor() {
        super(0, 0, 20, 20);
        this.name = "multitrackView";

        this._blockCanvas = document.createElement("canvas");
        this._blockCtx    = this._blockCanvas.getContext("2d");

        this._scrollBarH = new Scale9Panel(0, 0, 16, 16, {img: Y.getImage("bar"), left: 2, top: 2, right: 3, bottom: 3});
        this._scrollBarV = new Scale9Panel(0, 0, 16, 16, {img: Y.getImage("bar"), left: 2, top: 2, right: 3, bottom: 3});
        this._scrollBarH.hide();
        this._scrollBarV.hide();
        this.addChild(this._scrollBarH);
        this.addChild(this._scrollBarV);

        this._scrollBarH.onDragStart = () => { this._scrollBarH.startScrollX = this._scrollX; };
        this._scrollBarH.onDrag = touchData => {
            this._applyHorizontalThumbDelta(touchData.deltaX, this._scrollBarH.startScrollX || 0);
            this.refresh();
        };
        this._scrollBarV.onDragStart = () => { this._scrollBarV.startScrollY = this._scrollY; };
        this._scrollBarV.onDrag = touchData => {
            this._applyVerticalThumbDelta(touchData.deltaY, this._scrollBarV.startScrollY || 0);
            this.refresh();
        };

        this.on(EVENT.screenRender, () => { if (this.isVisible()) this.render(); });
        this.on(EVENT.patternChange, () => {
                this._blocksDirty    = true;
                this._blockCanvasDirty = true;
            });
        this.on(EVENT.songLoaded, () => {
                clearWaveformCache();
                this._scrollY = 0;
                for (let i = 0; i < this._trackDaws.length; i++) this._trackDaws[i].markDirty();
                this._blocksDirty    = true;
                this._blockCanvasDirty = true;
            });
        this.on(EVENT.instrumentChange, () => {
                clearWaveformCache();
                for (let i = 0; i < this._trackDaws.length; i++) this._trackDaws[i].markDirty();
                this._blockCanvasDirty = true;
            });
        this.on(EVENT.trackCountChange, () => {
                this._clampScrollY();
                this._blocksDirty    = true;
                this._blockCanvasDirty = true;
                while (this._trackAnalyser.length < Tracker.getTrackCount()) this._addAnalyser();
                this._connectAnalysers();
                this._ensureTrackDaws();
            });
        this.on(EVENT.filterChainCountChange, count => {
                while (this._trackAnalyser.length < count) this._addAnalyser();
                this._connectAnalysers();
            });
        this.on(EVENT.trackStateChange, state => {
                if (typeof state.track !== "undefined") {
                    if (typeof state.mute !== "undefined") this._trackMuteState[state.track] = state.mute;
                    if (typeof state.solo !== "undefined") this._trackSoloState[state.track] = state.solo;

                    if (state.solo) {
                        for (let i = 0; i < Tracker.getTrackCount(); i++) {
                            if (i !== state.track) { this._trackMuteState[i] = true; this._trackSoloState[i] = false; }
                        }
                    } else if (state.wasSolo) {
                        for (let j = 0; j < Tracker.getTrackCount(); j++) {
                            if (j !== state.track) { this._trackMuteState[j] = false; this._trackSoloState[j] = false; }
                        }
                    }

                    this._ensureTrackDaws();
                    for (let t = 0; t < this._trackDaws.length; t++) {
                        if (this._trackDaws[t]) {
                            this._trackDaws[t].setMuteState(!!this._trackMuteState[t], !!this._trackSoloState[t]);
                        }
                    }
                }
            });
        this.on(EVENT.visibleTracksCountChange, () => {
                this._clampScrollY();
                clearWaveformCache();
                for (let i = 0; i < this._trackDaws.length; i++) this._trackDaws[i].markDirty();
                this._blockCanvasDirty = true;
            });

        this.init();
    }

    init() {
        this._ensureTrackDaws();
        if (Audio.context) {
            for (let i = 0; i < Tracker.getTrackCount(); i++) this._addAnalyser();
            this._connectAnalysers();
        }
    }

    onResize() {
        clearWaveformCache();
        for (let i = 0; i < this._trackDaws.length; i++) this._trackDaws[i].markDirty();
        this._blockCanvasDirty = true;
    }

    onShow() {
        this._blocksDirty    = true;
        for (let i = 0; i < this._trackDaws.length; i++) this._trackDaws[i].markDirty();
        this._blockCanvasDirty = true;
        this.needsRendering  = true;
    }

    render() {
        if (!this.isVisible()) return;
        if (this._blockCanvasDirty) this._renderBlockCanvas();

        const tc  = Tracker.getTrackCount();
        const th  = this._getTrackHeight();
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.drawImage(this._blockCanvas, 0, 0);

        this._ensureTrackDaws();
        const firstTrack = Math.floor(this._scrollY / th);
        const topClip    = this._scrollY % th;
        for (let t = firstTrack; t < tc; t++) {
            const ty = this._HEADER_HEIGHT + (t - firstTrack) * th - topClip;
            if (ty >= this.height) break;
            this._trackDaws[t].drawControlsTo(ctx, ty, th);
            this._trackDaws[t].drawScopeTo(ctx, ty, th);
        }

        this._drawCursor(ctx);
        this._updateScrollbars();
        this._scrollBarH.render();
        this._scrollBarV.render();

        if (UI.hasFloatingElements()) {
            this.parentCtx.drawImage(this.canvas, this.left, this.top);
        } else {
            UI.getContext().drawImage(this.canvas, this.left, this.top);
        }
    }

    onMouseWheel(touchData) {
        const deltaY = touchData.mouseWheels[0];
        const deltaX = touchData.mouseWheelX || 0;

        if (Input.isMetaKeyDown()) {
            const mouseLocalX = (touchData.currentMouseX || 0) - this.left - CTRL_WIDTH;
            const mouseStep   = (this._scrollX + mouseLocalX) / this._pixelsPerStep;
            const factor      = deltaY > 0 ? 1.1 : 1 / 1.1;
            this._pixelsPerStep = Math.max(this._MIN_PPS, Math.min(this._MAX_PPS, this._pixelsPerStep * factor));
            this._scrollX = mouseStep * this._pixelsPerStep - mouseLocalX;
            this._clampScrollX();
            this._notifyZoom();
            this._blockCanvasDirty = true;
        } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
            this._scrollX -= deltaX * 0.5;
            this._clampScrollX();
            this._notifyZoom();
            this._blockCanvasDirty = true;
        } else {
            this._scrollY -= deltaY * 0.5;
            this._clampScrollY();
            this._blockCanvasDirty = true;
        }
        this.refresh();
    }

    onDragStart(touchData) {
        const lx = touchData.x;
        const ly = touchData.y;
        this._dragStartScrollX = this._scrollX;
        this._dragStartScrollY = this._scrollY;
        this._dragStartLocalX  = lx;
        this._dragStartLocalY  = ly;

        if (lx >= this.width - this._SCROLLBAR_SIZE && ly >= this._HEADER_HEIGHT) {
            this._dragMode = "vscrollbar";
        } else if (ly >= this.height - this._SCROLLBAR_SIZE && lx >= CTRL_WIDTH) {
            this._dragMode = "hscrollbar";
        } else if (ly < this._HEADER_HEIGHT && lx >= CTRL_WIDTH) {
            this._dragMode = "seek";
            this._seekToX(lx);
        } else if (lx >= CTRL_WIDTH) {
            this._dragMode = "timeline";
        } else {
            this._dragMode = null;
        }
    }

    onDrag(touchData) {
        if (this._dragMode === "seek") {
            this._seekToX(touchData.x);
        } else if (this._dragMode === "timeline") {
            const deltaX = touchData.x - touchData.startX;
            this._scrollX = this._dragStartScrollX - deltaX;
            this._clampScrollX();
            this._notifyZoom();
            this._blockCanvasDirty = true;
        } else if (this._dragMode === "hscrollbar") {
            this._applyHorizontalThumbDelta(touchData.x - this._dragStartLocalX, this._dragStartScrollX);
        } else if (this._dragMode === "vscrollbar") {
            this._applyVerticalThumbDelta(touchData.y - this._dragStartLocalY, this._dragStartScrollY);
        }
    }

    onClick(touchData) {
        const lx = touchData.x;
        const ly = touchData.y;

        if (lx >= CTRL_WIDTH) { this._seekToX(lx); return; }
        if (ly < this._HEADER_HEIGHT) return;

        this._ensureTrackDaws();
        const th     = this._getTrackHeight();
        const trackY = this._scrollY + ly - this._HEADER_HEIGHT;
        const track  = Math.floor(trackY / th);
        if (track < 0 || track >= Tracker.getTrackCount()) return;

        const localTrackY = trackY - track * th;
        if (this._trackDaws[track]) this._trackDaws[track].handleControlClick(lx, localTrackY, th);
    }


    _addAnalyser() {
        if (!Audio.context) return;
        const a = Audio.context.createAnalyser();
        a.smoothingTimeConstant = 0;
        a.fftSize = 256;
        this._trackAnalyser.push(a);
        const idx = this._trackAnalyser.length - 1;
        if (this._trackDaws[idx]) this._trackDaws[idx].setAnalyser(a);
    }

    _connectAnalysers() {
        if (!Audio.context) return;
        const limit = Math.min(this._trackAnalyser.length, Tracker.getTrackCount());
        for (let i = 0; i < limit; i++) {
            if (Audio.filterChains && Audio.filterChains[i]) {
                try { Audio.filterChains[i].output().connect(this._trackAnalyser[i]); } catch(e) {}
            }
            if (this._trackDaws[i]) this._trackDaws[i].setAnalyser(this._trackAnalyser[i]);
        }
    }

    _ensureTrackDaws() {
        const tc = Tracker.getTrackCount();
        while (this._trackDaws.length < tc) {
            const idx = this._trackDaws.length;
            const d   = DAWtrack(idx);
            d.setControlHandlers({record: track => this._toggleTrackRecord(track)});
            d.setZoom(this._pixelsPerStep, this._scrollX);
            if (this._trackAnalyser[idx]) d.setAnalyser(this._trackAnalyser[idx]);
            if (typeof this._trackMuteState[idx] !== "undefined") {
                d.setMuteState(!!this._trackMuteState[idx], !!this._trackSoloState[idx]);
            }
            this._trackDaws.push(d);
        }
    }

    _setActiveTrack(track) {
        if (typeof track !== "number") return;
        if (track < 0 || track >= Tracker.getTrackCount()) return;
        Editor.setCurrentTrack(track);
    }

    _toggleTrackRecord(track) {
        this._setActiveTrack(track);
        EventBus.trigger(EVENT.fxPanelToggle, track);
    }

    _notifyZoom() {
        for (let i = 0; i < this._trackDaws.length; i++) this._trackDaws[i].setZoom(this._pixelsPerStep, this._scrollX);
    }

    _getTrackHeight() {
        const slots     = Layout.visibleTracks || 4;
        const available = this.height - this._HEADER_HEIGHT;
        return Math.max(this._MIN_TRACK_H, Math.floor(available / slots));
    }

    _getMaxScrollX() {
        const contentW = this.width - CTRL_WIDTH;
        return Math.max(0, Tracker.getPatternLength() * this._pixelsPerStep - contentW);
    }

    _getMaxScrollY() {
        const th      = this._getTrackHeight();
        const totalH  = Tracker.getTrackCount() * th;
        const contentH = this.height - this._HEADER_HEIGHT;
        return Math.max(0, totalH - contentH);
    }

    _clampScrollX() { this._scrollX = Math.max(0, Math.min(this._getMaxScrollX(), this._scrollX)); }
    _clampScrollY() { this._scrollY = Math.max(0, Math.min(this._getMaxScrollY(), this._scrollY)); }

    _applyHorizontalThumbDelta(deltaX, startScrollX) {
        const contentW = this.width - CTRL_WIDTH;
        const steps    = Tracker.getPatternLength();
        const totalW   = steps * this._pixelsPerStep;
        if (totalW <= contentW) return;
        const thumbW      = Math.max(this._SCROLLBAR_SIZE, Math.floor(contentW * contentW / totalW));
        const thumbRangeX = contentW - thumbW;
        if (thumbRangeX <= 0) return;
        this._scrollX = startScrollX + deltaX * (totalW - contentW) / thumbRangeX;
        this._clampScrollX();
        this._notifyZoom();
        this._blockCanvasDirty = true;
    }

    _applyVerticalThumbDelta(deltaY, startScrollY) {
        const th       = this._getTrackHeight();
        const contentH = this.height - this._HEADER_HEIGHT;
        const maxScrollY = this._getMaxScrollY();
        if (maxScrollY <= 0) return;
        const totalH      = Tracker.getTrackCount() * th;
        const thumbH      = Math.max(this._SCROLLBAR_SIZE, Math.floor(contentH * contentH / totalH));
        const thumbRangeY = contentH - thumbH;
        if (thumbRangeY <= 0) return;
        this._scrollY = startScrollY + deltaY * maxScrollY / thumbRangeY;
        this._clampScrollY();
        this._blockCanvasDirty = true;
    }

    _renderBlockCanvas() {
        const tc      = Tracker.getTrackCount();
        const th      = this._getTrackHeight();
        const contentW = this.width - CTRL_WIDTH;
        const steps   = Tracker.getPatternLength();

        this._blockCanvas.width  = this.width;
        this._blockCanvas.height = this.height;
        const ctx = this._blockCtx;
        ctx.clearRect(0, 0, this.width, this.height);

        if (this._blocksDirty) this._distributeBlocks();

        this._ensureTrackDaws();
        const firstTrack = Math.floor(this._scrollY / th);
        const topClip    = this._scrollY % th;
        for (let t = firstTrack; t < tc; t++) {
            const ty = this._HEADER_HEIGHT + (t - firstTrack) * th - topClip;
            if (ty >= this.height) break;
            this._trackDaws[t].drawRowTo(ctx, ty, this.width, th, contentW, steps);
        }

        ctx.fillStyle = '#07111e';
        ctx.fillRect(CTRL_WIDTH, 0, contentW, this._HEADER_HEIGHT);
        ctx.fillStyle = '#050f1a';
        ctx.fillRect(0, 0, CTRL_WIDTH, this._HEADER_HEIGHT);

        let stepEvery = 1;
        if (this._pixelsPerStep < 4)  stepEvery = 16;
        else if (this._pixelsPerStep < 8)  stepEvery = 8;
        else if (this._pixelsPerStep < 14) stepEvery = 4;
        else if (this._pixelsPerStep < 28) stepEvery = 2;

        ctx.font = '9px monospace';
        for (let s = 0; s <= steps; s += stepEvery) {
            const rx = CTRL_WIDTH + s * this._pixelsPerStep - this._scrollX;
            if (rx < CTRL_WIDTH || rx >= this.width) continue;
            const major = (s % 16 === 0);
            ctx.fillStyle = major ? 'rgba(140,200,255,0.9)' : 'rgba(100,160,220,0.55)';
            ctx.fillRect(rx, major ? this._HEADER_HEIGHT - 7 : this._HEADER_HEIGHT - 4, 1, major ? 7 : 4);
            if (this._pixelsPerStep >= 6 || major) {
                ctx.fillStyle = major ? 'rgba(140,200,255,0.85)' : 'rgba(100,160,220,0.6)';
                ctx.fillText('' + s, rx + 2, this._HEADER_HEIGHT - 8);
            }
        }

        ctx.fillStyle = 'rgba(70,120,190,0.3)';
        ctx.fillRect(CTRL_WIDTH, 0, 1, this.height);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(CTRL_WIDTH - 1, 0, 1, this.height);

        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(90,130,170,0.6)';
        ctx.fillText('Tracks', 3, 13);

        this._blockCanvasDirty = false;
    }

    _updateScrollbars() {
        const th       = this._getTrackHeight();
        const contentW = this.width - CTRL_WIDTH;
        const contentH = this.height - this._HEADER_HEIGHT;
        const steps    = Tracker.getPatternLength();

        const totalW = steps * this._pixelsPerStep;
        if (totalW > contentW) {
            const thumbW     = Math.max(this._SCROLLBAR_SIZE, Math.floor(contentW * contentW / totalW));
            const maxThumbX  = contentW - thumbW;
            const thumbX     = CTRL_WIDTH + Math.floor((this._scrollX / (totalW - contentW)) * maxThumbX);
            this._scrollBarH.setDimensions({left: thumbX, top: this.height - this._SCROLLBAR_SIZE, width: thumbW, height: this._SCROLLBAR_SIZE});
            this._scrollBarH.show();
        } else {
            this._scrollBarH.hide();
        }

        const maxScrollY = this._getMaxScrollY();
        if (maxScrollY > 0) {
            const totalH     = Tracker.getTrackCount() * th;
            const thumbH     = Math.max(this._SCROLLBAR_SIZE, Math.floor(contentH * contentH / totalH));
            const maxThumbY  = contentH - thumbH;
            const thumbY     = this._HEADER_HEIGHT + Math.floor((this._scrollY / maxScrollY) * maxThumbY);
            this._scrollBarV.setDimensions({left: this.width - this._SCROLLBAR_SIZE, top: thumbY, width: this._SCROLLBAR_SIZE, height: thumbH});
            this._scrollBarV.show();
        } else {
            this._scrollBarV.hide();
        }
    }

    _drawCursor(ctx) {
        const pos = Tracker.getCurrentPatternPos();
        const cx  = CTRL_WIDTH + pos * this._pixelsPerStep - this._scrollX;
        if (cx >= CTRL_WIDTH && cx < this.width) {
            ctx.fillStyle = 'rgba(255,210,50,0.7)';
            ctx.fillRect(cx, this._HEADER_HEIGHT, 1, this.height - this._HEADER_HEIGHT);
            ctx.fillStyle = 'rgba(255,210,50,0.9)';
            ctx.beginPath();
            ctx.moveTo(cx - 4, 0);
            ctx.lineTo(cx + 4, 0);
            ctx.lineTo(cx, 7);
            ctx.fill();
        }
    }

    _seekToX(lx) {
        let step = Math.floor((this._scrollX + lx - CTRL_WIDTH) / this._pixelsPerStep);
        step = Math.max(0, Math.min(Tracker.getPatternLength() - 1, step));
        Tracker.setCurrentPatternPos(step);
    }

    _distributeBlocks() {
        const allBlocks  = this._buildPerTrackBlocks();
        const allEffects = this._buildPerTrackEffects();
        this._ensureTrackDaws();
        for (let i = 0; i < allBlocks.length; i++) {
            if (this._trackDaws[i]) {
                this._trackDaws[i].setBlocks(allBlocks[i]);
                this._trackDaws[i].setEffects(allEffects[i] || []);
            }
        }
        this._blocksDirty = false;
    }

    _buildPerTrackBlocks() {
        const patternData = Tracker.getCurrentPatternData();
        if (!patternData) return [];

        const tc     = Tracker.getTrackCount();
        const result = [];
        for (let t = 0; t < tc; t++) result[t] = [];
        const steps = patternData.length;

        for (let track = 0; track < tc; track++) {
            let pending = null;
            let currentVolume          = 100;
            let currentInstrumentIndex = 0;
            let offsetCache            = null;

            const pushPending = endStep => {
                if (!pending) return;
                let targetEnd = endStep;
                if (typeof pending.maxLengthSteps === "number") {
                    targetEnd = Math.min(targetEnd, pending.startStep + pending.maxLengthSteps);
                }
                pending.endStep = Math.max(pending.startStep + 1, targetEnd);
                delete pending.maxLengthSteps;
                result[track].push(pending);
                pending = null;
            };

            for (let step = 0; step < steps; step++) {
                const note    = patternData[step] && patternData[step][track];
                const hasNote = note && (note.period || note.index);
                let currentStepOffsetBytes = null;

                const rowInstrumentIndex = (note && note.instrument && note.instrument > 0) ? note.instrument : currentInstrumentIndex;

                if (SETTINGS.emulateProtracker1OffsetBug && hasNote && note && note.effect !== 9 && rowInstrumentIndex && offsetCache && offsetCache.instrument === rowInstrumentIndex) {
                    currentStepOffsetBytes = offsetCache.value || 0;
                }

                if (note && note.effect === 9) {
                    const stepOffset = (note.param || 0) << 8;
                    let offsetValue  = stepOffset || (offsetCache ? offsetCache.stepValue || offsetCache.value || 0 : 0);

                    if (SETTINGS.emulateProtracker1OffsetBug && !note.instrument && offsetCache) {
                        offsetValue += offsetCache.value || 0;
                    }
                    currentStepOffsetBytes = offsetValue;
                    offsetCache = offsetCache || {};
                    offsetCache.value     = offsetValue;
                    offsetCache.stepValue = stepOffset;
                    if (SETTINGS.emulateProtracker1OffsetBug) {
                        if (note.instrument) offsetCache.instrument = note.instrument;
                        if (hasNote) offsetCache.value += stepOffset;
                    }
                }

                if (note && typeof note.instrument === "number" && note.instrument > 0) currentInstrumentIndex = note.instrument;
                if (note && note.effect === 12) currentVolume = (note.param || 0) * 100 / 64;
                if (Tracker.inFTMode() && note && note.volumeEffect > 15 && note.volumeEffect <= 80) {
                    currentVolume = (note.volumeEffect - 16) * 100 / 64;
                }
                currentVolume = Math.max(0, Math.min(100, currentVolume));

                if (hasNote) {
                    pushPending(step);
                    let noteVolume       = currentVolume;
                    const instrumentIndex = (note.instrument && note.instrument > 0) ? note.instrument : currentInstrumentIndex;
                    if (instrumentIndex) {
                        const instrument = Tracker.getInstrument(instrumentIndex);
                        if (instrument && instrument.sample) noteVolume = instrument.sample.volume * 100 / 64;
                        if (note.effect === 12) noteVolume = (note.param || 0) * 100 / 64;
                        if (Tracker.inFTMode() && note.volumeEffect > 15 && note.volumeEffect <= 80) {
                            noteVolume = (note.volumeEffect - 16) * 100 / 64;
                        }
                    }
                    noteVolume    = Math.max(0, Math.min(100, noteVolume));
                    currentVolume = noteVolume;

                    pending = {
                        startStep: step,
                        endStep:   steps,
                        instrument: instrumentIndex,
                        name:   this._getNoteName(note),
                        volume: noteVolume,
                        maxLengthSteps: this._getSampleLengthInSteps(note, instrumentIndex, currentStepOffsetBytes)
                    };
                }
            }
            pushPending(steps);
        }
        return result;
    }

    _buildPerTrackEffects() {
        const patternData = Tracker.getCurrentPatternData();
        if (!patternData) return [];
        const tc     = Tracker.getTrackCount();
        const result = [];
        for (let t = 0; t < tc; t++) result[t] = [];
        const steps = patternData.length;
        for (let track = 0; track < tc; track++) {
            for (let step = 0; step < steps; step++) {
                const note = patternData[step] && patternData[step][track];
                if (note && (note.effect || note.param)) {
                    result[track].push({step, effect: note.effect || 0, param: note.param || 0});
                }
            }
        }
        return result;
    }

    _getNoteName(note) {
        if (!note) return "";
        if (note.index && FTNotes && FTNotes[note.index]) return FTNotes[note.index].name || "";
        if (note.period && periodNoteTable && periodNoteTable[note.period]) return periodNoteTable[note.period].name || "";
        return "";
    }

    _getSampleLengthInSteps(note, instrumentIndex, sampleOffsetBytes) {
        if (!note || !instrumentIndex) return null;
        const instrument = Tracker.getInstrument(instrumentIndex);
        if (!instrument) return null;

        let sample = instrument.sample;
        if (Tracker.inFTMode() && note.index && instrument.samples && instrument.sampleNumberForNotes) {
            const sampleIdx = instrument.sampleNumberForNotes[note.index - 1];
            if (typeof sampleIdx === "number" && instrument.samples[sampleIdx]) sample = instrument.samples[sampleIdx];
        }
        if (!sample || !sample.data || !sample.data.length) return null;
        if (sample.loop && sample.loop.enabled && sample.loop.length > 2) return null;

        let period = note.period || 0;
        let noteIndex = note.index || 0;
        if (Tracker.inFTMode()) {
            if (!noteIndex || noteIndex === 97) return null;
            if (sample.relativeNote) noteIndex += sample.relativeNote;
            if (Tracker.useLinearFrequency) {
                period = 7680 - (noteIndex - 1) * 64;
                if (instrument.getFineTune) period -= instrument.getFineTune() / 2;
            } else {
                const ftNote = FTNotes[noteIndex];
                if (!ftNote) return null;
                period = ftNote.period;
                if (instrument.getFineTune) period = Audio.getFineTuneForNote(noteIndex, instrument.getFineTune());
            }
        } else {
            if (!period) return null;
            if (instrument.getFineTune) period = Audio.getFineTuneForPeriod(period, instrument.getFineTune());
        }
        if (period <= 0) return null;

        const sampleRate = Audio.getSampleRateForPeriod(period);
        if (!sampleRate || sampleRate <= 0) return null;

        const props       = Tracker.getProperties();
        const stepDuration = props.ticksPerStep * props.tickTime;
        if (!stepDuration || stepDuration <= 0) return null;

        let sampleLength = sample.data.length;
        if (typeof sampleOffsetBytes === "number" && sampleOffsetBytes > 0) {
            sampleLength = Math.max(1, sampleLength - Math.min(sampleOffsetBytes, sampleLength - 1));
        }

        return Math.max(1, Math.ceil(sampleLength / sampleRate / stepDuration));
    }
}
