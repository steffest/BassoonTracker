UI.DiskOperations = function(){

	var me = UI.panel();
	me.hide();

	var currentView = "modules";

	var background = UI.scale9Panel(0,0,20,20,UI.Assets.panelMainScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var buttonsSide = [];
	var buttonsSideInfo=[
		{label:"Module", onClick:function(){me.refreshList("modules")}},
		{label:"Sample", onClick:function(){me.refreshList("samples")}},
		{label:"Save", onClick:function(){Tracker.save();}},
		{label:"Exit", onClick:function(){UI.mainPanel.setView("main");}}
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
		var buttonHeight = Math.floor(innerHeight/4);


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
			height:buttonHeight*4
		})

	};

	me.refreshList = function(type){
		var items = [];

		currentView = type || currentView;

		function populate(data){
			data.forEach(function(item){
				items.push({label: item.title, data: item});
			});
			listbox.setItems(items);
		}

		if (currentView == "modules"){
			listbox.onClick = function(e){
				var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
				if (item){
					Tracker.load(item.data.url);
					UI.mainPanel.setView("main");
				}
			};

			var listData = FetchService.json("data/modules.json",function(data){
				if (data && data.modules){
					populate(data.modules);
				}

			})
		}else{

			listbox.onClick = function(e){
				var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
				if (item){
					Tracker.load(item.data.url);
					UI.mainPanel.setView("main");
				}
			};

			var listData = FetchService.json("data/samples.json",function(data){
				if (data && data.samples){
					populate(data.samples);
				}
			})
		}
	};

	return me;

};

