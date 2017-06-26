//https://github.com/JamesMaroney/dropbox-js - MIT license
// updates by Steffest

(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(factory);
    } else if (typeof exports === 'object') {
        // Node, CommonJS-like
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root[root.__dropbox_export || 'dropboxService'] = factory();
    }
}(this, function () {
    'use strict';

    var toString = ({}).toString;
    function isFunction(x, type){ return toString.call(x) == '[object Function]'; }
    function isString(x, type){ return toString.call(x) == '[object String]'; }
    function isObject(x, type){ return toString.call(x) == '[object Object]'; }
    function paramsFromUrlHash(){
        return window.location.hash.replace(/^#/,'').split('&').reduce(function(o,entry){ if(entry=='') return o; entry=entry.split('='); o[decodeURIComponent(entry[0])] = decodeURIComponent(entry[1]); return o;},{});
    }


    var api = 'https://api.dropboxapi.com/2/',
        content = 'https://content.dropboxapi.com/2/',
        tokenStore = function(key, val){ return ( arguments.length > 1 ) ? (localStorage[key] = val) : localStorage[key]; },
        globalErrorHandler = undefined;

    var endpointMapping = {
        'auth/token/revoke': { contentType: null },
        'users/get_current_account': { contentType: 'application/json' },
        'files/upload': { baseUri: content, format: 'content-upload' },
        'files/get_thumbnail': { baseUri: content, format: 'content-download' },
        'files/download' : { baseUri: content, format: 'content-download' },
        'files/get_preview': {baseUri: content, format: 'content-download' },
        'files/upload_session/append': {baseUri: content, format: 'content-upload'},
        'files/upload_session/append_v2': {baseUri: content, format: 'content-upload'},
        'files/upload_session/finish': {baseUri: content, format: 'content-upload'},
        'files/upload_session/start': {baseUri: content, format: 'content-upload'},
        'files/get_shared_link_file': {baseUri: content, format: 'content-download'}
    };
    var contentTypeMapping = {
        'rpc' : 'application/json',
        'content-upload' : 'application/octet-stream'
    };

    var dropbox = function(endpoint, apiArgs){
        var args = [].slice.call(arguments);

        var config = endpointMapping[endpoint] || {},
            baseUri = config.baseUri || api,
            format = config.format || 'rpc',
            contentType = config.contentType || (config.contentType === null) ? null : contentTypeMapping[format];

        var lastArg = args[args.length - 1];
        var handlers = (args.length > 2 && (isObject(lastArg) || isFunction(lastArg))) ? lastArg : {};
        if(isFunction(handlers)) handlers = { onComplete: handlers };

        var promise,promisectl = {};
        if(Promise){
            promise = new Promise(function(resolve,reject){ promisectl.resolve = resolve; promisectl.reject = reject });
        }

        var r = new XMLHttpRequest();

        r.open('POST', baseUri+endpoint, true);
        r.setRequestHeader('Authorization', 'Bearer '+ (tokenStore('__dbat') || '000000000000000000000000_00000-000000000000000000000000000000000') );

        if(format == 'content-download') r.responseType = 'blob';
        if(apiArgs && apiArgs.responseType){
            r.responseType = apiArgs.responseType;
            delete apiArgs.responseType;
        }

        if(contentType) r.setRequestHeader('Content-Type', contentType);
        if(apiArgs && (format == 'content-upload' || format == 'content-download'))
            r.setRequestHeader('Dropbox-API-Arg', JSON.stringify(apiArgs));

        if(handlers.onDownloadProgress) r.addEventListener("progress", handlers.onDownloadProgress);
        if(handlers.onUploadProgress && r.upload) r.upload.addEventListener("progress", handlers.onUploadProgress);
        if(handlers.onError || globalErrorHandler) r.addEventListener("error", function(e){
            var er = handlers.onError && handlers.onError(e.target);
            promise && promisectl.reject && promisectl.reject(e.target);
            globalErrorHandler && globalErrorHandler(e.target, er);
        });

        r.onreadystatechange = function () {
            if (r.readyState != 4 ) return;
            if (r.status == 200) {
                var apiResponse = JSON.parse( r.getResponseHeader('dropbox-api-result') || r.responseText );
                if(endpoint=='auth/token/revoke') tokenStore('__dbat', '');
                handlers.onComplete && handlers.onComplete( apiResponse, r.response, r);
                promise && promisectl.resolve && promisectl.resolve( apiResponse, r.response, r );
            } else {
                var er = handlers.onError && handlers.onError(r);
                promise && promisectl.reject && promisectl.reject(r);
                globalErrorHandler && globalErrorHandler(r, er);
            }
        };

        var requestPayload = (args.length > 2 && format == 'content-upload') ? args[2] : undefined;
        requestPayload = requestPayload || ( (apiArgs && format == 'rpc') ? JSON.stringify(apiArgs) : null );
        if(requestPayload){
            r.send(requestPayload);
        } else {
            r.send();
        }

        return promise;
    };


    dropbox.setGlobalErrorHandler = function(handler){ globalErrorHandler = handler; };
    dropbox.setTokenStore = function(store){ tokenStore = store; };
    dropbox.authenticate = function(apiArgs, handlers){
        handlers = handlers || {};
        if(isFunction(handlers)) handlers = { onComplete: handlers };
        apiArgs = apiArgs || {};
        if(isString(apiArgs)) apiArgs = { client_id: apiArgs };
        apiArgs.redirect_uri = apiArgs.redirect_uri || window.location.href;

        var promise,promisectl = {};
        if(Promise){
            promise = new Promise(function(resolve,reject){ promisectl.resolve = resolve; promisectl.reject = reject });
        }

        // if we already have an access token, return immediately
        if( tokenStore('__dbat') ){
            handlers.onComplete();
            promise && promise.resolve && promise.resolve();
            return promise
        }

        var params = paramsFromUrlHash(),
            csrfToken = tokenStore('__dbcsrf');

        if(params.state && csrfToken && params.state == csrfToken){
            // we are returning from authentication redirect
            if(params.access_token){
                // the authentcation was successful
                tokenStore('__dbat', params.access_token);
                tokenStore('__dbcsrf', '');
                window.location.replace( window.location.href.replace(/#.*/,'') );
            } else {
                // the authentication was not successful
                var er = handlers.onError && handlers.onError(params);
                promise && promise.reject && promise.reject(params);
                globalErrorHandler && globalErrorHandler(params, er);
            }
        } else {
            // initiate authentication
            csrfToken = ""+Math.floor(Math.random()*100000);
            tokenStore('__dbcsrf', csrfToken);

            window.location = "https://www.dropbox.com/1/oauth2/authorize?response_type=token&"
                + "client_id="+ encodeURIComponent(apiArgs.client_id) +"&"
                + "redirect_uri="+ encodeURIComponent(apiArgs.redirect_uri) + "&"
                + "state="+ encodeURIComponent(csrfToken);
        }

        return promise;
    };
    dropbox.getAccessToken = function(){return tokenStore('__dbat');};
    dropbox.clearAccessToken = function(){return tokenStore('__dbat','');};

    return dropbox;
}));