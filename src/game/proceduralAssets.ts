import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { ItemId } from '../types/game';

export interface ProceduralTextureSet {
  wallpaperMap: THREE.CanvasTexture;
  wallpaperBumpMap: THREE.CanvasTexture;
  carpetMap: THREE.CanvasTexture;
  carpetBumpMap: THREE.CanvasTexture;
  concreteMap: THREE.CanvasTexture;
  concreteBumpMap: THREE.CanvasTexture;
  metalFloorMap: THREE.CanvasTexture;
  metalFloorBumpMap: THREE.CanvasTexture;
  woodFloorMap: THREE.CanvasTexture;
  woodFloorBumpMap: THREE.CanvasTexture;
  ceilingMap: THREE.CanvasTexture;
  ceilingBumpMap: THREE.CanvasTexture;
  metalMap: THREE.CanvasTexture;
  dustMoteMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Damp Ochre Backrooms Wallpaper (vertical pinstripe + water stains + baseboard)
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 512;
  const wCtx = wallCanvas.getContext('2d')!;
  wCtx.fillStyle = '#9b8d55';
  wCtx.fillRect(0, 0, 512, 512);

  // Vertical damp wallpaper stripes
  for (let x = 0; x < 512; x += 32) {
    wCtx.fillStyle = x % 64 === 0 ? 'rgba(122, 108, 56, 0.38)' : 'rgba(176, 162, 102, 0.22)';
    wCtx.fillRect(x, 0, 14, 512);
    wCtx.fillStyle = 'rgba(72, 62, 30, 0.14)';
    wCtx.fillRect(x + 14, 0, 2, 512);
  }
  // Subtle grime & mold blotches
  for (let i = 0; i < 420; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const r = 4 + Math.random() * 26;
    const grad = wCtx.createRadialGradient(gx, gy, 1, gx, gy, r);
    grad.addColorStop(0, 'rgba(42, 37, 20, 0.16)');
    grad.addColorStop(1, 'rgba(42, 37, 20, 0)');
    wCtx.fillStyle = grad;
    wCtx.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  // Damp moisture gradient near bottom baseboard
  const dampGrad = wCtx.createLinearGradient(0, 360, 0, 512);
  dampGrad.addColorStop(0, 'rgba(30, 26, 14, 0)');
  dampGrad.addColorStop(0.78, 'rgba(30, 26, 14, 0.45)');
  dampGrad.addColorStop(1, 'rgba(20, 18, 10, 0.88)');
  wCtx.fillStyle = dampGrad;
  wCtx.fillRect(0, 360, 512, 152);

  // Dark wooden baseboard
  wCtx.fillStyle = '#262116';
  wCtx.fillRect(0, 480, 512, 32);
  wCtx.fillStyle = '#3b3322';
  wCtx.fillRect(0, 476, 512, 4);

  const wallpaperMap = new THREE.CanvasTexture(wallCanvas);
  wallpaperMap.colorSpace = THREE.SRGBColorSpace;
  wallpaperMap.wrapS = THREE.RepeatWrapping;
  wallpaperMap.wrapT = THREE.ClampToEdgeWrapping;
  wallpaperMap.anisotropy = maxAnisotropy;

  // 2. Musty Moist Commercial Carpet
  const carpetCanvas = document.createElement('canvas');
  carpetCanvas.width = 512;
  carpetCanvas.height = 512;
  const cCtx = carpetCanvas.getContext('2d')!;
  cCtx.fillStyle = '#685f40';
  cCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    cCtx.fillStyle = Math.random() > 0.5 ? 'rgba(44, 39, 24, 0.32)' : 'rgba(130, 120, 82, 0.22)';
    cCtx.fillRect(px, py, 3, 2);
  }
  for (let i = 0; i < 22; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 512;
    const sr = 24 + Math.random() * 55;
    const sGrad = cCtx.createRadialGradient(sx, sy, 2, sx, sy, sr);
    sGrad.addColorStop(0, 'rgba(28, 24, 14, 0.34)');
    sGrad.addColorStop(1, 'rgba(28, 24, 14, 0)');
    cCtx.fillStyle = sGrad;
    cCtx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  const carpetMap = new THREE.CanvasTexture(carpetCanvas);
  carpetMap.colorSpace = THREE.SRGBColorSpace;
  carpetMap.wrapS = THREE.RepeatWrapping;
  carpetMap.wrapT = THREE.RepeatWrapping;
  carpetMap.repeat.set(19, 19);
  carpetMap.anisotropy = maxAnisotropy;

  // 3. Acoustic Ceiling Tiles
  const ceilCanvas = document.createElement('canvas');
  ceilCanvas.width = 512;
  ceilCanvas.height = 512;
  const tCtx = ceilCanvas.getContext('2d')!;
  tCtx.fillStyle = '#8b8876';
  tCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3200; i++) {
    tCtx.fillStyle = Math.random() > 0.5 ? 'rgba(50,48,40,0.22)' : 'rgba(210,206,188,0.16)';
    tCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  tCtx.strokeStyle = '#3d3c34';
  tCtx.lineWidth = 6;
  for (let g = 0; g <= 512; g += 128) {
    tCtx.beginPath();
    tCtx.moveTo(g, 0);
    tCtx.lineTo(g, 512);
    tCtx.stroke();
    tCtx.beginPath();
    tCtx.moveTo(0, g);
    tCtx.lineTo(512, g);
    tCtx.stroke();
  }

  const ceilingMap = new THREE.CanvasTexture(ceilCanvas);
  ceilingMap.colorSpace = THREE.SRGBColorSpace;
  ceilingMap.wrapS = THREE.RepeatWrapping;
  ceilingMap.wrapT = THREE.RepeatWrapping;
  ceilingMap.repeat.set(19, 19);
  ceilingMap.anisotropy = maxAnisotropy;

  // 4. Brushed Industrial Steel
  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = 256;
  metalCanvas.height = 256;
  const mCtx = metalCanvas.getContext('2d')!;
  mCtx.fillStyle = '#4c5258';
  mCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    mCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    mCtx.fillRect(0, y, 256, 1);
  }

  const metalMap = new THREE.CanvasTexture(metalCanvas);
  metalMap.colorSpace = THREE.SRGBColorSpace;
  metalMap.wrapS = THREE.RepeatWrapping;
  metalMap.wrapT = THREE.RepeatWrapping;
  metalMap.anisotropy = maxAnisotropy;

  // 5. Industrial Poured Concrete Floor Slabs (Power Room, Key Vault, Office, Exit Hall)
  const concreteCanvas = document.createElement('canvas');
  concreteCanvas.width = 512;
  concreteCanvas.height = 512;
  const kCtx = concreteCanvas.getContext('2d')!;
  kCtx.fillStyle = '#4f5357';
  kCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    kCtx.fillStyle = Math.random() > 0.5 ? 'rgba(24, 26, 28, 0.28)' : 'rgba(138, 144, 150, 0.16)';
    kCtx.fillRect(px, py, 2 + Math.random() * 2, 2);
  }
  // Slab expansion seams
  kCtx.strokeStyle = 'rgba(20, 22, 24, 0.55)';
  kCtx.lineWidth = 4;
  kCtx.strokeRect(2, 2, 508, 508);
  kCtx.lineWidth = 2;
  kCtx.beginPath();
  kCtx.moveTo(256, 0);
  kCtx.lineTo(256, 512);
  kCtx.moveTo(0, 256);
  kCtx.lineTo(512, 256);
  kCtx.stroke();
  // Subtle damp oil/water stains
  for (let i = 0; i < 14; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 512;
    const sr = 20 + Math.random() * 48;
    const grad = kCtx.createRadialGradient(sx, sy, 2, sx, sy, sr);
    grad.addColorStop(0, 'rgba(18, 20, 22, 0.34)');
    grad.addColorStop(1, 'rgba(18, 20, 22, 0)');
    kCtx.fillStyle = grad;
    kCtx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  const concreteMap = new THREE.CanvasTexture(concreteCanvas);
  concreteMap.colorSpace = THREE.SRGBColorSpace;
  concreteMap.wrapS = THREE.RepeatWrapping;
  concreteMap.wrapT = THREE.RepeatWrapping;
  concreteMap.anisotropy = maxAnisotropy;

  // 6. Industrial Bolted Diamond-Plate Steel Floor Texture
  const mfCanvas = document.createElement('canvas');
  mfCanvas.width = 512;
  mfCanvas.height = 512;
  const mfCtx = mfCanvas.getContext('2d')!;
  mfCtx.fillStyle = '#31363d';
  mfCtx.fillRect(0, 0, 512, 512);

  // Brushed dark metal grain
  for (let i = 0; i < 3600; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    mfCtx.fillStyle = Math.random() > 0.5 ? 'rgba(18, 21, 26, 0.35)' : 'rgba(110, 120, 134, 0.16)';
    mfCtx.fillRect(px, py, 3 + Math.random() * 6, 1);
  }
  // Raised diamond-plate tread pattern
  for (let y = 16; y < 512; y += 32) {
    for (let x = 16; x < 512; x += 32) {
      const diag = ((x + y) / 32) % 2 === 0;
      mfCtx.save();
      mfCtx.translate(x, y);
      mfCtx.rotate(diag ? Math.PI / 4 : -Math.PI / 4);
      mfCtx.fillStyle = 'rgba(148, 158, 172, 0.32)';
      mfCtx.fillRect(-7, -2, 14, 4);
      mfCtx.fillStyle = 'rgba(14, 16, 20, 0.45)';
      mfCtx.fillRect(-7, 2, 14, 2);
      mfCtx.restore();
    }
  }
  // Welded steel plate seams & corner bolts
  mfCtx.strokeStyle = 'rgba(12, 14, 18, 0.72)';
  mfCtx.lineWidth = 4;
  mfCtx.strokeRect(2, 2, 508, 508);
  mfCtx.beginPath();
  mfCtx.moveTo(256, 0);
  mfCtx.lineTo(256, 512);
  mfCtx.moveTo(0, 256);
  mfCtx.lineTo(512, 256);
  mfCtx.stroke();
  const boltOffsets = [18, 238, 274, 494];
  for (const bx of boltOffsets) {
    for (const by of boltOffsets) {
      mfCtx.fillStyle = '#5a626e';
      mfCtx.beginPath();
      mfCtx.arc(bx, by, 4.2, 0, Math.PI * 2);
      mfCtx.fill();
      mfCtx.strokeStyle = 'rgba(12, 14, 18, 0.75)';
      mfCtx.lineWidth = 1.4;
      mfCtx.stroke();
    }
  }
  // Subtle industrial rust & oil patina
  for (let i = 0; i < 10; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 512;
    const sr = 18 + Math.random() * 44;
    const grad = mfCtx.createRadialGradient(sx, sy, 2, sx, sy, sr);
    grad.addColorStop(0, 'rgba(72, 42, 24, 0.28)');
    grad.addColorStop(1, 'rgba(72, 42, 24, 0)');
    mfCtx.fillStyle = grad;
    mfCtx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  const metalFloorMap = new THREE.CanvasTexture(mfCanvas);
  metalFloorMap.colorSpace = THREE.SRGBColorSpace;
  metalFloorMap.wrapS = THREE.RepeatWrapping;
  metalFloorMap.wrapT = THREE.RepeatWrapping;
  metalFloorMap.anisotropy = maxAnisotropy;

  // 6b. Aged, Warped Squeaky Wood Floorboards
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 512;
  woodCanvas.height = 512;
  const wdCtx = woodCanvas.getContext('2d')!;
  wdCtx.fillStyle = '#473322';
  wdCtx.fillRect(0, 0, 512, 512);

  const plankHeight = 64;
  for (let row = 0; row < 8; row++) {
    const py = row * plankHeight;
    const toneShift = ((row * 37) % 19) - 9;
    wdCtx.fillStyle = `rgb(${74 + toneShift}, ${53 + Math.round(toneShift * 0.7)}, ${34 + Math.round(toneShift * 0.5)})`;
    wdCtx.fillRect(0, py + 2, 512, plankHeight - 3);

    // Longitudinal wood grain streaks
    for (let g = 0; g < 180; g++) {
      const gx = Math.random() * 512;
      const gy = py + 3 + Math.random() * (plankHeight - 6);
      const len = 18 + Math.random() * 64;
      wdCtx.fillStyle =
        Math.random() > 0.45 ? 'rgba(32, 20, 12, 0.24)' : 'rgba(116, 86, 56, 0.14)';
      wdCtx.fillRect(gx, gy, len, 1.5);
    }

    // Staggered plank end joint & rusted nail heads
    const jointX = ((row * 173 + 96) % 420) + 46;
    wdCtx.fillStyle = 'rgba(16, 11, 7, 0.85)';
    wdCtx.fillRect(jointX, py, 3, plankHeight);
    for (const nailX of [jointX - 10, jointX + 12]) {
      for (const nailY of [py + 14, py + plankHeight - 14]) {
        wdCtx.fillStyle = '#201b17';
        wdCtx.beginPath();
        wdCtx.arc(nailX, nailY, 2.3, 0, Math.PI * 2);
        wdCtx.fill();
      }
    }

    // Dark warped gap seam between planks
    wdCtx.fillStyle = '#18110b';
    wdCtx.fillRect(0, py, 512, 3);
  }
  // Musty moisture stains across old floorboards
  for (let i = 0; i < 12; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 512;
    const sr = 22 + Math.random() * 48;
    const wGrad = wdCtx.createRadialGradient(sx, sy, 2, sx, sy, sr);
    wGrad.addColorStop(0, 'rgba(18, 13, 8, 0.36)');
    wGrad.addColorStop(1, 'rgba(18, 13, 8, 0)');
    wdCtx.fillStyle = wGrad;
    wdCtx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  const woodFloorMap = new THREE.CanvasTexture(woodCanvas);
  woodFloorMap.colorSpace = THREE.SRGBColorSpace;
  woodFloorMap.wrapS = THREE.RepeatWrapping;
  woodFloorMap.wrapT = THREE.RepeatWrapping;
  woodFloorMap.anisotropy = maxAnisotropy;

  // 7. Linear-Space Bump / Relief Maps for realistic flashlight & rim-light specular depth
  // 7a. Wallpaper vertical rib & baseboard relief
  const wallBumpCanvas = document.createElement('canvas');
  wallBumpCanvas.width = 512;
  wallBumpCanvas.height = 512;
  const wbCtx = wallBumpCanvas.getContext('2d')!;
  wbCtx.fillStyle = '#808080';
  wbCtx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32) {
    wbCtx.fillStyle = x % 64 === 0 ? '#9c9c9c' : '#6c6c6c';
    wbCtx.fillRect(x, 0, 14, 476);
    wbCtx.fillStyle = '#484848';
    wbCtx.fillRect(x + 14, 0, 2, 476);
  }
  for (let i = 0; i < 1800; i++) {
    wbCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    wbCtx.fillRect(Math.random() * 512, Math.random() * 476, 3, 4);
  }
  wbCtx.fillStyle = '#c8c8c8';
  wbCtx.fillRect(0, 474, 512, 6);
  wbCtx.fillStyle = '#a8a8a8';
  wbCtx.fillRect(0, 480, 512, 32);

  const wallpaperBumpMap = new THREE.CanvasTexture(wallBumpCanvas);
  wallpaperBumpMap.colorSpace = THREE.NoColorSpace;
  wallpaperBumpMap.wrapS = THREE.RepeatWrapping;
  wallpaperBumpMap.wrapT = THREE.ClampToEdgeWrapping;
  wallpaperBumpMap.anisotropy = maxAnisotropy;

  // 7b. Commercial carpet nap weave bump
  const carpetBumpCanvas = document.createElement('canvas');
  carpetBumpCanvas.width = 256;
  carpetBumpCanvas.height = 256;
  const cbCtx = carpetBumpCanvas.getContext('2d')!;
  cbCtx.fillStyle = '#787878';
  cbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    cbCtx.fillStyle = Math.random() > 0.5 ? '#a2a2a2' : '#4a4a4a';
    cbCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const carpetBumpMap = new THREE.CanvasTexture(carpetBumpCanvas);
  carpetBumpMap.colorSpace = THREE.NoColorSpace;
  carpetBumpMap.wrapS = THREE.RepeatWrapping;
  carpetBumpMap.wrapT = THREE.RepeatWrapping;
  carpetBumpMap.repeat.set(19, 19);
  carpetBumpMap.anisotropy = maxAnisotropy;

  // 7c. Concrete pitted slab & seam bump
  const concBumpCanvas = document.createElement('canvas');
  concBumpCanvas.width = 256;
  concBumpCanvas.height = 256;
  const kbCtx = concBumpCanvas.getContext('2d')!;
  kbCtx.fillStyle = '#868686';
  kbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2800; i++) {
    kbCtx.fillStyle = Math.random() > 0.45 ? '#9e9e9e' : '#525252';
    kbCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  kbCtx.strokeStyle = '#282828';
  kbCtx.lineWidth = 3;
  kbCtx.strokeRect(1, 1, 254, 254);
  kbCtx.beginPath();
  kbCtx.moveTo(128, 0);
  kbCtx.lineTo(128, 256);
  kbCtx.moveTo(0, 128);
  kbCtx.lineTo(256, 128);
  kbCtx.stroke();
  const concreteBumpMap = new THREE.CanvasTexture(concBumpCanvas);
  concreteBumpMap.colorSpace = THREE.NoColorSpace;
  concreteBumpMap.wrapS = THREE.RepeatWrapping;
  concreteBumpMap.wrapT = THREE.RepeatWrapping;
  concreteBumpMap.anisotropy = maxAnisotropy;

  // 7d. Raised diamond-plate & rivet metal floor bump
  const mfBumpCanvas = document.createElement('canvas');
  mfBumpCanvas.width = 512;
  mfBumpCanvas.height = 512;
  const mfbCtx = mfBumpCanvas.getContext('2d')!;
  mfbCtx.fillStyle = '#585858';
  mfbCtx.fillRect(0, 0, 512, 512);
  for (let y = 16; y < 512; y += 32) {
    for (let x = 16; x < 512; x += 32) {
      const diag = ((x + y) / 32) % 2 === 0;
      mfbCtx.save();
      mfbCtx.translate(x, y);
      mfbCtx.rotate(diag ? Math.PI / 4 : -Math.PI / 4);
      mfbCtx.fillStyle = '#e0e0e0';
      mfbCtx.fillRect(-7, -2, 14, 4);
      mfbCtx.restore();
    }
  }
  mfbCtx.strokeStyle = '#242424';
  mfbCtx.lineWidth = 4;
  mfbCtx.strokeRect(2, 2, 508, 508);
  for (const bx of boltOffsets) {
    for (const by of boltOffsets) {
      mfbCtx.fillStyle = '#f2f2f2';
      mfbCtx.beginPath();
      mfbCtx.arc(bx, by, 4.2, 0, Math.PI * 2);
      mfbCtx.fill();
    }
  }
  const metalFloorBumpMap = new THREE.CanvasTexture(mfBumpCanvas);
  metalFloorBumpMap.colorSpace = THREE.NoColorSpace;
  metalFloorBumpMap.wrapS = THREE.RepeatWrapping;
  metalFloorBumpMap.wrapT = THREE.RepeatWrapping;
  metalFloorBumpMap.anisotropy = maxAnisotropy;

  // 7e. Acoustic Ceiling recessed grid bump
  const ceilBumpCanvas = document.createElement('canvas');
  ceilBumpCanvas.width = 256;
  ceilBumpCanvas.height = 256;
  const tbCtx = ceilBumpCanvas.getContext('2d')!;
  tbCtx.fillStyle = '#888888';
  tbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    tbCtx.fillStyle = '#5a5a5a';
    tbCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  tbCtx.strokeStyle = '#cacaca';
  tbCtx.lineWidth = 4;
  for (let g = 0; g <= 256; g += 64) {
    tbCtx.beginPath();
    tbCtx.moveTo(g, 0);
    tbCtx.lineTo(g, 256);
    tbCtx.stroke();
    tbCtx.beginPath();
    tbCtx.moveTo(0, g);
    tbCtx.lineTo(256, g);
    tbCtx.stroke();
  }
  const ceilingBumpMap = new THREE.CanvasTexture(ceilBumpCanvas);
  ceilingBumpMap.colorSpace = THREE.NoColorSpace;
  ceilingBumpMap.wrapS = THREE.RepeatWrapping;
  ceilingBumpMap.wrapT = THREE.RepeatWrapping;
  ceilingBumpMap.repeat.set(19, 19);
  ceilingBumpMap.anisotropy = maxAnisotropy;

  // 7f. Linear plank-groove & grain relief for Squeaky Wood Floorboards
  const wdBumpCanvas = document.createElement('canvas');
  wdBumpCanvas.width = 256;
  wdBumpCanvas.height = 256;
  const wdbCtx = wdBumpCanvas.getContext('2d')!;
  wdbCtx.fillStyle = '#9a9a9a';
  wdbCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const py = row * 32;
    for (let g = 0; g < 110; g++) {
      wdbCtx.fillStyle = Math.random() > 0.5 ? '#b4b4b4' : '#767676';
      wdbCtx.fillRect(Math.random() * 256, py + 2 + Math.random() * 28, 12 + Math.random() * 34, 1);
    }
    const jointX = (((row * 173 + 96) % 420) + 46) * 0.5;
    wdbCtx.fillStyle = '#1f1f1f';
    wdbCtx.fillRect(jointX, py, 2, 32);
    wdbCtx.fillRect(0, py, 256, 2);
  }
  const woodFloorBumpMap = new THREE.CanvasTexture(wdBumpCanvas);
  woodFloorBumpMap.colorSpace = THREE.NoColorSpace;
  woodFloorBumpMap.wrapS = THREE.RepeatWrapping;
  woodFloorBumpMap.wrapT = THREE.RepeatWrapping;
  woodFloorBumpMap.anisotropy = maxAnisotropy;

  // 8. Soft Radial Atmospheric Dust Mote Sprite
  const dustCanvas = document.createElement('canvas');
  dustCanvas.width = 64;
  dustCanvas.height = 64;
  const dCtx = dustCanvas.getContext('2d')!;
  const dGrad = dCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  dGrad.addColorStop(0, 'rgba(255, 246, 214, 0.95)');
  dGrad.addColorStop(0.45, 'rgba(235, 220, 175, 0.42)');
  dGrad.addColorStop(1, 'rgba(235, 220, 175, 0)');
  dCtx.fillStyle = dGrad;
  dCtx.fillRect(0, 0, 64, 64);
  const dustMoteMap = new THREE.CanvasTexture(dustCanvas);
  dustMoteMap.colorSpace = THREE.SRGBColorSpace;

  return {
    wallpaperMap,
    wallpaperBumpMap,
    carpetMap,
    carpetBumpMap,
    concreteMap,
    concreteBumpMap,
    metalFloorMap,
    metalFloorBumpMap,
    woodFloorMap,
    woodFloorBumpMap,
    ceilingMap,
    ceilingBumpMap,
    metalMap,
    dustMoteMap,
    dispose: () => {
      wallpaperMap.dispose();
      wallpaperBumpMap.dispose();
      carpetMap.dispose();
      carpetBumpMap.dispose();
      concreteMap.dispose();
      concreteBumpMap.dispose();
      metalFloorMap.dispose();
      metalFloorBumpMap.dispose();
      woodFloorMap.dispose();
      woodFloorBumpMap.dispose();
      ceilingMap.dispose();
      ceilingBumpMap.dispose();
      metalMap.dispose();
      dustMoteMap.dispose();
    },
  };
}

export interface StalkerRig {
  group: THREE.Group;
  pelvisGroup: THREE.Group;
  torsoGroup: THREE.Group;
  neckGroup: THREE.Group;
  headGroup: THREE.Group;
  jawGroup: THREE.Group;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  leftWrist: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  rightWrist: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  leftAnkle: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  rightAnkle: THREE.Group;
  tendrils: THREE.Group[];
  whiteFaceMats: THREE.MeshBasicMaterial[];
  animations: THREE.AnimationClip[];
  dispose: () => void;
}

interface StalkerTextureBundle {
  decayedAlbedo: THREE.CanvasTexture;
  decayedRoughness: THREE.CanvasTexture;
  decayedBump: THREE.CanvasTexture;
  boneAlbedo: THREE.CanvasTexture;
  boneRoughness: THREE.CanvasTexture;
  boneBump: THREE.CanvasTexture;
  dispose: () => void;
}

function createStalkerPbrTextures(): StalkerTextureBundle {
  // 2048x2048 (2K) High-Resolution Decayed Charcoal-Black Flesh PBR Set
  const size = 2048;
  const albCanvas = document.createElement('canvas');
  albCanvas.width = size;
  albCanvas.height = size;
  const aCtx = albCanvas.getContext('2d')!;

  const rghCanvas = document.createElement('canvas');
  rghCanvas.width = size;
  rghCanvas.height = size;
  const rCtx = rghCanvas.getContext('2d')!;

  const bmpCanvas = document.createElement('canvas');
  bmpCanvas.width = size;
  bmpCanvas.height = size;
  const bCtx = bmpCanvas.getContext('2d')!;

  // Base charcoal-black organic surface
  aCtx.fillStyle = '#141416';
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#dadada'; // ~0.85 base matte dead skin roughness
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Mottled necrotic charcoal-gray patches & bruised soot depth
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 28 + Math.random() * 140;
    const isDarker = Math.random() > 0.45;

    const aGrad = aCtx.createRadialGradient(x, y, 2, x, y, rad);
    aGrad.addColorStop(
      0,
      isDarker ? 'rgba(8, 8, 10, 0.55)' : 'rgba(42, 41, 44, 0.34)',
    );
    aGrad.addColorStop(1, 'rgba(20, 20, 22, 0)');
    aCtx.fillStyle = aGrad;
    aCtx.fillRect(x - rad, y - rad, rad * 2, rad * 2);

    const bGrad = bCtx.createRadialGradient(x, y, 2, x, y, rad);
    bGrad.addColorStop(0, isDarker ? 'rgba(62, 62, 62, 0.35)' : 'rgba(170, 170, 170, 0.28)');
    bGrad.addColorStop(1, 'rgba(128, 128, 128, 0)');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Fibrous muscle striations & cracked leathery skin pores
  for (let i = 0; i < 9500; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const w = 1.5 + Math.random() * 5;
    const h = 8 + Math.random() * 44;
    const shade = Math.random();
    aCtx.fillStyle =
      shade < 0.55
        ? 'rgba(7, 7, 9, 0.44)'
        : shade < 0.9
          ? 'rgba(56, 54, 58, 0.24)'
          : 'rgba(74, 15, 18, 0.22)';
    aCtx.fillRect(px, py, w, h);

    bCtx.fillStyle = shade < 0.55 ? 'rgba(45, 45, 45, 0.34)' : 'rgba(195, 195, 195, 0.25)';
    bCtx.fillRect(px, py, w, h);
  }

  // Subtle dark crimson tissue fissures & arterial veins tucked into darker crevices
  for (let v = 0; v < 210; v++) {
    let cx = Math.random() * size;
    let cy = Math.random() * size;
    const segs = 5 + Math.floor(Math.random() * 7);
    const width = 1.6 + Math.random() * 4.5;

    aCtx.strokeStyle =
      Math.random() > 0.35 ? 'rgba(96, 14, 18, 0.46)' : 'rgba(136, 22, 26, 0.34)';
    aCtx.lineWidth = width;
    rCtx.strokeStyle = 'rgba(92, 92, 92, 0.62)'; // wetter specular glint inside crimson tears
    rCtx.lineWidth = width * 1.6;
    bCtx.strokeStyle = 'rgba(32, 32, 32, 0.52)'; // recessed groove
    bCtx.lineWidth = width * 1.4;

    aCtx.beginPath();
    rCtx.beginPath();
    bCtx.beginPath();
    aCtx.moveTo(cx, cy);
    rCtx.moveTo(cx, cy);
    bCtx.moveTo(cx, cy);
    for (let s = 0; s < segs; s++) {
      cx += (Math.random() - 0.5) * 85;
      cy += 18 + Math.random() * 68;
      aCtx.lineTo(cx, cy);
      rCtx.lineTo(cx, cy);
      bCtx.lineTo(cx, cy);
    }
    aCtx.stroke();
    rCtx.stroke();
    bCtx.stroke();
  }

  const decayedAlbedo = new THREE.CanvasTexture(albCanvas);
  decayedAlbedo.colorSpace = THREE.SRGBColorSpace;
  decayedAlbedo.wrapS = THREE.RepeatWrapping;
  decayedAlbedo.wrapT = THREE.RepeatWrapping;
  decayedAlbedo.anisotropy = 4;

  const decayedRoughness = new THREE.CanvasTexture(rghCanvas);
  decayedRoughness.colorSpace = THREE.NoColorSpace;
  decayedRoughness.wrapS = THREE.RepeatWrapping;
  decayedRoughness.wrapT = THREE.RepeatWrapping;
  decayedRoughness.anisotropy = 4;

  const decayedBump = new THREE.CanvasTexture(bmpCanvas);
  decayedBump.colorSpace = THREE.NoColorSpace;
  decayedBump.wrapS = THREE.RepeatWrapping;
  decayedBump.wrapT = THREE.RepeatWrapping;
  decayedBump.anisotropy = 4;

  // 1024x1024 Weathered, Charcoal-Stained Calcified Bone PBR Set
  const bSize = 1024;
  const baCanvas = document.createElement('canvas');
  baCanvas.width = bSize;
  baCanvas.height = bSize;
  const baCtx = baCanvas.getContext('2d')!;

  const brCanvas = document.createElement('canvas');
  brCanvas.width = bSize;
  brCanvas.height = bSize;
  const brCtx = brCanvas.getContext('2d')!;

  const bbCanvas = document.createElement('canvas');
  bbCanvas.width = bSize;
  bbCanvas.height = bSize;
  const bbCtx = bbCanvas.getContext('2d')!;

  baCtx.fillStyle = '#605a50';
  baCtx.fillRect(0, 0, bSize, bSize);
  brCtx.fillStyle = '#9c9c9c'; // ~0.61 calcified bone roughness
  brCtx.fillRect(0, 0, bSize, bSize);
  bbCtx.fillStyle = '#888888';
  bbCtx.fillRect(0, 0, bSize, bSize);

  for (let i = 0; i < 4200; i++) {
    const px = Math.random() * bSize;
    const py = Math.random() * bSize;
    const len = 6 + Math.random() * 34;
    const roll = Math.random();
    baCtx.fillStyle =
      roll < 0.45
        ? 'rgba(30, 27, 24, 0.28)'
        : roll < 0.88
          ? 'rgba(132, 125, 112, 0.2)'
          : 'rgba(84, 22, 22, 0.22)';
    baCtx.fillRect(px, py, 1.5, len);
    bbCtx.fillStyle = roll < 0.5 ? 'rgba(52, 52, 52, 0.28)' : 'rgba(204, 204, 204, 0.22)';
    bbCtx.fillRect(px, py, 1.5, len);
  }
  // Hairline bone fractures
  for (let c = 0; c < 65; c++) {
    let cx = Math.random() * bSize;
    let cy = Math.random() * bSize;
    baCtx.strokeStyle = 'rgba(24, 20, 18, 0.55)';
    baCtx.lineWidth = 1.4;
    bbCtx.strokeStyle = 'rgba(22, 22, 22, 0.68)';
    bbCtx.lineWidth = 1.8;
    baCtx.beginPath();
    bbCtx.beginPath();
    baCtx.moveTo(cx, cy);
    bbCtx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += (Math.random() - 0.5) * 44;
      cy += 10 + Math.random() * 36;
      baCtx.lineTo(cx, cy);
      bbCtx.lineTo(cx, cy);
    }
    baCtx.stroke();
    bbCtx.stroke();
  }

  const boneAlbedo = new THREE.CanvasTexture(baCanvas);
  boneAlbedo.colorSpace = THREE.SRGBColorSpace;
  boneAlbedo.wrapS = THREE.RepeatWrapping;
  boneAlbedo.wrapT = THREE.RepeatWrapping;

  const boneRoughness = new THREE.CanvasTexture(brCanvas);
  boneRoughness.colorSpace = THREE.NoColorSpace;
  boneRoughness.wrapS = THREE.RepeatWrapping;
  boneRoughness.wrapT = THREE.RepeatWrapping;

  const boneBump = new THREE.CanvasTexture(bbCanvas);
  boneBump.colorSpace = THREE.NoColorSpace;
  boneBump.wrapS = THREE.RepeatWrapping;
  boneBump.wrapT = THREE.RepeatWrapping;

  return {
    decayedAlbedo,
    decayedRoughness,
    decayedBump,
    boneAlbedo,
    boneRoughness,
    boneBump,
    dispose: () => {
      decayedAlbedo.dispose();
      decayedRoughness.dispose();
      decayedBump.dispose();
      boneAlbedo.dispose();
      boneRoughness.dispose();
      boneBump.dispose();
    },
  };
}

function buildStalkerAnimationClips(): THREE.AnimationClip[] {
  // 1. Unsettling Idle Animation (2.4s loop)
  const idleTimes = [0, 0.6, 1.2, 1.8, 2.4];
  const idleClip = new THREE.AnimationClip('Idle', 2.4, [
    new THREE.NumberKeyframeTrack('Torso.rotation[x]', idleTimes, [0.14, 0.17, 0.14, 0.11, 0.14]),
    new THREE.NumberKeyframeTrack('Head.rotation[z]', idleTimes, [0.18, 0.25, 0.16, 0.08, 0.18]),
    new THREE.NumberKeyframeTrack('Jaw.rotation[x]', idleTimes, [0.24, 0.34, 0.22, 0.3, 0.24]),
    new THREE.NumberKeyframeTrack('UpperArm_L.rotation[x]', idleTimes, [-0.1, -0.16, -0.1, -0.06, -0.1]),
    new THREE.NumberKeyframeTrack('UpperArm_R.rotation[x]', idleTimes, [-0.1, -0.06, -0.1, -0.16, -0.1]),
  ]);

  // 2. Stalking Walk Animation (1.2s loop)
  const walkTimes = [0, 0.3, 0.6, 0.9, 1.2];
  const walkClip = new THREE.AnimationClip('Walk', 1.2, [
    new THREE.NumberKeyframeTrack('Thigh_L.rotation[x]', walkTimes, [0, 0.48, 0, -0.48, 0]),
    new THREE.NumberKeyframeTrack('Shin_L.rotation[x]', walkTimes, [0.12, 0.06, 0.24, 0.56, 0.12]),
    new THREE.NumberKeyframeTrack('Thigh_R.rotation[x]', walkTimes, [0, -0.48, 0, 0.48, 0]),
    new THREE.NumberKeyframeTrack('Shin_R.rotation[x]', walkTimes, [0.24, 0.56, 0.12, 0.06, 0.24]),
    new THREE.NumberKeyframeTrack('UpperArm_L.rotation[x]', walkTimes, [-0.1, -0.34, -0.1, 0.18, -0.1]),
    new THREE.NumberKeyframeTrack('Forearm_L.rotation[x]', walkTimes, [-0.34, -0.22, -0.38, -0.52, -0.34]),
    new THREE.NumberKeyframeTrack('UpperArm_R.rotation[x]', walkTimes, [-0.1, 0.18, -0.1, -0.34, -0.1]),
    new THREE.NumberKeyframeTrack('Forearm_R.rotation[x]', walkTimes, [-0.38, -0.52, -0.34, -0.22, -0.38]),
    new THREE.NumberKeyframeTrack('Torso.rotation[x]', walkTimes, [0.14, 0.19, 0.13, 0.19, 0.14]),
  ]);

  return [idleClip, walkClip];
}

/**
 * Full-Body Articulated Charcoal-Black Skeletal Horror Creature (~2.68m tall, y=0 pivot).
 * Features 2K decayed charcoal PBR skin with subtle dark-crimson tissue fissures,
 * weathered exposed ribs, dorsal spine vertebrae, irregular bony formations,
 * connected shoulder/elbow/wrist/hip/knee/ankle joints, and Idle/Walk AnimationClips.
 */
export function createStalkerModel(): StalkerRig {
  const group = new THREE.Group();
  group.name = 'StalkerRoot';

  const tex = createStalkerPbrTextures();
  const createdGeometries: THREE.BufferGeometry[] = [];
  const createdMaterials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    createdGeometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    createdMaterials.push(m);
    return m;
  };

  // Decayed Charcoal-Black Organic Flesh PBR
  const decayedFleshMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b383b,
      map: tex.decayedAlbedo,
      roughnessMap: tex.decayedRoughness,
      bumpMap: tex.decayedBump,
      bumpScale: 0.055,
      roughness: 0.92,
      metalness: 0.04,
      envMapIntensity: 0.14,
    }),
  );

  // Darker Charred Sinew / Limb Skin PBR
  const charredLimbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x201f22,
      map: tex.decayedAlbedo,
      roughnessMap: tex.decayedRoughness,
      bumpMap: tex.decayedBump,
      bumpScale: 0.048,
      roughness: 0.94,
      metalness: 0.03,
      envMapIntensity: 0.12,
    }),
  );

  // Exposed Calcified Bone Structure PBR (ribs, spine, joints, skull ridges, claws)
  const exposedBoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x777064,
      map: tex.boneAlbedo,
      roughnessMap: tex.boneRoughness,
      bumpMap: tex.boneBump,
      bumpScale: 0.042,
      roughness: 0.64,
      metalness: 0.05,
      envMapIntensity: 0.18,
    }),
  );

  // Deep Dried-Crimson Sinew & Ligament Crevice Material
  const crimsonSinewMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3a0c0f,
      bumpMap: tex.decayedBump,
      bumpScale: 0.03,
      roughness: 0.44,
      metalness: 0.06,
      envMapIntensity: 0.16,
    }),
  );

  const eyeSocketMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x020202 }));
  const whiteEyeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfff3e6,
      fog: false,
      transparent: true,
      opacity: 0.96,
    }),
  );
  const whiteMouthMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xbcb4a6,
      fog: false,
      transparent: true,
      opacity: 0.78,
    }),
  );
  const blackVoidMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x010102,
      fog: false,
    }),
  );

  // 1. Pelvis & Iliac Bone Crests (y = 1.24)
  const pelvisGroup = new THREE.Group();
  pelvisGroup.name = 'Pelvis';
  pelvisGroup.position.set(0, 1.24, 0);
  group.add(pelvisGroup);

  const pelvisCore = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.16, 16, 12)), charredLimbMat);
  pelvisCore.scale.set(1.08, 0.84, 0.72);
  pelvisCore.castShadow = true;
  pelvisGroup.add(pelvisCore);

  // Jagged iliac crests & bony hip sockets
  for (const side of [-1, 1] as const) {
    const iliacCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.02, -0.09),
      new THREE.Vector3(side * 0.12, 0.07, -0.04),
      new THREE.Vector3(side * 0.175, 0.04, 0.06),
      new THREE.Vector3(side * 0.12, -0.06, 0.04),
    ]);
    const iliacBone = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(iliacCurve, 10, 0.024, 7, false)),
      exposedBoneMat,
    );
    iliacBone.castShadow = true;
    pelvisGroup.add(iliacBone);

    // Subtle crimson hip ligament
    const hipLigament = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 6)),
      crimsonSinewMat,
    );
    hipLigament.position.set(side * 0.11, -0.02, 0.08);
    hipLigament.rotation.z = side * 0.35;
    pelvisGroup.add(hipLigament);
  }

  // 2. Sunken Charcoal Torso + Exposed Ribcage + Jagged Dorsal Spine
  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'Torso';
  torsoGroup.position.set(0, 0.05, 0);
  pelvisGroup.add(torsoGroup);

  const torsoProfile = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.135, 0.05),
    new THREE.Vector2(0.092, 0.24), // deeply emaciated sunken waist
    new THREE.Vector2(0.118, 0.4),
    new THREE.Vector2(0.215, 0.64), // flared hollow chest
    new THREE.Vector2(0.242, 0.84), // gaunt asymmetric shoulders
    new THREE.Vector2(0.145, 0.96),
    new THREE.Vector2(0.068, 1.03),
    new THREE.Vector2(0.01, 1.06),
  ];
  const torsoMesh = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(torsoProfile, 22)),
    decayedFleshMat,
  );
  torsoMesh.scale.set(1.06, 1.0, 0.64);
  torsoMesh.rotation.x = 0.2;
  torsoMesh.position.set(0, 0, 0.055);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Recessed dark-crimson sternum & intercostal cavity backing
  const sternumCavity = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.085, 0.06, 0.42, 12)),
    crimsonSinewMat,
  );
  sternumCavity.scale.set(1.0, 1.0, 0.42);
  sternumCavity.position.set(0, 0.68, 0.155);
  sternumCavity.rotation.x = 0.16;
  torsoGroup.add(sternumCavity);

  // Fractured irregular central sternum bone plate
  const sternumBone = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.022, 0.013, 0.36, 7)),
    exposedBoneMat,
  );
  sternumBone.scale.set(1.2, 1.0, 0.55);
  sternumBone.position.set(0.004, 0.72, 0.215);
  sternumBone.rotation.set(0.18, 0, -0.04);
  torsoGroup.add(sternumBone);

  // 7 pairs of asymmetric jagged exposed ribs curving around the gaunt chest
  for (let r = 0; r < 7; r++) {
    const ry = 0.43 + r * 0.068;
    const width = 0.145 + Math.sin((r / 6) * Math.PI) * 0.085;
    const zChest = 0.155 + (r / 6) * 0.055;
    for (const side of [-1, 1] as const) {
      // Intentional slight fracture asymmetry on left/right rib arches
      const skew = side === -1 && r === 2 ? -0.018 : side === 1 && r === 4 ? 0.015 : 0;
      const ribCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.02, ry + 0.025, -0.03),
        new THREE.Vector3(side * width, ry + 0.01 + skew, 0.06),
        new THREE.Vector3(side * width * 0.62, ry - 0.025, zChest),
        new THREE.Vector3(side * (r < 2 ? 0.055 : 0.018), ry - 0.035 + skew, zChest + 0.025),
      ]);
      const ribMesh = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(ribCurve, 12, 0.0115 - r * 0.0004, 6, false)),
        exposedBoneMat,
      );
      ribMesh.castShadow = true;
      torsoGroup.add(ribMesh);
    }
  }

  // Protruding Dorsal Spine Column + 11 Jagged Vertebrae Spikes along hunched back
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.04, -0.04),
    new THREE.Vector3(0, 0.34, -0.055),
    new THREE.Vector3(0, 0.68, -0.015),
    new THREE.Vector3(0, 0.98, 0.085),
  ]);
  const spineCord = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(spineCurve, 16, 0.026, 7, false)),
    exposedBoneMat,
  );
  spineCord.castShadow = true;
  torsoGroup.add(spineCord);

  for (let v = 0; v < 11; v++) {
    const t = v / 10;
    const pt = spineCurve.getPoint(t);
    const vertebra = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.018 + (1 - Math.abs(t - 0.6)) * 0.008, 0.068, 5)),
      exposedBoneMat,
    );
    vertebra.position.set(pt.x + (v % 2 === 0 ? 0.004 : -0.004), pt.y, pt.z - 0.028);
    vertebra.rotation.x = -Math.PI * 0.58;
    vertebra.rotation.z = (v % 3 - 1) * 0.09;
    torsoGroup.add(vertebra);
  }

  // Jagged Asymmetric Collarbones & Protruding Scapula Bone Spurs
  for (const side of [-1, 1] as const) {
    const collarCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.92, 0.19),
      new THREE.Vector3(side * 0.13, 0.965 + (side > 0 ? 0.018 : 0), 0.155),
      new THREE.Vector3(side * 0.275, 0.915, 0.075),
    ]);
    const collar = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(collarCurve, 10, 0.017, 6, false)),
      exposedBoneMat,
    );
    torsoGroup.add(collar);

    const scapulaSpur = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.032, 0.16, 5)),
      exposedBoneMat,
    );
    scapulaSpur.position.set(side * 0.18, 0.84, -0.045);
    scapulaSpur.rotation.set(-0.85, 0, side * -0.45);
    torsoGroup.add(scapulaSpur);
  }

  // Subtle Dark Tendrils behind shoulders
  const tendrils: THREE.Group[] = [];
  const tendrilSpecs = [
    { x: -0.2, y: 0.9, z: -0.05, rz: 0.42, rx: -0.35, len: 0.58 },
    { x: 0.2, y: 0.9, z: -0.05, rz: -0.42, rx: -0.35, len: 0.58 },
    { x: -0.12, y: 0.65, z: -0.08, rz: 0.6, rx: -0.48, len: 0.46 },
    { x: 0.12, y: 0.65, z: -0.08, rz: -0.6, rx: -0.48, len: 0.46 },
  ];
  for (const spec of tendrilSpecs) {
    const tGroup = new THREE.Group();
    tGroup.position.set(spec.x, spec.y, spec.z);
    tGroup.rotation.set(spec.rx, 0, spec.rz);
    const wispCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, spec.len * 0.5, -0.05),
      new THREE.Vector3(0, spec.len, 0.04),
    ]);
    const wisp = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(wispCurve, 10, 0.012, 5, false)),
      charredLimbMat,
    );
    tGroup.add(wisp);
    torsoGroup.add(tGroup);
    tendrils.push(tGroup);
  }

  // 3. Gaunt Forward-Craning Neck & Decayed Skeletal Skull
  const neckGroup = new THREE.Group();
  neckGroup.name = 'Neck';
  neckGroup.position.set(0, 0.98, 0.16);
  torsoGroup.add(neckGroup);

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.02, -0.02),
    new THREE.Vector3(0, 0.12, 0.06),
    new THREE.Vector3(0, 0.24, 0.13),
  ]);
  const neckColumn = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(neckCurve, 10, 0.048, 8, false)),
    decayedFleshMat,
  );
  neckColumn.castShadow = true;
  neckGroup.add(neckColumn);

  // Exposed cervical vertebrae rings & taut crimson sternocleidomastoid tendons
  for (let c = 0; c < 4; c++) {
    const pt = neckCurve.getPoint(0.18 + c * 0.24);
    const cVertebra = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.028, 7, 6)),
      exposedBoneMat,
    );
    cVertebra.scale.set(0.9, 0.65, 1.35);
    cVertebra.position.set(0, pt.y, pt.z - 0.028);
    neckGroup.add(cVertebra);
  }
  for (const side of [-1, 1] as const) {
    const neckTendon = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.008, 0.011, 0.24, 5)),
      crimsonSinewMat,
    );
    neckTendon.position.set(side * 0.042, 0.11, 0.075);
    neckTendon.rotation.set(0.45, 0, side * -0.18);
    neckGroup.add(neckTendon);
  }

  const headGroup = new THREE.Group();
  headGroup.name = 'Head';
  headGroup.position.set(0, 0.24, 0.13);
  neckGroup.add(headGroup);

  const cranium = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.168, 22, 18)),
    decayedFleshMat,
  );
  cranium.scale.set(0.82, 1.06, 1.04);
  cranium.position.set(0, 0.14, 0.03);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Exposed temporal & brow bone ridges
  const browRidge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.21, 0.028, 0.08)),
    exposedBoneMat,
  );
  browRidge.position.set(0, 0.175, 0.142);
  browRidge.rotation.x = 0.14;
  headGroup.add(browRidge);

  const faceMask = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.13, 16, 14)),
    charredLimbMat,
  );
  faceMask.scale.set(0.84, 1.24, 0.84);
  faceMask.position.set(0, 0.04, 0.055);
  headGroup.add(faceMask);

  for (const side of [-1, 1] as const) {
    const cheek = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.048, 10, 10)),
      exposedBoneMat,
    );
    cheek.scale.set(0.75, 1.12, 0.88);
    cheek.position.set(side * 0.076, 0.055, 0.115);
    headGroup.add(cheek);

    // Sunken black eye sockets + 2 tiny pinpoint staring eyes
    const socket = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.046, 12, 10)),
      eyeSocketMat,
    );
    socket.scale.set(1.0, 1.15, 0.55);
    socket.position.set(side * 0.054, 0.135, 0.165);
    headGroup.add(socket);

    const pinpointEye = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.012, 10, 10)),
      whiteEyeMat,
    );
    pinpointEye.position.set(side * 0.054, 0.135, 0.191);
    headGroup.add(pinpointEye);
  }

  // Torn nasal cavity fissure
  const nasalHole = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.018, 0.042, 4)),
    blackVoidMat,
  );
  nasalHole.position.set(0, 0.082, 0.184);
  nasalHole.rotation.x = -0.25;
  headGroup.add(nasalHole);

  // Vertically Stretched Screaming Chasm Mouth + Jagged Teeth
  const throatVoid = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.066, 0.05, 0.25, 16)),
    blackVoidMat,
  );
  throatVoid.scale.set(0.92, 1.0, 0.55);
  throatVoid.position.set(0, -0.055, 0.145);
  headGroup.add(throatVoid);

  const upperMouthArchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.07, -0.01, 0.148),
    new THREE.Vector3(-0.046, 0.045, 0.174),
    new THREE.Vector3(0, 0.062, 0.184),
    new THREE.Vector3(0.046, 0.045, 0.174),
    new THREE.Vector3(0.07, -0.01, 0.148),
  ]);
  const upperMouthRim = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(upperMouthArchCurve, 14, 0.0085, 6, false)),
    whiteMouthMat,
  );
  headGroup.add(upperMouthRim);

  for (let t = -3; t <= 3; t++) {
    const tooth = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.0055, 0.022 + (Math.abs(t) % 2) * 0.006, 5)),
      whiteMouthMat,
    );
    tooth.position.set(t * 0.017, 0.036 - Math.abs(t) * 0.007, 0.176 - Math.abs(t) * 0.004);
    tooth.rotation.x = Math.PI;
    headGroup.add(tooth);
  }

  // Articulated Lower Jaw + Crimson Tendon Hinges
  const jawGroup = new THREE.Group();
  jawGroup.name = 'Jaw';
  jawGroup.position.set(0, -0.02, 0.07);
  headGroup.add(jawGroup);

  const jawArchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.074, 0.01, 0.06),
    new THREE.Vector3(-0.064, -0.11, 0.095),
    new THREE.Vector3(0, -0.178, 0.118),
    new THREE.Vector3(0.064, -0.11, 0.095),
    new THREE.Vector3(0.074, 0.01, 0.06),
  ]);
  const jawBone = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(jawArchCurve, 16, 0.019, 8, false)),
    exposedBoneMat,
  );
  jawGroup.add(jawBone);

  for (const side of [-1, 1] as const) {
    const jawTendon = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.006, 0.008, 0.11, 5)),
      crimsonSinewMat,
    );
    jawTendon.position.set(side * 0.068, -0.04, 0.072);
    jawTendon.rotation.x = 0.25;
    jawGroup.add(jawTendon);
  }

  const lowerMouthRim = new THREE.Mesh(
    trackGeo(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.056, -0.03, 0.085),
          new THREE.Vector3(-0.042, -0.115, 0.108),
          new THREE.Vector3(0, -0.148, 0.118),
          new THREE.Vector3(0.042, -0.115, 0.108),
          new THREE.Vector3(0.056, -0.03, 0.085),
        ]),
        14,
        0.007,
        6,
        false,
      ),
    ),
    whiteMouthMat,
  );
  jawGroup.add(lowerMouthRim);

  for (let t = -3; t <= 3; t++) {
    const tooth = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.005, 0.02, 5)),
      whiteMouthMat,
    );
    tooth.position.set(t * 0.016, -0.125 + Math.abs(t) * 0.007, 0.112 - Math.abs(t) * 0.004);
    jawGroup.add(tooth);
  }

  // 4. Articulated Skeletal Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Wrist -> Clawed Hand)
  const buildArm = (side: -1 | 1) => {
    const suffix = side < 0 ? 'L' : 'R';
    const arm = new THREE.Group();
    arm.name = `UpperArm_${suffix}`;
    arm.position.set(side * 0.265, 0.9, 0.08);

    // Connected Shoulder Joint Ball + Bony Acromion Cap
    const shoulder = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.064, 12, 10)),
      charredLimbMat,
    );
    shoulder.scale.set(0.92, 1.08, 0.92);
    arm.add(shoulder);

    const acromion = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.038, 8, 8)),
      exposedBoneMat,
    );
    acromion.position.set(side * 0.024, 0.032, -0.01);
    arm.add(acromion);

    // Gaunt Upper Arm (shriveled charcoal flesh + protruding humerus bone + crimson bicep cord)
    const upperCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.036, -0.34, 0.015),
      new THREE.Vector3(side * 0.068, -0.68, 0.03),
    ]);
    const upperFlesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(upperCurve, 12, 0.031, 8, false)),
      decayedFleshMat,
    );
    upperFlesh.castShadow = true;
    arm.add(upperFlesh);

    const humerusBone = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.017, 0.015, 0.66, 7)),
      exposedBoneMat,
    );
    humerusBone.position.set(side * 0.044, -0.34, 0.02);
    humerusBone.rotation.z = side * 0.095;
    humerusBone.rotation.x = 0.04;
    arm.add(humerusBone);

    // Articulated Elbow Pivot Group
    const elbow = new THREE.Group();
    elbow.name = `Forearm_${suffix}`;
    elbow.position.set(side * 0.068, -0.68, 0.03);
    arm.add(elbow);

    const elbowCap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.042, 10, 8)),
      exposedBoneMat,
    );
    elbow.add(elbowCap);

    // Sharp olecranon elbow bone spur jutting backward
    const elbowSpur = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.018, 0.085, 5)),
      exposedBoneMat,
    );
    elbowSpur.position.set(0, 0.015, -0.048);
    elbowSpur.rotation.x = -Math.PI * 0.65;
    elbow.add(elbowSpur);

    // Unnaturally Long Forearm (dual radius/ulna exposed bones + decayed wrap)
    const forearmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.032, -0.4, 0.09),
      new THREE.Vector3(side * 0.045, -0.82, 0.16),
    ]);
    const forearmMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(forearmCurve, 14, 0.025, 8, false)),
      charredLimbMat,
    );
    forearmMesh.castShadow = true;
    elbow.add(forearmMesh);

    const forearmTendon = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.008, 0.006, 0.72, 5)),
      crimsonSinewMat,
    );
    forearmTendon.position.set(side * 0.018, -0.38, 0.095);
    forearmTendon.rotation.x = 0.19;
    elbow.add(forearmTendon);

    // Articulated Wrist Pivot Group
    const wrist = new THREE.Group();
    wrist.name = `Hand_${suffix}`;
    wrist.position.set(side * 0.045, -0.82, 0.16);
    elbow.add(wrist);

    const wristKnob = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.028, 8, 8)),
      exposedBoneMat,
    );
    wrist.add(wristKnob);

    const palm = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.042, 10, 10)),
      decayedFleshMat,
    );
    palm.scale.set(0.72, 1.32, 0.48);
    palm.position.set(0, -0.065, 0.01);
    wrist.add(palm);

    // 5 Long Skeletal Clawed Fingers
    for (let f = -2; f <= 2; f++) {
      const fx = f * 0.016;
      const isThumb = f === (side < 0 ? 2 : -2);
      const lenScale = isThumb ? 0.65 : 1.0 - Math.abs(f) * 0.08;
      const fCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(fx, -0.1, 0.01),
        new THREE.Vector3(fx + f * 0.014, -0.22 * lenScale, 0.055),
        new THREE.Vector3(fx + f * 0.01, -0.35 * lenScale, -0.01),
      ]);
      const finger = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(fCurve, 8, 0.0075, 6, false)),
        charredLimbMat,
      );
      wrist.add(finger);

      const talonTip = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(0.006, 0.048, 5)),
        exposedBoneMat,
      );
      talonTip.position.set(fx + f * 0.01, -0.365 * lenScale, -0.018);
      talonTip.rotation.x = Math.PI * 0.85;
      wrist.add(talonTip);
    }

    return { arm, elbow, wrist };
  };

  const leftArmRig = buildArm(-1);
  const rightArmRig = buildArm(1);
  torsoGroup.add(leftArmRig.arm, rightArmRig.arm);

  // 5. Articulated Gaunt Skeletal Legs (Hip -> Thigh -> Knee -> Shin -> Ankle -> Skeletal Foot)
  const buildLeg = (side: -1 | 1) => {
    const suffix = side < 0 ? 'L' : 'R';
    const leg = new THREE.Group();
    leg.name = `Thigh_${suffix}`;
    leg.position.set(side * 0.135, 0, 0);

    const hipJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.055, 10, 8)),
      exposedBoneMat,
    );
    leg.add(hipJoint);

    const thighCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.018, -0.3, 0.04),
      new THREE.Vector3(side * 0.01, -0.62, 0.05),
    ]);
    const thighMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(thighCurve, 10, 0.044, 8, false)),
      decayedFleshMat,
    );
    thighMesh.castShadow = true;
    leg.add(thighMesh);

    // Articulated Knee Pivot
    const knee = new THREE.Group();
    knee.name = `Shin_${suffix}`;
    knee.position.set(side * 0.01, -0.62, 0.05);
    leg.add(knee);

    const kneeCap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.042, 10, 8)),
      exposedBoneMat,
    );
    kneeCap.scale.set(0.92, 1.05, 1.15);
    knee.add(kneeCap);

    // Thin Bowed Shin + Exposed Tibia Crest + Crimson Achilles Cord
    const shinCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * -0.008, -0.3, -0.025),
      new THREE.Vector3(0, -0.58, -0.02),
    ]);
    const shinMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(shinCurve, 10, 0.032, 8, false)),
      charredLimbMat,
    );
    shinMesh.castShadow = true;
    knee.add(shinMesh);

    const tibiaBone = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.013, 0.011, 0.54, 6)),
      exposedBoneMat,
    );
    tibiaBone.position.set(0, -0.29, 0.008);
    knee.add(tibiaBone);

    const achillesCord = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.007, 0.009, 0.36, 5)),
      crimsonSinewMat,
    );
    achillesCord.position.set(0, -0.38, -0.038);
    knee.add(achillesCord);

    // Articulated Ankle + Splayed 3-Clawed Skeletal Foot resting cleanly at y = 0
    const ankle = new THREE.Group();
    ankle.name = `Foot_${suffix}`;
    ankle.position.set(0, -0.58, -0.02);
    knee.add(ankle);

    const ankleJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.028, 8, 8)),
      exposedBoneMat,
    );
    ankle.add(ankleJoint);

    for (let toe = -1; toe <= 1; toe++) {
      const toeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(toe * 0.032, -0.026, 0.09),
        new THREE.Vector3(toe * 0.042, -0.035, 0.17),
      ]);
      const toeBone = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(toeCurve, 6, 0.009, 5, false)),
        exposedBoneMat,
      );
      ankle.add(toeBone);
    }

    return { leg, knee, ankle };
  };

  const leftLegRig = buildLeg(-1);
  const rightLegRig = buildLeg(1);
  pelvisGroup.add(leftLegRig.leg, rightLegRig.leg);

  const animations = buildStalkerAnimationClips();

  return {
    group,
    pelvisGroup,
    torsoGroup,
    neckGroup,
    headGroup,
    jawGroup,
    leftArm: leftArmRig.arm,
    leftElbow: leftArmRig.elbow,
    leftWrist: leftArmRig.wrist,
    rightArm: rightArmRig.arm,
    rightElbow: rightArmRig.elbow,
    rightWrist: rightArmRig.wrist,
    leftLeg: leftLegRig.leg,
    leftKnee: leftLegRig.knee,
    leftAnkle: leftLegRig.ankle,
    rightLeg: rightLegRig.leg,
    rightKnee: rightLegRig.knee,
    rightAnkle: rightLegRig.ankle,
    tendrils,
    whiteFaceMats: [whiteEyeMat, whiteMouthMat],
    animations,
    dispose: () => {
      tex.dispose();
      for (const g of createdGeometries) g.dispose();
      for (const m of createdMaterials) m.dispose();
    },
  };
}

/**
 * Exports the full-body articulated Stalker creature with 2K PBR textures and
 * Idle/Walk AnimationClips as a binary GLB file for Blender, Unreal, Unity, or Roblox.
 */
export async function exportStalkerCreatureGlb(): Promise<Blob> {
  const rig = createStalkerModel();
  const exporter = new GLTFExporter();
  try {
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        rig.group,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const json = JSON.stringify(result);
            resolve(new TextEncoder().encode(json).buffer);
          }
        },
        (err) => reject(err),
        {
          binary: true,
          animations: rig.animations,
          onlyVisible: true,
        },
      );
    });
    return new Blob([buffer], { type: 'model/gltf-binary' });
  } finally {
    rig.dispose();
  }
}

export interface GhostCrushHandsRig {
  group: THREE.Group;
  leftHand: THREE.Group;
  rightHand: THREE.Group;
  leftFingers: THREE.Group[];
  rightFingers: THREE.Group[];
  dispose: () => void;
}

export function createGhostCrushHandsRig(): GhostCrushHandsRig {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const fleshMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b1719,
      roughness: 0.72,
      metalness: 0.12,
    }),
  );
  const boneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa4998b,
      roughness: 0.56,
      metalness: 0.06,
    }),
  );
  const clawMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5c1116,
      emissive: 0x260306,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.22,
    }),
  );

  const buildSingleHand = (side: -1 | 1): { hand: THREE.Group; fingers: THREE.Group[] } => {
    const hand = new THREE.Group();

    // Gaunt sinewy forearm reaching forward from off-screen edges
    const forearm = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.026, 0.036, 0.34, 10)),
      fleshMat,
    );
    forearm.rotation.x = Math.PI / 2;
    forearm.position.set(0, -0.02, 0.16);
    hand.add(forearm);

    // Skeletal gaunt palm
    const palm = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.052, 12, 10)), fleshMat);
    palm.scale.set(1.05, 0.42, 1.35);
    palm.position.set(0, 0, -0.03);
    hand.add(palm);

    // Pale bone dorsal metacarpal ridges
    for (let k = -1.5; k <= 1.5; k += 1) {
      const ridgeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(k * 0.013, 0.012, 0.02),
        new THREE.Vector3(k * 0.016, 0.022, -0.045),
        new THREE.Vector3(k * 0.019, 0.016, -0.092),
      ]);
      const ridge = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(ridgeCurve, 8, 0.005, 5, false)),
        boneMat,
      );
      hand.add(ridge);
    }

    const fingers: THREE.Group[] = [];

    // 4 long curved spider-claw fingers + 1 sharp thumb
    const fingerSpecs = [
      { x: -0.036, y: 0.008, z: -0.095, len: 0.115, spreadZ: 0.22, spreadY: 0.14 },
      { x: -0.012, y: 0.014, z: -0.105, len: 0.132, spreadZ: 0.07, spreadY: 0.05 },
      { x: 0.013, y: 0.014, z: -0.104, len: 0.128, spreadZ: -0.07, spreadY: -0.05 },
      { x: 0.036, y: 0.008, z: -0.092, len: 0.108, spreadZ: -0.22, spreadY: -0.14 },
      // Opposable claw thumb
      { x: -side * 0.046, y: -0.008, z: -0.045, len: 0.088, spreadZ: side * 0.55, spreadY: side * 0.48 },
    ];

    for (const spec of fingerSpecs) {
      const fPivot = new THREE.Group();
      fPivot.position.set(spec.x, spec.y, spec.z);
      fPivot.rotation.set(0, spec.spreadY, spec.spreadZ);

      const segCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.012, -spec.len * 0.45),
        new THREE.Vector3(0, -0.006, -spec.len * 0.85),
      ]);
      const seg = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(segCurve, 8, 0.0068, 6, false)),
        fleshMat,
      );
      fPivot.add(seg);

      // Crimson-stained razor claw tip
      const claw = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.0062, 0.036, 6)), clawMat);
      claw.rotation.x = -Math.PI * 0.64;
      claw.position.set(0, -0.016, -spec.len * 0.96);
      fPivot.add(claw);

      hand.add(fPivot);
      fingers.push(fPivot);
    }

    return { hand, fingers };
  };

  const left = buildSingleHand(-1);
  const right = buildSingleHand(1);
  group.add(left.hand, right.hand);

  return {
    group,
    leftHand: left.hand,
    rightHand: right.hand,
    leftFingers: left.fingers,
    rightFingers: right.fingers,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

export interface LockerRig {
  group: THREE.Group;
  doorPivot: THREE.Group;
  colliderMesh: THREE.Mesh;
}

export function createLockerModel(metalMap: THREE.CanvasTexture): LockerRig {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3c4248,
    map: metalMap,
    roughness: 0.45,
    metalness: 0.72,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x22262a,
    roughness: 0.7,
    metalness: 0.35,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xb8b2a2,
    roughness: 0.25,
    metalness: 0.9,
  });

  // Back, Left, Right, Top, Bottom cabinet shell
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.06), bodyMat);
  back.position.set(0, 1.15, -0.45);
  const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.92), bodyMat);
  leftSide.position.set(-0.52, 1.15, 0);
  const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.92), bodyMat);
  rightSide.position.set(0.52, 1.15, 0);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.96), trimMat);
  top.position.set(0, 2.3, 0);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.96), trimMat);
  bottom.position.set(0, 0.04, 0);

  group.add(back, leftSide, rightSide, top, bottom);

  // Hinged Door Pivot with Eye-Level Slatted Peek Gaps
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.5, 1.15, 0.45);
  group.add(doorPivot);

  // Lower solid door section (y: -1.09 to +0.18)
  const lowerDoor = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.27, 0.05), bodyMat);
  lowerDoor.position.set(0.5, -0.455, 0);
  lowerDoor.castShadow = true;
  lowerDoor.receiveShadow = true;
  doorPivot.add(lowerDoor);

  // Upper solid door section (y: +0.58 to +1.09)
  const upperDoor = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.51, 0.05), bodyMat);
  upperDoor.position.set(0.5, 0.835, 0);
  upperDoor.castShadow = true;
  upperDoor.receiveShadow = true;
  doorPivot.add(upperDoor);

  // Side vertical door stiles flanking eye-level peek window (y: +0.18 to +0.58)
  const leftStile = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.05), bodyMat);
  leftStile.position.set(0.07, 0.38, 0);
  leftStile.castShadow = true;
  const rightStile = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.05), bodyMat);
  rightStile.position.set(0.93, 0.38, 0);
  rightStile.castShadow = true;
  doorPivot.add(leftStile, rightStile);

  // Thin horizontal louver slats with wide open gaps between them at eye level (1.33m-1.73m)
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.022, 0.045), trimMat);
    slat.position.set(0.5, 0.26 + i * 0.12, 0.005);
    slat.rotation.x = 0.16;
    doorPivot.add(slat);
  }

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08), handleMat);
  handle.position.set(0.88, 0.05, 0.04);
  doorPivot.add(handle);

  // Invisible raycast proxy collider
  const colliderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 2.35, 1.05),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  colliderMesh.position.set(0, 1.17, 0);
  group.add(colliderMesh);

  return { group, doorPivot, colliderMesh };
}

export function createUtilityTableModel(): THREE.Group {
  const group = new THREE.Group();
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x564b37,
    roughness: 0.78,
    metalness: 0.08,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x292b2e,
    roughness: 0.42,
    metalness: 0.75,
  });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.8), topMat);
  top.position.y = 0.74;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const offsets = [
    [-0.56, -0.32],
    [0.56, -0.32],
    [-0.56, 0.32],
    [0.56, 0.32],
  ];
  for (const [lx, lz] of offsets) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), legMat);
    leg.position.set(lx, 0.36, lz);
    leg.castShadow = true;
    group.add(leg);
  }

  return group;
}

export function createPowerRoomDoorModel(): {
  group: THREE.Group;
  doorPivot: THREE.Group;
  plankGroup: THREE.Group;
  collider: THREE.Mesh;
} {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.55, metalness: 0.72 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3b3532, roughness: 0.62, metalness: 0.45 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4f32, roughness: 0.85, metalness: 0.05 });

  // High Voltage Sign CanvasTexture
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256;
  signCanvas.height = 128;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.fillStyle = '#eab308';
  sCtx.fillRect(0, 0, 256, 128);
  sCtx.strokeStyle = '#111114';
  sCtx.lineWidth = 10;
  sCtx.strokeRect(5, 5, 246, 118);
  sCtx.fillStyle = '#111114';
  sCtx.font = 'bold 26px monospace';
  sCtx.textAlign = 'center';
  sCtx.fillText('HIGH VOLTAGE', 128, 52);
  sCtx.font = 'bold 20px monospace';
  sCtx.fillText('POWER ROOM', 128, 92);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 });

  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(1.15, 3.6, 0.36), frameMat);
  leftPost.position.set(-1.425, 1.8, 0);
  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(1.15, 3.6, 0.36), frameMat);
  rightPost.position.set(1.425, 1.8, 0);
  const header = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 0.36), frameMat);
  header.position.set(0, 3.1, 0);
  group.add(leftPost, rightPost, header);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.85, 1.3, 0);
  group.add(doorPivot);

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.6, 0.14), doorMat);
  leaf.position.set(0.85, 0, 0);
  leaf.castShadow = true;
  doorPivot.add(leaf);

  const plateFront = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.42, 0.02), signMat);
  plateFront.position.set(0.85, 0.52, 0.08);
  const plateBack = plateFront.clone();
  plateBack.position.z = -0.08;
  doorPivot.add(plateFront, plateBack);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.06, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.28 }),
  );
  handle.position.set(1.48, -0.05, 0);
  doorPivot.add(handle);

  // Wooden Barricade Planks spanning both sides (removed when pried with Heavy Crowbar)
  const plankGroup = new THREE.Group();
  const plankSpecs = [
    { y: 1.65, rotZ: 0.14 },
    { y: 1.22, rotZ: -0.11 },
    { y: 0.82, rotZ: 0.08 },
  ];
  for (const p of plankSpecs) {
    const frontPlank = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.17, 0.06), woodMat);
    frontPlank.position.set(0, p.y, 0.16);
    frontPlank.rotation.z = p.rotZ;
    plankGroup.add(frontPlank);

    const backPlank = frontPlank.clone();
    backPlank.position.z = -0.16;
    plankGroup.add(backPlank);
  }
  group.add(plankGroup);

  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 2.7, 0.85),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  collider.position.set(0, 1.35, 0);
  group.add(collider);

  return { group, doorPivot, plankGroup, collider };
}

export function createPowerVoltagePanelModel(): {
  group: THREE.Group;
  ledMat: THREE.MeshStandardMaterial;
  buttonMat: THREE.MeshStandardMaterial;
  buttonMesh: THREE.Mesh;
  roomLight: THREE.PointLight;
  collider: THREE.Mesh;
} {
  const group = new THREE.Group();
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x2d343b, roughness: 0.42, metalness: 0.78 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.32, metalness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.75 });

  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.5,
    roughness: 0.25,
  });
  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x7f1d1d,
    emissiveIntensity: 1.2,
    roughness: 0.3,
  });

  // Main transformer cabinet
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.55, 0.32), cabinetMat);
  cabinet.position.set(0, 1.45, 0);
  cabinet.castShadow = true;
  group.add(cabinet);

  // Heavy top & bottom conduit pipes
  for (const xOff of [-0.34, 0.34]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.4, 8), trimMat);
    pipe.position.set(xOff, 2.85, 0);
    group.add(pipe);
  }

  // Dual copper voltage coils on top of cabinet
  for (const xOff of [-0.22, 0.22]) {
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.38, 12), copperMat);
    coil.position.set(xOff, 2.38, 0.04);
    group.add(coil);
  }

  // Front meter gauge plate
  const gaugeCanvas = document.createElement('canvas');
  gaugeCanvas.width = 256;
  gaugeCanvas.height = 128;
  const gCtx = gaugeCanvas.getContext('2d')!;
  gCtx.fillStyle = '#0f172a';
  gCtx.fillRect(0, 0, 256, 128);
  gCtx.fillStyle = '#facc15';
  gCtx.font = 'bold 24px monospace';
  gCtx.textAlign = 'center';
  gCtx.fillText('MAIN VOLTAGE', 128, 46);
  gCtx.fillStyle = '#cbd5e1';
  gCtx.font = '18px monospace';
  gCtx.fillText('PRESS POWER BUTTON', 128, 88);
  const gaugeTex = new THREE.CanvasTexture(gaugeCanvas);
  gaugeTex.colorSpace = THREE.SRGBColorSpace;
  const gauge = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.38, 0.04),
    new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: 0.4 }),
  );
  gauge.position.set(0, 1.88, 0.17);
  group.add(gauge);

  // Status LED + Big Tactile Power Button
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), ledMat);
  led.position.set(0.32, 1.45, 0.18);
  group.add(led);

  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.06, 16), trimMat);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, 1.32, 0.17);
  group.add(bezel);

  const buttonMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.09, 16), buttonMat);
  buttonMesh.rotation.x = Math.PI / 2;
  buttonMesh.position.set(0, 1.32, 0.21);
  group.add(buttonMesh);

  // Interior power hum PointLight (off until player switches ON Power Button)
  const roomLight = new THREE.PointLight(0x38bdf8, 0, 7.5, 2.0);
  roomLight.position.set(0, 1.75, 0.85);
  group.add(roomLight);

  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 1.8, 0.75),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  collider.position.set(0, 1.45, 0.18);
  group.add(collider);

  return { group, ledMat, buttonMat, buttonMesh, roomLight, collider };
}

export function createBlackYellowDoorModel(): {
  group: THREE.Group;
  doorPivot: THREE.Group;
  statusMat: THREE.MeshStandardMaterial;
  collider: THREE.Mesh;
} {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.8 });

  // Diagonal Black & Yellow hazard stripes texture
  const hazardCanvas = document.createElement('canvas');
  hazardCanvas.width = 512;
  hazardCanvas.height = 512;
  const hCtx = hazardCanvas.getContext('2d')!;
  hCtx.fillStyle = '#eab308';
  hCtx.fillRect(0, 0, 512, 512);
  hCtx.fillStyle = '#09090b';
  for (let i = -512; i < 1024; i += 96) {
    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i + 48, 0);
    hCtx.lineTo(i - 464, 512);
    hCtx.lineTo(i - 512, 512);
    hCtx.closePath();
    hCtx.fill();
  }
  // Grime border & warning center band
  hCtx.strokeStyle = '#09090b';
  hCtx.lineWidth = 22;
  hCtx.strokeRect(11, 11, 490, 490);
  const hazardTex = new THREE.CanvasTexture(hazardCanvas);
  hazardTex.colorSpace = THREE.SRGBColorSpace;

  const doorMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.42,
    metalness: 0.35,
  });
  const statusMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });

  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.6, 0.38), frameMat);
  leftPost.position.set(-1.45, 1.8, 0);
  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.6, 0.38), frameMat);
  rightPost.position.set(1.45, 1.8, 0);
  const header = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.38), frameMat);
  header.position.set(0, 3.1, 0);
  group.add(leftPost, rightPost, header);

  // Power Beacon above Black & Yellow door (red = unpowered, emerald/yellow = unlocked)
  const beaconFront = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.12), statusMat);
  beaconFront.position.set(0, 2.78, 0.22);
  const beaconBack = beaconFront.clone();
  beaconBack.position.z = -0.22;
  group.add(beaconFront, beaconBack);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.9, 1.3, 0);
  group.add(doorPivot);

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 0.16), doorMat);
  leaf.position.set(0.9, 0, 0);
  leaf.castShadow = true;
  doorPivot.add(leaf);

  const lockBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.1, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.35 }),
  );
  lockBar.position.set(0.9, -0.05, 0);
  doorPivot.add(lockBar);

  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 2.75, 0.85),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  collider.position.set(0, 1.35, 0);
  group.add(collider);

  return { group, doorPivot, statusMat, collider };
}

export function createOfficeDoorModel(): {
  group: THREE.Group;
  doorPivot: THREE.Group;
  collider: THREE.Mesh;
} {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x262118, roughness: 0.75 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4b3826, roughness: 0.65, metalness: 0.1 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc29c42, roughness: 0.28, metalness: 0.88 });

  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.6, 0.35), frameMat);
  leftPost.position.set(-1.4, 1.8, 0);
  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.6, 0.35), frameMat);
  rightPost.position.set(1.4, 1.8, 0);
  const header = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.35), frameMat);
  header.position.set(0, 3.05, 0);
  group.add(leftPost, rightPost, header);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.8, 1.25, 0);
  group.add(doorPivot);

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.5, 0.12), doorMat);
  leaf.position.set(0.8, 0, 0);
  leaf.castShadow = true;
  doorPivot.add(leaf);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), brassMat);
  knob.position.set(1.42, -0.05, 0.1);
  const knobBack = knob.clone();
  knobBack.position.z = -0.1;
  doorPivot.add(knob, knobBack);

  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 2.6, 0.7),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  collider.position.set(0, 1.3, 0);
  group.add(collider);

  return { group, doorPivot, collider };
}

export function createExitBulkheadModel(): {
  group: THREE.Group;
  doorLeaf: THREE.Group;
  signMat: THREE.MeshStandardMaterial;
  sunPortalMat: THREE.MeshBasicMaterial;
  sunLight: THREE.PointLight;
  collider: THREE.Mesh;
} {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x2d3238, roughness: 0.38, metalness: 0.82 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: 0xc8a24a, roughness: 0.4, metalness: 0.55 });
  const signMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0x7f1d1d,
    emissiveIntensity: 1.2,
    roughness: 0.3,
  });

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.6, 0.4), steelMat);
  leftWall.position.set(-1.45, 1.8, 0);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.6, 0.4), steelMat);
  rightWall.position.set(1.45, 1.8, 0);
  const topHeader = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.4), steelMat);
  topHeader.position.set(0, 3.1, 0);
  group.add(leftWall, rightWall, topHeader);

  const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.24, 0.12), signMat);
  exitSign.position.set(0, 2.86, 0.24);
  group.add(exitSign);

  const doorLeaf = new THREE.Group();
  doorLeaf.position.set(-0.9, 1.3, 0);
  group.add(doorLeaf);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 0.18), steelMat);
  panel.position.set(0.9, 0, 0);
  doorLeaf.add(panel);

  const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.14), hazardMat);
  pushBar.position.set(0.9, -0.1, 0.12);
  doorLeaf.add(pushBar);

  // Luminous golden daylight threshold visible beyond the exit door once unlocked
  const sunPortalMat = new THREE.MeshBasicMaterial({
    color: 0xfff5d6,
    fog: false,
    transparent: true,
    opacity: 0,
  });
  const sunPortal = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 2.65), sunPortalMat);
  sunPortal.position.set(0, 1.32, -1.85);
  group.add(sunPortal);

  const sunLight = new THREE.PointLight(0xfff1c2, 0, 12, 1.6);
  sunLight.position.set(0, 1.85, -1.5);
  group.add(sunLight);

  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 2.8, 0.8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  collider.position.set(0, 1.4, 0);
  group.add(collider);

  return { group, doorLeaf, signMat, sunPortalMat, sunLight, collider };
}

export function createItemPickupModel(itemId: ItemId): {
  group: THREE.Group;
  collider: THREE.Mesh;
} {
  const group = new THREE.Group();

  if (itemId === 'crowbar') {
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.38,
      metalness: 0.85,
    });
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.45,
      metalness: 0.25,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8), redMat);
    shaft.rotation.z = Math.PI / 2;
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.014, 0.12, 8), steelMat);
    hook.position.set(0.24, 0, 0.045);
    hook.rotation.y = 0.65;
    hook.rotation.z = Math.PI / 2;
    const chisel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.036), steelMat);
    chisel.position.set(-0.24, 0, 0);
    chisel.rotation.y = -0.25;
    group.add(shaft, hook, chisel);
  } else if (itemId === 'old_key') {
    const brass = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.9,
      emissive: 0x3b2c08,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = -0.09;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), brass);
    shaft.rotation.x = Math.PI / 2;
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.015, 0.05), brass);
    teeth.position.set(0.025, 0, 0.07);
    group.add(ring, shaft, teeth);
  } else if (itemId === 'screwdriver') {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.024, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45 }),
    );
    handle.rotation.x = Math.PI / 2;
    handle.position.z = -0.08;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.95 }),
    );
    rod.rotation.x = Math.PI / 2;
    rod.position.z = 0.08;
    group.add(handle, rod);
  } else if (itemId === 'fuse') {
    const capMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 12), glassMat);
    body.rotation.z = Math.PI / 2;
    const capL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.045, 12), capMat);
    capL.rotation.z = Math.PI / 2;
    capL.position.x = -0.09;
    const capR = capL.clone();
    capR.position.x = 0.09;
    group.add(body, capL, capR);
  } else if (itemId === 'battery') {
    const packCase = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.42, metalness: 0.35 }),
    );
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.184, 0.028, 0.124),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.32, metalness: 0.65 }),
    );
    band.position.y = 0.018;
    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.012, 0.022),
      new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x22c55e,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      }),
    );
    ledStrip.position.set(0, 0.044, 0);
    const termMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, metalness: 0.9, roughness: 0.2 });
    const termL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 10), termMat);
    termL.position.set(-0.055, 0.046, 0.032);
    const termR = termL.clone();
    termR.position.set(0.055, 0.046, 0.032);
    group.add(packCase, band, ledStrip, termL, termR);
  } else if (itemId === 'first_aid') {
    const caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.09, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 }),
    );
    const crossH = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.015, 0.035),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }),
    );
    crossH.position.y = 0.05;
    const crossV = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.015, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }),
    );
    crossV.position.y = 0.05;
    group.add(caseMesh, crossH, crossV);
  } else if (itemId === 'tactical_flashlight') {
    const tacModel = createTacticalFlashlightModel();
    tacModel.group.scale.setScalar(1.18);
    tacModel.lensMat.emissiveIntensity = 0.75;
    tacModel.ledMat.emissiveIntensity = 1.1;
    group.add(tacModel.group);
  } else if (itemId === 'lore_note') {
    const noteCanvas = document.createElement('canvas');
    noteCanvas.width = 256;
    noteCanvas.height = 320;
    const nCtx = noteCanvas.getContext('2d')!;
    nCtx.fillStyle = '#ddd3b8';
    nCtx.fillRect(0, 0, 256, 320);
    // Faint ruled margins & red stamp
    nCtx.fillStyle = 'rgba(153, 27, 27, 0.28)';
    nCtx.fillRect(22, 22, 110, 20);
    nCtx.fillStyle = '#292524';
    for (let y = 64; y < 286; y += 22) {
      const lineW = 140 + ((y * 37) % 68);
      nCtx.fillRect(24, y, lineW, 4);
    }
    const noteTex = new THREE.CanvasTexture(noteCanvas);
    noteTex.colorSpace = THREE.SRGBColorSpace;

    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.008, 0.31),
      new THREE.MeshStandardMaterial({
        map: noteTex,
        roughness: 0.85,
        emissive: 0x3b311e,
        emissiveIntensity: 0.32,
      }),
    );
    sheet.rotation.y = 0.14;
    const underSheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, 0.006, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xbcb092, roughness: 0.9 }),
    );
    underSheet.position.y = -0.006;
    underSheet.rotation.y = -0.1;
    const sealClip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.014, 0.022),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45 }),
    );
    sealClip.position.set(-0.075, 0.008, -0.125);
    group.add(underSheet, sheet, sealClip);
  } else {
    // Memory Tape
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x1f2024, roughness: 0.55 }),
    );
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.01, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xd6cdb4, roughness: 0.8 }),
    );
    label.position.set(0, 0.022, 0.02);
    group.add(shell, label);
  }

  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.45, 0.55),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  group.add(collider);

  return { group, collider };
}

export interface TacticalFlashlightModel {
  group: THREE.Group;
  lensMat: THREE.MeshStandardMaterial;
  ledMat: THREE.MeshStandardMaterial;
  buttonMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

function buildNormalCanvasFromHeightField(
  heights: Float32Array,
  width: number,
  height: number,
  strength: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;

  for (let y = 0; y < height; y++) {
    const yPrev = (y - 1 + height) % height;
    const yNext = (y + 1) % height;
    for (let x = 0; x < width; x++) {
      const xPrev = (x - 1 + width) % width;
      const xNext = (x + 1) % width;
      const hL = heights[y * width + xPrev];
      const hR = heights[y * width + xNext];
      const hU = heights[yPrev * width + x];
      const hD = heights[yNext * width + x];

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(((dx * invLen) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((dy * invLen) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((dz * invLen) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

interface FlashlightPbrTextures {
  knurlAlbedo: THREE.CanvasTexture;
  knurlMetallicRoughness: THREE.CanvasTexture;
  knurlNormal: THREE.CanvasTexture;
  aluAlbedo: THREE.CanvasTexture;
  aluMetallicRoughness: THREE.CanvasTexture;
  aluNormal: THREE.CanvasTexture;
  steelAlbedo: THREE.CanvasTexture;
  steelMetallicRoughness: THREE.CanvasTexture;
  steelNormal: THREE.CanvasTexture;
  ledDieAlbedo: THREE.CanvasTexture;
  dispose: () => void;
}

function createFlashlightPbrTextures(): FlashlightPbrTextures {
  const textures: THREE.Texture[] = [];

  // 1. Black Diamond-Knurled Cylindrical Grip PBR Maps (1024x1024, seamless)
  const kSize = 1024;
  const kHeight = new Float32Array(kSize * kSize);
  const kAlbedoCanvas = document.createElement('canvas');
  kAlbedoCanvas.width = kSize;
  kAlbedoCanvas.height = kSize;
  const kACtx = kAlbedoCanvas.getContext('2d')!;
  const kAImg = kACtx.createImageData(kSize, kSize);

  const kMrCanvas = document.createElement('canvas');
  kMrCanvas.width = kSize;
  kMrCanvas.height = kSize;
  const kMrCtx = kMrCanvas.getContext('2d')!;
  const kMrImg = kMrCtx.createImageData(kSize, kSize);

  const knurlFreq = 28; // integer frequency guarantees seamless periodic wrapping
  for (let y = 0; y < kSize; y++) {
    const v = y / kSize;
    for (let x = 0; x < kSize; x++) {
      const u = x / kSize;
      // Seamless 45-degree diamond crosshatch wave
      const d1 = Math.abs((((u + v) * knurlFreq) % 1 + 1) % 1 - 0.5) * 2;
      const d2 = Math.abs((((u - v) * knurlFreq) % 1 + 1) % 1 - 0.5) * 2;
      const rawDiamond = Math.min(d1, d2);
      // Slight flat machined crown on pyramid tips + crisp valley channels
      const crown = Math.min(1, Math.pow(rawDiamond, 0.85) * 1.15);
      const grain =
        (Math.sin(x * 0.71 + y * 1.13) * 0.5 + Math.cos(x * 1.9 - y * 0.43) * 0.5) * 0.04;
      const hVal = Math.max(0, Math.min(1, crown + grain));
      kHeight[y * kSize + x] = hVal;

      const idx = (y * kSize + x) * 4;
      // Albedo: deep tactical charcoal-black (#0a0b0d valleys -> #202329 diamond peaks)
      const lum = Math.round(10 + crown * 22 + grain * 12);
      kAImg.data[idx] = lum;
      kAImg.data[idx + 1] = lum + 1;
      kAImg.data[idx + 2] = lum + 4;
      kAImg.data[idx + 3] = 255;

      // glTF Metallic-Roughness packing: G = roughness, B = metalness
      const roughByte = Math.round((0.86 - crown * 0.34) * 255);
      const metalByte = Math.round((0.14 + crown * 0.22) * 255);
      kMrImg.data[idx] = Math.round((0.55 + crown * 0.45) * 255);
      kMrImg.data[idx + 1] = roughByte;
      kMrImg.data[idx + 2] = metalByte;
      kMrImg.data[idx + 3] = 255;
    }
  }
  kACtx.putImageData(kAImg, 0, 0);
  kMrCtx.putImageData(kMrImg, 0, 0);

  const knurlAlbedo = new THREE.CanvasTexture(kAlbedoCanvas);
  knurlAlbedo.colorSpace = THREE.SRGBColorSpace;
  knurlAlbedo.wrapS = THREE.RepeatWrapping;
  knurlAlbedo.wrapT = THREE.RepeatWrapping;
  knurlAlbedo.repeat.set(3, 2);

  const knurlMetallicRoughness = new THREE.CanvasTexture(kMrCanvas);
  knurlMetallicRoughness.wrapS = THREE.RepeatWrapping;
  knurlMetallicRoughness.wrapT = THREE.RepeatWrapping;
  knurlMetallicRoughness.repeat.set(3, 2);

  const knurlNormal = buildNormalCanvasFromHeightField(kHeight, kSize, kSize, 3.4);
  knurlNormal.repeat.set(3, 2);

  textures.push(knurlAlbedo, knurlMetallicRoughness, knurlNormal);

  // 2. Metallic Dark-Gray Anodized Aluminum Body PBR Maps (1024x1024)
  const aSize = 1024;
  const aHeight = new Float32Array(aSize * aSize);
  const aAlbedoCanvas = document.createElement('canvas');
  aAlbedoCanvas.width = aSize;
  aAlbedoCanvas.height = aSize;
  const aACtx = aAlbedoCanvas.getContext('2d')!;
  const aAImg = aACtx.createImageData(aSize, aSize);

  const aMrCanvas = document.createElement('canvas');
  aMrCanvas.width = aSize;
  aMrCanvas.height = aSize;
  const aMrCtx = aMrCanvas.getContext('2d')!;
  const aMrImg = aMrCtx.createImageData(aSize, aSize);

  for (let y = 0; y < aSize; y++) {
    const v = y / aSize;
    // Circumferential CNC lathe turning rings along axial coordinate v
    const latheRing =
      Math.sin(v * Math.PI * 2 * 140) * 0.35 +
      Math.sin(v * Math.PI * 2 * 48) * 0.2 +
      Math.cos(v * Math.PI * 2 * 19) * 0.15;
    for (let x = 0; x < aSize; x++) {
      const u = x / aSize;
      const brushStreak = Math.sin(u * Math.PI * 2 * 22 + v * Math.PI * 2 * 2) * 0.12;
      const microWear =
        Math.sin(u * Math.PI * 2 * 90 + Math.cos(v * Math.PI * 2 * 30)) * 0.08;
      const hVal = Math.max(0, Math.min(1, 0.5 + latheRing * 0.28 + brushStreak + microWear));
      aHeight[y * aSize + x] = hVal;

      const idx = (y * aSize + x) * 4;
      // Metallic dark-gray gunmetal (#3e444e .. #525965)
      const baseR = Math.round(64 + hVal * 20);
      const baseG = Math.round(69 + hVal * 21);
      const baseB = Math.round(77 + hVal * 23);
      aAImg.data[idx] = baseR;
      aAImg.data[idx + 1] = baseG;
      aAImg.data[idx + 2] = baseB;
      aAImg.data[idx + 3] = 255;

      // G = roughness (0.25..0.38), B = metalness (0.87..0.95)
      aMrImg.data[idx] = 255;
      aMrImg.data[idx + 1] = Math.round((0.38 - hVal * 0.13) * 255);
      aMrImg.data[idx + 2] = Math.round((0.87 + hVal * 0.08) * 255);
      aMrImg.data[idx + 3] = 255;
    }
  }
  aACtx.putImageData(aAImg, 0, 0);
  aMrCtx.putImageData(aMrImg, 0, 0);

  const aluAlbedo = new THREE.CanvasTexture(aAlbedoCanvas);
  aluAlbedo.colorSpace = THREE.SRGBColorSpace;
  aluAlbedo.wrapS = THREE.RepeatWrapping;
  aluAlbedo.wrapT = THREE.RepeatWrapping;

  const aluMetallicRoughness = new THREE.CanvasTexture(aMrCanvas);
  aluMetallicRoughness.wrapS = THREE.RepeatWrapping;
  aluMetallicRoughness.wrapT = THREE.RepeatWrapping;

  const aluNormal = buildNormalCanvasFromHeightField(aHeight, aSize, aSize, 1.45);
  textures.push(aluAlbedo, aluMetallicRoughness, aluNormal);

  // 3. Silver Brushed Stainless-Steel Crenellated Bezel PBR Maps (512x512)
  const sSize = 512;
  const sHeight = new Float32Array(sSize * sSize);
  const sAlbedoCanvas = document.createElement('canvas');
  sAlbedoCanvas.width = sSize;
  sAlbedoCanvas.height = sSize;
  const sACtx = sAlbedoCanvas.getContext('2d')!;
  const sAImg = sACtx.createImageData(sSize, sSize);

  const sMrCanvas = document.createElement('canvas');
  sMrCanvas.width = sSize;
  sMrCanvas.height = sSize;
  const sMrCtx = sMrCanvas.getContext('2d')!;
  const sMrImg = sMrCtx.createImageData(sSize, sSize);

  for (let y = 0; y < sSize; y++) {
    const v = y / sSize;
    const fineBrush = Math.sin(v * Math.PI * 2 * 180) * 0.35 + Math.cos(v * Math.PI * 2 * 64) * 0.2;
    for (let x = 0; x < sSize; x++) {
      const u = x / sSize;
      const sheen = Math.sin(u * Math.PI * 2 * 18) * 0.12;
      const hVal = Math.max(0, Math.min(1, 0.5 + fineBrush * 0.25 + sheen));
      sHeight[y * sSize + x] = hVal;

      const idx = (y * sSize + x) * 4;
      const lum = Math.round(196 + hVal * 34);
      sAImg.data[idx] = lum;
      sAImg.data[idx + 1] = Math.min(255, lum + 3);
      sAImg.data[idx + 2] = Math.min(255, lum + 8);
      sAImg.data[idx + 3] = 255;

      // G = roughness (0.14..0.24), B = metalness (0.94..0.98)
      sMrImg.data[idx] = 255;
      sMrImg.data[idx + 1] = Math.round((0.24 - hVal * 0.1) * 255);
      sMrImg.data[idx + 2] = Math.round((0.94 + hVal * 0.04) * 255);
      sMrImg.data[idx + 3] = 255;
    }
  }
  sACtx.putImageData(sAImg, 0, 0);
  sMrCtx.putImageData(sMrImg, 0, 0);

  const steelAlbedo = new THREE.CanvasTexture(sAlbedoCanvas);
  steelAlbedo.colorSpace = THREE.SRGBColorSpace;
  steelAlbedo.wrapS = THREE.RepeatWrapping;
  steelAlbedo.wrapT = THREE.RepeatWrapping;

  const steelMetallicRoughness = new THREE.CanvasTexture(sMrCanvas);
  steelMetallicRoughness.wrapS = THREE.RepeatWrapping;
  steelMetallicRoughness.wrapT = THREE.RepeatWrapping;

  const steelNormal = buildNormalCanvasFromHeightField(sHeight, sSize, sSize, 1.1);
  textures.push(steelAlbedo, steelMetallicRoughness, steelNormal);

  // 4. Multi-die LED Emitter Phosphor Substrate Texture (256x256)
  const lCanvas = document.createElement('canvas');
  lCanvas.width = 256;
  lCanvas.height = 256;
  const lCtx = lCanvas.getContext('2d')!;
  lCtx.fillStyle = '#e2e8f0';
  lCtx.fillRect(0, 0, 256, 256);
  lCtx.fillStyle = '#1e293b';
  lCtx.fillRect(16, 16, 224, 224);
  // Bright 2x2 quad CREE-style warm-daylight phosphor die grid
  const padSize = 86;
  for (const px of [34, 136]) {
    for (const py of [34, 136]) {
      lCtx.fillStyle = '#fef08a';
      lCtx.fillRect(px, py, padSize, padSize);
      lCtx.fillStyle = '#fffbeb';
      lCtx.fillRect(px + 8, py + 8, padSize - 16, padSize - 16);
    }
  }
  const ledDieAlbedo = new THREE.CanvasTexture(lCanvas);
  ledDieAlbedo.colorSpace = THREE.SRGBColorSpace;
  textures.push(ledDieAlbedo);

  return {
    knurlAlbedo,
    knurlMetallicRoughness,
    knurlNormal,
    aluAlbedo,
    aluMetallicRoughness,
    aluNormal,
    steelAlbedo,
    steelMetallicRoughness,
    steelNormal,
    ledDieAlbedo,
    dispose: () => {
      for (const tex of textures) tex.dispose();
    },
  };
}

/**
 * Builds a realistic, watertight tactical flashlight oriented horizontally along the Z-axis:
 * - Forward (+Z): glowing LED emitter + optical lens + silver crenellated strike bezel
 * - Backward (-Z): black diamond-knurled cylindrical grip handle + tail-cap switch
 * - Metallic dark-gray aluminum body with 5 machined cooling fins near the head
 * - Side tactile power button + full glTF 2.0 PBR metallic-roughness + normal maps
 */
export function createTacticalFlashlightModel(): TacticalFlashlightModel {
  const group = new THREE.Group();
  group.name = 'TacticalFlashlight_Root';

  const pbr = createFlashlightPbrTextures();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // PBR Materials
  const gripKnurlMat = regMat(
    new THREE.MeshStandardMaterial({
      name: 'BlackKnurledGrip_PBR',
      map: pbr.knurlAlbedo,
      roughnessMap: pbr.knurlMetallicRoughness,
      metalnessMap: pbr.knurlMetallicRoughness,
      normalMap: pbr.knurlNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 1.0,
      metalness: 1.0,
    }),
  );

  const aluminumBodyMat = regMat(
    new THREE.MeshStandardMaterial({
      name: 'DarkGrayAluminum_PBR',
      map: pbr.aluAlbedo,
      roughnessMap: pbr.aluMetallicRoughness,
      metalnessMap: pbr.aluMetallicRoughness,
      normalMap: pbr.aluNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 1.0,
      metalness: 1.0,
    }),
  );

  const silverBezelMat = regMat(
    new THREE.MeshStandardMaterial({
      name: 'SilverStainlessBezel_PBR',
      map: pbr.steelAlbedo,
      roughnessMap: pbr.steelMetallicRoughness,
      metalnessMap: pbr.steelMetallicRoughness,
      normalMap: pbr.steelNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughness: 1.0,
      metalness: 1.0,
    }),
  );

  const rubberMat = regMat(
    new THREE.MeshStandardMaterial({
      name: 'TacticalElastomer_PBR',
      color: 0x16181d,
      roughness: 0.88,
      metalness: 0.04,
    }),
  );

  const buttonMat = regMat(
    new THREE.MeshStandardMaterial({
      name: 'PowerButton_PBR',
      color: 0x22252b,
      emissive: 0x991b1b,
      emissiveIntensity: 0.35,
      roughness: 0.65,
      metalness: 0.1,
    }),
  );

  const reflectorMat = regMat(
    new THREE.MeshStandardMaterial({
      name: 'ParabolicReflector_Chrome',
      color: 0xf1f5f9,
      roughness: 0.07,
      metalness: 0.98,
    }),
  );

  const ledMat = regMat(
    new THREE.MeshStandardMaterial({
      name: 'TacticalLED_Emitter',
      map: pbr.ledDieAlbedo,
      color: 0xfffbeb,
      emissive: 0xfff3c4,
      emissiveMap: pbr.ledDieAlbedo,
      emissiveIntensity: 2.4,
      roughness: 0.16,
      metalness: 0.1,
    }),
  );

  const lensMat = regMat(
    new THREE.MeshStandardMaterial({
      name: 'OpticalGlassLens_PBR',
      color: 0xfff8e1,
      emissive: 0xfff3c4,
      emissiveIntensity: 1.5,
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    }),
  );

  const radialSegments = 48;

  // 1. Black Knurled Cylindrical Grip Handle (-Z: z = -0.156 to -0.012)
  // Closed manifold profile starting at (0, zMin) -> outer grip -> closed front cap (0, zMax)
  const gripPts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, -0.156),
    new THREE.Vector2(0.012, -0.156),
    new THREE.Vector2(0.014, -0.152),
    new THREE.Vector2(0.0225, -0.152),
    new THREE.Vector2(0.0242, -0.149),
    new THREE.Vector2(0.0242, -0.132),
    new THREE.Vector2(0.0234, -0.129),
    new THREE.Vector2(0.0218, -0.128),
    new THREE.Vector2(0.0218, -0.122),
    new THREE.Vector2(0.0232, -0.12),
    // Main knurled cylindrical grip handle extending along Z
    new THREE.Vector2(0.0232, -0.02),
    new THREE.Vector2(0.0218, -0.018),
    new THREE.Vector2(0.0218, -0.012),
    new THREE.Vector2(0.0, -0.012),
  ];
  const gripGeo = regGeo(new THREE.LatheGeometry(gripPts, radialSegments));
  gripGeo.rotateX(Math.PI / 2);
  gripGeo.computeVertexNormals();
  const gripMesh = new THREE.Mesh(gripGeo, gripKnurlMat);
  gripMesh.name = 'KnurledGripHandle';
  gripMesh.castShadow = true;
  gripMesh.receiveShadow = true;
  group.add(gripMesh);

  // Recessed Matte-Rubber Tail Switch Dome (-Z butt at z = -0.156)
  const tailCapPts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, -0.1585),
    new THREE.Vector2(0.008, -0.1583),
    new THREE.Vector2(0.0112, -0.157),
    new THREE.Vector2(0.0118, -0.153),
    new THREE.Vector2(0.0, -0.153),
  ];
  const tailCapGeo = regGeo(new THREE.LatheGeometry(tailCapPts, 28));
  tailCapGeo.rotateX(Math.PI / 2);
  tailCapGeo.computeVertexNormals();
  const tailSwitchMesh = new THREE.Mesh(tailCapGeo, rubberMat);
  tailSwitchMesh.name = 'TailSwitchBoot';
  group.add(tailSwitchMesh);

  // 2. Metallic Dark-Gray Aluminum Body + 5 Machined Cooling Fins + Concave Head Seat
  // (z = -0.014 to +0.106, overlapping 2mm into grip collar -> watertight single manifold)
  const bodyPts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, -0.014),
    new THREE.Vector2(0.0228, -0.014),
    // Switch collar section
    new THREE.Vector2(0.0258, -0.0115),
    new THREE.Vector2(0.0258, 0.021),
    // Tapered transition shoulder into cooling-fin neck
    new THREE.Vector2(0.0295, 0.0245),
    new THREE.Vector2(0.0375, 0.033),
  ];

  // 5 Precision Machined Cooling Fins near the Head (z = 0.034 to 0.073)
  const finCount = 5;
  const finStartZ = 0.034;
  const finPitch = 0.0076;
  for (let i = 0; i < finCount; i++) {
    const z0 = finStartZ + i * finPitch;
    // Chamfered fin crest (r = 0.0405)
    bodyPts.push(new THREE.Vector2(0.0405, z0 + 0.0005));
    bodyPts.push(new THREE.Vector2(0.0405, z0 + 0.0036));
    // Deep machined cooling channel valley (r = 0.0315)
    bodyPts.push(new THREE.Vector2(0.0315, z0 + 0.0044));
    bodyPts.push(new THREE.Vector2(0.0315, z0 + 0.0068));
  }

  // Flared Tactical Head Barrel -> Front Lip -> Internal Concave Bowl Seat
  bodyPts.push(
    new THREE.Vector2(0.0412, 0.0728),
    new THREE.Vector2(0.0432, 0.076),
    new THREE.Vector2(0.0432, 0.104),
    new THREE.Vector2(0.0412, 0.106),
    new THREE.Vector2(0.036, 0.106),
    // Descend inward into internal cavity so reflector nests cleanly
    new THREE.Vector2(0.035, 0.086),
    new THREE.Vector2(0.0, 0.084),
  );

  const bodyGeo = regGeo(new THREE.LatheGeometry(bodyPts, radialSegments));
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(bodyGeo, aluminumBodyMat);
  bodyMesh.name = 'AluminumBodyAndCoolingFins';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 3. Side Power Button Assembly (seated flush on +X switch collar at z = +0.005)
  const sideBtnGroup = new THREE.Group();
  sideBtnGroup.name = 'SidePowerButton';
  sideBtnGroup.position.set(0.0242, 0, 0.005);

  const btnHousingGeo = regGeo(new THREE.CylinderGeometry(0.0084, 0.0092, 0.006, 24));
  btnHousingGeo.rotateZ(-Math.PI / 2);
  const btnHousing = new THREE.Mesh(btnHousingGeo, silverBezelMat);
  btnHousing.name = 'PowerButtonBezel';
  sideBtnGroup.add(btnHousing);

  const btnCapGeo = regGeo(new THREE.CylinderGeometry(0.0056, 0.0064, 0.0048, 24));
  btnCapGeo.rotateZ(-Math.PI / 2);
  const btnCap = new THREE.Mesh(btnCapGeo, buttonMat);
  btnCap.name = 'PowerButtonCap';
  btnCap.position.x = 0.0032;
  sideBtnGroup.add(btnCap);

  group.add(sideBtnGroup);

  // 4. Parabolic Reflector Dish, Multi-Die Glowing LED Emitter & Optical Lens (+Z)
  const reflectorPts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0845),
    new THREE.Vector2(0.0115, 0.0845),
    new THREE.Vector2(0.02, 0.0895),
    new THREE.Vector2(0.0285, 0.0965),
    new THREE.Vector2(0.0354, 0.1045),
    new THREE.Vector2(0.0358, 0.1045),
    new THREE.Vector2(0.0358, 0.0845),
    new THREE.Vector2(0.0, 0.0845),
  ];
  const reflectorGeo = regGeo(new THREE.LatheGeometry(reflectorPts, radialSegments));
  reflectorGeo.rotateX(Math.PI / 2);
  reflectorGeo.computeVertexNormals();
  const reflectorMesh = new THREE.Mesh(reflectorGeo, reflectorMat);
  reflectorMesh.name = 'ParabolicReflector';
  group.add(reflectorMesh);

  const ledGeo = regGeo(new THREE.CylinderGeometry(0.01, 0.011, 0.0042, 24));
  ledGeo.rotateX(Math.PI / 2);
  const ledMesh = new THREE.Mesh(ledGeo, ledMat);
  ledMesh.name = 'GlowingLedEmitter';
  ledMesh.position.z = 0.0875;
  group.add(ledMesh);

  const lensGeo = regGeo(new THREE.CylinderGeometry(0.0354, 0.0354, 0.0042, radialSegments));
  lensGeo.rotateX(Math.PI / 2);
  const lensMesh = new THREE.Mesh(lensGeo, lensMat);
  lensMesh.name = 'GlowingOpticalLens';
  lensMesh.position.z = 0.1072;
  group.add(lensMesh);

  // 5. Silver Crenellated Strike Bezel pointing straight forward (+Z: z = +0.102 to +0.129)
  const bezelGroup = new THREE.Group();
  bezelGroup.name = 'SilverCrenellatedBezel';

  // Closed annular machined steel base collar
  const bezelRingPts: THREE.Vector2[] = [
    new THREE.Vector2(0.0352, 0.102),
    new THREE.Vector2(0.0436, 0.102),
    new THREE.Vector2(0.0438, 0.104),
    new THREE.Vector2(0.0438, 0.115),
    new THREE.Vector2(0.0422, 0.117),
    new THREE.Vector2(0.0364, 0.117),
    new THREE.Vector2(0.0352, 0.115),
    new THREE.Vector2(0.0352, 0.102),
  ];
  const bezelRingGeo = regGeo(new THREE.LatheGeometry(bezelRingPts, radialSegments));
  bezelRingGeo.rotateX(Math.PI / 2);
  bezelRingGeo.computeVertexNormals();
  const bezelRingMesh = new THREE.Mesh(bezelRingGeo, silverBezelMat);
  bezelRingMesh.name = 'BezelBaseRing';
  bezelRingMesh.castShadow = true;
  bezelGroup.add(bezelRingMesh);

  // 6 Watertight Beveled Crenellated Strike Prongs protruding forward along +Z
  const rToothIn = 0.0368;
  const rToothOut = 0.0432;
  const toothHalfAngle = THREE.MathUtils.degToRad(14);
  const toothShape = new THREE.Shape();
  toothShape.moveTo(rToothIn * Math.cos(-toothHalfAngle), rToothIn * Math.sin(-toothHalfAngle));
  toothShape.lineTo(rToothOut * Math.cos(-toothHalfAngle), rToothOut * Math.sin(-toothHalfAngle));
  toothShape.absarc(0, 0, rToothOut, -toothHalfAngle, toothHalfAngle, false);
  toothShape.lineTo(rToothIn * Math.cos(toothHalfAngle), rToothIn * Math.sin(toothHalfAngle));
  toothShape.absarc(0, 0, rToothIn, toothHalfAngle, -toothHalfAngle, true);
  toothShape.closePath();

  const toothGeo = regGeo(
    new THREE.ExtrudeGeometry(toothShape, {
      depth: 0.0145,
      bevelEnabled: true,
      bevelThickness: 0.0012,
      bevelSize: 0.0008,
      bevelSegments: 2,
      curveSegments: 8,
    }),
  );
  toothGeo.computeVertexNormals();

  const toothCount = 6;
  for (let i = 0; i < toothCount; i++) {
    const toothMesh = new THREE.Mesh(toothGeo, silverBezelMat);
    toothMesh.name = `CrenellatedProng_${i + 1}`;
    toothMesh.position.z = 0.1145;
    toothMesh.rotation.z = (i * Math.PI * 2) / toothCount;
    toothMesh.castShadow = true;
    bezelGroup.add(toothMesh);
  }

  group.add(bezelGroup);

  return {
    group,
    lensMat,
    ledMat,
    buttonMat,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      pbr.dispose();
    },
  };
}

/**
 * Exports the watertight, +Z-forward PBR tactical flashlight as a binary GLB file
 * ready for Unreal, Unity, Godot, Blender, or glTF viewers.
 */
export async function exportTacticalFlashlightGlb(): Promise<Blob> {
  const model = createTacticalFlashlightModel();
  const exporter = new GLTFExporter();
  try {
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        model.group,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const json = JSON.stringify(result);
            resolve(new TextEncoder().encode(json).buffer);
          }
        },
        (err) => reject(err),
        {
          binary: true,
          onlyVisible: true,
        },
      );
    });
    return new Blob([buffer], { type: 'model/gltf-binary' });
  } finally {
    model.dispose();
  }
}

export function createFlashlightRig(): THREE.Group {
  const rig = new THREE.Group();
  const model = createTacticalFlashlightModel();

  // Rotate +Z-forward flashlight by Math.PI around Y so in Three.js FPS camera space (-Z forward),
  // the glowing LED lens and silver crenellated bezel point straight forward down the corridor (-Z)
  // while the black knurled grip handle extends back toward the player (+Z) and the side power
  // button (+X in model space) faces inward toward the player's camera view (-X).
  model.group.rotation.y = Math.PI;
  model.group.scale.setScalar(0.92);
  rig.add(model.group);

  // Subtle metallic bounce fill light illuminating the cooling fins, dark-gray body, and silver bezel
  const rigFillLight = new THREE.PointLight(0xeef6ff, 0.24, 0.65, 1.5);
  rigFillLight.position.set(-0.14, 0.14, -0.06);
  rig.add(rigFillLight);

  rig.userData.lensMat = model.lensMat;
  rig.userData.ledMat = model.ledMat;
  rig.userData.rigFillLight = rigFillLight;
  rig.userData.dispose = model.dispose;
  rig.position.set(0.22, -0.20, -0.49);
  rig.rotation.set(0.055, 0.14, -0.04);

  return rig;
}

