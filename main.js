import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --------------------------- Setup Three.js ---------------------------
const canvasArea = document.getElementById('canvas-area');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
canvasArea.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, (window.innerWidth - 360) / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.update();

// Luces
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(5, 20, 10);
dir.castShadow = true;
scene.add(dir);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

// Suelo y esfera
const floor = new THREE.Mesh(
  new THREE.BoxGeometry(20, 20, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x2b6b2b, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.25;
floor.receiveShadow = true;
scene.add(floor);

// --- Texturas ---
const textureLoader = new THREE.TextureLoader();
const textureBall = textureLoader.load('textures/pelota.jpg');
const normalBall = textureLoader.load('textures/pelotaN.jpg');
const ballMaterial = new THREE.MeshPhongMaterial({
  map: textureBall,
  normalMap: normalBall,
  shininess: 100,
});

const ballMat = new THREE.MeshStandardMaterial({ color: 0x00e0ff, metalness: 0.1, roughness: 0.5 });
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), ballMaterial);
ball.castShadow = true;
scene.add(ball);


// Resize
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w - 360, h);
  camera.aspect = (w - 360) / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// --------------------------- UI ---------------------------
const q = (id) => document.getElementById(id);

const scenarioSelect = q('scenario');
const inputG = q('input-g');
const inputM = q('input-m');
const inputK = q('input-k');
const modelSelect = q('model'); 
const inputY0 = q('input-y0');
const inputV0 = q('input-v0');
const inputBounce = q('input-bounce');

const btnStart = q('btn-start');
const btnPause = q('btn-pause');
const btnReset = q('btn-reset');
const analysisBody = q('analysis-body');

const scenarios = {
  earth: { g: 9.81, k: 0.5, floorColor: 0x2b6b2b, bg: 0x87CEEB },
  moon:  { g: 1.62, k: 0.0, floorColor: 0x6b6b6b, bg: 0x9a9a9a },
  mars:  { g: 3.71, k: 0.2, floorColor: 0x8d3b2b, bg: 0xff8855 },
  gas:   { g: 25.0,k: 1.2, floorColor: 0xd2b48c, bg: 0xf0e0b0 },
  water: { g: 9.81, k: 3.0, floorColor: 0x334f6b, bg: 0x0f2b44 }
};

// --------------------------- Estado de simulación ---------------------------
let sim = {
  running: false,
  paused: false,
  t: 0,
  dt: 1/120,
  y: 10,
  v: 0,
  g: 9.81,
  m: 1.0,
  k: 0.5,
  bounce: 0.8,
  history: { t: [], y: [], v: [] },
  terminalSim: null
};

// --------------------------- Gráficos ---------------------------
const chartYCtx = q('chart-y').getContext('2d');
const chartVCtx = q('chart-v').getContext('2d');

const chartY = new Chart(chartYCtx, {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'y(t) [m]', data: [], borderColor: '#00aaff', tension: 0.2 }] },
  options: { animation: false, plugins: { legend: { display: false } }, scales: { x: {}, y: {} } }
});

const chartV = new Chart(chartVCtx, {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'v(t) [m/s]', data: [], borderColor: '#ff5252', tension: 0.2 }] },
  options: { animation: false, plugins: { legend: { display: true } }, scales: { x: {}, y: {} } }
});

// --------------------------- Funciones auxiliares ---------------------------
function setScenario(name) {
  const s = scenarios[name];
  inputG.value = s.g;
  inputK.value = s.k;
  inputM.value = 1.0;
  inputY0.value = 5;
  inputV0.value = 0;
  inputBounce.value = 0.8;

  // <- AÑADE ESTA LÍNEA para garantizar un modelo por defecto
  if (modelSelect) modelSelect.value = 'quadratic';

  floor.material.color.setHex(s.floorColor);
  scene.background = new THREE.Color(s.bg);
}


function resetSimulationState() {
  sim.running = false;
  sim.paused = false;
  sim.t = 0;
  sim.y = parseFloat(inputY0.value);
  sim.v = parseFloat(inputV0.value);
  sim.g = parseFloat(inputG.value);
  sim.m = parseFloat(inputM.value);
  sim.k = parseFloat(inputK.value);
  sim.bounce = parseFloat(inputBounce.value);
  sim.history = { t: [], y: [], v: [] };
  sim.terminalSim = null;
  analysisBody.innerHTML = 'Simulación lista. Pulsa <strong>Iniciar</strong>.';
  ball.position.set(0, sim.y / 1.2, 0);
  chartY.data.labels = [];
  chartY.data.datasets[0].data = [];
  chartV.data.labels = [];
  chartV.data.datasets[0].data = [];
  chartY.update();
  chartV.update();
}

function computeTheoreticalVt(m, g, k) {
  if (k <= 0) return Infinity;
  if (modelSelect && modelSelect.value === "linear") {
    return (m * g) / k;           // vt para arrastre lineal
  } else {
    return Math.sqrt((m * g) / k); // vt para arrastre cuadrático
  }
}

// --------------------------- Integración ---------------------------
function integrateStep(dt) {
  const v = sim.v;
  const g = sim.g;
  const k = sim.k;
  const m = sim.m;
  let dv;

  if (modelSelect && modelSelect.value === "linear") {
    // Modelo lineal: m dv/dt = mg - k v
    dv = g - (k / m) * v;
  } else {
    // Modelo cuadrático: m dv/dt = mg - k v |v|
    // (se usa v*|v| para que el drag siempre oponga la velocidad)
    dv = g - (k / m) * v * Math.abs(v);
  }

  const newV = v + dv * dt;
  const newY = sim.y - newV * dt;
  return { v: newV, y: newY };
}
// --------------------------- Loop principal ---------------------------
let lastFrame = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const elapsed = (now - lastFrame) / 1000;
  lastFrame = now;

  if (sim.running && !sim.paused) {
    const steps = Math.max(1, Math.floor(elapsed / sim.dt));
    for (let i = 0; i < steps; i++) {
      const { v: nv, y: ny } = integrateStep(sim.dt);
      sim.v = nv;
      sim.y = ny;
      sim.t += sim.dt;

      sim.history.t.push(sim.t);
      sim.history.y.push(sim.y);
      sim.history.v.push(sim.v);

  if (sim.terminalSim === null && sim.k > 0) {
    const vtTheory = computeTheoreticalVt(sim.m, sim.g, sim.k);
    // cuando la velocidad actual está cerca de la teórica, guardamos vt simulada
    if (isFinite(vtTheory)) {
      const dvAbs = Math.abs(vtTheory - Math.abs(sim.v)); // comparando magnitudes
      if (dvAbs < Math.max(0.5, 0.1 * vtTheory)) {
        sim.terminalSim = Math.abs(sim.v);
      }
    }
  }


      if (sim.y <= 0) {
        sim.y = 0;
        sim.v = -Math.abs(sim.v * sim.bounce);
        if (Math.abs(sim.v) < 0.05) {
          sim.v = 0;
          sim.running = false;
          finalizeAnalysis();
          break;
        }
      }
    }
    updateVisuals();
  }

  controls.update();
  renderer.render(scene, camera);
}

function updateVisuals() {
  ball.position.y = Math.max(0.6, sim.y / 1.2 + 0.6);
  const maxPoints = 1200;
  if (sim.history.t.length > maxPoints) {
    sim.history.t.shift(); sim.history.y.shift(); sim.history.v.shift();
  }
  chartY.data.labels = sim.history.t.map(x => x.toFixed(2));
  chartY.data.datasets[0].data = sim.history.y;
  chartV.data.labels = sim.history.t.map(x => x.toFixed(2));
  chartV.data.datasets[0].data = sim.history.v;
  chartY.update();
  chartV.update();
}

// --------------------------- Controles ---------------------------
btnStart.addEventListener('click', () => {
  sim.g = parseFloat(inputG.value);
  sim.m = parseFloat(inputM.value);
  sim.k = parseFloat(inputK.value);
  sim.bounce = parseFloat(inputBounce.value);
  sim.y = parseFloat(inputY0.value);
  sim.v = parseFloat(inputV0.value);
  sim.t = 0;
  sim.history = { t: [], y: [], v: [] };
  sim.running = true;
  sim.paused = false;
  btnPause.textContent = '▉ Pausar';
  analysisBody.innerHTML = 'Simulando...';
});

btnPause.addEventListener('click', () => {
  sim.paused = !sim.paused;
  btnPause.textContent = sim.paused ? '▶ Reanudar' : '▉ Pausar';
});

btnReset.addEventListener('click', () => {
  setScenario(scenarioSelect.value);
  resetSimulationState();
});

scenarioSelect.addEventListener('change', () => {
  setScenario(scenarioSelect.value);
  resetSimulationState();
});

// cuando se cambia el modelo, reiniciamos la simulación para evitar mezclar historiales
modelSelect.addEventListener('change', () => {
  resetSimulationState();
});



function finalizeAnalysis() {
  const timeTotal = sim.history.t.at(-1) || sim.t;
  const vImpact = sim.history.v.at(-1) || sim.v;
  const vtTheory = computeTheoreticalVt(sim.m, sim.g, sim.k);
  const vtSim = sim.terminalSim || 0;

  let kCalc = '—';
  if (vtSim > 0 && isFinite(vtSim)) {
    if (modelSelect && modelSelect.value === "linear") {
      // k = m g / vt  (lineal)
      kCalc = (sim.m * sim.g / vtSim).toFixed(4);
    } else {
      // k = m g / vt^2  (cuadrático)
      kCalc = (sim.m * sim.g / (vtSim * vtSim)).toFixed(4);
    }
  }

  analysisBody.innerHTML = `
    <strong>Tiempo total:</strong> ${timeTotal.toFixed(3)} s<br>
    <strong>Velocidad en impacto:</strong> ${vImpact.toFixed(3)} m/s<br>
    <strong>Velocidad terminal (teórica):</strong> ${isFinite(vtTheory) ? vtTheory.toFixed(4) + ' m/s' : 'No aplica (k=0)'}<br>
    <strong>Velocidad terminal (simulada):</strong> ${sim.terminalSim ? sim.terminalSim.toFixed(4) + ' m/s' : 'No alcanzada'}<br>
    <strong>k estimado:</strong> ${kCalc}<br>
    <strong>Modelo:</strong> ${modelSelect && modelSelect.value === "linear" ? "Lineal (kv)" : "Cuadrático (kv²)"}
  `;
}

// --------------------------- Inicialización ---------------------------
setScenario('earth');
resetSimulationState();
lastFrame = performance.now();
requestAnimationFrame(loop);
