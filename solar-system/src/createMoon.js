import * as THREE from "three";

export function createMoon(earthObject = null) {
  const loader = new THREE.TextureLoader();
  
  // Moon group for orbital rotation
  const moonGroup = new THREE.Group();
  
  // Moon properties
  const moonRadius = 0.27; // relative to earth radius of 1
  const moonDistance = 10; // realistic average distance from Earth in your scale
  
  // Moon geometry and material
  const moonGeometry = new THREE.IcosahedronGeometry(moonRadius, 5);
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/moonmap4k.jpg'),
  });
  
  // Create moon mesh
  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
  moonMesh.position.set(moonDistance, 0, 0);
  moonGroup.add(moonMesh);
  
  // Animation function for moon orbit
  const animateMoon = () => {
    // Moon orbits around Earth
    moonGroup.rotation.y += 0.005; // Orbital rotation around Earth
    
    // Update moon group position to follow Earth (handle both old .group and new .mesh structure)
    if (earthObject && (earthObject.group || earthObject.mesh)) {
      const earthPosition = earthObject.group ? earthObject.group.position : earthObject.mesh.position;
      moonGroup.position.copy(earthPosition);
    }
    
    // Note: Real moon is tidally locked, so no self-rotation
  };
  
  return {
    group: moonGroup,
    animate: animateMoon
  };
}