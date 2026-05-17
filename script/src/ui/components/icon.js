import Y from "../yascal/yascal.js";

class Icon {
    get(item, size) {
        if (!item) return;
        if (item.generatedIcon) return item.generatedIcon;
        size = size || 30;

        let overlay = Y.getImage("modbig");
        const ext = item.url ? item.url.split(".").pop().toLowerCase() : "";
        if (ext === "xm") overlay = Y.getImage("xmbig");
        if (item.icon) overlay = Y.getImage(item.icon) || overlay;

        item.generatedIcon = document.createElement("canvas");
        item.generatedIcon.width = size;
        item.generatedIcon.height = size;
        const ctx = item.generatedIcon.getContext("2d");

        ctx.fillStyle = this._randomColor(0.4);
        ctx.fillRect(5, 5, 20, 20);

        ctx.fillStyle = this._randomColor(0.4);
        const path = new Path2D();
        path.moveTo(5, 25);
        if (Math.random() < 0.5) {
            path.lineTo(25, 5);
        } else {
            path.lineTo(5, 5);
        }
        path.lineTo(25, 25);
        ctx.fill(path);
        ctx.drawImage(overlay, 0, 0, size, size);

        return item.generatedIcon;
    }

    _randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    _randomColor(alpha = 1) {
        const h = this._randomInt(0, 360);
        const s = this._randomInt(42, 98);
        const l = this._randomInt(40, 90);
        return `hsla(${h},${s}%,${l}%,${alpha})`;
    }
}

export default new Icon();
