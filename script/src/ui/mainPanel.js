import Panel from "./components/panel.js";
import App_menu from "./app/menu.js";
import Menu from "./components/menu.js";
import App_mainPanel from "./app/appMainPanel.js";
import App_controlPanel from "./app/controlPanel.js";
import App_patternPanel from "./app/patternPanel.js";
import Pattern_sidebar from "./app/components/patternSidebar.js";
import App_pianoView from "./app/pianoView.js";
import Layout from "../ui/app/layout.js";
import EventBus from "../eventBus.js";
import {EVENT} from "../enum.js";
import UI from "./ui.js";
import Assets from "./assets.js";
import Input from "./input.js";

let MainPanel = function(){
    let canvas = UI.getCanvas();
    var me = Panel(0,0,canvas.width,canvas.height,true);
	me.setProperties({
        backgroundColor: "#071028"
    });
	me.name = "mainPanel";

	var contextMenus = {};
    var isContextMenuVisible = false;

    var menu = App_menu(me);
    me.addChild(menu);

	var appPanel = App_mainPanel();
    me.addChild(appPanel);

    var controlPanel = App_controlPanel();
    me.addChild(controlPanel);

    var patternPanel = App_patternPanel();
    me.addChild(patternPanel);

    var patternSidebar = Pattern_sidebar();
    me.addChild(patternSidebar);
    UI.patternsidebar = patternSidebar;

    var pianoPanel = App_pianoView();
    pianoPanel.hide();
    me.addChild(pianoPanel);

    if (UI.visualiser){
        me.addChild(UI.visualiser);
    }

	me.createContextMenu = function(properties){
		var contextMenu = contextMenus[properties.name];
		if (!contextMenu){
            let w  = properties.width || 128;
            let h = 42;
            if (properties.layout === "list"){
                h = properties.items.length*23;
            }
            if (properties.title) h+= 20;
			contextMenu = Menu(100,100,w,h,me);
            contextMenu.name = properties.name;
			contextMenu.zIndex = 100;
			contextMenu.setProperties({
				background: Assets.panelMainScale9,
				layout: properties.layout || "buttons",
                type: "context",
                controlParent: properties.parent,
                title: properties.title
			});
			contextMenu.setItems(properties.items);
			contextMenu.hide();
			me.addChild(contextMenu);
			contextMenus[properties.name] = contextMenu;

        }
        return contextMenu;
	};

    me.hasFloatingElements = function(){
        return isContextMenuVisible;
    }

    me.onResize = function(){
        Layout.setLayout(me.width,me.height);

        menu.setSize(Layout.mainWidth,menu.height);
        var panelTop = menu.height;

        appPanel.setSize(Layout.mainWidth,appPanel.height);
        appPanel.setPosition(Layout.mainLeft,panelTop);
        panelTop += appPanel.height;



        controlPanel.setSize(Layout.mainWidth,Layout.controlPanelHeight);
        controlPanel.setPosition(Layout.mainLeft,panelTop);
        panelTop += controlPanel.height;



        var remaining = me.height-panelTop;
        if (pianoPanel.isVisible()){
            pianoPanel.setSize(Layout.mainWidth,Layout.pianoHeight);
            pianoPanel.setPosition(Layout.mainLeft,me.height-pianoPanel.height);
            remaining = remaining- pianoPanel.height;
        }

        patternPanel.setPosition(Layout.mainLeft,panelTop);
        patternPanel.setSize(Layout.mainWidth,remaining);



        if (Layout.showSideBar){
            patternSidebar.show();
            patternSidebar.setDimensions({
                left: Layout.col1X,
                top : panelTop + Layout.infoPanelHeight + Layout.analyserHeight,
                width: Layout.col1W,
                height: remaining - Layout.infoPanelHeight - Layout.analyserHeight - Layout.defaultMargin
            });
        }else{
            patternSidebar.setDimensions({
                left: Layout.col32X,
                top : appPanel.top,
                width: Layout.col32W,
                height: appPanel.height
            });
            setMobileSideBar();
        }


	};

    me.sortZIndex();
    me.onResize();

    function setMobileSideBar(){
        if (appPanel.getCurrentView() === "" && appPanel.getCurrentSubView() === "playlist"){
            patternSidebar.show();
        }else{
            patternSidebar.hide();
        }
    }

    EventBus.on(EVENT.toggleView,function(view){
        if (view === "piano"){
            pianoPanel.toggle();
            var remaining = me.height - patternPanel.top;
            if (pianoPanel.isVisible()){
                pianoPanel.setSize(Layout.mainWidth,Layout.pianoHeight);
                pianoPanel.setPosition(Layout.mainLeft,me.height-pianoPanel.height);
                remaining = remaining-pianoPanel.height;
            }
            patternPanel.setSize(Layout.mainWidth,remaining);
            if (Layout.showSideBar) patternSidebar.setSize(Layout.col1W,remaining - Layout.infoPanelHeight - Layout.analyserHeight - Layout.defaultMargin);
        }
    });

    EventBus.on(EVENT.showView,function(view){
        console.error("MainPanel.showView",view);
        if (Layout.showSideBar){
            switch (view){
                case "sample":
                    patternSidebar.hide();
                    break;
                case "bottommain":
                case "main":
                    patternSidebar.show();
                    break;
            }
        }else{
            setMobileSideBar();
        }
    });

	EventBus.on(EVENT.showContextMenu,function(properties){
        var contextMenu = me.createContextMenu(properties);
		var x = properties.x;
		if ((x+contextMenu.width)>Layout.mainWidth) x = Layout.mainWidth-contextMenu.width;
		if (properties.align === "top"){
            contextMenu.setPosition(x,properties.y-contextMenu.height-2);
        }else{
            contextMenu.setPosition(x,properties.y);
        }
		contextMenu.show();
        isContextMenuVisible = true;
        if (properties.focus){
            Input.setFocusElement(contextMenu);
        }
		me.refresh();
	});

	EventBus.on(EVENT.hideContextMenu,function(){
	    for (var key in contextMenus){
			contextMenus[key].hide();
        }
        isContextMenuVisible = false;
		me.refresh();
	});


	return me;

};

export default MainPanel;

