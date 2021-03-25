var Logger = function(){
    var me = {};

    var baseUrl = "https://www.stef.be/bassoontracker/api/log/";

    me.info = function(message){log("info",message)};
    me.warn = function(message){
        console.warn(message);
        log("warn",message)
    };
    me.error = function(message){
        console.error(message);
        log("error",message)
    };

    var log =  function(scope,message){
        var stats = UI.stats();
        var version = typeof versionNumber == "undefined" ? "dev" : versionNumber;
        message = createSlug(message);
        FetchService.get(baseUrl + scope + "/" + message + "/" + stats.averageFps + "/" + stats.skipRenderSteps + "/" + version + "/" + canvas.width + "x" + canvas.height + "/" + stats.averageRenderFps + "/" + devicePixelRatio,function(result){
            //console.log(result);
        });
    };

    return me;
}();