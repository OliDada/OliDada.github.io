import * as THREE from "three";

export function createMercury(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Mercury properties (realistic relative to Earth)
  const radius = 0.383; // Mercury radius relative to Earth (38.3% of Earth's radius)
  const orbitRadius = 57.91; // Mercury orbital distance from Sun (0.39 AU in your scale)
  const orbitalInclination = 3.39 * (Math.PI / 180); // Mercury orbital inclination: 3.39 degrees

  // Create Mercury mesh (not in a group for orbital rotation)
  const geometry = new THREE.IcosahedronGeometry(radius, 5);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/mercurymap.jpg'),
  });
  const mercuryMesh = new THREE.Mesh(geometry, material);

  // Mercury orbital angle (start at different position than Earth)
  let mercuryOrbitalAngle = Math.PI; // Start opposite side from Earth
  const mercuryOrbitalSpeed = 0.0005; // Slower than Earth (Mercury takes ~88 Earth days)

  // Animation function for mercury orbit around Sun
  const animateMercury = () => {
    // Update orbital position around Sun
    mercuryOrbitalAngle += mercuryOrbitalSpeed;

    // Position Mercury in orbit around Sun with orbital inclination
    mercuryMesh.position.x = Math.cos(mercuryOrbitalAngle) * orbitRadius;
    mercuryMesh.position.z = Math.sin(mercuryOrbitalAngle) * orbitRadius;
    mercuryMesh.position.y = Math.sin(mercuryOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);

    // Mercury self-rotation (very slow and retrograde - 243 Earth days)
    mercuryMesh.rotation.y -= 0.000034; // Negative for retrograde rotation
  };

  return {
    mesh: mercuryMesh, // Return mesh directly, not a group
    animate: animateMercury,
    getOrbitalAngle: () => mercuryOrbitalAngle
  };
}