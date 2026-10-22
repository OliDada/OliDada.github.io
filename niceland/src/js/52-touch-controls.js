/**
 * Touch controls
 *
 * On phones and tablets, playing as someone shows a joystick on the left and buttons on the right instead of
 * needing a keyboard. They feed the same keys the keyboard does (plus an analogue stick for walking), so walking,
 * driving and flying work exactly as on a computer.
 *
 * Functions: padSync, padButtons, tipK
 * State and constants: TOUCH, PAD
 */

const TOUCH = { jx: 0, jy: 0, on: false };
const PAD = (() => {
  const coarse = matchMedia('(pointer: coarse)');
  const el = document.createElement('div');
  el.id = 'pad';
  el.hidden = true;
  el.innerHTML =
    '<div id="joy" aria-label="Joystick: move or steer"><i></i></div>' +
    '<div id="padb"></div>' +
    '<button class="btn" id="padx" aria-label="Stop playing">✕</button>';
  document.body.appendChild(el);
  const joy = el.querySelector('#joy'),
    knob = joy.querySelector('i'),
    bx = el.querySelector('#padb');
  // the joystick: drag anywhere inside the ring, the knob follows and snaps back on release
  let jid = null;
  const setDir = (jx, jy) => {
    TOUCH.jx = jx;
    TOUCH.jy = jy;
    knob.style.transform = 'translate(' + jx * 42 + 'px,' + jy * 42 + 'px)';
    // driving and flying read the arrow keys, so the stick presses them too
    const tog = (k, on) => (on ? keys.add(k) : keys.delete(k));
    tog('arrowup', jy < -0.35);
    tog('arrowdown', jy > 0.35);
    tog('arrowleft', jx < -0.35);
    tog('arrowright', jx > 0.35);
  };
  const move = e => {
    const r = joy.getBoundingClientRect(),
      dx = e.clientX - (r.left + r.width / 2),
      dy = e.clientY - (r.top + r.height / 2),
      L = Math.hypot(dx, dy),
      m = Math.min(1, L / 42) / (L || 1);
    setDir(dx * m, dy * m);
  };
  joy.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    jid = e.pointerId;
    joy.setPointerCapture(jid);
    move(e);
  });
  joy.addEventListener('pointermove', e => {
    if (e.pointerId === jid) move(e);
  });
  const up = e => {
    if (e.pointerId !== jid) return;
    jid = null;
    setDir(0, 0);
  };
  joy.addEventListener('pointerup', up);
  joy.addEventListener('pointercancel', up);
  el.querySelector('#padx').addEventListener('click', e => {
    e.stopPropagation();
    stopPlay();
    padSync();
  });
  // hold buttons press a key while held; tap buttons send one key press
  bx.addEventListener('pointerdown', e => {
    const b = e.target.closest('button');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.hold) {
      keys.add(b.dataset.hold);
      b.classList.add('on');
      b.setPointerCapture(e.pointerId);
    } else if (b.dataset.tap) {
      playKey(b.dataset.tap);
      setTimeout(padSync, 0);
    }
  });
  const rel = e => {
    const b = e.target.closest('button');
    if (b && b.dataset.hold) {
      keys.delete(b.dataset.hold);
      b.classList.remove('on');
    }
  };
  bx.addEventListener('pointerup', rel);
  bx.addEventListener('pointercancel', rel);
  el.addEventListener('contextmenu', e => e.preventDefault());
  return { el, bx, coarse, mode: null, setDir };
})();
function padButtons(mode) {
  const B = (lab, a) => '<button class="btn" ' + a + '>' + lab + '</button>';
  if (mode === 'walk') return B('Run', 'data-hold="shift"') + B('Get in', 'data-tap="f"');
  if (mode === 'car') return B('Get out', 'data-tap="f"');
  if (mode === 'plane') return B('Climb', 'data-hold=" "') + B('Descend', 'data-hold="x"') + B('Get out', 'data-tap="f"');
  return '';
}
function padSync() {
  const show = !!CTRL && PAD.coarse.matches;
  if (show !== TOUCH.on) {
    TOUCH.on = show;
    PAD.el.hidden = !show;
    document.body.classList.toggle('padon', show);
    if (!show) {
      PAD.setDir(0, 0);
      ['shift', ' ', 'x'].forEach(k => keys.delete(k));
    }
  }
  const mode = show ? CTRL.mode : null;
  if (mode !== PAD.mode) {
    PAD.mode = mode;
    ['shift', ' ', 'x'].forEach(k => keys.delete(k));
    PAD.bx.innerHTML = padButtons(mode);
  }
}
// playing can start or end from many places (the Play button, an inspector card, getting caught), so just keep up
setInterval(padSync, 200);
// the keyboard hint on a computer, the touch hint on a phone
function tipK(kb, touch) {
  return matchMedia('(pointer: coarse)').matches ? touch : kb;
}
