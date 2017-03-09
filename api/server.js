var http = require('http');
var url = require('url');
var modArchive    = require('./modArchive');

var port = process.env.PORT || 3000;

http.createServer(function (req, res) {
	var reqUrl = req.url;

	// handle IIS 403 and 404 errors when running on IISNODE
	var p = reqUrl.indexOf("?403;");
	if (p>=0) reqUrl = reqUrl.substr(p+5);
	p = reqUrl.indexOf("?404;");
	if (p>=0) reqUrl = reqUrl.substr(p+5);

	var pathName = url.parse(reqUrl).path;
	pathName = pathName.substring(1, pathName.length);
	if (pathName.slice(-1) == "/") 	pathName = pathName.substr(0, pathName.length-1);
	if (pathName.indexOf('bassoontracker/api/') == 0) pathName = pathName.substr(19);


	// running on localhost?
	var hostName = req.headers.host;
	var baseDomain = "http://" + hostName;
	var isLocal = (hostName.substr(0,5) == "local");

	pathName = pathName.split("?")[0];
	var handled = false;


	if (pathName == "modarchive"){
		modArchive.browseByRating(res);
		handled = true;
	}

	if (!handled){
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(pathName + " ... Nope, don't know what to do with that.");
	}

}).listen(port);

console.log("Node version " + process.version);
if (process.env.IISNODE_VERSION) console.log("IISnode version " + process.env.IISNODE_VERSION);
console.log("running on port " + port);
