/* App sin internet.
   · vocab-shell-vN: la app (páginas, js, datos pequeños, iconos). Cada versión nueva borra las anteriores.
   · vocab-media: imágenes y audios (y lo que guarda «Descargar todo»). Se conserva de una versión a otra.
   La página y los datos van primero a la red (siempre la última versión) y, sin conexión, salen del shell actual,
   luego de vocab-media y por último de cualquier otra caché. Las imágenes y los mp3 salen de vocab-media y, si no
   están, de la red (y se guardan). Las cachés viejas (vocab-v1 de «Descargar todo», vocab-vNN del sw anterior) pasan
   sus imágenes, audios y datos a vocab-media y después se borran. */
const VERSION = 14;
const SHELL_CACHE = "vocab-shell-v" + VERSION;
const MEDIA_CACHE = "vocab-media";
const SHELL = [
  "./", "index.html", "privacy.html", "manifest.webmanifest",
  "data/index.json", "data/map.json", "data/game.json", "data/sprites.json",
  "js/motion.js", "js/gestures.js", "js/sfx.js", "js/farm.js", "js/games.js", "js/buddy.js", "js/album.js",
  "js/save.js", "js/sync.js", "js/fab.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "icons/icon-192-maskable.png", "icons/icon-512-maskable.png",
];
const REQUIRED = ["index.html"];                            /* sin esto la versión nueva no se instala */
const MEDIA_RE = /\.(png|jpe?g|gif|webp|svg|mp3|m4a|ogg|wav)$/i;
const isMedia = url => MEDIA_RE.test(url.pathname) && !url.pathname.includes("/icons/");
const OLD_RE = /^vocab-v\d+$/;                              /* cachés de antes de vocab-shell */
const SHELL_RE = /^vocab-shell-v\d+$/;
const KEEP_RE = /\/(data|audio)\/[^/]+\.json$/;             /* datos que también pasan de las cachés viejas */

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL_CACHE), failed = [];
    /* uno a uno: si uno falla se avisa en la consola y los demás se guardan igual */
    await Promise.all(SHELL.map(u => c.add(new Request(u, {cache: "reload"})).catch(err => {
      failed.push(u);
      console.warn("[sw] no se pudo guardar", u, (err && err.message) || err);
    })));
    const missing = REQUIRED.filter(u => failed.includes(u));
    if(missing.length) throw new Error("[sw] sin " + missing.join(", ") + ": se queda la versión anterior");
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => SHELL_RE.test(n) && n !== SHELL_CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
  /* el paso de las cachés viejas no bloquea la activación; si se corta, se repite al volver a arrancar */
  migrateOld();
});

let migrating = null;
function migrateOld(){
  if(migrating) return migrating;
  migrating = (async () => {
    const olds = (await caches.keys()).filter(n => OLD_RE.test(n));
    if(!olds.length) return;
    const media = await caches.open(MEDIA_CACHE);
    for(const name of olds){
      const old = await caches.open(name);
      for(const req of await old.keys()){
        const url = new URL(req.url);
        if(url.origin !== location.origin || !(isMedia(url) || KEEP_RE.test(url.pathname))) continue;
        if(await media.match(req)) continue;
        const res = await old.match(req);
        if(res && res.status === 200 && res.type !== "opaque") await media.put(req, res);
      }
      await caches.delete(name);                             /* solo cuando ya está todo copiado */
    }
  })().catch(err => { console.warn("[sw] no se pudo pasar la caché vieja", (err && err.message) || err); migrating = null; });
  return migrating;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  /* «Descargar todo» pide con cache:"no-store" y guarda él mismo en la caché que toca */
  if(req.method !== "GET" || req.cache === "no-store") return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;
  if(!migrating) e.waitUntil(migrateOld());
  e.respondWith(isMedia(url) ? mediaFirst(req, e) : networkFirst(req, e));
});

/* imágenes y audios: de vocab-media; si no están, de la red entera (sin Range) y se guardan */
async function mediaFirst(req, e){
  const media = await caches.open(MEDIA_CACHE);
  let res = await media.match(req.url);
  if(!res){
    try{
      res = await fetch(req.url, {credentials: "same-origin"});
      if(res.status === 200 && !res.redirected){
        const copy = res.clone();
        e.waitUntil(media.put(req.url, copy).catch(err => console.warn("[sw] no cabe", req.url, (err && err.message) || err)));
      }
    }catch(err){
      res = await caches.match(req.url, {ignoreSearch: true});
      if(!res) return Response.error();
    }
  }
  return req.headers.has("range") ? rangeOf(req, res) : res;
}

/* Safari pide los audios por trozos (Range): se contesta 206 con el trozo pedido del archivo entero guardado */
async function rangeOf(req, res){
  if(res.status !== 200) return res;
  const m = /^bytes=(\d*)-(\d*)$/.exec((req.headers.get("range") || "").trim());
  if(!m) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  let a, b;
  if(m[1] === ""){ a = Math.max(0, size - (+m[2] || 0)); b = size - 1; }
  else { a = +m[1]; b = m[2] === "" ? size - 1 : Math.min(+m[2], size - 1); }
  if(m[1] === "" && m[2] === "" || a > b || a >= size)
    return new Response(null, {status: 416, statusText: "Range Not Satisfiable", headers: {"Content-Range": `bytes */${size}`}});
  return new Response(buf.slice(a, b + 1), {status: 206, statusText: "Partial Content", headers: {
    "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
    "Content-Range": `bytes ${a}-${b}/${size}`, "Content-Length": String(b - a + 1), "Accept-Ranges": "bytes"}});
}

/* lo demás: primero la red (y se guarda en el shell actual); sin red, de las cachés */
async function networkFirst(req, e){
  try{
    const res = await fetch(req);
    if(res.status === 200 && res.type === "basic" && !res.redirected){
      const copy = res.clone();
      e.waitUntil(caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {}));
    }
    return res;
  }catch(err){
    return fromCaches(req);
  }
}
async function fromCaches(req){
  const o = {ignoreSearch: true};
  const shell = await caches.open(SHELL_CACHE);
  let res = await shell.match(req, o);
  if(!res) res = await (await caches.open(MEDIA_CACHE)).match(req, o);
  if(!res) res = await caches.match(req, o);
  if(!res && req.mode === "navigate") res = (await shell.match("index.html")) || (await shell.match("./"));
  return res || Response.error();
}
