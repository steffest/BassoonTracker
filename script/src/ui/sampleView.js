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

	var lengthSlider = UI.sliderBox({
		name: "Length",
		label: "Length",
		font: font,
		value: 0,
		max: 65535,
		min:0,
		vertical:true
	});
	sideButtonPanel.addChild(lengthSlider);

	var repeatSlider = UI.sliderBox({
		name: "Repeat",
		label: "Repeat",
		value: 0,
		max: 65535,
		min:0,
		step:2,
		font: font,
		vertical:true,
		onChange: function(value){
			var instrument= Tracker.getCurrentInstrument();
			if (instrument) instrument.loop.start = value;
			waveForm.refresh();
		}
	});
	sideButtonPanel.addChild(repeatSlider);

	var repeatLengthSlider = UI.sliderBox({
		name: "Repeat Length",
		label: "Repeat Length",
		value: 0,
		max: 65535,
		min:0,
		step:2,
		font: font,
		vertical:true,
		onChange: function(value){
			var instrument = Tracker.getCurrentInstrument();
			if (instrument) instrument.loop.length = value;
			waveForm.refresh();
		}
	});
	sideButtonPanel.addChild(repeatLengthSlider);

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


	// events
	EventBus.on(EVENT.instrumentChange,function(value){
		currentInstrumentIndex = value;
		spinBoxInstrument.setValue(value,true);
		var instrument = Tracker.getInstrument(value);
		if (instrument){

			repeatSlider.setMax(instrument.sample.length,true);
			repeatLengthSlider.setMax(instrument.sample.length,true);


			instrumentName.setValue(instrument.name,true);
			volumeSlider.setValue(instrument.volume);
			lengthSlider.setValue(instrument.sample.length);
			fineTuneSlider.setValue(instrument.getFineTune());

			repeatSlider.setValue(instrument.loop.start,true);
			repeatLengthSlider.setValue(instrument.loop.length,true);

			spinBoxRelativeNote.setValue(instrument.relativeNote);
			fadeOutSlider.setValue(instrument.fadeout || 0);
			waveForm.setInstrument(instrument);
			volumeEnvelope.setInstrument(instrument);
			panningEnvelope.setInstrument(instrument);


		}else{
			waveForm.setInstrument();
			volumeEnvelope.setInstrument();
			panningEnvelope.setInstrument();
			instrumentName.setValue("",true);
			volumeSlider.setValue(0);
			lengthSlider.setValue(0);
			fineTuneSlider.setValue(0);
			repeatSlider.setValue(0);
			repeatLengthSlider.setValue(0);
			spinBoxRelativeNote.setValue(0);
			fadeOutSlider.setValue(0);
		}
	});


	EventBus.on(EVENT.instrumentPlay,function(context){
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

    me.onShow = function(){
        me.onResize();
    };

	me.onResize = function(){

		if (!me.isVisible()) return;
		me.clearCanvas();

		var envelopeHeight = 130;
        var spinButtonHeight = 28;

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

		var sliderWidth = Math.ceil(sideButtonPanel.width/3);
		var sliderHeight = Math.floor(sideButtonPanel.height/2);

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
			left:sliderWidth*2,
			top: 0,
			width: sliderWidth,
			height: sliderHeight
		});

		lengthSlider.setProperties({
			left:0,
			top: sliderHeight,
			width: sliderWidth,
			height: sliderHeight
		});

		repeatSlider.setProperties({
			left:sliderWidth,
			top: sliderHeight,
			width: sliderWidth,
			height: sliderHeight
		});

		repeatLengthSlider.setProperties({
			left:sliderWidth*2,
			top: sliderHeight,
			width: sliderWidth,
			height: sliderHeight
		});

		spinBoxRelativeNote.setProperties({
			left:0,
			top: sliderHeight,
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
		})


	};

	return me;

};

