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
	pianoNoteOn : 18,
	pianoNoteOff : 19,
	statusChange: 20,
	diskOperationTargetChange: 21,
	trackCountChange:22,
	patternHorizontalScrollChange:23,
	songLoaded: 24,
	songLoading: 25,
	trackerModeChanged: 26
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

var STEREOSEPARATION = {
	FULL: 1,
	BALANCED: 2,
	NONE: 3
};

var FREQUENCYTABLE =  {
	AMIGA: 1,
	LINEAR : 2
};

//var PALFREQUENCY = 7093789.2;
var PALFREQUENCY = 7093790; // not that my ears can hear the difference but this seems to be the correct value  ftp://ftp.modland.com/pub/documents/format_documentation/Protracker%20effects%20(MODFIL12.TXT)%20(.mod).txt

var LAYOUTS = {
	column4:4,
	column5:5,
	column5Full:6,
	column6:7
};


// amiga period table, translates notes to samplefrequencies
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

var FTNOTEPERIOD = {
	None  : {name: "---"},
	C0  : {name: "C-0",period:6848},
	Cs0 : {name: "C#0",period:6464},
	D0 : {name: "D-0",period:6096},
	Ds0 : {name: "D#0",period:5760},
	E0 : {name: "E-0",period:5424},
	F0 : {name: "F-0",period:5120},
	Fs0 : {name: "F#0",period:4832},
	G0 : {name: "G-0",period:4560},
	Gs0 : {name: "G#0",period:4304},
	A0 : {name: "A-0",period:4064},
	As0 : {name: "A#0",period:3840},
	B0 : {name: "A-0",period:3628},
	C1  : {name: "C-1",period:3424},
	Cs1 : {name: "C#1",period:3232},
	D1 : {name: "D-1",period:3048},
	Ds1 : {name: "D#1",period:2880},
	E1 : {name: "E-1",period:2712},
	F1 : {name: "F-1",period:2560},
	Fs1 : {name: "F#1",period:2416},
	G1 : {name: "G-1",period:2280},
	Gs1 : {name: "G#1",period:2152},
	A1 : {name: "A-1",period:2032},
	As1 : {name: "A#1",period:1920},
	B1 : {name: "A-1",period:1814},
	C2  : {name: "C-2",period:1712},
	Cs2 : {name: "C#2",period:1616},
	D2 : {name: "D-2",period:1524},
	Ds2 : {name: "D#2",period:1440},
	E2 : {name: "E-2",period:1356},
	F2 : {name: "F-2",period:1280},
	Fs2 : {name: "F#2",period:1208},
	G2 : {name: "G-2",period:1140},
	Gs2 : {name: "G#2",period:1076},
	A2 : {name: "A-2",period:1016},
	As2 : {name: "A#2",period:960},
	B2 : {name: "A-2",period:907},
	C3  : {name: "C-3",period:856},
	Cs3 : {name: "C#3",period:808},
	D3 : {name: "D-3",period:762},
	Ds3 : {name: "D#3",period:720},
	E3 : {name: "E-3",period:678},
	F3 : {name: "F-3",period:640},
	Fs3 : {name: "F#3",period:604},
	G3 : {name: "G-3",period:570},
	Gs3 : {name: "G#3",period:538},
	A3 : {name: "A-3",period:508},
	As3 : {name: "A#3",period:480},
	B3 : {name: "A-3",period:453},
	C4  : {name: "C-4",period:428},
	Cs4 : {name: "C#4",period:404},
	D4 : {name: "D-4",period:381},
	Ds4 : {name: "D#4",period:360},
	E4 : {name: "E-4",period: 339},
	F4 : {name: "F-4",period: 320},
	Fs4 : {name: "F#4",period: 302},
	G4 : {name: "G-4",period:285},
	Gs4 : {name: "G#4",period:269},
	A4 : {name: "A-4",period:254},
	As4 : {name: "A#4",period:240},
	B4 : {name: "A-4",period:227},
	C5  : {name: "C-5",period:214},
	Cs5 : {name: "C#5",period:202},
	D5 : {name: "D-5",period:190},
	Ds5 : {name: "D#5",period:180},
	E5 : {name: "E-5",period:169},
	F5 : {name: "F-5",period:160},
	Fs5 : {name: "F#5",period:151},
	G5 : {name: "G-5",period:142},
	Gs5 : {name: "G#5",period:134},
	A5 : {name: "A-5",period:127},
	As5 : {name: "A#5",period:120},
	B5 : {name: "A-5",period:113},
	C6  : {name: "C-6",period:107},
	Cs6 : {name: "C#6",period:101},
	D6 : {name: "D-6",period:95},
	Ds6 : {name: "D#6",period:90},
	E6 : {name: "E-6",period: 85},
	F6 : {name: "F-6",period:80},
	Fs6 : {name: "F#6",period:75},
	G6 : {name: "G-6",period:71},
	Gs6 : {name: "G#6",period:67},
	A6 : {name: "A-6",period:63},
	As6 : {name: "A#6",period:60},
	B6 : {name: "A-6",period:57},
	C7  : {name: "C-7",period:53},
	Cs7 : {name: "C#7",period:50},
	D7 : {name: "D-7",period:48},
	Ds7 : {name: "D#7",period:45},
	E7 : {name: "E-7",period:42},
	F7 : {name: "F-7",period:40},
	Fs7 : {name: "F#7",period:38},
	G7 : {name: "G-7",period:36},
	Gs7 : {name: "G#7",period:34},
	A7 : {name: "A-7",period:32},
	As7 : {name: "A#7",period:30},
	B7 : {name: "A-7",period:28},
	OFF : {name: "OFF",period:0}
};

var KEYBOARDKEYS = {
	C: {name: "C", octave: 0, index: 1},
	Csharp: {name: "Cs", octave: 0, index: 2},
	D: {name: "D", octave: 0, index: 3},
	Dsharp: {name: "Ds", octave: 0, index: 4},
	E: {name: "E", octave: 0, index: 5},
	F: {name: "F", octave: 0, index: 6},
	Fsharp: {name: "Fs", octave: 0, index: 7},
	G: {name: "G", octave: 0, index: 8},
	Gsharp: {name: "Gs", octave: 0, index: 9},
	A: {name: "A", octave: 0, index: 10},
	Asharp: {name: "As", octave: 0, index: 11},
	B: {name: "B", octave: 0, index: 12},
	COctaveUp: {name: "C", octave: 1, index: 13},
	CsharpOctaveUp: {name: "Cs", octave: 1, index: 14},
	DOctaveUp: {name: "D", octave: 1, index: 15},
	DsharpOctaveUp: {name: "Ds", octave: 1, index: 16},
	EOctaveUp: {name: "E", octave: 1, index: 17},
	FOctaveUp: {name: "F", octave: 1, index: 18},
	FsharpOctaveUp: {name: "Fs", octave: 1, index: 19},
	GOctaveUp: {name: "G", octave: 1, index: 20},
	GsharpOctaveUp: {name: "Gs", octave: 1, index: 21},
	AOctaveUp: {name: "A", octave: 1, index: 22},
	AsharpOctaveUp: {name: "As", octave: 1, index: 23},
	BOctaveUp: {name: "B", octave: 1, index: 24},
	COctaveUp2: {name: "C", octave: 2, index: 25},
	CsharpOctaveUp2: {name: "Cs", octave: 2, index: 26},
	DOctaveUp2: {name: "D", octave: 2, index: 27}
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
		j: KEYBOARDKEYS.Asharp
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
		j: KEYBOARDKEYS.Asharp
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
		j: KEYBOARDKEYS.Asharp
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
	emulateProtracker1OffsetBug: true
};