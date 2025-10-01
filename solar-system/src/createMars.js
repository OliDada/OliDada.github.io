import * as THREE from "three";

export function createMars(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Mars properties (realistic relative to Earth)
  const radius = 0.532; // Mars radius relative to Earth (53.2% of Earth's radius)
  const orbitRadius = 152; // Mars orbital distance from Sun (1.52 AU in your scale)
  const orbitalInclination = 1.85 * (Math.PI / 180); // Mars orbital inclination: 1.85 degrees
  
  // Create Mars mesh (not in a group for orbital rotation)
  const geometry = new THREE.IcosahedronGeometry(radius, 5);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/marsmap1k.jpg'),
  });
  const marsMesh = new THREE.Mesh(geometry, material);
  
  // Apply Mars's axial tilt (25.2 degrees - similar to Earth)
  marsMesh.rotation.z = 25.2 * (Math.PI / 180);

  // Mars orbital angle (start at different position than Earth)
  let marsOrbitalAngle = Math.PI; // Start opposite side from Earth
  const marsOrbitalSpeed = 0.0005; // Slower than Earth (Mars takes ~687 Earth days)

  // Animation function for mars orbit around Sun
  const animateMars = () => {
    // Update orbital position around Sun
    marsOrbitalAngle += marsOrbitalSpeed;
    
    // Position Mars in orbit around Sun with orbital inclination
    marsMesh.position.x = Math.cos(marsOrbitalAngle) * orbitRadius;
    marsMesh.position.z = Math.sin(marsOrbitalAngle) * orbitRadius;
    marsMesh.position.y = Math.sin(marsOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);
    
    // Mars self-rotation (24.6 hours, similar to Earth)
    marsMesh.rotation.y += 0.00195; // Similar to Earth's rotation speed
  };

  return {
    mesh: marsMesh, // Return mesh directly, not a group
    animate: animateMars,
    getOrbitalAngle: () => marsOrbitalAngle
  };
}