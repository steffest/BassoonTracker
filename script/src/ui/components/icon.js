UI.Icon = function(){
    var me = {};

    me.get = function(item,size){
        if (!item) return;
        if (item.generatedIcon) return item.generatedIcon;
        size = size || 30;

        var overlay = Y.getImage("modbig");
        var ext = item.url?item.url.split(".").pop().toLowerCase():"";
        if (ext === "xm") overlay = Y.getImage("xmbig");

        item.generatedIcon = document.createElement("canvas");
        item.generatedIcon.width = size;
        item.generatedIcon.height = size;
        var ctx = item.generatedIcon.getContext("2d");

        ctx.fillStyle = randomColor(0.4);
        ctx.fillRect(5,5,20,20);

        ctx.fillStyle = randomColor(0.4);
        var path=new Path2D();
        path.moveTo(5,25);
        if (Math.random()<0.5){
            path.lineTo(25,5);
        }else{
            path.lineTo(5,5);
        }
        path.lineTo(25,25);
        ctx.fill(path);
        ctx.drawImage(overlay,0,0,size,size);

        return item.generatedIcon;
    }

    function randomInt(min, max){
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomColor(alpha){
        alpha = alpha || 1;
        var h = randomInt(0, 360);
        var s = randomInt(42, 98);
        var l = randomInt(40, 90);
        return "hsla(" + h + "," + s + "%," + l + "%," + alpha + ")";
    }

    return me;
}();

