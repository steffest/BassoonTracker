/*
 Bridges Host functions BassoonTracker is running in.
 Currently supports
 	Web
 	WebPlugin
 	FriendUp
*/

var Host = function(){
	var me = {};
	var hostBridge;
	
	var isFriendUp = ((typeof Application === "object") && Application.initFriendVR);
	
	if (isFriendUp) console.log("running on FriendUP");
		
	// FriendUP maps local urls to filesystem reads, urls paramater won't work
	me.useUrlParams = !isFriendUp;
	me.showInternalMenu = !isFriendUp;
	
	me.getBaseUrl = function(){
		if (isFriendUp){
			return Application.progDir;
		}
		
		// Settings.baseUrl ... hmm ... can't remember where that is coming from
		if (typeof Settings === "undefined"){
			return "";
		}else{
			return Settings.baseUrl || "";
		}
	};
	
	me.setMessageHandler = function(handler){
		hostBridge = handler;
	};
	
	me.putFile = function(filename,file){
		if (isFriendUp){
			//me.sendMessage({command:'putFile',file:file});
		}
	};
	
	me.sendMessage = function(msg){
		if (hostBridge){
			if (typeof msg === "string") msg = {command: msg};
			msg = msg || {};
			msg.type = "callback";
			hostBridge(msg);
		}else{
			console.warn("can't send message, hostBridge not setup");
		}
	};
	
	
	return me;
}();