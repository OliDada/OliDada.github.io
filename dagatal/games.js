/* Small standalone game rules; the UI is mounted only while its calendar door is open. */
(function (root) {
  'use strict';
  const normalize = s => s.normalize('NFC').trim().toUpperCase();
  function scoreWord(guess, answer) {
    const result = Array(answer.length).fill('absent'), remaining = {};
    [...answer].forEach((c, i) => { if (guess[i] === c) result[i] = 'correct'; else remaining[c] = (remaining[c] || 0) + 1; });
    [...guess].forEach((c, i) => { if (result[i] !== 'correct' && remaining[c]) { result[i] = 'present'; remaining[c]--; } });
    return result;
  }
  function stepSnake(body, direction, food, size) {
    const head = {x:(body[0].x + direction.x + size) % size, y:(body[0].y + direction.y + size) % size};
    const ate = head.x === food.x && head.y === food.y;
    if ((ate ? body : body.slice(0, -1)).some(p => p.x === head.x && p.y === head.y)) return {body, ate:false, dead:true};
    return {body:[head, ...body.slice(0, ate ? body.length : -1)], ate, dead:false};
  }
  function freeCell(body, size, random = Math.random) {
    const cells=[];
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(!body.some(p=>p.x===x&&p.y===y)) cells.push({x,y});
    return cells.length ? cells[Math.floor(random()*cells.length)] : null;
  }
  const api = {normalize, scoreWord, stepSnake, freeCell};
  if (typeof module !== 'undefined') module.exports = api;
  root.DagatalGames = api;
  if (typeof document === 'undefined') return;
  const make = (tag, cls, text) => {const el=document.createElement(tag); if(cls)el.className=cls; if(text!=null)el.textContent=text; return el;};
  const button = (text, action, cls='takki') => {const b=make('button',cls,text);b.type='button';b.addEventListener('click',action);return b;};
  api.wordle = function(el, config, saved, save) {
    const answer=normalize(config.ord), limit=6;
    let guesses=Array.isArray(saved.guesses)?saved.guesses.filter(g=>typeof g==='string'&&g.length===5).slice(0,6):[], draft='';
    const intro=make('p','','Finndu fimm stafa orðið. Þú færð sex tilraunir.');
    const grid=make('div','word-grid');grid.tabIndex=0;grid.setAttribute('role','group');grid.setAttribute('aria-label','Orðareitir. Sláðu inn stafi og ýttu á Enter.');
    const legend=make('p','dauft','Grænt: réttur staður · Gult: annar staður · Grátt: ekki í orðinu.');
    const message=make('p','game-message');message.setAttribute('role','status');
    const keyboard=make('div','word-keyboard'), keys=new Map(), actions=make('div','rod');
    const hint=button('Vísbending',()=>{message.textContent=config.visbending;},'takki ljos');
    const retry=button('Reyna aftur',()=>{guesses=[];draft='';save({guesses});message.textContent='';render();grid.focus();},'takki ljos');
    function finished(){return guesses.includes(answer)||guesses.length>=limit;}
    function enter(){
      if(finished())return;
      if(draft.length!==5){message.textContent='Orðið þarf að vera fimm stafir.';return;}
      guesses.push(draft);draft='';save({guesses});message.textContent=`Tilraun ${guesses.length} af ${limit}.`;render();
    }
    function type(c){if(finished())return;if(c==='Enter')return enter();if(c==='Backspace')draft=draft.slice(0,-1);else if(draft.length<5&&/^[A-ZÁÐÉÍÓÚÝÞÆÖ]$/.test(c))draft+=c;render();}
    function render(){
      grid.replaceChildren();const rank={absent:1,present:2,correct:3},best={};
      for(let row=0;row<limit;row++){
        const submitted=guesses[row],active=row===guesses.length&&!finished(),word=submitted||(active?draft:''),scores=submitted?scoreWord(word,answer):[];
        const line=make('div','word-row');
        for(let i=0;i<5;i++){
          const tile=make('span','word-tile '+(scores[i]||'')+(active&&i===draft.length?' current':''),word[i]||'');
          if(word[i]){tile.setAttribute('aria-label',word[i]+': '+(scores[i]?{correct:'réttur staður',present:'annar staður',absent:'ekki í orðinu'}[scores[i]]:'óstaðfest'));if(scores[i]&&(!best[word[i]]||rank[scores[i]]>rank[best[word[i]]]))best[word[i]]=scores[i];}
          line.append(tile);
        }grid.append(line);
      }
      keys.forEach((key,c)=>{key.className='word-key '+(best[c]||'')+(c==='Enter'||c==='Backspace'?' word-action':'');key.disabled=finished();});
      hint.disabled=finished();retry.hidden=!finished();
      if(guesses.includes(answer)){message.textContent=config.vann?'':config.skilabod;config.vann?.();}
      else if(finished())message.textContent='Orðið var '+answer+'. Þú mátt alltaf prófa aftur.';
    }
    // QWERTY positions, Icelandic letters and a separate accent row.
    [['Q','W','E','R','T','Y','U','I','O','P','Ð'],['A','S','D','F','G','H','J','K','L','Æ','Ö'],['Enter','Z','X','C','V','B','N','M','Þ','Backspace'],['Á','É','Í','Ó','Ú','Ý']].forEach(row=>{
      const line=make('div','word-key-row');
      row.forEach(c=>{const key=button(c==='Enter'?'↵':c==='Backspace'?'⌫':c,()=>type(c),'word-key');key.setAttribute('aria-label',c==='Enter'?'Giska':c==='Backspace'?'Eyða síðasta staf':c);keys.set(c,key);line.append(key);});keyboard.append(line);
    });
    const keyHandler=e=>{
      if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;
      if(e.key==='Enter'&&e.target.tagName==='BUTTON'&&!e.target.className.includes('word-key'))return;
      const c=e.key==='Enter'||e.key==='Backspace'?e.key:normalize(e.key);
      if(c==='Enter'||c==='Backspace'||/^[A-ZÁÐÉÍÓÚÝÞÆÖ]$/.test(c)){e.preventDefault();type(c);}
    };
    el.addEventListener('keydown',keyHandler);actions.append(hint,retry);el.append(intro,grid,keyboard,message,legend,actions);render();
    return ()=>el.removeEventListener('keydown',keyHandler);
  };
  api.snake = function(el, config, saved, save) {
    const size=12,W=480,U=W/size,SPEED=230,target=config.markmid||8;
    let body,prev,direction,queue,food,foodBorn=0,points,timer=null,running=false,over=false,won=false,disposed=false,facing=1,lastTick=0,shakeUntil=0,frame=0;
    const particles=[];
    const now=()=>(typeof performance!=='undefined'&&performance.now?performance.now():Date.now());
    const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:null;
    const intro=make('p','',`Náðu mér ${target} sinnum til að opna skilaboðin. Strjúktu á leikborðinu til að stýra.`);
    const score=make('p','snake-score');score.setAttribute('role','status');
    const canvas=make('canvas','snake-board');
    const dpr=Math.min(2,Math.max(1,(typeof window!=='undefined'&&window.devicePixelRatio)||1));
    canvas.width=canvas.height=Math.round(W*dpr);canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Snake. Strjúktu upp, niður, til hægri eða vinstri. Örvatakkar virka líka.');
    const ctx=canvas.getContext('2d'), message=make('p','game-message');message.setAttribute('role','status');
    let font='sans-serif';try{font=getComputedStyle(el).fontFamily||font;}catch(_){}
    const portraits=[new Image(),new Image()];portraits.forEach((img,i)=>{img.onload=()=>{if(!disposed)draw();};img.onerror=()=>{if(!disposed)draw();};img.src=i?config.matur:config.haus;});
    const ready=img=>img.complete&&img.naturalWidth;
    // Gradients are optional so the game still draws on minimal canvases.
    function gradient(g,stops){if(!g||!g.addColorStop)return null;stops.forEach(([o,c])=>g.addColorStop(o,c));return g;}
    function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);}
    function heart(x,y,s){ctx.beginPath();ctx.moveTo(x,y+s*.35);ctx.bezierCurveTo(x-s,y-s*.35,x-s*.45,y-s,x,y-s*.45);ctx.bezierCurveTo(x+s*.45,y-s,x+s,y-s*.35,x,y+s*.35);}
    // Snowflakes drift slowly behind the board.
    const flakes=Array.from({length:26},(_,i)=>({x:(i*97)%W,y:(i*53)%W,r:1+(i%3)*.7,v:6+(i%5)*3,w:(i%7)/7*Math.PI*2}));
    // Smooth position of segment i between the previous and current tick.
    function lerpPos(i,t){
      const to=body[i],from=(prev&&(prev[i]||prev[prev.length-1]))||to;
      let dx=to.x-from.x,dy=to.y-from.y;
      if(dx>1)dx-=size;if(dx<-1)dx+=size;if(dy>1)dy-=size;if(dy<-1)dy+=size;
      return {x:(to.x-dx*(1-t)+.5)*U,y:(to.y-dy*(1-t)+.5)*U};
    }
    function drawBoard(time){
      ctx.fillStyle='#123a2f';ctx.fillRect(0,0,W,W);
      ctx.fillStyle='#164437';
      for(let y=0;y<size;y++)for(let x=(y%2);x<size;x+=2)ctx.fillRect(x*U,y*U,U,U);
      const glow=gradient(ctx.createRadialGradient&&ctx.createRadialGradient(W/2,W/2,W*.15,W/2,W/2,W*.75),[[0,'rgba(255,240,200,0.06)'],[1,'rgba(0,0,0,0.35)']]);
      if(glow){ctx.fillStyle=glow;ctx.fillRect(0,0,W,W);}
      ctx.fillStyle='rgba(255,255,255,0.55)';
      flakes.forEach(f=>{const y=(f.y+time/1000*f.v)%W,x=f.x+Math.sin(time/1400+f.w)*6;circle(x,y,f.r);ctx.fill();});
    }
    function drawBody(t){
      const pts=body.map((_,i)=>lerpPos(i,t)),n=pts.length;
      const radius=i=>U*(.4-.11*Math.min(1,i/Math.max(6,n)));
      const linked=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<U*1.5;
      ctx.lineCap='round';
      // Soft shadow, dark outline, then alternating candy-cane colours from tail to neck.
      for(const pass of ['shadow','outline','fill']){
        for(let i=n-1;i>=1;i--){
          const p=pts[i],q=pts[i-1],r=radius(i),dy=pass==='shadow'?4:0;
          ctx.strokeStyle=ctx.fillStyle=pass==='shadow'?'rgba(0,0,0,0.25)':pass==='outline'?'#2a1f24':(i%2?'#fff3d6':'#d23f4c');
          const w=pass==='fill'?r*2:r*2+5;
          circle(p.x,p.y+dy,w/2);ctx.fill();
          if(linked(p,q)){ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(p.x,p.y+dy);ctx.lineTo((p.x+q.x)/2,(p.y+q.y)/2+dy);ctx.stroke();}
        }
      }
      // Glossy highlight along the top of each bead.
      ctx.fillStyle='rgba(255,255,255,0.35)';
      for(let i=1;i<n;i++){const p=pts[i],r=radius(i);circle(p.x-r*.3,p.y-r*.35,r*.28);ctx.fill();}
      return pts[0];
    }
    function drawFood(time){
      if(!food)return;
      const cx=(food.x+.5)*U,cy=(food.y+.5)*U,age=Math.min(1,(time-foodBorn)/260),pop=age<1?Math.sin(age*Math.PI/2)*1.12-.12*age:1;
      const bob=Math.sin(time/320)*2,r=U*.5*pop*(1+Math.sin(time/260)*.03);
      ctx.fillStyle='rgba(0,0,0,0.28)';ctx.beginPath();ctx.ellipse?.(cx,cy+U*.42,r*.75,r*.22,0,0,Math.PI*2);ctx.fill();
      const halo=gradient(ctx.createRadialGradient&&ctx.createRadialGradient(cx,cy+bob,r*.6,cx,cy+bob,r*1.6),[[0,'rgba(255,214,107,0.55)'],[1,'rgba(255,214,107,0)']]);
      if(halo){ctx.fillStyle=halo;circle(cx,cy+bob,r*1.6);ctx.fill();}
      ctx.save();
      if(ready(portraits[1])){
        const img=portraits[1],side=Math.min(img.naturalWidth,img.naturalHeight);
        circle(cx,cy+bob,r);ctx.clip();ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,cx-r,cy+bob-r,r*2,r*2);
      }else{circle(cx,cy+bob,r);ctx.fillStyle='#ffd56b';ctx.fill();ctx.fillStyle='#252738';ctx.font=`bold 19px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Ó',cx,cy);}
      ctx.restore();
      ctx.lineWidth=3;ctx.strokeStyle='#f4c85a';circle(cx,cy+bob,r);ctx.stroke();
      // Two little twinkles orbiting the face.
      ctx.fillStyle='#fff6d8';
      for(let k=0;k<2;k++){const a=time/700+k*Math.PI,s=2.2+Math.sin(time/180+k)*1.2;star(cx+Math.cos(a)*r*1.25,cy+bob+Math.sin(a)*r*1.25,s);}
    }
    function star(x,y,s){ctx.beginPath();ctx.moveTo(x,y-s*2);ctx.quadraticCurveTo(x,y,x+s*2,y);ctx.quadraticCurveTo(x,y,x,y+s*2);ctx.quadraticCurveTo(x,y,x-s*2,y);ctx.quadraticCurveTo(x,y,x,y-s*2);ctx.fill();}
    function drawHead(p){
      ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse?.(p.x,p.y+U*.55,U*.45,U*.14,0,0,Math.PI*2);ctx.fill();
      ctx.save();
      if(ready(portraits[0])){
        // Preserve the full transparent cutout; only mirror horizontally.
        const img=portraits[0],scale=Math.min(U*1.5/img.naturalWidth,U*1.5/img.naturalHeight);
        const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
        ctx.translate(p.x,p.y);if(direction.y)ctx.rotate(direction.y*facing*.12);ctx.scale(facing*(config.hausStefnir==='vinstri'?-1:1),1);
        ctx.drawImage(img,-w/2,-h/2,w,h);
      }else{circle(p.x,p.y,U*.45);ctx.fillStyle='#b6d8ba';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#2a1f24';ctx.stroke();ctx.fillStyle='#252738';ctx.font=`bold 19px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Þ',p.x,p.y);}
      ctx.restore();
    }
    function drawParticles(time){
      for(let i=particles.length-1;i>=0;i--){
        const q=particles[i],age=(time-q.t)/q.life;if(age>=1){particles.splice(i,1);continue;}
        const x=q.x+q.vx*age*60,y=q.y+q.vy*age*60+age*age*q.g;
        ctx.globalAlpha=1-age;ctx.fillStyle=q.c;
        if(q.text){ctx.font=`800 26px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(q.text,x,y);}
        else if(q.heart){heart(x,y,q.s);ctx.fill();}else star(x,y,q.s);
        ctx.globalAlpha=1;
      }
    }
    function burst(x,y,count,time){
      const colors=['#ff6b7d','#ffd56b','#fff6d8','#e8475a'];
      for(let k=0;k<count;k++){const a=Math.PI*2*k/count+Math.random()*.5,sp=.6+Math.random()*1.4;particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-.6,g:40,s:4+Math.random()*5,heart:k%2===0,c:colors[k%colors.length],t:time,life:700+Math.random()*400});}
    }
    function overlay(title,sub,time){
      ctx.fillStyle='rgba(18,30,26,0.62)';ctx.fillRect(0,0,W,W);
      ctx.textAlign='center';ctx.textBaseline='middle';
      const cy=won?W*.3:W*.27;
      if(won){ctx.fillStyle='#e8475a';heart(W/2,cy-60+Math.sin(time/300)*4,46);ctx.fill();}
      ctx.fillStyle='#fff6d8';ctx.font=`800 40px ${font}`;ctx.fillText(title,W/2,cy+20);
      if(sub){ctx.fillStyle='rgba(255,246,216,0.75)';ctx.font=`600 19px ${font}`;ctx.fillText(sub,W/2,cy+62);}
    }
    function draw(){
      if(!body)return;
      const time=now(),t=running?Math.min(1,(time-lastTick)/SPEED):1;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if(time<shakeUntil){const k=(shakeUntil-time)/350*7;ctx.translate((Math.random()-.5)*k,(Math.random()-.5)*k);}
      drawBoard(time);drawFood(time);const head=drawBody(t);
      if(time<shakeUntil){ctx.fillStyle=`rgba(210,63,76,${(shakeUntil-time)/350*.35})`;ctx.fillRect(-10,-10,W+20,W+20);}
      drawHead(head);
      if(!running){
        if(won)overlay('Þú náðir mér!','Ég er allur þinn ♥',time);
        else if(over)overlay('Úps!','',time);
        else if(points>0)overlay('Pása','',time);
        else overlay('Tilbúin?','',time);
      }
      drawParticles(time);
      score.textContent='♥'.repeat(points)+'♡'.repeat(Math.max(0,target-points));score.setAttribute('aria-label',`${points} af ${target} stigum`);
    }
    function loop(){if(disposed)return;frame=raf(loop);if(typeof document==='undefined'||!document.hidden)draw();}
    function stop(){clearInterval(timer);timer=null;running=false;}
    function pause(){if(running){stop();start.textContent='Halda áfram';message.textContent='';draw();}}
    function reset(){stop();body=[{x:4,y:6},{x:3,y:6},{x:2,y:6}];prev=null;direction={x:1,y:0};queue=[];facing=1;food={x:7,y:6};foodBorn=0;points=0;over=false;won=false;particles.length=0;start.textContent='Byrja';message.textContent=saved.won&&!config.vann?config.skilabod:'';if(saved.won)config.vann?.();draw();}
    function tick(){
      const time=now();if(queue.length)direction=queue.shift();if(direction.x)facing=direction.x;
      const result=stepSnake(body,direction,food,size);
      if(result.dead){stop();over=true;shakeUntil=time+350;start.textContent='Reyna aftur';message.textContent='';draw();return;}
      prev=body;body=result.body;lastTick=time;
      if(result.ate){
        points++;const fx=(food.x+.5)*U,fy=(food.y+.5)*U;burst(fx,fy,12,time);particles.push({x:fx,y:fy-10,vx:0,vy:-.5,g:0,text:'+1',c:'#ffd56b',t:time,life:800});
        if(points>=target){stop();over=true;won=true;saved.won=true;save({won:true});start.textContent='Spila aftur';message.textContent=config.vann?'':config.skilabod;config.vann?.();food=null;for(let k=0;k<4;k++)burst(W*(.2+.2*k),W*.3,14,time+k*120);}
        else{food=freeCell(body,size);foodBorn=time;}
      }
      if(!raf)draw();
    }
    function turn(dx,dy){if(!running)return;const last=queue[queue.length-1]||direction;if((dx===last.x&&dy===last.y)||(dx===-last.x&&dy===-last.y)||queue.length>=2)return;queue.push({x:dx,y:dy});}
    const start=button('Byrja',()=>{if(running){pause();return;}if(over)reset();running=true;lastTick=now();start.textContent='Pása';message.textContent='';timer=setInterval(tick,SPEED);canvas.focus({preventScroll:true});});
    let pointer=null;
    const down=e=>{if(!running){if(!won&&e.isPrimary!==false)start.click();return;}if(pointer||e.isPrimary===false)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);};
    const move=e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;e.preventDefault();if(Math.abs(dx)>Math.abs(dy))turn(Math.sign(dx),0);else turn(0,Math.sign(dy));pointer.x=e.clientX;pointer.y=e.clientY;};
    const up=e=>{if(pointer?.id===e.pointerId){if(e.type==='pointerup')move(e);pointer=null;}};
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    const keyHandler=e=>{const dir={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key];if(dir){e.preventDefault();turn(...dir);}else if(e.key===' '&&e.target===canvas){e.preventDefault();start.click();}};
    el.addEventListener('keydown',keyHandler);
    const visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',pause);
    el.append(score,canvas,start,message);reset();
    if(raf)loop();
    return ()=>{disposed=true;stop();if(frame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);el.removeEventListener('keydown',keyHandler);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',pause);};
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
