/* IELTS Prep: the Task 1 visuals (window.IE.viz.html(visual) → HTML), drawn as SVG from the data of the lesson:
   line, bar (grouped), pie (one to three), table, process (a flow of steps) and map (one or two plans on a 0-100 grid).
   Colours come from the CSS classes ie-s0…ie-s5 (blue, navy, teal, grey, green, gold), so they follow light and dark.
   Every chart also has «Show the data» as a table, for screen readers and small screens. */
(() => {
"use strict";
const IE = window.IE; if(!IE) return;
const esc = IE.esc;
const fmt = n => (Math.abs(n) >= 1000 ? n.toLocaleString("en-GB") : String(Math.round(n * 100) / 100));
function niceMax(v){
  if(v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
const unitOf = v => v.unit ? (v.unit === "%" ? "%" : " " + v.unit) : "";
const legend = names => `<ul class="ie-leg">${names.map((n, i) => `<li><span class="ie-sw ie-s${i % 6}"></span>${esc(n)}</li>`).join("")}</ul>`;
const dataTable = (head, rows) => `<details class="ie-vdata"><summary>Show the data</summary><div class="ie-tw"><table class="ie-table"><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;

function axes(v, W, H, M, max, ticks){
  let g = "";
  for(let i = 0; i <= ticks; i++){
    const y = M.t + (H - M.t - M.b) * (1 - i / ticks), val = max * i / ticks;
    g += `<line class="ie-grid" x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}"/><text class="ie-tick" x="${M.l - 8}" y="${y + 4}" text-anchor="end">${fmt(val)}${v.unit === "%" ? "%" : ""}</text>`;
  }
  return g;
}
function line(v){
  const W = 640, H = 340, M = {l: 74, r: 18, t: 16, b: 52}, n = v.x.length;
  const max = niceMax(Math.max(...v.series.flatMap(s => s.values))), ticks = 5;
  const X = i => M.l + (W - M.l - M.r) * (n === 1 ? .5 : i / (n - 1)), Y = val => M.t + (H - M.t - M.b) * (1 - val / max);
  const step = Math.ceil(n / 6);
  let g = axes(v, W, H, M, max, ticks);
  g += v.x.map((x, i) => i % step ? "" : `<text class="ie-tick" x="${X(i)}" y="${H - M.b + 30}" text-anchor="middle">${esc(x)}</text>`).join("");
  g += v.series.map((s, k) => `<g class="ie-s${k % 6}"><polyline class="ie-ln" points="${s.values.map((val, i) => `${X(i)},${Y(val)}`).join(" ")}"/>
    ${s.values.map((val, i) => `<circle class="ie-pt" cx="${X(i)}" cy="${Y(val)}" r="${k % 2 ? 4.5 : 4}"/>`).join("")}</g>`).join("");
  return chart(v, W, H, g, v.series.map(s => s.name), ["", ...v.x], v.series.map(s => [s.name, ...s.values.map(x => fmt(x) + unitOf(v))]));
}
function bar(v){
  const W = 640, H = 340, M = {l: 74, r: 18, t: 16, b: 52}, n = v.x.length, k = v.series.length;
  const max = niceMax(Math.max(...v.series.flatMap(s => s.values))), ticks = 5;
  const gw = (W - M.l - M.r) / n, bw = Math.min(34, gw * .8 / k), Y = val => M.t + (H - M.t - M.b) * (1 - val / max);
  let g = axes(v, W, H, M, max, ticks);
  g += v.x.map((x, i) => `<text class="ie-tick" x="${M.l + gw * (i + .5)}" y="${H - M.b + 30}" text-anchor="middle">${esc(x)}</text>`).join("");
  g += v.series.map((s, j) => `<g class="ie-s${j % 6}">${s.values.map((val, i) => {
    const x = M.l + gw * (i + .5) - bw * k / 2 + bw * j, y = Y(val);
    return `<rect class="ie-bar" x="${x + 1}" y="${y}" width="${bw - 2}" height="${Math.max(0, H - M.b - y)}" rx="3"/>`; }).join("")}</g>`).join("");
  return chart(v, W, H, g, v.series.map(s => s.name), ["", ...v.x], v.series.map(s => [s.name, ...s.values.map(x => fmt(x) + unitOf(v))]));
}
const chart = (v, W, H, g, names, head, rows) => `<figcaption class="t-head">${esc(v.title)}</figcaption>
  <svg class="ie-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.title)}"><line class="ie-axis" x1="74" x2="${W - 18}" y1="${H - 52}" y2="${H - 52}"/>${g}</svg>
  ${names.length > 1 || v.unit ? legend(names) : ""}${v.unit && v.unit !== "%" ? `<p class="t-min">Figures in ${esc(v.unit)}.</p>` : ""}${dataTable(head, rows)}`;
function pie(v){
  const one = c => {
    const tot = c.slices.reduce((s, x) => s + x.value, 0) || 1; let a0 = -Math.PI / 2;
    const paths = c.slices.map((s, i) => {
      const a1 = a0 + s.value / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
      const p = c.slices.length === 1 ? `<circle cx="100" cy="100" r="90"/>` : `<path d="M100,100 L${100 + 90 * Math.cos(a0)},${100 + 90 * Math.sin(a0)} A90,90 0 ${big} 1 ${100 + 90 * Math.cos(a1)},${100 + 90 * Math.sin(a1)} Z"/>`;
      const mid = (a0 + a1) / 2, pct = Math.round(s.value / tot * 100); a0 = a1;
      return `<g class="ie-s${i % 6} ie-slice">${p}${pct >= 6 ? `<text class="ie-pctl" x="${100 + 58 * Math.cos(mid)}" y="${104 + 58 * Math.sin(mid)}" text-anchor="middle">${pct}%</text>` : ""}</g>`;
    }).join("");
    return `<div class="ie-pie"><svg viewBox="0 0 200 200" role="img" aria-label="${esc(c.title)}">${paths}</svg><p class="t-note">${esc(c.title)}</p></div>`;
  };
  const labels = [...new Set(v.charts.flatMap(c => c.slices.map(s => s.label)))];
  /* the same label keeps the same colour in every pie */
  const charts = v.charts.map(c => Object.assign({}, c, {slices: labels.map(l => c.slices.find(s => s.label === l) || {label: l, value: 0})}));
  return `<figcaption class="t-head">${esc(v.title)}</figcaption><div class="ie-pies">${charts.map(one).join("")}</div>${legend(labels)}
    ${dataTable(["", ...v.charts.map(c => c.title)], labels.map(l => [l, ...v.charts.map(c => { const s = c.slices.find(x => x.label === l); return s ? fmt(s.value) + (v.unit === "%" || !v.unit ? "%" : unitOf(v)) : "–"; })]))}`;
}
const table = v => `<figcaption class="t-head">${esc(v.title)}</figcaption><div class="ie-tw"><table class="ie-table"><thead><tr>${v.head.map(h => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${v.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const process = v => `<figcaption class="t-head">${esc(v.title)}</figcaption><ol class="ie-proc${v.cycle ? " is-cycle" : ""}">${v.steps.map((s, i) => `<li><span class="ie-pn t-num">${i + 1}</span><span><b>${esc(s.label)}</b>${s.note ? `<small>${esc(s.note)}</small>` : ""}</span></li>`).join("")}</ol>
  ${v.cycle ? `<p class="t-note ie-cyc">↻ The cycle then begins again at stage 1.</p>` : ""}`;
function wrapLabel(t, w){
  const max = Math.max(5, Math.floor(w / 2.4)), out = []; let cur = "";
  for(const word of String(t).split(/\s+/)){ if((cur + " " + word).trim().length > max && cur){ out.push(cur); cur = word; } else cur = (cur + " " + word).trim(); }
  if(cur) out.push(cur);
  return out.slice(0, 3);
}
function map(v){
  const one = m => `<div class="ie-map"><svg viewBox="-1 -1 102 102" role="img" aria-label="${esc(m.title)}"><rect class="ie-land" x="-1" y="-1" width="102" height="102" rx="2"/>
    ${m.items.map(z => { const sh = z.shape || "rect", cx = z.x + z.w / 2, cy = z.y + z.h / 2, lines = wrapLabel(z.label, Math.max(z.w, 14));
      const body = sh === "circle" ? `<ellipse class="ie-m-${sh}" cx="${cx}" cy="${cy}" rx="${z.w / 2}" ry="${z.h / 2}"/>` : `<rect class="ie-m-${sh}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="${sh === "road" ? 0 : 1.2}"/>`;
      const vert = sh === "road" && z.h > z.w * 1.5, ls = vert ? [z.label] : lines;
      return `<g>${body}<g${vert ? ` transform="rotate(-90 ${cx} ${cy})"` : ""}>${ls.map((l, i) => `<text class="ie-mlab${sh === "road" || sh === "water" ? " is-on-dark" : ""}" x="${cx}" y="${cy + 1.2 + (i - (ls.length - 1) / 2) * 4}" text-anchor="middle">${esc(l)}</text>`).join("")}</g></g>`; }).join("")}</svg>
    <p class="t-note">${esc(m.title)}</p></div>`;
  return `<figcaption class="t-head">${esc(v.title)}</figcaption><div class="ie-maps">${v.maps.map(one).join("")}</div>`;
}
const KIND = {line, bar, pie, table, process, map};
IE.viz = {html: v => { try{ return (KIND[v && v.kind] || (() => ""))(v); }catch(e){ console.error(e); return `<p class="t-sub">This chart can't be drawn.</p>`; } }};
})();
