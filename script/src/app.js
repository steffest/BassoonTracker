var App = (function(){
    var me = {};

    me.init = function(){
        EventBus.on(EVENT.command,function(command){
            switch (command){
                case COMMAND.newFile:
                    Tracker.new();
                    break;
                case COMMAND.openFile:
                    EventBus.trigger(EVENT.showView,"diskop_load");
                    break;
                case COMMAND.saveFile:
                    EventBus.trigger(EVENT.showView,"diskop_save");
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
                    EventBus.trigger(EVENT.showView,"main");
                    break;
                case COMMAND.showTopMain:
                    EventBus.trigger(EVENT.showView,"topmain");
                    break;
                case COMMAND.showBottomMain:
                    EventBus.trigger(EVENT.showView,"bottommain");
                    break;
                case COMMAND.showOptions:
                    EventBus.trigger(EVENT.showView,"options");
                    break;
                case COMMAND.showFileOperations:
                    EventBus.trigger(EVENT.showView,"diskop_load");
                    break;
                case COMMAND.showSampleEditor:
                    EventBus.trigger(EVENT.showView,"sample");
                    break;
                case COMMAND.togglePiano:
                    EventBus.trigger(EVENT.toggleView,"piano");
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
                    dialog.setText("BASSOONTRACKER//Old School 4-channel Amiga mod tracker/in plain javascript//©2017-2018 by Steffest//version " + version + "//Fork me on Github!");

                    UI.setModalElement(dialog);
                    break;
                case COMMAND.showHelp:
                    window.open("https://www.stef.be/bassoontracker/docs/");
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