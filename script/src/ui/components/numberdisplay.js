UI.numberDisplay = function(x,y,w,h,value){
    var me = UI.element(x,y,w,h);
    me.type = "numberDisplay";
    me.isActive = false;

    var value = value || 0;
	var padLength = 4;
	var padChar = " ";
	var padding = 2;

    var properties = ["left","top","width","height","name","value"];

    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined"){
                switch(key){
                    case "value": value=p[key];break;
                    default:
                        me[key] = p[key];
                }
            }
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

    };

    me.setValue = function(val){
        value = val;
        me.refresh();
    };


	me.setDisabled = function(state){
		if (typeof state == "undefined") state=true;
		me.isDisabled = state;
		if (state) me.isActive = false;
		me.refresh();
	};

	me.onResize = function(){
        padLength = Math.floor(me.width/9) - 1;
    };

    me.render = function(internal){
        if (!me.isVisible()) return;
        if (me.needsRendering){
            internal = !!internal;
            me.ctx.clearRect(0,0,me.width,me.height);

			var valueX = padding;
			var valueY = padding;
			var w = me.width - (padding*2);
			var h = me.height - (padding*2);
			me.ctx.drawImage(Y.getImage("panel_inset_dark"),valueX,valueY,w,h);
			valueX +=4;
			valueY = 7;
			window.fontLed.write(me.ctx,padValue(),valueX,valueY,0);


            if (me.isDisabled){
				me.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
				me.ctx.fillRect(0,0,me.width,me.height);
            }

			if (me.renderInternal) me.renderInternal();
        }

        me.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }
    };

	function padValue(){
		var result = "" + value;
		while (result.length < padLength){
			result = padChar + result;
		}
		return result;
	}

    return me;
};