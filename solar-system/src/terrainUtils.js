// src/terrainUtils.js
import { SimplexNoise } from './createPlanetSurface.js';

export function getTerrainHeight(x, y, terrainSimplex) {
  let elevation = 0;
  elevation += terrainSimplex.noise(x * 0.0002, y * 0.0002) * 400;
  elevation += terrainSimplex.noise(x * 0.001, y * 0.001) * 60;
  elevation += terrainSimplex.noise(x * 0.005, y * 0.005) * 10;
  return elevation;
}

export function getTerrainHeightAtCamera(camera, getTerrainHeight) {
  const meshHalfSize = 25000;
  let meshX = Math.max(-meshHalfSize, Math.min(meshHalfSize, camera.position.x));
  let meshY = Math.max(-meshHalfSize, Math.min(meshHalfSize, camera.position.z));
  return getTerrainHeight(meshX, meshY);
}

export function getNearestGroundHeight(x, y, surfaceScene) {
  let nearestZ = 0;
  let minDist = Infinity;
  if (surfaceScene) {
    const ground = surfaceScene.children.find(obj => obj.type === 'Mesh');
    if (ground && ground.geometry && ground.geometry.attributes.position) {
      const pos = ground.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const dist = Math.hypot(x - vx, y - vy);
        if (dist < minDist) {
          minDist = dist;
          nearestZ = vz;
        }
      }
    }
  }
  return nearestZ;
}

export function getInterpolatedGroundHeight(x, y, surfaceScene) {
  let ground = surfaceScene && surfaceScene.children.find(obj => obj.type === 'Mesh');
  if (!ground || !ground.geometry || !ground.geometry.attributes.position) return 0;
  const pos = ground.geometry.attributes.position;
  const segments = 300;
  const size = 50000;
  const halfSize = size / 2;
  const fx = ((x + halfSize) / size) * segments;
  const fy = ((y + halfSize) / size) * segments;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  function idx(i, j) { return i + j * (segments + 1); }
  const i0 = Math.max(0, Math.min(segments, ix));
  const i1 = Math.max(0, Math.min(segments, ix + 1));
  const j0 = Math.max(0, Math.min(segments, iy));
  const j1 = Math.max(0, Math.min(segments, iy + 1));
  const z00 = pos.getZ(idx(i0, j0));
  const z10 = pos.getZ(idx(i1, j0));
  const z01 = pos.getZ(idx(i0, j1));
  const z11 = pos.getZ(idx(i1, j1));
  const z0 = z00 * (1 - tx) + z10 * tx;
  const z1 = z01 * (1 - tx) + z11 * tx;
  return z0 * (1 - ty) + z1 * ty;
}
