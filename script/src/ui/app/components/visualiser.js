import Panel from "../../components/panel.js";
import Y from "../../yascal/yascal.js";
import EventBus from "../../../eventBus.js";
import {EVENT, SETTINGS} from "../../../enum.js";
import Audio from "../../../audio.js";
import Tracker from "../../../tracker.js";
import UI from "../../ui.js";

export default class Visualiser extends Panel {
    _modes       = ["wave", "spectrum", "tracks"];
    _modeIndex   = 2;
    _mode        = "tracks";
    _analyser    = null;
    _background  = null;
    _trackAnalyser = [];
    _trackMuteState = [];
    _analyserPos = [];
    _analyserSize = 512;
    _analyserAmp  = 1.5;
    _scopeData = null;

    constructor() {
        super(0, 0, 20, 20);

        this.ctx.fillStyle   = "black";
        this.ctx.lineWidth   = 2;
        this.ctx.strokeStyle = "rgba(120, 255, 50, 0.5)";

        this.on(EVENT.screenRender, () => { this.render(); });
        this.on(EVENT.second, () => {
                if (Tracker.isPlaying()) {
                    const fps = UI.getAverageFps();
                    if (fps < 32 && this._analyserSize > 32) {
                        this._analyserSize >>= 1;
                        this._analyserSize = Math.max(this._analyserSize, 32);
                        UI.resetAverageFps();
                        console.warn("Low framerate, setting analyser FFT size to " + this._analyserSize);
                    }
                }
            });

        this.init();
    }

    init() {
        if (Audio.context) {
            this._analyser = Audio.context.createAnalyser();
            this._analyser.minDecibels            = -90;
            this._analyser.maxDecibels            = -10;
            this._analyser.smoothingTimeConstant  = 0.85;

            for (let i = 0; i < Tracker.getTrackCount(); i++) this._addAnalyser();
            this._setAnalyserPositions();
        }

        this._background = Y.getImage("oscilloscope");

        this.on(EVENT.filterChainCountChange, trackCount => {
            for (let i = this._trackAnalyser.length; i < trackCount; i++) this._addAnalyser();
            this._setAnalyserPositions();
            this.connect();
        });

        this.on(EVENT.trackStateChange, state => {
            if (typeof state.track !== "undefined") this._trackMuteState[state.track] = state.mute;
        });

        this.needsRendering = true;
    }

    connect(audioNode) {
        if (Audio.context) {
            if (audioNode) audioNode.connect(this._analyser);
            for (let i = 0; i < Tracker.getTrackCount(); i++) {
                Audio.filterChains[i].output().connect(this._trackAnalyser[i]);
            }
        }
    }

    nextMode() {
        this._modeIndex++;
        if (this._modeIndex >= this._modes.length) this._modeIndex = 0;
        this._mode = this._modes[this._modeIndex];
        if (!SETTINGS.gateDebugLogging) console.log("setting visualiser to mode " + this._mode);
    }

    render() {
        if (!Audio.context) return;
        if (!this.isVisible()) return;
        this._modeTracksRender();
    }

    onResize() {
        this._setAnalyserPositions();
    }

    onClick(touchData) {
        if (this._mode === "tracks") {
            for (let trackIndex = 0; trackIndex < Tracker.getTrackCount(); trackIndex++) {
                const pos = this._analyserPos[trackIndex];
                const x   = touchData.x;
                const y   = touchData.y;
                if (x > pos.left && x < pos.left + pos.width && y > pos.top && y < pos.top + pos.height) {
                    EventBus.trigger(EVENT.trackScopeClick, trackIndex);
                    break;
                }
            }
        }
    }


    _addAnalyser() {
        const a = Audio.context.createAnalyser();
        a.smoothingTimeConstant = 0;
        a.fftSize = this._analyserSize;
        this._trackAnalyser.push(a);
    }

    _modeTracksRender() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.lineWidth   = 2;
        this.ctx.strokeStyle = "rgba(120, 255, 50, 0.5)";

        const hasVolume   = !Audio.cutOff;
        const bufferLength = this._analyserSize;
        if (!this._scopeData || this._scopeData.length !== bufferLength) {
            this._scopeData = new Uint8Array(bufferLength);
        }
        // Each analyser is read and drawn synchronously, so all tracks share one buffer.
        const dataArray = this._scopeData;

        for (let trackIndex = 0; trackIndex < Tracker.getTrackCount(); trackIndex++) {
            const track  = this._trackAnalyser[trackIndex];
            const pos    = this._analyserPos[trackIndex];
            const isMute = this._trackMuteState[trackIndex];

            this.ctx.drawImage(this._background, pos.left, pos.top, pos.width, pos.height);

            if (track) {
                this.ctx.beginPath();
                const wx0 = pos.lineLeft;
                const ww  = pos.lineWidth;
                let wx = wx0, wy;

                if (hasVolume && !isMute) {
                    track.fftSize = this._analyserSize;
                    track.getByteTimeDomainData(dataArray);

                    if (SETTINGS.enableMinMaxScopes && bufferLength > ww * 2) {
                        this._drawMinMaxScope(dataArray, pos);
                    } else {
                        const sliceWidth = ww / bufferLength;
                        for (let i = 0; i < bufferLength; i++) {
                            const v      = dataArray[i] / 128.0;
                            let offsetY  = 0;
                            let vScaled  = v;
                            if (this._analyserAmp > 1) {
                                vScaled  = v * this._analyserAmp;
                                offsetY  = pos.height / 2 - pos.height / 2 * this._analyserAmp;
                            }
                            wy = vScaled * pos.height / 2 + pos.top + offsetY;
                            if (i === 0) this.ctx.moveTo(wx, wy); else this.ctx.lineTo(wx, wy);
                            wx += sliceWidth;
                        }
                    }
                } else {
                    wy = pos.height / 2 + pos.top;
                    this.ctx.moveTo(wx, wy);
                    this.ctx.lineTo(wx + ww - 1, wy);
                }
                this.ctx.stroke();

                if (isMute) {
                    this.ctx.fillStyle = "rgba(34, 49, 85, 0.5)";
                    this.ctx.fillRect(pos.left, pos.top, pos.width, pos.height);
                }
            }
        }

        if (UI.hasFloatingElements()) {
            this.parentCtx.drawImage(this.canvas, this.left, this.top);
            this.parent.refresh();
        } else {
            UI.getContext().drawImage(this.canvas, this.left, this.top);
        }
    }

    _drawMinMaxScope(data, pos) {
        const step = pos.lineWidth / data.length;
        const amp = this._analyserAmp > 1 ? this._analyserAmp : 1;
        const offsetY = pos.height / 2 - pos.height / 2 * amp;
        this.ctx.moveTo(pos.lineLeft, (data[0] / 128 * amp) * pos.height / 2 + pos.top + offsetY);
        let lastIndex = 0;
        let i = 0;
        while (i < data.length) {
            const column = Math.floor(pos.lineLeft + i * step);
            let minIndex = i, maxIndex = i;
            do {
                if (data[i] < data[minIndex]) minIndex = i;
                if (data[i] > data[maxIndex]) maxIndex = i;
                i++;
            } while (i < data.length && Math.floor(pos.lineLeft + i * step) === column);

            // Keep both extrema in sample order so the trace never doubles back.
            const first = Math.min(minIndex, maxIndex);
            const second = Math.max(minIndex, maxIndex);
            for (let point = 0; point < 2; point++) {
                const index = point === 0 ? first : second;
                if (index <= lastIndex) continue;
                const y = (data[index] / 128 * amp) * pos.height / 2 + pos.top + offsetY;
                this.ctx.lineTo(pos.lineLeft + index * step, y);
                lastIndex = index;
            }
        }
        // The final sample need not be an extremum, particularly on flat signals.
        const end = data.length - 1;
        if (lastIndex !== end) {
            const y = (data[end] / 128 * amp) * pos.height / 2 + pos.top + offsetY;
            this.ctx.lineTo(pos.lineLeft + end * step, y);
        }
    }

    _setAnalyserPositions() {
        this._analyserPos = [];
        let cols    = Tracker.getTrackCount();
        let aHeight = this.height;

        if (Tracker.getTrackCount() > 4) {
            cols    = Math.ceil(Tracker.getTrackCount() / 2);
            aHeight = this.height / 2;
        }
        const aWidth = this.width / cols;

        for (let i = 0; i < Tracker.getTrackCount(); i++) {
            let aLeft = i * aWidth;
            let aTop  = 0;
            if (i >= cols) { aLeft = (i - cols) * aWidth; aTop = this.height - aHeight; }
            this._analyserPos[i] = {
                left:      Math.floor(aLeft),
                top:       Math.floor(aTop),
                width:     Math.floor(aWidth),
                height:    Math.floor(aHeight),
                lineLeft:  Math.ceil(aLeft + aWidth / 70),
                lineWidth: Math.floor(aWidth - aWidth / 30)
            };
        }
    }
}
