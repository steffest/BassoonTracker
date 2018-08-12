var Sample = function(){
	var me = {};

	me.data = [];
	me.length = 0;
	me.name = "";
	me.bits = 8;

	me.volume = 0;
	me.finetune = 0;
	me.finetuneX = 0;

    me.loop = {
        enabled: false,
        start: 0,
        length: 0,
        type: 0
    };


	return me;
};