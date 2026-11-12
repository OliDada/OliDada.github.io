// Arriving in the system of a spacefaring people: they notice you. A few seconds after you
// are out in space, one of their great patrol ships comes out to meet you, a hull of their
// own design half a kilometre long, all running lights and engine glow. It slows and holds
// in front of you, sweeps a scan beam over your ship, and hails you; what it says depends on
// how they take strangers (stanceOf): a welcome, a curious look, a wary check or a warning.
// Then it clears you and goes on its way (a guarded people's ship shadows you a while first).
// Once per system per session. THREE is passed in; game.js calls update() every frame in
// space and slows your ship while you are asked to hold.
import { buildShip, shipDesign } from './ships.js';
import { stanceOf } from './station-deck.js';
import { tierAtLeast, civilizationsIn } from './civilizations.mjs';
import { plural } from './structures.mjs';

const SEEN = 'elsewhere-hailed';

// The people who would come out to meet you here, or null.
export function patrolFor(system, starId, { force = false } = {}) {
  const civs = civilizationsIn(system).filter((c) => tierAtLeast(c.tier, 'spacefarers'));
  if (!civs.length) return null;
  civs.sort((a, b) => (b.tier === 'system-shapers') - (a.tier === 'system-shapers'));
  let seen = [];
  try { seen = JSON.parse(sessionStorage.getItem(SEEN) || '[]'); } catch {}
  if (!force && seen.includes(starId)) return null;
  return civs[0];
}

const LINES = {
  welcome: (n, w) => [[`${n} patrol vessel to arriving ship: welcome to ${w}.`, 'We read one crew, a small hull, no weapons we know. You are very far from home.'], ['You are cleared to fly anywhere in our system. Our worlds and our ark are open to you.', 'Fly well, traveller.']],
  curious: (n, w) => [[`Unknown vessel, hold your course a moment. We have never seen a hull like yours.`, 'Our scanners are going over every plate of it. We mean no harm: we only want to know you.'], [`Remarkable. Thank you. You are cleared to enter ${w}.`, 'If you land, our people will want to meet you.']],
  wary: (n, w) => [[`Unidentified vessel. Hold position.`, `No ship approaches the worlds of ${w} until we know what it carries.`], ['Scan complete. You carry nothing that threatens us.', 'You may enter. Keep clear of our shipping lanes.']],
  guarded: (n, w) => [[`Unidentified craft: cut your engines. Any move toward our worlds will be answered.`, 'Our weapons are on you while we scan.'], ['You are cleared, for now. One of our ships will keep you company until we are sure of you.', 'Do not test our patience.']],
};
const REPLIES = {
  welcome: ['Thank you. It is a beautiful system.', 'It is. Ask at the port if you need anything at all.'],
  curious: ['Where did your people come from?', 'From the third shelf of our homeworld, long ago. Come and see the old city, if you like.'],
  wary: ['I mean no harm.', 'Then you have nothing to fear from us.'],
  guarded: ['Understood. I come in peace.', 'We will see.'],
};

export function createPatrol(THREE, scene, civ, hud, { starId, name, words = null }) {
  try { const seen = JSON.parse(sessionStorage.getItem(SEEN) || '[]'); seen.push(starId); sessionStorage.setItem(SEEN, JSON.stringify(seen)); } catch {}
  const stance = stanceOf(civ), many = plural(civ.species.name), who = `the ${many}`;
  const [hail, clear] = words ? [words.hail, words.clear] : LINES[stance](cap(many.replace(/^the /, '')), name);
  const reply = words ? words.reply : REPLIES[stance];
  // The ship: their own design, scaled to a cruiser, with running lights and a floodlight.
  const design = shipDesign(civ), group = new THREE.Group(), body = [], glowing = [];
  const scale = 520 / design.length;
  buildShip(THREE, design, (g, m, colour, bright) => {
    const mesh = new THREE.Mesh(g, bright ? new THREE.MeshBasicMaterial({ color: colour }) : new THREE.MeshStandardMaterial({ color: colour, flatShading: true, roughness: .45, metalness: .35 }));
    mesh.applyMatrix4(m); mesh.frustumCulled = false; (bright ? glowing : body).push(mesh); group.add(mesh);
  }, new THREE.Matrix4(), scale);
  const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  for (const c of group.children) c.position.sub(centre);
  const len = Math.max(size.x, size.y, size.z);
  const blinks = [];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(len * .006, 6, 4), new THREE.MeshBasicMaterial({ color: i % 3 ? design.glow : '#ff5a4a' }));
    l.position.set(Math.cos(a) * size.x * .5, Math.sin(a) * size.y * .5, (i / 18 - .5) * size.z * .9); group.add(l); blinks.push(l);
  }
  const holder = new THREE.Group(); holder.add(group);
  if (design.stands) group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); // standing hulls fly nose first
  // The scan: a cone of light from the ship to yours, sweeping.
  const beamGeo = new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -.5, 0).rotateX(-Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: design.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.frustumCulled = false; scene.add(holder, beam);
  const V = () => new THREE.Vector3();
  let phase = 'wait', t = 0, rel = V(), from = V(), to = V(), leaveDir = V(), escort = 0;
  const panel = comm(hud, words ? 'THE CONCORD · WARDEN SHIP' : `${cap(who)} · ${civ.tier === 'system-shapers' ? 'SYSTEM AUTHORITY' : 'PATROL'}`, words ? '#ffd98a' : design.glow);
  const look = new THREE.Matrix4(), q = new THREE.Quaternion(), tmp = V(), side = V();

  function face(dir, dt, k = 2) {
    look.lookAt(V(), dir, new THREE.Vector3(0, 1, 0)); q.setFromRotationMatrix(look);
    holder.quaternion.slerp(q, 1 - Math.exp(-dt * k));
  }
  return {
    get done() { return phase === 'gone'; },
    // ship: { pos, fwd, up } (scene); waits until you are out in space. Returns { hold }.
    update(dt, ship, inSpace) {
      t += dt;
      for (const [i, l] of blinks.entries()) l.visible = Math.sin(t * 3 + i) > -.2;
      if (phase === 'wait') { holder.visible = false; if (!inSpace) { t = 0; return {}; } if (t < 4) return {}; phase = 'approach'; t = 0;
        side.crossVectors(ship.fwd, ship.up).normalize();
        from.copy(ship.fwd).multiplyScalar(14000).addScaledVector(side, 2500).addScaledVector(ship.up, 1200);
        to.copy(ship.fwd).multiplyScalar(len * 2.4 + 600).addScaledVector(side, len * .25).addScaledVector(ship.up, len * .04);
        rel.copy(from); holder.visible = true;
        panel.show(); panel.say(['Contact. A ship is coming out to meet you.'], true);
      }
      if (phase === 'approach') {
        const k = Math.min(1, t / 16), e = 1 - Math.pow(1 - k, 3);
        tmp.copy(rel); rel.lerpVectors(from, to, e); tmp.sub(rel).negate();
        face(tmp.lengthSq() > 1 ? tmp : ship.pos.clone().sub(holder.position).negate(), dt, 1.5);
        if (k >= 1) { phase = 'scan'; t = 0; panel.say(hail); }
      } else if (phase === 'scan') {
        face(rel.clone().negate(), dt, 1.2);
        const d = rel.length(); beam.material.opacity = Math.min(.18, t * .1) * (t < 6.5 ? 1 : Math.max(0, 1 - (t - 6.5)));
        beam.scale.set(16 + Math.sin(t * 2) * 10, 16 + Math.cos(t * 1.7) * 10, d);
        if (t > 7.5) { phase = 'cleared'; t = 0; panel.say(clear); panel.offer(reply[0], () => panel.say([reply[1]])); }
      } else if (phase === 'cleared') {
        face(rel.clone().negate(), dt, 1);
        if (t > 9) {
          phase = stance === 'guarded' && !words ? 'escort' : 'depart'; t = 0; panel.hide(5);
          leaveDir.copy(rel).normalize().addScaledVector(ship.up, .4).normalize();
        }
      } else if (phase === 'escort') { // it shadows you a while, a little behind and above
        to.copy(ship.fwd).multiplyScalar(-len * 1.2).addScaledVector(ship.up, len * .5).addScaledVector(side.crossVectors(ship.fwd, ship.up).normalize(), len * .8);
        rel.lerp(to, 1 - Math.exp(-dt * .4)); face(ship.fwd, dt, 1);
        if (t > 70) { phase = 'depart'; t = 0; leaveDir.copy(rel).normalize(); }
      } else if (phase === 'depart') {
        const sp = 40 + t * t * 60; rel.addScaledVector(leaveDir, sp * dt); face(leaveDir, dt, .8);
        if (t > 25) { phase = 'gone'; holder.visible = false; }
      }
      holder.position.copy(ship.pos).add(rel);
      beam.position.copy(holder.position); beam.lookAt(ship.pos);
      if (phase !== 'scan') beam.material.opacity *= Math.exp(-dt * 3);
      return { hold: phase === 'scan' || (phase === 'approach' && t > 8) };
    },
    dispose() { scene.remove(holder, beam); holder.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); beamGeo.dispose(); beam.material.dispose(); panel.remove(); },
  };
}

const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());

// The comm panel: a transmission, typed out line by line, and a reply you can give.
function comm(host, title, colour) {
  const el = document.createElement('section'); el.className = 'comm'; el.hidden = true; el.style.setProperty('--comm', colour);
  el.innerHTML = '<div class="eyebrow"><span class="comm-dot"></span>INCOMING TRANSMISSION · <b></b></div><div class="comm-lines"></div><div class="comm-reply"></div>';
  el.querySelector('b').textContent = title.toUpperCase();
  host.append(el);
  const lines = el.querySelector('.comm-lines'), reply = el.querySelector('.comm-reply');
  let typing = 0, hideTimer = 0;
  return {
    show() { clearTimeout(hideTimer); el.hidden = false; el.classList.remove('leaving'); },
    hide(after = 0) { clearTimeout(hideTimer); hideTimer = setTimeout(() => { el.classList.add('leaving'); setTimeout(() => (el.hidden = true), 800); }, after * 1000); },
    say(texts, quiet = false) {
      const id = ++typing; lines.replaceChildren(); reply.replaceChildren();
      let i = 0;
      const next = () => {
        if (id !== typing || i >= texts.length) return;
        const p = document.createElement('p'); if (quiet) p.className = 'comm-note'; lines.append(p);
        const s = texts[i++]; let c = 0;
        const step = () => { if (id !== typing) return; p.textContent = s.slice(0, ++c); if (c < s.length) setTimeout(step, 18); else setTimeout(next, 500); };
        step();
      };
      next();
    },
    offer(text, then) {
      const b = document.createElement('button'); b.className = 'comm-btn'; b.textContent = `“${text}”`;
      b.onclick = () => { reply.replaceChildren(); then(); };
      reply.replaceChildren(b);
    },
    remove() { el.remove(); },
  };
}
