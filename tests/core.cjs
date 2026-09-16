'use strict';
const assert=require('node:assert/strict'),M=require('../src/core.js');let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const close=(a,b,eps=1e-7)=>assert(Math.abs(a-b)<eps,`${a} ≠ ${b}`);
test('Bruit des sticks supprimé, amplitude radiale bornée',()=>{assert.deepEqual(M.stick(.08,-.1),{x:0,y:0});for(let i=0;i<360;i++){const a=i*Math.PI/180,s=M.stick(Math.cos(a),Math.sin(a));close(Math.hypot(s.x,s.y),1);}assert.deepEqual(M.stick(NaN,Infinity),{x:0,y:0});});
test('Avant et droite cohérents aux quatre orientations caméra',()=>{for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const f=M.moveVector(0,1,yaw),r=M.moveVector(1,0,yaw);close(f.x,Math.sin(yaw));close(f.z,-Math.cos(yaw));close(f.x*r.x+f.z*r.z,0);}});
test('Pas de vitesse supplémentaire en diagonale',()=>{close(Math.hypot(...Object.values(M.moveVector(1,1,.3))),1);close(Math.hypot(...Object.values(M.moveVector(.2,.3,.3))),Math.hypot(.2,.3));});
test('Le déplacement ne modifie pas le lacet de caméra',()=>{let yaw=.8;for(let i=0;i<200;i++)M.moveVector(.8,1,yaw);close(yaw,.8);});
test('Collision à grande vitesse : aucun franchissement du mur',()=>{const grid=new M.Grid;grid.add({minx:2,maxx:3,minz:-20,maxz:20,miny:0,maxy:6});const p={x:0,z:0};assert(grid.move(p,25,0,.4));assert(p.x<1.61);});
test('Glissement le long des murs',()=>{const grid=new M.Grid;grid.add({minx:2,maxx:3,minz:-20,maxz:20,miny:0,maxy:6});const p={x:1.5,z:0};grid.move(p,2,5,.4);assert(p.x<1.61);close(p.z,5);});
test('Rayon caméra : intersection, tangence et obstacle derrière',()=>{const b={minx:-2,maxx:2,miny:0,maxy:8,minz:3,maxz:4};close(M.rayBox({x:0,y:1,z:0},{x:0,y:0,z:1},b),3);assert.equal(M.rayBox({x:0,y:1,z:0},{x:0,y:0,z:-1},b),Infinity);close(M.rayBox({x:0,y:1,z:0},{x:0,y:0,z:1},b,10,.25),2.75);});
test('La conduite reste stable à 30, 60 et 120 Hz',()=>{let results=[];for(const hz of [30,60,120]){const c={speed:0,yaw:0,steer:0};for(let i=0;i<hz*4;i++)M.drive(c,{gas:1,brake:0,steer:.3,handbrake:false},1/hz);results.push(c.speed);assert(Number.isFinite(c.yaw));}assert(Math.max(...results)-Math.min(...results)<.2);});
test('L2 freine avant la marche arrière',()=>{const c={speed:20,yaw:0};M.drive(c,{gas:0,brake:1,steer:0},1/60);assert(c.speed<20&&c.speed>0);for(let i=0;i<240;i++)M.drive(c,{gas:0,brake:1,steer:0},1/60);assert(c.speed<0&&c.speed>=-9);});
test('Relâchement des gâchettes : véhicule ralentit',()=>{const c={speed:12,yaw:0};for(let i=0;i<180;i++)M.drive(c,{gas:0,brake:0,steer:0},1/60);assert(c.speed<3);});
test('Conquête limitée aux frontières horizontales et verticales',()=>{const t=M.territories();assert(M.canAttack(t,t[4]));assert(M.canAttack(t,t[9]));assert(!M.canAttack(t,t[5]));assert(!M.canAttack(t,t[0]));assert(!M.canAttack(t,t[8]));t[9].owner='player';assert(M.canAttack(t,t[10]));});
test('Sauvegarde : zéro monétaire et progression conservés',()=>{const s=M.newSave();s.cash=0;s.owned=[8,9];s.levels={9:2};s.completed=['capture'];assert.deepEqual(M.parseSave(JSON.stringify(s)),s);});
test('Sauvegarde corrompue et ancienne version rejetées',()=>{assert.equal(M.parseSave('{bad'),null);assert.equal(M.parseSave('{"version":1}'),null);const s=M.parseSave(JSON.stringify({...M.newSave(),cash:-2,x:1e12,mag:99,owned:[8,44,-1,'1'],levels:{8:999},completed:['invalid']}));assert.equal(s.cash,0);assert.equal(s.x,309);assert.equal(s.mag,24);assert.deepEqual(s.owned,[8]);assert.deepEqual(s.levels,{});assert.deepEqual(s.completed,[]);});
console.log(`${count} tests réussis.`);
