import UI from "../ui.js";
import EventBus from "../../eventBus.js";

export default class UIElement {
    _left;
    _top;
    _width;
    _height;
    _opacity;
    _visible = true;
    _eventHandlers = [];

    constructor(left = 0, top = 0, width = 20, height = 20) {
        this._left   = left  || 0;
        this._top    = top   || 0;
        this._width  = Math.max(width  || 20, 1);
        this._height = Math.max(height || 20, 1);

        this.canvas = document.createElement("canvas");
        this.canvas.width  = this._width;
        this.canvas.height = this._height;
        this.ctx = this.canvas.getContext("2d");

        this.children       = [];
        this.needsRendering = true;
        this.parentCtx      = UI.getContext();
    }

    // --- position / size ---

    get left()  { return this._left; }
    set left(v) { this._left = v; this.parent?.refresh(); }

    get top()   { return this._top; }
    set top(v)  { this._top = v; this.parent?.refresh(); }

    get width()  { return this._width; }
    set width(v) {
        this._width = Math.max(v, 1);
        this.canvas.width = this._width;
        if (this.onResize) this.onResize();
        this.refresh();
    }

    get opacity()  { return this._opacity; }
    set opacity(v) {
        this._opacity = v;
        this.parent?.refresh()
    }

    get height()  { return this._height; }
    set height(v) {
        this._height = Math.max(v, 1);
        this.canvas.height = this._height;
        if (this.onResize) this.onResize();
        this.refresh();
    }

    // --- visibility ---

    get visible()  { return this._visible; }
    set visible(v) { this._visible = v; }

    // Compatibility aliases used by legacy property maps.
    get active() { return this.isActive; }
    set active(v) { this.isActive = v; }

    get disabled() { return this.isDisabled; }
    set disabled(v) { this.isDisabled = v; }

    // --- visibility helpers ---

    hide() {
        this._visible = false;
        if (this.onHide) this.onHide();
    }

    show(andRefresh, andRefreshAllChildren) {
        this._visible = true;
        if (andRefresh) this.refresh(andRefreshAllChildren);
        if (this.onShow) this.onShow();
    }

    toggle(state) {
        if (typeof state === "boolean") {
            if (state) { this.show(); } else { this.hide(); }
        } else {
            if (this._visible) { this.hide(); } else { this.show(); }
        }
    }

    isVisible() {
        let result = this._visible;
        let parent = this.parent;
        while (result && parent) {
            result = parent.visible;
            parent = parent.parent;
        }
        return result;
    }

    // --- hierarchy ---

    setParent(parentElement) {
        this.parent = parentElement;
        if (parentElement) this.parentCtx = parentElement.ctx;
    }

    addChild(elm) {
        elm.setParent(this);
        elm.zIndex = elm.zIndex || this.children.length;
        this.children.push(elm);
    }

    getChild(name) {
        let i = this.children.length;
        while (i) {
            const child = this.children[i];
            if (child && child.name && child.name === name) return child;
            i--;
        }
    }

    // --- events ---
    on(event, listener) {
        if (!event || typeof listener !== "function") return;
        this._eventHandlers.push([event, EventBus.on(event, listener)]);
    }

    off (event,index){
        EventBus.off(event,index);
    }



    // --- layout ---

    setSize(w, h) {
        this._width  = Math.max(w, 1);
        this._height = Math.max(h, 1);
        this.canvas.width  = this._width;
        this.canvas.height = this._height;
        if (this.onResize) this.onResize();
        this.refresh();
    }

    setPosition(x, y) {
        this._left = x;
        this._top  = y;
        this.refresh();
    }


    setDimensions(properties) {
        const visible = (typeof properties.visible === "boolean") ? properties.visible : true;
        if (!visible) return;

        const left = properties.left !== undefined ? properties.left : this._left;
        const top = properties.top !== undefined ? properties.top : this._top;
        const width = properties.width !== undefined ? properties.width : this._width;
        const height = properties.height !== undefined ? properties.height : this._height;

        if (properties.left !== undefined || properties.top !== undefined) this.setPosition(left, top);
        if (properties.width !== undefined || properties.height !== undefined) this.setSize(width, height);
        if (properties.visible !== undefined) this.visible = !!properties.visible;
    }

    setActive(v)   { this.isActive   = v; }

    // --- rendering ---

    refresh(refreshChildren) {
        this.needsRendering = true;
        if (refreshChildren) {
            let i = this.children.length;
            while (i) {
                const child = this.children[i];
                if (child) child.refresh();
                i--;
            }
        }
        if (this.visible && this.parent && this.parent.refresh && !this.parent.needsRendering) this.parent.refresh();
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this._width, this._height);
    }

    // --- hit testing ---

    containsPoint(x, y) {
        return x >= this._left && x <= this._left + this._width &&
               y >= this._top  && y <= this._top  + this._height;
    }

    getElementAtPoint(_x, _y) {
        _x -= (this._left + (this.scrollOffsetX || 0));
        _y -= (this._top  + (this.scrollOffsetY || 0));

        if (this.scaleX) _x /= this.scaleX;
        if (this.scaleY) _y /= this.scaleY;

        let currentEventTarget;
        for (let i = this.children.length - 1; i >= 0; i--) {
            const elm = this.children[i];
            if (elm.isVisible() && !elm.ignoreEvents && elm.containsPoint(_x, _y)) {
                currentEventTarget = elm;
                break;
            }
        }

        if (currentEventTarget) {
            const child = currentEventTarget.getElementAtPoint(_x, _y);
            if (child) {
                currentEventTarget = child;
            } else {
                currentEventTarget.eventX = _x;
                currentEventTarget.eventY = _y;
            }
        } else {
            currentEventTarget = this;
            currentEventTarget.eventX = _x;
            currentEventTarget.eventY = _y;
        }

        return currentEventTarget;
    }

    // --- lifecycle ---

    destroy() {
        this._eventHandlers.forEach(([evt, idx]) => EventBus.off(evt, idx));
        this._eventHandlers = [];

        this.canvas.width = 0;
        this.canvas.height = 0;
        this.ctx = null
        this.canvas = null;
    }
}
