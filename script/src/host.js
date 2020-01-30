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
	
	// FriendUP maps local urls to filesystem reads, urls paramater won't work
	me.useUrlParams = true;
	me.useDropbox = true;
	me.showInternalMenu = true;
	
	me.init = function(){
	    if (typeof HostBridge === "object"){
			hostBridge = HostBridge;
			hostBridge.init();

			if (typeof hostBridge.useUrlParams === "boolean") me.useUrlParams = hostBridge.useUrlParams;
			if (typeof hostBridge.useDropbox === "boolean") me.useDropbox = hostBridge.useDropboxs;
			if (typeof hostBridge.showInternalMenu === "boolean") me.showInternalMenu = hostBridge.showInternalMenu;
	    }
	};
	
	me.getBaseUrl = function(){
		console.warn(hostBridge);
		console.warn(hostBridge.getBaseUrl);
		if (hostBridge && hostBridge.getBaseUrl){
			return hostBridge.getBaseUrl();
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