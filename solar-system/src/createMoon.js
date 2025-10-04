import * as THREE from "three";

export function createMoon(earthObject = null) {
  const loader = new THREE.TextureLoader();
  
  // Moon group for orbital rotation
  const moonGroup = new THREE.Group();
  
  // Moon properties (scaled up)
  const SPEED_FACTOR = 0.5;
  const moonRadius = 2.73; // Moon radius: 27.3% of Earth's radius
  const moonDistance = 603; // Realistic average distance from Earth: ~60.3 Earth radii
  
  // Moon geometry and material
  const moonGeometry = new THREE.IcosahedronGeometry(moonRadius, 32);
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/8k_moon.jpg'),
  });
  
  // Create moon mesh
  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
  moonMesh.position.set(moonDistance, 0, 0);
  moonGroup.add(moonMesh);
  
  // Animation function for moon orbit
  const animateMoon = () => {
    // Moon orbits around Earth
  moonGroup.rotation.y += 0.005 * SPEED_FACTOR; // Orbital rotation around Earth
    
    // Update moon group position to follow Earth (handle both old .group and new .mesh structure)
    if (earthObject && (earthObject.group || earthObject.mesh)) {
      const earthPosition = earthObject.group ? earthObject.group.position : earthObject.mesh.position;
      moonGroup.position.copy(earthPosition);
    }
    
    // Note: Real moon is tidally locked, so no self-rotation
  };
  
  return {
    group: moonGroup,
    mesh: moonMesh, // Return the actual moon mesh for camera focusing
    animate: animateMoon
  };
}