var AudioProcessing = (function() {
    var me = {};

    function buildEnvelopes(data, sampleRate, params) {
        var len = data.length;
        var threshold  = (params.threshold || 16) / 127;
        var releaseSec = (params.release   || 150) / 1000;
        sampleRate = sampleRate || 22050;

        var attackCoef  = 1 - Math.exp(-1 / (sampleRate * 0.001));
        var releaseCoef = 1 - Math.exp(-1 / (sampleRate * releaseSec));

        var envFwd = new Float32Array(len);
        var env = 0;
        for (var i = 0; i < len; i++) {
            var abs = Math.abs(data[i]);
            var c = abs > env ? attackCoef : releaseCoef;
            env += c * (abs - env);
            envFwd[i] = env;
        }

        var envBwd = new Float32Array(len);
        env = 0;
        for (var i = len - 1; i >= 0; i--) {
            var abs = Math.abs(data[i]);
            var c = abs > env ? attackCoef : releaseCoef;
            env += c * (abs - env);
            envBwd[i] = env;
        }

        var combined = new Float32Array(len);
        for (var i = 0; i < len; i++) {
            combined[i] = Math.max(envFwd[i], envBwd[i]);
        }
        return { envelope: combined, threshold: threshold };
    }

    // Returns { envelope, gainReduction } arrays for visualisation without modifying data.
    me.computeData = function(data, sampleRate, params) {
        params = params || {};
        var len = data.length;
        var maxAlpha = Math.max(0.01, 1 - (params.reduction || 90) / 100);
        var env = buildEnvelopes(data, sampleRate, params);
        var gainReduction = new Float32Array(len);
        for (var i = 0; i < len; i++) {
            gainReduction[i] = Math.min(1, env.envelope[i] / env.threshold);
        }
        return { envelope: env.envelope, gainReduction: gainReduction };
    };

    // Noise-adaptive hiss reduction suited for 8-bit samples.
    // params: { threshold (LSBs, 1-40), release (ms, 10-500), reduction (%, 10-99) }
    me.hissReduction = function(data, sampleRate, params) {
        params = params || {};
        var len = data.length;
        if (!len) return;

        var maxAlpha = Math.max(0.01, 1 - (params.reduction || 90) / 100);
        var env = buildEnvelopes(data, sampleRate, params);
        var envelope  = env.envelope;
        var threshold = env.threshold;

        var prev = 0;
        for (var i = 0; i < len; i++) {
            var t        = Math.min(1, envelope[i] / threshold);
            var alpha    = maxAlpha + (1 - maxAlpha) * t;
            var filtered = alpha * data[i] + (1 - alpha) * prev;
            prev         = filtered;
            data[i]      = filtered;
        }
    };

    // Quantize float data to 8-bit precision in-place (round-trip simulation).
    me.quantize8bit = function(data) {
        for (var i = 0; i < data.length; i++) {
            data[i] = Math.round(data[i] * 127) / 127;
        }
    };

    return me;
})();

export default AudioProcessing;
