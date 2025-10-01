import * as THREE from "three";

export function createSaturn(sunGroup = null) {
  const loader = new THREE.TextureLoader();

  // Saturn properties (realistic relative to Earth)
  const radius = 9.14; // Saturn radius relative to Earth (914% of Earth's radius)
  const orbitRadius = 952; // Saturn orbital distance: 9.52 AU scaled down
  const orbitalInclination = 2.49 * (Math.PI / 180); // Saturn orbital inclination: 2.49 degrees

  // Create Saturn mesh
  const geometry = new THREE.IcosahedronGeometry(radius, 16);
  const material = new THREE.MeshStandardMaterial({
    map: loader.load('./textures/saturnmap.jpg'), // Saturn's surface color map
  });
  const saturnMesh = new THREE.Mesh(geometry, material);

  // Create Saturn's rings with custom geometry for proper texture mapping
  const ringInnerRadius = radius * 1.2; // Hole slightly larger than Saturn
  const ringOuterRadius = radius * 3.0; // Ring system extends much further out
  
  // Custom ring geometry function with proper UV mapping for textures
  function createRingGeometry(innerRadius, outerRadius, segments) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];

    // Create vertices and UVs - this maps the texture radially from inner to outer edge
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Inner vertex
      vertices.push(innerRadius * cos, innerRadius * sin, 0);
      uvs.push(0, i / segments); // U=0 for inner edge, V wraps around

      // Outer vertex  
      vertices.push(outerRadius * cos, outerRadius * sin, 0);
      uvs.push(1, i / segments); // U=1 for outer edge, V wraps around
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
  const ringColorMap = loader.load('./textures/saturnringcolor.jpg');
  const ringPatternMap = loader.load('./textures/saturnringpattern.gif');

  // Material with both color and transparency
  const ringMaterial = new THREE.MeshBasicMaterial({
    map: ringColorMap,
    alphaMap: ringPatternMap,  // This would control transparency
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.12,
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
  saturnGroup.rotation.z = 26.7 * (Math.PI / 180);

  // Saturn orbital angle and speed
  let saturnOrbitalAngle = Math.PI / 3; // Start at 60 degrees
  const saturnOrbitalSpeed = 0.000034; // Saturn: 29.5 years orbital period

  // Animation function for Saturn orbit around Sun
  const animateSaturn = () => {
    // Update orbital position around Sun
    saturnOrbitalAngle += saturnOrbitalSpeed;
    
    // Position Saturn in orbit around Sun with orbital inclination
    saturnGroup.position.x = Math.cos(saturnOrbitalAngle) * orbitRadius;
    saturnGroup.position.z = Math.sin(saturnOrbitalAngle) * orbitRadius;
    saturnGroup.position.y = Math.sin(saturnOrbitalAngle) * orbitRadius * Math.sin(orbitalInclination);
    
    // Saturn self-rotation (10.7 hours - quite fast for its size)
    saturnMesh.rotation.y += 0.0056; // Faster than Earth
    
    // Rings rotate with the planet (all layers)
    ringMesh.rotation.z += 0.0056;
    ringMesh2.rotation.z += 0.0056;
    ringMesh3.rotation.z += 0.0056;
  };

  return {
    mesh: saturnGroup, // Return group containing both planet and rings
    animate: animateSaturn,
    getOrbitalAngle: () => saturnOrbitalAngle
  };
}