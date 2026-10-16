import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { DiceAudio } from './audio';
import { buildShape, SHAPES, shapeForSides, topFace } from './geometry';
import { NukeEffect } from './nuke';
import { createAtlas, createDieMaterial, paintAtlas } from './textures';
import { THEMES, themeForSides } from './themes';

const DT = 1 / 120;
const GRAVITY = -45;
const MAX_SIM_SECONDS = 8;
const PICKUP_SECONDS = 0.38;
const HOLD_HEIGHT = 3.4;
const MAX_THROW_SPEED = 26;
const BASE_ELEVATION = THREE.MathUtils.degToRad(58);
const ZOOM_ELEVATION = THREE.MathUtils.degToRad(66);
const VIEW_SHIFT = 0.12;
const BG = '#0b0908';
const BLAST_TINT = new THREE.Color('#6b3010');
const NUKE_VALUE = 500;
const CHARGE_SECONDS = 1.9;
const BLAST_DELAY = 1.1;
const BLOOM_STRENGTH = 0.5;
const NUKE_SAMPLE = `${import.meta.env.BASE_URL}nuke.mp3`;

const rand = (a, b) => a + Math.random() * (b - a);
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const damp = (current, target, lambda, dt) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function makeSoftDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeFeltTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 118 + Math.random() * 28;
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  return tex;
}

class Sparks {
  constructor(scene, texture) {
    this.count = 260;
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.16,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.age = 0;
    this.life = 1.8;
  }

  burst(origin, color) {
    this.material.color.set(color).multiplyScalar(3);
    for (let i = 0; i < this.count; i++) {
      this.positions.set([origin.x, origin.y + 0.4, origin.z], i * 3);
      const theta = Math.random() * Math.PI * 2;
      const up = rand(0.3, 1);
      const speed = rand(3, 10);
      const r = Math.sqrt(1 - up * up);
      this.velocities.set(
        [
          Math.cos(theta) * r * speed,
          up * speed * 1.3,
          Math.sin(theta) * r * speed,
        ],
        i * 3,
      );
    }
    this.age = 0;
    this.points.visible = true;
  }

  update(dt) {
    if (!this.points.visible) return;
    this.age += dt;
    const p = this.positions;
    const v = this.velocities;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      v[k + 1] -= 14 * dt;
      v[k] *= 0.985;
      v[k + 2] *= 0.985;
      p[k] += v[k] * dt;
      p[k + 1] += v[k + 1] * dt;
      p[k + 2] += v[k + 2] * dt;
      if (p[k + 1] < 0.05) {
        p[k + 1] = 0.05;
        v[k + 1] *= -0.4;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.material.opacity = Math.max(0, 1 - this.age / this.life);
    if (this.age > this.life) this.points.visible = false;
  }
}

class Shockwave {
  constructor(scene) {
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 96),
      this.material,
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.age = 0;
  }

  fire(origin, color, strength) {
    this.mesh.position.set(origin.x, 0.03, origin.z);
    this.material.color.set(color).multiplyScalar(1.5 * strength);
    this.strength = strength;
    this.age = 0;
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.mesh.visible) return;
    this.age += dt;
    const t = this.age / 0.9;
    const s = 1 + (1 - (1 - t) ** 3) * 4 * this.strength;
    this.mesh.scale.setScalar(s);
    this.material.opacity = Math.max(0, 1 - t);
    if (t >= 1) this.mesh.visible = false;
  }
}

/**
 * Owns the three.js scene, cannon-es physics and audio. Each throw is
 * simulated up front, then replayed, so the outcome is known before the
 * die lands and huge custom dice can be labelled to match.
 */
export class DiceEngine {
  constructor(container, { onResult, onFlash, onNukeEnd } = {}) {
    this.container = container;
    this.onResult = onResult;
    this.onFlash = onFlash;
    this.onNukeEnd = onNukeEnd;
    this.audio = new DiceAudio();
    this.dice = new Map();
    this.state = 'idle';
    this.elapsed = 0;
    this.last = performance.now();
    this.halfX = 5;
    this.halfZ = 3.3;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.initRenderer();
    this.initScene();
    this.initPhysics();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    this.setSides(20);
    this.cam = {
      target: new THREE.Vector3(0, 0.8, 0),
      dist: this.baseDist * 1.3,
      az: -0.6,
      el: BASE_ELEVATION,
    };

    if (document.fonts?.load) {
      Promise.all([document.fonts.load('700 64px "Unbounded"')])
        .then(() => {
          for (const die of this.dice.values()) this.repaint(die);
        })
        .catch(() => {});
    }

    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;
  }

  initScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 16, 34);
    this.scene = scene;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this.envTexture;
    scene.environmentIntensity = 0.6;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120);

    const spot = new THREE.SpotLight('#fff1dc', 1.6, 0, 0.62, 0.75, 0);
    spot.position.set(2.5, 17, 5);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 6;
    spot.shadow.camera.far = 40;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    spot.shadow.radius = 5;
    scene.add(spot, spot.target);

    scene.add(new THREE.HemisphereLight('#ffe8cc', '#1a1410', 0.35));

    const rim = new THREE.DirectionalLight('#8fb4ff', 0.9);
    rim.position.set(-6, 5, -9);
    scene.add(rim);

    this.glowLight = new THREE.PointLight('#ffffff', 0, 9, 2);
    scene.add(this.glowLight);

    const felt = makeFeltTexture();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({
        color: '#3a302a',
        roughness: 0.95,
        metalness: 0,
        map: felt,
        bumpMap: felt,
        bumpScale: 0.6,
      }),
    );
    felt.colorSpace = THREE.SRGBColorSpace;
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.floor = floor;

    const dot = makeSoftDot();
    this.sparks = new Sparks(scene, dot);
    this.shockwave = new Shockwave(scene);
    this.nuke = new NukeEffect(scene);

    // Faint dust motes drifting through the light cone.
    const moteCount = 160;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos.set([rand(-9, 9), rand(0.5, 8), rand(-7, 7)], i * 3);
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    this.motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        size: 0.05,
        map: dot,
        color: '#ffe2b8',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(this.motes);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(256, 256),
      BLOOM_STRENGTH,
      0.55,
      0.8,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  initPhysics() {
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, GRAVITY, 0),
    });
    world.allowSleep = true;
    world.solver.iterations = 18;
    this.dieMaterial = new CANNON.Material('die');
    const floorMat = new CANNON.Material('floor');
    const wallMat = new CANNON.Material('wall');
    world.addContactMaterial(
      new CANNON.ContactMaterial(this.dieMaterial, floorMat, {
        friction: 0.32,
        restitution: 0.38,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3,
      }),
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(this.dieMaterial, wallMat, {
        friction: 0.08,
        restitution: 0.55,
      }),
    );

    const floor = new CANNON.Body({ mass: 0, material: floorMat });
    floor.addShape(new CANNON.Plane());
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor);

    this.walls = [
      [0, -Math.PI / 2],
      [0, Math.PI / 2],
      [0, 0],
      [0, Math.PI],
    ].map(([x, y]) => {
      const wall = new CANNON.Body({ mass: 0, material: wallMat });
      wall.addShape(new CANNON.Plane());
      wall.quaternion.setFromEuler(x, y, 0);
      world.addBody(wall);
      return wall;
    });
    this.world = world;
  }

  layoutWalls() {
    const [right, left, back, front] = this.walls;
    right.position.set(this.halfX, 0, 0);
    left.position.set(-this.halfX, 0, 0);
    back.position.set(0, 0, -this.halfZ);
    front.position.set(0, 0, this.halfZ);
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);

    if (aspect >= 1) {
      this.halfZ = 4.4;
      this.halfX = Math.min(4.4 * aspect, 8.5);
    } else {
      this.halfX = 3.4;
      this.halfZ = Math.min((3.4 / aspect) * 0.72, 7);
    }
    this.layoutWalls();

    const cam = this.camera;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    const corners = [];
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        for (const y of [0, 1.2])
          corners.push(new THREE.Vector3(x * this.halfX, y, z * this.halfZ));
    let lo = 4;
    let hi = 90;
    const p = new THREE.Vector3();
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      this.placeCamera(new THREE.Vector3(), mid, 0, BASE_ELEVATION);
      const fits = corners.every((c) => {
        p.copy(c).project(cam);
        return Math.abs(p.x) <= 0.94 && Math.abs(p.y) <= 0.74;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    this.baseDist = hi;

    // Nudge the projection so the table sits a little above the controls.
    cam.projectionMatrix.elements[9] = -VIEW_SHIFT;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    this.bloom.resolution.set(w, h);
    this.nuke.setViewport(h, cam.fov);
  }

  placeCamera(target, dist, az, el) {
    const cam = this.camera;
    cam.position.set(
      target.x + Math.sin(az) * Math.cos(el) * dist,
      target.y + Math.sin(el) * dist,
      target.z + Math.cos(az) * Math.cos(el) * dist,
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    cam.updateMatrixWorld();
  }

  getDie(sides) {
    const shapeKey = shapeForSides(sides);
    const themeKey = themeForSides(sides);
    const standard =
      SHAPES[shapeKey] && { 6: 1, 8: 1, 10: 1, 12: 1, 20: 1 }[sides];
    const key = standard
      ? `${shapeKey}:${themeKey}`
      : `${shapeKey}:${themeKey}:x`;
    let die = this.dice.get(key);
    if (!die) {
      const shape = buildShape(shapeKey);
      const theme = THEMES[themeKey];
      const atlas = createAtlas(shape);
      die = { key, shape, theme, atlas, standard: Boolean(standard), sides };
      die.labels = standard ? shape.labels : this.randomLabels(die, sides);
      paintAtlas(atlas, shape, die.labels, theme, sides);
      die.material = createDieMaterial(atlas, theme);
      die.mesh = new THREE.Mesh(shape.geometry, die.material);
      die.mesh.castShadow = true;
      die.body = new CANNON.Body({
        mass: 1,
        material: this.dieMaterial,
        linearDamping: 0.08,
        angularDamping: 0.12,
        allowSleep: true,
        sleepSpeedLimit: 0.12,
        sleepTimeLimit: 0.25,
      });
      die.body.addShape(shape.physicsShape);
      this.dice.set(key, die);
    }
    return die;
  }

  repaint(die) {
    paintAtlas(die.atlas, die.shape, die.labels, die.theme, die.sides);
    die.material.userData.refresh();
  }

  randomLabels(die, sides, forced) {
    const count = die.shape.faces.length;
    const labels = new Array(count);
    const used = new Set();
    if (forced) {
      labels[forced.face] = forced.value;
      used.add(forced.value);
    }
    for (let i = 0; i < count; i++) {
      if (labels[i] !== undefined) continue;
      let v = randomInt(1, sides);
      for (
        let tries = 0;
        tries < 50 && sides >= count && used.has(v);
        tries++
      ) {
        v = randomInt(1, sides);
      }
      used.add(v);
      labels[i] = v;
    }
    return labels;
  }

  setSides(sides) {
    if (this.busy) return;
    const die = this.getDie(sides);
    if (die.sides !== sides && !die.standard) {
      die.sides = sides;
      die.labels = this.randomLabels(die, sides);
      this.repaint(die);
    }
    if (this.die === die) return;
    if (this.die) this.scene.remove(this.die.mesh);
    this.die = die;
    this.scene.add(die.mesh);
    this.glowLight.color.set(die.theme.glow);
    this.state = 'idle';
    this.popIn = 0;
    this.hoverSpin = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)),
    );
  }

  /** A hands-free throw from a random spot around the table edge. */
  randomThrow() {
    const hx = this.halfX;
    const hz = this.halfZ;
    const a = rand(0, Math.PI * 2);
    const position = new THREE.Vector3(
      Math.cos(a) * (hx - 1.3),
      rand(3.5, 4.5),
      Math.sin(a) * (hz - 1.3),
    );
    const aim = new THREE.Vector3(
      rand(-0.4, 0.4) * hx,
      0,
      rand(-0.4, 0.4) * hz,
    );
    const dir = aim.sub(position).setY(0).normalize();
    const speed = rand(12, 18);
    return {
      position,
      quaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)),
      ),
      velocity: new THREE.Vector3(dir.x * speed, rand(-3, 1.5), dir.z * speed),
      angular: new THREE.Vector3(rand(-22, 22), rand(-22, 22), rand(-22, 22)),
    };
  }

  simulate(die, init) {
    const body = die.body;
    const hx = this.halfX;
    const hz = this.halfZ;
    body.position.copy(init.position);
    body.quaternion.copy(init.quaternion);
    body.velocity.copy(init.velocity);
    body.angularVelocity.copy(init.angular);
    body.wakeUp();
    this.world.addBody(body);

    const start = {
      position: new THREE.Vector3().copy(body.position),
      quaternion: new THREE.Quaternion().copy(body.quaternion),
    };
    const maxSteps = Math.ceil(MAX_SIM_SECONDS / DT);
    const frames = new Float32Array(maxSteps * 7);
    const events = [];
    const prevV = body.velocity.clone();
    const prevW = body.angularVelocity.clone();
    let lastEvent = -1;
    let still = 0;
    let steps = 0;
    let settled = false;
    const r = SHAPES[die.shape.key].radius;

    for (; steps < maxSteps; steps++) {
      this.world.step(DT);
      const p = body.position;
      const q = body.quaternion;
      frames.set([p.x, p.y, p.z, q.x, q.y, q.z, q.w], steps * 7);

      const dvx = body.velocity.x - prevV.x;
      const dvy = body.velocity.y - prevV.y - GRAVITY * DT;
      const dvz = body.velocity.z - prevV.z;
      const dw = body.angularVelocity.vsub(prevW).length();
      const impulse = Math.hypot(dvx, dvy, dvz) + dw * r * 0.25;
      const t = (steps + 1) * DT;
      if (impulse > 1 && t - lastEvent > 0.035) {
        const nearWall =
          Math.abs(p.x) > hx - r * 1.3 || Math.abs(p.z) > hz - r * 1.3;
        const horizontal = Math.hypot(dvx, dvz) > Math.abs(dvy);
        events.push({
          t,
          strength: Math.min(1, impulse / 16),
          wall: nearWall && horizontal,
          pan: p.x / hx,
        });
        lastEvent = t;
      }
      prevV.copy(body.velocity);
      prevW.copy(body.angularVelocity);

      if (body.sleepState === CANNON.Body.SLEEPING) {
        settled = true;
        break;
      }
      if (
        body.velocity.length() < 0.04 &&
        body.angularVelocity.length() < 0.04
      ) {
        still++;
        if (still > 40) {
          settled = true;
          break;
        }
      } else {
        still = 0;
      }
    }
    this.world.removeBody(body);
    const count = Math.min(steps + 1, maxSteps);
    const k = (count - 1) * 7;
    const finalQ = new THREE.Quaternion(
      frames[k + 3],
      frames[k + 4],
      frames[k + 5],
      frames[k + 6],
    );
    const face = topFace(die.shape, finalQ);
    const flat =
      die.shape.faces[face].normal.clone().applyQuaternion(finalQ).y > 0.97;
    return { start, frames, count, events, face, ok: settled && flat };
  }

  get busy() {
    return ['held', 'pickup', 'rolling', 'charging', 'nuke'].includes(
      this.state,
    );
  }

  /**
   * Throw the die. Returns false if a roll is already in progress.
   * `force` rigs the outcome on relabelled (non-standard) dice. With
   * `pointer` ({ clientX, clientY, pointerId }) the die is picked up and
   * follows the pointer until release, then flies off with that motion.
   */
  roll(sides, { force, pointer } = {}) {
    if (this.busy) return false;
    this.setSides(sides);
    this.audio.ensure();
    this.force = force;
    if (pointer) {
      this.grab(pointer);
    } else {
      this.throwDie(this.randomThrow(), false);
    }
    return true;
  }

  throwDie(init, fromHand) {
    const die = this.die;
    // Re-throw any simulation that ends cocked against a wall or jittering,
    // nudging the spin a little so the retry plays out differently.
    let sim = this.simulate(die, init);
    for (let tries = 0; tries < 8 && !sim.ok; tries++) {
      init.angular.add(
        new THREE.Vector3(rand(-5, 5), rand(-5, 5), rand(-5, 5)),
      );
      init.velocity.multiplyScalar(rand(0.9, 1.1));
      sim = this.simulate(die, init);
    }
    const { face } = sim;
    if (!die.standard) {
      die.labels = this.randomLabels(die, die.sides, {
        face,
        value: this.force ?? randomInt(1, die.sides),
      });
      this.repaint(die);
    }
    this.sim = sim;
    this.resultFace = face;
    this.stateTime = 0;
    this.nextEvent = 0;

    if (fromHand) {
      this.state = 'rolling';
      this.audio.whoosh();
      this.audio.startRolling();
    } else {
      this.pickupFrom = {
        position: die.mesh.position.clone(),
        quaternion: die.mesh.quaternion.clone(),
      };
      this.state = 'pickup';
      this.audio.rattle(PICKUP_SECONDS);
    }
  }

  grab(pointer) {
    this.state = 'held';
    this.stateTime = 0;
    this.pointer = {
      id: pointer.pointerId,
      x: pointer.clientX,
      y: pointer.clientY,
    };
    this.holdTarget = this.die.mesh.position.clone();
    this.holdTarget.y = HOLD_HEIGHT;
    this.holdVel = new THREE.Vector3();
    this.holdSpin = new THREE.Vector3();
    this.holdDrift = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1))
      .normalize()
      .multiplyScalar(2.5);
    this.holdSamples = [];
    this.shakeDir = null;
    this.lastShake = 0;
    this.container.style.cursor = 'grabbing';
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.audio.shake(0.35);
  }

  onPointerMove(event) {
    if (this.pointer?.id !== undefined && event.pointerId !== this.pointer.id)
      return;
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
  }

  onPointerUp(event) {
    if (this.pointer?.id !== undefined && event.pointerId !== this.pointer.id)
      return;
    this.release();
  }

  stopListening() {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.container.style.cursor = '';
  }

  /** Project the pointer onto the hold plane, kept inside the walls. */
  updateHoldTarget() {
    const rect = this.container.getBoundingClientRect();
    this.ndc.set(
      ((this.pointer.x - rect.left) / rect.width) * 2 - 1,
      -((this.pointer.y - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    if (direction.y > -1e-3) return;
    const t = (HOLD_HEIGHT - origin.y) / direction.y;
    const r = SHAPES[this.die.shape.key].radius + 0.3;
    this.holdTarget.set(
      THREE.MathUtils.clamp(
        origin.x + direction.x * t,
        -this.halfX + r,
        this.halfX - r,
      ),
      HOLD_HEIGHT,
      THREE.MathUtils.clamp(
        origin.z + direction.z * t,
        -this.halfZ + r,
        this.halfZ - r,
      ),
    );
  }

  /** Let go: the throw inherits the hand's velocity and spin. */
  release() {
    this.stopListening();
    if (this.state !== 'held') return;
    const mesh = this.die.mesh;
    mesh.scale.setScalar(1);

    const samples = this.holdSamples;
    const velocity = new THREE.Vector3();
    if (samples.length > 1) {
      const a = samples[0];
      const b = samples[samples.length - 1];
      const span = Math.max(1e-3, b.t - a.t);
      velocity.subVectors(b.p, a.p).divideScalar(span);
    }
    velocity.y = Math.min(velocity.y, 0) + rand(-2, 1);
    let speed = Math.hypot(velocity.x, velocity.z);
    if (speed > MAX_THROW_SPEED) {
      const k = MAX_THROW_SPEED / speed;
      velocity.x *= k;
      velocity.z *= k;
      speed = MAX_THROW_SPEED;
    }
    if (speed < 6) {
      // Barely moving when dropped: give it a toss toward the middle.
      const aim = new THREE.Vector3(
        rand(-0.35, 0.35) * this.halfX,
        0,
        rand(-0.35, 0.35) * this.halfZ,
      );
      const dir = aim.sub(mesh.position).setY(0);
      if (dir.lengthSq() < 1) dir.set(rand(-1, 1), 0, rand(-1, 1));
      dir.normalize().multiplyScalar(rand(8, 12));
      velocity.x = velocity.x * 0.5 + dir.x;
      velocity.z = velocity.z * 0.5 + dir.z;
    }

    const angular = this.holdSpin
      .clone()
      .add(
        new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1))
          .normalize()
          .multiplyScalar(rand(12, 20)),
      );
    this.throwDie(
      {
        position: mesh.position.clone(),
        quaternion: mesh.quaternion.clone(),
        velocity,
        angular,
      },
      true,
    );
  }

  updateHeld(dt) {
    const die = this.die;
    const mesh = die.mesh;
    this.updateHoldTarget();
    mesh.scale.setScalar(damp(mesh.scale.x, 1, 12, dt));

    const prev = mesh.position.clone();
    const wobble = Math.sin(this.elapsed * 7) * 0.06;
    mesh.position.x = damp(mesh.position.x, this.holdTarget.x, 22, dt);
    mesh.position.y = damp(mesh.position.y, this.holdTarget.y + wobble, 14, dt);
    mesh.position.z = damp(mesh.position.z, this.holdTarget.z, 22, dt);

    const inst = mesh.position
      .clone()
      .sub(prev)
      .divideScalar(Math.max(dt, 1e-4));
    this.holdVel.lerp(inst, 1 - Math.exp(-25 * dt));
    this.holdSamples.push({ t: this.elapsed, p: mesh.position.clone() });
    while (
      this.holdSamples.length > 2 &&
      this.elapsed - this.holdSamples[0].t > 0.09
    ) {
      this.holdSamples.shift();
    }

    // Tumble the way a die rolls off moving fingers, plus a lazy drift.
    const r = SHAPES[die.shape.key].radius;
    const v = this.holdVel;
    const tumble = new THREE.Vector3(v.z, 0, -v.x)
      .multiplyScalar(0.7 / r)
      .add(this.holdDrift);
    this.holdSpin.lerp(tumble, 1 - Math.exp(-6 * dt));
    const angle = this.holdSpin.length() * dt;
    if (angle > 0) {
      const dq = new THREE.Quaternion().setFromAxisAngle(
        this.holdSpin.clone().normalize(),
        angle,
      );
      mesh.quaternion.premultiply(dq);
    }

    // Each change of direction knocks the die around in the hand.
    const speed = v.length();
    if (speed > 4) {
      const dir = v.clone().divideScalar(speed);
      if (
        this.shakeDir &&
        dir.dot(this.shakeDir) < -0.2 &&
        this.elapsed - this.lastShake > 0.06
      ) {
        this.audio.shake(Math.min(1, speed / 14));
        this.lastShake = this.elapsed;
        this.holdDrift
          .set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
          .normalize()
          .multiplyScalar(rand(2, 5));
      }
      this.shakeDir = dir;
    }
  }

  setMuted(muted) {
    this.audio.setMuted(muted);
  }

  settle() {
    const die = this.die;
    this.state = 'settled';
    this.stateTime = 0;
    this.audio.stopRolling();

    const value = die.labels[this.resultFace];
    const sides = die.sides;
    const max = sides > 1 && value === sides;
    const min = sides > 1 && value === 1;

    const nuke = value === NUKE_VALUE;
    const pos = die.mesh.position;
    this.shockwave.fire(pos, die.theme.glow, max ? 1.6 : 0.7);
    this.flash = max ? 6 : min ? 0.5 : 2;
    if (max && !nuke) {
      this.sparks.burst(pos, die.theme.glow);
      this.shake = 0.6;
    }

    const up = die.shape.faces[this.resultFace].up
      .clone()
      .applyQuaternion(die.mesh.quaternion);
    this.zoomAz =
      die.theme.pips || Math.hypot(up.x, up.z) < 0.2
        ? 0
        : Math.atan2(-up.x, -up.z);

    if (nuke) {
      this.state = 'charging';
      this.chargeFrom = pos.clone();
      this.audio.nukeCharge(CHARGE_SECONDS);
    } else {
      this.audio.reveal(sides > 1 ? (value - 1) / (sides - 1) : 1, {
        max,
        min,
      });
    }
    this.onResult?.({ value, sides, max, min, nuke });
  }

  updateDie(dt) {
    const die = this.die;
    if (!die) return;
    const mesh = die.mesh;
    this.stateTime = (this.stateTime ?? 0) + dt;

    if (this.state === 'idle') {
      this.popIn = Math.min(1, (this.popIn ?? 1) + dt * 2.5);
      const s = 1 - (1 - this.popIn) ** 3;
      const bounce = 1 + Math.sin(this.popIn * Math.PI) * 0.15;
      mesh.scale.setScalar(s * bounce);
      mesh.position.set(0, 2 + Math.sin(this.elapsed * 1.5) * 0.18, 0);
      const spin = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(dt * 0.35, dt * 0.6, dt * 0.15),
      );
      this.hoverSpin.multiply(spin);
      mesh.quaternion.copy(this.hoverSpin);
    } else if (this.state === 'held') {
      this.updateHeld(dt);
    } else if (this.state === 'pickup') {
      const t = Math.min(1, this.stateTime / PICKUP_SECONDS);
      const e = easeInOutCubic(t);
      const { start } = this.sim;
      mesh.position.lerpVectors(this.pickupFrom.position, start.position, e);
      mesh.position.y += Math.sin(t * Math.PI) * 1.5;
      mesh.quaternion.slerpQuaternions(
        this.pickupFrom.quaternion,
        start.quaternion,
        e,
      );
      mesh.scale.setScalar(1);
      if (t >= 1) {
        this.state = 'rolling';
        this.stateTime = 0;
        this.audio.whoosh();
        this.audio.startRolling();
      }
    } else if (this.state === 'charging') {
      // The die trembles harder and harder as it goes critical.
      const p = Math.min(1, this.stateTime / CHARGE_SECONDS);
      const j = p * p * 0.12;
      mesh.position.set(
        this.chargeFrom.x + rand(-j, j),
        this.chargeFrom.y + rand(-j, j) + p * p * 0.6,
        this.chargeFrom.z + rand(-j, j),
      );
      if (p >= 1) this.detonate();
    } else if (this.state === 'nuke') {
      if (!this.blastHit && this.stateTime >= BLAST_DELAY) {
        this.blastHit = true;
        this.shake = 2.6;
      }
      if (this.nuke.done) {
        this.state = 'idle';
        this.popIn = 0;
        mesh.visible = true;
        this.onNukeEnd?.();
      }
    } else if (this.state === 'rolling') {
      const { frames, count, events } = this.sim;
      const f = this.stateTime / DT;
      const i = Math.floor(f);
      while (
        this.nextEvent < events.length &&
        events[this.nextEvent].t <= this.stateTime
      ) {
        const ev = events[this.nextEvent++];
        this.audio.impact(ev.strength, ev);
      }
      if (i >= count - 1) {
        const k = (count - 1) * 7;
        mesh.position.set(frames[k], frames[k + 1], frames[k + 2]);
        mesh.quaternion.set(
          frames[k + 3],
          frames[k + 4],
          frames[k + 5],
          frames[k + 6],
        );
        this.settle();
      } else {
        const a = i * 7;
        const b = a + 7;
        const u = f - i;
        mesh.position.set(
          frames[a] + (frames[b] - frames[a]) * u,
          frames[a + 1] + (frames[b + 1] - frames[a + 1]) * u,
          frames[a + 2] + (frames[b + 2] - frames[a + 2]) * u,
        );
        const qa = new THREE.Quaternion(
          frames[a + 3],
          frames[a + 4],
          frames[a + 5],
          frames[a + 6],
        );
        const qb = new THREE.Quaternion(
          frames[b + 3],
          frames[b + 4],
          frames[b + 5],
          frames[b + 6],
        );
        mesh.quaternion.slerpQuaternions(qa, qb, u);
        const speed =
          Math.hypot(frames[b] - frames[a], frames[b + 2] - frames[a + 2]) / DT;
        const onFloor = frames[a + 1] < SHAPES[die.shape.key].radius * 1.05;
        this.audio.updateRolling(speed, onFloor);
      }
    }
  }

  detonate() {
    const pos = this.die.mesh.position.clone();
    this.state = 'nuke';
    this.stateTime = 0;
    this.blastHit = false;
    this.die.mesh.visible = false;
    this.nuke.start(pos);
    this.shockwave.fire(pos, '#ffd2a1', 4);
    this.flash = 0;
    this.audio.nukeDetonate(BLAST_DELAY, NUKE_SAMPLE);
    this.onFlash?.();
  }

  updateCamera(dt) {
    const mesh = this.die?.mesh;
    let target;
    let dist = this.baseDist;
    let az = 0;
    let el = BASE_ELEVATION;
    if (!mesh || this.state === 'idle') {
      target = new THREE.Vector3(0, 0.6, 0);
      dist = this.baseDist * 0.82;
      az = Math.sin(this.elapsed * 0.25) * 0.12;
    } else if (this.state === 'nuke') {
      const o = this.nuke.origin;
      target = new THREE.Vector3(
        o.x,
        Math.max(2.2, this.nuke.height * 0.5),
        o.z,
      );
      dist = this.baseDist * 1.55;
      az = this.zoomAz;
      el = THREE.MathUtils.degToRad(18);
    } else if (this.state === 'charging') {
      target = this.chargeFrom.clone();
      target.y += 0.9;
      dist = Math.min(this.baseDist * 0.5, 10);
      az = this.zoomAz;
      el = ZOOM_ELEVATION;
    } else if (this.state === 'settled') {
      target = mesh.position.clone();
      target.y += 1.1;
      dist = Math.min(this.baseDist * 0.62, 12);
      az = this.zoomAz;
      el = ZOOM_ELEVATION;
    } else if (this.state === 'held') {
      // Hold the framing still so the die tracks the pointer exactly.
      target = new THREE.Vector3(0, 0, 0);
    } else {
      target = mesh.position.clone().multiplyScalar(0.3);
      target.y = 0;
    }

    const c = this.cam;
    const speed = { settled: 2.6, charging: 1.2, nuke: 1.1 }[this.state] ?? 3.2;
    c.target.x = damp(c.target.x, target.x, speed, dt);
    c.target.y = damp(c.target.y, target.y, speed, dt);
    c.target.z = damp(c.target.z, target.z, speed, dt);
    c.dist = damp(c.dist, dist, speed * 0.8, dt);
    c.az += wrapAngle(az - c.az) * (1 - Math.exp(-speed * 0.8 * dt));
    c.el = damp(c.el, el, speed, dt);

    const look = c.target.clone();
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.25;
      look.x += rand(-s, s);
      look.y += rand(-s, s);
    }
    this.placeCamera(look, c.dist, c.az, c.el);
  }

  tick(now) {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.elapsed += dt;

    this.updateDie(dt);
    this.updateCamera(dt);
    this.sparks.update(dt);
    this.shockwave.update(dt);
    this.nuke.update(dt);
    const heat = this.nuke.heat;
    this.scene.background.set(BG).lerp(BLAST_TINT, heat * 0.8);
    this.scene.fog.color.copy(this.scene.background);
    this.bloom.strength = BLOOM_STRENGTH + heat * 1.4;
    this.motes.rotation.y += dt * 0.02;
    this.motes.position.y = Math.sin(this.elapsed * 0.3) * 0.3;

    const die = this.die;
    if (die) {
      const p = die.mesh.position;
      this.glowLight.position.set(p.x, p.y + 2.4, p.z + 0.8);
      this.flash = damp(this.flash ?? 0, 0, 2.2, dt);
      const base = this.state === 'idle' ? 1.2 : 0.5;
      const charge =
        this.state === 'charging'
          ? Math.min(1, this.stateTime / CHARGE_SECONDS) ** 2
          : 0;
      this.glowLight.intensity = base + this.flash + charge * 40;
      if (die.theme.emissive) {
        die.material.emissiveIntensity =
          die.theme.emissive * (0.85 + Math.sin(this.elapsed * 3) * 0.15) +
          this.flash * 0.05 +
          charge * 9;
      }
    }
    this.composer.render(dt);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.stopListening();
    this.resizeObserver.disconnect();
    this.audio.stopRolling();
    this.audio.stopSample();
    this.audio.ctx?.close();
    for (const die of this.dice.values()) {
      die.shape.geometry.dispose();
      die.material.dispose();
    }
    this.envTexture.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
