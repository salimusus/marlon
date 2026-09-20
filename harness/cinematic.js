'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const T = require('../vendor/three.min.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../cinematic.js'), 'utf8');
new Function(source);
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function setup(options = {}) {
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
  const root = Object.assign(events(), { innerWidth: 1280, innerHeight: 720, AudioContext: Audio, MediaRecorder: Recorder, matchMedia: () => ({ matches: false }) });
  const navigator = { getGamepads: () => pads };
  const renderer = { ratio: 1.5, size: new T.Vector2(1280, 720), rendered: 0, getPixelRatio() { return this.ratio; }, setPixelRatio(r) { this.ratio = r; }, getSize(v) { return v.copy(this.size); }, setSize(w, h) { this.size.set(w, h); }, setRenderTarget() {}, render(scene) { this.scene = scene; this.rendered++; } };
  vm.runInNewContext(source, { window: root, document, navigator, MediaRecorder: Recorder, Blob, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout() {}, console });
  const movie = root.MarlonIntro.create({ THREE: T, renderer, sourceCanvas: {}, makeAvatar() { const av = { group: new T.Group(), tag: { visible: true }, rig: { head: new T.Group(), armL: new T.Group(), armR: new T.Group() } }; avatars.push(av); return av; }, disposeAvatar() { disposed++; }, onClose() { closed++; }, ...options });
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
console.log(`${count} cinematic lifecycle tests passed (mock media and canvas; real Three.js scene objects).`);
