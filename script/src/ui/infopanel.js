import UIElement from "./components/element.js";
import Assets from "./assets.js";
import Layout from "./app/layout.js";
import EventBus from "../eventBus.js";
import {EVENT} from "../enum.js";
import Animsprite from "./components/animsprite.js";
import Y from "./yascal/yascal.js";
import Button from "./components/button.js";
import Tracker from "../tracker.js";
import Favorites from "../models/favorites.js";

let InfoPanel = function(){

    var me = UIElement();
    var text = "";
    var source = "";
    var status = "";
    var moreInfoUrl;
    let canFavorite = false;

    var infoButton = Assets.generate("buttonDark");
    infoButton.setLabel("More info ");
    infoButton.onClick = function(){
        if (moreInfoUrl) window.open(moreInfoUrl);
    };
    me.addChild(infoButton);

    var fav = Button(400,6,20,20);
    fav.setProperties({
        image: Y.getImage("heart"),
        activeImage: Y.getImage("heart_active"),
        opacity: 0.4,
        hoverOpacity: 1
    });
    fav.onClick = function(){
        EventBus.trigger(EVENT.toggleFavorite);
    };
    me.addChild(fav);


    var spinner = Animsprite(5,7,20,18,"boing",11);
    me.addChild(spinner);
    spinner.hide();

    function setFavorite(){
        let url = Tracker.getCurrentUrl();
        canFavorite = !!url;
        if (canFavorite){
            let isFavorite = Favorites.isFavorite(url);
            fav.setActive(isFavorite);
            fav.tooltip = isFavorite ? "Remove from favorites" : "Add to favorites";
        }
        me.setLayout();
    }

    EventBus.on(EVENT.statusChange,function(context){
        if (context){
            if (typeof context.status !== "undefined") status = context.status;
            if (typeof context.info !== "undefined"){
                text = context.info;
                source = context.source;
                moreInfoUrl = context.url;
                me.setLayout();
            }
            if (typeof context.showSpinner !== "undefined"){
                spinner.toggle(!!context.showSpinner)
            }
        }
        me.refresh();
    });

    EventBus.on(EVENT.songLoaded,setFavorite);
    EventBus.on(EVENT.favoritesUpdated,setFavorite);


    var properties = ["left","top","width","height","name","type","zIndex"];
    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] !== "undefined") me[key] = p[key];
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

        if (me.setLayout) me.setLayout(me.left,me.top,me.width, me.height);
    };

    me.setLayout = function(){

        var width = Layout.col1W;
        var label = "More Info";
        if (width<100) label = "info";
        if (width<45) label = "i";

        infoButton.setProperties({
            width: Layout.col1W,
            height: 24,
            top: 2,
            left:Layout.col5X - 2 - me.left,
            label: label,
            font: fontFT
        });

        fav.setProperties({
            left: moreInfoUrl ? Layout.col5X- me.left - 22 : Layout.col5W - me.left - 22,
        });

    };


    me.render = function(internal){
        if (!me.isVisible()) return;

        internal = !!internal;

        if (this.needsRendering){
            me.clearCanvas();

            if (moreInfoUrl) infoButton.render();
            if (canFavorite) fav.render();

            var fText = text;
            if (status) fText = status + ": " + fText;

            var textX = 6;
            if (spinner.isVisible()){
                spinner.render();
                textX += 20;
            }else{
                if (fText.startsWith("Error")){
                    me.ctx.drawImage(Y.getImage("alert"),4,8);
                    textX += 20;
                }
            }

            window.fontFT.write(me.ctx,fText,textX,11,0);



        }

        this.needsRendering = false;
        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }

    };

    return me;

};

export default InfoPanel;

