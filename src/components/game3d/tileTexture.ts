import * as THREE from 'three';

// Nord light palette
const NORD = {
  // Polar Night
  n0: '#2E3440', n1: '#3B4252', n2: '#434C5E', n3: '#4C566A',
  // Snow Storm
  n4: '#D8DEE9', n5: '#E5E9F0', n6: '#ECEFF4',
  // Frost
  n7: '#8FBCBB', n8: '#88C0D0', n9: '#81A1C1', n10: '#5E81AC',
  // Aurora
  n11: '#BF616A', n12: '#D08770', n13: '#EBCB8B', n14: '#A3BE8C', n15: '#B48EAD',
};

const cache = new Map<string, THREE.CanvasTexture>();

function createValueTexture(color: 'black' | 'white', value: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 340;
  const ctx = canvas.getContext('2d')!;

  const isDark = color === 'black';
  const bg      = isDark ? NORD.n2  : NORD.n6;
  const fg      = isDark ? NORD.n6  : NORD.n0;
  const border  = isDark ? NORD.n3  : NORD.n4;
  const accent  = isDark ? NORD.n8  : NORD.n10;

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 340);

  // Inner border
  ctx.strokeStyle = border;
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, 228, 312);

  // Value number
  ctx.fillStyle = fg;
  ctx.font = `bold ${value >= 10 ? '100px' : '118px'} system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value === 0 ? 'J' : String(value), 128, 148);

  // Accent pip at bottom
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(128, 293, 14, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createBackTexture(color: 'black' | 'white'): THREE.CanvasTexture {
  const isDark = color === 'black';
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 340;
  const ctx = canvas.getContext('2d')!;

  const bg      = isDark ? NORD.n1  : NORD.n5;   // polar night 1 | snow storm mid
  const dot     = isDark ? NORD.n3  : NORD.n4;   // polar night 3 | snow storm dim
  const border  = isDark ? NORD.n8  : NORD.n9;   // frost teal    | frost blue
  const diamond = isDark ? NORD.n7  : NORD.n8;   // frost teal light

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 340);

  // Subtle dot grid
  ctx.fillStyle = dot;
  const gap = 22;
  for (let px = gap; px < 256; px += gap) {
    for (let py = gap; py < 340; py += gap) {
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Border
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 228, 312);

  // Frost diamond ornament
  ctx.strokeStyle = diamond;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(128,  70); ctx.lineTo(196, 170);
  ctx.lineTo(128, 270); ctx.lineTo( 60, 170);
  ctx.closePath();
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function getTileTexture(color: string, value: number): THREE.CanvasTexture {
  const key = `${color}_${value}`;
  if (!cache.has(key)) {
    cache.set(key, createValueTexture(color as 'black' | 'white', value));
  }
  return cache.get(key)!;
}

export function getBackTexture(color: string): THREE.CanvasTexture {
  const key = `back_${color}`;
  if (!cache.has(key)) {
    cache.set(key, createBackTexture(color as 'black' | 'white'));
  }
  return cache.get(key)!;
}
