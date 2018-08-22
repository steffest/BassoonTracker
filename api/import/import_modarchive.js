var ModArchive = require("./provider/modarchive");

// Note: this takes a LOOOOOONG time
// The Modarchive API only returns 40 items for each requests
// -> there are a few thousand requests to be made ...
// as we don't want to hammer their API a generous delay is inserted before each request
// So grab a coffee or go for a walk and return in a few hours

ModArchive.loadModules("mod",function(){
    ModArchive.loadModules("xm",function(){
        ModArchive.rebuildDataBase();
    });
});

