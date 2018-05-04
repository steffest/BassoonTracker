UI.app_mainPanel = function(){
    var me = UI.app_panelContainer(160);
    var currentView = "";

    var logo = UI.button();
    logo.setProperties({
        background: UI.Assets.panelInsetScale9,
        activeBackground: UI.Assets.buttonDarkScale9,
        image: Y.getImage("logo_grey_70"),
        activeImage: Y.getImage("logo_colour_70")
    });
	logo.onDown = function(){
		logo.toggleActive();
	};
    me.addChild(logo);


    var modNameInputBox = UI.inputbox({
        name: "modName",
        onChange: function(value){
            Tracker.getSong().title = value;
            UI.setInfo(value);
        }
    });
    me.addChild(modNameInputBox);

    // instrument listbox
    var listbox = UI.listbox();
    listbox.setItems([
        {label: "loading ...", data: 1}
    ]);
    me.addChild(listbox);
    listbox.onClick = function(e){
        Input.setFocusElement(listbox);
        var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
        if (item){
            Tracker.setCurrentInstrumentIndex(item.data);
        }
    };

    var songlistbox = UI.app_songPatternList();
    me.addChild(songlistbox);


    // spinbox controls

    var spinbBoxFont = window.fontFT;

    var patternPanel = UI.scale9Panel(0,0,0,0,UI.Assets.panelInsetScale9);
    me.addChild(patternPanel);
    var patternPanel2 = UI.scale9Panel(0,0,0,0,UI.Assets.panelInsetScale9);
    me.addChild(patternPanel2);

    var spinBoxPattern = UI.spinBox();
    spinBoxPattern.setProperties({
        name: "Pattern",
        label: "Pattern",
        value: 0,
        max: 100,
        min:0,
        font: spinbBoxFont,
        onChange : function(value){Tracker.setCurrentPattern(value);}
    });
    me.addChild(spinBoxPattern);

    var spinBoxInstrument = UI.spinBox({
        name: "Instrument",
        label: "Instrument",
        value: 1,
        max: 64,
        min:1,
        font: spinbBoxFont,
        onChange : function(value){Tracker.setCurrentInstrumentIndex(value);}
    });
    me.addChild(spinBoxInstrument);

    var spinBoxSongLength = UI.spinBox({
        name: "SongLength",
        label: "Song length",
        value: 1,
        max: 200,
        min:1,
        font: spinbBoxFont,
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

    var spinBoxPatternLength = UI.spinBox({
        name: "PatternLength",
        label: "Pattern length",
        value: 64,
        max: 128,
        min:1,
        font: spinbBoxFont,
        onChange : function(value){
            Tracker.setPatternLength(value);
        }
    });
    me.addChild(spinBoxPatternLength);

    var spinBoxBpm = UI.spinBox({
        name: "BPMLength",
        label: "BPM",
        value: 1,
        max: 400,
        min:1,
        font: spinbBoxFont,
        onChange : function(value){

        }
    });
    me.addChild(spinBoxBpm);




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



    me.onPanelResize = function(){
        var inputBoxHeight = 20;
        var margin = Layout.defaultMargin;

        var listBoxTop = inputBoxHeight + (margin*2);
        var logoHeight = 50;
        var panelTop = logoHeight + margin + margin;
        var panelHeight = me.height - logoHeight - (margin*4);
        var spinButtonHeight = 28;
        var spinButtonWidth = Layout.col1W-2;

        logo.setDimensions({
            left: Layout.col1X,
            top: margin,
            width: Layout.col2W,
            height: logoHeight
        });

        modNameInputBox.setDimensions({
            left: Layout.col4X,
            width: Layout.col2W,
            top: margin,
            height: inputBoxHeight
        });

        listbox.setDimensions({
            left: Layout.col4X,
            width: Layout.col2W,
            top: listBoxTop,
            height: me.height - listBoxTop - (margin*2)
        });

        songlistbox.setDimensions({
            left: Layout.col1X,
            width: Layout.col1W,
            top: panelTop,
            height: panelHeight
        });

        patternPanel.setDimensions({
            left: Layout.col2X,
            width: Layout.col1W,
            top: panelTop,
            height: panelHeight
        });

        patternPanel2.setDimensions({
            left: Layout.col3X,
            width: Layout.col1W,
            top: panelTop,
            height: panelHeight
        });

        spinBoxBpm.setDimensions({
            left:Layout.col2X,
            top: patternPanel.top + 3,
            width: spinButtonWidth,
            height: spinButtonHeight
        });

        spinBoxSongLength.setDimensions({
            left:Layout.col2X,
            top: patternPanel.top + 3 + spinButtonHeight,
            width: spinButtonWidth,
            height: spinButtonHeight
        });

        spinBoxPattern.setDimensions({
            left:Layout.col3X,
            top: patternPanel.top + 3,
            width: spinButtonWidth,
            height: spinButtonHeight
        });

        spinBoxPatternLength.setDimensions({
            left:Layout.col3X,
            top: patternPanel.top + 3 + spinButtonHeight,
            width: spinButtonWidth,
            height: spinButtonHeight
        });

        spinBoxInstrument.setDimensions({
            left:Layout.col3X,
            top: patternPanel.top + 3 + spinButtonHeight*2,
            width: spinButtonWidth,
            height: spinButtonHeight
        });


        diskOperations.setSize(me.width,me.height);
        optionsPanel.setSize(me.width,me.height);
    };
    me.onPanelResize();

    me.getCurrentView = function(){
        return currentView;
    };


    EventBus.on(EVENT.songLoading,function(){
        modNameInputBox.setValue("Loading ...",true);
    });

    EventBus.on(EVENT.songPropertyChange,function(song){
        modNameInputBox.setValue(song.title,true);
        spinBoxSongLength.setValue(song.length,true);
        spinBoxInstrument.setMax(song.instruments.length-1);
    });

    EventBus.on(EVENT.songBPMChange,function(event,value){
        spinBoxBpm.setValue(value,true);
    });

    EventBus.on(EVENT.instrumentChange,function(value){
        listbox.setSelectedIndex(value-1);
        spinBoxInstrument.setValue(value,true);
    });

    EventBus.on(EVENT.instrumentNameChange,function(instrumentIndex){
        var instrument = Tracker.getInstrument(instrumentIndex);
        if (instrument){
            var instruments = me.getInstruments();
            for (var i = 0, len = instruments.length; i<len;i++){
                if (instruments[i].data == instrumentIndex){
                    instruments[i].label = instrumentIndex + " " + instrument.name;
                    EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
                    break;
                }
            }
        }
    });

    EventBus.on(EVENT.instrumentListChange,function(items){
        listbox.setItems(items);
    });
    EventBus.on(EVENT.patternChange,function(value){
        spinBoxPattern.setValue(value,true);
        spinBoxPatternLength.setValue(Tracker.getPatternLength(),true);

    });

	EventBus.on(EVENT.trackerModeChanged,function(mode){
		spinBoxPatternLength.setDisabled(mode === TRACKERMODE.PROTRACKER);
	});

    EventBus.on(EVENT.showView,function(view){
        switch (view){
            case "diskop_load":
            case "diskop_save":
                diskOperations.setView(view);
                diskOperations.show();
                optionsPanel.hide();
                currentView = view;
                me.refresh();
                break;
            case "options":
                diskOperations.hide();
                optionsPanel.show(true);
                currentView = view;
                me.refresh();
                break;
            case "topmain":
            case "main":
                diskOperations.hide();
                optionsPanel.hide();
                currentView = "";
                me.refresh();
                break;
        }
    });


    return me;
};