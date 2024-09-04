import Panel from "../ui/components/panel.js";
import Scale9Panel from "../ui/components/scale9.js";
import Button from "../ui/components/button.js";
import Inputbox from "../ui/components/inputbox.js";
import RadioGroup from "../ui/components/radiogroup.js";
import Assets from "../ui/assets.js";
import {EVENT, FILETYPE, MODULETYPE, SAMPLETYPE, PLAYLISTTYPE} from "../enum.js";
import EventBus from "../eventBus.js";
import Tracker from "../tracker.js";
import Editor from "../editor.js";
import BassoonProvider from "../provider/bassoon.js";
import {encodeRIFFsample} from "../audio/riffWave.js";
import Dropbox from "../provider/dropbox.js";
import {BinaryStream} from "../filesystem.js";
import Playlist from "../models/playlist.js";
import {saveFile} from "../filesystem.js";


let DiskOperationSave = function(){

	var me = Panel();
	var fileName;
	var saveAsFileType = FILETYPE.module;
	var mainFileType = FILETYPE.module;
	var saveAsFileFormat = MODULETYPE.mod;
	var saveTarget = "local";

	var background = Scale9Panel(0,0,20,20,Assets.panelDarkInsetScale9);
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
	selectTypes[FILETYPE.playlist] = [
		{label:"PLS",active:true, extention:".pls", fileType: FILETYPE.playlist, fileFormat: PLAYLISTTYPE.PLS},
		{label:"JSON",active:false, extention:".json", fileType: FILETYPE.playlist, fileFormat: PLAYLISTTYPE.JSON}
	];

	var selectionType = RadioGroup();
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

	var saveButton = Button();
	saveButton.setProperties({
		label: "Export",
		textAlign:"center",
		background: Assets.buttonLightScale9,
		font:window.fontMed
	});
	saveButton.onClick = function(){
		if (mainFileType === FILETYPE.module){
			if (saveAsFileType === FILETYPE.module){
				Editor.save(fileName,saveTarget);
			}
			if (saveAsFileType === FILETYPE.sample){
				//Editor.renderTrackToBuffer(fileName,saveTarget);
				BassoonProvider.renderFile(fileName,saveAsFileFormat === SAMPLETYPE.MP3);
			}
		}
		if (mainFileType === FILETYPE.sample){
			var sample = Tracker.getCurrentInstrument().sample;

			if (sample){

				if (saveAsFileFormat === SAMPLETYPE.RAW_8BIT){
                    var fileSize = sample.length; // x2 ?
                    var arrayBuffer = new ArrayBuffer(fileSize);
                    var file = new BinaryStream(arrayBuffer,true);


                    file.clear(2);
                    var d;
                    // sample length is in word
                    for (let i = 0; i < sample.length-2; i++){
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
					saveFile(b,fileName);
				}

                console.log("write sample with " + sample.length + " length");

			}
		}
		if (mainFileType === FILETYPE.playlist){
			Playlist.export(fileName,saveAsFileFormat,saveTarget);
		}

	};
	me.addChild(saveButton);

	var fileNameInput = Inputbox({
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

		//if (!UI.mainPanel) return;
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
		song = song || Tracker.getSong();
		if (!song) return;
		fileName = song.filename || "";
		setFileName();
	});

	EventBus.on(EVENT.diskOperationTargetChange,function(item){

		saveTarget = item;
		if (saveTarget.target) saveTarget = saveTarget.target;
		if (item && item.fileType){

			mainFileType = item.fileType;
			if (mainFileType === FILETYPE.sample) {
				fileName = Tracker.getCurrentInstrument().name.replace(/ /g, '-').replace(/\W/g, '');
			}
			if (mainFileType === FILETYPE.module) {
				fileName = Tracker.getFileName();
			}
			if (mainFileType === FILETYPE.playlist) {
				fileName = Playlist.getFileName();
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

export default DiskOperationSave;

