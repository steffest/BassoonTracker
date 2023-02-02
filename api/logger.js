var Logger = (function(){

	const fs = require('fs');
	const RequestIp = require('@supercharge/request-ip')
	
	var me = {};
	var currentLogFile;
	var stream;
	
	var logDirectory = "./logs/";
	
	me.log = function(action,data,req,res){
		getLogFile();
		stream.write(formatData(action,data,req));
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(action + ": OK");
	}
	
	function formatData(action,data,req){
		let line = new Date().toISOString() + " " + action.toUpperCase();
		
		line += " | " + data[2];
		line += " | averageFps: " + data[3];
		line += " | averageRenderFps: " + data[7];
		line += " | skipRenderSteps: " + data[4];
		line += " | version: " + data[5];
		line += " | size: " + data[6];
		line += " | devicePixelRatio: " + data[8];
		line += " | IP: " + RequestIp.getClientIp(req);
		line += " | userAgent: " + req.headers["user-agent"];
		
		line += "\n";
		
		return line;
	}
	
	function getLogFile(){
		var f = new Date().toISOString().split('T')[0] + ".txt";
		if (f!==currentLogFile){
			if (stream){
				try {stream.end();}catch (e){}
			}
			stream = fs.createWriteStream(logDirectory + f, {flags:'a'});
		}
	}
	
	return me;

}());

module.exports =  Logger;

