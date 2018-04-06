UI.EnvelopePanel = function(type){

	var me = UI.panel();
	me.type = type;

	var titleBar = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkGreyScale9);
	titleBar.ignoreEvents = true;
	me.addChild(titleBar);

	var titleLabel = UI.label({
		label: type + " Envelope",
		font: fontSmall
	});
	me.addChild(titleLabel);

	var envelope = UI.Envelope(type);
	me.addChild(envelope);

	me.setInstrument = function(instrument){
		envelope.setInstrument(instrument);
	};

	me.onResize = function(){
		titleBar.setSize(me.width,18);
		titleLabel.setSize(me.width,20);
		titleLabel.setPosition(0,2);
		envelope.setPosition(0,20);
		envelope.setSize(me.width,me.height-20);

	};

	return me;

};

