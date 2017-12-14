var ModulesPl = function(){
	var me = {};

	var apiUrl = "https://www.stef.be/bassoontracker/api/mpl/";
	var proxyUrl = "https://www.stef.be/bassoontracker/api/modules.pl/";
	var genres = [];

	me.get = function(url,next){
		var params = url.split("/");

		url = params[0];
		var param = params[1] || "";
		var page = params[2] || "";

		switch (url){
			case "genres":
				loadGenres(next);
				break;
			case "genre":
				loadGenre(param,page,next);
				break;
			case "toprating":
				page = param || 1;
				loadFromApi("toprating/" + page,function(data){
					next(parseModList(data,params));
				});
				break;
			case "topscore":
				page = param || 1;
				loadFromApi("topscore/" + page,function(data){
					next(parseModList(data,params));
				});
				break;
			case "artist":
				var apiUrl = "artist/" + param;
				if (page) apiUrl += "/" + page;
				loadFromApi(apiUrl,function(data){
					next(parseModList(data,params));
				});
				break;
			default:
				next([]);
		}
	};

	function loadGenres(next){
		if (genres.length) {
			if (next) next(genres);
		}else{
			loadFromApi("genres",function(result){
				if (result){
					result.forEach(function(genre){
						console.log(genre);
						var id = genre.split("(")[0].trim();
						var item = {title: genre, url : "genre/" + id ,children : []};
						genres.push(item);
					});
				}
				if (next) next(genres);
			})
		}
	}

	function loadGenre(id,page,next){
		var url = "genre/" + id;
		if (page) {
			page = parseInt(page);
			url += "/" + page;
		}
		loadFromApi(url,function(data){
			next(parseModList(data,["genre",id,page]));
		})
	}

	function loadFromApi(url,next){
		console.log("load from api " + apiUrl + url);
		FetchService.json(apiUrl + url,function(data){
			next(data);
		})
	}

	function parseModList(data){
		var result = [];
		if (data){
			data.forEach(function(mod){
				result.push({title:mod.title || "---",url:proxyUrl + mod.id});
			});
		}
		return result;
	}

	return me;
}();