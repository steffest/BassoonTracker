UI.menu = function(x,y,w,h,submenuParent){
    var me = UI.element(x,y,w,h);
    var items;

    var properties = ["left","top","width","height","name","type"];

    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined") me[key] = p[key];
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

    };

    me.onClick = function(data){
        if (!(items && items.length)) return;

        var x = data.x;
        var selectedIndex = 0;
        var i;
        var max = items.length;

        for (i = 0; i<max;i++){
            if (x<items[i].startX) break;
            selectedIndex = i;
        }

        selectedItem = items[selectedIndex];
        for (i = 0; i<max;i++){
            if (i !== selectedIndex && items[i].subMenu) items[i].subMenu.hide();
        }

        if (selectedItem){
            if (selectedItem.subMenu){
                selectedItem.subMenu.setPosition(selectedItem.startX || 0,me.height);
                selectedItem.subMenu.toggle();
                selectedItem.subMenu.parent.refresh();
            }
            if (selectedItem.command){
                EventBus.trigger(EVENT.command,selectedItem.command);
            }
        }

    };


    me.render = function(internal){
        internal = !!internal;

        if (this.needsRendering){
            var textX = 10;
            var textY = 10;
            var fontWidth = 9;
            var itemMargin = 24;

            items.forEach(function(item){
                item.startX = textX;
                fontMed.write(me.ctx,item.label,textX,textY);
                textX += (item.label.length*fontWidth) + itemMargin;
            });
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
        submenuParent = submenuParent || me.parent;

        items.forEach(function(item){
            if (item.subItems){

                var subMenu = UI.submenu();
                subMenu.setProperties({
                    background: UI.Assets.buttonLightScale9
                });
                subMenu.hide();
                subMenu.setItems(item.subItems);
                subMenu.zIndex = 200;
                submenuParent.addChild(subMenu);
                item.subMenu = subMenu;
            }
        });
        me.zIndex = 9;

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