UI.app_sidebar = function(){
    var me = UI.panel(0,0,200,200);
    me.setProperties({
        name: "sideBar"
    });

    var background = UI.scale9Panel(0,0,me.width,me.height,{
        img: Y.getImage("background"),
        left:3,
        top:3,
        right:4,
        bottom: 4
    });
    background.ignoreEvents = true;
    me.addChild(background);
    
    
    var sideLabel = UI.label();
    sideLabel.setProperties({
        label: "Playlist:",
        font: fontFT
    });
    me.addChild(sideLabel);


    var toggleButton = UI.Assets.generate("buttonKey");
    me.addChild(toggleButton);
    
    toggleButton.onClick = function(){
        App.doCommand(COMMAND.toggleAppSideBar)  
    };
    
    
    var playlistControlPanel = UI.scale9Panel(0,0,me.width,me.height,{
        img: Y.getImage("background"),
        left:3,
        top:3,
        right:4,
        bottom: 4
    });
    playlistControlPanel.ignoreEvents = true;
    me.addChild(playlistControlPanel);
    
    var listbox = UI.listbox(2,50,100,100);
    me.addChild(listbox);

    var playlist = [
        {label: "Demomusic", url: "demomods/demomusic.mod"},
        {label: "Stardust Memories", url: "demomods/StardustMemories.mod"},
        {label: "Space Debry", url: "demomods/spacedeb.mod"}
    ];
    playlist.forEach(function(item,index){
        item.index = index;
    });
    var playListIndex = 0;
    var playlistActive = false;

    listbox.setItems(playlist);
    listbox.onChange = function(v){
        //console.error(v);
    };
    listbox.onClick = function(){
        var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
        if (item && item.url){
            playListPlaySong(item.index);
        }
    };

    me.onResize = function(){

        background.setSize(me.width,me.height);
        toggleButton.setPosition(me.width-22,2);


        sideLabel.setSize(me.width,Layout.trackControlHeight);
        playlistControlPanel.setPosition(2,32);
        playlistControlPanel.setSize(me.width-4,54);

        var listboxTop = 32 + 54 + 2;
        listbox.setProperties({
            left: 2,
            top: listboxTop,
            width: me.width -4,
            height: me.height - listboxTop - Layout.defaultMargin
        });
        
        if (me.width<50){
            sideLabel.hide();
            playlistControlPanel.hide();
            listbox.hide();
        }else{
            sideLabel.show();
            playlistControlPanel.show();
            listbox.show();
        }
        
    };

    function playListPlaySong(index){
        var item = playlist[index];
        if (item){
            listbox.setSelectedIndex(index);
            playListIndex = index;
            playlistActive = true;
            Tracker.autoPlay = true;
            Tracker.load(item.url);
        }
    }

    EventBus.on(EVENT.songEnd,function(){
        if (playlistActive){
            playListIndex++;
            if (playListIndex>=playlist.length){
                playListIndex = 0;
            }
            playListPlaySong(playListIndex);
        }
    });

    me.onResize();

    return me;
};