var Instrument = function(){
	var me = {};

	me.type = "sample";
	me.sampleIndex = 0;
	me.finetune = 0;
	me.relativeNote = 0;
	me.data = [];
	me.samples = [Sample()];
	me.sample = me.samples[0];

	me.volumeEnvelope = undefined;
	me.panningEnvelope = undefined;

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

	return me;
};