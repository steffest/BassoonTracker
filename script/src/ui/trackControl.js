UI.trackControl = function(x,y,w,h,visible){
    var me = UI.element(x,y,w,h,visible);
    me.type = "trackControl";
    me.track = 0;

    var font;
    var label = "test";

    var buttons = {};

    buttons.solo = UI.Assets.generate("buttonDark");
    buttons.solo.setProperties({
        activeImage: Y.getImage("solo.png"),
        activeBackground:UI.Assets.buttonDarkGreenActiveScale9
    });
    buttons.solo.onClick = function(){
        buttons.solo.toggleActive();
        if (buttons.mute.isActive) buttons.mute.toggleActive();
        triggerChangeEvent();
    };
    buttons.solo.setProperties({
        name:"buttonSolo",
        label:"S"
    });
    me.addChild(buttons.solo);

    buttons.mute = UI.Assets.generate("buttonDark");
    buttons.mute.setProperties({
        activeImage: Y.getImage("mute"),
        activeBackground:UI.Assets.buttonDarkRedActiveScale9
    });
    buttons.mute.onClick = function(){
        buttons.mute.toggleActive();
        if (buttons.solo.isActive) buttons.solo.toggleActive();
        triggerChangeEvent();
    };
    buttons.mute.setProperties({
        name:"buttonMute",
        label:"M"
    });
    me.addChild(buttons.mute);

    buttons.fx = UI.Assets.generate("buttonDark");
    buttons.fx.onClick = function(){
        buttons.fx.toggleActive();
        UI.mainPanel.toggleFxPanel(me.track);
    };
    buttons.fx.setProperties({
        name:"buttonFX",
        label:"FX"
    });
    me.addChild(buttons.fx);

    var properties = ["left","top","width","height","name","type","track","solo","mute"];
    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined"){
                switch(key){
                    case "solo":
                        if (buttons.mute.isActive)  buttons.mute.setActive(false);
                        buttons.solo.setActive(true);
                        triggerChangeEvent();
                        break;
                    case "mute":
                        if (buttons.solo.isActive)  buttons.solo.setActive(false);
                        buttons.mute.setActive(true);
                        triggerChangeEvent();
                        break;
                    default:
                        me[key] = p[key];
                }
            }
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

        var buttonWidth = Math.floor(me.width/3) + 1;

        buttons.solo.setProperties({
            left: 0,
            width: buttonWidth,
            top:0,
            height: me.height
        });
        buttons.mute.setProperties({
            left: buttonWidth-1,
            width: buttonWidth,
            top:0,
            height: me.height
        });
        buttons.fx.setProperties({
            left: buttonWidth*2-2,
            width: buttonWidth,
            top:0,
            height: me.height
        });
    };

    function triggerChangeEvent(){
        EventBus.trigger(EVENT.trackStateChange,{track: me.track,  solo: buttons.solo.isActive, mute: buttons.mute.isActive});
    }

    me.render = function(internal){
        internal = !!internal;
        if (me.needsRendering){
            me.clearCanvas();
            if (font){
                font.write(me.ctx,label.toUpperCase(),6,11,0);
            }else{
                me.ctx.fillStyle = "white";
                me.ctx.fillText(label,10,10);
            }

            buttons.solo.render();
            buttons.mute.render();
            buttons.fx.render();


            // arrow glyphs

            //var buttonCenterX = Math.floor((buttonUp.width - 8)/2);
            //var buttonCenterY = Math.floor((buttonUp.height - 8)/2);
            //window.fontMed.write(me.ctx,"↑",buttonUp.left + buttonCenterX,buttonUp.top + buttonCenterY,0);
            //window.fontMed.write(me.ctx,"↓",buttonDown.left + buttonCenterX,buttonDown.top + buttonCenterY,0);


            //var b = buttonUp.render(true);
            //me.ctx.drawImage(b,10,10,50,30);
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

