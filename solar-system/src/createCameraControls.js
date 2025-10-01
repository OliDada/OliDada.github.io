import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';

export function createCameraControls(camera, renderer, celestialBodies = {}) {
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
  let maxSpeedMultiplier = 40; // Maximum speed boost (20x base speed)
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
  let instructionsVisible = true;
  
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
    // Calculate a proper offset direction (towards camera from object)
    const cameraDirection = new THREE.Vector3(0, 0, 1); // Default camera direction
    const offset = cameraDirection.clone().multiplyScalar(distance);
    
    // Position camera at object location plus offset
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
      // Special focus - position camera higher to show rings better
      const position = new THREE.Vector3();
      if (celestialBodies[planetName].mesh) {
        celestialBodies[planetName].mesh.getWorldPosition(position);
      } else if (celestialBodies[planetName].group) {
        celestialBodies[planetName].group.getWorldPosition(position);
      } else {
        celestialBodies[planetName].getWorldPosition(position);
      }
      
      // Position camera with higher Y offset to view rings from above
      camera.position.copy(position);
      camera.position.z += distance; // Distance
      camera.position.y += 5; // Higher Y position to see rings better
      
      // Reset rotation tracking
      cameraRotationX = 0;
      cameraRotationY = 0;
      rotationTrackingSync = true;
      camera.rotation.set(0, 0, 0);
      
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
          lockOnToObject(celestialBodies.mercury, 3); // Shift+1: Just lock on Mercury
        } else {
          focusOnObject(celestialBodies.mercury, 3); // Position camera on Mercury
          lockOnToObject(celestialBodies.mercury, 3); // Then lock to follow Mercury
        } 
        break;
      case 'Digit2': 
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.venus, 5); // Shift+2: Just lock on Venus
        } else {
          focusOnObject(celestialBodies.venus, 5); // Position camera on Venus
          lockOnToObject(celestialBodies.venus, 5); // Then lock to follow Venus
        }
        break;
      case 'Digit3': 
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.earth, 6); // Shift+3: Just lock on Earth
        } else {
          focusOnObject(celestialBodies.earth, 6); // Position camera on Earth
          lockOnToObject(celestialBodies.earth, 6); // Then lock to follow Earth
        }
        break;
      case 'Digit4': 
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.mars, 3); // Shift+4: Just lock on Mars
        } else {
          focusOnObject(celestialBodies.mars, 3); // Position camera on Mars
          lockOnToObject(celestialBodies.mars, 3); // Then lock to follow Mars
        }
        break;
      case 'Digit5': 
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.jupiter, 30); // Shift+5: Just lock on Jupiter
        } else {
          focusOnObject(celestialBodies.jupiter, 30); // Position camera on Jupiter
          lockOnToObject(celestialBodies.jupiter, 30); // Then lock to follow Jupiter
        }
        break;
      case 'Digit6': 
        ringPlanetView('saturn', 40);
        break;
        
      case 'Digit7':
        ringPlanetView('uranus', 20);
        break;
      case 'Digit8':
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.neptune, 20); // Shift+8: Just lock on Neptune
        } else {
          focusOnObject(celestialBodies.neptune, 20); // Position camera on Neptune
          lockOnToObject(celestialBodies.neptune, 20); // Then lock to follow Neptune
        }
        break;
      case 'Digit9':
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.pluto, 2); // Shift+9: Just lock on Pluto
        } else {
          focusOnObject(celestialBodies.pluto, 2); // Position camera on Pluto
          lockOnToObject(celestialBodies.pluto, 2); // Then lock to follow Pluto
        }
        break;
      case 'Digit0':
        if (event.shiftKey) {
          lockOnToObject(celestialBodies.sun, 200); // Shift+0: Just lock on Sun
        } else {
          // Overview - show whole system
          unlock(); // Unlock first
          camera.position.set(0, 0, 2000); // Position camera
          
          // Set rotation tracking first, then apply to camera
          cameraRotationX = 0;
          cameraRotationY = Math.PI / 4; // 90 degrees to the right
          rotationTrackingSync = true; // Need to sync on next arrow key use
          
          // Apply rotation using the same method as arrow keys
          camera.rotation.order = 'YXZ';
          camera.rotation.y = cameraRotationY;
          camera.rotation.x = cameraRotationX;
          camera.rotation.z = 0;
          
          // Set target and update controls
          controls.target.set(100, 0, 0);
          controls.update();
        }
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
          const deltaTheta = keys.arrowRight ? -rotateSpeed : rotateSpeed;
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
    right.crossVectors(camera.up, direction).normalize();
    
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
    // Check if camera is upside down to correct left/right movement direction
    const cameraUp = new THREE.Vector3(0, 1, 0);
    cameraUp.applyQuaternion(camera.quaternion);
    const isUpsideDown = cameraUp.y < 0;
    
    if (keys.a) camera.position.addScaledVector(right, isUpsideDown ? -currentSpeed : currentSpeed);
    if (keys.d) camera.position.addScaledVector(right, isUpsideDown ? currentSpeed : -currentSpeed);
    if (keys.q) camera.position.y += currentSpeed; // Move up in world space
    if (keys.e) camera.position.y -= currentSpeed; // Move down in world space
    
    // Update OrbitControls when enabled
    if (controls.enabled) {
      controls.target.copy(camera.position).add(direction.multiplyScalar(5));
      controls.update();
    }
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
    // Expose settings for customization
    setMoveSpeed: (speed) => { baseSpeed = speed; currentSpeed = speed; },
    setRotateSpeed: (speed) => { rotateSpeed = speed; },
    getMoveSpeed: () => baseSpeed,
    getCurrentSpeed: () => currentSpeed,
    getRotateSpeed: () => rotateSpeed
  };
}