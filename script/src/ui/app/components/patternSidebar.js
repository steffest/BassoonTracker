UI.pattern_sidebar = function(){
    var me = UI.panel();
    me.setProperties({
        name: "sideButtonPanel"
    });

    var sideLabel = UI.label();
    sideLabel.setProperties({
        label: "DEMOSONGS:",
        font: fontFT
    });
    me.addChild(sideLabel);
    

    var buttonsSide = [];
    var buttonsSideInfo=[
        {label:"Demomusic", onClick:function(){Tracker.load(Host.getRemoteUrl() + 'demomods/demomusic.mod')}},
        {label:"Stardust", onClick:function(){Tracker.load(Host.getRemoteUrl() + 'demomods/StardustMemories.mod')}},
        {label:"Space Debris", onClick:function(){Tracker.load(Host.getRemoteUrl() + 'demomods/spacedeb.mod')}},
        {label:"Tinytune", onClick:function(){Tracker.load(Host.getRemoteUrl() + 'demomods/Tinytune.mod')}},
        {label:"Lotus 2", onClick:function(){Tracker.load(Host.getRemoteUrl() + 'demomods/lotus20.mod')}},
        //{label:"Lotus 1", onClick:function(){Tracker.load('demomods/lotus10.mod')}},
        {label:"Professionaltracker", onClick:function(){Tracker.load(Host.getRemoteUrl() + 'demomods/hoffman_and_daytripper_-_professional_tracker.mod')}},
        //{label:"Monday", onClick:function(){Tracker.load('demomods/Monday.mod')}},
        //{label:"Lunatic", onClick:function(){Tracker.load('demomods/sound-of-da-lunatic.mod')}},
        {label:"XM: Ambrozia", onClick:function(){Tracker.load(Host.getRemoteUrl() + 'demomods/Ambrozia.xm')}},
        {label:"8CHN: AceMan", onClick:function(){Tracker.load(Host.getRemoteUrl() + 'demomods/AceMan.mod')}},
        //{label:"28CHN: Dope", onClick:function(){Tracker.load('demomods/dope.mod')}},
        //{label:"Exodus baum", onClick:function(){Tracker.load('demomods/exodus-baum_load.mod')}},
        //{label:"Drum", onClick:function(){Tracker.load('demomods/drum.mod')}},
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
        me.addChild(buttonElm);
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
        sideLabel.setSize(me.width,Layout.trackControlHeight);

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

        for (i = 0;i<buttonsSideInfo.length;i++){
            var button = buttonsSide[i];
            var buttonTop = (i*buttonHeight) + sideLabel.height;
            var buttonLeft = 0;
            if (buttonTop > nibblesButton.top-buttonHeight){
                buttonLeft = -500;
            }
            button.setProperties({
                left:buttonLeft,
                top: buttonTop,
                width: me.width,
                height:buttonHeight,
                label: button.info.label,
                textAlign:"left",
                background: UI.Assets.buttonLightScale9,
                hoverBackground: UI.Assets.buttonLightHoverScale9,
                font:window.fontFT
            });
        }
    };

    me.onResize();

    return me;
};