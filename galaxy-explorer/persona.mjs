// The one you are talking to: a person, not just a member of a species. Each has a name in
// their own sounds, a job (by where you meet them), a temper that colours everything they
// say (warm, dry, solemn, playful, prickly, dreamy) and a habit of speech; and their body
// says as much as their words (bodyLine: a crest lifting, markings pulsing, a coil
// tightening). talkTopics() gives what you can ask them and what they answer, from what is
// true of them: their world, their people, their path, how far they have come, you.
// Pure data (no DOM, no Three.js); contact-ui.js shows it, game.js starts it.
import { rng } from './rng.mjs';
import { plural } from './structures.mjs';

const TEMPERS = ['warm', 'dry', 'solemn', 'playful', 'prickly', 'dreamy'];
const ROLES = {
  deck: ['dockhand', 'pilot', 'quartermaster', 'navigator', 'engineer', 'harbourmaster', 'cargo-singer'],
  ark: ['steward of the hall', 'tram driver', 'grower', 'foundry hand', 'archivist', 'warden', 'shipwright'],
  town: ['farmer', 'potter', 'keeper of the well', 'trader', 'elder', 'builder', 'storyteller'],
  home: ['householder', 'elder', 'cook', 'weaver', 'keeper of the hearth'],
};
const QUIRKS = [
  { id: 'counts', line: 'It counts things under its breath while it listens.', speech: (s) => s },
  { id: 'echo', line: 'It repeats your last word to itself, as if tasting it.', speech: (s) => s },
  { id: 'questions', line: 'It ends what it says with a question, waiting for yours.', speech: (s) => `${s} ${['And you?', 'Yes?', 'You see?'][s.length % 3]}` },
  { id: 'proverbs', line: 'It speaks in old sayings.', speech: (s) => s },
  { id: 'hums', line: 'It hums between sentences.', speech: (s) => s },
  { id: 'formal', line: 'It addresses you with every courtesy.', speech: (s) => s.replace(/^You /, 'Honoured traveller, you ') },
];
const PROVERBS = ['The tide keeps no promises.', 'A slow root splits the stone.', 'Every star was somebody’s morning.', 'Who carries water knows the hill.', 'The deep sky has no strangers, only the not-yet-met.'];

function nameOf(civ, r) {
  const src = (civ.species.name || 'ka').toLowerCase().replace(/[^a-z]/g, '');
  const V = 'aeiouy', vow = [...src].filter((c) => V.includes(c)), con = [...src].filter((c) => !V.includes(c));
  const pick = (a, d) => (a.length ? a[Math.floor(r() * a.length)] : d);
  const syl = () => pick(con, 'k') + pick(vow, 'a') + (r() < .4 ? pick(con, 'n') : '');
  const n = syl() + syl() + (r() < .5 ? `'${syl()}` : '');
  return n[0].toUpperCase() + n.slice(1);
}

// key: what makes this one themselves (a crew index, a creature id).
export function personaOf(civ, key, where = 'deck') {
  const r = rng(civ.seed ?? 1, 'persona', civ.id, String(key));
  const t = civ.species.traits || {};
  // Temper leans with the species, but each is their own.
  const lean = { warm: t.sociality ?? .5, dry: (t.intelligence ?? .5) * .8, solemn: t.caution ?? .3, playful: (t.sociality ?? .5) * (1 - (t.caution ?? .3)), prickly: t.aggression ?? .2, dreamy: (t.perception ?? .5) * .7 };
  const temper = TEMPERS.map((k) => [k, lean[k] * .6 + r() * 1.2]).sort((a, b) => b[1] - a[1])[0][0];
  const roles = ROLES[where] || ROLES.deck;
  return { name: nameOf(civ, r), role: roles[Math.floor(r() * roles.length)], temper, quirk: QUIRKS[Math.floor(r() * QUIRKS.length)], proverb: PROVERBS[Math.floor(r() * PROVERBS.length)], seed: r() };
}

// How their body shows a feeling (warm/glad, curious, uneasy, proud), from the body they have.
export function bodyLine(sp, feeling, r = Math.random) {
  const lines = [];
  if (sp.crest || sp.frill) lines.push({ glad: 'Its crest lifts and fans out.', curious: 'Its frill half-opens, quivering.', uneasy: 'Its crest flattens against its head.', proud: 'Its crest rises tall and stiff.' }[feeling]);
  if (sp.glow) lines.push({ glad: 'Its markings brighten, pulsing slowly.', curious: 'Its markings flicker, a quick ripple of light.', uneasy: 'Its markings dim to almost nothing.', proud: 'Its markings blaze in rings down its body.' }[feeling]);
  if (sp.arms) lines.push({ glad: 'It spreads its hands, palms out.', curious: 'It turns one hand over, as if weighing your words.', uneasy: 'It folds its arms in close.', proud: 'It sets a hand flat on its chest.' }[feeling]);
  const plan = sp.plan;
  if (plan === 'serpent' || plan === 'slug') lines.push({ glad: 'It loosens its coils and sways.', curious: 'It lifts its head higher, swaying toward you.', uneasy: 'Its coils tighten.', proud: 'It rears up to its full height.' }[feeling]);
  if (plan === 'floater' || plan === 'radial') lines.push({ glad: 'It turns a slow, happy circle.', curious: 'It drifts a little closer.', uneasy: 'It rises out of reach.', proud: 'It swells, every spoke outstretched.' }[feeling]);
  if (plan === 'quadruped' || plan === 'hexapod' || plan === 'arachnid') lines.push({ glad: 'It shifts its weight from foot to foot, eager.', curious: 'It lowers its head to look at you more closely.', uneasy: 'It steps back, legs braced.', proud: 'It stands square and still.' }[feeling]);
  lines.push({ glad: 'It makes a low, pleased sound.', curious: 'It tilts its head.', uneasy: 'It goes very still.', proud: 'It lifts its head.' }[feeling]);
  const ok = lines.filter(Boolean);
  return ok[Math.floor(r() * ok.length)];
}

// The voice: one sentence through their temper.
function voice(p, s) {
  const open = { warm: ['Oh, ', 'Ah, ', ''], dry: ['', 'Well. '], solemn: ['', 'Listen. '], playful: ['Ha! ', 'Ooh, ', ''], prickly: ['', 'Hm. '], dreamy: ['', 'Mm… '] }[p.temper];
  let out = open[Math.floor(Math.random() * open.length)] + s;
  out = p.quirk.speech(out);
  return out;
}

// What you can ask: [{ id, label, answer: () => ({ text, body, feeling, gesture }) }].
// ctx: { home, homeType, stance, step, ark, system, others, shipName }
export function talkTopics(civ, p, ctx) {
  const sp = civ.species, many = plural(sp.name), W = ctx.home || 'our world', r = rng(civ.seed ?? 1, 'talk', p.name);
  const say = (s) => voice(p, s);
  const PATH = {
    agrarian: `We are growers. Everything we are came out of the soil of ${W}, and we never forget it.`,
    scholarly: 'We are askers of questions. We would rather know a thing than own it.',
    mercantile: 'We are traders. A thing is worth what someone across the sky will give for it.',
    devotional: `We keep faith with the sky. Every eclipse over ${W} is a word we are still learning to read.`,
    martial: 'We have fought, and won, and learned what it costs. We keep our guard up so our children need not.',
    expansionist: 'We are always going further. There is no edge we will not cross, given time.',
  };
  const WANT = {
    agrarian: 'Plants. Bring us the green things of other worlds and you will have friends here.',
    scholarly: 'The strange things. Sky events, the cores of worlds, life that does not run on water.',
    mercantile: 'News of other peoples: their towns, their stations. That is the richest cargo.',
    devotional: 'What you have seen in other skies: the eclipses, the auroras, the old signals.',
    martial: 'Tell us what hunts on other worlds. Know your dangers.',
    expansionist: 'Other worlds. Their names, their weather, whether we could live there.',
  };
  const job = {
    dockhand: 'I load and unload what comes in on the pads. Today, you came in.',
    pilot: 'I fly the long hauls between our worlds. I know every lane in the system by heart.',
    quartermaster: 'I keep count of everything aboard: every crate, every cup of water.',
    navigator: 'I plot the courses. The sky is a map to me, not a ceiling.',
    engineer: 'I keep the station breathing. If something hums wrong, I hear it before anyone.',
    harbourmaster: 'I say who lands and who waits. You landed.',
    'cargo-singer': 'I sing the cargo in, so the haulers keep time. It is an old job.',
    'steward of the hall': 'I look after the hall: its lights, its air, its people.',
    'tram driver': 'I drive the trams down the hall, end to end, all day. I never tire of the view.',
    grower: 'I tend the fields under the lamps. Food for a hundred thousand mouths.',
    'foundry hand': 'I pour metal in the foundry. Hot work, honest work.',
    archivist: 'I keep the records of everything we were before we left the ground.',
    warden: 'I keep the peace in the hall. Mostly it keeps itself.',
    shipwright: 'I build ships. The big one in the yard has been seven years in the making.',
    farmer: 'I farm the slopes above the town.', potter: 'I make pots. Everything here that holds water, I made, or my mother did.',
    'keeper of the well': 'I keep the well clean and the water fair.', trader: 'I buy and sell. Mostly I talk.',
    elder: 'I am old. I remember when the first ship went up.', builder: 'I build houses, and mend them.',
    storyteller: 'I keep the stories, and tell them to anyone who will sit still.',
    householder: 'This is my home. You are welcome in it.', cook: 'I cook for this house. You should eat something.',
    weaver: 'I weave. Look at the walls: those are mine.', 'keeper of the hearth': 'I keep the fire. In this house it has not gone out in four generations.',
  }[p.role] || 'I work here.';
  const reach = civ.tier === 'system-shapers' ? 'We have reshaped this whole system: rings round the star, an ark, cities from pole to pole.'
    : civ.tier === 'spacefarers' ? 'We have ships between the worlds now. Our grandparents could not have imagined it.'
    : civ.tier === 'orbital' ? 'We have just reached orbit. A handful of stations, a handful of brave people.'
    : 'We have not yet left the ground. One day.';
  const ofYou = { welcome: 'You are welcome here. Truly. It is not every day the sky sends us someone new.', curious: 'You are the most interesting thing to happen here in years. Forgive me for staring.', wary: 'I do not know you yet. That is not an insult. It is only true.', guarded: 'We are watching you. If you are what you seem, that will not matter.' }[ctx.stance];
  const deeper = ctx.step === 'friendship' ? ' And now you are a friend. That is not a small thing for us.' : ctx.step === 'trust' ? ' But you have earned some trust. I will remember that.' : '';
  const topics = [
    { id: 'self', label: 'Who are you?', answer: () => ({ text: say(`I am ${p.name}. ${job}`), feeling: 'glad', gesture: true }) },
    { id: 'people', label: `Tell me about the ${many}.`, answer: () => ({ text: say(`${PATH[civ.path] || 'We are who we are.'} ${reach}`), feeling: 'proud' }) },
    { id: 'world', label: `What is ${W} like?`, answer: () => ({ text: say(ctx.ark ? `${W} is where we come from. Many of us live aboard ${ctx.ark} now, but the ground still calls.` : `${W}? ${ctx.homeType ? `It is ${ctx.homeType.toLowerCase()}, and ` : ''}it is home. The light here at dawn: you should see it before you go.`), feeling: 'glad' }) },
    { id: 'want', label: 'What would your people value?', answer: () => ({ text: say(WANT[civ.path] || 'Something we have never seen.'), feeling: 'curious' }) },
    { id: 'you', label: 'What do you make of me?', answer: () => ({ text: say(ofYou + deeper), feeling: ctx.stance === 'guarded' || ctx.stance === 'wary' ? 'uneasy' : 'curious', gesture: ctx.stance === 'welcome' }) },
  ];
  if (p.quirk.id === 'proverbs') topics.push({ id: 'saying', label: 'Do you have a saying for this?', answer: () => ({ text: `${p.proverb} ${p.temper === 'playful' ? 'My grandmother said that. She was usually wrong.' : 'We say it to travellers.'}`, feeling: 'proud' }) });
  if (ctx.others) topics.push({ id: 'others', label: 'Are there others like me?', answer: () => ({ text: say(ctx.others), feeling: 'curious' }) });
  void r;
  return topics;
}
