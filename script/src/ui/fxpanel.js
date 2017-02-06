UI.fxPanel= function(){

    var me = UI.panel();
    me.hide();

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
        me.addChild(knob);
    }

    me.setLayout = function(){
        if (!UI.mainPanel) return;
        //me.clearCanvas();

        background.setSize(me.width,me.height);

    };

    return me;

};

