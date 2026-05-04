export default {
	name: "SampleEditor",
	entry: "script/plugins/sampleeditor/sampleEditor.js",
	load: function(){
		return import("./sampleEditor.js");
	},
	assets: []
};
