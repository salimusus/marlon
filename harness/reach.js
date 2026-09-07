'use strict';
const { run } = require('./run.js');
const G = run(); G.loadWorld(4);
const city = G.city;
const doors = new Set(); for (const d of [city.gate, city.garageDoor, ...city.autoDoors]) if (d && d.solid) doors.add(d.solid);
const CS=0.25, MINX=-150, MINZ=-150, nx=1360, nz=1760;
const gi=x=>Math.round((x-MINX)/CS), gj=z=>Math.round((z-MINZ)/CS);
const g=new Uint8Array(nx*nz);
for (const o of G.solids) { if (doors.has(o)) continue;
  const b={x0:o.x-Math.max(o.w,0.36)/2,x1:o.x+Math.max(o.w,0.36)/2,z0:o.z-Math.max(o.d,0.36)/2,z1:o.z+Math.max(o.d,0.36)/2};
  if (o.y+o.h/2 < 0.95 || o.y-o.h/2 > 2.6) continue;
  for(let i=Math.max(0,gi(b.x0-0.35));i<=Math.min(nx-1,gi(b.x1+0.35));i++) for(let j=Math.max(0,gj(b.z0-0.35));j<=Math.min(nz-1,gj(b.z1+0.35));j++) g[j*nx+i]=1; }
const seen=new Uint8Array(nx*nz); const si=gi(0),sj=gj(3); const q=[sj*nx+si]; seen[sj*nx+si]=1;
while(q.length){const c=q.pop(),i=c%nx,j=(c-i)/nx;for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b2=j+dj;if(a<0||b2<0||a>=nx||b2>=nz)continue;const k=b2*nx+a;if(seen[k]||g[k])continue;seen[k]=1;q.push(k);}}
const at=(x,z)=>{const i=gi(x),j=gj(z);return i>=0&&j>=0&&i<nx&&j<nz?(g[j*nx+i]?'DANS UN MUR':(seen[j*nx+i]?'atteignable':'ISOLÉ')):'hors grille';};
for (const [n,x,z] of [['devant l\'armurerie',52,12],['seuil de l\'armurerie',52,14.6],['intérieur armurerie',52,20],
  ['comptoir armurerie',52,21.5],['est de la ville',45,5],['héliport',52,-13],['plage',113,45],['banque',-52,70],
  ['école',-62,212],['hôpital',12,212],['ma villa (jardin)',60,180],['piscine publique',-51,-15],
  ['Villa Azur (jardin)',108,180],['Villa Palmier (jardin)',156,180],['Villa Corail (jardin)',108,234],['Villa Émeraude (jardin)',156,234],
  ['parking hôpital',24,219],['commissariat',-54,28]])
  console.log(`  ${at(x,z).padEnd(12)}  ${n}  (${x}, ${z})`);
