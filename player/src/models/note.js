import {FTNotes, FTPeriods} from "../tracker.js";

class PatternNote {
	constructor(){
		this.period = 0;
		this.index = 0;
		this.effect = 0;
		this.instrument = 0;
		this.param = 0;
		this.volumeEffect = 0;
	}

	setPeriod(period){
		this.period = period;
		this.index = FTPeriods[period] || 0;
	}

	setIndex(index){
		this.index = index;
		var ftNote = FTNotes[index];
		if (ftNote){
			this.period = ftNote.modPeriod || ftNote.period;
			if (this.period === 1) this.period = 0;
		}else{
			console.warn("No note for index " + index);
			this.period = 0;
		}
	}

	clear(){
		this.instrument = 0;
		this.period = 0;
		this.effect = 0;
		this.param = 0;
		this.index = 0;
		this.volumeEffect = 0;
	}
}

// Keep both Note() and new Note() callers working without per-note closures.
function Note(){
	return new PatternNote();
}

export default Note;
