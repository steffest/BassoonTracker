UI.animsprite = function(x,y,w,h,baseImageName,frames){

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

    var baseImage = Y.getImage(baseImageName);
    var step = 0;

    me.onShow = function(){
        UI.ticker.onEachTick2(function(){
            step++;
            if (step>=frames) step=0;
            me.refresh();
        },0);
    };

    me.onHide = function(){
        UI.ticker.onEachTick2();
    };


    me.render = function(internal){
        internal = !!internal;

        if (this.needsRendering){

            me.clearCanvas();
            me.ctx.drawImage(baseImage,step*w,0,w,h,0,0,w,h);
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