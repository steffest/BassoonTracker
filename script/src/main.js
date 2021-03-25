var debug = false;

var Main = function(){
    var me = {};

    me.init = function(){
        console.log("initialising");
        Host.init();
        Tracker.init();
        Audio.init();
        
        UI.startMeasure();
        UI.init(function(){
            window.focus();
            me.isBrowserSupported = Audio.context && window.requestAnimationFrame;
            if (!me.isBrowserSupported){
                console.error("Browser not supported");
                var dialog = UI.modalDialog();
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
                if (debug) UI.measure("Read & Apply Settings");
                App.init();
                Host.signalReady();
                Editor.loadInitialFile();
                if (debug) UI.endMeasure();
            }
        });
    };

    return me;
}();

if (!Host.customConfig && document.addEventListener) document.addEventListener('DOMContentLoaded', Main.init);