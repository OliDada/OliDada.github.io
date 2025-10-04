import * as THREE from "three";

export function createMars(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Mars properties (scaled up)
  const SPEED_FACTOR = 0.5;
  const radius = 5.32; // Mars radius relative to Earth
  const orbitRadius = 35833; // Mars: 1.52 AU
  const orbitalInclination = 1.85 * (Math.PI / 180); // Mars orbital inclination: 1.85 degrees

  // Create Mars mesh (not in a group for orbital rotation)
  const geometry = new THREE.SphereGeometry(radius, 64, 32);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/8k_mars.jpg'),
  });
  const marsMesh = new THREE.Mesh(geometry, material);
  
  // Apply Mars's axial tilt (25.2 degrees - similar to Earth)
  marsMesh.rotation.z = 25.2 * (Math.PI / 180);

  // Mars orbital angle (start at different position than Earth)
  let marsOrbitalAngle = 0.8 * Math.PI; // Unique starting angle
  const marsOrbitalSpeed = 0.0005 * SPEED_FACTOR; // Slower than Earth (Mars takes ~687 Earth days)

  // Animation function for mars orbit around Sun
  const animateMars = () => {
    // Update orbital position around Sun
    marsOrbitalAngle += marsOrbitalSpeed;
    
    // Position Mars in orbit around Sun with orbital inclination
    marsMesh.position.x = Math.cos(marsOrbitalAngle) * orbitRadius;
    marsMesh.position.z = Math.sin(marsOrbitalAngle) * orbitRadius;
    marsMesh.position.y = Math.sin(marsOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);
    
    // Mars self-rotation (24.6 hours, similar to Earth)
  marsMesh.rotation.y += 0.00195 * SPEED_FACTOR; // Similar to Earth's rotation speed, scaled
  };

  return {
    mesh: marsMesh, // Return mesh directly, not a group
    animate: animateMars,
    getOrbitalAngle: () => marsOrbitalAngle
  };
}