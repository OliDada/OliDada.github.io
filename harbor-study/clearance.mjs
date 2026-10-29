import {route,isFork} from './motion.mjs';
// Keep scenery's full animated bounds outside the pier, including corner landings.
export function clearOfPier(x,z,radius=0) {
  const corridors=[...route];
  route.forEach((s,index)=>{if(isFork(index))for(const turn of [-1,1])corridors.push({x:s.x+s.dx*s.length,z:s.z+s.dz*s.length,dx:-s.dz*turn,dz:s.dx*turn,length:40});});
  for(let pass=0;pass<12;pass++)for(const s of corridors){
    const t=Math.max(0,Math.min(s.length,(x-s.x)*s.dx+(z-s.z)*s.dz));
    const cx=s.x+s.dx*t,cz=s.z+s.dz*t;
    let dx=x-cx,dz=z-cz;const distance=Math.hypot(dx,dz),required=2.4+radius;
    if(distance<required){if(distance<.001){dx=-s.dz;dz=s.dx;}else{dx/=distance;dz/=distance;}x=cx+dx*required;z=cz+dz*required;}
  }
  return {x,z};
}

export function protectWalkingLane(x,z,y,segments) {
  for(const s of segments){
    const t=Math.max(0,Math.min(s.length,(x-s.x)*s.dx+(z-s.z)*s.dz));
    if(Math.hypot(x-s.x-s.dx*t,z-s.z-s.dz*t)<1.17)return Math.min(y,-.35);
  }
  return y;
}

// A railing belongs to the perimeter of the joined boardwalk, never across a junction.
export function railIsClear(index,from,to,side){
  const s=route[index];
  if(isFork(index) && to>s.length-2.5)return false;
  for(let t=from;t<=to+.001;t+=Math.min(.25,Math.max(.01,to-from))){
    const x=s.x+s.dx*t-s.dz*side*1.95,z=s.z+s.dz*t+s.dx*side*1.95;
    for(let i=Math.max(0,index-1);i<=Math.min(route.length-1,index+1);i++){
      if(i===index)continue;const other=route[i];
      const u=Math.max(0,Math.min(other.length,(x-other.x)*other.dx+(z-other.z)*other.dz));
      if(Math.hypot(x-other.x-other.dx*u,z-other.z-other.dz*u)<2.35)return false;
    }
  }
  return true;
}
