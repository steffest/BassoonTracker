var ModulesPL = (function(){

    var fs = require('fs');
    var http = require('http');
    var xml2js = require('xml2js');
    var loki= require('lokijs');

	var artists = [1,4,10,70,71,1362];

    var me = {};
	var idLookup = {};

    me.rebuildArtists = function(){
		idLookup = {};

		artists.forEach(function(artist){
			var aFileName = "../authors/"+artist+".js";
			//if (fs.existsSync(aFileName)){
				var author = require(aFileName);
				author.forEach(function(id){idLookup[id] = artist;});
			//}
		});
	};

    me.refresh = function(){
        console.log("Refreshing modules.pl database");
        loadModulesFromApi(function(){
            importModules(function(){
                console.log("done");
            });
        });
    };
    me.rebuild = function(){
		console.log("Rebuilding artist lookup");
		me.rebuildArtists();
		console.log("Rebuilding db");
		importModules(function(){
			console.log("done");
		});
    };

    var xmlFileName = "modules.pl.xml";
    var DBFileName = "../data/modules.pl.json";

    var loadModulesFromApi = function(next){
        var url = "http://www.modules.pl/xml.php?mode=modules&format=1";
        // for formats see http://www.modules.pl/xml.php?mode=formats

        console.log("connecting to API");
        var file = fs.createWriteStream(xmlFileName);
        var request = http.get(url, function(response) {
            response.pipe(file);
            file.on('finish', function() {
                console.log("Done, saved as " + xmlFileName);
                file.close(next);
            });
        }).on('error', function(err) {
            fs.unlink(xmlFileName);
            console.log("Error: " + err.message);
        });
    };

    var importModules = function(next){
        var db = new loki(DBFileName,{
            autosave: false
        });

        var modules = db.addCollection('modules',{
            unique: ['id'],
            indices: ['genre']
        });

        var fileData = fs.readFileSync(xmlFileName, 'ascii');
        fileData = fileData.replace(new RegExp('&', 'g'),'');

        var parser = new xml2js.Parser({explicitArray: false});
        parser.parseString(fileData, function (err, result) {
            var list = result.xml.modules.module ;

            console.log(list.length + " modules imported");
            //console.log(list[0]);

            list.forEach(function(item){
                modules.insert({
                    id: item["$"].id,
                    title: item.title,
                    //author: item.authorId, -> AuthorId is always empty
                    author: idLookup[item["$"].id] || 0,
                    genre: item.genre,
                    rate: item.rate,
                    score: item.bayesianScore
                });
            });

            db.saveDatabase(function(){
                if (next) next();
            });
        });

    };

	me.loadArtists = function(next){
		var index = 0;

		var loadNext = function(){
			var artist = artists[index];
			me.loadArtist(artist,function(){
				index++;
				if (index<artists.length){
					setTimeout(function(){
						loadNext();
					},1000);
				}else{
					console.log("all done loading artists");
					if (next) next();
				}
			});
		};

		loadNext();
	};

    me.loadArtist = function(id,next){
		var url = "http://www.modules.pl/xml.php?mode=author&id=" + id;
		var filename = "authors/" + id + ".xml";
		var output = "authors/" + id + ".js";

		console.log("connecting to API - artist " + id);

		var file = fs.createWriteStream(filename);
		var request = http.get(url, function(response) {
			response.pipe(file);
			file.on('finish', function() {
				console.log("Done, saved as " + filename);
				file.close(function(){
					var fileData = fs.readFileSync(filename, 'ascii');
					fileData = fileData.replace(new RegExp('&', 'g'),'');
					var parser = new xml2js.Parser({explicitArray: false});
					parser.parseString(fileData, function (err, result) {
						var list = result.xml.modules.module ;
						var ids = [];

						console.log(list.length + " modules loaded");
						//console.log(list[0]);

						list.forEach(function(item){
							ids.push(item["$"].id);
						});

						fs.writeFileSync(output,"module.exports = " + JSON.stringify(ids));
						console.log("done " + output);
						if (next) next();

					});
                });
			});
		}).on('error', function(err) {
			fs.unlink(filename);
			console.log("Error: " + err.message);
		});
    };

	me.rebuildArtists();
    return me;

}());

module.exports = ModulesPL;