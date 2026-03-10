import * as THREE from "three";
import { DragControls } from "three/addons/controls/DragControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/addons/renderers/CSS2DRenderer.js";

const canvas = document.getElementById("three-canvas");

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x020617, 1);

// 2D label renderer overlaid on top of WebGL canvas
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.left = "0";
labelRenderer.domElement.style.pointerEvents = "none";
document.getElementById("app").appendChild(labelRenderer.domElement);

// Scene & camera
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(6, 5, 8);
camera.lookAt(0, 0, 0);
scene.add(camera);

// Orbit controls so the user can move around the field
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.enablePan = true;
orbit.enableZoom = true;
orbit.minDistance = 3;
orbit.maxDistance = 20;
orbit.target.set(0, 0, 0);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 8, 6);
scene.add(dirLight);

// Axes helper
const axes = new THREE.AxesHelper(4);
scene.add(axes);

// Parameters
const baseLength = 3;
const origin = new THREE.Vector3(0, 0, 0);

// Initial vectors (normalized directions, scaled for display)
const defaultV = new THREE.Vector3(1, 0.6, 0).normalize().multiplyScalar(baseLength);
const defaultB = new THREE.Vector3(0, 0, 1).normalize().multiplyScalar(baseLength * 0.9);
const defaultF = new THREE.Vector3().crossVectors(defaultV, defaultB).normalize().multiplyScalar(baseLength);
const defaultVMag = defaultV.length();
const defaultBMag = defaultB.length();
const defaultCrossMag = defaultF.length(); // |v × B| in the default configuration

let v = defaultV.clone();
let B = defaultB.clone();
let F = defaultF.clone();

// Arrow helpers
const arrowHeadLength = 0.6;
const arrowHeadWidth = 0.3;

const vArrow = new THREE.ArrowHelper(
  v.clone().normalize(),
  origin,
  v.length(),
  0x38bdf8,
  arrowHeadLength,
  arrowHeadWidth
);
scene.add(vArrow);

const bArrow = new THREE.ArrowHelper(
  B.clone().normalize(),
  origin,
  B.length(),
  0x4ade80,
  arrowHeadLength,
  arrowHeadWidth
);
scene.add(bArrow);

const fArrow = new THREE.ArrowHelper(
  F.clone().normalize(),
  origin,
  F.length(),
  0xf97373,
  arrowHeadLength,
  arrowHeadWidth
);
scene.add(fArrow);

// Small spheres marking draggable tips for v and B (F is derived)
const tipGeometry = new THREE.SphereGeometry(0.12, 24, 24);

const vTipMaterial = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  emissive: 0x0f172a,
  metalness: 0.4,
  roughness: 0.25,
});
const vTip = new THREE.Mesh(tipGeometry, vTipMaterial);
vTip.position.copy(v);
scene.add(vTip);

const bTipMaterial = new THREE.MeshStandardMaterial({
  color: 0x4ade80,
  emissive: 0x0f172a,
  metalness: 0.4,
  roughness: 0.25,
});
const bTip = new THREE.Mesh(tipGeometry, bTipMaterial);
bTip.position.copy(B);
scene.add(bTip);

// Helper for creating HTML labels
function createLabel(text, extraClass) {
  const div = document.createElement("div");
  div.className = `vector-label ${extraClass}`;
  div.textContent = text;
  return div;
}

// Attach labels to the vector tips
const vLabelObject = new CSS2DObject(createLabel("v", "v-label"));
vLabelObject.position.set(0.2, 0.2, 0);
vTip.add(vLabelObject);

const bLabelObject = new CSS2DObject(createLabel("B", "b-label"));
bLabelObject.position.set(0.2, 0.2, 0);
bTip.add(bLabelObject);

// A small sphere that follows the tip of F, but is not draggable
const fTipMaterial = new THREE.MeshStandardMaterial({
  color: 0xf97373,
  emissive: 0x0f172a,
  metalness: 0.4,
  roughness: 0.25,
});
const fTip = new THREE.Mesh(tipGeometry, fTipMaterial);
fTip.position.copy(F);
scene.add(fTip);

const fLabelObject = new CSS2DObject(createLabel("F", "f-label"));
fLabelObject.position.set(0.2, 0.2, 0);
fTip.add(fLabelObject);

// Draggable objects (only v and B)
const draggableObjects = [vTip, bTip];

const dragControls = new DragControls(draggableObjects, camera, renderer.domElement);
dragControls.transformGroup = false;

// Magnitude readouts in the header
const vMagEl = document.getElementById("v-mag");
const bMagEl = document.getElementById("b-mag");
const fMagEl = document.getElementById("f-mag");

function updateMagnitudes() {
  if (vMagEl) vMagEl.textContent = v.length().toFixed(2);
  if (bMagEl) bMagEl.textContent = B.length().toFixed(2);
  if (fMagEl) fMagEl.textContent = F.length().toFixed(2);
}

// Update vectors while dragging
dragControls.addEventListener("drag", () => {
  updateFromVelocityAndField();
});

// Pause orbiting while dragging, resume afterwards
dragControls.addEventListener("dragstart", (event) => {
  orbit.enabled = false;
  if (event.object.material) {
    event.object.material.emissiveIntensity = 0.5;
  }
});

dragControls.addEventListener("dragend", (event) => {
  orbit.enabled = true;
  if (event.object.material) {
    event.object.material.emissiveIntensity = 0.2;
  }
});

function constrainTip(tip) {
  // Constrain tips to a reasonable radius and keep them away from the origin
  const maxRadius = 4;
  const minRadius = 0.5;
  const r = tip.position.length();
  if (r > maxRadius) {
    tip.position.multiplyScalar(maxRadius / r);
  } else if (r < minRadius) {
    tip.position.multiplyScalar(minRadius / (r || 1));
  }
}

function updateFromVelocityAndField() {
  // Constrain v and B tips
  constrainTip(vTip);
  constrainTip(bTip);

  // Update v and B from the tips
  v.copy(vTip.position);
  B.copy(bTip.position);

  // Ensure they are not degenerate; if nearly parallel or tiny, nudge B
  if (v.lengthSq() < 1e-3) v.set(1, 0, 0).multiplyScalar(baseLength);
  if (B.lengthSq() < 1e-3) B.set(0, 0, 1).multiplyScalar(baseLength * 0.9);

  // Compute Lorentz force direction: F ∝ v × B
  F.crossVectors(v, B);
  const crossMag = F.length();
  if (crossMag < 1e-3) {
    // If v and B are parallel, cross product ~ 0; just collapse the arrow
    fArrow.setLength(0.01, 0.01, 0.01);
    fTip.position.set(0, 0, 0);
  } else {
    const Fdir = F.clone().normalize();
    // Scale |F| relative to the default configuration so that increasing |v| or |B|
    // (or the angle between them) visually increases |F|.
    const relative = defaultCrossMag > 0 ? crossMag / defaultCrossMag : 1;
    const fLength = baseLength * relative;
    F.copy(Fdir.multiplyScalar(fLength));
    fArrow.setDirection(Fdir);
    fArrow.setLength(fLength, arrowHeadLength, arrowHeadWidth);
    fTip.position.copy(F);
  }

  // Update v and B arrows from their vectors
  vArrow.setDirection(v.clone().normalize());
  vArrow.setLength(v.length(), arrowHeadLength, arrowHeadWidth);

  bArrow.setDirection(B.clone().normalize());
  bArrow.setLength(B.length(), arrowHeadLength, arrowHeadWidth);

  updateMagnitudes();
}

// Reset vectors and arrows to their default configuration
function resetVectors() {
  v.copy(defaultV);
  B.copy(defaultB);
  F.copy(defaultF);

  vArrow.setDirection(v.clone().normalize());
  vArrow.setLength(v.length(), arrowHeadLength, arrowHeadWidth);
  vTip.position.copy(v);

  bArrow.setDirection(B.clone().normalize());
  bArrow.setLength(B.length(), arrowHeadLength, arrowHeadWidth);
  bTip.position.copy(B);

  fArrow.setDirection(F.clone().normalize());
  fArrow.setLength(F.length(), arrowHeadLength, arrowHeadWidth);
  fTip.position.copy(F);

  updateMagnitudes();
}

const resetBtn = document.getElementById("reset-btn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    resetVectors();
  });
}

// Initialize magnitude display on first load
updateMagnitudes();

// Ground grid for depth cues
const grid = new THREE.GridHelper(10, 10, 0x1e293b, 0x020617);
grid.position.y = -0.001;
scene.add(grid);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();

// Resize handling
window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
});

