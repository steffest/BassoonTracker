var ModArchive = (function(){

	const https = require('https');
	var parseXml = require('xml2js').parseString;

	var me = {};
	me.apiKey = "Enter you modArchive API key here";

	var baseUrl = "https://api.modarchive.org/xml-tools.php?key=" + me.apiKey + "&request=";

	me.browseByRating = function(res){
		getModArchiveResult("view_by_rating_comments&query=10",res);
	};

	function getModArchiveResult(url,res){
		url = baseUrl + url;
		// filter only 4channel mods
		url += "&format=mod&channels=4&size=100";
		https.get(url,function(modArchiveResponse){
			var xml = '';
			modArchiveResponse.on('data', function(chunk) {
				xml += chunk;
			});

			modArchiveResponse.on('end', function() {
				parseXml(xml,function(err,result){
					res.writeHead(200, {'Content-Type': 'application/json'});
					res.end(JSON.stringify(result));
				});
			});
		});
	}

	return me;

}());

module.exports = ModArchive;

