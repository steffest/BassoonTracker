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
	var usePanning = filters.panning && Audio.context.createStereoPanner;
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

	// use a simple Gain as input so that we can leave this connected while changing filters
	input = context.createGain();
    input.gain.value=1;
    output = input;


    function connectFilters(){

    	output = input;

        if (useHigh){
            highGain = highGain || createHigh();
            output.connect(highGain);
            output = highGain;
        }

        if (useMid){
            midGain = midGain || createMid();
            output.connect(midGain);
            output = midGain;
        }

        if (useLow){
            lowGain = lowGain || createLow();
            output.connect(lowGain);
            output = lowGain;
        }

        if (useLowPass){
            lowPassfilter = lowPassfilter || createLowPass();
            output.connect(lowPassfilter);
            output = lowPassfilter;
        }

        if (useReverb){
            reverb = reverb || context.createConvolver();
            reverbGain = reverbGain || context.createGain();
            reverbGain.gain.value = 0;

            output.connect(reverbGain);
            reverbGain.connect(reverb);
            output2 = reverb;
        }

        if (useDistortion){
            var distortion = context.createWaveShaper();
            distortion.curve = distortionCurve(400);
            distortion.oversample = '4x';
        }

        if (usePanning){
            panner =  panner || Audio.context.createStereoPanner();
            output.connect(panner);
            output = panner;
        }

        // always use volume as last node - never disconnect this

		volumeGain = volumeGain ||context.createGain();
        output.connect(volumeGain);
        if (output2) output2.connect(volumeGain);
        output = volumeGain;

	}

	function disConnectFilter(){
        input.disconnect();
        if (highGain) highGain.disconnect();
        if (midGain) midGain.disconnect();
        if (lowGain) lowGain.disconnect();
        if (lowPassfilter) lowPassfilter.disconnect();
        if (reverbGain) reverbGain.disconnect();
		if (panner) panner.disconnect();
        output2 = undefined;
	}


	function createHigh(){
		var filter = context.createBiquadFilter();
		filter.type = "highshelf";
		filter.frequency.value = 3200.0;
		filter.gain.value = highValue;
		return filter;
	}

	function createMid(){
        var filter = context.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = 1000.0;
        filter.Q.value = 0.5;
        filter.gain.value = midValue;
        return filter;
	}

	function createLow(){
        var filter = context.createBiquadFilter();
        filter.type = "lowshelf";
        filter.frequency.value = 320.0;
        filter.gain.value = lowValue;
        return filter;
	}

	function createLowPass(){
        var filter =  context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 5000;
        return filter;
	}

	function init(){
        connectFilters();
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

	me.panningValue = function(value,time) {
		if (!usePanning) return;

		if (typeof value !== "undefined"){
			panningValue = value;
			if (time){
				panner.pan.setValueAtTime(panningValue,time);
			}else{
				// very weird bug in safari on OSX ... setting pan.value directy to 0 does not work
				panner.pan.setValueAtTime(panningValue,Audio.context.currentTime);
			}

		}
		return panningValue;
	};

	me.setState = function(name,value){
		disConnectFilter();

        if (name==="high") useHigh=!!value;
        if (name==="mid") useMid=!!value;
        if (name==="low") useLow=!!value;
        if (name==="lowPass") useLowPass=!!value;
        if (name==="reverb") useReverb=!!value;
        if (name==="panning") usePanning=(!!value) && Audio.context.createStereoPanner;

        connectFilters();

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





