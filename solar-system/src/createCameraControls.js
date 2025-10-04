import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';

export function createCameraControls(camera, renderer, celestialBodies = {}, scene = null) {
  // Initialize OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  
    // Movement and rotation settings
  const keys = { 
    w: false, a: false, s: false, d: false, q: false, e: false, r: false,
    arrowRight: false, arrowLeft: false, arrowUp: false, arrowDown: false,
    space: false
  };
  let baseSpeed = 0.1; // Base movement speed
  let currentSpeed = 0.1; // Current effective speed
  let maxSpeedMultiplier = 200; // Maximum speed boost (20x base speed)
  let accelerationTime = 0; // Time spent accelerating (for spaceship-like curve)
  let decelerationTime = 0; // Time spent decelerating
  const maxAccelTime = 3.0; // Seconds to reach max speed
  const decelerationRate = 2.0; // How fast we decelerate (faster than acceleration)
  const rotateSpeed = 0.02;
  
  // Track whether we're using manual rotation or orbit controls
  let usingManualRotation = false;
  
  // Camera rotation tracking
  let cameraRotationX = 0;
  let cameraRotationY = 0;
  let rotationTrackingSync = true; // Flag to sync tracking with actual camera rotation
  
  // Instructions toggle
  const instructionsElement = document.getElementById('instructions');
  let instructionsVisible = false;
  
  const toggleInstructions = () => {
    instructionsVisible = !instructionsVisible;
    if (instructionsElement) {
      instructionsElement.classList.toggle('hidden', !instructionsVisible);
    }
  };
  
  // Lock-on tracking
  let lockedObject = null;
  let lockDistance = 5;
  let cameraOffset = new THREE.Vector3(); // Relative position from locked object
  
  // Spherical coordinates for smooth orbiting
  let orbitTheta = 0; // Horizontal angle (azimuth)
  let orbitPhi = Math.PI / 2; // Vertical angle (polar), start at equator
  let orbitRadius = 5; // Distance from object
  let orbitSpeed = 0.01; // Default orbit speed
  
  // Planet highlighting system
  let planetHighlights = [];
  let highlightsVisible = false;
  
  // Zoom functionality when locked on
  const handleWheel = (event) => {
    if (!lockedObject) return; // Only zoom when locked on
    
    event.preventDefault();
    
    // Adjust zoom distance based on wheel delta
    const zoomSpeed = 0.1;
    const zoomDelta = event.deltaY * zoomSpeed;
    
    // Update the orbit radius (zoom in/out)
    orbitRadius = Math.max(0.5, orbitRadius + zoomDelta); // Minimum distance of 0.5
    
    // Also update the camera offset length for consistency
    const currentDistance = cameraOffset.length();
    if (currentDistance > 0) {
      cameraOffset.normalize().multiplyScalar(orbitRadius);
    }
  };

  // Mouse event handlers to detect when user wants OrbitControls
  const handleMouseDown = () => {
    if (lockedObject) {
      // If locked, unlock and enable orbit controls
      unlock();
      usingManualRotation = false;
      controls.enabled = true;
    } else {
      usingManualRotation = false; // Switch to orbit controls
      controls.enabled = true;
    }
    // Don't reset tilt when enabling controls
  };
  
  const handleMouseMove = (event) => {
    if (event.buttons > 0) {
      if (lockedObject) {
        // If locked and mouse is being used, unlock
        unlock();
      }
      usingManualRotation = false; // Switch to orbit controls
      controls.enabled = true;
    }
  };
  
  // Planet highlighting system
  const createPlanetHighlights = () => {
    // Clear existing highlights
    planetHighlights.forEach(highlight => {
      if (highlight.parent) highlight.parent.remove(highlight);
    });
    planetHighlights = [];
    
    // Create highlights for each planet
    const planets = [
      { name: 'Mercury', obj: celestialBodies.mercury, color: 0xff6b35 },
      { name: 'Venus', obj: celestialBodies.venus, color: 0xffa500 },
      { name: 'Earth', obj: celestialBodies.earth, color: 0x00ff00 },
      { name: 'Mars', obj: celestialBodies.mars, color: 0xff0000 },
      { name: 'Jupiter', obj: celestialBodies.jupiter, color: 0xffaa00 },
      { name: 'Saturn', obj: celestialBodies.saturn, color: 0xffff00 },
      { name: 'Uranus', obj: celestialBodies.uranus, color: 0x00ffff },
      { name: 'Neptune', obj: celestialBodies.neptune, color: 0x0000ff },
      { name: 'Pluto', obj: celestialBodies.pluto, color: 0x800080 }
    ];
    
    planets.forEach(planet => {
      if (!planet.obj) return;
      
      // Create a group to hold all highlight elements
      const highlightGroup = new THREE.Group();
      
      // Create a bright glowing sphere as highlight
      const highlightGeometry = new THREE.SphereGeometry(50, 16, 16); // Large visible marker
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: planet.color,
        transparent: true,
        opacity: 0.7,
        wireframe: true
      });
      
      const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
      highlightGroup.add(highlight);
      
      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(80, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: planet.color,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      highlightGroup.add(glow);
      
      // Create text label using CSS3DRenderer approach with canvas texture
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 512;
      canvas.height = 128;
      
      // Set up text styling
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#000000';
      context.font = 'bold 48px Arial';
      context.textAlign = 'center';
      context.fillText(planet.name, canvas.width / 2, canvas.height / 2 + 16);
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const labelGeometry = new THREE.PlaneGeometry(200, 50);
      const label = new THREE.Mesh(labelGeometry, labelMaterial);
      label.position.set(0, 120, 0); // Position above the highlight
      highlightGroup.add(label);
      
      // Create arrow pointing to planet
      const arrowGeometry = new THREE.ConeGeometry(20, 60, 8);
      const arrowMaterial = new THREE.MeshBasicMaterial({
        color: planet.color,
        transparent: true,
        opacity: 0.8
      });
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.position.set(0, 80, 0); // Position between label and planet
      arrow.rotation.x = Math.PI; // Point downward
      highlightGroup.add(arrow);
      
      // Store reference
      planetHighlights.push(highlightGroup);
    });
  };
  
  const togglePlanetHighlights = () => {
    highlightsVisible = !highlightsVisible;
    
    if (highlightsVisible) {
      createPlanetHighlights();
      // Add highlights to scene
      if (scene) {
        planetHighlights.forEach(highlight => scene.add(highlight));
      }
      console.log('Planet highlights: ON');
    } else {
      // Remove highlights from scene
      if (scene) {
        planetHighlights.forEach(highlight => scene.remove(highlight));
      }
      planetHighlights = [];
      console.log('Planet highlights: OFF');
    }
  };
  
  const updatePlanetHighlights = () => {
    if (!highlightsVisible) return;
    
    const planets = [
      celestialBodies.mercury,
      celestialBodies.venus,
      celestialBodies.earth,
      celestialBodies.mars,
      celestialBodies.jupiter,
      celestialBodies.saturn,
      celestialBodies.uranus,
      celestialBodies.neptune,
      celestialBodies.pluto
    ];
    
    planets.forEach((planet, index) => {
      if (!planet || !planetHighlights[index]) return;
      
      const planetPosition = new THREE.Vector3();
      if (planet.mesh) {
        planet.mesh.getWorldPosition(planetPosition);
      } else if (planet.group) {
        planet.group.getWorldPosition(planetPosition);
      }
      
      const highlightGroup = planetHighlights[index];
      highlightGroup.position.copy(planetPosition);
      
      // Calculate distance from camera to planet
      const distanceToCamera = camera.position.distanceTo(planetPosition);
      
      // Much more aggressive scaling for massive solar system distances
      // Use square root scaling for very large distances
      const minReadableDistance = 500; // Base distance for normal text size
      const scaleFactor = Math.max(1.0, Math.sqrt(distanceToCamera / minReadableDistance));
      
      // Additional boost for extreme distances (outer planets)
      const extremeDistanceBoost = distanceToCamera > 100000 ? (distanceToCamera / 100000) : 1.0;
      const finalTextScale = scaleFactor * extremeDistanceBoost;
      
      // Apply the much larger scaling
      highlightGroup.scale.setScalar(finalTextScale);
      
      // Make label always face the camera
      const label = highlightGroup.children[2]; // Third child is the label
      if (label) {
        label.lookAt(camera.position);
      }
    });
  };
  
  // Camera focus function
  const focusOnObject = (object, distance = 5) => {
    if (!object) {
      console.log('Focus object is null/undefined');
      return;
    }
    
    const position = new THREE.Vector3();
    
    // Get object's world position
    if (object.mesh) {
      object.mesh.getWorldPosition(position);
      console.log(`Focusing on object.mesh at position:`, position);
    } else if (object.group) {
      object.group.getWorldPosition(position);
      console.log(`Focusing on object.group at position:`, position);
    } else {
      object.getWorldPosition(position);
      console.log(`Focusing on object at position:`, position);
    }
    
    // Set camera position at a good viewing distance
    // For Earth, use the opposite direction
    let cameraDirection;
    if (object === celestialBodies.earth) {
      cameraDirection = new THREE.Vector3(0, 0, 1); // Opposite side for Earth
      // Set orbit speed to Earth's orbital speed (approx 0.017 radians/frame for 60fps)
      orbitSpeed = 0.017;
    } else {
      cameraDirection = new THREE.Vector3(0, 0, 1); // Default direction
    }
    const offset = cameraDirection.clone().multiplyScalar(distance);
    camera.position.copy(position).add(offset);

    // Update OrbitControls target FIRST
    controls.target.copy(position);

    // Temporarily disable controls to prevent interference
    controls.enabled = false;

    // Make camera look directly at the object
    camera.lookAt(position);

    // Reset rotation tracking
    cameraRotationX = 0;
    cameraRotationY = 0;
    rotationTrackingSync = true; // Need to sync on next arrow key use

    // Re-enable controls and update
    controls.enabled = true;
    controls.update();
  };
  
  // Lock-on function
  const lockOnToObject = (object, distance = 5) => {
    if (!object) return;
    
    lockedObject = object;
    lockDistance = distance;
    
    // Calculate current offset from object to camera
    const objectPosition = new THREE.Vector3();
    if (object.mesh) {
      object.mesh.getWorldPosition(objectPosition);
    } else if (object.group) {
      object.group.getWorldPosition(objectPosition);
    } else {
      object.getWorldPosition(objectPosition);
    }
    
    // Store the current relative position as the lock offset
    cameraOffset.copy(camera.position).sub(objectPosition);
    
    // Initialize spherical coordinates from current camera position
    orbitRadius = cameraOffset.length();
    orbitTheta = Math.atan2(cameraOffset.x, cameraOffset.z);
    orbitPhi = Math.acos(Math.max(-1, Math.min(1, cameraOffset.y / orbitRadius)));
  };
  
  // Unlock function
  const unlock = () => {
    lockedObject = null;
    cameraOffset.set(0, 0, 0);
  };

  // Special function for ring planets (Saturn, Uranus) with better viewing angle
  const ringPlanetView = (planetName, distance) => {
    if (!celestialBodies[planetName]) return;
    
    if (event.shiftKey) {
      lockOnToObject(celestialBodies[planetName], distance); // Shift: Just lock on planet
    } else {
      // Special focus - position camera at 45-degree angle to view rings better
      const position = new THREE.Vector3();
      if (celestialBodies[planetName].mesh) {
        celestialBodies[planetName].mesh.getWorldPosition(position);
      } else if (celestialBodies[planetName].group) {
        celestialBodies[planetName].group.getWorldPosition(position);
      } else {
        celestialBodies[planetName].getWorldPosition(position);
      }
      
      // Position camera at 45-degree angle (both X and Y offset for diagonal view)
      const angle45 = Math.PI / 4; // 45 degrees in radians
      const cosAngle = Math.cos(angle45);
      const sinAngle = Math.sin(angle45);
      
      camera.position.copy(position);
      camera.position.x += distance * cosAngle; // X offset for 45-degree angle
      camera.position.y += distance * sinAngle; // Y offset for 45-degree angle
      camera.position.z += distance * 0.5; // Slight Z offset for better view
      
      // Reset rotation tracking
      cameraRotationX = 0;
      cameraRotationY = 0;
      rotationTrackingSync = true;
      camera.rotation.set(0, 0, 0);
      
      // Make camera look at the planet
      camera.lookAt(position);
      
      // Update OrbitControls target
      controls.target.copy(position);
      controls.update();
      
      lockOnToObject(celestialBodies[planetName], 40); // Then lock to follow planet
    }
  };
  
  // Update locked camera position
  const updateLockedCamera = () => {
    if (!lockedObject) return;
    
    const objectPosition = new THREE.Vector3();
    
    // Get object's current world position
    if (lockedObject.mesh) {
      lockedObject.mesh.getWorldPosition(objectPosition);
    } else if (lockedObject.group) {
      lockedObject.group.getWorldPosition(objectPosition);
    } else {
      lockedObject.getWorldPosition(objectPosition);
    }
    
    // Only update camera position if we're not manually controlling it (excluding arrow keys)
    const isManuallyControlling = keys.a || keys.d || keys.q || keys.e || usingManualRotation;
    
    if (!isManuallyControlling) {
      // Update camera position to maintain the same relative offset
      camera.position.copy(objectPosition).add(cameraOffset);
    } else {
      // Update the offset based on current camera position relative to object
      cameraOffset.copy(camera.position).sub(objectPosition);
    }
    
    // Always update OrbitControls target to follow the object
    controls.target.copy(objectPosition);
    // Don't update controls if we're manually rotating
    if (!usingManualRotation) {
      controls.update();
    }
  };
  
  // Initialize camera focused on Earth
  if (celestialBodies.earth) {
    setTimeout(() => {
      focusOnObject(celestialBodies.earth, 5);
    }, 100); // Small delay to ensure objects are initialized
  }
  
  // Key event listeners
  const handleKeyDown = (event) => {
    switch(event.code) {
      case 'KeyW': 
        keys.w = true; 
        unlock(); // Auto-unlock on forward/backward movement
        break;
      case 'KeyA': 
        keys.a = true; 
        unlock(); // Auto-unlock on strafe movement
        break;
      case 'KeyS': 
        keys.s = true; 
        unlock(); // Auto-unlock on forward/backward movement
        break;
      case 'KeyD': 
        keys.d = true; 
        unlock(); // Auto-unlock on strafe movement
        break;
      case 'KeyQ': 
        keys.q = true; 
        unlock(); // Auto-unlock on vertical movement
        break;
      case 'KeyE': 
        keys.e = true; 
        unlock(); // Auto-unlock on vertical movement
        break;
      case 'KeyR': 
        keys.r = true; 
        unlock(); // Auto-unlock on reset
        baseSpeed = 0.1; // Reset speed to default
        currentSpeed = 0.1;
        accelerationTime = 0; // Reset acceleration timers
        decelerationTime = 0;
        console.log(`Movement speed reset to default: ${baseSpeed.toFixed(2)}`);
        break;
      case 'Space':
        event.preventDefault(); // Prevent page scroll
        keys.space = true;
        break;
      case 'ArrowRight': 
        event.preventDefault(); // Prevent text selection
        keys.arrowRight = true; 
        break;
      case 'ArrowLeft': 
        event.preventDefault(); // Prevent text selection
        keys.arrowLeft = true; 
        break;
      case 'ArrowUp': 
        event.preventDefault(); // Prevent text selection
        keys.arrowUp = true; 
        break;
      case 'ArrowDown': 
        event.preventDefault(); // Prevent text selection
        keys.arrowDown = true; 
        break;
      
      // Camera focus and lock shortcuts
      case 'Digit1':
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.mercury, 12); // Shift+1: Just lock on Mercury
        } else {
          focusOnObject(celestialBodies.mercury, 12); // Position camera on Mercury
          lockOnToObject(celestialBodies.mercury, 12); // Then lock to follow Mercury
        } 
        break;
      case 'Digit2': 
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.venus, 55); // Shift+2: Just lock on Venus
        } else {
          focusOnObject(celestialBodies.venus, 55); // Position camera on Venus
          lockOnToObject(celestialBodies.venus, 55); // Then lock to follow Venus
        }
        break;
      case 'Digit3': 
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+3 (or Cmd+3 on Mac): Focus on Moon
          console.log('Attempting to focus on Moon:', celestialBodies.moon);
          if (celestialBodies.moon) {
            console.log('Moon object found, focusing...');
            if (event.shiftKey) {
              lockOnToObject(celestialBodies.moon, 15); // Shift+Ctrl+3: Just lock on Moon
            } else {
              focusOnObject(celestialBodies.moon, 15); // Position camera on Moon
              lockOnToObject(celestialBodies.moon, 15); // Then lock to follow Moon
            }
          } else {
            console.log('Moon object not found in celestialBodies');
          }
        } else if (event.shiftKey) {
          lockOnToObject(celestialBodies.earth, 60); // Shift+3: Just lock on Earth
        } else {
          focusOnObject(celestialBodies.earth, 60); // Position camera on Earth
          lockOnToObject(celestialBodies.earth, 60); // Then lock to follow Earth
        }
        break;
      case 'Digit4': 
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.mars, 25); // Shift+4: Just lock on Mars
        } else {
          focusOnObject(celestialBodies.mars, 25); // Position camera on Mars
          lockOnToObject(celestialBodies.mars, 25); // Then lock to follow Mars
        }
        break;
      case 'Digit5': 
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.jupiter, 500); // Shift+5: Just lock on Jupiter
        } else {
          focusOnObject(celestialBodies.jupiter, 500); // Position camera on Jupiter
          lockOnToObject(celestialBodies.jupiter, 500); // Then lock to follow Jupiter
        }
        break;
      case 'Digit6': 
        ringPlanetView('saturn', 400);
        break;
        
      case 'Digit7':
        ringPlanetView('uranus', 200);
        break;
      case 'Digit8':
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.neptune, 200); // Shift+8: Just lock on Neptune
        } else {
          focusOnObject(celestialBodies.neptune, 200); // Position camera on Neptune
          lockOnToObject(celestialBodies.neptune, 200); // Then lock to follow Neptune
        }
        break;
      case 'Digit9':
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.pluto, 5); // Shift+9: Just lock on Pluto with better distance
        } else {
          focusOnObject(celestialBodies.pluto, 5); // Position camera on Pluto with better distance
          lockOnToObject(celestialBodies.pluto, 5); // Then lock to follow Pluto
        }
        break;
      case 'Digit0':
        if (event.shiftKey) {
          // Shift+0: Overview - show whole system
          unlock(); // Unlock first
          camera.position.set(0, 0, 50000); // Position camera far back
          
          // Set rotation tracking first, then apply to camera
          cameraRotationX = 0;
          cameraRotationY = Math.PI / 4; // 45 degrees to the right
          rotationTrackingSync = true; // Need to sync on next arrow key use
          
          // Apply rotation using the same method as arrow keys
          camera.rotation.order = 'YXZ';
          camera.rotation.y = cameraRotationY;
          camera.rotation.x = cameraRotationX;
          camera.rotation.z = 0;
          
          // Set target and update controls
          controls.target.set(0, 0, 0);
          controls.update();
        } else {
          // Focus on Sun
          focusOnObject(celestialBodies.sun, 3000); // Position camera on Sun
          lockOnToObject(celestialBodies.sun, 3000); // Then lock to follow Sun
        }
        break;

      case 'KeyP': // Toggle planet highlights
        togglePlanetHighlights();
        break;

      case 'KeyH': // Toggle instructions
        toggleInstructions();
        break;
    }
  };
  
  const handleKeyUp = (event) => {
    switch(event.code) {
      case 'KeyW': keys.w = false; break;
      case 'KeyA': keys.a = false; break;
      case 'KeyS': keys.s = false; break;
      case 'KeyD': keys.d = false; break;
      case 'KeyQ': keys.q = false; break;
      case 'KeyE': keys.e = false; break;
      case 'KeyR': keys.r = false; break;
      case 'Space': keys.space = false; break;
      case 'ArrowRight': keys.arrowRight = false; break;
      case 'ArrowLeft': keys.arrowLeft = false; break;
      case 'ArrowUp': keys.arrowUp = false; break;
      case 'ArrowDown': keys.arrowDown = false; break;
    }
  };
  
  // Add event listeners
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
  renderer.domElement.addEventListener('mousedown', handleMouseDown);
  renderer.domElement.addEventListener('mousemove', handleMouseMove);
  
  // Camera movement and rotation update function
  const updateMovement = () => {
    // Handle spaceship-like speed boost with Space key
    const deltaTime = 1/60; // Assume 60fps for consistent acceleration
    
    if (keys.space) {
      // Accelerate like a spaceship - fast initial acceleration, then slower
      accelerationTime = Math.min(accelerationTime + deltaTime, maxAccelTime);
      decelerationTime = 0; // Reset deceleration timer
      
      // Use exponential curve for spaceship-like acceleration
      // Fast initial boost, then diminishing returns
      const accelerationProgress = accelerationTime / maxAccelTime;
      const accelerationCurve = 1 - Math.exp(-4 * accelerationProgress); // Exponential approach to 1
      const speedMultiplier = 1 + (maxSpeedMultiplier - 1) * accelerationCurve;
      currentSpeed = baseSpeed * speedMultiplier;
      
    } else {
      // Decelerate like cutting engines - gradual but steady
      accelerationTime = 0; // Reset acceleration timer
      decelerationTime += deltaTime;
      
      // Use exponential decay for realistic momentum loss
      const decayFactor = Math.exp(-decelerationRate * decelerationTime);
      const currentMultiplier = currentSpeed / baseSpeed;
      const targetMultiplier = 1 + (currentMultiplier - 1) * decayFactor;
      currentSpeed = Math.max(baseSpeed * targetMultiplier, baseSpeed);
    }
    
  const direction = new THREE.Vector3();
  const right = new THREE.Vector3();
    
    // Handle arrow key rotation/orbiting first
    if (keys.arrowRight || keys.arrowLeft || keys.arrowUp || keys.arrowDown) {
      usingManualRotation = true; // Switch to manual rotation mode
      controls.enabled = false;
      
      if (lockedObject) {
        // When locked, orbit around the object using spherical coordinates
        const objectPosition = new THREE.Vector3();
        if (lockedObject.mesh) {
          lockedObject.mesh.getWorldPosition(objectPosition);
        } else if (lockedObject.group) {
          lockedObject.group.getWorldPosition(objectPosition);
        } else {
          lockedObject.getWorldPosition(objectPosition);
        }
        
        // Update spherical coordinates based on arrow keys
        if (keys.arrowRight || keys.arrowLeft) {
          // Horizontal orbit (change azimuth angle)
          const deltaTheta = keys.arrowRight ? rotateSpeed : -rotateSpeed; // Fixed: right = positive, left = negative
          orbitTheta += deltaTheta;
        }
        
        if (keys.arrowUp || keys.arrowDown) {
          // Vertical orbit (change polar angle)
          const deltaPhi = keys.arrowUp ? -rotateSpeed : rotateSpeed;
          orbitPhi += deltaPhi;
          // Clamp phi to prevent flipping (small margin from poles)
          orbitPhi = Math.max(0.01, Math.min(Math.PI - 0.01, orbitPhi));
        }
        
        // Convert spherical coordinates back to Cartesian
        const x = orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
        const y = orbitRadius * Math.cos(orbitPhi);
        const z = orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta);
        
        // Update camera position
        camera.position.copy(objectPosition);
        camera.position.add(new THREE.Vector3(x, y, z));
        
        // Update the camera offset to reflect the new position
        cameraOffset.set(x, y, z);
        
        // Keep object centered when orbiting with arrow keys
        camera.lookAt(objectPosition);
        
        // Skip the normal locked camera update when orbiting
        return; // Exit early to avoid updateLockedCamera interference
        
      } else {
        // When not locked, use original rotation behavior
        // Sync tracking variables with actual camera rotation on first arrow key use
        if (rotationTrackingSync) {
          // Don't sync from camera rotation - just reset the tracking
          rotationTrackingSync = false;
        }
        
        // Use quaternion-based rotation for smooth, natural camera movement
        // This avoids gimbal lock and direction reversal issues
        const deltaQuaternion = new THREE.Quaternion();
        
        if (keys.arrowRight || keys.arrowLeft) {
          // Check camera's up vector to determine if we're upside down
          const cameraUp = new THREE.Vector3(0, 1, 0);
          cameraUp.applyQuaternion(camera.quaternion);
          const isUpsideDown = cameraUp.y < 0; // If camera's up vector points down, we're upside down
          
          // Create Y-axis rotation relative to world space with direction correction
          const yRotation = new THREE.Quaternion();
          let yAngle = 0;
          
          if (keys.arrowRight) {
            yAngle = isUpsideDown ? rotateSpeed : -rotateSpeed;
          }
          if (keys.arrowLeft) {
            yAngle = isUpsideDown ? -rotateSpeed : rotateSpeed;
          }
          
          yRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yAngle);
          deltaQuaternion.multiplyQuaternions(yRotation, deltaQuaternion);
        }
        
        if (keys.arrowUp || keys.arrowDown) {
          // Create X-axis rotation relative to camera's local space
          const xRotation = new THREE.Quaternion();
          const xAngle = keys.arrowUp ? rotateSpeed : (keys.arrowDown ? -rotateSpeed : 0);
          const rightVector = new THREE.Vector3(1, 0, 0);
          rightVector.applyQuaternion(camera.quaternion);
          xRotation.setFromAxisAngle(rightVector, xAngle);
          deltaQuaternion.multiplyQuaternions(xRotation, deltaQuaternion);
        }
        
        // Apply the rotation
        camera.quaternion.multiplyQuaternions(deltaQuaternion, camera.quaternion);
      }
    } else {
      // Reset manual rotation flag when no arrow keys are pressed
      usingManualRotation = false;
    }
    
    // Update locked camera position (only when not using arrow keys)
    updateLockedCamera();
    // Don't automatically re-enable OrbitControls - only when user uses mouse
    
    // Get camera's forward and right vectors (after rotation is applied)
  camera.getWorldDirection(direction);
  // Compute right vector as (direction cross up) so it points to the camera's local right
  right.crossVectors(direction, camera.up).normalize();
    
    // Apply movement based on pressed keys
    if (lockedObject) {
      // When locked, W/S control camera rotation (look up/down)
      if (keys.w || keys.s) {
        const xRotation = new THREE.Quaternion();
        const xAngle = keys.w ? rotateSpeed : (keys.s ? -rotateSpeed : 0);
        const rightVector = new THREE.Vector3(1, 0, 0);
        rightVector.applyQuaternion(camera.quaternion);
        xRotation.setFromAxisAngle(rightVector, xAngle);
        camera.quaternion.multiplyQuaternions(xRotation, camera.quaternion);
      }
    } else {
      // When not locked, W/S move forward/backward
      if (keys.w) camera.position.addScaledVector(direction, currentSpeed);
      if (keys.s) camera.position.addScaledVector(direction, -currentSpeed);
    }
    
    // A/D movement (strafe left/right) and Q/E movement (up/down)
    if (lockedObject) {
      // When locked, A should strafe left, D should strafe right (relative to camera)
      if (keys.a) camera.position.addScaledVector(right, -currentSpeed);
      if (keys.d) camera.position.addScaledVector(right, currentSpeed);
    } else {
      // When not locked, use the same consistent mapping: A = left, D = right
      if (keys.a) camera.position.addScaledVector(right, -currentSpeed);
      if (keys.d) camera.position.addScaledVector(right, currentSpeed);
    }
    if (keys.q) camera.position.y += currentSpeed; // Move up in world space
    if (keys.e) camera.position.y -= currentSpeed; // Move down in world space
    
    // Update OrbitControls when enabled
    if (controls.enabled) {
      controls.target.copy(camera.position).add(direction.multiplyScalar(5));
      controls.update();
    }
    
    // Update planet highlights
    updatePlanetHighlights();
  };
  
  // Cleanup function to remove event listeners
  const dispose = () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    renderer.domElement.removeEventListener('wheel', handleWheel);
    controls.dispose();
  };

  // Initialize with Earth locked on startup
  if (celestialBodies.earth) {
    lockOnToObject(celestialBodies.earth, 6);
  }
  
  // Return public interface
  return {
    controls,
    update: updateMovement,
    dispose,
    focusOnObject, // Expose focus function for external use
    lockOnToObject, // Expose lock-on function
    unlock, // Expose unlock function
    isLocked: () => lockedObject !== null, // Check if camera is locked
    getLockedObject: () => lockedObject, // Get currently locked object
    // Planet highlighting
    togglePlanetHighlights,
    getPlanetHighlights: () => planetHighlights,
    areHighlightsVisible: () => highlightsVisible,
    // Expose settings for customization
    setMoveSpeed: (speed) => { baseSpeed = speed; currentSpeed = speed; },
    setRotateSpeed: (speed) => { rotateSpeed = speed; },
    getMoveSpeed: () => baseSpeed,
    getCurrentSpeed: () => currentSpeed,
    getRotateSpeed: () => rotateSpeed,
    setOrbitSpeed: (speed) => { orbitSpeed = speed; },
    getOrbitSpeed: () => orbitSpeed
  };
}