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
    menu.name = "MainMenu";
    me.addChild(menu);
    menu.setItems([
        {label: "File" , subItems: [
                {label: "New" , "command" : COMMAND.newFile},
                {label: "Load Module" , "command" : COMMAND.openFile},
                {label: "Save Module" , "command" : COMMAND.saveFile},
                {label: "Open Random MOD Song" , "command" : COMMAND.randomSong},
                {label: "Open Random XM Song" , "command" : COMMAND.randomSongXM}
            ]},
        {label: "Edit", subItems: [
                {label: function(){return StateManager.getUndoLabel()} , "command" : COMMAND.undo, disabled: function(){return !StateManager.canUndo()}},
                {label: function(){return StateManager.getRedoLabel()} , "command" : COMMAND.redo, disabled: function(){return !StateManager.canRedo()}},
				{label: "Cut" , "command" : COMMAND.cut},
				{label: "Copy" , "command" : COMMAND.copy},
				{label: "Clear" , subItems: [
                        {label: "Clear Track" , "command" : COMMAND.clearTrack},
                        {label: "Clear Pattern" , "command" : COMMAND.clearPattern},
                        {label: "Clear Song" , "command" : COMMAND.clearSong},
                        {label: "Clear Instruments" , "command" : COMMAND.clearInstruments},
                    ]},
				{label: "Paste" , "command" : COMMAND.paste},

                {label: "Render Pattern 2 Sample" , "command" : COMMAND.pattern2Sample}
            ]},
        {label: "View", subItems: [
                {label: "Main" , "command" : COMMAND.showMain},
                {label: "Options" , "command" : COMMAND.showOptions},
                {label: "File Operations" , "command" : COMMAND.showFileOperations},
                {label: "Sample Editor" , "command" : COMMAND.showSampleEditor},
                {label: "Piano" , "command" : COMMAND.togglePiano},
                {label: "Nibbles" , "command" : COMMAND.nibbles},
                {label: "Performance stats" , "command" : COMMAND.showStats}
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
    // note: don't attach as child to menu panel, this gets attached to main UI
    
    var keyLabel = UI.label({font: fontSmall, label: "Key"});
    keyLabel.ignoreEvents = true;
    var keyBox = UI.checkbox(0,0,13,13);
    keyBox.ignoreEvents = true;
    var midiLabel = UI.label({font: fontSmall, label: "Midi"});
    midiLabel.ignoreEvents = true;
    var midiBox = UI.checkbox(0,0,13,13);
    midiBox.ignoreEvents = true;
    
    me.addChild(keyLabel);
    me.addChild(keyBox);
    me.addChild(midiLabel);
    me.addChild(midiBox);
    
    me.onPanelResize = function(){
        var menuMin = 250;
        var menuWidth = Math.max(Layout.col2W,menuMin);
        
        if (!Host.showInternalMenu){
            menuBackground.hide();
            menuWidth = 0;
        }

        var vuWidth = Layout.col5W - menuWidth;
        if (SETTINGS.showKey || SETTINGS.showMidi){
            vuWidth -= 50;
        }
        var vuLeft = Layout.marginLeft + menuWidth + Layout.defaultMargin + Layout.mainLeft;

		me.left = Layout.mainLeft;

        if (menuWidth) menuBackground.setDimensions({
            left: Layout.marginLeft,
            top: 0,
            height: 26,
            width: menuWidth
        });

        vumeter.setProperties({
            width: vuWidth,
            left: vuLeft
        });

        keyLabel.setProperties({
            top: 4,
            left: me.width - 56,
            width: 40,
            height: 20
        });
        keyBox.setProperties({
            top: 4,
            left: me.width - 20
        });
        
        if (SETTINGS.showKey){
            keyLabel.show();
            keyBox.show();
        }else{
            keyLabel.hide();
            keyBox.hide();
        }

        if (SETTINGS.showMidi){
            midiLabel.setProperties({
                top: 14,
                left: keyLabel.left,
                width: keyLabel.width,
                height: keyLabel.height
            });
            midiBox.setProperties({
                top: 16,
                left: keyBox.left,
            });
            midiLabel.show();
            midiBox.show();
        }else{
            midiLabel.hide();
            midiBox.hide();
        }
        
    };


    me.renderInternal = function(){
        if (SETTINGS.showMidi && !Midi.isEnabled()){
            me.ctx.fillStyle = "rgba(34, 49, 85, 0.5)";
            me.ctx.fillRect(midiLabel.left,midiBox.top,50,midiBox.height);
        }
    }
    
    
    
    me.onPanelResize();
    
    
    function flash(elm){
        elm.setState(true);
        clearTimeout(elm.timeout);
        elm.timeout = setTimeout(function(){
            elm.setState(false);
        },100);
    }
    
    EventBus.on(EVENT.menuLayoutChanged,function(){
        me.onPanelResize();
    });

    EventBus.on(EVENT.pianoNoteOn,function(){
        if (SETTINGS.showKey) flash(keyBox);
    });
    EventBus.on(EVENT.midiIn,function(){
        if (SETTINGS.showMidi) flash(midiBox);
    });
    

   


    return me;
};