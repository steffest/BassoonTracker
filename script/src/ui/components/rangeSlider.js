UI.rangeSlider = function(initialProperties){
	var me = UI.element();

	me.type = "rangeslider";
	var properties = ["left","top","width","height","name","onChange"];

	var knob = Y.getImage("slider_knob");
	var knobVert = Y.getImage("slider_knob_vert");
	var backImage = Y.getImage("slider_back");
	var backImageVert = Y.getImage("slider_back_vert");
    var vertical = false;
    var maxHeight = 0;

	var back = UI.scale9Panel(0,0,0,0,{
		img: backImage,
		left: 4,
		right: 4,
		top: 0,
		bottom: 0,
		scale: "repeatX"
	});
	me.addChild(back);
	back.ignoreEvents = true;

	var knobLeft = 0;
	var knobTop = 0;
	var startKnobLeft = 0;
	var startKnobTop = 0;

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
		if (typeof p.vertical !== "undefined")  {
			vertical = !!p.vertical;

            back.setProperties({
                img: backImageVert,
                imgLeft: 0,
                imgRight: 0,
                imgTop: 4,
                imgBottom: 4,
                scale: "repeatY"
            });

        }
	};

	me.getValue = function(){
		return value;
	};

	me.setValue = function(v,internal){

		if (v>max) v = max;
		if (v<min) v=min;

		var hasChanged = !internal && value!==v;
		value = v;

		if (vertical){
			var relMax = max - min;
			knobTop = maxHeight * (1 - (v-min)/relMax);
		}else{
			var maxWidth = me.width-knob.width;
			knobLeft = maxWidth * v/max;
		}

		me.refresh();

		if (hasChanged && !internal){
			if (me.onChange) me.onChange(value);
		}
	};

	me.setMax = function(newMax,skipCheck){
		max = newMax;
		if (!skipCheck && value>max) me.setValue(max);
	};
    me.setMin = function(newMin,skipCheck){
        min = newMin;
        if (!skipCheck && value<min) me.setValue(min);
    };


	me.render = function(internal){
		if (me.needsRendering){
			internal = !!internal;
			me.clearCanvas();

			var cx = Math.floor(me.width/2) + 3;
			var cw = 6;
			var ch = me.height;
			if (min<0) ch = Math.floor(ch/2);

			me.ctx.fillStyle = "rgba(255,255,255,0.1";

			me.ctx.beginPath();
			me.ctx.moveTo(cx, ch);
			me.ctx.lineTo(cx, 2);
			me.ctx.lineTo(cx+cw, 2);
			me.ctx.fill();

			if (min<0){
				me.ctx.beginPath();
				me.ctx.moveTo(cx-6,ch);
				me.ctx.lineTo(cx-6, me.height);
				me.ctx.lineTo(cx-6-cw, me.height);
				me.ctx.fill();
			}else{
				me.ctx.beginPath();
				me.ctx.moveTo(cx-6,ch);
				me.ctx.lineTo(cx-6, 2);
				me.ctx.lineTo(cx-6-cw, 2);
				me.ctx.fill();
			}

			back.render();
			if (vertical){
                me.ctx.drawImage(knobVert,-1,knobTop,knobVert.width,knobVert.height);
			}else{
                me.ctx.drawImage(knob,knobLeft,-1,knob.width,knob.height);
			}
		}
		me.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}
	};

	me.onResize = function(){

		maxHeight = me.height-knobVert.height+3;

		back.setSize(me.width,me.height);
		me.setValue(value,true);
	};

	me.onDragStart = function(){
		startKnobLeft = knobLeft;
        startKnobTop = knobTop;
	};

	me.onDrag=function(touchData){
		if(vertical){
            var delta =  touchData.deltaY;
            knobTop = startKnobTop + delta;
            if (knobTop<0) knobTop=0;

            if (knobTop> maxHeight) knobTop=maxHeight;

            if (maxHeight>knob.height){
            	var relMax = max - min;
            	var relValue = relMax - (Math.round(relMax * knobTop/maxHeight));
                value = relValue + min;
            }else{
                value = max;
            }

		}else{
            delta =  touchData.deltaX;
            knobLeft = startKnobLeft + delta;
            if (knobLeft<0) knobLeft=0;

            var maxWidth = me.width-knob.width;
            if (knobLeft> maxWidth) knobLeft=maxWidth;

            if (maxWidth>knob.width){
                value = Math.round(max * knobLeft/maxWidth);
            }else{
                value = 0;
            }
		}

		me.refresh();
		if (me.onChange) me.onChange(value);
	};


	if (initialProperties) me.setProperties(initialProperties);


	return me;
};


