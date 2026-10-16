import * as THREE from 'three';

const COUNT = { stem: 700, cap: 1500, dust: 700, ember: 260 };
const LIFE = 11;
const GRAVITY = -14;

const rand = (a, b) => a + Math.random() * (b - a);
const grow = (t, tau) => 1 - Math.exp(-t / tau);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Heat ramp: white-hot -> orange -> deep red -> grey smoke. Values above 1
// are intentional so the bloom pass makes the fireball glow.
const RAMP = [
  [0, [0.13, 0.115, 0.105]],
  [0.18, [0.55, 0.12, 0.04]],
  [0.45, [2.4, 0.85, 0.18]],
  [0.75, [4, 2.6, 1.1]],
  [1, [6, 5.2, 4]],
];

function heatColor(h, out) {
  for (let i = 1; i < RAMP.length; i++) {
    if (h <= RAMP[i][0]) {
      const [h0, c0] = RAMP[i - 1];
      const [h1, c1] = RAMP[i];
      const k = (h - h0) / (h1 - h0);
      out[0] = c0[0] + (c1[0] - c0[0]) * k;
      out[1] = c0[1] + (c1[1] - c0[1]) * k;
      out[2] = c0[2] + (c1[2] - c0[2]) * k;
      return out;
    }
  }
  return out;
}

function makeSmokeSprite() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = size / 2 + rand(-22, 22);
    const y = size / 2 + rand(-22, 22);
    const r = rand(18, 40);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(c);
}

function makeScorchTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // alphaMap samples luminance, so paint white on black (no transparency).
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 120);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.35, '#bbb');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Streaks radiating out from ground zero.
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    ctx.strokeStyle = `rgba(0,0,0,${rand(0.2, 0.6)})`;
    ctx.lineWidth = rand(1, 5);
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 50, 128 + Math.sin(a) * 50);
    ctx.lineTo(128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

const vertexShader = /* glsl */ `
  attribute float size;
  attribute vec4 tint;
  uniform float scale;
  varying vec4 vTint;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
    vTint = tint;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec4 vTint;
  void main() {
    float a = texture2D(map, gl_PointCoord).a * vTint.a;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vTint.rgb, a);
  }
`;

/**
 * Mushroom cloud built from analytic particle paths: a fireball that
 * swells into a rolling toroidal cap on a rising stem, a ground dust
 * ring and ballistic embers.
 */
export class NukeEffect {
  constructor(scene) {
    const total = COUNT.stem + COUNT.cap + COUNT.dust + COUNT.ember;
    this.total = total;
    this.positions = new Float32Array(total * 3);
    this.tints = new Float32Array(total * 4);
    this.sizes = new Float32Array(total);
    this.kind = new Uint8Array(total);
    this.seed = new Float32Array(total * 4);
    this.velocity = new Float32Array(total * 3);

    let i = 0;
    for (const [kind, n] of [
      [0, COUNT.stem],
      [1, COUNT.cap],
      [2, COUNT.dust],
      [3, COUNT.ember],
    ]) {
      for (let k = 0; k < n; k++, i++) {
        this.kind[i] = kind;
        this.seed.set(
          [
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random(),
            Math.random(),
          ],
          i * 4,
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('tint', new THREE.BufferAttribute(this.tints, 4));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: makeSmokeSprite() },
        scale: { value: 400 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);

    this.light = new THREE.PointLight('#ffb36b', 0, 0, 2);
    scene.add(this.light);

    this.scorch = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: '#050302',
        alphaMap: makeScorchTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.visible = false;
    scene.add(this.scorch);

    this.origin = new THREE.Vector3();
    this.t = 0;
    this.active = false;
  }

  setViewport(heightPx, fovDeg) {
    this.material.uniforms.scale.value =
      heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  start(origin) {
    this.origin.set(origin.x, 0, origin.z);
    this.t = 0;
    this.active = true;
    this.points.visible = true;
    for (let i = 0; i < this.total; i++) {
      if (this.kind[i] !== 3) continue;
      const a = Math.random() * Math.PI * 2;
      const up = rand(0.25, 1);
      const s = rand(5, 16);
      const r = Math.sqrt(1 - up * up);
      this.velocity.set(
        [Math.cos(a) * r * s, up * s, Math.sin(a) * r * s],
        i * 3,
      );
    }
    this.scorch.position.set(this.origin.x, 0.012, this.origin.z);
    this.scorch.scale.setScalar(0.1);
    this.scorch.visible = true;
    this.scorch.material.opacity = 0.75;
  }

  /** Cloud height, so the camera can frame it. */
  get height() {
    return 7.5 * grow(this.t, 2.2);
  }

  /** 0..1 brightness of the fireball, used to tint the scene. */
  get heat() {
    if (!this.active) return 0;
    return Math.exp(-this.t / 1.6);
  }

  get done() {
    return this.t >= LIFE;
  }

  /** Fade the scorch mark back into the felt once the cloud is gone. */
  fadeScorch(dt) {
    if (!this.scorch.visible) return;
    const m = this.scorch.material;
    m.opacity = Math.max(0, m.opacity - dt * 0.12);
    if (m.opacity <= 0) this.scorch.visible = false;
  }

  update(dt) {
    if (!this.active) {
      this.fadeScorch(dt);
      return;
    }
    this.t += dt;
    const t = this.t;
    const O = this.origin;
    const H = this.height;
    const fade = 1 - smoothstep(LIFE - 3.5, LIFE, t);
    const color = [0, 0, 0];

    const fireR = 2.1 * grow(t, 0.22);
    const capK = smoothstep(0.15, 1.3, t);
    const R = 0.5 + 2.3 * grow(t, 2);
    const r = 0.45 + 1.15 * grow(t, 1.8);
    const P = this.positions;
    const C = this.tints;
    const S = this.sizes;
    const V = this.velocity;
    const seed = this.seed;

    for (let i = 0; i < this.total; i++) {
      const phi = seed[i * 4];
      const th0 = seed[i * 4 + 1];
      const f = seed[i * 4 + 2];
      const g = seed[i * 4 + 3];
      const k3 = i * 3;
      let x;
      let y;
      let z;
      let heat;
      let alpha;
      let size;

      switch (this.kind[i]) {
        case 0: {
          // Stem: a twisting column, flared into a skirt at the ground.
          const yy = f * H * 0.95;
          const flare = 1.4 * Math.exp(-yy * 1.4) * grow(t, 0.8);
          const rad = (0.28 + 0.35 * g + flare) * (0.6 + 0.4 * capK);
          const a = phi + t * (0.9 - f * 0.5);
          x = Math.cos(a) * rad;
          z = Math.sin(a) * rad;
          y = yy;
          heat = Math.exp(-t / (1 + f * 1.6)) * (1.05 - f * 0.3);
          alpha = 0.55 * smoothstep(0, 0.6, t);
          size = 0.65 + t * 0.09 + g * 0.4;
          break;
        }
        case 1: {
          // Cap: particles circulate around a growing torus, rolling
          // outward over the top like a real mushroom cloud.
          const rr = r * Math.cbrt(f);
          const th = th0 - t * 1.25 * (0.7 + g * 0.6);
          const wob = Math.sin(phi * 5 + t * 1.3) * 0.15 * r;
          const ring = R + rr * Math.cos(th) + wob;
          const cx = Math.cos(phi) * ring;
          const cz = Math.sin(phi) * ring;
          const cy = H + rr * Math.sin(th) * 0.8;
          // Fireball: a swelling sphere that lifts off the table.
          const sp = Math.sqrt(1 - (2 * g - 1) ** 2);
          const fr = fireR * Math.cbrt(f);
          const fx = Math.cos(phi) * sp * fr;
          const fz = Math.sin(phi) * sp * fr;
          const fy = fr * (2 * g - 1) * 0.85 + fireR * 0.9;
          x = fx + (cx - fx) * capK;
          y = fy + (cy - fy) * capK;
          z = fz + (cz - fz) * capK;
          const core = 1 - f * 0.55;
          heat = Math.exp(-t / (1.1 + core * 1.4)) * (0.6 + core * 0.45);
          alpha = 0.6 * smoothstep(0, 0.08, t);
          size = 0.8 + t * 0.13 + g * 0.6;
          break;
        }
        case 2: {
          // Ground dust: a ring blasting outward across the felt.
          const d = (0.6 + 7.5 * grow(t, 1.1)) * (0.2 + 0.8 * Math.sqrt(f));
          x = Math.cos(phi) * d;
          z = Math.sin(phi) * d;
          y = 0.1 + g * 0.35 * Math.min(1, t) + d * 0.02;
          heat = Math.exp(-t / 0.5) * 0.7;
          alpha = 0.22 * smoothstep(0, 0.15, t) * (1 - smoothstep(3, 8, t));
          size = 0.9 + t * 0.15 + g * 0.6;
          break;
        }
        default: {
          // Embers: ballistic sparks that bounce on the table.
          const tt = Math.min(t, 3);
          x = V[k3] * tt * 0.85;
          z = V[k3 + 2] * tt * 0.85;
          y = Math.max(0.05, 0.5 + V[k3 + 1] * tt + 0.5 * GRAVITY * tt * tt);
          heat = Math.max(0, 0.95 - t * 0.3);
          alpha = t < 3 ? 1 - t / 3 : 0;
          size = 0.12 + g * 0.1;
          break;
        }
      }

      P[k3] = O.x + x;
      P[k3 + 1] = y;
      P[k3 + 2] = O.z + z;
      heatColor(Math.min(1, Math.max(0, heat)), color);
      // Underside of the cloud picks up the fireball's glow.
      const under = Math.exp(-t / 2.5) * smoothstep(H, 0, y) * 0.6;
      C[i * 4] = color[0] + under * 1.4;
      C[i * 4 + 1] = color[1] + under * 0.5;
      C[i * 4 + 2] = color[2] + under * 0.1;
      C[i * 4 + 3] = alpha * fade;
      S[i] = size;
    }

    const attrs = this.points.geometry.attributes;
    attrs.position.needsUpdate = true;
    attrs.tint.needsUpdate = true;
    attrs.size.needsUpdate = true;

    this.light.position.set(O.x, Math.max(1.5, H * 0.75), O.z);
    this.light.intensity = 900 * this.heat * fade + 30 * fade;
    this.scorch.scale.setScalar(1 + 6 * grow(t, 0.5));

    if (this.done) {
      this.active = false;
      this.points.visible = false;
      this.light.intensity = 0;
    }
  }
}
