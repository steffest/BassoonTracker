import Panel from "./panel.js";
import Assets from "../assets.js";

let collapsePanel = function(properties){
	var me = Panel(0,0,20,20);
	properties = properties || {};

	me.setProperties({
		background: Assets.buttonDarkBlueScale9,
		font: window.fontFT,
		label: properties.label || ""
	});

	

	return me;
};

export default collapsePanel;