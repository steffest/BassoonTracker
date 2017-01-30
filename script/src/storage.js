var Storage = (function(){
	var me = {};

	me.get = function(key){
		return localStorage.getItem(key)
	};

	me.set = function(key,value){
		return localStorage.setItem(key,value);
	};

	return me;
})();