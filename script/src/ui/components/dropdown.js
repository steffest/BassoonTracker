import UIElement from "./element.js";
import Scale9Panel from "./scale9.js";
import Y from "../yascal/yascal.js";
import UI from "../ui.js";

let Dropdown = function(x, y, w, h) {
    var me = UIElement(x, y, w, h);
    me.type = "dropdown";

    var items = [];
    var selectedIndex = 0;
    var hoverIndex = 0;
    var scrollOffset = 0;
    var isOpen = false;
    var isHover = false;
    var popup = null;

    var listLeft = 0;
    var listTop = 0;
    var listWidth = 0;
    var listHeight = 0;

    var itemHeight = 22;
    var maxVisibleItems = 8;
    var arrowWidth = 18;
    var labelCharWidth = 7;

    me.label = "";
    me.labelPosition = "left";  // "left" | "right" | "none"
    me.labelWidth = 0;          // 0 = auto-compute from label length
    me.labelFont = null;        // defaults to window.fontSmall
    me.itemFont = null;         // defaults to window.fontMed

    var properties = ["left","top","width","height","name","selectedIndex","onChange","label","labelPosition","labelWidth","labelFont","itemFont","itemWidth"];

    var background = Scale9Panel(0, 0, me.width, me.height, {
        img: Y.getImage("panel_dark"),
        left: 3, top: 3, right: 2, bottom: 2
    });
    background.ignoreEvents = true;
    me.addChild(background);

    function computedLabelWidth() {
        if (!me.label || me.labelPosition === "none") return 0;
        return me.labelWidth || (me.label.length * labelCharWidth + 8);
    }

    function computedButtonWidth() {
        return me.itemWidth || (me.width - computedLabelWidth());
    }

    function updateBackground() {
        var lw = computedLabelWidth();
        var bx = (me.labelPosition === "left") ? lw : 0;
        var bw = computedButtonWidth();
        background.setSize(Math.max(bw, 1), me.height);
        background.setPosition(bx, 0);
    }

    me.setProperties = function(p) {
        properties.forEach(function(key) {
            if (typeof p[key] !== "undefined") me[key] = p[key];
        });
        if (typeof p.items !== "undefined") me.setItems(p.items);
        me.setSize(me.width, me.height);
        me.setPosition(me.left, me.top);
        updateBackground();
        me.refresh();
    };

    me.setItems = function(newItems) {
        items = newItems || [];
        selectedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1));
        if (popup) popup.clearCache();
        me.refresh();
    };

    me.getItems = function() {
        return items;
    };

    me.setSelectedIndex = function(index, silent) {
        if (!items.length) return;
        selectedIndex = Math.max(0, Math.min(index, items.length - 1));
        me.refresh();
        if (!silent && me.onChange) me.onChange(selectedIndex, items[selectedIndex]);
    };

    me.getSelectedIndex = function() {
        return selectedIndex;
    };

    me.getSelectedItem = function() {
        return items[selectedIndex];
    };

    function getLabel(item) {
        if (!item) return "";
        if (typeof item.label === "function") return item.label();
        return item.label || "";
    }

    function getAbsolutePosition() {
        var x = me.left, y = me.top;
        var parent = me.parent;
        while (parent) {
            x += parent.left + (parent.scrollOffsetX || 0);
            y += parent.top + (parent.scrollOffsetY || 0);
            parent = parent.parent;
        }
        return { x: x, y: y };
    }

    function ensureVisible() {
        if (hoverIndex < scrollOffset) {
            scrollOffset = hoverIndex;
        } else if (hoverIndex >= scrollOffset + maxVisibleItems) {
            scrollOffset = hoverIndex - maxVisibleItems + 1;
        }
    }

    me.open = function() {
        if (isOpen || !items.length) return;
        isOpen = true;
        hoverIndex = selectedIndex;
        scrollOffset = Math.max(0, selectedIndex - Math.floor(maxVisibleItems / 2));

        var abs = getAbsolutePosition();
        var visibleCount = Math.min(items.length, maxVisibleItems);
        var lw = computedLabelWidth();
        var btnLeft = (me.labelPosition === "left") ? lw : 0;
        listWidth = me.itemWidth || (me.width - lw);
        listHeight = visibleCount * itemHeight + 4;
        listLeft = abs.x + btnLeft;
        listTop = abs.y + me.height;

        // flip above trigger if not enough room below
        if (UI.mainPanel && listTop + listHeight > UI.mainPanel.height) {
            listTop = abs.y - listHeight;
        }

        if (!popup) popup = createPopup();
        popup.syncWidth();

        popup.setSize(
            UI.mainPanel ? UI.mainPanel.width : 800,
            UI.mainPanel ? UI.mainPanel.height : 600
        );
        popup.setPosition(0, 0);
        popup.refresh();
        UI.setModalElement(popup);
        me.refresh();
    };

    me.close = function(apply) {
        if (!isOpen) return;
        isOpen = false;
        if (apply) me.setSelectedIndex(hoverIndex);
        UI.removeModalElement();
        me.refresh();
    };

    me.onHover = function() {
        if (!isHover) { isHover = true; me.refresh(); }
    };

    me.onHoverExit = function() {
        if (isHover) { isHover = false; me.refresh(); }
    };

    me.onClick = function() {
        if (isOpen) {
            me.close(false);
        } else {
            me.open();
        }
    };

    function createPopup() {
        var p = UIElement(0, 0, 800, 600);
        p.type = "dropdown-popup";
        var itemCache = [];
        var cachedListWidth = 0;
        var lineHor = Y.getImage("line_hor");

        var panelBg = Scale9Panel(0, 0, 100, 100, {
            img: Y.getImage("panel_dark"),
            left: 3, top: 3, right: 2, bottom: 2
        });
        panelBg.ignoreEvents = true;
        p.addChild(panelBg);

        function renderItem(item, index) {
            var cached = itemCache[index];
            if (cached) return cached;

            var canvas = document.createElement("canvas");
            canvas.width = Math.max(1, listWidth - 4);
            canvas.height = itemHeight;
            var ctx = canvas.getContext("2d");

            var textX = 10;

            if (item.icon) {
                ctx.drawImage(item.icon, textX, 3);
                textX += item.icon.width + 4;
            }

            var itemFont = me.itemFont || window.fontMed;
            if (itemFont) {
                itemFont.write(ctx, getLabel(item), textX, 5, 0);
            }

            if (lineHor) ctx.drawImage(lineHor, 0, itemHeight - 2, canvas.width, 2);

            itemCache[index] = canvas;
            return canvas;
        }

        p.clearCache = function() { itemCache = []; cachedListWidth = 0; };

        p.syncWidth = function() {
            if (cachedListWidth !== listWidth) {
                itemCache = [];
                cachedListWidth = listWidth;
            }
        };

        p.render = function(internal) {
            internal = !!internal;
            if (p.needsRendering) {
                p.clearCanvas();

                panelBg.setSize(listWidth, listHeight);
                panelBg.setPosition(listLeft, listTop);
                panelBg.render();

                var visibleCount = Math.min(items.length - scrollOffset, maxVisibleItems);
                for (var i = 0; i < visibleCount; i++) {
                    var itemIndex = i + scrollOffset;
                    var itemY = listTop + 2 + i * itemHeight;
                    var isItemHover = itemIndex === hoverIndex;
                    var isSelected = itemIndex === selectedIndex;

                    if (isItemHover) {
                        p.ctx.fillStyle = "rgba(110,130,220,0.15)";
                        p.ctx.fillRect(listLeft + 2, itemY, listWidth - 4, itemHeight);
                    } else if (isSelected) {
                        p.ctx.fillStyle = "rgba(110,130,220,0.25)";
                        p.ctx.fillRect(listLeft + 2, itemY, listWidth - 4, itemHeight);
                    }

                    p.ctx.drawImage(renderItem(items[itemIndex], itemIndex), listLeft + 2, itemY);
                }

                // scroll indicators
                var labelFont = me.labelFont || window.fontSmall;
                if (scrollOffset > 0 && labelFont) {
                    labelFont.write(p.ctx, "▲", listLeft + listWidth - 16, listTop + 4, 0);
                }
                if (scrollOffset + maxVisibleItems < items.length && labelFont) {
                    labelFont.write(p.ctx, "▼", listLeft + listWidth - 16, listTop + listHeight - 14, 0);
                }
            }
            p.needsRendering = false;
            if (internal) return p.canvas;
            p.parentCtx.drawImage(p.canvas, p.left, p.top, p.width, p.height);
        };

        p.onClick = function() {
            var insideList = (
                p.eventX >= listLeft && p.eventX <= listLeft + listWidth &&
                p.eventY >= listTop  && p.eventY <= listTop  + listHeight
            );
            if (insideList) {
                var clickedIndex = Math.floor((p.eventY - listTop - 2) / itemHeight) + scrollOffset;
                if (clickedIndex >= 0 && clickedIndex < items.length) {
                    hoverIndex = clickedIndex;
                    me.close(true);
                }
            } else {
                me.close(false);
            }
        };

        p.onHover = function() {
            var insideList = (
                p.eventX >= listLeft && p.eventX <= listLeft + listWidth &&
                p.eventY >= listTop  && p.eventY <= listTop  + listHeight
            );
            if (insideList) {
                var index = Math.floor((p.eventY - listTop - 2) / itemHeight) + scrollOffset;
                if (index >= 0 && index < items.length && index !== hoverIndex) {
                    hoverIndex = index;
                    p.refresh();
                }
            }
        };

        p.onMouseWheel = function(touchData) {
            if (touchData.mouseWheels[0] > 0) {
                if (scrollOffset > 0) { scrollOffset--; p.refresh(); }
            } else {
                if (scrollOffset + maxVisibleItems < items.length) { scrollOffset++; p.refresh(); }
            }
        };

        p.onKeyDown = function(keyCode) {
            switch (keyCode) {
                case 27: // Escape
                    me.close(false);
                    return true;
                case 13: // Enter
                    me.close(true);
                    return true;
                case 38: // Arrow Up
                    if (hoverIndex > 0) {
                        hoverIndex--;
                        ensureVisible();
                        p.refresh();
                    }
                    return true;
                case 40: // Arrow Down
                    if (hoverIndex < items.length - 1) {
                        hoverIndex++;
                        ensureVisible();
                        p.refresh();
                    }
                    return true;
                case 36: // Home
                    hoverIndex = 0;
                    scrollOffset = 0;
                    p.refresh();
                    return true;
                case 35: // End
                    hoverIndex = items.length - 1;
                    ensureVisible();
                    p.refresh();
                    return true;
            }
            return false;
        };

        return p;
    }

    me.render = function(internal) {
        if (!me.isVisible()) return;
        internal = !!internal;

        if (me.needsRendering) {
            me.clearCanvas();
            background.render();

            var lw  = computedLabelWidth();
            var btnLeft = (me.labelPosition === "left") ? lw : 0;
            var btnRight = btnLeft + computedButtonWidth();
            var cy = Math.floor(me.height / 2);

            // label text
            var labelFont = me.labelFont || window.fontSmall;
            if (me.label && me.labelPosition !== "none" && labelFont) {
                var lx = (me.labelPosition === "right") ? (me.width - lw + 4) : 4;
                labelFont.write(me.ctx, me.label, lx, cy - 4, 0);
            }

            // selected item label inside button area
            var item = items[selectedIndex];
            var itemLabel = item ? getLabel(item) : "";
            var itemFont = me.itemFont || window.fontMed;
            if (itemLabel && itemFont) {
                itemFont.write(me.ctx, itemLabel, btnLeft + 8, cy - 5, 0);
            }

            // triangle arrow — brighter when open or hovered
            me.ctx.fillStyle = isOpen ? "rgba(255,255,255,0.9)" : (isHover ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)");
            var cx = btnRight - Math.floor(arrowWidth / 2);
            me.ctx.beginPath();
            me.ctx.moveTo(cx - 5, cy - 2);
            me.ctx.lineTo(cx + 5, cy - 2);
            me.ctx.lineTo(cx,     cy + 4);
            me.ctx.closePath();
            me.ctx.fill();
        }

        me.needsRendering = false;
        if (internal) return me.canvas;
        me.parentCtx.drawImage(me.canvas, me.left, me.top, me.width, me.height);
    };

    return me;
};

export default Dropdown;
