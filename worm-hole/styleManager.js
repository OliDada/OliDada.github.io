import * as THREE from 'three';
import TUBE_STYLES from './styles.js';

// Helper: take a color (hex number or string) and return a readable hex string
function readableAccentHex(input) {
  try {
    const c = new THREE.Color(input);
    const hsl = c.getHSL({ h: 0, s: 0, l: 0 });
    // avoid too-dark colors — boost lightness
    if (hsl.l < 0.15) hsl.l = 0.5;
    // avoid desaturated greys — boost saturation
    if (hsl.s < 0.18) hsl.s = Math.max(hsl.s, 0.7);
    c.setHSL(hsl.h, hsl.s, hsl.l);
    return '#' + c.getHexString();
  } catch (e) {
    return null;
  }
}

// Style manager: apply named style index to provided materials and composer passes.
// Keeps track of current index to avoid redundant updates.

export class StyleManager {
  constructor({ tubeMaterial, lineMaterial, pointsMaterial, bloomPass }) {
    this.tubeMaterial = tubeMaterial;
    this.lineMaterial = lineMaterial;
    this.pointsMaterial = pointsMaterial;
    this.bloomPass = bloomPass;
    this.currentIndex = -1;
    this._boxes = null;
  }

  // allow index.js to provide the boxes so we can style them per-bucket
  setBoxes(boxes) {
    this._boxes = boxes;
  }
  

  applyIndex(index) {
    if (!TUBE_STYLES || TUBE_STYLES.length === 0) return;
  const idx = index % TUBE_STYLES.length;
  const indexUnchanged = (idx === this.currentIndex);
  if (!indexUnchanged) this.currentIndex = idx;
    const s = TUBE_STYLES[idx];
    // debug: report which style is being applied and box color chosen
    try {
      console.debug(`[StyleManager] applyIndex idx=${idx} name=${s.name} boxColor=${(typeof s.boxColor !== 'undefined') ? '0x' + s.boxColor.toString(16) : 'undefined'}`);
    } catch (e) {}
    // tube (only reapply when the index actually changed)
    if (!indexUnchanged && this.tubeMaterial) {
      // Respect per-style opacity/transparent flags so some styles can use
      // a translucent tube. We keep BackSide so the interior is visible.
      this.tubeMaterial.side = THREE.BackSide;
      if (typeof s.tubeColor !== 'undefined') this.tubeMaterial.color.setHex(s.tubeColor);
      // allow style to specify opacity; default to fully opaque
  const opa = (typeof s.tubeOpacity === 'number') ? s.tubeOpacity : 1.0;
  // Respect explicit request for transparency only when the style sets tubeTransparent
  const isTransparent = !!s.tubeTransparent;
  this.tubeMaterial.opacity = opa;
  this.tubeMaterial.transparent = isTransparent;
      // when transparent, disable depthWrite to avoid occlusion artifacts
      this.tubeMaterial.depthWrite = !isTransparent;
      this.tubeMaterial.depthTest = true;
      this.tubeMaterial.needsUpdate = true;
    }
    // line
    if (!indexUnchanged && this.lineMaterial && this.lineMaterial.color) {
      this.lineMaterial.color.setHex(s.lineColor);
      // remember base color for runtime modulation
      try { this.lineMaterial.userData.baseColor = new THREE.Color(s.lineColor); } catch (e) {}
      try { this.lineMaterial.userData.animateColor = !!s.animateColor; } catch (e) {}
      try { this.lineMaterial.userData.animationStrength = typeof s.animationStrength === 'number' ? s.animationStrength : 1.0; } catch (e) {}
      this.lineMaterial.needsUpdate = true;
    }
    // points
    if (!indexUnchanged && this.pointsMaterial) {
      this.pointsMaterial.color.setHex(s.pointColor);
      this.pointsMaterial.size = s.pointSize;
      try { this.pointsMaterial.userData.baseColor = new THREE.Color(s.pointColor); } catch (e) {}
      // keep points visually uniform by default: don't animate their hue (override style.animateColor)
      try { this.pointsMaterial.userData.animateColor = false; } catch (e) {}
      try { this.pointsMaterial.userData.animationStrength = typeof s.animationStrength === 'number' ? s.animationStrength : 1.0; } catch (e) {}
      this.pointsMaterial.needsUpdate = true;
    }
    // boxes: if provided, color them according to style.boxColor or fallback to lineColor
    if (this._boxes && Array.isArray(this._boxes)) {
      const boxHex = (typeof s.boxColor !== 'undefined') ? s.boxColor : s.lineColor;
      const boxAnimate = !!s.boxAnimate;
      const boxStrength = typeof s.boxAnimationStrength === 'number' ? s.boxAnimationStrength : 1.0;
      for (let i = 0; i < this._boxes.length; i++) {
        const b = this._boxes[i];
        if (!b || !b.material) continue;
        try {
          b.material.color.setHex(boxHex);
          b.material.needsUpdate = true;
          b.material.userData = b.material.userData || {};
          b.material.userData.baseColor = new THREE.Color(boxHex);
          b.material.userData.animateColor = boxAnimate;
          b.material.userData.animationStrength = boxStrength;
        } catch (e) {
          // ignore
        }
      }
      try { console.debug(`[StyleManager] colored ${this._boxes.length} boxes -> 0x${boxHex.toString(16)}`); } catch (e) {}
    }
    // bloom
    if (!indexUnchanged && this.bloomPass) {
      this.bloomPass.strength = s.bloomStrength;
    }

    // Sync the HUD accent color to the active style so the score text reflects the style.
    // We set it both on the document root and, if present, on the score div to ensure
    // the CSS variable is applied regardless of scoping.
    try {
      let accentHex = null;
      if (typeof s.lineColor !== 'undefined') {
        accentHex = '#' + new THREE.Color(s.lineColor).getHexString();
      }
      // fallback to lineMaterial color if style value not present
      if (!accentHex && this.lineMaterial && this.lineMaterial.color) {
        accentHex = '#' + this.lineMaterial.color.getHexString();
      }
      if (accentHex && typeof document !== 'undefined' && document.documentElement) {
        const readable = readableAccentHex(accentHex) || accentHex;
        document.documentElement.style.setProperty('--hud-accent', readable);
        const sd = document.getElementById('score-div');
        if (sd) sd.style.setProperty('--hud-accent', readable);
      }
    } catch (e) {
      // ignore DOM errors in non-browser environments
    }
  }

  applyForScore(score) {
    const bucket = Math.floor(score / 10);
    const idx = bucket % TUBE_STYLES.length;
    this.applyIndex(idx);
  }
}

export default StyleManager;
