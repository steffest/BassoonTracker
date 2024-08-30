var Playlist = function(){
    var me = {};
    var currentPlaylist;
    var playListActive = false;
    var currentIndex;
    var playOrder = [];

    me.set = function(data){
        currentPlaylist = data;
        setPlayOrder();
        EventBus.trigger(EVENT.playListLoaded,currentPlaylist);
    }

    me.get = function(){
        return currentPlaylist;
    }

    me.play = function(index){
        me.loadTrack(index,true);
    }

    me.loadTrack = function(index,andPlay){
        if (!currentPlaylist || !currentPlaylist.modules) return;
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

            EventBus.trigger(EVENT.playListIndexChanged,currentIndex);
        }
    }

    me.next = function(){
        if (!currentPlaylist || !currentPlaylist.modules) return;
        moveIndex(1);
        let item = currentPlaylist.modules[currentIndex];
        if (!item.url) moveIndex(1);
        Tracker.stop();
        me.play(currentIndex);
    }

    me.prev = function(){
        if (!currentPlaylist || !currentPlaylist.modules) return;
        moveIndex(-1);
        let item = currentPlaylist.modules[currentIndex];
        if (!item.url) moveIndex(-1);
        Tracker.stop();
        me.play(currentIndex);
    }


    me.getSongInfoUrl = function(url){
        if (url && currentPlaylist && currentPlaylist.modules){
            let item = currentPlaylist.modules.find(function(item){
                return item.url === url;
            });
            if (item && item.link) return item.link;
        }
    }

    me.parse = function(data,name){
        let result = {
            title: name,
            modules:[]
        };
        let lines = data.split("\n");
        let ext = name.split(".").pop().toLowerCase();
        switch (ext){
            case "pls":
                lines.forEach(function(line){
                    var url;
                    var title;
                    if (line.startsWith("File")){
                        url = line.split("=")[1].trim();
                        var index = line.substring(4).split("=")[0].trim();
                        let titleLine = lines.find(function(line){
                            return line.startsWith("Title" + index);
                        })
                        if (titleLine){
                            title = titleLine.split("=")[1].trim();
                        }
                    }
                    if (line.startsWith("http")){
                        url = line.trim();
                    }
                    if (url && isFormatSupported(url)){
                        if (!title){
                            title = url.split("/").pop();
                        }
                        result.modules.push({
                            title: title,
                            url: url
                        });
                    }
                });
                break;
        }
        return result;
    }

    me.toggleShuffle = function(){
        me.isShuffle = !me.isShuffle;
        setPlayOrder();
    }

    function moveIndex(offset){
        if (me.isShuffle){
            let playIndex = playOrder.indexOf(currentIndex) || 0;
            playIndex += offset;
            if (playIndex>=playOrder.length) playIndex = 0;
            if (playIndex<0) playIndex = playOrder.length-1;
            currentIndex = playOrder[playIndex];
        }else{
            currentIndex += offset;
            if (currentIndex>=currentPlaylist.modules.length) currentIndex = 0;
            if (currentIndex<0) currentIndex = currentPlaylist.modules.length-1;
        }
    }

    function isFormatSupported(url){
        let ext = url.split(".").pop().toLowerCase();
        switch (ext){
            case "mod":
            case "xm":
            case ".pls":
                return true;
        }
        return false;
    }

    function setPlayOrder(){
        playOrder = [];
        if (!currentPlaylist || !currentPlaylist.modules) return;
        for (let i=0;i<currentPlaylist.modules.length;i++){
            playOrder.push(i);
        }
        if (me.isShuffle){
            playOrder = playOrder.sort(function() {
                return .5 - Math.random();
            });
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