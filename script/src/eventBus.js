var EventBus = (function() {

    var allEventHandlers = {};

    var me = {};

    me.on = function(event, listener) {
        var eventHandlers = allEventHandlers[event];
        if (!eventHandlers) {
            eventHandlers = [];
            allEventHandlers[event] = eventHandlers;
        }
        eventHandlers.push(listener);
        return eventHandlers.length;
    };
    
    me.off = function(event,index){
        var eventHandlers = allEventHandlers[event];
        if (eventHandlers) eventHandlers[index-1]=undefined;
    }

    me.trigger = function(event, context) {
        var eventHandlers = allEventHandlers[event];
        if (eventHandlers) {
            var i, len = eventHandlers.length;
            for (i = 0; i < len; i++) {
                if (eventHandlers[i]) eventHandlers[i](context,event);
            }
        }
    };

    return me;
}());
