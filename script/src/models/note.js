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
			me.period = ftNote.period;
		}else{300
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


	return me;
};