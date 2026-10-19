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

	duplicate(){
		return {
			instrument: this.instrument,
			period : this.period,
			effect: this.effect,
			param: this.param,
			volumeEffect: this.volumeEffect,
			note: this.index
		}
	}

	populate(data){
		this.instrument = data.instrument || 0;
		this.period = data.period|| 0;
		this.effect = data.effect || 0;
		this.param = data.param || 0;
		this.volumeEffect =  data.volumeEffect || 0;
		this.index =  data.note || data.index || 0;
	}
}

// Keep both Note() and new Note() callers working without per-note closures.
function Note(){
	return new PatternNote();
}

export default Note;
