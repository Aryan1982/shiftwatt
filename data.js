/* ShiftWatt grid data.
 * Great Britain uses the live NESO Carbon Intensity API (free, no key): 48h
 * forecast with generation mix per half hour. California and Texas use a
 * modeled generation mix (share × emission factor) because their free
 * forecast sources need accounts. If the live fetch fails, GB falls back to
 * its modeled curve and the UI says so. */

const SLOT_MIN = 30;
const SLOTS_PER_H = 60 / SLOT_MIN;
const PAST_H = 6;
const HORIZON_H = 48;

let clockOverride = null;
/* "Now" for the app: the real current half hour when live data is loaded,
 * otherwise a fixed 6:30 PM demo evening so the modeled story is stable. */
function demoNow() {
  if (clockOverride) return new Date(clockOverride);
  const d = new Date();
  d.setHours(18, 30, 0, 0);
  return d;
}
function setClock(d) { clockOverride = d ? d.getTime() : null; }

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* circular gaussian over hour-of-day */
function g(h, mu, s) {
  const dx = ((h - mu + 36) % 24) - 12;
  return Math.exp(-(dx * dx) / (2 * s * s));
}
/* linear gaussian over absolute hours */
function gl(x, mu, s) {
  const dx = x - mu;
  return Math.exp(-(dx * dx) / (2 * s * s));
}

const SOURCES = {
  solar:   { label: "Solar",       color: "#F7D154", clean: true },
  wind:    { label: "Wind",        color: "#7CC8F2", clean: true },
  hydro:   { label: "Hydro",       color: "#4F8EF7", clean: true },
  nuclear: { label: "Nuclear",     color: "#B49CFF", clean: true },
  battery: { label: "Battery",     color: "#5BE3A0", clean: true },
  other:   { label: "Geo/biomass", color: "#9AD17A", clean: true },
  imports: { label: "Imports",     color: "#8C9A92", clean: false },
  gas:     { label: "Gas",         color: "#F2A65A", clean: false },
  coal:    { label: "Coal",        color: "#E0644B", clean: false },
};

/* Each region returns { mix, factors } for an hour-of-day h, day index d,
 * absolute hour A (0 = start of series) and a seeded noise fn. */
const REGIONS = {
  caiso: {
    id: "caiso",
    name: "California",
    grid: "CAISO",
    currency: "$",
    place: "Berkeley, CA",
    plan: "PG&E EV2-A · time of use",
    model(h, d, A, rnd) {
      const D = 1 + 0.16 * g(h, 19.5, 2.2) + 0.05 * g(h, 8, 1.5) - 0.12 * g(h, 3.5, 3);
      const cloud = [0.95, 1.0, 0.72][d] ?? 0.9;
      const windDay = [1, 1.2, 0.9][d] ?? 1;
      const mix = {
        solar: (0.62 * g(h, 12.6, 2.6) * cloud) / D,
        wind: (0.06 + 0.05 * g(h, 21, 4)) * windDay * (0.92 + 0.16 * rnd()),
        hydro: 0.08 / D,
        nuclear: 0.085 / D,
        other: 0.05 / D,
        battery: 0.045 * g(h, 19.8, 1.4),
        imports: 0.07 + 0.03 * g(h, 20, 2),
        coal: 0,
      };
      const gasF = 410 + 130 * g(h, 19.5, 1.8);
      return { mix, factors: { gas: gasF, imports: 380, coal: 0 }, peaker: gasF > 470 };
    },
    tariff(h) {
      if (h >= 16 && h < 21) return 0.55;
      if ((h >= 15 && h < 16) || h >= 21) return 0.44;
      return 0.24;
    },
  },
  gb: {
    id: "gb",
    name: "Great Britain",
    grid: "GB",
    currency: "£",
    place: "Manchester, UK",
    plan: "Octopus Agile · half-hourly",
    model(h, d, A, rnd) {
      const D = 1 + 0.2 * g(h, 17.5, 2) + 0.08 * g(h, 8.5, 1.5) - 0.15 * g(h, 3.5, 3);
      const mix = {
        wind: (0.2 + 0.28 * gl(A, 20, 9) + 0.08 * gl(A, 44, 6)) * (0.94 + 0.12 * rnd()),
        nuclear: 0.14 / D,
        other: 0.06,
        solar: (0.1 * g(h, 12.3, 2)) / D,
        imports: 0.12,
        hydro: 0.02,
        battery: 0.02 * g(h, 17.5, 1.2),
        coal: 0,
      };
      return { mix, factors: { gas: 390 + 60 * g(h, 17.5, 1.6), imports: 150, coal: 0, other: 120 }, peaker: g(h, 17.5, 1.6) > 0.5 };
    },
    tariff(h, I) {
      return 0.08 + 0.0009 * I + (h >= 16 && h < 19 ? 0.12 : 0);
    },
  },
  ercot: {
    id: "ercot",
    name: "Texas",
    grid: "ERCOT",
    currency: "$",
    place: "Austin, TX",
    plan: "Austin Energy · Value Pricing",
    model(h, d, A, rnd) {
      const D = 1 + 0.18 * g(h, 19, 2.5) - 0.1 * g(h, 4, 3);
      const windDay = [1, 1.15, 0.9][d] ?? 1;
      const cloud = [1, 1, 0.8][d] ?? 1;
      const mix = {
        wind: (0.2 + 0.14 * g(h, 2, 4)) * windDay * (0.92 + 0.16 * rnd()),
        solar: 0.32 * g(h, 13.3, 2.5) * cloud,
        nuclear: 0.09 / D,
        coal: 0.15 / D,
        battery: 0.03 * g(h, 19.5, 1.3),
        hydro: 0,
        other: 0.01,
        imports: 0,
      };
      const gasF = 420 + 80 * g(h, 19, 2);
      return { mix, factors: { gas: gasF, imports: 0, coal: 1000 }, peaker: gasF > 470 };
    },
    tariff(h, I) {
      return 0.09 + 0.0003 * I + 0.1 * g(h, 19, 1.5);
    },
  },
};

function buildSlots(regionId) {
  const region = REGIONS[regionId];
  const rnd = mulberry32(regionId.length * 7919 + 17);
  const now = demoNow();
  const start = new Date(now.getTime() - PAST_H * 3600e3);
  const midnight0 = new Date(start); midnight0.setHours(0, 0, 0, 0);
  const n = (PAST_H + HORIZON_H) * SLOTS_PER_H;
  const slots = [];
  for (let k = 0; k < n; k++) {
    const t = new Date(start.getTime() + k * SLOT_MIN * 60e3);
    const h = t.getHours() + t.getMinutes() / 60 + 0.25;
    const d = Math.floor((t - midnight0) / 86400e3);
    const A = k / SLOTS_PER_H;
    const { mix: raw, factors, peaker } = region.model(h, d, A, rnd);
    let nonGas = 0;
    for (const s in raw) nonGas += raw[s];
    const surplus = nonGas > 0.9;
    const cap = 0.95;
    if (nonGas > cap) for (const s in raw) raw[s] *= cap / nonGas;
    const mix = { ...raw, gas: Math.max(0.05, 1 - Math.min(nonGas, cap)) };
    let I = 0;
    for (const s in mix) I += mix[s] * (factors[s] || 0);
    I = Math.round(I * (0.97 + 0.06 * rnd()));
    const marginal = surplus ? 12 : Math.round(factors.gas + (factors.coal && h < 6 ? 180 : 0));
    const price = +region.tariff(Math.floor(h), I).toFixed(3);
    slots.push({ t, h, d, I, marginal, price, mix, surplus, peaker });
  }
  return slots;
}

/* Live forecast sources. regionid 3 = North West England (Manchester). */
const LIVE = {
  gb: { regionId: 3, area: "North West England", source: "NESO Carbon Intensity API" },
};
const FUEL = { biomass: "other", other: "other", coal: "coal", imports: "imports", gas: "gas", nuclear: "nuclear", hydro: "hydro", solar: "solar", wind: "wind" };

async function fetchLiveSlots(regionId) {
  const cfg = LIVE[regionId];
  if (!cfg) return null;
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(now.getMinutes() < 30 ? 0 : 30);
  const from = new Date(now.getTime() - (PAST_H * 3600e3 + 30 * 60e3));
  const url = `https://api.carbonintensity.org.uk/regional/intensity/${from.toISOString().slice(0, 16)}Z/fw48h/regionid/${cfg.regionId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NESO API ${res.status}`);
  const rows = (await res.json()).data.data;
  const region = REGIONS[regionId];
  const all = rows.map((r) => {
    const t = new Date(r.from);
    const mix = {};
    for (const g of r.generationmix) { const k = FUEL[g.fuel] || "other"; mix[k] = (mix[k] || 0) + g.perc / 100; }
    const I = r.intensity.forecast;
    const renewable = (mix.wind || 0) + (mix.solar || 0) + (mix.hydro || 0);
    return {
      t, h: t.getHours() + t.getMinutes() / 60, I, mix,
      marginal: renewable > 0.6 ? 60 : 400,
      price: +region.tariff(t.getHours(), I).toFixed(3),
      surplus: false, peaker: false,
    };
  });
  const cur = all.findIndex((s) => s.t.getTime() <= now.getTime() && now.getTime() < s.t.getTime() + SLOT_MIN * 60e3);
  if (cur < PAST_H * SLOTS_PER_H || all.length - cur < 24 * SLOTS_PER_H) throw new Error("NESO forecast window too short");
  return { now: all[cur].t, slots: all.slice(cur - PAST_H * SLOTS_PER_H), ...cfg };
}

const NOW_IDX = PAST_H * SLOTS_PER_H;

/* Typical appliance draws and default deadlines (hours after demo "now"). */
const DEVICES = [
  { id: "ev", name: "EV charger", model: "Wallbox Pulsar Plus", via: "OCPP", icon: "car", kW: 7.2, hours: 2.5, readyBy: 13, auto: true, runsPerWeek: 3 },
  { id: "dish", name: "Dishwasher", model: "Bosch 300 Series", via: "Home Connect", icon: "dish", kW: 0.6, hours: 2, readyBy: 20.5, auto: true, runsPerWeek: 5 },
  { id: "wash", name: "Washer", model: "LG WM4000", via: "LG ThinQ", icon: "wash", kW: 0.5, hours: 1, readyBy: 23.5, auto: true, runsPerWeek: 4 },
  { id: "dry", name: "Dryer", model: "Whirlpool heat pump", via: "Whirlpool", icon: "dry", kW: 1.4, hours: 2, readyBy: 24, auto: false, runsPerWeek: 3 },
  { id: "water", name: "Water heater", model: "Rheem ProTerra", via: "Rheem EcoNet", icon: "water", kW: 1.0, hours: 3, readyBy: 22.5, auto: true, runsPerWeek: 7 },
  { id: "bike", name: "E-bike battery", model: "Kasa EP10 plug", via: "Kasa", icon: "bike", kW: 0.18, hours: 3.5, readyBy: 13.5, auto: false, runsPerWeek: 3 },
];

/* 60 days of completed shifts, deterministic. */
function buildHistory() {
  const rnd = mulberry32(4242);
  const now = demoNow();
  const plan = {
    ev:    { p: 0.42, dI: [80, 230] },
    dish:  { p: 0.75, dI: [60, 190] },
    wash:  { p: 0.55, dI: [50, 170] },
    dry:   { p: 0.4,  dI: [50, 170] },
    water: { p: 0.9,  dI: [30, 120] },
    bike:  { p: 0.3,  dI: [40, 150] },
  };
  const rows = [];
  for (let day = 60; day >= 1; day--) {
    for (const dev of DEVICES) {
      const cfg = plan[dev.id];
      if (rnd() > cfg.p) continue;
      const kWh = +(dev.kW * dev.hours * (0.85 + 0.3 * rnd())).toFixed(2);
      const baseI = 240 + rnd() * 90;
      const dI = cfg.dI[0] + rnd() * (cfg.dI[1] - cfg.dI[0]);
      const shiftedI = baseI - dI;
      const at = new Date(now.getTime() - day * 86400e3);
      at.setHours(dev.id === "ev" || dev.id === "water" ? 2 + Math.floor(rnd() * 4) : 10 + Math.floor(rnd() * 5), rnd() < 0.5 ? 0 : 30);
      const marginalDI = dI * (1.15 + rnd() * 0.5);
      rows.push({
        device: dev.id,
        at,
        kWh,
        baseI: Math.round(baseI),
        shiftedI: Math.round(shiftedI),
        kg: (kWh * dI) / 1000,
        kgMarginal: (kWh * marginalDI) / 1000,
        cost: kWh * (0.08 + rnd() * 0.18),
      });
    }
  }
  return rows;
}

const CAMPUS = {
  school: "Northbridge University",
  halls: [
    { name: "Maple Hall", students: 412, active: 318, kg: 1284 },
    { name: "Harbor House", students: 286, active: 201, kg: 1012 },
    { name: "Cedar Tower", students: 540, active: 296, kg: 961 },
    { name: "Oak Commons", students: 364, active: 172, kg: 702 },
    { name: "Linden Court", students: 198, active: 121, kg: 538 },
    { name: "Birch Quad", students: 455, active: 141, kg: 433 },
  ],
  myHall: "Maple Hall",
};

/* EPA Greenhouse Gas Equivalencies Calculator constants. */
const EQUIV = {
  kgPerMile: 0.393,
  kgPerSeedling10y: 60,
};

window.SW = { SLOT_MIN, SLOTS_PER_H, NOW_IDX, HORIZON_H, SOURCES, REGIONS, DEVICES, CAMPUS, EQUIV, LIVE, buildSlots, buildHistory, demoNow, setClock, fetchLiveSlots };
