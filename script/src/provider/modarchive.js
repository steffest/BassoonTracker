var ModArchive = function(){
	var me = {};

	var apiUrl = "http://localhost:3000/";
	apiUrl = "http://www.stef.be/bassoontracker/api/";
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
			case "topreview":
				page = param || 1;
				loadFromApi("topreview/" + page,function(data){
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
				if (result && result.parent){
					result.parent.forEach(function(genre){
						console.log(genre);

						var item = {title: genre.text + " (" + genre.files +")", children : []};

						if (genre.children && genre.children.child && genre.children.child.length){
							genre.children.child.forEach(function(child){
								item.children.push({title: child.text + " (" + child.files + ")",children:[],url: "genre/" + child.id})
							});
						}

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
			if (data && data.modarchive) data = data.modarchive;
			next(data);
		})
	}

	function parseModList(data,base){


		var result = [];
		if (data){

			if (data.module){
				var mods = data.module;
				if (mods.forEach){
					mods.forEach(function(mod){
						result.push({title:mod.songtitle || "---",url:mod.url});
					});
				}else{
					// single result
					result.push({title:mods.songtitle || "---",url:mods.url});
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