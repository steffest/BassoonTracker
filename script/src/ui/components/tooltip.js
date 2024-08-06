UI.ToolTip = function(x,y,text){
    var me = UI.element(x,y,100,50);
    me.type = "tooltip";
    me.ignoreEvents = true;
    var text = "";
    var startOpacity = -2; // this defines the delay before the tooltip should appear
    var endOpacity = 2.5; // this defines the delay before the tooltip is reset to show the appear animation
    var opacityStep = 0.1;
    var opacity = startOpacity;
    var prevLeft;
    var prevTop;

    var background = UI.scale9Panel(0,0,me.width,me.height,{
        img: Y.getImage("tooltip"),
        left:8,
        top:8,
        right:11,
        bottom: 11
    });
    me.addChild(background);

    var overlay = UI.scale9Panel(0,0,me.width,me.height,{
        img: Y.getImage("tooltip_extra"),
        left:8,
        top:2,
        right:11,
        bottom: 3
    });

    me.setProperties = function(p){
        var properties = ["left","top","width","height"];

        if (typeof p.text !== "undefined"){
            if (p.text != text){
                text = p.text;
                if (opacity>1) opacity=1;
                me.needsRendering = true;
            }
        }

        properties.forEach(function(key){
            if (typeof p[key] != "undefined") me[key] = p[key];
        });

        // delay before appearing when mouse is not moved
        if (text && opacity<0 && (me.left !== prevLeft || me.top !== prevTop)){
            opacity = startOpacity+opacityStep;
        }
        prevLeft = me.left;
        prevTop = me.top;
    }

    me.render = function(internal){
        internal = !!internal;
        if (!me.isVisible()) return;
        if (!text) return;
        if (opacity<=0) return;

        if (me.needsRendering){
            me.clearCanvas();
            var key;
            var keyW;
            var w = window.fontSmallDark.getTextWidth(text)+30;
            var h = 29;
            var label = text;

            if (text.indexOf("[")>0){
                key = text.split("[")[1].split("]")[0];
                label = text.split("[")[0].trim();
                w = window.fontSmallDark.getTextWidth(label)+30;
                keyW = window.fontSmall.getTextWidth(key);
                w = Math.max(w,keyW);
                h += 10;
            }

            me.width = me.canvas.width = w;
            me.height = me.canvas.height = h;

            background.setSize(w,h);

            //me.ctx.fillStyle = "#ead599";
            //me.ctx.fillRect(0,0,me.width,me.height);
            background.render();

            if (key){
                overlay.setSize(w-13,12);
                var c = overlay.render(true);
                me.ctx.drawImage(c,4,h-21);

                w = window.fontSmallDark.getTextWidth(key);
                window.fontSmall.write(me.ctx,key, me.width-w-17,h-17,0);
            }

            window.fontSmallDark.write(me.ctx,label,13,9,0);
        }

        me.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            if (opacity<1) me.parentCtx.globalAlpha = opacity;
            if (opacity>1) opacity = 1;
            var left = me.left + Math.floor((opacity*10));
            me.parentCtx.drawImage(me.canvas,left,me.top);
            me.parentCtx.globalAlpha = 1;
        }
    }

    me.onHide = function(){
        if (opacity>=1){
            opacity = 1.1;
        }else{
            opacity = startOpacity;
        }

    }

    EventBus.on(EVENT.screenRefresh,function(){
        if (opacity>1){
            // delay before resetting opacity/appear animation
            opacity += opacityStep;
            if (opacity>endOpacity){
                opacity = startOpacity;
            }
        }
        if (!me.visible) return;
        if (opacity>startOpacity && opacity<1){
            opacity += opacityStep;
            if (opacity>1) opacity = 1;
            me.needsRendering = true;
        }
    });

    return me;
}