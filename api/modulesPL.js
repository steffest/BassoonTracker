var ModulesPL = (function(){

    var loki= require('lokijs');

    var me = {};
    var db;
    var modules;
    var artists = [];
    var genres = [];

    me.init = function(){
        db = new loki('./data/modules.pl.json',{
            autoload: true,
            autoloadCallback : databaseInitialize
        });
    };

    me.handleRequest = function(action,params,res){
        switch (action){
            case "genres":
                returnJSON(res);
                res.end(JSON.stringify(genres));
                break;
            case "genre":
                var genre = params[2];
                returnJSON(res);
                res.end(JSON.stringify(modules.find({genre:  genre })));
                break;
            case "artists":
                returnJSON(res);
                res.end(JSON.stringify(artists));
                break;
            case "artist":
                var artist = params[2];
                returnJSON(res);
                res.end(JSON.stringify(modules.find({author:  artist })));
                break;
            case "toprating":
                returnJSON(res);
                res.end(JSON.stringify(modules.chain().find({rate:  {'$gt':4} }).simplesort('rate',true).limit(100).data()));
                break;
            case "topscore":
                returnJSON(res);
                res.end(JSON.stringify(modules.chain().find({score:  {'$gt':4} }).simplesort('score',true).limit(100).data()));
                break;
            default:
                returnHTML(res);
                res.end("Modules.pl " + action + " ... Nope, don't know what to do with that.");
        }
    };

    function returnJSON(res){
        res.writeHead(200, {'Content-Type': 'application/json'});
    }
    function returnHTML(res){
        res.writeHead(200, {'Content-Type': 'application/json'});
    }

    function databaseInitialize() {
        modules = db.getCollection("modules");
        if (modules === null) modules = db.addCollection("modules");

        var artistsList = db.getCollection("artists");
        if (artistsList != null){
            var all = artistsList.find();
            all.forEach(function(a){
                artists.push({id: a.id, handle: a.handle, count: a.modCount});
            });
        }

        // get genres
        var genreCount = {};
        all = modules.find();
        all.forEach(function(mod){
            var count = genreCount[mod.genre] || 0;
            //console.log(mod.genre +  " - " + count);
            if (count == 0) genres.push(mod.genre);
            genreCount[mod.genre] = count+1;
        });
        genres.sort();
        for (var i = genres.length-1;i>=0;i--){
            genres[i] += " (" + (genreCount[genres[i]] || 0) + ")";
        }

    }

    return me;

}());

module.exports = ModulesPL;

