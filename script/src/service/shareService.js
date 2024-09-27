import Tracker from "../tracker.js";
import Host from "../host.js";
import UI from "../ui/ui.js";

let ShareService = (()=>{
    let me = {};
    let defaultText = "Check out this awesome music mod!";

    me.canShareNative = function(){
        return navigator.share
            && navigator.canShare
            && navigator.canShare(
                {
                    title: "BassoonTracker",
                    text: defaultText,
                    url: window.location.href
                });
    }


    me.share = function(target,type){
        let url = getUrl();
        switch (target){
            case "native":
                if (navigator.share){
                    navigator.share({
                        title: "BassoonTracker",
                        text: defaultText,
                        url: url
                    });
                }
                break;
            case "x":
                window.open("http://x.com/share?text=" + encodeURIComponent(defaultText) +"&url="+encodeURIComponent(url)+"&hashtags=TrackerMusic");
                break;
            case "facebook":
                window.open("https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url));
                break;
            case "copy":
                // Copy to clipboard
                navigator.clipboard.writeText(url).then(function() {
                  UI.setStatus("Share Link copied to clipboard");
                });

                break;
        }
    }

    function getUrl(){
        let url = Tracker.getCurrentUrl();
        let base = Host.getBaseUrl();
        if (!base){
            base = window.location.href.split("?")[0];
            base = base.substring(0,base.lastIndexOf("/")) + "/";
        }
        url = base + "?file=" + url;
        return url;
    }

    return me;
})();

export default ShareService;