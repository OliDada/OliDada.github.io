const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../valley/people-core.js');
const npc=(id,role='villager',x=0)=>({personId:id,origin:[x,0],role,anim:'person',name:role,home:[x,0],x,z:0,y:0,type:'wander',radius:5,speed:1});
const p=C.identity(npc('one'));
assert.deepEqual(C.identity(npc('one')),p,'identity stable across loads');
assert.notDeepEqual(C.identity(npc('two')).traits,p.traits);
const store={},s=C.state(store,p.id);C.remember(s,{id:'crime',kind:'assault',impact:-40});C.remember(s,{id:'crime',impact:-40});assert.equal(s.trust,-40,'no duplicate penalty');
for(let i=0;i<50;i++)C.remember(s,{id:'e'+i,impact:-10});assert.equal(s.memories.length,12);assert.equal(s.trust,-100);
const bold={...p,traits:{...p.traits,courage:.9,temper:.9,loyalty:.9}};
const shy={...p,traits:{...p.traits,courage:.1,temper:.1}};
assert.equal(C.response(bold,s,{violent:true,kin:true}),'defend');assert.equal(C.response(shy,s,{violent:true}),'flee');
assert.equal(C.response({...bold,job:'child'},s,{violent:true}),'flee');
assert.equal(C.response(shy,s,{violent:true,law:true}),'report');
function simulation(saved){let state=saved||{inv:{bread:2},hot:{},coins:5};const folks=[npc('a','farmer'),npc('b','villager',2),npc('c','guard',4),npc('far','villager',1000)];
 const home={x:0,z:0,bed:[0,0],door:[0,0],doorIn:[0,0],seats:[],occ:2};folks[0].homeF=home;folks[1].homeF=home;
 const G={sheathed:true,state:()=>state,tick(){},socialAccess:{save(){},count:k=>state.inv[k]||0,hot:k=>state.hot[k]||0,take(k,n){state.inv[k]-=n;},go(n,x,z){n.drive=true;n.goal=[x,z];},halt(n){n.drive=false;}}};
 const V={GAME:G,NPCS:folks,FLOORS:[],DN:{tod:.5},started:true,inCourt:()=>false,floorH:()=>-1e9,TOWN_C:[100,100]};
 vm.runInNewContext(fs.readFileSync(require.resolve('../valley/people.js'),'utf8'),{window:{__valley:V,ValleyPeopleCore:C}});G.tick(.1,0);return {G,V,folks,state};}
const a=simulation(),[farmer,relative,guard,outsider]=a.folks;
assert.equal(new Set(a.folks.map(n=>n.name)).size,4);
assert.ok(a.G.social.related(farmer,relative));
a.G.social.crime([farmer],{victim:relative,violent:true});
assert.equal(a.G.social.memory(farmer).trust,-40);assert.equal(a.G.social.memory(relative).trust,-40);assert.equal(a.G.social.memory(outsider).trust,0,'distant people do not magically know');
a.G.social.meet(farmer);assert.equal(farmer.conversing,true);assert.match(a.G.social.panel(farmer),/I saw what you did/);a.G.social.end();assert.equal(farmer.conversing,false);
const prior=a.G.social.memory(farmer).trust;a.G.social.topic(farmer,'apology');const improved=a.G.social.memory(farmer).trust;assert.ok(improved>prior);a.G.social.topic(farmer,'apology');assert.equal(a.G.social.memory(farmer).trust,improved,'apology cannot be farmed');
a.G.social.topic(guard,'gift');assert.equal(a.state.inv.bread,1);a.G.social.topic(guard,'gift');assert.equal(a.state.inv.bread,1,'one gift per day');
a.G.social.trade(guard);const trust=a.G.social.memory(guard).trust;a.G.social.trade(guard);assert.equal(a.G.social.memory(guard).trust,trust,'trade cannot be farmed');
const b=simulation(JSON.parse(JSON.stringify(a.state)));assert.deepEqual(b.folks.map(n=>n.name),a.folks.map(n=>n.name));assert.equal(b.G.social.memory(b.folks[0]).trust,improved,'memory survives reload');
// A threatened person never abandons the incident to run a social errand.
b.folks[0].avenge={};b.folks[0].x=20;b.G.tick(3,3);assert.equal(b.folks[0].drive,undefined);
assert.match(b.G.social.panel(b.folks[0]),/data-topic="family"/);
console.log('Valley people: stable identities, kinship, individual reactions, bounded memory, private knowledge, dialogue, gifts, apology, trade, persistence and danger priority passed.');
// Information must travel through a nearby actual relationship, one hop only.
const gossip=simulation(),[witness,kin,listener,farAway]=gossip.folks;
witness.person.traits.sociability=1;witness.person.friends=[{id:listener.person.id,kind:'friend'}];listener.person.traits.sociability=1;listener.person.friends=[{id:farAway.person.id,kind:'friend'}];
gossip.G.social.crime([witness],{violent:false});gossip.G.tick(3,3);
assert.equal(gossip.G.social.memory(listener).memories[0].heard,true);assert.equal(gossip.G.social.memory(listener).memories[0].source,witness.person.id);
farAway.x=listener.x;witness.x=500;kin.x=500;gossip.G.tick(3,6);assert.equal(gossip.G.social.memory(farAway).memories.length,0,'hearsay does not spread endlessly');
const hurt={trust:-40,memories:[]};C.recover(p,hurt,0);C.recover(p,hurt,2);assert.ok(hurt.trust>-40&&hurt.trust<0,'time softens distrust without instantly erasing it');
const nightGuard={...p,job:'watchkeeper',traits:{...p.traits,diligence:1}};assert.equal(C.phase(nightGuard,.1),'day','night watch works at night');
console.log('Nearby gossip, one-hop provenance, gradual recovery and night watch passed.');
// Contextual options, trust boundaries, and concrete promises are persistent state.
const deep=simulation(),speaker=deep.folks[0];deep.G.social.meet(speaker);
assert.match(deep.G.social.panel(speaker),/data-dialog-key="1"/);
assert.match(deep.G.social.panel(speaker),/What do you do here/);
deep.G.social.topic(speaker,'work');assert.match(deep.G.social.panel(speaker),/How did you get into this work/);
deep.G.social.topic(speaker,'background');assert.equal(deep.G.social.memory(speaker).dialogue.lastTopic,'background');
speaker.person.traits.warmth=.1;deep.G.social.memory(speaker).trust=0;deep.G.social.topic(speaker,'private');assert.equal(deep.G.social.memory(speaker).dialogue.heard.includes('private'),false,'reserved NPC withholds private details');
deep.G.social.topic(speaker,'promise');assert.equal(deep.G.social.memory(speaker).dialogue.promise.status,'open');
deep.G.social.topic(speaker,'gift');assert.equal(deep.G.social.memory(speaker).dialogue.promise.status,'kept');assert.equal(deep.state.inv.bread,1);
const afterPromise=deep.G.social.memory(speaker).trust;deep.G.social.topic(speaker,'gift');assert.equal(deep.G.social.memory(speaker).trust,afterPromise,'kept promise cannot be rewarded twice');
const reloaded=simulation(JSON.parse(JSON.stringify(deep.state)));assert.equal(reloaded.G.social.memory(reloaded.folks[0]).dialogue.promise.status,'kept');
const late=simulation(),waiting=late.folks[0];late.G.social.topic(waiting,'promise');late.state.social.time+=2;const beforeLate=late.G.social.memory(waiting).trust;late.G.social.meet(waiting);assert.equal(late.G.social.memory(waiting).trust,beforeLate-2);late.G.social.meet(waiting);assert.equal(late.G.social.memory(waiting).trust,beforeLate-2,'overdue promise penalized only once');late.G.social.topic(waiting,'release');assert.equal(late.G.social.memory(waiting).dialogue.promise.status,'released');
deep.V.coarse=true;assert.doesNotMatch(deep.G.social.panel(speaker),/data-dialog-key/,'touch UI omits keyboard labels');
console.log('Dialogue branches, keyboard labels, disclosure boundaries, promise fulfillment, overdue promises, withdrawal and persistence passed.');
const trusted=simulation(),trustedNPC=trusted.folks[0];trusted.G.social.memory(trustedNPC).trust=50;trusted.G.social.meet(trustedNPC);assert.equal(trusted.G.social.memory(trustedNPC).trust,50,'daily greeting cannot reduce an established relationship');

// A delivery follows road points to the gate, waits, then returns; it is not restarted that day.
const errands=simulation(),worker=errands.folks[0];errands.V.V=[0,0];errands.V.roads={castle:[[0,0],[0,-10],[0,-20]]};errands.V.DN.tod=.325;
errands.G.socialAccess.go=(n,x,z,stop,done)=>{n.drive=true;n.goal=[x,z];n.onArrive=done;};
errands.G.tick(3,1);assert(worker.errand);assert.match(worker.activity,/delivering/);
for(let i=0;i<15&&worker.errand;i++){if(worker.drive){worker.x=worker.goal[0];worker.z=worker.goal[1];worker.onArrive(worker);}errands.state.social.time+=.01;errands.G.tick(3,i+2);}
assert.equal(worker.errand,null);assert.equal(worker.z,0);assert.equal(worker.deliveryDay,1);
const greetings=simulation();greetings.V.P={x:0,z:4};let calls=0;greetings.folks[0].person.traits.sociability=1;greetings.G.socialAccess.ambient=()=>{calls++;return true;};greetings.G.tick(11,11);assert.equal(calls,1);greetings.G.tick(3,14);assert.equal(calls,1,'greetings have a global cooldown');
console.log('Castle round trip and passing greeting cooldown passed.');
