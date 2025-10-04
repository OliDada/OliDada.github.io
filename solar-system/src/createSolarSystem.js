import { createSun } from './createSun.js';
import { createMercury } from './createMercury.js';
import { createVenus } from './createVenus.js';
import { createEarth } from './createEarth.js';
import { createMoon } from './createMoon.js';
import { createMars } from './createMars.js';
import { createJupiter } from './createJupiter.js';
import { createSaturn } from './createSaturn.js';
import { createUranus } from './createUranus.js';
import { createNeptune } from './createNeptune.js';
import { createPluto } from './createPluto.js';
import { createLighting } from './createLighting.js';
import * as THREE from "three";

export function createSolarSystemScene() {
  const scene = new THREE.Scene();

  // Milky Way background sphere
  const loader = new THREE.TextureLoader();
  const milkyWayTexture = loader.load('./textures/8k_stars_milky_way.jpg');
  const bgGeometry = new THREE.SphereGeometry(110000000, 64, 32);
  const bgMaterial = new THREE.MeshBasicMaterial({
    map: milkyWayTexture,
    side: THREE.BackSide
  });
  const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
  scene.add(bgMesh);

  // Create celestial bodies
  const sun = createSun();
  const mercury = createMercury(sun);
  const venus = createVenus(sun);
  const earth = createEarth(sun);
  const moon = createMoon(earth);
  const mars = createMars(sun);
  const jupiter = createJupiter(sun);
  const saturn = createSaturn(sun);
  const uranus = createUranus(sun);
  const neptune = createNeptune(sun);
  const pluto = createPluto(sun);

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

  // Lighting
  const lightingSystem = createLighting(sun);
  lightingSystem.lights.forEach(light => scene.add(light));

  return scene;
}
