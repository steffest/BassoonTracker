var Audio = (function(){
    var me = {};

    window.AudioContext = window.AudioContext||window.webkitAudioContext;
    window.OfflineAudioContext = window.OfflineAudioContext||window.webkitOfflineAudioContext;

    var context;
    var masterVolume;
    var cutOffVolume;
    var lowPassfilter;
    var i;
    var trackVolume = [];
    var trackPanning = [];
    var isRecording;
    var recordingAvailable;
    var mediaRecorder;
    var recordingChunks = [];
    var offlineContext;

    var isRendering = false;

    function createAudioConnections(audioContext){

        cutOffVolume = audioContext.createGain();
        cutOffVolume.gain.value = 1;
        cutOffVolume.connect(audioContext.destination);

        masterVolume = audioContext.createGain();
        masterVolume.gain.value = 0.7;
        masterVolume.connect(cutOffVolume);

        lowPassfilter = audioContext.createBiquadFilter();
        lowPassfilter.type = "lowpass";
        lowPassfilter.frequency.value = 20000;

        lowPassfilter.connect(masterVolume);
    }

    if (AudioContext){
        context = new AudioContext();
        createAudioConnections(context);
    }

    me.init = function(audioContext){

        audioContext = audioContext || context;
        if (!audioContext) return;

        var numberOfTracks = Tracker.getTrackCount();
        trackVolume = [];
        trackPanning = [];

        for (i = 0; i<numberOfTracks;i++){
            var gain = audioContext.createGain();
            var pan = audioContext.createStereoPanner();
            gain.gain.value = 0.7;

            // pan even channels to the left, uneven to the right
            pan.pan.value = i%2==0 ? -0.5 : 0.5;
            gain.connect(pan);
            pan.connect(lowPassfilter);
            trackVolume.push(gain);
            trackPanning.push(pan);
        }

        me.trackVolume = trackVolume;
        me.trackPanning = trackPanning;

        if (!isRendering){
            EventBus.on(EVENT.trackStateChange,function(event,state){
                if (typeof state.track != "undefined" && trackVolume[state.track]){
                    trackVolume[state.track].gain.value = state.mute?0:0.7;
                }
            });
        }

    };

    me.enable = function(){
        cutOffVolume.gain.value = 1;
    };

    me.disable = function(){
        cutOffVolume.gain.value = 0;
    };


    me.playSample = function(index,period,volume,track,effects,time){

        var audioContext;
        if (isRendering){
            audioContext = offlineContext;
        }else{
            audioContext = context;
            me.enable();
        }

        period = period || 428; // C-3
        track = track || Tracker.getCurrentTrack();
        time = time || 0;

        var sample = Tracker.getSample(index);

        if (sample){
            var sampleBuffer;
            var offset = 0;
            var sampleLength = 0;

            volume = typeof volume == "undefined" ? (100*sample.volume/64) : volume;

            if (sample.finetune){
                var note = periodNoteTable[period];
                if (note && note.tune){
                    var centerTune = 8;
                    var tune = 8 + sample.finetune;
                    if (tune>0 && tune<note.tune.length) period = note.tune[tune];
                }

            }
            var sampleRate = PALFREQUENCY / (period*2);

            //volume = volume * (sample.volume/64);

            var initialPlaybackRate = 1;

            if (sample.data.length) {
                sampleLength = sample.data.length;

                if (effects && effects.offset && effects.offset.value<sampleLength){
                    offset = effects.offset.value;
                    sampleLength -= offset;
                }
                // note - on safari you can't set a different samplerate?
                sampleBuffer = audioContext.createBuffer(1, sampleLength,audioContext.sampleRate);
                initialPlaybackRate = sampleRate / audioContext.sampleRate;
            }else {
                // empty samples are often used to cut of the previous sample
                sampleBuffer = audioContext.createBuffer(1, 1, sampleRate);
                offset = 0;
            }
            var buffering = sampleBuffer.getChannelData(0);
            for(i=0; i < sampleLength; i++) {
                buffering[i] = sample.data[i + offset];
            }

            var source = audioContext.createBufferSource();
            source.buffer = sampleBuffer;

            var volumeGain = audioContext.createGain();
            volumeGain.gain.value = volume/100; 

            if (sample.loopRepeatLength>2){

                if (!SETTINGS.unrollLoops){

                    source.loop = true;
                    // in seconds ...
                    source.loopStart = sample.loopStart/audioContext.sampleRate;
                    source.loopEnd = (sample.loopStart + sample.loopRepeatLength)/audioContext.sampleRate;

                    //audioContext.sampleRate = samples/second

                }
            }

            source.connect(volumeGain);
            volumeGain.connect(trackVolume[track]);

            source.playbackRate.value = initialPlaybackRate;
            var sourceDelayTime = 0;
            var playTime = time + sourceDelayTime;

            source.start(playTime);

            var result = {
                source: source,
                volume: volumeGain,
                startVolume: volume,
                currentVolume: volume,
                startPeriod: period,
                startPlaybackRate: initialPlaybackRate,
                sampleIndex: index,
                effects: effects
            };

            if (!isRendering) EventBus.trigger(EVENT.samplePlay,result);

            return result;
        }

        return {};
    };

    me.playSilence = function(){
        // used to activate Audio engine on first touch in IOS devices
        if (context){
            var source = context.createBufferSource();
            source.connect(masterVolume);
            source.start();
        }
    };


    me.isRecording = function(){
        return isRecording;
    };

    me.startRecording = function(){
        if (!isRecording){

            if (context && context.createMediaStreamDestination){
                var dest = context.createMediaStreamDestination();
                mediaRecorder = new MediaRecorder(dest.stream);

                mediaRecorder.ondataavailable = function(evt) {
                    // push each chunk (blobs) in an array
                    recordingChunks.push(evt.data);
                };

                mediaRecorder.onstop = function(evt) {
                    var blob = new Blob(recordingChunks, { 'type' : 'audio/ogg; codecs=opus' });
                    saveAs(blob,"recording.opus");
                    //document.querySelector("audio").src = URL.createObjectURL(blob);
                };


                masterVolume.connect(dest);
                mediaRecorder.start();
                isRecording = true;

            }else{
                console.error("recording is not supported on this browser");
            }

        }
    };

    me.stopRecording = function(){
        if (isRecording){
            isRecording = false;
            mediaRecorder.stop();
        }
    };

    me.startRendering = function(length){
        isRendering = true;

        console.error("startRendering " + length);
        offlineContext = new OfflineAudioContext(2,44100*length,44100);
        me.context = offlineContext;
        createAudioConnections(offlineContext);
        me.init(offlineContext);
    };

    me.stopRendering = function(){
        isRendering = false;

        offlineContext.startRendering().then(function(renderedBuffer) {
            console.log('Rendering completed successfully');

            //var sampleBuffer = context.createBuffer(2, renderedBuffer.length,context.sampleRate);

            var doSave = true;

            if (doSave){
                // save to wav
                var b = new Blob([audioBufferToWav(renderedBuffer)], {type: "octet/stream"});
                saveAs(b,"output.wav");
            }else{
                var output = context.createBufferSource();
                output.buffer = renderedBuffer;
                output.connect(context.destination);
                output.start();
            }


            //https://github.com/Jam3/audiobuffer-to-wav/blob/master/index.js

            //var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            //var song = audioCtx.createBufferSource();
            //song.buffer = renderedBuffer;



            //play.onclick = function() {
            //    song.start();
            //}
        }).catch(function(err) {
            console.log('Rendering failed: ' + err);
            // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
        });

        me.context = context;
        createAudioConnections(context);
        me.init(context);
    };

    me.setStereoSeparation = function(value){

        var numberOfTracks = Tracker.getTrackCount();

        var panAmount;
        switch(value){
            case STEREOSEPARATION.NONE:
                // mono, no panning
                panAmount = 0;
                SETTINGS.stereoSeparation = STEREOSEPARATION.NONE;
                break;
            case STEREOSEPARATION.FULL:
                // Amiga style: pan even channels hard to the left, uneven to the right;
                panAmount = 1;
                SETTINGS.stereoSeparation = STEREOSEPARATION.FULL;
                break;
            default:
                // balanced: pan even channels somewhat to the left, uneven to the right;
                panAmount = 0.5;
                SETTINGS.stereoSeparation = STEREOSEPARATION.BALANCED;
                break;
        }

        for (i = 0; i<numberOfTracks;i++){
            var pan = trackPanning[i];
            if (pan) pan.pan.value = i%2==0 ? -panAmount : panAmount;
        }
    };

    me.masterVolume = masterVolume;
    me.cutOffVolume = cutOffVolume;
    me.lowPassfilter = lowPassfilter;
    me.context = context;
    me.trackVolume = trackVolume;
    me.trackPanning = trackPanning;


    function createPingPongDelay(){

        // example of delay effect.
        //Taken from http://stackoverflow.com/questions/20644328/using-channelsplitter-and-mergesplitter-nodes-in-web-audio-api

        var delayTime = 0.12;
        var feedback = 0.3;

        var merger = context.createChannelMerger(2);
        var leftDelay = context.createDelay();
        var rightDelay = context.createDelay();
        var leftFeedback = context.createGain();
        var rightFeedback = context.createGain();
        var splitter = context.createChannelSplitter(2);


        splitter.connect( leftDelay, 0 );
        splitter.connect( rightDelay, 1 );

        leftDelay.delayTime.value = delayTime;
        rightDelay.delayTime.value = delayTime;

        leftFeedback.gain.value = feedback;
        rightFeedback.gain.value = feedback;

        // Connect the routing - left bounces to right, right bounces to left.
        leftDelay.connect(leftFeedback);
        leftFeedback.connect(rightDelay);

        rightDelay.connect(rightFeedback);
        rightFeedback.connect(leftDelay);

        // Re-merge the two delay channels into stereo L/R
        leftFeedback.connect(merger, 0, 0);
        rightFeedback.connect(merger, 0, 1);

        // Now connect your input to "splitter", and connect "merger" to your output destination.

        return{
            splitter: splitter,
            merger: merger
        }
    }

    /**

     get a new AudioNode playing at x semitones from the root note
     // used to create Chords and Arpeggio

     @param {audioNode} source: audioBuffer of the root note
     @param {Number} root: period of the root note
     @param {Number} semitones: amount of semitones from the root note
     @param {Number} finetune: finetune value of the base sample
     @return {audioNode} audioBuffer of the new note
     */
    function semiTonesFrom(source,root,semitones,finetune){
        var target;

        target = context.createBufferSource();
        target.buffer = source.buffer;

        if (semitones){
            var rootNote = periodNoteTable[root];
            var rootIndex = noteNames.indexOf(rootNote.name);
            var targetName = noteNames[rootIndex+semitones];
            if (targetName){
                var targetNote = nameNoteTable[targetName];
                if (targetNote){
                    target.playbackRate.value = (rootNote.period/targetNote.period) * source.playbackRate.value;
                }
            }
        }else{
            target.playbackRate.value = source.playbackRate.value
        }

        return target;

    }

    me.getSemiToneFrom = function(period,semitones){
        var result = period;
        if (semitones){
            var rootNote = periodNoteTable[period];
            if (rootNote){
                var rootIndex = noteNames.indexOf(rootNote.name);
                var targetName = noteNames[rootIndex+semitones];
                if (targetName){
                    var targetNote = nameNoteTable[targetName];
                    if (targetNote){
                        result = targetNote.period;
                    }
                }
            }else{
                console.error("ERROR: note for period " + period + " not found");
                // note: this can happen when the note is in a period slide
                // FIXME
            }

        }
        return result;
    };

    return me;

}());

