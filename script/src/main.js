var debug = false;

var canvas;
var ctx;

var periodNoteTable = {};
var nameNoteTable = {};
var noteNames = [];

document.addEventListener('DOMContentLoaded', function() {
    Main.init();
    Audio.init();
    UI.init(function(){
        if (!Audio.context){
            var dialog = UI.modalDialog();
            dialog.setProperties({
                width: UI.mainPanel.width,
                height: UI.mainPanel.height,
                top: 0,
                left: 0
            });
            dialog.setText("Sorry//Your browser does not support WebAudio//Supported browsers are/Chrome,Firefox,Safari and Edge");

            UI.setModalElement(dialog);
        }
    });


});

var Main = (function(){
    var me={};

    me.init = function(){

        for (var key in NOTEPERIOD){
            if (NOTEPERIOD.hasOwnProperty(key)){
                var note = NOTEPERIOD[key];
                periodNoteTable[note.period] = note;
                nameNoteTable[note.name] = note;
                noteNames.push(note.name);
            }
        }
    };
    return me;
}());






