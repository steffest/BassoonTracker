import App_panelContainer from "./panelContainer.js";
import Y from "../yascal/yascal.js";
import SpinBox from "../spinBox.js";
import Assets from "../assets.js";
import Layout from "./layout.js";
import Input from "../input.js";
import {COMMAND, EVENT} from "../../enum.js";
import App from "../../app.js";
import Tracker from "../../tracker.js";
import Font from "../font.js";

let app_pianoView = function(){

    var me = new App_panelContainer(200);
    me.name = "pianoViewPanel";

    var keyWidth = 64;
    var keyOverlap = 4;

    var keySizeX = keyWidth-keyOverlap;

    var keyDown = [];
    var prevDown;
    var keyMapWhite = [0,2,4,5,7,9,11];
    var keyMapBlack = [-1,1,0,3,0,-1,0,6,0,8,0,10,0,-1];

    var keyImg = Y.getImage("pianokey_white");
    var keyImgDown = Y.getImage("pianokey_white_down");
    var bKeyImg = Y.getImage("pianokey_black");
    var bKeyImgDown = Y.getImage("pianokey_black_down");

    var keyTop = 30;
    var bKeyHeight = 0;
    var octave;
    var maxOctave = 3;
    var minOctave = 1;


    var closeButton = Assets.generate("button20_20");
    closeButton.label = "x";
    closeButton.onClick = function(){
        App.doCommand(COMMAND.togglePiano);
    };
    me.addChild(closeButton);

    var octaveBox = new SpinBox();
    octaveBox.name = "Octave";
    octaveBox.label = "Octave";
    octaveBox.value = 1;
    octaveBox.max = maxOctave;
    octaveBox.min = minOctave;
    octaveBox.left = 4;
    octaveBox.top = 2;
    octaveBox.height = 28;
    octaveBox.width = 150;
    octaveBox.font = Font.med;
    octaveBox.onChange = function(value){Input.setCurrentOctave(value)};
    me.addChild(octaveBox);

    me.onShow = function(){
        me.onPanelResize();
    };

    me.onPanelResize = function(){
        me.innerHeight = me.height - (Layout.defaultMargin*2);
        closeButton.top = 4;
        closeButton.left = me.width - 24;

    };
    me.onPanelResize();


    me.on(EVENT.pianoNoteOn,function(index){
        if (!me.isVisible()) return;
        keyDown[index] = true;
        me.refresh();
    });

    me.on(EVENT.pianoNoteOff,function(index){
        if (!me.isVisible()) return;
        keyDown[index] = false;
        me.refresh();
    });


    var getKeyAtPoint = function(x,y){
        var key = -1;

        var octaveWidth = keySizeX*7;

        var keyX = x%octaveWidth;
        var keyOctave = Math.floor(x/octaveWidth);
        
        if (y>= 0){
            if (y>(bKeyHeight+keyTop)){
                // white key
                var keyIndex = Math.floor(keyX/keySizeX);
                key = keyMapWhite[keyIndex] + (keyOctave*12);
            }else{
                var subKeyWidth = (keySizeX/2);
                var margin = subKeyWidth/2;
                var subKey = Math.floor((keyX - margin)/subKeyWidth);
                if (subKey<0) subKey=0;
                if (subKey>12) subKey=12;

                if (subKey%2 === 0){
                    // white key
                    keyIndex = subKey/2;
                    key = keyMapWhite[keyIndex];
                }else{
                    // black key
                    key = keyMapBlack[subKey];
                    if (key<0){
                        // no black key
                        keyIndex = Math.floor(keyX/keySizeX);
                        key = keyMapWhite[keyIndex];
                    }
                }
                key += (keyOctave*12);
            }
        }
        return key+1;
    };

	me.onDown = function(data){
	    
		var x = data.x;
		var y = data.y;
		//var y = data.y - me.top - keyTop;
        

		var key = getKeyAtPoint(x,y);
		if (key) {
			if (key !== prevDown){
				Input.handleNoteOn(key + (octave*12));
				if (prevDown) Input.handleNoteOff(prevDown + (octave*12));
				prevDown = key;
			}
		}
	};

	
	me.onTouchUp = function(data){
        var x = data.x;
        var y = data.y;

        var key = getKeyAtPoint(x,y);
        if (!key) key=prevDown;
        if (key){
            Input.handleNoteOff(key + (octave*12));
            prevDown = undefined;
        }

        if (prevDown) Input.handleNoteOff(prevDown + (octave*12));
        prevDown = undefined;

    };

    me.onDrag = function(data){
        // todo: multitouch?
        var x = data.x;
        var y = data.y;


        var key = getKeyAtPoint(x,y);
        if (key) {
            if (key !== prevDown){
                Input.handleNoteOn(key + (octave*12));
                if (prevDown) Input.handleNoteOff(prevDown + (octave*12));
                prevDown = key;
            }
        }
    };

    me.renderInternal = function(internal){
        if (!me.isVisible()) return;

        internal = !!internal;

        if (this.needsRendering){

            // draw white keys
            var keyHeight = me.height - keyTop;

            var keyX = 0;

            var counter = 0;
            while (keyX<me.width){
                var thisOctave = Math.floor(counter/7);
                var octaveIndex = counter%7;

                var keyIndex = ((octave+thisOctave)*12) + keyMapWhite[octaveIndex] + 1;

                var img = keyDown[keyIndex] ? keyImgDown : keyImg;
                me.ctx.drawImage(img,keyX,keyTop,keyWidth,keyHeight);

                counter++;
                keyX += (keyWidth - keyOverlap);

            }

            // draw black keys
            var bKeyWidth = 48;
            bKeyHeight = Math.floor(keyHeight/1.7);
            var bkeyX = keyWidth - bKeyWidth/2 - 2;
            counter = 0;
            var keyCounter = 0;

            while (bkeyX<me.width){
                thisOctave = Math.floor(counter/7);
                octaveIndex = counter%7;

                if (octaveIndex !== 2 && octaveIndex !== 6){
                    keyIndex = ((octave+thisOctave)*12) + keyMapBlack[(octaveIndex*2)+1] + 1;
                    var bImg = keyDown[keyIndex] ? bKeyImgDown : bKeyImg;
                    me.ctx.drawImage(bImg,bkeyX,keyTop,bKeyWidth,bKeyHeight);
                    keyCounter++
                }
                counter++;

                bkeyX += (keyWidth - keyOverlap);
            }

        }

        this.needsRendering = false;
        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }

    };

    me.on(EVENT.octaveChanged,function(value){
        octave = value;
		octaveBox.setValue(octave,true);
    });

    me.on(EVENT.trackerModeChanged,function(mode){
		maxOctave = Tracker.inFTMode() ? 7 : 3;
		minOctave = Tracker.inFTMode() ? 0 : 1;
		octaveBox.setMax(maxOctave,true);
		octaveBox.setMin(minOctave,true);
    });

    return me;

};

export default app_pianoView;

