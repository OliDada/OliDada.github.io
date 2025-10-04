// Fallback for missing updateSurfaceCamera to prevent ReferenceError
function updateSurfaceCamera() {
  // No-op or add camera update logic for surface mode here if needed
}
import * as THREE from "three";
import getStarfield from './src/getStarfield.js';
import { createSun } from './src/createSun.js';
import { createMercury } from './src/createMercury.js';
import { createVenus } from './src/createVenus.js';
import { createEarth } from './src/createEarth.js';
import { createOrbitReturnButton, updateOrbitReturnBtn } from './src/orbitReturnButton.js';
import { createMoon } from './src/createMoon.js';
import { createMars } from "./src/createMars.js";
import { createJupiter } from "./src/createJupiter.js";
import { createSaturn } from "./src/createSaturn.js";
import { createUranus } from "./src/createUranus.js";
import { createNeptune } from "./src/createNeptune.js";
import { createPluto } from "./src/createPluto.js";
import { createLighting } from './src/createLighting.js';
import { createCameraControls } from './src/createCameraControls.js';
import { SimplexNoise, createPlanetSurfaceScene } from './src/createPlanetSurface.js';
import {
  getTerrainHeight,
  getTerrainHeightAtCamera,
  getNearestGroundHeight,
  getInterpolatedGroundHeight
} from './src/terrainUtils.js';
import { animateCameraToEarthLanding } from './src/landingAnimation.js';
import {
  createLandingButton,
  updateLandingButtonVisibility,
  animateLandingBtn
} from './src/landingButton.js';

// Scene setup
const width = window.innerWidth;
const height = window.innerHeight;
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
const camera = new THREE.PerspectiveCamera(75, width / height, 0.01, 100000000);
camera.position.z = 50000; // Position camera far enough to see the solar system

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
const mercury = createMercury(sun); mercury.animate();
const venus = createVenus(sun); venus.animate();
const earth = createEarth(sun); earth.animate();
const moon = createMoon(earth); if (moon.animate) moon.animate();
const mars = createMars(sun); mars.animate();
const jupiter = createJupiter(sun); jupiter.animate();
const saturn = createSaturn(sun); saturn.animate();
const uranus = createUranus(sun); uranus.animate();
const neptune = createNeptune(sun); neptune.animate();
const pluto = createPluto(sun); if (pluto.animate) pluto.animate();

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
}, scene); // Pass scene for planet highlights

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

// Start by focusing on Earth
setTimeout(() => {
  // Simulate pressing key '3' to focus on Earth
  const earthFocusEvent = new KeyboardEvent('keydown', {
    code: 'Digit3',
    key: '3',
    bubbles: true
  });
  document.dispatchEvent(earthFocusEvent);
}, 100); // Small delay to ensure everything is loaded

let currentMode = 'orbit';
let surfaceScene = null;

const terrainSimplex = new SimplexNoise();

function triggerLanding(planetName) {
  currentMode = 'surface';
  surfaceScene = createPlanetSurfaceScene(planetName, terrainSimplex);
  // Camera starts near sky dome and floats down to surface
  const skyStartY = 12000;
  // Determine target Y based on planet radius (fall back to 10 if unknown)
  let planetRadius = 10;
  if (planetName === 'Earth' && earth && earth.mesh) {
    // earth.mesh is a Group; try to find the actual sphere child
    const sphereChild = earth.mesh.children ? earth.mesh.children.find(c => c.geometry && c.geometry.parameters && c.geometry.parameters.radius) : null;
    if (sphereChild && sphereChild.geometry && sphereChild.geometry.parameters && sphereChild.geometry.parameters.radius) {
      planetRadius = sphereChild.geometry.parameters.radius;
    }
  }
  // Target Y should be several times the planet radius to sit above the terrain, but not huge
  const surfaceTargetY = Math.max(60, planetRadius * 2);
  // Compute float speed so the descent takes ~5 seconds from skyStartY to surfaceTargetY
  const floatDownSpeed = Math.max(200, (skyStartY - surfaceTargetY) / 4);
  camera.position.set(0, skyStartY, 0);
  camera.lookAt(0, 0, 0);
  window._isFloatingDownToSurface = true;
  window._surfaceTargetY = surfaceTargetY;
  window._floatDownSpeed = floatDownSpeed;
  // If the surface scene exposed a water mesh, set up flattening parameters so we can
  // smoothly lerp the water vertices to the flat waterLevel during the float-down.
  if (surfaceScene && surfaceScene.userData && surfaceScene.userData.water) {
    // store the start Y and compute an estimated duration for flattening
    window._floatDownStartY = skyStartY;
    // duration = distance / speed; clamp to a sensible minimum
    window._floatDownDuration = Math.max(2.0, (skyStartY - surfaceTargetY) / floatDownSpeed);
    surfaceScene.userData._flattenStartTime = performance.now() / 1000;
    surfaceScene.userData._flattenDuration = window._floatDownDuration;
    // Compute a desired water level that's safely above the terrain at the landing point
    try {
      const terrainH = getInterpolatedGroundHeight(0, 0, surfaceScene) || 0;
      const currentWaterLevel = (surfaceScene.userData.water && surfaceScene.userData.water.material && surfaceScene.userData.water.material.uniforms && surfaceScene.userData.water.material.uniforms.waterLevel)
        ? surfaceScene.userData.water.material.uniforms.waterLevel.value
        : 20.0;
  const safetyMargin = 60.0; // units above terrain to avoid intersection
      const desired = Math.max(currentWaterLevel, terrainH + safetyMargin);
      surfaceScene.userData._desiredWaterLevel = desired;
      // If shader has uniform, set it so shader and geometry agree during flatten
      if (surfaceScene.userData.water && surfaceScene.userData.water.material && surfaceScene.userData.water.material.uniforms && surfaceScene.userData.water.material.uniforms.waterLevel) {
        surfaceScene.userData.water.material.uniforms.waterLevel.value = desired;
      }
      // Capture original Z positions so we can interpolate from them smoothly
      try {
        const waterMesh = surfaceScene.userData.water;
        if (waterMesh && waterMesh.geometry && waterMesh.geometry.attributes && waterMesh.geometry.attributes.position) {
          const positions = waterMesh.geometry.attributes.position;
          const orig = new Float32Array(positions.count);
          for (let i = 0; i < positions.count; i++) orig[i] = positions.getZ(i);
          surfaceScene.userData._waterOriginalZ = orig;
        }
      } catch (e) {
        // ignore
      }
      // Pause wave animation explicitly while we perform the float-down
      try { surfaceScene.userData._wavesPaused = true; } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore if sampling fails
    }
  }
}

function triggerTakeoff() {
  currentMode = 'orbit';
}


// Create landing button using helper
let isLandingInProgress = false;
const landingBtn = createLandingButton(() => {
  isLandingInProgress = true;
  landingBtn.textContent = 'Landing on Earth';
  landingBtn.disabled = true;
  landingBtn.style.background = 'linear-gradient(90deg, #888 0%, #bbb 100%)';
  landingBtn.style.color = '#444';
  landingBtn.style.boxShadow = 'none';
  animateCameraToEarthLanding(camera, renderer, earth, scene, () => {
    triggerLanding('Earth');
    isLandingInProgress = false;
    landingBtn.textContent = 'Land on Earth';
    landingBtn.disabled = false;
    landingBtn.style.background = 'linear-gradient(90deg, #0f2027 0%, #2c5364 100%)';
    landingBtn.style.color = '#FFD700';
    landingBtn.style.boxShadow = '0 0 24px 8px #00BFFF88, 0 0 8px 2px #FFD70088';
  });
});

// ...existing code...

let surfaceYaw = 0;
let surfacePitch = 0;
// Create orbit return button using helper
let isFloatingToOrbit = false;
let orbitReturnBtn = createOrbitReturnButton(() => {
  if (currentMode !== 'surface') return;
  isFloatingToOrbit = true;
});

function animateLandingBtnWithLandingState() {
  updateLandingButtonVisibility(landingBtn, camera, earth);
  updateOrbitReturnBtn(orbitReturnBtn, currentMode, surfacePitch);
  if (isLandingInProgress) {
    landingBtn.textContent = 'Landing on Earth';
    landingBtn.disabled = true;
    landingBtn.style.background = 'linear-gradient(90deg, #888 0%, #bbb 100%)';
    landingBtn.style.color = '#444';
    landingBtn.style.boxShadow = 'none';
  }
  requestAnimationFrame(animateLandingBtnWithLandingState);
}
animateLandingBtnWithLandingState();

// --- WASD movement for surface scene ---
let surfaceControlsEnabled = false;
let surfaceVelocity = new THREE.Vector3();
const surfaceSpeed = 10;
const keys = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', e => {
  if (currentMode === 'surface' || currentMode === 'orbit') {
    if (e.key === 'w') keys.w = true;
    if (e.key === 'a') keys.a = true;
    if (e.key === 's') keys.s = true;
    if (e.key === 'd') keys.d = true;
  }
});
window.addEventListener('keyup', e => {
  if (currentMode === 'surface' || currentMode === 'orbit') {
    if (e.key === 'w') keys.w = false;
    if (e.key === 'a') keys.a = false;
    if (e.key === 's') keys.s = false;
    if (e.key === 'd') keys.d = false;
  }
});

// --- Mouse look for surface scene ---

let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
const mouseLookSensitivity = 0.02; // Increased sensitivity

window.addEventListener('mousedown', e => {
  if (currentMode === 'surface') {
    isMouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});
window.addEventListener('mouseup', () => {
  isMouseDown = false;
});
window.addEventListener('mousemove', e => {
  if (currentMode === 'surface' && isMouseDown) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
  surfaceYaw -= dx * mouseLookSensitivity;
  surfacePitch -= dy * mouseLookSensitivity;
    surfacePitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, surfacePitch));
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});

// --- Arrow keys look for surface scene ---
let arrowLook = { left: false, right: false, up: false, down: false };
let arrowLookSpeed = 0.08; // increased radians per frame for faster rotation

document.addEventListener('keydown', (e) => {
  if (currentMode === 'surface' || currentMode === 'orbit') {
    if (e.code === 'ArrowLeft') arrowLook.left = true;
    if (e.code === 'ArrowRight') arrowLook.right = true;
    if (e.code === 'ArrowUp') arrowLook.up = true;
    if (e.code === 'ArrowDown') arrowLook.down = true;
  }
});

document.addEventListener('keyup', (e) => {
  if (currentMode === 'surface' || currentMode === 'orbit') {
    if (e.code === 'ArrowLeft') arrowLook.left = false;
    if (e.code === 'ArrowRight') arrowLook.right = false;
    if (e.code === 'ArrowUp') arrowLook.up = false;
    if (e.code === 'ArrowDown') arrowLook.down = false;
  }
});

// --- Terrain height sampling for camera ---
let cameraTargetY = null;
// ...existing code...

function debugTerrainHeight() {
  const meshHalfSize = 25000;
  let meshX = Math.max(-meshHalfSize, Math.min(meshHalfSize, camera.position.x));
  let meshY = Math.max(-meshHalfSize, Math.min(meshHalfSize, camera.position.z));
  const sampledHeight = getTerrainHeight(meshX, meshY);
  // Find nearest ground vertex
  let nearestVertex = null;
  let minDist = Infinity;
  function animate() {
    requestAnimationFrame(animate);
    if (window._isFloatingDownToSurface && currentMode === 'surface') {
      // Animate camera floating down to surface
      camera.position.y -= window._floatDownSpeed * (1/60);
      if (camera.position.y <= window._surfaceTargetY) {
        camera.position.y = window._surfaceTargetY;
        window._isFloatingDownToSurface = false;
      }
      camera.lookAt(0, 0, 0);
      renderer.render(surfaceScene, camera);
      return;
    }
    if (isFloatingToOrbit) {
      // Animate camera floating up
      const skyTargetY = 12000;
      const floatSpeed = 600;
      camera.position.y += floatSpeed * (1/60);
      if (camera.position.y >= skyTargetY) {
        camera.position.y = skyTargetY;
        isFloatingToOrbit = false;
        triggerTakeoff();
        if (cameraControls && cameraControls.focusOnObject) {
          cameraControls.focusOnObject(earth, 60);
        }
      }
      renderer.render(surfaceScene, camera);
      return;
    }
    if (currentMode === 'orbit') {
      // Animate planets every frame
      if (mercury.animate) mercury.animate();
      if (venus.animate) venus.animate();
      if (earth.animate) earth.animate();
      if (moon.animate) moon.animate();
      if (mars.animate) mars.animate();
      if (jupiter.animate) jupiter.animate();
      if (saturn.animate) saturn.animate();
      if (uranus.animate) uranus.animate();
      if (neptune.animate) neptune.animate();
      if (pluto.animate) pluto.animate();
      // Use cameraControls for orbit mode
      cameraControls.update();
      renderer.render(scene, camera);
    } else {
      updateSurfaceCamera();
      // Animate water waves
      if (surfaceScene && surfaceScene.userData.animateWater) {
        surfaceScene.userData.animateWater(performance.now() / 1000);
      }
      // Spin the sky dome slowly
      if (surfaceScene && surfaceScene.userData.skyDome) {
        surfaceScene.userData.skyDome.rotation.y += 0.00002;
      }
      renderer.render(surfaceScene, camera);
    }
  }

  animate();
  cameraTargetY = Math.max(cameraTargetY, terrainHeight + minCameraHeight);
  camera.position.y = cameraTargetY;
  // Smooth arrow key look-around
  if (arrowLook.left) surfaceYaw += arrowLookSpeed;
  if (arrowLook.right) surfaceYaw -= arrowLookSpeed;
  if (arrowLook.up) surfacePitch += arrowLookSpeed;
  if (arrowLook.down) surfacePitch -= arrowLookSpeed;
  // Clamp pitch
  surfacePitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, surfacePitch));
  // Mouse/arrow look
  const lookDir = new THREE.Vector3(
    Math.sin(surfaceYaw) * Math.cos(surfacePitch),
    Math.sin(surfacePitch),
    Math.cos(surfaceYaw) * Math.cos(surfacePitch)
  );
  camera.lookAt(camera.position.clone().add(lookDir));
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  if (isFloatingToOrbit) {
    // Animate camera floating up
    const skyTargetY = 12000;
  const floatSpeed = 1200;
    camera.position.y += floatSpeed * (1/60);
    if (camera.position.y >= skyTargetY) {
      camera.position.y = skyTargetY;
      isFloatingToOrbit = false;
      triggerTakeoff();
      if (cameraControls && cameraControls.focusOnObject) {
        cameraControls.focusOnObject(earth, 60);
      }
    }
    renderer.render(surfaceScene, camera);
    return;
  }
  if (currentMode === 'orbit') {
    // Animate planets every frame
    if (mercury.animate) mercury.animate();
    if (venus.animate) venus.animate();
    if (earth.animate) earth.animate();
    if (moon.animate) moon.animate();
    if (mars.animate) mars.animate();
    if (jupiter.animate) jupiter.animate();
    if (saturn.animate) saturn.animate();
    if (uranus.animate) uranus.animate();
    if (neptune.animate) neptune.animate();
    if (pluto.animate) pluto.animate();
    // Use cameraControls for orbit mode
    cameraControls.update();
    renderer.render(scene, camera);
  } else {
    // If floating down, skip updateSurfaceCamera
    if (window._isFloatingDownToSurface) {
      // Animate camera floating down to surface
      camera.position.y -= window._floatDownSpeed * (1/60);
      if (camera.position.y <= window._surfaceTargetY) {
        camera.position.y = window._surfaceTargetY;
        window._isFloatingDownToSurface = false;
        // Reset water mesh Z positions to waterLevel after landing
        if (surfaceScene && surfaceScene.userData.animateWater && surfaceScene.children) {
          const water = surfaceScene.children.find(obj => obj.material && obj.material.uniforms && obj.material.uniforms.waterLevel);
          if (water && water.geometry && water.geometry.attributes.position) {
            const positions = water.geometry.attributes.position;
            const waterLevel = water.material.uniforms.waterLevel.value;
            for (let i = 0; i < positions.count; i++) {
              positions.setZ(i, waterLevel);
            }
            positions.needsUpdate = true;
            water.geometry.computeVertexNormals();
          }
        }
        // Clear any flatten parameters set for the float-down
        if (surfaceScene && surfaceScene.userData) {
          delete surfaceScene.userData._flattenStartTime;
          delete surfaceScene.userData._flattenDuration;
        }
        // Resume wave animation now that landing has completed
        try { if (surfaceScene && surfaceScene.userData) surfaceScene.userData._wavesPaused = false; } catch (e) { /* ignore */ }
      }
      camera.lookAt(0, 0, 0);
      // Smoothly flatten water geometry during float-down to avoid ground peeking through
      if (surfaceScene && surfaceScene.userData && surfaceScene.userData.water && surfaceScene.userData._flattenStartTime) {
        const waterMesh = surfaceScene.userData.water;
        const positions = waterMesh.geometry.attributes.position;
        const now = performance.now() / 1000;
        const t0 = surfaceScene.userData._flattenStartTime;
        const dur = surfaceScene.userData._flattenDuration || 2.0;
        const linearT = Math.min(1, Math.max(0, (now - t0) / dur));
        // easeOutCubic
        const p = 1 - Math.pow(1 - linearT, 3);
        const desired = surfaceScene.userData._desiredWaterLevel || ((waterMesh.material && waterMesh.material.uniforms && waterMesh.material.uniforms.waterLevel) ? waterMesh.material.uniforms.waterLevel.value : 20.0);
        const orig = surfaceScene.userData._waterOriginalZ;
        if (orig && orig.length === positions.count) {
          for (let i = 0; i < positions.count; i++) {
            const z0 = orig[i];
            const newZ = z0 + (desired - z0) * p;
            positions.setZ(i, newZ);
          }
        } else {
          // Fallback: lerp from current positions
          for (let i = 0; i < positions.count; i++) {
            const z = positions.getZ(i);
            const newZ = z + (desired - z) * p;
            positions.setZ(i, newZ);
          }
        }
        positions.needsUpdate = true;
        try { waterMesh.geometry.computeVertexNormals(); } catch (e) { /* ignore */ }
        // If completed, snap to desired and clear stored data
        if (linearT >= 1) {
          for (let i = 0; i < positions.count; i++) positions.setZ(i, desired);
          positions.needsUpdate = true;
          try { waterMesh.geometry.computeVertexNormals(); } catch (e) { /* ignore */ }
          delete surfaceScene.userData._flattenStartTime;
          delete surfaceScene.userData._flattenDuration;
          delete surfaceScene.userData._waterOriginalZ;
          // keep _desiredWaterLevel so later logic can access if needed
        }
      }
      renderer.render(surfaceScene, camera);
      return;
    }
    // After landing, enable camera controls and movement
    // WASD movement
    if (currentMode === 'surface') {
      let moveX = 0, moveZ = 0;
  if (keys.w) { moveZ += 1; }
  if (keys.s) { moveZ -= 1; }
  if (keys.a) { moveX -= 1; }
  if (keys.d) { moveX += 1; }
      if (moveX !== 0 || moveZ !== 0) {
    // Calculate movement direction from the camera's forward vector projected to XZ
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
  // Compute right vector as forward x up so it points to the camera's right
  const upVec = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, upVec).normalize();
    let moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, moveZ);
    moveDir.addScaledVector(right, moveX);
        moveDir.normalize();
        // Clamp camera position to terrain mesh bounds
        const meshHalfSize = 25000;
        let newX = Math.max(-meshHalfSize, Math.min(meshHalfSize, camera.position.x + moveDir.x * surfaceSpeed));
        let newZ = Math.max(-meshHalfSize, Math.min(meshHalfSize, camera.position.z + moveDir.z * surfaceSpeed));
        camera.position.x = newX;
        camera.position.z = newZ;
  // After moving, update camera Y using bilinear interpolation of mesh heights
  camera.position.y = getInterpolatedGroundHeight(newX, newZ, surfaceScene) + 60;
      }
      // Arrow key look-around
      if (arrowLook.left) surfaceYaw += arrowLookSpeed;
      if (arrowLook.right) surfaceYaw -= arrowLookSpeed;
      if (arrowLook.up) surfacePitch += arrowLookSpeed;
      if (arrowLook.down) surfacePitch -= arrowLookSpeed;
      // Clamp pitch
      surfacePitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, surfacePitch));
      // Mouse/arrow look
      const lookDir = new THREE.Vector3(
        Math.sin(surfaceYaw) * Math.cos(surfacePitch),
        Math.sin(surfacePitch),
        Math.cos(surfaceYaw) * Math.cos(surfacePitch)
      );
      camera.lookAt(camera.position.clone().add(lookDir));
    }
    updateSurfaceCamera();
    // Animate water waves ONLY after landing
    if (!window._isFloatingDownToSurface && surfaceScene && surfaceScene.userData.animateWater) {
      surfaceScene.userData.animateWater(performance.now() / 1000);
    }
    // Spin the sky dome slowly
    if (surfaceScene && surfaceScene.userData.skyDome) {
      surfaceScene.userData.skyDome.rotation.y += 0.00002;
    }
    renderer.render(surfaceScene, camera);
  }
}

animate();

// Handle window resize
function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);

// Example usage:
// triggerLanding('Earth'); // Switch to landing scene
// triggerTakeoff(); // Return to orbit