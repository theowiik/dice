import * as CANNON from 'cannon-es';
import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;
const EPS = 1e-5;

const cubeVerts = () => {
  const v = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  return v;
};

const octaVerts = () => [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const cyclic = (a, b) => [
  [0, a, b],
  [a, b, 0],
  [b, 0, a],
];

const icosaVerts = () => {
  const v = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) v.push(...cyclic(a, b));
  return v;
};

const dodecaVerts = () => {
  const v = cubeVerts();
  const i = 1 / PHI;
  for (const a of [-i, i]) for (const b of [-PHI, PHI]) v.push(...cyclic(a, b));
  return v;
};

// Pentagonal trapezohedron; apex height chosen so every kite is planar.
const d10Verts = () => {
  const c = 0.1;
  const cos36 = Math.cos(Math.PI / 5);
  const h = (c * (1 + cos36)) / (1 - cos36);
  const v = [
    [0, h, 0],
    [0, -h, 0],
  ];
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5;
    v.push([Math.cos(a), k % 2 ? c : -c, Math.sin(a)]);
  }
  return v;
};

export const SHAPES = {
  d6: { verts: cubeVerts, radius: 1.05, chamfer: 0.14 },
  d8: { verts: octaVerts, radius: 1.2, chamfer: 0.1 },
  d10: { verts: d10Verts, radius: 1.15, chamfer: 0.08 },
  d12: { verts: dodecaVerts, radius: 1.2, chamfer: 0.1 },
  d20: { verts: icosaVerts, radius: 1.25, chamfer: 0.09 },
};

export const shapeForSides = (sides) =>
  ({ 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20' })[sides] ?? 'd20';

const centroid = (pts) => {
  const c = new THREE.Vector3();
  for (const p of pts) c.add(p);
  return c.divideScalar(pts.length);
};

// Brute-force convex hull: fine for the handful of points a die has.
// Returns faces with CCW (seen from outside) vertex order.
function hullFaces(V) {
  const faces = [];
  const seen = new Set();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (let i = 0; i < V.length; i++) {
    for (let j = i + 1; j < V.length; j++) {
      for (let k = j + 1; k < V.length; k++) {
        e1.subVectors(V[j], V[i]);
        e2.subVectors(V[k], V[i]);
        n.crossVectors(e1, e2);
        if (n.lengthSq() < 1e-10) continue;
        n.normalize();
        let d = n.dot(V[i]);
        let pos = 0;
        let neg = 0;
        const on = [];
        for (let m = 0; m < V.length; m++) {
          const s = n.dot(V[m]) - d;
          if (s > EPS) pos++;
          else if (s < -EPS) neg++;
          else on.push(m);
        }
        if (pos && neg) continue;
        const key = on.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const normal = n.clone();
        if (pos) {
          normal.negate();
          d = -d;
        }
        const c = centroid(on.map((m) => V[m]));
        const ref = V[on[0]].clone().sub(c).normalize();
        const tan = new THREE.Vector3().crossVectors(normal, ref);
        const angle = (m) => {
          const p = V[m].clone().sub(c);
          return Math.atan2(p.dot(tan), p.dot(ref));
        };
        on.sort((a, b) => angle(a) - angle(b));
        faces.push({ indices: on, normal, center: c });
      }
    }
  }
  return faces;
}

// Pick the in-plane "up" direction used to orient each face's number.
function faceFrame(face, V) {
  const pts = face.indices.map((i) => V[i]);
  const dists = pts.map((p) => p.distanceTo(face.center));
  const maxD = Math.max(...dists);
  const minD = Math.min(...dists);
  let up;
  if (maxD / minD > 1.1) {
    up = pts[dists.indexOf(maxD)].clone().sub(face.center);
  } else if (pts.length === 4) {
    up = pts[0].clone().add(pts[1]).multiplyScalar(0.5).sub(face.center);
  } else {
    up = pts[0].clone().sub(face.center);
  }
  up.normalize();
  const right = new THREE.Vector3().crossVectors(up, face.normal);
  // Distance from center to the nearest edge: the room available for text.
  let inradius = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ab = b.clone().sub(a);
    const t = face.center.clone().sub(a).dot(ab) / ab.lengthSq();
    const closest = a.clone().addScaledVector(ab, t);
    inradius = Math.min(inradius, closest.distanceTo(face.center));
  }
  return { up, right, radius: maxD, inradius };
}

function labelOpposites(faces) {
  const labels = new Array(faces.length).fill(0);
  let next = 1;
  const total = faces.length;
  for (let i = 0; i < total; i++) {
    if (labels[i]) continue;
    const j = faces.findIndex(
      (f, idx) =>
        idx !== i && !labels[idx] && f.normal.dot(faces[i].normal) < -0.999,
    );
    labels[i] = next;
    if (j !== -1) labels[j] = total + 1 - next;
    next++;
  }
  return labels;
}

/**
 * Build a chamfered, smooth-edged die mesh plus a matching physics hull.
 * Faces sample their own cell of a texture atlas; bevels sample a blank
 * corner so one material covers the whole die.
 */
export function buildShape(key) {
  const def = SHAPES[key];
  const raw = def.verts().map((p) => new THREE.Vector3(...p));
  const maxR = Math.max(...raw.map((p) => p.length()));
  const V = raw.map((p) => p.multiplyScalar(def.radius / maxR));
  const faces = hullFaces(V);
  const count = faces.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  for (const f of faces) Object.assign(f, faceFrame(f, V));

  const positions = [];
  const normals = [];
  const uvs = [];
  const blankUv = [0.002, 0.998];

  const pushTri = (p, n, uv) => {
    const cross = new THREE.Vector3()
      .subVectors(p[1], p[0])
      .cross(new THREE.Vector3().subVectors(p[2], p[0]));
    const order = cross.dot(centroid(p)) >= 0 ? [0, 1, 2] : [0, 2, 1];
    for (const o of order) {
      positions.push(p[o].x, p[o].y, p[o].z);
      normals.push(n[o].x, n[o].y, n[o].z);
      uvs.push(...(uv ? uv[o] : blankUv));
    }
  };

  const insets = faces.map((f) =>
    f.indices.map((i) => V[i].clone().lerp(f.center, def.chamfer)),
  );

  // Numbered faces.
  faces.forEach((f, fi) => {
    const col = fi % cols;
    const row = Math.floor(fi / cols);
    const toUv = (p) => {
      const d = p.clone().sub(f.center);
      const u = 0.5 + (d.dot(f.right) / (2 * f.radius)) * 0.96;
      const v = 0.5 + (d.dot(f.up) / (2 * f.radius)) * 0.96;
      return [(col + u) / cols, 1 - (row + 1 - v) / rows];
    };
    const pts = insets[fi];
    const fuv = pts.map(toUv);
    for (let i = 1; i < pts.length - 1; i++) {
      pushTri(
        [pts[0], pts[i], pts[i + 1]],
        [f.normal, f.normal, f.normal],
        [fuv[0], fuv[i], fuv[i + 1]],
      );
    }
  });

  // Edge bevels: normals blend between the two faces for a rounded look.
  const edgeOwners = new Map();
  faces.forEach((f, fi) => {
    f.indices.forEach((a, li) => {
      const b = f.indices[(li + 1) % f.indices.length];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edgeOwners.has(k)) edgeOwners.set(k, []);
      edgeOwners.get(k).push({ fi, a, b });
    });
  });
  const insetOf = (fi, vi) => insets[fi][faces[fi].indices.indexOf(vi)];
  for (const [, owners] of edgeOwners) {
    if (owners.length !== 2) continue;
    const [{ fi: f1, a, b }, { fi: f2 }] = owners;
    const n1 = faces[f1].normal;
    const n2 = faces[f2].normal;
    const q = [insetOf(f1, a), insetOf(f1, b), insetOf(f2, b), insetOf(f2, a)];
    pushTri([q[0], q[1], q[2]], [n1, n1, n2]);
    pushTri([q[0], q[2], q[3]], [n1, n2, n2]);
  }

  // Corner caps.
  V.forEach((vert, vi) => {
    const around = faces
      .map((f, fi) => ({ f, fi }))
      .filter(({ f }) => f.indices.includes(vi))
      .map(({ f, fi }) => ({ p: insetOf(fi, vi), n: f.normal }));
    const c = centroid(around.map((x) => x.p));
    const axis = vert.clone().normalize();
    const ref = around[0].p.clone().sub(c).normalize();
    const tan = new THREE.Vector3().crossVectors(axis, ref);
    const ang = (p) => {
      const d = p.clone().sub(c);
      return Math.atan2(d.dot(tan), d.dot(ref));
    };
    around.sort((x, y) => ang(x.p) - ang(y.p));
    for (let i = 0; i < around.length; i++) {
      const x = around[i];
      const y = around[(i + 1) % around.length];
      pushTri([c, x.p, y.p], [axis, x.n, y.n]);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();

  // Physics hull over the chamfered points so the die rolls like a real one.
  const hullPts = [];
  const seen = new Map();
  for (const pts of insets) {
    for (const p of pts) {
      const k = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
      if (!seen.has(k)) {
        seen.set(k, hullPts.length);
        hullPts.push(p);
      }
    }
  }
  const hull = hullFaces(hullPts);
  const physicsShape = new CANNON.ConvexPolyhedron({
    vertices: hullPts.map((p) => new CANNON.Vec3(p.x, p.y, p.z)),
    faces: hull.map((f) => f.indices),
  });

  return {
    key,
    geometry,
    physicsShape,
    faces,
    cols,
    rows,
    labels: labelOpposites(faces),
    restHeight: Math.min(...faces.map((f) => f.center.length())),
  };
}

/** Index of the face pointing most upward for the given orientation. */
export function topFace(shape, quaternion) {
  let best = 0;
  let bestY = -2;
  const n = new THREE.Vector3();
  shape.faces.forEach((f, i) => {
    n.copy(f.normal).applyQuaternion(quaternion);
    if (n.y > bestY) {
      bestY = n.y;
      best = i;
    }
  });
  return best;
}
