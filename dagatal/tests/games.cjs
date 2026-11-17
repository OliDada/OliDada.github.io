const assert = require('node:assert/strict');
const {scoreWord, stepSnake, freeCell, normalize} = require('../games.js');
assert.equal(normalize('  elska '),'ELSKA');
assert.deepEqual(scoreWord('ALLLL','ELSKA'),['present','correct','absent','absent','absent']);
assert.deepEqual(scoreWord('AAAAA','ELSKA'),['absent','absent','absent','absent','correct']);
assert.deepEqual(scoreWord('ELSKA','ELSKA'),Array(5).fill('correct'));
let body=[{x:1,y:1},{x:0,y:1}];
let result=stepSnake(body,{x:1,y:0},{x:2,y:1},12);
assert.equal(result.ate,true);assert.equal(result.body.length,3);
assert.deepEqual(body,[{x:1,y:1},{x:0,y:1}]);
result=stepSnake(body,{x:0,y:-1},{x:5,y:5},12);
assert.equal(result.body.length,2);assert.equal(result.ate,false);
assert.equal(stepSnake([{x:0,y:0}],{x:-1,y:0},{x:5,y:5},12).body[0].x,11);
const square=[{x:1,y:1},{x:2,y:1},{x:2,y:2},{x:1,y:2}];
assert.equal(stepSnake(square,{x:1,y:0},{x:9,y:9},12).dead,true);
assert.equal(stepSnake(square,{x:0,y:1},{x:9,y:9},12).dead,false);
assert.equal(freeCell([{x:0,y:0}],1),null);
assert.deepEqual(freeCell([{x:0,y:0}],2,()=>0),{x:1,y:0});
console.log('Game rule tests passed.');
// Run the actual Snake UI with a tiny DOM/canvas stand-in and a controllable clock.
const vm=require('node:vm'),fs=require('node:fs');
let clock=null,portraitFood=null,savedWin=null;
const ctx=new Proxy({}, {get:(_,key)=>key==='fillText'?((text,x,y)=>{if(text==='Ó')portraitFood={x:Math.floor(x/40),y:Math.floor(y/40)};}):(()=>{}),set:()=>true});
class Element {
  constructor(tag){this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.events={};this.attrs={};this.textContent='';}
  replaceChildren(...els){this.children=els;}
  append(...els){this.children.push(...els);} addEventListener(k,f){this.events[k]=f;} removeEventListener(k){delete this.events[k];}
  setAttribute(k,v){this.attrs[k]=v;} getContext(){return ctx;} focus(){} click(){this.events.click?.({});}
}
const fakeDocument={createElement:t=>new Element(t),addEventListener(){},removeEventListener(){},hidden:false};
const context={document:fakeDocument,window:{addEventListener(){},removeEventListener(){}},Image:class {},setInterval:f=>(clock=f,1),clearInterval:()=>{clock=null;},Math:Object.create(Math)};
context.Math.random=()=>0;
vm.runInNewContext(fs.readFileSync(require.resolve('../games.js'),'utf8'),context);
const host=new Element('div');const cleanup=context.DagatalGames.snake(host,{markmid:8,haus:'her.jpg',matur:'him.jpg',skilabod:'WIN'}, {},v=>savedWin=v);
const start=host.children.find(e=>e.tag==='button');const board=host.children.find(e=>e.tag==='canvas');
start.click();let model=[{x:4,y:6},{x:3,y:6},{x:2,y:6}],dir={x:1,y:0},eaten=0;
const dirs=[{x:0,y:-1},{x:-1,y:0},{x:0,y:1},{x:1,y:0}];
for(let guard=0;clock&&guard<400;guard++){
  const target={...portraitFood},queue=[{p:model[0],path:[]}],seen=new Set();let path;
  while(queue.length){const item=queue.shift(),key=item.p.x+','+item.p.y;if(seen.has(key))continue;seen.add(key);if(item.p.x===target.x&&item.p.y===target.y){path=item.path;break;}
    dirs.forEach((v,i)=>{if(!item.path.length&&v.x===-dir.x&&v.y===-dir.y)return;const p={x:(item.p.x+v.x+12)%12,y:(item.p.y+v.y+12)%12};if(!model.slice(1).some(b=>b.x===p.x&&b.y===p.y))queue.push({p,path:[...item.path,i]});});
  }
  assert.ok(path?.length,'A path to the next face exists');const i=path[0];dir=dirs[i];board.events.pointerdown({pointerId:1,clientX:100,clientY:100});board.events.pointermove({pointerId:1,clientX:100+dir.x*30,clientY:100+dir.y*30,preventDefault(){}});board.events.pointerup({pointerId:1,type:'pointerup',clientX:100+dir.x*30,clientY:100+dir.y*30,preventDefault(){}});const result=stepSnake(model,dir,target,12);assert.equal(result.dead,false);model=result.body;if(result.ate)eaten++;clock();
}
assert.equal(eaten,8);assert.equal(savedWin.won,true);assert.ok(host.children.some(e=>e.textContent==='WIN'));assert.equal(clock,null);cleanup();assert.equal(clock,null);
console.log('Snake UI: eight points unlock and persist reward; timer stops on victory and cleanup.');

// Live Wordle letters must remain unscored until Enter, with editing and QWERTY order.
const wordHost=new Element('div');let wordSave;
const wordCleanup=context.DagatalGames.wordle(wordHost,{ord:'ELSKA',visbending:'hint',skilabod:'LOVE'}, {},v=>wordSave=v);
const wordGrid=wordHost.children.find(e=>e.className==='word-grid');
const keyboard=wordHost.children.find(e=>e.className==='word-keyboard');
assert.equal(keyboard.children[0].children.map(e=>e.textContent).join(''),'QWERTYUIOPÐ');
function key(key){wordHost.events.keydown({key,target:wordGrid,preventDefault(){}});}
key('e');key('x');assert.equal(wordGrid.children[0].children.map(e=>e.textContent).join(''),'EX');
key('Backspace');assert.equal(wordGrid.children[0].children.map(e=>e.textContent).join(''),'E');
key('Enter');assert.equal(wordSave,undefined);
for(const c of 'lska')key(c);
assert.equal(wordGrid.children[0].children.map(e=>e.textContent).join(''),'ELSKA');
assert.ok(wordGrid.children[0].children.every(e=>!e.className.includes('correct')));
key('Enter');assert.equal(wordSave.guesses[0],'ELSKA');assert.ok(wordHost.children.some(e=>e.textContent==='LOVE'));wordCleanup();assert.equal(wordHost.events.keydown,undefined);
console.log('Live Wordle entry, deletion, validation, QWERTY order and victory passed.');
// The transparent head is mirrored on horizontal turns; vertical turns retain facing.
const scales=[],draws=[];const headCtx=new Proxy({}, {get:(_,key)=>key==='scale'?((x,y)=>scales.push([x,y])):key==='drawImage'?((...args)=>draws.push(args)):(()=>{}),set:()=>true});
context.Image=class {constructor(){this.complete=true;this.naturalWidth=100;this.naturalHeight=160;}};
const originalGet=Element.prototype.getContext;Element.prototype.getContext=()=>headCtx;
const facingHost=new Element('div');const faceCleanup=context.DagatalGames.snake(facingHost,{markmid:8,haus:'her.png',matur:'him.jpg'}, {},()=>{});
facingHost.children.find(e=>e.tag==='button').click();
function turnHead(key){facingHost.events.keydown({key,preventDefault(){}});clock();return scales.at(-1);}
assert.deepEqual(scales.at(-1),[1,1]);assert.deepEqual(turnHead('ArrowUp'),[1,1]);assert.deepEqual(turnHead('ArrowLeft'),[-1,1]);assert.deepEqual(turnHead('ArrowDown'),[-1,1]);assert.deepEqual(turnHead('ArrowRight'),[1,1]);
assert.equal(draws.at(-1).length,5,'Head uses full image, not source crop');faceCleanup();Element.prototype.getContext=originalGet;
console.log('PNG head: full image preserved, horizontal mirroring only, vertical direction retained.');
