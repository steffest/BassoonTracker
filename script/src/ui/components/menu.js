UI.menu = function(x,y,w,h,submenuParent){
    var me = UI.element(x,y,w,h);
	me.keepSelection = true;
    var items;

    var properties = ["left","top","width","height","name","type","background","layout"];
    var background;
    var buttons = [];

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

        var selectedItem = items[selectedIndex];
        for (i = 0; i<max;i++){
            if (i !== selectedIndex && items[i].subMenu) items[i].subMenu.hide();
        }

        if (selectedItem){
            if (selectedItem.subMenu){
            	
            	var xOffset = data.globalX - data.x;
                selectedItem.subMenu.setPosition((selectedItem.startX || 0) + xOffset,me.height);
                selectedItem.subMenu.toggle();
                selectedItem.subMenu.parent.refresh();
            }
            if (selectedItem.command){
                EventBus.trigger(EVENT.command,selectedItem.command);
            }
        }

    };


    me.render = function(internal){
		if (!me.isVisible()) return;
        internal = !!internal;

        if (this.needsRendering){
            var textX = 10;
            var textY = 10;
            var fontWidth = 9;
            var itemMargin = 24;

			me.clearCanvas();
			if (background)background.render();

			if (buttons.length){
                buttons.forEach(function(button){
                    button.render();
                })
            }else if (items){
				items.forEach(function(item){
					item.startX = textX;
					fontMed.write(me.ctx,item.label,textX,textY);
					textX += (item.label.length*fontWidth) + itemMargin;
				});
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
        submenuParent = submenuParent || me.parent;
        buttons = [];
		var buttonProperties = {
			background: UI.Assets.buttonKeyScale9,
			activeBackground:UI.Assets.buttonKeyActiveScale9,
			isActive:false,
			textAlign: "center",
			font: window.fontDark,
			paddingTopActive: 1
		};

		var buttonX = 3;
		var buttonY = 3;
        items.forEach(function(item,index){

            if (me.layout === "buttons"){
				var button = UI.button(buttonX,buttonY,60,18);
				buttonX += 60;
				if (index === 1){
                    buttonX = 3;
                    buttonY += 18;
                }


				button.setProperties(buttonProperties);
				button.setLabel(item.label);
				if (item.onClick) button.onClick = function(){
                    item.onClick();
				};
				buttons.push(button);
				me.addChild(button);
            }

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