import * as THREE from "three";

export function createNeptune(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Neptune properties (realistic relative to Earth)
  const radius = 3.86; // Neptune radius relative to Earth (49.2% of Earth's radius)
  const orbitRadius = 8420; // Neptune: 30.07 AU (proportionally correct)
  const orbitalInclination = 1.85 * (Math.PI / 180); // Neptune orbital inclination: 1.85 degrees

  // Create Neptune mesh (not in a group for orbital rotation)
  const geometry = new THREE.SphereGeometry(radius, 64, 32); // Use SphereGeometry for better rendering
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/2k_neptune.jpg'),
  });
  const neptuneMesh = new THREE.Mesh(geometry, material);

  // Set initial position explicitly for testing
  neptuneMesh.position.set(orbitRadius, 0, 0); // Should be clearly visible far from Sun

  // Neptune orbital angle (start at different position than Earth)
  let neptuneOrbitalAngle = Math.PI; // Start opposite side from Earth
  const neptuneOrbitalSpeed = 0.0005; // Slower than Earth (Neptune takes ~165 Earth years)

  // Animation function for neptune orbit around Sun
  const animateNeptune = () => {
    // Update orbital position around Sun
    neptuneOrbitalAngle += neptuneOrbitalSpeed;

    // Position Neptune in orbit around Sun with orbital inclination
    neptuneMesh.position.x = Math.cos(neptuneOrbitalAngle) * orbitRadius;
    neptuneMesh.position.z = Math.sin(neptuneOrbitalAngle) * orbitRadius;
    neptuneMesh.position.y = Math.sin(neptuneOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);

    // Neptune self-rotation (16.1 hours)
    neptuneMesh.rotation.y += 0.00298; // Similar to Earth's rotation speed
  };

  return {
    mesh: neptuneMesh, // Return mesh directly, not a group
    animate: animateNeptune,
    getOrbitalAngle: () => neptuneOrbitalAngle
  };
}