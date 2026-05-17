import Panel from "./components/panel.js";
import Scale9Panel from "./components/scale9.js";
import Assets from "./assets.js";
import Envelope from "./envelope.js";
import Checkbox from "./components/checkbox.js";
import SpinBox from "./spinBox.js";
import Label from "./components/label.js";
import Font from "./font.js";

let EnvelopePanel = function(type){

	var me = new Panel();
	me.type = type;

	var currentInstrument;
	var envelope;
	var disabled = false;

	var titleBar = new Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
	titleBar.ignoreEvents = true;
	me.addChild(titleBar);

	var titleLabel = new Label(0, 0, 20, 20);
	titleLabel.label = type + " Envelope";
	titleLabel.font = Font.small;
    titleLabel.onClick = function() {
        enabledCheckbox.toggle();
    };
	me.addChild(titleLabel);

	var enabledCheckbox = new Checkbox();
	enabledCheckbox.onToggle = function(checked){
		if (envelope){
			envelope.enabled = checked;
            envelopeGraph.refresh();
		}
	};
	me.addChild(enabledCheckbox);

	var buttonAdd = Assets.generate("button20_20");
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
	buttonAdd.label = "+";
	buttonAdd.width = 18;
	buttonAdd.height = 18;
	me.addChild(buttonAdd);

	var buttonRemove = Assets.generate("button20_20");
	buttonRemove.onDown = function(){
		if (!envelope.enabled) return;
		if (envelope.count > 2){
			envelope.count--;
			me.checkMax();
		}
		envelopeGraph.refresh();
	};
	buttonRemove.label = "-";
	buttonRemove.width = 18;
	buttonRemove.height = 18;
	me.addChild(buttonRemove);


	var envelopeGraph = Envelope(type);
	me.addChild(envelopeGraph);


	var panel = new Panel(0,0,20,20);

	var sustainCheckBox = new Checkbox();
	var loopCheckBox = new Checkbox();
	var sustainSpinbox = new SpinBox();
    var loopFromSpinbox = new SpinBox();
    var loopToSpinbox = new SpinBox();

    sustainCheckBox.onToggle = function(checked){
        sustainSpinbox.disabled = !checked;
		envelope.sustain = checked;
		envelopeGraph.refresh();
    };
    loopCheckBox.onToggle = function(checked){
        loopFromSpinbox.disabled = !checked;
        loopToSpinbox.disabled = !checked;
		envelope.loop = checked;
		envelopeGraph.refresh();
    };

	sustainSpinbox.label = " ";
	sustainSpinbox.name = me.type + " envelope sustain";
	sustainSpinbox.value = 0;
	sustainSpinbox.max = 100;
	sustainSpinbox.min = 0;
	sustainSpinbox.padLength = 2;
	sustainSpinbox.isDisabled = true;
	sustainSpinbox.font = Font.ft;
	sustainSpinbox.trackUndo = true;
	sustainSpinbox.undoInstrument = true;
	sustainSpinbox.onChange = function(value){
		envelope.sustainPoint = value;
		me.checkMax();
		envelopeGraph.refresh();
	};
	loopFromSpinbox.label = "From";
  loopFromSpinbox.name = me.type + " envelope loop from";
	loopFromSpinbox.value = 0;
	loopFromSpinbox.max = 100;
	loopFromSpinbox.min = 0;
	loopFromSpinbox.padLength = 2;
	loopFromSpinbox.isDisabled = true;
	loopFromSpinbox.font = Font.small;
  loopFromSpinbox.trackUndo = true;
  loopFromSpinbox.undoInstrument = true;
	loopFromSpinbox.onChange = function(value){
	envelope.loopStartPoint = value;
	me.checkMax();
	envelopeGraph.refresh();
	};
	loopToSpinbox.label = "To";
  loopToSpinbox.name = me.type + " envelope loop to";
	loopToSpinbox.value = 0;
	loopToSpinbox.max = 100;
	loopToSpinbox.min = 0;
	loopToSpinbox.padLength = 2;
	loopToSpinbox.isDisabled = true;
	loopToSpinbox.font = Font.small;
  loopToSpinbox.trackUndo = true;
  loopToSpinbox.undoInstrument = true;
	loopToSpinbox.onChange = function(value){
	envelope.loopEndPoint = value;
	me.checkMax();
	envelopeGraph.refresh();
	};

    var background = new Scale9Panel(0,0,panel.width,panel.height,Assets.panelMainScale9);
    background.ignoreEvents = true;
    panel.addChild(background);

	panel.addChild(sustainSpinbox);
	panel.addChild(loopFromSpinbox);
	panel.addChild(loopToSpinbox);

    var sustainLabel = new Label(0, 0, 60, 20);
    sustainLabel.label = "Sustain";
    sustainLabel.font = Font.small;
    panel.addChild(sustainLabel);
    var loopLabel = new Label(0, 0, 60, 20);
    loopLabel.label = "Loop";
    loopLabel.font = Font.small;
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

		sustainSpinbox.left = 10;
		sustainSpinbox.top = 20;
		sustainSpinbox.width = 100;
		sustainSpinbox.height = 28;

        loopCheckBox.setPosition(5,50);
        loopLabel.setPosition(14,50);

		loopFromSpinbox.left = 10;
		loopFromSpinbox.top = 70;
		loopFromSpinbox.width = 100;
		loopFromSpinbox.height = 28;

		loopToSpinbox.left = 10;
		loopToSpinbox.top = 98;
		loopToSpinbox.width = 100;
		loopToSpinbox.height = 28;

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

export default EnvelopePanel;

