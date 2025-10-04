// src/landingAnimation.js
import * as THREE from "three";

export function animateCameraToEarthLanding(camera, renderer, earth, scene, callback) {
  // Find Earth's position and radius
  const earthPos = new THREE.Vector3();
  let earthRadius = 10; // Default radius
  if (earth && earth.mesh) {
    earth.mesh.getWorldPosition(earthPos);
    if (earth.mesh.geometry && earth.mesh.geometry.parameters && earth.mesh.geometry.parameters.radius) {
      earthRadius = earth.mesh.geometry.parameters.radius;
    }
  } else {
    earthPos.set(0, 0, 0);
  }
  // Debug: log initial camera and earth positions
  console.log('Camera initial position:', camera.position.toArray());
  console.log('Earth position:', earthPos.toArray());
  console.log('Earth radius:', earthRadius);
  // Use a larger buffer to ensure camera lands above the surface
  const landingOffset = earthRadius * 1.15; // 15% above surface
  let t = 0;
  // Calculate initial offset from planet to camera
  const initialEarthPos = new THREE.Vector3();
  if (earth && earth.mesh) {
    earth.mesh.getWorldPosition(initialEarthPos);
  } else {
    initialEarthPos.set(0, 0, 0);
  }
  const initialOffset = camera.position.clone().sub(initialEarthPos);
  const initialDistance = initialOffset.length();
  // Target offset is landingOffset in the same direction
  const targetOffset = initialOffset.clone().normalize().multiplyScalar(landingOffset);
  // Duration is proportional to initial distance, but faster for far distances and slower for close
  // If far: 0.05s per unit, if close: min 8s
  let duration;
  // Use shorter, smoother approach durations so we don't linger just above the planet
  if (initialDistance > 500) {
    duration = Math.max(2, initialDistance * 0.01); // scale with distance but keep reasonable
  } else {
    duration = Math.max(5, initialDistance * 0.05 + 0.3); // quick approach for close starts
  }
  function animateStep() {
    // Update time
    t += 1 / 60;
    // Gentler ease-in for alpha (p=4), but linear for far distances
    let linearAlpha = Math.min(t / duration, 1);
    // Use a smooth easeInOutCubic to avoid an abrupt slow-stop near the end
    const easeInOutCubic = (p) => {
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    };
    const alpha = easeInOutCubic(linearAlpha);
    // Get current planet position
    const currentEarthPos = new THREE.Vector3();
    if (earth && earth.mesh) {
      earth.mesh.getWorldPosition(currentEarthPos);
    } else {
      currentEarthPos.set(0, 0, 0);
    }
    // Interpolate offset
    const currentOffset = new THREE.Vector3().lerpVectors(initialOffset, targetOffset, alpha);
    // Set camera position relative to planet
    camera.position.copy(currentEarthPos.clone().add(currentOffset));
    camera.lookAt(currentEarthPos);
    renderer.render(scene, camera);
    // If we've reached the target offset, snap to surface and stop
  if (alpha >= 1 || currentOffset.length() < landingOffset) {
      camera.position.copy(currentEarthPos.clone().add(targetOffset));
      camera.lookAt(currentEarthPos);
      renderer.render(scene, camera);
      if (callback) callback();
      return;
    } else {
      requestAnimationFrame(animateStep);
    }
    // (Removed duplicate/old lerp logic)
  }
  animateStep();
}
