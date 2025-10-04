// src/landingButton.js
import * as THREE from 'three';

export function createLandingButton(onClick) {
  const landingBtn = document.createElement('button');
  landingBtn.textContent = 'Land on Earth';
  landingBtn.style.position = 'fixed';
  landingBtn.style.left = '50%';
  landingBtn.style.bottom = '40px';
  landingBtn.style.transform = 'translateX(-50%)';
  landingBtn.style.zIndex = '1000';
  landingBtn.style.padding = '16px 40px';
  landingBtn.style.fontSize = '24px';
  landingBtn.style.display = 'none';
  landingBtn.style.background = 'linear-gradient(90deg, #0f2027 0%, #2c5364 100%)';
  landingBtn.style.color = '#FFD700';
  landingBtn.style.border = '2px solid #00BFFF';
  landingBtn.style.borderRadius = '30px';
  landingBtn.style.boxShadow = '0 0 24px 8px #00BFFF88, 0 0 8px 2px #FFD70088';
  landingBtn.style.letterSpacing = '2px';
  landingBtn.style.textShadow = '0 0 8px #FFD700, 0 0 2px #00BFFF';
  landingBtn.style.fontFamily = 'Orbitron, Arial, sans-serif';
  landingBtn.style.transition = 'background 0.3s, box-shadow 0.3s, color 0.3s';
  landingBtn.onmouseover = () => {
    landingBtn.style.background = 'linear-gradient(90deg, #1a2980 0%, #26d0ce 100%)';
    landingBtn.style.color = '#FFFFFF';
    landingBtn.style.boxShadow = '0 0 32px 12px #26d0ce88, 0 0 12px 4px #FFD70088';
  };
  landingBtn.onmouseout = () => {
    landingBtn.style.background = 'linear-gradient(90deg, #0f2027 0%, #2c5364 100%)';
    landingBtn.style.color = '#FFD700';
    landingBtn.style.boxShadow = '0 0 24px 8px #00BFFF88, 0 0 8px 2px #FFD70088';
  };
  landingBtn.addEventListener('click', onClick);
  document.body.appendChild(landingBtn);
  return landingBtn;
}

export function updateLandingButtonVisibility(landingBtn, camera, earth) {
  const earthPos = new THREE.Vector3();
  if (earth && earth.mesh) {
    earth.mesh.getWorldPosition(earthPos);
  } else {
    earthPos.set(0, 0, 0);
  }
  const distance = camera.position.distanceTo(earthPos);
  // Determine planet radius to compute a sensible threshold
  let planetRadius = 10;
  if (earth && earth.mesh) {
    const sphereChild = earth.mesh.children ? earth.mesh.children.find(c => c.geometry && c.geometry.parameters && c.geometry.parameters.radius) : null;
    if (sphereChild && sphereChild.geometry && sphereChild.geometry.parameters && sphereChild.geometry.parameters.radius) {
      planetRadius = sphereChild.geometry.parameters.radius;
    }
  }
  // Show the landing button when within ~10 planet radii, but at least 20 units
  const threshold = Math.max(planetRadius * 5, 15);
  if (distance <= threshold) {
    landingBtn.style.display = 'block';
  } else {
    landingBtn.style.display = 'none';
  }
}

export function animateLandingBtn(landingBtn, camera, earth) {
  updateLandingButtonVisibility(landingBtn, camera, earth);
  requestAnimationFrame(() => animateLandingBtn(landingBtn, camera, earth));
}
