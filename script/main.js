var debug = false;

var canvas;
var ctx;

var periodNoteTable = {};

document.addEventListener('DOMContentLoaded', function() {
    Main.init();
    UI.init();
});

var Main = (function(){
    var me={};

    me.init = function(){

        for (var key in NOTEPERIOD){
            if (NOTEPERIOD.hasOwnProperty(key)){
                var note = NOTEPERIOD[key];
                periodNoteTable[note.period] = note;
            }
        }
    };
    return me;
}());






