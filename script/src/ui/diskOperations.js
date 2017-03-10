UI.DiskOperations = function(){

	var me = UI.panel();
	me.hide();

	var currentView = "modules";
	var itemsMap = [];

	var modules = [];
	var samples = [];
	var modArchive = [];
	var sampleSelectedIndex = 0;
	var moduleSelectedIndex = 0;
	var onLoadChildren = function(){};
	var itemHandler;

	var background = UI.scale9Panel(0,0,20,20,UI.Assets.panelMainScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var buttonsSide = [];
	var buttonsSideInfo=[
		{label:"Load Module", onClick:function(){me.refreshList("modules")}},
		{label:"Save Module", onClick:function(){Tracker.save();}},
		{label:"Render to Sample", onClick:function(){Tracker.renderTrackToBuffer()}},
		{label:"Load Sample", onClick:function(){me.refreshList("samples")}},
		{label:"Exit", onClick:function(){App.doCommand(COMMAND.showTop)}}
	];

	for (var i = 0;i< buttonsSideInfo.length;i++){
		var buttonSideInfo = buttonsSideInfo[i];
		var buttonElm = UI.button();
		buttonElm.info = buttonSideInfo;
		buttonElm.onClick =  buttonSideInfo.onClick;
		buttonsSide[i] = buttonElm;
		me.addChild(buttonElm);
	}

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

	var modArchiveButton = UI.Assets.generate("buttonDark");
	modArchiveButton.setLabel("ModArchive ");
	modArchiveButton.onClick = function(){
		me.refreshList("modarchive");
	};
	me.addChild(modArchiveButton);

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

	me.setLayout = function(){

		if (!UI.mainPanel) return;
		me.clearCanvas();

		background.setProperties({
			left: 0,
			top: 0,
			height: me.height,
			width: me.width
		});


		var startTop = 5;
		var innerHeight = me.height - 5;
		var buttonHeight = Math.floor(innerHeight/buttonsSideInfo.length);

		closeButton.setProperties({
			top: startTop,
			left: me.width - 30
		});

		modArchiveButton.setProperties({
			width: 120,
			height: 26,
			top: startTop,
			left: UI.mainPanel.col5X - 123
		});
		
		for (i = 0;i<buttonsSideInfo.length;i++){
			var button = buttonsSide[i];
			button.setProperties({
				left:UI.mainPanel.defaultMargin,
				top: (i*buttonHeight) + startTop,
				width: UI.mainPanel.col1W,
				height:buttonHeight,
				label: button.info.label,
				textAlign:"left",
				background: UI.Assets.buttonLightScale9,
				font:window.fontMed
			});
		}

		label.setProperties({
			left: UI.mainPanel.col2X,
			top: startTop + 4,
			height: 20,
			width: UI.mainPanel.col4W
		});

		listbox.setProperties({
			left: UI.mainPanel.col2X,
			width: UI.mainPanel.col3W,
			top: startTop + 20 + 7,
			height:buttonHeight*buttonsSideInfo.length - 30
		});

		dropzone.setProperties({
			left: UI.mainPanel.col5X,
			width: UI.mainPanel.col1W,
			top: startTop + 20 + 7,
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

		if (currentView == "modules"){
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
		}else if (currentView == "modarchive"){
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
						console.error(item);
						Tracker.load(item.url);
						UI.mainPanel.setView("main");
					}
				}
			};
			onLoadChildren = function(item,data){
				if (data && data.length){
					item.children = data;
				}else{
					item.children = [{title:"error loading data"}];
					console.error("this does not seem to be a valid modArchive API response");
				}
				/*item.children = [];
				if (data && data.modarchive && data.modarchive.module){
					var mods = data.modarchive.module;
					mods.forEach(function(mod){
						item.children.push({title:mod.songtitle || "---",url:mod.url});
					});
				}else{
					item.children.push({title:"error loading data"});
					console.error("this does not seem to be a valid modArchive API response");
				}*/
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


		}else{
			itemHandler = false;
			label.setLabel("Load Sample to slot " + Tracker.getCurrentSampleIndex());
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

		}
	};

	me.playRandomSong = function(){
		FetchService.json("http://www.stef.be/bassoontracker/api/random",function(data){
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
						console.error(data);
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


	EventBus.on(EVENT.sampleChange,function(event,value){
		if (me.isVisible() && currentView == "samples") label.setLabel("Load Sample to slot " + Tracker.getCurrentSampleIndex());
	});



	return me;

};

