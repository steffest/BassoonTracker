var EventBus = (function() {

    var allEventHandlers = {};

    var me = {};

    me.onEvent = function (event, listener) {
        var eventHandlers = allEventHandlers[event];
        if (!eventHandlers) {
            eventHandlers = [];
            allEventHandlers[event] = eventHandlers;
        }
        eventHandlers.push(listener);
    };

    me.sendEvent = function(event, context) {
        var eventHandlers = allEventHandlers[event];
        if (eventHandlers) {
            var i, len = eventHandlers.length;
            for (i = 0; i < len; i++) {
                eventHandlers[i](context,event);
            }
        }
    };

    // alias
    me.trigger = function(event, context){
        me.sendEvent(event, context)
    };
    me.on = function(event, listener){
        me.onEvent(event, listener);
    };

    return me;
}());
