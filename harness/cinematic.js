'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const T = require('../vendor/three.min.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../cinematic.js'), 'utf8');
new Function(source);
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function setup({ reducedMotion = false, ...options } = {}) {
  const events = () => ({ handlers: {}, addEventListener(n, f) { (this.handlers[n] ||= new Set()).add(f); }, removeEventListener(n, f) { this.handlers[n]?.delete(f); }, emit(n, e) { for (const f of this.handlers[n] || []) f(e); } });
  const audioContexts = [], recorders = [], downloads = [], avatars = [];
  let closed = 0, disposed = 0, pads = [];
  class Stream { constructor() { this.tracks = [{ stopped: false, stop() { this.stopped = true; } }]; } getTracks() { return this.tracks; } getAudioTracks() { return this.tracks; } addTrack(t) { this.tracks.push(t); } }
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'video/webm'; recorders.push(this); }
    start() { this.state = 'recording'; } pause() { this.state = 'paused'; } resume() { this.state = 'recording'; }
    stop() { if (this.throwStop) throw Error('InvalidState'); this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['video']) }); this.onstop?.(); }
  }
  class Audio {
    constructor() { this.currentTime = 0; this.state = 'running'; audioContexts.push(this); }
    createGain() { return this.node(); } createOscillator() { return this.node(); }
    createMediaStreamDestination() { return { stream: new Stream() }; }
    node() { const p = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(v) { this.value = v; } }; return { gain: { ...p }, frequency: { ...p }, connect() {}, start() {}, stop() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); } close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const context = new Proxy({}, { get(o, k) { return o[k] || (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}); }, set(o, k, v) { o[k] = v; return true; } });
  const document = Object.assign(events(), { hidden: false, activeElement: null, layers: [], createElement(tag) {
    const el = { tagName: tag.toUpperCase(), disabled: false, attrs: {}, setAttribute(n, v) { this.attrs[n] = v; }, focus() { document.activeElement = this; }, getContext() { return context; }, captureStream() { return new Stream(); }, click() { downloads.push(this); }, remove() { document.layers = document.layers.filter(x => x !== this); } };
    if (tag === 'section') {
      el.parts = { canvas: document.createElement('canvas'), '.cinemaStatus': document.createElement('p') };
      for (const k of ['sound', 'record', 'skip']) el.parts[`[data-cinema="${k}"]`] = document.createElement('button');
      el.querySelector = s => el.parts[s]; el.querySelectorAll = () => ['sound', 'record', 'skip'].map(k => el.parts[`[data-cinema="${k}"]`]); el.contains = x => Object.values(el.parts).includes(x);
    }
    return el;
  } });
  document.body = { appendChild(layer) { document.layers.push(layer); } };
  const root = Object.assign(events(), { innerWidth: 1280, innerHeight: 720, AudioContext: Audio, MediaRecorder: Recorder, matchMedia: () => ({ matches: reducedMotion }) });
  const navigator = { getGamepads: () => pads };
  const renderer = { ratio: 1.5, size: new T.Vector2(1280, 720), rendered: 0, getPixelRatio() { return this.ratio; }, setPixelRatio(r) { this.ratio = r; }, getSize(v) { return v.copy(this.size); }, setSize(w, h) { this.size.set(w, h); }, setRenderTarget() {}, render(scene, camera) { this.scene = scene; this.camera = camera; this.rendered++; } };
  vm.runInNewContext(source, { window: root, document, navigator, MediaRecorder: Recorder, Blob, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout() {}, console });
  const movie = root.MarlonIntro.create({ THREE: T, renderer, sourceCanvas: {}, makeAvatar() {
    const rig = { head: new T.Group(), armL: new T.Group(), armR: new T.Group(), legL: new T.Group(), legR: new T.Group() };
    for (const arm of [rig.armL, rig.armR]) { arm.coude = new T.Group(); arm.add(arm.coude); }
    for (const leg of [rig.legL, rig.legR]) { leg.genou = new T.Group(); leg.pied = new T.Group(); leg.add(leg.genou); leg.genou.add(leg.pied); }
    const av = { group: new T.Group(), tag: { visible: true }, rig }; for (const part of Object.values(rig)) av.group.add(part); avatars.push(av); return av;
  }, disposeAvatar() { disposed++; }, onClose() { closed++; }, ...options });
  const layer = document.layers[0], button = k => layer.querySelector(`[data-cinema="${k}"]`);
  const key = (code, target = button('skip'), shiftKey = false) => { const e = { code, target, shiftKey, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } }; root.emit('keydown', e); return e; };
  return { movie, root, document, renderer, audioContexts, recorders, downloads, avatars, button, key, get closed() { return closed; }, get disposed() { return disposed; }, setPads(v) { pads = v; } };
}

test('Intro closes once, releases avatars/listeners/audio and restores viewport after resize', () => {
  const h = setup(); h.movie.tick(.1);
  const contacts = h.renderer.scene.children.filter(o => o.geometry?.parameters?.width === 1.65);
  assert.equal(contacts.length, 3); assert(contacts.every(o => o.material.depthWrite === false));
  h.root.innerWidth = 720; h.root.innerHeight = 1280; h.root.emit('resize');
  assert.equal(h.renderer.size.x, 1920);
  h.movie.finish(); h.movie.finish(); assert.equal(h.closed, 1); assert.equal(h.disposed, 3);
  assert.equal(h.renderer.ratio, 1.5); assert.equal(h.renderer.size.x, 720); assert.equal(h.renderer.size.y, 1280);
  assert.equal(h.audioContexts[0].state, 'closed'); assert.equal(h.root.handlers.keydown.size, 0); assert.equal(h.document.handlers.visibilitychange.size, 0);
});
test('Focused controls keep Enter/Space activation and Tab stays inside intro', () => {
  const h = setup({ muted: true, volume: .5 }); assert.equal(h.button('sound').attrs['aria-pressed'], 'false');
  assert.equal(h.key('Enter', h.button('record')).prevented, false); assert(h.movie.active);
  h.key('Tab'); assert.equal(h.document.activeElement, h.button('sound'));
  h.key('Tab', h.button('sound'), true); assert.equal(h.document.activeElement, h.button('skip'));
  assert(h.key('KeyW').stopped); h.key('Escape'); assert(!h.movie.active);
});
test('Background tab suspends audio and video recording together without drawing frames', () => {
  const h = setup(); h.button('record').onclick(); const recorder = h.recorders[0];
  assert.equal(recorder.state, 'recording'); h.document.hidden = true; h.document.emit('visibilitychange');
  assert.equal(recorder.state, 'paused'); assert.equal(h.audioContexts.at(-1).state, 'suspended');
  const frames = h.renderer.rendered; h.movie.tick(5); assert.equal(h.renderer.rendered, frames);
  h.document.hidden = false; h.document.emit('visibilitychange'); assert.equal(recorder.state, 'recording');
  h.movie.finish(); assert.equal(recorder.state, 'inactive'); assert(recorder.stream.getTracks().every(t => t.stopped));
  assert.equal(h.downloads.length, 1);
});
test('Recorder failure cannot trap the player inside the cinematic', () => {
  const h = setup(); h.button('record').onclick(); h.recorders[0].throwStop = true;
  assert.doesNotThrow(() => h.movie.finish()); assert.equal(h.closed, 1); assert(!h.movie.active);
});
test('Held gamepad confirmation does not skip until it is released and pressed again', () => {
  const h = setup(); const p = { buttons: Array.from({ length: 10 }, () => ({ pressed: false })) }; p.buttons[0].pressed = true; h.setPads([p]);
  for (let i = 0; i < 10; i++) h.movie.tick(.1); assert(h.movie.active);
  p.buttons[0].pressed = false; h.movie.tick(.1); p.buttons[0].pressed = true; h.movie.tick(.1); assert(!h.movie.active); assert.equal(h.closed, 1);
});
test('Playback without exporting continues into the game at the end', () => {
  const h = setup(); for (let i = 0; i < 322; i++) h.movie.tick(.1); assert.equal(h.closed, 1); assert(!h.movie.active);
});
const advance = (h, seconds, fps = 60) => { for (let i = 0; i < Math.round(seconds * fps); i++) h.movie.tick(1 / fps); };
const object = (h, name) => h.renderer.scene.getObjectByName(name);
test('The action shot translates the cast, articulates the full rig and clears the hurdle', () => {
  const h = setup(); advance(h, 6.3); assert.equal(h.renderer.scene.userData.shot, 1);
  const player = h.avatars[1], before = player.group.position.clone(), arm = player.rig.armL.rotation.x, knee = player.rig.legL.genou.rotation.x;
  advance(h, .4); assert(player.group.position.distanceTo(before) > .9);
  assert(Math.abs(player.rig.armL.rotation.x - arm) > .2); assert(Math.abs(player.rig.legL.genou.rotation.x - knee) > .1);
  advance(h, 2.2); assert(player.group.position.y > .8, 'The player leaves the ground over the obstacle.');
  assert(object(h, 'cinema-vault').visible); assert(h.avatars.every(a => a.group.visible));
  assert(!object(h, 'cinema-territories').visible); h.movie.finish();
});
test('Traffic really moves, rotates its wheels and stays behind the final podium', () => {
  const h = setup(); advance(h, 2); const car = object(h, 'cinema-car-0'), p = car.position.clone();
  const wheels = car.children.filter(o => o.geometry?.type === 'CylinderGeometry'), spin = wheels[0].rotation.x;
  advance(h, .5); assert(car.position.distanceTo(p) > 3); assert(Math.abs(wheels[0].rotation.x - spin) > 1);
  advance(h, 11); assert.equal(h.renderer.scene.userData.shot, 2); assert(car.visible); assert(h.avatars[1].group.visible);
  advance(h, 12); assert.equal(h.renderer.scene.userData.shot, 4); assert(object(h, 'cinema-stage').visible);
  for (let frame = 0; frame < 300; frame++) { h.movie.tick(1 / 60); for (let i = 0; i < 4; i++) assert(object(h, 'cinema-car-' + i).position.z < -9); }
  h.movie.finish();
});
test('Territories are captured sequentially and connected before the city is won', () => {
  const h = setup(); advance(h, 18.2); const map = object(h, 'cinema-territories'); assert(map.visible);
  const tiles = map.children.filter(o => o.geometry?.parameters?.width === 2.5);
  const ownedColor = new T.Color(0x49e9b2).convertSRGBToLinear().getHex();
  const owned = () => tiles.filter(t => t.material.color.getHex() === ownedColor).length;
  assert.equal(tiles.length, 8); assert.equal(owned(), 0); advance(h, 2.8); const midway = owned(); assert(midway >= 3 && midway <= 5);
  advance(h, 3.5); assert.equal(owned(), 8);
  const links = map.children.filter(o => o.geometry?.parameters?.width === 1 && o.scale.x === .09);
  assert.equal(links.length, 7); assert(links.every(line => line.visible)); h.movie.finish();
});
test('Every shot has its own framing and the central action remains on screen', () => {
  const h = setup(), positions = [], times = [3, 8, 14, 21, 28]; let last = 0;
  for (const time of times) {
    advance(h, time - last); last = time; const { camera, scene } = h.renderer; camera.updateMatrixWorld(true); scene.updateMatrixWorld(true); positions.push(camera.position.clone());
    const point = scene.userData.shot === 3 ? new T.Vector3(0, .8, -1.1) : scene.userData.shot === 0 ? new T.Vector3(0, 2, -25) : h.avatars[1].group.position.clone().add(new T.Vector3(0, 1.2, 0));
    point.project(camera); assert(Math.abs(point.x) < .85 && Math.abs(point.y) < .85, 'Main action must remain in the frame.');
    assert(point.z > -1 && point.z < 1);
  }
  assert(positions.every((p, i) => !i || p.distanceTo(positions[i - 1]) > 1)); h.movie.finish();
});
test('Timeline poses agree at 30 and 60 FPS and reject non-finite delta times', () => {
  const a = setup(), b = setup(); advance(a, 9, 30); advance(b, 9, 60);
  assert(a.avatars[1].group.position.distanceTo(b.avatars[1].group.position) < 1e-8);
  assert(Math.abs(a.avatars[1].rig.legL.rotation.x - b.avatars[1].rig.legL.rotation.x) < 1e-8);
  for (const dt of [NaN, Infinity, -Infinity, -2, undefined]) a.movie.tick(dt);
  assert(a.avatars[1].group.position.toArray().every(Number.isFinite)); a.movie.finish(); b.movie.finish();
});
test('Reduced motion holds camera, actors and cars still within each shot', () => {
  const h = setup({ reducedMotion: true }); advance(h, 7);
  const p = h.avatars[1].group.position.clone(), c = h.renderer.camera.position.clone(), r = h.avatars[1].rig.armR.rotation.x;
  advance(h, 2); assert(h.avatars[1].group.position.equals(p)); assert(h.renderer.camera.position.equals(c)); assert.equal(h.avatars[1].rig.armR.rotation.x, r);
  advance(h, 4); const car = object(h, 'cinema-car-0'), q = car.position.clone(); advance(h, 1); assert(car.position.equals(q));
  advance(h, 13); assert(!object(h, 'cinema-confetti').visible); h.movie.finish();
});
test('A controller connected or reconnected with A held cannot dismiss the introduction', () => {
  const h = setup(); advance(h, 2); const p = { id: 'DualSense', connected: true, buttons: [{ pressed: true }] };
  h.setPads([p]); h.movie.tick(.1); assert(h.movie.active);
  h.setPads([]); h.movie.tick(.1); h.setPads([p]); h.movie.tick(.1); assert(h.movie.active);
  p.buttons[0].pressed = false; h.movie.tick(.1); p.buttons[0].pressed = true; h.movie.tick(.1); assert(!h.movie.active);
});
test('Every owned cinematic geometry and material is disposed exactly once', () => {
  const h = setup(); h.movie.tick(0); const resources = new Set(), disposed = new Map();
  h.renderer.scene.traverse(o => { if (o.isInstancedMesh) resources.add(o); if (o.geometry) resources.add(o.geometry); if (o.material) { for (const m of Array.isArray(o.material) ? o.material : [o.material]) { resources.add(m); if (m.map) resources.add(m.map); } } });
  for (const r of resources) r.addEventListener('dispose', () => disposed.set(r, (disposed.get(r) || 0) + 1));
  h.movie.finish(); h.movie.finish(); assert(resources.size > 35); for (const r of resources) assert.equal(disposed.get(r), 1, 'Owned resource leaked or was double-disposed.');
});
console.log(`${count} cinematic action and lifecycle tests passed (mock media/canvas; real Three.js transforms, resources and camera projection).`);
