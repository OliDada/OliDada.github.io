import * as THREE from "three";
// Simplex noise implementation (https://github.com/jwagner/simplex-noise.js)
// Lightweight inline version for terrain
export class SimplexNoise {
  constructor() {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    this.p = [];
    for (let i=0; i<256; i++) this.p[i] = Math.floor(Math.random()*256);
    this.perm = [];
    for(let i=0; i<512; i++) this.perm[i]=this.p[i & 255];
  }
  dot(g, x, y) { return g[0]*x + g[1]*y; }
  noise(xin, yin) {
    const F2 = 0.5*(Math.sqrt(3.0)-1.0);
    const G2 = (3.0-Math.sqrt(3.0))/6.0;
    let n0, n1, n2;
    let s = (xin+yin)*F2;
    let i = Math.floor(xin+s);
    let j = Math.floor(yin+s);
    let t = (i+j)*G2;
    let X0 = i-t;
    let Y0 = j-t;
    let x0 = xin-X0;
    let y0 = yin-Y0;
    let i1, j1;
    if(x0>y0){i1=1;j1=0;}else{i1=0;j1=1;}
    let x1 = x0 - i1 + G2;
    let y1 = y0 - j1 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2;
    let y2 = y0 - 1.0 + 2.0 * G2;
    let ii = i & 255;
    let jj = j & 255;
    let gi0 = this.perm[ii+this.perm[jj]] % 12;
    let gi1 = this.perm[ii+i1+this.perm[jj+j1]] % 12;
    let gi2 = this.perm[ii+1+this.perm[jj+1]] % 12;
    let t0 = 0.5 - x0*x0 - y0*y0;
    if(t0<0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0);
    }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if(t1<0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
    }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if(t2<0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
    }
    return 70.0 * (n0 + n1 + n2);
  }
}

export function createPlanetSurfaceScene(planetName, sharedSimplex) {
  const scene = new THREE.Scene();
  let skyDome = null;
  if (planetName === 'Earth') {
    // Large ground plane for walking
    const groundGeometry = new THREE.PlaneGeometry(50000, 50000, 300, 300); // add segments for noise
    // Use shared simplex noise for terrain
    const simplex = sharedSimplex;

    for (let i = 0; i < groundGeometry.attributes.position.count; i++) {
      const x = groundGeometry.attributes.position.getX(i);
      const y = groundGeometry.attributes.position.getY(i);
      // Layered noise for mountains and hills
      let elevation = 0;
      elevation += simplex.noise(x * 0.0002, y * 0.0002) * 400; // mountains
      elevation += simplex.noise(x * 0.001, y * 0.001) * 60;    // hills
      elevation += simplex.noise(x * 0.005, y * 0.005) * 10;    // small bumps
      groundGeometry.attributes.position.setZ(i, elevation);
    }
    groundGeometry.computeVertexNormals();
    const groundTexture = new THREE.TextureLoader().load('./textures/rocky_terrain_02_diff_8k.jpg');
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(40, 40);
    groundTexture.anisotropy = 16;
    const waterTexture = new THREE.TextureLoader().load('./textures/beautiful-photo-sea-waves.jpg');
    waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
    waterTexture.repeat.set(10, 10);
    waterTexture.anisotropy = 16;
    // Use standard material for ground
    const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create water mesh that fills in low-elevation areas
    const waterGeometry = groundGeometry.clone();
    const waterLevel = 20.0;
    // Store ground heights for shader
    const groundHeights = [];
    for (let i = 0; i < waterGeometry.attributes.position.count; i++) {
      const z = groundGeometry.attributes.position.getZ(i);
      groundHeights.push(z);
      // Set water mesh Z to waterLevel everywhere
      waterGeometry.attributes.position.setZ(i, waterLevel);
    }
    waterGeometry.computeVertexNormals();
    // Add ground height as attribute for shader
    waterGeometry.setAttribute('groundHeight', new THREE.Float32BufferAttribute(groundHeights, 1));
    // Use ShaderMaterial for smooth fade and basic reflection
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        waterMap: { value: waterTexture },
        waterLevel: { value: waterLevel },
        fadeRange: { value: 20.0 },
        reflectColor: { value: new THREE.Color(0x99ccff) },
        reflectivity: { value: 0.5 }
      },
      vertexShader: `
        attribute float groundHeight;
        varying float vGroundHeight;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vGroundHeight = groundHeight;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D waterMap;
        uniform float waterLevel;
        uniform float fadeRange;
        uniform vec3 reflectColor;
        uniform float reflectivity;
        varying float vGroundHeight;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(waterMap, vUv * 10.0);
          float fade = smoothstep(waterLevel, waterLevel - fadeRange, vGroundHeight);
          color.a *= fade * 0.85;
          // Simple fake reflection: blend with reflectColor
          color.rgb = mix(color.rgb, reflectColor, reflectivity * fade);
          gl_FragColor = color;
        }
      `,
      transparent: true,
      depthWrite: false
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0;
    water.receiveShadow = true;
    scene.add(water);
  // Expose water mesh so callers can adjust material/behavior during transitions
  scene.userData.water = water;

    // Animate subtle waves in the water mesh
    // Skip animating waves while the camera is performing the float-down to the surface
    scene.userData.animateWater = function (time) {
      // Pause waves if either the global float-down flag or an explicit scene-level pause is set
      if ((typeof window !== 'undefined' && window._isFloatingDownToSurface) || scene.userData._wavesPaused) {
        // Keep water stable during camera float-down to avoid visual glitches
        return;
      }
      const positions = water.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const origX = positions.getX(i);
        const origY = positions.getY(i);
        // Larger, more dynamic waves
        const wave = Math.sin(origX * 0.001 + time * 0.7) * 8.0 + Math.cos(origY * 0.001 + time * 0.4) * 6.0;
        positions.setZ(i, waterLevel + wave);
      }
      positions.needsUpdate = true;
      water.geometry.computeVertexNormals();
    };

    // Add ambient and directional light
    const ambient = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(2000, 4000, 1000);
    scene.add(sunLight);

     // Add sky dome with custom texture
    const skyGeometry = new THREE.SphereGeometry(50000, 32, 32);
    const skyTexture = new THREE.TextureLoader().load('textures/sunflowers_puresky_4k.jpg');
    const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide });
    skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    skyDome.name = 'skyDome';
    scene.add(skyDome);
    scene.userData.skyDome = skyDome; // Expose for animation

  } else {
    // Default surface scene for other planets
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4444aa });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

   
  }

  return scene;
}

// Check if camera is facing the sky (for Earth). If so, add a button to go back to orbit view.
export function checkCameraSkyDome(camera, scene, landingBtn, onLandingClick) {
  const skyDome = scene.userData.skyDome;
  if (!skyDome || !landingBtn) return;

  // Vector from camera to sky dome center
  const toSky = new THREE.Vector3().subVectors(skyDome.position, camera.position).normalize();
  // Camera forward vector
  const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  // Angle between camera direction and vector to sky dome center
  const angle = cameraDir.angleTo(toSky);
  // If angle is small (looking towards sky dome), show button
  if (angle < Math.PI / 4) {
    landingBtn.style.display = 'block';
    landingBtn.onclick = onLandingClick;
  } else {
    landingBtn.style.display = 'none';
    landingBtn.onclick = null;
  }
}
