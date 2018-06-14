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

	me.noteOff = function(track,time){
		if (me.volumeEnvelope){
			console.log("noteOff");
			return 50;
		}else{
			//Tracker.cutNote(track,time);
			return 0;
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