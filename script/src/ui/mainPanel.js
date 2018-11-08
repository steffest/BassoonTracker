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

        menu.setSize(me.width,menu.height);
        var panelTop = menu.height;

        appPanel.setSize(me.width,appPanel.height);
        appPanel.setPosition(0,panelTop);
        panelTop += appPanel.height;

        controlPanel.setSize(me.width,Layout.controlPanelHeight);
        controlPanel.setPosition(0,panelTop);
        panelTop += controlPanel.height;

        var remaining = me.height-panelTop;
        if (pianoPanel.isVisible()){
            pianoPanel.setSize(me.width,Layout.pianoHeight);
            pianoPanel.setPosition(0,me.height-pianoPanel.height);
            remaining = remaining- pianoPanel.height;
        }

        patternPanel.setPosition(0,panelTop);
        patternPanel.setSize(me.width,remaining);

	};

    me.sortZIndex();
    me.onResize();

    EventBus.on(EVENT.toggleView,function(view){
        if (view === "piano"){
            pianoPanel.toggle();
            var remaining = me.height - patternPanel.top;
            if (pianoPanel.isVisible()){
                pianoPanel.setSize(me.width,Layout.pianoHeight);
                pianoPanel.setPosition(0,me.height-pianoPanel.height);
                remaining = remaining-pianoPanel.height;
            }
            patternPanel.setSize(me.width,remaining);
        }
    });

	EventBus.on(EVENT.showContextMenu,function(properties){
	    var contextMenu = me.createContextMenu(properties);
		var x = properties.x;
		if ((x+contextMenu.width)>me.width) x = me.width-contextMenu.width;
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

