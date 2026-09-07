'use strict';
// Audit d'agencement de la ville entière : chevauchements, accessibilité à pied
// et en voiture, objets flottants ou enterrés, cohérence des zones.
const { run } = require('./run.js');
const G = run();
G.loadWorld(4);
const S = G.solids, city = G.city;

const B = o => ({ x0: o.x - Math.max(o.w,0.36)/2, x1: o.x + Math.max(o.w,0.36)/2,
                  z0: o.z - Math.max(o.d,0.36)/2, z1: o.z + Math.max(o.d,0.36)/2,
                  y0: o.y - o.h/2, y1: o.y + o.h/2, o });
const boxes = S.map(B);
const ovl = (a, b, k) => Math.min(a[k+'1'], b[k+'1']) - Math.max(a[k+'0'], b[k+'0']);
const zoneOf = (x, z) => { const zz = city.zones.find(q => x > q.x1 && x < q.x2 && z > q.z1 && z < q.z2); return zz ? zz.name : '—'; };

console.log(`# AUDIT D'AGENCEMENT — ${S.length} solides, ${city.zones.length} zones\n`);

// ---------- 1. accessibilité piéton depuis le spawn ----------
const CS = 1.0, MINX = -140, MAXX = 140, MINZ = -140, MAXZ = 220;
const nx = Math.round((MAXX-MINX)/CS), nz = Math.round((MAXZ-MINZ)/CS);
const gi = x => Math.round((x-MINX)/CS), gj = z => Math.round((z-MINZ)/CS);
// un mur bloque le piéton s'il dépasse 1,3 m du sol (au-dessus il passe dessous, en dessous il monte dessus)
const mk = (hwPad, minTop) => {
  const g = new Uint8Array(nx*nz);
  for (const b of boxes) {
    if (b.y1 < minTop || b.y0 > 2.6) continue;
    if (b.o.material && b.o.material.visible === false && b.o.bounce) continue;
    for (let i = Math.max(0,gi(b.x0-hwPad)); i <= Math.min(nx-1,gi(b.x1+hwPad)); i++)
      for (let j = Math.max(0,gj(b.z0-hwPad)); j <= Math.min(nz-1,gj(b.z1+hwPad)); j++) g[j*nx+i] = 1;
  }
  return g;
};
const flood = (g, sx, sz) => {
  const seen = new Uint8Array(nx*nz); const si = gi(sx), sj = gj(sz);
  if (g[sj*nx+si]) return null;
  const q = [si + sj*nx]; seen[si+sj*nx] = 1;
  while (q.length) { const c = q.pop(), i = c % nx, j = (c - i) / nx;
    for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const a = i+di, b2 = j+dj;
      if (a<0||b2<0||a>=nx||b2>=nz) continue; const k = b2*nx+a;
      if (seen[k]||g[k]) continue; seen[k] = 1; q.push(k); } }
  return seen;
};
const at = (seen, x, z) => { const i = gi(x), j = gj(z); return (seen && i>=0&&j>=0&&i<nx&&j<nz) ? seen[j*nx+i] : 0; };

const ped = flood(mk(0.4, 0.9), 0, 3);
const pedJump = flood(mk(0.4, 2.2), 0, 3);   // en sautant : franchit tout ce qui fait moins de 2,2 m
console.log('## 1. Zones atteignables à pied depuis le spawn (0, 3)');
let unreachable = 0;
for (const q of city.zones) {
  const cx = (q.x1+q.x2)/2, cz = (q.z1+q.z2)/2;
  if (!at(ped, cx, cz)) {
    // essayer quelques points dans la zone avant de conclure
    let ok = false;
    for (let a = 0.2; a <= 0.8 && !ok; a += 0.3) for (let b = 0.2; b <= 0.8 && !ok; b += 0.3)
      if (at(ped, q.x1+(q.x2-q.x1)*a, q.z1+(q.z2-q.z1)*b)) ok = true;
    if (!ok) { let jok = false;
      for (let a=0.2;a<=0.8&&!jok;a+=0.3) for (let b=0.2;b<=0.8&&!jok;b+=0.3) if (at(pedJump, q.x1+(q.x2-q.x1)*a, q.z1+(q.z2-q.z1)*b)) jok = true;
      console.log(`   INATTEIGNABLE  ${q.emoji} ${q.name}  centre (${cx.toFixed(0)}, ${cz.toFixed(0)})${jok?'   (atteignable seulement en sautant un obstacle)':'   (même en sautant)'}`); unreachable++; }
  }
}
console.log(`   -> ${unreachable} zone(s) inatteignable(s) sur ${city.zones.length}\n`);

// ---------- 2. accès voiture ----------
const carGrid = (() => { const g = new Uint8Array(nx*nz);
  for (const b of boxes) { if (b.y1 < 0.75 || b.y0 > 2.6) continue;
    for (let i = Math.max(0,gi(b.x0-1.1)); i <= Math.min(nx-1,gi(b.x1+1.1)); i++)
      for (let j = Math.max(0,gj(b.z0-1.1)); j <= Math.min(nz-1,gj(b.z1+1.1)); j++) g[j*nx+i] = 1; }
  return g; })();
// on démarre sur la route en anneau, à l'écart des véhicules garés au point (26,0)
let carSeen = null, carStart = null;
for (const p of [[26,-14],[26,14],[-26,0],[0,26],[0,-26],[26,0]]) { const f = flood(carGrid, p[0], p[1]); if (f) { carSeen = f; carStart = p; break; } }
console.log(`## 2. Accès voiture (largeur 2,2 m) depuis la route en anneau (${carStart})`);
const V = city.villa;
const carProbes = [
  ['garage de ma villa (intérieur)', V.x-12, V.z+11],
  ['devant la porte du garage', V.x-12, V.z+18.5],
  ['allée de ma villa', V.x-12, V.z+16],
  ['parking hôpital', city.meter ? city.meter.x : 0, city.meter ? city.meter.z : 0],
  ['héliport', 52, -13],
  ['commissariat', -54, 28],
];
for (const [n, x, z] of carProbes) if (x || z) console.log(`   ${at(carSeen,x,z)?'OK    ':'BLOQUÉ'}  ${n}  (${x.toFixed(0)}, ${z.toFixed(0)})`);

// ---------- 3. chevauchements de solides ----------
console.log('\n## 3. Solides qui se chevauchent nettement (hors joints de murs)');
const cell = new Map();
const GS = 8, key = (i,j) => i+','+j;
boxes.forEach(b => { for (let i = Math.floor(b.x0/GS); i <= Math.floor(b.x1/GS); i++)
  for (let j = Math.floor(b.z0/GS); j <= Math.floor(b.z1/GS); j++) { const k = key(i,j); if(!cell.has(k)) cell.set(k,[]); cell.get(k).push(b); } });
const seenPair = new Set(); const hits = [];
for (const list of cell.values()) for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
  const a = list[i], b = list[j]; if (a === b) continue;
  const pk = Math.min(a.o.mesh.id,b.o.mesh.id)+':'+Math.max(a.o.mesh.id,b.o.mesh.id);
  if (seenPair.has(pk)) continue; seenPair.add(pk);
  const ox = ovl(a,b,'x'), oz = ovl(a,b,'z'), oy = Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
  if (ox <= 0.5 || oz <= 0.5 || oy <= 0.5) continue;
  // un joint de mur = deux murs fins qui se croisent en angle : les deux petits côtés sont petits
  const thinA = Math.min(a.o.w,a.o.d) < 0.7, thinB = Math.min(b.o.w,b.o.d) < 0.7;
  if (thinA && thinB && ox < 1.2 && oz < 1.2) continue;
  const vol = ox*oy*oz;
  hits.push({ vol, ox, oy, oz, a, b });
}
hits.sort((p,q) => q.vol - p.vol);
for (const h of hits.slice(0, 30))
  console.log(`   ${h.vol.toFixed(0).padStart(4)} m³  [${zoneOf(h.a.o.x,h.a.o.z)}]  ${h.a.o.w}x${h.a.o.h}x${h.a.o.d} @(${h.a.o.x.toFixed(1)},${h.a.o.y.toFixed(1)},${h.a.o.z.toFixed(1)})  ∩  ${h.b.o.w}x${h.b.o.h}x${h.b.o.d} @(${h.b.o.x.toFixed(1)},${h.b.o.y.toFixed(1)},${h.b.o.z.toFixed(1)})  = ${h.ox.toFixed(1)}x${h.oy.toFixed(1)}x${h.oz.toFixed(1)}`);
console.log(`   -> ${hits.length} chevauchement(s) significatif(s)\n`);

// ---------- 4. emplacements de déco ----------
console.log('## 4. Emplacements de décoration bloqués');
for (const d of city.decorSlots) {
  const hit = boxes.find(b => d.x > b.x0 && d.x < b.x1 && d.z > b.z0 && d.z < b.z1 && d.y+0.4 > b.y0 && d.y < b.y1);
  if (hit) console.log(`   « ${d.n} » (${d.x.toFixed(1)}, ${d.y}, ${d.z.toFixed(1)}) dans un solide ${hit.o.w}x${hit.o.h}x${hit.o.d} @(${hit.o.x.toFixed(1)},${hit.o.y.toFixed(1)},${hit.o.z.toFixed(1)})`);
}

// ---------- 5. zones dont les bornes ne collent pas ----------
console.log('\n## 5. Zones qui se chevauchent entre elles');
for (let i=0;i<city.zones.length;i++) for (let j=i+1;j<city.zones.length;j++) {
  const a = city.zones[i], b = city.zones[j];
  const ox = Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1), oz = Math.min(a.z2,b.z2)-Math.max(a.z1,b.z1);
  if (ox > 2 && oz > 2) console.log(`   ${a.emoji} ${a.name}  ∩  ${b.emoji} ${b.name}  = ${ox.toFixed(0)}x${oz.toFixed(0)} m`);
}

// ---------- 6. diagnostic accès voiture ----------
console.log('\n## 6. Diagnostic : étendue des régions accessibles en voiture');
const seenGlobal = new Uint8Array(nx*nz); const regions = [];
for (let j=0;j<nz;j+=3) for (let i=0;i<nx;i+=3) { const k=j*nx+i;
  if (carGrid[k]||seenGlobal[k]) continue;
  const f = flood(carGrid, MINX+i*CS, MINZ+j*CS); if (!f) continue;
  let n=0, minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;
  for (let b=0;b<nz;b++) for (let a=0;a<nx;a++) if (f[b*nx+a]) { n++; seenGlobal[b*nx+a]=1;
    const X=MINX+a*CS, Z=MINZ+b*CS; if(X<minx)minx=X; if(X>maxx)maxx=X; if(Z<minz)minz=Z; if(Z>maxz)maxz=Z; }
  if (n > 60) regions.push({n, minx, maxx, minz, maxz, seed:[MINX+i*CS, MINZ+j*CS]});
}
regions.sort((a,b)=>b.n-a.n);
for (const r of regions.slice(0,8))
  console.log(`   ${String(r.n).padStart(6)} cases  x[${r.minx.toFixed(0)}, ${r.maxx.toFixed(0)}]  z[${r.minz.toFixed(0)}, ${r.maxz.toFixed(0)}]   graine (${r.seed[0]},${r.seed[1]})`);
console.log(`   -> ${regions.length} régions séparées : le réseau routier n'est PAS connexe pour une voiture`);

// ---------- 7. objets décoratifs plantés dans un bâtiment ----------
console.log('\n## 7. Arbres / palmiers / lampadaires dans un bâtiment');
const posts = boxes.filter(b => b.o.w <= 0.8 && b.o.d <= 0.8 && b.o.h > 3);
const bldg = boxes.filter(b => (b.x1-b.x0) > 3 && (b.z1-b.z0) > 3 && b.y1 > 2);
let np = 0;
for (const p2 of posts) for (const b of bldg)
  if (p2.o.x > b.x0 && p2.o.x < b.x1 && p2.o.z > b.z0 && p2.o.z < b.z1) { np++;
    if (np <= 10) console.log(`   poteau ${p2.o.w}x${p2.o.h} @(${p2.o.x.toFixed(1)},${p2.o.z.toFixed(1)}) dans ${b.o.w}x${b.o.d} @(${b.o.x.toFixed(1)},${b.o.z.toFixed(1)})  [${zoneOf(p2.o.x,p2.o.z)}]`); }
console.log(`   -> ${np}`);

