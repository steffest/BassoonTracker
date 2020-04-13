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
    //'sample':'_s',
    'trigger':'_o',
    'vibrato':'_p',
    'instrumentIndex' : "_q",
    'waveFormFunction': '_r',
    'useLinearFrequency': '_s',
    'getInstrument' : "_t",
    'instrument':'_u',
    //'patternTable' : "_u",
    'readString': "_v",
    'loopStartPoint': "_w",
    'setAmigaSpeed' : "_x",
    'targetPatternPosition' : "_y",
    'sampleNumberForNotes' : "_z",
    'targetSongPosition' : "_ab",
    'emulateProtracker1OffsetBug' : "_ac",
    'setCurrentPatternPos' : "_ad",
    'getAutoVibratoFunction' : "_ae",
    'getFineTuneForNote': "_ap",
    'getFineTuneForPeriod': "_aq",
    'getFineTune' : "_af",
    'sustainPoint' : "_ag",
    'writeStringSection' : "_ah",
    'loopEndPoint' : "_ai",
    'numberOfSamples' : "_aj",
    'restartPosition' : "_ak",
    'sampleHeaderSize' : "_al",
    'litteEndian' : "_am",
    'getPeriodForNote' : "_an",
    'getSampleRateForPeriod' : "_ao",
    'hasAutoVibrato' : "_ar",
    'setTrackerMode' : "_as",
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