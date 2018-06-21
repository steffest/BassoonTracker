UI.InfoPanel = function(){

    var me = UI.element();
    var text = "";
    var source = "";
    var status = "";
    var moreInfoUrl;

    var infoButton = UI.Assets.generate("buttonDark");
    infoButton.setLabel("More info ");
    infoButton.onClick = function(){
        if (moreInfoUrl) window.open(moreInfoUrl);
    };
    me.addChild(infoButton);

    EventBus.on(EVENT.statusChange,function(context){
        if (context){
            if (typeof context.status != "undefined") status = context.status;
            if (typeof context.info != "undefined"){
                text = context.info;
                source = context.source;
                moreInfoUrl = context.url;
            }
        }
        me.refresh();
    });


    var properties = ["left","top","width","height","name","type","zIndex"];
    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined") me[key] = p[key];
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

        if (me.setLayout) me.setLayout(me.left,me.top,me.width, me.height);
    };

    me.setLayout = function(){

        var width = Layout.col1W;
        var label = "More Info";
        if (width<100) label = "info";
        if (width<45) label = "i";

        infoButton.setProperties({
            width: Layout.col1W,
            height: 26,
            top: 2,
            left:Layout.col5X - 2 - me.left,
            label: label,
            font: fontFT
        });

    };


    me.render = function(internal){
        if (!me.isVisible()) return;

        internal = !!internal;

        if (this.needsRendering){
            me.clearCanvas();

            if (moreInfoUrl) infoButton.render();

            var fText = text;
            if (status) fText = status + ": " + fText;

            window.fontFT.write(me.ctx,fText,6,11,0);

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

