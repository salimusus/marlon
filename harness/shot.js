'use strict';
// Ouvre le jeu dans un vrai Chromium, joue quelques secondes et prend des captures.
// three.js est servi en local (le CDN n'est pas joignable depuis cet environnement).
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.join(__dirname, '..');
const OUT = process.env.SHOT_DIR || path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });

// vues : [nom, x, y, z du joueur, orientation]
const VIEWS = JSON.parse(fs.readFileSync(path.join(__dirname, 'views.json'), 'utf8'));


const HOOK = `
window.__SHOT = {
  ready: true,
  go(v) {
    if (v.world != null && worldIdx !== v.world) loadWorld(v.world);
    document.body.classList.remove('lobby');
    document.getElementById('start').classList.add('hidden');
    document.getElementById('worlds').classList.add('hidden');
    running = true; paused = false; dead = false;
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
  get worldIdx() { return worldIdx; }, get simTime() { return simTime; },
  set wallet(v) { wallet = v; }, set running(v) { running = v; },
  aimTick, fire, drawWeapon, WEAPONS, vehicleDamage, fumeeTick, makeTarget, explodeVehicle, sitBench, sleepBed, placeDecor, repairVisual, rideEnter, infraction,
  // ces outils n'existent que dans la version corrigée : le crochet doit rester chargeable
  // sur la version d'origine pour pouvoir comparer les deux
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
  const file = process.argv[2] || path.join(ROOT, 'superobby.html');
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
