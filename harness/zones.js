'use strict';
const { run } = require('./run.js');
const G = run(); G.loadWorld(4);
const city = G.city;
// on retire les ouvrants pour ne garder que les obstacles permanents
const doors = new Set(); for (const d of [city.gate, city.garageDoor, ...city.autoDoors]) if (d && d.solid) doors.add(d.solid);
const boxes = G.solids.filter(o => !doors.has(o)).map(o => ({ x0:o.x-Math.max(o.w,0.36)/2, x1:o.x+Math.max(o.w,0.36)/2, z0:o.z-Math.max(o.d,0.36)/2, z1:o.z+Math.max(o.d,0.36)/2, y0:o.y-o.h/2, y1:o.y+o.h/2, o }));
const CS=0.25, MINX=-150, MINZ=-150, nx=1360, nz=1760;
const gi=x=>Math.round((x-MINX)/CS), gj=z=>Math.round((z-MINZ)/CS);
const g=new Uint8Array(nx*nz);
for (const b of boxes) { if (b.y1 < 0.95 || b.y0 > 2.6) continue;   // on enjambe tout ce qui fait moins de 0,95 m
  for(let i=Math.max(0,gi(b.x0-0.4));i<=Math.min(nx-1,gi(b.x1+0.4));i++) for(let j=Math.max(0,gj(b.z0-0.4));j<=Math.min(nz-1,gj(b.z1+0.4));j++) g[j*nx+i]=1; }
const seen=new Uint8Array(nx*nz); const si=gi(0),sj=gj(3); const q=[sj*nx+si]; seen[sj*nx+si]=1;
while(q.length){const c=q.pop(),i=c%nx,j=(c-i)/nx;for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b2=j+dj;if(a<0||b2<0||a>=nx||b2>=nz)continue;const k=b2*nx+a;if(seen[k]||g[k])continue;seen[k]=1;q.push(k);}}
const at=(x,z)=>{const i=gi(x),j=gj(z);return i>=0&&j>=0&&i<nx&&j<nz?seen[j*nx+i]:0;};
console.log('Zones inatteignables à pied (portails ouverts, obstacles < 0,95 m enjambés) :');
let bad=0;
for (const q2 of city.zones) { let ok=false;
  for(let a=0.15;a<=0.85&&!ok;a+=0.1) for(let b=0.15;b<=0.85&&!ok;b+=0.1) if(at(q2.x1+(q2.x2-q2.x1)*a, q2.z1+(q2.z2-q2.z1)*b)) ok=true;
  if(!ok){bad++;console.log(`  ${q2.emoji} ${q2.name}  x[${q2.x1}, ${q2.x2}] z[${q2.z1}, ${q2.z2}]`);
    // ce qui entoure le centre
    const cx=(q2.x1+q2.x2)/2, cz=(q2.z1+q2.z2)/2;
    boxes.filter(b=>b.y1>0.95&&b.y0<2.6&&Math.abs(b.o.x-cx)<26&&Math.abs(b.o.z-cz)<26&&(b.x1-b.x0)*(b.z1-b.z0)>12)
      .slice(0,4).forEach(b=>console.log(`       barrière proche : ${b.o.w}x${b.o.h}x${b.o.d} @(${b.o.x.toFixed(1)},${b.o.y.toFixed(1)},${b.o.z.toFixed(1)})`)); } }
console.log(`-> ${bad} / ${city.zones.length}`);
