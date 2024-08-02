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
        console.error("Play song " + index);
        let item = currentPlaylist.modules[index];
        if (item && item.url){
            EventBus.trigger(EVENT.playListPlaySong,index);
            Tracker.autoPlay = true;
            Tracker.load(item.url);
        }
        playListActive = true;
        currentIndex = index;
    }

    me.next = function(){
        currentIndex++;
        if (currentIndex>=currentPlaylist.modules.length){
            currentIndex = 0;
        }
        Tracker.stop();
        me.play(currentIndex);
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