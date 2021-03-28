var Midi = function(){
	var me = {};
	var inputs;
	var outputs;
	var enabled;
	
	
	me.init = function(){
		if (navigator.requestMIDIAccess) {
			// TODO: does a browser that supports requestMIDIAccess also always support promises?
			navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
			function onMIDISuccess(midiAccess) {
				console.log("Midi enabled");
				enabled = true;
				var inputs = midiAccess.inputs;
				var outputs = midiAccess.outputs;
				
				//for (var input of inputs.values()) input.onmidimessage = getMIDIMessage;
				// this barfs on non ES6 browsers -> use Arrays
				
				var _inputs = Array.from(inputs.values());
				_inputs.forEach(function(input){
					input.onmidimessage = getMIDIMessage;
				})
				
				if (_inputs.length){
					EventBus.trigger(EVENT.midiIn);
				}
				
			}
			function onMIDIFailure() {
				console.log('Could not access your MIDI devices.');
			}
		} else {
			console.warn("Midi not supported");
			return false;
		}
	}

	me.enable = function(){
		Midi.init();
	}

	me.disable = function(){
		enabled = false;
		EventBus.trigger(EVENT.midiIn);
	}
	
	me.isEnabled = function(){
		return !!enabled;
	}

	function getMIDIMessage(midiMessage) {
		if (!enabled) return;
		var data = midiMessage.data;
		switch (data[0]){
			case 128:
			case 129:
				noteOff(data[1],data[2]);
				break;
			case 144:
			case 145:
			case 146:
			case 147:
			case 148:
			case 149:
			case 150:
			case 151:
			case 152:
			case 153:
			case 154:
			case 155:
			case 156:
			case 157:
			case 158:
			case 159:
				// TODO: make a difference per midi channel?
				if (data[2]){
					noteOn(data[1],data[2]);
				}else{
					noteOff(data[1],data[2]);
				}
				break;
			case 176:
				console.log("Midi: set effect",data[1],data[2]);
				break;
			case 192:
				// select voice
				var index = data[1];
				Tracker.setCurrentInstrumentIndex(index+1);
				break;
			case 224:
				console.log("Modulator",data[1],data[2]);
				break;
			default:
				//console.log("Midi In:",data);
		}
		
		EventBus.trigger(EVENT.midiIn);
	}
	
	function noteOn(note,value){
		console.log("note on",note,value);
		
		// middle C is 60 - in Bassoon this is 13
		var key = note - 47; 
		var octave = Input.getCurrentOctave();
		var volume;
		if (SETTINGS.midi === "enabled"){
			volume = (value+1)>>1;
		}
		Input.handleNoteOn(key + (octave*12),undefined,undefined,volume);
	}

	function noteOff(note,value){
		console.log("note off",note,value);

		var key = note - 47;
		var octave = Input.getCurrentOctave();
		var register = SETTINGS.midi === "enabled";
		Input.handleNoteOff(key + (octave*12),register);
	}
	
	return me;
}();