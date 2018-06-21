var Instrument = function(){
	var me = {};

	me.type = "sample";
	me.name = "";
	me.sampleIndex = 0;
	me.finetune = 0;
	me.finetuneX = 0;
	me.relativeNote = 0;
	me.volume = 100;
	me.data = [];
	me.samples = [Sample()];
	me.sample = me.samples[0];

	me.volumeEnvelope = {raw: [], enabled: false};
	me.panningEnvelope = {raw: [], enabled: false};
	me.vibrato = {};
	me.sampleNumberForNotes = [];
	me.loopStart = 0;
	me.loopRepeatLength = 0;

	me.play = function(noteIndex,notePeriod,volume,track,trackEffects,time){
		return Audio.playSample(me.sampleIndex,notePeriod,volume,track,trackEffects,time,noteIndex);
	};

	me.noteOn = function(time){
		var tickTime = Tracker.getProperties().tickTime;
		var volumeEnvelope = Audio.context.createGain();

		// volume envelope to time ramp
		var maxPoint = me.volumeEnvelope.sustain ? me.volumeEnvelope.sustainPoint+1 :  me.volumeEnvelope.count;
		volumeEnvelope.gain.setValueAtTime(me.volumeEnvelope.points[0][1]/64,time);
		for (var p = 1; p<maxPoint;p++){
			var point = me.volumeEnvelope.points[p];
			volumeEnvelope.gain.linearRampToValueAtTime(point[1]/64,time + (point[0]*tickTime));
		}

		return volumeEnvelope;
	};

	me.noteOff = function(time,noteInfo){
		console.error(noteInfo);

		if (noteInfo.isKey && noteInfo.volume){
			noteInfo.volume.gain.linearRampToValueAtTime(0,time + 0.5)
		}else{
			if (Tracker.inFTMode()){
				var tickTime = Tracker.getProperties().tickTime;

				if (me.volumeEnvelope.enabled && me.volumeEnvelope.sustain && noteInfo.volumeEnvelope){
					var timeOffset = 0;
					var startPoint = me.volumeEnvelope.points[me.volumeEnvelope.sustainPoint];
					if (startPoint) timeOffset = startPoint[0]*tickTime;
					for (var p = me.volumeEnvelope.sustainPoint; p< me.volumeEnvelope.count;p++){
						var point = me.volumeEnvelope.points[p];
						noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(point[1]/64,time + (point[0]*tickTime) - timeOffset);
					}
				}

				if (me.fadeout){
					var fadeOutTime = (65536/me.fadeout) * tickTime;
					//TODO: this should be a separate gain control as volume commands after key off still have effect.
					noteInfo.volume.gain.linearRampToValueAtTime(0,time + fadeOutTime);
				}


				return 100;
			}else{
				return 0;
			}
		}
	};

	me.getFineTune = function(){
		return Tracker.inFTMode() ? me.finetuneX : me.finetune;
	};

	me.setFineTune = function(finetune){
		if (Tracker.inFTMode()){
			me.finetuneX = finetune;
			me.finetune = finetune >> 4;
		}else{
			me.finetune = finetune;
			me.finetuneX = finetune << 4;
		}
	};

	return me;
};