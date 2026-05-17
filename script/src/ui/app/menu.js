import Audio from "../../audio.js";
import {COMMAND, EVENT, SETTINGS} from "../../enum.js";
import App_panelContainer from "./panelContainer.js";
import Scale9Panel from "../components/scale9.js";
import Menu from "../components/menu.js";
import Vumeter from "./components/vumeter.js";
import Layout from "./layout.js";
import Label from "../components/label.js";
import Checkbox from "../components/checkbox.js";
import Y from "../yascal/yascal.js";
import StateManager from "../stateManager.js";
import Host from "../../host.js";
import Midi from "../../audio/midi.js";
import Font from "../font.js";


let app_menu = function(container){
    var me = new App_panelContainer(32);

    var menuBackground = new Scale9Panel(5,0,20,26,{
        img: Y.getImage("menu"),
        left:4,
        top:0,
        right:40,
        bottom: 0
    });
    me.addChild(menuBackground);

    var menu = new Menu(5,0,me.width,26,container);
    menu.name = "MainMenu";
    menu.type = "mainmenu";
    me.addChild(menu);
    menu.setItems([
        {label: "File" , subItems: [
                {label: "New" , "command" : COMMAND.newFile},
                {label: "Load File" , "command" : COMMAND.openFile},
                {label: "Save File" , "command" : COMMAND.saveFile},
                //{label: "Export" , "command" : COMMAND.exportFile},
                {label: "Open Random MOD Song" , "command" : COMMAND.randomSong},
                {label: "Open Random XM Song" , "command" : COMMAND.randomSongXM},
                {label: "Open Random Playlist" , "command" : COMMAND.randomPlayList},
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
                //{label: "Generator" , "command" : COMMAND.generator},
                {label: "Performance stats" , "command" : COMMAND.showStats}
            ]},
        {label: "Help", subItems: [
                {label: "About" , "command" : COMMAND.showAbout},
                {label: "Documentation" , "command" : COMMAND.showHelp},
                {label: "Sourcecode on Github" , "command" : COMMAND.showGithub}
            ]}
    ]);

    var vumeter = new Vumeter();
    vumeter.connect(Audio.cutOffVolume);
    //vumeter.connect(Audio.masterVolume);
    window.vumeter = vumeter;
    // note: don't attach as child to menu panel, this gets attached to main UI
    
    var keyLabel = new Label(0, 0, 20, 20);
    keyLabel.font = Font.small; keyLabel.label = "Key";
    keyLabel.ignoreEvents = true;
    var keyBox = new Checkbox(0,0,13,13);
    keyBox.ignoreEvents = true;
    var midiLabel = new Label(0, 0, 20, 20);
    midiLabel.font = Font.small; midiLabel.label = "Midi";
    midiLabel.ignoreEvents = true;
    var midiBox = new Checkbox(0,0,13,13);
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

        vumeter.width = vuWidth;
        vumeter.left = vuLeft;

        keyLabel.top = 4;
        keyLabel.left = me.width - 56;
        keyLabel.width = 40;
        keyLabel.height = 20;
        keyBox.top = 4;
        keyBox.left = me.width - 20;

        if (SETTINGS.showKey){
            keyLabel.show();
            keyBox.show();
        }else{
            keyLabel.hide();
            keyBox.hide();
        }

        if (SETTINGS.showMidi){
            midiLabel.top = 14;
            midiLabel.left = keyLabel.left;
            midiLabel.width = keyLabel.width;
            midiLabel.height = keyLabel.height;
            midiBox.top = 16;
            midiBox.left = keyBox.left;
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
    
    me.on(EVENT.menuLayoutChanged,function(){
        me.onPanelResize();
    });

    me.on(EVENT.pianoNoteOn,function(){
        if (SETTINGS.showKey) flash(keyBox);
    });
    me.on(EVENT.midiIn,function(){
        if (SETTINGS.showMidi) flash(midiBox);
    });


    return me;
};

export default app_menu;