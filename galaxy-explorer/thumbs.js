// Pictures of recorded things for the codex overview (codex-ui.js): each plant, animal,
// rock and landform drawn with its own model (the same builders the worlds use), lit
// and framed in a small offscreen renderer, and turned into an image. Worlds, sky events
// and radio sources are painted instead. Pictures are made one at a time, when they are
// first needed, and kept for the session.
//
//   const thumbs = createThumbs(THREE);
//   thumbs.get(key, make) -> Promise<dataURL>   make(api) returns an Object3D or a canvas
//   api: { model(object), paint(draw(ctx, size)) }
const SIZE = 192;

export function createThumbs(THREE) {
  let renderer = null, scene = null, camera = null;
  const cache = new Map(), queue = [];
  let busy = false;
  function setup() {
    if (renderer) return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe4f2ee, 0x2b2532, 1.7));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.4); sun.position.set(3, 5, 4); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9fd8ff, .9); rim.position.set(-4, 2, -3); scene.add(rim);
    camera = new THREE.PerspectiveCamera(28, 1, .01, 5000);
  }
  // Frame an object by its bounds, from a little above and to one side.
  function shoot(object) {
    setup();
    scene.add(object);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const r = Math.max(.2, s.length() / 2), d = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
    camera.position.set(c.x + d * .62, c.y + d * .32, c.z + d * .72);
    camera.near = d / 50; camera.far = d * 4; camera.updateProjectionMatrix();
    camera.lookAt(c);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(object);
    object.traverse((o) => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.()); });
    return url;
  }
  function paint(draw) {
    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    draw(c.getContext('2d'), SIZE);
    return c.toDataURL('image/png');
  }
  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    const { key, make, resolve } = queue.shift();
    setTimeout(() => {
      let url = null;
      try { url = make({ model: shoot, paint }); } catch (e) { console.warn('thumb', key, e); }
      cache.set(key, Promise.resolve(url));
      resolve(url);
      busy = false;
      pump();
    }, 0);
  }
  return {
    get(key, make, { first = false } = {}) {
      if (cache.has(key)) return cache.get(key);
      const p = new Promise((resolve) => (first ? queue.unshift : queue.push).call(queue, { key, make, resolve }));
      cache.set(key, p);
      pump();
      return p;
    },
    // Forget queued pictures nobody is waiting for (the codex was closed).
    clearQueue() { for (const q of queue) cache.delete(q.key); queue.length = 0; },
  };
}
