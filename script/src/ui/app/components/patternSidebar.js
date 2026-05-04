import Panel from "../../components/panel.js";
import Listbox from "../../components/listbox.js";
import InputBox from "../../components/inputbox.js";
import TabPanel from "../../components/tabPanel.js";
import Button from "../../components/button.js";
import Checkboxbutton from "../../components/checkboxbutton.js";
import Label from "../../components/label.js";
import UIImage from "../../components/image.js";
import Assets from "../../assets.js";
import Icon from "../../components/icon.js";
import FetchService from "../../../fetchService.js";
import Playlist from "../../../models/playlist.js";
import Tracker from "../../../tracker.js";
import {COMMAND, EVENT} from "../../../enum.js";
import EventBus from "../../../eventBus.js";
import App from "../../../app.js";
import Y from "../../yascal/yascal.js";
import Editor from "../../../editor.js";
import Favorites from "../../../models/favorites.js";


let pattern_sidebar = function(){
    var me = Panel();
    me.name =  "patternSidebar";

    var songListBox = Listbox();
    songListBox.name = "songListBox";
    var sampleListBox = Listbox();
    sampleListBox.name = "sampleListBox";
    var sampleSearchBox = InputBox();
    sampleSearchBox.name = "sampleSearchBox";
    var playlistListBox = Listbox();
    playlistListBox.name = "playlistListBox";
    var sampleList = [];
    var sampleSearchText = "";

    var tabPanel = TabPanel(0,0,me.width,me.height,{
        tabs:[
            {
                label: "Songs",
                width: 70,
                isSelected: true,
                panel: generateTabPanel("songs"),
                footer: generateSongControls()
            },
            {
                label: "Samples",
                width: 80,
                panel: generateTabPanel("samples")
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

    var pianoButton = Button();
    pianoButton.setProperties({
        label: "",
        textAlign:"center",
        background: Assets.buttonLightScale9,
        hoverBackground: Assets.buttonLightHoverScale9,
        image: Y.getImage("piano"),
        font:window.fontMed
    });
    pianoButton.onClick = function(){App.doCommand(COMMAND.togglePiano)};
    pianoButton.tooltip = "Toggle Piano Keys";
    me.addChild(pianoButton);

    var nibblesButton = Button();
    nibblesButton.setProperties({
        label: "",
        textAlign:"center",
        background: Assets.buttonLightScale9,
        hoverBackground: Assets.buttonLightHoverScale9,
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
        var listbox = getListBox(type);
        var line = Y.getImage("line_hor");

        listbox.setProperties({
            background: false,
            lineHeight: type === "samples" ? 20 : 32,
            itemRenderFunction: function(ctx,item,isHover,isSelected){
                var text = item.label;

                if (type === "samples"){
                    renderSampleItem(ctx,item,line,listbox.width);
                    return;
                }else if (item.level){
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

                    ctx.drawImage(Icon.get(item),iconX,0);
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
                    let font = item.sub?fontMed:fontBig;
                    font.write(ctx,text,textX,textY,0);
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
                    if (type === "samples"){
                        Tracker.load(item.url);
                    }else if (typeof item.index === "number" && type === "songs"){
                        Playlist.play(item.index);
                    }else{
                        Tracker.load(Editor.unpackUrl(item.url),false,function(){
                            Tracker.autoPlay = false;
                            tabPanel.setTab(0);
                        })
                    }
                }else{
                    if (type === "samples" && item.data && item.data.children){
                        item.data.isExpanded = !item.data.isExpanded;
                        if (item.data.url && item.data.isExpanded && !item.data.children.length){
                            FetchService.json(item.data.url,function(data){
                                if (data && data.samples){
                                    item.data.children = data.samples;
                                    refreshSampleList();
                                }
                            })
                        }else{
                            refreshSampleList();
                        }
                    }
                }
            }
        };
        var panel = Panel();
        panel.setProperties({
            name: "songPanel",
            zIndex: 100,
        })
        panel.onResize = function(){
            var listTop = 0;
            if (type === "samples"){
                sampleSearchBox.setProperties({
                    left: 0,
                    top: 0,
                    width: panel.width,
                    height: 20,
                    placeholder: "Search"
                });
                listTop = 22;
            }
            listbox.setProperties({
                left: 0,
                top: listTop,
                width: panel.width,
                height: panel.height-listTop-8
            });
        }
        me.addChild(panel);
        if (type === "samples"){
            sampleSearchBox.onChange = function(value){
                sampleSearchText = value;
                refreshSampleList();
            };
            panel.addChild(sampleSearchBox);
        }
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
        if (type === "samples"){
            panel.onShow = function(){
                let items = listbox.getItems();
                if (items.length === 1){
                    if (sampleList.length){
                        refreshSampleList();
                    }else{
                        FetchService.json("data/samples.full.json",function(data){
                            if (data){
                                sampleList = groupSamplesByType(data.samples || data);
                                refreshSampleList();
                            }
                        });
                    }
                }
            }
        }

        return panel;
    }

    function getListBox(type){
        if (type === "samples") return sampleListBox;
        if (type === "playlists") return playlistListBox;
        return songListBox;
    }

    function renderSampleItem(ctx,item,line,width){
        var textX = 4 + (item.level * 10);
        var font = window.fontFT;
        var text = item.label;

        if (item.icon){
            ctx.drawImage(item.icon,textX,0,16,16);
            textX += 19;
        }

        if (item.info){
            var infoWidth = font.getTextWidth(item.info,0) + 12;
            window.fontSmall.write(ctx,item.info,width-infoWidth,5,0);
            text = text.substr(0,Math.floor((width-infoWidth-textX-8)/6));
        }

        font.write(ctx,text,textX,2,0);
        ctx.drawImage(line,0,18,width-2,2);
    }

    function refreshSampleList(){
        sampleListBox.setItems(generateSampleListBoxItems(sampleList,sampleSearchText));
        sampleListBox.setSelectedIndex(0,true);
    }

    function groupSamplesByType(data){
        let groups = {};
        let result = [];

        data.forEach(function(item){
            let type = item.type || "other";
            if (!groups[type]){
                groups[type] = {
                    title: firstLetterToUpperCase(type),
                    icon: "disk",
                    children: [],
                    isExpanded: false
                };
                result.push(groups[type]);
            }
            groups[type].children.push(item);
        });

        result.sort(function(a,b){
            return a.title.localeCompare(b.title);
        });
        result.forEach(function(group){
            group.info = group.children.length + "";
            group.children.sort(function(a,b){
                return a.title.localeCompare(b.title);
            });
        });

        return result;
    }

    function firstLetterToUpperCase(value){
        return value.substr(0,1).toUpperCase() + value.substr(1);
    }

    function generateSongControls(){
        let controls = Panel(0,0,20,68);

        let buttons = [
            ["iprev",COMMAND.playPrevious,"Play Previous song in playlist"],
            ["iplay",COMMAND.play, "Toggle Play [Enter]"],
            ["inext",COMMAND.playNext, "Play Next song in playlist"],
            ["ishuffle",COMMAND.toggleShuffle, "Toggle Shuffle",true]
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
                button = Checkboxbutton({
                    checkbox: true,
                    transparent: true,
                    paddingLeft: 10,
                })
                width = 50;
            }else{
                button = Button(x,0,18,18);
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

        let line = UIImage(0,22,10,2,"line_hor");
        controls.addChild(line);


        let label = Label();
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
            let button = Assets.generate("buttonDarkBlue");
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
            if (item.url){
                let icon = Y.getImage("mod");
                if (item.url.endsWith(".xm")) icon = Y.getImage("xm");
                if (item.icon){
                    icon = item.icon;
                }
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
            }else{
                items.push({label: item.title, icon: item.icon, sub:true});
            }
        });
        return items;
    }

    function generateSampleListBoxItems(data,searchText){
        let items = [];
        let query = searchText ? searchText.toLowerCase() : "";

        function addItems(source,level){
            source.forEach(function(item){
                let hasChildren = !!item.children;
                let children = item.children;
                if (query && children){
                    children = children.filter(function(child){
                        return child.title && child.title.toLowerCase().indexOf(query)>=0;
                    });
                    if (!children.length) return;
                }
                let icon = hasChildren ? Y.getImage("disk") : Y.getImage(item.icon || "sample");
                let listItem = {
                    label: item.title,
                    info: query && children ? children.length + "" : item.info,
                    url: hasChildren ? undefined : item.url,
                    icon: icon,
                    level: level,
                    data: item,
                    listIndex: items.length
                };
                items.push(listItem);
                if (hasChildren && (item.isExpanded || query) && children.length){
                    addItems(children,level+1);
                }
            });
        }

        addItems(data,0);
        return items;
    }

    EventBus.on(EVENT.playListLoaded,function(data){
        songListBox.setItems(generateListBoxItems(data));
    });

    EventBus.on(EVENT.playListIndexChanged, function(index){
        songListBox.setSelectedIndex(index+1);
    });

    EventBus.on(EVENT.favoritesUpdated, function(){
        let items = songListBox.getItems();
        if (items && items.length && items[0].label === "Favorites"){
            Playlist.set(Favorites.getPlaylist());
        }
    });

    return me;
};

export default pattern_sidebar;
