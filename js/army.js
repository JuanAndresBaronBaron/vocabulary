/* Módulo army: el soldado con rangos (Premios › Mi zorro › Personajes) y el juego «Misión por radio» (#/juegos/soldados).
   · El soldado es un personaje "hero" más de la tienda ("soldado" en data/game.json y data/sprites.json): se compra y se
     elige como los demás (js/shop.js). Su dibujo lo hace este módulo en SVG, de dibujos animados y sin armas, según el
     idioma elegido: inglés → US Army (uniforme de camuflaje OCP y gorra de campaña), francés → Légion étrangère (képi
     blanc, hombreras verdes y rojas y faja azul; desde sergent, el képi negro y rojo de los suboficiales y oficiales,
     según la instrucción de uniformes del armée de Terre) y danés → Hæren (camuflaje M/11, boina negra y bandera
     danesa). index.html lo pide a PJ_SRC.soldado() desde pjImg(); img/pj/soldado.png es solo el de reserva.
   · Rango: 13 por ejército (data/army/<en|fr|da>.json "ranks"). Sube con las lecciones del camino de ESE idioma
     ("map:<lang>" y lvLessons()): cada nivel MCER da dos ascensos, al hacer la mitad de sus lecciones y al acabarlo.
     Empieza en el más bajo al principio de A1 y es General al completar C2.
   · Mi zorro: con el soldado puesto, rewards.js llama a decorate(host) al pintar el personaje: debajo del nombre sale el
     rango en el idioma, con su IPA siempre a la vista, su altavoz, su significado en español y «Ver rangos» (la
     escalera entera en una hoja, con lo que falta para el siguiente).
   · Ascenso: «¡Ascendido a …!» (hoja con el soldado, la insignia, la palabra que suena, confeti y fanfarria) una vez por
     rango y por idioma, solo si el niño tiene el soldado, en la primera pantalla tranquila (fuera del modo foco y sin
     otra hoja abierta). El último rango visto va en "army:<lang>" (inventario PER_LANG de js/save.js). Al comprar el
     soldado, o la primera vez que se mira un idioma, se apunta el rango de ese momento sin fiesta. Nada se escribe al
     arrancar si no tiene el soldado.
   · Juego «Misión por radio» (vocabGames.register): 8 órdenes por radio, mezclando palabras de radio, órdenes de
     formación, el campamento, el alfabeto OTAN y los rangos (data/army/<ab>.json "terms" y "ranks"). Suena la orden
     (say(): su audio grabado si lo tiene; si no, la voz del idioma) y el niño toca entre 4 tarjetas grandes el dibujo
     bueno (cada una con su significado en español). Al contestar sale la frase de ejemplo. Estrellas: 7-8 ★★★, 5-6 ★★.
   API: window.vocabArmy = {svg(lang, r), src(lang?, r?), insignia(lang, r, px), rank() → número, info() → {r, per,
     next} | null, load(lang?) → Promise<datos>, decorate(host), ladder(from), celebrate(r?), refresh() → Promise}.
   Usa de index.html: bus, store, lang, LANGS, LVS, getMap, lvLessons, game, esc, ico, say, sayP, ipaHtml, ipaOn,
   PJ_SRC, ROUTES; window.M (motion.js), sfx (sfx.js) y vocabGames (games.js). */
(() => {
"use strict";
const W = window, D = document;
const AB = {english: "en", "français": "fr", dansk: "da"};
const ARMY = {english: "us", "français": "fr", dansk: "dk"};
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TOP = 12;                        /* 13 rangos: 0 … 12 */
const GID = "soldados", ROUNDS = 8, OPTS = 4;
const rm = () => { try{ return !!(W.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const E = s => (typeof esc === "function" ? esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c])));
const curLang = () => (typeof lang === "string" && AB[lang]) ? lang : "english";
const codeOf = L => (W.LANGS && LANGS[L] && LANGS[L].code) || (typeof LANGS !== "undefined" && LANGS[L] && LANGS[L].code) || "en-GB";
const IPA = (ipa, L) => (typeof ipaHtml === "function" ? ipaHtml(ipa, codeOf(L)) : (ipa ? `<span class="ipa">${E(ipa)}</span>` : ""));
const cap = s => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
const shuffle = a => { const b = a.slice(); for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* ================================================================ insignias (dibujo simplificado y reconocible) */
const GOLD = ["#E8B730", "#946C10"], SILV = ["#E6EAEF", "#6F7884"], DARK = ["#2B2B26", "#14140F"],
  GREEN = ["#2F9A40", "#16521E"], SAND = ["#EFE2B8", "#7C6A3A"];
/* [tipo, …]: chev(n, arcos, color, "up" | "down", estrella) · vbar(n, color) · hbar(n, color, hilo rojo) · leaf(color) ·
   eagle(color) · stars(n, color, franja). null = sin insignia (el recluta) */
const SPEC = {
  us: [null, ["chev", 1, 1, DARK, "up"], ["chev", 2, 0, DARK, "up"], ["chev", 3, 0, DARK, "up"], ["chev", 3, 1, DARK, "up"],
    ["chev", 3, 2, DARK, "up"], ["chev", 3, 3, DARK, "up"], ["vbar", 1, GOLD], ["vbar", 1, SILV], ["vbar", 2, SILV],
    ["leaf", GOLD], ["eagle", SILV], ["stars", 4, SILV]],
  fr: [null, ["chev", 1, 0, GREEN, "down"], ["chev", 2, 0, GREEN, "down"], ["chev", 3, 0, GREEN, "down"], ["chev", 1, 0, GOLD, "down"],
    ["chev", 2, 0, GOLD, "down"], ["hbar", 1, SILV, true], ["hbar", 1, GOLD, true], ["hbar", 1, GOLD], ["hbar", 2, GOLD],
    ["hbar", 3, GOLD], ["hbar", 5, GOLD], ["stars", 5, SILV]],
  dk: [null, ["chev", 1, 0, SAND, "down"], ["chev", 2, 0, SAND, "down"], ["chev", 3, 0, SAND, "down"], ["chev", 3, 1, SAND, "down"],
    ["chev", 3, 2, SAND, "down"], ["chev", 3, 3, SAND, "down"], ["chev", 3, 3, SAND, "down", true], ["stars", 1, GOLD],
    ["stars", 2, GOLD], ["stars", 3, GOLD], ["stars", 3, GOLD, true], ["stars", 4, GOLD]],
};
/* el fondo de la pestaña del pecho: el camuflaje de cada uniforme (la de la Légion, oscura como su patte de poitrine) */
const TAB = {us: ["#C9BA92", "#6E5F3E"], fr: ["#262B33", "#11151A"], dk: ["#55633A", "#2B331C"]};
function starPts(cx, cy, r){
  const p = [];
  for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; p.push((cx + rr * Math.cos(a)).toFixed(2) + "," + (cy + rr * Math.sin(a)).toFixed(2)); }
  return p.join(" ");
}
const star = (cx, cy, r, c) => `<polygon points="${starPts(cx, cy, r)}" fill="${c[0]}" stroke="${c[1]}" stroke-width="1.2" stroke-linejoin="round"/>`;
/* lo de dentro de la insignia en una caja de 40 × 48 */
function insInner(sp){
  if(!sp) return "";
  const k = sp[0];
  if(k === "chev"){
    const [, n, rk, c, dir, st] = sp, GAP = 6.6, H = 9, RH = 5.5;
    const total = (n - 1) * GAP + H + (rk ? rk * GAP + (st ? 8 : 1) : 0);
    let y = 24 - total / 2, out = "";
    const line = d => `<path d="${d}" fill="none" stroke="${c[1]}" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c[0]}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    const chevs = [], arcs = [];
    for(let i = 0; i < n; i++) chevs.push(yy => dir === "up" ? `M6 ${yy + H} L20 ${yy} L34 ${yy + H}` : `M6 ${yy} L20 ${yy + H} L34 ${yy}`);
    for(let i = 0; i < rk; i++) arcs.push(yy => dir === "up" ? `M6 ${yy} Q20 ${yy + RH * 2} 34 ${yy}` : `M6 ${yy + RH} Q20 ${yy - RH} 34 ${yy + RH}`);
    if(dir === "up"){
      chevs.forEach(f => { out += line(f(y)); y += GAP; });
      y += H - GAP + (st ? 8 : 1);
      if(st) out += star(20, y - 5, 4, c);
      arcs.forEach(f => { out += line(f(y)); y += GAP; });
    } else {
      /* galones hacia abajo (Légion, Hæren): los arcos van encima */
      arcs.forEach(f => { out += line(f(y)); y += GAP; });
      if(rk){ y += (st ? 8 : 1); if(st) out += star(20, y - 5, 4, c); }
      chevs.forEach(f => { out += line(f(y)); y += GAP; });
    }
    return out;
  }
  if(k === "vbar"){
    const [, n, c] = sp, w = 7, g = 6, x0 = 20 - (n * w + (n - 1) * g) / 2;
    let out = "";
    for(let i = 0; i < n; i++){ const x = x0 + i * (w + g); out += `<rect x="${x}" y="9" width="${w}" height="30" rx="1.6" fill="${c[0]}" stroke="${c[1]}" stroke-width="1.3"/><rect x="${x + 1.6}" y="11" width="1.4" height="26" fill="#fff" opacity=".55"/>`; }
    return out;
  }
  if(k === "hbar"){
    const [, n, c, red] = sp, h = n > 3 ? 4 : 5, g = n > 3 ? 2.6 : 3.6, y0 = 24 - (n * h + (n - 1) * g) / 2;
    let out = "";
    for(let i = 0; i < n; i++){ const y = y0 + i * (h + g); out += `<rect x="6" y="${y}" width="28" height="${h}" rx="1" fill="${c[0]}" stroke="${c[1]}" stroke-width="1"/>${red ? `<rect x="6.6" y="${y + h / 2 - .7}" width="26.8" height="1.4" fill="#C8312E"/>` : ""}`; }
    return out;
  }
  if(k === "leaf"){
    const c = sp[1];
    return `<path d="M20 5 C24 9 30 9 29 15 C33 17 33 22 29 24 C33 27 31 32 27 32 C27 37 23 39 21 37 L21 44 L19 44 L19 37 C17 39 13 37 13 32 C9 32 7 27 11 24 C7 22 7 17 11 15 C10 9 16 9 20 5 Z" fill="${c[0]}" stroke="${c[1]}" stroke-width="1.4" stroke-linejoin="round"/><path d="M20 10 V36 M20 18 L15 15 M20 18 L25 15 M20 25 L14 23 M20 25 L26 23" stroke="${c[1]}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  }
  if(k === "eagle"){
    const c = sp[1];
    return `<g fill="${c[0]}" stroke="${c[1]}" stroke-width="1.2" stroke-linejoin="round"><path d="M17 19 L3 12 L5 17 L2 19 L6 22 L3 25 L8 26 L5 29 L11 29 L17 27 Z"/><path d="M23 19 L37 12 L35 17 L38 19 L34 22 L37 25 L32 26 L35 29 L29 29 L23 27 Z"/><path d="M17 31 L20 41 L23 31 Z"/><ellipse cx="20" cy="24" rx="4.4" ry="9"/><circle cx="20" cy="13" r="3.6"/></g><path d="M23 12.6 L25.5 13.6 L23 14.4 Z" fill="${GOLD[0]}" stroke="${GOLD[1]}" stroke-width=".6"/>`;
  }
  if(k === "stars"){
    const [, n, c, band] = sp, top = 3, h = band ? 34 : 42, step = h / n, r = Math.min(8, step * .5);
    let out = "";
    for(let i = 0; i < n; i++) out += star(20, top + step * (i + .5), r, c);
    if(band) out += `<rect x="6" y="40" width="28" height="4.5" rx="1" fill="${c[0]}" stroke="${c[1]}" stroke-width="1"/>`;
    return out;
  }
  return "";
}
const specOf = (L, r) => ((SPEC[ARMY[L] || "us"] || [])[Math.max(0, Math.min(TOP, r | 0))]) || null;
/* la insignia suelta (pestaña con su fondo), para la tarjeta del rango, la escalera y el juego */
function insignia(L, r, px = 44){
  const A = ARMY[L] || "us", t = TAB[A], sp = specOf(L, r);
  return `<svg class="ar-insvg" viewBox="0 0 40 48" width="${Math.round(px * 40 / 48)}" height="${px}" aria-hidden="true" focusable="false"><rect x="1" y="1" width="38" height="46" rx="7" fill="${t[0]}" stroke="${t[1]}" stroke-width="2"/>${sp ? insInner(sp) : `<circle cx="20" cy="24" r="3" fill="${t[1]}" opacity=".35"/>`}</svg>`;
}
const insignaSrc = (L, r) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" width="160" height="192">${insignia(L, r).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>`);

/* ================================================================ el soldado */
const OUT = "#2E2A26", SKIN = "#F5C9A0", SKIN2 = "#D99A6C", HAIR = "#6B4A2F";
const PAL = {
  us: {top: "url(#cm)", leg: "url(#cm)", cam: ["#C2B28A", "#8E8A5B", "#6E5A40", "#DCD0AE"], boot: "#7A5A3A", belt: "#5B4A32", cap: "url(#cm)"},
  dk: {top: "url(#cm)", leg: "url(#cm)", cam: ["#7A8452", "#46532E", "#9AA06A", "#5A4A30"], boot: "#262420", belt: "#2F3A24"},
  fr: {top: "#D9C89E", leg: "#BFAA7B", boot: "#1E1E1E", belt: "#5A4632"},
};
function camo(c){
  return `<pattern id="cm" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="${c[0]}"/>
<path d="M3 7c6-5 15-3 16 3s-6 10-12 8-9-7-4-11z" fill="${c[1]}"/><path d="M27 2c9 0 15 6 12 12s-11 6-14 2-7-14 2-14z" fill="${c[2]}"/>
<path d="M21 25c7-2 13 2 12 8s-8 8-12 6-6-12 0-14z" fill="${c[3]}"/><path d="M1 31c5-2 11 0 10 6s-6 8-10 6z" fill="${c[2]}"/>
<path d="M37 33c5 0 9 4 8 8s-6 6-8 4-5-12 0-12z" fill="${c[1]}"/><path d="M12 42c4-2 8 0 7 3s-5 3-7 2z" fill="${c[3]}"/></pattern>`;
}
/* lo que lleva en la cabeza */
function headgear(A, r){
  if(A === "us"){
    /* gorra de campaña OCP con el rango delante (como en el uniforme de verdad) */
    const sp = specOf("english", r);
    return `<path d="M57 68 L61 33 Q100 24 139 33 L143 68 Z" fill="url(#cm)" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
<path d="M61 33 Q100 24 139 33 L139 38 Q100 30 61 38 Z" fill="#000" opacity=".12"/>
<path d="M53 66 Q100 57 147 66 Q150 78 137 78 Q100 71 63 78 Q50 78 53 66 Z" fill="url(#cm)" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
<path d="M56 70 Q100 62 144 70" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="3"/>
${sp ? `<rect x="88" y="37" width="24" height="25" rx="4" fill="${TAB.us[0]}" stroke="${TAB.us[1]}" stroke-width="1.5"/><svg x="89" y="38" width="22" height="23" viewBox="0 0 40 48">${insInner(sp)}</svg>` : ""}`;
  }
  if(A === "dk"){
    /* boina negra caída hacia la derecha del soldado, con el emblema sobre el ojo izquierdo */
    return `<path d="M56 68 C42 62 42 40 66 31 C92 22 132 25 142 41 C147 50 145 61 139 67 Q100 60 56 68 Z" fill="#232323" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
<path d="M66 40 C80 32 104 30 120 34" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="5" stroke-linecap="round"/>
<path d="M57 67 Q100 59 140 66" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round"/>
<g transform="translate(124 52)"><circle r="8" fill="#E8B730" stroke="#946C10" stroke-width="1.6"/><path d="M-4.5 2 L-4.5 -2.5 L-2 0 L0 -4 L2 0 L4.5 -2.5 L4.5 2 Z" fill="#C8312E" stroke="#946C10" stroke-width=".8" stroke-linejoin="round"/></g>`;
  }
  /* Légion: képi blanc de los legionarios y cabos; desde sergent, képi negro y rojo con su granada dorada */
  const white = r <= 3, gen = r >= TOP;
  const band = white ? "#F4F2EA" : gen ? "#D9A520" : "#1D1D1F", top = white ? "#FBFAF5" : "#B3262B", top2 = white ? "#E4E1D6" : "#8E1D22";
  return `<path d="M63 66 L67 29 Q100 22 133 29 L137 66 Z" fill="${top}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
<path d="M118 27 Q130 28 133 29 L137 66 L123 66 Z" fill="${top2}" opacity=".7"/>
<ellipse cx="100" cy="29" rx="33" ry="6" fill="${white ? "#FFFFFF" : "#C93036"}" stroke="${OUT}" stroke-width="3"/>
<path d="M64.6 51 Q100 46 135.4 51 L137 66 Q100 61 63 66 Z" fill="${band}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
${white ? `<path d="M65 51 Q100 46 135 51" fill="none" stroke="#D8D4C6" stroke-width="2"/>` : `<path d="M65.5 50.5 Q100 45.5 134.5 50.5" fill="none" stroke="#E8B730" stroke-width="2.4"/>`}
${white ? "" : `<g transform="translate(100 56)"><circle r="4.6" fill="#E8B730" stroke="#946C10" stroke-width="1"/><path d="M-3 -3 C-5 -9 -1 -10 0 -14 C1 -10 5 -9 3 -3 Z" fill="#E8B730" stroke="#946C10" stroke-width=".9"/></g>`}
<path d="M58 65 Q100 58 142 65 Q145 77 132 77 Q100 71 68 77 Q55 77 58 65 Z" fill="#141414" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
<path d="M66 64 Q100 59 134 64" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>`;
}
/* svg(L, r): el soldado entero, 200 × 260, saludando (sin armas) */
function svg(L, r){
  L = AB[L] ? L : "english";
  r = Math.max(0, Math.min(TOP, r | 0));
  const A = ARMY[L], P = PAL[A], sp = specOf(L, r);
  const trad = A === "fr" && r <= 5;          /* hombreras de tradición y faja azul: legionarios, cabos y hasta sergent-chef */
  const sleeve = P.top;
  const arm = (d, w) => `<path d="${d}" fill="none" stroke="${OUT}" stroke-width="${w + 6}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${sleeve}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const epaulette = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-14 4 Q-14 -6 0 -7 Q14 -6 14 4 Z" fill="#2F8A3A" stroke="${OUT}" stroke-width="2.2"/><g stroke="#C8312E" stroke-width="3" stroke-linecap="round"><path d="M-11 6 v6"/><path d="M-6 7 v7"/><path d="M-1 7 v7"/><path d="M4 7 v7"/><path d="M9 6 v6"/></g></g>`;
  const flagUS = `<g transform="translate(50 120) rotate(-42)"><rect x="-9" y="-6" width="18" height="12" rx="1.5" fill="#F4F1EA" stroke="${OUT}" stroke-width="1.5"/><path d="M-9 -3.5 h18 M-9 1 h18 M-9 5 h18" stroke="#B22234" stroke-width="2"/><rect x="0.5" y="-6" width="8.5" height="6.5" fill="#3C3B6E"/></g>`;
  const flagDK = `<g transform="translate(148 150) rotate(8)"><rect x="-9" y="-6.5" width="18" height="13" rx="1.5" fill="#C8102E" stroke="${OUT}" stroke-width="1.5"/><path d="M-3 -6.5 v13 M-9 0 h18" stroke="#fff" stroke-width="3"/></g>`;
  const tabFill = TAB[A];
  return `<svg xmlns="http://www.w3.org/2000/svg" id="army-soldier" data-army="${A}-${r}" viewBox="0 0 200 260" width="200" height="260">
<defs>${P.cam ? camo(P.cam) : ""}</defs>
<ellipse cx="100" cy="251" rx="54" ry="6.5" fill="#000" opacity=".13"/>
<rect x="72" y="190" width="26" height="48" rx="9" fill="${P.leg}" stroke="${OUT}" stroke-width="3"/>
<rect x="102" y="190" width="26" height="48" rx="9" fill="${P.leg}" stroke="${OUT}" stroke-width="3"/>
<path d="M66 236 Q66 228 74 228 L96 228 Q100 228 100 234 L100 244 Q100 249 95 249 L70 249 Q64 249 64 244 Z" fill="${P.boot}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
<path d="M134 236 Q134 228 126 228 L104 228 Q100 228 100 234 L100 244 Q100 249 105 249 L130 249 Q136 249 136 244 Z" fill="${P.boot}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
<path d="M68 244 h30 M102 244 h30" stroke="#000" stroke-opacity=".25" stroke-width="3"/>
${arm("M134 134 C147 148 150 168 147 186", 20)}
<circle cx="147" cy="191" r="9.5" fill="${SKIN}" stroke="${OUT}" stroke-width="2.6"/>
<rect x="60" y="120" width="80" height="80" rx="24" fill="${P.top}" stroke="${OUT}" stroke-width="3"/>
${A === "fr" ? `<path d="M88 121 L100 140 L112 121" fill="#E9DCB6" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/><path d="M96.5 127 L103.5 127 L106 163 L100 171 L94 163 Z" fill="#2F6B3A" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/><path d="M96 127 L104 127 L102.5 133 L97.5 133 Z" fill="#245530"/><path d="M80 152 v28 M120 152 v28" stroke="#000" stroke-opacity=".12" stroke-width="2"/>`
  : `<path d="M84 121 L100 138 L116 121" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/><path d="M100 138 V186" stroke="#000" stroke-opacity=".22" stroke-width="2.4"/><rect x="66" y="142" width="20" height="16" rx="3" fill="#000" opacity=".10"/><rect x="114" y="142" width="20" height="16" rx="3" fill="#000" opacity=".10"/>`}
${A === "fr" && trad ? `<rect x="60.5" y="176" width="79" height="17" fill="#2456A6" stroke="${OUT}" stroke-width="2.4"/><path d="M61 181 h78 M61 187 h78" stroke="#1B3F80" stroke-width="1.6"/>`
  : `<rect x="60.5" y="181" width="79" height="9" fill="${P.belt}" stroke="${OUT}" stroke-width="2.2"/><rect x="94" y="180" width="12" height="11" rx="2" fill="#B8A57A" stroke="${OUT}" stroke-width="1.8"/>`}
<rect x="81" y="${A === "fr" ? 136 : 134}" width="38" height="44" rx="7" fill="${tabFill[0]}" stroke="${tabFill[1]}" stroke-width="2.2"/>
${sp ? `<svg x="82" y="${A === "fr" ? 137 : 135}" width="36" height="42" viewBox="0 0 40 48">${insInner(sp)}</svg>` : ""}
${A === "dk" ? flagDK : ""}
${A === "fr" && trad ? epaulette(134, 128, 18) : ""}
<rect x="91" y="112" width="18" height="12" fill="${SKIN2}"/>
<circle cx="57" cy="90" r="8.5" fill="${SKIN}" stroke="${OUT}" stroke-width="2.6"/><circle cx="143" cy="90" r="8.5" fill="${SKIN}" stroke="${OUT}" stroke-width="2.6"/>
<circle cx="100" cy="86" r="44" fill="${SKIN}" stroke="${OUT}" stroke-width="3"/>
<path d="M57 80 C56 64 70 52 100 52 C130 52 144 64 143 80 C136 68 120 64 100 64 C80 64 64 68 57 80 Z" fill="${HAIR}"/>
<path d="M75 79 q8 -5 16 0 M109 79 q8 -5 16 0" fill="none" stroke="${HAIR}" stroke-width="3.2" stroke-linecap="round"/>
<ellipse cx="84" cy="93" rx="6.6" ry="8.6" fill="#2B2B2B"/><ellipse cx="116" cy="93" rx="6.6" ry="8.6" fill="#2B2B2B"/>
<circle cx="86.4" cy="89.6" r="2.5" fill="#fff"/><circle cx="118.4" cy="89.6" r="2.5" fill="#fff"/>
<ellipse cx="72" cy="107" rx="7.5" ry="4.6" fill="#EE9670" opacity=".45"/><ellipse cx="128" cy="107" rx="7.5" ry="4.6" fill="#EE9670" opacity=".45"/>
<path d="M97 101 q3 2.5 6 0" fill="none" stroke="${SKIN2}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M88 108 Q100 121 112 108 Q100 112 88 108 Z" fill="#7A2E26" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M94 114 Q100 118 106 114 Q100 112.5 94 114 Z" fill="#E07A6A"/>
${headgear(A, r)}
${arm("M68 136 L40 112 L62 76", 19)}
${A === "us" ? flagUS : ""}
${A === "fr" && trad ? epaulette(64, 128, -40) : ""}
<g transform="translate(64 71) rotate(-28)"><ellipse rx="11" ry="8.5" fill="${SKIN}" stroke="${OUT}" stroke-width="2.6"/><path d="M-6 -3 h12 M-6 1 h12" stroke="${SKIN2}" stroke-width="1.6" stroke-linecap="round"/></g>
</svg>`;
}
const SRC_CACHE = new Map();
function src(L = curLang(), r = rank(L)){
  const k = L + ":" + r;
  if(!SRC_CACHE.has(k)) SRC_CACHE.set(k, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(L, r).replace(/\n/g, "")));
  return SRC_CACHE.get(k);
}

/* ================================================================ datos */
const DATA = {};
function load(L = curLang()){
  const ab = AB[L] || "en";
  if(!DATA[ab]) DATA[ab] = fetch(`data/army/${ab}.json`).then(r => { if(!r.ok) throw new Error(`data/army/${ab}.json ${r.status}`); return r.json(); })
    .catch(e => { delete DATA[ab]; throw e; });
  return DATA[ab];
}
const DONE = {};                       /* datos ya cargados, para pintar sin esperar */
const dataNow = L => DONE[AB[L] || "en"] || null;
function warm(L = curLang()){ return load(L).then(d => { DONE[AB[L]] = d; return d; }).catch(() => null); }

/* ================================================================ el rango */
const CUR = {}, INFO = {};
const seenKey = L => "army:" + L;
function seenOf(L){ const v = typeof store !== "undefined" ? store.get(seenKey(L), null) : null; return Number.isFinite(v) ? v : null; }
function setSeen(L, r){ try{ store.set(seenKey(L), r); }catch(e){} }
function rank(L = curLang()){
  if(Number.isFinite(CUR[L])) return CUR[L];
  const s = seenOf(L); return s == null ? 0 : Math.max(0, Math.min(TOP, s));
}
/* el rango de ahora por las lecciones del camino del idioma actual (necesita el mapa y su gramática: getMap) */
async function compute(){
  const L = curLang();
  try{ await getMap(); }catch(e){ return null; }
  if(L !== curLang()) return null;
  const P = (typeof store !== "undefined" && store.get("map:" + L, {})) || {};
  const lvs = (typeof LVS === "object" && LVS) ? Object.keys(LVS) : LEVELS;
  let r = 0; const per = [];
  for(const lv of lvs){
    let ls = []; try{ ls = lvLessons(lv) || []; }catch(e){}
    const total = ls.length, done = ls.filter(l => P[l.id]).length;
    const k = !total ? 0 : done >= total ? 2 : done * 2 >= total ? 1 : 0;
    r += k; per.push({lv, done, total, k});
  }
  r = Math.min(TOP, r);
  const nx = per.find(x => x.k < 2 && x.total);
  const next = r < TOP && nx ? {lv: nx.lv, need: nx.k === 0 ? Math.ceil(nx.total / 2) - nx.done : nx.total - nx.done, half: nx.k === 0} : null;
  return {L, r, per, next};
}
const owned = () => { try{ return !!game().owned.soldado; }catch(e){ return false; } };
const wearing = () => { try{ return game().wear.hero === "soldado"; }catch(e){ return false; } };
let busy = null, again = false;
function refresh(){
  if(busy){ again = true; return busy; }
  busy = (async () => {
    try{
      const res = await compute();
      if(!res) return;
      const old = CUR[res.L];
      CUR[res.L] = res.r; INFO[res.L] = res;
      if(old !== res.r) repaint();
      else paintChip();
      check();
    }catch(e){ console.error(e); }
  })().finally(() => { busy = null; if(again){ again = false; refresh(); } });
  return busy;
}
/* el soldado pintado en pantalla pasa al rango (o al idioma) de ahora */
function repaint(){
  const s = src();
  D.querySelectorAll("img.pj").forEach(im => { const v = im.getAttribute("src") || ""; if(v.includes("army-soldier") && v !== s) im.setAttribute("src", s); });
  paintChip();
}

/* ================================================================ Mi zorro: el rango debajo del nombre */
let HOST = null;
function nextText(L){
  const inf = INFO[L], d = dataNow(L);
  if(!inf) return "";
  if(!inf.next) return "¡Eres el rango más alto!";
  const to = d && d.ranks[inf.r + 1];
  const n = inf.next.need, what = n === 1 ? "1 lección" : `${n} lecciones`;
  return `Te ${n === 1 ? "falta" : "faltan"} ${what} de ${inf.next.lv} para ser ${to ? `«${to.w}»` : "el siguiente"}.`;
}
function rankLine(L, rk, big){
  const code = codeOf(L);
  return `<div class="ar-wrow"><b class="ar-w" lang="${E(code)}">${E(rk.w)}</b><button type="button" class="say ar-spk" data-say="${E(rk.w)}" aria-label="Escuchar «${E(rk.w)}»">${IC("speaker-high", "fill", big ? 24 : 20)}</button></div>
    <div class="ar-ipa">${IPA(rk.ipa, L)}</div><div class="ar-es">${E(rk.es)}</div>`;
}
function chipHtml(L){
  const d = dataNow(L), r = rank(L), rk = d && d.ranks[r];
  if(!rk) return `<div class="ar-rk ar-wait" aria-hidden="true">${insignia(L, r, 52)}</div>`;
  return `<div class="ar-rk"><span class="ar-ins">${insignia(L, r, 56)}</span><div class="ar-rt"><div class="ar-cap">Tu rango en ${E(d.army)}</div>${rankLine(L, rk)}
      ${rk.note ? `<div class="ar-note">${E(rk.note)}</div>` : ""}</div></div>
    <p class="ar-next">${E(nextText(L))}</p>
    <button type="button" class="glass-btn glass-btn--sm ar-lad-b" data-ar-ladder>${IC("medal", "bold", 18)}Ver rangos</button>`;
}
function paintChip(){
  if(!HOST || !HOST.isConnected) return;
  let box = HOST.querySelector(".ar-box");
  if(!wearing()){ if(box) box.remove(); return; }
  if(!box){
    box = D.createElement("div"); box.className = "ar-box";
    const after = HOST.querySelector("#mz-name") || HOST.lastElementChild;
    if(after && after.nextSibling) HOST.insertBefore(box, after.nextSibling); else HOST.appendChild(box);
  }
  const L = curLang(), html = chipHtml(L);
  if(box.dataset.h !== html){ box.innerHTML = html; box.dataset.h = html; }
}
function decorate(host){
  css();
  HOST = host || null;
  if(!HOST) return;
  if(!HOST.dataset.arBound){
    HOST.dataset.arBound = "1";
    HOST.addEventListener("click", e => { const b = e.target.closest("[data-ar-ladder]"); if(b) ladder(b); });
  }
  paintChip();
  const L = curLang();
  if(!dataNow(L)) warm(L).then(() => paintChip());
  if(!INFO[L]) refresh();
}

/* ---------- la escalera de rangos (hoja) ---------- */
let SH = null;
function sheet(){
  if(SH && SH.isConnected) return SH;
  SH = D.createElement("dialog"); SH.id = "ar-sheet"; SH.className = "ar-sh-d"; SH.setAttribute("aria-labelledby", "ar-sh-t");
  SH.dataset.noRenew = "";
  D.body.appendChild(SH);
  SH.addEventListener("click", e => { if(e.target.closest("[data-close]")) closeSheet(SH); });
  return SH;
}
function closeSheet(d){
  if(!d || !d.open) return;
  try{ if(W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")){ M.closeSheet(d); return; } }catch(e){}
  d.close();
}
function openSheet(d, from){
  try{
    if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null});
    else d.showModal();
  }catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
}
const stepName = i => i === 0 ? "Al empezar" : (i % 2 ? `Mitad de ${LEVELS[(i - 1) >> 1]}` : `${LEVELS[(i >> 1) - 1]} completo`);
async function ladder(from){
  css();
  const L = curLang();
  let d = null; try{ d = await load(L); DONE[AB[L]] = d; }catch(e){ return false; }
  if(L !== curLang()) return false;
  const r = rank(L), S = sheet();
  S.innerHTML = `<div class="m-head"><h2 id="ar-sh-t">Rangos · ${E(d.army)}</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p class="ar-sh-sub">${E(nextText(L))}</p>
    <ol class="ar-lad">${d.ranks.slice().reverse().map((rk, k) => { const i = TOP - k, on = i === r, past = i < r;
      return `<li class="ar-li${on ? " on" : past ? " past" : " fut"}"${on ? ` aria-current="step"` : ""}>
        <span class="ar-ins">${insignia(L, i, 48)}</span>
        <div class="ar-rt">${rankLine(L, rk)}<div class="ar-when">${E(stepName(i))}${on ? " · <b>tú</b>" : ""}</div>${rk.note ? `<div class="ar-note">${E(rk.note)}</div>` : ""}</div>
        ${on ? `<span class="ar-you" aria-hidden="true">${IC("check", "bold", 18)}</span>` : ""}</li>`; }).join("")}</ol>`;
  openSheet(S, from);
  requestAnimationFrame(() => { const on = S.querySelector(".ar-li.on"); if(on) try{ on.scrollIntoView({block: "center"}); }catch(e){} });
  return true;
}

/* ---------- ascenso ---------- */
const calm = () => !D.documentElement.dataset.focus && !D.querySelector("dialog[open]") && D.visibilityState !== "hidden";
function check(){
  const L = curLang(), r = CUR[L];
  if(!Number.isFinite(r) || !owned()) return;
  const seen = seenOf(L);
  if(seen == null){ setSeen(L, r); return; }   /* la primera vez con el soldado en este idioma: se apunta, sin fiesta */
  if(r <= seen || !calm()) return;
  setSeen(L, r);
  celebrate(r);
}
let UP = null;
async function celebrate(r){
  css();
  const L = curLang();
  if(!Number.isFinite(r)) r = rank(L);
  let d = null; try{ d = await load(L); DONE[AB[L]] = d; }catch(e){ return false; }
  const rk = d.ranks[r]; if(!rk) return false;
  if(!UP || !UP.isConnected){
    UP = D.createElement("dialog"); UP.id = "ar-up"; UP.className = "ar-up-d"; UP.setAttribute("aria-labelledby", "ar-up-t");
    UP.dataset.noRenew = "";
    D.body.appendChild(UP);
    UP.addEventListener("click", e => { if(e.target.closest("[data-close]")) closeSheet(UP); });
  }
  const code = codeOf(L);
  UP.innerHTML = `<div class="ar-up">
    <div class="ar-up-pic"><img src="${src(L, r)}" alt="" draggable="false"></div>
    <h2 id="ar-up-t" class="ar-up-t">¡Ascendido a <span lang="${E(code)}">${E(rk.w)}</span>!</h2>
    <div class="ar-rk ar-up-rk"><span class="ar-ins">${insignia(L, r, 56)}</span><div class="ar-rt">${rankLine(L, rk, true)}</div></div>
    <p class="ar-up-ins">${E(cap(rk.ins))}</p>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg ar-up-b" data-close>¡A la orden!</button></div>`;
  openSheet(UP, null);
  try{ if(typeof sfx !== "undefined") sfx.play("fanfare"); }catch(e){}
  try{ if(W.M && !rm() && typeof M.confetti === "function") M.confetti({n: 50}); }catch(e){}
  setTimeout(() => { try{ if(UP.open) say(rk.w); }catch(e){} }, 700);
  try{ bus.emit("army-rank", {lang: L, rank: r, w: rk.w}); }catch(e){}
  return true;
}

/* ================================================================ juego «Misión por radio» */
const CATS = ["radio", "ordenes", "campamento", "alfabeto", "rangos"];
const PROMPT = {radio: "¿Qué significa por radio?", ordenes: "¿Qué orden es?", campamento: "¿Qué cosa del campamento es?", alfabeto: "¿Qué letra es?", rangos: "¿Qué rango es?"};
function poolOf(d, cat, L){
  if(cat === "rangos") return d.ranks.map((rk, i) => ({id: "r" + i, cat, w: rk.w, ipa: rk.ipa, es: rk.es, ex: rk.ex, exEs: rk.exEs, r: i, img: insignaSrc(L, i)})).filter(x => x.r > 0);
  return (d.terms || []).filter(t => t.cat === cat && t.w && t.es);
}
function plan(d, L){
  const order = shuffle(CATS).concat(shuffle(["radio", "ordenes", "campamento"])).slice(0, ROUNDS);
  const used = new Set();
  return order.map(cat => {
    const pool = poolOf(d, cat, L);
    if(pool.length < OPTS) return null;
    const free = pool.filter(x => !used.has(cat + x.id));
    const t = (free.length ? shuffle(free) : shuffle(pool))[0];
    used.add(cat + t.id);
    const others = shuffle(pool.filter(x => x.id !== t.id && x.es !== t.es)).slice(0, OPTS - 1);
    return {cat, t, opts: shuffle([t, ...others])};
  }).filter(Boolean);
}
function optHtml(x, i, L){
  const pic = x.cat === "alfabeto" ? `<span class="ar-let" aria-hidden="true">${E(x.letter)}</span>`
    : x.img ? `<span class="ar-pic" aria-hidden="true"><img src="${E(x.img)}" alt="" draggable="false"></span>` : "";
  return `<button type="button" class="ar-c${x.cat === "alfabeto" ? " ar-c-let" : ""}" data-i="${i}" style="--i:${i}">
    ${pic}<span class="ar-cl">${x.cat === "alfabeto" ? `Letra ${E(x.letter)}` : E(x.es)}</span>
    <span class="ar-mk" aria-hidden="true"></span><span class="vh ar-st"></span></button>`;
}
async function start(app, api, mode){
  const my = api.nav();
  css();
  const L = curLang();
  let d = null; try{ d = await load(L); DONE[AB[L]] = d; }catch(e){ d = null; }
  if(!api.here(my, GID)) return;
  const rounds = d ? plan(d, L) : [];
  if(rounds.length < ROUNDS){
    app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras en ${E(api.nm())}.</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
    return;
  }
  rounds.forEach(o => o.opts.forEach(x => { if(x.img && !/^data:/.test(x.img)){ const im = new Image(); im.src = x.img; } }));
  const code = codeOf(L);
  const run = api.mount(app, `<div class="gm ar-g" id="ar-g">
    ${api.topHtml(GID, `<span class="gm-pill" title="Orden">${IC("target", "bold", 18)}<span><b id="gm-rd">1</b>/${ROUNDS}</span></span><span class="gm-pill" title="Aciertos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="gm-listen ar-radio">
      <span class="ar-sgt" aria-hidden="true"><img src="img/om_1F4FB.png" alt="" draggable="false"></span>
      <div class="ar-say">
        <div class="ar-who">Sargento · <span id="ar-cat"></span></div>
        <div class="ar-term"><b id="ar-w" lang="${E(code)}"></b></div>
        <div class="ar-tipa" id="ar-ipa"></div>
      </div>
      <button type="button" class="gm-bigsay ar-play" id="ar-play" aria-label="Escuchar otra vez">${IC("speaker-high", "fill", 30)}</button>
      <div class="gm-ltxt ar-txt" id="ar-txt" aria-live="polite"></div>
    </div>
    <div class="ar-cards" id="ar-cards"></div>
    ${api.dotsHtml(ROUNDS)}
    <div class="ar-sp" id="ar-sp" aria-hidden="true"></div>
    <div class="ar-dock" id="ar-next"></div></div>`, mode);
  const root = run.root, box = root.querySelector("#ar-cards"), nextBox = root.querySelector("#ar-next"), txt = root.querySelector("#ar-txt");
  const playB = root.querySelector("#ar-play");
  let r = 0, score = 0, cur = null, answered = false, started = false, tok = 0, fit = null;
  const res = [];
  const live = () => api.live(run);
  const cards = () => [...box.querySelectorAll(".ar-c")];
  const dots = () => root.querySelectorAll("#gm-dots i").forEach((el, i) => { el.className = i < res.length ? (res[i] ? "ok" : "meh") : i === r ? "now" : ""; });
  const hear = () => { if(!cur || !live()) return; try{ say(cur.t.w, playB); }catch(e){} };
  const wait = ms => new Promise(ok => api.later(run, ok, ms));
  function round(){
    cur = rounds[r]; answered = false; tok++;
    root.classList.remove("ar-done");
    root.querySelector("#ar-cat").textContent = (d.cats && d.cats[cur.cat]) || cur.cat;
    root.querySelector("#ar-w").textContent = cur.t.w;
    root.querySelector("#ar-ipa").innerHTML = IPA(cur.t.ipa, L);
    box.innerHTML = cur.opts.map((x, i) => optHtml(x, i, L)).join("");
    nextBox.innerHTML = "";
    txt.textContent = PROMPT[cur.cat] || "¿Qué es?";
    const rd = root.querySelector("#gm-rd"); if(rd) rd.textContent = r + 1;
    dots();
    if(fit) fit(false);
    playB.classList.remove("ring"); void playB.offsetWidth; playB.classList.add("ring");
    if(started) api.later(run, hear, rm() ? 250 : 500);
  }
  const exHtml = t => t.ex ? `<span class="ar-ex"><button type="button" class="say ar-exs" data-say="${E(t.ex)}" aria-label="Escuchar la frase">${IC("speaker-high", "fill", 18)}</button><span lang="${E(code)}">${E(t.ex)}</span></span><small class="ar-exes">${E(t.exEs || "")}</small>` : "";
  function choose(c){
    if(!started || answered || !cur || !live()) return;
    const x = cur.opts[+c.dataset.i]; if(!x) return;
    answered = true;
    const my = tok, t = cur.t, ok = x === t;
    try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
    res.push(ok); api.answer(ok, {es: t.es, word: t.w});
    root.classList.add("ar-done");
    dots();
    if(ok){
      score++;
      c.classList.add("is-ok"); c.querySelector(".ar-mk").innerHTML = IC("check", "bold", 20);
      c.querySelector(".ar-st").textContent = ": ¡bien!";
      api.haptic("success"); api.snd("ok");
      try{ if(W.M && typeof M.ok === "function") M.ok(c); }catch(e){}
      txt.innerHTML = `¡Muy bien! <b lang="${E(code)}">${E(t.w)}</b> = ${E(t.es)}${exHtml(t)}`;
      const sc = root.querySelector("#gm-sc"); if(sc){ sc.textContent = score; api.bump(sc.parentNode); }
      (async () => {
        await wait(200); if(tok !== my) return;
        try{ await sayP(t.w); }catch(e){}
        await wait(1200);
        if(live() && tok === my) next();
      })();
      return;
    }
    c.classList.add("is-miss"); c.querySelector(".ar-mk").innerHTML = IC("x", "bold", 18);
    c.querySelector(".ar-st").textContent = ": no era esta";
    const right = cards().find(el => cur.opts[+el.dataset.i] === t);
    if(right){ right.classList.add("is-right"); right.querySelector(".ar-mk").innerHTML = IC("check", "bold", 20); right.querySelector(".ar-st").textContent = ": era esta"; }
    txt.innerHTML = `¡Casi! <b lang="${E(code)}">${E(t.w)}</b> = ${E(t.es)}${exHtml(t)}`;
    showNext();
    api.later(run, () => { if(tok === my) hear(); }, 350);
  }
  function showNext(){
    if(!live() || nextBox.firstChild) return;
    const last = r + 1 >= ROUNDS;
    nextBox.innerHTML = `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="ar-go">${last ? "Ver el premio" : "Seguir"}${IC("caret-right", "bold", 20)}</button>`;
    const b = nextBox.querySelector("#ar-go");
    b.onclick = next;
    if(api.kbd && api.kbd()) try{ b.focus({preventScroll: true}); }catch(e){}
  }
  function next(){
    if(!answered || !live()) return;
    tok++;
    try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
    r++;
    if(r < ROUNDS){ round(); return; }
    const stars = score >= 7 ? 3 : score >= 5 ? 2 : 1;
    const words = rounds.map((o, i) => ({word: o.t.w, es: o.cat === "alfabeto" ? `letra ${o.t.letter}` : o.t.es, img: o.t.img || null, miss: !res[i]}));
    api.finish(run, GID, {score, stars, words,
      line: score === ROUNDS ? "¡Misión cumplida! Las 8 órdenes a la primera." : score ? `¡Entendiste ${score} de ${ROUNDS} órdenes!` : "¡Buen intento, soldado! La próxima saldrá mejor."});
  }
  box.addEventListener("click", e => {
    const c = e.target.closest(".ar-c"); if(!c || !live()) return;
    if(!answered){ choose(c); return; }
    const x = cur && cur.opts[+c.dataset.i];
    if(x && x.cat !== "alfabeto" && x.w) try{ say(x.w); }catch(err){}
  });
  playB.onclick = hear;
  const kb = e => {
    if(!started || !cur || e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.target.closest && e.target.closest("input,textarea,select")) return;
    const k = e.key;
    if(/^[1-4]$/.test(k)){ const c = cards()[+k - 1]; if(c){ e.preventDefault(); c.click(); } }
    else if(k === " " && !(e.target.closest && e.target.closest("button,a"))){ e.preventDefault(); hear(); }
    else if(k === "Enter" && answered && nextBox.firstChild && !(e.target.closest && e.target.closest("button:not(#ar-go),a"))){ e.preventDefault(); next(); }
  };
  fit = api.autoFit(run, root.querySelector("#ar-sp"));
  round();
  api.intro(run, GID, () => { started = true; api.keys(run, kb); api.later(run, hear, rm() ? 200 : 450); });
}

/* ================================================================ estilos */
const CSS = `
.ar-box{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;margin-top:2px}
.ar-rk{display:flex;align-items:center;gap:12px;max-width:100%;padding:10px 14px;border-radius:var(--r-md,16px);background:var(--fill2,rgba(120,120,128,.12));text-align:left}
.ar-rk.ar-wait{min-height:76px}
.ar-ins{flex:none;display:grid;place-items:center}
.ar-insvg{display:block}
.ar-rt{min-width:0}
.ar-cap{font:600 var(--fs-min,.75rem)/1.2 var(--f-text);color:var(--label2);text-transform:uppercase;letter-spacing:.04em}
.ar-wrow{display:flex;align-items:center;gap:2px;min-width:0}
.ar-w{font:800 1.25rem/1.15 var(--f-round,var(--f-text));color:var(--label);overflow-wrap:anywhere}
.ar-w::first-letter{text-transform:uppercase}
.say.ar-spk{flex:none;width:44px;height:44px;margin:-6px 0;padding:0;border:0;border-radius:50%;background:none;color:var(--brand-tint);display:grid;place-items:center;cursor:pointer}
.say.ar-spk.playing{background:var(--brand-soft);color:var(--brand-tint)}
.ar-ipa{font-size:var(--fs-note,.9375rem);line-height:1.3}
.ar-es{font:400 var(--fs-note,.9375rem)/1.3 var(--f-text);color:var(--label2)}
.ar-note{margin-top:4px;font:400 var(--fs-min,.8125rem)/1.3 var(--f-text);color:var(--label2)}
.ar-next{margin:0;max-width:34ch;font:400 var(--fs-note,.9375rem)/1.35 var(--f-text);color:var(--label2);text-align:center}
.ar-lad-b{min-width:44px}
dialog.ar-sh-d{max-width:520px}
.ar-sh-sub{margin:0 0 12px;color:var(--label2);text-align:center;font:400 var(--fs-note,.9375rem)/1.35 var(--f-text)}
.ar-lad{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ar-li{position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--r-md,16px);background:var(--card)}
.ar-li.on{box-shadow:inset 0 0 0 2px var(--brand-tint)}
.ar-li.fut .ar-ins{opacity:.55}
.ar-when{margin-top:2px;font:400 var(--fs-min,.8125rem)/1.3 var(--f-text);color:var(--label2)}
.ar-you{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--brand-fill);color:#fff}
dialog.ar-up-d{max-width:440px}
.ar-up{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 4px 4px;text-align:center}
.ar-up-pic{width:min(200px,56vw);aspect-ratio:200/260;display:grid;place-items:end center}
.ar-up-pic img{width:100%;height:100%;object-fit:contain;animation:ar-pop .7s cubic-bezier(.3,1.4,.5,1) both}
.ar-up-t{margin:0;font:800 1.5rem/1.2 var(--f-round,var(--f-text));color:var(--label)}
.ar-up-ins{margin:0;color:var(--label2);font:400 var(--fs-note,.9375rem)/1.3 var(--f-text)}
.ar-up-b{width:100%;max-width:320px}
@keyframes ar-pop{from{transform:scale(.6) translateY(20px);opacity:0}to{transform:none;opacity:1}}
/* el juego */
.ar-radio{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;text-align:left}
.ar-sgt{width:56px;height:56px;border-radius:16px;background:var(--gm-tile,#F2F2F7);display:grid;place-items:center}
.ar-sgt img{width:48px;height:48px}
.ar-say{min-width:0}
.ar-who{font:600 var(--fs-min,.8125rem)/1.2 var(--f-text);color:var(--label2)}
.ar-term b{display:block;font:800 1.6rem/1.15 var(--f-round,var(--f-text));color:var(--label);overflow-wrap:anywhere}
.ar-tipa{min-height:1.3em;font-size:var(--fs-note,.9375rem);line-height:1.3}
.ar-play{width:64px;height:64px}
.ar-radio .ar-txt{grid-column:1/-1}
.ar-ex{display:flex;align-items:center;justify-content:center;gap:2px;margin-top:6px;font-weight:600;color:var(--label)}
.say.ar-exs{flex:none;width:44px;height:44px;margin:-8px 0;border:0;border-radius:50%;background:none;color:var(--brand-tint);display:grid;place-items:center;cursor:pointer}
.ar-exes{display:block;font-weight:400;color:var(--label2)}
.ar-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:560px;margin:0 auto}
.ar-c{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:clamp(170px,calc((100dvh - 420px) / 2),260px);padding:12px 8px;margin:0;border:0;
  border-radius:var(--r-card);background:var(--card);color:var(--label);font:inherit;text-align:center;cursor:pointer;touch-action:manipulation;
  box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep);-webkit-tap-highlight-color:transparent;user-select:none;
  transition:background-color .2s,color .2s,box-shadow .2s;animation:gm-in .3s calc(var(--i) * 60ms) backwards}
.ar-pic{width:min(128px,86%);aspect-ratio:1;border-radius:20px;background:var(--gm-tile,#F2F2F7);display:grid;place-items:center;transition:opacity .2s,filter .2s}
.ar-pic img{width:90%;height:90%;object-fit:contain;pointer-events:none}
.ar-let{display:grid;place-items:center;width:min(120px,80%);aspect-ratio:1;border-radius:20px;background:var(--gm-tile,#F2F2F7);font:800 4rem/1 var(--f-round,var(--f-text));color:var(--brand-ink,#0b2545)}
.ar-cl{display:block;max-width:100%;font:600 var(--fs-sub,1rem)/1.2 var(--f-text);overflow-wrap:anywhere}
.ar-mk{position:absolute;right:-6px;top:-6px;width:34px;height:34px;border-radius:50%;display:none;place-items:center;z-index:2}
.ar-c.is-ok,.ar-c.is-right{background:var(--ok-fill);color:#fff;box-shadow:none}
.ar-c.is-ok .ar-mk,.ar-c.is-right .ar-mk{display:grid;background:var(--ok-fill);color:#fff;box-shadow:0 0 0 3px var(--card),0 2px 6px rgba(0,0,0,.2)}
.ar-c.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.ar-c.is-miss .ar-pic,.ar-c.is-miss .ar-let{filter:grayscale(1);opacity:.6}
.ar-c.is-miss .ar-mk{display:grid;background:var(--miss);color:#fff;box-shadow:0 0 0 3px var(--card),0 2px 6px rgba(0,0,0,.2)}
@media (hover:hover){.ar-g:not(.ar-done) .ar-c:hover{box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--brand-tint)}}
.ar-c:focus-visible,.ar-play:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.ar-dock{position:fixed;z-index:5;left:max(16px,var(--safe-l),calc(50% - 280px));right:max(16px,var(--safe-r),calc(50% - 280px));
  bottom:calc(var(--safe-b) + 16px);display:flex;gap:12px;pointer-events:none}
.ar-dock:empty{display:none}
.ar-dock>*{pointer-events:auto;flex:1}
.ar-dock::before{content:"";position:absolute;z-index:-1;left:-16px;right:-16px;top:-20px;bottom:calc(-1 * (var(--safe-b) + 16px));
  background:linear-gradient(to bottom,transparent,var(--bg) 45%);pointer-events:none}
.ar-sp{height:calc(var(--btn-main) + 24px)}
.gm-short .ar-c{min-height:132px;padding:8px 6px}
.gm-short .ar-pic{width:min(100px,80%)}
.gm-short .ar-let{width:min(88px,70%);font-size:3rem}
.gm-short .ar-term b{font-size:1.3rem}
:root[data-theme=dark] .ar-pic,:root[data-theme=dark] .ar-sgt{background:#F2F2F7}
:root[data-theme=dark] .ar-let{background:#F2F2F7;color:#0b2545}
@media (prefers-reduced-motion: reduce){.ar-c,.ar-pic{transition:none;animation:none}.ar-up-pic img{animation:none}}
@media (forced-colors:active){.ar-rk,.ar-li,.ar-c{border:1px solid CanvasText}}`;
function css(){
  if(D.getElementById("css-army")) return;
  const s = D.createElement("style"); s.id = "css-army"; s.textContent = CSS; D.head.appendChild(s);
}

/* ================================================================ enganches */
if(typeof PJ_SRC === "object" && PJ_SRC) PJ_SRC.soldado = () => src();
try{
  bus.on("boot", () => { refresh(); warm(); });
  bus.on("route", () => { refresh(); });
  bus.on("lang", () => { repaint(); refresh(); warm(); });
  bus.on("lesson-done", () => { refresh(); });
  bus.on("buy", d => { if(d && d.item && d.item.id === "soldado") refresh(); });
  bus.on("wear", d => { if(d && d.item && d.item.t === "hero") paintChip(); });
}catch(e){ console.error(e); }
addEventListener("storage", e => { if(e.key && (e.key === "lang" || e.key.startsWith("map:") || e.key.startsWith("army:"))) refresh(); });

const reg = W.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(GID, {
  t: "Misión por radio", sub: "Órdenes del sargento", img: "img/games/soldados.png",
  how: "El sargento te da una orden por radio. Escúchala y toca el dibujo que significa lo mismo.",
  words: "Palabras de soldados",
  show: tp => tp === "militar",   /* solo con el tema «Soldados» de Juegos (con los demás, en oscuro y con este aviso) */
  off: "Se activa con el tema Soldados",
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} de ${ROUNDS}`,
  start,
});
if(!reg) console.warn("[army] no se pudo añadir a Juegos");

W.vocabArmy = {svg, src, insignia, rank, info: () => INFO[curLang()] || null, load, decorate, ladder, celebrate, refresh, TOP};
})();
