var ModArchiveCached = (function(){

    var loki= require('lokijs');

    var me = {};
    var db;
    var modules;
    var artists = [];
    var genres = [];

    me.init = function(){
        db = new loki('./data/modarchive.json',{
            autoload: true,
            autoloadCallback : databaseInitialize
        });
    };

    me.handleRequest = function(action,params,res){
        switch (action){
            case "modules":
                returnJSON(res);
                res.end(JSON.stringify(modules.find()));
                break;
            case "genres":
                returnJSON(res);
                res.end(JSON.stringify(genres));
                break;
            case "genre":
                var genre = parseInt(params[2]);
                returnJSON(res);
                res.end(JSON.stringify(modules.find({genre:  genre })));
                break;
            case "artists":
                returnJSON(res);
                res.end(JSON.stringify(artists));
                break;
            case "artist":
                var artist = parseInt(params[2]);
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

        var genresList = db.getCollection("genres");
        if (genresList != null){
            var all =genresList.find();
            all.forEach(function(a){
                genres.push({id: a.id, name: a.name, parent: a.parent});
            });
        }

        /*var artistsList = db.getCollection("artists");
        if (artistsList != null){
            var all = artistsList.find();
            all.forEach(function(a){
                artists.push({id: a.id, handle: a.handle, count: a.modCount});
            });
        }*/

        // get genres totals
        var genreCount = {};
        var artistCount = {};
        var artistMap = {};
        all = modules.find();
        all.forEach(function(mod){
            if (mod.genre){
                var count = genreCount[mod.genre] || 0;
                genreCount[mod.genre] = count+1;
            }
            if (mod.author){
                count = artistCount[mod.author] || 0;

                // only add >4 artist
                if (count>4 && !artistMap[mod.author]){
                    artistMap[mod.author] = true;
                    artists.push({id: mod.author, handle: mod.artist});
                }
                artistCount[mod.author] = count+1;
            }
        });

        for (var i = genres.length-1;i>=0;i--){
            genres[i].count = genreCount[genres[i].id] || 0;
        }
        for (i = artists.length-1;i>=0;i--){
            artists[i].count = artistCount[artists[i].id] || 0;
        }

        genres.sort(function(a,b) {return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);} );
    }

    return me;


}());

module.exports = ModArchiveCached;

