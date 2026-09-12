'use strict';
const assert = require('node:assert/strict');
const {run} = require('./run');
const g = run();
const cases = [];
function test(name, fn) { try { fn(); cases.push({name,ok:true}); console.log('PASS '+name); } catch(e) { cases.push({name,ok:false,error:e.message}); console.error('FAIL '+name+': '+e.stack); } }
g.loadWorld(4); g.running=true; g.paused=false;
test('Map area grows 58 percent and all 12 sectors lie inside the boundary',()=>{
 assert.equal(g.MONDE.w*g.MONDE.d,365000); assert.equal(g.TERRITOIRES.length,12);
 for(const t of g.TERRITOIRES) assert(t.x-t.r>=g.MONDE.x1 && t.x+t.r<=g.MONDE.x2 && t.z-t.r>=g.MONDE.z1 && t.z+t.r<=g.MONDE.z2);
});
test('Supply graph is connected and every edge is reciprocal',()=>{
 const seen=new Set(), queue=['centre']; while(queue.length){const k=queue.pop();if(seen.has(k))continue;seen.add(k);for(const n of g.EMPIRE_LINKS[k]){assert(g.EMPIRE_LINKS[n].includes(k));queue.push(n)}} assert.equal(seen.size,12);
});
test('Every northern rendezvous has ground and no blocking wall at pedestrian height',()=>{
 for(const t of g.TERRITOIRES.slice(0,4)){
  assert(g.groundUnder(t.x,t.z,null,1)>=0);
  const blocked=g.solids.some(o=>!o.veh&&!o.deco&&o.y+o.h/2>1&&o.y-o.h/2<1.9&&Math.abs(o.x-t.x)<o.w/2+.4&&Math.abs(o.z-t.z)<o.d/2+.4);
  assert(!blocked,t.k);
 }
});
test('First foothold and adjacent expansion cannot skip directly to the docks',()=>{
 g.guerre.territoires={};assert(g.empireCanExpand('centre','joueur'));assert(!g.empireCanExpand('docks','joueur'));
 g.guerre.territoires={zone:'joueur'};assert(g.empireCanExpand('northwest','joueur'));assert(!g.empireCanExpand('finance','joueur'));
});
test('Fortifications cost money, cap at three, and reject enemy land',()=>{
 g.guerre.territoires={centre:'joueur'};g.wallet=1000;
 assert(g.empireFortify('centre'));assert.equal(g.wallet,920);assert(g.empireFortify('centre'));assert.equal(g.wallet,760);assert(g.empireFortify('centre'));assert.equal(g.wallet,520);
 assert(!g.empireFortify('centre'));assert.equal(g.wallet,520);assert(!g.empireFortify('docks'));
});
test('KO and captive recruits do not count as a defensive force',()=>{
 const t=g.TERRITOIRES.find(t=>t.k==='centre');g.gang.membres=[];
 g.gang.membresLibres=[{x:t.x,z:t.z,ko:true},{x:t.x,z:t.z,captif:true},{x:t.x,z:t.z,hp:0},{x:t.x,z:t.z,hp:80}];assert.equal(g.empireGuardCount(t),1);
});
test('A living recruit can capture an adjacent sector; KO support cannot',()=>{
 const t=g.TERRITOIRES.find(t=>t.k==='centre');g.guerre.territoires={banque:'joueur'};g.gang.capture=null;g.gang.membres=[];
 g.P.pos.set(t.x,1,t.z);g.P.hp=100;g.jail.on=false;g.drive.car=null;
 g.gang.membresLibres=[{x:t.x,z:t.z,hp:100,ko:true}];for(let i=0;i<60;i++)g.captureTick(1);assert.notEqual(g.guerre.territoires.centre,'joueur');
 g.gang.membresLibres[0].ko=false;for(let i=0;i<61;i++)g.captureTick(1);assert.equal(g.guerre.territoires.centre,'joueur');assert.equal(g.gang.capture,null);
});
test('An announced attack resolves using defenses; an undefended sector falls',()=>{
 const rival=g.gangs.find(x=>!x.mort);assert(rival);rival.allieJoueur=false;
 g.gang.membres=[];g.gang.membresLibres=[];g.P.pos.set(190,1,330);g.guerre.territoires={centre:'joueur'};g.empire.defenses.centre=3;
 g.empire.attack={k:'centre',gang:rival.id,strength:3};assert(g.empireResolveAttack());assert.equal(g.guerre.territoires.centre,'joueur');assert.equal(g.empire.defenses.centre,2);
 g.empire.defenses.centre=0;g.empire.attack={k:'centre',gang:rival.id,strength:2};assert(!g.empireResolveAttack());assert.equal(g.guerre.territoires.centre,rival.id);
});
test('Completed operations pay once and repeat rewards are reduced',()=>{
 g.empire.completed=[];g.empire.operation=null;g.wallet=10;
 assert(g.empireStartOperation('recon'));g.empireEndOperation(true);assert.equal(g.wallet,130);g.empireEndOperation(true);assert.equal(g.wallet,130);
 assert(g.empireStartOperation('recon'));g.empireEndOperation(true);assert.equal(g.wallet,178);
});
test('Malformed strategic saves are bounded and valid progress survives a save/load',()=>{
 g.restoreEmpire({defenses:{centre:999,docks:-3},completed:['recon','recon','bogus'],wins:-4});assert.equal(g.empire.defenses.centre,3);assert.equal(g.empire.defenses.docks,0);assert.equal(g.empire.completed.length,1);assert.equal(g.empire.wins,0);
 g.gang.magot=0;g.saveGuerre();g.empire.defenses={};g.empire.completed=[];g.loadGuerre();assert.equal(g.empire.defenses.centre,3);assert.equal(g.empire.completed[0],'recon');assert.equal(g.gang.magot,0);
});
test('DualSense standard and raw HID keep the two triggers independent of the camera',()=>{
 const raw={id:'054c DualSense',mapping:'',buttons:Array.from({length:14},()=>({pressed:false,value:0})),axes:[0,0,0,-1,-1,0,1.28]};
 let p=g.padLu(raw);assert.equal(p.profil,'ps-hid');assert.equal(p.l2,0);assert.equal(p.r2,0);assert.equal(p.ry,0);
 raw.axes[3]=0;raw.axes[4]=1;p=g.padLu(raw);assert.equal(p.l2,.5);assert.equal(p.r2,1);assert.equal(p.ry,0);
 raw.id='Generic joystick';assert.equal(g.padProfil(raw),'brut');
 const std={...raw,id:'DualSense',mapping:'standard',axes:[0,0,.2,-.4],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};std.buttons[7]={pressed:true,value:.8};p=g.padLu(std);assert.equal(p.ry,-.4);assert.equal(p.r2,.8);
});
test('Disconnect clears held movement and combat without a synthetic attack',()=>{
 g.keys.add('Space');g.keys.add('KeyV');g.pad.bas={1:true,2:true};g.pad.gaz=1;g.P.run=true;g.releaseGamepad();assert(!g.keys.has('Space'));assert(!g.keys.has('KeyV'));assert.equal(g.pad.gaz,0);assert.equal(g.P.run,false);
});
test('No gamepad connected does not erase keyboard controls',()=>{
 g.pad.bas=null;g.pad.lu=null;g.pad.l2=false;g.keys.add('Space');g.P.run=true;g.pollGamepad(.016);assert(g.keys.has('Space'));assert.equal(g.P.run,true);g.keys.clear();
});
test('Changing world clears active operations and marker references',()=>{
 g.empire.operation={id:'recon'};g.empire.attack={k:'centre'};g.loadWorld(0);assert.equal(g.empire.operation,null);assert.equal(g.empire.attack,null);assert.equal(g.empire.markers.length,0);
});
test('An empty wallet stays empty on reload',()=>{ require('./stubs').localStorage.setItem('superobby.wallet','0'); const next=run(); assert.equal(next.wallet,0); });
console.log(JSON.stringify({passed:cases.filter(t=>t.ok).length,failed:cases.filter(t=>!t.ok).length}));
process.exitCode=cases.some(t=>!t.ok)?1:0;
