// Bakes the hand-built valley (heights, forest, roads, water, names) into bake.json, the starting point genworld.py lays the
// new regions around. Only needed again if the hand-built core changes. Run from the repository root with a local server on 8765:
//   python3 -m http.server 8765 --bind 127.0.0.1 &   (in another terminal)
//   node valley/tools/bake.cjs bake.json && python3 valley/tools/genworld.py bake.json valley/world.js
// Note: this overwrites anything painted in the editor. Needs playwright (npm i playwright).
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
  await p.route('**/world.js*',r=>r.fulfill({body:'',contentType:'application/javascript'}));   // bake from the hand-written shapes alone
  await p.goto('http://127.0.0.1:8765/valley/',{waitUntil:'load'});await p.waitForFunction(()=>window.__valley,null,{timeout:180000});
  fs.writeFileSync(process.argv[2]||'bake.json',JSON.stringify(await p.evaluate(()=>window.__valley.bake())));await b.close();})();
