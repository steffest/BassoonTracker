var FastTracker = function(){
    var me = {};

    // see ftp://ftp.modland.com/pub/documents/format_documentation/FastTracker%202%20v2.04%20(.xm).html
    me.load = function(file,name){

        console.log("loading FastTracker");
        Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER);

        var mod = {};
        var song = {
            patterns:[],
            samples:[]
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
                        sample: 0,
                        volumeEffect: 0,
                        effect: 0,
                        param: 0
                    };
                    var v = file.readUbyte();
                    if (v & 128) {
                        if (v &  1) trackStep.note   = file.readUbyte();
                        if (v &  2) trackStep.sample = file.readUbyte();
                        if (v &  4) trackStep.volumeEffect = file.readUbyte();
                        if (v &  8) trackStep.effect = file.readUbyte();
                        if (v & 16) trackStep.param  = file.readUbyte();
                    } else {
                        trackStep.note = v;
                        trackStep.sample = file.readUbyte();
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


        var sampleContainer = [];
        for (i = 1; i <= mod.numberOfInstruments; ++i) {

            var instrument = {};

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
                var sample = {
                    name: instrument.name,
                    data: []
                };

                sample.length = file.readDWord();
                sample.loopStart = file.readDWord();
                sample.loopRepeatLength = file.readDWord();
                sample.volume = file.readUbyte();
                sample.finetune = file.readByte();
                sample.type = file.readUbyte();
                sample.panning = file.readUbyte();
                sample.relativeNote = file.readByte();
                sample.reserved = file.readByte();
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
                    sample.loopStart >>= 1;
                    sample.loopRepeatLength   >>= 1;
                }
                sample.looptype = sample.type || 0;
                if (!sample.looptype){
                    // TODO should we preserve this in case the file gets saved again ?
                    sample.loopStart = 0;
                    sample.loopRepeatLength = 0;
                }

                // sample data
                console.log("Reading sample from 0x" + file.index + " with length of " + sample.length + (sample.bits == 16 ? "words" : "bytes") +  " and repeat length of " + sample.loopRepeatLength);
                var sampleEnd = sample.length;

                if (sample.loopRepeatLength>2 && SETTINGS.unrollShortLoops && sample.loopRepeatLength<1000){
                    // cut off trailing bytes for short looping samples
                    //sampleEnd = Math.min(sampleEnd,sample.loopStart + sample.loopRepeatLength);
                    //sample.length = sampleEnd;
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


            Tracker.setSample(i,instrument.samples[0]);
            sampleContainer.push({label: i + " " + instrument.name, data: i});


            console.error(instrument);



            //var sampleLength = file.readWord(); // in words


           /* sample.length = sample.realLen = sampleLength << 1;
            sample.finetune = file.readUbyte();
            if (sample.finetune>7) sample.finetune -= 16;
            sample.volume   = file.readUbyte();
            sample.loopStart     = file.readWord() << 1;
            sample.loopRepeatLength   = file.readWord() << 1;

            sample.pointer = sampleDataOffset;
            sampleDataOffset += sample.length;
            Tracker.setSample(i,sample);

            */

        }
        if (UI) UI.mainPanel.setInstruments(sampleContainer);
        song.samples = Tracker.getSamples();

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
                    trackStep.sample = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
                    trackStep.param  = trackStepInfo & 0xff;

                    row.push(trackStep);
                }

                // fill with empty data for other channels
                for (channel = 4; channel < Tracker.getTrackCount(); channel++){
                    row.push({note:0,effect:0,sample:0,param:0});
                }

                patternData.push(row);
            }
            song.patterns.push(patternData);

            //file.jump(1024);
        }




        for(i=1; i <= sampleCount; i++) {
            sample = Tracker.getSample(i);
            if (sample){
                console.log("Reading sample from 0x" + file.index + " with length of " + sample.length + " bytes and repeat length of " + sample.loopRepeatLength);
                //this.samples[i] = ds.readInt8Array(this.inst[i].sampleLength*2);

                var sampleEnd = sample.length;

                if (sample.loopRepeatLength>2 && SETTINGS.unrollShortLoops && sample.loopRepeatLength<1000){
                    // cut off trailing bytes for short looping samples
                    sampleEnd = Math.min(sampleEnd,sample.loopStart + sample.loopRepeatLength);
                    sample.length = sampleEnd;
                }

                for (j = 0; j<sampleEnd; j++){
                    var b = file.readByte();
                    // ignore first 2 bytes
                    if (j<2)b=0;
                    sample.data.push(b / 127)
                }

                // unroll short loops?
                // web audio loop start/end is in seconds
                // doesn't work that well with tiny loops

                if ((SETTINGS.unrollShortLoops || SETTINGS.unrollLoops) && sample.loopRepeatLength>2){
                    // TODO: pingpong and reverse loops in XM files? -> unroll once and append the reversed loop

                    var loopCount = Math.ceil(40000 / sample.loopRepeatLength) + 1;

                    if (!SETTINGS.unrollLoops) loopCount = 0;

                    var resetLoopNumbers = false;
                    var loopLength = 0;
                    if (SETTINGS.unrollShortLoops && sample.loopRepeatLength<1600){

                        loopCount = Math.floor(1000/sample.loopRepeatLength);
                        resetLoopNumbers = true;
                    }

                    for (var l=0;l<loopCount;l++){
                        var start = sample.loopStart;
                        var end = start + sample.loopRepeatLength;
                        for (j=start; j<end; j++){
                            sample.data.push(sample.data[j]);
                        }
                        loopLength += sample.loopRepeatLength;
                    }

                    if (resetLoopNumbers && loopLength){
                        sample.loopRepeatLength += loopLength;
                        sample.length += loopLength;
                    }
                }

                sampleContainer.push({label: i + " " + sample.name, data: i});
            }
        }


        */


        return song;
    };

    return me;
};