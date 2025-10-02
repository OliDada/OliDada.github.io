import * as THREE from "three";

export function createJupiter(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Jupiter properties (realistic relative to Earth)
  const radius = 10.95; // Jupiter radius relative to Earth (100% of Earth's radius)
  const orbitRadius = 1456; // Jupiter: 5.2 AU (proportionally correct)
  const orbitalInclination = 1.3 * (Math.PI / 180); // Jupiter orbital inclination: 1.3 degrees

  // Create Jupiter mesh (not in a group for orbital rotation)
  const geometry = new THREE.SphereGeometry(radius, 64, 32);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/8k_jupiter.jpg'),
  });
  const jupiterMesh = new THREE.Mesh(geometry, material);
  
  // Apply Jupiter's axial tilt (3.1 degrees - very small tilt)
  jupiterMesh.rotation.z = 3.1 * (Math.PI / 180);

  // Jupiter orbital angle (start at different position than Earth)
  let jupiterOrbitalAngle = Math.PI; // Start opposite side from Earth
  const jupiterOrbitalSpeed = 0.0005; // Slower than Earth (Jupiter takes ~4333 Earth days)

  // Animation function for jupiter orbit around Sun
  const animateJupiter = () => {
    // Update orbital position around Sun
    jupiterOrbitalAngle += jupiterOrbitalSpeed;

    // Position Jupiter in orbit around Sun with orbital inclination
    jupiterMesh.position.x = Math.cos(jupiterOrbitalAngle) * orbitRadius;
    jupiterMesh.position.z = Math.sin(jupiterOrbitalAngle) * orbitRadius;
    jupiterMesh.position.y = Math.sin(jupiterOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);

    // Jupiter self-rotation
    jupiterMesh.rotation.y += 0.00485;
  };

  return {
    mesh: jupiterMesh, // Return mesh directly, not a group
    animate: animateJupiter,
    getOrbitalAngle: () => jupiterOrbitalAngle
  };
}