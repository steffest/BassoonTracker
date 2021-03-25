UI.menu = function(x,y,w,h,submenuParent){
    var me = UI.element(x,y,w,h);
	me.keepSelection = true;
    var items;

    var properties = ["left","top","width","height","name","type","background","layout"];
    var background;
    var buttons = [];
    var activeIndex;
    var hoverIndex,preHoverIndex;
    var itemMargin = 24;

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
        var selectedIndex = getItemIndexAtPosition(data.x);
        items.forEach(function(item,index){
            if (index !== selectedIndex && item.subMenu) item.subMenu.hide();
        })

        if (selectedIndex<0) return;
        var selectedItem = items[selectedIndex];
        activeIndex = undefined;

        Input.setFocusElement(me);

        if (selectedItem.subMenu){
            var xOffset = data.globalX - data.x;
            selectedItem.subMenu.setPosition((selectedItem.startX || 0) + xOffset,me.height);
            selectedItem.subMenu.toggle();
            selectedItem.subMenu.parent.refresh();

            if(selectedItem.subMenu.isVisible()){
                activeIndex = selectedIndex;
            }
        }
        if (selectedItem.command){
            EventBus.trigger(EVENT.command,selectedItem.command);
        }

    };

    me.onHover = function(data){
        var selectedIndex = getItemIndexAtPosition(me.eventX);
        if (selectedIndex !== preHoverIndex){
            hoverIndex = selectedIndex;
            preHoverIndex = hoverIndex;
            me.refresh();
        }

        if ( selectedIndex<0) return;
        if (activeIndex>=0 && activeIndex!==selectedIndex){
            me.activateSubmenu(selectedIndex);
        }


    };

    me.onHoverExit = function(){
        if (hoverIndex){
            hoverIndex = undefined;
            preHoverIndex = undefined;
            me.refresh();
        }
    };

    me.onKeyDown = function(keyCode){
        var handled;
        //console.error(keyCode);
        switch (keyCode){
            case 13: // enter
                var subItem = me.getActiveSubItem();
                if (subItem){
                    if (subItem.item.subMenu && subItem.item.subMenu.isVisible() && subItem.item.subMenu.getSelectedIndex()>=0){
                        var index = subItem.item.subMenu.getSelectedIndex();
                        var item = subItem.item.subMenu.getItems()[index];
                        if (item) subItem.item.subMenu.executeItem(item);
                    }else{
                        subItem.menu.executeItem(subItem.item);
                    }
                }
                handled = true;
                break;
            case 27: // esc
                me.deActivate();
                handled = true;
                break;
            case 37:
                if (activeIndex>=0){
                    var subItem = me.getActiveSubItem();
                    if (subItem && subItem.item.subMenu && subItem.item.subMenu.isVisible()){
                        subItem.menu.deActivateSubmenu();
                    }else{
                        me.activateSubmenu(Math.max(activeIndex-1,0));
                    }
                }
                handled = true;
                break;
            case 39:
                if (activeIndex>=0){
                    var subItem = me.getActiveSubItem();
                    if (subItem && subItem.item.subMenu && !subItem.item.subMenu.isVisible()){
                        subItem.menu.activateSubmenu(subItem.item);
                    }else{
                        me.activateSubmenu(Math.min(activeIndex+1,items.length-1));
                    }
                }
                handled = true;
                break;
            case 38:
                if (activeIndex>=0){
                    var subItem = me.getActiveSubItem();
                    if (subItem && subItem.item.subMenu && subItem.item.subMenu.isVisible()){
                        subItem.item.subMenu.setSelectedIndex(subItem.item.subMenu.getSelectedIndex()-1);
                    }else{
                        var activeItem = items[activeIndex];
                        if (activeItem && activeItem.subMenu){
                            activeItem.subMenu.setSelectedIndex(activeItem.subMenu.getSelectedIndex()-1);
                        }
                    }
                }
                handled = true;
                break;
            case 40:
                if (activeIndex>=0){
                    var subItem = me.getActiveSubItem();
                    if (subItem && subItem.item.subMenu && subItem.item.subMenu.isVisible()){
                        subItem.item.subMenu.setSelectedIndex(subItem.item.subMenu.getSelectedIndex()+1);
                    }else{
                        var activeItem = items[activeIndex];
                        if (activeItem && activeItem.subMenu){
                            activeItem.subMenu.setSelectedIndex(activeItem.subMenu.getSelectedIndex()+1);
                        }
                    }
                }
                handled = true;
                break;
        }

        return handled;
    }

    me.deActivate = function(clickedItem){
        if (activeIndex>=0){
            var activeItem = items[activeIndex];
            if (activeItem && activeItem.subMenu){
                if (clickedItem && clickedItem.type === "submenu" && clickedItem.mainMenu && clickedItem.mainMenu.name === me.name){

                }else{
                    activeItem.subMenu.hide();
                    activeIndex=undefined;
                    me.refresh();
                    Input.clearFocusElement();
                }
            }
        }
    }

    me.activateSubmenu = function(index){
        if (index===activeIndex) return;
        activeIndex = index;
        items.forEach(function(item,index){
            if (index !== activeIndex && item.subMenu) item.subMenu.hide();
        })

        var selectedItem = items[index];
        if (selectedItem && selectedItem.subMenu){
            activeIndex=index;
            var xOffset = me.left;
            selectedItem.subMenu.setPosition((selectedItem.startX || 0) + xOffset,me.height);
            selectedItem.subMenu.toggle();
            selectedItem.subMenu.parent.refresh();
        }
    }

    me.getActiveSubItem = function(){
        if (activeIndex>=0){
            var activeItem = items[activeIndex];
            if (activeItem && activeItem.subMenu){
                var selectedIndex = activeItem.subMenu.getSelectedIndex();
                if (selectedIndex>=0){
                    return {
                        menu: activeItem.subMenu,
                        item: activeItem.subMenu.getItems()[selectedIndex]
                    }
                }
            }
        }
    }


    me.render = function(internal){
		if (!me.isVisible()) return;
        internal = !!internal;

        if (this.needsRendering){
            var textX = 10;
            var textY = 10;
            var fontWidth = 9;

			me.clearCanvas();
			if (background)background.render();

			if (buttons.length){
                buttons.forEach(function(button){
                    button.render();
                })
            }else if (items){
				items.forEach(function(item,index){
                    var w = item.label.length*fontWidth;
					item.startX = textX;
                    item.width = w;

					if (index === hoverIndex){
                        me.ctx.fillStyle = "rgba(179,195,243,0.1)";
                        me.ctx.fillRect(textX-(itemMargin/2),textY-10,w+20,30);
                    }
					fontMed.write(me.ctx,item.label,textX,textY);
					textX += w + itemMargin;
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
                subMenu.mainMenu = me;
                item.subMenu = subMenu;
            }
        });
        me.zIndex = 9;

        me.refresh();
    };

    me.getItems = function(){
        return items;
    };


    function getItemIndexAtPosition(x){
        if (items && items.length){
            for (var i = 0, max = items.length; i<max;i++){
                var item = items[i];
                if (x>=item.startX-(itemMargin/2) && x<=item.startX+item.width+(itemMargin/2)){
                    return i;
                }
            }
        }
        return -1;
    }

    return me;
};