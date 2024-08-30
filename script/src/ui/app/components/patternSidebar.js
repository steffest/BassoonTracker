UI.pattern_sidebar = function(){
    var me = UI.panel();
    me.name =  "patternSidebar";

    var songListBox = UI.listbox();
    songListBox.name = "songListBox";
    var playlistListBox = UI.listbox();
    playlistListBox.name = "playlistListBox";


    var tabPanel = UI.tabPanel(0,0,me.width,me.height,{
        tabs:[
            {
                label: "Songs",
                width: 70,
                isSelected: true,
                panel: generateTabPanel("songs"),
                footer: generateSongControls()
            },
            {
                label: "PlayLists",
                width: 90,
                panel: generateTabPanel("playlists")
            }
        ]
    });
    tabPanel.name = "tabPanel";
    tabPanel.zIndex=1;
    me.addChild(tabPanel);

    me.sortZIndex();

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
    pianoButton.tooltip = "Toggle Piano Keys";
    me.addChild(pianoButton);

    var nibblesButton = UI.button();
    nibblesButton.setProperties({
        label: "",
        textAlign:"center",
        background: UI.Assets.buttonLightScale9,
        hoverBackground: UI.Assets.buttonLightHoverScale9,
        image: Y.getImage("nibbles")
    });
    nibblesButton.onClick = function(){App.doCommand(COMMAND.nibbles)}
    nibblesButton.tooltip = "Play Nibbles Game!";
    me.addChild(nibblesButton);


    me.onResize = function(){
        var buttonHeight = 30;
        var listHeight =  me.height - buttonHeight*2 - 10;

        if (listHeight<100){
            pianoButton.hide();
            nibblesButton.hide();
            listHeight = me.height-4;
        }else{
            pianoButton.show();
            nibblesButton.show();
        }

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
            height: listHeight
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
                    var textY = 11;
                    var textX = 12;
                    if (item.icon){
                        if (typeof item.icon === "string"){
                            Y.loadImage(item.icon,function(img){
                                item.icon = img;
                                listbox.clearCache();
                                listbox.refresh();
                            });
                        }else{
                            ctx.drawImage(item.icon,3,2);
                        }

                        textX = 32;
                    }
                    if (item.info){
                        textY = 6;
                        window.fontSmall.write(ctx,item.info,textX,20,0);
                    }
                    window.fontBig.write(ctx,text,textX,textY,0);
                }

                ctx.drawImage(line,0,30,listbox.width-2,2);
            }
        })
        listbox.setItems([{label: "Loading ...", index: 0}]);
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

    function generateSongControls(){
        let controls = UI.panel(0,0,20,68);

        let buttons = [
            ["iprev",COMMAND.playPrevious,"Play Previous song in playlist"],
            ["iplay",COMMAND.play, "Toggle Play [Enter]"],
            ["inext",COMMAND.playNext, "Play Next song in playlist"],
            ["ishuffle",COMMAND.toggleShuffle, "Toggle Shuffle",true],
        ]

        let buttons2 = [
            ["Mod",COMMAND.randomSong,"Play a random MOD song"],
            ["XM",COMMAND.randomSongXM,"Play a random XM song"],
            ["PlayList",COMMAND.randomPlayList,"Generate a random playlist"],
        ]

        let x = 10;
        buttons.forEach(function(item){
            let isCheckbox = item[3];
            let width = 18;
            let button;
            if (isCheckbox){
                button = UI.checkboxbutton({
                    checkbox: true,
                    transparent: true,
                    paddingLeft: 10,
                })
                width = 50;
            }else{
                button = UI.button(x,0,18,18);
            }
            button.setProperties({
                image: Y.getImage(item[0]),
                hoverImage: Y.getImage(item[0]+"_active"),
                opacity: 0.7,
                hoverOpacity: 1,
                left: x,
                top: 2,
                width: width
            });
            button.onClick = function(){
                App.doCommand(item[1]);
            }
            button.tooltip = item[2] || "Play";
            controls.addChild(button);
            item.push(button);
            x+=20;
        });

        let line = UI.image(0,22,10,2,"line_hor");
        controls.addChild(line);


        let label = UI.label();
        label.setProperties({
            label: "Play Random",
            font: fontSmall,
            color: "white",
            left: 0,
            textAlign: "center",
            top: 30
        });
        controls.addChild(label);


        buttons2.forEach(function(item){
            let button = UI.Assets.generate("buttonDarkBlue");
            button.setProperties({
                label: item[0],
                font: fontSmall,
                paddingTop: 1,
                textAlign: "center"
            });
            button.onClick = function(){
                App.doCommand(item[1]);
            }
            button.tooltip = item[2];
            controls.addChild(button);
            x+=60;
            item.push(button);
        });

        EventBus.on(EVENT.playingChange,function(isPlaying){
            let button = controls.children[1];
            if (isPlaying){
                button.setProperties({
                    image: Y.getImage("istop"),
                    hoverImage: Y.getImage("istop_active"),
                });
            }else{
                button.setProperties({
                    image: Y.getImage("iplay"),
                    hoverImage: Y.getImage("iplay_active"),
                });
            }
        });


        controls.onResize = function(){
            let w = Math.floor((controls.width-10)/3);
            buttons.forEach(function(item,index){
                let button = item[item.length-1];
                let margin = Math.floor((controls.width - (18*3 + 50))/5);
                button.setProperties({
                    left: margin*(index+1) + 18*index
                });
            });

            buttons2.forEach(function(item,index){
                item[3].setProperties({
                    left: w*index + 5,
                    top: 40,
                    width: w
                });
            });
            line.setSize(controls.width,2);
            label.setSize(controls.width,10);
        };

        return controls;
    }

    function generateListBoxItems(data){
        let items = [];
        let level = 0;
        if (data.title){
            items.push(
                {
                    label: data.title,
                    listIndex:0,
                    info: data.info,
                    icon: data.icon,
                });
            level++;
        }
        data.modules.forEach(function(item,index){
            let icon = Y.getImage("mod");
            if (item.url.endsWith(".xm")) icon = Y.getImage("xm");
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