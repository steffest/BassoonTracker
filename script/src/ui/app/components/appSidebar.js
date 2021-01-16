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
    
    
    var skipButton = UI.Assets.generate("buttonKey");
	skipButton.setLabel("Next");
    skipButton.onClick = function(){
    	next();	
	};

	var toggleUIButton = UI.Assets.generate("buttonKey");
	toggleUIButton.setLabel("Toggle UI");
	toggleUIButton.onClick = function(){
		
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

	me.addChild(skipButton);
	me.addChild(toggleUIButton);
    
    var listbox = UI.listbox(2,50,100,100);
    listbox.setProperties({
		font: window.fontFT
	});
    me.addChild(listbox);

    var playlist = [
        {label: "Demomusic", url: "demomods/demomusic.mod"},
        {label: "Stardust Memories", url: "demomods/StardustMemories.mod"},
        {label: "Space Debry", url: "demomods/spacedeb.mod"}
	];
    
    var playListIndex = 0;
    var playlistActive = false;

    
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

		skipButton.setPosition(8,36);
		skipButton.setProperties({
			width: me.width<50 ? 20 : 100
		});
		skipButton.setLabel(me.width<50 ? ">" : "Next");

		toggleUIButton.setPosition(8,56);
		toggleUIButton.setProperties({
			width: me.width<50 ? 20 : 100
		});
		toggleUIButton.setLabel(me.width<50 ? "-" : "Toggle UI");

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

			skipButton.setPosition(2,36);
			
			
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
    
    function next(){
		if (playlistActive){
			playListIndex++;
			if (playListIndex>=playlist.length){
				playListIndex = 0;
			}
			Tracker.stop();
			playListPlaySong(playListIndex);
		}
	}

    EventBus.on(EVENT.songEnd,function(){
        next();
    });
    
    

    me.onResize();
    
    var playlistPath = Host.getBaseUrl() + "demomods/Playlist/";
    FetchService.get(playlistPath + "list.txt",function(list){
    	list = list.split("\n");
    	list.forEach(function(item){
    		if (item) playlist.push({label:item, url: playlistPath + item});
		});
    	
		playlist.forEach(function(item,index){
			item.index = index;
		});
		playListIndex = 0;
		playlistActive = false;
		listbox.setItems(playlist);
	});
    
    return me;
};