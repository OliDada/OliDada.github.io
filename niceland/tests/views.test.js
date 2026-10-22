// Visits fixed places, saves a screenshot of each in tests/out/view-*.png, and fails when something is clearly broken:
// a page error, a town sitting high above the sea (the 300 m height grid leaking mountains into towns), a hole in
// the ground where a chunk did not draw (canvas pixels left at the flat ocean-background colour over land), or sea
// where there should be land.
// Run with tests/run.sh, or: URL=http://localhost:8766/index.html node tests/views.test.js
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8766/index.html';

// [name, lat, lon, zoom, all land in view?]
const VIEWS = [
  ['hallgrimskirkja', 64.142, -21.9266, 1.35, true],
  ['oskjuhlid', 64.129, -21.919, 0.9, true],
  ['isafjordur', 66.0745, -23.126, 1.35, false],
  ['seydisfjordur', 65.256, -14.01, 0.6, false],
  ['selfoss', 63.9331, -20.9971, 0.4, true],
  ['landeyjar-inland', 63.62, -20.1, 0.12, true],
  ['landeyjar-far', 63.66, -20.1, 0.035, true],
  ['landeyjahofn', 63.53, -20.12, 0.35, false]
];
// ground height (m) the game may give a place near the sea at most
const LOW = [
  ['Ísafjörður, Silfurtorg', 66.0745, -23.126, 10],
  ['Ísafjarðarkirkja', 66.0727, -23.1236, 10],
  ['Ólafsfjörður', 66.073, -18.651, 30],
  ['Seyðisfjarðarkirkja', 65.2597, -14.0064, 10],
  ['Akureyri, Hof', 65.6827, -18.0882, 10]
];
// places that must be land (both were sea once: coastline blocks the world build filled the wrong way, see
// tools/world/fix_coast_blocks.py)
const LAND = [
  ['Landeyjar, west of Landeyjahöfn', 63.6, -20.33],
  ['Ölfus, west of Selfoss', 63.92, -21.2]
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [],
    fails = [];
  p.on('pageerror', e => errs.push('PE ' + e.message + ' ' + (e.stack || '').slice(0, 400)));
  await p.goto(URL);
  await p.waitForFunction(() => document.querySelector('#loading').hidden, { timeout: 180000 });
  await p.evaluate(() => {
    document.querySelector('[data-s="0"]').click(); // pause, so the views are the same each run
    __smv().setHour(13);
  });
  for (const [name, la, lo, k, land] of VIEWS) {
    await p.evaluate(([la, lo, k]) => __go(la, lo, k), [la, lo, k]);
    await p.waitForTimeout(7000);
    await p.screenshot({ path: 'tests/out/view-' + name + '.png' });
    if (land) {
      const hole = await p.evaluate(() =>
        __ev(`(() => {
          const c = document.getElementById('cv'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
          const s = C_([24, 56, 90], 1), m = s.match(/\\d+/g).map(Number);
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] === m[0] && d[i + 1] === m[1] && d[i + 2] === m[2]) n++;
          return n / (d.length / 4);
        })()`)
      );
      console.log(name, 'background showing', (hole * 100).toFixed(2) + '%');
      if (hole > 0.01) fails.push(name + ': ' + (hole * 100).toFixed(1) + '% of the view is bare background');
    } else console.log(name, 'ok');
  }
  const hs = await p.evaluate(
    L => L.map(([n, la, lo]) => [n, __ev(`(()=>{const q=ll(${la},${lo});return hAt(q[0],q[1]);})()`)]),
    LOW
  );
  for (let i = 0; i < LOW.length; i++) {
    const [n, , , max] = LOW[i],
      h = hs[i][1];
    console.log(n, 'ground', h.toFixed(1), 'm');
    if (!(h <= max)) fails.push(n + ': ground at ' + h.toFixed(0) + ' m (expected under ' + max + ')');
  }
  for (const [n, la, lo] of LAND) {
    const cl = await p.evaluate(
      ([la, lo]) =>
        __ev(
          `(()=>{const q=ll(${la},${lo});return clsFast(Math.floor((q[0]-C.OX)/10),Math.floor((q[1]-C.OY)/10));})()`
        ),
      [la, lo]
    );
    console.log(n, cl === 0 ? 'land' : 'class ' + cl);
    if (cl !== 0) fails.push(n + ': not land (class ' + cl + ')');
  }
  if (errs.length) fails.push(...errs);
  await b.close();
  if (fails.length) {
    console.log('FAIL\n' + fails.join('\n'));
    process.exit(1);
  }
  console.log('all views ok');
})();
