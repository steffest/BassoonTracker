UI.checkbox = function(x,y,w,h){

	w = w || 14;
	h = h || 14;

	var me = UI.element(x,y,w,h,true);

	var properties = ["left","top","width","height","name","type","checked"];

	me.setProperties = function(p){
		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

	};

	me.setState = function(checked,internal){
		me.checked = checked;
		me.refresh();
		if (me.onToggle && !internal) me.onToggle(me.checked);
	};

	me.onClick=function(e){
		me.setState(!me.checked);
	};

	me.check = function(){
		me.setState(true);
	};
	me.unCheck = function(){
		me.setState(false);
	};
	me.toggle = function(){
        me.setState(!me.checked);
	};

	me.render = function(internal){
		internal = !!internal;
		if (!me.isVisible()) return;

		if (this.needsRendering){

			me.clearCanvas();

			var stateImage = me.checked ? Y.getImage("checkbox_on") : Y.getImage("checkbox_off");
			me.ctx.drawImage(stateImage,0,0);

		}
		this.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};

	return me;
};