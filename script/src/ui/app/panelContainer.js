import Panel from '../components/panel.js';
import Scale9Panel from '../components/scale9.js';
import Assets from "../assets.js";
import UI from "../ui.js";

let app_panelContainer = function(height){
    let canvas = UI.getCanvas();
    var me = Panel(0,0,canvas.width,height,true);

    var background = Scale9Panel(0,0,me.width,me.height,Assets.panelMainScale9);
    background.ignoreEvents = true;
    me.addChild(background);

    me.onResize = function(){
        background.setSize(me.width,me.height);
        if (me.onPanelResize) me.onPanelResize();
    };

    return me;
};

export default app_panelContainer;