var Storage = (function(){

	var me = {};
	var fs = require('fs');
	var exec = require('child_process').exec;

	me.handleRequest = function(action,urlParts,req,res){

		switch(action){
			case "put":
				me.putFile("test2.mod",req,res,function(success){
					if (success){
						res.end("ok");	
					}else{
						res.end("error");
					}
				});
				break;
			case "render":
				var ext = urlParts[2] === "mod" ? "mod" : "xm";
				var filename = new Date().getTime() + "_" + Math.round((Math.random()*10000)) + "." + ext;
				me.putFile(filename,req,res,function(success){
					if (success){
						res.end(filename);
					}else{
						res.end("error");
					}
				});
				break;
			case "convert":
				var filename = urlParts[2];
				me.convertFile(filename,req,res,function(success){
					if (success){
						res.end(filename + ".wav");
					}else{
						res.end("error");
					}
				});
				break;
			case "wavtomp3":
				var filename = urlParts[2];
				me.convertToMp3(filename,req,res,function(success){
					if (success){
						res.end(filename.split(".wav")[0]+".mp3");
					}else{
						res.end("error");
					}
				});
				break;
			default:
				res.end("unknown action");
		}
	};

	me.putFile = function(filename,req, res, next){
		var data = [];
		filename = 'storage/' + filename;
		req.on('data', function(chunk) {
			data = data.concat(chunk);
		});
		req.on('end', function (){

			var buf = new Buffer.concat(data);

			fs.writeFile("./" + filename, buf,  "binary", function(err) {
				if(err) {
					if (next){next(false)}else{res.end("error");}
				} else {
					if (next){next(true)}else{res.end("ok");}
				}
			});
		});
	};
	
	me.convertFile = function(filename,req, res, next){
		var p = require('path').resolve(__dirname);
		var command = p + "/render/openmpt123.exe --render " + p + "/storage/" + filename;
		console.log("exec " + command);
		exec(command,
		   function (error, stdout, stderr) {
			  console.log('error: ' + error);
			  console.log(typeof error);
			  console.log('stdout: ' + stdout);
			  console.log('stderr: ' + stderr);
			  if (error == null) {
				    console.log('succes');
			  		if (next){next(true)}else{res.end("ok");}
			  }else{
				  console.log('failed');
				  if (next){next(false)}else{res.end("error");}
			  }
		   });
	};

	me.convertToMp3 = function(filename,req, res, next){
		var p = require('path').resolve(__dirname);
		var command = p + "/render/lame.exe " + p + "/storage/" + filename;
		console.log("exec " + command);
		exec(command,
			function (error, stdout, stderr) {
				console.log('error: ' + error);
				console.log('stdout: ' + stdout);
				console.log('stderr: ' + stderr);
				if (error == null) {
					if (next){next(true)}else{res.end("ok");}
				}else{
					if (next){next(false)}else{res.end("error");}
				}
			});
	};

	me.getFile = function(req, res){

	};

	return me;

}());

module.exports = Storage;

