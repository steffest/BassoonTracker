UI.image = function(x,y,w,h,src){

    w = w || 14;
    h = h || 14;

    var me = UI.element(x,y,w,h,true);

    var properties = ["left","top","width","height","name"];

    me.setProperties = function(p){
        properties.forEach(function(key){
            if (typeof p[key] != "undefined") me[key] = p[key];
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);
    };

    var baseImage = Y.getImage(src);

    me.render = function(internal){
        internal = !!internal;
        if (!me.isVisible()) return;

        if (this.needsRendering){
            me.clearCanvas();
            if (baseImage)
            switch (me.scale){
                case "stretch":
                    me.ctx.drawImage(baseImage,0,0,me.width,me.height);
                    break;
                default:
                    var marginW = (me.width-baseImage.width)>>1;
                    var marginH = (me.height-baseImage.height)>>1;
                    if (me.verticalAlign === "top") marginH=0;
                    if (me.horizintalAlign === "right") marginW = me.width-baseImage.width;
                    me.ctx.drawImage(baseImage,marginW,marginH);
            }
        }
        this.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }

    };

    return me;
};