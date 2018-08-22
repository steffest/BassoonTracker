var ModulesPL = require("./provider/modules.pl.js");

ModulesPL.refresh(function(){
	ModulesPL.rebuild(function () {
		ModulesPL.loadArtists(function(){
			console.log("All Done")
		});
	});
});

