/* Módulo gate: la Puerta de mayores (window.adultGate), para lo que no debe hacer un niño solo.
   - adultGate({reason, from}) → Promise<boolean>: hoja «Para mayores» con una suma de dos números de dos cifras, con
     llevada y escritos en letras («¿Cuánto es cuarenta y siete más treinta y cinco?»), que se contesta con un teclado
     numérico (0-9, borrar y OK) y un campo: sin opciones que tocar, adivinar casi nunca sale (menos de 1 de cada 300).
     Cada fallo trae una suma nueva; al 3.º se cierra con un aviso amable, da false y la Puerta espera un minuto
     («Vuelve a probar en un minuto»: en ese rato se abre sin teclado; sessionStorage "vocab:gate-wait"). Esc,
     «Cancelar» o tocar fuera: false. reason: una frase corta de para qué es («Para entrar con Google.»); from: el
     botón desde el que sale la hoja. Con teclado físico: las cifras, Retroceso e Intro.
   - Acertar se recuerda 5 minutos en sessionStorage ("vocab:gate", fuera de la partida): en ese tiempo adultGate() da
     true sin preguntar. adultGate.passed() → boolean (lo mismo, sin esperar: sirve para abrir algo dentro del toque)
     · adultGate.forget() la vuelve a cerrar (Ajustes lo llama al cerrarse) · adultGate.waiting() → ms que faltan de la
     espera (0 si no hay).
   - Si ya hay una abierta, devuelve la misma promesa. Sin «mantener 3 s» ni trucos escondidos.
   - Enlaces externos: un toque en un <a> a otra web pasa antes por la Puerta (con la Puerta abierta, se abre directo) y
     se abre siempre en otra pestaña, así la app no se cierra. [data-no-gate] lo evita.
   Protege (SPEC §3): Para mayores, entrar con Google, abrir enlaces externos, borrar datos, el sello de Frases mágicas y
   las cartas del Buzón. */
(() => {
"use strict";
const KEY = "vocab:gate", WAIT = "vocab:gate-wait", MS = 5 * 60e3, LOCK = 60e3, TRIES = 3, MAXLEN = 3;
const UNI = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const VEINTI = ["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const TENS = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa"};
/* 21-99 en letras («cuarenta y siete») */
const words = n => n < 30 ? VEINTI[n - 20] : TENS[Math.floor(n / 10)] + (n % 10 ? " y " + UNI[n % 10] : "");
const $ = id => document.getElementById(id);
const rnd = n => { try{ const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }catch(e){ return Math.floor(Math.random() * n); } };
/* el candado: ico() de index.html o, en una página sin el sprite (privacy.html), el mismo dibujo de Phosphor en línea */
const LOCK_SVG = '<path d="M208,76H180V56A52,52,0,0,0,76,56V76H48A20,20,0,0,0,28,96V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V96A20,20,0,0,0,208,76ZM100,56a28,28,0,0,1,56,0V76H100ZM204,204H52V100H204Zm-60-52a16,16,0,1,1-16-16A16,16,0,0,1,144,152Z"/>';
const lock = z => typeof ico === "function" ? ico("lock", "bold", z)
  : `<svg class="ico" width="${z}" height="${z}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${LOCK_SVG}</svg>`;
/* la tecla de borrar: un dibujo sencillo en línea (en todas las páginas); fill:none en style porque .ico pinta el relleno */
const DEL = '<svg class="ico" width="26" height="26" viewBox="0 0 256 256" style="fill:none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M61.67,204.12,16,128,61.67,51.88A8,8,0,0,1,68.53,48H216a8,8,0,0,1,8,8V200a8,8,0,0,1-8,8H68.53A8,8,0,0,1,61.67,204.12Z"/><line x1="160" y1="104" x2="112" y2="152"/><line x1="160" y1="152" x2="112" y2="104"/></svg>';

const num = k => { try{ return +sessionStorage.getItem(k) || 0; }catch(e){ return 0; } };
function passed(){ const t = num(KEY); return t > 0 && Date.now() < t && t - Date.now() <= MS; }
function remember(){ try{ sessionStorage.setItem(KEY, String(Date.now() + MS)); sessionStorage.removeItem(WAIT); }catch(e){} }
function forget(){ try{ sessionStorage.removeItem(KEY); }catch(e){} }
function waiting(){ const t = num(WAIT), l = t - Date.now(); return l > 0 && l <= LOCK ? l : 0; }
function hold(){ try{ sessionStorage.setItem(WAIT, String(Date.now() + LOCK)); }catch(e){} }

/* una suma nueva: a + b con a y b entre 36 y 89, sin ceros y con llevada (las unidades suman 10 o más) */
function question(prev){
  let a, b;
  do { a = 36 + rnd(54); b = 36 + rnd(54); }
  while(a % 10 === 0 || b % 10 === 0 || a % 10 + b % 10 < 10 || (prev && prev.a === a && prev.b === b));
  return {a, b, s: a + b};
}

const CSS = `
#gate.m-sheet{max-width:440px}
.gt-in{display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 4px 4px}
.gt-ic{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;margin:0 0 8px;color:#fff;background:var(--brand-fill,#1E6EF4)}
.gt-t{margin:0;font:700 var(--fs-t2,1.5rem)/1.2 var(--f-round,system-ui);color:var(--label,#000)}
.gt-why{margin:4px 0 0;max-width:34ch;font:400 var(--fs-sub,1.0625rem)/1.35 var(--f-text,system-ui);color:var(--label2,#3c3c43)}
.gt-q{margin:16px 0 12px;max-width:26ch;font:700 var(--fs-t3,1.375rem)/1.3 var(--f-round,system-ui);color:var(--label,#000);text-wrap:balance}
.gt-q b{color:inherit;font-weight:800}
.gt-q[hidden]{display:none}
.gt-f{box-sizing:border-box;min-width:152px;height:56px;margin:0 0 12px;padding:0 20px;border-radius:var(--r-md,16px);display:flex;align-items:center;justify-content:center;gap:4px;
  background:var(--card,#fff);box-shadow:inset 0 0 0 1px var(--sep,rgba(60,60,67,.29));color:var(--label,#000);
  font:800 min(calc(2rem*var(--k,1)),44px)/1 var(--f-round,system-ui);font-variant-numeric:tabular-nums;letter-spacing:4px}
.gt-f .ph{color:var(--label3,rgba(60,60,67,.3));font-weight:600}
.gt-ks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:300px}
.gt-k{min-height:56px;border:0;border-radius:var(--r-md,16px);background:var(--fill,rgba(120,120,128,.16));color:var(--label,#000);display:grid;place-items:center;
  font:700 min(calc(1.625rem*var(--k,1)),34px)/1 var(--f-round,system-ui);font-variant-numeric:tabular-nums;cursor:pointer;
  -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.gt-k:active{background:var(--fill2,rgba(120,120,128,.24))}
.gt-k.ok{background:var(--brand-fill,#1E6EF4);color:#fff;font-size:min(calc(1.25rem*var(--k,1)),26px)}
.gt-k:disabled{cursor:default;opacity:.4}
.gt-msg{min-height:1.4em;margin:12px 0 0;font:600 var(--fs-sub,1.0625rem)/1.35 var(--f-text,system-ui);color:var(--label2,#3c3c43)}
.gt-x{margin-top:8px}
/* el texto gris va directo sobre el vidrio de la hoja: un gris más fuerte en claro (como .st-h en Ajustes); privacy.html
   no pone data-theme y sigue al sistema */
:root[data-theme=light] .gt-why,:root[data-theme=light] .gt-msg{color:rgba(60,60,67,.9)}
@media (prefers-color-scheme:light){:root:not([data-theme]) .gt-why,:root:not([data-theme]) .gt-msg{color:rgba(60,60,67,.9)}}
:root[data-contrast=more] .gt-k,:root[data-contrast=more] .gt-f{box-shadow:inset 0 0 0 2px var(--sep)}
@media (prefers-contrast:more){.gt-k,.gt-f{box-shadow:inset 0 0 0 2px var(--sep,rgba(60,60,67,.6))}}
@media (forced-colors:active){.gt-k,.gt-f{border:2px solid ButtonText}}
@media (max-height:700px){.gt-ic{display:none}.gt-q{margin:12px 0 8px}.gt-k{min-height:48px}.gt-f{height:48px;margin-bottom:8px}}
`;
function css(){ if($("css-gate")) return; const s = document.createElement("style"); s.id = "css-gate"; s.textContent = CSS; document.head.appendChild(s); }

let cur = null;   /* la Puerta abierta: {p, res, q, val, fails, ok, d, t} */
function paintField(){
  const g = cur; if(!g) return;
  const f = $("gt-f"), v = g.val;
  f.innerHTML = v ? v : '<span class="ph" aria-hidden="true">?</span>';
  f.setAttribute("aria-label", v ? `Tu respuesta: ${v}` : "Tu respuesta: vacía");
  $("gt-ok").disabled = !v || g.ok !== null || !!waiting();
}
function paint(msg){
  const g = cur; if(!g) return;
  const w = waiting(), q = g.q;
  $("gt-q").hidden = !!w;
  $("gt-q").innerHTML = `¿Cuánto es <b>${words(q.a)} más ${words(q.b)}</b>?`;
  g.d.querySelectorAll(".gt-k").forEach(k => { k.disabled = !!w; });
  $("gt-msg").textContent = w ? "Vuelve a probar en un minuto." : msg || "";
  paintField();
  clearTimeout(g.t);
  if(w) g.t = setTimeout(() => { if(cur === g){ g.q = question(g.q); g.val = ""; paint("¡Ya puedes probar!"); } }, w + 50);
}
function key(k){
  const g = cur; if(!g || g.ok !== null || waiting()) return;
  if(k === "del"){ g.val = g.val.slice(0, -1); paintField(); return; }
  if(k === "ok") return check();
  if(/^\d$/.test(k) && g.val.length < MAXLEN){ g.val = (g.val + k).replace(/^0+(?=\d)/, ""); paintField(); }
}
function check(){
  const g = cur; if(!g || !g.val || g.ok !== null) return;
  if(+g.val === g.q.s){
    g.ok = true; remember();
    try{ if(window.G && typeof G.haptic === "function") G.haptic("success"); }catch(e){}
    g.d.querySelectorAll(".gt-k").forEach(x => { x.disabled = true; });
    g.res(true);   /* aquí mismo, dentro del toque: quien espera puede abrir una ventana (Google, un enlace) */
    close(g);
    return;
  }
  g.fails++;
  g.val = "";
  if(g.fails >= TRIES){
    hold();
    g.ok = false; g.res(false); close(g);
    setTimeout(() => { try{ if(window.M) M.toast("Esto es para mayores. ¡Pide ayuda a uno!", {icon: lock(22)}); }catch(e){} }, 120);
    return;
  }
  g.q = question(g.q);
  paint(g.fails === 1 ? "Esa no es. Prueba con esta otra." : "Esa tampoco. Una más:");
}
function close(g){
  const d = g.d; clearTimeout(g.t); if(!d.open) return;
  if(window.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close();
}
function build(){
  let d = $("gate"); if(d) return d;
  css();
  d = document.createElement("dialog");
  d.id = "gate"; d.className = "gt";
  d.setAttribute("aria-labelledby", "gt-t"); d.setAttribute("aria-describedby", "gt-why gt-q");
  d.dataset.noRenew = ""; d.dataset.noHint = "";
  const k = v => `<button type="button" class="gt-k" data-k="${v}">${v}</button>`;
  d.innerHTML = `<div class="gt-in">
    <div class="gt-ic" aria-hidden="true">${lock(24)}</div>
    <h2 class="gt-t" id="gt-t">Para mayores</h2>
    <p class="gt-why" id="gt-why"></p>
    <p class="gt-q" id="gt-q"></p>
    <p class="gt-f" id="gt-f" role="status" aria-live="polite"></p>
    <div class="gt-ks" id="gt-ks" role="group" aria-label="Teclado de números">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k).join("")}
      <button type="button" class="gt-k" data-k="del" aria-label="Borrar">${DEL}</button>${k(0)}
      <button type="button" class="gt-k ok" data-k="ok" id="gt-ok">OK</button></div>
    <p class="gt-msg" id="gt-msg" role="status" aria-live="polite"></p>
    <button type="button" class="glass-btn glass-btn--sm gt-x" id="gt-x">Cancelar</button></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest(".gt-k"); if(b && !b.disabled) return key(b.dataset.k);
    if(e.target.closest && e.target.closest("#gt-x") && cur){ cur.ok = false; cur.res(false); close(cur); }
  });
  /* teclado físico: cifras, Retroceso e Intro (Intro sobre «Cancelar» sigue siendo «Cancelar») */
  d.addEventListener("keydown", e => {
    if(!cur || e.ctrlKey || e.metaKey || e.altKey) return;
    if(/^\d$/.test(e.key)){ e.preventDefault(); key(e.key); }
    else if(e.key === "Backspace"){ e.preventDefault(); key("del"); }
    else if(e.key === "Enter" && !(e.target.closest && e.target.closest("#gt-x, .gt-k"))){ e.preventDefault(); key("ok"); }
  });
  d.addEventListener("close", () => {
    /* el foco vuelve a la hoja que quede abierta debajo (si el botón que abrió la Puerta ya no está a la vista) */
    setTimeout(() => {
      const ae = document.activeElement, top = [...document.querySelectorAll("dialog[open]")].filter(x => x !== d).pop();
      if(top && !top.contains(ae)){ const t = top.querySelector("h2[tabindex='-1']") || top; try{ t.focus({preventScroll: true}); }catch(e){} }
    }, 0);
    const g = cur; if(!g || g.d !== d || d.open) return;
    clearTimeout(g.t); cur = null; g.res(false);   /* Esc, tocar fuera o bajar la hoja: no */
  });
  return d;
}

function adultGate(o = {}){
  if(passed()) return Promise.resolve(true);
  if(cur && !cur.done) return cur.p;
  if(cur){   /* la de antes ya contestó y se está cerrando: la nueva sale en cuanto se cierre */
    const d0 = cur.d;
    return new Promise(r => { let t = 0; const go = () => { clearTimeout(t); d0.removeEventListener("close", go); setTimeout(() => r(adultGate(o)), 0); };
      d0.addEventListener("close", go); t = setTimeout(() => { if(cur && cur.d === d0 && !d0.open) cur = null; go(); }, 800); });
  }
  const d = build();
  let res; const p = new Promise(r => { res = r; });
  const g = cur = {p, d, q: question(null), val: "", fails: 0, ok: null, t: 0, res: v => { if(g.done) return; g.done = true; res(!!v); }};
  $("gt-why").textContent = (o && o.reason) || "Esta parte es para mayores.";
  paint("");
  const from = o && o.from && o.from.nodeType === 1 ? o.from : null;
  if(window.M && typeof M.openSheet === "function") M.openSheet(d, {from});
  else { try{ d.showModal(); }catch(e){ d.setAttribute("open", ""); } }
  return p;
}
adultGate.passed = passed;
adultGate.forget = forget;
adultGate.waiting = waiting;
adultGate.MS = MS;
adultGate.LOCK = LOCK;
window.adultGate = adultGate;

/* enlaces a otras webs: antes, la Puerta. Si ya está abierta, se abre directo (dentro del toque) */
document.addEventListener("click", e => {
  if(e.defaultPrevented || e.button > 0) return;
  const a = e.target.closest && e.target.closest("a[href]"); if(!a || a.closest("[data-no-gate]") || a.hasAttribute("download")) return;
  let u; try{ u = new URL(a.getAttribute("href"), location.href); }catch(_){ return; }
  if(!/^https?:$/.test(u.protocol) || u.origin === location.origin) return;
  e.preventDefault();
  /* siempre en otra pestaña: la app no se cierra */
  if(passed()){ window.open(u.href, "_blank", "noopener"); return; }
  /* la promesa se cumple dentro del toque en la respuesta buena: el navegador deja abrir la pestaña nueva */
  adultGate({reason: "Este enlace abre otra web.", from: a}).then(ok => { if(ok) window.open(u.href, "_blank", "noopener"); });
}, true);
})();
