UI.pattern_sidebar = function(){
    var me = UI.panel();
    me.setProperties({
        name: "sideButtonPanel"
    });

    var listBox = UI.listbox();
    listBox.setProperties({
        background: false
    })
    listBox.setItems([
        {label: "Loading ...", index: 0, icon: Y.getImage("disk")}
    ]);
    listBox.onClick = function(){
        var item = listBox.getItemAtPosition(listBox.eventX,listBox.eventY);
        console.log("click",item);
        if (item){
            var index = item.listIndex;
            if (item !== listBox.getSelectedIndex()){
                listBox.setSelectedIndex(index);
            }
            if (typeof item.index === "number"){
                Playlist.play(item.index);
            }
        }
    };
    listBox.onChange = function(item){
        console.log("change",item);
    }
    var songPanel = UI.panel();
    songPanel.setProperties({
        name: "songPanel",
        zIndex: 100,
    })
    songPanel.onResize = function(){
        listBox.setProperties({
            left: 0,
            top: 0,
            width: songPanel.width,
            height: songPanel.height-8
        });
    }
    me.addChild(songPanel);
    songPanel.addChild(listBox);



    var tabPanel = UI.tabPanel(0,0,me.width,me.height,{
        tabs:[
            {
                label: "Songs",
                width: 70,
                isSelected: true,
                panel: songPanel
            },
            {
                label: "PlayLists",
                width: 90
            }
        ]
    });
    tabPanel.zIndex=1;
    me.addChild(tabPanel);

    me.sortZIndex();

    var buttonsSide = [];
    var buttonsSideInfo=[
        {label:"Random MOD", onClick:function(){App.doCommand(COMMAND.randomSong)}},
        {label:"Random XM", onClick:function(){App.doCommand(COMMAND.randomSongXM)}}
    ];



    for (var i = 0;i< buttonsSideInfo.length;i++){
        var buttonSideInfo = buttonsSideInfo[i];
        var buttonElm = UI.button();
        buttonElm.info = buttonSideInfo;
        buttonElm.onClick =  buttonSideInfo.onClick;
        buttonsSide[i] = buttonElm;
        //me.addChild(buttonElm);
    }

    var pianoButton = UI.button();
    pianoButton.setProperties({
        label: "",
        textAlign:"center",
        background: UI.Assets.buttonLightScale9,
        hoverBackground: UI.Assets.buttonLightHoverScale9,
        image: Y.getImage("piano"),
        font:window.fontMed
    });
    pianoButton.onClick = function(){App.doCommand(COMMAND.togglePiano)};
    me.addChild(pianoButton);

    var nibblesButton = UI.button();
    nibblesButton.setProperties({
        label: "",
        textAlign:"center",
        background: UI.Assets.buttonLightScale9,
        hoverBackground: UI.Assets.buttonLightHoverScale9,
        image: Y.getImage("nibbles")
    });
    nibblesButton.onClick = function(){App.doCommand(COMMAND.nibbles)};
    me.addChild(nibblesButton);


    me.onResize = function(){
        var buttonHeight = 30;

        pianoButton.setProperties({
            left:0,
            top: me.height - buttonHeight,
            width: me.width,
            height:buttonHeight
        });

        nibblesButton.setProperties({
            left:0,
            top: me.height - buttonHeight - buttonHeight,
            width: me.width,
            height:buttonHeight
        });

        tabPanel.setProperties({
            left:0,
            top: 0 ,
            width: me.width,
            height: me.height - buttonHeight*2 - 10
        });

        var max = buttonsSideInfo.length;
        for (i = 0;i<max;i++){
            var button = buttonsSide[i];
            var buttonTop = (i*buttonHeight) +10;
            var buttonLeft = 0;
            if (buttonTop > nibblesButton.top-buttonHeight){
                buttonLeft = -500;
            }

            var background = UI.Assets.buttonLightScale9;
            var backgroundHover = UI.Assets.buttonLightHoverScale9;
            if (i>max-3){
                background= UI.Assets.panelDarkScale9;
                backgroundHover= UI.Assets.panelDarkHoverScale9;
            }

            //me.addChild(buttonElm);
            button.setProperties({
                left:buttonLeft,
                top: buttonTop,
                width: me.width,
                height:buttonHeight,
                label: button.info.label,
                textAlign:"left",
                background: background,
                hoverBackground: backgroundHover,
                font:window.fontFT
            });
        }
    };

    me.onResize();

    EventBus.on(EVENT.playListLoaded,function(data){
        let items = [];
        let level = 0;
        if (data.title){
            items.push({label: data.title, icon: Y.getImage("disk"), listIndex:0});
            level++;
        }
        data.modules.forEach(function(item,index){
            let icon = Y.getImage("mod");
            if (item.url.endsWith(".xm")) icon = Y.getImage("xm");
            items.push({label: item.title, url: item.url, icon: icon, level: level, index: index, listIndex: index+level});
        });
        listBox.setItems(items);
    });

    return me;
};