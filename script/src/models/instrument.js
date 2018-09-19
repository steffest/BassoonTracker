var Instrument = function(){
	var me = {};

	me.type = "sample";
	me.name = "";
	me.instrumentIndex = 0;
	me.sampleIndex = -1;
	me.fadeout = 128;
	me.data = [];
	me.samples = [Sample()];
	me.sample = me.samples[0];

	me.volumeEnvelope = {raw: [], enabled: false, points: [[0,48],[10,64],[20,40],[30,18],[40,28],[50,18]], count:6};
	me.panningEnvelope = {raw: [], enabled: false, points: [[0,32],[20,40],[40,24],[60,32],[80,32]], count:5};
	me.vibrato = {};

	me.sampleNumberForNotes = [];

	me.play = function(noteIndex,notePeriod,volume,track,trackEffects,time){
		if (Tracker.inFTMode()) {
			notePeriod = me.getPeriodForNote(noteIndex);
		}
		return Audio.playSample(me.instrumentIndex,notePeriod,volume,track,trackEffects,time,noteIndex);
	};

	me.noteOn = function(time){
		var volumeEnvelope;
		var panningEnvelope;
		var scheduled = {};

		if (me.volumeEnvelope.enabled){
			volumeEnvelope = Audio.context.createGain();
			var envelope = me.volumeEnvelope;
			var scheduledTime = processEnvelop(envelope,volumeEnvelope,time);
			if (scheduledTime) scheduled.volume = (time + scheduledTime);
		}

		if (me.panningEnvelope.enabled && Audio.usePanning){
			panningEnvelope = Audio.context.createStereoPanner();
			envelope = me.panningEnvelope;
			scheduledTime = processEnvelop(envelope,panningEnvelope,time);
			if (scheduledTime) scheduled.panning = (time + scheduledTime);
		}

		return {volume: volumeEnvelope, panning: panningEnvelope, scheduled: scheduled};
	};

	me.noteOff = function(time,noteInfo){
		if (!noteInfo || !noteInfo.volume) return;

		noteInfo.volume.gain.cancelScheduledValues(time);
		noteInfo.volumeFadeOut.gain.cancelScheduledValues(time);

		if (noteInfo.volumeEnvelope) noteInfo.volumeEnvelope.gain.cancelScheduledValues(time);
		if (noteInfo.panningEnvelope) noteInfo.panningEnvelope.pan.cancelScheduledValues(time);
        noteInfo.scheduled = undefined;

		if (Tracker.inFTMode()){
			var tickTime = Tracker.getProperties().tickTime;

			if (me.volumeEnvelope.enabled){

				if (me.volumeEnvelope.sustain && noteInfo.volumeEnvelope){
					var timeOffset = 0;
					var startPoint = me.volumeEnvelope.points[me.volumeEnvelope.sustainPoint];
					if (startPoint) timeOffset = startPoint[0]*tickTime;
					for (var p = me.volumeEnvelope.sustainPoint; p< me.volumeEnvelope.count;p++){
						var point = me.volumeEnvelope.points[p];
						if (point) noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(point[1]/64,time + (point[0]*tickTime) - timeOffset);
					}
				}

				if (me.fadeout){
					var fadeOutTime = (65536/me.fadeout) * tickTime / 2;
					noteInfo.volumeFadeOut.gain.linearRampToValueAtTime(0,time + fadeOutTime);
				}

			}else{
				noteInfo.volumeFadeOut.gain.linearRampToValueAtTime(0,time + 0.1)
			}

            if (me.panningEnvelope.enabled && Audio.usePanning){
                timeOffset = 0;
                startPoint = me.panningEnvelope.points[me.panningEnvelope.sustainPoint];
                if (startPoint) timeOffset = startPoint[0]*tickTime;
                for (p = me.panningEnvelope.sustainPoint; p< me.panningEnvelope.count;p++){
                    point = me.panningEnvelope.points[p];
                    if (point) noteInfo.panningEnvelope.pan.linearRampToValueAtTime((point[1]-32)/32,time + (point[0]*tickTime) - timeOffset);
                }
            }

			return 100;

		}else{
			if (noteInfo.isKey && noteInfo.volume){
				noteInfo.volume.gain.linearRampToValueAtTime(0,time + 0.5)
			}else{
				return 0;
			}
		}

	};

	function processEnvelop(envelope,audioNode,time){
		var tickTime = Tracker.getProperties().tickTime;
		var maxPoint = envelope.sustain ? envelope.sustainPoint+1 : envelope.count;
		var doLoop = envelope.loop && (envelope.loopStartPoint<envelope.loopEndPoint);
		if (envelope.sustain && envelope.sustainPoint<=envelope.loopStartPoint) doLoop=false;

		if (doLoop) maxPoint = envelope.loopEndPoint+1;
		var scheduledTime = 0;
		var lastX = 0;

		if (audioNode.gain){
			// volume
			var audioParam = audioNode.gain;
			var center = 0;
			var max = 64;
		}else{
			// panning node
			audioParam = audioNode.pan;
			center = 32;
			max = 32;
		}

		audioParam.setValueAtTime((envelope.points[0][1]-center)/max,time);

		for (var p = 1; p<maxPoint;p++){
			var point = envelope.points[p];
			lastX = point[0];
			scheduledTime = lastX*tickTime;
			audioParam.linearRampToValueAtTime((point[1]-center)/max,time + scheduledTime);
		}

		if (doLoop){
			return me.scheduleEnvelopeLoop(audioNode,time,2,scheduledTime);
		}

		return false;
	}

	me.scheduleEnvelopeLoop = function(audioNode,startTime,seconds,scheduledTime){

		// note - this is not 100% accurate when the ticktime would change during the scheduled ahead time

		scheduledTime = scheduledTime || 0;
		var tickTime = Tracker.getProperties().tickTime;

		if (audioNode.gain){
			// volume
			var envelope = me.volumeEnvelope;
			var audioParam = audioNode.gain;
			var center = 0;
			var max = 64;
		}else{
			// panning node
			envelope = me.panningEnvelope;
			audioParam = audioNode.pan;
			center = 32;
			max = 32;
		}
		var point = envelope.points[envelope.loopStartPoint];
		var loopStartX = point[0]-1; // the -1 is to have at least 1 tick difference in the end and the start of the loop

		while (scheduledTime < seconds){
			var startScheduledTime = scheduledTime;
			for (var p = envelope.loopStartPoint; p<=envelope.loopEndPoint;p++){
				point = envelope.points[p];
				scheduledTime = startScheduledTime + ((point[0]-loopStartX)*tickTime);
				audioParam.linearRampToValueAtTime((point[1]-center)/max,startTime + scheduledTime);
			}
		}

		return scheduledTime;

	};

	me.resetVolume = function(time,noteInfo){
        if (noteInfo.volumeFadeOut) {
            noteInfo.volumeFadeOut.gain.cancelScheduledValues(time);
            noteInfo.volumeFadeOut.gain.setValueAtTime(1, time);
        }

        if (noteInfo.volumeEnvelope){
            noteInfo.volumeEnvelope.gain.cancelScheduledValues(time);
            var tickTime = Tracker.getProperties().tickTime;

            var maxPoint = me.volumeEnvelope.sustain ? me.volumeEnvelope.sustainPoint+1 :  me.volumeEnvelope.count;
            noteInfo.volumeEnvelope.gain.setValueAtTime(me.volumeEnvelope.points[0][1]/64,time);
            for (var p = 1; p<maxPoint;p++){
                var point = me.volumeEnvelope.points[p];
                noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(point[1]/64,time + (point[0]*tickTime));
            }
		}
	};

	me.getFineTune = function(){
		return Tracker.inFTMode() ? me.sample.finetuneX : me.sample.finetune;
	};

	me.setFineTune = function(finetune){
		if (Tracker.inFTMode()){
			me.sample.finetuneX = finetune;
			me.sample.finetune = finetune >> 4;
		}else{
            if (finetune>7) finetune = finetune-15;
			me.sample.finetune = finetune;
			me.sample.finetuneX = finetune << 4;
		}
	};

	// in FT mode
	me.getPeriodForNote = function(noteIndex,withFineTune){
		var result = 0;

		if (Tracker.useLinearFrequency){
			result =  7680 - (noteIndex-1)*64;
			if (withFineTune) result -= me.getFineTune()/2;
		}else{
			result = FTNotes[noteIndex].period;
			if (withFineTune && me.getFineTune()){
				result = Audio.getFineTuneForNote(noteIndex,me.getFineTune());
			}
		}

		return result;
	};

	me.setSampleForNoteIndex = function(noteIndex){
		var sampleIndex = me.sampleNumberForNotes[noteIndex-1];
		if (sampleIndex !== me.sampleIndex && typeof sampleIndex === "number"){
			me.setSampleIndex(sampleIndex);
		}
	};

	me.setSampleIndex = function(index){
		if (me.sampleIndex !== index){
			me.sample = me.samples[index];
			me.sampleIndex = index;

			EventBus.trigger(EVENT.sampleIndexChange,me.instrumentIndex);
		}
	};

	me.hasSamples = function(){
		for (var i = 0, max = me.samples.length; i<max; i++){
			if (me.samples[i].length) return true;
		}
	};


	return me;
};