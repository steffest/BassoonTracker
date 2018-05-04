UI.zoomgrid = function(x,y,w,h){
	var me = UI.element(x,y,w,h,true);

	var properties = ["left","top","width","height","name"];

	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

	};

	me.scaleX = 1;
	me.scaleY = 1;

	me.scrollOffsetX = 0;
	me.scrollOffsetY = 0;
	var startScrollOffsetX = 0;

	var panels = [];
	for (var i = 0; i<10; i++){
		var left = i*30;
		panels[i] = UI.panel(left,10,20,10);
		panels[i].setProperties({backgroundColor : "yellow"});
		panels[i].onMouseWheel = function(touchData){
			console.log("panel on mouse wheel");
			me.onMouseWheel(touchData);
		};
		panels[i].onDragStart = function(touchData){
			this.startLeft = this.left;
		};
		panels[i].onDrag = function(touchData){
			var deltaX =  (touchData.dragX - touchData.startX) / me.scaleX;
			this.left = this.startLeft + deltaX;
			this.refresh();
		};
		me.addChild(panels[i]);
	}


	me.render = function(internal){

		internal = !!internal;
		if (!me.isVisible()) return;

		if (this.needsRendering){
			console.error("render zoomgrid");
			me.clearCanvas();

			panels.forEach(function(panel){
				var c = panel.render(true);
				var x = (panel.left * me.scaleX) + me.scrollOffsetX;
				var w = panel.width * me.scaleX;

				me.ctx.drawImage(c,x,panel.top,w,panel.height);

			});


		}
		this.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};



	me.onMouseWheel = function(touchData){
		if (touchData.mouseWheels[0] > 0){
			me.scaleX += 0.1;
			//console.error("zoombox zoom in");
		}else{
			me.scaleX -= 0.1;
			if (me.scaleX<0.2) me.scaleX = 0.2;
			//console.error("zoombox zoom out");
		}

		console.log(me.scaleX);
		me.refresh();
	};

	me.onDragStart = function(touchData){
		console.error("zoomgrid drag start");
		startScrollOffsetX = me.scrollOffsetX;
	};

	me.onTouchUp = function(touchData){
		//dragX = 0;
	};

	me.onDrag = function(touchData){
		var deltaX =  (touchData.dragX - touchData.startX);
		me.scrollOffsetX = startScrollOffsetX + deltaX;
		console.log(me.scrollOffsetX);
		me.refresh();
	};

	return me;
};