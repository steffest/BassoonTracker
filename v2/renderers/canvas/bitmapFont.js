// Adapted from script/src/ui/components/bitmapfont.js (MIT, BassoonTracker).
// Trimmed to the subset v2 needs: generate a glyph atlas from a sprite sheet
// and blit pre-rendered glyph canvases (no fillText anywhere, per AGENTS.md).

export default class BitmapFont {
    _charWidth;
    _widthArray = [];
    _charHeight;
    _charSpacing;
    _spaceWidth;
    _onlyUpperCase = false;

    fixedWidth;
    charWidth;
    charHeight;
    fontArray;
    colors = {};

    _getCharWidth(index) {
        if (this.fixedWidth) return this._charWidth;
        return this._charWidth[index];
    }

    generate(config) {
        const img = config.image;
        const startX = config.startX;
        const startY = config.startY;
        this._charWidth = config.charWidth;
        const h = config.charHeight;
        this._spaceWidth = config.spaceWidth || 8;
        const margin = config.margin || 0;
        const lineSpacing = config.lineSpacing || 0;
        const lineWidth = config.charsPerLine;
        const chars = config.chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        this._onlyUpperCase = !!config.onlyUpperCase;

        this.fontArray = [];
        this.colors = {};
        this._charSpacing = margin;
        this._charHeight = h;
        this.charHeight = h;
        this.fixedWidth = true;

        if (typeof this._charWidth !== "number") {
            this.fixedWidth = false;
            if (typeof this._charWidth === "string") {
                this._charWidth = this._charWidth.split("").map(c => parseInt(c, 10));
            }
        }
        this.charWidth = this._charWidth;

        let _x = startX, _y = startY, _line = 0, _lineIndex = 0;

        for (let i = 0, len = chars.length; i < len; i++) {
            const w = this._getCharWidth(i) || 1;
            const myCanvas = document.createElement("canvas");
            myCanvas.width = w;
            myCanvas.height = h;
            const myCtx = myCanvas.getContext("2d");

            let x, y;
            if (this.fixedWidth) {
                x = startX + ((i % lineWidth) * (w + margin));
                y = startY + (Math.floor(i / lineWidth) * (h + lineSpacing));
            } else {
                x = _x;
                y = _y;
                _x += (w + margin);
                _lineIndex++;
                if (_lineIndex >= lineWidth[_line]) {
                    _line++;
                    _lineIndex = 0;
                    _x = startX;
                    _y += (h + lineSpacing);
                }
            }

            myCtx.drawImage(img, x, y, w, h, 0, 0, w, h);

            const charCode = chars.charCodeAt(i);
            this.fontArray[charCode] = myCanvas;
            this._widthArray[charCode] = w;
        }
    }

    // V1's bitmap fonts tint each already-extracted glyph through a
    // destination-atop fill followed by a darken pass of the original.
    // Keeping that exact operation here avoids approximating its named
    // blue/green/orange variants with canvas text or a global tint.
    generateColor(name, color) {
        const tinted = [];
        this.fontArray.forEach((glyph, index) => {
            const colored = document.createElement("canvas");
            const result = document.createElement("canvas");
            colored.width = result.width = glyph.width;
            colored.height = result.height = glyph.height;
            const colorCtx = colored.getContext("2d");
            colorCtx.fillStyle = color;
            colorCtx.fillRect(0, 0, 16, 16);
            colorCtx.globalCompositeOperation = "destination-atop";
            colorCtx.drawImage(glyph, 0, 0);
            const resultCtx = result.getContext("2d");
            resultCtx.drawImage(colored, 0, 0);
            resultCtx.globalCompositeOperation = "darken";
            resultCtx.drawImage(glyph, 0, 0);
            tinted[index] = result;
        });
        this.colors[name] = tinted;
    }

    getTextWidth(text, spacing) {
        if (!text) return 0;
        if (this._onlyUpperCase) text = text.toUpperCase();
        spacing = spacing ?? this._charSpacing;
        let w = 0;
        for (let i = 0, len = text.length; i < len; i++) {
            const code = text.charCodeAt(i);
            w += (this._widthArray[code] ?? this._spaceWidth) + spacing;
        }
        return w;
    }

    write(canvasCtx, text, x, y, spacing, color) {
        if (!text) return;
        if (this._onlyUpperCase) text = text.toUpperCase();
        spacing = spacing ?? this._charSpacing;
        x = x || 0;
        y = y || 0;
        let _x = x;
        const glyphs = this.colors[color] || this.fontArray;

        for (let i = 0, len = text.length; i < len; i++) {
            const code = text.charCodeAt(i);
            const c = glyphs[code];
            const w = this._widthArray[code];

            if (!w) {
                _x += this._spaceWidth + spacing;
                continue;
            }
            if (c) canvasCtx.drawImage(c, _x, y, w, this._charHeight);
            _x += w + spacing;
        }
    }
}
