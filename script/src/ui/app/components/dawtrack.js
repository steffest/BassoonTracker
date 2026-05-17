import Audio from "../../../audio.js";
import Tracker from "../../../tracker.js";
import EventBus from "../../../eventBus.js";
import {EVENT} from "../../../enum.js";
import Y from "../../yascal/yascal.js";
import Panel from "../../components/panel.js";
import Button from "../../components/button.js";
import Assets from "../../assets.js";
import Font from "../../font.js";

function drawScale9(ctx, img, x, y, w, h, t, r, b, l) {
    if (!img || w <= 0 || h <= 0) return;
    var sw = img.width - l - r;
    var sh = img.height - t - b;
    var dw = w - l - r;
    var dh = h - t - b;
    if (dw < 1 || dh < 1) { ctx.drawImage(img, x, y, w, h); return; }
    ctx.drawImage(img,    0,    0, l,  t,      x,       y,      l,  t);
    ctx.drawImage(img,    l,    0, sw, t,      x+l,     y,      dw, t);
    ctx.drawImage(img, l+sw,    0, r,  t,      x+l+dw,  y,      r,  t);
    ctx.drawImage(img,    0,    t, l,  sh,     x,       y+t,    l,  dh);
    ctx.drawImage(img,    l,    t, sw, sh,     x+l,     y+t,    dw, dh);
    ctx.drawImage(img, l+sw,    t, r,  sh,     x+l+dw,  y+t,    r,  dh);
    ctx.drawImage(img,    0, t+sh, l,  b,      x,       y+t+dh, l,  b);
    ctx.drawImage(img,    l, t+sh, sw, b,      x+l,     y+t+dh, dw, b);
    ctx.drawImage(img, l+sw, t+sh, r,  b,      x+l+dw,  y+t+dh, r,  b);
}

export var CTRL_WIDTH = 220;
export var SCOPE_WIDTH = 132;
export var SCOPE_LEFT = 36;

var COLORS = [
    '#4a9eff', '#ff6b6b', '#4ecdc4', '#ffd93d',
    '#a8e6cf', '#f8b500', '#95e1d3', '#ff8b94',
    '#6bc5ff', '#ffaa6b', '#84d4c0', '#ffe57a',
    '#c9b1ff', '#ff9eb5', '#a8d8ea', '#fee140'
];

// Shared waveform thumbnail cache — keyed by "instrumentIdx_height_colorIdx"
var waveformCache = {};

export function clearWaveformCache() {
    waveformCache = {};
}

function brightenColor(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.round(r + (255 - r) * 0.55));
    g = Math.min(255, Math.round(g + (255 - g) * 0.55));
    b = Math.min(255, Math.round(b + (255 - b) * 0.55));
    return 'rgba(' + r + ',' + g + ',' + b + ',0.9)';
}

function getWaveformCanvas(instrumentIdx, height, colorIndex) {
    if (!instrumentIdx) return null;
    var key = instrumentIdx + '_' + height + '_' + colorIndex;
    if (waveformCache[key]) return waveformCache[key];

    var instrument = Tracker.getInstrument(instrumentIdx);
    if (!instrument || !instrument.sample) return null;
    var data = instrument.sample.data;
    if (!data || !data.length) return null;

    var W = Math.min(data.length, 512);
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = height;
    var ctx = canvas.getContext("2d");

    var mid = height / 2;
    var scale = mid * 0.88;
    var baseColor = (colorIndex >= 0 && colorIndex < COLORS.length) ? COLORS[colorIndex] : '#ffffff';
    ctx.fillStyle = brightenColor(baseColor);

    var samplesPerPixel = data.length / W;
    for (var x = 0; x < W; x++) {
        var s0 = Math.floor(x * samplesPerPixel);
        var s1 = Math.ceil((x + 1) * samplesPerPixel);
        var lo = 0, hi = 0;
        for (var s = s0; s < s1 && s < data.length; s++) {
            var v = data[s];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
        }
        var topY = Math.floor(mid - hi * scale);
        var botY = Math.ceil(mid - lo * scale);
        ctx.fillRect(x, topY, 1, Math.max(1, botY - topY));
    }

    waveformCache[key] = canvas;
    return canvas;
}

function createTrackControls(getHandlers, trackIdx) {
    console.error("Creating controls for track", trackIdx);
    var panel = new Panel(0, 0, CTRL_WIDTH, 1);
    var controlImg = Y.getImage("dawcontrols");
    var layoutTrackHeight = -1;

    var soloButton = Assets.generate("buttonDAW");
    var muteButton = Assets.generate("buttonDAW");
    var recordButton = Assets.generate("buttonDAW");

    soloButton.setSize(26, 26);
    soloButton.label     = "S";
    soloButton.textAlign = "center";
    soloButton.font      = Font.dark;

    muteButton.setSize(26, 26);
    muteButton.label     = "M";
    muteButton.textAlign = "center";
    muteButton.font      = Font.dark;

    recordButton.setSize(26, 26);
    recordButton.backgroundImage = Y.getImage("dawbuttonrecord");
    recordButton.activeImage     = Y.getImage("dawbuttonrecord_active");

    function triggerTrackStateChange(wasSolo) {
        EventBus.trigger(EVENT.trackStateChange, {
            track: trackIdx,
            solo: soloButton.isActive,
            mute: muteButton.isActive,
            wasSolo: wasSolo
        });
    }

    soloButton.onClick = function() {
        var wasSolo = soloButton.isActive;
        soloButton.toggleActive();
        if (muteButton.isActive) muteButton.isActive = false;
        triggerTrackStateChange(wasSolo);
        var h = getHandlers();
        if (h && h.solo) h.solo(trackIdx);
    };
    muteButton.onClick = function() {
        muteButton.toggleActive();
        if (soloButton.isActive) soloButton.isActive = false;
        triggerTrackStateChange();
        var h = getHandlers();
        if (h && h.mute) h.mute(trackIdx);
    };
    recordButton.onClick = function() {
        var h = getHandlers();
        if (h && h.record) h.record(trackIdx);
    };

    panel.addChild(soloButton);
    panel.addChild(muteButton);
    panel.addChild(recordButton);

    panel.renderOverride = function() {
        panel.clearCanvas();
        if (controlImg) {
            drawScale9(panel.ctx, controlImg, 0, 0, panel.width, panel.height, 18, 53, 15, 36);
        }
        panel.children.forEach(function(child) {
            child.render();
        });
    };

    panel.setTrackHeight = function(trackHeight) {
        if (layoutTrackHeight === trackHeight) return;
        layoutTrackHeight = trackHeight;

        if (panel.height !== trackHeight || panel.width !== CTRL_WIDTH) {
            panel.setSize(CTRL_WIDTH, trackHeight);
        }

        var buttonSpace = Math.floor((trackHeight - 26 * 3) / 4);
        var buttonX = CTRL_WIDTH - 33;
        soloButton.setPosition(buttonX, buttonSpace);
        muteButton.setPosition(buttonX, buttonSpace * 2 + 26);
        recordButton.setPosition(buttonX, buttonSpace * 3 + 52);
    };

    panel.setStates = function(muted, soloed, recording) {
        muteButton.isActive   = !!muted;
        soloButton.isActive   = !!soloed;
        recordButton.isActive = !!recording;
    };


    return panel;
}

let DAWtrack = function(trackIndex) {
    var me = {};

    var blocks = [];
    var effects = [];
    var pixelsPerStep = 14;
    var scrollX = 0;
    var isMuted = false;
    var isSoloed = false;
    var isRecording = false;
    var analyser = null;
    var dataArray = new Uint8Array(256);
    var dirty = true;
    var controlHandlers = {};

    var controls = createTrackControls(function() { return controlHandlers; }, trackIndex);

    var rowCanvas = document.createElement("canvas");
    var rowCtx = rowCanvas.getContext("2d");

    me.setBlocks = function(newBlocks) {
        blocks = newBlocks;
        dirty = true;
    };

    me.setEffects = function(newEffects) {
        effects = newEffects;
        dirty = true;
    };

    me.setZoom = function(pps, sx) {
        pixelsPerStep = pps;
        scrollX = sx;
        dirty = true;
    };

    me.setMuteState = function(muted, soloed) {
        isMuted = muted;
        isSoloed = soloed;
        controls.setStates(isMuted, isSoloed, isRecording);
    };

    me.setRecordState = function(recording) {
        isRecording = !!recording;
        controls.setStates(isMuted, isSoloed, isRecording);
    };

    me.setControlHandlers = function(handlers) {
        controlHandlers = handlers || {};
    };

    me.setAnalyser = function(a) {
        analyser = a;
    };

    me.markDirty = function() {
        dirty = true;
    };

    me.handleControlClick = function(localX, localY, trackHeight) {
        controls.setTrackHeight(trackHeight);
        if (!controls.containsPoint(localX, localY)) return false;

        var target = controls.getElementAtPoint(localX, localY);
        if (target && target.onClick) {
            target.onClick({ x: localX, y: localY, target: target });
            return true;
        }

        return true;
    };

    function buildCache(totalWidth, trackHeight, contentW, steps) {
        rowCanvas.width = totalWidth;
        rowCanvas.height = trackHeight;
        var ctx = rowCtx;

        // Carve off a bottom strip for effects
        var effectH = Math.min(16, Math.max(0, Math.floor(trackHeight * 0.3)));
        var blockAreaH = trackHeight - effectH;

        // Row background
        ctx.fillStyle = trackIndex % 2 === 0 ? '#101928' : '#141e32';
        ctx.fillRect(CTRL_WIDTH, 0, contentW, blockAreaH);
        ctx.fillStyle = trackIndex % 2 === 0 ? '#0a1220' : '#0e1628';
        ctx.fillRect(0, 0, CTRL_WIDTH, trackHeight);

        // Effects strip background
        if (effectH > 0) {
            ctx.fillStyle = trackIndex % 2 === 0 ? '#080f1c' : '#0b1220';
            ctx.fillRect(CTRL_WIDTH, blockAreaH, contentW, effectH);
            ctx.fillStyle = 'rgba(70,120,190,0.18)';
            ctx.fillRect(CTRL_WIDTH, blockAreaH, contentW, 1);
        }

        // Row separator
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, totalWidth, 1);

        // Vertical grid lines (drawn before blocks so blocks render on top)
        var visStartStep = Math.floor(scrollX / pixelsPerStep);
        var visEndStep = Math.min(steps, Math.ceil((scrollX + contentW) / pixelsPerStep) + 1);
        for (var s = visStartStep; s <= visEndStep; s++) {
            var gx = CTRL_WIDTH + s * pixelsPerStep - scrollX;
            if (s % 16 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.09)';
                ctx.fillRect(gx, 0, 1, trackHeight);
            } else if (s % 4 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.04)';
                ctx.fillRect(gx, 0, 1, trackHeight);
            }
        }

        // Note blocks
        for (var b = 0; b < blocks.length; b++) {
            var block = blocks[b];
            if (block.endStep < visStartStep || block.startStep > visEndStep) continue;

            var bx = CTRL_WIDTH + block.startStep * pixelsPerStep - scrollX;
            var bw = (block.endStep - block.startStep) * pixelsPerStep - 2;
            var by = 2;
            var bh = blockAreaH - 4;
            if (bh < 4) bh = 4;
            if (bw < 1) bw = 1;

            var cx = Math.max(bx, CTRL_WIDTH);
            var cw = Math.min(bx + bw, totalWidth) - cx;
            if (cw <= 0) continue;

            var colorIndex = block.instrument > 0 ? (block.instrument - 1) % COLORS.length : 14;

            // Scale9 panel background (samplepanel_blue tinted per-instrument)
            var panelImg = Y.getImage("samplepanel_blue");
            if (panelImg) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                // tint by drawing the image then coloring over with multiply-style blend
                drawScale9(ctx, panelImg, cx, by, cw, bh, 18, 4, 4, 4);
                // color overlay using the track color at low opacity
                ctx.fillStyle = COLORS[colorIndex];
                ctx.globalAlpha = 0.20;
                ctx.fillRect(cx, by+16, cw, bh);
                ctx.globalAlpha = 1;
                ctx.restore();
            } else {
                // fallback to solid color
                ctx.fillStyle = COLORS[colorIndex];
                ctx.fillRect(cx, by, cw, bh);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(cx, by, cw, 1);
            }

            // Waveform fills the block
            if (bw > 4) {
                var waveCanvas = getWaveformCanvas(block.instrument, bh, colorIndex);
                if (waveCanvas) {
                    var srcX = bx >= CTRL_WIDTH ? 0 : Math.floor((CTRL_WIDTH - bx) * waveCanvas.width / bw);
                    var srcW = Math.max(1, Math.floor(cw * waveCanvas.width / bw));
                    var volumeFactor = typeof block.volume === "number" ? (block.volume / 100) : 1;
                    volumeFactor = Math.max(0, Math.min(1, volumeFactor));
                    var waveH = Math.max(1, Math.round(bh * volumeFactor));
                    var waveY = by + Math.floor((bh - waveH) / 2);
                    ctx.drawImage(waveCanvas, srcX, 0, srcW, waveCanvas.height, cx, waveY, cw, waveH);
                }
            }

            // Instrument name at top (only when block starts in view and block is wide enough)
            if (bw > 18 && bh > 8 && bx >= CTRL_WIDTH - 1) {
                var instrument = Tracker.getInstrument(block.instrument);
                var instrName = (instrument && instrument.name) ? instrument.name.trim() : '';
                if (instrName) {
                    Font.small.write(ctx, instrName, bx + 5, by + 5, 0);
                }
            }

            // Note name at the bottom of the block
            if (bw > 18 && bh > 16 && bx >= CTRL_WIDTH - 1 && block.name) {
                Font.small.write(ctx, block.name, bx + 5, by + bh - 10, 0);
            }
        }

        // Effects strip
        if (effectH > 0) {
            var charH = Math.min(10, Math.ceil(effectH * 0.6));
            var paramH = effectH - charH - 1;
            var charY = blockAreaH + charH;
            var paramY = blockAreaH + effectH - 1;

            for (var e = 0; e < effects.length; e++) {
                var eff = effects[e];
                if (eff.step < visStartStep || eff.step > visEndStep) continue;
                var ex = CTRL_WIDTH + eff.step * pixelsPerStep - scrollX;
                if (ex < CTRL_WIDTH || ex >= totalWidth) continue;

                var effChar = eff.effect > 15
                    ? eff.effect.toString(36).toUpperCase()
                    : eff.effect.toString(16).toUpperCase();
                var paramStr = ('00' + eff.param.toString(16).toUpperCase()).slice(-2);

                Font.small.write(ctx, effChar, ex + 1, charY - 8, 0);

                if (paramH >= 5) {
                    Font.small.write(ctx, paramStr, ex + 1, paramY - 6, 0);
                }
            }
        }

        dirty = false;
    }

    // Composite cached row (background + grid lines + blocks) into ctx at y offset
    me.drawRowTo = function(ctx, y, totalWidth, trackHeight, contentW, steps) {
        if (dirty || rowCanvas.width !== totalWidth || rowCanvas.height !== trackHeight) {
            buildCache(totalWidth, trackHeight, contentW, steps);
        }
        ctx.drawImage(rowCanvas, 0, y);
    };

    // Draw live oscilloscope waveform into ctx at y offset
    me.drawScopeTo = function(ctx, y, trackHeight) {
        if (!analyser) return;
        var midY = y + trackHeight / 2;

        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(100,220,80,0.65)';

        if (!isMuted && !Audio.cutOff) {
            analyser.fftSize = 256;
            analyser.getByteTimeDomainData(dataArray);
            var sliceW = SCOPE_WIDTH / 256;
            for (var j = 0; j < 256; j++) {
                var v = dataArray[j] / 128.0;
                    var wx = SCOPE_LEFT + j * sliceW;
                var wy = y + v * trackHeight / 2;
                if (j === 0) ctx.moveTo(wx, wy);
                else ctx.lineTo(wx, wy);
            }
        } else {
            ctx.moveTo(SCOPE_LEFT, midY);
            ctx.lineTo(SCOPE_LEFT + SCOPE_WIDTH - 1, midY);
        }
        ctx.stroke();

        if (isMuted) {
            ctx.fillStyle = 'rgba(8,18,45,0.55)';
            ctx.fillRect(SCOPE_LEFT, y, SCOPE_WIDTH, trackHeight);
        }
    };

    // Draw controls panel into ctx at y offset
    me.drawControlsTo = function(ctx, y, trackHeight) {
        controls.setTrackHeight(trackHeight);
        var controlsCanvas = controls.render(true);
        ctx.drawImage(controlsCanvas, 0, y);
    };

    return me;
};

export default DAWtrack;
