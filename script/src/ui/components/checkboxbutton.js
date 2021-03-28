UI.checkboxbutton = function(properties){
	var me = UI.button(0,0,20,20);
	properties = properties || {};

	me.setProperties({
		background: properties.background || UI.Assets.buttonDarkBlueScale9,
		hoverBackground:properties.hoverBackground || UI.Assets.buttonDarkBlueActiveScale9,
		activeBackground:properties.activeBackground || UI.Assets.buttonDarkBlueActiveScale9,
		isActive:false,
		textAlign: "left",
		paddingLeft: 30,
		font: properties.font || window.fontFT,
		label: properties.label || "",
		labels: properties.labels || undefined,
		checkbox:  properties.checkbox || false
	});


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