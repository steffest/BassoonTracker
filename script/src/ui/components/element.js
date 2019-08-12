UI.element = function(left,top,width,height){
    var me = {};

    me.left = left || 0;
    me.top = top || 0;
    me.width = width || 20;
    me.height = height || 20;

    me.visible = true;
    me.needsRendering = true;
    me.parentCtx = ctx;

    me.canvas = document.createElement("canvas");
    me.canvas.width = width;
    me.canvas.height = height;
    me.ctx = me.canvas.getContext("2d");
    me.children = [];

    me.hide = function(){
        me.visible = false;
        if (me.onHide) me.onHide();
    };
    me.show = function(andRefresh,andRefreshAllChildren){
        me.visible = true;
        if (andRefresh) me.refresh(andRefreshAllChildren);
        if (me.onShow) me.onShow();
    };
    me.toggle = function(state){
        if (typeof state === "boolean"){
            if (state) {
                me.show();
			}else{
				me.hide();
            }
        }else{
			if (me.visible){
				me.hide();
			}else{
				me.show();
			}
        }

    };

    me.isVisible = function(){
        var result = me.visible;
        var parent = me.parent;
        while (result && parent) {
            result = parent.visible;
            parent = parent.parent;
        }
        return result;
    };

    me.containsPoint = function(x,y){
        var left = this.left;
        var right = this.left+this.width;
        var top = this.top;
        var bottom = this.top+this.height;

        return ((x >= left) && (x <= right) && (y >= top) && (y <= bottom));
    };

    me.getElementAtPoint = function(_x,_y){
		_x -= (me.left + (me.scrollOffsetX || 0));
		_y -= (me.top + (me.scrollOffsetY || 0));

        if (me.scaleX) _x /= me.scaleX;
        if (me.scaleY) _y /= me.scaleY;

        var currentEventTarget;
        for (var i = me.children.length-1; i>=0; i--){
            var elm = me.children[i];
            if (elm.isVisible() && !elm.ignoreEvents && elm.containsPoint(_x,_y)){
                currentEventTarget = elm;
                break;
            }
        }

        // TODO: how does this work in multitouch? seems this should be part of the touchData object, no ?
        // Update: assigned it to localX and localY -> update all components ?
        if (currentEventTarget){
            var child = currentEventTarget.getElementAtPoint(_x,_y);
            if (child){
                currentEventTarget = child;
            }else{
                currentEventTarget.eventX = _x;
                currentEventTarget.eventY = _y;
            }
        }else{
            currentEventTarget = me;
            currentEventTarget.eventX = _x;
            currentEventTarget.eventY = _y;
        }



        return currentEventTarget;
    };

    me.setParent = function(parentElement){
        me.parent = parentElement;
        if (parentElement){
            me.parentCtx = parentElement.ctx;
        }
    };

    me.addChild = function(elm){
        elm.setParent(me);
        elm.zIndex = elm.zIndex || me.children.length;
        me.children.push(elm);
    };

    me.getChild = function(name){
        var i = me.children.length;
        var child;
        while (i){
            child = me.children[i];
            if (child && child.name && child.name == name) return child;
            i--;
        }
    };

    me.refresh = function(refreshChildren){
        me.needsRendering = true;
        if (refreshChildren){
            console.error("refresh children " + me.name);
            var i = me.children.length;
            var child;
            while (i){
                child = me.children[i];
                if (child) child.refresh();
                i--;
            }
        }
        if (this.visible && me.parent && me.parent.refresh) me.parent.refresh();
    };

    me.setSize = function(_w,_h){
		me.width = Math.max(_w,1);
		me.height = Math.max(_h,1);
        me.canvas.width = me.width;
        me.canvas.height = me.height;
        if (me.onResize) me.onResize();
        me.refresh();
    };
    me.setPosition = function(_x,_y){
        me.left = _x;
        me.top = _y;
        me.refresh();
    };

    me.setDimensions = function(properties){
        var visible = (typeof properties.visible === "boolean") ? properties.visible : true;
        if (visible){
            if (me.setProperties){
                me.setProperties(properties);
            }else{
                me.setPosition(properties.left,properties.top);
                me.setSize(properties.width,properties.height);
            }
        }else{
            //element.hide();
        }
    };

    me.clearCanvas = function(){
        me.ctx.clearRect(0,0,me.width,me.height);
    };

    return me;
};