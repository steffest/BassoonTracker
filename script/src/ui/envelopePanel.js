UI.EnvelopePanel = function(type){

	var me = UI.panel();
	me.type = type;

	var currentInstrument;
	var envelope;

	var titleBar = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkGreyScale9);
	titleBar.ignoreEvents = true;
	me.addChild(titleBar);

	var titleLabel = UI.label({
		label: type + " Envelope",
		font: fontSmall
	});
	me.addChild(titleLabel);

	var enabledCheckbox = UI.checkbox();
	enabledCheckbox.onToggle = function(checked){
		if (envelope){
			envelope.enabled = checked;
		}
	};
	me.addChild(enabledCheckbox);

	var envelopeGraph = UI.Envelope(type);
	me.addChild(envelopeGraph);

	me.setInstrument = function(instrument){
		envelope = instrument[type + "Envelope"];
		currentInstrument = instrument;

		envelopeGraph.setInstrument(instrument);
		enabledCheckbox.setState(envelope && envelope.enabled);
	};

	me.onResize = function(){
		titleBar.setSize(me.width,18);
		titleLabel.setSize(me.width,20);
		enabledCheckbox.setPosition(2,2);
		titleLabel.setPosition(12,2);
		envelopeGraph.setPosition(0,20);
		envelopeGraph.setSize(me.width,me.height-20);

	};

	return me;

};

