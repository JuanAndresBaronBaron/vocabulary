// Auditoría de accesibilidad de la pantalla que se ve (F6b). axe-core no está en la máquina y no se instala nada, así
// que estas son reglas propias, pensadas para lo que usa esta app (la usa tests/e2e/test_f6_accesibilidad.py con
// page.evaluate(A11Y, opts)). El contraste lo mide audit.js (F1), que ya compone el fondo real.
//   opts.what: lista con "names", "roles", "images", "targets", "ids", "dialogs" y/o "focusable" (por defecto, todas)
//   opts.min: tamaño mínimo de un objetivo táctil en px (44 por defecto, SPEC §3)
// Devuelve {names: [...], roles: [...], images: [...], targets: [...], ids: [...], dialogs: [...], focusable: [...],
//           live: [regiones vivas que hay], n: {controls, images}}: cada fallo es una línea legible.
//   names:     cada control que se ve (botón, enlace, pestaña, opción de menú, interruptor, campo…) tiene un nombre
//              accesible (aria-labelledby, aria-label, <label>, el texto de dentro sin lo que lleva aria-hidden, el alt
//              de sus dibujos, title). También los diálogos abiertos, role=img, progressbar y meter.
//   roles:     role=tab dentro de un role=tablist y con aria-selected; en cada tablist que se ve, una sola seleccionada;
//              role=radio en un radiogroup con aria-checked; switch/checkbox con aria-checked; menuitem* dentro de un
//              menu; option dentro de un listbox; aria-pressed/expanded/selected/checked con valores válidos; ninguna
//              referencia aria-* (controls, labelledby, describedby, owns, activedescendant) ni label[for] a un id que
//              no existe; sin tabindex positivo; sin controles dentro de otros controles.
//   images:    <img> que se ve con alt (vacío vale, es un adorno) o dentro de aria-hidden/role=presentation; <svg> sueltos
//              (fuera de un control con nombre) con aria-hidden o con role=img y nombre.
//   targets:   controles que se ven de al menos opts.min × opts.min px (salvo enlaces dentro de una frase; un campo con su
//              <label> cuenta con la etiqueta, que también se toca).
//   ids:       ids repetidos en el documento (rompen aria-labelledby, aria-controls y label[for]).
//   dialogs:   cada <dialog> abierto es modal (showModal, o aria-modal=true), tiene nombre y el foco está dentro.
//   focusable: nada que se pueda enfocar con Tab dentro de aria-hidden=true.
// Con un diálogo modal abierto, solo se mira lo que hay en la capa de arriba (lo demás está inerte).
(opts) => {
  opts = opts || {};
  const what = new Set(opts.what || ["names", "roles", "images", "targets", "ids", "dialogs", "focusable"]);
  const MIN = opts.min || 44;
  const out = {names: [], roles: [], images: [], targets: [], ids: [], dialogs: [], focusable: [], live: [], n: {controls: 0, images: 0}};

  const desc = el => {
    let s = el.tagName.toLowerCase();
    if(el.id) s += "#" + el.id;
    const k = typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "";
    if(k.trim()) s += "." + k.trim().split(/\s+/).slice(0, 3).join(".");
    const r = el.getAttribute && el.getAttribute("role"); if(r) s += `[role=${r}]`;
    return s;
  };
  const path = el => { const a = []; for(let p = el; p && p !== document.body && a.length < 3; p = p.parentElement) a.unshift(desc(p)); return a.join(" > "); };
  const short = (s, n = 40) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const CSM = new Map();
  const CS = el => { let c = CSM.get(el); if(!c){ c = getComputedStyle(el); CSM.set(el, c); } return c; };
  const inSprite = el => !!el.closest("svg[hidden], symbol, defs, template, [hidden]");

  // la capa de arriba: con un diálogo modal abierto, solo cuenta lo que hay dentro (y los popovers abiertos)
  const modals = [...document.querySelectorAll("dialog[open]")].filter(d => { try{ return d.matches(":modal"); }catch(e){ return false; } });
  const topModal = modals[modals.length - 1] || null;
  const inScope = el => {
    if(!topModal) return !el.closest("[inert]");
    return topModal.contains(el) || !!el.closest(":popover-open");
  };
  const hiddenAria = el => !!el.closest("[aria-hidden=true]");
  const shown = el => {
    if(inSprite(el)) return false;
    if(el.checkVisibility && !el.checkVisibility({visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true})) return false;
    const r = el.getBoundingClientRect();
    if(r.width < 1 || r.height < 1) return false;
    // fuera de la página (a la izquierda o arriba del todo, o un carrusel recortado)
    const docW = Math.max(document.documentElement.scrollWidth, innerWidth), docH = Math.max(document.documentElement.scrollHeight, innerHeight);
    if(r.right + scrollX <= 0 || r.bottom + scrollY <= 0 || r.left + scrollX >= docW || r.top + scrollY >= docH) return false;
    return r;
  };
  // recortado del todo por un antepasado con overflow (acordeones cerrados, carruseles, la hoja a media altura…)
  const clippedAway = (el, r) => {
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    for(let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement){
      const cs = CS(p);
      if(cs.overflowX === "visible" && cs.overflowY === "visible" && cs.clipPath === "none") { if(cs.position === "fixed") break; continue; }
      const q = p.getBoundingClientRect();
      if(cs.overflowX !== "visible"){ L = Math.max(L, q.left); R = Math.min(R, q.right); }
      if(cs.overflowY !== "visible"){ T = Math.max(T, q.top); B = Math.min(B, q.bottom); }
      if(R - L < 2 || B - T < 2) return true;
      if(cs.position === "fixed") break;
    }
    return false;
  };

  // ---------- roles ----------
  const NAME_FROM_CONTENT = new Set(["button", "link", "tab", "menuitem", "menuitemradio", "menuitemcheckbox", "option", "switch",
    "checkbox", "radio", "treeitem", "cell", "columnheader", "rowheader", "heading", "tooltip", "row"]);
  const CONTROL_ROLES = new Set(["button", "link", "tab", "menuitem", "menuitemradio", "menuitemcheckbox", "option", "switch",
    "checkbox", "radio", "slider", "spinbutton", "combobox", "textbox", "searchbox", "listbox"]);
  const roleOf = el => {
    const r = (el.getAttribute("role") || "").trim().split(/\s+/)[0];
    if(r) return r;
    const t = el.tagName;
    if(t === "A" || t === "AREA") return el.hasAttribute("href") ? "link" : "";
    if(t === "BUTTON") return "button";
    if(t === "SUMMARY") return "button";
    if(t === "SELECT") return el.multiple || el.size > 1 ? "listbox" : "combobox";
    if(t === "TEXTAREA") return "textbox";
    if(t === "INPUT"){
      const ty = (el.type || "text").toLowerCase();
      return {button: "button", submit: "button", reset: "button", image: "button", checkbox: el.hasAttribute("switch") ? "switch" : "checkbox", radio: "radio",
        range: "slider", number: "spinbutton", search: "searchbox", hidden: "", file: "button", color: "button"}[ty] ?? "textbox";
    }
    if(t === "DIALOG") return "dialog";
    if(t === "IMG") return el.getAttribute("alt") === "" ? "presentation" : "img";
    if(t === "PROGRESS") return "progressbar";
    if(t === "METER") return "meter";
    if(t === "NAV") return "navigation";
    if(t === "MAIN") return "main";
    return "";
  };
  const isControl = el => {
    if(el.disabled) return false;
    const r = roleOf(el);
    if(CONTROL_ROLES.has(r)) return true;
    const ti = el.getAttribute("tabindex");
    return ti !== null && +ti >= 0 && r !== "dialog" && !["tabpanel", "region", "group", "document", "application", "list", "listitem", "article", "main", "img", "status", "log"].includes(r)
      && !(el.tagName === "DIALOG");
  };

  // ---------- nombre accesible (accname, lo justo para esta app) ----------
  const pseudo = (el, pe) => { try{ const c = getComputedStyle(el, pe).content; const m = /^["'](.*)["']$/.exec(c || ""); return m ? m[1] : ""; }catch(e){ return ""; } };
  const textOf = (node, depth = 0) => {
    if(depth > 30) return "";
    if(node.nodeType === 3) return node.textContent;
    if(node.nodeType !== 1) return "";
    const el = node;
    if(el.getAttribute("aria-hidden") === "true") return "";
    if(el.tagName === "STYLE" || el.tagName === "SCRIPT" || el.tagName === "TEMPLATE") return "";
    if(el.namespaceURI !== "http://www.w3.org/2000/svg"){
      const cs = CS(el);
      if(cs.display === "none" || cs.visibility === "hidden") return "";
    }
    if(depth > 0){
      const lb = el.getAttribute("aria-label"); if(lb && lb.trim()) return " " + lb + " ";
    }
    if(el.tagName === "IMG") return " " + (el.getAttribute("alt") || "") + " ";
    if(el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type)) return " " + el.value + " ";
    if(el.namespaceURI === "http://www.w3.org/2000/svg"){
      const t = el.querySelector(":scope > title"); return t ? " " + t.textContent + " " : "";
    }
    let s = pseudo(el, "::before");
    for(const c of el.childNodes) s += textOf(c, depth + 1);
    s += pseudo(el, "::after");
    const bl = CS(el).display; if(bl && bl !== "inline" && bl !== "contents") s = " " + s + " ";
    return s;
  };
  const byIds = ids => ids.split(/\s+/).map(id => document.getElementById(id)).filter(Boolean);
  const nameOf = el => {
    const lb = el.getAttribute("aria-labelledby");
    if(lb){ const t = byIds(lb).map(x => (x.getAttribute("aria-label") || textOf(x) || "")).join(" ").replace(/\s+/g, " ").trim(); if(t) return t; }
    const al = el.getAttribute("aria-label"); if(al && al.trim()) return al.trim();
    const tg = el.tagName;
    if((tg === "INPUT" || tg === "SELECT" || tg === "TEXTAREA") && el.labels && el.labels.length){
      const t = [...el.labels].map(l => textOf(l)).join(" ").replace(/\s+/g, " ").trim(); if(t) return t;
    }
    if(tg === "IMG") return (el.getAttribute("alt") || "").trim() || (el.getAttribute("title") || "").trim();
    if(tg === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && el.value) return el.value;
    if(tg === "INPUT" && el.type === "image") return (el.alt || "").trim();
    if(el.namespaceURI === "http://www.w3.org/2000/svg"){ const t = el.querySelector(":scope > title"); if(t && t.textContent.trim()) return t.textContent.trim(); }
    const r = roleOf(el);
    if(NAME_FROM_CONTENT.has(r) || tg === "SUMMARY" || tg === "LABEL"){
      const t = textOf(el).replace(/\s+/g, " ").trim(); if(t) return t;
    }
    if(tg === "DIALOG"){ /* un diálogo sin etiqueta: el nombre no sale de su contenido */ }
    const ti = (el.getAttribute("title") || "").trim(); if(ti) return ti;
    if((tg === "INPUT" || tg === "TEXTAREA") && el.placeholder) return el.placeholder.trim();
    return "";
  };

  const all = [...document.querySelectorAll("body *")].filter(el => inScope(el));

  // ---------- ids repetidos (en todo el documento, también lo oculto) ----------
  if(what.has("ids")){
    const seen = new Map();
    for(const el of document.querySelectorAll("[id]")){
      if(el.closest("symbol, defs")) continue;
      const id = el.id; if(!id) continue;
      seen.set(id, (seen.get(id) || 0) + 1);
    }
    for(const [id, n] of seen) if(n > 1) out.ids.push(`id «${id}» repetido ${n} veces (${[...document.querySelectorAll(`[id="${CSS.escape(id)}"]`)].slice(0, 2).map(path).join(" · ")})`);
  }

  const tabbable = el => {
    if(el.disabled || el.closest("[inert]")) return false;
    const ti = el.getAttribute("tabindex");
    if(ti !== null) return +ti >= 0;
    const t = el.tagName;
    if((t === "A" || t === "AREA") && el.hasAttribute("href")) return true;
    if(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY", "IFRAME"].includes(t)) return !(t === "INPUT" && el.type === "hidden");
    if(el.isContentEditable) return true;
    return false;
  };

  for(const el of all){
    if(el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "TEMPLATE" || el.tagName === "OPTION" && el.closest("select")) continue;
    const r = roleOf(el);

    // referencias aria-* y label[for] a ids que no existen, en lo que se ve y en los diálogos abiertos (como axe-core: lo
    // oculto no cuenta, y un aria-controls con aria-expanded=false puede apuntar a algo que aún no se ha creado)
    if(what.has("roles") && (el.tagName === "DIALOG" ? el.open : !!shown(el))){
      for(const a of ["aria-controls", "aria-labelledby", "aria-describedby", "aria-owns", "aria-activedescendant", "aria-errormessage", "aria-details"]){
        const v = el.getAttribute(a); if(!v) continue;
        if((a === "aria-controls" || a === "aria-owns") && el.getAttribute("aria-expanded") === "false") continue;
        const miss = v.split(/\s+/).filter(id => id && !document.getElementById(id));
        if(miss.length) out.roles.push(`${path(el)}: ${a} apunta a ${miss.map(x => "#" + x).join(", ")}, que no existe`);
      }
      if(el.tagName === "LABEL" && el.htmlFor && !document.getElementById(el.htmlFor)) out.roles.push(`${path(el)}: label for=«${el.htmlFor}» no existe`);
      const ti = el.getAttribute("tabindex"); if(ti !== null && +ti > 0) out.roles.push(`${path(el)}: tabindex=${ti} (positivo: cambia el orden del foco)`);
      for(const [a, ok] of [["aria-pressed", /^(true|false|mixed)$/], ["aria-expanded", /^(true|false)$/], ["aria-selected", /^(true|false)$/], ["aria-checked", /^(true|false|mixed)$/], ["aria-hidden", /^(true|false)$/], ["aria-modal", /^(true|false)$/]]){
        const v = el.getAttribute(a); if(v !== null && !ok.test(v)) out.roles.push(`${path(el)}: ${a}=«${v}» no es un valor válido`);
      }
    }

    // nada enfocable con Tab dentro de aria-hidden
    if(what.has("focusable") && hiddenAria(el) && tabbable(el) && shown(el)) out.focusable.push(`${path(el)}: se puede enfocar con Tab pero está dentro de aria-hidden=true`);

    if(hiddenAria(el) && el.tagName !== "DIALOG") continue;
    const rect = shown(el);
    if(!rect) continue;
    if(clippedAway(el, rect)) continue;

    // regiones vivas que hay (para el informe)
    const live = el.getAttribute("aria-live") || ({status: "polite", alert: "assertive", log: "polite"})[r];
    if(live) out.live.push(`${path(el)} (${live})`);

    // controles: nombre, tamaño, anidados
    if(isControl(el)){
      out.n.controls++;
      const nm = nameOf(el);
      if(what.has("names") && !nm) out.names.push(`${path(el)} (${r || "foco"}): sin nombre accesible`);
      if(what.has("roles")){
        const inner = el.parentElement && el.parentElement.closest("a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[role=option],[role=switch],[role=checkbox],[role=radio]");
        if(inner && inScope(inner) && !(el.tagName === "INPUT" && inner.tagName === "LABEL")) out.roles.push(`${path(el)}: un control dentro de otro (${desc(inner)})`);
      }
      if(what.has("targets")){
        const inlineLink = (el.tagName === "A") && CS(el).display.startsWith("inline") && el.parentElement &&
          [...el.parentElement.childNodes].some(n => n !== el && (n.nodeType === 3 ? n.textContent.trim() : n.nodeType === 1 && CS(n).display.startsWith("inline") && n.textContent.trim()));
        const textField = el.tagName === "INPUT" && !/^(button|submit|reset|checkbox|radio|image|range|color|file)$/i.test(el.type) || el.tagName === "TEXTAREA";
        // un campo dentro de su <label> (o con label[for]): se toca toda la etiqueta
        let w = rect.width, h = rect.height;
        if(el.labels && el.labels.length) for(const l of el.labels){ const q = l.getBoundingClientRect(); if(q.width * q.height > w * h){ w = q.width; h = q.height; } }
        if(!inlineLink && !(el.type === "range") && (w < MIN - .5 || h < (textField ? MIN : MIN) - .5) && !el.closest("[data-a11y-small]"))
          out.targets.push(`${path(el)} «${short(nm, 28)}»: ${w.toFixed(0)}×${h.toFixed(0)} px (< ${MIN})`);
      }
    } else if(what.has("names") && (r === "img" && el.tagName !== "IMG" || r === "progressbar" || r === "meter" || r === "radiogroup" || r === "menu" || r === "listbox")){
      if(r === "img" || r === "progressbar" || r === "meter"){ if(!nameOf(el)) out.names.push(`${path(el)} (role=${r}): sin nombre accesible`); }
    }

    if(what.has("roles")){
      const ctx = (sel) => { for(let p = el.parentElement; p; p = p.parentElement){ const pr = p.getAttribute("role"); if(p.matches(sel)) return p; if(pr && !["presentation", "none", "group", "generic"].includes(pr) && !(sel.includes("menu") && pr === "group")) return null; } return null; };
      if(r === "tab"){
        if(!ctx("[role=tablist]")) out.roles.push(`${path(el)}: role=tab fuera de un role=tablist`);
        if(!/^(true|false)$/.test(el.getAttribute("aria-selected") || "")) out.roles.push(`${path(el)}: role=tab sin aria-selected`);
      }
      if(r === "tablist"){
        const tabs = [...el.querySelectorAll("[role=tab]")].filter(t => t.closest("[role=tablist]") === el && shown(t));
        const sel = tabs.filter(t => t.getAttribute("aria-selected") === "true").length;
        if(tabs.length && sel > 1) out.roles.push(`${path(el)}: ${sel} pestañas con aria-selected=true (solo puede haber una)`);
        if(tabs.length && sel === 0 && !el.hasAttribute("data-a11y-nosel")) out.roles.push(`${path(el)}: ninguna pestaña seleccionada`);
      }
      if(r === "radio" && el.tagName !== "INPUT"){
        if(!ctx("[role=radiogroup]")) out.roles.push(`${path(el)}: role=radio fuera de un role=radiogroup`);
        if(!/^(true|false)$/.test(el.getAttribute("aria-checked") || "")) out.roles.push(`${path(el)}: role=radio sin aria-checked`);
      }
      if((r === "switch" || r === "checkbox") && el.tagName !== "INPUT" && !/^(true|false|mixed)$/.test(el.getAttribute("aria-checked") || ""))
        out.roles.push(`${path(el)}: role=${r} sin aria-checked`);
      if(/^menuitem/.test(r)){
        if(!ctx("[role=menu],[role=menubar]")) out.roles.push(`${path(el)}: role=${r} fuera de un menú`);
        if(r !== "menuitem" && !/^(true|false|mixed)$/.test(el.getAttribute("aria-checked") || "")) out.roles.push(`${path(el)}: role=${r} sin aria-checked`);
      }
      if(r === "option" && el.tagName !== "OPTION" && !ctx("[role=listbox],[role=combobox]")) out.roles.push(`${path(el)}: role=option fuera de un listbox`);
    }

    // dibujos
    if(what.has("images")){
      if(el.tagName === "IMG"){
        out.n.images++;
        if(!el.hasAttribute("alt") && !el.closest("[role=presentation],[role=none]") && el.getAttribute("role") !== "presentation")
          out.images.push(`${path(el)} (${short((el.getAttribute("src") || "").split("/").pop(), 30)}): <img> sin alt (alt="" si es un adorno)`);
      } else if(el.tagName.toLowerCase() === "svg" && !el.closest("svg:not(:scope)")){
        const named = el.getAttribute("role") === "img" ? !!nameOf(el) : false;
        const inCtl = el.parentElement && el.parentElement.closest("a[href],button,[role],label,summary,[aria-label],[aria-labelledby]");
        if(!named && !inCtl && el.getAttribute("aria-hidden") !== "true" && el.getAttribute("role") !== "presentation" && el.getAttribute("role") !== "none" && rect.width >= 8)
          out.images.push(`${path(el)}: <svg> suelto sin aria-hidden ni role=img con nombre`);
      }
    }
  }

  // ---------- diálogos abiertos ----------
  if(what.has("dialogs")){
    for(const d of document.querySelectorAll("dialog[open], [role=dialog]:not(dialog), [role=alertdialog]")){
      if(d.tagName !== "DIALOG" && (!shown(d) || d.hidden || d.closest("[hidden]"))) continue;
      const modal = (() => { try{ return d.matches(":modal"); }catch(e){ return false; } })() || d.getAttribute("aria-modal") === "true";
      const nm = nameOf(d);
      if(!nm) out.dialogs.push(`${path(d)}: diálogo sin nombre (aria-labelledby o aria-label)`);
      if(d.tagName === "DIALOG" && !modal) out.dialogs.push(`${path(d)}: <dialog> abierto sin modal (show() en vez de showModal(), o sin aria-modal)`);
      if(modal && d === topModal && !d.contains(document.activeElement) && document.activeElement !== d)
        out.dialogs.push(`${path(d)}: el foco no está dentro de la hoja (está en ${document.activeElement ? desc(document.activeElement) : "nada"})`);
    }
  }

  for(const k of Object.keys(out)) if(Array.isArray(out[k])) out[k] = [...new Set(out[k])];
  return out;
}
