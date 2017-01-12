var BitmapFont = function(){
	var me = {};

	var charWidth;
	var charHeight;
	var charSpacing;
	var onlyUpperCase = false;

	me.generate = function(config){
		var img = config.image;
		var startX = config.startX;
		var startY = config.startY;
		var w = config.charWidth;
		var h = config.charHeight;
		var margin = config.margin;
		var lineSpacing = config.lineSpacing || 0;
		var lineWidth = config.charsPerLine;
		var chars = config.chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		onlyUpperCase = config.onlyUpperCase;

		me.fontArray = [];
		me.colors = {};
		charSpacing = margin;
		charWidth = w;
		charHeight = h;

		me.charWidth = w;

		for (var i = 0, len = chars.length; i<=len; i++){
			var myCanvas = document.createElement("canvas");

			myCanvas.width = w;
			myCanvas.height = h;

			var myCtx = myCanvas.getContext("2d");

			var x = startX + ((i % lineWidth) * (w+margin));
			var y = startY + (Math.floor(i / lineWidth) * (h+lineSpacing));

			myCtx.drawImage(img,x,y,w,h,0,0,w,h);

			var charCode = chars.charCodeAt(i);
			me.fontArray[charCode] = myCanvas;
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

			if (c){
				canvasCtx.drawImage(c,_x,y,charWidth,charHeight);
			}else{

			}
			_x += charWidth + spacing;

		}
	};

	return me;
};