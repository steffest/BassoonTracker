UI.SampleView = function(){

	var me = UI.panel();
	me.hide();

	var currentInstrumentIndex;

	var inputboxHeight = 20;
	var font = window.fontMed;
	font = window.fontCondensed;

	var instrumentName = UI.inputbox({
		name: "instrumentName",
		height: inputboxHeight,
		onChange: function(value){
			if (currentInstrumentIndex){
				var instrument = Tracker.getInstrument(currentInstrumentIndex);
				if (instrument) instrument.name = value;
				EventBus.trigger(EVENT.instrumentNameChange,currentInstrumentIndex);
			}
		}
	});
	me.addChild(instrumentName);

	var waveForm = UI.WaveForm();
	me.addChild(waveForm);

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
		label: "Instrument",
		value: 1,
		max: 64,
		min:1,
		font: font,
		onChange : function(value){Tracker.setCurrentInstrumentIndex(value);}
	});
	sideButtonPanel.addChild(spinBoxInstrument);

	var spinBoxVolume = UI.spinBox({
		name: "Volume",
		label: "Volume",
		value: 64,
		max: 64,
		min:0,
		font: font,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.volume = value;
		}
	});
	sideButtonPanel.addChild(spinBoxVolume);

	var spinBoxFineTune = UI.spinBox({
		name: "Finetune",
		label: "Finetune",
		value: 0,
		max: 7,
		min: -8,
		font: font,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.finetune = value;
		}
	});
	sideButtonPanel.addChild(spinBoxFineTune);

	var spinBoxLength = UI.spinBox({
		name: "Length",
		label: "Length",
		value: 0,
		max: 65535,
		min:0,
		font: font
	});
	sideButtonPanel.addChild(spinBoxLength);

	var spinBoxRepeat = UI.spinBox({
		name: "Repeat",
		label: "Repeat",
		value: 0,
		max: 65535,
		min:0,
		step:2,
		font: font,
		onChange: function(value){
			var instrument= Tracker.getCurrentInstrument();
			if (instrument) instrument.loopStart = value;
			waveForm.refresh();
		}
	});
	sideButtonPanel.addChild(spinBoxRepeat);

	var spinBoxRepeatLength = UI.spinBox({
		name: "Repeat Length",
		label: "Repeat Length",
		value: 0,
		max: 65535,
		min:0,
		step:2,
		font: font,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.loopRepeatLength = value;
			waveForm.refresh();
		}
	});
	sideButtonPanel.addChild(spinBoxRepeatLength);

	var spinBoxRelativeNote = UI.spinBox({
		name: "relativeNote",
		label: "RelativeNote",
		value: 0,
		max: 128,
		min:-127,
		step:1,
		font: font,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.relativeNote = value;
		}
	});
	sideButtonPanel.addChild(spinBoxRelativeNote);

    var spinBoxFadeOut = UI.spinBox({
        name: "fadeOut",
        label: "FadeOut",
        value: 0,
        max: 4046,
        min:-0,
        step:1,
        font: font,
        onChange: function(value){
            var instrument = Tracker.getCurrentInstrument();
            if (instrument) instrument.fadeout = value;
        }
    });
    sideButtonPanel.addChild(spinBoxFadeOut);


	var slider = UI.sliderBox({
		label: "FadeOut",
		font: font,
		height: 40,
		width: 200,
		value: 2000,
		max: 4046,
		min: 0,
		step:1,
		onChange: function(value){
			console.log(value);
		}
	});
	sideButtonPanel.addChild(slider);
	window.slider = slider;

	me.addChild(sideButtonPanel);


	var loadButton = UI.Assets.generate("buttonLight");
	loadButton.setLabel("Load");
	loadButton.onClick = function(){
		EventBus.trigger(EVENT.showView,"diskop_samples");
	};
	me.addChild(loadButton);

	var clearButton = UI.Assets.generate("buttonLight");
	clearButton.setLabel("Clear");
	clearButton.onClick = function(){
		var instrument = Tracker.getInstrument()
	};
	me.addChild(clearButton);

	var reverseButton = UI.Assets.generate("buttonLight");
	reverseButton.setLabel("Reverse");
	reverseButton.onClick = function(){
		var instrument = Tracker.getInstrument(currentInstrumentIndex);
		if (instrument && instrument.sample.data) instrument.sample.data.reverse();
		EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
	};
	me.addChild(reverseButton);

	var closeButton = UI.Assets.generate("buttonLight");
	closeButton.setLabel("Exit");
	closeButton.onClick = function(){
        App.doCommand(COMMAND.showBottomMain);
	};
	me.addChild(closeButton);


	// events
	EventBus.on(EVENT.instrumentChange,function(value){
		currentInstrumentIndex = value;
		spinBoxInstrument.setValue(value,true);
		var instrument = Tracker.getInstrument(value);
		if (instrument){
			instrumentName.setValue(instrument.name,true);
			spinBoxVolume.setValue(instrument.volume);
			spinBoxLength.setValue(instrument.sample.length);
			spinBoxFineTune.setValue(instrument.finetune);
			spinBoxRepeat.setValue(instrument.loopStart);
			spinBoxRepeatLength.setValue(instrument.loopRepeatLength);
			spinBoxRelativeNote.setValue(instrument.relativeNote);
			spinBoxFadeOut.setValue(instrument.fadeout);
			waveForm.setInstrument(instrument);
			volumeEnvelope.setInstrument(instrument);
			panningEnvelope.setInstrument(instrument);
		}else{
			waveForm.setInstrument();
			volumeEnvelope.setInstrument();
			panningEnvelope.setInstrument();
			instrumentName.setValue("",true);
			spinBoxVolume.setValue(0);
			spinBoxLength.setValue(0);
			spinBoxFineTune.setValue(0);
			spinBoxRepeat.setValue(0);
			spinBoxRepeatLength.setValue(0);
			spinBoxRelativeNote.setValue(0);
			spinBoxFadeOut.setValue(0);
		}
	});


	EventBus.on(EVENT.instrumentPlay,function(context){
		if (!me.visible) return;
		if (context && context.instrumentIndex == currentInstrumentIndex){
			waveForm.play(context.startPeriod);
		}
	});

	EventBus.on(EVENT.songPropertyChange,function(song){
		spinBoxInstrument.setMax(song.instruments.length-1);
	});

	EventBus.on(EVENT.trackerModeChanged,function(mode){
		spinBoxFineTune.setMax(mode === TRACKERMODE.PROTRACKER ? 7 : 127);
		spinBoxFineTune.setMin(mode === TRACKERMODE.PROTRACKER ? -8 : -128);
	});

    me.onShow = function(){
        me.onResize();
    };

	me.onResize = function(){

		if (!me.isVisible()) return;
		me.clearCanvas();

		waveForm.setPosition(Layout.col2X,inputboxHeight + Layout.defaultMargin + 8);
		waveForm.setSize(Layout.col4W,100);

		volumeEnvelope.setPosition(Layout.col2X,waveForm.top + waveForm.height + Layout.defaultMargin + 30);
		volumeEnvelope.setSize(Layout.col2W,120);

		panningEnvelope.setPosition(Layout.col4X,volumeEnvelope.top);
		panningEnvelope.setSize(Layout.col2W,volumeEnvelope.height);

		instrumentName.setProperties({
			top: Layout.defaultMargin,
			left: Layout.col2X,
			width: Layout.col4W
		});

		var spinButtonHeight = 28;

		sideButtonPanel.setProperties({
			left:0,
			top: 0,
			width: Layout.col1W,
			height:me.height
		});

		spinBoxInstrument.setProperties({
			left:0,
			top: 0,
			width: sideButtonPanel.width,
			height: spinButtonHeight
		});

		spinBoxVolume.setProperties({
			left:0,
			top: spinButtonHeight,
			width: sideButtonPanel.width,
			height: spinButtonHeight
		});

		spinBoxFineTune.setProperties({
			left:0,
			top: spinButtonHeight * 2,
			width: sideButtonPanel.width,
			height: spinButtonHeight
		});

		spinBoxLength.setProperties({
			left:0,
			top: spinButtonHeight * 3,
			width: sideButtonPanel.width,
			height: spinButtonHeight
		});

		spinBoxRepeat.setProperties({
			left:0,
			top: spinButtonHeight * 4,
			width: sideButtonPanel.width,
			height: spinButtonHeight
		});

		spinBoxRepeatLength.setProperties({
			left:0,
			top: spinButtonHeight * 5,
			width: sideButtonPanel.width,
			height: spinButtonHeight
		});

		spinBoxRelativeNote.setProperties({
			left:0,
			top: spinButtonHeight * 6,
			width: sideButtonPanel.width,
			height: spinButtonHeight
		});

        spinBoxFadeOut.setProperties({
            left:0,
            top: spinButtonHeight * 7,
            width: sideButtonPanel.width,
            height: spinButtonHeight
        });

		slider.setProperties({
			left:0,
			top: spinButtonHeight * 8,
			width: sideButtonPanel.width
		});



		var BottomPanelTop = waveForm.top + waveForm.height + Layout.defaultMargin;

		loadButton.setProperties({
			width: Layout.col1W,
			height: spinButtonHeight,
			left: Layout.col2X,
			top: BottomPanelTop
		});

		clearButton.setProperties({
			width: Layout.col1W,
			height: spinButtonHeight,
			left: Layout.col3X,
			top: BottomPanelTop
		});

		reverseButton.setProperties({
			width: Layout.col1W,
			height: spinButtonHeight,
			left: Layout.col4X,
			top: BottomPanelTop
		});

		closeButton.setProperties({
			width: Layout.col1W,
			height: spinButtonHeight,
			left: Layout.col5X,
			top: BottomPanelTop
		})


	};

	return me;

};

