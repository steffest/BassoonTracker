const allEventHandlers = {};

const EventBus = (()=>{
    var me = {};

    me.on = function(event, listener) {
        allEventHandlers[event] = allEventHandlers[event] || [];
        allEventHandlers[event].push(listener);
        if (event === 30){
            console.error("Adding listener for event 30 event has ",allEventHandlers[event].length," listeners");
        }
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
})();

export default EventBus;
