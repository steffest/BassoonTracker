import EventBus from "./eventBus.js";
import {COMMAND, EVENT, SETTINGS} from "./enum.js";
import UI from "./ui/ui.js";
import Host from "./host.js";
import Editor from "./editor.js";
import Tracker from "./tracker.js";
import Playlist from "./models/playlist.js";
import ModalDialog from "./ui/components/modalDialog.js";
import Midi from "./audio/midi.js";
import Y from "./ui/yascal/yascal.js";
import Plugin from "../plugins/loader.js";
import Input from "./ui/input.js";
import Layout from "./ui/app/layout.js";
import UIElement from "./ui/components/element.js";
import UIImage from "./ui/components/image.js";
import Scale9Panel from "./ui/components/scale9.js";
import Assets from "./ui/assets.js";
import Label from "./ui/components/label.js";
import Button from "./ui/components/button.js";
import RadioGroup from "./ui/components/radiogroup.js";
import Checkbox from "./ui/components/checkbox.js";
import Panel from "./ui/components/panel.js";

var App = (function(){
    var me = {};
    
    me.buildNumber = (typeof window.buildNumber === "undefined") ? "" : window.buildNumber;
    
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
                case COMMAND.toggleSideBar:
                    console.log("toggle sidebar");
                    Layout.hasSideBar = !Layout.hasSideBar;
                    EventBus.trigger(EVENT.appLayoutChanged);
                    EventBus.trigger(EVENT.toggleView,"main");
                    break;
                case COMMAND.showAbout:
                    var dialog = ModalDialog();
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
                    dialog.setText("*BassoonTracker//Old School Amiga MOD and XM tracker/in plain javascript//©2017-2024 by Steffest//version " + version + "//Fork me on Github!");

                    UI.setModalElement(dialog);
                    break;
                case COMMAND.showHelp:
                    window.open("https://www.stef.be/bassoontracker/docs/");
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
                    EventBus.trigger(EVENT.showView,"main");
					Plugin.load("Nibbles",function(){
						Nibbles.init({
                            UI:{
                                element: UIElement,
                                image: UIImage,
                                Assets: Assets,
                                scale9Panel: Scale9Panel,
                                label: Label,
                                button: Button,
                                radioGroup: RadioGroup,
                                checkbox: Checkbox,
                                panel: Panel
                            },
                            Input: Input,
                            Y: Y,
                            EventBus: EventBus,
                            EVENT: EVENT,
                            COMMAND: COMMAND,
                            Layout: Layout
                        });
					});
					break;
                case COMMAND.generator:
                    Plugin.load("Generator",function(){
                        Generator.init({
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
                case COMMAND.play:
                    Tracker.togglePlay();
                    break;
                case COMMAND.playNext:
                    Playlist.next();
                    break;
                case COMMAND.playPrevious:
                    Playlist.prev();
                    break;
                case COMMAND.toggleShuffle:
                    Playlist.toggleShuffle();
                    break;
                default:
                    EventBus.trigger(command);
                    break;
            }
        });
    };

    me.doCommand = function(command){
        EventBus.trigger(EVENT.command,command);
    };

    return me;
})();

export default App;