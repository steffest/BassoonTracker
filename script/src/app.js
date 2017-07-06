var App = (function(){
    var me = {};

    me.init = function(){
        EventBus.on(EVENT.command,function(command){
            switch (command){
                case COMMAND.newFile:
                    Tracker.new();
                    break;
                case COMMAND.openFile:
                    UI.mainPanel.setView("diskop_load");
                    break;
                case COMMAND.saveFile:
                    UI.mainPanel.setView("diskop_save");
                    break;
                case COMMAND.clearTrack:
                    Tracker.clearTrack();
                    break;
                case COMMAND.clearPattern:
                    Tracker.clearPattern();
                    break;
                case COMMAND.clearInstruments:
                    Tracker.clearInstruments();
                    break;
                case COMMAND.showMain:
                    UI.mainPanel.setView("main");
                    break;
                case COMMAND.showTop:
                    UI.mainPanel.setView("resetTop");
                    break;
                case COMMAND.showOptions:
                    if (UI.mainPanel.getCurrentView() == "options"){
                        UI.mainPanel.setView("resetTop");
                    }else{
                        UI.mainPanel.setView("options");
                    }
                    break;
                case COMMAND.showFileOperations:
                    if (UI.mainPanel.getCurrentView() == "diskop_load"){
                        UI.mainPanel.setView("main");
                    }else{
                        UI.mainPanel.setView("diskop_load");
                    }
                    break;
                case COMMAND.showSampleEditor:
                    if (UI.mainPanel.getCurrentView() == "sample"){
                        UI.mainPanel.setView("resetBottom");
                    }else{
                        UI.mainPanel.setView("sample");
                    }
                    break;
                case COMMAND.togglePiano:
                    UI.mainPanel.togglePiano();
                    break;
                case COMMAND.showAbout:
                    var dialog = UI.modalDialog();
                    dialog.setProperties({
                        width: UI.mainPanel.width,
                        height: UI.mainPanel.height,
                        top: 0,
                        left: 0,
                        ok: true
                    });
                    dialog.onClick = dialog.close;

                    var version = typeof versionNumber == "undefined" ? "dev" : versionNumber;
                    var build = typeof buildNumber == "undefined" ? new Date().getTime() : buildNumber;
                    dialog.setText("Bassoontracker//Old School 4-channel Amiga mod tracker/in plain javascript//©2017 by Steffest//version " + version + "//Fork me on Github!");

                    UI.setModalElement(dialog);
                    break;
                case COMMAND.showHelp:
                    window.open("http://www.stef.be/bassoontracker/docs/");
                    break;
                case COMMAND.randomSong:
                    UI.diskOperations.playRandomSong();
                    break;
                case COMMAND.showGithub:
                    window.open("https://github.com/steffest/bassoontracker");
                    break;
            }
        });
    };

    me.doCommand = function(command){
        EventBus.trigger(EVENT.command,command);
    };

    return me;
})();