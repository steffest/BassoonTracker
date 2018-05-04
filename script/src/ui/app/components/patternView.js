UI.app_patternView = function(x,y,w,h){

    var me = UI.panel(x,y,w,h);
    var visibleLines = 0;
    var visibleTracks = 8;
    var lineHeight = 13;
    var scrollBarItemOffset = 0;
    var startTrack = 0;
    var max = Tracker.getPatternLength();

    var scrollBar = UI.scale9Panel(w-28,18,16,h-3,{
        img: Y.getImage("bar"),
        left:2,
        top:2,
        right:3,
        bottom: 3
    });

    scrollBar.onDragStart=function(){
        if (Tracker.isPlaying()) return;
        scrollBar.startDragIndex = Tracker.getCurrentPatternPos();

    };

    scrollBar.onDrag=function(touchData){
        if (Tracker.isPlaying()) return;
        if (visibleLines && scrollBarItemOffset){
            var delta =  touchData.dragY - touchData.startY;
            var pos = Math.floor(scrollBar.startDragIndex + delta/scrollBarItemOffset);
            pos = Math.min(pos,max-1);
            pos = Math.max(pos,0);
            Tracker.setCurrentPatternPos(pos);
            //setScrollBarPosition();
        }
    };

    me.addChild(scrollBar);
    setScrollBarPosition();

    var scrollBarHor = UI.scale9Panel(w-28,18,16,16,{
        img: Y.getImage("bar"),
        left:2,
        top:2,
        right:3,
        bottom: 3
    });

    scrollBarHor.onDragStart=function(){
        scrollBarHor.startDragIndex = startTrack;
    };

    scrollBarHor.onDrag=function(touchData){
        var maxSteps = Tracker.getTrackCount()-visibleTracks;
        var delta =  touchData.dragX - touchData.startX;
        var rest = me.width - scrollBarHor.width;
        var step = Math.floor(delta / (rest/maxSteps));
        me.setHorizontalScroll(scrollBarHor.startDragIndex + step);
    };
    me.addChild(scrollBarHor);


    var fxPanels = [];
    for (var i = 0, len = Tracker.getTrackCount(); i<len;i++){
        var fxPanel = UI.fxPanel(i);
        fxPanels.push(fxPanel);
        me.addChild(fxPanel);
    }

    var trackVULevel = [];
    var trackVUHistory = [];
    var trackVULevelDecay = 10;
    var trackVULevelMax = 70;


    me.setHorizontalScroll = function(newStartTrack){
        var maxSteps = Tracker.getTrackCount()-visibleTracks;
        if (newStartTrack!=startTrack && newStartTrack>=0 && newStartTrack<=maxSteps){
            startTrack = newStartTrack;
            EventBus.trigger(EVENT.patternHorizontalScrollChange,startTrack);
            setScrollBarHorPosition()
        }
    };

    me.toggleFxPanel = function(track){
        fxPanel = fxPanels[track];

        if (fxPanel.visible){
            fxPanel.hide();
        }else{

            var visibleHeight = me.height;

            fxPanel.setPosition(fxPanel.left,0);
            fxPanel.setSize(Layout.trackWidth,visibleHeight);
            fxPanel.setLayout();
            fxPanel.show();
        }

        me.refresh();
    };

    me.render = function(){
        if (!me.isVisible()) return;

        if (this.needsRendering){
            me.clearCanvas();

            var index = Tracker.getCurrentPattern() || 0;
            var patternPos = Tracker.getCurrentPatternPos() || 0;

            var song = Tracker.getSong();
            if (!song) return;

            var margin = Layout.trackMargin;

            visibleTracks = Layout.visibleTracks;
            var hasHorizontalScrollBar =  visibleTracks<Tracker.getTrackCount();
            var visibleHeight = me.height-30;

            var trackY = 0;
            var trackLeft = 0;

            var patternNumberLeft = 10;
            var initialTrackTextOffset = 60;
            var lineNumbersToTheLeft = false;
            if (trackLeft) {
                patternNumberLeft = 0;
                initialTrackTextOffset = 0;
                lineNumbersToTheLeft = true;
            }

            if (hasHorizontalScrollBar){
                visibleHeight -= 24;
            }

            visibleLines = Math.ceil(visibleHeight/lineHeight);
            if (visibleLines%2== 0) visibleLines--;

            var topLines =  Math.floor(visibleLines/2);

            var visibleStart = patternPos - topLines;
            var visibleEnd = visibleStart + visibleLines;

            var centerLineHeight = lineHeight + 2;
            var centerLineTop = Math.floor((visibleHeight + centerLineHeight)/2);

            var baseY = centerLineTop - (topLines*lineHeight) + 4;

            var panelHeight = centerLineTop;
            var panelTop2 = centerLineTop + centerLineHeight;

            var darkPanel = cachedAssets.darkPanel;
            if (!darkPanel && Y.getImage("panel_dark")){
                var p = UI.scale9Panel(0,0,Layout.trackWidth,panelHeight,{
                    img: Y.getImage("panel_dark"),
                    left:3,
                    top:3,
                    right:2,
                    bottom: 2
                });
                cachedAssets.darkPanel = p.render(true);
                darkPanel = cachedAssets.darkPanel;
            }

            var isTrackVisible = [];
            var hasVU = false;

            if (trackVULevelMax > panelHeight){
                trackVULevelMax = panelHeight;
                trackVULevelDecay = trackVULevelMax/10;
            }



            for (var i = 0; i<visibleTracks;i++){

                var trackIndex = startTrack + i;
                isTrackVisible[trackIndex] = !(fxPanels[trackIndex] && fxPanels[trackIndex].visible);

                if (isTrackVisible[trackIndex]){
                    var trackX = trackLeft + i*(Layout.trackWidth+margin);
                    me.ctx.drawImage(darkPanel,trackX,0,Layout.trackWidth,panelHeight);
                    me.ctx.drawImage(darkPanel,trackX,panelTop2,Layout.trackWidth,panelHeight);
                    if (fxPanels[trackIndex]) fxPanels[trackIndex].left = trackX;
                }
            }

            //var patternIndex = song.patternTable[index];
            //var pattern = song.patterns[patternIndex];
            var pattern = song.patterns[index];

            if (pattern){

                if (Tracker.isRecording()){
                    me.ctx.fillStyle = "#A50B0F";
                }else{
                    me.ctx.fillStyle = "#202E58";
                }

                var textWidth = 68;
                // used to center text in Column;

                me.ctx.fillRect(0,centerLineTop,(me.width-0*2),centerLineHeight);

                // draw cursor
                var cursorPos = Tracker.getCurrentTrackPosition();
                var cursorWidth = 9;

                var cursorX;
                if (lineNumbersToTheLeft){
                    // center text in pattern
                    trackX = trackLeft + Tracker.getCurrentTrack()*(Layout.trackWidth+margin);
                    cursorX = trackX + Math.floor((Layout.trackWidth-textWidth)/2) + (cursorPos*cursorWidth) - 1;
                }else{
                    cursorX = trackLeft + initialTrackTextOffset + ((Tracker.getCurrentTrack()) * Layout.trackWidth) + (cursorPos*cursorWidth) - 1;

                }

                if (cursorPos > 0) {
                    cursorX += cursorWidth*2 + 1;
                    if (cursorPos > 2) cursorX += 2;
                }else{
                    cursorWidth = 28;
                }

                //me.ctx.fillStyle = "rgba(231,198,46,.5)";
                me.ctx.fillStyle = "rgba(220,220,220,.3)";
                me.ctx.fillRect(cursorX,centerLineTop,cursorWidth,lineHeight+2);

                var displayVolume = Tracker.getTrackerMode() === TRACKERMODE.FASTTRACKER;


                for (var i = visibleStart; i< visibleEnd; i++){
                    if (i>=0 && i<Tracker.getPatternLength()){
                        var step = pattern[i];
                        var y = baseY + ((i-visibleStart)*lineHeight);

                        var isCenter = true;
                        if (y<centerLineTop){
                            y -= 3;
                            isCenter = false;
                        }
                        if (y>centerLineTop+lineHeight) {
                            y += 3;
                            isCenter = false;
                        }

                        var ti = "" + i;
                        if (i<10) ti = "0" + ti;
                        var color = false;
                        if (i%4 == 0) color = "orange";


                        drawText(ti,patternNumberLeft,y,color);
                        if (isCenter){
                            drawText(ti,patternNumberLeft,y,color);
                            drawText(ti,patternNumberLeft,y,color);
                        }


                        for (var j = 0; j<visibleTracks;j++){
                            trackIndex = j+startTrack;
                            if (isTrackVisible[trackIndex] && trackIndex<Tracker.getTrackCount()){
                                var note = step[trackIndex];
                                var x;
                                if (lineNumbersToTheLeft){
                                    // center text in pattern
                                    trackX = trackLeft + j*(Layout.trackWidth+margin);
                                    x = trackX + Math.floor((Layout.trackWidth-textWidth)/2);
                                }else{
                                    x = trackLeft + initialTrackTextOffset + (j*Layout.trackWidth);
                                }

                                if (note.note){
                                    // XM module
                                    var ftNote = FTNotes[note.note];
                                    var noteString = ftNote ? ftNote.name : "???"
                                }else{
                                    var baseNote = periodNoteTable[note.period];
                                    noteString = baseNote ? baseNote.name : "---";
                                }


                                drawText(noteString,x,y);
                                if (isCenter){
                                    drawText(noteString,x,y);
                                    drawText(noteString,x,y);

                                    if (Tracker.isPlaying() || trackVULevel[j] && SETTINGS.vubars != "none"){
                                        // draw VU of center note
                                        var currentPos = index + "." + patternPos;
                                        if (Tracker.isPlaying() && note && note.period && trackVUHistory[j]!=currentPos){
                                            var vu = 100;
                                            if (note.effect == 12){
                                                vu = note.param * 100/64;
                                            }else{
                                                var instrument = Tracker.getInstrument(note.instrument);
                                                if (instrument) vu = instrument.volume * 100/64;
                                            }
                                            trackVULevel[j] = vu;
                                            trackVUHistory[j]=currentPos;
                                        }

                                        if (trackVULevel[j]){
                                            hasVU = true;
                                            var vuHeight = trackVULevel[j] * trackVULevelMax / 100;

                                            var sHeight = vuHeight * 100 / trackVULevelMax;

                                            if (SETTINGS.vubars == "colour"){
                                                var bar = Y.getImage("vubar");
                                                me.ctx.drawImage(bar,0,100-sHeight,26,sHeight,x-12,centerLineTop-vuHeight,10,vuHeight);
                                            }
                                            if (SETTINGS.vubars == "trans"){
                                                trackX = trackLeft + j*(Layout.trackWidth+margin);
                                                me.ctx.fillStyle = "rgba(120,190,255,0.3)";
                                                me.ctx.fillRect(x-14,centerLineTop-vuHeight,10,vuHeight);
                                            }



                                            trackVULevel[j] -= trackVULevelDecay;
                                            if (trackVULevel[j]<0){
                                                trackVULevel[j]=0;
                                            }
                                        }
                                    }
                                }

                                x += (fontMed.charWidth*3) + 4;
                                noteString = formatHex(note.instrument,2,"0");
                                if (noteString == "00") noteString = "..";
                                drawText(noteString,x,y,"green");


                                if (displayVolume){
                                    x += (fontMed.charWidth*2) + 4;
                                    var value = note.volumeEffect || 0;
                                    if (value) value -= 10;
                                    noteString = formatHex(value,2,"0");
                                    if (noteString == "00") noteString = "..";
                                    drawText(noteString,x,y);
                                }


                                x += (fontMed.charWidth*2) + 4;
                                noteString = formatHex(note.effect);
                                noteString += formatHex(note.param,2,"0");
                                if (noteString == "000") noteString = "...";
                                drawText(noteString,x,y,"orange");
                            }
                        }

                        if (hasVU){
                            setTimeout(function(){
                                me.refresh();
                            },20);
                        }
                    }

                }
            }

            for (var j = 0; j<visibleTracks;j++){
                trackIndex = j+startTrack;
                if (!isTrackVisible[trackIndex]){
                    fxPanels[trackIndex].render();
                }
            }

            setScrollBarPosition();
            scrollBar.render();
            if (hasHorizontalScrollBar){
                setScrollBarHorPosition();
                scrollBarHor.render();

                // tracknumbers
                for (j = 0; j<visibleTracks;j++){
                    trackIndex = j+startTrack;
                    if (isTrackVisible[trackIndex]){
                        trackX = trackLeft + j*(Layout.trackWidth+margin) + 2;
                        drawText("" + (trackIndex+1),trackX,2);
                    }
                }


            }


        }
        this.needsRendering = false;

        me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
    };

    function drawText(t,x,y,color){
        fontMed.write(me.ctx,t,x,y,0,color);
    }

    function formatHex(i,length,padString){
        h = i.toString(16).toUpperCase();
        if (length && h.length<length){
            padString = padString || "0";
            while (h.length<length){
                h = padString + h;
            }
        }
        return h;
    }

    function setScrollBarPosition(){

        var patternPos = Tracker.getCurrentPatternPos() || 0;
        if (visibleLines){
            var startTop = 1;
            var top = startTop;
            var startHeight = me.height-2;
            var height = startHeight;
            scrollBarItemOffset = 0;

            if (max>1){
                height = Math.floor((visibleLines / max) * startHeight);
                if (height<12) height = 12;
                scrollBarItemOffset = (startHeight - height) / (max-1);
            }

            if (patternPos && scrollBarItemOffset){
                top = Math.floor(startTop + scrollBarItemOffset*patternPos);
            }

            scrollBar.setProperties({
                left: me.width - 16,
                top: top,
                width: 16,
                height: height
            });
        }

    }

    function setScrollBarHorPosition(){

        var max = me.width;
        var width = Math.floor((max / Tracker.getTrackCount()) * visibleTracks);
        var step = (max - width) / (Tracker.getTrackCount()-visibleTracks);

        var top = me.height-20;
        if (visibleTracks>=Tracker.getTrackCount()) top = -200;

        scrollBarHor.setProperties({
            top: top,
            width: width,
            left: 0 + Math.floor((startTrack * step))
        });
    }

    me.onMouseWheel = function(touchData){
        if (Tracker.isPlaying()) return;
        var pos = Tracker.getCurrentPatternPos();
        if (touchData.mouseWheels[0] > 0){
            if (pos) Tracker.moveCurrentPatternPos(-1);
        }else{
            if (pos<max-1) Tracker.moveCurrentPatternPos(1);
        }
    };

    me.onDragStart = function(touchData){
        scrollBarHor.startDragIndex = startTrack;
        if (Tracker.isPlaying()) return;
        me.startDragPos = Tracker.getCurrentPatternPos();
    };

    me.onDrag = function(touchData){

        if (visibleTracks<Tracker.getTrackCount()){
            var maxSteps = Tracker.getTrackCount()-visibleTracks;
            var delta =  touchData.dragX - touchData.startX;
            var rest = me.width - scrollBarHor.width;
            var step = Math.floor(delta / (rest/maxSteps));
            me.setHorizontalScroll(scrollBarHor.startDragIndex - step);
        }

        if (Tracker.isPlaying()) return;

        delta =  Math.round((touchData.dragY - touchData.startY)/lineHeight);
        var targetPos = me.startDragPos - delta;
        targetPos = Math.max(targetPos,0);
        targetPos = Math.min(targetPos,max-1);
        Tracker.setCurrentPatternPos(targetPos);
    };


    me.getStartTrack = function(){
        return startTrack;
    };


	EventBus.on(EVENT.trackCountChange,function(trackCount){
		if (visibleTracks<trackCount) visibleTracks = trackCount;
		startTrack = Math.min(startTrack,trackCount-visibleTracks);
		startTrack = Math.max(startTrack,0);
		for (var i = fxPanels.length, len = trackCount; i<len;i++){
			var fxPanel = UI.fxPanel(i);
			fxPanels.push(fxPanel);
			me.addChild(fxPanel);
		}
	});

	EventBus.on(EVENT.songLoaded,function(){
		me.setHorizontalScroll(0);
	});

	EventBus.on(EVENT.visibleTracksCountChange,function(){
	    startTrack = 0;
        me.refresh();
	});

	EventBus.on(EVENT.trackerModeChanged,function(){
		me.refresh();
	});


	return me;

};

