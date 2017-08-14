var debug = false;

document.addEventListener('DOMContentLoaded', function() {
    Tracker.init();
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







