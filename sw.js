/* App sin internet: la página y los datos van primero a la red (siempre la última versión)
   y, sin conexión, salen de la caché; las imágenes y los audios salen de la caché y si no, de la red. */
const CACHE = "vocab-v13";
const SHELL = ["./", "index.html", "data/index.json", "data/map.json", "data/game.json", "data/sprites.json", "js/sfx.js", "js/farm.js", "js/games.js", "js/buddy.js", "js/album.js", "js/save.js", "js/sync.js", "js/fab.js", "manifest.webmanifest", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== "GET" || url.origin !== location.origin) return;
  const isImg = /\.(png|jpg|svg|webp|mp3)$/.test(url.pathname) && !url.pathname.includes("/icons/");
  if(isImg){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match(req, {ignoreSearch:true}).then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
