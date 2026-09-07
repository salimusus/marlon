'use strict';
// Test décisif : on ouvre TOUTES les portes ouvrables (portail, porte de garage),
// puis on vérifie si une voiture peut rejoindre le garage depuis la rue.
const { run } = require('./run.js');
const G = run(); G.loadWorld(4);
const city = G.city, V = city.villa;

// solides des portes ouvrables, à retirer du test
const doorSolids = new Set();
for (const d of [city.gate, city.garageDoor, ...city.autoDoors]) if (d && d.solid) doorSolids.add(d.solid);
console.log(`portes ouvrables retirées du test : ${doorSolids.size}`);

const S = G.solids.filter(o => !doorSolids.has(o));
const B = o => ({ x0:o.x-Math.max(o.w,0.36)/2, x1:o.x+Math.max(o.w,0.36)/2, z0:o.z-Math.max(o.d,0.36)/2, z1:o.z+Math.max(o.d,0.36)/2, y0:o.y-o.h/2, y1:o.y+o.h/2, o });
const boxes = S.map(B).filter(b => b.y1 > 0.75 && b.y0 < 2.6);

const CS=0.5, MINX=V.x-60, MINZ=V.z-60, nx=240, nz=240;
const gi=x=>Math.round((x-MINX)/CS), gj=z=>Math.round((z-MINZ)/CS);
const g=new Uint8Array(nx*nz);
const PAD=1.1;  // demi-largeur voiture
for (const b of boxes) for (let i=Math.max(0,gi(b.x0-PAD)); i<=Math.min(nx-1,gi(b.x1+PAD)); i++)
  for (let j=Math.max(0,gj(b.z0-PAD)); j<=Math.min(nz-1,gj(b.z1+PAD)); j++) g[j*nx+i]=1;
const flood=(sx,sz)=>{const seen=new Uint8Array(nx*nz);const si=gi(sx),sj=gj(sz);if(si<0||sj<0||si>=nx||sj>=nz||g[sj*nx+si])return null;
  const q=[sj*nx+si];seen[sj*nx+si]=1;while(q.length){const c=q.pop(),i=c%nx,j=(c-i)/nx;
  for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b2=j+dj;if(a<0||b2<0||a>=nx||b2>=nz)continue;const k=b2*nx+a;
  if(seen[k]||g[k])continue;seen[k]=1;q.push(k);}}return seen;};
const at=(s,x,z)=>{const i=gi(x),j=gj(z);return s&&i>=0&&j>=0&&i<nx&&j<nz?s[j*nx+i]:0;};

const street = flood(V.x, V.z+28);
console.log(`\ndépart dans la rue (${V.x}, ${V.z+28}) : ${street?'libre':'BLOQUÉ'}`);
const probes=[['portail voitures (devant le garage)',V.x-12,V.z+20.2],['allée goudronnée',V.x-12,V.z+17],
  ['portillon piéton',V.x+6,V.z+20.2],['tablier sur la chaussée',V.x-12,V.z+23],
  ['porte du garage',V.x-12,V.z+17.5],['intérieur du garage',V.x-12,V.z+11],
  ['devant le perron',V.x+6,V.z+6],['terrasse de la piscine',V.x+13.6,V.z+17]];
console.log('\nAvec TOUTES les portes ouvertes, depuis la rue :');
for(const[n,x,z]of probes) console.log(`  ${at(street,x,z)?'ACCESSIBLE':'INACCESSIBLE'.padEnd(10)}  ${n}`);

console.log('\nCe qui barre la route entre le tablier et la porte du garage :');
for (const b of boxes) if (b.x0 < V.x-5 && b.x1 > V.x-19 && b.z0 > V.z+18 && b.z1 < V.z+22)
  console.log(`  solide ${b.o.w}x${b.o.h}x${b.o.d} @(${b.o.x.toFixed(1)},${b.o.y.toFixed(1)},${b.o.z.toFixed(1)})  ->  x[${b.x0.toFixed(1)}, ${b.x1.toFixed(1)}]  z[${b.z0.toFixed(1)}, ${b.z1.toFixed(1)}]`);
