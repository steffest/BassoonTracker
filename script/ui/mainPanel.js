UI.MainPanel = function(){
	var me = UI.panel(0,0,canvas.width,canvas.height,true);
	me.name = "mainPanel";
	var i;
	var trackControls = [];
	var currentView = "main";

	var mainBack = UI.scale9Panel(0,0,me.width,me.height,UI.Assets.panelMainScale9);
	me.addChild(mainBack);

	// menu
	var menuBackground = UI.scale9Panel(0,0,0,0,UI.Assets.menuMainScale9);
	me.addChild(menuBackground);

	var logo = UI.button();
	logo.setProperties({
		background: UI.Assets.panelInsetScale9,
		activeBackground: UI.Assets.buttonDarkScale9,
		image: cachedAssets.images["skin/logo_grey_70.png"],
		activeImage: cachedAssets.images["skin/logo_colour_70.png"]
	});
	logo.onClick = function(){
		console.error("click");
		logo.toggleActive();
		console.error(logo.isActive);
	};
	me.addChild(logo);

	//mod name
	var modNameInputBox = UI.inputbox({
		name: "modName",
		onChange: function(value){
			Tracker.getSong().title = value;
		}
	});
	me.addChild(modNameInputBox);

	// instrument listbox
	var listbox = UI.listbox();
	listbox.setItems([
		{label: "abem 1", data: 1},
		{label: "item 2", data: 2},
		{label: "item 3", data: 3}
	]);
	me.addChild(listbox);
	listbox.onClick = function(e){
		Input.setFocusElement(listbox);
		var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
		if (item){
			Audio.playSample(item.data);
			Tracker.setCurrentSampleIndex(item.data);
		}
	};


	var songPanel = UI.scale9Panel(0,0,0,0,UI.Assets.panelInsetScale9);
	me.addChild(songPanel);

	var songlistbox = UI.listbox();
	songlistbox.setItems([
		{label: "00:01", data: 1}
	]);
	me.addChild(songlistbox);

	var spPlus = UI.Assets.generate("button20_20");
	spPlus.setLabel("↑");
	spPlus.onClick = function(){
		var index = songlistbox.getSelectedIndex();
		var pattern = Tracker.getSong().patternTable[index];
		pattern++;
		Tracker.updatePatternTable(index,pattern);

	};
	me.addChild(spPlus);

	var spMin = UI.Assets.generate("button20_20");
	spMin.setLabel("↓");
	spMin.onClick = function(){
		var index = songlistbox.getSelectedIndex();
		var pattern = Tracker.getSong().patternTable[index];
		if (pattern>0) pattern--;
		Tracker.updatePatternTable(index,pattern);
	};
	me.addChild(spMin);

	for (i=0;i<4;i++){
		trackControls[i] = UI.trackControl();
		me.addChild(trackControls[i]);
	}

	var songControl = UI.songControl();
	me.addChild(songControl);

	var patternPanel = UI.scale9Panel(0,0,0,0,UI.Assets.panelInsetScale9);
	me.addChild(patternPanel);
	var spinBoxPattern = UI.spinBox();
	me.addChild(spinBoxPattern);
	var spinBoxPatternLength = UI.spinBox({
		value: 64,
		name: "PatternLength",
		label: "Length",
		max: 64,
		min:64,
		font: window.fontMed
	});
	me.addChild(spinBoxPatternLength);
	var spinBoxSample = UI.spinBox({
		name: "Sample",
		label: "Sample",
		value: 1,
		max: 64,
		min:1,
		font: window.fontMed,
		onChange : function(value){Tracker.setCurrentSampleIndex(value);}
	});
	me.addChild(spinBoxSample);


	var buttons = [];
	var buttonsSide = [];
	var buttonsInfo=[
		{label:"Play", onClick:function(){Tracker.playSong()}},
		{label:"Play Pattern", onClick:function(){Tracker.playPattern()}},
		{label:"Stop", onClick:function(){Tracker.stop();}},
		{label:"Save", oncClick:function(){Tracker.save();}},
		//{label:"Record", onClick:function(){Tracker.toggleRecord();}},
		{label:"Sample Editor", onClick:function(){UI.toggleSampleEditor();}}
	];

	for (i = 0;i<buttonsInfo.length;i++){
		var buttonInfo = buttonsInfo[i];
		var buttonElm = UI.button();
		buttonElm.info = buttonInfo;
		buttonElm.onClick =  buttonInfo.onClick;
		buttons[i] = buttonElm;
		me.addChild(buttonElm);
	}

	var buttonsSideInfo=[
		{label:"Lotus 2", onClick:function(){Tracker.load('demomods/lotus20.mod')}},
		{label:"Lotus 1", onClick:function(){Tracker.load('demomods/lotus10.mod')}},
		{label:"Stardust", onClick:function(){Tracker.load('demomods/StardustMemories.mod')}},
		{label:"Monday", onClick:function(){Tracker.load('demomods/Monday.mod')}},
		{label:"Lunatic", onClick:function(){Tracker.load('demomods/sound-of-da-lunatic.mod')}},
		{label:"Tinytune", onClick:function(){Tracker.load('demomods/Tinytune.mod')}},
		{label:"Exodus baum", onClick:function(){Tracker.load('demomods/exodus-baum_load.mod')}},
		{label:"Demomusic", onClick:function(){Tracker.load('demomods/demomusic.mod')}},
		{label:"Space Debris", onClick:function(){Tracker.load('demomods/spacedeb.mod')}},
		{label:"Test", onClick:function(){Tracker.load('demomods/vibrato.mod')}}
	];

	var sideButtonPanel = new UI.panel();
	sideButtonPanel.setProperties({
		name: "sideButtonPanel"
	});

	for (i = 0;i< buttonsSideInfo.length;i++){
		var buttonSideInfo = buttonsSideInfo[i];
		var buttonElm = UI.button();
		buttonElm.info = buttonSideInfo;
		buttonElm.onClick =  buttonSideInfo.onClick;
		buttonsSide[i] = buttonElm;
		//me.addChild(buttonElm);
		sideButtonPanel.addChild(buttonElm);
	}
	me.addChild(sideButtonPanel);

	var spinBoxSongLength = UI.spinBox({
		name: "SongLength",
		label: "SongLen",
		value: 1,
		max: 200,
		min:1,
		font: window.fontMed,
		onChange : function(value){
			var currentLength = Tracker.getSong().length;
			if (currentLength>value){
				Tracker.removeFromPatternTable();
			}else if(currentLength<value){
				Tracker.addToPatternTable();
			}

		}
	});
	me.addChild(spinBoxSongLength);

	var spinBoxBmp = UI.spinBox({
		name: "BPM",
		label: "BPM",
		value: 125,
		max: 200,
		min:30,
		font: window.fontMed,
		onChange : function(value){Tracker.setBPM(value)}
	});
	me.addChild(spinBoxBmp);

	var patternView = UI.PatternView();
	me.addChild(patternView);

	var sampleView = UI.SampleView();
	me.addChild(sampleView);

	// events
	EventBus.on(EVENT.songPropertyChange,function(event,song){
		modNameInputBox.setValue(song.title,true);
		spinBoxSongLength.setValue(song.length,true);
	});

	EventBus.on(EVENT.sampleChange,function(event,value){
		spinBoxSample.setValue(value,true);
	});
	EventBus.on(EVENT.patternChange,function(event,value){
		spinBoxPattern.setValue(value,true);
		patternView.refresh();
	});
	EventBus.on(EVENT.patternPosChange,function(event,value){
		patternView.refresh();
	});
	EventBus.on(EVENT.cursorPositionChange,function(event,value){
		patternView.refresh();
	});
	EventBus.on(EVENT.recordingChange,function(event,value){
		patternView.refresh();
	});
	EventBus.on(EVENT.trackStateChange,function(event,state){
		// set other tracks to mute if a track is soloed
		if (state.solo && typeof state.track != "undefined"){
			for (i = 0;i< 4;i++){
				if (i != state.track){
					trackControls[i].setProperties({mute:true});
				}
			}
		}
	});

	EventBus.on(EVENT.songPositionChange,function(event,value){
		songlistbox.setSelectedIndex(value,true);
	});
	EventBus.on(EVENT.patternTableChange,function(event,value){
		me.setPatternTable(Tracker.getSong().patternTable);
	});

	EventBus.on(EVENT.sampleChange,function(event,value){
		listbox.setSelectedIndex(value-1);
	});

	EventBus.on(EVENT.songBPMChange,function(event,value){
		spinBoxBmp.setValue(value,true);
	});

	EventBus.on(EVENT.sampleNameChange,function(event,sampleIndex){
		var sample = Tracker.getSample(sampleIndex);
		if (sample){
			var instruments = me.getInstruments();
			for (var i = 0, len = instruments.length; i<len;i++){
				if (instruments[i].data == sampleIndex){
					instruments[i].label = sampleIndex + " " + sample.name;
					UI.mainPanel.setInstruments(instruments);
					break;
				}
			}
		}
	});

	me.setLayout = function(newX,newY,newW,newH){
		me.clearCanvas();

		me.width = newW;
		me.height = newH;

		// UI coordinates
		me.defaultMargin =  4;
		me.menuHeight = 20;

		me.controlPanelHeight = 200;
		me.equaliserPanelHeight = 60;
		me.equaliserPanelY = me.controlPanelHeight;

		me.controlBarHeight = 30;
		me.controlBarTop = me.equaliserPanelY + me.equaliserPanelHeight;

		me.patternTop = me.controlBarTop + me.controlBarHeight + 2;
		me.patternHeight = me.height - me.patternTop - me.defaultMargin;

		me.col1W = Math.floor((me.width - (6*me.defaultMargin)- 3)/5);
		me.col2W = (me.col1W*2) + me.defaultMargin;
		me.col3W = (me.col1W*3) + (me.defaultMargin*2);
		me.col4W = (me.col1W*4) + (me.defaultMargin*3);
		me.col5W = (me.col1W*5) + (me.defaultMargin*4);

		me.col1X = me.defaultMargin;
		me.col2X = (me.defaultMargin*2) + me.col1W;
		me.col3X = (me.defaultMargin*3) + (me.col1W*2);
		me.col4X = (me.defaultMargin*4) + (me.col1W*3);
		me.col5X = (me.defaultMargin*5) + (me.col1W*4);

		var spinButtonHeight = 28;
		var songPanelHeight = spinButtonHeight*3 + me.defaultMargin + 2;

		menuBackground.setSize(me.col2W ,me.menuHeight);

		mainBack.setSize(me.width,me.height);

		var topPanelHeight = me.controlPanelHeight - me.menuHeight - (me.defaultMargin*2);
		var topPaneltop = me.menuHeight + me.defaultMargin

		modNameInputBox.setProperties({
			left: me.col4X,
			width: me.col2W,
			top: topPaneltop,
			height: 20
		});

		listbox.setProperties({
			left: me.col4X,
			width: me.col2W,
			height: topPanelHeight - modNameInputBox.height - me.defaultMargin,
			top: me.menuHeight + me.defaultMargin + modNameInputBox.height + me.defaultMargin
		});

		// logo
		var logoWidth = me.col2W;
		//if (me.width<900) logoWidth = me.col2W;
		logo.setProperties({
			left: me.col1X,
			width: logoWidth,
			height: topPanelHeight - songPanelHeight - me.defaultMargin,
			top: topPaneltop
		});


		// buttons
		var buttonHeight = Math.floor(topPanelHeight/5) + 1;
		for (i = 0;i<buttonsInfo.length;i++){
			var button = buttons[i];
			button.setProperties({
				left:me.col3X,
				top: modNameInputBox.top + (i*buttonHeight),
				width: me.col1W,
				height:buttonHeight,
				label: button.info.label,
				textAlign:"left",
				//backgroundImage: cachedAssets.images["skin/button_light.png"],
				background: UI.Assets.buttonLightScale9,
				font:window.fontMed
			});
		}

		/*for (i = 0;i<buttonsSideInfo.length;i++){
			var button = buttonsSide[i];
			button.setProperties({
				left:me.col1X,
				top: me.patternTop + (i*buttonHeight) + me.defaultMargin,
				width: me.col1W,
				height:buttonHeight,
				label: button.info.label,
				textAlign:"left",
				//backgroundImage: cachedAssets.images["skin/button_light.png"],
				background: UI.Assets.buttonLightScale9,
				font:window.fontMed
			});
		}*/
		for (i = 0;i<buttonsSideInfo.length;i++){
			var button = buttonsSide[i];
			button.setProperties({
				left:0,
				top: (i*buttonHeight) + me.defaultMargin,
				width: me.col1W,
				height:buttonHeight,
				label: button.info.label,
				textAlign:"left",
				background: UI.Assets.buttonLightScale9,
				font:window.fontMed
			});
		}

		sideButtonPanel.setProperties({
			left:me.col1X,
			top: me.patternTop,
			width: me.col1W,
			height:me.patternHeight
		});

		// songpanel
		songPanel.setProperties({
			left: me.defaultMargin,
			top: me.equaliserPanelY - songPanelHeight - me.defaultMargin,
			width: me.col1W,
			height: songPanelHeight
		});

		//songlistbox
		spMin.setProperties({
			left: (songPanel.left + songPanel.width) - spMin.width,
			top:songPanel.top + (Math.floor(songPanel.height - spPlus.height)/2),
			name:"PatternDown"
		});
		spPlus.setProperties({
			left: spMin.left - spPlus.width,
			top:spMin.top,
			name:"PatternUp"
		});


		songlistbox.setProperties({
			left: songPanel.left,
			top: songPanel.top,
			width: songPanel.width - spMin.width - spPlus.width - 1,
			height: songPanel.height,
			centerSelection: true,
			onChange: function(){
				Tracker.setCurrentSongPosition(songlistbox.getSelectedIndex());
			}
		});

		// controlBar
		for (i = 0;i< 4;i++){
			trackControls[i].setProperties({
				track:i,
				left: me["col" + (i+2) + "X"],
				top: me.controlBarTop,
				width: me.col1W,
				height: me.controlBarHeight
			});
		}

		songControl.setProperties({
			left: me.col1X,
			top: me.controlBarTop,
			width: me.col1W,
			height: me.controlBarHeight
		});

		// patternpanel
		patternPanel.setProperties({
			left:me.col2X,
			top:songPanel.top,
			height:songPanel.height,
			width: songPanel.width
		});
		spinBoxPattern.setProperties({
			left:patternPanel.left,
			top: patternPanel.top + 2,
			width: patternPanel.width,
			height: spinButtonHeight,
			name: "Pattern",
			label: "Pattern",
			value: 0,
			max: 100,
			min:0,
			font: window.fontMed,
			onChange : function(value){Tracker.setCurrentPattern(value);}
		});
		spinBoxPatternLength.setProperties({
			left:patternPanel.left,
			top: spinBoxPattern.top + spinButtonHeight,
			width: patternPanel.width,
			height: spinButtonHeight
			//onChange : function(value){UI.renderPattern(value)}
		});
		spinBoxSample.setProperties({
			left:patternPanel.left,
			top: spinBoxPatternLength.top + spinButtonHeight,
			width: patternPanel.width,
			height: spinButtonHeight
		});

		spinBoxSongLength.setProperties({
			left: me.defaultMargin,
			top : me.equaliserPanelY,
			height: spinButtonHeight,
			width: me.col1W
		});
		spinBoxBmp.setProperties({
			left: me.defaultMargin,
			top : spinBoxSongLength.top + spinButtonHeight,
			height: spinButtonHeight,
			width: me.col1W
		});

		patternView.setProperties({
			name: "patternViewPanel",
			left: me.col2X,
			top : me.patternTop,
			width: me.col4W,
			height: me.patternHeight
		});

		sampleView.setProperties({
			name: "sampleViewPanel",
			left: me.col1X,
			top : me.patternTop,
			width: me.col5W,
			height: me.patternHeight
		});

		me.setSize(me.width,me.height);
	};

	me.setLayout(0,0,me.width,me.height);


	me.setInstruments = function(items){
		listbox.setItems(items);
	};

	me.getInstruments = function(){
		return listbox.getItems();
	};

	me.setPatternTable = function(patternTable){
		var items = [];
		for (var i = 0, len = Tracker.getSong().length; i<len; i++){
			var value = patternTable[i];
			items.push({label: padd2(i) + ":" + padd2(value), data:value});
		}


		/*

		 {label: "01:01", data: 1},
		 {label: "02:01", data: 1},
		 {label: "03:04", data: 4}
		 */
		songlistbox.setItems(items);
	};

	function padd2(s){
		s = "" + s;
		if (s.length < 2){s = "0" + s}
		return s;
	}

	me.setView = function(viewName){
		if (viewName == "sample"){
			patternView.hide();
			sideButtonPanel.hide();
			sampleView.setLayout();
			sampleView.show(true,true);
		}else{
			patternView.show();
			sideButtonPanel.show();
			sampleView.hide();
		}
		currentView = viewName;
		me.refresh();
	};

	me.getCurrentView = function(){
		return currentView;
	};

	return me;


};

