var cachedAssets = {
	images:{},
	audio:{},
	json:{},
	arrayBuffer:{}
};

var sprites = {};

var PRELOADTYPE = {
	"image": 1,
	"audio":2,
	"json":3,
	"binary":4
};

var EVENT = {
	sampleChange:1,
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
	songPropertyChange: 15,
	sampleNameChange:16,
	command: 17,
	noteOn : 18,
	noteOff : 19,
	statusChange: 20
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
	showTop : 15,
	showBottom: 16,
	randomSong: 17,
	showGithub: 18
};

var PLAYTYPE = {
	song:1,
	pattern:2
};

var PLAYBACKENGINE = {
	FULL: 1,
	SIMPLE: 2 // usefull for mobile phones and slow PC's
};

var STEREOSEPARATION = {
	FULL: 1,
	BALANCED: 2,
	NONE: 3
};

//var PALFREQUENCY = 7093789.2;
var PALFREQUENCY = 7093790; // not that my ears can hear the difference but this seems to be the correct value  ftp://ftp.modland.com/pub/documents/format_documentation/Protracker%20effects%20(MODFIL12.TXT)%20(.mod).txt

var LAYOUTS = {
	column4:4,
	column5:5,
	column5Full:6,
	column6:7
};


// amiga period table, translates notes to  samplefrequencies
// first 3*12 are to first octaves (1,2 and 3)

// found on http://pastebin.com/raw/6xVK2msR - by Lars Hamre ?
// linked to in an EAB tread http://eab.abime.net/showthread.php?t=69675

var periodTable  = [
	856,808,762,720,678,640,604,570,538,508,480,453,
	428,404,381,360,339,320,302,285,269,254,240,226,
	214,202,190,180,170,160,151,143,135,127,120,113,0,
	850,802,757,715,674,637,601,567,535,505,477,450,
	425,401,379,357,337,318,300,284,268,253,239,225,
	213,201,189,179,169,159,150,142,134,126,119,113,0,
	844,796,752,709,670,632,597,563,532,502,474,447,
	422,398,376,355,335,316,298,282,266,251,237,224,
	211,199,188,177,167,158,149,141,133,125,118,112,0,
	838,791,746,704,665,628,592,559,528,498,470,444,
	419,395,373,352,332,314,296,280,264,249,235,222,
	209,198,187,176,166,157,148,140,132,125,118,111,0,
	832,785,741,699,660,623,588,555,524,495,467,441,
	416,392,370,350,330,312,294,278,262,247,233,220,
	208,196,185,175,165,156,147,139,131,124,117,110,0,
	826,779,736,694,655,619,584,551,520,491,463,437,
	413,390,368,347,328,309,292,276,260,245,232,219,
	206,195,184,174,164,155,146,138,130,123,116,109,0,
	820,774,730,689,651,614,580,547,516,487,460,434,
	410,387,365,345,325,307,290,274,258,244,230,217,
	205,193,183,172,163,154,145,137,129,122,115,109,0,
	814,768,725,684,646,610,575,543,513,484,457,431,
	407,384,363,342,323,305,288,272,256,242,228,216,
	204,192,181,171,161,152,144,136,128,121,114,108,0,
	907,856,808,762,720,678,640,604,570,538,508,480,
	453,428,404,381,360,339,320,302,285,269,254,240,
	226,214,202,190,180,170,160,151,143,135,127,120,0,
	900,850,802,757,715,675,636,601,567,535,505,477,
	450,425,401,379,357,337,318,300,284,268,253,238,
	225,212,200,189,179,169,159,150,142,134,126,119,0,
	894,844,796,752,709,670,632,597,563,532,502,474,
	447,422,398,376,355,335,316,298,282,266,251,237,
	223,211,199,188,177,167,158,149,141,133,125,118,0,
	887,838,791,746,704,665,628,592,559,528,498,470,
	444,419,395,373,352,332,314,296,280,264,249,235,
	222,209,198,187,176,166,157,148,140,132,125,118,0,
	881,832,785,741,699,660,623,588,555,524,494,467,
	441,416,392,370,350,330,312,294,278,262,247,233,
	220,208,196,185,175,165,156,147,139,131,123,117,0,
	875,826,779,736,694,655,619,584,551,520,491,463,
	437,413,390,368,347,328,309,292,276,260,245,232,
	219,206,195,184,174,164,155,146,138,130,123,116,0,
	868,820,774,730,689,651,614,580,547,516,487,460,
	434,410,387,365,345,325,307,290,274,258,244,230,
	217,205,193,183,172,163,154,145,137,129,122,115,0,
	862,814,768,725,684,646,610,575,543,513,484,457,
	431,407,384,363,342,323,305,288,272,256,242,228,
	216,203,192,181,171,161,152,144,136,128,121,114,0];

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

var KEYBOADKEYS = {
	C: {name: "C", octave: 0},
	Csharp: {name: "Cs", octave: 0},
	D: {name: "D", octave: 0},
	Dsharp: {name: "Ds", octave: 0},
	E: {name: "E", octave: 0},
	F: {name: "F", octave: 0},
	Fsharp: {name: "Fs", octave: 0},
	G: {name: "G", octave: 0},
	Gsharp: {name: "Gs", octave: 0},
	A: {name: "A", octave: 0},
	Asharp: {name: "As", octave: 0},
	B: {name: "B", octave: 0},
	COctaveUp: {name: "C", octave: 1},
	CsharpOctaveUp: {name: "Cs", octave: 1},
	DOctaveUp: {name: "D", octave: 1},
	DsharpOctaveUp: {name: "Ds", octave: 1},
	EOctaveUp: {name: "E", octave: 1},
	FOctaveUp: {name: "F", octave: 1},
	FsharpOctaveUp: {name: "Fs", octave: 1},
	GOctaveUp: {name: "G", octave: 1},
	GsharpOctaveUp: {name: "Gs", octave: 1},
	AOctaveUp: {name: "A", octave: 1},
	AsharpOctaveUp: {name: "As", octave: 1},
	BOctaveUp: {name: "B", octave: 1},
	COctaveUp2: {name: "C", octave: 2},
	CsharpOctaveUp2: {name: "Cs", octave: 2},
	DOctaveUp2: {name: "D", octave: 2}
};


var KEYBOARDTABLE = {
	azerty:{
		a: KEYBOADKEYS.COctaveUp,
		z: KEYBOADKEYS.DOctaveUp,
		e: KEYBOADKEYS.EOctaveUp,
		r: KEYBOADKEYS.FOctaveUp,
		t: KEYBOADKEYS.GOctaveUp,
		y: KEYBOADKEYS.AOctaveUp,
		u: KEYBOADKEYS.BOctaveUp,
		i: KEYBOADKEYS.COctaveUp2,
		o: KEYBOADKEYS.DOctaveUp2,

		"é": KEYBOADKEYS.CsharpOctaveUp,
		'"': KEYBOADKEYS.DsharpOctaveUp,
		"(": KEYBOADKEYS.FsharpOctaveUp,
		"§": KEYBOADKEYS.GsharpOctaveUp,
		"è": KEYBOADKEYS.AsharpOctaveUp,
		"ç": KEYBOADKEYS.CsharpOctaveUp2,

		w: KEYBOADKEYS.C,
		x: KEYBOADKEYS.D,
		c: KEYBOADKEYS.E,
		v: KEYBOADKEYS.F,
		b: KEYBOADKEYS.G,
		n: KEYBOADKEYS.A,
		",": KEYBOADKEYS.B,
		";": KEYBOADKEYS.COctaveUp,
		":": KEYBOADKEYS.DOctaveUp,

		s: KEYBOADKEYS.Csharp,
		d: KEYBOADKEYS.Dsharp,
		g: KEYBOADKEYS.Fsharp,
		h: KEYBOADKEYS.Gsharp,
		j: KEYBOADKEYS.Asharp
	},
	qwerty:{
		q: KEYBOADKEYS.COctaveUp,
		w: KEYBOADKEYS.DOctaveUp,
		e: KEYBOADKEYS.EOctaveUp,
		r: KEYBOADKEYS.FOctaveUp,
		t: KEYBOADKEYS.GOctaveUp,
		y: KEYBOADKEYS.AOctaveUp,
		u: KEYBOADKEYS.BOctaveUp,
		i: KEYBOADKEYS.COctaveUp2,
		o: KEYBOADKEYS.DOctaveUp2,

		"2": KEYBOADKEYS.CsharpOctaveUp,
		'3': KEYBOADKEYS.DsharpOctaveUp,
		"5": KEYBOADKEYS.FsharpOctaveUp,
		"6": KEYBOADKEYS.GsharpOctaveUp,
		"7": KEYBOADKEYS.AsharpOctaveUp,
		"9": KEYBOADKEYS.CsharpOctaveUp2,

		z: KEYBOADKEYS.C,
		x: KEYBOADKEYS.D,
		c: KEYBOADKEYS.E,
		v: KEYBOADKEYS.F,
		b: KEYBOADKEYS.G,
		n: KEYBOADKEYS.A,
		m: KEYBOADKEYS.B,
		",": KEYBOADKEYS.COctaveUp,
		".": KEYBOADKEYS.DOctaveUp,

		s: KEYBOADKEYS.Csharp,
		d: KEYBOADKEYS.Dsharp,
		g: KEYBOADKEYS.Fsharp,
		h: KEYBOADKEYS.Gsharp,
		j: KEYBOADKEYS.Asharp
	}
};


var SETTINGS = {
	unrollLoops: false,
	unrollShortLoops: false, // Note: the conversion between byte_length loops (amiga) and time-based loops (Web Audio) is not 100% accurate for very short loops
	sustainKeyboardNotes: false,
	useHover:true,
	keyboardTable: "qwerty",
	playBackEngine: PLAYBACKENGINE.SIMPLE,
	stereoSeparation: STEREOSEPARATION.BALANCED
};