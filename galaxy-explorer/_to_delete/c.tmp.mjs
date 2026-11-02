const base = process.argv[2];
const { generateSystem } = await import(base + '/system.mjs'); const { starById } = await import(base + '/galaxy.mjs'); const { terrainFor } = await import(base + '/terrain.mjs');
const b = generateSystem(starById('-928_1272_-3_0').seed).bodies.find(b => b.id === 'planet-6');
const t = terrainFor(b), n = { x: t.site[0], y: t.site[1], z: t.site[2] };
console.log(b.biome, b.physics.temperature, b.physics.solvent, b.physics.biochemistry, b.palette, t.liquid, t.color(n, t.height(n)), t.climate(n));
