UI.app_pianoView = function(){

    var me = UI.app_panelContainer(200);
    me.name = "pianoViewPanel";


    var keyWidth = 64;

    var keys = [];
    var bKeys = [];
    var periodKeys = {};
    var keyDown = [];
    var keyPlayed = [];
    var touchKey = {};

    var keyImg = Y.getImage("pianokey_white");
    var keyImgDown = Y.getImage("pianokey_white_down");
    var bKeyImg = Y.getImage("pianokey_black");
    var bKeyImgDown = Y.getImage("pianokey_black_down");

    var octave = 1;
    var keyTop = 30;
    var bKeyHeight = 0;


    var closeButton = UI.Assets.generate("button20_20");
    closeButton.setLabel("x");
    closeButton.onClick = function(){
        App.doCommand(COMMAND.togglePiano);
    };
    me.addChild(closeButton);

    var octaveBoxBmp = UI.spinBox();
    octaveBoxBmp.setProperties({
        name: "Octave",
        label: "Octave",
        value: 1,
        max: 3,
        min:1,
        left: 4,
        top: 2,
        height: 28,
        width: 150,
        font: window.fontMed,
        onChange : function(value){octave=value}
    });
    me.addChild(octaveBoxBmp);

    me.onShow = function(){
        me.onPanelResize();
    };

    me.onPanelResize = function(){

        me.innerHeight = me.height - (Layout.defaultMargin*2);

        closeButton.setProperties({
            top: 4,
            left: me.width - 24
        });

    };
    me.onPanelResize();


    if (!keys.length){
        for (var note in NOTEPERIOD){
            if (NOTEPERIOD.hasOwnProperty(note)){
                if (note.indexOf("s")<0){
                    // white key
                    periodKeys[NOTEPERIOD[note].period] = keys.length;
                    keys.push(note);
                }else{
                    // black key
                    periodKeys[NOTEPERIOD[note].period] = 1000 + bKeys.length;
                    bKeys.push(note);
                }

            }
        }
    }

    EventBus.on(EVENT.pianoNoteOn,function(note){
        if (!me.isVisible()) return;
        if (note && note.basePeriod){
            var keyIndex = periodKeys[note.basePeriod];
            if (keyIndex >= 0){

                if (keyIndex>=1000){
                    keyIndex = keyIndex - (octave-1)*5;
                }else{
                    keyIndex = keyIndex - (octave-1)*7;
                }

                keyDown[keyIndex] = {
                    startTime: Audio.context.currentTime,
                    source: note.source
                };
                me.refresh();
            }
        }
    });

    EventBus.on(EVENT.pianoNoteOff,function(note){
        if (!me.isVisible()) return;
        if (note && note.basePeriod){
            var keyIndex = periodKeys[note.basePeriod];

            if (keyIndex>=1000){
                keyIndex = keyIndex - (octave-1)*5;
            }else{
                keyIndex = keyIndex - (octave-1)*7;
            }

            if (keyIndex >= 0){
                keyDown[keyIndex] = false;
                me.refresh();
            }
        }
    });

    var keyNoteOn = function(key){

        var note;
        if (key<1000 && keys[key]){
            note =  NOTEPERIOD[keys[key + (octave-1)*7]];
        }else{
            var bkey = key - 1000;
            if (bKeys[bkey]) note =  NOTEPERIOD[bKeys[bkey + (octave-1)*5]];
        }

        if (note && note.period){

            if (Tracker.isRecording()){
                if (Tracker.getCurrentTrackPosition() > 0){
                    // cursorPosition is not on note
                    // play anyway but don't input
                }else{
                    Tracker.putNote(Tracker.getCurrentInstrumentIndex(),note.period);
                    if (Tracker.isPlaying()){

                    }else{
                        Tracker.moveCurrentPatternPos(1);
                    }
                }
            }

            var playedNote = Audio.playSample(Tracker.getCurrentInstrumentIndex(),note.period);
            keyPlayed[key] = playedNote;
            EventBus.trigger(EVENT.pianoNoteOn,playedNote);

        }

    };

    var keyNoteOff = function(key){

        var note;
        if (keyPlayed[key]){
            if (key<1000 && keys[key]){
                note =  NOTEPERIOD[keys[key + (octave-1)*7]];
            }else{
                var bkey = key - 1000;
                if (bKeys[bkey]) note =  NOTEPERIOD[bKeys[bkey + (octave-1)*5]];
            }

            if (note && note.period){
                EventBus.trigger(EVENT.pianoNoteOff,keyPlayed[key]);
                if (keyPlayed[key].volume){
                    keyPlayed[key].volume.gain.linearRampToValueAtTime(0,Audio.context.currentTime + 0.5)
                }else{
                    keyPlayed[key].source.stop();
                }
                keyPlayed[key] = false;
            }
        }
    };

    var getKeyAtPoint = function(x,y){
        var key = -1;
        y = y-keyTop;
        if (y>= 0){
            if (y>bKeyHeight){
                // white key
                key = Math.floor(x/(keyWidth-4));
            }else{
                var subKeyWidth = ((keyWidth-4)/2);
                var margin = subKeyWidth/2;
                var subKey = Math.floor((x - margin)/subKeyWidth);
                if (subKey<0) subKey=0;

                if (subKey%2 == 0){
                    // white key
                    key = subKey/2;
                }else{
                    // black key
                    var keyIndex = {
                        1:0,3:1,5:-1,7:2,9:3,11:4,13:-1,15:5,17:6,19:-1,21:7,23:8,25:9,27:-1,29:10,31:11,33:-1,35:12,37:13,39:14,41:-1
                    };
                    key = 1000 + keyIndex[subKey];
                    if (key<1000){ // no black key
                        key = Math.floor(x/(keyWidth-4));
                    }
                }

            }
        }
        return key;
    };

    me.onDown = function(data){
        var key = getKeyAtPoint(me.eventX,me.eventY);
        if (key>=0){
            touchKey[data.id] = key;
            keyNoteOn(key);
        }
    };

    me.onTouchUp = function(data){
        var x = data.dragX || me.eventX;
        var key = getKeyAtPoint(x,me.eventY);
        if (key>=0){
            touchKey[data.id] = false;
            keyNoteOff(key);
        }
    };

    me.onDrag = function(data){
        var x = data.dragX;
        var y = data.dragY - me.top - keyTop;
        var key = getKeyAtPoint(x,y);
        if (key>=0){
            if (touchKey[data.id] != key){
                keyNoteOff(touchKey[data.id]);
                touchKey[data.id] = key;
                keyNoteOn(key);
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
            var keyOverlap = 4;

            var counter = 0;
            while (keyX<me.width){

                var img = keyDown[counter] ? keyImgDown : keyImg;
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
                var octaveIndex = counter%7;

                var bImg = keyDown[1000+ keyCounter] ? bKeyImgDown : bKeyImg;

                if (octaveIndex != 2 && octaveIndex != 6){
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



    return me;

};

