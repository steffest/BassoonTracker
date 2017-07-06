UI.SampleView = function(){

	var me = UI.panel();
	me.hide();

	var currentSampleIndex;

	var inputboxHeight = 20;

	var sampleName = UI.inputbox({
		name: "sampleName",
		height: inputboxHeight,
		onChange: function(value){
			if (currentSampleIndex){
				var sample = Tracker.getSample(currentSampleIndex);
				if (sample) sample.name = value;
				EventBus.trigger(EVENT.sampleNameChange,currentSampleIndex);
			}
		}
	});
	me.addChild(sampleName);

	var waveForm = UI.WaveForm();
	me.addChild(waveForm);

	var sideButtonPanel = new UI.panel();
	sideButtonPanel.setProperties({
		name: "sampleSideButtonPanel"
	});

	var spinBoxSample = UI.spinBox({
		name: "Sample",
		label: "Sample",
		value: 1,
		max: 64,
		min:1,
		font: window.fontMed,
		onChange : function(value){Tracker.setCurrentSampleIndex(value);}
	});
	sideButtonPanel.addChild(spinBoxSample);

	var spinBoxVolume = UI.spinBox({
		name: "Volume",
		label: "Volume",
		value: 64,
		max: 64,
		min:0,
		font: window.fontMed,
		onChange: function(value){
			var sample = Tracker.getCurrentSample();
			if (sample) sample.volume = value;
		}
	});
	sideButtonPanel.addChild(spinBoxVolume);

	var spinBoxFineTune = UI.spinBox({
		name: "Finetune",
		label: "Finetune",
		value: 0,
		max: 7,
		min:-8,
		font: window.fontMed,
		onChange: function(value){
			var sample = Tracker.getCurrentSample();
			if (sample) sample.finetune = value;
		}
	});
	sideButtonPanel.addChild(spinBoxFineTune);

	var spinBoxLength = UI.spinBox({
		name: "Length",
		label: "Length",
		value: 0,
		max: 65535,
		min:0,
		font: window.fontMed
	});
	sideButtonPanel.addChild(spinBoxLength);

	var spinBoxRepeat = UI.spinBox({
		name: "Repeat",
		label: "Repeat",
		value: 0,
		max: 65535,
		min:0,
		step:2,
		font: window.fontMed,
		onChange: function(value){
			var sample = Tracker.getCurrentSample();
			if (sample) sample.loopStart = value;
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
		font: window.fontMed,
		onChange: function(value){
			var sample = Tracker.getCurrentSample();
			if (sample) sample.loopRepeatLength = value;
			waveForm.refresh();
		}
	});
	sideButtonPanel.addChild(spinBoxRepeatLength);
	me.addChild(sideButtonPanel);


	var loadButton = UI.Assets.generate("buttonLight");
	loadButton.setLabel("Load");
	loadButton.onClick = function(){
		UI.mainPanel.setView("diskop_samples");
	};
	me.addChild(loadButton);

	var clearButton = UI.Assets.generate("buttonLight");
	clearButton.setLabel("Clear");
	clearButton.onClick = function(){
		var sample = Tracker.getSample()
	};
	me.addChild(clearButton);

	var reverseButton = UI.Assets.generate("buttonLight");
	reverseButton.setLabel("Reverse");
	reverseButton.onClick = function(){
		var sample = Tracker.getSample(currentSampleIndex);
		if (sample && sample.data) sample.data.reverse();
		EventBus.trigger(EVENT.sampleChange,currentSampleIndex);
	};
	me.addChild(reverseButton);

	var closeButton = UI.Assets.generate("buttonLight");
	closeButton.setLabel("Exit");
	closeButton.onClick = function(){
		UI.mainPanel.setView("main");
	};
	me.addChild(closeButton);


	// events
	EventBus.on(EVENT.sampleChange,function(value){
		currentSampleIndex = value;
		spinBoxSample.setValue(value,true);
		var sample = Tracker.getSample(value);
		if (sample){
			sampleName.setValue(sample.name,true);
			spinBoxVolume.setValue(sample.volume);
			spinBoxLength.setValue(sample.length);
			spinBoxFineTune.setValue(sample.finetune);
			spinBoxRepeat.setValue(sample.loopStart);
			spinBoxRepeatLength.setValue(sample.loopRepeatLength);
			waveForm.setSample(sample);
		}else{
			waveForm.setSample();
			sampleName.setValue("",true);
			spinBoxVolume.setValue(0);
			spinBoxLength.setValue(0);
			spinBoxFineTune.setValue(0);
			spinBoxRepeat.setValue(0);
			spinBoxRepeatLength.setValue(0);
		}
	});


	EventBus.on(EVENT.samplePlay,function(context){
		if (!me.visible) return;
		if (context && context.sampleIndex == currentSampleIndex){
			waveForm.play(context.startPeriod);
		}
	});

	EventBus.on(EVENT.songPropertyChange,function(song){
		spinBoxSample.setMax(song.samples.length-1);
	});

	me.setLayout = function(){

		if (!UI.mainPanel) return;
		me.clearCanvas();

		waveForm.setPosition(UI.mainPanel.col2X,inputboxHeight + UI.mainPanel.defaultMargin + 8);
		waveForm.setSize(UI.mainPanel.col4W,100);

		sampleName.setProperties({
			top: UI.mainPanel.defaultMargin,
			left: UI.mainPanel.col2X,
			width: UI.mainPanel.col4W
		});

		var spinButtonHeight = 28;

		sideButtonPanel.setProperties({
			left:0,
			top: 0,
			width: UI.mainPanel.col1W,
			height:me.height
		});

		spinBoxSample.setProperties({
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

		var BottomPanelTop = waveForm.top + waveForm.height + UI.mainPanel.defaultMargin;

		loadButton.setProperties({
			width: UI.mainPanel.col1W,
			height: spinButtonHeight,
			left: UI.mainPanel.col2X,
			top: BottomPanelTop
		});

		clearButton.setProperties({
			width: UI.mainPanel.col1W,
			height: spinButtonHeight,
			left: UI.mainPanel.col3X,
			top: BottomPanelTop
		});

		reverseButton.setProperties({
			width: UI.mainPanel.col1W,
			height: spinButtonHeight,
			left: UI.mainPanel.col4X,
			top: BottomPanelTop
		});

		closeButton.setProperties({
			width: UI.mainPanel.col1W,
			height: spinButtonHeight,
			left: UI.mainPanel.col5X,
			top: BottomPanelTop
		})


	};

	return me;

};

