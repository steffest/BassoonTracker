
import FetchService from "../fetchService.js";

var Hippo = function(){
    var me = {};

    var apiUrl = "http://localhost:3000/hippo/";
    apiUrl = "https://www.stef.be/bassoontracker/api/hippo/";
    //var apiUrlV1 = "https://www.stef.be/bassoontracker/api/";
    var playlists = [];

    me.get = function(url,next){
        var params = url.split("/");

        url = params[0];
        var param = params[1] || "";
        var page = params[2] || "";

        switch (url){
            case "playlists":
                loadPlaylists(next);
                break;
            case "playlist":
                loadFromApi(param,next);
                break;
            default:
                next([]);
        }
    };

    function loadPlaylists(next){
        if (playlists.length) {
            if (next) next(playlists);
        }else{
            loadFromApi("",function(result){
                playlists = [];
                result.forEach(function(item){
                    playlists.push({
                        title: item.replace(".prg","").replace(/_/g," "),
                        url: item,
                        icon:"playlist"
                    });
                });
                if (next) next(playlists);
            })
        }
    }


    function loadFromApi(url,next){
        console.log("load from api " + apiUrl + url);
        FetchService.json(apiUrl + url,function(data){
            next(data);
        })
    }


    return me;
}();

export default Hippo;