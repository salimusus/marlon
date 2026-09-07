// Bouchons minimalistes de THREE.js + DOM : permettent d'exécuter le code de
// construction du monde de SuperObby dans Node, hors navigateur, pour vérifier
// l'agencement (collisions, chevauchements, accès) de façon objective.
'use strict';

class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) { return new V3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
  crossVectors(a, b) { return this.copy(a.clone().cross(b)); }
  applyQuaternion() { return this; }
  applyAxisAngle() { return this; }
  lerp(v, a) { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; this.z += (v.z - this.z) * a; return this; }
  setFromMatrixPosition() { return this; }
  negate() { return this.multiplyScalar(-1); }
  setY(y) { this.y = y; return this; }
  equals(v) { return this.x === v.x && this.y === v.y && this.z === v.z; }
  toArray() { return [this.x, this.y, this.z]; }
  divideScalar(s) { return this.multiplyScalar(1 / (s || 1)); }
  setScalar(v) { this.x = this.y = this.z = v; return this; }
  fromBufferAttribute(a, i) { this.x = a.getX(i); this.y = a.getY(i); this.z = a.getZ(i); return this; }
  applyMatrix4() { return this; }
  project() { return this; }
  unproject() { return this; }
  round() { this.x = Math.round(this.x); this.y = Math.round(this.y); this.z = Math.round(this.z); return this; }
  max(v) { this.x = Math.max(this.x, v.x); this.y = Math.max(this.y, v.y); this.z = Math.max(this.z, v.z); return this; }
  min(v) { this.x = Math.min(this.x, v.x); this.y = Math.min(this.y, v.y); this.z = Math.min(this.z, v.z); return this; }
}
class V2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } setScalar(v) { this.x = this.y = v; return this; } copy(o) { return this.set(o.x, o.y); } clone() { return new V2(this.x, this.y); } }
class Euler { constructor() { this.x = 0; this.y = 0; this.z = 0; this.order = 'XYZ'; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(e) { return this.set(e.x, e.y, e.z); } }
class Quat { constructor() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; } setFromAxisAngle() { return this; } slerp() { return this; } copy() { return this; } multiply() { return this; } setFromEuler() { return this; } }
class Col {
  constructor(c) { this.value = 0; if (c !== undefined) this.set(c); }
  set(c) { this.value = (c && c.value !== undefined) ? c.value : (typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : (c | 0)); return this; }
  copy(c) { return this.set(c); }
  clone() { return new Col(this.value); }
  getHex() { return this.value; }
  setHex(h) { this.value = h; return this; }
  lerp() { return this; }
  toString() { return '#' + (this.value >>> 0).toString(16).padStart(6, '0'); }
}

let OBJ_ID = 0;
class Obj3D {
  constructor() {
    this.id = ++OBJ_ID; this.children = []; this.parent = null;
    this.position = new V3(); this.rotation = new Euler(); this.scale = new V3(1, 1, 1);
    this.quaternion = new Quat(); this.visible = true; this.userData = {};
    this.castShadow = false; this.receiveShadow = false; this.renderOrder = 0; this.name = '';
    this.matrixWorld = { elements: new Array(16).fill(0) };
  }
  add(...o) { for (const c of o) { if (!c) continue; if (c.parent) c.parent.remove(c); c.parent = this; this.children.push(c); } return this; }
  remove(...o) { for (const c of o) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } } return this; }
  clear() { this.children.slice().forEach(c => this.remove(c)); return this; }
  traverse(fn) { fn(this); for (const c of this.children.slice()) c.traverse(fn); }
  getObjectByName(n) { let r = null; this.traverse(o => { if (!r && o.name === n) r = o; }); return r; }
  lookAt() { return this; }
  getWorldPosition(t) { let x = 0, y = 0, z = 0, n = this; while (n) { x += n.position.x; y += n.position.y; z += n.position.z; n = n.parent; } return (t || new V3()).set(x, y, z); }
  getWorldQuaternion(t) { return t || new Quat(); }
  updateMatrixWorld() {}
  localToWorld(v) { return v; }
  worldToLocal(v) { return v; }
  attach(o) { return this.add(o); }
}
class BufAttr {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; this.needsUpdate = false; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
  setX(i, v) { this.array[i * this.itemSize] = v; return this; }
  setY(i, v) { this.array[i * this.itemSize + 1] = v; return this; }
  setZ(i, v) { this.array[i * this.itemSize + 2] = v; return this; }
  setXYZ(i, x, y, z) { const o = i * this.itemSize; this.array[o] = x; this.array[o + 1] = y; this.array[o + 2] = z; return this; }
}
// grille de sommets suffisante pour que roundedBoxGeo travaille sur des données réelles
function boxAttrs(w = 1, h = 1, d = 1, sw = 1, sh = 1, sd = 1) {
  const pos = [], nrm = [];
  const face = (nx, ny, nz, ua, va) => {
    for (let i = 0; i <= ua; i++) for (let j = 0; j <= va; j++) {
      const u = i / ua - 0.5, v = j / va - 0.5;
      let x, y, z;
      if (nx) { x = nx * w / 2; y = v * h; z = u * d; }
      else if (ny) { x = u * w; y = ny * h / 2; z = v * d; }
      else { x = u * w; y = v * h; z = nz * d / 2; }
      pos.push(x, y, z); nrm.push(nx, ny, nz);
    }
  };
  face(1, 0, 0, sd, sh); face(-1, 0, 0, sd, sh); face(0, 1, 0, sw, sd);
  face(0, -1, 0, sw, sd); face(0, 0, 1, sw, sh); face(0, 0, -1, sw, sh);
  return { position: new BufAttr(new Float32Array(pos), 3), normal: new BufAttr(new Float32Array(nrm), 3) };
}
function planeAttrs(w = 1, h = 1, sw = 1, sh = 1) {
  const pos = [], nrm = [];
  for (let j = 0; j <= sh; j++) for (let i = 0; i <= sw; i++) {
    pos.push((i / sw - 0.5) * w, (0.5 - j / sh) * h, 0); nrm.push(0, 0, 1);
  }
  return { position: new BufAttr(new Float32Array(pos), 3), normal: new BufAttr(new Float32Array(nrm), 3) };
}
class Geo { constructor(kind, params) { this.type = kind; this.parameters = params || {}; this.attributes = { position: new BufAttr(new Float32Array(24), 3), normal: new BufAttr(new Float32Array(24), 3) }; this.boundingBox = null; this.disposed = false; }
  dispose() { this.disposed = true; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  computeBoundingBox() { this.boundingBox = { min: new V3(-0.5, -0.5, -0.5), max: new V3(0.5, 0.5, 0.5) }; }
  computeVertexNormals() { return this; } computeBoundingSphere() { this.boundingSphere = { center: new V3(), radius: 1 }; return this; } applyMatrix4() { return this; } toNonIndexed() { return this; } setIndex() { return this; }
  translate() { return this; } rotateX() { return this; } rotateY() { return this; } rotateZ() { return this; } scale() { return this; } clone() { return new Geo(this.type, this.parameters); } }
class Mat { constructor(p = {}) { Object.assign(this, p); this.disposed = false;
    this.color = new Col(p.color !== undefined ? p.color : 0xffffff);
    this.emissive = new Col(p.emissive !== undefined ? p.emissive : 0x000000);
    if (p.opacity === undefined) this.opacity = 1;
    if (p.transparent === undefined) this.transparent = false; }
  dispose() { this.disposed = true; } clone() { return new Mat(this); } }
class Tex { constructor(img) { this.image = img; this.repeat = new V2(1, 1); this.offset = new V2(0, 0); this.center = new V2(0, 0); this.rotation = 0; this.flipY = true; this.encoding = 3000; this.format = 1023; this.wrapS = 0; this.wrapT = 0; this.needsUpdate = false; this.disposed = false; this.anisotropy = 1; this.magFilter = 0; this.minFilter = 0; }
  dispose() { this.disposed = true; } clone() { return new Tex(this.image); } }
class Mesh extends Obj3D { constructor(g, m) { super(); this.geometry = g || new Geo('none'); this.material = m || new Mat(); this.isMesh = true; } clone() { const m = new Mesh(this.geometry, this.material); m.position.copy(this.position); m.scale.copy(this.scale); m.rotation.copy(this.rotation); return m; } }

const THREE = {
  Vector3: V3, Vector2: V2, Euler, Quaternion: Quat, Color: Col, Object3D: Obj3D, Group: Obj3D, Scene: class extends Obj3D {},
  Mesh, Points: Mesh, LineSegments: Mesh, Line: Mesh, Sprite: Mesh,
  BoxGeometry: class extends Geo { constructor(w = 1, h = 1, d = 1, sw = 1, sh = 1, sd = 1) { super('Box', { width: w, height: h, depth: d }); this.attributes = boxAttrs(w, h, d, sw, sh, sd); } },
  SphereGeometry: class extends Geo { constructor(r) { super('Sphere', { radius: r }); } },
  CylinderGeometry: class extends Geo { constructor(rt, rb, h) { super('Cylinder', { radiusTop: rt, radiusBottom: rb, height: h }); } },
  ConeGeometry: class extends Geo { constructor(r, h) { super('Cone', { radius: r, height: h }); } },
  TorusGeometry: class extends Geo { constructor(r, t) { super('Torus', { radius: r, tube: t }); } },
  PlaneGeometry: class extends Geo { constructor(w = 1, h = 1, sw = 1, sh = 1) { super('Plane', { width: w, height: h, widthSegments: sw, heightSegments: sh }); this.attributes = planeAttrs(w, h, sw, sh); } },
  CircleGeometry: class extends Geo {}, RingGeometry: class extends Geo {}, TetrahedronGeometry: class extends Geo {},
  DodecahedronGeometry: class extends Geo {}, IcosahedronGeometry: class extends Geo {}, OctahedronGeometry: class extends Geo {},
  CapsuleGeometry: class extends Geo {}, LatheGeometry: class extends Geo {}, ExtrudeGeometry: class extends Geo {}, ShapeGeometry: class extends Geo {},
  EdgesGeometry: class extends Geo { constructor(g) { super('Edges', {}); this.src = g; } },
  BufferGeometry: Geo,
  BufferAttribute: BufAttr, Float32BufferAttribute: BufAttr,
  MeshLambertMaterial: Mat, MeshBasicMaterial: Mat, MeshPhongMaterial: Mat, MeshStandardMaterial: Mat,
  MeshNormalMaterial: Mat, MeshDepthMaterial: Mat, SpriteMaterial: Mat, PointsMaterial: Mat, LineBasicMaterial: Mat, ShaderMaterial: Mat,
  CanvasTexture: Tex, Texture: Tex, DataTexture: Tex,
  HemisphereLight: class extends Obj3D { constructor(a, b, i) { super(); this.color = new Col(a); this.groundColor = new Col(b); this.intensity = i; } },
  DirectionalLight: class extends Obj3D { constructor(c, i) { super(); this.color = new Col(c); this.intensity = i; this.target = new Obj3D();
    this.shadow = { mapSize: { set() {}, width: 1024, height: 1024 }, camera: { left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0, updateProjectionMatrix() {} }, bias: 0, normalBias: 0, radius: 1 }; } },
  AmbientLight: class extends Obj3D { constructor(c, i) { super(); this.color = new Col(c); this.intensity = i; } },
  PointLight: class extends Obj3D { constructor(c, i) { super(); this.color = new Col(c); this.intensity = i; } },
  SpotLight: class extends Obj3D { constructor(c, i) { super(); this.color = new Col(c); this.intensity = i; this.target = new Obj3D(); } },
  PerspectiveCamera: class extends Obj3D { constructor(f, a, n, fa) { super(); this.fov = f; this.aspect = a; this.near = n; this.far = fa; } updateProjectionMatrix() {} },
  OrthographicCamera: class extends Obj3D { updateProjectionMatrix() {} },
  Fog: class { constructor(c, n, f) { this.color = new Col(c); this.near = n; this.far = f; } },
  FogExp2: class { constructor(c, d) { this.color = new Col(c); this.density = d; } },
  Clock: class { constructor() { this.t = 0; } getDelta() { return 1 / 60; } getElapsedTime() { this.t += 1 / 60; return this.t; } },
  Raycaster: class { constructor() { this.ray = { origin: new V3(), direction: new V3() }; } set() {} setFromCamera() {} intersectObject() { return []; } intersectObjects() { return []; } },
  WebGLRenderer: class { constructor(p) { Object.assign(this, p); this.shadowMap = { enabled: false, type: 0 }; this.domElement = p && p.canvas; this.capabilities = { getMaxAnisotropy: () => 8 }; this.info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } }; }
    setSize() {} setPixelRatio() {} render() {} dispose() {} getPixelRatio() { return 1; } setClearColor() {} compile() {} },
  RepeatWrapping: 1000, ClampToEdgeWrapping: 1001, MirroredRepeatWrapping: 1002,
  DoubleSide: 2, FrontSide: 0, BackSide: 1,
  AdditiveBlending: 2, NormalBlending: 1, MultiplyBlending: 4,
  PCFShadowMap: 1, PCFSoftShadowMap: 2, BasicShadowMap: 0, VSMShadowMap: 3,
  ACESFilmicToneMapping: 4, NoToneMapping: 0, LinearToneMapping: 1, ReinhardToneMapping: 2,
  sRGBEncoding: 3001, LinearEncoding: 3000, NearestFilter: 1003, LinearFilter: 1006, LinearMipmapLinearFilter: 1008,
  MathUtils: { degToRad: d => d * Math.PI / 180, radToDeg: r => r * 180 / Math.PI, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), lerp: (a, b, t) => a + (b - a) * t },
};

// ---------- DOM ----------
const ctx2d = () => ({
  canvas: null, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
  globalAlpha: 1, globalCompositeOperation: 'source-over', shadowBlur: 0, shadowColor: '', lineCap: '', lineJoin: '',
  fillRect() {}, clearRect() {}, strokeRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
  ellipse() {}, rect() {}, roundRect() {}, fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
  clip() {}, quadraticCurveTo() {}, bezierCurveTo() {}, setLineDash() {}, drawImage() {}, putImageData() {},
  fillText() {}, strokeText() {}, measureText: t => ({ width: String(t).length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  createPattern: () => ({}), getImageData: () => ({ data: new Uint8ClampedArray(4) }), createImageData: () => ({ data: new Uint8ClampedArray(4) }),
});

const noopStyle = () => new Proxy({ setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, {
  get: (t, k) => (k in t ? t[k] : ''), set: (t, k, v) => { t[k] = v; return true; },
});

function makeEl(tag = 'div', id = '') {
  const el = {
    tagName: String(tag).toUpperCase(), id, children: [], childNodes: [], parentNode: null,
    style: noopStyle(), dataset: {}, value: '', textContent: '', innerHTML: '', innerText: '',
    width: 256, height: 256, checked: false, disabled: false, hidden: false, scrollTop: 0, scrollHeight: 0,
    clientWidth: 1280, clientHeight: 720, offsetWidth: 1280, offsetHeight: 720,
    classList: (() => { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; }, contains: c => s.has(c), _set: s }; })(),
    appendChild(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); this.childNodes.splice(i, 1); } return c; },
    insertBefore(c) { return this.appendChild(c); },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    querySelector: () => makeEl('div'), querySelectorAll: () => [],
    getElementsByTagName: () => [], getElementsByClassName: () => [],
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    setAttribute(k, v) { this[k] = v; }, getAttribute(k) { return this[k] === undefined ? null : this[k]; },
    removeAttribute(k) { delete this[k]; }, hasAttribute(k) { return this[k] !== undefined; },
    focus() {}, blur() {}, click() {}, scrollIntoView() {}, animate: () => ({ finished: Promise.resolve(), cancel() {} }),
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720 }),
    getContext(kind) { if (kind === '2d') { const c = ctx2d(); c.canvas = el; return c; } return null; },
    toDataURL: () => 'data:image/png;base64,', requestPointerLock() {}, requestFullscreen: () => Promise.resolve(),
    play: () => Promise.resolve(), pause() {}, load() {},
  };
  return el;
}

const elements = new Map();
const document = {
  body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
  createElement: tag => makeEl(tag), createElementNS: (ns, tag) => makeEl(tag),
  createTextNode: t => ({ textContent: t }), createDocumentFragment: () => makeEl('fragment'),
  getElementById(id) { if (!elements.has(id)) elements.set(id, makeEl('div', id)); return elements.get(id); },
  querySelector(sel) { const m = /^#([\w-]+)$/.exec(sel); if (m) return document.getElementById(m[1]);
    if (sel === 'meta[name=theme-color]') return makeEl('meta'); return makeEl('div'); },
  querySelectorAll: () => [], getElementsByTagName: () => [], getElementsByClassName: () => [],
  addEventListener() {}, removeEventListener() {}, exitFullscreen: () => Promise.resolve(),
  fullscreenElement: null, pointerLockElement: null, hidden: false, visibilityState: 'visible', title: '',
};
document.body.parentNode = document.documentElement;

class FakeAudioParam { constructor(v) { this.value = v; } setValueAtTime(v) { this.value = v; return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; } exponentialRampToValueAtTime(v) { this.value = v; return this; }
  setTargetAtTime(v) { this.value = v; return this; } cancelScheduledValues() { return this; } setValueCurveAtTime() { return this; } }
class FakeAudioNode {
  constructor(kind) { this.kind = kind; this.started = false; this.stopped = false;
    this.frequency = new FakeAudioParam(440); this.gain = new FakeAudioParam(1); this.detune = new FakeAudioParam(0);
    this.Q = new FakeAudioParam(1); this.type = 'sine'; this.buffer = null; this.loop = false;
    this.playbackRate = new FakeAudioParam(1); this.onended = null; }
  connect(n) { return n; } disconnect() {} start() { this.started = true; } stop() { this.stopped = true; }
}
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = new FakeAudioNode('dest'); FakeAudioContext.instances.push(this); }
  createOscillator() { return new FakeAudioNode('osc'); } createGain() { return new FakeAudioNode('gain'); }
  createBiquadFilter() { return new FakeAudioNode('filter'); } createBufferSource() { return new FakeAudioNode('bufsrc'); }
  createDynamicsCompressor() { return new FakeAudioNode('comp'); } createStereoPanner() { return new FakeAudioNode('pan'); }
  createDelay() { return new FakeAudioNode('delay'); } createWaveShaper() { return new FakeAudioNode('shaper'); }
  createConvolver() { return new FakeAudioNode('conv'); } createAnalyser() { return new FakeAudioNode('analyser'); }
  createBuffer(ch, len, rate) { return { getChannelData: () => new Float32Array(len), length: len, sampleRate: rate, numberOfChannels: ch }; }
  resume() { this.state = 'running'; return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
}
FakeAudioContext.instances = [];

const localStorage = (() => { const m = new Map(); return {
  getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
  removeItem: k => m.delete(k), clear: () => m.clear(), key: i => [...m.keys()][i], get length() { return m.size; }, _map: m }; })();

const timers = { raf: [] };
const window = {
  document, localStorage, sessionStorage: localStorage, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessHarness', maxTouchPoints: 0, language: 'fr-FR',
    getGamepads: () => [], wakeLock: undefined, vibrate() {}, clipboard: { writeText: () => Promise.resolve() },
    share: undefined, mediaDevices: undefined },
  location: { href: 'http://localhost/', search: '', hash: '', protocol: 'http:', reload() {} },
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext,
  speechSynthesis: { speak() {}, cancel() {}, getVoices: () => [], speaking: false, pending: false },
  SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
  requestAnimationFrame: cb => { timers.raf.push(cb); return timers.raf.length; },
  cancelAnimationFrame() {}, setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: id => globalThis.clearTimeout(id),
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms), clearInterval: id => globalThis.clearInterval(id),
  addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  getComputedStyle: () => noopStyle(), alert() {}, confirm: () => true, prompt: () => null,
  screen: { width: 1280, height: 720, orientation: { lock: () => Promise.resolve(), unlock() {}, type: 'landscape-primary', angle: 0, addEventListener() {} } },
  performance: { now: () => 0 }, Peer: undefined, THREE,
};
window.window = window; window.self = window; window.top = window; window.parent = window;

module.exports = { THREE, document, window, localStorage, timers, FakeAudioContext, makeEl, elements, V3, Col };
