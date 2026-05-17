import SampleView from "./sampleView.js";

function setProps(target, props){
	if (!target || !props) return;

	const hasLayout = (
		props.left !== undefined || props.top !== undefined ||
		props.width !== undefined || props.height !== undefined ||
		props.visible !== undefined
	);

	if (hasLayout && typeof target.setDimensions === "function"){
		target.setDimensions({
			left: props.left,
			top: props.top,
			width: props.width,
			height: props.height,
			visible: props.visible
		});
	}

	if (props.active !== undefined && target.isActive !== undefined) target.isActive = !!props.active;
	if (props.disabled !== undefined && target.isDisabled !== undefined) target.isDisabled = !!props.disabled;

	for (const [key, value] of Object.entries(props)){
		if (key === "left" || key === "top" || key === "width" || key === "height" || key === "visible" || key === "active" || key === "disabled") continue;
		target[key] = value;
	}
}

var SampleEditor = function(){
	var me = {
		name: "sampleeditor"
	};

	var host;
	var renderTarget;
	var sampleView;

	me.init = function(mapping){
		host = mapping.UI || mapping;

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
		setProps(sampleView, {
			left: 0,
			top: 0,
			width: renderTarget.width,
			height: renderTarget.height
		});
	}

	return me;
}();

export default SampleEditor;
