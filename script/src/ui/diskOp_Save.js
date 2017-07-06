UI.DiskOperationSave = function(){

	var me = UI.panel();
	var fileName;
	var saveAsFileType = FILETYPE.module;
	var mainFileType = FILETYPE.module;

	var background = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var label1 = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkGreyScale9);
	label1.ignoreEvents = true;
	me.addChild(label1);

	var labelLoad = UI.label({
		label: "Export Module as",
		font: fontSmall
	});
	me.addChild(labelLoad);

	var selectTypes = {};
	selectTypes[FILETYPE.module] = [
		{label:"module",active:true, extention:".mod", fileType: FILETYPE.module},
		{label:"wav",active:false, extention:".wav", fileType: FILETYPE.sample}
	];
	selectTypes[FILETYPE.sample] = [
		{label:"wav 16 bit",active:false, extention:".wav", fileType: FILETYPE.sample},
		{label:"wav 8 bit",active:true, extention:".wav", fileType: FILETYPE.sample},
		{label:"RAW 8 bit",active:false, extention:".sample", fileType: FILETYPE.sample}
	];

	var selectionType = UI.radioGroup();
	selectionType.setProperties({
		align: "right",
		size:"med",
		divider: "line",
		highLightSelection:true
	});
	selectionType.setItems(selectTypes[FILETYPE.module]);
	selectionType.onChange = function(selectedIndex){
		var item = this.getSelectedItem();
		saveAsFileType = item && item.fileType ? item.fileType : FILETYPE.module;
		setFileName();
	};
	me.addChild(selectionType);

	var saveButton = UI.button();
	saveButton.setProperties({
		label: "Export",
		textAlign:"center",
		background: UI.Assets.buttonLightScale9,
		font:window.fontMed
	});
	saveButton.onClick = function(){
		if (mainFileType == FILETYPE.module){
			if (saveAsFileType == FILETYPE.module){
				Tracker.save(fileName);
			}
			if (saveAsFileType == FILETYPE.sample){
				Tracker.renderTrackToBuffer(fileName);
			}
		}
		if (mainFileType == FILETYPE.sample){
			var sample = Tracker.getCurrentSample();
			console.error(sample);


			if (sample){
				var fileSize = sample.length; // x2 ?
				var arrayBuffer = new ArrayBuffer(fileSize);
				var file = new BinaryStream(arrayBuffer,true);


				file.clear(2);
				var d;
				// sample length is in word
				for (i = 0; i < sample.length-2; i++){
					d = sample.data[i] || 0;
					file.writeByte(Math.round(d*127));
				}

				var b = new Blob([file.buffer], {type: "application/octet-stream"});

				saveAs(b,fileName);

				console.error("write sample with " + sample.length + " length");
			}
		}

	};
	me.addChild(saveButton);

	var fileNameInput = UI.inputbox({
		name: "fileNameInput",
		height: 20,
		onChange: function(value){
			fileName = value;
		},
		backgroundImage:"panel_mid"
	});
	me.addChild(fileNameInput);


	EventBus.on(EVENT.songPropertyChange,function(song){
		fileName = song.filename || "";
		setFileName();
	});

	EventBus.on(EVENT.diskOperationTargetChange,function(item){
		if (item && item.fileType){

			mainFileType = item.fileType;
			var label = "Export as";
			if (mainFileType == FILETYPE.sample) {
				label = "Export Sample as";
				fileName = Tracker.getCurrentSample().name.replace(/ /g, '-').replace(/\W/g, '');
			}
			if (mainFileType == FILETYPE.module) {
				label = "Export Module as";
				fileName = Tracker.getFileName();
			}
			labelLoad.setLabel(label);

			if (selectTypes[mainFileType]){
				selectionType.setItems(selectTypes[mainFileType]);
				selectionType.onChange();
			}

		}
	});

	EventBus.on(EVENT.sampleChange,function(value){
		if (me.isVisible() && mainFileType == FILETYPE.sample) {
			fileName = Tracker.getCurrentSample().name.replace(/ /g, '-').replace(/\W/g, '') || "Sample-" + Tracker.getCurrentSampleIndex();
			setFileName();
		}
	});

	function setFileName(){
		var thisFilename = fileName;
		var p = fileName.lastIndexOf(".");
		var extention = "";
		if (p>=0) {
			thisFilename = fileName.substr(0,p);
			extention = fileName.substr(p);
		}
		var type = selectionType.getSelectedItem();
		if (type && type.extention) extention = type.extention;
		fileNameInput.setValue(thisFilename + extention);
	}

	me.setLayout = function(){

		var innerWidth = me.width-2;

		if (!UI.mainPanel) return;
		me.clearCanvas();

		background.setProperties({
			left: 0,
			top: 0,
			height: me.height,
			width: me.width
		});

		label1.setProperties({
			left: 1,
			top: 1,
			height: 16,
			width: innerWidth
		});

		labelLoad.setProperties({
			left: -1,
			top: 3,
			height: 16,
			width: innerWidth
		});

		fileNameInput.setProperties({
			left:6,
			width: innerWidth-8,
			top: 24
		});

		selectionType.setProperties({
			left:4,
			width: innerWidth-4,
			height: 64,
			top: 48
		});

		saveButton.setProperties({
			left:2,
			width: innerWidth,
			height: 30,
			top: me.height - 29
		});



	};

	return me;

};

