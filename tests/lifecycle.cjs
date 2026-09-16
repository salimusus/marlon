'use strict';
// Real pagehide/navigation regressions: an import or reset must not be
// overwritten by the campaign still in memory when the old page unloads.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
let pw;try{pw=require('playwright');}catch{pw=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'','playwright'));}
const root=path.join(__dirname,'..'),checks=[],errors=[];
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+req.url.split('?')[0]);if(!f.startsWith(root+path.sep)){res.statusCode=403;return res.end();}try{res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:800,height:600}});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('marlon.rebuild.settings',JSON.stringify({quality:'performance',sound:false}));});
const ready=()=>page.waitForFunction(()=>!!window.__TEST,null,{polling:100});
try{
await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?test=1');await ready();
const json=await page.evaluate(()=>{const g=__TEST.game;g.start();g.cash=123;g.save();const s=g.snapshotState();s.base.cash=876;s.base.rep=52;g.setMode('pause');return g.store.encode(s);});
await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.locator('input[type=file]').setInputFiles({name:'campagne.json',mimeType:'application/json',buffer:Buffer.from(json)})]);await ready();
assert.deepEqual(await page.evaluate(()=>({cash:__TEST.game.cash,rep:__TEST.game.rep})),{cash:876,rep:52});checks.push({name:'Import via fichier et rechargement : état importé préservé au pagehide',ok:true});
await page.evaluate(()=>{const g=__TEST.game;g.start();g.setMode('pause');});
await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.locator('#newGame').click({force:true,noWaitAfter:true})]);await ready();
assert.deepEqual(await page.evaluate(()=>({cash:__TEST.game.cash,squad:__TEST.game.allies.length,save:__TEST.game.hasSave,stored:localStorage.getItem('marlon.rebuild.save.v3')})),{cash:900,squad:0,save:false,stored:null});assert.deepEqual(errors,[]);checks.push({name:'Nouvelle campagne confirmée : suppression conservée après pagehide',ok:true});
}catch(e){checks.push({name:'Cycle de page',ok:false,error:e.message});process.exitCode=1;}
finally{fs.writeFileSync(path.join(root,'verification/lifecycle-results.json'),JSON.stringify({checks,errors},null,2));await browser.close();server.close();}console.log(JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
