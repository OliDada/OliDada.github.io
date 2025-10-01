import * as THREE from "three";

export function createLighting(sunObject = null) {
  const lights = [];
  
  // Ambient light (makes unlit areas clearly visible)
  const ambientLight = new THREE.AmbientLight(0x404040, 0.3); // General ambient light
  lights.push(ambientLight);
  
  // Hemisphere light (additional ambient lighting)
  const hemiLight = new THREE.HemisphereLight(0x404040, 0x202020, 0.2);
  lights.push(hemiLight);
  
  // Main sun light (directional light simulating the sun)
  const sunLight = new THREE.DirectionalLight(0xffffff,3);
  
  if (sunObject && sunObject.mesh) {
    // Position the light at the sun's location
    const sunPosition = new THREE.Vector3();
    sunObject.mesh.getWorldPosition(sunPosition);
    sunLight.position.copy(sunPosition);
    
    // Make the light look toward the center (Earth)
    sunLight.target.position.set(0, 0, 0);
  } else {
    // Fallback position if no sun object provided
    sunLight.position.set(0, 0, 0);
  }
  
  // Add shadow properties for more realism
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 500;
  sunLight.shadow.camera.far = 1500;
  sunLight.shadow.camera.left = -1000;
  sunLight.shadow.camera.right = 1000;
  sunLight.shadow.camera.top = 1000;
  sunLight.shadow.camera.bottom = -1000;
  
  lights.push(sunLight);
  
  // Optional: Add a point light at sun position for close-up illumination
  if (sunObject && sunObject.mesh) {
    const sunPointLight = new THREE.PointLight(0xffaa44, 1, 2000);
    const sunPosition = new THREE.Vector3();
    sunObject.mesh.getWorldPosition(sunPosition);
    sunPointLight.position.copy(sunPosition);
    lights.push(sunPointLight);
  }
  
  // Return lights and update function
  const updateLighting = () => {
    if (sunObject && sunObject.mesh) {
      const sunPosition = new THREE.Vector3();
      sunObject.mesh.getWorldPosition(sunPosition);
      
      // Update directional light position
      sunLight.position.copy(sunPosition);
      
      // Update point light position if it exists
      if (lights.length > 2) {
        lights[2].position.copy(sunPosition);
      }
    }
  };
  
  return {
    lights,
    update: updateLighting
  };
}