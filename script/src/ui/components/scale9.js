UI.scale9Panel = function(x,y,w,h,base){
	var me = UI.element(x,y,w,h,true);
	me.type = "scale9";

	base.scale = base.scale || "stretch";

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

		if (typeof p.img !== "undefined") base.img=p.img;
		if (typeof p.scale !== "undefined") base.scale=p.scale;

		if (typeof p.imgTop !== "undefined") base.top=p.imgTop;
		if (typeof p.imgBottom !== "undefined") base.bottom=p.imgBottom;
		if (typeof p.imgLeft !== "undefined") base.left=p.imgLeft;
		if (typeof p.imgRight !== "undefined") base.right=p.imgRight;

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
			if (base.top && base.left) me.ctx.drawImage(img,0,0,base.left,base.top,0,0,base.left,base.top);

			// top
			if (base.top) me.ctx.drawImage(img,base.left,0,centerW,base.top,base.left,0,targetCenterW,base.top);

			// topright
			if (base.top && base.right) me.ctx.drawImage(img,base.left+centerW,0,base.right,base.top,base.left+targetCenterW,0,base.right,base.top);


			// midLeft
			if (base.left) me.ctx.drawImage(img,0,base.top,base.left,centerH,0,base.top,base.left,targetCenterH);

			// mid
			if (base.scale === "stretch"){
				me.ctx.drawImage(img,base.left,base.top,centerW,centerH,base.left,base.top,targetCenterW,targetCenterH);
			}


			if (base.scale === "repeatX"){
				var tx = base.left;
				var tMax = base.left+targetCenterW;
				var tw;

				// render first row
				while (tx<tMax){
					tw = centerW;
					if (tx+tw>tMax) tw = tMax-tx;
					me.ctx.drawImage(img,base.left,base.top,tw,centerH,tx,base.top,tw,centerH);
					tx+=tw;
				}

			}

            if (base.scale === "repeatY"){
                var ty = base.top;
                tMax = base.top+targetCenterH;
                var th;

                // render first col
                while (ty<tMax){
                    th = centerH;
                    if (ty+th>tMax) th = tMax-ty;
                    me.ctx.drawImage(img,base.left,base.top,centerW,th,base.left,ty,centerW,th);
                    ty+=th;
                }
            }


			// midRight
			if (base.right) me.ctx.drawImage(img,base.left+centerW,base.top,base.right,centerH,base.left+targetCenterW,base.top,base.right,targetCenterH);

			// bottomLeft
			if (base.bottom && base.left) me.ctx.drawImage(img,0,base.top+centerH,base.left,base.bottom,0,base.top+targetCenterH,base.left,base.bottom);

			// bottom
			if (base.bottom) me.ctx.drawImage(img,base.left,base.top+centerH,centerW,base.bottom,base.left,base.top+targetCenterH,targetCenterW,base.bottom);

			// bottomRight
			if (base.bottom && base.right) me.ctx.drawImage(img,base.left+centerW,base.top+centerH,base.right,base.bottom,base.left+targetCenterW,base.top+targetCenterH,base.right,base.bottom);

			//myCtx.drawImage(img,0,0);
		}
	};


	me.render = function(internal){

		internal = !!internal;
		if (!me.isVisible()) return;

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

    //if (base) me.setProperties(base);

	return me;
};