import Tracker from "./tracker.js";
import Audio from "./audio.js";
import UI from "./ui/ui.js"
import Host from "./host.js";
import Settings from "./settings.js";
import App from "./app.js";
import Editor from "./editor.js";
import ModalDialog from "./ui/components/modalDialog.js";

var Main = function(){
    var me = {};

    me.init = function(){
        console.log("initialising");
        Host.init();
        Tracker.init();
        Audio.init();

        //UI.startMeasure();
        UI.init(function(){
            console.error("UI init done");
            window.focus();
            me.isBrowserSupported = Audio.context && window.requestAnimationFrame;
            if (!me.isBrowserSupported){
                console.error("Browser not supported");
                var dialog = ModalDialog();
                dialog.setProperties({
                    width: UI.mainPanel.width,
                    height: UI.mainPanel.height,
                    top: 0,
                    left: 0,
                    ok:true
                });
                dialog.onDown = function(){window.location.href="https://www.google.com/chrome/"};
                dialog.setText("Sorry//Your browser does not support WebAudio//Supported browsers are/Chrome,Firefox,Safari and Edge");
    
                UI.setModalElement(dialog);
            }else{
                Settings.readSettings();
                //if (debug) UI.measure("Read & Apply Settings");
                App.init();
                Host.signalReady();
                Editor.loadInitialFile();
                //if (debug) UI.endMeasure();
            }
        });


    };

    return me;
}();

Main.init();