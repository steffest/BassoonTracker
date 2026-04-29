import Tracker from "./src/tracker.js";
import Audio from "./src/audio.js";

let BassoonTracker = (()=>{
    let me = Tracker;
    let initDone;
    let audioContext;

    me.setContext=context=>{
        audioContext= context;
    }

    me.load=async url=>{
        if (!initDone){
            Tracker.init();
            Audio.init(audioContext);
            initDone = true;
        }
        let data = await fetch(url).then(res => res.arrayBuffer());
        Tracker.processFile(data).then(result=>{
            return result;
        })
    }

    me.play=()=>{
        Tracker.playSong();
    }

    me.audio = Audio;
    window.BassoonTracker = me;
    return me;
})();

export default BassoonTracker;

