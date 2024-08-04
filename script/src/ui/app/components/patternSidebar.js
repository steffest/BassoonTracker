UI.pattern_sidebar = function(){
    var me = UI.panel();
    me.setProperties({
        name: "sideButtonPanel"
    });

    var songListBox = UI.listbox();
    var playlistListBox = UI.listbox();


    var tabPanel = UI.tabPanel(0,0,me.width,me.height,{
        tabs:[
            {
                label: "Songs",
                width: 70,
                isSelected: true,
                panel: generateTabPanel("songs")
            },
            {
                label: "PlayLists",
                width: 90,
                panel: generateTabPanel("playlists")
            }
        ]
    });
    tabPanel.zIndex=1;
    me.addChild(tabPanel);

    me.sortZIndex();

    var buttonsSideInfo=[
        {label:"Random MOD", onClick:function(){App.doCommand(COMMAND.randomSong)}},
        {label:"Random XM", onClick:function(){App.doCommand(COMMAND.randomSongXM)}}
    ];

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

    };
    me.onResize();

    function generateTabPanel(type){
        var listbox = type === "songs" ? songListBox : playlistListBox;
        var line = Y.getImage("line_hor");

        listbox.setProperties({
            background: false,
            lineHeight: 32,
            itemRenderFunction: function(ctx,item,isHover,isSelected){
                var text = item.label;

                if (item.level){
                    var iconX = 13;
                    var mainAlpha = 0.8;
                    var _x;
                    ctx.globalAlpha = 0.6;

                    if (isHover || isSelected){
                        mainAlpha = 1;
                        iconX = 12;
                        if (isSelected){
                            ctx.globalAlpha = 0.5;
                            ctx.drawImage(Y.getImage("playing_overlay"),0,0,listbox.width-2,31);
                        }
                        ctx.globalAlpha = 1;
                    }

                    ctx.drawImage(UI.Icon.get(item),iconX,0);
                    ctx.globalAlpha = mainAlpha;
                    window.fontMed.write(ctx,text,43,4,0);
                    if (isSelected){
                        window.fontMed.write(ctx,text,43,4,0);
                    }
                    if (item.info) window.fontSmall.write(ctx,item.info,43,14,0,"blue");
                    if (item.infoExtra) {
                        _x = window.fontSmall.getTextWidth(item.info);
                        window.fontSmall.write(ctx,item.infoExtra,48+_x,14,0,"green");
                    }
                    _x = 0;
                    if (item.icon2){
                        ctx.drawImage(item.icon2,43,21);
                        _x = 9;
                    }
                    if (item.info2){
                        window.fontSmall.write(ctx,item.info2,43+_x,21,0,"orange");
                    }
                    ctx.globalAlpha = 1;

                    if (type === "songs" && isSelected){
                        ctx.drawImage(Y.getImage("play_icon"),1,8);
                    }
                }else{
                    window.fontBig.write(ctx,text,12,8,0);
                }

                ctx.drawImage(line,0,30,listbox.width-2,2);
            }
        })
        listbox.setItems([{label: "Loading ...", index: 0, icon: Y.getImage("disk")}]);
        listbox.onClick = function(){
            var item = listbox.getItemAtPosition(listbox.eventX,listbox.eventY);
            if (item){
                var index = item.listIndex;
                if (item !== listbox.getSelectedIndex()){
                    listbox.setSelectedIndex(index);
                }
                if (item.url){
                    if (typeof item.index === "number" && type === "songs"){
                        Playlist.play(item.index);
                    }else{
                        Tracker.load(item.url,false,function(){
                            Tracker.autoPlay = false;
                            tabPanel.setTab(0);
                        })
                    }
                }
            }
        };
        var panel = UI.panel();
        panel.setProperties({
            name: "songPanel",
            zIndex: 100,
        })
        panel.onResize = function(){
            listbox.setProperties({
                left: 0,
                top: 0,
                width: panel.width,
                height: panel.height-8
            });
        }
        me.addChild(panel);
        panel.addChild(listbox);

        if (type === "playlists"){
            panel.onShow = function(){
                let items = listbox.getItems();
                if (items.length === 1){
                    FetchService.json("playlists/main.json",function(data){
                        listbox.setItems(generateListBoxItems(data));
                    });
                }
            }
        }

        return panel;
    }

    function generateListBoxItems(data){
        let items = [];
        let level = 0;
        if (data.title){
            items.push({label: data.title, icon: Y.getImage("disk"), listIndex:0});
            level++;
        }
        data.modules.forEach(function(item,index){
            let icon = Y.getImage("mod");
            if (item.url.endsWith(".xm")) icon = Y.getImage("xm");
            console.error(item);
            var info = item.info;
            var info2;
            var icon2
            var infoExtra;
            if (item.author){
                info = item.author;
                info2 = item.info;
            }
            if (item.group){
                infoExtra = item.group;
            }
            if (info2){
                if (info2.startsWith("1st")) icon2 = Y.getImage("gold");
                if (info2.startsWith("2nd")) icon2 = Y.getImage("silver");
                if (info2.startsWith("3rd")) icon2 = Y.getImage("bronze");
            }

            items.push({label: item.title, info: info, info2: info2, icon2: icon2, infoExtra: infoExtra, url: item.url, icon: icon, level: level, index: index, listIndex: index+level});
        });
        return items;
    }

    EventBus.on(EVENT.playListLoaded,function(data){
        songListBox.setItems(generateListBoxItems(data));
    });

    EventBus.on(EVENT.playListIndexChanged, function(index){
        songListBox.setSelectedIndex(index+1);
    });

    return me;
};