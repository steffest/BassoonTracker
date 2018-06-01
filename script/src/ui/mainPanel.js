UI.MainPanel = function(){
	var me = UI.panel(0,0,canvas.width,canvas.height,true);
	me.setProperties({
        backgroundColor: "#071028"
    });
	me.name = "mainPanel";

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

	return me;


};

