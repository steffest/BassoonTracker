UI.checkboxbutton = function(properties){
	var me = UI.button(0,0,20,20);
	properties = properties || {};

	me.setProperties({
		background: UI.Assets.buttonDarkBlueScale9,
		activeBackground:UI.Assets.buttonDarkBlueActiveScale9,
		isActive:false,
		textAlign: "left",
		paddingLeft: 30,
		font: window.fontFT,
		label: properties.label || ""
	});


	me.renderInternal = function(){
		//var stateImage = me.isActive ? Y.getImage("checkbox_on") : Y.getImage("checkbox_off");
		var stateImage = me.isActive ? Y.getImage("radio_active") : Y.getImage("radio_inactive");
		me.ctx.drawImage(stateImage,8,Math.floor(me.height/2)-5);
	};

	me.onDown = function(){
		me.toggleActive();
		if (properties.onDown) properties.onDown.bind(me).call();
	};

	return me;
};