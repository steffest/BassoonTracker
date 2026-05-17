import Panel from "../../src/ui/components/panel.js";
import Assets from "../../src/ui/assets.js";
import Y from "../../src/ui/yascal/yascal.js";
import EventBus from "../../src/eventBus.js";
import {COMMAND, EVENT, TRACKERMODE, SETTINGS} from "../../src/enum.js";
import Button from "../../src/ui/components/button.js";
import ButtonGroup from "../../src/ui/app/components/buttonGroup.js";
import Inputbox from "../../src/ui/components/inputbox.js";
import SliderBox from "../../src/ui/sliderBox.js";
import SpinBox from "../../src/ui/spinBox.js";
import WaveForm from "./waveform.js";
import LoopCreator from "./loopCreator.js";
import EnvelopePanel from "../../src/ui/envelopePanel.js";
import Checkbox from "../../src/ui/components/checkbox.js";
import Menu from "../../src/ui/components/menu.js";
import Tracker from "../../src/tracker.js";
import App from "../../src/app.js";
import Layout from "../../src/ui/app/layout.js";
import Input from "../../src/ui/input.js";
import UI from "../../src/ui/ui.js";
import HissReductionPanel from "./hissReductionPanel.js";

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

let SampleView = function(){

	var me = new Panel();
	me.name = "SampleView";
	me.hide();

	var currentInstrumentIndex;
	var subPanel = "loop";
	var isMaximized = false;
	var moreExpanded = false;

	var inputboxHeight = 20;
	var font = UI.font.med;
	font = UI.font.condensed;

	var instrumentName = new Inputbox(0, 0, 20, inputboxHeight);
	instrumentName.name = "instrumentName";
	instrumentName.trackUndo = true;
	instrumentName.undoInstrument = true;
	instrumentName.onChange = function(value){
		if (currentInstrumentIndex){
			var instrument = Tracker.getInstrument(currentInstrumentIndex);
			if (instrument) instrument.name = value;
			EventBus.trigger(EVENT.instrumentNameChange,currentInstrumentIndex);
		}
	};
	me.addChild(instrumentName);

	var closeButton = Assets.generate("button20_20");
	closeButton.label = "x";
	closeButton.onClick = function(){
		App.doCommand(COMMAND.showBottomMain);
	};
	me.addChild(closeButton);

	var buttonProperties = {
		background: Assets.buttonKeyScale9,
		activeBackground:Assets.buttonKeyActiveScale9,
		isActive:false,
		textAlign: "center",
		font: UI.font.dark,
		paddingTopActive: 1
	};

	var bit8Button = new Button();
	var bit16Button = new Button();

	setProps(bit8Button, buttonProperties);
	bit8Button.label = "8";
	bit8Button.tooltip = "store as 8bit sample";
	bit8Button.setActive(true);
	bit8Button.onDown = function(){
		changeSampleBit(8);
	};
	me.addChild(bit8Button);
	setProps(bit16Button, buttonProperties);
	bit16Button.label = "16";
	bit16Button.tooltip = "store as 16bit sample";
	bit16Button.onDown = function(){
		changeSampleBit(16);
	};
	me.addChild(bit16Button);


	var waveForm = WaveForm();
	me.addChild(waveForm);

	var loopCreator = LoopCreator();
	waveForm.addLoopCreator(loopCreator);

	var hissReductionPanel = HissReductionPanel();
	waveForm.addHissReductionPanel(hissReductionPanel);

	waveForm.onMouseWheel = function(touchData){
		if (touchData.mouseWheels[0] > 0){
			waveForm.zoom(1.01)
		}else{
			waveForm.zoom(0.99)
		}
	};

	waveForm.onZoomChange = function(state) {
		if (loopCreator.isVisible()) loopCreator.setZoom(state);
	};

	loopCreator.onMouseWheel = waveForm.onMouseWheel;

	loopCreator.onPreviewUpdate = function() {
		waveForm.invalidateWave();
	};

	hissReductionPanel.onPreviewUpdate = function() {
		waveForm.invalidateWave();
	};

	function openLoopCreator() {
		loopCreator.open(Tracker.getCurrentInstrument());
		loopCreator.setZoom(waveForm.getZoomState());
		sampleEditorMenu.hide();
		me.onResize();
	}

	function openHissReductionPanel() {
		hissReductionPanel.open(Tracker.getCurrentInstrument());
		sampleEditorMenu.hide();
		me.onResize();
	}

	loopCreator.onClose = function() {
		sampleEditorMenu.show();
		me.onResize();
	};

	hissReductionPanel.onClose = function() {
		sampleEditorMenu.show();
		me.onResize();
	};

	var drawModeButton = new Button();
	setProps(drawModeButton, {
		name: "drawMode",
		image: Y.getImage("share"),
		activeImage: Y.getImage("share"),
		isActive: false,
		opacity: 0.4,
		hoverOpacity: 1
	});
	drawModeButton.tooltip = "Toggle Draw Mode";
	drawModeButton.onDown = function(){
		var active = !drawModeButton.isActive;
		drawModeButton.setActive(active);
		waveForm.setDrawMode(active);
	};
	me.addChild(drawModeButton);

	var sampleEditorMenu = new Menu(0,0,140,26,me);
	sampleEditorMenu.name = "SampleEditorMenu";
	sampleEditorMenu.zIndex = 500;

	sampleEditorMenu.setItems([
		{label: "Sample", subItems: [
			{label: "Load", onClick: function(){
				EventBus.trigger(EVENT.showView,"diskop_samples_load");
			}},
			{label: "Save", onClick: function(){
				EventBus.trigger(EVENT.showView,"diskop_samples_save");
			}}
		]},
		{label: "View", subItems: [
			{label: "Maximize", onClick: function(){
				toggleMaximize();
			}}
		]},
		{label: "Edit", subItems: [
			{label: "Normalize", onClick: function(){
				waveForm.adjustVolume("max");
			}},
			{label: "Trim", onClick: function(){
				waveForm.trim();
			}},

			{label: "Upsample", onClick: function(){
				waveForm.resample("up");
			}},
			{label: "DownSample", onClick: function(){
				waveForm.resample("down");
			}},
			{label: "Make 8-bit", onClick: function(){
				changeSampleBit(8);
			}},
			{label: "Filter", subItems: [
				{label: "Hiss reduction", onClick: function(){
					openHissReductionPanel();
				}}
			]},
			{label: "Create Loop", onClick: function(){ openLoopCreator(); }}
		]}
	]);
	me.addChild(sampleEditorMenu);


	var volumeEnvelope = EnvelopePanel("volume");
	me.addChild(volumeEnvelope);

	var panningEnvelope = EnvelopePanel("panning");
	me.addChild(panningEnvelope);

	var sideButtonPanel = new Panel();
	setProps(sideButtonPanel, {
		name: "instrumentSideButtonPanel"
	});

	var spinBoxInstrument = new SpinBox(0, 0, 20, 20);
	setProps(spinBoxInstrument, {name:"Instrument", label:"", value:1, max:64, padLength:2, min:1, font:font, onChange:function(value){Tracker.setCurrentInstrumentIndex(value);}});
	me.addChild(spinBoxInstrument);


	var volumeSlider = new SliderBox(0, 0, 40, 200);
	setProps(volumeSlider, {name:"Volume", label:"Volume", font:font, value:64, max:64, min:0, step:1, vertical:true, trackUndo:true, undoInstrument:true, onChange:function(value){var instrument=Tracker.getCurrentInstrument();if(instrument){instrument.sample.volume=value;}}});
	sideButtonPanel.addChild(volumeSlider);

	var fineTuneSlider = new SliderBox(0, 0, 20, 20);
	setProps(fineTuneSlider, {name:"Finetune", label:"Finetune", font:font, value:0, max:7, min:-8, step:1, vertical:true, trackUndo:true, undoInstrument:true, onChange:function(value){var instrument=Tracker.getCurrentInstrument();if(instrument)instrument.setFineTune(value);}});
	sideButtonPanel.addChild(fineTuneSlider);

	var panningSlider = new SliderBox(0, 0, 20, 20);
	setProps(panningSlider, {name:"Panning", label:"Panning", font:font, value:0, max:127, min:-127, vertical:true, trackUndo:true, undoInstrument:true, onChange:function(value){var instrument=Tracker.getCurrentInstrument();if(instrument){instrument.panning=value;instrument.sample.panning=value;}}});
	sideButtonPanel.addChild(panningSlider);

	var repeatSpinbox = new SpinBox(0, 0, 20, 20);
	setProps(repeatSpinbox, {name:"Repeat", label:"Start", value:0, max:65535, min:0, step:2, font:font, trackUndo:true, undoInstrument:true, onChange:function(value){
		if (loopCreator.isVisible()) { loopCreator.setLoopStart(value); return; }
		var instrument= Tracker.getCurrentInstrument();
		if (instrument){
			if ((instrument.sample.loop.length+value)>instrument.sample.length) {
				value = instrument.sample.length-instrument.sample.loop.length;
				repeatSpinbox.setValue(value,true);
			}
			instrument.sample.loop.start = value;
		}
		waveForm.refresh();
	}});
	sideButtonPanel.addChild(repeatSpinbox);

	var repeatLengthSpinbox = new SpinBox(0, 0, 20, 20);
	setProps(repeatLengthSpinbox, {name:"Repeat Length", label:"Length", value:0, max:65535, min:0, step:2, font:font, trackUndo:true, undoInstrument:true, onChange:function(value){
		if (loopCreator.isVisible()) { loopCreator.setLoopLength(value); return; }
		var instrument = Tracker.getCurrentInstrument();
		if (instrument){
			if ((instrument.sample.loop.start+value)>instrument.sample.length) {
				value = instrument.sample.length-instrument.sample.loop.start;
				repeatLengthSpinbox.setValue(value,true);
			}
			instrument.sample.loop.length = value;
		}
		EventBus.trigger(EVENT.samplePropertyChange,{interal_loopLength: value});
		waveForm.refresh();
	}});
	sideButtonPanel.addChild(repeatLengthSpinbox);

	var fadeOutSlider = new SliderBox(0, 0, 20, 20);
	setProps(fadeOutSlider, {name:"Fadeout", label:"Fadeout", value:0, max:4095, min:0, step:1, font:font, vertical:true, trackUndo:true, undoInstrument:true, onChange:function(value){var instrument=Tracker.getCurrentInstrument();if(instrument)instrument.fadeout=value;}});
	sideButtonPanel.addChild(fadeOutSlider);

	var spinBoxRelativeNote = new SpinBox(0, 0, 20, 20);
	setProps(spinBoxRelativeNote, {name:"relativeNote", label:"RelativeNote", value:0, max:128, min:-127, step:1, font:font, trackUndo:true, undoInstrument:true, onChange:function(value){var instrument=Tracker.getCurrentInstrument();if(instrument){instrument.sample.relativeNote=value;}}});
	sideButtonPanel.addChild(spinBoxRelativeNote);



    var spinBoxVibratoSpeed = new SpinBox(0, 0, 20, 20);
    setProps(spinBoxVibratoSpeed, {name:"vibratoSpeed", label:"Vib Speed", value:0, max:63, min:0, step:1, font:font, trackUndo:true, undoInstrument:true, onChange:function(value){var instrument=Tracker.getCurrentInstrument();if(instrument){instrument.vibrato.rate=value;}}});
    sideButtonPanel.addChild(spinBoxVibratoSpeed);
    spinBoxVibratoSpeed.hide();

    var spinBoxVibratoDepth = new SpinBox(0, 0, 20, 20);
    setProps(spinBoxVibratoDepth, {name:"vibratoDepth", label:"Vib Depth", value:0, max:15, min:0, step:1, font:font, trackUndo:true, undoInstrument:true, onChange:function(value){var instrument=Tracker.getCurrentInstrument();if(instrument){instrument.vibrato.depth=value;}}});
    sideButtonPanel.addChild(spinBoxVibratoDepth);
    spinBoxVibratoDepth.hide();

    var spinBoxVibratoSweep = new SpinBox(0, 0, 20, 20);
    setProps(spinBoxVibratoSweep, {name:"vibratoSweep", label:"Vib Sweep", value:0, max:255, min:0, step:1, font:font, trackUndo:true, undoInstrument:true, onChange:function(value){var instrument=Tracker.getCurrentInstrument();if(instrument){instrument.vibrato.sweep=value;}}});
    sideButtonPanel.addChild(spinBoxVibratoSweep);
    spinBoxVibratoSweep.hide();

    var waveLabels = ["sin","square","saw","saw_inverse"];
    var waveButtons = [];
    waveLabels.forEach(function(label,index){
        var button = new Button();
        setProps(button, {
            background: Assets.buttonKeyScale9,
            activeBackground:Assets.buttonKeyActiveScale9,
            image: Y.getImage("wave_" + label),
            activeImage: Y.getImage("wave_" + label),
            isActive:false
        });
        button.onDown = function(){
            setVibratoWave(index);
        };
        button.hide();
        sideButtonPanel.addChild(button);
        waveButtons.push(button);
	});
    setVibratoWave(0);

    me.addChild(sideButtonPanel);

	var buttons = [];
	var buttonsInfo = [
		{label: "Load", onClick : function(){
				EventBus.trigger(EVENT.showView,"diskop_samples_load");
			}},
		{label: "Play", onDown : function(){
				Input.handleNoteOn(Input.getPrevIndex());
		},onUp : function(){
				Input.handleNoteOff(Input.getPrevIndex());
				Input.clearInputNotes();
				waveForm.stop();
			}},
		{label: "Range", onDown : function(){
				waveForm.playSection("range");
			},onUp : function(){
				Input.handleNoteOff(Input.getPrevIndex());
				Input.clearInputNotes();
				waveForm.stop();
			}},
		{label: "Loop", onDown : function(){
				waveForm.playSection("loop");
			},onUp : function(){
				Input.handleNoteOff(Input.getPrevIndex());
				Input.clearInputNotes();
				waveForm.stop();
			}},

		{label: "Stop", onClick : function(){
				//App.doCommand(COMMAND.showBottomMain);
				Input.clearInputNotes();
				waveForm.stop();
			}},
		{label: "More", onClick : function(){
			moreExpanded = !moreExpanded;
			me.onResize();
			me.refresh();
		}}
	];

	var buttonsDisplay = [
		{label: "Zoom In", width: 62, onClick : function(){waveForm.zoom(2);}},
		{label: "Out", width: 38, onClick : function(){waveForm.zoom(0.5);}},
		{label: "All", width: 50, onClick : function(){waveForm.zoom(1);}},
		{value: 0, width: 50, type: "number", onSamplePropertyChange : function(button,props){
				if (typeof props.sampleLength !== "undefined") button.setValue(props.sampleLength);
			}},
		{label: "Loop", width: 50, onClick : function(){waveForm.zoom("loop");}},
		{value: 0, width: 50, type: "number", onSamplePropertyChange : function(button,props){
				if (typeof props.loopLength !== "undefined") button.setValue(props.loopLength);
				if (typeof props.interal_loopLength !== "undefined") button.setValue(props.interal_loopLength);
			}},
		{label: "Range", width: 50, onClick : function(){waveForm.zoom("range");}},
		{value: "0", width: 50, type: "number", onSamplePropertyChange : function(button,props){
				if (typeof props.rangeLength !== "undefined") button.setValue(props.rangeLength);
			}}
	];

	var buttonsEdit = [
		{label: "Reverse", onClick : function(){
				waveForm.reverse();
			}},
		{label: "Invert", onClick : function(){
				waveForm.invert();
			}},
		{label: "Upsample", onClick : function(){
				waveForm.resample("up");
			}},
		{label: "DownSample", onClick : function(){
				waveForm.resample("down");
			}}
	];

	var buttonsVolume= [
		{label: "Maximize", onClick : function(){
				waveForm.adjustVolume("max");
			}},
		{label: "Fade In", width: 62, onClick : function(){
				waveForm.adjustVolume("fadein");
			}},
		{label: "Out", width: 38, onClick : function(){
				waveForm.adjustVolume("fadeout");
			}},
		{label: "-5%", width: 50, onClick : function(){
				waveForm.adjustVolume(-5);
			}},
		{label: "+5%", width: 50, onClick : function(){
				waveForm.adjustVolume(5);
			}},
		{label: "-10%", width: 50, onClick : function(){
				waveForm.adjustVolume(-10);
			}},

		{label: "+10%", width: 50, onClick : function(){
				waveForm.adjustVolume(10);
			}}
	];

	var buttonsSelect = [
		{label: "[", width: 15, onClick : function(){
				waveForm.select("start");
			}},
		{label: "All", width: 70, onClick : function(){
				waveForm.select("all");
			}},
		{label: "]", width: 15, onClick : function(){
				waveForm.select("end");
			}},
		{label: "[", width: 15, onClick : function(){
				var instr = Tracker.getCurrentInstrument();
				if (instr && instr.sample.loop.length > 2) {
					waveForm.select("range", instr.sample.loop.start, 0);
				}
			}},
		{label: "Loop", width: 70, onClick : function(){
				waveForm.select("loop");
			}},
		{label: "]", width: 15, onClick : function(){
				var instr = Tracker.getCurrentInstrument();
				if (instr && instr.sample.loop.length > 2) {
					waveForm.select("range", instr.sample.loop.start + instr.sample.loop.length, 0);
				}
			}},
		{label: "None", width: 50, onClick : function(){
				waveForm.select("none");
			}},
		{label: "Cut", width: 50, onClick : function(){
				UI.cutSelection();
			}},
		{label: "Copy", width: 50, onClick : function(){
				UI.copySelection();
			}},
		{label: "Paste", width: 50, onClick : function(){
				UI.pasteSelection();
			}}
	];

	buttonsInfo.forEach(function(buttonInfo){
		var button = Assets.generate("buttonLight");
		button.label = buttonInfo.label;
		button.onClick = buttonInfo.onClick;
		button.onDown = buttonInfo.onDown;
		button.onTouchUp = buttonInfo.onUp;
		me.addChild(button);
		buttons.push(button);
	});

	var sampleDisplayPanel = new ButtonGroup("Display",buttonsDisplay);
	var sampleSelectPanel = new ButtonGroup("Select",buttonsSelect);
	var sampleEditPanel = new ButtonGroup("Edit",buttonsEdit);
	var sampleVolumePanel = new ButtonGroup("Volume",buttonsVolume);
	me.addChild(sampleDisplayPanel);
	me.addChild(sampleSelectPanel);
	me.addChild(sampleEditPanel);
	me.addChild(sampleVolumePanel);



    var loopTitleBar = new Button();
    setProps(loopTitleBar, {
        background: Assets.panelDarkGreyScale9,
        activeBackground: Assets.panelDarkGreyBlueScale9,
        isActive:false,
        label: "Loop",
		font: UI.font.small,
        paddingTop: 2,
        paddingTopActive: 2,
		paddingLeft: 20
    });
    loopTitleBar.onDown = function(){
        setSubPanel("loop");
    };
    me.addChild(loopTitleBar);


	var loopEnabledCheckbox = new Checkbox();
	loopEnabledCheckbox.onToggle = function(checked){
		var instrument = Tracker.getInstrument(currentInstrumentIndex);
		if (instrument) instrument.sample.loop.enabled = checked;

		repeatSpinbox.disabled =
		repeatLengthSpinbox.disabled = !checked;
		waveForm.refresh();
	};
	me.addChild(loopEnabledCheckbox);

    var vibratoTitleBar = new Button();
    setProps(vibratoTitleBar, {
        background: Assets.panelDarkGreyScale9,
        activeBackground: Assets.panelDarkGreyBlueScale9,
        isActive:false,
        label: "Vibrato",
		font: UI.font.small,
        paddingTop: 2,
		paddingLeft: 5,
        paddingTopActive: 2
    });
    vibratoTitleBar.onDown = function(){
        setSubPanel("vibrato");
    };
    me.addChild(vibratoTitleBar);

    me.onShow = function(){
    	Input.setFocusElement(me);
		me.refreshState();
        me.onResize();
    };

	me.refreshState = function(){
		EventBus.trigger(EVENT.songPropertyChange,Tracker.getSong());
		EventBus.trigger(EVENT.instrumentChange,Tracker.getCurrentInstrumentIndex());
		EventBus.trigger(EVENT.trackerModeChanged,Tracker.getTrackerMode());
	};

	me.onKeyDown = function(keyCode,event){
		if (!me.visible) return;
		switch (keyCode){
			case 37: // left
				waveForm.scroll(-1);
				return true;
			case 39: // right
				waveForm.scroll(1);
				return true;
			case 46: // delete
				UI.deleteSelection();
				return true;
		}
	}

	me.onResize = function(){

		if (!me.isVisible()) return;
		me.clearCanvas();

		var envelopeHeight = 130;
        var spinButtonHeight = 28;

		var margin = Layout.defaultMargin * 2;
		var waveLeft = isMaximized ? margin : Layout.col2X;
		var waveWidth = isMaximized ? me.width - margin * 2 : Layout.col4W;

		if (isMaximized) {
			sideButtonPanel.hide();
			loopTitleBar.hide();
			loopEnabledCheckbox.hide();
			vibratoTitleBar.hide();
		} else {
			sideButtonPanel.show();
			setProps(sideButtonPanel, {
				left:0,
				top: 0,
				width: Layout.col1W,
				height:me.height
			});
			loopTitleBar.show();
			loopEnabledCheckbox.show();
			vibratoTitleBar.show();
		}

        var sliderHeight = sideButtonPanel.height - envelopeHeight- 10;
		var sliderWidth = Math.ceil(sideButtonPanel.width/4);
		var sliderRow2Top = 0;
		var sliderRow2Left = sliderWidth*2;

		if (sideButtonPanel.width<170){
			sliderWidth = Math.ceil(sideButtonPanel.width/2);
			sliderHeight = Math.floor(sliderHeight/2);
			sliderRow2Top = sliderHeight;
			sliderRow2Left = 0;
		}

		var menuH   = 26;
		var menuTop = inputboxHeight + Layout.defaultMargin + 8;

		var menuPanelActive = !loopCreator.isVisible() && !hissReductionPanel.isVisible();
		var drawBtnW = 22;

		sampleEditorMenu.setPosition(waveLeft, menuTop);
		sampleEditorMenu.setSize(menuPanelActive ? waveWidth - drawBtnW : waveWidth, menuH);

		if (menuPanelActive){
			setProps(drawModeButton, {
				left: waveLeft + waveWidth - drawBtnW + 1,
				top: menuTop + 3,
				width: 20,
				height: 20
			});
			drawModeButton.show();
		} else {
			drawModeButton.hide();
		}

		waveForm.menuHeight = menuH;
		waveForm.setPosition(waveLeft, menuTop);

		if (isMaximized) {
			waveForm.setSize(waveWidth, me.height - menuTop - 8);
			volumeEnvelope.hide();
			panningEnvelope.hide();
			sampleEditPanel.hide();
			sampleDisplayPanel.hide();
			sampleSelectPanel.hide();
			sampleVolumePanel.hide();
			buttons.forEach(function(b){ b.hide(); });
		} else {
			waveForm.setSize(waveWidth, me.height - menuTop - envelopeHeight - spinButtonHeight - 8);

			if (moreExpanded) {
				volumeEnvelope.hide();
				panningEnvelope.hide();

				sampleEditPanel.show();
				sampleDisplayPanel.show();
				sampleSelectPanel.show();
				sampleVolumePanel.show();

				sampleEditPanel.setSize(Layout.col1W,envelopeHeight);
				sampleDisplayPanel.setSize(Layout.col1W,envelopeHeight);
				sampleSelectPanel.setSize(Layout.col1W,envelopeHeight);
				sampleVolumePanel.setSize(Layout.col1W,envelopeHeight);

				sampleDisplayPanel.setPosition(Layout.col2X,waveForm.top + waveForm.height + Layout.defaultMargin + 30);
				sampleSelectPanel.setPosition(Layout.col3X,sampleDisplayPanel.top);
				sampleEditPanel.setPosition(Layout.col4X,sampleDisplayPanel.top);
				sampleVolumePanel.setPosition(Layout.col5X,sampleDisplayPanel.top);
			} else {
				volumeEnvelope.show();
				volumeEnvelope.setPosition(Layout.col2X,waveForm.top + waveForm.height + Layout.defaultMargin + 30);
				volumeEnvelope.setSize(Layout.col2W,envelopeHeight);

				panningEnvelope.show();
				panningEnvelope.setPosition(Layout.col4X,volumeEnvelope.top);
				panningEnvelope.setSize(Layout.col2W,envelopeHeight);

				sampleEditPanel.hide();
				sampleDisplayPanel.hide();
				sampleSelectPanel.hide();
				sampleVolumePanel.hide();
			}

			buttons.forEach(function(b){ b.show(); });
			var BottomPanelTop = waveForm.top + waveForm.height + Layout.defaultMargin;
			var buttonWidth = Layout.col4W / buttons.length;
			buttons.forEach(function(button,index){
				setProps(button, {
					width: buttonWidth,
					height: spinButtonHeight,
					left: Layout.col2X + (buttonWidth*index),
					top: BottomPanelTop
				});
			});

			setProps(loopTitleBar, {
				width: Layout.col1W/2,
				height: 18,
				left: 2,
				top: volumeEnvelope.top
			});

			loopEnabledCheckbox.setPosition(loopTitleBar.left+2,loopTitleBar.top+2);

	        setProps(vibratoTitleBar, {
	            width: loopTitleBar.width,
	            height: loopTitleBar.height,
	            left: loopTitleBar.left + loopTitleBar.width,
	            top: loopTitleBar.top
	        });

			var loopSpinnerHeight = 34;
			var vibratoSpinnerHeight = 30;

			setProps(repeatSpinbox, {
				left:0,
				top: loopTitleBar.top + 24,
				width: Layout.col1W,
				height: loopSpinnerHeight
			});

			setProps(repeatLengthSpinbox, {
				left:0,
				top: loopTitleBar.top + 24 + loopSpinnerHeight,
				width: Layout.col1W,
				height: loopSpinnerHeight
			});

			setProps(spinBoxRelativeNote, {
				left:0,
				top: loopTitleBar.top + 24 + (loopSpinnerHeight*2),
				width: Layout.col1W,
				height: loopSpinnerHeight
			});

	        setProps(spinBoxVibratoSpeed, {
	            left:0,
	            top: vibratoTitleBar.top + 22,
	            width: Layout.col1W,
	            height: vibratoSpinnerHeight
	        });

	        setProps(spinBoxVibratoDepth, {
	            left:0,
	            top: vibratoTitleBar.top + 22 + vibratoSpinnerHeight,
	            width: Layout.col1W,
	            height: vibratoSpinnerHeight
	        });

	        setProps(spinBoxVibratoSweep, {
	            left:0,
	            top: vibratoTitleBar.top + 22 + (vibratoSpinnerHeight*2),
	            width: Layout.col1W,
	            height: vibratoSpinnerHeight
	        });

	        var waveButtonWidth = Math.floor((Layout.col1W-4)/4);
	        var marginLeft = Layout.col1W - (waveButtonWidth*4);
	        waveButtons.forEach(function(button,index){
	            setProps(button, {
	                left: marginLeft + index*waveButtonWidth,
	                top: vibratoTitleBar.top + 22 + (vibratoSpinnerHeight*3),
	                width: waveButtonWidth,
	                height: 17
	            });
			})
		}

		var bitButtonSpace = 0;
		var bitButtonOffScreen = 100;
		if (Tracker.inFTMode()){
			bitButtonSpace = 40;
			bitButtonOffScreen = 0;
		}

		setProps(instrumentName, {
			top: Layout.defaultMargin,
			left: waveLeft + 71,
			width: waveWidth - 71 - 25 - Layout.defaultMargin - bitButtonSpace
		});

		setProps(closeButton, {
			top: Layout.defaultMargin,
			left: instrumentName.left + instrumentName.width + Layout.defaultMargin + bitButtonSpace
		});

		setProps(bit8Button, {
			top: Layout.defaultMargin,
			width: 20,
			height: 20,
			left: instrumentName.left + instrumentName.width + Layout.defaultMargin - 2 + bitButtonOffScreen
		});
		setProps(bit16Button, {
			top: Layout.defaultMargin,
			width: 20,
			height: 20,
			left: instrumentName.left + instrumentName.width + Layout.defaultMargin + 18 + bitButtonOffScreen
		});

		setProps(spinBoxInstrument, {
			left: waveLeft,
			top: 1,
			width: 68,
			height: spinButtonHeight
		});

		if (!isMaximized) {
			setProps(volumeSlider, {
				left:0,
				top: 0,
				width: sliderWidth,
				height: sliderHeight
			});

			setProps(fineTuneSlider, {
				left:sliderWidth,
				top: 0,
				width: sliderWidth,
				height: sliderHeight
			});

			setProps(fadeOutSlider, {
				left:sliderRow2Left,
				top: sliderRow2Top,
				width: sliderWidth,
				height: sliderHeight
			});

			setProps(panningSlider, {
				left:sliderRow2Left + sliderWidth,
				top: sliderRow2Top,
				width: sliderWidth,
				height: sliderHeight
			});
		}

	};


	function toggleMaximize() {
		isMaximized = !isMaximized;
		Layout.sampleViewMaximized = isMaximized;
		EventBus.trigger(EVENT.showView, "sample");
	}

	function changeSampleBit(amount){
		var instrument = Tracker.getCurrentInstrument();
		if (instrument) {
			if (amount === 16){
				instrument.sample.bits = 16;
				bit8Button.setActive(false);
				bit16Button.setActive(true);
			}else{
				var data = instrument.sample.data;
				var len = data.length;
				for (var i = 0; i < len; i++) {
					data[i] = Math.round(data[i] * 127) / 127;
				}
				instrument.sample.bits = 8;
				bit8Button.setActive(true);
				bit16Button.setActive(false);
			}
		}
	}

	function setSubPanel(panel){
		if (panel === "loop"){
            spinBoxRelativeNote.show();
            repeatLengthSpinbox.show();
            repeatSpinbox.show();
            spinBoxVibratoSpeed.hide();
            spinBoxVibratoDepth.hide();
            spinBoxVibratoSweep.hide();
            loopTitleBar.setActive();
            vibratoTitleBar.setActive(false);
            waveButtons.forEach(function(button){
            	button.hide();
			})
		}else{
            spinBoxRelativeNote.hide();
            repeatLengthSpinbox.hide();
            repeatSpinbox.hide();
            spinBoxVibratoSpeed.show();
            spinBoxVibratoDepth.show();
            spinBoxVibratoSweep.show();
            loopTitleBar.setActive(false);
            vibratoTitleBar.setActive();
            waveButtons.forEach(function(button){
                button.show();
            })
		}
        subPanel = panel;
        me.onResize();
	}

	function setVibratoWave(index){

		waveButtons.forEach(function(button,i){
            button.setActive(index === i);
		});

        var instrument = Tracker.getCurrentInstrument();
            if (instrument){
                instrument.vibrato.type = index;
			}

	}


	// events
	EventBus.on(EVENT.instrumentChange,function(value){
		currentInstrumentIndex = value;
		spinBoxInstrument.setValue(value,true);
		var instrument = Tracker.getInstrument(value);
		if (instrument){

            instrumentName.setValue(instrument.name,true);
			fineTuneSlider.setValue(instrument.getFineTune(),true);
			fadeOutSlider.setValue(instrument.fadeout || 0,true);

			spinBoxVibratoSpeed.setValue(instrument.vibrato.rate || 0,true);
			spinBoxVibratoDepth.setValue(instrument.vibrato.depth || 0,true);
			spinBoxVibratoSweep.setValue(instrument.vibrato.sweep || 0,true);
            setVibratoWave(instrument.vibrato.type || 0);

			if (instrument.sample){
                repeatSpinbox.setMax(instrument.sample.length,true);
                repeatLengthSpinbox.setMax(instrument.sample.length,true);

                volumeSlider.setValue(instrument.sample.volume,true);
                panningSlider.setValue(instrument.sample.panning || 0,true);
                repeatSpinbox.setValue(instrument.sample.loop.start,true);
                repeatLengthSpinbox.setValue(instrument.sample.loop.length,true);
                spinBoxRelativeNote.setValue(instrument.sample.relativeNote,true);
                loopEnabledCheckbox.setState(instrument.sample.loop.enabled,true);

                if (instrument.sample.bits === 8){
                    bit8Button.setActive(true);
                    bit16Button.setActive(false);
                }else{
                    bit8Button.setActive(false);
                    bit16Button.setActive(true);
                }
			}

			waveForm.setInstrument(instrument);
			volumeEnvelope.setInstrument(instrument);
			panningEnvelope.setInstrument(instrument);

		}else{
			waveForm.setInstrument();
			volumeEnvelope.setInstrument();
			panningEnvelope.setInstrument();
			instrumentName.setValue("",true);
			volumeSlider.setValue(0,true);
			panningSlider.setValue(0,true);
			fineTuneSlider.setValue(0,true);
			repeatSpinbox.setValue(0,true);
			repeatLengthSpinbox.setValue(0,true);
			spinBoxRelativeNote.setValue(0,true);
			fadeOutSlider.setValue(0,true);
		}
	});


	EventBus.on(EVENT.samplePlay,function(context){
		if (!me.visible) return;
		if (context && context.instrumentIndex === currentInstrumentIndex){
			var offset = context.effects && context.effects.offset ? context.effects.offset.value : 0;
			waveForm.play(context.startPeriod,offset);
		}
	});


	EventBus.on(EVENT.songPropertyChange,function(song){
		song = song || Tracker.getSong();
		if (!song) return;
		spinBoxInstrument.setMax(song.instruments.length-1);
	});

	EventBus.on(EVENT.trackerModeChanged,function(mode){
		fineTuneSlider.setMax(mode === TRACKERMODE.PROTRACKER ? 7 : 127,true);
		fineTuneSlider.setMin(mode === TRACKERMODE.PROTRACKER ? -8 : -128,true);

		var instrument = Tracker.getInstrument(currentInstrumentIndex);
		if (instrument){
			fineTuneSlider.setValue(instrument.getFineTune(),true);
		}

		volumeEnvelope.disabled =
		panningEnvelope.disabled =
		spinBoxRelativeNote.disabled =
		spinBoxVibratoSpeed.disabled =
        spinBoxVibratoDepth.disabled =
        spinBoxVibratoSweep.disabled =
		fadeOutSlider.disabled =
		panningSlider.disabled = !Tracker.inFTMode();
		spinBoxInstrument.setMax(Tracker.getMaxInstruments());

		if (mode === TRACKERMODE.PROTRACKER){
			setProps(repeatSpinbox, {step:2});
			setProps(repeatLengthSpinbox, {step:2});
			if (instrument){
				instrument.sample.loop.start = Math.floor(instrument.sample.loop.start/2)*2;
				instrument.sample.loop.length = Math.floor(instrument.sample.loop.length/2)*2;
				repeatSpinbox.setValue(instrument.sample.loop.start,true);
				repeatLengthSpinbox.setValue(instrument.sample.loop.length,true);
			}
			setSubPanel("loop");
		}else{
			setProps(repeatSpinbox, {step:1});
			setProps(repeatLengthSpinbox, {step:1});
		}
		me.onResize();
	});

	EventBus.on(EVENT.samplePropertyChange,function(newProps){
		var instrument = Tracker.getInstrument(currentInstrumentIndex);
		if (instrument){
			if (typeof newProps.loopStart !== "undefined") repeatSpinbox.setValue(newProps.loopStart,newProps.internal);
			if (typeof newProps.loopLength !== "undefined") repeatLengthSpinbox.setValue(newProps.loopLength,newProps.internal);
		}
	});

	EventBus.on(EVENT.sampleIndexChange,function(instrumentIndex){
		if (!me.visible) return;
		if (instrumentIndex === currentInstrumentIndex){
			var instrument = Tracker.getInstrument(currentInstrumentIndex);
			EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
		}
	});



	loopCreator.onLoopMarkerChange = function(start, length) {
		repeatSpinbox.setValue(start, true);
		repeatLengthSpinbox.setValue(length, true);
	};

	me.sortZIndex();

	return me;

};

export default SampleView;

