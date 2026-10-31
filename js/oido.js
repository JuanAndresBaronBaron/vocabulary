/* módulo oido: «¿Qué oíste?», un juego de Juegos registrado con vocabGames.register (como js/lince.js).
   Ruta: #/juegos/oido. Entrenamiento del oído con pares mínimos (identificación: suena una palabra y el niño toca cuál
     de 2 fue; lo que mejor funciona y dura: HVPT, Uchihara 2025; con niños de 8 años, Giannakopoulou 2017). No usa el
     tema elegido (son sonidos, no temas): words «No usa el tema».
   Una ronda: 20 palabras (unos 5 minutos). Suena la palabra (el audio grabado: solo pares con audio de las dos en
     audio/<ab>.json; la voz del navegador no vale para esto) y salen 2 tarjetas con la palabra escrita, su IPA
     (ipaHtml, salvo que un mayor la apague) y el dibujo si las dos lo tienen.
     Acierto: la tarjeta en verde azulado con ✓, la palabra vuelve a sonar y sigue sola.
     Fallo: la elegida en gris con ✗ (sin sonido triste) y la buena con ✓; suenan las dos, una detrás de otra (la
     elegida y luego la buena), y «Seguir» sale en el dock de abajo. Tocar una tarjeta la vuelve a decir. El par
     fallado vuelve con la misma palabra 3 a 5 palabras después (2 veces como mucho).
     Los pares van mezclados entre los contrastes del nivel (mezclar lo que se confunde ayuda a distinguirlo).
   Niveles (api.level, def.levels: ★★★ abre el siguiente): 1 = 3 contrastes fáciles, 2 = 6, 3 = todos.
   Estrellas por aciertos: 18-20 ★★★, 14-17 ★★, si no ★. El resultado dice qué contraste costó más.
   Las palabras no van al repaso (noReview): un fallo de oído no es una palabra olvidada.
   Teclas (def.keys): 1 y 2 (o ← →) eligen · Espacio repite · T despacio · Enter sigue. No guarda nada propio.
   Para las pruebas: window.vocabOido.pairs() (los pares de cada idioma); root.oiTarget (la palabra que suena) y en
   cada tarjeta .oiOk (la buena) y .oiK (0 o 1 dentro del par). */
(() => {
"use strict";

const ID = "oido", N = 20;
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
const ARTS = {
  english: /^(?:the|an?|to)\s+/i,
  "français": /^(?:les|le|la|une|un|des|du|se)\s+|^(?:l|s|d)['’]/i,
  dansk: /^(?:en|et|at)\s+/i,
};

/* los pares mínimos de cada idioma: [nivel, [[palabra A, palabra B], …]] por contraste (el primer par le da nombre).
   Cada palabra: [texto (el de data/<d>.json, con su artículo; la clave de audio/<ab>.json), IPA, dibujo o "", español].
   Solo palabras con audio grabado; inglés: i/iː, a/ʌ, ch/sh (nivel 1), a/e, th/t, th/s (2), b/v, ɔː/ɜː, ɔː/əʊ, a/ɑː,
   ɒ/ʌ, s/sh, ʊ/uː (3); francés: u/ou, le/les y de/deux, a/an (1), b/v, an/in/on, u/i (2), s/z (3); danés: a/e, a/u,
   u/å (1), i-e/y, u-o/y, æ/ø (2), i/e, o/æ, u/ø y vocal larga/corta (3) */
const PAIRS = {
  "english": [
    [1, [
      [["ship", "/ʃɪp/", "img/om_1F6A2.png", "barco"], ["sheep", "/ʃiːp/", "img/f1dcc1b9cc.png", "oveja"]],
      [["sit", "/sɪt/", "", "sentarse"], ["seat", "/siːt/", "img/om_1F4BA.png", "asiento"]],
      [["hit", "/hɪt/", "img/om_1F94A.png", "golpear"], ["heat", "/hiːt/", "img/om_1F975.png", "calor"]],
      [["chip", "/tʃɪp/", "img/om_1F35F.png", "patata frita"], ["cheap", "/tʃiːp/", "", "barato"]],
      [["bin", "/bɪn/", "img/om_1F5D1.png", "cubo de basura"], ["bean", "/biːn/", "img/om_1FAD8.png", "judía"]],
      [["bit", "/bɪt/", "", "trozo"], ["beat", "/biːt/", "", "vencer"]],
      [["fill", "/fɪl/", "", "llenar"], ["feel", "/fiːl/", "", "sentir"]],
      [["it", "/ɪt/", "", "eso"], ["eat", "/iːt/", "img/om_1F374.png", "comer"]],
      [["still", "/stɪl/", "", "todavía"], ["steal", "/stiːl/", "", "robar"]],
    ]],
    [1, [
      [["cat", "/kæt/", "img/ab47b70a6b.png", "gato"], ["cut", "/kʌt/", "img/om_2702.png", "cortar"]],
      [["cap", "/kæp/", "img/om_1F9E2.png", "gorra"], ["cup", "/kʌp/", "img/om_1F964.png", "taza"]],
      [["fan", "/fæn/", "", "aficionado"], ["fun", "/fʌn/", "", "diversión"]],
      [["mad", "/mæd/", "img/om_1F621.png", "enfadado"], ["mud", "/mʌd/", "", "barro"]],
      [["ankle", "/ˈæŋkl/", "", "tobillo"], ["uncle", "/ˈʌŋkl/", "img/fam_Tío.png", "tío"]],
      [["match", "/mætʃ/", "img/om_1F3C6.png", "combate"], ["much", "/mʌtʃ/", "", "mucho"]],
      [["lack", "/læk/", "", "falta"], ["luck", "/lʌk/", "img/om_1F340.png", "suerte"]],
      [["app", "/æp/", "img/om_1F4F1.png", "aplicación"], ["up", "/ʌp/", "img/om_2B06.png", "arriba"]],
    ]],
    [1, [
      [["chip", "/tʃɪp/", "img/om_1F35F.png", "patata frita"], ["ship", "/ʃɪp/", "img/om_1F6A2.png", "barco"]],
      [["cheap", "/tʃiːp/", "", "barato"], ["sheep", "/ʃiːp/", "img/f1dcc1b9cc.png", "oveja"]],
      [["chair", "/tʃeə/", "img/om_1FA91.png", "silla"], ["share", "/ʃeə/", "", "compartir"]],
      [["watch", "/wɒtʃ/", "", "mirar"], ["wash", "/wɒʃ/", "img/om_E0B2.png", "lavar"]],
      [["which", "/wɪtʃ/", "", "cuál"], ["wish", "/wɪʃ/", "img/om_1F320.png", "desear"]],
      [["cheat", "/tʃiːt/", "", "hacer trampa"], ["sheet", "/ʃiːt/", "img/om_E31A.png", "sábana"]],
      [["catch", "/kætʃ/", "", "atrapar"], ["cash", "/kæʃ/", "", "dinero"]],
    ]],
    [2, [
      [["pan", "/pæn/", "img/om_1F373.png", "sartén"], ["pen", "/pen/", "img/om_1F58A.png", "bolígrafo"]],
      [["bad", "/bæd/", "img/om_1F44E.png", "malo"], ["bed", "/bed/", "img/om_1F6CF.png", "cama"]],
      [["sand", "/sænd/", "", "arena"], ["send", "/send/", "img/om_1F4E4.png", "enviar"]],
      [["band", "/bænd/", "img/om_1F941.png", "grupo"], ["bend", "/bend/", "", "doblar"]],
      [["and", "/ænd/", "", "y"], ["end", "/end/", "", "final"]],
      [["gas", "/ɡæs/", "", "gas"], ["guess", "/ɡes/", "", "adivinar"]],
      [["land", "/lænd/", "", "tierra"], ["lend", "/lend/", "", "prestar"]],
    ]],
    [2, [
      [["three", "/θriː/", "", "tres"], ["tree", "/triː/", "img/om_1F333.png", "árbol"]],
      [["thin", "/θɪn/", "", "delgado"], ["tin", "/tɪn/", "img/om_1F96B.png", "lata"]],
      [["both", "/bəʊθ/", "", "ambos"], ["boat", "/bəʊt/", "img/om_26F5.png", "barco"]],
      [["theme", "/θiːm/", "", "tema"], ["team", "/tiːm/", "", "equipo"]],
      [["through", "/θruː/", "", "a través de"], ["true", "/truː/", "", "verdadero"]],
      [["path", "/pɑːθ/", "", "camino"], ["part", "/pɑːt/", "img/om_1F9E9.png", "parte"]],
    ]],
    [2, [
      [["mouth", "/maʊθ/", "img/om_1F444.png", "boca"], ["mouse", "/maʊs/", "img/om_1F401.png", "ratón"]],
      [["thing", "/θɪŋ/", "", "cosa"], ["sing", "/sɪŋ/", "img/om_1F9D1-200D-1F3A4.png", "cantar"]],
      [["think", "/θɪŋk/", "img/om_1F914.png", "pensar"], ["sink", "/sɪŋk/", "", "hundirse"]],
      [["thick", "/θɪk/", "", "grueso"], ["sick", "/sɪk/", "img/om_1F922.png", "enfermo"]],
      [["path", "/pɑːθ/", "", "camino"], ["pass", "/pɑːs/", "", "pasar"]],
      [["worth", "/wɜːθ/", "", "valer"], ["worse", "/wɜːs/", "", "peor"]],
    ]],
    [3, [
      [["boat", "/bəʊt/", "img/om_26F5.png", "barco"], ["vote", "/vəʊt/", "img/om_1F5F3.png", "voto"]],
      [["ban", "/bæn/", "", "prohibir"], ["van", "/væn/", "img/om_1F690.png", "furgoneta"]],
      [["bury", "/ˈberi/", "", "enterrar"], ["very", "/ˈveri/", "", "muy"]],
    ]],
    [3, [
      [["walk", "/wɔːk/", "img/om_1F6B6.png", "caminar"], ["work", "/wɜːk/", "img/om_1F4BC.png", "trabajar"]],
      [["bored", "/bɔːd/", "img/om_1F971.png", "aburrido"], ["bird", "/bɜːd/", "img/7b989cb8cb.png", "pájaro"]],
      [["short", "/ʃɔːt/", "", "corto"], ["shirt", "/ʃɜːt/", "img/om_1F45A.png", "camisa"]],
      [["four", "/fɔː/", "", "cuatro"], ["fur", "/fɜː/", "", "pelo"]],
    ]],
    [3, [
      [["ball", "/bɔːl/", "img/om_1F3D0.png", "pelota"], ["bowl", "/bəʊl/", "img/om_1F963.png", "cuenco"]],
      [["hall", "/hɔːl/", "", "vestíbulo"], ["hole", "/həʊl/", "img/om_1F573.png", "agujero"]],
      [["law", "/lɔː/", "img/om_2696.png", "ley"], ["low", "/ləʊ/", "", "bajo"]],
      [["call", "/kɔːl/", "img/om_1F4DE.png", "llamar"], ["coal", "/kəʊl/", "", "carbón"]],
    ]],
    [3, [
      [["hat", "/hæt/", "img/om_1F452.png", "sombrero"], ["heart", "/hɑːt/", "img/om_1FAC0.png", "corazón"]],
      [["ant", "/ænt/", "img/cae92e8b2c.png", "hormiga"], ["aunt", "/ɑːnt/", "img/fam_Tía.png", "tía"]],
      [["pack", "/pæk/", "img/om_1F9F3.png", "hacer la maleta"], ["park", "/pɑːk/", "img/om_1F3DE.png", "parque"]],
      [["chat", "/tʃæt/", "img/om_1F4AC.png", "charlar"], ["chart", "/tʃɑːt/", "img/om_1F4CA.png", "gráfico"]],
    ]],
    [3, [
      [["lock", "/lɒk/", "img/om_1F512.png", "cerrar con llave"], ["luck", "/lʌk/", "img/om_1F340.png", "suerte"]],
      [["boss", "/bɒs/", "", "jefe"], ["bus", "/bʌs/", "img/om_1F68C.png", "autobús"]],
      [["not", "/nɒt/", "", "no"], ["nut", "/nʌt/", "img/om_1F95C.png", "fruto seco"]],
    ]],
    [3, [
      [["see", "/siː/", "img/om_1F441.png", "ver"], ["she", "/ʃiː/", "", "ella"]],
      [["seat", "/siːt/", "img/om_1F4BA.png", "asiento"], ["sheet", "/ʃiːt/", "img/om_E31A.png", "sábana"]],
      [["sell", "/sel/", "", "vender"], ["shell", "/ʃel/", "img/om_1F41A.png", "concha"]],
      [["sign", "/saɪn/", "img/om_E094.png", "señal"], ["shine", "/ʃaɪn/", "img/om_2728.png", "brillar"]],
      [["suit", "/suːt/", "img/om_1F935.png", "traje"], ["shoot", "/ʃuːt/", "img/om_1F52B.png", "disparar"]],
    ]],
    [3, [
      [["pull", "/pʊl/", "", "tirar de"], ["pool", "/puːl/", "", "piscina"]],
    ]],
  ],
  "français": [
    [1, [
      [["la rue", "/ʁy/", "", "calle"], ["la roue", "/ʁu/", "img/om_1F6DE.png", "rueda"]],
      [["tu", "/ty/", "", "tú"], ["tout", "/tu/", "", "todo"]],
      [["au-dessus de", "/o dəsy də/", "img/om_2B06.png", "encima de"], ["au-dessous de", "/o dəsu də/", "img/om_2B07.png", "debajo de"]],
    ]],
    [1, [
      [["le", "/lə/", "", "el"], ["les", "/le/", "", "los, las"]],
      [["de", "/də/", "", "de"], ["deux", "/dø/", "", "dos"]],
    ]],
    [1, [
      [["le chat", "/ʃa/", "img/ab47b70a6b.png", "gato"], ["le chant", "/ʃɑ̃/", "img/om_1F9D1-200D-1F3A4.png", "canto"]],
      [["le plat", "/pla/", "img/om_1F958.png", "plato"], ["le plan", "/plɑ̃/", "", "plan"]],
    ]],
    [2, [
      [["la bague", "/baɡ/", "img/om_1F48D.png", "anillo"], ["la vague", "/vaɡ/", "img/om_1F30A.png", "ola"]],
      [["boire", "/bwaʁ/", "img/om_1F964.png", "beber"], ["voir", "/vwaʁ/", "img/om_1F441.png", "ver"]],
      [["le bol", "/bɔl/", "img/om_1F963.png", "cuenco"], ["le vol", "/vɔl/", "", "vuelo"]],
    ]],
    [2, [
      [["le vent", "/vɑ̃/", "img/om_1F32C.png", "viento"], ["le vin", "/vɛ̃/", "img/om_1F377.png", "vino"]],
      [["le pain", "/pɛ̃/", "img/om_1F35E.png", "pan"], ["le pont", "/pɔ̃/", "img/om_1F309.png", "puente"]],
      [["le sang", "/sɑ̃/", "img/om_1FA78.png", "sangre"], ["le son", "/sɔ̃/", "img/om_1F50A.png", "sonido"]],
      [["le lien", "/ljɛ̃/", "img/om_1F517.png", "enlace"], ["le lion", "/ljɔ̃/", "img/713bcab96b.png", "león"]],
    ]],
    [2, [
      [["la vue", "/vy/", "img/om_1F453.png", "vista"], ["la vie", "/vi/", "", "vida"]],
      [["l'autruche", "/otʁyʃ/", "img/83386f8705.jpeg", "avestruz"], ["l'Autriche", "/otʁiʃ/", "img/bbb5304098.png", "Austria"]],
    ]],
    [3, [
      [["le poisson", "/pwasɔ̃/", "img/33c5decbaa.png", "pez"], ["le poison", "/pwazɔ̃/", "img/om_2620.png", "veneno"]],
    ]],
  ],
  "dansk": [
    [1, [
      [["en sang", "/ˈsɑŋˀ/", "img/om_1F9D1-200D-1F3A4.png", "canto"], ["en seng", "/ˈsɛŋˀ/", "img/om_1F6CF.png", "cama"]],
      [["et barn", "/ˈbɑˀn/", "img/om_1F9D2.png", "niño"], ["et ben", "/ˈbeˀn/", "img/om_1F9B5.png", "pierna"]],
    ]],
    [1, [
      [["en mand", "/ˈmanˀ/", "img/om_1F468.png", "hombre"], ["en mund", "/ˈmɔnˀ/", "img/om_1F444.png", "boca"]],
      [["kan", "/ˈkan/", "", "puede"], ["kun", "/ˈkɔn/", "", "solo"]],
    ]],
    [1, [
      [["en hund", "/hunˀ/", "img/3e394d37a4.png", "perro"], ["en hånd", "/ˈhʌnˀ/", "img/om_270B.png", "mano"]],
    ]],
    [2, [
      [["en bi", "/biˀ/", "img/7280962d48.png", "abeja"], ["en by", "/ˈbyˀ/", "img/om_E203.png", "pueblo"]],
      [["ni", "/niˀ/", "", "nueve"], ["ny", "/ˈnyˀ/", "img/om_1F195.png", "nuevo"]],
      [["en ske", "/ˈsgeˀ/", "img/om_1F944.png", "cuchara"], ["en sky", "/ˈsgyˀ/", "img/om_2601.png", "nube"]],
    ]],
    [2, [
      [["en tur", "/ˈtuɐ̯ˀ/", "img/om_1F9F3.png", "viaje"], ["en tyr", "/tyɐ̯ˀ/", "img/5cc01772f5.png", "toro"]],
      [["en sko", "/ˈsgoˀ/", "img/om_1F45E.png", "zapato"], ["en sky", "/ˈsgyˀ/", "img/om_2601.png", "nube"]],
    ]],
    [2, [
      [["en hane", "/ˈhæːnə/", "img/4c2e0dd3e8.png", "gallo"], ["en høne", "/ˈhøːnə/", "img/f501d7335c.png", "gallina"]],
      [["at læse", "/ˈlɛːsə/", "img/om_1F4D6.png", "leer"], ["at løse", "/ˈløːsə/", "", "resolver"]],
    ]],
    [3, [
      [["en vin", "/ˈviˀn/", "img/om_1F377.png", "vino"], ["en ven", "/ˈvɛn/", "img/om_1FAC2.png", "amigo"]],
      [["min", "/ˈmin/", "", "mi"], ["men", "/mɛn/", "", "pero"]],
      [["din", "/ˈdin/", "", "tu"], ["den", "/ˈdɛn/", "", "eso"]],
    ]],
    [3, [
      [["en sol", "/ˈsoˀl/", "img/om_2600.png", "sol"], ["en sæl", "/sɛˀl/", "img/8d0f97639c.png", "foca"]],
    ]],
    [3, [
      [["en frugt", "/ˈfʁɔgd/", "img/om_1F347.png", "fruta"], ["en frygt", "/ˈfʁøgd/", "img/om_1F628.png", "miedo"]],
    ]],
    [3, [
      [["at tale", "/ˈtæːlə/", "img/om_1F5E3.png", "hablar"], ["at tælle", "/ˈtɛlə/", "img/om_1F522.png", "contar"]],
      [["at hvile", "/ˈviːlə/", "", "descansar"], ["at ville", "/ˈvilə/", "", "querer"]],
    ]],
  ],
};

/* los contrastes del nivel con los pares que tienen audio de las dos palabras: [{k (nombre: «ship · sheep»), lv, ps}] */
const hasClip = w => { try{ return typeof clipFor === "function" && !!clipFor(w); }catch(e){ return false; } };
const mk = a => ({w: String(a[0]), ipa: String(a[1] || ""), img: a[2] ? String(a[2]) : "", es: String(a[3] || "")});
function contrasts(L, lv){
  return (PAIRS[L] || []).map(([l, ps]) => ({k: `${ps[0][0][0]} · ${ps[0][1][0]}`, lv: l,
    ps: ps.map(p => [mk(p[0]), mk(p[1])]).filter(p => hasClip(p[0].w) && hasClip(p[1].w))}))
    .filter(c => c.lv <= lv && c.ps.length);
}
/* el mapa de audios (audio/<ab>.json) puede no haber llegado recién abierta la app: se espera como mucho 3 s */
async function clipsReady(L){
  const w = PAIRS[L] && PAIRS[L][0] && PAIRS[L][0][1][0][0][0];
  for(let i = 0; i < 30; i++){
    if(!w || hasClip(w) || typeof clipFor !== "function") return;
    await new Promise(r => setTimeout(r, 100));
  }
}
/* las 20 palabras: los contrastes por turnos (en orden al azar), en cada uno sus pares barajados; en cada par suena una
   vez una y otra vez la otra; el mismo par nunca dos veces seguidas */
function plan(C){
  const qs = shuffle(C).map(c => ({c, ps: shuffle(c.ps), i: 0}));
  const flip = new Map(), out = [];
  let guard = 0;
  while(out.length < N && guard++ < 400){
    for(const q of qs){
      if(out.length >= N) break;
      let p = q.ps[q.i++ % q.ps.length];
      const prev = out[out.length - 1];
      if(prev && prev.p === p && q.ps.length > 1) p = q.ps[q.i++ % q.ps.length];
      if(prev && prev.p === p) continue;
      const t = flip.has(p) ? 1 - flip.get(p) : (Math.random() < .5 ? 0 : 1);
      flip.set(p, t);
      out.push({c: q.c, p, t});
    }
  }
  return out;
}
function splitArt(w){
  const m = w.match(ARTS[lang] || /^$/);
  return m && m[0].length < w.length ? {art: m[0].trim(), base: w.slice(m[0].length)} : {art: "", base: w};
}
const wordFs = w => { const n = [...w].length; return n <= 5 ? "1.75rem" : n <= 8 ? "1.5rem" : n <= 12 ? "1.25rem" : "1.05rem"; };

const CSS = `
.oi{--oi-ok:#007a8f;--oi-ok-d:#005c6b}
.oi-listen{margin-bottom:12px}
.oi-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:560px;margin:0 auto}
.oi-c{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:clamp(200px,calc(100dvh - 430px),400px);padding:14px 10px;margin:0;border:0;
  border-radius:var(--r-card);background:var(--card);color:var(--label);font:inherit;text-align:center;cursor:pointer;touch-action:manipulation;
  box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep);-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none;
  transition:background-color .2s,color .2s,box-shadow .2s,transform .2s;animation:gm-in .3s calc(var(--i) * 70ms) backwards}
.oi-c.oi-txt{min-height:clamp(150px,calc(100dvh - 500px),300px)}
.oi-pic{width:min(220px,92%);aspect-ratio:1;border-radius:22px;background:var(--gm-tile);display:grid;place-items:center;transition:opacity .2s,filter .2s}
.oi-pic img{width:92%;height:92%;object-fit:contain;pointer-events:none;mix-blend-mode:multiply}
.oi-w{display:block;max-width:100%;font:800 1.5rem/1.15 var(--f-round);overflow-wrap:anywhere}
.oi-w .oi-a{font-weight:600;opacity:.8}
.oi-ipa{display:block;max-width:100%;min-height:1.3em;font-size:var(--fs-sub);line-height:1.3;overflow-wrap:anywhere}
.oi-es{display:block;min-height:1.3em;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2);visibility:hidden}
.oi.oi-done .oi-es{visibility:visible}
.oi-mk{position:absolute;right:-6px;top:-6px;width:34px;height:34px;border-radius:50%;display:none;place-items:center;color:#fff;box-shadow:0 0 0 3px var(--card),0 2px 6px rgba(0,0,0,.2);z-index:2}
.oi-c.is-ok,.oi-c.is-right{background:var(--oi-ok);color:#fff;box-shadow:none}
.oi-c.is-ok :is(.oi-es,.ipa),.oi-c.is-right :is(.oi-es,.ipa){color:#fff}
.oi-c.is-ok .oi-mk,.oi-c.is-right .oi-mk{display:grid;background:var(--oi-ok-d)}
.oi-c.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.oi-c.is-miss :is(.oi-es,.ipa){color:var(--miss-on)}
.oi-c.is-miss .oi-pic{filter:grayscale(1);opacity:.6}
.oi-c.is-miss .oi-mk{display:grid;background:var(--miss)}
.oi-c.oi-now{transform:scale(1.04)}
@media (hover:hover){.oi:not(.oi-done) .oi-c:hover{box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--brand-tint)}}
.oi-c:focus-visible,.oi-slow:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.oi .gm-ltxt b{color:var(--label)}
.oi-slow{width:48px;height:48px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--fill2);color:var(--label);cursor:pointer}
.oi-slow.playing{background:var(--brand-fill);color:#fff}
.oi .gm-dots{gap:5px}
.oi .gm-dots i{width:11px;height:11px}
.oi .gm-dots i.ok{background:var(--oi-ok)}
.oi-dock{position:fixed;z-index:5;left:max(16px,var(--safe-l),calc(50% - 280px));right:max(16px,var(--safe-r),calc(50% - 280px));
  bottom:calc(var(--safe-b) + 16px);display:flex;gap:12px;pointer-events:none}
.oi-dock:empty{display:none}
.oi-dock>*{pointer-events:auto;flex:1}
.oi-dock::before{content:"";position:absolute;z-index:-1;left:-16px;right:-16px;top:-20px;bottom:calc(-1 * (var(--safe-b) + 16px));
  background:linear-gradient(to bottom,transparent,var(--bg) 45%);pointer-events:none}
.oi-sp{height:calc(var(--btn-main) + 24px)}
.gm-short .oi-c{min-height:146px;padding:10px 8px}
.gm-short .oi-c.oi-txt{min-height:110px}
.gm-short .oi-pic{width:min(116px,84%,22vh);width:min(116px,84%,22svh)}
.gm-short .oi-sp{height:calc(var(--btn-main) + 16px)}
@media (max-width:360px){.oi-w{font-size:1.25rem}}
@media (prefers-reduced-motion: reduce){.oi-c,.oi-pic{transition:none;animation:none}.oi-c.oi-now{transform:none}}`;
function css(){
  if(document.getElementById("css-oido")) return;
  const s = document.createElement("style"); s.id = "css-oido"; s.textContent = CSS; document.head.appendChild(s);
}

async function start(app, api, mode){
  const my = api.nav(), L = lang;
  css();
  await clipsReady(L);
  if(!api.here(my, ID) || lang !== L) return;
  const lv = api.level(ID);
  let C = contrasts(L, lv);
  if(C.reduce((n, c) => n + c.ps.length, 0) < 3){
    app.innerHTML = `<div class="gm"><div class="gm-empty"><p>${(PAIRS[L] || []).length ? "Este juego necesita el audio grabado. Prueba con conexión a internet." : `Este juego todavía no tiene sonidos en ${esc(api.nm())}.`}</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
    return;
  }
  const Q = plan(C);
  Q.forEach(q => q.p.forEach(x => { if(x.img){ const im = new Image(); im.src = pic(x.img); } }));
  const code = LANGS[lang].code;
  const run = api.mount(app, `<div class="gm oi" id="oi">
    ${api.topHtml(ID, `<span class="gm-pill" title="Nivel">${IC("ear", "bold", 18)}<span>Nivel ${lv}</span></span>`)}
    <div class="gm-listen oi-listen">
      <button type="button" class="gm-bigsay" id="oi-play" aria-label="Escuchar otra vez">${IC("speaker-high", "fill", 34)}</button>
      <button type="button" class="oi-slow" id="oi-slow" aria-label="Escuchar despacio">${IC("turtle", "fill", 30)}</button>
      <div class="gm-ltxt" id="oi-txt" aria-live="polite">¿Qué oíste?</div>
    </div>
    <div class="oi-cards" id="oi-cards" role="group" aria-labelledby="oi-txt"></div>
    ${api.dotsHtml(N)}
    <div class="oi-sp" id="oi-sp" aria-hidden="true"></div>
    <div class="oi-dock" id="oi-next"></div></div>`, mode);
  const root = run.root, box = root.querySelector("#oi-cards"), nextBox = root.querySelector("#oi-next"), txt = root.querySelector("#oi-txt");
  const playB = root.querySelector("#oi-play");
  let r = 0, score = 0, cur = null, answered = false, started = false, tok = 0, talkN = 0, fit = null;
  const res = [], miss = new Map(), heard = [];
  const live = () => api.live(run);
  const cards = () => [...box.querySelectorAll(".oi-c")];
  const dots = () => root.querySelectorAll("#gm-dots i").forEach((d, i) => { d.className = i < res.length ? (res[i] ? "ok" : "meh") : i === r ? "now" : ""; });
  const target = () => cur && cur.p[cur.t];
  /* la palabra suena desde el altavoz grande (o la tortuga, despacio): siempre su audio grabado */
  const hear = slow => { const t = target(); if(!t || !live()) return; talkN++; try{ say(t.w, slow ? root.querySelector("#oi-slow") : playB, !!slow); }catch(e){} };
  async function sayCard(x){
    const c = cards().find(el => el.dataset.w === x.w);
    if(c) c.classList.add("oi-now");
    try{ await sayP(x.w); }catch(e){}
    if(c) c.classList.remove("oi-now");
  }
  const wait = ms => new Promise(res => api.later(run, res, ms));
  let uid = 0;
  function cardHtml(x, i, pics){
    const {art, base} = splitArt(x.w), id = `oi-w${++uid}`;
    return `<button type="button" class="oi-c${pics ? "" : " oi-txt"}" data-i="${i}" data-w="${esc(x.w)}" style="--i:${i}" aria-labelledby="${id} ${id}s">
      ${pics ? `<span class="oi-pic" aria-hidden="true"><img src="${esc(pic(x.img))}" alt="" draggable="false"></span>` : ""}
      <span class="oi-w" id="${id}" lang="${esc(code)}" style="font-size:${wordFs(x.w)}">${art ? `<span class="oi-a">${esc(art)}</span>${/['’]$/.test(art) ? "" : " "}` : ""}${esc(base)}</span>
      ${ipaOn() && x.ipa ? `<span class="oi-ipa" aria-hidden="true">${ipaHtml(x.ipa, code)}</span>` : ""}
      <span class="oi-es" aria-hidden="true">${esc(x.es)}</span>
      <span class="oi-mk" aria-hidden="true"></span><span class="vh oi-st" id="${id}s" lang="es"></span></button>`;
  }
  function round(){
    cur = Q[r]; answered = false; tok++;
    const pics = cur.p.every(x => x.img), order = Math.random() < .5 ? [0, 1] : [1, 0];
    root.classList.remove("oi-done");
    box.innerHTML = order.map((k, i) => cardHtml(cur.p[k], i, pics)).join("");
    box.querySelectorAll(".oi-c").forEach((c, i) => { c.oiK = order[i]; c.oiOk = order[i] === cur.t; });   /* para las pruebas */
    root.oiTarget = target().w;
    nextBox.innerHTML = "";
    txt.textContent = "¿Qué oíste?";
    dots();
    if(fit) fit(false);
    playB.classList.remove("ring"); void playB.offsetWidth; playB.classList.add("ring");
    if(started) api.later(run, () => hear(false), RM() ? 250 : 550);
  }
  /* el par fallado vuelve con la misma palabra 3 a 5 palabras después, en lugar de una de las que faltaban (la ronda
     sigue en 20); si se vuelve a fallar, otra vez (2 como mucho) */
  function again(q){
    const n = (q.tries || 0) + 1; if(n > 2) return;
    const at = r + 3 + Math.floor(Math.random() * 3);
    if(at >= N) return;
    let k = Q.length - 1; while(k > at && Q[k].tries) k--;
    if(k < at) return;
    Q.splice(k, 1);
    Q.splice(at, 0, {c: q.c, p: q.p, t: q.t, tries: n});
  }
  function choose(c){
    if(!started || answered || !cur || !live()) return;
    const x = cur.p[c.oiK]; if(!x) return;
    answered = true;
    const my = tok, t = target(), ok = x === t;
    try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
    res.push(ok); heard.push({x: t, ok});
    api.answer(ok, {es: t.es, word: t.w});
    root.classList.add("oi-done");
    dots();
    if(ok){
      score++;
      c.classList.add("is-ok"); c.querySelector(".oi-mk").innerHTML = IC("check", "bold", 20);
      c.querySelector(".oi-st").textContent = "Es esta";
      api.haptic("success"); api.snd("ok");
      try{ if(window.M && typeof M.ok === "function") M.ok(c); }catch(e){}
      txt.innerHTML = `✓ <b lang="${esc(code)}">${esc(t.w)}</b> = ${esc(t.es)}`;
      const sc = root.querySelector("#gm-sc"); if(sc){ sc.textContent = score; api.bump(sc.parentNode); }
      const t0 = performance.now();
      (async () => {
        await wait(200);
        if(tok !== my) return;
        await sayCard(t);
        await wait(Math.max(350, 1100 - (performance.now() - t0)));
        if(live() && tok === my) next();
      })();
      return;
    }
    /* fallo: la elegida en gris con ✗, la buena con ✓; suenan las dos para oír la diferencia */
    miss.set(cur.c.k, (miss.get(cur.c.k) || 0) + 1);
    again(cur);
    c.classList.add("is-miss"); c.querySelector(".oi-mk").innerHTML = IC("x", "bold", 18);
    c.querySelector(".oi-st").textContent = "No era esta. Toca para oírla";
    const right = cards().find(el => el.oiOk);
    if(right){ right.classList.add("is-right"); right.querySelector(".oi-mk").innerHTML = IC("check", "bold", 20); right.querySelector(".oi-st").textContent = "Era esta. Toca para oírla"; }
    txt.innerHTML = `Era <b lang="${esc(code)}">${esc(t.w)}</b>. Escucha las dos.`;
    showNext();
    const n0 = talkN;
    (async () => {
      await wait(300);
      for(const w of [x, t]){
        if(tok !== my || talkN !== n0) break;   /* si el niño toca una tarjeta para oírla, se deja de comparar */
        await sayCard(w);
        await wait(350);
      }
    })();
  }
  function showNext(){
    if(!live() || nextBox.firstChild) return;
    const last = r + 1 >= N;
    nextBox.innerHTML = `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="oi-go" data-key="enter">${last ? "Ver el premio" : "Seguir"}${IC("caret-right", "bold", 20)}</button>`;
    const b = nextBox.querySelector("#oi-go");
    b.onclick = next;
    if(api.kbd && api.kbd()) try{ b.focus({preventScroll: true}); }catch(e){}
  }
  function next(){
    if(!answered || !live()) return;
    tok++;
    try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
    r++;
    if(r < N){ round(); return; }
    end();
  }
  function end(){
    const stars = score >= 18 ? 3 : score >= 14 ? 2 : 1;
    const seen = new Map();
    for(const h of heard){ const o = seen.get(h.x.w) || {word: h.x.w, es: h.x.es, img: h.x.img, ipa: h.x.ipa, miss: false}; if(!h.ok) o.miss = true; seen.set(h.x.w, o); }
    const worst = [...miss.entries()].sort((a, b) => b[1] - a[1])[0];
    const line = score === N ? `¡${N} de ${N}! Escuchaste con mucha atención.`
      : `Acertaste ${score} de ${N}.${worst ? ` Lo que más te costó: ${worst[0]}.` : ""}`;
    api.finish(run, ID, {score, stars, lv, words: [...seen.values()], line});
  }
  box.addEventListener("click", e => {
    const c = e.target.closest(".oi-c"); if(!c || !live()) return;
    if(!answered){ choose(c); return; }
    const x = cur && cur.p[c.oiK];
    if(x){ talkN++; sayCard(x); }
  });
  playB.onclick = () => hear(false);
  root.querySelector("#oi-slow").onclick = () => hear(true);
  const kb = e => {
    if(!started || !cur || e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.target.closest && e.target.closest("input,textarea,select")) return;
    const k = e.key;
    if(k === "1" || k === "2" || (!answered && (k === "ArrowLeft" || k === "ArrowRight"))){
      const c = cards()[k === "1" || k === "ArrowLeft" ? 0 : 1];
      if(c){ e.preventDefault(); c.click(); }
    } else if(k === " " && !(e.target.closest && e.target.closest("button,a"))){ e.preventDefault(); hear(false); }
    else if(k === "t" || k === "T"){ e.preventDefault(); hear(true); }
    else if(k === "Enter" && answered && nextBox.firstChild && !(e.target.closest && e.target.closest("button:not(#oi-go):not(.oi-c),a"))){ e.preventDefault(); next(); }   /* también desde la tarjeta ya tocada */
  };
  fit = api.autoFit(run, root.querySelector("#oi-sp"), null, true);
  round();
  api.intro(run, ID, () => { started = true; api.keys(run, kb); api.later(run, () => hear(false), RM() ? 200 : 450); });
}

const reg = window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(ID, {
  t: "¿Qué oíste?", sub: "Entrena el oído", img: "img/games/oido.png", sec: "palabras",
  how: "Escucha una palabra y toca la que oíste. Las dos suenan casi igual.",
  keys: "Con el teclado: 1 o 2 eligen, Espacio repite, T despacio y Enter sigue.",
  words: "No usa el tema: sonidos que se parecen",
  levels: true, noReview: true,
  fresh: "2026-10-31",
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} de ${N}`,
  start,
});
if(!reg) console.warn("[oido] no se pudo añadir a Juegos");
window.vocabOido = Object.freeze({pairs: () => JSON.parse(JSON.stringify(PAIRS))});
})();
