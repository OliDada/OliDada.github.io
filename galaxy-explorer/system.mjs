// Deterministic system generation. Distances are deliberately compressed for play.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}
const biomes = [
  {type:'Volcanic',palette:['#302a36','#594047','#955945','#d08b59'],atmosphere:'#ef8b55',rock:'#49333c',crystal:'#ffb35d',relief:1.6,description:'Basalt ridges and embers beneath a copper sky.',note:'The basalt is threaded with a mineral that stores heat long after sunset.',title:'A memory of fire',message:'The pulse travels through the rock itself. Something beneath the crust is answering.'},
  {type:'Desert',palette:['#93664f','#bb8660','#d2a777','#edd2a1'],atmosphere:'#edca9b',rock:'#94694d',crystal:'#efd9a2',relief:.85,description:'Wind-carved stone on a quiet amber world.',note:'The standing stones are polished on one side. The prevailing wind has not changed for centuries.',title:'Written in the dunes',message:'Under the sand, a repeating arrangement of stone points toward another world.'},
  {type:'Verdant',palette:['#536961','#7b8d77','#a1aa84','#b3af8d'],atmosphere:'#72c5bd',rock:'#65716b',crystal:'#a4d0b0',relief:1,description:'Pale mineral meadows under a turquoise haze.',note:'The stones are warm. There is no power source, but the pulse responds to your presence.',title:'It was waiting',message:'One transmission. Repeated for a very long time. “You are not the first.”'},
  {type:'Frozen',palette:['#506c8c','#83a8bd','#b7d7dc','#e0edf0'],atmosphere:'#9dcfff',rock:'#718da8',crystal:'#b6efff',relief:1.35,description:'Blue ice, sharp ridges, and long shadows.',note:'Bubbles trapped in the crystal contain a gas absent from the atmosphere.',title:'Before the ice',message:'The signal is older than the glacier. A brief image shows this world covered in water.'},
  {type:'Amethyst',palette:['#49435c','#756183','#a28aab','#cebbce'],atmosphere:'#b3a0ef',rock:'#685475',crystal:'#dec0ff',relief:1.1,description:'Violet highlands beneath a broad ring of dust.',note:'Every crystal resonates at the same frequency, even on opposite sides of the site.',title:'The quiet chorus',message:'Seven separate notes form a single chord. The source is somewhere beyond this system.'}
];
const normalize=v=>{const d=Math.hypot(...v);return v.map(x=>x/d);};
export function generateSystem(input=1408) {
  const seed = Number(input) >>> 0;
  const rand=seededRandom(seed);
  const names=['Cinder','Saffron','Vesper','Nacre','Orison'];
  const bodies=[];
  for(let i=0;i<5;i++){
    const biome=biomes[i];
    const orbit=2300+i*1800+rand()*260;
    const angle=rand()*Math.PI*2;
    const radius=Math.round(145+rand()*90+(i===4?55:0));
    const signal=normalize([(rand()-.5)*.5,1,(rand()-.5)*.5]);
    bodies.push({...biome,id:`planet-${i}`,name:names[i]+(seed===1408?'':` ${String(seed%97+1)}`),seed:Math.floor(rand()*4294967296),radius,orbit,angle,position:[Math.cos(angle)*orbit,(rand()-.5)*140,Math.sin(angle)*orbit],signal,ringed:i===4,parent:null,landmarkCount:3+Math.floor(rand()*3)});
  }
  for(const [i,parentIndex] of [2,4].entries()){
    const parent=bodies[parentIndex],orbit=parent.radius+430+i*60,angle=rand()*Math.PI*2;
    const biome=biomes[i===0?3:0];
    bodies.push({...biome,id:`moon-${i}`,name:i===0?'Lilt':'Morrow',type:`${biome.type} moon`,seed:Math.floor(rand()*4294967296),radius:75+Math.floor(rand()*35),orbit,angle,position:[parent.position[0]+Math.cos(angle)*orbit,parent.position[1]+110,parent.position[2]+Math.sin(angle)*orbit],signal:normalize([.1,1,(rand()-.5)*.3]),ringed:false,parent:parent.id,landmarkCount:3});
  }
  return {seed,name:['Aster','Eos','Halcyon','Solis'][seed%4],star:{name:'Helion',radius:430,color:'#ffd49b'},bodies,startId:'planet-2'};
}
export function terrainHeight(body,n){
  const phase=(body.seed%10000)/1500;
  const raw=(3.8*Math.sin(n.x*17+phase)*Math.cos(n.z*19-.7)+2.8*Math.sin(n.y*21+n.z*9+phase)+1.4*Math.cos(n.x*43+n.z*31)+5*Math.pow(Math.max(0,Math.sin(n.x*8-n.z*7+n.y*3+phase)),3))*body.relief;
  const d=Math.hypot(n.x-body.signal[0],n.y-body.signal[1],n.z-body.signal[2]);
  const t=Math.max(0,Math.min(1,(d-.22)/.2));
  return 1.2+(raw-1.2)*t*t*(3-2*t);
}
export function distance(a,b){return Math.hypot(...a.map((v,i)=>v-b[i]));}
export function cruisePoint(start,departure,end,t){
  const ease=x=>x*x*(3-2*x);
  if(t<.22){const u=ease(Math.max(0,t/.22));return start.map((v,i)=>v+(departure[i]-v)*u);}
  const u=ease(Math.min(1,(t-.22)/.78));
  // Travel above the orbital plane, avoiding the star and intervening planets.
  const control=[(departure[0]+end[0])/2,Math.max(departure[1],end[1])+3600,(departure[2]+end[2])/2];
  return departure.map((v,i)=>(1-u)*(1-u)*v+2*(1-u)*u*control[i]+u*u*end[i]);
}
