var StateManager = function(){
	var me = {};
	var maxHistory = 100;
	var history = {undo:[],redo:[]};
	var locked;
	
	me.registerEdit = function(action){
		var doRegister = true;
		
		if (locked){
			// we're already in a UNDO/REDO action, or in a init state action
			return;
		}
		
		if (history.undo.length){
			switch (action.type) {
				case EDITACTION.VALUE:
					var lastAction = history.undo[history.undo.length-1];
					if (lastAction && lastAction.type === action.type && lastAction.id===action.id){
						doRegister = false;
						lastAction.to = action.to;
						console.log("Ignoring sequential Undo, to: " + action.to);
					}else{
						console.log("Add Value Undo");
					}
					break;
			}
		}
		
		if (doRegister){
			history.undo.push(action);
			if (history.undo.length>maxHistory) history.undo.shift();
			history.redo = [];
		}
		
	};
	
	me.undo = function(){
		if(history.undo.length){
			var action = history.undo.pop();
			locked = true;

			if (action.instrument && action.instrument !== Tracker.getCurrentInstrumentIndex()) Tracker.setCurrentInstrumentIndex(action.instrument);
			
			switch (action.type) {
				case EDITACTION.NOTE:
				case EDITACTION.RANGE:
				case EDITACTION.TRACK:
				case EDITACTION.PATTERN:
					var patternData = Tracker.getSong().patterns[action.id];
					if (action.id !== Tracker.getCurrentPattern()){
						Tracker.setCurrentPattern(action.id);
					}
					action.data.forEach(function(item){
						//console.error(item);
						if (patternData){
							var note = patternData[item.position.row][item.position.track] || new Note();
							note.populate(item.from);
						}
					});
					EventBus.trigger(EVENT.patternChange,action.id);
					break;
				case EDITACTION.VALUE:
					action.target.setValue(action.from);
					break;
				case EDITACTION.DATA:
					if (action.target === EDITACTION.SAMPLE){
						action.undo = true;
						action.redo = false;
						EventBus.trigger(EVENT.showView,"sample");
						EventBus.trigger(EVENT.commandProcessSample,action);
					}
					break;
				default:
					console.warn("Unknown UNDO action")
					console.warn(action);
			}
			
			
			history.redo.push(action);
			locked = false;

			if (action.name){
				UI.setStatus("Undo " + action.name);
			}
		}
	};
	
	me.redo = function(){
		if(history.redo.length){
			var action = history.redo.pop();
			locked = true;

			if (action.instrument && action.instrument !== Tracker.getCurrentInstrumentIndex()) Tracker.setCurrentInstrumentIndex(action.instrument);

			switch (action.type) {
				case EDITACTION.NOTE:
				case EDITACTION.RANGE:
				case EDITACTION.TRACK:
				case EDITACTION.PATTERN:
					var patternData = Tracker.getSong().patterns[action.id];
					if (action.id !== Tracker.getCurrentPattern()){
						Tracker.setCurrentPattern(action.id);
					}
					action.data.forEach(function(item){
						if (patternData){
							var note = patternData[item.position.row][item.position.track] || new Note();
							item.to ? note.populate(item.to) : note.clear();
						}
					});
					EventBus.trigger(EVENT.patternChange,action.id);
					break;
				case EDITACTION.VALUE:
					action.target.setValue(action.to);
					break;
				case EDITACTION.DATA:
					if (action.target === EDITACTION.SAMPLE){
						action.undo = false;
						action.redo = true;
						EventBus.trigger(EVENT.showView,"sample");
						EventBus.trigger(EVENT.commandProcessSample,action);
					}
					break;
				default:
					console.warn("Unknown UNDO action")
					console.warn(action);
			}

			history.undo.push(action);
			locked = false;

			if (action.name){
				UI.setStatus("Redo " + action.name);
			}
		}
	};
	
	
	me.createNoteUndo = function(pattern,track,row,note){
		return {
			target: EDITACTION.PATTERN,
			type: EDITACTION.NOTE,
			id: pattern,
			data:[{
				position: {
					track: track,
					row: row
				},
				from: note.duplicate()
			}]
		};
	};

	me.createTrackUndo = function(pattern){
		return {
			target: EDITACTION.PATTERN,
			type: EDITACTION.TRACK,
			id: pattern,
			data:[]
		};
	};

	me.createPatternUndo = function(pattern){
		return {
			target: EDITACTION.PATTERN,
			type: EDITACTION.PATTERN,
			id: pattern,
			data:[]
		};
	};

	me.createRangeUndo = function(pattern){
		return {
			target: EDITACTION.PATTERN,
			type: EDITACTION.RANGE,
			id: pattern,
			data:[]
		};
	};

	me.createValueUndo = function(control){
		return {
			target: control,
			type: EDITACTION.VALUE,
			id: control.name,
			from: control.getPrevValue(),
			to: control.getValue()
		};
	};

	me.createSampleUndo = function(action,rangeStart,rangeLength){
		return {
			target: EDITACTION.SAMPLE,
			type: EDITACTION.DATA,
			id: "sample" + Tracker.getCurrentInstrumentIndex(),
			instrument: Tracker.getCurrentInstrumentIndex(),
			from: rangeStart || 0,
			to: rangeLength || 0,
			action: action
		};
	};
	
	me.addNote = function(actionList,track,row,note){
		var noteInfo = {
			position:{
				track:track,
				row: row
			},
			from:note?note.duplicate():{}
		};
		actionList.data.push(noteInfo);
		return noteInfo;
	};
	
	me.getHistory = function(){
		return history;
	}
	
	me.clear = function(){
		history = {undo:[],redo:[]};
	}

	me.lock = function(){
		locked=true;
	}
	me.unLock = function(){
		locked=false;
	}

	me.canUndo = function(){
		return history.undo.length>0;
	}

	me.canRedo = function(){
		return history.redo.length>0;
	}

	me.getUndoLabel = function(){
		var name = "";
		if (history.undo.length){
			name= history.undo[history.undo.length-1].name || "";
		}
		return "Undo " + name;
	}

	me.getRedoLabel = function(){
		var name = "";
		if (history.redo.length){
			name= history.redo[history.redo.length-1].name || "";
		}
		return "Redo " + name;
	}

	EventBus.on(EVENT.commandUndo,me.undo);
	EventBus.on(EVENT.commandRedo,me.redo);

	return me;
}();