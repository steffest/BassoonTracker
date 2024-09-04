import EventBus from "../eventBus.js";
import {EVENT} from "../enum.js";
import Tracker from "../tracker.js";

let Favorites = (()=>{
    let me = {};

    me.load = function(){
        let favorites = localStorage.getItem("favorites");
        if (favorites){
            return JSON.parse(favorites);
        }else{
            return [];
        }
    };

    me.getPlaylist = function(){
        let list = {
            title: "Favorites",
            icon : "icons/fav.png",
            modules: me.load()
        }
        if (list.modules.length===0){
            list.modules.push({title:"No favorites yet..."});
            list.modules.push({title:"Press the heart icon"});
            list.modules.push({title:"to add one!"});
        }
        return list;
    }

    me.isFavorite = function(url){
        return me.load().findIndex((item)=>item.url===url)!==-1;
    };

    EventBus.on(EVENT.toggleFavorite,function(){
        let favorites = me.load();
        let url = Tracker.getCurrentUrl();
        if (url){
            if (me.isFavorite(url)){
                favorites = favorites.filter((item)=>item.url!==url);
            }else{
                let song = Tracker.getSong();
                let title = song.title || url.split("/").pop();
                favorites.push({url:url,title:title});
            }

            localStorage.setItem("favorites",JSON.stringify(favorites));
            EventBus.trigger(EVENT.favoritesUpdated,favorites);
        }
    });

    return me;
})();

export default Favorites;