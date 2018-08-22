var ModulesPl = function(){
	var me = {};

	var apiUrl = "https://www.stef.be/bassoontracker/api/mpl/";
	var proxyUrl = "https://www.stef.be/bassoontracker/api/modules.pl/";
	var genres = [];
	var artists = [];

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
					next(parseModList(data,"rate"));
				});
				break;
			case "topscore":
				page = param || 1;
				loadFromApi("topscore/" + page,function(data){
					next(parseModList(data,"score"));
				});
				break;
			case "artists":
				loadArtists(next);
				break;
			case "artist":
				var apiUrl = "artist/" + param;
				if (page) apiUrl += "/" + page;
				loadFromApi(apiUrl,function(data){
					next(parseModList(data));
				});
				break;
			default:
				next([]);
		}
	};

	function loadArtists(next){
		if (artists.length) {
			if (next) next(artists);
		}else{
			loadFromApi("artists",function(result){
				if (result){
					result.forEach(function(artist){
						console.log(artist);
						var item = {title: artist.handle, info:  artist.count + " >", url : "artist/" + artist.id ,children : []};
						artists.push(item);
					});
				}
				if (next) next(artists);
			})
		}
	}

	function loadGenres(next){
		if (genres.length) {
			if (next) next(genres);
		}else{
			loadFromApi("genres",function(result){
				if (result){
					result.forEach(function(genre){
						var item = {title: genre.name, url : "genre/" + genre.name ,children : [],info:genre.count + " >"};
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
			next(parseModList(data));
		})
	}

	function loadFromApi(url,next){
		console.log("load from api " + apiUrl + url);
		FetchService.json(apiUrl + url,function(data){
			next(data);
		})
	}

	function parseModList(data,extraInfo){
		var result = [];
		if (data){
			data.forEach(function(mod){
			    var info = formatFileSize(mod.size);
			    var title = mod.title || "---";
			    if (extraInfo){
                    title = mod[extraInfo] + ": " + title;
                }
				result.push({title:title,url:proxyUrl + mod.id,info:info,icon:mod.format});
			});
		}
		return result;
	}

	return me;
}();