UI.SampleView = function(x,y,w,h){

	var me = UI.panel(x,y,w,h);
	me.hide();

	var currentSampleIndex;

	var inputboxHeight = 20;

	var sampleName = UI.inputbox({
		name: "sampleName",
		height: inputboxHeight
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
		min:-7,
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
		font: window.fontMed
	});
	sideButtonPanel.addChild(spinBoxRepeat);

	var spinBoxRepeatLength = UI.spinBox({
		name: "Repeat Length",
		label: "Repeat Length",
		value: 0,
		max: 65535,
		min:0,
		font: window.fontMed
	});
	sideButtonPanel.addChild(spinBoxRepeatLength);
	me.addChild(sideButtonPanel);


	// events
	EventBus.on(EVENT.sampleChange,function(event,value){
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


	EventBus.on(EVENT.samplePlay,function(event,context){
		if (!me.visible) return;
		if (context && context.sampleIndex == currentSampleIndex){
			waveForm.play(context.startPeriod);
		}
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


	};

	return me;

};

