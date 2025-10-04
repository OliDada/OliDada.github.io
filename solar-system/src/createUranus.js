import * as THREE from "three";

export function createUranus(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Uranus properties (realistic relative to Earth)
    const SPEED_FACTOR = 0.5;
    const radius = 39.8; // Uranus radius relative to Earth
    const orbitRadius = 466765; // Uranus: 19.8 AU
  const orbitalInclination = 0.8 * (Math.PI / 180); // Uranus orbital inclination: 0.8 degrees

  // Create Uranus mesh
  const geometry = new THREE.SphereGeometry(radius, 64, 32);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/2k_uranus.jpg'), // Uranus's surface color map
    metalness: 0.0, // Ensure proper lighting response
    roughness: 1.0, // Make surface more responsive to directional light
  });
  const uranusMesh = new THREE.Mesh(geometry, material);

  // Create Uranus's rings with custom geometry for proper texture mapping
  const ringInnerRadius = radius * 2; // Hole slightly larger than Uranus
  const ringOuterRadius = radius * 2.3; // Much narrower ring system (Uranus has thin, narrow rings)
  
  // Custom ring geometry function with proper UV mapping for textures
  function createRingGeometry(innerRadius, outerRadius, segments) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];

    // Create vertices and UVs - this maps the texture radially from inner to outer edge (inverted)
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Inner vertex
      vertices.push(innerRadius * cos, innerRadius * sin, 0);
      uvs.push(1, i / segments); // U=1 for inner edge (inverted), V wraps around

      // Outer vertex  
      vertices.push(outerRadius * cos, outerRadius * sin, 0);
      uvs.push(0, i / segments); // U=0 for outer edge (inverted), V wraps around
    }

    // Create indices for triangles
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;

      // Two triangles per segment
      indices.push(a, b, d);
      indices.push(a, d, c);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  const ringGeometry = createRingGeometry(ringInnerRadius, ringOuterRadius, 256);
  
  // Load both ring textures
  const ringColorMap = loader.load('./textures/uranusringcolour.jpg');
  const ringPatternMap = loader.load('./textures/uranusringtrans.gif');

  // Material with both color and transparency
  const ringMaterial = new THREE.MeshBasicMaterial({
    map: ringColorMap,
    alphaMap: ringPatternMap,  // This would control transparency
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.1,
    depthWrite: false
  });
  
  // Create main ring mesh
  const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = Math.PI / 2; // 90 degrees
  
  // Create one additional ring layer for very subtle thickness
  const ringMesh2 = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh2.rotation.x = Math.PI / 2;
  ringMesh2.position.y = 0.001; // Extremely thin offset

  // Create Uranus group to hold both planet and rings
  const uranusGroup = new THREE.Group();
  uranusGroup.add(uranusMesh);
  uranusGroup.add(ringMesh);
  uranusGroup.add(ringMesh2);

  // Apply Uranus's extreme axial tilt (97.77 degrees - nearly on its side!)
  // Apply tilt to the entire group for proper coordinate system alignment
  const axialTilt = 97.77 * (Math.PI / 180);
  uranusGroup.rotation.z = axialTilt;

  // Uranus orbital angle and speed
  let uranusOrbitalAngle = 1.4 * Math.PI; // Unique starting angle
    const uranusOrbitalSpeed = 0.0000238 * SPEED_FACTOR; 

  // Animation function for Uranus orbit around Sun
  const animateUranus = () => {
    // Update orbital position around Sun
    uranusOrbitalAngle += uranusOrbitalSpeed;

    // Position Uranus in orbit around Sun with orbital inclination
    uranusGroup.position.x = Math.cos(uranusOrbitalAngle) * orbitRadius;
    uranusGroup.position.z = Math.sin(uranusOrbitalAngle) * orbitRadius;
    uranusGroup.position.y = Math.sin(uranusOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);

    // Uranus self-rotation (10.7 hours - quite fast for its size)
    uranusMesh.rotation.y += -0.00279 * SPEED_FACTOR; // Faster than Earth

    // Rings rotate with the planet (both layers)
      ringMesh.rotation.z += -0.00279 * SPEED_FACTOR;
      ringMesh2.rotation.z += 0.00279 * SPEED_FACTOR;
  };

  return {
    mesh: uranusGroup, // Return group containing both planet and rings
    animate: animateUranus,
    getOrbitalAngle: () => uranusOrbitalAngle
  };
}