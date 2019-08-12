UI.visualiser = function(){
    var me = UI.panel();

    var modes = [
        "wave",
        "spectrum",
        "tracks"
    ];
    var modeIndex = 2;
    var mode =  modes[modeIndex];
    var analyser;
    var background;
    var trackAnalyser = [];
    var trackMuteState = [];
    var analyserPos = [];
    var analyserSize = 256;

    me.ctx.fillStyle = 'black';
    me.ctx.lineWidth = 2;
    //me.ctx.strokeStyle = 'rgba(0, 255, 0,0.5)';
    //me.ctx.strokeStyle = 'rgba(255, 221, 0, 0.3)';
    me.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';

    me.init = function(){
        if (Audio.context){
            analyser = Audio.context.createAnalyser();
            analyser.minDecibels = -90;
            analyser.maxDecibels = -10;
            analyser.smoothingTimeConstant = 0.85;

            function addAnalyser(){
                var a = Audio.context.createAnalyser();
                a.smoothingTimeConstant = 0;
                a.fftSize = analyserSize;
                trackAnalyser.push(a);
            }

            for (var i = 0; i<Tracker.getTrackCount(); i++){
                addAnalyser();
            }
			setAnalyserPositions();
        }

		background = Y.getImage("oscilloscope");

        EventBus.on(EVENT.filterChainCountChange,function(trackCount){
            for (var i = trackAnalyser.length; i<trackCount; i++){
                addAnalyser()
            }
			setAnalyserPositions();
            me.connect();
        });

		EventBus.on(EVENT.trackStateChange,function(state){
			if (typeof state.track !== "undefined"){
				trackMuteState[state.track] = state.mute;
			}
		});


        me.needsRendering = true;
    };

    me.connect = function(audioNode){
        if (Audio.context){
            if (audioNode) audioNode.connect(analyser);

            for (var i = 0; i< Tracker.getTrackCount(); i++){
                Audio.filterChains[i].output().connect(trackAnalyser[i]);
            }
        }

    };

    me.nextMode = function(){
        modeIndex++;
        if (modeIndex>=modes.length) modeIndex = 0;
        mode = modes[modeIndex];
        console.log("setting visualiser to mode " + mode);
    };

    var modeWaveRender = function(){
        var bufferLength;
        var dataArray;
        me.ctx.clearRect(0,0,me.width,me.height);

        analyser.fftSize = 256;
        bufferLength = analyser.fftSize;
        dataArray = new Uint8Array(bufferLength);

        function drawWave() {
            analyser.getByteTimeDomainData(dataArray);

            me.ctx.lineWidth = 2;
            me.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';
            me.ctx.beginPath();
            var sliceWidth = me.width * 1.0 / bufferLength;
            var wx = 0;

            for(var i = 0; i < bufferLength; i++) {
                var v = dataArray[i] / 128.0;
                var wy = v * me.height/2;

                if(i === 0) {
                    me.ctx.moveTo(wx, wy);
                } else {
                    me.ctx.lineTo(wx, wy);
                }

                wx += sliceWidth;
            }

            me.ctx.lineTo(me.width, me.height/2);
            me.ctx.stroke();

            me.parentCtx.drawImage(me.canvas,me.left, me.top);
        }
        drawWave();
    };

    var modeSpectrumRender = function() {

        me.ctx.clearRect(0,0,me.width,me.height);

        var bufferLength;
        var dataArray;

        analyser.fftSize = 128;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        var lowTreshold = 8;
        var highTreshold = 8;
        var max = bufferLength-highTreshold;

        var visualBufferLength = bufferLength - lowTreshold - highTreshold;

        analyser.getByteFrequencyData(dataArray);

        var barWidth = (me.width - visualBufferLength) / visualBufferLength;
        var barHeight;
        var wx = 0;

        // only display range

        for(var i = lowTreshold; i < max; i++) {
            barHeight = dataArray[i];

            me.ctx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
            me.ctx.fillRect(wx,me.height-barHeight/2,barWidth,barHeight/2);

            wx += barWidth + 1;
        }

        ctx.drawImage(me.canvas,me.left, me.top);


    };

    var modeTracksRender = function(){
        me.ctx.clearRect(0,0,me.width,me.height);
        me.ctx.lineWidth = 2;
        me.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';

        var hasVolume = !Audio.cutOff;
        var bufferLength;
        var dataArray;

        for (var trackIndex = 0; trackIndex<Tracker.getTrackCount();trackIndex++){

            var track = trackAnalyser[trackIndex];
            var pos = analyserPos[trackIndex];

            var isMute = trackMuteState[trackIndex];

            me.ctx.drawImage(background,pos.left,pos.top,pos.width,pos.height);

            if (track){
                me.ctx.beginPath();

                var wy;
                var wx = pos.lineLeft;
                var ww = pos.lineWidth;

                if (hasVolume && !isMute){

                    track.fftSize = analyserSize;
                    bufferLength = track.fftSize;
                    dataArray = new Uint8Array(bufferLength);
                    track.getByteTimeDomainData(dataArray);

                    var sliceWidth = ww/bufferLength;

                    for(var i = 0; i < bufferLength; i++) {
                        var v = dataArray[i] / 128.0;
                        wy = v * pos.height/2 + pos.top;

                        if(i === 0) {
                            me.ctx.moveTo(wx, wy);
                        } else {
                            me.ctx.lineTo(wx, wy);
                        }

                        wx += sliceWidth;
                    }
                }else{
                    wy = pos.height/2 + pos.top;
                    me.ctx.moveTo(wx, wy);
                    me.ctx.lineTo(wx + ww-1, wy);
                }

                //myCtx.lineTo(aWidth, height/2);
                me.ctx.stroke();

                if (isMute){
                    me.ctx.fillStyle = "rgba(34, 49, 85, 0.5)";
                    me.ctx.fillRect(pos.left,pos.top,pos.width,pos.height);
                }
            }
        }

        //me.parentCtx.drawImage(me.canvas,me.left, me.top);
        ctx.drawImage(me.canvas,me.left, me.top);
    };

    var modeDotsRender = function(){
        me.ctx.clearRect(0,0,me.width,me.height);

        me.ctx.fillStyle = 'rgba(120, 255, 50, 0.7)';
        me.ctx.lineStyle = 'rgba(120, 255, 50, 0.5)';

        var hasVolume = !Audio.cutOff;
        var bufferLength = analyserSize;
        var dataArray = new Uint8Array(bufferLength);

        for (var trackIndex = 0; trackIndex<Tracker.getTrackCount();trackIndex++){

            var track = trackAnalyser[trackIndex];
            var pos = analyserPos[trackIndex];

            var isMute = trackMuteState[trackIndex];

            me.ctx.drawImage(background,pos.left,pos.top,pos.width,pos.height);

            if (track){
                me.ctx.beginPath();

                var wy;
                var wx = pos.lineLeft;
                var ww = pos.lineWidth;

                if (hasVolume && !isMute){

                    track.fftSize = analyserSize;
                    track.getByteTimeDomainData(dataArray);

                    var sliceWidth = ww/bufferLength;

                    for(var i = 0; i < bufferLength; i++) {
                        var v = dataArray[i] / 128.0;
                        wy = v * pos.height/2 + pos.top;

                        me.ctx.fillRect(wx,wy,sliceWidth,2);

                        //if(i === 0) {
                            //me.ctx.moveTo(wx, wy);
                        //} else {
                            //me.ctx.lineTo(wx, wy);
                        //}

                        wx += sliceWidth;
                    }
                }else{
                    wy = pos.height/2 + pos.top;
                    me.ctx.fillRect(wx,wy,ww-1,2);
                    //me.ctx.moveTo(wx, wy);
                    //me.ctx.lineTo(wx + ww-1, wy);
                }

                //myCtx.lineTo(aWidth, height/2);
                //me.ctx.stroke();

                if (isMute){
                    me.ctx.fillStyle = "rgba(34, 49, 85, 0.5)";
                    me.ctx.fillRect(pos.left,pos.top,pos.width,pos.height);
                }
            }
        }

        //me.parentCtx.drawImage(me.canvas,me.left, me.top);
        ctx.drawImage(me.canvas,me.left, me.top);
    };


    me.render = function(){

        if (!Audio.context) return;
        if (!me.isVisible()) return;
        //modeDotsRender();
        modeTracksRender();
        //modeSpectrumRender();

    };

    me.init();

    function setAnalyserPositions(){
		analyserPos = [];

		var cols = Tracker.getTrackCount();
		var aHeight = me.height;

		if (Tracker.getTrackCount()>4){
		    cols = Math.ceil(Tracker.getTrackCount()/2);
			aHeight = me.height/2
        }
		var aWidth = me.width/cols;

		for (var i = 0; i < Tracker.getTrackCount(); i++){
		    var aLeft = i*aWidth;
		    var aTop = 0;
		    if (i>=cols){
				aLeft = (i-cols)*aWidth;
				aTop = me.height - aHeight;
            }
			analyserPos[i] = {
			    left: Math.floor(aLeft),
				top: Math.floor(aTop),
			    width: Math.floor(aWidth),
			    height: Math.floor(aHeight),
                lineLeft: Math.ceil(aLeft + aWidth/70),
                lineWidth: Math.floor(aWidth - (aWidth/30))
            }
        }
    }

	me.onResize = function(){
		setAnalyserPositions();
	};

    EventBus.on(EVENT.screenRender,function(){
        me.render();
    });

	EventBus.on(EVENT.second,function(){
		if (Tracker.isPlaying()){
		    // lower fft size on slower machines
			var fps = UI.getAverageFps();
			if (fps<32 && analyserSize>32){
				analyserSize >>= 1;
				analyserSize = Math.max(analyserSize,32);
				UI.resetAverageFps();
				console.warn("Low framerate, setting analyser FFT size to " + analyserSize);
            }
        }
	});

	me.onClick = function(touchData){
		if (mode==="tracks"){
			for (var trackIndex = 0; trackIndex<Tracker.getTrackCount();trackIndex++){

				var pos = analyserPos[trackIndex];
				var x = touchData.x;
				var y = touchData.y;
				if (x>pos.left && x<pos.left+pos.width && y>pos.top && y<pos.top+pos.height){
					EventBus.trigger(EVENT.trackScopeClick,trackIndex);
					break;
				}
			}
		}
	};
	
    return me;


};