UI.MainPanel = function(){
	var me = UI.panel(0,0,canvas.width,canvas.height,true);
	me.setProperties({
        backgroundColor: "#071028"
    });
	me.name = "mainPanel";

	var contextMenus = {};

    var menu = UI.app_menu(me);
    me.addChild(menu);

	var appPanel = UI.app_mainPanel();
    me.addChild(appPanel);

    var controlPanel = UI.app_controlPanel();
    me.addChild(controlPanel);

    var patternPanel = UI.app_patternPanel();
    me.addChild(patternPanel);

    var patternSidebar = UI.pattern_sidebar();
    me.addChild(patternSidebar);
    UI.patternsidebar = patternSidebar;

    var pianoPanel = UI.app_pianoView();
    pianoPanel.hide();
    me.addChild(pianoPanel);


	me.createContextMenu = function(properties){
		var contextMenu = contextMenus[properties.name];
		if (!contextMenu){
			contextMenu = UI.menu(100,100,128,42,me);
			contextMenu.zIndex = 100;
			contextMenu.setProperties({
				background: UI.Assets.panelMainScale9,
				layout: "buttons"
			});
			contextMenu.setItems(properties.items);
			contextMenu.hide();
			me.addChild(contextMenu);
			contextMenus[properties.name] = contextMenu;

        }
        return contextMenu;
	};


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
		contextMenu.setPosition(x,properties.y-contextMenu.height-2);
		contextMenu.show();
		me.refresh();
	});

	EventBus.on(EVENT.hideContextMenu,function(){
	    for (var key in contextMenus){
			contextMenus[key].hide();
        }
		me.refresh();
	});

	return me;


};

