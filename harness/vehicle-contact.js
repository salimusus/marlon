'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function declaration(name) { const at = source.indexOf('function ' + name + '('); assert(at >= 0); return source.slice(at, source.indexOf('\n}', at) + 2); }
const T = require('../vendor/three.min.js');
const s = { Math, city: { cars: [], aiCars: [] }, police: { cars: [] }, drive: { car: null },
  vehBloque: () => false,
  vehicleSolid(v) { v.solid.x = v.x; v.solid.z = v.z; }
};
vm.createContext(s); vm.runInContext(declaration('contactVehicules') + '\n' + declaration('separerVehicules'), s);
let count = 0;
function test(name, f) { s.city.cars = []; s.city.aiCars = []; s.police.cars = []; s.vehBloque = () => false; s.drive.car = null; f(); count++; console.log('PASS ' + name); }
function car(x, z, h = 0, ambient = false, width = 2.4, length = 4.4) {
  const c = { x, z, y: 0, h, baseW: width, baseD: length, solid: { x, z, w: width, d: length }, g: new T.Group() };
  c.g.position.set(x, 0, z); if (ambient) c.s = 10; return c;
}
test('Parallel cars in a bend are not pushed when only their bounding boxes overlap', () => {
  const h = Math.PI / 4, a = car(0, 0, h), b = car(Math.cos(h) * 2.8, -Math.sin(h) * 2.8, h);
  assert.equal(s.contactVehicules(a, b), null); s.city.cars = [a, b]; s.separerVehicules(); assert.equal(a.x, 0); assert.equal(b.x, Math.cos(h) * 2.8);
});
test('Ambient traffic position, mesh and collider all update during contact resolution', () => {
  const a = car(0, 0, 0, true), b = car(1.7, 0, 0, true); s.city.aiCars = [a, b]; s.separerVehicules();
  assert(Math.abs(a.x - b.x) >= 2.42 - 1e-8);
  for (const v of [a, b]) { assert.equal(v.g.position.x, v.x); assert.equal(v.g.position.z, v.z); assert.equal(v.solid.x, v.x); assert.equal(v.solid.z, v.z); }
  const previous = [a.x, b.x]; s.separerVehicules(); assert.deepEqual([a.x, b.x], previous);
});
test('The smallest separation follows the chassis orientation at every tested heading', () => {
  for (let i = 0; i < 24; i++) {
    const h = i * Math.PI / 12, a = car(0, 0, h), b = car(Math.cos(h) * 2, -Math.sin(h) * 2, h);
    const contact = s.contactVehicules(a, b); assert(contact); assert(Math.abs(Math.hypot(contact.x, contact.z) - .42) < 1e-8);
    a.x += contact.x; a.z += contact.z; const residual = s.contactVehicules(a, b); assert(!residual || Math.hypot(residual.x, residual.z) < 1e-8);
  }
});
test('Cars blocked by a facade keep their side, leaving the free car to separate', () => {
  const a = car(0, 0), b = car(1.7, 0); s.city.cars = [a, b]; s.vehBloque = v => v === a && v.x < 0;
  s.separerVehicules(); assert.equal(a.x, 0); assert(b.x >= 2.42 - 1e-8);
});
test('Cars on different levels and the driven player vehicle are not displaced', () => {
  const a = car(0, 0), b = car(0, 0); s.city.cars = [a, b]; b.y = 4; s.separerVehicules(); assert.equal(a.x, 0);
  b.y = 0; s.drive.car = a; s.separerVehicules(); assert.equal(a.x, 0); assert.equal(b.x, 0);
});
test('Long truck corners are detected without an axis-aligned false collision', () => {
  const a = car(0, 0, Math.PI / 3, false, 2.6, 8.6), b = car(2.2, 1); assert(s.contactVehicules(a, b));
  b.x = 20; assert.equal(s.contactVehicules(a, b), null);
});
console.log(count + ' vehicle contact regression tests passed.');
