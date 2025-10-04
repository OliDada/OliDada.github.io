// src/landingManager.js
import { createPlanetSurfaceScene } from './createPlanetSurface.js';

export class LandingManager {
  constructor(renderer, camera, orbitScene) {
    this.renderer = renderer;
    this.camera = camera;
    this.orbitScene = orbitScene;
    this.surfaceScene = null;
    this.currentMode = 'orbit';
  }

  triggerLanding(planetName) {
    this.currentMode = 'surface';
    this.surfaceScene = createPlanetSurfaceScene(planetName);
  }

  triggerTakeoff() {
    this.currentMode = 'orbit';
    this.surfaceScene = null;
  }

  render() {
    if (this.currentMode === 'orbit') {
      this.renderer.render(this.orbitScene, this.camera);
    } else if (this.surfaceScene) {
      this.renderer.render(this.surfaceScene, this.camera);
    }
  }
}
