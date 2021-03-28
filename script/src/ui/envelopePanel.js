UI.EnvelopePanel = function(type){

	var me = UI.panel();
	me.type = type;

	var currentInstrument;
	var envelope;
	var disabled = false;

	var titleBar = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkGreyScale9);
	titleBar.ignoreEvents = true;
	me.addChild(titleBar);

	var titleLabel = UI.label({
		label: type + " Envelope",
		font: fontSmall
	});
    titleLabel.onClick = function() {
        enabledCheckbox.toggle();
    };
	me.addChild(titleLabel);

	var enabledCheckbox = UI.checkbox();
	enabledCheckbox.onToggle = function(checked){
		if (envelope){
			envelope.enabled = checked;
            envelopeGraph.refresh();
		}
	};
	me.addChild(enabledCheckbox);

	var buttonAdd = UI.Assets.generate("button20_20");
	buttonAdd.onDown = function(){
		if (!envelope.enabled) return;
		if (envelope.points.length > envelope.count){
			var prevPoint = envelope.points[envelope.count-1] || [0,0];
			var nextPoint = envelope.points[envelope.count];
			if (prevPoint[0] + 10<320){
				if (nextPoint[0]<=prevPoint[0]){
					nextPoint[0] = prevPoint[0]+10;
				}
				envelope.count++;
			}
		}else{
			var lastPoint = envelope.points[envelope.points.length-1];
			if (lastPoint[0] + 10<320){
				var newPoint = [lastPoint[0] + 10,32];
				envelope.points.push(newPoint);
				envelope.count = envelope.points.length;
			}
		}
		envelopeGraph.refresh();
	};
	buttonAdd.setProperties({
		label:"+",
		width: 18,
		height: 18
	});
	me.addChild(buttonAdd);

	var buttonRemove = UI.Assets.generate("button20_20");
	buttonRemove.onDown = function(){
		if (!envelope.enabled) return;
		if (envelope.count > 2){
			envelope.count--;
			me.checkMax();
		}
		envelopeGraph.refresh();
	};
	buttonRemove.setProperties({
		label:"-",
		width: 18,
		height: 18
	});
	me.addChild(buttonRemove);


	var envelopeGraph = UI.Envelope(type);
	me.addChild(envelopeGraph);


	var panel = UI.panel(0,0,20,20);

	var sustainCheckBox = UI.checkbox();
	var loopCheckBox = UI.checkbox();
	var sustainSpinbox = UI.spinBox();
    var loopFromSpinbox = UI.spinBox();
    var loopToSpinbox = UI.spinBox();

    sustainCheckBox.onToggle = function(checked){
        sustainSpinbox.setDisabled(!checked);
		envelope.sustain = checked;
		envelopeGraph.refresh();
    };
    loopCheckBox.onToggle = function(checked){
        loopFromSpinbox.setDisabled(!checked);
        loopToSpinbox.setDisabled(!checked);
		envelope.loop = checked;
		envelopeGraph.refresh();
    };

	sustainSpinbox.setProperties({
		label: " ",
		name: me.type + " envelope sustain",
		value: 0,
		max: 100,
		min:0,
        padLength: 2,
		disabled: true,
		font: window.fontFT,
		trackUndo: true,
		undoInstrument: true,
		onChange : function(value){
			envelope.sustainPoint = value;
			me.checkMax();
			envelopeGraph.refresh();
		}
	});
    loopFromSpinbox.setProperties({
        label: "From",
		name: me.type + " envelope loop from",
        value: 0,
        max: 100,
        min:0,
        padLength: 2,
        disabled: true,
        font: window.fontSmall,
		trackUndo: true,
		undoInstrument: true,
        onChange : function(value){
			envelope.loopStartPoint = value;
			me.checkMax();
			envelopeGraph.refresh();
        }
    });
    loopToSpinbox.setProperties({
        label: "To",
		name: me.type + " envelope loop to",
        value: 0,
        max: 100,
        min:0,
        padLength: 2,
        disabled: true,
        font: window.fontSmall,
		trackUndo: true,
		undoInstrument: true,
        onChange : function(value){
			envelope.loopEndPoint = value;
			me.checkMax();
			envelopeGraph.refresh();
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
		if (!instrument) return;
		envelope = instrument[type + "Envelope"];
		currentInstrument = instrument;

		envelopeGraph.setInstrument(instrument);
		enabledCheckbox.setState(envelope && envelope.enabled);
		sustainCheckBox.setState(envelope && envelope.sustain);
		loopCheckBox.setState(envelope && envelope.loop);

		sustainSpinbox.setValue(envelope.sustainPoint || 0,true);
		loopFromSpinbox.setValue(envelope.loopStartPoint || 0,true);
		loopToSpinbox.setValue(envelope.loopEndPoint || 0,true);
	};

	me.setDisabled = function(value){
		disabled = value;
		me.ignoreEvents = disabled;
		me.refresh();
	};

	me.onResize = function(){

        panel.setSize(120,me.height);
        var panelWidth = panel.width;


		titleBar.setSize(me.width-panelWidth-36,18);
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

		buttonAdd.setPosition(titleBar.width,titleBar.top);
		buttonRemove.setPosition(titleBar.width + 18,titleBar.top);


    };

	me.renderInternal = function(){
		if (disabled){
			me.ctx.fillStyle = "rgba(34, 49, 85, 0.4)";
			me.ctx.fillRect(0,0,me.width,me.height);
		}
	};

	me.checkMax = function(){
		if (envelope.count){
            if (envelope.sustainPoint >= envelope.count) sustainSpinbox.setValue(envelope.count-1);
            if (envelope.loopStartPoint >= envelope.count) loopFromSpinbox.setValue(envelope.count-1);
            if (envelope.loopEndPoint >= envelope.count) loopToSpinbox.setValue(envelope.count-1);
		}
	};

	return me;

};

