UI.app_patternPanel = function(){
    var me = UI.app_panelContainer(80);

    var i;
    var trackControls = [];
    var maxVisibleTracks = 4;
	var patternLeft;
	var currentView = "main";

    var editPanel = UI.editPanel();
    me.addChild(editPanel);

    var infoPanel = UI.InfoPanel();
    me.addChild(infoPanel);

    for (i=0;i<Tracker.getTrackCount();i++){
        trackControls[i] = UI.trackControl();
        me.addChild(trackControls[i]);
    }

    var visualiser = UI.visualiser();

    visualiser.connect(Audio.cutOffVolume);
    visualiser.name = "mainAnalyser";
    visualiser.onClick = function(){
        visualiser.nextMode();
    };
    window.visualiser = visualiser;
    // note: don't attach as child to main panel, this gets attached to main UI

    var sidebar = UI.app_sidebar();
    me.addChild(sidebar);

    var patternView = UI.app_patternView();
    patternView.setProperties({
        name: "patternViewPanel"
    });
    me.addChild(patternView);


    var sampleView = UI.SampleView();
    sampleView.setProperties({
        name: "sampleViewPanel"
    });
    me.addChild(sampleView);



    me.onPanelResize = function(){

        var patternTop = Layout.infoPanelHeight + Layout.trackControlHeight + Layout.analyserHeight + (Layout.defaultMargin*2);
        var patternHeight = me.height - patternTop - Layout.defaultMargin;
		patternLeft = sidebar.isVisible() ? Layout.col2X : Layout.col1X;
		var patternWidth = sidebar.isVisible() ? Layout.col4W : Layout.col5W;

        editPanel.setDimensions({
            left: Layout.col1X,
            top : Layout.defaultMargin,
            width: Layout.col1W,
            height: Layout.infoPanelHeight + Layout.analyserHeight
        });

        infoPanel.setDimensions({
            left: Layout.col2X,
            top : 0,
            width: Layout.col4W,
            height: Layout.infoPanelHeight
        });



        patternView.setDimensions({
				left: patternLeft,
				top : patternTop,
				width: patternWidth,
				height: patternHeight
			});

        sidebar.setDimensions({
            left: Layout.col1X,
            top : patternView.top - Layout.trackControlHeight,
            width: Layout.col1W,
            height: patternHeight + Layout.trackControlHeight
        });

        visualiser.setProperties({
            left: patternLeft,
            top: me.top + Layout.infoPanelHeight + 3,
            width: patternWidth,
            height: Layout.analyserHeight
        });

        sampleView.setProperties({
            left: Layout.col1X,
            top: patternTop,
            width: Layout.col5W,
            height: patternHeight
        });

        setTrackControlsLayout();
    };
    me.onPanelResize();



    function setTrackControlsLayout(){

        // controlBar
        var startTrack = patternView.getStartTrack();
        var endTrack = Math.min(startTrack + Layout.visibleTracks,Tracker.getTrackCount());

        for (i = 0;i< trackControls.length;i++){

            if ( i>=startTrack && i<endTrack){
                trackControls[i].setProperties({
                    track:i,
                    left: patternLeft + (Layout.trackWidth+Layout.trackMargin)* (i-startTrack),
                    top: Layout.defaultMargin + Layout.infoPanelHeight + Layout.analyserHeight,
                    width: Layout.trackWidth,
                    height:Layout.trackControlHeight,
                    visible: true
                });
            }else{
                trackControls[i].setProperties({
                    track:i,
                    top: -100,
                    visible: false
                });
            }

        }
    }

    EventBus.on(EVENT.patternChange,function(){
        patternView.refresh();
    });

    EventBus.on(EVENT.patternPosChange,function(){
        patternView.refresh();
    });
    EventBus.on(EVENT.cursorPositionChange,function(){
        patternView.refresh();
    });
    EventBus.on(EVENT.recordingChange,function(){
        patternView.refresh();
    });

    EventBus.on(EVENT.trackStateChange,function(state){
        // set other tracks to mute if a track is soloed

        if(typeof state.track != "undefined"){
            if (state.solo){
                for (i = 0;i< Tracker.getTrackCount();i++){
                    if (i != state.track){
                        trackControls[i].setProperties({mute:true});
                    }
                }
            }else if (state.wasSolo){
                for (i = 0;i< Tracker.getTrackCount();i++){
                    if (i != state.track){
                        trackControls[i].setProperties({mute:false});
                    }
                }
            }
        }

    });

    EventBus.on(EVENT.trackCountChange,function(trackCount){

        me.visibleTracks = Math.min(maxVisibleTracks,trackCount);


        for (i=trackControls.length;i<trackCount;i++){
            trackControls[i] = UI.trackControl();
            trackControls[i].setProperties({
                track: i,
                top: -200
            });
            me.addChild(trackControls[i]);
        }
        //visualiser.connect(Audio.cutOffVolume);
    });

    EventBus.on(EVENT.patternHorizontalScrollChange,function(){
        // update track Controls ... shouldn't they be part of the patternView?
        setTrackControlsLayout();
    });

    EventBus.on(EVENT.showView,function(view){
        switch (view){
            case "sample":
                sampleView.show();
                patternView.hide();
                sidebar.hide();
				currentView = view;
                me.refresh();
                break;
            case "bottommain":
            case "main":
                sampleView.hide();
                patternView.show();
                if (Layout.showSideBar){
					sidebar.show();
					editPanel.show();
                }
				currentView = "main";
                me.onPanelResize();
                me.refresh();
                break;
        }
    });

	EventBus.on(EVENT.visibleTracksCountChange,function(count){
	    if (Layout.showSideBar){
            if (currentView === "main"){
				sidebar.show();
				editPanel.show();
            }
        }else{
			sidebar.hide();
			editPanel.hide();
        }
		me.onResize();
	});




    return me;
};