UI.scrollbox = function(x,y,w,h){
	var me = UI.element(x,y,w,h,true);

	var properties = ["left","top","width","height","name"];

	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

	};



	var scrollBar = UI.panel(w-28,18,16,h-3);
	scrollBar.setProperties({backgroundColor : "green"});

	scrollBar.onDragStart=function(){
		console.log("drag start");

	};

	scrollBar.onDrag=function(touchData){
		var delta =  touchData.dragY - touchData.startY;
		//setScrollBarPosition();
	};

	me.addChild(scrollBar);



	me.render = function(internal){

		internal = !!internal;
		if (!me.isVisible()) return;

		if (this.needsRendering){
			console.error("render scrollBar");
			scrollBar.render();
		}
		this.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};




	function setScrollBarPosition(){




		scrollBar.setProperties({
			left: me.width - 18,
			top: top,
			width: 16,
			height: height
		});
	}


	me.onMouseWheel = function(touchData){
		if (touchData.mouseWheels[0] > 0){

		}else{

		}
	};

	me.onDragStart = function(touchData){
		console.error("scroll panel drag start");
	};

	me.onDrag = function(touchData){
		var delta =  Math.round((touchData.dragY - touchData.startY)/lineHeight);

	};

	return me;
};