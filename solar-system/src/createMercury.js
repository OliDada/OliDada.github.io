import * as THREE from "three";

export function createMercury(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Mercury properties (realistic relative to Earth)
  const SPEED_FACTOR = 0.5;
  const radius = 3.83; // Mercury radius relative to Earth
  const orbitRadius = 9194; // Mercury: 0.39 AU
  const orbitalInclination = 3.39 * (Math.PI / 180); // Mercury orbital inclination: 3.39 degrees
  
  // Create Mercury mesh (not in a group for orbital rotation)
  const geometry = new THREE.SphereGeometry(radius, 64, 32);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/8k_mercury.jpg'),
  });
  const mercuryMesh = new THREE.Mesh(geometry, material);

  // Mercury orbital angle (start at different position than Earth)
  let mercuryOrbitalAngle = 0.2 * Math.PI; // Unique starting angle
  const mercuryOrbitalSpeed = 0.0005 * SPEED_FACTOR; // Slower than Earth (Mercury takes ~88 Earth days)

  // Animation function for mercury orbit around Sun
  const animateMercury = () => {
    // Update orbital position around Sun
    mercuryOrbitalAngle += mercuryOrbitalSpeed;

    // Position Mercury in orbit around Sun with orbital inclination
    mercuryMesh.position.x = Math.cos(mercuryOrbitalAngle) * orbitRadius;
    mercuryMesh.position.z = Math.sin(mercuryOrbitalAngle) * orbitRadius;
    mercuryMesh.position.y = Math.sin(mercuryOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);

    // Mercury self-rotation (very slow and retrograde - 243 Earth days)
  mercuryMesh.rotation.y -= 0.000034 * SPEED_FACTOR; // Negative for retrograde rotation, scaled
  };

  return {
    mesh: mercuryMesh, // Return mesh directly, not a group
    animate: animateMercury,
    getOrbitalAngle: () => mercuryOrbitalAngle
  };
}