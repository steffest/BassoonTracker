UI.radioGroup = function(x,y,w,h){
	var me = UI.element(x,y,w,h,true);

	var items = [];

	var previousSelectedIndex;

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

	me.onClick=function(e){
		me.setSelectedIndex(Math.round(me.eventY/16));
	};

	me.setSelectedIndex = function(index,internal){
		for (var i = 0, len = items.length; i<len;i++){
			items[i].active = i == index;
		}
		me.selectedIndex = index;
		me.refresh();

		if (!internal && me.onChange && previousSelectedIndex!=me.selectedIndex) me.onChange(me.selectedIndex);
		previousSelectedIndex = me.selectedIndex;
	};

	me.getSelectedIndex = function(){
		return me.selectedIndex;
	};

	me.render = function(internal){
		internal = !!internal;

		if (this.needsRendering){

			me.clearCanvas();

			var buttonActive = Y.getImage("radio_active");
			var buttonInactive = Y.getImage("radio_inactive");

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
		me.selectedIndex = undefined;
		items = newItems;
		for (var i = 0, len = items.length; i<len;i++){
			if (items[i].active) me.selectedIndex = i;
		}

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