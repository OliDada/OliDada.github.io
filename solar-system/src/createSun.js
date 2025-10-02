import * as THREE from "three";

export function createSun() {
  const loader = new THREE.TextureLoader();

  // Sun group for orbital rotation
  const sunGroup = new THREE.Group();

  // Sun properties
  const sunRadius = 109.3; // relative to earth radius of 1

  const detail = 24;

  // Sun geometry and material - Make it emissive (self-illuminating)
  const sunGeometry = new THREE.IcosahedronGeometry(sunRadius, detail);
  const sunMaterial = new THREE.MeshBasicMaterial({
    map: loader.load('./textures/sunmap.jpg'),
  });

  // Create sun mesh
  const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
  sunMesh.position.set(0, 0, 0); // Sun at the center of the solar system
  sunGroup.add(sunMesh);

  // Create multiple glow layers for realistic effect
  // Inner glow - bright and warm
  const innerGlowGeometry = new THREE.IcosahedronGeometry(sunRadius * 1.02, detail);
  const innerGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.4,
    side: THREE.BackSide, // Render from inside
  });
  const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
  innerGlow.position.set(0, 0, 0); // Centered with the Sun
  sunGroup.add(innerGlow);

  // Outer glow - larger and more diffuse
  const outerGlowGeometry = new THREE.IcosahedronGeometry(sunRadius * 1.08, detail);
  const outerGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff8844,
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide,
  });
  const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
  outerGlow.position.set(0, 0, 0); // Centered with the Sun
  sunGroup.add(outerGlow);

  // Corona effect - very large and subtle
  const coronaGeometry = new THREE.IcosahedronGeometry(sunRadius * 1.2, detail);
  const coronaMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffaa,
    transparent: true,
    opacity: 0.1,
    side: THREE.BackSide,
  });
  const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
  corona.position.copy(sunMesh.position);
  sunGroup.add(corona);

  // Animation function for sun rotation and glow effects
  const animateSun = () => {    
    // Animate the glow layers for a dynamic effect
    const time = Date.now() * 0.001;
    innerGlow.material.opacity = 0.3 + Math.sin(time * 2) * 0.1;
    outerGlow.material.opacity = 0.15 + Math.sin(time * 1.5) * 0.05;
    corona.material.opacity = 0.08 + Math.sin(time) * 0.02;
    
    // Slight rotation for each glow layer to create movement
    innerGlow.rotation.y += 0.005;
    outerGlow.rotation.y -= 0.003;
    corona.rotation.y += 0.001;
  };
  
  return {
    group: sunGroup,
    animate: animateSun,
    mesh: sunMesh, // Expose for lighting calculations
  };
}