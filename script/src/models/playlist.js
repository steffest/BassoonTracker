import EventBus from "../eventBus.js";
import {COMMAND, EVENT, PLAYLISTTYPE} from "../enum.js";
import Tracker from "../tracker.js";
import {saveFile} from "../filesystem.js";
import Dropbox from "../provider/dropbox.js";

var Playlist = function(){
    var me = {};
    var currentPlaylist;
    var playListActive = false;
    var currentIndex = 0;
    var playOrder = [];

    me.set = function(data){
        currentPlaylist = data;
        setPlayOrder();

        /*let currentSong = Tracker.getSong();
        if (!currentSong && currentPlaylist.modules.length){
            console.log("No song loaded, starting playlist");
            //https://www.stef.be/bassoontracker/dev.html?file=playlist-demoscene2024&index=47
            me.next();
        }*/
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
                        console.log(line);
                        let i = line.indexOf("=");
                        url = line.substring(i+1).trim();
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
            case "m3u":
                lines.forEach(function(line){
                    if (line.startsWith("http")){
                        let title = line.split("/").pop();
                        title = decodeURIComponent(title);
                        result.modules.push({
                            title: title,
                            url: line.trim()
                        });
                    }
                });
                break;
        }
        return result;
    }

    me.export = function(filename,format,target){

        if (!currentPlaylist || !currentPlaylist.modules){
            UI.setStatus("Error: No playlist loaded");
            return;
        }
        let result = format === PLAYLISTTYPE.JSON
            ? JSON.stringify(currentPlaylist,null,2)
            : format === PLAYLISTTYPE.M3U
                ?generateM3U()
                :generatePLS();

        let blob = new Blob([result], {type: "text/plain;charset=utf-8"});
        filename = filename || me.getFileName();

        if (target === "dropbox"){
            Dropbox.putFile("/" + filename,blob);
        }else{
            saveFile(blob,filename);
        }

        return result;
    }

    me.toggleShuffle = function(){
        me.isShuffle = !me.isShuffle;
        setPlayOrder();
    }

    me.getFileName = function(){
        let filename = currentPlaylist.title + ".pls";
        filename = filename.replaceAll(" ","_").toLowerCase();
        return filename;
    }

    function generatePLS(){
        if (!currentPlaylist || !currentPlaylist.modules) return;

        let result = "[playlist]\n";
        let index = 1;
        currentPlaylist.modules.forEach(function(item){
            if (!item.url) return;
            let url = item.url;
            if (url.indexOf("://")<0){
                url = new URL(url,window.location.href).href;
            }
            result += "File" + index + "=" + url + "\n";
            result += "Title" + index + "=" + item.title + "\n";
            index++;
        });
        result += "NumberOfEntries=" + (index-1) + "\n";
        result += "Version=2";
        return result;
    }

    function generateM3U(){
        if (!currentPlaylist || !currentPlaylist.modules) return;

        let result = "#EXTM3U\n";
        currentPlaylist.modules.forEach(function(item){
            if (!item.url) return;
            let url = item.url;
            if (url.indexOf("://")<0){
                url = new URL(url,window.location.href).href;
            }
            result += "#EXTINF:-1," + item.title + "\n";
            result += url + "\n";
        });
        return result;
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
        if (url.indexOf('.modarchive.')>0) return true;
        if (url.indexOf('bassoontracker')>0) return true;
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
                Tracker.stop();
                Tracker.reset();
                setTimeout(me.next,100);
            },delay);
        }
    });

    EventBus.on(COMMAND.exportPlaylist,me.export);



    return me;
}();

export default Playlist;