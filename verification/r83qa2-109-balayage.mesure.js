const fs = require('fs');
const Q = '/tmp/claude-0/-home-user-marlon/d9d8ec84-d68f-5fe0-b4d4-336d04aef788/scratchpad/qa';
const { ouvre } = require(Q + '/bureau2.js');
const PRELUDE = fs.readFileSync(Q + '/prelude2.js', 'utf8');
(async () => {
  const { page, photo, fin, errors } = await ouvre({});
  const ev = (f, a) => page.evaluate(f, a);
  await ev(v => window.__SHOT.go(v), { x: -158.4, y: 1, z: 18, yaw: 0, pitch: 0.2, dist: 7, hour: 12, world: 4, frais: true });
  await ev(PRELUDE);
  await ev(() => { window.__G.settings.ctrl = 'cam'; });

  // BALAYAGE FIN DE TOUTE LA CAGE, CAMERA CONVERGEE A CHAQUE POINT.
  // On pose le joueur 0,60 m au-dessus du nez de marche calcule, on le laisse TOMBER avec de
  // vraies images (il faut qu'il soit au sol, sinon on mesure la camera d'un pantin en l'air),
  // puis on fait converger camPerche 120 images. Jamais de temps reel.
  const R = await ev(() => { const G = window.__G, P = G.P, cam = G.cam;
    const im = G.city.zoneImmeubles[0], e = im.esc;
    const CAPS = [['sud', Math.PI], ['est', -Math.PI/2], ['nord', 0], ['ouest', Math.PI/2]];
    const V = G.THREE.Vector3;
    const mesure = (x, y, z, yaw) => {
      P.pos.set(x, y + 0.6, z); P.vel.set(0,0,0); if (G.chuteOublie) G.chuteOublie();
      cam.yaw = yaw; P.facing = yaw + Math.PI; cam.pitch = 0.2; cam.dist = 7;
      for (let i = 0; i < 60; i++) { P.vel.x = 0; P.vel.z = 0; G.step(1/60, true); if (P.grounded && i > 5) break; }
      const ou = { x: P.pos.x, y: P.pos.y, z: P.pos.z }, sol = P.grounded;
      for (let i = 0; i < 120; i++) { P.pos.set(ou.x, ou.y, ou.z); P.vel.set(0,0,0); cam.yaw = yaw;
        G.simTime += 1/60; G.camPerche(1/60, false); G.interieurTick(); }
      const proj = dy => { const v = new V(P.pos.x, P.pos.y + dy, P.pos.z).project(G.camera);
        return { y: +v.y.toFixed(2), dedans: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z > -1 && v.z < 1 }; };
      const pi = proj(0.03), te = proj(1.6);
      return { yReel: +P.pos.y.toFixed(2), sol, d: +cam.dJoueur.toFixed(2),
        piece: cam.interieur ? (cam.interieur.nom || 'batiment') : null,
        pieds: pi.dedans, hauteurEcran: +Math.abs(te.y - pi.y).toFixed(2) };
    };
    const pires = []; const lignes = [];
    // les deux bandes, sur toute leur longueur, tous les 0,30 m, aux trois niveaux
    for (let f = 0; f < im.etages; f++) {
      const yPal = 0.2 + f * im.h;
      // bande montante b0 : du palier d'etage (z = zS - pal) vers le nord jusqu'au demi-tour
      for (let z = e.zS - e.pal; z >= e.zM1 - 0.4; z -= 0.3) {
        const y = yPal + Math.max(0, (e.zS - e.pal - z) / e.giron) * e.monte;
        if (y > (im.etages - 1) * im.h + 0.4) continue;
        const v = CAPS.map(([n, yaw]) => mesure(e.b0, Math.min(y, yPal + im.h/2), z, yaw));
        const pire = Math.min(...v.map(s => s.d));
        lignes.push({ bande: 'montante', etage: f, z: +z.toFixed(2), y: v[0].yReel, sol: v[0].sol,
          caps: v.map(s => s.d), pire, piece: v[0].piece, piedsVus: v.map(s => s.pieds),
          ecran: v.map(s => s.hauteurEcran) });
        if (pire < G.CAM_CONFORT) pires.push({ bande: 'montante', etage: f, x: e.b0, z: +z.toFixed(2), y: v[0].yReel, pire });
      }
      // bande descendante b1 : du demi-tour vers le sud
      for (let z = e.zM1; z <= e.zS - 0.6; z += 0.3) {
        const y = yPal + im.h/2 + Math.max(0, (z - e.zM1) / e.giron) * e.monte;
        if (y > (im.etages - 1) * im.h + 0.4) continue;
        const v = CAPS.map(([n, yaw]) => mesure(e.b1, y, z, yaw));
        const pire = Math.min(...v.map(s => s.d));
        lignes.push({ bande: 'descendante', etage: f, z: +z.toFixed(2), y: v[0].yReel, sol: v[0].sol,
          caps: v.map(s => s.d), pire, piece: v[0].piece, piedsVus: v.map(s => s.pieds),
          ecran: v.map(s => s.hauteurEcran) });
        if (pire < G.CAM_CONFORT) pires.push({ bande: 'descendante', etage: f, x: e.b1, z: +z.toFixed(2), y: v[0].yReel, pire });
      }
    }
    return { confort: G.CAM_CONFORT, n: lignes.length, pires, lignes,
      pireGlobal: Math.min(...lignes.map(l => l.pire)),
      sansPieds: lignes.filter(l => l.piedsVus.some(p => !p)).length }; });

  // photo du pire point
  if (R.pires.length) {
    const p = R.pires.slice().sort((a,b) => a.pire - b.pire)[0];
    await ev(a => { const G = window.__G, P = G.P;
      P.pos.set(a.x, a.y + 0.4, a.z); P.vel.set(0,0,0);
      for (let i = 0; i < 60; i++) { P.vel.x=0; P.vel.z=0; G.step(1/60, true); if (P.grounded && i>5) break; }
      const ou = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      for (let i = 0; i < 150; i++) { P.pos.set(ou.x, ou.y, ou.z); P.vel.set(0,0,0);
        G.simTime += 1/60; G.camPerche(1/60, false); G.interieurTick(); } }, p);
    await photo('r83qa2-109d-pire-' + p.bande + '-etage' + p.etage);
    R.photoPire = p;
  }
  R.erreurs = errors.slice(0, 10);
  fs.writeFileSync(Q + '/t01d.json', JSON.stringify(R, null, 1));
  console.log('OK');
  await fin();
})().catch(e => { console.error(e); process.exit(1); });
