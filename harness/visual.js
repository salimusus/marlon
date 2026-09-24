'use strict';
// CPU checks on the actual index.html runtime. Raster quality still needs browser review.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { run, extractScript } = require('./run');
const { THREE } = require('./stubs');
new Function(extractScript(fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8')));
const g = run();
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function close(a, b, e = 1e-9) { assert(Math.abs(a - b) < e, `${a} != ${b}`); }
const avatar = name => g.buildAvatar({ name, pants: 0x394a60, cap: null, jersey: 1 });
const remove = av => { g.scene.remove(av.group); g.libereBranche(av.group); };

test('Shadow camera remains on texels at every supported shadow resolution', () => {
  const old = g.sun.shadow.mapSize.x;
  const axisX = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), g.SOLEIL_DIR).normalize();
  const axisY = new THREE.Vector3().crossVectors(g.SOLEIL_DIR, axisX).normalize();
  for (const size of [512, 1024, 2048, 4096]) {
    g.sun.shadow.mapSize.set(size, size);
    const step = (g.sun.shadow.camera.right - g.sun.shadow.camera.left) / size;
    for (const pos of [new THREE.Vector3(), new THREE.Vector3(12.345, 2.1, -56.78), new THREE.Vector3(-204, 30, 312)]) {
      g.suitOmbres(pos);
      for (const axis of [axisX, axisY]) {
        const units = g.sun.target.position.dot(axis) / step;
        close(units, Math.round(units), 1e-8);
      }
      assert(g.sun.target.position.distanceTo(pos) <= step / Math.sqrt(2) + 1e-9);
      close(g.sun.position.distanceTo(g.sun.target.position), 95);
    }
  }
  g.sun.shadow.mapSize.set(old, old);
});

test('All transparent glass uses shared reflections and does not hide geometry behind it', () => {
  const env = g.empireEnvironment();
  assert.equal(env.image.length, 6);
  for (const material of [g.glassMat, g.glassCar]) {
    assert.equal(material.envMap, env); assert.equal(material.depthWrite, false);
    assert(material.reflectivity > 0 && material.reflectivity < .5);
  }
  assert(g.shared.has(env));
});

test('Blinking and sleeping reuse shared face textures', () => {
  const av = avatar('Clignement'); av.rig.idlePhase = 0;
  g.animateRig(av.rig, 'idle', 0, 1 / 60, .05);
  assert.equal(av.rig.faceMat.map, g.FACE_FERMEE);
  g.animateRig(av.rig, 'idle', 0, 1 / 60, .2);
  assert.equal(av.rig.faceMat.map, g.FACE);
  g.animateRig(av.rig, 'sleep', 0, 1 / 60, 2);
  assert.equal(av.rig.faceMat.map, g.FACE_FERMEE);
  assert(g.shared.has(g.FACE)); assert(g.shared.has(g.FACE_FERMEE));
  remove(av); assert(!g.FACE.disposed && !g.FACE_FERMEE.disposed);
});

test('Static pose convergence is identical at 30, 60 and 120 Hz', () => {
  const poses = [];
  for (const hz of [30, 60, 120]) {
    const av = avatar('Pose'); av.rig.legL.rotation.x = 1; av.rig.armL.rotation.x = -1.5;
    for (let i = 0; i < hz; i++) g.animateRigCorps(av.rig, 'sleep', 0, 1 / hz, i / hz);
    poses.push([av.rig.legL.rotation.x, av.rig.armL.rotation.x]); remove(av);
  }
  for (const pose of poses) { close(pose[0], poses[0][0]); close(pose[1], poses[0][1]); }
});

test('Negative leaning returns smoothly without snapping on the first idle frame', () => {
  const av = avatar('Freinage'); av.rig.inclin = -.2;
  g.animateRig(av.rig, 'idle', 0, 1 / 60, 1);
  close(av.rig.inclin, -.2 * Math.exp(-8 / 60)); remove(av);
});

test('Walk to sprint blends elbow pose around the former threshold', () => {
  const av = avatar('Course'); av.rig.courseK = 0;
  for (let i = 0; i < 60; i++) { av.group.position.z += 7.49 / 60; g.animateRig(av.rig, 'walk', 7.49, 1 / 60, i / 60); }
  const before = av.rig.armL.coude.rotation.x;
  av.group.position.z += 7.51 / 60; g.animateRig(av.rig, 'walk', 7.51, 1 / 60, 1);
  assert(Math.abs(av.rig.armL.coude.rotation.x - before) < .015);
  assert(av.rig.courseK > 0 && av.rig.courseK < 1); remove(av);
});

test('Avatar transforms remain finite through every movement mode at three frame rates', () => {
  for (const hz of [30, 60, 120]) {
    const av = avatar('Mouvements ' + hz);
    for (const mode of ['idle', 'walk', 'air', 'ride', 'sit', 'swim', 'lift', 'dance', 'sleep']) {
      for (let i = 0; i < hz / 2; i++) {
        const speed = mode === 'walk' ? 9 : 0;
        av.group.position.z += speed / hz;
        g.animateRig(av.rig, mode, speed, 1 / hz, i / hz);
      }
      av.group.traverse(o => { for (const v of [o.position, o.rotation, o.scale]) assert([v.x, v.y, v.z].every(Number.isFinite), mode); });
    }
    remove(av);
  }
});

test('Changing jewelry disposes old geometry and labels while preserving reusable metal', () => {
  const av = avatar('Bijoutier'); av.setBijou('dollar');
  const old = [...av.bijoux.children], metal = av.mats.bijou;
  av.setBijou('chaine');
  for (const mesh of old) {
    assert(mesh.geometry.disposed);
    if (mesh.material !== metal) { assert(mesh.material.disposed); assert(mesh.material.map.disposed); }
  }
  assert(!metal.disposed); assert.equal(av.bijoux.children.length, 1); remove(av);
});

test('City facades share one specular mask with no per-building reflection textures', () => {
  g.loadWorld(4);
  const materials = g.city.buildings.filter(m => m.specularMap);
  assert(materials.length > 10);
  for (const material of materials) {
    assert.equal(material.specularMap, g.WINDOWS_SPEC);
    assert.equal(material.envMap, g.empireEnvironment());
  }
  assert(g.shared.has(g.WINDOWS_SPEC));
});

console.log(`${count} visual runtime tests passed (CPU stubs; no GPU assertions).`);
