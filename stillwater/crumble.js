import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { dreamUniforms, CRUMBLES, CRUMBLE_RATE, dreamBendGLSL } from "./dream.js";

// The pixels a crumbling house sheds. Each particle belongs to one crumble
// zone, sits on the house's walls or roof, and lets go when the crumbling front
// reaches its height. It then pours away from the walk like spray off the quay,
// hits the water, and kicks up a short splash before sinking.
export function createCrumble(scene, pixelScale) {
    const COUNT = 30000;
    const seeds = new Float32Array(COUNT * 4), zone = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        for (let k = 0; k < 4; k++) seeds[i * 4 + k] = Math.random();
        zone[i] = i % CRUMBLES;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));
    geometry.setAttribute("zone", new THREE.BufferAttribute(zone, 1));
    const uniforms = { ...dreamUniforms, pixelScale };
    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
      uniform float pixelScale;
      uniform vec4 crumbleRect[${CRUMBLES}];uniform vec4 crumbleParam[${CRUMBLES}];uniform vec4 crumbleAway[${CRUMBLES}];
      attribute vec4 seed;attribute float zone;
      ${dreamBendGLSL}
      varying float bright;
      void kill(){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;}
      void main(){
        vec4 r=crumbleRect[int(zone)],c=crumbleParam[int(zone)];vec2 away=crumbleAway[int(zone)].xy;
        if(r.z<=0.||dreamTime<c.x){kill();return;}
        // A point on the outer shell of the house: walls mostly, some roof.
        float h=c.z-c.y;
        vec3 p;
        float face=floor(seed.x*5.);
        float u=seed.y*2.-1.,v=seed.z;
        if(face<1.)p=vec3(r.x+r.z,c.y+v*h,r.y+u*r.w);
        else if(face<2.)p=vec3(r.x-r.z,c.y+v*h,r.y+u*r.w);
        else if(face<3.)p=vec3(r.x+u*r.z,c.y+v*h,r.y+r.w);
        else if(face<4.)p=vec3(r.x+u*r.z,c.y+v*h,r.y-r.w);
        else p=vec3(r.x+u*r.z,c.z-v*.4,r.y+(seed.w*2.-1.)*r.w);
        // It lets go when the crumbling front reaches it (same timing as the discard).
        float release=c.x+(c.z-p.y)/${CRUMBLE_RATE.toFixed(2)}-seed.w*.6;
        float t=dreamTime-release;
        if(t<0.||t>4.){kill();return;}
        // Pour away from the walk and down, tumbling outward like a breaking crest.
        float j=fract(seed.x*91.7+seed.z*13.1);
        vec3 vel=vec3(away.x,0.,away.y)*(1.2+j*2.6)+vec3((seed.y-.5)*1.6,.6+seed.w*2.2,(seed.z-.5)*1.6);
        vec3 q=p+vel*t;q.y-=4.9*t*t;
        float water=-1.2;
        bright=.55+j*.4-t*.12;
        if(q.y<water){
          // Splash: a short burst back up from the surface, then gone.
          float tw=(vel.y+sqrt(max(vel.y*vel.y+9.8*(p.y-water),0.)))/9.8;
          float s=t-tw;
          if(s>.7){kill();return;}
          vec3 at=p+vel*tw;at.y=water;
          q=at+vec3(vel.x*.25,(1.4+j*2.)*s-4.9*s*s,vel.z*.25)*vec3(1.,1.,1.);
          q.xz+=vec2(seed.y-.5,seed.w-.5)*s*1.4;
          q.y=max(q.y,water);
          bright=.85-s;
        }
        vec4 mv=viewMatrix*vec4(dreamBend(q),1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(floor(.22*pixelScale/-mv.z+.5+j*.7),1.,4.);
      }`,
        fragmentShader: `varying float bright;void main(){gl_FragColor=vec4(vec3(bright),1.);}`,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    return points;
}
