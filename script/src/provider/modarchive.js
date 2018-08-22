var ModArchive = function(){
	var me = {};

	var apiUrl = "http://localhost:3000/";
	apiUrl = "https://www.stef.be/bassoontracker/api/ma/";
	var apiUrlV1 = "https://www.stef.be/bassoontracker/api/";
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
            case "artists":
                loadArtists(next);
                break;
			case "genre":
                loadFromApi("genre/" + param,function(data){
                    next(parseModList(data));
                });
				break;
			case "toprating":
				page = param || 1;
				loadFromApiV1("toprating/" + page,function(data){
					next(parseModListV1(data,params));
				});
				break;
			case "topreview":
				page = param || 1;
				loadFromApiV1("topreview/" + page,function(data){
					next(parseModListV1(data,params));
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
					var children = {};
                    result.forEach(function(genre){
                        console.log(genre);
                        if (genre.parent){
                            var item = {title: genre.name, count: genre.count, info: genre.count + " >", children : [],url: "genre/" + genre.id};
                        	if (!children[genre.parent])children[genre.parent]=[];
                        	children[genre.parent].push(item);
						}
                    });

                    result.forEach(function(genre){
                        if (!genre.parent){
                            var item = {title: genre.name, children : children[genre.id] || []};
                            var total = 0;
                            item.children.forEach(function(child){
                                total+=child.count;
							});
                            item.info = total + ' >';
                            genres.push(item);
                        }
                    });
				}


				if (next) next(genres);
			})
		}
	}

    function loadArtists(next){
        if (artists.length) {
            if (next) next(artists);
        }else{
            loadFromApi("artists",function(result){
                if (result){
                    result.forEach(function(artist){
                        var item = {title: artist.handle, children : [], info: artist.count + " >", url : "artist/" + artist.id};
                        artists.push(item);
                    });
                }
                if (next) next(artists);
            })
        }
    }

	function loadFromApi(url,next){
        console.log("load from api " + apiUrl + url);
        FetchService.json(apiUrl + url,function(data){
            next(data);
        })
    }

    function loadFromApiV1(url,next){
        console.log("load from api " + apiUrl + url);
        FetchService.json(apiUrlV1 + url,function(data){
            if (data && data.modarchive) data = data.modarchive;
            next(data);
        })
    }

    function parseModList(data){
        var result = [];
        if (data){
            data.forEach(function(mod){
				result.push({
					title:mod.title || "---",
					url:"https://api.modarchive.org/downloads.php?moduleid=" + mod.id,
					icon: mod.format,
					info: formatFileSize(mod.size)});
			});
        }
        return result;
    }

	function parseModListV1(data,base){

		var result = [];
		if (data){

			if (data.module){
				var mods = data.module;
				if (mods.forEach){
					mods.forEach(function(mod){
						result.push({title:mod.songtitle || "---",url:mod.url,icon:"mod"});
					});
				}else{
					// single result
					result.push({title:mods.songtitle || "---",url:mods.url,icon:"mod"});
				}
			}

			if (data.totalpages){
				var pageCount = parseInt(data.totalpages);
				if (pageCount>1){
					var profile = base[0] + "/";
					var currentPage = parseInt(base[1] || 1);
					if (isNaN(currentPage)) currentPage=1;

					if (profile == "artist/" || profile == "genre/"){
						profile += base[1] + "/";
						currentPage = parseInt(base[2] || 1);
						if (isNaN(currentPage)) currentPage=1;
					}
					if (pageCount>currentPage){
						profile += (currentPage+1);
						result.push({title:"... load more ...",children:[],url:profile});
					}

				}
			}

		}
		return result;
	}

	return me;
}();