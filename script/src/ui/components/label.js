UI.label = function(initialProperties){
	var me = UI.element();
	me.type = "label";

	var label = "";
	var font;
	var textAlign = "left";
	var paddingTop = 0;

	var properties = ["left","top","width","height","name","font","label","textAlign","paddingTop"];

	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined"){
				// set internal var
				switch(key){
					case "label": label=p[key];break;
					case "font": font=p[key];break;
					case "textAlign": textAlign=p[key];break;
					case "paddingTop": paddingTop=parseInt(p[key]);break;
					default:
						me[key] = p[key];
				}
			}
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

	};

	me.setFont = function(f){
		font = f;
		me.refresh();
	};

	me.setLabel = function(text){
		label = text;
		me.refresh();
	};

	me.render = function(internal){
		if (me.needsRendering){
			internal = !!internal;

			me.clearCanvas();

			if (label){
				var fontSize = 10;
				var fontWidth = 8; // TODO: get from font
				var textY = Math.floor((me.height-fontSize)/2) + paddingTop;
				var textX = 10;
				if (font){
					var textLength;
					if (textAlign == "center"){
						textLength = label.length * fontWidth;
						textX = Math.floor((me.width - textLength)/2);
					}
					if (textAlign == "right"){
						textLength = label.length * fontWidth;
						textX = Math.floor(me.width - textLength) - 10;
					}
					font.write(me.ctx,label,textX,textY,0);
				}else{
					me.ctx.fillStyle = "white";
					me.ctx.fillText(label,textX,textY);
				}
			}

		}
		me.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}
	};

	if (initialProperties) me.setProperties(initialProperties);

	return me;
};