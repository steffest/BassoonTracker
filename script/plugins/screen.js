var canvas;
var ctx;

var UI = function(){

	var me = {};

	var maxWidth = 960;
	var children = [];
	var modalElement;

	me.needsRendering =  true;
	var maxRenderTime = 0;
	var skipRenderSteps = 0;
	var renderStep = 0;
	var renderTime = 0;

	var panel;


	me.init = function(){
		canvas = document.getElementById("canvas");
		ctx = canvas.getContext("2d");

		me.ctx = ctx;
		me.visible = true;

		var w = window.innerWidth;
		if (w>maxWidth) w=maxWidth;
		canvas.width = w;
		canvas.height = window.innerHeight;

		ctx.fillStyle = "black";
		ctx.fillRect(0,0,canvas.width,canvas.height);


		panel = UI.panel(10,10,300,300);
		panel.setProperties({
			backgroundColor : "blue"
		});
		me.addChild(panel);
		window.panel = panel;
		
		render();
	};

	me.addChild = function(elm){
		elm.setParent(me);
		elm.zIndex = elm.zIndex || children.length;
		children.push(elm);
	};

	me.refresh = function(){
		me.needsRendering = true;
	};

	me.showPlugin = function(name,container){
		name = name || "SampleEditor";
		container = container || panel;

		var plugin = PluginLoader.get(name);
		if (plugin.loaded){
			console.log("OK");
			show();
		}else{
			console.error("plugin not ready");
			plugin.onLoad = function(){
				container.addChild(plugin);
				console.log("plugin added");
				if (plugin.init) plugin.init();
				show();
			}
		}

		function show(){
			console.log("show");
			plugin.show(true);
		}
	};


	var render = function(time){
		var doRender = true;

		if (skipRenderSteps){
			renderStep++;
			doRender = (renderStep>skipRenderSteps);
		}
		if(doRender){
			renderStep = 0;
			var startRenderTime = 0;
			//EventBus.trigger(EVENT.screenRefresh);

			if (me.needsRendering){
				ctx.fillStyle = "black";
				ctx.fillRect(0,0,canvas.width,canvas.height);

				console.log("render");

				children.forEach(function(element){
					element.render();
				});

				me.needsRendering = false;

			}
		}
		window.requestAnimationFrame(render);
	};

	me.getChildren = function(){
		return children;
	};

	me.getEventElement = function(x,y){
		var target = undefined;
		for (var i = 0, len = children.length; i<len; i++){
			var elm = children[i];
			if (elm.isVisible() && elm.containsPoint(x,y)){
				target = elm;
				break;
			}
		}

		if (target && target.children && target.children.length){
			target = target.getElementAtPoint(x,y);
		}
		return target;
	};

	me.getModalElement = function(){
		return modalElement;
	};


	return me;
}();