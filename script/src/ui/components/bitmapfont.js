var BitmapFont = function(){
	var me = {};

	var charWidth;
	var widthArray = [];
	var charHeight;
	var charSpacing;
	var spaceWidth;
	var onlyUpperCase = false;
	var debug = false;


	function getCharWidth(index){
		if (me.fixedWidth) return charWidth;
		return charWidth[index];
	}

	me.generate = function(config){
		var img = config.image;
		var startX = config.startX;
		var startY = config.startY;
		charWidth = config.charWidth;
		var h = config.charHeight;
		spaceWidth = config.spaceWidth || 8;
		var margin = config.margin;
		var lineSpacing = config.lineSpacing || 0;
		var lineWidth = config.charsPerLine;
		var chars = config.chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		onlyUpperCase = config.onlyUpperCase;
		debug = !!config.debug;

		me.fontArray = [];
		me.colors = {};
		charSpacing = margin;
		charHeight = h;

		me.fixedWidth = true;
		me.charHeight = h;

		if (typeof charWidth !== "number"){
			me.fixedWidth = false;

			if (typeof charWidth === "string"){
				charWidth = charWidth.split("");
				charWidth.forEach(function(c,index){
					charWidth[index] = parseInt(c);
				})
			}
		}


		me.charWidth = charWidth;
		var _x = startX;
		var _y = startY;
		var _line = 0;
		var _lineIndex = 0;

		for (var i = 0, len = chars.length; i<=len; i++){
			var myCanvas = document.createElement("canvas");

			var w = getCharWidth(i) || 1;

			myCanvas.width = w;
			myCanvas.height = h;

			var myCtx = myCanvas.getContext("2d");

			if (me.fixedWidth){
				var x = startX + ((i % lineWidth) * (w+margin));
				var y = startY + (Math.floor(i / lineWidth) * (h+lineSpacing));
			}else{
				x = _x;
				y = _y;
				_x += (w+margin);
				_lineIndex++;

				if (_lineIndex>=lineWidth[_line]){
					_line++;
					_lineIndex = 0;
					_x = startX;
					_y += (charHeight + lineSpacing)
				}
			}

			myCtx.drawImage(img,x,y,w,h,0,0,w,h);

			var charCode = chars.charCodeAt(i);
			me.fontArray[charCode] = myCanvas;
			widthArray[charCode] = w;
		}
	};

	me.generateColor = function(colorName,color){

		colorName = colorName || "green";
		color = color || "rgba(107, 161, 65,0.9)";

		var fontArrayColor = [];

		me.fontArray.forEach(function(c,index){
			var c2 = document.createElement("canvas");
			var c3 = document.createElement("canvas");
			c2.width = c.width;
			c2.height = c.height;
			c3.width = c.width;
			c3.height = c.height;
			var cx2 = c2.getContext("2d");
			var cx3 = c3.getContext("2d");

			cx3.fillStyle = color;
			cx3.fillRect(0,0,16,16);

			cx3.globalCompositeOperation = "destination-atop";
			cx3.drawImage(c,0,0);

			cx2.drawImage(c3,0,0);
			cx2.globalCompositeOperation = "darken";
			cx2.drawImage(c,0,0);

			fontArrayColor[index] = c2;
		});
		me.colors[colorName] = fontArrayColor;
	};

	me.getTextWidth = function(text,spacing){
		if (onlyUpperCase) text = text.toUpperCase();
		spacing = spacing || charSpacing;
		var w = 0;

		for (var i = 0, len = text.length; i<len;i++){
			var code = text.charCodeAt(i);
			var _w = widthArray[code] || spaceWidth;
			w += _w + spacing;
		}

		return w;
	};

	me.write = function(canvasCtx,text,x,y,spacing,color){
		if (onlyUpperCase) text = text.toUpperCase();

		var colorArray = me.colors[color] || me.fontArray;

		spacing = spacing || charSpacing;
		x=x||0;
		y=y||0;
		var _x = x;

		for (var i = 0, len = text.length; i<len;i++){
			var code = text.charCodeAt(i);
			var c = colorArray[code];
			var w = widthArray[code];

			if (!w){
				if (code!==32) console.warn("no font for char " + code);
				w = spaceWidth;
			}

			if (c) canvasCtx.drawImage(c,_x,y,w,charHeight);

			_x += w + spacing;

		}
	};

	return me;
};