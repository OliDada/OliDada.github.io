import * as THREE from "three";
import { getFresnelMat } from './getFresnelMat.js';

export function createEarth() {
  const loader = new THREE.TextureLoader();
  const detail = 12;
  
  // Earth orbital properties (scaled up)
  const SPEED_FACTOR = 0.5; // Slow down movement
  const orbitRadius = 23574; // Earth: 1.0 AU (astronomically accurate)
  let earthOrbitalAngle = 0.6 * Math.PI; // Unique starting angle
  const earthOrbitalSpeed = 0.0001 * SPEED_FACTOR; // Earth's orbital speed (365.25 days baseline)
  const orbitalInclination = 0; // Earth orbital inclination: 0 degrees (reference plane)
  
  // Earth group (for all earth components)
  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = -23.4 * (Math.PI / 180); // tilt the earth to match real world
  earthGroup.rotation.y = 0; // Reset group Y rotation
  const geometry = new THREE.SphereGeometry(10, 1028, 512);
  const earthMaterial = new THREE.MeshStandardMaterial({
  map: loader.load('./textures/8k_earth_daymap.jpg'),
  normalMap: loader.load('./textures/8k_earth_normal_map.jpg'),
  normalScale: new THREE.Vector2(2, 2),
  roughnessMap: loader.load('./textures/8k_earth_specular_map.jpg'),
  roughness: 0.8,
  metalness: 0.0
  });
  const earthMesh = new THREE.Mesh(geometry, earthMaterial);
  earthMesh.rotation.y = 0; // Reset mesh rotation
  earthMesh.castShadow = true;
  earthMesh.receiveShadow = true;
  earthGroup.add(earthMesh);
  
  // Earth night lights (simple additive layer)
  const nightLightsMaterial = new THREE.MeshBasicMaterial({
    map: loader.load('./textures/8k_earth_nightmap.jpg'),
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
  });
  const nightLightsMesh = new THREE.Mesh(new THREE.SphereGeometry(10.005, 64, 32), nightLightsMaterial);
  earthGroup.add(nightLightsMesh);
  
  // Clouds
  const cloudsMaterial = new THREE.MeshLambertMaterial({
    map: loader.load('./textures/8k_earth_clouds.jpg'),
    transparent: true,
    opacity: 1,
    alphaMap: loader.load('./textures/8k_earth_clouds.jpg'),
    side: THREE.FrontSide
  });
  
  // Create cloud geometry with normal normals
  const cloudGeometry = new THREE.SphereGeometry(10.2, 64, 32);
  
  const cloudsMesh = new THREE.Mesh(cloudGeometry, cloudsMaterial);
  earthGroup.add(cloudsMesh);
  
  // Atmospheric glow
  const fresnelMat = getFresnelMat();
  // Atmospheric glow: only slightly larger than Earth, do not double scale twice
  const glowMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(10.1, detail), fresnelMat);
  glowMesh.scale.setScalar(1.012); // Only apply the subtle glow scale, not SCALE_FACTOR
  earthGroup.add(glowMesh);
  
  // Set initial position based on orbital angle
  earthGroup.position.x = -Math.cos(earthOrbitalAngle) * orbitRadius;
  earthGroup.position.z = -Math.sin(earthOrbitalAngle) * orbitRadius;
  earthGroup.position.y = 0;
  
  // Animation function for earth orbit around Sun
  const animateEarth = () => {
    // Update orbital position around Sun
    earthOrbitalAngle += earthOrbitalSpeed;
    
    // Position Earth in orbit around Sun (center of scene)
    earthGroup.position.x = Math.cos(-earthOrbitalAngle) * orbitRadius;
    earthGroup.position.z = Math.sin(-earthOrbitalAngle) * orbitRadius;
    earthGroup.position.y = 0;
    
    // Earth self-rotation (day/night cycle, slower)
    earthMesh.rotation.y += 0.002 * SPEED_FACTOR;
    nightLightsMesh.rotation.y += 0.002 * SPEED_FACTOR;
    cloudsMesh.rotation.y += 0.0023 * SPEED_FACTOR;
    glowMesh.rotation.y += 0.002 * SPEED_FACTOR;
  };
  
  return {
    mesh: earthGroup, // Return group as mesh to match Mars pattern
    animate: animateEarth,
    getOrbitalAngle: () => earthOrbitalAngle
  };
}