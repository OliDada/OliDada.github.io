// Crucible (the falling sand game, discovery edition).
// Start with Sand, Water, Fire and Earth. Everything else is discovered by making it happen.
// To add a material: one def() line, an R() line or two for how it is made, and (only if it does
// something special) a case in tick(). Nothing else needs touching.
// Materials are data (MATS) + reactions (R). Add new things by adding a def() and some R() lines.

// ================= materials =================
const MATS = [{ key: 'empty', name: 'Empty', kind: 'empty' }];
const M = { empty: 0 };
function def(key, o) { o.key = key; o.id = MATS.length; MATS.push(o); M[key] = o.id; }

// kinds: powder, liquid, gas, solid, fire, cloud, bolt, spark, rocket, fish, bee, ant
// cat (toolbar tab) is worked out from the kind unless given: powder, liquid, gas, solid, energy, life
def('sand',   { name: 'Sand',  kind: 'powder', dens: 2, slide: 1, start: true, dot: '#f2ca79' });
def('water',  { name: 'Water', kind: 'liquid', dens: 1, spread: 4, color: [46, 169, 230], anim: 'water', start: true });
def('fire',   { glow: true, name: 'Fire',  kind: 'fire', anim: 'fire', hot: true, life: [40, 100], start: true, dot: '#ff8a2a' });
def('earth',  { name: 'Earth', kind: 'powder', dens: 2, slide: 0.15, color: [112, 80, 52], vary: 0.3, start: true });

def('steam',  { name: 'Steam', kind: 'gas', life: [160, 255], color: [205, 215, 228], anim: 'steam', decay: ['water', 0.3], hint: 'Fire meets water' });
def('cloud',  { name: 'Cloud', kind: 'cloud', life: [20, 45], color: [222, 228, 238], vary: 0.08, hint: 'Steam that reaches the sky' });
def('mud',    { name: 'Mud', kind: 'liquid', dens: 1.6, spread: 1, visc: 0.25, color: [92, 62, 38], vary: 0.2, hint: 'Earth soaks up water' });
def('brick',  { name: 'Brick', kind: 'solid', tough: true, color: [168, 72, 52], vary: 0.25, hint: 'Bake some mud' });
def('stone',  { name: 'Stone', kind: 'powder', dens: 2.5, slide: 0.25, color: [150, 143, 135], vary: 0.25, hint: 'Heat earth for a long time' });
def('lava',   { glow: true, name: 'Lava', kind: 'liquid', dens: 2.5, spread: 2, visc: 0.35, hot: true, anim: 'lava', dot: '#ff5a1a', hint: 'Melt stone in a fire' });
def('glass',  { name: 'Glass', kind: 'solid', acidproof: true, color: [175, 215, 228], vary: 0.08, anim: 'sparkle', hint: 'Sand meets lava' });
def('obsidian', { need: 10, name: 'Obsidian', kind: 'solid', tough: true, color: [52, 34, 70], vary: 0.35, hint: 'Cool lava very fast with something cold' });
def('snow',   { name: 'Snow', kind: 'powder', dens: 0.9, slide: 0.3, cold: true, color: [238, 244, 255], vary: 0.06, hint: 'Throw water into a cloud' });
def('ice',    { name: 'Ice', kind: 'solid', cold: true, color: [170, 215, 240], vary: 0.15, hint: 'Water touching snow' });
def('salt',   { need: 10, name: 'Salt', kind: 'powder', dens: 1.8, slide: 0.9, color: [236, 236, 236], vary: 0.08, hint: 'Water slowly wears stone away' });
def('saltwater', { name: 'Salt water', kind: 'liquid', dens: 1.1, spread: 4, color: [38, 138, 168], anim: 'water', hint: 'Salt dissolves in water' });
def('plant',  { name: 'Plant', kind: 'solid', cat: 'life', grow: [6, 16], color: [64, 175, 70], vary: 0.35, flammable: [0.08, 'fire'], hint: 'Leave some mud alone for a while' });
def('flower', { need: 3, name: 'Flower', kind: 'solid', cat: 'life', anim: 'flower', flammable: [0.1, 'fire'], dot: '#f05a78', hint: 'Let a plant grow tall' });
def('wood',   { need: 6, name: 'Wood', kind: 'solid', color: [125, 82, 46], vary: 0.35, flammable: [0.03, 'ember'], hint: 'Old, thick plants' });
def('ember',  { glow: true, need: 6, name: 'Ember', kind: 'solid', cat: 'energy', hot: true, life: [150, 250], anim: 'ember', dot: '#e0461a', hint: 'Set wood on fire' });
def('charcoal', { name: 'Charcoal', kind: 'powder', dens: 1.4, slide: 0.5, color: [44, 41, 41], vary: 0.3, flammable: [0.01, 'ember'], hint: 'Put out burning wood' });
def('ash',    { name: 'Ash', kind: 'powder', dens: 0.8, slide: 0.6, color: [150, 148, 145], vary: 0.2, hint: 'Let wood burn all the way out' });
def('smoke',  { name: 'Smoke', kind: 'gas', life: [40, 110], anim: 'smoke', dot: '#555', hint: 'Fire burning out' });
def('cement', { name: 'Cement', kind: 'powder', dens: 2, slide: 0.5, color: [178, 176, 168], vary: 0.1, hint: 'Ash + sand' });
def('concrete', { name: 'Concrete', kind: 'solid', tough: true, color: [138, 138, 136], vary: 0.15, hint: 'Wet cement' });
def('oil',    { name: 'Oil', kind: 'liquid', dens: 0.8, spread: 3, anim: 'oil', flammable: [0.3, 'fire'], dot: '#6b4a22', hint: 'Bury ash in mud' });
def('gas',    { name: 'Gas', kind: 'gas', life: [200, 255], slowFade: true, anim: 'gas', flammable: [0.9, 'fire'], dot: '#8fbf6a', hint: 'Plants rotting in mud' });
def('acid',   { name: 'Acid', kind: 'liquid', dens: 1.05, spread: 3, anim: 'acid', eats: true, acidproof: true, dot: '#9cf03c', hint: 'Ash in salt water' });
def('slime',  { name: 'Slime', kind: 'liquid', dens: 1.2, spread: 1, visc: 0.2, anim: 'slime', acidproof: true, dot: '#6fd14a', hint: 'Acid + mud' });
def('gunpowder', { name: 'Gunpowder', kind: 'powder', dens: 1.5, slide: 0.8, color: [62, 62, 68], vary: 0.4, flammable: [1, 'explode'], hint: 'Charcoal + salt' });
def('metal',  { need: 10, name: 'Metal', kind: 'solid', tough: true, color: [160, 166, 176], vary: 0.1, anim: 'sheen', hint: 'Charcoal + lava' });
def('rust',   { need: 8, name: 'Rust', kind: 'powder', dens: 2, slide: 0.4, color: [160, 82, 40], vary: 0.3, hint: 'Metal left in water' });
def('diamond', { need: 4, name: 'Diamond', kind: 'solid', tough: true, acidproof: true, color: [200, 245, 255], anim: 'sparkle', hint: 'Charcoal + obsidian' });

// --- weather
def('stormcloud', { name: 'Storm cloud', kind: 'cloud', storm: true, life: [40, 80], color: [96, 100, 118], vary: 0.2, hint: 'Smoke drifting into a cloud' });
def('lightning', { glow: true, need: 1, name: 'Lightning', kind: 'bolt', hot: true, life: [3, 6], anim: 'bolt', dot: '#fff7a8', hint: 'Storm clouds get angry' });

// --- pottery, soap, chemistry
def('clay',   { name: 'Clay', kind: 'powder', dens: 2, slide: 0.05, color: [176, 122, 92], vary: 0.15, hint: 'Mud + sand' });
def('pottery', { name: 'Pottery', kind: 'solid', color: [212, 132, 88], vary: 0.12, hint: 'Bake some clay' });
def('soap',   { name: 'Soap', kind: 'powder', dens: 1.3, slide: 0.3, color: [244, 206, 226], vary: 0.1, hint: 'Ash + oil' });
def('bubble', { name: 'Bubble', kind: 'gas', life: [60, 160], anim: 'bubble', dot: '#bfe6ff', hint: 'Get soap wet' });
def('nitro',  { name: 'Nitro', kind: 'liquid', dens: 1.3, spread: 2, color: [226, 232, 150], vary: 0.12, flammable: [1, 'explode'], blast: 1.7, hint: 'Oil + acid' });
def('thermite', { name: 'Thermite', kind: 'powder', dens: 2.2, slide: 0.5, color: [150, 92, 74], vary: 0.45, flammable: [0.4, 'molten'], hint: 'Rust + gunpowder' });
def('molten', { glow: true, need: 8, name: 'Molten metal', kind: 'liquid', dens: 3, spread: 2, visc: 0.5, hot: true, anim: 'molten', dot: '#ffd98a', hint: 'Melt metal in lava' });
def('firework', { need: 8, name: 'Firework', kind: 'powder', dens: 1.5, slide: 0.6, color: [214, 64, 100], vary: 0.5, flammable: [1, 'rocket'], hint: 'Gunpowder + a flower' });
def('rocket', { glow: true, name: 'Rocket', kind: 'rocket', hot: true, life: [28, 60], anim: 'bolt', hidden: true });
def('spark',  { glow: true, name: 'Spark', kind: 'spark', hot: true, life: [20, 50], anim: 'spark', brush: 0.25, dot: '#ffd24a', hint: 'Light a firework' });
def('torch',  { glow: true, need: 6, name: 'Torch', kind: 'solid', cat: 'energy', anim: 'torch', dot: '#c88a3c', flammable: [0.5, 'light'], hint: 'Soak wood in oil' });
def('dye',    { name: 'Dye', kind: 'liquid', need: 8, rainbow: true, dens: 1, spread: 4, anim: 'dye', dot: '#e05ad0', hint: 'Drop a flower in water' });

// --- living things
def('seed',   { need: 3, name: 'Seed', kind: 'powder', cat: 'life', dens: 0.9, slide: 0.4, brush: 0.12, color: [200, 164, 96], vary: 0.3, flammable: [0.1, 'fire'], hint: 'Flowers drop them eventually' });
def('grass',  { need: 6, name: 'Grass', kind: 'solid', cat: 'life', grow: [1, 4], color: [110, 200, 80], vary: 0.3, flammable: [0.15, 'fire'], hint: 'A seed on earth' });
def('cactus', { need: 6, name: 'Cactus', kind: 'solid', cat: 'life', grow: [4, 12], color: [58, 138, 84], vary: 0.2, flammable: [0.01, 'fire'], hint: 'A seed on sand' });
def('seaweed', { need: 6, name: 'Seaweed', kind: 'solid', cat: 'life', life: [4, 14], color: [36, 138, 104], vary: 0.3, flammable: [0.03, 'fire'], hint: 'A plant in salt water' });
def('fish',   { name: 'Fish', kind: 'fish', life: [200, 255], brush: 0.04, anim: 'fish', dot: '#ff9a3c', flammable: [0.3, 'smoke'], hint: 'Something lives in the seaweed' });
def('bee',    { name: 'Bee', kind: 'bee', life: [150, 255], brush: 0.03, anim: 'bee', dot: '#ffd21e', flammable: [0.6, 'fire'], hint: 'Flowers attract them' });
def('honey',  { need: 4, name: 'Honey', kind: 'liquid', dens: 1.4, spread: 1, visc: 0.15, anim: 'honey', dot: '#e8a628', hint: 'Let bees visit flowers' });
def('ant',    { name: 'Ant', kind: 'ant', life: [150, 255], brush: 0.05, color: [214, 84, 52], vary: 0.2, flammable: [0.5, 'fire'], hint: 'Something sweet on the ground' });

// --- sweet things
def('wax',    { name: 'Wax', kind: 'solid', color: [240, 226, 172], vary: 0.08, flammable: [0.03, 'fire'], hint: 'Chill some honey' });
def('caramel', { name: 'Caramel', kind: 'liquid', dens: 1.5, spread: 1, visc: 0.08, color: [176, 100, 32], vary: 0.15, hint: 'Heat some honey' });
def('amber',  { need: 3, name: 'Amber', kind: 'solid', color: [244, 164, 34], anim: 'sparkle', hint: 'An ant gets stuck in something sweet' });
def('fuse',   { need: 8, name: 'Fuse', kind: 'solid', cat: 'energy', color: [176, 150, 112], vary: 0.3, flammable: [0.6, 'fire'], hint: 'Gunpowder + wax' });
def('dynamite', { need: 6, name: 'Dynamite', kind: 'solid', cat: 'energy', color: [206, 52, 52], vary: 0.15, flammable: [1, 'explode'], blast: 2.4, hint: 'Nitro + clay' });

// --- metals, rocks, gems
def('steel',  { need: 10, name: 'Steel', kind: 'solid', tough: true, color: [110, 128, 150], vary: 0.1, anim: 'sheen', hint: 'Metal + charcoal' });
def('mercury', { need: 10, name: 'Mercury', kind: 'liquid', dens: 4, spread: 4, acidproof: true, color: [200, 206, 216], anim: 'sheen', hint: 'Rust + acid' });
def('gold',   { need: 3, name: 'Gold', kind: 'powder', dens: 3.2, slide: 0.4, acidproof: true, color: [255, 206, 60], anim: 'sparkle', hint: 'Hidden in sand under the sea' });
def('mirror', { need: 8, name: 'Mirror', kind: 'solid', color: [214, 228, 238], anim: 'sheen', hint: 'Glass + molten metal' });
def('crystal', { need: 8, name: 'Crystal', kind: 'solid', color: [188, 150, 255], anim: 'sparkle', hint: 'Freeze salt water' });
def('pumice', { name: 'Pumice', kind: 'powder', dens: 0.7, slide: 0.3, color: [172, 166, 160], vary: 0.35, hint: 'Lava meets the sea' });
def('sulfur', { name: 'Sulfur', kind: 'powder', dens: 1.6, slide: 0.6, color: [228, 210, 62], vary: 0.2, need: 10, flammable: [0.02, 'fumes'], hint: 'Lava + salt' });
def('tar',    { name: 'Tar', kind: 'liquid', dens: 1.5, spread: 1, visc: 0.08, color: [58, 50, 66], vary: 0.4, flammable: [0.1, 'fire'], hint: 'Oil + charcoal' });
def('asphalt', { name: 'Asphalt', kind: 'solid', tough: true, color: [78, 78, 86], vary: 0.3, hint: 'Tar + stone' });
def('rubber', { name: 'Rubber', kind: 'solid', acidproof: true, color: [228, 122, 132], vary: 0.1, hint: 'Cook some slime' });
def('colorsand', { name: 'Rainbow sand', kind: 'powder', dens: 2, slide: 1, rainbow: true, anim: 'tint', dot: '#e88ad0', hint: 'Sand + dye' });
def('stainedglass', { name: 'Stained glass', kind: 'solid', acidproof: true, rainbow: true, anim: 'tintglass', dot: '#7ad0e8', hint: 'Glass + dye' });
def('gem',    { need: 4, name: 'Gem', kind: 'solid', tough: true, acidproof: true, rainbow: true, anim: 'gem', dot: '#ff5a8a', hint: 'Diamond + dye' });

// --- gases
def('hydrogen', { name: 'Hydrogen', kind: 'gas', need: 4, life: [200, 255], slowFade: true, color: [120, 140, 205], vary: 0.3, flammable: [0.3, 'explode'], blast: 0.5, hint: 'Lightning strikes salt water' });
def('fumes',  { name: 'Fumes', kind: 'gas', need: 12, life: [120, 220], color: [176, 190, 60], vary: 0.3, hint: 'Heat some acid' });

// --- more living things
def('lily',   { need: 3, name: 'Lily pad', kind: 'powder', cat: 'life', dens: 0.6, slide: 0, anim: 'lily', dot: '#58b070', flammable: [0.1, 'fire'], hint: 'A seed on water' });
def('mushroom', { need: 3, name: 'Mushroom', kind: 'solid', cat: 'life', life: [2, 5], anim: 'mushroom', dot: '#d04038', flammable: [0.1, 'fire'], hint: 'Wood rotting in mud' });
def('bone',   { need: 2, name: 'Bone', kind: 'powder', dens: 1.6, slide: 0.4, color: [234, 228, 208], vary: 0.1, hint: 'A fish out of water' });
def('pearl',  { need: 1, name: 'Pearl', kind: 'powder', dens: 1.5, slide: 0.8, color: [246, 238, 232], anim: 'sparkle', hint: 'Fish hide them in the sand' });
def('coral',  { need: 5, name: 'Coral', kind: 'solid', cat: 'life', life: [3, 9], color: [255, 122, 134], vary: 0.3, hint: 'Bones under the sea' });
def('firefly', { glow: true, name: 'Firefly', kind: 'bee', life: [150, 255], brush: 0.03, anim: 'firefly', dot: '#c8ff5a', flammable: [0.6, 'fire'], hint: 'Long grass after dark' });
def('butterfly', { name: 'Butterfly', kind: 'bee', life: [150, 255], brush: 0.03, anim: 'butterfly', dot: '#ff8ad8', flammable: [0.6, 'fire'], hint: 'A bee takes a dip in dye' });

// --- things that only happen at certain times of day
def('moonflower', { need: 2, name: 'Moonflower', kind: 'solid', cat: 'life', glow: true, anim: 'moonflower', dot: '#cfe0ff', flammable: [0.1, 'fire'], hint: 'A plant that blooms in the dark' });
def('frost',  { need: 6, name: 'Frost', kind: 'solid', cold: true, color: [222, 238, 252], anim: 'sparkle', hint: 'Grass on a cold night' });
def('stardust', { need: 1, name: 'Stardust', kind: 'powder', dens: 1.2, slide: 0.7, glow: true, anim: 'stardust', dot: '#d8e2ff', hint: 'Catch a falling star' });
def('meteor', { name: 'Shooting star', kind: 'meteor', glow: true, life: [40, 200], anim: 'bolt', hidden: true });

// --- endgame
def('void',   { need: 1, name: 'Void', kind: 'solid', tough: true, acidproof: true, anim: 'void', dot: '#3a1466', hint: 'Lightning strikes a diamond' });

const EMPTY = 0;
const N = MATS.length;
const KIND_CAT = { meteor: 'energy', powder: 'powder', liquid: 'liquid', gas: 'gas', cloud: 'gas', solid: 'solid', fire: 'energy', bolt: 'energy', spark: 'energy', rocket: 'energy', fish: 'life', bee: 'life', ant: 'life' };
const CATS = [['powder', 'Powders'], ['liquid', 'Liquids'], ['gas', 'Gases'], ['solid', 'Solids'], ['energy', 'Energy'], ['life', 'Life']];
const CAP = { bee: 30, fish: 40, seed: 150, firefly: 25 }; // so living things never take over
for (const m of MATS) {
  if (!m.color) m.color = [0, 0, 0];
  if (m.vary == null) m.vary = 0;
  if (!m.dot) m.dot = `rgb(${m.color.join(',')})`;
  if (!m.cat) m.cat = KIND_CAT[m.kind];
  if (m.need == null) m.need = KIND_CAT[m.kind] === 'life' && m.kind !== 'solid' && m.kind !== 'powder' ? 1 : 24;
  m.thin = m.kind === 'gas' || m.kind === 'fire' || m.kind === 'spark' || m.kind === 'bolt'; // things can fall through it
}
const isWet = (t) => t === M.water || t === M.saltwater || t === M.dye;

// ================= reactions =================
// R(a, b, chance, aBecomes, bBecomes): when a touches b. null = unchanged, 'empty' = gone.
// A sixth argument of true makes the new a take b's colour (for dyed things).
// b can be '#hot' (fire, lava, embers) or '#cold' (snow, ice).
const REACT = Array.from({ length: N }, () => []);
function R(a, b, chance, aInto, bInto, tint) {
  const id = (k) => (k == null ? -1 : M[k]);
  const label = (k) => (k === '#hot' ? 'heat' : k === '#cold' ? 'cold' : MATS[M[k]].name);
  const how = `${label(a)} + ${label(b)}`;
  const tag = b[0] === '#' ? b : null;
  REACT[M[a]].push({ b: tag ? -1 : M[b], tag, chance, aInto: id(aInto), bInto: id(bInto), how, tintI: !!tint });
  if (!tag) REACT[M[b]].push({ b: M[a], tag: null, chance, aInto: id(bInto), bInto: id(aInto), how, tintJ: !!tint });
}
R('water', 'fire', 0.5, 'steam', 'empty');
R('water', 'lava', 0.5, 'steam', 'stone');
R('water', 'ember', 0.5, 'steam', 'charcoal');
R('earth', 'water', 0.05, 'mud', 'empty');
R('mud', '#hot', 0.03, 'brick', null);
R('earth', '#hot', 0.01, 'stone', null);
R('stone', 'fire', 0.012, 'lava', null);
R('stone', 'ember', 0.004, 'lava', null);
R('sand', 'lava', 0.02, 'glass', null);
R('lava', 'snow', 0.3, 'obsidian', 'water');
R('lava', 'ice', 0.3, 'obsidian', 'water');
R('water', 'cloud', 0.2, 'snow', null);
R('water', 'snow', 0.01, 'ice', null);
R('water', 'ice', 0.002, 'ice', null);
R('snow', '#hot', 0.2, 'water', null);
R('ice', '#hot', 0.06, 'water', null);
R('ice', 'salt', 0.1, 'water', 'empty');
R('snow', 'salt', 0.1, 'water', 'empty');
R('salt', 'water', 0.1, 'empty', 'saltwater');
R('saltwater', '#hot', 0.1, 'salt', null);
R('stone', 'water', 0.0004, 'salt', null);
R('ash', 'sand', 0.05, 'cement', 'empty');
R('cement', 'water', 0.03, 'concrete', 'empty');
R('ash', 'mud', 0.01, 'oil', 'empty');
R('plant', 'mud', 0.0004, null, 'gas');
R('ash', 'saltwater', 0.02, 'empty', 'acid');
R('acid', 'mud', 0.05, 'slime', 'empty');
R('charcoal', 'salt', 0.05, 'gunpowder', 'empty');
R('charcoal', 'lava', 0.02, 'metal', null);
R('metal', 'water', 0.0008, 'rust', null);
R('charcoal', 'obsidian', 0.01, 'diamond', null);

R('cloud', 'smoke', 0.3, 'stormcloud', 'empty');
R('stormcloud', 'cloud', 0.001, null, 'stormcloud');
R('sand', 'lightning', 1, 'glass', null);
R('water', 'lightning', 0.5, 'steam', null);
R('diamond', 'lightning', 1, 'void', null);
R('mud', 'sand', 0.01, 'clay', 'empty');
R('clay', '#hot', 0.03, 'pottery', null);
R('ash', 'oil', 0.03, 'soap', 'empty');
R('soap', 'water', 0.03, 'bubble', null);
R('oil', 'acid', 0.05, 'nitro', 'empty');
R('rust', 'gunpowder', 0.05, 'thermite', 'empty');
R('metal', 'lava', 0.004, 'molten', null);
R('molten', 'water', 0.5, 'metal', 'steam');
R('sand', 'molten', 0.02, 'glass', null);
R('gunpowder', 'flower', 0.05, 'firework', 'empty');
R('wood', 'oil', 0.02, 'torch', 'empty');
R('plant', 'saltwater', 0.01, 'seaweed', null);
R('honey', 'earth', 0.004, 'ant', null);
R('earth', 'dye', 0.05, 'mud', 'empty');
R('dye', 'fire', 0.5, 'steam', 'empty');

R('honey', '#cold', 0.03, 'wax', null);
R('honey', '#hot', 0.03, 'caramel', null);
R('honey', 'ant', 0.05, 'amber', 'empty');
R('gunpowder', 'wax', 0.05, 'fuse', 'empty');
R('nitro', 'clay', 0.05, 'dynamite', 'empty');
R('metal', 'charcoal', 0.005, 'steel', 'empty');
R('rust', 'acid', 0.05, 'mercury', 'empty');
R('sand', 'saltwater', 0.00003, 'gold', null);
R('glass', 'molten', 0.05, 'mirror', null);
R('saltwater', '#cold', 0.01, 'crystal', null);
R('saltwater', 'lava', 0.5, 'steam', 'pumice');
R('lava', 'salt', 0.05, null, 'sulfur');
R('sulfur', 'charcoal', 0.05, 'gunpowder', 'empty');
R('oil', 'charcoal', 0.02, 'tar', 'empty');
R('tar', 'stone', 0.03, 'asphalt', 'empty');
R('slime', '#hot', 0.03, 'rubber', null);
R('sand', 'dye', 0.05, 'colorsand', 'empty', true);
R('glass', 'dye', 0.03, 'stainedglass', 'empty', true);
R('diamond', 'dye', 0.03, 'gem', 'empty', true);
R('saltwater', 'lightning', 1, 'hydrogen', null);
R('acid', '#hot', 0.3, 'fumes', null);
for (const k of ['plant', 'flower', 'grass', 'seed', 'cactus', 'seaweed', 'lily', 'mushroom', 'coral', 'fish', 'bee', 'ant', 'firefly', 'butterfly']) R('fumes', k, 0.3, 'empty', 'empty');
R('wood', 'mud', 0.0005, null, 'mushroom');
R('fish', 'sand', 0.0005, null, 'pearl');
R('bone', 'saltwater', 0.01, 'coral', null);
R('bee', 'spark', 1, 'firefly', 'empty');
R('bee', 'dye', 0.3, 'butterfly', 'empty', true);
R('frost', '#hot', 0.2, 'water', null);
R('seed', 'stardust', 0.2, 'moonflower', 'empty');

// ================= time of day =================
// dayT goes 0 -> 1 over one day: 0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk. It only moves while the world runs.
const DAY_STEPS = 18000; // about five minutes
let dayT = 0.68, clockOn = true;
let sunE = 0, daylight = 0, wN = 0, wK = 0, wD = 0, LR = 1, LG = 1, LB = 1;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function updateTime(advance) {
  if (advance && clockOn) dayT = (dayT + 1 / DAY_STEPS) % 1;
  sunE = Math.sin(6.2832 * (dayT - 0.25)); // how high the sun is, -1 to 1
  daylight = smooth(-0.1, 0.3, sunE);
  wD = smooth(-0.05, 0.35, sunE); wN = smooth(0.05, -0.3, sunE); wK = Math.max(0, 1 - Math.abs(sunE) / 0.32);
  const sum = wD + wN + wK; wD /= sum; wN /= sum; wK /= sum;
  // how things on the ground are lit: bluish at night, warm at dusk
  LR = wD + wK * 1.0 + wN * 0.64; LG = wD + wK * 0.88 + wN * 0.7; LB = wD + wK * 0.8 + wN * 0.9;
}
const isNight = () => daylight < 0.15;
function timeName() { if (sunE > 0.3) return 'Day'; if (sunE < -0.15) return 'Night'; return dayT < 0.5 ? 'Dawn' : 'Dusk'; }

// ================= state =================
let cols = 0, rows = 0, cell = 3;
let type, shade, life, stamp;
let clock = 1, img, paused = false;
let brush = M.sand, brushScale = 1;
let pointerDown = false, lastCell = null, pointerCell = null;
let how = '';
let census = new Uint32Array(N), censusNext = new Uint32Array(N); // how many of each thing there were last step
const STORE = 'olid-sand-discoveries-v1';
let found = {}; // key -> how it was found
let pending = {}; // key -> how it first appeared (not counted as found until there's enough of it)
const queued = new Set(); // found, but its pop-up hasn't been shown yet
const toastQ = [];
let toastBusy = false;
// the material list: one list in folding categories, plus a search box once there are lots
const FOLDS = 'olid-sand-folds-v1';
let grouped = false, query = '';
let folds = new Set(); // categories that are folded shut
try { folds = new Set(JSON.parse(localStorage.getItem(FOLDS)) || []); } catch (e) {}
const saveFolds = () => { try { localStorage.setItem(FOLDS, JSON.stringify([...folds])); } catch (e) {} };

const SAND_A = [242, 202, 121], SAND_B = [242, 161, 80];
const COLOR_CYCLE = 600;

function loadFound() {
  try { found = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { found = {}; }
  for (const m of MATS) if (m.start) found[m.key] = found[m.key] || 'Starting element';
}
function saveFound() { try { localStorage.setItem(STORE, JSON.stringify(found)); } catch (e) {} }
const findable = (m) => m.id && !m.hidden;
const totalFindable = () => MATS.filter(findable).length;
const foundCount = () => MATS.filter((m) => findable(m) && found[m.key] && !queued.has(m.key)).length;

function unlock(t, recipe) {
  const m = MATS[t];
  if (!m || !findable(m) || found[m.key]) return;
  found[m.key] = recipe || how || 'Found it';
  saveFound();
  queued.add(m.key);
  toastQ.push(m);
  if (!toastBusy) nextToast();
}

// anything that has appeared and now exists in a real amount becomes a discovery
function checkDiscoveries() {
  for (const k in pending) {
    if (found[k]) { delete pending[k]; continue; }
    const m = MATS[M[k]];
    if (!findable(m)) { delete pending[k]; continue; }
    if (censusNext[m.id] >= m.need) { unlock(m.id, pending[k]); delete pending[k]; }
  }
}

// ================= p5 =================
function setup() {
  loadFound();
  const c = createCanvas(10, 10);
  c.elt.style.touchAction = 'none';
  c.elt.style.display = 'block';
  noSmooth();
  buildUI();
  bindPointer(c.elt);
  resize();
  updateTime(false);
  if (foundCount() <= 4) hello();
}

function windowResized() { resize(); }

function resize() {
  layout();
  const W = windowWidth - panelW, H = windowHeight;
  cell = Math.max(2, Math.floor(Math.min(W, H) / 260));
  const nc = Math.floor(W / cell), nr = Math.floor(H / cell);
  resizeCanvas(nc * cell, nr * cell);
  noSmooth();
  const oT = type, oS = shade, oL = life, oc = cols, or = rows;
  cols = nc; rows = nr;
  type = new Uint8Array(cols * rows);
  shade = new Float32Array(cols * rows);
  life = new Uint8Array(cols * rows);
  stamp = new Uint32Array(cols * rows);
  if (oT) {
    const dy = rows - or;
    for (let y = 0; y < or; y++) for (let x = 0; x < Math.min(oc, cols); x++) {
      const ny = y + dy; if (ny < 0 || ny >= rows) continue;
      const o = x + y * oc, n = x + ny * cols;
      type[n] = oT[o]; shade[n] = oS[o]; life[n] = oL[o];
    }
  }
  img = createImage(cols, rows);
  makeSky();
}

let clockShown = '';
function updateClock(force) {
  if (!ui.clock) return;
  const name = timeName(), key = name + clockOn;
  if (key === clockShown && !force) return;
  clockShown = key;
  ui.clock.classList.toggle('moon', name === 'Night' || (name === 'Dusk' && sunE < 0));
  ui.clock.classList.toggle('stopped', !clockOn);
  ui.clock.innerHTML = `<i></i><span>${name}</span>${clockOn ? '' : '<small>stopped</small>'}`;
}

function draw() {
  paint();
  if (!paused) step();
  render();
  if (frameCount % 20 === 0) updateClock();
}

// ================= input =================
function bindPointer(el) {
  const toCell = (e) => {
    const r = el.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / r.width * cols), Math.floor((e.clientY - r.top) / r.height * rows)];
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerDown = true; el.setPointerCapture(e.pointerId);
    pointerCell = toCell(e); lastCell = null; e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => { if (pointerDown) pointerCell = toCell(e); });
  const up = () => { pointerDown = false; lastCell = null; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function paint() {
  if (!pointerDown || !pointerCell) return;
  const [x1, y1] = pointerCell;
  const [x0, y0] = lastCell || pointerCell;
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    stampBrush(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t));
  }
  lastCell = pointerCell;
}

function brushDensity(m) {
  if (!m.id) return 1;
  if (m.brush) return m.brush;
  switch (m.kind) {
    case 'solid': return 1;
    case 'fire': return 0.7;
    case 'liquid': return 0.5;
    case 'gas': case 'cloud': return 0.5;
    default: return 0.4;
  }
}

function stampBrush(cx, cy) {
  const m = MATS[brush];
  const d = brushDensity(m);
  const r = Math.max(1, Math.round(Math.max(3, cols / 55) * brushScale));
  how = '';
  if (brush === M.lightning) { // a bolt from the pointer down
    if (Math.random() < 0.35 && cx >= 0 && cx < cols && cy >= 0 && cy < rows) strike(cx, cy);
    return;
  }
  const hue = (frameCount % COLOR_CYCLE) / COLOR_CYCLE;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = x + y * cols;
    if (brush === EMPTY) { type[i] = EMPTY; continue; }
    if (type[i] !== EMPTY && !(brush === M.fish && isWet(type[i]))) continue;
    if (Math.random() > d) continue;
    place(i, brush);
    if (m.grow) life[i] = m.grow[0] + (Math.random() * (m.grow[1] - m.grow[0])) | 0;
    if (m.rainbow) shade[i] = hue; // slowly cycles through the rainbow as you paint
  }
}

function place(i, t) {
  type[i] = t;
  stamp[i] = clock;
  if (t === EMPTY) return;
  const m = MATS[t];
  shade[i] = t === M.sand ? ((frameCount + Math.random() * 40) % COLOR_CYCLE) / COLOR_CYCLE : Math.random();
  life[i] = m.life ? (m.life[0] + Math.random() * (m.life[1] - m.life[0])) | 0 : 0;
  if (!found[m.key] && !(m.key in pending)) pending[m.key] = how || 'Found it';
}

// ================= simulation =================
function move(a, b) {
  const t = type[a]; type[a] = type[b]; type[b] = t;
  const s = shade[a]; shade[a] = shade[b]; shade[b] = s;
  const l = life[a]; life[a] = life[b]; life[b] = l;
  stamp[a] = clock; stamp[b] = clock;
}

function randomNeighbour(x, i) {
  switch ((Math.random() * 4) | 0) {
    case 0: return x > 0 ? i - 1 : -1;
    case 1: return x < cols - 1 ? i + 1 : -1;
    case 2: return i >= cols ? i - cols : -1;
    default: return i < type.length - cols ? i + cols : -1;
  }
}
function hasNeighbour(x, i, t) {
  return (x > 0 && type[i - 1] === t) || (x < cols - 1 && type[i + 1] === t) ||
    (i >= cols && type[i - cols] === t) || (i < type.length - cols && type[i + cols] === t);
}

function step() {
  clock++;
  updateTime(true);
  if (isNight() && Math.random() < 1 / 2400) shootingStar(); // a few a night
  const sw = census; census = censusNext; censusNext = sw; censusNext.fill(0);
  for (let y = rows - 1; y >= 0; y--) {
    const ltr = Math.random() < 0.5;
    for (let k = 0; k < cols; k++) {
      const x = ltr ? k : cols - 1 - k;
      const i = x + y * cols;
      const t = type[i];
      if (t === EMPTY) continue;
      censusNext[t]++;
      if (stamp[i] === clock) continue;
      const m = MATS[t];
      if (react(x, i, t)) continue;
      if (m.hot && ignite(x, y, i)) continue;
      if (m.eats && eat(x, i)) continue;
      if (tick(x, y, i, t)) continue;
      switch (m.kind) {
        case 'powder': updatePowder(x, y, i, m); break;
        case 'liquid': updateLiquid(x, y, i, m); break;
        case 'gas': updateGas(x, y, i, m); break;
        case 'fire': updateFire(x, y, i); break;
        case 'cloud': updateCloud(x, y, i, m); break;
        case 'bolt': stamp[i] = clock; if (--life[i] <= 0) type[i] = EMPTY; break;
        case 'spark': updateSpark(x, y, i); break;
        case 'rocket': updateRocket(x, y, i); break;
        case 'fish': updateFish(x, y, i); break;
        case 'bee': updateBee(x, y, i); break;
        case 'ant': updateAnt(x, y, i); break;
        case 'meteor': updateMeteor(x, y, i); break;
      }
    }
  }
  checkDiscoveries();
}

// reactions with a random neighbour; returns true if this cell changed
function react(x, i, t) {
  const list = REACT[t];
  if (!list.length) return false;
  const j = randomNeighbour(x, i);
  if (j < 0) return false;
  const u = type[j];
  if (u === EMPTY) return false;
  const um = MATS[u];
  for (const r of list) {
    const hit = r.tag ? (r.tag === '#hot' ? um.hot : um.cold) : r.b === u;
    if (!hit || Math.random() > r.chance) continue;
    how = r.how;
    const si = shade[i], sj = shade[j];
    if (r.bInto >= 0) { place(j, r.bInto); if (r.tintJ) shade[j] = si; }
    if (r.aInto >= 0) { place(i, r.aInto); if (r.tintI) shade[i] = sj; return true; }
    stamp[i] = clock;
    return false;
  }
  return false;
}

// hot things set flammable neighbours alight
function ignite(x, y, i) {
  const j = randomNeighbour(x, i);
  if (j < 0) return false;
  const um = MATS[type[j]];
  if (!um.flammable || Math.random() > um.flammable[0]) return false;
  const me = type[i];
  how = `${um.name} + ${MATS[me].name}`;
  burn(j, um);
  return type[i] !== me;
}

// set a flammable cell off
function burn(j, um) {
  const into = um.flammable[1];
  if (into === 'explode') explode(j % cols, (j / cols) | 0, um.blast || 1);
  else if (into === 'light') life[j] = 1; // torches just get lit
  else place(j, M[into]);
}

// a bolt of lightning from (x, y) down to the first thing in its way
function strike(x, y) {
  let i = x + y * cols;
  while (y < rows) {
    const t = type[i];
    if (t !== EMPTY && !MATS[t].thin) { zap(i); return; }
    place(i, M.lightning);
    y++;
    const nx = x + ((Math.random() * 3) | 0) - 1;
    if (nx >= 0 && nx < cols) x = nx;
    i = x + y * cols;
  }
}
function zap(j) {
  const t = type[j], m = MATS[t];
  if (m.flammable) { how = `${m.name} + Lightning`; burn(j, m); return; }
  for (const r of REACT[t]) if (r.b === M.lightning) { how = r.how; if (r.aInto >= 0) place(j, r.aInto); return; }
}

function explode(cx, cy, scale) {
  const r = Math.round(Math.max(5, Math.round(cols / 40)) * (scale || 1));
  how = 'An explosion';
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = x + y * cols, t = type[i];
    if (t && MATS[t].tough) continue;
    if (t && d2 > 2 && MATS[t].flammable && MATS[t].flammable[1] === 'explode') { place(i, M.fire); life[i] = 3; continue; } // chain reaction
    const k = Math.random();
    if (k < 0.55) { place(i, M.fire); life[i] = 10 + (Math.random() * 30) | 0; }
    else if (k < 0.7 && d2 > r * r * 0.5) place(i, M.smoke);
    else type[i] = EMPTY;
  }
}

// acid dissolves most things
function eat(x, i) {
  const j = randomNeighbour(x, i);
  if (j < 0) return false;
  const u = type[j];
  if (!u || u === type[i]) return false;
  const um = MATS[u];
  if (um.acidproof || um.kind === 'gas' || um.kind === 'fire' || Math.random() > 0.1) return false;
  if (u === M.water || u === M.saltwater) { if (Math.random() < 0.1) { type[i] = EMPTY; return true; } return false; }
  how = 'Acid';
  if (Math.random() < 0.3) place(j, M.smoke); else type[j] = EMPTY;
  if (Math.random() < 0.35) { type[i] = EMPTY; return true; }
  return false;
}

// special per-material behaviour
function tick(x, y, i, t) {
  switch (t) {
    case M.steam:
      if ((y < rows * 0.22 || hasNeighbour(x, i, M.cloud)) && Math.random() < (y < 3 ? 0.2 : 0.02)) { how = 'Steam reaching the sky'; place(i, M.cloud); return true; }
      return false;
    case M.mud:
      if (y > 0 && type[i - cols] === EMPTY && Math.random() < 0.0006 * (0.3 + 0.7 * daylight)) {
        how = 'Mud left alone'; place(i - cols, M.plant); life[i - cols] = 8 + (Math.random() * 28) | 0;
      }
      return false;
    case M.plant: return tickPlant(x, y, i);
    case M.flower: {
      const k = Math.random();
      if (k > 0.0012) return true;
      const j = randomNeighbour(x, i);
      if (j < 0) return true;
      const u = type[j];
      if (u === EMPTY) {
        if (isNight()) return true;
        if (k < 0.0002) { if (census[M.bee] < CAP.bee) { how = 'Flowers attract bees'; place(j, M.bee); } }
        else if (k < 0.0005 && census[M.seed] < CAP.seed) { how = 'A flower going to seed'; place(j, M.seed); }
      } else if (u === M.water) {
        how = 'Flower + Water'; place(j, M.dye);
        shade[j] = FLOWER_HUE[(shade[i] * FLOWERS.length) | 0];
        if (Math.random() < 0.3) type[i] = EMPTY;
      }
      return true;
    }
    case M.seed: {
      if (y < rows - 1 && Math.random() < 0.02) {
        const b = type[i + cols];
        if (b === M.mud) { how = 'Seed + Mud'; place(i, M.plant); life[i] = 8 + (Math.random() * 28) | 0; return true; }
        if (b === M.earth) { how = 'Seed + Earth'; place(i, M.grass); life[i] = 1 + (Math.random() * 3) | 0; return true; }
        if (b === M.sand) { how = 'Seed + Sand'; place(i, M.cactus); life[i] = 5 + (Math.random() * 9) | 0; return true; }
        if (isWet(b)) { how = 'Seed + Water'; place(i, M.lily); return true; }
      }
      if (Math.random() < 0.0003) { type[i] = EMPTY; return true; }
      return false;
    }
    case M.grass: {
      if (life[i] > 0) { // still growing up
        if (y > 0 && Math.random() < 0.02) {
          const left = life[i] - 1; life[i] = 0;
          if (type[i - cols] === EMPTY) { place(i - cols, M.grass); life[i - cols] = left; }
        }
      } else if (isNight() && y > 0 && type[i - cols] === EMPTY) {
        const k = Math.random();
        if (k < 0.00005) { if (census[M.firefly] < CAP.firefly) { how = 'Long grass after dark'; place(i - cols, M.firefly); } }
        else if (k < 0.00016) { how = 'Grass on a cold night'; place(i - cols, M.frost); }
      } else if (Math.random() < 0.003 * daylight) { // creep sideways over bare earth
        const d = Math.random() < 0.5 ? -1 : 1, nx = x + d;
        if (nx >= 0 && nx < cols) for (const j of [i + d, i + d - cols, i + d + cols]) {
          if (j >= 0 && j < type.length - cols && type[j] === EMPTY && type[j + cols] === M.earth) {
            place(j, M.grass); life[j] = 1 + (Math.random() * 3) | 0; break;
          }
        }
      }
      return true;
    }
    case M.cactus: {
      if (life[i] > 0 && y > 0 && Math.random() < 0.012) {
        const left = life[i] - 1, j = i - cols; life[i] = 0;
        if (type[j] !== EMPTY) return true;
        if (left <= 0) { if (Math.random() < 0.35) { how = 'A cactus in bloom'; place(j, M.flower); } return true; }
        place(j, M.cactus); life[j] = left;
        if (left > 3 && Math.random() < 0.25) { // an arm
          const d = Math.random() < 0.5 ? -1 : 1;
          if (x + 2 * d >= 0 && x + 2 * d < cols && type[i + d] === EMPTY && type[i + 2 * d] === EMPTY) {
            place(i + d, M.cactus); place(i + 2 * d, M.cactus); life[i + 2 * d] = 2 + (Math.random() * 2) | 0;
          }
        }
      }
      return true;
    }
    case M.seaweed: {
      if (life[i] > 0) {
        if (y > 0 && Math.random() < 0.03) {
          const dx = Math.random() < 0.75 ? 0 : (Math.random() < 0.5 ? -1 : 1), nx = x + dx;
          const left = life[i] - 1; life[i] = 0;
          if (nx >= 0 && nx < cols && left > 0 && isWet(type[i - cols + dx])) { place(i - cols + dx, M.seaweed); life[i - cols + dx] = left; }
        }
      } else if (Math.random() < 0.00006 && census[M.fish] < CAP.fish) {
        const j = randomNeighbour(x, i);
        if (j >= 0 && isWet(type[j])) { how = 'Seaweed left in the sea'; place(j, M.fish); }
      }
      return true;
    }
    case M.coral: {
      if (life[i] > 0 && y > 0 && Math.random() < 0.012) {
        const dx = ((Math.random() * 3) | 0) - 1, nx = x + dx, left = life[i] - 1;
        life[i] = Math.random() < 0.35 ? left : 0; // sometimes it branches
        if (nx >= 0 && nx < cols && isWet(type[i - cols + dx])) { place(i - cols + dx, M.coral); life[i - cols + dx] = left; }
      }
      return true;
    }
    case M.mushroom: {
      if (life[i] > 0) { // a stalk that is still growing; the cap goes on last
        shade[i] = 0.25;
        if (y > 0 && Math.random() < 0.02) {
          const left = life[i] - 1, j = i - cols; life[i] = 0;
          if (type[j] !== EMPTY) return true;
          place(j, M.mushroom); life[j] = left; shade[j] = left > 0 ? 0.25 : 0.75;
          if (left <= 0) for (const d of [-1, 1]) {
            if (x + d >= 0 && x + d < cols && type[j + d] === EMPTY) { place(j + d, M.mushroom); life[j + d] = 0; shade[j + d] = 0.75; }
          }
        }
      }
      return true;
    }
    case M.snow:
      if (daylight > 0.3 && y > 0 && type[i - cols] === EMPTY && Math.random() < 0.0006 * daylight) { how = 'Snow in the sun'; place(i, M.water); return true; }
      return false;
    case M.ice:
      if (daylight > 0.3 && y > 0 && type[i - cols] === EMPTY && Math.random() < 0.0002 * daylight) { how = 'Ice in the sun'; place(i, M.water); return true; }
      return false;
    case M.frost:
      if (daylight > 0.3 && Math.random() < 0.004 * daylight) type[i] = EMPTY; // gone by mid-morning
      return true;
    case M.molten:
      if (Math.random() < 0.003 && !hasNeighbour(x, i, M.lava) && !hasNeighbour(x, i, M.fire)) { how = 'Molten metal cooling'; place(i, M.metal); return true; }
      return false;
    case M.torch: {
      if (!life[i]) return true; // not lit
      if (hasNeighbour(x, i, M.water)) { life[i] = 0; return true; }
      if (y > 0 && type[i - cols] === EMPTY && Math.random() < 0.4) { how = 'Fire'; place(i - cols, M.fire); life[i - cols] = 8 + (Math.random() * 18) | 0; }
      const j = randomNeighbour(x, i);
      if (j >= 0 && type[j] === M.torch && Math.random() < 0.1) life[j] = 1;
      return true;
    }
    case M.void: {
      const j = randomNeighbour(x, i);
      if (j >= 0 && type[j] !== M.void) type[j] = EMPTY;
      return true;
    }
    case M.ember: {
      if (y > 0 && type[i - cols] === EMPTY && Math.random() < 0.35) {
        how = 'Fire'; place(i - cols, M.fire); life[i - cols] = 10 + (Math.random() * 25) | 0;
      }
      stamp[i] = clock;
      if (Math.random() < 0.5) life[i]--;
      if (life[i] <= 1) { how = 'Wood burning all the way out'; place(i, Math.random() < 0.55 ? M.ash : M.smoke); }
      return true;
    }
  }
  return false;
}

function tickPlant(x, y, i) {
  // life = how much more this tip can grow
  if (life[i] > 0 && Math.random() < 0.03 * (0.35 + 0.65 * daylight) && y > 0) {
    const dx = Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? -1 : 1);
    const nx = x + dx;
    if (nx >= 0 && nx < cols) {
      const j = i - cols + dx;
      if (type[j] === EMPTY) {
        const left = life[i] - 1;
        life[i] = 0;
        if (left <= 0 && isNight() && Math.random() < 0.7) { how = 'A plant blooming in the dark'; place(j, M.moonflower); }
        else if (left <= 0 && Math.random() < 0.6) { how = 'A plant growing tall'; place(j, M.flower); }
        else { how = ''; place(j, M.plant); life[j] = left; }
      }
    }
    return true;
  }
  if (life[i] === 0 && Math.random() < 0.0008 && y > 0 && y < rows - 1) {
    const up = type[i - cols], dn = type[i + cols];
    if ((up === M.plant || up === M.wood || up === M.flower) && (dn === M.plant || dn === M.wood || dn === M.mud || dn === M.earth)) {
      how = 'Old, thick plants'; place(i, M.wood); return true;
    }
  }
  return true;
}

function powderCanEnter(j, dens) {
  const t = type[j];
  if (t === EMPTY) return true;
  if (MATS[t].thin) return true;
  return MATS[t].kind === 'liquid' && MATS[t].dens < dens && Math.random() < 0.6;
}
function updatePowder(x, y, i, m) {
  if (y >= rows - 1) return;
  const below = i + cols;
  if (powderCanEnter(below, m.dens)) { move(i, below); return; }
  if (Math.random() > m.slide) return;
  const d = Math.random() < 0.5 ? -1 : 1;
  for (const dx of [d, -d]) {
    const nx = x + dx;
    if (nx >= 0 && nx < cols && powderCanEnter(below + dx, m.dens)) { move(i, below + dx); return; }
  }
}

function liquidCanEnter(j, dens) {
  const t = type[j];
  if (t === EMPTY) return true;
  const k = MATS[t].kind;
  if (k === 'gas') return true;
  return k === 'liquid' && MATS[t].dens < dens && Math.random() < 0.5;
}
function updateLiquid(x, y, i, m) {
  if (m.visc && Math.random() > m.visc) return;
  if (y < rows - 1) {
    const below = i + cols;
    if (liquidCanEnter(below, m.dens)) { move(i, below); return; }
    const d = Math.random() < 0.5 ? -1 : 1;
    for (const dx of [d, -d]) {
      const nx = x + dx;
      if (nx >= 0 && nx < cols && liquidCanEnter(below + dx, m.dens)) { move(i, below + dx); return; }
    }
  }
  const d = Math.random() < 0.5 ? -1 : 1;
  for (const dir of [d, -d]) {
    let target = -1;
    for (let s = 1; s <= m.spread; s++) {
      const nx = x + dir * s;
      if (nx < 0 || nx >= cols) break;
      const t = type[i + dir * s];
      if (t !== EMPTY && MATS[t].kind !== 'gas') break;
      target = i + dir * s;
    }
    if (target >= 0) { move(i, target); return; }
  }
}

function updateGas(x, y, i, m) {
  if (!m.slowFade || Math.random() < 0.15) life[i]--;
  if (life[i] <= 1) {
    if (m.decay && Math.random() < m.decay[1]) { how = `${m.name} cooling down`; place(i, M[m.decay[0]]); }
    else type[i] = EMPTY;
    return;
  }
  stamp[i] = clock;
  if (y === 0) return;
  if (Math.random() < 0.3) {
    const dx = Math.random() < 0.5 ? -1 : 1, nx = x + dx;
    if (nx >= 0 && nx < cols && type[i + dx] === EMPTY) { move(i, i + dx); return; }
  }
  const dx = (Math.random() * 3 | 0) - 1, nx = x + dx;
  if (nx >= 0 && nx < cols) {
    const up = i - cols + dx, t = type[up];
    if (t === EMPTY || (MATS[t].kind === 'liquid' && Math.random() < 0.5)) move(i, up);
  }
}

function updateFire(x, y, i) {
  if (life[i] <= 1 || Math.random() < 0.012) {
    if (Math.random() < 0.3) { how = 'Fire burning out'; place(i, M.smoke); } else type[i] = EMPTY;
    return;
  }
  life[i]--;
  stamp[i] = clock;
  if (y === 0) { type[i] = EMPTY; return; }
  if (Math.random() < 0.8) {
    const dx = (Math.random() * 3 | 0) - 1, nx = x + dx;
    if (nx >= 0 && nx < cols && type[i - cols + dx] === EMPTY) { move(i, i - cols + dx); return; }
    if (type[i - cols] === EMPTY) move(i, i - cols);
  }
}

function updateCloud(x, y, i, m) {
  stamp[i] = clock;
  if (y < rows - 1 && type[i + cols] === EMPTY) {
    if (m.storm && Math.random() < 0.0004) { how = 'An angry storm cloud'; strike(x, y + 1); return; }
    if (Math.random() < (m.storm ? 0.012 : 0.004)) {
      how = ''; place(i + cols, M.water);
      if (--life[i] <= 0) { type[i] = EMPTY; return; }
    }
  }
  if (Math.random() < 0.02) {
    const dx = Math.random() < 0.5 ? -1 : 1, nx = x + dx;
    if (nx >= 0 && nx < cols && type[i + dx] === EMPTY) move(i, i + dx);
  }
}

// sparks drift down and fade
function updateSpark(x, y, i) {
  stamp[i] = clock;
  if (--life[i] <= 1) { type[i] = EMPTY; return; }
  if (y >= rows - 1 || Math.random() > 0.4) return;
  const nx = x + ((Math.random() * 3) | 0) - 1;
  if (nx >= 0 && nx < cols && type[nx + (y + 1) * cols] === EMPTY) move(i, nx + (y + 1) * cols);
}

// a lit firework: shoots up leaving a trail, then bursts
function updateRocket(x, y, i) {
  stamp[i] = clock;
  const hue = shade[i];
  let l = life[i] - 1;
  for (let s = 0; s < 2 && l > 1; s++) {
    if (y <= 2) { l = 0; break; }
    let dx = Math.random() < 0.2 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    if (x + dx < 0 || x + dx >= cols) dx = 0;
    const j = i - cols + dx, t = type[j];
    if (t !== EMPTY && !MATS[t].thin) break; // stuck under something
    type[j] = M.rocket; shade[j] = hue; stamp[j] = clock;
    type[i] = M.fire; life[i] = 4 + (Math.random() * 4) | 0; stamp[i] = clock;
    i = j; x += dx; y--;
  }
  life[i] = l;
  if (l > 1) return;
  // burst
  type[i] = EMPTY;
  how = 'Lighting a firework';
  const r = Math.max(5, Math.round(cols / 45)) + ((Math.random() * 4) | 0);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) continue;
    const px = x + dx, py = y + dy;
    if (px < 0 || py < 0 || px >= cols || py >= rows) continue;
    const j = px + py * cols;
    if (type[j] !== EMPTY && !MATS[type[j]].thin) continue;
    if (Math.random() > 0.12 + 0.5 * d2 / (r * r)) continue;
    place(j, M.spark);
    shade[j] = (hue + (Math.random() - 0.5) * 0.08 + 1) % 1;
    life[j] = 22 + (Math.random() * 34) | 0;
  }
}

// a shooting star streaks across the night sky; now and then one lands as stardust
function shootingStar() {
  const x = (cols * (0.08 + 0.84 * Math.random())) | 0, y = (rows * (0.03 + 0.22 * Math.random())) | 0, i = x + y * cols;
  if (type[i] !== EMPTY) return;
  type[i] = M.meteor; stamp[i] = clock;
  shade[i] = x > cols / 2 ? 0.25 : 0.75; // flies towards the far side, so it has room to come down
  life[i] = 150 + (Math.random() * 105) | 0; // most reach the ground
}
function updateMeteor(x, y, i) {
  stamp[i] = clock;
  const dir = shade[i] < 0.5 ? -1 : 1, sh = shade[i];
  let l = life[i] - 1;
  for (let k = 0; k < 2; k++) {
    const nx = x + (Math.random() < 0.6 ? dir : 0), ny = y + (Math.random() < 0.8 ? 1 : 0);
    if (l <= 0 || nx < 0 || nx >= cols || ny >= rows) { type[i] = EMPTY; return; } // burnt up, or off the edge
    if (nx === x && ny === y) continue; // didn't move this time
    const j = nx + ny * cols, t = type[j];
    if (t !== EMPTY && !MATS[t].thin) { // it hit the ground
      how = 'A falling star';
      place(i, M.stardust);
      for (const d of [-1, 1, -cols]) if (i + d >= 0 && type[i + d] === EMPTY && Math.random() < 0.7) place(i + d, M.stardust);
      return;
    }
    type[j] = M.meteor; shade[j] = sh; stamp[j] = clock; life[j] = l;
    type[i] = M.spark; shade[i] = -1; life[i] = 6 + (Math.random() * 10) | 0; stamp[i] = clock; // a white trail
    i = j; x = nx; y = ny;
  }
  life[i] = l;
}

const flip = (i) => { shade[i] = shade[i] < 0.5 ? shade[i] + 0.5 : shade[i] - 0.5; }; // creatures face left below 0.5, right above

function updateFish(x, y, i) {
  stamp[i] = clock;
  const wet = (x > 0 && isWet(type[i - 1])) || (x < cols - 1 && isWet(type[i + 1])) ||
    (y > 0 && isWet(type[i - cols])) || (y < rows - 1 && isWet(type[i + cols]));
  if (!wet) { // flopping about on dry land
    if (Math.random() < 0.5 && --life[i] <= 1) { how = 'A fish out of water'; place(i, M.bone); return; }
    if (y < rows - 1 && (type[i + cols] === EMPTY || MATS[type[i + cols]].thin)) move(i, i + cols);
    else if (Math.random() < 0.08) {
      const d = Math.random() < 0.5 ? -1 : 1;
      if (x + d >= 0 && x + d < cols && type[i + d] === EMPTY) move(i, i + d);
    }
    return;
  }
  if (Math.random() < 0.01 && --life[i] <= 1) { type[i] = EMPTY; return; }
  if (Math.random() < 0.55) return;
  if (Math.random() < 0.03) flip(i);
  const dir = shade[i] < 0.5 ? -1 : 1;
  if (Math.random() < 0.75) {
    const nx = x + dir;
    if (nx >= 0 && nx < cols && isWet(type[i + dir])) move(i, i + dir); else flip(i);
  } else {
    const j = i + (Math.random() < 0.5 ? -cols : cols);
    if (j >= 0 && j < type.length && isWet(type[j])) move(i, j);
  }
}

function updateBee(x, y, i) {
  stamp[i] = clock;
  const t = type[i];
  if (Math.random() < 0.03 && --life[i] <= 1) { type[i] = EMPTY; return; }
  if (t === M.firefly && daylight > 0.55) { if (Math.random() < 0.0015) type[i] = EMPTY; else if (Math.random() < 0.85) return; }
  if (t !== M.firefly && daylight < 0.2) { // bedtime: settle on a flower, or drift down and rest
    if (hasNeighbour(x, i, M.flower) || Math.random() < 0.85) return;
    if (y < rows - 1 && type[i + cols] === EMPTY) { move(i, i + cols); return; }
  }
  let nearFlower = false;
  if (Math.random() < 0.3) {
    const j = randomNeighbour(x, i);
    if (j >= 0 && type[j] === M.flower && type[i] === M.bee) {
      nearFlower = true;
      const k = randomNeighbour(x, i);
      if (Math.random() < 0.1 && k >= 0 && type[k] === EMPTY) { how = 'Bees visiting flowers'; place(k, M.honey); }
    }
  }
  if (nearFlower || Math.random() < 0.3) return;
  const dx = ((Math.random() * 3) | 0) - 1;
  let dy = ((Math.random() * 3) | 0) - 1;
  if (y < rows * 0.3 && Math.random() < 0.3) dy = 1; // don't wander off into the sky
  const nx = x + dx, ny = y + dy;
  if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return;
  const j = nx + ny * cols;
  if (type[j] === EMPTY) move(i, j);
}

const DIGGABLE = new Set(['sand', 'earth', 'ash', 'salt', 'seed', 'snow', 'clay'].map((k) => M[k]));
function updateAnt(x, y, i) {
  stamp[i] = clock;
  if (Math.random() < 0.004 && --life[i] <= 1) { type[i] = EMPTY; return; }
  const holds = (j) => type[j] !== EMPTY && !MATS[type[j]].thin && MATS[type[j]].kind !== 'liquid';
  if (y < rows - 1 && !holds(i + cols)) {
    const cling = (x > 0 && holds(i - 1)) || (x < cols - 1 && holds(i + 1));
    const b = type[i + cols];
    if ((!cling || Math.random() < 0.04) && (b === EMPTY || MATS[b].thin)) { move(i, i + cols); return; }
  }
  if (Math.random() < 0.5) return;
  if (Math.random() < 0.01) flip(i);
  const dir = shade[i] < 0.5 ? -1 : 1, nx = x + dir;
  if (nx < 0 || nx >= cols) { flip(i); return; }
  const j = i + dir, t = type[j];
  if (t === EMPTY) { move(i, j); return; }
  if (MATS[t].kind === 'liquid' || MATS[t].hot) { flip(i); return; }
  if (y > 0 && type[i - cols] === EMPTY) { // step or climb up
    move(i, type[j - cols] === EMPTY ? j - cols : i - cols);
    return;
  }
  if (DIGGABLE.has(t) && Math.random() < 0.4) { move(i, j); return; } // burrow
  flip(i);
}

// ================= drawing =================
// The backdrop: day, dusk and night skies with two faint hills, worked out once per resize and blended
// every few frames by the time of day. The sun and moon move across it, behind the hills.
let SKY = null, SKY_N = null, SKY_D = null, SKY_K = null, HILL = null, STARS = [], skyAt = -1;
const SKIES = {
  N: { stops: [[0, 7, 9, 24], [0.5, 18, 18, 44], [0.8, 40, 27, 56], [1, 56, 33, 52]], far: [30, 22, 44], near: [20, 15, 31] },
  D: { stops: [[0, 58, 104, 166], [0.5, 100, 146, 196], [0.8, 158, 182, 206], [1, 176, 188, 200]], far: [104, 128, 160], near: [80, 102, 128] },
  K: { stops: [[0, 34, 32, 80], [0.45, 104, 62, 112], [0.78, 226, 128, 94], [1, 244, 166, 106]], far: [94, 54, 80], near: [54, 31, 54] },
};
function makeSky() {
  const n = cols * rows;
  SKY = new Uint8ClampedArray(n * 3); SKY_N = new Uint8ClampedArray(n * 3); SKY_D = new Uint8ClampedArray(n * 3); SKY_K = new Uint8ClampedArray(n * 3);
  HILL = new Uint8Array(n); STARS = []; skyAt = -1;
  const rnd = (v) => { const q = Math.sin(v * 127.1 + 311.7) * 43758.5453; return q - Math.floor(q); };
  const grad = (st, f) => { let k = 1; while (k < st.length - 1 && f > st[k][0]) k++; const A = st[k - 1], B = st[k], u = (f - A[0]) / (B[0] - A[0]); return [A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u, A[3] + (B[3] - A[3]) * u]; };
  for (let y = 0; y < rows; y++) {
    const f = y / rows, g = { N: grad(SKIES.N.stops, f), D: grad(SKIES.D.stops, f), K: grad(SKIES.K.stops, f) };
    for (let x = 0; x < cols; x++) {
      const i = x + y * cols, q = x / cols;
      const far = rows * (0.76 + 0.045 * Math.sin(q * 9 + 0.6) + 0.025 * Math.sin(q * 23 + 2.1));
      const near = rows * (0.87 + 0.035 * Math.sin(q * 6 + 2.4) + 0.018 * Math.sin(q * 17 + 0.3));
      HILL[i] = y > near ? 2 : y > far ? 1 : 0;
      const nz = (rnd(i * 0.73) - 0.5) * 3; // tiny dither so the gradients don't band
      for (const [key, buf] of [['N', SKY_N], ['D', SKY_D], ['K', SKY_K]]) {
        const c = HILL[i] === 2 ? SKIES[key].near : HILL[i] === 1 ? SKIES[key].far : g[key];
        buf[i * 3] = c[0] + nz; buf[i * 3 + 1] = c[1] + nz; buf[i * 3 + 2] = c[2] + nz;
      }
      if (!HILL[i] && f < 0.72 && rnd(i * 1.37) < 0.0022) STARS.push(i, 70 + 150 * rnd(i * 2.1) * (1 - f));
    }
  }
  for (let k = 0; k < STARS.length; k += 2) { const i = STARS[k], v = STARS[k + 1]; SKY_N[i * 3] = v; SKY_N[i * 3 + 1] = v; SKY_N[i * 3 + 2] = v + 20; }
}
function composeSky() {
  for (let k = 0, n = SKY.length; k < n; k++) SKY[k] = SKY_N[k] * wN + SKY_D[k] * wD + SKY_K[k] * wK;
  drawOrb(dayT, true);
  drawOrb((dayT + 0.5) % 1, false);
}
// the sun (or moon) is up from t = 0.22 to 0.78 of its own day, rising on the left and setting on the right
function drawOrb(t, sun) {
  const u = (t - 0.22) / 0.56;
  if (u <= 0 || u >= 1) return;
  const h = Math.sin(Math.PI * u), cx = cols * (0.06 + 0.88 * u), cy = rows * (0.84 - 0.68 * h);
  const R = Math.max(4, rows * (sun ? 0.036 : 0.032)), G = R * (sun ? 9 : 7);
  const low = 1 - Math.min(1, h * 2.2); // near the horizon the sun turns orange
  const disc = sun ? [255, 244 - 80 * low, 196 - 120 * low] : [236, 228, 206];
  const glow = sun ? [70, 54 - 20 * low, 26 - 10 * low] : [40 * (0.3 + 0.7 * wN), 36 * (0.3 + 0.7 * wN), 44 * (0.3 + 0.7 * wN)];
  const x0 = Math.max(0, (cx - G) | 0), x1 = Math.min(cols - 1, (cx + G) | 0), y0 = Math.max(0, (cy - G) | 0), y1 = Math.min(rows - 1, (cy + G) | 0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = x + y * cols;
    if (HILL[i]) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d < R) { const e = sun ? 1 : 0.9 + 0.1 * (((i * 7919) % 17) / 17); SKY[i * 3] = disc[0] * e; SKY[i * 3 + 1] = disc[1] * e; SKY[i * 3 + 2] = disc[2] * e; }
    else if (d < G) { const gl = (1 - (d - R) / (G - R)) ** 2; SKY[i * 3] += glow[0] * gl; SKY[i * 3 + 1] += glow[1] * gl; SKY[i * 3 + 2] += glow[2] * gl; }
  }
}

const FLOWERS = [[240, 90, 120], [250, 200, 60], [180, 110, 240], [255, 250, 245], [255, 140, 60]];
const FLOWER_HUE = [0.96, 0.13, 0.75, 0.52, 0.07]; // the dye each flower colour makes
const FISH = [[255, 150, 50], [255, 212, 70], [255, 196, 196], [240, 92, 60]];
let HR = 0, HG = 0, HB = 0; // setHue(h) leaves a full-brightness colour here
function setHue(h) {
  const k = (((h % 1) + 1) % 1) * 6;
  const f = (n) => { const a = (n + k) % 6; return 255 * (1 - Math.max(0, Math.min(a, 4 - a, 1))); };
  HR = f(5); HG = f(3); HB = f(1);
}

function render() {
  img.loadPixels();
  const px = img.pixels;
  const wt = frameCount * 0.02;
  if (skyAt < 0 || frameCount - skyAt >= 3) { composeSky(); skyAt = frameCount; }
  for (let i = 0, p = 0; i < type.length; i++, p += 4) {
    const t = type[i];
    let r = 0, g = 0, b = 0, a = 1;
    if (t === EMPTY) { r = SKY[i * 3]; g = SKY[i * 3 + 1]; b = SKY[i * 3 + 2]; }
    else {
      const m = MATS[t], s = shade[i];
      if (t === M.sand) {
        const k = 1 - Math.abs(2 * s - 1); // fixed when placed
        r = SAND_A[0] + (SAND_B[0] - SAND_A[0]) * k;
        g = SAND_A[1] + (SAND_B[1] - SAND_A[1]) * k;
        b = SAND_A[2] + (SAND_B[2] - SAND_A[2]) * k;
      } else if (!m.anim) {
        const v = 1 - m.vary / 2 + m.vary * s;
        r = m.color[0] * v; g = m.color[1] * v; b = m.color[2] * v;
        if (m.kind === 'gas') a = 0.6 * Math.min(1, life[i] / 60); // hydrogen, fumes
      } else {
        switch (m.anim) {
          case 'water': { const w = Math.sin(6.2832 * (wt + s)) * 10; r = m.color[0] + w * 0.5; g = m.color[1] + w; b = m.color[2] + w * 0.6; break; }
          case 'fire': break;
          case 'lava': { const w = 0.5 + 0.5 * Math.sin(6.2832 * (wt * 0.7 + s)); r = 255; g = 70 + 100 * w; b = 15 + 25 * w; break; }
          case 'ember': { const f = 0.6 + 0.4 * Math.random(); r = 230 * f; g = 70 * f; b = 20 * f; break; }
          case 'steam': { a = Math.min(1, life[i] / 90) * 0.7; r = 205; g = 215; b = 228; break; }
          case 'smoke': { a = Math.min(1, life[i] / 60) * 0.6; r = 92; g = 88; b = 86; break; }
          case 'gas': { a = 0.35 + 0.12 * Math.sin(6.2832 * (wt + s)); r = 120; g = 190; b = 90; break; }
          case 'oil': { const w = Math.sin(6.2832 * (wt * 0.6 + s)) * 8; r = 92 + w; g = 64 + w * 0.6; b = 30; break; }
          case 'acid': { const w = Math.sin(6.2832 * (wt * 1.5 + s)) * 15; r = 150 + w; g = 240; b = 60 + w; break; }
          case 'slime': { const w = Math.sin(6.2832 * (wt * 0.5 + s)) * 12; r = 100 + w; g = 205 + w; b = 80; break; }
          case 'flower': { // closed up at night, opening one by one at dawn
            if (daylight < 0.1 + 0.3 * ((s * 7.31) % 1)) { r = 74; g = 128; b = 64; break; }
            const c = FLOWERS[(s * FLOWERS.length) | 0]; r = c[0]; g = c[1]; b = c[2]; break;
          }
          case 'moonflower': {
            if (daylight > 0.45) { r = 150; g = 168; b = 150; break; } // a closed bud in the day
            const k = 0.82 + 0.18 * Math.sin(6.2832 * (wt * 0.5 + s)); r = 205 * k; g = 225 * k; b = 255 * k; break;
          }
          case 'stardust': { const tw = Math.sin(6.2832 * (wt * 1.3 + s * 5)); const k = tw > 0.8 ? 1.15 : 0.72 + 0.12 * s; r = 216 * k; g = 226 * k; b = 255 * k; break; }
          case 'sparkle': {
            const tw = Math.sin(6.2832 * (wt * 0.8 + s * 7)); const k = tw > 0.97 ? 1.25 : 0.9 + 0.1 * s;
            r = m.color[0] * k; g = m.color[1] * k; b = m.color[2] * k; break;
          }
          case 'tint': { setHue(s); const v = 0.85 + 0.15 * ((i * 7919) % 13) / 13; r = (HR * 0.62 + 90) * v; g = (HG * 0.62 + 90) * v; b = (HB * 0.62 + 90) * v; break; }
          case 'tintglass': { setHue(s); const k = Math.sin(6.2832 * (wt * 0.8 + i * 0.618)) > 0.97 ? 1.3 : 1; r = (HR * 0.5 + 70) * k; g = (HG * 0.5 + 70) * k; b = (HB * 0.5 + 70) * k; break; }
          case 'gem': { setHue(s); const k = Math.sin(6.2832 * (wt * 0.8 + i * 0.618)) > 0.9 ? 1 : 0.6; r = HR * k + 255 * (1 - k) * 0.6; g = HG * k + 255 * (1 - k) * 0.6; b = HB * k + 255 * (1 - k) * 0.6; break; }
          case 'lily': { if (s < 0.2) { r = 250; g = 170; b = 200; } else { const v = 0.8 + 0.4 * s; r = 60 * v; g = 160 * v; b = 90 * v; } break; }
          case 'mushroom': { if (s < 0.5) { r = 226; g = 216; b = 196; } else { r = 208; g = 62; b = 52; } break; }
          case 'firefly': {
            if (daylight > 0.5) { r = 92; g = 96; b = 52; break; } // just a little bug in the day
            a = 0.35 + 0.65 * Math.max(0, Math.sin(6.2832 * (wt * 1.2 + s))); r = 200; g = 255; b = 90; break;
          }
          case 'butterfly': { setHue(s); const k = ((frameCount >> 3) + i) & 1 ? 1 : 0.6; r = (HR * 0.75 + 64) * k; g = (HG * 0.75 + 64) * k; b = (HB * 0.75 + 64) * k; break; }
          case 'bolt': { const k = 0.8 + 0.2 * Math.random(); r = 255 * k; g = 250 * k; b = 200 * k; break; }
          case 'molten': { const w = 0.5 + 0.5 * Math.sin(6.2832 * (wt + s)); r = 255; g = 196 + 44 * w; b = 96 + 70 * w; break; }
          case 'honey': { const w = Math.sin(6.2832 * (wt * 0.4 + s)); r = 232 + w * 12; g = 166 + w * 10; b = 40; break; }
          case 'bubble': { setHue(wt * 0.4 + s); r = 150 + HR * 0.4; g = 150 + HG * 0.4; b = 160 + HB * 0.37; a = 0.7; break; }
          case 'dye': { setHue(s); const w = 0.86 + 0.06 * Math.sin(6.2832 * (wt + i * 0.37)); r = (HR * 0.82 + 26) * w; g = (HG * 0.82 + 26) * w; b = (HB * 0.82 + 26) * w; break; }
          case 'spark': { if (s < 0) { a = Math.min(1, life[i] / 10); r = 236; g = 240; b = 255; break; } setHue(s); a = Math.min(1, life[i] / 22) * (0.65 + 0.35 * Math.random()); r = HR * 0.7 + 76; g = HG * 0.7 + 76; b = HB * 0.7 + 76; break; }
          case 'torch': {
            if (life[i]) { const f = 0.75 + 0.25 * Math.random(); r = 250 * f; g = 170 * f; b = 70 * f; }
            else { const v = 0.8 + 0.3 * s; r = 150 * v; g = 100 * v; b = 52 * v; }
            break;
          }
          case 'fish': { const c = FISH[((s * 2) % 1 * FISH.length) | 0]; r = c[0]; g = c[1]; b = c[2]; break; }
          case 'bee': { if (((frameCount >> 3) + i) & 1) { r = 255; g = 214; b = 40; } else { r = 150; g = 110; b = 16; } break; }
          case 'void': { const k = 0.5 + 0.5 * Math.sin(6.2832 * (wt * 1.5 + s)); r = 34 + 30 * k; g = 8; b = 66 + 60 * k; break; }
          case 'sheen': { const k = 0.85 + 0.2 * (0.5 + 0.5 * Math.sin((i % cols) * 0.15 + wt)) * s + 0.05; r = m.color[0] * k; g = m.color[1] * k; b = m.color[2] * k; break; }
        }
        if (t === M.fire) {
          const k = Math.min(1, life[i] / 60) * (0.75 + 0.25 * Math.random());
          r = 255; g = 60 + 190 * k; b = 20 + 120 * k * k;
          a = Math.min(1, 0.35 + life[i] / 25);
        }
      }
      if (!m.glow) { r *= LR; g *= LG; b *= LB; } // night and dusk light everything that doesn't shine by itself
      if (a < 1) { const o = 1 - a; r = r * a + SKY[i * 3] * o; g = g * a + SKY[i * 3 + 1] * o; b = b * a + SKY[i * 3 + 2] * o; }
    }
    px[p] = r; px[p + 1] = g; px[p + 2] = b; px[p + 3] = 255;
  }
  if (wN > 0.02) for (let k = 0; k < STARS.length; k += 2) { // stars twinkle (and fade out at dawn)
    const i = STARS[k];
    if (type[i] !== EMPTY) continue;
    const dv = STARS[k + 1] * 0.25 * Math.sin(wt * 2 + k * 1.7) * wN;
    px[i * 4] += dv; px[i * 4 + 1] += dv; px[i * 4 + 2] += dv;
  }
  img.updatePixels();
  image(img, 0, 0, width, height);
}

// ================= UI =================
// Wide screens (laptops, phones on their side) get a panel on the right. Tall screens get a bar along the top.
let ui = {};
let side = false, panelW = 0;

function layout() {
  const W = windowWidth, H = windowHeight;
  const was = side;
  side = W >= 600 && W > H * 1.05;
  panelW = side ? Math.round(H < 520 ? Math.min(240, Math.max(204, W * 0.25)) : Math.min(262, Math.max(190, W * 0.2))) : 0;
  document.body.classList.toggle('side', side);
  document.documentElement.style.setProperty('--pw', panelW + 'px');
  if (side) { ui.head.append(ui.book); ui.trow.append(ui.clock); } else { ui.tools.prepend(ui.book); ui.book.after(ui.clock); }
  if (side !== was) buildMaterialRow();
}

function buildUI() {
  const css = document.createElement('style');
  css.textContent = `
    html,body{margin:0;height:100%;background:#07091a;overflow:hidden}
    .fs-ui{position:fixed;top:8px;left:8px;right:8px;z-index:5;font:600 13px system-ui,-apple-system,sans-serif;color:#eee;
      display:flex;flex-direction:column;gap:6px;pointer-events:none}
    .fs-row{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;pointer-events:auto;max-width:max-content;padding-bottom:2px}
    .fs-row::-webkit-scrollbar{display:none}
    @media (min-width:700px){.fs-row{flex-wrap:wrap}}
    .fs-head{display:none}
    .fs-ui button{flex:none;border:0;border-radius:999px;padding:6px 12px 6px 8px;cursor:pointer;display:flex;align-items:center;gap:7px;
      background:rgba(20,20,40,.55);color:#eee;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:inherit;white-space:nowrap;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);transition:background .15s,box-shadow .15s,transform .15s}
    .fs-ui button i{flex:none;width:12px;height:12px;border-radius:4px;display:block;background-size:cover;image-rendering:pixelated;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 1px 2px rgba(0,0,0,.4)}
    .fs-ui button span{overflow:hidden;text-overflow:ellipsis}
    .fs-ui button.on{background:rgba(255,255,255,.92);color:#111;box-shadow:0 0 0 2px var(--c,#fff),0 0 18px -2px var(--c,#fff)}
    .fs-ui button.plain{padding:6px 12px;color:#bbb}
    .fs-ui button.new{animation:fsPop .6s ease 2}

    /* search */
    .fs-find{position:relative;flex:none;width:min(230px,100%);pointer-events:auto}
    .fs-find input{width:100%;box-sizing:border-box;border:0;outline:0;border-radius:999px;padding:5px 30px 5px 30px;margin:0;
      font:500 16px/1.25 system-ui,-apple-system,sans-serif;color:#eee;background:rgba(20,20,40,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);transition:box-shadow .15s,background .15s;-webkit-appearance:none;appearance:none}
    .fs-find input::placeholder{color:#8a86a0}
    .fs-find input:focus{box-shadow:inset 0 0 0 1.5px #f2ca79,0 0 14px -4px #f2ca79}
    .fs-find>svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;opacity:.55;pointer-events:none;z-index:1}
    .fs-find kbd{position:absolute;right:9px;top:50%;transform:translateY(-50%);font:600 11px system-ui,sans-serif;color:#8a86a0;
      border:1px solid rgba(255,255,255,.14);border-radius:5px;padding:0 5px;pointer-events:none;z-index:1}
    @media (hover:none){.fs-find kbd{display:none}}
    .fs-find.typing kbd,.fs-find input:focus~kbd{display:none}
    .fs-ui .fs-find button.x{z-index:1;position:absolute;right:4px;top:50%;transform:translateY(-50%);display:none;padding:2px 7px;font-size:15px;line-height:1;
      background:none;box-shadow:none;color:#aaa;backdrop-filter:none}
    .fs-ui .fs-find button.x:hover{color:#fff}
    .fs-find.typing button.x{display:block}
    .fs-none{margin:6px 4px;color:#8a86a0;font:500 12.5px system-ui,sans-serif;white-space:normal;pointer-events:auto}

    /* folding categories (top bar: inline chips in the one scrolling row) */
    .fs-sec,.fs-grid{display:contents}
    .fs-sec.shut .fs-grid{display:none}
    .fs-ui button.fs-sh{padding:6px 9px 6px 7px;gap:5px;background:none;box-shadow:none;backdrop-filter:none;color:#8a86a0;
      font-size:11px;letter-spacing:.06em;text-transform:uppercase}
    .fs-ui button.fs-sh em{width:0;height:0;border:4px solid transparent;border-top-color:currentColor;border-bottom:0;margin-top:1px;transition:transform .15s}
    .fs-sec.shut button.fs-sh em{transform:rotate(-90deg)}
    .fs-ui button.fs-sh small{font:inherit;opacity:.6}
    .fs-ui button.fs-sh b{display:none;width:7px;height:7px;border-radius:50%;background:var(--c,#fff);box-shadow:0 0 6px var(--c,#fff)}
    .fs-sec.shut button.fs-sh.holds b{display:block}
    .fs-ui button.fs-sh:hover{color:#ddd}
    .fs-ui .book s{display:none}
    .fs-ui button.clock i{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#fff4c4,#ffc44a);box-shadow:0 0 8px #ffc44a}
    .fs-ui button.clock.moon i{background:transparent;box-shadow:inset -4px -2px 0 0 #ebe6d6}
    .fs-ui button.clock small{font:inherit;font-weight:500;opacity:.55}
    .fs-ui button.clock.stopped{color:#888}
    .fs-trow{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
    .fs-trow .fs-title{min-width:0}
    body.side .fs-ui button.clock{padding:5px 10px 5px 8px;font-size:12px;background:rgba(255,255,255,.06);box-shadow:none;margin-top:1px}
    @keyframes fsPop{50%{transform:scale(1.12);box-shadow:0 0 0 2px #f2ca79,0 0 22px #f2ca79}}
    .fs-size{flex:none;display:flex;align-items:center;gap:8px;color:#aaa;padding:0 10px;border-radius:999px;background:rgba(20,20,40,.55);
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);pointer-events:auto}
    .fs-size input{width:70px;accent-color:#f2ca79}

    /* ---- the side panel ---- */
    body.side .fs-ui{top:0;right:0;bottom:0;left:auto;width:var(--pw);box-sizing:border-box;padding:16px 12px 12px;gap:12px;pointer-events:auto;
      background:linear-gradient(180deg,rgba(20,18,44,.97),rgba(30,18,40,.97));border-left:1px solid rgba(255,255,255,.07);
      box-shadow:-12px 0 40px rgba(0,0,0,.4)}
    body.side .fs-head{display:flex;flex-direction:column;gap:10px}
    body.side .fs-title{font:800 25px/1 system-ui,-apple-system,sans-serif;letter-spacing:.01em;padding:0 2px;
      background:linear-gradient(90deg,#ffd27a,#ff8a4a 45%,#ff5aa0);-webkit-background-clip:text;background-clip:text;color:transparent;
      filter:drop-shadow(0 2px 10px rgba(255,120,80,.25))}
    body.side .fs-title small{display:block;font:600 11px system-ui,sans-serif;color:#8a86a0;-webkit-text-fill-color:#8a86a0;margin-top:5px;letter-spacing:.02em}
    body.side .fs-ui .book{display:grid;grid-template-columns:1fr auto;gap:6px 8px;border-radius:12px;padding:9px 11px;width:100%;
      background:rgba(255,255,255,.05);color:#ccc;text-align:left}
    body.side .fs-ui .book b{color:#f2ca79}
    body.side .fs-ui .book s{display:block;grid-column:1/3;height:5px;border-radius:3px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}
    body.side .fs-ui .book s::after{content:'';position:absolute;inset:0;width:var(--p);border-radius:3px;background:linear-gradient(90deg,#ffd27a,#ff7a4a)}
    body.side .fs-ui .book:hover{background:rgba(255,255,255,.09)}
    body.side .fs-row{max-width:none;overflow:visible;flex-wrap:wrap}
    body.side .fs-find{width:100%;margin-bottom:-4px}
    body.side .fs-find input{border-radius:10px;font-size:14px;padding:7px 30px;background:rgba(255,255,255,.06);backdrop-filter:none;-webkit-backdrop-filter:none}
    @media (hover:none){body.side .fs-find input{font-size:16px}}
    body.side .fs-mats{display:flex;flex-direction:column;flex-wrap:nowrap;gap:6px;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
      margin:0 -4px;padding:3px 4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent}
    body.side .fs-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;flex:none}
    body.side .fs-sec{display:flex;flex-direction:column;gap:6px;flex:none}
    body.side .fs-sec+.fs-sec{margin-top:2px}
    body.side .fs-sec.shut .fs-grid{display:none}
    body.side .fs-mats button.fs-sh{position:sticky;top:-3px;z-index:1;width:100%;justify-content:flex-start;border-radius:8px;padding:6px 6px 5px;
      background:#1d1534;box-shadow:0 1px 0 rgba(255,255,255,.06);font-size:11px;color:#8a86a0;transform:none}
    body.side .fs-mats button.fs-sh:hover{background:#251c40;color:#ddd;transform:none}
    body.side .fs-mats button.fs-sh small{margin-left:auto}
    body.side .fs-mats button,body.side .fs-tools button{border-radius:10px;padding:7px 8px;font-size:12.5px;min-width:0;
      background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);backdrop-filter:none}
    body.side .fs-mats button i,body.side .fs-tools button i{width:18px;height:18px;border-radius:5px}
    body.side .fs-mats button:hover,body.side .fs-tools button:hover{background:rgba(255,255,255,.1);transform:translateY(-1px)}
    body.side .fs-mats button.on,body.side .fs-tools button.on{background:rgba(255,255,255,.13);color:#fff;
      box-shadow:inset 0 0 0 1.5px var(--c,#fff),0 0 16px -4px var(--c,#fff)}
    body.side .fs-tools{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07)}
    body.side .fs-tools button.plain{justify-content:center;color:#bbb}
    body.side .fs-size{grid-column:1/-1;box-sizing:border-box;min-width:0;border-radius:10px;padding:7px 10px;background:rgba(255,255,255,.05);box-shadow:none;justify-content:space-between}
    body.side .fs-size input{flex:1;width:auto;min-width:0}
    body.side .fs-tools button{justify-content:center;padding-left:6px;padding-right:6px}
    @media (max-height:520px){
      body.side .fs-ui{padding:10px 8px 8px;gap:7px}
      body.side .fs-head{flex-direction:row;align-items:center;gap:8px}
      body.side .fs-title{font-size:18px}
      body.side .fs-title small{display:none}
      body.side .fs-ui button.clock{padding:5px 7px}
      body.side .fs-ui button.clock span,body.side .fs-ui button.clock small{display:none}
      body.side .fs-ui .book{padding:5px 8px;font-size:11px;gap:3px 6px;flex:1;min-width:0}
      body.side .fs-ui .book span{display:none}
      body.side .fs-ui .book b{grid-column:1/3;text-align:right}
      body.side .fs-ui .book s{height:3px}
      body.side .fs-find input{padding:4px 26px 4px 28px}
      body.side .fs-find{margin-bottom:0}
      body.side .fs-find kbd{display:none}
      body.side .fs-mats button.fs-sh{padding:4px 6px 3px;font-size:10px}
      body.side .fs-grid,body.side .fs-sec,body.side .fs-mats{gap:5px}
      body.side .fs-mats button,body.side .fs-tools button{padding:5px 6px;font-size:11.5px;gap:6px}
      body.side .fs-mats button i,body.side .fs-tools button i{width:14px;height:14px;border-radius:4px}
      body.side .fs-tools{padding-top:6px}
      body.side .fs-size{padding:4px 8px}
    }

    .fs-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);opacity:0;transition:all .35s ease;z-index:8;
      background:rgba(22,18,40,.94);color:#eee;border-radius:14px;padding:10px 16px;font:500 14px system-ui,sans-serif;
      box-shadow:0 6px 30px rgba(0,0,0,.5);text-align:center;pointer-events:none;border:1px solid rgba(255,255,255,.1)}
    body.side .fs-toast{left:calc((100% - var(--pw)) / 2)}
    .fs-toast.show{opacity:1;transform:translate(-50%,0)}
    .fs-toast b{font-size:16px;display:block;margin-bottom:2px}
    .fs-toast small{color:#999}
    .fs-toast .sw{display:inline-block;width:13px;height:13px;border-radius:4px;background-size:cover;image-rendering:pixelated;vertical-align:-1px;margin-right:4px}
    .fs-book{position:fixed;inset:0;background:rgba(4,4,14,.72);z-index:9;display:none;align-items:center;justify-content:center;
      font:14px system-ui,sans-serif;color:#eee}
    .fs-book.open{display:flex}
    .fs-book .panel{background:#17152a;border:1px solid rgba(255,255,255,.1);border-radius:18px;width:min(560px,92vw);max-height:84vh;
      overflow:auto;padding:18px 18px 14px}
    .fs-book h2{margin:0 0 4px;font-size:20px}
    .fs-book h3{margin:14px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#888;font-weight:650}
    .fs-book h3:first-of-type{margin-top:0}
    .fs-book .sub{color:#999;margin-bottom:14px}
    .fs-book .bar{height:6px;border-radius:3px;background:#2a2840;margin-bottom:14px;overflow:hidden}
    .fs-book .bar div{height:100%;background:linear-gradient(90deg,#ffd27a,#ff7a4a)}
    .fs-book .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
    .fs-book .card{background:#211e36;border-radius:12px;padding:9px 10px;display:flex;gap:9px;align-items:flex-start}
    .fs-book .card i{flex:none;width:16px;height:16px;border-radius:5px;margin-top:1px;background-size:cover;image-rendering:pixelated}
    .fs-book .card .n{font-weight:650}
    .fs-book .card .h{color:#999;font-size:12px;margin-top:2px}
    .fs-book .card.locked .n{color:#666}
    .fs-book .card.locked i{background:#333 !important}
    .fs-book .foot{display:flex;justify-content:space-between;margin-top:14px}
    .fs-book .foot button{border:0;border-radius:999px;padding:7px 14px;cursor:pointer;font:inherit;background:#2a2840;color:#ddd}
    .fs-book .foot button.reset{background:none;color:#777}
    .fs-ui button.danger,body.side .fs-tools button.danger{color:#ff9a8a}
    .fs-ui button.danger:hover{background:rgba(255,90,70,.16)}
    .fs-warn{position:fixed;inset:0;background:rgba(4,4,14,.72);z-index:10;display:none;align-items:center;justify-content:center;font:14px system-ui,sans-serif;color:#eee}
    .fs-warn.open{display:flex}
    .fs-warn .panel{background:#17152a;border:1px solid rgba(255,255,255,.1);border-radius:18px;width:min(340px,88vw);padding:20px 20px 16px;
      box-shadow:0 20px 60px rgba(0,0,0,.5);animation:fsIn .18s ease}
    @keyframes fsIn{from{transform:scale(.94);opacity:0}}
    .fs-warn h2{margin:0 0 8px;font-size:19px}
    .fs-warn p{margin:0 0 18px;color:#aaa;line-height:1.45}
    .fs-warn p b{color:#f2ca79}
    .fs-warn .row{display:flex;gap:8px;justify-content:flex-end}
    .fs-warn button{border:0;border-radius:999px;padding:8px 15px;cursor:pointer;font:600 14px system-ui,sans-serif;background:#2a2840;color:#ddd}
    .fs-warn button.go{background:#e5533d;color:#fff}
    .fs-warn button.go:hover{background:#f0634c}
    @media (max-width:600px){.fs-ui{font-size:12px}.fs-ui button{padding:5px 9px 5px 7px}}`;
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.className = 'fs-ui';
  ui.head = document.createElement('div'); ui.head.className = 'fs-head';
  ui.head.innerHTML = '<div class="fs-trow"><div class="fs-title">Crucible<small>Make things happen to discover more</small></div></div>';
  ui.trow = ui.head.firstChild;
  ui.clock = mkBtn('', 'plain clock', () => { clockOn = !clockOn; updateClock(true); });
  ui.clock.title = 'Time of day. Click to stop or start the clock.';
  ui.find = document.createElement('label'); ui.find.className = 'fs-find';
  ui.find.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>'
    + '<input type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-label="Search your discoveries">'
    + '<kbd>/</kbd><button type="button" class="x" aria-label="Clear search">&times;</button>';
  ui.findIn = ui.find.querySelector('input');
  ui.findIn.oninput = () => { query = ui.findIn.value; buildMaterialRow(); };
  ui.findIn.onkeydown = (e) => {
    if (e.key === 'Enter') { // pick the best match and go back to the full list with it showing
      const first = ui.mats.querySelector('.fs-grid button');
      const id = first ? +first.dataset.id : null;
      clearSearch(); ui.findIn.blur();
      if (id !== null) { selectBrush(id); revealBrush(id); }
    } else if (e.key === 'Escape') { e.stopPropagation(); clearSearch(); ui.findIn.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const b = ui.mats.querySelector('.fs-grid button'); if (b) b.focus(); }
  };
  ui.find.querySelector('.x').onclick = (e) => { e.preventDefault(); clearSearch(); ui.findIn.focus(); };
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || ui.find.style.display === 'none' || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    e.preventDefault(); ui.findIn.focus(); ui.findIn.select();
  });
  ui.mats = document.createElement('div'); ui.mats.className = 'fs-row fs-mats';
  ui.tools = document.createElement('div'); ui.tools.className = 'fs-row fs-tools';
  root.append(ui.head, ui.find, ui.mats, ui.tools);
  document.body.appendChild(root);

  ui.book = mkBtn('', 'plain book', openBook);
  const eraser = mkBtn('<i style="background:repeating-conic-gradient(#333 0 25%,#111 0 50%) 0 0/8px 8px"></i><span>Eraser</span>', '', () => selectBrush(EMPTY));
  eraser.style.setProperty('--c', '#aaa');
  ui.eraser = eraser;
  const size = document.createElement('label');
  size.className = 'fs-size';
  size.innerHTML = 'Size <input type="range" min="0.4" max="3" step="0.1" value="1">';
  size.querySelector('input').oninput = (e) => { brushScale = parseFloat(e.target.value); };
  ui.pause = mkBtn('Pause', 'plain', () => { paused = !paused; ui.pause.textContent = paused ? 'Play' : 'Pause'; });
  const clear = mkBtn('Clear', 'plain', () => type.fill(EMPTY));
  const reset = mkBtn('Reset', 'plain danger', askReset);
  reset.title = 'Start the game again';
  ui.tools.append(ui.book, eraser, clear, ui.pause, reset, size);

  ui.warn = document.createElement('div'); ui.warn.className = 'fs-warn';
  ui.warn.onclick = (e) => { if (e.target === ui.warn) closeWarn(); };
  document.body.appendChild(ui.warn);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeWarn(); ui.bookEl.classList.remove('open'); } });

  ui.toast = document.createElement('div'); ui.toast.className = 'fs-toast';
  document.body.appendChild(ui.toast);

  ui.bookEl = document.createElement('div'); ui.bookEl.className = 'fs-book';
  ui.bookEl.onclick = (e) => { if (e.target === ui.bookEl) ui.bookEl.classList.remove('open'); };
  document.body.appendChild(ui.bookEl);

  buildMaterialRow();
}

function mkBtn(html, cls, fn) {
  const b = document.createElement('button');
  b.innerHTML = html; if (cls) b.className = cls; b.onclick = fn;
  return b;
}

// a tiny pixel swatch of each material, made from its real colours
const SWATCH = {};
function swatch(m) {
  if (SWATCH[m.key]) return SWATCH[m.key];
  const c = document.createElement('canvas'); c.width = c.height = 6;
  const g = c.getContext('2d'), d = g.createImageData(6, 6);
  g.fillStyle = m.dot;
  const f = g.fillStyle; // the browser gives this back as #rrggbb or rgba(...)
  let base = f[0] === '#' ? [1, 3, 5].map((k) => parseInt(f.slice(k, k + 2), 16)) : f.match(/[\d.]+/g).slice(0, 3).map(Number);
  if (!m.anim && m.key !== 'sand') base = m.color;
  const pick = { fire: [[255, 90, 20], [255, 170, 40], [255, 230, 120]], flower: FLOWERS, fish: FISH, sand: [SAND_A, SAND_B, [244, 186, 100]],
    lava: [[255, 80, 20], [255, 150, 30], [230, 60, 20]], ember: [[230, 70, 20], [170, 50, 16], [250, 110, 40]] }[m.key];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const p = (x + y * 6) * 4, n = Math.random();
    let r, gg, b;
    if (pick) [r, gg, b] = pick[(n * pick.length) | 0];
    else if (m.rainbow) { setHue(x / 6 + y / 18); r = HR * 0.8 + 40; gg = HG * 0.8 + 40; b = HB * 0.8 + 40; }
    else if (m.key === 'bee') [r, gg, b] = y % 3 === 2 ? [60, 40, 10] : [255, 214, 40];
    else { const v = 0.82 + 0.32 * n; r = base[0] * v; gg = base[1] * v; b = base[2] * v; }
    d.data[p] = r; d.data[p + 1] = gg; d.data[p + 2] = b; d.data[p + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return (SWATCH[m.key] = c.toDataURL());
}
const sw = (m) => `background-image:url(${swatch(m)})`;

let lastNew = null;
const have = (m) => findable(m) && found[m.key] && !queued.has(m.key);
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// how well a discovery matches the search: name first, then words in the name, then how it was made
function matchRank(m, q) {
  const n = m.name.toLowerCase();
  if (n.startsWith(q)) return 0;
  if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
  if (n.includes(q)) return 2;
  if ((found[m.key] || '').toLowerCase().includes(q)) return 3;
  return -1;
}

function buildMaterialRow() {
  if (!ui.mats) return;
  // once there are too many to see at once, the list folds into categories and gets a search box
  grouped = foundCount() > (side ? 14 : 8);
  ui.find.style.display = grouped ? '' : 'none';
  if (!grouped && query) clearSearch(true);
  const n = foundCount(), total = totalFindable();
  ui.findIn.placeholder = side && windowHeight < 520 ? `Search ${n}` : `Search ${n} discoveries`;
  ui.find.classList.toggle('typing', !!query);

  const keepTop = ui.mats.scrollTop, keepLeft = ui.mats.scrollLeft;
  ui.mats.innerHTML = '';
  ui.matBtns = {}; ui.secHeads = {};
  const grid = () => { const g = document.createElement('div'); g.className = 'fs-grid'; return g; };
  const addBtn = (m, into) => {
    const b = mkBtn(`<i style="${sw(m)}"></i><span>${m.name}</span>`, '', () => selectBrush(m.id));
    b.style.setProperty('--c', m.dot);
    b.dataset.id = m.id;
    b.title = found[m.key] && found[m.key] !== 'Starting element' ? `${m.name}: ${found[m.key]}` : m.name;
    if (m.id === lastNew) b.classList.add('new');
    into.appendChild(b); ui.matBtns[m.id] = b;
  };

  const q = query.trim().toLowerCase();
  if (q) {
    const hits = [];
    for (const m of MATS) { if (!have(m)) continue; const r = matchRank(m, q); if (r >= 0) hits.push([r, m]); }
    hits.sort((a, b) => a[0] - b[0]);
    const g = grid();
    for (const [, m] of hits) addBtn(m, g);
    ui.mats.appendChild(g);
    if (!hits.length) ui.mats.insertAdjacentHTML('beforeend', `<p class="fs-none">Nothing you've found matches “${esc(query.trim())}” yet.</p>`);
  } else if (grouped) {
    for (const [key, label] of CATS) {
      const list = MATS.filter((m) => have(m) && m.cat === key);
      if (!list.length) continue;
      const sec = document.createElement('div');
      sec.className = 'fs-sec' + (folds.has(key) ? ' shut' : '');
      const head = mkBtn(`<em></em><span>${label}</span><b></b><small>${list.length}</small>`, 'fs-sh', () => {
        const shut = sec.classList.toggle('shut');
        if (shut) folds.add(key); else folds.delete(key);
        head.setAttribute('aria-expanded', !shut);
        saveFolds();
      });
      head.setAttribute('aria-expanded', !folds.has(key));
      head.title = `Show or hide ${label.toLowerCase()}`;
      const g = grid();
      for (const m of list) addBtn(m, g);
      sec.append(head, g);
      ui.mats.appendChild(sec); ui.secHeads[key] = head;
    }
  } else {
    const g = grid();
    for (const m of MATS) if (have(m)) addBtn(m, g);
    ui.mats.appendChild(g);
  }
  ui.mats.scrollTop = q ? 0 : keepTop; ui.mats.scrollLeft = q ? 0 : keepLeft;

  ui.book.innerHTML = `<span>Discoveries</span><b>${n}/${total}</b><s style="--p:${(n / total) * 100}%"></s>`;
  selectBrush(brush);
}

function clearSearch(quiet) {
  query = ''; ui.findIn.value = '';
  if (!quiet) buildMaterialRow();
}

// make sure a material's button can be seen: open its category and scroll to it
function revealBrush(id) {
  const m = MATS[id];
  if (!m || id === EMPTY) return;
  if (folds.has(m.cat)) {
    folds.delete(m.cat); saveFolds();
    const h = ui.secHeads[m.cat];
    if (h) { h.parentNode.classList.remove('shut'); h.setAttribute('aria-expanded', true); }
  }
  const b = ui.matBtns[id];
  if (b) requestAnimationFrame(() => b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }));
}

function selectBrush(id) {
  brush = id;
  for (const k in ui.matBtns) ui.matBtns[k].classList.toggle('on', +k === id);
  ui.eraser.classList.toggle('on', id === EMPTY);
  // a folded category still shows a dot when the selected material is inside it
  const m = id !== EMPTY && MATS[id];
  for (const k in ui.secHeads) {
    const holds = !!m && m.cat === k;
    ui.secHeads[k].classList.toggle('holds', holds);
    if (holds) ui.secHeads[k].style.setProperty('--c', m.dot);
  }
}

// first visit: say what the game is
function hello() {
  ui.toast.innerHTML = `<b>Crucible</b>Mix sand, water, fire and earth.<br>There are ${totalFindable() - 4} more things to discover.`;
  ui.toast.classList.add('show');
  setTimeout(() => { if (!toastBusy) ui.toast.classList.remove('show'); }, 5000);
}

// discoveries are announced one at a time; the button only appears with its pop-up
function nextToast() {
  const m = toastQ.shift();
  if (!m) { toastBusy = false; ui.toast.classList.remove('show'); return; }
  toastBusy = true;
  const wasShowing = ui.toast.classList.contains('show');
  ui.toast.classList.remove('show');
  setTimeout(() => {
    queued.delete(m.key);
    lastNew = m.id;
    buildMaterialRow();
    if (!query) revealBrush(m.id); // a new discovery opens its category so you can see it
    const more = toastQ.length ? ` · ${toastQ.length} more coming` : '';
    ui.toast.innerHTML = `<b><span class="sw" style="${sw(m)}"></span>New discovery: ${m.name}</b>${found[m.key]}<br><small>${foundCount()} of ${totalFindable()} found${more}</small>`;
    ui.toast.classList.add('show');
    setTimeout(nextToast, toastQ.length ? 2600 : 3400);
  }, wasShowing ? 350 : 0);
}

function openBook() {
  const n = foundCount(), total = totalFindable();
  let cards = '';
  for (const [key, label] of CATS) {
    const list = MATS.filter((m) => findable(m) && m.cat === key);
    const got1 = (m) => found[m.key] && !queued.has(m.key);
    cards += `<h3>${label} · ${list.filter(got1).length}/${list.length}</h3><div class="grid">`;
    for (const m of list) {
      const got = got1(m) && found[m.key];
      cards += got
        ? `<div class="card"><i style="${sw(m)}"></i><div><div class="n">${m.name}</div><div class="h">${got}</div></div></div>`
        : `<div class="card locked"><i></i><div><div class="n">???</div><div class="h">${m.hint || ''}</div></div></div>`;
    }
    cards += '</div>';
  }
  ui.bookEl.innerHTML = `<div class="panel">
    <h2>Discoveries</h2>
    <div class="sub">${n} of ${total} found. Make things happen in the world to find more.</div>
    <div class="bar"><div style="width:${(n / total) * 100}%"></div></div>
    ${cards}
    <div class="foot"><button class="reset">Start over</button><button class="close">Close</button></div></div>`;
  ui.bookEl.querySelector('.close').onclick = () => ui.bookEl.classList.remove('open');
  ui.bookEl.querySelector('.reset').onclick = askReset;
  ui.bookEl.classList.add('open');
}

// ================= starting again =================
function askReset() {
  const n = foundCount() - 4;
  const lose = n > 0 ? `It clears the world and forgets <b>${n} discover${n === 1 ? 'y' : 'ies'}</b>.` : 'It clears the world.';
  ui.warn.innerHTML = `<div class="panel" role="alertdialog" aria-labelledby="fsWarnT">
    <h2 id="fsWarnT">Start again?</h2>
    <p>${lose} You'll be back to sand, water, fire and earth. This can't be undone.</p>
    <div class="row"><button class="no">Keep playing</button><button class="go">Reset everything</button></div></div>`;
  ui.warn.querySelector('.no').onclick = closeWarn;
  ui.warn.querySelector('.go').onclick = () => { closeWarn(); resetAll(); };
  ui.warn.classList.add('open');
  ui.warn.querySelector('.no').focus();
}
function closeWarn() { if (ui.warn) ui.warn.classList.remove('open'); }

function resetAll() {
  found = {}; pending = {}; queued.clear(); toastQ.length = 0;
  try { localStorage.removeItem(STORE); } catch (e) {}
  loadFound(); saveFound();
  type.fill(EMPTY); life.fill(0);
  brush = M.sand; grouped = false; lastNew = null; query = ''; ui.findIn.value = ''; folds.clear(); saveFolds();
  paused = false; ui.pause.textContent = 'Pause';
  dayT = 0.68; clockOn = true; updateTime(false); updateClock(true);
  ui.bookEl.classList.remove('open');
  buildMaterialRow();
  hello();
}
