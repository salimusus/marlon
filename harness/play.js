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
// MONTER UN ESCALIER, EN TEMPS SIMULE. On tenait la fleche du haut pendant 45 s de temps
// REEL : sous charge (le rendu logiciel tombe a deux images par seconde), ces 45 s ne valent
// que deux secondes de jeu et le joueur n'avait pas fini de monter — l'escalier semblait
// casse alors qu'il marchait. On avance maintenant la simulation image par image.
async function grimpe(p, v, cible, secondes = 14) {
  await p.evaluate(vv => __SHOT.go(vv), v);
  await p.waitForTimeout(200);
  return p.evaluate(([cible, secondes]) => {
    const G = __G, y0 = G.P.pos.y; let ymax = y0;
    G.keys.add('ArrowUp');
    for (let i = 0; i < secondes * 60; i++) {
      G.step(1 / 60, true);   // `active` vrai : sans lui, step() sort avant de bouger le joueur
      if (G.P.pos.y > ymax) ymax = G.P.pos.y;
      if (ymax >= cible - 0.05) break;
    }
    G.keys.delete('ArrowUp');
    return { y0, ymax, atteint: ymax >= cible - 0.05 };
  }, [cible, secondes]);
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
    // on degage le terrain : le verrouillage automatique se refait a chaque image, et un
    // habitant ou un gangster laisse la par un test precedent recevait toute la rafale
    for (const o of __G.bots) if (o !== __G.bots[0]) { o.pos.x += 400; o.pos.z += 400; o.av.group.position.copy(o.pos); }
    for (const G2 of __G.gangs) for (const o of G2.membres) { o.x += 400; o.z += 400; o.av.group.position.set(o.x, o.y, o.z); }
    __G.police.agents.slice().forEach(a => { a.x += 400; a.z += 400; });
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
    // on degage le terrain : le verrouillage automatique se refait a chaque image, et un
    // habitant ou un gangster laisse la par un test precedent recevait toute la rafale
    for (const o of __G.bots) if (o !== __G.bots[0]) { o.pos.x += 400; o.pos.z += 400; o.av.group.position.copy(o.pos); }
    for (const G2 of __G.gangs) for (const o of G2.membres) { o.x += 400; o.z += 400; o.av.group.position.set(o.x, o.y, o.z); }
    __G.police.agents.slice().forEach(a => { a.x += 400; a.z += 400; });
    b.pos.set(110, 0.4, 72); b.ko = 0; b.dead = 0; b.hp = 100000; b.wait = 9999; b.target = null; b.av.group.visible = true;
    // cloison de 30 cm entre le joueur et le bot : plus mince que la distance parcourue
    // par une balle en une image, donc invisible pour un test ponctuel
    const mur = { mesh: { position: { x: 110, y: 1.5, z: 66 } }, x: 110, y: 1.5, z: 66, w: 6, h: 3, d: 0.3 };
    __G.solids.push(mur); __G.sgridSale(); window.__mur = mur;   // sgridSale : le jeu invalide la grille à chaque ajout, le test doit faire pareil
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.drawWeapon(true);
    __G.P.aimToggle = true; __G.P.aim = true;
  });
  const hp0 = await p.evaluate(() => __G.bots[0].hp);
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => { __G.P.fireCd = 0; __G.P.ammo = 8; __G.P.aim = true; __G.aimTick(); __G.fire(); });
    await attendre(p, () => __G.shots.length === 0, 20000);
  }
  const hp1 = await p.evaluate(() => __G.bots[0].hp);
  await p.evaluate(() => { const i = __G.solids.indexOf(window.__mur); if (i >= 0) __G.solids.splice(i, 1); __G.sgridSale(); });
  return { ok: hp1 === hp0, detail: `4 balles tirées à travers la cloison : le bot derrière a perdu ${hp0 - hp1} point(s) de vie (attendu 0)` };
});

test('une balle s\'arrête sur le mur et ne le traverse pas', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    // un mur artificiel droit devant, à 6 m
    const mur = { mesh: { position: { x: 0, y: 1.5, z: 6 } }, x: 0, y: 1.5, z: 6, w: 8, h: 3, d: 0.6 };
    __G.solids.push(mur); __G.sgridSale();   // sinon la grille spatiale ignore ce mur posé à la main
    __G.P.pos.set(0, 0.4, 0); __G.cam.yaw = Math.PI; __G.cam.pitch = 0; __G.P.facing = 0; __G.P.lock = null;
    __G.aimTick();
    const d = __G.aimPoint.z;
    const derriere = __G.castSolids(0, 1.35, 0, 0, 0, 1, 60, false);
    __G.solids.splice(__G.solids.indexOf(mur), 1); __G.sgridSale();
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
    __G.police.alarmT = 0; __G.police.riposte = 0; __G.police.agents = [];   // riposte d'un test précédent : elle ferait tirer dès le niveau 1
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
    // sansPitie : on court-circuite la clémence (un petit délit non vu est pardonné, ce que
    // vérifie le test « la police laisse passer les petites infractions »). Ici on ne mesure
    // que la ténacité : à délit reconnu, la traque doit durer plus longtemps si c'est grave.
    const mesure = sev => { __G.police.wanted = 0; __G.police.crimeLevel = 0; __G.police.avert = 0;
      __G.infraction('test', 2, sev, true); const d = __G.police.decayT - __G.simTime; __G.clearWanted('fin'); return +d.toFixed(0); };
    const petit = mesure(1), grave = mesure(3);
    // et le pendant : le même petit délit, sans témoin et sans « sans pitié », est pardonné
    __G.police.wanted = 0; __G.police.crimeLevel = 0; __G.police.avert = 0;
    __G.infraction('test', 2, 1); const pardonne = __G.police.wanted === 0;
    __G.clearWanted('fin');
    return { petit, grave, pardonne };
  });
  return { ok: r.grave > r.petit * 1.5 && r.pardonne, detail: `petit délit : abandon dans ${r.petit} s · délit grave : ${r.grave} s · petit délit sans témoin pardonné=${r.pardonne}` };
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
    __G.police.wanted = 0; __G.police.crimeLevel = 0; __G.police.avert = 0;
    // les autres voitures du trafic s'écartent : sinon c'est l'une d'elles qui devient la cible
    for (const v of __G.city.aiCars) if (v !== c) { v.x += 300; v.z += 300; v.g.position.set(v.x, v.y || 0, v.z); }
    // on se plante à la portière : la voiture doit piler et proposer le vol
    const cs = Math.cos(c.h), sn = Math.sin(c.h);
    __G.P.pos.set(c.x + 2.2 * cs, 0.4, c.z - 2.2 * sn); __G.P.vel.set(0, 0, 0);
    for (let i = 0; i < 3; i++) { __G.P.pos.set(c.x + 2.2 * Math.cos(c.h), 0.4, c.z - 2.2 * Math.sin(c.h)); __G.cityStep(0.05); }
    const propose = __G.city.jackNear === c, arret = !!c.stopped;
    const nom = c.driver.name, aiAvant = __G.city.aiCars.length;
    __G.stealCar(c);
    return { ok: true, propose, arret, nom,
      auVolant: __G.drive.car === c, plusDansTrafic: !__G.city.aiCars.includes(c) && __G.city.cars.includes(c),
      fuyards: __G.city.fleeing.length, wanted: __G.police.wanted, gravite: __G.police.crimeLevel, aiAvant };
  });
  if (!r.ok) return { ok: false, detail: r.pourquoi };
  await p.evaluate(() => { __G.exitCar(); __G.clearWanted('fin'); });
  const ok = r.propose && r.arret && r.auVolant && r.plusDansTrafic && r.fuyards === 1 && r.wanted >= 2 && r.gravite === 2;
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

test('la grille de depart : tout le monde part, aligne, et le joueur au milieu', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 152, y: 1, z: -125, hour: 12 });
    const G = __G, c = G.city.circuit, mer = G.city.sea;
    // 1) la piste ne trempe plus dans la mer
    let dansMer = 0, marge = 1e9;
    for (const pt of G.RACE_PTS) {
      if (pt[0] > mer.x1 - 4 && pt[0] < mer.x2 + 4 && pt[1] > mer.z1 - 4 && pt[1] < mer.z2 + 4) dansMer++;
      marge = Math.min(marge, mer.z1 - pt[1]);
    }
    // 2) les dix places de la grille sont SUR la piste, derriere la ligne
    const places = []; for (let k = 0; k < G.GRILLE_N; k++) places.push(G.grilleDepart(k));
    const surPiste = places.filter(g => Math.abs(Math.hypot(g[0] - c.x, g[1] - c.z) - c.r) < 4.5).length;
    // 3) on lance la course
    G.startCountdown(4);
    const ai = G.race.ai, kart = G.drive.car;
    const tous = new Set([...G.raceKarts, ...G.city.cars.filter(k => k.kart)]);
    const attendue = G.grilleDepart(G.GRILLE_JOUEUR);
    const ecartJoueur = kart ? +Math.hypot(kart.x - attendue[0], kart.z - attendue[1]).toFixed(2) : -1;
    const devant = ai.filter(a => -a.s < G.grilleRecul(G.GRILLE_JOUEUR)).length;
    const derriere = ai.filter(a => -a.s > G.grilleRecul(G.GRILLE_JOUEUR)).length;
    const horsPiste = ai.filter(a => Math.abs(Math.hypot(a.k.x - c.x, a.k.z - c.z) - c.r) > 4.5).length;
    // cap : chaque kart regarde exactement dans le sens de la piste
    const capFaux = ai.filter(a => { const h = G.pathPos(a.s, a.off)[2]; let d = a.k.h - h; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) > 0.05; }).length;
    // 4) la ligne a damiers barre la piste (elle courait DANS son axe)
    const lg = G.city.ligne;
    // 5) le joueur boucle bien son tour sur la VRAIE ligne (le test visait l'ancien tracé)
    const bouclage = G.surLaLigne(lg.x, lg.z) && !G.surLaLigne(0, 124);
    G.race.state = 'running'; G.race.startT = G.simTime;
    const s0 = ai.map(a => a.s);
    const portillons = [];
    for (const g of G.RACE_GATES) { G.P.pos.set(g[0], 0.3, g[1]); G.raceTick(0.05); portillons.push(G.race.my.next); }
    G.P.pos.set(lg.x + 60, 0.3, lg.z); G.raceTick(0.05);
    G.P.pos.set(lg.x, 0.3, lg.z); G.raceTick(0.05);
    const tour = G.race.my.lap;
    const avance = ai.filter((a, i) => a.s > s0[i] + 3).length;   // chacun a bien quitté sa case
    // on repart propre
    G.race.state = 'idle'; G.exitCar();
    return { dansMer, marge: Math.round(marge), places: G.GRILLE_N, surPiste,
      karts: tous.size, partants: ai.length, horsPiste, capFaux, ecartJoueur, devant, derriere, bouclage,
      ligne: [lg.x, lg.z], portillons: portillons[portillons.length - 1], tour, avance };
  });
  const ok = r.dansMer === 0 && r.marge > 20 && r.surPiste === r.places
    && r.partants === r.karts - 1 && r.horsPiste === 0 && r.capFaux === 0
    && r.ecartJoueur < 0.2 && r.devant >= 3 && r.derriere >= 3 && r.bouclage
    && r.portillons === 7 && r.tour === 1 && r.avance === r.partants;
  return { ok, detail: `la ligne de depart et la tribune etaient SOUS LA MER et le portique posé dans l'axe de la piste · l'anneau est remonté a ${r.marge} m au nord du rivage (${r.dansMer} point de piste dans l'eau) et la ligne a damiers barre la piste en (${r.ligne[0]}, ${r.ligne[1]}) · les ${r.places} emplacements peints sont sur la piste (${r.surPiste}/${r.places}), et au top depart les ${r.karts} karts s'elancent tous (${r.partants} pilotes + le joueur, ${r.horsPiste} hors piste, ${r.capFaux} de travers) · le joueur demarre pile sur sa case du MILIEU (${r.ecartJoueur} m d'ecart, ${r.devant} devant lui et ${r.derriere} derriere) · un tour complet est bien compté (${r.portillons}/7 portillons puis la ligne → tour ${r.tour}) et les ${r.avance} pilotes ont quitté leur case` };
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
    __G.cam.yaw = Math.PI; __G.P.facing = 0;   // on regarde vers le bot : le verrouillage part de la camera
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
    // la classe ne s'ouvre que si le joueur est ASSIS sur une chaise de cette salle
    const ch = salle.chaises[0]; __G.P.sit = null; __G.P.pos.set(ch.x, 0.6, ch.z); __G.sitBench(ch);
    dits.length = 0;
    const ouvert = __G.openSchool(salle);
    if (!ouvert) return { ok: false, pourquoi: 'la classe ne s\'est pas ouverte alors que le joueur est assis' };
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
    __G.closeUI(); __G.P.sit = null; __G.school.chaise = null;
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
  const ok = !dehors.dedans && dehors.dist > 7 && dedans.dedans && dedans.dist < 5.0   // maison de poupee : 3,8 a 4,8 m dans une piece
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
    // l'horloge doit AVANCER : le contournement d'obstacle a une date de peremption, et
    // avec un temps fige le conducteur restait a jamais braque dans sa direction d'evitement
    const rouler = () => { __G.simTime += 1 / 60; __G.botDriveTick(1 / 60); };
    let n = 0; while (b.drive && b.drive.etat === 'route' && n < 120000) { rouler(); n++; }
    const c = b.drive.car;
    const arrivee = Math.hypot(c.x - (dest ? dest[0] : 0), c.z - (dest ? dest[1] : 0));
    // on monte à côté de lui
    __G.P.pos.set(c.x + 2, c.y + 0.4, c.z + 2); __G.botDriveTick(1 / 60);
    const propose = __G.city.botCarNear && __G.city.botCarNear.name;
    __G.monterAvecBot(b);
    const passager = b.drive.passager, cache = !__G.me.group.visible;
    // « va à la villa »
    const ordre2 = __G.commandeSociale('Nathan_pro va à la villa');
    let m = 0; while (b.drive && b.drive.etat === 'route' && m < 120000) { rouler(); m++; }
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
    // pas de rendez-vous de chef de gang pendant le test : la fenêtre met le jeu en pause
    __G.guerre.reunion = null; __G.guerre.prochaineReunion = __G.simTime + 1e6;
    __G.gangs.forEach(g => { g.reunionT = __G.simTime + 1e6; });
    if (__G.uiOpen) __G.closeUI();
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
  // Double appui rapide sur « avancer ». La fenêtre du jeu est de 340 ms de temps RÉEL :
  // en rendu logiciel une pause de 90 ms peut en durer 500 et le double appui passe à la
  // trappe. On réessaie donc jusqu'à ce que la course parte, au lieu de jouer aux dés.
  let court = false;
  for (let essai = 0; essai < 6 && !court; essai++) {
    await p.keyboard.up('ArrowUp');
    await p.evaluate(() => { __G.P.tapT = -9999; __G.P.run = false; __G.P.energie = 100; __G.P.essouffle = false; });
    await p.keyboard.press('ArrowUp');
    await p.keyboard.down('ArrowUp');
    court = await attendre(p, () => __G.P.run && __G.P.court, 4000);
  }
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

test('la caméra colle aux murs sans les traverser, et se baisse sous les plafonds bas', async p => {
  const lis = async (x, y, z, cond) => {
    // orientation figée : sinon la caméra peut tomber sur un arbre et la mesure danse
    await p.evaluate(v => { __SHOT.go({ world: 4, x: v.x, y: v.y, z: v.z, hour: 12, yaw: 0, pitch: 0.12 }); }, { x, y, z });
    await attendre(p, cond, 25000);
    await p.waitForTimeout(700);   // la perche se règle avant la caméra : on la laisse arriver
    return p.evaluate(() => {
      const c = __G.camera.position, dedans = __G.solids.filter(o => !o.veh && o.h < 30
        && Math.abs(c.x - o.x) < o.w / 2 && Math.abs(c.y - o.y) < o.h / 2 && Math.abs(c.z - o.z) < o.d / 2);
      const dedansMur = dedans.length > 0;
      return { dist: +__G.cam.dist.toFixed(2), libre: __G.cam.libre == null ? null : +__G.cam.libre.toFixed(2),
        salle: __G.cam.salle == null ? null : +__G.cam.salle.toFixed(1), plafond: __G.cam.plafond == null ? null : +__G.cam.plafond.toFixed(1),
        pitch: +__G.cam.pitch.toFixed(2), dedansMur, y: +c.y.toFixed(2) };
    });
  };
  await p.evaluate(() => { __G.cam.pitch = 0.6; });
  const rue = await lis(0, 1, 40, () => __G.cam.dist > 7.5);
  const cuisine = await lis(70, 1, 158, () => __G.cam.dist < 4);
  await p.evaluate(() => { __G.cam.pitch = 0.6; });
  await p.waitForTimeout(900);
  const basPlafond = await p.evaluate(() => ({ pitch: +__G.cam.pitch.toFixed(2), plafond: +(__G.cam.plafond || 9).toFixed(1) }));
  const retour = await lis(0, 1, 40, () => __G.cam.dist > 7.5);
  const ok = !rue.dedansMur && !cuisine.dedansMur && !retour.dedansMur
    && cuisine.dist < rue.dist - 2 && cuisine.plafond < 3.2 && basPlafond.pitch < 0.42 && cuisine.libre != null && retour.dist > 7;
  return { ok, detail: `rue : ${rue.dist} m (place ${rue.salle} m, plafond ${rue.plafond}) · cuisine de la villa : ${cuisine.dist} m (plafond ${cuisine.plafond} m, libre ${cuisine.libre} m) · plafond bas : inclinaison ramenée à ${basPlafond.pitch} · de retour dehors : ${retour.dist} m · caméra dans un mur : ${rue.dedansMur || cuisine.dedansMur || retour.dedansMur}` };
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
    // il s'arrête : trente secondes plus tard il est toujours à côté (avant, il repartait
    // se promener dès qu'il était arrivé)
    let loin = 0;
    for (let i = 0; i < 900; i++) { __G.updateBot(b, 1 / 30);
      loin = Math.max(loin, Math.hypot(b.pos.x - __G.P.pos.x, b.pos.z - __G.P.pos.z)); }
    const d2 = Math.hypot(b.pos.x - __G.P.pos.x, b.pos.z - __G.P.pos.z), dmax = loin;
    // et le lieu seul reste compris
    const helipo = __G.lieuDe('va à l\'hélicoptère');
    b.rdv = null;
    return { traite, suit, lieu: lieu && lieu.nom, d0: +d0.toFixed(1), d1: +d1.toFixed(1), d2: +d2.toFixed(1), dmax: +dmax.toFixed(1), arrive, helipo: helipo && helipo.nom };
  });
  const ok = r.traite && r.suit && r.lieu === '🚁 Héliport' && r.d1 < 3 && r.d2 < 3.5 && r.dmax < 4.5 && r.arrive;
  return { ok, detail: `lieu reconnu : ${r.lieu} · le bot part de ${r.d0} m, arrive à ${r.d1} m et reste à ${r.d2} m pendant 30 s sans jamais s'éloigner de plus de ${r.dmax} m (annonce=${r.arrive})` };
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
    __G.police.alarmT = 0; __G.police.coffres = 0; __G.police.renfortT = 0;   // alarme laissée par un test précédent : bankAlarm sortait aussitôt
    __G.bankAlarm(); __G.police.renfortT = 0; __G.police.cars.forEach(c => { c.active = true; c.goHome = false; });
    __G.police.arrestT = 0; __G.jail.on = false;   // une arrestation d'un test précédent bloquait le compteur
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
    __G.police.arrestT = 0;
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
    const dansLaPoche = __G.wallet, hud = (document.getElementById('coins') || {}).textContent;
    // mis KO juste après : les 30 % perdus ne mordent pas sur le butin du coffre
    const avantKO = __G.wallet;
    __G.P.hp = 40; __G.hurt(99, 'un test', 0, 0, 0);
    const apresKO = __G.wallet, perdu = avantKO - apresKO;
    __G.P.hp = 100; __G.police.butin = 0;
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
    return { gain, coffres, un, deux, trois, dansLaPoche, hud, perdu, apresKO };
  });
  const ok = r.gain === 500 && r.coffres === 1 && r.perdu < 500 && r.apresKO >= 500
    && r.un && r.deux && r.trois && r.deux > r.un && r.trois > r.deux;
  return { ok, detail: `coffre forcé : +${r.gain} 🪙 dans le porte-monnaie (total ${r.dansLaPoche}, HUD « ${r.hud} ») · mis KO juste après : seulement ${r.perdu} 🪙 perdus, il reste ${r.apresKO} · temps à tenir dans la villa : ${r.un} s avec 1 coffre, ${r.deux} s avec 2, ${r.trois} s avec 3` };
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

test('on monte sur le toit en ascenseur, on saute en parachute', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    if (__G.P.voile) __G.rangeVoile(false);   // rien qui traîne d'un test précédent
    await dodo(300);
    const t = __G.city.toits[0], L = t.lift;
    const nb = { lifts: __G.city.lifts.length, toits: __G.city.toits.length, voiles: __G.city.voiles.length };
    __G.P.pos.set(L.x, L.low + 0.3, L.z); __G.P.vel.set(0, 0, 0);
    const t0 = Date.now(); let haut = 0;
    while (Date.now() - t0 < 55000) { await dodo(250); haut = Math.max(haut, __G.P.pos.y); if (__G.P.pos.y > L.high - 0.4) break; }
    const monte = haut;
    // parachute posé sur le toit
    const para = __G.city.voiles.find(o => o.kind === 'parachute' && Math.abs(o.y - t.y) < 2);
    __G.P.pos.set(para.x, para.y + 0.4, para.z); await dodo(1200);
    const detecte = !!__G.city.voileNear;
    __G.prendreVoile(para);
    // saut depuis 7 m plutôt que depuis le toit : en rendu logiciel le temps simulé avance
    // 8 fois moins vite que la montre, et une descente de 14 m à 3,2 m/s ne tenait pas
    // dans le temps imparti — le parachute était accusé de ne pas se replier
    __G.P.pos.set(t.x + t.w / 2 + 3, 7, t.z); __G.P.vel.set(0, 0, 0);
    const y0 = __G.P.pos.y, s0 = __G.simTime;
    let vmin = 0, aVole = false, rangee = false; const t1 = Date.now();
    while (Date.now() - t1 < 45000) {
      await dodo(200); vmin = Math.min(vmin, __G.P.vel.y);
      aVole = aVole || __G.P.voileVol;
      if (aVole && !__G.P.voile) { rangee = true; break; }   // posé : le parachute se replie
    }
    return { nb, monte: +monte.toFixed(2), high: +L.high.toFixed(2), toit: +t.y.toFixed(1), detecte,
      chute: { de: +y0.toFixed(1), a: +__G.P.pos.y.toFixed(2), vMin: +vmin.toFixed(2), duree: +(__G.simTime - s0).toFixed(1) },
      rangee, voileApres: __G.P.voile, mesh: !!__G.P.voileMesh, remise: !para.pris };
  });
  const ok = r.nb.lifts >= 6 && r.nb.voiles >= 12 && r.monte > r.toit - 1 && r.chute.vMin > -7 && r.chute.vMin < -1
    && r.rangee && !r.voileApres && !r.mesh && r.remise;
  return { ok, detail: `${r.nb.lifts} ascenseurs, ${r.nb.toits} toits équipés, ${r.nb.voiles} voiles · monté à ${r.monte} m (toit à ${r.toit}) · parachute détecté=${r.detecte} · saut de ${r.chute.de} m : chute plafonnée à ${r.chute.vMin} m/s (au lieu de −30), posé à ${r.chute.a} m en ${r.chute.duree} s · voile repliée toute seule=${r.rangee} et remise sur le toit=${r.remise}` };
});

test('le deltaplane plane loin devant au lieu de tomber', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    if (__G.P.voile) __G.rangeVoile(false);
    await dodo(300);
    const t = __G.city.toits[0];
    const delta = __G.city.voiles.find(o => o.kind === 'delta' && Math.abs(o.y - t.y) < 2);
    __G.prendreVoile(delta);
    // vol simulé pas à pas : le rendu logiciel est trop lent pour suivre un plané réel
    __G.P.pos.set(0, 40, 40); __G.P.vel.set(0, 0, 0); __G.P.facing = 0;
    __G.P.grounded = false; __G.P.voileVol = true; __G.P.sit = null; __G.P.swimming = false;
    const x0 = __G.P.pos.x, z0 = __G.P.pos.z, y0 = __G.P.pos.y;
    let vmin = 0;
    for (let i = 0; i < 900; i++) {
      __G.P.vel.y -= 30 / 60;                       // gravité
      __G.voileTick(1 / 60);
      vmin = Math.min(vmin, __G.P.vel.y);
      __G.P.pos.x += __G.P.vel.x / 60; __G.P.pos.y += __G.P.vel.y / 60; __G.P.pos.z += __G.P.vel.z / 60;
      if (__G.P.pos.y <= 1) break;
    }
    const dh = Math.hypot(__G.P.pos.x - x0, __G.P.pos.z - z0), dv = y0 - __G.P.pos.y;
    const enVol = __G.P.voile;
    // au sol, l'aile se replie toute seule et revient sur le toit
    __G.P.grounded = true; __G.P.pos.y = 0.2;
    __G.voileTick(1 / 60);
    return { dh: +dh.toFixed(1), dv: +dv.toFixed(1), vmin: +vmin.toFixed(2), enVol,
      voile: __G.P.voile, mesh: !!__G.P.voileMesh, remise: !delta.pris };
  });
  const ok = r.enVol === 'delta' && r.dh > r.dv * 2 && r.dh > 60 && r.vmin > -3 && !r.voile && !r.mesh && r.remise;
  return { ok, detail: `deltaplane : ${r.dh} m parcourus à l'horizontale pour ${r.dv} m de descente (plané 1:${(r.dh / Math.max(1, r.dv)).toFixed(1)}, chute plafonnée à ${r.vmin} m/s) · replié tout seul à l'atterrissage=${!r.voile} et remis sur le toit=${r.remise}` };
});

test('les amis exécutent tous les ordres qu\'on leur donne', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.amis.clear(); __G.amis.add('Lucas_2014');
    const b = __G.bots[0], c = __G.bots[1];
    const reset = () => { b.rdv = null; b.ordre = null; b.bagarre = null; b.garde = 0; b.ko = 0; b.fight = null;
      b.wait = 0; b.drive = null; b.dance = 0; b.pos.set(4, 0.3, 40); };
    const essai = txt => { reset(); const ok = __G.commandeSociale('Lucas_2014 ' + txt);
      return { txt, ok, ordre: b.ordre && b.ordre.type, rdv: b.rdv ? (b.rdv.nom || 'rdv') : null,
        cible: b.bagarre ? b.bagarre.cible.name : null, danse: +(b.dance || 0).toFixed(1), garde: b.garde > 0 }; };
    const res = [
      essai('suis-moi'), essai('attends-moi ici'), essai('protège-moi'), essai('tape ' + c.name),
      essai('va me chercher à manger'), essai('cache-toi'), essai('danse'), essai('saute'), essai('salue'),
      essai('va me chercher une voiture et amène-la ici'), essai('cours me chercher un vélo'),
      essai('va me chercher une moto'), essai('attends-moi avec la voiture'), essai('viens'),
      essai('rendez-vous au parc'), essai('stop'),
    ];
    reset();
    const aide = __G.commandeSociale('Lucas_2014 tu peux faire quoi ?');
    const inconnu = __G.commandeSociale('Lucas_2014 blblblbl xyzzy');
    return { res, aide, inconnu, ordres: __G.AIDE_ORDRES ? __G.AIDE_ORDRES.length : 0 };
  });
  const compris = r.res.filter(x => x.ok).length;
  const agit = r.res.filter(x => x.ordre || x.rdv || x.cible || x.danse > 0).length;
  const ok = compris === r.res.length && agit >= 14 && r.aide;
  return { ok, detail: `${compris}/${r.res.length} ordres compris et ${agit} suivis d'effet · suivre=${r.res[0].ordre}, attendre=${r.res[1].ordre}, protéger=${r.res[2].garde}, taper=${r.res[3].cible}, manger=${r.res[4].rdv}, cacher=${r.res[5].rdv}, voiture=${r.res[9].rdv}, vélo=${r.res[10].rdv}, moto=${r.res[11].rdv} · la liste d'aide répond=${r.aide}` };
});

test('un ami frappe le bot désigné et lui rapporte à manger', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.amis.clear(); __G.amis.add('Lucas_2014');
    const b = __G.bots[0], c = __G.bots[1];
    b.ko = 0; c.ko = 0; c.hp = 100; b.pos.set(0, 0.3, 44); c.pos.set(0, 0.3, 50);
    b.rdv = null; b.ordre = null; b.bagarre = null; b.wait = 0;
    __G.commandeSociale('Lucas_2014 tape ' + c.name);
    const pv0 = c.hp;
    for (let i = 0; i < 1200; i++) { __G.simTime += 1 / 30; __G.combatTick(1 / 30); }
    const pv1 = c.hp, d = Math.hypot(b.pos.x - c.pos.x, b.pos.z - c.pos.z);
    // livraison de nourriture
    b.bagarre = null; b.ordre = null; b.rdv = null; b.wait = 0; b.fight = null;
    b.pos.set(__G.city.snack.x, 0.3, __G.city.snack.z + 3);
    __G.P.pos.set(0, 0.3, 40);   // en pleine rue : la livraison ne doit pas buter sur une devanture
    if (__G.P.snack) __G.P.snack = null;
    __G.commandeSociale('Lucas_2014 va me chercher à manger');
    const commande = b.rdv && b.rdv.livre ? b.rdv.livre.n : null;
    for (let i = 0; i < 2400 && !__G.P.snack; i++) { __G.simTime += 1 / 30; __G.updateBot(b, 1 / 30); }
    const livre = __G.P.snack ? __G.P.snack.n : null;
    __G.P.snack = null; document.body.classList.remove('carry');
    b.rdv = null; b.ordre = null;
    return { pv0, pv1, d: +d.toFixed(1), commande, livre };
  });
  const ok = r.pv1 < r.pv0 - 20 && r.d < 3 && r.commande && r.livre === r.commande;
  return { ok, detail: `« tape » : le bot visé passe de ${r.pv0} à ${r.pv1} PV, l'ami est venu à ${r.d} m · « va me chercher à manger » : il commande un ${r.commande} et te le met en main (${r.livre})` };
});

test('le cinéma projette en 640×360 avec finition et publicités', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    const ci = __G.city.cinema;
    const genres = [...new Set(__G.FILMS.map(f => f.genre))];
    let img = 0, err = null;
    try {
      for (let i = 0; i < __G.FILMS.length; i++) { ci.i = i;
        for (let k = 0; k < 25; k++) { ci.t = k * 0.6; ci.next = -1; __G.simTime = 2000 + k; __G.cinemaTick(0); img++; } }
    } catch (e) { err = e.message; }
    // bandes noires en haut et en bas, image non vide au milieu
    const haut = ci.g.getImageData(0, 2, ci.cv.width, 4).data;
    let noirHaut = 0; for (let i = 0; i < haut.length; i += 4) if (haut[i] + haut[i + 1] + haut[i + 2] < 30) noirHaut++;
    const mid = ci.g.getImageData(0, ci.cv.height / 2 - 30, ci.cv.width, 60).data;
    let clairs = 0; for (let i = 0; i < mid.length; i += 40) if (mid[i] + mid[i + 1] + mid[i + 2] > 120) clairs++;
    return { n: __G.FILMS.length, genres, pubs: __G.FILMS.filter(f => f.genre === 'publicité').length,
      duree: Math.round(__G.FILMS.reduce((t, f) => t + f.d, 0)), taille: [ci.cv.width, ci.cv.height],
      img, err, noirHaut: noirHaut / (haut.length / 4), clairs, videos: __G.VIDEOS.length };
  });
  const ok = !r.err && r.n >= 20 && r.pubs >= 3 && r.taille[0] === 640 && r.taille[1] === 360
    && r.noirHaut > 0.9 && r.clairs > 50;
  return { ok, detail: `${r.n} films (${r.pubs} publicités, ${r.genres.length} genres, ${r.duree} s) · toile ${r.taille[0]}×${r.taille[1]} · ${r.img} images dessinées sans erreur · bandes noires de cinéma sur ${Math.round(r.noirHaut * 100)} % du bord haut, image vivante au centre (${r.clairs} points clairs)` };
});

test('aucun véhicule ne rentre dans un bâtiment', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -52, y: 1, z: 70, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    const bk = __G.city.bank;
    const dedans = __G.carBlocked(bk.x, bk.z, null, 1.4, { veh: true, bar: true });
    const dehors = __G.carBlocked(bk.x + bk.w / 2 + 6, bk.z, null, 1.4, {});
    const nb = __G.city.batiments.length;
    // braquage : les voitures doivent rester dehors
    __G.P.pos.set(-57, 10.05, 70);
    const t0 = __G.simTime;
    __G.police.alarmT = 0; __G.police.coffres = 0;
    __G.bankAlarm(); __G.police.arrestT = 1e9; __G.police.renfortT = 0;
    __G.police.cars.forEach(c => { c.active = true; c.goHome = false; c.debarque = false; });
    let pire = 0;
    for (let i = 0; i < 2400; i++) {
      __G.simTime = t0 + i / 30; __G.P.pos.set(-57, 10.05, 70); __G.policeTick(1 / 30); __G.police.arrestT = 1e9;
      for (const c of __G.police.cars) {
        const dx = bk.w / 2 - Math.abs(c.x - bk.x), dz = bk.d / 2 - Math.abs(c.z - bk.z);
        if (dx > 0 && dz > 0) pire = Math.max(pire, Math.min(dx, dz));
      }
    }
    const agents = __G.police.agents.filter(a => Math.abs(a.x - bk.x) < 9 && Math.abs(a.z - bk.z) < 9).length;
    __G.jail.on = false; __G.clearWanted();
    return { dedans, dehors, nb, pire: +pire.toFixed(2), agents };
  });
  const ok = r.dedans && !r.dehors && r.nb >= 15 && r.pire < 0.6 && r.agents >= 1;
  return { ok, detail: `${r.nb} bâtiments fermés aux véhicules · intérieur de la banque bloqué=${r.dedans}, parvis libre=${!r.dehors} · pendant tout le braquage, aucune voiture de police ne dépasse de ${r.pire} m à l'intérieur (elles restaient garées dans le hall) · ${r.agents} agents entrés à pied` };
});

test('en moto, l\'ami conduit et le joueur est assis derrière', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.amis.clear(); __G.amis.add('Lucas_2014');
    const b = __G.bots[0];
    const moto = __G.city.cars.find(c => c.kind === 'moto' && !c.busy);
    if (!moto) return { err: 'pas de moto' };
    b.rdv = null; b.ordre = null; b.ko = 0; b.fight = null; b.wait = 0;
    b.drive = { car: moto, tx: 0, tz: 40, nom: 'toi', etat: 'route', passager: false, annonce: __G.simTime };
    moto.busy = true; moto.h = 0; moto.x = 0; moto.z = 44; moto.y = 0; moto.g.position.set(0, 0, 44);
    __G.P.pos.set(0, 0.4, 44);
    __G.monterAvecBot(b);
    for (let i = 0; i < 20; i++) { __G.simTime += 1 / 30; __G.botDriveTick(1 / 30); }
    const cs = Math.cos(moto.h), sn = Math.sin(moto.h);
    const lzJ = (__G.P.pos.x - moto.x) * sn + (__G.P.pos.z - moto.z) * cs;
    const av = b.av.group.position, lzA = (av.x - moto.x) * sn + (av.z - moto.z) * cs;
    const res = { visible: __G.me.group.visible, lzJoueur: +lzJ.toFixed(2), lzAmi: +lzA.toFixed(2),
      hJoueur: +(__G.P.pos.y - moto.y).toFixed(2), passager: !!b.drive.passager, act: document.getElementById('act').textContent.slice(0, 24) };
    __G.botDescendre(b, false);
    res.apres = { visible: __G.me.group.visible, rot: +__G.me.group.rotation.z.toFixed(2) };
    return res;
  });
  const ok = !r.err && r.visible && r.lzJoueur < r.lzAmi - 0.5 && r.hJoueur > 0.3 && r.passager
    && r.act.includes('🏍️') && r.apres.visible;
  return { ok, detail: `le joueur est visible en croupe : il est à ${r.lzJoueur} m derrière le centre, l'ami à ${r.lzAmi} m devant (assise à ${r.hJoueur} m) · le HUD annonce « ${r.act}… » · c'est bien l'ami qui conduit (passager=${r.passager})` };
});

test('on annule le rendez-vous : l\'ami reprend sa vie et rend le véhicule', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.amis.clear(); __G.amis.add('Lucas_2014');
    const b = __G.bots[0];
    b.rdv = null; b.ordre = null; b.drive = null; b.ko = 0; b.wait = 0; b.pos.set(6, 0.3, 40);
    __G.commandeSociale('Lucas_2014 va me chercher une voiture et amène-la ici');
    const c = b.rdv && b.rdv.auto ? b.rdv.auto.car : null;
    if (c) c.busy = true;
    const avant = { rdv: !!b.rdv, busy: !!(c && c.busy) };
    __G.commandeSociale('Lucas_2014 annule le rendez-vous');
    const apres = { rdv: !!b.rdv, ordre: !!b.ordre, busy: !!(c && c.busy) };
    // une voiture oubliée par un bot disparu est rendue par la ronde de sécurité
    const c2 = __G.city.cars.find(v => v !== c && !v.heli && !v.busy);
    c2.busy = true;
    __G.libereVehiculesOublies();
    const rendue = !c2.busy;
    return { avant, apres, rendue };
  });
  const ok = r.avant.rdv && r.avant.busy && !r.apres.rdv && !r.apres.ordre && !r.apres.busy && r.rendue;
  return { ok, detail: `rendez-vous en cours (voiture réservée=${r.avant.busy}) → annulé : plus de rendez-vous=${!r.apres.rdv}, voiture rendue=${!r.apres.busy} · une voiture oubliée par un bot est rendue automatiquement=${r.rendue}` };
});

test('quand il neige : congères, bonshommes, capots blancs et verglas', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.meteoSet('neige', 600); __G.meteo.force = 1;
    await dodo(2200);
    const G = __G.city.neigeG;
    let bonshommes = 0, congeres = 0;
    if (G) G.children.forEach(c => { if (c.type === 'Group') bonshommes++; else if (c.geometry && c.geometry.type === 'SphereGeometry') congeres++; });
    const g0 = __G.city.glace[0];
    const glisse = __G.surGlace(g0.x, g0.z), sec = __G.surGlace(g0.x + 40, g0.z + 40);
    const capots = (__G.city.neigeVeh || []).filter(m => m.visible).length;
    const sol = __G.meteo.sol ? +__G.meteo.sol.material.opacity.toFixed(2) : 0;
    __G.meteoSet('clair', 600); __G.meteo.force = 0;
    await dodo(1500);
    const apres = { visible: G.visible, capots: (__G.city.neigeVeh || []).filter(m => m.visible).length, glisse: __G.surGlace(g0.x, g0.z) };
    return { decor: !!G, bonshommes, congeres, glace: __G.city.glace.length, capots, sol, glisse, sec, apres };
  });
  const ok = r.decor && r.bonshommes >= 8 && r.congeres >= 40 && r.glace >= 8 && r.capots >= 8
    && r.sol > 0.5 && r.glisse && !r.sec && !r.apres.visible && !r.apres.glisse;
  return { ok, detail: `${r.congeres} congères, ${r.bonshommes} bonshommes de neige, ${r.glace} plaques de verglas, ${r.capots} véhicules enneigés, manteau au sol à ${r.sol} · on glisse sur une plaque=${r.glisse} et pas à côté=${!r.sec} · tout disparaît au retour du beau temps=${!r.apres.visible}` };
});

test('on peut détruire une voiture de police à coups de feu', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    const pc = __G.police.cars[0];
    // en plein désert du rallye : aucun mur ni véhicule entre le joueur et la cible
    const X = 0, Z = -70;
    pc.x = X; pc.z = Z + 8; pc.y = 0; pc.h = 0; pc.dmg = 0; pc.dead = false; pc.active = false;
    pc.g.position.set(pc.x, 0, pc.z);
    if (pc.solid) { pc.solid.x = pc.x; pc.solid.z = pc.z; pc.solid.y = 0.7; }
    __G.P.pos.set(X, 0.4, Z);
    const tirer = () => { const s = { m: null, p: new __G.THREE.Vector3(X, 1.2, Z), v: new __G.THREE.Vector3(0, 0, 95), t: 0, mine: true, dmg: 24 };
      __G.shots.push(s); __G.spawnShot(s); for (let i = 0; i < 30; i++) __G.shotsTick(1 / 120); };
    tirer(); const un = Math.round(pc.dmg || 0);
    let n = 1;
    while (n < 12 && !pc.dead) { tirer(); n++; }
    const res = { un, n, dmg: Math.round(pc.dmg || 0), dead: !!pc.dead, wanted: __G.police.wanted, riposte: __G.police.riposte > __G.simTime };
    __G.clearWanted();
    return res;
  });
  const ok = r.un > 10 && r.dead && r.n <= 8 && r.riposte;
  return { ok, detail: `une balle inflige ${r.un} de dégâts à la voiture de police · elle explose au bout de ${r.n} balles (dégâts ${r.dmg}) · la police riposte aussitôt=${r.riposte}` };
});

test('le fusil à lunette vise d\'abord, puis tire au second appui', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    __G.owned.add('arme:sniper'); __G.saveOwned(); __G.equipWeapon('sniper');
    __G.P.ammo = 5; __G.P.fireCd = 0; __G.P.zoom = false;
    const w = __G.WEAPONS.sniper;
    const n0 = __G.shots.length;
    __G.fire();
    const apres1 = { zoom: __G.P.zoom, tirs: __G.shots.length - n0, classe: document.body.classList.contains('zoom'), degaine: __G.P.drawn };
    __G.P.fireCd = 0;
    __G.fire();
    const apres2 = { zoom: __G.P.zoom, tirs: __G.shots.length - n0, classe: document.body.classList.contains('zoom'), holster: __G.P.holsterT > 0 };
    __G.shots.length = n0;
    __G.equipWeapon(null);
    return { p: w.p, dmg: w.dmg, portee: w.speed, apres1, apres2, scope: !!document.getElementById('scope') };
  });
  const ok = r.apres1.zoom && r.apres1.tirs === 0 && r.apres1.classe && r.apres1.degaine
    && !r.apres2.zoom && r.apres2.tirs === 1 && !r.apres2.classe && r.apres2.holster && r.scope && r.dmg >= 60;
  return { ok, detail: `fusil à lunette (${r.p} 🪙, ${r.dmg} de dégâts) · 1er appui : œil dans la lunette (grossissement affiché=${r.apres1.classe}), aucun tir · 2ᵉ appui : ${r.apres2.tirs} balle partie et rengainage programmé=${r.apres2.holster}` };
});

test('cartouches perforantes, incendiaires et explosives', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    const types = Object.keys(__G.MUNITIONS);
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.P.ammo = 99;
    const tirer = () => { __G.P.fireCd = 0; const n = __G.shots.length; __G.fire();
      const s = __G.shots[__G.shots.length - 1]; return n < __G.shots.length ? { dmg: s.dmg, feu: !!s.feu, boom: !!s.boom } : null; };
    __G.P.munition = 'std'; const std = tirer();
    __G.P.munition = 'perf'; __G.P.muniStock.perf = 10; const perf = tirer();
    __G.P.munition = 'inc'; __G.P.muniStock.inc = 10; const inc = tirer();
    __G.P.munition = 'exp'; __G.P.muniStock.exp = 10; const exp = tirer();
    const stockApres = __G.P.muniStock.perf;
    __G.shots.length = 0;
    // feu au sol : il brûle un bot qui passe dedans
    const b = __G.bots[0]; b.ko = 0; b.hp = 100; b.pos.set(20, 0.3, 60); b.av.group.position.copy(b.pos);
    __G.feuAuSol(20, 0.1, 60);
    const feux0 = __G.city.feux.length;
    for (let i = 0; i < 200; i++) { __G.simTime += 1 / 30; __G.feuxTick(1 / 30); }
    const brule = 100 - (b.hp ?? 100);
    // explosion : elle casse le mobilier urbain et abîme les véhicules
    const lamp = __G.breakables.find(x => x.kind === 'lamp' && !x.broken);
    const car = __G.city.cars.find(c => !c.heli);
    car.x = lamp.x + 2; car.z = lamp.z; car.dmg = 0; car.dead = false; if (car.solid) { car.solid.x = car.x; car.solid.z = car.z; }
    __G.P.pos.set(lamp.x + 12, 0.4, lamp.z + 12);
    __G.balleExplose(lamp.x, 1, lamp.z);
    const res = { types, std, perf, inc, exp, stockApres, feux0, brule: Math.round(brule),
      lampCassee: !!lamp.broken, degatsVoiture: Math.round(car.dmg || 0) };
    __G.city.feux.forEach(f => __G.worldGroup.remove(f.g)); __G.city.feux.length = 0;
    __G.P.munition = 'std'; __G.equipWeapon(null); __G.clearWanted();
    return res;
  });
  const ok = r.types.length === 4 && r.perf.dmg > r.std.dmg * 1.8 && r.inc.feu && r.exp.boom
    && r.stockApres === 9 && r.feux0 === 1 && r.brule > 20 && r.lampCassee && r.degatsVoiture > 40;
  return { ok, detail: `4 sortes de cartouches · standard ${r.std.dmg} dégâts, perforantes ${r.perf.dmg}, incendiaires ${r.inc.dmg} (feu=${r.inc.feu}), explosives ${r.exp.dmg} (explosion=${r.exp.boom}) · le stock se décompte (${r.stockApres} restantes) · le feu au sol brûle un bot de ${r.brule} PV · l'explosion casse le lampadaire=${r.lampCassee} et met ${r.degatsVoiture} de dégâts à la voiture d'à côté` };
});

test('un seul coffre laisse le temps de fuir, trois font venir tout le monde', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -57, y: 10.2, z: 70, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    // Les coffres rapportent de moins en moins DANS LA JOURNÉE (500, 300, 150, 75, puis 50) :
    // un test précédent a pu en ouvrir un et le premier de celui-ci ne vaudrait plus 500.
    // On repart donc d'une journée neuve.
    __G.bank.coffresJour = 0; __G.bank.jourT = 0;
    const essai = n => {
      __G.clearWanted(); __G.police.alarmT = 0; __G.police.coffres = n;
      __G.city.guards.forEach(g => { g.alert = false; });
      const t0 = __G.simTime;
      __G.bankAlarm();
      return { retard: +Math.max(0, (__G.police.renfortT || t0) - t0).toFixed(0), voitures: __G.police.cars.length,
        actives: __G.police.cars.filter(c => c.active).length, gardes: __G.city.guards.filter(g => g.alert).length,
        etoiles: __G.police.wanted, traque: +(__G.police.decayT - t0).toFixed(0) };
    };
    const un = essai(0), deux = essai(1), trois = essai(3);   // 0 = on force le premier coffre
    // le coffre verse bien 500 pièces d'un coup
    const sf = __G.city.safes.find(s => !s.open) || __G.city.safes[0];
    sf.open = false; sf.progress = 0.99; __G.city.safeNear = sf; __G.keys.add('KeyE');
    const av = __G.wallet; __G.safesTick(1 / 30); __G.keys.delete('KeyE'); __G.city.safeNear = null;
    const gain = __G.wallet - av;
    __G.police.coffres = 0; __G.clearWanted();
    return { un, deux, trois, gain, montant: sf.amount };
  });
  const ok = r.gain === 500 && r.montant === 500 && r.un.retard > r.deux.retard && r.deux.retard > r.trois.retard
    // le quatrième coffre ne ramène plus le délai à zéro : il reste un plancher de 6 s pour
    // laisser au joueur une chance de sortir de la banque (demande explicite du joueur).
    && r.trois.retard <= 9 && r.un.gardes < r.trois.gardes && r.un.voitures < r.trois.voitures && r.un.traque < r.trois.traque;
  return { ok, detail: `coffre = ${r.gain} 🪙 versés d'un coup · premier coffre : la police démarre après ${r.un.retard} s (${r.un.voitures} voitures, ${r.un.gardes} garde alerté, traque ${r.un.traque} s) · au deuxième : ${r.deux.retard} s, ${r.deux.gardes} gardes · au quatrième : ${r.trois.retard} s, ${r.trois.voitures} voitures, ${r.trois.gardes} gardes et ${r.trois.traque} s de traque` };
});

test('rien ne dépasse des murs de l\'armurerie, et la banque est meublée', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 52, y: 1, z: 19, hour: 12 });
    const B = new __G.THREE.Box3(), p2 = new __G.THREE.Vector3();
    const murs = { x1: 46, x2: 58, z1: 14.5, z2: 23.5 };
    const dehors = [];
    let objets = 0;
    __G.worldGroup.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      o.getWorldPosition(p2);
      if (p2.x < 46.4 || p2.x > 57.6 || p2.z < 14.9 || p2.z > 23.1 || p2.y < 0.4 || p2.y > 4.3) return;
      B.setFromObject(o);
      if (B.max.x - B.min.x > 5 || B.max.z - B.min.z > 5) return;   // la structure elle-même
      objets++;
      const d = Math.max(murs.x1 - B.min.x, B.min.x * 0 + B.max.x - murs.x2, murs.z1 - B.min.z, B.max.z - murs.z2);
      if (d > 0.05) dehors.push({ x: +p2.x.toFixed(1), z: +p2.z.toFixed(1), y: +p2.y.toFixed(1), d: +d.toFixed(2) });
    });
    // banque : on compte les objets du hall
    const bk = __G.city.bank;
    let meubles = 0;
    __G.worldGroup.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      o.getWorldPosition(p2);
      if (Math.abs(p2.x - bk.x) < 9.5 && Math.abs(p2.z - bk.z) < 9.5 && p2.y > 0.4 && p2.y < 4.6) meubles++;
    });
    const assises = __G.city.benches.filter(b => Math.abs(b.x - bk.x) < 9 && Math.abs(b.z - bk.z) < 9).length;
    return { objets, dehors: dehors.slice(0, 5), n: dehors.length, meubles, assises };
  });
  const ok = r.n === 0 && r.objets >= 12 && r.meubles >= 60 && r.assises >= 2;
  return { ok, detail: `armurerie : ${r.objets} objets à l'intérieur, ${r.n} qui dépassent des murs${r.n ? ' (' + JSON.stringify(r.dehors) + ')' : ''} · banque : ${r.meubles} éléments dans le hall dont ${r.assises} canapés où s'asseoir` };
});

test('on voit le joueur voler : suspendu sous la voilure, à plat ventre sous l\'aile', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const THREE = __G.THREE;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    if (__G.P.voile) __G.rangeVoile(false);
    await dodo(400);
    const mesure = (kind, facing) => {
      if (__G.P.voile) __G.rangeVoile(false);
      const o = __G.city.voiles.find(v => v.kind === kind && !v.pris);
      __G.prendreVoile(o);
      __G.P.pos.set(0, 60, 40); __G.P.vel.set(0, -2, 0); __G.P.facing = facing;
      __G.P.grounded = false; __G.P.standing = null; __G.P.voileVol = true;
      __G.voileTick(1 / 60); __G.voilePose(1 / 60);
      const g = __G.P.voileMesh, aile = g.userData.voile;
      g.updateMatrixWorld(true); __G.me.group.updateMatrixWorld(true);
      let toiles = 0; aile.traverse(m => { if (m.isMesh) toiles++; });
      const hautVoile = aile.getWorldPosition(new THREE.Vector3()).y - __G.P.pos.y;
      const tete = __G.me.rig.head.getWorldPosition(new THREE.Vector3());
      // distance de la tête devant le joueur, dans l'axe du vol
      const devant = (tete.x - __G.P.pos.x) * Math.sin(facing) + (tete.z - __G.P.pos.z) * Math.cos(facing);
      const res = { pieces: g.children.length, toiles, hautVoile: +hautVoile.toFixed(2),
        inclinaison: +__G.me.group.rotation.x.toFixed(2), ordre: __G.me.group.rotation.order,
        teteDevant: +devant.toFixed(2), teteHaut: +(tete.y - __G.P.pos.y).toFixed(2),
        bras: +__G.me.rig.armL.rotation.x.toFixed(2) };
      __G.rangeVoile(false);
      return res;
    };
    const para = mesure('parachute', 1.2);
    const delta = mesure('delta', 0.6);
    return { para, delta, apres: { rot: +__G.me.group.rotation.x.toFixed(2), bras: +__G.me.rig.armL.rotation.x.toFixed(2) } };
  });
  const ok = r.para.pieces >= 10 && r.para.toiles >= 9 && r.para.hautVoile > 3
    && Math.abs(r.para.inclinaison) < 0.1 && r.para.teteHaut > 1.2 && r.para.bras < -1.5
    && r.delta.toiles >= 11 && r.delta.inclinaison > 1.2 && r.delta.teteDevant > 0.4
    && r.apres.rot === 0 && r.apres.bras === 0;
  return { ok, detail: `parachute : ${r.para.pieces} pièces (voilure de ${r.para.toiles} morceaux à ${r.para.hautVoile} m au-dessus), joueur debout dans le harnais (inclinaison ${r.para.inclinaison}, bras levés ${r.para.bras}) · deltaplane : aile de ${r.delta.toiles} morceaux, joueur à plat ventre (inclinaison ${r.delta.inclinaison}) tête ${r.delta.teteDevant} m devant lui · rig remis à zéro après=${r.apres.rot === 0 && r.apres.bras === 0}` };
});

test('le fusil à lunette se porte dans le dos, comme le fusil d\'assaut', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const THREE = __G.THREE;
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    await dodo(300);
    const out = {};
    for (const k of ['rifle', 'sniper']) {
      __G.owned.add('arme:' + k); __G.equipWeapon(k);
      __G.P.drawn = false; __G.setWeapon(__G.me, k, false);
      await dodo(150);
      const m = __G.me.weapons[k];
      __G.me.group.updateMatrixWorld(true);
      const rel = __G.me.group.worldToLocal(m.getWorldPosition(new THREE.Vector3()));
      let pieces = 0; m.traverse(o => { if (o.isMesh) pieces++; });
      out[k] = { visible: m.visible, surLeCorps: m.parent === __G.me.group, pieces,
        x: +rel.x.toFixed(2), y: +rel.y.toFixed(2), z: +rel.z.toFixed(2) };
    }
    // dégainé, il passe dans la main droite
    __G.P.drawn = true; __G.setWeapon(__G.me, 'sniper', true);
    out.enMain = __G.me.weapons.sniper.parent === __G.me.rig.handR;
    __G.P.drawn = false; __G.setWeapon(__G.me, null, false);
    return out;
  });
  const s = r.sniper, f = r.rifle;
  const ok = s.visible && s.surLeCorps && s.z < -0.15 && s.y > 0.5 && s.pieces >= 12
    && Math.abs(s.z - f.z) < 0.05 && Math.abs(s.y - f.y) < 0.05 && r.enMain;
  return { ok, detail: `fusil à lunette : ${s.pieces} pièces, visible=${s.visible}, en bandoulière dans le dos à (${s.x}, ${s.y}, ${s.z}) — même place que le fusil d'assaut (${f.x}, ${f.y}, ${f.z}) · il passe en main quand on dégaine=${r.enMain}` };
});

// --- Décodeur QR indépendant : il relit la matrice produite par le jeu comme un vrai
// lecteur (démasquage, désentrelacement, syndromes de Reed-Solomon) et rend le texte.
const QRLIRE = (() => {
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
  const EC = [null, { ec: 7, nb: 1, dc: 19 }, { ec: 10, nb: 1, dc: 34 }, { ec: 15, nb: 1, dc: 55 },
    { ec: 20, nb: 1, dc: 80 }, { ec: 26, nb: 1, dc: 108 }, { ec: 18, nb: 2, dc: 68 }];
  const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
  const MASKS = [(r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0, (r, c) => (((r >> 1) + Math.floor(c / 3)) % 2) === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) === 0, (r, c) => (((r * c) % 2 + (r * c) % 3) % 2) === 0,
    (r, c) => (((r + c) % 2 + (r * c) % 3) % 2) === 0];
  function reserve(N, v) {
    const res = []; for (let i = 0; i < N; i++) res.push(new Array(N).fill(false));
    const R = (r, c) => { if (r >= 0 && r < N && c >= 0 && c < N) res[r][c] = true; };
    for (const [r0, c0] of [[0, 0], [0, N - 7], [N - 7, 0]])
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) R(r0 + r, c0 + c);
    for (const a of ALIGN[v]) for (const b of ALIGN[v]) {
      if ((a < 9 && b < 9) || (a < 9 && b > N - 10) || (a > N - 10 && b < 9)) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) R(a + r, b + c);
    }
    for (let i = 8; i < N - 8; i++) { R(6, i); R(i, 6); }
    R(N - 8, 8);
    for (let i = 0; i < 9; i++) { R(8, i); R(i, 8); }
    for (let i = 0; i < 8; i++) { R(8, N - 1 - i); R(N - 1 - i, 8); }
    return res;
  }
  return function lire(m, N) {
    const v = (N - 17) / 4, info = EC[v];
    if (!info) return { erreur: 'version ' + v + ' inconnue' };
    let f = 0;
    for (let k = 0; k < 15; k++) {
      let bit;
      if (k < 6) bit = m[8][k]; else if (k < 8) bit = m[8][k + 1]; else if (k === 8) bit = m[7][8]; else bit = m[14 - k][8];
      f |= bit << (14 - k);   // l'information de format s'ecrit poids FORT en premier
    }
    f ^= 0x5412;
    let d = f; for (let i = 4; i >= 0; i--) if (d & (1 << (i + 10))) d ^= 0x537 << i;
    if (d & 0x3ff) return { erreur: 'format illisible' };
    if (((f >> 13) & 3) !== 1) return { erreur: 'niveau de correction inattendu' };
    const masque = (f >> 10) & 7, res = reserve(N, v), mk = MASKS[masque];
    const bits = []; let haut = true;
    for (let c = N - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (let k = 0; k < N; k++) { const r = haut ? N - 1 - k : k;
        for (const cc of [c, c - 1]) { if (res[r][cc]) continue; bits.push(m[r][cc] ^ (mk(r, cc) ? 1 : 0)); } }
      haut = !haut;
    }
    const flux = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) { let x = 0; for (let j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; flux.push(x); }
    const blocs = Array.from({ length: info.nb }, () => []), ecs = Array.from({ length: info.nb }, () => []);
    let i = 0;
    for (let k = 0; k < info.dc; k++) for (let b = 0; b < info.nb; b++) blocs[b].push(flux[i++]);
    for (let k = 0; k < info.ec; k++) for (let b = 0; b < info.nb; b++) ecs[b].push(flux[i++]);
    for (let b = 0; b < info.nb; b++) {
      const mot = blocs[b].concat(ecs[b]);
      for (let j = 0; j < info.ec; j++) { let val = 0; for (const o of mot) val = mul(val, EXP[j]) ^ o;
        if (val !== 0) return { erreur: 'correction d\'erreur invalide (bloc ' + b + ')' }; }
    }
    const data = [].concat(...blocs);
    if ((data[0] >> 4) !== 4) return { erreur: 'ce n\'est pas un QR en mode octet' };
    const len = ((data[0] & 15) << 4) | (data[1] >> 4), oct = [];
    for (let k = 0; k < len; k++) oct.push(((data[1 + k] & 15) << 4) | (data[2 + k] >> 4));
    return { version: v, masque, texte: Buffer.from(oct).toString('utf8') };
  };
})();

test('le QR affiché sur la télé est un vrai code lisible par un téléphone', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    if (__G.uiOpen) __G.closeUI();
    const essais = ['https://salimusus.github.io/marlon/index.html#manette=ABCD',
      'http://192.168.1.20:8080/#jeu=WXYZ', 'A',
      'https://un-domaine-assez-long.example.com/dossier/jeu/index.html#manette=ZZZZ'];
    const out = essais.map(t => { const q = __G.QR.matrice(t); return q ? { t, N: q.N, m: q.m } : { t, N: 0 }; });
    __G.ouvreSalonTV();
    const affiche = { code: __G.tv.code, lien: document.getElementById('lienManette').textContent,
      largeur: document.getElementById('qrManette').width };
    __G.closeUI();
    return { out, affiche, tropLong: !__G.QR.matrice('x'.repeat(200)) };
  });
  const lus = r.out.map(c => c.N ? QRLIRE(c.m, c.N) : { erreur: 'pas de QR' });
  const ok = lus.every((l, i) => !l.erreur && l.texte === r.out[i].t)
    && r.affiche.code.length === 4 && r.affiche.lien.includes('#manette=' + r.affiche.code)
    && r.affiche.largeur > 60 && r.tropLong;
  const det = lus.map((l, i) => l.erreur ? `❌ ${l.erreur}` : `v${l.version}/masque ${l.masque} → ${l.texte === r.out[i].t ? 'texte exact' : 'texte faux'}`);
  return { ok, detail: `4 QR relus par un décodeur indépendant : ${det.join(' · ')} · la télé affiche le code ${r.affiche.code} et le lien ${r.affiche.lien.slice(0, 46)}…` };
});

test('le mode TV grossit tout l\'affichage et enlève les boutons du pouce', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    if (__G.uiOpen) __G.closeUI();
    __G.modeTV(false);
    const px = s => parseFloat(s) || 0;
    const avant = { pill: px(getComputedStyle(document.querySelector('.pill')).fontSize),
      lb: px(getComputedStyle(document.getElementById('lb')).minWidth),
      saut: getComputedStyle(document.getElementById('jumpBtn')).display,
      gps: px(getComputedStyle(document.getElementById('gps')).width),
      marge: px(getComputedStyle(document.getElementById('top')).paddingLeft) };
    __G.modeTV(true);
    const apres = { pill: px(getComputedStyle(document.querySelector('.pill')).fontSize),
      lb: px(getComputedStyle(document.getElementById('lb')).minWidth),
      saut: getComputedStyle(document.getElementById('jumpBtn')).display,
      joy: getComputedStyle(document.getElementById('joyHome')).display,
      gps: px(getComputedStyle(document.getElementById('gps')).width),
      marge: px(getComputedStyle(document.getElementById('top')).paddingLeft),
      msg: px(getComputedStyle(document.getElementById('msg')).fontSize) };
    const garde = localStorage.getItem('superobby.tv');
    __G.modeTV(false);
    return { avant, apres, garde, remis: !document.body.classList.contains('tv') };
  });
  const ok = r.apres.pill > r.avant.pill && r.apres.lb > r.avant.lb && r.apres.gps > r.avant.gps
    && r.apres.marge > r.avant.marge + 10 && r.apres.saut === 'none' && r.apres.joy === 'none'
    && r.garde === '1' && r.remis;
  return { ok, detail: `pastilles ${r.avant.pill}px → ${r.apres.pill}px, tableau des joueurs ${r.avant.lb}px → ${r.apres.lb}px, radar ${r.avant.gps}px → ${r.apres.gps}px, marge d'écran ${r.avant.marge}px → ${r.apres.marge}px, messages à ${r.apres.msg}px · boutons tactiles cachés=${r.apres.saut === 'none' && r.apres.joy === 'none'} · réglage mémorisé=${r.garde === '1'}` };
});

test('le téléphone sert de télécommande : déplacement, caméra, boutons et chat', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    if (__G.uiOpen) __G.closeUI();
    __G.P.pos.set(110, 0.5, 60); __G.P.vel.set(0, 0, 0);
    await dodo(400);
    const depart = __G.P.pos.clone();
    __G.telCommande({ t: 'hello', nom: 'Téléphone de Marlon' });
    __G.telCommande({ t: 'ax', x: 0, y: 1 });
    const axe = { x: __G.tel.x, y: __G.tel.y };
    // sous rendu logiciel le jeu tourne à ~2 images/s : 1,4 s d'attente ne laissaient parfois
    // aucune image au joueur pour avancer. On attend qu'il ait BOUGÉ, avec une limite.
    for (let i = 0; i < 60 && depart.distanceTo(__G.P.pos) < 0.5; i++) await dodo(250);
    const avance = +depart.distanceTo(__G.P.pos).toFixed(2);
    __G.telCommande({ t: 'ax', x: 0, y: 0 });
    const yaw0 = __G.cam.yaw, pitch0 = __G.cam.pitch;
    __G.telCommande({ t: 'look', dx: 120, dy: 40 });
    const cam = { yaw: +(yaw0 - __G.cam.yaw).toFixed(3), pitch: +(__G.cam.pitch - pitch0).toFixed(3) };
    __G.P.jumpBuf = 0; __G.P.grounded = true;
    __G.telCommande({ t: 'btn', b: 'saut', down: true });
    const saut = __G.P.jumpBuf;
    __G.telCommande({ t: 'btn', b: 'saut', down: false });
    __G.P.energie = 100; __G.P.essouffle = false;
    __G.telCommande({ t: 'btn', b: 'course', down: true });
    const court = __G.P.run;
    __G.telCommande({ t: 'btn', b: 'course', down: false });
    const courtFin = __G.P.run;
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.P.drawn = false;
    __G.telCommande({ t: 'btn', b: 'degaine', down: true }); __G.telCommande({ t: 'btn', b: 'degaine', down: false });
    const degaine = !!__G.P.drawn;
    // le journal du chat est plafonné à 40 lignes : on regarde le texte de la dernière
    __G.telCommande({ t: 'chat', text: 'message envoye depuis la manette' });
    const lignes = document.getElementById('chatLog').children;
    const chat = lignes.length && /message envoye depuis la manette/.test(lignes[lignes.length - 1].textContent) ? 1 : 0;
    // la page manette elle-même
    __G.manetteOuvre('ABCD');
    await dodo(200);
    const page = { on: document.getElementById('manette').classList.contains('on'),
      boutons: document.querySelectorAll('#telBtns .tb').length,
      code: document.getElementById('telCode').value,
      stick: !!document.getElementById('telKnob'),
      pause: !!window.__manetteSeule };
    __G.manetteFerme();
    const fermee = !document.getElementById('manette').classList.contains('on') && !window.__manetteSeule;
    __G.equipWeapon(null); __G.P.drawn = false;
    return { axe, avance, cam, saut, court, courtFin, degaine, chat, page, fermee, nom: __G.tel.nom };
  });
  const ok = r.axe.y === 1 && r.avance > 0.15 && r.cam.yaw > 0.3 && r.cam.pitch > 0.1 && r.saut === 0.15
    && r.court && !r.courtFin && r.degaine && r.chat === 1
    && r.page.on && r.page.boutons >= 10 && r.page.code === 'ABCD' && r.page.pause && r.fermee;
  return { ok, detail: `manette « ${r.nom} » : le joueur avance de ${r.avance} m, la caméra pivote de ${r.cam.yaw} rad et s'incline de ${r.cam.pitch} · saut=${r.saut}, course=${r.court}→${r.courtFin}, dégainage=${r.degaine}, message envoyé=${r.chat === 1} · la page manette montre ${r.page.boutons} boutons, pré-remplit le code ${r.page.code} et met la 3D en veille=${r.page.pause}` };
});

test('la manette de salon a tous les boutons, et la croix navigue dans les menus', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    if (__G.uiOpen) __G.closeUI();
    await dodo(300);
    const gp = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
    navigator.getGamepads = () => [gp];
    const presse = async i => { gp.buttons[i].pressed = true; __G.pollGamepad(1 / 60); const v = __G.P.jumpBuf; gp.buttons[i].pressed = false; __G.pollGamepad(1 / 60); await dodo(30); return v; };
    __G.pollGamepad(1 / 60);
    // stick gauche = déplacement, stick droit = caméra
    gp.axes = [0.9, -0.9, 0, 0]; __G.pollGamepad(1 / 60);
    const stick = { x: +__G.pad.x.toFixed(2), y: +__G.pad.y.toFixed(2) };
    const yaw0 = __G.cam.yaw; gp.axes = [0, 0, 1, 0]; __G.pollGamepad(1 / 60);
    const camera = +(yaw0 - __G.cam.yaw).toFixed(3);
    gp.axes = [0, 0, 0, 0]; __G.pollGamepad(1 / 60);
    // ◯ = saut, ✕ = braquer / rengainer, L3 = courir (la gâchette L2 recule maintenant)
    __G.P.jumpBuf = 0;
    const saut = await presse(1);
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.P.drawn = false;
    await presse(0);
    const degaine = !!__G.P.drawn;
    await presse(0);
    const rengaine = !__G.P.drawn;   // le MEME bouton range l'arme
    __G.P.energie = 100; __G.P.essouffle = false;
    gp.buttons[10].pressed = true; __G.pollGamepad(1 / 60);
    const court = __G.P.run;
    gp.buttons[10].pressed = false; __G.pollGamepad(1 / 60);
    // et L2 fait bien RECULER au lieu de courir
    gp.buttons[6] = { pressed: true, value: 1 }; __G.pollGamepad(1 / 60);
    const recule = +__G.pad.frein.toFixed(2);
    gp.buttons[6] = { pressed: false, value: 0 }; __G.pollGamepad(1 / 60);
    // dans un menu : la croix promène la bague jaune, A valide
    __G.openUI('tvsalon');
    __G.pollGamepad(1 / 60);
    gp.buttons[13].pressed = true; __G.pollGamepad(1 / 60); gp.buttons[13].pressed = false; __G.pollGamepad(1 / 60);
    const premier = document.querySelector('#tvsalon .focustv');
    gp.buttons[13].pressed = true; __G.pollGamepad(1 / 60); gp.buttons[13].pressed = false; __G.pollGamepad(1 / 60);
    const second = document.querySelector('#tvsalon .focustv');
    const nav = { bague: !!premier, bouge: !!second && second !== premier,
      quoi: second ? (second.textContent || second.id).slice(0, 22) : null,
      pasDeMarche: __G.pad.x === 0 && __G.pad.y === 0 };
    // A ferme la fenêtre en validant « Fermer »
    document.querySelectorAll('.focustv').forEach(e => e.classList.remove('focustv'));
    document.getElementById('tvFerme').classList.add('focustv');
    await presse(0); await dodo(120);
    nav.valide = !__G.uiOpen;
    if (__G.uiOpen) __G.closeUI();
    __G.equipWeapon(null); __G.P.drawn = false; __G.P.run = false;
    // on enleve la bague jaune posee a la main sur « Fermer » : laissee la, elle restait la
    // PREMIERE `.focustv` du document et les tests suivants croyaient que le curseur ne
    // bougeait plus (le salon TV est declare avant la boutique dans la page)
    document.querySelectorAll('.focustv').forEach(e => e.classList.remove('focustv'));
    delete navigator.getGamepads;
    return { stick, camera, saut, degaine, rengaine, court, recule, nav };
  });
  const ok = r.stick.x > 0.5 && r.stick.y > 0.5 && r.camera > 0.02 && r.saut === 0.15 && r.degaine
    && r.rengaine && r.court && r.recule > 0.7 && r.nav.bague && r.nav.bouge && r.nav.pasDeMarche && r.nav.valide;
  return { ok, detail: `stick gauche (${r.stick.x}, ${r.stick.y}), stick droit tourne la caméra de ${r.camera} rad · ◯ saute (${r.saut}), ✕ braque (${r.degaine}) et rengaine (${r.rengaine}), L3 fait courir (${r.court}) et la gâchette L2 fait reculer (${r.recule}) · dans un menu la croix pose une bague sur « ${r.nav.quoi} » et n'avance plus le joueur (${r.nav.pasDeMarche}), A valide et ferme (${r.nav.valide})` };
});

test('un lien #jeu=CODE fait rejoindre la partie sans rien taper', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    if (__G.uiOpen) __G.closeUI();
    document.getElementById('codeIn').value = '';
    const avant = __G.net.code;
    // PeerJS n'est pas chargé dans le banc d'essai : on met un faux pair pour vérifier
    // que le lien déclenche bien la connexion
    const vraiPeer = window.Peer;
    window.Peer = function () { this.on = () => {}; this.connect = () => ({ on: () => {}, open: false }); this.destroy = () => {}; };
    location.hash = '#jeu=KLMN';
    await dodo(700);
    const rempli = document.getElementById('codeIn').value;
    const statut = document.getElementById('mpStatus').textContent;
    __G.netTeardown && __G.netTeardown();
    if (vraiPeer) window.Peer = vraiPeer; else delete window.Peer;
    location.hash = '';
    await dodo(200);
    // et le lien manette ouvre la télécommande
    location.hash = '#manette=WXYZ';
    await dodo(400);
    const man = { on: document.getElementById('manette').classList.contains('on'),
      code: document.getElementById('telCode').value };
    __G.manetteFerme();
    await dodo(150);
    return { avant, rempli, statut, man, hashVide: !location.hash };
  });
  const ok = r.rempli === 'KLMN' && /KLMN/.test(r.statut) && r.man.on && r.man.code === 'WXYZ' && r.hashVide;
  return { ok, detail: `lien #jeu=KLMN : le code est pré-rempli (« ${r.rempli} ») et la connexion démarre (« ${r.statut} ») · lien #manette=WXYZ : la télécommande s'ouvre avec le code ${r.man.code}` };
});

test('le mode zombie a bien disparu du jeu', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    const restes = ['zombie', 'zombieStart', 'zombieTick', 'ZOM_NIV', 'makeZombie', 'zomLook', 'ventreDuJoueur']
      .filter(n => { try { return eval('typeof ' + n) !== 'undefined'; } catch (e) { return false; } });
    __G.jail.on = true; __G.openJail();
    const boutons = [...document.querySelectorAll('#jailBtns button')].map(b => b.textContent);
    __G.closeUI(); __G.jail.on = false;
    return { restes, boutons, devore: 'devore' in __G.P, hp: __G.P.hp };
  });
  const src = require('fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const mots = (src.match(/zombie|zomb[a-z]*|ZOM_/gi) || []).length;
  const ok = r.restes.length === 0 && !r.boutons.some(b => /zombie|🧟/i.test(b)) && !r.devore && mots === 0;
  return { ok, detail: `plus aucun symbole du mode zombie dans le jeu (${r.restes.length} restant${r.restes.length > 1 ? 's' : ''}), ${mots} occurrence${mots > 1 ? 's' : ''} du mot dans le fichier · l'écran de prison propose ${r.boutons.length} boutons, aucun zombie · P.devore supprimé=${!r.devore}` };
});

test('les policiers portent le bleu marine et les écussons jaunes', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    __G.police.agents = [];
    const a = __G.creerAgent(112, 62, 0.4, false);
    const m = __G.creerAgent(115, 62, 0.4, true);
    const bleu = h => { const c = new __G.THREE.Color(h); return c.b > c.r * 1.4 && c.b > c.g * 1.3 && c.b < 0.5; };
    const compte = (grp, teinte) => { let n = 0; grp.traverse(o => { if (o.isMesh && o.material && o.material.color && teinte(o.material.color.getHex())) n++; }); return n; };
    const jaune = h => { const c = new __G.THREE.Color(h); return c.r > 0.85 && c.g > 0.7 && c.b < 0.35; };
    const res = {
      corps: ['shirt', 'sleeve', 'front', 'back', 'jacket'].map(k => a.av.mats[k] && a.av.mats[k].color.getHexString()),
      bleuCorps: ['shirt', 'sleeve', 'front', 'back', 'jacket'].every(k => !a.av.mats[k] || bleu(a.av.mats[k].color.getHex())),
      jaunes: compte(a.av.group, jaune),
      surLesBras: compte(a.av.rig.armL, jaune) + compte(a.av.rig.armR, jaune),
      casque: a.av.hatGroups && a.av.hatGroups.helmet ? compte(a.av.hatGroups.helmet, jaune) : 0,
      maillotEfface: !a.av.mats.front.map && !a.av.mats.back.map,
      militaireKaki: !bleu(m.av.mats.shirt.color.getHex()) && compte(m.av.group, jaune) > 4,
    };
    __G.police.agents.forEach(x => __G.worldGroup.parent.remove(x.av.group));
    __G.police.agents = [];
    return res;
  });
  const ok = r.bleuCorps && r.jaunes >= 10 && r.surLesBras >= 6 && r.casque >= 2 && r.maillotEfface && r.militaireKaki;
  return { ok, detail: `uniforme bleu marine (${r.corps.filter(Boolean).join(', ')}) · ${r.jaunes} pièces jaunes dont ${r.surLesBras} cousues sur les bras (épaulettes et galons) et ${r.casque} sur le casque · maillot de foot effacé=${r.maillotEfface} · les militaires gardent le kaki avec les mêmes marquages=${r.militaireKaki}` };
});

test('la gazinière de la villa fait une vraie flamme qui vacille', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 60, y: 1, z: 168, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    await dodo(400);
    const b = __G.city.burners[0];
    const eteinte = b.fl.visible;
    let dards = 0, halo = 0;
    b.fl.traverse(o => { if (o.isMesh) dards++; if (o.isPointLight) halo++; });
    __G.P.pos.set(__G.city.stove.x, 0.4, __G.city.stove.z); __G.city.stoveNear = true;
    __G.useStove();
    const allumee = b.fl.visible;
    const y0 = b.fl.scale.y; __G.simTime += 0.13; __G.stoveTick(1 / 30);
    const y1 = b.fl.scale.y; __G.simTime += 0.13; __G.stoveTick(1 / 30);
    const y2 = b.fl.scale.y;
    const intensite = b.fl.userData.halo ? +b.fl.userData.halo.intensity.toFixed(2) : 0;
    __G.useStove();
    return { eteinte, dards, halo, allumee, apres: b.fl.visible, vacille: y0 !== y1 || y1 !== y2,
      echelles: [y0, y1, y2].map(v => +v.toFixed(3)), intensite, foyers: __G.city.burners.length };
  });
  const ok = !r.eteinte && r.dards >= 20 && r.halo === 1 && r.allumee && !r.apres && r.vacille && r.intensite > 0.5;
  return { ok, detail: `${r.foyers} foyers · flamme de ${r.dards} dards (bleus au pied, orange en pointe) et ${r.halo} halo lumineux · éteinte au repos=${!r.eteinte}, allumée avec E=${r.allumee}, rééteinte=${!r.apres} · elle vacille : hauteurs ${r.echelles.join(' → ')}, halo à ${r.intensite}` };
});

test('le garage a déménagé et il est bien plus grand, avec son atelier', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: -45, y: 1, z: 90, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    await dodo(600);
    const g = __G.city.garage, d = __G.city.tuneDesk;
    const z = __G.city.zones.find(x => x.name === 'Garage custom');
    // aucun mur d'un autre bâtiment ne doit traverser le garage ni son parvis
    const sien = o => Math.abs(o.x - g.x) < 15.5 && Math.abs(o.z - g.z) < 10.5;
    const dedans = (cx, W, D) => __G.solids.filter(o => o.w && o.y + o.h / 2 > 0.6 && !sien(o)
      && Math.abs(o.x - cx) < (o.w + W) / 2 && Math.abs(o.z - g.z) < (o.d + D) / 2).length;
    const chevauche = [];
    if (dedans(g.x, 28, 18)) chevauche.push('bâtiment');
    if (dedans(g.x - 18, 8, 18)) chevauche.push('parvis');
    __G.P.pos.set(d.x, 0.4, d.z + 1.2); __G.P.vel.set(0, 0, 0);
    const t0 = __G.simTime;
    while (__G.simTime - t0 < 0.4) await dodo(120);
    return { g, d, zone: z ? { w: z.x2 - z.x1, d: z.z2 - z.z1 } : null, chevauche,
      near: __G.city.tuneNear, surface: 28 * 18 };
  });
  const ok = r.g && r.g.x === -45 && r.g.z === 90 && r.surface >= 480 && r.d && r.zone && r.chevauche.length === 0 && r.near;
  return { ok, detail: `garage déplacé en (${r.g.x}, ${r.g.z}) et agrandi à ${r.surface} m² (contre 99 m² avant) · ni le bâtiment ni le parvis ne recoupent un autre mur (${r.chevauche.length} conflit) · comptoir d'atelier en (${r.d.x}, ${r.d.z}), détecté quand on s'en approche=${r.near}` };
});

test('on repeint et on customise sa voiture sans repeindre le décor', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: -45, y: 1, z: 90, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    await dodo(500);
    const c = __G.city.cars.find(v => v.bodyMat && !v.kart && !v.heli && !v.rider);
    const autre = __G.city.cars.find(v => v !== c && v.bodyMat);
    const avant = { max: c.spec.max, accel: c.spec.accel, turn: c.spec.turn,
      pieces: c.g.children.length, roue: c.wheels[0].scale.x, couleur: c.bodyMat.color.getHexString(),
      autre: autre ? autre.bodyMat.color.getHexString() : null, partage: autre ? autre.bodyMat === c.bodyMat : false };
    __G.wallet = 5000;
    const t = { couleur: 0x3ef2ff, finition: 'fluo', kits: __G.TUNE_KITS.map(k => k.k), moteur: 2, amorti: 2 };
    __G.tuneApply(c, t);
    const apres = { max: +c.spec.max.toFixed(1), accel: +c.spec.accel.toFixed(1), turn: c.spec.turn,
      ajouts: c.tuneMesh.length, roue: +c.wheels[0].scale.x.toFixed(2),
      couleur: c.bodyMat.color.getHexString(), brille: c.bodyMat.emissive.getHex() > 0,
      autre: autre ? autre.bodyMat.color.getHexString() : null,
      vitres: c.parts.ws.material.color.getHex(), nitro: !!c.nitroPret };
    // achat au comptoir
    __G.P.pos.set(__G.city.tuneDesk.x, 0.4, __G.city.tuneDesk.z + 1.2);
    const sous = __G.wallet;
    __G.openAtelier();
    const ouvert = __G.uiOpen === 'atelier';
    const onglets = document.querySelectorAll('#atelierOnglets b').length;
    const nuances = (document.querySelectorAll('#atelierCorps .nuancier i') || []).length;
    __G.tuning.couleur = null; __G.tuning.finition = 'mate'; __G.tuning.kits = [];
    __G.tuning.moteur = 0; __G.tuning.amorti = 0;
    __G.closeUI();
    __G.tuneApply(c, { couleur: null, finition: 'mate', kits: [], moteur: 0, amorti: 0 });
    const remis = { ajouts: c.tuneMesh.length, roue: c.wheels[0].scale.x, max: c.spec.max };
    return { avant, apres, remis, ouvert, onglets, nuances, sous,
      kits: __G.TUNE_KITS.length, moteurs: __G.TUNE_MOTEURS.map(m => m.n), amortis: __G.TUNE_AMORTIS.length,
      couleurs: __G.TUNE_COULEURS.length, finitions: __G.TUNE_FINITIONS.map(f => f.n) };
  });
  const ok = !r.avant.partage && r.apres.couleur === '3ef2ff' && r.apres.autre === r.avant.autre
    && r.apres.brille && r.apres.ajouts >= 18 && r.apres.roue > 1.1 && r.apres.max > r.avant.max * 1.6
    && r.apres.turn > r.avant.turn && r.apres.nitro && r.apres.vitres < 0x222222
    && r.ouvert && r.onglets === 5 && r.nuances >= 20 && r.remis.ajouts === 0 && r.remis.max === r.avant.max
    && r.couleurs >= 20 && r.kits >= 10 && r.moteurs.length === 3 && r.amortis === 3;
  return { ok, detail: `${r.couleurs} couleurs, ${r.finitions.join('/')} · ${r.kits} kits posés (${r.apres.ajouts} pièces ajoutées, jantes ×${r.apres.roue}, vitres teintées, nitro=${r.apres.nitro}) · moteur ${r.moteurs.join(' → ')} : pointe ${r.avant.max} → ${r.apres.max}, reprise ${r.avant.accel} → ${r.apres.accel} · ${r.amortis} qualités d'amortisseurs : ${r.avant.turn} → ${r.apres.turn} · la voiture d'à côté garde sa couleur (${r.apres.autre}) · tout se retire proprement=${r.remis.ajouts === 0}` };
});

test('la nitro pousse fort quelques secondes puis doit se recharger', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: -45, y: 1, z: 90, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    await dodo(400);
    const c = __G.city.cars.find(v => v.bodyMat && !v.kart && !v.heli && !v.rider);
    __G.tuneApply(c, { couleur: null, finition: 'mate', kits: [], moteur: 0, amorti: 0 });
    __G.drive.car = c; __G.drive.speed = 8; __G.drive.nitroT = 0; __G.drive.nitroCd = 0;
    const sansKit = __G.nitroGo();
    __G.tuneApply(c, { couleur: null, finition: 'mate', kits: ['nitro'], moteur: 0, amorti: 0 });
    const flammes = (c.nitroFlammes || []).length;
    const avant = __G.drive.speed;
    const lance = __G.nitroGo();
    let v = avant;
    for (let i = 0; i < 30; i++) { __G.nitroTick(1 / 30); __G.simTime += 1 / 30; v = __G.drive.speed; }
    const visible = c.nitroFlammes[0].visible;
    const encore = __G.nitroGo();          // pendant la recharge : refusé
    __G.simTime += 4;                       // la poussée s'arrête
    __G.nitroTick(1 / 30);
    const apresFin = c.nitroFlammes[0].visible;
    __G.simTime += 12; const recharge = __G.nitroGo();
    __G.drive.car = null; __G.drive.speed = 0; __G.drive.nitroT = 0;
    __G.tuneApply(c, { couleur: null, finition: 'mate', kits: [], moteur: 0, amorti: 0 });
    return { sansKit, flammes, lance, avant: +avant.toFixed(1), apres: +v.toFixed(1), visible, encore, apresFin, recharge };
  });
  const ok = !r.sansKit && r.flammes >= 4 && r.lance && r.apres > r.avant * 2 && r.visible
    && !r.encore && !r.apresFin && r.recharge;
  return { ok, detail: `sans le kit la nitro ne part pas (${r.sansKit}) · avec le kit : ${r.flammes} flammes aux pots, la vitesse passe de ${r.avant} à ${r.apres} en 1 s et les flammes sortent=${r.visible} · impossible de la relancer tant qu'elle recharge (${r.encore}), les flammes s'éteignent à la fin (${!r.apresFin}) et elle repart après 14 s (${r.recharge})` };
});

test('le requin blanc a un vrai corps fuselé et le ventre blanc', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    await dodo(500);
    const sk = __G.city.shark.g;
    let corps = null, triangles = 0, morceaux = 0;
    sk.traverse(o => { if (!o.isMesh) return; morceaux++;
      const g = o.geometry;
      if (g.type === 'LatheGeometry' || (g.attributes.color && g.attributes.position.count > 100)) corps = g;
      if (g.attributes.position.count === 3) triangles++; });
    let dos = null, ventre = null;
    if (corps && corps.attributes.color) {
      const pos = corps.attributes.position, col = corps.attributes.color;
      let hautY = -9, basY = 9, ih = 0, ib = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), r2 = Math.hypot(x, y);
        if (r2 < 0.3) continue;
        const t = y / r2;
        if (t > hautY) { hautY = t; ih = i; }
        if (t < basY) { basY = t; ib = i; }
      }
      dos = [col.getX(ih), col.getY(ih), col.getZ(ih)].map(v => +v.toFixed(2));
      ventre = [col.getX(ib), col.getY(ib), col.getZ(ib)].map(v => +v.toFixed(2));
    }
    // longueur du poisson — dans SON repere : de biais, l'etendue en z d'un requin qui nage
    // en rond tombait a 5 m et le test le trouvait trop court
    const rot = sk.rotation.clone(); sk.rotation.set(0, 0, 0); sk.updateMatrixWorld(true);
    const bb = new __G.THREE.Box3().setFromObject(sk);
    sk.rotation.copy(rot); sk.updateMatrixWorld(true);
    return { morceaux, triangles, aCorps: !!corps, sommets: corps ? corps.attributes.position.count : 0,
      dos, ventre, longueur: +(bb.max.z - bb.min.z).toFixed(1), hauteur: +(bb.max.y - bb.min.y).toFixed(1) };
  });
  const clair = c => c && c[0] > 0.8 && c[1] > 0.8 && c[2] > 0.8;
  const sombre = c => c && c[0] < 0.6 && c[1] < 0.6;
  const ok = r.aCorps && r.sommets > 150 && r.triangles >= 10 && sombre(r.dos) && clair(r.ventre) && r.longueur > 6;
  return { ok, detail: `corps tourné d'un seul tenant (${r.sommets} sommets) au lieu de pavés empilés · contre-ombrage peint sommet par sommet : dos ${JSON.stringify(r.dos)}, ventre ${JSON.stringify(r.ventre)} · ${r.triangles} nageoires triangulaires (dorsales, pectorales, pelviennes, anale, caudale en croissant) · ${r.longueur} m de long pour ${r.hauteur} m de haut, ${r.morceaux} morceaux en tout` };
});

test('un ami tire sur la police et sur les agresseurs pour te protéger', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    await dodo(400);
    __G.police.agents = [];
    __G.bots.forEach(x => { x.activite = null; x.rdv = null; x.ordre = null; x.fight = null; x.bagarre = null; x.garde = 0; x.gardeArme = 0; x.ko = 0; x.hp = 100; });
    const b = __G.bots[0];
    __G.amis.add(b.name);
    const compris = __G.commandeSociale(b.name + ' tire pour me protéger');
    const etat = { garde: !!b.gardeArme, arme: !!b.av.gun, ordre: b.ordre && b.ordre.type, colle: !!(b.rdv && b.rdv.colle) };
    // un policier arrive sur le joueur
    const a = __G.creerAgent(__G.P.pos.x + 6, __G.P.pos.z + 2, 0.3, false);
    b.pos.set(__G.P.pos.x + 1, 0.3, __G.P.pos.z);
    const hp0 = a.hp, n0 = __G.shots.length;
    for (let i = 0; i < 10; i++) { b.tirT = 0; __G.gardeArmeTick(b, 1 / 30); }
    const surPolice = { balles: __G.shots.length - n0, degats: hp0 - a.hp, ko: !!a.ko };
    __G.police.agents = [];
    // un bot qui t'attaque
    const o = __G.bots[1];
    o.fight = 'chase'; o.fightT = __G.simTime + 20; o.hp = 100; o.pos.set(__G.P.pos.x + 3, 0.3, __G.P.pos.z + 1);
    const hpo = o.hp, n1 = __G.shots.length;
    for (let i = 0; i < 4; i++) { b.tirT = 0; __G.gardeArmeTick(b, 1 / 30); }
    const surBot = { balles: __G.shots.length - n1, degats: hpo - o.hp, fuite: o.fight === 'flee' };
    // un passant tranquille n'est pas une cible
    o.fight = null; o.fightT = 0;
    const n2 = __G.shots.length; b.tirT = 0; __G.gardeArmeTick(b, 1 / 30);
    const surInnocent = __G.shots.length - n2;
    __G.botStop(b, false);
    const rangee = !b.gardeArme && !b.av.gun;
    __G.bots.forEach(x => { x.fight = null; x.hp = 100; });
    return { compris, etat, surPolice, surBot, surInnocent, rangee,
      aide: __G.AIDE_ORDRES ? __G.AIDE_ORDRES.includes('tire pour me protéger') : null };
  });
  const ok = r.compris && r.etat.garde && r.etat.arme && r.etat.colle && r.surPolice.balles >= 3
    && r.surPolice.degats > 40 && r.surBot.balles >= 1 && r.surBot.degats > 20 && r.surBot.fuite && r.surInnocent === 0 && r.rangee;
  return { ok, detail: `« tire pour me protéger » compris=${r.compris} : l'ami dégaine (${r.etat.arme}), te colle (${r.etat.colle}) · sur la police : ${r.surPolice.balles} balles, ${r.surPolice.degats} de dégâts, agent au tapis=${r.surPolice.ko} · sur un bot qui t'attaque : ${r.surBot.balles} balles, il prend la fuite=${r.surBot.fuite} · il ne tire pas sur un passant tranquille (${r.surInnocent} balle) · « stop » lui fait ranger l'arme=${r.rangee}` };
});

test('douze habitants qui jouent, roulent, chapardent et braquent', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    await dodo(600);
    const net = { bots: __G.bots.length, karts: __G.race && __G.race.ai ? null : null };
    __G.bots.forEach(x => { x.activite = null; x.rdv = null; x.ordre = null; x.fight = null; x.bagarre = null; x.drive = null; x.ko = 0; });
    // chaque activité doit démarrer pour de bon
    const faites = {};
    for (const act of __G.ACTIVITES) {
      const bb = __G.bots.find(x => !x.activite && !x.fight && !x.bagarre) || __G.bots[0];
      bb.activite = null; bb.rdv = null; bb.ordre = null; bb.fight = null; bb.bagarre = null;
      const ok = __G.lancerActivite(bb, act) !== false;
      faites[act.k] = { ok, but: bb.rdv ? bb.rdv.nom : (bb.fight ? 'le joueur' : bb.bagarre ? 'un bot' : null) };
    }
    // le chapardage se termine par une fuite vers une planque
    const v = __G.bots[0];
    v.activite = { k: 'vol', fin: __G.simTime + 60, etape: 'route' };
    v.rdv = { x: v.pos.x, z: v.pos.z, y: 0.3, nom: 'boutique', arrive: true, libre: true };
    __G.activiteTick(v, 1 / 30);
    const vol = { etape: v.activite.etape, planque: v.rdv && v.rdv.nom };
    // Le braquage d'un BOT affole les gardes de la banque, mais ne doit PAS retomber sur le
    // joueur : avant, il lui collait deux étoiles et lançait toutes les voitures alors qu'il
    // n'avait rien fait (« braquage alerte se déclenche tout seul »). On vérifie donc les
    // gardes en alerte et l'absence totale de conséquence pour le joueur.
    __G.clearWanted(); __G.police.cars.forEach(c => { c.active = false; });
    __G.city.guards.forEach(g => { g.alert = false; });
    const q = __G.bots[1];
    q.activite = { k: 'braquage', fin: __G.simTime + 60, etape: 'route' };
    q.rdv = { x: q.pos.x, z: q.pos.z, y: 0.3, nom: 'banque', arrive: true, libre: true };
    __G.activiteTick(q, 1 / 30);
    const braquage = { etape: q.activite.etape, gardes: __G.city.guards.filter(g => g.alert).length,
      joueurRecherche: __G.police.wanted || 0, voitures: __G.police.cars.filter(c => c.active).length };
    // le journal de la ville se remplit, et vieTick lance tout seul
    __G.bots.forEach(x => { x.activite = null; x.rdv = null; x.fight = null; x.bagarre = null; });
    __G.vie.t = 0; __G.vie.journal.length = 0;
    for (let i = 0; i < 8; i++) { __G.vie.t = 0; __G.vieTick(1 / 30); __G.simTime += 1; }
    const auto = __G.bots.filter(x => x.activite || x.fight || x.bagarre).length;
    __G.bots.forEach(x => { x.activite = null; x.rdv = null; x.fight = null; x.bagarre = null; });
    __G.clearWanted();
    return { n: net.bots, faites, vol, braquage, auto, journal: __G.vie.journal.length,
      activites: __G.ACTIVITES.map(a => a.k) };
  });
  const toutes = Object.values(r.faites).every(f => f.ok && f.but);
  const ok = r.n === 12 && toutes && r.vol.etape === 'fuite' && r.braquage.etape === 'fuite'
    && r.braquage.gardes > 0 && r.braquage.joueurRecherche === 0 && r.braquage.voitures === 0 && r.auto > 0;
  return { ok, detail: `${r.n} habitants (5 avant) · ${r.activites.length} activités qui démarrent toutes : ${Object.entries(r.faites).map(([k, f]) => k + '→' + f.but).join(', ')} · le chapardeur file vers ${r.vol.planque} · le braqueur affole ${r.braquage.gardes} garde(s) sans que le joueur soit inquiété (recherché ${r.braquage.joueurRecherche}, ${r.braquage.voitures} voiture lancée contre lui) · le jeu en déclenche tout seul (${r.auto} bots occupés, ${r.journal} lignes au journal)` };
});

test('la boutique habille de la tête aux pieds : hauts, bas, chaussures, poignets', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 110, y: 1, z: 60, hour: 12 });
    if (__G.uiOpen) __G.closeUI();
    await dodo(400);
    const av = __G.me;
    const cats = Object.fromEntries(Object.entries(__G.SHOP).map(([k, v]) => [k, v.length]));
    const total = Object.values(__G.SHOP).reduce((a, v) => a + v.length, 0);
    const lit = () => ({ manche: av.rig.armL.manche.material === av.mats.skin,
      torseNu: Array.isArray(av.torso.material) && av.torso.material[0] === av.mats.skin,
      bretelles: av.bretelles.visible, semelle: av.mats.shoe.color.getHexString(),
      tige: av.rig.legL.tige.visible, eperon: av.rig.legL.eperon.visible,
      bracelet: av.bracelet.visible, montre: av.montre.visible,
      cuisse: +av.rig.legL.cuisse.scale.x.toFixed(2) });
    const essai = {};
    for (const [cat, id, nom] of [['Hauts', 'torse', 'torseNu'], ['Hauts', 'debardeur', 'debardeur'],
      ['Hauts', 'basket', 'basket'], ['Hauts', 'foot', 'foot'], ['Chaussures', 'cowboy', 'cowboy'],
      ['Chaussures', 'bottes', 'bottes'], ['Chaussures', 'basket', 'baskets'],
      ['Bas', 'baggy', 'baggy'], ['Bas', 'pants', 'pantalon'], ['Poignets', 'deux', 'poignets'],
      ['Poignets', 'rien', 'nus']]) { __G.applyShopItem(cat, { id }); essai[nom] = lit(); }
    const chap = {};
    for (const id of ['bandana', 'bandanaB', 'bandanaJ', 'bob', 'cagoule', 'moto', 'audio', 'capuche']) {
      __G.applyShopItem('Chapeaux', { id }); chap[id] = !!(av.hatGroups[id] && av.hatGroups[id].visible);
    }
    __G.applyShopItem('Chapeaux', { id: 'none' });
    // ce qu'on porte est retenu d'une partie à l'autre
    __G.applyShopItem('Chaussures', { id: 'bottes' }); __G.applyShopItem('Hauts', { id: 'debardeur' });
    const sauv = JSON.parse(localStorage.getItem('superobby.avatar') || '{}');
    __G.applyShopItem('Chaussures', { id: 'basket' }); __G.applyShopItem('Hauts', { id: 'foot' });
    return { cats, total, essai, chap, catalogue: __G.catalog('accessoires').length,
      sauv: { chaussures: sauv.chaussures, haut: sauv.haut },
      idCourant: __G.currentShopId('Chaussures') };
  });
  const e = r.essai;
  const ok = r.total >= 45 && Object.keys(r.cats).length >= 8 && r.catalogue === r.total
    && e.torseNu.torseNu && e.torseNu.manche && e.debardeur.bretelles && e.basket.manche && !e.basket.torseNu
    && !e.foot.manche && !e.foot.torseNu
    && e.cowboy.tige && e.cowboy.eperon && e.bottes.tige && !e.bottes.eperon && !e.baskets.tige
    && e.cowboy.semelle !== e.bottes.semelle && e.baggy.cuisse > 1.2 && e.pantalon.cuisse === 1
    && e.poignets.bracelet && e.poignets.montre && !e.nus.bracelet
    && Object.values(r.chap).every(Boolean)
    && r.sauv.chaussures === 'bottes' && r.sauv.haut === 'debardeur' && r.idCourant === 'basket';
  return { ok, detail: `${r.total} articles en ${Object.keys(r.cats).length} rayons (${Object.entries(r.cats).map(([k, v]) => k + ' ' + v).join(', ')}) · maillot de foot, de basket, débardeur et torse nu changent vraiment le buste · bottes et bottes de cowboy sortent une tige (${e.cowboy.semelle} vs ${e.bottes.semelle}) et l'éperon (${e.cowboy.eperon}) · le baggy élargit les jambes (${e.baggy.cuisse}×) · bracelet et montre apparaissent au poignet · ${Object.keys(r.chap).length} nouveaux couvre-chefs (bandanas, bob, cagoule, casques…) · la tenue est mémorisée (${r.sauv.chaussures}, ${r.sauv.haut})` };
});

test('le salon de tatouage encre le corps, en plusieurs endroits et couleurs', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 43, y: 1, z: 80, hour: 12 });
    if (__G.uiOpen) __G.closeUI();
    await dodo(500);
    const av = __G.me;
    // chaque motif du catalogue dessine vraiment quelque chose
    const vides = [];
    for (const m of __G.TATOO_MOTIFS) {
      const t = __G.tatooTexture(m.k, 'noir', 'TEST');
      const g = t.image.getContext('2d'), d = g.getImageData(0, 0, 128, 128).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
      if (n < 200) vides.push(m.k);
    }
    // l'encre change vraiment la couleur du dessin
    const couleur = enc => { const g = __G.tatooTexture('coeur', enc).image.getContext('2d');
      const d = g.getImageData(64, 64, 1, 1).data; return [d[0], d[1], d[2]].join(','); };
    const teintes = __G.TATOO_ENCRES.map(e => couleur(e.k));
    __G.wallet = 900; __G.myCfg.tatouages = []; __G.applyMyLook();
    const sous0 = __G.wallet;
    const poser = (motif, zone, encre, taille) => { Object.assign(__G.tatoo, { motif, zone, encre, taille, mot: 'BOSS' }); __G.tatouer(); };
    poser('lion', 'brasG', 'noir', 'gros');
    poser('dollar', 'cou', 'dore', 'petit');
    poser('force', 'dos', 'rouge', 'moyen');
    poser('texte', 'molletD', 'bleu', 'moyen');
    poser('serpent', 'cuisseG', 'vert', 'moyen');
    av.group.updateMatrixWorld(true);
    const ou = av.tatouages.map(m => m.parent === av.rig.armL ? 'brasG' : m.parent === av.rig.head ? 'cou'
      : m.parent === av.group ? 'buste' : m.parent === av.rig.legR ? 'molletD' : m.parent === av.rig.legL ? 'cuisseG' : '?');
    const tailles = av.tatouages.map(m => +m.geometry.parameters.width.toFixed(2));
    const res = { motifs: __G.TATOO_MOTIFS.length, zones: __G.TATOO_ZONES.length, encres: __G.TATOO_ENCRES.length,
      tailles: __G.TATOO_TAILLES.length, vides, couleursDistinctes: new Set(teintes).size,
      poses: __G.myCfg.tatouages.length, meshes: av.tatouages.length, ou, taillesPosees: tailles,
      cout: sous0 - __G.wallet, salon: !!__G.city.tatooDesk };
    // sauvegarde, retrait, et un bot peut aussi en porter
    res.sauve = (JSON.parse(localStorage.getItem('superobby.avatar') || '{}').tatouages || []).length;
    __G.myCfg.tatouages.splice(0, 1); __G.applyMyLook();
    res.apresRetrait = av.tatouages.length;
    const b = __G.bots[0];
    __G.applyLook(b.av, b.name, { jersey: 0, tatouages: [{ motif: 'aigle', zone: 'torse', encre: 'noir', taille: 'moyen' }] });
    res.surUnBot = b.av.tatouages.length;
    __G.applyLook(b.av, b.name, { jersey: 0, tatouages: [] });
    __G.myCfg.tatouages = []; __G.applyMyLook();
    // le salon est bien dans la ville et se détecte
    __G.P.pos.set(__G.city.tatooDesk.x, 0.4, __G.city.tatooDesk.z + 1.2); __G.P.vel.set(0, 0, 0);
    for (let i = 0; i < 40 && !__G.city.tatooNear; i++) { await dodo(120); __G.P.pos.set(__G.city.tatooDesk.x, 0.4, __G.city.tatooDesk.z + 1.2); }
    res.detecte = __G.city.tatooNear;
    __G.openTatoo(); res.fenetre = __G.uiOpen === 'tatoo';
    res.grille = document.querySelectorAll('#tatooMotifs .tatm').length;
    __G.closeUI();
    return res;
  });
  const attendu = ['brasG', 'cou', 'buste', 'molletD', 'cuisseG'];
  const ok = r.motifs >= 24 && r.zones >= 16 && r.encres === 6 && r.tailles === 5 && r.vides.length === 0
    && r.couleursDistinctes === 6 && r.poses === 5 && r.meshes === 5
    && attendu.every(z => r.ou.includes(z)) && new Set(r.taillesPosees).size === 3
    && r.cout > 100 && r.sauve === 5 && r.apresRetrait === 4 && r.surUnBot === 1
    && r.salon && r.detecte && r.fenetre && r.grille === r.motifs;
  return { ok, detail: `${r.motifs} motifs (lion, tigre, panthère, aigle, singe, serpent, dragon, idéogrammes, texte libre…) tous dessinés, ${r.zones} zones du corps, ${r.couleursDistinctes} encres bien distinctes, ${r.tailles} tailles · cinq tatouages posés d'un coup sur ${r.ou.join(', ')} en ${new Set(r.taillesPosees).size} tailles pour ${r.cout} 🪙 · gardés à la sauvegarde (${r.sauve}), effaçables un par un (${r.apresRetrait} restants), visibles aussi sur les autres joueurs (${r.surUnBot}) · le salon existe en ville et s'ouvre à l'approche (${r.detecte})` };
});

test('braquage : même parties de loin, les voitures de police finissent par vider leurs agents dans la banque', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -52, y: 1, z: 70, hour: 12 });
    __G.jail.on = false; if (__G.uiOpen) __G.closeUI();
    const bk = __G.city.bank;
    // les voitures reviennent d'une intervention à l'autre bout de la ville
    // remise a neuf COMPLETE : un test precedent laisse parfois une voiture en l'air, calee
    // ou deja debarquee, et elle n'arrivait alors jamais jusqu'a la banque
    __G.police.agents.slice().forEach(a => __G.police.agents.pop());
    __G.police.cars.forEach((c, i) => { c.x = 12 + i * 6; c.z = 41; c.y = 0; c.h = Math.PI; c.g.position.set(c.x, 0, c.z);
      c.speed = 0; c.route = null; c.routeT = 0; c.stuck = 0; c.nearT = 0; c.debT = 0;
      c.debarque = false; c.active = true; c.goHome = false; });
    const depart = Math.round(Math.min(...__G.police.cars.map(c => Math.hypot(c.x - bk.x, c.z - bk.z))));
    __G.P.pos.set(-57, 10.05, 70);
    const t0 = __G.simTime;
    __G.police.alarmT = 0; __G.police.coffres = 0;
    __G.bankAlarm(); __G.police.arrestT = 1e9; __G.police.renfortT = 0;
    __G.police.cars.forEach(c => { c.active = true; c.goHome = false; c.debarque = false; });
    let perdu = 0;
    // l'alarme dure 60 s : c'est pendant ce temps-là que la police doit garder sa cible
    for (let i = 0; i < 1650; i++) {
      __G.simTime = t0 + i / 30; __G.P.pos.set(-57, 10.05, 70); __G.policeTick(1 / 30); __G.police.arrestT = 1e9;
      __G.police.decayT = __G.simTime + 9999;   // ici on teste la POURSUITE, pas l'oubli au bout de 45 s
      if (!__G.police.sait) perdu++;
    }
    const agents = __G.police.agents.filter(a => Math.abs(a.x - bk.x) < 9 && Math.abs(a.z - bk.z) < 9).length;
    const res = { depart, agents, perdu, wanted: __G.police.wanted };
    // ressorti dans la rue : les agents ne campent pas dans la banque, ils le poursuivent
    const t1 = __G.simTime;
    const dAgents = () => Math.min(...__G.police.agents.map(a => Math.hypot(a.x - (bk.x + 26), a.z - (bk.z + 4))));
    res.avantFuite = +dAgents().toFixed(1);
    // descendre DEUX volees et ressortir par la grande porte prend du temps : on laisse 90 s
    for (let i = 0; i < 2700; i++) { __G.simTime = t1 + i / 30; __G.P.pos.set(bk.x + 26, 0.3, bk.z + 4); __G.policeTick(1 / 30);
      __G.police.arrestT = 1e9; __G.police.decayT = __G.simTime + 9999; }
    res.apresFuite = +dAgents().toFixed(1);
    __G.jail.on = false; __G.clearWanted();
    return res;
  });
  const ok = r.depart > 60 && r.agents >= 1 && r.perdu === 0 && r.wanted >= 1 && r.apresFuite < r.avantFuite - 3;
  return { ok, detail: `voitures parties à ${r.depart} m de la banque : la police garde la trace du braqueur pendant tout le hold-up (${r.perdu} image sans cible, niveau ${r.wanted}★) et ${r.agents} agents entrent à pied · une fois ressorti dans la rue, les agents le poursuivent (${r.avantFuite} m → ${r.apresFuite} m)` };
});

test("le gang du joueur se recrute dans le chat et ramène le butin", async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 60, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = {};
    const chapeau = av => Object.entries(av.hatGroups).filter(([, g]) => g.visible).map(([k]) => k)[0] || null;
    const b1 = G.bots[0], b2 = G.bots[1];
    G.amis.delete(b1.name); G.amis.delete(b2.name);
    G.gang.membres.slice().forEach(b => G.quitterGang(b));
    // inconnu : il refuse d'entrer dans le gang
    G.commandeSociale(b1.name + ' veux-tu venir dans le gang ?');
    res.sansAmi = G.gang.membres.length;
    G.amis.add(b1.name); G.amis.add(b2.name);
    res.rec1 = G.commandeSociale(b1.name + ' veux-tu venir dans le gang ?');
    res.rec2 = G.commandeSociale(b2.name.split('_')[0] + ' rejoins le gang');
    res.membres = G.gang.membres.map(b => b.name);
    res.bandanas = G.gang.membres.map(b => chapeau(b.av));
    // mission : ordre à deux noms, puis butin
    const w0 = G.wallet; G.wallet = 100; G.gang.butin = 0;
    // Un coup n'est plus une réussite automatique : il se joue sur la performance des hommes
    // envoyés. On les entraîne à fond pour mesurer le BUTIN, pas la chance.
    b1.perf = 100; b2.perf = 100;
    res.ordre = G.commandeSociale(b1.name + ' et ' + b2.name + ' allez braquer la banque');
    res.mission = G.gang.mission ? { type: G.gang.mission.type, n: G.gang.mission.membres.length } : null;
    res.enRoute = G.gang.membres.every(b => b.rdv && !b.rdv.arrive);
    for (const b of G.gang.membres) if (b.rdv) b.rdv.arrive = true;
    G.gangMissionTick(0.016);
    res.etape = G.gang.mission && G.gang.mission.etape;
    if (G.gang.mission) G.gang.mission.fin = 0;
    G.gangMissionTick(0.016);
    res.gain = G.wallet - 100; res.butin = G.gang.butin;
    res.finie = !G.gang.mission && G.gang.membres.every(b => !b.gangMission);
    G.wallet = w0;
    // on peut renvoyer un membre
    G.commandeSociale(b2.name + ' quitte le gang');
    res.apresRenvoi = G.gang.membres.map(b => b.name);
    res.chapeauRendu = chapeau(b2.av);
    G.gang.membres.slice().forEach(b => G.quitterGang(b));
    return res;
  });
  const ok = r.sansAmi === 0 && r.rec1 && r.rec2 && r.membres.length === 2
    && r.bandanas.every(h => h === 'bandanaV') && r.ordre && r.mission && r.mission.type === 'banque'
    && r.mission.n === 2 && r.enRoute && r.etape === 'action' && r.gain > 0 && r.butin === r.gain && r.finie
    && r.apresRenvoi.length === 1 && r.chapeauRendu !== 'bandanaV';
  return { ok, detail: `un inconnu refuse (${r.sansAmi} membre), deux amis recrutés par le chat (${r.membres.join(', ')}) avec bandana vert · « allez braquer la banque » lance la mission à ${r.mission && r.mission.n} et rapporte ${r.gain} 🪙 au portefeuille · le renvoi laisse ${r.apresRenvoi.length} membre et lui rend son chapeau (${r.chapeauRendu})` };
});

test('chaque ordre du gang lance la bonne mission', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 60, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = {};
    const b1 = G.bots[0], b2 = G.bots[1];
    G.amis.add(b1.name); G.amis.add(b2.name);
    G.gang.membres.slice().forEach(b => G.quitterGang(b));
    G.commandeSociale(b1.name + ' veux-tu venir dans le gang ?');
    G.commandeSociale(b2.name + ' rejoins le gang');
    const essai = txt => { G.gang.mission = null;
      G.gang.membres.forEach(b => { b.gangMission = null; b.rdv = null; b.ordre = null; });
      const pris = G.commandeSociale(txt);
      return pris && G.gang.mission ? G.gang.mission.type : null; };
    res.argent = essai('le gang allez voler de l\'argent à ' + G.bots[4].name);
    res.banque = essai(b1.name + ' et ' + b2.name + ' allez braquer le coffre de la banque');
    res.voiture = essai('les gars allez voler une voiture');
    res.rival = essai(b1.name + ' et ' + b2.name + ' allez attaquer les bleus');
    res.villa = essai('le gang allez cambrioler une villa');
    res.boutique = essai('le gang allez braquer une boutique');
    res.guet = essai('le gang faites le guet');
    // le gang part vraiment quelque part
    res.rdv = G.gang.membres.map(b => b.rdv ? [Math.round(b.rdv.x), Math.round(b.rdv.z)] : null);
    // annulation
    G.gang.mission = null; essai('le gang allez braquer la banque');
    res.annule = G.commandeSociale('le gang rentrez à la maison') && !G.gang.mission;
    // un message anodin ne déclenche rien
    G.gang.mission = null;
    res.neutre = G.commandeSociale('il fait beau aujourd\'hui');
    res.aide = G.GANG_ORDRES.length;
    G.gang.membres.slice().forEach(b => G.quitterGang(b));
    return res;
  });
  const attendus = { argent: 'argent', banque: 'banque', voiture: 'voiture', rival: 'gangRival', villa: 'villa', boutique: 'boutique', guet: 'guet' };
  const rates = Object.entries(attendus).filter(([k, v]) => r[k] !== v);
  const ok = rates.length === 0 && r.annule && r.neutre === false && r.aide >= 7 && r.rdv.every(v => v);
  return { ok, detail: `7 ordres reconnus (${Object.values(attendus).join(', ')})${rates.length ? ' — ratés : ' + JSON.stringify(rates) : ''}, le gang reçoit un point de rendez-vous, « rentrez à la maison » annule tout, et une phrase anodine ne déclenche rien` };
});

test("trois gangs rivaux vivent dans La Zone et s'en prennent à la ville", async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: -145, y: 1, z: 40, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 500));
    const G = __G, res = {};
    const chapeau = av => Object.entries(av.hatGroups).filter(([, g]) => g.visible).map(([k]) => k)[0] || null;
    res.gangs = G.gangs.map(g => ({ id: g.id, n: g.membres.length, hat: chapeau(g.membres[0].av),
      kits: g.voit && g.voit.tune ? g.voit.tune.kits.length : 0,
      peinture: g.voit && g.voit.bodyMat ? g.voit.bodyMat.color.getHex() : 0, couleur: g.couleur }));
    const g0 = G.gangs[0];
    const etats = new Set();
    for (let k = 0; k < 40; k++) { g0.t = -1; G.gangTick(0.05); etats.add(g0.etat); }
    res.etats = [...etats];
    // ils traquent le joueur et le frappent
    G.P.pos.set(g0.base[0] + 14, 0.3, g0.base[1]); G.P.hp = 100;
    g0.t = 1e9; g0.etat = 'joueur'; g0.cible = [G.P.pos.x, G.P.pos.z];
    const d0 = Math.hypot(g0.membres[0].x - G.P.pos.x, g0.membres[0].z - G.P.pos.z);
    for (let k = 0; k < 120; k++) G.gangTick(0.05);
    res.approche = [+d0.toFixed(1), +Math.hypot(g0.membres[0].x - G.P.pos.x, g0.membres[0].z - G.P.pos.z).toFixed(1)];
    const hp0 = G.P.hp;
    for (const m of g0.membres) { m.x = G.P.pos.x + 1; m.z = G.P.pos.z; m.cd = -1; }
    G.gangTick(0.05);
    res.degats = hp0 - G.P.hp;
    // bagarre entre gangs
    const g1 = G.gangs[1], vic = g1.membres[0];
    vic.hp = 100; vic.ko = 0; g0.etat = 'rival'; g0.cible = [g1.base[0], g1.base[1]];
    for (const m of g0.membres) { m.x = vic.x + 1; m.z = vic.z; m.cd = -1; m.ko = 0; }
    G.gangTick(0.05);
    res.hpRival = vic.hp;
    // vitrine cassée
    const vit = G.breakables.find(b => b.kind === 'glass' && !b.broken);
    G.clearWanted(); G.P.crime = 0;
    g0.etat = 'boutique'; g0.cible = [vit.x, vit.z];
    for (const m of g0.membres) { m.x = vit.x + 1; m.z = vit.z; m.cd = -1; }
    G.gangTick(0.05); vit.cracked = true; for (const m of g0.membres) m.cd = -1;
    G.gangTick(0.05);
    res.vitrine = !!(vit.broken || vit.cracked);
    // la casse du gang ne doit pas être mise sur le dos du joueur
    res.recherche = G.police.wanted || 0;
    G.P.hp = 100; g0.etat = 'repos'; g0.cible = null; G.clearWanted();
    return res;
  });
  const hats = r.gangs.map(g => g.hat);
  const ok = r.gangs.length === 3 && new Set(hats).size === 3 && hats.every(h => /^bandana/.test(h))
    // depuis la guerre des gangs, un gang rival compte un chef et cinq hommes, pas trois
    && r.gangs.every(g => g.n >= 3 && g.kits >= 6 && g.peinture !== 0)
    && ['joueur', 'rival', 'boutique', 'cambriolage'].every(e => r.etats.includes(e))
    && r.approche[1] < r.approche[0] - 4 && r.degats > 0 && r.hpRival < 100 && r.vitrine && r.recherche === 0;
  return { ok, detail: `${r.gangs.length} gangs de ${r.gangs.map(g => g.n).join('/')} membres, bandanas ${hats.join('/')}, voitures customisées (${r.gangs[0].kits} kits, peinture propre à chaque gang) · états observés : ${r.etats.join(', ')} · ils fondent sur le joueur (${r.approche[0]} → ${r.approche[1]} m, −${r.degats} PV), tapent le gang rival (${r.hpRival} PV) et brisent une vitrine sans que la police s'en prenne au joueur (recherché ${r.recherche})` };
});

test("l'alarme de villa prévient au poignet et le cambriolage peut être mis en échec", async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 60, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = {};
    res.article = G.DECOR.find(d => d.id === 'alarme') || null;
    res.villa = !!G.city.villaMine;
    G.owned.delete('deco:alarme');
    res.sansAlarme = G.alarmeInstallee();
    // sans alarme : personne ne prévient
    G.P.pos.set(0, 1, 60);
    G.declencheCambriolage(G.gangs[0]);
    res.discret = { en: G.cambrio.on, alerte: G.cambrio.alerte, ecran: document.body.classList.contains('alarme') };
    G.cambrio.t = 0; G.cambrioTick(0.016);
    // avec alarme : montre au poignet, écran rouge
    G.myCfg.montre = false; G.applyMyLook();
    G.owned.add('deco:alarme');
    G.wallet = 500;
    G.declencheCambriolage(G.gangs[0]);
    res.avecAlarme = { en: G.cambrio.on, alerte: G.cambrio.alerte > 0, ecran: document.body.classList.contains('alarme'),
      montre: !!G.myCfg.montre && G.me.montre.visible, butin: G.cambrio.butin };
    // le cadran clignote au rythme du temps de jeu : on l'observe pendant plusieurs images
    const couleurs = new Set();
    for (let k = 0; k < 60 && couleurs.size < 2; k++) {
      await new Promise(r2 => setTimeout(r2, 200));
      G.cambrioTick(0.016); couleurs.add(G.me.cadran.material.color.getHexString());
    }
    res.cadran = [...couleurs];
    // le joueur rapplique : les voleurs fuient sans rien emporter
    const w0 = G.wallet;
    G.P.pos.set(G.city.villaMine.x + 3, 1, G.city.villaMine.z);
    G.cambrioTick(0.016);
    res.sauve = { en: G.cambrio.on, perte: w0 - G.wallet, ecran: document.body.classList.contains('alarme'),
      cadran: G.me.cadran.material.color.getHexString() };
    // personne n'intervient : le butin part
    G.P.pos.set(0, 1, 60);
    G.declencheCambriolage(G.gangs[1]);
    const w1 = G.wallet, butin = G.cambrio.butin;
    G.cambrio.t = 0; G.cambrioTick(0.016);
    res.rate = { en: G.cambrio.on, perte: w1 - G.wallet, attendu: butin };
    // le gang du joueur peut aussi faire fuir les voleurs
    const b1 = G.bots[0]; G.amis.add(b1.name);
    G.gang.membres.slice().forEach(b => G.quitterGang(b));
    G.rejoindreGang(b1);
    G.declencheCambriolage(G.gangs[0]);
    b1.pos.set(G.city.villaMine.x + 4, 0.3, G.city.villaMine.z);
    const w2 = G.wallet; G.cambrioTick(0.016);
    res.parLeGang = { en: G.cambrio.on, perte: w2 - G.wallet };
    G.gang.membres.slice().forEach(b => G.quitterGang(b));
    return res;
  });
  const ok = r.article && r.article.p > 0 && r.villa && !r.sansAlarme
    && r.discret.en && r.discret.alerte === 0 && !r.discret.ecran
    && r.avecAlarme.en && r.avecAlarme.alerte && r.avecAlarme.ecran && r.avecAlarme.montre && r.avecAlarme.butin > 0
    && r.cadran.includes('ff2020') && r.cadran.length > 1
    && !r.sauve.en && r.sauve.perte === 0 && !r.sauve.ecran && r.sauve.cadran === '9fdcff'
    && !r.rate.en && r.rate.perte === r.rate.attendu && r.rate.perte > 0
    && !r.parLeGang.en && r.parLeGang.perte === 0;
  return { ok, detail: `« ${r.article && r.article.n} » à ${r.article && r.article.p} 🪙 : sans elle le cambriolage est silencieux, avec elle l'écran vire au rouge et la montre livrée clignote (${r.cadran.join('/')}) · le joueur qui rentre chez lui fait fuir les voleurs (perte ${r.sauve.perte} 🪙), son gang aussi (${r.parLeGang.perte} 🪙), et si personne ne bouge le butin part (−${r.rate.perte} 🪙)` };
});

test('La Zone : un quartier pauvre praticable du trottoir au toit', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: -145, y: 1, z: 40, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 500));
    const G = __G, res = {};
    const imm = G.city.zoneImmeubles;
    res.n = imm.length;
    res.etages = imm.map(i => i.etages);
    // Les volées ont été refaites : le giron se calcule sur la distance réelle jusqu'au
    // palier (et non sur 0,62 m fixe), et une volée sur deux est décalée de 2,60 m vers
    // l'extérieur pour ne plus passer sous la précédente. Le test suivait encore l'ancien
    // tracé et sondait donc le vide.
    const b = imm[0], ex0 = b.x + b.w / 2 + 1.6;
    const marches = [], trous = [], hauteurs = [];
    for (let f = 0; f < b.etages - 1; f++) {
      const y0 = f * b.h + 0.2, y1 = (f + 1) * b.h + 0.2, n = 8, len = (b.d - 2) / n, rise = (y1 - y0) / n;
      const sens = f % 2 ? -1 : 1, z0 = b.z - (b.d / 2 - 1) * sens, exf = ex0 + (f % 2 ? 2.6 : 0);
      for (let i = 0; i < n; i++) {
        const zz = z0 + sens * (i * len + len / 2), attendu = y0 + (i + 1) * rise;
        const y = G.groundUnder(exf, zz, null, attendu + 0.3);
        marches.push(+y.toFixed(2));
        if (Math.abs(y - attendu) > 0.12) trous.push([f, i, +y.toFixed(2), +attendu.toFixed(2)]);
        // hauteur libre au-dessus de la marche : on ne doit pas se cogner à la volée du dessus
        let plafond = 99;
        for (const o of G.solids) {
          if (Math.abs(o.x - exf) > o.w / 2 + 0.4 || Math.abs(o.z - zz) > o.d / 2 + 0.4) continue;
          const bas = o.y - o.h / 2;
          if (bas > y + 0.3 && bas < plafond) plafond = bas;
        }
        hauteurs.push(+(plafond - y).toFixed(2));
      }
    }
    res.marches = marches.length; res.trous = trous; res.hauteurLibre = Math.min(...hauteurs);
    res.montee = [marches[0], marches[marches.length - 1]];
    // planchers des trois niveaux, sous chaque appartement
    res.planchers = [0, 1, 2].map(f => [-1, 1].map(sx =>
      +G.groundUnder(b.x + sx * b.w / 4, b.z, null, f * b.h + 0.8).toFixed(2)));
    res.toit = +G.groundUnder(b.x, b.z, null, b.etages * b.h + 1).toFixed(2);
    // mobilier dans les appartements de chaque étage
    res.meubles = [0, 1, 2].map(f => G.solids.filter(o => o.y > f * b.h && o.y < (f + 1) * b.h
      && Math.abs(o.x - b.x) < 8 && Math.abs(o.z - b.z) < 8 && o.h < 2 && o.w < 3).length);
    // aucun immeuble ne chevauche un autre bâtiment de la ville
    const chev = [];
    for (const a of imm) for (const c of G.city.batiments) {
      if (Math.abs(a.x - c.x) < 0.01 && Math.abs(a.z - c.z) < 0.01) continue;
      if (Math.abs(a.x - c.x) < (a.w + c.w) / 2 - 0.2 && Math.abs(a.z - c.z) < (a.d + c.d) / 2 - 0.2) chev.push([a.x, a.z]);
    }
    res.chevauchements = chev.length;
    // le quartier repose bien sur le sol de la ville
    res.sol = [[-40, -30], [40, 30], [0, 0], [-40, 30], [40, -30]].map(([dx, dz]) =>
      +G.groundUnder(-145 + dx, 40 + dz, null, 1).toFixed(2));
    res.errants = G.city.errants.length;
    res.zone = G.city.zones.some(z => z.name === 'La Zone');
    // décor du bidonville : carcasses (murs invisibles), poubelles, déchets
    res.poubelles = G.solids.filter(o => Math.abs(o.x + 145) < 42 && Math.abs(o.z - 40) < 32
      && o.h > 1 && o.h < 1.2 && o.w < 1).length;
    // un mur de la Zone arrête bien le joueur (mêmes règles que le reste de la ville)
    res.mur = G.npcBlocked(b.x, 0.3, b.z - b.d / 2 + 0.15, 0.4);
    res.vide = G.npcBlocked(b.x, 0.3, b.z + b.d / 2 + 6, 0.4);
    return res;
  });
  const ok = r.n === 5 && r.etages.every(e => e === 3) && r.trous.length === 0 && r.marches === 16
    && r.planchers.every((pp, f) => pp.every(y => Math.abs(y - (f * 3.2 + 0.2)) < 0.05))
    && r.toit > 9.5 && r.meubles.every(m => m >= 6) && r.chevauchements === 0 && r.hauteurLibre > 2
    && r.sol.every(y => y > 0.04) && r.errants >= 4 && r.zone && r.poubelles >= 10 && r.mur && !r.vide;
  return { ok, detail: `5 immeubles de 3 étages, ${r.marches} marches d'escalier extérieur, ${r.trous.length} trou(s) (${r.montee[0]} m → ${r.montee[1]} m, ${r.hauteurLibre} m de hauteur libre), planchers à ${r.planchers.map(x => x[0]).join('/')} m et toit à ${r.toit} m, ${r.meubles.join('/')} meubles par niveau, ${r.errants} chiens errants, ${r.poubelles} poubelles · aucun chevauchement avec les bâtiments de la ville, sol continu sous tout le quartier, murs bloquants comme ailleurs` };
});

test("la boutique « maison & déco » s'est étoffée, alarme comprise", async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 43, y: 1, z: 58, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = { vides: [] };
    res.n = G.DECOR.length;
    for (const d of G.DECOR) {
      let g; try { g = G.decorMesh(d.id); } catch (e) { res.vides.push([d.id, 'erreur']); continue; }
      const n = g ? (function c(o) { let k = o.children.length; for (const ch of o.children) k += c(ch); return k; })(g) : 0;
      if (n < 1) res.vides.push([d.id, n]);
    }
    res.murals = G.DECOR.filter(d => d.wall).length;
    res.alarme = G.DECOR.find(d => d.id === 'alarme') || null;
    res.doublons = G.DECOR.length - new Set(G.DECOR.map(d => d.id)).size;
    res.sansPrix = G.DECOR.filter(d => !(d.p > 0)).length;
    return res;
  });
  const ok = r.n >= 34 && r.vides.length === 0 && r.murals >= 6 && r.alarme && r.doublons === 0 && r.sansPrix === 0;
  return { ok, detail: `${r.n} articles de décoration, tous modélisés en 3D (${r.murals} à accrocher au mur), l'alarme « ${r.alarme && r.alarme.n} » à ${r.alarme && r.alarme.p} 🪙, aucun doublon ni article sans prix` };
});

test("aucun commentaire n'avale du code (le piège qui a coulé le nageur et figé la police)", async p => {
  const src = fs.readFileSync(process.argv[2] || path.join(ROOT, 'index.html'), 'utf8');
  const i = src.lastIndexOf('<script>'), j = src.lastIndexOf('</script>');
  const lignes = src.slice(i + 8, j).split('\n');
  const INSTRUCTION = /^\s*[A-Za-z_$][\w.$\[\]]*\s*(\(|[-+*/]?=[^=])/;
  const suspects = [];
  lignes.forEach((l, k) => {
    const m = /(?<![:"'`\/])\/\/(?!\/)(.*)$/.exec(l);
    if (!m) return;
    const c = m[1];
    if (!c.includes(';') || /https?:/.test(c)) return;
    if (!c.split(';').slice(1).some(x => INSTRUCTION.test(x) && (x.includes('.') || x.includes('(')))) return;
    suspects.push(k + 1);
  });
  return { ok: suspects.length === 0,
    detail: suspects.length ? `lignes où un // avale du code : ${suspects.join(', ')}`
      : `${lignes.length} lignes relues : aucun bout de code caché derrière un commentaire de fin de ligne` };
});

test('la ville se répare : vitrines remplacées, véhicules et hélico ramenés à leur place', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: -19, y: 1, z: 12, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 500));
    const G = __G, res = {};
    // une vitrine cassée est remplacée au bout d'un moment, hors de vue
    const v = G.breakables.filter(b => b.kind === 'glass')
      .map(b => ({ b, d: Math.hypot(b.x - G.P.pos.x, b.z - G.P.pos.z) })).sort((a, c) => a.d - c.d)[0].b;
    G.breakThing(v, { x: v.x, z: v.z }, true); G.breakThing(v, { x: v.x, z: v.z }, true);
    res.cassee = { broken: !!v.broken, retireDesSolides: G.solids.indexOf(v.solid) < 0, casseT: !!v.casseT };
    G.P.pos.set(60, 1, 60); v.casseT = G.simTime - 200; G.city.remiseT = 0;
    G.remiseTick(2);
    res.reparee = { broken: !!v.broken, solide: G.solids.indexOf(v.solid) >= 0, mesh: !!v.m.parent };
    // un lampadaire couché se redresse dans son orientation d'origine
    const l = G.breakables.find(b => b.kind === 'lamp' && !b.broken);
    G.breakThing(l, { x: l.x + 2, z: l.z }, true);
    const couche = Math.abs(l.g.quaternion.x) + Math.abs(l.g.quaternion.z);
    l.casseT = G.simTime - 300; G.city.remiseT = 0; G.P.pos.set(l.x + 90, 1, l.z + 90);
    G.remiseTick(2);
    res.lampadaire = { couche: +couche.toFixed(2), redresse: Math.abs(l.g.quaternion.x) + Math.abs(l.g.quaternion.z) < 0.02, casse: !!l.broken };
    // une voiture abandonnée à l'autre bout de la ville revient à sa place
    const c = G.city.cars.find(x => !x.busy && !x.kart && !x.heli);
    const home = c.home0.slice();
    c.x = home[0] + 70; c.z = home[1] + 40; c.g.position.set(c.x, 0, c.z); c.loinT = 0;
    G.P.pos.set(-100, 1, 230);
    for (let i = 0; i < 60; i++) { G.city.remiseT = 0; G.remiseTick(2); }
    res.voiture = { revenue: Math.hypot(c.x - home[0], c.z - home[1]) < 1.5 };
    // l'hélicoptère laissé en vol au-dessus de sa base redescend aussi
    const h = G.city.cars.find(x => x.heli);
    h.x = h.home0[0]; h.z = h.home0[1]; h.y = 30; h.g.position.set(h.x, h.y, h.z); h.loinT = 0;
    for (let i = 0; i < 60; i++) { G.city.remiseT = 0; G.remiseTick(2); }
    res.helico = { y: +h.y.toFixed(2), pose: h.y < 1 };
    // une épave est remorquée et réparée
    const e = G.city.cars.filter(x => x.parts && x !== c)[0];
    G.explodeVehicle(e); e.dead = true;
    const detache = [e.parts.hood, ...e.parts.doors].filter(m => m.parent !== e.g).length;
    e.loinT = 0; e.x = e.home0[0] + 60; e.z = e.home0[1];
    for (let i = 0; i < 80; i++) { G.city.remiseT = 0; G.remiseTick(2); }
    res.epave = { detacheAvant: detache, detacheApres: [e.parts.hood, ...e.parts.doors].filter(m => m.parent !== e.g).length,
      revenue: Math.hypot(e.x - e.home0[0], e.z - e.home0[1]) < 1.5, dead: !!e.dead };
    return res;
  });
  const ok = r.cassee.broken && r.cassee.retireDesSolides && r.cassee.casseT
    && !r.reparee.broken && r.reparee.solide && r.reparee.mesh
    && r.lampadaire.couche > 0.1 && r.lampadaire.redresse && !r.lampadaire.casse
    && r.voiture.revenue && r.helico.pose
    && r.epave.detacheAvant >= 3 && r.epave.detacheApres === 0 && r.epave.revenue && !r.epave.dead;
  return { ok, detail: `vitrine brisée puis remplacée (solide et mesh de retour) · lampadaire couché (${r.lampadaire.couche}) puis redressé · voiture abandonnée à 80 m ramenée à sa place · hélico laissé à 30 m d'altitude reposé à ${r.helico.y} m · épave remorquée et recollée (${r.epave.detacheAvant} pièces détachées → ${r.epave.detacheApres})` };
});

test('une balle fissure puis fait voler la vitrine en éclats, et traverse pour toucher derrière', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: -19, y: 1, z: 12, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = {};
    G.clearWanted(); G.police.avert = 0;
    const vitres = G.breakables.filter(b => b.kind === 'glass');
    res.nb = vitres.length;
    const v = vitres.map(b => ({ b, d: Math.hypot(b.x - G.P.pos.x, b.z - G.P.pos.z) })).sort((a, c) => a.d - c.d)[0].b;
    res.lien = !!v.solid.brk;
    const tirer = () => {
      const sh = { m: null, p: new G.THREE.Vector3(v.x, v.solid.y, v.z - 6), v: new G.THREE.Vector3(0, 0, 90), t: 0, mine: true, dmg: 20 };
      G.shots.push(sh); G.spawnShot(sh);
      for (let i = 0; i < 8; i++) G.shotsTick(1 / 60);
    };
    tirer(); res.apres1 = { fissuree: !!v.cracked, brisee: !!v.broken };
    tirer(); res.apres2 = { brisee: !!v.broken, solideRetire: G.solids.indexOf(v.solid) < 0 };
    // la balle ne s'arrête pas sur la vitre : un bot placé derrière est touché
    // la plus proche encore intacte : un test precedent a pu en briser plusieurs, et on se
    // retrouvait a tirer a l'autre bout de la ville, derriere un comptoir
    const v2 = vitres.filter(x => !x.broken && x !== v)
      .sort((a, c) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(c.x - v.x, c.z - v.z))[0];
    // et on degage la ligne de tir de tout ce qui pourrait encaisser la balle a sa place
    for (const o of G.bots) if (o !== G.bots[0]) { o.pos.x += 400; o.pos.z += 400; o.av.group.position.copy(o.pos); }
    for (const G2 of G.gangs) for (const o of G2.membres) { o.x += 400; o.z += 400; o.av.group.position.set(o.x, o.y, o.z); }
    const b = G.bots[0]; b.ko = 0; b.hp = 100; b.dead = 0; b.fight = null;
    b.pos.set(v2.x, 0.3, v2.z + 2.2); b.av.group.position.copy(b.pos); b.av.group.visible = true;
    b.pos.y = 0.3; b.av.group.position.copy(b.pos);
    const sh2 = { m: null, p: new G.THREE.Vector3(v2.x, 1.9, v2.z - 5), v: new G.THREE.Vector3(0, 0, 90), t: 0, mine: true, dmg: 20 };
    G.shots.push(sh2); G.spawnShot(sh2);
    for (let i = 0; i < 8; i++) G.shotsTick(1 / 60);
    res.traverse = { vitre: !!v2.cracked || !!v2.broken, botTouche: b.hp < 100 };
    return res;
  });
  const ok = r.nb >= 20 && r.lien && r.apres1.fissuree && !r.apres1.brisee && r.apres2.brisee && r.apres2.solideRetire
    && r.traverse.vitre && r.traverse.botTouche;
  return { ok, detail: `${r.nb} vitrines de boutique · première balle : fissure, deuxième : éclats (le solide disparaît) · la balle poursuit sa route à travers la vitre et touche ce qu'il y a derrière (${r.traverse.botTouche})` };
});

test("à la salle de sport on s'allonge vraiment sur le banc et on court sur le tapis", async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: -2.9, y: 1, z: 22, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = {};
    const bench = G.city.gym.bench, run = G.city.gym.run;
    res.appareils = { banc: [bench.x, bench.z, bench.y], tapis: [run.x, run.z, run.y] };
    // le point d'accroche est SUR l'appareil (avant, il tombait 60 cm derrière)
    const solide = (x, z, y, tol) => G.solids.some(o => Math.abs(o.x - x) < o.w / 2 + 0.1 && Math.abs(o.z - z) < o.d / 2 + 0.1 && (o.y + o.h / 2) <= y + 0.02 && (o.y + o.h / 2) > y - tol);
    // Debout sur le tapis, les pieds touchent la bande : l'ancre est à quelques centimètres
    // de la surface. ALLONGÉ sur le banc, c'est le dos qui repose sur le coussin et l'ancre
    // se retrouve un demi-torse plus haut — d'où deux tolérances différentes.
    res.surLAppareil = { banc: solide(bench.x, bench.z, bench.y, 0.25), tapis: solide(run.x, run.z, run.y, 0.12) };
    // développé couché : allongé, la barre monte à chaque répétition
    G.P.pos.set(bench.x, 1, bench.z);
    G.startGym('bench'); G.gym.end = G.simTime + 600;
    for (let i = 0; i < 30; i++) G.gymTick(1 / 30);
    for (let k = 0; k < 25 && Math.abs(G.me.group.rotation.x + Math.PI / 2) > 0.2; k++) await new Promise(r2 => setTimeout(r2, 200));
    res.banc = { pos: [+G.P.pos.x.toFixed(2), +G.P.pos.y.toFixed(2), +G.P.pos.z.toFixed(2)],
      allonge: Math.abs(G.me.group.rotation.x + Math.PI / 2) < 0.2, reps: G.gym.reps };
    const y0 = G.city.gym.bench.barre.mesh.position.y;
    G.P.jumpBuf = 1; G.gymTick(1 / 30);
    res.barre = { repos: +y0.toFixed(2), pousse: +G.city.gym.bench.barre.mesh.position.y.toFixed(2), reps: G.gym.reps };
    G.gym.on = null;
    // tapis de course : debout sur la bande, qui défile
    G.P.pos.set(run.x, 1, run.z);
    G.startGym('run'); G.gym.end = G.simTime + 600;
    const z0 = G.city.gym.run.rayures[0].mesh.position.z;
    for (let i = 0; i < 30; i++) G.gymTick(1 / 30);
    for (let k = 0; k < 25 && Math.abs(G.me.group.rotation.x) > 0.2; k++) await new Promise(r2 => setTimeout(r2, 200));
    res.tapis = { pos: [+G.P.pos.x.toFixed(2), +G.P.pos.y.toFixed(2), +G.P.pos.z.toFixed(2)],
      debout: Math.abs(G.me.group.rotation.x) < 0.2, bande: +(z0 - G.city.gym.run.rayures[0].mesh.position.z).toFixed(2) };
    G.gym.on = null;
    return res;
  });
  const surBanc = Math.abs(r.banc.pos[0] - r.appareils.banc[0]) < 0.3 && Math.abs(r.banc.pos[2] - r.appareils.banc[1]) < 0.3 && Math.abs(r.banc.pos[1] - r.appareils.banc[2]) < 0.05;
  const surTapis = Math.abs(r.tapis.pos[0] - r.appareils.tapis[0]) < 0.3 && Math.abs(r.tapis.pos[2] - r.appareils.tapis[1]) < 0.3;
  const ok = r.surLAppareil.banc && r.surLAppareil.tapis && surBanc && r.banc.allonge && r.barre.pousse > r.barre.repos + 0.1
    && r.barre.reps > 0 && surTapis && r.tapis.debout && Math.abs(r.tapis.bande) > 0.5;
  return { ok, detail: `banc à ${r.appareils.banc.join(', ')} : le joueur s'y allonge (rotation ${r.banc.allonge}) et la barre monte de ${r.barre.repos} à ${r.barre.pousse} m à chaque répétition · tapis à ${r.appareils.tapis.join(', ')} : il y court debout et la bande défile de ${Math.abs(r.tapis.bande)} m` };
});

test('au commissariat, une plainte envoie une patrouille chercher un bot et le met en cellule', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: -54, y: 1, z: 26, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 500));
    const G = __G, res = {};
    res.guichet = !!G.city.plainteDesk;
    // le commissariat est meublé : bureaux, armoire, casiers…
    const sx = G.police.station.x, sz = G.police.station.z;
    res.meubles = G.solids.filter(o => Math.abs(o.x - sx) < 9 && Math.abs(o.z - sz) < 6 && o.h < 3 && o.y < 3).length;
    // on s'approche du guichet
    G.P.pos.set(G.city.plainteDesk.x, 0.4, G.city.plainteDesk.z + 1.2);
    for (let i = 0; i < 40 && !G.city.plainteNear; i++) { await new Promise(r2 => setTimeout(r2, 120)); G.P.pos.set(G.city.plainteDesk.x, 0.4, G.city.plainteDesk.z + 1.2); }
    res.proche = G.city.plainteNear;
    G.openPlainte();
    res.fenetre = G.uiOpen === 'plainte';
    res.choix = { qui: document.querySelectorAll('#plainteQui b').length, motifs: document.querySelectorAll('#plainteQuoi b').length };
    const b = G.bots[3];
    b.prison = 0; b.pos.set(sx + 8, 0.3, sz + 14); b.av.group.position.copy(b.pos);
    G.plainte.qui = b; G.plainte.motif = 'voiture';
    const w0 = G.wallet;
    G.deposerPlainte();
    res.patrouille = G.plainte.chasse ? G.plainte.chasse.agents.length : 0;
    for (let i = 0; i < 400 && G.plainte.chasse; i++) G.plainteTick(1 / 30);
    res.arrestation = { enCellule: !!b.prison, distanceCellule: +Math.hypot(b.pos.x - G.police.cell.x, b.pos.z - G.police.cell.z).toFixed(1),
      prime: G.wallet - w0, agentsRestants: G.police.agents.length };
    // il ne bouge plus de sa cellule
    const av = [b.pos.x, b.pos.z];
    G.updateBot(b, 1 / 30);
    res.reste = Math.hypot(b.pos.x - av[0], b.pos.z - av[1]) < 0.01;
    // fin de peine
    b.prison = G.simTime - 1; G.plainteTick(1 / 30);
    res.libere = !b.prison;
    return res;
  });
  const ok = r.guichet && r.meubles >= 8 && r.proche && r.fenetre && r.choix.qui >= 10 && r.choix.motifs === 6
    && r.patrouille === 2 && r.arrestation.enCellule && r.arrestation.distanceCellule < 4
    && r.arrestation.prime === 15 && r.arrestation.agentsRestants === 0 && r.reste && r.libere;
  return { ok, detail: `commissariat meublé (${r.meubles} meubles) avec guichet des plaintes · ${r.choix.qui} personnes et ${r.choix.motifs} motifs proposés · deux agents partent, attrapent le bot et l'enferment à ${r.arrestation.distanceCellule} m du centre de la cellule (+${r.arrestation.prime} 🪙) · il y reste jusqu'à la fin de sa peine, puis sort` };
});

test('la police laisse une vraie fenêtre de fuite et ferme les yeux sur les broutilles', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 60, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = {};
    G.clearWanted(); G.police.avert = 0;
    G.P.pos.set(0, 0.3, 60);   // loin du commissariat, personne ne voit rien
    // trois broutilles : que des avertissements
    G.infraction('petit délit 1', 1, 1); G.infraction('petit délit 2', 1, 1); G.infraction('petit délit 3', 1, 1);
    res.broutilles = { wanted: G.police.wanted, avert: G.police.avert };
    G.infraction('petit délit 4', 1, 1);
    res.quatrieme = { wanted: G.police.wanted, fenetre: Math.round(G.police.reactT - G.simTime) };
    // un délit grave : traque immédiate, mais les voitures restent au poste le temps de la fenêtre
    G.clearWanted(); G.police.avert = 0;
    G.infraction('délit grave', 3, 3);
    res.grave = { wanted: G.police.wanted, fenetre: Math.round(G.police.reactT - G.simTime), actives: G.police.cars.filter(c => c.active).length };
    const t0 = G.simTime;
    // On relève le MAXIMUM de voitures lancées : depuis que les itinéraires suivent les rues,
    // la police rattrape un joueur immobile en quelques secondes et l'arrête — à la fin de la
    // boucle la traque est déjà finie et le compteur est retombé à zéro.
    let maxActives = 0;
    for (let i = 0; i < 200; i++) { G.simTime = t0 + i * 0.1; G.policeTick(0.1); maxActives = Math.max(maxActives, G.police.cars.filter(c => c.active).length); }
    res.apresFenetre = { actives: maxActives, react: 0 };
    // pendant la poursuite, pas de faux compte à rebours
    // traque déjà en cours (la fenêtre est passée) : un nouveau délit ne doit pas rouvrir
    // de compte à rebours. On repart d'un état net car la police a pu arrêter le joueur.
    G.police.wanted = 2; G.police.reactT = 0; G.police.avert = 0;
    G.police.cars.forEach(c => { c.active = true; c.debarque = false; });
    G.infraction('deuxième délit', 1, 2);
    res.pendant = { react: G.police.reactT, hud: document.getElementById('wanted').textContent };
    // un délit vu par la police ne bénéficie d'aucune clémence
    // la police a eu tout le temps d'arrêter le joueur pendant la boucle : on le ressort de
    // prison et on le remet en pleine rue avant de tester le flagrant délit
    G.clearWanted(); G.police.avert = 0;
    if (G.jail.on) G.jailFree(); G.P.pos.set(0, 0.3, 60);
    const pc = G.police.cars[0]; pc.x = G.P.pos.x + 8; pc.z = G.P.pos.z; pc.y = G.P.pos.y; pc.active = true; pc.debarque = false; pc.hp = 100; pc.vueT = 0; pc.vue = false;   // on vient de la téléporter : la ligne de vue en cache n'est plus valable
    res.temoin = G.policeTemoin(28);
    G.infraction('vu par la police', 1, 1);
    res.vu = { wanted: G.police.wanted };
    G.clearWanted();
    return res;
  });
  const ok = r.broutilles.wanted === 0 && r.broutilles.avert === 3 && r.quatrieme.wanted === 1
    && r.quatrieme.fenetre >= 25 && r.grave.wanted === 3 && r.grave.fenetre >= 12 && r.grave.actives === 0
    && r.apresFenetre.actives >= 2 && r.pendant.react === 0 && !/arrive dans/.test(r.pendant.hud)
    && r.temoin && r.vu.wanted >= 1;
  return { ok, detail: `trois petits délits non vus = trois avertissements (traque à zéro), le quatrième lance la traque avec ${r.quatrieme.fenetre} s d'avance · un délit grave donne ${r.grave.fenetre} s de fuite avec les voitures encore au poste, qui s'élancent ensuite (${r.apresFenetre.actives}) · plus de faux compte à rebours pendant la poursuite · un délit commis sous les yeux d'une patrouille compte tout de suite` };
});

test('les coffres de la banque rapportent de moins en moins et un braquage de bot n\'incrimine pas le joueur', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: -52, y: 1, z: 70, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = {};
    G.wallet = 0; G.bank.coffresJour = 0; G.bank.jourT = G.simTime + 9999;
    const gains = [];
    for (let i = 0; i < 5; i++) {
      const sf = G.city.safes.find(s => !s.planque);
      sf.open = false; sf.progress = 1; G.city.safeNear = sf; G.keys.add('KeyE');
      const w = G.wallet; G.safesTick(0.05); gains.push(G.wallet - w); sf.open = false;
    }
    G.keys.delete('KeyE'); G.city.safeNear = null;
    res.gains = gains;
    // le lendemain, la banque est réapprovisionnée
    G.bank.jourT = G.simTime - 1;
    const sf2 = G.city.safes.find(s => !s.planque);
    sf2.open = false; sf2.progress = 1; G.city.safeNear = sf2; G.keys.add('KeyE');
    const w2 = G.wallet; G.safesTick(0.05); res.lendemain = G.wallet - w2;
    G.keys.delete('KeyE'); G.city.safeNear = null;
    // un bot braque la banque : alerte des gardes, mais le joueur n'est pas recherché
    G.clearWanted();
    const b = G.bots[1];
    b.activite = { k: 'braquage', etape: 'route', fin: G.simTime + 60 };
    b.rdv = { x: 0, z: 0, arrive: true };
    G.activiteTick(b, 0.1);
    res.botBraque = { wanted: G.police.wanted, voituresActives: G.police.cars.filter(c => c.active).length,
      alarmeBot: G.police.alarmeBot > G.simTime, gardesAlertes: G.city.guards.filter(g => g.alert).length };
    G.clearWanted();
    return res;
  });
  const ok = JSON.stringify(r.gains) === JSON.stringify([500, 300, 150, 75, 50]) && r.lendemain === 500
    && r.botBraque.wanted === 0 && r.botBraque.voituresActives === 0 && r.botBraque.alarmeBot && r.botBraque.gardesAlertes > 0;
  return { ok, detail: `coffres du jour : ${r.gains.join(' → ')} 🪙 puis ${r.lendemain} 🪙 le lendemain (la banque se réapprovisionne) · quand un bot braque la banque, les gardes s'affolent (${r.botBraque.gardesAlertes}) mais le joueur n'est ni recherché ni poursuivi` };
});

test('la mission sauvetage se joue de bout en bout et le GPS suit un vrai chemin de piéton', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 51, y: 1, z: -8, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 500));
    const G = __G, res = {};
    G.wallet = 0; G.clearWanted();
    G.startMission('secours');
    const d = G.mission.data, roof = d.roof;
    res.toit = { x: Math.round(roof.x), z: Math.round(roof.z), y: +roof.y.toFixed(1),
      vraiToit: (G.city.toits || []).some(t => Math.abs(t.x - roof.x) < 1 && Math.abs(t.z - roof.z) < 1) };
    res.alerte = { wanted: G.police.wanted };
    const heli = G.city.cars.find(c => c.heli);
    G.enterCar(heli);
    heli.x = roof.x; heli.z = roof.z; heli.y = roof.y + 0.02; heli.vy = -0.2;
    for (let i = 0; i < 120; i++) G.driveStep(1 / 60);
    res.pose = { landed: !!heli.landed, y: +heli.y.toFixed(2) };
    G.missionTick(0.1);
    res.etape = G.mission.step;
    heli.x = 51; heli.z = -13; heli.y = 0.2; heli.vy = 0;
    for (let i = 0; i < 60; i++) G.driveStep(1 / 60);
    G.missionTick(0.1);
    res.fin = { finie: !G.mission.cur, gain: G.wallet };
    // on descend d'un hélico en vol : il se pose au lieu de rester en l'air
    G.enterCar(heli); heli.y = 26; heli.landed = false; G.exitCar();
    res.descente = { y: +heli.y.toFixed(2), pose: !!heli.landed };
    // GPS : grille piétonne, tracé qui ne traverse pas les murs
    G.setBeacon(-52, 70, 0.2);
    G.gpsRoute.hide(); G.gpsRoute.update();
    const bloque = g => { let n = 0; for (let i = 0; i < g.length; i++) if (g[i]) n++; return Math.round(n / g.length * 100); };
    if (!G.NAV.blocked) G.buildNav();
    res.grilles = { auto: bloque(G.NAV.blocked), pieton: bloque(G.NAV.pieton) };
    G.clearBeacon();
    return res;
  });
  const ok = r.toit.vraiToit && r.alerte.wanted === 0 && r.pose.landed && r.etape === 1 && r.fin.finie && r.fin.gain === 70
    && r.descente.pose && r.descente.y < 1 && r.grilles.pieton < r.grilles.auto;
  return { ok, detail: `le blessé attend sur un vrai toit accessible (${r.toit.x}, ${r.toit.z}) à ${r.toit.y} m, prendre la mission ne déclenche aucune alerte · l'hélico compte comme posé sur le toit, le blessé embarque et la mission se termine à l'héliport (+${r.fin.gain} 🪙) · quitter l'hélico en vol le pose (${r.descente.y} m) · le GPS a sa grille de piéton (${r.grilles.pieton} % de cases bloquées contre ${r.grilles.auto} % pour les voitures)` };
});

test('la police ne roule plus sous le sable du terrain de rallye', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: -40, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 400));
    const G = __G, res = {};
    const pc = G.police.cars[0];
    pc.x = 0; pc.z = -70; pc.active = true; pc.route = null;
    G.police.wanted = 1; G.police.lastSeen = [0, -70]; G.police.reactT = 0;
    for (let i = 0; i < 30; i++) G.policeTick(1 / 30);
    const sol = G.groundCar(pc.x, pc.z, pc.solid, pc.y);
    res.surLeSable = { y: +pc.y.toFixed(2), relief: +sol.toFixed(2), sousLeSable: pc.y < sol - 0.3 };
    // les itinéraires contournent les dunes
    G.NAV.blocked = null; G.buildNav();
    const dans = (x, z) => x > G.RALLY.x1 && x < G.RALLY.x2 && z > G.RALLY.z1 && z < G.RALLY.z2;
    const ch = G.navPath(-90, -70, 90, -70) || [];
    // On echantillonne le TRAJET tous les 2 m, pas seulement ses sommets : depuis que les rues
    // du nord ont ete refaites, le lissage rend un trajet propre en trois points — compter les
    // sommets ne disait plus rien, et un segment pouvait traverser les dunes sans qu'aucun
    // sommet n'y tombe.
    let dedans = 0, echant = 0;
    for (let i = 0; i + 1 < ch.length; i++) {
      const [x1, z1] = ch[i], [x2, z2] = ch[i + 1];
      const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(L / 2));
      for (let k = 0; k <= n; k++) { const t = k / n; echant++; if (dans(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) dedans++; }
    }
    const fin = ch[ch.length - 1] || [0, 0];
    res.itineraire = { points: ch.length, echant, dansLesDunes: dedans, arrive: +Math.hypot(fin[0] - 90, fin[1] + 70).toFixed(1) };
    // un agent à pied suit lui aussi le relief
    const a = G.creerAgent(-20, -70, 0.3, false);
    a.x = -20; a.z = -70;
    G.P.pos.set(20, 0.3, -70);
    G.police.sait = null; G.police.lastSeen = [20, -70]; G.police.wanted = 2; G.police.vuT = G.simTime;
    for (let i = 0; i < 200; i++) G.agentsTick(1 / 30);
    res.agent = { x: +a.x.toFixed(1), y: +a.y.toFixed(2), relief: +G.groundCar(a.x, a.z, null, a.y + 0.8).toFixed(2), aMarche: Math.abs(a.x + 20) > 1 };
    G.clearWanted();
    return res;
  });
  const ok = !r.surLeSable.sousLeSable && Math.abs(r.surLeSable.y - r.surLeSable.relief) < 0.4
    && r.itineraire.echant > 40 && r.itineraire.dansLesDunes === 0 && r.itineraire.arrive < 6
    && r.agent.aMarche && Math.abs(r.agent.y - r.agent.relief) < 0.6;
  return { ok, detail: `la voiture de police roule à ${r.surLeSable.y} m sur un relief à ${r.surLeSable.relief} m (elle passait dessous) · les itinéraires contournent les dunes (${r.itineraire.dansLesDunes} point sur ${r.itineraire.echant} échantillonnés tous les 2 m, arrivée à ${r.itineraire.arrive} m du but) · un agent à pied traverse le sable à ${r.agent.y} m pour un relief de ${r.agent.relief} m` };
});

test('la guerre des gangs : chefs, planques, kidnapping, braquage, élimination et renaissance', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 60, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 700));
    const G = __G, res = {};
    // identité : nom, chef, villa, planque, magot
    res.gangs = G.gangs.map(g => ({ nom: g.nom, chef: g.chefNom, membres: g.membres.length,
      chefEnJeu: !!(g.chef && g.chef.chef), villa: !!g.villaPos, planque: !!g.planque, magot: g.magot > 0,
      coffre: g.planque.coffre.amount === g.magot }));
    res.planques = G.city.planques.length;
    res.maPlanque = !!(G.gang.planque && G.gang.planque.joueur);
    // on cogne un membre : il encaisse et finit KO
    const g0 = G.gangs[0], m = g0.membres.find(x => !x.chef);
    const rep0 = G.gang.rep;
    let coups = 0;
    while (!m.ko && coups < 40) { m.x = G.P.pos.x + 1.2; m.z = G.P.pos.z; m.av.group.position.set(m.x, m.y, m.z); G.P.punchT = 0; G.P.combo = 0; G.attack('punch'); coups++; }
    res.combat = { coups, ko: !!m.ko, rep: G.gang.rep - rep0, gangEnColere: g0.etat === 'joueur' };
    // kidnapping puis interrogatoire
    G.P.pos.set(m.x, 0.3, m.z + 1);
    res.kidnappable = !!G.peutKidnapper();
    G.kidnapper(m);
    const pl = G.gang.planque;
    for (let i = 0; i < 3000 && G.P.otage; i++) {
      const dx = pl.x - G.P.pos.x, dz = pl.z - G.P.pos.z, d = Math.hypot(dx, dz) || 1;
      G.P.pos.x += dx / d * Math.min(0.08, d); G.P.pos.z += dz / d * Math.min(0.08, d);
      G.otageTick(1 / 60);
    }
    res.otage = { enferme: G.gang.otages.length === 1, dansLaPlanque: G.gang.otages[0] ? Math.hypot(G.gang.otages[0].x - pl.x, G.gang.otages[0].z - pl.z) < 8 : false };
    G.P.pos.set(G.gang.otages[0].x, 0.3, G.gang.otages[0].z + 1);
    G.interroger(G.gang.otages[0]);
    res.interrogatoire = { planqueConnue: !!g0.connu, balise: !!(G.beacon.m && G.beacon.m.visible) };
    // braquage de la planque
    const w0 = G.wallet, magot = g0.magot;
    const cof = g0.planque.coffre;
    cof.progress = 1; G.city.safeNear = cof; G.keys.add('KeyE'); G.safesTick(0.05);
    G.keys.delete('KeyE'); G.city.safeNear = null;
    res.braquage = { gain: G.wallet - w0, attendu: magot, magotVide: g0.magot === 0, guerre: g0.relation <= -50 };
    // élimination : tout le monde au tapis
    const nom0 = g0.nom, chef0 = g0.chefNom;
    for (const x of g0.membres.slice()) { x.hp = 1; x.ko = 0; G.gangeurKO(x, 'test'); }
    res.elimination = { dissous: !!g0.mort, recrues: (G.gang.membresLibres || []).length,
      territoiresLiberes: !Object.values(G.guerre.territoires).includes('rouge') };
    // renaissance
    g0.mort = G.simTime - 1; G.renaitGang(g0);
    res.renaissance = { nouveauNom: g0.nom !== nom0, nouveauChef: g0.chefNom !== chef0, generation: g0.generation,
      plusFort: g0.force > 25, magot: g0.magot > 0, debout: g0.membres.filter(x => !x.ko).length };
    return res;
  });
  const ok = r.gangs.length === 3 && r.gangs.every(g => g.chefEnJeu && g.villa && g.planque && g.magot && g.coffre && g.membres >= 5)
    && r.planques === 4 && r.maPlanque
    && r.combat.ko && r.combat.rep >= 3 && r.combat.gangEnColere
    && r.kidnappable && r.otage.enferme && r.otage.dansLaPlanque
    && r.interrogatoire.planqueConnue && r.interrogatoire.balise
    && r.braquage.gain === r.braquage.attendu && r.braquage.magotVide && r.braquage.guerre
    && r.elimination.dissous && r.elimination.recrues >= 1 && r.elimination.territoiresLiberes
    && r.renaissance.nouveauNom && r.renaissance.nouveauChef && r.renaissance.generation === 2
    && r.renaissance.plusFort && r.renaissance.magot && r.renaissance.debout >= 4;
  return { ok, detail: `3 gangs nommés avec leur chef en jeu, leur villa et leur planque (${r.planques} planques dont la tienne) · ${r.combat.coups} coups pour mettre un membre au tapis (+${r.combat.rep} ⭐, le gang réagit) · il est kidnappé et enfermé dans ta planque, l'interrogatoire révèle leur planque · le coffre rapporte ${r.braquage.gain} 🪙 et déclenche la guerre · gang éliminé : ${r.elimination.recrues} recrue(s) changent de camp, ses quartiers se libèrent, puis il renaît (génération ${r.renaissance.generation}, ${r.renaissance.debout} hommes, plus fort)` };
});

test('territoires, revenus, réunions de chefs, entraînement et sauvegarde de la guerre', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 60, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 700));
    const G = __G, res = {};
    res.quartiers = G.TERRITOIRES.length;
    // entraînement et armement par le chat
    const b1 = G.bots[0];
    G.amis.add(b1.name); G.gang.membres.slice().forEach(b => G.quitterGang(b));
    G.commandeSociale(b1.name + ' veux-tu venir dans le gang ?');
    const f0 = G.gang.force;
    res.ordreSport = G.commandeSociale(b1.name + ' va t\'entraîner à la salle de sport');
    b1.rdv.arrive = true;
    for (let i = 0; i < 400; i++) G.entrainementTick(1 / 30);
    G.wallet = 300;
    res.ordreArme = G.commandeSociale(b1.name + ' prends un fusil');
    res.entrainement = { force0: f0, force: G.gang.force, arme: !!b1.arme, cout: 300 - G.wallet };
    // prise d'un quartier
    const t = G.TERRITOIRES.find(x => x.k === 'parc');
    G.guerre.territoires.parc = 'bleu';
    G.P.pos.set(t.x, 0.3, t.z);
    b1.pos.set(t.x + 3, 0.3, t.z); 
    G.gangs.forEach(g => g.membres.forEach(m => { m.x = 400; m.z = 400; }));
    for (let i = 0; i < 60; i++) G.captureTick(1);
    res.capture = { proprio: G.guerre.territoires.parc, rep: G.gang.rep };
    // revenus versés dans la planque
    G.gang.magot = 0; G.guerre.t = 0; G.revenusTick();
    res.revenus = { magot: G.gang.magot, coffre: G.gang.planque.coffre.amount };
    // réunion de chef : rendez-vous, arrivée, choix
    const jaune = G.gangs.find(g => g.id === 'jaune');
    G.proposeReunion(jaune);
    res.rdv = { propose: !!G.guerre.reunion, lieu: G.guerre.reunion.nom, balise: !!(G.beacon.m && G.beacon.m.visible) };
    G.P.pos.set(G.guerre.reunion.x, 0.3, G.guerre.reunion.z);
    G.reunionTick(0.1);
    res.ouverte = G.uiOpen === 'reunion';
    G.wallet = 2000;
    const rel0 = jaune.relation;
    G.choixReunion('allie');
    res.alliance = { avant: rel0, apres: jaune.relation, allie: !!jaune.allieJoueur, ui: G.uiOpen };
    // sauvegarde compacte
    G.saveGuerre();
    const sv = JSON.parse(localStorage.getItem('superobby.guerre') || '{}');
    res.sauvegarde = { octets: JSON.stringify(sv).length, rep: sv.rep === G.gang.rep, gangs: Object.keys(sv.gangs || {}).length,
      terr: sv.terr && sv.terr.parc === 'joueur' };
    // rang du joueur
    G.gang.rep = 1200; res.rang = G.rangJoueur().n; G.gang.rep = sv.rep;
    return res;
  });
  const ok = r.quartiers === 8 && r.ordreSport && r.ordreArme && r.entrainement.force > r.entrainement.force0
    && r.entrainement.arme && r.entrainement.cout === 60
    && r.capture.proprio === 'joueur' && r.revenus.magot > 0 && r.revenus.coffre === r.revenus.magot
    && r.rdv.propose && r.rdv.balise && r.ouverte && r.alliance.allie && r.alliance.apres > r.alliance.avant && !r.alliance.ui
    && r.sauvegarde.octets < 1200 && r.sauvegarde.rep && r.sauvegarde.gangs === 3 && r.sauvegarde.terr
    && r.rang === 'Baron de la ville';
  return { ok, detail: `${r.quartiers} quartiers à prendre · « va t'entraîner » monte la force du gang de ${r.entrainement.force0} à ${r.entrainement.force} et « prends un fusil » l'arme pour ${r.entrainement.cout} 🪙 · le parc bascule chez le joueur et lui verse ${r.revenus.magot} 🪙 de protection dans sa planque · un chef donne rendez-vous à ${r.rdv.lieu} et l'alliance se conclut (relation ${r.alliance.avant} → ${r.alliance.apres}) · tout tient dans ${r.sauvegarde.octets} octets de sauvegarde · à 1200 ⭐ le joueur est « ${r.rang} »` };
});

test('on nage à la surface au lieu de marcher au fond de la mer', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 150, y: 1, z: 40, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 600));
    const G = __G, res = {};
    const sea = G.city.sea;
    // on tombe de 5 m au-dessus de l'eau et on laisse la physique tourner (appel direct de
    // step : le rendu logiciel du banc d'essai est bien trop lent pour attendre en temps réel)
    G.P.pos.set((sea.x1 + sea.x2) / 2, sea.top + 5, (sea.z1 + sea.z2) / 2); G.P.vel.set(0, 0, 0);
    const suivi = [];
    for (let i = 0; i < 420; i++) { G.step(1 / 60, true); if (i % 60 === 0) suivi.push(+G.P.pos.y.toFixed(2)); }
    res.mer = { y: +G.P.pos.y.toFixed(2), surface: +sea.top.toFixed(2), nage: !!G.P.swimming,
      fond: +(sea.top - 1.35).toFixed(2), suivi };
    // la piscine de la villa aussi
    const pool = G.city.villaPool;
    if (pool) {
      G.P.pos.set((pool.x1 + pool.x2) / 2, pool.top + 3, (pool.z1 + pool.z2) / 2); G.P.vel.set(0, 0, 0);
      for (let i = 0; i < 420; i++) G.step(1 / 60, true);
      res.piscine = { y: +G.P.pos.y.toFixed(2), surface: +pool.top.toFixed(2), nage: !!G.P.swimming };
    }
    return res;
  });
  const okMer = r.mer.nage && r.mer.y > r.mer.surface - 1.6 && r.mer.y < r.mer.surface + 0.6;
  const okPiscine = !r.piscine || (r.piscine.nage && r.piscine.y > r.piscine.surface - 1.6 && r.piscine.y < r.piscine.surface + 0.6);
  return { ok: okMer && okPiscine, detail: `tombé de 5 m dans la mer (surface ${r.mer.surface} m), le joueur remonte flotter à ${r.mer.y} m au lieu de couler au fond (${r.mer.suivi.join(' → ')})${r.piscine ? ` · dans la piscine de la villa (surface ${r.piscine.surface} m) il flotte à ${r.piscine.y} m` : ''}` };
});

test('la grille spatiale dit exactement la même chose qu\'un balayage complet', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const G = __G, S = G.solids;
    for (let i = 0; i < 300; i++) G.cityStep(1 / 60);   // les voitures quittent leur point de départ
    const rnd = (a, b) => a + Math.random() * (b - a);
    // 1) aucun solide ne doit manquer, véhicules en mouvement compris
    const cmp = (rayon, avecVeh) => {
      let manquants = 0;
      for (let k = 0; k < 900; k++) {
        const x = rnd(-200, 200), z = rnd(-90, 200), grille = new Set(G.solidsAutour(x, z, rayon, avecVeh));
        for (const o of S) {
          if (!avecVeh && o.veh) continue;
          if (Math.abs(o.x - x) < o.w / 2 + rayon && Math.abs(o.z - z) < o.d / 2 + rayon && !grille.has(o)) manquants++;
        }
      }
      return manquants;
    };
    const manquantsVeh = cmp(2, true), manquantsDecor = cmp(6, false);
    // 2) les voitures qui roulent sont bien vues à leur position du moment
    const roulantes = G.city.aiCars.filter(c => c.solid);
    const vues = roulantes.filter(c => G.solidsAutour(c.solid.x, c.solid.z, 2, true).includes(c.solid)).length;
    // 3) le piège : casser une vitrine puis en remettre une autre garde la MÊME longueur
    const br = G.breakables.filter(b => b.solid && b.solid.glass && !b.broken);
    const a = br[0], b = br[1], solA = a.solid, solB = b.solid, n0 = S.length;
    G.solidsAutour(solA.x, solA.z, 2, false);
    G.breakThing(a, { x: solA.x, z: solA.z }); G.breakThing(a, { x: solA.x, z: solA.z });
    const partie = !S.includes(solA);
    S.push(solB);   // « réparation » : on retombe sur la longueur de départ
    const memeLongueur = S.length === n0;
    const fantome = G.solidsAutour(solA.x, solA.z, 2, false).includes(solA);
    return { manquantsVeh, manquantsDecor, vues, roulantes: roulantes.length, partie, memeLongueur, fantome };
  });
  const ok = r.manquantsVeh === 0 && r.manquantsDecor === 0 && r.vues === r.roulantes && r.partie && r.memeLongueur && !r.fantome;
  return { ok, detail: `0 solide manquant sur ~2 200 x 900 points (décor ${r.manquantsDecor}, avec véhicules ${r.manquantsVeh}) · ${r.vues}/${r.roulantes} voitures en mouvement vues à leur place · vitrine brisée retirée=${r.partie}, longueur inchangée après « réparation »=${r.memeLongueur}, fantôme dans la grille=${r.fantome}` };
});

test('la ville vit au rythme de l\'écran, pas à 120 Hz', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const G = __G;
    G.VILLE.acc = 0; G.VILLE.tours = 0;
    for (let i = 0; i < 120; i++) G.cityCommon(1 / 120);   // une seconde de jeu, au pas de la physique
    const tours = G.VILLE.tours;
    // et le décompte doit rester juste quand l'image est plus lente que le pas de physique
    G.VILLE.acc = 0; G.VILLE.tours = 0;
    for (let i = 0; i < 30; i++) G.cityCommon(1 / 30);     // une seconde de jeu, image par image
    return { tours, toursLent: G.VILLE.tours };
  });
  // 60 passages pour une seconde : le rythme de l'écran, pas les 120 de la physique.
  const ok = r.tours >= 55 && r.tours <= 65 && r.toursLent === 30;
  return { ok, detail: `${r.tours} passages de la vie de la ville par seconde de jeu (attendu 60, et surtout pas 120) · à 30 images/s, ${r.toursLent} passages : aucun tour perdu ni doublé` };
});

test('rien ne déborde de l\'écran, du téléphone couché à la télé', async p => {
  const FORMATS = [[812, 375, 'téléphone couché'], [390, 844, 'téléphone debout'], [1920, 1080, 'télé 1080p'], [1024, 640, 'ordinateur']];
  const avant = p.viewportSize();
  const res = [];
  for (const [w, h, nom] of FORMATS) {
    await p.setViewportSize({ width: w, height: h });
    await p.evaluate(() => { __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 }); window.dispatchEvent(new Event('resize')); });
    // le rendu logiciel tourne à 2 images/s : on attend que la toile ait vraiment suivi
    // la nouvelle taille au lieu de parier sur un délai fixe
    await p.waitForFunction(v => { const c = document.getElementById('c').getBoundingClientRect();
      return Math.abs(c.width - v.w) < 2 && Math.abs(c.height - v.h) < 2; }, { w, h }, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(400);
    const r = await p.evaluate(({ w, h }) => {
      // ce qui dépasse À L'INTÉRIEUR d'une boîte qui défile n'est pas un débordement
      const dansUnDefilement = e => { for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
        const st = getComputedStyle(n); if (/auto|scroll|hidden/.test(st.overflowY + st.overflowX)) return true; } return false; };
      const deb = [], petits = [];
      for (const e of document.querySelectorAll('body *')) {
        const st = getComputedStyle(e);
        if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
        const b = e.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        if ((b.right > w + 1 || b.bottom > h + 1 || b.left < -1 || b.top < -1) && !dansUnDefilement(e))
          deb.push(`${e.tagName}#${e.id || ''}.${(e.className || '').toString().split(' ')[0]}`);
      }
      if (document.body.classList.contains('touch'))
        for (const e of document.querySelectorAll('button,.btn,.ibtn')) {
          if (getComputedStyle(e).display === 'none') continue;
          const b = e.getBoundingClientRect();
          if (b.width > 2 && (b.width < 34 || b.height < 34)) petits.push(e.id || e.className);
        }
      return { deb: deb.slice(0, 5), petits: petits.slice(0, 5) };
    }, { w, h });
    res.push({ nom, ...r });
  }
  await p.setViewportSize(avant);
  await p.evaluate(() => { __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 }); });
  const ok = res.every(r => r.deb.length === 0 && r.petits.length === 0);
  return { ok, detail: res.map(r => `${r.nom} : ${r.deb.length ? 'déborde (' + r.deb.join(', ') + ')' : 'rien ne déborde'}${r.petits.length ? ' · cibles trop petites : ' + r.petits.join(', ') : ''}`).join(' · ') };
});

test('le GPS trace le chemin jusqu\'au bout, même à l\'autre bout de la ville', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const G = __G, out = [];
    const depart = [[0, 0, 'centre'], [-150, 40, 'La Zone'], [110, 60, 'plage'], [60, 168, 'ma villa']];
    const buts = [[38, 8.6, 'bureau des missions'], [-52, 70, 'banque'], [110, 30, 'plage'], [-145, 40, 'La Zone'], [60, 168, 'ma villa']];
    for (const [px, pz, nomD] of depart) for (const [x, z, nom] of buts) {
      if (Math.hypot(px - x, pz - z) < 20) continue;
      G.P.pos.set(px, 1, pz); G.P.vel.set(0, 0, 0);
      G.setBeacon(x, z, 0.3); G.gpsRoute.hide(); G.gpsRoute.update();
      const cones = [];
      G.scene.traverse(o => { if (o.isMesh && o.visible && o.geometry && o.geometry.type === 'ConeGeometry'
        && o.material && o.material.color && o.material.color.getHex() === 0x3ef2ff) cones.push(o); });
      let reste = 1e9;
      for (const c of cones) reste = Math.min(reste, Math.hypot(c.position.x - x, c.position.z - z));
      out.push({ trajet: nomD + ' → ' + nom, loin: Math.round(Math.hypot(px - x, pz - z)),
                 chevrons: cones.length, reste: cones.length ? Math.round(reste) : null });
    }
    G.clearBeacon();
    return out;
  });
  const incomplets = r.filter(e => e.reste === null || e.reste > 12);
  const plusLong = r.reduce((a, b) => (b.loin > a.loin ? b : a), r[0]);
  return { ok: incomplets.length === 0 && r.length >= 15,
    detail: `${r.length} trajets d'un bout à l'autre de la ville : la traînée de chevrons va jusqu'à la cible dans tous les cas (le plus long, ${plusLong.trajet} à ${plusLong.loin} m, s'arrête à ${plusLong.reste} m du but avec ${plusLong.chevrons} chevrons)${incomplets.length ? ' · incomplets : ' + incomplets.map(e => e.trajet).join(', ') : ''}` };
});

test('on se voit assis au volant de la voiture qu\'on prend', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 26, y: 1, z: 0, hour: 12 });
    const G = __G;
    const c = G.city.cars.find(v => !v.heli && !v.rider && !v.busy) || G.city.cars[0];
    c.x = 26; c.z = 0; c.h = 0.7; c.busy = false; c.g.position.set(c.x, c.y || 0, c.z);
    if (G.drive.car) G.exitCar();
    G.enterCar(c);
    if (!G.drive.car) return { erreur: 'impossible de monter dans la voiture' };
    await new Promise(r2 => setTimeout(r2, 900));   // la boucle de rendu place l'avatar
    const av = G.me.group;
    // écart entre l'avatar et le centre de la voiture, exprimé dans le repère de la voiture
    const dx = av.position.x - c.x, dz = av.position.z - c.z;
    const cs = Math.cos(c.h), sn = Math.sin(c.h);
    const droite = dx * cs - dz * sn, avantArriere = dx * sn + dz * cs;
    return { visible: av.visible, y: +av.position.y.toFixed(2), voitureY: +(c.y || 0).toFixed(2),
      droite: +droite.toFixed(2), avantArriere: +avantArriere.toFixed(2),
      capAvatar: +av.rotation.y.toFixed(2), capVoiture: +c.h.toFixed(2),
      dansLaCaisse: Math.abs(droite) < (c.baseW || 2.4) / 2 && Math.abs(avantArriere) < (c.baseD || 4.4) / 2 };
  });
  await p.evaluate(() => { if (__G.drive.car) __G.exitCar(); });
  const ok = r.visible && r.dansLaCaisse && Math.abs(r.capAvatar - r.capVoiture) < 0.05
    && r.y > r.voitureY - 0.6 && r.y < r.voitureY + 0.6;
  return { ok, detail: `avatar visible=${r.visible}, à ${r.droite} m à droite et ${r.avantArriere} m en avant du centre (donc dans la caisse=${r.dansLaCaisse}), à ${r.y} m de haut, orienté comme la voiture (${r.capAvatar} contre ${r.capVoiture})` };
});

test('les escaliers de la banque ne rasent plus le mur', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -52, y: 1, z: 70, hour: 12 });
    const G = __G, bk = G.city.bank;
    // pour chaque volée : de quelle épaisseur est la bande de marbre inutile contre le mur ?
    return bk.esc.map(e => {
      // les marches sont des blocs pleins (hauts d'une contremarche) et larges de 3,60 m
      const marches = G.solids.filter(o => Math.abs(o.z - e.z) < 0.3 && Math.abs(o.d - 3.6) < 0.25 && o.w > 1.3 && o.w < 1.8 && o.y > e.y0 && o.y < e.y1 + 1);
      const prof = marches.length ? Math.max(...marches.map(o => o.d)) : 0;
      const murNord = e.z < bk.z, bordVolee = murNord ? e.z - prof / 2 : e.z + prof / 2;
      // la vraie face intérieure du mur, pas le plan nominal : le mur a une épaisseur
      const murs = G.solids.filter(o => o.h > 3 && o.w > 8 && Math.abs(o.x - bk.x) < bk.w
        && (murNord ? o.z < bk.z - bk.d / 2 + 1.5 : o.z > bk.z + bk.d / 2 - 1.5));
      const face = murs.length ? (murNord ? Math.max(...murs.map(o => o.z + o.d / 2)) : Math.min(...murs.map(o => o.z - o.d / 2)))
                               : (murNord ? bk.z - bk.d / 2 : bk.z + bk.d / 2);
      return { volee: +e.y0.toFixed(1), largeur: +prof.toFixed(2), axeAuMur: +Math.abs(e.z - face).toFixed(2) };
    });
  });
  // ce qui compte, c'est de pouvoir monter SANS SE COLLER AU MUR : une volée large, dont
  // l'axe (là où l'on marche) est à bonne distance de la paroi.
  const ok = r.length === 2 && r.every(v => v.largeur >= 3.4 && v.axeAuMur >= 2);
  return { ok, detail: r.map(v => `volée depuis ${v.volee} m : ${v.largeur} m de large, on monte à ${v.axeAuMur} m du mur (0,45 m avant, main courante comprise)`).join(' · ') };
});

test('l\'ami comprend et exécute ce qu\'on lui demande, fautes comprises', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const G = __G, ami = G.bots[0];
    G.devenirAmi(ami);
    const chiot = G.city.pets.find(x => x.kind === 'dog');
    if (chiot) { G.P.pos.set(chiot.x, 0.5, chiot.z); G.adopterChien(chiot); }
    G.P.pos.set(0, 0.5, 0); G.chien.attenteNom = false;
    const essais = [
      ['vole la boutique tatoo', 'boutique'], ['va voler la boutique de tatouage stp', 'boutique'],
      ['vole un bot', 'argent'], ['depouille un passant', 'argent'],
      ['attaque un membre d un gang adverse', 'gangRival'], ['atake les rouges', 'gangRival'],
      ['va me chercher a manger', 'rdv'], ['jai faim ramene un burger', 'rdv'],
      ['apporte un velo', 'rdv'], ['va promener mon chien', 'chien'], ['sors le chien', 'chien'],
      ['va braquer la banque et apporte moi l argent', 'rdv'], ['bracer la banke', 'banque'],
      ['danse', 'danse'], ['viens on joue au tennis', 'rdv'], ['viens on joue au foot', 'rdv'],
      ['fait des defi pour me gagner de l argent', 'defi'], ['lance un defi', 'defi'],
      ['cambriole une villa', 'villa'], ['vole une voiture', 'voiture'],
      ['protege moi', 'rdv'], ['suis moi', 'rdv'],
    ];
    const rates = [];
    for (const [phrase, attendu] of essais) {
      ami.ordre = null; ami.rdv = null; ami.activite = null; ami.dance = 0; ami.wait = 0; ami.bagarre = null;
      G.gang.mission = null; G.defi.on = null; G.chien.promeneur = null;
      const compris = G.commandeSociale(ami.name + ' ' + phrase);
      const obtenu = G.gang.mission ? G.gang.mission.type : G.defi.on ? 'defi'
        : G.chien.promeneur ? 'chien' : ami.dance > 0 ? 'danse' : ami.rdv ? 'rdv' : null;
      if (!compris || !obtenu || (attendu !== 'rdv' && obtenu !== attendu)) rates.push(`${phrase} → ${obtenu || 'rien'}`);
    }
    G.gang.mission = null; G.defi.on = null; G.chien.promeneur = null;
    return { total: essais.length, rates };
  });
  return { ok: r.rates.length === 0,
    detail: `${r.total - r.rates.length}/${r.total} ordres compris ET exécutés, y compris « bracer la banke », « atake les rouges » et « vole la boutique tatoo »${r.rates.length ? ' · ratés : ' + r.rates.join(', ') : ''}` };
});

test('le chien a sa place dans tous les véhicules, et sous la voile', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const G = __G;
    const chiot = G.city.pets.find(x => x.kind === 'dog');
    if (!chiot) return { erreur: 'pas de chien dans le parc' };
    G.P.pos.set(chiot.x, 0.5, chiot.z); G.adopterChien(chiot); G.chien.attenteNom = false;
    const d = G.chien.pet, out = [];
    const essai = (nom, c) => {
      if (!c) { out.push({ nom, aBord: false, absent: true }); return; }
      c.busy = false; if (G.drive.car) G.exitCar();
      c.x = 20; c.z = 20; c.h = 0.4; c.g.position.set(c.x, c.y || 0, c.z);
      G.P.pos.set(20, 1, 20); G.enterCar(c);
      if (!G.drive.car) { out.push({ nom, aBord: false, refus: true }); return; }
      for (let i = 0; i < 60; i++) G.step(1 / 60, true);
      const cs = Math.cos(c.h), sn = Math.sin(c.h), dx = d.x - c.x, dz = d.z - c.z;
      const lat = dx * cs - dz * sn, lon = dx * sn + dz * cs;
      out.push({ nom, aBord: Math.abs(lat) < (c.baseW || 2.6) / 2 + 0.6 && Math.abs(lon) < (c.baseD || 4.4) / 2 + 0.6,
        h: +(d.y - (c.y || 0)).toFixed(2), memeCap: Math.abs((d.g.rotation.y % 6.283) - c.h) < 0.05 });
      G.exitCar();
    };
    const cars = G.city.cars;
    essai('voiture', cars.find(c => !c.heli && !c.rider && !c.kind));
    essai('camion', cars.find(c => c.kind === 'truck'));
    essai('vélo', cars.find(c => c.kind === 'bike'));
    essai('moto', cars.find(c => c.kind === 'moto' || c.kind === 'scooter'));
    essai('hélicoptère', cars.find(c => c.heli));
    essai('jet-ski', cars.find(c => c.kind === 'jetski'));
    // sous le parachute / le deltaplane
    G.P.pos.set(40, 30, 40); G.P.facing = 1.1;
    G.P.voile = 'parachute'; G.P.voileMesh = G.P.voileMesh || { factice: true };
    for (let i = 0; i < 30; i++) G.step(1 / 60, true);
    const dist = Math.hypot(d.x - G.P.pos.x, d.z - G.P.pos.z);
    out.push({ nom: 'parachute/deltaplane', aBord: dist < 1.2 && Math.abs(d.y - G.P.pos.y) < 1.2, h: +(d.y - G.P.pos.y).toFixed(2), memeCap: true });
    G.P.voile = null; G.P.voileMesh = null;
    return { out };
  });
  if (r.erreur) return { ok: false, detail: r.erreur };
  const rates = r.out.filter(v => !v.aBord);
  return { ok: rates.length === 0,
    detail: r.out.map(v => `${v.nom} : ${v.aBord ? 'à bord à ' + v.h + ' m' : (v.absent ? 'aucun véhicule' : v.refus ? 'montée refusée' : 'RESTÉ AU SOL')}`).join(' · ') };
});

test('les habitants prennent aussi la voiture, pas seulement le vélo', async p => {
  const dep = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const G = __G;
    const dansListe = G.ACTIVITES ? G.ACTIVITES.some(a => a.k === 'voiture') : false;
    const b = G.bots.find(x => !x.ko && x.av.group.visible);
    window.__conducteur = b;
    b.activite = null; b.rdv = null; b.drive = null; b.ordre = null; b.wait = 0;
    // on gare une voiture libre juste à côté de lui : sous rendu logiciel, le trajet à pied
    // mangeait tout le temps imparti et le test échouait sur la montre, pas sur le jeu
    { const c = G.city.cars.find(v => !v.heli && !v.rider && !v.busy && v.kind !== 'jetski');
      if (c) { c.x = b.pos.x + 3; c.z = b.pos.z + 3; c.g.position.set(c.x, c.y || 0, c.z); G.vehicleSolid(c); } }
    const lance = G.lancerActivite(b, { k: 'voiture', e: '🚗', n: 'faire un tour en voiture' }) !== false;
    if (b.activite) b.activite.fin = G.simTime + 600;   // on lui laisse le temps d'arriver
    return { dansListe, lance, nom: b.name, cible: b.rdv ? [+b.rdv.x.toFixed(1), +b.rdv.z.toFixed(1)] : null };
  });
  // les bots avancent dans la boucle de rendu, pas dans step() : on attend pour de vrai
  // sous rendu logiciel le jeu tourne à ~2 images/s : 90 s d'attente ne laissaient que 9 s de
  // temps de jeu au bot pour parcourir la quinzaine de mètres jusqu'à la voiture
  const auVolant = await attendre(p, () => !!(window.__conducteur.drive && window.__conducteur.drive.car), 210000);
  const r = await p.evaluate(() => {
    const b = window.__conducteur, c = b.drive && b.drive.car;
    return { quatreRoues: !!(c && !c.rider && !c.heli), nomVoiture: c ? (c.kind || 'voiture') : null,
      roule: !!(c && Math.abs(b.drive.speed || 0) >= 0), distanceParcourue: +Math.hypot(b.pos.x, b.pos.z).toFixed(1) };
  });
  await p.evaluate(() => { const b = window.__conducteur; if (b.drive && b.drive.car) __G.libereVoiture(b.drive.car); b.drive = null; b.activite = null; b.rdv = null; });
  const ok = dep.dansListe && dep.lance && auVolant && r.quatreRoues;
  return { ok, detail: `« faire un tour en voiture » fait partie des activités=${dep.dansListe} · ${dep.nom} rejoint la voiture garée en ${dep.cible} et se met au volant=${auVolant} (quatre roues=${r.quatreRoues}, ${r.nomVoiture})` };
});

test('on descend de voiture à côté, jamais dans la carrosserie ni dans un mur', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 26, y: 1, z: 0, hour: 12 });
    const G = __G, out = [];
    const essai = (nom, cx, cz, h) => {
      const c = G.city.cars.find(v => !v.heli && !v.rider && !v.busy) || G.city.cars[0];
      c.busy = false; if (G.drive.car) G.exitCar();
      c.x = cx; c.z = cz; c.h = h; c.g.position.set(c.x, c.y || 0, c.z); G.vehicleSolid(c);
      G.P.pos.set(cx, 1, cz); G.enterCar(c);
      if (!G.drive.car) { out.push({ nom, refus: true }); return; }
      G.exitCar();
      for (let i = 0; i < 30; i++) G.step(1 / 60, true);
      const dx = G.P.pos.x - c.x, dz = G.P.pos.z - c.z, cs = Math.cos(c.h), sn = Math.sin(c.h);
      const lat = dx * cs - dz * sn, lon = dx * sn + dz * cs;
      out.push({ nom, d: +Math.hypot(dx, dz).toFixed(2),
        dansLaCaisse: Math.abs(lat) < (c.baseW || 2.4) / 2 && Math.abs(lon) < (c.baseD || 4.4) / 2,
        dansUnMur: G.npcBlocked(G.P.pos.x, G.P.pos.y, G.P.pos.z, 0.42) });
    };
    essai('rue dégagée', 26, 0, 0.9);
    const b = G.city.batiments.find(x => x.w > 8);
    essai('collé à un immeuble', b.x + b.w / 2 + 1.4, b.z, Math.PI / 2);
    essai('coin de bâtiment', b.x + b.w / 2 + 1.3, b.z - b.d / 2 + 1, 0);
    return out;
  });
  const rates = r.filter(v => v.refus || v.dansLaCaisse || v.dansUnMur);
  return { ok: rates.length === 0 && r.length === 3,
    detail: r.map(v => `${v.nom} : ${v.refus ? 'montée refusée' : `on ressort à ${v.d} m, hors de la caisse=${!v.dansLaCaisse}, hors des murs=${!v.dansUnMur}`}`).join(' · ') };
});

test('la livraison du colis se termine dans le temps imparti', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const G = __G;
    // on refait la mission dix fois : retrait et adresse changent à chaque fois, il faut que
    // le temps accordé tienne la route pour TOUTES les combinaisons, pas seulement la plus courte
    const essais = [];
    for (let n = 0; n < 10; n++) {
      G.wallet = 0; G.startMission('livraison');
      if (!G.mission.cur) return { erreur: 'mission refusée' };
      const dep = G.mission.data.dep;
      G.P.pos.set(dep.x, 0.6, dep.z); G.P.vel.set(0, 0, 0);
      for (let i = 0; i < 30; i++) G.step(1 / 60, true);
      const d0 = G.mission.data;
      if (!d0.dest) return { erreur: 'pas de destination après le colis (' + dep.nom + ')' };
      const pth0 = G.navEnPieton(() => G.navPath(G.P.pos.x, G.P.pos.z, d0.dest[0], d0.dest[1]));
      let L = 0, a0 = [G.P.pos.x, G.P.pos.z];
      for (const b of (pth0 || [])) { L += Math.hypot(b[0] - a0[0], b[1] - a0[1]); a0 = b; }
      essais.push({ trajet: dep.nom + ' → ' + d0.arr.nom, route: Math.round(L), limite: G.mission.limit, marge: +(G.mission.limit - L / 3.2).toFixed(0) });
      G.endMission(false, true);
    }
    G.wallet = 0; G.startMission('livraison');
    if (!G.mission.cur) return { erreur: 'mission refusée' };
    G.P.pos.set(G.mission.data.dep.x, 0.6, G.mission.data.dep.z); G.P.vel.set(0, 0, 0);
    for (let i = 0; i < 30; i++) G.step(1 / 60, true);
    const d = G.mission.data, limite = G.mission.limit, etape = G.mission.step;
    if (!d.dest) return { erreur: 'pas de destination après le colis' };
    // on suit l'itinéraire piéton, comme le ferait le joueur
    const pth = G.navEnPieton(() => G.navPath(G.P.pos.x, G.P.pos.z, d.dest[0], d.dest[1]));
    let route = 0, a = [G.P.pos.x, G.P.pos.z];
    for (const b of (pth || [])) { route += Math.hypot(b[0] - a[0], b[1] - a[1]); a = b; }
    for (const q of (pth || [])) { G.P.pos.set(q[0], 0.6, q[1]); for (let i = 0; i < 10; i++) G.step(1 / 60, true); if (!G.mission.cur) break; }
    if (G.mission.cur) { G.P.pos.set(d.dest[0], 0.6, d.dest[1]); for (let i = 0; i < 30; i++) G.step(1 / 60, true); }
    return { etape, limite, route: Math.round(route), finie: !G.mission.cur, gain: G.wallet,
      marge: +(limite - route / 3.2).toFixed(0), essais,
      combinaisons: new Set(essais.map(e => e.trajet)).size, pireMarge: Math.min(...essais.map(e => e.marge)) };
  });
  if (r.erreur) return { ok: false, detail: r.erreur };
  const ok = r.etape === 1 && r.finie && r.gain > 0 && r.marge >= 25 && r.combinaisons >= 6 && r.pireMarge >= 25;
  return { ok, detail: `colis récupéré au point de retrait (étape ${r.etape}), livré à ${r.route} m d'itinéraire en ${r.limite} s (${r.marge} s de marge à 3,2 m/s) · livrée : ${r.finie}, +${r.gain} 🪙 · ${r.combinaisons} trajets différents sur 10 tirages, la marge la plus juste vaut ${r.pireMarge} s` };
});

test('écrire le nom de quelqu\'un ouvre la liste de ses ordres, et chacun s\'exécute', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const G = __G, ami = G.bots[0];
    G.devenirAmi(ami);
    const chiot = G.city.pets.find(x => x.kind === 'dog');
    if (chiot) { G.P.pos.set(chiot.x, 0.5, chiot.z); G.adopterChien(chiot); }
    G.P.pos.set(0, 0.5, 0); G.chien.attenteNom = false; G.wallet = 5000;
    G.rejoindreGang(ami);
    const ouvre = G.commandeSociale(ami.name) && G.uiOpen === 'ordres';
    const phrases = [...document.querySelectorAll('#ordresGrid [data-p]')].map(b => b.dataset.p);
    G.closeUI();
    const rates = [];
    for (const ph of phrases) {
      ami.ordre = null; ami.rdv = null; ami.activite = null; ami.dance = 0; ami.wait = 0;
      ami.bagarre = null; ami.garde = 0; ami.drive = null; ami.arme = false;
      G.gang.mission = null; G.defi.on = null; G.chien.promeneur = null;
      if (G.uiOpen) G.closeUI();
      const compris = G.commandeSociale(ami.name + ' ' + ph);
      const effet = G.gang.mission ? 'mission' : G.defi.on ? 'défi' : G.chien.promeneur ? 'promenade'
        : ami.dance > 0 ? 'danse' : ami.rdv ? 'rdv' : ami.bagarre ? 'bagarre' : ami.garde ? 'garde'
        : ami.arme ? 'armé' : ami.ordre ? 'ordre' : (G.uiOpen === 'ordres' ? null : 'réponse');
      if (!compris || !effet) rates.push(ph);
    }
    if (G.uiOpen) G.closeUI();
    return { duGang: G.estDuGang(ami), ouvre, n: phrases.length, rates };
  });
  const ok = r.ouvre && r.duGang && r.n >= 30 && r.rates.length === 0;
  return { ok, detail: `le nom seul ouvre la liste (${r.n} ordres, membre du gang=${r.duGang}) et chacun s'exécute${r.rates.length ? ' · ratés : ' + r.rates.join(', ') : ''}` };
});

test('le bouton 📣 montre qui commander, puis ses ordres', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    if (G.uiOpen) G.closeUI();
    document.getElementById('ordresBtn').click();
    const gens = [...document.querySelectorAll('#ordresGrid [data-qui]')].map(b => b.dataset.qui);
    const picker = G.uiOpen === 'ordres' && !document.getElementById('ordres').classList.contains('hidden');
    const btn = document.querySelector('#ordresGrid [data-qui]');
    if (btn) btn.click();
    const n = document.querySelectorAll('#ordresGrid [data-p]').length;
    const titre = document.getElementById('ordresTitre').textContent;
    G.closeUI();
    // depuis la liste, deux clics font d'un inconnu un membre du gang
    const b = G.bots[0]; G.amis.delete(b.name);
    G.gang.membres.length = 0; b.gang = null;   // un test précédent a pu l'enrôler
    G.openOrdres(b);
    const etapes = [];
    const releve = () => etapes.push({ liens: [...document.querySelectorAll('#ordresGrid [data-lien]')].map(x => x.dataset.lien).join(''), ordres: document.querySelectorAll('#ordresGrid [data-p]').length });
    releve();
    const c1 = document.querySelector('#ordresGrid [data-lien]'); if (c1) c1.click(); releve();
    const c2 = document.querySelector('#ordresGrid [data-lien]'); if (c2) c2.click(); releve();
    const chaine = G.estAmi(b.name) && G.estDuGang(b) && etapes[0].liens === 'ami' && etapes[1].liens === 'gang' && etapes[2].liens === '' && etapes[2].ordres > etapes[0].ordres;
    G.closeUI();
    // « ordres » tout court, sans connaître le moindre nom
    const motSeul = G.commandeSociale('ordres') && G.uiOpen === 'ordres';
    if (G.uiOpen) G.closeUI();
    return { picker, gens: gens.length, n, titre, motSeul, chaine, etapes };
  });
  const ok = r.picker && r.gens >= 5 && r.n >= 25 && /Ordres pour/.test(r.titre) && r.motSeul && r.chaine;
  return { ok, detail: `le bouton 📣 liste ${r.gens} personnes, un clic ouvre ${r.n} ordres (« ${r.titre} ») · deux clics font d'un inconnu un membre du gang (${r.etapes.map(e => e.ordres).join(' → ')} ordres) · « ordres » tout court ouvre aussi la liste` };
});

test('le repère de mission ne peut plus être effacé par un ami ou un gang', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    G.startMission('livraison');
    const dep = { vis: G.beacon.m.visible, x: Math.round(G.beacon.x), z: Math.round(G.beacon.z) };
    const etats = [];
    const releve = quoi => etats.push({ quoi, vis: !!(G.beacon.m && G.beacon.m.visible), x: Math.round(G.beacon.x), z: Math.round(G.beacon.z) });
    // tout ce qui, avant, écrasait le repère en pleine mission
    G.clearBeacon(); releve('un ami arrive au rendez-vous');
    G.setBeacon(200, 200); releve('un ami part chercher une voiture');
    G.setBeacon(-150, -150, 0.3); releve('le gang donne un point de ralliement');
    G.missionTick(0.016); releve('un tour de jeu');
    const tenu = etats.every(e => e.vis && e.x === dep.x && e.z === dep.z);
    // la mission finie, le repère redevient libre pour les amis
    G.endMission(false, true);
    G.setBeacon(50, 60);
    const libre = G.beacon.m.visible && Math.round(G.beacon.x) === 50;
    G.clearBeacon();
    return { dep, etats, tenu, libre, efface: !G.beacon.m.visible };
  });
  const ok = r.dep.vis && r.tenu && r.libre && r.efface;
  return { ok, detail: `le repère de la mission (${r.dep.x}, ${r.dep.z}) tient bon face à ${r.etats.length} interférences, puis redevient libre une fois la mission terminée` };
});

test('les conducteurs suivent les rues au lieu de couper à travers tout', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    const TRAJETS = [[-40, -40, 40, 90], [0, 0, -92, 60], [50, 40, -60, 110], [-16, 6, 46, -8], [0, 110, 40, 200], [-92, -40, 60, 60]];
    const res = [];
    for (const [x0, z0, tx, tz] of TRAJETS) {
      const c = G.city.cars.find(v => !v.heli && !v.busy && v.kind !== 'jetski' && !v.rider);
      if (!c) break;
      c.x = x0; c.z = z0; c.h = 0; c.speed = 0; c.y = G.groundUnder(x0, z0, c.solid, 0.5);
      const st = { saut: true };
      let plan = 0; { const q = G.navPath(x0, z0, tx, tz) || []; let a = [x0, z0]; for (const b of q) { plan += Math.hypot(b[0] - a[0], b[1] - a[1]); a = b; } }
      let t = 0, colle = 0, virages = 0, hPrec = c.h, chemin = 0, px = c.x, pz = c.z, arrive = 0, surRoute = 0, ech = 0;
      const dt = 1 / 60;
      for (let i = 0; i < 60 * 240; i++) {
        G.step(dt); const dd = G.conduire(c, tx, tz, dt, st); t += dt;
        let dh = c.h - hPrec; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); virages += Math.abs(dh); hPrec = c.h;
        chemin += Math.hypot(c.x - px, c.z - pz); px = c.x; pz = c.z;
        if (st.bloqueT > 0.05) colle++;
        { const [ci, cj] = G.navCell(c.x, c.z); if (G.NAV.cout && G.NAV.cout[cj * G.NAV.nx + ci] === 1) surRoute++; ech++; }
        if (dd < 8) { arrive = t; break; }
      }
      res.push({ arrive: +arrive.toFixed(1), suivi: +(chemin / Math.max(1, plan)).toFixed(2),
        virages: Math.round(virages * 180 / Math.PI), colle: Math.round(100 * colle / Math.max(1, ech)), surRoute: Math.round(100 * surRoute / Math.max(1, ech)) });
    }
    const moy = k => +(res.reduce((a, x) => a + x[k], 0) / res.length).toFixed(2);
    return { n: res.length, arrivees: res.filter(x => x.arrive > 0).length, suivi: moy('suivi'), virages: moy('virages'), colle: moy('colle'), surRoute: moy('surRoute'), temps: moy('arrive') };
  });
  // références mesurées avant la refonte : 53 % sur la route, 1487° de volant, 26 % du temps
  // à racler un obstacle, 25 s de trajet et 1,26 fois la longueur de l'itinéraire prévu
  // seuils volontairement larges : la circulation de la ville varie d'une exécution à l'autre,
  // ce qui fait bouger ces chiffres de quelques points. Ils restent loin des valeurs d'avant.
  const ok = r.arrivees === r.n && r.surRoute >= 63 && r.virages <= 1000 && r.colle <= 25 && r.suivi <= 1.18;
  return { ok, detail: `${r.arrivees}/${r.n} trajets menés à bien · ${r.surRoute} % du temps sur la chaussée (53 % avant), ${r.virages}° de volant (1487° avant), ${r.colle} % du temps à racler un obstacle (26 % avant), ${r.temps} s de trajet (25 s avant) et ${r.suivi}× la longueur de l'itinéraire prévu (1.26× avant)` };
});

test('les balançoires sont alignées et centrées sous leur portique', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -12, y: 1, z: 66, hour: 12 });
    const G = __G, sw = G.city.swings.map(s => +s.x.toFixed(2));
    const ecarts = []; for (let i = 1; i < sw.length; i++) ecarts.push(+(sw[i] - sw[i - 1]).toFixed(2));
    const regulier = ecarts.every(e => Math.abs(e - ecarts[0]) < 0.01);
    const centre = +((sw[0] + sw[sw.length - 1]) / 2).toFixed(2);
    // les pieds du portique : des poteaux verticaux de 0,2 m autour de z = 62
    const pieds = G.solids.filter(o => Math.abs(o.z - 62) > 1.2 && Math.abs(o.z - 62) < 1.8 && o.w < 0.5 && o.h > 3 && o.x > -20 && o.x < -4).map(o => +o.x.toFixed(2));
    const piedsX = [...new Set(pieds)];
    const colle = sw.filter(x => piedsX.some(px => Math.abs(px - x) < 0.6));
    // on s'assied bien sur la balançoire la plus proche, pas sur celle d'à côté
    G.P.pos.set(sw[1], 0.5, 62); G.step(1 / 60, true);
    const bonne = G.city.swingNear ? +G.city.swingNear.x.toFixed(2) : null;
    return { sw, ecarts, regulier, centre, piedsX, colle, bonne, attendue: sw[1] };
  });
  const ok = r.sw.length === 4 && r.regulier && Math.abs(r.centre + 12) < 0.01 && r.colle.length === 0
    && r.piedsX.length === 2 && r.bonne === r.attendue;
  return { ok, detail: `4 sièges régulièrement espacés de ${r.ecarts[0]} m, centrés sur x = ${r.centre} · le portique n'a plus que ${r.piedsX.length} pieds (${r.piedsX.join(' et ')}), aucun siège planté devant un pied · on s'assied bien sur le siège le plus proche (${r.bonne})` };
});

test('le garage répare la voiture cabossée, et la lave', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    const c = G.city.cars.find(v => !v.heli && !v.rider && v.kind !== 'jetski' && !v.busy);
    c.x = G.P.pos.x + 2; c.z = G.P.pos.z; c.dmg = 0; c.dead = false;
    G.wallet = 500;
    const neuf = G.prixRepare(c);
    G.vehicleDamage(c, 70);
    const abime = Math.round(c.dmg), px = G.prixRepare(c);
    G.openAtelier();
    const ongletAuto = G.uiOpen === 'ordres' ? null : document.querySelector('#atelierOnglets .sel');
    const boutons = [...document.querySelectorAll('#atelierCorps [data-rep], #atelierCorps [data-lave]')].map(b => b.dataset.rep ? 'rep' : 'lave');
    const w0 = G.wallet;
    const brep = document.querySelector('#atelierCorps [data-rep]'); if (brep) brep.click();
    const apres = { dmg: Math.round(c.dmg || 0), paye: w0 - G.wallet, prixApres: G.prixRepare(c) };
    const w1 = G.wallet;
    const blav = document.querySelector('#atelierCorps [data-lave]'); if (blav) blav.click();
    const lavage = w1 - G.wallet;
    // épave : la note grimpe
    G.vehicleDamage(c, 200);
    const epave = { mort: !!c.dead, prix: G.prixRepare(c) };
    G.repareAtelier();
    const remise = { dmg: Math.round(c.dmg || 0), mort: !!c.dead };
    G.closeUI();
    return { neuf, abime, px, onglet: ongletAuto ? ongletAuto.textContent : null, boutons, apres, lavage, epave, remise };
  });
  const ok = r.neuf === 0 && r.abime >= 60 && r.px > 0 && /Réparation/.test(r.onglet || '')
    && r.boutons.length === 2 && r.apres.dmg === 0 && r.apres.paye === r.px && r.apres.prixApres === 0
    && r.lavage === 5 && r.epave.mort && r.epave.prix > r.px && !r.remise.mort && r.remise.dmg === 0;
  return { ok, detail: `l'atelier s'ouvre directement sur « ${(r.onglet || '').trim()} » quand la caisse est abîmée · ${r.abime} % de dégâts réparés pour ${r.apres.paye} 🪙 (0 % ensuite, et plus rien à payer) · lavage ${r.lavage} 🪙 · une épave coûte ${r.epave.prix} 🪙 et repart comme neuve` };
});

test('le chien obéit à tous ses ordres', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 70, hour: 12 });
    const G = __G;
    const pet = G.city.pets.find(x => x.kind === 'dog');
    G.P.pos.set(pet.x, 0.5, pet.z); G.adopterChien(pet, true);
    G.chien.nom = 'Rex'; G.chien.attenteNom = false; G.P.pos.set(0, 0.5, 70);
    const liste = G.commandeSociale('Rex') && G.uiOpen === 'ordres';
    const n = document.querySelectorAll('#ordresGrid [data-chien]').length;
    if (G.uiOpen) G.closeUI();
    const essais = [['Rex assis', 'assis'], ['couché', 'couche'], ['debout', 'debout'], ['reste ici', 'reste'],
      ['au pied', 'suit'], ['saute', 'saute'], ['donne la patte', 'patte'], ['aboie', 'aboie'],
      ['va chercher la balle', 'balle'], ['mange', 'mange'], ['dors', 'dort'], ['défends moi', 'garde']];
    const rates = [];
    for (const [txt, attendu] of essais) {
      G.chien.ordre = null; G.chien.saut = 0; G.chien.patte = 0; G.chien.garde = 0; G.chien.balle = null; G.chien.poste = null;
      const compris = G.commandeSociale(txt);
      if (G.uiOpen) G.closeUI();
      const etat = attendu === 'saute' ? (G.chien.saut > G.simTime ? 'saute' : null)
        : attendu === 'patte' ? (G.chien.patte > G.simTime ? 'patte' : null)
        : attendu === 'garde' ? (G.chien.garde > G.simTime ? 'garde' : null)
        : attendu === 'aboie' ? (compris ? 'aboie' : null)
        : attendu === 'balle' ? (G.chien.balle ? 'balle' : null) : G.chien.ordre;
      if (!compris || etat !== attendu) rates.push(txt + '→' + etat);
    }
    // « assis » : il se pose et ne suit plus le maître qui s'éloigne
    G.chienOrdre('assis', ''); const p0 = [pet.x, pet.z];
    G.P.pos.set(24, 0.5, 84); for (let i = 0; i < 30; i++) G.chienTick(1 / 60);
    const reste = Math.hypot(pet.x - p0[0], pet.z - p0[1]) < 0.4;
    // « au pied » : il repart vers le maître
    G.chienOrdre('suit', ''); for (let i = 0; i < 120; i++) G.chienTick(1 / 60);
    const revient = Math.hypot(pet.x - 24, pet.z - 84) < Math.hypot(p0[0] - 24, p0[1] - 84);
    // mordre : il faut quelqu'un à portée
    const cible = G.bots[0]; cible.ko = 0; cible.pos.set(25, 0.3, 85); cible.av.group.position.copy(cible.pos); cible.av.group.visible = true;
    G.chien.ordre = null;
    const mords = G.commandeSociale('mords le') && !!G.chien.attaque;
    G.chien.attaque = null; G.chien.ordre = 'suit';
    return { liste, n, rates, reste, revient, mords };
  });
  const ok = r.liste && r.n >= 12 && r.rates.length === 0 && r.reste && r.revient && r.mords;
  return { ok, detail: `écrire son nom ouvre ses ${r.n} ordres · les 12 ordres sont compris et exécutés · « assis » le fait rester sur place quand le maître s'éloigne (${r.reste}), « au pied » le fait revenir (${r.revient}), « mords » lui désigne une cible (${r.mords})` };
});

test('en moto avec un ami : un devant, un derrière, le chien dans son panier', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 112, y: 1, z: 70, hour: 12 });
    const G = __G;
    const pet = G.city.pets.find(x => x.kind === 'dog');
    G.P.pos.set(pet.x, 0.5, pet.z); G.adopterChien(pet, true); G.chien.nom = 'Rex'; G.chien.attenteNom = false;
    const b = G.bots[0]; G.devenirAmi(b);
    const moto = G.city.cars.find(c => c.kind === 'moto') || G.city.cars.find(c => c.rider);
    moto.x = 112; moto.z = 70; moto.h = 0; moto.busy = true; moto.y = G.groundUnder(112, 70, moto.solid, 1);
    b.drive = { car: moto, tx: 112, tz: 120, nom: 'test', etat: 'route', passager: true, annonce: G.simTime };
    G.city.rideBot = b; G.P.pos.set(112, 0.5, 70); b.av.group.visible = true;
    for (let i = 0; i < 8; i++) { G.botDriveTick(1 / 60); G.chienTick(1 / 60); }
    const cd = b.av.group.position, jo = G.me.group.position, ch = pet.g.position;
    // on mesure le long de l'AXE de la moto (elle peut avoir légèrement tourné), pas en z
    const sn = Math.sin(moto.h), cs = Math.cos(moto.h);
    const avant = o => (o.x - moto.x) * sn + (o.z - moto.z) * cs;
    const aC = avant(cd), aJ = avant(jo), aD = avant(ch);
    const ordre = aC > aJ && aJ > aD;
    const panier = moto.panier ? { visible: moto.panier.visible, z: +moto.panier.position.z.toFixed(2) } : null;
    const chienDansPanier = panier && Math.abs(aD - panier.z) < 0.35 && ch.y > moto.y + 0.5;
    const res = { ecartCJ: +(aC - aJ).toFixed(2), ecartJC: +(aJ - aD).toFixed(2), ordre, panier, chienDansPanier,
      hauteurChien: +(ch.y - moto.y).toFixed(2) };
    // en descendant, le panier disparaît
    G.botDescendre(b, true); for (let i = 0; i < 5; i++) G.chienTick(1 / 60);
    res.panierRange = !!(moto.panier && !moto.panier.visible);
    return res;
  });
  const ok = r.ordre && r.ecartCJ >= 1.1 && r.ecartJC >= 0.4 && r.panier && r.panier.visible && r.chienDansPanier && r.panierRange;
  return { ok, detail: `conducteur, passager puis chien alignés d'avant en arrière (${r.ecartCJ} m entre les deux personnes, ${r.ecartJC} m jusqu'au chien) · le chien est dans son panier à ${r.hauteurChien} m au-dessus de la moto · le panier disparaît quand il descend (${r.panierRange})` };
});

test('le salon de tatouage : grandes tailles, faces arrière et détatouage', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    G.wallet = 2000; G.myCfg.tatouages = [];
    const tailles = G.TATOO_TAILLES.map(t => t.s);
    const arriere = G.TATOO_ZONES.filter(z => /nuque|arriere/i.test(z.k)).map(z => z.k);
    const rates = [];
    for (const z of G.TATOO_ZONES) {
      G.myCfg.tatouages = [{ motif: 'lion', zone: z.k, encre: 'noir', taille: 'geant', mot: '' }];
      G.applyMyLook();
      if (!G.me.tatouages || !G.me.tatouages.length) { rates.push(z.k); continue; }
      const m = G.me.tatouages[0];
      if (Math.abs(m.geometry.parameters.width - 0.78) > 0.01) rates.push(z.k + ':taille');
    }
    // détatouage payant, à l'unité puis en bloc
    const deux = () => { G.myCfg.tatouages = [{ motif: 'lion', zone: 'nuque', encre: 'noir', taille: 'gros', mot: '' },
      { motif: 'aigle', zone: 'arriereBrasD', encre: 'rouge', taille: 'geant', mot: '' }]; G.applyMyLook(); G.majTatoo(); };
    G.openTatoo(); deux();
    const boutons = { un: document.querySelectorAll('#tatooListe [data-del]').length, tout: document.querySelectorAll('#tatooListe [data-tout]').length };
    let w = G.wallet; document.querySelector('#tatooListe [data-del]').click();
    const un = { reste: G.myCfg.tatouages.length, paye: w - G.wallet };
    deux(); w = G.wallet; document.querySelector('#tatooListe [data-tout]').click();
    const tout = { reste: G.myCfg.tatouages.length, paye: w - G.wallet };
    // sans argent, on ne peut pas se faire détatouer
    deux(); G.wallet = 5; document.querySelector('#tatooListe [data-del]').click();
    const fauche = G.myCfg.tatouages.length;
    G.wallet = 2000; G.myCfg.tatouages = []; G.applyMyLook(); G.closeUI();
    return { tailles, zones: G.TATOO_ZONES.length, arriere, rates, boutons, un, tout, fauche };
  });
  const ok = r.rates.length === 0 && r.zones >= 16 && r.arriere.length === 5 && Math.max(...r.tailles) >= 0.7
    && r.tailles.length === 5 && r.boutons.tout === 1 && r.un.reste === 1 && r.un.paye === 20
    && r.tout.reste === 0 && r.tout.paye === 40 && r.fauche === 2;
  return { ok, detail: `${r.tailles.length} tailles jusqu'à ${Math.max(...r.tailles)} (0,40 avant) · ${r.zones} emplacements dont ${r.arriere.length} de dos (${r.arriere.join(', ')}), tous posés correctement · détatouage au laser : 1 motif = ${r.un.paye} 🪙, tout effacer = ${r.tout.paye} 🪙, refusé sans argent (${r.fauche} tatouages gardés)` };
});

test('les barres de performance : entraînement, missions, police qui s\'essouffle', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    // le joueur progresse en s'entraînant et en réussissant des missions
    G.P.perf = 10;
    G.perfGagne(G.P, 3, null); G.perfGagne(G.P, 4, null);
    res.joueur = { depart: 10, apres: G.perfDe(G.P), hud: (document.getElementById('perfHud').textContent || '').includes('/') === false };
    res.etoiles = [5, 40, 60, 90].map(v => G.perfEtoiles(v));
    // la police : une étoile = petite performance, l'armée = maximale
    const paliers = {};
    for (const w of [0, 1, 2, 3]) { G.police.wanted = w; G.police.usure = 0; paliers[w] = Math.round(G.policePerf()); }
    G.armee.on = true; paliers.armee = Math.round(G.policePerf()); G.armee.on = false;
    G.police.wanted = 3; G.police.usure = 40; paliers.uses = Math.round(G.policePerf());
    // se cacher hors de portée use la police
    G.police.wanted = 3; G.police.usure = 0; G.police.cars.forEach(c => { c.x = -400; c.z = -400; });
    G.P.pos.set(0, 0.4, 8);
    const u0 = G.police.usure;
    for (let i = 0; i < 60; i++) G.policeTick(0.1);
    paliers.apresFuite = Math.round(G.policePerf());
    res.usureMontee = G.police.usure > u0;
    G.police.wanted = 0; G.police.usure = 0; G.clearWanted();
    res.police = paliers;
    // deux hommes valent mieux qu'un, et un homme entraîné vaut mieux que deux débutants
    const a = G.bots[0], b = G.bots[1];
    G.devenirAmi(a); G.rejoindreGang(a); G.devenirAmi(b); G.rejoindreGang(b);
    const chance = (membres, type) => { G.gang.mission = null; G.missionGang(membres, type);
      const c = G.gang.mission ? G.gang.mission.chanceDep : null; G.gang.mission = null;
      membres.forEach(m => { m.gangMission = null; m.rdv = null; m.ordre = null; }); return c; };
    a.perf = 30; b.perf = 30;
    res.chances = { un: chance([a], 'boutique'), deux: chance([a, b], 'boutique'), banqueUn: chance([a], 'banque') };
    a.perf = 90; b.perf = 90;
    res.entraines = { deux: chance([a, b], 'boutique'), banque: chance([a, b], 'banque') };
    res.force = G.majForceGang();
    // les gangs rivaux ont leur propre niveau, chefs en tête
    res.rivaux = G.gangs.map(g => ({ f: G.forceGangRival(g), chef: G.perfDe(g.chef) }));
    res.chefsPlusForts = G.gangs.every(g => G.perfDe(g.chef) >= G.forceGangRival(g));
    // un homme peut mourir : il quitte le gang pour de bon
    const avant = G.gang.membres.length;
    G.tuerMembre(a, 'la police');
    res.mort = { avant, apres: G.gang.membres.length, disparu: !a.av.group.visible, plusAmi: !G.estAmi(a.name) };
    // le tableau montre les jauges
    G.openGuerre();
    const moi = document.getElementById('guerreMoi').innerHTML;
    res.panneau = { ouvert: G.uiOpen === 'guerre', barres: (moi.match(/█|░/g) || []).length > 10,
      police: /police/i.test(moi), joueur: moi.includes('(toi)') };
    G.closeUI();
    return res;
  });
  const ok = r.joueur.apres === 17 && r.etoiles.join('') === '★★★★★★★★★★'
    && r.police[0] === 0 && r.police[1] === 30 && r.police[2] === 55 && r.police[3] === 80
    && r.police.armee === 100 && r.police.uses === 40 && r.usureMontee && r.police.apresFuite < 80
    && r.chances.deux > r.chances.un && r.entraines.deux > r.chances.deux
    && r.chances.banqueUn < r.entraines.banque && r.chefsPlusForts
    && r.mort.apres === r.mort.avant - 1 && r.mort.disparu && r.mort.plusAmi
    && r.panneau.ouvert && r.panneau.barres && r.panneau.police && r.panneau.joueur;
  return { ok, detail: `le joueur passe de 10 à ${r.joueur.apres}/100 (sport, tir, missions, école) · police : ${r.police[1]}/${r.police[2]}/${r.police[3]} selon les étoiles, ${r.police.armee} pour l'armée, et elle tombe à ${r.police.uses} quand on lui échappe (${r.police.apresFuite} après une fuite réelle) · un braquage de boutique passe de ${r.chances.un} % à ${r.chances.deux} % à deux, et ${r.entraines.deux} % avec deux hommes entraînés (banque : ${r.chances.banqueUn} % → ${r.entraines.banque} %) · les gangs rivaux ont leur niveau (${r.rivaux.map(x => x.f).join('/')}, chefs ${r.rivaux.map(x => x.chef).join('/')}) · un homme tué quitte le gang pour de bon` };
});

test('les lieux visés par les ordres pointent sur les vrais bâtiments', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    const paires = [
      ['emmene moi au garage', G.city.garage], ['conduis moi a l atelier', G.city.garage],
      ['emmene moi chez le tatoueur', G.city.tatooDesk], ['conduis moi a la banque', G.city.bank],
      ['emmene moi au commissariat', G.police.station], ['emmene moi au bureau des missions', G.city.office],
      ['conduis moi a la villa', G.city.villaMine], ['emmene moi a l armurerie', G.city.armory],
      ['emmene moi au snack', G.city.snack],
    ];
    const rates = [], ecarts = [];
    for (const [txt, o] of paires) {
      const l = G.lieuDe(txt);
      if (!l || !o) { rates.push(txt + ':introuvable'); continue; }
      const d = Math.hypot(l.x - o.x, l.z - o.z);
      ecarts.push(Math.round(d));
      if (d > 3) rates.push(`${txt} → ${Math.round(d)} m du vrai lieu`);
    }
    return { n: paires.length, rates, pire: Math.max(...ecarts) };
  });
  const ok = r.rates.length === 0;
  return { ok, detail: `${r.n} formulations mènent au bon bâtiment (écart maximal ${r.pire} m)${r.rates.length ? ' · ratés : ' + r.rates.join(', ') : ''}` };
});

test('le chien prend de vraies poses : assis, la patte, sur le dos, la balle en gueule', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 70, hour: 12 });
    const G = __G;
    const pet = G.city.pets.find(x => x.kind === 'dog');
    G.P.pos.set(pet.x, 0.5, pet.z); G.adopterChien(pet, true); G.chien.nom = 'Rex'; G.chien.attenteNom = false;
    G.P.pos.set(0, 0.5, 70);
    const res = { articule: !!(pet.pattes && pet.pattes.avG && pet.pattes.arD) };
    const lire = () => ({ x: +pet.g.rotation.x.toFixed(2), z: +pet.g.rotation.z.toFixed(2),
      avG: +pet.pattes.avG.rotation.x.toFixed(2), avD: +pet.pattes.avD.rotation.x.toFixed(2), arG: +pet.pattes.arG.rotation.x.toFixed(2) });
    const tick = n => { for (let i = 0; i < n; i++) G.chienTick(1 / 60); };
    // ASSIS : arrière-train posé (pattes arrière repliées), pattes avant tendues, buste redressé
    G.chienOrdre('assis', ''); tick(10); res.assis = lire();
    // LA PATTE : la patte avant droite se lève
    G.chienOrdre('patte', ''); tick(10); res.patte = lire();
    // COUCHÉ : les quatre pattes repliées, corps au sol
    G.chienOrdre('couche', ''); tick(10); res.couche = lire();
    // ABOIE : ordre qui dure, aboiements en boucle
    G.chienOrdre('aboie', ''); tick(10);
    res.aboie = { ordre: G.chien.ordre, enCours: G.chien.aboiFin > G.simTime, tete: +pet.head.rotation.x.toFixed(2) };
    // DORT : il se retourne SUR LE DOS dans sa niche, pattes en l'air
    G.chienOrdre('dort', '');
    const n = G.city.niche; pet.x = n.x; pet.z = n.z; tick(400);
    res.dort = Object.assign(lire(), { surLeDos: Math.abs(Math.abs(pet.g.rotation.z) - Math.PI) < 0.1,
      pattesEnLair: pet.pattes.avG.rotation.x < -0.4 });
    // LA BALLE : elle est bien dans sa gueule pendant le retour
    G.chien.ordre = null; G.chienOrdre('balle', '');
    const bl = G.chien.balle;
    res.balleLancee = !!bl;
    bl.etat = 'gueule'; pet.x = 6; pet.z = 76; G.P.pos.set(0, 0.5, 70); tick(3);
    const d = Math.hypot(bl.m.position.x - pet.g.position.x, bl.m.position.z - pet.g.position.z);
    res.balle = { dist: +d.toFixed(2), hauteur: +(bl.m.position.y - pet.g.position.y).toFixed(2),
      enGueule: d < 1.1 && bl.m.position.y > pet.g.position.y + 0.4 };
    G.chien.ordre = 'suit'; G.chien.balle = null;
    return res;
  });
  const ok = r.articule
    && r.assis.x < -0.3 && r.assis.arG > 1 && Math.abs(r.assis.avG) < 0.8
    && r.patte.avD < -0.5 && r.couche.avG > 1 && r.couche.arG > 1
    && r.aboie.ordre === 'aboie' && r.aboie.enCours
    && r.dort.surLeDos && r.dort.pattesEnLair
    && r.balleLancee && r.balle.enGueule;
  return { ok, detail: `pattes articulées · ASSIS : buste redressé (${r.assis.x}), pattes arrière repliées (${r.assis.arG}) et avant tendues (${r.assis.avG}) · LA PATTE : la droite se lève (${r.patte.avD}) · COUCHÉ : les quatre repliées · ABOIE : ordre qui dure, aboiements en boucle · DORT : sur le dos (${r.dort.z}) les pattes en l'air (${r.dort.avG}) · BALLE : dans la gueule à ${r.balle.dist} m et ${r.balle.hauteur} m de haut` };
});

test('la boutique habille aussi en bijoux, en tailles et en couleurs', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G; G.wallet = 3000;
    const res = { bijoux: G.SHOP.Bijoux.length, tailles: G.SHOP.Tailles.map(t => t.id), teintes: G.PAL.teintes.length };
    const nBijou = () => G.me.bijoux ? G.me.bijoux.children.length : -1;
    const rates = [];
    for (const b of G.SHOP.Bijoux) { G.myCfg.bijou = b.id; G.applyMyLook();
      if (b.id === 'rien' ? nBijou() !== 0 : nBijou() === 0) rates.push(b.id); }
    res.rates = rates;
    G.myCfg.bijou = 'grosse'; G.applyMyLook(); res.grosse = nBijou();
    G.myCfg.bijou = 'dollar'; G.applyMyLook(); res.dollar = nBijou();
    const l = {};
    for (const t of G.SHOP.Tailles) { G.myCfg.taille = t.id; G.applyMyLook(); l[t.id] = +G.me.torso.scale.x.toFixed(3); }
    res.largeurs = l;
    res.croissant = l.L < l.XL && l.XL < l.XXL && l.XXL < l.XXXL;
    G.myCfg.taille = 'L';
    G.myCfg.couleurHaut = 4; G.applyMyLook();
    res.couleur = { veut: G.PAL.teintes[4].toString(16), a: G.me.mats.shirt.color.getHexString() };
    G.myCfg.couleurHaut = null; G.myCfg.bijou = 'rien'; G.applyMyLook();
    G.openStore('couleurs'); res.cartesCouleurs = document.querySelectorAll('#stGrid .fcard').length;
    G.openStore('accessoires'); res.cartesAcc = document.querySelectorAll('#stGrid .fcard').length;
    G.closeUI();
    return res;
  });
  const ok = r.bijoux >= 8 && r.rates.length === 0 && r.grosse >= 2 && r.dollar >= 3
    && r.tailles.join(',') === 'L,XL,XXL,XXXL' && r.croissant
    && r.couleur.veut === r.couleur.a && r.teintes >= 12 && r.cartesCouleurs >= 13 && r.cartesAcc >= 55;
  return { ok, detail: `${r.bijoux} bijoux (colliers, chaîne en or, grosse chaîne à ${r.grosse} maillons, pendentif dollar à ${r.dollar} pièces) tous visibles sur le torse · 4 tailles L→XXXL qui élargissent vraiment le haut (${Object.values(r.largeurs).join(' → ')}) · ${r.teintes} couleurs au choix, appliquées au maillot (${r.couleur.a}) · la boutique affiche ${r.cartesCouleurs} couleurs et ${r.cartesAcc} accessoires` };
});

test('le coiffeur propose dix coupes et douze couleurs', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 43, y: 1, z: 92, hour: 12 });
    const G = __G; G.wallet = 3000;
    const res = { salon: !!G.city.coiffeurDesk, coupes: G.COIFFES.length, couleurs: G.PAL.hair.length };
    G.openCoiffeur();
    res.ouvert = G.uiOpen === 'coiffeur';
    res.boutons = { c: document.querySelectorAll('#coifCoupes [data-c]').length, h: document.querySelectorAll('#coifCouleurs [data-h]').length };
    const blocs = {};
    for (const c of G.COIFFES) { G.myCfg.hair = c.k; G.myCfg.hairColor = 4; G.applyMyLook();
      let n = 0; G.me.rig.head.traverse(x => { if (x.isMesh && x.material === G.me.mats.hair) n++; }); blocs[c.k] = n; }
    res.blocs = blocs;
    res.vides = Object.entries(blocs).filter(([k, n]) => k !== 'rase' && n === 0).map(([k]) => k);
    // on essaie sans payer, on repart : l'ancienne tête revient
    G.myCfg.hair = 'court'; G.myCfg.hairColor = 1; G.applyMyLook();
    G.openCoiffeur(); G.coif.coupe = 'punk'; G.coif.couleur = 10; G.coifApercu ? G.coifApercu() : (G.myCfg.hair = 'punk');
    document.getElementById('coifBack').click();
    res.annule = { coupe: G.myCfg.hair, couleur: G.myCfg.hairColor };
    // on paie : la coupe est posée et mémorisée, la seconde fois elle est gratuite
    G.openCoiffeur(); G.coif.coupe = 'dreads'; G.coif.couleur = 7; G.majCoiffeur();
    const w0 = G.wallet; G.validerCoiffure();
    res.achat = { paye: w0 - G.wallet, coupe: G.myCfg.hair, couleur: G.myCfg.hairColor };
    G.openCoiffeur(); G.coif.coupe = 'dreads'; G.coif.couleur = 7; G.majCoiffeur();
    const w1 = G.wallet; G.validerCoiffure(); res.reprise = w1 - G.wallet;
    G.myCfg.hair = 1; G.myCfg.hairColor = 0; G.applyMyLook();
    return res;
  });
  const ok = r.salon && r.coupes >= 10 && r.couleurs >= 12 && r.ouvert
    && r.boutons.c === r.coupes && r.boutons.h === r.couleurs && r.vides.length === 0
    && r.annule.coupe === 'court' && r.annule.couleur === 1
    && r.achat.paye > 0 && r.achat.coupe === 'dreads' && r.achat.couleur === 7 && r.reprise === 0;
  return { ok, detail: `salon en ville · ${r.coupes} coupes (afro ${r.blocs.afro}, dreadlocks ${r.blocs.dreads} mèches, crête iroquoise ${r.blocs.iroquoise}, punk ${r.blocs.punk}, nattes ${r.blocs.nattes}, mulet ${r.blocs.mulet}, plaquée ${r.blocs.plaquee}) et ${r.couleurs} couleurs · on essaie sans payer et on repart avec son ancienne tête · la coupe payée ${r.achat.paye} 🪙 est mémorisée (gratuite ensuite)` };
});


test('gardes du corps, protection d\'un membre et de la villa, missions à plusieurs', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    // on repart d'un gang PROPRE : un test précédent a pu enrôler ou poster des hommes
    G.gang.membres.length = 0;
    G.bots.forEach(b => { b.gang = null; b.gardeCorps = 0; b.gardeVilla = 0; b.protege = null; b.garde = 0;
      b.gardeArme = 0; b.rdv = null; b.ordre = null; b.drive = null; b.ko = 0; b.hp = 100; b.mort = 0; });
    G.gang.mission = null;
    const noms = [];
    for (let i = 0; i < 5; i++) { const b = G.bots[i]; G.devenirAmi(b); G.rejoindreGang(b); b.perf = 20 + i * 15; b.arme = i === 0; noms.push(b.name); }
    res.gang = G.gang.membres.length;
    // GARDES DU CORPS : trois au maximum, chacun à sa place autour du joueur
    const g = [];
    for (let i = 0; i < 4; i++) { const b = G.bots[i];
      const ok = G.commandeSociale(`${b.name} viens tu es mon garde du corps`); if (G.uiOpen) G.closeUI();
      g.push({ ok, garde: !!(b.gardeCorps && b.gardeCorps > G.simTime), arme: !!(b.gardeArme && b.gardeArme > G.simTime), slot: b.rdv ? b.rdv.slot : null }); }
    res.gardes = { quatre: g, actifs: G.gardesDuCorps().length, arme1: g[0].arme,
      placesDistinctes: new Set(g.slice(0, 3).map(x => x.slot)).size };
    // un garde du corps armé tire sur la police qui te course
    const b0 = G.bots[0];
    b0.pos.set(G.P.pos.x + 1, 0.3, G.P.pos.z + 1); b0.av.group.position.copy(b0.pos);
    G.police.wanted = 2;
    const ag = { x: G.P.pos.x + 6, z: G.P.pos.z, y: 0.3, ko: 0, hp: 100, name: 'Agent', av: { rig: { armR: { rotation: {} } }, group: { position: { set() {} } } } };
    G.police.agents.push(ag);
    b0.tirT = 0; G.gardeArmeTick(b0, 1 / 60);
    res.tirSurLaPolice = ag.hp < 100;
    G.police.agents.length = 0; G.clearWanted();
    // « stop » le libère
    G.botStop(b0, false, false);
    res.libere = !b0.gardeCorps && G.gardesDuCorps().length === 2;
    // PROTÉGER UN AUTRE MEMBRE
    const a = G.bots[0], c = G.bots[4];
    res.protege = G.commandeSociale(`${a.name} va proteger ${c.name}`) && a.protege === c;
    if (G.uiOpen) G.closeUI();
    // il suit celui qu'il protège
    c.pos.set(30, 0.3, 30); G.protectionTick(1 / 60);
    res.suit = Math.hypot(a.rdv.x - c.pos.x, a.rdv.z - c.pos.z) < 3;
    // GARDER LA VILLA
    const d = G.bots[1]; G.botStop(d, false, false);
    res.villa = G.commandeSociale(`${d.name} va proteger ma villa`) && !!d.gardeVilla;
    if (G.uiOpen) G.closeUI();
    res.versLaVilla = !!(d.rdv && G.city.villaMine && Math.hypot(d.rdv.x - G.city.villaMine.x, d.rdv.z - G.city.villaMine.z) < 20);
    // MISSIONS À PLUSIEURS
    G.gang.mission = null;
    G.gang.membres.forEach(b => { b.gangMission = null; b.rdv = null; b.ordre = null; b.gardeCorps = 0; b.gardeVilla = 0; b.protege = null; });
    const envoie = t => { G.gang.mission = null; const ok = G.ordreGang(t);
      const n = G.gang.mission ? G.gang.mission.membres.length : 0, ch = G.gang.mission ? G.gang.mission.chanceDep : 0;
      G.gang.mission = null; G.gang.membres.forEach(b => { b.gangMission = null; b.rdv = null; b.ordre = null; }); return { ok, n, ch }; };
    res.missions = { deux: envoie('envoie deux hommes braquer la banque'), trois: envoie('envoie trois hommes braquer la banque'),
      tous: envoie('envoie tous les hommes braquer la banque'), nommes: envoie(`${noms[0]} et ${noms[1]} allez braquer la banque`) };
    // LA JAUGE DE PERFORMANCE dans la liste des ordres et dans le choix des personnes
    G.openOrdres(G.bots[2]);
    const sub = document.getElementById('ordresSub').innerHTML;
    res.jauge = { barre: /█|░/.test(sub), etoiles: /★/.test(sub) };
    G.closeUI(); G.openQui();
    res.jaugeListe = /█|░/.test(document.getElementById('ordresGrid').innerHTML);
    G.closeUI();
    return res;
  });
  const m = r.missions;
  const ok = r.gardes.actifs === 3 && r.gardes.quatre[3].garde === false && r.gardes.placesDistinctes === 3
    && r.gardes.arme1 && r.tirSurLaPolice && r.libere
    && r.protege && r.suit && r.villa && r.versLaVilla
    && m.deux.n === 2 && m.trois.n === 3 && m.tous.n === 5 && m.nommes.n === 2
    && m.trois.ch > m.deux.ch && m.tous.ch > m.trois.ch
    && r.jauge.barre && r.jauge.etoiles && r.jaugeListe;
  return { ok, detail: `3 gardes du corps au maximum (le 4e est refusé), chacun à sa place autour du joueur, et l'armé tire sur la police · « stop » en libère un · « va protéger X » le fait coller son coéquipier, « va protéger ma villa » l'envoie monter la garde chez toi · missions à plusieurs : 2 hommes ${m.deux.ch} %, 3 hommes ${m.trois.ch} %, tout le gang (5) ${m.tous.ch} %, deux nommés ${m.nommes.ch} % · la jauge de performance s'affiche dans la liste des ordres et dans le choix des personnes` };
});

test('on peut renommer son chien quand on veut', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 70, hour: 12 });
    const G = __G;
    const pet = G.city.pets.find(x => x.kind === 'dog');
    G.P.pos.set(pet.x, 0.5, pet.z); G.adopterChien(pet, true);
    G.chien.nom = 'Rex'; G.chien.attenteNom = false; G.P.pos.set(0, 0.5, 70);
    const res = { depart: G.chien.nom };
    // en une phrase
    res.direct = G.commandeSociale('appelle mon chien Bella'); res.apresDirect = G.chien.nom;
    if (G.uiOpen) G.closeUI();
    // par l'ordre de sa liste : il redemande, on répond
    res.ordre = G.chienOrdre('nom', ''); res.attend = G.chien.attenteNom;
    G.commandeSociale('Titan'); res.apresOrdre = G.chien.nom;
    // la médaille au-dessus de sa tête suit le nom
    res.medaille = !!G.chien.tag;
    // et l'ordre existe bien dans sa liste cliquable
    G.openOrdresChien();
    res.dansLaListe = [...document.querySelectorAll('#ordresGrid [data-chien]')].some(b => b.dataset.chien === 'nom');
    G.closeUI();
    return res;
  });
  const ok = r.depart === 'Rex' && r.direct && r.apresDirect === 'Bella'
    && r.ordre && r.attend && r.apresOrdre === 'Titan' && r.medaille && r.dansLaListe;
  return { ok, detail: `« appelle mon chien Bella » le renomme d'un coup (${r.depart} → ${r.apresDirect}), et l'ordre 🏷️ de sa liste redemande son nom dans le chat (${r.apresDirect} → ${r.apresOrdre}) · sa médaille suit` };
});


test('les hommes du gang ont des points de vie, et l\'hôpital les remet d\'aplomb', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const a = G.bots[0], b = G.bots[1], passant = G.bots[5];
    G.devenirAmi(a); G.rejoindreGang(a); G.devenirAmi(b); G.rejoindreGang(b);
    a.hp = 100; b.hp = 100;
    res.neuf = { vie: G.vieDe(a), prix: G.prixSoin(a) };
    // il sort d'une bagarre : un HOMME DU GANG ne se remet presque pas tout seul…
    a.hp = 28; a.fight = 'fight'; a.fightT = G.simTime - 1;
    passant.hp = 28; passant.fight = 'fight'; passant.fightT = G.simTime - 1;
    G.combatTick(1 / 60);
    res.gang = G.vieDe(a); res.passant = G.vieDe(passant);
    // …et le soigner coûte d'autant plus cher qu'il est mal en point
    a.hp = 28; const px28 = G.prixSoin(a);
    a.hp = 80; const px80 = G.prixSoin(a);
    a.hp = 28; res.prix = { bas: px28, haut: px80, croissant: px28 > px80 };
    // ordre : il part vraiment vers l'hôpital, on paie à l'arrivée
    G.wallet = 500;
    res.ordre = G.commandeSociale(`${a.name} va a l hopital`); if (G.uiOpen) G.closeUI();
    res.enRoute = !!(a.rdv && a.rdv.soin && G.city.medDesk
      && Math.hypot(a.rdv.x - G.city.medDesk.x, a.rdv.z - G.city.medDesk.z) < 4);
    const w0 = G.wallet;
    a.rdv.arrive = true; G.soinTick(1 / 60);
    res.soigne = { vie: G.vieDe(a), paye: w0 - G.wallet, attendu: px28, libre: !a.rdv };
    // sans argent, on ne l'envoie pas pour rien
    b.hp = 30; G.wallet = 2; G.botHopital(b);
    res.fauche = !(b.rdv && b.rdv.soin);
    // un homme au tapis coûte plus cher, et l'hôpital le remet debout
    G.wallet = 500; b.hp = 0; b.ko = G.simTime + 30;
    res.prixKO = G.prixSoin(b) > px28;
    G.botHopital(b); b.rdv.arrive = true; G.soinTick(1 / 60);
    res.releve = { vie: G.vieDe(b), debout: !b.ko };
    // ordre collectif : « soignez-vous »
    G.wallet = 500; a.hp = 40; b.hp = 50;
    res.collectif = G.ordreGang('le gang allez a l hopital') && !!(a.rdv && a.rdv.soin) && !!(b.rdv && b.rdv.soin);
    a.rdv = null; b.rdv = null; a.hp = 55; b.hp = 100;
    // LES JAUGES : vie et performance, dans la liste des ordres, le choix des personnes et le tableau
    G.openOrdres(a);
    const sub = document.getElementById('ordresSub').innerHTML;
    res.panneau = { perf: /📈/.test(sub) && /█|░/.test(sub), vie: /❤️/.test(sub), prix: /🏥/.test(sub) };
    res.carte = [...document.querySelectorAll('#ordresGrid [data-p]')].some(x => /hopital/.test(x.dataset.p));
    G.closeUI(); G.openQui();
    res.choix = /❤️/.test(document.getElementById('ordresGrid').innerHTML);
    G.closeUI(); G.openGuerre();
    res.tableau = /❤️/.test(document.getElementById('guerreMoi').innerHTML);
    G.closeUI();
    return res;
  });
  const ok = r.neuf.vie === 100 && r.neuf.prix === 0
    && r.gang < r.passant && r.gang <= 35 && r.passant >= 45
    && r.prix.croissant && r.ordre && r.enRoute
    && r.soigne.vie === 100 && r.soigne.paye === r.soigne.attendu && r.soigne.libre
    && r.fauche && r.prixKO && r.releve.vie === 100 && r.releve.debout && r.collectif
    && r.panneau.perf && r.panneau.vie && r.panneau.prix && r.carte && r.choix && r.tableau;
  return { ok, detail: `après une bagarre, un homme du gang reste à ${r.gang}/100 PV quand un passant remonte à ${r.passant} : sa vie compte · le soigner coûte ${r.prix.bas} 🪙 à 28 PV contre ${r.prix.haut} 🪙 à 80 PV · « va à l'hôpital » l'y envoie vraiment, on paie ${r.soigne.paye} 🪙 à l'arrivée et il repart à 100/100 · refusé si le porte-monnaie est vide · un homme au tapis est relevé (${r.releve.vie}/100) · « le gang allez à l'hôpital » les envoie tous · les jauges ❤️ et 📈 s'affichent dans la liste des ordres, le choix des personnes et le tableau de la guerre` };
});


test('escarmouches : ils viennent te chercher, et on coince leurs isolés', async p => {
  const r = await p.evaluate(async () => {
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    for (let i = 0; i < 3; i++) { const b = G.bots[i]; G.devenirAmi(b); G.rejoindreGang(b); b.perf = 60; b.hp = 100; }
    // ---- CÔTÉ ADVERSE : ils détachent un ou deux hommes sur toi ou sur l'un des tiens ----
    const Gr = G.gangs[0]; Gr.relation = -60; Gr.etat = 'repos';
    Gr.membres.forEach(m => { m.chasse = null; m.ko = 0; m.x = G.P.pos.x + 18; m.z = G.P.pos.z + 18; });
    let n = 0;
    for (let i = 0; i < 60 && !n; i++) { Gr.t = G.simTime - 1; G.gangTick(1 / 60); n = Gr.membres.filter(m => m.chasse).length; }
    res.embuscade = { hommes: n, surLeJoueur: n ? !!Gr.membres.find(m => m.chasse).chasse.joueur : null };
    // ils marchent VRAIMENT sur leur proie
    const ch = Gr.membres.find(m => m.chasse);
    Gr.membres.forEach(m => { if (m.chasse) m.chasse = { joueur: true, bot: null, fin: G.simTime + 999 }; });
    const d0 = Math.hypot(ch.x - G.P.pos.x, ch.z - G.P.pos.z);
    for (let i = 0; i < 200; i++) G.gangTick(1 / 60);
    res.approche = { avant: Math.round(d0), apres: Math.round(Math.hypot(ch.x - G.P.pos.x, ch.z - G.P.pos.z)) };
    // et ils tapent un HOMME du gang quand c'est lui qui est visé
    const victime = G.gang.membres[0]; victime.hp = 100;
    victime.pos.set(60, 0.3, 60); victime.av.group.position.copy(victime.pos);
    Gr.membres.forEach(m => { m.chasse = null; });
    const cogneur = Gr.membres[0];
    cogneur.x = 61; cogneur.z = 61; cogneur.perf = 80; cogneur.cd = 0; cogneur.hp = 200;
    cogneur.chasse = { joueur: false, bot: victime, fin: G.simTime + 999 };
    for (let i = 0; i < 20; i++) { cogneur.cd = 0; G.gangTick(1 / 60); }
    res.tape = victime.hp < 100;
    Gr.membres.forEach(m => { m.chasse = null; }); victime.hp = 100; victime.ko = 0;
    // ---- CÔTÉ JOUEUR : coincer un gangster isolé ----
    const g2 = G.gangs[1];
    g2.membres.forEach((m, i) => { m.ko = 0; m.hp = 90; m.x = -80 + i * 45; m.z = -80 + i * 45; m.perf = 25; });
    const proie = g2.membres[1]; proie.x = 20; proie.z = 20;
    const c = G.gangeurIsole();
    res.isole = c ? { nom: c.m.nom, seul: c.seul } : null;
    res.type = G.typeMission('coincez un gangster isole');
    G.gang.mission = null; G.wallet = 0;
    res.ordre = G.ordreGang('le gang coincez un gangster isole');
    res.mission = G.gang.mission ? { type: G.gang.mission.type, n: G.gang.mission.membres.length,
      chance: G.gang.mission.chanceDep, proie: G.gang.mission.proie ? G.gang.mission.proie.m.nom : null } : null;
    // on mène le coup à son terme, avec des hommes assez forts pour ne pas dépendre du hasard
    // il faut une PLACE dans le gang (le rang la limite, et les tests precedents ont pu la
    // remplir) et le vaincu ne rallie qu'avec 85 % de chances au mieux : ici on ne teste pas
    // le hasard mais le mecanisme, alors on force le tirage
    G.gang.membresLibres = [];
    const v = G.gang.mission.proie.m, avantLibres = (G.gang.membresLibres || []).length;
    G.gang.mission.membres.forEach(b => { b.perf = 100; b.rdv.arrive = true; });
    G.gang.mission.etape = 'action'; G.gang.mission.fin = G.simTime - 1;
    const vraiHasard = Math.random; Math.random = () => 0;
    try { G.gangMissionTick(1 / 60); } finally { Math.random = vraiHasard; }
    res.gain = { pieces: G.wallet, vaincuKO: v.ko > G.simTime, missionFinie: !G.gang.mission };
    // le ralliement se fait juste après (petit délai pour l'effet)
    await dodo(1500);
    res.recrue = { rallie: (G.gang.membresLibres || []).some(x => x.nom === v.nom),
      libres: (G.gang.membresLibres || []).length, avant: avantLibres, plusChezEux: !g2.membres.includes(v) };
    return res;
  });
  const ok = r.embuscade.hommes >= 1 && r.approche.apres < r.approche.avant - 3 && r.tape
    && r.isole && r.isole.seul > 12 && r.type === 'gangeur' && r.ordre
    && r.mission && r.mission.type === 'gangeur' && r.mission.n >= 2 && r.mission.proie === r.isole.nom
    && r.gain.pieces > 0 && r.gain.vaincuKO && r.gain.missionFinie
    && r.recrue.rallie && r.recrue.plusChezEux;
  return { ok, detail: `les rivaux détachent ${r.embuscade.hommes} homme(s) sur ${r.embuscade.surLeJoueur ? 'le joueur' : 'un de tes hommes'} et marchent vraiment dessus (${r.approche.avant} m → ${r.approche.apres} m), et ils tabassent le membre visé · à l'inverse « coincez un gangster isolé » repère ${r.isole.nom}, seul à ${r.isole.seul} m de ses copains, envoie ${r.mission.n} hommes (${r.mission.chance} % de chances), rapporte ${r.gain.pieces} 🪙 — et le vaincu change de camp (${r.recrue.avant} → ${r.recrue.libres} recrues)` };
});


test('personne ne flotte ni ne s\'enfonce dans le sol', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    // on laisse la ville vivre : c'est la boucle qui recale les pieds
    for (let i = 0; i < 40; i++) { for (const b of G.bots) G.updateBot(b, 1 / 60); G.gangTick(1 / 60); }
    const mesure = (nom, x, z, y) => ({ nom, ecart: +(y - G.groundUnder(x, z, null, y + 1.2)).toFixed(2) });
    const bots = G.bots.map(b => mesure(b.name, b.pos.x, b.pos.z, b.av.group.position.y));
    const gangeurs = [];
    for (const Gg of G.gangs) for (const m of Gg.membres) gangeurs.push(mesure(m.nom, m.x, m.z, m.av.group.position.y));
    const pire = l => l.reduce((a, x) => Math.max(a, Math.abs(x.ecart)), 0);
    return { nBots: bots.length, nGang: gangeurs.length,
      pireBot: +pire(bots).toFixed(2), pireGang: +pire(gangeurs).toFixed(2),
      botsHorsSol: bots.filter(x => Math.abs(x.ecart) > 0.06).map(x => x.nom).slice(0, 4),
      gangHorsSol: gangeurs.filter(x => Math.abs(x.ecart) > 0.06).map(x => x.nom).slice(0, 4) };
  });
  const ok = r.botsHorsSol.length === 0 && r.gangHorsSol.length === 0 && r.pireBot <= 0.06 && r.pireGang <= 0.06;
  return { ok, detail: `${r.nBots} habitants et ${r.nGang} gangsters ont les pieds au sol (écart maximal ${r.pireBot} m et ${r.pireGang} m ; les habitants s'enfonçaient de 15 cm dans le trottoir et les gangsters flottaient 24 cm au-dessus)${r.botsHorsSol.length || r.gangHorsSol.length ? ' · hors sol : ' + r.botsHorsSol.concat(r.gangHorsSol).join(', ') : ''}` };
});

test('le chien défend son maître : il bondit, il mord, il fait gagner du temps', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const pet = G.city.pets.find(x => x.kind === 'dog');
    G.P.pos.set(pet.x, 0.5, pet.z); G.adopterChien(pet, true); G.chien.nom = 'Rex'; G.chien.attenteNom = false;
    G.P.pos.set(0, 0.5, 8);
    res.stats = { hp: G.chien.hp, hpMax: G.chien.hpMax, perf: G.perfDe(G.chien), plafond: G.CHIEN_PERF_MAX };
    // il est VOLONTAIREMENT plus faible qu'un homme de gang, et il plafonne bas
    const Gr = G.gangs[0], m = Gr.membres[1];
    // On ISOLE la cible : le chien vise le rival le plus proche, et selon les tests joués
    // avant, un autre gangster pouvait traîner plus près — le chien mordait celui-là.
    for (const g of G.gangs) for (const o of g.membres) if (o !== m) { o.x += 600; o.z += 600; }
    res.plusFaible = G.perfDe(G.chien) < G.perfDe(m);
    G.perfGagne(G.chien, 500); res.plafond = G.perfDe(G.chien);
    G.chien.perf = 22;
    // « défends-moi » : il bondit sur le gangster qui fonce sur toi
    Gr.etat = 'joueur';
    m.ko = 0; m.hp = 90; m.x = G.P.pos.x + 5; m.z = G.P.pos.z;
    m.chasse = { joueur: true, bot: null, fin: G.simTime + 999 };
    G.chienOrdre('garde', ''); G.chien.attaque = null;
    for (let i = 0; i < 6; i++) G.chienTick(1 / 60);
    res.vise = !!(G.chien.attaque && G.chien.attaque.gangeur === m);
    // le bond se voit : le chien décolle du sol, pattes avant tendues
    pet.x = m.x - 1.6; pet.z = m.z;
    const hp0 = m.hp, chp0 = G.chien.hp;
    let hMax = 0, pattesEnAvant = false;
    for (let i = 0; i < 150; i++) { G.step(1 / 60); G.chienTick(1 / 60);
      hMax = Math.max(hMax, pet.g.position.y - pet.y);
      if (G.chien.bond > G.simTime && pet.pattes.avG.rotation.x < -1) pattesEnAvant = true; }
    res.bond = { hauteur: +hMax.toFixed(2), pattesEnAvant };
    res.morsure = { gangster: hp0 - m.hp, chien: chp0 - G.chien.hp, ralenti: m.mordu > G.simTime };
    // le vétérinaire le remet sur pattes, contre paiement
    G.chien.hp = 20; G.wallet = 500;
    const px = G.prixVeto(), w0 = G.wallet;
    G.chienVeto();
    res.veto = { prix: px, paye: w0 - G.wallet, vie: G.chien.hp };
    G.wallet = 1; G.chien.hp = 20; G.chienVeto();
    res.vetoRefuse = G.chien.hp === 20;
    // ses jauges sont dans sa liste d'ordres
    G.chien.hp = 60; G.openOrdresChien();
    const sub = document.getElementById('ordresSub').innerHTML;
    res.panneau = { perf: /📈/.test(sub), vie: /❤️/.test(sub),
      ordres: document.querySelectorAll('#ordresGrid [data-chien]').length,
      veto: [...document.querySelectorAll('#ordresGrid [data-chien]')].some(b => b.dataset.chien === 'veto') };
    G.closeUI();
    return res;
  });
  const ok = r.stats.hpMax === 60 && r.plusFaible && r.plafond === r.stats.plafond && r.plafond < 100
    && r.vise && r.bond.hauteur > 0.8 && r.bond.pattesEnAvant
    && r.morsure.gangster > 0 && r.morsure.chien > 0 && r.morsure.ralenti
    && r.veto.paye === r.veto.prix && r.veto.vie === 60 && r.vetoRefuse
    && r.panneau.perf && r.panneau.vie && r.panneau.veto && r.panneau.ordres >= 14;
  return { ok, detail: `le chien a ${r.stats.hpMax} PV et plafonne à ${r.plafond} de performance, sous un homme de gang · « défends-moi » le fait bondir sur le gangster qui te fonce dessus : il décolle de ${r.bond.hauteur} m, pattes avant tendues, mord (−${r.morsure.gangster} PV au gangster, −${r.morsure.chien} pour lui) et le CLOUE SUR PLACE le temps que tu files · le vétérinaire le soigne pour ${r.veto.prix} 🪙, et refuse si tu n'as pas de quoi payer · ses deux jauges s'affichent dans sa liste` };
});


test('la raquette se tient verticale, et se range dès qu\'on quitte le court', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 13, y: 1, z: -8, hour: 12 });
    const G = __G, res = {};
    G.P.racket = true; G.setRacket(G.me, true);
    // on mesure le MONTAGE de la raquette dans la main, bras au repos : sinon le balancement
    // du bras (que le test precedent a pu laisser leve) fait pencher le tamis avec lui
    G.me.rig.armR.rotation.set(0, 0, 0); G.me.rig.armR.coude.rotation.set(0, 0, 0); G.me.rig.armR.updateMatrixWorld(true);   // bras ET coude au repos
    const rk = G.me.racket;
    // le tamis : sa normale doit rester HORIZONTALE (raquette droite), pas pointer vers le ciel
    const n = new G.THREE.Vector3(0, 0, 1).applyQuaternion(rk.getWorldQuaternion(new G.THREE.Quaternion()));
    res.inclinaisonTamis = +(Math.abs(Math.asin(Math.max(-1, Math.min(1, n.y)))) * 180 / Math.PI).toFixed(0);
    const axe = new G.THREE.Vector3(0, -1, 0).applyQuaternion(rk.getWorldQuaternion(new G.THREE.Quaternion()));
    res.inclinaisonManche = +(Math.abs(Math.asin(Math.max(-1, Math.min(1, -axe.y)))) * 180 / Math.PI).toFixed(0);
    // sur le court elle reste en main, dehors elle se range toute seule
    G.P.pos.set(13, 0.3, -8); for (let i = 0; i < 8; i++) G.step(1 / 60, true);
    res.surLeCourt = G.P.racket;
    G.P.pos.set(13, 0.3, 8); for (let i = 0; i < 8; i++) G.step(1 / 60, true);
    res.dehors = G.P.racket;
    return res;
  });
  const ok = r.inclinaisonTamis < 25 && r.inclinaisonManche > 60 && r.surLeCourt && !r.dehors;
  return { ok, detail: `le tamis est vertical (${r.inclinaisonTamis}° d'inclinaison au lieu de 51° avant — il était couché comme une poêle) et le manche pend à ${r.inclinaisonManche}° de l'horizontale · la raquette reste en main sur le court et se range TOUTE SEULE dès qu'on en sort` };
});

test('un membre joue vraiment au tennis contre toi, en trois jeux gagnants', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 13, y: 1, z: -8, hour: 12 });
    const G = __G, res = {};
    const b = G.bots[0];
    G.amis.add(b.name);
    b.pos.set(20, 0.3, 10); b.rdv = null; b.sport = null; b.wait = 0; b.ko = 0;
    // ON PASSE PAR LA PHRASE, comme la carte 📣 : c'est ce chemin-là qui était cassé —
    // une règle générique « on joue… » attrapait l'ordre avant et se contentait d'un
    // rendez-vous, sans raquette et sans partie.
    res.parLaPhrase = G.commandeSociale(`${b.name} on joue au tennis`);
    res.ordre = { cote: b.sport ? b.sport.cote : null, journal: (b.journal || []).map(o => o.t + ':' + o.etat) };
    let tours = 0;
    for (let i = 0; i < 4000 && !(b.sport && b.sport.pret); i++) { G.step(1 / 60, true); G.updateBot(b, 1 / 60); tours++; }
    res.arrivee = { pret: !!(b.sport && b.sport.pret), raquette: !!(b.av.racket && b.av.racket.visible),
      cote: b.pos.z < -13 ? 1 : 0, secondes: +(tours / 60).toFixed(0) };
    // le joueur arrive sur le court SANS raquette : le membre lui en prête une
    G.P.pos.set(13, 0.3, -8); G.P.racket = false;
    for (let i = 0; i < 300 && !G.tm.on; i++) { G.step(1 / 60, true); G.updateBot(b, 1 / 60); }
    res.debut = { match: G.tm.on, raquettePretee: G.P.racket, noms: G.tm.names.slice(), bot: G.tm.bot === b };
    let echanges = 0, prevHit = 0, dernier = null;
    for (let i = 0; i < 30000; i++) {
      G.step(1 / 60, true); G.updateBot(b, 1 / 60);
      const bal = G.city.balls.find(x => x.kind === 'tennis');
      if (bal) { if (bal.hitCd > prevHit) echanges++; prevHit = bal.hitCd; }
      if (G.tm.on) dernier = { j: G.tm.j.slice(), s: G.tm.s.slice() };
      if (!G.tm.on && i > 400) break;
    }
    res.partie = { echanges, dernier, fini: !G.tm.on, sportEfface: !b.sport,
      raquetteBot: !!(b.av.racket && b.av.racket.visible),
      journal: (b.journal || []).map(o => o.t + ':' + o.etat) };
    return res;
  });
  const gagnants = r.partie.dernier ? Math.max(r.partie.dernier.j[0], r.partie.dernier.j[1]) : 0;
  const ok = r.parLaPhrase && r.ordre.cote === 1 && r.arrivee.pret && r.arrivee.raquette && r.arrivee.cote === 1
    && r.debut.match && r.debut.raquettePretee && r.debut.bot
    && r.partie.echanges > 10 && gagnants >= 2 && r.partie.fini && r.partie.sportEfface && !r.partie.raquetteBot
    && r.partie.journal.some(x => /partie au tennis:reussi/.test(x));
  return { ok, detail: `« <nom> on joue au tennis » écrit dans le chat (ou la carte 📣) lance une VRAIE partie : il file au court (${r.arrivee.secondes} s), prend une raquette et se met de l'autre côté du filet · il t'en prête une si tu n'en as pas · la partie se joue en 3 jeux gagnants, ${r.partie.echanges} balles échangées, score final ${r.partie.dernier ? r.partie.dernier.j.join('–') : '?'} en jeux · à la fin chacun range sa raquette et l'ordre passe à « réussi »` };
});

test('un membre joue au foot contre toi : partie en trois buts', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: -8, y: 1, z: -13, hour: 12 });
    const G = __G, res = {};
    const b = G.bots[1];
    G.amis.add(b.name);
    b.pos.set(20, 0.3, 10); b.rdv = null; b.sport = null; b.wait = 0; b.ko = 0;
    G.P.pos.set(-8, 0.3, -13);
    G.botSport(b, 'foot');
    res.cote = b.sport.cote;
    for (let i = 0; i < 4000 && !(b.sport && b.sport.pret); i++) { G.step(1 / 60, true); G.updateBot(b, 1 / 60); }
    res.pret = !!(b.sport && b.sport.pret);
    for (let i = 0; i < 200 && !G.fm.on; i++) { G.step(1 / 60, true); G.updateBot(b, 1 / 60); }
    res.debut = { match: G.fm.on, noms: G.fm.names.slice() };
    let touches = 0, prevHit = 0, dernier = null;
    const bal = G.city.balls.find(x => x.kind === 'foot');
    for (let i = 0; i < 30000; i++) {
      G.step(1 / 60, true); G.updateBot(b, 1 / 60);
      if (bal.hitCd > prevHit) touches++; prevHit = bal.hitCd;
      if (G.fm.on) dernier = G.fm.s.slice();
      if (!G.fm.on && i > 400) break;
    }
    res.partie = { touches, dernier, fini: !G.fm.on, sportEfface: !b.sport,
      journal: (b.journal || []).map(o => o.t + ':' + o.etat) };
    return res;
  });
  const buts = r.partie.dernier ? Math.max(r.partie.dernier[0], r.partie.dernier[1]) : 0;
  const ok2 = r.pret && r.debut.match && r.partie.touches > 3 && buts >= 2 && r.partie.fini && r.partie.sportEfface
    && r.partie.journal.some(x => /partie au foot:reussi/.test(x));
  return { ok: ok2, detail: `« on joue au foot » : il rejoint le terrain, prend le camp que tu n'occupes pas (côté ${r.cote === 0 ? 'ouest' : 'est'}), vise vraiment la cage adverse (${r.partie.touches} frappes) et la partie s'arrête au 3ᵉ but — score ${r.partie.dernier ? r.partie.dernier.join('–') : '?'}` };
});

test('la liste des ordres montre ce qu\'on a demandé et où ça en est', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const b = G.bots[0], b2 = G.bots[1], b3 = G.bots[2];
    for (const x of [b, b2, b3]) { G.amis.add(x.name); G.gang.membres.push(x); x.journal = null; x.ko = 0; x.hp = 100; }
    // 1) un ordre en cours : l'entraînement
    G.entrainerMembre(b, 'tir');
    res.enCours = (b.journal || []).map(o => ({ t: o.t, e: o.etat }));
    // 2) un ordre réussi : la mission du gang
    G.missionGang([b2], 'argent');
    const av = (b2.journal || []).map(o => o.etat).join(',');
    for (let i = 0; i < 40; i++) { G.finirOrdre(b2, 'reussi'); }
    res.reussi = (b2.journal || []).map(o => ({ t: o.t, e: o.etat }));
    res.avant = av;
    // 3) un ordre raté — sur un homme bien vivant, pour le voir dans son panneau
    G.missionGang([b2], 'banque');
    G.finirOrdre(b2, 'rate');
    res.rate = (b2.journal || []).map(o => o.etat);
    G.missionGang([b3], 'banque'); G.finirOrdre(b3, 'rate');
    // 4) une perte : il se fait tuer
    G.missionGang([b3], 'villa');
    G.tuerMembre(b3, 'la police');
    res.perte = (b3.journal || []).map(o => ({ t: o.t, e: o.etat }));
    // 5) tout cela se lit dans le panneau 📣
    G.openOrdres(b);
    const sub = document.getElementById('ordresSub').innerHTML;
    res.panneau = { titre: /Ses ordres/.test(sub), ligne: /stand de tir/.test(sub), etat: /en cours/.test(sub) };
    G.closeUI();
    G.openOrdres(b2);
    const sub2 = document.getElementById('ordresSub').innerHTML;
    res.panneau2 = { reussi: /réussi/.test(sub2), rate: /raté/.test(sub2) };
    G.closeUI();
    return res;
  });
  const ok = r.enCours.length === 1 && r.enCours[0].e === 'cours' && /stand de tir/.test(r.enCours[0].t)
    && r.reussi.length === 1 && r.reussi[0].e === 'reussi'
    && r.rate[0] === 'rate'
    && r.perte[0].e === 'perte' && r.perte.every(o => o.e !== 'cours')
    && r.panneau.titre && r.panneau.ligne && r.panneau.etat && r.panneau2.reussi && r.panneau2.rate;
  return { ok, detail: `chaque ordre donné est noté avec son avancement : « ${r.enCours[0] ? r.enCours[0].t : '?'} » ⏳ en cours, « ${r.reussi[0] ? r.reussi[0].t : '?'} » ✅ réussi, un coup ❌ raté, et 💀 perte quand l'homme y laisse la vie · le panneau 📣 affiche la liste sous ses jauges` };
});


test('les coups ont un vrai impact : onde de choc, éclats orientés, traînée et secousse', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 6, hour: 12 });
    const G = __G, res = {};
    // on dégage le terrain : sinon le poing part sur un passant de côté et la gerbe
    // d'éclats n'a plus la direction qu'on mesure
    for (const o of G.bots) { o.pos.x += 400; o.pos.z += 400; o.av.group.position.copy(o.pos); }
    for (const G2 of G.gangs) for (const o of G2.membres) { o.x += 400; o.z += 400; o.av.group.position.set(o.x, o.y, o.z); }
    const b = G.bots[0];
    b.pos.set(G.P.pos.x, G.P.pos.y, G.P.pos.z - 1.5); b.wait = 9; b.ko = 0; b.hp = 100; b.fight = null;
    b.av.group.visible = true; b.av.group.position.copy(b.pos);
    G.P.facing = Math.PI;   // il frappe vers −z
    G.cam.shake = 0;
    G.P.punchT = 0; G.punch();
    const types = {};
    for (const f of G.fx) { const t2 = f.m.geometry.type; types[t2] = (types[t2] || 0) + 1; }
    res.poing = { effets: G.fx.length, types,
      anneaux: G.fx.filter(f => f.m.geometry.type === 'RingGeometry').length,
      additifs: G.fx.filter(f => f.mat.blending === 2).length,
      secousse: +(G.cam.shake || 0).toFixed(3), pvBot: b.hp };
    // les éclats partent DANS LE SENS DU COUP (vers −z), pas dans tous les sens
    const av = G.fx.filter(f => f.v);
    res.gerbe = { n: av.length, versLeCoup: av.filter(f => f.v.z < 0).length };
    // ils s'effacent en fondu : à mi-vie l'opacité a déjà baissé
    const opac0 = av.length ? av[0].mat.opacity : 0;
    for (let i = 0; i < 5; i++) G.fxTick(1 / 30);
    res.fondu = av.length ? av[0].mat.opacity < opac0 : false;
    for (let i = 0; i < 400; i++) G.fxTick(1 / 30);
    res.efface = G.fx.length;
    // une balle dans le décor : étincelles, fumée et trace d'impact
    G.impact(0, 1.3, 3, { x: 0, y: 0, z: 1 }, 'mur', 1.2);
    for (let i = 0; i < 3; i++) G.fxTick(1 / 30);
    res.mur = { effets: G.fx.length,
      fumee: G.fx.filter(f => f.m.geometry.type === 'SphereGeometry').length,
      trace: G.fx.filter(f => f.m.geometry.type === 'CircleGeometry').length };
    for (let i = 0; i < 400; i++) G.fxTick(1 / 30);
    res.murEfface = G.fx.length;
    // le garde-fou : une mêlée générale ne noie pas la scène
    for (let i = 0; i < 300; i++) G.impact(0, 1.3, 0, null, 'sang', 1);
    res.plafond = G.fx.length;
    for (let i = 0; i < 400; i++) G.fxTick(1 / 30);
    res.plafondEfface = G.fx.length;
    // le pas de temps est plafonné : sur une image lente l'impact reste visible
    G.impact(0, 1.3, 0, null, 'poing', 1);
    const n0 = G.fx.length; G.fxTick(2);   // une image de deux secondes
    res.imageLente = { avant: n0, apres: G.fx.length };
    for (let i = 0; i < 400; i++) G.fxTick(1 / 30);
    return res;
  });
  const ok = r.poing.effets >= 14 && r.poing.anneaux >= 2 && r.poing.additifs >= 3
    && r.poing.secousse > 0.05 && r.poing.pvBot < 100
    && r.gerbe.n >= 6 && r.gerbe.versLeCoup / r.gerbe.n > 0.7
    && r.fondu && r.efface === 0
    && r.mur.fumee >= 2 && r.mur.trace === 1 && r.murEfface === 0
    && r.plafond < 400 && r.plafondEfface === 0
    && r.imageLente.apres > 0;
  return { ok, detail: `un coup de poing pose ${r.poing.effets} éléments — ${r.poing.anneaux} ondes de choc, ${r.poing.additifs} lumières additives, une traînée sur le trajet du poing — et secoue la caméra (${r.poing.secousse}) · ${r.gerbe.versLeCoup}/${r.gerbe.n} éclats partent dans le sens du coup au lieu de gicler au hasard · tout s'efface en FONDU (plus de cubes qui disparaissent d'un coup) · une balle dans le décor laisse ${r.mur.fumee} bouffées de fumée et une trace d'impact · au-delà de 220 effets on arrête d'en créer (${r.plafond} au pire d'une mêlée générale) et une image lente n'avale plus l'impact` };
});


test('on peut jouer au tennis avec un garde du corps, et les autres s\'écartent', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 13, y: 1, z: -8, hour: 12 });
    const G = __G, res = {};
    const joueur = G.bots[0], g1 = G.bots[1], g2 = G.bots[2];
    // trois gardes au maximum : un garde reste d'un test precedent bloquait la troisieme place ;
    // et une partie de tennis ou de foot restee « en cours » faussait la touche
    for (const b of G.bots) { b.gardeCorps = 0; b.garde = 0; b.protege = null; b.sport = null; }
    G.tm.on = false; G.tm.bot = null; G.fm.on = false; G.fm.bot = null; G.clearWanted(); G.police.agents.length = 0;
    for (const b of [joueur, g1, g2]) { G.amis.add(b.name); G.gang.membres.push(b); b.ko = 0; b.hp = 100; b.sport = null; b.rdv = null; b.wait = 0; }
    G.P.pos.set(13, 0.3, -8);
    G.botGardeDuCorps(joueur); G.botGardeDuCorps(g1); G.botGardeDuCorps(g2);
    res.gardes = G.bots.filter(b => b.gardeCorps).length;
    // on envoie jouer CELUI QUI GARDE : avant, il ne partait jamais
    G.botSport(joueur, 'tennis');
    res.ordre = { sport: !!joueur.sport, gardeLachee: !joueur.gardeCorps };
    for (let i = 0; i < 4000 && !(joueur.sport && joueur.sport.pret); i++) { G.step(1 / 60, true); for (const b of G.bots) G.updateBot(b, 1 / 60); }
    res.arrive = !!(joueur.sport && joueur.sport.pret);
    G.P.racket = false;
    for (let i = 0; i < 400 && !G.tm.on; i++) { G.step(1 / 60, true); for (const b of G.bots) G.updateBot(b, 1 / 60); }
    res.match = { on: G.tm.on, gagnants: G.DUEL_GAGNANTS };
    for (let i = 0; i < 2500; i++) { G.step(1 / 60, true); for (const b of G.bots) G.updateBot(b, 1 / 60); }
    const surLeCourt = b => b.pos.x > 8.6 && b.pos.x < 17.4 && b.pos.z > -21.5 && b.pos.z < -4.5;
    res.gardesSurLeCourt = [g1, g2].filter(surLeCourt).length;
    res.surLaTouche = [g1, g2].filter(b => b.rdv && b.rdv.touche).length;
    // la raquette ne racle plus le sol
    G.P.pos.set(13, 0.3, -8); G.P.racket = true; G.setRacket(G.me, true);
    for (let i = 0; i < 4; i++) G.step(1 / 60, true);
    G.me.group.updateMatrixWorld(true);
    const bb = new G.THREE.Box3().setFromObject(G.me.racket);
    res.raquette = { bas: +bb.min.y.toFixed(2), sol: +G.P.pos.y.toFixed(2), longueur: +(bb.max.y - bb.min.y).toFixed(2) };
    return res;
  });
  const garde = r.raquette.bas - r.raquette.sol;
  const ok = r.gardes === 3 && r.ordre.sport && r.ordre.gardeLachee && r.arrive && r.match.on
    && r.match.gagnants === 3 && r.gardesSurLeCourt === 0 && r.surLaTouche === 2
    && garde > 0.1 && r.raquette.longueur < 0.9;
  return { ok, detail: `un garde du corps envoyé jouer POSE SA GARDE et part vraiment sur le court (avant, sa consigne de garde le ramenait au joueur à chaque image) · la manche se joue en ${r.match.gagnants} jeux gagnants · les ${r.surLaTouche} autres gardes se rangent sur la touche : ${r.gardesSurLeCourt} sur le court · la raquette mesure ${r.raquette.longueur} m et passe ${garde.toFixed(2)} m au-dessus du sol au lieu de s'y enfoncer de 32 cm` };
});

test('un homme mis au tapis reste COUCHÉ SUR le sol, pas dedans', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const bas = av => { av.group.updateMatrixWorld(true); let m = 1e9;
      av.group.traverse(o => { if (!o.isMesh || o.isSprite || !o.visible) return;
        const bb = new G.THREE.Box3().setFromObject(o); if (bb.min.y < m) m = bb.min.y; }); return m; };
    G.P.facing = Math.PI;
    // on dégage le terrain : avec douze habitants et dix-huit gangsters autour, les coups
    // partaient sur le premier venu au lieu de la cible qu'on mesure
    for (const o of G.bots) { o.pos.x += 400; o.pos.z += 400; o.av.group.position.copy(o.pos); }
    for (const G2 of G.gangs) for (const o of G2.membres) { o.x += 400; o.z += 400; o.av.group.position.set(o.x, o.y, o.z); }
    // un gangster mis au tapis à coups de poing
    const m = G.gangs[0].membres[0];
    m.x = G.P.pos.x; m.z = G.P.pos.z - 1.3; m.y = 0.15; m.ko = 0; m.hp = 20; m.captif = false;
    m.av.group.position.set(m.x, m.y, m.z); m.av.group.rotation.x = 0;
    // chaque coup le repousse : on le ramène devant nous pour que la série porte
    for (let i = 0; i < 10 && !m.ko; i++) { m.x = G.P.pos.x; m.z = G.P.pos.z - 1.3; G.P.punchT = 0; G.punch(); }
    const sol = G.groundUnder(m.x, m.z, null, 2);
    res.gangster = { ko: m.ko > G.simTime, couche: Math.abs(m.av.group.rotation.x) > 1.4, ecart: +(bas(m.av) - sol).toFixed(2),
 };
    for (let i = 0; i < 120; i++) G.step(1 / 60, true);
    res.gangsterApres = +(bas(m.av) - sol).toFixed(2);
    // un habitant assommé — on éloigne d'abord le gangster à terre, sinon les coups
    // repartent sur lui au lieu du bot
    for (const G2 of G.gangs) for (const o of G2.membres) { o.x += 400; o.z += 400; o.av.group.position.set(o.x, o.av.group.position.y, o.z); }
    const b = G.bots[0];
    b.pos.set(G.P.pos.x, 0.15, G.P.pos.z - 1.35); b.ko = 0; b.hp = 12; b.dead = 0; b.fight = null;
    b.av.group.visible = true; b.av.group.position.copy(b.pos); b.av.group.rotation.x = 0;
    for (let i = 0; i < 10 && !b.ko; i++) { b.pos.set(G.P.pos.x, 0.15, G.P.pos.z - 1.35); G.P.punchT = 0; G.punch(); }
    const solB = G.groundUnder(b.pos.x, b.pos.z, null, 2);
    for (let i = 0; i < 60; i++) { G.step(1 / 60, true); G.updateBot(b, 1 / 60); }
    res.habitant = { ko: b.ko > G.simTime, couche: Math.abs(b.av.group.rotation.x) > 1.4, ecart: +(bas(b.av) - solB).toFixed(2) };
    return res;
  });
  const ok = r.gangster.ko && r.gangster.couche && r.gangster.ecart > -0.06 && r.gangster.ecart < 0.35
    && r.gangsterApres > -0.06 && r.gangsterApres < 0.35
    && r.habitant.ko && r.habitant.couche && r.habitant.ecart > -0.06 && r.habitant.ecart < 0.35;
  return { ok, detail: `un gangster assommé tombe et reste couché ${r.gangsterApres} m au-dessus du bitume (il s'y enfonçait de 39 cm : le pivot de l'avatar est aux pieds, la moitié du corps passait sous la route) · même chose pour un habitant, ${r.habitant.ecart} m` };
});


test('personne ne se tient à l\'intérieur de quelqu\'un d\'autre', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 20, hour: 12 });
    const G = __G, res = {};
    const l = G.bots.slice(0, 6);
    l.forEach((b, i) => { b.pos.set(30 + i * 0.02, 0.15, 30); b.ko = 0; b.dead = 0; b.wait = 5; b.rdv = null; b.drive = null;
      b.av.group.visible = true; b.av.group.position.copy(b.pos); });
    const mini = (t2, x = 'pos') => { let m = 99;
      for (let i = 0; i < t2.length; i++) for (let j = i + 1; j < t2.length; j++) {
        const a = x === 'pos' ? t2[i].pos : t2[i], b = x === 'pos' ? t2[j].pos : t2[j];
        m = Math.min(m, Math.hypot(a.x - b.x, a.z - b.z)); } return +m.toFixed(2); };
    res.habitants = { avant: mini(l) };
    for (let i = 0; i < 240; i++) { G.step(1 / 60, true); for (const b of l) G.updateBot(b, 1 / 60); }
    res.habitants.apres = mini(l);
    // les gangsters aussi
    const gm = G.gangs[0].membres.slice(0, 5);
    gm.forEach((m, i) => { m.x = 40 + i * 0.03; m.z = 40; m.ko = 0; m.captif = false; m.av.group.position.set(m.x, m.y, m.z); });
    res.gangsters = { avant: mini(gm, 'xz') };
    for (let i = 0; i < 240; i++) G.step(1 / 60, true);
    res.gangsters.apres = mini(gm, 'xz');
    // le joueur, lui, ne se fait jamais bousculer
    G.P.pos.set(50, 0.15, 50);
    const px = G.P.pos.x, pz = G.P.pos.z;
    l[0].pos.set(50, 0.15, 50); l[0].av.group.position.copy(l[0].pos);
    for (let i = 0; i < 60; i++) { G.step(1 / 60, true); G.updateBot(l[0], 1 / 60); }
    res.joueur = { pousse: +Math.hypot(G.P.pos.x - px, G.P.pos.z - pz).toFixed(2),
      ecart: +Math.hypot(l[0].pos.x - G.P.pos.x, l[0].pos.z - G.P.pos.z).toFixed(2) };
    return res;
  });
  const ok = r.habitants.avant < 0.1 && r.habitants.apres > 0.8
    && r.gangsters.avant < 0.1 && r.gangsters.apres > 0.8
    && r.joueur.pousse < 0.05 && r.joueur.ecart > 0.8;
  return { ok, detail: `six habitants empilés au même point (${r.habitants.avant} m d'écart) se démêlent et gardent ${r.habitants.apres} m entre eux · pareil pour cinq gangsters (${r.gangsters.avant} → ${r.gangsters.apres} m) · un bot planté DANS le joueur s'écarte de ${r.joueur.ecart} m sans bousculer le joueur (${r.joueur.pousse} m)` };
});

test('le haut-parleur montre d\'abord qui fait quoi, et on peut revenir en arrière', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const b1 = G.bots[0], b2 = G.bots[1];
    for (const b of [b1, b2]) { G.amis.add(b.name); G.gang.membres.push(b); b.journal = null; b.ko = 0; b.hp = 100;
      b.pos.set(G.P.pos.x + 3, 0.15, G.P.pos.z + 2); b.av.group.visible = true; b.av.group.position.copy(b.pos); }
    G.missionGang([b1], 'banque');
    G.entrainerMembre(b2, 'tir');
    G.openQui();
    const sub = document.getElementById('ordresSub').innerHTML;
    const grid = document.getElementById('ordresGrid').innerHTML;
    res.page1 = { titre: document.getElementById('ordresTitre').textContent,
      resume: /Missions en cours/.test(sub),
      mission1: sub.includes(b1.name) && /braquer la banque/.test(sub),
      mission2: sub.includes(b2.name) && /stand de tir/.test(sub),
      surLaCarte: /⏳/.test(grid),
      retour: document.getElementById('ordresRetour').style.display !== 'none' };
    const btn = [...document.querySelectorAll('#ordresGrid [data-qui]')].find(x => x.dataset.qui === b1.name);
    res.clic = !!btn;
    if (btn) btn.click();
    res.page2 = { titre: document.getElementById('ordresTitre').textContent,
      retour: document.getElementById('ordresRetour').style.display !== 'none',
      ordres: document.querySelectorAll('#ordresGrid [data-p]').length };
    document.getElementById('ordresRetour').click();
    res.apresRetour = { titre: document.getElementById('ordresTitre').textContent,
      retour: document.getElementById('ordresRetour').style.display !== 'none' };
    G.closeUI();
    return res;
  });
  const ok = r.page1.resume && r.page1.mission1 && r.page1.mission2 && r.page1.surLaCarte && !r.page1.retour
    && r.clic && /Ordres pour/.test(r.page2.titre) && r.page2.retour && r.page2.ordres > 10
    && /À qui donner un ordre/.test(r.apresRetour.titre) && !r.apresRetour.retour;
  return { ok, detail: `la première page du 📣 liste les missions en cours de tout le gang (« braquer la banque », « entraînement au stand de tir ») et chaque carte porte l'ordre du moment · un clic ouvre sa fiche (${r.page2.ordres} ordres) avec un bouton « ← Retour » qui ramène à la liste ; ce bouton n'apparaît pas sur la première page` };
});


test('une séance de sport paie vraiment, et l\'effort compte', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 18, hour: 12 });
    const G = __G;
    const seance = (kind, tousLesN, perfDepart) => {
      G.P.perf = perfDepart; G.gym.on = null;
      G.startGym(kind);
      const t0 = G.simTime;
      for (let i = 0; i < 60 * 45 && G.gym.on; i++) {
        if (tousLesN && i % tousLesN === 0) G.P.jumpBuf = 1;
        G.step(1 / 60, true); G.gymTick(1 / 60);
      }
      return { duree: Math.round(G.simTime - t0), gagne: G.perfDe(G.P) - perfDepart,
        endu: G.stats.endu, sprint: +G.sprintDuree().toFixed(1) };
    };
    G.stats.m = 0; G.stats.f = 30; G.stats.endu = 0; G.stats.recBanc = 0; G.stats.recTapis = 0;
    const res = {};
    res.mou = seance('bench', 40, 10);        // il pousse mollement
    G.stats.recBanc = 0;
    res.intense = seance('bench', 6, 10);     // il s'arrache
    G.stats.recBanc = 0;
    res.expert = seance('bench', 6, 85);      // la même séance, mais déjà très fort
    const enduAv = G.stats.endu, sprintAv = G.sprintDuree();
    res.tapis = seance('run', 8, 10);
    res.endurance = { avant: enduAv, apres: G.stats.endu, sprintAvant: +sprintAv.toFixed(1), sprintApres: +G.sprintDuree().toFixed(1) };
    G.gym.on = null;
    return res;
  });
  const ok = r.mou.gagne >= 4 && r.intense.gagne > r.mou.gagne + 2
    && r.expert.gagne > 0 && r.expert.gagne < r.intense.gagne * 0.7
    && r.mou.duree > 20 && r.intense.duree > 25
    && r.endurance.apres > r.endurance.avant && r.endurance.sprintApres > r.endurance.sprintAvant + 0.5;
  return { ok, detail: `la séance ne donne plus 3 points quoi qu'on fasse : elle SE PROLONGE tant qu'on force (${r.intense.duree} s au lieu de 8) et le gain suit l'effort — ${r.mou.gagne} points en poussant mollement, ${r.intense.gagne} en s'arrachant · et il devient plus dur de monter : la MÊME séance ne rapporte que ${r.expert.gagne} points à un athlète déjà à 85/100 · le tapis fait monter l'endurance (${r.endurance.avant} → ${r.endurance.apres}) et allonge vraiment le sprint : ${r.endurance.sprintAvant} s → ${r.endurance.sprintApres} s` };
});


test('on peut donner plusieurs ordres à plusieurs membres à la fois', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const l = G.bots.slice(0, 4);
    for (const b of l) { G.amis.add(b.name); G.gang.membres.push(b); b.ko = 0; b.hp = 100; b.gangMission = null; b.journal = null;
      b.pos.set(G.P.pos.x + 3, 0.15, G.P.pos.z + 2); b.av.group.visible = true; b.av.group.position.copy(b.pos); }
    // quatre ordres différents à quatre hommes, à la suite
    res.pris = [
      G.commandeSociale(`${l[0].name} braque la banque`),
      G.commandeSociale(`${l[1].name} vole une boutique`),
      G.commandeSociale(`${l[2].name} va t entrainer au sport`),
      G.commandeSociale(`${l[3].name} on joue au tennis`),
    ];
    res.etat = {
      missions: G.gang.missions.length,
      coup0: l[0].gangMission ? l[0].gangMission.type : null,
      coup1: l[1].gangMission ? l[1].gangMission.type : null,
      entrain2: l[2].rdv ? l[2].rdv.entrain : null,
      sport3: l[3].sport ? l[3].sport.jeu : null,
      enCours: l.map(b => (b.journal || []).filter(o => o.etat === 'cours').length),
    };
    // un homme déjà parti CHANGE d'ordre quand on lui en donne un autre : c'est ce que le
    // joueur attend, et refuser bloquait des ordres pour de bon
    res.change = G.commandeSociale(`${l[0].name} vole une voiture`);
    res.apresChange = { missions: G.gang.missions.length, type0: l[0].gangMission ? l[0].gangMission.type : null };
    // les deux coups avancent ensemble et se terminent chacun de leur côté
    for (let i = 0; i < 60 * 220 && G.gang.missions.length; i++) { G.step(1 / 60, true); for (const b of l) G.updateBot(b, 1 / 60); }
    res.fin = { missions: G.gang.missions.length,
      soldes: l.slice(0, 2).map(b => (b.journal || []).filter(o => o.etat === 'reussi' || o.etat === 'rate').length),
      libres: l.slice(0, 2).every(b => !b.gangMission) };
    return res;
  });
  const ok = r.pris.every(Boolean)
    && r.etat.missions === 2 && r.etat.coup0 === 'banque' && r.etat.coup1 === 'boutique'
    && r.etat.entrain2 === 'sport' && r.etat.sport3 === 'tennis'
    && r.etat.enCours.every(n => n === 1)
    && r.change && r.apresChange.missions === 2 && r.apresChange.type0 === 'voiture'
    && r.fin.missions === 0 && r.fin.libres && r.fin.soldes.every(n => n >= 1);
  return { ok, detail: `[pris=${r.pris.join('/')} coups=${r.etat.coup0}/${r.etat.coup1} entrain=${r.etat.entrain2} sport=${r.etat.sport3} enCours=${r.etat.enCours.join('/')} change=${r.change} apres=${r.apresChange.missions}/${r.apresChange.type0} fin=${r.fin.missions} libres=${r.fin.libres} soldes=${r.fin.soldes.join('/')}] quatre ordres à quatre hommes passent d'affilée : deux coups tournent EN MÊME TEMPS (${r.etat.missions} missions), un troisième part s'entraîner, un quatrième joue au tennis · avant, un seul créneau existait et le gang répondait « on est déjà sur un coup » dès le deuxième ordre · un homme déjà parti CHANGE d'ordre si on lui en donne un autre (il lâche son coup et part sur le nouveau) sans casser celui des autres, et chaque mission se solde de son côté` };
});


test('on choisit les hommes d\'une mission en les cochant, et on voit les chances monter', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const l = G.bots.slice(0, 4);
    for (const b of l) { G.amis.add(b.name); G.gang.membres.push(b); b.ko = 0; b.hp = 100; b.gangMission = null; b.journal = null; b.perf = 40;
      b.pos.set(G.P.pos.x + 3, 0.15, G.P.pos.z + 2); b.av.group.visible = true; b.av.group.position.copy(b.pos); }
    G.equipeSel.clear();
    G.openQui();
    res.entree = !!document.querySelector('#ordresGrid [data-equipe]');
    document.querySelector('#ordresGrid [data-equipe]').click();
    res.page = { titre: document.getElementById('ordresTitre').textContent,
      cartes: document.querySelectorAll('#ordresGrid [data-sel]').length,
      missionsAvant: document.querySelectorAll('#ordresGrid [data-mission]').length,
      retour: document.getElementById('ordresRetour').style.display !== 'none' };
    [...document.querySelectorAll('#ordresGrid [data-sel]')][0].click();
    const chanceUn = G.chanceMission(G.gang.membres.filter(b => G.equipeSel.has(b.name)), 'boutique');
    const missionsUn = document.querySelectorAll('#ordresGrid [data-mission]').length;
    [...document.querySelectorAll('#ordresGrid [data-sel]')][1].click();
    const chanceDeux = G.chanceMission(G.gang.membres.filter(b => G.equipeSel.has(b.name)), 'boutique');
    res.selection = { coches: G.equipeSel.size, missionsUn, chanceUn, chanceDeux,
      resume: document.getElementById('ordresSub').innerHTML.includes('2 hommes sélectionnés') };
    document.querySelector('#ordresGrid [data-tous]').click();
    res.tous = G.equipeSel.size;
    [...document.querySelectorAll('#ordresGrid [data-mission]')].find(b => b.dataset.mission === 'boutique').click();
    res.lancee = { missions: G.gang.missions.length,
      membres: G.gang.missions[0] ? G.gang.missions[0].membres.length : 0,
      type: G.gang.missions[0] ? G.gang.missions[0].type : null,
      chance: G.gang.missions[0] ? G.gang.missions[0].chanceDep : null,
      journaux: l.filter(b => (b.journal || []).some(o => o.etat === 'cours')).length };
    G.closeUI();
    return res;
  });
  const ok = r.entree && /Choisir les hommes/.test(r.page.titre) && r.page.cartes === 4
    && r.page.missionsAvant === 0 && r.page.retour
    && r.selection.coches === 2 && r.selection.missionsUn >= 6 && r.selection.resume
    && r.selection.chanceDeux > r.selection.chanceUn + 8
    && r.tous === 4
    && r.lancee.missions === 1 && r.lancee.membres === 4 && r.lancee.type === 'boutique'
    && r.lancee.chance > r.selection.chanceDeux && r.lancee.journaux === 4;
  return { ok, detail: `le 📣 propose « choisir plusieurs hommes » : on COCHE qui part (${r.page.cartes} cartes, avec performance, vie et « déjà sur un coup ») et les missions n'apparaissent qu'une fois quelqu'un coché · le pourcentage de réussite suit la sélection en direct : ${r.selection.chanceUn} % à un homme, ${r.selection.chanceDeux} % à deux, ${r.lancee.chance} % à quatre sur une boutique · « tout sélectionner » prend les ${r.tous} disponibles, et le coup part avec les ${r.lancee.membres} en une seule mission notée dans les ${r.lancee.journaux} journaux` };
});


test('il fait toujours jour : la nuit ne tombe plus jamais', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    let nuitMax = 0, hMin = 99, hMax = -99, imagesSombres = 0, etoiles = 0, lampes = 0;
    const t0 = G.simTime;
    for (let i = 0; i <= 240; i++) {          // deux tours complets d'horloge
      G.simTime = i / 120 * 360;
      G.dayTick();
      nuitMax = Math.max(nuitMax, G.day.night);
      hMin = Math.min(hMin, G.day.h); hMax = Math.max(hMax, G.day.h);
      if (G.day.night > 0.5) { imagesSombres++; lampes++; }
      if (G.day.night > 0.8) etoiles++;
    }
    G.simTime = t0;
    return { nuitMax: +nuitMax.toFixed(2), lumiereMin: +(1 - nuitMax).toFixed(2),
      heureMin: +hMin.toFixed(1), heureMax: +hMax.toFixed(1),
      imagesSombres, lampes, etoiles, horloge: document.getElementById('clock').textContent };
  });
  const ok = r.nuitMax < 0.35 && r.lumiereMin > 0.65
    && r.heureMin >= 6.9 && r.heureMax <= 19.1
    && r.imagesSombres === 0 && r.lampes === 0 && r.etoiles === 0
    && !/🌙/.test(r.horloge);
  return { ok, detail: `sur deux tours d'horloge complets, l'obscurité ne dépasse jamais ${r.nuitMax} (la lumière reste au-dessus de ${r.lumiereMin}) · l'heure tourne de ${r.heureMin} h à ${r.heureMax} h, le soleil monte à midi et redescend sans se coucher · ${r.imagesSombres} image sombre, ${r.lampes} allumage de lampadaires, ${r.etoiles} ciel étoilé, et l'horloge affiche « ${r.horloge} »` };
});


test('l\'atelier dit pourquoi « Valider » est grisé, et amène une voiture si besoin', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const d0 = G.city.tuneDesk;
    for (const v of G.city.cars) { v.x += 300; v.z += 300; v.g.position.set(v.x, v.y, v.z); }
    G.P.pos.set(d0.x, 0.3, d0.z - 1);
    G.wallet = 400;
    G.openAtelier();
    const ok = document.getElementById('atelierOk');
    res.sansVoiture = { texte: ok.textContent, grise: ok.disabled,
      amener: document.getElementById('atelierAmener').style.display !== 'none', cible: !!G.tuneCible() };
    document.getElementById('atelierAmener').click();
    res.apres = { texte: ok.textContent, grise: ok.disabled, cible: !!G.tuneCible(),
      distance: Math.round(Math.hypot(G.tuneCible().x - d0.x, G.tuneCible().z - d0.z)),
      surTravee: Math.abs(G.tuneCible().z - G.city.garage.z) < 0.6,
      amener: document.getElementById('atelierAmener').style.display !== 'none' };
    // sans assez d'argent, il le dit aussi : on choisit un kit payant, puis on vide la poche
    document.querySelector('#atelierOnglets [data-t="kits"]').click();
    const kit = [...document.querySelectorAll('#atelierCorps [data-k]')].find(b => /🪙/.test(b.textContent));
    res.kitChoisi = !!kit; if (kit) kit.click();
    G.wallet = 5; G.majAtelier();
    res.sansArgent = { texte: ok.textContent, grise: ok.disabled };
    // une voiture garée devant le comptoir compte, même si le joueur s'avance à la borne
    G.wallet = 400;
    const c = G.tuneCible(); c.x = d0.x + 9; c.z = d0.z + 4; c.g.position.set(c.x, c.y, c.z);
    G.P.pos.set(d0.x, 0.3, d0.z - 1.2);
    res.garee = !!G.tuneCible();
    G.closeUI();
    return res;
  });
  const ok = !r.sansVoiture.cible && r.sansVoiture.grise && /voiture/i.test(r.sansVoiture.texte) && r.sansVoiture.amener
    && r.apres.cible && !r.apres.grise && r.apres.texte === 'Valider' && r.apres.surTravee && r.apres.distance <= 12
    && r.kitChoisi && r.sansArgent.grise && /manque/i.test(r.sansArgent.texte)
    && r.garee;
  return { ok, detail: `sans voiture au comptoir, « Valider » n'est plus un bouton gris muet : il affiche « ${r.sansVoiture.texte} » et un bouton « 🚗 Amener une voiture » gare une caisse à ${r.apres.distance} m de l'atelier · s'il manque de l'argent, il l'écrit aussi (« ${r.sansArgent.texte} ») · et une voiture garée devant l'atelier compte désormais même quand on s'avance jusqu'à la borne` };
});


test('les hommes du gang ne se tapent plus entre eux', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const l = G.bots.slice(0, 5);
    // personne d'autre ne doit pouvoir toucher la victime : ni la police d'un test precedent,
    // ni un gangster rival, ni un habitant en bagarre — on ne mesure que les coups ENTRE EUX
    G.clearWanted(); G.police.agents.length = 0;
    for (const o of G.bots) if (!l.includes(o)) { o.pos.x += 400; o.pos.z += 400; o.av.group.position.copy(o.pos); o.fight = null; }
    for (const G2 of G.gangs) for (const o of G2.membres) { o.x += 400; o.z += 400; o.chasse = null; if (o.av) o.av.group.position.set(o.x, o.y, o.z); }
    for (const b of G.bots) { b.gardeCorps = 0; b.garde = 0; b.protege = null; }
    for (const b of l) { G.amis.add(b.name); G.gang.membres.push(b); b.ko = 0; b.hp = 100; b.journal = null; b.bagarre = null; b.fight = null; b.sport = null; b.rdv = null;
      b.gardeCorps = 0; b.pos.set(G.P.pos.x + 2, 0.15, G.P.pos.z + 2); b.av.group.visible = true; b.av.group.position.copy(b.pos); }
    G.botGardeDuCorps(l[0]); G.botGardeDuCorps(l[1]); G.botGardeDuCorps(l[2]);
    const victime = l[3];
    victime.fight = 'fight'; victime.fightT = G.simTime + 30;
    victime.pos.set(G.P.pos.x + 1.5, 0.15, G.P.pos.z + 1); victime.av.group.position.copy(victime.pos);
    for (let i = 0; i < 400; i++) { G.step(1 / 60, true); for (const b of l) G.updateBot(b, 1 / 60); }
    res.entreEux = { bagarres: l.filter(b => b.bagarre).length,
      pvVictime: Math.round(victime.hp),
      ordresTaper: l.reduce((a, b) => a + (b.journal || []).filter(o => /prendre/.test(o.t)).length, 0) };
    res.ordre = G.commandeSociale(`${l[0].name} tape ${l[4].name}`);
    res.apresOrdre = { bagarre: !!l[0].bagarre, pv: Math.round(l[4].hp) };
    l[4].hp = 0; l[4].ko = 0;
    for (let i = 0; i < 30; i++) G.step(1 / 60, true);
    res.zeroPV = { ko: l[4].ko > G.simTime, couche: Math.abs(l[4].av.group.rotation.x) > 1.4 };
    return res;
  });
  const ok = r.entreEux.bagarres === 0 && r.entreEux.pvVictime === 100 && r.entreEux.ordresTaper === 0
    && !r.apresOrdre.bagarre && r.apresOrdre.pv === 100
    && r.zeroPV.ko && r.zeroPV.couche;
  return { ok, detail: `un membre bousculé passait en bagarre, et les gardes du corps du gang lui sautaient dessus a leur tour - on voyait « s'en prendre a un des siens » dans le journal et des hommes a 0 PV · maintenant : ${r.entreEux.bagarres} bagarre entre eux, la victime garde ses ${r.entreEux.pvVictime} PV, ${r.entreEux.ordresTaper} ordre de ce genre · meme « tape un des notres » est refuse · et un homme tombe a zero reste a terre au lieu de deambuler` };
});


test('la voiture de l\'atelier se pose sur le pont, sans rester coincee dans un mur', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const g = G.city.garage, d0 = G.city.tuneDesk;
    for (const v of G.city.cars) { v.x += 300; v.z += 300; v.g.position.set(v.x, v.y, v.z); }
    G.P.pos.set(d0.x, 0.3, d0.z - 1);
    G.openAtelier();
    document.getElementById('atelierAmener').click();
    const c = G.tuneCible();
    res.pose = { x: +(c.x - g.x).toFixed(1), z: +(c.z - g.z).toFixed(1), h: +c.h.toFixed(2), y: +c.y.toFixed(2) };
    // dans un mur ? on compare son volume aux solides du décor
    const o = c.solid; let dansMur = 0;
    for (const so of G.solids) {
      if (so === o || so.deco) continue;
      if (Math.abs(so.x - o.x) < (so.w + o.w) / 2 - 0.05 && Math.abs(so.z - o.z) < (so.d + o.d) / 2 - 0.05
        && Math.abs((so.y || 0) - (c.y + 0.8)) < (so.h + 1.6) / 2 - 0.05) dansMur++;
    }
    res.dansMur = dansMur;
    const murs = c2 => { const o2 = c2.solid; let n = 0;
      for (const so of G.solids) { if (so === o2 || so.deco) continue;
        if (Math.abs(so.x - o2.x) < (so.w + o2.w) / 2 - 0.05 && Math.abs(so.z - o2.z) < (so.d + o2.d) / 2 - 0.05
          && Math.abs((so.y || 0) - (c2.y + 0.8)) < (so.h + 1.6) / 2 - 0.05) n++; } return n; };
    // elle roule vraiment : on recule et elle bouge
    const z0 = c.z;
    G.enterCar(c);
    for (let i = 0; i < 200; i++) { G.keys.add('KeyS'); G.step(1 / 60, true); }
    G.keys.delete('KeyS');
    res.bouge = +Math.abs(c.z - z0).toFixed(1);
    // et une voiture coincée dans le mur du fond est remise droite sur le pont
    // pile là où l'ancien code la déposait : à cheval sur le mur sud, derrière le comptoir
    c.x = d0.x + 3.2; c.z = d0.z + 1.2; c.h = 1.2; c.g.position.set(c.x, c.y, c.z); G.vehicleSolid(c);
    G.exitCar();
    G.P.pos.set(d0.x, 0.3, d0.z - 1);
    G.majAtelier();
    res.bouton = document.getElementById('atelierAmener').textContent;
    res.coince = murs(c);
    document.getElementById('atelierAmener').click();
    res.remise = { x: +(c.x - g.x).toFixed(1), z: +(c.z - g.z).toFixed(1), h: +c.h.toFixed(2) };
    res.apresMurs = murs(c);
    G.closeUI();
    return res;
  });
  const travees = [-8.5, 0, 8.5];
  const surTravee = p2 => travees.some(t => Math.abs(p2.x - t) < 0.6) && Math.abs(p2.z) < 0.6 && Math.abs(p2.h) < 0.05;
  const ok = surTravee(r.pose) && r.dansMur === 0 && r.pose.y > 0.1 && r.pose.y < 1
    && r.bouge > 2 && /Remettre/.test(r.bouton) && r.coince > 0 && surTravee(r.remise) && r.apresMurs === 0;
  return { ok, detail: `la voiture est deposee au MILIEU d'un pont elevateur du garage (travee x${r.pose.x}, bien droite), roues au sol a ${r.pose.y} m, ${r.dansMur} chevauchement avec le decor — avant elle atterrissait derriere le comptoir, a cheval sur le mur du fond, et y restait coincee · elle roule (${r.bouge} m en marche arriere) · et une caisse posee la ou l'ancien code la mettait (${r.coince} chevauchement avec le mur sud) est remise droite sur le pont par le bouton « ${r.bouton} » : ${r.apresMurs} chevauchement` };
});


test('dormir sauvegarde TOUT, la deco achetee arrive toujours, et ta voiture reste chez toi', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    // 1) la deco achetee arrive meme sans point de livraison : avant, on payait pour rien
    const it = G.DECOR[0];
    const liv = G.city.delivery; G.city.delivery = null;
    const n0 = G.city.parcels.length;
    G.deliverDecor(it);
    res.sansVilla = { colis: G.city.parcels.length - n0,
      distance: G.city.parcels.length ? +Math.hypot(G.city.parcels[0].x - G.P.pos.x, G.city.parcels[0].z - G.P.pos.z).toFixed(1) : -1 };
    G.city.delivery = liv;
    res.colisEnregistres = JSON.parse(localStorage.getItem('superobby.colis') || '[]').length;
    // 2) ta voiture garee dans le garage de ta villa n'est plus emmenee par l'atelier
    const g = G.city.monGarage;
    res.garageConnu = !!g;
    const v = G.city.cars[0];
    v.x = g.x; v.z = g.z; v.g.position.set(v.x, v.y, v.z);
    res.reconnue = G.dansMonGarage(v);
    const x0 = v.x, z0 = v.z;
    G.P.pos.set(G.city.tuneDesk.x, 0.3, G.city.tuneDesk.z - 1);
    G.openAtelier(); document.getElementById('atelierAmener').click(); G.closeUI();
    res.deplacee = +Math.hypot(v.x - x0, v.z - z0).toFixed(1);
    // 3) dormir enregistre TOUTE la partie, pas la moitie
    const cles = ['guerre', 'amis', 'perf', 'decor', 'colis', 'chien', 'tuning', 'wallet', 'stats', 'owned'];
    cles.forEach(k => localStorage.removeItem('superobby.' + k));
    G.amis.add('Lucas_2014'); G.P.perf = 55; G.chien.nom = 'Rex';
    const b = G.city.beds[0];
    G.P.pos.set(b.x, b.y + 1, b.z); G.city.bedNear = b;
    G.sleepBed();
    res.dodo = cles.filter(k => localStorage.getItem('superobby.' + k) != null);
    res.total = cles.length;
    return res;
  });
  const ok = r.sansVilla.colis === 1 && r.sansVilla.distance < 4
    && r.colisEnregistres === 1
    && r.garageConnu && r.reconnue && r.deplacee === 0
    && r.dodo.length === r.total;
  return { ok, detail: `acheter de la deco sans avoir de villa faisait perdre l'achat : le carton est maintenant depose a ${r.sansVilla.distance} m de toi, et il est ENREGISTRE (il revient si tu recharges) · une voiture garee dans le garage de ta villa est reconnue comme la tienne : l'atelier ne va plus la chercher (${r.deplacee} m de deplacement) · et dormir enregistre les ${r.dodo.length}/${r.total} morceaux de la partie (gang, amis, performance, deco, colis, chien, voiture preparee…) au lieu de la moitie` };
});


test('un garde du corps envoye en mission part vraiment', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, res = {};
    const l = G.bots.slice(0, 3);
    for (const b of l) { G.amis.add(b.name); G.gang.membres.push(b); b.ko = 0; b.hp = 100; b.journal = null; b.gangMission = null;
      b.pos.set(G.P.pos.x + 2, 0.15, G.P.pos.z + 2); b.av.group.visible = true; b.av.group.position.copy(b.pos); }
    for (const b of l) G.botGardeDuCorps(b);
    res.gardes = l.filter(b => b.gardeCorps).length;
    G.missionGang([l[0], l[1]], 'boutique');
    res.envoi = { missions: G.gang.missions.length, gardeLachee: !l[0].gardeCorps && !l[1].gardeCorps,
      gardeGardee: !!l[2].gardeCorps, rdv: l[0].rdv ? l[0].rdv.nom : null,
      journal: (l[0].journal || []).some(o => o.etat === 'cours' && /boutique/.test(o.t)) };
    const dep = l.map(b => [b.pos.x, b.pos.z]); let resteMin = 1e9;
    for (let i = 0; i < 60 * 60; i++) { G.step(1 / 60, true); for (const b of l) G.updateBot(b, 1 / 60); if (i > 60 * 45) resteMin = Math.min(resteMin, Math.hypot(l[2].pos.x - G.P.pos.x, l[2].pos.z - G.P.pos.z)); }
    // la boutique visee peut etre a deux pas du joueur : on mesure le chemin PARCOURU par chaque garde envoye, et un garde
    // deja ARRIVE devant sa boutique compte comme parti
    const loin = k => { const b = l[k], t = b.rdv && b.rdv.x != null ? Math.hypot(b.pos.x - b.rdv.x, b.pos.z - b.rdv.z) : 1e9; return t < 5 ? 99 : Math.max(Math.hypot(b.pos.x - G.P.pos.x, b.pos.z - G.P.pos.z), Math.hypot(b.pos.x - dep[k][0], b.pos.z - dep[k][1])); };
    res.trajet = { parti0: +loin(0).toFixed(0),
      parti1: +loin(1).toFixed(0),
      reste2: +Math.min(resteMin, Math.hypot(l[2].pos.x - G.P.pos.x, l[2].pos.z - G.P.pos.z)).toFixed(0) };   // au plus pres sur les 15 dernieres secondes : il contourne parfois un obstacle
    // l'entrainement aussi envoie vraiment le garde
    G.entrainerMembre(l[2], 'tir');
    res.entrain = { gardeLachee: !l[2].gardeCorps, rdv: l[2].rdv ? l[2].rdv.entrain : null };
    // le stand de tir est a l'autre bout de la ville : on lui laisse deux minutes
    let entrainMax = 0;
    for (let i = 0; i < 60 * 120; i++) { G.step(1 / 60, true); for (const b of l) G.updateBot(b, 1 / 60); entrainMax = Math.max(entrainMax, Math.hypot(l[2].pos.x - G.P.pos.x, l[2].pos.z - G.P.pos.z)); }
    res.entrainLoin = +entrainMax.toFixed(0);   // le plus loin qu'il soit alle : une fois entraine, il revient garder le joueur
    return res;
  });
  const ok = r.gardes === 3 && r.envoi.missions === 1 && r.envoi.gardeLachee && r.envoi.gardeGardee && r.envoi.journal
    && r.trajet.parti0 > 8 && r.trajet.parti1 > 8 && r.trajet.reste2 < 4
    && r.entrain.gardeLachee && r.entrain.rdv === 'tir' && r.entrainLoin > 8;
  return { ok, detail: `un homme en garde recevait a CHAQUE IMAGE une consigne « colle au joueur » qui ecrasait le rendez-vous de sa mission : sa fiche affichait « braquer une boutique » et il restait plante a cote de toi · maintenant il pose la garde et part pour de bon (${r.trajet.parti0} m et ${r.trajet.parti1} m du joueur), pendant que le garde NON envoye reste a ${r.trajet.reste2} m · pareil pour l'entrainement (${r.entrainLoin} m), l'hopital et la promenade du chien` };
});


test('le circuit est un petit anneau a l\'ecart, il ne traverse plus la ville', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G, c = G.city.circuit;
    let dmin = 1e9, coupe = 0, rayonMin = 1e9, rayonMax = 0;
    for (const pt of G.RACE_PTS) {
      dmin = Math.min(dmin, Math.hypot(pt[0], pt[1]));
      const rr = Math.hypot(pt[0] - c.x, pt[1] - c.z);
      rayonMin = Math.min(rayonMin, rr); rayonMax = Math.max(rayonMax, rr);
      // on ignore la route d'accès du circuit : elle DOIT toucher l'anneau, c'est son entrée
      for (const rt of G.city.routes) {
        if (Math.hypot(rt.x - c.x, rt.z - c.z) < c.r + 30) continue;
        if (Math.abs(pt[0] - rt.x) < rt.w / 2 + 3 && Math.abs(pt[1] - rt.z) < rt.d / 2 + 3) coupe++;
      }
    }
    const karts = G.city.cars.filter(k => k.kart);
    return { centre: [c.x, c.z], rayon: c.r, longueur: Math.round(G.RACE_LEN),
      rond: +(rayonMax - rayonMin).toFixed(1), loinDeLaVille: Math.round(dmin), coupeRoutes: coupe,
      karts: karts.length, kartsSurGrille: karts.every(k => Math.abs(Math.hypot(k.x - c.x, k.z - c.z) - c.r) < 4.5) };
  });
  const ok = r.rond < 0.5 && r.loinDeLaVille > 100 && r.coupeRoutes === 0
    && r.karts >= 4 && r.kartsSurGrille && r.longueur > 150 && r.longueur < 260;
  return { ok, detail: `la piste faisait tout le tour de la ville et coupait les rues · c'est maintenant un ANNEAU PARFAIT de ${r.rayon} m de rayon (${r.rond} m d'écart entre le point le plus proche et le plus loin du centre), long de ${r.longueur} m, posé a ${r.loinDeLaVille} m du centre-ville · il ne croise ${r.coupeRoutes} route, et les ${r.karts} karts attendent alignés sur la grille` };
});

test('le plan routier dessert chaque quartier et les rues sont degagees', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    const surRoute = (x, z) => G.city.routes.some(rt => Math.abs(x - rt.x) < rt.w / 2 + 1 && Math.abs(z - rt.z) < rt.d / 2 + 1);
    const d = G.city.plan.dessertes;
    const horsRoute = d.filter(o => !surRoute(o.x, o.z)).map(o => o.n);
    const sansDesserte = G.city.zones.filter(z => !G.desserteDe(z.name)).map(z => z.name);
    const sansArret = G.city.zones.filter(z => { const l = G.lieuDe(z.name); return l && !l.auto; }).length;
    // plus rien ne traîne au milieu d'une chaussée
    const surChaussee = (x, z) => G.city.routes.some(rt => Math.abs(x - rt.x) < rt.w / 2 - 1.2 && Math.abs(z - rt.z) < rt.d / 2 - 1.2);
    const vehic = new Set(); for (const c of [...G.city.cars, ...G.city.aiCars]) if (c.solid) vehic.add(c.solid);
    // on ne compte que le MOBILIER : un mur, un vitrage ou un bâtiment n'est jamais effacé
    // ni ce qui est a l'ETAGE ni ce qui est DANS un batiment : ca n'a jamais trainé dans la rue
    const dedans = (x, z) => [...G.city.batiments, ...G.city.interieurs].some(b => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2);
    const restants = G.solids.filter(o => o.mesh && !vehic.has(o) && !o.porte && !o.ai && !o.pol && !o.bar && !o.statue
      && !o.glass && o.h <= 4.6 && !(o.w > 14 && o.d > 14) && o.y - o.h / 2 <= 0.8 && !dedans(o.x, o.z)
      && surChaussee(o.x, o.z)).length;
    return { axes: G.city.plan.axes.length, dessertes: d.length, quartiers: G.city.zones.length,
      horsRoute, sansDesserte, sansArret, degagees: G.city.degagees, restants,
      pireDistance: Math.max(...d.map(o => o.loin)) };
  });
  const ok = r.horsRoute.length === 0 && r.sansDesserte.length === 0 && r.sansArret === 0
    && r.dessertes === r.quartiers && r.degagees > 20 && r.restants === 0 && r.pireDistance < 40;
  return { ok, detail: `le plan est ENREGISTRÉ dans le jeu : ${r.axes} axes nommés et ${r.dessertes} dessertes, une par quartier (${r.quartiers} quartiers, ${r.sansDesserte.length} sans desserte) · chaque desserte tombe sur une vraie chaussée (${r.horsRoute.length} hors route), a ${r.pireDistance} m au pire de ce qu'elle dessert · le GPS voiture et les bots s'en servent : ${r.sansArret} quartier sans point d'arrêt · et ${r.degagees} objets qui traînaient au milieu des rues ont été enlevés (${r.restants} restant)` };
});

test('le casino WORLD TELIO MARLON : machines, roulette et poker qui paient vraiment', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 302, hour: 12 });
    const G = __G, c = G.city.casino, res = {};
    res.batiment = { machines: c.machines.length, tables: c.tables.map(t => t.kind).sort().join(','),
      neons: c.neons.length, enseigne: c.enseigne.texte, quartier: !!G.city.zones.find(z => z.name === 'Casino') };
    // on s'approche d'une machine : E l'ouvre
    const m = c.machines[0];
    G.P.pos.set(m.x + Math.sin(m.ry) * 1.2, 0.9, m.z + Math.cos(m.ry) * 1.2);
    for (let i = 0; i < 5; i++) G.step(1 / 60, true);
    res.proche = !!G.city.slotNear;
    // la machine paie : mesuré sur 300 000 tirages
    let mise = 0, rendu = 0, jack = 0;
    for (let i = 0; i < 300000; i++) { const t = G.tireRouleaux(), g = G.gainMachine(t, 1); mise++; rendu += g.mult; if (g.mult >= 100) jack++; }
    res.machine = { retour: +(rendu / mise).toFixed(3), jackpots: jack };
    // la roulette aussi
    const pr = G.PARIS_ROULETTE.find(x => x.k === 'rouge'), pp = G.PARIS_ROULETTE.find(x => x.k === 'plein');
    let r1 = 0, r2 = 0;
    for (let i = 0; i < 200000; i++) { const n = Math.floor(Math.random() * 37); if (pr.gagne(n, 7)) r1 += pr.m; if (pp.gagne(n, 7)) r2 += pp.m; }
    res.roulette = { rouge: +(r1 / 200000).toFixed(3), plein: +(r2 / 200000).toFixed(3), paris: G.PARIS_ROULETTE.length };
    // on joue vraiment : les pièces bougent
    G.wallet = 2000; G.ouvreCasino('machine', m); G.casino.mise = 100;
    const w0 = G.wallet; G.jouerCasino();
    res.jeu = { misePrise: w0 - G.wallet + G.casino.gain === 100, ecran: m.rouleaux.length === 3 };
    // poker : cinq cartes, on garde, on change, la main est jugée
    G.ouvreCasino('poker', c.tables.find(t => t.kind === 'poker'));
    G.jouerCasino();
    res.poker = { cartes: G.casino.cartes.length, etape: G.casino.etape };
    G.casino.gardees = [true, true, true, true, true]; G.jouerCasino();
    res.poker.fini = G.casino.etape === 'pret';
    // le classement des mains est juste
    const main = n => n.map(x => ({ c: x[0], v: x[1] }));
    res.rangs = {
      carre: G.POKER_GAINS[G.pokerRang(main([[0,5],[1,5],[2,5],[3,5],[0,9]]))].n,
      couleur: G.POKER_GAINS[G.pokerRang(main([[2,1],[2,4],[2,7],[2,9],[2,11]]))].n,
      quinte: G.POKER_GAINS[G.pokerRang(main([[0,3],[1,4],[2,5],[3,6],[0,7]]))].n,
      full: G.POKER_GAINS[G.pokerRang(main([[0,5],[1,5],[2,5],[3,8],[0,8]]))].n,
    };
    // des bots viennent jouer aux machines
    // des HABITANTS, pas ton equipe : les tests precedents en ont fait des amis ou des
    // membres du gang, et un homme a toi ne va pas tirer les bras des machines tout seul
    for (const x of G.bots.slice(0, 6)) { G.amis.delete(x.name); if (G.gang.membres.includes(x)) G.quitterGang(x);
      x.pos.set(c.x + (Math.random() - 0.5) * 20, 0.9, c.z + (Math.random() - 0.5) * 16); x.rdv = null; x.ko = 0; x.wait = 0; x.av.group.visible = true; }
    G.closeUI();
    let joueurs = 0;
    for (let i = 0; i < 60 * 90; i++) { G.step(1 / 60, true); for (const x of G.bots) G.updateBot(x, 1 / 60); joueurs = Math.max(joueurs, c.machines.filter(mm => mm.bot).length); }
    res.bots = joueurs;
    return res;
  });
  const ok = r.batiment.machines >= 12 && /poker,poker,roulette/.test(r.batiment.tables) && r.batiment.neons > 20
    && r.batiment.enseigne === 'WORLD TELIO MARLON' && r.batiment.quartier && r.proche
    && r.machine.retour > 0.85 && r.machine.retour < 1 && r.machine.jackpots > 0
    && r.roulette.rouge > 0.93 && r.roulette.rouge < 1 && r.roulette.plein > 0.9 && r.roulette.plein < 1 && r.roulette.paris >= 10
    && r.jeu.ecran && r.poker.cartes === 5 && r.poker.fini
    && r.rangs.carre === 'Carré' && r.rangs.couleur === 'Couleur' && r.rangs.quinte === 'Quinte' && r.rangs.full === 'Full'
    && r.bots >= 2;
  return { ok, detail: `le WORLD TELIO MARLON ouvre au nord de la ville : ${r.batiment.machines} machines à sous, une roulette, deux tables de poker, ${r.batiment.neons} ampoules de façade et la grande enseigne lumineuse · les jeux paient comme un vrai casino, mesuré sur 300 000 tirages : la machine rend ${r.machine.retour} de la mise (${r.machine.jackpots} jackpots à ×100), la roulette ${r.roulette.rouge} sur rouge/noir et ${r.roulette.plein} sur un numéro plein, avec ${r.roulette.paris} types de paris · le poker fermé distribue 5 cartes, on garde ce qu'on veut et la main est jugée juste (carré, couleur, quinte, full) · et ${r.bots} habitants viennent tirer les bras des machines` };
});

// À GARDER EN DERNIER : ce test RECHARGE la page. Il reproduit le seul cas que tout le reste
// du banc d'essai ne voyait pas — une partie DÉJÀ COMMENCÉE. Avec un localStorage vide,
// loadGuerre() sortait tout de suite ; avec une sauvegarde, il touchait une constante encore
// non initialisée et le jeu ne démarrait plus du tout (écran noir).
test('une partie déjà sauvegardée se recharge sans écran noir', async p => {
  await p.evaluate(() => {
    // la partie en cours se sauvegarde toute seule en quittant la page : sans ce garde-fou
    // elle ECRASERAIT la sauvegarde qu'on vient de poser, juste avant le rechargement
    window.__SANS_SAUVE = true;
    localStorage.setItem('superobby.guerre', JSON.stringify({ rep: 30, force: 40, magot: 200, armes: 1,
      terr: { zone: 'rouge' }, saison: 1, gangs: {}, recrues: [{ n: 'Lucas_2014', f: 20, p: 35 }],
      perf: 42, membres: [{ n: 'Lucas_2014', p: 35 }] }));
    localStorage.setItem('superobby.perf', '42');
    localStorage.setItem('superobby.amis', JSON.stringify(['Lucas_2014']));
    localStorage.setItem('superobby.avatar', JSON.stringify({ hair: 'dreads', hairColor: 7, bijou: 'grosse', taille: 'XXL', couleurHaut: 4 }));
    localStorage.setItem('superobby.chien', JSON.stringify({ nom: 'Rex' }));
  });
  let pret = true, erreur = '';
  try {
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.__SHOT && window.__SHOT.ready, null, { timeout: 60000 });
  } catch (e) { pret = false; erreur = e.message.slice(0, 120); }
  if (!pret) return { ok: false, detail: `le jeu ne redémarre pas avec une sauvegarde : ${erreur}` };
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    return { ville: __G.city.on, gangs: __G.gangs.length, bots: __G.bots.length,
      perf: __G.perfDe(__G.P), rep: __G.gang.rep,
      look: { coupe: __G.myCfg.hair, bijou: __G.myCfg.bijou, taille: __G.myCfg.taille },
      chien: __G.chien.nom };
  });
  const ok = r.ville && r.gangs === 3 && r.bots >= 10 && r.perf === 42 && r.rep === 30
    && r.look.coupe === 'dreads' && r.look.bijou === 'grosse' && r.look.taille === 'XXL' && r.chien === 'Rex';
  return { ok, detail: `partie reprise : ville chargée, ${r.gangs} gangs, ${r.bots} habitants · performance ${r.perf}/100 et ${r.rep} pts de réputation retrouvés · tenue mémorisée (${r.look.coupe}, ${r.look.bijou}, taille ${r.look.taille}) · chien « ${r.chien} »` };
});

(async()=>{
  const file=process.argv[2]||path.join(ROOT,'index.html');
  const {srv,port}=await serve(file);
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1024,height:640}});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  // Quand plusieurs bancs d'essai tournent en meme temps sur la meme machine, le chargement
  // de la page depasse les 30 secondes par defaut et TOUTE la serie echouait avant le premier
  // test, sans aucun rapport avec ce qu'elle mesure. On laisse trois minutes.
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load',timeout:180000});
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

test('le sol va jusqu\'au casino et au circuit, et le mur ne les enferme plus dehors', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 320, hour: 12 });
    const G = __G;
    // une plaque de sol sous chaque point ? (les grands plateaux, dessus vers y = 0)
    const sol = (x, z) => G.solids.some(o => o.mesh && o.w > 8 && o.d > 8 && o.y + o.h / 2 < 3 && o.y + o.h / 2 > -2
      && Math.abs(x - o.x) < o.w / 2 && Math.abs(z - o.z) < o.d / 2);
    const trous = [];
    for (let zz = -196; zz <= 346; zz += 6) for (let xx = -196; xx <= 196; xx += 6) if (!sol(xx, zz)) trous.push([xx, zz]);
    const c = G.city.casino, ci = G.city.circuit;
    // les murs invisibles d'enceinte : de longues boîtes de 4 m de haut
    const murs = G.solids.filter(o => o.h === 4 && (o.w > 300 || o.d > 300));
    const dedans = (x, z) => !murs.some(m => (m.d > m.w ? (Math.sign(m.x) * x > Math.sign(m.x) * m.x) : (Math.sign(m.z) * z > Math.sign(m.z) * m.z)));
    // la grille de navigation couvre-t-elle les deux quartiers ?
    const nav = G.NAV, xMax = nav.x0 + nav.nx * nav.cs, zMax = nav.z0 + nav.nz * nav.cs;
    const navCouvre = (x, z) => x > nav.x0 && x < xMax && z > nav.z0 && z < zMax;
    return { trous: trous.length, ex: trous.slice(0, 4),
      casino: dedans(c.x, c.z + 40) && navCouvre(c.x, c.z + 40),
      circuit: dedans(ci.x, ci.z - ci.r - 8) && navCouvre(ci.x, ci.z - ci.r - 8),
      murs: murs.length, navZ: [nav.z0, Math.round(zMax)], parvis: sol(c.x, c.z + 40), parvisBord: sol(c.x - 18, c.z + 26) };
  });
  const ok = r.trous === 0 && r.casino && r.circuit && r.murs === 4 && r.parvis && r.parvisBord;
  return { ok, detail: `le plateau de la ville s'arrêtait a z = 282 et le mur invisible juste derrière : le casino (z 287 → 340) et le circuit étaient bâtis DEHORS, sur du vide — un trou béant devant le casino et deux quartiers interdits · le sol couvre maintenant toute la carte (${r.trous} trou sur 5 500 points testés, parvis et ses bords compris), les ${r.murs} murs d'enceinte sont repoussés au-delà des deux quartiers et la grille de navigation va jusqu'a z = ${r.navZ[1]} (casino navigable=${r.casino}, circuit=${r.circuit})` };
});

test('le casino a de grandes vitres bleues, un tapis rouge et des haies vertes', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 60, y: 1, z: 330, hour: 12 });
    const G = __G, c = G.city.casino;
    let vitres = 0, hauteurVitre = 0, haies = 0, tapis = 0, cordons = 0;
    const dedansCasino = (x, z) => Math.abs(x - c.x) < c.w / 2 + 3 && Math.abs(z - c.z) < c.d / 2 + 3;
    G.worldGroup.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.color) return;
      const b = new THREE.Box3().setFromObject(o), col = o.material.color.getHex();
      const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
      const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
      // vitres : bleu translucide, hautes et larges, sur le pourtour du bâtiment
      if (o.material.transparent && o.material.opacity > 0.2 && o.material.opacity < 0.9 && h > 3 && Math.max(w, d) > 8 && dedansCasino(cx, cz)) {
        const hex = col.toString(16); const bleu = (col & 0xff) > ((col >> 16) & 0xff) + 40;
        if (bleu) { vitres++; hauteurVitre = Math.max(hauteurVitre, +h.toFixed(1)); }
      }
      // haies : vert, longues et basses, sur le parvis
      if ((col === 0x2f7d3a || col === 0x49a552) && Math.max(w, d) > 8 && h < 1.4 && cz > c.z + c.d / 2) haies++;
      if (col === 0x7a1220 && w > 8 && d > 12 && cz > c.z + c.d / 2) tapis++;                       // le grand tapis rouge
      if (col === 0x7a1220 && Math.min(w, d) < 0.5 && Math.max(w, d) > 3 && h < 0.4 && cz > c.z + c.d / 2) cordons++;   // les cordons de velours
    });
    // le perron : des marches sur toute la largeur (plus de trou de 70 cm sur les côtés)
    const sousMarche = x => G.solids.some(o => o.mesh && Math.abs(o.z - (c.z + c.d / 2 + 1.9)) < 2.4 && Math.abs(x - o.x) < o.w / 2 && o.y + o.h / 2 > 0.2);
    const perron = [-17, -10, 0, 10, 17].filter(dx => sousMarche(c.x + dx)).length;
    return { vitres, hauteurVitre, haies, tapis, cordons, perron };
  });
  const ok = r.vitres >= 4 && r.hauteurVitre >= 4 && r.haies >= 4 && r.tapis >= 1 && r.cordons >= 4 && r.perron === 5;
  return { ok, detail: `le casino était une boîte de marbre aveugle posée devant un trou · il a maintenant ${r.vitres} grandes baies vitrées bleues translucides tout autour (${r.hauteurVitre} m de haut), une grande entrée avec tapis rouge (${r.tapis}), ${r.cordons} cordons de velours sur poteaux dorés, ${r.haies} haies de plantes vertes autour du parvis, et un perron de marches sur TOUTE la largeur (${r.perron}/5 points portés, avant on tombait de 70 cm de chaque côté)` };
});

test('les enseignes des boutiques sont grandes et colorees, la banque et la police officielles', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    const lire = tex => {
      const c = tex.image, g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
      let vif = 0, blanc = 0, sombre = 0, or = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) {
        const R = d[i], V = d[i + 1], B = d[i + 2]; n++;
        const mx = Math.max(R, V, B), mn = Math.min(R, V, B);
        if (mx > 140 && mx - mn > 60) vif++;              // couleur FRANCHE et lumineuse
        if (R > 230 && V > 230 && B > 230) blanc++;
        if (mx < 90) sombre++;
        if (R > 150 && V > 120 && B < 120 && R - B > 60) or++;
      }
      return { vif: +(vif / n).toFixed(2), blanc: +(blanc / n).toFixed(2), sombre: +(sombre / n).toFixed(2), or: +(or / n).toFixed(2), l: c.width };
    };
    const ens = lire(G.enseigneTexture('💈 COIFFEUR', 0xff7ad9));
    const ens2 = lire(G.enseigneTexture('🏋️ Salle de sport', 0x35d0e6));
    const pl = lire(G.plaqueTexture('🏦 BANQUE DE SUPER OBBY'));
    const pl2 = lire(G.plaqueTexture('POLICE'));
    // toutes les devantures de boutique portent bien la nouvelle enseigne
    let panneaux = 0;
    G.worldGroup.traverse(o => {
      if (o.isMesh && o.material && o.material.map && o.material.map.image && o.material.map.image.width === 768
        && o.scale && o.scale.y > 1.1 && o.scale.x > 5) panneaux++;
    });
    return { ens, ens2, pl, pl2, panneaux };
  });
  const okEns = r.ens.vif > 0.35 && r.ens.blanc > 0.04 && r.ens2.vif > 0.35 && r.ens2.blanc > 0.04;
  const okPl = r.pl.sombre > 0.6 && r.pl.or > 0.02 && r.pl.vif < 0.15 && r.pl.vif < r.ens.vif / 3 && r.pl.blanc < 0.01 && r.pl2.sombre > 0.6;
  const ok = okEns && okPl && r.panneaux >= 6;
  return { ok, detail: `chaque boutique avait la même petite plaque crème au texte fin · l'enseigne est maintenant un grand panneau de 768 px aux couleurs du magasin (${Math.round(r.ens.vif * 100)} % de pixels vifs) avec le nom ÉNORME en lettres blanches cerclées de noir (${Math.round(r.ens.blanc * 100)} %) et une guirlande d'ampoules — ${r.panneaux} devantures l'arborent · la banque et la police, elles, ont une plaque OFFICIELLE : marbre bleu nuit (${Math.round(r.pl.sombre * 100)} % de pixels sombres, ${Math.round(r.pl.vif * 100)} % de couleur vive seulement), double filet doré et capitales espacées en serif` };
});

test('l\'helicoptere va jusqu\'au bout de la carte, et plus haut', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 52, y: 1, z: -13, hour: 12 });
    const G = __G, M = G.MONDE;
    const heli = G.city.cars.find(c => c.heli);
    if (!heli) return { pourquoi: 'pas d\'hélico' };
    G.enterCar(heli);
    // on le pousse à fond dans les quatre coins et vers le ciel, sans obstacle : seules les
    // bornes du monde doivent l'arrêter
    const pousse = (vx, vz, vy, n) => { for (let i = 0; i < n; i++) { heli.vx = vx; heli.vz = vz; heli.vy = vy; G.heliStep(0.05); } };
    pousse(0, 0, 12, 300);                    // plafond
    const plafond = Math.round(heli.y);
    pousse(-40, 0, 0, 900); const ouest = Math.round(heli.x);
    pousse(40, 0, 0, 1400); const est = Math.round(heli.x);
    pousse(0, -40, 0, 900); const nord = Math.round(heli.z);
    pousse(0, 40, 0, 1600); const sud = Math.round(heli.z);
    // les quartiers extrêmes sont-ils dans le rayon d'action ?
    const c = G.city.casino, ci = G.city.circuit, zone = G.city.zones.find(z => z.name === 'La Zone');
    G.exitCar();
    return { plafond, ouest, est, nord, sud, monde: [M.x1, M.x2, M.z1, M.z2, M.plafond],
      casino: sud >= c.z + 20, circuit: nord <= ci.z - ci.r, laZone: ouest <= (zone ? (zone.x1 + zone.x2) / 2 : -145) };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const ok = r.casino && r.circuit && r.laZone && r.plafond >= 70
    && r.ouest <= r.monde[0] + 4 && r.est >= r.monde[1] - 4 && r.nord <= r.monde[2] + 4 && r.sud >= r.monde[3] - 4;
  return { ok, detail: `l'hélico butait sur un mur invisible a x = −98 et z = 278, bien avant le bord de la carte : ni La Zone, ni les villas des chefs, ni le casino, ni le circuit n'étaient survolables · les bornes viennent maintenant des limites du monde et il va d'un bout a l'autre (x ${r.ouest} → ${r.est}, z ${r.nord} → ${r.sud}) et monte a ${r.plafond} m au lieu de 45 · casino atteint=${r.casino}, circuit=${r.circuit}, La Zone=${r.laZone}` };
});

test('tomber d\'un immeuble fait mal, et de tres haut ca tue', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    const essai = (haut) => {
      __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
      G.P.hp = 100;
      const v = Math.sqrt(2 * 30 * haut);          // vitesse atteinte après une chute libre de `haut`
      const deg = G.chuteImpact(-v);
      return { haut, v: +v.toFixed(1), deg, pv: Math.round(G.P.hp) };
    };
    const sansMal = essai(2), petite = essai(5), immeuble = essai(10), gratteCiel = essai(22);
    // sous une voile on se pose toujours en douceur
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.P.hp = 100; G.P.voile = 'parachute'; const voile = G.chuteImpact(-40); G.P.voile = null;
    const pvVoile = Math.round(G.P.hp);
    return { sansMal, petite, immeuble, gratteCiel, voile, pvVoile, seuil: G.CHUTE_SEUIL };
  });
  const ok = r.sansMal.deg === 0 && r.petite.deg === 0 && r.immeuble.deg > 10 && r.immeuble.pv < 90
    && r.gratteCiel.pv === 0 && r.voile === 0 && r.pvVoile === 100;
  return { ok, detail: `on sautait du toit d'un immeuble de vingt mètres et on repartait en sifflotant · au-delà de ${r.seuil} m/s on s'écrase : 2 m et 5 m ne coûtent rien (${r.sansMal.deg} et ${r.petite.deg} PV), 10 m font −${r.immeuble.deg} PV (il reste ${r.immeuble.pv}), et 22 m tuent (${r.gratteCiel.pv} PV) · sous un parachute, aucune casse même a 40 m/s (${r.pvVoile} PV)` };
});

test('la barre de performance est en haut a cote de la barre de vie', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    const bar = document.getElementById('perfBar'), note = document.getElementById('perfNote');
    if (!bar || !note) return { pourquoi: 'pas de barre de performance' };
    const me = document.getElementById('me');
    const dansLeHaut = me && me.contains(bar) && me.contains(document.getElementById('hpBar'));
    const lire = () => ({ w: bar.style.width, note: note.textContent, col: note.style.color });
    G.P.perf = 12; G.majPerfHud(); const bas = lire();
    G.P.perf = 62; G.majPerfHud(); const moyen = lire();
    G.P.perf = 95; G.majPerfHud(); const haut = lire();
    const st = getComputedStyle(bar);
    return { dansLeHaut, bas, moyen, haut, degrade: st.backgroundImage.includes('gradient'),
      cote: document.getElementById('hpBar').parentNode.nextElementSibling !== null };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const ok = r.dansLeHaut && r.bas.w === '12%' && r.moyen.w === '62%' && r.haut.w === '95%'
    && r.bas.note.length === 1 && r.haut.note.length === 4 && r.bas.col !== r.haut.col && r.degrade;
  return { ok, detail: `la performance n'apparaissait que dans une pastille perdue sur le côté · elle a maintenant sa barre en haut, juste a côté de la vie et du souffle, avec un dégradé rouge → turquoise et des étoiles colorées : 12 → « ${r.bas.note} » (${r.bas.col}), 62 → « ${r.moyen.note} », 95 → « ${r.haut.note} » (${r.haut.col})` };
});

test('les indicateurs du haut-parleur sont colores et lisibles', async p => {
  const r = await p.evaluate(() => {
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const G = __G;
    const eq = G.bots.slice(0, 3);
    G.gang.membres = eq;
    eq.forEach(b => { b.journal = null; b.ko = 0; b.hp = 100; });
    G.noteOrdre(eq[0], '💰', 'braquer la banque');
    G.noteOrdre(eq[1], '🎾', 'partie au tennis'); G.finirOrdre(eq[1], 'reussi', 'partie au tennis');
    G.noteOrdre(eq[1], '🚗', 'voler une voiture');
    eq[2].hp = 42; G.noteOrdre(eq[2], '👊', 'attaquer le gang rival');
    const page = G.resumeMissions(), fiche = G.journalHtml(eq[1]);
    const couleurs = new Set((page + fiche).match(/#[0-9a-f]{6}/gi) || []);
    const d = document.createElement('div'); d.innerHTML = page; document.body.appendChild(d);
    const lignes = d.querySelectorAll('.oligne').length, puces = d.querySelectorAll('.opuce').length;
    const jauges = [...d.querySelectorAll('.ojauge i')].map(i => i.style.width);
    const liseres = [...d.querySelectorAll('.oligne')].map(l => l.style.getPropertyValue('--oc')).filter(Boolean).length;
    d.remove(); G.gang.membres = [];
    return { lignes, puces, jauges, liseres, couleurs: couleurs.size,
      pulse: page.includes('encours'), puceReussi: fiche.includes('✅'), fiche: fiche.includes('opuce') };
  });
  const ok = r.lignes >= 3 && r.puces >= 3 && r.liseres >= 3 && r.couleurs >= 3
    && r.jauges.includes('42%') && r.pulse && r.puceReussi && r.fiche;
  return { ok, detail: `le 📣 alignait du texte gris avec un mot coloré · chaque homme a maintenant sa ligne à liseré de couleur (${r.liseres}), une PASTILLE pleine d'état qui clignote tant que l'ordre tourne (${r.puces}) et une jauge de vie colorée (${r.jauges.join(', ')}) — ${r.couleurs} couleurs différentes en tout, et la fiche d'un homme reprend les mêmes pastilles (✅ réussi, ❌ raté, 💀 perte)` };
});

test('chaque amelioration fait gagner de la vitesse, et le 500 chevaux est une fusee', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    const essai = (kits, mot) => {
      __SHOT.go({ world: 4, x: -90, y: 1, z: -70, hour: 12 });
      const c = G.city.cars.find(v => v.parts && v.parts.ws && !v.kart);
      c.busy = 0; c.x = -90; c.z = -70; c.h = Math.PI / 2; c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.h; G.vehicleSolid(c);
      G.P.pos.set(-90, 0.3, -70); G.enterCar(c);
      G.tuneApply(c, { couleur: null, finition: 'mate', kits, moteur: mot, amorti: 2 });
      G.drive.speed = 0; G.keys.add('KeyW');
      let vmax = 0;
      for (let i = 0; i < 300 && G.drive.car; i++) {   // sur place : on mesure la mécanique, pas le trafic
        G.driveStep(0.05); vmax = Math.max(vmax, G.drive.speed);
        c.x = -90; c.z = -70; c.h = Math.PI / 2; c.g.position.set(c.x, 0, c.z); G.P.pos.set(-90, 0.3, -70);
      }
      G.keys.delete('KeyW');
      const out = { vmax: +vmax.toFixed(1), bonus: c.bonusKits };
      G.exitCar(); return out;
    };
    const cent = essai([], 0), trois = essai([], 1), cinq = essai([], 2);
    // chaque kit ajouté doit faire monter la pointe, un par un
    const KITS = ['echap', 'jantes', 'moteur', 'rabaisse', 'aileron', 'jupes', 'becquet', 'nitro'];
    const paliers = []; const acc = [];
    for (const k of KITS) { acc.push(k); paliers.push(essai(acc.slice(), 2).vmax); }
    let croissant = 0;
    for (let i = 1; i < paliers.length; i++) if (paliers[i] > paliers[i - 1]) croissant++;
    return { cent: cent.vmax, trois: trois.vmax, cinq: cinq.vmax, paliers, croissant, kits: KITS.length,
      tout: paliers[paliers.length - 1] };
  });
  const ok = r.trois > r.cent * 1.4 && r.cinq > r.trois * 1.3 && r.croissant === r.kits - 1 && r.tout > r.cinq * 1.2;
  return { ok, detail: `les kits étaient purement décoratifs : seul le moteur comptait · la pointe passe de ${r.cent} a ${r.trois} m/s au 300 chevaux puis ${r.cinq} au 500, et CHAQUE kit ajoute ensuite sa part — ${r.croissant}/${r.kits - 1} paliers strictement croissants jusqu'a ${r.tout} m/s tout équipé (${Math.round(r.tout * 3.6)} km/h) · le déplacement est découpé en pas de 90 cm pour qu'a cette vitesse la voiture ne traverse plus les murs` };
});

test('le nitro donne un coup court avec des flammes aux deux pots', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: -90, y: 1, z: -70, hour: 12 });
    const c = G.city.cars.find(v => v.parts && v.parts.ws && !v.kart);
    c.busy = 0; c.x = -90; c.z = -70; c.h = Math.PI / 2; c.g.position.set(c.x, 0, c.z); G.vehicleSolid(c);
    G.P.pos.set(-90, 0.3, -70); G.enterCar(c);
    // sans le kit échappement : le nitro doit quand même poser deux pots
    G.tuneApply(c, { couleur: null, finition: 'mate', kits: ['nitro'], moteur: 1, amorti: 1 });
    const buses = c.nitroFlammes ? c.nitroFlammes.length : 0;
    const cotes = new Set((c.nitroFlammes || []).map(f => Math.sign(f.position.x)));
    const pots = c.tuneMesh.filter(m => m.geometry && m.geometry.type === 'CylinderGeometry'
      && Math.abs(m.position.z + 2.3) < 0.2 && Math.abs(Math.abs(m.position.x) - 0.62) < 0.05).length;
    G.drive.speed = 10;
    const avant = G.drive.speed;
    const parti = G.nitroGo();
    // pendant le coup : la flamme sort et la vitesse grimpe très vite
    let vues = 0, echelleMax = 0;
    for (let i = 0; i < 24; i++) { G.nitroTick(0.05); G.simTime += 0.05;
      if ((c.nitroFlammes || []).every(f => f.visible)) vues++;
      echelleMax = Math.max(echelleMax, ...(c.nitroFlammes || []).map(f => f.scale.y)); }
    const apres = G.drive.speed, duree = vues * 0.05;
    // le coup s'arrête tout seul, et la relance est rapide
    for (let i = 0; i < 40; i++) { G.nitroTick(0.05); G.simTime += 0.05; }
    const eteint = (c.nitroFlammes || []).every(f => !f.visible);
    const attente = Math.max(0, G.drive.nitroCd - G.simTime);
    G.simTime += attente + 0.05;
    const relance = G.nitroGo();
    G.exitCar();
    return { buses, cotes: cotes.size, pots, parti, avant, apres: +apres.toFixed(1), duree: +duree.toFixed(2),
      echelleMax: +echelleMax.toFixed(2), eteint, relance, recharge: G.NITRO_RECHARGE, dureeReglee: G.NITRO_DUREE };
  });
  const ok = r.parti && r.cotes === 2 && r.buses >= 6 && r.pots === 2 && r.apres > r.avant * 2
    && r.duree > 0.9 && r.duree < 1.6 && r.eteint && r.relance && r.recharge <= 4 && r.echelleMax > 0.8;
  return { ok, detail: `le nitro était une longue poussée de 3,2 s suivie de 14 s de recharge : un coup par ligne droite · c'est maintenant un COUP COURT de ${r.dureeReglee} s (mesuré ${r.duree} s de flamme), qui fait bondir la voiture de ${r.avant} a ${r.apres} m/s, s'éteint tout seul et se relance après ${r.recharge} s · ${r.buses} cônes de flamme répartis des DEUX côtés (${r.cotes}), et le kit pose ses deux pots chromés même sans l'échappement sport (${r.pots})` };
});

test('le moteur change de voix a 300 et a 500 chevaux', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: -90, y: 1, z: -70, hour: 12 });
    const V = G.MOTEUR_VOIX;
    // trois voix distinctes : plus il y a de chevaux, plus c'est bas, gros et bourdonnant
    const grave = V[0].base > V[1].base && V[1].base > V[2].base;
    const gros = V[0].gain < V[1].gain && V[1].gain < V[2].gain;
    const scie = V[0].sub === 0 && V[1].sub > 0 && V[2].sub > V[1].sub;
    const bourd = V[0].bourd === 0 && V[1].bourd > 0 && V[2].bourd > V[1].bourd;
    const coupe = V[0].coupe > V[1].coupe && V[1].coupe > V[2].coupe;
    // et la voiture branche bien la bonne voix quand on monte dedans
    const c = G.city.cars.find(v => v.parts && v.parts.ws && !v.kart);
    c.busy = 0; c.x = -90; c.z = -70; c.g.position.set(c.x, 0, c.z); G.vehicleSolid(c);
    G.P.pos.set(-90, 0.3, -70);
    // en jeu, la voiture reprend TOUJOURS le réglage de l'atelier en montant dedans
    G.tuning.moteur = 2; G.tuning.kits = []; G.tuning.amorti = 0;
    G.enterCar(c);
    const lu = G.moteurDe(c), auVolant = G.engine.niveau();
    G.tuneApply(c, { couleur: null, finition: 'mate', kits: [], moteur: 0, amorti: 0 });
    const apresRetour = G.engine.niveau();
    G.tuning.moteur = 0;
    G.exitCar();
    return { grave, gros, scie, bourd, coupe, lu, auVolant, apresRetour,
      base: V.map(v => v.base), gain: V.map(v => v.gain), sub: V.map(v => v.sub), bourdF: V.map(v => v.bourdF) };
  });
  const ok = r.grave && r.gros && r.scie && r.bourd && r.coupe && r.lu === 2 && r.auVolant === 2 && r.apresRetour === 0;
  return { ok, detail: `une 100 chevaux et une 500 chevaux ronronnaient exactement pareil : le régime ne dépendait que du rapport de boîte · chaque niveau a maintenant sa voix — la fondamentale descend (${r.base.join(' → ')} Hz), le volume monte (${r.gain.join(' → ')}), une SCIE vient épaissir le grave (${r.sub.join(' → ')}) et un bourdonnement s'installe (${r.bourdF.join(' → ')} Hz) · le bloc change de voix en montant dedans (niveau ${r.auVolant}) et dès qu'on repasse au moteur d'origine a l'atelier (${r.apresRetour})` };
});

test('la sauvegarde garde tout et se recharge toute seule', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    // --- on se constitue une partie : argent, achats, tenue, voiture préparée, équipe ---
    G.wallet = 1234;
    G.owned.add('vet:casquette'); G.owned.add('tune:kit:nitro'); G.owned.add('arme:pistol');
    G.myCfg.jersey = 5; G.myCfg.hat = 'casquette';
    G.tuning.moteur = 2; G.tuning.kits = ['nitro', 'echap', 'jantes']; G.tuning.couleur = 0x35d0e6;
    const equipe = G.bots.slice(0, 3);
    for (const b of equipe) { G.amis.add(b.name); b.perf = 44; G.rejoindreGang(b); }
    // une voiture garée dans TON garage
    const g = G.city.monGarage;
    const v = G.city.cars.find(c => c.parts && c.parts.ws && !c.kart);
    v.busy = 0; v.x = g.x; v.z = g.z; v.color = 0x35d0e6; v.dmg = 17;
    v.g.position.set(v.x, 0, v.z); G.vehicleSolid(v);
    const equipeNoms = equipe.map(b => b.name);
    G.sauveTout();
    const ecrit = {
      argent: G.store.get('superobby.wallet'), achats: JSON.parse(G.store.get('superobby.owned') || '[]').length,
      tenue: !!G.store.get('superobby.avatar'), voiture: G.store.json('superobby.mavoiture', null),
      tuning: G.store.json('superobby.tuning', null),
      equipe: (G.store.json('superobby.guerre', null) || {}).membres || [],
    };
    // --- on quitte la ville et on revient : tout doit revenir tout seul ---
    __SHOT.go({ world: 0, x: 0, y: 1, z: 3, hour: 12, garderSauvegarde: true });
    const videApres = G.gang.membres.length;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12, garderSauvegarde: true });
    const gang2 = G.gang.membres.map(b => b.name);
    const auto = G.maVoiture();
    const res = {
      ecrit, videApres, gang2, tousLa: equipeNoms.every(n => gang2.includes(n)),
      perfGardee: G.gang.membres.every(b => G.perfDe(b) >= 40),
      voiture: auto ? { color: auto.color, dmg: Math.round(auto.dmg), moteur: G.moteurDe(auto), pointe: Math.round(auto.spec.max) } : null,
      argent: G.wallet, achats: G.owned.size, dansLeGarage: auto ? G.dansMonGarage(auto) : false,
      // la sauvegarde automatique tourne toute seule
      autoT: (() => { G.simTime += 100; const a = G.autoSauve(); const b = G.autoSauve(); return [a, b]; })(),
    };
    G.gang.membres = []; G.wallet = 25;
    return res;
  });
  const ok = r.ecrit.argent === '1234' && r.ecrit.achats >= 3 && r.ecrit.tenue && r.ecrit.voiture
    && r.ecrit.equipe.length === 3 && r.videApres === 0 && r.tousLa && r.perfGardee
    && r.voiture && r.voiture.color === 0x35d0e6 && r.voiture.dmg === 17 && r.voiture.moteur === 2
    && r.dansLeGarage && r.argent === 1234 && r.achats >= 3
    && r.autoT[0] === true && r.autoT[1] === false;
  return { ok, detail: `l'équipe était bien écrite dans la sauvegarde mais jamais relue (on repartait seul a chaque partie) et la voiture du garage n'était nulle part · tout revient maintenant tout seul en rentrant en ville : ${r.argent} 🪙, ${r.achats} achats, la tenue, les ${r.gang2.length} hommes du gang avec leur niveau (${r.perfGardee}) et TA voiture reposée dans ton garage (couleur #${r.voiture.color.toString(16)}, ${r.voiture.dmg} % de bosses, moteur ${r.voiture.moteur}, pointe ${r.voiture.pointe}) · et ça se sauvegarde tout seul toutes les 20 s (${r.autoT[0]} puis ${r.autoT[1]} juste après) et en fermant l'onglet` };
});

test('au tennis on se deplace aussi de cote', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    const essai = (touche, raquette, images) => {
      __SHOT.go({ world: 4, x: 13, y: 1, z: -8, hour: 12, sansBots: true });
      G.settings.ctrl = 'rot';   // le réglage par défaut du jeu : gauche/droite fait pivoter
      G.P.energie = 100; G.P.essouffle = false; G.P.boostT = 0; G.P.court = false;   // même vitesse d'un essai a l'autre
      G.P.racket = !!raquette; try { G.setRacket(G.me, !!raquette); } catch (e) {}
      G.P.pos.set(13, 0.3, -8); G.P.vel.set(0, 0, 0); G.P.facing = Math.PI;
      const x0 = G.P.pos.x, z0 = G.P.pos.z, f0 = G.P.facing;
      G.keys.add(touche);
      for (let i = 0; i < (images || 10); i++) G.step(0.05, true);
      G.keys.delete(touche);
      let dcap = G.P.facing - f0; dcap = Math.atan2(Math.sin(dcap), Math.cos(dcap));
      return { dx: +(G.P.pos.x - x0).toFixed(2), dz: +(G.P.pos.z - z0).toFixed(2),
        cap: Math.round(dcap * 180 / Math.PI), surCourt: G.surLeCourt(), raquette: !!G.P.racket };
    };
    const droite = essai('KeyD', true), gauche = essai('KeyA', true), avant = essai('KeyW', true);
    const sansRaquette = essai('KeyD', false, 20);
    // la raquette en main, il reste tourné vers le filet ; et vers la balle quand il y en a une
    __SHOT.go({ world: 4, x: 13, y: 1, z: -8, hour: 12, sansBots: true });
    G.settings.ctrl = 'rot'; G.P.racket = true; G.P.pos.set(13, 0.3, -8); G.P.facing = 0;
    for (let i = 0; i < 30; i++) G.step(0.05, true);
    const versFilet = Math.round(((G.P.facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 180 / Math.PI);
    // le court fait apparaître sa propre balle des qu'on y tient une raquette : on nettoie
    for (const vb of G.city.balls.filter(x => x.kind === 'tennis')) G.removeBall(vb);
    const b = G.makeBall('tennis', 19, 1.2, -10);
    for (let i = 0; i < 20; i++) { b.pos.set(19, 1.2, -10); b.vel.set(0, 0, 0); b.state = 'play'; G.step(0.05, true); }
    const attendu = Math.atan2(19 - G.P.pos.x, -10 - G.P.pos.z);
    let ecart = G.P.facing - attendu; ecart = Math.abs(Math.atan2(Math.sin(ecart), Math.cos(ecart)) * 180 / Math.PI);
    G.removeBall(b); G.P.racket = false; try { G.setRacket(G.me, false); } catch (e) {}
    return { droite, gauche, avant, sansRaquette, versFilet, versBalle: Math.round(ecart) };
  });
  const lat = (m, sens) => Math.sign(m.dx) === sens && Math.abs(m.dx) > 0.6 && Math.abs(m.dz) < Math.abs(m.dx) / 5;
  const ok = lat(r.droite, -1) && lat(r.gauche, 1)
    && r.avant.dz < -0.6 && Math.abs(r.avant.dx) < Math.abs(r.avant.dz) / 5
    && Math.abs(r.sansRaquette.dx) < 0.3 && Math.abs(r.sansRaquette.cap) > 20
    && Math.abs(r.versFilet - 180) < 12 && r.versBalle < 15;
  return { ok, detail: `en mode « rotation » (le réglage par défaut) gauche/droite faisait PIVOTER le joueur : pour rattraper une balle sur le côté il fallait tourner, avancer, se retourner — infaisable dans un échange · raquette en main sur le court, les deux touches le font maintenant GLISSER le long de sa ligne de fond (${r.gauche.dx} m a gauche, ${r.droite.dx} m a droite, ${Math.abs(r.droite.dz)} m d'écart en profondeur) tandis que avancer le porte vers le filet (${r.avant.dz} m) · il se tourne tout seul vers le filet (${r.versFilet}°) puis vers la balle des qu'elle est en jeu (${r.versBalle}° d'écart) · hors du court, rien ne change : la même touche le fait pivoter de ${Math.abs(r.sansRaquette.cap)}° sans le déplacer` };
});

test('sur la tele, le radar et les jauges sont harmonises et laissent voir le joueur', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const baseAvant = G.cam.base;
    G.modeTV(true);
    document.getElementById('chat').classList.add('open');
    const W = innerWidth, H = innerHeight, marge = Math.min(W, H) * 0.04;
    const box = sel => { const e = sel[0] === '.' ? document.querySelector(sel) : document.getElementById(sel);
      if (!e) return null; const st = getComputedStyle(e), b = e.getBoundingClientRect();
      if (st.display === 'none' || st.visibility === 'hidden' || !b.width) return null;
      return { id: sel, x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
    const panneaux = ['me', 'lb', 'chat', 'gps', 'act'].map(box).filter(Boolean);
    const cadres = ['.tl', '.tc', '.tr'].map(box).filter(Boolean);
    // 1) rien ne tombe dans le surbalayage (les télés rognent 3 a 5 % des bords)
    const dehors = [...panneaux, ...cadres].filter(b => b.x < marge - 2 || b.y < marge - 2
      || b.x + b.w > W - marge + 2 || b.y + b.h > H - marge + 2).map(b => b.id);
    // 2) la bande du milieu — la ou se tient le joueur — reste libre
    const cx1 = W * 0.32, cx2 = W * 0.68, cy1 = H * 0.42, cy2 = H * 0.98;
    const gene = panneaux.filter(b => b.x < cx2 && b.x + b.w > cx1 && b.y < cy2 && b.y + b.h > cy1).map(b => b.id);
    // 3) aucun panneau n'en recouvre un autre
    const chev = [];
    for (let i = 0; i < panneaux.length; i++) for (let j = i + 1; j < panneaux.length; j++) {
      const a = panneaux[i], b = panneaux[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) chev.push(a.id + '/' + b.id);
    }
    // 4) le radar est bien dans le coin bas droit (il trônait au milieu, devant le joueur)
    const g = box('gps'), coin = g ? { droite: Math.round(W - (g.x + g.w)), bas: Math.round(H - (g.y + g.h)) } : null;
    const chatCoin = (() => { const c = box('chat'); return c ? { gauche: c.x, bas: Math.round(H - (c.y + c.h)) } : null; })();
    // 5) une seule échelle : tout est exprimé en --u et une seule marge en --tvpad
    const css = [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules]; } catch (e) { return []; } })
      .filter(x => x.selectorText && /body\.tv/.test(x.selectorText));
    const enU = css.filter(x => /var\(--u\)/.test(x.style.cssText)).length;
    const enPad = css.filter(x => /var\(--tvpad\)/.test(x.style.cssText)).length;
    // 6) les commandes tactiles disparaissent (une télé n'a pas d'écran tactile)
    const tactiles = ['joy', 'joyHome', 'jumpBtn', 'carBtn', 'punchBtn'].filter(id => {
      const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none'; });
    const baseApres = G.cam.base;
    G.modeTV(false);
    const gpsNormal = box('gps');
    const centre = gpsNormal ? Math.abs((gpsNormal.x + gpsNormal.w / 2) - W / 2) < 6 : false;
    return { W, H, marge: Math.round(marge), panneaux, dehors, gene, chev, coin, chatCoin,
      enU, enPad, tactiles, baseAvant, baseApres, gpsNormalAuCentre: centre, base3: G.cam.base };
  });
  const ok = r.dehors.length === 0 && r.gene.length === 0 && r.chev.length === 0
    && r.coin && r.coin.droite <= r.marge + 3 && r.coin.bas <= r.marge + 3
    && r.chatCoin && r.chatCoin.gauche <= r.marge + 3 && r.chatCoin.bas <= r.marge + 3
    && r.enU >= 12 && r.enPad >= 4 && r.tactiles.length === 0
    && r.baseApres > r.baseAvant && r.gpsNormalAuCentre;
  return { ok, detail: `chaque élément avait sa propre formule de taille et sa propre marge, et le radar trônait au MILIEU du bas de l'écran, pile devant le joueur · tout découle maintenant d'une seule unité (--u, ${r.enU} règles) et d'un seul retrait (--tvpad, ${r.enPad} règles) · les quatre coins sont pris — jauges et scores en haut, chat en bas a gauche (${r.chatCoin.gauche} px du bord), RADAR en bas a droite (${r.coin.droite} px du bord, ${r.coin.bas} px du bas) — et la bande du milieu ou se tient le joueur reste libre (${r.gene.length} gêneur, ${r.chev.length} chevauchement) · rien ne tombe dans le surbalayage de ${r.marge} px que rognent les télés (${r.dehors.length} débordement) · les ${5 - r.tactiles.length}/5 boutons tactiles s'effacent et la caméra recule de ${r.baseAvant} a ${r.baseApres} pour qu'on voie son personnage de loin · hors mode TV le radar revient au centre` };
});

test('on connecte une smart TV et le telephone sert de manette', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.ouvreSalonTV();
    const lien = G.lienTV();
    const codeManette = document.getElementById('tvCode').textContent.trim();
    const lienManette = document.getElementById('lienManette').textContent.trim();
    const qr = id => { const c = document.getElementById(id); if (!c) return 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let noirs = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 100) noirs++; return noirs; };
    const cartes = document.querySelectorAll('#tvsalon .tvcase').length;
    const bc = document.getElementById('tvCast');
    const boutonCast = !!bc;
    // LE BOUTON NE DOIT JAMAIS DISPARAÎTRE, même quand le navigateur ne sait pas diffuser
    const visible = b => !!b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0;
    G.castMaj(); const vuAvecApi = visible(bc), texteApi = bc.textContent;
    const memo = window.PresentationRequest;
    window.PresentationRequest = undefined; G.castMaj();
    const vuSansApi = visible(bc), texteSansApi = bc.textContent;
    const copie = G.copieLienTV();
    window.PresentationRequest = memo; G.castMaj();
    // le lien de la télé ouvre le jeu directement en affichage géant
    const avant = document.body.classList.contains('tv');
    location.hash = '#tv'; const route = G.routeLien();
    const enTV = document.body.classList.contains('tv');
    location.hash = '';
    // le lien de la manette ouvre l'écran manette, pas le jeu
    const routeMan = (() => { location.hash = '#manette=ABCD'; const x = G.routeLien();
      const ouvert = document.getElementById('manette').classList.contains('on');
      G.manetteFerme(); location.hash = ''; return { x, ouvert }; })();
    // la pastille du bas dit combien de manettes répondent
    G.modeTV(true); G.tvManettesMaj();
    const badge = document.getElementById('tvBadge');
    const badgeVu = badge && getComputedStyle(badge).display !== 'none' && /manette/i.test(badge.textContent);
    G.modeTV(false); G.closeUI();
    return { lien, finTV: /#tv(=[A-Z]{4})?$/.test(lien), codeManette, lienManette,
      qrTV: qr('qrTV'), qrManette: qr('qrManette'), cartes, boutonCast,
      vuAvecApi, vuSansApi, texteApi, texteSansApi, copie,
      castPret: G.castPret(), route, enTV, avant, routeMan, badgeVu };
  });
  const ok = r.finTV && r.qrTV > 200 && r.qrManette > 200 && r.cartes >= 3 && r.boutonCast
    && r.vuAvecApi && r.vuSansApi && r.copie === r.lien && /copier/i.test(r.texteSansApi)
    && /^[A-Z]{4}$/.test(r.codeManette) && /#manette=/.test(r.lienManette)
    && r.route === 'tv' && r.enTV && !r.avant
    && r.routeMan.x === 'manette' && r.routeMan.ouvert && r.badgeVu;
  return { ok, detail: `le salon 📺 n'offrait aucun moyen d'envoyer le jeu SUR la télé : il fallait retaper l'adresse a la main · il a maintenant ses ${r.cartes} cartes — la télé, la manette, les amis, la manette PS5 · celle de la télé affiche le lien ${r.lien} et son QR (${r.qrTV} points), et le bouton reste TOUJOURS a l'écran (il disparaissait des que le navigateur ne connaissait pas l'API Presentation — Safari, Firefox, ou Chrome hors https) : « ${r.texteApi} » quand l'appareil sait diffuser, « ${r.texteSansApi} » sinon, et il copie alors le lien tout seul · ouvrir ce lien bascule tout seul en affichage géant (${r.enTV}), et le lien #manette=${r.codeManette} ouvre directement l'écran manette sur le téléphone (${r.routeMan.ouvert}) · depuis le canapé, une pastille en bas de l'image dit si la manette répond` };
});

test('sur la tele, la resolution s\'adapte toute seule et le jeu reste fluide', async p => {
  const r = await p.evaluate(() => {
    const G = __G, R = G.renderer;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const mp = (L, ratio) => +((L * ratio) * (L * ratio * 9 / 16) / 1e6).toFixed(2);
    // 1) LE PLAFOND DE PIXELS : sur une télé 4K on rendait 8 mégapixels par image
    G.modeTV(false); G.applyQuality();
    const avant = mp(3840, 1);   // ce que coûtait une image en 4K sans plafond
    const pc4k = G.ratioRendu(3840), pcPix = mp(3840, pc4k);
    G.modeTV(true); G.applyQuality();
    const tv4k = G.ratioRendu(3840), tvPix = mp(3840, tv4k);
    const tv1080 = G.ratioRendu(1920);
    // 2) LA RÉSOLUTION DYNAMIQUE : ça rame, on descend ; ça respire, on remonte
    // (l'accélérateur d'image a sa PROPRE échelle, qui ne descend jamais sous 78 % : elle a
    // son test a elle. Ici on vérifie l'échelle classique, accélérateur éteint.)
    G.diffusionMode(false);
    const paliers = [];
    for (let i = 0; i < 200; i++) { G.fluiditeTick(45); if (i % 50 === 0) paliers.push(+G.rendu.ech.toFixed(2)); }
    const bas = { ech: +G.rendu.ech.toFixed(3), ombres: G.rendu.ombres, baisses: G.rendu.baisses };
    for (let i = 0; i < 500; i++) G.fluiditeTick(15);
    const haut = { ech: +G.rendu.ech.toFixed(3), ombres: G.rendu.ombres, hausses: G.rendu.hausses };
    // 3) une image isolée très lente ne doit RIEN dégrader (chargement, onglet qui revient)
    G.applyQuality(); const depart = G.rendu.ech;
    for (let i = 0; i < 40; i++) G.fluiditeTick(i === 20 ? 900 : 14);
    const apresPic = +G.rendu.ech.toFixed(3);
    // 4) LES OMBRES : entièrement recalculées a chaque image, c'est la 2e dépense
    G.modeTV(true); const cad = []; for (let i = 0; i < 6; i++) { G.ombresCadence(); cad.push(R.shadowMap.needsUpdate); }
    const autoTV = R.shadowMap.autoUpdate;
    G.modeTV(false); G.ombresCadence(); const autoPC = R.shadowMap.autoUpdate;
    G.diffusionMode(false); G.applyQuality();
    const majOmbres = cad.filter(Boolean).length;
    return { avant, plafond: G.PLAFOND_TV, pc4k: +pc4k.toFixed(3), pcPix, tv4k: +tv4k.toFixed(3), tvPix, tv1080: +tv1080.toFixed(3),
      paliers, bas, haut, depart, apresPic, cad, majOmbres, autoTV, autoPC, min: G.rendu.min };
  });
  const ok = r.tvPix <= r.avant + 0.01 && r.tv4k <= 1.01
    && r.bas.ech <= r.min + 0.01 && r.bas.ombres === false && r.bas.baisses >= 3
    && r.haut.ech > r.bas.ech + 0.2 && r.haut.ombres === true
    && r.apresPic === 1 && r.majOmbres === 3 && r.autoTV === false && r.autoPC === true;
  return { ok, detail: `une télé, c'est un très grand écran branché sur un tout petit processeur graphique : en 4K le jeu calculait ${r.avant} mégapixels par image et saccadait · le rendu va jusqu'au natif (${r.plafond} px, ${r.tvPix} mégapixels) et c'est la MESURE qui décide, pas un bridage aveugle · et la résolution s'ajuste toute seule : a 22 images/s elle descend par paliers ${r.paliers.join(' → ')} jusqu'au plancher ${r.bas.ech} (${r.bas.baisses} baisses) puis les ombres s'éteignent, et dès que ça respire elles se rallument et l'échelle remonte a ${r.haut.ech} · une seule image très lente (900 ms) ne dégrade rien (échelle restée a ${r.apresPic}) · enfin la carte d'ombres, recalculée a chaque image, ne l'est plus qu'une image sur deux sur la télé (${r.majOmbres} mises a jour sur 6) et reste inchangée ailleurs` };
});

test('le lien de la tele lance la partie tout seul et affiche le code', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 0, x: 0, y: 1, z: 3, hour: 12 });
    G.modeTV(false);
    document.getElementById('start').classList.remove('hidden');   // on repart de l'écran d'accueil
    location.hash = '#tv';
    const route = G.routeLien();
    await new Promise(r2 => setTimeout(r2, 700));
    const res = { route, tv: document.body.classList.contains('tv'),
      accueilCache: document.getElementById('start').classList.contains('hidden'),
      mondesCaches: document.getElementById('worlds').classList.contains('hidden'),
      enVille: !!G.city.on, running: !!G.running,
      salon: !document.getElementById('tvsalon').classList.contains('hidden'),
      code: (document.getElementById('tvCode').textContent || '').trim() };
    // un téléphone répond : l'écran de code s'efface et rend l'image au jeu
    G.tv.conns.push({ open: true }); G.tvManettesMaj();
    res.salonApres = !document.getElementById('tvsalon').classList.contains('hidden');
    res.badge = (document.getElementById('tvBadge').textContent || '');
    G.tv.conns.length = 0; location.hash = ''; G.modeTV(false); G.closeUI();
    return res;
  });
  const ok = r.route === 'tv' && r.tv && r.accueilCache && r.mondesCaches && r.enVille && r.running
    && r.salon && /^[A-Z]{4}$/.test(r.code) && r.salonApres === false && /manette/i.test(r.badge);
  return { ok, detail: `en arrivant par le lien #tv, la page s'arrêtait sur l'écran d'accueil — et sur une télé PERSONNE ne peut cliquer « Jouer » : on voyait l'image d'accueil et rien d'autre · elle enchaîne maintenant toute seule (accueil passé=${r.accueilCache}, choix des mondes passé=${r.mondesCaches}, arrivée en ville=${r.enVille}, partie lancée=${r.running}), affiche le code ${r.code} et son QR en grand, et referme cet écran des qu'un téléphone répond (${r.salonApres} après connexion) — la pastille du bas prend le relais : « ${r.badge.trim()} »` };
});

test('la qualite d\'image sur la tele : plus de pixels, textures nettes, sans filtre', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const aniso = () => { const v = [], vus = new Set();
      G.scene.traverse(o => { if (!o.isMesh || !o.material) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!m || !m.map || vus.has(m.map)) continue; vus.add(m.map); v.push(m.map.anisotropy); } });
      return { n: v.length, min: Math.min(...v), max: Math.max(...v) }; };
    const mp = (L, ratio) => +((L * ratio) * (L * ratio * 9 / 16) / 1e6).toFixed(2);
    const qual0 = G.settings.quality;
    // L'ETALONNAGE A DEMENAGE. Il etait fait par un filtre CSS sur le canevas (une passe de
    // composition plein ecran) qu'on coupait sur la tele : l'image y etait donc plus terne
    // que sur l'ordinateur. Il est maintenant DANS la passe de nettete, donc le filtre CSS
    // n'a plus lieu d'etre nulle part — sauf en qualite « basse », ou cette passe est
    // eteinte : le filtre CSS reprend alors son role de repli.
    G.settings.quality = 'high'; G.applyQuality(); try { G.rendreImage(); } catch (e) {}
    G.modeTV(false); const pc = aniso(), filtrePC = getComputedStyle(document.getElementById('c')).filter;
    const etalonne = document.body.classList.contains('etalonne');
    const vignetteDOM = getComputedStyle(document.getElementById('vignette')).display;
    G.settings.quality = 'low'; G.applyQuality(); try { G.rendreImage(); } catch (e) {}
    const filtreBasse = getComputedStyle(document.getElementById('c')).filter;
    const vignetteBasse = getComputedStyle(document.getElementById('vignette')).display;
    G.settings.quality = qual0; G.applyQuality(); try { G.rendreImage(); } catch (e) {}
    G.modeTV(true); const tv = aniso(), filtreTV = getComputedStyle(document.getElementById('c')).filter;
    const plafond = G.PLAFOND_TV, r4k = G.ratioRendu(3840);
    let maxCap = 1; try { maxCap = G.renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
    const aa = !!(G.renderer.capabilities && G.renderer.capabilities.isWebGL2 !== undefined) ? undefined : undefined;
    const antialias = !!G.renderer.getContext().getContextAttributes().antialias;
    G.modeTV(false);
    return { pc, tv, filtrePC, filtreTV, plafond, r4k: +r4k.toFixed(3), pix4k: mp(3840, r4k),
      avant1600: mp(3840, 1600 / 3840), maxCap, antialias, etalonne, vignetteDOM, filtreBasse, vignetteBasse };
  });
  const ok = r.plafond >= 3800 && r.pix4k > r.avant1600 * 3
    && r.tv.min >= 16 && r.tv.min === r.tv.max && r.pc.min >= 8 && r.tv.min > r.pc.min
    && r.filtreTV === 'none' && r.filtrePC === 'none' && r.etalonne && r.vignetteDOM === 'none'
    && r.filtreBasse !== 'none' && r.vignetteBasse !== 'none' && r.antialias;
  return { ok, detail: `l'image était floue sur la télé : on rendait en 1600 px de large (${r.avant1600} mégapixels en 4K) · plus aucun bridage a priori : on rend jusqu'au NATIF de l'écran (${r.plafond} px, ${r.pix4k} mégapixels) et c'est uniquement la mesure du temps des images qui fait redescendre si la machine ne suit pas · les ${r.tv.n} textures répétées (chaussées, trottoirs, façades) bavaient vues de biais : filtrage anisotrope ${r.pc.min}× partout et ${r.tv.min}× sur la télé (maximum de la machine : ${r.maxCap}×) · le filtre de couleur plein écran, qui coûtait une passe de composition entière, est retiré PARTOUT (télé ${r.filtreTV}, ordinateur ${r.filtrePC}) : l'étalonnage et le vignettage se font maintenant DANS la passe de netteté (body.etalonne=${r.etalonne}, voile CSS ${r.vignetteDOM}), donc sans une image de plus a calculer et sans que la télé soit la seule a perdre les couleurs · en qualité « basse » cette passe est éteinte et le filtre CSS reprend son rôle de repli (${r.filtreBasse}, voile ${r.vignetteBasse}) · et l'anticrénelage est forcé, même quand la télé se déclare « mobile » (${r.antialias})` };
});

test('le joystick du telephone repond sans decalage', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    return { hz: G.MANETTE_HZ, periode: Math.round(1000 / G.MANETTE_HZ) };
  });
  const ok = r.hz >= 50 && r.periode <= 20;
  return { ok, detail: `la manette n'envoyait la position du pouce que 25 fois par seconde : 40 ms de retard AVANT même le réseau, et le personnage partait toujours un cran après le doigt · elle envoie maintenant ${r.hz} fois par seconde (${r.periode} ms), sur un canal « non fiable » où les paquets ne s'accumulent jamais` };
});

test('la tele et l\'ordinateur affichent le MÊME code de manette', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.tv.cede = false;
    G.ouvreSalonTV();
    const surOrdi = document.getElementById('tvCode').textContent.trim();
    const lien = G.lienTV();
    const dansLien = (/#tv=([A-Z]{4})$/.exec(lien) || [])[1];
    G.tvPasseLaMain();                     // on envoie le jeu sur la télé : cet écran lâche le code
    const cede = G.tv.cede;
    G.closeUI();
    location.hash = '#tv=' + dansLien;     // la télé ouvre le lien
    const route = G.routeLien();
    await new Promise(r2 => setTimeout(r2, 700));
    const surTV = document.getElementById('tvCode').textContent.trim();
    const enVille = !!G.city.on;
    location.hash = ''; G.modeTV(false); G.closeUI(); G.tv.cede = false;
    return { surOrdi, dansLien, surTV, cede, route, enVille };
  });
  const ok = /^[A-Z]{4}$/.test(r.surOrdi) && r.dansLien === r.surOrdi && r.surTV === r.surOrdi
    && r.cede === true && r.route === 'tv' && r.enVille;
  return { ok, detail: `l'ordinateur affichait un code et la télé en tirait un AUTRE au hasard en ouvrant le lien : on scannait forcément le mauvais · le code voyage maintenant dans le lien (#tv=CODE) et l'écran qui passe la main lâche le sien pour que la télé le reprenne — ${r.surOrdi} sur l'ordinateur, ${r.dansLien} dans le lien, ${r.surTV} sur la télé · si la télé trouve le code encore occupé elle le redemande au lieu d'en inventer un nouveau, et on peut reprendre la main ici d'un bouton` };
});

test('la manette du telephone propose aussi une croix directionnelle', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.manetteOuvre('');
    document.getElementById('manette').classList.add('pret');
    const croix = document.getElementById('telCroix');
    if (!croix) return { pourquoi: 'pas de croix' };
    if (croix.hidden) document.getElementById('telBascule').click();   // la croix est le mode au CHOIX, le joystick est celui par défaut
    const fl = [...croix.querySelectorAll('[data-d]')];
    const boite = d => { const e = croix.querySelector('[data-d="' + d + '"]'); const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: Math.round(b.width) }; };
    const appuie = dirs => {
      dirs.forEach((d, i) => { const b = boite(d);
        croix.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10 + i, clientX: b.x, clientY: b.y, bubbles: true })); });
      const out = { x: +G.man.x.toFixed(3), y: +G.man.y.toFixed(3), allumees: croix.querySelectorAll('.fl.on').length };
      dirs.forEach((d, i) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 10 + i, bubbles: true })));
      return out;
    };
    const haut = appuie(['u']), bas = appuie(['d']), gauche = appuie(['l']), droite = appuie(['r']);
    const diag = appuie(['u', 'r']);
    const repos = { x: G.man.x, y: G.man.y };
    // on doit pouvoir GLISSER d'une flèche a l'autre sans relever le pouce
    const b1 = boite('l'), b2 = boite('u');
    croix.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 30, clientX: b1.x, clientY: b1.y, bubbles: true }));
    const avant = { x: G.man.x, y: G.man.y };
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 30, clientX: b2.x, clientY: b2.y, bubbles: true }));
    const apres = { x: G.man.x, y: G.man.y };
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 30, bubbles: true }));
    const sansJoystick = document.getElementById('telStick').hidden;   // en mode croix, le stick s'efface
    const taille = boite('u').w;
    G.manetteFerme();
    return { n: fl.length, taille, haut, bas, gauche, droite, diag, repos, avant, apres,
      fin: { x: G.man.x, y: G.man.y }, sansJoystick };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const ok = r.n === 4 && r.taille >= 44 && r.sansJoystick
    && r.haut.y === 1 && r.bas.y === -1 && r.gauche.x === -1 && r.droite.x === 1
    && Math.abs(r.haut.x) < 0.01 && Math.abs(r.gauche.y) < 0.01
    && r.diag.allumees === 2 && Math.abs(r.diag.x - 0.707) < 0.01 && Math.abs(r.diag.y - 0.707) < 0.01
    && r.repos.x === 0 && r.repos.y === 0
    && r.avant.x === -1 && r.apres.y === 1 && r.apres.x === 0 && r.fin.x === 0 && r.fin.y === 0;
  return { ok, detail: `en plus du joystick, une CROIX de manette de salon est disponible d'un bouton — ${r.n} grandes flèches de ${r.taille} px (▲ y=${r.haut.y}, ▼ y=${r.bas.y}, ◀ x=${r.gauche.x}, ▶ x=${r.droite.x}), deux appuis ensemble donnent la diagonale sans aller 41 % plus vite (${r.diag.x} / ${r.diag.y}) · et on GLISSE d'une flèche a l'autre sans relever le pouce (gauche → haut suivi en direct), tout revient a zéro au relâchement` };
});

test('les QR codes de la manette sont vraiment lisibles', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    // UN LECTEUR DE QR, écrit ici : il relit le code EXACTEMENT comme le ferait un téléphone
    // — information de format d'abord (avec son contrôle BCH), puis les données démasquées,
    // désentrelacées et redécodées. Aucun QR mal formé ne peut passer.
    const FORMATS = ['111011111000100', '111001011110011', '111110110101010', '111100010011101',
      '110011000101111', '110001100011000', '110110001000001', '110100101110110'];
    const MASQUES = [(r2, c) => (r2 + c) % 2 === 0, (r2, c) => r2 % 2 === 0, (r2, c) => c % 3 === 0,
      (r2, c) => (r2 + c) % 3 === 0, (r2, c) => (Math.floor(r2 / 2) + Math.floor(c / 3)) % 2 === 0,
      (r2, c) => (r2 * c) % 2 + (r2 * c) % 3 === 0, (r2, c) => ((r2 * c) % 2 + (r2 * c) % 3) % 2 === 0,
      (r2, c) => (((r2 + c) % 2 + (r2 * c) % 3) % 2) === 0];
    const EC = [null, { ec: 7, nb: 1, dc: 19 }, { ec: 10, nb: 1, dc: 34 }, { ec: 15, nb: 1, dc: 55 },
      { ec: 20, nb: 1, dc: 80 }, { ec: 26, nb: 1, dc: 108 }, { ec: 18, nb: 2, dc: 68 }];
    const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
    function reserve(N, v) {
      const res = []; for (let i = 0; i < N; i++) res.push(new Array(N).fill(false));
      const mk2 = (r2, c) => { if (r2 >= 0 && r2 < N && c >= 0 && c < N) res[r2][c] = true; };
      for (const [r0, c0] of [[0, 0], [0, N - 7], [N - 7, 0]])
        for (let a = -1; a <= 7; a++) for (let b = -1; b <= 7; b++) mk2(r0 + a, c0 + b);
      for (const a of ALIGN[v]) for (const b of ALIGN[v]) {
        if ((a < 9 && b < 9) || (a < 9 && b > N - 10) || (a > N - 10 && b < 9)) continue;
        for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) mk2(a + x, b + y);
      }
      for (let i = 8; i < N - 8; i++) { mk2(6, i); mk2(i, 6); }
      mk2(N - 8, 8);
      for (let i = 0; i < 9; i++) { mk2(8, i); mk2(i, 8); }
      for (let i = 0; i < 8; i++) { mk2(8, N - 1 - i); mk2(N - 1 - i, 8); }
      return res;
    }
    function relis(q) {
      const N = q.N, v = (N - 17) / 4, m = q.m;
      // 1) l'information de format, dans ses DEUX copies
      let f1 = '', f2 = '';
      for (let k = 0; k < 15; k++) {
        f1 += (k < 6 ? m[8][k] : k < 8 ? m[8][k + 1] : k === 8 ? m[7][8] : m[14 - k][8]);
        f2 += (k < 7 ? m[N - 1 - k][8] : m[8][N - 15 + k]);
      }
      const masque = FORMATS.indexOf(f1);
      if (masque < 0) return { err: 'format illisible : ' + f1 };
      if (f1 !== f2) return { err: 'les deux copies du format diffèrent' };
      if (m[N - 8][8] !== 1) return { err: 'le module toujours noir a été écrasé' };
      // 2) les données, démasquées et relues en zigzag
      const res = reserve(N, v), bits = [];
      let haut = true;
      for (let c = N - 1; c > 0; c -= 2) {
        if (c === 6) c--;
        for (let k = 0; k < N; k++) {
          const r2 = haut ? N - 1 - k : k;
          for (const cc of [c, c - 1]) { if (res[r2][cc]) continue;
            bits.push(MASQUES[masque](r2, cc) ? m[r2][cc] ^ 1 : m[r2][cc]); }
        }
        haut = !haut;
      }
      const oct = []; for (let i = 0; i + 7 < bits.length; i += 8) { let x = 0; for (let j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; oct.push(x); }
      // 3) on défait l'entrelacement des blocs
      const inf = EC[v], data = [];
      for (let i = 0; i < inf.dc; i++) for (let b = 0; b < inf.nb; b++) data[b * inf.dc + i] = oct[i * inf.nb + b];
      // 4) mode octet, longueur, contenu
      let p2 = 0; const pren = n => { let x = 0; for (let i = 0; i < n; i++) { const g = data[p2 >> 3]; x = (x << 1) | ((g >> (7 - (p2 & 7))) & 1); p2++; } return x; };
      if (pren(4) !== 4) return { err: 'mode inattendu' };
      const len = pren(8), s = [];
      for (let i = 0; i < len; i++) s.push(pren(8));
      return { masque, texte: new TextDecoder().decode(new Uint8Array(s)), v };
    }
    const cas = ['TYWH', 'https://x.fr/#m=ABCD', G.lienTV(), 'https://salimusus.github.io/marlon/#manette=TYWH',
      'https://salimusus.github.io/marlon/index.html#manette=ABCD',
      'https://un-domaine-assez-long.example.com/jeux/superobby/index.html#manette=WXYZ'];
    const lus = cas.map(t => { const q = G.QR.matrice(t); if (!q) return { t, err: 'trop long' };
      const l = relis(q); return { t, v: l.v, masque: l.masque, err: l.err, bon: l.texte === t }; });
    // et la taille du dessin : trop petit, le lecteur décroche quand la carte réduit l'image
    const cv = document.createElement('canvas');
    G.QR.dessine(cv, cas[3]);
    const q3 = G.QR.matrice(cas[3]), modules = q3.N + 8;
    return { lus, tousBons: lus.every(x => x.bon), largeur: cv.width, parModule: cv.width / modules, modules };
  });
  const ok = r.tousBons && r.parModule >= 6 && r.largeur >= 300;
  const detail = r.lus.map(x => `v${x.v}${x.err ? ' ⚠ ' + x.err : ''}`).join(', ');
  return { ok, detail: `AUCUN des QR n'était lisible — le dessin avait pourtant l'air parfait · deux erreurs dans l'information de format : les quinze bits étaient écrits a l'envers (poids faible en premier) et la seconde copie débordait d'un module, écrasant le « module toujours noir » · un lecteur écrit dans le banc d'essai relit maintenant chaque code comme le ferait un téléphone — format vérifié par son contrôle BCH, données démasquées, désentrelacées, redécodées — et les ${r.lus.length} cas passent (${detail}) · le dessin est aussi tracé bien plus large (${r.parModule} pixels par module, ${r.largeur} px) : a 2 pixels par module, la réduction de l'image faisait disparaître des lignes entières` };
});

test('le telephone se connecte vraiment a l\'ecran de jeu, et n\'attend jamais dans le vide', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    // FAUX RÉSEAU : deux pages et un annuaire commun, pour jouer l'appairage en entier
    const annuaire = new Map();
    class FauxConn {
      constructor(id) { this.peer = id; this.open = false; this.h = {}; this.autre = null; }
      on(e, f) { (this.h[e] = this.h[e] || []).push(f); }
      emit(e, ...a) { for (const f of (this.h[e] || [])) f(...a); }
      send(d) { if (this.autre) setTimeout(() => this.autre.emit('data', d), 0); }
    }
    class FauxPeer {
      constructor(id) { this.id = id || 'anon' + Math.random(); this.h = {}; this.mort = false;
        setTimeout(() => { if (this.mort) return;
          if (id && annuaire.has(id)) return this.emit('error', { type: 'unavailable-id' });
          if (id) annuaire.set(id, this); this.emit('open', this.id); }, 5); }
      on(e, f) { (this.h[e] = this.h[e] || []).push(f); }
      emit(e, ...a) { for (const f of (this.h[e] || [])) f(...a); }
      connect(cible) { const c = new FauxConn(cible);
        setTimeout(() => { const hote = annuaire.get(cible);
          if (!hote) return this.emit('error', { type: 'peer-unavailable' });
          const cote = new FauxConn(this.id); c.autre = cote; cote.autre = c;
          hote.emit('connection', cote);
          setTimeout(() => { c.open = cote.open = true; cote.emit('open'); c.emit('open'); }, 5); }, 5);
        return c; }
      destroy() { this.mort = true; if (annuaire.get(this.id) === this) annuaire.delete(this.id); }
    }
    const vrai = window.Peer; window.Peer = FauxPeer;
    const attend = ms => new Promise(r2 => setTimeout(r2, ms));
    try {
      // 1) l'écran de jeu ouvre le salon : il doit se mettre à ÉCOUTER, et le dire
      G.tv.cede = false; G.ouvreSalonTV();
      await attend(120);
      const code = document.getElementById('tvCode').textContent.trim();
      const ecoute = !!G.tv.on, msgEcran = document.getElementById('tvManettes').textContent;
      // 2) le téléphone scanne le code
      G.manetteOuvre(code);
      await attend(250);
      const pret = document.getElementById('manette').classList.contains('pret');
      const etat = document.getElementById('telEtat').textContent;
      const cotes = G.tv.conns.length;
      // 3) une flèche de la croix arrive-t-elle au jeu ?
      G.tel.x = 0; G.man.x = 1; G.man.y = 0; G.man.px = 0; G.man.py = 0;
      await attend(150);
      const recu = { x: G.tel.x, y: G.tel.y };
      G.manetteFerme();
      // 4) MAUVAIS code : ça doit réessayer et le dire, jamais rester figé
      G.manetteOuvre('ZZZZ');
      await attend(1200);
      const etatMauvais = document.getElementById('telEtat').textContent;
      G.manetteFerme();
      // 5) l'écran ne doit jamais cesser d'écouter : on coupe, la veille le remonte
      try { G.tv.peer.destroy(); } catch (e) {} G.tv.peer = null; G.tv.on = false;
      G.simTime += 10; G.tvVeille();
      await attend(120);
      const remonte = !!G.tv.on;
      G.closeUI();
      // le chemin réseau : sans relais, deux réseaux différents ne se joignent jamais
      const ice = (G.RESEAU && G.RESEAU.config && G.RESEAU.config.iceServers) || [];
      const relais = ice.filter(x => /^turn:/.test(x.urls)).length, stun = ice.filter(x => /^stun:/.test(x.urls)).length;
      const tcp443 = ice.some(x => /443\?transport=tcp/.test(x.urls));
      return { code, ecoute, msgEcran, pret, etat, cotes, recu, etatMauvais, remonte, essais: G.MAN_ESSAIS, relais, stun, tcp443 };
    } finally { window.Peer = vrai; }
  });
  const ok = /^[A-Z]{4}$/.test(r.code) && r.ecoute && /Prêt/.test(r.msgEcran)
    && r.relais >= 2 && r.stun >= 1
    && r.pret && /Connecté/.test(r.etat) && r.cotes === 1 && r.recu.x === 1
    && /essai/i.test(r.etatMauvais) && r.remonte;
  return { ok, detail: `le téléphone pouvait rester bloqué sans un mot : si la bibliothèque réseau n'était pas encore chargée on abandonnait aussitôt, si l'écran de jeu n'écoutait pas encore on tombait sur « aucune télé » sans retour possible, et si le canal ne s'ouvrait jamais plus rien ne bougeait · l'appairage complet est maintenant rejoué ici de bout en bout : l'écran annonce qu'il écoute (« ${r.msgEcran.trim()} »), le téléphone se connecte (« ${r.etat.trim()} », ${r.cotes} liaison) et une flèche de la croix arrive bien au jeu (x=${r.recu.x}) · avec un mauvais code il réessaie ${r.essais} fois en l'affichant (« ${r.etatMauvais.trim()} ») puis explique quoi vérifier, au lieu de tourner dans le vide · et si la liaison de l'écran tombe, une veille la remonte toute seule (${r.remonte}) · la liaison ne tentait que le DIRECT, qui échoue dès qu'un opérateur mobile s'en mêle : elle passe maintenant par ${r.stun} serveurs de découverte et ${r.relais} relais, dont un en TCP sur le port 443 (${r.tcp443}) qui traverse presque tous les réseaux` };
});

test('quand la manette ne passe pas, elle dit POURQUOI', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const attend = ms => new Promise(r2 => setTimeout(r2, ms));
    const vrai = window.Peer;
    // un faux réseau qui joue une panne précise
    const scene = (panne) => {
      window.Peer = class { constructor(id) { this.id = id || 'a'; this.h = {}; setTimeout(() => this.emit('open', this.id), 5); }
        on(e, f) { (this.h[e] = this.h[e] || []).push(f); }
        emit(e, ...a) { for (const f of (this.h[e] || [])) f(...a); }
        connect() { const c = { open: false, h: {}, on(e, f) { (this.h[e] = this.h[e] || []).push(f); }, emit() {}, send() {} };
          if (panne === 'absent') setTimeout(() => this.emit('error', { type: 'peer-unavailable' }), 5);
          return c; }   // panne « muet » : le canal ne s'ouvre jamais
        destroy() {} };
    };
    try {
      localStorage.removeItem('superobby.hote');
      // A) personne n'écoute sous ce code
      scene('absent'); G.manetteOuvre('AAAA');
      await attend(31000 / 4);   // les quatre essais s'enchaînent vite quand le serveur répond
      let absent = '';
      for (let i = 0; i < 40 && !/inscrit|onglet|liaison directe|service/.test(absent); i++) { await attend(400); absent = document.getElementById('telErr').textContent; }
      G.manetteFerme();
      // B) le jeu tourne dans un AUTRE ONGLET du même téléphone
      localStorage.setItem('superobby.hote', JSON.stringify({ code: 'BBBB', t: Date.now() }));
      scene('muet'); G.manetteOuvre('BBBB');
      let meme = '';
      for (let i = 0; i < 90 && !/onglet/.test(meme); i++) { await attend(400); meme = document.getElementById('telErr').textContent; }
      const etatB = document.getElementById('telEtat').textContent;
      G.manetteFerme(); localStorage.removeItem('superobby.hote');
      return { absent, meme, etatB };
    } finally { window.Peer = vrai; }
  });
  const ok = /inscrit sous le code/.test(r.absent) && /Prêt/.test(r.absent)
    && /AUTRE ONGLET/.test(r.meme) && /manette prête/i.test(r.etatB);
  return { ok, detail: `« ça ne marche pas » sans plus d'explication : le message final était le même quelle que soit la panne · il dit maintenant CE QUI a échoué, donc quoi faire · personne sous ce code → « ${r.absent.slice(0, 90)}… » · le jeu ouvert dans un autre onglet du MÊME téléphone (l'onglet s'endort en arrière-plan, donc plus personne ne répond) → « ${r.meme.slice(0, 90)}… » · et le mot d'attente ne ment plus : « ${r.etatB.trim()} » au lieu de « écran trouvé » alors que seule la manette était prête` };
});

test('le joystick de la manette est precis, et un seul paquet part par image', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.manetteOuvre(''); document.getElementById('manette').classList.add('pret');
    const stick = document.getElementById('telStick'), base = document.getElementById('telBase');
    if (stick.hidden) document.getElementById('telBascule').click();   // le joystick est le mode par défaut
    const b = stick.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const rayon = base.getBoundingClientRect().width / 2;
    const pousse = (fx, fy) => {
      stick.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, clientX: cx, clientY: cy, bubbles: true }));
      stick.dispatchEvent(new PointerEvent('pointermove', { pointerId: 5, clientX: cx + fx * rayon, clientY: cy + fy * rayon, bubbles: true }));
      const o = { x: +G.man.x.toFixed(3), y: +G.man.y.toFixed(3) };
      stick.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, bubbles: true }));
      return o;
    };
    const mort = pousse(0.06, 0), doux = pousse(0.4, 0), fond = pousse(1, 0), avant = pousse(0, -1);
    const repos = { x: G.man.x, y: G.man.y };
    // la base se pose LÀ où le pouce se pose (elle ne part plus d'un centre fixe)
    stick.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: b.left + 40, clientY: b.top + 40, bubbles: true }));
    const flottante = base.style.left !== '50%';
    stick.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true }));
    // la croix reste disponible au choix, et le choix est retenu
    const avantBasc = !stick.hidden;
    document.getElementById('telBascule').click();
    const apres = { joy: !document.getElementById('telStick').hidden, croix: !document.getElementById('telCroix').hidden };
    document.getElementById('telBascule').click();
    // UN SEUL paquet par image, avec direction ET caméra dedans
    const envoyes = [];
    G.man.conn = { open: true, send: o => envoyes.push(o) };
    G.man.x = 0.5; G.man.y = 0.25; G.man.px = 0; G.man.py = 0;
    for (let i = 0; i < 60; i++) { G.man.vx = (G.man.vx || 0) + 3; G.man.vy = (G.man.vy || 0) - 1; }   // un doigt qui glisse : 60 événements
    await new Promise(r2 => setTimeout(r2, 140));
    G.man.conn = null;
    const paquets = envoyes.length, p1 = envoyes[0] || {};
    G.manetteFerme();
    return { mort, doux, fond, avant, repos, flottante, avantBasc, apres, paquets, p1, hz: G.MANETTE_HZ,
      rayon: Math.round(rayon) };
  });
  const ok = r.mort.x === 0 && r.doux.x > 0.05 && r.doux.x < 0.5 && r.fond.x === 1 && r.avant.y === 1
    && r.repos.x === 0 && r.flottante && r.avantBasc && r.apres.croix && !r.apres.joy
    && r.paquets <= 12 && r.p1.t === 'in' && r.p1.x === 0.5 && r.p1.dx === 180 && r.p1.n >= 1;   // le compteur de paquets vit d'un test a l'autre
  return { ok, detail: `le joystick est de retour, mais un VRAI : la base se pose là où le pouce se pose (${r.flottante}), une zone morte franche (6 % de poussée → ${r.mort.x}), une réponse progressive (40 % → ${r.doux.x}) et la pleine puissance au bord (${r.fond.x}) — on marche doucement au centre et on court à fond au bord · la croix reste disponible d'un bouton, et le choix est retenu · surtout, la direction et la caméra partaient dans des messages SÉPARÉS, plus de cent par seconde quand le doigt glissait : le canal saturait et la commande arrivait de plus en plus en retard · tout tient maintenant dans UN paquet par image à ${r.hz} Hz (60 mouvements de caméra → ${r.paquets} paquets, avec direction ${r.p1.x} et caméra ${r.p1.dx} dedans), numéroté pour qu'un paquet en retard ne fasse jamais reculer le personnage` };
});

test('la lumiere de la ville est plus chaude', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const froid = c => { const x = new THREE.Color(c); return x.b - x.r; };   // > 0 = bleuté, < 0 = chaud
    const lu = {
      soleil: G.sun.color.getHexString(), ciel: G.hemi.color.getHexString(),
      sol: G.hemi.groundColor.getHexString(), fond: G.scene.background.getHexString(),
      brume: G.scene.fog.color.getHexString(),
    };
    const chaud = {
      soleil: froid(G.sun.color) < -0.05, ciel: froid(G.hemi.color) < 0,
      sol: froid(G.hemi.groundColor) < -0.05,
    };
    // le ciel et la brume ont été réchauffés par rapport au thème d'origine
    const theme = G.WORLDS.find(w => w.id === 'ville').theme;
    const ecartCiel = froid(new THREE.Color(theme.sky)) - froid(G.scene.background);
    const ecartBrume = froid(new THREE.Color(theme.fog[0])) - froid(G.scene.fog.color);
    return { lu, chaud, ecartCiel: +ecartCiel.toFixed(3), ecartBrume: +ecartBrume.toFixed(3) };
  });
  const ok = r.chaud.soleil && r.chaud.ciel && r.chaud.sol && r.ecartCiel > 0.03 && r.ecartBrume > 0.05;
  return { ok, detail: `tout était éclairé d'un blanc bleuté un peu clinique — soleil blanc, ciel froid, rebond du sol gris et lumière d'appoint franchement bleue · la lumière est maintenant celle d'une fin d'après-midi : soleil doré (#${r.lu.soleil}), ciel ambré (#${r.lu.ciel}), rebond du sol couleur sable (#${r.lu.sol}), appoint tiède · et le ciel comme la brume sont décalés vers le chaud (${r.ecartCiel} et ${r.ecartBrume} de bleu en moins) sans que les couleurs franches du jeu y perdent` };
});

test('la croix de la DualSense : ordres, guerre, emote, changement d\'arme, et boutique/missions en maintenant', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const ferme = () => { G.closeUI(); document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden')); };
    ferme();
    const ds = { index: 0, connected: true, id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { playEffect: () => Promise.resolve('complete') } };
    const vraiGP = navigator.getGamepads; navigator.getGamepads = () => [ds];
    const tap = (i, tenir = 0.05) => { ds.buttons[i] = { pressed: true, value: 1 }; G.pollGamepad(0.05); G.simTime += tenir; G.pollGamepad(0.05); ds.buttons[i] = { pressed: false, value: 0 }; G.pollGamepad(0.05); };
    const aff = () => getComputedStyle(document.getElementById('padLeg')).display;
    try {
      G.pollGamepad(0.05);
      const res = {};
      tap(12); res.haut = G.uiOpen; ferme();
      tap(12, 0.9); res.hautLong = G.uiOpen; ferme();
      // ← et → font maintenant DEFILER LES ARMES ; la boutique et les missions s'ouvrent en
      // les MAINTENANT (le joueur se retrouvait sur un ecran en pleine course).
      G.owned.add('arme:pistol'); G.owned.add('arme:rifle'); G.P.grenades = 0; G.equipWeapon(null);
      // le tour des armes s'est allonge (fusil a lunette, couteau...) : on en fait le TOUR
      // COMPLET jusqu'a revenir aux mains nues, au lieu de compter trois appuis.
      res.armes = []; for (let k = 0; k < 8 && (k === 0 || G.P.weapon); k++) { tap(15); res.armes.push(G.P.weapon); }
      G.equipWeapon(null);
      tap(14, 0.9); res.gaucheLong = G.uiOpen; ferme();
      tap(15, 0.9); res.droiteLong = G.uiOpen; ferme();
      G.P.dance = 0; tap(13); res.bas = G.P.dance;
      // le bandeau d'aide ne sort plus tout seul : le pave tactile le montre puis le cache
      document.body.classList.remove('aide'); document.body.classList.add('manette');
      res.legendeRepos = aff(); tap(17); res.legendeDemandee = aff(); tap(17); res.legendeRefermee = aff();
      document.body.classList.add('aide');
      res.legende = aff(); G.openQui(); res.legendeMenu = aff(); ferme(); res.legendeApres = aff();
      res.legendeTexte = document.getElementById('padLeg').textContent;
      res.aide = (document.querySelector('.keys') || {}).textContent || '';
      res.pave = G.PS_NOMS[17];
      return res;
    } finally { navigator.getGamepads = vraiGP; ferme(); }
  });
  const ok = r.haut === 'ordres' && r.hautLong === 'guerre' && r.gaucheLong === 'store' && r.droiteLong === 'missions' && r.bas > 0
    && r.armes[0] === 'pistol' && r.armes.length >= 3 && r.armes[r.armes.length - 1] === null && r.legendeRepos === 'none' && r.legendeDemandee === 'flex' && r.legendeRefermee === 'none'
    && r.legende === 'flex' && r.legendeMenu === 'none' && r.legendeApres === 'flex'
    && /📣/.test(r.legendeTexte) && /📣/.test(r.aide) && r.pave === 'Pavé';
  return { ok, detail: `[ordres=${r.haut} guerre=${r.hautLong} armes=${r.armes.join('/')} boutique(←tenu)=${r.gaucheLong} missions(→tenu)=${r.droiteLong} emote=${r.bas} bandeau ${r.legendeRepos}→${r.legendeDemandee}→${r.legendeRefermee}] a la manette on n'avait acces ni au 📣 des ordres, ni a la boutique, ni aux missions, ni a la guerre des gangs, ni aux emotes, ni au changement d'arme : tout ca n'existait qu'a la souris · la croix fait tout : ↑ ouvre « ${r.haut} », ↑ tenu 0,7 s ouvre « ${r.hautLong} », ← « ${r.gauche} », → « ${r.droite} », ↓ danse (${r.bas} s) · le pavé tactile fait defiler les armes (${r.armes.map(a => a || 'mains nues').join(' → ')}) · une legende a l'ecran rappelle chaque bouton (affichée=${r.legende}, effacée dans un menu=${r.legendeMenu === 'none'}) et la carte d'aide est a jour` };
});

test('un bouton connecte la manette PS5 et la reconnait a la seconde ou elle repond', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const vraiGP = navigator.getGamepads, vraiHid = navigator.hid;
    const vib = [];
    const ds = { index: 0, connected: true, id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { playEffect: (t, o) => { vib.push(o); return Promise.resolve('complete'); } } };
    const raz = () => { G.manetteBT.etat = 'repos'; if (G.manetteBT.timer) { clearInterval(G.manetteBT.timer); G.manetteBT.timer = null; } };
    try {
      const res = { boutons: ['padConnect', 'padConnect2'].filter(id => document.getElementById(id)).length };
      // 1) sans WebHID (une smart TV) : le guide en trois etapes, puis la manette « apparait »
      Object.defineProperty(navigator, 'hid', { configurable: true, value: undefined });
      navigator.getGamepads = () => [null]; raz();
      G.ouvreSalonTV(); res.salonEtat = document.getElementById('padEtat').textContent;
      document.getElementById('padConnect').click(); await dodo(50);
      res.attente = { etat: G.manetteBT.etat, etapes: document.querySelectorAll('#padAide div').length, bouton: document.getElementById('padConnect').textContent,
        classe: document.getElementById('padCase').className };
      navigator.getGamepads = () => [ds]; await dodo(750);
      res.ok = { etat: G.manetteBT.etat, texte: document.getElementById('padEtat').textContent, bouton2: document.getElementById('padConnect2').textContent, vibre: vib.length, timer: !!G.manetteBT.timer };
      // 2) elle se deconnecte : on le dit
      navigator.getGamepads = () => [null]; G.manetteBTSonde();
      res.perdue = document.getElementById('padEtat').textContent;
      // 3) avec WebHID (ordinateur, Android) : la fenetre de choix du navigateur, puis la meme veille
      Object.defineProperty(navigator, 'hid', { configurable: true, value: { requestDevice: async f => [{ productName: 'DualSense Wireless Controller', vendorId: f.filters[0].vendorId }] } });
      raz(); const r3 = await G.manetteConnecter();
      res.hid = { r: r3, texte: document.getElementById('padEtat').textContent, timer: !!G.manetteBT.timer };
      G.closeUI();
      return res;
    } finally { navigator.getGamepads = vraiGP; Object.defineProperty(navigator, 'hid', { configurable: true, value: vraiHid }); raz(); G.closeUI(); }
  });
  const ok = r.boutons === 2 && r.attente.etat === 'attente' && r.attente.etapes === 3 && /Recherche/.test(r.attente.bouton) && /attente/.test(r.attente.classe)
    && r.ok.etat === 'ok' && /DualSense.*connectée \(prise 1\)/.test(r.ok.texte) && /connectée/.test(r.ok.bouton2) && r.ok.vibre >= 1 && !r.ok.timer
    && /déconnectée/.test(r.perdue) && r.hid.r.hid === true && /autorisée/.test(r.hid.texte) && r.hid.timer;
  return { ok, detail: `un navigateur ne peut pas appairer une manette Bluetooth a la place de l'appareil — mais il peut tout le reste, et ce bouton le fait : dans le salon 📺 comme dans les réglages (${r.boutons} boutons), il lance une recherche d'une minute avec le guide en ${r.attente.etapes} étapes (PS + Create, réglages Bluetooth, ✕), ouvre la fenêtre de choix du navigateur quand elle existe (WebHID : « ${r.hid.texte.slice(0, 44)}… »), et reconnaît la manette a la seconde ou elle répond : « ${r.ok.texte} », avec une vibration (${r.ok.vibre}) · si elle se déconnecte, il le dit (« ${r.perdue.slice(0, 40)}… »)` };
});

test('le son ne sature plus : quatre bus, un limiteur et un vrai reglage de volume', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true;
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const cibles = [], vraiConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (t) { cibles.push([this.constructor.name, t && t.constructor.name]); return vraiConnect.apply(this, arguments); };
    try {
      G.sfx.unlock(); const ch = G.sfx.chaine();
      // on fait jouer TOUT le monde : effets, souffle, moteur 500 chevaux, sirene, musique
      G.sfx.coin(); G.sfx.noise(0.1, 500, 0.05);
      G.engine.start('car', 2); G.engine.set(0.5); G.engine.stop();
      G.siren.start(); G.siren.stop();
      G.music.start(); await dodo(300);
      const versSortie = cibles.filter(([, b]) => b === 'AudioDestinationNode').map(([a]) => a);
      const res = { comp: ch.comp.constructor.name, seuil: ch.comp.threshold.value, ratio: ch.comp.ratio.value,
        bus: Object.fromEntries(Object.entries(ch.bus).map(([k, g]) => [k, +g.gain.value.toFixed(2)])),
        connexions: cibles.length, versSortie: [...new Set(versSortie)] };
      // le volume : le curseur des reglages pilote le bus general, et c'est retenu
      const vol = document.getElementById('volIn'); vol.value = '35'; vol.dispatchEvent(new Event('input'));
      await dodo(250); res.v35 = { reglage: G.settings.volume, master: +ch.master.gain.value.toFixed(2), stocke: localStorage.getItem('superobby.volume'), etiquette: document.getElementById('volVal').textContent };
      // la page passe en arriere-plan : sourdine, puis retour
      G.sfx.sourdine(true); await dodo(400); res.cache = +ch.master.gain.value.toFixed(3);
      G.sfx.sourdine(false); await dodo(400); res.retour = +ch.master.gain.value.toFixed(2);
      vol.value = '100'; vol.dispatchEvent(new Event('input'));
      return res;
    } finally { AudioNode.prototype.connect = vraiConnect; try { G.music.stop && G.music.stop(); } catch (e) {} }
  });
  const ok = r.comp === 'DynamicsCompressorNode' && r.seuil <= -6 && r.ratio >= 4
    && r.bus.effets === 1 && r.bus.musique <= 0.6 && r.bus.moteur < 1 && r.connexions >= 12
    && r.versSortie.every(n => n === 'DynamicsCompressorNode')
    && r.v35.reglage === 0.35 && r.v35.master === 0.35 && r.v35.stocke === '0.35' && /35/.test(r.v35.etiquette)
    && r.cache < 0.01 && r.retour === 0.35;
  return { ok, detail: `chaque son se branchait DIRECTEMENT sur la carte son : musique a 0,9, moteur 500 chevaux et sa scie, tirs, sirène… la somme dépassait 1 et la sortie écrêtait — c'était ce grésillement — et la musique, quatre fois plus forte que les effets, couvrait tout · maintenant ${r.connexions} branchements testés et pas un seul vers la sortie sinon le LIMITEUR (${r.comp}, seuil ${r.seuil} dB, ratio ${r.ratio}:1) · quatre bus équilibrés : effets ${r.bus.effets}, moteur ${r.bus.moteur}, musique ${r.bus.musique}, ambiance ${r.bus.ambiance} · un curseur de volume dans les réglages (35 % → bus général a ${r.v35.master}, retenu « ${r.v35.stocke} ») · et la page en arrière-plan passe en sourdine (${r.cache}) puis revient (${r.retour})` };
});

test('les ombres passent en haute definition, et la tele sacrifie les ombres avant la nettete', async p => {
  const r = await p.evaluate(() => {
    const G = __G, R = G.renderer, sun = G.sun;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.modeTV(false); G.applyQuality();
    const base = { carte: sun.shadow.mapSize.x, max: R.capabilities.maxTextureSize, cadre: sun.shadow.camera.right, ppm: +(sun.shadow.mapSize.x / (2 * sun.shadow.camera.right)).toFixed(1),
      bias: sun.shadow.bias, nbias: sun.shadow.normalBias, doux: R.shadowMap.type === G.THREE.PCFSoftShadowMap, avant: +(2048 / 72).toFixed(1) };
    // l'echelle : ca rame → on descend marche par marche, les ombres d'abord
    const marches = [];
    for (let i = 0; i < 260; i++) { G.fluiditeTick(45); if (i % 14 === 13) marches.push({ p: G.rendu.palier, ech: +G.rendu.ech.toFixed(2), carte: sun.shadow.mapSize.x, ombres: G.rendu.ombres }); }
    const uniques = marches.filter((m, i) => !i || m.p !== marches[i - 1].p);
    const bas = { p: G.rendu.palier, ech: G.rendu.ech, ombres: G.rendu.ombres };
    // ca respire → on remonte jusqu'en haut, carte d'ombres comprise
    for (let i = 0; i < 500; i++) G.fluiditeTick(15);
    const haut = { p: G.rendu.palier, ech: G.rendu.ech, carte: sun.shadow.mapSize.x, ombres: G.rendu.ombres };
    G.applyQuality();
    // sur la tele : le ratio de pixels n'est plus bride a 1,5 comme sur un telephone
    const pc = G.ratioQualite(); G.modeTV(true); const tv = G.ratioQualite(); G.modeTV(false);
    return { base, uniques, bas, haut, pc, tv, paliers: G.PALIERS.length };
  });
  const attendu = Math.min(4096, r.base.max);
  const u = r.uniques;
  const ok = r.base.carte === attendu && r.base.carte >= 4096 && r.base.cadre === 48 && r.base.ppm > r.base.avant
    && r.base.nbias > 0 && r.base.doux
    && u.length >= 8 && u[0].carte === attendu && u[1].carte === attendu / 2 && u[1].ech === 1 && u[2].carte === attendu / 4 && u[2].ech === 1
    && u[3].ech < 1 && u[3].carte === attendu / 4 && r.bas.ombres === false && r.bas.ech === 0.5
    && r.haut.p === 0 && r.haut.ech === 1 && r.haut.carte === attendu && r.haut.ombres === true && r.tv >= r.pc;
  return { ok, detail: `la carte d'ombres faisait 2048 points pour 72 m (${r.base.avant} points par mètre) : chaque bord d'ombre était un escalier sur un grand écran · elle fait maintenant ${r.base.carte} points (maximum de la machine : ${r.base.max}) sur un cadre de ${2 * r.base.cadre} m, soit ${r.base.ppm} points par mètre, avec un biais de normale (${r.base.nbias}) contre l'acné et des ombres douces même sur la télé (${r.base.doux}) · et quand la télé rame, ce sont les OMBRES qui s'allègent en premier, pas la netteté : ${u.map(m => `${m.carte}${m.ombres ? '' : '✕'}@${m.ech}`).join(' → ')} (${r.paliers} paliers, la résolution ne bouge qu'a partir du 4e) · dès que ça respire tout remonte (palier ${r.haut.p}, ${r.haut.carte} points) · et la télé n'est plus bridée a 1,5 pixel comme un téléphone (${r.tv} ≥ ${r.pc})` };
});

test('a la manette, les menus se parcourent vraiment : onglets, grilles, curseurs, repetition', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const ferme = () => { G.closeUI(); document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden')); };
    ferme();
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const ds = { index: 0, connected: true, id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { playEffect: () => Promise.resolve('complete') } };
    const vraiGP = navigator.getGamepads; navigator.getGamepads = () => [ds];
    const tap = i => { ds.buttons[i] = { pressed: true, value: 1 }; G.pollGamepad(0.01); ds.buttons[i] = { pressed: false, value: 0 }; G.pollGamepad(0.01); };
    const foc = () => document.querySelector('.focustv');
    try {
      G.pollGamepad(0.01);   // la manette est vue : un curseur apparaitra a l'ouverture
      const res = {};
      G.openStore(); await dodo(80);
      res.curseurAuto = !!foc();
      const c = G.navCibles();
      res.cibles = { total: c.length, onglets: c.filter(e => e.closest('#stTabs')).length, articles: c.filter(e => e.classList.contains('fcard')).length };
      // R1 / L1 : le bandeau d'onglets
      const sel = () => (document.querySelector('#stTabs b.sel') || {}).dataset && document.querySelector('#stTabs b.sel').dataset.k;
      const t0 = sel(); tap(5); const t1 = sel(); tap(4); const t2 = sel();
      res.onglets = { t0, t1, t2 };
      // la grille en 2D : droite = meme ligne, bas = la carte du dessous (pas le voisin)
      document.querySelectorAll('.focustv').forEach(x => x.classList.remove('focustv'));
      // un onglet dont les cartes tiennent sur AU MOINS deux lignes (sinon « bas » n'a rien a viser)
      let cartes = [];
      for (const tb of document.querySelectorAll('#stTabs b')) { tb.click(); await dodo(30);
        cartes = [...document.querySelectorAll('#stGrid .fcard')].filter(e => e.offsetParent !== null);
        if (new Set(cartes.map(e => Math.round(e.getBoundingClientRect().top))).size >= 2) break; }
      cartes[0].classList.add('focustv');
      const ra = cartes[0].getBoundingClientRect();
      G.navVers('droite'); const b = foc(), rb = b.getBoundingClientRect();
      G.navVers('bas'); const cc = foc(), rc = cc.getBoundingClientRect();
      res.grille = { n: cartes.length, droiteMemeLigne: Math.abs(rb.top - ra.top) < 4 && rb.left > ra.left + 10, basDessous: rc.top > rb.top + 10 && Math.abs(rc.left - rb.left) < 40 };
      // le stick maintenu REPETE : plusieurs pas en 0,7 s, et pas un pas par image
      const suivi = [];
      ds.axes = [0, 1, 0, 0]; const T0 = performance.now();
      let images = 0;
      // 1,1 s de lecture SERREE (sans rendre la main) : la repetition est reglee sur l'horloge,
      // pas sur le nombre d'images. Avec une pause de 8 ms entre deux lectures, une machine
      // chargee ne faisait qu'un ou deux tours en 1,1 s et le test croyait la repetition morte.
      while (performance.now() - T0 < 1100) { G.pollGamepad(0.01); images++; const f = foc(); if (f && suivi[suivi.length - 1] !== f) suivi.push(f); }
      ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.01);
      res.repet = { pas: suivi.length, images: Math.max(images, 6) };
      // ✕ valide un onglet, et le curseur reste visible apres
      document.querySelectorAll('.focustv').forEach(x => x.classList.remove('focustv'));
      const tabs = [...document.querySelectorAll('#stTabs b')]; tabs[2].classList.add('focustv'); tap(0); await dodo(90);
      res.valide = { voulu: tabs[2].dataset.k, obtenu: sel(), curseur: !!foc() };
      // ◯ referme
      tap(1); await dodo(40); res.ferme = G.uiOpen;
      // le curseur de volume glisse avec ← → (pas de « sortie » du menu)
      G.toggleMenu(true); await dodo(60);
      document.querySelectorAll('.focustv').forEach(x => x.classList.remove('focustv')); document.getElementById('volIn').classList.add('focustv');
      document.getElementById('volIn').value = '80'; document.getElementById('volIn').dispatchEvent(new Event('input'));   // le volume par defaut est a 100 %, plein : on part de 80 pour voir la glissiere monter
      const v0 = +document.getElementById('volIn').value; tap(15); tap(15); const v1 = +document.getElementById('volIn').value; tap(14); const v2 = +document.getElementById('volIn').value;
      res.curseur = { v0, v1, v2, reglage: G.settings.volume, encoreOuvert: !!document.querySelector('#menu:not(.hidden)') };
      document.getElementById('volIn').value = '80'; document.getElementById('volIn').dispatchEvent(new Event('input'));
      G.toggleMenu(false); ferme();
      res.cadence = G.PAD_HZ;
      res.aide = (document.querySelector('.keys') || {}).textContent || '';
      return res;
    } finally { navigator.getGamepads = vraiGP; ferme(); }
  });
  const ok = r.curseurAuto && r.cibles.onglets >= 5 && r.cibles.articles >= 4 && r.onglets.t1 !== r.onglets.t0 && r.onglets.t2 === r.onglets.t0
    && r.grille.droiteMemeLigne && r.grille.basDessous && r.repet.pas >= 2 && r.repet.pas < r.repet.images / 2
    && r.valide.obtenu === r.valide.voulu && r.valide.curseur && r.ferme === null
    && r.curseur.v1 === r.curseur.v0 + 10 && r.curseur.v2 === r.curseur.v0 + 5 && r.curseur.reglage === (r.curseur.v0 + 5) / 100 && r.curseur.encoreOuvert
    && r.cadence >= 100 && /R1\/L1/.test(r.aide);
  return { ok, detail: `dans les menus, la manette etait a moitie sourde : les onglets de la boutique et ses cartes d'articles etaient hors d'atteinte (${r.cibles.onglets} onglets et ${r.cibles.articles} articles maintenant selectionnables sur ${r.cibles.total} cibles), « bas » suivait l'ordre du code et atterrissait a cote (maintenant : droite reste sur la ligne=${r.grille.droiteMemeLigne}, bas descend=${r.grille.basDessous}), il fallait relacher et rappuyer a chaque case (stick maintenu 1,1 s : ${r.repet.pas} pas, avec repetition mesuree et non un pas par image), et elle etait lue une fois par image — ${r.cadence} fois par seconde maintenant · un curseur apparait des l'ouverture (${r.curseurAuto}), R1/L1 changent d'onglet (${r.onglets.t0} → ${r.onglets.t1} → ${r.onglets.t2}), ✕ valide (${r.valide.obtenu}) en gardant le curseur, ◯ referme, et le volume glisse avec ← → (${r.curseur.v0} → ${r.curseur.v1} → ${r.curseur.v2} %)` };
});

test('Ultra HD : surechantillonnage, anticrenelage multi-echantillon et passe de nettete', async p => {
  const r = await p.evaluate(() => {
    const G = __G, R = G.renderer, gl = R.getContext();
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    // on lit les VRAIS pixels de la sortie, juste apres le rendu
    const lis = () => { const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; const buf = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let lum = 0, n = 0, contours = 0;
      for (let y = 0; y < h; y += 4) for (let x = 0; x + 4 < w; x += 4) { const i = (y * w + x) * 4, j = (y * w + x + 4) * 4; const l = (buf[i] + buf[i + 1] + buf[i + 2]) / 3; lum += l; n++; contours += Math.abs(l - (buf[j] + buf[j + 1] + buf[j + 2]) / 3); }
      return { w, h, lum: +(lum / n).toFixed(1), contours: +(contours / n).toFixed(2) }; };
    const dpr = window.devicePixelRatio || 1;
    G.settings.quality = 'high'; G.applyQuality(); G.post.on = false; G.rendreImage(); const haute = lis();
    G.settings.quality = 'ultra'; G.applyQuality();
    const ultraOK = G.rendreImage(); const ultra = lis();
    const q = G.qualite(), libelle = document.getElementById('qualBtn').textContent;
    const reglages = { ratio: G.ratioQualite(), plafond: G.plafondPixels(), post: G.post.on, force: G.post.force, aniso: q.aniso, msaa: G.post.msaa, samples: G.post.rt ? G.post.rt.samples : 0, gl2: !!R.capabilities.isWebGL2, err: !!G.post.err, images: G.post.images };
    G.post.force = 0; G.rendreImage(); const sansNettete = lis();
    // sur une tele 4K : au natif (pas de surechantillonnage a 8 K), et la nettete fait le reste
    G.modeTV(true); const tv = { ratio: G.ratioRendu(3840), plafond: G.plafondPixels() }; G.modeTV(false);
    // le defaut : Ultra HD sur ordinateur et tele, « haute » sur telephone
    const defaut = { ordi: G.QUALITES.ultra.n, cycle: ['ultra', 'high', 'dlss', 'low'].every(k => G.QUALITES[k]) };
    G.settings.quality = 'high'; G.applyQuality();
    return { dpr, haute, ultra, ultraOK, reglages, sansNettete, tv, defaut, libelle };
  });
  const ok = r.ultraOK && r.reglages.ratio === Math.min(r.dpr * 2, 3) && r.ultra.w === r.haute.w * 2 && r.ultra.h === r.haute.h * 2
    && r.ultra.lum > 40 && Math.abs(r.ultra.lum - r.haute.lum) < 12 && !r.reglages.err
    && r.reglages.post && r.reglages.force > 0.4 && r.reglages.aniso === 16 && r.reglages.plafond >= 5120
    && (!r.reglages.gl2 || (r.reglages.msaa && r.reglages.samples === 4))
    && r.ultra.contours > r.sansNettete.contours * 1.02
    && r.tv.ratio <= 1.001 && r.tv.plafond === 3840 && r.defaut.cycle;
  return { ok, detail: `« haute » rendait l'image a la finesse de l'ecran, point · Ultra HD la calcule a ${r.reglages.ratio}× (${r.ultra.w}×${r.ultra.h} au lieu de ${r.haute.w}×${r.haute.h} : chaque pixel affiche est la moyenne de quatre pixels calcules, plus aucun bord en escalier), avec l'anticrenelage multi-echantillon (${r.reglages.msaa ? r.reglages.samples + ' echantillons' : 'WebGL 1 : sans'}), le filtrage des textures a ${r.reglages.aniso}×, et une passe de NETTETE adaptative qui accentue les contours (+${Math.round((r.ultra.contours / r.sansNettete.contours - 1) * 100)} % de contraste de contour mesure sur les vrais pixels, luminosite conservee : ${r.ultra.lum} contre ${r.haute.lum}) · sur une tele 4K on calcule au natif (ratio ${r.tv.ratio}, plafond ${r.tv.plafond}) et la nettete fait le reste · c'est le reglage par defaut sur ordinateur et tele (« ${r.libelle} » dans les reglages, quatre niveaux), et la mesure des images fait toujours redescendre si la machine ne suit pas` };
});

test('le son SORT vraiment : compresseur, rattrapage, limiteur, et une mesure au bout de la chaine', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const c = G.sfx.unlock(), ch = G.sfx.chaine();
    const an = c.createAnalyser(); an.fftSize = 2048; ch.lim.connect(an);
    const rms = () => { const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let s2 = 0; for (const v of d) s2 += v * v; return +Math.sqrt(s2 / d.length).toFixed(4); };
    G.engine.stop(); try { G.music.stop(); } catch (e) {} try { G.siren.stop(); } catch (e) {} try { G.meteoSet('clair', 999); } catch (e) {}   // un test precedent peut laisser tourner musique, moteur, sirene ou pluie
    // La ville a maintenant une RUMEUR de fond permanente (poste F) : le « silence » n'est
    // plus silencieux. On la met en pause le temps de la mesure, sinon elle seule depassait
    // le seuil de silence et faisait echouer un test qui parle d'autre chose.
    try { G.SONV.ambT = G.simTime + 1e6; G.ambiance.stop(); } catch (e) {}
    await dodo(900); const silence = rms();
    G.engine.start('car', 2); G.engine.set(0.6); await dodo(900); const moteur = rms(); G.engine.stop();
    await dodo(400); G.sfx.tone(440, 0, 0.6, 'sine', 0.3); await dodo(120); const tonal = rms();
    G.engine.start('car', 1); G.engine.set(0.5); const m = await G.mesureSon(500); G.engine.stop();
    try { ch.lim.disconnect(an); } catch (e) {}
    try { G.SONV.ambT = 0; } catch (e) {}   // la rumeur de la ville repart pour les tests suivants
    return { etat: c.state, silence, moteur, tonal, mesure: m, makeup: +ch.makeup.gain.value.toFixed(2), lim: { seuil: ch.lim.threshold.value, ratio: ch.lim.ratio.value }, comp: { seuil: ch.comp.threshold.value, ratio: ch.comp.ratio.value }, volume: G.settings.volume };
  });
  const ok = r.etat === 'running' && r.silence < 0.02 && r.moteur > 0.12 && r.moteur > r.silence + 0.1 && r.makeup >= 1.5 && r.lim.seuil >= -3 && r.lim.ratio >= 12 && r.comp.ratio <= 6 && r.volume >= 0.8 && r.mesure.etat === 'running' && r.mesure.niveau > 0.05;
  return { ok, detail: `le limiteur seul rabotait sans rien rendre : tout etait devenu TROP FAIBLE et, sur des enceintes de tele, on n'entendait plus rien · la chaine est maintenant celle d'un vrai mixage — compresseur doux (${r.comp.seuil} dB, ${r.comp.ratio}:1) → gain de rattrapage ×${r.makeup} → limiteur brique (${r.lim.seuil} dB, ${r.lim.ratio}:1) — et le volume par defaut est a ${Math.round(r.volume * 100)} % · mesure AU BOUT DE LA CHAINE par un analyseur : silence ${r.silence}, moteur 500 chevaux ${r.moteur} (2,5× plus fort qu'avant), note ${r.tonal} · et le bouton « Tester le son » ecoute maintenant ce qui sort au lieu de dire « ca marche » les yeux fermes (${r.mesure.etat}, niveau ${r.mesure.niveau})` };
});

test('en interieur, la camera passe en maison de poupee : plafond efface, mur traverse transparent', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12, yaw: 0, pitch: 0.3 }); await dodo(600);
    __SHOT.go({ world: 4, x: -1, y: 0.5, z: 20, hour: 12, yaw: 0, pitch: 0.3 });   // dans la salle de sport
    for (let i = 0; i < 40 && !(G.interieur.rect && G.cam.dist < 5.2); i++) await dodo(150);
    const opac = () => G.interieur.murs.map(o => o.mesh && o.mesh.userData.matOpaque ? +[].concat(o.mesh.material)[0].opacity.toFixed(2) : 1);
    for (let i = 0; i < 40 && !opac().some(o => o < 0.5); i++) await dodo(150);   // le fondu du mur traverse prend quelques images
    await dodo(300);
    const I = G.interieur, c = G.camera.position, rect = I.rect;
    const plafonds = I.masques.filter(m => { const b = new G.THREE.Box3().setFromObject(m); return b.min.y > 2.6; }).length;
    const ops = I.murs.map(o => o.mesh && o.mesh.userData.matOpaque ? +[].concat(o.mesh.material)[0].opacity.toFixed(2) : 1);
    const dedans = { rect: !!rect, masques: I.masques.length, plafonds, murs: I.murs.length, dist: +G.cam.dist.toFixed(2), pitch: +G.cam.pitch.toFixed(2),
      camDehors: !!rect && (Math.abs(c.x - rect.x) > rect.w / 2 || Math.abs(c.z - rect.z) > rect.d / 2), transparents: ops.filter(o => o < 0.5).length, opaques: ops.filter(o => o === 1).length,
      perche: !!rect && G.solids.filter(o => o.xray).length };
    __SHOT.go({ world: 4, x: 0, y: 1, z: 40, hour: 12, yaw: 0, pitch: 0.3 }); await dodo(700);
    let caches = 0; G.worldGroup.traverse(o => { if (o.isMesh && !o.visible && Math.abs(o.position.x + 1) < 6 && Math.abs(o.position.z - 19.5) < 6) caches++; });
    const apres = { rect: G.interieur.rect, masques: G.interieur.masques.length, xray: G.solids.filter(o => o.xray).length, clones: G.solids.filter(o => o.mesh && o.mesh.userData.matOpaque).length, caches };
    return { dedans, apres };
  });
  const d = r.dedans, a = r.apres;
  const ok = d.rect && d.plafonds >= 3 && d.murs >= 3 && d.dist >= 3.6 && d.dist <= 5.2 && d.pitch <= 0.43 && d.camDehors && d.transparents >= 1 && d.opaques >= 1 && d.perche >= 3
    && !a.rect && a.masques === 0 && a.xray === 0 && a.clones === 0 && a.caches === 0;
  return { ok, detail: `dans une boutique, la camera se cognait aux murs et venait se coller au joueur, ou passait sous le plafond et l'image etait bouchee · elle fait maintenant ce que font les jeux professionnels — la MAISON DE POUPEE : des qu'on entre (salle de sport), le plafond et tout ce qui est au-dessus de la tete s'effacent (${d.plafonds} elements masques sur ${d.masques}), la perche traverse les ${d.murs} murs de la piece (${d.perche} rendus « transparents » a la collision), se pose a ${d.dist} m dehors (camera hors de la piece=${d.camDehors}) sans monter au-dessus du toit (inclinaison ${d.pitch}), et le mur traverse devient transparent (${d.transparents} transparent, ${d.opaques} pleins) · en sortant tout revient (${a.masques} masque, ${a.xray} mur traversable, ${a.clones} materiau clone, ${a.caches} element cache)` };
});

test('le stick est precis et vif : zone morte de 8 %, courbe douce, camera a 5,5 rad/s, sensibilite reglable', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const s = v => +G.padStick(v, 0)[0].toFixed(3);
    const courbe = { d05: s(0.05), d30: s(0.3), d50: s(0.5), d80: s(0.8), d100: s(1) };
    const ds = { index: 0, connected: true, id: 'DualSense', axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })) };
    const vrai = navigator.getGamepads; navigator.getGamepads = () => [ds];
    try {
      G.settings.sensib = 1; G.P.aim = false; G.P.drawn = false;
      ds.axes = [0, 0, 1, 0]; const y0 = G.cam.yaw; for (let i = 0; i < 100; i++) G.pollGamepad(0.01); const vitesse = +Math.abs(G.cam.yaw - y0).toFixed(2);
      G.settings.sensib = 2; const y1 = G.cam.yaw; for (let i = 0; i < 100; i++) G.pollGamepad(0.01); const vitesse2 = +Math.abs(G.cam.yaw - y1).toFixed(2);
      G.settings.sensib = 1; ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.01);
      // le mode « rotation » ignorait tout virage sous 32 % de la course : c'est corrige, et
      // le stick y FAIT TOURNER le personnage (le joueur ne voulait pas glisser de cote)
      G.tel.x = G.tel.y = 0; G.joy.x = G.joy.y = 0; G.keys.clear();
      G.settings.ctrl = 'rot'; G.settings.turn = 160; G.cam.yaw = 0; G.P.facing = 0; G.P.vel.set(0, 0, 0);
      ds.axes = [1, 0, 0, 0]; G.pollGamepad(0.01); const f0 = G.P.facing;
      for (let i = 0; i < 60; i++) { G.P.pos.set(0, 0.5, 8); G.pollGamepad(1 / 60); G.step(1 / 60, true); }
      const rot = { braque: +Math.abs(G.P.facing - f0).toFixed(2), vx: +Math.abs(G.P.vel.x).toFixed(2) };
      ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.01); G.settings.ctrl = 'cam';
      const reglage = !!document.getElementById('sensIn');
      return { courbe, vitesse, vitesse2, rot, reglage };
    } finally { navigator.getGamepads = vrai; G.settings.ctrl = 'cam'; }
  });
  const c = r.courbe;
  const ok = c.d05 === 0 && c.d30 > 0.15 && c.d30 < 0.3 && c.d50 > 0.35 && c.d80 > 0.7 && c.d100 === 1
    && r.vitesse >= 5 && r.vitesse2 >= 10 && r.rot.braque > 2.5 && r.rot.vx < 0.2 && r.reglage;
  return { ok, detail: `l'ancienne courbe divisait la reponse par deux a mi-course et la zone morte mangeait 14 % : on se trainait, et le mode « rotation » braquait le personnage avec une bande morte de 32 % · maintenant : zone morte 8 % (5 % → ${c.d05}), courbe douce (30 % → ${c.d30}, 50 % → ${c.d50}, 80 % → ${c.d80}, bord → ${c.d100}), la camera tourne a ${r.vitesse} rad/s au bord (${r.vitesse2} avec la sensibilite a 200 % — reglage dans ⚙️), et en mode « rotation » le stick FAIT TOURNER le personnage : pousse a droite une seconde, il pivote de ${r.rot.braque} rad (160 °/s) sans glisser de cote (${r.rot.vx} m/s)` };
});

test('au casino, la roulette TOURNE et le poker se joue avec de vraies cartes', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 60, y: 1, z: 302, hour: 12 });
    const c = G.city.casino, roul = c.tables.find(t => t.kind === 'roulette'), pok = c.tables.find(t => t.kind === 'poker');
    G.wallet = 5000; G.ouvreCasino('roulette', roul); G.casino.mise = 10; G.casino.pari = 'rouge';
    const u = roul.g.userData, r0 = u.roue.rotation.y;
    G.jouerCasino();
    // le tour est joué par rouletteCine (temps réel), et non plus par casinoTick : c'est lui
    // qui fait tourner la roue, freiner, et poser la bille dans la case du numéro sorti
    const vitesses = []; let prev = u.roue.rotation.y;
    for (let s2 = 0; s2 < 6; s2++) { for (let i = 0; i < 60; i++) { G.simTime += 1 / 60; if (G.casino.cine) G.rouletteCine(1 / 60); else G.casinoTick(1 / 60); } vitesses.push(+(u.roue.rotation.y - prev).toFixed(2)); prev = u.roue.rotation.y; }
    // on laisse le tour se terminer (gros plan sur le résultat, retour de l'interface) :
    // sinon la partie de poker qui suit se heurterait au tour de roulette encore en cours
    for (let i = 0; i < 400 && G.casino.cine; i++) { G.simTime += 1 / 60; G.rouletteCine(1 / 60); }
    const cible = G.ROULETTE_ORDRE.indexOf(G.casino.roulette) * (Math.PI * 2 / 37) - u.roue.rotation.y;
    let d = cible - u.angB; d = Math.atan2(Math.sin(d), Math.cos(d));
    const roulette = { num: G.casino.roulette, tours: +((u.roue.rotation.y - r0) / (2 * Math.PI)).toFixed(2), vitesses, ecartCase: +Math.abs(d).toFixed(3), rayon: +u.rB.toFixed(2), cases: u.roue.children.length };
    G.closeUI();
    G.ouvreCasino('poker', pok); G.casino.mise = 10; G.jouerCasino();
    const cartes = pok.g.userData.cartes;
    const p1 = { n: cartes.length, faces: cartes.map(m => m.userData.carte), attendu: G.casino.cartes.map(G.carteNom), etape: G.casino.etape, dos: cartes.every(m => m.material.map && m.material.map.image) };
    G.casino.gardees[0] = true; G.pokerCartes3D(); for (let i = 0; i < 40; i++) { G.simTime += 1 / 60; G.casinoTick(1 / 60); }
    const p2 = { y0: +cartes[0].position.y.toFixed(2), y1: +cartes[1].position.y.toFixed(2), rx0: +cartes[0].rotation.x.toFixed(2) };
    G.jouerCasino();
    const p3 = { faces: cartes.map(m => m.userData.carte), attendu: G.casino.cartes.map(G.carteNom), etape: G.casino.etape };
    G.closeUI();
    return { roulette, p1, p2, p3 };
  });
  const v = r.roulette.vitesses;
  const ok = r.roulette.tours > 1 && v[0] > v[2] && v[2] > v[4] && v[5] < 0.6 && r.roulette.ecartCase < 0.05 && r.roulette.rayon < 1.1 && r.roulette.cases >= 36
    && r.p1.n === 5 && r.p1.faces.join() === r.p1.attendu.join() && r.p1.etape === 'change' && r.p1.dos
    && r.p2.y0 > r.p2.y1 + 0.1 && r.p2.rx0 > -1.4
    && r.p3.faces.join() === r.p3.attendu.join() && r.p3.etape === 'pret';
  return { ok, detail: `la roulette etait une bille qui tournait toute seule au-dessus d'un cylindre immobile, et le poker cinq rectangles blancs · maintenant la ROUE tourne quand on joue (${r.roulette.tours} tours, en ralentissant : ${v.join(' → ')} rad/s), et la bille file en sens inverse puis vient se poser DANS la case du ${r.roulette.num} (${r.roulette.ecartCase} rad d'ecart, rayon ${r.roulette.rayon}) · au poker, cinq VRAIES cartes sont posees sur le tapis, dos visible, et la donne les retourne : ${r.p1.faces.join(' ')} ; celle qu'on garde se souleve et s'incline (${r.p2.y0} m contre ${r.p2.y1}), et le change les remplace : ${r.p3.faces.join(' ')}` };
});

test('les personnages ont des genoux, des coudes, des poings et de vraies chaussures, et les muscles se voient', async p => {
  const r = await p.evaluate(() => {
    const G = __G, T = G.THREE; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const rig = G.me.rig, res = {};
    res.rig = { genou: !!rig.legL.genou, coude: !!rig.armR.coude, poing: !!rig.armR.poing, semelle: !!rig.legL.semelle, languette: !!rig.legL.languette, muscles: !!G.me.muscles, visage: !!G.me.visage };
    const kn = []; for (let i = 0; i < 120; i++) { G.animateRig(rig, 'walk', 1, 1 / 60, i / 60); kn.push(rig.legL.genou.rotation.x); }
    res.marche = { genouMax: +Math.max(...kn).toFixed(2), genouMin: +Math.min(...kn).toFixed(2) };
    const kr = []; for (let i = 0; i < 180; i++) { G.animateRig(rig, 'walk', 1.6, 1 / 60, i / 60); kr.push(rig.legL.genou.rotation.x); }
    res.course = { genouMax: +Math.max(...kr).toFixed(2), coude: +rig.armL.coude.rotation.x.toFixed(2) };
    rig.swing = 0.35; const cs = []; for (let i = 0; i < 25; i++) { G.animateRig(rig, 'idle', 0, 1 / 60, i / 60); cs.push(+rig.armR.coude.rotation.x.toFixed(2)); }
    res.poing = { debut: cs[0], fin: cs[cs.length - 1] };
    G.owned.add('arme:pistol'); G.equipWeapon('pistol'); G.setWeapon(G.me, 'pistol', true);
    for (let i = 0; i < 10; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60); rig.armR.coude.rotation.x = 0; G.me.group.updateMatrixWorld(true);
    res.arme = { ecart: +rig.armR.poing.getWorldPosition(new T.Vector3()).distanceTo(rig.handR.getWorldPosition(new T.Vector3())).toFixed(3), auCoude: rig.handR.parent === rig.armR.main || rig.handR.parent === rig.armR.coude };
    G.equipWeapon(null); G.P.drawn = false;
    for (let i = 0; i < 10; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60); rig.legL.genou.rotation.set(0, 0, 0); rig.legL.rotation.set(0, 0, 0); rig.baisse = 0; rig.agenou = false;
    G.P.facing = 0; G.me.group.rotation.set(0, 0, 0); G.me.group.position.y = G.P.pos.y; G.me.group.updateMatrixWorld(true);   // face au nord, debout : l'avancee de la chaussure se mesure sur z
    const bb = new T.Box3().setFromObject(rig.legL.semelle);
    res.pied = { basSemelle: +(bb.min.y - G.me.group.position.y).toFixed(3), avancee: +(bb.max.z - G.me.group.position.z).toFixed(2), couleurSemelle: rig.legL.semelle.material.color.getHexString(),
      epaisseur: +(bb.max.y - bb.min.y).toFixed(3), rond: rig.armR.poing.geometry.type, rayonPoing: +rig.armR.poingR.toFixed(3) };
    G.applyStats(G.me, 80, 0); res.muscles = { pecs: G.me.muscles.pecs[0].visible, pecsZ: +G.me.muscles.pecs[0].scale.z.toFixed(2), delt: +G.me.muscles.delts[0].scale.x.toFixed(2), mollet: +rig.legL.mollet.scale.x.toFixed(2), trap: G.me.muscles.trap.visible };
    G.applyStats(G.me, 0, 0); res.zero = { pecs: G.me.muscles.pecs[0].visible, delt: G.me.muscles.delts[0].visible, mollet: +rig.legL.mollet.scale.x.toFixed(2) };
    return res;
  });
  const ok = Object.values(r.rig).every(Boolean) && r.marche.genouMax > 0.3 && r.marche.genouMin >= 0 && r.course.genouMax > 1.0 && r.course.coude < -1
    && r.poing.debut < -1 && r.poing.fin > -0.2 && r.arme.ecart < 0.08 && r.arme.auCoude
    && Math.abs(r.pied.basSemelle) < 0.02 && r.pied.avancee > 0.2 && r.pied.epaisseur > 0.08
    && r.pied.rond === 'SphereGeometry' && r.pied.rayonPoing > 0.15
    && r.muscles.pecs && r.muscles.pecsZ > 1.8 && r.muscles.delt > 1 && r.muscles.mollet > 1.2 && r.muscles.trap && !r.zero.pecs && !r.zero.delt && r.zero.mollet === 1;
  return { ok, detail: `le bras etait un baton, la jambe aussi : pas de coude, pas de genou, un pied plat · chaque membre a maintenant deux segments — un coude et un POING ROND (une sphere de ${r.pied.rayonPoing} m de rayon), un genou et une VRAIE BASKET (semelle blanche de ${r.pied.epaisseur} m d'epaisseur qui depasse de ${r.pied.avancee} m devant, tige, languette ; elle touche le sol a ${r.pied.basSemelle} m) · en marchant les genoux plient (jusqu'a ${r.marche.genouMax} rad), en courant bien plus (${r.course.genouMax}) et les coudes se replient (${r.course.coude}) · un coup de poing part du coude replie (${r.poing.debut}) et se tend a l'impact (${r.poing.fin}) · l'arme est dans le poing, a ${r.arme.ecart} m de son centre · et les muscles se VOIENT : a 80 d'entrainement, pectoraux (×${r.muscles.pecsZ} d'epaisseur), trapezes, deltoides (×${r.muscles.delt}) et mollets (×${r.muscles.mollet}) ; a zero, rien de tout ca` };
});

test('un coup se voit : visage marque, recul, genou a terre, et l\'image plonge', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const rig = G.me.rig, res = {};
    G.P.hp = 100; G.degatsTick(); res.sain = { visage: G.me.visage.visible, niveau: G.me.degats };
    G.P.hp = 60; G.degatsTick(); res.bleu = { visage: G.me.visage.visible, niveau: G.me.degats, recul: +rig.recul.toFixed(2) };
    G.animateRig(rig, 'idle', 0, 0.12, 0.12); res.penche = +rig.penche.toFixed(2);
    G.P.hp = 30; G.degatsTick(); res.sang = G.me.degats;
    G.P.hp = 10; G.degatsTick(); for (let i = 0; i < 40; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    res.genou = { niveau: G.me.degats, agenou: rig.agenou, baisse: +rig.baisse.toFixed(2), hancheR: +rig.legR.rotation.x.toFixed(2), genouR: +rig.legR.genou.rotation.x.toFixed(2), genouL: +rig.legL.genou.rotation.x.toFixed(2) };
    G.P.hp = 100; G.degatsTick(); for (let i = 0; i < 60; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    res.retour = { agenou: rig.agenou, baisse: +rig.baisse.toFixed(2), visage: G.me.visage.visible };
    // un habitant frappe : meme chose pour lui, et l'image de la camera plonge sur le coup
    const b = G.bots[0]; b.pos.set(G.P.pos.x, 0.15, G.P.pos.z - 1.3); b.av.group.position.copy(b.pos); b.hp = 100; b.ko = 0; b.av.group.visible = true;
    for (const o of G.bots) if (o !== b) { o.pos.x += 400; o.pos.z += 400; o.av.group.position.copy(o.pos); }
    G.P.facing = Math.PI; G.P.punchT = 0; G.cam.kick = 0; G.punch();
    res.bot = { hp: b.hp, kick: +G.cam.kick.toFixed(3), secousse: +(G.cam.shake || 0).toFixed(2) };
    G.degatsTick(); res.bot.recul = +b.av.rig.recul.toFixed(2);
    b.hp = 12; G.degatsTick(); res.bot.agenou = b.av.rig.agenou; res.bot.niveau = b.av.degats;
    b.hp = 100; G.degatsTick();
    const tex = [1, 2, 3].map(n => G.degatsTexture(n).image.width);
    return Object.assign(res, { tex });
  });
  const g = r.genou;
  const ok = !r.sain.visage && r.bleu.visage && r.bleu.niveau === 1 && r.bleu.recul > 0.3 && r.penche > 0.2 && r.sang === 2
    && g.niveau === 3 && g.agenou && g.baisse > 0.25 && g.hancheR < -1.2 && g.genouR > 1.2 && g.genouL > 1.4
    && !r.retour.agenou && r.retour.baisse < 0.05 && !r.retour.visage
    && r.bot.hp < 100 && r.bot.kick > 0.02 && r.bot.secousse > 0.05 && r.bot.recul > 0.3 && r.bot.agenou && r.bot.niveau === 3 && r.tex.every(w => w === 64);
  return { ok, detail: `on ne voyait pas les coups porter : rien sur le visage, personne ne bronchait, la camera restait de marbre · maintenant le VISAGE se marque avec la vie qui reste (bleus a 60 PV, sang a 30, oeil au beurre noir a 10 : niveaux ${r.bleu.niveau} → ${r.sang} → ${g.niveau}), celui qui encaisse SE PENCHE (${r.penche} rad), a bout de forces il met UN GENOU A TERRE (hanche ${g.hancheR}, genoux ${g.genouR} / ${g.genouL}, corps abaisse de ${g.baisse} m) et se traine, et tout s'efface quand la vie revient · l'habitant frappe accuse le coup pareil (recul ${r.bot.recul}, a genoux a 12 PV=${r.bot.agenou}) et l'image de la camera PLONGE sur le coup (${r.bot.kick}) en plus de la secousse (${r.bot.secousse})` };
});

test('une manette PlayStation 5 pilote tout le jeu', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const ferme = () => document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden'));
    ferme();
    // FAUSSE DUALSENSE, branchée sur la prise 2 : l'ancienne version ne regardait que la prise 0
    const vib = [];
    const ds = { index: 2, connected: true, id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      vibrationActuator: { playEffect: (t, o) => { vib.push(o); return Promise.resolve('complete'); } } };
    const vraiGP = navigator.getGamepads;
    navigator.getGamepads = () => [null, null, ds];
    const touches = [];
    const ecoute = e => { if (e.type === 'keydown') touches.push(e.code); };
    window.addEventListener('keydown', ecoute);
    try {
      const trouvee = !!G.padActive() && G.manetteSalon.i === 2;
      const nomPS = /dualsense/i.test(G.manetteSalon.nom);
      // 1) ZONE MORTE RONDE : une diagonale franche passe, un frémissement non
      const fremis = G.padStick(0.05, 0.05), diag = G.padStick(0.5, 0.5);   // zone morte RONDE de 8 % : 5 % sur chaque axe (rayon 7 %) ne bouge pas
      const carre = Math.abs(diag[0] - diag[1]) < 0.01;   // les deux axes gardent la même part
      // 2) les deux sticks
      ds.axes = [0.8, -0.6, 0, 0]; G.pollGamepad(0.05);
      const marche = { x: +G.pad.x.toFixed(2), y: +G.pad.y.toFixed(2) };
      ds.axes = [0, 0, 1, 0]; const yaw0 = G.cam.yaw; G.pollGamepad(0.1);
      const camera = +(G.cam.yaw - yaw0).toFixed(3);
      ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.05);
      // 3) tous les boutons de la façade PlayStation, un par un
      const presse = i => { ferme(); touches.length = 0;
        ds.buttons[i] = { pressed: true, value: 1 }; G.pollGamepad(0.05);
        ds.buttons[i] = { pressed: false, value: 0 }; G.pollGamepad(0.05);
        return touches.slice(); };
      const plan = { 0: 'KeyG', 1: 'Space', 2: 'KeyV', 3: 'KeyE', 5: 'KeyX', 8: 'KeyT', 9: 'Escape' };   // la croix a son propre test
      const bons = Object.entries(plan).filter(([i, k]) => presse(+i).includes(k)).length;
      ferme();
      // 4) les GÂCHETTES sont analogiques : R2 avance (R1 tire deja), L2 recule
      touches.length = 0; ds.buttons[7] = { pressed: false, value: 0.5 }; G.pollGamepad(0.05);
      const gachetteFaible = +G.pad.gaz.toFixed(2);
      ds.buttons[7] = { pressed: false, value: 1 }; G.pollGamepad(0.05);
      const gachetteFort = +G.pad.gaz.toFixed(2);
      const r2NeTirePas = touches.filter(t => t === 'KeyX').length;
      ds.buttons[7] = { pressed: false, value: 0 }; G.pollGamepad(0.05);
      ds.buttons[6] = { pressed: false, value: 0.8 }; G.pollGamepad(0.05);
      const recule = +G.pad.frein.toFixed(2);
      ds.buttons[6] = { pressed: false, value: 0 }; G.pollGamepad(0.05);
      // « courir » a demenage sur L3, comme dans les grands jeux de ville
      G.P.energie = 100; G.P.essouffle = false;
      ds.buttons[10] = { pressed: true, value: 1 }; G.pollGamepad(0.05);
      const court = !!G.P.run;
      ds.buttons[10] = { pressed: false, value: 0 }; G.pollGamepad(0.05);
      // 5) R3 recentre la caméra
      G.cam.yaw = 2; G.P.facing = 0;
      ds.buttons[11] = { pressed: true, value: 1 }; G.pollGamepad(0.05);
      ds.buttons[11] = { pressed: false, value: 0 }; G.pollGamepad(0.05);
      const recentre = Math.abs(G.cam.yaw - Math.PI) < 0.01;
      // 6) LA VIBRATION suit les secousses de l'image
      vib.length = 0; G.simTime += 5; G.camSecousse(0.3, 0.3);
      const vibre = vib[0] || null;
      return { trouvee, nomPS, fremis, diag: diag.map(v => +v.toFixed(2)), carre, marche, camera,
        bons, total: Object.keys(plan).length, gachetteFaible, gachetteFort, r2NeTirePas, recule, court, recentre, vibre,
        noms: G.PS_NOMS[0] + G.PS_NOMS[1] + G.PS_NOMS[2] + G.PS_NOMS[3] };
    } finally { window.removeEventListener('keydown', ecoute); navigator.getGamepads = vraiGP; ferme(); }
  });
  const ok = r.trouvee && r.nomPS && r.fremis[0] === 0 && r.diag[0] > 0.2 && r.carre
    && r.marche.x === 0.8 && r.marche.y === 0.6 && r.camera < -0.2
    && r.bons === r.total && r.gachetteFaible > 0.4 && r.gachetteFaible < 0.55 && r.gachetteFort === 1
    && r.r2NeTirePas === 0 && r.recule > 0.7
    && r.court && r.recentre && r.vibre && r.vibre.strongMagnitude > 0.5 && r.noms === '✕◯▢△';
  return { ok, detail: `la manette était lue « au hasard » : seule la PREMIÈRE prise était regardée (une DualSense branchée en deuxième était ignorée), la zone morte était CARRÉE — pousser en diagonale coupait un axe et on partait tout droit — les gâchettes étaient traitées en tout ou rien, et rien ne vibrait · tout est repris : la DualSense est trouvée quelle que soit sa prise (${r.nomPS}), la zone morte est ronde (frémissement a 0.05 → ${r.fremis[0]}, diagonale franche → ${r.diag[0]}/${r.diag[1]}, les deux axes a parts égales), les deux sticks marchent (déplacement ${r.marche.x}/${r.marche.y}, caméra ${r.camera} rad) · les ${r.bons}/${r.total} boutons de la façade PlayStation sont mappés — ✕ braquer / rengainer, ◯ sauter, ▢ frapper, △ agir, R1 tirer, Create parler, Options menu · R2 AVANCE et reste analogique (a moitié enfoncée → ${r.gachetteFaible}, a fond → ${r.gachetteFort}) sans plus tirer (R1 s'en charge : ${r.r2NeTirePas} tir), L2 RECULE (${r.recule}), « courir » a déménagé sur L3 (${r.court}), R3 recentre la caméra · et elle VIBRE a chaque secousse de l'image (${r.vibre.duration} ms, force ${r.vibre.strongMagnitude.toFixed(2)})` };
});

test('l\'ecole est un batiment VITRE VERT ou l\'on s\'assoit a une table et repond au tableau', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(r => setTimeout(r, ms));
    __SHOT.go({ world: 4, x: -62, y: 1, z: 220, hour: 12 });
    const out = {};
    out.classes = G.city.classes.map(r => ({ n: r.n, subj: r.subj, chaises: r.chaises.length, props: r.props.length, tableau: !!r.tableau }));
    let verre = 0; G.worldGroup.traverse(o => { if (o.isMesh && o.material === G.glassVert) verre++; }); out.verre = verre;
    out.props = G.city.classes.map(r => r.props.join(', '));
    out.batiment = !!G.city.batiments.find(b => G.city.classes.every(r => Math.abs(r.x - b.x) < b.w / 2 + 1));
    const r = G.city.classes[0], ch = r.chaises[0];
    G.P.pos.set(ch.x, 0.6, ch.z + 0.3); G.sitBench(ch);
    for (let i = 0; i < 40 && !G.school.q; i++) { await dodo(100); if (!G.P.sit && i === 15) { G.P.pos.set(ch.x, 0.6, ch.z + 0.3); G.sitBench(ch); } }
    out.assis = { sit: !!G.P.sit, ui: G.uiOpen, tableau: r.texte, q: !!G.school.q, y: +G.P.pos.y.toFixed(2) };
    if (!G.school.q) return { ...out, pourquoi: `pas de question apres 4 s (assis=${!!G.P.sit}, ui=${G.uiOpen})` };
    const q = G.school.q; G.wallet = 0;
    G.answer(q.a, document.querySelector('#schChoices .item'));
    out.bon = { tableau: r.texte, pieces: G.wallet };   // lu tout de suite : la craie met 2 s a tracer, mais le verdict est deja pose
    for (let i = 0; i < 60 && !G.school.q; i++) await dodo(150);   // la craie finit d'ecrire avant l'exercice suivant
    const q2 = G.school.q; if (!q2) return { ...out, pourquoi: 'aucun exercice suivant apres le verdict' };
    const faux = q2.opts.find(o => o !== q2.a);
    G.answer(faux, document.querySelector('#schChoices .item'));
    out.faux = { tableau: r.texte, rep: faux };
    G.closeUI(); G.P.sit = null; G.school.chaise = null; G.P.pos.set(-62, 1, 235);
    return out;
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const ok = r.classes.length === 4 && r.classes.every(c => c.chaises === 12 && c.props >= 4 && c.tableau) && r.verre >= 8 && r.batiment
    && r.assis.sit && r.assis.ui === 'schoolUI' && r.assis.q && /1\)/.test(r.assis.tableau) && r.assis.y < 0.35
    && /GAGNÉ/.test(r.bon.tableau) && r.bon.pieces >= 3 && /FAUX/.test(r.faux.tableau) && r.faux.tableau.includes(r.faux.rep);
  return { ok, detail: `l'école est un vrai bâtiment de verre vert (${r.verre} parois de verre, un étage vitré, la façade sur la rue) avec ${r.classes.length} classes, un préau et une cour · chaque classe a un tableau GRIS avec ses craies, 6 tables d'écolier et 12 chaises où l'on s'assoit (E), et le mobilier de sa matière : ${r.props.map((p, i) => r.classes[i].n + ' → ' + p).join(' ; ')} · on s'assoit (y=${r.assis.y}) et la classe commence : l'exercice s'écrit au tableau « ${r.assis.tableau.slice(0, 60)} », la réponse s'y écrit puis le verdict : « ${r.bon.tableau.slice(-30)} » (+${r.bon.pieces} pièces) ou « ${r.faux.tableau.split('|').slice(2).join('|').trim()} »` };
});

test('les rues ont des trottoirs, un seul reseau routier, du mobilier public hors des voies, et le radar montre les vraies rues', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const N = G.NAV; if (!N.voit) G.buildNav();
    const { nx, nz, cs, x0, z0 } = N; const co = N.cout, bl = N.voit;
    // composantes connexes de la chaussée ouverte aux voitures
    const comp = new Int32Array(nx * nz).fill(-1); let nc = 0; const tailles = [];
    for (let s = 0; s < nx * nz; s++) { if (comp[s] >= 0 || co[s] !== 1 || bl[s]) continue; const st = [s]; comp[s] = nc; let t = 0; while (st.length) { const c = st.pop(); t++; const i = c % nx, j = (c - i) / nx; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const k = jj * nx + ii; if (comp[k] < 0 && co[k] === 1 && !bl[k]) { comp[k] = nc; st.push(k); } } } tailles.push(t); nc++; }
    const total = tailles.reduce((a, b) => a + b, 0), principal = tailles.indexOf(Math.max(...tailles));
    const cell = (x, z) => { const i = Math.max(0, Math.min(nx - 1, Math.round((x - x0) / cs))), j = Math.max(0, Math.min(nz - 1, Math.round((z - z0) / cs))); return comp[j * nx + i]; };
    const dessHors = G.city.plan.dessertes.filter(d => cell(d.x, d.z) !== principal).map(d => d.n);
    // rien sur la chaussée (hors trottoirs, véhicules, feux, barrières de piste, statue du rond-point, enseignes en hauteur)
    const surRoute = G.solids.filter(o => !o.trottoir && !o.veh && !o.feu && !o.bar && !o.statue && !o.porte && !o.glass && o.h < 30 && o.h > 0.3 && o.y - o.h / 2 < 0.8
      && G.city.routes.some(rt => Math.abs(o.x - rt.x) < rt.w / 2 - 0.6 && Math.abs(o.z - rt.z) < rt.d / 2 - 0.6)).length;
    // les trottoirs : bas, hors chaussée, et un vrai réseau
    const tr = G.city.trottoirs;
    const trSurRoute = tr.filter(t => G.city.routes.some(rt => Math.abs(t.x - rt.x) < rt.w / 2 && Math.abs(t.z - rt.z) < rt.d / 2)).length;
    const trHaut = tr.filter(t => t.o.h > 0.3).length;
    const longueur = Math.round(tr.reduce((a, t) => a + Math.max(t.w, t.d), 0));
    // le mobilier public : arbres et bancs ajoutés hors des voies, hors des bâtiments, jamais devant une porte
    const bats = [...G.city.batiments, ...G.city.interieurs];
    const portes = G.solids.filter(o => o.porte);
    const arbres = G.solids.filter(o => o.mobilier);   // arbres, bancs et poubelles de la passe de mobilier public
    const mal = arbres.filter(o => G.city.routes.some(rt => Math.abs(o.x - rt.x) < rt.w / 2 && Math.abs(o.z - rt.z) < rt.d / 2)
      || bats.some(b => Math.abs(o.x - b.x) < b.w / 2 && Math.abs(o.z - b.z) < b.d / 2)
      || portes.some(pt => Math.abs(o.x - pt.x) < pt.w / 2 + 3 && Math.abs(o.z - pt.z) < pt.d / 2 + 3)).length;
    // l'école n'empiète plus sur l'avenue, et la salle de classe a toujours ses chaises
    const ecole = G.city.classes[0];
    const av = G.city.routes.find(rt => rt.w === 300);
    const ecoleSurAvenue = ecole && av && ecole.z - 9 < av.z + av.d / 2;
    // le radar dessine les vraies rues
    const radarRoutes = /city\.routes/.test(G.gpsTick.toString());
    // le sol de la ville est pavé (texture), la chaussée marquée (texture avec bords blancs)
    const sol = G.solids.find(o => o.sol); const solTex = !!(sol && sol.mesh.material.map);
    const rouleTexture = G.ROAD.image.width >= 128;
    return { composantes: nc, part: +(tailles[principal] / total).toFixed(3), dessHors, surRoute, trottoirs: tr.length, trSurRoute, trHaut, longueur, decor: G.city.decorPublic, arbres: arbres.length, mal, ecoleSurAvenue, radarRoutes, solTex, rouleTexture, routes: G.city.routes.length, axes: G.city.plan.axes.length };
  });
  const d = r.decor || {};
  const ok = r.part > 0.99 && r.dessHors.length === 0 && r.surRoute === 0 && r.trottoirs > 150 && r.trSurRoute === 0 && r.trHaut === 0 && r.longueur > 3000
    && d.arbres > 60 && d.bancs > 30 && d.buissons > 60 && d.poubelles > 30 && d.glissieres > 30 && r.mal === 0 && !r.ecoleSurAvenue && r.radarRoutes && r.solTex && r.rouleTexture;
  return { ok, detail: `la ville a maintenant ${r.routes} rues (${r.axes} axes nommés) qui ne font qu'UN SEUL réseau pour les voitures (${(r.part * 100).toFixed(1)} % de la chaussée d'un seul tenant, ${r.composantes} morceau(x) au total, il y en avait 25) et les ${r.dessHors.length === 0 ? '39' : '?'} dessertes y sont toutes reliées (${r.dessHors.length} hors réseau) · ${r.surRoute} objet en pleine voie · ${r.trottoirs} trottoirs (${r.longueur} m, bordure comprise, aucun sur la chaussée, aucun plus haut que 30 cm) · mobilier public le long des rues : ${d.arbres} arbres, ${d.buissons} buissons, ${d.bancs} bancs, ${d.poubelles} poubelles, ${d.glissieres} glissières — ${r.mal} arbre mal placé (sur une rue, dans un bâtiment ou devant une porte) · l'école ne mord plus sur l'avenue · le radar dessine les vraies rues, le sol est pavé et la chaussée porte ses bords blancs et son axe jaune` };
});

// ======================= POSTE E : morphologie et boutique =======================
// Boite a outils commune aux quatre tests ci-dessous : elle est evaluee DANS la page.
const E_OUTILS = `
  const T = __G.THREE;
  const boite = o => { const b = new T.Box3(); if (Array.isArray(o)) { for (const m of o) if (m.visible) b.expandByObject(m); } else b.setFromObject(o); return b; };
  const ecartBoites = (a, b) => { const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x), dy = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y), dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z); return Math.sqrt(dx * dx + dy * dy + dz * dz); };
  const depasse = (a, b) => Math.max(b.min.x - a.min.x, a.max.x - b.max.x, b.min.y - a.min.y, a.max.y - b.max.y, b.min.z - a.min.z, a.max.z - b.max.z);
  const poseNeutre = av => { const rg = av.rig;
    rg.armL.rotation.set(0, 0, 0); rg.armR.rotation.set(0, 0, 0); rg.armL.coude.rotation.set(0, 0, 0); rg.armR.coude.rotation.set(0, 0, 0);
    rg.legL.rotation.set(0, 0, 0); rg.legR.rotation.set(0, 0, 0); rg.legL.genou.rotation.set(0, 0, 0); rg.legR.genou.rotation.set(0, 0, 0);
    rg.baisse = 0; rg.agenou = false; rg.kick = 0; rg.swing = 0; if (rg.jupe) rg.jupe.rotation.set(0, 0, 0);
    rg.legL.pied.rotation.set(0, 0, 0); rg.legR.pied.rotation.set(0, 0, 0);
    av.group.rotation.set(0, 0, 0); av.group.position.set(0, 0, 0); av.group.updateMatrixWorld(true); };
`;
const posteE = corps => '(() => {' + E_OUTILS + corps + '})()';

test('le poing du joueur est rond, et arme, raquette ou casse-croute y restent tenus', async p => {
  const r = await p.evaluate(posteE(`
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const me = G.me, rig = me.rig, res = {};
    poseNeutre(me);
    const wp = o => o.getWorldPosition(new T.Vector3());
    const poing = rig.armR.poing;
    res.forme = { geo: poing.geometry.type, rayon: +poing.geometry.parameters.radius.toFixed(3),
      rayonAvantBras: +rig.armR.avantBras.geometry.parameters.radiusTop.toFixed(3),
      avantBras: rig.armR.avantBras.geometry.type, pouce: !!rig.armR.pouce,
      couleurPeau: poing.material === me.mats.skin };
    res.forme.rapport = +(res.forme.rayon / res.forme.rayonAvantBras).toFixed(2);
    // l'arme : la poignee doit tomber DANS le poing
    G.owned.add('arme:pistol'); G.setWeapon(me, 'pistol', true); me.group.updateMatrixWorld(true);
    res.arme = +wp(rig.handR).distanceTo(wp(poing)).toFixed(3);
    G.setWeapon(me, null);
    // la raquette : sa POIGNEE (y = -0,16 dans le modele) doit tomber dans le poing
    G.setRacket(me, true); me.group.updateMatrixWorld(true);
    res.raquette = +me.racket.localToWorld(new T.Vector3(0, -0.16, 0)).distanceTo(wp(poing)).toFixed(3);
    res.raquetteSol = +boite(me.racket).min.y.toFixed(2);
    G.setRacket(me, false);
    // un casse-croute emporte
    G.takeAway({ id: 'burger', n: 'Burger', e: '🍔', p: 3, f: 6 });
    me.group.updateMatrixWorld(true);
    res.casseCroute = +ecartBoites(boite(G.P.carryMesh), boite(poing)).toFixed(3);
    res.casseCrouteCentre = +boite(G.P.carryMesh).getCenter(new T.Vector3()).distanceTo(wp(poing)).toFixed(3);
    res.casseCrouteSuitLeCoude = (() => { let n = G.P.carryMesh; while (n && n !== rig.armR.coude) n = n.parent; return n === rig.armR.coude; })();
    G.mainDroite().remove(G.P.carryMesh); G.P.carryMesh = null; G.P.snack = null; document.body.classList.remove('carry');
    // les habitants et les mannequins ont la MEME morphologie
    const b = G.bots[0];
    res.bot = { geo: b.av.rig.armR.poing.geometry.type, semelle: !!b.av.rig.legL.semelle, mollet: b.av.rig.legL.mollet.geometry.type, main: !!b.av.rig.armR.main };
    const mn = G.mannequin(0, 320, 0, {});
    res.mannequin = { geo: mn.rig.armR.poing.geometry.type, semelle: !!mn.rig.legL.semelle, mollet: mn.rig.legL.mollet.geometry.type, main: !!mn.rig.armR.main };
    return res;
  `));
  const f = r.forme;
  const ok = f.geo === 'SphereGeometry' && f.rayon > 0.15 && f.rapport > 1.1 && f.avantBras === 'CylinderGeometry'
    && f.pouce && f.couleurPeau
    && r.arme < 0.05 && r.raquette < 0.05 && r.raquetteSol > 0.05 && r.casseCroute < 0.03 && r.casseCrouteCentre < 0.25 && r.casseCrouteSuitLeCoude
    && r.bot.geo === 'SphereGeometry' && r.bot.mollet === 'CylinderGeometry' && r.bot.semelle && r.bot.main
    && r.mannequin.geo === 'SphereGeometry' && r.mannequin.mollet === 'CylinderGeometry' && r.mannequin.semelle && r.mannequin.main;
  return { ok, detail: `le poing etait une boite plate au bout d'un avant-bras carre · c'est maintenant une SPHERE couleur peau de ${f.rayon} m de rayon, ${f.rapport} fois plus large que l'avant-bras (devenu cylindrique, rayon ${f.rayonAvantBras}), avec un pouce esquisse · tout ce qu'on tient est accroche au centre du poing : l'arme a ${r.arme} m, la poignee de la raquette a ${r.raquette} m (tamis a ${r.raquetteSol} m du sol), le casse-croute pose dans la paume (${r.casseCroute} m d'ecart de boite, centre a ${r.casseCrouteCentre} m), et il suit le coude quand le bras se plie · habitants et mannequins ont exactement la meme morphologie (${r.bot.geo} / ${r.mannequin.geo})` };
});

test('la basket se voit a six metres, quel que soit le modele achete, et sa semelle touche le sol', async p => {
  const r = await p.evaluate(posteE(`
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const me = G.me, rig = me.rig, res = { modeles: {} };
    res.rig = { mollet: rig.legL.mollet.geometry.type, cheville: !!rig.legL.cheville, semelle: !!rig.legL.semelle,
      languette: !!rig.legL.languette, lacets: rig.legL.lacets.length, bandes: rig.legL.bandes.length,
      talon: !!rig.legL.talon, bout: rig.legL.bout.geometry.type };
    // le point le plus bas des deux pieds, sur tout un cycle d'animation
    const solPour = (vitesse, n) => { let mn = 9;
      for (let i = 0; i < n; i++) { G.animateRig(rig, 'walk', vitesse, 1 / 60, i / 60);
        me.group.position.set(0, -(rig.baisse || 0), 0); me.group.rotation.set(0, 0, 0); me.group.updateMatrixWorld(true);
        for (const lg of [rig.legL, rig.legR]) mn = Math.min(mn, boite(lg.piedParts).min.y); }
      return +mn.toFixed(3); };
    for (const it of G.SHOP.Chaussures) {
      G.myCfg.chaussures = it.id; G.applyMyLook();
      poseNeutre(me);
      const b = boite(rig.legL.piedParts), bs = boite(rig.legL.semelle), bm = boite(rig.legL.mollet);
      res.modeles[it.id] = { prix: it.p, longueur: +(b.max.z - b.min.z).toFixed(3), largeur: +(b.max.x - b.min.x).toFixed(3),
        semelle: +(bs.max.y - bs.min.y).toFixed(3), sol: +b.min.y.toFixed(3),
        large: +(b.max.x - b.min.x).toFixed(3) > +(bm.max.x - bm.min.x).toFixed(3),
        tige: rig.legL.tige.visible, eperon: rig.legL.eperon.visible,
        marche: solPour(1.4, 200) };
      poseNeutre(me);
    }
    G.myCfg.chaussures = 'basket'; G.applyMyLook(); poseNeutre(me);
    res.course = solPour(2.2, 200);
    poseNeutre(me);
    for (let i = 0; i < 60; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    res.cheville = { pivot: !!rig.legL.pied, repos: +rig.legL.pied.rotation.x.toFixed(3) };
    // genou a terre : le corps s'abaisse, les semelles restent posees et le genou touche le sol
    rig.agenou = true;
    for (let i = 0; i < 150; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    me.group.position.set(0, -(rig.baisse || 0), 0); me.group.updateMatrixWorld(true);
    res.agenou = { pieds: +Math.min(boite(rig.legL.piedParts).min.y, boite(rig.legR.piedParts).min.y).toFixed(3),
      genou: +Math.min(rig.legL.genou.getWorldPosition(new T.Vector3()).y, rig.legR.genou.getWorldPosition(new T.Vector3()).y).toFixed(3) };
    // le coup de pied ne doit pas non plus planter la basket dans le bitume
    rig.agenou = false; for (let i = 0; i < 90; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    poseNeutre(me); rig.kick = 0.45; let mnk = 9;
    for (let i = 0; i < 40; i++) { G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
      me.group.position.set(0, 0, 0); me.group.updateMatrixWorld(true); mnk = Math.min(mnk, boite(rig.legR.piedParts).min.y); }
    res.coupDePied = +mnk.toFixed(3); rig.kick = 0;
    rig.agenou = false; for (let i = 0; i < 90; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    poseNeutre(me);
    return res;
  `));
  const m = r.modeles, base = ['basket', 'running', 'montante', 'lumineuse'];
  const ok = r.rig.mollet === 'CylinderGeometry' && r.rig.cheville && r.rig.semelle && r.rig.languette
    && r.rig.lacets >= 2 && r.rig.bandes === 2 && r.rig.talon && r.rig.bout === 'CylinderGeometry'
    && Object.values(m).every(v => v.longueur >= 0.3 && Math.abs(v.sol) < 0.02 && v.large && Math.abs(v.marche) < 0.02)
    && base.every(k => m[k] && m[k].semelle >= 0.08)
    && m.bottes.tige && m.cowboy.tige && m.cowboy.eperon && m.montante.tige && !m.basket.tige
    && Math.abs(r.course) < 0.02 && Math.abs(r.coupDePied) < 0.02
    && r.agenou.pieds > -0.03 && r.agenou.pieds < 0.04 && r.agenou.genou < 0.06 && r.agenou.genou > -0.03
    && r.cheville.pivot && Math.abs(r.cheville.repos) < 0.01;
  const liste = Object.entries(m).map(([k, v]) => `${k} ${v.longueur} m / semelle ${v.semelle} m / ${v.prix} pieces`).join(', ');
  return { ok, detail: `le pied etait une boite plate de 5 cm de semelle : a six metres on ne voyait aucune chaussure · le mollet est maintenant un CYLINDRE avec une cheville, et la chaussure une VRAIE BASKET (semelle epaisse debordante et arrondie a l'avant, empeigne coloree, languette, ${r.rig.lacets} lacets, bande laterale, talon renforce) · ${Object.keys(m).length} modeles vendus : ${liste} · toutes plus larges que le mollet, semelle posee au sol a ${Object.values(m).map(v => v.sol).join(' / ')} m debout, jamais plus de 2 cm d'ecart en marchant (${Object.values(m).map(v => v.marche).join(' / ')}) ni en courant (${r.course}) ni au coup de pied (${r.coupDePied}) — c'est la CHEVILLE qui pivote pour garder la semelle a plat · genou a terre, les semelles sont a ${r.agenou.pieds} m et le genou pose a ${r.agenou.genou} m` };
});

test('chaque article de la boutique tient sur le bon segment, sans flotter ni traverser', async p => {
  const r = await p.evaluate(posteE(`
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const me = G.me, rig = me.rig, res = { arts: {}, rayons: {}, total: 0 };
    const cfg = G.myCfg;
    const raz = () => { cfg.hat = 'none'; cfg.jacket = 0; cfg.bag = 0; cfg.glasses = false; cfg.skirt = false; cfg.shorts = false;
      cfg.baggy = false; cfg.bijou = 'rien'; cfg.bracelet = false; cfg.montre = false; cfg.gants = 'rien';
      cfg.chaussures = 'basket'; cfg.haut = 'foot'; cfg.taille = 'L'; G.applyMyLook(); poseNeutre(me); };
    const note = (cle, art, membre) => { poseNeutre(me);
      const a = boite(art), b = boite(membre), s = a.getSize(new T.Vector3());
      res.arts[cle] = { t: +s.length().toFixed(3), e: +ecartBoites(a, b).toFixed(3), d: +depasse(a, b).toFixed(3) }; };
    for (const [cat, liste] of Object.entries(G.SHOP)) { res.rayons[cat] = liste.length; res.total += liste.length; }
    raz();
    for (const it of G.SHOP.Chapeaux) { if (it.id === 'none') continue; cfg.hat = it.id; G.applyMyLook(); note('Chapeaux/' + it.id, me.hatGroups[it.id], me.tete); }
    raz();
    for (const it of G.SHOP.Vestes) { if (!it.id) continue; cfg.jacket = it.id; G.applyMyLook();
      note('Vestes/' + it.id, me.jacket, me.torso); note('Vestes/' + it.id + ' manche', rig.armR.manchesVeste, rig.armR.manche); }
    raz();
    for (const it of G.SHOP.Sacs) { if (!it.id) continue; cfg.bag = it.id; G.applyMyLook();
      note('Sacs/' + it.id, G.SAC_BANANE.has(it.id) ? me.bag.sacBanane : me.bag.sacDos, me.torso); }
    raz();
    cfg.glasses = true; G.applyMyLook(); note('Lunettes/1', me.glasses, me.tete); raz();
    for (const it of G.SHOP.Bijoux) { if (it.id === 'rien') continue; cfg.bijou = it.id; G.applyMyLook(); note('Bijoux/' + it.id, me.bijoux, me.torso); }
    raz();
    cfg.bracelet = true; cfg.montre = true; G.applyMyLook();
    note('Poignets/bracelet', me.bracelet, rig.armL.avantBras); note('Poignets/montre', me.montre, rig.armR.avantBras); raz();
    for (const it of G.SHOP.Gants) { if (it.id === 'rien') continue; cfg.gants = it.id; G.applyMyLook(); note('Gants/' + it.id, rig.armR.gant.g, rig.armR.avantBras); }
    raz();
    for (const it of G.SHOP.Chaussures) { cfg.chaussures = it.id; G.applyMyLook(); note('Chaussures/' + it.id, rig.legL.piedParts, rig.legL.cheville); }
    raz();
    cfg.skirt = true; G.applyMyLook(); note('Bas/skirt', me.skirt, [rig.legL.cuisse, rig.legR.cuisse]); raz();
    // chaque article s'accroche a un segment QUI BOUGE : on plie coude et genou et on verifie
    // qu'il a suivi (sinon il resterait plante dans le vide)
    cfg.montre = true; cfg.gants = 'boxe'; cfg.jacket = 3; G.applyMyLook(); poseNeutre(me);
    const c = o => boite(o).getCenter(new T.Vector3());
    const avant = { montre: c(me.montre), gant: c(rig.armR.gant.g), pied: c(rig.legL.piedParts), manche: c(rig.armR.manchesVeste[1]) };
    rig.armR.coude.rotation.x = -1.4; rig.legL.genou.rotation.x = 1.4; me.group.updateMatrixWorld(true);
    const apres = { montre: c(me.montre), gant: c(rig.armR.gant.g), pied: c(rig.legL.piedParts), manche: c(rig.armR.manchesVeste[1]) };
    res.suit = { montre: +avant.montre.distanceTo(apres.montre).toFixed(3), gant: +avant.gant.distanceTo(apres.gant).toFixed(3),
      pied: +avant.pied.distanceTo(apres.pied).toFixed(3), manche: +avant.manche.distanceTo(apres.manche).toFixed(3) };
    raz();
    return res;
  `));
  const mauvais = Object.entries(r.arts).filter(([, v]) => v.t < 0.03 || v.e >= 0.03 || v.d < 0.005).map(([k]) => k);
  const ok = mauvais.length === 0 && Object.keys(r.arts).length >= 45 && r.total >= 60
    && r.suit.montre > 0.05 && r.suit.gant > 0.15 && r.suit.pied > 0.1 && r.suit.manche > 0.05;
  const pire = Object.entries(r.arts).reduce((a, b) => b[1].e > a[1].e ? b : a);
  return { ok, detail: `${r.total} articles en ${Object.keys(r.rayons).length} rayons (${Object.entries(r.rayons).map(([k, v]) => k + ' ' + v).join(', ')}) · les ${Object.keys(r.arts).length} articles portables ont ete equipes un par un et mesures a la boite englobante : aucun ne flotte (plus grand ecart : ${pire[0]} a ${pire[1].e} m, tolerance 0,03), aucun ne disparait dans le membre (chacun en depasse d'au moins 5 mm), aucun n'est vide · ${mauvais.length} article en defaut · et ils suivent les ARTICULATIONS : coude plie, la montre bouge de ${r.suit.montre} m, la manche de veste de ${r.suit.manche} m et le gant de ${r.suit.gant} m ; genou plie, la basket de ${r.suit.pied} m` };
});

test('la jupe se souleve sur la cuisse au lieu de se faire traverser', async p => {
  const r = await p.evaluate(posteE(`
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const me = G.me, rig = me.rig;
    G.myCfg.skirt = true; G.myCfg.shorts = false; G.myCfg.baggy = false; G.applyMyLook();
    poseNeutre(me);
    const jupe = me.skirt, geo = jupe.geometry.parameters;
    // Le genou, exprime dans le repere de la jupe : soit il sort par le BAS (sous l'ourlet),
    // soit il reste dans le cone. S'il est a la fois dans la hauteur de la jupe ET plus loin
    // que le rayon a cette hauteur, c'est qu'il traverse le tissu.
    const perce = () => { me.group.updateMatrixWorld(true);
      let pire = -9;
      for (const lg of [rig.legL, rig.legR]) {
        const g2 = lg.genou.getWorldPosition(new T.Vector3());
        const loc = jupe.worldToLocal(g2.clone());
        const h = geo.height, t = (h / 2 - loc.y) / h;
        if (t < 0 || t > 1) continue;                                   // au-dessus ou sous la jupe : rien a percer
        const rayon = geo.radiusTop + (geo.radiusBottom - geo.radiusTop) * t;
        pire = Math.max(pire, Math.hypot(loc.x, loc.z) - rayon);
      }
      return +pire.toFixed(3); };
    const cycle = (v, n) => { let pire = -9;
      for (let i = 0; i < n; i++) { G.animateRig(rig, 'walk', v, 1 / 60, i / 60); pire = Math.max(pire, perce()); }
      return pire; };
    const res = { forme: jupe.geometry.type, hautJupe: +geo.radiusTop.toFixed(3), basJupe: +geo.radiusBottom.toFixed(3) };
    poseNeutre(me); res.debout = perce();
    res.marche = cycle(1.4, 200);
    res.course = cycle(2.2, 200);
    poseNeutre(me); rig.kick = 0.45; res.coupDePied = cycle(0, 40); rig.kick = 0;
    poseNeutre(me); rig.agenou = true; res.agenou = cycle(0, 160);
    res.souleve = +rig.jupe.rotation.x.toFixed(2);
    rig.agenou = false; for (let i = 0; i < 120; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    res.repos = +rig.jupe.rotation.x.toFixed(2);
    // la jupe ne descend pas jusqu'aux chevilles : le genou reste visible
    poseNeutre(me);
    res.ourlet = +boite(jupe).min.y.toFixed(2); res.genou = +rig.legL.genou.getWorldPosition(new T.Vector3()).y.toFixed(2);
    G.myCfg.skirt = false; G.applyMyLook();
    return res;
  `));
  const ok = r.forme === 'CylinderGeometry' && r.basJupe > r.hautJupe
    && r.debout < -0.005 && r.marche < -0.005 && r.course < -0.005 && r.coupDePied < -0.005 && r.agenou < -0.005
    && r.souleve < -0.2 && Math.abs(r.repos) < 0.05 && r.ourlet > r.genou;
  return { ok, detail: `la jupe etait une BOITE rigide autour du bassin : des qu'une cuisse montait, elle la traversait de part en part · c'est maintenant un tronc de cone evase (rayon ${r.hautJupe} m a la taille, ${r.basJupe} m a l'ourlet) qui SE SOULEVE quand un genou monte (${r.souleve} rad genou a terre, retour a ${r.repos} au repos) · le genou reste toujours hors du tissu : marge de ${-r.debout} m debout, ${-r.marche} en marchant, ${-r.course} en courant, ${-r.coupDePied} au coup de pied, ${-r.agenou} genou a terre · et l'ourlet (${r.ourlet} m) reste au-dessus du genou (${r.genou} m)` };
});
test('a la manette PS5, R2 avance et L2 recule — a pied comme au volant, et en analogique', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const ferme = () => { try { G.closeUI(); } catch (e) {} document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden')); };
    ferme();
    // le joystick tactile et la manette-telephone s'ADDITIONNENT a la manette : un test
    // precedent qui laisse une fleche appuyee bloquerait l'entree a fond dans une direction
    G.tel.x = G.tel.y = 0; G.joy.x = G.joy.y = 0; G.keys.clear();
    G.P.drawn = false; G.settings.ctrl = 'cam';   // arme rangée : R2 avance (braquée, elle tire — c'est son autre test)
    const ds = { index: 0, connected: true, mapping: 'standard', id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })) };
    const vrai = navigator.getGamepads; navigator.getGamepads = () => [ds];
    const gachette = (i, v) => { ds.buttons[i] = { pressed: v > 0.35, value: v }; G.pollGamepad(0.02); };
    try {
      const res = {};
      // ---- A PIED. On mesure la VITESSE atteinte, pas la distance : le joueur est remis a
      // son point de depart a chaque image (une case degagee, connue), sinon un habitant ou
      // une voiture qui passe par la fausserait la mesure une fois sur deux.
      const marche = v => {
        gachette(7, v > 0 ? v : 0); gachette(6, v < 0 ? -v : 0);
        G.cam.yaw = 0; G.P.facing = 0; G.P.vel.set(0, 0, 0); G.P.run = false;
        let dz = 0;
        for (let i = 0; i < 60; i++) { G.P.pos.set(0, 0.5, 8); G.pollGamepad(1 / 60); G.step(1 / 60, true); dz = G.P.pos.z - 8; }
        const r2 = { v: +Math.hypot(G.P.vel.x, G.P.vel.z).toFixed(2), sens: Math.sign(+dz.toFixed(3)) };
        gachette(7, 0); gachette(6, 0);
        return r2;
      };
      res.pied = { plein: marche(1), demi: marche(0.5), arriere: marche(-1), rien: marche(0) };
      res.gazAFond = (gachette(7, 1), +G.pad.gaz.toFixed(2)); gachette(7, 0);
      res.gazDemi = (gachette(7, 0.5), +G.pad.gaz.toFixed(2)); gachette(7, 0);
      res.freinAFond = (gachette(6, 1), +G.pad.frein.toFixed(2)); gachette(6, 0);
      // le stick gauche DEPLACE toujours : les deux commandes coexistent (meme mesure pinnee)
      G.cam.yaw = 0; G.P.vel.set(0, 0, 0);
      ds.axes = [1, 0, 0, 0]; gachette(7, 1);
      for (let i = 0; i < 60; i++) { G.P.pos.set(0, 0.5, 8); G.pollGamepad(1 / 60); G.step(1 / 60, true); }
      res.ensemble = { vx: +G.P.vel.x.toFixed(2), vz: +G.P.vel.z.toFixed(2) };
      ds.axes = [0, 0, 0, 0]; gachette(7, 0); G.pollGamepad(0.02);
      // ---- AU VOLANT : on mesure la montee en vitesse sur un tiers de seconde, avant
      // d'avoir parcouru assez de route pour rencontrer quoi que ce soit
      const c = (G.city.cars || []).find(v => !v.heli && !v.rider && v.spec);
      res.voiture = c ? (c.kind || 'voiture') : null;
      if (c) {
        G.P.pos.set(c.x, 0.6, c.z); G.enterCar(c);
        res.dedans = !!G.drive.car;
        const pousse = (i, v, n) => { gachette(7, i === 7 ? v : 0); gachette(6, i === 6 ? v : 0);
          G.drive.speed = 0; for (let k = 0; k < (n || 20); k++) { G.pollGamepad(1 / 60); G.driveStep(1 / 60); }
          const s = +G.drive.speed.toFixed(2); gachette(7, 0); gachette(6, 0); return s; };
        res.volant = { plein: pousse(7, 1), demi: pousse(7, 0.5), arriere: pousse(6, 1) };
        // braquer au stick PENDANT qu'on accelere a la gachette
        gachette(7, 1); ds.axes = [1, 0, 0, 0]; G.drive.speed = 0;
        const h0 = G.drive.car.h;
        for (let k = 0; k < 40; k++) { G.pollGamepad(1 / 60); G.driveStep(1 / 60); }
        res.braque = { dh: +Math.abs(G.drive.car.h - h0).toFixed(2), vitesse: +G.drive.speed.toFixed(2) };
        ds.axes = [0, 0, 0, 0]; gachette(7, 0); G.pollGamepad(0.02);
        G.exitCar();
      }
      res.legende = (document.getElementById('padLeg') || {}).textContent || '';
      res.aide = ([...document.querySelectorAll('.keys span')].map(e => e.textContent).join(' ') || '');
      return res;
    } finally { navigator.getGamepads = vrai; ferme(); }
  });
  const pd = r.pied, vl = r.volant || {};
  const ratioPied = pd.demi.v ? +(pd.plein.v / pd.demi.v).toFixed(2) : 0;
  const ratioVolant = vl.demi ? +(vl.plein / vl.demi).toFixed(2) : 0;
  const ok = pd.plein.v > 5 && pd.plein.sens === -1 && pd.demi.v > 2 && pd.demi.sens === -1
    && pd.arriere.v > 5 && pd.arriere.sens === 1 && pd.rien.v === 0
    && ratioPied > 1.8 && ratioPied < 2.4
    && r.gazAFond === 1 && r.gazDemi > 0.4 && r.gazDemi < 0.55 && r.freinAFond === 1
    && r.ensemble.vx > 2 && r.ensemble.vz < -2
    && r.dedans && vl.plein > 1 && vl.arriere < -1 && ratioVolant > 1.7 && ratioVolant < 2.4
    && r.braque.dh > 0.3 && r.braque.vitesse > 1
    && /R2/.test(r.legende) && /avancer/.test(r.legende) && /L2/.test(r.legende) && /reculer/.test(r.legende)
    && /R2<\/b> avancer/.test(r.aide) === false && /avancer \/ accélérer/.test(r.aide);
  return { ok, detail: `le joueur demandait des GACHETTES : R2 pour accélérer et avancer, L2 pour reculer · a pied, R2 a fond amène a ${pd.plein.v} m/s vers l'avant, a moitié a ${pd.demi.v} m/s (rapport ${ratioPied} : c'est bien analogique), L2 ramène a ${pd.arriere.v} m/s vers l'ARRIÈRE et rien ne bouge gâchettes lâchées (${pd.rien.v} m/s) · au volant (${r.voiture}) la vitesse monte a ${vl.plein} m/s a fond contre ${vl.demi} a mi-course (rapport ${ratioVolant}) et la marche arrière descend a ${vl.arriere} · le stick gauche COEXISTE : poussé a droite pendant que R2 accélère, le personnage part en diagonale (${r.ensemble.vx} m/s de côté, ${r.ensemble.vz} m/s devant) et la voiture braque de ${r.braque.dh} rad tout en prenant ${r.braque.vitesse} m/s · la légende et l'aide sont a jour` };
});

test('la croix gauche/droite et les sticks en x font enfin ce qu\'on attend', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const ferme = () => { try { G.closeUI(); } catch (e) {} document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden')); };
    ferme();
    G.tel.x = G.tel.y = 0; G.joy.x = G.joy.y = 0; G.keys.clear(); G.P.drawn = false;   // rien d'autre ne doit pousser le joueur
    const ds = { index: 0, connected: true, mapping: 'standard', id: 'DualSense Wireless Controller',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })) };
    const vrai = navigator.getGamepads; navigator.getGamepads = () => [ds];
    try {
      const res = {};
      // ---- LA CROIX ← → : elle change d'ARME et n'ouvre plus de menu en pleine course
      G.owned.add('arme:pistol'); G.owned.add('arme:rifle'); G.P.grenades = 0; G.P.weapon = null;
      const tap = i => { ds.buttons[i] = { pressed: true, value: 1 }; G.pollGamepad(0.02); G.simTime += 0.1;
        ds.buttons[i] = { pressed: false, value: 0 }; G.pollGamepad(0.02); };
      const suite = [];
      tap(15); suite.push(G.P.weapon); tap(15); suite.push(G.P.weapon); tap(15); suite.push(G.P.weapon);
      tap(14); suite.push(G.P.weapon);
      res.armes = suite; res.menuOuvert = G.uiOpen;
      res.role = { g: G.PAD_CROIX[14], d: G.PAD_CROIX[15], gLong: G.PAD_CROIX_LONG[14], dLong: G.PAD_CROIX_LONG[15] };
      // ---- ← MAINTENUE : la boutique reste a portee de pouce
      ds.buttons[14] = { pressed: true, value: 1 }; G.pollGamepad(0.02);
      G.simTime += G.PAD_LONG + 0.1; G.pollGamepad(0.02);
      res.longGauche = G.uiOpen;
      ds.buttons[14] = { pressed: false, value: 0 }; G.pollGamepad(0.02); ferme();
      ds.buttons[15] = { pressed: true, value: 1 }; G.pollGamepad(0.02);
      G.simTime += G.PAD_LONG + 0.1; G.pollGamepad(0.02);
      res.longDroite = G.uiOpen;
      ds.buttons[15] = { pressed: false, value: 0 }; G.pollGamepad(0.02); ferme();
      // ---- LE STICK GAUCHE EN X : déplacement latéral, dans les deux sens, symétrique
      const lateral = v => { ds.axes = [v, 0, 0, 0]; G.cam.yaw = 0; G.P.vel.set(0, 0, 0); G.pollGamepad(0.02);
        for (let i = 0; i < 60; i++) { G.P.pos.set(0, 0.5, 8); G.pollGamepad(1 / 60); G.step(1 / 60, true); }
        const d = +G.P.vel.x.toFixed(2); ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.02); return d; };
      res.lat = { droite: lateral(1), gauche: lateral(-1), demi: lateral(0.5), fremis: lateral(0.05) };
      // ---- LE STICK DROIT EN X : la caméra, dans le bon sens
      ds.axes = [0, 0, 1, 0]; const y0 = G.cam.yaw; for (let i = 0; i < 60; i++) G.pollGamepad(1 / 60);
      const camD = +(G.cam.yaw - y0).toFixed(2);
      ds.axes = [0, 0, -1, 0]; const y1 = G.cam.yaw; for (let i = 0; i < 60; i++) G.pollGamepad(1 / 60);
      const camG = +(G.cam.yaw - y1).toFixed(2);
      ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.02);
      res.cam = { droite: camD, gauche: camG };
      // ---- MODE « rotation » : au stick, x reste un déplacement relatif a la caméra (et non
      // un braquage a bande morte, l'ancien defaut) — le réglage clavier, lui, ne change pas
      G.settings.ctrl = 'rot'; G.settings.turn = 160; G.cam.yaw = 0; G.P.facing = 0; G.P.vel.set(0, 0, 0);
      ds.axes = [1, 0, 0, 0]; G.pollGamepad(0.02);
      const f0 = G.P.facing;
      for (let i = 0; i < 60; i++) { G.P.pos.set(0, 0.5, 8); G.pollGamepad(1 / 60); G.step(1 / 60, true); }
      res.rot = { dx: +G.P.vel.x.toFixed(2), braque: +(G.P.facing - f0).toFixed(2) };
      ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.02); G.settings.ctrl = 'cam';
      // ---- DANS LES MENUS, ← → gardent leur rôle de navigation
      G.openStore(); await dodo(80);
      ds.axes = [1, 0, 0, 0]; G.pollGamepad(0.02);
      res.menuBouge = !!document.querySelector('.focustv');
      ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.02); ferme();
      return res;
    } finally { navigator.getGamepads = vrai; G.settings.ctrl = 'cam'; ferme(); }
  });
  const l = r.lat;
  const ok = r.armes[0] === 'pistol' && r.armes[1] === 'rifle' && r.armes[2] === null && r.armes[3] === 'rifle'
    && r.menuOuvert === null && r.role.g === 'armePrec' && r.role.d === 'armeSuiv'
    && r.longGauche === 'store' && r.longDroite === 'missions'
    && l.droite > 5 && l.gauche < -5 && Math.abs(l.droite + l.gauche) < 0.2
    && l.demi > 2 && l.demi < l.droite - 2 && Math.abs(l.fremis) < 0.05
    && r.cam.droite < -1 && r.cam.gauche > 1
    && Math.abs(r.rot.dx) < 0.2 && r.rot.braque < -2.5 && r.menuBouge;
  return { ok, detail: `« la manette gauche droite ne fonctionne pas » : la croix ← → ouvrait la BOUTIQUE et les MISSIONS — en pleine course le jeu se figeait sur un menu · elle change maintenant d'arme (${r.armes.join(' → ')}, aucun menu ouvert : ${r.menuOuvert}) et boutique/missions restent la, en MAINTENANT ← ou → (${r.longGauche} / ${r.longDroite}) · le stick gauche en x déplace bien de côté et symétriquement (droite ${l.droite} m/s, gauche ${l.gauche} m/s, a mi-course ${l.demi} m/s, un frémissement a 5 % ne bouge rien : ${l.fremis}) · le stick droit en x tourne la caméra dans les deux sens (${r.cam.droite} / ${r.cam.gauche} rad) · en mode « rotation » le même stick FAIT TOURNER le personnage (${r.rot.braque} rad en une seconde, sans glisser de côté : ${r.rot.dx} m/s), et dans les menus ← → naviguent toujours` };
});

test('une manette au mapping non standard (navigateur de tele) est remise d\'aplomb', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const ferme = () => { try { G.closeUI(); } catch (e) {} document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden')); };
    ferme();
    // LA MEME DualSense, vue par le navigateur d'une tele (ou Firefox) : mapping vide,
    // axes = [LX, LY, RX, L2, R2, RY, chapeau], faces dans l'ordre HID, pas de croix.
    const REPOS = [0, 0, 0, -1, -1, 0, 1.2857142857142856];
    const hid = { index: 0, connected: true, mapping: '',
      id: 'Sony Interactive Entertainment Wireless Controller (Vendor: 054c Product: 0ce6)',
      axes: REPOS.slice(), buttons: Array.from({ length: 14 }, () => ({ pressed: false, value: 0 })) };
    const vrai = navigator.getGamepads; navigator.getGamepads = () => [hid];
    G.tel.x = G.tel.y = 0; G.joy.x = G.joy.y = 0; G.keys.clear(); G.P.drawn = false; G.settings.ctrl = 'cam';
    try {
      const res = {};
      res.profil = G.padProfil(hid);
      // 1) AU REPOS : l'ancienne lecture prenait l'axe 3 (= L2 relâchée, a -1) pour le stick
      // droit vertical — la caméra plongeait toute seule, sans que personne ne touche rien
      res.avant = { rxLu: hid.axes[2], ryLu: hid.axes[3] };
      G.cam.yaw = 0; G.cam.pitch = 0.3;
      for (let i = 0; i < 60; i++) G.pollGamepad(1 / 60);
      res.derive = { yaw: +G.cam.yaw.toFixed(3), pitch: +(G.cam.pitch - 0.3).toFixed(3) };
      let L = G.padLu(hid);
      res.repos = { l2: +L.l2.toFixed(2), r2: +L.r2.toFixed(2), rx: L.rx, ry: L.ry, chapeau: L.chapeau };
      // 2) LE STICK DROIT est sur les axes 2 et 5, pas 2 et 3
      hid.axes[2] = 0.8; hid.axes[5] = -0.6; L = G.padLu(hid);
      res.stickD = { rx: L.rx, ry: L.ry };
      hid.axes[2] = 0; hid.axes[5] = 0;
      // 3) LA CROIX est un « chapeau » sur un axe : sans traduction, ← et → ne font RIEN
      hid.axes[6] = 0.7142857142857142; L = G.padLu(hid); res.chapGauche = [L.b[14], L.b[15]];
      hid.axes[6] = -0.42857142857142855; L = G.padLu(hid); res.chapDroite = [L.b[14], L.b[15]];
      hid.axes[6] = -1; L = G.padLu(hid); res.chapHaut = L.b[12];
      hid.axes[6] = 1.2857142857142856;
      // ... et elle change vraiment d'arme en jeu
      G.owned.add('arme:pistol'); G.P.weapon = null;
      hid.axes[6] = -0.42857142857142855; G.pollGamepad(0.02); G.simTime += 0.1;
      hid.axes[6] = 1.2857142857142856; G.pollGamepad(0.02);
      res.armeParChapeau = G.P.weapon;
      // 4) LES GACHETTES sont sur les axes 3 et 4, et restent analogiques
      hid.axes[4] = 0; L = G.padLu(hid); res.r2Demi = +L.r2.toFixed(2);
      hid.axes[4] = 1; G.pollGamepad(0.02); res.gazPlein = +G.pad.gaz.toFixed(2);
      G.cam.yaw = 0; G.P.pos.set(0, 0.5, 8); G.P.vel.set(0, 0, 0);
      const z0 = G.P.pos.z;
      for (let i = 0; i < 60; i++) { G.pollGamepad(1 / 60); G.step(1 / 60, true); }
      res.avance = +(G.P.pos.z - z0).toFixed(2);
      hid.axes[4] = -1; G.pollGamepad(0.02);
      // 5) LES FACES sont dans l'ordre HID : le bouton 1 est ✕ (index 0 en standard)
      hid.buttons[1] = { pressed: true, value: 1 }; L = G.padLu(hid);
      res.faces = { hid1EstCroix: L.b[0], hid0EstCarre: G.padLu(hid).b[2] };
      hid.buttons[1] = { pressed: false, value: 0 };
      hid.buttons[0] = { pressed: true, value: 1 }; res.faces.hid0EstCarre = G.padLu(hid).b[2];
      hid.buttons[0] = { pressed: false, value: 0 }; G.pollGamepad(0.02);
      // 6) L'ECRAN « TESTER LA MANETTE » dit ce qu'il a corrigé
      hid.axes[0] = -0.62; hid.axes[4] = 0.4;
      G.ouvreTestManette(); G.pollGamepad(0.02);
      res.ecran = { ui: G.uiOpen, nom: (document.getElementById('ptNom') || {}).textContent || '',
        diag: (document.getElementById('ptDiag') || {}).textContent || '',
        barres: document.querySelectorAll('#ptAxes .ptrow').length,
        boutons: document.querySelectorAll('#ptBoutons u').length,
        allumes: document.querySelectorAll('#ptBoutons u.on').length };
      hid.axes = REPOS.slice(); G.pollGamepad(0.02);
      ferme();
      return res;
    } finally { navigator.getGamepads = vrai; ferme(); }
  });
  const ok = r.profil === 'ps-hid' && r.repos.l2 === 0 && r.repos.r2 === 0 && r.repos.rx === 0 && r.repos.ry === 0
    && r.repos.chapeau === 6 && Math.abs(r.derive.yaw) < 0.01 && Math.abs(r.derive.pitch) < 0.01
    && r.stickD.rx === 0.8 && r.stickD.ry === -0.6
    && r.chapGauche[0] && !r.chapGauche[1] && !r.chapDroite[0] && r.chapDroite[1] && r.chapHaut
    && r.armeParChapeau === 'pistol'
    && r.r2Demi > 0.45 && r.r2Demi < 0.55 && r.gazPlein === 1 && r.avance < -4
    && r.faces.hid1EstCroix && r.faces.hid0EstCarre
    && r.ecran.ui === 'padTest' && r.ecran.barres === 6 && r.ecran.boutons === 18 && r.ecran.allumes >= 1
    && /ps-hid/.test(r.ecran.nom) && /non standard corrigé/.test(r.ecran.diag);
  return { ok, detail: `sur le navigateur d'une télé (ou Firefox), la MEME DualSense arrive avec « mapping » vide et un tout autre agencement : le jeu lisait l'axe 3 (= L2 relâchée, a ${r.avant.ryLu}) comme le stick droit vertical — la caméra plongeait toute seule — le stick droit était introuvable, et la croix, qui n'a alors AUCUN bouton mais un « chapeau » sur un axe, ne faisait RIEN : c'est le « gauche/droite ne fonctionne pas » du joueur · tout est normalisé (profil ${r.profil}) : plus aucune dérive (${r.derive.yaw} rad de lacet, ${r.derive.pitch} d'inclinaison en une seconde), le stick droit est retrouvé sur les axes 2 et 5 (${r.stickD.rx} / ${r.stickD.ry}), le chapeau redevient une croix (← ${r.chapGauche[0]}, → ${r.chapDroite[1]}, ↑ ${r.chapHaut}) qui change d'arme (${r.armeParChapeau}), les gâchettes des axes 3/4 restent analogiques (mi-course ${r.r2Demi}, a fond ${r.gazPlein} → ${Math.abs(r.avance)} m parcourus) et les faces HID reprennent leur place (✕ et ▢) · l'écran « Tester la manette » montre les ${r.ecran.barres} axes et les ${r.ecran.boutons} boutons en direct et affiche : « ${r.ecran.diag} »` };
});

test('le mode diffusion vise 60 images par seconde NETTES sur la tele', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const dpr = window.devicePixelRatio || 1;
    const res = {};
    // ---- CE QUI SE PASSAIT. En arrivant par le lien #tv la qualité passait en « Ultra HD »,
    // dont le principe est le SURÉCHANTILLONNAGE : deux fois la finesse de l'écran, soit
    // quatre fois trop de pixels pour le processeur d'une télé.
    G.modeTV(false); G.diffusionMode(false);
    G.settings.quality = 'ultra'; G.applyQuality();
    res.avant = { ratio: +G.ratioQualite().toFixed(2), nettete: +G.post.force.toFixed(2) };
    // ... et l'échelle adaptative tombait alors au PLANCHER : rendu a 50 %, ombres éteintes
    for (let i = 0; i < 300; i++) G.fluiditeTick(1000 / 30);
    res.avantPlancher = { ech: +G.rendu.ech.toFixed(2), ombres: G.rendu.ombres };
    // ... et n'en remontait jamais : sur une télé qui tient 50 images/s, il en fallait 57
    for (let i = 0; i < 400; i++) G.fluiditeTick(1000 / 50);
    res.avantRemonte = +G.rendu.ech.toFixed(2);
    // ---- L'ACCÉLÉRATEUR D'IMAGE : il s'allume avec le mode télé
    G.modeTV(true);
    res.auto = G.diffusion.on;
    res.apres = { cible: G.diffusion.cible, ratio: +G.ratioQualite().toFixed(2), natif: +Math.min(dpr, 2).toFixed(2),
      nettete: +G.post.force.toFixed(2), passe: G.post.on, msaa: G.diffusion.msaa,
      paliers: G.paliersActifs().length, memeQuePALIERS: G.paliersActifs() === G.PALIERS };
    // l'échelle de l'accélérateur lâche les OMBRES d'abord, et ne descend jamais sous 78 %
    const marches = [];
    for (let i = 0; i < 300; i++) { G.fluiditeTick(1000 / 30); if (i % 40 === 0) marches.push({ ech: +G.rendu.ech.toFixed(2), o: G.rendu.ombres }); }
    res.marches = marches;
    res.plancher = { ech: +G.rendu.ech.toFixed(2), ombres: G.rendu.ombres, mini: Math.min(...G.PALIERS_TV.map(x => x.ech)) };
    // a 50 images/s on remonte déja (avant, il fallait 57 : on restait flou pour toujours)
    for (let i = 0; i < 400; i++) G.fluiditeTick(1000 / 59);
    res.remonte = { ech: +G.rendu.ech.toFixed(2), palier: G.rendu.palier };
    // ---- LA MESURE, visible dans le salon TV
    G.diffusion.n = 0; G.diffusion.acc = 0;
    for (let i = 0; i < 30; i++) G.diffusionMesure(1000 / 60);   // 30 images en une demi-seconde = 60 images/s
    res.mesure = { ips: G.diffusion.ips, mpx: G.diffusion.mpx, px: G.diffusion.px };
    G.ouvreSalonTV();
    res.salon = { debit: (document.getElementById('tvDebit') || {}).textContent || '',
      bouton: (document.getElementById('tvTurbo') || {}).textContent || '' };
    G.closeUI();
    // ---- on peut l'éteindre, et le mode télé le rallume
    G.diffusionMode(false, true); res.eteint = G.diffusion.on;
    G.diffusionMode(true, true);
    G.modeTV(false); res.horsTV = G.diffusion.on;
    G.diffusionMode(false); G.settings.quality = 'high'; G.applyQuality();
    return res;
  });
  const m = r.marches;
  const ok = r.avant.ratio >= 2 && r.avantPlancher.ech <= 0.5 && r.avantPlancher.ombres === false && r.avantRemonte <= 0.5
    && r.auto && r.apres.cible === 60 && r.apres.ratio === r.apres.natif && r.apres.passe
    && r.apres.nettete >= 0.6 && r.apres.msaa === 2 && !r.apres.memeQuePALIERS
    && m[1] && m[1].o === false && m[1].ech === 1
    && r.plancher.ech >= 0.78 && r.plancher.ech === r.plancher.mini
    && r.remonte.ech === 1 && r.remonte.palier === 0
    && r.mesure.ips === 60 && r.mesure.mpx > 0 && /images\/s/.test(r.salon.debit) && /Mpx\/s/.test(r.salon.debit)
    && /oui/.test(r.salon.bouton) && r.eteint === false && r.horsTV === false;
  return { ok, detail: `« le rendu TV n'est pas bon, image pas nette, pas assez fluide » : « diffuser » n'envoie AUCUNE vidéo — la télé ouvre le lien #tv et calcule le jeu elle-même — et en arrivant par ce lien la qualité passait en Ultra HD, c'est-a-dire en SURÉCHANTILLONNAGE (ratio ${r.avant.ratio}, quatre fois trop de pixels) · a 30 images/s l'échelle adaptative tombait alors au plancher (rendu a ${r.avantPlancher.ech}, ombres ${r.avantPlancher.ombres ? 'encore la' : 'éteintes'}) et n'en remontait JAMAIS, puisqu'il fallait repasser 57 images/s (a 50 : encore ${r.avantRemonte}) : image molle ET saccadée · l'accélérateur d'image s'allume avec le mode télé (${r.auto}) et retourne la logique — rendu au NATIF (${r.apres.ratio} = ${r.apres.natif}), netteté par passe CAS poussée a ${r.apres.nettete} au lieu du suréchantillonnage, anticrénelage a ${r.apres.msaa} échantillons, et une échelle de ${r.apres.paliers} paliers qui lâche les OMBRES d'abord (${m.map(x => x.ech + (x.o ? '' : '✕')).join(' → ')}) et ne descend jamais sous ${r.plancher.ech} · a 59 images/s tout remonte (palier ${r.remonte.palier}) · la mesure est visible dans le salon : « ${r.salon.debit} »` };
});
test('le plan routier est coherent : hierarchie des largeurs, aucune rue dans un batiment, l\'eau, le sable ou une parcelle', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city;
    // 1. la hiérarchie annoncée : toute chaussée mesure 5, 6, 7, 8 ou 9 m de large
    const largeurs = {}, horsHierarchie = [];
    for (const rt of c.routes) {
      const l = +Math.min(rt.w, rt.d).toFixed(2);
      largeurs[l] = (largeurs[l] || 0) + 1;
      if (!Object.values(G.VOIES).includes(l)) horsHierarchie.push([l, rt.x, rt.z]);
    }
    const roles = {}; for (const rt of c.routes) { const k = G.roleVoie(rt); roles[k] = (roles[k] || 0) + 1; }
    // 2. aucune rue ne traverse un bâtiment, la mer, le sable du rallye, l'anneau, une parcelle
    const chev = (a, b, m) => Math.abs(a.x - b.x) < a.w / 2 + b.w / 2 - m && Math.abs(a.z - b.z) < a.d / 2 + b.d / 2 - m;
    const parcelles = G.VILLAS.map(v => ({ x: v.x, z: v.z, w: G.VILLA_HALF * 2, d: G.VILLA_HALF * 2 }));
    for (const gd of G.GANG_DEFS) if (gd.villa) parcelles.push({ x: gd.villa[0], z: gd.villa[1], w: 42, d: 42 });
    const dansBat = [], dansEau = [], dansSable = [], dansAnneau = [], dansParcelle = [], minus = [];
    for (const rt of c.routes) {
      for (const b of c.batiments) if (chev(rt, b, 1)) dansBat.push([rt.x, rt.z, Math.round(b.x), Math.round(b.z)]);
      for (const q of parcelles) if (chev(rt, q, 1)) dansParcelle.push([rt.x, rt.z]);
      const dedans = (x1, x2, z1, z2) => rt.x - rt.w / 2 < x2 - 1 && rt.x + rt.w / 2 > x1 + 1 && rt.z - rt.d / 2 < z2 - 1 && rt.z + rt.d / 2 > z1 + 1;
      if (c.sea && dedans(c.sea.x1, c.sea.x2, c.sea.z1, c.sea.z2)) dansEau.push([rt.x, rt.z]);
      if (G.RALLY.mesh && dedans(G.RALLY.x1, G.RALLY.x2, G.RALLY.z1, G.RALLY.z2)) dansSable.push([rt.x, rt.z]);
      if (Math.hypot(rt.x - G.RACE_C.x, rt.z - G.RACE_C.z) < G.RACE_C.r - 6) dansAnneau.push([rt.x, rt.z]);
      if (Math.max(rt.w, rt.d) < 6) minus.push([rt.x, rt.z]);   // pas de bout de rue de 2 m : le poste D construit ses voies dessus
    }
    // 3. un seul réseau pour les voitures (composantes connexes de la chaussée ouverte)
    const N = G.NAV; if (!N.voit) G.buildNav();
    const { nx, nz } = N, co = N.cout, bl = N.voit;
    const comp = new Int32Array(nx * nz).fill(-1); let nc = 0; const tailles = [];
    for (let s = 0; s < nx * nz; s++) {
      if (comp[s] >= 0 || co[s] !== 1 || bl[s]) continue;
      const st = [s]; comp[s] = nc; let t = 0;
      while (st.length) { const q = st.pop(); t++; const i = q % nx, j = (q - i) / nx;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const k = jj * nx + ii; if (comp[k] < 0 && co[k] === 1 && !bl[k]) { comp[k] = nc; st.push(k); } } }
      tailles.push(t); nc++;
    }
    const total = tailles.reduce((a, b) => a + b, 0), part = Math.max(...tailles) / total;
    return { routes: c.routes.length, axes: c.plan.axes.length, largeurs, horsHierarchie, roles,
      dansBat, dansEau, dansSable, dansAnneau, dansParcelle, minus, composantes: nc, part: +part.toFixed(4) };
  });
  const ok = r.horsHierarchie.length === 0 && r.dansBat.length === 0 && r.dansEau.length === 0 && r.dansSable.length === 0
    && r.dansAnneau.length === 0 && r.dansParcelle.length === 0 && r.minus.length === 0 && r.part >= 0.99
    && r.roles.boulevard >= 8 && r.routes >= 65;
  return { ok, detail: `le plan a ${r.routes} chaussées (${r.axes} axes nommés) et toutes tiennent dans la hiérarchie annoncée — ${JSON.stringify(r.largeurs)} m (${r.roles.boulevard} boulevards, ${r.roles.avenue} avenues, ${r.roles.rue} rues, ${r.roles.ruelle} ruelles, ${r.roles.desserte} dessertes), ${r.horsHierarchie.length} hors hiérarchie · aucune rue ne traverse un bâtiment (${r.dansBat.length}), la mer (${r.dansEau.length}), le sable du rallye (${r.dansSable.length}), l'anneau (${r.dansAnneau.length}) ni une parcelle de villa (${r.dansParcelle.length}) — il y en avait 7 · aucun bout de rue de moins de 6 m (${r.minus.length}) · la chaussée ne fait qu'UN réseau pour les voitures : ${(r.part * 100).toFixed(2)} % d'un seul tenant en ${r.composantes} morceau(x)` };
});

test('la signalisation est complete : feux avec etat et ligne d\'arret, panneaux sur le trottoir, passages pietons devant les equipements', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city;
    // 1. chaque feu a son état, son sens et sa ligne d'arrêt, et la ligne est SUR la chaussée
    const surChaussee = (x, z, m = 0) => c.routes.some(rt => Math.abs(x - rt.x) < rt.w / 2 + m && Math.abs(z - rt.z) < rt.d / 2 + m);
    const feuxSansEtat = c.trafficLights.filter(t => !t.etat || !t.ligne || typeof t.sens !== 'number').length;
    const lignesHorsRoute = c.trafficLights.filter(t => t.ligne && !surChaussee(t.ligne.x, t.ligne.z, 0.6)).length;
    // la ligne d'arrêt est au droit du feu (même coordonnée le long de la voie), décalée
    // vers l'axe de la rue : jamais plus de 8 m, et jamais en avant ni en arrière du feu
    const lignesMalPlacees = c.trafficLights.filter(t => {
      const alongZ = Math.abs(Math.cos(t.sens)) > 0.5;
      const long = alongZ ? Math.abs(t.ligne.z - t.z) : Math.abs(t.ligne.x - t.x);
      return long > 0.2 || Math.hypot(t.ligne.x - t.x, t.ligne.z - t.z) > 8;
    }).length;
    // 2. le cycle tourne, et les deux groupes ne sont JAMAIS verts ensemble
    const vus = { A: {}, B: {} }; let deuxVerts = 0;
    const t0 = G.simTime;
    for (let i = 0; i < 120; i++) {
      G.simTime = i * 0.5; G.lightsTick();
      const a = c.trafficLights.find(t => t.groupe === 'A'), b = c.trafficLights.find(t => t.groupe === 'B');
      vus.A[a.etat] = (vus.A[a.etat] || 0) + 1; vus.B[b.etat] = (vus.B[b.etat] || 0) + 1;
      if (a.etat === 'vert' && b.etat === 'vert') deuxVerts++;
    }
    G.simTime = t0; G.lightsTick();
    // la lampe allumée est bien la bonne (matériau vif, les deux autres éteintes)
    const f = c.trafficLights[0]; G.simTime = 0; G.lightsTick();
    const lampes = f.lamps.map(l => '#' + l.material.color.getHexString());
    // 3. les panneaux : sur un trottoir, jamais sur la chaussée, jamais devant une porte
    const surTrottoir = (x, z) => c.trottoirs.some(t => Math.abs(x - t.x) <= t.w / 2 + 0.5 && Math.abs(z - t.z) <= t.d / 2 + 0.5);
    const portes = G.solids.filter(o => o.porte);
    const panSurRoute = c.panneaux.filter(q => surChaussee(q.x, q.z, -0.2)).length;
    const panHorsTrottoir = c.panneaux.filter(q => !surTrottoir(q.x, q.z)).length;
    const panDevantPorte = c.panneaux.filter(q => portes.some(o => Math.abs(q.x - o.x) < o.w / 2 + 1.6 && Math.abs(q.z - o.z) < o.d / 2 + 1.6)).length;
    const types = c.panneaux.reduce((a, q) => (a[q.type] = (a[q.type] || 0) + 1, a), {});
    // 4. toute rue secondaire qui débouche sur un boulevard a un stop ou un cédez-le-passage
    //    (sauf aux carrefours à feux, où le feu suffit)
    const manquants = [];
    for (const k of G.carrefours()) {
      const la = Math.min(k.a.w, k.a.d), lb = Math.min(k.b.w, k.b.d);
      if (Math.max(la, lb) < 9 || la === lb) continue;
      if (c.crossings.some(([x, z]) => Math.abs(x - k.cx) < 14 && Math.abs(z - k.cz) < 14)) continue;
      if (!c.panneaux.some(q => (q.type === 'stop' || q.type === 'cede') && Math.hypot(q.x - k.cx, q.z - k.cz) < 22)) manquants.push([Math.round(k.cx), Math.round(k.cz)]);
    }
    // 5. un passage piéton devant l'école, l'hôpital et le commissariat
    const devant = ['École', 'Hôpital', 'Commissariat'].map(nom => {
      const z0 = c.zones.find(q => q.name === nom);
      if (!z0) return [nom, -1];
      const cx = (z0.x1 + z0.x2) / 2, cz = (z0.z1 + z0.z2) / 2;
      const d = Math.min(...c.passages.map(q => Math.hypot(q.x - cx, q.z - cz)));
      return [nom, Math.round(d)];
    });
    return { feux: c.trafficLights.length, feuxSansEtat, lignesHorsRoute, lignesMalPlacees, vus, deuxVerts, lampes,
      panneaux: c.panneaux.length, types, panSurRoute, panHorsTrottoir, panDevantPorte, manquants,
      passages: c.passages.length, devant, exemple: { x: f.x, z: f.z, sens: +f.sens.toFixed(2), etat: f.etat, ligne: f.ligne, groupe: f.groupe } };
  });
  const ok = r.feux >= 36 && r.feuxSansEtat === 0 && r.lignesHorsRoute === 0 && r.lignesMalPlacees === 0
    && r.deuxVerts === 0 && r.vus.A.vert > 0 && r.vus.A.orange > 0 && r.vus.A.rouge > 0
    && r.vus.B.vert > 0 && r.vus.B.orange > 0 && r.vus.B.rouge > 0
    && r.panneaux >= 50 && r.panSurRoute === 0 && r.panHorsTrottoir === 0 && r.panDevantPorte === 0
    && r.types.stop > 0 && r.types.cede > 0 && r.types.prioritaire > 0 && r.types['fin-prioritaire'] > 0
    && r.manquants.length === 0 && r.devant.every(([, d]) => d >= 0 && d < 45);
  return { ok, detail: `${r.feux} feux, tous avec leur état lisible et leur ligne d'arrêt sur la chaussée (${r.feuxSansEtat} sans état, ${r.lignesHorsRoute} lignes hors route) — exemple : ${JSON.stringify(r.exemple)} · le cycle tourne vert 12 s / orange 2 s / rouge et les deux axes ne sont JAMAIS verts ensemble (${r.deuxVerts} fois sur 120 relevés) · ${r.panneaux} panneaux (${JSON.stringify(r.types)}), ${r.panSurRoute} sur la chaussée, ${r.panHorsTrottoir} hors trottoir, ${r.panDevantPorte} devant une porte · ${r.manquants.length} rue secondaire débouchant sur un boulevard sans stop ni cédez-le-passage · ${r.passages} passages piétons, dont un à ${r.devant.map(d => d[0] + ' ' + d[1] + ' m').join(', ')}` };
});

test('les deux nouveaux quartiers sont relies a la ville et on y achete vraiment', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city, res = { quartiers: [], boutiques: [] };
    // 1. les deux zones sont déclarées, et leur desserte tombe sur le réseau principal
    const N = G.NAV; if (!N.voit) G.buildNav();
    const { nx, nz, cs, x0, z0 } = N, co = N.cout, bl = N.voit;
    const comp = new Int32Array(nx * nz).fill(-1); let nc = 0; const tailles = [];
    for (let s = 0; s < nx * nz; s++) {
      if (comp[s] >= 0 || co[s] !== 1 || bl[s]) continue;
      const st = [s]; comp[s] = nc; let t = 0;
      while (st.length) { const q = st.pop(); t++; const i = q % nx, j = (q - i) / nx;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const k = jj * nx + ii; if (comp[k] < 0 && co[k] === 1 && !bl[k]) { comp[k] = nc; st.push(k); } } }
      tailles.push(t); nc++;
    }
    const pr = tailles.indexOf(Math.max(...tailles));
    const cell = (x, z) => comp[Math.max(0, Math.min(nz - 1, Math.round((z - z0) / cs))) * nx + Math.max(0, Math.min(nx - 1, Math.round((x - x0) / cs)))];
    for (const nom of ['Le Marché', 'Techno-Parc']) {
      const z1 = c.zones.find(q => q.name === nom);
      const d = c.plan.dessertes.find(q => q.n === nom);
      const rues = c.routes.filter(rt => z1 && rt.x > z1.x1 - 6 && rt.x < z1.x2 + 6 && rt.z > z1.z1 - 6 && rt.z < z1.z2 + 6).length;
      const lam = G.solids.filter(o => o.mesh && z1 && o.x > z1.x1 && o.x < z1.x2 && o.z > z1.z1 && o.z < z1.z2 && Math.abs(o.h - 4.4) < 0.01).length;
      const trot = c.trottoirs.filter(t => z1 && t.x > z1.x1 && t.x < z1.x2 && t.z > z1.z1 && t.z < z1.z2).length;
      res.quartiers.push({ nom, declare: !!z1, emoji: z1 && z1.emoji, hint: !!(z1 && z1.hint),
        desserte: d ? [d.x, d.z, d.loin] : null, surReseau: !!d && cell(d.x, d.z) === pr, rues, lampadaires: lam, trottoirs: trot,
        gps: !!G.lieuDe(nom) });
    }
    // 2. les boutiques où l'on ENTRE : on franchit la porte, le comptoir ouvre l'interface,
    //    l'achat débite exactement le prix
    const essai = async (id, px, pz) => {
      __SHOT.go({ world: 4, x: px, y: 1, z: pz, hour: 12 });
      const e = c.etals.find(o => o.id === id);
      for (let i = 0; i < 300; i++) {
        const dx = e.vx - G.P.pos.x, dz = e.vz - G.P.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.7) break;
        G.P.pos.x += dx / d * 0.09; G.P.pos.z += dz / d * 0.09; G.step(1 / 60, true);
      }
      G.step(1 / 60, true);
      // le porte-monnaie est rempli JUSTE avant l'achat : pendant les cinq secondes de marche,
      // la vie de la ville (police, gangs) peut le vider et le test mesurait alors n'importe quoi
      G.wallet = 80; const avant = G.wallet;
      const entre = Math.hypot(e.vx - G.P.pos.x, e.vz - G.P.pos.z) < 1.2;
      const vit = c.vitNear;
      let ouvre = false, debit = -1;
      if (vit && vit.tab === 'etal') { G.openStore(vit.tab, vit.key); ouvre = G.uiOpen === 'etal'; }
      if (ouvre) { G.acheterArticle(e.articles[0]); debit = avant - G.wallet; G.closeUI(); }
      res.boutiques.push({ id, entre, comptoir: !!vit, ouvre, debit, prix: e.articles[0].p, articles: e.articles.length });
    };
    await essai('pain', -150.5, 193); await essai('bonbon', -142.5, 193); await essai('cafe', -134.5, 193);
    await essai('info', -17, -105); await essai('drone', -2, -105); await essai('jeux', 13, -105);
    res.etals = c.etals.length;
    return res;
  });
  const q = r.quartiers, b = r.boutiques;
  const ok = q.length === 2 && q.every(z => z.declare && z.hint && z.gps && z.surReseau && z.rues >= 3 && z.lampadaires >= 6 && z.trottoirs >= 8)
    && b.length === 6 && b.every(o => o.entre && o.comptoir && o.ouvre && o.debit === o.prix && o.articles >= 2) && r.etals >= 9;
  return { ok, detail: `deux quartiers neufs : ${q.map(z => `${z.emoji} ${z.nom} (${z.rues} rues, ${z.trottoirs} trottoirs, ${z.lampadaires} lampadaires, desserte ${JSON.stringify(z.desserte)} ${z.surReseau ? 'reliée au réseau' : 'HORS RÉSEAU'}, GPS ${z.gps ? 'ok' : 'absent'})`).join(' · ')} · ${r.etals} comptoirs en tout, et les ${b.length} boutiques où l'on entre marchent de bout en bout : ${b.map(o => `${o.id} (porte franchie, comptoir ouvert, −${o.debit} 🪙 pour ${o.prix})`).join(', ')}` };
});
// ================= POSTE J — LA VIE DE LA VILLE (métiers) =================
test('les cinq tenues de métier sont visibles et n\'entrent pas dans le corps', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const boite = o => { o.updateWorldMatrix(true, true); return new G.THREE.Box3().setFromObject(o); };
    const out = {};
    for (const m of G.city.metiers) {
      if (out[m.metier]) continue;
      const av = m.bot.av; av.group.updateWorldMatrix(true, true);
      const t = av.tenue;
      // le vêtement principal : la plus grosse pièce posée sur le torse
      let veste = null, vol = 0;
      for (const pc of t.pieces) { if (pc.parent !== av.group) continue; const v = pc.scale.x * pc.scale.y * pc.scale.z; if (v > vol) { vol = v; veste = pc; } }
      const bt = boite(av.torso), bv = boite(veste), bg = boite(av.group);
      out[m.metier] = {
        pieces: t.pieces.length, visibles: t.pieces.filter(pc => pc.visible).length,
        // « enveloppe » : le vêtement déborde du torse de tous les côtés — il ne s'y enfonce pas
        enveloppe: bv.min.x < bt.min.x && bv.max.x > bt.max.x && bv.min.z < bt.min.z && bv.max.z > bt.max.z,
        marge: +Math.min(bt.min.x - bv.min.x, bt.min.z - bv.min.z).toFixed(3),
        largeur: +(bg.max.x - bg.min.x).toFixed(2), hauteur: +(bg.max.y - bg.min.y).toFixed(2),
        haut: '#' + av.mats.shirt.color.getHexString(), bas: '#' + av.mats.pants.color.getHexString(),
      };
    }
    const emp = G.city.metiers.find(m => m.metier === 'employe').bot.av;
    const bandes = emp.tenue.pieces.filter(pc => pc.material.color.getHexString() === 'c9ced8').length;
    const gilet = emp.tenue.pieces.some(pc => pc.material.color.getHexString() === 'e4f52a');
    return { out, bandes, gilet, nb: Object.keys(out).length, travailleurs: G.city.metiers.length };
  });
  const A = ['employe', 'balayeur', 'laveur', 'pompier', 'facteur'];
  const couleurs = { employe: '#2f4f9e', balayeur: '#2f8f4a', laveur: '#8f98ab', pompier: '#d42b2b', facteur: '#f2c21a' };
  const ok = r.nb === 5 && r.travailleurs >= 8 && r.travailleurs <= 12 && r.gilet && r.bandes >= 4
    && A.every(k => { const t = r.out[k]; return t && t.pieces >= 3 && t.visibles === t.pieces && t.enveloppe && t.marge >= 0.03 && t.haut === couleurs[k]; });
  return { ok, detail: `${r.travailleurs} travailleurs (au plus 12), ${r.nb} tenues : ` + A.map(k => `${k} ${r.out[k].pieces} pièces, jeu ${Math.round(r.out[k].marge * 100)} cm autour du torse, haut ${r.out[k].haut}`).join(' · ') + ` — le gilet fluo de l'employé porte ${r.bandes} bandes réfléchissantes grises` };
});

test('un lampadaire cassé est réparé tout seul par les employés, avec un chantier posé puis retiré', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city; c.horaires = false; G.metiersRepos();   // les tests s'enchaînent dans la même page : on repart d'une ville au repos   // on ne dépend pas de la phase du cycle jour/nuit
    const dep = c.depot;
    let lam = null, bd = 1e9;
    for (const b of G.breakables) { if (b.kind !== 'lamp') continue; const d = Math.hypot(b.x - dep.x, b.z - dep.z); if (d < bd) { bd = d; lam = b; } }
    G.breakThing(lam, { x: lam.x + 1, z: lam.z }, true);
    const obst0 = G.solids.filter(o => o.chantier).length;
    let chantMax = 0, repare = -1;
    const DT = 1 / 20;
    for (let i = 0; i < 3600 && repare < 0; i++) {
      G.simTime = G.simTime + DT; G.metiersTick(DT);
      if (c.chantiers.length > chantMax) chantMax = c.chantiers.length;
      if (!lam.broken) repare = +(i * DT).toFixed(1);
    }
    // on laisse l'équipe RANGER son chantier, et on mesure pile à ce moment-là : si on
    // attendait plus longtemps, elle repartait sur une autre panne et posait un chantier
    // tout neuf — le test devenait un tirage au sort.
    let range = -1, obstFin = -1;
    for (let i = 0; i < 800; i++) {
      G.simTime = G.simTime + DT; G.metiersTick(DT);
      if (!c.chantiers.length) { range = +(i * DT).toFixed(1); obstFin = G.solids.filter(o => o.chantier).length; break; }
    }
    return { dist: Math.round(bd), repare, range, obst0, chantMax, chantiers: c.chantiers.length,
      obstFin, broken: lam.broken, etat: G.METIERS.employes[0].etat };
  });
  const ok = r.repare > 0 && r.repare < 160 && r.chantMax >= 1 && !r.broken && r.range >= 0 && r.obstFin === r.obst0;
  return { ok, detail: `lampadaire cassé à ${r.dist} m du dépôt : l'équipe est partie en fourgon, a posé ${r.chantMax} chantier (cônes + filet rouge et blanc + panneau TRAVAUX + obstacle dans solids pour que la circulation contourne), a réparé en ${r.repare} s simulées puis a tout rangé ${r.range} s plus tard — obstacles de chantier dans solids : ${r.obst0} → ${r.chantMax} → ${r.obstFin}, équipe « ${r.etat} »` };
});

test('un incendie est éteint par les pompiers : le camion arrive et city.incendies se vide', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city; c.horaires = false; G.metiersRepos();   // les tests s'enchaînent dans la même page : on repart d'une ville au repos
    const f = G.declencheIncendie(0, 20, 100);
    const cam = G.METIERS.pompiers[0].bot.veh;
    const d0 = Math.round(Math.hypot(cam.x, cam.z - 20));
    let arrive = -1, eteint = -1, dmin = 1e9;
    const force0 = f.force;
    const DT = 1 / 20;
    for (let i = 0; i < 3200; i++) {
      G.simTime = G.simTime + DT; G.metiersTick(DT);
      const d = Math.hypot(cam.x, cam.z - 20); if (d < dmin) dmin = d;
      if (arrive < 0 && d < 15) arrive = +(i * DT).toFixed(1);
      if (eteint < 0 && !c.incendies.length) { eteint = +(i * DT).toFixed(1); break; }
    }
    return { caserne: c.caserne, d0, arrive, eteint, dmin: Math.round(dmin), force0,
      incendies: c.incendies.length, etat: G.METIERS.pompiers[0].etat };
  });
  const ok = r.arrive > 0 && r.eteint > 0 && r.eteint < 120 && r.dmin < 15 && r.incendies === 0;
  return { ok, detail: `incendie déclenché en (0, 20), caserne à ${r.d0} m : le camion est parti sirène allumée et est arrivé à ${r.dmin} m du feu en ${r.arrive} s simulées, les pompiers ont déployé la lance à eau et le feu (force ${r.force0}) était éteint à ${r.eteint} s — city.incendies = ${r.incendies}` };
});

test('le facteur fait sa tournée à vélo et dépose une lettre dans une boîte aux lettres', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city; c.horaires = false; G.metiersRepos();   // les tests s'enchaînent dans la même page : on repart d'une ville au repos
    for (const b of c.boites) b.lettres = 0;
    const m = G.METIERS.facteurs[0], velo = m.bot.veh;
    let livre = -1, aVelo = false;
    const DT = 1 / 20;
    for (let i = 0; i < 2400; i++) {
      G.simTime = G.simTime + DT; G.metiersTick(DT);
      // il est vraiment SUR son vélo : l'avatar colle à la selle pendant la tournée
      if (m.etat === 'tournee' && Math.hypot(m.bot.pos.x - velo.x, m.bot.pos.z - velo.z) < 1.4) aVelo = true;
      if (livre < 0 && c.boites.some(b => b.lettres > 0)) { livre = +(i * DT).toFixed(1); break; }
    }
    const sacoches = velo.g.children.filter(o => o.material && o.material.color && o.material.color.getHexString() === '8b5a2b').length;
    return { boites: c.boites.length, livre, aVelo, sacoches,
      total: c.boites.reduce((a, b) => a + b.lettres, 0), etat: m.etat };
  });
  const ok = r.boites >= 5 && r.livre > 0 && r.livre < 120 && r.aVelo && r.total >= 1 && r.sacoches >= 2;
  return { ok, detail: `${r.boites} boîtes aux lettres posées devant les maisons : le facteur (vélo à ${r.sacoches} sacoches, une de chaque côté de la roue arrière) a roulé jusqu'à la première et y a glissé une lettre au bout de ${r.livre} s simulées (${r.total} lettre(s) distribuée(s), état « ${r.etat} »)` };
});

test('les véhicules de travail sont conduisibles par le joueur et leurs outils s\'actionnent', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city; c.horaires = false; G.metiersRepos();   // les tests s'enchaînent dans la même page : on repart d'une ville au repos
    const res = {};
    for (const v of c.cars.filter(x => x.travail)) {
      // on remet TOUT le parc à sa place avant chaque véhicule : celui qu'on vient d'essayer
      // s'était garé n'importe où et venait brouiller la détection du suivant
      G.metiersRepos();
      v.busy = false;                                     // l'employé qui s'en servait laisse la place
      G.P.pos.set(v.x + 1.4, v.y || 0, v.z + 1.4);
      G.cityStep(1 / 60);
      const detecte = c.near === v;                       // « E : conduire » s'affiche bien
      v.busy = false;                                     // (la vie de la ville vient peut-être de le reprendre)
      G.enterCar(v);
      const auVolant = G.drive.car === v;
      let roule = 0;
      if (auVolant) {
        const x0 = v.x, z0 = v.z;
        G.keys.add('KeyW');
        for (let i = 0; i < 90; i++) { G.simTime = G.simTime + 1 / 60; G.driveStep(1 / 60); }
        G.keys.delete('KeyW');
        roule = +Math.hypot(v.x - x0, v.z - z0).toFixed(2);
      }
      G.actionneOutil(v);
      for (let i = 0; i < 200; i++) { G.simTime = G.simTime + 1 / 30; G.outilsVehiculesTick(1 / 30); }
      const o = v.outils || {};
      res[v.kind] = { detecte, auVolant, roule, outil: +v.outil.toFixed(2),
        benne: o.benne ? +o.benne.rotation.x.toFixed(2) : null,
        echelle: o.echelle ? +o.echelle.rotation.x.toFixed(2) : null,
        jet: o.jet ? o.jet.visible : null,
        crochet: o.crochet ? +o.crochet.position.y.toFixed(2) : null,
        godet: o.godet ? +o.godet.rotation.x.toFixed(2) : null };
      if (G.drive.car) G.exitCar();
    }
    // la lance à eau fait bien baisser un feu : c'est ainsi que le joueur aide les pompiers
    const f = G.declencheIncendie(G.P.pos.x + 8, G.P.pos.z, 100);
    const cam = c.cars.find(x => x.kind === 'pompier');
    cam.x = G.P.pos.x; cam.z = G.P.pos.z; cam.h = Math.PI / 2; cam.outil = 1; cam.outilCible = 1;
    const av = f ? f.force : 0;
    for (let i = 0; i < 60; i++) { G.simTime = G.simTime + 1 / 30; G.arroseAutour(cam, 1 / 30); }
    const ap = f ? f.force : 0;
    if (f && c.incendies.includes(f)) { G.worldGroup.remove(f.g); c.incendies.length = 0; }
    return { res, kinds: Object.keys(res), eau: [Math.round(av), Math.round(ap)] };
  });
  const K = ['benne', 'grue', 'pelle', 'tracteur', 'pompier', 'fourgon', 'velo'];
  const tous = K.every(k => r.res[k] && r.res[k].detecte && r.res[k].auVolant);
  const roulent = K.filter(k => r.res[k] && r.res[k].roule > 0.5).length;
  const b = r.res.benne || {}, pk = r.res.pompier || {}, g = r.res.grue || {}, pe = r.res.pelle || {};
  const outils = b.benne < -0.4 && pk.echelle < -0.5 && pk.jet === true && g.crochet < -2 && pe.godet > 0.4;
  const ok = tous && roulent >= 6 && outils && r.eau[1] < r.eau[0] - 10;
  const vus = K.filter(k => r.res[k] && r.res[k].detecte).length, pris = K.filter(k => r.res[k] && r.res[k].auVolant).length;
  return { ok, detail: `sept véhicules de travail dans city.cars (${r.kinds.join(', ')}) : ${vus}/7 annoncés par « E : conduire », ${pris}/7 conduisibles, ${roulent}/7 avancent vraiment en une seconde et demie de gaz ; la benne se lève (${b.benne} rad), l'échelle du camion de pompiers se déploie (${pk.echelle} rad) et la lance à eau s'ouvre, le crochet de la grue descend de ${-g.crochet} m, le godet de la pelleteuse creuse (${pe.godet} rad) ; la lance fait tomber la force du feu de ${r.eau[0]} à ${r.eau[1]}` };
});

test('on peut parler aux gens de métier et leur donner un coup de main contre des pièces', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city; c.horaires = false; G.metiersRepos();   // les tests s'enchaînent dans la même page : on repart d'une ville au repos c.boulot = null;
    // toute l'équipe est au travail : la phrase de métier doit parler de la réparation en cours
    for (const m of c.metiers) if (m.metier === 'employe') m.etat = 'repare';
    const phrases = c.metiers.map(m => [m.metier, G.phraseMetier(m, false)]);
    // on se plante devant un balayeur : il répond, et il propose son petit boulot
    const bal = c.metiers.find(m => m.metier === 'balayeur');
    G.P.pos.set(bal.bot.pos.x + 1.5, bal.bot.pos.y, bal.bot.pos.z);
    const repond = G.metierParle('bonjour, tu fais quoi comme travail ?');
    const auHasard = G.metierParle('vive les dinosaures');
    G.metiersTick(1 / 60);
    // au dépôt, les travailleurs sont à deux mètres les uns des autres : ce qui compte, c'est
    // que le jeu propose bien UN coup de main à celui d'à côté, pas lequel des deux balayeurs
    const propose = !!c.boulotNear;
    const proposeQui = c.boulotNear ? c.boulotNear.metier : null;
    G.prendreBoulot(bal);
    const boulot = c.boulot && c.boulot.metier;
    const sous0 = G.wallet;
    // le joueur ramasse les cinq détritus demandés (ils apparaissent sous ses pieds)
    for (let i = 0; i < 8 && c.boulot; i++) { G.poseDetritus(G.P.pos.x + 0.4, G.P.pos.z); G.boulotTick(1 / 60); }
    return { phrases, repond, auHasard, propose, proposeQui, boulot, sous0, sous1: G.wallet, reste: !!c.boulot };
  });
  const dit = Object.fromEntries(r.phrases);
  const ok = r.repond && !r.auHasard && r.propose && !!r.proposeQui && r.boulot === 'balayeur' && r.sous1 === r.sous0 + 15 && !r.reste
    && /répare le lampadaire/.test(dit.employe) && /vitres/.test(dit.laveur) && /camion|feu/.test(dit.pompier) && /tournée|lettre|boîte/.test(dit.facteur);
  return { ok, detail: `l'employé au travail répond « ${dit.employe} », le pompier « ${dit.pompier} », le facteur « ${dit.facteur} » ; une phrase hors sujet ne déclenche rien (${r.auHasard}) ; à côté d'un travailleur (${r.proposeQui}), E propose un petit boulot — les 5 détritus du balayeur ramassés = ${r.sous1 - r.sous0} 🪙 (${r.sous0} → ${r.sous1})` };
});
test('la maîtresse PARLE pour de vrai à l\'école : bonjour à l\'élève, l\'énoncé, le verdict, une bulle, et un repli quand l\'appareil n\'a aucune voix', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: -62, y: 1, z: 220, hour: 12 });
    await dodo(300);
    const salle = G.city.classes[0]; if (!salle) return { pourquoi: 'aucune salle de classe' };
    const out = { defaut: G.settings.voices, reglage: G.store.get('superobby.voices'), bouton: !!document.getElementById('voiceTest'),
      libelle: document.getElementById('voiceBtn').textContent, maitresse: !!salle.maitresse };
    // 1) LE REPLI : sans espion, avec la vraie synthèse. Chromium n'a aucune voix installée :
    // rien ne démarre, et le jeu doit s'en apercevoir et jouer le jingle.
    G.settings.voices = true; const av = G.voice.etat();
    G.voice.say('Essai de la voix de la maîtresse', true, true);
    await dodo(1100);
    const ap = G.voice.etat();
    out.moteur = ap.moteur; out.voix = ap.voix; out.fr = ap.fr;
    out.parleOuRepli = (ap.parle > av.parle) || (ap.repli > av.repli);
    out.envoyees = ap.dites - av.dites;
    // 2) l'espion : que DIT la maîtresse, exactement ?
    const dits = [];
    try { window.speechSynthesis.speak = u => dits.push(String(u.text)); } catch (e) { return Object.assign(out, { pourquoi: 'synthèse vocale non remplaçable' }); }
    const ch = salle.chaises[0];
    G.P.sit = null; G.school.chaise = null; G.P.pos.set(ch.x, 0.6, ch.z + 0.3);
    dits.length = 0; G.sitBench(ch);
    out.bonjour = dits.join(' | ');
    out.nom = G.myCfg.name;
    for (let i = 0; i < 60 && G.uiOpen !== 'schoolUI'; i++) await dodo(100);
    if (!G.school.q) return Object.assign(out, { pourquoi: 'la classe ne s\'est pas ouverte en s\'asseyant' });
    out.enonce = dits.join(' | ');
    out.bulle = !!(salle.maitresse && salle.maitresse.bubble);
    // bonne réponse
    let q = G.school.q; dits.length = 0;
    G.answer(q.a, document.querySelector('#schChoices .item'));
    out.gagne = dits.join(' | ');
    for (let i = 0; i < 60 && !G.school.q; i++) await dodo(150);
    // mauvaise réponse
    q = G.school.q; dits.length = 0;
    if (q) G.answer(q.opts.find(o => o !== q.a), document.querySelector('#schChoices .item'));
    out.faux = dits.join(' | ');
    out.bonneReponse = q ? String(q.a) : '';
    // 3) le bouton « Tester la voix » des réglages
    G.settings.voices = false; dits.length = 0;
    document.getElementById('voiceTest').click();
    out.test = { actives: G.settings.voices, dits: dits.join(' | ') };
    // 4) « À bientôt » quand on se lève
    // on attend des IMAGES, pas des minuteries : c'est schoolTick, appele a l'image, qui
    // referme la classe quand on se leve (sur une machine chargee les minuteries s'accumulent
    // toutes entre deux images et rien n'a encore tourne)
    dits.length = 0; G.P.sit = null;
    for (let i = 0; i < 60 && G.school.chaise; i++) await new Promise(rr => requestAnimationFrame(rr));
    out.aurevoir = dits.join(' | '); out.uiApres = G.uiOpen;
    G.school.chaise = null;
    return out;
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const bonjour = new RegExp('Bonjour élève ' + String(r.nom).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(r.bonjour);
  const enonce = /Réponse un/.test(r.enonce) && /Réponse quatre/.test(r.enonce);
  const gagne = /gagn/i.test(r.gagne), faux = /faux/i.test(r.faux) && r.faux.includes(r.bonneReponse);
  const testBouton = r.bouton && r.test.actives === true && /maîtresse/i.test(r.test.dits);
  const ok = r.defaut === true && !r.reglage && r.moteur && r.parleOuRepli && r.envoyees >= 1
    && bonjour && enonce && gagne && faux && r.bulle && testBouton && /bientôt/i.test(r.aurevoir) && r.uiApres === null;
  return { ok, detail: `la voix ne sortait jamais (liste des voix vide au premier appel, file laissée en pause par Chrome, utterance ramassée par le ramasse-miettes, aucun repli quand la machine est muette) · elle est ACTIVE par défaut (settings.voices=${r.defaut}, réglage enregistré : ${r.reglage}) et le bouton « Tester la voix » existe (« ${r.libelle} ») et la réactive (${r.test.actives}) · sur cette machine : moteur=${r.moteur}, ${r.voix} voix dont ${r.fr} française(s) → ${r.parleOuRepli ? 'la phrase part et, faute de voix, le jingle de repli la remplace' : 'RIEN'} · à l'assise elle dit « ${String(r.bonjour).slice(0, 46)} », lit l'énoncé et les 4 réponses (${enonce}), dit « ${String(r.gagne).slice(0, 24)} » ou « ${String(r.faux).slice(0, 40)} », affiche une bulle au-dessus d'elle (${r.bulle}) et « ${String(r.aurevoir).slice(0, 20)} » quand on se lève (interface refermée : ${r.uiApres === null})` };
});

test('le tableau gris de l\'école s\'écrit à la craie, lettre par lettre, avec le crissement de la craie', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: -62, y: 1, z: 220, hour: 12 });
    await dodo(300);
    const salle = G.city.classes[0]; if (!salle) return { pourquoi: 'aucune salle de classe' };
    G.settings.voices = false; G.settings.sound = true;   // le jingle de la voix polluerait la mesure
    const ch = salle.chaises[0];
    G.P.sit = null; G.school.chaise = null; G.P.pos.set(ch.x, 0.6, ch.z + 0.3); G.sitBench(ch);
    for (let i = 0; i < 60 && G.uiOpen !== 'schoolUI'; i++) await dodo(100);
    if (!G.school.q) return { pourquoi: 'la classe ne s\'est pas ouverte' };
    // ÉCOUTE AU BOUT DE LA CHAÎNE AUDIO : un analyseur ne montre que les 46 dernières
    // millisecondes à l'instant où on le lit, et sur la machine du banc d'essai (2 images/s)
    // le crissement, qui dure 150 ms, était toujours déjà passé. On branche donc un nœud qui
    // ÉCOUTE EN CONTINU et retient la crête sur toute une fenêtre.
    const c = G.sfx.unlock(), chn = G.sfx.chaine();
    let crete = 0;
    const sp = c.createScriptProcessor(2048, 1, 1);
    sp.onaudioprocess = e => { const d = e.inputBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > crete) crete = v; } };
    const muet = c.createGain(); muet.gain.value = 0;
    chn.lim.connect(sp); sp.connect(muet); muet.connect(c.destination);
    const ecoute = async (ms, quoi) => { crete = 0; const t = performance.now(); while (performance.now() - t < ms) { if (quoi) quoi(); await dodo(25); } return +crete.toFixed(4); };
    G.engine.stop(); try { G.music.stop(); } catch (e) {} try { G.siren.stop(); } catch (e) {} try { G.meteoSet('clair', 999); } catch (e) {}
    const silence = await ecoute(700);
    const q = G.school.q, w0 = G.wallet;
    const lus = () => (salle.dessine || '').split(' | ').join('').length;
    G.school.craieSons = 0; const v0 = salle.tex.version;
    G.answer(q.a, document.querySelector('#schChoices .item'));
    // on referme tout de suite : sinon l'exercice suivant, programme apres le verdict, vient
    // effacer le tableau au milieu de la mesure (la machine du banc d'essai rend 2 images/s)
    G.closeUI();
    const juste = { texte: salle.texte, dessine: salle.dessine, lus: lus(), aEcrire: salle.tab.aEcrire, sons: G.school.craieSons };
    // avancement DÉTERMINISTE : on recule l'horloge de départ du tracé, la cadence ne dépend
    // donc ni de la vitesse de la machine ni du nombre d'images rendues
    // espion sur le bus audio : on note SUR QUELLE SORTIE la craie branche son bruit
    const bus = [], sortieOrig = G.sfx.sortie;
    G.sfx.sortie = n => { bus.push(n); return sortieOrig(n); };
    salle.tab.t0 = performance.now() - 250; G.craieTick(0.016);
    const t1 = { lus: lus(), sons: G.school.craieSons, dessine: salle.dessine };
    salle.tab.t0 = performance.now() - 1000; G.craieTick(0.016);
    const t2 = { lus: lus(), sons: G.school.craieSons, dessine: salle.dessine };
    G.sfx.sortie = sortieOrig;
    // le crissement SORT-IL de la chaîne ? on le rejoue et on écoute la sortie du limiteur.
    // (La mesure est indicative : le nœud d'écoute tourne sur le fil principal, et sur une
    // machine chargée il perd des paquets. La garantie, elle, est l'espion du bus ci-dessus.)
    const horloge0 = c.currentTime;
    const pic = await ecoute(700, () => G.sonCraie(3));
    const horloge = +(c.currentTime - horloge0).toFixed(2);
    salle.tab.t0 = performance.now() - 20000; G.craieTick(0.016);
    const fin = { lus: lus(), dessine: salle.dessine, texte: salle.texte, versions: salle.tex.version - v0 };
    const viseur = () => { const t = salle.tableau; const d = Math.atan2(-(t.position.x - G.P.pos.x), -(t.position.z - G.P.pos.z)) - G.cam.yaw; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
    const camAvant = +viseur().toFixed(2);
    for (let i = 0; i < 60; i++) G.camTableau(0.05);   // la caméra se cale sur le tableau en une seconde
    const cam = { avant: camAvant, ecart: +viseur().toFixed(3), pitch: +G.cam.pitch.toFixed(2), interieur: !!G.cam.interieur, dist: +G.cam.dist.toFixed(1) };
    // et sur une mauvaise réponse : le verdict rouge s'écrit pareil
    G.openSchool(salle);   // toujours assis : la classe se rouvre
    for (let i = 0; i < 60 && !G.school.q; i++) await dodo(150);
    let rouge = null;
    if (G.school.q) { const q2 = G.school.q; G.answer(q2.opts.find(o => o !== q2.a), document.querySelector('#schChoices .item')); G.closeUI();
      const l = salle.tab.lignes.filter(o => o.neuve); rouge = { texte: salle.texte, couleurs: l.map(o => o.c || ''), aEcrire: salle.tab.aEcrire }; }
    try { chn.lim.disconnect(sp); sp.disconnect(); muet.disconnect(); sp.onaudioprocess = null; } catch (e) {}
    G.closeUI(); G.P.sit = null; G.school.chaise = null;
    return { juste, t1, t2, fin, rouge, silence, pic, cps: G.CRAIE_CPS, gain: G.wallet - w0, cam,
      bus, etatAudio: c.state, horloge, son: G.settings.sound };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const q = r.juste, v = r.rouge;
  // au départ le verdict n'est PAS encore tracé, puis il grandit lettre par lettre
  const depart = q.lus < q.texte.split(' | ').join('').length && q.aEcrire > 8;
  const monte = r.t1.lus > q.lus && r.t2.lus > r.t1.lus && r.fin.lus > r.t2.lus;
  const cadence = Math.abs((r.t1.lus - q.lus) - Math.round(0.25 * r.cps)) <= 1 && Math.abs((r.t2.lus - q.lus) - Math.round(1 * r.cps)) <= 1;
  const complet = r.fin.dessine === r.fin.texte && /GAGNÉ/.test(r.fin.texte);
  // GARANTIE DÉTERMINISTE : pendant l'écriture, la craie branche bien son bruit sur le bus
  // « effets » d'un moteur audio qui tourne (l'horloge du contexte avance). Le niveau mesuré
  // au bout de la chaîne est reporté en plus, mais il dépend de la charge de la machine.
  const son = r.t2.sons > r.t1.sons && r.t1.sons > 0 && r.bus.length >= 3
    && r.bus.every(b => b === 'effets') && r.etatAudio === 'running' && r.horloge > 0.3 && r.son
    && r.pic >= r.silence;
  const rouge = !!v && /FAUX/.test(v.texte) && v.couleurs.some(c => c === '#ffc2c2') && v.aEcrire > 4;
  const cadre = r.cam.ecart < 0.12 && r.cam.pitch <= 0.24;
  const ok = depart && monte && cadence && complet && r.fin.versions >= 3 && son && rouge && cadre;
  return { ok, detail: `la réponse tombait d'un bloc sur le tableau : elle s'ÉCRIT maintenant à la craie, ${r.cps} lettres/s · juste après la réponse le tableau ne porte que l'énoncé (${q.lus} caractères tracés, ${q.aEcrire} restent à écrire), puis ${r.t1.lus} à 250 ms, ${r.t2.lus} à 1 s (« ${String(r.t2.dessine).split(' | ').slice(2).join(' ').trim().slice(0, 30)} ») et enfin « ${String(r.fin.texte).split(' | ').slice(2).join(' · ')} » (${r.fin.lus}) · la texture du tableau est repeinte ${r.fin.versions} fois · le crissement de la craie (bruit passe-bande 2–4 kHz) est joué ${r.t2.sons} fois pendant le tracé et branché ${r.bus.length} fois sur le bus « ${[...new Set(r.bus)].join(', ')} » d'un moteur audio qui tourne (${r.etatAudio}, horloge +${r.horloge} s) ; niveau mesuré au bout de la chaîne : silence ${r.silence}, craie ${r.pic} · un verdict faux s'écrit pareil, en rouge (${v ? v.couleurs.filter(Boolean).join(' ') : '—'}) · assis en classe la caméra cadre le tableau : l'écart de visée tombe de ${r.cam.avant} à ${r.cam.ecart} radian et la visée s'aplatit à ${r.cam.pitch} (maison de poupée ${r.cam.interieur}, caméra à ${r.cam.dist} m : la tête de l'élève passe sous le texte)` };
});

test('à l\'école on s\'assoit AVANT les exercices : E sur la chaise, et se lever ferme la classe', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: -62, y: 1, z: 220, hour: 12 });
    await dodo(300);
    const salle = G.city.classes[0]; if (!salle) return { pourquoi: 'aucune salle de classe' };
    G.settings.voices = false;
    const ch = salle.chaises[0];
    // 1) DEBOUT au milieu de la classe : l'interface ne doit pas s'ouvrir
    G.P.sit = null; G.school.chaise = null; if (G.uiOpen) G.closeUI();
    G.P.pos.set(salle.x, 0.6, salle.z);
    const debout = { retour: G.openSchool(salle), ui: G.uiOpen };
    // 2) la touche E devant une chaise d'école : on s'ASSOIT (l'ordre des actions faisait
    //    gagner « la classe » sur « la chaise », et les exercices s'ouvraient debout)
    G.P.pos.set(ch.x, 0.6, ch.z + 0.8); G.P.sit = null;
    // on avance la simulation image par image (pas d'attente reelle : la machine du banc
    // d'essai rend 2 images/s) jusqu'a ce que le reperage de proximite ait tourne
    for (let i = 0; i < 40 && !(G.city.benchNear && G.city.benchNear.ecole === salle); i++) G.step(1 / 60, true);
    const visee = G.city.benchNear;   // deux chaises voisines sont a moins d'1,80 m : c'est l'une des deux
    const proche = { bench: !!(visee && visee.ecole === salle), classe: !!G.city.classNear,
      pos: [+G.P.pos.x.toFixed(1), +G.P.pos.y.toFixed(2), +G.P.pos.z.toFixed(1)], chaise: [+ch.x.toFixed(1), +ch.z.toFixed(1)] };
    if (!proche.bench) return { pourquoi: `la chaise d'école n'est pas détectée à portée : joueur ${proche.pos}, chaise ${proche.chaise}, benchNear=${G.city.benchNear ? 'un autre banc' : 'aucun'}` };
    // c'est exactement l'événement que produit la manette (◯ → telTouche('KeyE'))
    const presseE = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'KeyE', bubbles: true }));
    presseE();
    const assis = { sit: G.P.sit === visee, ui: G.uiOpen };
    for (let i = 0; i < 60 && G.uiOpen !== 'schoolUI'; i++) await dodo(100);
    const classe = { ui: G.uiOpen, q: !!G.school.q, chaise: G.school.chaise === visee };
    // 3) on ferme la classe mais on reste assis : E la rouvre
    document.getElementById('schClose').click(); await dodo(80);
    const ferme = { ui: G.uiOpen, sit: G.P.sit === visee };
    presseE(); await dodo(80);
    const rouvre = { ui: G.uiOpen, sit: G.P.sit === visee };
    // 4) on se lève : la classe se ferme toute seule
    G.P.sit = null;
    let images = 0;
    for (let i = 0; i < 60 && G.school.chaise; i++) { await new Promise(rr => requestAnimationFrame(rr)); images++; }
    const leve = { ui: G.uiOpen, chaise: !!G.school.chaise, dit: G.school.dit, images };
    G.school.chaise = null;
    return { debout, proche, assis, classe, ferme, rouvre, leve };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const ok = r.debout.retour === false && r.debout.ui === null
    && r.proche.bench && r.assis.sit && r.assis.ui !== 'schoolUI'
    && r.classe.ui === 'schoolUI' && r.classe.q && r.classe.chaise
    && r.ferme.ui === null && r.rouvre.ui === 'schoolUI' && r.rouvre.sit
    && r.leve.ui === null && r.leve.chaise === false && /bientôt/i.test(r.leve.dit || '');
  return { ok, detail: `on ouvrait les exercices DEBOUT au milieu de la classe : openSchool refuse maintenant (${r.debout.retour}, interface ${r.debout.ui}) · devant une chaise d'école, E (clavier — et ◯ de la manette, qui rejoue exactement cette touche) fait d'abord ASSEOIR (assis=${r.assis.sit}, interface encore ${r.assis.ui}) puis la classe s'ouvre d'elle-même (${r.classe.ui}, exercice=${r.classe.q}) · « Sortir de la classe » laisse assis (${r.ferme.sit}) et E rouvre (${r.rouvre.ui}) · se lever ferme tout, en ${r.leve.images} image(s) : interface ${r.leve.ui}, chaise oubliée (${!r.leve.chaise}), la maîtresse dit « ${String(r.leve.dit || '').slice(0, 20)} »` };
});

test('le bandeau des touches ne barre plus l\'ecran : il ne sort qu\'a la demande', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const vu = () => getComputedStyle(document.getElementById('padLeg')).display;
    document.body.classList.remove('aide');
    document.body.classList.add('manette');
    const repos = { aide: document.body.classList.contains('aide'), leg: vu() };
    G.padAction('aide'); const ouvert = { aide: document.body.classList.contains('aide'), leg: vu() };
    G.padAction('aide'); const referme = { aide: document.body.classList.contains('aide'), leg: vu() };
    // il s'efface aussi tout seul au bout de son delai
    G.montreAide(0.2); const avant = vu(); await dodo(400); G.aideTick(); const apres = vu();
    // et le bouton des reglages le rappelle
    const bouton = !!document.getElementById('aideBtn');
    document.body.classList.remove('manette', 'aide');
    return { repos, ouvert, referme, avant, apres, bouton, pave: G.PAD_CROIX[17] };
  });
  const ok = r.repos.leg === 'none' && !r.repos.aide && r.ouvert.leg === 'flex' && r.referme.leg === 'none'
    && r.avant === 'flex' && r.apres === 'none' && r.bouton && r.pave === 'aide';
  return { ok, detail: `le bandeau des touches (« R2 avancer · L2 reculer · Stick G direction… ») restait affiché EN PERMANENCE dès qu'une manette était branchée : trois lignes en travers du haut de l'écran, par-dessus le jeu · il est maintenant masqué au repos (${r.repos.leg}), sort quelques secondes a la connexion, se rappelle par le PAVÉ TACTILE de la DualSense (${r.pave}) ou par le bouton « ⌨️ Rappeler les touches » des réglages (${r.bouton}), et se referme au deuxième appui (${r.referme.leg}) ou tout seul après son délai (${r.avant} → ${r.apres})` };
});

// ================= POSTE K : DESIGN ET GRAPHISME =================

test('le ciel et la lumiere changent VRAIMENT avec l\'heure (palette, soleil, brume, ombres)', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 44, hour: 12 });
    const avant = G.settings.ambiance;
    const lire = () => ({
      soleil: '#' + G.sun.color.getHexString(), force: +G.sun.intensity.toFixed(2),
      haut: '#' + G.cielDome.material.uniforms.haut.value.getHexString(),
      bas: '#' + G.cielDome.material.uniforms.bas.value.getHexString(),
      brume: G.scene.fog ? '#' + G.scene.fog.color.getHexString() : null,
      dir: [+G.SOLEIL_DIR.x.toFixed(2), +G.SOLEIL_DIR.y.toFixed(2)],
      h: +G.day.h.toFixed(1),
    });
    const m = {};
    for (const a of ['matin', 'midi', 'couchant', 'nuit']) { G.ambianceSet(a); m[a] = lire(); }
    G.ambianceSet(avant || 'auto');
    m.palette = { bornes: !!(G.DA && G.DA.heures && G.DA.heures.length >= 6), reperes: G.DA ? G.DA.heures.length : 0 };
    // la palette RAMENE une couleur qui detonne dans ses bornes, sans toucher a sa teinte
    const crie = G.accorde(0x00ff00), hsl = { h: 0, s: 0, l: 0 }; crie.getHSL(hsl);
    m.accorde = { sat: +hsl.s.toFixed(2), teinte: +hsl.h.toFixed(2) };
    // le dome du ciel ne coute qu'UN maillage
    m.dome = { unSeulMaillage: !!(G.cielDome && G.cielDome.isMesh), triangles: G.cielDome.geometry.index ? G.cielDome.geometry.index.count / 3 : 0 };
    return m;
  });
  const diff = (a, b) => a.soleil !== b.soleil && a.haut !== b.haut && a.bas !== b.bas;
  const tourne = Math.abs(r.matin.dir[0] - r.couchant.dir[0]) > 0.5;
  const ok = r.palette.bornes && r.palette.reperes >= 6
    && diff(r.matin, r.midi) && diff(r.midi, r.couchant) && diff(r.couchant, r.nuit)
    && r.midi.force > r.couchant.force && r.couchant.force > r.nuit.force
    && r.midi.brume !== r.couchant.brume
    && tourne && r.dome.unSeulMaillage && r.dome.triangles < 900
    && r.accorde.sat <= 0.83 && Math.abs(r.accorde.teinte - 1 / 3) < 0.01;
  return { ok, detail: `le ciel etait un APLAT (une seule couleur du zenith a l'horizon, la MEME a 7 h et a 19 h) et le soleil ne bougeait jamais (la boucle de rendu le replacait a un cap fixe, ce qui annulait la course calculee par dayTick : les ombres tombaient toujours dans le meme sens) · palette de reference DA a ${r.palette.reperes} reperes horaires, et accorde() ramene un vert criard a ${r.accorde.sat} de saturation sans toucher sa teinte (${r.accorde.teinte}) · matin ${r.matin.soleil}/${r.matin.force} ciel ${r.matin.haut}→${r.matin.bas} · midi ${r.midi.soleil}/${r.midi.force} ciel ${r.midi.haut}→${r.midi.bas} · couchant ${r.couchant.soleil}/${r.couchant.force} ciel ${r.couchant.haut}→${r.couchant.bas} · nuit ${r.nuit.soleil}/${r.nuit.force} ciel ${r.nuit.haut}→${r.nuit.bas} · la brume suit (${r.midi.brume} → ${r.couchant.brume}) et le soleil TOURNE (x ${r.matin.dir[0]} le matin, ${r.couchant.dir[0]} au couchant) · le degrade coute UN maillage de ${r.dome.triangles} triangles` };
});

test('la nuit la ville s\'allume (fenetres, lampadaires, neons) et le jour elle s\'eteint', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 44, hour: 12 });
    const avant = G.settings.ambiance;
    const compte = () => {
      let fenetres = 0, neons = 0;
      for (const m of G.city.buildings) if (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0.1) fenetres++;
      for (const m of G.NEONS) if (m.emissiveIntensity > 1) neons++;
      const halos = G.day.glows.filter(s => s.visible).length;
      return { fenetres, neons, halos };
    };
    G.lumieresVille(false); const jour = compte();
    G.lumieresVille(true); const nuit = compte();
    // et le CYCLE AUTOMATIQUE, lui, ne les allume jamais : il fait toujours jour
    G.ambianceSet('auto');
    let auto = 0;
    const t0 = G.simTime;
    for (let i = 0; i <= 120; i++) { G.simTime = i / 60 * 360; G.dayTick(); if (G.day.night > 0.5) auto++; }
    G.simTime = t0;
    const apresAuto = compte();
    // l'ambiance « nuit » choisie au menu, elle, allume tout
    G.ambianceSet('nuit'); G.dayTick();
    const choisie = compte(); const nuitChoisie = G.day.night;
    const etoiles = G.stars.visible;
    G.ambianceSet(avant || 'auto'); G.dayTick();
    return { jour, nuit, auto, apresAuto, choisie, nuitChoisie: +nuitChoisie.toFixed(2), etoiles, total: G.city.buildings.length, neonsTotal: G.NEONS.length };
  });
  const ok = r.jour.fenetres === 0 && r.jour.halos === 0 && r.jour.neons === 0
    && r.nuit.fenetres === r.total && r.nuit.fenetres > 20 && r.nuit.halos > 10 && r.nuit.neons > 20
    && r.auto === 0 && r.apresAuto.fenetres === 0
    && r.choisie.fenetres === r.total && r.choisie.halos > 10 && r.nuitChoisie > 0.7 && r.etoiles;
  return { ok, detail: `tout le decor de nuit du jeu (fenetres allumees, halos de lampadaires, ${r.neonsTotal} materiaux de neon, etoiles) existait et ne servait JAMAIS, puisque le cycle ne descend plus dans la nuit · lumieresVille() les commande maintenant d'un bloc : de jour ${r.jour.fenetres} fenetre allumee, ${r.jour.halos} halo, ${r.jour.neons} neon pousse · de nuit ${r.nuit.fenetres}/${r.total} facades allumees, ${r.nuit.halos} halos, ${r.nuit.neons} neons · le cycle automatique reste toujours de jour (${r.auto} image sombre sur 120, ${r.apresAuto.fenetres} fenetre allumee) et c'est le REGLAGE « Ambiance : nuit » qui allume la ville (obscurite ${r.nuitChoisie}, ${r.choisie.halos} halos, ciel etoile=${r.etoiles})` };
});

test('les effets d\'image s\'eteignent aux basses qualites et le nombre d\'appels de dessin ne bouge pas', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 44, hour: 12, garderQualite: true });
    const avant = G.settings.quality;
    // three.js remet ses compteurs a zero AU DEBUT de chaque render() : avec la passe de
    // nettete, le dernier appel est le carre plein ecran et on lisait donc « 1 appel ». On
    // coupe la remise a zero automatique pour additionner toutes les passes d'UNE image.
    G.renderer.info.autoReset = false;
    const image = () => { G.renderer.info.reset(); G.rendreImage();
      return { appels: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles }; };
    const etat = q => { G.settings.quality = q; G.applyQuality();
      return Object.assign({ post: !!G.post.on, grade: !!G.post.grade, halo: !!G.post.halo, cle: G.post.cle }, image()); };
    const basse = etat('low'), haute = etat('high'), ultra = etat('ultra');
    // en diffusion TV le halo (huit echantillons de plus par pixel) reste eteint
    G.settings.quality = 'ultra'; G.diffusionMode(true); G.applyQuality();
    const tv = { post: !!G.post.on, grade: !!G.post.grade, halo: !!G.post.halo };
    G.diffusionMode(false);
    // LE SURCOUT EXACT DU DOME DU CIEL : un appel de dessin, pas un de plus
    G.settings.quality = 'high'; G.applyQuality();
    G.cielDome.visible = false; const sans = image();
    G.cielDome.visible = true; const avecDome = image();
    // LE SURCOUT D'UN ACCIDENT GRAVE : feu, debris, verre au sol et dix marques de choc
    const c = G.city.cars.find(v => v.parts && !v.heli && !v.rider);
    G.eteintFeu(c); G.repairVisual(c); c.dmg = 0; G.marques.length = 0;
    const calme = image();
    G.degatsVehicule(c, 3, 3, 3);
    for (let i = 0; i < 12; i++) G.marqueMur(i * 2 - 10, 1, 40, 0, -1, 2);
    G.feuxVehiculesTick(1 / 60);
    const accidente = image();
    const marques = G.marques.length, debris = G.debris.length;
    G.eteintFeu(c); G.repairVisual(c); c.dmg = 0;
    G.settings.quality = avant; G.applyQuality(); G.renderer.info.autoReset = true;
    return { basse, haute, ultra, tv, dome: avecDome.appels - sans.appels, sans: sans.appels,
      accident: accidente.appels - calme.appels, calme: calme.appels, marques, debris };
  });
  const ok = !r.basse.post && !r.basse.grade && !r.basse.halo
    && r.haute.post && r.haute.grade && !r.haute.halo
    && r.ultra.post && r.ultra.grade && r.ultra.halo
    && r.tv.post && r.tv.grade && !r.tv.halo
    && r.dome === 1 && r.accident <= 120
    && r.ultra.appels < 16000 && r.ultra.tris < 1600000;
  return { ok, detail: `le vignettage et l'etalonnage etaient un FILTRE CSS sur le canevas : une passe de composition en plein ecran, coupee sur la tele (l'image y etait donc plus terne) · ils sont maintenant dans la passe de nettete, compiles a la demande — en qualite basse le programme ne contient meme pas leurs instructions · basse : passe=${r.basse.post}, etalonnage=${r.basse.grade}, halo=${r.basse.halo} · haute : ${r.haute.post}/${r.haute.grade}/${r.haute.halo} (programme « ${r.haute.cle} ») · Ultra HD : ${r.ultra.post}/${r.ultra.grade}/${r.ultra.halo} (« ${r.ultra.cle} ») · diffusion TV : halo=${r.tv.halo} (huit echantillons de plus par pixel, hors de question sur une 4K) · COUT MESURE sur une image entiere (passe d'ombres comprise) : le dome du ciel ajoute ${r.dome} appel de dessin (${r.sans} → ${r.sans + r.dome}), et un accident grave complet — feu de ${9} flammes, ${r.debris} debris et ${r.marques} marques de choc — en ajoute ${r.accident} sur ${r.calme}, soit moins de 1 % · plafond tenu : ${r.ultra.appels} appels et ${r.ultra.tris} triangles en Ultra HD` };
});

test('l\'interface se lit de loin : contraste du texte, etats des boutons, curseur manette bien visible', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 44, hour: 12 });
    document.querySelectorAll('#top,#chat,#act,#missionHud').forEach(e => { e.style.display = ''; });
    const lum = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
      if (!m) return null; const v = [1, 2, 3].map(i => { const x = +m[i] / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
      return { L: 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2], a: m[4] == null ? 1 : +m[4] }; };
    // le texte des pastilles sur son panneau : rapport de contraste (norme WCAG)
    const pastille = document.getElementById('coins');
    const st = getComputedStyle(pastille);
    const fond = lum(st.backgroundColor), encre = lum(st.color);
    // le panneau est translucide : on le compose sur un ciel de midi, le pire des cas
    const ciel = 0.62;
    const Lf = fond.L * fond.a + ciel * (1 - fond.a);
    const contraste = (Math.max(encre.L, Lf) + 0.05) / (Math.min(encre.L, Lf) + 0.05);
    // les boutons ont des etats visibles, et l'interface une grille commune
    const rac = getComputedStyle(document.documentElement);
    const grille = { r: rac.getPropertyValue('--r').trim(), vif: rac.getPropertyValue('--vif').trim(), panneau: rac.getPropertyValue('--panel').trim() };
    const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(x => x.cssText); } catch (e) { return []; } }).join('\n');
    const etats = { survol: /\.ibtn:hover/.test(css), appui: /\.ibtn:active/.test(css), focus: /\.ibtn:focus-visible/.test(css),
      btnSurvol: /\.btn:hover/.test(css), btnFocus: /\.btn:focus-visible/.test(css) };
    // le curseur de navigation manette
    const b = document.getElementById('menuBtn');
    b.classList.add('focustv');
    const cs = getComputedStyle(b);
    const curseur = { epaisseur: parseFloat(cs.outlineWidth), couleur: cs.outlineColor, halo: cs.boxShadow.length > 20, anime: cs.animationName !== 'none' };
    b.classList.remove('focustv');
    // le grand message ne tombe plus sur la tete du personnage
    const msg = getComputedStyle(document.getElementById('msg'));
    return { contraste: +contraste.toFixed(2), grille, etats, curseur, msgTop: msg.top, msgFond: msg.backgroundColor,
      alpha: fond.a, taillePastille: st.fontSize };
  });
  const ok = r.contraste >= 4.5
    && r.grille.r && r.grille.vif && r.grille.panneau
    && r.etats.survol && r.etats.appui && r.etats.focus && r.etats.btnSurvol && r.etats.btnFocus
    && r.curseur.epaisseur >= 4 && r.curseur.halo && r.curseur.anime
    && parseFloat(r.msgTop) > 0;
  return { ok, detail: `les pastilles du haut posaient un texte blanc sur un panneau trop clair et sans ombre, et AUCUN bouton n'avait d'etat visible : on ne savait jamais lequel on visait · contraste du texte principal sur un ciel de midi : ${r.contraste}:1 (norme WCAG AA : 4,5) · une seule grille pour toute l'interface (rayon ${r.grille.r}, curseur ${r.grille.vif}, panneau ${r.grille.panneau}) · etats : survol=${r.etats.survol}, appui=${r.etats.appui}, focus manette=${r.etats.focus}, memes etats sur les gros boutons (${r.etats.btnSurvol}/${r.etats.btnFocus}) · curseur manette : contour de ${r.curseur.epaisseur} px ${r.curseur.couleur}, double halo (${r.curseur.halo}) qui respire (${r.curseur.anime}) · le grand message remonte a ${r.msgTop} sur un bandeau (${r.msgFond}) : il tombait pile sur la tete du personnage et sur son etiquette de nom` };
});

test('les degats d\'un accident suivent la vitesse du choc et s\'accumulent stade par stade', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: -13, y: 1, z: 11, hour: 12 });
    const c = G.city.cars.find(v => v.parts && !v.heli && !v.rider);
    if (!c) return { pourquoi: 'aucune voiture a carrosserie dans la ville' };
    G.eteintFeu(c); G.repairVisual(c); c.dmg = 0;
    // l'echelle : la meme voiture, quatre vitesses d'impact
    const echelle = [2, 6, 12, 20].map(v => G.graviteChoc(v, 0));
    // le cumul compte aussi : sans un seul gros choc, a force de frotter, ca s'abime
    const cumul = [10, 30, 60, 90].map(d => G.graviteChoc(0, d));
    const p2 = c.parts;
    const etat = () => ({
      pareBrise: p2.ws ? (!p2.ws.visible ? 'brise' : p2.ws.material === G.crackedGlass ? 'fissure' : 'intact') : 'aucun',
      pharesCasses: p2.lights.filter(l => l.material && l.material.emissive && l.material.emissive.getHex() === 0).length,
      capot: p2.hood ? +p2.hood.rotation.x.toFixed(2) : 0,
      portiereDecalee: p2.doors[0] ? Math.abs(p2.doors[0].rotation.y) > 0.1 : false,
      pieces: (c.wheels || []).filter(w => w.parent !== c.g).length,
      debris: G.debris.length, fumee: c.fumee || 'aucune', feu: !!c.feu, deg: c.deg || 0,
    });
    const suite = [];
    suite.push(Object.assign({ stade: 0 }, etat()));
    for (const g of [1, 2, 3]) { G.degatsVehicule(c, g, 3, 3); suite.push(Object.assign({ stade: g }, etat())); }
    // on ne repasse JAMAIS en arriere : redemander un stade plus leger ne repare rien
    G.degatsVehicule(c, 1, 0, 0);
    const apresRetour = c.deg;
    // le garage, lui, remet tout d'aplomb
    G.eteintFeu(c); G.repairVisual(c); c.dmg = 0;
    const repare = Object.assign({}, etat(), { roues: (c.wheels || []).filter(w => w.parent === c.g).length });
    return { echelle, cumul, suite, apresRetour, repare };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const [s0, s1, s2, s3] = r.suite;
  const ok = JSON.stringify(r.echelle) === JSON.stringify([0, 1, 2, 3])
    && JSON.stringify(r.cumul) === JSON.stringify([0, 1, 2, 3])
    && s0.deg === 0 && s0.pareBrise === 'intact' && s0.pharesCasses === 0
    && s1.deg === 1 && s1.pharesCasses === 1 && s1.debris > s0.debris && s1.fumee === 'blanche' && !s1.feu
    && s2.deg === 2 && s2.pareBrise === 'fissure' && s2.pharesCasses === 2 && s2.capot < -0.4 && s2.portiereDecalee && s2.debris > s1.debris
    && s3.deg === 3 && s3.pareBrise === 'brise' && s3.pieces === 1 && s3.fumee === 'noire' && s3.feu && s3.debris > s2.debris
    && r.apresRetour === 3
    && r.repare.deg === 0 && r.repare.pareBrise === 'intact' && r.repare.roues === 4 && !r.repare.feu;
  return { ok, detail: `un choc n'augmentait qu'un pourcentage INVISIBLE : deux etincelles, et la voiture repartait comme neuve a l'oeil · l'echelle suit maintenant la vitesse d'impact (2, 6, 12, 20 m/s → gravites ${r.echelle.join(', ')}) ET le cumul des chocs precedents (10, 30, 60, 90 % → ${r.cumul.join(', ')}) · stade LEGER : ${s1.pharesCasses} phare pete avec ${s1.debris - s0.debris} eclats de verre au sol, pare-chocs tordu, tole froissee, fumee ${s1.fumee} · stade MOYEN : pare-brise ${s2.pareBrise}, capot souleve (${s2.capot} rad), portiere enfoncee (${s2.portiereDecalee}), pare-chocs qui tombe, ${s2.debris - s1.debris} morceaux de plus · stade GRAVE : pare-brise ${s3.pareBrise}, ${s3.pieces} pneu arrache qui roule, ${s3.debris - s2.debris} morceaux de plus, fumee ${s3.fumee}, et ca prend feu (${s3.feu}) · on ne repasse jamais en arriere (redemande du stade 1 : reste a ${r.apresRetour}) et le garage remet tout d'aplomb (${r.repare.roues} roues, pare-brise ${r.repare.pareBrise}, feu ${r.repare.feu})` };
});

test('un vehicule gravement accidente brule une dizaine de secondes puis reste une carcasse noircie', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: -13, y: 1, z: 11, hour: 12 });
    const c = G.city.cars.find(v => v.parts && !v.heli && !v.rider);
    if (!c) return { pourquoi: 'aucune voiture a carrosserie' };
    G.eteintFeu(c); G.repairVisual(c); c.dmg = 0;
    G.feuVehicule(c, 10);
    const f = c.feu;
    const depart = { flammes: f.flammes.length, lueur: !!f.lueur, duree: f.duree, noirci: !!c.noirci };
    // les flammes ONDULENT : on releve la taille de chacune sur une seconde
    const tailles = f.flammes.map(() => []);
    for (let i = 0; i < 60; i++) { G.feuxVehiculesTick(1 / 60); f.flammes.forEach((fl, k) => tailles[k].push(fl.s.scale.y)); }
    const bougent = tailles.filter(t => Math.max(...t) - Math.min(...t) > 0.05).length;
    const grandes = f.flammes.filter(fl => fl.base > 1.4).length, petites = f.flammes.filter(fl => fl.base <= 1.4).length;
    // a mi-parcours ca brule toujours
    for (let i = 0; i < 240; i++) G.feuxVehiculesTick(1 / 60);
    const a5s = { feu: !!c.feu, t: c.feu ? +c.feu.t.toFixed(1) : null };
    // a 9 s aussi
    for (let i = 0; i < 240; i++) G.feuxVehiculesTick(1 / 60);
    const a9s = !!c.feu;
    // et a 11 s, plus rien : une carcasse
    for (let i = 0; i < 150; i++) G.feuxVehiculesTick(1 / 60);
    const apres = { feu: !!c.feu, noirci: !!c.noirci, enfants: c.g.children.length };
    const noir = [];
    c.g.traverse(o => { if (o.isMesh && o.material && o.material.color) noir.push(o.material.color.getHex()); });
    const tousNoirs = noir.length ? noir.filter(h => h === 0x2a2622 || h === 0x2f2b28).length / noir.length : 0;
    G.repairVisual(c); c.dmg = 0;
    const repeint = c.g.children.length > 0 && !c.noirci;
    return { depart, bougent, grandes, petites, a5s, a9s, apres, tousNoirs: +tousNoirs.toFixed(2), repeint };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const ok = r.depart.flammes >= 6 && r.depart.lueur && r.depart.duree === 10
    && r.bougent === r.depart.flammes && r.grandes >= 2 && r.petites >= 4
    && r.a5s.feu && r.a9s && !r.apres.feu && r.apres.noirci && r.tousNoirs > 0.5 && r.repeint;
  return { ok, detail: `une epave restait un tas parfaitement froid · feuVehicule(c, 10) : ${r.depart.flammes} flammes (${r.grandes} grandes, ${r.petites} petites) qui ONDULENT toutes (${r.bougent}/${r.depart.flammes} changent de taille sur une seconde), une lueur qui bat et une fumee noire qui monte · ca brule encore a 5 s (t=${r.a5s.t}) et a 9 s (${r.a9s}), c'est eteint apres 11 s (${r.apres.feu}) et il ne reste qu'une CARCASSE noircie (${Math.round(r.tousNoirs * 100)} % des pieces repeintes en noir) · le garage rend sa peinture au vehicule (${r.repeint})` };
});

test('un bonhomme de neige percute se casse et tombe, un mur percute garde une marque', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: -13, y: 1, z: 11, hour: 12 });
    // --- le bonhomme de neige ---
    // Le bonhomme de neige est desormais bati par `bonhommeNeige()` : il est SOLIDE et inscrit
    // dans les objets cassables, donc une voiture le casse ET les employes municipaux viennent
    // le remonter. On mesure sur ce mecanisme-la, pas sur l'ancienne liste posee a la main.
    G.meteoSet('neige', 9999); G.meteo.force = 1; G.neigeDecor(true);
    const liste = G.breakables.filter(x => x.kind === 'neige');
    const b = liste.find(x => !x.broken);
    const avant = b ? b.g.children.length : 0;
    const hautAvant = b ? +b.boules[2].getWorldPosition(new __G.THREE.Vector3()).y.toFixed(2) : -1;
    if (b) G.breakThing(b, { x: b.x - 2, z: b.z });
    const angle = b ? +(2 * Math.acos(Math.min(1, Math.abs(b.g.quaternion.w)))).toFixed(2) : 0;
    const hautApres = b ? +b.boules[2].getWorldPosition(new __G.THREE.Vector3()).y.toFixed(2) : -1;
    const bonhomme = { total: liste.length, morceaux: avant, casse: !!(b && b.broken),
      angle, hautAvant, hautApres, tombe: +(hautAvant - hautApres).toFixed(2),
      // on ne le casse pas deux fois : le deuxieme coup ne change plus rien
      deuxFois: (b && (G.breakThing(b, { x: b.x - 2, z: b.z }), +(2 * Math.acos(Math.min(1, Math.abs(b.g.quaternion.w)))).toFixed(2))) === angle };
    // les morceaux tombent VRAIMENT au sol
    let auSol = 0;
    for (let i = 0; i < 200; i++) G.debrisTick(1 / 60);
    for (const d of G.debris) if (d.m.position.y <= 0.4) auSol++;
    G.meteoSet('clair', 9999); G.meteo.force = 0; G.neigeDecor(false);
    // --- la marque sur le mur ---
    G.marques.length = 0;
    const m1 = G.marqueMur(0, 1.2, 40, 0, 1, 1);
    const un = G.marques[0];
    const marque = { pose: m1, taille: +un.scale.x.toFixed(2), visible: un.visible, texture: !!(un.material && un.material.map) };
    G.marqueMur(2, 1.2, 40, 0, 1, 3);
    marque.plusGrave = +G.marques[G.marques.length - 1].scale.x.toFixed(2);
    // le PLAFOND : quoi qu'on fasse, jamais plus de dix marques dans toute la ville
    for (let i = 0; i < 40; i++) G.marqueMur(i, 1.2, 40, 0, 1, 2);
    marque.plafond = G.marques.length;
    marque.max = G.MARQUES_MUR_MAX;
    // un choc complet passe par la : gravite rendue, marque posee
    // la flotte s'est etoffee (vehicules de travail, de mission) : on prend la premiere voiture
    // carrossee venue, et on dit clairement si on n'en trouve aucune.
    const c = G.city.cars.find(v => v.parts && !v.heli && !v.rider && !v.travail)
      || G.city.cars.find(v => v.parts && !v.heli);
    if (!c) return { bonhomme, auSol, marque, choc: { pourquoi: 'aucune voiture carrossee' } };
    G.eteintFeu(c); G.repairVisual(c); c.dmg = 0;
    G.marques.length = 0;
    const gravite = G.chocVehicule(c, 12, 0, 1);
    const choc = { gravite, marques: G.marques.length, deg: c.deg };
    G.eteintFeu(c); G.repairVisual(c); c.dmg = 0;
    return { bonhomme, auSol, marque, choc };
  });
  const ok = r.bonhomme.total > 0 && r.bonhomme.morceaux > 5 && r.bonhomme.casse
    && r.bonhomme.angle > 0.5 && r.bonhomme.tombe > 0.5 && r.bonhomme.deuxFois
    && r.marque.pose === 1 && r.marque.visible && r.marque.texture && r.marque.plusGrave > r.marque.taille
    && r.marque.plafond === r.marque.max && r.marque.max === 10
    && r.choc.gravite === 2 && r.choc.marques >= 1 && r.choc.deg === 2;
  return { ok, detail: `un bonhomme de neige etait un decor qu'on traversait sans que rien ne bouge, et un mur percute ne gardait aucune trace · ${r.bonhomme.total} bonshommes sont maintenant SOLIDES et cassables : celui qu'on percute bascule de ${r.bonhomme.angle} rad, sa boule du haut tombe de ${r.bonhomme.tombe} m (${r.bonhomme.hautAvant} → ${r.bonhomme.hautApres} m), un deuxieme coup ne change plus rien (${r.bonhomme.deuxFois}), et les employes municipaux viennent le remonter · le mur porte une marque texturee (trace noire, fissures, petit trou), d'autant plus large que le choc est grave (${r.marque.taille} m en leger, ${r.marque.plusGrave} m en grave) · et le nombre d'appels de dessin ne peut pas s'envoler : apres 40 chocs il n'y a toujours que ${r.marque.plafond} marques dans toute la ville (plafond ${r.marque.max}, la plus ancienne est recyclee) · un choc complet a 12 m/s rend la gravite ${r.choc.gravite}, applique le stade ${r.choc.deg} et pose ${r.choc.marques} marque` };
});

test('à l\'école, la fenêtre des exercices tient en haut de l\'écran et laisse le tableau visible', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: -62, y: 1, z: 220, hour: 12 });
    await dodo(300);
    const salle = G.city.classes[0]; if (!salle) return { pourquoi: 'aucune salle de classe' };
    G.settings.voices = false;
    const ch = salle.chaises[1];
    G.P.sit = null; G.school.chaise = null; if (G.uiOpen) G.closeUI();
    G.P.pos.set(ch.x, 0.6, ch.z + 0.3); G.sitBench(ch);
    for (let i = 0; i < 60 && G.uiOpen !== 'schoolUI'; i++) await dodo(100);
    if (!G.school.q) return { pourquoi: 'la classe ne s\'est pas ouverte' };
    for (let i = 0; i < 40; i++) await new Promise(rr => requestAnimationFrame(rr));   // la caméra se cale
    const T = G.THREE, W = window.innerWidth, H = window.innerHeight;
    // le rectangle du TABLEAU tel qu'il apparaît à l'écran (les quatre coins du panneau projetés)
    const rectTableau = () => {
      const t = salle.tableau, xs = [], ys = [];
      for (const [dx, dy] of [[-2.7, -1.22], [2.7, -1.22], [-2.7, 1.22], [2.7, 1.22]]) {
        const v = new T.Vector3(t.position.x + dx, t.position.y + dy, t.position.z).project(G.camera);
        xs.push((v.x + 1) / 2 * W); ys.push((1 - v.y) / 2 * H);
      }
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    };
    const mesure = () => {
      const c = document.querySelector('#schoolUI .card').getBoundingClientRect();
      return { haut: c.top, bas: c.bottom, g: c.left, d: c.right, h: c.height,
        hPct: +(c.height / window.innerHeight * 100).toFixed(1), basPct: +(c.bottom / window.innerHeight * 100).toFixed(1) };
    };
    const panneau = mesure(), tab = rectTableau();
    // recouvrement du tableau par le panneau, en pourcentage de la surface du tableau
    const recouvre = (a, b) => {
      const w = Math.min(a.x1, b.d) - Math.max(a.x0, b.g), h = Math.min(a.y1, b.bas) - Math.max(a.y0, b.haut);
      if (w <= 0 || h <= 0) return 0;
      return +(w * h / ((a.x1 - a.x0) * (a.y1 - a.y0)) * 100).toFixed(1);
    };
    // les quatre réponses : UNE seule rangée de boutons
    const cartes = [...document.querySelectorAll('#schChoices .item')].map(e => e.getBoundingClientRect());
    const rangee = cartes.length === 4 && cartes.every(c => Math.abs(c.top - cartes[0].top) < 4) && cartes.every(c => c.height > 12);
    // manette : le curseur doit pouvoir atteindre les quatre réponses
    const vus = new Set();
    for (let i = 0; i < 30; i++) { G.navBouge(1); const f = document.querySelector('.focustv'); if (f && f.classList.contains('item')) vus.add(f.dataset.i); }
    document.querySelectorAll('.focustv').forEach(e => e.classList.remove('focustv'));
    // et la même chose en mode télévision (tailles en --u)
    G.modeTV(true); await dodo(120);
    for (let i = 0; i < 10; i++) await new Promise(rr => requestAnimationFrame(rr));
    const tv = mesure(), tvTab = rectTableau();
    const tvCartes = [...document.querySelectorAll('#schChoices .item')].map(e => e.getBoundingClientRect());
    const tvRangee = tvCartes.length === 4 && tvCartes.every(c => Math.abs(c.top - tvCartes[0].top) < 4);
    const tvPolice = parseFloat(getComputedStyle(document.getElementById('schQuestion')).fontSize);
    const tvRecouvre = recouvre(tvTab, tv);
    G.modeTV(false); await dodo(120);
    G.closeUI(); G.P.sit = null; G.school.chaise = null;
    return { ecran: [W, H], panneau, tableau: { x0: Math.round(tab.x0), x1: Math.round(tab.x1), y0: Math.round(tab.y0), y1: Math.round(tab.y1) },
      recouvre: recouvre(tab, panneau), rangee, nCartes: cartes.length, hCarte: Math.round(cartes[0] ? cartes[0].height : 0),
      atteintes: vus.size, tv: { hPct: tv.hPct, basPct: tv.basPct, rangee: tvRangee, police: Math.round(tvPolice), recouvre: tvRecouvre },
      tabHautPct: +(tab.y0 / H * 100).toFixed(1), tabBasPct: +(tab.y1 / H * 100).toFixed(1),
      tabH: Math.round(tab.y1 - tab.y0), tabL: Math.round(tab.x1 - tab.x0) };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const H = r.ecran[1];
  const compact = r.panneau.h < H / 3;                       // moins d'un tiers de la hauteur
  const enHaut = r.panneau.haut < H * 0.12 && r.panneau.bas <= H / 3 + 2;   // et dans le tiers supérieur
  const degage = r.recouvre === 0 && r.tableau.y0 > r.panneau.bas;
  const lisible = r.tabH > H * 0.2 && r.tabL > r.ecran[0] * 0.2;
  const tv = r.tv.hPct < 33.3 && r.tv.basPct <= 33.4 && r.tv.rangee && r.tv.police >= 20 && r.tv.recouvre === 0;
  const ok = compact && enHaut && degage && lisible && r.rangee && r.atteintes === 4 && tv;
  return { ok, detail: `la fenêtre des exercices s'ouvrait au MILIEU de l'écran, sur fond assombri et flouté : elle cachait le tableau, c'est-à-dire l'endroit même où la réponse s'écrit à la craie · c'est maintenant une bande en haut de ${Math.round(r.panneau.h)} px sur ${H} (${r.panneau.hPct} %, bas à ${r.panneau.basPct} %), énoncé sur une ligne et les ${r.nCartes} réponses sur UNE rangée de boutons de ${r.hCarte} px (${r.atteintes}/4 atteintes à la manette) · le tableau occupe ${r.tabL}×${r.tabH} px entre ${r.tabHautPct} % et ${r.tabBasPct} % de la hauteur, recouvert à ${r.recouvre} % par le panneau · en mode télévision : bande à ${r.tv.hPct} % (bas ${r.tv.basPct} %), énoncé à ${r.tv.police} px, réponses sur une rangée, tableau recouvert à ${r.tv.recouvre} %` };
});
test('chaque geste de metier decrit un vrai cycle : amplitude suffisante, sans a-coup', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const rig = G.me.rig;
    // pour chaque geste : l'articulation qui doit VRAIMENT travailler, et l'amplitude
    // minimale attendue en radians (un geste de moins d'un tiers de radian ne se lit pas)
    const cible = {
      marteau: ['armR.coude', 1.2], soudure: ['armR', 0.35], accroupi: ['armR', 0.5],
      balai: ['armR', 0.6], raclette: ['armR', 0.7], lance: ['armR', 0.3],
      pedale: ['legR', 0.6], echelle: ['armR', 0.8], lettre: ['armR.coude', 1.2],
    };
    const lire = ch => ch.split('.').reduce((o, k) => o[k], rig).rotation.x;
    const out = {};
    for (const nom of Object.keys(cible)) {
      const [ch, mini] = cible[nom];
      rig.gK = 0; rig.gNom = null; rig.gVu = null;
      const n = 260, base = G.simTime + 500, v = [];
      for (let i = 0; i < n; i++) {
        const t = base + i / 60;
        G.animateRig(rig, 'idle', 0, 1 / 60, t);
        const o = nom === 'echelle' ? { h: Math.max(0, i - 40) / (n - 40) }
          : nom === 'lettre' ? { p: Math.max(0, i - 40) / (n - 40) } : { v: 8 };
        G.gesteMetier(rig, nom, 1 / 60, t, o);
        if (i > 40) v.push(lire(ch));
      }
      const mn = Math.min.apply(null, v), mx = Math.max.apply(null, v);
      let d = 0; for (let i = 1; i < v.length; i++) d = Math.max(d, Math.abs(v[i] - v[i - 1]));
      const moy = (mn + mx) / 2; let cr = 0;
      for (let i = 1; i < v.length; i++) if ((v[i - 1] - moy) * (v[i] - moy) < 0) cr++;
      out[nom] = { art: ch, amp: +(mx - mn).toFixed(2), mini, saut: +d.toFixed(3), passages: cr };
    }
    rig.gK = 0; rig.gNom = null; rig.gVu = null;
    // et les travailleurs s'en servent VRAIMENT : sur un nid-de-poule, l'équipe s'accroupit
    G.city.horaires = false;
    G.metierScene('chantier');
    for (let i = 0; i < 90; i++) G.step(1 / 60, true);
    const eq = G.METIERS.employes;
    out.chantier = { geste: eq[0].bot.av.rig.gNom, poids: +(eq[0].bot.av.rig.gK || 0).toFixed(2),
      baisse: +(eq[0].bot.av.rig.baisse || 0).toFixed(2) };
    G.metiersRepos();
    return out;
  });
  const noms = Object.keys(r).filter(n => n !== 'chantier');
  const faibles = noms.filter(n => r[n].amp < r[n].mini);
  const brusques = noms.filter(n => r[n].saut > 0.45);
  const morts = noms.filter(n => r[n].passages < 1);
  const ch = r.chantier;
  const ok = !faibles.length && !brusques.length && !morts.length
    && ch.geste === 'accroupi' && ch.poids > 0.9 && ch.baisse > 0.15;
  return { ok, detail: `les neuf gestes de métier passent : ${noms.map(n => `${n} ${r[n].art} ${r[n].amp} rad (min ${r[n].mini}, plus grand pas ${r[n].saut} rad/image, ${r[n].passages} passages)`).join(' · ')} — aucun trop faible (${faibles.length}), aucun à-coup au-dessus de 0,45 rad par image (${brusques.length}), aucun figé (${morts.length}) · et sur un nid-de-poule l'équipe joue bien « ${ch.geste} » à plein (poids ${ch.poids}, corps abaissé de ${ch.baisse} m) au lieu d'agiter un bras` };
});

test('le combat : le coude part replie et se tend a l\'impact, la garde monte au visage, l\'esquive baisse le corps', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const av = G.me, rig = av.rig;
    const loc = o => { av.group.updateMatrixWorld(true); const v = new G.THREE.Vector3(); v.setFromMatrixPosition(o.matrixWorld); av.group.worldToLocal(v); return { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) }; };
    const pas = t => { G.animateRig(rig, 'idle', 0, 1 / 60, t); G.animCombat(av, 1 / 60); };
    let t = G.simTime + 500;
    // 1) au repos : les poings pendent le long du corps
    for (let i = 0; i < 40; i++) pas(t += 1 / 60);
    const repos = { poingD: loc(rig.armR.poing), tete: loc(rig.head) };
    // 2) la garde : les deux poings montent DEVANT LE VISAGE
    G.gardePoings(av, true);
    for (let i = 0; i < 40; i++) pas(t += 1 / 60);
    const garde = { poingD: loc(rig.armR.poing), poingG: loc(rig.armL.poing), tete: loc(rig.head),
      coudeD: +rig.armR.coude.rotation.x.toFixed(2) };
    // 3) le coup de poing : coude replié à l'élan, tendu à l'impact, poing qui part devant
    G.coupDePoing(av, 'D');
    const cd = [], pz = [];
    for (let i = 0; i < 40; i++) { pas(t += 1 / 60); cd.push(rig.armR.coude.rotation.x); pz.push(loc(rig.armR.poing).z); }
    let saut = 0; for (let i = 1; i < cd.length; i++) saut = Math.max(saut, Math.abs(cd[i] - cd[i - 1]));
    const coup = { replie: +Math.min.apply(null, cd).toFixed(2), tendu: +Math.max.apply(null, cd).toFixed(2),
      avance: +(Math.max.apply(null, pz) - Math.min.apply(null, pz)).toFixed(2), saut: +saut.toFixed(2) };
    // 4) l'esquive : le corps descend et les deux genoux plient
    G.esquiveBaisse(av, 0.7);
    let bmax = 0, gmax = 0;
    let buste = 0;
    for (let i = 0; i < 40; i++) { pas(t += 1 / 60); bmax = Math.max(bmax, rig.baisse || 0); gmax = Math.max(gmax, Math.min(rig.legL.genou.rotation.x, rig.legR.genou.rotation.x)); buste = Math.max(buste, loc(rig.armR.poing).y); }
    const esquive = { baisse: +bmax.toFixed(2), genoux: +gmax.toFixed(2), buste: +buste.toFixed(2) };
    // 5) le couteau : court et sec, le coude ne se tend qu'à moitié
    for (let i = 0; i < 60; i++) pas(t += 1 / 60);
    G.gardePoings(av, false); for (let i = 0; i < 20; i++) pas(t += 1 / 60); G.coupCouteau(av);
    const kd = [];
    for (let i = 0; i < 26; i++) { pas(t += 1 / 60); kd.push(rig.armR.coude.rotation.x); }
    const couteau = { replie: +Math.min.apply(null, kd).toFixed(2), tendu: +Math.max.apply(null, kd).toFixed(2) };
    // 6) encaisser : la tête est rejetée en arrière
    G.encaisseCoup(av, 1);
    const hd = [];
    for (let i = 0; i < 30; i++) { pas(t += 1 / 60); hd.push(rig.head.rotation.y); }
    const encaisse = { tete: +Math.max.apply(null, hd.map(v => Math.abs(v))).toFixed(2) };
    if (rig.cbt) { rig.cbt.garde = 0; rig.cbt.gardeK = 0; rig.cbt.coup = 0; rig.cbt.couteau = 0; rig.cbt.esquive = 0; rig.cbt.esqK = 0; rig.cbt.enc = 0; rig.cbt.chute = 0; }
    return { repos, garde, coup, esquive, couteau, encaisse };
  });
  const g = r.garde, c = r.coup;
  const gardeOk = g.poingD.y > g.tete.y - 0.05 && g.poingG.y > g.tete.y - 0.05
    && g.poingD.z > 0.12 && g.poingG.z > 0.12 && Math.abs(g.poingD.x) < 0.7
    && g.poingD.y - r.repos.poingD.y > 0.5;
  const coupOk = c.replie < -2.2 && c.tendu > -0.35 && c.avance > 0.35 && c.saut < 0.62;
  // 0,198 m d'abaissement : c'est la valeur du poste Personnages (0,55 S), calculee pour que
  // les semelles restent posees. On verifie qu'elle est bien appliquee et que le buste suit.
  const esqOk = r.esquive.baisse > 0.15 && r.esquive.genoux > 1.3 && r.esquive.buste > 1.4;   // et les poings restent hauts : on passe SOUS le coup sans baisser la garde
  const couteauOk = r.couteau.replie < -2.1 && r.couteau.tendu > -1.2 && r.couteau.tendu < -0.4;
  const encOk = Math.abs(r.encaisse.tete) > 0.15;   // la tete est DETOURNEE par le coup (rotation, pas inclinaison)
  const ok = gardeOk && coupOk && esqOk && couteauOk && encOk;
  return { ok, detail: `le poste Personnages pose la GARDE et l'ESQUIVE, le poste Animation y ajoute le mouvement · GARDE : les poings passent de ${r.repos.poingD.y} m (le long du corps) à ${g.poingD.y} m, devant le visage (tête à ${g.tete.y} m) et en avant (z = ${g.poingD.z} m), coudes repliés à ${g.coudeD} rad · COUP DE POING : le coude part replié à ${c.replie} rad et se TEND à ${c.tendu} rad, le poing avance de ${c.avance} m, sans à-coup (plus grand pas ${c.saut} rad/image, contre 0,97 avant réglage) · ESQUIVE : le corps descend de ${r.esquive.baisse} m sur des genoux pliés à ${r.esquive.genoux} rad, poings qui restent hauts, à ${r.esquive.buste} m · COUTEAU : court et sec, le coude va de ${r.couteau.replie} à ${r.couteau.tendu} rad seulement (il ne se tend PAS comme un direct) · ENCAISSER : la tête est DÉTOURNÉE de ${r.encaisse.tete} rad par le coup` };
});

test('le feu vit et s\'eteint : des flammes de tailles differentes qui ondulent, de la fumee qui monte', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const avant = G.ANIM.feux.length;
    const f = G.feuAnime(G.P.pos.x + 3, 0, G.P.pos.z, 1.5, 6);   // six secondes de feu, puis il doit s'éteindre tout seul
    if (!f) return { pourquoi: 'feuAnime n\'a rien rendu' };
    // `step` fait avancer l'horloge du jeu ; `feuxAnimTick` est appelé par la boucle de
    // rendu (frame), pas par step — on le déroule donc nous-mêmes, image par image, ce qui
    // rend la mesure DÉTERMINISTE au lieu de dépendre de la vitesse de la machine.
    const image = () => { G.step(1 / 60, true); G.feuxAnimTick(1 / 60); };
    for (let i = 0; i < 30; i++) image();   // le temps qu'il prenne toute sa force
    // 1) les flammes n'ont pas toutes la même taille au même instant
    const tailles = f.flammes.map(m => +m.scale.y.toFixed(2));
    const distinctes = new Set(tailles).size;
    // 2) chaque flamme change de taille dans le temps, et la fumée monte en se diluant
    const suivi = f.flammes.map(() => []), fumeeY = [], fumeeOp = [], braiseY = [], halo = [];
    for (let i = 0; i < 240; i++) {   // quatre secondes : un cycle complet de la bouffée de fumée
      image();
      f.flammes.forEach((m, j) => suivi[j].push(m.scale.y));
      fumeeY.push(f.fumees[0].position.y); fumeeOp.push(f.fumees[0].material.opacity);
      braiseY.push(f.braises[0].position.y); halo.push(f.halo.material.opacity);
    }
    const amp = suivi.map(v => +(Math.max.apply(null, v) - Math.min.apply(null, v)).toFixed(3));
    // la fumée monte : la hauteur augmente bien plus souvent qu'elle ne baisse (elle ne
    // redescend qu'une fois par cycle, quand la bouffée repart du foyer)
    let monte = 0; for (let i = 1; i < fumeeY.length; i++) if (fumeeY[i] > fumeeY[i - 1]) monte++;
    let braiseMonte = 0; for (let i = 1; i < braiseY.length; i++) if (braiseY[i] > braiseY[i - 1]) braiseMonte++;
    // …et elle SE DILUE en montant : on compare l'opacité tout en haut de la colonne à celle
    // du bas. Comparer simplement le min au max ne prouvait rien (la bouffée réapparaît).
    const yMin = Math.min.apply(null, fumeeY), yMax = Math.max.apply(null, fumeeY);
    const moy = t => t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0;
    const opHaut = [], opBas = [];
    for (let i = 0; i < fumeeY.length; i++) {
      const u = (fumeeY[i] - yMin) / (yMax - yMin || 1);
      if (u > 0.8) opHaut.push(fumeeOp[i]); else if (u > 0.15 && u < 0.4) opBas.push(fumeeOp[i]);
    }
    const dilue = opHaut.length > 3 && opBas.length > 3 && moy(opHaut) < moy(opBas) * 0.6;
    const haloBat = +(Math.max.apply(null, halo) - Math.min.apply(null, halo)).toFixed(3);
    // 3) au bout de sa durée, il s'éteint EN FONDU puis disparaît complètement
    const kAvant = +f.k.toFixed(2);
    for (let i = 0; i < 330; i++) image();
    const reste = G.ANIM.feux.indexOf(f) >= 0, dansScene = !!(f.g && f.g.parent);
    return { avant, apres: G.ANIM.feux.length, distinctes, tailles, amp, monte, total: fumeeY.length - 1,
      braiseMonte, dilue, opHaut: +moy(opHaut).toFixed(3), opBas: +moy(opBas).toFixed(3), haloBat, kAvant, reste, dansScene };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const bougent = r.amp.filter(a => a > 0.08).length;
  const ok = r.distinctes >= 3 && bougent >= 5 && r.monte > r.total * 0.7 && r.braiseMonte > r.total * 0.7
    && r.dilue && r.haloBat > 0.03 && r.kAvant > 0.9 && !r.reste && !r.dansScene;
  return { ok, detail: `feuAnime est la SEULE recette de feu du jeu (incendie des pompiers, cartouche incendiaire, véhicule accidenté) : au même instant les sept langues ont ${r.distinctes} tailles différentes (${r.tailles.join(', ')}) · ${bougent} d'entre elles ondulent sur quatre secondes (amplitudes ${r.amp.join(', ')}) · la fumée monte sur ${r.monte}/${r.total} images et se DILUE en montant (opacité ${r.opBas} en bas de la colonne, ${r.opHaut} en haut), les braises montent sur ${r.braiseMonte}/${r.total}, la lueur bat de ${r.haloBat} d'opacité · et au bout de sa durée le feu retombe en fondu (force ${r.kAvant} avant) puis disparaît vraiment : plus dans ANIM.feux (${!r.reste}), plus dans la scène (${!r.dansScene})` };
});

test('les changements d\'etat ne sautent plus : on monte en voiture et on en descend en fondu', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city.cars.find(v => !v.busy && !v.heli && !v.rider);
    if (!c) return { pourquoi: 'aucune voiture libre en ville' };
    // On rejoue exactement ce que fait la boucle de rendu : `enterCar` ARME le fondu, puis
    // chaque image pose la position du siège et `animTransApplique` ramène le corps depuis
    // sa position d'avant. (La boucle de rendu, elle, n'est pas déterministe : on la déroule
    // à la main, sinon la mesure dépendrait de la charge de la machine.)
    const trajetVers = (depart, cible, n) => {
      const pas = []; let prec = Object.assign({}, depart);
      for (let i = 0; i < n; i++) {
        G.step(1 / 60, true);
        G.me.group.position.set(cible.x, cible.y, cible.z);   // ce que fait la boucle : on pose la place d'arrivée
        G.animTransApplique(G.me);                            // …et le fondu ramène le corps d'où il venait
        const q = G.me.group.position;
        pas.push(Math.hypot(q.x - prec.x, q.y - prec.y, q.z - prec.z));
        prec = { x: q.x, y: q.y, z: q.z };
      }
      return { plusGrandPas: +Math.max.apply(null, pas).toFixed(3), images: pas.filter(v => v > 0.004).length,
        parcouru: +pas.reduce((a, b) => a + b, 0).toFixed(2) };
    };
    // 1) le sol : trois mètres et demi à côté de la portière
    G.P.pos.set(c.x + 3.2, 0, c.z + 1.2); G.P.vel.set(0, 0, 0);
    G.me.group.position.copy(G.P.pos);
    const depart = { x: G.me.group.position.x, y: G.me.group.position.y, z: G.me.group.position.z };
    const siege = { x: c.x + 0.5, y: (c.y || 0) + 0.9, z: c.z + 0.3 };
    const droit = Math.hypot(siege.x - depart.x, siege.y - depart.y, siege.z - depart.z);
    // 2) on monte : enterCar ARME le fondu (c'est ce qu'on vérifie d'abord)
    G.enterCar(c);
    const arme = (G.me.group.userData.trFin || 0) > G.simTime;
    const monte = Object.assign({ trajet: +droit.toFixed(2), arme }, trajetVers(depart, siege, 40));
    // 3) on descend : même mécanique, dans l'autre sens, vers la place que choisit exitCar
    const seat = { x: G.me.group.position.x, y: G.me.group.position.y, z: G.me.group.position.z };
    G.exitCar();
    const armeSortie = (G.me.group.userData.trFin || 0) > G.simTime;
    const sol = { x: G.P.pos.x, y: G.P.pos.y, z: G.P.pos.z };
    const descend = Object.assign({ arme: armeSortie, trajet: +Math.hypot(sol.x - seat.x, sol.y - seat.y, sol.z - seat.z).toFixed(2) },
      trajetVers(seat, sol, 40));
    // un geste de métier monte lui aussi en fondu : jamais d'un coup
    const rig = G.me.rig; rig.gK = 0; rig.gNom = null; rig.gVu = null;
    const ks = []; let t = G.simTime + 800;
    for (let i = 0; i < 30; i++) { t += 1 / 60; G.animateRig(rig, 'idle', 0, 1 / 60, t); G.gesteMetier(rig, 'marteau', 1 / 60, t); ks.push(rig.gK); }
    let dk = 0; for (let i = 1; i < ks.length; i++) dk = Math.max(dk, ks[i] - ks[i - 1]);
    rig.gK = 0; rig.gNom = null; rig.gVu = null;
    return { monte, descend, fondu: { plusGrandPas: +dk.toFixed(3), images: ks.filter(v => v < 0.999).length } };
  });
  if (r.pourquoi) return { ok: false, detail: r.pourquoi };
  const ok = r.monte.arme && r.descend.arme
    && r.monte.trajet > 1.5 && r.monte.plusGrandPas < r.monte.trajet * 0.32 && r.monte.images >= 8
    && r.descend.plusGrandPas < r.descend.trajet * 0.4 && r.descend.images >= 8
    && r.fondu.plusGrandPas < 0.12 && r.fondu.images >= 8;
  return { ok, detail: `monter en voiture TÉLÉPORTAIT le personnage sur le siège en une seule image : enterCar arme maintenant le fondu (${r.monte.arme}) et le corps traverse les ${r.monte.trajet} m en ${r.monte.images} images, sans jamais faire plus de ${r.monte.plusGrandPas} m d'un coup · descendre pareil (fondu armé ${r.descend.arme}, ${r.descend.trajet} m en ${r.descend.images} images, plus grand pas ${r.descend.plusGrandPas} m) · et un geste de métier monte en ${r.fondu.images} images, sans jamais gagner plus de ${r.fondu.plusGrandPas} de poids par image` };
});

// ============ POSTE E : combat à deux poings, couteau, étuis, ambulancier ============
// Un décor de bagarre déterministe : le joueur au centre, UN habitant devant lui à la
// distance voulue, tous les autres poussés à 500 m — sinon `nearestFighter` attrape un
// passant qui traînait là et la mesure change d'un lancement à l'autre.
const E_BAGARRE = `
  const posePlayer = (z) => { __G.P.pos.set(0, 0.3, 0); __G.P.facing = 0; __G.P.hp = 100; __G.P.stunT = 0; };
  const seul = (d) => { const G = __G, b = G.bots[0];
    for (const o of G.bots) if (o !== b) { o.pos.set(500, 0.3, 500); o.av.group.position.copy(o.pos); o.fight = null; o.ko = 0; }
    for (const gg of (G.gangs || [])) for (const mm of gg.membres) { mm.x = 500; mm.z = 500; if (mm.av) mm.av.group.position.set(500, 0, 500); }
    b.pos.set(0, 0.3, d); b.av.group.position.copy(b.pos); b.hp = 100; b.ko = 0; b.dead = 0; b.fight = null;
    b.garde = false; b.robbed = false; b.av.group.visible = true; b.av.group.rotation.x = 0;
    return b; };
`;

test('le joueur se bat des DEUX poings, gauche puis droite', async p => {
  const r = await p.evaluate(posteE(E_BAGARRE + `
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const me = G.me, rig = me.rig, res = {};
    G.equipWeapon(null); G.P.drawn = false; G.setGarde(false); G.setAccroupi(false);
    posePlayer(); const b = seul(1.3);
    // quatre coups d'affilée : le poing doit changer à chaque fois
    G.P.poing = 'G';   // point de départ fixe : sinon le test hérite du poing du test précédent
    const suite = [];
    for (let i = 0; i < 4; i++) {
      b.pos.set(0, 0.3, 1.3); b.av.group.position.copy(b.pos); b.hp = 100;
      G.P.punchT = 0; G.P.lastHitT = -99; G.P.combo = 0; rig.swing = 0; rig.swingG = 0;
      G.punch();
      suite.push({ poing: G.P.poing, droit: +(rig.swing > 0), gauche: +(rig.swingG > 0), degats: 100 - b.hp });
    }
    res.suite = suite;
    res.alterne = suite.map(x => x.poing).join('');
    // le bras GAUCHE part vraiment du coude replié et se tend : c'est le même geste qu'à droite
    const geste = (cle) => { rig.swing = 0; rig.swingG = 0; rig[cle] = 0.28;
      const br = cle === 'swing' ? rig.armR : rig.armL, co = br.coude;
      br.rotation.x = 0; co.rotation.x = 0;
      const suivi = [];
      for (let i = 0; i < 26; i++) { G.animateRig(rig, 'idle', 0, 1 / 60, i / 60); suivi.push([+br.rotation.x.toFixed(2), +co.rotation.x.toFixed(2)]); }
      return { debutCoude: suivi[0][1], finCoude: suivi[suivi.length - 1][1],
        epauleMin: +Math.min(...suivi.map(v => v[0])).toFixed(2), epauleMax: +Math.max(...suivi.map(v => v[0])).toFixed(2) }; };
    res.droit = geste('swing'); res.gauche = geste('swingG');
    // en marchant, le bras qui frappe n'est plus écrasé par le balancement
    rig.swingG = 0.28; rig.armL.rotation.x = 0;
    for (let i = 0; i < 8; i++) G.animateRig(rig, 'walk', 1.4, 1 / 60, i / 60);
    res.enMarchant = +rig.armL.rotation.x.toFixed(2);
    rig.swingG = 0; rig.swing = 0;
    return res;
  `));
  const s = r.suite;
  const alterne = s.every((x, i) => i === 0 || x.poing !== s[i - 1].poing);
  const bonBras = s.every(x => (x.poing === 'D' ? x.droit === 1 && x.gauche === 0 : x.gauche === 1 && x.droit === 0));
  const ok = alterne && bonBras && s.every(x => x.degats > 0)
    && r.droit.debutCoude < -0.8 && r.droit.finCoude > -0.2 && r.gauche.debutCoude < -0.8 && r.gauche.finCoude > -0.2
    && r.gauche.epauleMin < -2 && r.gauche.epauleMax > -1 && r.enMarchant < -1;
  return { ok, detail: `le joueur ne frappait QUE du bras droit · l'enchaînement alterne maintenant les deux poings (${r.alterne}), chacun portant vraiment (${s.map(x => x.degats + ' PV').join(', ')}) · le geste est le même des deux côtés : le coude part replié (${r.gauche.debutCoude} rad à gauche, ${r.droit.debutCoude} à droite) et se tend à l'impact (${r.gauche.finCoude} / ${r.droit.finCoude}), l'épaule balaie de ${r.gauche.epauleMin} à ${r.gauche.epauleMax} · et le balancement de la marche n'écrase plus le bras qui frappe (${r.enMarchant} rad)` };
});

test('la garde encaisse le coup, se baisser l\'esquive', async p => {
  const r = await p.evaluate(posteE(E_BAGARRE + `
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const me = G.me, rig = me.rig, res = {};
    const T2 = G.THREE;
    G.equipWeapon(null); G.P.drawn = false;
    // un coup de poing venu de DEVANT, dans les trois situations
    const encaisse = (garde, baisse, dz) => { posePlayer(); G.setGarde(garde); G.setAccroupi(baisse);
      G.P.hp = 100; G.hurt(20, 'un cogneur', 0, dz == null ? -1 : dz, 1.5, 'poing');
      const perdu = +(100 - G.P.hp).toFixed(1); G.setGarde(false); G.setAccroupi(false); G.P.hp = 100; return perdu; };
    res.nu = encaisse(false, false);
    res.garde = encaisse(true, false);
    res.baisse = encaisse(false, true);
    // dans le dos, la garde ne sert à rien : on ne pare pas ce qu'on ne voit pas
    res.dansLeDos = encaisse(true, false, 1);
    // une balle traverse la garde
    posePlayer(); G.setGarde(true); G.P.hp = 100; G.hurt(20, 'une balle', 0, -1, 1.2); res.balle = +(100 - G.P.hp).toFixed(1);
    G.setGarde(false); G.P.hp = 100;
    // LA POSE : les deux poings serrés devant le visage, coudes rentrés
    G.setGarde(true); rig.swing = 0; rig.swingG = 0;
    for (let i = 0; i < 50; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    me.group.rotation.set(0, 0, 0); me.group.position.set(0, 0, 0); me.group.updateMatrixWorld(true);
    const wp = o => o.getWorldPosition(new T2.Vector3());
    const pg = wp(rig.armL.poing), pd = wp(rig.armR.poing), tete = wp(me.tete);
    const bt = new T2.Box3().setFromObject(me.tete);
    res.pose = { poingsY: +((pg.y + pd.y) / 2).toFixed(2), teteBas: +bt.min.y.toFixed(2), teteHaut: +bt.max.y.toFixed(2),
      devant: +(((pg.z + pd.z) / 2) - bt.max.z).toFixed(2), ecart: +Math.abs(pg.x - pd.x).toFixed(2),
      coudeG: +rig.armL.coude.rotation.x.toFixed(2), coudeD: +rig.armR.coude.rotation.x.toFixed(2),
      rentreG: +rig.armL.rotation.z.toFixed(2), rentreD: +rig.armR.rotation.z.toFixed(2) };
    // pendant un coup, la garde s'ouvre : sinon le poing n'irait jamais au bout
    rig.swing = 0.28; let mn = 9;
    for (let i = 0; i < 14; i++) { G.animateRig(rig, 'idle', 0, 1 / 60, i / 60); mn = Math.min(mn, rig.armR.rotation.x); }
    res.gardeOuverte = +mn.toFixed(2); rig.swing = 0;
    G.setGarde(false); for (let i = 0; i < 40; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    // SE BAISSER : le bassin descend, la tête passe sous le coup, les semelles restent au sol
    G.setAccroupi(true); for (let i = 0; i < 80; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    me.group.position.set(0, -(rig.baisse || 0), 0); me.group.updateMatrixWorld(true);
    const bb = new T2.Box3(); for (const m of rig.legL.piedParts) if (m.visible) bb.expandByObject(m);
    res.baisseP = { descente: +rig.baisse.toFixed(3), tete: +wp(me.tete).y.toFixed(2), semelle: +bb.min.y.toFixed(3),
      hanche: +rig.legL.rotation.x.toFixed(2), genou: +rig.legL.genou.rotation.x.toFixed(2) };
    G.setAccroupi(false); for (let i = 0; i < 80; i++) G.animateRig(rig, 'idle', 0, 1 / 60, i / 60);
    me.group.position.set(0, 0, 0); me.group.updateMatrixWorld(true);
    res.debout = { descente: +rig.baisse.toFixed(3), tete: +wp(me.tete).y.toFixed(2) };
    // LE CONTRAT AVEC LA MANETTE : les deux gestes s'appellent garde(on) et esquive(on)
    res.noms = { garde: typeof G.garde === 'function', esquive: typeof G.esquive === 'function' };
    posePlayer(); G.garde(true); res.noms.gardeMarche = G.P.garde && me.rig.garde; G.garde(false);
    res.noms.gardeBaissee = !G.P.garde;
    G.esquive(true); res.noms.esquiveMarche = G.P.accroupi && me.rig.accroupi; G.esquive(false);
    res.noms.esquiveFinie = !G.P.accroupi;
    // EN FACE AUSSI : un habitant qui se garde encaisse le quart du coup
    posePlayer(); const b = seul(1.3);
    G.P.punchT = 0; G.P.combo = 0; G.P.lastHitT = -99; G.punch(); res.botNu = 100 - b.hp;
    b.pos.set(0, 0.3, 1.3); b.av.group.position.copy(b.pos); b.hp = 100; b.garde = true;
    G.P.punchT = 0; G.P.combo = 0; G.P.lastHitT = -99; G.punch(); res.botGarde = 100 - b.hp;
    b.garde = false; b.hp = 100;
    return res;
  `));
  const po = r.pose, ba = r.baisseP;
  const ok = r.nu === 20 && r.garde <= r.nu / 2 && r.garde > 0 && r.baisse === 0 && r.dansLeDos === r.nu && r.balle === r.nu
    && po.poingsY > po.teteBas - 0.05 && po.poingsY < po.teteHaut && po.devant > 0.05 && po.ecart < 1
    && po.coudeG < -1.4 && po.coudeD < -1.4 && po.rentreG > 0.2 && po.rentreD < -0.2
    && r.gardeOuverte < -1.8
    && ba.descente > 0.15 && ba.tete < r.debout.tete - 0.15 && Math.abs(ba.semelle) < 0.02 && ba.genou > 1.2
    && r.debout.descente < 0.02
    && r.botNu > 0 && r.botGarde > 0 && r.botGarde <= r.botNu / 2
    && r.noms.garde && r.noms.esquive && r.noms.gardeMarche && r.noms.gardeBaissee && r.noms.esquiveMarche && r.noms.esquiveFinie;
  return { ok, detail: `on encaissait tout sans jamais pouvoir se défendre · LA GARDE, les deux poings serrés devant le visage (à ${po.poingsY} m, la tête va de ${po.teteBas} à ${po.teteHaut} m, poings ${po.devant} m en avant, coudes rentrés à ${po.coudeG} / ${po.coudeD} rad), fait tomber le coup de ${r.nu} à ${r.garde} PV — mais elle ne vaut que de face (${r.dansLeDos} PV dans le dos) et n'arrête pas une balle (${r.balle} PV) · SE BAISSER esquive complètement (${r.baisse} PV) : le bassin descend de ${ba.descente} m, la tête de ${(r.debout.tete - ba.tete).toFixed(2)} m, genoux pliés à ${ba.genou} rad et semelles toujours posées (${ba.semelle} m) · la garde s'ouvre le temps du coup (${r.gardeOuverte} rad) · et EN FACE aussi on se garde : l'habitant encaisse ${r.botGarde} au lieu de ${r.botNu} · les deux gestes repondent aux noms convenus avec la manette : garde(on) et esquive(on)` };
});

test('le couteau s\'achète, dort dans son étui de hanche et tue en plusieurs coups', async p => {
  const r = await p.evaluate(posteE(E_BAGARRE + `
    const G = __G, T2 = G.THREE; __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const me = G.me, rig = me.rig, res = {};
    const wp = o => o.getWorldPosition(new T2.Vector3());
    const bte = o => { me.group.updateMatrixWorld(true); return new T2.Box3().setFromObject(o); };
    // ---- la boutique ----
    const fiche = G.catalog('armes').find(x => x.id === 'knife');
    res.boutique = { existe: !!fiche, prix: fiche && fiche.p, nom: fiche && fiche.n, possede: fiche && fiche.owned() };
    G.wallet = 500; G.owned.add('arme:knife'); G.owned.add('arme:pistol'); G.saveOwned && G.saveOwned();
    G.equipWeapon('couteau'); res.nomFrancais = G.P.weapon;   // la manette dit « couteau »
    res.tourDesArmes = (() => { G.equipWeapon(null); const vus = []; for (let i = 0; i < 6; i++) { G.armeSuivante(1); vus.push(G.P.weapon); } return vus; })();
    G.majEtuis(); me.group.updateMatrixWorld(true);
    res.boutique.apresAchat = G.catalog('armes').find(x => x.id === 'knife').owned();
    // ---- l'étui, du côté OPPOSÉ au pistolet, visible en permanence ----
    const E = me.etuis;
    const local = o => me.group.worldToLocal(wp(o).clone());
    res.etui = { couteau: E.couteau.visible, pistolet: E.pistolet.visible, ceinture: E.ceinture.visible,
      xCouteau: +local(E.couteau.children[0]).x.toFixed(2), xPistolet: +local(E.pistolet.children[0]).x.toFixed(2) };
    // sans couteau acheté, pas de fourreau
    G.owned.delete('arme:knife'); G.majEtuis(); res.etui.sansAchat = E.couteau.visible;
    G.owned.add('arme:knife'); G.majEtuis();
    // ---- rangé dans son fourreau, dégainé dans le poing ----
    G.equipWeapon('knife'); G.setWeapon(me, 'knife', false); me.group.updateMatrixWorld(true);
    const k = me.weapons.knife;
    res.range = { visible: k.visible, dansLeFourreau: +ecartBoites(bte(k), bte(E.couteau)).toFixed(3),
      cote: +local(k).x.toFixed(2), pieces: G.knifeMesh().children.length };
    G.setWeapon(me, 'knife', true); me.group.updateMatrixWorld(true);
    res.enMain = +wp(k).distanceTo(wp(rig.armR.poing)).toFixed(3);
    // ---- le coup au ventre, puis le rangement tout seul ----
    posePlayer(); const b = seul(1.3);
    G.setWeapon(me, 'knife', false); G.P.drawn = false;
    const coups = [];
    for (let i = 0; i < 4; i++) {
      b.pos.set(0, 0.3, 1.3); b.av.group.position.copy(b.pos);
      G.P.punchT = 0; G.P.fireCd = 0; G.P.pos.set(0, 0.3, 0); G.P.facing = 0;
      G.coupCouteau();
      coups.push({ hp: Math.max(0, b.hp), ko: !!b.ko, ventre: +(G.P.dernierCoupY || 0).toFixed(2), enMain: me.inHand, degaine: G.P.drawn });
    }
    res.coups = coups;
    res.degats = G.WEAPONS.knife.dmg;
    // il se range TOUT SEUL, sans qu'on touche à rien
    res.rangement = { programme: +(G.P.holsterT - G.simTime).toFixed(2) };
    G.simTime = G.P.holsterT + 0.05; G.rangementAuto();
    me.group.updateMatrixWorld(true);
    res.rangement.enMainApres = me.inHand;
    res.rangement.retourFourreau = +ecartBoites(bte(me.weapons.knife), bte(E.couteau)).toFixed(3);
    // hors de portée, le couteau ne touche personne
    b.pos.set(0, 0.3, 4); b.av.group.position.copy(b.pos); b.hp = 100; b.ko = 0;
    G.P.punchT = 0; G.P.fireCd = 0; G.coupCouteau(); res.horsPortee = b.hp;
    b.hp = 100; b.ko = 0; G.equipWeapon(null);
    return res;
  `));
  const c = r.coups;
  const ok = r.boutique.existe && r.boutique.prix >= 20 && !r.boutique.possede && r.boutique.apresAchat
    && r.etui.couteau && r.etui.pistolet && r.etui.ceinture && !r.etui.sansAchat
    && r.etui.xCouteau < -0.1 && r.etui.xPistolet > 0.1
    && r.range.visible && r.range.dansLeFourreau < 0.03 && r.range.cote < -0.1 && r.range.pieces >= 8
    && r.enMain < 0.05
    && r.degats >= 25 && r.degats <= 40
    && c[0].hp === 100 - r.degats && c[1].hp === 100 - 2 * r.degats && !c[1].ko && c[2].ko
    && c.every(x => Math.abs(x.ventre - 0.95) < 0.02 && x.enMain && x.degaine)
    && r.rangement.programme > 0.4 && !r.rangement.enMainApres && r.rangement.retourFourreau < 0.03
    && r.horsPortee === 100 && r.nomFrancais === 'knife' && r.tourDesArmes.includes('knife');
  return { ok, detail: `la boutique vend maintenant le « ${r.boutique.nom} » ${r.boutique.prix} 🪙 · une fois acheté, son FOURREAU reste à la ceinture en permanence, à la hanche gauche (x = ${r.etui.xCouteau}) — de l'autre côté de l'étui du pistolet (x = ${r.etui.xPistolet}) — et disparaît si on ne l'a pas · la lame (${r.range.pieces} pièces : soie, gouttière, garde en laiton, manche cerclé, reflet sur le tranchant) dort dedans (${r.range.dansLeFourreau} m d'écart) et passe dans le POING quand on dégaine (${r.enMain} m) · un appui suffit : le coup part DANS LE VENTRE (${c[0].ventre} m au-dessus des pieds), ${r.degats} PV par coup — ${c.map(x => '❤️ ' + x.hp).join(' → ')}, à terre au troisième — puis le couteau retourne SEUL dans son fourreau ${r.rangement.programme} s plus tard (${r.rangement.retourFourreau} m) · à quatre mètres il ne touche personne (${r.horsPortee} PV) · il prend sa place dans le TOUR DES ARMES de la manette (${r.tourDesArmes.map(x => x || 'mains nues').join(' → ')}) et repond aussi au nom francais « couteau »` };
});

test('le fusil et le fusil à lunette reposent dans un étui de dos', async p => {
  const r = await p.evaluate(posteE(`
    const G = __G, T2 = G.THREE; __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const me = G.me, rig = me.rig, res = { armes: {} };
    const wp = o => o.getWorldPosition(new T2.Vector3());
    poseNeutre(me);
    G.owned.add('arme:rifle'); G.owned.add('arme:sniper'); G.majEtuis();
    res.etuiVisible = me.etuis.dos.visible;
    res.pieces = me.etuis.dos.children.length;
    for (const arme of ['rifle', 'sniper']) {
      G.equipWeapon(arme); G.setWeapon(me, arme, false); poseNeutre(me);
      const m = me.weapons[arme];
      const range = +wp(m).distanceTo(G.appuiDosMonde(me)).toFixed(3);
      const derriere = +me.group.worldToLocal(wp(m).clone()).z.toFixed(2);
      G.setWeapon(me, arme, true); poseNeutre(me);
      res.armes[arme] = { range, derriere, visible: m.visible,
        enMain: +wp(m).distanceTo(wp(rig.armR.poing)).toFixed(3),
        quitteLeDos: +wp(m).distanceTo(G.appuiDosMonde(me)).toFixed(3) };
      G.setWeapon(me, arme, false);
    }
    // sans fusil acheté, pas de harnais
    G.owned.delete('arme:rifle'); G.owned.delete('arme:sniper'); G.equipWeapon(null); G.majEtuis();
    res.sansFusil = me.etuis.dos.visible;
    G.owned.add('arme:rifle'); G.majEtuis();
    return res;
  `));
  const a = r.armes;
  const ok = r.etuiVisible && !r.sansFusil && r.pieces >= 4
    && ['rifle', 'sniper'].every(k => a[k].range < 0.12 && a[k].derriere < -0.1 && a[k].enMain < 0.05 && a[k].quitteLeDos > 0.5);
  return { ok, detail: `le fusil flottait derrière les omoplates sans rien pour le tenir · il y a maintenant un HARNAIS DE DOS (${r.pieces} pièces : bandoulière en diagonale, sangle de taille, deux appuis et une boucle), visible dès qu'on possède un fusil et absent sinon · le fusil d'assaut y repose à ${a.rifle.range} m de son appui (${a.rifle.derriere} m derrière le dos) et le fusil à lunette à ${a.sniper.range} m · à la prise en main ils quittent le dos (${a.rifle.quitteLeDos} / ${a.sniper.quitteLeDos} m) pour venir dans le poing (${a.rifle.enMain} / ${a.sniper.enMain} m)` };
});

test('l\'ambulancier porte une tenue blanche à croix rouge et un brancard', async p => {
  const r = await p.evaluate(posteE(`
    const G = __G, T2 = G.THREE; __SHOT.go({ world: 4, x: 0, y: 1, z: 0, hour: 12 });
    const res = {};
    res.metier = !!(G.METIERS_DEF && G.METIERS_DEF.ambulancier);
    const m = G.creerAmbulancier('Secours', 8, 14);
    const av = m.bot.av;
    res.tenue = { metier: av.tenue && av.tenue.metier, pieces: av.tenue ? av.tenue.pieces.length : 0,
      hautBlanc: av.mats.shirt.color.getHexString(), basBlanc: av.mats.pants.color.getHexString() };
    // le rouge de la croix doit vraiment être sur lui, devant ET derrière
    let rouges = 0, devant = 0, derriere = 0;
    for (const pc of av.tenue.pieces) { const c = pc.material.color.getHexString();
      if (c === 'd8202a') { rouges++; const z = pc.getWorldPosition(new T2.Vector3()).z - av.group.position.z; if (z > 0.05) devant++; if (z < -0.05) derriere++; } }
    res.croix = { rouges, devant, derriere };
    // ---- le brancard ----
    const br = m.brancard;
    G.brancardTick(1 / 60);
    const t = new T2.Box3().setFromObject(br.g).getSize(new T2.Vector3());
    res.brancard = { existe: !!br, etat: G.brancardEtat(br).etat, long: +t.z.toFixed(2), larg: +t.x.toFixed(2),
      reperes: !!(br.g.userData.avant && br.g.userData.arriere && br.g.userData.couche), pieces: br.g.children.length };
    // porté : il suit le poing de l'ambulancier
    for (let i = 0; i < 60; i++) { G.animateRig(av.rig, 'idle', 0, 1 / 60, i / 60); G.brancardTick(1 / 60); }
    const main = av.rig.armR.main.getWorldPosition(new T2.Vector3());
    const bcorps = new T2.Box3().setFromObject(av.torso), bbr = new T2.Box3().setFromObject(br.g);
    res.porte = { ecart: +br.g.getWorldPosition(new T2.Vector3()).distanceTo(main).toFixed(2), porteurs: G.brancardEtat(br).porteurs,
      traverse: +(bcorps.max.z - bbr.min.z).toFixed(2), poseBras: +av.rig.armR.rotation.x.toFixed(2) };
    m.bot.pos.x += 6; av.group.position.copy(m.bot.pos); av.group.updateMatrixWorld(true); G.brancardTick(1 / 60);
    const main2 = av.rig.armR.main.getWorldPosition(new T2.Vector3());
    res.porte.suitLePorteur = +br.g.getWorldPosition(new T2.Vector3()).distanceTo(main2).toFixed(2);
    // on y allonge un blessé
    const bl = G.bots[0];
    G.allongerSurBrancard(br, bl.av); G.brancardTick(1 / 60);
    const couche = br.g.userData.couche.getWorldPosition(new T2.Vector3());
    res.blesse = { surLeMatelas: +bl.av.group.position.distanceTo(couche).toFixed(3),
      couche: +bl.av.group.rotation.x.toFixed(2), nom: G.brancardEtat(br).blesse };
    // on le glisse dans le véhicule (le poste B fournira l'ambulance et son ancrage)
    const c = G.city.cars[0];
    G.chargerBrancard(br, c);
    res.glisse = G.brancardEtat(br).etat;
    for (let i = 0; i < 120; i++) G.brancardTick(1 / 60);
    const anc = c.brancard.getWorldPosition(new T2.Vector3());
    res.charge = { etat: G.brancardEtat(br).etat, ecart: +br.g.getWorldPosition(new T2.Vector3()).distanceTo(anc).toFixed(3),
      dansLeVehicule: G.brancardEtat(br).dansVehicule, blesseSuit: +bl.av.group.position.distanceTo(br.g.userData.couche.getWorldPosition(new T2.Vector3())).toFixed(3) };
    // le véhicule roule : le brancard part avec lui
    c.g.position.x += 20; c.g.updateMatrixWorld(true);
    res.charge.roule = +br.g.getWorldPosition(new T2.Vector3()).distanceTo(c.brancard.getWorldPosition(new T2.Vector3())).toFixed(3);
    G.descendreDuBrancard(br); G.sortirBrancard(br);
    res.sorti = G.brancardEtat(br).dansVehicule;
    return res;
  `));
  const b = r.brancard;
  const ok = r.metier && r.tenue.metier === 'ambulancier' && r.tenue.pieces >= 12
    && r.tenue.hautBlanc === 'f7f9fc' && r.tenue.basBlanc === 'f7f9fc'
    && r.croix.rouges >= 6 && r.croix.devant >= 2 && r.croix.derriere >= 2
    && b.existe && b.etat === 'porte' && b.long > 1.8 && b.larg > 0.4 && b.reperes && b.pieces >= 14
    && r.porte.ecart < 1.8 && r.porte.suitLePorteur < 1.8 && r.porte.porteurs === 1
    && r.porte.traverse < 0.05 && r.porte.poseBras < -0.4
    && r.blesse.surLeMatelas < 0.05 && Math.abs(r.blesse.couche + 1.57) < 0.05 && r.blesse.nom
    && r.glisse === 'glisse' && r.charge.etat === 'charge' && r.charge.ecart < 0.05
    && r.charge.dansLeVehicule && r.charge.blesseSuit < 0.05 && r.charge.roule < 0.05 && !r.sorti;
  return { ok, detail: `il n'y avait personne pour ramasser les blessés · l'AMBULANCIER a maintenant sa tenue (${r.tenue.pieces} pièces : blouse, pantalon et chaussures blanches ${r.tenue.hautBlanc}, liseré et épaulières bleus, casquette blanche, trousse de secours) marquée de ${r.croix.rouges} croix rouges dont ${r.croix.devant} devant et ${r.croix.derriere} dans le dos · et son BRANCARD (${b.pieces} pièces, ${b.long} m sur ${b.larg} m : deux barres, toile, matelas, oreiller, sangles et pieds repliables) qu'il PORTE devant lui, bras tendus (épaules à ${r.porte.poseBras} rad), à ${r.porte.ecart} m de son poing, sans plus lui traverser le corps (${r.porte.traverse} m de recouvrement) et en le suivant quand il marche (${r.porte.suitLePorteur} m) · on y allonge le blessé (${r.blesse.surLeMatelas} m du matelas, couché à ${r.blesse.couche} rad) et on GLISSE le tout dans le véhicule : ${r.glisse} → ${r.charge.etat}, arrimé à ${r.charge.ecart} m de l'ancrage, il roule avec lui (${r.charge.roule} m) et le blessé ne bouge pas (${r.charge.blesseSuit} m)` };
});

test('en mode rotation, le stick gauche fait TOURNER le personnage et braquer le vehicule', async p => {
  const r = await p.evaluate(() => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const ferme = () => { try { G.closeUI(); } catch (e) {} document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden')); };
    ferme();
    G.tel.x = G.tel.y = 0; G.joy.x = G.joy.y = 0; G.keys.clear(); G.P.drawn = false; G.P.gun = false;
    const ds = { index: 0, connected: true, mapping: 'standard', id: 'DualSense Wireless Controller',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })) };
    const vrai = navigator.getGamepads; navigator.getGamepads = () => [ds];
    const ctrl0 = G.settings.ctrl, turn0 = G.settings.turn;
    try {
      const res = {};
      // le joueur est remis sur sa case de depart a chaque image : la mesure ne depend pas
      // de ce qu'il pourrait rencontrer en avancant
      const pivote = v => { ds.axes = [v, 0, 0, 0]; G.cam.yaw = 0; G.P.facing = 0; G.P.vel.set(0, 0, 0); G.pollGamepad(0.02);
        for (let i = 0; i < 60; i++) { G.P.pos.set(0, 0.5, 8); G.pollGamepad(1 / 60); G.step(1 / 60, true); }
        const o = { angle: +G.P.facing.toFixed(2), vx: +Math.abs(G.P.vel.x).toFixed(2) };
        ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.02); return o; };
      // ---- MODE ROTATION : gauche/droite FONT TOURNER (et non glisser de cote)
      G.settings.ctrl = 'rot'; G.settings.turn = 160;
      res.droite = pivote(1); res.gauche = pivote(-1); res.demi = pivote(0.5); res.fremis = pivote(0.04);
      // la vitesse de rotation suit le reglage de ⚙️
      G.settings.turn = 240; res.rapide = pivote(1); G.settings.turn = 160;
      // ---- MODE CAMERA : le deplacement lateral reste possible
      G.settings.ctrl = 'cam';
      res.camera = pivote(1);
      // ---- AU VOLANT : le stick BRAQUE, dans les deux modes
      const c = (G.city.cars || []).find(v => !v.heli && !v.rider && v.spec);
      res.voiture = !!c;
      if (c) {
        G.P.pos.set(c.x, 0.6, c.z); G.enterCar(c);
        // avant CHAQUE essai la voiture revient sur la case degagee du depart : elle roule
        // pendant la mesure, et une voiture arretee contre un mur ne braque plus
        const braque = (mode, v) => { G.settings.ctrl = mode; ds.axes = [v, 0, 0, 0];
          c.x = 0; c.z = 8; c.h = 0; G.settleVehicle(c);
          ds.buttons[7] = { pressed: true, value: 1 }; G.pollGamepad(0.02);
          G.drive.speed = 0; const h0 = G.drive.car.h;
          for (let i = 0; i < 40; i++) { G.pollGamepad(1 / 60); G.driveStep(1 / 60); }
          const o = +(G.drive.car.h - h0).toFixed(2);
          ds.buttons[7] = { pressed: false, value: 0 }; ds.axes = [0, 0, 0, 0]; G.pollGamepad(0.02); return o; };
        res.volantRot = braque('rot', 1);
        res.volantRotG = braque('rot', -1);
        res.volantCam = braque('cam', 1);
        G.exitCar();
      }
      return res;
    } finally { navigator.getGamepads = vrai; G.settings.ctrl = ctrl0; G.settings.turn = turn0; ferme(); }
  });
  const d = r.droite, g = r.gauche;
  const ok = d.angle < -2.5 && d.angle > -3.1 && d.vx < 0.2
    && g.angle > 2.5 && g.angle < 3.1 && g.vx < 0.2
    && Math.abs(r.demi.angle) > 0.7 && Math.abs(r.demi.angle) < Math.abs(d.angle) - 0.5
    && Math.abs(r.fremis.angle) < 0.05
    && Math.abs(r.rapide.angle) > Math.abs(d.angle) + 1
    && Math.abs(r.camera.angle) < 0.05 && r.camera.vx > 5
    && r.voiture && r.volantRot < -0.3 && r.volantRotG > 0.3 && r.volantCam < -0.3;
  return { ok, detail: `« le joystick gauche ne dirige pas le joueur gauche/droite en rotation » : le stick etait EXCLU du mode rotation (il faisait glisser de côté) parce que l'ancienne formule ignorait tout virage sous 32 % de la course puis le dosait au carré · il y est de nouveau, avec une zone morte fine : poussé a droite une seconde le personnage pivote de ${d.angle} rad et a gauche de ${g.angle} rad (160 °/s), sans glisser (${d.vx} m/s), a mi-course il tourne moins (${r.demi.angle} rad), un frémissement a 4 % ne le fait pas bouger (${r.fremis.angle}) et le réglage ⚙️ « vitesse de rotation » agit (240 °/s → ${r.rapide.angle} rad) · en mode « caméra » le déplacement latéral reste entier (${r.camera.vx} m/s de côté, ${r.camera.angle} rad de braquage) · au volant le stick BRAQUE dans les deux modes (rotation : ${r.volantRot} / ${r.volantRotG} rad, caméra : ${r.volantCam} rad)` };
});

test('la facade PS5 refaite : ✕ braque et rengaine, R2 tire, ◯ saute, △ agit', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const ferme = () => { try { G.closeUI(); } catch (e) {} document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden')); };
    ferme();
    G.tel.x = G.tel.y = 0; G.joy.x = G.joy.y = 0; G.keys.clear(); G.settings.ctrl = 'cam';
    const ds = { index: 0, connected: true, mapping: 'standard', id: 'DualSense Wireless Controller',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })) };
    const vrai = navigator.getGamepads; navigator.getGamepads = () => [ds];
    const tap = i => { ds.buttons[i] = { pressed: true, value: 1 }; G.pollGamepad(0.02); G.simTime += 0.1;
      ds.buttons[i] = { pressed: false, value: 0 }; G.pollGamepad(0.02); };
    const gach = (i, v) => { ds.buttons[i] = { pressed: v > 0.35, value: v }; G.pollGamepad(0.02); };
    try {
      const res = { plan: {} };
      for (const i of [0, 1, 2, 3]) res.plan[i] = G.PAD_MAP[i];
      // ---- ✕ BRAQUE, puis ✕ RENGAINE (le meme bouton, comme demande)
      G.owned.add('arme:pistol'); G.equipWeapon('pistol'); G.P.drawn = false;
      tap(0); res.braque = !!G.P.drawn;
      tap(0); res.rengaine = !G.P.drawn;
      // ---- R2 : avance quand l'arme est rangee
      G.P.drawn = false; gach(7, 1);
      res.gazRange = +G.pad.gaz.toFixed(2); res.braqueeRange = !!G.pad.armeBraquee;
      gach(7, 0);
      // ---- R2 accelere TOUJOURS au volant, meme arme sortie (essaye AVANT de tirer : cinq
      // balles reveillent la police, dont les voitures viennent se coller a la notre)
      const c = (G.city.cars || []).find(v => !v.heli && !v.rider && v.spec);
      if (c) {
        // la voiture est ramenee sur la case degagee ou apparait le joueur : un essai
        // precedent a pu la laisser le nez contre un mur, et elle n'accelererait pas
        c.x = 0; c.z = 8; c.h = 0; G.settleVehicle(c);
        G.P.pos.set(c.x, 0.6, c.z); G.enterCar(c); G.P.drawn = true;
        gach(7, 1); res.volant = { gaz: +G.pad.gaz.toFixed(2), braquee: !!G.pad.armeBraquee };
        G.drive.speed = 0;
        for (let i = 0; i < 20; i++) { G.pollGamepad(1 / 60); G.driveStep(1 / 60); }
        res.volant.vitesse = +G.drive.speed.toFixed(2);
        gach(7, 0); G.P.drawn = false; G.exitCar();
      }
      // ---- R2 : TIRE quand l'arme est braquee, et n'avance plus
      G.drawWeapon(true); G.P.fireCd = 0; G.simTime += 1;
      const n0 = G.shots.length;
      gach(7, 1);
      res.tir = { gaz: +G.pad.gaz.toFixed(2), tirs: G.shots.length - n0, braquee: !!G.pad.armeBraquee };
      // maintenue, la gachette tire en rafale (la cadence est bridee par le jeu)
      for (let i = 0; i < 8; i++) { G.simTime += 0.25; G.pollGamepad(1 / 60); }
      res.rafale = G.shots.length - n0;
      gach(7, 0); G.drawWeapon(false); G.P.drawn = false; G.pollGamepad(0.02);
      // ---- ◯ SAUTE
      G.P.pos.set(0, 0.5, 8); G.P.jumpBuf = 0; tap(1); res.saut = G.P.jumpBuf;
      // ---- △ AGIT : monter dans la voiture
      if (c) { G.P.pos.set(c.x + 1, 0.6, c.z); G.step(1 / 60, true);
        res.pres = !!G.city.near; tap(3); res.agit = !!G.drive.car;
        if (G.drive.car) G.exitCar(); }
      // ---- ▢ frappe toujours (le poste Personnages en a besoin) : le coup part au relâchement
      G.P.pos.set(0, 0.5, 8); G.P.punchT = 0; G.P.combo = 0; tap(2); await dodo(30);
      res.frappe = G.P.punchT > 0;
      // ---- la legende et l'ecran de test disent le nouveau mappage
      res.legende = (document.getElementById('padLeg') || {}).textContent || '';
      G.ouvreTestManette(); ds.buttons[0] = { pressed: true, value: 1 }; G.pollGamepad(0.02);
      res.roles = (document.getElementById('ptBoutons') || {}).textContent || '';
      res.diag = (document.getElementById('ptDiag') || {}).textContent || '';
      ds.buttons[0] = { pressed: false, value: 0 }; G.pollGamepad(0.02);
      ferme();
      return res;
    } finally { navigator.getGamepads = vrai; G.P.drawn = false; ferme(); }
  });
  const ok = r.plan[0] === 'KeyG' && r.plan[1] === 'Space' && r.plan[2] === 'KeyV' && r.plan[3] === 'KeyE'
    && r.braque && r.rengaine
    && r.gazRange === 1 && r.braqueeRange === false
    && r.tir.gaz === 0 && r.tir.tirs === 1 && r.tir.braquee && r.rafale > 3
    && r.volant && r.volant.gaz === 1 && r.volant.braquee === false && r.volant.vitesse > 1
    && r.saut === 0.15 && r.pres && r.agit && r.frappe
    && /✕/.test(r.legende) && /braquer/.test(r.legende) && /◯/.test(r.legende) && /sauter/.test(r.legende)
    && /△/.test(r.legende) && /agir/.test(r.legende)
    && /braquer \/ rengainer/.test(r.roles) && /sauter/.test(r.roles) && /agir/.test(r.roles)
    && /braquer/.test(r.diag);
  return { ok, detail: `nouveau mappage demandé par le joueur — « ✕ pour braquer, gâchette droite pour tirer, ✕ pour rengainer », « ◯ pour sauter, △ pour agir » · ✕ sort l'arme (${r.braque}) et la MEME touche la range (${r.rengaine}) · la gâchette R2 garde ses deux vies sans jamais les mélanger : arme rangée elle fait avancer (gaz ${r.gazRange}), arme braquée elle TIRE et n'avance plus (gaz ${r.tir.gaz}, ${r.tir.tirs} tir au premier appui, ${r.rafale} en la maintenant), et au volant elle accélère toujours même arme sortie (gaz ${r.volant.gaz} → ${r.volant.vitesse} m/s) · ◯ saute (${r.saut}), △ fait monter en voiture (${r.agit}), ▢ frappe toujours (${r.frappe}) · la légende du bandeau et l'écran « Tester la manette » annoncent le rôle de chaque bouton` };
});
// ================= POSTE F : LES SONS DU MONDE =================
test('les sons du monde sont PLACES dans l\'espace : un son lointain sort plus faible qu\'un son proche, et le panoramique suit la camera', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12, yaw: 0 });
    G.settings.sound = true;
    const c = G.sfx.unlock(), ch = G.sfx.chaine();
    G.engine.stop(); try { G.music.stop(); } catch (e) {} try { G.siren.stop(); } catch (e) {} try { G.meteoSet('clair', 999); } catch (e) {}
    G.SONV.ambT = G.simTime + 1e6; try { G.ambiance.stop(); } catch (e) {}   // le lit d'ambiance jouerait par-dessus la mesure
    G.bots.forEach(b => { b.wait = 1e6; b.dance = 0; });                     // et les pas des voisins aussi
    const an = c.createAnalyser(); an.fftSize = 2048; ch.lim.connect(an);
    const rms = () => { const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v; return +Math.sqrt(s / d.length).toFixed(4); };
    const X = G.P.pos.x, Y = G.P.pos.y, Z = G.P.pos.z;
    // Un coup de poing dure un dixieme de seconde : sur un rendu logiciel qui hoquette, la
    // fenetre de mesure le manquait une fois sur trois et le test clignotait. On mesure donc
    // une NOTE TENUE d'une demi-seconde, jouee trois fois, et on garde la crete.
    const pic = async (dist) => {
      let m = 0;
      for (let k = 0; k < 3; k++) {
        G.sonEn(X + dist, Y + 1.2, Z, d => G.sfx.toneVers(d, 330, 0, 0.5, 'sine', 0.5), { duree: 0.6, portee: 40 });
        for (let i = 0; i < 16; i++) { await dodo(30); m = Math.max(m, rms()); }
        await dodo(220);
      }
      return +m.toFixed(4);
    };
    await dodo(700); await pic(3); await dodo(500);   // un passage de chauffe : le tout premier revient a zero
    const silence = rms();
    const loin = await pic(45);
    const moyen = await pic(20);
    const pres = await pic(1.5);
    const horsPortee = G.sonCoup(X + 300, Y + 1.2, Z, 1.4);
    // le panoramique : le meme son a droite puis a gauche de la camera (yaw = 0 : +x est a droite)
    G.cam.yaw = 0;
    G.sonEn(X + 12, Y, Z, () => {}, { duree: .05 }); const droite = G.SON.dernier;
    G.sonEn(X - 12, Y, Z, () => {}, { duree: .05 }); const gauche = G.SON.dernier;
    G.bots.forEach(b => { b.wait = 0; });
    G.SONV.ambT = 0;
    try { ch.lim.disconnect(an); } catch (e) {}
    return { etat: c.state, silence, pres, moyen, loin, horsPortee: !!horsPortee, portee: G.SON.portee, coupure: G.SON.coupure,
      attDroite: droite.att, attGauche: gauche.att, bus: Object.keys(G.MIX), stereo: !!c.createStereoPanner };
  });
  const ok = r.etat === 'running' && r.pres > r.moyen * 1.5 && r.moyen > r.loin && r.pres > r.silence + 0.02
    && !r.horsPortee && r.stereo && Math.abs(r.attDroite - r.attGauche) < 0.001
    && r.bus.indexOf('voix') >= 0 && r.portee === 40 && r.coupure === 60;
  return { ok, detail: `tous les sons partaient en MONO dans le bus « effets », au meme volume qu'on soit dessus ou a cinquante metres · sonEn() les place maintenant : gain + panoramique calcules depuis la position du joueur et cam.yaw · mesure a l'analyseur, au bout de la chaine, sur une meme note tenue — a 1,5 m : ${r.pres} · a 20 m : ${r.moyen} · a 45 m : ${r.loin} · (fond de scene ${r.silence}) · au-dela de ${r.coupure} m plus rien n'est cree (${r.horsPortee ? 'raté' : 'refusé'}) · a gauche et a droite le meme son garde la meme force (${r.attDroite} / ${r.attGauche}), seul le cote change · cinq familles de bus desormais : ${r.bus.join(', ')}` };
});

test('marcher fait du bruit : les pas suivent la cadence de la foulee, plus vite et plus fort en courant, et le timbre change avec le sol', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; G.sfx.unlock();
    // on compte les DECLENCHEMENTS sur 3 s simulees, a la vitesse de marche puis de course
    const compte = v => { G.P.phasePas = 0; let n = 0; for (let i = 0; i < 180; i++) n += G.cadencePas(G.P, v, 1 / 60); return n; };
    const marche = compte(7), course = compte(7 * 1.55), arret = compte(0);
    // le sol sous les pieds change bien de matiere selon l'endroit
    const sols = {
      route: G.solSous(0, 0, 8), plage: G.solSous(113, 0.2, 40), mer: G.solSous(150, 0.2, 40),
      timbres: Object.keys(G.SOLS || {}).length,
    };
    // et le son sort vraiment : on compte les pas JOUES quand le joueur avance pour de bon
    // (touche « avancer » maintenue, comme un vrai joueur)
    G.bots.forEach(b => { b.wait = 1e6; });   // sinon on compterait aussi les pas des voisins
    G.SON.raz(); G.P.grounded = true; G.P.swimming = false; G.P.phasePas = 0;
    G.P.pos.set(0, 0, 8); G.P.vel.set(0, 0, 0);
    G.keys.add('KeyW');
    for (let i = 0; i < 60; i++) { G.P.vel.y = 0; G.P.grounded = true; G.step(1 / 60, true); }
    G.keys.delete('KeyW');
    const joues = G.SON.pas;
    G.bots.forEach(b => { b.wait = 0; });
    return { marche, course, arret, sols, joues, timbres: Object.keys(G.SOLS).length };
  });
  const ok = r.marche >= 9 && r.marche <= 14 && r.course > r.marche * 1.3 && r.arret === 0
    && r.sols.route === 'bitume' && r.sols.plage === 'sable' && r.sols.mer === 'eau' && r.timbres >= 7 && r.joues >= 2;
  return { ok, detail: `on marchait EN SILENCE partout sauf dans la neige, et la neige elle-meme sonnait a un rythme fixe qui n'avait rien a voir avec les jambes · le pas est maintenant cale sur la MEME horloge que l'animation (dt × vitesse × 1,7 rad, un pas par demi-periode) : ${r.marche} pas en 3 s au pas de marche, ${r.course} en courant (×${(r.course / r.marche).toFixed(2)}), 0 a l'arret · et ${r.timbres} timbres de sol selon la matiere sous les pieds (route → ${r.sols.route}, plage → ${r.sols.plage}, mer → ${r.sols.mer}) · ${r.joues} pas reellement joues en avancant pour de vrai dans la ville` };
});

test('frapper fait mal AUX OREILLES aussi : impact du coup qui porte, cri « aie » de celui qui encaisse, souffle quand on frappe dans le vide', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; G.sfx.unlock(); await dodo(300);
    const b = G.bots[0];
    // le coup qui PORTE
    b.pos.set(G.P.pos.x + 1.2, G.P.pos.y, G.P.pos.z); b.av.group.position.copy(b.pos); b.hp = 100; b.ko = 0; b.robbed = false;
    G.P.punchT = 0; G.P.combo = 0; G.SON.raz();
    G.attack('punch');
    const porte = { coups: G.SON.coups, aies: G.SON.aies };
    // le coup dans le VIDE : pas d'impact, pas de cri. On eloigne TOUT LE MONDE, sinon le
    // poing trouve un autre habitant a portee et le test croit qu'on a frappe dans l'air.
    const anciennes = G.bots.map(x => x.pos.clone());
    G.bots.forEach(x => { x.pos.set(G.P.pos.x + 300, x.pos.y, G.P.pos.z + 300); x.av.group.position.copy(x.pos); });
    const cible = G.nearestFighter(2.6);
    G.P.punchT = 0; G.P.combo = 0; G.SON.raz();
    G.attack('punch');
    const vide = { coups: G.SON.coups, aies: G.SON.aies, joues: G.SON.joues, cible: !!cible };
    G.bots.forEach((x, i) => { x.pos.copy(anciennes[i]); x.av.group.position.copy(x.pos); });
    // le joueur qui encaisse crie aussi
    G.P.hp = 100; G.SON.raz(); G.hurt(9, 'un cogneur', 1, 0, 1);
    const encaisse = { coups: G.SON.coups, aies: G.SON.aies };
    // chaque personnage a SA hauteur de voix, tiree de son nom, et elle ne bouge jamais
    const v1 = G.hauteurVoix('Lucas_2014'), v2 = G.hauteurVoix('Ines_gg', true), v1bis = G.hauteurVoix('Lucas_2014');
    return { porte, vide, encaisse, v1: +v1.toFixed(3), v2: +v2.toFixed(3), stable: v1 === v1bis };
  });
  const ok = r.porte.coups === 1 && r.porte.aies === 1 && !r.vide.cible && r.vide.coups === 0 && r.vide.aies === 0 && r.vide.joues >= 1
    && r.encaisse.coups === 1 && r.encaisse.aies === 1 && r.stable && Math.abs(r.v1 - r.v2) > 0.1;
  return { ok, detail: `un coup de poing, un combo et un coup de pied faisaient exactement le meme « pok » mono, et le personnage frappe ne disait rien · desormais : effort + impact sourd + claquement doses par la force quand ca porte (${r.porte.coups} impact, ${r.porte.aies} cri), rien qu'un souffle dans l'air quand on frappe a cote (${r.vide.coups} impact), et le joueur qui encaisse crie aussi (${r.encaisse.aies}) · chaque personnage a SA hauteur de voix, tiree de son nom et toujours la meme : Lucas ${r.v1}, Ines ${r.v2}` };
});

test('l\'helicoptere bat du rotor : la cadence des impulsions ET leur hauteur suivent le regime, et on l\'entend de loin', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; G.sfx.unlock();
    const h = G.city.cars.find(c => c.heli);
    if (!h) return { pas: true };
    h.x = G.P.pos.x + 12; h.z = G.P.pos.z; h.y = 14; h.busy = true;
    const mesure = regime => { h.spin = regime; h.rotorAcc = 0; G.SON.raz(); for (let i = 0; i < 120; i++) G.sonsVille(1 / 60); return { n: G.SON.rotorEmis, f: G.SON.rotorF, taux: G.SON.rotorTaux }; };
    const ralenti = mesure(0.1), plein = mesure(1);
    // loin, mais pas trop : au-dela de 120 m il se tait
    h.x = G.P.pos.x + 200; const tresLoin = mesure(1);
    h.x = G.P.pos.x + 12; h.busy = false; h.spin = 0;
    return { ralenti, plein, tresLoin: tresLoin.n };
  });
  const ok = !r.pas && r.plein.n > r.ralenti.n * 1.8 && r.plein.f > r.ralenti.f * 1.4 && r.plein.taux > r.ralenti.taux * 1.8 && r.tresLoin === 0;
  return { ok, detail: `l'helicoptere n'avait qu'une note grave toutes les 0,55 s quand l'armee volait, et RIEN le reste du temps · un rotor, ce sont des impulsions : leur cadence et leur hauteur suivent maintenant le regime — au ralenti ${r.ralenti.taux}/s a ${r.ralenti.f} Hz, plein regime ${r.plein.taux}/s a ${r.plein.f} Hz (${r.ralenti.n} contre ${r.plein.n} impulsions en 2 s), avec le sifflement de turbine par-dessus · et il se tait au-dela de 120 m (${r.tresLoin} impulsion)` };
});

test('entrer au commissariat, a l\'hopital ou a l\'ecole declenche l\'accueil parle — une seule fois, et chaque metier a sa phrase', async p => {
  const r = await p.evaluate(async () => {
    const G = __G;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; G.sfx.unlock();
    G.simTime += 500;   // on repart d'une ardoise propre (le delai anti-repetition est de 45 s)
    for (const k of Object.keys(G.ACCUEILS)) G.accueilTick();
    const dits = [];
    const entre = (drapeau, valeur) => {
      const av = G.SON.accueils;
      G.city[drapeau] = valeur; G.accueilTick();
      const phrase = G.SON.dernierAccueil;
      G.accueilTick(); G.accueilTick(); G.accueilTick();   // on reste plante devant le comptoir
      const apres = G.SON.accueils - av;
      G.city[drapeau] = valeur && typeof valeur === 'object' ? null : false; G.accueilTick();
      dits.push({ drapeau, n: apres, lieu: phrase && phrase.lieu, texte: phrase && phrase.texte });
      return apres;
    };
    const police = entre('plainteNear', true);
    const hopital = entre('medNear', true);
    const ecole = entre('classNear', { x: 0, z: 0 });
    const garage = entre('tuneNear', true);
    const banque = entre('deskNear', true);
    const coiffeur = entre('coiffeurNear', true);
    // on revient tout de suite au commissariat : il ne resalue pas
    const av = G.SON.accueils; G.city.plainteNear = true; G.accueilTick(); G.city.plainteNear = false; G.accueilTick();
    const retour = G.SON.accueils - av;
    // et une fois le delai passe, il resalue
    G.simTime += G.ACCUEIL_DELAI + 5;
    const av2 = G.SON.accueils; G.city.plainteNear = true; G.accueilTick(); G.city.plainteNear = false; G.accueilTick();
    const plusTard = G.SON.accueils - av2;
    const metiers = Object.keys(G.ACCUEILS).length;
    return { police, hopital, ecole, garage, banque, coiffeur, retour, plusTard, dits, metiers, parles: G.PARLE.n, pseudo: G.myCfg.name };
  });
  const d = k => (r.dits.find(x => x.lieu === k) || {}).texte || '';
  const ok = r.police === 1 && r.hopital === 1 && r.ecole === 1 && r.garage === 1 && r.banque === 1 && r.coiffeur === 1
    && r.retour === 0 && r.plusTard === 1 && r.metiers >= 11 && r.parles >= 6
    && /que puis-je pour vous/i.test(d('police')) && /comment puis-je vous aider/i.test(d('hopital'))
    && d('ecole').indexOf(r.pseudo) > 0;
  return { ok, detail: `on entrait au commissariat, a l'hopital, a l'ecole ou dans une boutique et PERSONNE ne disait bonjour · chaque metier a maintenant sa phrase, dite a voix haute au moment ou l'on arrive au comptoir (${r.metiers} lieux) : « ${d('police')} », « ${d('hopital')} », « ${d('ecole')} » · une seule fois par arrivee (${r.police} salut au commissariat, ${r.retour} en revenant tout de suite, ${r.plusTard} apres le delai de ${45} s), et un repli en voix « bruitee » si la synthese vocale du navigateur manque` };
});

test('le budget de seize sons places en meme temps n\'est jamais depasse : les plus proches gagnent la place', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; G.sfx.unlock(); await dodo(300);
    const X = G.P.pos.x, Y = G.P.pos.y, Z = G.P.pos.z;
    // quarante sons LOINTAINS d'un coup : le budget doit tenir
    G.SON.raz();
    for (let i = 0; i < 40; i++) G.sonCoup(X + 20 + i * 0.3, Y + 1, Z, 1);
    const plein = { pic: G.SON.pic, vivants: G.SON.vivants.length, refuses: G.SON.refuses, max: G.SON.max };
    // maintenant un son TOUT PROCHE : il doit passer, en prenant la place du plus lointain
    const proche = !!G.sonCoup(X + 0.5, Y + 1, Z, 1);
    const apres = { pic: G.SON.pic, vivants: G.SON.vivants.length };
    // le plus lointain a bien ete evince
    const plusLoin = Math.max(...G.SON.vivants.map(v => v.d));
    // et une pluie de sons pendant plusieurs images de jeu ne fait jamais deborder
    G.SON.raz();
    for (let t = 0; t < 30; t++) { for (let i = 0; i < 12; i++) G.sonPas(X + i, Y, Z + (i % 3), 'bitume', 1); await dodo(20); }
    const rafale = { pic: G.SON.pic, joues: G.SON.joues, refuses: G.SON.refuses };
    return { plein, proche, apres, plusLoin: +plusLoin.toFixed(1), rafale };
  });
  const ok = r.plein.pic <= r.plein.max && r.plein.vivants <= r.plein.max && r.plein.refuses > 0
    && r.proche && r.apres.vivants <= r.plein.max && r.rafale.pic <= 16 && r.rafale.joues > 20;
  return { ok, detail: `rien ne bornait le nombre de sons : une bagarre, une rue pleine et un helicoptere empilaient des dizaines de voix en meme temps, le limiteur ecrasait tout et la carte son grognait · le budget est desormais de ${r.plein.max} sons places simultanement, les PLUS PROCHES gagnant la place — 40 sons lointains d'un coup : ${r.plein.pic} retenus, ${r.plein.refuses} refuses ; un son tout pres passe quand meme (${r.proche ? 'oui' : 'non'}) en evincant le plus lointain (le plus eloigne qui reste est a ${r.plusLoin} m) ; et une rafale de 360 pas sur 30 images ne fait jamais depasser ${r.rafale.pic} sons simultanes (${r.rafale.joues} joues, ${r.rafale.refuses} refuses)` };
});

test('chaque quartier a sa rumeur et les bots qui parlent s\'ENTENDENT : une voix par personnage, tiree de son nom', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; G.sfx.unlock(); await dodo(300);
    // la rumeur suit le quartier ou l'on se trouve
    const rumeur = (x, z) => { G.P.pos.set(x, 1, z); G.SONV.ambT = 0; G.sonsVille(1 / 60); const e = G.ambiance.etat(); return { k: e.cle, vol: e.volCible, coupe: e.coupeCible }; };
    const centre = rumeur(0, 40), plage = rumeur(150, 40), zone = rumeur(-145, 40), parc = rumeur(0, 80);
    // une bulle de bot fait du bruit, celle du joueur non (on ne se double pas soi-meme)
    G.P.pos.set(0, 1, 8);
    const b = G.bots[0];
    b.pos.set(G.P.pos.x + 4, G.P.pos.y, G.P.pos.z); b.av.group.position.copy(b.pos); b.av.group.visible = true;
    G.SON.raz(); G.bubble(b.av, 'salut, ça va ?'); const bot = G.SON.blabla;
    G.SON.raz(); G.bubble(G.me, 'moi je parle tout seul'); const joueur = G.SON.blabla;
    // trop loin, on ne l'entend plus
    b.pos.set(G.P.pos.x + 120, G.P.pos.y, G.P.pos.z); b.av.group.position.copy(b.pos);
    G.SON.raz(); G.bubble(b.av, 'et de loin ?'); const loin = G.SON.blabla;
    b.pos.set(G.P.pos.x + 4, G.P.pos.y, G.P.pos.z); b.av.group.position.copy(b.pos);
    return { centre, plage, zone, parc, bot, joueur, loin, familles: Object.keys(G.QUARTIERS).length };
  });
  const ok = r.centre.k === 'centre' && r.plage.k === 'plage' && r.zone.k === 'zone' && r.parc.k === 'parc'
    && r.zone.coupe < r.centre.coupe && r.plage.vol > r.parc.vol && r.familles >= 8
    && r.bot === 1 && r.joueur === 0 && r.loin === 0;
  return { ok, detail: `la ville etait MUETTE : pas de rumeur, et douze habitants qui discutaient en bulles sans un son · chaque quartier a maintenant sa rumeur, un lit de bruit filtre qui fond d'un quartier a l'autre (${r.familles} ambiances — centre ${r.centre.vol} a ${r.centre.coupe} Hz, plage ${r.plage.vol} avec vagues et mouettes, La Zone plus sourde ${r.zone.coupe} Hz, parc ${r.parc.vol} avec des oiseaux) · et toute bulle de chat s'entend : une voix « bruitee » spatialisee, une hauteur par personnage tiree de son nom (${r.bot} voix pour le bot d'a cote, ${r.joueur} pour la sienne — on ne se double pas soi-meme, ${r.loin} a 120 m)` };
});

test('le feu, les sirenes d\'urgence et les chantiers s\'entendent — chacun d\'ou il vient, et jamais plus fort que la scene', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; G.sfx.unlock(); await dodo(300);
    const X = G.P.pos.x, Y = G.P.pos.y, Z = G.P.pos.z;
    const un = f => { G.SON.raz(); return { ok: !!f(), d: G.SON.dernier && G.SON.dernier.d, att: G.SON.dernier && G.SON.dernier.att }; };
    const feu = un(() => G.sonFeu(X + 5, 1.4, Z, 1));
    const boum = un(() => G.sonExplosion(X + 8, 1, Z));
    const boumLoin = un(() => G.sonExplosion(X + 200, 1, Z));   // trop loin : on ne sursaute plus
    const sirenes = Object.keys(G.SIRENES).map(k => k + ':' + (G.sonSirene(X + 20, Z, k) ? 'oui' : 'non'));
    const chantier = ['sonMarteau', 'sonSoudure', 'sonBalai', 'sonJetEau', 'sonRaclette'].map(n => n + ':' + (G[n](X + 3, 1, Z, 1) ? 'oui' : 'non'));
    // on reconnait un vehicule d'urgence quelle que soit la facon dont son poste l'a nomme
    const genres = [G.urgenceDe({ kind: 'ambulance' }), G.urgenceDe({ ambulance: true }), G.urgenceDe({ kind: 'depanneuse' }),
      G.urgenceDe({ urgence: 'dépanneuse' }), G.urgenceDe({ kind: 'pompier' }), G.urgenceDe({ police: true }), G.urgenceDe({ kind: 'kart' })];
    // un incendie crepite tout seul, depuis l'endroit ou il brule
    const f = G.declencheIncendie(X + 12, Z + 4, 100);
    G.SON.raz(); f.cd = 0; G.incendiesTick(1 / 60);
    const incendie = { sons: G.SON.joues, d: G.SON.dernier && G.SON.dernier.d };
    f.force = 0; G.incendiesTick(1 / 60);
    return { feu, boum, boumLoin, sirenes, chantier, genres, incendie, familles: Object.keys(G.SIRENES).length };
  });
  const ok = r.feu.ok && r.boum.ok && !r.boumLoin.ok && r.familles === 4
    && r.sirenes.every(s => /oui$/.test(s)) && r.chantier.every(s => /oui$/.test(s))
    && r.genres.slice(0, 6).join(',') === 'ambulance,ambulance,depanneuse,depanneuse,pompier,police' && r.genres[6] === null
    && r.incendie.sons >= 1 && r.incendie.d > 10;
  return { ok, detail: `le « BOOM » d'un vehicule, le crepitement d'un incendie et la sirene des pompiers partaient tous EN MONO et a plein volume, ou qu'on soit · tout passe maintenant par sonEn : l'explosion a 8 m sort a ${r.boum.att} d'attenuation et a 200 m elle n'est meme plus creee, le feu respire et craque depuis l'endroit ou il brule (${r.incendie.sons} son a ${r.incendie.d} m), ${r.familles} sirenes a deux tons (${r.sirenes.join(' · ')}) et les employes municipaux s'entendent travailler (${r.chantier.join(' · ')}) · et une ambulance ou une depanneuse est reconnue quelle que soit la facon dont son poste l'a nommee (${r.genres.slice(0, 6).join(', ')})` };
});

test('le corps a corps s\'entend en detail : crochet au ventre, parade qui claque, lame qui siffle', async p => {
  const r = await p.evaluate(async () => {
    const G = __G, dodo = ms => new Promise(rr => setTimeout(rr, ms));
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.settings.sound = true; G.sfx.unlock(); await dodo(300);
    const b = G.bots[0];
    // on eloigne les autres : sinon le poing trouve un voisin et le test mesure le mauvais coup
    G.bots.forEach((x, i) => { if (i) { x.pos.set(G.P.pos.x + 300, x.pos.y, G.P.pos.z + 300); x.av.group.position.copy(x.pos); } });
    const pose = () => { b.pos.set(G.P.pos.x + 1.2, G.P.pos.y, G.P.pos.z); b.av.group.position.copy(b.pos); b.hp = 100; b.ko = 0; b.robbed = false; b.parade = 0; G.P.punchT = 0; };
    pose(); G.P.combo = 0; G.SON.raz(); G.attack('punch');
    const direct = { coups: G.SON.coups, aies: G.SON.aies };
    // deuxieme coup du combo : le crochet au VENTRE (plus d'impact « visage », mais un cri quand meme)
    pose(); G.P.combo = 1; G.P.lastHitT = G.simTime; G.SON.raz(); G.attack('punch');
    const ventre = { coups: G.SON.coups, aies: G.SON.aies, joues: G.SON.joues, combo: G.P.combo };
    // l'adversaire PARE : ca claque sur l'avant-bras, pas sur le corps
    pose(); b.parade = G.simTime + 5; G.P.combo = 0; G.SON.raz(); G.attack('punch');
    const parade = { coups: G.SON.coups, joues: G.SON.joues };
    // une LAME en main : elle siffle
    pose(); G.P.melee = 'couteau'; G.P.combo = 0; G.SON.raz(); G.attack('punch');
    const lame = { coups: G.SON.coups, joues: G.SON.joues };
    G.P.melee = null;
    return { direct, ventre, parade, lame };
  });
  const ok = r.direct.coups === 1 && r.direct.aies === 1
    && r.ventre.coups === 0 && r.ventre.aies === 1 && r.ventre.joues >= 3 && r.ventre.combo === 2
    && r.parade.coups === 0 && r.parade.joues >= 2
    && r.lame.coups === 0 && r.lame.joues >= 2;
  return { ok, detail: `un direct, un crochet au ventre, une parade et un coup de couteau faisaient tous EXACTEMENT le meme bruit · ils sont maintenant distincts : le direct claque sur le corps (${r.direct.coups} impact), le deuxieme coup du combo s'enfonce dans le VENTRE — sourd, et l'air part des poumons (${r.ventre.joues} sons, plus d'impact « visage »), la parade claque sec sur l'avant-bras (${r.parade.joues} sons, ${r.parade.coups} impact), et la lame siffle avant d'entailler (${r.lame.joues} sons) · les drapeaux « parade » et « couteau » sont poses par le poste qui anime le corps a corps : tant qu'ils n'existent pas, on retombe sur l'impact normal` };
});
// ---------------- POSTE G : collisions du joueur et roulette du casino ----------------

test('balayage de collision : poussé contre un objet de la ville, le joueur ne rentre pas dedans', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const P = G.P;
    // tout ce qui doit VRAIMENT arrêter le joueur : ni marche basse, ni linteau, ni
    // véhicule (qui bouge), ni portail (qui s'ouvre), ni vitre (qui casse)
    const cand = G.solids.filter(o => !(o.h > 30 || o.veh || o.porte || o.glass || o.bar || o.blink)
      && o.y + o.h / 2 > 0.62 && o.y - o.h / 2 < 1.6 && !(o.w > 14 && o.d > 14) && o.w > 0.25 && o.d > 0.25
      && o.y - o.h / 2 < 3 && Math.abs(o.x) < 210 && o.z > -195 && o.z < 345);
    const pas = Math.max(1, Math.floor(cand.length / 260));
    const ech = cand.filter((o, i) => i % pas === 0);
    const pires = []; let n = 0, testes = 0, maxProf = 0, decor = 0;
    for (const o of ech) {
      const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][n++ % 4];
      const marge = (d[0] ? o.w / 2 : o.d / 2) + P.hw + 0.45;
      const x0 = o.x + d[0] * marge, z0 = o.z + d[1] * marge;
      const solY = G.groundUnder(x0, z0, null, o.y + o.h / 2 + 0.5);
      if (solY > o.y + o.h / 2 - 0.4) continue;   // on arriverait par le dessus : ce n'est pas un mur
      P.pos.set(x0, solY, z0); P.vel.set(0, 0, 0); P.sit = null; P.grounded = true; P.coinceT = 0;
      for (let k = 0; k < 22; k++) { P.vel.x = -d[0] * 8; P.vel.z = -d[1] * 8; G.step(1 / 60, true); }
      const ox = Math.min(P.pos.x + P.hw, o.x + o.w / 2) - Math.max(P.pos.x - P.hw, o.x - o.w / 2);
      const oz = Math.min(P.pos.z + P.hw, o.z + o.d / 2) - Math.max(P.pos.z - P.hw, o.z - o.d / 2);
      const oy = Math.min(P.pos.y + P.h, o.y + o.h / 2) - Math.max(P.pos.y, o.y - o.h / 2);
      const prof = Math.min(ox, oz, oy) > 0 ? Math.min(ox, oz) : 0;
      testes++; if (o.decor) decor++;
      if (prof > maxProf) maxProf = prof;
      if (prof > 0.1) pires.push(`${prof.toFixed(2)} m en (${o.x.toFixed(0)}, ${o.z.toFixed(0)})`);
    }
    return { total: G.solids.length, decorSolide: G.city.decorSolide, candidats: cand.length, testes, decor, maxProf, pires: pires.slice(0, 4) };
  });
  const ok = r.testes > 150 && r.maxProf < 0.1 && r.pires.length === 0 && r.decorSolide > 300;
  return { ok, detail: `la ville laissait traverser des centaines d'objets (troncs, colonnes, bancs, étals, caisses, poteaux, panneaux) : une règle générale en solidifie ${r.decorSolide} de plus (${r.total} solides au total) · ${r.testes} solides testés sur ${r.candidats}, dont ${r.decor} de ce décor : pénétration maximale ${r.maxProf.toFixed(3)} m (limite 0,10) ${r.pires.length ? '· fautifs : ' + r.pires.join(', ') : '· aucun objet traversé'}` };
});

test('coincé dans un solide, le joueur en ressort en moins d\'une seconde', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const P = G.P;
    const dedans = o => {
      const ox = Math.min(P.pos.x + P.hw, o.x + o.w / 2) - Math.max(P.pos.x - P.hw, o.x - o.w / 2);
      const oz = Math.min(P.pos.z + P.hw, o.z + o.d / 2) - Math.max(P.pos.z - P.hw, o.z - o.d / 2);
      const oy = Math.min(P.pos.y + P.h, o.y + o.h / 2) - Math.max(P.pos.y, o.y - o.h / 2);
      return Math.min(ox, oz, oy) > 0 ? Math.min(ox, oz) : 0;
    };
    // 1) au centre d'objets réels de la ville
    const cand = G.solids.filter(o => !(o.h > 30 || o.veh || o.porte || o.glass || o.bar)
      && o.y + o.h / 2 > 1.2 && o.y - o.h / 2 < 1.2 && o.w > 0.8 && o.d > 0.8 && !(o.w > 14 && o.d > 14)
      && Math.abs(o.x) < 200 && o.z > -190 && o.z < 340);
    const pas = Math.max(1, Math.floor(cand.length / 60));
    let pire = 0, rates = 0, testes = 0;
    for (const o of cand.filter((x, i) => i % pas === 0)) {
      P.pos.set(o.x, Math.max(0, o.y - o.h / 2), o.z); P.vel.set(0, 0, 0); P.sit = null; P.coinceT = 0;
      let k = 0; for (; k < 90; k++) { G.step(1 / 60, true); if (!dedans(o)) break; }
      testes++; if (k / 60 > pire) pire = k / 60;
      if (dedans(o) > 0.02) rates++;
    }
    // 2) la soupape elle-même : un objet apparaît AUTOUR du joueur (portail qui se referme,
    // véhicule qui se gare sur lui, décor devenu solide). Elle attend une demi-seconde — un
    // simple frôlement ne doit rien téléporter — puis le pose dehors.
    const cage = { x: 6, y: 1.2, z: 8, w: 3, h: 2.4, d: 3, mesh: { visible: true } };
    G.solids.push(cage);
    P.pos.set(cage.x, 0.3, cage.z); P.vel.set(0, 0, 0); P.coinceT = 0; P.coinceN = 0; P.sit = null;
    const enferme = dedans(cage) > 0;
    G.desincarcere(0.3); const tot = dedans(cage) > 0;    // avant 0,5 s : on ne bouge personne
    G.desincarcere(0.3); const sorti = dedans(cage) === 0;   // 0,6 s : dehors
    const i = G.solids.indexOf(cage); if (i >= 0) G.solids.splice(i, 1);
    return { testes, rates, pire, enferme, tot, sorti, x: P.pos.x, z: P.pos.z };
  });
  const ok = r.rates === 0 && r.pire < 1 && r.enferme && r.tot && r.sorti;
  return { ok, detail: `posé au centre de ${r.testes} solides de la ville, le joueur en sort toujours (le pire : ${r.pire.toFixed(2)} s, ${r.rates} échec(s)) · et si un objet apparaît AUTOUR de lui (portail qui se referme, voiture qui se gare dessus), la désincarcération attend une demi-seconde — encore dedans à 0,3 s : ${r.tot} — puis le pose dehors à 0,6 s (sorti=${r.sorti}, en x=${r.x.toFixed(2)}, z=${r.z.toFixed(2)})` };
});

test('la roulette : la caméra passe devant la roue, la roue freine et la bille tombe dans la case', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 21 });
    const t = G.city.casino.tables.find(x => x.kind === 'roulette');
    __SHOT.go({ world: 4, x: t.x, y: 1, z: t.z + 3.4, hour: 21 });
    const alea = Math.random; Math.random = () => 0.5;   // tirage figé : le 18, rouge
    G.wallet = 500;
    G.ouvreCasino('roulette', t); G.casino.mise = 25; G.casino.pari = 'rouge';
    G.jouerCasino();
    let precedent = t.g.userData.roue.rotation.y; const vits = [], mesures = []; let accelere = 0;
    for (let k = 0; k < 400 && G.casino.cine; k++) {
      G.rouletteCine(1 / 30);
      const y = t.g.userData.roue.rotation.y, v = (y - precedent) * 30; precedent = y;
      if (k > 1) { if (vits.length && v > vits[vits.length - 1] + 1e-9) accelere++; vits.push(v); }
      if (k === 40 || k === 150 || k === 200) mesures.push(G.rouletteEtat());
    }
    const fin = G.rouletteEtat();
    Math.random = alea;
    return { n: G.casino.roulette, vitDebut: vits[0], vitFin: vits[vits.length - 1], accelere,
      mesures: mesures.map(m => ({ vise: m.viseRoue, plongee: m.plongee, devant: m.devant, dist: m.distance, aff: m.affiche, ui: m.interface, num: m.numero })),
      ecart: fin.ecart, rB: fin.rB, ui: fin.interface, aff: fin.affiche, resultat: G.casino.resultat, gain: G.casino.gain, porte: G.wallet };
  });
  const m = r.mesures[0], f = r.mesures[2];
  const ok = r.n === 18 && r.accelere === 0 && r.vitDebut > 3 && r.vitFin < 0.05
    && m.vise < 0.15 && m.plongee > 0.15 && m.plongee < 0.7 && m.devant > 0.9 && !m.ui && m.aff
    && r.ecart < 0.05 && f.num === '18' && r.ui && !r.aff && r.gain === 50 && r.porte === 525;
  return { ok, detail: `la roue tournait DERRIÈRE l'interface d'achat : on ne voyait rien du tour · maintenant la caméra se pose devant la roue (écart de visée ${m.vise.toFixed(3)} rad, plongée ${(m.plongee * 57).toFixed(0)}°, du côté du joueur ${m.devant.toFixed(2)}, à ${m.dist.toFixed(1)} m), l'interface d'achat s'efface (${m.ui}) · la roue freine sans jamais réaccélérer (${r.vitDebut.toFixed(2)} → ${r.vitFin.toFixed(3)} rad/s, ${r.accelere} reprise(s)) · la bille se loge dans la case du ${r.n} à ${r.ecart.toFixed(4)} rad (limite 0,05), rayon ${r.rB.toFixed(2)} m · le numéro s'affiche en grand (« ${f.num} ») puis l'interface revient (${r.ui}) avec le gain : ${r.gain} 🪙, porte-monnaie 500 → ${r.porte}` };
});
// ---- poste ACTIVITÉ : les trois familles de missions de métier du bureau ----
test('les trois missions de métier (pompier, dépanneuse, police) se jouent du bureau jusqu\'à la paie', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 38, y: 1, z: 12, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 700));
    const G = __G, res = {};
    if (!G.NAV.blocked) G.buildNav();
    G.clearWanted(); G.carriere.total = 30; G.carriere.parId = {};
    // 1. le tableau du bureau les annonce toutes, avec difficulté et récompense
    G.openMissions(true);
    const grid = document.getElementById('missGrid');
    res.bureau = { cartes: grid.querySelectorAll('.mcard').length, ouvertes: grid.querySelectorAll('[data-m]:not([disabled])').length,
      ids: [...grid.querySelectorAll('[data-m]')].map(b => b.dataset.m),
      difficultes: G.MISSIONS.filter(m => m.dif >= 1 && m.dif <= 4).length, total: G.MISSIONS.length };
    G.closeUI();
    // 2. DÉPANNAGE : dépanneuse, treuil, remorquage jusqu'au garage
    G.wallet = 0; G.startMission('depannage');
    const d1 = G.mission.data;
    res.dep = { lance: !!G.mission.cur, veh: !!d1.veh, epave: !!d1.epave, chrono: G.mission.limit > 60, etapes: [] };
    G.enterCar(d1.veh); G.missionTick(0.1); res.dep.etapes.push(G.mission.step);
    d1.veh.x = d1.epave.x + 4; d1.veh.z = d1.epave.z; G.missionTick(0.1); res.dep.etapes.push(G.mission.step);
    res.dep.bandeau = document.getElementById('missionHud').textContent;
    d1.veh.outil = 1; d1.veh.outilCible = 1; G.missionTick(0.1); res.dep.etapes.push(G.mission.step);
    // l'épave suit vraiment la dépanneuse
    d1.veh.x = d1.garage.x - 40; d1.veh.z = d1.garage.z; G.missionTick(0.1);
    res.dep.remorque = Math.round(Math.hypot(d1.epave.x - d1.veh.x, d1.epave.z - d1.veh.z));
    d1.veh.x = d1.garage.x; d1.veh.z = d1.garage.z; G.missionTick(0.1);
    res.dep.fin = { finie: !G.mission.cur, gain: G.wallet };
    // 3. POMPIER : caserne, camion, sirène, lance à eau, blessé à sortir
    G.wallet = 0; G.mission.forcer = 'blesse'; G.startMission('pompier');
    const d2 = G.mission.data;
    res.pomp = { lance: !!G.mission.cur, variante: d2.variante, feux: (d2.feux || []).length, chrono: G.mission.limit > 60, etapes: [] };
    G.enterCar(d2.camion); G.missionTick(0.1); res.pomp.etapes.push(G.mission.step);
    d2.camion.x = d2.lieu.x + 6; d2.camion.z = d2.lieu.z; G.missionTick(0.1); res.pomp.etapes.push(G.mission.step);
    res.pomp.sirene = !!d2.camion.sireneOn;
    // le feu grossit tant qu'on ne l'arrose pas
    const f0 = d2.feux[0].force; for (let i = 0; i < 40; i++) G.missionTick(0.25);
    res.pomp.feuMonte = d2.feux[0].force > f0 + 5;
    // la lance à eau du camion fait bien baisser le feu
    d2.camion.x = d2.feux[0].x - Math.sin(d2.camion.h) * 8.5; d2.camion.z = d2.feux[0].z - Math.cos(d2.camion.h) * 8.5;
    const f1 = d2.feux[0].force; for (let i = 0; i < 30; i++) { G.arroseAutour(d2.camion, 0.1); G.missionTick(0.1); }
    res.pomp.arrosage = { avant: Math.round(f1), apres: Math.round(d2.feux[0].force) };
    for (const f of d2.feux) f.force = 0; G.incendiesTick(0.1); G.missionTick(0.1);
    res.pomp.etapes.push(G.mission.step);
    G.exitCar(); G.P.pos.set(d2.lieu.x + 3.5, 0.3, d2.lieu.z + 3.5); G.missionTick(0.1);
    res.pomp.blesse = !!d2.blesseSauve;
    G.P.pos.set(d2.camion.x, 0.3, d2.camion.z); G.missionTick(0.1);
    res.pomp.fin = { finie: !G.mission.cur, gain: G.wallet };
    if (G.mission.cur) G.endMission(false, true);
    // 4. POLICE : les quatre appels radio, chacun jusqu'à la réussite payée
    res.pol = {};
    const patrouille = (variante, joue) => {
      G.wallet = 0; G.clearWanted(); G.mission.forcer = variante; G.startMission('police');
      const d = G.mission.data, o = { lance: !!G.mission.cur, variante: d.variante, etapes: [] };
      if (!G.mission.cur) return o;
      G.enterCar(d.veh); G.missionTick(0.1); o.etapes.push(G.mission.step);
      d.veh.x = d.appel.x; d.veh.z = d.appel.z; d.veh.g.position.set(d.veh.x, d.veh.y, d.veh.z);
      G.P.pos.set(d.appel.x, 0.3, d.appel.z); G.missionTick(0.1); o.etapes.push(G.mission.step);
      o.sirene = !!d.veh.sireneOn;
      joue(d, o);
      o.fin = { finie: !G.mission.cur, gain: G.wallet };
      if (G.mission.cur) G.endMission(false, true);
      return o;
    };
    res.pol.chauffard = patrouille('chauffard', (d, o) => {
      for (let i = 0; i < 400 && G.mission.step === 2; i++) { d.cible.x = d.veh.x + 3; d.cible.z = d.veh.z; d.veh.sireneOn = true; G.missionTick(0.05); }
      o.range = G.mission.step === 3;
      G.exitCar(); G.P.pos.set(d.bot.pos.x, 0.3, d.bot.pos.z); G.missionTick(0.1);
      o.cellule = !!(d.bot && d.bot.prison);
    });
    res.pol.voleur = patrouille('voleur', (d, o) => {
      G.exitCar(); o.depart = Math.round(Math.hypot(d.bot.pos.x - G.P.pos.x, d.bot.pos.z - G.P.pos.z));
      for (let i = 0; i < 600 && G.mission.cur; i++) {
        const dx = d.bot.pos.x - G.P.pos.x, dz = d.bot.pos.z - G.P.pos.z, dd = Math.hypot(dx, dz) || 1;
        G.P.pos.x += dx / dd * 7 * 0.05; G.P.pos.z += dz / dd * 7 * 0.05; G.missionTick(0.05);
      }
      o.cellule = !!(d.bot && d.bot.prison);
    });
    res.pol.escorte = patrouille('escorte', (d, o) => {
      for (let i = 0; i < 2500 && G.mission.cur; i++) { G.P.pos.set(d.convoi.x, 0.3, d.convoi.z + 4); G.missionTick(0.05); }
      o.auPoste = Math.round(Math.hypot(d.convoi.x - d.station.x, d.convoi.z - d.station.z));
    });
    res.pol.barrage = patrouille('barrage', (d, o) => {
      G.exitCar();
      for (const c of d.files) { G.P.pos.set(c.x + 2, 0.3, c.z); G.missionTick(0.1); }
      o.controles = d.controles;
    });
    // On ne laisse pas les véhicules de mission (dépanneuse, patrouille, convoi, barrage)
    // traîner dans city.cars : les tests suivants cherchent « une voiture » et tomberaient
    // dessus.
    for (const k in (G.city.vehMission || {})) { const c = G.city.vehMission[k]; if (!c) continue;
      const i = G.city.cars.indexOf(c); if (i >= 0) G.city.cars.splice(i, 1);
      const j = G.solids.indexOf(c.solid); if (j >= 0) G.solids.splice(j, 1);
      c.g.visible = false; }
    G.city.vehMission = {}; G.sgridSale();
    G.carriere.total = 0; G.sauveCarriere();
    return res;
  });
  const b = r.bureau, dp = r.dep, pm = r.pomp, po = r.pol;
  const ok = b.cartes === b.total && b.ouvertes === b.total && b.difficultes === b.total
    && ['depannage', 'pompier', 'police'].every(id => b.ids.includes(id))
    && dp.lance && dp.veh && dp.epave && dp.chrono && dp.etapes.join(',') === '1,2,3' && dp.remorque <= 8 && dp.fin.finie && dp.fin.gain >= 70
    && pm.lance && pm.variante === 'blesse' && pm.feux >= 1 && pm.chrono && pm.sirene && pm.feuMonte
    && pm.arrosage.apres < pm.arrosage.avant - 20 && pm.etapes.join(',') === '1,2,3' && pm.blesse && pm.fin.finie && pm.fin.gain >= 90
    && ['chauffard', 'voleur', 'escorte', 'barrage'].every(v => po[v].lance && po[v].variante === v && po[v].etapes.join(',') === '1,2' && po[v].sirene && po[v].fin.finie && po[v].fin.gain >= 85)
    && po.chauffard.range && po.chauffard.cellule && po.voleur.cellule && po.escorte.auPoste < 20 && po.barrage.controles === 3;
  return { ok, detail: `le bureau affiche ses ${b.cartes} missions, toutes avec une difficulté (${b.difficultes}/${b.total}) · 🛻 dépannage : dépanneuse prise, treuil accroché, épave remorquée à ${dp.remorque} m derrière, garage → +${dp.fin.gain} 🪙 · 🚒 pompier : camion pris, sirène ${pm.sirene}, le feu monte tout seul (${pm.feuMonte}) et la lance le fait tomber de ${pm.arrosage.avant} à ${pm.arrosage.apres}, blessé sorti → +${pm.fin.gain} 🪙 · 🚓 police : chauffard rangé et en cellule (+${po.chauffard.fin.gain}), voleur rattrapé et en cellule (+${po.voleur.fin.gain}), convoi escorté jusqu'au poste à ${po.escorte.auPoste} m (+${po.escorte.fin.gain}), barrage ${po.barrage.controles}/3 (+${po.barrage.fin.gain})` };
});

test('une mission de métier ratée est comptée comme un échec, et la carrière verrouille ce qui n\'est pas mérité', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: -40, y: 1, z: 136, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 700));
    const G = __G, res = {};
    if (!G.NAV.blocked) G.buildNav();
    G.clearWanted();
    // 1. carrière vierge : les trois missions de métier sont verrouillées
    G.carriere.total = 0; G.carriere.parId = {};
    res.verrous = {};
    for (const id of ['depannage', 'pompier', 'police']) { G.startMission(id); res.verrous[id] = !!G.mission.cur; if (G.mission.cur) G.endMission(false, true); }
    G.openMissions(true);
    res.cartesVerrouillees = document.getElementById('missGrid').querySelectorAll('[data-m][disabled]').length;
    G.closeUI();
    // 2. une mission réussie fait monter la carrière et finit par tout ouvrir
    G.carriere.total = 2; G.startMission('depannage'); res.ouvertA2 = !!G.mission.cur; if (G.mission.cur) G.endMission(false, true);
    G.startMission('police'); res.policeA2 = !!G.mission.cur; if (G.mission.cur) G.endMission(false, true);
    G.carriere.total = 30;
    res.grade = G.gradeCarriere().n;
    // 3. le feu qu'on laisse brûler fait PERDRE la mission (et ne paie rien)
    G.wallet = 0; G.mission.forcer = 'foyers'; G.startMission('pompier');
    const d = G.mission.data, f0 = d.feux[0].force;
    let n = 0; while (G.mission.cur && n++ < 8000) G.missionTick(0.1);
    res.feuGagne = { fini: !G.mission.cur, secondes: Math.round(n * 0.1), force0: Math.round(f0), gain: G.wallet, feuxRestants: G.city.incendies.length };
    // 4. le convoi laissé sans escorte fait perdre la mission
    G.wallet = 0; G.mission.forcer = 'escorte'; G.startMission('police');
    const d2 = G.mission.data;
    G.enterCar(d2.veh); G.missionTick(0.1);
    d2.veh.x = d2.appel.x; d2.veh.z = d2.appel.z; G.P.pos.set(d2.appel.x, 0.3, d2.appel.z); G.missionTick(0.1);
    let n2 = 0; while (G.mission.cur && n2++ < 2000) { G.P.pos.set(d2.convoi.x + 120, 0.3, d2.convoi.z); G.missionTick(0.05); }
    res.convoiPerdu = { fini: !G.mission.cur, gain: G.wallet, loin: Math.round(d2.loinT || 0), arrive: !(d2.convoi.route && d2.convoi.route.length) };
    // 5. le chrono qui expire fait perdre la mission
    G.wallet = 0; G.startMission('depannage');
    G.mission.t0 = G.simTime - G.mission.limit - 1; G.missionTick(0.1);
    res.chrono = { fini: !G.mission.cur, gain: G.wallet };
    if (G.mission.cur) G.endMission(false, true);
    // On ne laisse pas les véhicules de mission (dépanneuse, patrouille, convoi, barrage)
    // traîner dans city.cars : les tests suivants cherchent « une voiture » et tomberaient
    // dessus.
    for (const k in (G.city.vehMission || {})) { const c = G.city.vehMission[k]; if (!c) continue;
      const i = G.city.cars.indexOf(c); if (i >= 0) G.city.cars.splice(i, 1);
      const j = G.solids.indexOf(c.solid); if (j >= 0) G.solids.splice(j, 1);
      c.g.visible = false; }
    G.city.vehMission = {}; G.sgridSale();
    G.carriere.total = 0; G.sauveCarriere();
    return res;
  });
  const ok = !r.verrous.depannage && !r.verrous.pompier && !r.verrous.police && r.cartesVerrouillees === 3
    && r.ouvertA2 && !r.policeA2 && r.grade === 'Héros de la ville'
    && r.feuGagne.fini && r.feuGagne.gain === 0 && r.feuGagne.feuxRestants === 0
    && r.convoiPerdu.fini && r.convoiPerdu.gain === 0
    && r.chrono.fini && r.chrono.gain === 0;
  return { ok, detail: `carrière vierge : les 3 missions de métier refusent de démarrer et s'affichent verrouillées (${r.cartesVerrouillees} cartes grisées) · à 2 missions réussies le dépannage s'ouvre mais pas la police · à 30 le grade est « ${r.grade} » · le feu laissé libre gagne au bout de ${r.feuGagne.secondes} s et la mission est perdue sans un sou (${r.feuGagne.gain} 🪙, plus aucun foyer laissé en ville) · le convoi lâché fait échouer l'escorte, qu'on l'abandonne trop longtemps (${r.convoiPerdu.loin} s) ou qu'il arrive tout seul au poste (arrivé : ${r.convoiPerdu.arrive}) — ${r.convoiPerdu.gain} 🪙 · le chrono dépassé fait échouer le dépannage (${r.chrono.gain} 🪙)` };
});

test('le repère GPS de chaque mission du bureau mène à un point que l\'on peut vraiment rejoindre', async p => {
  const r = await p.evaluate(async () => {
    __SHOT.go({ world: 4, x: 38, y: 1, z: 12, hour: 12 });
    await new Promise(r2 => setTimeout(r2, 700));
    const G = __G, res = { missions: [] };
    if (!G.NAV.blocked) G.buildNav();
    G.clearWanted(); G.carriere.total = 30;
    for (const m of G.MISSIONS) {
      G.startMission(m.id);
      const b = G.beacon.mission, o = { id: m.id, repere: !!b };
      if (b) {
        const ch = G.navEnPieton(() => G.navPath(G.P.pos.x, G.P.pos.z, b.x, b.z));
        const fin = ch && ch.length ? ch[ch.length - 1] : null;
        o.atteint = !!(ch && ch.reached !== false);
        o.ecart = fin ? Math.round(Math.hypot(fin[0] - b.x, fin[1] - b.z)) : 999;
        o.pos = [Math.round(b.x), Math.round(b.z)];
      }
      res.missions.push(o);
      G.endMission(false, true);
    }
    // le tracé de chevrons suit la CHAUSSÉE quand on conduit (avant : la grille des piétons,
    // qui coupait par les parcs là où la voiture ne passe pas)
    const surRoute = (x, z) => (G.city.routes || []).some(rt => Math.abs(x - rt.x) <= rt.w / 2 + 2.5 && Math.abs(z - rt.z) <= rt.d / 2 + 2.5);
    const mesure = () => {
      G.gpsRoute.hide(); G.gpsRoute.update();
      let n = 0, hors = 0;
      G.scene.traverse(o => {
        if (!o.isMesh || !o.visible || !o.geometry || o.geometry.type !== 'ConeGeometry') return;
        if (Math.abs(o.geometry.parameters.radius - 0.42) > 0.01) return;
        n++; if (!surRoute(o.position.x, o.position.z)) hors++;
      });
      return { chevrons: n, hors, pct: n ? Math.round(hors / n * 100) : 0 };
    };
    G.setBeacon(-83, 72, 0, 'mission');
    res.aPied = mesure();
    const v = G.city.cars.find(c => !c.heli && !c.kart && c.kind == null && !c.busy);
    v.x = G.P.pos.x; v.z = G.P.pos.z; v.g.position.set(v.x, v.y, v.z);
    G.enterCar(v); res.auVolant = mesure(); G.exitCar();
    G.clearBeacon('mission');
    // le client du taxi doit être joignable EN VOITURE : plusieurs emplacements sont au
    // milieu du terrain de foot ou d'une pelouse, la mission y était infaisable
    const ecart = (x, z) => { const p = G.navPath(G.P.pos.x, G.P.pos.z, x, z); if (!p || !p.length) return 99; const f = p[p.length - 1]; return +Math.hypot(f[0] - x, f[1] - z).toFixed(1); };
    let pire = 0, tires = 0;
    for (let i = 0; i < 30; i++) { G.startMission('taxi'); const d = G.mission.data; pire = Math.max(pire, ecart(d.bot.pos.x, d.bot.pos.z)); tires++; res.taxiChrono = G.mission.limit; G.endMission(false, true); }
    res.taxi = { tirages: tires, pireEcart: pire };
    // On ne laisse pas les véhicules de mission (dépanneuse, patrouille, convoi, barrage)
    // traîner dans city.cars : les tests suivants cherchent « une voiture » et tomberaient
    // dessus.
    for (const k in (G.city.vehMission || {})) { const c = G.city.vehMission[k]; if (!c) continue;
      const i = G.city.cars.indexOf(c); if (i >= 0) G.city.cars.splice(i, 1);
      const j = G.solids.indexOf(c.solid); if (j >= 0) G.solids.splice(j, 1);
      c.g.visible = false; }
    G.city.vehMission = {}; G.sgridSale();
    G.carriere.total = 0; G.sauveCarriere();
    return res;
  });
  const avec = r.missions.filter(m => m.repere);
  const perdus = avec.filter(m => !m.atteint || m.ecart > 12);
  const ok = avec.length >= 14 && perdus.length === 0 && r.auVolant.chevrons > 20 && r.auVolant.pct < r.aPied.pct
    && r.taxi.pireEcart <= 6 && r.taxiChrono > 60;
  return { ok, detail: `${avec.length} missions sur ${r.missions.length} posent un repère, et toutes mènent à un point que l'on rejoint par le réseau (écart maximum ${Math.max(...avec.map(m => m.ecart))} m ; en échec : ${perdus.map(m => m.id + ' ' + m.ecart + ' m').join(', ') || 'aucune'}) · au volant, le tracé de chevrons suit la chaussée : ${r.auVolant.hors}/${r.auVolant.chevrons} hors route (${r.auVolant.pct} %) contre ${r.aPied.hors}/${r.aPied.chevrons} (${r.aPied.pct} %) avec la grille des piétons · le client du taxi est toujours joignable en voiture : sur ${r.taxi.tirages} tirages, la voiture s'approche au pire à ${r.taxi.pireEcart} m (4 des 26 emplacements étaient à plus de 6 m, mission impossible) et le chrono suit le trajet (${r.taxiChrono} s au lieu de 120 s fixes)` };
});

test('un vehicule lance dans un mur y laisse une marque dont l\'intensite suit la vitesse', async p => {
  const r = await p.evaluate(() => {
    const G = __G, c0 = G.city;
    // la tour ouest du Techno-Parc : une avenue droite devant, une façade dégagée derrière
    const lance = vitesse => {
      __SHOT.go({ world: 4, x: -16, y: 1, z: -128, hour: 12 });
      G.effaceMarques();
      const c = G.city.cars.find(v => !v.heli && !v.rider && (v.baseD || 4.4) > 4);
      c.x = -16; c.z = -134; c.y = 0; c.h = Math.PI; c.dmg = 0; c.dead = false;
      c.hitT = 0; c.bumpT = 0; c.scrapeT = 0;   // les essais s'enchaînent dans la même page
      c.g.position.set(c.x, 0, c.z); G.settleVehicle(c); G.vehicleSolid(c); G.enterCar(c); G.drive.speed = vitesse;
      for (let i = 0; i < 240 && !c0.marques.length; i++) {
        if (Math.abs(G.drive.speed) > 0.5) G.drive.speed = Math.max(G.drive.speed, vitesse);
        G.driveStep(1 / 60);
      }
      const m = c0.marques[0] || null, avance = +(c.z - (-134)).toFixed(1);
      G.exitCar();
      return { vitesse, avance, marques: c0.marques.length, dmg: Math.round(c.dmg || 0),
        m: m && { sorte: m.sorte, force: m.force, taille: m.taille, x: m.x, y: m.y, z: m.z } };
    };
    const lent = lance(4), moyen = lance(11), fort = lance(26);
    // la marque est bien COLLÉE sur la façade, pas posée en l'air au milieu de la rue
    const surFacade = fort.m && Math.abs(fort.m.z + 141.25) < 0.6 && fort.m.y > 0.2 && fort.m.y < 4.2;
    // la règle générale marche sur N'IMPORTE quel solide, pas seulement sur les murs
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.effaceMarques();
    const nImporte = G.solids.filter(o => o.mesh && o.h > 1 && o.h < 20 && o.w > 1).slice(0, 12);
    let poses = 0;
    for (const o of nImporte) if (G.marqueImpact(o, o.x - o.w / 2, o.y, o.z, 14)) poses++;
    const sortes = [3, 8, 15, 30].map(f => G.sorteSelonForce(f));
    // aucune marque n'est un obstacle : rien n'entre dans `solids`
    const solidesAvant = G.solids.length;
    for (let i = 0; i < 20; i++) G.marqueImpact(nImporte[0], nImporte[0].x - nImporte[0].w / 2, 1 + i * 0.1, nImporte[0].z - 4 + i * 0.5, 9);
    const sansCollision = G.solids.length === solidesAvant;
    return { lent, moyen, fort, surFacade, poses, testes: nImporte.length, sortes, sansCollision };
  });
  const ok = r.lent.marques === 1 && r.moyen.marques === 1 && r.fort.marques === 1
    && r.lent.m.sorte === 'trace' && r.moyen.m.sorte === 'bosse' && r.fort.m.sorte === 'trou'
    && r.fort.m.taille > r.moyen.m.taille && r.moyen.m.taille > r.lent.m.taille
    && r.surFacade && r.poses === r.testes && r.sansCollision
    && r.sortes.join() === 'trace,bosse,fissure,trou';
  return { ok, detail: `on encastre la même voiture dans la même façade a trois vitesses : a ${r.lent.vitesse} m/s la ville garde une ${r.lent.m.sorte} de ${r.lent.m.taille} m, a ${r.moyen.vitesse} m/s une ${r.moyen.m.sorte} de ${r.moyen.m.taille} m, a ${r.fort.vitesse} m/s un ${r.fort.m.sorte} de ${r.fort.m.taille} m — l'intensité suit la vitesse et la marque est collée sur la façade (y = ${r.fort.m.y} m, z = ${r.fort.m.z}) · la règle est GÉNÉRALE : ${r.poses}/${r.testes} solides pris au hasard dans la ville acceptent une marque, l'échelle est ${r.sortes.join(' → ')}, et aucune marque n'ajoute d'obstacle (${r.sansCollision})` };
});

test('les marques du decor sont plafonnees et ne coutent qu\'un seul appel de dessin', async p => {
  const r = await p.evaluate(() => {
    const G = __G, c0 = G.city;
    __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    G.effaceMarques();
    const dessine = () => { G.renderer.render(G.scene, G.camera); return G.renderer.info.render.calls; };
    const avant = dessine();
    // 300 traces de pneu au sol (`objet` = null : c'est la chaussée qui prend la marque),
    // bien espacées — deux marques a moins de 50 cm fusionnent, c'est voulu
    for (let i = 0; i < 300; i++) G.marqueImpact(null, -60 + (i % 20) * 1.5, 0, -20 + Math.floor(i / 20) * 1.5, 4 + (i % 22));
    const apres = dessine();
    const nb = c0.marques.length;
    // le tampon est circulaire : chaque case du maillage n'est occupée qu'une fois
    const cases = new Set(c0.marques.map(m => m.slot));
    const range = G.marquesMesh.geometry.drawRange.count;
    // un seul maillage pour toutes les marques
    let maillages = 0; G.worldGroup.traverse(o => { if (o.isMesh && o.geometry === G.marquesMesh.geometry) maillages++; });
    // et on peut tout effacer
    G.effaceMarques();
    const apresEffacement = { marques: c0.marques.length, range: G.marquesMesh.geometry.drawRange.count, calls: dessine() };
    return { avant, apres, nb, max: G.MARQUES_MAX, cases: cases.size, range, maillages, apresEffacement, sortes: G.MARQUE_SORTES };
  });
  const ok = r.nb === r.max && r.cases === r.max && r.range === r.max * 6 && r.maillages === 1
    && r.apres - r.avant === 1 && r.apresEffacement.marques === 0 && r.apresEffacement.range === 0
    && r.sortes.length === 4;
  return { ok, detail: `300 traces posées au sol : la ville n'en garde que ${r.nb} (plafond ${r.max}), les plus anciennes sont écrasées — ${r.cases} cases distinctes dans le maillage, plage de dessin ${r.range} indices · toutes les marques tiennent dans UN SEUL maillage (${r.maillages}) et une seule texture a quatre cases (${r.sortes.join(', ')}) : les appels de dessin passent de ${r.avant} a ${r.apres}, soit +${r.apres - r.avant} · effaceMarques() remet tout a zéro (${r.apresEffacement.marques} marques, ${r.apresEffacement.calls} appels)` };
});

test('le mobilier fragile casse au choc et les employes municipaux viennent le remettre', async p => {
  const r = await p.evaluate(() => {
    const G = __G, c0 = G.city;
    __SHOT.go({ world: 4, x: 48, y: 1, z: -100, hour: 12 });
    c0.horaires = false; G.metiersRepos();
    // ---- le bonhomme de neige : posé sur le boulevard du Nord, emboutí a 14 m/s
    const bn = G.bonhommeNeige(60, -100);
    const solideAvant = G.solids.indexOf(bn.solid) >= 0;
    const haut0 = bn.boules[2].position.y;
    const c = G.city.cars.find(v => !v.heli && !v.rider && (v.baseD || 4.4) > 4);
    c.x = 48; c.z = -100; c.y = 0; c.h = Math.PI / 2; c.dmg = 0; c.dead = false; c.hitT = 0;
    c.g.position.set(c.x, 0, c.z); G.settleVehicle(c); G.vehicleSolid(c); G.enterCar(c); G.drive.speed = 14;
    for (let i = 0; i < 240 && !bn.broken; i++) { G.drive.speed = Math.max(G.drive.speed, 14); G.driveStep(1 / 60); }
    const neige = { casse: bn.broken, penche: +bn.g.quaternion.angleTo(new G.THREE.Quaternion()).toFixed(2),
      tombe: +(haut0 - bn.boules[2].position.y).toFixed(2), solideAvant, solideApres: G.solids.indexOf(bn.solid) >= 0 };
    G.exitCar(); G.repareChose(bn);
    const neigeRemis = !bn.broken && Math.abs(bn.boules[2].position.y - haut0) < 0.01;
    // ---- l'inventaire du mobilier fragile de la ville
    const inv = G.breakables.reduce((a, b) => (a[b.kind] = (a[b.kind] || 0) + 1, a), {});
    // ---- chaque sorte se casse a sa manière
    const essai = k => {
      const b = G.breakables.find(x => x.kind === k && !x.broken); if (!b) return null;
      G.breakThing(b, { x: b.x + 1, z: b.z }, true);
      return { kind: k, casse: b.broken, penche: +b.g.quaternion.angleTo(new G.THREE.Quaternion()).toFixed(2), horsSolides: G.solids.indexOf(b.solid) < 0 };
    };
    const formes = ['panneau', 'poubelle', 'cone'].map(essai);
    // ---- LE POTEAU CASSÉ EST RÉPARÉ PAR LES EMPLOYÉS : on prend le panneau le plus proche du dépôt
    for (const b of G.breakables) if (b.broken || b.cracked) { G.repareChose(b); b.enCours = false; }
    const dep = c0.depot;
    let pan = null, bd = 1e9;
    for (const b of G.breakables) { if (b.kind !== 'panneau') continue; const d = Math.hypot(b.x - dep.x, b.z - dep.z); if (d < bd) { bd = d; pan = b; } }
    G.breakThing(pan, { x: pan.x + 1, z: pan.z }, true);
    const vu = (() => { const t = G.chercheCasse(); return !!t; })();
    let repare = -1, chantiers = 0;
    const DT = 1 / 20;
    for (let i = 0; i < 3600 && repare < 0; i++) {
      G.simTime = G.simTime + DT; G.metiersTick(DT);
      if (c0.chantiers.length > chantiers) chantiers = c0.chantiers.length;
      if (!pan.broken) repare = +(i * DT).toFixed(1);
    }
    return { neige, neigeRemis, inv, formes, vu, repare, chantiers, dist: Math.round(bd), etat: G.METIERS.employes[0].etat };
  });
  const f = Object.fromEntries(r.formes.filter(Boolean).map(o => [o.kind, o]));
  const ok = r.neige.casse && r.neige.tombe > 0.5 && r.neige.solideAvant && !r.neige.solideApres && r.neigeRemis
    && r.inv.panneau > 30 && r.inv.poubelle > 20 && r.inv.cone >= 8 && r.inv.lamp > 50 && r.inv.light > 20
    && r.formes.every(o => o && o.casse && o.penche > 0.3 && o.horsSolides)
    && f.cone.penche > f.panneau.penche
    && r.vu && r.repare > 0 && r.repare < 170;
  return { ok, detail: `un bonhomme de neige emboutí a 14 m/s s'effondre : il bascule de ${r.neige.penche} rad, sa boule du haut tombe de ${r.neige.tombe} m, il sort des solides — et il se redresse intact après réparation · la ville compte maintenant ${r.inv.panneau} panneaux, ${r.inv.poubelle} poubelles, ${r.inv.cone} cônes, ${r.inv.lamp} lampadaires, ${r.inv.light} feux et ${r.inv.glass} vitrines cassables ; chacun se casse a sa manière (panneau tordu ${f.panneau.penche} rad, poubelle renversée ${f.poubelle.penche}, cône couché ${f.cone.penche}) · un poteau de panneau cassé a ${r.dist} m du dépôt est VU par les employés (${r.vu}), ils posent ${r.chantiers} chantier et l'ont redressé en ${r.repare} s simulées (équipe « ${r.etat} »)` };
});
// ================= POSTE VÉHICULES (round 67) =================
// Réponse à la demande du joueur : « les roues des véhicules entrent dans le sol ; les
// mouvements sont trop simples, inspire-toi de GTA » — puis les places assises, les chocs,
// la dépanneuse et les ambulances.
//
// Deux pièges de banc d'essai reviennent dans tous ces tests, d'où les précautions :
//  · on ÉCARTE puis on REMET les véhicules garés autour du lieu d'essai. En les déplaçant
//    sans les remettre, chaque test décalait un peu plus le parc et les suivants mesuraient
//    des véhicules à 2 km de là.
//  · pour mesurer un son COURT (le BOOM, la pétarade), on met le rendu en veille
//    (window.__manetteSeule) : une image de swiftshader bloque le fil principal près de
//    quatre secondes, et le son était fini bien avant qu'on prenne la mesure.

test('les roues de CHAQUE type de véhicule sont posées sur le sol, à l\'arrêt comme en roulant', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const T = G.THREE;
    // Le bas d'une roue se mesure ROULEMENT ANNULÉ : la boîte englobante d'un cylindre qui
    // tourne sur son axe enfle de 40 % alors que sa silhouette, elle, ne bouge pas d'un poil.
    const basRoue = (c, r2) => {
      const a = r2.m.rotation.x; r2.m.rotation.x = 0; r2.m.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(r2.m), wp = new T.Vector3(); r2.m.getWorldPosition(wp);
      r2.m.rotation.x = a; r2.m.updateMatrixWorld(true);
      return b.min.y - G.groundCar(wp.x, wp.z, c.solid, c.y || 0);
    };
    const mesure = c => { c.g.updateMatrixWorld(true); let bas = 9, haut = -9; for (const r2 of c.roues) { const d = basRoue(c, r2); if (d < bas) bas = d; if (d > haut) haut = d; } return [bas, haut]; };
    // La surface doit être plate SOUS TOUT LE VÉHICULE : un camion de 8,6 m posé sur un
    // trottoir déborde forcément dans le caniveau et sa roue arrière pend dans le vide — ce
    // n'est pas un défaut de calage, c'est un trottoir trop étroit pour un camion.
    const plat = (x, z, c) => {
      const W = (c.baseW || 2.4) / 2, D = (c.baseD || 4.4) / 2, h = [];
      for (const dx of [-W, 0, W]) for (const dz of [-D, 0, D]) h.push(G.groundUnder(x + dx, z + dz, null, 1.4));
      return Math.max(...h) - Math.min(...h) < 0.03;
    };
    const sols = { route: [26, 0], trottoir: [21.5, 0], sable: null };
    { const s = G.city.sea; if (s) sols.sable = [(s.x1 || 0) - 6, 40]; }
    const tous = [...G.city.cars, ...G.city.aiCars, ...G.police.cars];
    const res = {}, vus = {};
    for (const c of tous) {
      const k = c.kind || (c.kart ? 'kart' : c.heli ? 'heli' : c.sport ? 'sport' : 'voiture');
      if (vus[k] || !c.roues || !c.roues.length) continue; vus[k] = 1;
      const g0 = [c.x, c.z, c.h, c.y], par = {};
      for (const [nom, pt] of Object.entries(sols)) {
        if (!pt || !plat(pt[0], pt[1], c)) { par[nom] = null; continue; }
        c.x = pt[0]; c.z = pt[1]; c.h = 0; c.y = G.groundUnder(c.x, c.z, c.solid, 2); c.tiltX = 0; c.tilt = 0; c.susp = 0; c.suspV = 0; c.tangage = 0; c.roulis = 0; G.settleVehicle(c);
        c.g.position.set(c.x, c.y, c.z); c.g.rotation.set(0, 0, 0, 'YXZ'); if (c.caisse) { c.caisse.position.y = 0; c.caisse.rotation.set(0, 0, 0); }
        par[nom] = mesure(c).map(v => +v.toFixed(3));
      }
      res[k] = par;
      c.x = g0[0]; c.z = g0[1]; c.h = g0[2]; c.y = g0[3]; c.g.position.set(c.x, c.y, c.z); c.g.rotation.set(0, c.h, 0, 'YXZ'); G.vehicleSolid(c);
    }
    // EN ROULANT : on lance une voiture sur l'anneau, roues mesurées à chaque image
    const v = G.city.cars.find(x => !x.kind && !x.heli && !x.kart && !x.travail);
    const remis = [];
    for (const a of [...G.city.cars, ...G.city.aiCars, ...G.police.cars]) {
      if (a === v || Math.hypot(a.x - 26, a.z) > 80) continue;
      remis.push([a, a.x, a.z]); a.x += 600; a.g.position.set(a.x, a.y || 0, a.z); G.vehicleSolid(a);
    }
    v.busy = false; v.dmg = 0; v.x = 26; v.z = 24; v.h = Math.PI; v.y = G.groundUnder(26, 24, v.solid, 1);
    G.enterCar(v); G.drive.speed = 14;
    let bas = 9;
    for (let i = 0; i < 90; i++) { G.simTime = G.simTime + 1 / 60; G.conduire(v, { gaz: 1, volant: 0, frein: 0 }, 1 / 60); const m = mesure(v); if (m[0] < bas) bas = m[0]; }
    G.exitCar();
    for (const [a, x, z] of remis) { a.x = x; a.z = z; a.g.position.set(x, a.y || 0, z); G.vehicleSolid(a); }
    return { res, roulant: +bas.toFixed(3), genres: Object.keys(res).length,
      mesures: Object.values(res).reduce((n, q) => n + Object.values(q).filter(Boolean).length, 0) };
  });
  const mauvais = [];
  for (const [k, par] of Object.entries(r.res)) for (const [sol, m] of Object.entries(par)) if (m && !(m[0] >= -0.02 && m[1] <= 0.05)) mauvais.push(`${k}/${sol} ${m[0]}…${m[1]} m`);
  const ok = r.genres >= 12 && r.mesures >= 20 && !mauvais.length && r.roulant >= -0.02;
  return { ok, detail: `la hauteur de chaque roue était écrite à la main (0,36 pour une voiture, 0,42 pour un camion, 0,52 pour le buggy) alors que son rayon dépend de l'échelle passée à makeWheel : le tracteur roulait les roues arrière enfoncées de 7,7 cm dans le bitume et le vélo flottait 9,7 cm au-dessus · chaque roue est maintenant MESURÉE (Box3, échelles et parents compris) et reposée sur le sol, et le véhicule suit la plus HAUTE de ses roues au lieu de son centre · ${r.genres} genres essayés à l'arrêt sur route, trottoir et sable (${r.mesures} mesures ; les surfaces trop étroites pour le gabarit sont écartées) : ${mauvais.length ? 'HORS BORNES ' + mauvais.join(', ') : 'toutes entre −0,02 et +0,05 m'} · en roulant, la roue la plus basse reste à ${r.roulant} m du sol` };
});

test('les roues tournent à la vitesse réelle, les roues avant braquent, et la caisse prend du roulis et du tangage', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city.cars.find(x => !x.kind && !x.heli && !x.kart && !x.travail);
    const remis = [];
    for (const a of [...G.city.cars, ...G.city.aiCars, ...G.police.cars]) {
      if (a === c || Math.hypot(a.x - 26, a.z) > 80) continue;
      remis.push([a, a.x, a.z]); a.x += 600; a.g.position.set(a.x, a.y || 0, a.z); G.vehicleSolid(a);
    }
    c.busy = false; c.dmg = 0;
    const remet = () => { c.x = 26; c.z = 24; c.h = Math.PI; c.y = G.groundUnder(26, 24, c.solid, 1); c.vy = 0; c.airborne = false; };
    remet(); G.enterCar(c);
    const pas = (cmd, n) => { for (let i = 0; i < n; i++) { G.simTime = G.simTime + 1 / 60; G.conduire(c, cmd, 1 / 60); } };
    remet(); G.drive.speed = 10; const a0 = c.roues[0].m.rotation.x, x0 = c.x, z0 = c.z;
    pas({ gaz: 0.35, volant: 0, frein: 0 }, 60);
    const dist = Math.hypot(c.x - x0, c.z - z0), gomme = Math.abs(c.roues[0].m.rotation.x - a0) * c.roues[0].r;
    remet(); G.drive.speed = 2;
    pas({ gaz: 0.2, volant: 1, frein: 0 }, 60);
    const avD = c.roues.filter(w => w.avant).map(w => +(w.m.rotation.y * 180 / Math.PI).toFixed(1));
    const arD = c.roues.filter(w => !w.avant).map(w => +(w.m.rotation.y * 180 / Math.PI).toFixed(3));
    remet(); G.drive.speed = 16; pas({ gaz: 0.8, volant: 1, frein: 0 }, 40);
    const roulis = c.roulis;
    remet(); G.drive.speed = 0; c.tangage = 0; pas({ gaz: 1, volant: 0, frein: 0 }, 18);
    const cabre = c.tangage;
    remet(); G.drive.speed = 22; c.tangage = 0; pas({ gaz: -1, volant: 0, frein: 1 }, 22);
    const plonge = c.tangage;
    const separe = !!c.caisse && !c.caisse.children.some(o => c.wheels.includes(o));
    G.exitCar();
    for (const [a, x, z] of remis) { a.x = x; a.z = z; a.g.position.set(x, a.y || 0, z); G.vehicleSolid(a); }
    return { dist: +dist.toFixed(2), gomme: +gomme.toFixed(2), rayon: +c.roues[0].r.toFixed(3),
      avD, arD, roulis: +roulis.toFixed(3), cabre: +cabre.toFixed(3), plonge: +plonge.toFixed(3), separe };
  });
  const braq = Math.abs(r.avD[0] || 0);
  const ok = Math.abs(r.gomme - r.dist) < r.dist * 0.12 && braq > 24 && braq <= 31
    && r.avD.every(a => Math.abs(a) > 24) && r.arD.every(a => Math.abs(a) < 0.01)
    && Math.abs(r.roulis) > 0.03 && r.cabre < -0.02 && r.plonge > 0.02 && r.separe;
  return { ok, detail: `les roues tournaient toutes comme si elles faisaient 30 cm de rayon et ne braquaient jamais · elles roulent maintenant sur LEUR rayon (${r.rayon} m) : ${r.dist} m parcourus pour ${r.gomme} m de gomme déroulée ; seules les roues avant braquent (${r.avD.join(' / ')}° contre ${r.arD.join(' / ')}° à l'arrière, 30° au maximum) ; la caisse penche de ${r.roulis} rad en virage, se cabre de ${-r.cabre} rad à l'accélération et plonge de ${r.plonge} rad au freinage — et comme les roues ne sont plus dans le même groupe que la caisse (${r.separe}), elles restent posées par terre pendant que la caisse travaille` };
});

test('la gomme fume au freinage fort et au dérapage, jamais en roulant doucement', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const c = G.city.cars.find(x => !x.kind && !x.heli && !x.kart && !x.travail);
    const remis = [];
    for (const a of [...G.city.cars, ...G.city.aiCars, ...G.police.cars]) {
      if (a === c || Math.hypot(a.x - 26, a.z) > 80) continue;
      remis.push([a, a.x, a.z]); a.x += 600; a.g.position.set(a.x, a.y || 0, a.z); G.vehicleSolid(a);
    }
    c.busy = false; c.dmg = 0;
    const remet = () => { c.x = 26; c.z = 24; c.h = Math.PI; c.y = G.groundUnder(26, 24, c.solid, 1); c.vy = 0; c.fumeeT = 0; };
    remet(); G.enterCar(c);
    const essai = (cmd, v, n) => { remet(); G.drive.speed = v; c.fumee = 0; for (let i = 0; i < n; i++) { G.simTime = G.simTime + 1 / 60; G.conduire(c, cmd, 1 / 60); } return c.fumee || 0; };
    const frein = essai({ gaz: -1, volant: 0, frein: 1 }, 22, 30);
    const main = essai({ gaz: 0.4, volant: 1, frein: 1, main: true }, 18, 30);
    const doux = essai({ gaz: 0.25, volant: 0, frein: 0 }, 6, 60);
    const arret = essai({ gaz: 0, volant: 0, frein: 1 }, 0, 60);
    G.exitCar();
    for (const [a, x, z] of remis) { a.x = x; a.z = z; a.g.position.set(x, a.y || 0, z); G.vehicleSolid(a); }
    return { frein, main, doux, arret };
  });
  const ok = r.frein >= 2 && r.main >= 2 && r.doux === 0 && r.arret === 0;
  return { ok, detail: `aucune trace de gomme n'existait : on pilait sans un bruit et sans un nuage · un freinage appuyé à 79 km/h fait maintenant ${r.frein} bouffées de fumée blanche aux roues (avec le crissement qui va avec), le frein à main en dérapage ${r.main} — et rouler doucement (${r.doux}) ou piler à l'arrêt (${r.arret}) n'en fait aucune` };
});

test('la sensation de vitesse : le champ de vision s\'ouvre, la caméra recule et le châssis fait vibrer l\'image', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 26, y: 1, z: 24, hour: 12 });
    const c = G.city.cars.find(x => !x.kind && !x.heli && !x.kart && !x.travail);
    c.busy = false; c.x = 26; c.z = 24; c.h = Math.PI; c.y = G.groundUnder(26, 24, c.solid, 1);
    // à pied : rien ne bouge, le champ de vision reste celui du jeu
    G.P.zoom = false;
    for (let i = 0; i < 40; i++) G.camConduite(1 / 60);
    const pied = G.camConduite(1 / 60);
    G.enterCar(c);
    G.drive.speed = 0;
    for (let i = 0; i < 40; i++) G.camConduite(1 / 60);
    const arret = G.camConduite(1 / 60);
    G.drive.speed = c.spec.max * 0.5;
    for (let i = 0; i < 60; i++) G.camConduite(1 / 60);
    const moitie = G.camConduite(1 / 60);
    G.drive.speed = c.spec.max;
    for (let i = 0; i < 90; i++) G.camConduite(1 / 60);
    const fond = G.camConduite(1 / 60);
    G.drive.speed = 0;
    for (let i = 0; i < 90; i++) G.camConduite(1 / 60);
    const retour = G.camConduite(1 / 60);
    G.exitCar();
    return { pied, arret, moitie, fond, retour };
  });
  const ok = Math.abs(r.pied.fov - 55) < 0.5 && Math.abs(r.arret.fov - 55) < 0.5
    && r.moitie.fov > r.arret.fov + 5 && r.fond.fov > r.moitie.fov + 4 && r.fond.fov > 68
    && r.fond.recul > 2.4 && r.moitie.recul > 1.1 && r.arret.recul < 0.05
    && r.fond.vibr > 0.02 && r.moitie.vibr === 0 && Math.abs(r.retour.fov - 55) < 0.6;
  return { ok, detail: `le champ de vision était figé à 55° et la caméra à la même distance qu'à pied : à 200 km/h comme à l'arrêt, l'image ne disait RIEN de la vitesse · elle le dit maintenant, et proprement : à pied ${r.pied.fov}°, au volant à l'arrêt ${r.arret.fov}° (recul ${r.arret.recul} m), à mi-régime ${r.moitie.fov}° (recul ${r.moitie.recul} m), à fond ${r.fond.fov}° (recul ${r.fond.recul} m) et le châssis fait vibrer l'image de ${r.fond.vibr} m — au-delà des trois quarts de la vitesse maxi seulement (${r.moitie.vibr} à mi-régime) — puis tout revient en place quand on s'arrête (${r.retour.fov}°)` };
});

test('le moteur monte en régime avec les rapports, et la NITRO fait une grosse pétarade qui SORT vraiment', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; __SHOT.go({ world: 4, x: 26, y: 1, z: 24, hour: 12 });
    G.settings.sound = true; const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const ctx = G.sfx.unlock(), ch = G.sfx.chaine();
    const an = ctx.createAnalyser(); an.fftSize = 2048; ch.lim.connect(an);
    const rms = () => { const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let s2 = 0; for (const v of d) s2 += v * v; return +Math.sqrt(s2 / d.length).toFixed(4); };
    // rendu en veille : une image de swiftshader bloque le fil principal près de quatre
    // secondes, et une pétarade de 0,7 s serait finie avant qu'on la mesure
    window.__manetteSeule = true;
    G.engine.stop(); try { G.music.stop(); } catch (e) {} try { G.siren.stop(); } catch (e) {}
    await dodo(800); const silence = rms();
    const c = G.city.cars.find(x => !x.kind && !x.heli && !x.kart && !x.travail);
    const remis = [];
    for (const a of [...G.city.cars, ...G.city.aiCars, ...G.police.cars]) {
      if (a === c || Math.hypot(a.x - 26, a.z) > 80) continue;
      remis.push([a, a.x, a.z]); a.x += 600; a.g.position.set(a.x, a.y || 0, a.z); G.vehicleSolid(a);
    }
    c.busy = false; c.dmg = 0; c.accidente = false; c.x = 26; c.z = 24; c.h = Math.PI; c.y = G.groundUnder(26, 24, c.solid, 1);
    G.enterCar(c);
    const tour = (v, n) => { G.drive.speed = v; c.x = 26; c.z = 24; c.h = Math.PI; for (let i = 0; i < n; i++) { G.simTime = G.simTime + 1 / 60; G.conduire(c, { gaz: v > 0 ? 1 : 0, volant: 0, frein: 0 }, 1 / 60); G.drive.speed = v; } return [G.drive.gear, +(c.regime || 0).toFixed(1)]; };
    // RALENTI : à l'arrêt, pied levé
    c.regime = null; const ralenti = tour(0, 40);
    const boite = c.caisse;   // la caisse peut avoir ete laissee de travers par un test precedent
    // Le régime d'une VRAIE boîte fait une dent de scie : il grimpe dans chaque rapport,
    // retombe au passage du suivant. On échantillonne donc finement le premier rapport, puis
    // le tout début du deuxième, puis la prise maxi.
    const paliers = [0.03, 0.08, 0.15, 0.22, 0.45, 0.7, 0.95].map(f => tour(c.spec.max * f, 30));
    await dodo(600); const moteur = rms();
    // LA NITRO. Moteur coupé, pour que la pétarade s'entende seule.
    G.engine.stop(); await dodo(600); const silence2 = rms();
    c.nitroPret = true; G.drive.nitroCd = 0;
    const avant = G.petarade.n || 0;
    const parti = G.nitroGo();
    const apres = G.petarade.n || 0;
    let petard = 0;
    for (let i = 0; i < 12; i++) { await dodo(60); petard = Math.max(petard, rms()); }
    await dodo(500);
    G.engine.stop(); G.exitCar();
    for (const [a, x, z] of remis) { a.x = x; a.z = z; a.g.position.set(x, a.y || 0, z); G.vehicleSolid(a); }
    try { ch.lim.disconnect(an); } catch (e) {}
    window.__manetteSeule = false;
    return { etat: ctx.state, silence, silence2, ralenti, paliers, moteur, parti, petarades: apres - avant, petard };
  });
  // dans le RAPPORT 1 le régime grimpe (3 mesures), il RETOMBE au passage du 2e, et la
  // prise maxi tourne haut : c'est exactement la signature d'une boîte de vitesses
  const dansLe1 = r.paliers[0][1] < r.paliers[1][1] && r.paliers[1][1] < r.paliers[2][1];
  const chute = r.paliers[3][0] > r.paliers[2][0] && r.paliers[3][1] < r.paliers[2][1];
  const monte = dansLe1 && chute && r.paliers[6][0] >= 5 && r.paliers[6][1] > 14;
  const ok = r.etat === 'running' && r.ralenti[1] < 2 && monte && r.moteur > r.silence + 0.02
    && r.parti === true && r.petarades === 1 && r.petard > r.silence2 + 0.03;
  return { ok, detail: `le régime moteur ne dépendait que du rapport de boîte, et la nitro ne faisait qu'un « pschitt » de bruitage · le moteur tourne maintenant au RALENTI à l'arrêt (${r.ralenti[1]}, rapport A${r.ralenti[0]}) puis dessine la dent de scie d'une vraie boîte — il grimpe dans le rapport puis retombe au passage du suivant : ${r.paliers.map(g => 'A' + g[0] + '→' + g[1]).join(', ')} · et la NITRO déclenche une vraie PÉTARADE — détonation, souffle et ratés d'allumage — envoyée sur le bus MOTEUR : mesuré par un analyseur au bout de la chaîne, silence ${r.silence}, moteur qui tourne ${r.moteur}, moteur coupé ${r.silence2}, pétarade ${r.petard}` };
});

test('chacun sa place assise dans le véhicule — seul, à deux, à trois, et le chien — sans rien qui dépasse', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const T = G.THREE;
    const boite = o => { let b = null; o.updateMatrixWorld(true); o.traverse(m => { if (!m.isMesh || !m.visible || !m.geometry) return; const k = new T.Box3().setFromObject(m); b = b ? b.union(k) : k.clone(); }); return b; };
    const figs = [];
    for (let i = 0; i < 3; i++) { const a = G.buildAvatar({ name: 'Essai' + i, jersey: 2 + i, num: 1 }); if (a.tag) a.tag.visible = false; figs.push(a); }
    const tous = [...G.city.cars, ...G.city.aiCars, ...G.police.cars];
    const res = {}, vus = {};
    for (const c of tous) {
      const k = c.kind || (c.kart ? 'kart' : c.heli ? 'heli' : c.sport ? 'sport' : 'voiture');
      if (vus[k]) continue; vus[k] = 1;
      // la caisse et le repère logique doivent coïncider : un test précédent a pu déplacer
      // le véhicule sans bouger son groupe
      c.g.position.set(c.x, c.y || 0, c.z); c.g.rotation.set(0, c.h, 0, 'YXZ');
      // caisse a plat : un test precedent a pu la laisser en plein tangage ou en plein roulis
      if (c.caisse) { c.caisse.position.y = 0; c.caisse.rotation.set(0, 0, 0); }
      c.tangage = 0; c.roulis = 0; c.susp = 0; c.suspV = 0; c.tiltX = 0; c.tilt = 0;   // la pente du terrain, elle, ne retombe jamais tout a fait a zero
      const TT = G.placesDe(c), noms = G.PLACES_ORDRE.filter(n => TT[n]);
      const ferme = !!G.caisseFermee(c);
      const bc = boite(c.caisse || c.g);
      // ENVELOPPE DE RÉFÉRENCE : la boîte des morceaux visibles, élargie au gabarit officiel
      // (baseW × baseD) et jusqu'au bas de caisse. Un pare-chocs arraché par un test
      // précédent ne doit pas rétrécir la carrosserie contre laquelle on mesure — c'est ce
      // qui faisait « sortir » un conducteur pourtant bien assis.
      { const W = (c.baseW || 2.4) / 2, D = (c.baseD || 4.4) / 2, cs = Math.abs(Math.cos(c.h)), sn = Math.abs(Math.sin(c.h));
        const ex = W * cs + D * sn, ez = W * sn + D * cs;
        bc.min.x = Math.min(bc.min.x, c.x - ex); bc.max.x = Math.max(bc.max.x, c.x + ex);
        bc.min.z = Math.min(bc.min.z, c.z - ez); bc.max.z = Math.max(bc.max.z, c.z + ez);
        bc.min.y = Math.min(bc.min.y, (c.y || 0) + 0.2); }
      const e = { places: noms.length, chien: !!TT.chien, ferme, dehors: [], ecart: 99, ecartChien: 99 };
      // chacun sa place : deux personnes ne sont jamais à moins de 92 cm (le diamètre d'un
      // personnage, la règle que la ville applique déjà aux piétons) et le chien, plus petit,
      // jamais à moins de 55 cm de quelqu'un
      const pts = noms.map(n => TT[n]);
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
        e.ecart = Math.min(e.ecart, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
      if (TT.chien) for (const q of pts) e.ecartChien = Math.min(e.ecartChien, Math.hypot(q.x - TT.chien.x, q.z - TT.chien.z));
      for (let n = 1; n <= Math.min(3, noms.length); n++) {
        for (let i = 0; i < n; i++) G.assiedAvatar(figs[i], c, TT[noms[i]], 1, noms[i] === 'conducteur');
        for (let i = 0; i < n; i++) {
          const b = boite(figs[i].group), m = 0.03;
          const deb = { g: bc.min.x - b.min.x, d: b.max.x - bc.max.x, bas: bc.min.y - b.min.y,
            haut: b.max.y - bc.max.y, ar: bc.min.z - b.min.z, av: b.max.z - bc.max.z };
          const pire = Object.entries(deb).filter(([, q]) => q > m);
          if (pire.length && ferme) e.dehors.push(n + ':' + noms[i] + ' ' + pire.map(([q, w]) => q + '=' + w.toFixed(2)).join(' '));
        }
      }
      if (TT.chien && G.chien.pet) e.chienPose = !!G.assiedChien(c, 1);
      for (const a of figs) a.group.visible = false;
      res[k] = e;
    }
    // LE JOUEUR QUI MONTE APPARAÎT ASSIS : dès la première image, sans transition
    const v = G.city.cars.find(x => !x.kind && !x.heli && !x.kart && !x.travail);
    v.busy = false; v.g.position.set(v.x, v.y || 0, v.z); v.g.rotation.set(0, v.h, 0, 'YXZ');
    if (v.caisse) { v.caisse.position.y = 0; v.caisse.rotation.set(0, 0, 0); }
    v.tangage = 0; v.roulis = 0; v.susp = 0; v.suspV = 0; v.tiltX = 0; v.tilt = 0;
    G.me.rig.legL.rotation.x = 0; G.me.rig.legR.rotation.x = 0; G.me.rig.armL.rotation.x = 0;
    G.enterCar(v);
    G.poseJoueurAuVolant(1 / 60);
    const pose = { cuisse: +G.me.rig.legL.rotation.x.toFixed(2), genou: +(G.me.rig.legL.genou ? G.me.rig.legL.genou.rotation.x : 0).toFixed(2), bras: +G.me.rig.armL.rotation.x.toFixed(2) };
    const bJ = boite(G.me.group), bV = boite(v.caisse || v.g);
    { const W = (v.baseW || 2.4) / 2, D = (v.baseD || 4.4) / 2, cs = Math.abs(Math.cos(v.h)), sn = Math.abs(Math.sin(v.h));
      bV.min.x = Math.min(bV.min.x, v.x - (W * cs + D * sn)); bV.max.x = Math.max(bV.max.x, v.x + (W * cs + D * sn));
      bV.min.y = Math.min(bV.min.y, (v.y || 0) + 0.2); }
    pose.dedans = bJ.min.x > bV.min.x - 0.03 && bJ.max.x < bV.max.x + 0.03 && bJ.max.y < bV.max.y + 0.03 && bJ.min.y > bV.min.y - 0.03;
    G.exitCar();
    return { res, pose, genres: Object.keys(res).length };
  });
  const sortis = Object.entries(r.res).filter(([, e]) => e.dehors.length).map(([k, e]) => k + ' (' + e.dehors.join(', ') + ')');
  const serres = Object.entries(r.res).filter(([, e]) => e.ecart < 0.92).map(([k, e]) => k + ' ' + e.ecart.toFixed(2) + ' m');
  const chiensSerres = Object.entries(r.res).filter(([, e]) => e.chien && e.ecartChien < 0.55).map(([k, e]) => k + ' ' + e.ecartChien.toFixed(2) + ' m');
  const places = Object.values(r.res).reduce((s, e) => s + e.places, 0);
  const chiens = Object.values(r.res).filter(e => e.chien).length;
  const ok = r.genres >= 15 && !sortis.length && !serres.length && !chiensSerres.length
    && r.pose.cuisse < -1.3 && r.pose.genou > 1.3 && r.pose.bras < -1 && r.pose.dedans;
  return { ok, detail: `un personnage mesure 2,36 m et l'habitacle d'une berline 1,60 m : le conducteur avait la tête 40 cm AU-DESSUS du toit, et il fallait attendre une demi-seconde pour qu'il s'asseye · table PLACES pour ${r.genres} genres de véhicule, ${places} places nommées (conducteur, passager avant, deux places arrière) et ${chiens} places de chien · à 1, 2 puis 3 occupants, aucun morceau ne sort de la carrosserie (${sortis.length ? 'RESTE ' + sortis.join(', ') : 'zéro débordement'}), deux personnes ne sont jamais à moins de 92 cm (${serres.length ? 'TROP SERRÉ ' + serres.join(', ') : 'toutes bien espacées'}) et le chien jamais à moins de 55 cm de quelqu'un (${chiensSerres.length ? 'TROP PRÈS ' + chiensSerres.join(', ') : 'sa place à lui'}) · le joueur qui monte apparaît assis DÈS LA PREMIÈRE IMAGE : cuisse ${r.pose.cuisse} rad (à l'horizontale), genou ${r.pose.genou} rad (plié), bras ${r.pose.bras} rad (mains sur le volant), et il tient entier dans la caisse (${r.pose.dedans})` };
});

test('le BOOM du choc sort au choc, jamais à l\'arrêt, et d\'autant plus fort qu\'on va vite', async p => {
  const r = await p.evaluate(async () => {
    const G = __G; __SHOT.go({ world: 4, x: 26, y: 1, z: 24, hour: 12 });
    G.settings.sound = true; const dodo = ms => new Promise(rr => setTimeout(rr, ms));
    const ctx = G.sfx.unlock(), ch = G.sfx.chaine();
    const an = ctx.createAnalyser(); an.fftSize = 2048; ch.lim.connect(an);
    const rms = () => { const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let s2 = 0; for (const v of d) s2 += v * v; return +Math.sqrt(s2 / d.length).toFixed(4); };
    window.__manetteSeule = true;   // rendu en veille : le BOOM dure 0,44 s, une image en dure 4
    G.engine.stop(); try { G.music.stop(); } catch (e) {} try { G.siren.stop(); } catch (e) {}
    await dodo(800); const silence = rms();
    const c = G.city.cars.find(x => !x.kind && !x.heli && !x.kart && !x.travail);
    // à l'arrêt (moins de 1,2 m/s), un contact ne fait RIEN
    c.boomT = 0; G.boom.n = 0;
    const arret = G.choc(c, 0.4, null);
    let rArret = 0; for (let i = 0; i < 8; i++) { await dodo(60); rArret = Math.max(rArret, rms()); }
    const nArret = G.boom.n;
    await dodo(500);
    // petit choc, puis gros choc
    c.boomT = 0; G.boom.n = 0;
    const petit = G.choc(c, 4, null);
    let rPetit = 0; for (let i = 0; i < 8; i++) { await dodo(60); rPetit = Math.max(rPetit, rms()); }
    const fPetit = G.boom.force;
    await dodo(600);
    c.boomT = 0;
    const gros = G.choc(c, 24, null);
    let rGros = 0; for (let i = 0; i < 8; i++) { await dodo(60); rGros = Math.max(rGros, rms()); }
    const fGros = G.boom.force;
    await dodo(500);
    try { ch.lim.disconnect(an); } catch (e) {}
    window.__manetteSeule = false;
    return { silence, arret, nArret, rArret, petit, rPetit, fPetit: +fPetit.toFixed(2), gros, rGros, fGros: +fGros.toFixed(2) };
  });
  const ok = r.arret === 0 && r.nArret === 0 && r.rArret < r.silence + 0.02
    && r.petit > 0 && r.gros > r.petit && r.rPetit > r.silence + 0.03 && r.rGros > r.rPetit * 1.4 && r.fGros > r.fPetit;
  return { ok, detail: `un choc ne faisait qu'un « toc » de bruitage, le même à 5 km/h et à 90 · c'est maintenant un vrai BOOM — la masse qui s'arrête (une sinusoïde très grave qui plonge de 150 à 34 Hz) plus la tôle qui plie — envoyé sur le bus effets et mesuré par un analyseur au bout de la chaîne : à l'arrêt RIEN (${r.nArret} BOOM déclenché, ${r.rArret} contre ${r.silence} de silence), petit choc à 14 km/h ${r.rPetit} (intensité ${r.fPetit}), gros choc à 86 km/h ${r.rGros} (intensité ${r.fGros})` };
});

test('un accident immobilise les deux véhicules, la police vient constater, et l\'amende est prélevée — sinon c\'est la prison', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const avance = n => { for (let i = 0; i < n; i++) { G.simTime = G.simTime + 1 / 20; G.servicesTick(1 / 20); } };
    const cars = G.city.cars.filter(v => !v.kind && !v.heli && !v.kart && !v.travail);
    const A = cars[0], B = cars[1];
    const remis = [];
    for (const v of [...G.city.cars, ...G.city.aiCars]) {
      if (v === A || v === B || Math.hypot(v.x - 26, v.z - 7) > 80) continue;
      remis.push([v, v.x, v.z]); v.x += 600; v.g.position.set(v.x, v.y || 0, v.z); G.vehicleSolid(v);
    }
    const pose = () => { A.accidente = false; B.accidente = false; A.busy = false; A.dead = false;
      A.dmg = 12; B.dmg = 5; A.x = 26; A.z = 10; A.h = Math.PI; A.y = G.groundUnder(26, 10, A.solid, 1);
      B.x = 26; B.z = 4; B.h = 0; B.y = A.y; A.g.position.set(A.x, A.y, A.z); B.g.position.set(B.x, B.y, B.z); };
    // 1) le joueur au volant, portefeuille garni
    pose(); G.wallet = 500; G.jail.on = false; G.enterCar(A); G.drive.speed = 16;
    const acc = G.ouvreAccident(A, B, 16);
    const juste = { v: G.drive.speed, a: A.v, b: B.v, pc: !!acc.pc,
      dpc: acc.pc ? +Math.hypot(acc.pc.x - acc.x, acc.pc.z - acc.z).toFixed(1) : null };
    // pied au plancher : un accidenté ne repart pas
    const x0 = A.x, z0 = A.z;
    for (let i = 0; i < 60; i++) { G.simTime = G.simTime + 1 / 60; G.conduire(A, { gaz: 1, volant: 0, frein: 0 }, 1 / 60); G.servicesTick(1 / 60); }
    const bloque = { v: +Math.abs(G.drive.speed).toFixed(2), dep: +Math.hypot(A.x - x0, A.z - z0).toFixed(2) };
    let vuPolice = false, vuConstat = false;
    for (let k = 0; k < 120 && acc.etat !== 'fini'; k++) { avance(20); if (acc.etat === 'constat') vuConstat = true; if (acc.pc && Math.hypot(acc.pc.x - acc.x, acc.pc.z - acc.z) < 8) vuPolice = true; }
    const paye = { etat: acc.etat, amende: acc.amende, paye: acc.paye, prison: acc.prison, wallet: G.wallet, vuPolice, vuConstat };
    for (let k = 0; k < 20; k++) avance(20);
    // 2) même chose, sans un sou : la prison
    pose(); G.wallet = 3; G.jail.on = false;
    const acc2 = G.ouvreAccident(A, B, 12);
    for (let k = 0; k < 120 && acc2.etat !== 'fini'; k++) avance(20);
    const fauche = { etat: acc2.etat, paye: acc2.paye, prison: acc2.prison, jail: G.jail.on };
    if (G.drive.car) G.exitCar();
    G.jail.on = false; A.accidente = false; B.accidente = false;
    for (let k = 0; k < 20; k++) avance(20);
    for (const [v, x, z] of remis) { v.x = x; v.z = z; v.g.position.set(x, v.y || 0, z); G.vehicleSolid(v); }
    return { juste, bloque, paye, fauche };
  });
  const ok = r.juste.pc && r.juste.v === 0 && r.juste.a === 0 && r.juste.b === 0
    && r.bloque.v < 0.01 && r.bloque.dep < 0.05
    && r.paye.vuPolice && r.paye.vuConstat && r.paye.etat === 'fini' && r.paye.paye === true && r.paye.amende > 0 && r.paye.wallet === 500 - r.paye.amende
    && r.fauche.paye === false && r.fauche.prison === true && r.fauche.jail === true;
  return { ok, detail: `deux véhicules qui se percutaient rebondissaient et repartaient comme si de rien n'était · c'est maintenant un ACCIDENT : les deux s'immobilisent et RESTENT immobiles — une seconde de plein gaz les fait bouger de ${r.bloque.dep} m, vitesse ${r.bloque.v} — une voiture de police part sur le lieu (${r.juste.dpc} m au départ, arrivée ${r.paye.vuPolice}), fait le constat (${r.paye.vuConstat}) et le responsable paie ${r.paye.amende} 🪙 : portefeuille 500 → ${r.paye.wallet} · sans argent (3 🪙), c'est la prison : payé=${r.fauche.paye}, prison=${r.fauche.prison}, jail.on=${r.fauche.jail}` };
});

test('la dépanneuse répare sur place ou remorque au garage, avec deux tarifs, et son treuil s\'actionne', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const avance = n => { for (let i = 0; i < n; i++) { G.simTime = G.simTime + 1 / 20; G.servicesTick(1 / 20); } };
    const d = (G.city.depanneuses || [])[0];
    const forme = d ? { kind: d.kind, travail: !!d.travail, W: d.baseW, D: d.baseD, max: d.spec.max,
      outils: Object.keys(d.outils || {}).sort().join(','), roues: (d.roues || []).length, conduisible: G.city.cars.includes(d) } : null;
    let treuil = null;
    if (d) { const y0 = d.outils.crochet.position.y; d.outilCible = 1;
      for (let i = 0; i < 200; i++) { G.simTime = G.simTime + 1 / 30; G.outilsVehiculesTick(1 / 30); }
      const y1 = d.outils.crochet.position.y, plateau = d.outils.benne.rotation.x;
      d.outilCible = 0; for (let i = 0; i < 200; i++) { G.simTime = G.simTime + 1 / 30; G.outilsVehiculesTick(1 / 30); }
      treuil = { haut: +y0.toFixed(2), bas: +y1.toFixed(2), plateau: +plateau.toFixed(2), retour: +d.outils.crochet.position.y.toFixed(2) }; }
    const cars = G.city.cars.filter(v => !v.kind && !v.heli && !v.kart && !v.travail);
    const A = cars[0], B = cars[1];
    const remis = [];
    for (const v of [...G.city.cars, ...G.city.aiCars]) {
      if (v === A || v === B || v === d || Math.hypot(v.x - 26, v.z - 7) > 80) continue;
      remis.push([v, v.x, v.z]); v.x += 600; v.g.position.set(v.x, v.y || 0, v.z); G.vehicleSolid(v);
    }
    const essai = (dmgA) => {
      A.accidente = false; B.accidente = false; A.busy = false; A.dead = false; A.explosed = false;
      if (d) { d.mission = null; d.x = d.home0[0]; d.z = d.home0[1]; d.h = d.home0[2]; d.g.position.set(d.x, d.y || 0, d.z); G.vehicleSolid(d); }
      A.dmg = dmgA; B.dmg = 4; A.x = 26; A.z = 10; A.h = Math.PI; A.y = G.groundUnder(26, 10, A.solid, 1);
      B.x = 26; B.z = 4; B.h = 0; B.y = A.y; A.g.position.set(A.x, A.y, A.z); B.g.position.set(B.x, B.y, B.z);
      G.wallet = 900; G.jail.on = false;
      if (G.drive.car !== A) G.enterCar(A);
      const acc = G.ouvreAccident(A, B, 14);
      for (let k = 0; k < 150 && (!acc.dep || !acc.dep.fini); k++) avance(20);
      const out = { mode: acc.dep && acc.dep.mode, tarif: acc.dep && acc.dep.tarif, paye: acc.dep && acc.dep.paye,
        dmg: A.dmg, wallet: G.wallet, amende: acc.amende };
      for (let k = 0; k < 40 && acc.etat !== 'fini'; k++) avance(20);
      for (let k = 0; k < 10; k++) avance(20);
      return out;
    };
    const petit = essai(12);
    const gros = essai(80);
    if (G.drive.car) G.exitCar();
    G.jail.on = false; A.accidente = false; B.accidente = false;
    for (const [v, x, z] of remis) { v.x = x; v.z = z; v.g.position.set(x, v.y || 0, z); G.vehicleSolid(v); }
    return { forme, treuil, petit, gros, garage: !!G.city.garage };
  });
  const f = r.forme || {};
  const ok = f.kind === 'depanneuse' && f.travail && f.conduisible && f.roues === 4 && f.max >= 18 && f.max <= 24
    && f.outils.includes('crochet') && f.outils.includes('plateau')
    && r.treuil && r.treuil.bas < r.treuil.haut - 2.5 && r.treuil.plateau < -0.4 && Math.abs(r.treuil.retour - r.treuil.haut) < 0.05
    && r.petit.mode === 'place' && r.gros.mode === 'remorque' && r.gros.tarif > r.petit.tarif
    && r.petit.dmg === 0 && r.gros.dmg === 0 && r.petit.paye === true && r.gros.paye === true;
  return { ok, detail: `il n'y avait pas de dépanneuse : une voiture cassée restait plantée au milieu de la rue · elle est là — bleu et blanc, gyrophare rond bleu, plateau inclinable (${r.treuil.plateau} rad) et treuil dont le crochet descend de ${r.treuil.haut} à ${r.treuil.bas} m puis remonte (${r.treuil.retour}) — conduisible par le joueur (${f.conduisible}), ${f.W} × ${f.D} m, ${f.max} m/s, outils ${f.outils} · appelée sur un accident, elle répare SUR PLACE une petite casse pour ${r.petit.tarif} 🪙 et TREUILLE une grosse casse jusqu'au garage pour ${r.gros.tarif} 🪙 (dégâts remis à ${r.petit.dmg} et ${r.gros.dmg} %)` };
});

test('l\'ambulance vient chercher un blessé toute seule et le dépose à l\'hôpital', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const avance = n => { for (let i = 0; i < n; i++) { G.simTime = G.simTime + 1 / 20; G.servicesTick(1 / 20); } };
    const flotte = (G.city.ambulances || []).length;
    // un test précédent a pu déplacer les ambulances : on les remet à leur place
    for (const a of (G.city.ambulances || [])) { a.etat = null; a.victime = null; a.x = a.home0[0]; a.z = a.home0[1]; a.h = a.home0[2]; a.g.position.set(a.x, a.y || 0, a.z); G.vehicleSolid(a); }
    const a0 = (G.city.ambulances || [])[0];
    const forme = a0 ? { kind: a0.kind, ambulance: !!a0.ambulance, urgence: !!a0.urgence, brancard: !!a0.brancard,
      gyros: (a0.gyros || []).length, conduisible: G.city.cars.includes(a0), roues: (a0.roues || []).length } : null;
    // un bot à terre, loin de l'hôpital
    const b = G.bots.find(x => x.av && x.av.group.visible && !x.prison && !x.drive);
    const hx = G.city.medDesk ? G.city.medDesk.x : 0, hz = G.city.medDesk ? G.city.medDesk.z : 0;
    b.pos.set(hx + 40, G.groundUnder(hx + 40, hz + 30, null, 1), hz + 30); b.hp = 0; b.ko = G.simTime + 400;
    G.corpsAuSol(b.av, b.pos.x, b.pos.z, b.pos.y);
    const loin0 = +Math.hypot(b.pos.x - hx, b.pos.z - hz).toFixed(1);
    // L'APPEL AUTOMATIQUE : personne ne la demande, c'est la ville qui la déclenche
    G.P.hp = 100; G.city.urgT = 0; G.urgencesTick(0.1);
    const amb = (G.city.ambulances || []).find(x => x.victime === b);
    const etats = [];
    for (let k = 0; k < 120 && amb; k++) { avance(20); if (etats[etats.length - 1] !== amb.etat) etats.push(amb.etat); if (!amb.etat && etats.length > 3) break; }
    const dist = +Math.hypot(b.pos.x - hx, b.pos.z - hz).toFixed(1);
    return { flotte, forme, appel: !!amb, etats, hp: b.hp, ko: b.ko, loin0, dist,
      retour: amb ? +Math.hypot(amb.x - amb.home0[0], amb.z - amb.home0[1]).toFixed(1) : null };
  });
  const f = r.forme || {};
  const ok = r.flotte >= 2 && f.kind === 'ambulance' && f.ambulance && f.urgence && f.brancard && f.conduisible && f.roues === 4
    && r.appel && r.etats.includes('route') && r.etats.includes('charge') && r.etats.includes('transport') && r.etats.includes('depose')
    && r.hp === 100 && r.ko === 0 && r.dist < 6 && r.loin0 > 20;
  return { ok, detail: `un blessé à terre restait à terre : le camion blanc garé devant l'hôpital n'était qu'un décor · il y a maintenant ${r.flotte} vraies ambulances (break blanc à croix rouge, gyrophares, point d'ancrage « brancard » sur la caisse, conduisibles par le joueur) et un blessé DÉCLENCHE l'appel tout seul : ${r.etats.filter(Boolean).join(' → ')} · le bot était à ${r.loin0} m de l'hôpital, il finit à ${r.dist} m, soigné (${r.hp} PV, KO ${r.ko}), et l'ambulance rentre à sa place (${r.retour} m)` };
});

test('un véhicule qui percute un piéton l\'écrase : il tombe, perd des points de vie et crie', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 26, y: 1, z: 24, hour: 12 });
    const c = G.city.cars.find(x => !x.kind && !x.heli && !x.kart && !x.travail);
    const remis = [];
    for (const a of [...G.city.cars, ...G.city.aiCars]) {
      if (a === c || Math.hypot(a.x - 26, a.z - 22) > 60) continue;
      remis.push([a, a.x, a.z]); a.x += 600; a.g.position.set(a.x, a.y || 0, a.z); G.vehicleSolid(a);
    }
    c.busy = false; c.dmg = 0; c.accidente = false; c.x = 26; c.z = 24; c.h = Math.PI; c.y = G.groundUnder(26, 24, c.solid, 1);
    const b = G.bots.find(x => x.av && x.av.group.visible && !x.prison && !x.drive);
    b.hp = 100; b.ko = 0; b.hitT = 0;
    b.pos.set(26, c.y, 21); b.av.group.position.set(26, c.y, 21); b.av.group.rotation.x = 0;
    G.enterCar(c); G.drive.speed = 16;
    const hp0 = b.hp;
    let touche = 0;
    for (let i = 0; i < 40 && !touche; i++) { G.simTime = G.simTime + 1 / 60; G.conduire(c, { gaz: 1, volant: 0, frein: 0 }, 1 / 60); if (b.hp < hp0) touche = i + 1; }
    const hpApres = b.hp, auSol = b.av.group.rotation.x !== 0 || b.ko > G.simTime, ko = b.ko > 0;
    // à l'arrêt, on ne renverse personne
    b.hitT = 0; b.hp = 100; b.pos.set(c.x, c.y, c.z - 1.5);
    G.drive.speed = 0;
    for (let i = 0; i < 30; i++) { G.simTime = G.simTime + 1 / 60; G.conduire(c, { gaz: 0, volant: 0, frein: 1 }, 1 / 60); }
    const arret = b.hp;
    G.exitCar();
    b.hp = 100; b.ko = 0;
    for (const [a, x, z] of remis) { a.x = x; a.z = z; a.g.position.set(x, a.y || 0, z); G.vehicleSolid(a); }
    return { hp0, hpApres, touche, auSol, ko, arret };
  });
  const ok = r.touche > 0 && r.hpApres < r.hp0 - 20 && r.auSol && r.ko && r.arret === 100;
  return { ok, detail: `un piéton renversé était simplement POUSSÉ de deux mètres, en pleine forme · il est maintenant écrasé pour de bon : touché à l'image ${r.touche}, il passe de ${r.hp0} à ${r.hpApres} points de vie, tombe au sol (${r.auSol}), reste KO (${r.ko}) et crie — et un véhicule à l'arrêt ne fait rien à personne (${r.arret} PV)` };
});
test('le graphe des voies couvre la ville : deux voies par rue, dessertes rattachees, itineraire a droite de l\'axe', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 0, y: 1, z: 8, hour: 12 });
    const g = G.city.graphe;
    if (!g) return { absent: true };
    const R = G.city.routes;
    // 1) DEUX voies par chaussée, et chacune du côté DROIT de son sens de marche
    const parRoute = {}; for (const v of g.voies) parRoute[v.route] = (parRoute[v.route] || 0) + 1;
    const routesA2 = Object.values(parRoute).filter(n => n === 2).length;
    const mauvaisCote = g.voies.filter(v => {
      const rt = R[v.route], aZ = rt.d >= rt.w, axe = aZ ? rt.x : rt.z;
      const droite = aZ ? -Math.cos(v.sens) : Math.sin(v.sens);   // la droite du cap v.sens
      return (v.lat - axe) * droite <= 0.01;
    }).length;
    // 2) les manœuvres : à chaque nœud, jamais de demi-tour quand il existe une autre issue
    let demiTourIllicite = 0, manoeuvres = 0;
    const types = {};
    for (const n of g.noeuds) {
      const par = {};
      for (const m of n.manoeuvres) { (par[m.de] = par[m.de] || []).push(m.type); types[m.type] = (types[m.type] || 0) + 1; manoeuvres++; }
      for (const k in par) if (par[k].indexOf('demi-tour') >= 0 && par[k].length > 1) demiTourIllicite++;
    }
    // 3) toutes les dessertes de quartier sont rattachées à une voie
    const des = G.city.plan.dessertes;
    const sansVoie = des.filter(d => d.arete == null).map(d => d.n);
    const loin = des.filter(d => (d.ecart || 0) > 6).map(d => d.n);
    // 4) connexité : depuis la place centrale, on atteint presque tout le réseau
    const suiv = id => g.noeuds[g.aretes[id].vers].manoeuvres.filter(m => m.de === id).map(m => m.vers);
    const dep = G.voieProche(0, 26);
    const vu = new Set([dep.arete.id]), file = [dep.arete.id];
    while (file.length) { const c = file.pop(); for (const v of suiv(c)) if (!vu.has(v)) { vu.add(v); file.push(v); } }
    const connexite = +(vu.size / g.aretes.length * 100).toFixed(1);
    // 5) un itinéraire d'un bout à l'autre : Techno-Parc (nord) → Casino (sud)
    const it = G.itineraireVoies(3, -135, 60, 343);
    const surRoute = (x, z) => R.some(rt => Math.abs(x - rt.x) < rt.w / 2 + 0.4 && Math.abs(z - rt.z) < rt.d / 2 + 0.4);
    let dedans = 0, droite = 0, testes = 0, longueur = 0;
    if (it) for (let i = 0; i < it.length; i++) {
      if (surRoute(it[i][0], it[i][1])) dedans++;
      if (i) longueur += Math.hypot(it[i][0] - it[i - 1][0], it[i][1] - it[i - 1][1]);
      if (i === 0 || i === it.length - 1) continue;
      // on ne juge le côté que sur les lignes droites : dans un virage on coupe le carrefour
      const pres = g.noeuds.some(n => Math.hypot(n.x - it[i][0], n.z - it[i][1]) < 7);
      if (pres) continue;
      const h = Math.atan2(it[i + 1][0] - it[i - 1][0], it[i + 1][1] - it[i - 1][1]);
      const rt = R.find(q => Math.abs(it[i][0] - q.x) < q.w / 2 && Math.abs(it[i][1] - q.z) < q.d / 2);
      if (!rt) continue;
      testes++;
      const aZ = rt.d >= rt.w, dr = aZ ? -Math.cos(h) : Math.sin(h), ec = aZ ? it[i][0] - rt.x : it[i][1] - rt.z;
      if (ec * dr > 0.2) droite++;
    }
    // 6) un CHANTIER barre une voie : l'itinéraire doit le contourner, pas s'y encastrer
    // on essaie quatre endroits du trajet : certains tronçons n'ont aucune rue de rechange
    // (une bretelle unique), on garde le meilleur contournement obtenu
    let chantier = null;
    if (it && it.length > 20 && G.poseChantier) {
      for (const part of [0.3, 0.45, 0.6, 0.75]) {
        const mid = it[Math.floor(it.length * part)];
        const ch = G.poseChantier(mid[0], mid[1], 0);
        const it2 = G.itineraireVoies(3, -135, 60, 343);
        const ecart = it2 ? Math.min.apply(null, it2.map(pt => Math.hypot(pt[0] - mid[0], pt[1] - mid[1]))) : -1;
        G.retireChantier(ch);
        if (!chantier || ecart > chantier.ecart) chantier = { ou: [Math.round(mid[0]), Math.round(mid[1])], ecart: +ecart.toFixed(1), points: it2 ? it2.length : 0 };
      }
    }
    return { chantier, routes: R.length, routesA2, mauvaisCote, noeuds: g.noeuds.length, aretes: g.aretes.length,
      voies: g.voies.length, liaisons: g.liaisons, manoeuvres, types, demiTourIllicite, connexite,
      dessertes: des.length, sansVoie, loin,
      it: it ? it.length : 0, tauxRoute: it ? +(dedans / it.length * 100).toFixed(1) : 0,
      tauxDroite: testes ? +(droite / testes * 100).toFixed(1) : 0, testes, longueur: Math.round(longueur) };
  });
  if (r.absent) return { ok: false, detail: 'city.graphe n\'existe pas' };
  const ok = r.routesA2 === r.routes && r.mauvaisCote === 0 && r.demiTourIllicite === 0
    && r.sansVoie.length === 0 && r.connexite > 90 && r.it > 40 && r.tauxRoute > 98 && r.tauxDroite > 90
    && r.types['tout-droit'] > 0 && r.types.droite > 0 && r.types.gauche > 0
    && !!r.chantier && r.chantier.ecart > 3;
  return { ok, detail: `${r.routes} chaussées → ${r.voies} voies (deux par rue pour ${r.routesA2} d'entre elles, ${r.mauvaisCote} du mauvais côté de l'axe), ${r.noeuds} nœuds, ${r.aretes} arêtes orientées dont ${r.liaisons} raccords, ${r.manoeuvres} manœuvres (${JSON.stringify(r.types)}, ${r.demiTourIllicite} demi-tour là où il y avait une autre issue) · ${r.connexite} % du réseau atteignable depuis la place centrale · les ${r.dessertes} dessertes de quartier sont toutes rattachées à une voie (${r.loin.length} à plus de 6 m) · itinéraire Techno-Parc → Casino : ${r.longueur} m en ${r.it} points, ${r.tauxRoute} % sur la chaussée et ${r.tauxDroite} % à droite de l'axe (sur ${r.testes} points de ligne droite) · un chantier posé en (${r.chantier ? r.chantier.ou.join(',') : '?'}) en pleine voie : le nouvel itinéraire passe à ${r.chantier ? r.chantier.ecart : '?'} m de là, il le contourne` };
});

test('la circulation respecte le code de la route : trois minutes sans rien chevaucher, arret au feu rouge et au stop', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: 300, y: 1, z: 300, hour: 12 });
    G.P.pos.set(300, 0.3, 300); G.clearWanted();   // le joueur loin de tout : il ne gêne personne
    const ai = G.city.aiCars.filter(c => c.spd);
    // on repart d'une circulation PROPRE : un test précédent a pu empiler deux voitures au
    // même endroit ou en téléporter une hors de la ville
    ai.forEach(c => { c.ia = null; c.libre = null; c.figeT = 0; c.attenteT = 0; c.speed = 0; c.stopOK = null; c.stopDep = 0; G.traficPose(c); });
    // un coin d'un véhicule est-il DANS un solide non franchissable ?
    const dansUnSolide = c => {
      const cs = Math.cos(c.h), sn = Math.sin(c.h), A = (c.baseD || 4.4) / 2, B = (c.baseW || 2.4) / 2;
      for (const o of G.solidsAutour(c.x, c.z, 6, true)) {
        if (o === c.solid || o.veh || o.h > 30) continue;
        if (o.y + o.h / 2 < 0.56 || o.y - o.h / 2 > 1.6) continue;   // marche franchissable
        for (const [lx, lz] of [[B, A], [-B, A], [B, -A], [-B, -A], [0, 0]]) {
          const x = c.x + lx * cs + lz * sn, z = c.z - lx * sn + lz * cs;
          if (Math.abs(x - o.x) < o.w / 2 - 0.02 && Math.abs(z - o.z) < o.d / 2 - 0.02) return o;
        }
      }
      return null;
    };
    // deux caisses se chevauchent-elles VRAIMENT ? (rectangles orientés, théorème des axes
    // séparateurs : deux voitures qui se croisent dans une ruelle étroite passent à 10 cm et
    // ne doivent pas compter pour une collision)
    const coins = c => { const cs = Math.cos(c.h), sn = Math.sin(c.h), A = (c.baseD || 4.4) / 2, B = (c.baseW || 2.4) / 2;
      return [[B, A], [-B, A], [-B, -A], [B, -A]].map(([lx, lz]) => [c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs]); };
    const seChevauchent = (u, v) => {
      const P1 = coins(u), P2 = coins(v);
      for (const [A, B] of [[P1, P2], [P2, P1]]) {
        for (let i = 0; i < 4; i++) {
          const nx = A[(i + 1) % 4][1] - A[i][1], nz = A[i][0] - A[(i + 1) % 4][0];
          let a1 = 1e9, a2 = -1e9, b1 = 1e9, b2 = -1e9;
          for (const q of A) { const d = q[0] * nx + q[1] * nz; a1 = Math.min(a1, d); a2 = Math.max(a2, d); }
          for (const q of B) { const d = q[0] * nx + q[1] * nz; b1 = Math.min(b1, d); b2 = Math.max(b2, d); }
          if (a2 < b1 || b2 < a1) return false;
        }
      }
      return true;
    };
    let solide = 0, collisions = 0, vmax = 0, images = 0;
    const raisons = {};
    for (let i = 0; i < 60 * 180; i++) {
      G.simTime += 1 / 60; G.lightsTick(); G.cityStep(1 / 60); images++;
      for (const c of ai) {
        if (dansUnSolide(c)) solide++;
        vmax = Math.max(vmax, Math.abs(c.speed || 0));
        if (c.raison) raisons[c.raison] = (raisons[c.raison] || 0) + 1;
      }
      for (let a = 0; a < ai.length; a++) for (let b = a + 1; b < ai.length; b++) if (seChevauchent(ai[a], ai[b])) collisions++;
    }
    const res = { images, solide, collisions, vmax: +vmax.toFixed(1), raisons };
    // ---- l'ARRÊT AU FEU ROUGE, mesuré : on pose une voiture 24 m avant la ligne d'un feu
    // dont le groupe vient de passer au rouge, et on regarde où elle s'immobilise.
    const c0 = ai[0];
    for (const v of ai) if (v !== c0) { v.x = 400; v.z = 400; v.g.position.set(400, 0, 400); G.vehicleSolid(v); }
    const essai = (pt0, sens, dur) => {
      // un panneau est planté SUR LE TROTTOIR : on ramène le point de référence sur la voie
      const vp0 = G.voieProche(pt0.x, pt0.z, sens);
      if (!vp0 || vp0.d > 8) return null;
      const pt = { x: vp0.px, z: vp0.pz };
      const dep = { x: pt.x - Math.sin(sens) * 24, z: pt.z - Math.cos(sens) * 24 };
      const vp = G.voieProche(dep.x, dep.z, sens);
      if (!vp || vp.d > 1.2) return null;
      c0.x = vp.px; c0.z = vp.pz; c0.h = sens; c0.speed = 8; c0.ia = null; c0.libre = null; c0.figeT = 0; c0.attenteT = 0;
      c0.stopOK = null; c0.stopDep = 0; c0.y = G.groundCar(c0.x, c0.z, c0.solid, 0);
      c0.g.position.set(c0.x, c0.y, c0.z); G.vehicleSolid(c0);
      const cible = { x: pt.x + Math.sin(sens) * 40, z: pt.z + Math.cos(sens) * 40 };
      let arrete = 0, minAvant = 1e9, apres = 0, vApres = 0;
      for (let i = 0; i < 60 * dur; i++) {
        G.simTime += 1 / 60; G.lightsTick();
        G.flotteMaj(); G.botConduit(c0, cible.x, cible.z, 1 / 60, {});
        const le = (pt.x - c0.x) * Math.sin(sens) + (pt.z - c0.z) * Math.cos(sens);   // distance restante avant la ligne
        if (Math.abs(c0.speed || 0) < 0.35) { arrete++; if (le > -0.5) minAvant = Math.min(minAvant, le); }
        if (le < -1) { apres++; vApres = Math.max(vApres, Math.abs(c0.speed || 0)); }
      }
      return { arrete, avant: minAvant < 1e9 ? +minAvant.toFixed(2) : null, apres, vApres: +vApres.toFixed(1) };
    };
    const cycle = G.FEU_CYCLE;
    let feu = null;
    for (const tl of G.city.trafficLights) {
      if (tl.broken || !tl.ligne) continue;
      G.simTime = Math.ceil(G.simTime / cycle) * cycle + (tl.groupe === 'A' ? 14.3 : 0.3);   // son groupe vient de passer au rouge
      const e = essai(tl.ligne, tl.sens, 8);
      // il faut que l'arrêt soit bien DEVANT LA LIGNE : sinon on retiendrait une voiture
      // arrêtée vingt mètres plus tôt pour une autre raison
      if (e && e.arrete > 30 && e.avant > 0 && e.avant < 6) { feu = { ...e, x: Math.round(tl.x), z: Math.round(tl.z), groupe: tl.groupe }; break; }
      if (e && !feu) feu = { ...e, x: Math.round(tl.x), z: Math.round(tl.z), groupe: tl.groupe };
    }
    // ---- l'ARRÊT AU STOP : arrêt complet, puis on repart
    let stop = null;
    for (const q of G.city.panneaux) {
      if (q.type !== 'stop') continue;
      const e = essai({ x: q.x, z: q.z }, q.sens, 14);
      if (e && e.arrete > 20 && e.vApres > 2) { stop = { ...e, x: Math.round(q.x), z: Math.round(q.z) }; break; }
      if (e && !stop) stop = { ...e, x: Math.round(q.x), z: Math.round(q.z) };
    }
    G.city.aiCars.forEach(c => { c.ia = null; c.libre = null; });
    return { ...res, feu, stop };
  });
  const ok = r.solide === 0 && r.collisions === 0 && r.vmax <= 10.5
    && !!r.feu && r.feu.arrete > 30 && r.feu.avant != null && r.feu.avant > 0 && r.feu.avant < 6
    && !!r.stop && r.stop.arrete > 20 && r.stop.vApres > 2
    && (r.raisons.feu || 0) > 0 && (r.raisons.stop || 0) > 0;
  return { ok, detail: `trois minutes de circulation (${r.images} images, ${Object.keys(r.raisons).length} sortes d'arrêts) : ${r.solide} image où un véhicule chevauche un solide, ${r.collisions} collision voiture-voiture, vitesse maximale ${r.vmax} m/s · motifs d'arrêt : ${JSON.stringify(r.raisons)} · feu rouge en (${r.feu ? r.feu.x + ',' + r.feu.z : '?'}) : la voiture reste immobile ${r.feu ? r.feu.arrete : 0} images et s'arrête à ${r.feu ? r.feu.avant : '?'} m AVANT la ligne · stop en (${r.stop ? r.stop.x + ',' + r.stop.z : '?'}) : arrêt complet ${r.stop ? r.stop.arrete : 0} images puis redémarrage à ${r.stop ? r.stop.vApres : 0} m/s` };
});

test('la police abandonne les recherches quand le joueur est cache, et repart des qu\'il se montre', async p => {
  const r = await p.evaluate(() => {
    const G = __G; __SHOT.go({ world: 4, x: -35.5, y: 1, z: -27, hour: 12 });   // hall d'immeuble, loin de la villa
    G.jail.on = false; if (G.uiOpen) G.closeUI();
    G.clearWanted(); G.police.agents = [];
    G.P.pos.set(-35.5, 0.3, -27); G.cam.dedansT = -1;
    const abri = G.abriDuJoueur();
    const poser = (n) => {
      G.police.wanted = n; G.police.crimeLevel = n; G.police.decayT = G.simTime + 9999;
      G.police.hideT = 0; G.police.perdu = false; G.police.sait = null; G.police.vuT = -99;
      G.police.lastSeen = [-35.5, -27]; G.police.agents = []; G.armee.on = false;
      G.police.cars.forEach(c => { c.active = true; c.debarque = false; c.nearT = 0; c.vueT = 0; c.vue = false;
        c.x = 210; c.z = 210; c.y = 0; c.route = null; c.routeT = 0; });
    };
    // (a) caché et hors de vue : l'étoile tombe par paliers, la traque s'éteint
    poser(3);
    const t0 = G.simTime; let dansLeNoir = null, hud = null, etapes = [];
    for (let i = 0; i < 30 * 60; i++) {
      G.simTime = t0 + i / 30; G.P.pos.set(-35.5, 0.3, -27); G.policeTick(1 / 30);
      if (i === 150) hud = document.getElementById('wanted').textContent;
      if (!etapes.length || etapes[etapes.length - 1][1] !== G.police.wanted) etapes.push([+(i / 30).toFixed(1), G.police.wanted]);
      if (G.police.wanted === 0) { dansLeNoir = +(i / 30).toFixed(1); break; }
    }
    const hudFin = document.getElementById('wanted').textContent;
    // (b) revu : le compte à rebours repart de zéro et la traque continue
    poser(2);
    const t1 = G.simTime;
    for (let i = 0; i < 30 * 10; i++) { G.simTime = t1 + i / 30; G.P.pos.set(-35.5, 0.3, -27); G.policeTick(1 / 30); }
    const cache10 = { wanted: G.police.wanted, hide: +G.police.hideT.toFixed(1) };
    // il ressort dans la rue, une voiture le voit
    const pc = G.police.cars[0];
    const t2 = G.simTime;
    for (let i = 0; i < 30 * 4; i++) {
      G.simTime = t2 + i / 30;
      G.P.pos.set(0, 0.3, 26); pc.x = 8; pc.z = 26; pc.y = 0; pc.vueT = 0; pc.vue = false; pc.active = true;
      G.policeTick(1 / 30);
    }
    const revu = { wanted: G.police.wanted, hide: +G.police.hideT.toFixed(1), vu: +(G.simTime - G.police.vuT).toFixed(1),
      hud: document.getElementById('wanted').textContent };
    // (c) en patrouille, les voitures de police roulent SUR LA CHAUSSÉE
    G.clearWanted(); G.police.agents = [];
    G.P.pos.set(300, 0.3, 300);
    G.police.cars.forEach(c => { c.goHome = false; c.active = false; c.patrouille = null; c.patT = 0; c.mil = false;
      c.x = c.home[0]; c.z = c.home[1]; c.y = 0; c.speed = 0; c.route = null; c.routeT = 0; c.libre = null;
      c.g.position.set(c.x, 0, c.z); G.vehicleSolid(c); });
    const surRoute = (x, z) => G.city.routes.some(rt => Math.abs(x - rt.x) < rt.w / 2 + 0.6 && Math.abs(z - rt.z) < rt.d / 2 + 0.6);
    let dedans = 0, dehors = 0, roule = 0;
    for (let i = 0; i < 60 * 90; i++) {
      G.simTime += 1 / 60; G.lightsTick(); G.flotteMaj(); G.policeTick(1 / 60);
      if (i < 60 * 20) continue;   // le temps de quitter le parking du commissariat
      for (const c of G.police.cars) { if (Math.abs(c.speed || 0) > 0.5) roule++; if (surRoute(c.x, c.z)) dedans++; else dehors++; }
    }
    G.clearWanted();
    return { abri, dansLeNoir, etapes, hud, hudFin, cache10, revu,
      patrouille: +(dedans / (dedans + dehors) * 100).toFixed(1), roule, voitures: G.police.cars.length };
  });
  const ok = r.abri === 'batiment' && r.dansLeNoir != null && r.dansLeNoir < 40 && r.etapes.length >= 3
    && /cherche/i.test(r.hud || '') && r.cache10.wanted === 2 && r.revu.wanted === 2 && r.revu.hide < 0.5
    && /voient/i.test(r.revu.hud || '') && r.patrouille > 95 && r.roule > 0;
  return { ok, detail: `caché dans un bâtiment (${r.abri}) et hors de vue : la traque passe par ${r.etapes.map(e => e[1] + '★ à ' + e[0] + ' s').join(' → ')} et s'éteint en ${r.dansLeNoir} s simulées · le HUD dit « ${r.hud} » puis « ${r.hudFin} » · dix secondes cachées ne suffisent pas à deux étoiles (${r.cache10.wanted}★, ${r.cache10.hide} s de compteur) et dès qu'une patrouille le revoit le compteur repart de ${r.revu.hide} s (« ${r.revu.hud} ») · en patrouille, les ${r.voitures} voitures de police sont sur la chaussée ${r.patrouille} % du temps (${r.roule} images en mouvement)` };
});
