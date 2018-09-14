var EventBus = (function() {

    var allEventHandlers = {};

    var me = {};

    me.on = function (event, listener) {
        var eventHandlers = allEventHandlers[event];
        if (!eventHandlers) {
            eventHandlers = [];
            allEventHandlers[event] = eventHandlers;
        }
        eventHandlers.push(listener);
    };

    me.trigger = function(event, context) {
        var eventHandlers = allEventHandlers[event];
        if (eventHandlers) {
            var i, len = eventHandlers.length;
            for (i = 0; i < len; i++) {
                eventHandlers[i](context,event);
            }
        }
    };

    return me;
}());
