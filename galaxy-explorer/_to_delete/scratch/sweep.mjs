const THREE = await import('../../vendor/three.module.js');
const { generateSystem } = await import('../../system.mjs'); const { terrainFor } = await import('../../terrain.mjs');
const { buildFauna } = await import('../../fauna-mesh.js'); const { buildStructures } = await import('../../structures-mesh.js'); const { faunaFor } = await import('../../fauna.mjs');
const N = +process.argv[2] || 3000, stats = {}, cultures = {}, examples = {};
let fails = 0, worst = 0, worstAt = '';
for (let s = 0; s < N; s++) for (const body of generateSystem(s).bodies) {
  if (!faunaFor(body).species.some(x => x.civilization)) continue;
  const terrain = terrainFor(body), sig = new THREE.Vector3(...terrain.site), land = new THREE.Vector3(0, 1, 30 / body.radius).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sig));
  const fauna = buildFauna(THREE, { body, terrain, radius: body.radius, signalNormal: sig, budget: 90 });
  const t0 = performance.now(); const st = buildStructures(THREE, { body, terrain, radius: body.radius, signalNormal: sig, landingNormal: land, fauna }); const ms = performance.now() - t0;
  if (ms > worst) { worst = ms; worstAt = `${s}:${body.id}`; }
  if (!st.civ) { fails++; continue; }
  const L = st.civ.level; (stats[L] ||= []).push(st.pieces);
  cultures[st.civ.culture] = (cultures[st.civ.culture] || 0) + 1;
  const key = `${L}-${st.civ.culture}`; if (!examples[key]) examples[key] = `${s}:${body.id}`;
  const verts = st.group.children.reduce((a, m) => a + (m.geometry?.attributes.position.count || 0), 0); if (verts > 400000) console.log('BIG', s, body.id, verts);
}
for (const k in stats) { const l = stats[k].sort((a, b) => a - b); console.log('level', k, 'worlds', l.length, 'pieces min', l[0], 'median', l[l.length >> 1]); }
console.log('no land:', fails, 'slowest', worst.toFixed(0), 'ms at', worstAt); console.log(cultures); console.log(JSON.stringify(examples));
