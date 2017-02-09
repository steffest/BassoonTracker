UI.submenu = function(x,y,w,h){
    var me = UI.element(x,y,w,h);
    var items;

    var itemHeight = 26;
    var properties = ["left","top","width","height","name","type"];
    var background;

    var paddingTop = 9;
    var paddingLeft = 9;
    var charWidth = 9;

    var hoverIndex;
    var preHoverIndex;

    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined") me[key] = p[key];
        });

        if (p["background"]){
            background = UI.scale9Panel(0,0,me.width,me.height,p["background"]);
            background.ignoreEvents = true;
            me.addChild(background);
        }

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

    };

    me.onHover = function(data){
        var index = Math.floor(me.eventY/itemHeight);
        if (index != preHoverIndex){
            hoverIndex = index;
            preHoverIndex = hoverIndex;
            me.refresh();
        }
    };

    me.onHoverExit = function(){
        if (hoverIndex){
            hoverIndex = undefined;
            preHoverIndex = undefined;
            me.refresh();
        }

    };

    me.onClick = function(data){
        if (!(items && items.length)) return;

        var selectedItem = items[Math.floor(me.eventY/itemHeight)];
        if (selectedItem && selectedItem.command){
            me.hide();
            me.parent.refresh();
            EventBus.trigger(EVENT.command,selectedItem.command);
        }
    };

    me.render = function(internal){
        if (!me.isVisible()) return;
        internal = !!internal;

        if (this.needsRendering){
            if (background)background.render();

            var line = Y.getImage("line_hor");

            var textY = 0;
            var textX = 0;
            var textWidth = me.width - 3;

            var max = items.length-1;

            for (var i = 0; i<=max;i++){
                var item = items[i];

                if (i == hoverIndex){
                    me.ctx.fillStyle = "rgba(255,255,255,0.2)";
                    me.ctx.fillRect(textX,textY,textWidth,itemHeight);
                }

                if (item.label){
                    fontMed.write(me.ctx,item.label,textX + paddingLeft,textY + paddingTop);
                }
                textY += itemHeight;
                if (i<max) me.ctx.drawImage(line,textX,textY,textWidth,2);
            }
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
        var width = 50;
        items.forEach(function(item){
            var labelWidth = item.label ? item.label.length * charWidth : 0;
            labelWidth += paddingLeft*2 + 6;
            width = Math.max(width,labelWidth);
        });

        var height = items.length*itemHeight + 4;
        me.setSize(width,height);
        if (background) background.setSize(me.width,me.height);
        me.refresh();
    };

    me.getItems = function(){
        return items;
    };


    return me;
};