import * as THREE from "three";

export function createVenus(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Venus properties (realistic relative to Earth)
  const radius = 0.949; // Venus radius relative to Earth (94.9% of Earth's radius)
  const orbitRadius = 200; // Venus: 0.72 AU (proportionally correct)
  const orbitalInclination = 3.39 * (Math.PI / 180); // Venus orbital inclination: 3.39 degrees
  
  // Create Venus mesh (not in a group for orbital rotation)
  const geometry = new THREE.SphereGeometry(radius, 64, 32);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/8k_venus_surface.jpg'),
  });
  const venusMesh = new THREE.Mesh(geometry, material);

  // Venus atmosphere (very thick and dense)
  const cloudsMat = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/4k_venus_atmosphere.jpg'),
    transparent: true,
    opacity: 0.4,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
  const cloudsMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius + 0.01, 64, 32), // Thicker atmosphere
    cloudsMat
  );
  venusMesh.add(cloudsMesh);

  // Apply Venus's axial tilt (177.4 degrees - retrograde rotation, nearly upside down!)
  venusMesh.rotation.z = 177.4 * (Math.PI / 180);

  // Venus orbital angle (start at different position than Earth)
  let venusOrbitalAngle = Math.PI; // Start opposite side from Earth
  const venusOrbitalSpeed = 0.0005; // Slower than Earth (Venus takes ~225 Earth days)

  // Animation function for venus orbit around Sun
  const animateVenus = () => {
    // Update orbital position around Sun
    venusOrbitalAngle += venusOrbitalSpeed;

    // Position Venus in orbit around Sun with orbital inclination
    venusMesh.position.x = Math.cos(venusOrbitalAngle) * orbitRadius;
    venusMesh.position.z = Math.sin(venusOrbitalAngle) * orbitRadius;
    venusMesh.position.y = Math.sin(venusOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);

    // Venus self-rotation (very slow and retrograde - 243 Earth days)
    venusMesh.rotation.y -= 0.0000082; // Negative for retrograde rotation
    cloudsMesh.rotation.y -= 0.0001; // Clouds rotate slightly faster
  };

  return {
    mesh: venusMesh, // Return mesh directly, not a group
    animate: animateVenus,
    getOrbitalAngle: () => venusOrbitalAngle
  };
}