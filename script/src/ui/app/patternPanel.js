import Audio from "../../audio.js";
import App_panelContainer from "./panelContainer.js";
import EditPanel from "../editPanel.js";
import InfoPanel from "../infopanel.js";
import Tracker from "../../tracker.js";
import TrackControl from "./components/trackControl.js";
import Visualiser from "./components/visualiser.js";
import Multitrack from "./components/multitrack.js";
import Layout from "../app/layout.js";
import {COMMAND, EVENT} from "../../enum.js";
import App_patternView from "../app/components/patternView.js";
import UI from "../ui.js";
import App from "../../app.js";
import Button from "../components/button.js";
import Y from "../yascal/yascal.js";
import Panel from "../components/panel.js";

let app_patternPanel = function(){
    var me = new App_panelContainer(80);

    var i;
    var trackControls = [];
    var maxVisibleTracks = 4;
	var patternLeft;
	var patternTrackLeft;
	var currentView = "main";
	var customPanel;

    var editPanel = new EditPanel();
    me.addChild(editPanel);

    var infoPanel = new InfoPanel();
    me.addChild(infoPanel);

    var closeButton = new Button(1,1,19,24);
    closeButton.image = Y.getImage("toggleleft");
    closeButton.hoverImage = Y.getImage("toggleleft_active");
    closeButton.tooltip = "Toggle Sidebar";
    closeButton.onClick = function(){
        App.doCommand(COMMAND.toggleSideBar);
    };
    me.addChild(closeButton);

    for (i=0;i<Tracker.getTrackCount();i++){
        trackControls[i] = new TrackControl();
        me.addChild(trackControls[i]);
    }

    var visualiser = new Visualiser();
    visualiser.connect(Audio.cutOffVolume);
    visualiser.name = "mainAnalyser";
    UI.visualiser = visualiser;

    //UI.mainPanel.addChild(visualiser);
    // note: don't attach as child to main panel, this gets attached to main UI


    var patternView = new App_patternView();
    patternView.name = "patternViewPanel";
    me.addChild(patternView);

    var multitrackView = new Multitrack();
    multitrackView.hide();
    // Added to mainPanel directly (like visualiser) for direct-to-canvas rendering
    UI.multitrack = multitrackView;


    me.onPanelResize = function(){

		if (Layout.showSideBar){
			if (currentView === "main"){
				//patternSidebar.show();
				editPanel.show();
			}
		}else{
			//patternSidebar.hide();
			editPanel.hide();
		}

        if (Layout.showSideBar){
            closeButton.show();
            closeButton.setPosition(Layout.col1W-8,1);
        }else{
            if (Layout.canShowSideBar){
                closeButton.show();
                closeButton.setPosition(0,1);
            }else{
                closeButton.hide();
            }

        }



        var patternTop = Layout.infoPanelHeight + Layout.trackControlHeight + Layout.analyserHeight + (Layout.defaultMargin*2);
        var patternHeight = me.height - patternTop - Layout.defaultMargin;

        Layout.expandSampleViewHeight = patternHeight<280;

		var expandForSample = (Layout.expandSampleViewHeight || Layout.sampleViewMaximized) && currentView === "sample";
		var sampleMaximized = Layout.sampleViewMaximized && currentView === "sample";

        if (expandForSample){
            visualiser.hide();
			editPanel.hide();
        } else if (currentView !== "multitrack") {
            visualiser.show();
			if (Layout.showSideBar) editPanel.show();
        }

        if (sampleMaximized){
            infoPanel.hide();
        }else{
            infoPanel.show();
        }

		patternLeft = Layout.showSideBar ? Layout.col2X : Layout.col1X;
		var patternWidth = Layout.showSideBar ? Layout.col4W : Layout.col5W;

		patternTrackLeft = patternLeft + Layout.firstTrackOffsetLeft;

		editPanel.setDimensions({
            left: Layout.col1X,
            top : Layout.defaultMargin,
            width: Layout.col1W,
            height: Layout.infoPanelHeight + Layout.analyserHeight
        });

        infoPanel.setDimensions({
            left: Layout.showSideBar ? Layout.col2X : Layout.col1X,
            top : 0,
            width: Layout.showSideBar ? Layout.col4W : Layout.col5W,
            height: Layout.infoPanelHeight
        });

        patternView.setDimensions({
				left: patternLeft,
				top : patternTop,
				width: patternWidth,
				height: patternHeight
			});

        visualiser.left = patternTrackLeft + Layout.mainLeft;
        visualiser.top = me.top + Layout.infoPanelHeight + 3;
        visualiser.width = patternWidth - Layout.firstTrackOffsetLeft;
        visualiser.height = Layout.analyserHeight;

        if (customPanel) {
            customPanel.left = 0;
            customPanel.top = sampleMaximized ? 0 : (expandForSample ? Layout.infoPanelHeight : patternTop);
            customPanel.width = me.width;
            customPanel.height = sampleMaximized ? me.height : (expandForSample ? me.height - Layout.infoPanelHeight - Layout.defaultMargin - 3 : patternHeight);
        }

        // Multitrack view: covers the area below the info panel (replaces visualiser + trackControls + patternView)
        var multitrackTop = Layout.infoPanelHeight + Layout.defaultMargin;
        multitrackView.left = patternLeft;
        multitrackView.top = me.top + multitrackTop;
        multitrackView.width = patternWidth;
        multitrackView.height = me.height - multitrackTop - Layout.defaultMargin;

        setTrackControlsLayout();


    };
    me.onPanelResize();
    

    function setTrackControlsLayout(){

        // controlBar
        var startTrack = patternView.getStartTrack();
        var endTrack = Math.min(startTrack + Layout.visibleTracks,Tracker.getTrackCount());

        var isVisible = !((Layout.expandSampleViewHeight || Layout.sampleViewMaximized) && currentView === "sample");

        for (i = 0;i< trackControls.length;i++){

            if ( i>=startTrack && i<endTrack){
                trackControls[i].track = i;
                trackControls[i].left = patternTrackLeft + (Layout.trackWidth+Layout.trackMargin)* (i-startTrack);
                trackControls[i].top = Layout.defaultMargin + Layout.infoPanelHeight + Layout.analyserHeight;
                trackControls[i].width = Layout.trackWidth;
                trackControls[i].height = Layout.trackControlHeight;
                trackControls[i].visible = isVisible;
            }else{
                trackControls[i].track = i;
                trackControls[i].top = -100;
                trackControls[i].visible = false;
            }

        }
    }

    me.on(EVENT.patternChange,function(){
        patternView.refresh();
    });

    me.on(EVENT.patternPosChange,function(){
        patternView.refresh();
    });
    me.on(EVENT.cursorPositionChange,function(){
        patternView.refresh();
    });
    me.on(EVENT.recordingChange,function(){
        patternView.refresh();
    });

    me.on(EVENT.trackStateChange,function(state){
        // set other tracks to mute if a track is soloed

        if(typeof state.track != "undefined"){
            if (trackControls[state.track]){
                if (typeof state.solo != "undefined") trackControls[state.track].setSolo(!!state.solo, true);
                if (typeof state.mute != "undefined") trackControls[state.track].setMute(!!state.mute, true);
            }

            if (state.solo){
                for (i = 0;i< Tracker.getTrackCount();i++){
                    if (i !== state.track){
                        trackControls[i].setMute(true, true);
                    }
                }
            }else if (state.wasSolo){
                for (i = 0;i< Tracker.getTrackCount();i++){
                    if (i !== state.track){
                        trackControls[i].setMute(false, true);
                    }
                }
            }
        }

    });

    me.on(EVENT.trackCountChange,function(trackCount){

        me.visibleTracks = Math.min(maxVisibleTracks,trackCount);


        for (i=trackControls.length;i<trackCount;i++){
            trackControls[i] = new TrackControl();
            trackControls[i].track = i;
            trackControls[i].top = -200;
            me.addChild(trackControls[i]);
        }
		setTrackControlsLayout();
        me.refresh();
        //visualiser.connect(Audio.cutOffVolume);
    });

    me.on(EVENT.patternHorizontalScrollChange,function(){
        // update track Controls ... shouldn't they be part of the patternView?
        setTrackControlsLayout();
    });

	me.on(EVENT.pluginRenderHook,function(hook){
		if (hook.target && hook.target === "pattern"){
			if (!customPanel){
				customPanel = new Panel(0,0,me.width,me.height);
        customPanel.name = "patternPluginPanel";
				me.addChild(customPanel);
			}else{
				customPanel.children = [];
			}

			if (hook.setRenderTarget) hook.setRenderTarget(customPanel);
			currentView = hook.view || "custom";
			me.onPanelResize();
		}
	});

    me.on(EVENT.showView,function(view){
        switch (view){
            case "sample":
				if (customPanel) customPanel.show();
                patternView.hide();
                multitrackView.hide();

                if (Layout.expandSampleViewHeight || Layout.sampleViewMaximized){
                    visualiser.hide();
                    editPanel.hide();
                }

				currentView = view;
				me.onPanelResize();
                me.refresh();
                break;
            case "multitrack":
                if (customPanel) customPanel.hide();
                patternView.hide();
                visualiser.hide();
                for (i = 0; i < trackControls.length; i++) trackControls[i].hide();
                multitrackView.show();
                currentView = "multitrack";
                me.onPanelResize();
                me.refresh();
                break;
            case "bottommain":
            case "main":
				if (customPanel) customPanel.hide();
                patternView.show();
                multitrackView.hide();
				visualiser.show();
                if (Layout.showSideBar){
					editPanel.show();
                }
				currentView = "main";
                me.onPanelResize();
                me.refresh();
                break;
        }
    });

  me.on(EVENT.visibleTracksCountChange,function(count){
	    if (Layout.showSideBar){
            if (currentView === "main"){
				//patternSidebar.show();
				editPanel.show();
            }
        }else{
			//patternSidebar.hide();
			editPanel.hide();
        }
		me.onResize();
	});




    return me;
};

export default app_patternPanel;
