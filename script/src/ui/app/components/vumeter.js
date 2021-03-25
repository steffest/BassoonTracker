UI.vumeter = function(){
	var me = UI.panel();


	me.left = 400;
	me.top = 9;

	var analyserLeft;
	var analyserRight;
	var connected;
    var bufferLength;
    var dataArray;

	if (Audio.context){
		analyserLeft = Audio.context.createAnalyser();
		analyserLeft.minDecibels = -90;
		analyserLeft.maxDecibels = -10;
		analyserLeft.smoothingTimeConstant = 0.85;

		analyserRight = Audio.context.createAnalyser();
		analyserRight.minDecibels = -90;
		analyserRight.maxDecibels = -10;
		analyserRight.smoothingTimeConstant = 0.85;

        analyserLeft.fftSize = 32;
        analyserRight.fftSize = 32;
        bufferLength = analyserLeft.fftSize;
        dataArray = new Uint8Array(bufferLength);
	}

	var vuWidth = 500;
	var vuHeight = 6;
	var dotWidth = 10;
	var margin = 2;
	var middleMargin = 4;

	var base = document.createElement("canvas");
	var baseActive = document.createElement("canvas");
	var baseCtx = base.getContext("2d");
	var baseActiveCtx = baseActive.getContext("2d");

	var dotGreen = Y.getImage("vu_green");
	var dotGreenActive = Y.getImage("vu_green_active");
	var dotYellow = Y.getImage("vu_yellow");
	var dotYellowActive = Y.getImage("vu_yellow_active");
	var dotRed = Y.getImage("vu_red");
	var dotRedActive = Y.getImage("vu_red_active");

	function buildVu(){

		base.width = baseActive.width = vuWidth;
		base.height = baseActive.height = vuHeight;
		var dots = Math.floor(vuWidth / (dotWidth+margin));

		baseCtx.clearRect(0,0,base.width,base.height);
		baseActiveCtx.clearRect(0,0,baseActive.width,baseActive.height);

		for (var i = 0; i< dots; i++){
			var img = dotGreen;
			var imgActive = dotGreenActive;
			if (i>=dots/3){
				img = dotYellow;
				imgActive = dotYellowActive;
			}
			if (i>=dots/1.5){
				img = dotRed;
				imgActive = dotRedActive;
			}

			baseCtx.drawImage(img,i*(dotWidth+margin),0,dotWidth,vuHeight);
			baseActiveCtx.drawImage(imgActive,i*(dotWidth+margin),0,dotWidth,vuHeight);
		}
        me.ctx.fillStyle = "#253352";
	}


	me.setSize(vuWidth,vuHeight*2+middleMargin);
	buildVu();

	me.needsRendering = true;

	me.connect = function(audioNode){
		if (Audio.context){
			var splitter = Audio.context.createChannelSplitter(2);
			audioNode.connect(splitter);
			splitter.connect(analyserLeft,0);
			splitter.connect(analyserRight,1);
			connected = true;
		}
	};

	me.setProperties = function(properties){

		vuWidth = properties.width;
		me.left = properties.left;

		me.setSize(vuWidth,vuHeight*2+middleMargin);
		buildVu();

	};


	me.render = function(){

		if (!connected) return;

		analyserLeft.getByteTimeDomainData(dataArray);
		var rangeLeft = getDynamicRange(dataArray) * (Math.E - 1);
		analyserRight.getByteTimeDomainData(dataArray);
		var rangeRight = getDynamicRange(dataArray) * (Math.E - 1);


		me.ctx.fillRect(0,0,me.width,me.height);

		me.ctx.drawImage(base,0,0);
		me.ctx.drawImage(base,0,vuHeight + middleMargin);

		var wLeft = Math.min(Math.floor(rangeLeft * vuWidth),vuWidth);
		var wRight = Math.min(Math.floor(rangeRight * vuWidth),vuWidth);

		if (wLeft) me.ctx.drawImage(baseActive,0,0,wLeft,vuHeight,0,0,wLeft,vuHeight);
		if (wRight) me.ctx.drawImage(baseActive,0,0,wRight,vuHeight,0,vuHeight + middleMargin,wRight,vuHeight);

		//ctx.fillStyle = "green";
		//ctx.clearRect(400,4,400,20);
		//ctx.fillRect(400,4,400 * rangeLeft,8);
		//ctx.fillRect(400,16,400 * rangeRight,8);

		ctx.drawImage(me.canvas,me.left,me.top);

		//console.error(range);

		//console.error(dataArray[0]);

	};

	function getDynamicRange(buffer) {
		var len = buffer.length;
		var min = 128;
		var max = 128;

		for (var i = 0; i < len; i++) {
			var instrument = buffer[i];
			if (instrument < min) min = instrument;
			else if (instrument > max) max = instrument
		}

		return (max - min) / 255
	}

	EventBus.on(EVENT.screenRender,function(){
		me.render();
	});



	return me;

};