var ModulesPL = (function(){

    var fs = require('fs');
    var http = require('http');
    var xml2js = require('xml2js');
    var loki= require('lokijs');

    var me = {};

    me.refresh = function(){
        console.log("Refreshing modules.pl database");
        loadModulesFromApi(function(){
            importModules(function(){
                console.log("done");
            });
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

    return me;

}());

module.exports = ModulesPL;