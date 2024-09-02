import Panel from "../../components/panel.js";
import Scale9Panel from "../../components/scale9.js";
import Assets from "../../assets.js";
import Listbox from "../../components/listbox.js";
import EventBus from "../../../eventBus.js";
import {EVENT} from "../../../enum.js";
import Tracker from "../../../tracker.js";
import Editor from "../../../editor.js";
import Ticker from "../../ticker.js";


let app_songPatternList = function(height){

    var me = Panel();

    var songPanel = Scale9Panel(0,0,0,0,Assets.panelInsetScale9);
    me.addChild(songPanel);

    var songlistbox = Listbox();
    songlistbox.setItems([
        {label: "01:00", data: 1}
    ]);
    songlistbox.onClick = function(){

        var item = songlistbox.getItemAtPosition(songlistbox.eventX,songlistbox.eventY);
        if (item){
            var index = item.index;
            if (item !== songlistbox.getSelectedIndex()){
                songlistbox.setSelectedIndex(index);
            }
        }

    };
    me.addChild(songlistbox);

    var spPlus = Assets.generate("button20_20");
    spPlus.setLabel("↑");
    spPlus.onDown = function(){
        var index = songlistbox.getSelectedIndex();
        var pattern = Tracker.getSong().patternTable[index];
        pattern++;
        Tracker.updatePatternTable(index,pattern);
		Ticker.onEachTick4(function(){
			var index = songlistbox.getSelectedIndex();
			var pattern = Tracker.getSong().patternTable[index];
			pattern++;
			Tracker.updatePatternTable(index,pattern);
		},5);

    };
	spPlus.onTouchUp = function(){
		Ticker.onEachTick4();
	};
    me.addChild(spPlus);


    var spMin = Assets.generate("button20_20");
    spMin.setLabel("↓");
    spMin.onDown = function(){
        var index = songlistbox.getSelectedIndex();
        var pattern = Tracker.getSong().patternTable[index];
        if (pattern>0) pattern--;
        Tracker.updatePatternTable(index,pattern);
		Ticker.onEachTick4(function(){
			var index = songlistbox.getSelectedIndex();
			var pattern = Tracker.getSong().patternTable[index];
			if (pattern>0) pattern--;
			Tracker.updatePatternTable(index,pattern);
		},5);
    };
	spMin.onTouchUp = function(){
		Ticker.onEachTick4();
	};
    me.addChild(spMin);



    var spInsert = Assets.generate("button20_20");
    spInsert.setLabel("Ins");
    spInsert.onDown = function(){
        var index = songlistbox.getSelectedIndex();
        Editor.addToPatternTable(index);

    };
    spInsert.setProperties({width: 40, height: 20});
    me.addChild(spInsert);


    var spDelete = Assets.generate("button20_20");
    spDelete.setLabel("Del");
    spDelete.onDown = function(){
        var index = songlistbox.getSelectedIndex();
        Editor.removeFromPatternTable(index);

    };
    spDelete.setProperties({width: 40, height: 20});
    me.addChild(spDelete);
    
    

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

        spInsert.setPosition(spPlus.left,spPlus.top - 22);
        spDelete.setPosition(spPlus.left,spPlus.top + 22);
    };

    EventBus.on(EVENT.patternTableChange,function(value){
        me.setPatternTable(Tracker.getSong().patternTable);
    });


    me.setPatternTable = function(patternTable){
        var items = [];
        for (var i = 0, len = Tracker.getSong().length; i<len; i++){
            var value = patternTable[i];
            items.push({label: padd2(i+1) + ":" + padd2(value), data:value, index: i});
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

export default app_songPatternList;