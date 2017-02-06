(function(){
	FilterChain = function(initialValues) {

		initialValues = initialValues || {};

		this.lowValue = 0.0;
		this.midValue = 0.0;
		this.highValue = 0.0;

		this.FREQ_MUL = 7000;
		this.QUAL_MUL = 30;

		var context = Audio.context;

		var lowPassfilter = context.createBiquadFilter();
		lowPassfilter.type = "lowpass";
		lowPassfilter.frequency.value = 5000;

		var lowGain = context.createBiquadFilter();
		lowGain.type = "lowshelf";
		lowGain.frequency.value = 320.0;
		lowGain.gain.value = this.lowValue;


		var midGain = context.createBiquadFilter();
		midGain.type = "peaking";
		midGain.frequency.value = 1000.0;
		midGain.Q.value = 0.5;
		midGain.gain.value = this.midValue;

		var highGain = context.createBiquadFilter();
		highGain.type = "highshelf";
		highGain.frequency.value = 3200.0;
		highGain.gain.value = this.highValue;


		var reverbSettings = {
			seconds: 3,
			decay: 2,
			reverse: 0
		};

		var reverb = context.createConvolver();
		var buffer = window.buffer;
		if (buffer){
			reverb.buffer = buffer;
		}else{
			var preLoader = PreLoader();
			preLoader.load(["data/reverb/sportcentre.m4a"],PRELOADTYPE.audio,function(){
				console.error("reverb buffer loaded");
				reverb.buffer = cachedAssets.audio["data/reverb/sportcentre.m4a"];
			});
		}

		//console.error(reverb);
		//window.reverb = reverb;

		var r_rate = context.sampleRate;
		var r_length = r_rate * reverbSettings.seconds;
		var impulse = context.createBuffer(2, r_length, r_rate);
		var impulseL = impulse.getChannelData(0);
		var impulseR = impulse.getChannelData(1);


		for (var i = 0; i < r_length; i++) {
			var n = reverbSettings.reverse ? r_length - i : i;
			impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, reverbSettings.decay);
			impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, reverbSettings.decay);
		}
		var reverbGain = context.createGain();
		reverbGain.gain.value = 0;

		//reverb.buffer = impulse;

		var useDistortion = false;

		if (useDistortion){
			var distortion = context.createWaveShaper();
			distortion.curve = distortionCurve(400);
			distortion.oversample = '4x';
			window.d = distortion;
		}



		var volumeGain = context.createGain();


		//source.connect(highGain);
		highGain.connect(midGain);
		midGain.connect(lowGain);
		lowGain.connect(lowPassfilter);
		lowPassfilter.connect(volumeGain);

		if (useDistortion){
			lowPassfilter.connect(distortion);
			distortion.connect(reverbGain);
		}else{
			lowPassfilter.connect(reverbGain);
		}


		reverbGain.connect(reverb);
		reverb.connect(volumeGain);


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

		this.lowGain  = lowGain;
		this.midGain = midGain;
		this.highGain = highGain;
		this.lowPass = lowPassfilter;
		this.reverbGain = reverbGain;
		this.volumeGain = volumeGain;
	};

	var module = FilterChain.prototype;

	module.connect = function(input,output){
		input.connect(this.highGain);
		this.volumeGain.connect(output);
	};

	module.low = function(value) {
		if (typeof value !== "undefined"){
			var maxRange = 20;
			this.lowValue = value;
			this.lowGain.gain.value = this.lowValue * maxRange  ;
		}
		return this.lowValue;
	};

	module.mid = function(value) {
		if (typeof value !== "undefined"){
			var maxRange = 20;
			this.midValue = value;
			this.midGain.gain.value = this.midValue * maxRange  ;
		}
		return this.midValue;
	};

	module.high = function(value) {
		if (typeof value !== "undefined"){
			var maxRange = 20;
			this.highValue = value;
			this.highGain.gain.value = this.highValue * maxRange  ;
		}
		return this.highValue;
	};

	module.frequency = function(value) {
		// Clamp the frequency between the minimum value (40 Hz) and half of the
		// sampling rate.
		var minValue = 40;
		var maxValue = Audio.context.sampleRate / 2;
		// Logarithm (base 2) to compute how many octaves fall in the range.
		var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
		// Compute a multiplier from 0 to 1 based on an exponential scale.
		var multiplier = Math.pow(2, numberOfOctaves * (value - 1.0));
		// Get back to the frequency value between min and max.

		console.error(maxValue,multiplier,numberOfOctaves);
		this.lowPass.frequency.value = maxValue * multiplier;
	};

	module.quality = function(value) {
		this.lowPass.Q.value = value * this.QUAL_MUL;
	};

	module.reverb = function(value) {
		var volume = value;
		var max = 100;
		var fraction = parseInt(value) / max;
		// Let's use an x*x curve (x-squared) since simple linear (x) does not
		// sound as good.
		this.reverbGain.gain.value = fraction * fraction;

	};

	module.volume = function(value) {
		var volume = value;
		var max = 100;
		var fraction = parseInt(value) / max;
		// Let's use an x*x curve (x-squared) since simple linear (x) does not
		// sound as good.
		this.volumeGain.gain.value = fraction * fraction;

	};
})();


