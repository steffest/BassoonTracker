var ModArchiveCached = (function(){

    var fs = require('fs');
    var https = require('https');
    var config   = require('../../config');
    var xml2js = require('xml2js');
    var loki= require('lokijs');
    var he = require('he');

    var me = {};

    var baseUrl = "https://api.modarchive.org/xml-tools.php?key=" + config.modArchiveApiKey + "&request=";
    var DBFileName = "../data/modarchive.json";


    me.loadModules = function(format,next){

        format = format || "mod";

        if (format === "mod"){
            var page = 1;
            var maxPage = 1911; // 1911
        }else{
            format = "xm";
            page = 1;
            maxPage = 1146; // 1911
        }

        var baseDelay = 10000;
        var randomDelay = 10000;

        var loadNext = function(){
            console.log("loading page " + page);
            loadModPage(format,page,function(){
                page++;
                if (page<=maxPage) {
                    var delay = baseDelay + Math.floor(Math.random()*randomDelay);
                    setTimeout(function(){
                        loadNext();
                    },delay);
                }else{
                    if (next) next();
                }
            })
        };

        loadNext();
    };

    me.loadArtists = function(){
        var page = 1;
        var maxPage = 52; // 52

        var baseDelay = 5000;
        var randomDelay = 10000;

        var loadNext = function(){
            console.log("loading artist page " + page);
            loadArtistPage(page,function(){
                page++;
                if (page<=maxPage) {
                    var delay = baseDelay + Math.floor(Math.random()*randomDelay);
                    setTimeout(function(){
                        loadNext();
                    },delay);
                }
            })
        };

        loadNext();
    };

    me.rebuildDataBase = function(next){

        var db = new loki(DBFileName,{
            autosave: false
        });

        var modules = db.addCollection('modules',{
            unique: ['id'],
            indices: ['genre']
        });

        console.log("importing genres");
        var genres = db.addCollection('genres',{
            unique: ['id']
        });
        var xmlFileName =  "genres.xml";
        var fileData = fs.readFileSync("cache/" + xmlFileName, 'ascii');
        //fileData = fileData.replace(new RegExp('&', 'g'),'');
        var parser = new xml2js.Parser({explicitArray: false});

        parser.parseString(fileData, function (err, result) {
            var list = result.modarchive.parent;

            list.forEach(function(item,index){
                var id = parseInt(item.id,10);
                genres.insert({
                    id: id,
                    name: item.text,
                    parent: 0
                });

                if (item.children && item.children.child){
                    item.children.child.forEach(function(child,index){
                        genres.insert({
                            id: parseInt(child.id,10),
                            name: child.text,
                            parent: id
                        });
                    });
                }
            });
        });

        importXMLs("mod",1,360,function(){
            importXMLs("xm",303,392,function(){
                console.log("all done rebuilding database");

                db.saveDatabase(function(){
                    if (next) next();
                });
            });
        });

        function importXMLs(format,startPage,endPage,next){
            console.log("importing all " + format);

            var page = startPage;
            var maxPage = endPage;

            var loadNext = function(){
                processModXml(format,page,function(){
                    page++;
                    if (page<=maxPage) {
                        loadNext();
                    }else{
                        next();
                    }
                })
            };

            loadNext();
        }

        function processModXml(format,page,next){

            var xmlFileName =  format + "_" + page + ".xml";
            console.log("Processing " + xmlFileName);

            var fileData = fs.readFileSync("cache/" + xmlFileName, 'utf8');
            //fileData = fileData.replace(new RegExp('&', 'g'),'');
            var parser = new xml2js.Parser({explicitArray: false});

            parser.parseString(fileData, function (err, result) {
                if (result && result.modarchive){
                    var list = result.modarchive.module;

                    var count = 0;

                    list.forEach(function(item,index){

                        var genre = parseInt(item.genreid,10);
                        var artist = item.artist_info.artist || {};
                        var artistId = artist.id || 0;
                        var artistName = artist.alias || "";
                        artistId = parseInt(artistId,10);
                        var rating = parseFloat(item.overall_ratings.comment_rating);
                        var score = parseFloat(item.overall_ratings.review_rating);

                        if(genre || artistId || score || rating){
                            count++;
                            modules.insert({
                                id: item.id,
                                title: item.songtitle,
                                author: artistId,
                                artist: artistName,
                                genre: genre,
                                rate: rating,
                                score: score,
                                format: item.format.toLowerCase(),
                                size: parseInt(item.bytes,10)
                            });
                        }

                    });

                    console.log("accepted " + count + " mods");

                    next();
                }else{
                    console.log("Error: " + xmlFileName + " does not seem to ba a valid modArchive XML");
                    console.log(result);
                }



            });
        }



    };



    function loadModPage(format,page,next){

        var url = baseUrl + "search&type=songtitle&query=***";

        url += "&format=" + format;
        url += "&page=" + page;

        var xmlFileName =  format + "_" + page + ".xml";
        var file = fs.createWriteStream("cache/" + xmlFileName);

        https.get(url,function(response){
            response.pipe(file);
            file.on('finish', function() {
                console.log("Done, saved as " + xmlFileName);
                file.close(next);
            });
        }).on('error', function(err) {
            fs.unlink("cache/" + xmlFileName);
            console.log("Error: " + err.message);
        });

    }

    function loadArtistPage(page,next){

        var url = baseUrl + "search_artist&query=***";
        url += "&page=" + page;

        var xmlFileName =  "artist_" + page + ".xml";
        var file = fs.createWriteStream("cache/" + xmlFileName);

        https.get(url,function(response){
            response.pipe(file);
            file.on('finish', function() {
                console.log("Done, saved as " + xmlFileName);
                file.close(next);
            });
        }).on('error', function(err) {
            fs.unlink("cache/" + xmlFileName);
            console.log("Error: " + err.message);
        });
    }

    me.loadGenres = function(next){

        var url = baseUrl + "view_genres";

        var xmlFileName =  "genres.xml";
        var file = fs.createWriteStream("cache/" + xmlFileName);

        https.get(url,function(response){
            response.pipe(file);
            file.on('finish', function() {
                console.log("Done, saved as " + xmlFileName);
                file.close(next);
            });
        }).on('error', function(err) {
            fs.unlink("cache/" + xmlFileName);
            console.log("Error: " + err.message);
        });
    };

    return me;

}());

module.exports = ModArchiveCached;