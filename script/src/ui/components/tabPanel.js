import UIElement from "./element.js";
import Scale9Panel from "./scale9.js";
import Y from "../yascal/yascal.js";
import Button from "./button.js";
import Layout from "../app/layout.js";


let tabPanel = function(x,y,w,h,config){
    var me = UIElement(x,y,w,h);
    me.type = "tabpanel";

    let footerHeight = 10;
    let activeTabIndex = 0;
    let showFooter = true;

    // background
    let background = Scale9Panel(0,0,me.width,me.height,{
        img: Y.getImage("tab_panel"),
        left:8,
        top:9,
        right:8,
        bottom: 9
    });

    let footer = Scale9Panel(0,0,0,0,{
        img: Y.getImage("tab_panel_bottom"),
        left:10,
        top:2,
        right:10,
        bottom: 6,
    });
    me.addChild(footer);

    // tabs
    let tabButtons = [];
    let tabX = 0;
    config.tabs.forEach(function(tab){
        addTab(tab);
    });

    me.setProperties = function(p){
        var properties = ["left","top","width","height","name","type","zIndex"];

        if (!p){
            var result = {};
            properties.forEach(function(key){
                result[key] = me[key];
            });
            return result;
        }

        properties.forEach(function(key){
            if (typeof p[key] != "undefined") me[key] = p[key];
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

    };


    var createCanvas = function(){
        me.clearCanvas();
        let back = background.render(true);
        let y = Layout.trackControlHeight-2;
        me.ctx.drawImage(back,0,Layout.trackControlHeight-2);
        if (tabButtons[0] && tabButtons[0].opacity < 1){
            me.ctx.drawImage(Y.getImage("tab_panel_corner"),0,y);
        }
    }

    me.onResize = function(){
        background.setSize(me.width,me.height-Layout.trackControlHeight);
        showFooter = me.height>160;
        tabButtons.forEach(function(elm){
            if (elm.panel){
                let h = background.height;
                if (elm.footer && showFooter) h -= (footerHeight+2);
                elm.panel.setSize(background.width-2,h);
                elm.panel.setPosition(2,Layout.trackControlHeight+4);
            }
        });
        footer.setSize(me.width,footerHeight);
        footer.setPosition(0,me.height-(footerHeight+2));
        if (footer.children){
            footer.children.forEach(function(elm){
                elm.setPosition(2,2);
                elm.setSize(footer.width-4,footer.height-4);
            });
        }
        let activeButton = tabButtons[activeTabIndex];
        footer.toggle(!!(activeButton.footer && showFooter));
    }

    me.render = function(internal){
        internal = !!internal;
        if (!me.isVisible()) return;

        if (me.needsRendering){
            createCanvas();

            var activeButton;
            tabButtons.forEach(function(elm){
                if (elm.opacity === 1){
                    activeButton = elm;
                }else{
                    elm.render();
                }
            })
            if (activeButton){
                activeButton.render();
                if (activeButton.left>20){
                    me.ctx.drawImage(Y.getImage("tab_border"),activeButton.left-22,activeButton.top+activeButton.height);
                }
            }

            footer.render();

        }
        me.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top);
        }
    }

    function addTab(config){
        var tabButton = Button(tabX,12,config.width,18);
        tabButton.setProperties({
            label: config.label,
            textAlign:"left",
            background: {
                img: Y.getImage("tab"),
                left:4,
                top:4,
                right:30,
                bottom: 4
            },
            font:window.fontDark,
            paddingLeft: 10,
            paddingTop: 1,
            opacity: config.isSelected?1:0.5
        });
        tabButton.onHover = function(){
            if (tabButton.opacity<1) tabButton.setProperties({opacity:0.7});
        }
        tabButton.onHoverExit= function(){
            if (tabButton.opacity<1) tabButton.setProperties({opacity:0.5});
        }
        tabButton.onClick = function(){
            tabButtons.forEach(function(elm){
                elm.setProperties({opacity:0.5});
                if (elm.panel) elm.panel.hide();
            });
            tabButton.setProperties({opacity:1});
            if (config.panel) config.panel.show();
            activeTabIndex = tabButton.index;
            footer.toggle(!!(config.footer && showFooter));
        }
        tabButton.panel = config.panel;
        tabButton.footer = config.footer;
        tabButton.index = tabButtons.length;
        if (!config.isSelected) config.panel.hide();
        me.addChild(tabButton);
        tabButtons.push(tabButton);
        tabX += config.width-12;

        if (config.footer){
            footerHeight = config.footer.height;
            footer.addChild(config.footer);
        }
    }

    me.setTab = function(index){
        var button = tabButtons[index];
        if (button){
            button.onClick();
        }
    }

    return me;
}

export default tabPanel;