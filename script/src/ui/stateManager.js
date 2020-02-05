var StateManager = function(){
	var me = {};
	var editHistory = {};
	var maxHistory = 50;
	
	
	me.registerEdit = function(action){
		let id = action.target + "_" + action.id;
		let history = editHistory[id] || [];
		history.push(action);
		if (history.length>maxHistory) history.shift();
		editHistory[id] = history;

		console.error(editHistory);
	};
	
	
	me.undo = function(){
		var currentPattern = Tracker.getCurrentPattern();
		var id = EDITACTION.PATTERN + "_" + currentPattern;
		var actionList =  editHistory[id];
		if(actionList && actionList.length){
			var action = actionList.pop();
			var patternData = Tracker.getSong().patterns[currentPattern];
			
			console.warn(action);
			
			switch (action.type) {
				case EDITACTION.NOTE:
					action.data.forEach(function(item){
						console.error(item);
						if (patternData){
							var note = patternData[item.position.row][item.position.track] || new Note();
							note.populate(item.from);
						}
					});
					EventBus.trigger(EVENT.patternChange,currentPattern);
					break
			}
			
			//Tracker.setCurrentPatternPos(action.patternPosition);
			//Editor.setCurrentCursorPosition(action.cursorPosition);
			//Editor.putNote(action.from.instrument,action.from.period,action.from.noteIndex,true);
		}
	};
	
	me.redo = function(){
		
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
	
	return me;
}();