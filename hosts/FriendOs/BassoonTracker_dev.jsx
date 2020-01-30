var callBackFunctions = {};

Application.run = function (msg) {
	
	this.mainView = new View({
		title: 'BassoonTracker',
		width: 960,
		height: 600
	});

	this.drawMenu();

	// Load the html into the view
	var self = this;
	var f = new File('Progdir:hosts/FriendOs/dev.html');
	f.onLoad = function (data) {
		self.mainView.setContent(data);
		if (typeof addPermanentCallback === "function") {
			sendMessageToBassoonApp({
				command: "setMessageHandler",
				callbackId: addPermanentCallback(function (msg) {
					receiveMessageFromBassoonApp(msg);
				})
			})
		}else{
			console.error("ERROR: addPermanentCallback is not defined!")
		}
	};
	f.load();

	// On closing the window, quit.
	this.mainView.onClose = function () {
		Application.quit();
	};


};

// Redraws the main application pulldown menu
Application.drawMenu = function(){
	this.mainView.setMenuItems(
		[
			{
				name: 'File',
				items: [
					{
						name: i18n('New'),
						command: 'bsn_newFile'
					},
					{
						name: i18n('Load Module'),
						command: 'loadmodule'
					},
					{
						name: i18n('Save Module'),
						command: 'savemodule'
					},
					{
						name: i18n('Open Random Mod'),
						command: 'bsn_randomSong'
					},
					{
						name: i18n('Open Random XM'),
						command: 'bsn_randomSongXM'
					}
				]
			},
			{
				name: 'Edit',
				items: [
					{
						name: i18n('Cut'),
						command: 'bsn_ut'
					},
					{
						name: i18n('Copy'),
						command: 'bsn_copy'
					},
					{
						name: i18n('Paste'),
						command: 'bsn_paste'
					},
					{
						name: i18n('Clear'),
						items: [
							{
								name: i18n('Track'),
								command: 'bsn_clearTrack'
							},
							{
								name: i18n('Pattern'),
								command: 'bsn_clearPattern'
							},
							{
								name: i18n('Song'),
								command: 'bsn_clearSong'
							},
							{
								name: i18n('Instruments'),
								command: 'bsn_clearInstruments'
							}
						]
					},
					{
						name: i18n('Render Pattner 2 sample'),
						command: 'bsn_pattern2Sample'
					},

				]
			},
			{
				name: 'View',
				items: [
					{
						name: i18n('Main'),
						command: 'bsn_showMain'
					},
					{
						name: i18n('Options'),
						command: 'bsn_showOptions'
					},
					{
						name: i18n('File Operations'),
						command: 'bsn_showFileOperations'
					},
					{
						name: i18n('Sample Editor'),
						command: 'bsn_showSampleEditor'
					},
					{
						name: i18n('Piano'),
						command: 'bsn_togglePiano'
					}
				]
			},
			{
				name: 'Help',
				items: [
					{
						name: i18n('About'),
						command: 'bsn_showAbout'
					},
					{
						name: i18n('Documentation'),
						command: 'bsn_showHelp'
					},
					{
						name: i18n('Sourcecode on Github'),
						command: 'bsn_showGithub'
					}
				]
			}
		]);
};

// Message bridge
Application.receiveMessage = function (msg) {
	// menu commands
	var propagate = false;

	if (msg.command && msg.command.indexOf("bsn_") === 0) {
		sendMessageToBassoonApp(msg.command.split("bsn_")[1]);
	} else {
		switch (msg.command) {
			case 'loadmodule':
				this.loadFile("module");
				break;
			case 'savemodule':
				sendMessageToBassoonApp("getFileName",function(result){
					Application.saveFile("module",result);
				});
				break;
		}
	}
};


Application.loadFile = function (type) {

	var config = {
		triggerFunction: function (items) {
			console.log("These files and directories were selected:", items);
			sendMessageToBassoonApp({
				command: 'loadFile',
				files: items
			});
		},
		path: "Mountlist:",
		type: "load",
		title: "Load Module or Sample",
		filename: "",
		mainView: this.mainView
	};
	var d = new Filedialog(config);
};

Application.saveFile = function (type,filename) {

	var config = {
		triggerFunction: function (items) {
			sendMessageToBassoonApp({
				command: 'saveFile',
				files: items
			});
		},
		path: "Mountlist:",
		type: "save",
		title: "Save Module",
		filename: filename,
		mainView: this.mainView
	};
	var d = new Filedialog(config);
};


// send message from client
function sendMessageToBassoonApp(msg,next) {
	if (typeof msg === "string") {
		msg = {command: msg};
	}
	msg = msg || {};
	msg.type = 'bassoontracker';
	
	if (next){
		msg.callbackId = new Date().getTime();
		callBackFunctions[msg.callbackId] = next;
	}
	Application.mainView.sendMessage(msg);
}

// receive message from client
function receiveMessageFromBassoonApp(msg) {
	console.warn("receive message from bassoon",msg);
	if (msg.command){
		if (msg.callbackId){
			var callback = callBackFunctions[msg.callbackId];
			if (callback){
				callback(msg.message);
				callBackFunctions[msg.callbackId] === undefined;
			}
		}
	}
	
}