UI.fxPanel= function(track){

    var me = UI.panel();
    me.hide();

    track = track || 0;

    var background = UI.scale9Panel(0,0,20,20,UI.Assets.buttonDarkScale9);
    background.ignoreEvents = true;
    me.addChild(background);

    var knobSpace = 70;
    var effects = ["volume","panning","high","mid","low","lowPass","reverb"];

    for (var i = 0, len = effects.length; i<len;i++){
        var knob = UI.knob();
        knob.setProperties({
            top: i*knobSpace,
            left: 10,
            label: effects[i]
        });
        knob.onChange = function(value){
            handleKnob(this,value);
        };
        me.addChild(knob);
    }

    var filterChain = Audio.filterChains[track];

    function handleKnob(knob,value){
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

