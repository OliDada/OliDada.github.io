// Damages the city (a bomb and a troll), presses Reset, and checks how long it takes and the next frame times.
// Run with tests/run.sh, or: URL=http://localhost:8766/index.html node tests/reset.test.js
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8766/index.html';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PE ' + e.message + ' ' + e.stack.slice(0, 400)));
  await p.goto(URL);
  await p.waitForFunction(() => document.querySelector('#loading').hidden, { timeout: 180000 });
  await p.evaluate(() => {
    __go(64.1437, -21.925, 1.35);
  });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    const S = __smv();
    S.apply(-1700, -2400, 'bomb');
    S.apply(-1500, -2300, 'troll');
  });
  await p.waitForTimeout(3000);
  const t = await p.evaluate(() => {
    const t0 = performance.now();
    document.querySelector('#bReset').click();
    return performance.now() - t0;
  });
  await p.waitForTimeout(3000);
  const ft = await p.evaluate(
    () =>
      new Promise(r => {
        const a = [];
        let l = performance.now();
        const f = () => {
          const n = performance.now();
          a.push(n - l);
          l = n;
          if (a.length < 40) requestAnimationFrame(f);
          else r(Math.max(...a.slice(1)) | 0);
        };
        requestAnimationFrame(f);
      })
  );
  console.log('reset ms', t | 0, 'max frame after', ft);
  console.log(JSON.stringify(errs));
  await b.close();
})();
