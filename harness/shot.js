'use strict';
// Ouvre le jeu dans un vrai Chromium, joue quelques secondes et prend des captures.
// three.js est servi en local (le CDN n'est pas joignable depuis cet environnement).
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.join(__dirname, '..');
const OUT = process.env.SHOT_DIR || path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });

// vues : [nom, x, y, z du joueur, orientation]
const VIEWS = JSON.parse(fs.readFileSync(process.env.VUES || path.join(__dirname, 'views.json'), 'utf8'));


const HOOK = `
window.__SHOT = {
  ready: true,
  go(v) {
    // le champ de chat garde le focus d'un test a l'autre et avale alors toutes les
    // touches (le jeu ignore les keydown quand chatIn est actif) : on le relache.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    // un test precedent peut laisser le joueur au volant, assis ou une fenetre ouverte :
    // on repart d'un etat propre, sinon les touches sont ignorees.
    try {
      if (uiOpen) closeUI();
      if (typeof city !== 'undefined' && city.rideBot && typeof botDescendre === 'function') botDescendre(city.rideBot, true);
      if (drive.car) exitCar();
      P.sit = null; P.swing = null; P.ride = null; P.eat = null; P.deco = null;
      P.run = false; P.court = false; P.essouffle = false; P.energie = 100;
      if (typeof gym !== 'undefined') gym.on = null;
    } catch (e) {}
    if (v.world != null && worldIdx !== v.world) loadWorld(v.world);
    document.body.classList.remove('lobby');
    document.getElementById('start').classList.add('hidden');
    document.getElementById('worlds').classList.add('hidden');
    running = true; paused = false; dead = false;
    // Un chef de gang peut donner rendez-vous et, quand on arrive sur place, la fenetre de
    // reunion MET LE JEU EN PAUSE : tous les tests qui suivaient echouaient alors sans
    // rapport avec ce qu'ils mesuraient. On repousse les rendez-vous spontanes ; le test de
    // la guerre des gangs, lui, appelle proposeReunion() explicitement.
    try {
      if (typeof guerre !== 'undefined') { guerre.reunion = null; guerre.prochaineReunion = simTime + 1e6; }
      if (typeof gangs !== 'undefined') for (const g of gangs) g.reunionT = simTime + 1e6;
    } catch (e) {}
    // Un test precedent peut laisser un bot au volant avec le joueur en passager : la boucle
    // de rendu replace alors l'avatar SUR LE BOT, a plusieurs metres de la ou il devrait
    // etre. Idem pour un coup en preparation, une mission de gang ou un defi en cours : tout
    // cela survit a loadWorld et faussait les tests suivants.
    try {
      if (typeof bots !== 'undefined') for (const b of bots) {
        if (b.drive && b.drive.car) { try { libereVoiture(b.drive.car); } catch (e2) {} }
        b.drive = null; b.rdv = null; b.rdvRoute = null; b.ordre = null; b.gangMission = null;
        b.activite = null; b.bagarre = null; b.garde = 0; b.fight = null;
        // Un bot laisse par le test precedent avec 3 PV, KO au sol, garde du corps ou poste
        // devant la villa faussait le test suivant sans aucun rapport avec ce qu'il mesurait.
        b.hp = 100; b.ko = 0; b.mort = 0; b.robbed = false;
        b.gardeCorps = 0; b.gardeVilla = 0; b.gardeArme = 0; b.protege = null; b.soin = 0;
        b.arme = false; b.journal = null; b.sport = null;
        if (!v.garderSauvegarde) b.perf = null;   // sauf quand le test verifie que la sauvegarde rend son niveau a chacun
        if (b.av) { b.av.group.rotation.x = 0; b.av.group.visible = true; }
      }
      if (typeof gang !== 'undefined') { if (!v.garderSauvegarde) gang.membres.length = 0; gang.mission = null; gang.rates = 0; if (gang.missions) gang.missions.length = 0; }
      // les effets d'impact survivent au changement de test (ils vieillissent dans la boucle
      // de rendu, qui tourne a peine dans le banc d'essai) : on repart d'une scene propre
      if (typeof fxClear === 'function') { try { fxClear(); } catch (e7) {} }
      // la deco posee et les colis livres par un test precedent changeaient le SOL sous les
      // pieds du test suivant : on repart d'un terrain nu
      try {
        for (const d of (city.placed || [])) { if (d.g) worldGroup.remove(d.g); if (d.solid) { const i = solids.indexOf(d.solid); if (i >= 0) solids.splice(i, 1); } }
        city.placed = [];
        for (const pc of (city.parcels || [])) worldGroup.remove(pc.g);
        city.parcels = [];
        localStorage.removeItem('superobby.decor'); localStorage.removeItem('superobby.colis');
        // la voiture et l'equipe rechargees par la sauvegarde ne doivent pas deborder d'un test a
        // l'autre — sauf quand le test verifie justement la sauvegarde (garderSauvegarde)
        if (!v.garderSauvegarde) { localStorage.removeItem('superobby.mavoiture'); if (typeof guerre !== 'undefined') guerre.sauvePerf = []; }
      } catch (e8) {}
      for (const b of bots) b.gangMission = null;
      // une partie de tennis ou de foot laissee en cours faussait le test suivant
      if (typeof finDuel === 'function') { try { finDuel('tennis'); finDuel('foot'); } catch (e4) {} }
      if (typeof P !== 'undefined' && P.racket) { P.racket = false; try { setRacket(me, false); } catch (e5) {} }
      if (typeof city !== 'undefined' && city.safes) { for (const sf of city.safes) { sf.progress = 0; sf.alerte = false; } city.safeNear = null; }
      if (typeof city !== 'undefined') { city.rideBot = null; city.botCarNear = null; }
      // Une voiture de police laissee au milieu de la rue par le test precedent « voit » le
      // joueur : la clemence sur les petits delits ne s'appliquait plus et le test suivant
      // echouait sans rapport avec ce qu'il mesurait. On renvoie tout le monde au poste.
      if (typeof police !== 'undefined') {
        try { clearWanted(); } catch (e2) {}
        police.avert = 0; police.avertT = -999; police.usure = 0; police.sait = null; police.lastSeen = null;
        for (const pc of (police.cars || [])) { if (pc.home) { pc.x = pc.home[0]; pc.z = pc.home[1]; }
          pc.active = false; pc.debarque = false; pc.speed = 0; pc.route = null; pc.vueT = 0; pc.vue = false;
          if (pc.g) pc.g.position.set(pc.x, pc.y || 0, pc.z); }
        for (let k = (police.agents || []).length - 1; k >= 0; k--) { const a = police.agents[k];
          try { scene.remove(a.av.group); const j = city.mannequins.indexOf(a.av); if (j >= 0) city.mannequins.splice(j, 1); } catch (e3) {}
          police.agents.splice(k, 1); }
      }
      if (typeof coup !== 'undefined') { coup.etat = 'aucun'; coup.bot = null; coup.car = null; }
      if (typeof gang !== 'undefined') gang.mission = null;
      if (typeof defi !== 'undefined') defi.on = null;
      if (typeof mission !== 'undefined' && mission.cur) endMission(false, true);
    } catch (e) {}
    settings.ctrl = 'cam';                       // la caméra ne suit plus l'orientation du joueur
    if (v.hour != null) simTime = ((v.hour - 7 + 12) % 12) / 12 * day.len;   // l'heure se pilote par simTime (journée de 7 h à 19 h)
    if (v.x != null) { P.pos.set(v.x, v.y, v.z); P.vel.set(0, 0, 0); }
    if (v.facing != null) P.facing = v.facing;
    cam.yaw = v.yaw != null ? v.yaw : P.facing;
    if (v.pitch != null) cam.pitch = v.pitch;
    if (v.dist != null) { cam.base = v.dist; cam.dist = v.dist; }
    cam.freeUntil = 1e9;                         // fige l'orientation demandée
    if (v.tv && typeof modeTV === 'function') modeTV(true); else if (v.tv === false && typeof modeTV === 'function') modeTV(false);
    if (v.salonTV && typeof ouvreSalonTV === 'function') { try { ouvreSalonTV(); } catch (e9) {} }
    if (v.hideHud) document.querySelectorAll('#top,#chat,#radar,#act,#missionHud').forEach(function (e) { e.style.display = 'none'; });
    if (v.noClip) { P.pos.y = v.y; P.vel.set(0, 0, 0); }
    if (v.sansBots) bots.forEach(function (b) { b.av.group.visible = false; });
    if (v.dormir) { const b = city.beds[0]; if (b) { P.pos.set(b.x, b.y + 1, b.z); city.bedNear = b; sleepBed(); } }
    if (v.arme) { owned.add('arme:' + v.arme); equipWeapon(v.arme); drawWeapon(true); P.aimPitch = v.pitchVisee || 0; }
    if (v.raquette) { P.racket = true; setRacket(me, true); }
    if (v.atelier) {   // une voiture posée sur la travée de l'atelier, pour la capture
      try { for (const c of city.cars) { c.x += 300; c.z += 300; c.g.position.set(c.x, c.y, c.z); }
        amenerVoitureAtelier(); } catch (e) {}
    }
    if (v.coup) {   // un coup en cours, figé au bon instant, pour juger l'impact
      try {
        const b = bots[0];
        b.pos.set(P.pos.x + Math.sin(P.facing) * 1.5, P.pos.y, P.pos.z + Math.cos(P.facing) * 1.5);
        b.rdv = null; b.wait = 9; b.ko = 0; b.hp = 100; b.av.group.visible = true;
        b.av.group.position.copy(b.pos); b.facing = P.facing + Math.PI; b.av.group.rotation.y = b.facing;
        setTimeout(function () { try { P.punchT = 0; P.combo = v.coup === 'combo' ? 2 : 0; attack(v.coup === 'kick' ? 'kick' : 'punch'); } catch (e) {} }, Math.max(300, (v.wait || 1200) - 90));
      } catch (e) {}
    }
    if (v.balleMur) {   // une balle qui vient de frapper le décor
      try { setTimeout(function () { try { impact(P.pos.x + Math.sin(P.facing) * 3, P.pos.y + 1.3, P.pos.z + Math.cos(P.facing) * 3, { x: Math.sin(P.facing), y: 0, z: Math.cos(P.facing) }, 'mur', 1.2); } catch (e) {} }, Math.max(300, (v.wait || 1200) - 90)); } catch (e) {}
    }
    if (v.partie) {   // une partie de sport contre un membre, pour la capture
      try {
        const b = bots[0];
        amis.add(b.name);
        b.pos.set(v.partie === 'foot' ? -19 : 13, 0.3, v.partie === 'foot' ? -13 : -17.4);
        b.rdv = null; b.wait = 0; b.ko = 0; b.av.group.visible = true;
        b.sport = { jeu: v.partie, cote: v.partie === 'foot' ? 0 : 1, pret: true };
        if (v.partie === 'tennis') { setRacket(b.av, true); P.racket = true; setRacket(me, true); }
        b.facing = Math.atan2(P.pos.x - b.pos.x, P.pos.z - b.pos.z);
        b.av.group.position.copy(b.pos); b.av.group.rotation.y = b.facing;
      } catch (e) {}
    }
  },
  stats() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    world: worldIdx, solides: solids.length, heure: +day.h.toFixed(1), nuit: +day.night.toFixed(2) }; }
};
window.__G = {
  P, city, drive, police, jail, bank, mission, net, race, gym, cam, settings, me, bots, RALLY, tm, shared, ballMats, owned,
  updateBot, tennisMatchTick, policeTick, worldGroup, THREE,
  fm: typeof fm !== 'undefined' ? fm : null,
  TENNIS_ZONE: typeof TENNIS_ZONE !== 'undefined' ? TENNIS_ZONE : null,
  FOOT_ZONE: typeof FOOT_ZONE !== 'undefined' ? FOOT_ZONE : null,
  DUEL_GAGNANTS: typeof DUEL_GAGNANTS !== 'undefined' ? DUEL_GAGNANTS : 0,
  botSport: typeof botSport === 'function' ? botSport : null,
  botSportif: typeof botSportif === 'function' ? botSportif : null,
  sportBotTick: typeof sportBotTick === 'function' ? sportBotTick : null,
  footMatchTick: typeof footMatchTick === 'function' ? footMatchTick : null,
  courtPlayers: typeof courtPlayers === 'function' ? courtPlayers : null,
  toggleRacket: typeof toggleRacket === 'function' ? toggleRacket : null,
  setRacket: typeof setRacket === 'function' ? setRacket : null,
  finDuel: typeof finDuel === 'function' ? finDuel : null,
  fx: typeof fx !== 'undefined' ? fx : null,
  impact: typeof impact === 'function' ? impact : null,
  gangeurKO: typeof gangeurKO === 'function' ? gangeurKO : null,
  corpsAuSol: typeof corpsAuSol === 'function' ? corpsAuSol : null,
  groundUnder: typeof groundUnder === 'function' ? groundUnder : null,
  gang: typeof gang !== 'undefined' ? gang : null,
  fxTick: typeof fxTick === 'function' ? fxTick : null,
  fxTrainee: typeof fxTrainee === 'function' ? fxTrainee : null,
  camSecousse: typeof camSecousse === 'function' ? camSecousse : null,
  noteOrdre: typeof noteOrdre === 'function' ? noteOrdre : null,
  finirOrdre: typeof finirOrdre === 'function' ? finirOrdre : null,
  journalHtml: typeof journalHtml === 'function' ? journalHtml : null,
  missionGang: typeof missionGang === 'function' ? missionGang : null,
  tuerMembre: typeof tuerMembre === 'function' ? tuerMembre : null,
  entrainerMembre: typeof entrainerMembre === 'function' ? entrainerMembre : null,
  inZone: typeof inZone === 'function' ? inZone : null,
  loadWorld, cityReset, enterCar, exitCar, openUI, closeUI, takeAway, eatCarried, openFridge,
  respawn, die, msg, chat, infraction, clearWanted, jailEnter, jailFree, startMission, endMission,
  toggleMenu, applyMyLook, buildNav, navPath, throwGrenade, equipWeapon, fire, punch, kick, sitBench,
  get solids() { return solids; }, get breakables() { return breakables; }, get shots() { return shots; },
  get grenades() { return grenades; }, get debris() { return debrisParts; }, get uiOpen() { return uiOpen; },
  get paused() { return paused; }, get running() { return running; }, get wallet() { return wallet; },
  get mort() { return dead; }, get gagne() { return won; }, get loopErr() { return typeof loopErr !== 'undefined' ? loopErr : -1; },
  get worldIdx() { return worldIdx; }, get simTime() { return simTime; },
  set wallet(v) { wallet = v; }, set running(v) { running = v; },
  set simTime(v) { simTime = v; },   // les tests avancent l'horloge de simulation sans attendre le rendu
  aimTick, fire, drawWeapon, WEAPONS, vehicleDamage, fumeeTick, makeTarget, explodeVehicle, sitBench, sleepBed, placeDecor, repairVisual, rideEnter, infraction,
  // ces outils n'existent que dans la version corrigée : le crochet doit rester chargeable
  // sur la version d'origine pour pouvoir comparer les deux
  cityStep, cityCommon, startCountdown, sitSwing, swingTick, schQuestion, nextQuestion, answer, openSchool, school, voice, deliverDecor, grabParcel, dropDecor, DECOR, shotsTick, safesTick, keys, decorMesh,
  schTirage: typeof schTirage === 'function' ? schTirage : null,
  schDire: typeof schDire === 'function' ? schDire : null,
  schLire: typeof schLire === 'function' ? schLire : null,
  amis: typeof amis !== 'undefined' ? amis : null,
  chien: typeof chien !== 'undefined' ? chien : null,
  coup: typeof coup !== 'undefined' ? coup : null,
  commandeSociale: typeof commandeSociale === 'function' ? commandeSociale : null,
  chienTick: typeof chienTick === 'function' ? chienTick : null,
  coupTick: typeof coupTick === 'function' ? coupTick : null,
  coupAlerte: typeof coupAlerte === 'function' ? coupAlerte : null,
  coupMonter: typeof coupMonter === 'function' ? coupMonter : null,
  botPrendVoiture: typeof botPrendVoiture === 'function' ? botPrendVoiture : null,
  botConduireVers: typeof botConduireVers === 'function' ? botConduireVers : null,
  botDriveTick: typeof botDriveTick === 'function' ? botDriveTick : null,
  monterAvecBot: typeof monterAvecBot === 'function' ? monterAvecBot : null,
  botDescendre: typeof botDescendre === 'function' ? botDescendre : null,
  micro: typeof micro !== 'undefined' ? micro : null,
  chienAttaque: typeof chienAttaque === 'function' ? chienAttaque : null,
  aboie: typeof aboie === 'function' ? aboie : null,
  adopterChien: typeof adopterChien === 'function' ? adopterChien : null,
  petsTick, sitBench, sleepBed, store, updateBot,
  parcelTick, dropDecor, grabParcel, placeLibre, retirerDeco, reprendreDeco, pointPose, murProche, loadDecor, decorSave, sousToit,
  QR: typeof QR !== 'undefined' ? QR : null,
  tv: typeof tv !== 'undefined' ? tv : null,
  tel: typeof tel !== 'undefined' ? tel : null,
  man: typeof man !== 'undefined' ? man : null,
  pad: typeof pad !== 'undefined' ? pad : null,
  telCommande: typeof telCommande === 'function' ? telCommande : null,
  modeTV: typeof modeTV === 'function' ? modeTV : null,
  ouvreSalonTV: typeof ouvreSalonTV === 'function' ? ouvreSalonTV : null,
  manetteOuvre: typeof manetteOuvre === 'function' ? manetteOuvre : null,
  manetteFerme: typeof manetteFerme === 'function' ? manetteFerme : null,
  navBouge: typeof navBouge === 'function' ? navBouge : null,
  netTeardown: typeof netTeardown === 'function' ? netTeardown : null,
  navValide: typeof navValide === 'function' ? navValide : null,
  pollGamepad: typeof pollGamepad === 'function' ? pollGamepad : null,
  setWeapon: typeof setWeapon === 'function' ? setWeapon : null,
  creerAgent: typeof creerAgent === 'function' ? creerAgent : null,
  SHOP: typeof SHOP !== 'undefined' ? SHOP : null,
  CHAUSSURES: typeof CHAUSSURES !== 'undefined' ? CHAUSSURES : null,
  myCfg: typeof myCfg !== 'undefined' ? myCfg : null,
  myLook: typeof myLook === 'function' ? myLook : null,
  applyShopItem: typeof applyShopItem === 'function' ? applyShopItem : null,
  currentShopId: typeof currentShopId === 'function' ? currentShopId : null,
  catalog: typeof catalog === 'function' ? catalog : null,
  openStore: typeof openStore === 'function' ? openStore : null,
  TATOO_MOTIFS: typeof TATOO_MOTIFS !== 'undefined' ? TATOO_MOTIFS : null,
  TATOO_ZONES: typeof TATOO_ZONES !== 'undefined' ? TATOO_ZONES : null,
  TATOO_ENCRES: typeof TATOO_ENCRES !== 'undefined' ? TATOO_ENCRES : null,
  TATOO_TAILLES: typeof TATOO_TAILLES !== 'undefined' ? TATOO_TAILLES : null,
  tatoo: typeof tatoo !== 'undefined' ? tatoo : null,
  openTatoo: typeof openTatoo === 'function' ? openTatoo : null,
  tatouer: typeof tatouer === 'function' ? tatouer : null,
  poseTatouages: typeof poseTatouages === 'function' ? poseTatouages : null,
  tatooTexture: typeof tatooTexture === 'function' ? tatooTexture : null,
  applyLook: typeof applyLook === 'function' ? applyLook : null,
  gang: typeof gang !== 'undefined' ? gang : null,
  guerre: typeof guerre !== 'undefined' ? guerre : null,
  guerreTick: typeof guerreTick === 'function' ? guerreTick : null,
  recruteVaincu: typeof recruteVaincu === 'function' ? recruteVaincu : null,
  recruesTick: typeof recruesTick === 'function' ? recruesTick : null,
  majHudGuerre: typeof majHudGuerre === 'function' ? majHudGuerre : null,
  bank: typeof bank !== 'undefined' ? bank : null,
  buildGangs: typeof buildGangs === 'function' ? buildGangs : null,
  driveStep: typeof driveStep === 'function' ? driveStep : null,
  step: typeof step === 'function' ? step : null,
  SGRID: typeof SGRID !== 'undefined' ? SGRID : null,
  buildSGrid: typeof buildSGrid === 'function' ? buildSGrid : null,
  solidsPres: typeof solidsPres === 'function' ? solidsPres : null,
  solidsAutour: typeof solidsAutour === 'function' ? solidsAutour : null,
  sgridSale: typeof sgridSale === 'function' ? sgridSale : null,
  SGRID: typeof SGRID === 'object' ? SGRID : null,
  gangeurKO: typeof gangeurKO === 'function' ? gangeurKO : null,
  verifieElimination: typeof verifieElimination === 'function' ? verifieElimination : null,
  renaitGang: typeof renaitGang === 'function' ? renaitGang : null,
  peutKidnapper: typeof peutKidnapper === 'function' ? peutKidnapper : null,
  kidnapper: typeof kidnapper === 'function' ? kidnapper : null,
  otageTick: typeof otageTick === 'function' ? otageTick : null,
  otageProche: typeof otageProche === 'function' ? otageProche : null,
  interroger: typeof interroger === 'function' ? interroger : null,
  libereOtage: typeof libereOtage === 'function' ? libereOtage : null,
  entrainerMembre: typeof entrainerMembre === 'function' ? entrainerMembre : null,
  entrainementTick: typeof entrainementTick === 'function' ? entrainementTick : null,
  armerMembre: typeof armerMembre === 'function' ? armerMembre : null,
  proposeReunion: typeof proposeReunion === 'function' ? proposeReunion : null,
  reunionTick: typeof reunionTick === 'function' ? reunionTick : null,
  openReunion: typeof openReunion === 'function' ? openReunion : null,
  choixReunion: typeof choixReunion === 'function' ? choixReunion : null,
  captureTick: typeof captureTick === 'function' ? captureTick : null,
  revenusTick: typeof revenusTick === 'function' ? revenusTick : null,
  repriseTick: typeof repriseTick === 'function' ? repriseTick : null,
  territoireDe: typeof territoireDe === 'function' ? territoireDe : null,
  rangJoueur: typeof rangJoueur === 'function' ? rangJoueur : null,
  gagneRep: typeof gagneRep === 'function' ? gagneRep : null,
  openGuerre: typeof openGuerre === 'function' ? openGuerre : null,
  majGuerre: typeof majGuerre === 'function' ? majGuerre : null,
  saveGuerre: typeof saveGuerre === 'function' ? saveGuerre : null,
  loadGuerre: typeof loadGuerre === 'function' ? loadGuerre : null,
  attack: typeof attack === 'function' ? attack : null,
  nearestFighter: typeof nearestFighter === 'function' ? nearestFighter : null,
  TERRITOIRES: typeof TERRITOIRES !== 'undefined' ? TERRITOIRES : null,
  buildPlanque: typeof buildPlanque === 'function' ? buildPlanque : null,
  creerGangeur: typeof creerGangeur === 'function' ? creerGangeur : null,
  CHEFS_NOMS: typeof CHEFS_NOMS !== 'undefined' ? CHEFS_NOMS : null,
  RANGS: typeof RANGS !== 'undefined' ? RANGS : null,
  gangs: typeof gangs !== 'undefined' ? gangs : null,
  GANG_DEFS: typeof GANG_DEFS !== 'undefined' ? GANG_DEFS : null,
  GANG_MISSIONS: typeof GANG_MISSIONS !== 'undefined' ? GANG_MISSIONS : null,
  GANG_ORDRES: typeof GANG_ORDRES !== 'undefined' ? GANG_ORDRES : null,
  rejoindreGang: typeof rejoindreGang === 'function' ? rejoindreGang : null,
  quitterGang: typeof quitterGang === 'function' ? quitterGang : null,
  estDuGang: typeof estDuGang === 'function' ? estDuGang : null,
  missionGang: typeof missionGang === 'function' ? missionGang : null,
  gangMissionTick: typeof gangMissionTick === 'function' ? gangMissionTick : null,
  gangTick: typeof gangTick === 'function' ? gangTick : null,
  buildGangs: typeof buildGangs === 'function' ? buildGangs : null,
  ordreGang: typeof ordreGang === 'function' ? ordreGang : null,
  trouveBots: typeof trouveBots === 'function' ? trouveBots : null,
  cambrio: typeof cambrio !== 'undefined' ? cambrio : null,
  declencheCambriolage: typeof declencheCambriolage === 'function' ? declencheCambriolage : null,
  cambrioTick: typeof cambrioTick === 'function' ? cambrioTick : null,
  cambrioFin: typeof cambrioFin === 'function' ? cambrioFin : null,
  alarmeInstallee: typeof alarmeInstallee === 'function' ? alarmeInstallee : null,
  DECOR: typeof DECOR !== 'undefined' ? DECOR : null,
  decorMesh: typeof decorMesh === 'function' ? decorMesh : null,
  buildZone: typeof buildZone === 'function' ? buildZone : null,
  immeubleZone: typeof immeubleZone === 'function' ? immeubleZone : null,
  devenirAmi: typeof devenirAmi === 'function' ? devenirAmi : null,
  startGym: typeof startGym === 'function' ? startGym : null,
  remiseTick: typeof remiseTick === 'function' ? remiseTick : null,
  groundCar: typeof groundCar === 'function' ? groundCar : null,
  terrainH: typeof terrainH === 'function' ? terrainH : null,
  agentsTick: typeof agentsTick === 'function' ? agentsTick : null,
  openPlainte: typeof openPlainte === 'function' ? openPlainte : null,
  deposerPlainte: typeof deposerPlainte === 'function' ? deposerPlainte : null,
  plainteTick: typeof plainteTick === 'function' ? plainteTick : null,
  emprisonneBot: typeof emprisonneBot === 'function' ? emprisonneBot : null,
  plainte: typeof plainte !== 'undefined' ? plainte : null,
  PLAINTE_MOTIFS: typeof PLAINTE_MOTIFS !== 'undefined' ? PLAINTE_MOTIFS : null,
  creerAgent: typeof creerAgent === 'function' ? creerAgent : null,
  resetBot: typeof resetBot === 'function' ? resetBot : null,
  repareChose: typeof repareChose === 'function' ? repareChose : null,
  spawnShot: typeof spawnShot === 'function' ? spawnShot : null,
  shotsTick: typeof shotsTick === 'function' ? shotsTick : null,
  settleVehicle: typeof settleVehicle === 'function' ? settleVehicle : null,
  vehicleSolid: typeof vehicleSolid === 'function' ? vehicleSolid : null,
  gymTick: typeof gymTick === 'function' ? gymTick : null,
  gym: typeof gym !== 'undefined' ? gym : null,
  NAV: typeof NAV !== 'undefined' ? NAV : null,
  policeTemoin: typeof policeTemoin === 'function' ? policeTemoin : null,
  bankAlarmBot: typeof bankAlarmBot === 'function' ? bankAlarmBot : null,
  MISSIONS: typeof MISSIONS !== 'undefined' ? MISSIONS : null,
  openMissions: typeof openMissions === 'function' ? openMissions : null,
  commandeSociale: typeof commandeSociale === 'function' ? commandeSociale : null,
  interpreteOrdre: typeof interpreteOrdre === 'function' ? interpreteOrdre : null,
  motsDe: typeof motsDe === 'function' ? motsDe : null,
  defi: typeof defi !== 'undefined' ? defi : null,
  chien: typeof chien !== 'undefined' ? chien : null,
  amis: typeof amis !== 'undefined' ? amis : null,
  devenirAmi: typeof devenirAmi === 'function' ? devenirAmi : null,
  adopterChien: typeof adopterChien === 'function' ? adopterChien : null,
  lancerActivite: typeof lancerActivite === 'function' ? lancerActivite : null,
  gpsRoute: typeof gpsRoute !== 'undefined' ? gpsRoute : null,
  setBeacon: typeof setBeacon === 'function' ? setBeacon : null,
  missionTick: typeof missionTick === 'function' ? missionTick : null,
  mission: typeof mission !== 'undefined' ? mission : null,
  gpsRoute: typeof gpsRoute !== 'undefined' ? gpsRoute : null,
  beacon: typeof beacon !== 'undefined' ? beacon : null,
  activiteTick: typeof activiteTick === 'function' ? activiteTick : null,
  guardsTick: typeof guardsTick === 'function' ? guardsTick : null,
  enterCar: typeof enterCar === 'function' ? enterCar : null,
  exitCar: typeof exitCar === 'function' ? exitCar : null,
  cityTick: typeof cityTick === 'function' ? cityTick : null,
  cityCommon: typeof cityCommon === 'function' ? cityCommon : null,
  cityVie: typeof cityVie === 'function' ? cityVie : null,
  VILLE: typeof VILLE === 'object' ? VILLE : null,
  VILLAS: typeof VILLAS !== 'undefined' ? VILLAS : null,
  botTirePourMoi: typeof botTirePourMoi === 'function' ? botTirePourMoi : null,
  botRangeArme: typeof botRangeArme === 'function' ? botRangeArme : null,
  gardeArmeTick: typeof gardeArmeTick === 'function' ? gardeArmeTick : null,
  cibleGarde: typeof cibleGarde === 'function' ? cibleGarde : null,
  vieTick: typeof vieTick === 'function' ? vieTick : null,
  vie: typeof vie !== 'undefined' ? vie : null,
  ACTIVITES: typeof ACTIVITES !== 'undefined' ? ACTIVITES : null,
  libereVoiture: typeof libereVoiture === 'function' ? libereVoiture : null,
  rejoindreGang: typeof rejoindreGang === 'function' ? rejoindreGang : null,
  estDuGang: typeof estDuGang === 'function' ? estDuGang : null,
  estAmi: typeof estAmi === 'function' ? estAmi : null,
  openOrdres: typeof openOrdres === 'function' ? openOrdres : null,
  openQui: typeof openQui === 'function' ? openQui : null,
  startGym: typeof startGym === 'function' ? startGym : null,
  gymTick: typeof gymTick === 'function' ? gymTick : null,
  finirSeance: typeof finirSeance === 'function' ? finirSeance : null,
  stats: typeof stats !== 'undefined' ? stats : null,
  sprintDuree: typeof sprintDuree === 'function' ? sprintDuree : null,
  perfDe: typeof perfDe === 'function' ? perfDe : null,
  gym: typeof gym !== 'undefined' ? gym : null,
  conduire: typeof conduire === 'function' ? conduire : null,
  navCell: typeof navCell === 'function' ? navCell : null,
  mannequin: typeof mannequin === 'function' ? mannequin : null,
  gardesDuCorps: typeof gardesDuCorps === 'function' ? gardesDuCorps : null,
  vieDe: typeof vieDe === 'function' ? vieDe : null,
  gangeurIsole: typeof gangeurIsole === 'function' ? gangeurIsole : null,
  prixVeto: typeof prixVeto === 'function' ? prixVeto : null,
  chienVeto: typeof chienVeto === 'function' ? chienVeto : null,
  day: typeof day !== 'undefined' ? day : null,
  casino: typeof casino !== 'undefined' ? casino : null,
  ouvreCasino: typeof ouvreCasino === 'function' ? ouvreCasino : null,
  jouerCasino: typeof jouerCasino === 'function' ? jouerCasino : null,
  majCasino: typeof majCasino === 'function' ? majCasino : null,
  casinoTick: typeof casinoTick === 'function' ? casinoTick : null,
  pokerRang: typeof pokerRang === 'function' ? pokerRang : null,
  gainMachine: typeof gainMachine === 'function' ? gainMachine : null,
  tireRouleaux: typeof tireRouleaux === 'function' ? tireRouleaux : null,
  POKER_GAINS: typeof POKER_GAINS !== 'undefined' ? POKER_GAINS : null,
  PARIS_ROULETTE: typeof PARIS_ROULETTE !== 'undefined' ? PARIS_ROULETTE : null,
  desserteDe: typeof desserteDe === 'function' ? desserteDe : null,
  lieuDe: typeof lieuDe === 'function' ? lieuDe : null,
  pointRouteProche: typeof pointRouteProche === 'function' ? pointRouteProche : null,
  RACE_PTS: typeof RACE_PTS !== 'undefined' ? RACE_PTS : null,
  RACE_LEN: typeof RACE_LEN !== 'undefined' ? RACE_LEN : 0,
  RACE_C: typeof RACE_C !== 'undefined' ? RACE_C : null,
  pathPos: typeof pathPos === 'function' ? pathPos : null,
  grilleDepart: typeof grilleDepart === 'function' ? grilleDepart : null,
  grilleRecul: typeof grilleRecul === 'function' ? grilleRecul : null,
  grilleEcart: typeof grilleEcart === 'function' ? grilleEcart : null,
  surLaLigne: typeof surLaLigne === 'function' ? surLaLigne : null,
  GRILLE_N: typeof GRILLE_N !== 'undefined' ? GRILLE_N : 0,
  GRILLE_JOUEUR: typeof GRILLE_JOUEUR !== 'undefined' ? GRILLE_JOUEUR : 0,
  startCountdown: typeof startCountdown === 'function' ? startCountdown : null,
  raceTick: typeof raceTick === 'function' ? raceTick : null,
  modeTV: typeof modeTV === 'function' ? modeTV : null,
  ouvreSalonTV: typeof ouvreSalonTV === 'function' ? ouvreSalonTV : null,
  tvSalonMaj: typeof tvSalonMaj === 'function' ? tvSalonMaj : null,
  tvManettesMaj: typeof tvManettesMaj === 'function' ? tvManettesMaj : null,
  lienTV: typeof lienTV === 'function' ? lienTV : null,
  castPret: typeof castPret === 'function' ? castPret : null,
  castMaj: typeof castMaj === 'function' ? castMaj : null,
  copieLienTV: typeof copieLienTV === 'function' ? copieLienTV : null,
  cast: typeof cast !== 'undefined' ? cast : null,
  routeLien: typeof routeLien === 'function' ? routeLien : null,
  cam: typeof cam !== 'undefined' ? cam : null,
  surLeCourt: typeof surLeCourt === 'function' ? surLeCourt : null,
  makeBall: typeof makeBall === 'function' ? makeBall : null,
  removeBall: typeof removeBall === 'function' ? removeBall : null,
  capTennis: typeof capTennis === 'function' ? capTennis : null,
  TENNIS_FILET: typeof TENNIS_FILET !== 'undefined' ? TENNIS_FILET : -13,
  TENNIS_LARGE: typeof TENNIS_LARGE !== 'undefined' ? TENNIS_LARGE : null,
  sauveTout: typeof sauveTout === 'function' ? sauveTout : null,
  rechargeTout: typeof rechargeTout === 'function' ? rechargeTout : null,
  restaureGang: typeof restaureGang === 'function' ? restaureGang : null,
  restaureMaVoiture: typeof restaureMaVoiture === 'function' ? restaureMaVoiture : null,
  sauveMaVoiture: typeof sauveMaVoiture === 'function' ? sauveMaVoiture : null,
  maVoiture: typeof maVoiture === 'function' ? maVoiture : null,
  autoSauve: typeof autoSauve === 'function' ? autoSauve : null,
  saveGuerre: typeof saveGuerre === 'function' ? saveGuerre : null,
  loadGuerre: typeof loadGuerre === 'function' ? loadGuerre : null,
  guerre: typeof guerre !== 'undefined' ? guerre : null,
  gang: typeof gang !== 'undefined' ? gang : null,
  store: typeof store !== 'undefined' ? store : null,
  rejoindreGang: typeof rejoindreGang === 'function' ? rejoindreGang : null,
  TUNE_MOTEURS: typeof TUNE_MOTEURS !== 'undefined' ? TUNE_MOTEURS : null,
  KIT_VITESSE: typeof KIT_VITESSE !== 'undefined' ? KIT_VITESSE : null,
  MOTEUR_VOIX: typeof MOTEUR_VOIX !== 'undefined' ? MOTEUR_VOIX : null,
  bonusKits: typeof bonusKits === 'function' ? bonusKits : null,
  moteurDe: typeof moteurDe === 'function' ? moteurDe : null,
  engine: typeof engine !== 'undefined' ? engine : null,
  nitroGo: typeof nitroGo === 'function' ? nitroGo : null,
  nitroTick: typeof nitroTick === 'function' ? nitroTick : null,
  NITRO_DUREE: typeof NITRO_DUREE !== 'undefined' ? NITRO_DUREE : 0,
  NITRO_RECHARGE: typeof NITRO_RECHARGE !== 'undefined' ? NITRO_RECHARGE : 0,
  enterCar: typeof enterCar === 'function' ? enterCar : null,
  exitCar: typeof exitCar === 'function' ? exitCar : null,
  vehicleSolid: typeof vehicleSolid === 'function' ? vehicleSolid : null,
  MONDE: typeof MONDE !== 'undefined' ? MONDE : null,
  heliStep: typeof heliStep === 'function' ? heliStep : null,
  chuteImpact: typeof chuteImpact === 'function' ? chuteImpact : null,
  majPerfHud: typeof majPerfHud === 'function' ? majPerfHud : null,
  resumeMissions: typeof resumeMissions === 'function' ? resumeMissions : null,
  journalHtml: typeof journalHtml === 'function' ? journalHtml : null,
  puceEtat: typeof puceEtat === 'function' ? puceEtat : null,
  CHUTE_SEUIL: typeof CHUTE_SEUIL !== 'undefined' ? CHUTE_SEUIL : 0,
  enseigneTexture: typeof enseigneTexture === 'function' ? enseigneTexture : null,
  plaqueTexture: typeof plaqueTexture === 'function' ? plaqueTexture : null,
  RACE_GATES: typeof RACE_GATES !== 'undefined' ? RACE_GATES : null,
  get raceKarts() { return typeof raceKarts !== 'undefined' ? raceKarts : null; },   // réaffecté à chaque construction de ville
  race: typeof race !== 'undefined' ? race : null,
  DECOR: typeof DECOR !== 'undefined' ? DECOR : null,
  deliverDecor: typeof deliverDecor === 'function' ? deliverDecor : null,
  dansMonGarage: typeof dansMonGarage === 'function' ? dansMonGarage : null,
  sleepBed: typeof sleepBed === 'function' ? sleepBed : null,
  sauveTout: typeof sauveTout === 'function' ? sauveTout : null,
  openAtelier: typeof openAtelier === 'function' ? openAtelier : null,
  majAtelier: typeof majAtelier === 'function' ? majAtelier : null,
  tuneCible: typeof tuneCible === 'function' ? tuneCible : null,
  dayTick: typeof dayTick === 'function' ? dayTick : null,
  openEquipe: typeof openEquipe === 'function' ? openEquipe : null,
  equipeSel: typeof equipeSel !== 'undefined' ? equipeSel : null,
  chanceMission: typeof chanceMission === 'function' ? chanceMission : null,
  botMission: typeof botMission === 'function' ? botMission : null,
  CHIEN_PERF_MAX: typeof CHIEN_PERF_MAX !== 'undefined' ? CHIEN_PERF_MAX : null,
  updateBot: typeof updateBot === 'function' ? updateBot : null,
  recruteVaincu: typeof recruteVaincu === 'function' ? recruteVaincu : null,
  gangTick: typeof gangTick === 'function' ? gangTick : null,
  typeMission: typeof typeMission === 'function' ? typeMission : null,
  rangJoueur: typeof rangJoueur === 'function' ? rangJoueur : null,
  prixSoin: typeof prixSoin === 'function' ? prixSoin : null,
  botHopital: typeof botHopital === 'function' ? botHopital : null,
  soinTick: typeof soinTick === 'function' ? soinTick : null,
  botGardeDuCorps: typeof botGardeDuCorps === 'function' ? botGardeDuCorps : null,
  botProtegeMembre: typeof botProtegeMembre === 'function' ? botProtegeMembre : null,
  botGardeVilla: typeof botGardeVilla === 'function' ? botGardeVilla : null,
  protectionTick: typeof protectionTick === 'function' ? protectionTick : null,
  ordreGang: typeof ordreGang === 'function' ? ordreGang : null,
  botStop: typeof botStop === 'function' ? botStop : null,
  nommerChien: typeof nommerChien === 'function' ? nommerChien : null,
  gardeTick: typeof gardeTick === 'function' ? gardeTick : null,
  gardeArmeTick: typeof gardeArmeTick === 'function' ? gardeArmeTick : null,
  coifApercu: typeof coifApercu === 'function' ? coifApercu : null,
  openStore: typeof openStore === 'function' ? openStore : null,
  buildAvatar: typeof buildAvatar === 'function' ? buildAvatar : null,
  applyLook: typeof applyLook === 'function' ? applyLook : null,
  openCoiffeur: typeof openCoiffeur === 'function' ? openCoiffeur : null,
  majCoiffeur: typeof majCoiffeur === 'function' ? majCoiffeur : null,
  validerCoiffure: typeof validerCoiffure === 'function' ? validerCoiffure : null,
  COIFFES: typeof COIFFES !== 'undefined' ? COIFFES : null,
  COIFFES_BLOCS: typeof COIFFES_BLOCS !== 'undefined' ? COIFFES_BLOCS : null,
  coif: typeof coif !== 'undefined' ? coif : null,
  PAL: typeof PAL !== 'undefined' ? PAL : null,
  SHOP: typeof SHOP !== 'undefined' ? SHOP : null,
  chienPoseAssis: typeof chienPoseAssis === 'function' ? chienPoseAssis : null,
  perfDe: typeof perfDe === 'function' ? perfDe : null,
  perfGagne: typeof perfGagne === 'function' ? perfGagne : null,
  perfPerd: typeof perfPerd === 'function' ? perfPerd : null,
  perfEtoiles: typeof perfEtoiles === 'function' ? perfEtoiles : null,
  policePerf: typeof policePerf === 'function' ? policePerf : null,
  majForceGang: typeof majForceGang === 'function' ? majForceGang : null,
  forceGangRival: typeof forceGangRival === 'function' ? forceGangRival : null,
  tuerMembre: typeof tuerMembre === 'function' ? tuerMembre : null,
  gangMissionTick: typeof gangMissionTick === 'function' ? gangMissionTick : null,
  missionGang: typeof missionGang === 'function' ? missionGang : null,
  GANG_MISSIONS: typeof GANG_MISSIONS !== 'undefined' ? GANG_MISSIONS : null,
  openGuerre: typeof openGuerre === 'function' ? openGuerre : null,
  majGuerre: typeof majGuerre === 'function' ? majGuerre : null,
  lieuDe: typeof lieuDe === 'function' ? lieuDe : null,
  agentsTick: typeof agentsTick === 'function' ? agentsTick : null,
  TATOO_TAILLES: typeof TATOO_TAILLES !== 'undefined' ? TATOO_TAILLES : null,
  TATOO_ZONES: typeof TATOO_ZONES !== 'undefined' ? TATOO_ZONES : null,
  openTatoo: typeof openTatoo === 'function' ? openTatoo : null,
  majTatoo: typeof majTatoo === 'function' ? majTatoo : null,
  applyMyLook: typeof applyMyLook === 'function' ? applyMyLook : null,
  myCfg: typeof myCfg !== 'undefined' ? myCfg : null,
  panierChien: typeof panierChien === 'function' ? panierChien : null,
  chienOrdre: typeof chienOrdre === 'function' ? chienOrdre : null,
  ORDRES_CHIEN: typeof ORDRES_CHIEN !== 'undefined' ? ORDRES_CHIEN : null,
  openOrdresChien: typeof openOrdresChien === 'function' ? openOrdresChien : null,
  chienTick: typeof chienTick === 'function' ? chienTick : null,
  repareAtelier: typeof repareAtelier === 'function' ? repareAtelier : null,
  prixRepare: typeof prixRepare === 'function' ? prixRepare : null,
  openAtelier: typeof openAtelier === 'function' ? openAtelier : null,
  vehicleDamage: typeof vehicleDamage === 'function' ? vehicleDamage : null,
  navEnPieton: typeof navEnPieton === 'function' ? navEnPieton : null,
  navGeo: typeof navGeo === 'function' ? navGeo : null,
  navSale: typeof navSale === 'function' ? navSale : null,
  navLisse: typeof navLisse === 'function' ? navLisse : null,
  navLibreLigne: typeof navLibreLigne === 'function' ? navLibreLigne : null,
  npcBlocked: typeof npcBlocked === 'function' ? npcBlocked : null,
  groundUnder: typeof groundUnder === 'function' ? groundUnder : null,
  lancerActivite: typeof lancerActivite === 'function' ? lancerActivite : null,
  activiteTick: typeof activiteTick === 'function' ? activiteTick : null,
  BOT_DEFS: typeof BOT_DEFS !== 'undefined' ? BOT_DEFS : null,
  combatTick: typeof combatTick === 'function' ? combatTick : null,
  botProtege: typeof botProtege === 'function' ? botProtege : null,
  botStop: typeof botStop === 'function' ? botStop : null,
  tuning: typeof tuning !== 'undefined' ? tuning : null,
  tuneApply: typeof tuneApply === 'function' ? tuneApply : null,
  tuneCible: typeof tuneCible === 'function' ? tuneCible : null,
  openAtelier: typeof openAtelier === 'function' ? openAtelier : null,
  validerAtelier: typeof validerAtelier === 'function' ? validerAtelier : null,
  majAtelier: typeof majAtelier === 'function' ? majAtelier : null,
  nitroGo: typeof nitroGo === 'function' ? nitroGo : null,
  nitroTick: typeof nitroTick === 'function' ? nitroTick : null,
  TUNE_KITS: typeof TUNE_KITS !== 'undefined' ? TUNE_KITS : null,
  TUNE_MOTEURS: typeof TUNE_MOTEURS !== 'undefined' ? TUNE_MOTEURS : null,
  TUNE_AMORTIS: typeof TUNE_AMORTIS !== 'undefined' ? TUNE_AMORTIS : null,
  TUNE_COULEURS: typeof TUNE_COULEURS !== 'undefined' ? TUNE_COULEURS : null,
  TUNE_FINITIONS: typeof TUNE_FINITIONS !== 'undefined' ? TUNE_FINITIONS : null,
  tenueUniforme: typeof tenueUniforme === 'function' ? tenueUniforme : null,
  stoveTick: typeof stoveTick === 'function' ? stoveTick : null,
  useStove: typeof useStove === 'function' ? useStove : null,
  sharkTick: typeof sharkTick === 'function' ? sharkTick : null,
  drawWeapon: typeof drawWeapon === 'function' ? drawWeapon : null,
  openJail, jail, jailFree, shotsTick, fire, aimTick, spawnShot,
  armee: typeof armee !== 'undefined' ? armee : null,
  armeeAlerte: typeof armeeAlerte === 'function' ? armeeAlerte : null,
  armeeTick: typeof armeeTick === 'function' ? armeeTick : null,
  armeeFin: typeof armeeFin === 'function' ? armeeFin : null,
  agentsTick: typeof agentsTick === 'function' ? agentsTick : null,
  creerAgent: typeof creerAgent === 'function' ? creerAgent : null,
  policeInvestit: typeof policeInvestit === 'function' ? policeInvestit : null,
  policeDebarque: typeof policeDebarque === 'function' ? policeDebarque : null,
  policeVoit: typeof policeVoit === 'function' ? policeVoit : null,
  abriDuJoueur: typeof abriDuJoueur === 'function' ? abriDuJoueur : null,
  agentTue: typeof agentTue === 'function' ? agentTue : null,
  arrestation: typeof arrestation === 'function' ? arrestation : null,
  separerVehicules: typeof separerVehicules === 'function' ? separerVehicules : null,
  vehHalf: typeof vehHalf === 'function' ? vehHalf : null,
  camLibres: typeof camLibres === 'function' ? camLibres : null,
  venirAMoi: typeof venirAMoi === 'function' ? venirAMoi : null,
  lieuDe: typeof lieuDe === 'function' ? lieuDe : null,
  bankAlarm, carBlocked, policeTick, driveStep, loopPos, makeCar, groundUnder, npcBlocked, npcMove, navPath, camera, safesTick, hurt, day, sun, hemi, scene,
  zomNuit: typeof zomNuit === 'function' ? zomNuit : null,
  surGlace: typeof surGlace === 'function' ? surGlace : null,
  neigeDecor: typeof neigeDecor === 'function' ? neigeDecor : null,
  MUNITIONS: typeof MUNITIONS !== 'undefined' ? MUNITIONS : null,
  muniActive: typeof muniActive === 'function' ? muniActive : null,
  feuAuSol: typeof feuAuSol === 'function' ? feuAuSol : null,
  feuxTick: typeof feuxTick === 'function' ? feuxTick : null,
  balleExplose: typeof balleExplose === 'function' ? balleExplose : null,
  libereVehiculesOublies: typeof libereVehiculesOublies === 'function' ? libereVehiculesOublies : null,
  botStop: typeof botStop === 'function' ? botStop : null,
  monterAvecBot: typeof monterAvecBot === 'function' ? monterAvecBot : null,
  applyDamageVisual, explodeVehicle, breakThing, equipWeapon, owned, saveOwned, me, breakables, worldGroup,
  AIDE_ORDRES: typeof AIDE_ORDRES !== 'undefined' ? AIDE_ORDRES : null,
  botSuis: typeof botSuis === 'function' ? botSuis : null,
  botTape: typeof botTape === 'function' ? botTape : null,
  bagarreTick: typeof bagarreTick === 'function' ? bagarreTick : null,
  combatTick, cinemaTick, FILMS, beacon, setBeacon, clearBeacon, VIDEOS: typeof VIDEOS !== 'undefined' ? VIDEOS : null,
  prendreVoile: typeof prendreVoile === 'function' ? prendreVoile : null,
  voilePose: typeof voilePose === 'function' ? voilePose : null,
  ouvreVoile: typeof ouvreVoile === 'function' ? ouvreVoile : null,
  rangeVoile: typeof rangeVoile === 'function' ? rangeVoile : null,
  voileTick: typeof voileTick === 'function' ? voileTick : null,
  liftTick: typeof liftTick === 'function' ? liftTick : null,
  toitAccessible: typeof toitAccessible === 'function' ? toitAccessible : null,
  meteo: typeof meteo !== 'undefined' ? meteo : null,
  meteoTick: typeof meteoTick === 'function' ? meteoTick : null,
  meteoSet: typeof meteoSet === 'function' ? meteoSet : null,
  stealCar: typeof stealCar === 'function' ? stealCar : null,
  cinemaTick: typeof cinemaTick === 'function' ? cinemaTick : null,
  FILMS: typeof FILMS !== 'undefined' ? FILMS : null,
  filmSuivant: typeof filmSuivant === 'function' ? filmSuivant : null,
  ctrlText: typeof ctrlText === 'function' ? ctrlText : null,
  castSolids: typeof castSolids === 'function' ? castSolids : null,
  rayBox: typeof rayBox === 'function' ? rayBox : null,
  rayPerso: typeof rayPerso === 'function' ? rayPerso : null,
  get aimPoint() { return aimPoint; },
  get aimDir() { return typeof aimDir !== 'undefined' ? aimDir : null; },
  muzzle() { const w = me.weapons && me.weapons[P.weapon]; const m = w && w.userData && w.userData.muzzle;
    return m ? m.getWorldPosition(new THREE.Vector3()) : null; },
  bodyClass() { return document.body.className; },
  tactile(on) { document.body.classList.toggle('touch', !!on); },
  hud() { return { jump: document.getElementById('jumpBtn').textContent, car: document.getElementById('carBtn').textContent,
    punch: document.getElementById('punchBtn').textContent, emote: document.getElementById('emoteBtn').textContent }; },
  arm() { return me.rig.armR.children.length; },
};
`;

function serve(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8')
    .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>/, '<script src="/three.min.js"></script>')
    .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/peerjs[^<]*<\/script>/, '')
    .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '')
    .replace(/\nloop\(\);/, '\nloop();\n' + HOOK);
  const three = fs.readFileSync(path.join(__dirname, 'vendor', 'three.min.js'));
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/three.min.js')) { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(three); }
    else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); }
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port })));
}

(async () => {
  const file = process.argv[2] || path.join(ROOT, 'index.html');
  const { srv, port } = await serve(file);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SHOT && window.__SHOT.ready, null, { timeout: 60000 })
    .catch(() => { throw new Error('le crochet __SHOT n\'est jamais devenu prêt — le jeu n\'a pas démarré. Erreurs: ' + errors.join(' | ')); });

  for (const v of VIEWS) {
    await page.evaluate(vv => window.__SHOT.go(vv), v);
    await page.waitForTimeout(v.wait || 700);
    await page.screenshot({ path: path.join(OUT, v.name + '.png') });
  }
  const stats = await page.evaluate(() => window.__SHOT.stats());
  console.log('rendu :', JSON.stringify(stats));
  if (errors.length) { console.log('\nERREURS CONSOLE (' + errors.length + ') :'); errors.slice(0, 15).forEach(e => console.log('  ' + e.slice(0, 220))); }
  else console.log('aucune erreur console.');
  await browser.close(); srv.close();
  console.log('captures dans', OUT);
})().catch(e => { console.error(e.message || e); process.exit(1); });
