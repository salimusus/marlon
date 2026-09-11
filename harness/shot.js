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
  // Le banc d'essai pose ce drapeau (par localStorage, pour qu'il survive au rechargement de
  // page du test de sauvegarde) : chaque __SHOT.go() rebatit alors la ville de zero.
  // Voir MONDE NEUF PAR DEFAUT plus bas.
  fraisDefaut: (function () { try { return localStorage.getItem('superobby.banc.frais') === '1'; } catch (e) { return false; } })(),
  // CE QUI N'EST PAS AU REPOS A L'ENTREE D'UN TEST (__SHOT.sale).
  // Le banc d'essai enchaine 300 tests dans UNE page : quand un test echoue, la cause est
  // souvent l'etat laisse par un VOISIN, et le message d'echec ne le disait pas — on relisait
  // dix fois un test parfaitement juste. On releve donc, AVANT toute remise a zero, la liste
  // de ce qui trainait ; le banc l'ajoute au message des tests rouges. La liste ne juge pas :
  // un test qui demande la continuite (continu: true) trouvera normalement des choses dedans.
  sale: [],
  // L'INVENTAIRE DU JOUEUR AU CHARGEMENT DE LA PAGE. On l'ecrit dans le stockage local a la
  // toute premiere ouverture : il survit ainsi au rechargement de page du test de sauvegarde,
  // qui relit superobby.owned et y trouverait sinon tous les achats des tests precedents.
  achats0: (function () {
    try { var k = 'superobby.banc.achats0';
      if (localStorage.getItem(k) == null) localStorage.setItem(k, localStorage.getItem('superobby.owned') || '[]');
      return JSON.parse(localStorage.getItem(k) || '[]') || []; } catch (e) { return []; }
  })(),
  argent0: (function () {
    try { var k = 'superobby.banc.argent0';
      if (localStorage.getItem(k) == null) localStorage.setItem(k, localStorage.getItem('superobby.wallet') || '25');
      return +localStorage.getItem(k) || 25; } catch (e) { return 25; }
  })(),
  // LA TENUE PORTEE AU CHARGEMENT DE LA PAGE. Meme mecanique que les achats : le test de
  // rechargement pose une sauvegarde d'avatar (dreads, taille XXL) puis relance la page, et
  // tous les tests suivants mesuraient un autre personnage que celui du premier chargement.
  look0: (function () {
    try { var k = 'superobby.banc.look0';
      if (localStorage.getItem(k) == null) localStorage.setItem(k, localStorage.getItem('superobby.avatar') || 'null');
      return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
  })(),
  relevePropre() {
    const s = [];
    const dit = function (c, t) { if (c) s.push(t); };
    try {
      dit(typeof drive !== 'undefined' && drive.car, 'joueur au volant');
      dit(typeof P !== 'undefined' && (P.sit || P.ride || P.swing || P.eat || P.deco), 'joueur assis / pris par un decor');
      dit(typeof P !== 'undefined' && P.hp < 100, 'joueur blesse (' + (typeof P !== 'undefined' ? P.hp : '?') + ' PV)');
      dit(typeof uiOpen !== 'undefined' && uiOpen, 'fenetre ouverte : ' + (typeof uiOpen !== 'undefined' ? uiOpen : ''));
      dit(typeof paused !== 'undefined' && paused, 'jeu en pause');
      dit(typeof jail !== 'undefined' && jail.on, 'joueur en prison');
      dit(typeof police !== 'undefined' && police.wanted > 0, 'recherche police niveau ' + (typeof police !== 'undefined' ? police.wanted : '?'));
      dit(typeof mission !== 'undefined' && mission.cur, 'mission en cours');
      dit(typeof city !== 'undefined' && city.accidents && city.accidents.length, (typeof city !== 'undefined' && city.accidents ? city.accidents.length : 0) + ' accident(s) en cours');
      dit(typeof city !== 'undefined' && city.incendies && city.incendies.length, (typeof city !== 'undefined' && city.incendies ? city.incendies.length : 0) + ' incendie(s)');
      dit(typeof city !== 'undefined' && city.chantiers && city.chantiers.length, (typeof city !== 'undefined' && city.chantiers ? city.chantiers.length : 0) + ' chantier(s) ouverts');
      // les etats de bots : on compte plutot que de citer chaque nom
      if (typeof bots !== 'undefined') {
        var ko = 0, cond = 0, ordre = 0;
        for (var i = 0; i < bots.length; i++) { var b = bots[i];
          if (b.ko || b.mort || b.hp < 100) ko++;
          if (b.drive && b.drive.car) cond++;
          if (b.rdv || b.ordre || b.gangMission || b.gardeCorps || b.sport) ordre++; }
        dit(ko, ko + ' habitant(s) blesses ou au sol');
        dit(cond, cond + ' habitant(s) au volant');
        dit(ordre, ordre + ' habitant(s) avec un ordre en cours');
      }
      // L'INVENTAIRE ET LES FANTOMES : les deux residus qui ont fait tomber le plus de tests.
      if (typeof owned !== 'undefined') {
        var enTrop = 0; owned.forEach(function (x) { if (__SHOT.achats0.indexOf(x) < 0) enTrop++; });
        dit(enTrop, enTrop + ' achat(s) de plus qu\'au premier chargement (ils changent le tour des armes et le prix en boutique)');
      }
      if (typeof wallet !== 'undefined' && wallet !== __SHOT.argent0) dit(true, 'portefeuille a ' + wallet + ' au lieu de ' + __SHOT.argent0);
      if (typeof solids !== 'undefined') {
        var auMonde = function (m) { var n = m, q = 0; while (n && q++ < 64) { if (n === scene) return true; n = n.parent; } return false; };
        var fant = 0; for (var q2 = 0; q2 < solids.length; q2++) { var o2 = solids[q2]; if (o2 && o2.mesh && !auMonde(o2.mesh)) fant++; }
        dit(fant, fant + ' boite(s) de collision fantomes laissees par une reconstruction du monde');
      }
      // LES SONS EN BOUCLE : c'est le residu le plus sournois, il ne se voit nulle part a
      // l'ecran et il fausse toutes les mesures de niveau des tests audio.
      dit(typeof craieLit !== 'undefined' && craieLit.g && craieLit.g.gain.value > 0.0002, 'lit de craie ouvert');
      dit(typeof SON !== 'undefined' && SON.vivants && SON.vivants.length, (typeof SON !== 'undefined' && SON.vivants ? SON.vivants.length : 0) + ' son(s) places encore vivants');
      dit(typeof casino !== 'undefined' && casino.cine, 'un tour de roulette en cours (bruit de bille en boucle)');
      // LA MEMOIRE DU RENDU : une fuite ne se voit qu'en comparant d'un test a l'autre.
      var m = renderer.info.memory;
      __SHOT.memoire = { geo: m.geometries, tex: m.textures, prog: renderer.info.programs.length, objets: scene.children.length, solides: solids.length };
    } catch (e) { s.push('releve impossible : ' + (e && e.message)); }
    return s;
  },
  go(v) {
    try { this.sale = this.relevePropre(); } catch (e) { this.sale = []; }
    // le champ de chat garde le focus d'un test a l'autre et avale alors toutes les
    // touches (le jeu ignore les keydown quand chatIn est actif) : on le relache.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    // un test precedent peut laisser le joueur au volant, assis ou une fenetre ouverte :
    // on repart d'un etat propre, sinon les touches sont ignorees.
    // CHACUN SON try : quand closeUI() levait une exception, on n'arrivait meme plus a la
    // ligne qui fait descendre le joueur de voiture, et le test suivant se jouait AU VOLANT.
    try { if (uiOpen) closeUI(); } catch (e) {}
    try { if (typeof city !== 'undefined' && city.rideBot && typeof botDescendre === 'function') botDescendre(city.rideBot, true); } catch (e) {}
    // AU VOLANT. Un test qui laisse le joueur dans une voiture fausse tout le reste : le
    // comptoir de l'atelier, par exemple, ne se signale VOLONTAIREMENT pas quand on conduit,
    // et « le garage a demenage » le declarait donc introuvable. exitCar() peut echouer (le
    // vehicule a ete detruit entre-temps) : on force alors la sortie a la main.
    try { if (drive.car) exitCar(); } catch (e) {}
    try {
      if (drive.car) { drive.car = null; drive.speed = 0; me.group.visible = true; document.body.classList.remove('driving', 'carnear'); }
      drive.gear = 1; drive.shiftT = 0; drive.boostT = 0; drive.freinMain = false;
    } catch (e) {}
    try {
      P.sit = null; P.swing = null; P.ride = null; P.eat = null; P.deco = null;
      P.run = false; P.court = false; P.essouffle = false; P.energie = 100;
      if (typeof gym !== 'undefined') gym.on = null;
    } catch (e) {}
    // MONDE NEUF (v.frais). Les tests ne rebatissent le monde que s'ils CHANGENT de monde :
    // la neige, les chantiers, les epaves et les vehicules deplaces par le test precedent
    // restent donc en place. C'est sans consequence pour la plupart des mesures, mais un
    // test qui COMPTE les objets de la scene (appels de dessin, triangles, cout d'un
    // accident) mesurait alors les restes des autres — d'un run a l'autre le meme test
    // trouvait 2246 ou 7264 appels. Ces tests demandent l'option frais et repartent d'une
    // ville comme au premier chargement.
    // MONDE NEUF PAR DEFAUT (__SHOT.fraisDefaut) : le banc d'essai enchaine ~300 tests dans
    // UNE SEULE page. Tout ce qu'aucune remise a zero ne rattrape (boucles de son empilees,
    // minuteries, achats en boutique, textures) se cumule alors pendant deux heures. Un test
    // peut demander la continuite avec { continu: true } quand il a besoin de l'etat laisse
    // juste avant (par exemple relire une sauvegarde ecrite a l'appel precedent).
    var veutFrais = v.frais != null ? v.frais : (v.continu ? false : !!window.__SHOT.fraisDefaut);
    if (veutFrais && v.world != null) loadWorld(v.world);
    else if (v.world != null && worldIdx !== v.world) loadWorld(v.world);
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
    // ================= LES SERVICES DE LA VILLE : ON REND LA VILLE AU REPOS =================
    // Tout ce qui suit repare un DRAPEAU PERSISTANT. Les services municipaux (accidents,
    // police en constat, depanneuse, ambulance, pompiers, equipes de metier) posent des
    // drapeaux sur des objets qui, eux, survivent a loadWorld et meme a frais: true :
    // ils restaient donc allumes d'un test a l'autre. Dix tests de la suite tombaient ainsi
    // en rouge alors qu'ils etaient verts lances seuls. Chaque remise a zero dit ci-dessous
    // QUEL symptome elle evite : ne l'enleve pas sans avoir relu la phrase.
    // NOTE : on assainit LES TESTS, pas le jeu. Aucune de ces lignes ne doit avoir d'equivalent
    // dans index.html ; si un etat n'est pas rattrapable en jouant, c'est un defaut de jeu a
    // signaler, pas a contourner ici.
    try {
      // --- 1. LES ACCIDENTS. ouvreAccident pose c.accidente = true sur les deux vehicules
      // et accidentsTick remet leur vitesse a zero A CHAQUE IMAGE tant que l'accident est
      // dans city.accidents. Symptomes evites : une voiture qui refuse de demarrer (« les
      // roues tournent a la vitesse reelle » mesurait 0 m parcouru, la boite restait sur A1),
      // et une amende de plus prelevee au test suivant (le portefeuille tombait a 318 au lieu
      // de 424 parce qu'un vieux constat se reglait pendant la mesure).
      if (typeof city !== 'undefined' && city.accidents) {
        for (const acc of city.accidents) for (const c of [acc.a, acc.b]) if (c) { c.accidente = false; c.stopped = false; c.v = 0; c.spd = 0; if (c.etat) c.etat.speed = 0; }
        city.accidents.length = 0;
      }
      // --- 2. LA POLICE EN CONSTAT. pc.constat et pc.debarque figent DEFINITIVEMENT une
      // voiture de patrouille (if (pc.constat) { pc.speed = 0; continue; }). Symptome evite :
      // plus aucune voiture libre pour le constat suivant, donc un accident qui ne se regle
      // jamais et un test de police qui attend une patrouille immobile jusqu'au delai.
      if (typeof police !== 'undefined') for (const pc of (police.cars || [])) {
        pc.constat = null; pc.debarque = false; pc.mission = null; pc.gyro = false; pc.sireneOn = false;
        pc.accidente = false; pc.stopped = false; if (pc.etat) pc.etat.speed = 0;
        // poste Circulation : la priorite de circulation est un BAIL (pc.prio, un horodatage) et
        // le rangement pour la sirene laisse un deport (pc.ecart). Laisses tels quels, le test
        // suivant mesurait une ronde qui se croyait prioritaire et roulait 1,7 m a cote de sa voie.
        pc.prio = 0; pc.ecart = 0; pc.sireneVeh = null; pc.degageT = 0; pc.serviceBloqueT = 0; pc.ia = null; pc.exactVeh = false;
      }
      // --- 3. LA DEPANNEUSE. d.mission reste accroche a l'accident precedent : la flotte est
      // vue comme OCCUPEE (L.find(x => !x.mission) ne trouve plus rien), elle ne repart pas,
      // et son treuil garde la position ou le test d'avant l'a laisse. Symptome exact releve
      // dans la suite : « plateau inclinable (0 rad) et crochet qui descend de -0,2 a -0,2 ».
      if (typeof city !== 'undefined') for (const d of (city.depanneuses || [])) {
        if (d.remorque) { d.remorque.remorque = null; if (d.remorque.caisse) d.remorque.caisse.rotation.x = 0; }
        d.mission = null; d.remorque = null; d.etat = null; d.tarif = 0;
        d.gyro = false; d.sirene = false; d.sireneOn = false; d.recule = false;
        d.busy = false; d.metierBusy = false; d.outil = 0; d.outilCible = 0;
        d.accidente = false; d.stopped = false; d.dmg = 0; d.dead = false;
        d.prio = 0; d.ecart = 0; d.sireneVeh = null; d.degageT = 0; d.serviceBloqueT = 0; d.ia = null; d.exactVeh = false;   // poste Circulation
      }
      // --- 4. LES AMBULANCES. a.etat et a.victime survivent : une ambulance restee en
      // « transport » repose le blesse SUR SON BRANCARD a chaque image — et si la victime est
      // le joueur, porteVictime le TELEPORTE dans la cellule sanitaire a chaque image. Les
      // tests de personnage, de manette et d'arme mesuraient alors un joueur qui n'etait pas
      // la ou ils venaient de le poser. En prime, la flotte etait vue comme occupee et le
      // blesse suivant restait a terre.
      if (typeof city !== 'undefined') for (const a of (city.ambulances || [])) {
        a.etat = null; a.victime = null; a.cible = null; a.t = 0;
        a.gyro = false; a.sirene = false; a.sireneOn = false; a.recule = false;
        a.busy = false; a.metierBusy = false; a.accidente = false; a.stopped = false;
        a.prio = 0; a.ecart = 0; a.sireneVeh = null; a.degageT = 0; a.serviceBloqueT = 0; a.ia = null; a.exactVeh = false;   // poste Circulation
      }
      if (typeof city !== 'undefined') city.urgT = 0;   // le scrutin des urgences reprend tout de suite
      // --- 5. LE JOUEUR BLESSE. P.hp n'etait pas remis a neuf : sous 12 points de vie,
      // urgencesTick appelle une ambulance POUR LE JOUEUR tout seul, et le test suivant se
      // faisait enlever son personnage au milieu de la mesure.
      if (typeof P !== 'undefined') P.hp = 100;
      // --- 6. LA PRISON. Un test qui finit sans un sou part en cellule ; le joueur restait
      // enferme et tous les tests suivants mesuraient un personnage bloque au commissariat.
      if (typeof jail !== 'undefined' && jail.on) { jail.on = false; try { jailFree('banc'); } catch (e20) {} }
      // --- 7. LES VEHICULES D'URGENCE ET DE TRAVAIL RENTRENT CHEZ EUX, LIBRES ET CONDUISIBLES.
      // Deux symptomes : (a) une ambulance ou une depanneuse garee a cote du joueur HURLE en
      // permanence (la sirene du monde reconnait le vehicule a son drapeau urgence, qui ne
      // s'eteint jamais) et les deux tests audio ne mesuraient plus aucun « silence » ;
      // (b) un engin laisse busy refusait le « E : conduire » du test suivant.
      if (typeof city !== 'undefined') for (const v of [].concat(city.depanneuses || [], city.ambulances || [])) {
        if (!v || drive.car === v || !v.home0) continue;
        v.x = v.home0[0]; v.z = v.home0[1]; v.h = v.home0[2];
        v.speed = 0; v.spd = 0; v.v = 0; v.route = null;
        if (v.g) { v.g.position.set(v.x, v.y || 0, v.z); v.g.rotation.set(0, v.h, 0, 'YXZ'); v.g.visible = true; }
        try { settleVehicle(v); vehicleSolid(v); } catch (e21) {}
      }
      // --- 7bis. LES ENGINS FANTOMES ET LEURS BOITES DE COLLISION.
      // Quand le monde est reconstruit, clearWorld detache les maillages mais les TABLEAUX
      // city.ambulances / city.depanneuses gardent les anciens objets. Les remises a zero n° 7
      // et 8 ci-dessous les reposent alors sur leur place de parking et remettent leur boite de
      // collision dans solids — a l'endroit exact ou la NOUVELLE ambulance vient d'etre garee.
      // MESURE : quatre ambulances pour deux places, +3 boites fantomes par reconstruction
      // (21 apres huit). Au bout de cent tests l'ambulance etait MUREE dans ses propres
      // fantomes : « a la manette PS5, R2 avance » lisait -0,14 m/s au lieu de 10,39, et
      // « le garage a demenage » comptait un conflit de murs inexistant.
      // Un objet appartient encore au monde si, en remontant ses parents, on retombe sur la
      // scene : c'est le seul critere sur : le maillage d'un fantome garde son parent (le groupe
      // auquel il appartenait), mais ce groupe-la n'est plus accroche a rien.
      var dansLeMonde = function (m) { var n = m, k = 0; while (n && k++ < 64) { if (n === scene) return true; n = n.parent; } return false; };
      if (typeof city !== 'undefined') for (const nomFlotte of ['ambulances', 'depanneuses', 'cars', 'aiCars', 'mannequins']) {
        const L = city[nomFlotte]; if (!Array.isArray(L)) continue;
        for (let kv = L.length - 1; kv >= 0; kv--) {
          const ve = L[kv], gr = ve && (ve.g || ve.group);
          if (gr && !dansLeMonde(gr)) L.splice(kv, 1);
        }
      }
      if (typeof solids !== 'undefined') {
        var nFantomes = 0;
        for (var kf = solids.length - 1; kf >= 0; kf--) {
          var sf = solids[kf];
          if (sf && sf.mesh && !dansLeMonde(sf.mesh)) { solids.splice(kf, 1); nFantomes++; }
        }
        if (nFantomes) { try { sgridSale(); } catch (e35) {} }
      }
      // --- 8. UN VEHICULE DE SERVICE SORTI DE LA FLOTTE CONDUISIBLE. Les outils (treuil,
      // plateau, gyrophare) ne sont animes que pour les vehicules presents dans city.cars :
      // un test qui en retire un laissait la depanneuse muette et immobile, et le test suivant
      // la declarait « non conduisible par le joueur (false) ». On la remet dans la flotte.
      if (typeof city !== 'undefined' && city.cars) for (const v of [].concat(city.depanneuses || [], city.ambulances || [])) {
        if (v && city.cars.indexOf(v) < 0) city.cars.push(v);
        if (v && v.solid && typeof solids !== 'undefined' && solids.indexOf(v.solid) < 0) { solids.push(v.solid); try { sgridSale(); } catch (e22) {} }
      }
      // --- 9. LES EQUIPES DE METIER AU REPOS. metiersRepos() referme les chantiers, eteint
      // les incendies, rebouche les nids-de-poule, ramasse les detritus, renvoie chaque
      // travailleur devant son hangar et rend tous les vehicules de travail a leur place, non
      // occupes. Sans cela, un chantier plante au milieu de la rue et une equipe en pleine
      // reparation faussaient la scene du test suivant. Il pose aussi METIERS.reposT
      // (quatre secondes de calme) : c'est VOULU — sans ce repit, le facteur reprenait son velo
      // dans la meme image et le joueur se retrouvait recherche pour vol de vehicule.
      // (on n'appelle metiersRepos que si la vie des metiers est bien en place : dans les mondes
      // d'obstacles il n'y a ni equipe ni chantier, et la fonction partirait sur un tableau absent)
      if (typeof metiersRepos === 'function' && typeof city !== 'undefined' && city.metiers && city.metiers.length && city.chantiers) { try { metiersRepos(); } catch (e23) {} }
      if (typeof city !== 'undefined') { city.boulot = null; city.boulotNear = null; }   // un petit boulot en cours refusait le suivant
      // Et on rend chaque engin de travail VISIBLE et SOLIDE : un test qui masque un vehicule
      // de mission le laissait invisible et sans collision, et le test suivant croyait le
      // depot vide (« 6/7 vehicules de travail conduisibles »).
      if (typeof city !== 'undefined') for (const v of (city.cars || [])) {
        if (!v || !v.travail) continue;
        v.busy = false; v.metierBusy = false; v.gyro = false; v.sireneOn = false;
        v.sirene = false; v.prio = 0; v.ecart = 0; v.sireneVeh = null; v.degageT = 0; v.serviceBloqueT = 0; v.ia = null; v.exactVeh = false;   // poste Circulation
        if (v.g) v.g.visible = true;
        if (v.solid && typeof solids !== 'undefined' && solids.indexOf(v.solid) < 0) { solids.push(v.solid); try { sgridSale(); } catch (e28) {} }
      }
      // --- 10. LES VEHICULES EN FLAMMES ET LES EPAVES. c.dead divise la vitesse maximale par
      // quatre et c.dmg la rabote : le test des rapports de boite ne montait plus au
      // cinquieme, et la carcasse continuait de crepiter dans la mesure de silence.
      if (typeof city !== 'undefined') for (const c of [].concat(city.cars || [], city.aiCars || [])) {
        if (!c) continue;
        if (c.feu || c.enFlammes || c.dead) { try { eteintFeu(c); } catch (e24) {} }
        // ...SAUF quand le test verifie la sauvegarde : loadWorld a deja appele rechargeTout(),
        // qui repose TA voiture dans le garage AVEC ses bosses. On les effacait juste apres, et
        // « la sauvegarde garde tout » lisait « 0 % de bosses » alors qu'elle en avait enregistre 17.
        if (!v.garderSauvegarde && (c.dmg || c.dead || c.explosed)) { c.dmg = 0; c.dead = false; c.explosed = false; try { repairVisual(c); } catch (e25) {} }
        c.accidente = false; c.stopped = false;
      }
      // --- 11. LA BOITE DE VITESSES. Le rapport courant, le verrou anti-va-et-vient (shiftT) et
      // le turbo (boostT) vivent sur drive et sur c.etat : c'est le seul etat de boite qui
      // survive d'un test a l'autre, et un verrou pose a une heure de simulation plus tardive
      // refuse le passage suivant. Symptome releve dans la suite complete : « les rapports
      // montent A1 -> A2 -> A3 -> A4 -> A4 », le cinquieme n'etant jamais atteint. On remet
      // donc la boite au point mort pour que la mesure reparte de zero.
      if (typeof drive !== 'undefined') { drive.gear = 1; drive.shiftT = 0; drive.boostT = 0; }
      if (typeof city !== 'undefined') for (const c of [].concat(city.cars || [], city.aiCars || [], (typeof police !== 'undefined' ? police.cars : []) || [])) {
        if (c && c.etat) { c.etat.gear = 1; c.etat.shiftT = 0; c.etat.boostT = 0; }
      }
      // --- 12. LE TIRAGE AU SORT DE LA CIRCULATION. traficGraine est une graine PARTAGEE qui
      // avance a chaque appel de traficRnd() : la destination d'une ronde de police et celle
      // d'une voiture du trafic dependaient donc de TOUT ce que les tests precedents avaient
      // tire. Symptome mesure : « la police abandonne les recherches » est verte seule, verte
      // derriere un seul voisin, et rouge derriere trois — les deux voitures de ronde restaient
      // plantees sur leur voie, 0 image en mouvement sur 85 s de simulation. On remet la graine
      // a sa valeur de depart : chaque test retrouve le meme tirage qu'au premier chargement.
      if (typeof traficGraine !== 'undefined') traficGraine = 20240607;
      // --- 13. LA SIRENE ET LE GYROPHARE DU JOUEUR. sireneMission laisse c.sireneOn et un
      // son de sirene en boucle : la mesure de silence des deux tests audio partait deja a
      // pleine puissance.
      if (typeof siren !== 'undefined') { try { siren.stop(); } catch (e26) {} }
      // --- 14. L'INVENTAIRE DU JOUEUR. C'est le residu que MEME un monde neuf ne repare pas :
      // owned (les achats), le portefeuille, les grenades et l'arme en main vivent EN DEHORS du
      // monde, loadWorld ne les touche pas. Or chaque test qui s'offre un fusil a lunette ou un
      // couteau le laisse a tout jamais, et ces achats reviennent meme apres un rechargement de
      // page (ils sont enregistres). Symptome exact releve dans la suite complete : « la croix
      // gauche/droite » fait defiler les armes POSSEDEES, et le tour attendu
      // pistolet -> fusil -> mains nues devenait pistolet -> fusil -> fusil a lunette -> couteau ;
      // « le couteau s'achete » lisait « deja possede » ; le harnais de dos restait visible apres
      // qu'on ait rendu les deux fusils. On repose donc l'inventaire tel qu'il etait au premier
      // chargement de la page (sauf, evidemment, quand le test verifie justement la sauvegarde).
      if (!v.garderSauvegarde && !v.garderAchats && typeof owned !== 'undefined') {
        owned.clear(); for (var ia = 0; ia < __SHOT.achats0.length; ia++) owned.add(__SHOT.achats0[ia]);
        try { saveOwned(); } catch (e29) {}
        if (typeof wallet !== 'undefined') { wallet = __SHOT.argent0; try { saveWallet(); } catch (e30) {} }
        P.grenades = 0; P.ammo = 0; P.drawn = false; P.aim = false; P.melee = null; P.gun = false;
        try { equipWeapon(null); } catch (e31) {}
        try { setWeapon(me, null); } catch (e32) {}
        try { majEtuis(); } catch (e33) {}
        try { updateHud(); } catch (e34) {}
        // Meme famille : la PREPARATION DE LA VOITURE et le CARNET D'AMIS. Un moteur de
        // niveau 2 et trois kits laisses par un test changent la vitesse de pointe de la
        // voiture du test suivant (c'est un des soupcons sur « le cinquieme rapport n'est
        // jamais atteint »), et un habitant devenu ami ne se bat plus, ne vole plus et ne
        // repond plus pareil. Les deux sont enregistres : ils reviennent meme apres un
        // rechargement de page. On repart des valeurs d'usine.
        if (typeof tuning !== 'undefined' && typeof TUNE_DEF !== 'undefined') {
          for (const kt of Object.keys(tuning)) delete tuning[kt];
          Object.assign(tuning, JSON.parse(JSON.stringify(TUNE_DEF)));
          try { saveTuning(); } catch (e35b) {}
        }
        if (typeof amis !== 'undefined') { amis.clear(); try { saveAmis(); } catch (e36) {} }
        if (typeof bank !== 'undefined') { bank.balance = 0; bank.coffresJour = 0; }
        // LA TENUE PORTEE. Un test qui essaie toutes les chaussures de la boutique, une
        // casquette ou un sac laisse le personnage habille comme ca pour les 200 tests
        // suivants — et la morphologie change les mesures de geometrie du poste Personnages.
        if (typeof myCfg !== 'undefined' && __SHOT.look0) {
          for (const kl of Object.keys(__SHOT.look0)) if (kl in myCfg) myCfg[kl] = __SHOT.look0[kl];
          try { applyMyLook(); } catch (e37) {}
        }
        // LE CHIEN ADOPTE. Il suit le joueur d'un test a l'autre, aboie, mord et se met entre
        // le joueur et ce qu'on mesure ; et ses points de vie restaient a 20 apres une bagarre.
        if (typeof chien !== 'undefined') {
          chien.pet = null; chien.nom = ''; chien.attenteNom = false; chien.attaque = null; chien.attaqueT = 0;
          chien.couche = false; chien.tag = null; chien.ordre = null; chien.ordreT = 0; chien.poste = null;
          chien.saut = 0; chien.patte = 0; chien.garde = 0; chien.balle = null; chien.repas = 0;
          chien.hp = chien.hpMax || 60; chien.perf = 22; chien.bond = 0; chien.bondT = 0;
          try { localStorage.removeItem('superobby.chien'); } catch (e38) {}
        }
        // LE STOCKAGE. Tout ce qui precede est aussi ECRIT sur le disque : sans ce menage, la
        // progression d'un test revenait apres le rechargement de page du test de sauvegarde.
        try { for (const cle of ['superobby.perf', 'superobby.progress', 'superobby.carriere', 'superobby.stats',
          'superobby.guerre', 'superobby.jail', 'superobby.grenades', 'superobby.muni', 'superobby.turbo']) localStorage.removeItem(cle); } catch (e39) {}
      }
    } catch (e27) {}
    // Les tests qui ont besoin d'un terrain degage poussent les figurants a 400 m ; sans ce
    // rappel ils n'en revenaient jamais et les tests suivants trouvaient une ville deserte.
    try {
      if (typeof bots !== 'undefined') for (const b of bots) {
        if (Math.abs(b.pos.x) < 260 && Math.abs(b.pos.z) < 340) continue;
        b.pos.set((Math.random() - 0.5) * 60, 0.3, 40 + (Math.random() - 0.5) * 60);
        b.av.group.position.copy(b.pos); b.av.group.visible = true; b.rdv = null; b.wait = 0;
      }
      if (typeof gangs !== 'undefined') for (const g of gangs) for (const m of g.membres) {
        if (Math.abs(m.x) < 260 && Math.abs(m.z) < 340) continue;
        m.x -= 400; m.z -= 400; if (m.av) m.av.group.position.set(m.x, m.y, m.z);
      }
    } catch (e11) {}
    if (!v.garderQualite && settings.quality !== 'high') { settings.quality = 'high'; try { applyQuality(); } catch (e12) {} }   // l'Ultra HD doublerait le temps du banc d'essai
    // Les ORDRES ne survivent pas d'un test a l'autre : un garde du corps, un protege, une
    // partie de tennis ou un rendez-vous laisses par le test precedent changeaient le
    // comportement de tout le monde dans le suivant (le garde revenait « a sa place »...).
    try {
      if (typeof bots !== 'undefined') for (const b of bots) { b.gardeCorps = 0; b.garde = 0; b.gardeVilla = 0; b.protege = null; b.gardeArme = 0; b.sport = null; b.rdv = null; b.rdvRoute = null; b.drive = null; b.bagarre = null; b.fight = null; b.ordre = null; b.slotGarde = 0; b.activite = null; }
      if (typeof tm !== 'undefined') { tm.on = false; tm.bot = null; }
      if (typeof fm !== 'undefined') { fm.on = false; fm.bot = null; }
      if (typeof gang !== 'undefined') { gang.mission = null; if (gang.missions) gang.missions.length = 0; }
    } catch (e13) {}
    settings.ctrl = 'cam';                       // la caméra ne suit plus l'orientation du joueur
    // L'heure se pilote par simTime (journee de 7 h a 19 h). Mais l'horloge ne doit JAMAIS
    // reculer : des minuteries posees par un test precedent (le prochain habitant qui va au
    // casino, la prochaine reunion de gang...) vivent sur des objets qui, eux, survivent, et
    // se retrouvaient alors dans un futur inatteignable. On avance donc d'un nombre entier de
    // journees : meme heure affichee, horloge toujours croissante.
    if (v.hour != null) {
      // LA NUIT N'EXISTE PAS DANS LE CYCLE AUTOMATIQUE : l'horloge du jeu ne va que de 7 h a
      // 19 h, et l'obscurite y est plafonnee (AMBIANCES.auto). Une vue demandee a « 23 h »
      // retombait donc, sans un mot, sur 11 h du matin : toutes les captures et toutes les
      // mesures dites « de nuit » etaient prises en plein jour. Hors de la plage du cycle, on
      // FIGE donc l'ambiance sur le moment demande (matin, couchant, nuit) ; dedans, on remet
      // le cycle automatique pour ne pas laisser la nuit collee au test suivant.
      var ambVoulue = (v.hour >= 21 || v.hour < 5) ? 'nuit' : v.hour >= 19 ? 'couchant' : v.hour < 7 ? 'matin' : null;
      try { settings.ambiance = ambVoulue || 'auto'; } catch (e) {}
      var hVoulue = ambVoulue && typeof AMBIANCES !== 'undefined' && AMBIANCES[ambVoulue] ? AMBIANCES[ambVoulue].h : v.hour;
      const cible = ((hVoulue - 7 + 12) % 12) / 12 * day.len;
      const jours = Math.max(0, Math.ceil((simTime - cible) / day.len));
      simTime = cible + jours * day.len;
      try { day.last = -1; dayTick(); } catch (e) {}   // la lumiere prend tout de suite, sans attendre une image
    }
    // La camera suit le joueur en douceur : apres une teleportation elle met plusieurs images
    // a le rattraper, et une mesure prise entre-temps porte sur une camera encore en route.
    // On la pose donc d'un coup sur le nouveau point de vue.
    if (v.x != null) { P.pos.set(v.x, v.y, v.z); P.vel.set(0, 0, 0); cam.target.set(v.x, v.y + 1.5, v.z); }
    if (v.facing != null) P.facing = v.facing;
    cam.yaw = v.yaw != null ? v.yaw : P.facing;
    if (v.pitch != null) cam.pitch = v.pitch;
    if (v.dist != null) { cam.base = v.dist; cam.dist = v.dist; }
    cam.freeUntil = 1e9;                         // fige l'orientation demandée
    if (v.tv && typeof modeTV === 'function') modeTV(true); else if (v.tv === false && typeof modeTV === 'function') modeTV(false);
    if (v.salonTV && typeof ouvreSalonTV === 'function') { try { ouvreSalonTV(); } catch (e9) {} }
    if (v.menu && typeof toggleMenu === 'function') { try { toggleMenu(true); } catch (e14) {} }   // capture du menu des reglages (poste F)
    if (v.mixOuvert) { try { document.getElementById('mixBloc').open = true; document.getElementById('mixBloc').scrollIntoView(); } catch (e15) {} }
    if (v.manette && typeof manetteOuvre === 'function') { try { manetteOuvre(''); document.getElementById('manette').classList.add('pret'); } catch (e10) {} }
    // POSTE MANETTE : v.aide sort le bandeau de la legende des touches (il ne s'affiche
    // normalement qu'a la demande, par le pave tactile) ; v.padTest ouvre « Tester la manette ».
    if (v.aide) { document.body.classList.add('manette', 'city', 'aide'); }
    if (v.padTest && typeof ouvreTestManette === 'function') { try { ouvreTestManette(); } catch (e16) {} }
    // LE RADAR s'appelle #gps, pas #radar : hideHud visait un identifiant qui n'existe pas, et
    // le radar restait donc allume sur TOUTES les captures « sans interface » (et devenait
    // enorme en mode tele). En plus rien ne le rallumait : une vue hideHud:false prise apres
    // une vue hideHud:true restait nue. On liste les vrais identifiants, et on remet
    // l'affichage a sa valeur CSS quand hideHud n'est pas demande.
    document.querySelectorAll('#top,#chat,#gps,#act,#missionHud,#wanted,#padLeg,#tvBadge').forEach(function (e) { e.style.display = v.hideHud ? 'none' : ''; });
    if (v.noClip) { P.pos.y = v.y; P.vel.set(0, 0, 0); }
    if (v.sansBots) bots.forEach(function (b) { b.av.group.visible = false; });
    if (v.dormir) { const b = city.beds[0]; if (b) { P.pos.set(b.x, b.y + 1, b.z); city.bedNear = b; sleepBed(); } }
    if (v.arme) { owned.add('arme:' + v.arme); equipWeapon(v.arme); drawWeapon(true); P.aimPitch = v.pitchVisee || 0; }
    // POSTE PERSONNAGES : le couteau photographie de PROFIL. v.couteau = 'fourreau' garnit les
    // deux etuis (couteau a une hanche, pistolet a l'autre), 'main' met la lame dans le poing.
    // On laisse P.drawn a faux : « arme degainee » force le personnage a regarder la camera
    // (P.facing = cam.yaw + PI), et on ne verrait JAMAIS le geste autrement que de dos.
    if (v.couteau) { try { owned.add('arme:knife'); owned.add('arme:pistol'); majEtuis();
      equipWeapon('knife'); setWeapon(me, 'knife', v.couteau === 'main'); P.drawn = false; P.holsterT = 0;
      // P.gun = false : sinon la boucle d'image (« l'arme en main suit P.drawn ») REMETTAIT la
      // lame au fourreau a l'image suivante, et on photographiait un poing vide.
      if (v.couteau === 'main') P.gun = false;
      if (v.facing != null) P.facing = v.facing;
      // (le radar qui masquait les etuis est desormais eteint par hideHud lui-meme, plus haut)
    } catch (e16) {} }
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
    // poste J : plante une scene de metier (chantier, incendie, facteur, balayeur, laveur)
    if (v.metier && typeof metierScene === 'function') { try { metierScene(v.metier); } catch (e14) {} }
    // poste Animation : fige un mouvement sur une image PRECISE, pour photographier une
    // serie d'instants successifs du meme geste (v.anim = { combat, u, garde, geste, t, opt }).
    if (typeof ANIM !== 'undefined' && ANIM) {
      ANIM.fige = v.anim || null;
      if (typeof RALENTI !== 'undefined' && RALENTI) RALENTI.fige = null;
      // poste Animation : plante une scene d'animation A L'ENDROIT DU JOUEUR et l'avance
      // jusqu'a l'instant v.u (0 -> 1). v.scene = depanneuse | reparateur | creuse | grue |
      // bulldozer | ralenti. Sans ca, aucune manoeuvre longue n'etait photographiable.
      if (v.scene && typeof animScenePhoto === 'function') { try { animScenePhoto(v.scene, v.u); } catch (e16) {} }
      if (v.anim && v.anim.adversaire) {   // un adversaire plante devant le joueur, pour le combat
        try {
          const b = bots[0];
          b.pos.set(P.pos.x + Math.sin(P.facing) * 1.35, P.pos.y, P.pos.z + Math.cos(P.facing) * 1.35);
          b.rdv = null; b.wait = 99; b.ko = 0; b.hp = 100; b.fight = null; b.av.group.visible = true;
          b.av.group.position.copy(b.pos); b.facing = P.facing + Math.PI; b.av.group.rotation.y = b.facing;
        } catch (e15) {}
      }
    }
    // poste FINITION : trois bots plantes AU MEME ENDROIT et qui parlent tous, pour
    // photographier des bulles de dialogue qui se chevauchent (v.bulles = nombre de bots)
    if (v.bulles) {
      try {
        const n = Math.min(v.bulles, bots.length);
        for (let i = 0; i < n; i++) {
          const b = bots[i];
          b.pos.set(P.pos.x + Math.sin(P.facing) * (3 + i * 0.25), P.pos.y, P.pos.z + Math.cos(P.facing) * (3.2 + i * 0.2));
          b.rdv = null; b.wait = 99; b.ko = 0; b.hp = 100; b.fight = null; b.av.group.visible = true;
          b.av.group.position.copy(b.pos); b.facing = P.facing + Math.PI; b.av.group.rotation.y = b.facing;
          bubble(b.av, ['Salut !', 'Belle journée…', 'Tu vas où comme ça ?', 'Attention à la route !'][i % 4]);
          b.av.bubbleT = simTime + 1e6;   // la bulle ne doit pas expirer pendant les 8 s de pose de la capture
        }
      } catch (e16) {}
    }
    // poste FINITION : un itineraire GPS actif, pour photographier les chevrons au sol
    if (v.gps) { try { setBeacon(v.gps[0], v.gps[1], 0, 'mission'); gpsRoute.update(); } catch (e17) {} }
    // poste INFRASTRUCTURE : v.classe = numero de salle (0 a 3), v.place = numero de chaise.
    // On ASSOIT vraiment le joueur a une table d'ecolier, pour photographier ce que l'enfant
    // voit pendant l'exercice : c'est la seule facon de verifier que le tableau reste degage.
    if (v.classe != null) {
      try {
        const r = (city.classes || [])[v.classe] || (city.classes || [])[0];
        if (r) {
          const ch = r.chaises[v.place != null ? v.place : 1];
          P.pos.set(ch.x, ch.y, ch.z); P.vel.set(0, 0, 0); cam.target.set(ch.x, ch.y + 1.5, ch.z);
          sitBench(ch);
          if (v.exercice && typeof openSchool === 'function') openSchool(r);
        }
      } catch (e18) {}
    }
  },
  stats() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    world: worldIdx, solides: solids.length, heure: +day.h.toFixed(1), nuit: +day.night.toFixed(2) }; }
};
window.__G = {
  P, city, drive, police, jail, bank, mission, net, race, gym, cam, settings, me, bots, RALLY, tm, shared, ballMats, owned,
  updateBot, tennisMatchTick, policeTick, worldGroup, THREE,
  fm: typeof fm !== 'undefined' ? fm : null,
  joy: typeof joy !== 'undefined' ? joy : null,
  ROT_MORTE: typeof ROT_MORTE !== 'undefined' ? ROT_MORTE : 0,
  PAD_MAP: typeof PAD_MAP !== 'undefined' ? PAD_MAP : null,
  PT_ROLES: typeof PT_ROLES !== 'undefined' ? PT_ROLES : null,
  padLu: typeof padLu === 'function' ? padLu : null,
  padProfil: typeof padProfil === 'function' ? padProfil : null,
  padChapeau: typeof padChapeau === 'function' ? padChapeau : null,
  padCourse: typeof padCourse === 'function' ? padCourse : null,
  padActif: typeof padActif === 'function' ? padActif : null,
  padAction: typeof padAction === 'function' ? padAction : null,
  padEssaiTick: typeof padEssaiTick === 'function' ? padEssaiTick : null,
  ouvreTestManette: typeof ouvreTestManette === 'function' ? ouvreTestManette : null,
  armeSuivante: typeof armeSuivante === 'function' ? armeSuivante : null,
  PAD_CROIX_LONG: typeof PAD_CROIX_LONG !== 'undefined' ? PAD_CROIX_LONG : null,
  PAD_LONG: typeof PAD_LONG !== 'undefined' ? PAD_LONG : 0,
  PAD_BOUTONS: typeof PAD_BOUTONS !== 'undefined' ? PAD_BOUTONS : 0,
  readInput: typeof readInput === 'function' ? readInput : null,
  gachetteConduite: typeof gachetteConduite === 'function' ? gachetteConduite : null,
  CONDUITE_V0: typeof CONDUITE_V0 !== 'undefined' ? CONDUITE_V0 : 0,
  CONDUITE_V1: typeof CONDUITE_V1 !== 'undefined' ? CONDUITE_V1 : 0,
  FREIN_PEDALE: typeof FREIN_PEDALE !== 'undefined' ? FREIN_PEDALE : 0,
  FREIN_MAIN: typeof FREIN_MAIN !== 'undefined' ? FREIN_MAIN : 0,
  heliPoser: typeof heliPoser === 'function' ? heliPoser : null,
  heliSolSous: typeof heliSolSous === 'function' ? heliSolSous : null,
  HELI_POSE_MAX: typeof HELI_POSE_MAX !== 'undefined' ? HELI_POSE_MAX : 0,
  PT_AXES: typeof PT_AXES !== 'undefined' ? PT_AXES : null,
  SPEED: typeof SPEED !== 'undefined' ? SPEED : 0,
  driveStep: typeof driveStep === 'function' ? driveStep : null,
  diffusion: typeof diffusion !== 'undefined' ? diffusion : null,
  diffusionMode: typeof diffusionMode === 'function' ? diffusionMode : null,
  diffusionMesure: typeof diffusionMesure === 'function' ? diffusionMesure : null,
  PALIERS_TV: typeof PALIERS_TV !== 'undefined' ? PALIERS_TV : null,
  paliersActifs: typeof paliersActifs === 'function' ? paliersActifs : null,
  DIFFUSION_CIBLE: typeof DIFFUSION_CIBLE !== 'undefined' ? DIFFUSION_CIBLE : 0,
  tvSalonMaj: typeof tvSalonMaj === 'function' ? tvSalonMaj : null,
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
  conduire: typeof conduire === 'function' ? conduire : null,
  commandesManette: typeof commandesManette === 'function' ? commandesManette : null,
  conduireVersPoint: typeof conduireVersPoint === 'function' ? conduireVersPoint : null,
  calerRoues: typeof calerRoues === 'function' ? calerRoues : null,
  prepareVehicule: typeof prepareVehicule === 'function' ? prepareVehicule : null,
  rouesTick: typeof rouesTick === 'function' ? rouesTick : null,
  fumeeRoues: typeof fumeeRoues === 'function' ? fumeeRoues : null,
  poseVehicule: typeof poseVehicule === 'function' ? poseVehicule : null,
  moteurRegime: typeof moteurRegime === 'function' ? moteurRegime : null,
  petarade: typeof petarade === 'function' ? petarade : null,
  boom: typeof boom === 'function' ? boom : null,
  choc: typeof choc === 'function' ? choc : null,
  ecraseAuSol: typeof ecraseAuSol === 'function' ? ecraseAuSol : null,
  ouvreAccident: typeof ouvreAccident === 'function' ? ouvreAccident : null,
  accidentsTick: typeof accidentsTick === 'function' ? accidentsTick : null,
  regleAccident: typeof regleAccident === 'function' ? regleAccident : null,
  rouleVers: typeof rouleVers === 'function' ? rouleVers : null,
  PLACES: typeof PLACES !== 'undefined' ? PLACES : null,
  PLACES_ORDRE: typeof PLACES_ORDRE !== 'undefined' ? PLACES_ORDRE : null,
  placesDe: typeof placesDe === 'function' ? placesDe : null,
  placeMonde: typeof placeMonde === 'function' ? placeMonde : null,
  assiedAvatar: typeof assiedAvatar === 'function' ? assiedAvatar : null,
  assiedChien: typeof assiedChien === 'function' ? assiedChien : null,
  placeOccupants: typeof placeOccupants === 'function' ? placeOccupants : null,
  makeDepanneuse: typeof makeDepanneuse === 'function' ? makeDepanneuse : null,
  poseAccident: typeof poseAccident === 'function' ? poseAccident : null,
  camConduite: typeof camConduite === 'function' ? camConduite : null,
  vitesseRel: typeof vitesseRel === 'function' ? vitesseRel : null,
  reculConduite: typeof reculConduite === 'function' ? reculConduite : null,
  poseJoueurAuVolant: typeof poseJoueurAuVolant === 'function' ? poseJoueurAuVolant : null,
  makeVehiculeTravail: typeof makeVehiculeTravail === 'function' ? makeVehiculeTravail : null,
  solSousRoues: typeof solSousRoues === 'function' ? solSousRoues : null,
  depanneuseAppel: typeof depanneuseAppel === 'function' ? depanneuseAppel : null,
  depanneusesTick: typeof depanneusesTick === 'function' ? depanneusesTick : null,
  makeAmbulance: typeof makeAmbulance === 'function' ? makeAmbulance : null,
  ambulanceAppel: typeof ambulanceAppel === 'function' ? ambulanceAppel : null,
  ambulancesTick: typeof ambulancesTick === 'function' ? ambulancesTick : null,
  urgencesTick: typeof urgencesTick === 'function' ? urgencesTick : null,
  servicesTick: typeof servicesTick === 'function' ? servicesTick : null,
  nitroGo: typeof nitroGo === 'function' ? nitroGo : null,
  nitroTick: typeof nitroTick === 'function' ? nitroTick : null,
  jambesEnCabine: typeof jambesEnCabine === 'function' ? jambesEnCabine : null,
  caisseFermee: typeof caisseFermee !== 'undefined' ? caisseFermee : null,
  groundCar: typeof groundCar === 'function' ? groundCar : null,
  camera: typeof camera !== 'undefined' ? camera : null,
  cam: typeof cam !== 'undefined' ? cam : null,
  horn: typeof horn === 'function' ? horn : null,
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
  tableauMaj: typeof tableauMaj === 'function' ? tableauMaj : null,
  tableauPose: typeof tableauPose === 'function' ? tableauPose : null,
  tableauRendu: typeof tableauRendu === 'function' ? tableauRendu : null,
  tableauQuestion: typeof tableauQuestion === 'function' ? tableauQuestion : null,
  tableauVerdict: typeof tableauVerdict === 'function' ? tableauVerdict : null,
  craieTick: typeof craieTick === 'function' ? craieTick : null,
  camTableau: typeof camTableau === 'function' ? camTableau : null,
  schoolTick: typeof schoolTick === 'function' ? schoolTick : null,
  sonCraie: typeof sonCraie === 'function' ? sonCraie : null,
  bulleMaitresse: typeof bulleMaitresse === 'function' ? bulleMaitresse : null,
  CRAIE_CPS: typeof CRAIE_CPS !== 'undefined' ? CRAIE_CPS : 0,
  craieLit: typeof craieLit !== 'undefined' ? craieLit : null,
  CRAIE_NIV: typeof CRAIE_NIV !== 'undefined' ? CRAIE_NIV : 0,
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
  GANTS: typeof GANTS !== 'undefined' ? GANTS : null,
  SAC_BANANE: typeof SAC_BANANE !== 'undefined' ? SAC_BANANE : null,
  poseChaussures: typeof poseChaussures === 'function' ? poseChaussures : null,
  poseGants: typeof poseGants === 'function' ? poseGants : null,
  mainDroite: typeof mainDroite === 'function' ? mainDroite : null,
  JERSEYS: typeof JERSEYS !== 'undefined' ? JERSEYS : null,
  jerseyOf: typeof jerseyOf === 'function' ? jerseyOf : null,
  itemKey: typeof itemKey === 'function' ? itemKey : null,
  rangementAuto: typeof rangementAuto === 'function' ? rangementAuto : null,
  setEtuis: typeof setEtuis === 'function' ? setEtuis : null,
  mesEtuis: typeof mesEtuis === 'function' ? mesEtuis : null,
  majEtuis: typeof majEtuis === 'function' ? majEtuis : null,
  appuiDosMonde: typeof appuiDosMonde === 'function' ? appuiDosMonde : null,
  knifeMesh: typeof knifeMesh === 'function' ? knifeMesh : null,
  coupCouteau: typeof coupCouteau === 'function' ? coupCouteau : null,
  garde: typeof garde === 'function' ? garde : null,
  esquive: typeof esquive === 'function' ? esquive : null,
  setGarde: typeof setGarde === 'function' ? setGarde : null,
  setAccroupi: typeof setAccroupi === 'function' ? setAccroupi : null,
  defenseJoueur: typeof defenseJoueur === 'function' ? defenseJoueur : null,
  hurt: typeof hurt === 'function' ? hurt : null,
  attack: typeof attack === 'function' ? attack : null,
  combatTick: typeof combatTick === 'function' ? combatTick : null,
  brancardMesh: typeof brancardMesh === 'function' ? brancardMesh : null,
  creerBrancard: typeof creerBrancard === 'function' ? creerBrancard : null,
  porterBrancard: typeof porterBrancard === 'function' ? porterBrancard : null,
  poserBrancard: typeof poserBrancard === 'function' ? poserBrancard : null,
  allongerSurBrancard: typeof allongerSurBrancard === 'function' ? allongerSurBrancard : null,
  descendreDuBrancard: typeof descendreDuBrancard === 'function' ? descendreDuBrancard : null,
  chargerBrancard: typeof chargerBrancard === 'function' ? chargerBrancard : null,
  sortirBrancard: typeof sortirBrancard === 'function' ? sortirBrancard : null,
  brancardTick: typeof brancardTick === 'function' ? brancardTick : null,
  brancardEtat: typeof brancardEtat === 'function' ? brancardEtat : null,
  creerAmbulancier: typeof creerAmbulancier === 'function' ? creerAmbulancier : null,
  embarqueBlesse: typeof embarqueBlesse === 'function' ? embarqueBlesse : null,
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
  marqueImpact: typeof marqueImpact === 'function' ? marqueImpact : null,
  nommeLesBatiments: typeof nommeLesBatiments === 'function' ? nommeLesBatiments : null,
  degageDecorSurRoutes: typeof degageDecorSurRoutes === 'function' ? degageDecorSurRoutes : null,
  chocDecor: typeof chocDecor === 'function' ? chocDecor : null,
  solideTouche: typeof solideTouche === 'function' ? solideTouche : null,
  batimentTouche: typeof batimentTouche === 'function' ? batimentTouche : null,
  faceTouchee: typeof faceTouchee === 'function' ? faceTouchee : null,
  sorteSelonForce: typeof sorteSelonForce === 'function' ? sorteSelonForce : null,
  effaceMarques: typeof effaceMarques === 'function' ? effaceMarques : null,
  MARQUES_MAX: typeof MARQUES_MAX !== 'undefined' ? MARQUES_MAX : null,
  MARQUES_MUR_MAX: typeof MARQUES_MUR_MAX !== 'undefined' ? MARQUES_MUR_MAX : null,
  MARQUE_SORTES: typeof MARQUE_SORTES !== 'undefined' ? MARQUE_SORTES : null,
  get marquesMesh() { return typeof marquesMesh !== 'undefined' ? marquesMesh : null; },
  fragile: typeof fragile === 'function' ? fragile : null,
  bonhommeNeige: typeof bonhommeNeige === 'function' ? bonhommeNeige : null,
  coneRue: typeof coneRue === 'function' ? coneRue : null,
  CASSE_DEF: typeof CASSE_DEF !== 'undefined' ? CASSE_DEF : null,
  breakThing: typeof breakThing === 'function' ? breakThing : null,
  repareChose: typeof repareChose === 'function' ? repareChose : null,
  chercheCasse: typeof chercheCasse === 'function' ? chercheCasse : null,
  repareCible: typeof repareCible === 'function' ? repareCible : null,
  buildNeigeDecor: typeof buildNeigeDecor === 'function' ? buildNeigeDecor : null,
  neigeDecor: typeof neigeDecor === 'function' ? neigeDecor : null,
  driveStep: typeof driveStep === 'function' ? driveStep : null,
  poubelle: typeof poubelle === 'function' ? poubelle : null,
  lightsTick: typeof lightsTick === 'function' ? lightsTick : null,
  feuPhase: typeof feuPhase === 'function' ? feuPhase : null,
  ligneFeu: typeof ligneFeu === 'function' ? ligneFeu : null,
  trafficLight: typeof trafficLight === 'function' ? trafficLight : null,
  signalisation: typeof signalisation === 'function' ? signalisation : null,
  carrefours: typeof carrefours === 'function' ? carrefours : null,
  panneau: typeof panneau === 'function' ? panneau : null,
  crosswalk: typeof crosswalk === 'function' ? crosswalk : null,
  roleVoie: typeof roleVoie === 'function' ? roleVoie : null,
  VOIES: typeof VOIES !== 'undefined' ? VOIES : null,
  FEU_VERT: typeof FEU_VERT !== 'undefined' ? FEU_VERT : null,
  FEU_ORANGE: typeof FEU_ORANGE !== 'undefined' ? FEU_ORANGE : null,
  FEU_CYCLE: typeof FEU_CYCLE !== 'undefined' ? FEU_CYCLE : null,
  PLAN_ROUTIER: typeof PLAN_ROUTIER !== 'undefined' ? PLAN_ROUTIER : null,
  trottoirs: typeof trottoirs === 'function' ? trottoirs : null,
  decorPublic: typeof decorPublic === 'function' ? decorPublic : null,
  degageLesRoutes: typeof degageLesRoutes === 'function' ? degageLesRoutes : null,
  finirPlan: typeof finirPlan === 'function' ? finirPlan : null,
  openEtal: typeof openEtal === 'function' ? openEtal : null,
  majEtal: typeof majEtal === 'function' ? majEtal : null,
  acheterArticle: typeof acheterArticle === 'function' ? acheterArticle : null,
  MARCHE: typeof MARCHE !== 'undefined' ? MARCHE : null,
  VILLA_HALF: typeof VILLA_HALF !== 'undefined' ? VILLA_HALF : null,
  TECHNO: typeof TECHNO !== 'undefined' ? TECHNO : null,
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
  tenueMetier: typeof tenueMetier !== 'undefined' ? tenueMetier : null,
  METIERS_DEF: typeof METIERS_DEF !== 'undefined' ? METIERS_DEF : null,
  METIERS: typeof METIERS !== 'undefined' ? METIERS : null,
  MET_C: typeof MET_C !== 'undefined' ? MET_C : null,
  outilMesh: typeof outilMesh !== 'undefined' ? outilMesh : null,
  donneOutil: typeof donneOutil !== 'undefined' ? donneOutil : null,
  makeVehiculeTravail: typeof makeVehiculeTravail !== 'undefined' ? makeVehiculeTravail : null,
  actionneOutil: typeof actionneOutil !== 'undefined' ? actionneOutil : null,
  outilsVehiculesTick: typeof outilsVehiculesTick !== 'undefined' ? outilsVehiculesTick : null,
  arroseAutour: typeof arroseAutour !== 'undefined' ? arroseAutour : null,
  poseChantier: typeof poseChantier !== 'undefined' ? poseChantier : null,
  retireChantier: typeof retireChantier !== 'undefined' ? retireChantier : null,
  poseNidDePoule: typeof poseNidDePoule !== 'undefined' ? poseNidDePoule : null,
  boucheNidDePoule: typeof boucheNidDePoule !== 'undefined' ? boucheNidDePoule : null,
  poseDetritus: typeof poseDetritus !== 'undefined' ? poseDetritus : null,
  ramasseDetritus: typeof ramasseDetritus !== 'undefined' ? ramasseDetritus : null,
  boiteAuxLettres: typeof boiteAuxLettres !== 'undefined' ? boiteAuxLettres : null,
  declencheIncendie: typeof declencheIncendie !== 'undefined' ? declencheIncendie : null,
  incendiesTick: typeof incendiesTick !== 'undefined' ? incendiesTick : null,
  buildMetiers: typeof buildMetiers !== 'undefined' ? buildMetiers : null,
  metiersReset: typeof metiersReset !== 'undefined' ? metiersReset : null,
  metiersTick: typeof metiersTick !== 'undefined' ? metiersTick : null,
  metiersRepos: typeof metiersRepos !== 'undefined' ? metiersRepos : null,
  employesTick: typeof employesTick !== 'undefined' ? employesTick : null,
  pompiersTick: typeof pompiersTick !== 'undefined' ? pompiersTick : null,
  balayeurTick: typeof balayeurTick !== 'undefined' ? balayeurTick : null,
  laveurTick: typeof laveurTick !== 'undefined' ? laveurTick : null,
  facteurTick: typeof facteurTick !== 'undefined' ? facteurTick : null,
  chercheCasse: typeof chercheCasse !== 'undefined' ? chercheCasse : null,
  repareCible: typeof repareCible !== 'undefined' ? repareCible : null,
  metierParle: typeof metierParle !== 'undefined' ? metierParle : null,
  phraseMetier: typeof phraseMetier !== 'undefined' ? phraseMetier : null,
  prendreBoulot: typeof prendreBoulot !== 'undefined' ? prendreBoulot : null,
  boulotAvance: typeof boulotAvance !== 'undefined' ? boulotAvance : null,
  BOULOTS: typeof BOULOTS !== 'undefined' ? BOULOTS : null,
  metierMarche: typeof metierMarche !== 'undefined' ? metierMarche : null,
  metierRoule: typeof metierRoule !== 'undefined' ? metierRoule : null,
  metierOuvert: typeof metierOuvert !== 'undefined' ? metierOuvert : null,
  creerTravailleur: typeof creerTravailleur !== 'undefined' ? creerTravailleur : null,
  poseBoites: typeof poseBoites !== 'undefined' ? poseBoites : null,
  filetTexture: typeof filetTexture !== 'undefined' ? filetTexture : null,
  boulotTick: typeof boulotTick !== 'undefined' ? boulotTick : null,
  metierProche: typeof metierProche !== 'undefined' ? metierProche : null,
  poseEchelle: typeof poseEchelle !== 'undefined' ? poseEchelle : null,
  metierScene: typeof metierScene !== 'undefined' ? metierScene : null,
  metierSync: typeof metierSync !== 'undefined' ? metierSync : null,
  metierDit: typeof metierDit !== 'undefined' ? metierDit : null,
  metiersEvenements: typeof metiersEvenements !== 'undefined' ? metiersEvenements : null,
  chantiersUsure: typeof chantiersUsure !== 'undefined' ? chantiersUsure : null,
  poubelleRoulante: typeof poubelleRoulante !== 'undefined' ? poubelleRoulante : null,
  terrainLibre: typeof terrainLibre !== 'undefined' ? terrainLibre : null,
  tenuePiece: typeof tenuePiece !== 'undefined' ? tenuePiece : null,
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
  solidifieDecor: typeof solidifieDecor === 'function' ? solidifieDecor : null,
  obstacleDecor: typeof obstacleDecor === 'function' ? obstacleDecor : null,
  boiteMaillage: typeof boiteMaillage === 'function' ? boiteMaillage : null,
  desincarcere: typeof desincarcere === 'function' ? desincarcere : null,
  penetration: typeof penetration === 'function' ? penetration : null,
  tourRoulette: typeof tourRoulette === 'function' ? tourRoulette : null,
  rouletteCine: typeof rouletteCine === 'function' ? rouletteCine : null,
  rouletteEtat: typeof rouletteEtat === 'function' ? rouletteEtat : null,
  ROULETTE_ORDRE: typeof ROULETTE_ORDRE !== 'undefined' ? ROULETTE_ORDRE : null,
  ROUGES: typeof ROUGES !== 'undefined' ? ROUGES : null,
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
  SON: typeof SON !== 'undefined' ? SON : null,
  SOLS: typeof SOLS !== 'undefined' ? SOLS : null,
  bubble: typeof bubble === 'function' ? bubble : null,
  sonFeu: typeof sonFeu === 'function' ? sonFeu : null,
  sonExplosion: typeof sonExplosion === 'function' ? sonExplosion : null,
  sonSirene: typeof sonSirene === 'function' ? sonSirene : null,
  sonRecul: typeof sonRecul === 'function' ? sonRecul : null,
  SIRENES: typeof SIRENES !== 'undefined' ? SIRENES : null,
  urgenceDe: typeof urgenceDe === 'function' ? urgenceDe : null,
  sonMarteau: typeof sonMarteau === 'function' ? sonMarteau : null,
  sonSoudure: typeof sonSoudure === 'function' ? sonSoudure : null,
  sonBalai: typeof sonBalai === 'function' ? sonBalai : null,
  sonJetEau: typeof sonJetEau === 'function' ? sonJetEau : null,
  sonRaclette: typeof sonRaclette === 'function' ? sonRaclette : null,
  sonVentre: typeof sonVentre === 'function' ? sonVentre : null,
  sonParade: typeof sonParade === 'function' ? sonParade : null,
  sonCouteau: typeof sonCouteau === 'function' ? sonCouteau : null,
  declencheIncendie: typeof declencheIncendie === 'function' ? declencheIncendie : null,
  incendiesTick: typeof incendiesTick === 'function' ? incendiesTick : null,
  QUARTIERS: typeof QUARTIERS !== 'undefined' ? QUARTIERS : null,
  ACCUEIL_DELAI: typeof ACCUEIL_DELAI !== 'undefined' ? ACCUEIL_DELAI : null,
  hornEn: typeof hornEn === 'function' ? hornEn : null,
  sonEffort: typeof sonEffort === 'function' ? sonEffort : null,
  sonAboiement: typeof sonAboiement === 'function' ? sonAboiement : null,
  sonEn: typeof sonEn === 'function' ? sonEn : null,
  sonPas: typeof sonPas === 'function' ? sonPas : null,
  sonCoup: typeof sonCoup === 'function' ? sonCoup : null,
  sonAie: typeof sonAie === 'function' ? sonAie : null,
  sonRate: typeof sonRate === 'function' ? sonRate : null,
  sonRotor: typeof sonRotor === 'function' ? sonRotor : null,
  sonBlabla: typeof sonBlabla === 'function' ? sonBlabla : null,
  sonBulle: typeof sonBulle === 'function' ? sonBulle : null,
  sonPortiere: typeof sonPortiere === 'function' ? sonPortiere : null,
  sonPneus: typeof sonPneus === 'function' ? sonPneus : null,
  sonTole: typeof sonTole === 'function' ? sonTole : null,
  sonCloche: typeof sonCloche === 'function' ? sonCloche : null,
  sonsVille: typeof sonsVille === 'function' ? sonsVille : null,
  solSous: typeof solSous === 'function' ? solSous : null,
  cadencePas: typeof cadencePas === 'function' ? cadencePas : null,
  hauteurVoix: typeof hauteurVoix === 'function' ? hauteurVoix : null,
  quartierSon: typeof quartierSon === 'function' ? quartierSon : null,
  ambiance: typeof ambiance !== 'undefined' ? ambiance : null,
  parle: typeof parle === 'function' ? parle : null,
  PARLE: typeof PARLE !== 'undefined' ? PARLE : null,
  accueil: typeof accueil === 'function' ? accueil : null,
  accueilTick: typeof accueilTick === 'function' ? accueilTick : null,
  ACCUEILS: typeof ACCUEILS !== 'undefined' ? ACCUEILS : null,
  SONV: typeof SONV !== 'undefined' ? SONV : null,
  MIX_DEF: typeof MIX_DEF !== 'undefined' ? MIX_DEF : null,
  construitMix: typeof construitMix === 'function' ? construitMix : null,
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
  // ---- poste K (design et graphisme) ----
  empreinte: typeof empreinte === 'function' ? empreinte : null,
  empreintesTick: typeof empreintesTick === 'function' ? empreintesTick : null,
  empreinteMarcheur: typeof empreinteMarcheur === 'function' ? empreinteMarcheur : null,
  effaceEmpreintes: typeof effaceEmpreintes === 'function' ? effaceEmpreintes : null,
  get empreintesMesh() { return typeof empreintesMesh !== 'undefined' ? empreintesMesh : null; },
  EMPREINTES_MAX: typeof EMPREINTES_MAX !== 'undefined' ? EMPREINTES_MAX : 0,
  EMPREINTE_VIE: typeof EMPREINTE_VIE !== 'undefined' ? EMPREINTE_VIE : 0,
  EMPREINTE_PAS: typeof EMPREINTE_PAS !== 'undefined' ? EMPREINTE_PAS : 0,
  jetEauAnime: typeof jetEauAnime === 'function' ? jetEauAnime : null,
  jetEauEtat: typeof jetEauEtat === 'function' ? jetEauEtat : null,
  arroseAutour: typeof arroseAutour === 'function' ? arroseAutour : null,
  feuLumiere: typeof feuLumiere === 'function' ? feuLumiere : null,
  FEU_LUM: typeof FEU_LUM !== 'undefined' ? FEU_LUM : null,
  sonPluie: typeof sonPluie === 'function' ? sonPluie : null,
  METEO_FONDU: typeof METEO_FONDU !== 'undefined' ? METEO_FONDU : 0,
  METEO_DUREE: typeof METEO_DUREE !== 'undefined' ? METEO_DUREE : null,
  PLUIE_RECUL: typeof PLUIE_RECUL !== 'undefined' ? PLUIE_RECUL : 0,
  construitJetEau: typeof construitJetEau === 'function' ? construitJetEau : null,
  JET_PORTEE: typeof JET_PORTEE !== 'undefined' ? JET_PORTEE : 0,
  detailsInit: typeof detailsInit === 'function' ? detailsInit : null,
  detailsLOD: typeof detailsLOD === 'function' ? detailsLOD : null,
  DETAILS: typeof DETAILS !== 'undefined' ? DETAILS : null,
  ARETES: typeof ARETES !== 'undefined' ? ARETES : null,
  DETAIL_FIN: typeof DETAIL_FIN !== 'undefined' ? DETAIL_FIN : 0,
  DETAIL_ARETE: typeof DETAIL_ARETE !== 'undefined' ? DETAIL_ARETE : 0,
  DETAIL_OMBRE: typeof DETAIL_OMBRE !== 'undefined' ? DETAIL_OMBRE : 0,
  OMBRES: typeof OMBRES !== 'undefined' ? OMBRES : null,
  DETAIL_OMBRE_VUE: typeof DETAIL_OMBRE_VUE !== 'undefined' ? DETAIL_OMBRE_VUE : 0,
  feuAnimeUne: typeof feuAnimeUne === 'function' ? feuAnimeUne : null,
  DA: typeof DA !== 'undefined' ? DA : null,
  cielA: typeof cielA === 'function' ? cielA : null,
  cielDome: typeof cielDome !== 'undefined' ? cielDome : null,
  accorde: typeof accorde === 'function' ? accorde : null,
  AMBIANCES: typeof AMBIANCES !== 'undefined' ? AMBIANCES : null,
  lumieresVille: typeof lumieresVille === 'function' ? lumieresVille : null,
  SOLEIL_DIR: typeof SOLEIL_DIR !== 'undefined' ? SOLEIL_DIR : null,
  fill: typeof fill !== 'undefined' ? fill : null,
  post: typeof post !== 'undefined' ? post : null,
  QUALITES: typeof QUALITES !== 'undefined' ? QUALITES : null,
  applyQuality: typeof applyQuality === 'function' ? applyQuality : null,
  rendreImage: typeof rendreImage === 'function' ? rendreImage : null,
  renderer: typeof renderer !== 'undefined' ? renderer : null,
  degatsVehicule: typeof degatsVehicule === 'function' ? degatsVehicule : null,
  feuVehicule: typeof feuVehicule === 'function' ? feuVehicule : null,
  chocVehicule: typeof chocVehicule === 'function' ? chocVehicule : null,
  feuxVehiculesTick: typeof feuxVehiculesTick === 'function' ? feuxVehiculesTick : null,
  marqueMur: typeof marqueMur === 'function' ? marqueMur : null,
  casseBonhomme: typeof casseBonhomme === 'function' ? casseBonhomme : null,
  DEGATS: typeof DEGATS !== 'undefined' ? DEGATS : null,
  graviteChoc: typeof graviteChoc === 'function' ? graviteChoc : null,
  eclatsVerre: typeof eclatsVerre === 'function' ? eclatsVerre : null,
  eteintFeu: typeof eteintFeu === 'function' ? eteintFeu : null,
  crackedGlass: typeof crackedGlass !== 'undefined' ? crackedGlass : null,
  marques: typeof marques !== 'undefined' ? marques : null,
  MARQUES_MAX: typeof MARQUES_MAX !== 'undefined' ? MARQUES_MAX : 0,
  feuxVehicules: typeof feuxVehicules !== 'undefined' ? feuxVehicules : null,
  NEONS: typeof NEONS !== 'undefined' ? NEONS : null,
  ambianceSet: typeof ambianceSet === 'function' ? ambianceSet : null,
  varieTeinte: typeof varieTeinte === 'function' ? varieTeinte : null,
  postDefines: typeof postDefines === 'function' ? postDefines : null,
  debrisTick: typeof debrisTick === 'function' ? debrisTick : null,
  arracheRoue: typeof arracheRoue === 'function' ? arracheRoue : null,
  carcasseNoircie: typeof carcasseNoircie === 'function' ? carcasseNoircie : null,
  stars: typeof stars !== 'undefined' ? stars : null,
  sunSprite: typeof sunSprite !== 'undefined' ? sunSprite : null,
  grilleEcart: typeof grilleEcart === 'function' ? grilleEcart : null,
  surLaLigne: typeof surLaLigne === 'function' ? surLaLigne : null,
  GRILLE_N: typeof GRILLE_N !== 'undefined' ? GRILLE_N : 0,
  GRILLE_JOUEUR: typeof GRILLE_JOUEUR !== 'undefined' ? GRILLE_JOUEUR : 0,
  startCountdown: typeof startCountdown === 'function' ? startCountdown : null,
  raceTick: typeof raceTick === 'function' ? raceTick : null,
  padAction: typeof padAction === 'function' ? padAction : null,
  montreAide: typeof montreAide === 'function' ? montreAide : null,
  cacheAide: typeof cacheAide === 'function' ? cacheAide : null,
  aideTick: typeof aideTick === 'function' ? aideTick : null,
  gpsTick: typeof gpsTick === 'function' ? gpsTick : null,
  trottoirs: typeof trottoirs !== 'undefined' ? trottoirs : null,
  decorPublic: typeof decorPublic !== 'undefined' ? decorPublic : null,
  pointRouteLibre: typeof pointRouteLibre !== 'undefined' ? pointRouteLibre : null,
  pointRouteProche: typeof pointRouteProche !== 'undefined' ? pointRouteProche : null,
  PAVE: typeof PAVE !== 'undefined' ? PAVE : null,
  TROTTOIR: typeof TROTTOIR !== 'undefined' ? TROTTOIR : null,
  ROAD: typeof ROAD !== 'undefined' ? ROAD : null,
  finirPlan: typeof finirPlan !== 'undefined' ? finirPlan : null,
  GANG_DEFS: typeof GANG_DEFS !== 'undefined' ? GANG_DEFS : null,
  VILLAS: typeof VILLAS !== 'undefined' ? VILLAS : null,
  RACE_C: typeof RACE_C !== 'undefined' ? RACE_C : null,
  RALLY: typeof RALLY !== 'undefined' ? RALLY : null,
  buildNav: typeof buildNav !== 'undefined' ? buildNav : null,
  navFree: typeof navFree !== 'undefined' ? navFree : null,
  navCell: typeof navCell !== 'undefined' ? navCell : null,
  navGeo: typeof navGeo !== 'undefined' ? navGeo : null,
  tableauMaj: typeof tableauMaj === 'function' ? tableauMaj : null,
  school: typeof school !== 'undefined' ? school : null,
  answer: typeof answer === 'function' ? answer : null,
  sitBench: typeof sitBench === 'function' ? sitBench : null,
  glassVert: typeof glassVert !== 'undefined' ? glassVert : null,
  animateRig: typeof animateRig === 'function' ? animateRig : null,
  degatsTick: typeof degatsTick === 'function' ? degatsTick : null,
  avDegats: typeof avDegats === 'function' ? avDegats : null,
  degatsTexture: typeof degatsTexture === 'function' ? degatsTexture : null,
  niveauDegats: typeof niveauDegats === 'function' ? niveauDegats : null,
  applyStats: typeof applyStats === 'function' ? applyStats : null,
  setWeapon: typeof setWeapon === 'function' ? setWeapon : null,
  interieur: typeof interieur !== 'undefined' ? interieur : null,
  interieurTick: typeof interieurTick === 'function' ? interieurTick : null,
  interieurDe: typeof interieurDe === 'function' ? interieurDe : null,
  pokerCartes3D: typeof pokerCartes3D === 'function' ? pokerCartes3D : null,
  carteTexture: typeof carteTexture === 'function' ? carteTexture : null,
  carteNom: typeof carteNom === 'function' ? carteNom : null,
  tourRoulette: typeof tourRoulette === 'function' ? tourRoulette : null,
  mesureSon: typeof mesureSon === 'function' ? mesureSon : null,
  padStick: typeof padStick === 'function' ? padStick : null,
  post: typeof post !== 'undefined' ? post : null,
  rendreImage: typeof rendreImage === 'function' ? rendreImage : null,
  QUALITES: typeof QUALITES !== 'undefined' ? QUALITES : null,
  qualite: typeof qualite === 'function' ? qualite : null,
  plafondPixels: typeof plafondPixels === 'function' ? plafondPixels : null,
  navVers: typeof navVers === 'function' ? navVers : null,
  navCibles: typeof navCibles === 'function' ? navCibles : null,
  navOnglet: typeof navOnglet === 'function' ? navOnglet : null,
  navGlisse: typeof navGlisse === 'function' ? navGlisse : null,
  padMenu: typeof padMenu === 'function' ? padMenu : null,
  PAD_HZ: typeof PAD_HZ !== 'undefined' ? PAD_HZ : null,
  PAD_REPET: typeof PAD_REPET !== 'undefined' ? PAD_REPET : null,
  armeSuivante: typeof armeSuivante === 'function' ? armeSuivante : null,
  PAD_CROIX: typeof PAD_CROIX !== 'undefined' ? PAD_CROIX : null,
  PAD_LONG: typeof PAD_LONG !== 'undefined' ? PAD_LONG : null,
  manetteBT: typeof manetteBT !== 'undefined' ? manetteBT : null,
  manetteConnecter: typeof manetteConnecter === 'function' ? manetteConnecter : null,
  manetteBTSonde: typeof manetteBTSonde === 'function' ? manetteBTSonde : null,
  manetteBTEtat: typeof manetteBTEtat === 'function' ? manetteBTEtat : null,
  padSon: typeof padSon === 'function' ? padSon : null,
  sfx: typeof sfx !== 'undefined' ? sfx : null,
  music: typeof music !== 'undefined' ? music : null,
  siren: typeof siren !== 'undefined' ? siren : null,
  MIX: typeof MIX !== 'undefined' ? MIX : null,
  PALIERS: typeof PALIERS !== 'undefined' ? PALIERS : null,
  ombresQualite: typeof ombresQualite === 'function' ? ombresQualite : null,
  ombresTaille: typeof ombresTaille === 'function' ? ombresTaille : null,
  ombreBase: typeof ombreBase === 'function' ? ombreBase : null,
  ratioQualite: typeof ratioQualite === 'function' ? ratioQualite : null,
  sun: typeof sun !== 'undefined' ? sun : null,
  SM: typeof SM !== 'undefined' ? SM : null,
  OMBRE_CADRE: typeof OMBRE_CADRE !== 'undefined' ? OMBRE_CADRE : null,
  rendu: typeof rendu !== 'undefined' ? rendu : null,
  fluiditeTick: typeof fluiditeTick === 'function' ? fluiditeTick : null,
  appliqueRendu: typeof appliqueRendu === 'function' ? appliqueRendu : null,
  ratioRendu: typeof ratioRendu === 'function' ? ratioRendu : null,
  demarreTV: typeof demarreTV === 'function' ? demarreTV : null,
  QR: typeof QR !== 'undefined' ? QR : null,
  tvPasseLaMain: typeof tvPasseLaMain === 'function' ? tvPasseLaMain : null,
  manetteConnecte: typeof manetteConnecte === 'function' ? manetteConnecte : null,
  tvVeille: typeof tvVeille === 'function' ? tvVeille : null,
  RESEAU: typeof RESEAU !== 'undefined' ? RESEAU : null,
  CHAUD: typeof CHAUD !== 'undefined' ? CHAUD : null,
  pollGamepad: typeof pollGamepad === 'function' ? pollGamepad : null,
  padActive: typeof padActive === 'function' ? padActive : null,
  padStick: typeof padStick === 'function' ? padStick : null,
  padVibre: typeof padVibre === 'function' ? padVibre : null,
  PAD_MAP: typeof PAD_MAP !== 'undefined' ? PAD_MAP : null,
  PS_NOMS: typeof PS_NOMS !== 'undefined' ? PS_NOMS : null,
  manetteSalon: typeof manetteSalon !== 'undefined' ? manetteSalon : null,
  camSecousse: typeof camSecousse === 'function' ? camSecousse : null,
  pad: typeof pad !== 'undefined' ? pad : null,
  tiedis: typeof tiedis === 'function' ? tiedis : null,
  applyTheme: typeof applyTheme === 'function' ? applyTheme : null,
  hemi: typeof hemi !== 'undefined' ? hemi : null,
  scene: typeof scene !== 'undefined' ? scene : null,
  netteteTextures: typeof netteteTextures === 'function' ? netteteTextures : null,
  MAN_ESSAIS: typeof MAN_ESSAIS !== 'undefined' ? MAN_ESSAIS : 0,
  tel: typeof tel !== 'undefined' ? tel : null,
  tvHeberge: typeof tvHeberge === 'function' ? tvHeberge : null,
  manetteOuvre: typeof manetteOuvre === 'function' ? manetteOuvre : null,
  manetteFerme: typeof manetteFerme === 'function' ? manetteFerme : null,
  man: typeof man !== 'undefined' ? man : null,
  castLance: typeof castLance === 'function' ? castLance : null,
  MANETTE_HZ: typeof MANETTE_HZ !== 'undefined' ? MANETTE_HZ : 0,
  PLAFOND_TV: typeof PLAFOND_TV !== 'undefined' ? PLAFOND_TV : 0,
  netteteTextures: typeof netteteTextures === 'function' ? netteteTextures : null,
  startGame: typeof startGame === 'function' ? startGame : null,
  chooseWorld: typeof chooseWorld === 'function' ? chooseWorld : null,
  WORLDS: typeof WORLDS !== 'undefined' ? WORLDS : null,
  tv: typeof tv !== 'undefined' ? tv : null,
  closeUI: typeof closeUI === 'function' ? closeUI : null,
  ombresCadence: typeof ombresCadence === 'function' ? ombresCadence : null,
  ombresRendu: typeof ombresRendu === 'function' ? ombresRendu : null,
  plafondPixels: typeof plafondPixels === 'function' ? plafondPixels : null,
  ratioQualite: typeof ratioQualite === 'function' ? ratioQualite : null,
  applyQuality: typeof applyQuality === 'function' ? applyQuality : null,
  renderer: typeof renderer !== 'undefined' ? renderer : null,
  sun: typeof sun !== 'undefined' ? sun : null,
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
  ANIM: typeof ANIM !== 'undefined' ? ANIM : null,
  reparateurArrive: typeof reparateurArrive === 'function' ? reparateurArrive : null,
  reparateurRange: typeof reparateurRange === 'function' ? reparateurRange : null,
  reparateursTick: typeof reparateursTick === 'function' ? reparateursTick : null,
  REPAR_DUREE: typeof REPAR_DUREE !== 'undefined' ? REPAR_DUREE : null,
  enginCreuse: typeof enginCreuse === 'function' ? enginCreuse : null,
  enginLeve: typeof enginLeve === 'function' ? enginLeve : null,
  enginLame: typeof enginLame === 'function' ? enginLame : null,
  enginsTick: typeof enginsTick === 'function' ? enginsTick : null,
  enginCreuseTick: typeof enginCreuseTick === 'function' ? enginCreuseTick : null,
  enginLeveTick: typeof enginLeveTick === 'function' ? enginLeveTick : null,
  enginLameTick: typeof enginLameTick === 'function' ? enginLameTick : null,
  reparateurTick: typeof reparateurTick === 'function' ? reparateurTick : null,
  animScenePhoto: typeof animScenePhoto === 'function' ? animScenePhoto : null,
  enginDemolit: typeof enginDemolit === 'function' ? enginDemolit : null,
  creuseTrou: typeof creuseTrou === 'function' ? creuseTrou : null,
  terreChute: typeof terreChute === 'function' ? terreChute : null,
  terreChutesTick: typeof terreChutesTick === 'function' ? terreChutesTick : null,
  creuseVerse: typeof creuseVerse === 'function' ? creuseVerse : null,
  CREUSE_DUREE: typeof CREUSE_DUREE !== 'undefined' ? CREUSE_DUREE : null,
  GRUE_DUREE: typeof GRUE_DUREE !== 'undefined' ? GRUE_DUREE : null,
  RALENTI: typeof RALENTI !== 'undefined' ? RALENTI : null,
  RALENTI_DUREE: typeof RALENTI_DUREE !== 'undefined' ? RALENTI_DUREE : null,
  ralentiCoup: typeof ralentiCoup === 'function' ? ralentiCoup : null,
  ralentiEchelle: typeof ralentiEchelle === 'function' ? ralentiEchelle : null,
  ralentiCam: typeof ralentiCam === 'function' ? ralentiCam : null,
  depanneusesTick: typeof depanneusesTick === 'function' ? depanneusesTick : null,
  depanneuseAppel: typeof depanneuseAppel === 'function' ? depanneuseAppel : null,
  makeVehiculeTravail: typeof makeVehiculeTravail === 'function' ? makeVehiculeTravail : null,
  actionneOutil: typeof actionneOutil === 'function' ? actionneOutil : null,
  animPose: typeof animPose === 'function' ? animPose : null,
  animPres: typeof animPres === 'function' ? animPres : null,
  GESTES: typeof GESTES !== 'undefined' ? GESTES : null,
  gesteMetier: typeof gesteMetier === 'function' ? gesteMetier : null,
  animCombat: typeof animCombat === 'function' ? animCombat : null,
  coupDePoing: typeof coupDePoing === 'function' ? coupDePoing : null,
  gardePoings: typeof gardePoings === 'function' ? gardePoings : null,
  esquiveBaisse: typeof esquiveBaisse === 'function' ? esquiveBaisse : null,
  coupCouteau: typeof coupCouteau === 'function' ? coupCouteau : null,
  encaisseCoup: typeof encaisseCoup === 'function' ? encaisseCoup : null,
  feuAnime: typeof feuAnime === 'function' ? feuAnime : null,
  feuEteint: typeof feuEteint === 'function' ? feuEteint : null,
  feuDetruit: typeof feuDetruit === 'function' ? feuDetruit : null,
  feuVehicule: typeof feuVehicule === 'function' ? feuVehicule : null,
  feuxAnimTick: typeof feuxAnimTick === 'function' ? feuxAnimTick : null,
  depanneuseAnime: typeof depanneuseAnime === 'function' ? depanneuseAnime : null,
  ambulanceAnime: typeof ambulanceAnime === 'function' ? ambulanceAnime : null,
  animTransArme: typeof animTransArme === 'function' ? animTransArme : null,
  animTransApplique: typeof animTransApplique === 'function' ? animTransApplique : null,
  animFige: typeof animFige === 'function' ? animFige : null,
  brancardAnime: typeof brancardAnime === 'function' ? brancardAnime : null,
  animReception: typeof animReception === 'function' ? animReception : null,
  animMondeTick: typeof animMondeTick === 'function' ? animMondeTick : null,
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
  ACT_MISSIONS: typeof ACT_MISSIONS !== 'undefined' ? ACT_MISSIONS : null,
  carriere: typeof carriere !== 'undefined' ? carriere : null,
  GRADES: typeof GRADES !== 'undefined' ? GRADES : null,
  gradeCarriere: typeof gradeCarriere !== 'undefined' ? gradeCarriere : null,
  primeGrade: typeof primeGrade !== 'undefined' ? primeGrade : null,
  missionDebloquee: typeof missionDebloquee !== 'undefined' ? missionDebloquee : null,
  carriereReussie: typeof carriereReussie !== 'undefined' ? carriereReussie : null,
  sauveCarriere: typeof sauveCarriere !== 'undefined' ? sauveCarriere : null,
  primeSport: typeof primeSport !== 'undefined' ? primeSport : null,
  PALIERS_SPORT: typeof PALIERS_SPORT !== 'undefined' ? PALIERS_SPORT : null,
  varianteMission: typeof varianteMission !== 'undefined' ? varianteMission : null,
  arroseAutour: typeof arroseAutour !== 'undefined' ? arroseAutour : null,
  lieuRoutier: typeof lieuRoutier !== 'undefined' ? lieuRoutier : null,
  longueurRoute: typeof longueurRoute !== 'undefined' ? longueurRoute : null,
  vehiculeMission: typeof vehiculeMission !== 'undefined' ? vehiculeMission : null,
  fabriqueDepanneuse: typeof fabriqueDepanneuse !== 'undefined' ? fabriqueDepanneuse : null,
  suitRouteMission: typeof suitRouteMission !== 'undefined' ? suitRouteMission : null,
  traceRouteMission: typeof traceRouteMission !== 'undefined' ? traceRouteMission : null,
  sireneMission: typeof sireneMission !== 'undefined' ? sireneMission : null,
  arreteSuspect: typeof arreteSuspect !== 'undefined' ? arreteSuspect : null,
  SINISTRES: typeof SINISTRES !== 'undefined' ? SINISTRES : null,
  PANNES: typeof PANNES !== 'undefined' ? PANNES : null,
  FEU_PERDU: typeof FEU_PERDU !== 'undefined' ? FEU_PERDU : null,
  declencheIncendie: typeof declencheIncendie !== 'undefined' ? declencheIncendie : null,
  incendiesTick: typeof incendiesTick !== 'undefined' ? incendiesTick : null,
  actionneOutil: typeof actionneOutil !== 'undefined' ? actionneOutil : null,
  navEnPieton: typeof navEnPieton !== 'undefined' ? navEnPieton : null,
  emprisonneBot: typeof emprisonneBot !== 'undefined' ? emprisonneBot : null,
  vehicleDamage: typeof vehicleDamage !== 'undefined' ? vehicleDamage : null,
  updateMissionHud: typeof updateMissionHud !== 'undefined' ? updateMissionHud : null,
  openMissions: typeof openMissions !== 'undefined' ? openMissions : null,
  RETRAITS: typeof RETRAITS !== 'undefined' ? RETRAITS : null,
  ADRESSES: typeof ADRESSES !== 'undefined' ? ADRESSES : null,
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
  construireGraphe: typeof construireGraphe === 'function' ? construireGraphe : null,
  surLaChaussee: typeof surLaChaussee === 'function' ? surLaChaussee : null,
  prioriteService: typeof prioriteService === 'function' ? prioriteService : null,
  enIntervention: typeof enIntervention === 'function' ? enIntervention : null,
  ecarteChaussee: typeof ecarteChaussee === 'function' ? ecarteChaussee : null,
  ECART_SIRENE: typeof ECART_SIRENE !== 'undefined' ? ECART_SIRENE : null,
  VITESSE_SECOURS: typeof VITESSE_SECOURS !== 'undefined' ? VITESSE_SECOURS : null,
  VITESSE_SERVICE: typeof VITESSE_SERVICE !== 'undefined' ? VITESSE_SERVICE : null,
  APPROCHE_SERVICE: typeof APPROCHE_SERVICE !== 'undefined' ? APPROCHE_SERVICE : null,
  ACCIDENT_GRAVITE_MIN: typeof ACCIDENT_GRAVITE_MIN !== 'undefined' ? ACCIDENT_GRAVITE_MIN : null,
  ACCIDENT_VITESSE_MIN: typeof ACCIDENT_VITESSE_MIN !== 'undefined' ? ACCIDENT_VITESSE_MIN : null,
  AMENDE_ACCIDENT: typeof AMENDE_ACCIDENT !== 'undefined' ? AMENDE_ACCIDENT : null,
  vehiculeMord: typeof vehiculeMord === 'function' ? vehiculeMord : null,
  cheminAretes: typeof cheminAretes === 'function' ? cheminAretes : null,
  vehBloque: typeof vehBloque === 'function' ? vehBloque : null,
  botConduit: typeof botConduit === 'function' ? botConduit : null,
  traficPose: typeof traficPose === 'function' ? traficPose : null,
  carrefourLibre: typeof carrefourLibre === 'function' ? carrefourLibre : null,
  pietonDevant: typeof pietonDevant === 'function' ? pietonDevant : null,
  conduire: typeof conduire === 'function' ? conduire : null,
  itineraireVoies: typeof itineraireVoies === 'function' ? itineraireVoies : null,
  voieProche: typeof voieProche === 'function' ? voieProche : null,
  projVoie: typeof projVoie === 'function' ? projVoie : null,
  rattacheDessertes: typeof rattacheDessertes === 'function' ? rattacheDessertes : null,
  codeRoute: typeof codeRoute === 'function' ? codeRoute : null,
  croisementLibre: typeof croisementLibre === 'function' ? croisementLibre : null,
  pietonSurPassage: typeof pietonSurPassage === 'function' ? pietonSurPassage : null,
  traficRoule: typeof traficRoule === 'function' ? traficRoule : null,
  traficDestination: typeof traficDestination === 'function' ? traficDestination : null,
  traficPlace: typeof traficPlace === 'function' ? traficPlace : null,
  flotteMaj: typeof flotteMaj === 'function' ? flotteMaj : null,
  gapDevant: typeof gapDevant === 'function' ? gapDevant : null,
  carBlocked: typeof carBlocked === 'function' ? carBlocked : null,
  vehHalf: typeof vehHalf === 'function' ? vehHalf : null,
  degageVehicule: typeof degageVehicule === 'function' ? degageVehicule : null,
  roleVoie: typeof roleVoie === 'function' ? roleVoie : null,
  feuPhase: typeof feuPhase === 'function' ? feuPhase : null,
  FEU_CYCLE: typeof FEU_CYCLE !== 'undefined' ? FEU_CYCLE : null,
  FEU_VERT: typeof FEU_VERT !== 'undefined' ? FEU_VERT : null,
  PERTE_DELAI: typeof PERTE_DELAI === 'function' ? PERTE_DELAI : null,
  majWanted: typeof majWanted === 'function' ? majWanted : null,
  abriDuJoueur: typeof abriDuJoueur === 'function' ? abriDuJoueur : null,
  policeVoit: typeof policeVoit === 'function' ? policeVoit : null,
  cityStep: typeof cityStep === 'function' ? cityStep : null,
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
  safeSeen: typeof safeSeen !== 'undefined' ? safeSeen : null,
  villaTick: typeof villaTick === 'function' ? villaTick : null,
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
  // Ce qu'on tient est passe du groupe du bras au noeud main, au centre du poing rond
  // on compte donc les deux, sinon le test « rien ne reste colle a la main » ne voyait plus rien.
  arm() { return me.rig.armR.children.length + (me.rig.armR.main ? me.rig.armR.main.children.length : 0); },
  // ---- poste FINITION (fuite de memoire, camera en lieu couvert, equilibre des coups, meteo) ----
  clearWorld: typeof clearWorld === 'function' ? clearWorld : null,
  libereBranche: typeof libereBranche === 'function' ? libereBranche : null,
  balaieAvatars: typeof balaieAvatars === 'function' ? balaieAvatars : null,
  murEntreVue: typeof murEntreVue === 'function' ? murEntreVue : null,
  estUnToit: typeof estUnToit === 'function' ? estUnToit : null,
  get camToits() { return typeof camToits !== 'undefined' ? camToits : null; },
  attack: typeof attack === 'function' ? attack : null,
  nearestFighter: typeof nearestFighter === 'function' ? nearestFighter : null,
  gpsRoute: typeof gpsRoute !== 'undefined' ? gpsRoute : null,
  FENCE: typeof FENCE !== 'undefined' ? FENCE : null,
  GRILLAGE_SEUIL: typeof GRILLAGE_SEUIL !== 'undefined' ? GRILLAGE_SEUIL : null,
  tickBubbles: typeof tickBubbles === 'function' ? tickBubbles : null,
  bubble: typeof bubble === 'function' ? bubble : null,
  allAvatars: typeof allAvatars === 'function' ? allAvatars : null,
  buildMeteo: typeof buildMeteo === 'function' ? buildMeteo : null,
  sousToit: typeof sousToit === 'function' ? sousToit : null,
  meteoIntensite: typeof meteoIntensite === 'function' ? meteoIntensite : null,
  QUARTIERS: typeof QUARTIERS !== 'undefined' ? QUARTIERS : null,
  DUCK_TENUE: typeof DUCK_TENUE !== 'undefined' ? DUCK_TENUE : 0,
  craieLitFerme: typeof craieLitFerme === 'function' ? craieLitFerme : null,
  sonEn: typeof sonEn === 'function' ? sonEn : null,
  // ---- poste CAMERA (perche, loi de distance, non-traversee) ----
  camPerche: typeof camPerche === 'function' ? camPerche : null,
  camLibres: typeof camLibres === 'function' ? camLibres : null,
  interieurDe: typeof interieurDe === 'function' ? interieurDe : null,
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
  // Le mode television doit etre juge dans la vraie definition d'un televiseur : les regles
  // CSS du mode TV dependent de la largeur de la fenetre (vw), donc une capture prise en
  // 1280x720 ne dit RIEN de ce que voit un joueur en 1920x1080. LARGEUR / HAUTEUR permettent
  // de photographier les deux definitions (par defaut 1280x720, comme avant).
  const page = await browser.newPage({ viewport: { width: +process.env.LARGEUR || 1280, height: +process.env.HAUTEUR || 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SHOT && window.__SHOT.ready, null, { timeout: 60000 })
    .catch(() => { throw new Error('le crochet __SHOT n\'est jamais devenu prêt — le jeu n\'a pas démarré. Erreurs: ' + errors.join(' | ')); });

  for (const v of VIEWS) {
    // largeur/hauteur de fenetre par vue : les pastilles du haut de l'ecran passaient sur deux
    // lignes a 1024 px et il n'y avait aucun moyen de le photographier (le banc est en 1280)
    if (v.w || v.h) { await page.setViewportSize({ width: v.w || 1280, height: v.h || 720 }); await page.waitForTimeout(300); }
    await page.evaluate(vv => window.__SHOT.go(vv), v);
    await page.waitForTimeout(v.wait || 700);
    await page.screenshot({ path: path.join(OUT, v.name + '.png') });
    if (v.w || v.h) await page.setViewportSize({ width: 1280, height: 720 });
  }
  const stats = await page.evaluate(() => window.__SHOT.stats());
  console.log('rendu :', JSON.stringify(stats));
  if (errors.length) { console.log('\nERREURS CONSOLE (' + errors.length + ') :'); errors.slice(0, 15).forEach(e => console.log('  ' + e.slice(0, 220))); }
  else console.log('aucune erreur console.');
  await browser.close(); srv.close();
  console.log('captures dans', OUT);
})().catch(e => { console.error(e.message || e); process.exit(1); });
