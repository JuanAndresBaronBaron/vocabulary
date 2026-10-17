// Auditoría de la pantalla que se ve (la usa tests/e2e/test_f1.py con page.evaluate(AUDIT, opts)).
//   opts.what: lista con "contrast", "palette" y/o "backdrop" (por defecto, las tres)
// Devuelve {contrast: [...], palette: [...], backdrop: [...], n: {texts, els}}: cada fallo es una línea legible.
//   contrast: textos visibles con contraste < 4,5:1 (3:1 si es grande: ≥24 px, o ≥18,66 px en negrita) contra su fondo
//             efectivo, que sale de mezclar los fondos de sus antepasados (color y degradados; con un dibujo detrás no se
//             mide). No cuentan: el texto de solo emojis o símbolos, lo oculto o recortado y los controles desactivados.
//   palette:  colores calculados (color, background-color, border-color, fill, stroke y paradas de degradados) con tono
//             260-340° y saturación > 25 % (índigo, morado, rosa) o naranjas (tono 15-45°, saturación > 60 %, luz 40-70 %).
//             No mira los logotipos de otras marcas, que van con sus colores (dentro de [data-brand], p. ej. el de Google).
//   backdrop: elementos (y sus ::before/::after) con backdrop-filter distinto de none.
// Los colores se leen pintándolos en un lienzo de 1×1, así vale cualquier sintaxis (rgb, color(srgb…), oklch, color-mix…).
(opts) => {
  opts = opts || {};
  const what = new Set(opts.what || ["contrast", "palette", "backdrop"]);
  const out = {contrast: [], palette: [], backdrop: [], n: {texts: 0, els: 0}};

  // ---------- colores ----------
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", {willReadFrequently: true});
  cx.globalCompositeOperation = "copy";
  const MARK = "rgba(1, 2, 3, 0.5)";
  cx.fillStyle = MARK; const MARKN = cx.fillStyle;
  const memo = new Map();
  const parse = s => {
    if(s == null) return null;
    s = String(s).trim();
    if(!s || s === "none" || /^url\(/i.test(s)) return null;
    if(memo.has(s)) return memo.get(s);
    let c = null;
    cx.fillStyle = MARK; cx.fillStyle = s;
    if(cx.fillStyle !== MARKN || s.replace(/\s/g, "") === MARK.replace(/\s/g, "")){
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      c = {r: d[0], g: d[1], b: d[2], a: d[3] / 255};
    }
    memo.set(s, c);
    return c;
  };
  const COLOR_RE = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-f]{3,8}\b/gi;
  const colorsIn = s => (String(s || "").match(COLOR_RE) || []).map(parse).filter(Boolean);
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  const lum = c => .2126 * lin(c.r) + .7152 * lin(c.g) + .0722 * lin(c.b);
  const over = (top, bot) => {                     // top encima de bot (bot opaco)
    const a = top.a;
    return {r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a), a: 1};
  };
  const avg = cs => {
    const n = cs.length, s = cs.reduce((t, c) => ({r: t.r + c.r, g: t.g + c.g, b: t.b + c.b, a: t.a + c.a}), {r: 0, g: 0, b: 0, a: 0});
    return {r: s.r / n, g: s.g / n, b: s.b / n, a: s.a / n};
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hsl = c => {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if(mx === mn) return {h: 0, s: 0, l};
    const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return {h: h * 60, s, l};
  };
  const hex = c => "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("") + (c.a < 1 ? `/${c.a.toFixed(2)}` : "");
  const banned = c => {
    if(!c || c.a < .05) return null;
    const {h, s, l} = hsl(c);
    if(h >= 260 && h <= 340 && s > .25) return `tono ${h.toFixed(0)}° sat ${(s * 100).toFixed(0)} %`;
    if(h >= 15 && h <= 45 && s > .6 && l >= .4 && l <= .7) return `naranja ${h.toFixed(0)}° sat ${(s * 100).toFixed(0)} % luz ${(l * 100).toFixed(0)} %`;
    return null;
  };

  // ---------- qué se ve ----------
  const desc = el => {
    let s = el.tagName.toLowerCase();
    if(el.id) s += "#" + el.id;
    const k = typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "";
    if(k.trim()) s += "." + k.trim().split(/\s+/).slice(0, 3).join(".");
    return s;
  };
  const path = el => { const a = []; for(let p = el; p && p !== document.body && a.length < 3; p = p.parentElement) a.unshift(desc(p)); return a.join(" > "); };
  const docW = Math.max(document.documentElement.scrollWidth, innerWidth), docH = Math.max(document.documentElement.scrollHeight, innerHeight);
  const inSprite = el => !!el.closest("svg[hidden], symbol, defs, template");
  const csCache = new Map();
  const CS = el => { let c = csCache.get(el); if(!c){ c = getComputedStyle(el); csCache.set(el, c); } return c; };
  const opCache = new Map();
  const opacityOf = el => {                        // opacidad acumulada
    if(!el || el.nodeType !== 1) return 1;
    if(opCache.has(el)) return opCache.get(el);
    const v = (+CS(el).opacity) * opacityOf(el.parentElement);
    opCache.set(el, v); return v;
  };
  const shown = el => {
    if(inSprite(el)) return false;
    if(el.checkVisibility && !el.checkVisibility({visibilityProperty: true, contentVisibilityAuto: true})) return false;
    const r = el.getBoundingClientRect();
    if(r.width < 1 || r.height < 1) return false;
    const x = r.left + scrollX, y = r.top + scrollY;
    if(x + r.width <= 0 || y + r.height <= 0 || x >= docW || y >= docH) return false;
    if(opacityOf(el) < .05) return false;
    return r;
  };
  // recortado por un antepasado con overflow distinto de visible (acordeones cerrados, carruseles…)
  const clipped = (el, r) => {
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    for(let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement){
      const cs = CS(p);
      if(cs.position === "fixed") break;
      if(cs.overflowX === "visible" && cs.overflowY === "visible" && cs.clipPath === "none") continue;
      const q = p.getBoundingClientRect();
      if(cs.overflowX !== "visible"){ L = Math.max(L, q.left); R = Math.min(R, q.right); }
      if(cs.overflowY !== "visible"){ T = Math.max(T, q.top); B = Math.min(B, q.bottom); }
      if(R - L < 2 || B - T < 2) return true;
    }
    return false;
  };
  const disabled = el => !!el.closest(":disabled, [aria-disabled=true], fieldset:disabled");
  // apareciendo o desapareciendo (una animación o transición de opacidad en marcha): no se mide a medias
  const fading = el => {
    for(let p = el; p && p !== document.documentElement; p = p.parentElement){
      if(+CS(p).opacity < 1 && p.getAnimations && p.getAnimations().some(a => a.playState === "running")) return true;
    }
    return false;
  };

  // ---------- fondo efectivo ----------
  const bgOf = el => {
    const layers = [];                             // de arriba (el propio elemento) a abajo
    for(let p = el; p; p = p.parentElement){
      const cs = CS(p);
      const bi = cs.backgroundImage;
      if(bi && bi !== "none"){
        if(/url\(/i.test(bi)) return null;           // hay un dibujo detrás: no se puede medir
        const stops = colorsIn(bi);
        if(stops.length) layers.push(avg(stops));
      }
      const bc = parse(cs.backgroundColor);
      if(bc && bc.a > 0){ layers.push(bc); if(bc.a >= .999) break; }
    }
    let bg = {r: 255, g: 255, b: 255, a: 1};       // el lienzo del navegador
    for(let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return bg;
  };

  const LETTER = /[\p{L}\p{N}]/u;
  const all = document.querySelectorAll("body *");
  for(const el of all){
    if(el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "TEMPLATE" || el.tagName === "OPTION") continue;
    const isSvg = el.namespaceURI === "http://www.w3.org/2000/svg";

    // backdrop-filter (también lo oculto y los pseudoelementos)
    if(what.has("backdrop")){
      for(const pe of [null, "::before", "::after"]){
        const cs = pe ? getComputedStyle(el, pe) : CS(el);
        if(pe && (cs.content === "none" || cs.content === "normal")) continue;
        const bf = cs.backdropFilter, wbf = cs.webkitBackdropFilter;
        if((bf && bf !== "none") || (wbf && wbf !== "none")) out.backdrop.push(`${path(el)}${pe || ""}: ${bf || wbf}`);
      }
    }
    if(!what.has("palette") && !what.has("contrast")) continue;
    const r = shown(el);
    if(!r) continue;
    out.n.els++;
    const cs = CS(el);

    // paleta
    if(what.has("palette") && !el.closest("[data-brand]")){
      const check = (prop, val, pe) => {
        for(const c of (prop === "background-image" ? colorsIn(val) : [parse(val)])){
          const why = banned(c);
          if(why) out.palette.push(`${path(el)}${pe || ""} ${prop} ${hex(c)} (${why})`);
        }
      };
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if(own || isSvg) check("color", cs.color);
      check("background-color", cs.backgroundColor);
      if(cs.backgroundImage && cs.backgroundImage !== "none") check("background-image", cs.backgroundImage);
      for(const side of ["Top", "Right", "Bottom", "Left"]){
        if(parseFloat(cs["border" + side + "Width"]) > 0 && !/none|hidden/.test(cs["border" + side + "Style"]))
          check("border-" + side.toLowerCase() + "-color", cs["border" + side + "Color"]);
      }
      if(isSvg){
        if(cs.fill && !/^url\(/.test(cs.fill)) check("fill", cs.fill);
        if(cs.stroke && cs.stroke !== "none" && !/^url\(/.test(cs.stroke)) check("stroke", cs.stroke);
      }
      for(const pe of ["::before", "::after"]){
        const ps = getComputedStyle(el, pe);
        if(ps.content === "none" || ps.content === "normal" || ps.display === "none" || ps.visibility !== "visible" || +ps.opacity < .05) continue;
        if(/["']\s*[\p{L}\p{N}]/u.test(ps.content)) check("color", ps.color, pe);
        check("background-color", ps.backgroundColor, pe);
        if(ps.backgroundImage && ps.backgroundImage !== "none") check("background-image", ps.backgroundImage, pe);
        for(const side of ["Top", "Right", "Bottom", "Left"]){
          if(parseFloat(ps["border" + side + "Width"]) > 0 && !/none|hidden/.test(ps["border" + side + "Style"]))
            check("border-" + side.toLowerCase() + "-color", ps["border" + side + "Color"], pe);
        }
      }
    }

    // contraste de los textos propios del elemento
    if(what.has("contrast") && !isSvg){
      const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(" ").replace(/\s+/g, " ").trim();
      if(!txt || !LETTER.test(txt)) continue;      // vacío, o solo emojis y símbolos
      if(disabled(el) || clipped(el, r) || fading(el)) continue;
      if(/text/.test(cs.webkitBackgroundClip || cs.backgroundClip || "")) continue;
      const fg0 = parse(cs.webkitTextFillColor) || parse(cs.color);
      if(!fg0) continue;
      const bg = bgOf(el);
      if(!bg) continue;                            // texto sobre un dibujo
      out.n.texts++;
      const fg = {r: fg0.r, g: fg0.g, b: fg0.b, a: fg0.a * opacityOf(el)};
      const cr = ratio(over(fg, bg), bg);
      const size = parseFloat(cs.fontSize), bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      if(cr < need - .01)
        out.contrast.push(`${path(el)} «${txt.slice(0, 36)}» ${cr.toFixed(2)}:1 < ${need} (texto ${hex(fg)} sobre ${hex(bg)}, ${size}px/${cs.fontWeight})`);
    }
  }
  // sin repetidos (listas de elementos iguales)
  for(const k of ["contrast", "palette", "backdrop"]) out[k] = [...new Set(out[k])];
  return out;
}
