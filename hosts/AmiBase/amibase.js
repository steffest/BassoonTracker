/*
    Helper library to integrate your app with AmiBase;
    www.amibase.com

    Copyright (c) 2020 Steffest

    MIT License

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

*/

var AmiBase = function(){
    var me = {
        isAmiBased:false
    };
    var windowId;
    var menu;
    var messageHandler;

    me.init = function(onRegistered){
        var messageTimeOut;
        if (window.self !== window.top && window.parent){
            window.parent.postMessage({
                command: "register",
                url: window.location.href
            },"*");
            messageTimeOut = setTimeout(function(){
                if (onRegistered) onRegistered(false);
            },500);
        }else{
            if (onRegistered) onRegistered(false);
        }

        window.addEventListener("message", function (event) {
            //console.warn(event);
            if (event && event.data){
                if (event.data.registered){
                    clearTimeout(messageTimeOut);
                    windowId = event.data.id;
                    me.isAmiBased = true;
                    if (onRegistered) onRegistered(true);
                    if (menu) me.setMenu(menu);
                }else{
                    if (messageHandler) messageHandler(event.data,event);
                }
            }
        }, false);
    };

    me.iAmReady = function(){
        if (me.isAmiBased){
            window.parent.postMessage({
                command: "ready",
                windowId: windowId
            },"*");
        }
    };

    me.focus = function(){
        if (me.isAmiBased){
            window.parent.postMessage({
                command: "focus",
                windowId: windowId
            },"*");
        }
    };

    me.setMenu = function(_menu){
        menu = _menu;
        if (me.isAmiBased){
            window.parent.postMessage({
                command: "setMenu",
                windowId: windowId,
                data: menu
            },"*");
        }
    };

    me.setMessageHandler = function(handler){
        messageHandler = handler;
    };

    return me;
}();