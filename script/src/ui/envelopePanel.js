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
            envelopeGraph.refresh();
		}
	};
	me.addChild(enabledCheckbox);

	var envelopeGraph = UI.Envelope(type);
	me.addChild(envelopeGraph);


	var panel = UI.panel(0,0,20,20);

	var sustainCheckBox = UI.checkbox();
	var loopCheckBox = UI.checkbox();
	var sustainSpinbox = UI.spinBox();
    var loopFromSpinbox = UI.spinBox();
    var loopToSpinbox = UI.spinBox();

    sustainCheckBox.onToggle = function(checked){
        sustainSpinbox.setDisabled(!checked)
    };
    loopCheckBox.onToggle = function(checked){
        loopFromSpinbox.setDisabled(!checked);
        loopToSpinbox.setDisabled(!checked);
    };

	sustainSpinbox.setProperties({
		label: " ",
		value: 0,
		max: 100,
		min:0,
        padLength: 2,
		disabled: true,
		font: window.fontFT,
		onChange : function(value){
			//Tracker.setCurrentPattern(value);
		}
	});
    loopFromSpinbox.setProperties({
        label: "From",
        value: 0,
        max: 100,
        min:0,
        padLength: 2,
        disabled: true,
        font: window.fontSmall,
        onChange : function(value){
            //Tracker.setCurrentPattern(value);
        }
    });
    loopToSpinbox.setProperties({
        label: "To",
        value: 0,
        max: 100,
        min:0,
        padLength: 2,
        disabled: true,
        font: window.fontSmall,
        onChange : function(value){
            //Tracker.setCurrentPattern(value);
        }
    });


    var background = UI.scale9Panel(0,0,panel.width,panel.height,UI.Assets.panelMainScale9);
    background.ignoreEvents = true;
    panel.addChild(background);



	panel.addChild(sustainSpinbox);
	panel.addChild(loopFromSpinbox);
	panel.addChild(loopToSpinbox);

    var sustainLabel = UI.label({
        label:"Sustain",
        font: fontSmall,
		width:60
    });
    panel.addChild(sustainLabel);
    var loopLabel = UI.label({
        label:"Loop",
        font: fontSmall,
        width:60
    });
    panel.addChild(loopLabel);
    panel.addChild(sustainCheckBox);
    panel.addChild(loopCheckBox);

	me.addChild(panel);

	me.setInstrument = function(instrument){
		envelope = instrument[type + "Envelope"];
		currentInstrument = instrument;

		envelopeGraph.setInstrument(instrument);
		enabledCheckbox.setState(envelope && envelope.enabled);
	};

	me.onResize = function(){

        panel.setSize(120,me.height);
        var panelWidth = panel.width;


		titleBar.setSize(me.width-panelWidth,18);
		titleLabel.setSize(me.width-panelWidth,20);
		enabledCheckbox.setPosition(2,2);
		titleLabel.setPosition(12,2);
		envelopeGraph.setPosition(0,20);
		envelopeGraph.setSize(me.width-panelWidth+1,me.height-22);



        background.setSize(panel.width,panel.height);
		panel.setPosition(me.width-panel.width,0);
		sustainCheckBox.setPosition(4,4);
        sustainLabel.setPosition(14,4);

		sustainSpinbox.setProperties({
			left: 10,
			top: 20,
			width: 100,
			height: 28
		});

        loopCheckBox.setPosition(5,50);
        loopLabel.setPosition(14,50);

        loopFromSpinbox.setProperties({
            left: 10,
            top: 70,
            width: 100,
            height: 28
        });

        loopToSpinbox.setProperties({
            left: 10,
            top: 98,
            width: 100,
            height: 28
        });


    };

	return me;

};

