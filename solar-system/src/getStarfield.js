import * as THREE from "three";

export default function getStarfield({ numStars = 500, layers = 1 } = {}) {
  function randomSpherePoint(layer = 0) {
    // Create different distance ranges for different layers
    let radius;
    let starSize;
    
    if (layer === 0) {
      // Close stars (further from Earth but still closer than background)
      radius = Math.random() * 2800 + 2800; // 2800-5600 units from center
      starSize = 0.1 + Math.random() * 0.2; // Smaller, closer stars
    } else if (layer === 1) {
      // Medium distance stars
      radius = Math.random() * 3000 + 3000; // 3000-6000 units from center
      starSize = 0.15 + Math.random() * 0.25;
    } else if (layer === 2) {
      // Medium distance stars
      radius = Math.random() * 6000 + 6100; // 6100-12100 units
      starSize = 0.15 + Math.random() * 0.25;
    } else {
      // Far stars (original distance)
      radius = Math.random() * 6000 + 12200; // 12200-18200 units
      starSize = 0.2 + Math.random() * 0.3;
    }
    
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);

    return {
      pos: new THREE.Vector3(x, y, z),
      hue: 0.6,
      minDist: radius,
      size: starSize,
      layer: layer,
    };
  }
  const verts = [];
  const colors = [];
  const sizes = [];
  const positions = [];
  let col;
  
  // Distribute stars across different layers
  const starsPerLayer = Math.floor(numStars / (layers + 1));
  
  for (let layer = 0; layer <= layers; layer++) {
    const layerStars = layer === layers ? numStars - (layer * starsPerLayer) : starsPerLayer;
    
    for (let i = 0; i < layerStars; i += 1) {
      let p = randomSpherePoint(layer);
      const { pos, hue, size } = p;
      positions.push(p);
      
      // Vary colors slightly based on distance (closer stars slightly warmer)
      const hueVariation = layer === 0 ? 0.05 : 0.6;
      col = new THREE.Color().setHSL(hueVariation, 0.02, Math.random());
      
      verts.push(pos.x, pos.y, pos.z);
      colors.push(col.r, col.g, col.b);
      sizes.push(size);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
  
  const mat = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    sizeAttenuation: true, // Makes closer stars appear larger
    map: new THREE.TextureLoader().load(
      "./textures/stars/circle.png"
    ),
  });
  const points = new THREE.Points(geo, mat);
  return points;
}
