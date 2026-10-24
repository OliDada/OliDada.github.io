// touchpad.js — on-screen touch controls for keyboard games.
// Turns a joystick and buttons into the same keyboard events the game already listens to,
// so games work on phones without changing their own code.
//
//   TouchPad.create({
//     target: () => document.querySelector('canvas'),   // where the game listens for keys (default: window)
//     stick: true,                                       // joystick that presses the arrow keys
//     buttons: [{ label: 'A', keys: [' '], big: true }], // round action buttons, bottom right
//     menu:    [{ label: 'Map', keys: ['m'] }],          // small buttons along the top
//   });
//
// Only shows on touch screens (add ?touch=1 to the URL to force it on a computer).
(function () {
    'use strict';
    const CODES = {
        ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
        ' ': 'Space', Enter: 'Enter', Shift: 'ShiftLeft', Escape: 'Escape', '+': 'Equal', '-': 'Minus'
    };
    const KEYCODES = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32, Enter: 13, Shift: 16, Escape: 27 };
    const codeFor = (k) => CODES[k] || (k.length === 1 && /[a-z]/i.test(k) ? 'Key' + k.toUpperCase() : (k.length === 1 && /\d/.test(k) ? 'Digit' + k : k));

    function isTouch() {
        if (/[?&]touch=1/.test(location.search)) return true;
        return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
    }

    function create(opts) {
        opts = opts || {};
        if (!isTouch()) return null;
        const getTarget = () => (typeof opts.target === 'function' ? opts.target() : opts.target) || window;
        const down = new Map(); // key -> number of sources holding it

        function send(type, key) {
            const t = getTarget();
            const ev = new KeyboardEvent(type, { key, code: codeFor(key), keyCode: KEYCODES[key] || key.toUpperCase().charCodeAt(0), which: KEYCODES[key] || key.toUpperCase().charCodeAt(0), bubbles: true, cancelable: true });
            t.dispatchEvent(ev);
        }
        function press(key) {
            const n = down.get(key) || 0;
            down.set(key, n + 1);
            if (n === 0) send('keydown', key);
        }
        function release(key) {
            const n = down.get(key) || 0;
            if (n <= 1) { down.delete(key); if (n === 1) send('keyup', key); }
            else down.set(key, n - 1);
        }

        const css = document.createElement('style');
        css.textContent = `
        .tp { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; font-family: system-ui, sans-serif; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
        .tp * { box-sizing: border-box; }
        .tp-stick { position: absolute; left: max(18px, env(safe-area-inset-left)); bottom: max(18px, env(safe-area-inset-bottom)); width: 132px; height: 132px; border-radius: 50%;
            background: rgba(255,255,255,.12); border: 2px solid rgba(255,255,255,.35); pointer-events: auto; touch-action: none; }
        .tp-knob { position: absolute; left: 50%; top: 50%; width: 58px; height: 58px; margin: -29px 0 0 -29px; border-radius: 50%;
            background: rgba(255,255,255,.55); border: 2px solid rgba(255,255,255,.8); transition: transform .06s linear; }
        .tp-btns { position: absolute; right: max(18px, env(safe-area-inset-right)); bottom: max(18px, env(safe-area-inset-bottom)); display: flex; flex-direction: row-reverse; align-items: flex-end; gap: 14px; pointer-events: none; }
        .tp-col { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .tp-btn { pointer-events: auto; touch-action: none; width: 60px; height: 60px; border-radius: 50%; border: 2px solid rgba(255,255,255,.8);
            background: rgba(255,255,255,.22); color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.05; padding: 4px;
            text-shadow: 0 1px 2px rgba(0,0,0,.6); }
        .tp-btn.big { width: 76px; height: 76px; font-size: 18px; }
        .tp-btn.on { background: rgba(255,255,255,.55); transform: scale(.94); }
        .tp-menu { position: absolute; top: max(10px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 8px; pointer-events: none; }
        .tp-menu .tp-btn { width: auto; height: 36px; border-radius: 999px; padding: 0 14px; font-size: 13px; }
        .tp-hide { position: absolute; bottom: max(10px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); pointer-events: auto; width: 36px; height: 36px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,.6); background: rgba(0,0,0,.25); color: #fff; font-size: 16px; }
        .tp.off > :not(.tp-hide) { display: none; }
        `;
        document.head.appendChild(css);

        const root = document.createElement('div');
        root.className = 'tp';
        document.body.appendChild(root);

        // A held button: press on touch, release on lift / cancel / sliding off it
        function holdButton(el, keys) {
            let id = null;
            el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (id !== null) return;
                id = e.pointerId;
                try { el.setPointerCapture(id); } catch (_) {}
                el.classList.add('on');
                keys.forEach(press);
                if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
            });
            const up = (e) => {
                if (e.pointerId !== id) return;
                id = null;
                el.classList.remove('on');
                keys.forEach(release);
            };
            el.addEventListener('pointerup', up);
            el.addEventListener('pointercancel', up);
            el.addEventListener('lostpointercapture', up);
            el.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        function makeBtn(b, cls) {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'tp-btn' + (b.big ? ' big' : '') + (cls ? ' ' + cls : '');
            el.textContent = b.label;
            el.setAttribute('aria-label', b.name || b.label);
            holdButton(el, b.keys);
            return el;
        }

        // Joystick: 8 directions mapped to the arrow keys
        if (opts.stick !== false) {
            const stick = document.createElement('div');
            stick.className = 'tp-stick';
            const knob = document.createElement('div');
            knob.className = 'tp-knob';
            stick.appendChild(knob);
            root.appendChild(stick);
            const dirKeys = opts.stickKeys || { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
            let held = new Set(), pid = null;
            function set(dx, dy) {
                const r = 66, len = Math.hypot(dx, dy), k = len > r ? r / len : 1;
                knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
                const nx = dx / r, ny = dy / r, want = new Set();
                if (len > 14) {
                    if (nx < -0.38) want.add(dirKeys.left);
                    if (nx > 0.38) want.add(dirKeys.right);
                    if (ny < -0.38) want.add(dirKeys.up);
                    if (ny > 0.38) want.add(dirKeys.down);
                }
                held.forEach(key => { if (!want.has(key)) release(key); });
                want.forEach(key => { if (!held.has(key)) press(key); });
                held = want;
            }
            function from(e) {
                const r = stick.getBoundingClientRect();
                set(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
            }
            stick.addEventListener('pointerdown', (e) => { e.preventDefault(); pid = e.pointerId; try { stick.setPointerCapture(pid); } catch (_) {} from(e); });
            stick.addEventListener('pointermove', (e) => { if (e.pointerId === pid) from(e); });
            const end = (e) => { if (e.pointerId !== pid) return; pid = null; set(0, 0); };
            stick.addEventListener('pointerup', end);
            stick.addEventListener('pointercancel', end);
            stick.addEventListener('lostpointercapture', end);
        }

        if (opts.buttons && opts.buttons.length) {
            const wrap = document.createElement('div');
            wrap.className = 'tp-btns';
            // first two buttons sit side by side at the bottom, the rest stack above the second
            const [first, ...rest] = opts.buttons;
            wrap.appendChild(makeBtn(first));
            if (rest.length) {
                const col = document.createElement('div');
                col.className = 'tp-col';
                rest.slice().reverse().forEach(b => col.appendChild(makeBtn(b)));
                wrap.appendChild(col);
            }
            root.appendChild(wrap);
        }
        if (opts.menu && opts.menu.length) {
            const m = document.createElement('div');
            m.className = 'tp-menu';
            opts.menu.forEach(b => m.appendChild(makeBtn(b)));
            root.appendChild(m);
        }

        // little toggle to hide the controls (e.g. if someone plugs in a keyboard)
        const hide = document.createElement('button');
        hide.type = 'button';
        hide.className = 'tp-hide';
        hide.setAttribute('aria-label', 'Hide touch controls');
        hide.textContent = '◐';
        hide.addEventListener('click', () => root.classList.toggle('off'));
        root.appendChild(hide);

        // let go of everything if the page loses focus mid-press
        window.addEventListener('blur', () => { [...down.keys()].forEach(k => { down.set(k, 1); release(k); }); });
        // stop the page from scrolling / zooming while playing
        document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || root.contains(e.target)) e.preventDefault(); }, { passive: false });
        document.addEventListener('dblclick', (e) => e.preventDefault());

        return { root, press, release };
    }

    window.TouchPad = { create, isTouch };
})();
