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

// attend N secondes de temps SIMULÉ (le rendu logiciel avance bien moins vite que le temps réel)
async function attendreSim(p, secondes, maxMs = 120000) {
  const t0 = await p.evaluate(() => __G.simTime), debut = Date.now();
  while (Date.now() - debut < maxMs) {
    await p.waitForTimeout(250);
    if (await p.evaluate(t => __G.simTime - t, t0) >= secondes) return true;
  }
  return false;
}

// maintient « avancer » jusqu'à atteindre la hauteur visée ; renvoie la hauteur maximale atteinte.
// On relève le maximum et non la hauteur finale : sinon le joueur dépasse la plateforme et retombe.
async function grimpe(p, v, cible, maxMs = 45000) {
  await p.evaluate(vv => __SHOT.go(vv), v);
  await p.waitForTimeout(200);
  const y0 = await p.evaluate(() => __G.P.pos.y);
  let ymax = y0; const debut = Date.now();
  await p.keyboard.down('ArrowUp');
  while (Date.now() - debut < maxMs) {
    await p.waitForTimeout(200);
    const y = await p.evaluate(() => __G.P.pos.y);
    if (y > ymax) ymax = y;
    if (ymax >= cible - 0.05) break;
  }
  await p.keyboard.up('ArrowUp');
  return { y0, ymax, atteint: ymax >= cible - 0.05 };
}

// attend qu'une condition devienne vraie dans la page
async function attendre(p, condition, maxMs = 120000) {
  const debut = Date.now();
  while (Date.now() - debut < maxMs) { await p.waitForTimeout(250); if (await p.evaluate(condition)) return true; }
  return false;
}

// maintient une touche jusqu'à ce que la condition soit vraie
async function pousser(p, touche, condition, maxMs = 45000) {
  const debut = Date.now();
  await p.keyboard.down(touche);
  let ok = false;
  while (Date.now() - debut < maxMs) { await p.waitForTimeout(200); if (await p.evaluate(condition)) { ok = true; break; } }
  await p.keyboard.up(touche);
  return ok;
}

test('on monte à pied sur la terrasse du poste de secours (plage)', async p => {
  // yaw = 0 : « avancer » va vers -z, donc du sable vers la terrasse
  const r = await grimpe(p, { world: 4, x: 110.5, y: 0.5, z: 36, facing: 0, yaw: 0, pitch: 0.3, dist: 10, hour: 12, hideHud: true }, 3.2);
  return { ok: r.atteint, detail: `hauteur ${r.y0.toFixed(2)} → ${r.ymax.toFixed(2)} m au plus haut (terrasse à 3,20 m)` };
});

test('on monte à pied sur le bord de la piscine publique', async p => {
  const r = await grimpe(p, { world: 4, x: -51, y: 0.5, z: -3, facing: 0, yaw: 0, pitch: 0.3, dist: 10, hour: 12, hideHud: true }, 2.4);
  return { ok: r.atteint, detail: `hauteur ${r.y0.toFixed(2)} → ${r.ymax.toFixed(2)} m au plus haut (margelle à 2,40 m)` };
});

test('on monte à l\'étage par l\'escalier d\'une villa voisine', async p => {
  // Villa Azur : maison en (111, 162), escalier en x=119 qui remonte vers le nord
  const r = await grimpe(p, { world: 4, x: 119, y: 0.7, z: 169.2, facing: 0, yaw: 0, pitch: 0.3, dist: 8, hour: 12, hideHud: true }, 5.35);
  return { ok: r.atteint, detail: `hauteur ${r.y0.toFixed(2)} → ${r.ymax.toFixed(2)} m au plus haut (étage à 5,35 m)` };
});

test('l\'ascenseur de la villa monte, puis laisse ressortir', async p => {
  await p.evaluate(() => __SHOT.go({ world: 4, x: 71, y: 0.8, z: 166.4, facing: 0, yaw: 0, pitch: 0.2, dist: 8, hour: 12, hideHud: true }));
  const monte = await attendre(p, () => __G.city.lift.y > 5);   // on attend que la cabine soit arrivée en haut
  const haut = await p.evaluate(() => ({ y: __G.P.pos.y, cab: __G.city.lift.y }));
  // on sort vers l'ouest (le palier est à 2,6 m à gauche de la cabine)
  await pousser(p, 'ArrowLeft', () => Math.abs(__G.P.pos.x - 71) > 2);
  const sorti = await p.evaluate(() => ({ x: __G.P.pos.x, y: __G.P.pos.y }));
  const ecart = Math.abs(sorti.x - 71);
  return { ok: monte && haut.y > 4.5 && ecart > 1.6 && ecart < 6 && sorti.y > 4.5,
    detail: `monté à ${haut.y.toFixed(2)} m (cabine ${haut.cab.toFixed(2)}), puis sorti de ${ecart.toFixed(2)} m en restant à ${sorti.y.toFixed(2)} m` };
});

test('la zone affichée est la plus précise (villa, pas « quartier »)', async p => {
  await p.evaluate(() => __SHOT.go({ world: 4, x: 60, y: 1, z: 180, facing: 0, yaw: 0, pitch: 0.3, dist: 12, hour: 12, hideHud: true }));
  const ok = await attendre(p, () => __G.city.zone && __G.city.zone.name === 'Villa', 20000);
  const z = await p.evaluate(() => __G.city.zone ? __G.city.zone.name : null);
  return { ok, detail: `dans le jardin de ma villa, zone annoncée : « ${z} »` };
});

test('les libellés de commandes suivent le mode tactile', async p => {
  const r = await p.evaluate(() => {
    const avant = __G.ctrlText('🚗 Appuie sur E pour conduire');
    __G.tactile(true);
    const tactile = {
      action: __G.ctrlText('🚗 Appuie sur E pour conduire'),
      saut: __G.ctrlText('🪑 Assis (Espace / SAUT pour se lever)'),
      monde: __G.ctrlText('🌍 Monde : Espace (Difficile)'),   // le monde ne doit PAS être renommé
    };
    __G.tactile(false);
    return { avant, ...tactile };
  });
  const ok = r.avant.includes(' E ') && r.action.includes('✋') && r.saut.includes('SAUT')
    && !r.saut.includes('Espace') && r.monde.includes('Espace');
  return { ok, detail: `clavier « ${r.avant} » ; tactile « ${r.action} » / « ${r.saut} » ; monde préservé : ${r.monde.includes('Espace')}` };
});

test('une rafale de 6 balles visées touche un bot à 12 m', async p => {
  await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 110, y: 0.5, z: 60, hour: 12 });
    const b = __G.bots[0];
    __G.P.pos.set(110, 0.4, 60); __G.P.vel.set(0, 0, 0);
    __G.cam.yaw = Math.PI; __G.cam.pitch = 0; __G.P.facing = 0; __G.P.lock = null;   // sans cible verrouillée, la visée suit la caméra
    b.pos.set(110, 0.4, 72); b.ko = 0; b.dead = 0; b.hp = 100000; b.wait = 9999; b.target = null; b.av.group.visible = true;
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.drawWeapon(true);
    __G.P.aimToggle = true; __G.P.aim = true;   // visée épaulée : dispersion réduite
  });
  const hp0 = await p.evaluate(() => __G.bots[0].hp);
  // Une balle avance de ~4,7 m par image : l'ancien test ponctuel ne la voyait dans la
  // boîte du bot (0,84 m) qu'environ une fois sur six. La rafale rend l'écart visible.
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => { __G.P.fireCd = 0; __G.P.ammo = 8; __G.P.aim = true; __G.aimTick(); __G.fire(); });
    await attendre(p, () => __G.shots.length === 0, 20000);
  }
  const hp1 = await p.evaluate(() => __G.bots[0].hp);
  const touches = Math.round((hp0 - hp1) / 24);
  return { ok: touches >= 5, detail: `${touches} balles sur 6 ont touché (${hp0 - hp1} points de dégâts)` };
});

test('une balle ne traverse plus une cloison fine', async p => {
  await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 110, y: 0.5, z: 60, hour: 12 });
    const b = __G.bots[0];
    __G.P.pos.set(110, 0.4, 60); __G.P.vel.set(0, 0, 0);
    __G.cam.yaw = Math.PI; __G.cam.pitch = 0; __G.P.facing = 0; __G.P.lock = null;   // sans cible verrouillée, la visée suit la caméra
    b.pos.set(110, 0.4, 72); b.ko = 0; b.dead = 0; b.hp = 100000; b.wait = 9999; b.target = null; b.av.group.visible = true;
    // cloison de 30 cm entre le joueur et le bot : plus mince que la distance parcourue
    // par une balle en une image, donc invisible pour un test ponctuel
    const mur = { mesh: { position: { x: 110, y: 1.5, z: 66 } }, x: 110, y: 1.5, z: 66, w: 6, h: 3, d: 0.3 };
    __G.solids.push(mur); window.__mur = mur;
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.drawWeapon(true);
    __G.P.aimToggle = true; __G.P.aim = true;
  });
  const hp0 = await p.evaluate(() => __G.bots[0].hp);
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => { __G.P.fireCd = 0; __G.P.ammo = 8; __G.P.aim = true; __G.aimTick(); __G.fire(); });
    await attendre(p, () => __G.shots.length === 0, 20000);
  }
  const hp1 = await p.evaluate(() => __G.bots[0].hp);
  await p.evaluate(() => { const i = __G.solids.indexOf(window.__mur); if (i >= 0) __G.solids.splice(i, 1); });
  return { ok: hp1 === hp0, detail: `4 balles tirées à travers la cloison : le bot derrière a perdu ${hp0 - hp1} point(s) de vie (attendu 0)` };
});

test('une balle s\'arrête sur le mur et ne le traverse pas', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    // un mur artificiel droit devant, à 6 m
    const mur = { mesh: { position: { x: 0, y: 1.5, z: 6 } }, x: 0, y: 1.5, z: 6, w: 8, h: 3, d: 0.6 };
    __G.solids.push(mur);
    __G.P.pos.set(0, 0.4, 0); __G.cam.yaw = Math.PI; __G.cam.pitch = 0; __G.P.facing = 0; __G.P.lock = null;
    __G.aimTick();
    const d = __G.aimPoint.z;
    const derriere = __G.castSolids(0, 1.35, 0, 0, 0, 1, 60, false);
    __G.solids.splice(__G.solids.indexOf(mur), 1);
    return { viseZ: +d.toFixed(2), distMur: +derriere.d.toFixed(2) };
  });
  // le mur commence à z = 5.7 : le réticule doit s'y arrêter, pas filer au-delà
  return { ok: r.viseZ > 5.4 && r.viseZ < 6.1, detail: `réticule posé à z=${r.viseZ} (mur à 5,70 m)` };
});

test('le tir part bien de la bouche du canon', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    __G.P.pos.set(110, 0.4, 60); __G.cam.yaw = Math.PI; __G.cam.pitch = 0; __G.P.facing = 0; __G.P.lock = null;
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.drawWeapon(true);
    __G.shots.length = 0; __G.P.fireCd = 0; __G.P.ammo = 8; __G.aimTick(); __G.fire();
    const s = __G.shots[0];
    if (!s) return { ok: false };
    return { ok: true, dx: +(s.p.x - 110).toFixed(2), dy: +(s.p.y - 0.4).toFixed(2), dz: +(s.p.z - 60).toFixed(2) };
  });
  // la balle doit naître devant le joueur, à hauteur de poitrine, légèrement à droite
  const ok = r.ok && r.dz > 0.4 && r.dy > 0.8 && r.dy < 2 && Math.abs(r.dx) < 0.8;
  return { ok, detail: r.ok ? `départ de la balle à ${r.dx} / ${r.dy} / ${r.dz} du joueur` : 'aucune balle créée' };
});

test('la visée reste peu coûteuse (un seul passage sur les solides)', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    __G.cam.yaw = 0.7; __G.cam.pitch = 0.1; __G.P.lock = null;
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) __G.aimTick();
    return { ms: +((performance.now() - t0) / 200).toFixed(3), solides: __G.solids.length };
  });
  // l'ancienne visée échantillonnait tous les 0,60 m sur 90 m, soit ~150 passages sur la
  // liste des solides à chaque image : elle mesurait 1,67 ms contre 0,15 ms ici
  return { ok: r.ms < 0.5, detail: `${r.ms} ms par visée sur ${r.solides} solides` };
});

test('les bancs et les canapés arrêtent le joueur et servent d\'assise', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const b = __G.city.benches.find(s => s.assise != null && !s.y);
    const solide = __G.solids.some(o => Math.abs(o.x - b.x) < 1.6 && Math.abs(o.z - b.z) < 1.6 && o.h > 0.4 && o.h < 1);
    const canapes = __G.city.benches.filter(s => s.y > 0).length;
    return { solide, sieges: __G.city.benches.length, canapes };
  });
  return { ok: r.solide && r.canapes >= 2, detail: `${r.sieges} assises dont ${r.canapes} en intérieur ; banc solide : ${r.solide}` };
});

test('la piscine de la villa fait 1,80 m de fond', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 168, hour: 12 });
    const P2 = __G.city.villaPool, cx = (P2.x1 + P2.x2) / 2, cz = (P2.z1 + P2.z2) / 2;
    const plein = y => __G.solids.some(o => cx > o.x - o.w / 2 && cx < o.x + o.w / 2 && y > o.y - o.h / 2 && y < o.y + o.h / 2 && cz > o.z - o.d / 2 && cz < o.z + o.d / 2);
    return { surface: P2.top, eau: [0.5, 0, -0.5, -0.75].every(y => !plein(y)), fond: plein(-0.95) };
  });
  return { ok: r.eau && r.fond, detail: `surface à ${r.surface} m, eau libre jusqu'à -0,75 m, fond étanche : ${r.fond}` };
});

test('le stand de tir a des cibles et on peut les toucher', async p => {
  const n = await p.evaluate(() => { __SHOT.go({ world: 4, x: 52, y: 1, z: 11, hour: 12 }); return __G.city.targets.length; });
  if (!n) return { ok: false, detail: 'aucune cible dans le jeu' };
  const r = await p.evaluate(() => {
    __G.P.pos.set(47, 0.4, 11); __G.P.vel.set(0, 0, 0);
    __G.cam.yaw = 0; __G.cam.pitch = 0; __G.P.facing = Math.PI;   // caméra vers -z : on regarde les cibles
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.drawWeapon(true);
    __G.P.aimToggle = true; __G.P.aim = true; __G.P.fireCd = 0; __G.aimTick(); __G.fire();
    return __G.city.shots;
  });
  await attendre(p, () => __G.city.shots > 0 || __G.shots.length === 0, 25000);
  const apres = await p.evaluate(() => __G.city.shots);
  return { ok: n === 3 && apres > r, detail: `${n} cibles, compteur de touches ${r} → ${apres}` };
});

test('les cages de but existent, avec filet', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -13, y: 1, z: -13, hour: 12 });
    // poteaux : fins, ~2,1 m de haut, aux deux bouts du terrain
    const poteaux = __G.solids.filter(o => o.h > 1.9 && o.h < 2.3 && o.w < 0.4 && o.d < 0.4 && Math.abs(o.z + 13) < 3 && (Math.abs(o.x + 22) < 0.5 || Math.abs(o.x + 4) < 0.5));
    const filets = __G.solids.filter(o => Math.abs(o.z + 13) < 4 && (o.x < -21 || o.x > -5) && o.material && o.material.alphaTest);
    return { poteaux: poteaux.length, filets: filets.length };
  });
  return { ok: r.poteaux >= 4 && r.filets >= 6, detail: `${r.poteaux} poteaux, ${r.filets} panneaux de filet` };
});

test('les feux ne sont plus qu\'aux carrefours', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const carrefours = __G.city.crossings;
    const orphelins = __G.city.trafficLights.filter(t =>
      !carrefours.some(c => Math.abs(t.x - c[0]) < 12 && Math.abs(t.z - c[1]) < 12));
    return { feux: __G.city.trafficLights.length, carrefours: carrefours.length, orphelins: orphelins.length };
  });
  return { ok: r.orphelins === 0, detail: `${r.feux} feux sur ${r.carrefours} carrefours, ${r.orphelins} hors carrefour` };
});

test('le parc compte quatre balançoires', async p => {
  const n = await p.evaluate(() => { __SHOT.go({ world: 4, x: -12, y: 1, z: 66, hour: 12 }); return __G.city.swings.length; });
  return { ok: n === 4, detail: `${n} balançoires` };
});

test('dans la villa, le frigo est accessible et donne à manger', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 168, hour: 12 });
    const f = __G.city.fridge;
    if (!f) return { ok: false, pourquoi: 'aucun frigo enregistré' };
    __G.P.pos.set(f.x, 0.6, f.z);   // on se place devant
    return { ok: true, x: +f.x.toFixed(1), z: +f.z.toFixed(1) };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  await attendre(p, () => !!__G.city.fridgeNear, 20000);
  const proche = await p.evaluate(() => !!__G.city.fridgeNear);
  const ouvert = await p.evaluate(() => { __G.openFridge(); return __G.uiOpen; });
  await p.evaluate(() => __G.closeUI());
  return { ok: proche && ouvert === 'fridgeUI', detail: `frigo en (${r.x}, ${r.z}), détecté : ${proche}, fenêtre ouverte : ${ouvert}` };
});

test('un véhicule cabossé montre ses dégâts et fume', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const c = __G.city.cars.find(v => v.parts && v.parts.hood);
    if (!c) return { ok: false, pourquoi: 'aucun véhicule avec carrosserie' };
    __G.P.pos.set(c.x, 0.5, c.z + 4);           // à portée pour que la fumée se déclenche
    const avant = { capot: c.parts.hood.rotation.x, pc: c.parts.bumpers[0] ? c.parts.bumpers[0].rotation.z : 0 };
    __G.vehicleDamage(c, 45);                    // petits dégâts : fumée blanche
    const apres = { capot: c.parts.hood.rotation.x, pc: c.parts.bumpers[0] ? c.parts.bumpers[0].rotation.z : 0, dmg: c.dmg };
    c.fumT = 0; __G.fumeeTick(0.5);              // une bouffée blanche
    __G.vehicleDamage(c, 40);                    // gros dégâts : fumée noire
    c.fumT = 0; __G.fumeeTick(0.5);
    return { ok: true, avant, apres, dmgFinal: c.dmg };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  const ok = r.apres.capot !== r.avant.capot && r.apres.pc !== r.avant.pc && r.dmgFinal > 80;
  return { ok, detail: `capot ${r.avant.capot.toFixed(2)} → ${r.apres.capot.toFixed(2)}, pare-chocs ${r.avant.pc.toFixed(2)} → ${r.apres.pc.toFixed(2)}, dégâts ${r.dmgFinal}` };
});

test('la visée suit la caméra (visée à la souris)', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 110, y: 1, z: 100, hour: 12 });
    __G.P.pos.set(110, 0.4, 100);
    const vise = (yaw, pitch) => { __G.cam.yaw = yaw; __G.cam.pitch = pitch; __G.P.lock = null; __G.aimTick();
      __G.P.lock = null; return { x: +__G.aimDir.x.toFixed(2), y: +__G.aimDir.y.toFixed(2), z: +__G.aimDir.z.toFixed(2) }; };
    return { nord: vise(0, 0), sud: vise(Math.PI, 0), est: vise(-Math.PI / 2, 0), haut: vise(Math.PI, -0.6) };
  });
  // caméra à yaw=0 : elle est derrière le joueur côté +z, donc on vise vers -z
  const ok = r.nord.z < -0.9 && r.sud.z > 0.9 && r.est.x > 0.9 && r.haut.y > 0.5;
  return { ok, detail: `caméra 0° → visée ${JSON.stringify(r.nord)} ; 180° → ${JSON.stringify(r.sud)} ; inclinée vers le haut → y=${r.haut.y}` };
});

test('une voiture trop abîmée explose, et la réparation la remet à neuf', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const c = __G.city.cars.find(v => v.parts && v.parts.hood);
    __G.P.pos.set(c.x, 0.5, c.z + 5);
    const debrisAvant = __G.debris.length;
    __G.vehicleDamage(c, 100);
    const apres = { explose: !!c.explosed, mort: !!c.dead, debris: __G.debris.length - debrisAvant,
      noir: c.g.children.some(o => o.material && o.material.color && o.material.color.getHex() === 0x2f2b28) };
    c.dmg = 0; c.dead = false; __G.repairVisual(c);
    return { ...apres, repare: !c.explosed };
  });
  return { ok: r.explose && r.mort && r.debris >= 3 && r.repare,
    detail: `explosion : ${r.explose}, ${r.debris} pièces arrachées, carrosserie noircie : ${r.noir}, remise à neuf : ${r.repare}` };
});

test('on s\'assoit et on se relève sans sortir de la villa', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 168, hour: 12 });
    const s2 = __G.city.benches.find(b => b.y > 0 && Math.abs(b.x - 60) < 16 && Math.abs(b.z - 168) < 16);   // le fauteuil du salon de MA villa
    if (!s2) return { ok: false };
    __G.P.pos.set(s2.x, s2.y + 1, s2.z + 1.2);
    __G.sitBench(s2);
    const assis = { y: +__G.P.pos.y.toFixed(2), facing: +__G.P.facing.toFixed(2), attendu: +(s2.y + s2.assise - 0.51).toFixed(2) };
    __G.P.jumpBuf = 1; __G.P.sit = s2;
    // on rejoue la levée
    const av = { x: __G.P.pos.x, z: __G.P.pos.z };
    return { ok: true, assis, av, sx: s2.x, sz: s2.z, sy: s2.y };
  });
  if (!r.ok) return { ok: false, detail: 'aucun canapé trouvé' };
  await p.waitForTimeout(900);
  const apres = await p.evaluate(() => ({ x: +__G.P.pos.x.toFixed(1), z: +__G.P.pos.z.toFixed(1), y: +__G.P.pos.y.toFixed(2), sit: !!__G.P.sit }));
  // la maison va de x 52,4 à 73,6 et z 154,4 à 169,6 : on doit rester dedans
  const dedans = apres.x > 52 && apres.x < 74 && apres.z > 154 && apres.z < 170;
  const bonneAssise = Math.abs(r.assis.y - r.assis.attendu) < 0.01;
  return { ok: dedans && bonneAssise && !apres.sit,
    detail: `assis à y=${r.assis.y} (attendu ${r.assis.attendu}) ; relevé en (${apres.x}, ${apres.z}) — dans la maison : ${dedans}` };
});

test('le tir verrouille la cible la plus proche, tire un coup et rengaine', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    const b = __G.bots[0];
    __G.P.pos.set(110, 0.4, 60); __G.P.vel.set(0, 0, 0);
    __G.cam.yaw = Math.PI; __G.cam.pitch = 0;          // on regarde vers +z
    b.pos.set(113, 0.4, 74); b.ko = 0; b.dead = 0; b.hp = 100; b.wait = 9999; b.target = null; b.av.group.visible = true;
    __G.bots.slice(1).forEach(o => { o.av.group.visible = false; });   // une seule cible possible
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol');
    const avant = { degaine: !!__G.P.drawn, munitions: __G.P.ammo, tirs: __G.shots.length };
    __G.P.fireCd = 0; __G.fire();                       // un seul appui
    const lock = __G.P.lock;
    return { avant, verrouille: lock ? { x: +lock.x.toFixed(0), z: +lock.z.toFixed(0), nom: lock.nom } : null,
      degaineApres: !!__G.P.drawn, tirs: __G.shots.length - avant.tirs, munitions: __G.P.ammo,
      oriente: +((Math.atan2(3, 14)) - __G.P.facing).toFixed(2) };
  });
  // l'arme doit repartir dans l'étui toute seule
  await attendre(p, () => !__G.P.drawn, 25000);
  const range = await p.evaluate(() => ({ drawn: !!__G.P.drawn, hp: __G.bots[0].hp }));
  const ok = !r.avant.degaine && r.degaineApres && r.tirs === 1 && r.verrouille && Math.abs(r.oriente) < 0.05 && !range.drawn;
  return { ok, detail: `rangée avant=${!r.avant.degaine} · dégainée au tir=${r.degaineApres} · ${r.tirs} tir · verrouillé sur ${r.verrouille ? r.verrouille.nom : 'rien'} · écart d'orientation=${r.oriente} · rengainée=${!range.drawn} · bot à ${range.hp} PV` };
});

test('un seul appui ne tire qu\'une balle', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    __G.P.pos.set(110, 0.4, 60); __G.owned.add('arme:rifle'); __G.equipWeapon('rifle');
    __G.shots.length = 0; __G.P.fireCd = 0; __G.P.firing = true; __G.fire();
    const un = __G.shots.length;
    __G.fire(); __G.fire();                    // appuis pendant le temps de recharge : ignorés
    return { un, apres: __G.shots.length };
  });
  await p.evaluate(() => { __G.P.firing = false; });
  return { ok: r.un === 1 && r.apres === 1, detail: `${r.un} balle au premier appui, ${r.apres} après deux appuis supplémentaires` };
});

test('on est bien assis sur la balançoire', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -12, y: 1, z: 62, hour: 12 });
    const sw = __G.city.swings[0];
    __G.P.pos.set(sw.x, 1.2, sw.z); __G.city.swingNear = sw;
    __G.P.swing = sw; sw.rider = 'me'; sw.t = 0; sw.ang = 0; sw.amp = 0;
    return { x: sw.x, z: sw.z };
  });
  await p.waitForTimeout(900);
  const a = await p.evaluate(() => ({ y: +__G.P.pos.y.toFixed(2), rot: +__G.me.group.rotation.x.toFixed(2), ang: +__G.P.swing.ang.toFixed(2) }));
  await p.evaluate(() => { const sw = __G.P.swing; if (sw) sw.rider = null; __G.P.swing = null; });
  // planche à 0,95 m, dessus 1,00 m : le joueur s'assoit à 0,49 m
  const ok = Math.abs(a.y - 0.49) < 0.12 && Math.abs(a.rot + a.ang) < 0.02;
  return { ok, detail: `assis à y=${a.y} (attendu ≈0,49), corps incliné de ${a.rot} pour une nacelle à ${a.ang}` };
});

test('la police ouvre le feu à partir du niveau 2', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -54, y: 1, z: 34, hour: 12 });
    const pc = __G.police.cars[0];
    if (!pc) return { ok: false, pourquoi: 'aucune voiture de police' };
    __G.P.pos.set(pc.x + 12, 0.5, pc.z); __G.P.hp = 100;
    __G.police.alarmT = 0;
    const compte = () => __G.shots.filter(s => s.police).length;
    // la traque elle-même (décompte du niveau, arrestation) n'est pas l'objet du test :
    // on la neutralise pour n'observer que l'ouverture du feu
    const tourne = (n, w) => { __G.shots.length = 0; pc.shotT = 0; pc.nearT = 0;
      for (let i = 0; i < n; i++) {
        __G.police.wanted = w; __G.police.crimeLevel = w; pc.active = true;
        __G.police.decayT = __G.simTime + 999; __G.police.arrestT = __G.simTime + 999;
        __G.police.lastSeen = [__G.P.pos.x, __G.P.pos.z];
        __G.P.pos.set(pc.x + 12, 0.5, pc.z);   // on garde 12 m d'écart : la voiture fonce sinon jusqu'au contact
        __G.policeTick(0.05);
      }
      return compte(); };
    const n1 = tourne(30, 1), n3 = tourne(30, 3);
    __G.police.wanted = 0; __G.police.crimeLevel = 0; __G.clearWanted('fin');
    return { ok: true, n1, n3 };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  return { ok: r.n3 > 0 && r.n3 >= r.n1, detail: `niveau 1 : ${r.n1} tir(s) · niveau 3 : ${r.n3} tir(s)` };
});

test('plus le délit est grave, plus la police s\'accroche', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const mesure = sev => { __G.police.wanted = 0; __G.police.crimeLevel = 0;
      __G.infraction('test', 2, sev); const d = __G.police.decayT - __G.simTime; __G.clearWanted('fin'); return +d.toFixed(0); };
    const petit = mesure(1), grave = mesure(3);
    __G.clearWanted('fin');
    return { petit, grave };
  });
  return { ok: r.grave > r.petit * 1.5, detail: `petit délit : abandon dans ${r.petit} s · délit grave : ${r.grave} s` };
});

test('on monte sur le trampoline de la villa et on rebondit', async p => {
  const m = await grimpe(p, { world: 4, x: 45, y: 0.6, z: 162.5, facing: Math.PI, yaw: 0, pitch: 0.3, dist: 10, hour: 12, hideHud: true }, 1.6, 70000);
  const r = await p.evaluate(() => {
    // on se laisse tomber sur la toile depuis 4 m
    __G.P.pos.set(45, 4, 156); __G.P.vel.set(0, -2, 0);
    return { y0: +__G.P.pos.y.toFixed(2) };
  });
  const monte = await attendre(p, () => __G.P.vel.y > 3, 25000);
  const v = await p.evaluate(() => +__G.P.vel.y.toFixed(1));
  return { ok: m.atteint && monte, detail: `marches : ${m.y0.toFixed(2)} → ${m.ymax.toFixed(2)} m (toile à 1,65) · rebond : vitesse verticale ${v} m/s` };
});

test('on enfourche le cheval le plus proche du carrousel', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -18, y: 1, z: 152, hour: 12 });
    const car = __G.city.rides.find(x => x.kind === 'carousel');
    if (!car) return { ok: false, pourquoi: 'pas de carrousel' };
    const v = new __G.THREE.Vector3();
    const pos = i => { car.horses[i].g.getWorldPosition(v); return { x: v.x, z: v.z }; };
    // on se place à côté du cheval 3
    const cible = pos(3);
    __G.P.pos.set(cible.x, 1.2, cible.z); __G.P.ride = null; car.rider = null;
    __G.rideEnter(car);
    return { ok: true, idx: car.rider ? car.rider.idx : -1 };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  await p.waitForTimeout(700);
  const a = await p.evaluate(() => {
    const car = __G.city.rides.find(x => x.kind === 'carousel');
    const h = car.horses[car.rider.idx];
    const v = new __G.THREE.Vector3(0, 0.425, -0.05);
    h.g.localToWorld(v); __G.worldGroup.worldToLocal(v);
    const ecart = +(__G.P.pos.y - (v.y - 0.51)).toFixed(2);
    __G.P.ride = null; car.rider = null;
    return { ecart, y: +__G.P.pos.y.toFixed(2), selle: +v.y.toFixed(2) };
  });
  return { ok: r.idx === 3 && Math.abs(a.ecart) < 0.05,
    detail: `cheval choisi : n°${r.idx} (attendu 3) · joueur à ${a.y} m pour une selle à ${a.selle} m` };
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


test('on éjecte le conducteur et on vole une voiture du trafic', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 26, y: 1, z: 0, hour: 12 });
    const c = __G.city.aiCars.find(v => v.driver && v.spd > 0);
    if (!c) return { ok: false, pourquoi: 'aucune voiture du trafic avec conducteur' };
    __G.police.wanted = 0; __G.police.crimeLevel = 0;
    // on se plante à la portière : la voiture doit piler et proposer le vol
    const cs = Math.cos(c.h), sn = Math.sin(c.h);
    __G.P.pos.set(c.x + 2.2 * cs, 0.4, c.z - 2.2 * sn); __G.P.vel.set(0, 0, 0);
    __G.cityStep(0.05);
    const propose = __G.city.jackNear === c, arret = !!c.stopped;
    const nom = c.driver.name, aiAvant = __G.city.aiCars.length;
    __G.stealCar(c);
    return { ok: true, propose, arret, nom,
      auVolant: __G.drive.car === c, plusDansTrafic: !__G.city.aiCars.includes(c) && __G.city.cars.includes(c),
      fuyards: __G.city.fleeing.length, wanted: __G.police.wanted, gravite: __G.police.crimeLevel, aiAvant };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  await p.evaluate(() => { __G.exitCar(); __G.clearWanted('fin'); });
  const ok = r.propose && r.arret && r.auVolant && r.plusDansTrafic && r.fuyards === 1 && r.wanted >= 2 && r.gravite === 3;
  return { ok, detail: `pile à la portière=${r.arret} · vol proposé=${r.propose} · au volant=${r.auVolant} · ${r.nom} s'enfuit (${r.fuyards}) · recherché ${r.wanted}★ gravité ${r.gravite}` };
});

test('le conducteur éjecté s\'enfuit à pied puis disparaît', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 26, y: 1, z: 0, hour: 12 });
    __G.city.fleeing.length = 0;   // un vol d'un test précédent peut avoir laissé un fuyard
    const c = __G.city.aiCars.find(v => v.driver);
    __G.P.pos.set(c.x + 2.2, 0.4, c.z);
    __G.stealCar(c); __G.exitCar();
    const f = __G.city.fleeing[0]; const d0 = Math.hypot(f.x - __G.P.pos.x, f.z - __G.P.pos.z);
    for (let i = 0; i < 40; i++) __G.cityStep(0.05);
    const d1 = Math.hypot(f.x - __G.P.pos.x, f.z - __G.P.pos.z);
    f.t = __G.simTime - 1; __G.cityStep(0.05);   // au bout de 14 s il s'efface
    const reste = __G.city.fleeing.length;
    __G.clearWanted('fin');
    return { d0: +d0.toFixed(1), d1: +d1.toFixed(1), reste };
  });
  return { ok: r.d1 > r.d0 + 1 && r.reste === 0, detail: `s'éloigne de ${r.d0} m à ${r.d1} m, puis quitte la scène (${r.reste} restant)` };
});

test('la voiture du joueur démarre roues avant sur la ligne à damiers', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 118, hour: 12 });
    __G.startCountdown(4);
    const k = __G.drive.car;
    if (!k) return { ok: false, pourquoi: 'aucun kart' };
    // le kart roule vers -x : les roues avant sont à 1,3 m devant le centre
    const avant = k.x + Math.sin(k.h) * 1.3;
    __G.race.state = 'idle'; __G.exitCar();
    return { ok: true, x: +k.x.toFixed(2), z: +k.z.toFixed(2), avant: +avant.toFixed(2), h: +k.h.toFixed(2) };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  const surPiste = r.z > 119.5 && r.z < 128.5;
  return { ok: Math.abs(r.avant) < 0.15 && surPiste, detail: `centre (${r.x}, ${r.z}) → roues avant à x=${r.avant} (ligne à x=0), sur la piste=${surPiste}` };
});

test('le cinéma du parc projette un dessin animé', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 90, hour: 12 });
    const ci = __G.city.cinema; if (!ci) return { ok: false, pourquoi: 'pas de cinéma' };
    const bancs = __G.city.benches.filter(b => b.cine);
    const t0 = ci.t, i0 = ci.i;
    for (let k = 0; k < 400; k++) { ci.next = 0; __G.cinemaTick(0.05); }   // 20 s de projection
    const change = ci.t !== t0 || ci.i !== i0;
    // on s'assoit au premier rang : on doit regarder vers l'écran (+z)
    const b = bancs.sort((x, y) => y.z - x.z)[0];
    __G.P.sit = null; __G.sitBench(b);
    return { ok: true, bancs: bancs.length, change, ecranZ: ci.z, bancZ: b.z, facing: +__G.P.facing.toFixed(2), assis: __G.P.sit === b };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  await p.evaluate(() => { __G.P.sit = null; });
  const ok = r.bancs === 12 && r.change && r.assis && Math.abs(r.facing) < 0.01 && r.bancZ < r.ecranZ;
  return { ok, detail: `${r.bancs} bancs face à l'écran (z ${r.bancZ} < ${r.ecranZ}), film qui avance=${r.change}, regard=${r.facing} (0 = vers l'écran)` };
});

// marche en ligne droite depuis un point de départ jusqu'à une condition
// (yaw : 0 = on avance vers -z, -PI/2 = vers +x, PI = vers +z)
async function marcher(p, vue, condition, maxMs = 60000) {
  await p.evaluate(v => __SHOT.go(v), vue);
  await p.waitForTimeout(400);
  return await pousser(p, 'ArrowUp', condition, maxMs);
}

test('on entre à pied dans un hangar de la zone industrielle', async p => {
  const vue = { world: 4, x: 82, y: 0.6, z: -20, facing: -Math.PI / 2, yaw: -Math.PI / 2, pitch: 0.3, dist: 9, hour: 12, hideHud: true };
  const ok = await marcher(p, vue, () => __G.P.pos.x > 88);   // 88 = bien à l'intérieur (mur à 85,4)
  const pos = await p.evaluate(() => ({ x: +__G.P.pos.x.toFixed(1), z: +__G.P.pos.z.toFixed(1) }));
  return { ok, detail: `parti de x=82, arrivé en (${pos.x}, ${pos.z}) — l'entrepôt occupe x 85 → 99 (c'était un bloc plein)` };
});

test('on entre à pied dans une maison du quartier ouest', async p => {
  const vue = { world: 4, x: -92, y: 0.6, z: -43, facing: 0, yaw: 0, pitch: 0.3, dist: 9, hour: 12, hideHud: true };
  const ok = await marcher(p, vue, () => __G.P.pos.z < -49);
  const pos = await p.evaluate(() => ({ x: +__G.P.pos.x.toFixed(1), z: +__G.P.pos.z.toFixed(1), y: +__G.P.pos.y.toFixed(2) }));
  return { ok, detail: `parti de z=-43, arrivé en (${pos.x}, ${pos.z}) à y=${pos.y} — le salon est autour de z = -50` };
});

test('le hall des immeubles de la ville est ouvert', async p => {
  const vue = { world: 4, x: -6, y: 0.6, z: -30, facing: 0, yaw: 0, pitch: 0.3, dist: 9, hour: 12, hideHud: true };
  const ok = await marcher(p, vue, () => __G.P.pos.z < -34);
  const pos = await p.evaluate(() => ({ x: +__G.P.pos.x.toFixed(1), z: +__G.P.pos.z.toFixed(1), y: +__G.P.pos.y.toFixed(2) }));
  return { ok, detail: `parti de z=-30, arrivé en (${pos.x}, ${pos.z}) à y=${pos.y} — le hall est centré sur z = -35,5` };
});

test('le magasin de déco vend, livre et laisse poser une TV géante', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 46, y: 1, z: 58, hour: 12 });
    const vit = __G.city.vitrines.filter(v => v.tab === 'deco');
    const item = __G.DECOR.find(d => d.id === 'tvgeante');
    if (!item) return { ok: false, pourquoi: 'pas de TV géante au catalogue' };
    __G.city.parcels.length = 0;
    __G.deliverDecor(item);
    const colis = __G.city.parcels.length;
    __G.P.deco = null;
    __G.grabParcel(__G.city.parcels[0]);
    const enMain = __G.P.deco && __G.P.deco.id;
    // on l'accroche au mur du salon, où l'on veut
    __G.city.placed.slice().forEach(o => __G.retirerDeco(o, true));
    __G.P.pos.set(56, 0.5, 156.8); __G.P.facing = Math.PI;   // face au mur nord du séjour
    __G.parcelTick(0.016); __G.dropDecor();
    const pose = __G.city.placed[0] ? __G.city.placed[0].id : null;
    const auMur = !!(__G.city.placed[0] && __G.city.placed[0].mur);
    // remplacements successifs : ni écran fantôme, ni mur invisible, ni siège orphelin
    const solAvant0 = __G.solids.length, bancsAvant0 = __G.city.benches.length, tv0 = __G.city.tvs.length;
    const objs = [];
    for (let i = 0; i < 4; i++) objs.push(__G.placeLibre(i % 2 ? 'plante' : 'fauteuil', 58 + i, 0.3, 166, 0, false, true));
    objs.forEach(o => __G.retirerDeco(o, true));
    const fuites = { sol: __G.solids.length - solAvant0, bancs: __G.city.benches.length - bancsAvant0,
      ecranRetire: 1 - (__G.city.tvs.length - tv0) };
    return { ok: true, vitrines: vit.length, colis, enMain, posee: pose, auMur, fuites };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  const propre = r.fuites.sol === 0 && r.fuites.bancs === 0;
  const ok = r.vitrines >= 8 && r.colis === 1 && r.enMain === 'tvgeante' && r.posee === 'tvgeante' && r.auMur && propre;
  return { ok, detail: `${r.vitrines} présentoirs · livrée en colis=${r.colis} · en main=${r.enMain} · accrochée au mur choisi=${r.auMur} · rien ne fuit au retrait (solides +${r.fuites.sol}, assises +${r.fuites.bancs})` };
});

test('le fusil tire comme le pistolet : un coup, cible verrouillée, touchée', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    const b = __G.bots[0];
    __G.P.pos.set(110, 0.4, 60); __G.P.vel.set(0, 0, 0);
    b.pos.set(112, 0.4, 78); b.ko = 0; b.dead = 0; b.hp = 100; b.wait = 9999; b.target = null; b.av.group.visible = true;
    __G.bots.slice(1).forEach(o => { o.av.group.visible = false; });
    __G.owned.add('arme:rifle'); __G.equipWeapon('rifle');
    const n0 = __G.shots.length;
    __G.P.fireCd = 0; __G.P.drawn = false; __G.fire();
    const tirs = __G.shots.length - n0, lock = __G.P.lock ? __G.P.lock.nom : null;
    for (let i = 0; i < 60; i++) __G.shotsTick(1 / 120);   // la balle parcourt la distance
    return { tirs, lock, hp: __G.bots[0].hp, holster: __G.P.holsterT > __G.simTime, spread: __G.WEAPONS.rifle.spread };
  });
  await p.evaluate(() => { __G.equipWeapon(null); __G.bots.forEach(o => { o.av.group.visible = true; o.hp = 100; }); });
  const ok = r.tirs === 1 && r.lock && r.hp < 100 && r.holster && r.spread <= 0.006;
  return { ok, detail: `1 appui → ${r.tirs} balle · verrouillé sur ${r.lock} · bot à ${r.hp} PV · rengainage programmé=${r.holster} · dispersion ${r.spread}` };
});

test('E maintenu force bien le coffre de la banque', async p => {
  await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const sf = __G.city.safes[0]; sf.open = false; sf.progress = 0;
    __G.P.pos.set(sf.x, sf.y + 0.2, sf.z);
  });
  await p.waitForTimeout(600);
  const vu = await p.evaluate(() => !!__G.city.safeNear);
  await p.keyboard.down('KeyE');
  const monte = await attendre(p, () => __G.city.safes[0].progress > 0.05, 25000);
  const v = await p.evaluate(() => +(__G.city.safes[0].progress || 0).toFixed(2));
  await p.keyboard.up('KeyE');
  await p.evaluate(() => { __G.city.safes[0].progress = 0; __G.clearWanted('fin'); __G.police.alarmT = 0; });
  return { ok: vu && monte, detail: `coffre détecté=${vu} · progression après maintien de E : ${Math.round(v * 100)} %` };
});


test('assis sur la balançoire, on suit exactement la planche', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -13.5, y: 1, z: 62, hour: 12 });
    __G.P.ride = null; __G.P.sit = null; __G.city.rides.forEach(x => { x.rider = null; });
    const sw = __G.city.swings[1];
    sw.rider = null; sw.amp = 0; sw.ang = 0; sw.t = 0;
    __G.sitSwing(sw);
    const v = new __G.THREE.Vector3(); let pire = 0, angMax = 0;
    for (let i = 0; i < 400; i++) {
      __G.swingTick(1 / 60);
      sw.piv.updateMatrixWorld(true);
      const planche = sw.piv.children[2]; v.set(0, 0, 0); planche.localToWorld(v);
      const d = Math.hypot(v.x - __G.P.pos.x, v.z - __G.P.pos.z);   // écart horizontal joueur / planche
      if (d > pire) pire = d;
      if (Math.abs(sw.ang) > angMax) angMax = Math.abs(sw.ang);
    }
    sw.rider = null; __G.P.swing = null;
    return { pire: +pire.toFixed(2), angMax: +angMax.toFixed(2) };
  });
  return { ok: r.pire < 0.05 && r.angMax > 0.6,
    detail: `balancement jusqu'à ${r.angMax} rad · écart joueur / planche au pire : ${r.pire} m` };
});

test('on monte sur le carrousel depuis tout son pourtour', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -18, y: 1, z: 152, hour: 12 });
    const car = __G.city.rides.find(x => x.kind === 'carousel');
    if (!car) return { ok: false, pourquoi: 'pas de carrousel' };
    const essais = [];
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      __G.P.ride = null; car.rider = null;
      __G.P.pos.set(car.x + Math.cos(a) * 7, 0.4, car.z + Math.sin(a) * 7);
      __G.cityCommon(0.05);
      const propose = __G.city.rideNear === car;
      if (propose) __G.rideEnter(car);
      essais.push({ a: +a.toFixed(2), propose, monte: __G.P.ride === car, cheval: car.rider ? car.rider.idx : -1 });
    }
    __G.P.ride = null; car.rider = null;
    return { ok: true, essais, panneau: true };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  const tous = r.essais.every(e => e.propose && e.monte);
  const chevaux = new Set(r.essais.map(e => e.cheval)).size;
  return { ok: tous && chevaux >= 3,
    detail: `4 approches sur 4 permettent de monter=${tous} · ${chevaux} chevaux différents selon le côté` };
});

test('les exercices de l\'école ne se répètent pas et sont bien formés', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const distincts = {}; let mauvais = 0, total = 0;
    for (const subj of ['math', 'geo', 'logi', 'cult']) for (const age of ['a4', 'a7', 'a9']) {
      const set = new Set();
      for (let i = 0; i < 600; i++) { const q = __G.schQuestion(subj, age); set.add(q.q); total++;
        if (q.opts.length !== 4 || new Set(q.opts).size !== 4 || !q.opts.includes(q.a) || q.opts.some(o => o === 'NaN' || o === 'undefined')) mauvais++; }
      distincts[subj + age] = set.size;
    }
    // douze tirages de suite sans jamais retomber sur le même énoncé
    __G.school.vus = {};
    const suite = []; for (let i = 0; i < 12; i++) suite.push(__G.schTirage('cult', 'a4').q);
    const mini = Math.min(...Object.values(distincts));
    return { mauvais, total, mini, distincts: Object.entries(distincts).map(([k, v]) => `${k}:${v}`).join(' '),
      repetes: suite.length - new Set(suite).size };
  });
  const ok = r.mauvais === 0 && r.mini >= 10 && r.repetes === 0;
  return { ok, detail: `${r.total} exercices tirés, ${r.mauvais} mal formés · énoncés distincts par case : ${r.distincts} · 12 tirages d'affilée : ${r.repetes} répétition(s)` };
});

test('la maîtresse lit l\'énoncé à voix haute et annonce « c\'est gagné »', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    __G.settings.voices = true;
    const dits = [];
    try { window.speechSynthesis.speak = u => dits.push(String(u.text)); } catch (e) { return { ok: false, pourquoi: 'synthèse vocale non remplaçable' }; }
    // symboles dits en toutes lettres
    const maths = __G.schDire('7 × 8 = ? puis 50 % de 80, 4² et 12 ÷ 3');
    const salle = __G.city.classes[0]; if (!salle) return { ok: false, pourquoi: 'aucune salle de classe' };
    dits.length = 0;
    __G.openSchool(salle);
    const q = __G.school.q, lu = dits.join(' | ');
    const cartes = [...document.querySelectorAll('#schChoices .item')];
    const bonne = cartes[q.opts.indexOf(q.a)];
    dits.length = 0;
    bonne.click();
    const gagne = dits.join(' | ');
    const marquee = bonne.style.background;
    // et sur une mauvaise réponse, la bonne carte doit quand même se colorer en vert
    __G.nextQuestion(); const q2 = __G.school.q;
    const c2 = [...document.querySelectorAll('#schChoices .item')];
    const mauvaise = c2[(q2.opts.indexOf(q2.a) + 1) % 4];
    mauvaise.click();
    const bonneVerte = c2[q2.opts.indexOf(q2.a)].style.background;
    __G.closeUI();
    return { ok: true, maths, question: q.q, lu, gagne, marquee, bonneVerte, nCartes: cartes.length };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  const symboles = /fois/.test(r.maths) && /pour cent/.test(r.maths) && /au carré/.test(r.maths) && /divisé par/.test(r.maths) && /égale/.test(r.maths);
  const enonce = r.lu.includes('Réponse un') && r.lu.includes('Réponse quatre');
  const gagne = /gagn/i.test(r.gagne);
  const vert = r.bonneVerte.includes('214, 255, 214') || r.bonneVerte.toLowerCase().includes('d6ffd6');
  return { ok: symboles && enonce && gagne && vert && r.nCartes === 4,
    detail: `symboles dits en lettres=${symboles} (« ${r.maths.slice(0, 60)}… ») · énoncé + 4 réponses lus=${enonce} · « c'est gagné » dit=${gagne} (« ${r.gagne.slice(0, 40)} ») · bonne carte surlignée après une erreur=${vert}` };
});


test('il pleut et il neige, et on est à l\'abri sous un toit', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 10, hour: 12 });
    const lis = () => ({ seg: __G.meteo.seg.visible, flocons: __G.meteo.flocons.visible,
      op: +Math.max(__G.meteo.seg.material.opacity, __G.meteo.flocons.material.opacity).toFixed(2),
      sol: +__G.meteo.sol.material.opacity.toFixed(2) });
    __G.meteoSet('pluie', 600); __G.meteo.force = 1; __G.cam.dedansT = 0; __G.meteoTick(0.016);
    const pluie = lis();
    __G.meteoSet('neige', 600); __G.meteo.force = 1; __G.cam.dedansT = 0; __G.meteoTick(0.016);
    const neige = lis();
    // sous le hall d'un immeuble : plus une goutte
    __G.P.pos.set(-35.5, 0.4, -27); __G.cam.dedansT = 0; __G.meteoTick(0.016);
    const abri = __G.meteo.abri, opAbri = +__G.meteo.flocons.material.opacity.toFixed(2);
    __G.meteoSet('clair', 600); __G.meteo.force = 0; __G.meteoTick(0.016);
    return { pluie, neige, abri, opAbri, clair: lis() };
  });
  const ok = r.pluie.seg && !r.pluie.flocons && r.pluie.op > 0.4 && r.pluie.sol === 0
    && r.neige.flocons && !r.neige.seg && r.neige.sol > 0.5
    && r.abri && r.opAbri < 0.1 && !r.clair.seg && !r.clair.flocons;
  return { ok, detail: `pluie : gouttes=${r.pluie.seg} opacité ${r.pluie.op} · neige : flocons=${r.neige.flocons} manteau au sol ${r.neige.sol} · sous un toit : abri=${r.abri} (opacité ${r.opAbri}) · beau temps : rien` };
});

test('on devient ami avec un bot en lui écrivant', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 6, hour: 12 });
    __G.amis.clear();
    const avant = __G.amis.size;
    const traite = __G.commandeSociale('Lucas_2014 tu veux être mon ami ?');
    const liste = __G.commandeSociale('mes amis');
    const etoile = document.getElementById('lbRows').textContent.includes('⭐');
    return { avant, traite, apres: [...__G.amis], liste, etoile };
  });
  const ok = r.traite && r.avant === 0 && r.apres.includes('Lucas_2014') && r.liste && r.etoile;
  return { ok, detail: `« Lucas_2014 tu veux être mon ami ? » → amis : ${r.apres.join(', ')} · ⭐ au classement=${r.etoile}` };
});

test('un ami se rend au rendez-vous fixé par message', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 6, hour: 12 });
    __G.amis.clear(); __G.amis.add('Lucas_2014');
    const b = __G.bots[0]; b.rdv = null; b.ko = 0; b.fight = null; b.wait = 0;
    b.pos.set(0, 0.3, 6); b.av.group.position.copy(b.pos);
    const traite = __G.commandeSociale('Lucas_2014 rendez-vous au parc');
    const cible = b.rdv ? { x: b.rdv.x, z: b.rdv.z, nom: b.rdv.nom } : null;
    const d0 = cible ? Math.hypot(b.pos.x - cible.x, b.pos.z - cible.z) : 0;
    for (let i = 0; i < 3000; i++) __G.updateBot(b, 1 / 30);
    const d1 = cible ? Math.hypot(b.pos.x - cible.x, b.pos.z - cible.z) : 0;
    const arrive = !!(b.rdv && b.rdv.arrive);
    b.rdv = null;
    return { traite, cible, d0: +d0.toFixed(1), d1: +d1.toFixed(1), arrive };
  });
  const ok = r.traite && r.cible && r.d1 < 2 && r.arrive;
  return { ok, detail: `rendez-vous ${r.cible ? r.cible.nom : '—'} : le bot part de ${r.d0} m et arrive à ${r.d1} m (annonce son arrivée=${r.arrive})` };
});

test('on adopte un chien, on le nomme et il suit partout', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 80, hour: 12 });
    __G.store.set('superobby.chien', ''); __G.chien.pet = null; __G.chien.nom = '';
    const d = __G.city.pets.find(x => x.kind === 'dog');
    __G.P.pos.set(d.x + 2, 0.4, d.z);
    const loin = __G.commandeSociale('adopte');           // proche : doit adopter
    const nomme = __G.commandeSociale('Rex');
    // il suit à pied
    __G.P.pos.set(20, 0.4, 92);
    for (let i = 0; i < 400; i++) __G.chienTick(1 / 60);
    const aPied = Math.hypot(__G.chien.pet.x - __G.P.pos.x, __G.chien.pet.z - __G.P.pos.z);
    // il monte en voiture avec son maître
    const c = __G.city.cars.find(v => !v.heli && v.kind !== 'jetski');
    __G.P.pos.set(c.x, c.y + 0.4, c.z); __G.enterCar(c);
    for (let i = 0; i < 60; i++) __G.chienTick(1 / 60);
    const enVoiture = Math.hypot(__G.chien.pet.x - c.x, __G.chien.pet.z - c.z);
    __G.exitCar();
    return { loin, nomme, nom: __G.chien.nom, adopte: !!__G.chien.pet.adopte,
      aPied: +aPied.toFixed(2), enVoiture: +enVoiture.toFixed(2), tag: !!__G.chien.tag };
  });
  const ok = r.loin && r.nomme && r.nom === 'Rex' && r.adopte && r.aPied < 2.5 && r.enVoiture < 2 && r.tag;
  return { ok, detail: `adopté et nommé « ${r.nom} » (étiquette=${r.tag}) · il suit à ${r.aPied} m à pied et à ${r.enVoiture} m du véhicule` };
});

test('le chien va se coucher dans sa niche quand le maître s\'assoit', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 168, hour: 12 });
    const niche = __G.city.niche;
    if (!niche) return { ok: false, pourquoi: 'aucune niche dans la villa' };
    __G.chien.pet = null; __G.chien.nom = 'Rex';
    __G.adopterChien(__G.city.pets.find(x => x.kind === 'dog'), true);
    const d = __G.chien.pet;
    d.x = niche.x + 4; d.z = niche.z + 4; d.y = niche.y;
    // le maître s'assoit à l'étage de sa villa
    const banc = __G.city.benches.find(b => Math.abs(b.x - 60) < 16 && Math.abs(b.z - 168) < 16);
    __G.P.pos.set(niche.x + 3, niche.y, niche.z + 3); __G.P.sit = banc || { x: niche.x + 3, z: niche.z + 3, y: niche.y, facing: 0, assise: 0.6 };
    for (let i = 0; i < 600; i++) __G.chienTick(1 / 60);
    const dist = Math.hypot(d.x - niche.x, d.z - niche.z);
    const couche = __G.chien.couche, basse = +(d.g.position.y - niche.y).toFixed(2);
    __G.P.sit = null;
    return { ok: true, niche: [niche.x, +niche.y.toFixed(2), niche.z], dist: +dist.toFixed(2), couche, basse };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  return { ok: r.dist < 0.4 && r.couche && r.basse < 0, detail: `niche en (${r.niche[0]}, ${r.niche[2]}) à l'étage (y=${r.niche[1]}) · le chien s'y rend (${r.dist} m) et se couche (${r.couche}, corps abaissé de ${r.basse} m)` };
});

test('le chien attaque quand son maître écrit « attaque »', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 80, hour: 12 });
    __G.chien.pet = null; __G.chien.nom = 'Rex';
    __G.adopterChien(__G.city.pets.find(x => x.kind === 'dog'), true);
    const b = __G.bots[1]; b.ko = 0; b.hp = 100; b.wait = 9999; b.av.group.visible = true;
    // pelouse dégagée du parc : ni bancs, ni cabine de projection
    b.pos.set(-16, 0.15, 84); b.av.group.position.copy(b.pos);
    __G.P.pos.set(-22, 0.4, 84);
    __G.chien.pet.x = -21; __G.chien.pet.z = 84; __G.chien.pet.y = 0.15;
    __G.P.crime = 0; __G.police.wanted = 0;   // un test précédent peut avoir armé le délai anti-spam des délits
    const traite = __G.commandeSociale('MaxiBloc attaque !');
    const vise = __G.chien.attaque ? __G.chien.attaque.nom : null;
    for (let i = 0; i < 900; i++) __G.chienTick(1 / 60);
    const hp = b.hp, wanted = __G.police.wanted;
    __G.chien.attaque = null; b.hp = 100; b.wait = 0; __G.clearWanted('fin');
    return { traite, vise, hp, wanted };
  });
  const ok = r.traite && r.vise === 'MaxiBloc' && r.hp < 100 && r.wanted > 0;
  return { ok, detail: `cible verrouillée : ${r.vise} · le bot tombe à ${r.hp} PV · c'est un délit (recherché ${r.wanted}★)` };
});

test('un ami organise un braquage, attend au volant et file à la villa', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -40, y: 1, z: 70, hour: 12 });
    __G.amis.clear(); __G.amis.add('Lucas_2014');
    const pasAmi = __G.commandeSociale('Nathan_pro on organise un braquage');   // pas ami : refus
    const etatApresRefus = __G.coup.etat;
    const traite = __G.commandeSociale('Lucas_2014 on organise un braquage');
    const c = __G.coup.car, attente = __G.coup.etat, complice = __G.coup.bot && __G.coup.bot.name;
    __G.police.wanted = 0;
    __G.infraction('braquer la banque', 3, 3);      // le vol déclenche le complice
    const pret = __G.coup.etat;
    __G.P.pos.set(c.x + 1.5, 0.4, c.z + 1.5);
    __G.coupMonter();
    const fuite = __G.coup.etat, cache = !__G.me.group.visible;
    const sous = __G.wallet;
    let n = 0; while (__G.coup.etat === 'fuite' && n < 60000) { __G.coupTick(1 / 60); n++; }
    const arrive = Math.hypot(__G.P.pos.x - 48, __G.P.pos.z - 184);
    return { pasAmi, etatApresRefus, traite, attente, complice, pret, fuite, cache,
      arrive: +arrive.toFixed(1), fin: __G.coup.etat, wanted: __G.police.wanted, gain: __G.wallet - sous, secondes: +(n / 60).toFixed(0) };
  });
  const ok = !r.pasAmi && r.etatApresRefus === 'aucun' && r.traite && r.attente === 'attente' && r.pret === 'pret'
    && r.fuite === 'fuite' && r.cache && r.arrive < 6 && r.fin === 'aucun' && r.wanted === 0 && r.gain > 0;
  return { ok, detail: `refusé à un non-ami=${!r.pasAmi} · ${r.complice} attend au volant → braquage → embarquement → ${r.secondes} s de fuite, arrivée à ${r.arrive} m de la villa · recherché remis à ${r.wanted}, butin +${r.gain} 🪙` };
});


test('la caméra se rapproche dans une pièce et devant un objet', async p => {
  // la distance de caméra glisse doucement : on attend qu'elle se stabilise
  const lis = async cond => { await attendre(p, cond, 40000); return p.evaluate(() => ({ dedans: __G.cam.dedans, dist: +__G.cam.dist.toFixed(2), inter: !!__G.city.interact })); };
  await p.evaluate(() => __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 }));   // en pleine rue
  const dehors = await lis(() => __G.cam.dist > 7.5);
  await p.evaluate(() => __SHOT.go({ world: 4, x: -35.5, y: 1, z: -27, hour: 12 }));   // hall d'immeuble
  const dedans = await lis(() => __G.cam.dist < 4.2);
  await p.evaluate(() => { __SHOT.go({ world: 4, x: 70, y: 1, z: 158, hour: 12 }); });   // devant le frigo de la villa
  const frigo = await lis(() => !!__G.city.interact && __G.cam.dist < 3.6);
  // le point visé rattrape le joueur par interpolation : on attend qu'il l'ait rejoint
  await attendre(p, () => Math.hypot(__G.cam.target.x - __G.P.pos.x, __G.cam.target.z - __G.P.pos.z) < 1.5, 30000);
  const cible = await p.evaluate(() => ({ dx: +(__G.cam.target.x - __G.P.pos.x).toFixed(2), dz: +(__G.cam.target.z - __G.P.pos.z).toFixed(2) }));
  await p.evaluate(() => __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 }));
  const retour = await lis(() => __G.cam.dist > 7.5);
  const ok = !dehors.dedans && dehors.dist > 7 && dedans.dedans && dedans.dist < 4.2
    && frigo.inter && frigo.dist < dedans.dist + 0.1 && (Math.abs(cible.dx) + Math.abs(cible.dz)) > 0.1 && retour.dist > 7;
  return { ok, detail: `rue : ${dehors.dist} m · hall d'immeuble : ${dedans.dist} m · devant le frigo : ${frigo.dist} m (objet cadré, décalage ${cible.dx}/${cible.dz}) · de retour dehors : ${retour.dist} m` };
});

test('on pose la déco où on veut, et on peut la reprendre', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 165, hour: 12 });
    __G.city.placed.slice().forEach(o => __G.retirerDeco(o, true));
    // un fauteuil posé à l'endroit exact où regarde le joueur
    __G.P.deco = { id: 'fauteuil', n: 'Fauteuil', wallOnly: false };
    __G.P.decoMesh = __G.decorMesh('fauteuil'); __G.worldGroup.add(__G.P.decoMesh);
    __G.P.pos.set(58, 0.3, 166); __G.P.facing = 0;
    __G.parcelTick(0.016);
    const vise = { x: +__G.city.pose.x.toFixed(2), z: +__G.city.pose.z.toFixed(2), ok: __G.city.pose.ok };
    __G.dropDecor();
    const o = __G.city.placed[0];
    const pose1 = o ? { id: o.id, x: +o.x.toFixed(2), z: +o.z.toFixed(2), mur: o.mur } : null;
    const assise = __G.city.benches.some(b => b.deco && Math.abs(b.x - o.x) < 0.01);
    // deuxième pose, ailleurs : les deux coexistent (plus d'emplacements imposés)
    __G.P.deco = { id: 'plante', n: 'Plante', wallOnly: false };
    __G.P.decoMesh = __G.decorMesh('plante'); __G.worldGroup.add(__G.P.decoMesh);
    __G.P.pos.set(64, 0.3, 160); __G.P.facing = Math.PI / 2;
    __G.parcelTick(0.016); __G.dropDecor();
    const deux = __G.city.placed.length;
    // sauvegarde puis rechargement : les positions libres sont conservées
    const sauve = JSON.parse(__G.store.json('superobby.decor', '[]') === '[]' ? '[]' : JSON.stringify(__G.store.json('superobby.decor', [])));
    __G.loadDecor();
    const apres = __G.city.placed.map(d => ({ id: d.id, x: +d.x.toFixed(2), z: +d.z.toFixed(2) }));
    // on reprend le premier en main
    __G.P.pos.set(apres[0].x, 0.3, apres[0].z); __G.P.deco = null;
    __G.parcelTick(0.016);
    const proche = !!__G.city.decoNear;
    __G.reprendreDeco(__G.city.decoNear);
    const enMain = __G.P.deco && __G.P.deco.id, reste = __G.city.placed.length;
    __G.P.deco = null; if (__G.P.decoMesh) __G.worldGroup.remove(__G.P.decoMesh); __G.P.decoMesh = null;
    __G.city.placed.slice().forEach(o2 => __G.retirerDeco(o2, true));
    return { vise, pose1, assise, deux, sauve: sauve.length, apres, proche, enMain, reste };
  });
  const colle = r.pose1 && Math.abs(r.pose1.x - r.vise.x) < 0.01 && Math.abs(r.pose1.z - r.vise.z) < 0.01;
  const ok = colle && r.deux === 2 && r.sauve === 2 && r.apres.length === 2 && r.proche && r.enMain === 'fauteuil' && r.reste === 1 && r.assise;
  return { ok, detail: `posé exactement où le joueur visait (${r.pose1 ? r.pose1.x + ', ' + r.pose1.z : '—'})=${colle} · deux objets libres coexistent (${r.deux}) · sauvegardés et rechargés (${r.apres.length}) · repris en main=${r.enMain}, il en reste ${r.reste} · on peut s'asseoir dessus=${r.assise}` };
});

test('un cadre s\'accroche au mur le plus proche', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 165, hour: 12 });
    __G.city.placed.slice().forEach(o => __G.retirerDeco(o, true));
    __G.P.deco = { id: 'tableau', n: 'Tableau', wallOnly: true };
    __G.P.decoMesh = __G.decorMesh('tableau'); __G.worldGroup.add(__G.P.decoMesh);
    // loin de tout mur : refus
    __G.P.pos.set(60, 0.3, 180); __G.P.facing = 0;
    __G.parcelTick(0.016);
    const loin = __G.city.pose.ok;
    __G.dropDecor();
    const rienPose = __G.city.placed.length;
    // face au mur nord du séjour : accroché
    __G.P.pos.set(56, 0.3, 156.8); __G.P.facing = Math.PI;
    __G.parcelTick(0.016);
    const pres = __G.city.pose.ok;
    __G.dropDecor();
    const o = __G.city.placed[0];
    const res = o ? { mur: o.mur, y: +o.y.toFixed(2), ry: +o.ry.toFixed(2), sansCollision: !o.solide } : null;
    __G.city.placed.slice().forEach(x => __G.retirerDeco(x, true));
    __G.P.deco = null; if (__G.P.decoMesh) __G.worldGroup.remove(__G.P.decoMesh); __G.P.decoMesh = null;
    return { loin, rienPose, pres, res };
  });
  const ok = !r.loin && r.rienPose === 0 && r.pres && r.res && r.res.mur && r.res.y > 1.5 && r.res.sansCollision;
  return { ok, detail: `loin d'un mur : refusé (${r.rienPose} objet posé) · face au mur : accroché à ${r.res ? r.res.y : '—'} m, orientation ${r.res ? r.res.ry : '—'}, sans volume de collision` };
});

test('le micro existe et une phrase dite déclenche la même commande', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 6, hour: 12 });
    __G.amis.clear(); __G.amis.add('Lucas_2014');
    const b = __G.bots[0]; b.rdv = null; b.drive = null;
    const dispo = !!__G.micro && __G.micro.dispo;
    const bouton = !!document.getElementById('micBtn');
    __G.micro.envoyer('Lucas_2014 rendez-vous au parc à côté des balançoires');
    const rdv = b.rdv ? b.rdv.nom : null;
    const dansLeChat = document.getElementById('chatLog').textContent.includes('balançoires');
    b.rdv = null;
    return { dispo, bouton, rdv, dansLeChat };
  });
  const ok = r.bouton && r.rdv && r.dansLeChat;
  return { ok, detail: `bouton 🎤 présent=${r.bouton} · reconnaissance vocale du navigateur=${r.dispo} · la phrase dite apparaît dans le chat=${r.dansLeChat} et fixe le rendez-vous « ${r.rdv} »` };
});

test('un ami prend une voiture, vient te chercher et te conduit', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -40, y: 1, z: 70, hour: 12 });
    __G.amis.clear(); __G.amis.add('Nathan_pro');
    const b = __G.bots.find(x => x.name === 'Nathan_pro');
    b.drive = null; b.rdv = null; b.ko = 0; b.wait = 0; b.fight = null;
    b.pos.set(-20, 0.3, 40); b.av.group.position.copy(b.pos);
    const ordre = __G.commandeSociale('Nathan_pro prends une voiture et viens me retrouver devant la banque');
    const dest = b.rdv && b.rdv.auto ? [Math.round(b.rdv.auto.tx), Math.round(b.rdv.auto.tz)] : null;
    for (let i = 0; i < 6000 && !b.drive; i++) __G.updateBot(b, 1 / 30);
    const auVolant = !!b.drive;
    let n = 0; while (b.drive && b.drive.etat === 'route' && n < 120000) { __G.botDriveTick(1 / 60); n++; }
    const c = b.drive.car;
    const arrivee = Math.hypot(c.x - (dest ? dest[0] : 0), c.z - (dest ? dest[1] : 0));
    // on monte à côté de lui
    __G.P.pos.set(c.x + 2, c.y + 0.4, c.z + 2); __G.botDriveTick(1 / 60);
    const propose = __G.city.botCarNear && __G.city.botCarNear.name;
    __G.monterAvecBot(b);
    const passager = b.drive.passager, cache = !__G.me.group.visible;
    // « va à la villa »
    const ordre2 = __G.commandeSociale('Nathan_pro va à la villa');
    let m = 0; while (b.drive && b.drive.etat === 'route' && m < 120000) { __G.botDriveTick(1 / 60); m++; }
    const dVilla = Math.hypot(__G.P.pos.x - 48, __G.P.pos.z - 190);
    const suit = Math.hypot(__G.P.pos.x - b.drive.car.x, __G.P.pos.z - b.drive.car.z);
    __G.botDescendre(b, false);
    const descendu = !b.drive && __G.me.group.visible;
    return { ordre, dest, auVolant, arrivee: +arrivee.toFixed(1), propose, passager, cache, ordre2,
      dVilla: +dVilla.toFixed(1), suit: +suit.toFixed(2), descendu, s1: +(n / 60).toFixed(0), s2: +(m / 60).toFixed(0) };
  });
  const ok = r.ordre && r.dest && r.auVolant && r.arrivee < 9 && r.propose === 'Nathan_pro' && r.passager && r.cache
    && r.ordre2 && r.dVilla < 9 && r.suit < 0.5 && r.descendu;
  return { ok, detail: `« prends une voiture et viens devant la banque » → au volant en ${r.s1} s, garé à ${r.arrivee} m · montée proposée (${r.propose}) · « va à la villa » → ${r.s2} s, arrivé à ${r.dVilla} m de l'allée (le joueur reste à bord, ${r.suit} m) · descente OK` };
});


test('le chien est bien assis dans la voiture, pattes à l\'intérieur', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 10, hour: 12 });
    __G.chien.pet = null; __G.chien.nom = 'Rex';
    __G.adopterChien(__G.city.pets.find(x => x.kind === 'dog'), true);
    const c = __G.city.cars.find(v => !v.heli && !v.kind);
    __G.P.pos.set(c.x, c.y + 0.4, c.z); __G.enterCar(c);
    for (let i = 0; i < 60; i++) __G.chienTick(1 / 60);
    const d = __G.chien.pet;
    // le chien mesure ~0,75 m : ses pattes doivent rester au-dessus du bas de caisse
    const pattes = d.y - c.y, tete = d.y - c.y + 0.8;
    const dedans = Math.hypot(d.x - c.x, d.z - c.z);
    __G.exitCar();
    return { pattes: +pattes.toFixed(2), tete: +tete.toFixed(2), dedans: +dedans.toFixed(2) };
  });
  // caisse de la voiture : 0,32 → 0,88 ; vitres : 1,16 → 1,64
  const ok = r.pattes > 0.3 && r.pattes < 0.7 && r.tete > 1.1 && r.tete < 1.7 && r.dedans < 1.2;
  return { ok, detail: `pattes à ${r.pattes} m du plancher (caisse à partir de 0,32) · tête à ${r.tete} m (vitres 1,16 → 1,64) · à ${r.dedans} m du centre de la voiture` };
});

test('le cinéma a beaucoup de films variés qui ne repassent pas en boucle', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 90, hour: 20 });
    const ci = __G.city.cinema;
    let err = null, images = 0;
    for (const f of __G.FILMS) { for (let u = 0; u < f.d; u += 0.25) { try { f.f(ci.g, 320, 180, u); images++; } catch (e) { err = f.n + ' : ' + e.message; break; } } if (err) break; }
    ci.sac = []; const a = []; for (let k = 0; k < __G.FILMS.length; k++) { __G.filmSuivant(ci); a.push(ci.i); }
    const b = []; for (let k = 0; k < __G.FILMS.length; k++) { __G.filmSuivant(ci); b.push(ci.i); }
    return { n: __G.FILMS.length, genres: [...new Set(__G.FILMS.map(f => f.genre))], images, err,
      distincts: new Set(a).size, memeOrdre: a.join() === b.join(), duree: Math.round(__G.FILMS.reduce((t, f) => t + f.d, 0)) };
  });
  const ok = !r.err && r.n >= 14 && r.genres.length >= 6 && r.distincts === r.n && !r.memeOrdre;
  return { ok, detail: `${r.n} films · ${r.genres.length} genres (${r.genres.join(', ')}) · ${r.duree} s de programme · ${r.images} images dessinées sans erreur · ${r.distincts}/${r.n} films distincts avant de reboucler, ordre différent au tour suivant=${!r.memeOrdre}` };
});

test('double appui sur avancer : on court, on s\'épuise, on récupère', async p => {
  await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 }); __G.P.energie = 100; __G.P.essouffle = false; __G.P.run = false;
    // l'essoufflement est bref (la jauge remonte aussitôt) : on le guette image par image,
    // sinon un sondage toutes les 250 ms peut passer à côté.
    const s = window.__souffle = { vu: false, coupe: false, mini: 100, couru: 0 };
    const h = () => { s.mini = Math.min(s.mini, __G.P.energie); if (__G.P.court) s.couru++;
      if (__G.P.essouffle) { s.vu = true; s.coupe = s.coupe || !__G.P.run; } requestAnimationFrame(h); };
    requestAnimationFrame(h);
  });
  await p.waitForTimeout(500);
  const etat = await p.evaluate(() => ({ jeu: __G.running, pause: __G.paused, ui: __G.uiOpen,
    volant: !!__G.drive.car, focus: (document.activeElement || {}).id || '' }));
  // double appui rapide sur « avancer »
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(90);
  await p.keyboard.down('ArrowUp');
  const court = await attendre(p, () => __G.P.run && __G.P.court, 20000);
  const vite = await p.evaluate(() => ({ court: __G.P.court, e: Math.round(__G.P.energie) }));
  // le temps simulé avance lentement en rendu logiciel : on amorce la jauge au lieu
  // d'attendre les six secondes de course
  await p.evaluate(() => { window.__souffle.vu = false; window.__souffle.coupe = false; window.__souffle.mini = 100; __G.P.energie = 4; });
  const vide = await attendre(p, () => window.__souffle.vu, 40000);
  const apres = await p.evaluate(() => ({ vu: window.__souffle.vu, coupe: window.__souffle.coupe,
    mini: +window.__souffle.mini.toFixed(1), couru: window.__souffle.couru }));
  await p.keyboard.up('ArrowUp');
  await p.evaluate(() => { __G.P.energie = 42; });
  const recup = await attendre(p, () => !__G.P.essouffle && __G.P.energie > 46, 40000);
  const fin = await p.evaluate(() => ({ e: Math.round(__G.P.energie), essouffle: __G.P.essouffle }));
  return { ok: court && vite.court && vide && apres.vu && apres.coupe && recup && !fin.essouffle,
    detail: `état : ${JSON.stringify(etat)} · double appui → course (énergie ${vite.e} %, ${apres.couru} images de course) · jauge tombée à ${apres.mini} % : essoufflé=${apres.vu}, course coupée=${apres.coupe} · après repos : ${fin.e} % et on peut recourir` };
});

test('la nuit des zombies démarre depuis la prison avec son décor', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    __G.jail.on = true;
    __G.zombieStart(1);
    const z = __G.zombie, kinds = {};
    z.zoms.forEach(o => { kinds[o.kind] = (kinds[o.kind] || 0) + 1; });
    const dep = Math.hypot(__G.P.pos.x - __G.police.station.x, __G.P.pos.z - (__G.police.station.z - 13));
    __G.zombieTick(1 / 60);
    return { on: z.on, zoms: z.zoms.length, kinds, deco: z.deco.length, chauves: (z.bats || []).length,
      arme: __G.P.weapon, dep: +dep.toFixed(1), but: z.but, neige: __G.meteo.kind, lune: !!(z.lune && z.lune.visible),
      horloge: document.getElementById('clock').textContent, niveaux: __G.ZOM_NIV.length,
      bots: __G.bots.every(b => b.av.mats.skin.color.getHex() === 0x86a86a) };
  });
  const ok = r.on && r.zoms >= 30 && r.kinds.lent > 0 && r.kinds.rapide > 0 && r.kinds.immobile > 0
    && r.deco > 60 && r.chauves > 6 && r.arme === 'pistol' && r.dep < 2 && r.neige === 'neige' && r.lune
    && r.niveaux === 3 && r.bots && r.horloge.includes('zombie');
  return { ok, detail: `${r.zoms} zombies (${r.kinds.lent} lents, ${r.kinds.immobile} immobiles, ${r.kinds.rapide} rapides) · ${r.deco} décors + ${r.chauves} chauves-souris · départ au commissariat (${r.dep} m), objectif ${r.but} · neige=${r.neige}, pleine lune=${r.lune} · les bots sont devenus verts=${r.bots} · ${r.niveaux} difficultés` };
});

test('le zombie rapide attrape le marcheur mais pas le coureur', async p => {
  const r = await p.evaluate(() => {
    const z = __G.zombie;
    const r2 = z.zoms.find(o => o.kind === 'rapide' && !o.mort);
    z.zoms = [r2];   // un seul zombie pour mesurer proprement
    __G.P.pos.set(0, 0.4, 40); r2.x = 8; r2.z = 40; r2.y = __G.P.pos.y; r2.chasse = false; r2.cd = 0;
    __G.P.court = false; __G.P.devore = false; z.mange = null; __G.P.vel.set(1.5, 0, 0);
    for (let i = 0; i < 150; i++) __G.zombieTick(1 / 60);
    const marche = { chasse: r2.chasse, pris: !!z.mange, d: +Math.hypot(r2.x - __G.P.pos.x, r2.z - __G.P.pos.z).toFixed(2) };
    z.mange = null; __G.P.devore = false; r2.cd = 0; r2.x = __G.P.pos.x + 1; r2.z = __G.P.pos.z;
    __G.P.court = true;
    for (let i = 0; i < 240; i++) __G.zombieTick(1 / 60);
    const course = { pris: !!z.mange, d: +Math.hypot(r2.x - __G.P.pos.x, r2.z - __G.P.pos.z).toFixed(2) };
    z.mange = null; __G.P.devore = false; __G.P.court = false;
    return { marche, course };
  });
  const ok = r.marche.chasse && r.marche.pris && !r.course.pris;
  return { ok, detail: `au pas : repéré=${r.marche.chasse}, attrapé=${r.marche.pris} (à ${r.marche.d} m) · en courant : attrapé=${r.course.pris} même collé à ${r.course.d} m` };
});

test('trois balles dans le corps ou une seule dans la tête', async p => {
  const r = await p.evaluate(() => {
    __G.zombieFin(false); __G.jail.on = true; __G.zombieStart(1);
    const z = __G.zombie; z.mange = null; __G.P.devore = false;
    __G.P.pos.set(0, 0.4, 40);
    const a = z.zoms.find(o => !o.mort), b = z.zoms.filter(o => !o.mort && o !== a)[0];
    const tirer = (cible, hy) => { cible.x = __G.P.pos.x; cible.z = __G.P.pos.z + 6; cible.y = __G.P.pos.y;
      const s = { m: null, p: new __G.THREE.Vector3(__G.P.pos.x, __G.P.pos.y + 1, __G.P.pos.z),
        v: new __G.THREE.Vector3(0, (cible.y + hy - (__G.P.pos.y + 1)) / 6 * 95, 95), t: 0, mine: true, dmg: 24 };
      __G.shots.push(s); __G.spawnShot(s); for (let i = 0; i < 40; i++) __G.shotsTick(1 / 120); };
    a.hp = 3; a.mort = false; b.hp = 3; b.mort = false;
    tirer(a, 0.9); const un = a.hp, mort1 = a.mort;
    tirer(a, 0.9); tirer(a, 0.9); const mort3 = a.mort;
    b.x = 1e5; tirer(b, 0);   // on écarte l'autre pendant les tirs sur a
    b.hp = 3; b.mort = false;
    tirer(b, 1.72); const tete = b.mort;
    return { un, mort1, mort3, tete, tues: z.tues };
  });
  const ok = r.un === 2 && !r.mort1 && r.mort3 && r.tete;
  return { ok, detail: `1 balle dans le corps : 3 → ${r.un} points, encore debout=${!r.mort1} · abattu à la 3ᵉ=${r.mort3} · abattu d'une seule balle dans la tête=${r.tete}` };
});

test('atteindre la villa libère de prison et remet tout en ordre', async p => {
  const r = await p.evaluate(() => {
    if (!__G.zombie.on) { __G.jail.on = true; __G.zombieStart(1); }
    __G.jail.on = true;
    const avant = { zoms: __G.zombie.zoms.length, deco: __G.zombie.deco.length, sous: __G.wallet };
    __G.P.pos.set(60, 0.4, 168); __G.P.devore = false; __G.zombie.mange = null;
    __G.zombieTick(1 / 60);
    const skin = __G.bots.map(b => b.av.mats.skin.color.getHex());
    return { avant, on: __G.zombie.on, jail: __G.jail.on, zoms: __G.zombie.zoms.length, deco: __G.zombie.deco.length,
      gain: __G.wallet - avant.sous, peau: skin.every(h => h === 0xf5c39a), lune: !!(__G.zombie.lune && __G.zombie.lune.visible),
      tags: __G.bots.every(b => b.av.tag.visible), meteo: __G.meteo.kind };
  });
  const ok = !r.on && !r.jail && r.zoms === 0 && r.deco === 0 && r.gain > 0 && r.peau && !r.lune && r.tags && r.meteo === 'clair';
  return { ok, detail: `${r.avant.zoms} zombies et ${r.avant.deco} décors retirés · sorti de prison=${!r.jail} · prime +${r.gain} 🪙 · bots redevenus normaux (peau=${r.peau}, noms=${r.tags}) · lune éteinte, météo « ${r.meteo} »` };
});

test('la caméra colle aux murs sans les traverser, et se baisse sous les plafonds bas', async p => {
  const lis = async (x, y, z, cond) => {
    await p.evaluate(v => { __SHOT.go({ world: 4, x: v.x, y: v.y, z: v.z, hour: 12 }); }, { x, y, z });
    await attendre(p, cond, 25000);
    return p.evaluate(() => {
      const c = __G.camera.position, dedansMur = __G.solids.some(o => !o.veh && o.h < 30
        && Math.abs(c.x - o.x) < o.w / 2 && Math.abs(c.y - o.y) < o.h / 2 && Math.abs(c.z - o.z) < o.d / 2);
      return { dist: +__G.cam.dist.toFixed(2), libre: __G.cam.libre == null ? null : +__G.cam.libre.toFixed(2),
        salle: __G.cam.salle == null ? null : +__G.cam.salle.toFixed(1), plafond: __G.cam.plafond == null ? null : +__G.cam.plafond.toFixed(1),
        pitch: +__G.cam.pitch.toFixed(2), dedansMur, y: +c.y.toFixed(2) };
    });
  };
  await p.evaluate(() => { __G.cam.pitch = 0.6; });
  const rue = await lis(0, 1, 40, () => __G.cam.dist > 6);
  const cuisine = await lis(70, 1, 158, () => __G.cam.dist < 4);
  await p.evaluate(() => { __G.cam.pitch = 0.6; });
  await p.waitForTimeout(900);
  const basPlafond = await p.evaluate(() => ({ pitch: +__G.cam.pitch.toFixed(2), plafond: +(__G.cam.plafond || 9).toFixed(1) }));
  const retour = await lis(0, 1, 40, () => __G.cam.dist > 6);
  const ok = !rue.dedansMur && !cuisine.dedansMur && !retour.dedansMur
    && cuisine.dist < rue.dist - 2 && cuisine.plafond < 3.2 && basPlafond.pitch < 0.42 && cuisine.libre != null && retour.dist > 6;
  return { ok, detail: `rue : ${rue.dist} m (place ${rue.salle} m, plafond ${rue.plafond}) · cuisine de la villa : ${cuisine.dist} m (place ${cuisine.salle} m, plafond ${cuisine.plafond} m, libre ${cuisine.libre} m) · plafond bas : inclinaison ramenée à ${basPlafond.pitch} · caméra dans un mur : ${rue.dedansMur || cuisine.dedansMur || retour.dedansMur}` };
});

test('« Nathan viens devant l\'hélicoptère » : il vient à côté du joueur et s\'arrête', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 52, y: 1, z: -13, hour: 12 });   // héliport
    __G.P.pos.set(52, 0.3, -13);
    __G.amis.clear(); __G.amis.add('Lucas_2014');
    const b = __G.bots[0]; b.rdv = null; b.ko = 0; b.fight = null; b.wait = 0; b.drive = null;
    b.pos.set(20, 0.3, 20); b.av.group.position.copy(b.pos);
    const lieu = __G.lieuDe("Lucas_2014 viens devant l'hélicoptère");
    const traite = __G.commandeSociale("Lucas_2014 viens devant l'hélicoptère");
    const suit = !!(b.rdv && b.rdv.suit);
    const d0 = Math.hypot(b.pos.x - __G.P.pos.x, b.pos.z - __G.P.pos.z);
    for (let i = 0; i < 3000; i++) __G.updateBot(b, 1 / 30);
    const d1 = Math.hypot(b.pos.x - __G.P.pos.x, b.pos.z - __G.P.pos.z);
    const arrive = !!(b.rdv && b.rdv.arrive);
    // il s'arrête : 5 s plus tard il est toujours à côté
    for (let i = 0; i < 150; i++) __G.updateBot(b, 1 / 30);
    const d2 = Math.hypot(b.pos.x - __G.P.pos.x, b.pos.z - __G.P.pos.z);
    // et le lieu seul reste compris
    const helipo = __G.lieuDe('va à l\'hélicoptère');
    b.rdv = null;
    return { traite, suit, lieu: lieu && lieu.nom, d0: +d0.toFixed(1), d1: +d1.toFixed(1), d2: +d2.toFixed(1), arrive, helipo: helipo && helipo.nom };
  });
  const ok = r.traite && r.suit && r.lieu === '🚁 Héliport' && r.d1 < 3.5 && r.d2 < 4 && r.arrive;
  return { ok, detail: `lieu reconnu : ${r.lieu} · le bot part de ${r.d0} m, arrive à ${r.d1} m et reste à ${r.d2} m (annonce=${r.arrive})` };
});

test('les véhicules ne se chevauchent plus', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    const gros = __G.city.cars.filter(c => !c.heli && !c.rider && (c.baseD || 4.4) > 4);
    const a = gros[0], b = gros[1];
    b.h = a.h = 0; b.x = a.x + 0.6; b.z = a.z; b.y = a.y; b.g.position.set(b.x, b.y, b.z);
    const chevauche = v => (v[0].solid.w + v[1].solid.w) / 2 - Math.abs(v[0].x - v[1].x) > 0 && (v[0].solid.d + v[1].solid.d) / 2 - Math.abs(v[0].z - v[1].z) > 0;
    const avant = chevauche([a, b]);
    for (let i = 0; i < 10; i++) __G.separerVehicules();
    const apres = chevauche([a, b]), ecart = Math.hypot(a.x - b.x, a.z - b.z);
    // trafic : toutes les voitures au même endroit de l'anneau, elles doivent s'espacer
    const ai = __G.city.aiCars.filter(c => c.spd);
    ai.forEach((c, i) => { c.s = 40 + i * 0.5; });
    for (let i = 0; i < 600; i++) __G.cityStep(1 / 60);
    let pire = 99;
    for (let i = 0; i < ai.length; i++) for (let j = i + 1; j < ai.length; j++) pire = Math.min(pire, Math.hypot(ai[i].x - ai[j].x, ai[i].z - ai[j].z));
    return { avant, apres, ecart: +ecart.toFixed(2), ai: ai.length, pire: +pire.toFixed(2) };
  });
  const ok = r.avant && !r.apres && r.ecart > 2 && r.pire > 4;
  return { ok, detail: `deux voitures posées l'une sur l'autre : chevauchement ${r.avant} → ${r.apres} (écart ${r.ecart} m) · ${r.ai} voitures du trafic lâchées au même point : la plus courte distance reste ${r.pire} m` };
});

test('une voiture lancée en biais dans un mur ne le traverse pas', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -34, y: 1, z: 64, hour: 12 });
    // mur est de la banque : x = -42,2 (épaisseur 0,4), de z = 60 à 68
    const mur = __G.solids.find(o => Math.abs(o.x + 42.2) < 0.3 && o.d > 7 && o.d < 9 && o.h > 10 && Math.abs(o.z - 64) < 1);
    const c = __G.city.cars.find(v => !v.heli && !v.rider && (v.baseD || 4.4) > 4);
    c.x = -34; c.z = 56; c.y = 0; c.h = Math.atan2(-1, 1) * 1;   // 45° vers le mur (ouest-nord)
    c.g.position.set(c.x, 0, c.z); __G.enterCar(c); __G.drive.speed = 26;
    let pire = 0;
    for (let i = 0; i < 240; i++) {
      __G.drive.speed = Math.max(__G.drive.speed, 18);
      __G.driveStep(1 / 60);
      const cs = Math.cos(c.h), sn = Math.sin(c.h), A = (c.baseD || 4.4) / 2, B = (c.baseW || 2.4) / 2;
      for (const [lx, lz] of [[B, A], [-B, A], [B, -A], [-B, -A]]) {
        const x = c.x + lx * cs + lz * sn, z = c.z - lx * sn + lz * cs;
        const dx = mur.w / 2 - Math.abs(x - mur.x), dz = mur.d / 2 - Math.abs(z - mur.z);
        if (dx > 0 && dz > 0) pire = Math.max(pire, Math.min(dx, dz));
      }
    }
    const fin = { x: +c.x.toFixed(2), z: +c.z.toFixed(2) };
    __G.exitCar();
    return { pire: +pire.toFixed(2), fin, mur: mur ? { x: mur.x, w: mur.w } : null };
  });
  const ok = !!r.mur && r.pire < 0.06 && r.fin.x > -42;
  return { ok, detail: `enfoncement maximal d'un coin dans le mur : ${r.pire} m (mur en x = ${r.mur ? r.mur.x : '?'}) · la voiture s'arrête en x = ${r.fin.x}` };
});

test('braquage : la police descend de voiture, entre dans la banque et monte aux coffres', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -57, y: 10.2, z: 70, hour: 12 });
    __G.P.pos.set(-57, 10.05, 70);
    const t0 = __G.simTime;
    __G.bankAlarm();
    const etapes = { agents: 0, entres: 0, etage: 0 };
    let arrete = null;
    for (let i = 0; i < 3600; i++) {
      __G.simTime = t0 + i / 30; __G.P.pos.set(-57, 10.05, 70); __G.policeTick(1 / 30);
      etapes.agents = Math.max(etapes.agents, __G.police.agents.length);
      etapes.entres = Math.max(etapes.entres, __G.police.agents.filter(a => Math.abs(a.x + 52) < 9 && Math.abs(a.z - 70) < 9).length);
      etapes.etage = Math.max(etapes.etage, ...__G.police.agents.map(a => a.y));
      if (__G.jail.on) { arrete = +(i / 30).toFixed(1); break; }
    }
    const jail = __G.jail.on; __G.jail.on = false; __G.clearWanted();
    return { agents: etapes.agents, entres: etapes.entres, etage: +etapes.etage.toFixed(1), arrete, jail, restants: __G.police.agents.length };
  });
  const ok = r.agents >= 2 && r.entres >= 1 && r.etage > 8 && r.jail && r.arrete < 90 && r.restants === 0;
  return { ok, detail: `${r.agents} agents à pied, ${r.entres} entrés dans la banque, montés jusqu'à ${r.etage} m (coffres à 9,9) · arrestation à ${r.arrete} s · agents retirés à la fin=${r.restants === 0}` };
});

test('caché dans un bâtiment, la police ne t\'arrête pas — sauf si elle t\'a vu entrer', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 70, y: 1, z: 158, hour: 12 });   // cuisine de la villa
    __G.P.pos.set(70, 0.3, 158);
    const t0 = __G.simTime;
    const poser = () => { __G.police.wanted = 3; __G.police.crimeLevel = 3; __G.police.decayT = t0 + 9999;
      __G.police.hideT = 0; __G.police.villaT = 0; __G.police.sait = null; __G.police.vuT = -99; __G.police.coffres = 3;
      __G.police.cars.forEach(c => { c.active = true; c.debarque = false; c.nearT = 0; c.x = 70; c.z = 166; c.y = 0; }); };
    poser();
    __G.cam.dedansT = -1;   // le test de toit est mis en cache 1/4 de seconde
    const abri = __G.abriDuJoueur();
    let jail1 = false;
    for (let i = 0; i < 1200; i++) { __G.simTime = t0 + i / 30; __G.P.pos.set(70, 0.3, 158); __G.policeTick(1 / 30); if (__G.jail.on) { jail1 = true; break; } }
    const agents1 = __G.police.agents.length;
    // maintenant ils t'ont vu entrer : ils descendent et viennent te chercher
    const t1 = __G.simTime;
    __G.police.wanted = 3; __G.police.crimeLevel = 3; __G.police.decayT = t1 + 9999; __G.police.vuT = t1; __G.police.villaT = 0;
    __G.police.cars.forEach(c => { c.active = true; c.debarque = false; c.nearT = 0; c.x = 70; c.z = 166; c.y = 0; });
    __G.policeInvestit([70, 158], 'test');
    const agents2 = __G.police.agents.length;
    let dmin = 99;
    for (let i = 0; i < 1500; i++) {
      __G.simTime = t1 + i / 30; __G.P.pos.set(70, 0.3, 158); __G.policeTick(1 / 30);
      for (const a of __G.police.agents) dmin = Math.min(dmin, Math.hypot(a.x - 70, a.z - 158));
      if (__G.jail.on) break;
    }
    const jail2 = __G.jail.on;
    __G.jail.on = false; __G.clearWanted();
    return { abri, jail1, agents1, agents2, dmin: +dmin.toFixed(1), jail2 };
  });
  const ok = r.abri === 'batiment' && !r.jail1 && r.agents1 === 0 && r.agents2 >= 2 && r.dmin < 6;
  return { ok, detail: `à couvert (${r.abri}) sans avoir été vu : arrêté=${r.jail1}, agents envoyés=${r.agents1} · vu en train d'entrer : ${r.agents2} agents descendent et s'approchent à ${r.dmin} m (arrêté=${r.jail2})` };
});

test('un coffre vaut 500 🪙 et se réfugier dans sa villa sauve le butin', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -59, y: 10.2, z: 64, hour: 12 });
    const sf = __G.city.safes[0];
    sf.open = false; sf.progress = 0.99;
    const avant = __G.wallet;
    __G.P.pos.set(sf.x, 10.05, sf.z);
    __G.city.safeNear = sf; __G.keys.add('KeyE');
    __G.safesTick(1 / 30);
    __G.keys.delete('KeyE'); __G.city.safeNear = null;
    const gain = __G.wallet - avant, coffres = __G.police.coffres;
    // fuite jusqu'à la villa : plus on a de coffres, plus il faut tenir
    const mesure = n => {
      __G.police.coffres = n; __G.police.wanted = 3; __G.police.crimeLevel = 3; __G.police.sait = null;
      __G.police.vuT = -99; __G.police.villaT = 0; __G.police.hideT = 0; __G.police.agents = [];
      const t0 = __G.simTime; __G.police.decayT = t0 + 9999;
      __G.police.cars.forEach(c => { c.active = true; c.debarque = false; c.x = 70; c.z = 172; });
      for (let i = 0; i < 3000; i++) {
        __G.simTime = t0 + i / 30; __G.P.pos.set(70, 0.3, 158); __G.policeTick(1 / 30);
        if (__G.police.wanted === 0) return +(i / 30).toFixed(1);
      }
      return null;
    };
    __G.P.pos.set(70, 0.3, 158);
    const un = mesure(1), deux = mesure(2), trois = mesure(3);
    __G.police.coffres = 0; __G.clearWanted();
    return { gain, coffres, un, deux, trois };
  });
  const ok = r.gain === 500 && r.coffres === 1 && r.un && r.deux && r.trois && r.deux > r.un && r.trois > r.deux;
  return { ok, detail: `coffre forcé : +${r.gain} 🪙 (${r.coffres} coffre au compteur) · temps à tenir dans la villa : ${r.un} s avec 1 coffre, ${r.deux} s avec 2, ${r.trois} s avec 3` };
});

test('abattre un policier déclenche l\'armée : 4×4, hélicoptère et projecteur', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.P.pos.set(0, 0.3, 40);
    const t0 = __G.simTime;
    __G.police.wanted = 2; __G.police.crimeLevel = 2; __G.police.decayT = t0 + 999;
    const a = __G.creerAgent(4, 40, 0.3, false);
    const pv = a.hp;
    // trois balles dans l'agent
    let coups = 0;
    for (let k = 0; k < 8 && !a.ko; k++) {
      const sh = { m: null, p: new __G.THREE.Vector3(0, 1.3, 40), v: new __G.THREE.Vector3(90, 0, 0), t: 0, mine: true, dmg: 24 };
      __G.shots.push(sh); __G.spawnShot(sh); __G.shotsTick(1 / 60); coups++;
    }
    const arm = __G.armee;
    const av = { on: arm.on, heli: !!arm.heli, tache: !!arm.tache, mil: __G.police.cars.filter(c => c.mil).length,
      wanted: __G.police.wanted, texte: document.getElementById('wanted').textContent };
    // l'hélico vient tourner au-dessus du joueur et le projecteur le repère
    __G.police.lastSeen = [0, 40];
    let degats = 0;
    for (let i = 0; i < 900; i++) {
      __G.simTime = t0 + i / 30; __G.P.pos.set(0, 0.3, 40); __G.policeTick(1 / 30);
      __G.shotsTick(1 / 30);
      if (__G.P.hp < 100) { degats += 100 - __G.P.hp; __G.P.hp = 100; }   // on se soigne pour ne pas mourir pendant la mesure
    }
    const h = arm.heli;
    const dHeli = h ? +Math.hypot(h.x - 0, h.z - 40).toFixed(1) : null;
    const tirs = __G.shots.filter(s => !s.mine).length;
    degats = Math.round(degats);
    __G.P.hp = 100;
    __G.clearWanted();
    const apres = { on: arm.on, heli: !!arm.heli, mil: __G.police.cars.filter(c => c.mil).length, agents: __G.police.agents.length };
    return { coups, ko: !!a.ko, av, dHeli, tirs, degats, apres };
  });
  const ok = r.ko && r.av.on && r.av.heli && r.av.tache && r.av.mil === 4 && r.av.wanted === 3
    && r.av.texte.includes('ARMÉE') && r.dHeli != null && r.dHeli < 18 && (r.tirs > 0 || r.degats > 0)
    && !r.apres.on && r.apres.mil === 0 && r.apres.agents === 0;
  return { ok, detail: `policier abattu en ${r.coups} balles · armée déployée : ${r.av.mil} 4×4 + hélicoptère (projecteur=${r.av.tache}), niveau ${r.av.wanted}★ · l'hélico tourne à ${r.dHeli} m du joueur · ils tirent (${r.tirs} balles en vol, ${r.degats} PV perdus) · tout est nettoyé à la fin (armée=${r.apres.on}, 4×4=${r.apres.mil})` };
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
  const filtre = process.env.FILTRE ? new RegExp(process.env.FILTRE, 'i') : null;
  for(const c of CASES){
    if (filtre && !filtre.test(c.n)) continue;
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
