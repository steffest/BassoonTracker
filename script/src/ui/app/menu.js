UI.app_menu = function(container){
    var me = UI.app_panelContainer(32);

    var menuBackground = UI.scale9Panel(5,0,20,26,{
        img: Y.getImage("menu"),
        left:4,
        top:0,
        right:40,
        bottom: 0
    });
    me.addChild(menuBackground);

    var menu = UI.menu(5,0,me.width,26,container);
    me.addChild(menu);
    menu.setItems([
        {label: "File" , subItems: [
                {label: "New" , "command" : COMMAND.newFile},
                {label: "Load Module" , "command" : COMMAND.openFile},
                {label: "Save Module" , "command" : COMMAND.saveFile},
                {label: "Open Random Song" , "command" : COMMAND.randomSong}
            ]},
        {label: "Edit", subItems: [
                {label: "Clear Track" , "command" : COMMAND.clearTrack},
                {label: "Clear Pattern" , "command" : COMMAND.clearPattern},
                {label: "Clear Song" , "command" : COMMAND.clearSong},
                {label: "Clear Instruments" , "command" : COMMAND.clearInstruments}
            ]},
        {label: "View", subItems: [
                {label: "Main" , "command" : COMMAND.showMain},
                {label: "Options" , "command" : COMMAND.showOptions},
                {label: "File Operations" , "command" : COMMAND.showFileOperations},
                {label: "Sample Editor" , "command" : COMMAND.showSampleEditor},
                {label: "Piano" , "command" : COMMAND.togglePiano}
            ]},
        {label: "Help", subItems: [
                {label: "About" , "command" : COMMAND.showAbout},
                {label: "Documentation" , "command" : COMMAND.showHelp},
                {label: "Sourcecode on Github" , "command" : COMMAND.showGithub}
            ]}
    ]);


    var vumeter = UI.vumeter();
    vumeter.connect(Audio.cutOffVolume);
    //vumeter.connect(Audio.masterVolume);
    window.vumeter = vumeter;
    // note: don't attach as child to main panel, this gets attached to main UI

    me.onPanelResize = function(){
        var menuMin = 250;
        var menuWidth = Math.max(Layout.col2W,menuMin);
        var vuWidth = Layout.col5W - menuWidth;
        var vuLeft = Layout.marginLeft + menuWidth + Layout.defaultMargin;

        menuBackground.setDimensions({
            left: Layout.marginLeft,
            top: 0,
            height: 26,
            width: menuWidth
        });

        vumeter.setProperties({
            width: vuWidth,
            left: vuLeft
        });
    };

    me.onPanelResize();



    return me;
};