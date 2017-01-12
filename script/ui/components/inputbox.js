UI.inputbox = function(initialProperties){
	var me = UI.element();
	var properties = ["left","top","width","height","name","type","onChange"];
	var value = "";

	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);
		background.setSize(me.width,me.height);

		if (p["value"]) value = p["value"]
	};


	var background = UI.scale9Panel(0,0,me.width,me.height,{
		img: cachedAssets.images["skin/panel_dark.png"],
		left:3,
		top:3,
		right:1,
		bottom: 1
	});
	background.ignoreEvents = true;
	me.addChild(background);

	if (initialProperties) me.setProperties(initialProperties);

	me.render = function(internal){
		internal = !!internal;

		if (this.needsRendering){
			background.render();

			if (value && fontMed){
				var textX = 10;
				var textY = 6;
				fontMed.write(me.ctx,value,textX,textY,0);
			}

		}
		this.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};

	me.setValue = function(newValue,internal){
		value = newValue;
		me.refresh();
		if (!internal && me.onChange) me.onChange(value);
	};
	me.getValue = function(){
		return value;
	};

	me.getItemAtPosition = function(x,y){
		y = y-startY;
		var index = Math.floor(y/lineHeight) + visibleIndex;
		if (index>=0 && index<items.length){
			return(items[index]);
		}else{
			return undefined;
		}
	};

	return me;
};