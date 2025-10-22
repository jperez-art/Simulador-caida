// --- Importaciones ---
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GUI } from 'https://cdn.jsdelivr.net/npm/lil-gui@0.18/+esm';

// --- Variables globales ---
let scene, camera, renderer;
let ball, floor;
let velocity = 0;
const clock = new THREE.Clock();

// --- Parámetros configurables ---
const params = {
  planeta: 'Tierra',
  gravedad: 9.81,
  rebote: 0.8
};

// --- Configuración de escenarios ---
const escenarios = {
  Tierra: { color: 0x87CEEB, gravedad: 9.81 },
  Luna: { color: 0xdddddd, gravedad: 1.62 },
  Marte: { color: 0xb55333, gravedad: 3.71 },
  Saturno: { color: 0xd2b48c, gravedad: 10.44 }
};

// --- Función principal de inicio ---
function init() {
  // Escena
  scene = new THREE.Scene();

  // Cámara
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 3, 8);

  // Renderizador
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Luz principal
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);

  // Suelo
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
  floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Pelota
  const ballGeo = new THREE.SphereGeometry(0.5, 32, 32);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xff5555 });
  ball = new THREE.Mesh(ballGeo, ballMat);
  ball.position.y = 5;
  scene.add(ball);

  // GUI para control interactivo
  setupGUI();

  // Eventos
  window.addEventListener('resize', onWindowResize);

  // Primer escenario
  cambiarPlaneta(params.planeta);

  // Iniciar bucle de animación
  animate();
}

// --- Interfaz GUI ---
function setupGUI() {
  const gui = new GUI();
  gui.title('Configuración de Escenario');
  gui.add(params, 'planeta', Object.keys(escenarios))
    .name('Planeta')
    .onChange(cambiarPlaneta);
  gui.add(params, 'rebote', 0.1, 1).name('Coef. Rebote');
  gui.add(params, 'gravedad').name('Gravedad').listen().disable();
}

// --- Cambiar planeta (color + gravedad) ---
function cambiarPlaneta(nombre) {
  const e = escenarios[nombre];
  scene.background = new THREE.Color(e.color);
  params.gravedad = e.gravedad;

  // Reiniciar pelota
  velocity = 0;
  ball.position.y = 5;
}

// --- Bucle de animación ---
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Movimiento con gravedad
  velocity -= params.gravedad * delta;
  ball.position.y += velocity * delta;

  // Rebote con energía
  if (ball.position.y <= 0.5) {
    ball.position.y = 0.5;
    velocity = -velocity * params.rebote;
  }

  renderer.render(scene, camera);
}

// --- Ajuste de ventana ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Iniciar ---
init();
