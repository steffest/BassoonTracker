UI.radioGroup = function(x,y,w,h){
	var me = UI.element(x,y,w,h,true);

	var items = [];

	var previousSelectedIndex;

	var startY = 0;
	var size = "small";
	var align = "right";
	var buttonY = -3;
	var itemHeight = 13;
	var divider;
	var type="radio";
	var highLightSelection;

	var properties = ["left","top","width","height","name"];

	me.setProperties = function(p){
		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

		if (p.align) align = p.align;
		if (p.size) size = p.size;
		if (p.divider) divider = p.divider;
		if (p.type) type = p.type;
		if (p.highLightSelection) highLightSelection = true;
	};

	me.onClick=function(e){
		me.setSelectedIndex(Math.floor((me.eventY-startY+buttonY)/itemHeight));
	};

	me.setSelectedIndex = function(index,internal){
		index = Math.min(index,items.length-1);
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

	me.getSelectedItem = function(){
		return items[me.selectedIndex];
	};

	me.render = function(internal){
		internal = !!internal;
		if (!me.isVisible()) return;

		if (this.needsRendering){

			me.clearCanvas();

			var buttonActive = Y.getImage("radio_active");
			var buttonInactive = Y.getImage("radio_inactive");
			itemHeight = Math.floor(me.height / items.length);

			var font = fontSmall;
			var textX = 5;
			var buttonX = me.width - 15;
			buttonY = -3;

			if (size === "med"){
				buttonActive = Y.getImage("radio_big_active");
				buttonInactive = Y.getImage("radio_big_inactive");
				buttonY = -2;
				buttonX = me.width - 20;
				font = fontMed;
			}

			var paddingTop = Math.floor((itemHeight - font.charHeight) / 2);

			if (align === "left"){
				textX = 30;
				buttonX = 5;
			}


			var line = Y.getImage("line_hor");

			for (var i = 0, len = items.length;i<len;i++){
				var item = items[i];
				var itemTop = startY + (i*itemHeight);
				var textTop = itemTop + paddingTop;

				if (divider == "line" && i>0){
					me.ctx.drawImage(line,0,itemTop,me.width,2);
				}

				if (font){
					var label = item.label;
					if (align === "right"){
						textX = buttonX - font.getTextWidth(item.label,0) - 4;
						if (textX<0 && item.labels){
							var rest = buttonX - 4;
							item.labels.forEach(function(lb){
								if (lb.width<=rest) label = lb.label;
							});
							textX = buttonX - font.getTextWidth(label,0) - 4;
						}
					}

					font.write(me.ctx,label,textX,textTop,0);
				}

				if (item.active){

					if (highLightSelection){
						me.ctx.fillStyle = 'rgba(100,100,255,0.1';
						me.ctx.fillRect(0,itemTop,me.width-2,itemHeight);
					}

					me.ctx.drawImage(buttonActive,buttonX,textTop + buttonY);
				}else{
					me.ctx.drawImage(buttonInactive,buttonX,textTop + buttonY);
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
		var index = Math.floor(y/itemHeight) + visibleIndex;
		if (index>=0 && index<items.length){
			items[index].index = index;
			return(items[index]);
		}else{
			return undefined;
		}
	};

	return me;
};