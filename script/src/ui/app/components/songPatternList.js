UI.app_songPatternList = function(height){

    var me = UI.panel();

    var songPanel = UI.scale9Panel(0,0,0,0,UI.Assets.panelInsetScale9);
    me.addChild(songPanel);

    var songlistbox = UI.listbox();
    songlistbox.setItems([
        {label: "01:00", data: 1}
    ]);
    me.addChild(songlistbox);

    var spPlus = UI.Assets.generate("button20_20");
    spPlus.setLabel("↑");
    spPlus.onClick = function(){
        var index = songlistbox.getSelectedIndex();
        var pattern = Tracker.getSong().patternTable[index];
        pattern++;
        Tracker.updatePatternTable(index,pattern);

    };
    me.addChild(spPlus);

    var spMin = UI.Assets.generate("button20_20");
    spMin.setLabel("↓");
    spMin.onClick = function(){
        var index = songlistbox.getSelectedIndex();
        var pattern = Tracker.getSong().patternTable[index];
        if (pattern>0) pattern--;
        Tracker.updatePatternTable(index,pattern);
    };
    me.addChild(spMin);

    me.onResize = function(){
        songPanel.setSize(me.width,me.height);

        songlistbox.setProperties({
            left:0,
            top:0,
            width:  me.width - 42,
            height: me.height,
            centerSelection: true,
            onChange: function(){
                Tracker.setCurrentSongPosition(songlistbox.getSelectedIndex(),true);
            }
        });

        spMin.setPosition(me.width - 22,Math.floor(me.height/2)-10);
        spPlus.setPosition(me.width - 42,spMin.top);
    };

    EventBus.on(EVENT.patternTableChange,function(value){
        me.setPatternTable(Tracker.getSong().patternTable);
    });


    me.setPatternTable = function(patternTable){
        var items = [];
        for (var i = 0, len = Tracker.getSong().length; i<len; i++){
            var value = patternTable[i];
            items.push({label: padd2(i+1) + ":" + padd2(value), data:value});
        }
        songlistbox.setItems(items);
    };

    function padd2(s){
        s = "" + s;
        if (s.length < 2){s = "0" + s}
        return s;
    }

    EventBus.on(EVENT.songLoaded,function(song){
        me.setPatternTable(song.patternTable);
    });

    EventBus.on(EVENT.songPositionChange,function(value){
        songlistbox.setSelectedIndex(value,true);
    });

    return me;
};