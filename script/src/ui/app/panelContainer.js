UI.app_panelContainer = function(height){
    var me = UI.panel(0,0,canvas.width,height,true);

    var background = UI.scale9Panel(0,0,me.width,me.height,UI.Assets.panelMainScale9);
    background.ignoreEvents = true;
    me.addChild(background);

    me.onResize = function(){
        background.setSize(me.width,me.height);
        if (me.onPanelResize) me.onPanelResize();
    };

    return me;
};