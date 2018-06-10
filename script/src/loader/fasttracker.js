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

                instrument.volumeEnvelope = {raw: []};
				instrument.panningEnvelope = {raw: []};
				instrument.vibrato = {};
                instrument.sampleNumberForNotes = [];

                for (var si = 0; si<96;  si++) instrument.sampleNumberForNotes.push(file.readUbyte());
				for (si = 0; si<24;  si++) instrument.volumeEnvelope.raw.push(file.readWord());
				for (si = 0; si<24;  si++) instrument.panningEnvelope.raw.push(file.readWord());

				instrument.volumeEnvelope.count = file.readUbyte();
				instrument.panningEnvelope.count = file.readUbyte();
				instrument.volumeEnvelope.sustainPoint = file.readUbyte();
				instrument.volumeEnvelope.loopStartPoint = file.readUbyte();
				instrument.volumeEnvelope.loopEndPoint = file.readUbyte();
				instrument.panningEnvelope.sustainPoint = file.readUbyte();
				instrument.panningEnvelope.loopStartPoint = file.readUbyte();
				instrument.panningEnvelope.endPoint = file.readUbyte();
				instrument.volumeEnvelope.type = file.readUbyte();
				instrument.panningEnvelope.Type = file.readUbyte();
				instrument.vibrato.type = file.readUbyte();
				instrument.vibrato.sweep = file.readUbyte();
				instrument.vibrato.depth = file.readUbyte();
				instrument.vibrato.rate = file.readUbyte();
				instrument.fadeout = file.readWord();
				instrument.reserved = file.readWord();

				function processEnvelope(envelope){
					envelope.points = [];
					for (si = 0; si < 12; si++) envelope.points.push(envelope.raw.slice(si*2,si*2+2));
					if (envelope.type & 1){ // on
						envelope.enabled = true;
					}

					if (envelope.type & 2){
						// sustain
						envelope.sustain = true;
					}

					if (envelope.type & 4){
						// loop
						envelope.loop = true;
					}

					return envelope;

				}

				instrument.volumeEnvelope = processEnvelope(instrument.volumeEnvelope);
				instrument.panningEnvelope = processEnvelope(instrument.panningEnvelope);

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
                instrument.finetuneX = file.readByte();
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
                console.log("Reading sample from 0x" + file.index + " with length of " + sample.length + (instrument.bits === 16 ? " words" : " bytes") +  " and repeat length of " + instrument.loopRepeatLength);
                var sampleEnd = sample.length;

                if (instrument.loopRepeatLength>2 && SETTINGS.unrollShortLoops && instrument.loopRepeatLength<1000){
                    // cut off trailing bytes for short looping samples
                    //sampleEnd = Math.min(sampleEnd,instrument.loopStart + instrument.loopRepeatLength);
                    //instrument.sample.length = sampleEnd;
                }

                var old = 0;
                if (sample.bits === 16){
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
						sample.data.push(b / 127); // TODO: or /128 ? seems to introduce artifacts - see test-loop-fadeout.xm
                    }
                }

                // unroll ping pong loops
                if (instrument.looptype == 2){

                    // TODO: keep original sample
                    instrument.loopRepeatLength = instrument.loopRepeatLength;
                    var loopPart = sample.data.slice(instrument.loopStart,instrument.loopStart + instrument.loopRepeatLength);

                    sample.data = sample.data.slice(0,instrument.loopStart + instrument.loopRepeatLength);
                    sample.data = sample.data.concat(loopPart.reverse());
                    instrument.loopRepeatLength = instrument.loopRepeatLength*2;
                    instrument.samples[0].length = instrument.loopStart + instrument.loopRepeatLength;

                }

                file.goto(fileStartPos);

            }

            instrument.sample = instrument.samples[0];
            Tracker.setInstrument(i,instrument);
            instrumentContainer.push({label: i + " " + instrument.name, data: i});

        }
        EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
        song.instruments = Tracker.getInstruments();

        Tracker.setBPM(mod.defaultBPM);
        Tracker.setAmigaSpeed(mod.defaultTempo);

        return song;
    };

    return me;
};