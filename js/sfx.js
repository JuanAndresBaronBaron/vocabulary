/* Efectos de sonido sintetizados (sin archivos).
   API: sfx.play(nombre) · nombres: tap, pop, coin, ok, bad, gift, fanfare, whoosh, eat, moo · sfx.note(i) (monedas)
        sfx.muted / sfx.toggle() (el interruptor está en Ajustes) · confetti({x, y}) quedan unas chispas (M.burst):
        el confeti de verdad (M.confetti) solo sale al terminar una lección. */
const sfx = (() => {
  let ctx = null;
  const ac = () => {
    if(!ctx){ const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; ctx = new C(); }
    if(ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };
  const tone = (f, t0, dur, type = "sine", vol = .18, f2) => {
    const c = ac(); if(!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .05);
  };
  const noise = (t0, dur, vol = .12, hp = 800) => {
    const c = ac(); if(!c) return;
    const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for(let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + t0;
    f.type = "highpass"; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(t);
  };
  const STEP = [0, 2, 4, 7, 9, 12, 14, 16];
  const S = {
    tap:    () => tone(880, 0, .06, "triangle", .08),
    pop:    () => { tone(520, 0, .09, "sine", .2, 1100); },
    coin:   () => { tone(988, 0, .08, "square", .07); tone(1319, .07, .22, "square", .07); },
    ok:     () => { tone(523, 0, .12, "sine", .16); tone(659, .09, .12, "sine", .16); tone(784, .18, .25, "sine", .18); },
    bad:    () => { tone(330, 0, .16, "triangle", .16); tone(247, .14, .28, "triangle", .16); },
    gift:   () => { noise(0, .25, .08, 1500); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .15 + i * .08, .3, "triangle", .14)); },
    fanfare:() => { [392, 523, 659, 784].forEach((f, i) => tone(f, i * .12, .22, "square", .06)); tone(1047, .5, .6, "square", .07); tone(523, .5, .6, "triangle", .12); },
    whoosh: () => noise(0, .3, .06, 400),
    eat:    () => { [0, .12, .24].forEach(t => tone(220 + Math.random() * 60, t, .07, "square", .06)); },
    moo:    () => { tone(140, 0, .6, "sawtooth", .07, 110); },
  };
  const api = {
    get muted(){ return store.get("mute", false); },
    toggle(){ store.set("mute", !api.muted); if(!api.muted) api.play("pop"); bus.emit("mute", {muted: api.muted}); },
    play(n){ if(api.muted || !S[n]) return; try{ S[n](); }catch(e){} },
    /* nota i de una escala pentatónica (cada moneda de M.coins un poco más aguda), en el mismo AudioContext */
    note(i = 0){ if(api.muted) return; try{ if(navigator.userActivation && !navigator.userActivation.hasBeenActive) return; tone(1046.5 * Math.pow(2, STEP[Math.abs(i | 0) % STEP.length] / 12), .005, .17, "triangle", .07); }catch(e){} },
  };
  /* desbloquear el audio en el primer toque (móviles), sin sonar: al soltar el dedo, en el clic o con una tecla, que es
     cuando el navegador lo permite (al apoyar el dedo todavía no) */
  const unlock = () => { if(!api.muted) ac(); if(ctx && ctx.state === "running") ["pointerup", "click", "keydown"].forEach(t => removeEventListener(t, unlock, true)); };
  ["pointerup", "click", "keydown"].forEach(t => addEventListener(t, unlock, true));
  return api;
})();

/* Antes cada premio tiraba confeti de pantalla completa. Ahora solo lo hace el fin de lección (M.confetti); quien
   llame a confetti() (juegos, álbum, granja) recibe unas chispas en el punto que indique, o en el centro */
function confetti(o = {}){
  try{
    if(!window.M || typeof M.burst !== "function") return;
    const x = isFinite(o.x) ? o.x : innerWidth / 2, y = isFinite(o.y) ? o.y : innerHeight * .35;
    M.burst(x, y, {n: Math.max(8, Math.min(18, Math.round((o.n || 60) / 6)))});
  }catch(e){}
}
const sparkAt = sel => { try{ const el = document.querySelector(sel); if(el && el.getClientRects().length && window.M) M.burst(el, {n: 14}); }catch(e){} };

/* sonidos ligados a lo que pasa en la app */
bus.on("answer", d => { if(d && d.ok && d.where !== "game") sfx.play("ok"); });   /* solo al acertar; al fallar, nada. Los minijuegos ponen el suyo */
/* si las monedas vuelan (M.coins), cada una ya suena con sfx.note: aquí no se repite el sonido */
bus.on("coins", d => { if(d && d.n > 0 && !d.quiet && !d.fly) sfx.play("coin"); });
bus.on("gift-open", () => { sfx.play("gift"); sparkAt("#gbox"); });
bus.on("medal", () => { sfx.play("fanfare"); });
bus.on("lesson-done", () => { sfx.play("fanfare"); try{ if(window.M) M.confetti({n: 60}); }catch(e){} });
bus.on("buy", () => { sfx.play("coin"); });
bus.on("review-done", () => { sfx.play("fanfare"); });
