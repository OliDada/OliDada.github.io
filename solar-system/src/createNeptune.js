import * as THREE from "three";

export function createNeptune(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Neptune properties (realistic relative to Earth)
  const SPEED_FACTOR = 0.5;
  const radius = 38.6; // Neptune radius relative to Earth
  const orbitRadius = 708900; // Neptune: 30.07 AU
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
  let neptuneOrbitalAngle = 1.6 * Math.PI; // Unique starting angle
  const neptuneOrbitalSpeed = 0.0005 * SPEED_FACTOR; // Slower than Earth (Neptune takes ~165 Earth years)

  // Animation function for neptune orbit around Sun
  const animateNeptune = () => {
    // Update orbital position around Sun
    neptuneOrbitalAngle += neptuneOrbitalSpeed;

    // Position Neptune in orbit around Sun with orbital inclination
    neptuneMesh.position.x = Math.cos(neptuneOrbitalAngle) * orbitRadius;
    neptuneMesh.position.z = Math.sin(neptuneOrbitalAngle) * orbitRadius;
    neptuneMesh.position.y = Math.sin(neptuneOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);

    // Neptune self-rotation (16.1 hours)
  neptuneMesh.rotation.y += 0.00298 * SPEED_FACTOR; // Similar to Earth's rotation speed, scaled
  };

  return {
    mesh: neptuneMesh, // Return mesh directly, not a group
    animate: animateNeptune,
    getOrbitalAngle: () => neptuneOrbitalAngle
  };
}