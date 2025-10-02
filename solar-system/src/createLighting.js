import * as THREE from "three";

export function createLighting(sunObject = null) {
  const lights = [];
  
  
  // Hemisphere light (additional ambient lighting)
  const hemiLight = new THREE.HemisphereLight(0x404040, 0x202020, 2); // Higher hemisphere light
  lights.push(hemiLight);

  // Main sun light (point light with no distance falloff for outer planets)
  const sunLight = new THREE.PointLight(0xffffff, 4, 0, 0); // No distance limit (0 = infinite range)
  
  if (sunObject && sunObject.mesh) {
    // Position the light at the sun's location
    const sunPosition = new THREE.Vector3();
    sunObject.mesh.getWorldPosition(sunPosition);
    sunLight.position.copy(sunPosition);
  } else {
    // Fallback position if no sun object provided
    sunLight.position.set(0, 0, 0);
  }
  
  // Disable shadows for performance with infinite range
  sunLight.castShadow = false;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 15000; // Match the light range
  
  lights.push(sunLight);

  // Additional point light from sun for close-range illumination
  const sunPointLight = new THREE.PointLight(0xffaa44, 50, 10000); // Higher intensity
  if (sunObject && sunObject.mesh) {
    const sunPosition = new THREE.Vector3();
    sunObject.mesh.getWorldPosition(sunPosition);
    sunPointLight.position.copy(sunPosition);
  } else {
    sunPointLight.position.set(0, 0, 0);
  }
  
  // Return lights and update function
  const updateLighting = () => {
    if (sunObject && sunObject.mesh) {
      const sunPosition = new THREE.Vector3();
      sunObject.mesh.getWorldPosition(sunPosition);
      
      // Update main sun light position (PointLight)
      sunLight.position.copy(sunPosition);
      
      // Update additional point light position
      sunPointLight.position.copy(sunPosition);
    }
  };
  
  return {
    lights,
    update: updateLighting
  };
}