import Audio from "../../../audio.js";
import {EVENT} from "../../../enum.js";
import Panel from "../../components/panel.js";
import Y from "../../yascal/yascal.js";
import UI from "../../ui.js";

export default class VUMeter extends Panel {
    _analyserLeft  = null;
    _analyserRight = null;
    _connected     = false;
    _bufferLength  = 0;
    _dataArray     = null;
    _base;
    _baseActive;

    _vuWidth      = 500;
    _vuHeight     = 6;
    _dotWidth     = 10;
    _margin       = 2;
    _middleMargin = 4;

    constructor() {
        super(0, 0, 20, 20);

        this.left = 400;
        this.top  = 9;

        this._base       = document.createElement("canvas");
        this._baseActive = document.createElement("canvas");

        if (Audio.context) {
            this._analyserLeft  = Audio.context.createAnalyser();
            this._analyserLeft.minDecibels  = -90;
            this._analyserLeft.maxDecibels  = -10;
            this._analyserLeft.smoothingTimeConstant = 0.85;

            this._analyserRight = Audio.context.createAnalyser();
            this._analyserRight.minDecibels  = -90;
            this._analyserRight.maxDecibels  = -10;
            this._analyserRight.smoothingTimeConstant = 0.85;

            this._analyserLeft.fftSize  = 32;
            this._analyserRight.fftSize = 32;
            this._bufferLength = this._analyserLeft.fftSize;
            this._dataArray    = new Uint8Array(this._bufferLength);
        }

        this.setSize(this._vuWidth, this._vuHeight * 2 + this._middleMargin);
        this._buildVu();
        this.needsRendering = true;

        this.on(EVENT.screenRender, () => this._renderVU());
    }

    get width() {
        return super.width;
    }

    set width(value) {
        this._vuWidth = value;
        this.setSize(this._vuWidth, this._vuHeight * 2 + this._middleMargin);
        this._buildVu();
    }

    connect(audioNode) {
        if (Audio.context) {
            const splitter = Audio.context.createChannelSplitter(2);
            audioNode.connect(splitter);
            splitter.connect(this._analyserLeft,  0);
            splitter.connect(this._analyserRight, 1);
            this._connected = true;
        }
    }


    _buildVu() {
        const baseCtx       = this._base.getContext("2d");
        const baseActiveCtx = this._baseActive.getContext("2d");

        this._base.width = this._baseActive.width = this._vuWidth;
        this._base.height = this._baseActive.height = this._vuHeight;

        const dots = Math.floor(this._vuWidth / (this._dotWidth + this._margin));
        baseCtx.clearRect(0, 0, this._vuWidth, this._vuHeight);
        baseActiveCtx.clearRect(0, 0, this._vuWidth, this._vuHeight);

        const dotGreen       = Y.getImage("vu_green");
        const dotGreenActive = Y.getImage("vu_green_active");
        const dotYellow      = Y.getImage("vu_yellow");
        const dotYellowActive = Y.getImage("vu_yellow_active");
        const dotRed         = Y.getImage("vu_red");
        const dotRedActive   = Y.getImage("vu_red_active");

        for (let i = 0; i < dots; i++) {
            let img = dotGreen, imgActive = dotGreenActive;
            if (i >= dots / 3)   { img = dotYellow; imgActive = dotYellowActive; }
            if (i >= dots / 1.5) { img = dotRed;    imgActive = dotRedActive; }
            const x = i * (this._dotWidth + this._margin);
            baseCtx.drawImage(img, x, 0, this._dotWidth, this._vuHeight);
            baseActiveCtx.drawImage(imgActive, x, 0, this._dotWidth, this._vuHeight);
        }
        this.ctx.fillStyle = "#253352";
    }

    _renderVU() {
        if (!this._connected) return;

        this._analyserLeft.getByteTimeDomainData(this._dataArray);
        const rangeLeft  = this._getDynamicRange(this._dataArray) * (Math.E - 1);
        this._analyserRight.getByteTimeDomainData(this._dataArray);
        const rangeRight = this._getDynamicRange(this._dataArray) * (Math.E - 1);

        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.drawImage(this._base, 0, 0);
        this.ctx.drawImage(this._base, 0, this._vuHeight + this._middleMargin);

        const wLeft  = Math.min(Math.floor(rangeLeft  * this._vuWidth), this._vuWidth);
        const wRight = Math.min(Math.floor(rangeRight * this._vuWidth), this._vuWidth);

        if (wLeft)  this.ctx.drawImage(this._baseActive, 0, 0, wLeft,  this._vuHeight, 0, 0, wLeft,  this._vuHeight);
        if (wRight) this.ctx.drawImage(this._baseActive, 0, 0, wRight, this._vuHeight, 0, this._vuHeight + this._middleMargin, wRight, this._vuHeight);

        UI.getContext().drawImage(this.canvas, this.left, this.top);
    }

    _getDynamicRange(buffer) {
        let min = 128, max = 128;
        for (let i = 0; i < buffer.length; i++) {
            const v = buffer[i];
            if (v < min) min = v;
            else if (v > max) max = v;
        }
        return (max - min) / 255;
    }
}
