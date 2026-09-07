'use strict';
const { run } = require('./run.js');
const G = run();
console.log('=== construction du monde ville ===');
try { G.loadWorld(4); } catch (e) { console.error('ECHEC loadWorld(4):', e.stack); process.exit(2); }
const S = G.solids, city = G.city;
console.log(`solides: ${S.length}  kills: ${G.kills.length}  pièces: ${G.coins.length}  route bots: ${G.route.length}`);
console.log(`villa: ${JSON.stringify(city.villa)}   garage(porte): ${city.garageDoor ? `${city.garageDoor.x.toFixed(1)},${city.garageDoor.z.toFixed(1)}` : 'aucun'}   portail: ${city.gate ? `${city.gate.x.toFixed(1)},${city.gate.z.toFixed(1)}` : 'aucun'}`);
console.log(`zones: ${city.zones.length}  bancs: ${city.benches.length}  emplacements déco: ${city.decorSlots.length}`);

// --- accessibilité voiture : grille de flood-fill sur les solides ---
const V = city.villa || { x: 0, z: 0 };
const box = o => ({ x0: o.x - o.w / 2, x1: o.x + o.w / 2, z0: o.z - o.d / 2, z1: o.z + o.d / 2, y0: o.y - o.h / 2, y1: o.y + o.h / 2, o });
const near = S.filter(o => Math.abs(o.x - V.x) < 60 && Math.abs(o.z - V.z) < 60).map(box);
// un obstacle bloque une voiture s'il dépasse du sol de plus de 0.6 m et commence sous 3 m
const blocks = b => b.y1 > 0.7 && b.y0 < 2.6;
const walls = near.filter(blocks);

const CS = 0.5, R = 60;
const nx = Math.round(2 * R / CS), nz = nx;
const gx = i => V.x - R + i * CS, gz = j => V.z - R + j * CS;
const CAR_HW = 1.1;   // demi-largeur d'une voiture
const grid = new Uint8Array(nx * nz);
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const x = gx(i), z = gz(j);
  for (const b of walls) if (x > b.x0 - CAR_HW && x < b.x1 + CAR_HW && z > b.z0 - CAR_HW && z < b.z1 + CAR_HW) { grid[j * nx + i] = 1; break; }
}
// départ : la rue au sud de la parcelle
const flood = (sx, sz) => {
  const seen = new Uint8Array(nx * nz), q = [];
  const si = Math.round((sx - V.x + R) / CS), sj = Math.round((sz - V.z + R) / CS);
  if (grid[sj * nx + si]) return { seen, ok: false, note: 'départ bloqué' };
  q.push([si, sj]); seen[sj * nx + si] = 1;
  while (q.length) { const [i, j] = q.pop();
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      if (seen[b * nx + a] || grid[b * nx + a]) continue;
      seen[b * nx + a] = 1; q.push([a, b]); } }
  return { seen, ok: true };
};
const street = flood(V.x, V.z + 26);
const inside = (seen, x, z) => { const i = Math.round((x - V.x + R) / CS), j = Math.round((z - V.z + R) / CS);
  return (i >= 0 && j >= 0 && i < nx && j < nz) ? seen[j * nx + i] : 0; };

console.log('\n=== ACCÈS VOITURE DEPUIS LA RUE (flood fill, voiture large de 2,2 m) ===');
if (!street.ok) console.log('  !! le point de départ dans la rue est lui-même bloqué');
const probes = [
  ['intérieur du garage', V.x - 12, V.z + 11],
  ['devant la porte du garage', V.x - 12, V.z + 18.6],
  ['allée (devant le portail)', V.x + 0.5, V.z + 16],
  ['tablier du garage', V.x - 12, V.z + 23],
  ['devant le perron', V.x + 6, V.z + 6],
];
for (const [n, x, z] of probes) console.log(`  ${inside(street.seen, x, z) ? 'OK ' : 'BLOQUÉ'}  ${n}  (${x.toFixed(1)}, ${z.toFixed(1)})`);

// --- chevauchement de solides à l'intérieur de la parcelle ---
console.log('\n=== SOLIDES QUI SE CHEVAUCHENT DANS LA PARCELLE DE LA VILLA ===');
const plot = near.filter(b => b.x0 > V.x - 23 && b.x1 < V.x + 23 && b.z0 > V.z - 21 && b.z1 < V.z + 21 && blocks(b));
let n = 0;
const ov = (a, b, k) => Math.min(a[k + '1'], b[k + '1']) - Math.max(a[k + '0'], b[k + '0']);
for (let i = 0; i < plot.length; i++) for (let j = i + 1; j < plot.length; j++) {
  const a = plot[i], b = plot[j];
  const ox = ov(a, b, 'x'), oz = ov(a, b, 'z'), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (ox > 0.35 && oz > 0.35 && oy > 0.35 && n < 25) {
    n++;
    console.log(`  ${(a.o.w+'x'+a.o.d).padEnd(12)} @(${a.o.x.toFixed(1)},${a.o.y.toFixed(1)},${a.o.z.toFixed(1)})  <->  ${(b.o.w+'x'+b.o.d).padEnd(12)} @(${b.o.x.toFixed(1)},${b.o.y.toFixed(1)},${b.o.z.toFixed(1)})   recouvrement ${ox.toFixed(1)}x${oy.toFixed(1)}x${oz.toFixed(1)} m`);
  }
}
console.log(`  total: ${n}${n >= 25 ? '+ (tronqué)' : ''}`);

// --- emplacements de déco dans un solide ? ---
console.log('\n=== EMPLACEMENTS DE DÉCO À L\'INTÉRIEUR D\'UN SOLIDE ===');
for (const d of city.decorSlots) {
  const hit = near.find(b => d.x > b.x0 && d.x < b.x1 && d.z > b.z0 && d.z < b.z1 && d.y + 0.5 > b.y0 && d.y < b.y1);
  if (hit) console.log(`  « ${d.n} » (${d.x.toFixed(1)}, ${d.y}, ${d.z.toFixed(1)}) est dans un solide ${hit.o.w}x${hit.o.h}x${hit.o.d} @(${hit.o.x.toFixed(1)},${hit.o.y.toFixed(1)},${hit.o.z.toFixed(1)})`);
}
