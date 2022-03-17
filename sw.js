// fetch first service worker
self.addEventListener("fetch", function (event) {
	event.respondWith(
		fetch(event.request)
		.catch(function() {
			return caches.open("Bassoon").then(function(cache) {
				return cache.match(event.request, {'ignoreSearch': true})
			})
		})
		.then(function (response) {
			// no POST
			if (event.request.method != "POST") {
				var resClone = response.clone();
				caches.open("Bassoon").then(function(cache) {
					cache.delete(event.request, {'ignoreSearch': true})
					cache.put(event.request, resClone);
				});
			}
			return response;
		})
	)
})