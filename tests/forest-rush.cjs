const assert = require('node:assert/strict');
(async () => {
  const {createBall,stepBall,groundHeight,RADIUS} = await import('../forest-rush/movement.mjs');
  const advance=(ball,seconds,steer=0,step=1/120)=>{for(let t=0;t<seconds-1e-9;t+=step)stepBall(ball,steer,false,step);};
  let ball=createBall();
  for(let i=0;i<7200;i++){
    stepBall(ball,Math.sin(i*.01),false,1/120);
    assert.ok(Math.abs(ball.y-groundHeight(ball.x,ball.z)-RADIUS)<1e-9,'ground contact follows hills');
    assert.ok(Number.isFinite(ball.y)&&ball.speed>0,'motion remains finite');
  }
  ball=createBall();advance(ball,.1,1);assert.ok(ball.vx>6,'steering reacts within 100ms');
  advance(ball,.1,-1);assert.ok(ball.vx<0,'direction reverses promptly');
  const released=ball.x;advance(ball,.3);assert.ok(Math.abs(ball.x-released)<.3,'release stops drift');
  ball=createBall();stepBall(ball,0,true,1/120);advance(ball,.2);
  assert.ok(ball.y-groundHeight(ball.x,ball.z)-RADIUS>.8,'hop clears ground');
  advance(ball,1);assert.ok(ball.grounded,'hop lands');
  assert.ok(Math.abs(ball.y-groundHeight(ball.x,ball.z)-RADIUS)<1e-9,'landing never sinks through terrain');
  ball=createBall();ball.grounded=false;ball.y+=.03;ball.vy=-2;
  stepBall(ball,0,true,1/120);advance(ball,.1);assert.ok(!ball.grounded&&ball.vy>0,'early hop press buffers across landing');
  const a=createBall(),b=createBall();advance(a,5,.2,1/60);advance(b,5,.2,1/120);
  assert.ok(Math.abs(a.distance-b.distance)<.1,'forward travel stable across frame rates');
  assert.ok(Math.abs(a.x-b.x)<.02,'steering stable across frame rates');
  ball=createBall();advance(ball,15,1);assert.equal(ball.x,8,'scenery remains beyond the playable area');
  console.log('3D movement checks passed: terrain contact, steering, braking, hopping, landing buffer, bounds and frame-rate consistency.');
})().catch(error=>{console.error(error);process.exitCode=1;});
