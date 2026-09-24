'use strict';
// CPU regression tests for the shipped index.html. Rendering and real controller
// latency are deliberately outside this harness; the full street geometry is loaded.
const assert = require('node:assert/strict');
const { run } = require('./run');
const random = Math.random;
let seed = 6174;
Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
const g = run();
g.loadWorld(4);
const results = [];
function test(name, f) {
  try { f(); results.push({ name, ok: true }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, ok: false }); console.error('FAIL ' + name + ': ' + e.stack); }
}
function fixture(values, f) {
  const old = Object.fromEntries(Object.keys(values).map(k => [k, g.city[k]]));
  Object.assign(g.city, values);
  try { f(); } finally { Object.assign(g.city, old); }
}
test('All building and shop footprints stay outside the 89 streets', () => {
  assert(g.city.routes.length >= 89);
  for (const b of [...g.city.batiments, ...g.city.interieurs]) for (const r of g.city.routes) {
    const overlap = Math.min((b.w + r.w) / 2 - Math.abs(b.x - r.x), (b.d + r.d) / 2 - Math.abs(b.z - r.z));
    assert(overlap <= .4, `building ${b.x},${b.z} overlaps street ${r.x},${r.z} by ${overlap}`);
  }
});
test('Clothes shop has a clear entrance and fitting-room access', () => {
  assert.equal(g.city.cabin.x, -18);
  for (const z of [15, 16.2, 17.5, 19, 20.2]) {
    const blocked = g.solids.some(o => !o.veh && o.y + o.h / 2 > 1 && o.y - o.h / 2 < 1.9
      && Math.abs(o.x + 18) < o.w / 2 + .35 && Math.abs(o.z - z) < o.d / 2 + .35);
    assert(!blocked, `clothes shop blocked at z=${z}`);
  }
});
test('Destination behind never draws a wrong-way line on the departure lane', () => {
  const route = g.itineraireVoies(-60, -102.75, -40, -102.75, -Math.PI / 2);
  assert(route && route.length > 1);
  for (let i = 1; i < route.length; i++) {
    const [a, b] = [route[i - 1], route[i]];
    assert(!(Math.abs(a[1] + 102.75) < .1 && Math.abs(b[1] + 102.75) < .1 && b[0] > a[0] + .1), 'eastbound on the westbound lane');
  }
});
test('Destination ahead stays a direct route in the correct lane', () => {
  const route = g.itineraireVoies(-60, -102.75, -80, -102.75, -Math.PI / 2);
  assert(route && route.length > 1);
  assert.equal(route.at(-1)[0], -80);
  for (let i = 1; i < route.length; i++) assert(route[i][0] <= route[i - 1][0]);
});
test('A destination behind remains reachable after a legal loop', () => {
  const aretes = Array.from({ length: 3 }, (_, id) => ({ id, vers: id, long: 10, vmax: 10 }));
  const noeuds = aretes.map(e => ({ manoeuvres: [{ de: e.id, vers: (e.id + 1) % 3, type: 'tout-droit' }] }));
  fixture({ graphe: { aretes, noeuds } }, () => {
    const route = g.cheminAretes(new Map([[0, 8]]), aretes[0], new Map([[0, -9]]), new Set([0]));
    assert.deepEqual(Array.from(route, e => e.id), [0, 1, 2, 0]);
  });
});
test('Every district has a route from the central road', () => {
  for (const d of g.city.plan.dessertes) {
    const route = g.itineraireVoies(24, 0, d.x, d.z, Math.PI);
    assert(route && route.length > 1, d.n);
    assert(route.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])), d.n);
  }
});
test('Moving traffic keeps its departure direction across destination changes', () => {
  const c = { x: -83, z: -65, h: Math.PI, speed: 6 };
  for (let i = 0; i < 24; i++) {
    if (!g.traficDestination(c)) continue;
    const [a, b] = c.ia.route;
    assert(b[1] <= a[1] + .1, 'northbound truck asked to turn south from its current lane');
  }
});
test('Traffic shortens anticipation only on curves and keeps mission steering unchanged', () => {
  const c = { x: 0, z: 4, h: 0, speed: 8, spd: 8.5 };
  const corner = [[0, 0], [0, 10], [10, 10]], straight = [[0, 0], [0, 10], [0, 50]];
  fixture({ aiCars: [c] }, () => {
    const curved = g.traceSuit(c, corner, { i: 0 });
    assert(curved.vx < .1 && curved.vz < 10, 'traffic cuts the inside corner');
    const forward = g.traceSuit(c, straight, { i: 0 });
    assert(Math.abs(forward.vz - 15.8) < 1e-8, 'straight-line anticipation changed');
  });
  const mission = g.traceSuit(c, corner, { i: 0 });
  assert(mission.vx > 5 && mission.vz === 10, 'mission pilot anticipation changed');
});
const oldPlayer = g.P.pos.clone();
g.P.pos.set(1000, 0, 1000);
test('All vehicle lengths keep their front bumper behind a red light', () => {
  g.setTrafficTime(0);
  for (const length of [1.8, 2.4, 4.4, 6, 8.6]) {
    const c = { x: 500, z: 500, h: 0, baseD: length, speed: 0 };
    fixture({ trafficLights: [{ x: 500, z: 510, sens: 0, groupe: 'B', ligne: { x: 500, z: 500 + length / 2 + .4 } }], panneaux: [], passages: [], graphe: { carrefours: [] } }, () => {
      const rule = g.codeRoute(c, 1 / 60);
      assert.equal(rule.raison, 'feu'); assert.equal(rule.v, 0, `length ${length}`);
    });
  }
});
test('Long vehicles complete a stop while their bumper stays behind the line', () => {
  g.setTrafficTime(0);
  const c = { x: 500, z: 500, h: 0, baseD: 8.6, speed: 0 };
  const stop = { type: 'stop', x: 500, z: 504.7, sens: 0 };
  fixture({ trafficLights: [], panneaux: [stop], passages: [], graphe: { carrefours: [] } }, () => {
    assert.equal(g.codeRoute(c, .6).v, 0);
    g.codeRoute(c, .7);
    assert.equal(c.stopOK, stop);
  });
});
test('Truck sees a pedestrian in front of its bumper even outside a road', () => {
  const c = { x: 500, z: 500, h: 0, baseD: 8.6, baseW: 2.6, speed: 0 };
  g.P.pos.set(500, 0, 504.6); assert(g.pietonDevant(c)); g.P.pos.set(1000, 0, 1000);
});
test('Acceleration converges equally at 30, 60 and 120 simulation steps per second', () => {
  const speeds = [];
  fixture({ trafficLights: [], panneaux: [], passages: [], graphe: { carrefours: [], aretes: [] } }, () => {
    for (const hz of [30, 60, 120]) {
      const x = 500 + hz * 10, c = g.makeCar(0x425060, x, 500, 0);
      c.ia = { route: [[x, 500], [x, 650]], i: 0 }; c.vmaxIA = 9;
      for (let i = 0; i < hz; i++) { g.setTrafficTime(100 + i / hz); g.traficRoule(c, 1 / hz, { pilote: true }); }
      speeds.push(c.speed);
    }
  });
  assert(Math.max(...speeds) - Math.min(...speeds) < 1e-8, JSON.stringify(speeds));
});
test('Repositioned traffic clears every stale blocking and manoeuvre state', () => {
  const c = g.city.aiCars[0];
  c.attenteT = 50; c.feuT = 80; c.fileT = 12; c.recule = true; c.double = true;
  c.degageFin = 99; c.dTour = { reste: 8 }; c.voieSir = {};
  assert(g.traficPose(c));
  assert.equal(c.attenteT, 0); assert.equal(c.feuT, 0); assert.equal(c.fileT, 0);
  assert.equal(c.dTour, null); assert.equal(c.voieSir, null); assert.equal(c.recule, false); assert.equal(c.double, false);
});
test('One minute of real street traffic moves every car and truck without non-finite state', () => {
  for (const b of g.bots) if (b.av) b.av.group.visible = false;
  const fleet = g.city.aiCars.filter(c => c.spd);
  const measures = fleet.map(c => ({ kind: c.kind || 'car', distance: 0, teleports: 0, offRoad: 0 }));
  const dt = 1 / 30;
  const frames = 1800;
  for (let frame = 1; frame <= frames; frame++) {
    g.setTrafficTime(frame * dt);
    for (let j = 0; j < fleet.length; j++) {
      const c = fleet[j], x = c.x, z = c.z;
      if (!c.ia) g.traficDestination(c);
      c.vmaxIA = c.kind === 'truck' ? 6 : 9;
      if (c.ia) g.traficRoule(c, dt);
      const d = Math.hypot(c.x - x, c.z - z);
      if (d > 4) measures[j].teleports++; else measures[j].distance += d;
      if (!g.surLaChaussee(c.x, c.z)) measures[j].offRoad++;
      c.reel = d; c.reelT = frame * dt;
      assert(Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.h) && Number.isFinite(c.speed));
    }
    g.separerVehicules();
  }
  console.log('TRAFFIC_METRICS ' + JSON.stringify(measures.map((m, i) => ({ ...m, distance: Math.round(m.distance), offRoad: +(m.offRoad / frames * 100).toFixed(1), x: fleet[i].x, z: fleet[i].z, reason: fleet[i].raison }))));
  for (let i = 0; i < measures.length; i++) if (measures[i].distance < 30) console.log('BLOCKED_TRACE ' + JSON.stringify({ vehicle: i, trace: fleet[i].trace, ia: fleet[i].ia, figeT: fleet[i].figeT, attenteT: fleet[i].attenteT }));
  for (const m of measures) {
    assert(m.distance > 30, `${m.kind} travelled only ${m.distance.toFixed(1)} m`);
    assert.equal(m.teleports, 0, `${m.kind} was repositioned during the simulation`);
    assert.equal(m.offRoad, 0, `${m.kind} cut a corner outside the road envelope`);
  }
});
g.P.pos.copy(oldPlayer);
Math.random = random;
console.log(`${results.filter(r => r.ok).length}/${results.length} traffic tests passed`);
if (results.some(r => !r.ok)) process.exitCode = 1;
