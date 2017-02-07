var App = (function(){
    var me = {};

    me.init = function(){
        EventBus.on(EVENT.command,function(event,command){
            switch (command){
                case COMMAND.newFile:
                    break;
                case COMMAND.openFile:
                    UI.mainPanel.setView("diskop");
                    break;
                case COMMAND.saveFile:
                    UI.mainPanel.setView("diskop");
                    break;
                case COMMAND.clearTrack:
                    Tracker.clearTrack();
                    break;
                case COMMAND.clearPattern:
                    Tracker.clearPattern();
                    break;
                case COMMAND.showMain:
                    UI.mainPanel.setView("main");
                    break;
                case COMMAND.showOptions:
                    if (UI.mainPanel.getCurrentView() == "options"){
                        UI.mainPanel.setView("main");
                    }else{
                        UI.mainPanel.setView("options");
                    }
                    break;
                case COMMAND.showFileOperations:
                    if (UI.mainPanel.getCurrentView() == "diskop"){
                        UI.mainPanel.setView("main");
                    }else{
                        UI.mainPanel.setView("diskop");
                    }
                    break;
                case COMMAND.showSampleEditor:
                    if (UI.mainPanel.getCurrentView() == "sample"){
                        UI.mainPanel.setView("main");
                    }else{
                        UI.mainPanel.setView("sample");
                    }
                    break;
                case COMMAND.togglePiano:
                    UI.mainPanel.togglePiano();
                    break;
                case COMMAND.showAbout:
                    window.open("http://www.stef.be/bassoontracker/docs/");
                    break;
                case COMMAND.showHelp:
                    window.open("http://www.stef.be/bassoontracker/docs/");
                    break;
            }
        });
    };

    me.doCommand = function(command){
        EventBus.trigger(EVENT.command,command);
    };

    return me;
})();