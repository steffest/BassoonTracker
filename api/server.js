var http = require('http');
var url = require('url');
var modArchive  = require('./modArchive');
var modArchiveCached  = require('./modArchiveCached');
var modulesPL  = require('./modulesPL');
var httpProxy = require('http-proxy');
var storage = require('./storage');

var port = process.env.PORT || 3000;

modulesPL.init();
modArchiveCached.init();

var proxy = httpProxy.createProxyServer();
proxy.on('error', function (err, req, res) {
	res.writeHead(500, {
		'Content-Type': 'text/plain'
	});
	res.end('Could not proxy ' + req.url);
});

var server = http.createServer(function (req, res) {
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

	var urlParts = pathName.split("/");
	var section = urlParts[0];
	var action = urlParts[1];


	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Headers", "X-Requested-With");

	var id;
	var page = 1;
	var query;

	switch (section){
		case "status":
			modArchive.getResult("view_requests",page,res);
			break;
		case "toprating":
			page  = urlParts[1] || 1;
			modArchive.getResult("view_by_rating_comments&query=10",page,res);
			break;
		case "topreview":
			page  = urlParts[1] || 1;
			modArchive.getResult("view_by_rating_reviews&query=10",page,res);
			break;
		case "random":
			modArchive.getResult("random",page,res);
			break;
        case "randomxm":
            modArchive.getResult("xm.random",page,res);
            break;
		case "genres":
			modArchive.getResult("view_genres",page,res);
			break;
		case "genre":
			id = urlParts[1];
			page  = urlParts[2] || 1;
			modArchive.getResult("search&type=genre&query=" + id,page,res);
			break;
		case "artist":
			id = urlParts[1];
			page  = urlParts[2] || 1;
			modArchive.getResult("view_modules_by_artistid&query=" + id,page,res);
			break;
		case "modules":
			query = urlParts[1] || "***";
			page  = urlParts[2] || 1;
			while (query.length<3){query += "*"}
			modArchive.getResult("search&type=songtitle&query=" + query,page,res);
			break;
		case "module":
			id = urlParts[1];
			modArchive.getResult("view_by_moduleid&query=" + id,page,res);
			break;
		case "modules.pl":
			id = urlParts[1];
			var getUrl = "http://www.modules.pl/dl.php?mid=" + id;
			var gethttp = require('http');
			gethttp.get(getUrl,function(response){
				if (response.statusCode == 302){
					req.url =  response.headers.location;
					console.log("redirect modules.pl")
				}

				proxy.web(req, res, {
					target: "http://www.modules.pl",
					changeOrigin: true
				});
			});

			//res.writeHead(200, {'Content-Type': 'text/html'});
			//res.end("ok");
			break;
		case "proxy":
			id = urlParts[1];
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end(pathName + " ... " + id);
			break;
		case "mpl":
			modulesPL.handleRequest(action,urlParts,res);
			break;
        case "ma":
            modArchiveCached.handleRequest(action,urlParts,res);
            break;
		case "storage":
			storage.handleRequest(action,urlParts,req,res);
			break;
		case "restart":
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end("exiting ...");
			setTimeout(function(){
				throw "quit";
			},2000);
			break;
		default:
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end(pathName + " ... Nope, don't know what to do with that.");
	}

}).listen(port);

console.log("Node version " + process.version);
if (process.env.IISNODE_VERSION) console.log("IISnode version " + process.env.IISNODE_VERSION);
console.log("running on port " + port);
