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
import App from "../../../app.js";
import Y from "../../yascal/yascal.js";
import Editor from "../../../editor.js";
import Favorites from "../../../models/favorites.js";
import Font from "../../font.js";

export default class PatternSidebar extends Panel {
    _songListBox;
    _sampleListBox;
    _sampleSearchBox;
    _playlistListBox;
    _sampleList = [];
    _sampleSearchText = "";
    _tabPanel;
    _pianoButton;
    _nibblesButton;

    constructor() {
        super(0, 0, 20, 20);
        this.name = "patternSidebar";

        this._songListBox     = new Listbox(0, 0, 20, 20);
        this._songListBox.name = "songListBox";
        this._sampleListBox   = new Listbox(0, 0, 20, 20);
        this._sampleListBox.name = "sampleListBox";
        this._sampleSearchBox = new InputBox(0, 0, 20, 20);
        this._sampleSearchBox.name = "sampleSearchBox";
        this._playlistListBox = new Listbox(0, 0, 20, 20);
        this._playlistListBox.name = "playlistListBox";

        this._tabPanel = new TabPanel(0, 0, this.width, this.height, {
            tabs: [
                {label: "Songs",     width: 70, panel: this._generateTabPanel("songs"), isSelected: true, footer: this._generateSongControls()},
                {label: "Samples",   width: 80, panel: this._generateTabPanel("samples")},
                {label: "PlayLists", width: 90, panel: this._generateTabPanel("playlists")}
            ]
        });
        this._tabPanel.name   = "tabPanel";
        this._tabPanel.zIndex = 1;
        this.addChild(this._tabPanel);
        this.sortZIndex();

        this._pianoButton = new Button(0, 0, 20, 20);
        this._pianoButton.background      = Assets.buttonLightScale9;
        this._pianoButton.hoverBackground = Assets.buttonLightHoverScale9;
        this._pianoButton.image           = Y.getImage("piano");
        this._pianoButton.font            = Font.med;
        this._pianoButton.onClick         = () => { App.doCommand(COMMAND.togglePiano); };
        this._pianoButton.tooltip         = "Toggle Piano Keys";
        this.addChild(this._pianoButton);

        this._nibblesButton = new Button(0, 0, 20, 20);
        this._nibblesButton.background      = Assets.buttonLightScale9;
        this._nibblesButton.hoverBackground = Assets.buttonLightHoverScale9;
        this._nibblesButton.image           = Y.getImage("nibbles");
        this._nibblesButton.onClick         = () => { App.doCommand(COMMAND.nibbles); };
        this._nibblesButton.tooltip         = "Play Nibbles Game!";
        this.addChild(this._nibblesButton);

        this.on(EVENT.playListLoaded, data => {
                this._songListBox.setItems(this._generateListBoxItems(data));
            });
        this.on(EVENT.playListIndexChanged, index => {
                this._songListBox.setSelectedIndex(index + 1);
            });
        this.on(EVENT.favoritesUpdated, () => {
                const items = this._songListBox.getItems();
                if (items && items.length && items[0].label === "Favorites") {
                    Playlist.set(Favorites.getPlaylist());
                }
            });

        this.onResize();
    }

    onResize() {
        const buttonHeight = 30;
        let listHeight     = this.height - buttonHeight * 2 - 10;

        if (listHeight < 100) {
            this._pianoButton.hide();
            this._nibblesButton.hide();
            listHeight = this.height - 4;
        } else {
            this._pianoButton.show();
            this._nibblesButton.show();
        }

        this._pianoButton.setDimensions({
            left: 0, top: this.height - buttonHeight, width: this.width, height: buttonHeight
        });
        this._nibblesButton.setDimensions({
            left: 0, top: this.height - buttonHeight * 2, width: this.width, height: buttonHeight
        });
        this._tabPanel.setDimensions({
            left: 0, top: 0, width: this.width, height: listHeight
        });
    }


    _getListBox(type) {
        if (type === "samples")   return this._sampleListBox;
        if (type === "playlists") return this._playlistListBox;
        return this._songListBox;
    }

    _generateTabPanel(type) {
        const listbox = this._getListBox(type);
        const line    = Y.getImage("line_hor");

        listbox.background  = false;
        listbox.lineHeight  = type === "samples" ? 20 : 32;
        listbox.itemRenderFunction = (ctx, item, isHover, isSelected) => {
            const text = item.label;
            if (type === "samples") {
                this._renderSampleItem(ctx, item, line, listbox.width);
                return;
            } else if (item.level) {
                let iconX     = 13;
                let mainAlpha = 0.8;
                let _x;
                ctx.globalAlpha = 0.6;
                if (isHover || isSelected) {
                    mainAlpha = 1;
                    iconX = 12;
                    if (isSelected) {
                        ctx.globalAlpha = 0.5;
                        ctx.drawImage(Y.getImage("playing_overlay"), 0, 0, listbox.width - 2, 31);
                    }
                    ctx.globalAlpha = 1;
                }
                ctx.drawImage(Icon.get(item), iconX, 0);
                ctx.globalAlpha = mainAlpha;
                Font.med.write(ctx, text, 43, 4, 0);
                if (isSelected) Font.med.write(ctx, text, 43, 4, 0);
                if (item.info) Font.small.write(ctx, item.info, 43, 14, 0, "blue");
                if (item.infoExtra) {
                    _x = Font.small.getTextWidth(item.info);
                    Font.small.write(ctx, item.infoExtra, 48 + _x, 14, 0, "green");
                }
                _x = 0;
                if (item.icon2) { ctx.drawImage(item.icon2, 43, 21); _x = 9; }
                if (item.info2) Font.small.write(ctx, item.info2, 43 + _x, 21, 0, "orange");
                ctx.globalAlpha = 1;
                if (type === "songs" && isSelected) ctx.drawImage(Y.getImage("play_icon"), 1, 8);
            } else {
                let textY = 11, textX = 12;
                if (item.icon) {
                    if (typeof item.icon === "string") {
                        Y.loadImage(item.icon, img => {
                            item.icon = img;
                            listbox.clearCache();
                            listbox.refresh();
                        });
                    } else {
                        ctx.drawImage(item.icon, 3, 2);
                    }
                    textX = 32;
                }
                if (item.info) { textY = 6; Font.small.write(ctx, item.info, textX, 20, 0); }
                const font = item.sub ? Font.med : Font.big;
                font.write(ctx, text, textX, textY, 0);
            }
            ctx.drawImage(line, 0, 30, listbox.width - 2, 2);
        };

        listbox.setItems([{label: "Loading ...", index: 0}]);
        listbox.onClick = () => {
            const item = listbox.getItemAtPosition(listbox.eventX, listbox.eventY);
            if (item) {
                const index = item.listIndex;
                if (item !== listbox.getSelectedIndex()) listbox.setSelectedIndex(index);
                if (item.url) {
                    if (type === "samples") {
                        Tracker.load(item.url);
                    } else if (typeof item.index === "number" && type === "songs") {
                        Playlist.play(item.index);
                    } else {
                        Tracker.load(Editor.unpackUrl(item.url), false, () => {
                            Tracker.autoPlay = false;
                            this._tabPanel.setTab(0);
                        });
                    }
                } else {
                    if (type === "samples" && item.data && item.data.children) {
                        item.data.isExpanded = !item.data.isExpanded;
                        if (item.data.url && item.data.isExpanded && !item.data.children.length) {
                            FetchService.json(item.data.url, data => {
                                if (data && data.samples) {
                                    item.data.children = data.samples;
                                    this._refreshSampleList();
                                }
                            });
                        } else {
                            this._refreshSampleList();
                        }
                    }
                }
            }
        };

        const panel = new Panel(0, 0, 20, 20);
        panel.name   = "songPanel";
        panel.zIndex = 100;
        panel.onResize = () => {
            let listTop = 0;
            if (type === "samples") {
                this._sampleSearchBox.setDimensions({left: 0, top: 0, width: panel.width, height: 20});
                this._sampleSearchBox.placeholder = "Search";
                listTop = 22;
            }
            listbox.setDimensions({left: 0, top: listTop, width: panel.width, height: panel.height - listTop - 8});
        };
        this.addChild(panel);

        if (type === "samples") {
            this._sampleSearchBox.onChange = value => {
                this._sampleSearchText = value;
                this._refreshSampleList();
            };
            panel.addChild(this._sampleSearchBox);
        }
        panel.addChild(listbox);

        if (type === "playlists") {
            panel.onShow = () => {
                const items = listbox.getItems();
                if (items.length === 1) {
                    FetchService.json("playlists/main.json", data => {
                        listbox.setItems(this._generateListBoxItems(data));
                    });
                }
            };
        }
        if (type === "samples") {
            panel.onShow = () => {
                const items = listbox.getItems();
                if (items.length === 1) {
                    if (this._sampleList.length) {
                        this._refreshSampleList();
                    } else {
                        FetchService.json("data/samples.full.json", data => {
                            if (data) {
                                this._sampleList = this._groupSamplesByType(data.samples || data);
                                this._refreshSampleList();
                            }
                        });
                    }
                }
            };
        }

        return panel;
    }

    _generateSongControls() {
        const controls = new Panel(0, 0, 20, 68);

        const buttons = [
            ["iprev",    COMMAND.playPrevious,   "Play Previous song in playlist"],
            ["iplay",    COMMAND.play,            "Toggle Play [Enter]"],
            ["inext",    COMMAND.playNext,        "Play Next song in playlist"],
            ["ishuffle", COMMAND.toggleShuffle,   "Toggle Shuffle", true]
        ];

        const buttons2 = [
            ["Mod",      COMMAND.randomSong,      "Play a random MOD song"],
            ["XM",       COMMAND.randomSongXM,    "Play a random XM song"],
            ["PlayList", COMMAND.randomPlayList,  "Generate a random playlist"]
        ];

        let x = 10;
        buttons.forEach(item => {
            const isCheckbox = item[3];
            let width = 18;
            let button;
            if (isCheckbox) {
                button = new Checkboxbutton({checkbox: true, transparent: true, paddingLeft: 10});
                width  = 50;
            } else {
                button = new Button(x, 0, 18, 18);
            }
            button.image       = Y.getImage(item[0]);
            button.hoverImage  = Y.getImage(item[0] + "_active");
            button.opacity     = 0.7;
            button.hoverOpacity = 1;
            button.left        = x;
            button.top         = 2;
            button.setSize(width, button.height);
            button.onClick     = () => { App.doCommand(item[1]); };
            button.tooltip     = item[2] || "Play";
            controls.addChild(button);
            item.push(button);
            x += 20;
        });

        const line  = new UIImage(0, 22, 10, 2, "line_hor");
        controls.addChild(line);

        const label = new Label(0, 30, 20, 20);
        label.label     = "Play Random";
        label.font      = Font.small;
        label.textAlign = "center";
        controls.addChild(label);

        buttons2.forEach(item => {
            const button = Assets.generate("buttonDarkBlue");
            button.label     = item[0];
            button.font      = Font.small;
            button.paddingTop = 1;
            button.textAlign = "center";
            button.onClick   = () => { App.doCommand(item[1]); };
            button.tooltip   = item[2];
            controls.addChild(button);
            item.push(button);
        });

        controls.on(EVENT.playingChange, isPlaying => {
            const button = controls.children[1];
            if (isPlaying) {
                button.image      = Y.getImage("istop");
                button.hoverImage = Y.getImage("istop_active");
            } else {
                button.image      = Y.getImage("iplay");
                button.hoverImage = Y.getImage("iplay_active");
            }
        });

        controls.onResize = () => {
            const w = Math.floor((controls.width - 10) / 3);
            buttons.forEach((item, index) => {
                const button = item[item.length - 1];
                const margin = Math.floor((controls.width - (18 * 3 + 50)) / 5);
                button.left  = margin * (index + 1) + 18 * index;
            });
            buttons2.forEach((item, index) => {
                const b = item[3];
                b.left   = w * index + 5;
                b.top    = 40;
                b.setSize(w, b.height);
            });
            line.setSize(controls.width, 2);
            label.setSize(controls.width, 10);
        };

        return controls;
    }

    _renderSampleItem(ctx, item, line, width) {
        let textX = 4 + (item.level * 10);
        const font = Font.ft;
        let text   = item.label;

        if (item.icon) { ctx.drawImage(item.icon, textX, 0, 16, 16); textX += 19; }

        if (item.info) {
            const infoWidth = font.getTextWidth(item.info, 0) + 12;
            Font.small.write(ctx, item.info, width - infoWidth, 5, 0);
            text = text.substr(0, Math.floor((width - infoWidth - textX - 8) / 6));
        }

        font.write(ctx, text, textX, 2, 0);
        ctx.drawImage(line, 0, 18, width - 2, 2);
    }

    _refreshSampleList() {
        this._sampleListBox.setItems(this._generateSampleListBoxItems(this._sampleList, this._sampleSearchText));
        this._sampleListBox.setSelectedIndex(0, true);
    }

    _groupSamplesByType(data) {
        const groups = {};
        const result = [];
        data.forEach(item => {
            const type = item.type || "other";
            if (!groups[type]) {
                groups[type] = {title: this._firstLetterToUpperCase(type), icon: "disk", children: [], isExpanded: false};
                result.push(groups[type]);
            }
            groups[type].children.push(item);
        });
        result.sort((a, b) => a.title.localeCompare(b.title));
        result.forEach(group => {
            group.info = group.children.length + "";
            group.children.sort((a, b) => a.title.localeCompare(b.title));
        });
        return result;
    }

    _firstLetterToUpperCase(value) {
        return value.substr(0, 1).toUpperCase() + value.substr(1);
    }

    _generateListBoxItems(data) {
        const items = [];
        let level   = 0;
        if (data.title) {
            items.push({label: data.title, listIndex: 0, info: data.info, icon: data.icon});
            level++;
        }
        data.modules.forEach((item, index) => {
            if (item.url) {
                let icon = Y.getImage("mod");
                if (item.url.endsWith(".xm")) icon = Y.getImage("xm");
                if (item.icon) icon = item.icon;

                let info = item.info, info2, icon2, infoExtra;
                if (item.author) { info = item.author; info2 = item.info; }
                if (item.group)  infoExtra = item.group;
                if (info2) {
                    if (info2.startsWith("1st")) icon2 = Y.getImage("gold");
                    if (info2.startsWith("2nd")) icon2 = Y.getImage("silver");
                    if (info2.startsWith("3rd")) icon2 = Y.getImage("bronze");
                }
                items.push({label: item.title, info, info2, icon2, infoExtra, url: item.url, icon, level, index, listIndex: index + level});
            } else {
                items.push({label: item.title, icon: item.icon, sub: true});
            }
        });
        return items;
    }

    _generateSampleListBoxItems(data, searchText) {
        const items = [];
        const query = searchText ? searchText.toLowerCase() : "";

        const addItems = (source, level) => {
            source.forEach(item => {
                const hasChildren = !!item.children;
                let children      = item.children;
                if (query && children) {
                    children = children.filter(c => c.title && c.title.toLowerCase().indexOf(query) >= 0);
                    if (!children.length) return;
                }
                const icon      = hasChildren ? Y.getImage("disk") : Y.getImage(item.icon || "sample");
                const listItem  = {
                    label:    item.title,
                    info:     query && children ? children.length + "" : item.info,
                    url:      hasChildren ? undefined : item.url,
                    icon,
                    level,
                    data:     item,
                    listIndex: items.length
                };
                items.push(listItem);
                if (hasChildren && (item.isExpanded || query) && children.length) {
                    addItems(children, level + 1);
                }
            });
        };

        addItems(data, 0);
        return items;
    }
}
