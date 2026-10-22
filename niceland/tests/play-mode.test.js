// Plays as a person: hops in and out of cars, rams other cars and people, and fails on any page error.
// Run with tests/run.sh, or: URL=http://localhost:8766/index.html node tests/play-mode.test.js
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8766/index.html';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PE ' + e.message + ' ' + (e.stack || '').slice(0, 700)));
  await p.goto(URL);
  await p.waitForFunction(() => document.querySelector('#loading').hidden, { timeout: 180000 });
  await p.evaluate(() => {
    __go(64.145, -21.92, 3);
  });
  await p.waitForTimeout(1500);
  await p.click('#bPlayer');
  await p.waitForTimeout(500);
  for (let round = 0; round < 25 && errs.length === 0; round++) {
    const m = await p.evaluate(() => __ev("CTRL?CTRL.mode:'none'"));
    if (m === 'walk') {
      await p.evaluate(() =>
        __ev(
          "(()=>{const a=CTRL.a;let best=null,bd=1e9;for(const c of agents){if(c.dead||!c.car||c.kind==='truck'||c.kind==='bus'||c.burnt)continue;const d=Math.hypot(c.x-a.x,c.y-a.y);if(d<bd){bd=d;best=c;}}if(best){a.x=best.x+2;a.y=best.y+2;}})()"
        )
      );
      await p.keyboard.press('f');
    } else if (m === 'car') {
      await p.evaluate(
        r =>
          __ev(
            '(()=>{const a=CTRL.a;let best=null,bd=1e9;for(const o of agents){if(o===a||o.dead||o.ctrl||o.hidden)continue;if(' +
              (r % 3 === 0 ? 'o.car' : '!o.car') +
              '){const d=Math.hypot(o.x-a.x,o.y-a.y);if(d<bd){bd=d;best=o;}}}if(!best)return;const ux=best.car?(best.vx||1):(a.x-best.x),uy=best.car?(best.vy||0):(a.y-best.y),ul=Math.hypot(ux,uy)||1;a.x=best.x-ux/ul*8;a.y=best.y-uy/ul*8;a.ldx=ux/ul;a.ldy=uy/ul;CTRL.sp=22;})()'
          ),
        round
      );
      await p.keyboard.down('d');
      await p.waitForTimeout(300);
      await p.keyboard.up('d');
    }
    await p.waitForTimeout(1200);
    console.log(
      round,
      await p.evaluate(() =>
        __ev(
          "[CTRL&&CTRL.mode,HEAT.toFixed(1),COPS.length,agents.filter(a=>a.wreck).length,agents.filter(a=>a.down>0).length,CTRL&&CTRL.a&&(CTRL.a.dmg|0)].join(' ')"
        )
      )
    );
  }
  await p.evaluate(() => __ev("CTRL&&CTRL.mode==='car'&&(CTRL.sp=0)"));
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(2500);
    console.log(
      'w',
      await p.evaluate(() => __ev("[stars(),COPS.length,CTRL&&CTRL.mode,BUSTT.toFixed(1)].join(' ')"))
    );
  }
  await p.screenshot({ path: require('path').join(__dirname, 'out/chaos.png') });
  console.log(JSON.stringify(errs));
  await b.close();
})();
