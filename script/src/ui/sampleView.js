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
		label: "",
		value: 1,
		max: 64,
		padLength: 2,
		min:1,
		font: font,
		onChange : function(value){Tracker.setCurrentInstrumentIndex(value);}
	});
	me.addChild(spinBoxInstrument);



	/*var spinBoxVolume = UI.spinBox({
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
	});*/


	var volumeSlider = UI.sliderBox({
		label: "Volume",
		font: font,
		height: 200,
		width: 40,
		value: 64,
		max: 64,
		min: 0,
		step:1,
		vertical:true,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.volume = value;
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
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.panning = value;
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
		onChange: function(value){
			var instrument= Tracker.getCurrentInstrument();
			if (instrument) instrument.loop.start = value;
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
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.loop.length = value;
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
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.relativeNote = value;
		}
	});
	sideButtonPanel.addChild(spinBoxRelativeNote);



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


	var loopTitleBar = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkGreyScale9);
	loopTitleBar.ignoreEvents = true;
	me.addChild(loopTitleBar);

	var loopTitleLabel = UI.label({
		label: "Loop",
		font: fontSmall,
		width: 50
	});
    loopTitleLabel.onClick = function() {
        loopEnabledCheckbox.toggle();
    };
	me.addChild(loopTitleLabel);

	var loopEnabledCheckbox = UI.checkbox();
	loopEnabledCheckbox.onToggle = function(checked){
		var instrument = Tracker.getInstrument(currentInstrumentIndex);
		if (instrument) instrument.loop.enabled = checked;

		repeatSpinbox.setDisabled(!checked);
		repeatLengthSpinbox.setDisabled(!checked);
		waveForm.refresh();
	};
	me.addChild(loopEnabledCheckbox);


	// events
	EventBus.on(EVENT.instrumentChange,function(value){
		currentInstrumentIndex = value;
		spinBoxInstrument.setValue(value,true);
		var instrument = Tracker.getInstrument(value);
		if (instrument){

			repeatSpinbox.setMax(instrument.sample.length,true);
			repeatLengthSpinbox.setMax(instrument.sample.length,true);


			instrumentName.setValue(instrument.name,true);
			volumeSlider.setValue(instrument.volume);
			panningSlider.setValue(instrument.panning || 0);
			fineTuneSlider.setValue(instrument.getFineTune());

			repeatSpinbox.setValue(instrument.loop.start,true);
			repeatLengthSpinbox.setValue(instrument.loop.length,true);

			spinBoxRelativeNote.setValue(instrument.relativeNote);
			fadeOutSlider.setValue(instrument.fadeout || 0);
			waveForm.setInstrument(instrument);
			volumeEnvelope.setInstrument(instrument);
			panningEnvelope.setInstrument(instrument);

			loopEnabledCheckbox.setState(instrument.loop.enabled);


		}else{
			waveForm.setInstrument();
			volumeEnvelope.setInstrument();
			panningEnvelope.setInstrument();
			instrumentName.setValue("",true);
			volumeSlider.setValue(0);
			panningSlider.setValue(0);
			fineTuneSlider.setValue(0);
			repeatSpinbox.setValue(0);
			repeatLengthSpinbox.setValue(0);
			spinBoxRelativeNote.setValue(0);
			fadeOutSlider.setValue(0);
		}
	});


	EventBus.on(EVENT.samplePlay,function(context){
		if (!me.visible) return;
		if (context && context.instrumentIndex === currentInstrumentIndex){
			waveForm.play(context.startPeriod);
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
	});

	EventBus.on(EVENT.samplePropertyChange,function(newProps){
		var instrument = Tracker.getInstrument(currentInstrumentIndex);
		if (instrument){
			if (typeof newProps.loopStart !== "undefined") repeatSpinbox.setValue(newProps.loopStart);
			if (typeof newProps.loopLength !== "undefined") repeatLengthSpinbox.setValue(newProps.loopLength);
		}
	});

    me.onShow = function(){
        me.onResize();
    };

	me.onResize = function(){

		if (!me.isVisible()) return;
		me.clearCanvas();

		var envelopeHeight = 130;
        var spinButtonHeight = 28;
        var sliderHeight = sideButtonPanel.height - envelopeHeight- 10;
		var sliderWidth = Math.ceil(sideButtonPanel.width/4);
		var sliderRow2Top = 0;
		var sliderRow2Left = sliderWidth*2;

		console.error(sideButtonPanel.width);
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

		instrumentName.setProperties({
			top: Layout.defaultMargin,
			left: Layout.col2X + 71,
			width: Layout.col4W - 71
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
		});

		loopTitleBar.setProperties({
			width: Layout.col1W,
			height: 18,
			left: 2,
			top: volumeEnvelope.top
		});

		loopEnabledCheckbox.setPosition(loopTitleBar.left+2,loopTitleBar.top+2);
		loopTitleLabel.setPosition(loopTitleBar.left+12,loopTitleBar.top+1);

		var loopSpinnerHeight = 34;

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

	};

	return me;

};

