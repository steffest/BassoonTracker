var fs = require('fs');

var map = {
    'name': "_a",
    'period': "_b",
    'volumeEnvelope':"_c",
    'panningEnvelope':"_d",
    'readUbyte':"_e",
    'writeUByte':"_f",
    'readWord':"_g",
    'writeWord':"_h",
    'param':"_i",
    'inFTMode':"_j",
    'modPeriod':"_k",
    'vibratoTimer':"_l",
    'toleranceEarly':"_m",
    'toleranceLate':"_n",
    'trigger':'_o',
    'vibrato':'_p',
    'instrumentIndex' : "_q",
    'waveFormFunction': '_r',
    'useLinearFrequency': '_s',
    //'getInstrument' : "_t",
    'instrument':'_u',
    //'patternTable' : "_u",
    'readString': "_v",
    'loopStartPoint': "_w",
    'setAmigaSpeed' : "_x",
    'targetPatternPosition' : "_y",
    'sampleNumberForNotes' : "_z",
    'targetSongPosition' : "_A",
    'emulateProtracker1OffsetBug' : "_B",
    'setCurrentPatternPos' : "_C",
    'getAutoVibratoFunction' : "_D",
    'getFineTuneForNote': "_E",
    'getFineTuneForPeriod': "_F",
    'getFineTune' : "_G",
    'sustainPoint' : "_H",
    'writeStringSection' : "_I",
    'loopEndPoint' : "_J",
    'numberOfSamples' : "_K",
    'restartPosition' : "_L",
    'sampleHeaderSize' : "_M",
    'litteEndian' : "_N",
    'getPeriodForNote' : "_O",
    'getSampleRateForPeriod' : "_P",
    'hasAutoVibrato' : "_Q",
    'setTrackerMode' : "_R",
    'setCurrentInstrumentIndex' : "_S",
    'volumeEffect' : "_T",
    'startPeriod' : "_U",
    'currentVolume' : "_V",
    'patternBreak' : "_W",
    'volumeFadeOut' : "_X",
    'startVolume' : "_Y",
    'currentInstrument' : "_Z",
    'clearInstruments' : "$a",
    'getTrackCount' : "$b",
    'readDWord' : "$c",
    'setPeriodAtTime' : "$d",
    'defaultSlideTarget' : "$e",
    'useUrlParams' : "$f",
    'resetPeriodOnStep' : "$g",
    'startVibratoTimerp' : "h"
};

fs.readFile('./bassoonplayer.js', function (err, data) {
    if (err) throw err;

    var src = data.toString();

    var re = /(.*\/\/<!--\s)([\s\S]*?)(\s\/\/-->.*)/g;
    src = src.replace(re, "");
    //@noPlayer

    for (var key in map){
        if (map.hasOwnProperty(key)){
            src = src.split(key).join(map[key]);
        }
    }

    fs.writeFileSync("./bassoonplayer_squeezed.js",src);

    //console.log(src);
});