// Charge index.html, en extrait le script, l'exécute avec les bouchons et
// expose l'état interne du jeu pour les vérifications d'agencement.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const stubs = require('./stubs.js');

// JEU=... permet au vérificateur (lint.js) de pointer un autre fichier sans passer par argv
const HTML = (process.argv[2] && /\.html$/.test(process.argv[2]) ? process.argv[2] : null)
  || process.env.JEU || path.join(__dirname, '..', 'index.html');

function extractScript(html) {
  // le gros script du jeu est le dernier bloc <script> sans attribut src
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m, best = '';
  while ((m = re.exec(html))) if (m[1].length > best.length) best = m[1];
  if (!best) throw new Error('script du jeu introuvable');
  return best;
}

const EXPORT = `
globalThis.__G = {
  // getters : clearWorld() réaffecte ces tableaux, une référence figée serait périmée
  get solids() { return solids; }, get kills() { return kills; }, get coins() { return coins; },
  get checkpoints() { return checkpoints; }, get movers() { return movers; }, get blinkers() { return blinkers; },
  get spinners() { return spinners; }, get conveyors() { return conveyors; }, get pads() { return pads; },
  get crumbles() { return crumbles; }, get route() { return route; }, get breakables() { return breakables; },
  get worldIdx() { return worldIdx; }, get PATH() { return PATH; }, get G() { return G; },
  get wallet() { return wallet; }, get paused() { return paused; }, get running() { return running; },
  get simTime() { return simTime; }, get uiOpen() { return uiOpen; }, get elapsed() { return elapsed; },
  city, police, jail, drive, bank, mission, stats, WORLDS, P, cam, NAV, owned, settings, bots, me,
  worldGroup, scene, renderer, shots, grenades, debrisParts, net, gym, race, RALLY, day, tm,
  loadWorld, clearWorld, buildNav, navPath, navCell, navFree, groundUnder, groundCar, carBlocked,
  overlaps, step, cityStep, cityCommon, applyQuality, genPath, resetGame, respawn, cityReset,
  updateBot, policeTick, missionTick, villaTick, petsTick, driveStep, heliStep, shotsTick,
  enterCar, exitCar, terrainH, allAvatars, buildVilla, msg, chat,
  pathPos, startCountdown, get raceKarts() { return raceKarts; }, WEAPONS, keys, safesTick, fire, DECOR,
  schQuestion, schTirage, school, swingTick, sitSwing, CULT,
};
`;

function run() {
  const html = fs.readFileSync(HTML, 'utf8');
  let src = extractScript(html);

  // On remplace le DERNIER amorçage (la boucle d'animation) par notre propre hook.
  // Avant, on coupait au repère « // hook », qui n'est plus en fin de fichier depuis que
  // les rounds suivants ont ajouté du code derrière lui : cinq mille lignes — dont les
  // déclarations des gangs, de la guerre et des plaintes — étaient purement jetées, et
  // le chargement en Node échouait sur « gangs is not defined ».
  const bootAt = src.lastIndexOf('\nloop();');
  if (bootAt < 0) throw new Error('amorçage introuvable (loop();)');
  src = src.slice(0, bootAt) + '\n' + EXPORT + 'applyQuality();\n})();\n';

  const sandbox = Object.assign(Object.create(null), {
    THREE: stubs.THREE, document: stubs.document, window: stubs.window,
    navigator: stubs.window.navigator, location: stubs.window.location, localStorage: stubs.localStorage,
    sessionStorage: stubs.localStorage, screen: stubs.window.screen, performance: { now: () => 0 },
    requestAnimationFrame: stubs.window.requestAnimationFrame, cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    AudioContext: stubs.FakeAudioContext, webkitAudioContext: stubs.FakeAudioContext,
    speechSynthesis: stubs.window.speechSynthesis, SpeechSynthesisUtterance: stubs.window.SpeechSynthesisUtterance,
    Peer: undefined, console, Math, JSON, Date, Object, Array, String, Number, Boolean, Error, Set, Map,
    Float32Array, Uint8Array, Uint8ClampedArray, Int32Array, isNaN, isFinite, parseInt, parseFloat, Promise, Symbol, Proxy, Reflect,
    getComputedStyle: stubs.window.getComputedStyle, matchMedia: stubs.window.matchMedia,
    alert: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  });
  sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.window.self = sandbox;
  vm.createContext(sandbox);
  try {
    vm.runInContext(src, sandbox, { filename: 'superobby.js' });
  } catch (e) {
    console.error('ERREUR pendant l\'exécution du script du jeu :');
    console.error(e && e.stack || e);
    process.exit(2);
  }
  return sandbox.__G;
}

module.exports = { run, extractScript };

if (require.main === module) {
  const G = run();
  console.log('chargé. mondes :', G.WORLDS.length);
  G.WORLDS.forEach((w, i) => console.log(' ', i, w.id, w.name, w.free ? '(libre)' : ''));
}
