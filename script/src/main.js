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
            dialog.onDown = function(){window.location.href="https://www.google.com/chrome/"};
            dialog.setText("Sorry//Your browser does not support WebAudio//Supported browsers are/Chrome,Firefox,Safari and Edge");

            UI.setModalElement(dialog);
        }else{

			Settings.readSettings();
			App.init();

            if (Audio.context.state && Audio.context.state === "suspended" && Audio.context.resume){
            	// display dialog to capture first user interaction on Android
				var dialog = UI.modalDialog();
				dialog.setProperties({
					width: UI.mainPanel.width,
					height: UI.mainPanel.height,
					top: 0,
					left: 0,
					ok:true
				});
				dialog.onClick = function(){
					dialog.close();
					Audio.context.resume().then(function(){
						console.log(Audio.context.state);
					});
                };
				dialog.setText("Welcome to BassoonTracker!");

				UI.setModalElement(dialog);
            }
        }
    });
});







