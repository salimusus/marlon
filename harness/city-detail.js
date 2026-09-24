'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const art = require('../city-detail.js');
const { run } = require('./run');
const THREE = require('../vendor/three.min.js');
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('PASS ' + name); };
const cross = { routes: [{ x: 0, z: 0, w: 8, d: 80, top: .23 }, { x: 0, z: 0, w: 80, d: 8, top: .23 }] };
test('Crossroad paint leaves the entire junction open and follows raised asphalt', () => {
  const plan = art.plan(cross);
  assert(plan.markings.length > 20);
  for (const p of plan.markings) {
    assert(!(Math.abs(p.x) < 4 && Math.abs(p.z) < 4));
    assert(Math.abs(p.y - .245) < 1e-12);
    assert(cross.routes.some(r => Math.abs(p.x - r.x) <= r.w / 2 && Math.abs(p.z - r.z) <= r.d / 2));
  }
});
test('Direction arrows agree with both right-hand lanes of the actual navigation graph', () => {
  for (const a of art.plan(cross).arrows) {
    if (a.road === 0) assert.equal(Math.sign(a.x), -a.direction);
    else assert.equal(Math.sign(a.z), a.direction);
    assert(Math.abs(Math.sin(a.angle) - (a.road ? a.direction : 0)) < 1e-12);
    assert(Math.abs(Math.cos(a.angle) - (a.road ? 0 : a.direction)) < 1e-12);
  }
});
test('Rotated shop details preserve their 2.2 metre entry at every orientation', () => {
  for (let facing = 0; facing < 4; facing++) {
    const b = { x: 10, z: 20, w: 9, d: 9, artShop: { w: 8, d: 7, facing, color: 0xf08753 } };
    const a = art.plan({ interieurs: [b] }), angle = [0, -Math.PI / 2, Math.PI, Math.PI / 2][facing];
    for (const p of [...a.architecture, ...a.lights]) {
      if (p.y - p.h / 2 > 2.6) continue;
      const localX = (p.x - b.x) * Math.cos(angle) - (p.z - b.z) * Math.sin(angle);
      assert(Math.abs(localX) - p.w / 2 >= 1.1 - 1e-10);
    }
  }
});
test('Merged meshes have finite triangles, correct winding and bounded normals', () => {
  const plan = art.plan(cross);
  for (const flat of [true, false]) {
    const g = art.geometry(THREE, plan.markings, flat), p = g.attributes.position.array, normals = g.attributes.normal.array;
    assert([...p, ...normals, ...g.attributes.color.array].every(Number.isFinite));
    for (let k = 0; k < p.length; k += 9) {
      const a = new THREE.Vector3().fromArray(p, k), b = new THREE.Vector3().fromArray(p, k + 3), c = new THREE.Vector3().fromArray(p, k + 6);
      const normal = b.sub(a).cross(c.sub(a)).normalize();
      assert(normal.dot(new THREE.Vector3().fromArray(normals, k)) > .99);
    }
    assert(Number.isFinite(g.boundingSphere.radius)); g.dispose();
  }
});
const g = run(); g.loadWorld(4);
test('The complete city includes the new road, shop and facade pass', () => {
  const a = g.city.art;
  assert(a && a.batches === 3);
  assert(a.layout.markings.length > 1000);
  assert(a.layout.clearances.filter(x => x.kind === 'shop').length >= 8);
  assert(a.layout.clearances.filter(x => x.kind === 'facade').length >= 12);
  assert(a.layout.markings.some(x => Math.hypot(x.x, x.z) < 18));
  assert(a.layout.architecture.some(x => Math.hypot(x.x, x.z) < 30));
});
test('Complete-city details respect geometry budgets without adding collision obstacles', () => {
  const a = g.city.art;
  for (const key of ['markings', 'architecture', 'lights']) assert(a.layout[key].length < art.LIMITS[key]);
  const before = g.solids.length, group = new THREE.Group(), extra = art.build(THREE, g.city, group);
  assert.equal(g.solids.length, before);
  assert.equal(extra.batches, 3);
  assert(extra.group.children.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0) < 180000);
  extra.group.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
});
test('Pavement inlays stay off the carriageways and wall relief stays above head height', () => {
  for (const p of g.city.art.layout.markings.filter(p => p.color === 0xbc9671)) {
    assert(!g.city.routes.some(r => art.overlap(p, r, .03)));
    assert(g.city.trottoirs.some(t => Math.abs(p.x - t.x) + p.w / 2 <= t.w / 2 + 1e-8 && Math.abs(p.z - t.z) + p.d / 2 <= t.d / 2 + 1e-8));
  }
  for (const f of g.city.art.layout.clearances.filter(x => x.kind === 'facade')) assert(f.bottom > 3.8);
});
test('sRGB output and street textures use the same display transfer function', () => {
  assert.equal(g.renderer.outputEncoding, THREE.sRGBEncoding);
  for (const road of g.city.routes) assert.equal(road.tex.encoding, THREE.sRGBEncoding);
});
test('Post-processing encodes the scene once and never applies a second transfer function', () => {
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const monte = src.slice(src.indexOf('function postMonte()'), src.indexOf('// Recompile le programme'));
  const cible = src.slice(src.indexOf('function postCible()'), src.indexOf('function rendreImage()'));
  for (const isWebGL2 of [true, false]) {
    const post = {}, renderer = { capabilities: { isWebGL2 }, getDrawingBufferSize: out => out.set(800, 450) };
    const api = new Function('THREE', 'post', 'renderer', 'diffusion', 'postDefines', monte + cible + '; return { postMonte, postCible };')(THREE, post, renderer, { on: false }, () => {});
    api.postMonte(); const rt = api.postCible();
    assert.equal(rt.texture.encoding, g.renderer.outputEncoding);
    assert.equal(post.mat.toneMapped, false);
    assert(!post.mat.fragmentShader.includes('encodings_fragment'));
    assert(!post.mat.fragmentShader.includes('tonemapping_fragment'));
    assert.equal(api.postCible(), rt, 'target reused at identical size');
    rt.dispose(); post.mat.dispose();
  }
});
test('World disposal releases every city-art geometry and material', () => {
  const children = [...g.city.art.group.children]; g.clearWorld();
  for (const mesh of children) { assert(mesh.geometry.disposed); assert(mesh.material.disposed); }
});
console.log(`${n} city art checks passed`);
