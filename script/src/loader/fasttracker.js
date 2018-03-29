var FastTracker = function(){
    var me = {};

    // see ftp://ftp.modland.com/pub/documents/format_documentation/FastTracker%202%20v2.04%20(.xm).html
    me.load = function(file,name){

        console.log("loading FastTracker");
        Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER);

        var mod = {};
        var song = {
            patterns:[],
			instruments:[]
        };

        file.litteEndian = true;

        file.goto(17);
        song.title = file.readString(20);
        file.jump(1); //$1a

        mod.trackerName = file.readString(20);
        mod.trackerVersion = file.readByte();
        mod.trackerVersion = file.readByte() + "." + mod.trackerVersion;
        mod.headerSize = file.readDWord(); // is this always 276?
        mod.songlength = file.readWord();
        mod.restartPosition = file.readWord();
        mod.numberOfChannels = file.readWord();
        mod.numberOfPatterns = file.readWord(); // this is sometimes more then the actual number? should we scan for highest pattern? -> YES!
        mod.numberOfInstruments = file.readWord();
        mod.flags = file.readWord();
        mod.defaultTempo = file.readWord();
        mod.defaultBPM = file.readWord();


        var patternTable = [];
        var highestPattern = 0;
        for (var i = 0; i < mod.songlength; ++i) {
            patternTable[i] = file.readUbyte();
            if (highestPattern < patternTable[i]) highestPattern = patternTable[i];
        }
        song.patternTable = patternTable;
        song.length = mod.songlength;
        song.channels = mod.numberOfChannels;
        console.error(highestPattern);


        var fileStartPos = 60 + mod.headerSize;
        file.goto(fileStartPos);

        for (i = 0; i <= highestPattern; ++i) {

            var patternData = [];
            var thisPattern = {};

            thisPattern.headerSize = file.readDWord();
            thisPattern.packingType = file.readUbyte(); // always 0
            thisPattern.patternLength = file.readWord();
            thisPattern.patternSize = file.readWord();

            fileStartPos += thisPattern.headerSize;
            file.goto(fileStartPos);

            for (var step = 0; step<thisPattern.patternLength; step++){
                var row = [];
                var channel;
                for (channel = 0; channel < mod.numberOfChannels; channel++){
                    var trackStep = {
                        note: 0,
                        period: 0,
                        instrument: 0,
                        volumeEffect: 0,
                        effect: 0,
                        param: 0
                    };
                    var v = file.readUbyte();
                    if (v & 128) {
                        if (v &  1) trackStep.note   = file.readUbyte();
                        if (v &  2) trackStep.instrument = file.readUbyte();
                        if (v &  4) trackStep.volumeEffect = file.readUbyte();
                        if (v &  8) trackStep.effect = file.readUbyte();
                        if (v & 16) trackStep.param  = file.readUbyte();
                    } else {
                        trackStep.note = v;
                        trackStep.instrument = file.readUbyte();
                        trackStep.volumeEffect = file.readUbyte();
                        trackStep.effect = file.readUbyte();
                        trackStep.param  = file.readUbyte();
                    }

                    row.push(trackStep);
                }
                patternData.push(row);
            }

            fileStartPos += thisPattern.patternSize;
            file.goto(fileStartPos);

            song.patterns.push(patternData);

        }


        var instrumentContainer = [];
        for (i = 1; i <= mod.numberOfInstruments; ++i) {

            var instrument = Instrument();

            instrument.filePosition = file.index;
            instrument.headerSize = file.readDWord();
            instrument.name = file.readString(22);
            instrument.type = file.readUbyte();
            instrument.numberOfSamples = file.readWord();
            instrument.samples = [];
            instrument.sampleHeaderSize = 0;
            if (instrument.numberOfSamples>0){
                instrument.sampleHeaderSize = file.readDWord();
            }

            fileStartPos += instrument.headerSize;
            file.goto(fileStartPos);

            if (file.isEOF(1)){
                console.error("seek past EOF");
                console.error(instrument);
                break;
            }

            for (var sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++){
                var sample = Sample();

				sample.length = file.readDWord();
                instrument.loopStart = file.readDWord();
                instrument.loopRepeatLength = file.readDWord();
                instrument.volume = file.readUbyte();
                instrument.finetune = file.readByte();
				sample.type = file.readUbyte();
                instrument.panning = file.readUbyte();
                instrument.relativeNote = file.readByte();
                instrument.reserved = file.readByte();
				sample.sName = file.readString(22);
                sample.bits = 8;

                instrument.samples.push(sample);
                fileStartPos += instrument.sampleHeaderSize;
                file.goto(fileStartPos);
            }

            for (sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++){
                sample = instrument.samples[sampleI];
                if (!sample.length) continue;

                fileStartPos += sample.length;

                if (sample.type & 16) {
					sample.bits       = 16;
					sample.type      ^= 16;
                    sample.length    >>= 1;
                    instrument.loopStart >>= 1;
                    instrument.loopRepeatLength   >>= 1;
                }
                instrument.looptype = sample.type || 0;
                if (!instrument.looptype){
                    // TODO should we preserve this in case the file gets saved again ?
                    instrument.loopStart = 0;
                    instrument.loopRepeatLength = 0;
                }

                // sample data
                console.log("Reading sample from 0x" + file.index + " with length of " + sample.length + (instrument.bits == 16 ? " words" : " bytes") +  " and repeat length of " + instrument.loopRepeatLength);
                var sampleEnd = sample.length;

                if (instrument.loopRepeatLength>2 && SETTINGS.unrollShortLoops && instrument.loopRepeatLength<1000){
                    // cut off trailing bytes for short looping samples
                    //sampleEnd = Math.min(sampleEnd,instrument.loopStart + instrument.loopRepeatLength);
                    //instrument.sample.length = sampleEnd;
                }

                var old = 0;
                if (sample.bits == 16){
                    for (var j = 0; j<sampleEnd; j++){
                        var b = file.readShort() + old;
						if (b < -32768) b += 65536;
						else if (b > 32767) b -= 65536;
                        old = b;
						sample.data.push(b / 32768);
                    }
                }else{
                    for (j = 0; j<sampleEnd; j++){
                        b = file.readByte() + old;

						if (b < -128) b += 256;
						else if (b > 127) b -= 256;
						old = b;
						sample.data.push(b / 127);
                    }
                }

                file.goto(fileStartPos);

            }

            instrument.sample = instrument.samples[0];
            Tracker.setInstrument(i,instrument);
            instrumentContainer.push({label: i + " " + instrument.name, data: i});


            console.error(instrument);



            //var sampleLength = file.readWord(); // in words


           /* instrument.length = instrument.realLen = sampleLength << 1;
            instrument.finetune = file.readUbyte();
            if (instrument.finetune>7) instrument.finetune -= 16;
            instrument.volume   = file.readUbyte();
            instrument.loopStart     = file.readWord() << 1;
            instrument.loopRepeatLength   = file.readWord() << 1;

            instrument.pointer = sampleDataOffset;
            sampleDataOffset += instrument.length;
            Tracker.setInstrument(i,instrument);

            */

        }
        if (UI) UI.mainPanel.setInstruments(instrumentContainer);
        song.instruments = Tracker.getInstruments();

        console.error(mod);
        console.error(song);



        /*


        // pattern data

        for (i = 0; i <= highestPattern; ++i) {

            var patternData = [];

            for (var step = 0; step<patternLength; step++){
                var row = [];
                var channel;
                for (channel = 0; channel < 4; channel++){
                    var trackStep = {};
                    var trackStepInfo = file.readUint();

                    trackStep.period = (trackStepInfo >> 16) & 0x0fff;
                    trackStep.effect = (trackStepInfo >>  8) & 0x0f;
                    trackStep.instrument = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
                    trackStep.param  = trackStepInfo & 0xff;

                    row.push(trackStep);
                }

                // fill with empty data for other channels
                for (channel = 4; channel < Tracker.getTrackCount(); channel++){
                    row.push({note:0,effect:0,instrument:0,param:0});
                }

                patternData.push(row);
            }
            song.patterns.push(patternData);

            //file.jump(1024);
        }




        for(i=1; i <= sampleCount; i++) {
            instrument = Tracker.getInstrument(i);
            if (instrument){
                console.log("Reading instrument from 0x" + file.index + " with length of " + instrument.length + " bytes and repeat length of " + instrument.loopRepeatLength);
                //this.samples[i] = ds.readInt8Array(this.inst[i].sampleLength*2);

                var sampleEnd = instrument.length;

                if (instrument.loopRepeatLength>2 && SETTINGS.unrollShortLoops && instrument.loopRepeatLength<1000){
                    // cut off trailing bytes for short looping samples
                    sampleEnd = Math.min(sampleEnd,instrument.loopStart + instrument.loopRepeatLength);
                    instrument.length = sampleEnd;
                }

                for (j = 0; j<sampleEnd; j++){
                    var b = file.readByte();
                    // ignore first 2 bytes
                    if (j<2)b=0;
                    instrument.data.push(b / 127)
                }

                // unroll short loops?
                // web audio loop start/end is in seconds
                // doesn't work that well with tiny loops

                if ((SETTINGS.unrollShortLoops || SETTINGS.unrollLoops) && instrument.loopRepeatLength>2){
                    // TODO: pingpong and reverse loops in XM files? -> unroll once and append the reversed loop

                    var loopCount = Math.ceil(40000 / instrument.loopRepeatLength) + 1;

                    if (!SETTINGS.unrollLoops) loopCount = 0;

                    var resetLoopNumbers = false;
                    var loopLength = 0;
                    if (SETTINGS.unrollShortLoops && instrument.loopRepeatLength<1600){

                        loopCount = Math.floor(1000/instrument.loopRepeatLength);
                        resetLoopNumbers = true;
                    }

                    for (var l=0;l<loopCount;l++){
                        var start = instrument.loopStart;
                        var end = start + instrument.loopRepeatLength;
                        for (j=start; j<end; j++){
                            instrument.data.push(instrument.data[j]);
                        }
                        loopLength += instrument.loopRepeatLength;
                    }

                    if (resetLoopNumbers && loopLength){
                        instrument.loopRepeatLength += loopLength;
                        instrument.length += loopLength;
                    }
                }

                sampleContainer.push({label: i + " " + instrument.name, data: i});
            }
        }


        */


        return song;
    };

    return me;
};