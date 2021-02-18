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
    var knobs = [];
    for (var i = 0, len = effects.length; i<len;i++){
        var knob = UI.knob();
        knob.setProperties({
            top: KnobTop,
            left: knobLeft,
            label: effects[i],
            disabled: i>1
        });
        knob.onChange = function(value){
            handleKnob(this,value);
        };
		knob.onToggle = function(value){
			handleKnobState(this,value);
            handleKnob(this,this.getValue());
		};
        me.addChild(knob);
		knobs.push(knob);

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
        if (knob.isDisabled) return;

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

	function handleKnobState(knob,value){

		if (!filterChain) return;
		var label = knob.getLabel();
		filterChain.setState(label,value);
	}

    me.setLayout = function(){
        if (!UI.mainPanel) return;
        //me.clearCanvas();

        background.setSize(me.width,me.height);

		var knobSize = 70;

        var cols = Math.max(1,Math.floor(me.width/knobSize));

        var margin = Math.floor((me.width - cols*knobSize)/2);
		var colWidth = Math.floor((me.width - margin*2)/cols);
		var knobSpaceY = 70;
		var knobTop = 0;

		knobs.forEach(function(knob,index){
		    var colIndex = index%cols;
		    knob.setPosition((colIndex * colWidth) + margin,knobTop);
		    if (colIndex === cols-1){
				knobTop += knobSpaceY;
            }
        })

    };

    return me;

};

