import StateManager from "../../src/ui/stateManager.js";
import {SELECTION} from "../../src/enum.js";

let SampleProcessing = (context) => {

    let me = {};

    function getSoftClippedVolume(value, peak){
        var sign = value < 0 ? -1 : 1;
        var abs = Math.abs(value);
        var inputKnee = 0.9;
        var outputKnee = 0.95;

        if (abs <= inputKnee){
            return value * (outputKnee / inputKnee);
        }

        abs = Math.min(abs, peak);
        var compressed = outputKnee + ((abs - inputKnee) / (peak - inputKnee)) * (1 - outputKnee);
        return sign * Math.min(compressed, 1);
    }

    function boostVolumeSoftClip(data, scale){
        var i, len;
        var peak = 0;

        for (i = 0, len = data.length; i < len; i++){
            data[i] = data[i] * scale;
            peak = Math.max(peak, Math.abs(data[i]));
        }

        if (peak <= 0.9) return;
        peak = Math.max(peak, 1);

        for (i = 0, len = data.length; i < len; i++){
            data[i] = getSoftClippedVolume(data[i], peak);
        }
    }

    function applyRangeTransform(name, transform){
        var data = context.splitRange();
        var {rangeStart, rangeLength} = context.getRange();
        var editAction = StateManager.createSampleUndo(SELECTION.REPLACE, rangeStart, rangeLength);
        editAction.data = data.range.slice(0);
        editAction.name = name;
        transform(data.range);
        editAction.dataTo = data.range.slice(0);
        StateManager.registerEdit(editAction);
        context.joinRange(data);
    }

    me.adjustVolume = function(amount){
        var data = context.splitRange();
        var {rangeStart, rangeLength} = context.getRange();
        var scale, i, len;
        var update = false;

        var editAction = StateManager.createSampleUndo(SELECTION.REPLACE, rangeStart, rangeLength);
        editAction.data = data.range.slice(0);
        editAction.name = "Adjust Volume";

        if (amount === "max"){
            var min = 0;
            var max = 0;
            for (i = 0, len = data.range.length; i < len; i++){
                min = Math.min(min, data.range[i]);
                max = Math.max(max, data.range[i]);
            }
            scale = 1 / Math.max(max, -min);
            if (scale > 1){
                for (i = 0, len = data.range.length; i < len; i++){
                    data.range[i] = data.range[i] * scale;
                }
                update = true;
            }
        }

        if (amount === "fadein"){
            for (i = 0, len = data.range.length - 1; i <= len; i++){
                scale = i / len;
                data.range[i] = data.range[i] * scale;
            }
            update = true;
        }

        if (amount === "fadeout"){
            for (i = 0, len = data.range.length - 1; i <= len; i++){
                scale = 1 - i / len;
                data.range[i] = data.range[i] * scale;
            }
            update = true;
        }

        if (!update){
            if (typeof amount === "number"){
                scale = 1 + (1 / amount);
                if (amount > 0){
                    boostVolumeSoftClip(data.range, scale);
                } else {
                    for (i = 0, len = data.range.length - 1; i <= len; i++){
                        data.range[i] = Math.min(Math.max(data.range[i] * scale, -1), 1);
                    }
                }
                update = true;
            }
        }

        if (update){
            editAction.dataTo = data.range.slice(0);
            StateManager.registerEdit(editAction);
            context.joinRange(data);
        }
    };

    me.trim = function(){
        var data = context.splitRange();
        var {rangeStart, rangeLength} = context.getRange();
        var range = data.range;
        var absRangeStart = rangeStart >= 0 ? rangeStart : 0;

        // one 8-bit quantisation step — avoids treating sub-LSB DC bias as content
        var threshold = 1 / 128;

        var start = 0;
        while (start < range.length && Math.abs(range[start]) < threshold) start++;
        if (start >= range.length) return;

        var end = range.length - 1;
        while (end > start && Math.abs(range[end]) < threshold) end--;

        // everything after the loop end point is never played — truncate there
        var loop = context.getLoop ? context.getLoop() : null;
        if (loop && loop.length > 2) {
            var loopEnd = loop.start + loop.length - 1 - absRangeStart;
            if (loopEnd > 0 && loopEnd < end) end = loopEnd;
        }

        // enforce even sample length (MOD/XM word-aligned requirement)
        if ((end - start + 1) & 1) end--;
        if (start > end) return;

        if (start === 0 && end === range.length - 1) return;

        var editAction = StateManager.createSampleUndo(SELECTION.REPLACE, rangeStart, rangeLength);
        editAction.data = range.slice(0);
        editAction.name = "Trim Sample";

        data.range = range.slice(start, end + 1);

        editAction.dataTo = data.range.slice(0);
        StateManager.registerEdit(editAction);
        context.joinRange(data);

        // adjust loop points if leading samples were removed, and enforce even values
        if (loop && context.setLoop) {
            var newLoopStart = loop.start;
            if (loop.start >= absRangeStart) {
                newLoopStart = Math.max(absRangeStart, loop.start - start);
            }
            newLoopStart = newLoopStart & ~1;
            var newLoopLength = loop.length & ~1;
            if (newLoopStart !== loop.start || newLoopLength !== loop.length) {
                context.setLoop(newLoopStart, newLoopLength);
            }
        }
    };

    me.reverse = function(){
        applyRangeTransform("Reverse Sample", function(range){ range.reverse(); });
    };

    me.invert = function(){
        applyRangeTransform("Invert Sample", function(range){
            for (var i = 0; i < range.length; i++) range[i] = -range[i];
        });
    };

    return me;

};

export default SampleProcessing;
