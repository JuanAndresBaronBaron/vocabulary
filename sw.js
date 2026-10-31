/* App sin internet.
   · vocab-shell-vN: la app (las entradas de SHELL: index.html, js, iconos, los datos pequeños, los dibujos de las
     tarjetas de Juegos y Hoy y los personajes que salen siempre, el zorro y el loro, que así salen sin conexión desde el
     primer día). Cada versión nueva borra las anteriores.
   · LAZY: lo que solo usan algunos: los fondos de Pajarito volador (img/games/vuelo-*.jpg, unos 490 KB) y lo de mayores
     (Tech Prep e IELTS Prep). No se baja al instalar: se guarda la primera vez que se usa (el código en el shell, los
     dibujos y los datos en vocab-media) y, si ya se usó, la versión nueva lo vuelve a bajar al instalarse. Va escrito
     aquí entre comillas porque js/tech-boot.js mira en este fichero qué módulos trae la versión.
   · vocab-media: imágenes, audios y los demás datos (temas, gramática, mapas de audio: data/… y audio/….json), con lo que
     guarda «Descargar todo» y lo que index.html guarda de antemano (warmCache). Se conserva de una versión a otra: lo que
     el niño ya abrió con red sigue ahí sin conexión aunque la app se actualice. Aquí van también los árboles de familia
     recortados de los juegos (img/fam2/, unos 470 KB): no están en SHELL porque solo los usa el tema Familia; se
     guardan la primera vez que se ven y con «Descargar todo», y sin ellos los juegos vuelven al dibujo de siempre.
   Cómo se contesta:
   · js, css y html con «?v=» igual a VERSION (los <script> de index.html): primero el shell, que es esa misma versión
     (así arranca sin esperar a la red); si no está, la red (y se guarda).
   · js, css y html con otro «?v=»: la red y, sin red, solo la copia guardada de esa misma URL, con su «?v=». Nunca se da
     un fichero guardado por su nombre sin mirar el «?v=» (una página nueva con módulos viejos no arranca).
   · la página y los datos: la red, pero si tarda más de 3 s (NET_WAIT), lo guardado (la red sigue y lo guarda para la
     próxima vez); tras una espera así, durante SLOW_FOR lo guardado sale enseguida (la red lenta no suma 3 s a cada
     dato) hasta que la red vuelve a contestar a tiempo; sin red, del shell actual, luego de vocab-media y por último de cualquier otra caché. Una página que
     no está guardada da index.html. La carpeta («./», start_url) es su index.html.
   · imágenes y mp3: de vocab-media (o del shell, las de SHELL) y, si no están, de la red (y se guardan).
   Las cachés viejas (vocab-v1 de «Descargar todo», vocab-vNN del sw anterior) pasan sus imágenes, audios y datos a
   vocab-media entrada a entrada y después se borran; si no cabe, se borran igual (todo se puede volver a bajar).
   Al subir VERSION se sube también OFF_SHELL y el «?v=» de los <script> de index.html y privacy.html, y el de ielts.html
   (ielts.css y los cuatro js/ielts*.js): GitHub Pages manda max-age=600 y, sin eso, la caché HTTP daría la página nueva
   con módulos viejos; y un «?v=» que no es VERSION va a sameUrl, que sin red no encuentra las copias que carryLazy pasa
   por su nombre (IELTS Prep se rompería sin conexión tras cada actualización). El shell se guarda sin el «?v=»: es de
   una sola versión, la de su nombre. */
const VERSION = 38;
const SHELL_CACHE = "vocab-shell-v" + VERSION;
const MEDIA_CACHE = "vocab-media";
const SHELL = [
  "index.html", "privacy.html", "manifest.webmanifest",
  "data/index.json", "data/map.json", "data/game.json", "data/sprites.json",
  "js/motion.js", "js/gestures.js", "js/lesson.js", "js/learn.js", "js/sfx.js", "js/farm.js", "js/games.js", "js/lince.js", "data/lince.json", "js/party.js", "data/party.json", "img/games/impostor.png", "img/games/ordenar.png", "js/buddy.js", "js/album.js",
  "js/save.js", "js/sync.js", "js/gate.js", "js/settings.js", "js/review.js", "js/shop.js", "js/rewards.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "icons/icon-192-maskable.png", "icons/icon-512-maskable.png",
  "fonts/nunito-latin-700-normal.woff2", "fonts/nunito-latin-800-normal.woff2",
  "js/season.js", "data/season.json",
  "js/shortcuts.js",
  "js/ctxmenu.js",
  "js/mailbox.js", "img/games/buzon.png",
  "js/phrases.js", "data/phrases.json", "img/games/frases.png",
  "js/navmotion.js", "js/welcome.js",
  "js/parrot.js",
  "js/calls.js", "data/calls/index.json",
  "data/calls/en/zoo.json", "data/calls/en/rain.json", "data/calls/en/breakfast.json", "data/calls/en/family.json", "data/calls/en/birthday.json",
  "data/calls/en/colours.json", "data/calls/en/body.json", "data/calls/en/clothes.json", "data/calls/en/school.json", "data/calls/en/halloween.json",
  "data/calls/fr/tour.json", "data/calls/fr/matin.json", "data/calls/fr/pluie.json", "data/calls/fr/famille.json", "data/calls/fr/anniversaire.json",
  "data/calls/fr/couleurs.json", "data/calls/fr/corps.json", "data/calls/fr/vetements.json", "data/calls/fr/ecole.json", "data/calls/fr/halloween.json",
  "data/calls/da/cykel.json", "data/calls/da/havn.json", "data/calls/da/bondegaard.json", "data/calls/da/sne.json", "data/calls/da/familie.json",
  "data/calls/da/farver.json", "data/calls/da/krop.json", "data/calls/da/toej.json", "data/calls/da/skole.json", "data/calls/da/jul.json",
  "js/stories.js", "data/stories/index.json", "img/games/cuentos.png",
  "js/chant.js", "img/games/rap.png", "js/simon.js", "img/games/zorrodice.png", "js/oido.js", "img/games/oido.png", "img/games/llamar.png",
  "js/hunter-boot.js", "js/hunter.js", "img/games/cazador.png",
  "data/stories/en/play.json", "data/stories/en/colours.json", "data/stories/en/cake.json", "data/stories/en/night.json",
  "data/stories/en/doctor.json", "data/stories/en/snow.json", "data/stories/en/school.json", "data/stories/en/halloween.json",
  "data/stories/fr/play.json", "data/stories/fr/colours.json", "data/stories/fr/cake.json", "data/stories/fr/night.json",
  "data/stories/fr/doctor.json", "data/stories/fr/snow.json", "data/stories/fr/school.json", "data/stories/fr/halloween.json",
  "data/stories/da/play.json", "data/stories/da/colours.json", "data/stories/da/cake.json", "data/stories/da/night.json",
  "data/stories/da/doctor.json", "data/stories/da/snow.json", "data/stories/da/school.json", "data/stories/da/jul.json",
  "js/keys.js", "icons/sc-repasar.png", "icons/sc-camino.png", "icons/sc-juegos.png", "icons/sc-granja.png",
  "js/army.js", "data/army/en.json", "data/army/fr.json", "data/army/da.json", "img/games/soldados.png", "data/programadores.json", "img/om_1F7E6.png",
  "data/gimnasio.json", "data/muaythai.json", "data/kickboxing.json", "data/lucha.json", "data/jiujitsu.json",
  "js/tech-boot.js",
  "js/flyer.js", "img/games/pajarito.png", "js/topos.js", "img/games/topos.png", "js/cuartel.js", "js/wordplay.js", "js/quiz.js", "js/grammargames.js", "img/games/cuartel.png", "img/games/adivina.png", "img/games/sopa.png", "img/games/crucigrama.png", "img/games/concurso.png", "img/games/verdadero.png", "img/games/cajas.png", "img/games/flechas.png", "img/games/ordenafrase.png", "img/games/completa.png", "img/games/detective.png",
  "js/ielts-boot.js",
  "img/games/memoria.png", "img/games/lluvia.png", "img/games/globos.png", "img/games/letras.png", "img/games/lince.png",
  "img/pj/zorro.png", "img/pj/loro.png",
];
const LAZY = [
  "img/games/vuelo-en.jpg", "img/games/vuelo-fr.jpg", "img/games/vuelo-da.jpg",
  "js/tech.js", "js/tech-lesson.js", "js/tech-pages.js",
  "ielts.html", "ielts.css", "js/ielts.js", "js/ielts-viz.js", "js/ielts-player.js", "js/ielts-study.js", "data/ielts/index.json",
];
const REQUIRED = ["index.html"];                            /* sin esto la versión nueva no se instala */
const NET_WAIT = 3000;                                      /* la red tarda más: se da lo guardado */
const SLOW_FOR = 20000;                                     /* tras una espera, lo guardado enseguida durante 20 s */
let slowUntil = 0;
const MEDIA_RE = /\.(png|jpe?g|gif|webp|svg|mp3|m4a|ogg|wav)$/i;
const CODE_RE = /\.(js|css|html?)$/i;
const isMedia = url => MEDIA_RE.test(url.pathname) && !url.pathname.includes("/icons/");
const OLD_RE = /^vocab-v\d+$/;                              /* cachés de antes de vocab-shell */
const SHELL_RE = /^vocab-shell-v\d+$/;
const KEEP_RE = /\/(data|audio)\/.+\.json$/;                /* datos que se guardan en vocab-media (y pasan de las viejas) */
const abs = u => new URL(u, location.href).href;
/* la clave de una petición en las cachés: sin «?…» y la carpeta como su index.html */
const keyOf = url => url.origin + (url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname);
const SHELL_URLS = new Set(SHELL.map(abs));
const LAZY_PATHS = new Set(LAZY.map(u => new URL(u, location.href).pathname));
const inShell = url => SHELL_URLS.has(keyOf(url));
/* dónde se guarda una respuesta de la red: los datos que no son del shell, en vocab-media (no se borran al actualizar) */
const cacheFor = url => !inShell(url) && KEEP_RE.test(url.pathname) ? MEDIA_CACHE : SHELL_CACHE;
const msg = err => (err && (err.name === "QuotaExceededError" ? "no cabe (" + err.message + ")" : err.message)) || err;
const good = res => res.status === 200 && res.type === "basic" && !res.redirected;

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
    await carryLazy(c);
    await self.skipWaiting();
  })());
});
/* lo de LAZY que ya se usó (está en un shell de antes): se baja otra vez para esta versión, con la misma URL y también
   por su nombre sin «?…», que es como shellFirst lo busca cuando la página nueva lo pide con «?v=» de esta versión
   (ielts.html pasa de «?v=» viejo a VERSION: sin su copia por nombre, IELTS Prep abriría sin css ni js sin conexión).
   Si falla, se pedirá al usarlo. */
async function carryLazy(c){
  try{
    for(const n of (await caches.keys()).filter(n => SHELL_RE.test(n) && n !== SHELL_CACHE)){
      const old = await caches.open(n);
      for(const req of await old.keys()){
        const url = new URL(req.url);
        if(url.origin !== location.origin || !LAZY_PATHS.has(url.pathname)) continue;
        for(const u of new Set([req.url, keyOf(url)])) if(!(await c.match(u))) await c.add(new Request(u, {cache: "reload"})).catch(() => {});
      }
    }
  }catch(err){ console.warn("[sw] no se pudo volver a bajar lo ya usado:", msg(err)); }
}

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
  /* «Descargar todo» y lo que se guarda de antemano piden con cache:"no-store" y guardan ellos mismos */
  if(req.method !== "GET" || req.cache === "no-store") return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;
  if(!migrating) e.waitUntil(migrateOld());
  const v = url.searchParams.get("v");
  e.respondWith(isMedia(url) ? mediaFirst(req, url, e)
    : v !== null && CODE_RE.test(url.pathname) ? (v === String(VERSION) ? shellFirst(req, url, e) : sameUrl(req, e))
    : networkFirst(req, url, e));
});

/* guarda una copia de la respuesta (sin parar la respuesta) */
function keep(e, name, key, res){
  const copy = res.clone();
  e.waitUntil(caches.open(name).then(c => c.put(key, copy)).catch(err => console.warn("[sw] no cabe", key, msg(err))));
}

/* js, css y html de esta versión: del shell; si no está (LAZY, o no se pudo guardar al instalar), de la red */
async function shellFirst(req, url, e){
  const key = keyOf(url), hit = await (await caches.open(SHELL_CACHE)).match(key);
  if(hit) return hit;
  try{
    const res = await fetch(req);
    if(good(res)) keep(e, SHELL_CACHE, key, res);
    return res;
  }catch(err){ return Response.error(); }
}

/* con otro «?v=»: la red y, sin red, solo esa misma URL guardada (con su «?v=») */
async function sameUrl(req, e){
  try{
    const res = await fetch(req);
    if(good(res)) keep(e, SHELL_CACHE, req.url, res);
    return res;
  }catch(err){
    return (await caches.match(req.url)) || Response.error();
  }
}

/* imágenes y audios: de vocab-media (o del shell); si no están, de la red entera (sin Range) y se guardan */
async function mediaFirst(req, url, e){
  const media = await caches.open(MEDIA_CACHE), key = url.search ? req.url : keyOf(url);
  let res = await media.match(key);
  if(!res && inShell(url)) res = await (await caches.open(SHELL_CACHE)).match(keyOf(url));
  if(!res){
    try{
      res = await fetch(req.url, {credentials: "same-origin"});
      if(res.status === 200 && !res.redirected) keep(e, MEDIA_CACHE, key, res);
    }catch(err){
      res = await caches.match(key);
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

/* la página y los datos: primero la red (y se guarda: el shell en el shell actual, los datos en vocab-media), como
   mucho NET_WAIT; si tarda más, lo guardado, y si no hay nada guardado, se sigue esperando a la red. Con la red lenta
   (slowUntil), lo guardado sin esperar, y la red sigue detrás para la próxima vez */
async function networkFirst(req, url, e){
  const key = keyOf(url), t0 = Date.now();
  const net = fetch(req).then(res => {
    if(good(res)) keep(e, cacheFor(url), key, res);
    if(Date.now() - t0 < NET_WAIT) slowUntil = 0;
    return res;
  });
  if(Date.now() < slowUntil){
    const saved = await fromCaches(req, key);
    if(saved){ e.waitUntil(net.catch(() => {})); return saved; }
  }
  let t = 0;
  const late = new Promise(r => { t = setTimeout(() => { slowUntil = Date.now() + SLOW_FOR; r(); }, NET_WAIT); });
  try{
    const res = await Promise.race([net, late]);
    if(res){ clearTimeout(t); return res; }
  }catch(err){
    clearTimeout(t);
    return (await fromCaches(req, key)) || Response.error();
  }
  const saved = await fromCaches(req, key);
  if(saved){ e.waitUntil(net.catch(() => {})); return saved; }
  try{ return await net; }catch(err){ return Response.error(); }
}
/* lo guardado de una página o de unos datos (por su clave, sin «?…»: no llevan «?v=») */
async function fromCaches(req, key){
  const shell = await caches.open(SHELL_CACHE);
  let res = await shell.match(key);
  if(!res) res = await (await caches.open(MEDIA_CACHE)).match(key);
  if(!res) res = await caches.match(key);
  if(!res && req.mode === "navigate") res = await shell.match(abs("index.html"));
  return res || null;
}
