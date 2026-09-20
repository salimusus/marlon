'use strict';
const assert=require('node:assert/strict'),{run}=require('./run'),g=run();
g.loadWorld(4);g.running=true;g.paused=false;g.gang.rep=0;
const results=[];
function test(name,fn){try{fn();results.push({name,ok:true});console.log('PASS '+name)}catch(e){results.push({name,ok:false});console.error('FAIL '+name+': '+e.stack)}}
test('No land earns no passive income',()=>{g.guerre.territoires={};assert.equal(g.empireEconomy().income,0)});
test('Separated districts earn half until their connecting border is restored',()=>{
 g.guerre.territoires={zone:'joueur',centre:'joueur',commerces:'joueur'};
 let e=g.empireEconomy();assert.equal(e.supply.size,2);assert.equal(e.isolated,1);assert.equal(e.income,36);
 g.guerre.territoires.banque='joueur';e=g.empireEconomy();assert.equal(e.supply.size,4);assert.equal(e.isolated,0);assert.equal(e.income,75);
});
test('Industrial discount is earned only by a supplied industry',()=>{
 g.guerre.territoires={zone:'joueur',banque:'joueur',industriel:'joueur'};g.empire.defenses={};assert.equal(g.empireFortifyCost('zone'),80);
 g.guerre.territoires.centre='joueur';assert.equal(g.empireFortifyCost('zone'),64);
 g.wallet=300;assert(g.empireFortify('zone'));assert.equal(g.wallet,236);assert.equal(g.empireFortifyCost('zone'),128);
});
test('Losing a connecting district changes the income forecast immediately',()=>{
 g.guerre.territoires={zone:'joueur',banque:'joueur',centre:'joueur',commerces:'joueur'};const before=g.empireEconomy().income;
 delete g.guerre.territoires.banque;assert(g.empireEconomy().income<before);assert.equal(g.empireEconomy().isolated,1);
});
test('Entire city forms one network and earns the announced bank bonus',()=>{
 g.guerre.territoires=Object.fromEntries(g.TERRITOIRES.map(t=>[t.k,'joueur']));const e=g.empireEconomy();
 assert.equal(e.supply.size,8);assert.equal(e.isolated,0);assert.equal(e.income,Math.floor(g.TERRITOIRES.reduce((sum,t)=>sum+t.v,0)*6*1.25));
});
test('A social invitation cannot steal or clear an operation GPS destination',()=>{
 g.empire.operation=null;g.mission.cur=null;assert(g.empireStartOperation('recon'));
 const target=g.EMPIRE_OPERATIONS.find(o=>o.id==='recon').route[0],t=g.TERRITOIRES.find(t=>t.k===target);
 assert.equal(g.beacon.x,t.x);g.setBeacon(0,0);g.clearBeacon();assert.equal(g.beacon.x,t.x);assert(g.beacon.m.visible);
 g.empireEndOperation(false);assert(!g.beacon.m.visible);g.setBeacon(3,4);assert.equal(g.beacon.x,3);
});
test('Territory operations do not replace an active city mission',()=>{
 g.mission.cur={id:'test'};assert.equal(g.empireStartOperation('recon'),false);assert.equal(g.empire.operation,null);g.mission.cur=null;
});
console.log(JSON.stringify({passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length}));process.exitCode=results.some(x=>!x.ok)?1:0;
