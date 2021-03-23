UI.modalDialog = function(initialProperties){
    var me = UI.element();
    var text = "";
    var inputBox;
    var properties = ["left","top","width","height","name","ok","cancel","input"];

    me.setProperties = function(p){

        properties.forEach(function(key){
            if (typeof p[key] !== "undefined") me[key] = p[key];
        });

        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

        var panelHeight = 200;
        if (me.height<panelHeight) panelHeight = me.height - 20;

        var panelWidth = Math.max(Math.floor(me.width/2),380);

        background.setSize(panelWidth,panelHeight);
        background.setPosition(Math.floor((me.width-panelWidth)/2),Math.floor((me.height-panelHeight)/2));

        if (me.cancel){
            okButton.setPosition(background.left + Math.floor(background.width/2) - 110,background.top + background.height - 40);
            cancelButton.setPosition(background.left + Math.floor(background.width/2) + 10,background.top + background.height - 40);
        }else{
            okButton.setPosition(background.left + Math.floor(background.width/2) - 50,background.top + background.height - 40);
        }

        if (me.input){
            if (!inputBox){
                inputBox = UI.inputbox({
                    name: "dialoginput",
                    width: 200,
                    height: 28,
                    value: "",
                    onChange:function(){
                        me.inputValue = inputBox.getValue();
                    },
                    onSubmit:function(value){
                        me.inputValue = value;
                        me.onKeyDown(13);
                    }
                });
                me.addChild(inputBox);
                setTimeout(function(){
                    inputBox.activate();
                },0);
            }
            inputBox.setProperties({
                left: background.left + 50,
                top: background.top + background.height - 80,
                width: background.width-100,
                height: 28
            })

        }

    };

    var background = UI.scale9Panel(0,0,Math.floor(me.width/2),200,UI.Assets.panelMainScale9);

    background.ignoreEvents = true;
    me.addChild(background);

    var okButton = UI.Assets.generate("buttonLight");
    okButton.setProperties({
        name: "okbutton",
        label: "OK",
        width: 100,
        height: 28
    });
    me.addChild(okButton);

    var cancelButton = UI.Assets.generate("buttonLight");
    cancelButton.setProperties({
        name: "cancelbutton",
        label: "Cancel",
        width: 100,
        height: 28
    });
    me.addChild(cancelButton);


    // will be overriden if other functionality needed
    me.onKeyDown = function(keyCode){
        switch (keyCode){
            case 13:
                me.close();
                return true;
        }
    }

    me.render = function(internal){
        internal = !!internal;
        if (this.needsRendering){

            me.clearCanvas();
            me.ctx.fillStyle = "rgba(0,0,0,0.6)";
            me.ctx.fillRect(0,0,me.width,me.height);

            background.render();

            if (text){
                var lines = text.split("/");
                var textY = background.top + 20;
                var textX = background.left + 10;

                var maxWidth = background.width - 20;

                lines.forEach(function(line){
                    var textX = 10;
                    if (fontFT){
                        var textLength = fontFT.getTextWidth(line,0);
                        textX = background.left + 10 + Math.floor((maxWidth - textLength)/2);
                        fontFT.write(me.ctx,line,textX,textY,0);
                    }
                    textY += 12;
                });
            }

            if (me.ok) okButton.render();
            if (me.cancel) cancelButton.render();

            if (inputBox){
                inputBox.render();
            }

        }
        this.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }

    };

    me.setText = function(newText){
        text = newText;
    };

    me.getText= function(){
        return text;
    };

    me.close = function(){
        me.hide();
        if (me.onClose) me.onClose();
        UI.removeModalElement();
        delete me;
    };

    return me;
};