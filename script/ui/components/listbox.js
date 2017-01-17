UI.listbox = function(x,y,w,h){
    var me = UI.element(x,y,w,h,true);
    me.selectedIndex = 0;
    var previousSelectedIndex = 0;


    var items = [];
    var visibleIndex = 0;
    var lineHeight = 18;
    var startY = 10;
    var properties = ["left","top","width","height","name","type","onChange","selectedIndex","centerSelection"];

    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined") me[key] = p[key];
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);
        background.setSize(me.width,me.height);
        scrollBar.setProperties({
            left: me.width - 18,
            top: 18,
            width: 16,
            height: me.height - 4 - 32
        });

        buttonUp.setProperties({
            left: me.width - 18,
            top: 2,
            width: 16,
            height: 16,
            label:"↑"
        });

        buttonDown.setProperties({
            left: me.width - 18,
            top: me.height - 19,
            width: 16,
            height: 16,
            label:"↓"
        });

        if (me.centerSelection){
            startY = Math.ceil((me.height - lineHeight)/2);
        }
    };

    me.setSelectedIndex = function(index,internal){
        me.selectedIndex = index;
        if (me.centerSelection) visibleIndex = me.selectedIndex;
        me.refresh();
        if (!internal && me.onChange && previousSelectedIndex!=me.selectedIndex) me.onChange();
        previousSelectedIndex = me.selectedIndex;
    };
    me.getSelectedIndex = function(){
        return me.selectedIndex;
    };

    var background = UI.scale9Panel(0,0,me.width,me.height,{
        img: cachedAssets.images["skin/panel_dark.png"],
        left:3,
        top:3,
        right:1,
        bottom: 1
    });
    background.ignoreEvents = true;
    me.addChild(background);

    var buttonUp = UI.Assets.generate("button20_20");
    me.addChild(buttonUp);
    buttonUp.onClick = function(){
        if (visibleIndex>0){
            visibleIndex--;
        }
        if (me.centerSelection) {
            me.setSelectedIndex(visibleIndex);
        }else{
            me.refresh();
        }
    };

    var buttonDown = UI.Assets.generate("button20_20");
    me.addChild(buttonDown);
    buttonDown.onClick = function(){
        visibleIndex++;
        if (me.centerSelection) {
            me.setSelectedIndex(visibleIndex);
        }else{
            me.refresh();
        }
    };

    var scrollBar = UI.scale9Panel(w-28,18,16,h-3,{
        img: cachedAssets.images["skin/bar.png"],
        left:2,
        top:2,
        right:3,
        bottom: 3
    });
    scrollBar.onClick=function(){
        if (this.eventY<me.height/2){
            if (visibleIndex>0){
                visibleIndex--;
            }
        }else{
            visibleIndex++;
        }

        if (me.centerSelection) {
            me.setSelectedIndex(visibleIndex);
        }else{
            me.refresh();
        }
    };

    me.addChild(scrollBar);

    me.render = function(internal){
        internal = !!internal;

        if (this.needsRendering){
            background.render();
            var line = cachedAssets.images["skin/line_hor.png"];
            for (var i = 0, len = items.length;i<len;i++){
                var item = items[i];
                var textX = 10;
                var textY = startY + ((i-visibleIndex)*lineHeight);
                if ((textY>0) && (textY<me.height)){

                    if (me.selectedIndex == i){
                        me.ctx.fillStyle = 'rgba(100,100,255,0.1';
                        me.ctx.fillRect(0,textY-4,me.width-2,lineHeight);
                    }

                    if (fontMed) fontMed.write(me.ctx,item.label,textX,textY,0);
                    textY += 11;

                    if (line) me.ctx.drawImage(line,0,textY,me.width-2,2);
                }
            }

            scrollBar.render();
            buttonUp.render();
            buttonDown.render();
        }
        this.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }

    };

    me.setItems = function(newItems){
        items = newItems;
        me.refresh();
    };

    me.getItems = function(){
        return items;
    };


    me.getItemAtPosition = function(x,y){
        y = y-startY;
        var index = Math.floor(y/lineHeight) + visibleIndex;
        if (index>=0 && index<items.length){
            return(items[index]);
        }else{
            return undefined;
        }
    };

    return me;
};