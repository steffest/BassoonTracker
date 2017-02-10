UI.fxPanel= function(track){

    var me = UI.panel();
    me.hide();

    track = track || 0;

    var background = UI.scale9Panel(0,0,20,20,UI.Assets.buttonDarkScale9);
    background.ignoreEvents = true;
    me.addChild(background);

    var knobSpaceX = 70;
    var knobSpaceY = 70;
    var effects = ["volume","panning","high","mid","low","lowPass","reverb"];

    var KnobTop = 0;
    var knobLeft = 10;
    for (var i = 0, len = effects.length; i<len;i++){
        var knob = UI.knob();
        knob.setProperties({
            top: KnobTop,
            left: knobLeft,
            label: effects[i]
        });
        knob.onChange = function(value){
            handleKnob(this,value);
        };
        me.addChild(knob);

        if ((i%2) == 0){
            knobLeft = knobLeft + knobSpaceX;
        }else{
            knobLeft = 10;
            KnobTop += knobSpaceY
        }
    }

    var filterChain;
    if (Audio.filterChains) filterChain = Audio.filterChains[track];

    function handleKnob(knob,value){

        if (!filterChain) return;

        var label = knob.getLabel();

        switch (label){
            case "volume":{
                filterChain.volumeValue(value);
                break;
            }
            case "panning":{
                filterChain.panningValue((value-50)/50);
                break;
            }
            case "high":{
                filterChain.highValue(value/100);
                break;
            }
            case "mid":{
                filterChain.midValue(value/100);
                break;
            }
            case "low":{
                filterChain.lowValue(value/100);
                break;
            }
            case "lowPass":{
                filterChain.lowPassFrequencyValue(value/100);
                break;
            }
            case "reverb":{
                filterChain.reverbValue(value);
                break;
            }
        }

    }

    me.setLayout = function(){
        if (!UI.mainPanel) return;
        //me.clearCanvas();

        background.setSize(me.width,me.height);

    };

    return me;

};

