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
      }
      if (typeof city !== 'undefined') { city.rideBot = null; city.botCarNear = null; }
      if (typeof coup !== 'undefined') { coup.etat = 'aucun'; coup.bot = null; coup.car = null; }
      if (typeof gang !== 'undefined') gang.mission = null;
      if (typeof defi !== 'undefined') defi.on = null;
      if (typeof mission !== 'undefined' && mission.cur) endMission(false, true);
    } catch (e) {}
    settings.ctrl = 'cam';                       // la caméra ne suit plus l'orientation du joueur
    if (v.hour != null) simTime = ((v.hour - 7 + 24) % 24) / 24 * day.len;   // l'heure se pilote par simTime
    if (v.x != null) { P.pos.set(v.x, v.y, v.z); P.vel.set(0, 0, 0); }
    if (v.facing != null) P.facing = v.facing;
    cam.yaw = v.yaw != null ? v.yaw : P.facing;
    if (v.pitch != null) cam.pitch = v.pitch;
    if (v.dist != null) { cam.base = v.dist; cam.dist = v.dist; }
    cam.freeUntil = 1e9;                         // fige l'orientation demandée
    if (v.hideHud) document.querySelectorAll('#top,#chat,#radar,#act,#missionHud').forEach(function (e) { e.style.display = 'none'; });
    if (v.noClip) { P.pos.y = v.y; P.vel.set(0, 0, 0); }
    if (v.sansBots) bots.forEach(function (b) { b.av.group.visible = false; });
    if (v.dormir) { const b = city.beds[0]; if (b) { P.pos.set(b.x, b.y + 1, b.z); city.bedNear = b; sleepBed(); } }
    if (v.arme) { owned.add('arme:' + v.arme); equipWeapon(v.arme); drawWeapon(true); P.aimPitch = v.pitchVisee || 0; }
  },
  stats() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    world: worldIdx, solides: solids.length, heure: +day.h.toFixed(1), nuit: +day.night.toFixed(2) }; }
};
window.__G = {
  P, city, drive, police, jail, bank, mission, net, race, gym, cam, settings, me, bots, RALLY, tm, shared, ballMats, owned,
  updateBot, tennisMatchTick, policeTick, worldGroup, THREE,
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
