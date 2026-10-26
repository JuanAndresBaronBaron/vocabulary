/* Módulo ielts-boot (window.vocabIelts): la entrada a IELTS Prep (ielts.html), la página aparte para que un mayor
   prepare el IELTS Academic (banda 8.5-9 ≈ C2). Igual que Tech Prep, está escondida y no toca nada del niño:
   · El interruptor de este aparato (localStorage "ielts:on" = true; fuera de la partida): la fila «IELTS Prep» de
     Ajustes › Para mayores (adultHtml(), en español como el resto de esa página). Apagado: no hay entrada en el menú.
   · La entrada «IELTS Prep» del menú de la bandera (menuItem(), que pinta renderLangs de index.html): pasa la Puerta
     (adultGate, «Para entrar en IELTS Prep.»), pone sessionStorage "ielts:in" = "1" y abre ielts.html en la misma
     pestaña. ielts.html sin esa marca solo explica cómo entrar.
   API: window.vocabIelts = {on(), setOn(v), enter(from), menuItem(), adultHtml()}. */
(() => {
"use strict";
const W = window;
const ON = "ielts:on", IN = "ielts:in";
const on = () => { try{ return localStorage.getItem(ON) === "true"; }catch(e){ return false; } };
function setOn(v){
  try{ if(v) localStorage.setItem(ON, "true"); else { localStorage.removeItem(ON); sessionStorage.removeItem(IN); } }catch(e){}
  try{ renderLangs(); }catch(e){}
}
async function enter(from){
  if(!on()) return false;
  if(typeof W.adultGate !== "function") return false;
  let ok = false;
  try{ ok = await W.adultGate({reason: "Para entrar en IELTS Prep.", from: from && from.nodeType === 1 ? from : null}); }catch(e){ ok = false; }
  if(!ok) return false;
  try{ sessionStorage.setItem(IN, "1"); }catch(e){}
  location.href = "ielts.html";
  return true;
}
function menuItem(){
  if(!on()) return "";
  return `<button type="button" class="lm-i lm-tp" role="menuitem" data-ielts-entry tabindex="-1" lang="en-GB">
    <span class="flag tp-flag" aria-hidden="true">${ico("graduation-cap", "fill", 18)}</span><span class="lm-t">IELTS Prep<small>Academic · band 9</small></span></button>`;
}
function adultHtml(){
  return `<section class="st-sec" id="aj-ie" aria-label="IELTS Prep"><div class="st-g ics">
      <label class="st-r" for="aj-ie-on"><span class="st-ic tl" aria-hidden="true">${ico("graduation-cap", "bold", 18)}</span>
        <span class="st-l"><span lang="en-GB">IELTS Prep</span><small>Preparar el IELTS Academic para un C2, en inglés. Solo en este aparato.</small></span>
        <input type="checkbox" role="switch" class="st-sw" id="aj-ie-on" ${on() ? "checked" : ""}></label>
    </div></section>`;
}
bus.on("settings", d => {
  if(!d || d.page !== "mayores" || !d.el) return;
  const sw = d.el.querySelector("#aj-ie-on"); if(!sw) return;
  sw.checked = on();
  sw.onchange = () => { setOn(sw.checked); try{ if(W.G && typeof G.haptic === "function") G.haptic("selection"); }catch(e){} };
});
addEventListener("storage", e => { if(e.key === ON || e.key === null){ try{ renderLangs(); }catch(err){} } });
W.vocabIelts = {on, setOn, enter, menuItem, adultHtml};
})();
