UI.visualiser = function(x,y,width,height,visible){

    var me = UI.element(x,y,width,height,visible);

    var modes = [
        "wave",
        "spectrum",
        "tracks"
    ];
    var modeIndex = 2;
    var mode =  modes[modeIndex];
    var analyser;
    var trackAnalyser = [];

    me.init = function(){
        if (Audio.context){
            analyser = Audio.context.createAnalyser();
            analyser.minDecibels = -90;
            analyser.maxDecibels = -10;
            analyser.smoothingTimeConstant = 0.85;

            for (var i = 0; i<Tracker.getTrackCount(); i++){
                var a = Audio.context.createAnalyser();
                a.minDecibels = -90;
                a.maxDecibels = -10;
                a.smoothingTimeConstant = 0.85;
                a.fftSize = 64;
                trackAnalyser.push(a);
            }
        }

        me.ctx.fillStyle = 'black';
        me.ctx.lineWidth = 2;
        //me.ctx.strokeStyle = 'rgba(0, 255, 0,0.5)';
        //me.ctx.strokeStyle = 'rgba(255, 221, 0, 0.3)';
        me.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';



        me.needsRendering = true;
    };

    me.connect = function(audioNode){
        if (Audio.context){
            audioNode.connect(analyser);

            for (var i = 0; i< Tracker.getTrackCount(); i++){
                Audio.trackVolume[i].connect(trackAnalyser[i]);
            }
        }

    };

    me.nextMode = function(){
        modeIndex++;
        if (modeIndex>=modes.length) modeIndex = 0;
        mode = modes[modeIndex];
        console.log("setting visualiser to mode " + mode);
    };

    me.render = function(){


        //me.ctx.fillStyle = 'green';
        //me.ctx.fillRect(0, 0, width, height);

        // note - this is expensive!
        // maybe find another way instead of stroke() ?


        var bufferLength;
        var dataArray;

        if (mode == "wave"){
            analyser.fftSize = 256;
            bufferLength = analyser.fftSize;
            dataArray = new Uint8Array(bufferLength);

            function drawWave() {
                analyser.getByteTimeDomainData(dataArray);

                me.ctx.beginPath();
                var sliceWidth = width * 1.0 / bufferLength;
                var wx = 0;

                for(var i = 0; i < bufferLength; i++) {
                    var v = dataArray[i] / 128.0;
                    var wy = v * height/2;

                    if(i === 0) {
                        me.ctx.moveTo(wx, wy);
                    } else {
                        me.ctx.lineTo(wx, wy);
                    }

                    wx += sliceWidth;
                }

                me.ctx.lineTo(width, height/2);
                me.ctx.stroke();

                me.parentCtx.drawImage(me.canvas,x,y);
            }
            drawWave();
        }else if (mode=="spectrum"){
            analyser.fftSize = 128;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);

            var lowTreshold = 8;
            var highTreshold = 8;
            var max = bufferLength-highTreshold;

            var visualBufferLength = bufferLength - lowTreshold - highTreshold;

            analyser.getByteFrequencyData(dataArray);

            var barWidth = (width - visualBufferLength) / visualBufferLength;
            var barHeight;
            var wx = 0;

            // only display range

            for(var i = lowTreshold; i < max; i++) {
                barHeight = dataArray[i];

                me.ctx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
                me.ctx.fillRect(wx,height-barHeight/2,barWidth,barHeight/2);

                wx += barWidth + 1;
            }

            ctx.drawImage(me.canvas,x,y);


        }else if (mode=="tracks"){

            for (var trackIndex = 0; trackIndex<Tracker.getTrackCount();trackIndex++){
                var track = trackAnalyser[trackIndex];
                var aWidth = width/Tracker.getTrackCount();
                var aLeft = aWidth*trackIndex;

                var background = cachedAssets.images["skin/oscilloscope.png"];
                me.ctx.drawImage(background,aLeft,0,aWidth, height);

                if (track){
                    bufferLength = track.fftSize;
                    dataArray = new Uint8Array(bufferLength);

                    track.getByteTimeDomainData(dataArray);
                    me.ctx.beginPath();
                    var sliceWidth = aWidth * 1.0 / bufferLength;
                    var wx = aLeft;

                    for(var i = 0; i < bufferLength; i++) {
                        var v = dataArray[i] / 128.0;
                        var wy = v * height/2;

                        if(i === 0) {
                            me.ctx.moveTo(wx, wy);
                        } else {
                            me.ctx.lineTo(wx, wy);
                        }

                        wx += sliceWidth;
                    }

                    //myCtx.lineTo(aWidth, height/2);
                    me.ctx.stroke();
                }


            }


            me.parentCtx.drawImage(me.canvas,x,y);
        }



    };

    me.init();

    return me;


};