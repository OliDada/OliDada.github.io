// Minimal decorative three.js scene (ES module)
// This file lazy-loads three via CDN and renders a slow-moving particle field.
// It attaches to the canvas with id "three-canvas" and exposes window.__threeScene with a stop() method.

const THREE_CDN = 'https://unpkg.com/three@0.158.0/build/three.module.js';
let rafId = null;
let renderer, scene, camera, particles;
let firstFrameLogged = false;
let _paused = false;

async function initThree() {
  console.info('[three-scene] initThree start');
  // If a previous instance exists, try to stop it to ensure a clean state
  try {
    if (window.__threeScene && typeof window.__threeScene.stop === 'function') {
      console.info('[three-scene] previous instance detected, stopping it before init');
      window.__threeScene.stop();
    }
  } catch (e) {
    console.warn('[three-scene] error while stopping previous instance', e);
  }
  const THREE = await import(THREE_CDN);
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  // ensure DOM canvas element itself is transparent (avoid white default background)
  try { canvas.style.background = 'transparent'; } catch (e) {}

  // Diagnostic info: log canvas sizing and computed styles to help debug WebGL failures
  let explicitGL = null;
  try {
    const cs = window.getComputedStyle(canvas);
    console.info('[three-scene] canvas computed styles: display=%s, visibility=%s, width=%s, height=%s', cs.display, cs.visibility, cs.width, cs.height);
    console.info('[three-scene] canvas client size: clientWidth=%d, clientHeight=%d, offsetWidth=%d, offsetHeight=%d', canvas.clientWidth, canvas.clientHeight, canvas.offsetWidth, canvas.offsetHeight);

    // Some browsers refuse to create a GL context for hidden canvases. Make the canvas visible (but keep it invisible to the user) while probing.
    const prevVisibility = canvas.style.visibility;
    const prevOpacity = canvas.style.opacity;
    try {
      canvas.style.visibility = 'visible';
      canvas.style.opacity = '0';
    } catch (e) {}

    // try explicit context creation with a few options
    try {
      const opts = { antialias: true, alpha: true };
      explicitGL = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    } catch (e) {
      explicitGL = null;
    }
    console.info('[three-scene] probe WebGL context present?', !!explicitGL, explicitGL && explicitGL.constructor && explicitGL.constructor.name);

    // restore inline visibility/opactiy for now; we'll set proper styles after renderer created
    try {
      canvas.style.visibility = prevVisibility;
      canvas.style.opacity = prevOpacity;
    } catch (e) {}
  } catch (e) {
    console.warn('[three-scene] failed to log canvas diagnostics', e);
  }

  try {
    // If we managed to create a raw GL context, hand it to three.js so it reuses that context.
    if (explicitGL) {
      renderer = new THREE.WebGLRenderer({ canvas, context: explicitGL, antialias: true, alpha: true });
    } else {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    }
  } catch (e) {
    console.error('[three-scene] WebGLRenderer construction failed. canvas size/client info:', {
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      offsetWidth: canvas.offsetWidth,
      offsetHeight: canvas.offsetHeight,
      display: (window.getComputedStyle && window.getComputedStyle(canvas).display) || canvas.style.display,
      visibility: (window.getComputedStyle && window.getComputedStyle(canvas).visibility) || canvas.style.visibility
    }, e);
    throw e;
  }
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  // Ensure we don't call setSize with zero dimensions which can prevent context creation in some environments
  const w = canvas.clientWidth || canvas.offsetWidth || window.innerWidth;
  const h = canvas.clientHeight || canvas.offsetHeight || window.innerHeight;
  renderer.setSize(w || window.innerWidth, h || window.innerHeight, false);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 80;

  // Keep the three.js clear color in sync with the page background color when possible.
  // If the page uses a background-image we keep the canvas transparent so the image shows through.
  let bgObserver = null;
  function rgbStringToHex(str) {
    // expected formats: 'rgb(r, g, b)' or 'rgba(r, g, b, a)'
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return 0x000000;
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    return (r << 16) + (g << 8) + b;
  }
  function parseHexColorString(s) {
    // s expected like '#rrggbb' or '#rgb'
    if (!s || typeof s !== 'string') return null;
    s = s.trim();
    if (!s.startsWith('#')) return null;
    if (s.length === 4) {
      s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }
    const r = parseInt(s.substr(1,2), 16);
    const g = parseInt(s.substr(3,2), 16);
    const b = parseInt(s.substr(5,2), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return (r << 16) + (g << 8) + b;
  }

  function updateRendererBackground() {
    try {
      // Prefer the CSS custom property --page-bg set on :root/documentElement by script.js
      const rootStyle = window.getComputedStyle(document.documentElement);
      let pageBg = rootStyle.getPropertyValue('--page-bg') || '';
      pageBg = pageBg.trim();

      // If the custom property is empty, fall back to computed body background
      if (!pageBg) {
        const comp = window.getComputedStyle(document.body || document.documentElement);
        const bgImage = comp.backgroundImage || '';
        const bgColor = comp.backgroundColor || 'rgb(0,0,0)';
        if (bgImage && bgImage !== 'none' && bgImage !== 'initial') {
          if (renderer) renderer.setClearColor(0x000000, 0);
          if (scene) scene.background = null;
          return;
        }
        const hex = rgbStringToHex(bgColor);
        if (renderer) renderer.setClearColor(hex, 1);
        try { if (scene) scene.background = new THREE.Color(hex); } catch (e) { /* ignore */ }
        return;
      }

      // pageBg might be a url(...) (image) or a color like '#aabbcc' or 'rgb(...)'
      const lower = pageBg.toLowerCase();
      if (lower.startsWith('url(')) {
        // image -> keep renderer transparent so page image shows through
        if (renderer) renderer.setClearColor(0x000000, 0);
        if (scene) scene.background = null;
        return;
      }

      // Try hex color
      let hexInt = parseHexColorString(pageBg.replace(/"|'/g, ''));
      if (hexInt !== null) {
        if (renderer) renderer.setClearColor(hexInt, 1);
        try { if (scene) scene.background = new THREE.Color(hexInt); } catch (e) {}
        return;
      }

      // Try rgb string
      const rgbMatch = pageBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1],10), g = parseInt(rgbMatch[2],10), b = parseInt(rgbMatch[3],10);
        const intCol = (r << 16) + (g << 8) + b;
        if (renderer) renderer.setClearColor(intCol, 1);
        try { if (scene) scene.background = new THREE.Color(intCol); } catch (e) {}
        return;
      }

      // fallback: transparent
      if (renderer) renderer.setClearColor(0x000000, 0);
      if (scene) scene.background = null;
    } catch (e) {
      // ignore failures
    }
  }
  // initial sync
  // run an initial sync and another sync a tick later to ensure styles applied
  updateRendererBackground();
  setTimeout(() => {
    try { updateRendererBackground(); } catch (e) {}
  }, 50);
  // observe body style/class changes to update background dynamically
  try {
    bgObserver = new MutationObserver(() => updateRendererBackground());
    // Observe both documentElement and body since script writes --page-bg to documentElement.style
    if (document.documentElement) bgObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    if (document.body) bgObserver.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    // also listen for storage events (background change saved to localStorage)
    window.addEventListener('storage', updateRendererBackground);
  } catch (e) {
    bgObserver = null;
  }

  // particles
  const count = 800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 400;
    positions[i + 1] = (Math.random() - 0.5) * 200;
    positions[i + 2] = (Math.random() - 0.5) * 200;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({ size: 2.6, color: 0xffb347, transparent: true, opacity: 0.9 });
  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  window.addEventListener('resize', onWindowResize);

  let t = 0;
  function animate() {
    if (_paused) return; // do not continue animating while paused
    t += 0.002;
    particles.rotation.y = t * 0.6;
    particles.rotation.x = Math.sin(t * 0.4) * 0.2;
    renderer.render(scene, camera);
    if (!firstFrameLogged) {
      console.info('[three-scene] first render complete');
      firstFrameLogged = true;
    }
    rafId = requestAnimationFrame(animate);
  }
  animate();

  // expose stop
  window.__threeScene = {
    stop: () => {
      // fully stop and dispose everything
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      _paused = false;
      try {
        if (particles) {
          if (particles.geometry) particles.geometry.dispose();
          if (particles.material) particles.material.dispose();
          scene.remove(particles);
          particles = null;
        }
        if (renderer) {
          try {
            // If three.js exposes a context, try to lose it explicitly
            if (renderer.getContext && renderer.getContext().loseContext) {
              try { renderer.getContext().loseContext(); } catch (e) {}
            }
          } catch (e) {}
          renderer.forceContextLoss && renderer.forceContextLoss();
          renderer.dispose();
          renderer = null;
        }
        if (scene) {
          // dispose children
          scene = null;
        }
        // disconnect observer and listeners
        try {
          if (bgObserver) { bgObserver.disconnect(); bgObserver = null; }
          window.removeEventListener('storage', updateRendererBackground);
        } catch (e) {}
      } catch (e) {
        console.warn('Error while stopping three scene', e);
      }
      window.removeEventListener('resize', onWindowResize);
      // reset first-frame flag so future inits will log again
      firstFrameLogged = false;
      // restore transparent canvas background to avoid leaving an opaque fill
      try { const c = document.getElementById('three-canvas'); if (c) c.style.background = 'transparent'; } catch (e) {}
    }
  };

  // add pause/resume helpers so host can toggle without disposing the GL context
  try {
    const prev = window.__threeScene;
    window.__threeScene = Object.assign({}, prev, {
      pause: function() {
        try {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = null;
          _paused = true;
          console.info('[three-scene] paused');
        } catch (e) {}
      },
      resume: function() {
        try {
          if (!_paused) return;
          _paused = false;
          // restart the animation loop
          if (!rafId) {
            rafId = requestAnimationFrame(animate);
            console.info('[three-scene] resumed');
          }
        } catch (e) {}
      }
    });
  } catch (e) {}

  function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
}

// Named export so host page can initialize on demand (useful when toggling)
export { initThree };
export default { initThree };
