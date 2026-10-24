/* App sin internet.
   · vocab-shell-vN: la app (las entradas de SHELL: páginas, js, iconos, los datos pequeños y los dibujos de las tarjetas
     de F5 en Juegos y Hoy, que así salen sin conexión desde el primer día). Cada versión nueva borra las anteriores.
   · vocab-media: imágenes, audios y los demás datos (temas, gramática, mapas de audio: data/… y audio/….json), con lo que
     guarda «Descargar todo». Se conserva de una versión a otra: lo que el niño ya abrió con red sigue ahí sin conexión
     aunque la app se actualice. Aquí van también los árboles de familia recortados de los juegos (img/fam2/, unos
     470 KB): no están en SHELL porque solo los usa el tema Familia; se guardan la primera vez que se ven y con «Descargar
     todo», y sin ellos los juegos vuelven al dibujo de siempre (img/fam_…).
   La página y los datos van primero a la red (siempre la última versión) y, sin conexión, salen del shell actual,
   luego de vocab-media y por último de cualquier otra caché. Las imágenes y los mp3 salen de vocab-media y, si no
   están, de la red (y se guardan). Las cachés viejas (vocab-v1 de «Descargar todo», vocab-vNN del sw anterior) pasan
   sus imágenes, audios y datos a vocab-media entrada a entrada y después se borran; si no cabe, se borran igual (todo
   se puede volver a bajar).
   Al subir VERSION se sube también OFF_SHELL y el «?v=» de los <script> de index.html y privacy.html: GitHub Pages manda
   max-age=600 y, sin eso, el sw anterior (que pide a la red con la caché HTTP) daría el index.html nuevo con módulos
   viejos de esa caché. El shell se guarda y se busca sin el «?v=». */
const VERSION = 22;
const SHELL_CACHE = "vocab-shell-v" + VERSION;
const MEDIA_CACHE = "vocab-media";
const SHELL = [
  "./", "index.html", "privacy.html", "manifest.webmanifest",
  "data/index.json", "data/map.json", "data/game.json", "data/sprites.json",
  "js/motion.js", "js/gestures.js", "js/lesson.js", "js/learn.js", "js/sfx.js", "js/farm.js", "js/games.js", "js/lince.js", "data/lince.json", "js/buddy.js", "js/album.js",
  "js/save.js", "js/sync.js", "js/gate.js", "js/settings.js", "js/review.js", "js/shop.js", "js/rewards.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "icons/icon-192-maskable.png", "icons/icon-512-maskable.png",
  "fonts/nunito-latin-700-normal.woff2", "fonts/nunito-latin-800-normal.woff2",
  "js/season.js", "data/season.json",
  "js/shortcuts.js",
  "js/mailbox.js", "img/games/buzon.png",
  "js/phrases.js", "data/phrases.json", "img/games/frases.png",
  "js/navmotion.js",
  "js/keys.js", "icons/sc-repasar.png", "icons/sc-camino.png", "icons/sc-juegos.png", "icons/sc-granja.png",
];
const REQUIRED = ["index.html"];                            /* sin esto la versión nueva no se instala */
const MEDIA_RE = /\.(png|jpe?g|gif|webp|svg|mp3|m4a|ogg|wav)$/i;
const isMedia = url => MEDIA_RE.test(url.pathname) && !url.pathname.includes("/icons/");
const OLD_RE = /^vocab-v\d+$/;                              /* cachés de antes de vocab-shell */
const SHELL_RE = /^vocab-shell-v\d+$/;
const KEEP_RE = /\/(data|audio)\/.+\.json$/;                /* datos que se guardan en vocab-media (y pasan de las viejas) */
const SHELL_URLS = new Set(SHELL.map(u => new URL(u, location.href).href));
const inShell = url => SHELL_URLS.has(url.origin + url.pathname);
/* dónde se guarda una respuesta de la red: los datos que no son del shell, en vocab-media (no se borran al actualizar) */
const cacheFor = url => !inShell(url) && KEEP_RE.test(url.pathname) ? MEDIA_CACHE : SHELL_CACHE;
const msg = err => (err && (err.name === "QuotaExceededError" ? "no cabe (" + err.message + ")" : err.message)) || err;

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL_CACHE);
    /* uno a uno: si uno falla se avisa en la consola y los demás se guardan igual */
    const put = u => c.add(new Request(u, {cache: "reload"})).then(() => null, err => err || new Error("sin respuesta"));
    let errs = await Promise.all(SHELL.map(put));
    /* si no cabe, primero la app: se borran las cachés de antes de vocab-shell (sus dibujos se pueden volver a bajar) */
    if(errs.some(err => err && err.name === "QuotaExceededError")){
      const olds = (await caches.keys()).filter(n => OLD_RE.test(n));
      if(olds.length){
        console.warn("[sw] no cabe la app: se borran", olds.join(", "));
        await Promise.all(olds.map(n => caches.delete(n).catch(() => {})));
        errs = await Promise.all(SHELL.map((u, i) => errs[i] ? put(u) : null));
      }
    }
    const failed = SHELL.filter((u, i) => errs[i]);
    failed.forEach(u => console.warn("[sw] no se pudo guardar", u, msg(errs[SHELL.indexOf(u)])));
    const missing = REQUIRED.filter(u => failed.includes(u));
    if(missing.length) throw new Error("[sw] sin " + missing.join(", ") + ": se queda la versión anterior");
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    for(const n of names.filter(n => SHELL_RE.test(n) && n !== SHELL_CACHE)){
      /* de un shell viejo solo se salvan los datos que no son del shell (los de antes de que fueran a vocab-media) */
      await moveTo(n, MEDIA_CACHE, url => !inShell(url) && KEEP_RE.test(url.pathname));
    }
    await self.clients.claim();
  })());
  /* el paso de las cachés viejas no bloquea la activación; si se corta, se repite al volver a arrancar el sw */
  migrateOld();
});

/* pasa a la caché dest las entradas de la caché name que cumplen keep (las que ya están en dest no se tocan) y borra
   name. Va entrada a entrada y borra cada una al pasarla, así libera sitio mientras copia. Si no cabe, borra name igual. */
async function moveTo(name, dest, keep){
  try{
    const old = await caches.open(name), to = await caches.open(dest);
    for(const req of await old.keys()){
      const url = new URL(req.url);
      if(url.origin === location.origin && keep(url) && !(await to.match(req))){
        const res = await old.match(req);
        if(res && res.status === 200 && res.type !== "opaque") await to.put(req, res);
      }
      await old.delete(req);
    }
  }catch(err){
    console.warn("[sw] no se pudo pasar", name, "a", dest + ":", msg(err), "· se borra igual");
  }
  await caches.delete(name).catch(() => {});
}

/* una vez por arranque del sw (aunque falle: no se reintenta en cada petición) */
let migrating = null;
function migrateOld(){
  if(migrating) return migrating;
  migrating = (async () => {
    const olds = (await caches.keys()).filter(n => OLD_RE.test(n));
    for(const name of olds) await moveTo(name, MEDIA_CACHE, url => isMedia(url) || KEEP_RE.test(url.pathname));
  })().catch(err => console.warn("[sw] no se pudo pasar la caché vieja", msg(err)));
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

/* lo demás: primero la red (y se guarda: el shell en el shell actual, los datos en vocab-media); sin red, de las cachés */
async function networkFirst(req, e){
  try{
    const res = await fetch(req);
    if(res.status === 200 && res.type === "basic" && !res.redirected){
      const copy = res.clone(), url = new URL(req.url);
      e.waitUntil(caches.open(cacheFor(url)).then(c => c.put(url.origin + url.pathname, copy))
        .catch(err => console.warn("[sw] no cabe", url.pathname, msg(err))));
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
