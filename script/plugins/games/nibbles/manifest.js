export default {
	name: "Nibbles",
	entry: "script/plugins/games/nibbles/nibbles.js",
	load: function(){
		return import("./nibbles.js");
	},
	assets: [
		"script/plugins/games/nibbles/logo.png",
		"script/plugins/games/nibbles/levels.png",
		"script/plugins/games/nibbles/player1.png"
	]
};
