UI.DiskOperationSave = function(){

	var me = UI.panel();
	var fileName;
	var saveAsFileType = FILETYPE.module;
	var mainFileType = FILETYPE.module;
	var saveAsFileFormat = MODULETYPE.mod;
	var saveTarget = "local";

	var background = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);


	var selectTypes = {};
	selectTypes[FILETYPE.module] = [
		{label:"module",active:true, extention:".mod", fileType: FILETYPE.module},
		{label:"wav",active:false, extention:".wav", fileType: FILETYPE.sample, fileFormat: SAMPLETYPE.WAVE_PCM},
		{label:"mp3",active:false, extention:".mp3", fileType: FILETYPE.sample, fileFormat: SAMPLETYPE.MP3}
	];
	selectTypes[FILETYPE.sample] = [
		{label:"wav 16 bit",active:false, extention:".wav", fileType: FILETYPE.sample, fileFormat: SAMPLETYPE.RIFF_16BIT},
		{label:"wav 8 bit",active:true, extention:".wav", fileType: FILETYPE.sample, fileFormat: SAMPLETYPE.RIFF_8BIT},
		{label:"RAW 8 bit",active:false, extention:".sample", fileType: FILETYPE.sample, fileFormat: SAMPLETYPE.RAW_8BIT}
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
        saveAsFileFormat = item && item.fileFormat ? item.fileFormat : MODULETYPE.mod;
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
				Editor.save(fileName,saveTarget);
			}
			if (saveAsFileType == FILETYPE.sample){
				//Editor.renderTrackToBuffer(fileName,saveTarget);
				BassoonProvider.renderFile(fileName,saveAsFileFormat === SAMPLETYPE.MP3);
			}
		}
		if (mainFileType == FILETYPE.sample){
			var sample = Tracker.getCurrentInstrument().sample;

			if (sample){

				console.error(saveAsFileFormat);

				if (saveAsFileFormat === SAMPLETYPE.RAW_8BIT){
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

				}else{
					file = encodeRIFFsample(sample.data,saveAsFileFormat === SAMPLETYPE.RIFF_16BIT ? 16 : 8);
				}

                var b = new Blob([file.buffer], {type: "application/octet-stream"});


				if (saveTarget === "dropbox"){
					Dropbox.putFile("/" + fileName,b);
				}else{
					saveAs(b,fileName);
				}

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
		if (extention === ".mod" && Tracker.inFTMode()) extention = ".xm";
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

		fileNameInput.setProperties({
			left:4,
			width: innerWidth-6,
			top: 4
		});

        saveButton.setProperties({
            left:2,
            width: innerWidth,
            height: 28,
            top: me.height - 27
        });

		selectionType.setProperties({
			left:4,
			width: innerWidth-4,
			height: me.height - saveButton.height - 30,
			top: 30
		});

	};

	EventBus.on(EVENT.songPropertyChange,function(song){
		fileName = song.filename || "";
		setFileName();
	});

	EventBus.on(EVENT.diskOperationTargetChange,function(item){

		saveTarget = item;
		if (saveTarget.target) saveTarget = saveTarget.target;
		if (item && item.fileType){

			mainFileType = item.fileType;
			if (mainFileType == FILETYPE.sample) {
				fileName = Tracker.getCurrentInstrument().name.replace(/ /g, '-').replace(/\W/g, '');
			}
			if (mainFileType == FILETYPE.module) {
				fileName = Tracker.getFileName();
			}

			if (selectTypes[mainFileType]){
				selectionType.setItems(selectTypes[mainFileType]);
				selectionType.onChange();
			}

		}
	});


	EventBus.on(EVENT.instrumentChange,function(value){
		if (me.isVisible() && mainFileType == FILETYPE.sample) {
			fileName = Tracker.getCurrentInstrument().name.replace(/ /g, '-').replace(/\W/g, '') || "Sample-" + Tracker.getCurrentInstrumentIndex();
			setFileName();
		}
	});

	EventBus.on(EVENT.trackerModeChanged,function(value){
		if (me.isVisible() && mainFileType == FILETYPE.module) {
			fileName = Tracker.getSong().filename || "";
			setFileName();
		}
	});

	return me;

};

