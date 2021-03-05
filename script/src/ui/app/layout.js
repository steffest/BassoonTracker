var Layout = function(){
  var me = {};

  me.defaultMargin =  4;
  me.showAppSideBar = false;

  me.setLayout = function(w,h){
  	
  	  me.width = w || me.width;
  	  me.height = h || me.height;
  	  
  	  var mainWidth = me.width;

	  me.sidebarWidth = me.showAppSideBar ? 200 : 0;
  	  
  	  // sidebar
	  mainWidth = mainWidth-me.sidebarWidth;
	  
      // 5 column layout
      me.col1W = Math.floor((mainWidth - (6*me.defaultMargin)- 3)/5);
      me.col2W = (me.col1W*2) + me.defaultMargin;
      me.col3W = (me.col1W*3) + (me.defaultMargin*2);
      me.col4W = (me.col1W*4) + (me.defaultMargin*3);
      me.col5W = (me.col1W*5) + (me.defaultMargin*4);

      me.marginLeft = Math.floor((mainWidth-me.col5W)/2);
      me.marginRight = mainWidth-me.marginLeft-me.col5W;
      
      me.mainLeft = me.sidebarWidth;
      me.mainWidth = mainWidth;
      
      me.col1X = me.marginLeft;
      me.col2X = me.col1X + me.defaultMargin + me.col1W;
      me.col3X = me.col2X + me.defaultMargin + me.col1W;
      me.col4X = me.col3X + me.defaultMargin + me.col1W;
      me.col5X = me.col4X + me.defaultMargin + me.col1W;

	  me.colHalfW =  Math.floor(me.col1W/2);

      // 3 column layout
      me.col31W = Math.floor((mainWidth - (4*me.defaultMargin)- 5)/3);
      me.col32W = (me.col31W*2) + me.defaultMargin;
      me.col31X = me.col1X;
      me.col32X = me.col31X + me.defaultMargin + me.col31W;
      me.col33X = me.col32X + me.defaultMargin + me.col31W;

      me.prefered = "col5";

	  /* controlpanel */
	  me.controlPanelHeight = 40;
	  me.controlPanelLayout = "full";
	  me.controlPanelButtonLayout = "1row";
	  me.controlPanelButtonsLeft = me.col2X;
	  me.controlPanelButtonsWidth = me.col3W;
	  me.modeButtonsWidth = me.col1W;
	  me.modeButtonsLeft = me.col5X;
	  me.songControlWidth =  me.col1W;
	  me.TrackCountSpinboxWidth = 60;

	  /* patternview */
      me.trackWidth = me.col1W;
      me.trackMargin = me.defaultMargin;
      me.visibleTracks = me.visibleTracks || 4;
      me.infoPanelHeight = 24;
      me.trackControlHeight = 32;
      me.analyserHeight = 66;
      me.pianoHeight = 200;
      me.trackFont = fontMed;
      me.useCondensedTrackFont = false;


	  me.maxVisibleTracks = 16;
	  if (mainWidth<945) me.maxVisibleTracks=12;
	  if (mainWidth<725) me.maxVisibleTracks=8;
	  if (mainWidth<512) me.maxVisibleTracks=4;

      if (me.visibleTracks>me.maxVisibleTracks){
		  me.setVisibleTracks(me.maxVisibleTracks);
		  return;
	  }
      
      if (mainWidth<820){
		  //me.controlPanelHeight = 80;
		  me.controlPanelButtonLayout = "condensed";
		  me.modeButtonsWidth = me.col1W + me.colHalfW;
		  me.modeButtonsLeft = me.col5X - me.colHalfW;
		  me.songControlWidth = me.modeButtonsWidth;
		  me.controlPanelButtonsLeft = me.col2X + me.colHalfW;
		  me.controlPanelButtonsWidth = me.col2W;
	  }

	  if (mainWidth<650){
		  me.controlPanelButtonLayout = "2row";
		  me.controlPanelHeight = 80;

		  me.controlPanelButtonsLeft = me.col1X;
		  me.controlPanelButtonsWidth = me.col5W;
		  me.controlPanelButtonsButton = Math.floor(me.controlPanelButtonsWidth/3);

		  me.modeButtonsLeft =  (me.controlPanelButtonsButton*2)  - me.TrackCountSpinboxWidth;
		  me.modeButtonsWidth = me.controlPanelButtonsButton  + me.TrackCountSpinboxWidth + me.defaultMargin;
		  me.songControlWidth = me.col2W + me.colHalfW + me.defaultMargin;
	  }

	  if (mainWidth<620){
          me.prefered = "col3";
	  }

      if (me.height<800){
          me.pianoHeight = 150;
      }

      if (me.height<650){
          me.pianoHeight = 100;
      }

	  var margins = me.defaultMargin*(me.visibleTracks-1);
	  me.showSideBar = me.visibleTracks<5 && mainWidth>620;

	  var totalWidth = me.showSideBar ? me.col4W:me.col5W;
	  me.trackWidth =  Math.floor((totalWidth - margins)/me.visibleTracks);

	  me.firstTrackOffsetLeft = 0;
	  if (me.trackWidth<125){
		  me.firstTrackOffsetLeft = 18;
		  me.trackWidth =  Math.floor((totalWidth - margins - me.firstTrackOffsetLeft)/me.visibleTracks);
	  }
	  var minTrackWidth = Tracker.inFTMode() ? 100 : 78;
	  if (me.trackWidth<minTrackWidth) {
	  	  me.trackFont = fontSuperCondensed;
		  me.useCondensedTrackFont = true;
	  }
  };

  me.setVisibleTracks = function(count){
	  me.visibleTracks = count;
	  me.setLayout();
	  EventBus.trigger(EVENT.visibleTracksCountChange,count);
  };
  
  return me;
}();