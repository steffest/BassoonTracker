UI.DiskOperations = function(){

	var me = UI.panel();
	me.hide();

	var currentView = "modules";
	var itemsMap = [];

	var modules = [];
	var samples = [];
	var sampleSelectedIndex = 0;
	var moduleSelectedIndex = 0;

	var background = UI.scale9Panel(0,0,20,20,UI.Assets.panelMainScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var buttonsSide = [];
	var buttonsSideInfo=[
		{label:"Load Module", onClick:function(){me.refreshList("modules")}},
		{label:"Save Module", onClick:function(){Tracker.save();}},
		{label:"Render to Sample", onClick:function(){Tracker.renderTrackToBuffer()}},
		{label:"Load Sample", onClick:function(){me.refreshList("samples")}},
		{label:"Close", onClick:function(){UI.mainPanel.setView("main");}}
	];

	for (var i = 0;i< buttonsSideInfo.length;i++){
		var buttonSideInfo = buttonsSideInfo[i];
		var buttonElm = UI.button();
		buttonElm.info = buttonSideInfo;
		buttonElm.onClick =  buttonSideInfo.onClick;
		buttonsSide[i] = buttonElm;
		me.addChild(buttonElm);
	}

	var listbox = UI.listbox();
	me.addChild(listbox);

	me.setLayout = function(){

		if (!UI.mainPanel) return;
		me.clearCanvas();

		background.setProperties({
			left: me.left,
			top: me.top,
			height: me.height,
			width: me.width
		});

		var startTop = 16;
		var innerHeight = me.height-20;
		var buttonHeight = Math.floor(innerHeight/buttonsSideInfo.length);


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

		listbox.setProperties({
			left: UI.mainPanel.col2X,
			width: UI.mainPanel.col4W,
			top: startTop,
			height:buttonHeight*buttonsSideInfo.length
		})
	};

	me.refreshList = function(type){
		var items = [];
		var index = 0;

		currentView = type || currentView;

		function addListatLevel(data,level){
			data.forEach(function(item){
				var icon = currentView == "modules" ? cachedAssets.images["skin/icons_small/module.png"] : cachedAssets.images["skin/icons_small/sample.png"]
				if (item.children) icon = cachedAssets.images["skin/icons_small/disk.png"];
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
			listbox.onClick = function(e){
				var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
				if (item && item.data){
					var index = item.index;
					item = itemsMap[index];

					if (item.children){
						toggleDirectory(item,index);
					}else{
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
		}else{

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
								console.error("load children from " + item.url);

								FetchService.json(item.url,function(data){
									if (data && data.samples){
										item.children = data.samples;
										me.refreshList();
									}
								})
							}
						}
					}else{
						Tracker.load(item.url);
						UI.mainPanel.setView("main");
					}

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
				console.error("load children from " + item.url);

				FetchService.json(item.url,function(data){
					if (data && data.samples){
						item.children = data.samples;
						me.refreshList();
					}
				})
			}
		}
	}



	return me;

};

