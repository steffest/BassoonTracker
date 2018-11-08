var Note = function(){
	var me = {};

	me.period = 0;
	me.index = 0;
	me.effect = 0;
	me.instrument = 0;
	me.param = 0;
	me.volumeEffect = 0;


	me.setPeriod = function(period){
		me.period = period;
		me.index = FTPeriods[period] || 0;
	};

	me.setIndex = function(index){
		me.index = index;
		var ftNote = FTNotes[index];
		if (ftNote){
			me.period = ftNote.modPeriod || ftNote.period;
			if (me.period === 1) me.period = 0;
		}else{
			console.warn("No note for index " + index);
			me.period = 0;
		}
	};

	me.clear = function(){
		me.instrument = 0;
		me.period = 0;
		me.effect = 0;
		me.param = 0;
		me.index = 0;
		me.volumeEffect = 0;
	};

	me.duplicate = function(){
		return {
			instrument: me.instrument,
			period : me.period,
			effect: me.effect,
			param: me.param,
			volumeEffect: me.volumeEffect,
			note: me.index
		}
	};

	me.populate = function(data){
			me.instrument = data.instrument || 0;
			me.period = data.period|| 0;
			me.effect = data.effect || 0;
			me.param = data.param || 0;
			me.volumeEffect =  data.volumeEffect || 0;
			me.index =  data.note || data.index || 0;
	};


	return me;
};