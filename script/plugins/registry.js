import Nibbles from "./games/nibbles/manifest.js";
import Generator from "./apps/generator/manifest.js";
import SampleEditor from "./sampleeditor/manifest.js";

export default {
	[Nibbles.name]: Nibbles,
	[Generator.name]: Generator,
	[SampleEditor.name]: SampleEditor
};
