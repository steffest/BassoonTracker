var Layout = function(){
  var me = {};

  me.defaultMargin =  4;

  me.setLayout = function(w,h){

  	  me.width = w || me.width;
  	  me.height = h || me.height;

      // 5 column layout
      // 5 column layout
      me.col1W = Math.floor((me.width - (6*me.defaultMargin)- 3)/5);
      me.col2W = (me.col1W*2) + me.defaultMargin;
      me.col3W = (me.col1W*3) + (me.defaultMargin*2);
      me.col4W = (me.col1W*4) + (me.defaultMargin*3);
      me.col5W = (me.col1W*5) + (me.defaultMargin*4);

      me.marginLeft = Math.floor((me.width-me.col5W)/2);
      me.marginRight = me.width-me.marginLeft-me.col5W;

      me.col1X = me.marginLeft;
      me.col2X = me.col1X + me.defaultMargin + me.col1W;
      me.col3X = me.col2X + me.defaultMargin + me.col1W;
      me.col4X = me.col3X + me.defaultMargin + me.col1W;
      me.col5X = me.col4X + me.defaultMargin + me.col1W;

      me.trackWidth = me.col1W;
      me.trackMargin = me.defaultMargin;
      me.visibleTracks = me.visibleTracks || 4;
      me.infoPanelHeight = 24;
      me.trackControlHeight = 32;
      me.analyserHeight = 66;
      me.pianoHeight = 200;


      if (me.height<800){
          me.pianoHeight = 150;
      }

      if (me.height<650){
          me.pianoHeight = 100;
      }

	  var margins = me.defaultMargin*(me.visibleTracks-1);
	  me.showSideBar = me.visibleTracks<5;

	  var totalWidth = me.showSideBar ? me.col4W:me.col5W;
	  me.trackWidth =  Math.floor((totalWidth - margins)/me.visibleTracks);
	  console.log(me.trackWidth);

	  me.firstTrackOffsetLeft = 0;
	  if (me.trackWidth<125){
		  me.firstTrackOffsetLeft = 18;
		  me.trackWidth =  Math.floor((totalWidth - margins - me.firstTrackOffsetLeft)/me.visibleTracks);
	  }

  };

  me.setVisibleTracks = function(count){
	  me.visibleTracks = count;
	  me.setLayout();
	  EventBus.trigger(EVENT.visibleTracksCountChange,count);
  };


  return me;
}();