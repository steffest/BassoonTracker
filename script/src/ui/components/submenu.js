UI.submenu = function(x,y,w,h){
    var me = UI.element(x,y,w,h);
    me.type = "submenu";
    var items;

    var itemHeight = 26;
    var properties = ["left","top","width","height","name","type"];
    var background;

    var paddingTop = 9;
    var paddingLeft = 9;
    var charWidth = 9;

    var hoverIndex;
    var preHoverIndex;

    var activeSubmenu;

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
        if (index !== preHoverIndex){
            me.setSelectedIndex(index)
        }
    };

    me.onHoverExit = function(){
        if (hoverIndex){
            hoverIndex = undefined;
            preHoverIndex = undefined;
            me.refresh();
        }
    };

    me.onShow = function(){
        hoverIndex=0;
        preHoverIndex=0;
    }

    me.onHide = function(){
        if (activeSubmenu){
            activeSubmenu.subMenu.hide();
            activeSubmenu = undefined;
        }
    }

    me.setSelectedIndex = function(index){
        hoverIndex = Math.min(index,items.length-1);
        if (hoverIndex<0) hoverIndex=0;
        preHoverIndex = hoverIndex;

        var item = items[hoverIndex];
        if (item.subItems){
            me.activateSubmenu(item);
        }else{
            if (activeSubmenu){
                activeSubmenu.subMenu.hide();
                activeSubmenu = undefined;
            }
        }

        me.refresh();
    }

    me.getSelectedIndex = function(){
        if (typeof hoverIndex !== "undefined") return hoverIndex;
        return -1;
    }

    me.onClick = function(data){
        if (!(items && items.length)) return;
        var selectedItem = items[Math.floor(me.eventY/itemHeight)];
        me.executeItem(selectedItem);
    };

    me.executeItem = function(item){
        if (isDisabled(item)) return;
        if (item){
            if (item.command){
                me.hide();
                me.parent.refresh();
                if (me.mainMenu) me.mainMenu.deActivate();
                EventBus.trigger(EVENT.command,item.command);
            }else if (item.subItems){
                me.toggleSubmenu(item);
            }
        }
    }

    me.activateSubmenu = function(item){
        if (!item.subMenu){
            var subMenu = UI.submenu();
            subMenu.setProperties({
                background: UI.Assets.buttonLightScale9
            });
            subMenu.hide();
            subMenu.setItems(item.subItems);
            subMenu.zIndex = 300;
            me.parent.addChild(subMenu);
            subMenu.mainMenu = me.mainMenu;
            item.subMenu = subMenu;
        }
        var left = me.left + me.width - 20;
        if ((left+item.subMenu.width)>UI.mainPanel.width){
            left = UI.mainPanel.width-item.subMenu.width;
        }
        item.subMenu.setPosition(left,me.top + item.index*itemHeight);
        item.subMenu.show();
        activeSubmenu = item;
        me.refresh();
    }

    me.deActivateSubmenu = function(){
        if (activeSubmenu){
            activeSubmenu.subMenu.hide();
            activeSubmenu = undefined;
            me.refresh();
        }
    }

    me.toggleSubmenu = function(item){
        if (item.subMenu && item.subMenu.isVisible()){
            me.deActivateSubmenu();
        }else{
            me.activateSubmenu(item);
        }

    }

    me.render = function(internal){
        if (!me.isVisible()) return;
        internal = !!internal;

        if (this.needsRendering){
            me.clearCanvas();
            if (background)background.render();

            var line = Y.getImage("line_hor");

            var textY = 0;
            var textX = 0;
            var textWidth = me.width - 3;

            var max = items.length-1;

            for (var i = 0; i<=max;i++){
                var item = items[i];

                var disabled = isDisabled(item);

                if (i === hoverIndex && !disabled){
                    me.ctx.fillStyle = "rgba(255,255,255,0.2)";
                    me.ctx.fillRect(textX,textY,textWidth,itemHeight);
                }

                if (item.label){
                    fontFT.write(me.ctx,getLabel(item),textX + paddingLeft,textY + paddingTop);
                }

                if (item.subItems){
                    fontMed.write(me.ctx,">",me.width-16,textY + paddingTop + 2);
                }

                if (disabled){
                    me.ctx.fillStyle = "rgba(88,105,129,0.6)";
                    me.ctx.fillRect(textX,textY,textWidth,itemHeight);
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
        items.forEach(function(item,index){
            var labelWidth = item.label ? getLabel(item).length * charWidth : 0;
            labelWidth += paddingLeft*2 + 6;
            width = Math.max(width,labelWidth);
            item.index = index;
        });

        var height = items.length*itemHeight + 4;
        me.setSize(width,height);
        if (background) background.setSize(me.width,me.height);

        hoverIndex = undefined;
        preHoverIndex = undefined;
        activeSubmenu = undefined;
        
        
        me.refresh();
    };

    me.getItems = function(){
        return items;
    };



    function isDisabled(item){
        if (typeof item.disabled === "function"){
            return item.disabled();
        }
        return !!item.disabled;
    }

    function getLabel(item){
        if (typeof item.label === "function"){
            return item.label();
        }
        return item.label;
    }


    return me;
};