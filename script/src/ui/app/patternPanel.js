import Audio from "../../audio.js";
import App_panelContainer from "./panelContainer.js";
import EditPanel from "../editPanel.js";
import InfoPanel from "../infopanel.js";
import Tracker from "../../tracker.js";
import TrackControl from "./components/trackControl.js";
import Visualiser from "./components/visualiser.js";
import Layout from "../app/layout.js";
import EventBus from "../../eventBus.js";
import {COMMAND, EVENT} from "../../enum.js";
import App_patternView from "../app/components/patternView.js";
import SampleView from "../sampleView.js";
import UIElement from "../components/element.js";
import UI from "../ui.js";
import Assets from "../assets.js";
import App from "../../app.js";
import Button from "../components/button.js";
import Y from "../yascal/yascal.js";

let app_patternPanel = function(){
    var me = App_panelContainer(80);

    var i;
    var trackControls = [];
    var maxVisibleTracks = 4;
	var patternLeft;
	var patternTrackLeft;
	var currentView = "main";

    var editPanel = EditPanel();
    me.addChild(editPanel);

    var infoPanel = InfoPanel();
    me.addChild(infoPanel);

    var closeButton = Button(1,1,19,24);
    closeButton.setProperties({
        image: Y.getImage("toggleleft"),
        hoverImage: Y.getImage("toggleleft_active"),
    });
    closeButton.tooltip = "Toggle Sidebar";
    closeButton.onClick = function(){
        App.doCommand(COMMAND.toggleSideBar);
    };
    me.addChild(closeButton);

    for (i=0;i<Tracker.getTrackCount();i++){
        trackControls[i] = TrackControl();
        me.addChild(trackControls[i]);
    }

    var visualiser = Visualiser();
    visualiser.connect(Audio.cutOffVolume);
    visualiser.name = "mainAnalyser";
    UI.visualiser = visualiser;

    //UI.mainPanel.addChild(visualiser);
    // note: don't attach as child to main panel, this gets attached to main UI


    var patternView = App_patternView();
    patternView.setProperties({
        name: "patternViewPanel"
    });
    me.addChild(patternView);


    var sampleView = SampleView();
    sampleView.setProperties({
        name: "sampleViewPanel"
    });
    me.addChild(sampleView);

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

        if (Layout.expandSampleViewHeight && currentView==="sample"){
            visualiser.hide();
			editPanel.hide();
        }else{
            visualiser.show();
			if (Layout.showSideBar) editPanel.show();
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

        visualiser.setProperties({
            left: patternTrackLeft + Layout.mainLeft,
            top: me.top + Layout.infoPanelHeight + 3,
            width: patternWidth - Layout.firstTrackOffsetLeft,
            height: Layout.analyserHeight
        });

        sampleView.setProperties({
            left: 0,
            top: Layout.expandSampleViewHeight ? Layout.infoPanelHeight : patternTop,
            width: me.width,
            height: Layout.expandSampleViewHeight ? me.height - Layout.infoPanelHeight - Layout.defaultMargin - 3 : patternHeight
        });

        setTrackControlsLayout();


    };
    me.onPanelResize();
    

    function setTrackControlsLayout(){

        // controlBar
        var startTrack = patternView.getStartTrack();
        var endTrack = Math.min(startTrack + Layout.visibleTracks,Tracker.getTrackCount());

        var isVisible = !(Layout.expandSampleViewHeight && currentView === "sample");

        for (i = 0;i< trackControls.length;i++){

            if ( i>=startTrack && i<endTrack){
                trackControls[i].setProperties({
                    track:i,
                    left: patternTrackLeft + (Layout.trackWidth+Layout.trackMargin)* (i-startTrack),
                    top: Layout.defaultMargin + Layout.infoPanelHeight + Layout.analyserHeight,
                    width: Layout.trackWidth,
                    height:Layout.trackControlHeight,
                    visible: isVisible
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
            trackControls[i] = TrackControl();
            trackControls[i].setProperties({
                track: i,
                top: -200
            });
            me.addChild(trackControls[i]);
        }
		setTrackControlsLayout();
        me.refresh();
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
                //patternSidebar.hide();

                if (Layout.expandSampleViewHeight){
                    visualiser.hide();
                    editPanel.hide();
                }

				currentView = view;
				me.onPanelResize();
                me.refresh();
                break;
            case "bottommain":
            case "main":
                sampleView.hide();
                patternView.show();
				visualiser.show();
                if (Layout.showSideBar){
					//patternSidebar.show();
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