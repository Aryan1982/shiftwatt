/* ShiftWatt landing: live NESO forecast (North West England, same region as the app's GB home),
   the hero timeline that drives the 3D scene, the optimizer demo, and light scroll motion. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NESO = "https://api.carbonintensity.org.uk";
const REGION = 3; // North West England
const SLOT_MS = 30 * 60e3;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Same appliance figures as the app's device list (data.js)
const LOADS = {
  ev: { name: "EV charge", kW: 7.2, hours: 2.5 },
  dish: { name: "Dishwasher", kW: 0.6, hours: 2 },
  wash: { name: "Laundry", kW: 0.5, hours: 1 },
};
const ui = { load: "ev", dead: "morning", idx: 0 };
let slots = []; // [{ t, I, wind, solar }] one per half hour, starting with the current one

/* ---------- formatting ---------- */
const STOPS = [[0, [91, 227, 160]], [0.45, [200, 230, 107]], [0.7, [242, 184, 75]], [1, [255, 122, 89]]];
function tone(I) {
  const t = Math.min(1, Math.max(0, I / 320));
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i], [a, ca] = STOPS[i - 1];
    if (t <= b) { const k = (t - a) / (b - a); return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",")})`; }
  }
  return "rgb(255,122,89)";
}
const fmtT = (t) => t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function dayLabel(t) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(t); b.setHours(0, 0, 0, 0);
  const d = Math.round((b - a) / 86400e3);
  return d === 0 ? "Today" : d === 1 ? "Tomorrow" : t.toLocaleDateString([], { weekday: "long" });
}
const when = (t) => `${dayLabel(t)} ${fmtT(t)}`;

/* ---------- data ---------- */
async function get(path) {
  const res = await fetch(NESO + path, { signal: AbortSignal.timeout(9000), cache: "no-store" });
  if (!res.ok) throw new Error(`NESO ${path} → HTTP ${res.status}`);
  return (await res.json()).data;
}
async function loadForecast() {
  const start = new Date(Date.now() - SLOT_MS); // include the half hour we're in
  const data = await get(`/regional/intensity/${start.toISOString().slice(0, 16)}Z/fw48h/regionid/${REGION}`);
  const now = Date.now();
  const share = (mix, fuel) => mix.find((m) => m.fuel === fuel)?.perc ?? 0;
  slots = data.data
    .map((r) => ({ t: new Date(r.from), end: new Date(r.to), I: r.intensity.forecast, wind: share(r.generationmix, "wind"), solar: share(r.generationmix, "solar") }))
    .filter((s) => s.end.getTime() > now && Number.isFinite(s.I));
}

/* ---------- optimizer: every start time before the deadline, lowest mean intensity wins ---------- */
function windowMean(s, len) { let m = 0; for (let k = 0; k < len; k++) m += slots[s + k].I; return m / len; }
function bestWindow(len, deadline) {
  let best = null;
  for (let s = 0; s + len <= deadline; s++) { const I = windowMean(s, len); if (!best || I < best.I) best = { s, e: s + len, I }; }
  return best;
}
function deadlineIdx(len) {
  if (ui.dead === "24") return Math.min(slots.length, 48);
  if (ui.dead === "48") return slots.length;
  const t = new Date(); t.setHours(7, 0, 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
  let idx = Math.floor((t - slots[0].t) / SLOT_MS);
  if (idx < len) idx += 48; // too close to 7 AM to finish: next morning
  return Math.min(slots.length, idx);
}

/* ---------- hero: HUD + timeline (drives the 3D scene) ---------- */
function verdict(i) {
  const f = slots.map((s) => s.I), min = Math.min(...f), max = Math.max(...f);
  const lvl = (slots[i].I - min) / (max - min || 1);
  if (lvl < 0.33) return { text: "A clean hour. Run things.", cls: "clean" };
  // relative to the next two days, but under 100 g is never called dirty (same rule as the app)
  if (lvl < 0.66 || slots[i].I < 100) return { text: "So-so. Worth waiting a bit.", cls: "mid" };
  return { text: "A dirty hour. Wait if you can.", cls: "dirty" };
}
function selectSlot(i) {
  ui.idx = i;
  const s = slots[i];
  $("#hud-when").textContent = i === 0 ? `Live now · North West England` : `${when(s.t)} · forecast`;
  const big = $("#hud-I");
  big.textContent = Math.round(s.I);
  big.style.color = tone(s.I);
  const v = verdict(i);
  const vEl = $("#hud-verdict");
  vEl.textContent = v.text; vEl.dataset.v = v.cls;
  const cur = $("#tl-cursor");
  cur.style.left = `${((i + 0.5) / slots.length) * 100}%`;
  cur.dataset.label = i === 0 ? "Now" : `${dayLabel(s.t).slice(0, 3)} ${fmtT(s.t)}`;
  const hour = s.t.getHours() + s.t.getMinutes() / 60 + 0.25;
  dispatchEvent(new CustomEvent("sw:scrub", { detail: { hour, wind: s.wind / 100, solar: s.solar / 100, I: s.I } }));
}
function renderTimeline() {
  const n = slots.length, max = Math.max(...slots.map((s) => s.I), 50);
  const best = bestWindow(6, Math.min(n, 48));
  $("#tl-bars").innerHTML = slots.map((s) => `<i style="height:${Math.max(6, (s.I / max) * 100)}%;background:${tone(s.I)}"></i>`).join("");
  const bw = $("#tl-best");
  bw.style.left = `${(best.s / n) * 100}%`;
  bw.style.width = `${((best.e - best.s) / n) * 100}%`;
  bw.dataset.label = `Cleanest 3h · ${Math.round(best.I)} g`;
  const ticks = [0, 12, 24, 36, 48, 60, 72, 84].filter((i) => i < n);
  $("#tl-axis").innerHTML = ticks.map((i) => `<span style="left:${(i / n) * 100}%">${i === 0 ? "Now" : `${dayLabel(slots[i].t).slice(0, 3)} ${fmtT(slots[i].t)}`}</span>`).join("");
  $("#timeline").hidden = false;
  return best;
}
let playing = null;
function stopPlay() { if (playing) { cancelAnimationFrame(playing); playing = null; $("#tl-play").setAttribute("aria-pressed", "false"); } }
function play(ms = 11000) {
  stopPlay();
  const n = slots.length, t0 = performance.now();
  $("#tl-play").setAttribute("aria-pressed", "true");
  const step = (t) => {
    // the first rAF timestamp can be slightly earlier than t0
    const p = Math.min(1, Math.max(0, (t - t0) / ms));
    const i = Math.min(n - 1, Math.floor(p * n));
    if (i !== ui.idx) selectSlot(i);
    if (p < 1) playing = requestAnimationFrame(step);
    else { playing = null; $("#tl-play").setAttribute("aria-pressed", "false"); selectSlot(0); }
  };
  playing = requestAnimationFrame(step);
}
function wireTimeline() {
  const track = $("#tl-track");
  const idxAt = (x) => { const r = track.getBoundingClientRect(); return Math.min(slots.length - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * slots.length))); };
  let dragging = false;
  track.addEventListener("pointerdown", (e) => { stopPlay(); dragging = true; track.setPointerCapture(e.pointerId); selectSlot(idxAt(e.clientX)); });
  track.addEventListener("pointermove", (e) => { if (dragging) selectSlot(idxAt(e.clientX)); });
  track.addEventListener("pointerup", () => (dragging = false));
  track.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1, Home: -1e3, End: 1e3 }[e.key];
    if (d == null) return;
    e.preventDefault(); stopPlay();
    selectSlot(Math.min(slots.length - 1, Math.max(0, ui.idx + d)));
  });
  $("#tl-play").onclick = () => (playing ? stopPlay() : play());
}

/* ---------- optimizer demo ---------- */
// Ink bars on paper; only the two windows that matter get colour.
function bars({ height, until, now, best }) {
  const n = slots.length, W = n * 10, H = height;
  const max = Math.max(...slots.map((s) => s.I), 50) * 1.08;
  const inWin = (i, w) => i >= w.s && i < w.e;
  const grid = [100, 200, 300].filter((g) => g < max).map((g) => {
    const y = H - (g / max) * H;
    return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#171814" stroke-opacity=".12" stroke-dasharray="2 4" vector-effect="non-scaling-stroke"/>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${grid}
    ${slots.map((s, i) => {
      const h = Math.max(2, (s.I / max) * H);
      const fill = inWin(i, best) ? "#1d7a4c" : inWin(i, now) ? "#c9501c" : "#171814";
      const op = inWin(i, best) || inWin(i, now) ? 1 : i >= until ? 0.07 : 0.2;
      return `<rect x="${i * 10 + 1.5}" y="${H - h}" width="7" height="${h}" fill="${fill}" opacity="${op}"/>`;
    }).join("")}
    ${until < n ? `<line x1="${until * 10}" x2="${until * 10}" y1="0" y2="${H}" stroke="#171814" stroke-opacity=".55" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ""}
  </svg>`;
}
function renderDemo() {
  const load = LOADS[ui.load];
  const len = Math.round(load.hours * 2);
  const until = deadlineIdx(len);
  const now = { s: 0, e: len, I: windowMean(0, len) };
  const best = bestWindow(len, until);
  const n = slots.length;
  $("#d-chart").innerHTML = bars({ height: 260, until, now, best });
  const ticks = [0, 12, 24, 36, 48, 60, 72, 84].filter((i) => i < n);
  $("#d-axis").innerHTML = ticks.map((i) => `<span style="left:${(i / n) * 100}%">${i === 0 ? "now" : `${dayLabel(slots[i].t).slice(0, 3).toLowerCase()} ${fmtT(slots[i].t)}`}</span>`).join("");
  // hand-drawn note points at the middle of the winning window
  const mid = ((best.s + best.e) / 2 / n) * 100;
  const anno = $("#d-anno");
  anno.style.left = `${mid}%`;
  anno.classList.toggle("flip", mid < 28);
  const kWh = load.kW * load.hours;
  const kgNow = (kWh * now.I) / 1000, kgBest = (kWh * best.I) / 1000;
  const less = Math.max(0, Math.round((1 - best.I / now.I) * 100));
  const kg = (v) => `${v.toFixed(v < 1 ? 2 : 1)} kg`;
  $("#r-now").textContent = kg(kgNow);
  $("#r-when").textContent = best.s === 0 ? "right away" : `${dayLabel(slots[best.s].t).toLowerCase()} at ${fmtT(slots[best.s].t)}`;
  $("#r-best").textContent = kg(kgBest);
  $("#r-pct").textContent = `${less}%`;
}

async function renderRegions() {
  try {
    const data = await get("/regional");
    const regions = data[0].regions.filter((r) => r.regionid <= 14); // 15-18 are country/GB totals
    const sorted = [...regions].sort((a, b) => a.intensity.forecast - b.intensity.forecast);
    const lo = sorted[0], hi = sorted[sorted.length - 1];
    $("#rg-lo").textContent = lo.intensity.forecast;
    $("#rg-hi").textContent = hi.intensity.forecast;
    $("#rg-names").textContent = `${lo.shortname} and ${hi.shortname}`;
  } catch { /* keep the 4 Nov 2026 snapshot already in the page */ }
}

let booted = false;
async function refresh() {
  try {
    await loadForecast();
    if (slots.length < 12) throw new Error("forecast too short");
    renderTimeline();
    renderDemo();
    if (!booted) {
      booted = true;
      wireTimeline();
      selectSlot(0);
      // one time-lapse through the next two days, then back to now
      if (!reduceMotion) setTimeout(() => { if (scrollY < innerHeight * 0.5) play(); }, 1600);
    } else if (!playing) selectSlot(Math.min(ui.idx, slots.length - 1));
  } catch (err) {
    console.warn("Live forecast unavailable:", err);
    $("#hud-verdict").textContent = "The live forecast didn't load on this network.";
  }
  renderRegions();
}

/* ---------- controls ---------- */
function seg(id, attr, onChange) {
  $$(`#${id} button`).forEach((b) => (b.onclick = () => {
    $$(`#${id} button`).forEach((x) => x.setAttribute("aria-pressed", x === b));
    onChange(b.dataset[attr]);
  }));
}
seg("d-load", "k", (v) => { ui.load = v; if (slots.length) renderDemo(); });
seg("d-dead", "h", (v) => { ui.dead = v; if (slots.length) renderDemo(); });
const plug = { state: "waiting", standard: "us" };
const sendPlug = () => $("#plug3d").contentWindow?.postMessage({ type: "shiftwatt-plug", device: "wash", ...plug }, "*");
seg("p-state", "v", (v) => { plug.state = v; sendPlug(); });

/* ---------- film: muted moving preview once it's on screen, full player with sound on click ---------- */
const film = $("#film-player");
const yt = (params) => `https://www.youtube-nocookie.com/embed/${film.dataset.yt}?${params}&rel=0&modestbranding=1&playsinline=1&cc_load_policy=0&iv_load_policy=3`;
function startPreview() {
  const f = document.createElement("iframe");
  f.className = "preview";
  f.src = yt(`autoplay=1&mute=1&controls=0&disablekb=1&loop=1&playlist=${film.dataset.yt}&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`);
  f.allow = "autoplay; encrypted-media";
  f.tabIndex = -1;
  f.setAttribute("aria-hidden", "true");
  // The film already has burned-in subtitles; switch off YouTube's caption track so they don't double up.
  const cmd = (func, args = []) => f.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  f.onload = () => {
    [300, 1000, 2000, 3500].forEach((ms) => setTimeout(() => { cmd("unloadModule", ["captions"]); cmd("unloadModule", ["cc"]); }, ms));
    // let YouTube get past its title card before fading the preview in
    setTimeout(() => film.classList.add("previewing"), 1200);
  };
  $(".poster", film).after(f);
}
if (!reduceMotion && "IntersectionObserver" in window) {
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); startPreview(); } }, { threshold: 0.35 }).observe(film);
}
$(".video-hit", film).onclick = () => {
  film.classList.add("playing");
  film.innerHTML = `<iframe src="${yt("autoplay=1")}" title="ShiftWatt film" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
};

/* ---------- nav turns solid after the hero ---------- */
const nav = $(".nav");
const onScroll = () => nav.classList.toggle("solid", scrollY > innerHeight * 0.6);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- motion: entrances, count-ups, parallax ---------- */
if (!reduceMotion && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    io.unobserve(e.target);
    $$("[data-count]", e.target).forEach(countUp);
  }), { rootMargin: "0px 0px -10% 0px" });
  $$(".band > *, .final > *").forEach((el) => { el.classList.add("reveal"); io.observe(el); });

  // elements with data-speed drift against the scroll; the hero copy lifts and fades as you leave it
  const layers = $$("[data-speed]");
  const heroCopy = $(".hero-copy"), hud = $(".hud");
  let ticking = false;
  const parallax = () => {
    ticking = false;
    const vh = innerHeight;
    for (const el of layers) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const off = (r.top + r.height / 2 - vh / 2) * +el.dataset.speed;
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    }
    const p = Math.min(1, scrollY / vh);
    heroCopy.style.transform = `translate3d(0, ${(p * -90).toFixed(1)}px, 0)`;
    heroCopy.style.opacity = String(1 - p * 1.3);
    hud.style.transform = `translate3d(0, ${(p * -40).toFixed(1)}px, 0)`;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });
  parallax();
}
function countUp(el) {
  const to = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length, t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 1100), k = 1 - Math.pow(1 - p, 3);
    el.textContent = (to * k).toFixed(dec);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

refresh();
setInterval(refresh, 5 * 60e3);
})();
