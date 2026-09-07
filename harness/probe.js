'use strict';
const { run } = require('./run.js');
const G = run(); G.loadWorld(4);
const [x0,x1,z0,z1] = process.argv.slice(2,6).map(Number);
console.log(`solides bloquants dans x[${x0}, ${x1}] z[${z0}, ${z1}] (hauteur > 0,95 m) :`);
for (const o of G.solids) {
  const bx0=o.x-Math.max(o.w,0.36)/2, bx1=o.x+Math.max(o.w,0.36)/2, bz0=o.z-Math.max(o.d,0.36)/2, bz1=o.z+Math.max(o.d,0.36)/2;
  if (bx1<x0||bx0>x1||bz1<z0||bz0>z1) continue;
  if (o.y+o.h/2 < 0.95 || o.y-o.h/2 > 2.6) continue;
  console.log(`  ${String(o.w).padStart(6)}x${String(o.h).padStart(5)}x${String(o.d).padStart(6)} @(${o.x.toFixed(1)}, ${o.y.toFixed(1)}, ${o.z.toFixed(1)})   x[${bx0.toFixed(2)}, ${bx1.toFixed(2)}] z[${bz0.toFixed(2)}, ${bz1.toFixed(2)}]${o.glass?'  [vitre]':''}${o.material&&o.material.visible===false?'  [invisible]':''}`);
}
