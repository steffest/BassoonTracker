var Layout = function(){
  var me = {};

  me.defaultMargin =  4;

  me.setLayout = function(w,h){
      // 5 column layout
      me.col1W = Math.floor((w - (6*me.defaultMargin)- 3)/5);
      me.col2W = (me.col1W*2) + me.defaultMargin;
      me.col3W = (me.col1W*3) + (me.defaultMargin*2);
      me.col4W = (me.col1W*4) + (me.defaultMargin*3);
      me.col5W = (me.col1W*5) + (me.defaultMargin*4);

      me.marginLeft = Math.floor((w-me.col5W)/2);
      me.marginRight = w-me.marginLeft-me.col5W;

      me.col1X = me.marginLeft;
      me.col2X = me.col1X + me.defaultMargin + me.col1W;
      me.col3X = me.col2X + me.defaultMargin + me.col1W;
      me.col4X = me.col3X + me.defaultMargin + me.col1W;
      me.col5X = me.col4X + me.defaultMargin + me.col1W;

      me.trackWidth = me.col1W;
      me.trackMargin = me.defaultMargin;
      me.visibleTracks = 4;
      me.infoPanelHeight = 24;
      me.trackControlHeight = 32;
      me.analyserHeight = 66;
      me.pianoHeight = 200;

      if (h<800){
          me.pianoHeight = 150;
      }

      if (h<650){
          me.pianoHeight = 100;
      }

      me.showSideBar = true;

  };

  me.setVisibleTracks = function(count){
	  me.visibleTracks = count;
	  var margins = me.defaultMargin*(count-1);
	  var totalWidth = count>4?me.col5W:me.col4W;
	  me.trackWidth =  Math.floor((totalWidth - margins)/count);
	  me.showSideBar = count<5;
	  EventBus.trigger(EVENT.visibleTracksCountChange,count);
  };


  return me;
}();