import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem } from './system.mjs';
import { worldEntries } from './objectives.mjs';
import { rarityOf, RARITIES, rarityAtLeast } from './rarity.mjs';
import { UPGRADES, needProgress } from './upgrades.mjs';
import { valueOf } from './contact.mjs';
import { civilizationsIn } from './civilizations.mjs';

const sample = [];
for (let s = 0; s < 80; s++) { const sys = generateSystem(s * 7919 + 13); for (const b of sys.bodies) for (const e of worldEntries(sys, b)) if (e.kind !== 'field-note') sample.push(e); }

test('rarity grades spread like a pyramid across the galaxy', () => {
  const n = sample.length, share = (g) => sample.filter((e) => rarityOf(e) === g).length / n;
  assert.ok(share('common') > .5 && share('common') < .8, `common ${share('common')}`);
  assert.ok(share('uncommon') > share('rare') && share('rare') > share('exceptional'), 'fewer the rarer');
  assert.ok(share('legendary') > 0 && share('legendary') < .03, `legendary ${share('legendary')}`);
  for (const e of sample.slice(0, 200)) assert.equal(rarityOf(e), rarityOf(JSON.parse(JSON.stringify(e))), 'the same from a saved entry');
});

test('rare finds count toward the upgrade line, and are worth more in trade', () => {
  const need = UPGRADES.jumpDrive3.needs.find((x) => x.rarity);
  const rare = sample.filter((e) => need.kind.includes(e.kind) && rarityAtLeast(rarityOf(e), 'rare')).slice(0, 2), common = sample.filter((e) => rarityOf(e) === 'common').slice(0, 5);
  assert.equal(needProgress(need, common).have, 0);
  assert.ok(needProgress(need, rare).done);
  const civ = (() => { for (let s = 0; s < 5000; s++) { const c = civilizationsIn(generateSystem(s)).find((x) => x.tier === 'spacefarers'); if (c) return c; } })();
  const a = sample.find((e) => e.kind === 'flora' && rarityOf(e) === 'common'), b = sample.find((e) => e.kind === 'flora' && rarityAtLeast(rarityOf(e), 'rare'));
  assert.ok(valueOf({ ...civ, path: 'martial' }, b) > valueOf({ ...civ, path: 'martial' }, a));
  assert.ok(RARITIES.length === 5);
});
