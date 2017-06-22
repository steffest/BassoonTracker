var debug = false;

var canvas;
var ctx;

var periodNoteTable = {};
var periodFinetuneTable = {};
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
                left: 0,
                ok:true
            });
            dialog.onTouchDown = function(){window.location.href="https://www.google.com/chrome/"};
            dialog.setText("Sorry//Your browser does not support WebAudio//Supported browsers are/Chrome,Firefox,Safari and Edge");

            UI.setModalElement(dialog);
        }else{
            Settings.readSettings();
            App.init();
        }
    });
});

var Main = (function(){
    var me={};

    me.init = function(){

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

    };
    return me;
}());

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






