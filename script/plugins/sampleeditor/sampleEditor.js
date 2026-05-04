import SampleView from "./sampleView.js";

var SampleEditor = function(){
	var me = {
		name: "sampleeditor"
	};

	var host;
	var renderTarget;
	var sampleView;

	me.init = function(mapping){
		host = mapping;

		host.EventBus.trigger(host.EVENT.pluginRenderHook,{
			target: "pattern",
			view: "sample",
			setRenderTarget:function(element){
				renderTarget = element;

				if (!sampleView){
					sampleView = SampleView();
					sampleView.name = "sampleViewPanel";
				}

				renderTarget.children = [];
				renderTarget.addChild(sampleView);
				resize();
				sampleView.show();
				sampleView.refreshState();

				renderTarget.onResize = resize;
				renderTarget.onShow = function(){
					resize();
					sampleView.show();
					sampleView.refreshState();
				};
				renderTarget.onHide = function(){
					sampleView.hide();
					renderTarget.onResize = null;
					renderTarget.onShow = null;
					renderTarget.onHide = null;
					renderTarget = null;
				};
			}
		});
	};

	function resize(){
		if (!renderTarget || !sampleView) return;
		sampleView.setProperties({
			left: 0,
			top: 0,
			width: renderTarget.width,
			height: renderTarget.height
		});
	}

	return me;
}();

export default SampleEditor;
