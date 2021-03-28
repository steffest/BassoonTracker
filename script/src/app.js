var App = (function(){
    var me = {};
    
    me.buildNumber = (typeof buildNumber === "undefined") ? "" : buildNumber; 
    
    me.init = function(){
    	
		if (typeof Midi === "object" && SETTINGS && SETTINGS.midi && SETTINGS.midi!=="disabled") Midi.init();
    	
        EventBus.on(EVENT.command,function(command){
            window.focus();
            
            switch (command){
                case COMMAND.newFile:
                    Tracker.new();
                    break;
                case COMMAND.openFile:
                    EventBus.trigger(EVENT.showView,"diskop_modules_load");
                    break;
                case COMMAND.saveFile:
                    EventBus.trigger(EVENT.showView,"diskop_modules_save");
                    break;
                case COMMAND.clearTrack:
                    Editor.clearTrack();
                    break;
                case COMMAND.clearPattern:
					Editor.clearPattern();
                    break;
                case COMMAND.clearInstruments:
                    Tracker.clearInstruments();
                    break;
				case COMMAND.clearSong:
					Editor.clearSong();
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
				case COMMAND.toggleAppSideBar:
					EventBus.trigger(EVENT.toggleView,"sidebar");
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

                    var version = Host.getVersionNumber();
                    var build = Host.getBuildNumber();
                    dialog.setText("BassoonTracker//Old School Amiga MOD and XM tracker/in plain javascript//©2017-2021 by Steffest//version " + version + "//Fork me on Github!");

                    UI.setModalElement(dialog);
                    break;
                case COMMAND.showHelp:
                    window.open("https://www.stef.be/bassoontracker/docs/");
                    break;
                case COMMAND.randomSong:
                    UI.diskOperations.playRandomSong();
                    break;
                case COMMAND.randomSongXM:
                    UI.diskOperations.playRandomSong("xm");
                    break;
                case COMMAND.showGithub:
                    window.open("https://github.com/steffest/bassoontracker");
                    break;
				case COMMAND.showStats:
				    var stats = document.getElementById("MrDStats");
				    if (!stats){
						var script=document.createElement('script');
						script.onload=function(){
							var stats=new Stats();
							document.body.appendChild(stats.dom);
							requestAnimationFrame(function loop(){
								stats.update();
								requestAnimationFrame(loop)
							});
						};
						script.src='script/plugins/stats.js';
						document.head.appendChild(script);
						break;
                    }
					break;
				case COMMAND.cut:
					UI.cutSelection(true);
					break;
				case COMMAND.copy:
					UI.copySelection(true);
					break;
				case COMMAND.paste:
					UI.pasteSelection(true);
					break;
				case COMMAND.pattern2Sample:
					Editor.renderTrackToBuffer();
					break;
                case COMMAND.undo:
                    EventBus.trigger(EVENT.commandUndo);
                    break;
                case COMMAND.redo:
                    EventBus.trigger(EVENT.commandRedo);
                    break;
				case COMMAND.nibbles:
					Plugin.load("Nibbles",function(){
						Nibbles.init({
                            UI:UI,
                            Input: Input,
                            Y: Y,
                            EventBus: EventBus,
                            EVENT: EVENT,
                            COMMAND: COMMAND,
                            Layout: Layout
                        });
					});
					break;
            }
        });
    };

    me.doCommand = function(command){
        EventBus.trigger(EVENT.command,command);
    };

    return me;
})();