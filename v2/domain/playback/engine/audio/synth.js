var periodicWaveCache = typeof WeakMap !== "undefined" ? new WeakMap() : undefined;

var Synth = {};

Synth.play = function(options){
	var audioContext = options.audioContext;
	var instrument = options.instrument;
	var synth = instrument.synth;
	var patch = synth.adlib || {};
	var period = options.period;
	var volume = options.volume;
	var time = options.time;
	var basePeriod = period;
	var currentFrequency = getSynthFrequency(period,instrument);
	var modulator = audioContext.createOscillator();
	var carrier = audioContext.createOscillator();
	var modGain = audioContext.createGain();
	var modulatorEnvelope = audioContext.createGain();
	var carrierEnvelope = audioContext.createGain();
	var volumeGain = audioContext.createGain();
	var volumeFadeOut = audioContext.createGain();
	var panning;
	var lfo;
	var lfoGain;

	var carrierMultiplier = getOplMultiplier(patch.carrierMultiple);
	var modulatorMultiplier = getOplMultiplier(patch.modulatorMultiple);
	var carrierLevel = getOplLevel(patch.carrierLevel);
	var modulatorLevel = getOplLevel(patch.modulatorLevel);
	var feedback = patch.feedback || 0;
	var modulationAmount = currentFrequency * modulatorLevel * (1 + feedback) * 0.8;

	volume = typeof volume === "undefined" ? (100 * (synth.volume || 64) / 64) : volume;

	setSynthWaveform(modulator,patch.modulatorWaveform,audioContext);
	setSynthWaveform(carrier,patch.carrierWaveform,audioContext);
	modulator.frequency.setValueAtTime(currentFrequency * modulatorMultiplier,time);
	carrier.frequency.setValueAtTime(currentFrequency * carrierMultiplier,time);

	modGain.gain.setValueAtTime(modulationAmount,time);
	var modulatorEnvelopeEnd = applySynthEnvelope(modulatorEnvelope.gain,time,modulatorLevel,patch,"modulator");
	var carrierEnvelopeEnd = applySynthEnvelope(carrierEnvelope.gain,time,carrierLevel,patch,"carrier");
	modulator.connect(modulatorEnvelope);
	carrier.connect(carrierEnvelope);
	carrierEnvelope.connect(volumeGain);

	if (patch.connection){
		modulatorEnvelope.connect(volumeGain);
	}else{
		modulatorEnvelope.connect(modGain);
		modGain.connect(carrier.frequency);
	}

	if ((patch.modulatorFlags & 64) || (patch.carrierFlags & 64)){
		lfo = audioContext.createOscillator();
		lfoGain = audioContext.createGain();
		lfo.frequency.setValueAtTime(6.1,time);
		lfoGain.gain.setValueAtTime(currentFrequency * 0.006,time);
		lfo.connect(lfoGain);
		lfoGain.connect(modulator.frequency);
		lfoGain.connect(carrier.frequency);
	}

	volumeGain.gain.setValueAtTime(volume/100 * (patch.connection ? 0.65 : 1),time);

	volumeFadeOut.gain.setValueAtTime(0,time);
	volumeFadeOut.gain.linearRampToValueAtTime(1,time + 0.01);
	volumeGain.connect(volumeFadeOut);

	if (options.usePanning){
		panning = audioContext.createStereoPanner();
		panning.pan.setValueAtTime((instrument.sample.panning || 0) / 128,time);
		volumeFadeOut.connect(panning);
		panning.connect(options.output);
	}else{
		volumeFadeOut.connect(options.output);
	}

	modulator.start(time);
	carrier.start(time);
	if (lfo) lfo.start(time);

	var result = {
		source: carrier,
		modulator: modulator,
		volume: volumeGain,
		modulatorEnvelope: modulatorEnvelope,
		carrierEnvelope: carrierEnvelope,
		panning: panning,
		volumeFadeOut: volumeFadeOut,
		startVolume: volume,
		currentVolume: volume,
		startPeriod: period,
		basePeriod: basePeriod,
		noteIndex: options.noteIndex,
		startPlaybackRate: 1,
		sampleRate: currentFrequency,
		instrumentIndex: options.index,
		effects: options.effects,
		track: options.track,
		time: time,
		synth: true
	};

	result.setPeriodAtTime = function(newPeriod,newTime){
		var frequency = getSynthFrequency(newPeriod,instrument);
		carrier.frequency.setValueAtTime(frequency * carrierMultiplier,newTime);
		modulator.frequency.setValueAtTime(frequency * modulatorMultiplier,newTime);
		modGain.gain.setValueAtTime(frequency * modulatorLevel * (1 + feedback) * 0.8,newTime);
		if (lfoGain) lfoGain.gain.setValueAtTime(frequency * 0.006,newTime);
		result.sampleRate = frequency;
	};

	result.applyRelease = function(releaseTime){
		var carrierRelease = getOplRateTime(patch.carrierRelease,0.015,3.5);
		var modulatorRelease = getOplRateTime(patch.modulatorRelease,0.015,3.5);
		releaseAudioParam(carrierEnvelope.gain,releaseTime,carrierRelease);
		releaseAudioParam(modulatorEnvelope.gain,releaseTime,modulatorRelease);
		result.stop(releaseTime + Math.max(carrierRelease,modulatorRelease) + 0.05);
	};

	result.stop = function(stopTime){
		try{
			carrier.stop(stopTime);
			modulator.stop(stopTime);
			if (lfo) lfo.stop(stopTime);
		}catch (e){
		}
	};

	if (carrierEnvelopeEnd) result.stop(time + Math.max(carrierEnvelopeEnd,modulatorEnvelopeEnd || 0) + 0.05);

	return result;
};

function getSynthFrequency(period,instrument){
	var c4Frequency = 261.625565;
	var c2spd = (instrument.synth && instrument.synth.c2spd) || 8363;
	return c4Frequency * (428 / Math.max(period,1)) * (c2spd / 8363);
}

function getOplMultiplier(value){
	value = value || 0;
	if (value === 0) return 0.5;
	return value;
}

function getOplLevel(value){
	value = typeof value === "number" ? value : 0;
	value = Math.max(0,Math.min(63,value));
	return (63 - value) / 63;
}

function setSynthWaveform(oscillator,value,audioContext){
	value = value || 0;
	if (!value){
		oscillator.type = "sine";
		return;
	}

	var wave = getSynthPeriodicWave(audioContext,value);
	if (wave && oscillator.setPeriodicWave){
		oscillator.setPeriodicWave(wave);
	}else{
		switch(value & 3){
			case 1: oscillator.type = "sawtooth"; break;
			case 2: oscillator.type = "square"; break;
			case 3: oscillator.type = "triangle"; break;
			default: oscillator.type = "sine"; break;
		}
	}
}

function getSynthPeriodicWave(audioContext,value){
	if (!audioContext.createPeriodicWave) return;

	var cache = periodicWaveCache && periodicWaveCache.get(audioContext);
	if (!cache){
		cache = {};
		if (periodicWaveCache) periodicWaveCache.set(audioContext,cache);
	}
	value = value & 7;
	if (cache[value]) return cache[value];

	var samples = 2048;
	var harmonics = 32;
	var shape = [];
	var mean = 0;
	for (var i = 0; i<samples; i++){
		var phase = (i / samples) * Math.PI * 2;
		var sample = getOplWaveSample(value,phase);
		shape.push(sample);
		mean += sample;
	}
	mean /= samples;

	var real = new Float32Array(harmonics + 1);
	var imag = new Float32Array(harmonics + 1);
	for (var harmonic = 1; harmonic<=harmonics; harmonic++){
		var realSum = 0;
		var imagSum = 0;
		for (i = 0; i<samples; i++){
			phase = (i / samples) * Math.PI * 2 * harmonic;
			sample = shape[i] - mean;
			realSum += sample * Math.cos(phase);
			imagSum += sample * Math.sin(phase);
		}
		real[harmonic] = realSum * 2 / samples;
		imag[harmonic] = imagSum * 2 / samples;
	}

	cache[value] = audioContext.createPeriodicWave(real,imag);
	return cache[value];
}

function getOplWaveSample(value,phase){
	var sine = Math.sin(phase);
	switch(value & 7){
		case 1: return sine > 0 ? sine : 0;
		case 2: return Math.abs(sine);
		case 3: return phase < Math.PI ? Math.sin(phase * 2) : 0;
		case 4: return sine > 0 ? sine : -sine * 0.35;
		case 5: return sine > 0 ? sine : 0.35 * sine;
		case 6: return phase < Math.PI ? Math.abs(Math.sin(phase * 2)) : 0;
		case 7: return phase < Math.PI ? (sine > 0 ? 1 : -1) * Math.abs(sine) : 0;
		default: return sine;
	}
}

function getOplRateTime(value,min,max){
	value = Math.max(0,Math.min(15,value || 0));
	if (value >= 15) return min;
	if (value <= 0) return max;
	var curve = Math.pow(2,(15 - value) / 2) - 1;
	var maxCurve = Math.pow(2,7.5) - 1;
	return min + (curve / maxCurve) * (max - min);
}

function applySynthEnvelope(param,time,level,patch,operator){
	var attack = getOplRateTime(patch[operator + "Attack"],0.002,3.5);
	var decay = getOplRateTime(patch[operator + "Decay"],0.015,2.5);
	var release = getOplRateTime(patch[operator + "Release"],0.015,3.5);
	var sustain = 1 - ((patch[operator + "Sustain"] || 0) / 15);
	var flags = patch[operator + "Flags"] || 0;
	sustain = Math.max(0,Math.min(1,sustain));

	param.setValueAtTime(0,time);
	param.linearRampToValueAtTime(level,time + attack);
	param.linearRampToValueAtTime(level * sustain,time + attack + decay);
	if (!(flags & 32)){
		param.linearRampToValueAtTime(0,time + attack + decay + release);
		return attack + decay + release;
	}
	return 0;
}

function releaseAudioParam(param,time,release){
	if (param.cancelAndHoldAtTime){
		param.cancelAndHoldAtTime(time);
	}else{
		var value = param.value;
		param.cancelScheduledValues(time);
		param.setValueAtTime(value,time);
	}
	param.linearRampToValueAtTime(0,time + release);
}

export default Synth;
