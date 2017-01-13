UI.radioGroup = function(x,y,w,h){
	var me = UI.element(x,y,w,h,true);

	var items = [];

	var lineHeight = 13;
	var startY = 5;

	var properties = ["left","top","width","height","name","type"];

	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

	};

	me.onclick=function(e){
		//TODO: make generic
		if (me.eventY<16){
			Tracker.setPlayType(PLAYTYPE.song);
		}else{
			Tracker.setPlayType(PLAYTYPE.pattern);
		}
	};

	//TODO: make generic
	EventBus.on(EVENT.playTypeChange,function(event,playType){
		if (playType == PLAYTYPE.song){
			activateItem(0);
		}else{
			activateItem(1);
		}
	});

	function activateItem(index){
		for (var i = 0, len = items.length; i<len;i++){
			items[i].active = i == index;
		}
		me.refresh();
	}

	me.render = function(internal){
		internal = !!internal;

		if (this.needsRendering){

			me.clearCanvas();

			var buttonActive = cachedAssets.images["skin/radio_active.png"];
			var buttonInactive = cachedAssets.images["skin/radio_inactive.png"];

			for (var i = 0, len = items.length;i<len;i++){
				var item = items[i];
				var textX = 5;
				var textY = startY + (i*lineHeight);

				if (fontSmall) fontSmall.write(me.ctx,item.label,textX,textY,0);

				var buttonX = me.width - 15;
				if (item.active){
					me.ctx.drawImage(buttonActive,buttonX,textY - 3);
				}else{
					me.ctx.drawImage(buttonInactive,buttonX,textY - 3);
				}



			}

		}
		this.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};

	me.setItems = function(newItems){
		items = newItems;
		me.refresh();
	};

	me.getItemAtPosition = function(x,y){
		y = y-startY;
		var index = Math.floor(y/lineHeight) + visibleIndex;
		if (index>=0 && index<items.length){
			items[index].index = index;
			return(items[index]);
		}else{
			return undefined;
		}
	};

	return me;
};