UI.scale9Panel = function(x,y,w,h,base){
	var me = UI.element(x,y,w,h,true);
	me.type = "scale9";

	me.setProperties = function(p){

		var properties = ["left","top","width","height","name","type"];

		if (!p){
			var result = {};
			properties.forEach(function(key){
				result[key] = me[key];
			});
			return result;
		}

		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

	};

	var createCanvas = function(){
		var img = base.img;

		if (img){
			var centerW = img.width-base.left-base.right;
			var centerH = img.height-base.top-base.bottom;

			var targetCenterW = me.width-base.left-base.right;
			var targetCenterH = me.height-base.top-base.bottom;

			me.clearCanvas();

			// topleft
			me.ctx.drawImage(img,0,0,base.left,base.top,0,0,base.left,base.top);

			// top
			me.ctx.drawImage(img,base.left,0,centerW,base.top,base.left,0,targetCenterW,base.top);

			// topright
			me.ctx.drawImage(img,base.left+centerW,0,base.right,base.top,base.left+targetCenterW,0,base.right,base.top);

			// midLeft
			me.ctx.drawImage(img,0,base.top,base.left,centerH,0,base.top,base.left,targetCenterH);

			// mid
			me.ctx.drawImage(img,base.left,base.top,centerW,centerH,base.left,base.top,targetCenterW,targetCenterH);

			// midRight
			me.ctx.drawImage(img,base.left+centerW,base.top,base.right,centerH,base.left+targetCenterW,base.top,base.right,targetCenterH);

			// bottomLeft
			me.ctx.drawImage(img,0,base.top+centerH,base.left,base.bottom,0,base.top+targetCenterH,base.left,base.bottom);

			// bottom
			me.ctx.drawImage(img,base.left,base.top+centerH,centerW,base.bottom,base.left,base.top+targetCenterH,targetCenterW,base.bottom);

			// bottom
			me.ctx.drawImage(img,base.left+centerW,base.top+centerH,base.right,base.bottom,base.left+targetCenterW,base.top+targetCenterH,base.right,base.bottom);

			//myCtx.drawImage(img,0,0);
		}
	};


	me.render = function(internal){

		internal = !!internal;
		if (me.needsRendering){
			createCanvas();
		}
		me.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top);
		}
	};

	return me;
};