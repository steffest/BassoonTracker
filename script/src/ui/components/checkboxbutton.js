import Button from "./button.js";
import Assets from "../assets.js";
import Y from "../yascal/yascal.js";

let checkboxbutton = function(properties){
	var me = Button(0,0,20,20);
	properties = properties || {};

	let props = {
		isActive:false,
		textAlign: "left",
		paddingLeft: typeof properties.paddingLeft === "number" ?  properties.paddingLeft : 30,
		font: properties.font || window.fontFT,
		label: properties.label || "",
		labels: properties.labels || undefined,
		checkbox:  properties.checkbox || false
	}

	if (!properties.transparent){
		props.background =  properties.background || Assets.buttonDarkBlueScale9;
		props.hoverBackground = properties.hoverBackground || Assets.buttonDarkBlueActiveScale9;
		props.activeBackground = properties.activeBackground || Assets.buttonDarkBlueActiveScale9;
	}

	me.setProperties(props);


	me.renderInternal = function(){
		if (me.checkbox){
			var stateImage = me.isActive ? Y.getImage("checkbox_on") : Y.getImage("checkbox_off");
			var margin = 7;
		}else{
			stateImage = me.isActive ? Y.getImage("radio_active") : Y.getImage("radio_inactive");
			margin = 5;
		}
		
		me.ctx.drawImage(stateImage,8,Math.floor(me.height/2)-margin);
	};

	me.onDown = function(){
		me.toggleActive();
		if (properties.onDown) properties.onDown.bind(me).call();
	};

	return me;
};

export default checkboxbutton;