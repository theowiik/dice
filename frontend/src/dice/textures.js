import * as THREE from 'three';

const CELL = 256;
const DEFAULT_FONT = '"Unbounded", system-ui, sans-serif';

const PIP_LAYOUT = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
};

function drawPips(ctx, value, cx, cy, size) {
  const spacing = size * 0.26;
  const r = value === 1 ? size * 0.13 : size * 0.085;
  for (const [x, y] of PIP_LAYOUT[value] ?? PIP_LAYOUT[1]) {
    ctx.beginPath();
    ctx.arc(cx + x * spacing, cy + y * spacing, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNumber(ctx, value, face, cx, cy, font, underline) {
  const text = String(value);
  // Room for text in canvas pixels: face inradius mapped through the UV scale.
  const rho = (face.inradius / face.radius) * CELL * 0.48 * 0.9;
  ctx.font = `700 100px ${font}`;
  const perPx = ctx.measureText(text).width / 100;
  const capH = 0.72;
  const size = Math.min(
    (2 * rho) / Math.sqrt(perPx * perPx + capH * capH),
    rho * 1.25,
  );
  ctx.font = `700 ${size}px ${font}`;
  ctx.fillText(text, cx, cy + size * 0.03);
  if (underline) {
    const w = ctx.measureText(text).width;
    ctx.fillRect(cx - w / 2, cy + size * 0.42, w, Math.max(3, size * 0.07));
  }
}

/**
 * Paint every face into an atlas. Returns a color canvas plus a mask
 * (ink = white) used for bump, metalness and emissive maps.
 */
export function createAtlas(shape) {
  const color = document.createElement('canvas');
  const mask = document.createElement('canvas');
  for (const c of [color, mask]) {
    c.width = shape.cols * CELL;
    c.height = shape.rows * CELL;
  }
  return { color, mask };
}

export function paintAtlas(atlas, shape, labels, theme, sides) {
  const cctx = atlas.color.getContext('2d');
  const mctx = atlas.mask.getContext('2d');
  const font = theme.font ?? DEFAULT_FONT;
  const { width, height } = atlas.color;

  cctx.fillStyle = theme.body;
  cctx.fillRect(0, 0, width, height);
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, width, height);

  for (const ctx of [cctx, mctx]) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }
  cctx.fillStyle = theme.ink;
  mctx.fillStyle = '#fff';

  shape.faces.forEach((face, i) => {
    const cx = (i % shape.cols) * CELL + CELL / 2;
    const cy = Math.floor(i / shape.cols) * CELL + CELL / 2;
    const value = labels[i];
    const underline = sides >= 9 && (value === 6 || value === 9);
    for (const ctx of [cctx, mctx]) {
      if (theme.pips && value <= 6) {
        drawPips(ctx, value, cx, cy, CELL * 0.92);
      } else {
        drawNumber(ctx, value, face, cx, cy, font, underline);
      }
    }
  });

  // Soften the mask so the bump map reads as a carved groove.
  mctx.filter = 'blur(1.5px)';
  mctx.drawImage(atlas.mask, 0, 0);
  mctx.filter = 'none';
}

export function createDieMaterial(atlas, theme) {
  const map = new THREE.CanvasTexture(atlas.color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const mask = new THREE.CanvasTexture(atlas.mask);
  mask.anisotropy = 8;

  const material = new THREE.MeshPhysicalMaterial({
    map,
    roughness: theme.roughness,
    clearcoat: theme.clearcoat,
    clearcoatRoughness: 0.16,
    bumpMap: mask,
    bumpScale: -2.5,
  });

  if (theme.inkMetal) {
    material.metalnessMap = mask;
    material.metalness = 1;
  } else if (theme.bodyMetal) {
    const inverted = document.createElement('canvas');
    inverted.width = atlas.mask.width;
    inverted.height = atlas.mask.height;
    const ictx = inverted.getContext('2d');
    ictx.filter = 'invert(1)';
    ictx.drawImage(atlas.mask, 0, 0);
    const inv = new THREE.CanvasTexture(inverted);
    material.metalnessMap = inv;
    material.metalness = 1;
    material.userData.inverted = { canvas: inverted, texture: inv };
  }

  if (theme.emissive) {
    material.emissive = new THREE.Color(theme.glow);
    material.emissiveIntensity = theme.emissive;
    // Glow everywhere except the carved numbers.
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = atlas.mask.width;
    glowCanvas.height = atlas.mask.height;
    const gctx = glowCanvas.getContext('2d');
    gctx.filter = 'invert(1)';
    gctx.drawImage(atlas.mask, 0, 0);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    material.emissiveMap = glowTex;
    material.userData.glow = { canvas: glowCanvas, texture: glowTex };
  }

  material.userData.refresh = () => {
    map.needsUpdate = true;
    mask.needsUpdate = true;
    for (const extra of [material.userData.inverted, material.userData.glow]) {
      if (!extra) continue;
      const ctx = extra.canvas.getContext('2d');
      ctx.filter = 'invert(1)';
      ctx.drawImage(atlas.mask, 0, 0);
      ctx.filter = 'none';
      extra.texture.needsUpdate = true;
    }
  };
  return material;
}
