UI.MainPanel = function(){
	var me = UI.panel(0,0,canvas.width,canvas.height,true);
	me.setProperties({
        backgroundColor: "#071028"
    });
	me.name = "mainPanel";

    var menu = UI.app_menu(me);
    me.addChild(menu);

	var appPanel = UI.app_mainPanel();
    me.addChild(appPanel);

    var controlPanel = UI.app_controlPanel();
    me.addChild(controlPanel);

    var patternPanel = UI.app_patternPanel();
    me.addChild(patternPanel);

    var pianoPanel = UI.app_pianoView();
    pianoPanel.hide();
    me.addChild(pianoPanel);

    me.onResize = function(){
        Layout.setLayout(me.width,me.height);

        menu.setSize(me.width,menu.height);
        var panelTop = menu.height;

        appPanel.setSize(me.width,appPanel.height);
        appPanel.setPosition(0,panelTop);
        panelTop += appPanel.height;

        controlPanel.setSize(me.width,Layout.controlPanelHeight);
        controlPanel.setPosition(0,panelTop);
        panelTop += controlPanel.height;

        var remaining = me.height-panelTop;
        if (pianoPanel.isVisible()){
            pianoPanel.setSize(me.width,Layout.pianoHeight);
            pianoPanel.setPosition(0,me.height-pianoPanel.height);
            remaining = remaining- pianoPanel.height;
        }

        patternPanel.setPosition(0,panelTop);
        patternPanel.setSize(me.width,remaining);

	};

    me.sortZIndex();
    me.onResize();

    EventBus.on(EVENT.toggleView,function(view){
        if (view === "piano"){
            pianoPanel.toggle();
            var remaining = me.height - patternPanel.top;
            if (pianoPanel.isVisible()){
                pianoPanel.setSize(me.width,Layout.pianoHeight);
                pianoPanel.setPosition(0,me.height-pianoPanel.height)
                remaining = remaining-pianoPanel.height;
            }
            patternPanel.setSize(me.width,remaining);
        }
    });

/*


	var i;
	var currentView = "main";
	var maxVisibleTracks = 4;

	var mainLayout = LAYOUTS.column5;
	var tracks = getUrlParameter("tracks");
	if (tracks && tracks>4)  mainLayout = LAYOUTS.column5Full;
	if (getUrlParameter("layout")== "full") mainLayout = LAYOUTS.column5Full;
	var mainDefaultLayout = mainLayout;

	var spinbBoxFont = window.fontFT;





	var songPanel = UI.scale9Panel(0,0,0,0,UI.Assets.panelInsetScale9);
	me.addChild(songPanel);










	var buttons = [];
	var buttonsSide = [];
	var buttonsInfo=[
		{label:"Play", onClick:function(){Tracker.playSong()} , hideOnSmallScreen: true},
		{label:"Play Pattern", onClick:function(){Tracker.playPattern()}, hideOnSmallScreen: true},
		{label:"Stop", onClick:function(){Tracker.stop();}, hideOnSmallScreen: true},
		{label:"Options", labels:["Options","Opt.","Op"],onClick:function(){App.doCommand(COMMAND.showOptions)}},
		{label:"File Operations", labels: ["File Operations","File Op.","File","Fi"], onClick:function(){App.doCommand(COMMAND.showFileOperations)}},
		//{label:"Save", oncClick:function(){Tracker.save();}},
		//{label:"Record", onClick:function(){Tracker.toggleRecord();}},
		{label:"Instruments", labels:["Instruments","Instr.","Inst","In"],onClick:function(){App.doCommand(COMMAND.showSampleEditor)} , hideOnBigScreen: true},
		{label:"Sample Editor", labels:["Sample Editor","Sample","Smp","Sm"], onClick:function(){App.doCommand(COMMAND.showSampleEditor)}}
	];

	var getButtonInfoCount = function(){
		var result = 0;
		var check = function(item){return !item.hideOnBigScreen;};
		if (mainLayout == LAYOUTS.column5Full){
			check = function(item){return !item.hideOnSmallScreen;};
		}

		buttonsInfo.forEach(function(button){
			if (check(button)) result++;
		});
		return result;
	};



	var patternView = UI.PatternView();
	patternView.setProperties({
		name: "patternViewPanel"
	});
	me.addChild(patternView);



	var diskOperations = UI.DiskOperations();
	diskOperations.setProperties({
		name: "diskoperations",
		zIndex: 100
	});
	me.addChild(diskOperations);
	UI.diskOperations = diskOperations;

	var optionsPanel = UI.OptionsPanel();
	optionsPanel.setProperties({
		name: "options",
		zIndex: 100
	});
	me.addChild(optionsPanel);

	//var knob = UI.knob();
	//me.addChild(knob);



	me.sortZIndex();

	// events



	me.setLayout = function(newX,newY,newW,newH){
		me.clearCanvas();

		me.width = newW;
		me.height = newH;

		if (me.width<730){
			mainLayout = LAYOUTS.column5Full;
		}else{
			mainLayout = mainDefaultLayout;
		}

		me.visibleTracks = Math.min(maxVisibleTracks,Tracker.getTrackCount());

		// UI coordinates
		me.defaultMargin =  4;
		me.menuHeight = 26;

		me.controlPanelHeight = 200;
		me.equaliserPanelHeight = 60;
		me.controlBarHeight = 30;

		me.pianoHeight = 220;
		me.infoPanelHeight = 30;


		me.equaliserTop = me.controlPanelHeight + me.infoPanelHeight ;
		me.controlBarTop = me.equaliserTop + me.equaliserPanelHeight;
		me.patternTop = me.controlBarTop + me.controlBarHeight + 2;
		me.patternHeight = me.height - me.patternTop - me.defaultMargin;

		if (pianoView.isVisible()){
			me.patternHeight -= me.pianoHeight;
		}

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

		var patternViewWidth = me.col4W;
		var patternViewLeft = me.col2X;
		me.patternMargin = 0;
		me.patternMarginRight = 0;

		me.menuWidth = me.col2W;
		var vuLeft = me.col3X;
		var vuWidth = me.col3W;

		if (me.menuWidth < 250){
			me.menuWidth = me.col3W;
			vuLeft = me.col4X;
			vuWidth = me.col2W;

			if (me.menuWidth < 250){
				me.menuWidth = me.col4W;
				vuLeft = me.col5X;
				vuWidth = me.col1W;
			}
		}

		if (mainLayout == LAYOUTS.column5Full){

			patternViewWidth = me.width-14;
			patternViewLeft = 6;
			me.patternMargin = 24; // for the linenumers
			me.patternMarginRight = 16; // for the scrollbar

			me.controlPanelHeight = 204	;

			me.equaliserTop = me.controlPanelHeight;
			me.controlBarTop = me.equaliserTop + me.equaliserPanelHeight;
			me.patternTop = me.controlBarTop + me.controlBarHeight + 2;
			me.patternHeight = me.height - me.patternTop - me.defaultMargin;

			if (pianoView.isVisible()){
				me.patternHeight -= me.pianoHeight;
			}
		}

		me.trackMargin = 4;
		me.trackWidth = (patternViewWidth - me.patternMargin - me.patternMarginRight)/me.visibleTracks-me.trackMargin;
		me.patternViewWidth = patternViewWidth;
		me.patternViewLeft = patternViewLeft;


		var spinButtonHeight = 28;
		var songPanelHeight = spinButtonHeight*3 + me.defaultMargin + 2;
		var topPanelHeight = me.controlPanelHeight - me.menuHeight - (me.defaultMargin*2);
		var buttonHeight = Math.floor(topPanelHeight/getButtonInfoCount()) + 1;
		var inputBoxHeight = 20;

		var songlistboxWidth = me.col1W - 40;
		var songlistboxButtonWidth = 20;

		if (mainLayout == LAYOUTS.column5Full){
			songPanelHeight = spinButtonHeight*4 + me.defaultMargin + 2;

			songlistboxWidth = Math.floor((me.col1W/3) * 5);
			songlistboxButtonWidth = Math.floor(me.col1W/6);

			buttonHeight = Math.floor((topPanelHeight - me.infoPanelHeight)/getButtonInfoCount()) + 1;
		}

		var topRow1 = me.menuHeight + me.defaultMargin;
		var topRow2 = me.equaliserTop - songPanelHeight - me.infoPanelHeight - me.defaultMargin;
		var topRow3 = 0;

		var layout = {
			menuBackground: me.menuWidth,
			logo:{
				left: me.col2X,
				width: me.col2W,
				height: topPanelHeight - songPanelHeight - me.defaultMargin,
				top: topRow1
			},
			modNameInputBox:{
				left: me.col4X,
				width: me.col2W,
				top: topRow1,
				height: inputBoxHeight
			},
			listbox:{
				left: me.col4X,
				width: me.col2W,
				height: topPanelHeight - inputBoxHeight - me.defaultMargin,
				top: me.menuHeight + me.defaultMargin + inputBoxHeight + me.defaultMargin
			},
			songPanel:{
				left: me.col2X,
				top: topRow2,
				width: me.col1W,
				height: songPanelHeight
			},
			infoPanel:{
				left: me.col2X,
				top: me.equaliserTop - me.infoPanelHeight,
				width: me.col5W,
				height: me.infoPanelHeight
			},
			patternPanel:{
				left:me.col3X,
				top:topRow2,
				width: me.col1W,
				height:songPanelHeight
			},
			sideButtonPanel:{
				visible: true,
				left:me.col1X,
				top: me.patternTop,
				width: me.col1W,
				height:me.patternHeight
			},
			patternView:{
				left: patternViewLeft,
				top : me.patternTop,
				width: patternViewWidth,
				height: me.patternHeight
			},
			sampleView:{
				left: 0,
				top : me.patternTop,
				width: me.width,
				height: me.patternHeight
			},
			pianoView:{
				left: 0,
				top : me.height - me.pianoHeight,
				width: me.width,
				height: me.pianoHeight
			},
			diskOperations:{
				left: 0,
				top: me.menuHeight,
				height: me.controlPanelHeight-me.menuHeight,
				width: me.width
			},
			editPanel:{
				left: me.col1X,
				top: me.equaliserTop - me.infoPanelHeight,
				width: me.col1W,
				height: me.controlBarHeight + me.equaliserPanelHeight
			},
			songControl:{ // play/record buttons
				left: me.col1X,
				top: me.controlBarTop,
				width: me.col1W,
				height: me.controlBarHeight,
				songPatternSelector: "small"
			},
			spinBoxSongLength:{
				left:me.col3X,
				top: topRow2 + 3,
				width: me.col1W,
				height: spinButtonHeight
			},
			spinBoxPattern:{
				left:me.col3X,
				top: topRow2 + spinButtonHeight + 3,
				width: me.col1W,
				height: spinButtonHeight
			},
			spinBoxPatternLength:{
				left:me.col3X,
				top: topRow2 + spinButtonHeight + 3,
				width: me.col1W,
				height: spinButtonHeight
			},
			spinBoxInstrument:{
				left:me.col3X,
				top: topRow2 + (spinButtonHeight*2) + 3,
				width: me.col1W,
				height: spinButtonHeight
			},
			spinBoxBmp:{
				left: me.defaultMargin,
				top : me.equaliserTop + spinButtonHeight,
				height: spinButtonHeight,
				width: me.col1W
			},
			buttonsInfo:{
				left: me.col1X,
				top: topRow1,
				width: me.col1W,
				height:buttonHeight
			},
			buttonsSideInfo:{
				left:0,
				top: me.defaultMargin,
				width: me.col1W,
				height:buttonHeight
			}
		};

		if (mainLayout == LAYOUTS.column5Full){
			layout.sideButtonPanel.left = -500;
			layout.editPanel.left = -500;

			//layout.spinBoxSample.top = topRow2 + (spinButtonHeight*1) + 3;

			//layout.spinBoxSongLength.left =  me.col2X;
			//layout.spinBoxSongLength.top =  topRow2 + (spinButtonHeight*2) + 3;

			layout.songPanel.height = songPanelHeight - me.controlBarHeight;
			layout.songControl.top = layout.songPanel.top + layout.songPanel.height;
			layout.songControl.width =  me.col2W;

			layout.patternPanel.height = layout.songPanel.height;


			layout.listbox.left = -500;
			layout.buttonsInfo.left = me.col5X;

			layout.patternPanel.left = me.col3X;
			layout.spinBoxPattern.left = me.col3X;
			layout.spinBoxInstrument.left = me.col3X;
			layout.spinBoxSongLength.left = me.col3X;

			layout.patternPanel.width = me.col2W;
			layout.spinBoxPattern.width = me.col2W;
			layout.spinBoxInstrument.width = me.col2W;
			layout.spinBoxSongLength.width = me.col2W;

			layout.songPanel.width = me.col2W;

			layout.logo.left = -500;
			layout.modNameInputBox.left = me.col1X;
			layout.modNameInputBox.width = me.col4W;

			layout.infoPanel.left = me.col1X;
			layout.songControl.songPatternSelector = "big";
			layout.songControl.width = me.col4W;


		}

		menuBackground.setSize(layout.menuBackground ,me.menuHeight);
		menu.setSize(layout.menuBackground ,me.menuHeight);
		mainBack.setSize(me.width,me.height);

		setDimensions(logo,layout.logo);
		setDimensions(modNameInputBox,layout.modNameInputBox);
		setDimensions(listbox,layout.listbox);



		setDimensions(sideButtonPanel,layout.sideButtonPanel);
		setDimensions(songPanel,layout.songPanel);
		setDimensions(infoPanel,layout.infoPanel);

		//songlistbox


		spMin.setProperties({
			left: (songPanel.left + songPanel.width) - songlistboxButtonWidth,
			top:songPanel.top + (Math.floor(songPanel.height - spPlus.height)/2),
			width: songlistboxButtonWidth,
			name:"PatternDown"
		});

		spPlus.setProperties({
			left: spMin.left - songlistboxButtonWidth,
			top:spMin.top,
			width: songlistboxButtonWidth,
			name:"PatternUp"
		});




		songControl.songPatternSelector = layout.songControl.songPatternSelector;

		setDimensions(editPanel,layout.editPanel);
		setDimensions(songControl,layout.songControl);
		setDimensions(patternPanel,layout.patternPanel);

		setDimensions(spinBoxPattern,layout.spinBoxPattern);
		//setDimensions(spinBoxPatternLength,layout.spinBoxPatternLength);
		setDimensions(spinBoxInstrument,layout.spinBoxInstrument);
		setDimensions(spinBoxSongLength,layout.spinBoxSongLength);
		//setDimensions(spinBoxBmp,layout.spinBoxBmp);

		setDimensions(patternView,layout.patternView);
		setDimensions(sampleView,layout.sampleView);
		setDimensions(pianoView,layout.pianoView);
		setDimensions(diskOperations,layout.diskOperations);
		setDimensions(optionsPanel,layout.diskOperations);



		visualiser.setProperties({
			left: patternViewLeft + me.patternMargin,
			top: me.equaliserTop,
			width: patternViewWidth - me.patternMargin - me.patternMarginRight,
			height: me.equaliserPanelHeight
		});


vumeter.setProperties({
			width: vuWidth,
			left: vuLeft
		});
		me.setSize(me.width,me.height);
		infoPanel.setLayout();
	};

	function setDimensions(element,properties){
		var visible = (typeof properties.visible == "boolean") ? properties.visible : true;
		if (visible){
			element.setProperties({
				left: properties.left,
				width: properties.width,
				top: properties.top,
				height: properties.height
			});
		}else{
			//element.hide();
		}
	}



	me.setLayout(0,0,me.width,me.height);


	me.setInstruments = function(items){
		listbox.setItems(items);
	};

	me.getInstruments = function(){
		return listbox.getItems();
	};



	me.toggleFxPanel = function(track){
		patternView.toggleFxPanel(track);
	};



	me.setView = function(viewName){

		function resetTop(){
			diskOperations.hide();
			optionsPanel.hide();
		}
		function resetBottom(){
			patternView.show();
			sideButtonPanel.show();
			sampleView.hide();
		}
		function reset(){
			resetTop();
			resetBottom();
		}

		switch (viewName){
			case "sample":
				resetBottom();
				patternView.hide();
				sideButtonPanel.hide();
				sampleView.setLayout();
				sampleView.show(true,true);
				break;
			case "diskop_load":
				resetTop();
				diskOperations.setLayout("load");
				diskOperations.refreshList();
				diskOperations.show();
				break;
			case "diskop_save":
				resetTop();
				diskOperations.setLayout("save");
				diskOperations.refreshList();
				diskOperations.show();
				break;
			case "diskop_samples":
				resetTop();
				diskOperations.setLayout();
				diskOperations.refreshList("samples");
				diskOperations.show();
				break;
			case "options":
				resetTop();
				optionsPanel.setLayout();
				optionsPanel.show();
				break;
			case "resetTop":
				resetTop();
				break;
			case "resetBottom":
				resetTop();
				break;
			default:
				reset();
		}

		currentView = viewName;
		me.refresh();
	};

	me.getCurrentView = function(){
		return currentView;
	};


	me.togglePiano = function(){
		pianoView.toggle();
		me.setLayout(0,0,me.width,me.height);
	};

	*/

	return me;


};

