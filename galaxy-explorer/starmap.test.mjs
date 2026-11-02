import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem } from './system.mjs';
import { LIFE_RARITY, rarityText } from './starmap.js';

test('life rarity shown on the map matches the galaxy', () => {
  const count = { carbon: {}, exotic: {} };
  let n = 0;
  for (let s = 0; s < 2500; s++) for (const b of generateSystem(s).bodies) {
    n++;
    const life = b.physics.life;
    if (life === 'none') { assert.equal(rarityText(b), ''); continue; }
    const kind = b.physics.biochemistry && b.physics.biochemistry !== 'carbon' ? 'exotic' : 'carbon';
    count[kind][life] = (count[kind][life] || 0) + 1;
    assert.match(rarityText(b), /about 1 world in \d+/);
  }
  for (const kind of ['carbon', 'exotic']) for (const [life, oneIn] of Object.entries(LIFE_RARITY[kind])) {
    const actual = n / (count[kind][life] || 1);
    assert.ok(actual > oneIn * .7 && actual < oneIn * 1.4, `${kind} ${life}: 1 in ${actual.toFixed(0)}, map says 1 in ${oneIn}`);
  }
});
