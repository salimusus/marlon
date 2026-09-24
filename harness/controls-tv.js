'use strict';
// Regression tests execute the actual functions served by index.html, without a GPU.
// Run: node harness/controls-tv.js (also works where child processes are restricted).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const MarlonControls = require('../controls.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function declaration(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing production function: ${name}`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end + 2);
}
function sandbox(names, extra = {}) {
  const elements = new Map();
  const element = () => ({ textContent: '', innerHTML: '', style: {}, disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    querySelector() { return null; }, addEventListener() {} });
  const s = { console, Math, Set, Map, Number, Object, Array, Promise, Date, MarlonControls,
    inputKeys: MarlonControls.createKeySources(), padController: MarlonControls.createController(),
    clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    $: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    document: { hidden: false, visibilityState: 'visible', body: element(), querySelector() { return null; } },
    navigator: {}, window: {}, keys: new Set(), jumpHeld: false, downHeld: false,
    running: true, paused: false, simTime: 10, uiOpen: null,
    pad: {}, P: { energie: 100, weapon: null, drawn: false }, drive: { car: null },
    PAD_MAP: { 0: 'KeyG', 1: 'Space', 2: 'KeyV', 3: 'KeyE', 5: 'KeyX', 8: 'KeyT', 9: 'Escape' },
    PAD_BOUTONS: 18, PAD_HID_PS: [2, 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17],
    PAD_SEUIL_GACHETTE: .35, PAD_GACHETTE_MORTE: .06,
    CAM_MORTE: .075, CAM_LIN: .35, CAM_DERIVE: .085, CAM_VYAW: 5.5, CAM_VPITCH: 3.3, CAM_PITCH_ARME: -.8, CAM_PITCH_HAUT: -.4,
    cam: { yaw: 0, pitch: .1 }, settings: { sensib: 1 },
    performance: { now: () => 100 },
    setGarde(v) { s.P.garde = v; }, setAccroupi(v) { s.P.accroupi = v; },
    msg() {}, padSon() {}, padEssaiTick() {}, padVibre() {}, padMenu() {},
    telTouche() {}, tvManettesMaj() {}, tvSalonMaj() {}, curseurAccueil() {},
    setTimeout() { return 1; }, clearTimeout() {},
    ...extra };
  vm.createContext(s);
  vm.runInContext(names.map(declaration).join('\n'), s);
  return s;
}
// camMorte / camDerive : depuis l'arbitrage r77, la zone morte de la CAMERA derive du curseur
// du menu (settings.padDeadzone) au lieu d'etre une constante — padVisee et pollGamepad les appellent.
const padRead = ['padProfil', 'padChapeau', 'padAxeChapeau', 'padLu', 'padStick', 'camMorte', 'camDerive', 'padVisee'];
const gamepad = (axes = [0, 0, 0, 0]) => ({ id: 'Xbox', index: 0, connected: true, mapping: 'standard', axes,
  buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })) });
const near = (value, target, epsilon = 1e-9) => assert.ok(Math.abs(value - target) < epsilon, `${value} != ${target}`);

test('sticks: radial dead zone, full diagonal speed and finite malformed values', () => {
  const s = sandbox(padRead);
  assert.deepEqual(Array.from(s.padStick(.04, .04)), [0, 0]);
  near(Math.hypot(...s.padStick(1, 1)), 1);
  near(Math.hypot(...s.padVisee(1, -1)), 1);
  for (const v of s.padStick(NaN, Infinity)) assert.ok(Number.isFinite(v));
  const L = s.padLu(gamepad([Infinity, NaN, -2, 4]));
  assert.deepEqual([L.lx, L.ly, L.rx, L.ry], [0, 0, -1, 1]);
});
test('DualSense HID: centered trigger is half pressed, hat and face buttons map correctly', () => {
  const s = sandbox(padRead), gp = gamepad([0, 0, 0, 0, -1, .5, -1]);
  gp.id = '054c DualSense'; gp.mapping = ''; gp.buttons.length = 14; gp.buttons[0].pressed = true;
  const L = s.padLu(gp);
  assert.equal(L.profil, 'ps-hid'); near(L.l2, .5); near(L.r2, 0); near(L.ry, .5);
  assert.equal(L.b[2], true); assert.equal(L.b[12], true);
});
test('phone joystick keeps full speed after dragging beyond its visual radius', () => {
  const s = sandbox(['telStickAxes']);
  near(s.telStickAxes(50, 0, 50)[0], 1);
  near(s.telStickAxes(150, 0, 50)[0], 1);
  near(Math.hypot(...s.telStickAxes(150, -150, 50)), 1);
  near(Math.hypot(...s.telStickAxes(2, 2, 50)), 0);
  assert.deepEqual(Array.from(s.telStickAxes(4, 2, 0)), [0, 0]);
});
test('disconnect cancels helicopter ascent, held punch and crouch without emitting an attack', () => {
  const s = sandbox(['releaseGamepad']);
  Object.assign(s.pad, { a: true, l2: true, x: 1, y: 1, gaz: 1, frein: 1, bas: { 1: true } });
  s.keys.add('Space'); s.keys.add('KeyV'); s.P.vDown = 2;
  s.inputKeys.set('Space', 'gamepad', true); s.inputKeys.set('KeyV', 'gamepad', true);
  s.releaseGamepad();
  assert.equal(s.pad.a, false); assert.equal(s.pad.gaz, 0); assert.equal(s.pad.frein, 0);
  assert.equal(s.jumpHeld, false); assert.equal(s.keys.has('KeyV'), false); assert.equal(s.P.vDown, null);
  assert.equal(s.pad.neutralRequired, true);
});
test('plugging another controller does not steal the active controller', () => {
  const primary = gamepad(), secondary = { ...gamepad(), id: 'DualSense', index: 1 };
  const s = sandbox(['padActive'], { gamepadOk: true, navigator: { getGamepads: () => [primary, secondary] },
    manetteSalon: { i: 0 }, releaseGamepad() { throw Error('Unexpected release'); } });
  assert.equal(s.padActive(), primary);
});
test('menu transitions require release, so a held Options button cannot reopen the menu', () => {
  const gp = gamepad(); gp.buttons[9].pressed = true;
  let menuCalls = 0;
  const s = sandbox([...padRead, 'padContexte', 'releaseGamepad', 'pollGamepad'], {
    padActive: () => gp, manetteSalon: {}, padMenu(L, b, before) { if (b[9] && !before[9]) ++menuCalls; }, padCourse: x => x });
  s.document.querySelector = sel => sel === '.overlay:not(.hidden)' ? { id: 'menu' } : null;
  s.pollGamepad(.008); s.pollGamepad(.008);
  assert.equal(menuCalls, 0); assert.equal(s.pad.neutralRequired, true);
  gp.buttons[9].pressed = false;
  s.pollGamepad(.008);
  assert.equal(menuCalls, 0); assert.equal(s.pad.neutralRequired, false);
  gp.buttons[9].pressed = true; s.pollGamepad(.008); assert.equal(menuCalls, 1);
});

const telFunctions = ['telRelache', 'telBouton', 'telVeille', 'telCommande'];
function remote(extra = {}) {
  const events = [];
  const s = sandbox(telFunctions, {
    tel: { x: 0, y: 0, last: 0, buttons: new Set(), n: null },
    TEL_TOUCHES: { saut: 'Space', action: 'KeyE', frappe: 'KeyV', menu: 'Escape' },
    telTouche(k, down) { events.push([k, down]); s.inputKeys.set(k, 'phone', down); if (down) s.keys.add(k); else s.keys.delete(k); },
    ...extra });
  s.events = events; return s;
}
test('network reconnect resets packet ordering and accepts a fresh sequence immediately', () => {
  const s = remote();
  s.telCommande({ t: 'in', n: 500, x: 1, y: 0 });
  s.telCommande({ t: 'in', n: 499, x: -1, y: 0 });
  assert.equal(s.tel.x, 1);
  s.telCommande({ t: 'hello', nom: 'New phone' });
  s.telCommande({ t: 'in', n: 1, x: -.5, y: 0 });
  assert.equal(s.tel.x, -.5); assert.equal(s.tel.n, 1);
});
test('full input snapshots recover a missed button release without duplicate key presses', () => {
  const s = remote();
  s.telCommande({ t: 'btn', b: 'saut', down: true });
  s.telCommande({ t: 'in', n: 1, x: 0, y: 0, buttons: ['saut'] });
  s.telCommande({ t: 'in', n: 2, x: 0, y: 0, buttons: [] });
  assert.deepEqual(s.events, [['Space', true], ['Space', false]]);
  assert.equal(s.keys.has('Space'), false);
});
test('silent connection watchdog clears held controls using wall time even while paused', () => {
  let now = 100;
  const s = remote({ performance: { now: () => now } });
  s.telCommande({ t: 'in', n: 1, x: 1, y: 1, buttons: ['frappe', 'saut'] });
  s.paused = true; now = 1100; s.telVeille();
  assert.equal(s.tel.x, 0); assert.equal(s.tel.y, 0); assert.equal(s.keys.size, 0);
  assert.deepEqual(s.events, [['KeyV', true], ['Space', true]]); // no punch on synthetic keyup
});
test('hidden receiver rejects movement and malformed camera values never corrupt the view', () => {
  const s = remote();
  s.telCommande({ t: 'in', n: 1, dx: Infinity, dy: NaN });
  assert.ok(Number.isFinite(s.cam.yaw)); assert.ok(Number.isFinite(s.cam.pitch));
  s.document.hidden = true; s.telCommande({ t: 'in', n: 2, x: 1, y: 1 });
  assert.equal(s.tel.x, 0); assert.equal(s.tel.y, 0);
});

class Emitter {
  constructor() { this.events = {}; this.open = false; this.sent = []; }
  on(name, callback) { this.events[name] = callback; }
  emit(name, data) { if (this.events[name]) this.events[name](data); }
  send(data) { this.sent.push(data); }
  close() { this.open = false; this.emit('close'); }
}
function host() {
  const peers = [];
  class Peer extends Emitter {
    constructor(id) { super(); this.id = id; peers.push(this); }
    destroy() { this.destroyed = true; this.emit('close'); }
    reconnect() { this.reconnected = true; }
  }
  const accepted = [];
  const s = sandbox(['tvHeberge', 'telRelache'], {
    Peer, RESEAU: {}, tv: { peer: null, code: 'ABCD', conns: [] }, net: { on: false },
    TEL_TOUCHES: {}, tel: { buttons: new Set(), source: null },
    myCfg: { name: 'Marlon' }, sfx: { win() {} }, telCommande(d) { accepted.push(d); } });
  return { s, peers, accepted };
}
test('TV room conflict preserves the code in the link and exposes a recoverable error', () => {
  const { s, peers } = host(); s.tvHeberge('ABCD');
  peers[0].emit('error', { type: 'unavailable-id' });
  assert.equal(s.tv.code, 'ABCD'); assert.equal(s.tv.peer, null);
  assert.match(s.tv.erreur, /Transférer/); assert.ok(s.tv.retryAt > Date.now());
});
test('only one phone drives the player and control transfers cleanly after disconnect', () => {
  const { s, peers, accepted } = host(); s.tvHeberge('ABCD');
  const a = new Emitter(), b = new Emitter();
  for (const c of [a, b]) { peers[0].emit('connection', c); c.open = true; c.emit('open'); }
  a.emit('data', 'A'); b.emit('data', 'B');
  assert.deepEqual(accepted, ['A']); assert.equal(b.sent[0].active, false);
  s.tel.n = 200; a.close(); b.emit('data', 'B2');
  assert.deepEqual(accepted, ['A', 'B2']); assert.equal(s.tel.source, b); assert.equal(s.tel.n, null);
});
test('obsolete TV peer events cannot clear a replacement host', () => {
  const { s, peers } = host(); s.tvHeberge('ABCD');
  const first = peers[0]; first.emit('error', { type: 'network' }); s.tvHeberge('ABCD');
  first.emit('close'); first.emit('error', { type: 'network' });
  assert.equal(s.tv.peer, peers[1]);
});
test('Presentation request refreshes when the room changes and failures restore its button', async () => {
  let code = 'ABCD'; const urls = [];
  class PresentationRequest {
    constructor(url) { urls.push(url[0]); }
    getAvailability() { return Promise.resolve({ value: false, addEventListener() {} }); }
    start() { return Promise.reject({ name: 'NotAllowedError' }); }
  }
  const s = sandbox(['castPret', 'castPrepare', 'castLance', 'castMaj'], {
    PresentationRequest, cast: { req: null, session: null, starting: false }, tv: { cede: false },
    lienTV: () => `https://game.test/#tv=${code}` });
  s.castPrepare(); code = 'WXYZ'; s.castPrepare();
  assert.deepEqual(urls, ['https://game.test/#tv=ABCD', 'https://game.test/#tv=WXYZ']);
  s.castLance(); assert.equal(s.cast.starting, true);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(s.cast.starting, false); assert.equal(s.$('tvCast').disabled, false);
});
test('congested phone channel drops stale motion while preserving urgent release', () => {
  const c = new Emitter(); c.open = true; c.dataChannel = { bufferedAmount: 12000 };
  const s = sandbox(['manEnvoie'], { man: { conn: c } });
  assert.equal(s.manEnvoie({ t: 'in', x: 1 }), false);
  assert.equal(s.manEnvoie({ t: 'release' }), true);
  assert.equal(c.sent.length, 1); assert.equal(c.sent[0].t, 'release');
});
test('phone reconnect uses one retry and ignores callbacks from its previous peer', () => {
  const peers = [], timers = new Map(); let nextTimer = 0;
  class Peer extends Emitter {
    constructor() { super(); peers.push(this); }
    connect() { this.connection = new Emitter(); return this.connection; }
    destroy() { if (this.connection) this.connection.close(); this.emit('close'); }
  }
  const s = sandbox(['manetteConnecte', 'manRelache', 'manEnvoie'], {
    Peer, RESEAU: {}, MAN_ESSAIS: 4, MAN_DELAI: 7000,
    man: { peer: null, conn: null, buttons: new Set(), generation: 0 },
    manetteEtat() {}, manetteEchec() {}, localStorage: { getItem: () => null },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); } });
  s.document.getElementById = s.$;
  s.manetteConnecte('ABCD'); peers[0].emit('open');
  const c = peers[0].connection; c.open = true; c.emit('open'); c.close();
  assert.equal([...timers.values()].filter(t => t.ms === 600).length, 1);
  s.manetteConnecte('WXYZ');
  const fresh = s.man.peer, before = timers.size;
  peers[0].emit('error', { type: 'peer-unavailable' }); peers[0].emit('open');
  assert.equal(s.man.peer, fresh); assert.equal(s.man.code, 'WXYZ'); assert.equal(timers.size, before);
  assert.equal([...timers.values()].filter(t => t.ms === 600).length, 0);
});
