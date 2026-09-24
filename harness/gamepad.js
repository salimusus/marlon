'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Controls = require('../controls');
const stubs = require('./stubs');
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const makePad = (id = 'Xbox Wireless Controller') => ({ id, index: 0, mapping: 'standard', connected: true,
  axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ value: 0, pressed: false })) });
const button = (gp, index, value) => { gp.buttons[index] = { value, pressed: value > .5 }; };
function reader(gp = makePad()) {
  const controller = Controls.createController(); let now = 0;
  const tick = (context = 'game:foot', ms = 8) => controller.sample(gp, { context, now: now += ms, deadzone: .12, lookDeadzone: .12 });
  tick(); return { gp, controller, tick };
}
test('PS5 and Xbox standard layouts expose the same sticks and action edges', () => {
  for (const id of ['DualSense Wireless Controller', 'Xbox Wireless Controller']) {
    const { gp, tick } = reader(makePad(id)); gp.axes = [.7, -.7, -.6, .2]; button(gp, 3, 1);
    const frame = tick(); assert.equal(frame.pressed[3], true); assert.equal(tick().pressed[3], false);
    assert.ok(frame.move[0] > 0 && frame.move[1] < 0 && frame.look[0] < 0);
    button(gp, 3, 0); assert.equal(tick().released[3], true);
  }
});
test('DualSense raw HID keeps resting triggers out of the camera and maps all face buttons', () => {
  const gp = makePad('054c DualSense'); gp.mapping = ''; gp.buttons.length = 14; gp.axes = [0, 0, 0, -1, -1, 0, 1.2857];
  let raw = Controls.normalize(gp); assert.equal(raw.profil, 'ps-hid'); near(raw.ry, 0); near(raw.l2, 0); near(raw.r2, 0);
  for (const [from, to] of [[0, 2], [1, 0], [2, 1], [3, 3]]) {
    button(gp, from, 1); raw = Controls.normalize(gp); assert.equal(raw.b[to], true); button(gp, from, 0);
  }
  gp.axes[6] = -1; assert.equal(Controls.normalize(gp).b[12], true);
});
test('trigger hysteresis prevents repeat actions at a noisy threshold', () => {
  const { gp, tick } = reader(); let presses = 0, releases = 0;
  for (const v of [.1, .34, .36, .33, .37, .25, .23, .21, .35, .36]) {
    button(gp, 6, v); const frame = tick(); presses += +frame.pressed[6]; releases += +frame.released[6];
  }
  assert.equal(presses, 2); assert.equal(releases, 1);
});
test('diagonals retain full speed and default radial deadzone removes paired 8% drift', () => {
  const { gp, tick } = reader(); gp.axes = [.08, -.08, .08, .08];
  assert.deepEqual(tick().move, [0, 0]); assert.deepEqual(tick().look, [0, 0]);
  gp.axes = [1, -1, -1, 1]; const frame = tick(); near(Math.hypot(...frame.move), 1); near(Math.hypot(...frame.look), 1);
  const calibrated = Controls.createController(); gp.axes = [.24, 0, 0, 0];
  calibrated.sample(gp, { context: 'menu:pause', deadzone: .28 });
  assert.equal(calibrated.sample(gp, { context: 'game:foot', deadzone: .28 }).neutralRequired, false);
  gp.axes[0] = .8; assert.ok(calibrated.sample(gp, { context: 'game:foot', deadzone: .28 }).move[0] > .5);
});
test('malformed and out-of-range browser readings never inject NaN into camera or movement', () => {
  const { gp, tick } = reader(); gp.axes = [NaN, Infinity, -Infinity, 8]; gp.buttons[7] = { value: NaN };
  const frame = tick(); for (const value of [...frame.move, ...frame.look, frame.gaz, frame.frein]) assert.ok(Number.isFinite(value));
});
test('menu transition rearms each control independently, so a held stick cannot trap Back', () => {
  const { gp, tick } = reader(); gp.axes[0] = 1; button(gp, 9, 1); tick();
  const frame = tick('menu:pause'); assert.equal(frame.b[9], false); assert.deepEqual(frame.move, [0, 0]);
  button(gp, 1, 1); assert.equal(tick('menu:pause').pressed[1], true);
});
test('changing between two menus suppresses held confirm without losing the next press', () => {
  const { gp, tick } = reader(); tick('menu:pause'); button(gp, 0, 1); assert.equal(tick('menu:pause').pressed[0], true);
  assert.equal(tick('menu:shop').pressed[0], false); button(gp, 0, 0); tick('menu:shop'); button(gp, 0, 1);
  assert.equal(tick('menu:shop').pressed[0], true);
});
test('small held throttle cannot accelerate when a menu closes', () => {
  const { gp, tick } = reader(); tick('menu:pause'); button(gp, 7, .25); tick('menu:pause');
  assert.equal(tick('game:vehicle').gaz, 0); button(gp, 7, 0); tick('game:vehicle'); button(gp, 7, .25);
  assert.ok(tick('game:vehicle').gaz > .1);
});
test('focus loss and a replaced controller cannot replay held jump or shooting', () => {
  const { gp, tick, controller } = reader(); button(gp, 1, 1); tick(); controller.reset();
  assert.equal(tick().pressed[1], false); gp.id = 'Replacement DualSense'; assert.equal(tick().pressed[1], false);
  button(gp, 1, 0); tick(); button(gp, 1, 1); assert.equal(tick().pressed[1], true);
});
test('menu navigation has hysteresis and a bounded repeat delay instead of flooding clicks', () => {
  const { gp, tick } = reader(); tick('menu:pause'); gp.axes[0] = .6;
  assert.equal(tick('menu:pause').navigation, 'droite'); gp.axes[0] = .48;
  assert.equal(tick('menu:pause', 100).navigation, null);
  assert.equal(tick('menu:pause', 280).navigation, 'droite');
  assert.equal(tick('menu:pause', 129).navigation, null); assert.equal(tick('menu:pause', 1).navigation, 'droite');
});
test('keyboard, phone and physical controller own their holds independently', () => {
  const sources = Controls.createKeySources();
  assert.equal(sources.set('Space', 'keyboard', true), true);
  assert.equal(sources.set('Space', 'gamepad', true), false);
  assert.equal(sources.set('Space', 'phone', true), false);
  assert.deepEqual(sources.release('gamepad'), []); assert.equal(sources.has('Space'), true);
  assert.equal(sources.set('Space', 'keyboard', false), false); assert.deepEqual(sources.release('phone'), ['Space']);
});

// Execute the complete production script, including its real keyboard listeners. Only DOM/GPU/device I/O is stubbed.
const listeners = new Map(); let now = 0, device = makePad(), overlay = null, cinema = false;
stubs.window.addEventListener = (type, listener) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); };
stubs.window.dispatchEvent = event => { for (const listener of listeners.get(event.type) || []) listener(event); return true; };
stubs.window.KeyboardEvent = class { constructor(type, options = {}) { Object.assign(this, { type, repeat: false }, options); } preventDefault() {} stopPropagation() {} stopImmediatePropagation() {} };
stubs.window.navigator.getGamepads = () => device ? [device] : [];
stubs.window.performance.now = () => now;
const G = require('./run').run();
const selector = stubs.document.querySelector;
stubs.document.querySelector = sel => sel === '#marlonCinema' ? (cinema ? {} : null) : sel === '.overlay:not(.hidden)' ? overlay : sel === '.focustv' ? null : selector(sel);
const key = (code, down, source = 'keyboard') => { const event = new stubs.window.KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }); event.marlonSource = source; stubs.window.dispatchEvent(event); };
function reset() {
  G.closeUI(); G.releaseGamepad(); G.inputKeys.clear(); G.keys.clear(); device = makePad(); overlay = null; cinema = false;
  stubs.document.activeElement = null; stubs.document.visibilityState = 'visible';
  G.running = true; G.paused = false; G.pad.suspended = false; G.drive.car = null; G.P.weapon = null; G.P.drawn = false;
  G.settings.padDeadzone = .12; G.settings.padMove = 'camera'; G.settings.sensib = 1; G.settings.invY = false;
  G.P.jumpBuf = 0; G.P.aim = false; G.cam.yaw = 0; G.cam.pitch = .1; now += 100; G.pollGamepad(1 / 120);
}
test('full game: jump travels through the real gamepad → keyboard bridge exactly once', () => {
  reset(); button(device, 1, 1); G.pollGamepad(.008);
  assert.equal(G.keys.has('Space'), true); assert.equal(G.P.jumpBuf, .15);
  G.P.jumpBuf = 0; G.pollGamepad(.008); assert.equal(G.P.jumpBuf, 0);
  button(device, 1, 0); G.pollGamepad(.008); assert.equal(G.keys.has('Space'), false);
});
test('full game: disconnect preserves a physical keyboard hold and cancels only controller punch', () => {
  reset(); key('Space', true); button(device, 1, 1); button(device, 2, 1); G.pollGamepad(.008);
  assert.equal(G.keys.has('KeyV'), true); device = null; G.pollGamepad(.008);
  assert.equal(G.keys.has('Space'), true); assert.equal(G.keys.has('KeyV'), false); assert.equal(G.P.vDown, null);
  key('Space', false); assert.equal(G.keys.has('Space'), false);
});
test('full game: phone disconnect cannot cancel controller jump', () => {
  reset(); button(device, 1, 1); G.pollGamepad(.008); G.telBouton('saut', true); G.telRelache();
  assert.equal(G.keys.has('Space'), true); button(device, 1, 0); G.pollGamepad(.008); assert.equal(G.keys.has('Space'), false);
});
test('full game: introduction blocks movement, camera and jump through its closing button', () => {
  reset(); cinema = true; G.pollGamepad(.008); button(device, 1, 1); device.axes = [1, -1, 1, 1]; G.pollGamepad(.008);
  near(G.pad.x, 0); near(G.cam.yaw, 0); assert.equal(G.P.jumpBuf, 0);
  cinema = false; G.pollGamepad(.008); assert.equal(G.P.jumpBuf, 0); near(G.pad.x, 0);
  button(device, 1, 0); device.axes.fill(0); G.pollGamepad(.008); button(device, 1, 1); G.pollGamepad(.008); assert.equal(G.P.jumpBuf, .15);
});
test('full game: Options takes priority over simultaneous jump and held Options does not reopen', () => {
  reset(); button(device, 9, 1); button(device, 1, 1); G.pollGamepad(.008);
  assert.equal(G.uiOpen, 'menu'); assert.equal(G.P.jumpBuf, 0); overlay = stubs.document.getElementById('menu');
  G.pollGamepad(.008); assert.equal(G.uiOpen, 'menu');
  button(device, 9, 0); button(device, 1, 0); G.pollGamepad(.008);
  button(device, 1, 1); G.pollGamepad(.008); assert.equal(G.uiOpen, null); overlay = null;
  G.pollGamepad(.008); assert.equal(G.P.jumpBuf, 0); assert.equal(G.uiOpen, null);
});
test('full game: camera rotation is identical at 30, 60 and 120 input samples per second', () => {
  const angles = [];
  for (const hz of [30, 60, 120]) { reset(); device.axes[2] = .6; for (let i = 0; i < hz; i++) { now += 1000 / hz; G.pollGamepad(1 / hz); } angles.push(G.cam.yaw); }
  // ARBITRAGE r76 : ce qui compte ici est l'EGALITE entre 30, 60 et 120 Hz. La borne haute
  // etait a 2 rad, ce qui n'etait tenable qu'avec CAM_VYAW = 3.8 ; or les tests 220 et 396 du
  // banc exigent 5,5 rad/s au bord (280 a 340 °/s), la vitesse demandee par le joueur au
  // round 71. A 60 % de course et 12 % de zone morte cela fait 2,11 rad : borne portee a 2,5.
  near(angles[0], angles[1]); near(angles[1], angles[2]); assert.ok(Math.abs(angles[0]) > .8 && Math.abs(angles[0]) < 2.5);
});
test('full game: keyboard aim survives idle gamepad polling and stick drift does not move the view', () => {
  reset(); key('ShiftLeft', true); device.axes = [.08, -.08, .08, .08]; G.pollGamepad(.008);
  assert.equal(G.P.aimHeld, true); near(G.pad.x, 0); near(G.cam.yaw, 0);
  key('ShiftLeft', false); assert.equal(G.P.aimHeld, false);
});
test('full game: a focused text field cannot move the player or camera with a controller', () => {
  reset(); stubs.document.activeElement = { tagName: 'INPUT', type: 'text', offsetParent: {} };
  device.axes = [1, -1, 1, 1]; G.pollGamepad(.008); near(G.pad.x, 0); near(G.cam.yaw, 0);
});
test('full game: camera-relative stick moves sideways, while rotation mode remains selectable', () => {
  stubs.document.getElementById('stBar').parentNode = stubs.document.body;
  G.loadWorld(0); reset(); G.P.pos.set(0, 1, 0); G.P.vel.set(0, 0, 0); G.P.facing = Math.PI;
  device.axes[0] = .6;
  for (let i = 0; i < 30; i++) { G.pollGamepad(1 / 60); G.step(1 / 60, true); }
  assert.ok(G.P.pos.x > .5, `sideways travel ${G.P.pos.x}`);
  reset(); G.settings.padMove = 'rot'; G.P.pos.set(0, 1, 0); G.P.vel.set(0, 0, 0); G.P.facing = Math.PI;
  device.axes[0] = .6;
  for (let i = 0; i < 30; i++) { G.pollGamepad(1 / 60); G.step(1 / 60, true); }
  near(G.P.pos.x, 0); assert.ok(G.P.facing < Math.PI - .2);
});
test('full game: changing world closes menu ownership so subsequent controller actions remain available', () => {
  reset(); G.openUI('menu'); G.openUI('worlds'); G.chooseWorld(0);
  assert.equal(G.uiOpen, null); assert.equal(G.paused, false); assert.equal(G.running, true);
});
