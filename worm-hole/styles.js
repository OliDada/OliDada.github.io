// Centralized style definitions for the wormhole tunnel.
// Edit or replace entries here to change per-10-point styles.

const TUBE_STYLES = [
  // 0..9
  {
    name: 'default',
    tubeColor: 0x000000,
    tubeOpacity: 1.0,
    lineColor: 0xffa500,
    pointColor: 0xffffcc,
    pointSize: 6,
    bloomStrength: 1.6,
    // whether edge/point colors should be animated (hue modulation)
    animateColor: true,
    // 0..1 strength of the color animation (1 = full, 0 = none)
    animationStrength: 1.0,
    boxColor: 0xff0500,
    boxAnimate: true,
    boxAnimationStrength: 1.0,
  },
  // 10..19
  {
    name: 'matrix',
    tubeColor: 0x000000,
    tubeOpacity: 0.5,
    lineColor: 0x00ff00,
    pointColor: 0x00ff00,
    pointSize: 10,
    bloomStrength: 2,
    animateColor: false,
    animationStrength: 0.3,
    // add these three:
    boxColor: 0xffffff,
    boxAnimate: false,
    boxAnimationStrength: 0.0,
  },
  // 20..29
  {
    name: 'ice',
    tubeColor: 0x000000,
    tubeOpacity: 0.5,
    lineColor: 0x66e0ff,
    pointColor: 0x99f0ff,
    pointSize: 10,
    bloomStrength: 2,
    animateColor: true,
    animationStrength: 0.6,
    boxColor: 0x000000,
    boxAnimate: false,
    boxAnimationStrength: 0.0,
  },
  // 30..39
  {
    name: 'ember',
    tubeColor: 0x120200,
    tubeOpacity: 0.95,
    lineColor: 0x000000,
    pointColor: 0xffc699,
    pointSize: 20,
    bloomStrength: 1.8,
    animateColor: true,
    animationStrength: 0.8,
    boxColor: 0xffffff,
    boxAnimate: false,
    boxAnimationStrength: 0.0,
  },
  // 40..49
  {
    name: 'purple haze',
    tubeColor: 0x001204,
    tubeOpacity: 0.96,
    lineColor: 0xccffcc,
    pointColor: 0xccffcc,
    pointSize: 7,
    bloomStrength: 1.5,
    animateColor: true,
    animationStrength: 0.7,
    boxColor: 0xffffff,
    boxAnimate: false,
    boxAnimationStrength: 0.0,
  },
    // 50..59
  {
    name: 'see-through',
    tubeColor: 0x000000,
    tubeOpacity: 0.8,
    tubeTransparent: true,
    lineColor: 0xffa500,
    pointColor: 0xffff00,
    pointSize: 8,
    bloomStrength: 1.8,
    animateColor: true,
    animationStrength: 1,
    boxColor: 0x000000,
    boxAnimate: false,
    boxAnimationStrength: 0.0,
  },
  // 60..69
  {
    name: 'default',
    tubeColor: 0x000000,
    tubeOpacity: 1.0,
    lineColor: 0xffa500,
    pointColor: 0xffffcc,
    pointSize: 6,
    bloomStrength: 1.6,
    // whether edge/point colors should be animated (hue modulation)
    animateColor: true,
    // 0..1 strength of the color animation (1 = full, 0 = none)
    animationStrength: 1.0,
    boxColor: 0xff0500,
    boxAnimate: true,
    boxAnimationStrength: 1.0,
  },
    // 70..79
  {
    name: 'black hole',
    tubeColor: 0x000000,
    tubeOpacity: 0,
    lineColor: 0x000000,
    pointColor: 0x000000,
    pointSize: 0,
    bloomStrength: 16,
    // whether edge/point colors should be animated (hue modulation)
    animateColor: true,
    // 0..1 strength of the color animation (1 = full, 0 = none)
    animationStrength: 1.0,
    boxColor: 0xff0500,
    boxAnimate: true,
    boxAnimationStrength: 1.0,
  },
  {
    name: 'craziness',
    tubeColor: 0x202020,
    tubeOpacity: 0.9,
    lineColor: 0xffaaff,
    pointColor: 0xaaffff,
    pointSize: 12,
    bloomStrength: 2.5,
    animateColor: true,
    animationStrength: 1.0,
    boxColor: 0xffffff,
    boxAnimate: true,
    boxAnimationStrength: 1.0,
  }
];

export default TUBE_STYLES;
