// Name, Save/Load, share codes (including old Smáey codes), the zoom snapshot and the phone menu.
// Run with tests/run.sh, or: URL=http://localhost:8766/index.html node tests/ui.test.js
// Smoke test of the UI: loads the page, checks the name, saves and loads, makes a share code and opens it, and takes screenshots.
const { chromium, devices } = require('playwright');
const URL = process.env.URL || 'http://localhost:8766/index.html';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PE ' + e.message));
  await p.goto(URL);
  await p.waitForFunction(() => document.querySelector('#loading').hidden, { timeout: 180000 });
  console.log(
    'title',
    await p.title(),
    '| brand',
    await p.evaluate(() => document.querySelector('.brand').textContent.slice(0, 8))
  );
  await p.evaluate(() => {
    __smv().setHour(13);
    __go(64.1417, -21.9266, 1.35);
  });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: require('path').join(__dirname, 'out/shot-desktop.png') });
  await p.evaluate(() => document.querySelector('#bSave').click());
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#bLoad').click());
  await p.waitForTimeout(500);
  const code = await p.evaluate(() => __ev(`encodeSnap(saveSnapshot())`));
  console.log('share code', code.slice(0, 12), code.length);
  const ok = await p.evaluate(c => __ev(`decodeSnap(${JSON.stringify(c)}).then(d=>!!d)`), code);
  console.log('decodes', ok);
  const old = await p.evaluate(
    c => __ev(`decodeSnap(${JSON.stringify(c.replace('NICE1.', 'SMAEY1.'))}).then(d=>!!d)`),
    code
  );
  console.log('old Smáey codes still open', old);
  // zoom out and in quickly: the screen snapshot keeps the picture while new chunks are drawn
  await p.mouse.move(600, 400);
  for (let i = 0; i < 4; i++) {
    await p.mouse.wheel(0, 400);
    await p.waitForTimeout(120);
  }
  console.log('snapshot used while zooming', await p.evaluate(() => __ev('snapValid')));
  const m = await b.newPage({ ...devices['iPhone 13'] });
  m.on('pageerror', e => errs.push('PE(phone) ' + e.message));
  await m.goto(URL);
  await m.waitForFunction(() => document.querySelector('#loading').hidden, { timeout: 180000 });
  await m.waitForTimeout(2500);
  await m.tap('#bMenu');
  await m.waitForTimeout(500);
  await m.screenshot({ path: require('path').join(__dirname, 'out/shot-phone-menu.png') });
  console.log(errs.length ? errs : 'no page errors');
  await b.close();
})();
