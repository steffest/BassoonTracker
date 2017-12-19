var ModulesPL = (function(){

    var fs = require('fs');
    var http = require('http');
    var xml2js = require('xml2js');
    var loki= require('lokijs');

    var me = {};
	var idLookup = {};

    me.refresh = function(){
        console.log("Refreshing modules.pl database");
        loadModulesFromApi(function(){
            importModules(function(){
                console.log("done");
            });
        });
    };
    me.rebuild = function(){
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
                    author: item.authorId,
                    //author: idLookup[item["$"].id] || 0,
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

        var db = new loki(DBFileName,{
            autoload: true,
            autoloadCallback : databaseInitialize,
            autosave: false
        });

        function databaseInitialize() {

            var modules = db.getCollection("modules");
            if (modules === null) modules = db.addCollection("modules");

            var artists = db.getCollection("artists");
            if (artists === null) {
                console.log("creating artists collection");
                artists = db.addCollection("artists");
            }else{
                console.log("clearing artists collection");
                artists.clear();
            }

            var loadNext = function(){

                me.loadArtistList(index,function(list){

                    list.forEach(function(item){
                        var artistId = item["$"].id;

                        var count = modules.find({author:  artistId }).length;

                        // ignore authors with less then 5 mods
                        if (count>4){
                            console.log(item.handle + " " + count);

                            artists.insert({
                                id: item["$"].id,
                                handle: item.handle,
                                nation: item.nation,
                                rate: item.rate,
                                modCount: count
                            });
                        }
                    });

                    index++;
                    if (index<27){
                        setTimeout(function(){
                            loadNext();
                        },1000);
                    }else{
                        console.log("all done loading artists");

                        db.saveDatabase(function(){
                            if (next) next();
                        });
                    }
                });
            };

            loadNext();
        }

	};

    me.loadArtistList = function(index,next){

        var code = String.fromCharCode(97 + index);
        if (index == 26) code = "rest";
		//var url = "http://www.modules.pl/xml.php?mode=author&id=" + id;
        var url = "http://www.modules.pl/xml.php?mode=authors&letter=" + code;

		console.log("connecting to API - artist list " + code);

		var request = http.get(url, function(response) {
            var body = "";
            response.on('data', function (chunk) {
                body += chunk;
            });
            response.on('end', function() {
                var parser = new xml2js.Parser({explicitArray: false});
                parser.parseString(body, function (err, result) {
                    if (result && result.xml &&  result.xml.artists){
                        var list = result.xml.artists.artist ;
                        next (list);
                    }else{
                        console.log("no data");
                        next([]);
                    }
                });
            });
		}).on('error', function(err) {
			console.log("Error: " + err.message);
            next([]);
		});
    };

    return me;

}());

module.exports = ModulesPL;