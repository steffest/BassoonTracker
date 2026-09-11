const allEventHandlers = {};

export default {
    on: (event, listener) => {
        allEventHandlers[event] = allEventHandlers[event] || [];
        allEventHandlers[event].push(listener);
        return allEventHandlers[event].length;
    },
    off: (event,index) => {
        let eventHandlers = allEventHandlers[event];
        if (eventHandlers) eventHandlers[index-1]=undefined;
    },
    trigger: (event, context) => {
        let eventHandlers = allEventHandlers[event];
        if (eventHandlers && eventHandlers.length) {
            eventHandlers.forEach(handler => {
                if (handler) handler(context,event);
            });
        }
    }
}
