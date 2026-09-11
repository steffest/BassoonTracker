import Audio from "../audio.js";

let FilterChain = (function() {
    var me = {};

    var input,output;
    var volumeValue = 70;
    var panningValue = 0;
    var context = Audio.context;

    var volumeGain,panner;

    // use a simple Gain as input so that we can leave this connected while changing filters
    input = context.createGain();
    input.gain.value=1;
    output = input;

    function connectFilters(){

        output = input;
        panner =  panner || Audio.context.createStereoPanner();
        output.connect(panner);
        output = panner;

        // always use volume as last node - never disconnect this

        volumeGain = volumeGain ||context.createGain();
        output.connect(volumeGain);
    }

    function disConnectFilter(){
        input.disconnect();
        if (panner) panner.disconnect();
    }

    function init(){
        connectFilters();
        me.volumeValue(volumeValue);
    }

    me.volumeValue = function(value) {
        if (typeof value !== "undefined"){
            var max = 100;
            volumeValue = value;
            var fraction = value / max;
            volumeGain.gain.value = fraction * fraction;
        }
        return volumeValue;
    };

    me.panningValue = function(value,time) {

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

    me.setState = function(){
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

export default FilterChain;





