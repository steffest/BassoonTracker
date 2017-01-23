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
    var trackAnalyser = [];

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

            for (var i = 0; i<Tracker.getTrackCount(); i++){
                var a = Audio.context.createAnalyser();
                a.minDecibels = -90;
                a.maxDecibels = -10;
                a.smoothingTimeConstant = 0.85;
                a.fftSize = 64;
                trackAnalyser.push(a);
            }
        }





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
                var sliceWidth = me.width * 1.0 / bufferLength;
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

                me.ctx.lineTo(me.width, height/2);
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

            var barWidth = (me.width - visualBufferLength) / visualBufferLength;
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
                var aWidth = me.width/Tracker.getTrackCount();
                var aLeft = aWidth*trackIndex;

                var background = cachedAssets.images["skin/oscilloscope.png"];
                me.ctx.drawImage(background,aLeft,0,aWidth, me.height);

                if (track){
                    bufferLength = track.fftSize;
                    dataArray = new Uint8Array(bufferLength);

                    track.getByteTimeDomainData(dataArray);

                    me.ctx.lineWidth = 2;
                    me.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';

                    me.ctx.beginPath();
                    var sliceWidth = aWidth * 1.0 / bufferLength;
                    var wx = aLeft;

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

                    //myCtx.lineTo(aWidth, height/2);
                    me.ctx.stroke();
                }


            }

            //me.parentCtx.drawImage(me.canvas,me.left, me.top);
            ctx.drawImage(me.canvas,me.left, me.top);
        }



    };

    me.init();

    return me;


};