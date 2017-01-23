UI.songControl = function(x,y,w,h,visible){
    var me = UI.element(x,y,w,h,visible);
    me.type = "songControl";

    var radioGroup = UI.radioGroup();
    radioGroup.setItems([
        {label:"   song",active:true},
        {label:"pattern",active:false}
    ]);
    me.addChild(radioGroup);

    var buttons = {};
    buttons.play = UI.Assets.generate("buttonDarkGreen");
    buttons.play.setProperties({
        image: cachedAssets.images["skin/play_green.png"],
        activeImage: cachedAssets.images["skin/play_active_red.png"],
        activeBackground: UI.Assets.buttonDarkRedActiveScale9
    });
    buttons.play.onClick = function(){
        buttons.play.toggleActive();
        if (Tracker.isPlaying()){
            Tracker.stop();
        }else{
            if (Tracker.getPlayType() == PLAYTYPE.song){
                Tracker.playSong();
            }else{
                Tracker.playPattern();
            }
        }
    };
    buttons.play.setProperties({
        name:"buttonPlay"
    });
    me.addChild(buttons.play);


    buttons.record = UI.Assets.generate("buttonDarkRed");
    buttons.record.setProperties({
        image: cachedAssets.images["skin/record.png"],
        activeImage: cachedAssets.images["skin/record_active.png"]
    });
    buttons.record.onClick = function(){
        Tracker.toggleRecord();
    };
    buttons.record.setProperties({
        name:"buttonRecord"
    });
    me.addChild(buttons.record);


    EventBus.on(EVENT.recordingChange,function(event,isRecording){
        buttons.record.setActive(isRecording);
    });
    EventBus.on(EVENT.playingChange,function(event,isPlaying){
        buttons.play.setActive(isPlaying);
    });

    var properties = ["left","top","width","height","name","type"];
    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined"){
                switch(key){
                    default:
                        me[key] = p[key];
                }
            }
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

        var buttonWidth = Math.floor(me.width/3) + 1;

        radioGroup.setProperties({
            left: 0,
            width: buttonWidth,
            top:0,
            height: me.height
        });
        buttons.play.setProperties({
            left: buttonWidth,
            width: buttonWidth,
            top:0,
            height: me.height
        });
        buttons.record.setProperties({
            left: buttonWidth*2,
            width: buttonWidth,
            top:0,
            height: me.height
        });
    };

    function triggerChangeEvent(){
        //EventBus.trigger(EVENT.trackStateChange,{track: me.track,  solo: buttons.solo.isActive, mute: buttons.mute.isActive});
    }

    me.render = function(internal){
        internal = !!internal;
        if (me.needsRendering){
            me.clearCanvas();

            radioGroup.render();
            buttons.play.render();
            buttons.record.render();


        }
        me.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }

    };

    return me;


};

