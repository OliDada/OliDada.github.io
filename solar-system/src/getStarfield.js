import * as THREE from "three";
export default function getStarfield({ numStars = 500, layers = 1, maxRadius = 110000000 } = {}) {
  const effectiveMaxRadius = maxRadius;
  function randomSpherePoint(layer = 0) {
    // Create different distance ranges for different layers, but clamp to maxRadius
    let radius;
    let starSize;
  let layerMax = effectiveMaxRadius;
    if (layer === 0) {
      radius = Math.random() * Math.min(500000, layerMax - 1000000) + 1000000;
      starSize = 0.1 + Math.random() * 0.2;
    } else if (layer === 1) {
      radius = Math.random() * Math.min(1000000, layerMax - 1500000) + 1500000;
      starSize = 0.15 + Math.random() * 0.25;
    } else if (layer === 2) {
      radius = Math.random() * Math.min(2000000, layerMax - 2500000) + 2500000;
      starSize = 0.15 + Math.random() * 0.25;
    } else {
      // Far stars - deep space background
      radius = Math.random() * Math.min(5000000, layerMax - 5000000) + 5000000;
      // Clamp to maxRadius
      if (radius > layerMax) radius = layerMax;
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
