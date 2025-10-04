import * as THREE from "three";

export function createSaturn(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Saturn properties (realistic relative to Earth)
  const SPEED_FACTOR = 0.5;
  const radius = 91.4; // Saturn radius relative to Earth
  const orbitRadius = 224425; // Saturn: 9.52 AU
  const orbitalInclination = 2.49 * (Math.PI / 180); // Saturn orbital inclination: 2.49 degrees

  // Create Saturn mesh
  const geometry = new THREE.SphereGeometry(radius, 128, 64);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/8k_saturn.jpg'), // Saturn's surface color map
  });
  const saturnMesh = new THREE.Mesh(geometry, material);

  // Create Saturn's rings with custom geometry for proper texture mapping
  const ringInnerRadius = radius * 1.2; // Hole slightly larger than Saturn (already scaled)
  const ringOuterRadius = radius * 5.2; // Ring system extends much further out (already scaled)
  
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

  const ringGeometry = createRingGeometry(ringInnerRadius, ringOuterRadius, 128);
  
  // Load both ring textures
  const ringColorMap = loader.load('./textures/8k_saturn_ring_alpha.png');
  const ringPatternMap = loader.load('./textures/8k_saturn_ring_alpha.png');

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
  
  // Create additional ring layers for thickness
  const ringMesh2 = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh2.rotation.x = Math.PI / 2;
  ringMesh2.position.y = 0.02; // Slightly offset
  
  const ringMesh3 = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh3.rotation.x = Math.PI / 2;
  ringMesh3.position.y = -0.02; // Slightly offset in opposite direction
  
  // Create Saturn group to hold both planet and rings
  const saturnGroup = new THREE.Group();
  saturnGroup.add(saturnMesh);
  saturnGroup.add(ringMesh);
  saturnGroup.add(ringMesh2);
  saturnGroup.add(ringMesh3);
  
  // Apply Saturn's axial tilt (26.7 degrees - affects both planet and rings)
  // Apply tilt to the entire group for proper coordinate system alignment
  const saturnTilt = 26.7 * (Math.PI / 180);
  saturnGroup.rotation.z = saturnTilt;

  // Saturn orbital angle and speed
  let saturnOrbitalAngle = 1.2 * Math.PI; // Unique starting angle
  const saturnOrbitalSpeed = 0.000034 * SPEED_FACTOR; // Saturn: 29.5 years orbital period

  // Animation function for Saturn orbit around Sun
  const animateSaturn = () => {
    // Update orbital position around Sun
    saturnOrbitalAngle += saturnOrbitalSpeed;
    
    // Position Saturn in orbit around Sun with orbital inclination
    saturnGroup.position.x = Math.cos(saturnOrbitalAngle) * orbitRadius;
    saturnGroup.position.z = Math.sin(saturnOrbitalAngle) * orbitRadius;
    saturnGroup.position.y = Math.sin(saturnOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);
    
    // Saturn self-rotation (10.7 hours - quite fast for its size)
  saturnMesh.rotation.y += 0.0056 * SPEED_FACTOR; // Faster than Earth
  // Rings rotate with the planet (all layers)
  ringMesh.rotation.z += 0.0056 * SPEED_FACTOR;
  ringMesh2.rotation.z += 0.0056 * SPEED_FACTOR;
  ringMesh3.rotation.z += 0.0056 * SPEED_FACTOR;
  };

  return {
    mesh: saturnGroup, // Return group containing both planet and rings
    animate: animateSaturn,
    getOrbitalAngle: () => saturnOrbitalAngle
  };
}