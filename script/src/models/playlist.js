var Playlist = function(){
    var me = {};
    var currentPlaylist;
    var playListActive = false;
    var currentIndex;

    me.set = function(data){
        currentPlaylist = data;
        EventBus.trigger(EVENT.playListLoaded,currentPlaylist);
    }

    me.get = function(){
        return currentPlaylist;
    }

    me.play = function(index){
        me.loadTrack(index,true);
    }

    me.loadTrack = function(index,andPlay){
        let item = currentPlaylist.modules[index];
        if (item && item.url){
            if (andPlay){
                Tracker.autoPlay = true;
                playListActive = true;
            }
            Tracker.load(item.url,true);
            currentIndex = index;

            if ('URLSearchParams' in window) {
                const url = new URL(window.location);
                url.searchParams.set("index", currentIndex);
                history.pushState(null, '', url);
            }
        }
    }

    me.next = function(){
        currentIndex++;
        if (currentIndex>=currentPlaylist.modules.length){
            currentIndex = 0;
        }
        Tracker.stop();
        me.play(currentIndex);
    }

    me.getSongInfoUrl = function(url){
        if (url && currentPlaylist && currentPlaylist.modules){
            let item = currentPlaylist.modules.find(function(item){
                return item.url === url;
            });
            if (item && item.external) return item.external;
        }
    }

    EventBus.on(EVENT.songEnd,function(delay){
        delay = (delay || 0) * 1000;
        if (playListActive){
            setTimeout(function(){
                me.next();
            },delay);
        }
    });

    return me;
}();