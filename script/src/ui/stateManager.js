var StateManager = function(){
	var me = {};
	var editHistory = {};
	var maxHistory = 50;
	
	
	me.registerEdit = function(action){
		let id = action.target + "_" + action.id;
		let history = editHistory[id] || {undo:[],redo:[]};
		history.undo.push(action);
		if (history.undo.length>maxHistory) history.undo.shift();
		history.redo = [];
		editHistory[id] = history;

		console.error(editHistory);
	};
	
	
	me.undo = function(){
		var currentPattern = Tracker.getCurrentPattern();
		var id = EDITACTION.PATTERN + "_" + currentPattern;
		var actionList =  editHistory[id];
		if(actionList && actionList.undo && actionList.undo.length){
			var action = actionList.undo.pop();
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
			actionList.redo.push(action);
		}
	};
	
	me.redo = function(){
		var currentPattern = Tracker.getCurrentPattern();
		var id = EDITACTION.PATTERN + "_" + currentPattern;
		var actionList =  editHistory[id];
		if(actionList && actionList.redo && actionList.redo.length){
			var action = actionList.redo.pop();
			var patternData = Tracker.getSong().patterns[currentPattern];

			console.warn(action);

			switch (action.type) {
				case EDITACTION.NOTE:
					action.data.forEach(function(item){
						if (patternData){
							var note = patternData[item.position.row][item.position.track] || new Note();
							note.populate(item.to);
						}
					});
					EventBus.trigger(EVENT.patternChange,currentPattern);
					break
			}
			actionList.undo.push(action);
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
	
	return me;
}();