var HostBridge = function(){
    var me = {};

    //Use Amibase Dropbox handler instead of our own
    me.useDropbox = false;

    //Amibase has its own Menu system
    me.showInternalMenu = false;

    me.init = function(){

        AmiBase.init(function(success) {
            console.log("Amibased: " + success);

            if (success){
                AmiBase.setMessageHandler(function(message){
                    console.error(message);
                    var command = message.message;
                    if (!command) return;
                    if (command.indexOf("bsn_")>=0) command=command.replace("bsn_","");

                    switch(command){
                        case 'setMessageHandler':
                            break;
                        case 'loadFile':
                            break;
                        case 'openfile':
                        case 'dropfile':
                            Host.useInitialLoad = false;
                            var buffer = message.data.data;
                            var fileName = message.data.filename || "file";
                            console.log("opening file",fileName);
                            Tracker.processFile(buffer,fileName,function(isMod){
                                if (UI) UI.setStatus("Ready");
                            });
                            AmiBase.focus();
                            break;
                        case 'getFileName':
                            var filename = Tracker.getFileName();
                            break;
                        case 'saveFile':
                            break;
                        default:
                            var command = COMMAND[command];
                            if (command){
                                App.doCommand(command);
                            }else{
                                console.warn("Unhandled message: " + command);
                            }
                    }
                });

                AmiBase.setMenu([
                    {
                        label: 'Bassoon Tracker',
                        items: [
                            {
                                label: 'About',
                                message: 'bsn_showAbout'
                            }
                        ]
                    },
                    {
                        label: 'File',
                        items: [
                            {
                                label: 'New',
                                message: 'bsn_newFile'
                            },
                            {
                                label: 'Load Module',
                                message: 'loadmodule'
                            },
                            {
                                label: 'Save Module',
                                message: 'savemodule'
                            },
                            {
                                label: 'Open Random Mod',
                                message: 'bsn_randomSong'
                            },
                            {
                                label: 'Open Random XM',
                                message: 'bsn_randomSongXM'
                            }
                        ]
                    },
                    {
                        label: 'Edit',
                        items: [
                            {
                                label: 'Cut',
                                message: 'bsn_ut'
                            },
                            {
                                label: 'Copy',
                                message: 'bsn_copy'
                            },
                            {
                                label: 'Paste',
                                message: 'bsn_paste'
                            },
                            {
                                label: 'Clear',
                                items: [
                                    {
                                        label: 'Track',
                                        message: 'bsn_clearTrack'
                                    },
                                    {
                                        label: 'Pattern',
                                        message: 'bsn_clearPattern'
                                    },
                                    {
                                        label: 'Song',
                                        message: 'bsn_clearSong'
                                    },
                                    {
                                        label: 'Instruments',
                                        message: 'bsn_clearInstruments'
                                    }
                                ]
                            },
                            {
                                label: 'Render Pattner 2 sample',
                                message: 'bsn_pattern2Sample'
                            },

                        ]
                    },
                    {
                        label: 'View',
                        items: [
                            {
                                label: 'Main',
                                message: 'bsn_showMain'
                            },
                            {
                                label: 'Options',
                                message: 'bsn_showOptions'
                            },
                            {
                                label: 'File Operations',
                                message: 'bsn_showFileOperations'
                            },
                            {
                                label: 'Sample Editor',
                                message: 'bsn_showSampleEditor'
                            },
                            {
                                label: 'Piano',
                                message: 'bsn_togglePiano'
                            }
                        ]
                    },
                    {
                        label: 'Help',
                        items: [
                            {
                                label: 'About',
                                message: 'bsn_showAbout'
                            },
                            {
                                label: 'Documentation',
                                message: 'bsn_showHelp'
                            },
                            {
                                label: 'Sourcecode on Github',
                                message: 'bsn_showGithub'
                            }
                        ]
                    }
                ])

            }
        });

       /* Application.receiveMessage = function(msg){
            if (msg.type === 'bassoontracker'){
                console.log("got message",msg);

                // bloody annoying, right, that Friend keeps stealing focus?
                window.focus();
                switch(msg.command){
                    case 'setMessageHandler':
                        friendCallBackId = msg.callbackId;
                        break;
                    case 'loadFile':
                        var file = msg.files[0];
                        if (file && file.Path){
                            var url = "/system.library/file/read?sessionid=" + Application.sessionId + "&path=" + file.Path + "&mode=rs";
                            Tracker.load(url,false,function(){

                            });
                        }
                        break;
                    case 'getFileName':
                        var filename = Tracker.getFileName();
                        if (msg.callbackId){
                            console.warn("setting callback");
                            me.sendMessage({
                                callbackId: msg.callbackId,
                                command: "message",
                                message: filename
                            });
                        }
                        break;
                    case 'saveFile':
                        var filename = msg.files.split("/").pop();
                        Editor.save(filename,function(blob){
                            UI.setStatus("Saving File to FriendOS",true);
                            console.log("Saving File to FriendOS",msg.files);
                            var url = "/system.library/file/upload/?sessionid=" + Application.sessionId + "&path=" + msg.files;

                            var formData = new FormData();
                            formData.append("file",blob,"");
                            FetchService.sendBinary(url,formData,function(data){
                                UI.setStatus(""); 
                                console.log("result from upload: " + data)
                            });
                        });
                        break;
                    default:
                        var command = COMMAND[msg.command];
                        if (command){
                            App.doCommand(command);
                        }else{
                            console.warn("Unhandled message: " + msg);
                        }
                }
            }
        };
        */
	    
    };

    me.signalReady = function(){
        AmiBase.iAmReady();
    };
    
    me.sendMessage = function(msg){

    };

    
    return me;
}();