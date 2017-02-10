var FetchService = (function() {

	// somewhat Jquery syntax compatible for easy portability

	var me = {};

	var defaultAjaxTimeout = 30000;

	me.get = function(url,next){
		me.ajax({
			url : url,
			success: function(data){next(data)},
			error: function(xhr){next(undefined,xhr)}
		});
	};

	me.json = function(url,next){
		if (typeof next == "undefined") next=function(){};
		me.ajax({
			url : url,
			cache: false,
			datatype: "json",
			headers: [{key:"Accept", value:"application/json"}],
			success: function(data){next(data)},
			error: function(xhr){next(undefined,xhr)}
		});
	};

	me.html = function(url,next){
		me.ajax({
			url : url,
			cache: false,
			datatype: "html",
			success: function(data){next(data)},
			error: function(xhr){next(undefined,xhr)}
		});
	};


	me.ajax = function(config){

		var xhr = new XMLHttpRequest();

		config.error = config.error || function(){config.success(false)};

		if (config.datatype === "jsonp"){
			console.error(log.error() +  " ERROR: JSONP is not supported!");
			config.error(xhr);
		}

		var url = config.url;

		if (typeof config.cache === "boolean" && !config.cache){
			var r = new Date().getTime();
			url += url.indexOf("?")>0 ? "&r=" + r : "?r=" + r;
		}

		var method = config.method || "GET";

		xhr.onreadystatechange = function(){
			if(xhr.readyState < 4) {
				return;
			}
			if(xhr.readyState === 4) {
				if(xhr.status !== 200 && xhr.status !== 201) {
					config.error(xhr);
				}else{
					var result = xhr.responseText;
					if (config.datatype === "json") result = JSON.parse(result);
					if (config.datatype === "html"){
						result = document.createElement("div");
						result.innerHTML = xhr.responseText;
					}
					config.success(result);
				}
			}
		};

		xhr.ontimeout = function (e) {
			console.error(log.error() + "timeout while getting " + url);
		};

		xhr.open(method, url, true);
		xhr.timeout = config.timeout || defaultAjaxTimeout;

		if (config.headers){
			config.headers.forEach(function(header){
				xhr.setRequestHeader(header.key, header.value);
			})
		}

		var data = config.data || '';
		if (method == "POST" && config.data){
			xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		}

		xhr.send(data);
	};

	return me;
}());

