import * as THREE from "three";
import { getFresnelMat } from './getFresnelMat.js';

export function createEarth() {
  const loader = new THREE.TextureLoader();
  const detail = 12;
  
  // Earth orbital properties
  const orbitRadius = 200; // Earth's distance from Sun (moved outside Sun's radius)
  let earthOrbitalAngle = 0; // Start at 0 degrees
  const earthOrbitalSpeed = 0.0001; // Earth's orbital speed (365.25 days baseline)
  const orbitalInclination = 0; // Earth orbital inclination: 0 degrees (reference plane)
  
  // Earth group (for all earth components)
  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = -23.4 * (Math.PI / 180); // tilt the earth to match real world
  
  // Main earth geometry
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  
  // Earth surface
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/8081_earthmap4k.jpg'),
  });
  const earthMesh = new THREE.Mesh(geometry, material);
  earthMesh.castShadow = true;
  earthMesh.receiveShadow = true;
  earthGroup.add(earthMesh);
  
  // Earth lights (night side)
  const lightsMat = new THREE.MeshBasicMaterial({
    map: loader.load('./textures/8081_earthlights4k.jpg'),
    blending: THREE.AdditiveBlending,
  });
  const lightMesh = new THREE.Mesh(geometry, lightsMat);
  earthGroup.add(lightMesh);
  
  // Clouds
  const cloudsMat = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/04_earthcloudmap.jpg'),
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });
  const cloudsMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.01, detail),
    cloudsMat
  );
  earthGroup.add(cloudsMesh);
  
  // Atmospheric glow
  const fresnelMat = getFresnelMat();
  const glowMesh = new THREE.Mesh(geometry, fresnelMat);
  glowMesh.scale.setScalar(1.012);
  earthGroup.add(glowMesh);
  
  // Animation function for earth orbit around Sun
  const animateEarth = () => {
    // Update orbital position around Sun
    earthOrbitalAngle += earthOrbitalSpeed;
    
    // Position Earth in orbit around Sun (center of scene)
    earthGroup.position.x = Math.cos(earthOrbitalAngle) * orbitRadius;
    earthGroup.position.z = Math.sin(earthOrbitalAngle) * orbitRadius;
    earthGroup.position.y = 0;
    
    // Earth self-rotation (day/night cycle)
    earthMesh.rotation.y += 0.002;
    lightMesh.rotation.y += 0.002;
    cloudsMesh.rotation.y += 0.0023;
    glowMesh.rotation.y += 0.002;
  };
  
  return {
    mesh: earthGroup, // Return group as mesh to match Mars pattern
    animate: animateEarth,
    getOrbitalAngle: () => earthOrbitalAngle
  };
}