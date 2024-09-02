var ModArchive = require("./provider/modarchive");

// Load metadata of all modules from the Modarchive
// and store them in a local json file
// BassoonTracker will use this cache to speed up searches

// Note: this takes a LOOOOOONG time
// The Modarchive API only returns 40 items for each request
// -> there are a few thousand requests to be made ...
// as we don't want to hammer their API, a generous delay is inserted before each request
// So grab a coffee or go for a walk and return in a few hours

//ModArchive.loadGenres(function(){
    //ModArchive.loadArtists(function(){
        //ModArchive.loadModules("mod",function(){
            //ModArchive.loadModules("xm",function(){
                ModArchive.rebuildDataBase();
            //});
        //});
    //});
//});
/*ModArchive.loadModules("mod",function(){
    ModArchive.loadModules("xm",function(){
        ModArchive.rebuildDataBase();
    });
});
 */

