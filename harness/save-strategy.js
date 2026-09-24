'use strict';
const assert = require('node:assert/strict');
const { run } = require('./run');
const { localStorage } = require('./stubs');
const g = run(), cases = [];
function test(name, fn) {
  try { fn(); cases.push(true); console.log('PASS ' + name); }
  catch (e) { cases.push(false); console.error('FAIL ' + name + ': ' + e.stack); }
}
function save(d) { localStorage.setItem('superobby.guerre', JSON.stringify(d)); g.loadGuerre(); }
test('Malformed numeric objects cannot throw during strategic restore', () => {
  const hostileNumber = { valueOf: 12, toString: {} };
  assert.doesNotThrow(() => g.restoreEmpire({ defenses: { centre: hostileNumber }, wins: hostileNumber }));
  assert.equal(g.empire.defenses.centre, 0); assert.equal(g.empire.wins, 0);
});
test('Malformed campaign lists and economy fields produce a usable finite state', () => {
  save({ rep: 'broken', force: {}, magot: {}, armes: -8, saison: {}, palier: 999,
    morts: {}, membres: 'broken', recrues: {}, terr: { centre: 'joueur' },
    gangs: { jaune: { nom: {}, chef: {}, force: 'broken', rel: {}, magot: 'broken' } } });
  assert.equal(g.gang.rep, 0); assert.equal(g.gang.magot, 0); assert.equal(g.gang.force, 20);
  assert.equal(g.gang.armes, 0); assert.equal(g.guerre.saison, 1); assert.equal(g.guerre.palier, 5);
  assert.equal(g.guerre.morts.length, 0); assert.equal(g.guerre.sauvePerf.length, 0); assert.equal(g.guerre.sauveRecrues.length, 0);
  assert.equal(g.empireEconomy().income, 18); assert.equal(typeof g.guerre.sauve.jaune.nom, 'string');
  assert.doesNotThrow(() => g.loadWorld(4));
  assert(g.gangs.every(r => Number.isFinite(r.force) && Number.isFinite(r.magot)));
});
test('Legacy numeric strings are converted before income can concatenate cash', () => {
  save({ rep: '200', force: '0', magot: '120', terr: { centre: 'joueur' } });
  assert.equal(g.gang.rep, 200); assert.equal(g.gang.force, 0); assert.equal(g.gang.magot, 120);
  assert.equal(g.gang.magot + g.empireEconomy().income, 144);
});
test('Valid recruit performance survives both initial startup and city reconstruction', () => {
  const d = { rep: 200, magot: 0, perf: 63, terr: { centre: 'joueur' },
    recrues: [null, 'bad', { n: 'Veteran', p: 88, f: 45, fi: 91, an: 'rouge' }],
    membres: [null, { n: 'Ana', p: 70 }], morts: ['jaune', 'jaune', 'unknown'] };
  save(d);
  assert.equal(g.guerre.sauveRecrues.length, 1); assert.equal(g.guerre.sauvePerf.length, 1);
  assert.deepEqual(Array.from(g.guerre.morts), ['jaune']);
  // Initial boot invokes loadGuerre before the later performance helpers are initialized.
  localStorage.setItem('superobby.perf', '0');
  const restarted = run(); assert.equal(restarted.P.perf, 63); restarted.loadWorld(4);
  let recruit = restarted.gang.membresLibres.find(m => m.nom === 'Veteran');
  assert(recruit); assert.equal(recruit.perf, 88); assert.equal(recruit.fidelite, 91);
  restarted.saveGuerre(); restarted.loadWorld(0); restarted.loadGuerre(); restarted.loadWorld(4);
  recruit = restarted.gang.membresLibres.find(m => m.nom === 'Veteran');
  assert(recruit); assert.equal(recruit.perf, 88); assert.equal(restarted.gang.magot, 0);
});
console.log(JSON.stringify({ passed: cases.filter(Boolean).length, failed: cases.filter(x => !x).length }));
process.exitCode = cases.some(x => !x) ? 1 : 0;
