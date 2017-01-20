UI.button = function(x,y,w,h,text){
    var me = UI.element(x,y,w,h);
    me.type = "button";
    me.isActive = false;

    var label = text || "";
    var image;
    var backgroundImage;
    var background;
    var activeBackground;
    var activeImage;
    var font;
    var textAlign = "left";
    var paddingTop = 0;

    var properties = ["left","top","width","height","name","type","image","backgroundImage","background","active","activeBackground","activeImage","font","label","textAlign","paddingTop"];

    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined"){
                // set internal var
                switch(key){
                    case "label": label=p[key];break;
                    case "font": font=p[key];break;
                    case "textAlign": textAlign=p[key];break;
                    case "paddingTop": paddingTop=parseInt(p[key]);break;
                    case "image": image=p[key];break;
                    case "backgroundImage": backgroundImage=p[key];break;
                    case "activeImage": activeImage=p[key];break;
                    case "background":
                        if (p[key].img){ // scale9
                            backgroundImage = undefined;
                            background = UI.scale9Panel(0,0,0,0,p[key]);
                            background.setParent(me);
                        }
                        break;
                    case "activeBackground":
                        if (p[key].img){ // scale9
                            backgroundImage = undefined;
                            activeBackground = UI.scale9Panel(0,0,0,0,p[key]);
                            activeBackground.setParent(me);
                        }
                        break;
                    default:
                        me[key] = p[key];
                }
            }
        });

        if (background) background.setSize(me.width,me.height);
        if (activeBackground) activeBackground.setSize(me.width,me.height);
        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

    };

    me.setBackgroundImage = function(img){
        backgroundImage = img;
        me.refresh();
    };

    me.setFont = function(f){
        font = f;
        me.refresh();
    };

    me.setLabel = function(text){
        label = text;
        me.refresh();
    };

    me.toggleActive = function(){
        me.isActive = !me.isActive;
        me.refresh();
    };

    me.setActive = function(state){
        if (typeof state == "undefined") state=true;
        me.isActive = state;
        me.refresh();
    };

    me.render = function(internal){
        if (me.needsRendering){
            internal = !!internal;
            var drawFonts = true;
            //me.ctx.clearRect(0,0,me.width,me.height,backgroundImage);

            if (backgroundImage){
                me.ctx.drawImage(backgroundImage,0,0,me.width,me.height);
            }else if (background) {
                if (me.isActive && activeBackground){
                    activeBackground.render();
                    if (activeImage){
                        var imgY = Math.floor((me.height-activeImage.height)/2);
                        var imgX = Math.floor((me.width-activeImage.width)/2);
                        me.ctx.drawImage(activeImage,imgX,imgY);
                        //drawFonts = false;
                    }
                }else{
                    background.render();
                    if (image){
                        var imgY = Math.floor((me.height-image.height)/2);
                        var imgX = Math.floor((me.width-image.width)/2);
                        me.ctx.drawImage(image,imgX,imgY);
                        //drawFonts = false;
                    }
                }

            }else{
                me.ctx.fillStyle = "grey";
                me.ctx.fillRect(0,0,me.width,me.height);
                me.ctx.fillStyle = "black";
                me.ctx.rect(0,0,me.width,me.height);
                me.ctx.stroke();
            }

            if (label && drawFonts){
                var fontSize = 10;
                var fontWidth = 8; // TODO: get from font
                var textY = Math.floor((me.height-fontSize)/2) + paddingTop;
                var textX = 10;
                if (font){
                    if (textAlign == "center"){
                        var textLength = label.length * fontWidth;
                        textX = Math.floor((me.width - textLength)/2);
                    }
                    font.write(me.ctx,label,textX,textY,0);
                }else{
                    me.ctx.fillStyle = "white";
                    me.ctx.fillText(label,textX,textY);
                }
            }

        }
        me.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }
    };

    return me;
};