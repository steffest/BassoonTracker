var SampleEditor = function(){
	var me = UI.panel(0,0,20,20);

	me.name = "SampleEditor";
	me.version = "0.1";
	me.src = ["ui.js","ui2.js","scrollbox.js","zoomgrid.js"];

	var scrollbox;
	var zoomgrid;

	me.init = function(){
		console.log("init SampleEditor");

		//scrollbox = UI.scrollbox(0,0,40,40);
		//me.addChild(scrollbox);

		zoomgrid = UI.zoomgrid(2,2,300,200);
		me.addChild(zoomgrid);

		me.setProperties({
			backgroundColor : "red",
			left: 2,
			top: 2,
			width: me.parent.width - 4,
			height: me.parent.height - 4
		});
	};

	me.onMouseWheel = function(touchData){
		if (touchData.mouseWheels[0] > 0){
			console.log("zoom in");
			//me.navigateUp();
		}else{
			//me.navigateDown();
			console.log("zoom out");
		}
	};

	PluginLoader.register(me);

	return me;
}();