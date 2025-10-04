import * as THREE from "three";

export function createPluto(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Pluto properties (realistic relative to Earth)
  const SPEED_FACTOR = 0.5;
  const radius = 1.86; // Pluto radius relative to Earth
  const orbitRadius = 931173; // Pluto: 39.5 AU
  const orbitalInclination = 17.16 * (Math.PI / 180); // Pluto orbital inclination: 17.16 degrees

  // Create Pluto mesh (not in a group for orbital rotation)
  const geometry = new THREE.SphereGeometry(radius, 64, 32);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/plutomap2k.jpg'),
  });
  const plutoMesh = new THREE.Mesh(geometry, material);
  
  // Apply Pluto's axial tilt (122.5 degrees - highly tilted)
  plutoMesh.rotation.z = 122.5 * (Math.PI / 180);

  // Pluto orbital angle (start at different position than Earth)
  let plutoOrbitalAngle = Math.PI; // Start opposite side from Earth
  const plutoOrbitalSpeed = 0.0001 * SPEED_FACTOR; // Much slower - Pluto takes ~248 Earth years

  // Animation function for pluto orbit around Sun
  const animatePluto = () => {
    // Update orbital position around Sun
    plutoOrbitalAngle += plutoOrbitalSpeed;

    // Position Pluto in orbit around Sun with orbital inclination
    plutoMesh.position.x = Math.cos(plutoOrbitalAngle) * orbitRadius;
    plutoMesh.position.z = Math.sin(plutoOrbitalAngle) * orbitRadius;
    plutoMesh.position.y = Math.sin(plutoOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);

    // Pluto self-rotation (153.3 hours, much slower than Earth)
  plutoMesh.rotation.y += 0.00017 * SPEED_FACTOR; // Much slower than Earth's rotation speed, scaled
  };

  return {
    mesh: plutoMesh, // Return mesh directly, not a group
    animate: animatePluto,
    getOrbitalAngle: () => plutoOrbitalAngle
  };
}