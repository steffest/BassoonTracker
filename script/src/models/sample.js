var Sample = function(){
	var me = {};

	me.data = [];
	me.length = 0;
	me.name = "";
	me.bits = 8;

	me.volume = 64;
	me.finetune = 0;
	me.finetuneX = 0;
	me.panning = 0;
	me.relativeNote = 0;

    me.loop = {
        enabled: false,
        start: 0,
        length: 0,
        type: 0
    };

	me.check = function(){
		var min = 0;
		var max = 0;
		for (var i = 0, len = me.data.length; i<len; i++){
			min = Math.min(min,me.data[i]);
			max = Math.max(max,me.data[i]);
		}
		return {min: min, max: max};
	};


	return me;
};