FilterChain = (function(filters) {

	var me = {};

	filters = filters || {
		volume: true,
		panning: true
	};

    // disable for now: sounds muffled;
	var disableFilters = true;

	if (disableFilters){
        filters = {
            volume: true,
            panning: true
        };
	}

	var useVolume = filters.volume;
	var usePanning = filters.panning;
	var useHigh = filters.high;
	var useMid = filters.mid;
	var useLow = filters.low;
	var useLowPass = filters.lowPass;
	var useReverb = filters.reverb;
	var useDistortion = filters.distortion;

	var input,output,output2;

	var lowValue = 0.0;
	var midValue = 0.0;
	var highValue = 0.0;
	var volumeValue = 70;
	var panningValue = 0;

	var FREQ_MUL = 7000;
	var QUAL_MUL = 30;

	var context = Audio.context;

	var volumeGain,highGain,midGain,lowGain,lowPassfilter,reverb,reverbGain,panner;

	if (useHigh){
		highGain = context.createBiquadFilter();
		highGain.type = "highshelf";
		highGain.frequency.value = 3200.0;
		highGain.gain.value = highValue;
		input = highGain;
		output = highGain;
	}

	if (useMid){
		midGain = context.createBiquadFilter();
		midGain.type = "peaking";
		midGain.frequency.value = 1000.0;
		midGain.Q.value = 0.5;
		midGain.gain.value = midValue;
		if (!input) input = midGain;
		if (output) output.connect(midGain);
		output = midGain;
	}

	if (useLow){
		lowGain = context.createBiquadFilter();
		lowGain.type = "lowshelf";
		lowGain.frequency.value = 320.0;
		lowGain.gain.value = lowValue;

		if (!input) input = lowGain;
		if (output) output.connect(lowGain);
		output = lowGain;
	}

	if (useLowPass){
		lowPassfilter = context.createBiquadFilter();
		lowPassfilter.type = "lowpass";
		lowPassfilter.frequency.value = 5000;


		if (!input) input = lowPassfilter;
		if (output) output.connect(lowPassfilter);
		output = lowPassfilter;
	}

	if (useReverb){
		reverb = context.createConvolver();
		reverbGain = context.createGain();
		reverbGain.gain.value = 0;

		if (!input) input = reverbGain;
		if (output) output.connect(reverbGain);
		reverbGain.connect(reverb);
		output2 = reverb;
	}

	if (useDistortion){
		var distortion = context.createWaveShaper();
		distortion.curve = distortionCurve(400);
		distortion.oversample = '4x';
	}

	if (useVolume){
		volumeGain = context.createGain();
		if (!input) input = volumeGain;
		if (output) output.connect(volumeGain);
		if (output2) output2.connect(volumeGain);
		output = volumeGain;
	}

	if (usePanning){
		panner = Audio.context.createStereoPanner();
		if (!input) input = panner;
		if (output) output.connect(panner);
		output = panner;
	}

	function init(){
		me.volumeValue(volumeValue);
	}

	function distortionCurve(amount) {
		var k = typeof amount === 'number' ? amount : 50,
				n_samples = 44100,
				curve = new Float32Array(n_samples),
				deg = Math.PI / 180,
				i = 0,
				x;
		for ( ; i < n_samples; ++i ) {
			x = i * 2 / n_samples - 1;
			curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
		}
		return curve;
	}

	me.lowValue = function(value) {
		if (!useLow) return;
		if (typeof value !== "undefined"){
			var maxRange = 20;
			lowValue = value;
			lowGain.gain.value = lowValue * maxRange  ;
		}
		return lowValue;
	};

	me.midValue = function(value) {
		if (!useMid) return;
		if (typeof value !== "undefined"){
			var maxRange = 20;
			midValue = value;
			midGain.gain.value = midValue * maxRange  ;
		}
		return midValue;
	};

	me.highValue = function(value) {
		if (!useHigh) return;
		if (typeof value !== "undefined"){
			var maxRange = 20;
			highValue = value;
			highGain.gain.value = highValue * maxRange  ;
		}
		return highValue;
	};

	me.lowPassFrequencyValue = function(value) {
		if (!useLowPass) return;
		// Clamp the frequency between the minimum value (40 Hz) and half of the
		// sampling rate.
		var minValue = 40;
		var maxValue = Audio.context.sampleRate / 2;
		// Logarithm (base 2) to compute how many octaves fall in the range.
		var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
		// Compute a multiplier from 0 to 1 based on an exponential scale.
		var multiplier = Math.pow(2, numberOfOctaves * (value - 1.0));
		// Get back to the frequency value between min and max.

		lowPassfilter.frequency.value = maxValue * multiplier;
	};

	me.lowPassQualityValue = function(value) {
		if (!useLowPass) return;
		lowPassfilter.Q.value = value * QUAL_MUL;
	};

	me.reverbValue = function(value) {
		if (!useReverb) return;
		if (!reverb.buffer){
			var buffer = cachedAssets.audio["data/reverb/sportcentre.m4a"];
			if (!buffer){
				var preLoader = PreLoader();
				preLoader.load(["data/reverb/sportcentre.m4a"],PRELOADTYPE.audio,function(){
					console.error("reverb buffer loaded");
					reverb.buffer = cachedAssets.audio["data/reverb/sportcentre.m4a"];
				});
			}else{
				reverb.buffer = buffer;
			}
		}

		var max = 100;
		var fraction = parseInt(value) / max;
		reverbGain.gain.value = fraction * fraction;

	};

	me.volumeValue = function(value) {
		if (!useVolume) return;
		if (typeof value !== "undefined"){
			var max = 100;
			volumeValue = value;
			var fraction = value / max;
			volumeGain.gain.value = fraction * fraction;
		}
		return volumeValue;
	};

	me.panningValue = function(value) {
		if (!usePanning) return;
		if (typeof value !== "undefined"){
			panningValue = value;
			panner.pan.value = panningValue;
		}
		return panningValue;
	};

	me.input = function(){
		return input;
	};

	me.output = function(){
		return output;
	};

	init();

	return me;

});





