UI.DiskOperations = function(){

	var me = UI.panel();
	me.hide();

	var currentView = "modules";
	var itemsMap = [];

	var modules = [];
	var samples = [];
	var modArchive = [];
	var modulesPl = [];
	var sampleSelectedIndex = 0;
	var moduleSelectedIndex = 0;
	var onLoadChildren = function(){};
	var itemHandler;

	var background = UI.scale9Panel(0,0,20,20,UI.Assets.panelMainScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var actionPanel = UI.DiskOperationActions();
	me.addChild(actionPanel);

	var targetPanel = UI.DiskOperationTargets();
	me.addChild(targetPanel);

	var savePanel = UI.DiskOperationSave();
	me.addChild(savePanel);


	/*

	var buttonsSide = [];
	var buttonsSideInfo=[
		{label:"Load Module", labels:["Load Module","Load Mod","Load","Lo"],onClick:function(){me.refreshList("modules")}},
		{label:"Save Module", labels:["Save Module","Save Mod","Save","Sa"], onClick:function(){Tracker.save();}},
		{label:"Render to Sample", labels:["Render to Sample","Render","Ren"], onClick:function(){Tracker.renderTrackToBuffer()}},
		{label:"Load Sample", labels:["Load Sample","Sample","Sm"], onClick:function(){me.refreshList("samples")}},
		{label:"Exit", labels:["Exit","Ex"],onClick:function(){App.doCommand(COMMAND.showTop)}}
	];

	for (var i = 0;i< buttonsSideInfo.length;i++){
		var buttonSideInfo = buttonsSideInfo[i];
		var buttonElm = UI.button();
		buttonElm.info = buttonSideInfo;
		buttonElm.onClick =  buttonSideInfo.onClick;
		buttonElm.getLabel = function(width){
			var maxChars = Math.floor((width - 30) / 8);
			if (this.info.labels){
				var label;
				for (var i = 0, len = this.info.labels.length; i<len; i++){
					label = this.info.labels[i];
					if (label.length <= maxChars){
						return label;
					}
				}
				return label;
			}else{
				return this.info.label;
			}
		};
		buttonsSide[i] = buttonElm;
		me.addChild(buttonElm);
	}
	*/

	var label = UI.label({
		label: "Load module",
		font: fontMed
	});
	me.addChild(label);

	var closeButton = UI.Assets.generate("button20_20");
	closeButton.setLabel("x");
	closeButton.onClick = function(){
		UI.mainPanel.setView("main");
	};
	me.addChild(closeButton);


	/*var dropBoxButton = UI.Assets.generate("buttonDark");
	dropBoxButton.setLabel("Dropbox ");
	dropBoxButton.onClick = function(){
		if (Dropbox.isConnected){
			me.refreshList("dropbox");
		}else{
			Dropbox.checkConnected(function(isConnected){
				if (isConnected){
					me.refreshList("dropbox");
				}else{
					console.log("Dropbox not connected");
					Dropbox.authenticate();
				}
			})
		}
	};
	me.addChild(dropBoxButton);
	*/

	var listbox = UI.listbox();
	me.addChild(listbox);


	var dropzone = UI.button();
	dropzone.setProperties({
		background: UI.Assets.buttonDarkActiveScale9,
		image: Y.getImage("dropzone"),
		font: fontSmall,
		textAlign: "center"

	});
	me.addChild(dropzone);
	dropzone.hide();


	EventBus.on(EVENT.diskOperationTargetChange,function(target){

		if (target && target.target) target = target.target;
		if (target && target.fileType){
			if (target.fileType == FILETYPE.module) target = "modules";
			if (target.fileType == FILETYPE.sample) target = "samples";
		}
		if (typeof target == "undefined") target = targetPanel.getTarget();
		me.refreshList(target);

	});

	me.setLayout = function(subView){

		if (!UI.mainPanel) return;
		me.clearCanvas();

		background.setProperties({
			left: 0,
			top: 0,
			height: me.height,
			width: me.width
		});

		var startTop = 5;

		closeButton.setProperties({
			top: startTop-2,
			width: 20,
			heigth: 18,
			left: me.width - 30
		});


		if (me.width >= 730){
			actionPanel.setProperties({
				top: startTop,
				left: UI.mainPanel.defaultMargin,
				width: UI.mainPanel.col1W,
				height: me.height - 10
			});
			targetPanel.setProperties({
				top: startTop,
				left: UI.mainPanel.col2X,
				width: UI.mainPanel.col1W,
				height: me.height - 10
			});

			label.setProperties({
				left: UI.mainPanel.col3X,
				top: startTop,
				height: 20,
				width: UI.mainPanel.col2W
			});

			listbox.setProperties({
				left: UI.mainPanel.col3X,
				width: UI.mainPanel.col2W,
				top: startTop + 19,
				height: me.height - (19+startTop) - 5
			});

			savePanel.show();
			savePanel.setProperties({
				top: listbox.top,
				left: UI.mainPanel.col5X,
				width: UI.mainPanel.col1W,
				height: listbox.height
			});
		}else{

			actionPanel.setProperties({
				top: startTop,
				left: UI.mainPanel.defaultMargin,
				width: UI.mainPanel.col2W,
				height: (me.height / 2) - startTop - 16
			});

			targetPanel.setProperties({
				top: me.height / 2 - 16,
				left: UI.mainPanel.defaultMargin,
				width: UI.mainPanel.col2W,
				height: me.height / 2 + 16
			});

			listbox.setProperties({
				left: UI.mainPanel.col3X,
				width: UI.mainPanel.col3W,
				top: startTop + 19,
				height: me.height - (19+startTop) - 5
			});

			label.setProperties({
				left: UI.mainPanel.col3X,
				top: startTop,
				height: 20,
				width: UI.mainPanel.col3W
			});


			if (subView == "save"){

				savePanel.setProperties({
					left: UI.mainPanel.defaultMargin,
					width: UI.mainPanel.col2W,
					top: startTop,
					height:me.height - 10
				});

				actionPanel.hide();
				targetPanel.hide();
				savePanel.show();
			}else{
				actionPanel.show();
				targetPanel.show();
				savePanel.hide();
			}
		}




		dropzone.setProperties({
			left: listbox.left,
			width: listbox.width,
			top: listbox.top,
			height:listbox.height
		});
	};

	me.refreshList = function(type){
		var items = [];
		var index = 0;

		if (currentView != type) listbox.setSelectedIndex(0,true);
		currentView = type || currentView;

		function addListatLevel(data,level){
			data.forEach(function(item){
				var icon = currentView == "modules" ? Y.getImage("module") : Y.getImage("sample");
				if (item.children) icon = Y.getImage("disk");
				items.push({label: item.title, data: item, level: level, index: index, icon: icon});
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
		}else{
			listbox.show();
			dropzone.hide();

			if (currentView == "bassoon"){
				currentView = actionPanel.getAction();
			}
		}

		switch (currentView){
			case "modules":
				itemHandler = false;
				label.setLabel("Load Module");
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
							UI.mainPanel.setView("main");
						}
					}
				};

				if (modules.length){
					populate(modules,moduleSelectedIndex);
				}else{
					FetchService.json("data/modules.json",function(data){
						if (data && data.modules){
							modules = data.modules;
							populate(modules,moduleSelectedIndex);
						}
					})
				}
				break;
			case "modarchive":
				itemHandler = ModArchive;
				label.setLabel("Browse Modarchive");
				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					if (item && item.data){
						var index = item.index;
						item = itemsMap[index];

						if (item.children){
							toggleDirectory(item,index);
						}else{
							listbox.setSelectedIndex(index);
							console.log(item);
							Tracker.load(item.url);
							UI.mainPanel.setView("main");
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

					FetchService.json("data/modarchive.json",function(data){
						if (data && data.modarchive){
							modArchive = data.modarchive;
							populate(modArchive,0);
						}
					});

				}
				break;

			case "modulespl":
				itemHandler = ModulesPl;
				label.setLabel("Browse Modules.pl");
				listbox.onClick = function(e){
					var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
					if (item && item.data){
						var index = item.index;
						item = itemsMap[index];

						if (item.children){
							toggleDirectory(item,index);
						}else{
							listbox.setSelectedIndex(index);
							console.log(item);
							Tracker.load(item.url);
							UI.mainPanel.setView("main");
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

					FetchService.json("data/modulespl.json",function(data){
						if (data && data.modulespl){
							modulesPl = data.modulespl;
							populate(modulesPl,0);
						}
					});

				}
				break;

			case "dropbox":
				itemHandler = Dropbox;
				label.setLabel("Browse Your Dropbox");

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
							console.log(item);

							UI.setInfo(item.title);
							UI.setStatus("Loading from Dropbox");

							Dropbox.getFile(item.url,function(blob){
								var reader = new FileReader();
								reader.onload = function(){
									Tracker.processFile(reader.result,item.title,function(isMod){
										UI.setStatus("Ready");
										UI.mainPanel.setView("main");
									});
								};
								reader.readAsArrayBuffer(blob);
							});

						}
					}
				};

				Dropbox.list("",function(data){
					console.log(data);
					populate(data,0);
				});
				break;
			case "samples":
				itemHandler = false;
				label.setLabel("Load Sample to slot " + Tracker.getCurrentInstrumentIndex());
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
					FetchService.json("data/samples.json",function(data){
						if (data && data.samples){
							samples = data.samples;
							populate(samples,sampleSelectedIndex);
						}
					})
				}
				break;
			case "local":
				itemHandler = false;
				label.setLabel("Upload files");
				break;
		}

	};

	me.playRandomSong = function(){
		UI.setStatus("Fetching random song");
		UI.setInfo("");
		FetchService.json("https://www.stef.be/bassoontracker/api/random",function(data){
			if (data && data.modarchive && data.modarchive.module){
				Tracker.load(data.modarchive.module.url);
			}else{
				console.error("this does not seem to be a valid modArchive API response");
			}
		})
	};


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


	EventBus.on(EVENT.instrumentChange,function(value){
		if (me.isVisible() && currentView == "samples") label.setLabel("Load Sample to slot " + Tracker.getCurrentInstrumentIndex());
	});



	return me;

};

