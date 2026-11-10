/* ShiftWatt hero: a procedural landscape (wind, solar, a village on the grid) driven by the live forecast.
   landing.js owns the data and timeline and sends the selected half hour as a "sw:scrub" event:
   { hour, wind, solar, I } → time of day, turbine speed, panel glint, haze and the colour of the power flowing to the homes. */
import * as THREE from "three";

const canvas = document.getElementById("scene");
const hero = document.getElementById("hero");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- deterministic noise ---------- */
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { let f = 0, amp = 0.5, fr = 1; for (let i = 0; i < 5; i++) { f += amp * vnoise(x * fr, y * fr); fr *= 2.03; amp *= 0.5; } return f; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/* Flat valley in front (solar farm, village), rolling hills behind (turbines). */
function height(x, z) {
  const hills = Math.pow(fbm(x * 0.0055 + 3.1, z * 0.0055 - 1.7), 1.5) * 95;
  const far = smooth(-150, -300, z);
  return hills * (0.08 + 0.92 * far) + fbm(x * 0.03, z * 0.03) * 2.4 - 3;
}

/* ---------- time-of-day palette (hour → colours), interpolated with wrap-around ---------- */
const KEYS = [
  [0,    { top: 0x060b16, hor: 0x111c2c, sun: 0x000000, sunI: 0,   sky: 0x1d2a44, gnd: 0x05070a, hemi: 0.35 }],
  [5,    { top: 0x0d1630, hor: 0x2a2c44, sun: 0xff8a5c, sunI: 0,   sky: 0x2b3554, gnd: 0x0a0c10, hemi: 0.45 }],
  [6.5,  { top: 0x34507e, hor: 0xf0a477, sun: 0xffb27a, sunI: 1.2, sky: 0x8aa0c8, gnd: 0x3a3226, hemi: 0.75 }],
  [9,    { top: 0x2f6bb6, hor: 0xb9d6ee, sun: 0xfff1dc, sunI: 2.2, sky: 0xbcd7f0, gnd: 0x4a5a3a, hemi: 1.0 }],
  [15,   { top: 0x2c66b0, hor: 0xc4dbee, sun: 0xfff0d6, sunI: 2.1, sky: 0xbcd7f0, gnd: 0x4a5a3a, hemi: 1.0 }],
  [18,   { top: 0x2d4f86, hor: 0xf3b07a, sun: 0xffa25e, sunI: 1.4, sky: 0x9aa8c8, gnd: 0x3b2f22, hemi: 0.8 }],
  [19.5, { top: 0x18203c, hor: 0xc8583c, sun: 0xff6a3d, sunI: 0.3, sky: 0x4a4560, gnd: 0x120e0c, hemi: 0.5 }],
  [21,   { top: 0x08101e, hor: 0x18223a, sun: 0x000000, sunI: 0,   sky: 0x22304c, gnd: 0x06080b, hemi: 0.38 }],
  [24,   { top: 0x060b16, hor: 0x111c2c, sun: 0x000000, sunI: 0,   sky: 0x1d2a44, gnd: 0x05070a, hemi: 0.35 }],
];
const C = (hex) => new THREE.Color(hex);
const KEYC = KEYS.map(([h, k]) => [h, { ...k, top: C(k.top), hor: C(k.hor), sun: C(k.sun), sky: C(k.sky), gnd: C(k.gnd) }]);
function palette(hour) {
  let i = 1;
  while (i < KEYC.length - 1 && KEYC[i][0] < hour) i++;
  const [h0, a] = KEYC[i - 1], [h1, b] = KEYC[i];
  const t = Math.min(1, Math.max(0, (hour - h0) / (h1 - h0)));
  const mix = (k) => a[k].clone().lerp(b[k], t);
  const n = (k) => a[k] + (b[k] - a[k]) * t;
  return { top: mix("top"), hor: mix("hor"), sun: mix("sun"), sky: mix("sky"), gnd: mix("gnd"), sunI: n("sunI"), hemi: n("hemi") };
}

/* carbon colour scale, same stops as the app */
const STOPS = [[0, C(0x5be3a0)], [0.45, C(0xc8e66b)], [0.7, C(0xf2b84b)], [1, C(0xff7a59)]];
function carbonColor(I) {
  const t = Math.min(1, Math.max(0, I / 320));
  for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) return STOPS[i - 1][1].clone().lerp(STOPS[i][1], (t - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]));
  return STOPS[3][1].clone();
}

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: "high-performance" });
  } catch { return; } // no WebGL: the CSS sky behind the canvas stays
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fb8cc, 140, 760);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 2400);

  /* ---------- sky dome ---------- */
  const skyU = { top: { value: C(0x2f6bb6) }, hor: { value: C(0xb9d6ee) }, sunColor: { value: C(0xffffff) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunVis: { value: 1 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunColor; uniform vec3 sunDir; uniform float sunVis; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 col = mix(hor, top, smoothstep(-0.02, 0.5, h));
          float s = max(dot(vDir, normalize(sunDir)), 0.0);
          col += sunColor * sunVis * (pow(s, 900.0) * 3.0 + pow(s, 14.0) * 0.32 + pow(s, 3.0) * 0.08);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(1400 * 3);
  for (let i = 0; i < 1400; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(rand() * 0.92 + 0.08);
    starPos.set([Math.sin(ph) * Math.cos(th) * 1600, Math.cos(ph) * 1600, Math.sin(ph) * Math.sin(th) * 1600], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---------- light ---------- */
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(sun, sun.target);
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
  moon.position.set(-300, 400, 200);
  scene.add(moon);
  const hemi = new THREE.HemisphereLight(0xbcd7f0, 0x4a5a3a, 1);
  scene.add(hemi);

  /* ---------- terrain ---------- */
  const tGeo = new THREE.PlaneGeometry(2400, 1600, 220, 150);
  tGeo.rotateX(-Math.PI / 2);
  const pos = tGeo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const deep = C(0x274a2e), grass = C(0x45763f), light = C(0x7a9a52), wheat = C(0xb39d55), rock = C(0x7d7f72), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i) - 200;
    const y = height(x, z);
    pos.setXYZ(i, x, y, z);
    const field = vnoise(x * 0.018 + 9, z * 0.022 - 4);
    tmp.copy(deep).lerp(grass, smooth(-2, 18, y));
    if (z > -150 && field > 0.62) tmp.lerp(wheat, 0.55); // patchwork farmland in the valley
    else if (field < 0.22) tmp.lerp(light, 0.4);
    tmp.lerp(rock, smooth(55, 90, y));
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  tGeo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(terrain);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
  const place = (x, y, z, ry = 0, rx = 0, sc = 1) => { e.set(rx, ry, 0); q.setFromEuler(e); v3.set(x, y, z); s3.setScalar(sc); return m4.compose(v3, q, s3); };

  /* ---------- wind turbines (instanced; rotors update per frame) ---------- */
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f4f2 });
  const turbines = [];
  for (let i = 0; i < 26; i++) {
    const x = -420 + i * 34 + (rand() - 0.5) * 22;
    const z = -150 - rand() * 330 - (Math.abs(x) < 80 ? 40 : 0);
    turbines.push({ x, z, y: height(x, z) - 1, sc: 0.85 + rand() * 0.35, phase: rand() * 6.28, speedJitter: 0.85 + rand() * 0.3 });
  }
  turbines.push({ x: 120, z: -190, y: height(120, -190) - 1, sc: 1.1, phase: 1, speedJitter: 1 }, { x: 170, z: -230, y: height(170, -230) - 1, sc: 1.05, phase: 2, speedJitter: 0.95 });
  const YAW = -0.32;
  const towerGeo = new THREE.CylinderGeometry(0.5, 1.15, 42, 10).translate(0, 21, 0);
  const nacGeo = new THREE.BoxGeometry(2.2, 2.3, 6.5).translate(0, 42, -1);
  const hubGeo = new THREE.SphereGeometry(1.15, 14, 10).scale(1, 1, 1.4).translate(0, 42, 2.4);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.7, 0.6); bladeShape.lineTo(0.9, 2.6); bladeShape.lineTo(0.32, 23); bladeShape.lineTo(-0.05, 23.2); bladeShape.lineTo(-0.55, 4); bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.22, bevelEnabled: false }).translate(0, 0, -0.11);
  const towers = new THREE.InstancedMesh(towerGeo, white, turbines.length);
  const nacelles = new THREE.InstancedMesh(nacGeo, white, turbines.length);
  const hubs = new THREE.InstancedMesh(hubGeo, white, turbines.length);
  const blades = new THREE.InstancedMesh(bladeGeo, white, turbines.length * 3);
  blades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  turbines.forEach((t, i) => {
    const mtx = place(t.x, t.y, t.z, YAW, 0, t.sc);
    t.base = mtx.clone();
    towers.setMatrixAt(i, mtx); nacelles.setMatrixAt(i, mtx); hubs.setMatrixAt(i, mtx);
  });
  scene.add(towers, nacelles, hubs, blades);
  const hubOffset = new THREE.Matrix4().makeTranslation(0, 42, 2.6), rot = new THREE.Matrix4(), bm = new THREE.Matrix4();
  function updateRotors(dt, speed) {
    turbines.forEach((t, i) => {
      t.phase += dt * speed * t.speedJitter;
      for (let k = 0; k < 3; k++) {
        rot.makeRotationZ(t.phase + (k * Math.PI * 2) / 3);
        bm.multiplyMatrices(t.base, hubOffset).multiply(rot);
        blades.setMatrixAt(i * 3 + k, bm);
      }
    });
    blades.instanceMatrix.needsUpdate = true;
  }

  /* ---------- solar farm ---------- */
  const panelMat = new THREE.MeshPhongMaterial({ color: 0x24497e, specular: 0x5a7fb8, shininess: 60, emissive: 0x0a1830 });
  const rows = 10, colsN = 16, panelCount = rows * colsN;
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(5.6, 0.14, 3.1), panelMat, panelCount);
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1.7, 0.22).translate(0, 0.85, 0), new THREE.MeshLambertMaterial({ color: 0x5b6066 }), panelCount);
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < colsN; c++) {
    const x = -5 + c * 6.3, z = -138 + r * 6.4;
    const y = height(x, z);
    panels.setMatrixAt(n, place(x, y + 1.9, z, 0, 0.55)); // tilted toward the viewer (south)
    legs.setMatrixAt(n, place(x, y, z));
    n++;
  }
  scene.add(panels, legs);

  /* ---------- village ---------- */
  const houses = [];
  for (let i = 0; i < 16; i++) {
    const x = 62 + (i % 6) * 12 + (rand() - 0.5) * 6, z = -78 + Math.floor(i / 6) * 15 + (rand() - 0.5) * 6;
    houses.push({ x, z, y: height(x, z), ry: (rand() - 0.5) * 0.5, sc: 0.85 + rand() * 0.4 });
  }
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 4, 5).translate(0, 2, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), houses.length);
  const roof = new THREE.InstancedMesh(new THREE.CylinderGeometry(0, 4.7, 2.8, 4, 1).rotateY(Math.PI / 4).scale(1.05, 1, 0.9).translate(0, 5.4, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), houses.length);
  const winMat = new THREE.MeshBasicMaterial({ color: 0x2a3440 });
  const wins = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 1.1), winMat, houses.length * 2);
  const walls = [0xe9e2d4, 0xd8cfc0, 0xf1ece2, 0xcfc4b2], roofs = [0x8a4a3a, 0x5d4a44, 0x7a3e30, 0x4b4f55];
  houses.forEach((h, i) => {
    body.setMatrixAt(i, place(h.x, h.y - 0.2, h.z, h.ry, 0, h.sc)); body.setColorAt(i, C(walls[i % 4]));
    roof.setMatrixAt(i, place(h.x, h.y - 0.2, h.z, h.ry, 0, h.sc)); roof.setColorAt(i, C(roofs[(i * 3) % 4]));
    for (let k = 0; k < 2; k++) {
      const local = new THREE.Vector3((k ? 1.4 : -1.4) * h.sc, 2.2 * h.sc, 2.52 * h.sc).applyAxisAngle(new THREE.Vector3(0, 1, 0), h.ry);
      wins.setMatrixAt(i * 2 + k, place(h.x + local.x, h.y - 0.2 + local.y, h.z + local.z, h.ry));
    }
  });
  scene.add(body, roof, wins);

  /* ---------- pylons, wires and the power flowing into the village ---------- */
  const pylonPts = [[-40, -400], [10, -300], [55, -215], [92, -140], [100, -88]].map(([x, z]) => new THREE.Vector3(x, height(x, z), z));
  const steel = new THREE.MeshLambertMaterial({ color: 0x8e959a });
  const masts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 2.2, 30, 4, 1).rotateY(Math.PI / 4).translate(0, 15, 0), steel, pylonPts.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(13, 0.5, 0.5).translate(0, 26, 0), steel, pylonPts.length * 2);
  const heading = (i) => { const a = pylonPts[Math.max(0, i - 1)], b = pylonPts[Math.min(pylonPts.length - 1, i + 1)]; return Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2; };
  pylonPts.forEach((p, i) => {
    masts.setMatrixAt(i, place(p.x, p.y, p.z, heading(i)));
    arms.setMatrixAt(i * 2, place(p.x, p.y, p.z, heading(i)));
    arms.setMatrixAt(i * 2 + 1, place(p.x, p.y - 5, p.z, heading(i), 0, 0.8));
  });
  scene.add(masts, arms);
  const curves = [];
  for (let i = 0; i < pylonPts.length - 1; i++) {
    for (const [dx, dy] of [[-6, 26], [6, 26], [-4.8, 21]]) {
      const a = pylonPts[i], b = pylonPts[i + 1];
      const ha = heading(i), hb = heading(i + 1);
      const pa = new THREE.Vector3(a.x + Math.cos(ha) * dx, a.y + dy, a.z - Math.sin(ha) * dx);
      const pb = new THREE.Vector3(b.x + Math.cos(hb) * dx, b.y + dy, b.z - Math.sin(hb) * dx);
      const mid = pa.clone().lerp(pb, 0.5); mid.y -= 4.5;
      curves.push(new THREE.QuadraticBezierCurve3(pa, mid, pb));
    }
  }
  const wirePts = [];
  for (const cv of curves) { const pts = cv.getPoints(16); for (let k = 0; k < pts.length - 1; k++) wirePts.push(pts[k], pts[k + 1]); }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: 0x2b3134, transparent: true, opacity: 0.75 })));
  const PULSES = 90;
  const pulseT = Float32Array.from({ length: PULSES }, () => rand());
  const pulseC = Array.from({ length: PULSES }, (_, i) => i % curves.length);
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PULSES * 3), 3));
  const dotTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.25, "rgba(255,255,255,.8)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const pulseMat = new THREE.PointsMaterial({ size: 3.4, map: dotTex, color: 0x5be3a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(pulseGeo, pulseMat));
  function updatePulses(dt) {
    const arr = pulseGeo.attributes.position.array;
    for (let i = 0; i < PULSES; i++) {
      pulseT[i] = (pulseT[i] + dt * 0.55) % 1;
      // a pulse runs one span, then hops to the next span toward the village
      if (pulseT[i] < dt * 0.55) pulseC[i] = (pulseC[i] + 3) % curves.length;
      curves[pulseC[i]].getPoint(pulseT[i], v3);
      arr[i * 3] = v3.x; arr[i * 3 + 1] = v3.y; arr[i * 3 + 2] = v3.z;
    }
    pulseGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- clouds ---------- */
  const puffs = [];
  for (let c = 0; c < 11; c++) {
    const cx = -700 + rand() * 1400, cy = 150 + rand() * 90, cz = -350 - rand() * 600;
    for (let k = 0; k < 6; k++) puffs.push({ cx, x: (rand() - 0.5) * 60, y: cy + rand() * 10, z: cz + (rand() - 0.5) * 30, s: 12 + rand() * 16 });
  }
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.78, depthWrite: false });
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1).scale(1.6, 0.8, 1), cloudMat, puffs.length);
  clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(clouds);
  function updateClouds(dt, wind) {
    puffs.forEach((p, i) => {
      if (i % 6 === 0) p.cx += dt * (2 + wind * 10);
      const group = puffs[i - (i % 6)];
      if (group.cx > 800) group.cx = -800;
      clouds.setMatrixAt(i, place(group.cx + p.x, p.y, p.z, 0, 0, p.s));
    });
    clouds.instanceMatrix.needsUpdate = true;
  }

  /* ---------- state: eased toward whatever the timeline selects ---------- */
  const now = new Date();
  const target = { hour: now.getHours() + now.getMinutes() / 60, wind: 0.35, solar: 0.1, I: 180 };
  const cur = { ...target };
  addEventListener("sw:scrub", (ev) => Object.assign(target, ev.detail));

  const sunDir = new THREE.Vector3();
  const warmHaze = C(0x8a7458);
  function applyLook() {
    const p = palette(cur.hour);
    const a = ((cur.hour - 6) / 12) * Math.PI;
    sunDir.set(-Math.cos(a) * 0.85, Math.sin(a) * 0.95, -0.62).normalize();
    const day = smooth(-0.08, 0.25, sunDir.y);
    const night = 1 - smooth(-0.2, 0.05, sunDir.y);
    skyU.top.value.copy(p.top); skyU.hor.value.copy(p.hor);
    skyU.sunColor.value.copy(p.sun); skyU.sunDir.value.copy(sunDir); skyU.sunVis.value = smooth(-0.06, 0.02, sunDir.y);
    sun.color.copy(p.sun); sun.intensity = p.sunI;
    sun.position.copy(sunDir).multiplyScalar(500);
    moon.intensity = night * 0.55;
    hemi.color.copy(p.sky); hemi.groundColor.copy(p.gnd); hemi.intensity = p.hemi;
    starMat.opacity = night * 0.9;
    // dirtier hours read slightly hazier and warmer
    const dirty = Math.min(1, Math.max(0, (cur.I - 80) / 220));
    scene.fog.color.copy(p.hor).lerp(warmHaze, dirty * 0.3 * day);
    scene.fog.near = 150 - dirty * 70;
    scene.fog.far = 820 - dirty * 220;
    cloudMat.color.copy(p.hor).lerp(C(0xffffff), 0.55 * day + 0.1).multiplyScalar(0.35 + 0.65 * Math.max(day, 0.25));
    winMat.color.copy(C(0x27313b)).lerp(C(0xffc87a), night);
    pulseMat.color.copy(carbonColor(cur.I));
    pulseMat.opacity = 0.65 + night * 0.35;
    panelMat.shininess = 40 + day * 60;
    // panels pick up the sky by day and glow a little more when the forecast has real solar in it
    panelMat.emissive.copy(C(0x081426)).lerp(p.top, 0.35 * day).lerp(C(0x4f86d6), cur.solar * day * 0.5);
  }

  /* ---------- camera: slow drift, mouse parallax, scroll dolly ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!reduceMotion) addEventListener("pointermove", (ev) => { mouse.tx = ev.clientX / innerWidth - 0.5; mouse.ty = ev.clientY / innerHeight - 0.5; }, { passive: true });
  let scrollP = 0;
  addEventListener("scroll", () => { scrollP = Math.min(1, Math.max(0, scrollY / Math.max(1, hero.offsetHeight))); }, { passive: true });
  const look = new THREE.Vector3();
  function placeCamera(t) {
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    const drift = reduceMotion ? 0 : Math.sin(t * 0.05) * 6;
    const narrow = camera.aspect < 1 ? 1 : 0; // portrait: step back so the scene still reads
    camera.position.set(-10 + drift + mouse.x * 14, 17 + narrow * 6 - mouse.y * 6 + scrollP * 38, 138 + narrow * 40 - scrollP * 50);
    look.set(-6 + mouse.x * 5, 22 - scrollP * 12, -120);
    camera.lookAt(look);
  }

  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 50 : 36;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  /* ---------- loop: only while the hero is on screen and the tab is visible ---------- */
  let visible = true, running = false, last = performance.now(), first = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; kick(); }).observe(hero);
  document.addEventListener("visibilitychange", kick);
  function kick() { if (!running && visible && !document.hidden) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(tms) {
    if (!visible || document.hidden) { running = false; return; }
    const dt = Math.min(0.05, (tms - last) / 1000);
    last = tms;
    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent easing
    let dh = target.hour - cur.hour;
    if (dh > 12) dh -= 24; else if (dh < -12) dh += 24;
    cur.hour = (cur.hour + dh * k + 24) % 24;
    cur.wind += (target.wind - cur.wind) * k;
    cur.solar += (target.solar - cur.solar) * k;
    cur.I += (target.I - cur.I) * k;
    applyLook();
    const spin = (0.25 + cur.wind * 3.2) * (reduceMotion ? 0.3 : 1);
    updateRotors(dt, spin);
    updatePulses(reduceMotion ? dt * 0.3 : dt);
    updateClouds(dt, cur.wind);
    placeCamera(tms / 1000);
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    renderer.render(scene, camera);
    if (first) { first = false; canvas.classList.add("ready"); }
    requestAnimationFrame(frame);
  }
  kick();
}

init();
