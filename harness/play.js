'use strict';
// Test de jeu réel : charge le jeu dans Chromium, enchaîne des situations qui
// se croisent (manger + changer de monde, conduire + changer de monde, fenêtres,
// prison, missions…) et signale toute erreur de console ou état resté coincé.
const fs=require('fs'), path=require('path'), http=require('http');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT=path.join(__dirname,'..');
const shot=fs.readFileSync(path.join(__dirname,'shot.js'),'utf8');
const HOOK=/const HOOK = `([\s\S]*?)`;\n/.exec(shot)[1];

function serve(file){
  const html=fs.readFileSync(file,'utf8')
    .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>/,'<script src="/three.min.js"></script>')
    .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/peerjs[^<]*<\/script>/,'')
    .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/,'')
    .replace(/\nloop\(\);/, '\nloop();\n'+HOOK);
  const three=fs.readFileSync(path.join(__dirname,'vendor','three.min.js'));
  const srv=http.createServer((q,r)=>{ if(q.url.startsWith('/three')){r.writeHead(200,{'Content-Type':'application/javascript'});r.end(three);}
    else {r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html);} });
  return new Promise(res=>srv.listen(0,'127.0.0.1',()=>res({srv,port:srv.address().port})));
}

const CASES=[];
const test=(n,fn)=>CASES.push({n,fn});

test('manger puis changer de monde : rien ne reste collé à la main', async p => {
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12});
    __G.wallet = 999; __G.takeAway({ id:'burger', n:'Burger', e:'🍔', p:6, f:6 }); });
  await p.waitForTimeout(300);
  const avant = await p.evaluate(()=>({bras:__G.arm(), classe:__G.bodyClass().includes('carry')}));
  await p.evaluate(()=>__G.loadWorld(0)); await p.waitForTimeout(400);
  const apres = await p.evaluate(()=>({bras:__G.arm(), classe:__G.bodyClass().includes('carry'), snack:!!__G.P.snack}));
  return { ok: avant.classe && apres.bras === avant.bras - 1 && !apres.classe && !apres.snack,
    detail:`objets dans la main ${avant.bras} → ${apres.bras}, classe carry après=${apres.classe}, snack=${apres.snack}` };
});

test('conduire puis changer de monde : les boutons tactiles reviennent à pied', async p => {
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12});
    const c=__G.city.cars[0]; if(c) __G.enterCar(c); });
  await p.waitForTimeout(300);
  const dedans = await p.evaluate(()=>({car:!!__G.drive.car, hud:__G.hud(), cls:__G.bodyClass()}));
  await p.evaluate(()=>__G.loadWorld(0)); await p.waitForTimeout(400);
  const apres = await p.evaluate(()=>({car:!!__G.drive.car, hud:__G.hud(), cls:__G.bodyClass()}));
  return { ok: dedans.car && !apres.car && apres.hud.jump==='SAUT' && !apres.cls.includes('driving'),
    detail:`au volant=${dedans.car} → ${apres.car}; bouton saut="${apres.hud.jump}"` };
});

test('Échap ferme la fenêtre ouverte', async p => {
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12}); __G.openUI('fridgeUI'); });
  await p.waitForTimeout(200);
  const ouvert = await p.evaluate(()=>({ui:__G.uiOpen, pause:__G.paused}));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  const ferme = await p.evaluate(()=>({ui:__G.uiOpen, pause:__G.paused}));
  return { ok: ouvert.ui==='fridgeUI' && !ferme.ui && !ferme.pause, detail:`ouverte="${ouvert.ui}" → "${ferme.ui}", en pause=${ferme.pause}` };
});

test("l'escalade des délits retombe avec la traque", async p => {
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12}); __G.police.crimeLevel=3; __G.clearWanted('test'); });
  const c = await p.evaluate(()=>__G.police.crimeLevel);
  return { ok: c===0, detail:'crimeLevel après abandon des poursuites = '+c };
});

test("un gros délit donne encore une lourde peine (la remise à zéro ne doit pas tout aplatir)", async p => {
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12});
    __G.police.crimeLevel = 3;
    // on rejoue l'ordre exact de l'arrestation : la peine se calcule AVANT clearWanted()
    __G.jail.on = true; __G.jail.level = __G.police.crimeLevel || 1; __G.clearWanted(); });
  const r = await p.evaluate(()=>({niveau:__G.jail.level, crime:__G.police.crimeLevel}));
  await p.evaluate(()=>{ __G.jail.on=false; __G.jailFree('fin'); });
  return { ok: r.niveau===3 && r.crime===0, detail:`peine=${r.niveau} (attendu 3), crimeLevel remis à ${r.crime}` };
});

test('un bot bloqué contre un mur ne fait plus planter la boucle', async p => {
  await p.evaluate(()=>__G.loadWorld(4)); await p.waitForTimeout(500);
  const r = await p.evaluate(()=>{
    const b = __G.bots[0];
    // état exact qui plantait : le bot est dans un immeuble (chaque pas est bloqué) et vient
    // d'atteindre 1,2 s de blocage, donc sa destination est remise à null au pas suivant
    b.pos.set(35.5, 0.3, 16); b.target = [80, 0.3, 16]; b.wait = 0; b.stuckT = 1.19;
    try { for (let i = 0; i < 6; i++) __G.updateBot(b, 0.05); return { ok: true }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  return { ok: r.ok, detail: r.ok ? 'six pas simulés en état bloqué, aucune exception' : 'exception : ' + r.err };
});

test('la mission « Livraison express » a une destination réelle', async p => {
  await p.evaluate(()=>__G.loadWorld(4)); await p.waitForTimeout(500);
  const snack = await p.evaluate(()=>__G.city.snack);
  if (!snack) return { ok:false, detail:'city.snack vaut toujours null' };
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12}); __G.startMission('livraison'); });
  await p.waitForTimeout(600);
  const m = await p.evaluate(()=>({cur: __G.mission.cur ? __G.mission.cur.id || true : null}));
  await p.evaluate(()=>__G.endMission(false, true));
  return { ok: !!m.cur, detail:`snack en (${snack.x}, ${snack.z}), mission acceptée=${!!m.cur}` };
});

test('les indicateurs de proximité repartent à zéro hors de la ville', async p => {
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12});
    __G.city.stoveNear = true; __G.city.rideNear = { dummy:1 }; __G.city.swingNear = { dummy:1 }; });
  await p.evaluate(()=>__G.loadWorld(0)); await p.waitForTimeout(400);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
  const r = await p.evaluate(()=>({stove:!!__G.city.stoveNear, ride:!!__G.city.rideNear, swing:!!__G.city.swingNear,
    prisRide:!!__G.P.ride, prisSwing:!!__G.P.swing}));
  return { ok: !r.stove && !r.ride && !r.swing && !r.prisRide && !r.prisSwing,
    detail:`gazinière=${r.stove} manège=${r.ride} balançoire=${r.swing}, joueur coincé=${r.prisRide||r.prisSwing}` };
});

test('les matériaux des ballons sont déclarés partagés', async p => {
  const r = await p.evaluate(()=>({ foot: __G.shared.has(__G.ballMats.foot), tennis: __G.shared.has(__G.ballMats.tennis) }));
  return { ok: r.foot && r.tennis, detail:`foot partagé=${r.foot}, tennis partagé=${r.tennis} (sinon clearWorld les détruit à chaque changement de monde)` };
});

test('le tennis ne sert pas sur un court vide', async p => {
  await p.evaluate(()=>__G.loadWorld(4)); await p.waitForTimeout(500);
  const r = await p.evaluate(()=>{
    __G.P.racket = false;                       // personne sur le court
    __G.tm.on = true; __G.tm.serve = 0; __G.tm.serveT = -1; __G.tm.graceT = 0; __G.tm.s = [0, 0]; __G.tm.names = ['a', 'b'];
    __G.city.balls.length = 0;                  // aucune balle : le service va être tenté
    try { __G.tennisMatchTick(0.016); return { ok: true }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
    finally { __G.tm.on = false; }
  });
  return { ok: r.ok, detail: r.ok ? 'service tenté sur un court vide sans exception' : 'exception : ' + r.err };
});

test('les ballons de la fête foraine ne s\'accumulent pas', async p => {
  await p.evaluate(()=>__G.loadWorld(4)); await p.waitForTimeout(500);
  const n1 = await p.evaluate(()=>__G.city.balloons.length);
  await p.evaluate(()=>__G.loadWorld(0)); await p.waitForTimeout(300);
  await p.evaluate(()=>__G.loadWorld(4)); await p.waitForTimeout(500);
  const n2 = await p.evaluate(()=>__G.city.balloons.length);
  return { ok: n1===n2 && n1>0, detail:`${n1} puis ${n2} ballons` };
});

test('aller-retour entre les cinq mondes sans erreur', async p => {
  for (const w of [0,1,2,3,4,0,4]) { await p.evaluate(i=>__G.loadWorld(i), w); await p.waitForTimeout(260); }
  const s = await p.evaluate(()=>({w:__G.worldIdx, sol:__G.solids.length}));
  return { ok: s.w===4 && s.sol>500, detail:`monde ${s.w}, ${s.sol} solides` };
});

test('la villa : ascenseur, portails et cuisine se construisent', async p => {
  await p.evaluate(()=>__G.loadWorld(4)); await p.waitForTimeout(500);
  const v = await p.evaluate(()=>({lift:!!__G.city.lift, gate:!!__G.city.gate, garage:!!__G.city.garageDoor,
    fridge:!!__G.city.fridge, stove:!!__G.city.stove, feux:__G.city.burners.length, slots:__G.city.decorSlots.length}));
  return { ok: v.lift&&v.gate&&v.garage&&v.fridge&&v.stove&&v.feux===4&&v.slots===9, detail:JSON.stringify(v) };
});

test('prison : entrer et sortir laisse un état propre', async p => {
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12}); __G.jail.on = true; __G.jailEnter(true); });
  await p.waitForTimeout(400);
  const dedans = await p.evaluate(()=>({on:__G.jail.on, cell:!!__G.police.cell, pres:Math.abs(__G.P.pos.x-(__G.police.cell?__G.police.cell.x:1e9))<3}));
  await p.evaluate(()=>__G.jailFree('test')); await p.waitForTimeout(400);
  const dehors = await p.evaluate(()=>({on:__G.jail.on, ui:__G.uiOpen, pause:__G.paused}));
  return { ok: dedans.on && dedans.cell && dedans.pres && !dehors.on && !dehors.pause, detail:`enfermé=${dedans.on} placé en cellule=${dedans.pres} → libéré=${!dehors.on}, pause=${dehors.pause}` };
});

test('300 images de simulation en ville sans exception', async p => {
  await p.evaluate(()=>{ __SHOT.go({world:4,x:0,y:1,z:0,hour:12}); });
  await p.waitForTimeout(5000);
  const s = await p.evaluate(()=>({t:__G.simTime, run:__G.running}));
  return { ok: s.t>3 && s.run, detail:`simTime=${s.t.toFixed(1)} s` };
});

(async()=>{
  const file=process.argv[2]||path.join(ROOT,'superobby.html');
  const {srv,port}=await serve(file);
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1024,height:640}});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__SHOT&&window.__SHOT.ready,null,{timeout:60000});
  let pass=0, fail=0;
  for(const c of CASES){
    const before=errors.length;
    let r; try { r=await c.fn(page); } catch(e){ r={ok:false,detail:'exception : '+e.message}; }
    const newErr=errors.slice(before);
    const ok=r.ok&&newErr.length===0;
    console.log(`${ok?'  OK  ':'ÉCHEC '} ${c.n}\n        ${r.detail}${newErr.length?'\n        erreurs: '+newErr.slice(0,3).join(' | ').slice(0,300):''}`);
    ok?pass++:fail++;
  }
  console.log(`\n${pass} réussis, ${fail} échoués — ${errors.length} erreur(s) console au total`);
  if(errors.length) errors.slice(0,8).forEach(e=>console.log('  '+e.slice(0,200)));
  await browser.close(); srv.close();
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
