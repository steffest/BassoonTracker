UI.panel = function(x,y,w,h){
	var me = UI.element(x,y,w,h);
	me.type = "panel";
	var properties = ["left","top","width","height","name","type","zIndex","backgroundColor","borderColor"];

	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

		if (me.setLayout) me.setLayout(me.left,me.top,me.width, me.height);
	};

	me.render = function(internal){
		
		if (!me.isVisible()) return;
		internal = !!internal;

		if (this.needsRendering){
			
			if (me.renderOverride){
				me.renderOverride();
			}else{
				me.clearCanvas();

				if (me.backgroundColor){
					me.ctx.fillStyle = me.backgroundColor;
					me.ctx.fillRect(0,0,me.width,me.height);
				}
				if (me.borderColor){
					me.ctx.fillStyle = me.borderColor;
					me.ctx.rect(0,0,me.width,me.height);
					me.ctx.stroke();
				}

				this.children.forEach(function(elm){
					elm.render();
				});

				if (me.renderInternal) me.renderInternal();
			}
		}
		
		this.needsRendering = false;
		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}
	};

	me.onClick=function(){

	};

	me.sortZIndex = function(){
		// sort reverse order as children are rendered bottom to top;
		this.children.sort(function(a, b){
			return a.zIndex == b.zIndex ? 0 : (a.zIndex > b.zIndex) || -1;
		});
	};


	return me;
};