UI.button = function(x,y,w,h,text){
    var me = UI.element(x,y,w,h);
    me.type = "button";
    me.isActive = false;

    var label = text || "";
    var image;
    var backgroundImage;
    var background;
    var activeBackground;
    var hoverBackground;
    var activeImage;
    var hoverImage;
    var font;
    var textAlign = "left";
    var paddingTop = 0;
    var paddingTopActive = 0;
    var paddingLeft = 10;
    var hasHover = true;

    var properties = ["left","top","width","height","name","type","image","backgroundImage","background","active","hoverBackground","hoverImage","activeBackground","activeImage","font","label","textAlign","paddingTop","paddingTopActive","paddingLeft","checkbox","radio"];

    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] != "undefined"){
                // set internal var
                switch(key){
                    case "label": label=p[key];break;
                    case "font": font=p[key];break;
                    case "textAlign": textAlign=p[key];break;
                    case "paddingTop": paddingTop=parseInt(p[key]);break;
                    case "paddingTopActive": paddingTopActive=parseInt(p[key]);break;
                    case "paddingLeft": paddingLeft=parseInt(p[key]);break;
                    case "image": image=p[key];break;
                    case "backgroundImage": backgroundImage=p[key];break;
                    case "activeImage": activeImage=p[key];break;
                    case "hoverImage": 
                        hoverImage=p[key];
                        hasHover = true;
                        break;
                    case "background":
                        if (p[key].img){ // scale9
                            backgroundImage = undefined;
                            background = UI.scale9Panel(0,0,0,0,p[key]);
                            background.setParent(me);
                        }
                        break;
                    case "activeBackground":
                        if (p[key].img){ // scale9
                            activeBackground = UI.scale9Panel(0,0,0,0,p[key]);
                            activeBackground.setParent(me);
                        }
                        break;
                    case "hoverBackground":
                        if (p[key].img){ // scale9
                            hoverBackground = UI.scale9Panel(0,0,0,0,p[key]);
                            hoverBackground.setParent(me);
                        }
                        hasHover = true;
                        break;
                    default:
                        me[key] = p[key];
                }
            }
        });

        if (background) background.setSize(me.width,me.height);
        if (activeBackground) activeBackground.setSize(me.width,me.height);
        if (hoverBackground) hoverBackground.setSize(me.width,me.height);
        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

        if (p.labels){
            me.onResize = function(){
                var currentLabel = label;
                p.labels.forEach(function(item){
                    if (me.width>=item.width) label=item.label;
                });
                if (currentLabel !== label) me.refresh();
            };
        }

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
        me.isActive = !!state;
        me.refresh();
    };

	me.setDisabled = function(state){
		if (typeof state == "undefined") state=true;
		me.isDisabled = state;
		if (state) me.isActive = false;
		me.refresh();
	};


    me.onHover = function(data){
        if (hasHover){
            if (!me.isActive){
                me.isHover = true;
                me.refresh();
            }
        }
    };

    me.onHoverExit = function(){
        if (hasHover && me.isHover){
            me.isHover = false;
            me.refresh();
        }
    };

    me.render = function(internal){
        if (!me.isVisible()) return;
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
                    var stateImage = image;
                    if (me.isHover && hoverImage){
                        stateImage =  hoverImage;
                    }
                    if (me.isHover && hoverBackground){
                        hoverBackground.render();
                    }else{
                        background.render();
                    }
                    if (stateImage){
                        var imgY = Math.floor((me.height-stateImage.height)/2);
                        var imgX = Math.floor((me.width-stateImage.width)/2);
                        me.ctx.drawImage(stateImage,imgX,imgY);
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
                var textY = Math.floor((me.height-fontSize)/2) + (me.isActive?paddingTopActive:paddingTop);
                var textX = paddingLeft;
                if (font){
                    if (textAlign === "center"){
                        var textLength = label.length * fontWidth;
                        if (!font.fixedWidth) textLength = font.getTextWidth(label,0);
                        textX = Math.floor((me.width - textLength)/2);
                    }
                    if (textAlign === "right"){
                        textLength = label.length * fontWidth;
						if (!font.fixedWidth) textLength = font.getTextWidth(label,0);
                        textX = me.width - textLength - 5;
                    }
                    font.write(me.ctx,label,textX,textY,0);
                }else{
                    me.ctx.fillStyle = "white";
                    me.ctx.fillText(label,textX,textY);
                }
            }

            if (me.isDisabled){
				me.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
				me.ctx.fillRect(0,0,me.width,me.height);
            }

			if (me.renderInternal) me.renderInternal();
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