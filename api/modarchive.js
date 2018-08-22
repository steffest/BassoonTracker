var ModArchive = (function(){

	const https = require('https');
	var config   = require('./config');
	var parseXml = require('xml2js').parseString;
	var he = require('he');

	var me = {};

	var baseUrl = "https://api.modarchive.org/xml-tools.php?key=" + config.modArchiveApiKey + "&request=";


	me.getResult = function(url,page,res){
		getModArchiveResult(url,page,res);
	};

	function getModArchiveResult(url,page,res){

        var format = "mod";
        if (url.indexOf("xm.") === 0){
        	url = url.substr(3);
        	format = "xm";
		}

		page = page || 1;
		url = baseUrl + url;

		url += "&format=" + format;
		url += "&page=" + page;
		https.get(url,function(modArchiveResponse){
			var xml = '';
			modArchiveResponse.on('data', function(chunk) {
				xml += chunk;
			});

			modArchiveResponse.on('end', function() {
				parseXml(xml,{explicitArray: false},function(err,result){
					if (result.modarchive){
						if (result.modarchive.sponsor) delete result.modarchive.sponsor;
						if (result.modarchive.module && result.modarchive.module.length){
							result.modarchive.module.forEach(function(mod){
								if (mod.songtitle){
									mod.songtitle = he.decode(mod.songtitle);
								}
							})
						}
					}
					res.writeHead(200, {'Content-Type': 'application/json'});
					res.end(JSON.stringify(result));
				});
			});
		});
	}

	return me;

}());

module.exports = ModArchive;

