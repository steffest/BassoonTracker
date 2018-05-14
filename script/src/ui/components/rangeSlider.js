UI.rangeSlider = function(initialProperties){
	var me = UI.element();

	me.type = "rangeslider";
	var properties = ["left","top","width","height","name","onChange"];

	var knob = Y.getImage("slider_knob");
	var backImage = Y.getImage("slider_back");

	var back = UI.scale9Panel(0,0,0,0,{
		img: backImage,
		left: 4,
		right: 4,
		top: 0,
		bottom: 0,
		scale: "repeat"
	});
	me.addChild(back);
	back.ignoreEvents = true;

	var knobLeft = 0;
	var startKnobLeft = 0;

	var min = 0;
	var max = 100;
	var value = 0;

	me.setProperties = function(p){
		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

		if (typeof p.min !== "undefined") min=p.min;
		if (typeof p.max !== "undefined") max=p.max;
		if (typeof p.value !== "undefined") me.setValue(p.value,true);

	};

	me.getValue = function(){
		return value;
	};

	me.setValue = function(v,internal){

		if (v>max) v = max;
		if (v<min) v=min;

		var hasChanged = !internal && value!==v;
		value = v;

		var maxWidth = me.width-knob.width;
		knobLeft = maxWidth * v/max;
		me.refresh();

		if (hasChanged){
			if (me.onChange) me.onChange(value);
		}
	};


	me.render = function(internal){
		if (me.needsRendering){
			internal = !!internal;
			me.clearCanvas();
			back.render();
			me.ctx.drawImage(knob,knobLeft,-1,knob.width,knob.height);
		}
		me.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}
	};

	me.onResize = function(){
		back.setSize(me.width,me.height);
		me.setValue(value,true);
	};

	me.onDragStart = function(){
		startKnobLeft = knobLeft;
	};

	me.onDrag=function(touchData){
		var delta =  touchData.dragX - touchData.startX;
		knobLeft = startKnobLeft + delta;
		if (knobLeft<0) knobLeft=0;

		var maxWidth = me.width-knob.width;
		if (knobLeft> maxWidth) knobLeft=maxWidth;

		if (maxWidth>knob.width){
			value = Math.round(max * knobLeft/maxWidth);
		}else{
			value = 0;
		}

		me.refresh();
		if (me.onChange) me.onChange(value);
	};


	if (initialProperties) me.setProperties(initialProperties);


	return me;
};


