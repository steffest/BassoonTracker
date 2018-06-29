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
        mod.numberOfPatterns = file.readWord(); // this is sometimes more then the actual number? should we scan for highest pattern? -> YES! -> NO!
        mod.numberOfInstruments = file.readWord();
        mod.flags = file.readWord(); // TODO: implement difference between amiga frequency and linear frequency
        if (mod.flags%2 === 1){
            Tracker.useLinearFrequency = true;
        }else{
            Tracker.useLinearFrequency = false;
        }

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


        for (i = 0; i < mod.numberOfPatterns; i++) {

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
                    var note = Note();
                    var v = file.readUbyte();
                    if (v & 128) {
                        if (v &  1) note.setIndex(file.readUbyte());
                        if (v &  2) note.instrument = file.readUbyte();
                        if (v &  4) note.volumeEffect = file.readUbyte();
                        if (v &  8) note.effect = file.readUbyte();
                        if (v & 16) note.param  = file.readUbyte();
                    } else {
                        note.setIndex(v);
                        note.instrument = file.readUbyte();
                        note.volumeEffect = file.readUbyte();
                        note.effect = file.readUbyte();
                        note.param  = file.readUbyte();
                    }

                    row.push(note);
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
				instrument.panningEnvelope.loopEndPoint = file.readUbyte();
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



            if (instrument.numberOfSamples === 0){
                var sample = Sample();
                instrument.samples.push(sample);
            }else{
                if (file.isEOF(1)){
                    console.error("seek past EOF");
                    console.error(instrument);
                    break;
                }

                for (var sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++){
                    sample = Sample();

                    sample.length = file.readDWord();
                    instrument.loop.start = file.readDWord();
                    instrument.loop.length = file.readDWord();
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
                        instrument.loop.start >>= 1;
                        instrument.loop.length   >>= 1;
                    }
                    instrument.loop.type = sample.type || 0;
                    instrument.loop.enabled = !!instrument.loop.type;

                    // sample data
                    console.log("Reading sample from 0x" + file.index + " with length of " + sample.length + (instrument.bits === 16 ? " words" : " bytes") +  " and repeat length of " + instrument.loop.length);
                    var sampleEnd = sample.length;


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
                    if (instrument.loop.type == LOOPTYPE.PINGPONG){

                        // TODO: keep original sample
                        var loopPart = sample.data.slice(instrument.loop.start,instrument.loop.start + instrument.loop.length);

                        sample.data = sample.data.slice(0,instrument.loop.start + instrument.loop.length);
                        sample.data = sample.data.concat(loopPart.reverse());
                        instrument.loop.length = instrument.loop.length*2;
                        instrument.samples[0].length = instrument.loop.start + instrument.loop.length;

                    }

                    file.goto(fileStartPos);

                }
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


    // build internal
    me.write = function(next){
		var song = Tracker.getSong();
		var instruments = Tracker.getInstruments(); // note: intruments start at index 1, not 0
		var trackCount = Tracker.getTrackCount();

		var version = typeof versionNumber === "undefined" ? "dev" : versionNumber;

		var highestPattern = 0;
        for (i = 0;i<128;i++){
            var p = song.patternTable[i] || 0;
            highestPattern = Math.max(highestPattern,p);
        }


		// first get filesize
		var fileSize = 60 + 276;

            for (i = 0; i<=highestPattern; i++){
                fileSize += (9 + (song.patterns[i].length * trackCount * 5));
            }

            for (i = 1; i<instruments.length; i++){
                var instrument = instruments[i];
                if (instrument && instrument.sample.length){
                    fileSize += 243 + 40 + instrument.sample.length;
                }else{
                    fileSize += 29;
                }
            }



		var i;
		var arrayBuffer = new ArrayBuffer(fileSize);
		var file = new BinaryStream(arrayBuffer,false);


		file.writeStringSection("Extended Module: ",17);
		file.writeStringSection(song.title,20);
		file.writeByte(26);
		file.writeStringSection("BassoonTracker " + version,20);
		file.writeByte(4); // minor version xm format
		file.writeByte(1); // major version xm format

		file.writeDWord(276); // header size;
		file.writeWord(song.length);
		file.writeWord(0); //restart position
		file.writeWord(Tracker.getTrackCount());
		file.writeWord(highestPattern+1); // number of patterns
		file.writeWord(instruments.length-1); // number of instruments
		file.writeWord(0); // TODO: 1 for linear frequency instead of amiga frequency
		file.writeWord(Tracker.getAmigaSpeed()); // default tempo
		file.writeWord(Tracker.getBPM()); // default BPM


		//CHECK: are most players compatible when we only only write the actual song length instead of all 256?
		for (i = 0; i < 256; i++) {
			file.writeUByte(song.patternTable[i] || 0);
		}


		// write pattern data
		for (i = 0; i <= highestPattern; i++) {

			var thisPattern = song.patterns[i];

			file.writeDWord(9); // header size;
			file.writeUByte(0); // packing type
			file.writeWord(thisPattern.length);

			// TODO: packing?
			var patternSize = thisPattern.length * trackCount * 5;
			file.writeWord(patternSize);

			for (var step=0, max=thisPattern.length; step<max;step++){
				var row = thisPattern[step];
				for (var channel=0; channel<trackCount;channel++){
					var note = row[channel];
					file.writeUByte(note.index);
					file.writeUByte(note.instrument);
					file.writeUByte(note.volumeEffect);
					file.writeUByte(note.effect);
					file.writeUByte(note.param);
				}
			}
		}

		// write instrument data
		for (i=1; i<instruments.length; i++){

			instrument = instruments[i];
			if (instrument && instrument.sample.length){

				file.writeDWord(243); // header size;
				file.writeStringSection(instrument.name,22);
				file.writeUByte(0); // instrument type
				file.writeWord(1); // number of samples

                var volumeEnvelopeType =
                    ((instrument.volumeEnvelope.enabled && 1)
                        + (instrument.volumeEnvelope.sustain && 2)
                        + (instrument.volumeEnvelope.loop && 4)) || 0;

                var panningEnvelopeType =
                    ((instrument.panningEnvelope.enabled && 1)
                        + (instrument.panningEnvelope.sustain && 2)
                        + (instrument.panningEnvelope.loop && 4)) || 0;

                var sampleType = 0;
                if (instrument.loop.length>2) sampleType=1;
                //TODO pingpong loops and 16-bit samples , or are we keeping pingpong loops unrolled?

				file.writeDWord(40); // sample header size;
				for (var si = 0; si<96;  si++){
					file.writeUByte(0); // sample number for notes
				}

				//!!!
				for (si = 0; si<24;  si++){
					file.writeWord(0); // volume envelope
				}
				//!!!
				for (si = 0; si<24;  si++){
					file.writeWord(0); // panning envelope
				}

				file.writeUByte(instrument.volumeEnvelope.count || 0);
				file.writeUByte(instrument.panningEnvelope.count || 0);
				file.writeUByte(instrument.volumeEnvelope.sustainPoint || 0);
				file.writeUByte(instrument.volumeEnvelope.loopStartPoint || 0);
				file.writeUByte(instrument.volumeEnvelope.loopEndPoint || 0);
				file.writeUByte(instrument.panningEnvelope.sustainPoint || 0);
				file.writeUByte(instrument.panningEnvelope.loopStartPoint || 0);
				file.writeUByte(instrument.panningEnvelope.loopEndPoint || 0);
				file.writeUByte(volumeEnvelopeType);
				file.writeUByte(panningEnvelopeType);
				file.writeUByte(instrument.vibrato.type || 0);
				file.writeUByte(instrument.vibrato.sweep || 0);
				file.writeUByte(instrument.vibrato.depth || 0);
				file.writeUByte(instrument.vibrato.rate || 0);
				file.writeWord(instrument.fadeout || 0);
				file.writeWord(0);

				// write sample data
				file.writeDWord(instrument.sample.length);
				file.writeDWord(instrument.loop.start);
				file.writeDWord(instrument.loop.length);
				file.writeUByte(instrument.volume);
				file.writeByte(instrument.finetuneX);
				file.writeUByte(sampleType);
				file.writeUByte(instrument.panning || 0);
				file.writeUByte(instrument.relativeNote || 0);
				file.writeUByte(0);
				file.writeStringSection(instrument.name,22);

				var b;
				var delta = 0;
				var prev = 0;
				for (si = 0, max=instrument.sample.length; si<max ; si++){
				    // note - we convert all samples to 8-bit for now
				    b = Math.round(instrument.sample.data[si] * 127);
                    delta = b-prev;
                    prev = b;

                    if (delta < -128) delta += 256;
                    else if (delta > 127) delta -= 256;
					file.writeByte(delta);
				}

			}else{
				// empty sample
				file.writeDWord(29); // header size;
				file.writeStringSection(instrument ? instrument.name : "",22);
				file.writeUByte(0); // instrument type
				file.writeWord(0); // number of samples
			}
		}


		if (next) next(file);

	};

    return me;
};

// TODO - fasttracker playback routine fixes:
/*
- Vibrato (effect 4) -> linear frerquency
- example: Ambrozia.xm - jt_letgo.xm

- Arpegio is off
example: external.xm - pattern 5 track 8

aws_aq16.xm : sample 2 and 3 - loop settings are wrong - don't play

 */