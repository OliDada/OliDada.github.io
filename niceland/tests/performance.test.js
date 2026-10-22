// Night-time frame rate in the city centre: prints the median and 95th-percentile frame time in ms.
// Run with tests/run.sh, or: URL=http://localhost:8766/index.html node tests/performance.test.js
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8766/index.html';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PE ' + e.message));
  await p.goto(URL);
  await p.waitForFunction(() => document.querySelector('#loading').hidden, { timeout: 180000 });
  await p.evaluate(() => {
    __go(64.144, -21.9345, 5);
    __smv().setHour(22);
  });
  await p.waitForTimeout(5000);
  await p.screenshot({
    path: require('path').join(__dirname, 'out/nt.png'),
    clip: { x: 200, y: 150, width: 800, height: 500 }
  });
  await p.evaluate(() => {
    __go(64.144, -21.9345, 1.2);
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
          if (a.length < 60) requestAnimationFrame(f);
          else {
            a.sort((x, y) => x - y);
            r([a[30] | 0, a[57] | 0]);
          }
        };
        requestAnimationFrame(f);
      })
  );
  console.log('frame med/p95', ft, JSON.stringify(errs));
  await b.close();
})();
