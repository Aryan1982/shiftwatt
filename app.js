(() => {
"use strict";
const { SLOTS_PER_H, NOW_IDX, SOURCES, REGIONS, DEVICES, CAMPUS, EQUIV, LIVE, buildSlots, buildHistory, demoNow, setClock, fetchLiveSlots } = window.SW;

/* ============================== helpers ============================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const P = {
  today: "M12 14l4-4|M3.34 19a10 10 0 1 1 17.32 0",
  plan: "M8 2v4|M16 2v4|M3 10h18|R3 4 18 18 2",
  devices: "M12 22v-5|M9 8V2|M15 8V2|M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z",
  impact: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z|M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12",
  campus: "M3 21h18|M5 21V9l7-5 7 5v12|M10 21v-5h4v5",
  car: "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2|C7 17 2|M9 17h6|C17 17 2",
  dish: "R4 3 16 18 2|M4 8h16|C12 14.5 3.5|M8 5.5h.01|M11 5.5h.01",
  wash: "R3 2 18 20 3|M3 7h18|C12 14 5|M7 4.5h.01",
  dry: "R3 2 18 20 3|M3 7h18|C12 14 5|M7 4.5h.01|M10 12.5c.8.8.8 2.2 0 3|M14 12.5c.8.8.8 2.2 0 3",
  water: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  bike: "C5.5 17.5 3.5|C18.5 17.5 3.5|M15 6h.01|M12 17.5V14l-3-3 4-3 2 3h2",
  pump: "C12 12 8|M12 4v3|M12 17v3|M4 12h3|M17 12h3|C12 12 2",
  fan: "C12 12 2|M12 10c0-4 1-7 4-7 2 0 3 2 2 4l-4 3|M14 12c4 0 7 1 7 4 0 2-2 3-4 2l-3-4|M12 14c0 4-1 7-4 7-2 0-3-2-2-4l4-3|M10 12c-4 0-7-1-7-4 0-2 2-3 4-2l3 4",
  plus: "M12 5v14|M5 12h14",
  sun: "C12 12 4|M12 2v2|M12 20v2|M4.93 4.93l1.41 1.41|M17.66 17.66l1.41 1.41|M2 12h2|M20 12h2|M6.34 17.66l-1.41 1.41|M19.07 4.93l-1.41 1.41",
  check: "M20 6 9 17l-5-5",
  arrow: "M5 12h14|M13 6l6 6-6 6",
  settings: "M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6",
  method: "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z|M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9|M10.3 21a1.94 1.94 0 0 0 3.4 0",
  home: "M3 10.5 12 3l9 7.5|M5 9v12h14V9",
  chevron: "M8 10l4 4 4-4",
  download: "M12 3v12|M7 10l5 5 5-5|M5 21h14",
  x: "M18 6 6 18|M6 6l12 12",
  pulse: "M22 12h-4l-3 9L9 3l-3 9H2",
  refresh: "M21 12a9 9 0 1 1-2.64-6.36L21 8|M21 3v5h-5",
  external: "M15 3h6v6|M10 14 21 3|M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
};
function icon(name) {
  const parts = (P[name] || "").split("|").map((d) => {
    if (d[0] === "C") { const [cx, cy, r] = d.slice(1).split(" "); return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`; }
    if (d[0] === "R") { const [x, y, w, h, rx] = d.slice(1).split(" "); return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`; }
    return `<path d="${d}"/>`;
  }).join("");
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts}</svg>`;
}

const STOPS = [[0, [91, 227, 160]], [0.45, [200, 230, 107]], [0.7, [242, 184, 75]], [1, [255, 122, 89]]];
function tone(t) {
  t = clamp(t, 0, 1);
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i];
    if (t <= b) {
      const [a, ca] = STOPS[i - 1];
      const k = (t - a) / (b - a);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(",")})`;
    }
  }
  return "rgb(255,122,89)";
}

const fmtTime = (t) => t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtHour = (t) => t.toLocaleTimeString([], { hour: "numeric" });
const fmtDate = (t) => t.toLocaleDateString([], { month: "short", day: "numeric" });
function dayDiff(t) {
  const a = demoNow(); a.setHours(0, 0, 0, 0);
  const b = new Date(t); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400e3);
}
function when(t) {
  const d = dayDiff(t);
  const day = d === 0 ? "Today" : d === 1 ? "Tomorrow" : t.toLocaleDateString([], { weekday: "long" });
  return `${day} ${fmtTime(t)}`;
}
function relWhen(t) {
  const d = dayDiff(t), h = t.getHours();
  if (d === 0) return `${h >= 17 ? "tonight" : "today"} at ${fmtTime(t)}`;
  if (d === 1 && h < 5) return `tonight at ${fmtTime(t)}`;
  if (d === 1) return `tomorrow at ${fmtTime(t)}`;
  return `${t.toLocaleDateString([], { weekday: "long" })} at ${fmtTime(t)}`;
}
const kg = (v) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(v < 10 ? 2 : 1));
const money = (v) => `${region().currency}${Math.max(0, v).toFixed(2)}`;

/* ============================== state ============================== */
const store = {
  region: localStorage.getItem("sw_region") || "caiso",
  slots: [],
  nowIdx: NOW_IDX,
  devices: DEVICES.map((d) => ({ ...d })),
  runs: {},
  history: buildHistory(),
  planDev: "ev",
  planMode: "carbon",
  scale: 2400,
  booked: false,
  reminded: false,
  period: 60,
  homeName: "Aryan's home",
  prefs: { cleanAlerts: true, runAlerts: true, weekly: true, signal: "average" },
  tesla: false,
  notifs: [],
  grid: null,
  gridErr: null,
  gridLoading: false,
};
const region = () => REGIONS[store.region];
const dev = (id) => store.devices.find((d) => d.id === id);
const slotAt = (i) => store.slots[clamp(Math.round(i), 0, store.slots.length - 1)];

const horizonH = () => (store.slots.length - NOW_IDX) / SLOTS_PER_H;

async function loadRegion() {
  store.source = "model";
  store.live = null;
  setClock(null);
  let slots = null;
  if (LIVE[store.region]) {
    try {
      const live = await fetchLiveSlots(store.region);
      store.live = live;
      slots = live.slots;
      setClock(live.now);
      store.source = "live";
    } catch (err) {
      console.warn("Live forecast unavailable, using modeled data:", err);
      store.source = "fallback";
    }
  }
  store.slots = slots || buildSlots(store.region);
  store.nowIdx = NOW_IDX;
  store.runs = {};
  for (const id of ["ev", "dish", "water"]) {
    const d = dev(id);
    if (d) schedule(id, optimize(d, clamp(d.readyBy, minReadyBy(d), horizonH())), true);
  }
}

function sourceText() {
  if (store.source === "live") return `Live forecast · ${store.live.source} · ${store.live.area}`;
  if (store.source === "fallback") return "Live forecast unavailable · showing modeled data";
  return "Modeled from typical generation mix · demo data";
}
function sourceBadge() {
  return store.source === "live" ? `<span class="src live"><span class="live-dot"></span>Live</span>` : `<span class="src">Modeled</span>`;
}

/* ---------- persistence ---------- */
const STATE_KEY = "sw_state";
function save() {
  if (!store.slots.length) return;
  const state = {
    v: 1,
    region: store.region, homeName: store.homeName, prefs: store.prefs, tesla: store.tesla,
    period: store.period, planMode: store.planMode, scale: store.scale, booked: store.booked, reminded: store.reminded,
    devices: store.devices,
    extraHistory: store.history.filter((h) => h.extra).map((h) => ({ ...h, at: h.at.toISOString() })),
    notifs: store.notifs.map((n) => ({ ...n, t: n.t.toISOString() })),
    runs: store.runs, nowIdx: store.nowIdx, base: store.slots[0].t.toISOString(),
  };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* storage full or blocked: keep running in memory */ }
}
function readState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    return s && s.v === 1 ? s : null;
  } catch { return null; }
}
function applySettings(s) {
  if (REGIONS[s.region]) store.region = s.region;
  Object.assign(store, { homeName: s.homeName, prefs: { ...store.prefs, ...s.prefs }, tesla: s.tesla, period: s.period, planMode: s.planMode, scale: s.scale, booked: s.booked, reminded: s.reminded });
  if (Array.isArray(s.devices) && s.devices.length) store.devices = s.devices;
  if (!dev(store.planDev)) store.planDev = store.devices[0]?.id;
  store.history.push(...(s.extraHistory || []).map((h) => ({ ...h, at: new Date(h.at) })));
  store.notifs = (s.notifs || []).map((n) => ({ ...n, t: new Date(n.t) }));
}
function applyRuns(s) {
  if (s.base !== store.slots[0].t.toISOString()) return;
  store.runs = s.runs || {};
  store.nowIdx = clamp(s.nowIdx ?? NOW_IDX, 0, store.slots.length - 1);
}
function showLoading() {
  $("#view").innerHTML = `<section class="card loading"><span class="spinner"></span><span>Loading the grid forecast…</span></section>`;
}

function level(I) {
  const f = store.slots.slice(NOW_IDX).map((s) => s.I);
  const min = Math.min(...f), max = Math.max(...f);
  return (I - min) / (max - min || 1);
}
function classify(I) {
  const t = level(I);
  let label = t < 0.33 ? "Clean" : t < 0.66 ? "Moderate" : "Dirty";
  if (I < 100 && label === "Dirty") label = "Moderate";
  if (I < 60) label = "Clean";
  const band = { Clean: [0, 0.3], Moderate: [0.4, 0.62], Dirty: [0.66, 1] }[label];
  return { t, color: tone(clamp(t, band[0], band[1])), label };
}
const cleanShare = (s) => sum(Object.entries(s.mix).filter(([k]) => SOURCES[k].clean).map(([, v]) => v));

/* ============================== optimizer ============================== */
function windowStats(a, b) {
  const w = store.slots.slice(a, b);
  return {
    I: sum(w.map((s) => s.I)) / w.length,
    M: sum(w.map((s) => s.marginal)) / w.length,
    price: sum(w.map((s) => s.price)) / w.length,
    clean: sum(w.map(cleanShare)) / w.length,
  };
}
function bestWindow(from, to, len, mode = "carbon", allow = null) {
  let best = null;
  for (let s = from; s + len <= to; s++) {
    if (allow && !allow(s, s + len)) continue;
    const st = windowStats(s, s + len);
    const score = mode === "cost" ? st.price + st.I * 1e-6 : st.I + st.price * 1e-3;
    if (!best || score < best.score - 1e-9) best = { s, e: s + len, score, ...st };
  }
  return best;
}
function minReadyBy(d) {
  return Math.ceil(((store.nowIdx - NOW_IDX) / SLOTS_PER_H + d.hours) * 2) / 2;
}
function optimize(d, readyBy, mode = "carbon") {
  const len = Math.round(d.hours * SLOTS_PER_H);
  const kWh = d.kW * d.hours;
  const from = store.nowIdx;
  const to = Math.max(from + len, Math.min(store.slots.length, NOW_IDX + Math.round(readyBy * SLOTS_PER_H)));
  const base = windowStats(from, from + len);
  const quiet = d.quiet ? (a, b) => store.slots.slice(a, b).every((x) => { const h = x.t.getHours(); return h >= 7 && h < 22; }) : null;
  const best = (quiet && bestWindow(from, to, len, mode, quiet)) || bestWindow(from, to, len, mode);
  return {
    device: d.id, readyBy, kWh, mode,
    startIdx: best.s, endIdx: best.e,
    I: best.I, baseI: base.I, clean: best.clean,
    kgNow: (kWh * base.I) / 1000, kgBest: (kWh * best.I) / 1000,
    saveKg: (kWh * (base.I - best.I)) / 1000,
    saveKgMarginal: (kWh * (base.M - best.M)) / 1000,
    saveCost: kWh * (base.price - best.price),
    pct: base.I ? 1 - best.I / base.I : 0,
  };
}
/* Suggest a later deadline only when it clearly pays off on the chosen goal. */
function flexTip(d, current, mode) {
  const gain = (r) => (mode === "cost" ? r.saveCost : r.saveKg);
  let pick = null;
  for (let h = d.readyBy + 1; h <= Math.min(horizonH(), d.readyBy + 24); h += 0.5) {
    const r = optimize(d, h, mode);
    if (gain(r) > gain(current) * 1.5 + 0.1 && (!pick || gain(r) > gain(pick.r) * 1.1)) pick = { h, r, x: gain(r) / Math.max(gain(current), 0.01) };
  }
  return pick;
}

function schedule(id, res, silent) {
  const run = { ...res, status: res.startIdx <= store.nowIdx ? "running" : "scheduled" };
  store.runs[id] = run;
  if (!silent) {
    const d = dev(id);
    toast(run.status === "running" ? `${d.name} started` : `${d.name} scheduled`,
      run.status === "running" ? "Now is already the cleanest time." : `Runs ${relWhen(slotAt(run.startIdx).t)}. Saves ${kg(res.saveKg)} kg CO₂.`);
  }
}

/* ============================== charts ============================== */
let charts = [];
function chart(el, draw) { charts.push({ el, draw }); draw(el); }
function redrawCharts() { charts = charts.filter((c) => c.el.isConnected); charts.forEach((c) => c.draw(c.el)); }
let rz;
addEventListener("resize", () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(redrawCharts); });

function surplusRuns() {
  const out = []; let a = -1;
  store.slots.forEach((s, i) => {
    if (s.surplus && a < 0) a = i;
    if (!s.surplus && a >= 0) { out.push([a, i]); a = -1; }
  });
  if (a >= 0) out.push([a, store.slots.length]);
  return out;
}

function forecast(el, o = {}) {
  const slots = store.slots, n = slots.length;
  const W = Math.max(280, el.clientWidth), H = o.height || 180;
  const pad = { l: 34, r: 6, t: o.windows?.some((w) => w.label) ? 22 : 8, b: 24 };
  const vals = slots.map((s) => s.I);
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  const tickStep = vmax > 300 ? 100 : vmax > 140 ? 50 : 25;
  const top = Math.ceil((vmax * 1.1) / tickStep) * tickStep;
  const iw = W - pad.l - pad.r;
  const X = (i) => pad.l + (i * iw) / (n - 1);
  const rowEnds = [];
  const placed = (o.windows || []).map((w) => {
    const x = X(w.s), wd = Math.max(3, X(Math.min(w.e, n - 1)) - x);
    const lw = (w.label || "").length * 6.6 + 10, mid = x + wd / 2;
    let row = rowEnds.findIndex((end) => mid - lw / 2 > end);
    if (row < 0) { row = rowEnds.length; rowEnds.push(0); }
    rowEnds[row] = mid + lw / 2;
    return { ...w, x, wd, row };
  });
  pad.t += 14 * Math.max(0, rowEnds.length - 1);
  const ih = H - pad.t - pad.b;
  const Y = (v) => pad.t + (1 - v / top) * ih;
  const c = (i) => tone((vals[i] - vmin) / (vmax - vmin || 1));
  const uid = o.id || "fc";
  const now = store.nowIdx;

  let line = `M${X(0).toFixed(1)},${Y(vals[0]).toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    const x0 = X(i - 1), y0 = Y(vals[i - 1]), x1 = X(i), y1 = Y(vals[i]), mx = (x0 + x1) / 2;
    line += `C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const stops = slots.map((_, i) => (i % 2 ? "" : `<stop offset="${(i / (n - 1)).toFixed(4)}" stop-color="${c(i)}"/>`)).join("");
  const yTicks = Array.from({ length: Math.round(top / tickStep) - 1 }, (_, k) => (k + 1) * tickStep).filter((_, k, a) => a.length <= 4 || k % 2 === 1).map((v) =>
    `<line class="gridline" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join("");
  const step = W < 560 ? 12 : 6;
  const xTicks = slots.map((s, i) => {
    if (s.t.getMinutes() || s.t.getHours() % step) return "";
    const label = s.t.getHours() === 0 ? s.t.toLocaleDateString([], { weekday: "short" }) : fmtHour(s.t);
    return `<text class="axis" x="${X(i)}" y="${H - 6}" text-anchor="middle">${label}</text>`;
  }).join("");
  const surplus = surplusRuns().map(([a, b]) => `<rect x="${X(a)}" y="${pad.t}" width="${X(Math.min(b, n - 1)) - X(a)}" height="${ih}" fill="url(#st-${uid})"/>`).join("");
  const wins = placed.map((w) => {
    return `<rect x="${w.x}" y="${pad.t}" width="${w.wd}" height="${ih}" rx="4" fill="#5be3a0" opacity=".12"/>
      ${w.label ? `<text x="${w.x + w.wd / 2}" y="${pad.t - 8 - w.row * 14}" text-anchor="middle" class="win-label" fill="#5be3a0">${w.label}</text>` : ""}`;
  }).join("");
  const xn = X(now);

  el.innerHTML = `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carbon intensity forecast">
    <defs>
      <linearGradient id="lg-${uid}" gradientUnits="userSpaceOnUse" x1="${pad.l}" x2="${W - pad.r}" y1="0" y2="0">${stops}</linearGradient>
      <linearGradient id="fd-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="m-${uid}"><rect width="${W}" height="${H}" fill="url(#fd-${uid})"/></mask>
      <pattern id="st-${uid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="#F7D154" opacity=".12"/></pattern>
    </defs>
    ${yTicks}${surplus}${wins}
    <path d="${line}L${X(n - 1)},${Y(0)}L${X(0)},${Y(0)}Z" fill="url(#lg-${uid})" mask="url(#m-${uid})"/>
    <path d="${line}" fill="none" stroke="url(#lg-${uid})" stroke-width="2"/>
    <rect x="${pad.l}" y="${pad.t}" width="${Math.max(0, xn - pad.l)}" height="${ih}" style="fill:var(--surface)" opacity=".6"/>
    <line class="now-line" x1="${xn}" x2="${xn}" y1="${pad.t}" y2="${H - pad.b}"/>
    <circle cx="${xn}" cy="${Y(vals[now])}" r="4" fill="${c(now)}" stroke="var(--surface)" stroke-width="2"/>
    ${xTicks}
    <line class="cross" y1="${pad.t}" y2="${H - pad.b}"/>
    <circle class="hover-dot" r="4" stroke="var(--surface)" stroke-width="2"/>
  </svg>
  <div class="tooltip"></div>`;

  const cross = $(".cross", el), dot = $(".hover-dot", el), tip = $(".tooltip", el);
  el.onpointermove = (e) => {
    const x = e.clientX - el.getBoundingClientRect().left;
    const i = clamp(Math.round(((x - pad.l) / iw) * (n - 1)), 0, n - 1);
    cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i));
    dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(vals[i])); dot.setAttribute("fill", c(i));
    tip.innerHTML = `<div class="t">${when(slots[i].t)}</div><b style="color:${c(i)}">${vals[i]} g</b> · ${Math.round(cleanShare(slots[i]) * 100)}% clean`;
    const tw = tip.offsetWidth;
    tip.style.transform = `translate(${clamp(x > W * 0.6 ? x - tw - 12 : x + 12, 0, W - tw)}px, ${pad.t}px)`;
  };
}

function areaChart(el, values) {
  const W = Math.max(260, el.clientWidth), H = 150, pad = { l: 4, r: 4, t: 10, b: 22 };
  const n = values.length, top = Math.max(...values.map((v) => v.y)) * 1.1 || 1;
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const X = (i) => pad.l + (i * iw) / (n - 1), Y = (v) => pad.t + (1 - v / top) * ih;
  const line = values.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v.y).toFixed(1)}`).join("");
  const xl = [0, Math.floor(n / 2), n - 1].map((i, k) => `<text class="axis" x="${X(i)}" y="${H - 4}" text-anchor="${["start", "middle", "end"][k]}">${values[i].label}</text>`).join("");
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="ac" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5be3a0" stop-opacity=".28"/><stop offset="1" stop-color="#5be3a0" stop-opacity="0"/></linearGradient></defs>
    <path d="${line}L${X(n - 1)},${Y(0)}L${X(0)},${Y(0)}Z" fill="url(#ac)"/>
    <path d="${line}" fill="none" stroke="#5be3a0" stroke-width="2"/>${xl}
    <line class="cross" y1="${pad.t}" y2="${H - pad.b}"/><circle class="hover-dot" r="4" fill="#5be3a0" stroke="var(--surface)" stroke-width="2"/>
  </svg><div class="tooltip"></div>`;
  const cross = $(".cross", el), dot = $(".hover-dot", el), tip = $(".tooltip", el);
  el.onpointermove = (e) => {
    const x = e.clientX - el.getBoundingClientRect().left;
    const i = clamp(Math.round(((x - pad.l) / iw) * (n - 1)), 0, n - 1);
    cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i));
    dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(values[i].y));
    tip.innerHTML = `<div class="t">${values[i].label}</div><b class="clean">${values[i].y.toFixed(1)} kg</b> total`;
    const tw = tip.offsetWidth;
    tip.style.transform = `translate(${clamp(x > W * 0.6 ? x - tw - 12 : x + 12, 0, W - tw)}px, 0px)`;
  };
}

function countUp(el, to, fmt, ms = 900) {
  if (reduceMotion) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = clamp((t - t0) / ms, 0, 1);
    el.textContent = fmt(to * (1 - Math.pow(1 - p, 4)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ============================== toast & modal ============================== */
function toast(title, body, action) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<b>${title}</b><span>${body}</span>${action ? `<div><button class="btn" type="button">${action.label}</button></div>` : ""}`;
  $("#toasts").append(el);
  const close = () => { el.classList.add("leaving"); setTimeout(() => el.remove(), 200); };
  if (action) $("button", el).onclick = () => { action.fn(); close(); };
  let timer = setTimeout(close, 4200);
  el.onmouseenter = () => clearTimeout(timer);
  el.onmouseleave = () => { timer = setTimeout(close, 1800); };
  while ($("#toasts").children.length > 2) $("#toasts").firstElementChild.remove();
}

function modal(html, onMount, cls = "") {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-wrap"><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  const wrap = root.firstElementChild;
  const esc = (e) => e.key === "Escape" && close();
  const close = () => { wrap.classList.add("leaving"); setTimeout(() => (root.innerHTML = ""), 160); document.removeEventListener("keydown", esc); };
  document.addEventListener("keydown", esc);
  wrap.addEventListener("pointerdown", (e) => e.target === wrap && close());
  onMount?.(wrap.firstElementChild, close);
  return close;
}

/* ============================== shell ============================== */
const ROUTES = {
  today: { title: "Today", icon: "today", sub: () => `${demoNow().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · ${region().place}` },
  plan: { title: "Plan a run", nav: "Plan", icon: "plan", sub: () => "Pick a deadline. ShiftWatt finds the cleanest hours before it." },
  devices: { title: "Devices", icon: "devices", sub: () => `${store.devices.length} connected · ${Object.keys(store.runs).length} scheduled` },
  impact: { title: "Impact", icon: "impact", sub: () => "Measured against running each load the moment it was ready" },
  campus: { title: "Campus", icon: "campus", sub: () => `${CAMPUS.school} · ${CAMPUS.myHall} · illustrative data` },
  live: { title: "Live grid", icon: "pulse", sub: () => "Real-time data from the NESO Carbon Intensity API · Great Britain" },
  settings: { title: "Settings", icon: "settings", foot: true, sub: () => "Home, notifications, data and integrations" },
  method: { title: "How it works", icon: "method", foot: true, sub: () => "How ShiftWatt calculates every number" },
};
const ACTIONS = {
  devices: () => `<button class="btn primary" id="act-add" type="button">${icon("plus")}Add device</button>`,
  impact: () => `<div class="seg" id="period">${[7, 30, 60].map((p) => `<button type="button" data-p="${p}" aria-pressed="${store.period === p}">${p}D</button>`).join("")}</div>
    <button class="btn" id="act-export" type="button">${icon("download")}Export</button>`,
  live: () => `<span class="small muted mono" id="grid-at">${store.grid ? `Fetched ${store.grid.at.toLocaleTimeString()}` : ""}</span>
    <button class="btn" id="act-refresh" type="button" ${store.gridLoading ? "disabled" : ""}>${icon("refresh")}${store.gridLoading ? "Refreshing…" : "Refresh"}</button>`,
};
const route = () => { const r = location.hash.replace("#/", ""); return ROUTES[r] ? r : "today"; };

function renderNav() {
  const r = route();
  const count = Object.keys(store.runs).length;
  const link = ([k, v]) => `<a href="#/${k}" ${k === r ? 'aria-current="page"' : ""}>${icon(v.icon)}<span>${v.nav || v.title}</span>${k === "devices" && count ? `<span class="count mono">${count}</span>` : ""}</a>`;
  const entries = Object.entries(ROUTES);
  $("#nav").innerHTML = entries.filter(([, v]) => !v.foot).map(link).join("");
  $("#nav-foot").innerHTML = entries.filter(([, v]) => v.foot).map(link).join("");
  $("#tabbar").innerHTML = entries.filter(([k]) => k !== "method").map(link).join("");
  $("#home-switch").innerHTML = `<span class="home-ico">${icon("home")}</span><span class="home-text"><span class="home-name">${store.homeName}</span><span class="home-sub">${region().place} · ${region().grid}</span></span>${icon("chevron")}`;
}

function renderLive() {
  const s = store.slots[store.nowIdx], c = classify(s.I);
  const pill = $("#live-pill");
  pill.innerHTML = `<span class="live-dot" style="color:${c.color}"></span><b class="mono">${s.I}</b><span class="muted small">g/kWh</span>`;
  pill.title = `${region().grid} grid · ${c.label} · ${sourceText()} · ${fmtTime(s.t)}`;
  $("#demo-clock").textContent = when(s.t);
  renderBell();
}

function renderBell() {
  const unread = store.notifs.filter((n) => n.unread).length;
  $("#bell").innerHTML = icon("bell") + (unread ? `<span class="badge mono">${unread}</span>` : "");
  save();
}
function renderInbox() {
  $("#inbox").innerHTML = `
    <div class="pop-head"><b>Notifications</b><button class="linkish" id="mark-read" type="button">Mark all read</button></div>
    <div class="pop-list">${store.notifs.length
      ? store.notifs.slice(0, 8).map((n) => `<div class="notif ${n.unread ? "unread" : ""}"><span class="notif-dot"></span><div><div class="notif-title">${n.title}</div><div class="notif-body">${n.body}</div><div class="notif-time mono">${when(n.t)}</div></div></div>`).join("")
      : `<p class="empty" style="padding:16px">You're all caught up.</p>`}</div>`;
  $("#mark-read").onclick = () => { store.notifs.forEach((n) => (n.unread = false)); renderInbox(); renderBell(); };
}
function toggleInbox(open) {
  const box = $("#inbox"), btn = $("#bell");
  open = open ?? box.hidden;
  box.hidden = !open;
  btn.setAttribute("aria-expanded", open);
  if (open) renderInbox();
}
function notify(title, body, kind = "run") {
  if ((kind === "run" && !store.prefs.runAlerts) || (kind === "clean" && !store.prefs.cleanAlerts)) return;
  store.notifs.unshift({ title, body, t: slotAt(store.nowIdx).t, unread: true });
  toast(title, body);
  renderBell();
}
function seedNotifs() {
  const at = (daysAgo, h, m = 0) => { const t = demoNow(); t.setDate(t.getDate() - daysAgo); t.setHours(h, m, 0, 0); return t; };
  const week = store.history.filter((h) => h.at.getTime() > demoNow().getTime() - 7 * 86400e3);
  const last = [...store.history].sort((a, b) => b.at - a.at)[0];
  store.notifs = [
    { title: "Clean hours ahead", body: "The forecast has a long low-carbon window coming up. Your scheduled runs moved into it.", t: new Date(demoNow().getTime() - 40 * 60e3), unread: true },
    { title: `${dev(last.device)?.name || "Device"} finished`, body: `Ran at ${last.shiftedI} g/kWh instead of ${last.baseI}. Saved ${kg(last.kg)} kg CO₂.`, t: last.at, unread: true },
    { title: "Your week", body: `${kg(sum(week.map((h) => h.kg)))} kg CO₂ avoided and ${money(sum(week.map((h) => h.cost)))} saved.`, t: at(2, 9), unread: false },
  ];
}

function drawer(html, onMount) {
  const root = $("#drawer-root");
  root.innerHTML = `<div class="drawer-wrap"><aside class="drawer" role="dialog" aria-modal="true">${html}</aside></div>`;
  const wrap = root.firstElementChild;
  const esc = (e) => e.key === "Escape" && close();
  const close = () => { wrap.classList.add("leaving"); setTimeout(() => (root.innerHTML = ""), 200); document.removeEventListener("keydown", esc); };
  document.addEventListener("keydown", esc);
  wrap.addEventListener("pointerdown", (e) => e.target === wrap && close());
  onMount?.(wrap.firstElementChild, close);
  return close;
}

function renderView(enter = true) {
  const r = route(), R = ROUTES[r];
  charts = [];
  $("#page-title").textContent = R.title;
  $("#page-sub").textContent = R.sub();
  document.title = `${R.title} · ShiftWatt`;
  $("#page-actions").innerHTML = ACTIONS[r]?.() || "";
  const v = $("#view");
  v.classList.remove("entering");
  VIEWS[r](v);
  if (r === "devices") $("#act-add").onclick = addDeviceFlow;
  if (r === "impact") {
    $$("#period button").forEach((b) => (b.onclick = () => { store.period = +b.dataset.p; renderView(false); }));
    $("#act-export").onclick = exportCSV;
  }
  if (r === "live") $("#act-refresh").onclick = refreshLiveGrid;
  if (enter && !reduceMotion) { void v.offsetWidth; v.classList.add("entering"); }
  renderNav();
  renderLive();
}

function exportCSV() {
  const head = ["device", "ran_at", "kwh", "g_per_kwh_when_ready", "g_per_kwh_when_ran", "kg_co2_saved_average", "kg_co2_saved_marginal", "cost_saved"];
  const rows = [...store.history].sort((a, b) => a.at - b.at).map((h) =>
    [dev(h.device)?.name || h.device, h.at.toISOString(), h.kWh.toFixed(2), h.baseI, h.shiftedI, h.kg.toFixed(3), h.kgMarginal.toFixed(3), h.cost.toFixed(2)]);
  const blob = new Blob([[head, ...rows].map((r) => r.join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "shiftwatt-history.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Export ready", `${rows.length} runs saved to shiftwatt-history.csv`);
}

/* ============================== views ============================== */
const VIEWS = {};

function avgMix(a, b) {
  const out = {};
  for (const k in SOURCES) out[k] = sum(store.slots.slice(a, b).map((s) => s.mix[k] || 0)) / (b - a);
  return out;
}
function mixRow(label, I, mix) {
  const segs = Object.keys(SOURCES).filter((k) => mix[k] > 0.004)
    .map((k) => `<i style="width:${mix[k] * 100}%;background:${SOURCES[k].color}" title="${SOURCES[k].label} ${Math.round(mix[k] * 100)}%"></i>`).join("");
  return `<div class="mix-row"><div class="lbl"><span>${label}</span><span class="mono" style="color:${classify(I).color}">${Math.round(I)} g</span></div><div class="mixbar">${segs}</div></div>`;
}
const durText = (slots) => { const m = slots * 30; return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`; };

VIEWS.today = (v) => {
  const now = store.slots[store.nowIdx], c = classify(now.I);
  const best = bestWindow(store.nowIdx, Math.min(store.slots.length, store.nowIdx + 48), 4);
  const pct = Math.round((1 - best.I / now.I) * 100);
  const headline = c.label === "Clean" || pct < 15
    ? `Clean power right now. <em>Good time to run things.</em>`
    : `Wait if you can. It gets <em>${pct}% cleaner</em> ${relWhen(slotAt(best.s).t)}.`;
  const upcoming = Object.values(store.runs).sort((a, b) => a.startIdx - b.startIdx);
  const strip = store.slots.slice(store.nowIdx, store.nowIdx + 48);
  const bL = ((best.s - store.nowIdx) / strip.length) * 100, bW = ((best.e - best.s) / strip.length) * 100;
  const weekAgo = demoNow().getTime() - 7 * 86400e3;
  const week = store.history.filter((h) => h.at.getTime() > weekAgo);
  const H = store.history, kWhAll = sum(H.map((h) => h.kWh));
  const avgBase = sum(H.map((h) => h.baseI * h.kWh)) / kWhAll, avgShift = sum(H.map((h) => h.shiftedI * h.kWh)) / kWhAll;
  const sr = surplusRuns().find(([, b]) => b > store.nowIdx);
  const mixNow = now.mix, mixBest = avgMix(best.s, best.e);
  const used = Object.keys(SOURCES).filter((k) => (mixNow[k] || 0) > 0.02 || mixBest[k] > 0.02);

  v.innerHTML = `
  <section class="card stats three">
    <div class="stat"><div class="k">CO₂ avoided this week</div><div class="v">${kg(sum(week.map((h) => h.kg)))}<small>kg</small></div></div>
    <div class="stat"><div class="k">Saved on your bill</div><div class="v">${money(sum(week.map((h) => h.cost)))}</div></div>
    <div class="stat"><div class="k">Carbon per kWh you use</div><div class="v clean">−${Math.round((1 - avgShift / avgBase) * 100)}%</div><div class="d mono">${Math.round(avgBase)} → ${Math.round(avgShift)} g, same habits</div></div>
  </section>

  <section class="card hero">
    <div class="eyebrow row">Grid right now · ${region().place} ${sourceBadge()}</div>
    <div class="reading"><span class="value" style="color:${c.color}">${now.I}</span><span class="unit">g CO₂ per kWh</span></div>
    <div class="status" style="color:${c.color}"><span class="dot"></span>${c.label} · ${Math.round(cleanShare(now) * 100)}% from clean sources</div>
    <p class="headline">${headline}</p>
    <div class="strip">
      <div class="strip-track">
        <div class="strip-cells">${strip.map((s) => `<span style="background:${tone(level(s.I))};opacity:${0.4 + 0.6 * (1 - level(s.I) * 0.5)}"></span>`).join("")}</div>
        <div class="strip-best" style="left:${bL}%;width:${bW}%"></div>
      </div>
      <div class="strip-axis"><span>Now</span><b>Cleanest · ${when(slotAt(best.s).t)}</b><span>+24h</span></div>
    </div>
    <a class="btn primary lg" href="#/plan">Plan a run</a>
  </section>

  <section class="card">
    <div class="section-head"><h2>Next ${Math.round(horizonH())} hours</h2><span class="mono muted small">${sourceText()}</span></div>
    <div class="chart" id="fc"></div>
    ${sr ? `<p class="note">${icon("sun")}<span><b>Surplus solar ${relWhen(slotAt(sr[0]).t)}.</b> Renewables will outrun demand for ${durText(sr[1] - sr[0])}. Power used then would otherwise be curtailed.</span></p>` : ""}
  </section>

  <div class="grid-2">
    <section class="card">
      <h2>What's on the grid</h2>
      ${mixRow(`Now · ${fmtTime(now.t)}`, now.I, mixNow)}
      ${mixRow(`Cleanest · ${when(slotAt(best.s).t)}`, best.I, mixBest)}
      <div class="legend">${used.map((k) => `<span><i style="background:${SOURCES[k].color}"></i>${SOURCES[k].label}</span>`).join("")}</div>
    </section>
    <section class="card">
      <div class="section-head"><h2>Coming up</h2><a href="#/plan">Add</a></div>
      <div class="list">${upcoming.length ? upcoming.map(runRow).join("") : `<p class="empty">Nothing scheduled. <a href="#/plan">Plan a run</a>.</p>`}</div>
    </section>
  </div>`;

  chart($("#fc"), (el) => forecast(el, { id: "today", height: 200, windows: upcoming.map((r) => ({ s: r.startIdx, e: r.endIdx, label: dev(r.device).name.split(" ")[0] })) }));
};

function runRow(r) {
  const d = dev(r.device);
  const sub = r.status === "running" ? `<span class="running-dot"></span>Running now` : when(slotAt(r.startIdx).t);
  return `<div class="item"><div class="ico">${icon(d.icon)}</div><div><div class="name">${d.name}</div><div class="sub">${sub} · ${Math.round(r.clean * 100)}% clean</div></div><div class="end clean mono">−${kg(r.saveKg)} kg</div></div>`;
}

VIEWS.plan = (v) => {
  const d = dev(store.planDev);
  d.readyBy = clamp(d.readyBy, minReadyBy(d), horizonH());
  v.innerHTML = `
  <section class="card">
    <div class="chips" id="pick">${store.devices.map((x) =>
      `<button class="chip" type="button" data-id="${x.id}" aria-pressed="${x.id === d.id}">${icon(x.icon)}${x.name}${store.runs[x.id] ? '<span class="tick" title="Scheduled"></span>' : ""}</button>`).join("")}</div>
    <div class="field">
      <div class="field-row"><label for="ready">Needs to be done by</label><span class="val" id="ready-label"></span></div>
      <input class="range" id="ready" type="range" min="${minReadyBy(d)}" max="${horizonH()}" step="0.5" value="${d.readyBy}">
      <div class="field-row small muted mono"><span>${(d.kW * d.hours).toFixed(1)} kWh</span><span>${durText(Math.round(d.hours * SLOTS_PER_H))} at ${d.kW} kW</span></div>
    </div>
    <div class="answer" id="answer"></div>
  </section>`;

  $$("#pick button").forEach((b) => (b.onclick = () => { store.planDev = b.dataset.id; renderView(false); }));
  const slider = $("#ready");
  slider.oninput = () => { d.readyBy = +slider.value; update(); };

  function update() {
    const mode = store.planMode;
    const res = optimize(d, d.readyBy, mode);
    const tip = flexTip(d, res, mode);
    const existing = store.runs[d.id];
    const same = existing && existing.startIdx === res.startIdx;
    const isNow = res.startIdx === store.nowIdx;
    const maxKg = Math.max(res.kgNow, res.kgBest) || 1;
    slider.style.setProperty("--p", `${((d.readyBy - +slider.min) / (48 - +slider.min || 1)) * 100}%`);
    $("#ready-label").textContent = when(slotAt(NOW_IDX + d.readyBy * SLOTS_PER_H).t);

    $("#answer").innerHTML = `
      <div class="row"><div class="eyebrow">Best time to run</div>
        <div class="seg spacer" id="mode"><button type="button" data-m="carbon" aria-pressed="${mode === "carbon"}">Lowest CO₂</button><button type="button" data-m="cost" aria-pressed="${mode === "cost"}">Lowest cost</button></div></div>
      <p class="when">${isNow ? "Right now" : when(slotAt(res.startIdx).t)}</p>
      <p class="window mono">${fmtTime(slotAt(res.startIdx).t)} → ${fmtTime(slotAt(res.endIdx).t)} · ${Math.round(res.clean * 100)}% clean power</p>
      ${isNow || res.saveKg < 0.01 ? `<p class="saves">Nothing ${mode === "cost" ? "cheaper" : "cleaner"} before your deadline.</p>` : `
      <div class="compare">
        <div class="compare-row"><span class="muted">Start now</span><div class="bar"><i style="background:var(--dirty);transform:scaleX(${res.kgNow / maxKg})"></i></div><span class="mono">${kg(res.kgNow)} kg</span></div>
        <div class="compare-row"><span>At best time</span><div class="bar"><i style="background:var(--clean);transform:scaleX(${res.kgBest / maxKg})"></i></div><span class="mono">${kg(res.kgBest)} kg</span></div>
      </div>
      <p class="saves"><b>${Math.round(res.pct * 100)}% cleaner</b> · saves ${kg(res.saveKg)} kg CO₂ and ${money(res.saveCost)}</p>`}
      <div class="chart" id="plan-chart"></div>
      ${tip ? `<div class="tip">${icon("sun")}<span>Ready by <b>${when(slotAt(NOW_IDX + tip.h * SLOTS_PER_H).t)}</b> ${mode === "cost" ? "saves" : "cuts"} ${tip.x.toFixed(1)}× more.</span><button type="button" id="use-tip">Use</button></div>` : ""}
      <div class="actions">
        ${existing?.status === "running"
          ? `<button class="btn primary lg" disabled>Running now</button>`
          : `<button class="btn primary lg" id="go" ${same ? "disabled" : ""}><span class="btn-label">${same ? "Scheduled" : isNow ? "Start now" : "Schedule"}</span></button>`}
        ${existing?.status === "scheduled" ? `<button class="btn ghost" id="cancel" type="button">Cancel</button>` : ""}
      </div>`;

    chart($("#plan-chart"), (el) => forecast(el, { id: "plan", height: 170, windows: [{ s: res.startIdx, e: res.endIdx, label: "Best" }] }));
    $$("#mode button").forEach((b) => (b.onclick = () => { store.planMode = b.dataset.m; update(); }));
    $("#use-tip")?.addEventListener("click", () => { d.readyBy = tip.h; slider.value = tip.h; update(); });
    $("#go")?.addEventListener("click", (e) => {
      e.currentTarget.classList.add("morphing");
      setTimeout(() => { schedule(d.id, res); renderView(false); }, 150);
    });
    $("#cancel")?.addEventListener("click", () => { delete store.runs[d.id]; toast(`${d.name} unscheduled`, "It will run whenever you start it."); renderView(false); });
  }
  update();
};

VIEWS.devices = (v) => {
  const savedBy = (id) => sum(store.history.filter((h) => h.device === id).map((h) => h.kg));
  v.innerHTML = `
  <div class="dev-grid">
    ${store.devices.map((d) => {
      const r = store.runs[d.id];
      const sub = r?.status === "running" ? `<span class="running-dot"></span>Running now`
        : r ? `Scheduled · ${when(slotAt(r.startIdx).t)}`
        : d.auto ? "Waits for clean power" : "Runs immediately";
      return `<section class="card dev" data-open="${d.id}" tabindex="0" role="button" aria-label="${d.name} settings">
        <div class="ico">${icon(d.icon)}</div>
        <div><div class="name">${d.name}${d.quiet ? '<span class="tag">Quiet hours</span>' : ""}</div><div class="sub">${sub}</div>
          <div class="meta"><span class="online sim"></span>${d.via || d.plug} · <span class="mono">${(d.kW * d.hours).toFixed(1)} kWh/run · ${kg(savedBy(d.id))} kg saved</span>${r ? "" : ` · <button class="linkish" data-run="${d.id}" type="button">Run now</button>`}</div></div>
        <button class="toggle" role="switch" aria-checked="${d.auto}" aria-label="Smart timing for ${d.name}" data-id="${d.id}"></button></section>`;
    }).join("")}
  </div>
  <p class="small muted" style="margin:0">Select a device to set its default deadline and quiet hours, or see its history.</p>`;
  $$(".dev .toggle").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const d = dev(b.dataset.id); d.auto = !d.auto; renderView(false); }));
  $$("[data-open]").forEach((c) => {
    c.onclick = () => openDevice(c.dataset.open);
    c.onkeydown = (e) => { if (e.key === "Enter" && e.target === c) openDevice(c.dataset.open); };
  });
  $$("[data-run]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const d = dev(b.dataset.run);
    const wait = optimize(d, Math.max(d.readyBy, minReadyBy(d)));
    const runNow = () => { schedule(d.id, optimize(d, minReadyBy(d)), true); toast(`${d.name} started`, `Running at ${Math.round(wait.baseI)} g/kWh.`); renderView(false); };
    if (wait.saveKg > 0.05) {
      toast(`Running now adds ${kg(wait.saveKg)} kg CO₂`, `Waiting until ${when(slotAt(wait.startIdx).t)} is ${Math.round(wait.pct * 100)}% cleaner and still finishes in time.`,
        { label: `Wait until ${fmtTime(slotAt(wait.startIdx).t)}`, fn: () => { schedule(d.id, wait); renderView(false); } });
    } else runNow();
  }));
};

function reschedule(d) {
  const r = store.runs[d.id];
  if (!r || r.status !== "scheduled") return null;
  schedule(d.id, optimize(d, Math.max(d.readyBy, minReadyBy(d))), true);
  return store.runs[d.id];
}

function openDevice(id) {
  const d = dev(id);
  const runs = store.history.filter((h) => h.device === id).sort((a, b) => b.at - a.at);
  const saved = sum(runs.map((h) => h.kg));
  const avgCut = runs.length ? sum(runs.map((h) => 1 - h.shiftedI / h.baseI)) / runs.length : 0;
  const daily = Array.from({ length: 30 }, (_, k) => {
    const d0 = demoNow().getTime() - (29 - k) * 86400e3;
    return sum(runs.filter((h) => Math.abs(h.at.getTime() - d0) < 43200e3).map((h) => h.kg));
  });
  const maxDay = Math.max(...daily, 0.01);
  const opts = [[12.5, "Next morning, 7:00"], [24, "Within 24 hours"], [48, "Within 48 hours"]].filter(([h]) => h <= horizonH());
  if (!opts.some(([h]) => h === d.readyBy)) opts.unshift([d.readyBy, when(slotAt(NOW_IDX + d.readyBy * SLOTS_PER_H).t)]);
  const r = store.runs[id];
  drawer(`
    <div class="drawer-head"><div class="ico">${icon(d.icon)}</div><div><h2>${d.name}</h2><div class="sub">${d.model || d.plug || ""}</div></div>
      <button class="icon-btn" id="d-close" type="button" aria-label="Close">${icon("x")}</button></div>
    <div class="drawer-status"><span class="online sim"></span>Simulated · production connects via ${d.via || d.plug}</div>
    ${r ? `<div class="drawer-run"><div><div class="eyebrow">${r.status === "running" ? "Running now" : "Next run"}</div><div class="drawer-run-when">${r.status === "running" ? `Until ${fmtTime(slotAt(r.endIdx).t)}` : when(slotAt(r.startIdx).t)}</div></div><span class="mono clean">−${kg(r.saveKg)} kg</span></div>` : ""}
    <div class="drawer-stats">
      <div><div class="k">Saved, 60 days</div><div class="v">${kg(saved)}<small>kg</small></div></div>
      <div><div class="k">Runs</div><div class="v">${runs.length}</div></div>
      <div><div class="k">Avg. cleaner</div><div class="v clean">${Math.round(avgCut * 100)}%</div></div>
    </div>
    <div class="minibars" aria-label="CO₂ saved per day, last 30 days">${daily.map((x) => `<i style="height:${Math.max(2, (x / maxDay) * 100)}%;opacity:${x ? 1 : 0.25}"></i>`).join("")}</div>
    <div class="minibars-axis mono"><span>30 days ago</span><span>Today</span></div>
    <h3 class="drawer-h">Rules</h3>
    <div class="set-row"><div><div class="set-label">Smart timing</div><div class="set-desc">Wait for cleaner power, finish before the deadline</div></div><button class="toggle" id="d-auto" role="switch" aria-checked="${d.auto}" aria-label="Smart timing"></button></div>
    <div class="set-row"><div><div class="set-label">Default deadline</div><div class="set-desc">When a new load must be finished</div></div><select class="select sm" id="d-deadline">${opts.map(([h, l]) => `<option value="${h}" ${h === d.readyBy ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="set-row"><div><div class="set-label">Quiet hours</div><div class="set-desc">Never run between 10 PM and 7 AM</div></div><button class="toggle" id="d-quiet" role="switch" aria-checked="${!!d.quiet}" aria-label="Quiet hours"></button></div>
    <h3 class="drawer-h">Recent runs</h3>
    <div class="log">${runs.length ? runs.slice(0, 5).map((h) => `<div class="log-row"><span>${fmtDate(h.at)}<span class="muted small"> · ${fmtTime(h.at)}</span></span><span class="mono small"><span style="color:var(--dirty)">${h.baseI}</span> → <span class="clean">${h.shiftedI}</span> g</span><span class="mono clean">−${kg(h.kg)}</span></div>`).join("") : `<p class="empty">No runs yet.</p>`}</div>
    <div class="drawer-foot"><button class="btn primary" id="d-plan" type="button">Plan a run</button><button class="btn ghost danger" id="d-remove" type="button">Remove device</button></div>`,
    (m, close) => {
      $("#d-close", m).onclick = close;
      $("#d-auto", m).onclick = (e) => { d.auto = !d.auto; e.currentTarget.setAttribute("aria-checked", d.auto); renderView(false); };
      $("#d-deadline", m).onchange = (e) => {
        d.readyBy = +e.target.value;
        const moved = reschedule(d);
        renderView(false);
        if (moved) toast(`${d.name} rescheduled`, `Now runs ${relWhen(slotAt(moved.startIdx).t)}.`);
      };
      $("#d-quiet", m).onclick = (e) => {
        d.quiet = !d.quiet;
        e.currentTarget.setAttribute("aria-checked", d.quiet);
        const moved = reschedule(d);
        renderView(false);
        toast(d.quiet ? "Quiet hours on" : "Quiet hours off", moved ? `${d.name} now runs ${relWhen(slotAt(moved.startIdx).t)}.` : `${d.name} won't start between 10 PM and 7 AM.`);
      };
      $("#d-plan", m).onclick = () => { store.planDev = id; close(); location.hash = "#/plan"; };
      $("#d-remove", m).onclick = () => {
        store.devices = store.devices.filter((x) => x.id !== id);
        delete store.runs[id];
        if (store.planDev === id) store.planDev = store.devices[0]?.id;
        close();
        renderView(false);
        toast(`${d.name} removed`, "Its past runs stay in your Impact history.");
      };
    });
}

function addDeviceFlow() {
  const found = [
    { id: "pool", name: "Pool pump", icon: "pump", kW: 1.1, hours: 4, readyBy: 24, plug: "Shelly Pro 1PM", auto: true, runsPerWeek: 7 },
    { id: "dehum", name: "Dehumidifier", icon: "fan", kW: 0.5, hours: 3, readyBy: 18, plug: "Kasa KP125M", auto: true, runsPerWeek: 7 },
  ].filter((f) => !dev(f.id));
  modal(`<h2>Add a device</h2><p class="lead">Looking for smart plugs and chargers on your network…</p>
    <div id="scan"><div class="scan-row"><div class="spinner"></div><span class="muted">Scanning</span></div></div>
    <div class="modal-foot"><button class="btn ghost" id="m-close" style="margin-left:auto">Done</button></div>`,
    (m, close) => {
      $("#m-close", m).onclick = close;
      setTimeout(() => {
        const scan = $("#scan", m);
        if (!scan) return;
        scan.innerHTML = found.length
          ? found.map((f) => `<div class="scan-row"><div class="ico">${icon(f.icon)}</div><div><div>${f.name}</div><div class="small muted mono">${f.plug}</div></div><button class="btn primary" style="margin-left:auto" data-add="${f.id}">Add</button></div>`).join("")
          : `<p class="muted">No new devices found.</p>`;
        $$("[data-add]", m).forEach((b) => (b.onclick = () => {
          store.devices.push(found.find((x) => x.id === b.dataset.add));
          b.outerHTML = `<span class="clean small" style="margin-left:auto">Added</span>`;
          if (route() === "devices") renderView(false);
        }));
      }, 1200);
    });
}

VIEWS.impact = (v) => {
  const days = store.period;
  const since = demoNow().getTime() - days * 86400e3;
  const H = store.history.filter((h) => h.at.getTime() > since);
  const marginal = store.prefs.signal === "marginal";
  const val = (h) => (marginal ? h.kgMarginal : h.kg);
  const total = sum(H.map(val)), other = sum(H.map((h) => (marginal ? h.kg : h.kgMarginal))), cost = sum(H.map((h) => h.cost));
  let acc = 0;
  const cum = Array.from({ length: days + 1 }, (_, k) => {
    const d0 = since + k * 86400e3;
    acc += sum(H.filter((h) => h.at.getTime() >= d0 - 86400e3 && h.at.getTime() < d0).map(val));
    return { y: acc, label: fmtDate(new Date(d0)) };
  });
  const byDev = [...new Set(H.map((h) => h.device))].map((id) => ({ name: dev(id)?.name || id, kg: sum(H.filter((h) => h.device === id).map(val)) }))
    .sort((a, b) => b.kg - a.kg).slice(0, 4);
  const yearKg = (total * 365) / days;
  const recent = [...H].sort((a, b) => b.at - a.at).slice(0, 6);
  v.innerHTML = `
  <section class="card hero">
    <div class="eyebrow">CO₂ avoided · last ${days} days · ${marginal ? "marginal" : "average"} intensity</div>
    <div class="big"><span id="tot">0</span><small>kg</small></div>
    <p class="big-sub">Like skipping ${Math.round(total / EQUIV.kgPerMile)} miles of driving, plus ${money(cost)} off your bill. Same electricity, used at cleaner times.</p>
    <div class="chart" id="cum" style="margin-top:28px"></div>
  </section>

  <section class="card stats three">
    <div class="stat"><div class="k">Your year at this pace</div><div class="v">${Math.round(yearKg)}<small>kg</small></div></div>
    <div class="stat"><div class="k">1,000 homes like yours</div><div class="v clean">${Math.round(yearKg)}<small>t / year</small></div></div>
    <div class="stat"><div class="k">${marginal ? "Average" : "Marginal"}-intensity estimate</div><div class="v">${kg(other)}<small>kg</small></div><div class="d"><a href="#/settings" class="muted">Change measure in Settings</a></div></div>
  </section>

  <div class="grid-2">
    <section class="card">
      <h2>Biggest wins</h2>
      ${byDev.length ? byDev.map((x) => `<div class="hbar"><span>${x.name}</span><div class="track"><i style="width:${(x.kg / byDev[0].kg) * 100}%"></i></div><span class="n mono">${kg(x.kg)}</span></div>`).join("") : `<p class="empty">No runs in this period.</p>`}
    </section>
    <section class="card">
      <div class="section-head"><h2>Every run, measured</h2><a href="#/method">Method</a></div>
      <div class="log">${recent.map((h) => `<div class="log-row"><span>${dev(h.device)?.name || h.device}<span class="muted small"> · ${fmtDate(h.at)}</span></span><span class="mono small"><span style="color:var(--dirty)">${h.baseI}</span> → <span class="clean">${h.shiftedI}</span> g</span><span class="mono clean">−${kg(val(h))}</span></div>`).join("")}</div>
      <p class="small muted" style="margin:12px 0 0">Intensity when the load was ready → when it actually ran.</p>
    </section>
  </div>`;
  countUp($("#tot"), total, (x) => x.toFixed(1));
  chart($("#cum"), (el) => areaChart(el, cum));
};

VIEWS.settings = (v) => {
  const ints = [...new Set(store.devices.map((d) => d.via || d.plug))].map((name) => ({ name, devices: store.devices.filter((d) => (d.via || d.plug) === name).map((d) => d.name) }));
  const row = (label, desc, control) => `<div class="set-row"><div><div class="set-label">${label}</div>${desc ? `<div class="set-desc">${desc}</div>` : ""}</div>${control}</div>`;
  const sw = (key, label) => `<button class="toggle" role="switch" data-pref="${key}" aria-checked="${store.prefs[key]}" aria-label="${label}"></button>`;
  v.innerHTML = `
  <section class="card settings">
    <h2>Home</h2>
    ${row("Name", "", `<input class="input" id="s-name" value="${store.homeName}" maxlength="40">`)}
    ${row("Grid region", "Sets which carbon forecast ShiftWatt follows", `<select class="select sm" id="s-region">${Object.values(REGIONS).map((r) => `<option value="${r.id}" ${r.id === store.region ? "selected" : ""}>${r.name} · ${r.grid}</option>`).join("")}</select>`)}
    ${row("Location", "", `<span class="set-value">${region().place}</span>`)}
    ${row("Electricity plan", "Used to estimate bill savings", `<span class="set-value">${region().plan}</span>`)}
    ${row("Forecast source", store.source === "live" ? "Refreshes every time the app loads" : "Free live data is wired for Great Britain", `<span class="set-value">${sourceText()}</span>`)}
  </section>

  <section class="card settings">
    <h2>Notifications</h2>
    ${row("Clean-hour alerts", "When a low-carbon window is coming up", sw("cleanAlerts", "Clean-hour alerts"))}
    ${row("Run updates", "When a scheduled device starts or finishes", sw("runAlerts", "Run updates"))}
    ${row("Weekly summary", "Every Monday by email", sw("weekly", "Weekly summary"))}
  </section>

  <section class="card settings">
    <h2>Carbon measure</h2>
    <div class="radio-list">
      <button class="radio" data-signal="average" aria-pressed="${store.prefs.signal === "average"}" type="button"><span class="radio-dot"></span><span><span class="set-label">Average intensity</span><span class="set-desc">The grid mix at that hour. Conservative, so it's the default.</span></span></button>
      <button class="radio" data-signal="marginal" aria-pressed="${store.prefs.signal === "marginal"}" type="button"><span class="radio-dot"></span><span><span class="set-label">Marginal emissions</span><span class="set-desc">The plant that actually ramps up for your load. Usually higher.</span></span></button>
    </div>
    <a class="small muted" href="#/method" style="display:inline-block;margin-top:14px">How savings are calculated →</a>
  </section>

  <section class="card settings">
    <h2>Integrations</h2>
    <p class="small muted" style="margin:0 0 6px">Device control is simulated in this prototype. These are the APIs a production build would use.</p>
    ${ints.map((i) => row(i.name, i.devices.join(", "), `<span class="status-sim">Simulated</span>`)).join("")}
    ${row("Tesla account", "Read battery level so the EV only charges what it needs", store.tesla ? `<span class="status-sim">Simulated</span>` : `<button class="btn" id="s-tesla" type="button">Connect</button>`)}
  </section>

  <section class="card settings">
    <h2>Data</h2>
    ${row("Export run history", "Every run with intensity when ready and when it ran, as CSV", `<button class="btn" id="s-export" type="button">${icon("download")}Export</button>`)}
    ${row("Reset demo", "Restore the sample home and history", `<button class="btn ghost danger" id="s-reset" type="button">Reset</button>`)}
  </section>`;

  $("#s-name").onchange = (e) => { store.homeName = e.target.value.trim() || "My home"; renderNav(); save(); toast("Saved", "Home name updated."); };
  $("#s-region").onchange = async (e) => { await setRegion(e.target.value); toast(`Following the ${region().grid} grid`, sourceText()); };
  $$("[data-pref]").forEach((b) => (b.onclick = () => { const k = b.dataset.pref; store.prefs[k] = !store.prefs[k]; b.setAttribute("aria-checked", store.prefs[k]); save(); }));
  $$("[data-signal]").forEach((b) => (b.onclick = () => { store.prefs.signal = b.dataset.signal; renderView(false); }));
  $("#s-tesla")?.addEventListener("click", (e) => {
    e.currentTarget.innerHTML = `<span class="spinner"></span>`;
    setTimeout(() => { store.tesla = true; renderView(false); toast("Tesla linked (simulated)", "In production, EV charging would target your departure charge level."); }, 900);
  });
  $("#s-export").onclick = exportCSV;
  $("#s-reset").onclick = resetDemo;
};

VIEWS.campus = (v) => {
  const halls = [...CAMPUS.halls].sort((a, b) => b.kg - a.kg);
  const sr = surplusRuns().find(([, b]) => b > store.nowIdx);
  const ev = sr ? { s: Math.max(sr[0], store.nowIdx), e: sr[1] } : bestWindow(store.nowIdx, Math.min(store.slots.length, store.nowIdx + 48), 6);
  const st = windowStats(ev.s, ev.e), now = store.slots[store.nowIdx];
  const pct = Math.max(0, Math.round((1 - st.I / now.I) * 100));
  const fut = store.slots.slice(store.nowIdx, store.nowIdx + 48);
  const delta = Math.max(0, sum(fut.map((s) => s.I)) / fut.length - bestWindow(store.nowIdx, store.nowIdx + 48, 6).I);
  const loadKWh = 3.3;
  const tonnes = (n) => (n * 1.5 * 52 * loadKWh * delta) / 1e6;
  const active = sum(halls.map((h) => h.active)), students = sum(halls.map((h) => h.students));
  v.innerHTML = `
  <section class="card hero event">
    <div class="eyebrow">Next clean hour on campus</div>
    <p class="when-big">${when(slotAt(ev.s).t)} – ${fmtTime(slotAt(ev.e).t)}</p>
    <p class="muted" style="margin:10px 0 0">${pct ? `${pct}% cleaner than now (${Math.round(st.I)} vs ${now.I} g). ` : ""}A good time for laundry and charging laptops or e-bikes.</p>
    <div class="actions">
      <button class="btn primary lg" id="book" ${store.booked ? "disabled" : ""}>${store.booked ? "Washer booked" : "Book a washer"}</button>
      <button class="btn lg" id="remind" ${store.reminded ? "disabled" : ""}>${store.reminded ? "Hall reminded" : `Remind ${CAMPUS.myHall}`}</button>
    </div>
  </section>

  <section class="card">
    <div class="section-head"><h2>Hall leaderboard</h2><span class="small muted">${active.toLocaleString()} of ${students.toLocaleString()} students shifting · illustrative</span></div>
    ${halls.map((h, i) => `<div class="lb ${h.name === CAMPUS.myHall ? "me" : ""}"><span class="rank mono">${i + 1}</span><span class="name">${h.name}${h.name === CAMPUS.myHall ? " · You" : ""}</span>
      <span class="meter" title="${Math.round((h.active / h.students) * 100)}% joined"><i style="transform:scaleX(${h.active / h.students})"></i></span><span class="pct mono">${Math.round((h.active / h.students) * 100)}%</span><span class="n mono">${h.kg.toLocaleString()} kg</span></div>`).join("")}
  </section>

  <section class="card">
    <h2>Scale it across campus</h2>
    <div class="field" style="margin-top:0">
      <div class="field-row"><label for="scale">Students shifting laundry</label><span class="val mono" id="scale-n"></span></div>
      <input class="range" id="scale" type="range" min="100" max="20000" step="100" value="${store.scale}">
    </div>
    <div class="stats" style="margin-top:22px">
      <div class="stat"><div class="k">CO₂ avoided per year</div><div class="v clean" id="scale-t"></div></div>
      <div class="stat"><div class="k">Same as not driving</div><div class="v" id="scale-m"></div></div>
    </div>
    <p class="small muted mono" style="margin:16px 0 0">1.5 loads/week · ${loadKWh} kWh washer + dryer · ${Math.round(delta)} g/kWh avg→cleanest gap on ${region().grid}</p>
  </section>`;
  const sl = $("#scale");
  const upd = () => {
    store.scale = +sl.value;
    sl.style.setProperty("--p", `${((store.scale - 100) / 19900) * 100}%`);
    const t = tonnes(store.scale);
    $("#scale-n").textContent = store.scale.toLocaleString();
    $("#scale-t").innerHTML = `${t.toFixed(1)}<small>t</small>`;
    $("#scale-m").innerHTML = `${Math.round((t * 1000) / EQUIV.kgPerMile).toLocaleString()}<small>mi</small>`;
  };
  sl.oninput = upd; upd();
  $("#book").onclick = () => {
    store.booked = true;
    toast("Washer booked", `${when(slotAt(ev.s).t)}. Saves about ${kg((loadKWh * Math.max(0, now.I - st.I)) / 1000)} kg CO₂ per load.`);
    renderView(false);
  };
  $("#remind").onclick = () => {
    store.reminded = true;
    toast(`${CAMPUS.myHall} reminded`, "Everyone gets a nudge 30 minutes before.");
    renderView(false);
  };
};

/* ---------- live grid (real NESO data, independent of the selected home) ---------- */
const NESO = "https://api.carbonintensity.org.uk";
const NESO_CALLS = { intensity: "/intensity", generation: "/generation", today: "/intensity/date" };
const GRID_TTL = 5 * 60e3;
const absTone = (I) => tone(clamp(I / 320, 0, 1));

async function refreshLiveGrid() {
  if (store.gridLoading) return;
  store.gridLoading = true;
  if (route() === "live") renderView(false);
  try {
    const parts = await Promise.all(Object.entries(NESO_CALLS).map(async ([k, path]) => {
      const res = await fetch(NESO + path, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (!res.ok) throw new Error(`GET ${path} returned HTTP ${res.status}`);
      return [k, (await res.json()).data];
    }));
    store.grid = { at: new Date(), ...Object.fromEntries(parts) };
    store.gridErr = null;
  } catch (err) {
    store.gridErr = err.name === "TimeoutError" ? "The NESO API didn't respond within 8 seconds." : err.message;
  }
  store.gridLoading = false;
  if (route() === "live") renderView(false);
}
setInterval(() => {
  if (route() === "live" && !document.hidden && store.grid && Date.now() - store.grid.at > GRID_TTL) refreshLiveGrid();
}, 30e3);

function actualVsForecast(el, slots) {
  const W = Math.max(280, el.clientWidth), H = 170, pad = { l: 34, r: 6, t: 10, b: 24 };
  const n = slots.length;
  const vals = slots.flatMap((s) => [s.intensity.forecast, s.intensity.actual]).filter((v) => v != null);
  const top = Math.ceil((Math.max(...vals) + 10) / 25) * 25;
  const bottom = Math.max(0, Math.floor((Math.min(...vals) - 10) / 25) * 25);
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const X = (i) => pad.l + (i * iw) / (n - 1), Y = (v) => pad.t + (1 - (v - bottom) / (top - bottom)) * ih;
  const path = (key) => slots.map((s, i) => [i, s.intensity[key]]).filter(([, v]) => v != null)
    .map(([i, v], k) => `${k ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const ticks = [1, 2, 3].map((k) => Math.round((bottom + ((top - bottom) * k) / 4) / 5) * 5).map((v) => `<line class="gridline" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join("");
  const xl = slots.map((s, i) => { const t = new Date(s.from); return t.getUTCMinutes() || t.getUTCHours() % 6 ? "" : `<text class="axis" x="${X(i)}" y="${H - 6}" text-anchor="middle">${String(t.getUTCHours()).padStart(2, "0")}:00Z</text>`; }).join("");
  const lastActual = slots.reduce((a, s, i) => (s.intensity.actual != null ? i : a), -1);
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Today's actual versus forecast carbon intensity">
    ${ticks}
    <path d="${path("forecast")}" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="4 4"/>
    <path d="${path("actual")}" fill="none" stroke="#5be3a0" stroke-width="2.2"/>
    ${lastActual >= 0 ? `<circle cx="${X(lastActual)}" cy="${Y(slots[lastActual].intensity.actual)}" r="4" fill="#5be3a0" stroke="var(--surface)" stroke-width="2"/>` : ""}
    ${xl}
    <line class="cross" y1="${pad.t}" y2="${H - pad.b}"/>
  </svg><div class="tooltip"></div>`;
  const cross = $(".cross", el), tip = $(".tooltip", el);
  el.onpointermove = (e) => {
    const x = e.clientX - el.getBoundingClientRect().left;
    const i = clamp(Math.round(((x - pad.l) / iw) * (n - 1)), 0, n - 1), s = slots[i];
    cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i));
    tip.innerHTML = `<div class="t">${new Date(s.from).toISOString().slice(11, 16)}Z · ${fmtTime(new Date(s.from))} local</div>forecast <b>${s.intensity.forecast}</b> · actual <b class="clean">${s.intensity.actual ?? "pending"}</b>`;
    const tw = tip.offsetWidth;
    tip.style.transform = `translate(${clamp(x > W * 0.6 ? x - tw - 12 : x + 12, 0, W - tw)}px, 0px)`;
  };
}

VIEWS.live = (v) => {
  const g = store.grid;
  if (!g && !store.gridErr) {
    v.innerHTML = `<section class="card loading"><span class="spinner"></span><span>Calling the NESO Carbon Intensity API…</span></section>`;
    refreshLiveGrid();
    return;
  }
  if (!g) {
    v.innerHTML = `<section class="card loading" style="flex-direction:column"><b>Couldn't reach the live API</b><span class="small">${store.gridErr}</span><button class="btn" id="grid-retry" type="button">${icon("refresh")}Try again</button></section>`;
    $("#grid-retry").onclick = () => { store.gridErr = null; refreshLiveGrid(); };
    return;
  }
  if (Date.now() - g.at > GRID_TTL && !store.gridLoading) setTimeout(refreshLiveGrid, 0);

  const now = g.intensity[0];
  const nowI = now.intensity.actual ?? now.intensity.forecast;
  const clean = sum(g.generation.generationmix.filter((m) => SOURCES[{ biomass: "other" }[m.fuel] || m.fuel]?.clean).map((m) => m.perc));
  const settled = g.today.filter((s) => s.intensity.actual != null);
  const mae = settled.length ? sum(settled.map((s) => Math.abs(s.intensity.actual - s.intensity.forecast))) / settled.length : null;
  const range = `${fmtTime(new Date(now.from))}–${fmtTime(new Date(now.to))}`;
  const raw = JSON.stringify({ intensity: g.intensity, generation: g.generation }, null, 2);

  v.innerHTML = `
  <section class="card hero live-hero">
    <div>
      <div class="eyebrow row">Great Britain right now <span class="src live"><span class="live-dot"></span>Live</span></div>
      <div class="reading"><span class="value" style="color:${absTone(nowI)}">${nowI}</span><span class="unit">g CO₂ per kWh<br>${now.intensity.actual != null ? "measured" : "forecast"}</span></div>
    </div>
    <div class="facts">
      <div><span>Forecast was</span><b class="mono">${now.intensity.forecast} g</b></div>
      <div><span>Clean sources</span><b class="mono clean">${Math.round(clean)}%</b></div>
      <div><span>Half hour</span><b class="mono">${range}</b></div>
    </div>
  </section>

  <section class="card">
    <div class="section-head"><h2>Today: forecast vs. what happened</h2><span class="legend"><span><i style="background:#5be3a0"></i>Actual</span><span><i style="background:var(--muted)"></i>Forecast</span></span></div>
    <div class="chart" id="avf"></div>
    <p class="small muted" style="margin:12px 0 0">${mae == null ? "Actual readings fill in every half hour." : `Off by <b class="clean">±${mae.toFixed(1)} g</b> on average across ${settled.length} settled half hours today.`} This is the forecast ShiftWatt schedules against. Times in UTC.</p>
  </section>
  <details class="card verify-card">
    <summary><span><b>Verify it yourself</b><span class="small muted">${Object.keys(NESO_CALLS).length} public endpoints · no API key · fetched ${g.at.toLocaleTimeString()}</span></span>${icon("chevron")}</summary>
    <div class="verify">${Object.values(NESO_CALLS).map((p) => `<a href="${NESO + p}" target="_blank" rel="noopener"><span class="mono">GET ${NESO.replace("https://", "")}${p}</span>${icon("external")}</a>`).join("")}</div>
    <pre class="mono raw-json">${raw.replace(/</g, "&lt;")}</pre>
  </details>`;

  chart($("#avf"), (el) => actualVsForecast(el, g.today));
};

/* ---------- intro film (YouTube, loaded only on click) ---------- */
const INTRO_ID = "6B3TAKk6Wms";
function introPlayer(label = "Watch the 1-minute intro") {
  return `<button class="yt" type="button" data-yt aria-label="${label}">
    <img src="https://i.ytimg.com/vi/${INTRO_ID}/maxresdefault.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${INTRO_ID}/hqdefault.jpg'">
    <span class="yt-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></span>
    <span class="yt-label">${label}</span>
  </button>`;
}
function mountIntro(scope = document) {
  $$("[data-yt]", scope).forEach((b) => (b.onclick = () => {
    b.outerHTML = `<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${INTRO_ID}?autoplay=1&rel=0&modestbranding=1" title="ShiftWatt intro" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  }));
}
function openIntro() {
  modal(`<div class="video-head"><h2>ShiftWatt in one minute</h2><button class="icon-btn" id="v-close" type="button" aria-label="Close">${icon("x")}</button></div>${introPlayer()}`,
    (m, close) => { $("#v-close", m).onclick = close; mountIntro(m); $("[data-yt]", m)?.click(); }, "video");
}

VIEWS.method = (v) => {
  const H = store.history;
  const avg = sum(H.map((h) => h.kg)), marg = sum(H.map((h) => h.kgMarginal));
  v.innerHTML = `
  <section class="card">
    ${introPlayer()}
  </section>
  <section class="card hero">
    <p class="quote">In 2024 California curtailed <em>3.4 million MWh</em> of wind and solar power, mostly midday solar. Some of the cleanest electricity goes unused because demand comes at the wrong time.</p>
    <p class="small muted" style="margin:14px 0 0">Source: <a class="clean" href="https://www.eia.gov/todayinenergy/detail.php?id=65364" target="_blank" rel="noopener">U.S. EIA, May 2025</a></p>
  </section>
  <section class="card steps">
    <div class="step"><span class="n">1</span><h3>Read the forecast</h3><p>48 hours of grid carbon intensity, every 30 minutes.</p></div>
    <div class="step"><span class="n">2</span><h3>Find the cleanest window</h3><p>Every start time before your deadline is checked; the lowest-carbon one wins.</p></div>
    <div class="step"><span class="n">3</span><h3>Start it safely</h3><p>EV chargers and appliances through their own APIs. Plugs only for loads that can resume.</p></div>
    <div class="step"><span class="n">4</span><h3>Log the difference</h3><p>Each run records the intensity when it was ready vs. when it ran.</p></div>
  </section>
  <section class="card">
    <h2>The math</h2>
    <div class="formula">saved_kg = kWh × (intensity_now − intensity_best) ÷ 1000</div>
    <div class="prose">
      <p><b>Fair baseline.</b> We compare to starting the moment a load is ready, not to the worst hour of the day.</p>
      <p><b>Conservative headline.</b> We report average-intensity savings (${kg(avg)} kg). The marginal-emissions estimate, based on the plant that actually ramps up, is higher (${kg(marg)} kg).</p>
      <p><b>Data.</b> Great Britain runs on the live NESO Carbon Intensity forecast for North West England (free, no key). California and Texas use curves modeled from each grid's typical generation mix, because their free forecast sources need accounts. Device control, the household history and the campus figures are simulated or illustrative. Equivalencies use EPA factors.</p>
      <p><b>Limits.</b> Shifting lowers carbon per kWh, not kWh used. Fridges and medical devices are never shifted. At large scale, starts would be staggered so they don't create new peaks.</p>
    </div>
  </section>`;
  mountIntro(v);
};

/* ============================== demo clock ============================== */
function nextEvent() {
  let t = Infinity;
  for (const r of Object.values(store.runs)) {
    if (r.status === "scheduled" && r.startIdx > store.nowIdx) t = Math.min(t, r.startIdx);
    if (r.status === "running" && r.endIdx > store.nowIdx) t = Math.min(t, r.endIdx);
  }
  return t === Infinity ? null : Math.min(t, store.slots.length - 1);
}
function settle() {
  for (const [id, r] of Object.entries(store.runs)) {
    const d = dev(id);
    if (r.status === "scheduled" && r.startIdx <= store.nowIdx) {
      r.status = "running";
      notify(`${d.name} started`, `Running on ${Math.round(r.clean * 100)}% clean power, ${Math.round(r.I)} g/kWh vs ${Math.round(r.baseI)} when it was ready.`);
    }
    if (r.status === "running" && r.endIdx <= store.nowIdx) {
      store.history.push({ device: id, at: slotAt(r.startIdx).t, kWh: r.kWh, baseI: Math.round(r.baseI), shiftedI: Math.round(r.I), kg: r.saveKg, kgMarginal: Math.max(r.saveKg, r.saveKgMarginal), cost: Math.max(0, r.saveCost), extra: true });
      delete store.runs[id];
      notify(`${d.name} finished`, `Saved ${kg(r.saveKg)} kg CO₂ and ${money(r.saveCost)}.`);
    }
  }
}
let ffBusy = false;
function fastForward() {
  if (ffBusy) return;
  const target = nextEvent();
  if (target == null) { toast("Nothing scheduled", "Plan a run first, then skip ahead.", { label: "Plan a run", fn: () => (location.hash = "#/plan") }); return; }
  ffBusy = true;
  const from = store.nowIdx;
  const ms = reduceMotion ? 1 : clamp(500 + (target - from) * 25, 700, 1600);
  const chip = document.createElement("div");
  chip.className = "ff-chip";
  document.body.append(chip);
  const t0 = performance.now();
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const tick = (t) => {
    const p = clamp((t - t0) / ms, 0, 1);
    const idx = Math.round(from + (target - from) * ease(p));
    if (idx !== store.nowIdx) { store.nowIdx = idx; renderLive(); redrawCharts(); }
    chip.textContent = when(slotAt(idx).t);
    if (p < 1) return requestAnimationFrame(tick);
    store.nowIdx = target;
    settle();
    renderView(false);
    setTimeout(() => { chip.style.opacity = "0"; setTimeout(() => chip.remove(), 200); }, 400);
    ffBusy = false;
  };
  requestAnimationFrame(tick);
}

/* ============================== onboarding ============================== */
function typicalDelta(regionId) {
  const s = buildSlots(regionId).slice(NOW_IDX, NOW_IDX + 48);
  const avg = sum(s.map((x) => x.I)) / s.length;
  let best = Infinity;
  for (let i = 0; i + 6 <= s.length; i++) best = Math.min(best, sum(s.slice(i, i + 6).map((x) => x.I)) / 6);
  return avg - best;
}
function onboarding() {
  let step = 0;
  const pick = { region: store.region, devs: new Set(["ev", "dish", "wash", "water"]) };
  const close = modal(`<div id="ob"></div>`, (m) => {
    const draw = () => {
      const ob = $("#ob", m);
      const dots = `<div class="dots">${[0, 1, 2].map((i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</div>`;
      if (step === 0) {
        ob.innerHTML = `<h2>Same electricity.<br>Cleaner hours.</h2>
          <p class="lead">The grid is much cleaner at some hours than others. ShiftWatt runs the things that can wait at the cleanest time.</p>
          <div class="ob-video">${introPlayer()}</div>
          <div class="options">${Object.values(REGIONS).map((r) => `<button class="option" data-r="${r.id}" aria-pressed="${pick.region === r.id}">${r.name}<span class="meta">${r.grid}</span></button>`).join("")}</div>
          <div class="modal-foot">${dots}<button class="btn ghost" id="skip" style="margin-left:auto">Skip</button><button class="btn primary" id="next">Continue</button></div>`;
        $$("[data-r]", ob).forEach((b) => (b.onclick = () => { pick.region = b.dataset.r; $$("[data-r]", ob).forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
        mountIntro(ob);
      } else if (step === 1) {
        ob.innerHTML = `<h2>What can wait?</h2>
          <p class="lead">Pick what ShiftWatt can time for you.</p>
          <div class="options two">${DEVICES.map((d) => `<button class="option" data-d="${d.id}" aria-pressed="${pick.devs.has(d.id)}">${icon(d.icon)}${d.name}</button>`).join("")}</div>
          <div class="modal-foot">${dots}<button class="btn ghost" id="back" style="margin-left:auto">Back</button><button class="btn primary" id="next">Continue</button></div>`;
        $$("[data-d]", ob).forEach((b) => (b.onclick = () => { const id = b.dataset.d; pick.devs.has(id) ? pick.devs.delete(id) : pick.devs.add(id); b.setAttribute("aria-pressed", pick.devs.has(id)); }));
      } else {
        const delta = typicalDelta(pick.region);
        const yearKg = sum(DEVICES.filter((d) => pick.devs.has(d.id)).map((d) => d.runsPerWeek * 52 * d.kW * d.hours * delta * 0.6)) / 1000;
        ob.innerHTML = `<h2>You could avoid</h2>
          <div class="big tnum clean" style="margin-top:16px"><span id="ob-n">0</span><small>kg CO₂ a year</small></div>
          <p class="lead" style="margin-top:16px">Without buying anything or changing your routine.</p>
          <div class="modal-foot">${dots}<button class="btn ghost" id="back" style="margin-left:auto">Back</button><button class="btn primary" id="done">Get started</button></div>`;
        countUp($("#ob-n", ob), yearKg, (x) => Math.round(x).toLocaleString(), 900);
      }
      $("#next", ob)?.addEventListener("click", () => { step++; draw(); });
      $("#back", ob)?.addEventListener("click", () => { step--; draw(); });
      const finish = async () => {
        localStorage.setItem("sw_onboarded", "1");
        store.devices.forEach((d) => (d.auto = pick.devs.has(d.id)));
        close();
        if (pick.region !== store.region) { store.region = pick.region; showLoading(); await loadRegion(); }
        renderView();
      };
      $("#done", ob)?.addEventListener("click", finish);
      $("#skip", ob)?.addEventListener("click", finish);
    };
    draw();
  });
}

/* ============================== boot ============================== */
async function setRegion(id) {
  store.region = id;
  showLoading();
  await loadRegion();
  renderView(false);
}
function resetDemo() {
  localStorage.removeItem("sw_onboarded");
  localStorage.removeItem(STATE_KEY);
  location.hash = "#/today";
  location.reload();
}
$("#ff").onclick = fastForward;
$("#watch-intro").onclick = openIntro;
$("#reset").onclick = resetDemo;
$("#bell").onclick = (e) => { e.stopPropagation(); toggleInbox(); };
document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".bell-wrap")) toggleInbox(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleInbox(false); });
addEventListener("hashchange", () => { toggleInbox(false); renderView(); scrollTo({ top: 0 }); });

async function boot() {
  const saved = readState();
  if (saved) applySettings(saved);
  showLoading();
  await loadRegion();
  if (saved) applyRuns(saved);
  if (!store.notifs.length) seedNotifs();
  renderView();
  if (!localStorage.getItem("sw_onboarded")) onboarding();
}
boot();
})();
