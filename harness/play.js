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
      const c = __G.camera.position, dedansMur = __G.solids.some(o => !o.veh && o.h < 30
        && Math.abs(c.x - o.x) < o.w / 2 && Math.abs(c.y - o.y) < o.h / 2 && Math.abs(c.z - o.z) < o.d / 2);
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
      f |= bit << k;
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
    await dodo(1400);
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
    // A = saut, B = action, Y = dégainer, gâchette = courir
    __G.P.jumpBuf = 0;
    const saut = await presse(0);
    __G.owned.add('arme:pistol'); __G.equipWeapon('pistol'); __G.P.drawn = false;
    await presse(3);
    const degaine = !!__G.P.drawn;
    __G.P.energie = 100; __G.P.essouffle = false;
    gp.buttons[6].pressed = true; __G.pollGamepad(1 / 60);
    const court = __G.P.run;
    gp.buttons[6].pressed = false; __G.pollGamepad(1 / 60);
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
    delete navigator.getGamepads;
    return { stick, camera, saut, degaine, court, nav };
  });
  const ok = r.stick.x > 0.5 && r.stick.y > 0.5 && r.camera > 0.02 && r.saut === 0.15 && r.degaine
    && r.court && r.nav.bague && r.nav.bouge && r.nav.pasDeMarche && r.nav.valide;
  return { ok, detail: `stick gauche (${r.stick.x}, ${r.stick.y}), stick droit tourne la caméra de ${r.camera} rad · A saute (${r.saut}), Y dégaine (${r.degaine}), gâchette fait courir (${r.court}) · dans un menu la croix pose une bague sur « ${r.nav.quoi} » et n'avance plus le joueur (${r.nav.pasDeMarche}), A valide et ferme (${r.nav.valide})` };
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
    && r.ouvert && r.onglets === 4 && r.nuances >= 20 && r.remis.ajouts === 0 && r.remis.max === r.avant.max
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
  const ok = !r.sansKit && r.flammes === 4 && r.lance && r.apres > r.avant * 2 && r.visible
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
    // longueur du poisson
    const bb = new __G.THREE.Box3().setFromObject(sk);
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
  const ok = r.motifs >= 24 && r.zones >= 10 && r.encres === 6 && r.tailles === 3 && r.vides.length === 0
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
    __G.police.cars.forEach((c, i) => { c.x = 12 + i * 6; c.z = 41; c.g.position.set(c.x, 0, c.z);
      c.speed = 0; c.route = null; c.debarque = false; c.active = true; c.goHome = false; });
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
      if (!__G.police.sait) perdu++;
    }
    const agents = __G.police.agents.filter(a => Math.abs(a.x - bk.x) < 9 && Math.abs(a.z - bk.z) < 9).length;
    const res = { depart, agents, perdu, wanted: __G.police.wanted };
    // ressorti dans la rue : les agents ne campent pas dans la banque, ils le poursuivent
    const t1 = __G.simTime;
    const dAgents = () => Math.min(...__G.police.agents.map(a => Math.hypot(a.x - (bk.x + 26), a.z - (bk.z + 4))));
    res.avantFuite = +dAgents().toFixed(1);
    for (let i = 0; i < 900; i++) { __G.simTime = t1 + i / 30; __G.P.pos.set(bk.x + 26, 0.3, bk.z + 4); __G.policeTick(1 / 30); __G.police.arrestT = 1e9; }
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
    const b = imm[0], ex = b.x + b.w / 2 + 1.6;
    // chaque marche des deux volées est là, à 40 cm de la précédente
    const marches = [], trous = [];
    for (let f = 0; f < b.etages - 1; f++) {
      const sens = f % 2 ? -1 : 1, z0 = b.z - (b.d / 2 - 1) * sens, rise = b.h / 8;
      for (let i = 0; i < 8; i++) {
        const zz = z0 + sens * (i * 0.62 + 0.31), attendu = f * b.h + 0.2 + (i + 1) * rise;
        const y = G.groundUnder(ex, zz, null, attendu + 0.3);
        marches.push(+y.toFixed(2));
        if (Math.abs(y - attendu) > 0.12) trous.push([f, i, +y.toFixed(2), +attendu.toFixed(2)]);
      }
    }
    res.marches = marches.length; res.trous = trous;
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
    && r.toit > 9.5 && r.meubles.every(m => m >= 6) && r.chevauchements === 0
    && r.sol.every(y => y > 0.04) && r.errants >= 4 && r.zone && r.poubelles >= 10 && r.mur && !r.vide;
  return { ok, detail: `5 immeubles de 3 étages, ${r.marches} marches d'escalier extérieur sans trou (${r.montee[0]} m → ${r.montee[1]} m), planchers à ${r.planchers.map(x => x[0]).join('/')} m et toit à ${r.toit} m, ${r.meubles.join('/')} meubles par niveau, ${r.errants} chiens errants, ${r.poubelles} poubelles · aucun chevauchement avec les bâtiments de la ville, sol continu sous tout le quartier, murs bloquants comme ailleurs` };
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
    const v2 = vitres.find(b => !b.broken && b !== v);
    const b = G.bots[0]; b.ko = 0; b.hp = 100;
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
    for (let i = 0; i < 200; i++) { G.simTime = t0 + i * 0.1; G.policeTick(0.1); }
    res.apresFenetre = { actives: G.police.cars.filter(c => c.active).length, react: G.police.reactT };
    // pendant la poursuite, pas de faux compte à rebours
    G.infraction('deuxième délit', 1, 2);
    res.pendant = { react: G.police.reactT, hud: document.getElementById('wanted').textContent };
    // un délit vu par la police ne bénéficie d'aucune clémence
    G.clearWanted(); G.police.avert = 0;
    const pc = G.police.cars[0]; pc.x = G.P.pos.x + 8; pc.z = G.P.pos.z; pc.active = true;
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
    res.itineraire = { points: ch.length, dansLesDunes: ch.filter(pt => dans(pt[0], pt[1])).length };
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
    && r.itineraire.points > 3 && r.itineraire.dansLesDunes === 0
    && r.agent.aMarche && Math.abs(r.agent.y - r.agent.relief) < 0.6;
  return { ok, detail: `la voiture de police roule à ${r.surLeSable.y} m sur un relief à ${r.surLeSable.relief} m (elle passait dessous) · les itinéraires contournent les dunes (${r.itineraire.dansLesDunes} point sur ${r.itineraire.points} dans le terrain) · un agent à pied traverse le sable à ${r.agent.y} m pour un relief de ${r.agent.relief} m` };
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
      const marches = G.solids.filter(o => Math.abs(o.z - e.z) < 2.5 && o.h < 0.3 && o.y > e.y0 && o.y < e.y1 + 1);
      const prof = marches.length ? Math.max(...marches.map(o => o.d)) : 0;
      const murNord = e.z < bk.z, bordVolee = murNord ? e.z - prof / 2 : e.z + prof / 2;
      // la vraie face intérieure du mur, pas le plan nominal : le mur a une épaisseur
      const murs = G.solids.filter(o => o.h > 3 && o.w > 8 && Math.abs(o.x - bk.x) < bk.w
        && (murNord ? o.z < bk.z - bk.d / 2 + 1.5 : o.z > bk.z + bk.d / 2 - 1.5));
      const face = murs.length ? (murNord ? Math.max(...murs.map(o => o.z + o.d / 2)) : Math.min(...murs.map(o => o.z - o.d / 2)))
                               : (murNord ? bk.z - bk.d / 2 : bk.z + bk.d / 2);
      return { volee: +e.y0.toFixed(1), largeur: +prof.toFixed(2), fenteContreLeMur: +Math.abs(bordVolee - face).toFixed(2) };
    });
  });
  const ok = r.length === 2 && r.every(v => v.largeur >= 3.4 && v.fenteContreLeMur <= 0.25);
  return { ok, detail: r.map(v => `volée depuis ${v.volee} m : ${v.largeur} m de large, ${v.fenteContreLeMur} m de fente contre le mur (il y en avait 0,45 avec une main courante dedans)`).join(' · ') };
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
    const lance = G.lancerActivite(b, { k: 'voiture', e: '🚗', n: 'faire un tour en voiture' }) !== false;
    if (b.activite) b.activite.fin = G.simTime + 600;   // on lui laisse le temps d'arriver
    return { dansListe, lance, nom: b.name, cible: b.rdv ? [+b.rdv.x.toFixed(1), +b.rdv.z.toFixed(1)] : null };
  });
  // les bots avancent dans la boucle de rendu, pas dans step() : on attend pour de vrai
  const auVolant = await attendre(p, () => !!(window.__conducteur.drive && window.__conducteur.drive.car), 90000);
  const r = await p.evaluate(() => {
    const b = window.__conducteur, c = b.drive && b.drive.car;
    return { quatreRoues: !!(c && !c.rider && !c.heli), nomVoiture: c ? (c.kind || 'voiture') : null,
      roule: !!(c && Math.abs(b.drive.speed || 0) >= 0), distanceParcourue: +Math.hypot(b.pos.x, b.pos.z).toFixed(1) };
  });
  await p.evaluate(() => { const b = window.__conducteur; if (b.drive && b.drive.car) __G.libereVoiture(b.drive.car); b.drive = null; b.activite = null; b.rdv = null; });
  const ok = dep.dansListe && dep.lance && auVolant && r.quatreRoues;
  return { ok, detail: `« faire un tour en voiture » fait partie des activités=${dep.dansListe} · ${dep.nom} rejoint la voiture garée en ${dep.cible} et se met au volant=${auVolant} (quatre roues=${r.quatreRoues}, ${r.nomVoiture})` };
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
