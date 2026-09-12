'use strict';
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('node:assert/strict');
const {playwright} = require('./runtime');
const ROOT = path.join(__dirname, '..');
const {HOOK} = require('./shot');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace('\nloop();', '\nloop();\n' + HOOK);
const srv = http.createServer((req,res)=>{
 if(req.url==='/vendor/three.min.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(ROOT,'vendor/three.min.js')));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.setDefaultTimeout(60000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/net::ERR_FAILED|ERR_INTERNET_DISCONNECTED|ERR_ABORTED/.test(m.text()))errors.push(m.text())});
 await p.route('https://**/*',r=>r.abort());
 await p.addInitScript(()=>{localStorage.setItem('superobby.quality','low');localStorage.setItem('superobby.sound','0');localStorage.setItem('superobby.music','0');localStorage.setItem('superobby.voices','0')});
 const out=path.join(ROOT,'verification');fs.mkdirSync(out,{recursive:true});
 const checks=[];
 async function test(name,fn){try{await fn();checks.push({name,ok:true});console.log('PASS '+name)}catch(e){checks.push({name,ok:false,error:e.message});console.error('FAIL '+name+' '+e.message)}}
 try{
 await p.goto('http://127.0.0.1:'+srv.address().port,{waitUntil:'domcontentloaded',timeout:90000});
 await p.waitForFunction(()=>!!window.__SHOT);
 await test('Accueil MARLON lisible',async()=>{assert.equal(await p.title(),'MARLON — Empire urbain');assert(await p.locator('#play').isVisible());await p.screenshot({path:path.join(out,'01-accueil.png')})});
 await test('Entrée réelle dans la ville depuis le bouton de démarrage',async()=>{await p.locator('#play').click();await p.waitForFunction(()=>__G.running&&__G.city.on);assert.equal(await p.evaluate(()=>__G.uiOpen),null)});
 await p.evaluate(()=>__SHOT.go({world:4,x:-110,y:1,z:-276,hour:16}));
 await test('Extension construite avec 12 secteurs et 4 repères',async()=>{const s=await p.evaluate(()=>({territories:__G.TERRITOIRES.length,markers:__G.empire.markers.length,cars:__G.city.cars.filter(c=>c.modelName).length}));assert.deepEqual(s,{territories:12,markers:4,cars:4})});
 await p.evaluate(()=>{__G.cam.yaw=Math.PI*.85;__G.cam.pitch=.2});
 await p.screenshot({path:path.join(out,'02-quartier-affaires.png')});
 await test('Carte stratégique accessible au clavier',async()=>{await p.keyboard.press('KeyM');await p.waitForFunction(()=>!document.getElementById('guerre').classList.contains('hidden'));assert.equal(await p.locator('#guerreCarte button').count(),12);assert.equal(await p.locator('#empireMap svg').count(),1);await p.screenshot({path:path.join(out,'03-carte-strategique.png')})});
 await test('Sélection du quartier et suivi d’objectif',async()=>{await p.locator('#guerreCarte [data-territory="finance"]').click();assert.equal(await p.evaluate(()=>__G.empire.selected),'finance');await p.locator('[data-empire="track"]').click();assert.equal(await p.evaluate(()=>__G.uiOpen),null)});
 await test('Mission reconnaissance : trois points physiques et une seule récompense',async()=>{
 const before=await p.evaluate(()=>{__G.empire.operation=null;__G.empire.completed=[];const w=__G.wallet;__G.empireStartOperation('recon');return w});
 for(const k of ['northwest','finance','freight'])await p.evaluate(k=>{const t=__G.TERRITOIRES.find(t=>t.k===k);__G.P.pos.set(t.x,1,t.z);__G.empireTick(.3)},k);
 const a=await p.evaluate(()=>({op:__G.empire.operation,wallet:__G.wallet,done:__G.empire.completed.includes('recon')}));assert.equal(a.op,null);assert(a.done);assert(a.wallet>=before+120);
 });
 await test('DualSense simulée : pavé ouvre la carte, déconnexion libère les touches',async()=>{
 await p.evaluate(()=>{__G.closeUI();const g={id:'054c DualSense Wireless Controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};window._testPad=g;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window._testPad]});__G.pollGamepad(.016);g.buttons[17]={pressed:true,value:1};__G.pollGamepad(.016)});
 assert.equal(await p.evaluate(()=>__G.uiOpen),'guerre');
 await p.evaluate(()=>{window._testPad=null;__G.keys.add('Space');__G.pad.bas={1:true};__G.pollGamepad(.016)});assert.equal(await p.evaluate(()=>__G.keys.has('Space')),false);
 });
 await test('Carte mobile : contrôles et panneaux restent dans leur fenêtre',async()=>{
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>__G.majGuerre());
 const overflow=await p.evaluate(()=>{const card=document.querySelector('#guerre .card');return {card:card.scrollWidth-card.clientWidth,body:document.documentElement.scrollWidth-innerWidth}});assert(overflow.card<=2,JSON.stringify(overflow));assert(overflow.body<=2,JSON.stringify(overflow));await p.screenshot({path:path.join(out,'04-carte-mobile.png')});
 });
 await test('Aucune exception JavaScript ou erreur shader',async()=>assert.deepEqual(errors,[]));
 } finally {fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));await browser.close();srv.close()}
 console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length}));if(checks.some(c=>!c.ok))process.exitCode=1;
})().catch(e=>{console.error(e);srv.close();process.exitCode=1});
