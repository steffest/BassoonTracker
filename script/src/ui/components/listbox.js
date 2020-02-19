UI.listbox = function(x,y,w,h){
    var me = UI.element(x,y,w,h,true);
    me.selectedIndex = 0;
    var previousSelectedIndex = 0;

    var font = window.fontMed;
    var fontSmall = window.fontSmall;

    var items = [];
    var visibleIndex = 0;
    var visibleIitems = 0;
    var lineHeight = 18;
    var startY = 10;
    var scrollBarItemOffset = 0;
    var hoverIndex;
    var prevHoverIndex;
    var properties = ["left","top","width","height","name","type","onChange","selectedIndex","centerSelection"];

    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined") me[key] = p[key];
        });
        
        if (typeof p["font"] != "undefined") font = p["font"];
        

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);
        background.setSize(me.width,me.height);

        setScrollBarPosition();

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
		setScrollBarPosition();
        me.refresh();
        if (!internal && me.onChange && previousSelectedIndex!=me.selectedIndex) me.onChange();
        previousSelectedIndex = me.selectedIndex;
    };
    me.getSelectedIndex = function(){
        return me.selectedIndex;
    };

    var background = UI.scale9Panel(0,0,me.width,me.height,{
        img: Y.getImage("panel_dark"),
        left:3,
        top:3,
        right:2,
        bottom: 2
    });
    background.ignoreEvents = true;
    me.addChild(background);

    var buttonUp = UI.Assets.generate("button20_20");
    me.addChild(buttonUp);
    buttonUp.onClick = function(){
        me.navigateUp();
    };

    var buttonDown = UI.Assets.generate("button20_20");
    me.addChild(buttonDown);
    buttonDown.onClick = function(){
        me.navigateDown();
    };

    var scrollBar = UI.scale9Panel(w-28,18,16,h-3,{
        img: Y.getImage("bar"),
        left:2,
        top:2,
        right:3,
        bottom: 3
    });

    scrollBar.onDragStart=function(){
       scrollBar.startDragIndex = visibleIndex;

    };

    scrollBar.onDrag=function(touchData){
        if (items.length>visibleIitems && scrollBarItemOffset){
            var delta =  touchData.deltaY;
            visibleIndex = Math.floor(scrollBar.startDragIndex + delta/scrollBarItemOffset);
            visibleIndex = Math.min(visibleIndex,getMaxIndex());
            visibleIndex = Math.max(visibleIndex,0);

            if (me.centerSelection) {
                me.setSelectedIndex(visibleIndex);
            }else{
				setScrollBarPosition();
            }
        }
    };

    me.addChild(scrollBar);

    me.navigateUp = function(){
        if (visibleIndex>0){
            visibleIndex--;
            setScrollBarPosition();
        }
        if (me.centerSelection) {
            me.setSelectedIndex(visibleIndex);
        }else{
            me.refresh();
        }
    };

    me.navigateDown = function(){
        if (visibleIndex<getMaxIndex()){
            visibleIndex++;
            setScrollBarPosition();
        }

        if (me.centerSelection) {
            me.setSelectedIndex(visibleIndex);
        }else{
            me.refresh();
        }
    };

    me.render = function(internal){
        internal = !!internal;
        if (!me.isVisible()) return;

        if (this.needsRendering){
            background.render();
            var line = Y.getImage("line_hor");
            for (var i = 0, len = items.length;i<len;i++){
                var item = items[i];
                var textX = 10;
                var indent = 10;
                var highlightY = 6;
                var textY = startY + ((i-visibleIndex)*lineHeight);

                if ((textY>0) && (textY<me.height)){

                    var targetCtx = me.ctx;
                    var _y  = textY;
                    var clip = textY>=me.height-lineHeight;
                    var itemCanvas;

                    if(clip){
                        var lastItemHeight = me.height-textY+1;
                        if (lastItemHeight>1){
                            itemCanvas = document.createElement("canvas");
                            itemCanvas.width = me.width-2;
                            itemCanvas.height = lastItemHeight;
                            targetCtx = itemCanvas.getContext("2d");
                            _y = 4;
                            highlightY = 6;
                        }else {
                            targetCtx = undefined;
                        }
                    }

                    if (targetCtx){
                        if (hoverIndex+visibleIndex === i){
                            targetCtx.fillStyle = 'rgba(110,130,220,0.07)';
                            targetCtx.fillRect(0,_y-highlightY,me.width-2,lineHeight);
                        }

                        if (me.selectedIndex === i){
                            targetCtx.fillStyle = 'rgba(110,130,220,0.15)';
                            targetCtx.fillRect(0,_y-highlightY,me.width-2,lineHeight);
                        }



                        if (item.level) textX += item.level*indent;

                        if (item.icon){
                            targetCtx.drawImage(item.icon,textX,_y-2);
                            textX += item.icon.width + 4;
                        }

                        var text = item.label;

                        if (font){

                            if (item.info){
                                var infoLength = (item.info.length*6)+20;
                                fontSmall.write(targetCtx,item.info,me.width-infoLength,_y,0);
                                text = text.substr(0,Math.floor((me.width-infoLength-textX-26)/font.charWidth));
                            }

                            font.write(targetCtx,text,textX,_y,0);
                        }

                        textY += 11;
                        _y += 11;

                        if (line) targetCtx.drawImage(line,0,_y,me.width-2,2);

                        if(clip){
                            me.ctx.drawImage(itemCanvas,0,textY-11-4);
                        }
                    }


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
        visibleIndex = Math.min(visibleIndex,getMaxIndex());
        setScrollBarPosition();
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

    me.insertItemAfterIndex = function(newItem,index,indent){

    };

    function setScrollBarPosition(){
        var max = items.length;
        visibleIitems = Math.floor(me.height/lineHeight);
        if (me.centerSelection){visibleIitems = 1;}

        var startTop = 18;
        var top = startTop;
        var startHeight = me.height - 4 - 32;
        var height = startHeight;
        scrollBarItemOffset = 0;

        if (max>visibleIitems){
            height = Math.floor((visibleIitems / max) * startHeight);
            if (height<12) height = 12;

            scrollBarItemOffset = (startHeight - height) / (max-visibleIitems);

        }

        if (visibleIndex && scrollBarItemOffset){
            top = Math.floor(startTop + scrollBarItemOffset*visibleIndex);
        }

        scrollBar.setProperties({
            left: me.width - 18,
            top: top,
            width: 16,
            height: height
        });
    }


    me.onMouseWheel = function(touchData){
        if (touchData.mouseWheels[0] > 0){
            me.navigateUp();
        }else{
            me.navigateDown();
        }
    };

    me.onDragStart = function(touchData){
        me.startDragIndex = visibleIndex;
    };

    me.onDrag = function(touchData){
        if (items.length>visibleIitems){
            var delta =  Math.round((touchData.deltaY)/lineHeight);
            visibleIndex = me.startDragIndex - delta;
            visibleIndex = Math.max(visibleIndex,0);
            visibleIndex = Math.min(visibleIndex,getMaxIndex());

            if (me.centerSelection) {
                me.setSelectedIndex(visibleIndex);
            }else{
				setScrollBarPosition();
            }
        }
    };


    me.onHover = function(data){
        var index = Math.floor((me.eventY-startY)/lineHeight);
        if (index !== prevHoverIndex){
            hoverIndex = index;
            prevHoverIndex = hoverIndex;
            me.refresh();
        }
    };

    me.onHoverExit = function(){
        if (hoverIndex){
            hoverIndex = undefined;
            prevHoverIndex = undefined;
            me.refresh();
        }

    };




    function getMaxIndex(){
        var max = items.length-1;
        if (!me.centerSelection) {
            max = items.length-visibleIitems;
        }
        if (max<0) max=0;
        return max;
    }

    return me;
};