import * as THREE from "three";
import getStarfield from './src/getStarfield.js';
import { createSun } from './src/createSun.js';
import { createMercury } from './src/createMercury.js';
import { createVenus } from './src/createVenus.js';
import { createEarth } from './src/createEarth.js';
import { createMoon } from './src/createMoon.js';
import { createMars } from "./src/createMars.js";
import { createJupiter } from "./src/createJupiter.js";
import { createSaturn } from "./src/createSaturn.js";
import { createUranus } from "./src/createUranus.js";
import { createNeptune } from "./src/createNeptune.js";
import { createPluto } from "./src/createPluto.js";
import { createLighting } from './src/createLighting.js';
import { createCameraControls } from './src/createCameraControls.js';

// Scene setup
const width = window.innerWidth;
const height = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000000000);
camera.position.z = 5;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true; // Enable shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
document.body.appendChild(renderer.domElement);

// Create celestial bodies
const sun = createSun();
const mercury = createMercury(sun); // Create Mercury orbiting the Sun
const venus = createVenus(sun); // Create Venus orbiting the Sun
const earth = createEarth(sun);
const moon = createMoon(earth); // Pass Earth to Moon so it can follow
const mars = createMars(sun);
const jupiter = createJupiter(sun);
const saturn = createSaturn(sun);
const uranus = createUranus(sun);
const neptune = createNeptune(sun);
const pluto = createPluto(sun);

// Camera controls (pass celestial bodies for focus shortcuts)
const cameraControls = createCameraControls(camera, renderer, {
  sun,
  mercury,
  venus,
  earth,
  moon, 
  mars,
  jupiter,
  saturn,
  uranus,
  neptune,
  pluto
});

// Add to scene
scene.add(sun.group);
scene.add(mercury.mesh);
scene.add(venus.mesh);
scene.add(earth.mesh);
scene.add(moon.group);
scene.add(mars.mesh);
scene.add(jupiter.mesh);
scene.add(saturn.mesh);
scene.add(uranus.mesh);
scene.add(neptune.mesh);
scene.add(pluto.mesh);


// Create and add lighting (using sun as light source)
const lightingSystem = createLighting(sun);
lightingSystem.lights.forEach(light => scene.add(light));

// Add starfield with multiple layers
const stars = getStarfield({ 
  numStars: 100000, 
  layers: 4 // Create 3 layers of stars for depth
});
scene.add(stars);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update camera controls
  cameraControls.update();
  
  // Update lighting to follow sun position
  lightingSystem.update();
  
  // Animate celestial bodies
  sun.animate();
  mercury.animate();
  venus.animate();
  earth.animate();
  moon.animate();
  mars.animate();
  jupiter.animate();
  saturn.animate();
  uranus.animate();
  pluto.animate();
  
  renderer.render(scene, camera);
}

animate();

// Handle window resize
function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);