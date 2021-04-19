var BassoonTracker = (function(){
;
/*
 Bridges Host functions BassoonTracker is running in.
 Currently supports
 	Web
 	WebPlugin
 	FriendUp
*/

var Host = function(){
	var me = {};
	var hostBridge;
	
	me.useUrlParams = true;
	me.useDropbox = true;
	me.showInternalMenu = true;
	me.useWebWorkers = true;
	me.useInitialLoad = true;
	
	me.init = function(){
	    if (typeof HostBridge === "object"){
			hostBridge = HostBridge;
			hostBridge.init();

			if (typeof hostBridge.useUrlParams === "boolean") me.useUrlParams = hostBridge.useUrlParams;
			if (typeof hostBridge.useDropbox === "boolean") me.useDropbox = hostBridge.useDropboxs;
			if (typeof hostBridge.showInternalMenu === "boolean") me.showInternalMenu = hostBridge.showInternalMenu;
			if (typeof hostBridge.useWebWorkers === "boolean") me.useWebWorkers = hostBridge.useWebWorkers;
	    }
	};
	
	me.getBaseUrl = function(){
		if (hostBridge && hostBridge.getBaseUrl){
			return hostBridge.getBaseUrl();
		}
		
		// Settings.baseUrl ... hmm ... can't remember where that is coming from
		if (typeof Settings === "undefined"){
			return "";
		}else{
			return Settings.baseUrl || "";
		}
	};
	
	me.getRemoteUrl = function(){
		if (hostBridge && hostBridge.getRemoteUrl){
			return hostBridge.getRemoteUrl();
		}
		return "";
	};
	
	me.getVersionNumber = function(){
		if (typeof versionNumber !== "undefined") return versionNumber;
		if (hostBridge && hostBridge.getVersionNumber) 	return hostBridge.getVersionNumber();
		return "dev";
	};
	
	me.getBuildNumber = function(){
		if (typeof buildNumber !== "undefined") return buildNumber;
		if (hostBridge && hostBridge.getBuildNumber) return hostBridge.getBuildNumber();
		return new Date().getTime();
	};

	me.signalReady = function(){
		if (hostBridge && hostBridge.signalReady) hostBridge.signalReady();
	};
	
	me.putFile = function(filename,file){
		
	};
	
	return me;
}();;
var cachedAssets = {
	images:{},
	audio:{},
	json:{},
	arrayBuffer:{}
};

var sprites = {};
var UI = undefined;

var PRELOADTYPE = {
	"image": 1,
	"audio":2,
	"json":3,
	"binary":4
};

var EVENT = {
	instrumentChange:1,
	patternChange:2,
	patternPosChange:3,
	patternTableChange:4,
	recordingChange:5,
	cursorPositionChange:6,
	trackStateChange:7,
	playingChange:8,
	playTypeChange: 9,
	songPositionChange:10,
	songSpeedChange:11,
	songBPMChange:12,
	samplePlay:13,
	screenRefresh: 14,
    screenRender: 15,
	songPropertyChange: 16,
	instrumentNameChange:17,
	command: 18,
	pianoNoteOn : 19,
	pianoNoteOff : 20,
	statusChange: 21,
	diskOperationTargetChange: 22,
	diskOperationActionChange: 23,
	trackCountChange:24,
	patternHorizontalScrollChange:25,
	songLoaded: 26,
	songLoading: 27,
	trackerModeChanged: 28,
    instrumentListChange:29,
	showView: 30,
	toggleView: 31,
	visibleTracksCountChange:32,
    filterChainCountChange:33,
    fxPanelToggle:34,
	samplePropertyChange:35,
	sampleIndexChange:36,
	second:37,
	minute:38,
	dropboxConnect: 39,
	dropboxConnectCancel: 40,
	trackScopeClick: 41,
	octaveChanged: 42,
	skipFrameChanged: 43,
	showContextMenu: 44,
	hideContextMenu: 45,
	clockEventExpired: 46,
	commandUndo: 50,
	commandRedo: 51,
	commandSelectAll: 52,
	songEnd: 53,
	patternEnd: 54,
	songSpeedChangeIgnored:55,
	songBPMChangeIgnored:56,
	commandProcessSample: 57,
	pluginRenderHook: 58,
	menuLayoutChanged: 59,
	midiIn: 60
};

var COMMAND = {
	newFile: 1,
	openFile: 2,
	saveFile: 3,
	clearTrack : 4,
	clearPattern : 5,
	clearSong : 6,
	clearInstruments : 7,
	showMain : 8,
	showOptions : 9,
	showFileOperations : 10,
	showSampleEditor : 11,
	showAbout : 12,
	showHelp : 13,
	togglePiano : 14,
	showTopMain : 15,
	showBottomMain: 16,
	randomSong: 17,
    randomSongXM: 18,
	showGithub: 19,
	showStats: 20,
	cut: 21,
	copy: 22,
	paste: 23,
	pattern2Sample: 24,
	toggleAppSideBar: 25,
	undo: 26,
	redo: 27,
	nibbles: 28
};

var PLAYTYPE = {
	song:1,
	pattern:2
};

var FILETYPE = {
	module:1,
	sample:2,
	pattern:3,
	track: 4
};

var MODULETYPE = {
	mod: 1,
	xm: 2
};

var SAMPLETYPE = {
    RAW_8BIT:1,
    WAVE_PCM:2,
    IFF_8SVX:3,
    MP3:4,
	RIFF_8BIT: 5,
	RIFF_16BIT: 6
};

var STEREOSEPARATION = {
	FULL: 1,
	BALANCED: 2,
	NONE: 3
};

var FREQUENCYTABLE =  {
	AMIGA: 1,
	LINEAR : 2
};

var LOOPTYPE =  {
	NONE: 0,
	FORWARD : 1,
	PINGPONG : 2
};

var SELECTION = {
	RESET : 1,
	CLEAR: 2,
	CUT: 3,
	COPY : 4,
	PASTE : 5,
	POSITION: 6,
	DELETE: 7,
	REPLACE: 8

};

var EDITACTION = {
	PATTERN: 1,
	TRACK: 2,
	NOTE: 3,
	RANGE: 4,
	VALUE: 5,
	DATA: 6,
	SAMPLE: 7
};


// Amiga Frequency
//var PALFREQUENCY = 7093789.2;
var AMIGA_PALFREQUENCY = 7093790; // not that my ears can hear the difference but this seems to be the correct value  ftp://ftp.modland.com/pub/documents/format_documentation/Protracker%20effects%20(MODFIL12.TXT)%20(.mod).txt

// Frequency used by Fast Tracker in Amiga mode
var PC_FREQUENCY = 7158728;

var AMIGA_PALFREQUENCY_HALF = AMIGA_PALFREQUENCY/2;
var PC_FREQUENCY_HALF = PC_FREQUENCY/2;

var LAYOUTS = {
	column4:4,
	column5:5,
	column5Full:6,
	column6:7
};



// used in Protracker mode
var NOTEPERIOD = {
	C1  : {period: 856, name: "C-1", tune: [907,900,894,887,881,875,868,862,856,850,844,838,832,826,820,814]},
	Cs1 : {period: 808, name: "C#1", tune: [856,850,844,838,832,826,820,814,808,802,796,791,785,779,774,768]},
	D1  : {period: 762, name: "D-1", tune: [808,802,796,791,785,779,774,768,762,757,752,746,741,736,730,725]},
	Ds1 : {period: 720, name: "D#1", tune: [762,757,752,746,741,736,730,725,720,715,709,704,699,694,689,684]},
	E1  : {period: 678, name: "E-1", tune: [720,715,709,704,699,694,689,684,678,674,670,665,660,655,651,646]},
	F1  : {period: 640, name: "F-1", tune: [678,675,670,665,660,655,651,646,640,637,632,628,623,619,614,610]},
	Fs1 : {period: 604, name: "F#1", tune: [640,636,632,628,623,619,614,610,604,601,597,592,588,584,580,575]},
	G1  : {period: 570, name: "G-1", tune: [604,601,597,592,588,584,580,575,570,567,563,559,555,551,547,543]},
	Gs1 : {period: 538, name: "G#1", tune: [570,567,563,559,555,551,547,543,538,535,532,528,524,520,516,513]},
	A1  : {period: 508, name: "A-1", tune: [538,535,532,528,524,520,516,513,508,505,502,498,495,491,487,484]},
	As1 : {period: 480, name: "A#1", tune: [508,505,502,498,494,491,487,484,480,477,474,470,467,463,460,457]},
	B1  : {period: 453, name: "B-1", tune: [480,477,474,470,467,463,460,457,453,450,447,444,441,437,434,431]},
	C2  : {period: 428, name: "C-2", tune: [453,450,447,444,441,437,434,431,428,425,422,419,416,413,410,407]},
	Cs2 : {period: 404, name: "C#2", tune: [428,425,422,419,416,413,410,407,404,401,398,395,392,390,387,384]},
	D2  : {period: 381, name: "D-2", tune: [404,401,398,395,392,390,387,384,381,379,376,373,370,368,365,363]},
	Ds2 : {period: 360, name: "D#2", tune: [381,379,376,373,370,368,365,363,360,357,355,352,350,347,345,342]},
	E2  : {period: 339, name: "E-2", tune: [360,357,355,352,350,347,345,342,339,337,335,332,330,328,325,323]},
	F2  : {period: 320, name: "F-2", tune: [339,337,335,332,330,328,325,323,320,318,316,314,312,309,307,305]},
	Fs2 : {period: 302, name: "F#2", tune: [320,318,316,314,312,309,307,305,302,300,298,296,294,292,290,288]},
	G2  : {period: 285, name: "G-2", tune: [302,300,298,296,294,292,290,288,285,284,282,280,278,276,274,272]},
	Gs2 : {period: 269, name: "G#2", tune: [285,284,282,280,278,276,274,272,269,268,266,264,262,260,258,256]},
	A2  : {period: 254, name: "A-2", tune: [269,268,266,264,262,260,258,256,254,253,251,249,247,245,244,242]},
	As2 : {period: 240, name: "A#2", tune: [254,253,251,249,247,245,244,242,240,239,237,235,233,232,230,228]},
	B2  : {period: 226, name: "B-2", tune: [240,238,237,235,233,232,230,228,226,225,224,222,220,219,217,216]},
	C3  : {period: 214, name: "C-3", tune: [226,225,223,222,220,219,217,216,214,213,211,209,208,206,205,204]},
	Cs3 : {period: 202, name: "C#3", tune: [214,212,211,209,208,206,205,203,202,201,199,198,196,195,193,192]},
	D3  : {period: 190, name: "D-3", tune: [202,200,199,198,196,195,193,192,190,189,188,187,185,184,183,181]},
	Ds3 : {period: 180, name: "D#3", tune: [190,189,188,187,185,184,183,181,180,179,177,176,175,174,172,171]},
	E3  : {period: 170, name: "E-3", tune: [180,179,177,176,175,174,172,171,170,169,167,166,165,164,163,161]},
	F3  : {period: 160, name: "F-3", tune: [170,169,167,166,165,164,163,161,160,159,158,157,156,155,154,152]},
	Fs3 : {period: 151, name: "F#3", tune: [160,159,158,157,156,155,154,152,151,150,149,148,147,146,145,144]},
	G3  : {period: 143, name: "G-3", tune: [151,150,149,148,147,146,145,144,143,142,141,140,139,138,137,136]},
	Gs3 : {period: 135, name: "G#3", tune: [143,142,141,140,139,138,137,136,135,134,133,132,131,130,129,128]},
	A3  : {period: 127, name: "A-3", tune: [135,134,133,132,131,130,129,128,127,126,125,125,124,123,122,121]},
	As3 : {period: 120, name: "A#3", tune: [127,126,125,125,123,123,122,121,120,119,118,118,117,116,115,114]},
	B3  : {period: 113, name: "B-3", tune: [120,119,118,118,117,116,115,114,113,113,112,111,110,109,109,108]}
};

// used in Fasttracker - Amiga frequency mode
var FTNOTEPERIOD = {
	None  : {name: "---"},
	C0: {name: "C-0",period: 6848},
	Cs0: {name: "C#0",period: 6464},
	D0: {name: "D-0",period: 6096},
	Ds0: {name: "D#0",period: 5760},
	E0: {name: "E-0",period: 5424},
	F0: {name: "F-0",period: 5120},
	Fs0: {name: "F#0",period: 4832},
	G0: {name: "G-0",period: 4560},
	Gs0: {name: "G#0",period: 4304},
	A0: {name: "A-0",period: 4064},
	As0: {name: "A#0",period: 3840},
	B0: {name: "B-0",period: 3624},
	C1: {name: "C-1",period: 3424},
	Cs1: {name: "C#1",period: 3232},
	D1: {name: "D-1",period: 3048},
	Ds1: {name: "D#1",period: 2880},
	E1: {name: "E-1",period: 2712},
	F1: {name: "F-1",period: 2560},
	Fs1: {name: "F#1",period: 2416},
	G1: {name: "G-1",period: 2280},
	Gs1: {name: "G#1",period: 2152},
	A1: {name: "A-1",period: 2032},
	As1: {name: "A#1",period: 1920},
	B1: {name: "B-1",period: 1812},
	C2: {name: "C-2",period: 1712},
	Cs2: {name: "C#2",period: 1616},
	D2: {name: "D-2",period: 1524},
	Ds2: {name: "D#2",period: 1440},
	E2: {name: "E-2",period: 1356},
	F2: {name: "F-2",period: 1280},
	Fs2: {name: "F#2",period: 1208},
	G2: {name: "G-2",period: 1140},
	Gs2: {name: "G#2",period: 1076},
	A2: {name: "A-2",period: 1016},
	As2: {name: "A#2",period: 960},
	B2: {name: "B-2",period: 906},
	C3: {name: "C-3",period: 856},
	Cs3: {name: "C#3",period: 808},
	D3: {name: "D-3",period: 762},
	Ds3: {name: "D#3",period: 720},
	E3: {name: "E-3",period: 678},
	F3: {name: "F-3",period: 640},
	Fs3: {name: "F#3",period: 604},
	G3: {name: "G-3",period: 570},
	Gs3: {name: "G#3",period: 538},
	A3: {name: "A-3",period: 508},
	As3: {name: "A#3",period: 480},
	B3: {name: "B-3",period: 453},
	C4: {name: "C-4",period: 428},
	Cs4: {name: "C#4",period: 404},
	D4: {name: "D-4",period: 381},
	Ds4: {name: "D#4",period: 360},
	E4: {name: "E-4",period: 339},
	F4: {name: "F-4",period: 320},
	Fs4: {name: "F#4",period: 302},
	G4: {name: "G-4",period: 285},
	Gs4: {name: "G#4",period: 269},
	A4: {name: "A-4",period: 254},
	As4: {name: "A#4",period: 240},
	B4: {name: "B-4",period: 226.5,modPeriod: 226},
	C5: {name: "C-5",period: 214},
	Cs5: {name: "C#5",period: 202},
	D5: {name: "D-5",period: 190.5,modPeriod: 190},
	Ds5: {name: "D#5",period: 180},
	E5: {name: "E-5",period: 169.5,modPeriod: 170},
	F5: {name: "F-5",period: 160},
	Fs5: {name: "F#5",period: 151},
	G5: {name: "G-5",period: 142.5,modPeriod: 143},
	Gs5: {name: "G#5",period: 134.5,modPeriod: 135},
	A5: {name: "A-5",period: 127},
	As5: {name: "A#5",period: 120},
	B5: {name: "B-5",period: 113.25,modPeriod: 113},
	C6: {name: "C-6",period: 107},
	Cs6: {name: "C#6",period: 101},
	D6: {name: "D-6",period: 95.25,modPeriod: 95},
	Ds6: {name: "D#6",period: 90},
	E6: {name: "E-6",period: 84.75,modPeriod: 85},
	F6: {name: "F-6",period: 80},
	Fs6: {name: "F#6",period: 75.5,modPeriod: 75},
	G6: {name: "G-6",period: 71.25,modPeriod: 71},
	Gs6: {name: "G#6",period: 67.25,modPeriod: 67},
	A6: {name: "A-6",period: 63.5,modPeriod: 63},
	As6: {name: "A#6",period: 60},
	B6: {name: "B-6",period: 56.625,modPeriod: 56},
	C7: {name: "C-7",period: 53.5,modPeriod: 53},
	Cs7: {name: "C#7",period: 50.5,modPeriod: 50},
	D7: {name: "D-7",period: 47.625,modPeriod: 47},
	Ds7: {name: "D#7",period: 45},
	E7: {name: "E-7",period: 42.375,modPeriod: 42},
	F7: {name: "F-7",period: 40},
	Fs7: {name: "F#7",period: 37.75,modPeriod: 37},
	G7: {name: "G-7",period: 35.625,modPeriod: 35},
	Gs7: {name: "G#7",period: 33.625,modPeriod: 33},
	A7: {name: "A-7",period: 31.75,modPeriod: 31},
	As7: {name: "A#7",period: 30},
	B7: {name: "B-7",period: 28.3125,modPeriod: 28},


	// not used in fileformat but can be played through transposed notes
	C8: {name: "C-8",period: 26.75},
	Cs8: {name: "C#8",period: 25.25},
	D8: {name: "D-8",period: 23.8125},
	Ds8: {name: "D#8",period: 22.5},
	E8: {name: "E-8",period: 21.1875},
	F8: {name: "F-8",period: 20},
	Fs8: {name: "F#8",period: 18.875},
	G8: {name: "G-8",period: 17.8125},
	Gs8: {name: "G#8",period: 16.8125},
	A8: {name: "A-8",period: 15.875},
	As8: {name: "A#8",period: 15},
	B8: {name: "B-8",period: 14.15625},
	C9: {name: "C-9",period: 13.375},
	Cs9: {name: "C#9",period: 12.625},
	D9: {name: "D-9",period: 11.90625},
	Ds9: {name: "D#9",period: 11.25},
	E9: {name: "E-9",period: 10.59375},
	F9: {name: "F-9",period: 10},
	Fs9: {name: "F#9",period: 9.4375},
	G9: {name: "G-9",period: 8.90625},
	Gs9: {name: "G#9",period: 8.40625},
	A9: {name: "A-9",period: 7.9375},
	As9: {name: "A#9",period: 7.5},
	B9: {name: "B-9",period: 7.078125},
	C10: {name: "C-10",period: 6.6875},
	Cs10: {name: "C#10",period: 6.3125},
	D10: {name: "D-10",period: 5.953125},
	Ds10: {name: "D#10",period: 5.625},
	E10: {name: "E-10",period: 5.296875},
	F10: {name: "F-10",period: 5},
	Fs10: {name: "F#10",period: 4.71875},
	G10: {name: "G-10",period: 4.453125},
	Gs10: {name: "G#10",period: 4.203125},
	A10: {name: "A-10",period: 3.96875},
	As10: {name: "A#10",period: 3.75},
	B10: {name: "B-10",period: 3.5390625},
	C11: {name: "C-11",period: 3.34375},
	Cs11: {name: "C#11",period: 3.15625},
	D11: {name: "D-11",period: 2.9765625},
	Ds11: {name: "D#11",period: 2.8125},
	E11: {name: "E-11",period: 2.6484375},
	F11: {name: "F-11",period: 2.5},
	Fs11: {name: "F#11",period: 2.359375},
	G11: {name: "G-11",period: 2.2265625},
	Gs11: {name: "G#11",period: 2.1015625},
	A11: {name: "A-11",period: 1.984375},
	As11: {name: "A#11",period: 1.875},
	B11: {name: "B-11",period: 1.76953125},

	OFF : {name: "OFF",period:0}
};

var NOTEOFF = 145;

var KEYBOARDKEYS = {
    OFF: 0,
	C: 1,
	Csharp: 2,
	D: 3,
	Dsharp: 4,
	E: 5,
	F: 6,
	Fsharp: 7,
	G: 8,
	Gsharp: 9,
	A: 10,
	Asharp: 11,
	B: 12,
	COctaveUp: 13,
	CsharpOctaveUp: 14,
	DOctaveUp: 15,
	DsharpOctaveUp: 16,
	EOctaveUp: 17,
	FOctaveUp: 18,
	FsharpOctaveUp: 19,
	GOctaveUp: 20,
	GsharpOctaveUp: 21,
	AOctaveUp: 22,
	AsharpOctaveUp: 23,
	BOctaveUp: 24,
	COctaveUp2: 25,
	CsharpOctaveUp2: 26,
	DOctaveUp2: 27
};

var OCTAVENOTES = {
    0: {name: "OFF"},
	1: {name: "C"},
	2: {name: "Cs"},
    3: {name: "D"},
    4: {name: "Ds"},
    5: {name: "E"},
    6: {name: "F"},
	7: {name: "Fs"},
    8: {name: "G"},
    9: {name: "Gs"},
    10: {name: "A"},
    11: {name: "As"},
    12: {name: "B"}
};


var KEYBOARDTABLE = {
	azerty:{
		a: KEYBOARDKEYS.COctaveUp,
		z: KEYBOARDKEYS.DOctaveUp,
		e: KEYBOARDKEYS.EOctaveUp,
		r: KEYBOARDKEYS.FOctaveUp,
		t: KEYBOARDKEYS.GOctaveUp,
		y: KEYBOARDKEYS.AOctaveUp,
		u: KEYBOARDKEYS.BOctaveUp,
		i: KEYBOARDKEYS.COctaveUp2,
		o: KEYBOARDKEYS.DOctaveUp2,

		"é": KEYBOARDKEYS.CsharpOctaveUp,
		'"': KEYBOARDKEYS.DsharpOctaveUp,
		"(": KEYBOARDKEYS.FsharpOctaveUp,
		"§": KEYBOARDKEYS.GsharpOctaveUp,
		"è": KEYBOARDKEYS.AsharpOctaveUp,
		"ç": KEYBOARDKEYS.CsharpOctaveUp2,

		w: KEYBOARDKEYS.C,
		x: KEYBOARDKEYS.D,
		c: KEYBOARDKEYS.E,
		v: KEYBOARDKEYS.F,
		b: KEYBOARDKEYS.G,
		n: KEYBOARDKEYS.A,
		",": KEYBOARDKEYS.B,
		";": KEYBOARDKEYS.COctaveUp,
		":": KEYBOARDKEYS.DOctaveUp,

		s: KEYBOARDKEYS.Csharp,
		d: KEYBOARDKEYS.Dsharp,
		g: KEYBOARDKEYS.Fsharp,
		h: KEYBOARDKEYS.Gsharp,
		j: KEYBOARDKEYS.Asharp,

		"<": KEYBOARDKEYS.OFF
	},
	dvorak:{
		"\'": KEYBOARDKEYS.COctaveUp,
		',': KEYBOARDKEYS.DOctaveUp,
		'.': KEYBOARDKEYS.EOctaveUp,
		p: KEYBOARDKEYS.FOctaveUp,
		y: KEYBOARDKEYS.GOctaveUp,
		f: KEYBOARDKEYS.AOctaveUp,
		g: KEYBOARDKEYS.BOctaveUp,
		c: KEYBOARDKEYS.COctaveUp2,
		r: KEYBOARDKEYS.DOctaveUp2,

		"2": KEYBOARDKEYS.CsharpOctaveUp,
		'3': KEYBOARDKEYS.DsharpOctaveUp,
		"5": KEYBOARDKEYS.FsharpOctaveUp,
		"6": KEYBOARDKEYS.GsharpOctaveUp,
		"7": KEYBOARDKEYS.AsharpOctaveUp,
		"9": KEYBOARDKEYS.CsharpOctaveUp2,

		';': KEYBOARDKEYS.C,
		q: KEYBOARDKEYS.D,
		j: KEYBOARDKEYS.E,
		k: KEYBOARDKEYS.F,
		x: KEYBOARDKEYS.G,
		b: KEYBOARDKEYS.A,
		m: KEYBOARDKEYS.B,
		w: KEYBOARDKEYS.COctaveUp,
		v: KEYBOARDKEYS.DOctaveUp,

		o: KEYBOARDKEYS.Csharp,
		e: KEYBOARDKEYS.Dsharp,
		i: KEYBOARDKEYS.Fsharp,
		d: KEYBOARDKEYS.Gsharp,
		h: KEYBOARDKEYS.Asharp,
		n: KEYBOARDKEYS.CsharpOctaveUp,

        "\\": KEYBOARDKEYS.OFF
	},
	qwerty:{
		q: KEYBOARDKEYS.COctaveUp,
		w: KEYBOARDKEYS.DOctaveUp,
		e: KEYBOARDKEYS.EOctaveUp,
		r: KEYBOARDKEYS.FOctaveUp,
		t: KEYBOARDKEYS.GOctaveUp,
		y: KEYBOARDKEYS.AOctaveUp,
		u: KEYBOARDKEYS.BOctaveUp,
		i: KEYBOARDKEYS.COctaveUp2,
		o: KEYBOARDKEYS.DOctaveUp2,

		"2": KEYBOARDKEYS.CsharpOctaveUp,
		'3': KEYBOARDKEYS.DsharpOctaveUp,
		"5": KEYBOARDKEYS.FsharpOctaveUp,
		"6": KEYBOARDKEYS.GsharpOctaveUp,
		"7": KEYBOARDKEYS.AsharpOctaveUp,
		"9": KEYBOARDKEYS.CsharpOctaveUp2,

		z: KEYBOARDKEYS.C,
		x: KEYBOARDKEYS.D,
		c: KEYBOARDKEYS.E,
		v: KEYBOARDKEYS.F,
		b: KEYBOARDKEYS.G,
		n: KEYBOARDKEYS.A,
		m: KEYBOARDKEYS.B,
		",": KEYBOARDKEYS.COctaveUp,
		".": KEYBOARDKEYS.DOctaveUp,

		s: KEYBOARDKEYS.Csharp,
		d: KEYBOARDKEYS.Dsharp,
		g: KEYBOARDKEYS.Fsharp,
		h: KEYBOARDKEYS.Gsharp,
		j: KEYBOARDKEYS.Asharp,

        "\\": KEYBOARDKEYS.OFF
	},
	qwertz:{
		q: KEYBOARDKEYS.COctaveUp,
		w: KEYBOARDKEYS.DOctaveUp,
		e: KEYBOARDKEYS.EOctaveUp,
		r: KEYBOARDKEYS.FOctaveUp,
		t: KEYBOARDKEYS.GOctaveUp,
		z: KEYBOARDKEYS.AOctaveUp,
		u: KEYBOARDKEYS.BOctaveUp,
		i: KEYBOARDKEYS.COctaveUp2,
		o: KEYBOARDKEYS.DOctaveUp2,

		"2": KEYBOARDKEYS.CsharpOctaveUp,
		'3': KEYBOARDKEYS.DsharpOctaveUp,
		"5": KEYBOARDKEYS.FsharpOctaveUp,
		"6": KEYBOARDKEYS.GsharpOctaveUp,
		"7": KEYBOARDKEYS.AsharpOctaveUp,
		"9": KEYBOARDKEYS.CsharpOctaveUp2,

		y: KEYBOARDKEYS.C,
		x: KEYBOARDKEYS.D,
		c: KEYBOARDKEYS.E,
		v: KEYBOARDKEYS.F,
		b: KEYBOARDKEYS.G,
		n: KEYBOARDKEYS.A,
		m: KEYBOARDKEYS.B,
		",": KEYBOARDKEYS.COctaveUp,
		".": KEYBOARDKEYS.DOctaveUp,

		s: KEYBOARDKEYS.Csharp,
		d: KEYBOARDKEYS.Dsharp,
		g: KEYBOARDKEYS.Fsharp,
		h: KEYBOARDKEYS.Gsharp,
		j: KEYBOARDKEYS.Asharp,

        "\\": KEYBOARDKEYS.OFF
	}
};

var TRACKERMODE = {
	PROTRACKER: 1,
	FASTTRACKER: 2
};

var SETTINGS = {
	unrollLoops: false,
	unrollShortLoops: false, // Note: the conversion between byte_length loops (amiga) and time-based loops (Web Audio) is not 100% accurate for very short loops
	sustainKeyboardNotes: false,
	useHover:true,
	keyboardTable: "qwerty",
	vubars: true,
	stereoSeparation: STEREOSEPARATION.BALANCED,
	emulateProtracker1OffsetBug: true,
	loadInitialFile:true
};;
var EventBus = (function() {

    var allEventHandlers = {};

    var me = {};

    me.on = function(event, listener) {
        var eventHandlers = allEventHandlers[event];
        if (!eventHandlers) {
            eventHandlers = [];
            allEventHandlers[event] = eventHandlers;
        }
        eventHandlers.push(listener);
        return eventHandlers.length;
    };
    
    me.off = function(event,index){
        var eventHandlers = allEventHandlers[event];
        if (eventHandlers) eventHandlers[index-1]=undefined;
    }

    me.trigger = function(event, context) {
        var eventHandlers = allEventHandlers[event];
        if (eventHandlers) {
            var i, len = eventHandlers.length;
            for (i = 0; i < len; i++) {
                if (eventHandlers[i]) eventHandlers[i](context,event);
            }
        }
    };

    return me;
}());
;
function loadFile(url,next) {
    var req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onload = function (event) {
        var arrayBuffer = req.response;
        if (arrayBuffer && req.status === 200) {
            if (next) next(arrayBuffer);
        } else {
            console.error("unable to load", url);
            // do not call if player only
            if (typeof Editor !== "undefined") {
              if (next) next(false);
            }
        }
    };
    req.send(null);
}

function saveFile(b,filename){
	//<!--
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    url = window.URL.createObjectURL(b);
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
	//-->
}

function BinaryStream(arrayBuffer, bigEndian){
	var obj = {
		index: 0,
		litteEndian : !bigEndian
	};

	obj.goto = function(value){
		setIndex(value);
	};

	obj.jump = function(value){
		this.goto(this.index + value);
	};

	obj.readByte = function(position){
		setIndex(position);
		var b = this.dataView.getInt8(this.index);
		this.index++;
		return b;
	};

	obj.writeByte = function(value,position){
		setIndex(position);
		this.dataView.setInt8(this.index,value);
		this.index++;
	};

	obj.readUbyte = function(position){
		setIndex(position);
		var b = this.dataView.getUint8(this.index);
		this.index++;
		return b;
	};

	obj.writeUByte = function(value,position){
		setIndex(position);
		this.dataView.setUint8(this.index,value);
		this.index++;
	};

	obj.readUint = function(position){
		setIndex(position);
		var i = this.dataView.getUint32(this.index,this.litteEndian);
		this.index+=4;
		return i;
	};

	obj.writeUint = function(value,position){
		setIndex(position);
		this.dataView.setUint32(this.index,value,this.litteEndian);
		this.index+=4;
	};

	obj.readBytes = function(len,position) {
		setIndex(position);
		var buffer = new Uint8Array(len);
		var i = this.index;
		var src = this.dataView;
		if ((len += i) > this.length) len = this.length;
		var offset = 0;

		for (; i < len; ++i)
			buffer.setUint8(offset++, this.dataView.getUint8(i));
		this.index = len;
		return buffer;
	};

	obj.readString = function(len,position){
		setIndex(position);
		var i = this.index;
		var src = this.dataView;
		var text = "";

		if ((len += i) > this.length) len = this.length;

		for (; i < len; ++i){
			var c = src.getUint8(i);
			if (c == 0) break;
			text += String.fromCharCode(c);
		}

		this.index = len;
		return text;
	};

	obj.writeString = function(value,position){
		setIndex(position);
		var src = this.dataView;
		var len = value.length;
		for (var i = 0; i < len; i++) src.setUint8(this.index + i,value.charCodeAt(i));
		this.index += len;
	};

	obj.writeStringSection = function(value,max,paddValue,position){
		setIndex(position);
		max = max || 1;
		value = value || "";
		paddValue = paddValue || 0;
		var len = value.length;
		if (len>max) value = value.substr(0,max);
		obj.writeString(value);
		obj.fill(paddValue,max-len);
	};

	// same as readUshort
	obj.readWord = function(position){
		setIndex(position);
		var w = this.dataView.getUint16(this.index, this.litteEndian);
		this.index += 2;
		return w;
	};

	obj.writeWord = function(value,position){
		setIndex(position);
		this.dataView.setUint16(this.index,value,this.litteEndian);
		this.index += 2;
	};

	obj.readLong = obj.readDWord = obj.readUint;
	obj.writeLong = obj.writeDWord = obj.writeUint;

	obj.readShort = function(value,position){
		setIndex(position);
		var w = this.dataView.getInt16(this.index, this.litteEndian);
		this.index += 2;
		return w;
	};

	obj.clear = function(length){
		obj.fill(0,length);
	};

	obj.fill = function(value,length){
		value = value || 0;
		length = length || 0;
		for (var i = 0; i<length; i++){
			obj.writeByte(value);
		}
	};

	obj.isEOF = function(margin){
		margin = margin || 0;
		return this.index >= (this.length-margin);
	};

	function setIndex(value){
		value = value === 0 ? value : value || obj.index;
		if (value<0) value = 0;
		if (value >= obj.length) value = obj.length-1;

		obj.index = value;
	}

  if (arrayBuffer) {
    obj.buffer = arrayBuffer;
    obj.dataView = new DataView(arrayBuffer);
    obj.length = arrayBuffer.byteLength;
  }

	return obj;
}
;
var Audio = (function(){
    var me = {};

    window.AudioContext = window.AudioContext||window.webkitAudioContext;
    window.OfflineAudioContext = window.OfflineAudioContext||window.webkitOfflineAudioContext;

    var context;
    var masterVolume;
    var cutOffVolume;
    var lowPassfilter;
    var i;
    var filterChains = [];
    var isRecording;
    var recordingAvailable;
    var mediaRecorder;
    var recordingChunks = [];
    var offlineContext;
    var onlineContext;
    var currentStereoSeparation = STEREOSEPARATION.BALANCED;
    var lastMasterVolume = 0;
    var usePanning;
    var hasUI;
    var scheduledNotes = [[],[],[]];
    var scheduledNotesBucket = 0;
    var prevSampleRate = 4143.569;

    var filters = {
        volume: true,
        panning: true,
        high: true,
        mid: true,
        low: true,
        lowPass : true,
        reverb: true,
        distortion: false
    };

    var isRendering = false;

    function createAudioConnections(audioContext,destination){

        cutOffVolume = audioContext.createGain();
        cutOffVolume.gain.setValueAtTime(1,0);

        // Haas effect stereo expander
        var useStereoExpander = false;
        if (useStereoExpander){
            var splitter = audioContext.createChannelSplitter(2);
            var merger = audioContext.createChannelMerger(2);
            var haasDelay = audioContext.createDelay(1);
            cutOffVolume.connect(splitter);
            splitter.connect(haasDelay, 0);
            haasDelay.connect(merger, 0, 0);
            splitter.connect(merger, 1, 1);
            merger.connect(destination || audioContext.destination);
            window.haasDelay = haasDelay;
        }else{
            cutOffVolume.connect(destination || audioContext.destination);
        }







        masterVolume = audioContext.createGain();
        masterVolume.connect(cutOffVolume);
        me.setMasterVolume(1);

        lowPassfilter = audioContext.createBiquadFilter();
        lowPassfilter.type = "lowpass";
        lowPassfilter.frequency.setValueAtTime(20000,0);

        lowPassfilter.connect(masterVolume);

        me.masterVolume = masterVolume;
        me.cutOffVolume = cutOffVolume;
        me.lowPassfilter = lowPassfilter;
    }

    if (AudioContext){
        context = new AudioContext();
    }

    me.init = function(audioContext,destination){

        audioContext = audioContext || context;
        context = audioContext;
        me.context = context;
        if (!audioContext) return;

        usePanning = !!Audio.context.createStereoPanner;
        if (!usePanning){
            console.warn("Warning: Your browser does not support StereoPanners ... all mods will be played in mono!")
        }
        hasUI = typeof Editor !== "undefined";

        createAudioConnections(audioContext,destination);

        var numberOfTracks = Tracker.getTrackCount();
        filterChains = [];

        function addFilterChain(){
            var filterChain = FilterChain(filters);
            filterChain.output().connect(lowPassfilter);
            filterChains.push(filterChain);
        }

        for (i = 0; i<numberOfTracks;i++)addFilterChain();

        me.filterChains = filterChains;
		me.usePanning = usePanning;

        if (!isRendering){
            EventBus.on(EVENT.trackStateChange,function(state){
                if (typeof state.track != "undefined" && filterChains[state.track]){
                    filterChains[state.track].volumeValue(state.mute?0:70);
                }
            });


			EventBus.on(EVENT.trackCountChange,function(trackCount){
				for (i = filterChains.length; i<trackCount;i++)addFilterChain();
				EventBus.trigger(EVENT.filterChainCountChange,trackCount);
				me.setStereoSeparation(currentStereoSeparation);
			});

			EventBus.on(EVENT.trackerModeChanged,function(mode){
				me.setStereoSeparation();
			});
        }
    };


    me.enable = function(){
        cutOffVolume.gain.setValueAtTime(1,0);
        me.cutOff = false;
    };

    me.disable = function(){
        cutOffVolume.gain.setValueAtTime(0,0);
        me.cutOff = true;

        var totalNotes = 0;
		scheduledNotes.forEach(function(bucket,index){
			totalNotes += bucket.length;
		    bucket.forEach(function(volume){
		        volume.gain.cancelScheduledValues(0);
		        volume.gain.setValueAtTime(0,0);
			});
			scheduledNotes[index] = [];
        });

        if (totalNotes) console.log(totalNotes + " cleared");
    };

    me.checkState = function(){
        if (context){
            if (context.state === "suspended" && context.resume){
                console.warn("Audio context is suspended - trying to resume");
                context.resume();
            }
        }
    };


    me.playSample = function(index,period,volume,track,effects,time,noteIndex){

        var audioContext;
        if (isRendering){
            audioContext = offlineContext;
        }else{
            audioContext = context;
            me.enable();
        }

		period = period || 428; // C-3
        if (typeof track === "undefined") track = (hasUI ? Editor.getCurrentTrack() : 0);
		time = time || context.currentTime;

        if (noteIndex === NOTEOFF){
            volume = 0; // note off
        }

        var instrument = Tracker.getInstrument(index);
        var basePeriod = period;
		var volumeEnvelope;
		var panningEnvelope;
		var scheduled;
		var pan = 0;

		if (instrument){
            var sampleBuffer;
            var offset = 0;
            var sampleLength = 0;

            volume = typeof volume === "undefined" ? (100*instrument.sample.volume/64) : volume;

            pan = (instrument.sample.panning || 0) / 128;

			var sampleRate;

			// apply finetune
			if (Tracker.inFTMode()){
                if (Tracker.useLinearFrequency){
					period -= instrument.getFineTune()/2;
				}else{
					if (instrument.getFineTune()){
						period = me.getFineTuneForNote(noteIndex,instrument.getFineTune());
					}
                }
            }else{
                // protracker frequency
				if (instrument.getFineTune()){
					period = me.getFineTuneForPeriod(period,instrument.getFineTune());
				}
            }

            sampleRate = me.getSampleRateForPeriod(period);
            var initialPlaybackRate = 1;

            if (instrument.sample.data.length) {
                sampleLength = instrument.sample.data.length;
                if (effects && effects.offset){
                    if (effects.offset.value>=sampleLength) effects.offset.value = sampleLength-1;
                    offset = effects.offset.value/audioContext.sampleRate; // in seconds
                }
                // note - on safari you can't set a different samplerate?
                sampleBuffer = audioContext.createBuffer(1, sampleLength,audioContext.sampleRate);
                initialPlaybackRate = sampleRate / audioContext.sampleRate;
            }else {
                // empty samples are often used to cut of the previous instrument
                sampleBuffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
                offset = 0;
            }
            var buffering = sampleBuffer.getChannelData(0);
            for(i=0; i < sampleLength; i++) {
                buffering[i] = instrument.sample.data[i];
            }

			prevSampleRate = sampleRate;
            var source = audioContext.createBufferSource();
            source.buffer = sampleBuffer;

            var volumeGain = audioContext.createGain();
            volumeGain.gain.value = volume/100;
			volumeGain.gain.setValueAtTime(volume/100,time);

            if (instrument.sample.loop.enabled && instrument.sample.loop.length>2){

                if (!SETTINGS.unrollLoops){

                    source.loop = true;
                    // in seconds ...
                    source.loopStart = instrument.sample.loop.start/audioContext.sampleRate;
                    source.loopEnd = (instrument.sample.loop.start + instrument.sample.loop.length)/audioContext.sampleRate;
                    //audioContext.sampleRate = samples/second
                }
            }

            if (instrument.volumeEnvelope.enabled || instrument.panningEnvelope.enabled || instrument.hasVibrato()){

            	var envelopes = instrument.noteOn(time);
            	var target = source;

            	if (envelopes.volume){
					volumeEnvelope = envelopes.volume;
					source.connect(volumeEnvelope);
					target = volumeEnvelope;
				}

				if (envelopes.panning){
					panningEnvelope = envelopes.panning;
					target.connect(panningEnvelope);
					target = panningEnvelope;
				}

				scheduled = envelopes.scheduled;

				target.connect(volumeGain);

            }else{
                source.connect(volumeGain);
            }

			var volumeFadeOut = Audio.context.createGain();
			volumeFadeOut.gain.setValueAtTime(0,time);
			volumeFadeOut.gain.linearRampToValueAtTime(1,time + 0.01);
			volumeGain.connect(volumeFadeOut);

			if (usePanning){
				var panning = Audio.context.createStereoPanner();
				panning.pan.setValueAtTime(pan,time);
				volumeFadeOut.connect(panning);
				panning.connect(filterChains[track].input());
            }else{

				/* 
				Note: a pannernode would work too but this doesn't have a "setPositionInTime" method
				Making it a bit useless
				panning = Audio.context.createPanner();
				panning.panningModel = 'equalpower';
				panning.setPosition(pan, 0, 1 - Math.abs(pan));
				*/
				
				volumeFadeOut.connect(filterChains[track].input());
            }


            source.playbackRate.value = initialPlaybackRate;
            var sourceDelayTime = 0;
            var playTime = time + sourceDelayTime;

            source.start(playTime,offset);
            var result = {
                source: source,
                volume: volumeGain,
                panning: panning,
				volumeEnvelope: volumeEnvelope,
				panningEnvelope: panningEnvelope,
				volumeFadeOut: volumeFadeOut,
                startVolume: volume,
                currentVolume: volume,
                startPeriod: period,
                basePeriod: basePeriod,
                noteIndex: noteIndex,
                startPlaybackRate: initialPlaybackRate,
                sampleRate: sampleRate,
                instrumentIndex: index,
                effects: effects,
                track: track,
                time: time,
				scheduled: scheduled
            };

			scheduledNotes[scheduledNotesBucket].push(volumeGain);

            if (!isRendering) EventBus.trigger(EVENT.samplePlay,result);

            return result;
        }

        return {};
    };

    me.playSilence = function(){
        // used to activate Audio engine on first touch in IOS and Android devices
        if (context){
            var source = context.createBufferSource();
            source.connect(masterVolume);
            try{
            	source.start();
			}catch (e){
            	console.error(e);
			}
        }
    };

	me.playRaw = function(data,sampleRate){
		// used to loose snippets of samples (ranges etc)
		if (context && data && data.length){
			var sampleBuffer;
			sampleBuffer = context.createBuffer(1,data.length,context.sampleRate);
			var initialPlaybackRate = sampleRate / audioContext.sampleRate;
			var source = context.createBufferSource();
			source.buffer = sampleBuffer;
			source.loop = true;
			source.playbackRate.value = initialPlaybackRate;
			source.connect(masterVolume);
			source.start();
		}
	};

    //<!--
    me.isRecording = function(){
        return isRecording;
    };

    me.startRecording = function(){
        if (!isRecording){

            if (context && context.createMediaStreamDestination){
                var dest = context.createMediaStreamDestination();
                mediaRecorder = new MediaRecorder(dest.stream);

                mediaRecorder.ondataavailable = function(evt) {
                    // push each chunk (blobs) in an array
                    recordingChunks.push(evt.data);
                };

                mediaRecorder.onstop = function(evt) {
                    var blob = new Blob(recordingChunks, { 'type' : 'audio/ogg; codecs=opus' });
                    saveAs(blob,"recording.opus");
                    //document.querySelector("audio").src = URL.createObjectURL(blob);
                };


                masterVolume.connect(dest);
                mediaRecorder.start();
                isRecording = true;

            }else{
                console.error("recording is not supported on this browser");
            }

        }
    };

    me.stopRecording = function(){
        if (isRecording){
            isRecording = false;
            mediaRecorder.stop();
        }
    };

    me.startRendering = function(length){
        isRendering = true;

        console.log("startRendering " + length);
        offlineContext = new OfflineAudioContext(2,44100*length,44100);
        onlineContext = context;
        me.context = offlineContext;
        me.init(offlineContext);
    };

    me.stopRendering = function(next){
        isRendering = false;

        offlineContext.startRendering().then(function(renderedBuffer) {
            console.log('Rendering completed successfully');
            if (next) next(renderedBuffer);
        }).catch(function(err) {
            console.log('Rendering failed: ' + err);
            // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
        });


        // switch back to online Audio context;
        me.context = onlineContext;
        createAudioConnections(onlineContext);
        me.init(onlineContext);
    };
    //-->

    me.setStereoSeparation = function(value){

		var panAmount;
		var numberOfTracks = Tracker.getTrackCount();

    	if (Tracker.inFTMode()){
    		panAmount = 0;
		}else{
			value = value || currentStereoSeparation;
			currentStereoSeparation = value;

			switch(value){
				case STEREOSEPARATION.NONE:
					// mono, no panning
					panAmount = 0;
					SETTINGS.stereoSeparation = STEREOSEPARATION.NONE;
					break;
				case STEREOSEPARATION.FULL:
					// Amiga style: pan even channels hard to the left, uneven to the right;
					panAmount = 1;
					SETTINGS.stereoSeparation = STEREOSEPARATION.FULL;
					break;
				default:
					// balanced: pan even channels somewhat to the left, uneven to the right;
					panAmount = 0.5;
					SETTINGS.stereoSeparation = STEREOSEPARATION.BALANCED;
					break;
			}
		}

        for (i = 0; i<numberOfTracks;i++){
            var filter = filterChains[i];
            if (filter) filter.panningValue((i%4===0)||(i%4===3) ? -panAmount : panAmount);
        }
    };

    me.getPrevSampleRate = function(){
    	return prevSampleRate;
	};

    me.context = context;

    function createPingPongDelay(){

        // example of delay effect.
        //Taken from http://stackoverflow.com/questions/20644328/using-channelsplitter-and-mergesplitter-nodes-in-web-audio-api

        var delayTime = 0.12;
        var feedback = 0.3;

        var merger = context.createChannelMerger(2);
        var leftDelay = context.createDelay();
        var rightDelay = context.createDelay();
        var leftFeedback = context.createGain();
        var rightFeedback = context.createGain();
        var splitter = context.createChannelSplitter(2);


        splitter.connect( leftDelay, 0 );
        splitter.connect( rightDelay, 1 );

        leftDelay.delayTime.value = delayTime;
        rightDelay.delayTime.value = delayTime;

        leftFeedback.gain.value = feedback;
        rightFeedback.gain.value = feedback;

        // Connect the routing - left bounces to right, right bounces to left.
        leftDelay.connect(leftFeedback);
        leftFeedback.connect(rightDelay);

        rightDelay.connect(rightFeedback);
        rightFeedback.connect(leftDelay);

        // Re-merge the two delay channels into stereo L/R
        leftFeedback.connect(merger, 0, 0);
        rightFeedback.connect(merger, 0, 1);

        // Now connect your input to "splitter", and connect "merger" to your output destination.

        return{
            splitter: splitter,
            merger: merger
        }
    }

    /**

     get a new AudioNode playing at x semitones from the root note
     // used to create Chords and Arpeggio

     @param {audioNode} source: audioBuffer of the root note
     @param {Number} root: period of the root note
     @param {Number} semitones: amount of semitones from the root note
     @param {Number} finetune: finetune value of the base instrument
     @return {audioNode} audioBuffer of the new note
     */
    function semiTonesFrom(source,root,semitones,finetune){
        var target;

        target = context.createBufferSource();
        target.buffer = source.buffer;

        if (semitones){
            var rootNote = periodNoteTable[root];
            var rootIndex = noteNames.indexOf(rootNote.name);
            var targetName = noteNames[rootIndex+semitones];
            if (targetName){
                var targetNote = nameNoteTable[targetName];
                if (targetNote){
                    target.playbackRate.value = (rootNote.period/targetNote.period) * source.playbackRate.value;
                }
            }
        }else{
            target.playbackRate.value = source.playbackRate.value
        }

        return target;

    }

    me.getSemiToneFrom = function(period,semitones,finetune){
        var result = period;
        if (finetune) {
            period = me.getFineTuneBasePeriod(period,finetune);
            if (!period){
                period = result;
                console.error("ERROR: base period for finetuned " + finetune + " period " + period + " not found");
            }
        }

        if (semitones){
            var rootNote = periodNoteTable[period];
            if (rootNote){
                var rootIndex = noteNames.indexOf(rootNote.name);
                var targetName = noteNames[rootIndex+semitones];
                if (targetName){
                    var targetNote = nameNoteTable[targetName];
                    if (targetNote){
                        result = targetNote.period;
                        if (finetune) {result = me.getFineTuneForPeriod(result,finetune)}
                    }
                }
            }else{
                console.error("ERROR: note for period " + period + " not found");
                // note: this can happen when the note is in a period slide
                // FIXME
            }
        }
        return result;
    };

    me.getNearestSemiTone = function(period,instrumentIndex){
        var tuning = 8;
        if (instrumentIndex){
            var instrument = Tracker.getInstrument(instrumentIndex);
            if (instrument && instrument.sample.finetune) tuning = tuning + instrument.sample.finetune;
        }

        var minDelta = 100000;
        var result = period;
        for (var note in NOTEPERIOD){
            if (NOTEPERIOD.hasOwnProperty(note)){
                var p = NOTEPERIOD[note].tune[tuning];
                var delta = Math.abs(p - period);
                if (delta<minDelta) {
                    minDelta = delta;
                    result = p;
                }
            }
        }

        return result;
    };

    // gives the finetuned period for a base period - protracker mode
    me.getFineTuneForPeriod = function(period,finetune){
        var result = period;
        var note = periodNoteTable[period];
        if (note && note.tune){
            var centerTune = 8;
            var tune = 8 + finetune;
            if (tune>=0 && tune<note.tune.length) result = note.tune[tune];
        }

        return result;
    };

    // gives the finetuned period for a base note (Fast Tracker Mode)
    me.getFineTuneForNote = function(note,finetune){
        if (note === NOTEOFF) return 1;

        var ftNote1 = FTNotes[note];
        var ftNote2 = finetune>0 ? FTNotes[note+1] : FTNotes[note-1] ;

        if (ftNote1 && ftNote2){
            var delta = Math.abs(ftNote2.period - ftNote1.period) / 127;
            return ftNote1.period - (delta*finetune)
        }

        console.warn("unable to find finetune for note " + note,ftNote1);
		return ftNote1 ? ftNote1.period : 100000;

    };

    // gives the non-finetuned baseperiod for a finetuned period
    me.getFineTuneBasePeriod = function(period,finetune){
        var result = period;
        var table = periodFinetuneTable[finetune];
        if (table){
            result = table[period];
        }
        return result;
    };

	me.getSampleRateForPeriod = function(period){
		if (Tracker.inFTMode()){
			if (Tracker.useLinearFrequency) return (8363 * Math.pow(2,((4608 - period) / 768)));
			return PC_FREQUENCY_HALF / period;
		}
		return AMIGA_PALFREQUENCY_HALF / period;
	};

    me.limitAmigaPeriod = function(period){
        // limits the period to the allowed Amiga frequency range, between 113 (B3) and 856 (C1)

        period = Math.max(period,113);
        period = Math.min(period,856);

        return period;
    };

    me.setAmigaLowPassFilter = function(on,time){
        // note: this is determined by ear comparing a real Amiga 500 - maybe too much effect ?
        var value = on ? 2000 : 20000;
        lowPassfilter.frequency.setValueAtTime(value,time);
    };

    me.setMasterVolume = function (value,time) {
        time=time||context.currentTime;
        value = value*0.7;
        masterVolume.gain.setValueAtTime(lastMasterVolume,time);
		masterVolume.gain.linearRampToValueAtTime(value,time+0.02);
		lastMasterVolume = value;
	};

	me.slideMasterVolume = function (value,time) {
		time=time||context.currentTime;
		value = value*0.7;
		masterVolume.gain.linearRampToValueAtTime(value,time);
		lastMasterVolume = value;
	};

	me.getLastMasterVolume = function(){
		return lastMasterVolume/0.7;
	};

    me.clearScheduledNotesCache = function(){
        // 3 rotating caches
		scheduledNotesBucket++;
		if (scheduledNotesBucket>2) scheduledNotesBucket=0;
        scheduledNotes[scheduledNotesBucket] = [];
    };

    me.waveFormFunction = {
        sine: function(period,progress,freq,amp){
            return period + (Math.sin(progress * freq * 0.8) * amp * 1.7);
            // I got the impression that this formaula is more like  amp * 2 in FT2
            // in Protracker a lookuptable is used - maybe we should adopt that
        },
		saw : function(period,progress,freq,amp){
			var value = 1 - Math.abs(((progress * freq/7) % 1)); // from 1 to 0
			value = (value * 2) - 1; // from -1 to 1
			value = value * amp * -2;
			return period + value;
		},
        square : function(period,progress,freq,amp){
            var value = Math.sin(progress * freq) <= 0 ? -1 : 1;
            value = value * amp * 2;
            return period + value;
        },
		sawInverse : function(period,progress,freq,amp){
			var value = Math.abs((progress * freq/7) % 1); // from 0 to 1
			value = (value * 2) - 1; // from -1 to 1
			value = value * amp * -2;
			return period + value;
		}
    };

    return me;

}());

;
function getUrlParameter(param){
    if (window.location.getParameter){
        return window.location.getParameter(param);
    } else if (location.search) {
        var parts = location.search.substring(1).split('&');
        for (var i = 0; i < parts.length; i++) {
            var nv = parts[i].split('=');
            if (!nv[0]) continue;
            if (nv[0] == param) {
                return nv[1] || true;
            }
        }
    }
}

function formatFileSize(size){
    var unit = "k";
    if (isNaN(size)) size=0;
    size = Math.round(size/1000);
    if (size>1000){
        size = Math.round(size/100)/10;
        unit = "MB"
    }
    return size + unit;
}

//<!--
function createSlug(s){
    var latin_map={"Á":"A","Ă":"A","Ắ":"A","Ặ":"A","Ằ":"A","Ẳ":"A","Ẵ":"A","Ǎ":"A","Â":"A","Ấ":"A","Ậ":"A","Ầ":"A","Ẩ":"A","Ẫ":"A","Ä":"A","Ǟ":"A","Ȧ":"A","Ǡ":"A","Ạ":"A","Ȁ":"A","À":"A","Ả":"A","Ȃ":"A","Ā":"A","Ą":"A","Å":"A","Ǻ":"A","Ḁ":"A","Ⱥ":"A","Ã":"A","Ꜳ":"AA","Æ":"AE","Ǽ":"AE","Ǣ":"AE","Ꜵ":"AO","Ꜷ":"AU","Ꜹ":"AV","Ꜻ":"AV","Ꜽ":"AY","Ḃ":"B","Ḅ":"B","Ɓ":"B","Ḇ":"B","Ƀ":"B","Ƃ":"B","Ć":"C","Č":"C","Ç":"C","Ḉ":"C","Ĉ":"C","Ċ":"C","Ƈ":"C","Ȼ":"C","Ď":"D","Ḑ":"D","Ḓ":"D","Ḋ":"D","Ḍ":"D","Ɗ":"D","Ḏ":"D","ǲ":"D","ǅ":"D","Đ":"D","Ƌ":"D","Ǳ":"DZ","Ǆ":"DZ","É":"E","Ĕ":"E","Ě":"E","Ȩ":"E","Ḝ":"E","Ê":"E","Ế":"E","Ệ":"E","Ề":"E","Ể":"E","Ễ":"E","Ḙ":"E","Ë":"E","Ė":"E","Ẹ":"E","Ȅ":"E","È":"E","Ẻ":"E","Ȇ":"E","Ē":"E","Ḗ":"E","Ḕ":"E","Ę":"E","Ɇ":"E","Ẽ":"E","Ḛ":"E","Ꝫ":"ET","Ḟ":"F","Ƒ":"F","Ǵ":"G","Ğ":"G","Ǧ":"G","Ģ":"G","Ĝ":"G","Ġ":"G","Ɠ":"G","Ḡ":"G","Ǥ":"G","Ḫ":"H","Ȟ":"H","Ḩ":"H","Ĥ":"H","Ⱨ":"H","Ḧ":"H","Ḣ":"H","Ḥ":"H","Ħ":"H","Í":"I","Ĭ":"I","Ǐ":"I","Î":"I","Ï":"I","Ḯ":"I","İ":"I","Ị":"I","Ȉ":"I","Ì":"I","Ỉ":"I","Ȋ":"I","Ī":"I","Į":"I","Ɨ":"I","Ĩ":"I","Ḭ":"I","Ꝺ":"D","Ꝼ":"F","Ᵹ":"G","Ꞃ":"R","Ꞅ":"S","Ꞇ":"T","Ꝭ":"IS","Ĵ":"J","Ɉ":"J","Ḱ":"K","Ǩ":"K","Ķ":"K","Ⱪ":"K","Ꝃ":"K","Ḳ":"K","Ƙ":"K","Ḵ":"K","Ꝁ":"K","Ꝅ":"K","Ĺ":"L","Ƚ":"L","Ľ":"L","Ļ":"L","Ḽ":"L","Ḷ":"L","Ḹ":"L","Ⱡ":"L","Ꝉ":"L","Ḻ":"L","Ŀ":"L","Ɫ":"L","ǈ":"L","Ł":"L","Ǉ":"LJ","Ḿ":"M","Ṁ":"M","Ṃ":"M","Ɱ":"M","Ń":"N","Ň":"N","Ņ":"N","Ṋ":"N","Ṅ":"N","Ṇ":"N","Ǹ":"N","Ɲ":"N","Ṉ":"N","Ƞ":"N","ǋ":"N","Ñ":"N","Ǌ":"NJ","Ó":"O","Ŏ":"O","Ǒ":"O","Ô":"O","Ố":"O","Ộ":"O","Ồ":"O","Ổ":"O","Ỗ":"O","Ö":"O","Ȫ":"O","Ȯ":"O","Ȱ":"O","Ọ":"O","Ő":"O","Ȍ":"O","Ò":"O","Ỏ":"O","Ơ":"O","Ớ":"O","Ợ":"O","Ờ":"O","Ở":"O","Ỡ":"O","Ȏ":"O","Ꝋ":"O","Ꝍ":"O","Ō":"O","Ṓ":"O","Ṑ":"O","Ɵ":"O","Ǫ":"O","Ǭ":"O","Ø":"O","Ǿ":"O","Õ":"O","Ṍ":"O","Ṏ":"O","Ȭ":"O","Ƣ":"OI","Ꝏ":"OO","Ɛ":"E","Ɔ":"O","Ȣ":"OU","Ṕ":"P","Ṗ":"P","Ꝓ":"P","Ƥ":"P","Ꝕ":"P","Ᵽ":"P","Ꝑ":"P","Ꝙ":"Q","Ꝗ":"Q","Ŕ":"R","Ř":"R","Ŗ":"R","Ṙ":"R","Ṛ":"R","Ṝ":"R","Ȑ":"R","Ȓ":"R","Ṟ":"R","Ɍ":"R","Ɽ":"R","Ꜿ":"C","Ǝ":"E","Ś":"S","Ṥ":"S","Š":"S","Ṧ":"S","Ş":"S","Ŝ":"S","Ș":"S","Ṡ":"S","Ṣ":"S","Ṩ":"S","Ť":"T","Ţ":"T","Ṱ":"T","Ț":"T","Ⱦ":"T","Ṫ":"T","Ṭ":"T","Ƭ":"T","Ṯ":"T","Ʈ":"T","Ŧ":"T","Ɐ":"A","Ꞁ":"L","Ɯ":"M","Ʌ":"V","Ꜩ":"TZ","Ú":"U","Ŭ":"U","Ǔ":"U","Û":"U","Ṷ":"U","Ü":"U","Ǘ":"U","Ǚ":"U","Ǜ":"U","Ǖ":"U","Ṳ":"U","Ụ":"U","Ű":"U","Ȕ":"U","Ù":"U","Ủ":"U","Ư":"U","Ứ":"U","Ự":"U","Ừ":"U","Ử":"U","Ữ":"U","Ȗ":"U","Ū":"U","Ṻ":"U","Ų":"U","Ů":"U","Ũ":"U","Ṹ":"U","Ṵ":"U","Ꝟ":"V","Ṿ":"V","Ʋ":"V","Ṽ":"V","Ꝡ":"VY","Ẃ":"W","Ŵ":"W","Ẅ":"W","Ẇ":"W","Ẉ":"W","Ẁ":"W","Ⱳ":"W","Ẍ":"X","Ẋ":"X","Ý":"Y","Ŷ":"Y","Ÿ":"Y","Ẏ":"Y","Ỵ":"Y","Ỳ":"Y","Ƴ":"Y","Ỷ":"Y","Ỿ":"Y","Ȳ":"Y","Ɏ":"Y","Ỹ":"Y","Ź":"Z","Ž":"Z","Ẑ":"Z","Ⱬ":"Z","Ż":"Z","Ẓ":"Z","Ȥ":"Z","Ẕ":"Z","Ƶ":"Z","Ĳ":"IJ","Œ":"OE","ᴀ":"A","ᴁ":"AE","ʙ":"B","ᴃ":"B","ᴄ":"C","ᴅ":"D","ᴇ":"E","ꜰ":"F","ɢ":"G","ʛ":"G","ʜ":"H","ɪ":"I","ʁ":"R","ᴊ":"J","ᴋ":"K","ʟ":"L","ᴌ":"L","ᴍ":"M","ɴ":"N","ᴏ":"O","ɶ":"OE","ᴐ":"O","ᴕ":"OU","ᴘ":"P","ʀ":"R","ᴎ":"N","ᴙ":"R","ꜱ":"S","ᴛ":"T","ⱻ":"E","ᴚ":"R","ᴜ":"U","ᴠ":"V","ᴡ":"W","ʏ":"Y","ᴢ":"Z","á":"a","ă":"a","ắ":"a","ặ":"a","ằ":"a","ẳ":"a","ẵ":"a","ǎ":"a","â":"a","ấ":"a","ậ":"a","ầ":"a","ẩ":"a","ẫ":"a","ä":"a","ǟ":"a","ȧ":"a","ǡ":"a","ạ":"a","ȁ":"a","à":"a","ả":"a","ȃ":"a","ā":"a","ą":"a","ᶏ":"a","ẚ":"a","å":"a","ǻ":"a","ḁ":"a","ⱥ":"a","ã":"a","ꜳ":"aa","æ":"ae","ǽ":"ae","ǣ":"ae","ꜵ":"ao","ꜷ":"au","ꜹ":"av","ꜻ":"av","ꜽ":"ay","ḃ":"b","ḅ":"b","ɓ":"b","ḇ":"b","ᵬ":"b","ᶀ":"b","ƀ":"b","ƃ":"b","ɵ":"o","ć":"c","č":"c","ç":"c","ḉ":"c","ĉ":"c","ɕ":"c","ċ":"c","ƈ":"c","ȼ":"c","ď":"d","ḑ":"d","ḓ":"d","ȡ":"d","ḋ":"d","ḍ":"d","ɗ":"d","ᶑ":"d","ḏ":"d","ᵭ":"d","ᶁ":"d","đ":"d","ɖ":"d","ƌ":"d","ı":"i","ȷ":"j","ɟ":"j","ʄ":"j","ǳ":"dz","ǆ":"dz","é":"e","ĕ":"e","ě":"e","ȩ":"e","ḝ":"e","ê":"e","ế":"e","ệ":"e","ề":"e","ể":"e","ễ":"e","ḙ":"e","ë":"e","ė":"e","ẹ":"e","ȅ":"e","è":"e","ẻ":"e","ȇ":"e","ē":"e","ḗ":"e","ḕ":"e","ⱸ":"e","ę":"e","ᶒ":"e","ɇ":"e","ẽ":"e","ḛ":"e","ꝫ":"et","ḟ":"f","ƒ":"f","ᵮ":"f","ᶂ":"f","ǵ":"g","ğ":"g","ǧ":"g","ģ":"g","ĝ":"g","ġ":"g","ɠ":"g","ḡ":"g","ᶃ":"g","ǥ":"g","ḫ":"h","ȟ":"h","ḩ":"h","ĥ":"h","ⱨ":"h","ḧ":"h","ḣ":"h","ḥ":"h","ɦ":"h","ẖ":"h","ħ":"h","ƕ":"hv","í":"i","ĭ":"i","ǐ":"i","î":"i","ï":"i","ḯ":"i","ị":"i","ȉ":"i","ì":"i","ỉ":"i","ȋ":"i","ī":"i","į":"i","ᶖ":"i","ɨ":"i","ĩ":"i","ḭ":"i","ꝺ":"d","ꝼ":"f","ᵹ":"g","ꞃ":"r","ꞅ":"s","ꞇ":"t","ꝭ":"is","ǰ":"j","ĵ":"j","ʝ":"j","ɉ":"j","ḱ":"k","ǩ":"k","ķ":"k","ⱪ":"k","ꝃ":"k","ḳ":"k","ƙ":"k","ḵ":"k","ᶄ":"k","ꝁ":"k","ꝅ":"k","ĺ":"l","ƚ":"l","ɬ":"l","ľ":"l","ļ":"l","ḽ":"l","ȴ":"l","ḷ":"l","ḹ":"l","ⱡ":"l","ꝉ":"l","ḻ":"l","ŀ":"l","ɫ":"l","ᶅ":"l","ɭ":"l","ł":"l","ǉ":"lj","ſ":"s","ẜ":"s","ẛ":"s","ẝ":"s","ḿ":"m","ṁ":"m","ṃ":"m","ɱ":"m","ᵯ":"m","ᶆ":"m","ń":"n","ň":"n","ņ":"n","ṋ":"n","ȵ":"n","ṅ":"n","ṇ":"n","ǹ":"n","ɲ":"n","ṉ":"n","ƞ":"n","ᵰ":"n","ᶇ":"n","ɳ":"n","ñ":"n","ǌ":"nj","ó":"o","ŏ":"o","ǒ":"o","ô":"o","ố":"o","ộ":"o","ồ":"o","ổ":"o","ỗ":"o","ö":"o","ȫ":"o","ȯ":"o","ȱ":"o","ọ":"o","ő":"o","ȍ":"o","ò":"o","ỏ":"o","ơ":"o","ớ":"o","ợ":"o","ờ":"o","ở":"o","ỡ":"o","ȏ":"o","ꝋ":"o","ꝍ":"o","ⱺ":"o","ō":"o","ṓ":"o","ṑ":"o","ǫ":"o","ǭ":"o","ø":"o","ǿ":"o","õ":"o","ṍ":"o","ṏ":"o","ȭ":"o","ƣ":"oi","ꝏ":"oo","ɛ":"e","ᶓ":"e","ɔ":"o","ᶗ":"o","ȣ":"ou","ṕ":"p","ṗ":"p","ꝓ":"p","ƥ":"p","ᵱ":"p","ᶈ":"p","ꝕ":"p","ᵽ":"p","ꝑ":"p","ꝙ":"q","ʠ":"q","ɋ":"q","ꝗ":"q","ŕ":"r","ř":"r","ŗ":"r","ṙ":"r","ṛ":"r","ṝ":"r","ȑ":"r","ɾ":"r","ᵳ":"r","ȓ":"r","ṟ":"r","ɼ":"r","ᵲ":"r","ᶉ":"r","ɍ":"r","ɽ":"r","ↄ":"c","ꜿ":"c","ɘ":"e","ɿ":"r","ś":"s","ṥ":"s","š":"s","ṧ":"s","ş":"s","ŝ":"s","ș":"s","ṡ":"s","ṣ":"s","ṩ":"s","ʂ":"s","ᵴ":"s","ᶊ":"s","ȿ":"s","ɡ":"g","ᴑ":"o","ᴓ":"o","ᴝ":"u","ť":"t","ţ":"t","ṱ":"t","ț":"t","ȶ":"t","ẗ":"t","ⱦ":"t","ṫ":"t","ṭ":"t","ƭ":"t","ṯ":"t","ᵵ":"t","ƫ":"t","ʈ":"t","ŧ":"t","ᵺ":"th","ɐ":"a","ᴂ":"ae","ǝ":"e","ᵷ":"g","ɥ":"h","ʮ":"h","ʯ":"h","ᴉ":"i","ʞ":"k","ꞁ":"l","ɯ":"m","ɰ":"m","ᴔ":"oe","ɹ":"r","ɻ":"r","ɺ":"r","ⱹ":"r","ʇ":"t","ʌ":"v","ʍ":"w","ʎ":"y","ꜩ":"tz","ú":"u","ŭ":"u","ǔ":"u","û":"u","ṷ":"u","ü":"u","ǘ":"u","ǚ":"u","ǜ":"u","ǖ":"u","ṳ":"u","ụ":"u","ű":"u","ȕ":"u","ù":"u","ủ":"u","ư":"u","ứ":"u","ự":"u","ừ":"u","ử":"u","ữ":"u","ȗ":"u","ū":"u","ṻ":"u","ų":"u","ᶙ":"u","ů":"u","ũ":"u","ṹ":"u","ṵ":"u","ᵫ":"ue","ꝸ":"um","ⱴ":"v","ꝟ":"v","ṿ":"v","ʋ":"v","ᶌ":"v","ⱱ":"v","ṽ":"v","ꝡ":"vy","ẃ":"w","ŵ":"w","ẅ":"w","ẇ":"w","ẉ":"w","ẁ":"w","ⱳ":"w","ẘ":"w","ẍ":"x","ẋ":"x","ᶍ":"x","ý":"y","ŷ":"y","ÿ":"y","ẏ":"y","ỵ":"y","ỳ":"y","ƴ":"y","ỷ":"y","ỿ":"y","ȳ":"y","ẙ":"y","ɏ":"y","ỹ":"y","ź":"z","ž":"z","ẑ":"z","ʑ":"z","ⱬ":"z","ż":"z","ẓ":"z","ȥ":"z","ẕ":"z","ᵶ":"z","ᶎ":"z","ʐ":"z","ƶ":"z","ɀ":"z","ﬀ":"ff","ﬃ":"ffi","ﬄ":"ffl","ﬁ":"fi","ﬂ":"fl","ĳ":"ij","œ":"oe","ﬆ":"st","ₐ":"a","ₑ":"e","ᵢ":"i","ⱼ":"j","ₒ":"o","ᵣ":"r","ᵤ":"u","ᵥ":"v","ₓ":"x"};

    s = s.split(" ").join("-");
    s = s.replace(/[^A-Za-z0-9\[\] ]/g,function(a){return latin_map[a]||a});
    s = s.toLowerCase();
    s = s.replace(/[^a-z0-9\-]+/g,"");

    return s;
}
//-->
;
//https://github.com/sebpiq/WAAClock/

;(function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
    var WAAClock = require('./lib/WAAClock')

    module.exports = WAAClock
    if (typeof window !== 'undefined') window.WAAClock = WAAClock

},{"./lib/WAAClock":2}],3:[function(require,module,exports){
// shim for using process in browser

    var process = module.exports = {};

    process.nextTick = (function () {
        var canSetImmediate = typeof window !== 'undefined'
            && window.setImmediate;
        var canPost = typeof window !== 'undefined'
                && window.postMessage && window.addEventListener
            ;

        if (canSetImmediate) {
            return function (f) { return window.setImmediate(f) };
        }

        if (canPost) {
            var queue = [];
            window.addEventListener('message', function (ev) {
                var source = ev.source;
                if ((source === window || source === null) && ev.data === 'process-tick') {
                    ev.stopPropagation();
                    if (queue.length > 0) {
                        var fn = queue.shift();
                        fn();
                    }
                }
            }, true);

            return function nextTick(fn) {
                queue.push(fn);
                window.postMessage('process-tick', '*');
            };
        }

        return function nextTick(fn) {
            setTimeout(fn, 0);
        };
    })();

    process.title = 'browser';
    process.browser = true;
    process.env = {};
    process.argv = [];

    process.binding = function (name) {
        throw new Error('process.binding is not supported');
    }

// TODO(shtylman)
    process.cwd = function () { return '/' };
    process.chdir = function (dir) {
        throw new Error('process.chdir is not supported');
    };

},{}],2:[function(require,module,exports){
    var process=require("__browserify_process");var isBrowser = (typeof window !== 'undefined')

    if (isBrowser && !AudioContext)
        throw new Error('This browser doesn\'t seem to support web audio API')

    var CLOCK_DEFAULTS = {
        toleranceLate: 0.10,
        toleranceEarly: 0.001
    }

// ==================== Event ==================== //
    var Event = function(clock, deadline, func) {
        this.clock = clock
        this.func = func
        this.repeatTime = null
        this.toleranceLate = CLOCK_DEFAULTS.toleranceLate
        this.toleranceEarly = CLOCK_DEFAULTS.toleranceEarly
        this._armed = false
        this._latestTime = null
        this._earliestTime = null
        this.schedule(deadline)
    }

// Unschedules the event
    Event.prototype.clear = function() {
        this.clock._removeEvent(this)
        return this
    }

// Sets the event to repeat every `time` seconds.
    Event.prototype.repeat = function(time) {
        if (time === 0)
            throw new Error('delay cannot be 0')
        this.repeatTime = time
        return this
    }

// Sets the time tolerance of the event.
// The event will be executed in the interval `[deadline - early, deadline + late]`
// If the clock fails to execute the event in time, the event will be dropped.
    Event.prototype.tolerance = function(values) {
        if (typeof values.late === 'number')
            this.toleranceLate = values.late
        if (typeof values.early === 'number')
            this.toleranceEarly = values.early
        this._update()
        return this
    }

// Returns true if the event is repeated, false otherwise
    Event.prototype.isRepeated = function() { return this.repeatTime !== null }

// Schedules the event to be ran before `deadline`.
// If the time is within the event tolerance, we handle the event immediately
    Event.prototype.schedule = function(deadline) {
        this._armed = true
        this.deadline = deadline
        this._update()
        if (this.clock.context.currentTime >= this._earliestTime) {
            this.clock._removeEvent(this)
            this._execute()
        }
    }

// Executes the event
    Event.prototype._execute = function() {
        this._armed = false
        if (this.clock.context.currentTime < this._latestTime)
            this.func(this);
        else {
            //if (this.onexpired) this.onexpired(this)
			console.warn('event expired');
            if (EventBus) EventBus.trigger(EVENT.clockEventExpired);
        }
        // In the case `schedule` is called inside `func`, we need to avoid
        // overrwriting with yet another `schedule`
        if (this._armed === false && this.isRepeated())
            this.schedule(this.deadline + this.repeatTime)
    };

// This recalculates some cached values and re-insert the event in the clock's list
// to maintain order.
    Event.prototype._update = function() {
        this._latestTime = this.deadline + this.toleranceLate
        this._earliestTime = this.deadline - this.toleranceEarly
        this.clock._removeEvent(this)
        this.clock._insertEvent(this)
    }

// ==================== WAAClock ==================== //
    var WAAClock = module.exports = function(context, opts) {
        var self = this
        opts = opts || {}
        this.toleranceEarly = opts.toleranceEarly || CLOCK_DEFAULTS.toleranceEarly
        this.toleranceLate = opts.toleranceLate || CLOCK_DEFAULTS.toleranceLate
        this.context = context
        this._events = []
        this._started = false
    }

// ---------- Public API ---------- //
// Schedules `func` to run after `delay` seconds.
    WAAClock.prototype.setTimeout = function(func, delay) {
        return this._createEvent(func, this._absTime(delay))
    }

// Schedules `func` to run before `deadline`.
    WAAClock.prototype.callbackAtTime = function(func, deadline) {
        return this._createEvent(func, deadline)
    }

// Stretches `deadline` and `repeat` of all scheduled `events` by `ratio`, keeping
// their relative distance to `tRef`. In fact this is equivalent to changing the tempo.
    WAAClock.prototype.timeStretch = function(tRef, events, ratio) {
        var self = this
            , currentTime = self.context.currentTime

        events.forEach(function(event) {
            if (event.isRepeated()) event.repeat(event.repeatTime * ratio)

            var deadline = tRef + ratio * (event.deadline - tRef)
            // If the deadline is too close or past, and the event has a repeat,
            // we calculate the next repeat possible in the stretched space.
            if (event.isRepeated()) {
                while (currentTime >= deadline - event.toleranceEarly)
                    deadline += event.repeatTime
            }
            event.schedule(deadline)


        })
        return events
    }

// ---------- Private ---------- //

// Removes all scheduled events and starts the clock
    WAAClock.prototype.start = function() {
        if (this._started === false) {
            var self = this
            this._started = true
            this._events = []

            var bufferSize = 256
            // We have to keep a reference to the node to avoid garbage collection
            this._clockNode = this.context.createScriptProcessor(bufferSize, 1, 1)
            this._clockNode.connect(this.context.destination)
            this._clockNode.onaudioprocess = function () {
                process.nextTick(function() { self._tick() })
            }
        }
    }

// Stops the clock
    WAAClock.prototype.stop = function() {
        if (this._started === true) {
            this._started = false
            this._clockNode.disconnect()
        }
    }

// This function is ran periodically, and at each tick it executes
// events for which `currentTime` is included in their tolerance interval.
    WAAClock.prototype._tick = function() {
        var event = this._events.shift()

        while(event && event._earliestTime <= this.context.currentTime) {
            event._execute()
            event = this._events.shift()
        }

        // Put back the last event
        if(event) this._events.unshift(event)
    }

// Creates an event and insert it to the list
    WAAClock.prototype._createEvent = function(func, deadline) {
        var event = new Event(this, deadline, func)
        event.tolerance({late: this.toleranceLate, early: this.toleranceEarly})
        return event
    }

// Inserts an event to the list
    WAAClock.prototype._insertEvent = function(event) {
        this._events.splice(this._indexByTime(event._earliestTime), 0, event)
    }

// Removes an event from the list
    WAAClock.prototype._removeEvent = function(event) {
        var ind = this._events.indexOf(event)
        if (ind !== -1) this._events.splice(ind, 1)
    }

// Returns the index of the first event whose deadline is >= to `deadline`
    WAAClock.prototype._indexByTime = function(deadline) {
        // performs a binary search
        var low = 0
            , high = this._events.length
            , mid
        while (low < high) {
            mid = Math.floor((low + high) / 2)
            if (this._events[mid]._earliestTime < deadline)
                low = mid + 1
            else high = mid
        }
        return low
    }

// Converts from relative time to absolute time
    WAAClock.prototype._absTime = function(relTime) {
        return relTime + this.context.currentTime
    }

// Converts from absolute time to relative time
    WAAClock.prototype._relTime = function(absTime) {
        return absTime - this.context.currentTime
    }
},{"__browserify_process":3}]},{},[1])
;;
FilterChain = (function(filters) {

	var me = {};

	filters = filters || {
		volume: true,
		panning: true
	};

    // disable for now: sounds muffled;
	var disableFilters = true;

	if (disableFilters){
        filters = {
            volume: true,
            panning: true
        };
	}

	var useVolume = filters.volume;
	var usePanning = filters.panning && Audio.context.createStereoPanner;
	var useHigh = filters.high;
	var useMid = filters.mid;
	var useLow = filters.low;
	var useLowPass = filters.lowPass;
	var useReverb = filters.reverb;
	var useDistortion = filters.distortion;

	var input,output,output2;

	var lowValue = 0.0;
	var midValue = 0.0;
	var highValue = 0.0;
	var volumeValue = 70;
	var panningValue = 0;

	var FREQ_MUL = 7000;
	var QUAL_MUL = 30;

	var context = Audio.context;

	var volumeGain,highGain,midGain,lowGain,lowPassfilter,reverb,reverbGain,panner;

	// use a simple Gain as input so that we can leave this connected while changing filters
	input = context.createGain();
    input.gain.value=1;
    output = input;


    function connectFilters(){

    	output = input;

        if (useHigh){
            highGain = highGain || createHigh();
            output.connect(highGain);
            output = highGain;
        }

        if (useMid){
            midGain = midGain || createMid();
            output.connect(midGain);
            output = midGain;
        }

        if (useLow){
            lowGain = lowGain || createLow();
            output.connect(lowGain);
            output = lowGain;
        }

        if (useLowPass){
            lowPassfilter = lowPassfilter || createLowPass();
            output.connect(lowPassfilter);
            output = lowPassfilter;
        }

        if (useReverb){
            reverb = reverb || context.createConvolver();
            reverbGain = reverbGain || context.createGain();
            reverbGain.gain.value = 0;

            output.connect(reverbGain);
            reverbGain.connect(reverb);
            output2 = reverb;
        }

        if (useDistortion){
            var distortion = context.createWaveShaper();
            distortion.curve = distortionCurve(400);
            distortion.oversample = '4x';
        }

        if (usePanning){
            panner =  panner || Audio.context.createStereoPanner();
            output.connect(panner);
            output = panner;
        }

        // always use volume as last node - never disconnect this

		volumeGain = volumeGain ||context.createGain();
        output.connect(volumeGain);
        if (output2) output2.connect(volumeGain);
        output = volumeGain;

	}

	function disConnectFilter(){
        input.disconnect();
        if (highGain) highGain.disconnect();
        if (midGain) midGain.disconnect();
        if (lowGain) lowGain.disconnect();
        if (lowPassfilter) lowPassfilter.disconnect();
        if (reverbGain) reverbGain.disconnect();
		if (panner) panner.disconnect();
        output2 = undefined;
	}


	function createHigh(){
		var filter = context.createBiquadFilter();
		filter.type = "highshelf";
		filter.frequency.value = 3200.0;
		filter.gain.value = highValue;
		return filter;
	}

	function createMid(){
        var filter = context.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = 1000.0;
        filter.Q.value = 0.5;
        filter.gain.value = midValue;
        return filter;
	}

	function createLow(){
        var filter = context.createBiquadFilter();
        filter.type = "lowshelf";
        filter.frequency.value = 320.0;
        filter.gain.value = lowValue;
        return filter;
	}

	function createLowPass(){
        var filter =  context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 5000;
        return filter;
	}

	function init(){
        connectFilters();
		me.volumeValue(volumeValue);
	}

	function distortionCurve(amount) {
		var k = typeof amount === 'number' ? amount : 50,
				n_samples = 44100,
				curve = new Float32Array(n_samples),
				deg = Math.PI / 180,
				i = 0,
				x;
		for ( ; i < n_samples; ++i ) {
			x = i * 2 / n_samples - 1;
			curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
		}
		return curve;
	}

	me.lowValue = function(value) {
		if (!useLow) return;
		if (typeof value !== "undefined"){
			var maxRange = 20;
			lowValue = value;
			lowGain.gain.value = lowValue * maxRange  ;
		}
		return lowValue;
	};

	me.midValue = function(value) {
		if (!useMid) return;
		if (typeof value !== "undefined"){
			var maxRange = 20;
			midValue = value;
			midGain.gain.value = midValue * maxRange  ;
		}
		return midValue;
	};

	me.highValue = function(value) {
		if (!useHigh) return;
		if (typeof value !== "undefined"){
			var maxRange = 20;
			highValue = value;
			highGain.gain.value = highValue * maxRange  ;
		}
		return highValue;
	};

	me.lowPassFrequencyValue = function(value) {
		if (!useLowPass) return;
		// Clamp the frequency between the minimum value (40 Hz) and half of the
		// sampling rate.
		var minValue = 40;
		var maxValue = Audio.context.sampleRate / 2;
		// Logarithm (base 2) to compute how many octaves fall in the range.
		var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
		// Compute a multiplier from 0 to 1 based on an exponential scale.
		var multiplier = Math.pow(2, numberOfOctaves * (value - 1.0));
		// Get back to the frequency value between min and max.

		lowPassfilter.frequency.value = maxValue * multiplier;
	};

	me.lowPassQualityValue = function(value) {
		if (!useLowPass) return;
		lowPassfilter.Q.value = value * QUAL_MUL;
	};

	me.reverbValue = function(value) {
		if (!useReverb) return;
		if (!reverb.buffer){
			var buffer = cachedAssets.audio["data/reverb/sportcentre.m4a"];
			if (!buffer){
				var preLoader = PreLoader();
				preLoader.load(["data/reverb/sportcentre.m4a"],PRELOADTYPE.audio,function(){
					console.error("reverb buffer loaded");
					reverb.buffer = cachedAssets.audio["data/reverb/sportcentre.m4a"];
				});
			}else{
				reverb.buffer = buffer;
			}
		}

		var max = 100;
		var fraction = parseInt(value) / max;
		reverbGain.gain.value = fraction * fraction;

	};

	me.volumeValue = function(value) {
		if (!useVolume) return;
		if (typeof value !== "undefined"){
			var max = 100;
			volumeValue = value;
			var fraction = value / max;
			volumeGain.gain.value = fraction * fraction;
		}
		return volumeValue;
	};

	me.panningValue = function(value,time) {
		if (!usePanning) return;

		if (typeof value !== "undefined"){
			panningValue = value;
			if (time){
				panner.pan.setValueAtTime(panningValue,time);
			}else{
				// very weird bug in safari on OSX ... setting pan.value directy to 0 does not work
				panner.pan.setValueAtTime(panningValue,Audio.context.currentTime);
			}

		}
		return panningValue;
	};

	me.setState = function(name,value){
		disConnectFilter();

        if (name==="high") useHigh=!!value;
        if (name==="mid") useMid=!!value;
        if (name==="low") useLow=!!value;
        if (name==="lowPass") useLowPass=!!value;
        if (name==="reverb") useReverb=!!value;
        if (name==="panning") usePanning=(!!value) && Audio.context.createStereoPanner;

        connectFilters();

	};

	me.input = function(){
		return input;
	};

	me.output = function(){
		return output;
	};

	init();

	return me;

});





;
var periodNoteTable = {};
var periodFinetuneTable = {};
var nameNoteTable = {};
var noteNames = [];
var FTNotes = [];
var FTPeriods = [];

var Tracker = (function(){

	// TODO: strip UI stuff
	var me = {};
	me.isMaster = true;

	var clock;

	var isRecording = false;
	var isPlaying = false;

	var song;
	var instruments = [];

	var currentInstrumentIndex = 1;
	var prevInstrumentIndex;
	var currentPattern = 0;
	var prevPattern;
	var currentPatternPos = 0;
	var prevPatternPos;
	var currentPlayType = PLAYTYPE.song;
	var currentPatternData;

	var currentSongPosition = 0;
	var prevSongPosition = 0;

	var vibratoFunction;
	var tremoloFunction;

	var bpm = 125; // bmp
	var ticksPerStep = 6;
	var tickTime = 2.5/bpm;
	var tickCounter = 0;
	var mainTimer;

	var trackCount = 4;
	var patternLength = 64;
	var trackerMode = TRACKERMODE.PROTRACKER;

	var swing = 0; // swing in milliseconds. NOTE: this is not part of any original Tracker format, just nice to have on beat sequences

	var trackNotes = [];
	var trackEffectCache = [];
	var trackerStates = [];
	var patternLoopStart = [];
	var patternLoopCount = [];
	
	//console.log("ticktime: " + tickTime);

	me.init = function(config){

		for (var i=0;i<trackCount;i++){
			trackNotes.push({});
			trackEffectCache.push({});
		}
		
		for (var i = -8; i<8;i++){
			periodFinetuneTable[i] = {};
		}

		for (var key in NOTEPERIOD){
			if (NOTEPERIOD.hasOwnProperty(key)){
				var note = NOTEPERIOD[key];
				periodNoteTable[note.period] = note;
				nameNoteTable[note.name] = note;
				noteNames.push(note.name);

				// build fineTune table
				if (note.tune){
					for (i = -8; i<8;i++){
						var table =  periodFinetuneTable[i];
						var index = i+8;
						table[note.tune[index]] = note.period;
					}
				}
			}
		}

		var ftCounter = 0;
		for (key in FTNOTEPERIOD){
			if (FTNOTEPERIOD.hasOwnProperty(key)){
				var ftNote = FTNOTEPERIOD[key];
				if (!ftNote.period) ftNote.period = 1;
				FTNotes.push(ftNote);
				FTPeriods[ftNote.period] = ftCounter;
				if (ftNote.modPeriod) FTPeriods[ftNote.modPeriod] = ftCounter;
				ftCounter++;
			}
		}

		if (config) {
			Host.init();
			Audio.init(config.audioContext,config.audioDestination);
			if (config.plugin){
				me.isPlugin = true;
				UI.initPlugin(config);
				if (typeof config.isMaster === "boolean") me.isMaster = config.isMaster;
				if (config.handler){
					EventBus.on(EVENT.songBPMChange,function(bpm){
						config.handler(EVENT.songBPMChange,bpm);
					});
					EventBus.on(EVENT.songBPMChangeIgnored,function(bpm){
						config.handler(EVENT.songBPMChangeIgnored,bpm);
					});



					EventBus.on(EVENT.songSpeedChange,function(speed){
						config.handler(EVENT.songSpeedChange,speed);
					});
					EventBus.on(EVENT.songSpeedChangeIgnored,function(speed){
						config.handler(EVENT.songSpeedChangeIgnored,speed);
					});


					EventBus.on(EVENT.patternEnd,function(time){
						config.handler(EVENT.patternEnd,time);
					});
				}
			}
		}

	};
	
	me.setMaster = function(value){
		me.isMaster = value;
	}

	me.isMaster = function(){
		return !!me.isMaster;
	}

	me.setCurrentInstrumentIndex = function(index){
		if (song.instruments[index]){
			currentInstrumentIndex = index;
			if (prevInstrumentIndex!=currentInstrumentIndex) EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
			prevInstrumentIndex = currentInstrumentIndex;
		}else{
			if (index<=me.getMaxInstruments()){
				for (var i = song.instruments.length, max = index;i<=max;i++){
					me.setInstrument(i,Instrument());
				}

				var instrumentContainer = [];
				for (i = 1;i<=max;i++){
					var instrument = song.instruments[i] || {name:""};
					instrumentContainer.push({label: i + " " + instrument.name, data: i});
					EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
				}

				currentInstrumentIndex = index;
				if (prevInstrumentIndex!=currentInstrumentIndex) EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
				prevInstrumentIndex = currentInstrumentIndex;
			}
		}
	};

	me.getCurrentInstrumentIndex = function(){
		return currentInstrumentIndex;
	};

	me.getCurrentInstrument = function(){
		return instruments[currentInstrumentIndex];
	};

	me.getMaxInstruments = function(){
		return me.inFTMode() ? 128 : 31;
	};

	me.setCurrentPattern = function(index){
		currentPattern = index;
		currentPatternData = song.patterns[currentPattern];

		if (!currentPatternData){
			// insert empty pattern;
			currentPatternData = getEmptyPattern();
			song.patterns[currentPattern] = currentPatternData;
		}
		patternLength = currentPatternData.length;
		if (prevPattern!=currentPattern) EventBus.trigger(EVENT.patternChange,currentPattern);
		prevPattern = currentPattern;
	};
	me.getCurrentPattern = function(){
		return currentPattern;
	};
	me.getCurrentPatternData = function(){
		return currentPatternData;
	};
	me.updatePatternTable = function(index,value){
		song.patternTable[index] = value;
		EventBus.trigger(EVENT.patternTableChange,value);
		if (index == currentSongPosition) {
			prevPattern = undefined;
			Tracker.setCurrentPattern(value);
		}
	};

	me.setCurrentPatternPos = function(index){
		currentPatternPos = index;
		if (prevPatternPos!=currentPatternPos) EventBus.trigger(EVENT.patternPosChange,{current: currentPatternPos, prev: prevPatternPos});
		prevPatternPos = currentPatternPos;
	};
	me.getCurrentPatternPos = function(){
		return currentPatternPos;
	};
	me.moveCurrentPatternPos = function(amount){
		var newPos = currentPatternPos + amount;
		var max = patternLength-1;
		if (newPos<0) newPos = max;
		if (newPos>max) newPos = 0;
		me.setCurrentPatternPos(newPos);
	};


	me.getCurrentSongPosition = function(){
		return currentSongPosition;
	};
	me.setCurrentSongPosition = function(position,fromUserInteraction){
		currentSongPosition = position;
		if (currentSongPosition != prevSongPosition){
			EventBus.trigger(EVENT.songPositionChange,currentSongPosition);
			if (song.patternTable) me.setCurrentPattern(song.patternTable[currentSongPosition]);
			prevSongPosition = currentSongPosition;

			if (fromUserInteraction && me.isPlaying()){
				me.stop();
				me.togglePlay();
			}
		}
	};

	me.setPlayType = function(playType){
		currentPlayType = playType;
		EventBus.trigger(EVENT.playTypeChange,currentPlayType);
	};
	me.getPlayType = function(){
		return currentPlayType;
	};

	me.playSong = function(){
		me.stop();
		Audio.checkState();
		//Audio.setMasterVolume(1);
		me.setPlayType(PLAYTYPE.song);
		isPlaying = true;
		//Audio.startRecording();
		playPattern(currentPattern);
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.playPattern = function(){
		me.stop();
        Audio.checkState();
		//Audio.setMasterVolume(1);
		currentPatternPos = 0;
		me.setPlayType(PLAYTYPE.pattern);
		isPlaying = true;
		playPattern(currentPattern);
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.stop = function(){
		if (clock) clock.stop();
		Audio.disable();
		if (!me.isPlugin) Audio.setMasterVolume(1);
		if (UI) {
			UI.setStatus("Ready");
			Input.clearInputNotes();
		}

		me.clearEffectCache();
		//Audio.stopRecording();

		for (var i = 0; i<trackCount; i++){
			if (trackNotes[i].source){
				try{
					trackNotes[i].source.stop();
				}catch (e){
				}
			}
		}

		isPlaying = false;
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.pause = function(){
		// this is only called when speed is set to 0
		if (clock) clock.stop();
		isPlaying = false;
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.togglePlay = function(){
		if (me.isPlaying()){
			me.stop();
		}else{
			if (currentPlayType == PLAYTYPE.pattern){
				me.playPattern();
			}else{
				me.playSong();
			}
		}
	};

	me.getProperties = function(){
		return{
			ticksPerStep: ticksPerStep,
			tickTime: tickTime
		}
	};

	function playPattern(patternIndex){
		patternIndex = patternIndex || 0;

		clock = clock || new WAAClock(Audio.context);
		clock.start();
		Audio.enable();
		if (UI) UI.setStatus("Playing");
		patternLoopStart = [];
		patternLoopCount = [];

		currentPatternData = song.patterns[patternIndex];
		var thisPatternLength = currentPatternData.length;
		var stepResult = {};

		// look-ahead playback - far less demanding, works OK on mobile devices
		var p =  0;
		var time = Audio.context.currentTime + 0.1; //  add small delay to allow some time to render the first notes before playing


		// start with a small delay then make it longer
		// this is because Chrome on Android doesn't start playing until the first batch of scheduling is done?

		var delay = 0.2;
		var playingDelay = 1;

		var playPatternData = currentPatternData;
		var playSongPosition = currentSongPosition;
		trackerStates = [];

		mainTimer = clock.setTimeout(function(event) {

			if (p>1){
				delay = playingDelay;
				mainTimer.repeat(delay);
			}

			var maxTime = event.deadline + delay;
			Audio.clearScheduledNotesCache();


			while (time<maxTime){

				// ignore speed==0 when autoplay is active (Playlists)
                if(stepResult.pause && !Tracker.autoPlay){
                    // speed is set to 0
					if (!stepResult.pasuseHandled){
                        var delta = time - Audio.context.currentTime;
                        if (delta>0){
                        	setTimeout(function(){
                        		me.pause();
                        		// in Fasttracker this repeats the current step with the previous speed - including effects.
								// (which seems totally weird)
								me.setAmigaSpeed(6);
							},Math.round(delta*1000)+100);
						}
                        stepResult.pasuseHandled=true;
					}
					return;
                }
                
                me.setStateAtTime(time,{patternPos: p, songPos: playSongPosition});
                if (!UI) me.setCurrentSongPosition(playSongPosition);

				if (stepResult.patternDelay){
					// the E14 effect is used: delay Pattern but keep processing effects
					stepResult.patternDelay--;

					for (i = 0; i<trackCount; i++){
						applyEffects(i,time);
					}

					time += ticksPerStep * tickTime;
                }else{
					stepResult = playPatternStep(p,time,playPatternData,playSongPosition);
					time += ticksPerStep * tickTime;
					p++;
					if (p>=thisPatternLength || stepResult.patternBreak){
						if (!(stepResult.positionBreak && stepResult.targetSongPosition == playSongPosition)){
							//We're not in a pattern loop
							patternLoopStart = [];
							patternLoopCount = [];
						}
						p=0;
						if (Tracker.getPlayType() == PLAYTYPE.song){
							var nextPosition = stepResult.positionBreak ? stepResult.targetSongPosition : ++playSongPosition;
							if (nextPosition>=song.length) {
								nextPosition = song.restartPosition ? song.restartPosition-1 : 0;
								EventBus.trigger(EVENT.songEnd);
							}
							if (nextPosition>=song.length) nextPosition = 0;
							playSongPosition = nextPosition;
							patternIndex = song.patternTable[playSongPosition];
							playPatternData = song.patterns[patternIndex];

							// some invalid(?) XM files have non-existent patterns in their song list - eg. cybernautic_squierl.xm
							if (!playPatternData) {
								playPatternData =  getEmptyPattern();
								song.patterns[patternIndex] = playPatternData;
							}

                            thisPatternLength = playPatternData.length;
							if (stepResult.patternBreak){
								p = stepResult.targetPatternPosition || 0;
								if (p>playPatternData.length) p=0; // occurs in the wild - example "Lake Of Sadness" - last pattern
                            }
						}else{
							if (stepResult.patternBreak) {
								p = stepResult.targetPatternPosition || 0;
								if (p>patternLength) p=0;
							}
						}
						EventBus.trigger(EVENT.patternEnd,time - ticksPerStep * tickTime);
					}
				}

			}

			// check if a playing note has looping parameters that needs further scheduling

            for (i = 0; i<trackCount; i++){
                var trackNote = trackNotes[i];
                if (trackNote && trackNote.time && trackNote.scheduled){

					var instrument = me.getInstrument(trackNote.instrumentIndex);
					if(instrument){

					}

                	if (trackNote.scheduled.volume){
                		if ((time + delay) >= trackNote.scheduled.volume){
							var scheduledtime = instrument.scheduleEnvelopeLoop(trackNote.volumeEnvelope,trackNote.scheduled.volume,2);
							trackNote.scheduled.volume += scheduledtime;
                        }
					}

					if (trackNote.scheduled.panning){
						if ((time + delay) >= trackNote.scheduled.panning){
							scheduledtime = instrument.scheduleEnvelopeLoop(trackNote.panningEnvelope,trackNote.scheduled.panning,2);
							trackNote.scheduled.panning += scheduledtime;
						}
					}
				}
            }


		},0.01).repeat(delay).tolerance({early: 0.1});

	}


	function playPatternStep(step,time,patternData,songPostition){

		patternData = patternData || currentPatternData;
		// note: patternData can be different than currentPatternData when playback is active with long look ahead times

		var patternStep = patternData[step];
		var tracks = trackCount;
		var result = {};
		var r;

		// hmmm ... Whut?
		// The Speed setting influences other effects too,
		// on Amiga players the effects are processed each tick, so the speed setting on a later channel can influence the effects on a previous channel ...
		// This is implemented by setting the speed before all other effects
		// example: see the ED2 command pattern 0, track 3, step 32 in AceMan - Dirty Tricks.mod
		// not sure this is 100% correct, but in any case it's more correct then setting it at the track it self.
		// Thinking ... ... yes ... should be fine as no speed related effects are processed on tick 0?
		//
		

		for (var i = 0; i<tracks; i++){
			note = patternStep[i];
			if (note && note.effect && note.effect === 15){
				if (note.param < 32){
					//if (note.param == 0) note.param = 1;
					Tracker.setAmigaSpeed(note.param);
					if (note.param === 0) result.pause = true;
				}else{
					Tracker.setBPM(note.param)
				}
			}
		}
		// --- end Whut? ---



		for (var i = 0; i<tracks; i++){
			var note = patternStep[i];
			if (note){
                var songPos = {position: songPostition, step: step};

                var playtime = time;
                if (swing){
                    var swingTime = ((Math.random() * swing * 2) - swing) / 1000;
                    playtime += swingTime;
                }


                r = playNote(note,i,playtime,songPos);
                if (r.patternBreak) {
                    result.patternBreak = true;
                    result.targetPatternPosition = r.targetPatternPosition || 0;
                }
                if (r.positionBreak) {
                    result.positionBreak = true;
                    result.targetPatternPosition = r.targetPatternPosition || 0;
                    result.targetSongPosition = r.targetSongPosition || 0;
                }
                if (r.patternDelay) result.patternDelay = r.patternDelay;
			}
		}

		for (i = 0; i<tracks; i++){
			applyEffects(i,time)
		}


		return result;
	}

	me.playPatternStep = playPatternStep;

	function playNote(note,track,time,songPos){

		var defaultVolume = 100;
		var trackEffects = {};

		var instrumentIndex = note.instrument;
		var notePeriod = note.period;
		var noteIndex = note.index;


		if (notePeriod && !instrumentIndex){
			// reuse previous instrument
			instrumentIndex = trackNotes[track].currentInstrument;
			defaultVolume = typeof trackNotes[track].currentVolume === "number" ? trackNotes[track].currentVolume : defaultVolume;

			if (SETTINGS.emulateProtracker1OffsetBug && instrumentIndex && trackEffectCache[track].offset){
				if (trackEffectCache[track].offset.instrument === instrumentIndex){
					console.log("applying instrument offset cache to instrument " + instrumentIndex);
					trackEffects.offset = trackEffectCache[track].offset;
				}
			}
		}


		if (typeof note.instrument === "number"){
			instrument = me.getInstrument(note.instrument);
			if (instrument) {
				defaultVolume = 100 * (instrument.sample.volume/64);

				if (SETTINGS.emulateProtracker1OffsetBug){
					// reset instrument offset when a instrument number is present;
					trackEffectCache[track].offset = trackEffectCache[track].offset || {};
					trackEffectCache[track].offset.value = 0;
					trackEffectCache[track].offset.instrument = note.instrument;
				}
			}
		}



		var volume = defaultVolume;
		var doPlayNote = true;


		if (typeof instrumentIndex === "number"){
			instrument = me.getInstrument(instrumentIndex);
		}


		if (noteIndex && me.inFTMode()){

			if (noteIndex === 97) {
				noteIndex = NOTEOFF;
			}

			if (noteIndex === NOTEOFF){
				var offInstrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);
				if (offInstrument){
					volume = offInstrument.noteOff(time,trackNotes[track]);
				}else{
					console.log("no instrument on track " + track);
					volume = 0;
				}
				defaultVolume = volume;
				doPlayNote = false;
			}else{

				if (instrument){
					instrument.setSampleForNoteIndex(noteIndex);

					if (instrument.sample.relativeNote) noteIndex += instrument.sample.relativeNote;
					// TODO - check of note gets out of range
					// but apparently they still get played ... -> extend scale to 9, 10 or 11 octaves ?
					// see jt_letgo.xm instrument 6 (track 20) for example
				}

				if (me.useLinearFrequency){
					notePeriod = 7680 - (noteIndex-1)*64;
				}else{
					var ftNote = FTNotes[noteIndex];
					if (ftNote) notePeriod = ftNote.period;
				}
			}
		}


		var value = note.param;
		var x,y;

		var result = {};

        if (note.volumeEffect && me.inFTMode()){
        	var ve = note.volumeEffect;
            x = ve >> 4;
			y = ve & 0x0f;

            if (ve>15 && ve<=80){
                volume = ((ve-16)/64)*100;
                defaultVolume = volume;

				// note this is not relative to the default instrument volume but sets the instrument volume
				trackEffects.volume = {
					value: volume
				};
            }else{

            	switch(x){
					case 6:
						// volume slide down
                        trackEffects.fade = {
                            value: y * -1 * 100/64
                        };
						break;
					case 7:
						// volume slide up
                        trackEffects.fade = {
                            value: y * 100/64
                        };
						break;
					case 8:
						// Fine volume slide down
						trackEffects.fade = {
							value: -y * 100/64,
							fine: true
						};
						break;
					case 9:
						// Fine volume slide up
						trackEffects.fade = {
							value: y * 100/64,
							fine: true
						};
						break;
					case 10:
						// set vibrato speed
						console.warn("set vibrato speed not implemented");
						break;
					case 11:
						// Vibrato
						console.warn("Vibrato not implemented");
						break;
					case 12:
						// Set panning
						trackEffects.panning = {
							value: (ve-192)*17,
							slide: false
						};
						break;
					case 13:
						// Panning slide left
						console.warn("Panning slide left not implemented - track " + track);
						trackEffects.panning = {
							value: ve,
							slide: true
						};
						break;
					case 14:
						// Panning slide right
						console.warn("Panning slide right not implemented - track " + track);
						break;
					case 15:
						// Tone porta
						console.warn("Tone Porta not implemented");
						break;
				}
			}

        }

		switch(note.effect){
			case 0:
				// Arpeggio
				if (value){
					x = value >> 4;
					y = value & 0x0f;


					var finetune = 0;


					//todo: when a instrument index is present other than the previous index, but no note
					// how does this work?
					// see example just_about_seven.mod

                    instrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);

					if (me.inFTMode()){
                        if (instrument){
							var _noteIndex = noteIndex || trackNotes[track].noteIndex;
							var root = instrument.getPeriodForNote(_noteIndex,true);
                            if (noteIndex === NOTEOFF) {
                                trackEffects.arpeggio = trackEffectCache[track].arpeggio;
                            }else{
                                trackEffects.arpeggio = {
                                    root: root,
                                    interval1: root - instrument.getPeriodForNote(_noteIndex+x,true),
                                    interval2: root - instrument.getPeriodForNote(_noteIndex+y,true),
                                    step:1
                                };

                                trackEffectCache[track].arpeggio = trackEffects.arpeggio
							}
                        }
					}else{
                        root = notePeriod || trackNotes[track].startPeriod;
                        // check if the instrument is finetuned
                        if (instrument){
                            finetune = instrument.getFineTune();
                            if (finetune) root = Audio.getFineTuneForPeriod(root,finetune);
                        }

                        trackEffects.arpeggio = {
                            root: root,
                            interval1: root-Audio.getSemiToneFrom(root,x,finetune),
                            interval2: root-Audio.getSemiToneFrom(root,y,finetune),
                            step:1
                        };
					}


				}

				// set volume, even if no effect present
				// note: this is consistent with the Protracker 3.15 and later playback
				// on Protracker 2.3 and 3.0, the volume effect seems much bigger - why ? (see "nugget - frust.mod")
				if (note.instrument){
					trackEffects.volume = {
						value: defaultVolume
					};
				}

				break;
			case 1:
				// Slide Up
				value = value * -1;

				// note: on protracker 2 and 3 , the effectcache is NOT used on this effect
				// it is on Milkytracker (in all playback modes)

				if (me.inFTMode()){
					if (!value && trackEffectCache[track].slideUp) value = trackEffectCache[track].slideUp.value;
				}

				trackEffects.slide = {
					value: value
				};
				trackEffectCache[track].slideUp = trackEffects.slide;
				break;
			case 2:
				// Slide Down

				// note: on protracker 2 and 3 , the effectcache is NOT used on this effect
				// it is on Milkytracker (in all playback modes)

				if (me.inFTMode()){
					if (!value && trackEffectCache[track].slideDown) value = trackEffectCache[track].slideDown.value;
				}

				trackEffects.slide = {
					value: value
				};
				trackEffectCache[track].slideDown = trackEffects.slide;
				break;
			case 3:
				// Slide to Note - if there's a note provided, it is not played directly,
				// if the instrument number is set, the default volume of that instrument will be set

				// if value == 0 then the old slide will continue

				doPlayNote = false;
				// note: protracker2 switches samples on the fly if the instrument index is different from the previous instrument ...
				// Should we implement that?
				// fasttracker does not.
				// protracker 3 does not
				// milkytracker tries, but not perfect
				// the ProTracker clone of 8bitbubsy does this completely compatible to protracker2.

				var target = notePeriod;
				if (me.inFTMode() && noteIndex === NOTEOFF) target = 0;

				// avoid using the fineTune of another instrument if another instrument index is present
				if (trackNotes[track].currentInstrument) instrumentIndex = trackNotes[track].currentInstrument;

				if (target && instrumentIndex){
					// check if the instrument is finetuned
					var instrument = me.getInstrument(instrumentIndex);
					if (instrument && instrument.getFineTune()){
                        target = me.inFTMode() ?  instrument.getPeriodForNote(noteIndex,true) : Audio.getFineTuneForPeriod(target,instrument.getFineTune());
					}
				}

				var prevSlide = trackEffectCache[track].slide;

				if (prevSlide){
					if (!value) value = prevSlide.value;
				}
				if (!target) {
					target = trackEffectCache[track].defaultSlideTarget;
				}

				trackEffects.slide = {
					value: value,
					target: target,
					canUseGlissando: true,
					resetVolume: !!note.instrument,
					volume: defaultVolume
				};
				trackEffectCache[track].slide = trackEffects.slide;

				if (note.instrument){
					trackEffects.volume = {
						value: defaultVolume
					};
				}

				break;
			case 4:
				// vibrato
				// reset volume and vibrato timer if instrument number is present
				if (note.instrument) {
					if (trackNotes[track].startVolume) {
						trackEffects.volume = {
							value: volume
						};
					}

					trackNotes[track].vibratoTimer = 0;
				}

				x = value >> 4;
				y = value & 0x0f;

				var freq = (x*ticksPerStep)/64;

                var prevVibrato = trackEffectCache[track].vibrato;
				if (x == 0 && prevVibrato) freq = prevVibrato.freq;
				if (y == 0 && prevVibrato) y = prevVibrato.amplitude;

				trackEffects.vibrato = {
					amplitude: y,
					freq: freq
				};
				trackEffectCache[track].vibrato = trackEffects.vibrato;

				break;
			case 5:
				// continue slide to note
				doPlayNote = false;
				target = notePeriod;

				if (target && instrumentIndex){
					// check if the instrument is finetuned
					instrument = me.getInstrument(instrumentIndex);
					if (instrument && instrument.getFineTune()){
                        target = me.inFTMode() ?  Audio.getFineTuneForNote(noteIndex,instrument.getFineTune()) : Audio.getFineTuneForPeriod(target,instrument.getFineTune());
					}
				}

				value = 1;

				var prevSlide = trackEffectCache[track].slide;
				if (prevSlide){
					if (!target) target = prevSlide.target  || 0;
					value = prevSlide.value;
				}

				trackEffects.slide = {
					value: value,
					target: target
				};
				trackEffectCache[track].slide = trackEffects.slide;

				if (note.instrument){
					trackEffects.volume = {
						value: defaultVolume
					};
				}

				// and do volume slide
				value = note.param;
				if (!value){
					// don't do volume slide
				}else{
					if (note.param < 16){
						// slide down
						value = value * -1;
					}else{
						// slide up
						//value = note.param & 0x0f;
						value = note.param >> 4;
					}

					// this is based on max volume of 64 -> normalize to 100;
					value = value * 100/64;

					trackEffects.fade = {
						value: value,
						resetOnStep: !!note.instrument // volume only needs resetting when the instrument number is given, other wise the volue is remembered from the preious state
					};
					trackEffectCache[track].fade = trackEffects.fade;
				}

				break;


			case 6:
				// Continue Vibrato and do volume slide

				// reset volume and vibrato timer if instrument number is present
				if (note.instrument) {
					if (trackNotes[track].startVolume) {
						trackEffects.volume = {
							value: volume
						};
					}

					trackNotes[track].vibratoTimer = 0;
				}
				if (note.param){
					if (note.param < 16){
						// volume slide down
						value = value * -1;
					}else{
						// volume slide up
						value = note.param & 0x0f;
					}

					// this is based on max volume of 64 -> normalize to 100;
					value = value * 100/64;

					trackEffects.fade = {
						value: value
					};
					trackEffectCache[track].fade = trackEffects.fade;
				}else{
					// on Fasttracker this command is remembered - on Protracker it is not.
					if (Tracker.inFTMode()){
						if (trackEffectCache[track].fade) trackEffects.fade = trackEffectCache[track].fade;
					}
				}

				if (trackEffectCache[track].vibrato) trackEffects.vibrato = trackEffectCache[track].vibrato;
				break;
			case 7:
				// Tremolo
				// note: having a instrument number without a period doesn't seem te have any effect (protracker)
				// when only a period -> reset the wave form / timer

				if (notePeriod && !note.instrument) {
					if (trackNotes[track].startVolume) {
						trackEffects.volume = {
							value: volume
						};
					}

					trackNotes[track].tremoloTimer = 0;
				}

				x = value >> 4;
				y = value & 0x0f;

				//var amplitude = y * (ticksPerStep-1); Note: this is the formula in the mod spec, but this seems way off;
				var amplitude = y;
				var freq = (x*ticksPerStep)/64;

				var prevTremolo = trackEffectCache[track].tremolo;

				if (x==0 && prevTremolo) freq = prevTremolo.freq;
				if (y==0 && prevTremolo) amplitude = prevTremolo.amplitude;

				trackEffects.tremolo = {
					amplitude:amplitude,
					freq: freq
				};

				trackEffectCache[track].tremolo = trackEffects.tremolo;

				break;
			case 8:
				// Set Panning position
				trackEffects.panning = {
					value:value,
					slide: false
				};
				break;
			case 9:
				// Set instrument offset

				/* quirk in Protracker 1 and 2 ?
				 if NO NOTE is given but a instrument number is present,
				 then the offset is remembered for the next note WITHOUT instrument number
				 but only when the derived instrument number is the same as the offset instrument number
				 see "professional tracker" mod for example

				 also:
				 * if no instrument number is present: don't reset the offset
				  -> the effect cache of the previous 9 command of the instrument is used
				 * if a note is present REAPPLY the offset in the effect cache (but don't set start of instrument)
				  -> the effect cache now contains double the offset

				 */

				value =  value << 8 ;
				if (!value && trackEffectCache[track].offset){
					value = trackEffectCache[track].offset.stepValue || trackEffectCache[track].offset.value || 0;
				}
				var stepValue = value;

				if (SETTINGS.emulateProtracker1OffsetBug && !note.instrument && trackEffectCache[track].offset){
					// bug in PT1 and PT2: add to existing offset if no instrument number is given
					value += trackEffectCache[track].offset.value;
				}

				trackEffects.offset = {
					value: value,
					stepValue: stepValue
				};

				// note: keep previous trackEffectCache[track].offset.instrument intact
				trackEffectCache[track].offset = trackEffectCache[track].offset || {};
				trackEffectCache[track].offset.value = trackEffects.offset.value;
				trackEffectCache[track].offset.stepValue = trackEffects.offset.stepValue;


				if (SETTINGS.emulateProtracker1OffsetBug){

					// quirk in PT1 and PT2: remember instrument offset for instrument
					if (note.instrument) {
						//console.log("set offset cache for instrument " + note.instrument);
						trackEffectCache[track].offset.instrument = note.instrument;
					}

					// bug in PT1 and PT2: re-apply instrument offset in effect cache
					if (notePeriod) {
						//console.log("re-adding offset in effect cache");
						trackEffectCache[track].offset.value += stepValue;
					}

				}

				if (note.instrument){
					trackEffects.volume = {
						value: defaultVolume
					};
				}

				break;
			case 10:
				// volume slide
				if (note.param < 16){
					// slide down
					value = value * -1;
				}else{
					// slide up
					value = note.param >> 4;
				}

				// this is based on max volume of 64 -> normalize to 100;
				value = value * 100/64;

				if (!note.param){
					var prevFade = trackEffectCache[track].fade;
					if (prevFade) value = prevFade.value;
				}

				trackEffects.fade = {
					value: value,
					resetOnStep: !!note.instrument // volume only needs resetting when the instrument number is given, otherwise the volume is remembered from the previous state
				};

				//!!! in FT2 this effect is remembered - in Protracker it is not
				if (me.inFTMode()){
					trackEffectCache[track].fade = trackEffects.fade;
				}

				break;
			case 11:
				// Position Jump

				// quickfix for autoplay ...
				if (!Tracker.autoPlay){
					result.patternBreak = true;
					result.positionBreak = true;
					result.targetSongPosition = note.param;
					result.targetPatternPosition = 0;
				}
				break;
			case 12:
				//volume
				volume = (note.param/64)*100;
				// not this is not relative to the default instrument volume but sets the instrument volume
				trackEffects.volume = {
					value: volume
				};
				break;
			case 13:
				// Pattern Break
				result.patternBreak = true;
				x = value >> 4;
				y = value & 0x0f;
				result.targetPatternPosition = x*10 + y;
				break;
			case 14:
				// Subeffects
				var subEffect = value >> 4;
				var subValue = value & 0x0f;
					switch (subEffect){
						case 0:
							if (!me.inFTMode()) Audio.setAmigaLowPassFilter(!subValue,time);
							break;
						case 1: // Fine slide up
							subValue = subValue*-1;
							if (!subValue && trackEffectCache[track].fineSlide) subValue = trackEffectCache[track].fineSlide.value;
							trackEffects.slide = {
								value: subValue,
								fine: true
							};
							trackEffectCache[track].fineSlide = trackEffects.slide;
							break;
						case 2: // Fine slide down
							if (!subValue && trackEffectCache[track].fineSlide) subValue = trackEffectCache[track].fineSlide.value;
							trackEffects.slide = {
								value: subValue,
								fine: true
							};
							trackEffectCache[track].fineSlide = trackEffects.slide;
							break;
						case 3: // set glissando control
							trackEffectCache[track].glissando = !!subValue;
							break;
						case 4: // Set Vibrato Waveform
							switch(subValue){
								case 1: vibratoFunction = Audio.waveFormFunction.saw; break;
								case 2: vibratoFunction = Audio.waveFormFunction.square; break;
								case 3: vibratoFunction = Audio.waveFormFunction.sine; break; // random
								case 4: vibratoFunction = Audio.waveFormFunction.sine; break; // no retrigger
								case 5: vibratoFunction = Audio.waveFormFunction.saw; break; // no retrigger
								case 6: vibratoFunction = Audio.waveFormFunction.square; break; // no retrigger
								case 7: vibratoFunction = Audio.waveFormFunction.sine; break; // random, no retrigger
								default: vibratoFunction = Audio.waveFormFunction.sine; break;
							}
							break;
						case 5: // Set Fine Tune
							if (instrumentIndex){
								var instrument = me.getInstrument(instrumentIndex);
								trackEffects.fineTune = {
									original: instrument.getFineTune(),
									instrument: instrument
								};
								instrument.setFineTune(subValue);
							}
							break;
						case 6: // Pattern Loop
							if (subValue){
								patternLoopCount[track] = patternLoopCount[track] || 0;
								if (patternLoopCount[track]<subValue){
									patternLoopCount[track]++;
									result.patternBreak = true;
									result.positionBreak = true;
									result.targetSongPosition = songPos.position; // keep on same position
									result.targetPatternPosition = patternLoopStart[track] || 0; // should we default to 0 if no start was set or just ignore?

									console.log("looping to " + result.targetPatternPosition + " for "  + patternLoopCount[track] + "/" + subValue);
								}else{
									patternLoopCount[track] = 0;
								}
							}else{
								console.log("setting loop start to " + songPos.step + " on track " + track);
								patternLoopStart[track] = songPos.step;
							}
							break;
						case 7: // Set Tremolo WaveForm
							switch(subValue){
								case 1: tremoloFunction = Audio.waveFormFunction.saw; break;
								case 2: tremoloFunction = Audio.waveFormFunction.square; break;
								case 3: tremoloFunction = Audio.waveFormFunction.sine; break; // random
								case 4: tremoloFunction = Audio.waveFormFunction.sine; break; // no retrigger
								case 5: tremoloFunction = Audio.waveFormFunction.saw; break; // no retrigger
								case 6: tremoloFunction = Audio.waveFormFunction.square; break; // no retrigger
								case 7: tremoloFunction = Audio.waveFormFunction.sine; break; // random, no retrigger
								default: tremoloFunction = Audio.waveFormFunction.sine; break;
							}
							break;
						case 8: // Set Panning - is this used ?
							console.warn("Set Panning - not implemented");
							break;
						case 9: // Retrigger Note
							if (subValue){
								trackEffects.reTrigger = {
									value: subValue
								}
							}
							break;
						case 10: // Fine volume slide up
							subValue = subValue * 100/64;
							trackEffects.fade = {
								value: subValue,
								fine: true
							};
							break;
						case 11: // Fine volume slide down

							subValue = subValue * 100/64;

							trackEffects.fade = {
								value: -subValue,
								fine: true
							};
							break;
						case 12: // Cut Note
							if (subValue){
								if (subValue<ticksPerStep){
									trackEffects.cutNote = {
										value: subValue
									}
								}
							}else{
								doPlayNote = false;
							}
							break;
						case 13: // Delay Sample start
							if (subValue){
								if (subValue<ticksPerStep){
									time += tickTime * subValue;
								}else{
									doPlayNote = false;
								}
							}
							break;
						case 14: // Pattern Delay
							result.patternDelay = subValue;
							break;
						case 15: // Invert Loop
							// Don't think is used somewhere - ignore
							break;
						default:
							console.warn("Subeffect " + subEffect + " not implemented");
					}
				break;
			case 15:
				//speed
				// Note: shouldn't this be "set speed at time" instead of setting it directly?
				// TODO: -> investigate
				// TODO: Yes ... this is actually quite wrong FIXME !!!!
				
				// Note 2: this hase moved to the beginning of the "row" sequence:
				// we scan all tracks for tempo changes and set them before processing any other command.
				// this is consistant with PT and FT

				//if (note.param < 32){
				//	//if (note.param == 0) note.param = 1;
				//	Tracker.setAmigaSpeed(note.param,time);
				//}else{
				//	Tracker.setBPM(note.param)
				//}
				break;

            case 16:
                //Fasttracker only - global volume
				value = Math.min(value,64);
				if (!me.isPlugin) Audio.setMasterVolume(value/64,time);
                break;
			case 17:
				//Fasttracker only - global volume slide

				x = value >> 4;
				y = value & 0x0f;
				var currentVolume = Audio.getLastMasterVolume()*64;

				var amount = 0;
				if (x){
					var targetTime = time + (x * tickTime);
					amount = x*(ticksPerStep-1);
				}else if (y){
					targetTime = time + (y * tickTime);
					amount = -y*(ticksPerStep-1);
				}

				if (amount){
					value = (currentVolume+amount)/64;
					value = Math.max(0,value);
					value = Math.min(1,value);

					Audio.slideMasterVolume(value,targetTime);
				}

				break;
			case 20:
				//Fasttracker only - Key off
				if (me.inFTMode()){
					offInstrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);
					if (note.param && note.param>=ticksPerStep){
						// ignore: delay is too large
					}else{
						doPlayNote = false;
						if (offInstrument){
							if (note.param){
								trackEffects.noteOff = {
									value: note.param
								}
								doPlayNote = true;
							}else{
								volume = offInstrument.noteOff(time,trackNotes[track]);
								defaultVolume = volume;
							}
						}else{
							console.log("no instrument on track " + track);
							defaultVolume = 0;
						}
					}
				}
				break;
            case 21:
                //Fasttracker only - Set envelope position
                console.warn("Set envelope position not implemented");
                break;
			case 25:
				//Fasttracker only - Panning slide
				console.warn("Panning slide not implemented - track " + track);
				break;
			case 27:
				//Fasttracker only - Multi retrig note
				// still not 100% sure how this is supposed to work ...
				// see https://forum.openmpt.org/index.php?topic=4999.15
				// see lupo.xm for an example (RO1 command)
				trackEffects.reTrigger = {
					value: note.param
				};
				break;
			case 29:
				//Fasttracker only - Tremor
				console.warn("Tremor not implemented");
				break;
			case 33:
				//Fasttracker only - Extra fine porta
				console.warn("Extra fine porta not implemented");
				break;
			default:
				console.warn("unhandled effect: " + note.effect);
		}

		if (doPlayNote && instrumentIndex && notePeriod){
			// cut off previous note on the same track;
			cutNote(track,time);
			trackNotes[track] = {};

			if (instrument){
				trackNotes[track] = instrument.play(noteIndex,notePeriod,volume,track,trackEffects,time);
			}

			//trackNotes[track] = Audio.playSample(instrumentIndex,notePeriod,volume,track,trackEffects,time,noteIndex);
			trackEffectCache[track].defaultSlideTarget = trackNotes[track].startPeriod;
		}


		if (instrumentIndex) {
			trackNotes[track].currentInstrument =  instrumentIndex;

			// reset temporary instrument settings
			if (trackEffects.fineTune && trackEffects.fineTune.instrument){
				trackEffects.fineTune.instrument.setFineTune(trackEffects.fineTune.original || 0);
			}
		}

		if (instrument && instrument.hasVibrato()){
            trackNotes[track].hasAutoVibrato = true;
		}

		trackNotes[track].effects = trackEffects;
		trackNotes[track].note = note;

		return result;
	}

	function cutNote(track,time){
		// ramp to 0 volume to avoid clicks
		try{
			if (trackNotes[track].source) {
				var gain = trackNotes[track].volume.gain;
				gain.setValueAtTime(trackNotes[track].currentVolume/100,time-0.002);
				gain.linearRampToValueAtTime(0,time);
				trackNotes[track].source.stop(time+0.02);
				//trackNotes[track].source.stop(time);
			}
		}catch (e){

		}
	}
	me.cutNote = cutNote;

	function applyAutoVibrato(trackNote,currentPeriod){

        var instrument = me.getInstrument(trackNote.instrumentIndex);
        if (instrument){
            var _freq = -instrument.vibrato.rate/40;
            var _amp = instrument.vibrato.depth/8;
            if (me.useLinearFrequency) _amp *= 4;
            trackNote.vibratoTimer = trackNote.vibratoTimer||0;

            if (instrument.vibrato.sweep && trackNote.vibratoTimer<instrument.vibrato.sweep){
                var sweepAmp = 1-((instrument.vibrato.sweep-trackNote.vibratoTimer)/instrument.vibrato.sweep);
                _amp *= sweepAmp;
            }
            var instrumentVibratoFunction = instrument.getAutoVibratoFunction();
            var targetPeriod = instrumentVibratoFunction(currentPeriod,trackNote.vibratoTimer,_freq,_amp);
            trackNote.vibratoTimer++;
            return targetPeriod
        }
        return currentPeriod;
	}

	function applyEffects(track,time){

		var trackNote = trackNotes[track];
		var effects = trackNote.effects;

		if (!trackNote) return;
		if (!effects) return;

		var value;
		var autoVibratoHandled = false;

        trackNote.startVibratoTimer = trackNote.vibratoTimer||0;

        if (trackNote.resetPeriodOnStep && trackNote.source){
			// vibrato or arpeggio is done
			// for slow vibratos it seems logical to keep the current frequency, but apparently most trackers revert back to the pre-vibrato one
			var targetPeriod = trackNote.currentPeriod || trackNote.startPeriod;
			me.setPeriodAtTime(trackNote,targetPeriod,time);
			trackNote.resetPeriodOnStep = false;
		}

		if (effects.volume){
			var volume = effects.volume.value;
			if (trackNote.volume){
				//trackNote.startVolume = volume; // apparently the startVolume is not set here but the default volume of the note is used?
				trackNote.volume.gain.setValueAtTime(volume/100,time);
			}
			trackNote.currentVolume = volume;
		}

		if (effects.panning){
			value = effects.panning.value;
			if (value === 255) value = 254;
			if (trackNote.panning){
				trackNote.panning.pan.setValueAtTime((value-127)/127,time);
			}
		}

		if (effects.fade){
			value = effects.fade.value;
			var currentVolume;
			var startTick = 1;

			if (effects.fade.resetOnStep){
				currentVolume = trackNote.startVolume;
			}else{
				currentVolume = trackNote.currentVolume;
			}

			var steps = ticksPerStep;
			if (effects.fade.fine){
				// fine Volume Up or Down
				startTick = 0;
				steps = 1;
			}

			for (var tick = startTick; tick < steps; tick++){
				if (trackNote.volume){
					trackNote.volume.gain.setValueAtTime(currentVolume/100,time + (tick*tickTime));
					currentVolume += value;
					currentVolume = Math.max(currentVolume,0);
					currentVolume = Math.min(currentVolume,100);
				}
			}

			trackNote.currentVolume = currentVolume;

		}

		if (effects.slide){
			if (trackNote.source){
				var currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
				var targetPeriod = currentPeriod;


				var steps = ticksPerStep;
				if (effects.slide.fine){
					// fine Slide Up or Down
					steps = 2;
				}


				var slideValue = effects.slide.value;
				if (me.inFTMode() && me.useLinearFrequency) slideValue = effects.slide.value*4;
				value = Math.abs(slideValue);

				if (me.inFTMode() && effects.slide.resetVolume && (trackNote.volumeFadeOut || trackNote.volumeEnvelope)){
					// crap ... this should reset the volume envelope to the beginning ... annoying ...
					var instrument = me.getInstrument(trackNote.instrumentIndex);
					if (instrument) instrument.resetVolume(time,trackNote);

				}

                trackNote.vibratoTimer = trackNote.startVibratoTimer;

				// TODO: Why don't we use a RampToValueAtTime here ?
				for (var tick = 1; tick < steps; tick++){
					if (effects.slide.target){
						trackEffectCache[track].defaultSlideTarget = effects.slide.target;
						if (targetPeriod<effects.slide.target){
							targetPeriod += value;
							if (targetPeriod>effects.slide.target) targetPeriod = effects.slide.target;
						}else{
							targetPeriod -= value;
							if (targetPeriod<effects.slide.target) targetPeriod = effects.slide.target;
						}
					}else{
						targetPeriod += slideValue;
						if (trackEffectCache[track].defaultSlideTarget) trackEffectCache[track].defaultSlideTarget += slideValue;
					}

					if (!me.inFTMode()) targetPeriod = Audio.limitAmigaPeriod(targetPeriod);

					var newPeriod = targetPeriod;
					if (effects.slide.canUseGlissando && trackEffectCache[track].glissando){
						newPeriod = Audio.getNearestSemiTone(targetPeriod,trackNote.instrumentIndex);
					}

					if (newPeriod !== trackNote.currentPeriod){
						trackNote.currentPeriod = targetPeriod;

                        if (trackNote.hasAutoVibrato && me.inFTMode()){
                            targetPeriod = applyAutoVibrato(trackNote,targetPeriod);
                            autoVibratoHandled = true;
                        }
						me.setPeriodAtTime(trackNote,newPeriod,time + (tick*tickTime));

					}
				}
			}
		}

		if (effects.arpeggio){
			if (trackNote.source){

				var currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
				var targetPeriod;

				trackNote.resetPeriodOnStep = true;
                trackNote.vibratoTimer = trackNote.startVibratoTimer;

				for (var tick = 0; tick < ticksPerStep; tick++){
					var t = tick%3;

					if (t == 0) targetPeriod = currentPeriod;
					if (t == 1 && effects.arpeggio.interval1) targetPeriod = currentPeriod - effects.arpeggio.interval1;
					if (t == 2 && effects.arpeggio.interval2) targetPeriod = currentPeriod - effects.arpeggio.interval2;

                    if (trackNote.hasAutoVibrato && me.inFTMode()){
                        targetPeriod = applyAutoVibrato(trackNote,targetPeriod);
                        autoVibratoHandled = true;
                    }

                    me.setPeriodAtTime(trackNote,targetPeriod,time + (tick*tickTime));

				}
			}
		}

		if (effects.vibrato || (trackNote.hasAutoVibrato && !autoVibratoHandled)){
            effects.vibrato = effects.vibrato || {freq:0,amplitude:0};
			var freq = effects.vibrato.freq;
			var amp = effects.vibrato.amplitude;
			if (me.inFTMode() && me.useLinearFrequency) amp *= 4;

			trackNote.vibratoTimer = trackNote.vibratoTimer||0;

			if (trackNote.source) {
				trackNote.resetPeriodOnStep = true;
				currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;

                trackNote.vibratoTimer = trackNote.startVibratoTimer;
				for (var tick = 0; tick < ticksPerStep; tick++) {
					targetPeriod = vibratoFunction(currentPeriod,trackNote.vibratoTimer,freq,amp);

					// should we add or average the 2 effects?
					if (trackNote.hasAutoVibrato && me.inFTMode()){
                        targetPeriod = applyAutoVibrato(trackNote,targetPeriod);
                        autoVibratoHandled = true;
					}else{
                        trackNote.vibratoTimer++;
					}

					// TODO: if we ever allow multiple effect on the same tick then we should rework this as you can't have concurrent "setPeriodAtTime" commands
					me.setPeriodAtTime(trackNote,targetPeriod,time + (tick*tickTime));

				}
			}
		}

		if (effects.tremolo){
			var freq = effects.tremolo.freq;
			var amp = effects.tremolo.amplitude;

			trackNote.tremoloTimer = trackNote.tremoloTimer||0;

			if (trackNote.volume) {
				var _volume = trackNote.startVolume;

				for (var tick = 0; tick < ticksPerStep; tick++) {

					_volume = tremoloFunction(_volume,trackNote.tremoloTimer,freq,amp);

					if (_volume<0) _volume=0;
					if (_volume>100) _volume=100;

					trackNote.volume.gain.setValueAtTime(_volume/100,time + (tick*tickTime));
					trackNote.currentVolume = _volume;
					trackNote.tremoloTimer++;
				}
			}

		}

		if (effects.cutNote){
			if (trackNote.volume) {
				trackNote.volume.gain.setValueAtTime(0,time + (effects.cutNote.value*tickTime));
			}
			trackNote.currentVolume = 0;
		}

		if (effects.noteOff){
			var instrument = me.getInstrument(trackNote.instrumentIndex);
			if (instrument){
				trackNote.currentVolume = instrument.noteOff(time + (effects.noteOff.value*tickTime),trackNote);
			}
		}

		if (effects.reTrigger){
			var instrumentIndex = trackNote.instrumentIndex;
			var notePeriod = trackNote.startPeriod;
			volume = trackNote.startVolume;
			var noteIndex = trackNote.noteIndex;

			var triggerStep = effects.reTrigger.value || 1;
			var triggerCount = triggerStep;
			while (triggerCount<ticksPerStep){
				var triggerTime = time + (triggerCount * tickTime);
				cutNote(track,triggerTime);
				trackNotes[track] = Audio.playSample(instrumentIndex,notePeriod,volume,track,effects,triggerTime,noteIndex);
				triggerCount += triggerStep;
			}
		}

	}




	me.setBPM = function(newBPM,sender){
		var fromMaster = (sender && sender.isMaster); 
		if (me.isMaster || fromMaster){
			console.log("set BPM: " + bpm + " to " + newBPM);
			if (clock) clock.timeStretch(Audio.context.currentTime, [mainTimer], bpm / newBPM);
			if (!fromMaster) EventBus.trigger(EVENT.songBPMChangeIgnored,bpm);
			bpm = newBPM;
			tickTime = 2.5/bpm;
			EventBus.trigger(EVENT.songBPMChange,bpm);
		}else{
			EventBus.trigger(EVENT.songBPMChangeIgnored,newBPM);
		}
	};
	
	me.getBPM = function(){
		return bpm;
	};

	me.setAmigaSpeed = function(speed,sender){
		// 1 tick is 0.02 seconds on a PAL Amiga
		// 4 steps is 1 beat
		// the speeds sets the amount of ticks in 1 step
		// default is 6 -> 60/(6*0.02*4) = 125 bpm

		var fromMaster = (sender && sender.isMaster);
		if (me.isMaster || fromMaster){
			//note: this changes the speed of the song, but not the speed of the main loop
			ticksPerStep = speed;
			EventBus.trigger(EVENT.songSpeedChange,speed);
		}else{
			EventBus.trigger(EVENT.songSpeedChangeIgnored,speed);
		}

		
	};

	me.getAmigaSpeed = function(){
		return ticksPerStep;
	};

	me.getSwing = function(){
		return swing;
	};

	me.setSwing = function(newSwing){
		swing = newSwing;
	};

	me.getPatternLength = function(){
		return patternLength;
	};

	me.setPatternLength = function(value){
		patternLength = value;

		var currentLength = song.patterns[currentPattern].length;
		if (currentLength === patternLength) return;

		if (currentLength < patternLength){
			for (var step = currentLength; step<patternLength; step++){
				var row = [];
				var channel;
				for (channel = 0; channel < trackCount; channel++){
					row.push(Note());
				}
				song.patterns[currentPattern].push(row);
			}
		}else{
			song.patterns[currentPattern] = song.patterns[currentPattern].splice(0,patternLength);
			if (currentPatternPos>=patternLength){
				me.setCurrentPatternPos(patternLength-1);
			}
		}


		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.getTrackCount = function(){
		return trackCount;
	};

	me.setTrackCount = function(count){
		trackCount = count;

		for (var i=trackNotes.length;i<trackCount;i++) trackNotes.push({});
		for (i=trackEffectCache.length;i<trackCount;i++) trackEffectCache.push({});

		EventBus.trigger(EVENT.trackCountChange,trackCount);
	};

	me.toggleRecord = function(){
		me.stop();
		isRecording = !isRecording;
		EventBus.trigger(EVENT.recordingChange,isRecording);
	};

	me.isPlaying = function(){
		return isPlaying;
	};
	me.isRecording = function(){
		return isRecording;
	};

	me.setStateAtTime = function(time,state){
		trackerStates.push({time:time,state:state});
	};

	me.getStateAtTime = function(time){
		var result = undefined;
		for(var i = 0, len = trackerStates.length; i<len;i++){
			var state = trackerStates[0];
			if (state.time<time){
				result = trackerStates.shift().state;
			}else{
				return result;
			}
		}
		return result;
	};

	me.getTimeStates = function(){
		return trackerStates;
	};

	me.setPeriodAtTime = function(trackNote,period,time){
        // TODO: shouldn't we always set the full samplerate from the period?

		period = Math.max(period,1);

        if (me.inFTMode() && me.useLinearFrequency){
            var sampleRate = (8363 * Math.pow(2,((4608 - period) / 768)));
            var rate = sampleRate / Audio.context.sampleRate;
        }else{
            rate = (trackNote.startPeriod / period);
            rate = trackNote.startPlaybackRate * rate;
        }

        // note - seems to be a weird bug in chrome ?
        // try setting it twice with a slight delay
        // TODO: retest on Chrome windows and other browsers
        trackNote.source.playbackRate.setValueAtTime(rate,time);
        trackNote.source.playbackRate.setValueAtTime(rate,time + 0.005);
	};

	me.load = function(url,skipHistory,next,initial){
		url = url || "demomods/StardustMemories.mod";

		if (url.indexOf("://")<0 && url.indexOf("/") !== 0) url = Host.getBaseUrl() + url;

		if (UI){
			UI.setInfo("");
			UI.setLoading();
		}

		var process=function(result){

			// initial file is overridden by a load command of the host;
			if (initial && !Host.useInitialLoad) return;

			me.processFile(result,name,function(isMod){
				if (UI) UI.setStatus("Ready");

				if (isMod){
					var infoUrl = "";
					var source = "";

					if (typeof url === "string"){
						if (url.indexOf("modarchive.org")>0){
							var id = url.split('moduleid=')[1];
							song.filename = id.split("#")[1] || id;
							id = id.split("#")[0];
							id = id.split("&")[0];

							source = "modArchive";
							infoUrl = "https://modarchive.org/index.php?request=view_by_moduleid&query=" + id;
							EventBus.trigger(EVENT.songPropertyChange,song);
						}

						if (url.indexOf("modules.pl")>0){
							id = url.split('modules.pl/')[1];
							song.filename = id.split("#")[1] || id;
							id = id.split("#")[0];
							id = id.split("&")[0];

							source = "modules.pl";
							infoUrl = "http://www.modules.pl/?id=module&mod=" + id;
							EventBus.trigger(EVENT.songPropertyChange,song);
						}
					}

					if (UI) UI.setInfo(song.title,source,infoUrl);
				}

				if (UI && isMod && !skipHistory){

					var path = window.location.pathname;
					var filename = path.substring(path.lastIndexOf('/')+1);

					if (window.history.pushState){
						window.history.pushState({},name, filename + "?file=" + encodeURIComponent(url));
					}
				}

				if (isMod)checkAutoPlay(skipHistory);
				if (next) next();
			});
		};

		var name = "";
		if (typeof url === "string"){
			name = url.substr(url.lastIndexOf("/")+1);
			loadFile(url,function(result){
				process(result);
			})
		}else{
			name = url.name || "";
			skipHistory = true;
			process(url.buffer || url);
		}

	};

	var checkAutoPlay = function(skipHistory){
		var autoPlay = getUrlParameter("autoplay");
		if (Tracker.autoPlay) autoPlay = "1";
		if (!UI && skipHistory) autoPlay = "1";
		if ((autoPlay == "true")  || (autoPlay == "1")){
			Tracker.playSong();
		}
	};

	me.handleUpload = function(files){
		console.log("file uploaded");
		if (files.length){
			var file = files[0];

			var reader = new FileReader();
			reader.onload = function(){
				me.processFile(reader.result,file.name,function(isMod){
					if (UI) UI.setStatus("Ready");
				});
			};
			reader.readAsArrayBuffer(file);
		}
	};

	me.processFile = function(arrayBuffer, name , next){

		var isMod = false;
		var file = new BinaryStream(arrayBuffer,true);
		var result = FileDetector.detect(file,name);

		if (result && result.name == "ZIP"){
			console.log("extracting zip file");

			if (UI) UI.setStatus("Extracting Zip file",true);
			if (typeof UZIP !== "undefined") {
				// using UZIP: https://github.com/photopea/UZIP.js
				var myArchive = UZIP.parse(arrayBuffer);
				console.log(myArchive);
				for (var name in myArchive) {
					me.processFile(myArchive[name].buffer, name, next);
					break; // just use first entry
				}
			} else {
				// if UZIP wasn't loaded use zip.js
				zip.workerScriptsPath = "script/src/lib/zip/";
				zip.useWebWorkers = Host.useWebWorkers;
	
				//ArrayBuffer Reader and Write additions: https://github.com/gildas-lormeau/zip.js/issues/21
	
				zip.createReader(new zip.ArrayBufferReader(arrayBuffer), function(reader) {
					var zipEntry;
					var size = 0;
					reader.getEntries(function(entries) {
						if (entries && entries.length){
							entries.forEach(function(entry){
								if (entry.uncompressedSize>size){
									size = entry.uncompressedSize;
									zipEntry = entry;
								}
							});
						}
						if (zipEntry){
							zipEntry.getData(new zip.ArrayBufferWriter,function(data){
								if (data && data.byteLength) {
									me.processFile(data,name,next);
								}
							})
						}else{
							console.error("Zip file could not be read ...");
							if (next) next(false);
						}
					});
				}, function(error) {
					console.error("Zip file could not be read ...");
					if (next) next(false);
				});
			}
		}

		if (result.isMod && result.loader){
			isMod = true;
			if (me.isPlaying()) me.stop();
			resetDefaultSettings();

			song = result.loader().load(file,name);
			song.filename = name;

			onModuleLoad();

		}

		if (result.isSample){
			// check for player only lib
			if (typeof Editor !== "undefined") {
				Editor.importSample(file,name);
			}
		}

		if (next) next(isMod);

	};

	me.getSong = function(){
		return song;
	};

	me.getInstruments = function(){
		return instruments;
	};

	me.getInstrument = function(index){
		return instruments[index];
	};

	me.setInstrument = function(index, instrument){
		instrument.instrumentIndex = index;
		instruments[index] = instrument;
	};


	function onModuleLoad(){
		if (UI) UI.setInfo(song.title);

		if (song.channels) me.setTrackCount(song.channels);

		prevPatternPos = undefined;
		prevInstrumentIndex = undefined;
		prevPattern = undefined;
		prevSongPosition = undefined;

		me.setCurrentSongPosition(0);
		me.setCurrentPatternPos(0);
		me.setCurrentInstrumentIndex(1);

		me.clearEffectCache();

		EventBus.trigger(EVENT.songLoaded,song);
		EventBus.trigger(EVENT.songPropertyChange,song);
	}

	function resetDefaultSettings(){
		EventBus.trigger(EVENT.songBPMChangeIgnored,0);
		EventBus.trigger(EVENT.songSpeedChangeIgnored,0);
		me.setAmigaSpeed(6);
		me.setBPM(125);

		vibratoFunction = Audio.waveFormFunction.sine;
		tremoloFunction = Audio.waveFormFunction.sine;

		trackEffectCache = [];
		trackNotes = [];
		for (var i=0;i<trackCount;i++){
			trackNotes.push({});
			trackEffectCache.push({});
		}
		me.useLinearFrequency = false;
		me.setTrackerMode(TRACKERMODE.PROTRACKER,true);
		if (!me.isPlugin) Audio.setMasterVolume(1);
		Audio.setAmigaLowPassFilter(false,0);
		if (typeof StateManager !== "undefined") StateManager.clear();
	}

	me.clearEffectCache = function(){
		trackEffectCache = [];

		for (var i=0;i<trackCount;i++){
			trackEffectCache.push({});
		}
	};

	me.clearInstruments = function(count){
		if (!song) return;
		var instrumentContainer = [];
		var max  = count || song.instruments.length-1;
        instruments = [];
		for (i = 1; i <= max; i++) {
            me.setInstrument(i,Instrument());
			instrumentContainer.push({label: i + " ", data: i});
		}
		song.instruments = instruments;

		EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
		EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
	};

	me.setTrackerMode = function(mode,force){

		var doChange = function(){
			trackerMode = mode;
			SETTINGS.emulateProtracker1OffsetBug = !me.inFTMode();
			EventBus.trigger(EVENT.trackerModeChanged,mode);
		}

		//do some validation when changing from FT to MOD
		if (mode === TRACKERMODE.PROTRACKER && !force){
			if (Tracker.getInstruments().length>32){
				UI.showDialog("WARNING !!!//This file has more than 31 instruments./If you save this file as .MOD, only the first 31 instruments will be included.//Are you sure you want to continue?",function(){
					doChange();
				},function(){

				});
			}else{
				doChange();
			}
		}else{
			doChange();
		}
	};
	me.getTrackerMode = function(){
		return trackerMode;
	};
	me.inFTMode = function(){
		return trackerMode === TRACKERMODE.FASTTRACKER
	};


	me.new = function(){
		resetDefaultSettings();
		song = {
			patterns:[],
			instruments:[]
		};
        me.clearInstruments(31);

		song.typeId = "M.K.";
		song.title = "new song";
		song.length = 1;
		song.restartPosition = 0;

		song.patterns.push(getEmptyPattern());

		var patternTable = [];
		for (var i = 0; i < 128; ++i) {
			patternTable[i] = 0;
		}
		song.patternTable = patternTable;

		onModuleLoad();
	};


	me.clearInstrument = function(){
		instruments[currentInstrumentIndex]=Instrument();
		EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
		EventBus.trigger(EVENT.instrumentNameChange,currentInstrumentIndex);
	};

	me.getFileName = function(){
		return song.filename || (song.title ? song.title.replace(/ /g, '-').replace(/\W/g, '') + ".mod" : "new.mod");
	};

	function getEmptyPattern(){
		var result = [];
		for (var step = 0; step<patternLength; step++){
			var row = [];
			var channel;
			for (channel = 0; channel < trackCount; channel++){
				row.push(Note());
			}
			result.push(row);
		}
		return result;
	}

	me.useLinearFrequency = true;



	return me;
}());
;
var PreLoader = function(){
	var me = {};

	me.load = function(urls,type,next){
		me.type = type || PRELOADTYPE.image;
		me.loadCount = 0;
		me.max = urls.length;
		me.next = next;

		for (var i = 0, len = urls.length; i < len; i++)
			loadAsset(urls[i]);
	};

	var loadAsset = function(url){
		if (me.type == PRELOADTYPE.image){
			var img = new Image();
			img.onload = function(){
				cachedAssets.images[url] = this;
				if (++me.loadCount == me.max)
					if (me.next) me.next();
			};
			img.onerror = function(){
				alert('BufferLoader: XHR error');
			};
			img.src = url;
		}

		if (me.type == PRELOADTYPE.audio){


			var req = new XMLHttpRequest();
			req.responseType = "arraybuffer";
			req.open("GET", url, true);

			req.onload = function() {
				// Asynchronously decode the audio file data in request.response
				Audio.context.decodeAudioData(
					req.response,
					function(buffer) {
						if (!buffer) {
							alert('error decoding file data: ' + url);
							return;
						}
						cachedAssets.audio[url] = buffer;
						if (++me.loadCount == me.max)
							if (me.next) me.next();
					},
					function(error) {
						console.error('decodeAudioData error', error);
					}
				);
			};

			req.onerror = function() {
				alert('BufferLoader: XHR error');
			};

			req.send();
		}



		//request.responseType = "arraybuffer";
	};


	return me;
};;
var FetchService = (function() {

	// somewhat Jquery syntax compatible for easy portability

	var me = {};

	var defaultAjaxTimeout = 30000;

	me.get = function(url,next){
		me.ajax({
			url : url,
			success: function(data){next(data)},
			error: function(xhr){next(undefined,xhr)}
		});
	};

	//<!--
	me.post = function(url,data,next){
		var sData = data;
		if (typeof data === "object"){
			sData = "";
			for (var key in data){
				if (data.hasOwnProperty(key)){
					sData += "&" + key + "=" + encodeURIComponent(data[key]);
				}
			}
			if (sData.length) sData = sData.substr(1);
		}
		me.ajax({
			method: "POST",
			url : url,
			data: sData,
			datatype: "form",
			success: function(data){next(data)},
			error: function(xhr){next(undefined,xhr)}
		})
	};

	me.sendBinary = function(url,data,next){
		me.ajax({
			method: "POST",
			url : url,
			data: data,
			success: function(data){next(data)},
			error: function(xhr){next(undefined,xhr)}
		})
	};
	//-->

	me.json = function(url,next){
		if (typeof next == "undefined") next=function(){};
		me.ajax({
			url : url,
			cache: false,
			datatype: "json",
			headers: [{key:"Accept", value:"application/json"}],
			success: function(data){next(data)},
			error: function(xhr){next(undefined,xhr)}
		});
	};

	me.html = function(url,next){
		me.ajax({
			url : url,
			cache: false,
			datatype: "html",
			success: function(data){next(data)},
			error: function(xhr){next(undefined,xhr)}
		});
	};


	me.ajax = function(config){

		var xhr = new XMLHttpRequest();

		config.error = config.error || function(){config.success(false)};

		if (config.datatype === "jsonp"){
			console.error(log.error() +  " ERROR: JSONP is not supported!");
			config.error(xhr);
		}

		var url = config.url;

		if (typeof config.cache === "boolean" && !config.cache && Host.useUrlParams){
			var r = new Date().getTime();
			url += url.indexOf("?")>0 ? "&r=" + r : "?r=" + r;
		}

		var method = config.method || "GET";

		xhr.onreadystatechange = function(){
			if(xhr.readyState < 4) {
				return;
			}
			if(xhr.readyState === 4) {
				if(xhr.status !== 200 && xhr.status !== 201) {
					config.error(xhr);
				}else{
					var result = xhr.responseText;
					if (config.datatype === "json") result = JSON.parse(result);
					if (config.datatype === "html"){
						result = document.createElement("div");
						result.innerHTML = xhr.responseText;
					}
					config.success(result);
				}
			}
		};

		xhr.ontimeout = function (e) {
			console.error(log.error() + "timeout while getting " + url);
		};

		xhr.open(method, url, true);
		xhr.timeout = config.timeout || defaultAjaxTimeout;

		if (config.headers){
			config.headers.forEach(function(header){
				xhr.setRequestHeader(header.key, header.value);
			})
		}

		var data = config.data || '';
		if (method === "POST" && config.data && config.datatype === "form"){
			xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		}

		xhr.send(data);
	};

	return me;
}());

;
var FileDetector = function(){
	var me = {};

	var fileType = {
		unknown: {name: "UNKNOWN"},
		unsupported: {name: "UNSUPPORTED"},
		mod_ProTracker: {name: "PROTRACKER", isMod: true, loader: function(){return ProTracker()}},
		mod_SoundTracker: {name: "SOUNDTRACKER", isMod: true, loader: function(){return SoundTracker()}},
		mod_FastTracker: {name: "FASTTRACKER", isMod: true, loader: function(){return FastTracker()}},
		sample: {name: "SAMPLE",isSample:true},
		zip: {name: "ZIP"}
	};

	me.detect = function(file,name){
		var length = file.length;
		var id = "";

		id = file.readString(17,0);
		if (id == "Extended Module: "){
			return fileType.mod_FastTracker;
		}


		if (length>1100){
			id = file.readString(4,1080); // M.K.
		}
		console.log("Format ID: " + id);

		if (id == "M.K.") return fileType.mod_ProTracker;
		if (id == "M!K!") return fileType.mod_ProTracker; // more then 64 patterns
		if (id == "M&K!") return fileType.mod_ProTracker; // what's different? example https://modarchive.org/index.php?request=view_by_moduleid&query=76607
		if (id == "FLT4") return fileType.mod_ProTracker;
		if (id == "2CHN") return fileType.mod_ProTracker;
		if (id == "6CHN") return fileType.mod_ProTracker;
		if (id == "8CHN") return fileType.mod_ProTracker;
		if (id == "10CH") return fileType.mod_ProTracker;
		if (id == "12CH") return fileType.mod_ProTracker;
		if (id == "14CH") return fileType.mod_ProTracker;
		if (id == "16CH") return fileType.mod_ProTracker;
		if (id == "18CH") return fileType.mod_ProTracker;
		if (id == "20CH") return fileType.mod_ProTracker;
		if (id == "22CH") return fileType.mod_ProTracker;
		if (id == "24CH") return fileType.mod_ProTracker;
		if (id == "26CH") return fileType.mod_ProTracker;
		if (id == "28CH") return fileType.mod_ProTracker;
		if (id == "30CH") return fileType.mod_ProTracker;
		if (id == "32CH") return fileType.mod_ProTracker;

		var ext = "";
		if (name && name.length>4) ext = name.substr(name.length-4);
		ext = ext.toLowerCase();

		if (ext == ".wav") return fileType.sample;
		if (ext == ".mp3") return fileType.sample;
		if (ext == ".iff") return fileType.sample;
		if (ext == ".zip") return fileType.zip;

		var zipId = file.readString(2,0);
		if (zipId == "PK") return fileType.zip;



		// might be an 15 instrument mod?
		// filename should at least contain a "." this avoids checking all ST-XX samples

		// example: https://modarchive.org/index.php?request=view_by_moduleid&query=35902 or 36954
		// more info: ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt


		if (name && name.indexOf(".")>=0 && length>1624){
			// check for ascii
			function isAcii(byte){
				return byte<128;
			}

			function isST(){
				console.log("Checking for old 15 instrument soundtracker format");
				file.goto(0);
				for (var i = 0; i<20;i++) if (!isAcii(file.readByte())) return false;

				console.log("First 20 chars are ascii, checking Samples");

				// check samples
				var totalSampleLength = 0;
				var probability =0;
				for (var s = 0; s<15;s++) {
					for (i = 0; i<22;i++) if (!isAcii(file.readByte())) return false;
					file.jump(-22);
					var name = file.readString(22);
					if (name.toLowerCase().substr(0,3) == "st-") probability += 10;
					if (probability>20) return true;
					totalSampleLength += file.readWord();
					file.jump(6);
				}

				if (totalSampleLength*2 + 1624 > length) return false;

				return true;
			}

			var isSoundTracker = isST();
			if (isSoundTracker){
				return fileType.mod_SoundTracker;
			}
		}


		// fallback to sample
		return fileType.sample;

	};

	return me;
}();;
var ProTracker = function(){
	var me = {};

	me.load = function(file,name){

		Tracker.setTrackerMode(TRACKERMODE.PROTRACKER,true);
        Tracker.useLinearFrequency = false;
        Tracker.clearInstruments(31);

		var song = {
			patterns:[],
			restartPosition: 1
		};

		var patternLength = 64;
		var instrumentCount = 31;
		var channelCount = 4;


		//see https://www.aes.id.au/modformat.html

		song.typeId = file.readString(4,1080);
		song.title = file.readString(20,0);

		if (song.typeId === "2CHN") channelCount = 2;
		if (song.typeId === "6CHN") channelCount = 6;
		if (song.typeId === "8CHN") channelCount = 8;
		if (song.typeId === "10CH") channelCount = 10;
		if (song.typeId === "12CH") channelCount = 12;
		if (song.typeId === "14CH") channelCount = 14;
		if (song.typeId === "16CH") channelCount = 16;
		if (song.typeId === "18CH") channelCount = 18;
		if (song.typeId === "20CH") channelCount = 20;
		if (song.typeId === "22CH") channelCount = 22;
		if (song.typeId === "24CH") channelCount = 24;
		if (song.typeId === "26CH") channelCount = 26;
		if (song.typeId === "28CH") channelCount = 28;
		if (song.typeId === "30CH") channelCount = 30;
		if (song.typeId === "32CH") channelCount = 32;

		song.channels = channelCount;

		var sampleDataOffset = 0;
		for (i = 1; i <= instrumentCount; ++i) {
			var instrumentName = file.readString(22);
			var sampleLength = file.readWord(); // in words

			var instrument = Instrument();
			instrument.name = instrumentName;

			instrument.sample.length = instrument.sample.realLen = sampleLength << 1;
			var finetune = file.readUbyte();
			if (finetune>16) finetune = finetune%16;
			if (finetune>7) finetune -= 16;
			instrument.setFineTune(finetune);
			instrument.sample.volume   = file.readUbyte();
			instrument.sample.loop.start    = file.readWord() << 1;
			instrument.sample.loop.length   = file.readWord() << 1;

			instrument.sample.loop.enabled = instrument.sample.loop.length>2;
			instrument.sample.loop.type = LOOPTYPE.FORWARD;

			instrument.pointer = sampleDataOffset;
			sampleDataOffset += instrument.sample.length;
			instrument.setSampleIndex(0);
			Tracker.setInstrument(i,instrument);

			
		}
		song.instruments = Tracker.getInstruments();


		file.goto(950);
		song.length = file.readUbyte();
		file.jump(1); // 127 byte

		var patternTable = [];
		var highestPattern = 0;
		for (var i = 0; i < 128; ++i) {
			patternTable[i] = file.readUbyte();
			if (patternTable[i] > highestPattern) highestPattern = patternTable[i];
		}
		song.patternTable = patternTable;

		file.goto(1084);

		// pattern data

		for (i = 0; i <= highestPattern; ++i) {

			var patternData = [];

			for (var step = 0; step<patternLength; step++){
				var row = [];
				var channel;
				for (channel = 0; channel < channelCount; channel++){
					var note = Note();
					var trackStepInfo = file.readUint();

					note.setPeriod((trackStepInfo >> 16) & 0x0fff);
					note.effect = (trackStepInfo >>  8) & 0x0f;
					note.instrument = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
					note.param  = trackStepInfo & 0xff;

					row.push(note);
				}

				// fill with empty data for other channels
				// TODO: not needed anymore ?
				for (channel = channelCount; channel < Tracker.getTrackCount(); channel++){
					row.push(Note())
				}


				patternData.push(row);
			}
			song.patterns.push(patternData);

			//file.jump(1024);
		}

		var instrumentContainer = [];

		for(i=1; i <= instrumentCount; i++) {
			instrument = Tracker.getInstrument(i);
			if (instrument){
				console.log(
					"Reading sample from 0x" + file.index + " with length of " + instrument.sample.length + " bytes and repeat length of " + instrument.sample.loop.length);


				var sampleEnd = instrument.sample.length;

				if (instrument.sample.loop.length>2 && SETTINGS.unrollShortLoops && instrument.sample.loop.length<1000){
					// cut off trailing bytes for short looping samples
					sampleEnd = Math.min(sampleEnd,instrument.sample.loop.start + instrument.sample.loop.length);
					instrument.sample.length = sampleEnd;
				}

				for (j = 0; j<sampleEnd; j++){
					var b = file.readByte();
					// ignore first 2 bytes
					if (j<2)b=0;
					instrument.sample.data.push(b / 127)
				}

				// unroll short loops?
				// web audio loop start/end is in seconds
				// doesn't work that well with tiny loops

				if ((SETTINGS.unrollShortLoops || SETTINGS.unrollLoops) && instrument.sample.loop.length>2){

					var loopCount = Math.ceil(40000 / instrument.sample.loop.length) + 1;

					if (!SETTINGS.unrollLoops) loopCount = 0;

					var resetLoopNumbers = false;
					var loopLength = 0;
					if (SETTINGS.unrollShortLoops && instrument.sample.loop.length<1600){

						loopCount = Math.floor(1000/instrument.sample.loop.length);
						resetLoopNumbers = true;
					}

					for (var l=0;l<loopCount;l++){
						var start = instrument.sample.loop.start;
						var end = start + instrument.sample.loop.length;
						for (j=start; j<end; j++){
							instrument.sample.data.push(instrument.sample.data[j]);
						}
						loopLength += instrument.sample.loop.length;
					}

					if (resetLoopNumbers && loopLength){
						instrument.sample.loop.length += loopLength;
						instrument.sample.length += loopLength;
					}
				}

				instrumentContainer.push({label: i + " " + instrument.name, data: i});
			}
		}
        EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);

		return song;
	};

	//<!--
	me.write = function(next){

		var song = Tracker.getSong();
		var instruments = Tracker.getInstruments();
		var trackCount = Tracker.getTrackCount();
		var patternLength = Tracker.getPatternLength();

		// get filesize

		var fileSize = 20 + (31*30) + 1 + 1 + 128 + 4;

		var highestPattern = 0;
		for (i = 0;i<128;i++){
			var p = song.patternTable[i] || 0;
			highestPattern = Math.max(highestPattern,p);
		}

		fileSize += ((highestPattern+1)* (trackCount * 256));

		if (Tracker.getInstruments().length>32){
			UI.showDialog("WARNING !!!//This file has more than 31 instruments.//Only the first 31 instruments will be included.");
		}
		var startI = 1;
		var endI = 31;
		var i;

		for (i = startI;i<=endI;i++){
			var instrument = instruments[i];
			if (instrument){
				// reset to first sample in case we come from a XM file
				instrument.setSampleIndex(0);
				fileSize += instrument.sample.length;
			}else{
				// +4 ?
			}
		}

		var arrayBuffer = new ArrayBuffer(fileSize);
		var file = new BinaryStream(arrayBuffer,true);

		// write title
		file.writeStringSection(song.title,20);

		// write instrument data
		for (i = startI;i<=endI;i++){
			var instrument = instruments[i];
			if (instrument){
				// limit instrument size to 128k
				//TODO: show a warning when this is exceeded ...
				instrument.sample.length = Math.min(instrument.sample.length, 131070); // = FFFF * 2

				file.writeStringSection(instrument.name,22);
				file.writeWord(instrument.sample.length >> 1);
				file.writeUByte(instrument.sample.finetune);
				file.writeUByte(instrument.sample.volume);
				file.writeWord(instrument.sample.loop.start >> 1);
				file.writeWord(instrument.sample.loop.length >> 1);
			}else{
				file.clear(30);
			}
		}


		file.writeUByte(song.length);
		file.writeUByte(127);

		// patternPos
		for (i = 0;i<128;i++){
			var p = song.patternTable[i] || 0;
			file.writeUByte(p);
		}

		file.writeString( trackCount == 8 ? "8CHN" : "M.K.");

		// pattern Data

		for (i=0;i<=highestPattern;i++){

			var patternData = song.patterns[i];

			// TODO - should be patternLength of pattern;
			for (var step = 0; step<patternLength; step++){
				var row = patternData[step];
				for (var channel = 0; channel < trackCount; channel++){
					if (row){
						var trackStep = row[channel];
						var uIndex = 0;
						var lIndex = trackStep.instrument;

						if (lIndex>15){
							uIndex = 16; // TODO: Why is this 16 and not 1 ? Nobody wanted 255 instruments instead of 31 ?
							lIndex = trackStep.instrument - 16;
						}

						var v = (uIndex << 24) + (trackStep.period << 16) + (lIndex << 12) + (trackStep.effect << 8) + trackStep.param;
						file.writeUint(v);
					}else{
						file.writeUint(0);
					}

				}
			}
		}

		// sampleData;
		for (i = startI;i<=endI;i++){
			var instrument = instruments[i];
			if (instrument && instrument.sample.data && instrument.sample.length){
				// should we put repeat info here?
				//file.clear(2);
				var d;
				// instrument length is in word
				for (var j = 0; j < instrument.sample.length; j++){
					d = instrument.sample.data[j] || 0;
					file.writeByte(Math.round(d*127));
				}
				console.log("write instrument with " + instrument.sample.length + " length");
			}else{
				// still write 4 bytes?
			}
		}


		if (next) next(file);
	};
	//-->

	return me;
};;
var SoundTracker = function(){
	var me = {};

	me.load = function(file,name){

		Tracker.setTrackerMode(TRACKERMODE.PROTRACKER,true);
        Tracker.useLinearFrequency = false;
		Tracker.clearInstruments(15);

		var song = {
			patterns:[],
			restartPosition: 1
		};

		var patternLength = 64;
		var instrumentCount = 15;


		//see https://www.aes.id.au/modformat.html
		// and ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt for differences

		song.typeId = "ST";
		song.channels = 4;
		song.title = file.readString(20,0);

		var sampleDataOffset = 0;
		for (i = 1; i <= instrumentCount; ++i) {
			var sampleName = file.readString(22);
			var sampleLength = file.readWord(); // in words

			var instrument = Instrument();
			instrument.name = sampleName;

			instrument.sample.length = instrument.realLen = sampleLength << 1;
			instrument.sample.volume   = file.readWord();
			// NOTE: does the high byte of the volume sometimes contain finetune data?
			instrument.setFineTune(0);
			instrument.sample.loop.start     = file.readWord(); // in bytes!
			instrument.sample.loop.length   = file.readWord() << 1;

			instrument.sample.loop.enabled = instrument.sample.loop.length>2;
			instrument.sample.loop.type = LOOPTYPE.FORWARD;

			// if an instrument contains a loops, only the loop part is played
			// TODO

			instrument.pointer = sampleDataOffset;
			sampleDataOffset += instrument.sample.length;
			instrument.setSampleIndex(0);
			Tracker.setInstrument(i,instrument);

		}
		song.instruments = Tracker.getInstruments();

		file.goto(470);

		song.length = file.readUbyte();
		song.speed = file.readUbyte();

		var patternTable = [];
		var highestPattern = 0;
		for (var i = 0; i < 128; ++i) {
			patternTable[i] = file.readUbyte();
			if (patternTable[i] > highestPattern) highestPattern = patternTable[i];
		}
		song.patternTable = patternTable;

		file.goto(600);

		// pattern data

		for (i = 0; i <= highestPattern; ++i) {

			var patternData = [];

			for (var step = 0; step<patternLength; step++){
				var row = [];
				var channel;
				for (channel = 0; channel < 4; channel++){
					var trackStep = {};
					var trackStepInfo = file.readUint();

					trackStep.period = (trackStepInfo >> 16) & 0x0fff;
					trackStep.effect = (trackStepInfo >>  8) & 0x0f;
					trackStep.instrument = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
					trackStep.param  = trackStepInfo & 0xff;

					row.push(trackStep);
				}

				// fill with empty data for other channels
				for (channel = 4; channel < Tracker.getTrackCount(); channel++){
					row.push({note:0,effect:0,instrument:0,param:0});
				}

				patternData.push(row);
			}
			song.patterns.push(patternData);

			//file.jump(1024);
		}

		var instrumentContainer = [];

		for(i=1; i <= instrumentCount; i++) {
			instrument = Tracker.getInstrument(i);
			if (instrument){
				console.log("Reading sample from 0x" + file.index + " with length of " + instrument.sample.length + " bytes and repeat length of " + instrument.sample.loop.length);

				var sampleEnd = instrument.sample.length;

				for (j = 0; j<sampleEnd; j++){
					var b = file.readByte();
					// ignore first 2 bytes
					if (j<2)b=0;
					instrument.sample.data.push(b / 127)
				}

				instrumentContainer.push({label: i + " " + instrument.name, data: i});
			}
		}
        EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);

		return song;
	};

	return me;
};;
var FastTracker = function(){
    var me = {};

    // see ftp://ftp.modland.com/pub/documents/format_documentation/FastTracker%202%20v2.04%20(.xm).html
    me.load = function(file,name){

        console.log("loading FastTracker");
        Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER,true);
		Tracker.clearInstruments(1);

        var mod = {};
        var song = {
            patterns:[],
			instruments:[]
        };

        file.litteEndian = true;

        file.goto(17);
        song.title = file.readString(20);
        file.jump(1); //$1a

        mod.trackerName = file.readString(20);
        mod.trackerVersion = file.readByte();
        mod.trackerVersion = file.readByte() + "." + mod.trackerVersion;
        mod.headerSize = file.readDWord(); // is this always 276?
        mod.songlength = file.readWord();
        mod.restartPosition = file.readWord();
        mod.numberOfChannels = file.readWord();
        mod.numberOfPatterns = file.readWord(); // this is sometimes more then the actual number? should we scan for highest pattern? -> YES! -> NO!
        mod.numberOfInstruments = file.readWord();
        mod.flags = file.readWord();
        if (mod.flags%2 === 1){
            Tracker.useLinearFrequency = true;
        }else{
            Tracker.useLinearFrequency = false;
        }

        mod.defaultTempo = file.readWord();
        mod.defaultBPM = file.readWord();

        console.log("File was made in " + mod.trackerName + " version " + mod.trackerVersion);


        var patternTable = [];
        var highestPattern = 0;
        for (var i = 0; i < mod.songlength; ++i) {
            patternTable[i] = file.readUbyte();
            if (highestPattern < patternTable[i]) highestPattern = patternTable[i];
        }
        song.patternTable = patternTable;
        song.length = mod.songlength;
        song.channels = mod.numberOfChannels;
        song.restartPosition = (mod.restartPosition + 1);

        var fileStartPos = 60 + mod.headerSize;
        file.goto(fileStartPos);


        for (i = 0; i < mod.numberOfPatterns; i++) {

            var patternData = [];
            var thisPattern = {};

            thisPattern.headerSize = file.readDWord();
            thisPattern.packingType = file.readUbyte(); // always 0
            thisPattern.patternLength = file.readWord();
            thisPattern.patternSize = file.readWord();

            fileStartPos += thisPattern.headerSize;
            file.goto(fileStartPos);

            for (var step = 0; step<thisPattern.patternLength; step++){
                var row = [];
                var channel;
                for (channel = 0; channel < mod.numberOfChannels; channel++){
                    var note = Note();
                    var v = file.readUbyte();

                    if (v & 128) {
                        if (v &  1) note.setIndex(file.readUbyte());
                        if (v &  2) note.instrument = file.readUbyte();
                        if (v &  4) note.volumeEffect = file.readUbyte();
                        if (v &  8) note.effect = file.readUbyte();
                        if (v & 16) note.param  = file.readUbyte();
                    } else {
                        note.setIndex(v);
                        note.instrument = file.readUbyte();
                        note.volumeEffect = file.readUbyte();
                        note.effect = file.readUbyte();
                        note.param  = file.readUbyte();
                    }

                    row.push(note);


                }
                patternData.push(row);
            }

            fileStartPos += thisPattern.patternSize;
            file.goto(fileStartPos);

            song.patterns.push(patternData);
        }

        var instrumentContainer = [];

        for (i = 1; i <= mod.numberOfInstruments; ++i) {


			var instrument = Instrument();

			try{
				instrument.filePosition = file.index;
				instrument.headerSize = file.readDWord();

				instrument.name = file.readString(22);
				instrument.type = file.readUbyte();
				instrument.numberOfSamples = file.readWord();
				instrument.samples = [];
				instrument.sampleHeaderSize = 0;

				if (instrument.numberOfSamples>0){
					instrument.sampleHeaderSize = file.readDWord();

					// some files report incorrect sampleheadersize (18, without the samplename)
					// e.g. dubmood - cybernostra weekends.xm
					// sample header should be at least 40 bytes
					instrument.sampleHeaderSize = Math.max(instrument.sampleHeaderSize,40);

					// and not too much ... (Files saved with sk@letracker)
					if (instrument.sampleHeaderSize>200) instrument.sampleHeaderSize=40;

					//should we assume it's always 40? not according to specs ...


					for (var si = 0; si<96;  si++) instrument.sampleNumberForNotes.push(file.readUbyte());
					for (si = 0; si<24;  si++) instrument.volumeEnvelope.raw.push(file.readWord());
					for (si = 0; si<24;  si++) instrument.panningEnvelope.raw.push(file.readWord());

					instrument.volumeEnvelope.count = file.readUbyte();
					instrument.panningEnvelope.count = file.readUbyte();
					instrument.volumeEnvelope.sustainPoint = file.readUbyte();
					instrument.volumeEnvelope.loopStartPoint = file.readUbyte();
					instrument.volumeEnvelope.loopEndPoint = file.readUbyte();
					instrument.panningEnvelope.sustainPoint = file.readUbyte();
					instrument.panningEnvelope.loopStartPoint = file.readUbyte();
					instrument.panningEnvelope.loopEndPoint = file.readUbyte();
					instrument.volumeEnvelope.type = file.readUbyte();
					instrument.panningEnvelope.type = file.readUbyte();
					instrument.vibrato.type = file.readUbyte();
					instrument.vibrato.sweep = file.readUbyte();
					instrument.vibrato.depth = Math.min(file.readUbyte(),15); // some trackers have a different scale here? (e.g. Ambrozia)
					instrument.vibrato.rate = file.readUbyte();
					instrument.fadeout = file.readWord();
					instrument.reserved = file.readWord();

					function processEnvelope(envelope){
						envelope.points = [];
						for (si = 0; si < 12; si++) envelope.points.push(envelope.raw.slice(si*2,si*2+2));
						if (envelope.type & 1){ // on
							envelope.enabled = true;
						}

						if (envelope.type & 2){
							// sustain
							envelope.sustain = true;
						}

						if (envelope.type & 4){
							// loop
							envelope.loop = true;
						}

						return envelope;

					}

					instrument.volumeEnvelope = processEnvelope(instrument.volumeEnvelope);
					instrument.panningEnvelope = processEnvelope(instrument.panningEnvelope);

				}
			}catch (e) {
				console.error("error",e);
			}

            fileStartPos += instrument.headerSize;
            file.goto(fileStartPos);


            if (instrument.numberOfSamples === 0){
                var sample = Sample();
                instrument.samples.push(sample);
            }else{
                if (file.isEOF(1)){
                    console.error("seek past EOF");
                    console.error(instrument);
                    break;
                }

                for (var sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++){
                    sample = Sample();

                    sample.length = file.readDWord();
                    sample.loop.start = file.readDWord();
                    sample.loop.length = file.readDWord();
                    sample.volume = file.readUbyte();
                    sample.finetuneX = file.readByte();
                    sample.type = file.readUbyte();
                    sample.panning = file.readUbyte() - 128;
                    sample.relativeNote = file.readByte();
                    sample.reserved = file.readByte();
                    sample.name = file.readString(22);
                    sample.bits = 8;

                    instrument.samples.push(sample);
                    fileStartPos += instrument.sampleHeaderSize;

                    file.goto(fileStartPos);
                }

                for (sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++){
                    sample = instrument.samples[sampleI];
                    if (!sample.length) continue;

                    fileStartPos += sample.length;

                    if (sample.type & 16) {
                        sample.bits       = 16;
                        sample.type      ^= 16;
                        sample.length    >>= 1;
                        sample.loop.start >>= 1;
                        sample.loop.length   >>= 1;
                    }
                    sample.loop.type = sample.type || 0;
                    sample.loop.enabled = !!sample.loop.type;

                    // sample data
                    console.log("Reading sample from 0x" + file.index + " with length of " + sample.length + (sample.bits === 16 ? " words" : " bytes") +  " and repeat length of " + sample.loop.length);
                    var sampleEnd = sample.length;


                    var old = 0;
                    if (sample.bits === 16){
                        for (var j = 0; j<sampleEnd; j++){
                            var b = file.readShort() + old;
                            if (b < -32768) b += 65536;
                            else if (b > 32767) b -= 65536;
                            old = b;
                            sample.data.push(b / 32768);
                        }
                    }else{
                        for (j = 0; j<sampleEnd; j++){
                            b = file.readByte() + old;

                            if (b < -128) b += 256;
                            else if (b > 127) b -= 256;
                            old = b;
                            sample.data.push(b / 127); // TODO: or /128 ? seems to introduce artifacts - see test-loop-fadeout.xm
                        }
                    }

                    // unroll ping pong loops
                    if (sample.loop.type === LOOPTYPE.PINGPONG){

                        // TODO: keep original sample?
                        var loopPart = sample.data.slice(sample.loop.start,sample.loop.start + sample.loop.length);

                        sample.data = sample.data.slice(0,sample.loop.start + sample.loop.length);
                        sample.data = sample.data.concat(loopPart.reverse());
                        sample.loop.length = sample.loop.length*2;
                        sample.length = sample.loop.start + sample.loop.length;

                    }

                    file.goto(fileStartPos);

                }
            }

            instrument.setSampleIndex(0);

            Tracker.setInstrument(i,instrument);
            instrumentContainer.push({label: i + " " + instrument.name, data: i});

        }
        EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
        song.instruments = Tracker.getInstruments();

        Tracker.setBPM(mod.defaultBPM);
        Tracker.setAmigaSpeed(mod.defaultTempo);

        me.validate(song);

        return song;
    };


    // build internal
	//<!--
    me.write = function(next){
		var song = Tracker.getSong();
		var instruments = Tracker.getInstruments(); // note: intruments start at index 1, not 0
		var trackCount = Tracker.getTrackCount();

		var version = typeof versionNumber === "undefined" ? "dev" : versionNumber;

		var highestPattern = 0;
        for (i = 0;i<128;i++){
            var p = song.patternTable[i] || 0;
            highestPattern = Math.max(highestPattern,p);
        }


		// first get filesize
		var fileSize = 60 + 276;

            for (i = 0; i<=highestPattern; i++){
                if (song.patterns[i]){
                    fileSize += (9 + (song.patterns[i].length * trackCount * 5));
                }

            }

            // TODO: trim instrument list;

            for (i = 1; i<instruments.length; i++){
                var instrument = instruments[i];

                if (instrument && instrument.hasSamples()){
                	instrument.samples.forEach(function(sample){
						var len = sample.length;
						if (sample.bits === 16) len *= 2;
						fileSize += 243 + 40 + len;
					});
				}else{
                    fileSize += 29;
                }
            }
            
		var i;
		var arrayBuffer = new ArrayBuffer(fileSize);
		var file = new BinaryStream(arrayBuffer,false);


		file.writeStringSection("Extended Module: ",17);
		file.writeStringSection(song.title,20);
		file.writeByte(26);
		file.writeStringSection("BassoonTracker " + version,20);
		file.writeByte(4); // minor version xm format
		file.writeByte(1); // major version xm format

		file.writeDWord(276); // header size;
		file.writeWord(song.length);
		file.writeWord(0); //restart position
		file.writeWord(Tracker.getTrackCount());
		file.writeWord(highestPattern+1); // number of patterns
		file.writeWord(instruments.length-1); // number of instruments
		file.writeWord(Tracker.useLinearFrequency?1:0);
		file.writeWord(Tracker.getAmigaSpeed()); // default tempo
		file.writeWord(Tracker.getBPM()); // default BPM


		//TO CHECK: are most players compatible when we only only write the actual song length instead of all 256?
		for (i = 0; i < 256; i++) {
			file.writeUByte(song.patternTable[i] || 0);
		}


		// write pattern data
		for (i = 0; i <= highestPattern; i++) {

			var thisPattern = song.patterns[i];
			var patternLength = 0;
			var patternSize = 0;

			if (thisPattern) {
			    patternLength = thisPattern.length;
                patternSize = patternLength * trackCount * 5;
            }

			file.writeDWord(9); // header size;
			file.writeUByte(0); // packing type
			file.writeWord(patternLength);
			file.writeWord(patternSize);

            if (thisPattern){
                // TODO: packing?
                for (var step=0, max=thisPattern.length; step<max;step++){
                    var row = thisPattern[step];
                    for (var channel=0; channel<trackCount;channel++){
                        var note = row[channel] || {};
                        file.writeUByte(note.index || 0);
                        file.writeUByte(note.instrument || 0);
                        file.writeUByte(note.volumeEffect || 0);
                        file.writeUByte(note.effect || 0);
                        file.writeUByte(note.param || 0);
                    }
                }
            }

		}

		// write instrument data
		for (i=1; i<instruments.length; i++){

			instrument = instruments[i];

			if (instrument && instrument.hasSamples()){

				instrument.numberOfSamples = instrument.samples.length;

				file.writeDWord(243); // header size;
				file.writeStringSection(instrument.name,22);
				file.writeUByte(0); // instrument type
				file.writeWord(instrument.numberOfSamples); // number of samples

                var volumeEnvelopeType =
                    (instrument.volumeEnvelope.enabled?1:0)
                        + (instrument.volumeEnvelope.sustain?2:0)
                        + (instrument.volumeEnvelope.loop?4:0);

                var panningEnvelopeType =
                    (instrument.panningEnvelope.enabled?1:0)
                        + (instrument.panningEnvelope.sustain?2:0)
                        + (instrument.panningEnvelope.loop?4:0);


				file.writeDWord(40); // sample header size;
				for (var si = 0; si<96;  si++){
					file.writeUByte(instrument.sampleNumberForNotes[si] || 0); // sample number for notes
				}

				// volume envelope
				for (si = 0; si<12;  si++){
					var point = instrument.volumeEnvelope.points[si] || [0,0];
					file.writeWord(point[0]);
					file.writeWord(point[1]);
				}
				// panning envelope
				for (si = 0; si<12;  si++){
					point = instrument.panningEnvelope.points[si] || [0,0];
					file.writeWord(point[0]);
					file.writeWord(point[1]);
				}

				file.writeUByte(instrument.volumeEnvelope.count || 0);
				file.writeUByte(instrument.panningEnvelope.count || 0);
				file.writeUByte(instrument.volumeEnvelope.sustainPoint || 0);
				file.writeUByte(instrument.volumeEnvelope.loopStartPoint || 0);
				file.writeUByte(instrument.volumeEnvelope.loopEndPoint || 0);
				file.writeUByte(instrument.panningEnvelope.sustainPoint || 0);
				file.writeUByte(instrument.panningEnvelope.loopStartPoint || 0);
				file.writeUByte(instrument.panningEnvelope.loopEndPoint || 0);
				file.writeUByte(volumeEnvelopeType);
				file.writeUByte(panningEnvelopeType);
				file.writeUByte(instrument.vibrato.type || 0);
				file.writeUByte(instrument.vibrato.sweep || 0);
				file.writeUByte(instrument.vibrato.depth || 0);
				file.writeUByte(instrument.vibrato.rate || 0);
				file.writeWord(instrument.fadeout || 0);
				file.writeWord(0); // reserved

				// write samples

				// first all sample headers
				for (var sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++){
					var thisSample = instrument.samples[sampleI];

					var sampleType = 0;
					if (thisSample.loop.length>2 && thisSample.loop.enabled) sampleType=1;

					//TODO pingpong loops, or are we keeping pingpong loops unrolled?

					var sampleByteLength = thisSample.length;
					var sampleLoopByteStart = thisSample.loop.start;
					var sampleLoopByteLength = thisSample.loop.length;
					if (thisSample.bits === 16) {
						sampleType+=16;
						sampleByteLength *= 2;
						sampleLoopByteStart *= 2;
						sampleLoopByteLength *= 2;
					}


					file.writeDWord(sampleByteLength);
					file.writeDWord(sampleLoopByteStart);
					file.writeDWord(sampleLoopByteLength);
					file.writeUByte(thisSample.volume);
					file.writeByte(thisSample.finetuneX);
					file.writeUByte(sampleType);
					file.writeUByte((thisSample.panning || 0) + 128);
					file.writeUByte(thisSample.relativeNote || 0);
					file.writeUByte(0);
					file.writeStringSection(thisSample.name || "",22);

				}

				// then all sample data
				for (sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++){
					thisSample = instrument.samples[sampleI];

					var b;
					var delta = 0;
					var prev = 0;

					if (thisSample.bits === 16){
						for (si = 0, max=thisSample.length; si<max ; si++){
							// write 16-bit sample data
							b = Math.round(thisSample.data[si] * 32768);
							delta = b-prev;
							prev = b;

							if (delta < -32768) delta += 65536;
							else if (delta > 32767) delta -= 65536;
							file.writeWord(delta);
						}
					}else{
						for (si = 0, max=thisSample.length; si<max ; si++){
							// write 8-bit sample data
							b = Math.round(thisSample.data[si] * 127);
							delta = b-prev;
							prev = b;

							if (delta < -128) delta += 256;
							else if (delta > 127) delta -= 256;
							file.writeByte(delta);
						}
					}
				}
			}else{
				// empty instrument
				file.writeDWord(29); // header size;
				file.writeStringSection(instrument ? instrument.name : "",22);
				file.writeUByte(0); // instrument type
				file.writeWord(0); // number of samples
			}
		}

		if (next) next(file);

	};
	//-->

    me.validate = function(song){
    	
		function checkEnvelope(envelope,type){
			var isValid = true;
			if (envelope.points && envelope.points[0]){
				if (envelope.points[0][0] === 0){
					var c = 0;
					for (var i=1;i<envelope.count;i++){
						var point = envelope.points[i];
						if (point && point[0]>c){
							c = point[0];
						}else{
							isValid=false;
						}
					}
				}else{
					isValid = false;
				}
			}else{
				isValid = false;
			}
			
			if (isValid){
				return envelope;
			}else{
				console.warn("Invalid envelope, resetting to default");
				return type === "volume" 
					? {raw: [], enabled: false, points: [[0,48],[10,64],[20,40],[30,18],[40,28],[50,18]], count:6}
					: {raw: [], enabled: false, points: [[0,32],[20,40],[40,24],[60,32],[80,32]], count:5};
			}
		}

    	song.instruments.forEach(function(instrument){
    		// check envelope
			instrument.volumeEnvelope = checkEnvelope(instrument.volumeEnvelope,"volume");
			instrument.panningEnvelope = checkEnvelope(instrument.panningEnvelope,"panning");
			
			// check sampleIndexes;
			var maxSampleIndex = instrument.samples.length-1;
			for (var i = 0, max = instrument.sampleNumberForNotes.length; i<max; i++){
				instrument.sampleNumberForNotes[i] = Math.min(instrument.sampleNumberForNotes[i],maxSampleIndex);
			}
		})

	};

    return me;
};

;
var Instrument = function(){
	var me = {};

	me.type = "sample";
	me.name = "";
	me.instrumentIndex = 0;
	me.sampleIndex = -1;
	me.fadeout = 128;
	me.data = [];
	me.samples = [Sample()];
	me.sample = me.samples[0];

	me.volumeEnvelope = {raw: [], enabled: false, points: [[0,48],[10,64],[20,40],[30,18],[40,28],[50,18]], count:6};
	me.panningEnvelope = {raw: [], enabled: false, points: [[0,32],[20,40],[40,24],[60,32],[80,32]], count:5};
	me.vibrato = {};

	me.sampleNumberForNotes = [];

	me.play = function(noteIndex,notePeriod,volume,track,trackEffects,time){
		if (Tracker.inFTMode()) {
			notePeriod = me.getPeriodForNote(noteIndex);
		}
		return Audio.playSample(me.instrumentIndex,notePeriod,volume,track,trackEffects,time,noteIndex);
	};

	me.noteOn = function(time){
		var volumeEnvelope;
		var panningEnvelope;
		var scheduled = {};

		if (me.volumeEnvelope.enabled){
			volumeEnvelope = Audio.context.createGain();
			var envelope = me.volumeEnvelope;
			var scheduledTime = processEnvelop(envelope,volumeEnvelope,time);
			if (scheduledTime) scheduled.volume = (time + scheduledTime);
		}

		if (me.panningEnvelope.enabled && Audio.usePanning){
			panningEnvelope = Audio.context.createStereoPanner();
			envelope = me.panningEnvelope;
			scheduledTime = processEnvelop(envelope,panningEnvelope,time);
			if (scheduledTime) scheduled.panning = (time + scheduledTime);
		}

		if (me.vibrato.rate && me.vibrato.depth){
			scheduled.ticks = 0;
			scheduled.vibrato = time;
			scheduled.vibratoFunction = me.getAutoVibratoFunction();
		}

		return {volume: volumeEnvelope, panning: panningEnvelope, scheduled: scheduled};
	};

	me.noteOff = function(time,noteInfo){
		if (!noteInfo || !noteInfo.volume) return;

		function cancelScheduledValues(){
			// Note: we should cancel Volume and Panning scheduling independently ...
			noteInfo.volume.gain.cancelScheduledValues(time);
			noteInfo.volumeFadeOut.gain.cancelScheduledValues(time);

			if (noteInfo.volumeEnvelope) noteInfo.volumeEnvelope.gain.cancelScheduledValues(time);
			if (noteInfo.panningEnvelope) noteInfo.panningEnvelope.pan.cancelScheduledValues(time);
			noteInfo.scheduled = undefined;
		}


		if (Tracker.inFTMode()){
			var tickTime = Tracker.getProperties().tickTime;

			if (me.volumeEnvelope.enabled){

				if (me.volumeEnvelope.sustain && noteInfo.volumeEnvelope){
					cancelScheduledValues();
					var timeOffset = 0;
					var startPoint = me.volumeEnvelope.points[me.volumeEnvelope.sustainPoint];
					if (startPoint) timeOffset = startPoint[0]*tickTime;
					for (var p = me.volumeEnvelope.sustainPoint; p< me.volumeEnvelope.count;p++){
						var point = me.volumeEnvelope.points[p];
						if (point) noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(point[1]/64,time + (point[0]*tickTime) - timeOffset);
					}
				}

				if (me.fadeout){
					var fadeOutTime = (65536/me.fadeout) * tickTime / 2;
					noteInfo.volumeFadeOut.gain.linearRampToValueAtTime(0,time + fadeOutTime);
				}

			}else{
				cancelScheduledValues();
				noteInfo.volumeFadeOut.gain.linearRampToValueAtTime(0,time + 0.1)
			}

            if (me.panningEnvelope.enabled && Audio.usePanning && noteInfo.panningEnvelope){
                timeOffset = 0;
                startPoint = me.panningEnvelope.points[me.panningEnvelope.sustainPoint];
                if (startPoint) timeOffset = startPoint[0]*tickTime;
                for (p = me.panningEnvelope.sustainPoint; p< me.panningEnvelope.count;p++){
                    point = me.panningEnvelope.points[p];
                    if (point) noteInfo.panningEnvelope.pan.linearRampToValueAtTime((point[1]-32)/32,time + (point[0]*tickTime) - timeOffset);
                }
            }

			return 100;

		}else{
			cancelScheduledValues();
			if (noteInfo.isKey && noteInfo.volume){
				noteInfo.volume.gain.linearRampToValueAtTime(0,time + 0.5)
			}else{
				return 0;
			}
		}

	};

	function processEnvelop(envelope,audioNode,time){
		var tickTime = Tracker.getProperties().tickTime;
		var maxPoint = envelope.sustain ? envelope.sustainPoint+1 : envelope.count;

		// some XM files seem to have loop points outside the range.
		// e.g. springmellow_p_ii.xm - instrument 15;
		envelope.loopStartPoint = Math.min(envelope.loopStartPoint,envelope.count-1);
		envelope.loopEndPoint = Math.min(envelope.loopEndPoint,envelope.count-1);

		var doLoop = envelope.loop && (envelope.loopStartPoint<envelope.loopEndPoint);
		if (envelope.sustain && envelope.sustainPoint<=envelope.loopStartPoint) doLoop=false;


		if (doLoop) maxPoint = envelope.loopEndPoint+1;
		var scheduledTime = 0;
		var lastX = 0;

		if (audioNode.gain){
			// volume
			var audioParam = audioNode.gain;
			var center = 0;
			var max = 64;
		}else{
			// panning node
			audioParam = audioNode.pan;
			center = 32;
			max = 32;
		}

		audioParam.setValueAtTime((envelope.points[0][1]-center)/max,time);

		for (var p = 1; p<maxPoint;p++){
			var point = envelope.points[p];
			lastX = point[0];
			scheduledTime = lastX*tickTime;
			audioParam.linearRampToValueAtTime((point[1]-center)/max,time + scheduledTime);
		}

		if (doLoop){
			return me.scheduleEnvelopeLoop(audioNode,time,2,scheduledTime);
		}

		return false;
	}

	me.scheduleEnvelopeLoop = function(audioNode,startTime,seconds,scheduledTime){

		// note - this is not 100% accurate when the ticktime would change during the scheduled ahead time

		scheduledTime = scheduledTime || 0;
		var tickTime = Tracker.getProperties().tickTime;

		if (audioNode.gain){
			// volume
			var envelope = me.volumeEnvelope;
			var audioParam = audioNode.gain;
			var center = 0;
			var max = 64;
		}else{
			// panning node
			envelope = me.panningEnvelope;
			audioParam = audioNode.pan;
			center = 32;
			max = 32;
		}
		var point = envelope.points[envelope.loopStartPoint];
		var loopStartX = point[0];

		var doLoop = envelope.loop && (envelope.loopStartPoint<envelope.loopEndPoint);
		if (doLoop){
			while (scheduledTime < seconds){
				var startScheduledTime = scheduledTime;
				for (var p = envelope.loopStartPoint; p<=envelope.loopEndPoint;p++){
					point = envelope.points[p];
					scheduledTime = startScheduledTime + ((point[0]-loopStartX)*tickTime);
					audioParam.linearRampToValueAtTime((point[1]-center)/max,startTime + scheduledTime);
				}
			}
		}

		return scheduledTime;

	};


	me.scheduleAutoVibrato = function(note,seconds){
		// this is only used for keyboard notes as in the player the main playback timer is used for this
		var scheduledTime = 0;
		note.scheduled.ticks = note.scheduled.ticks || 0;
		var tickTime = Tracker.getProperties().tickTime;

		var freq = -me.vibrato.rate/40;
		var amp = me.vibrato.depth/8;
		if (Tracker.useLinearFrequency) amp *= 4;

		var currentPeriod,vibratoFunction,time,tick;
		if (note.source) {
			currentPeriod = note.startPeriod;
			vibratoFunction = note.scheduled.vibratoFunction || Audio.waveFormFunction.sine;
			time = note.scheduled.vibrato || Audio.context.currentTime;
			tick = 0;
		}


		while (scheduledTime < seconds){
			scheduledTime += tickTime;

			if (currentPeriod){
                var sweepAmp = 1;
                if (me.vibrato.sweep && note.scheduled.ticks<me.vibrato.sweep){
                    sweepAmp = 1-((me.vibrato.sweep-note.scheduled.ticks)/me.vibrato.sweep);
                }

				var targetPeriod = vibratoFunction(currentPeriod,note.scheduled.ticks,freq,amp*sweepAmp);
				Tracker.setPeriodAtTime(note,targetPeriod,time + (tick*tickTime));
				tick++;
			}
			note.scheduled.ticks++;
		}

		return scheduledTime;
	};

	me.getAutoVibratoFunction = function(){
        switch(me.vibrato.type){
            case 1: return Audio.waveFormFunction.square;
            case 2: return Audio.waveFormFunction.saw;
            case 3: return Audio.waveFormFunction.sawInverse;
        }
        return Audio.waveFormFunction.sine;
	};

	me.resetVolume = function(time,noteInfo){
        if (noteInfo.volumeFadeOut) {
            noteInfo.volumeFadeOut.gain.cancelScheduledValues(time);
            noteInfo.volumeFadeOut.gain.setValueAtTime(1, time);
        }

        if (noteInfo.volumeEnvelope){
            noteInfo.volumeEnvelope.gain.cancelScheduledValues(time);
            var tickTime = Tracker.getProperties().tickTime;

            var maxPoint = me.volumeEnvelope.sustain ? me.volumeEnvelope.sustainPoint+1 :  me.volumeEnvelope.count;
            noteInfo.volumeEnvelope.gain.setValueAtTime(me.volumeEnvelope.points[0][1]/64,time);
            for (var p = 1; p<maxPoint;p++){
                var point = me.volumeEnvelope.points[p];
                noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(point[1]/64,time + (point[0]*tickTime));
            }
		}
	};

	me.getFineTune = function(){
		return Tracker.inFTMode() ? me.sample.finetuneX : me.sample.finetune;
	};

	me.setFineTune = function(finetune){
		if (Tracker.inFTMode()){
			me.sample.finetuneX = finetune;
			me.sample.finetune = finetune >> 4;
		}else{
            if (finetune>7) finetune = finetune-16;
			me.sample.finetune = finetune;
			me.sample.finetuneX = finetune << 4;
		}
	};

	// in FT mode
	me.getPeriodForNote = function(noteIndex,withFineTune){
		var result = 0;

		if (Tracker.useLinearFrequency){
			result =  7680 - (noteIndex-1)*64;
			if (withFineTune) result -= me.getFineTune()/2;
		}else{
			result = FTNotes[noteIndex].period;
			if (withFineTune && me.getFineTune()){
				result = Audio.getFineTuneForNote(noteIndex,me.getFineTune());
			}
		}

		return result;
	};

	me.setSampleForNoteIndex = function(noteIndex){
		var sampleIndex = me.sampleNumberForNotes[noteIndex-1];
		if (sampleIndex !== me.sampleIndex && typeof sampleIndex === "number"){
			me.setSampleIndex(sampleIndex);
		}
	};

	me.setSampleIndex = function(index){
		if (me.sampleIndex !== index){
			me.sample = me.samples[index];
			me.sampleIndex = index;

			EventBus.trigger(EVENT.sampleIndexChange,me.instrumentIndex);
		}
	};

	me.hasSamples = function(){
		for (var i = 0, max = me.samples.length; i<max; i++){
			if (me.samples[i].length) return true;
		}
	};

	me.hasVibrato = function(){
		return me.vibrato.rate && me.vibrato.depth;
	};


	return me;
};;
var Sample = function(){
	var me = {};

	me.data = [];
	me.length = 0;
	me.name = "";
	me.bits = 8;

	me.volume = 64;
	me.finetune = 0;
	me.finetuneX = 0;
	me.panning = 0;
	me.relativeNote = 0;

    me.loop = {
        enabled: false,
        start: 0,
        length: 0,
        type: 0
    };

	me.check = function(){
		var min = 0;
		var max = 0;
		for (var i = 0, len = me.data.length; i<len; i++){
			min = Math.min(min,me.data[i]);
			max = Math.max(max,me.data[i]);
		}
		return {min: min, max: max};
	};


	return me;
};;
var Note = function(){
	var me = {};

	me.period = 0;
	me.index = 0;
	me.effect = 0;
	me.instrument = 0;
	me.param = 0;
	me.volumeEffect = 0;


	me.setPeriod = function(period){
		me.period = period;
		me.index = FTPeriods[period] || 0;
	};

	me.setIndex = function(index){
		me.index = index;
		var ftNote = FTNotes[index];
		if (ftNote){
			me.period = ftNote.modPeriod || ftNote.period;
			if (me.period === 1) me.period = 0;
		}else{
			console.warn("No note for index " + index);
			me.period = 0;
		}
	};

	me.clear = function(){
		me.instrument = 0;
		me.period = 0;
		me.effect = 0;
		me.param = 0;
		me.index = 0;
		me.volumeEffect = 0;
	};

	me.duplicate = function(){
		return {
			instrument: me.instrument,
			period : me.period,
			effect: me.effect,
			param: me.param,
			volumeEffect: me.volumeEffect,
			note: me.index
		}
	};

	me.populate = function(data){
			me.instrument = data.instrument || 0;
			me.period = data.period|| 0;
			me.effect = data.effect || 0;
			me.param = data.param || 0;
			me.volumeEffect =  data.volumeEffect || 0;
			me.index =  data.note || data.index || 0;
	};


	return me;
};;
return {
        init: Tracker.init,
        load: Tracker.load,
        playSong: Tracker.playSong,
        stop: Tracker.stop,
        togglePlay: Tracker.togglePlay,
        isPlaying: Tracker.isPlaying,
        getTrackCount: Tracker.getTrackCount,
        getSong: Tracker.getSong,
        getInstruments: Tracker.getInstruments,
        getStateAtTime: Tracker.getStateAtTime,
        getTimeStates: Tracker.getTimeStates,
        setCurrentSongPosition: Tracker.setCurrentSongPosition,
        setBPM: Tracker.setBPM,
        getBPM: Tracker.getBPM,
        setAmigaSpeed: Tracker.setAmigaSpeed,
        getAmigaSpeed: Tracker.getAmigaSpeed,
        setMaster: Tracker.setMaster,
        isMaster: Tracker.isMaster,
        audio: Audio
    };
});


if (typeof HostBridge === "undefined" || !HostBridge.customConfig){
    BassoonTracker = BassoonTracker();
}



