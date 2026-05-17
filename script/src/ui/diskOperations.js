import Panel from "./components/panel.js";
import DiskOperationActions from "./diskOp_Actions.js";
import DiskOperationType from "./diskOp_Type.js";
import DiskOperationTargets from "./diskOp_Targets.js";
import DiskOperationSave from "./diskOp_Save.js";
import Listbox from "./components/listbox.js";
import Scale9Panel from "./components/scale9.js";
import Assets from "./assets.js";
import Button from "./components/button.js";
import Label from "./components/label.js";
import Y from "./yascal/yascal.js";
import EventBus from "../eventBus.js";
import {COMMAND, EVENT, FILETYPE} from "../enum.js";
import Tracker from "../tracker.js";
import UI from "./ui.js";
import FetchService from "../fetchService.js";
import Host from "../host.js";
import Layout from "./app/layout.js";
import Dropbox from "../provider/dropbox.js";
import Playlist from "../models/playlist.js";
import App from "../app.js";
import ModArchive from "../provider/modarchive.js";
import ModulesPl from "../provider/modulespl.js";
import Hippo from "../provider/hippo.js";
import Editor from "../editor.js";
import Font from "./font.js";

let DiskOperations = function(){

	var me = new Panel(0,0,20,20);
	me.hide();

	var currentAction = "load";
	var currentView = "modules";
	var currentsSubView = "";
	var itemsMap = [];

	var modules = [];
	var samples = [];
	var playlists = [];
	var modArchive = [];
	var modulesPl = [];
	var dropBoxList = [];
	var playlistSelectedIndex = 0;
	var sampleSelectedIndex = 0;
	var moduleSelectedIndex = 0;
	var onLoadChildren = function(){};
	var itemHandler;

	var background = new Scale9Panel(0,0,20,20,Assets.panelMainScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var actionPanel = DiskOperationActions();
	me.addChild(actionPanel);

	var typePanel = DiskOperationType();
	me.addChild(typePanel);

	var targetPanel = DiskOperationTargets();
	me.addChild(targetPanel);

	var savePanel = DiskOperationSave();
	me.addChild(savePanel);



	// buttons for small screen UI
    var buttonProperties = {
        background: Assets.buttonKeyScale9,
        activeBackground:Assets.buttonKeyActiveScale9,
        isActive:false,
        textAlign: "center",
        font: Font.dark,
        paddingTopActive: 1,
		height: 18,
		width: 50
    };

    var saveButton = new Button();
    var loadButton = new Button();
    loadButton.setActive(true);

	Object.assign(saveButton, buttonProperties);
	saveButton.label = "Save";
    saveButton.onDown = function(){
        actionPanel.setSelectedIndex(1);
    };
    me.addChild(saveButton);

	Object.assign(loadButton, buttonProperties);
	loadButton.label = "Load";
    loadButton.onDown = function(){
        actionPanel.setSelectedIndex(0);
    };
    me.addChild(loadButton);
    

	var label = new Label(0, 0, 20, 20);
	label.label = "Load module";
	label.font = Font.med;
	me.addChild(label);

	var closeButton = Assets.generate("button20_20");
	closeButton.label = "x";
	closeButton.onClick = function(){
        App.doCommand(COMMAND.showTopMain);
	};
	me.addChild(closeButton);
	
	var browseButton = Assets.generate("buttonKey");
	browseButton.label = "browse";
	browseButton.onClick = function(){
		var input = document.createElement('input');
		input.type = 'file';
		input.onchange = function(e){
			Tracker.handleUpload(e.target.files);
		};
		input.click();
	};
	me.addChild(browseButton);
	browseButton.hide();

	var listbox = new Listbox();
	me.addChild(listbox);


	var dropzone = new Button();
	dropzone.background = Assets.buttonDarkActiveScale9;
	dropzone.image = Y.getImage("dropzone");
	dropzone.font = Font.small;
	dropzone.textAlign = "center";
	dropzone.onClick = browseButton.onClick;
	me.addChild(dropzone);
	dropzone.hide();


    me.onShow = function(){
        me.onResize();
    };

	me.onResize = function(){
		if(me.isVisible()){
            me.clearCanvas();

			background.left = 0;
			background.top = 0;
			background.height = me.height;
			background.width = me.width;

            var startTop = 5;

			closeButton.top = startTop-2;
			closeButton.width = 20;
			closeButton.heigth = 18;
			closeButton.left = me.width - 30;

			browseButton.top = closeButton.top+2;
			browseButton.width = 55;
			browseButton.height = 18;
			browseButton.left = closeButton.left - 60;

			
            if (me.width >= 730){

                actionPanel.show();
                label.show();
                loadButton.hide();
                saveButton.hide();

												actionPanel.top = startTop;
												actionPanel.left = Layout.col1X;
												actionPanel.width = Layout.col1W;
												actionPanel.height = me.height - 10;
												typePanel.top = startTop;
												typePanel.left = Layout.col2X;
												typePanel.width = Layout.col1W;
												typePanel.height = me.height - 10;
												targetPanel.top = startTop;
												targetPanel.left = Layout.col3X;
												targetPanel.width = Layout.col1W;
												targetPanel.height = me.height - 10;

				label.left = Layout.col4X;
				label.top = startTop;
				label.height = 20;
				label.width = Layout.col2W;


				listbox.left = Layout.col4X;
				listbox.width = Layout.col2W;
				listbox.top = startTop + 19;
				listbox.height = me.height - (19+startTop) - 5;

            }else{

            	actionPanel.hide();
                label.hide();
                loadButton.show();
                saveButton.show();

				loadButton.top = 5;
				loadButton.left = Layout.col3X;
				saveButton.top = 5;
				saveButton.left = Layout.col3X + 50;

				typePanel.top = startTop;
				typePanel.left = Layout.defaultMargin;
				typePanel.width = Layout.col2W;
				typePanel.height = (me.height / 2) - startTop - 16;

				targetPanel.top = me.height / 2 - 16;
				targetPanel.left = Layout.defaultMargin;
				targetPanel.width = Layout.col2W;
				targetPanel.height = me.height / 2 + 16;

				listbox.left = Layout.col3X;
				listbox.width = Layout.col3W;
				listbox.top = startTop + 19;
				listbox.height = me.height - (19+startTop) - 5;

            }

            if (currentAction === "save"){

				savePanel.left = listbox.left;
				savePanel.width = listbox.width;
				savePanel.top = listbox.top;
				savePanel.height = listbox.height;

                listbox.hide();
                savePanel.show();
            }else{
                listbox.show();
                savePanel.hide();
            }


			dropzone.left = listbox.left;
			dropzone.width = listbox.width;
			dropzone.top = listbox.top;
			dropzone.height = listbox.height;
		}
	};

	me.setView = function(subView){
        currentsSubView = subView;
        me.refreshList(currentsSubView === "samples" ? "samples" : "");

        if (subView.indexOf("_save")>0){
        	actionPanel.setSelectedIndex(1);
		}
		if (subView.indexOf("_load")>0){
            actionPanel.setSelectedIndex(0);
        }

		if (subView.indexOf("_samples")>0){
			typePanel.setType(1);
		}
		if (subView.indexOf("_modules")>0){
			typePanel.setType(0);
		}
	};

	me.refreshList = function(type){

		if (currentAction === "save") return;

		var items = [];
		var index = 0;

		if (currentView !== type) listbox.setSelectedIndex(0,true);
		currentView = type || currentView;

		function addListatLevel(data,level){
			data.forEach(function(item){
                var icon;
                if (item.icon) icon = Y.getImage(item.icon);
				if (!icon) icon = currentView === "modules" ? Y.getImage("module") : Y.getImage("sample");
				if (currentView === "playlists"){
					icon = Y.getImage(item.iconsmall||"playlist");
				}
				if (item.children) icon = Y.getImage("disk");
				items.push({label: item.title, data: item, level: level, index: index, icon: icon, info: item.info});
				itemsMap[index] = item;
				index++;

				if (item.children && item.children.length && item.isExpanded){
					addListatLevel(item.children,level+1);
				}
			});
		}

		function populate(data,selectedIndex){
			itemsMap = [];
			index = 0;
			selectedIndex = selectedIndex || 0;
			addListatLevel(data,0);
			listbox.setItems(items);
			listbox.setSelectedIndex(selectedIndex);
		}

		if (currentView == "local"){
			listbox.hide();
			dropzone.show();
			browseButton.show();
		}else{
			listbox.show();
			dropzone.hide();
			browseButton.hide();

			if (currentView == "bassoon"){
				currentView = typePanel.getType();
			}
		}
		

		switch (currentView){
			case "modules":
				itemHandler = false;
				label.label = "Load Module";
				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					if (item && item.data){
						var index = item.index;
						item = itemsMap[index];

						if (item.children){
							toggleDirectory(item,index);
						}else{
							listbox.setSelectedIndex(index);
							Tracker.load(item.url);
							App.doCommand(COMMAND.showTopMain);
						}
					}
				};

				if (modules.length){
					populate(modules,moduleSelectedIndex);
				}else{
					FetchService.json(Host.getBaseUrl() + "data/modules.json",function(data){
						if (data && data.modules){
							modules = data.modules;
							populate(modules,moduleSelectedIndex);
						}
					})
				}
				break;
			case "modarchive":
				itemHandler = ModArchive;
				label.label = "Browse Modarchive";
				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					if (item && item.data){
						var index = item.index;
						item = itemsMap[index];

						if (item.children){
							toggleDirectory(item,index);
						}else{
							listbox.setSelectedIndex(index);
							Tracker.load(item.url);
                            App.doCommand(COMMAND.showTopMain);
						}
					}
				};
				onLoadChildren = function(item,data){
					if (data && data.length){

						if (item.title == "... load more ..." && item.parent){
							item = item.parent;
							data.forEach(function(child){
								child.parent = item;
							});
							item.children.pop();
							item.children = item.children.concat(data);
						}else{
							data.forEach(function(child){
								child.parent = item;
							});
							item.children = data;
						}
					}else{
						item.children = [{title:"error loading data"}];
						console.error("this does not seem to be a valid modArchive API response");
					}
					me.refreshList();
				};

				if (modArchive.length){
					populate(modArchive,0);
				}else{
					listbox.setItems([{label: "loading ..."}]);

					FetchService.json(Host.getBaseUrl() + "data/modarchive.json",function(data){
						if (data && data.modarchive){
							modArchive = data.modarchive;
							populate(modArchive,0);
						}
					});

				}
				break;

			case "modulespl":
				itemHandler = ModulesPl;
				label.label = "Browse Modules.pl";
				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					if (item && item.data){
						var index = item.index;
						item = itemsMap[index];

						if (item.children){
							toggleDirectory(item,index);
						}else{
							listbox.setSelectedIndex(index);
							Tracker.load(item.url);
                            App.doCommand(COMMAND.showTopMain);
						}
					}
				};
				onLoadChildren = function(item,data){
					if (data && data.length){

						if (item.title == "... load more ..." && item.parent){
							item = item.parent;
							data.forEach(function(child){
								child.parent = item;
							});
							item.children.pop();
							item.children = item.children.concat(data);
						}else{
							data.forEach(function(child){
								child.parent = item;
							});
							item.children = data;
						}
					}else{
						item.children = [{title:"error loading data"}];
						console.error("this does not seem to be a valid modArchive API response");
					}
					me.refreshList();
				};

				if (modulesPl.length){
					populate(modulesPl,0);
				}else{
					listbox.setItems([{label: "loading ..."}]);

					FetchService.json(Host.getBaseUrl() + "data/modulespl.json",function(data){
						if (data && data.modulespl){
							modulesPl = data.modulespl;
							populate(modulesPl,0);
						}
					});

				}
				break;

			case "dropbox":
				itemHandler = Dropbox;
				label.label = "Browse Your Dropbox";

				UI.setStatus("Contacting Dropbox",true);
				listbox.setItems([{label: "loading ..."}]);

				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					if (item && item.data){
						var index = item.index;
						item = itemsMap[index];

						if (item.children){
							toggleDirectory(item,index);
						}else{
							listbox.setSelectedIndex(index);

							UI.setInfo(item.title);
							UI.setStatus("Loading from Dropbox",true);

							Dropbox.getFile(item,function(blob){
								var reader = new FileReader();
								reader.onload = function(){
									Tracker.processFile(reader.result,item.title).then(fileType=>{
										UI.setStatus("Ready");
									})
								};
								reader.readAsArrayBuffer(blob);
							});

						}
					}
				};

				onLoadChildren = function(item,data){
					if (data && data.length){
						data.forEach(function(child){
							child.parent = item;
						});
						item.children = data;
					}else{
						item.children = [{title:"error loading data"}];
						console.error("this does not seem to be a valid dropbox API response");
					}
					me.refreshList();

				};

				if (dropBoxList.length){
					populate(dropBoxList,0);
				}else{
					Dropbox.checkConnected().then(isConnected=>{
						if (isConnected){
							Dropbox.list("",function(data){
								UI.setStatus("");
								dropBoxList = data;
								populate(data,0);
							});
						}else{
							console.log("Dropbox not connected");
							Dropbox.showConnectDialog();
						}
					});
				}
				break;
			case "samples":
				itemHandler = false;
				label.label = "Load Sample to slot " + Tracker.getCurrentInstrumentIndex();
				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					if (item && item.data){
						var index = item.index;
						item = itemsMap[index];

						if (item.children){
							listbox.setSelectedIndex(index);
							sampleSelectedIndex = index;
							if (item.isExpanded){
								item.isExpanded = false;
								me.refreshList();
							}else{
								item.isExpanded = true;
								if (item.children.length){
									me.refreshList();
								}else{

									FetchService.json(item.url,function(data){
										if (data && data.samples){
											item.children = data.samples;
											me.refreshList();
										}
									})
								}
							}
						}else{
							listbox.setSelectedIndex(index);
							Tracker.load(item.url);
							//UI.mainPanel.setView("resetTop");
						}

					}
				};
				onLoadChildren = function(item,data){
					if (data && data.samples){
						item.children = data.samples;
						me.refreshList();
					}
				};


				if (samples.length){
					populate(samples,sampleSelectedIndex);
				}else{
					FetchService.json(Host.getBaseUrl() + "data/samples.json",function(data){
						if (data && data.samples){
							samples = data.samples;
							populate(samples,sampleSelectedIndex);
						}
					})
				}
				break;
			case "playlists":
				itemHandler = false;
				label.label = "Load Playlist";
				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					listbox.setSelectedIndex(index);
					Tracker.load(Editor.unpackUrl(item.data.url));
					App.doCommand(COMMAND.showTopMain);
				};

				if (playlists.length){
					populate(playlists,playlistSelectedIndex);
				}else{
					FetchService.json(Host.getBaseUrl() + "playlists/main.json",function(data){
						if (data && data.modules){
							playlists = data.modules;
							populate(playlists,playlistSelectedIndex);
						}
					})
				}
				break;
			case "hippo":
				itemHandler = false;
				label.label = "Hippo Playlists";
				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					listbox.setSelectedIndex(index);
					Hippo.get("playlist/" + item.data.url,function(data){
						console.log(data);
						Playlist.set(data);
						App.doCommand(COMMAND.showTopMain);
					});
					//Tracker.load(Editor.unpackUrl(item.data.url));
				};

				listbox.setItems([{label: "loading ..."}]);

				Hippo.get("playlists",function(data){
					populate(data,0);
				});
				break;
			case "local":
				itemHandler = false;
				label.label = "Open Local files";
				break;
		}

	};

	me.playRandomSong = function(format){
		
		//Todo: Add API rate check?
		//Or move this to the local database?
		
		var useModArchiveAPI = true;
		Tracker.autoPlay = true;
		
		if (useModArchiveAPI){
			UI.setStatus("Fetching random song",true);
			UI.setInfo("");
			FetchService.json("https://www.stef.be/bassoontracker/api/random" + (format || ""),function(data){
				if (data && data.modarchive && data.modarchive.module){
					Tracker.load(data.modarchive.module.url);
				}else{
					console.error("this does not seem to be a valid modArchive API response");
				}
			})
		}else{
			var message = document.createElement("div");
			message.className = "message";
			message.innerHTML = 'Due to a sudden spike of traffic, the ModArchive API has reached its limit and is currently unavailable.<br>We are working on a solution.';
			document.body.appendChild(message);

			setTimeout(function(){
				document.body.removeChild(message)
			},4000);
		}
	};

	me.generatePlayList = function(){
		UI.setStatus("Generating playlist",true);
		UI.setInfo("");
		FetchService.json("https://www.stef.be/bassoontracker/api/generatelist",function(data){
			if (data && data.modules){
				Playlist.set(data);
				Tracker.autoPlay = true;
				Playlist.play(0);

			}else{
				UI.setStatus("Error: could not contact the API",false);
			}
		})
	}

	function toggleDirectory(item,index){
		listbox.setSelectedIndex(index);
		moduleSelectedIndex = index;
		if (item.isExpanded){
			item.isExpanded = false;
			me.refreshList();
		}else{
			item.isExpanded = true;
			if (item.children.length){
				me.refreshList();
			}else{
				console.log("load children from " + item.url);
				item.children = [{title: "loading ..."}];

				me.refreshList();

				if (itemHandler){
					itemHandler.get(item.url,function(data){
						onLoadChildren(item,data);
					});
				}else{
					FetchService.json(item.url,function(data){
						onLoadChildren(item,data);
					})
				}



			}
		}
	}


    EventBus.on(EVENT.diskOperationTargetChange,function(target){

    	var action = actionPanel.getAction();

        if (target && target.target) target = target.target;
        if (target && target.fileType){
            if (target.fileType === FILETYPE.module) target = "modules";
            if (target.fileType === FILETYPE.sample) target = "samples";
            if (target.fileType === FILETYPE.playlist) target = "playlists";
        }
        if (typeof target === "undefined") target = targetPanel.getTarget();

        console.log(target);

    	if (action === "save"){
            currentAction = "save";
            currentView = typePanel.getType();

            var labelText = "Export Module";
            if (currentView === "samples")  labelText = "Export Sample";
            if (currentView === "playlists")  labelText = "Export Playlist";
			label.label = labelText;

            if (loadButton.isActive) loadButton.setActive(false);
            if (!saveButton.isActive) saveButton.setActive(true);
			dropzone.hide();
			browseButton.hide();

			me.onResize();

			if (target === "dropbox"){
				Dropbox.checkConnected(function(isConnected){
					if (!isConnected){
						Dropbox.showConnectDialog();
					}
				})
			}

		}else{
            currentAction = "load";
            me.refreshList(target);

            if (!loadButton.isActive) loadButton.setActive(true);
            if (saveButton.isActive) saveButton.setActive(false);
		}

    });


	EventBus.on(EVENT.instrumentChange,function(value){
		if (me.isVisible() && currentView == "samples") label.label = "Load Sample to slot " + Tracker.getCurrentInstrumentIndex();
	});

	EventBus.on(COMMAND.randomSong,function(){
		me.playRandomSong();
	});

	EventBus.on(COMMAND.randomSongXM,function(){
		me.playRandomSong("xm");
	});

	EventBus.on(COMMAND.randomPlayList,function(){
		me.generatePlayList();
	});

	return me;

};

export default DiskOperations;

