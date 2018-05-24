UI.ticker = (function(){
	// groups UI related timers

	var me = {};
	var onEachTick2,onEachTick4;
	var onEachTick2Delay,onEachTick4Delay;
	var onEachTick2Count,onEachTick4Count;
	var ticker2 = 0;
	var ticker4 = 0;
	var tickerActive = false;


	me.onEachTick2 = function(handler,delay){
		onEachTick2Count = 0;
		onEachTick2Delay = delay || 0;
		onEachTick2 = handler;
		tickerActive = onEachTick2 || onEachTick4;
	};

	me.onEachTick4 = function(handler,delay){
		onEachTick4Count = 0;
		onEachTick4Delay = delay || 0;
		onEachTick4 = handler;
		tickerActive = onEachTick2 || onEachTick4;
	};

	EventBus.on(EVENT.screenRefresh,function(){
		if (tickerActive){
			ticker2 = 1-ticker2;
			if (ticker2){
				ticker4 = 1-ticker4;
				if (onEachTick2) {
					onEachTick2Count++;
					if (onEachTick2Count>onEachTick2Delay) onEachTick2();
				}
				if (ticker4){
					if (onEachTick4) {
						onEachTick4Count++;
						if (onEachTick4Count>onEachTick4Delay) onEachTick4();
					}
				}
			}
		}

	});

	return me;
}());