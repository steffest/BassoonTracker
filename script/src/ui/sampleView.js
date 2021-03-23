UI.SampleView = function(){

	var me = UI.panel();
	me.name = "SampleView";
	me.hide();

	var currentInstrumentIndex;
	var subPanel = "loop";

	var inputboxHeight = 20;
	var font = window.fontMed;
	font = window.fontCondensed;

	var instrumentName = UI.inputbox({
		name: "instrumentName",
		height: inputboxHeight,
		trackUndo: true,
		undoInstrument: true,
		onChange: function(value){
			if (currentInstrumentIndex){
				var instrument = Tracker.getInstrument(currentInstrumentIndex);
				if (instrument) instrument.name = value;
				EventBus.trigger(EVENT.instrumentNameChange,currentInstrumentIndex);
			}
		}
	});
	me.addChild(instrumentName);

	var closeButton = UI.Assets.generate("button20_20");
	closeButton.setLabel("x");
	closeButton.onClick = function(){
		App.doCommand(COMMAND.showBottomMain);
	};
	me.addChild(closeButton);

	var buttonProperties = {
		background: UI.Assets.buttonKeyScale9,
		activeBackground:UI.Assets.buttonKeyActiveScale9,
		isActive:false,
		textAlign: "center",
		font: window.fontDark,
		paddingTopActive: 1
	};

	var bit8Button = UI.button();
	var bit16Button = UI.button();

	bit8Button.setProperties(buttonProperties);
	bit8Button.setLabel("8");
	bit8Button.setActive(true);
	bit8Button.onDown = function(){
		changeSampleBit(8);
	};
	me.addChild(bit8Button);
	bit16Button.setProperties(buttonProperties);
	bit16Button.setLabel("16");
	bit16Button.onDown = function(){
		changeSampleBit(16);
	};
	me.addChild(bit16Button);


	var waveForm = UI.WaveForm();
	me.addChild(waveForm);

	waveForm.onMouseWheel = function(touchData){
		if (touchData.mouseWheels[0] > 0){
			waveForm.zoom(1.01)
		}else{
			waveForm.zoom(0.99)
		}
	};


	var volumeEnvelope = UI.EnvelopePanel("volume");
	me.addChild(volumeEnvelope);

	var panningEnvelope = UI.EnvelopePanel("panning");
	me.addChild(panningEnvelope);

	var sideButtonPanel = new UI.panel();
	sideButtonPanel.setProperties({
		name: "instrumentSideButtonPanel"
	});

	var spinBoxInstrument = UI.spinBox({
		name: "Instrument",
		label: "",
		value: 1,
		max: 64,
		padLength: 2,
		min:1,
		font: font,
		onChange : function(value){Tracker.setCurrentInstrumentIndex(value);}
	});
	me.addChild(spinBoxInstrument);


	var volumeSlider = UI.sliderBox({
		name: "Volume",
		label: "Volume",
		font: font,
		height: 200,
		width: 40,
		value: 64,
		max: 64,
		min: 0,
		step:1,
		vertical:true,
		trackUndo: true,
		undoInstrument: true,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) {
				instrument.sample.volume = value;
			}
		}
	});
	sideButtonPanel.addChild(volumeSlider);

	var fineTuneSlider = UI.sliderBox({
		name: "Finetune",
		label: "Finetune",
		font: font,
		value: 0,
		max: 7,
		min: -8,
		step:1,
		vertical:true,
		trackUndo: true,
		undoInstrument: true,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.setFineTune(value);
		}
	});
	sideButtonPanel.addChild(fineTuneSlider);

	var panningSlider = UI.sliderBox({
		name: "Panning",
		label: "Panning",
		font: font,
		value: 0,
		max: 127,
		min: -127,
		vertical:true,
		trackUndo: true,
		undoInstrument: true,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) {
				instrument.panning = value;
				instrument.sample.panning = value;
			}
		}
	});
	sideButtonPanel.addChild(panningSlider);

	var repeatSpinbox = UI.spinBox({
		name: "Repeat",
		label: "Start",
		value: 0,
		max: 65535,
		min:0,
		step:2,
		font: font,
		trackUndo: true,
		undoInstrument: true,
		onChange: function(value){
			var instrument= Tracker.getCurrentInstrument();
            if (instrument){
                if ((instrument.sample.loop.length+value)>instrument.sample.length) {
                    value = instrument.sample.length-instrument.sample.loop.length;
                    repeatSpinbox.setValue(value,true);
                }
                instrument.sample.loop.start = value;
            }
			waveForm.refresh();
		}
	});
	sideButtonPanel.addChild(repeatSpinbox);

	var repeatLengthSpinbox = UI.spinBox({
		name: "Repeat Length",
		label: "Length",
		value: 0,
		max: 65535,
		min:0,
		step:2,
		font: font,
		trackUndo: true,
		undoInstrument: true,
		onChange: function(value){
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
		}
	});
	sideButtonPanel.addChild(repeatLengthSpinbox);

	var fadeOutSlider = UI.sliderBox({
		name: "Fadeout",
		label: "Fadeout",
		value: 0,
		max: 4095,
		min:0,
		step:1,
		font: font,
		vertical:true,
		trackUndo: true,
		undoInstrument: true,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.fadeout = value;
		}
	});
	sideButtonPanel.addChild(fadeOutSlider);

	var spinBoxRelativeNote = UI.spinBox({
		name: "relativeNote",
		label: "RelativeNote",
		value: 0,
		max: 128,
		min:-127,
		step:1,
		font: font,
		trackUndo: true,
		undoInstrument: true,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) {
				instrument.sample.relativeNote = value;
			}
		}
	});
	sideButtonPanel.addChild(spinBoxRelativeNote);



    var spinBoxVibratoSpeed = UI.spinBox({
        name: "vibratoSpeed",
        label: "Vib Speed",
        value: 0,
        max: 63,
        min:0,
        step:1,
        font: font,
		trackUndo: true,
		undoInstrument: true,
        onChange: function(value){
            var instrument = Tracker.getCurrentInstrument();
            if (instrument) {
                instrument.vibrato.rate = value;
            }
        }
    });
    sideButtonPanel.addChild(spinBoxVibratoSpeed);
    spinBoxVibratoSpeed.hide();

    var spinBoxVibratoDepth = UI.spinBox({
        name: "vibratoDepth",
        label: "Vib Depth",
        value: 0,
        max: 15,
        min:0,
        step:1,
        font: font,
		trackUndo: true,
		undoInstrument: true,
        onChange: function(value){
            var instrument = Tracker.getCurrentInstrument();
            if (instrument) {
                instrument.vibrato.depth = value;
            }
        }
    });
    sideButtonPanel.addChild(spinBoxVibratoDepth);
    spinBoxVibratoDepth.hide();

    var spinBoxVibratoSweep = UI.spinBox({
        name: "vibratoSweep",
        label: "Vib Sweep",
        value: 0,
        max: 255,
        min:0,
        step:1,
        font: font,
		trackUndo: true,
		undoInstrument: true,
        onChange: function(value){
            var instrument = Tracker.getCurrentInstrument();
            if (instrument) {
                instrument.vibrato.sweep = value;
            }
        }
    });
    sideButtonPanel.addChild(spinBoxVibratoSweep);
    spinBoxVibratoSweep.hide();

    var waveLabels = ["sin","square","saw","saw_inverse"];
    var waveButtons = [];
    waveLabels.forEach(function(label,index){
        var button = UI.button();
        button.setProperties({
            background: UI.Assets.buttonKeyScale9,
            activeBackground:UI.Assets.buttonKeyActiveScale9,
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
			sampleDisplayPanel.toggle();
			sampleSelectPanel.toggle();
			sampleEditPanel.toggle();
			sampleVolumePanel.toggle();

			volumeEnvelope.toggle();
			panningEnvelope.toggle();

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
		{label: "None" , width: 50, onClick : function(){
				waveForm.select("none");
			}},
		{label: "Loop", width: 50 , onClick : function(){
				waveForm.select("loop");
			}},
		{label: "Cut", width: 50, onClick : function(){
				UI.cutSelection();
			}},
		{label: "Copy", width: 50, onClick : function(){
				UI.copySelection();
			}},
		{label: "Paste", onClick : function(){
				UI.pasteSelection();
			}}

	];

	buttonsInfo.forEach(function(buttonInfo){
		var button = UI.Assets.generate("buttonLight");
		button.setLabel(buttonInfo.label);
		button.onClick = buttonInfo.onClick;
		button.onDown = buttonInfo.onDown;
		button.onTouchUp = buttonInfo.onUp;
		me.addChild(button);
		buttons.push(button);
	});

	var sampleDisplayPanel = UI.buttonGroup("Display",buttonsDisplay);
	var sampleSelectPanel = UI.buttonGroup("Select",buttonsSelect);
	var sampleEditPanel = UI.buttonGroup("Edit",buttonsEdit);
	var sampleVolumePanel = UI.buttonGroup("Volume",buttonsVolume);
	me.addChild(sampleDisplayPanel);
	me.addChild(sampleSelectPanel);
	me.addChild(sampleEditPanel);
	me.addChild(sampleVolumePanel);



    var loopTitleBar = UI.button();
    loopTitleBar.setProperties({
        background: UI.Assets.panelDarkGreyScale9,
        activeBackground: UI.Assets.panelDarkGreyBlueScale9,
        isActive:false,
        label: "Loop",
        font: fontSmall,
        paddingTop: 2,
        paddingTopActive: 2,
		paddingLeft: 20
    });
    loopTitleBar.onDown = function(){
        setSubPanel("loop");
    };
    me.addChild(loopTitleBar);


	var loopEnabledCheckbox = UI.checkbox();
	loopEnabledCheckbox.onToggle = function(checked){
		var instrument = Tracker.getInstrument(currentInstrumentIndex);
		if (instrument) instrument.sample.loop.enabled = checked;

		repeatSpinbox.setDisabled(!checked);
		repeatLengthSpinbox.setDisabled(!checked);
		waveForm.refresh();
	};
	me.addChild(loopEnabledCheckbox);

    var vibratoTitleBar = UI.button();
    vibratoTitleBar.setProperties({
        background: UI.Assets.panelDarkGreyScale9,
        activeBackground: UI.Assets.panelDarkGreyBlueScale9,
        isActive:false,
        label: "Vibrato",
        font: fontSmall,
        paddingTop: 2,
        paddingTopActive: 2
    });
    vibratoTitleBar.onDown = function(){
        setSubPanel("vibrato");
    };
    me.addChild(vibratoTitleBar);

    me.onShow = function(){
    	Input.setFocusElement(me);
        me.onResize();
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

		waveForm.setPosition(Layout.col2X,inputboxHeight + Layout.defaultMargin + 8);
		waveForm.setSize(Layout.col4W,me.height - waveForm.top - envelopeHeight - spinButtonHeight - 8);

		volumeEnvelope.setPosition(Layout.col2X,waveForm.top + waveForm.height + Layout.defaultMargin + 30);
		volumeEnvelope.setSize(Layout.col2W,envelopeHeight);

		panningEnvelope.setPosition(Layout.col4X,volumeEnvelope.top);
		panningEnvelope.setSize(Layout.col2W,envelopeHeight);


		sampleEditPanel.setSize(Layout.col1W,envelopeHeight);
		sampleDisplayPanel.setSize(Layout.col1W,envelopeHeight);
		sampleSelectPanel.setSize(Layout.col1W,envelopeHeight);
		sampleVolumePanel.setSize(Layout.col1W,envelopeHeight);

		sampleDisplayPanel.setPosition(Layout.col2X,waveForm.top + waveForm.height + Layout.defaultMargin + 30);
		sampleSelectPanel.setPosition(Layout.col3X,sampleDisplayPanel.top);
		sampleEditPanel.setPosition(Layout.col4X,sampleDisplayPanel.top);
		sampleVolumePanel.setPosition(Layout.col5X,sampleDisplayPanel.top);

		var bitButtonSpace = 0;
		var bitButtonOffScreen = 100;
		if (Tracker.inFTMode()){
			bitButtonSpace = 40;
			bitButtonOffScreen = 0;
		}

		instrumentName.setProperties({
			top: Layout.defaultMargin,
			left: Layout.col2X + 71,
			width: Layout.col4W - 71 - 25 - Layout.defaultMargin - bitButtonSpace
		});

		closeButton.setProperties({
			top: Layout.defaultMargin,
			left: instrumentName.left + instrumentName.width + Layout.defaultMargin + bitButtonSpace
		});

		bit8Button.setProperties({
			top: Layout.defaultMargin,
			width: 20,
			height: 20,
			left: instrumentName.left + instrumentName.width + Layout.defaultMargin - 2 + bitButtonOffScreen
		});
		bit16Button.setProperties({
			top: Layout.defaultMargin,
			width: 20,
			height: 20,
			left: instrumentName.left + instrumentName.width + Layout.defaultMargin + 18 + bitButtonOffScreen
		});


		sideButtonPanel.setProperties({
			left:0,
			top: 0,
			width: Layout.col1W,
			height:me.height
		});


		spinBoxInstrument.setProperties({
			left:Layout.col2X,
			top: 1,
			width: 68,
			height: spinButtonHeight
		});

		volumeSlider.setProperties({
			left:0,
			top: 0,
			width: sliderWidth,
			height: sliderHeight
		});

		fineTuneSlider.setProperties({
			left:sliderWidth,
			top: 0,
			width: sliderWidth,
			height: sliderHeight
		});

		fadeOutSlider.setProperties({
			left:sliderRow2Left,
			top: sliderRow2Top,
			width: sliderWidth,
			height: sliderHeight
		});

		panningSlider.setProperties({
			left:sliderRow2Left + sliderWidth,
			top: sliderRow2Top,
			width: sliderWidth,
			height: sliderHeight
		});


		var BottomPanelTop = waveForm.top + waveForm.height + Layout.defaultMargin;

		var buttonWidth = Layout.col4W / buttons.length;
		buttons.forEach(function(button,index){
			button.setProperties({
				width: buttonWidth,
				height: spinButtonHeight,
				left: Layout.col2X + (buttonWidth*index),
				top: BottomPanelTop
			});
		});

		loopTitleBar.setProperties({
			width: Layout.col1W/2,
			height: 18,
			left: 2,
			top: volumeEnvelope.top
		});

		loopEnabledCheckbox.setPosition(loopTitleBar.left+2,loopTitleBar.top+2);

        vibratoTitleBar.setProperties({
            width: loopTitleBar.width,
            height: loopTitleBar.height,
            left: loopTitleBar.left + loopTitleBar.width,
            top: loopTitleBar.top
        });

		var loopSpinnerHeight = 34;
		var vibratoSpinnerHeight = 30;

		repeatSpinbox.setProperties({
			left:0,
			top: loopTitleBar.top + 24,
			width: Layout.col1W,
			height: loopSpinnerHeight
		});

		repeatLengthSpinbox.setProperties({
			left:0,
			top: loopTitleBar.top + 24 + loopSpinnerHeight,
			width: Layout.col1W,
			height: loopSpinnerHeight
		});

		spinBoxRelativeNote.setProperties({
			left:0,
			top: loopTitleBar.top + 24 + (loopSpinnerHeight*2),
			width: Layout.col1W,
			height: loopSpinnerHeight
		});

        spinBoxVibratoSpeed.setProperties({
            left:0,
            top: vibratoTitleBar.top + 22,
            width: Layout.col1W,
            height: vibratoSpinnerHeight
        });

        spinBoxVibratoDepth.setProperties({
            left:0,
            top: vibratoTitleBar.top + 22 + vibratoSpinnerHeight,
            width: Layout.col1W,
            height: vibratoSpinnerHeight
        });

        spinBoxVibratoSweep.setProperties({
            left:0,
            top: vibratoTitleBar.top + 22 + (vibratoSpinnerHeight*2),
            width: Layout.col1W,
            height: vibratoSpinnerHeight
        });

        var waveButtonWidth = Math.floor((Layout.col1W-4)/4);
        var marginLeft = Layout.col1W - (waveButtonWidth*4);
        waveButtons.forEach(function(button,index){
            button.setProperties({
                left: marginLeft + index*waveButtonWidth,
                top: vibratoTitleBar.top + 22 + (vibratoSpinnerHeight*3),
                width: waveButtonWidth,
                height: 17
            });
		})

	};


	function changeSampleBit(amount){
		var instrument = Tracker.getCurrentInstrument();
		if (instrument) {
			if (amount === 16){
				instrument.sample.bits = 16;
				bit8Button.setActive(false);
				bit16Button.setActive(true);
			}else{
				for (var i = 0, max = instrument.sample.data.length; i<max;i++){
					instrument.sample.data[i] = Math.round(instrument.sample.data[i]*127)/127;
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
		spinBoxInstrument.setMax(song.instruments.length-1);
	});

	EventBus.on(EVENT.trackerModeChanged,function(mode){
		fineTuneSlider.setMax(mode === TRACKERMODE.PROTRACKER ? 7 : 127,true);
		fineTuneSlider.setMin(mode === TRACKERMODE.PROTRACKER ? -8 : -128,true);

		var instrument = Tracker.getInstrument(currentInstrumentIndex);
		if (instrument){
			fineTuneSlider.setValue(instrument.getFineTune(),true);
		}

		volumeEnvelope.setDisabled(!Tracker.inFTMode());
		panningEnvelope.setDisabled(!Tracker.inFTMode());
		spinBoxRelativeNote.setDisabled(!Tracker.inFTMode());
		spinBoxVibratoSpeed.setDisabled(!Tracker.inFTMode());
        spinBoxVibratoDepth.setDisabled(!Tracker.inFTMode());
        spinBoxVibratoSweep.setDisabled(!Tracker.inFTMode());
		fadeOutSlider.setDisabled(!Tracker.inFTMode());
		panningSlider.setDisabled(!Tracker.inFTMode());
		spinBoxInstrument.setMax(Tracker.getMaxInstruments());

		if (mode === TRACKERMODE.PROTRACKER){
			repeatSpinbox.setProperties({step:2});
			repeatLengthSpinbox.setProperties({step:2});
			if (instrument){
				instrument.sample.loop.start = Math.floor(instrument.sample.loop.start/2)*2;
				instrument.sample.loop.length = Math.floor(instrument.sample.loop.length/2)*2;
				repeatSpinbox.setValue(instrument.sample.loop.start,true);
				repeatLengthSpinbox.setValue(instrument.sample.loop.length,true);
			}
			setSubPanel("loop");
		}else{
			repeatSpinbox.setProperties({step:1});
			repeatLengthSpinbox.setProperties({step:1});
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



	return me;

};

