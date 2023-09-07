FilterChain = (function(filters) {

    var me = {};

    filters = filters || {
    volume: true,
    panning: true,
    high:false,
    mid:false,
    low:false,
    lowPass:false,
    reverb:false,
    distortion:false,
    delay:false,
    compression:false,
    };

    // disable for now: sounds muffled;
    var disableFilters = true;

    if (disableFilters){
        filters = {
            volume: true,
            panning: true,
        high:false,
        mid:false,
        low:false,
        lowPass:false,
        reverb:false,
        distortion:false,
        delay:false,
        compression:false,
        };
    }

    var useVolume = filters.volume;
    var usePanning = filters.panning && Audio.context.createStereoPanner;
    var useHigh = filters.high;
    var useMid = filters.mid;
    var useLow = filters.low;
    var useLowPass = filters.lowPass;
    var useReverb = filters.reverb;
    var useDistortion = filters.distortion;
    var useDelay = filters.delay;
    var useCompression = filters.compression;

    var input,output,output_reverb,output_delay;

    var lowValue = 0.0;
    var midValue = 0.0;
    var highValue = 0.0;
    var volumeValue = 70;
    var panningValue = 0;
    var reverbGain = 0;
    var distortionGain=0;
    var delayGain=0;

    var FREQ_MUL = 7000;
    var QUAL_MUL = 30;

    var context = Audio.context;

    var volumeGain,highGain,midGain,lowGain,lowPassfilter,reverb,reverbGain,delay,delayGain,distortion,distortionGain,
    compressor,  panner;

    // use a simple Gain as input so that we can leave this connected while changing filters
    input = context.createGain();
    input.gain.value=1;
    output = input;


    function connectFilters(){

    output = input;

        if (useHigh){
            highGain = highGain || createHigh();
            output.connect(highGain);
            output = highGain;
        }

        if (useMid){
            midGain = midGain || createMid();
            output.connect(midGain);
            output = midGain;
        }

        if (useLow){
            lowGain = lowGain || createLow();
            output.connect(lowGain);
            output = lowGain;
        }

        if (useLowPass){
            lowPassfilter = lowPassfilter || createLowPass();
            output.connect(lowPassfilter);
            output = lowPassfilter;
        }


        if (useDistortion){
            distortion = distortion || context.createWaveShaper();
            distortionGain = distortionGain || context.createGain();
            distortion.curve = distortionCurve(distortionGain);
            distortion.oversample = '4x';

        output.connect(distortionGain);
        distortionGain.connect(distortion)
        output = distortion
        }

    if (useCompression){
        compressor = compressor || context.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-25, context.currentTime);
        compressor.attack.setValueAtTime(0, context.currentTime);
        compressor.release.setValueAtTime(12, context.currentTime);
        output.connect(compressor);
        output = compressor;
    }

    if (useDelay){
        delay = delay || createPingPongDelay(.12, .4);
        delayGain = delayGain || context.createGain();
        delayGain.gain.value = 0;

        output.connect(delayGain);
        delayGain.connect(delay.splitter);
        output_delay = delay.merger;
    }

    if (useReverb){
        reverb = reverb || context.createConvolver();
        reverbGain = reverbGain || context.createGain();
        reverbGain.gain.value = 0;

        output.connect(reverbGain);
        reverbGain.connect(reverb);
        output_reverb = reverb;
    }

        if (usePanning){
            panner =  panner || Audio.context.createStereoPanner();
            output.connect(panner);
            output = panner;
        }

        // always use volume as last node - never disconnect this

    volumeGain = volumeGain ||context.createGain();
        output.connect(volumeGain);
        if (output_reverb) output_reverb.connect(volumeGain);
    if (output_delay) output_delay.connect(volumeGain);
        output = volumeGain;

    }

    function disConnectFilter(){
        input.disconnect();
        if (highGain) highGain.disconnect();
        if (midGain) midGain.disconnect();
        if (lowGain) lowGain.disconnect();
        if (lowPassfilter) lowPassfilter.disconnect();
        if (reverbGain) reverbGain.disconnect();
    if (panner) panner.disconnect();
    if (distortion) distortion.disconnect();
    if (delayGain) delayGain.disconnect();
    if (compressor) compressor.disconnect();
        output_reverb = undefined;
    output_delay = undefined;
    }


    function createHigh(){
    var filter = context.createBiquadFilter();
    filter.type = "highshelf";
    filter.frequency.value = 3200.0;
    filter.gain.value = highValue;
    return filter;
    }

    function createMid(){
        var filter = context.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = 1000.0;
        filter.Q.value = 0.5;
        filter.gain.value = midValue;
        return filter;
    }

    function createLow(){
        var filter = context.createBiquadFilter();
        filter.type = "lowshelf";
        filter.frequency.value = 320.0;
        filter.gain.value = lowValue;
        return filter;
    }

    function createLowPass(){
        var filter =  context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 5000;
        return filter;
    }

    function init(){
        connectFilters();
    me.volumeValue(volumeValue);
    }

    function distortionCurve(amount) {
    var k = typeof amount === 'number' ? amount : 50,
            n_samples = 44100,
            curve = new Float32Array(n_samples),
            deg = Math.PI / 180,
            i = 0,
            x;
    for ( ; i < n_samples; ++i ) {
        x = (i * 2) / n_samples - 1;
        curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
    }
    return curve;
    }

    function createPingPongDelay(delayTime, feedback){

    // example of delay effect.
    //Taken from http://stackoverflow.com/questions/20644328/using-channelsplitter-and-mergesplitter-nodes-in-web-audio-api

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

    me.lowValue = function(value) {
    if (!useLow) return;
    if (typeof value !== "undefined"){
        var maxRange = 20;
        lowValue = value;
        lowGain.gain.value = lowValue * maxRange  ;
    }
    return lowValue;
    };

    me.midValue = function(value) {
    if (!useMid) return;
    if (typeof value !== "undefined"){
        var maxRange = 20;
        midValue = value;
        midGain.gain.value = midValue * maxRange  ;
    }
    return midValue;
    };

    me.highValue = function(value) {
    if (!useHigh) return;
    if (typeof value !== "undefined"){
        var maxRange = 20;
        highValue = value;
        highGain.gain.value = highValue * maxRange  ;
    }
    return highValue;
    };

    me.lowPassFrequencyValue = function(value) {
    if (!useLowPass) return;
    // Clamp the frequency between the minimum value (40 Hz) and half of the
    // sampling rate.
    var minValue = 40;
    var maxValue = Audio.context.sampleRate / 2;
    // Logarithm (base 2) to compute how many octaves fall in the range.
    var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
    // Compute a multiplier from 0 to 1 based on an exponential scale.
    var multiplier = Math.pow(2, numberOfOctaves * (value - 1.0));
    // Get back to the frequency value between min and max.

    lowPassfilter.frequency.value = maxValue * multiplier;
    };

    me.lowPassQualityValue = function(value) {
    if (!useLowPass) return;
    lowPassfilter.Q.value = value * QUAL_MUL;
    };
    me.compressionValue = function(value) {
    // compressor.threshold.setValueAtTime(50 * (1-value/100)-50, context.currentTime );
    compressor.ratio.setValueAtTime(4 * value/100+1, context.currentTime);
    console.log(value, compressor.threshold, compressor.ratio, compressor.attack, compressor.release)
    };

    me.reverbValue = function(value) {
    if (!useReverb) return;
    if (!reverb.buffer){
        var buffer = cachedAssets.audio["data/reverb/sportcentre.m4a"];
        if (!buffer){
            var preLoader = PreLoader();
            preLoader.load(["data/reverb/sportcentre.m4a"],PRELOADTYPE.audio,function(){
                console.error("reverb buffer loaded");
                reverb.buffer = cachedAssets.audio["data/reverb/sportcentre.m4a"];
            });
        }else{
            reverb.buffer = buffer;
        }
    }

    var max = 100;
    var fraction = parseInt(value) / max;
    reverbGain.gain.value = fraction * fraction;

    };

    me.distortionValue = function(value){
    if (!useDistortion) return;
    var max = 10
    var fraction = parseInt(value)/100;
    var set_value = max * fraction;
    distortionGain.gain.value = set_value
    }
    me.delayValue = function(value){
    if (!useDelay) return;
    var max = 100;
    var fraction = parseInt(value) / max;
    delayGain.gain.value = fraction*fraction
    }
    me.delayValue = function(value){
    if (!useDelay) return;
    var max = 100;
    var fraction = parseInt(value) / max;
    delayGain.gain.value = fraction*fraction
    }


    me.volumeValue = function(value) {
    if (!useVolume) return;
    if (typeof value !== "undefined"){
        var max = 100;
        volumeValue = value;
        var fraction = value / max;
        volumeGain.gain.value = fraction * fraction;
    }
    return volumeValue;
    };

    me.panningValue = function(value,time) {
    if (!usePanning) return;

    if (typeof value !== "undefined"){
        panningValue = value;
        if (time){
            panner.pan.setValueAtTime(panningValue,time);
        }else{
            // very weird bug in safari on OSX ... setting pan.value directy to 0 does not work
            panner.pan.setValueAtTime(panningValue,Audio.context.currentTime);
        }

    }
    return panningValue;
    };

    me.setState = function(name,value){
    disConnectFilter();

        if (name==="high") useHigh=!!value;
        if (name==="mid") useMid=!!value;
        if (name==="low") useLow=!!value;
        if (name==="lowPass") useLowPass=!!value;
        if (name==="reverb") useReverb=!!value;
        if (name==="panning") usePanning=(!!value) && Audio.context.createStereoPanner;
    if (name==="distortion") useDistortion=!!value;
    if (name==="delay") useDelay=!!value;
    if (name==="compression") useCompression=!!value;

        connectFilters();

    };

    me.input = function(){
    return input;
    };

    me.output = function(){
    return output;
    };

    init();

    return me;

});





