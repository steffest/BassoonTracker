UI.app_songControl = function(x,y,w,h,visible){
    var me = UI.element(x,y,w,h,visible);
    me.type = "songControl";

    var radioGroup = UI.radioGroup();
    radioGroup.setItems([
        {
            label:"song",
            active:true
        },
        {
            label:"pattern",
			labels : [
				{width: 10, label: "p"},
				{width: 20, label: "pat"}
			],
            active:false
        }
    ]);
    radioGroup.onChange = function(selectedIndex){
        if (selectedIndex == 0){
            Tracker.setPlayType(PLAYTYPE.song);
        }else{
            Tracker.setPlayType(PLAYTYPE.pattern);
        }
    };
    me.addChild(radioGroup);

    var buttons = {};
    buttons.play = UI.Assets.generate("buttonDarkGreen");
    buttons.play.setProperties({
        image: Y.getImage("play_green"),
        hoverImage: Y.getImage("play_green_hover"),
        activeImage: Y.getImage("play_active_red"),
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
        image: Y.getImage("record"),
        hoverImage: Y.getImage("record_hover"),
        activeImage: Y.getImage("record_active")
    });
    buttons.record.onClick = function(){
        Tracker.toggleRecord();
    };
    buttons.record.setProperties({
        name:"buttonRecord"
    });
    me.addChild(buttons.record);



    buttons.song = UI.Assets.generate("buttonDark");
    buttons.song.onClick = function(){
        Tracker.playSong();
    };
    buttons.song.setProperties({
        label: "Song"
    });
    me.addChild(buttons.song);

    buttons.pattern = UI.Assets.generate("buttonDark");
    buttons.pattern.onClick = function(){
        Tracker.playPattern();
    };
    buttons.pattern.setProperties({
        label: "Pattern"
    });
    me.addChild(buttons.pattern);




    EventBus.on(EVENT.recordingChange,function(isRecording){
        buttons.record.setActive(isRecording);
    });
    EventBus.on(EVENT.playingChange,function(isPlaying){
        buttons.play.setActive(isPlaying);
    });

    EventBus.on(EVENT.playTypeChange,function(playType){
        if (playType == PLAYTYPE.song){
            radioGroup.setSelectedIndex(0,true);
        }else{
            radioGroup.setSelectedIndex(1,true);
        }
    });

    var properties = ["left","top","width","height","name","type","songPatternSelector"];
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

        var buttonWidth = Math.floor(me.width/3);

        radioGroup.setProperties({
            left: 0,
            width: buttonWidth,
            top:0,
            height: me.height,
            align: "right"
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


        if (me.songPatternSelector == "big"){
            radioGroup.left = -500;
            buttonWidth = Math.floor(me.width/4) + 1;

            buttons.play.setProperties({
                left: 0,
                width: buttonWidth
            });
            buttons.record.setProperties({
                left: buttonWidth,
                width: buttonWidth
            });

            buttons.song.setProperties({
                left: buttonWidth*2,
                width: buttonWidth,
                top:0,
                height: me.height
            });
            buttons.pattern.setProperties({
                left: buttonWidth*3,
                width: buttonWidth,
                top:0,
                height: me.height
            });



        }
    };

    function triggerChangeEvent(){
        //EventBus.trigger(EVENT.trackStateChange,{track: me.track,  solo: buttons.solo.isActive, mute: buttons.mute.isActive});
    }

    me.render = function(internal){
        internal = !!internal;
        if (me.needsRendering){
            me.clearCanvas();

            if (me.songPatternSelector == "small") radioGroup.render();

            buttons.play.render();
            buttons.record.render();

            if (me.songPatternSelector == "big"){
                buttons.song.render();
                buttons.pattern.render();
            }


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

