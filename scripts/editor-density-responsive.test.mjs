import assert from 'node:assert/strict';

const clamp = (min, preferred, max) => Math.max(min, Math.min(preferred, max));
const specs = {
  base: {
    full: [210, 26, 270],
    compact: [150, 20, 205],
    focus: [108, 15, 150],
  },
  short: {
    full: [190, 27, 230],
    compact: [140, 22, 180],
    focus: [96, 16, 128],
  },
  mobile: {
    full: [190, 25, 240],
    compact: [150, 21, 200],
    focus: [118, 17, 165],
  },
  phone: {
    full: [180, 24, 218],
    compact: [142, 20, 184],
    focus: [112, 16, 148],
  },
};

const modeFor = (width, height) => {
  if (width <= 480) return 'phone';
  if (width <= 768) return 'mobile';
  if (height <= 800) return 'short';
  return 'base';
};

const cueHeight = (width, height, density) => {
  const [min, vh, max] = specs[modeFor(width, height)][density];
  return clamp(min, (height * vh) / 100, max);
};

const targets = [
  [1440, 900],
  [1366, 768],
  [1280, 800],
  [768, 1024],
  [390, 844],
];

for (const [width, height] of targets) {
  const full = cueHeight(width, height, 'full');
  const compact = cueHeight(width, height, 'compact');
  const focus = cueHeight(width, height, 'focus');
  assert(full > compact, `${width}x${height}: full cue viewport must be taller than compact`);
  assert(compact > focus, `${width}x${height}: compact cue viewport must be taller than focus`);
  assert(focus >= 96, `${width}x${height}: focus cue viewport must remain usable`);
  assert(full <= 270, `${width}x${height}: full cue viewport must stay bounded`);
}

console.log('editor density responsive matrix: PASS (1440x900, 1366x768, 1280x800, 768x1024, 390x844)');
