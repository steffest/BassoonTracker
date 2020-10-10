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
	
	me.useUrlParams = true;
	me.useDropbox = true;
	me.showInternalMenu = true;
	me.useWebWorkers = true;
	me.useInitialLoad = true;
	
	me.init = function(){
	    if (typeof HostBridge === "object"){
			hostBridge = HostBridge;
			hostBridge.init();

			if (typeof hostBridge.useUrlParams === "boolean") me.useUrlParams = hostBridge.useUrlParams;
			if (typeof hostBridge.useDropbox === "boolean") me.useDropbox = hostBridge.useDropboxs;
			if (typeof hostBridge.showInternalMenu === "boolean") me.showInternalMenu = hostBridge.showInternalMenu;
			if (typeof hostBridge.useWebWorkers === "boolean") me.useWebWorkers = hostBridge.useWebWorkers;
	    }
	};
	
	me.getBaseUrl = function(){
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
	
	me.getRemoteUrl = function(){
		if (hostBridge && hostBridge.getRemoteUrl){
			return hostBridge.getRemoteUrl();
		}
		return "";
	};
	
	me.getVersionNumber = function(){
		if (typeof versionNumber !== "undefined") return versionNumber;
		if (hostBridge && hostBridge.getVersionNumber) 	return hostBridge.getVersionNumber();
		return "dev";
	};
	
	me.getBuildNumber = function(){
		if (typeof buildNumber !== "undefined") return buildNumber;
		if (hostBridge && hostBridge.getBuildNumber) return hostBridge.getBuildNumber();
		return new Date().getTime();
	};

	me.signalReady = function(){
		if (hostBridge && hostBridge.signalReady) hostBridge.signalReady();
	};
	
	me.putFile = function(filename,file){
		
	};
	
	return me;
}();