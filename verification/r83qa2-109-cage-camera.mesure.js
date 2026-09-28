(() => {
  const G = window.__G, P = G.P, cam = G.cam;
  __SHOT.go({ world: 4, x: -152, y: 1, z: 20, hour: 12, frais: true });
  const CAPS = [['sud', Math.PI], ['est', -Math.PI/2], ['nord', 0], ['ouest', Math.PI/2]];
  // POSE : de vraies images de simulation (le joueur doit toucher le sol).
  // REPOS : on avance l'horloge a la main et on appelle camPerche + interieurTick, comme le
  // banc — jamais en temps reel. Une contre-epreuve en step() complet est faite plus bas.
  const pose = (x, y, z, yaw, dist) => {
    __SHOT.go({ world: 4, x, y, z, yaw, pitch: 0.32, dist: dist || 9, hour: 12, hideHud: true, continu: true });
    for (let i = 0; i < 40; i++) { P.vel.x = 0; P.vel.z = 0; G.step(1/60, true); if (P.grounded && i > 3) break; }
  };
  const repos = (n, plein) => { const ou = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
    for (let i = 0; i < n; i++) { P.pos.set(ou.x, ou.y, ou.z); P.vel.set(0,0,0);
      if (plein) G.step(1/60, true); else { G.simTime += 1/60; G.camPerche(1/60, false); G.interieurTick(); } } };
  const lu = () => { const c = G.camera.position, q = P.pos;
    return { y: +q.y.toFixed(2), d: +Math.hypot(c.x - q.x, c.y - (q.y + 1.2), c.z - q.z).toFixed(2),
      piece: cam.interieur ? (cam.interieur.nom || 'batiment') : null,
      plafond: cam.plafond == null ? null : +cam.plafond.toFixed(2) }; };
  const mesure = (x, y, z, yaw, plein) => { pose(x, y, z, yaw); repos(150, plein); return lu(); };
  const out = { confort: G.CAM_CONFORT, immeubles: [], temoins: {}, contreEpreuve: [] };
  for (let k = 0; k < G.city.zoneImmeubles.length; k++) {
    const im = G.city.zoneImmeubles[k], e = im.esc, rel = [];
    for (let f = 0; f < im.etages; f++) {
      const y0 = 0.2 + f * im.h;
      const pts = [['palier', e.palX, y0, e.zS - e.pal/2],
                   ['volee montante', e.b0, y0 + 4*e.monte, e.zS - e.pal - e.giron*3.5],
                   ['demi-tour', e.palX, y0 + im.h/2, (e.zM0 + e.zM1)/2],
                   ['volee descendante', e.b1, y0 + im.h/2 + 4*e.monte, e.zS - e.pal - e.nm*e.giron + e.giron*3.5]];
      for (const [nom, x, y, z] of pts) {
        const v = CAPS.map(([cn, yaw]) => mesure(x, y, z, yaw, false));
        rel.push({ nom: nom + ' etage ' + f, yVoulu: +y.toFixed(2), yReel: v[0].y,
          caps: v.map(s => s.d), pire: Math.min(...v.map(s => s.d)), piece: v[0].piece });
      }
    }
    out.immeubles.push({ k, x: im.x, z: im.z, etages: im.etages, h: im.h,
      pire: Math.min(...rel.map(r => r.pire)), sousConfort: rel.filter(r => r.pire < G.CAM_CONFORT).map(r => r.nom + ' ' + r.pire),
      horsPiece: rel.filter(r => !/cage|coursive/.test(r.piece || '')).map(r => r.nom + ' ' + r.piece),
      releves: rel });
  }
  // CONTRE-EPREUVE EN SIMULATION COMPLETE : les memes quatre points du premier immeuble
  const im0 = G.city.zoneImmeubles[0], e0 = im0.esc;
  for (const [nom, x, y, z] of [['palier du rez', e0.palX, 0.2, e0.zS - e0.pal/2],
      ['1re volee', e0.b0, 0.2 + 4*e0.monte, e0.zS - e0.pal - e0.giron*3.5],
      ['palier du 1er', e0.palX, im0.h + 0.2, e0.zS - e0.pal/2],
      ['coursive du 1er', im0.x + im0.w/4, im0.h + 0.2, (e0.courZ0 + e0.courZ1)/2]]) {
    const v = CAPS.map(([cn, yaw]) => mesure(x, y, z, yaw, true));
    out.contreEpreuve.push({ nom, caps: v.map(s => s.d), pire: Math.min(...v.map(s => s.d)), piece: v[0].piece });
  }
  // TEMOINS
  for (const [nom, x, y, z] of [['rue degagee', 0, 1, 50], ['petit appartement', -143, 1, 10]])
    out.temoins[nom] = CAPS.map(([cn, yaw]) => mesure(x, y, z, yaw, false).d);
  out.pireGlobal = Math.min(...out.immeubles.map(i => i.pire));
  out.nbReleves = out.immeubles.reduce((a, i) => a + i.releves.length * 4, 0);
  out.gabarit = { palX: e0.palX, zS: e0.zS, pal: e0.pal, monte: e0.monte, giron: e0.giron, nm: e0.nm,
    b0: e0.b0, b1: e0.b1, zM0: e0.zM0, zM1: e0.zM1, courZ0: e0.courZ0, courZ1: e0.courZ1,
    pontX0: e0.pontX0, pontX1: e0.pontX1, larg: e0.larg, im0: { x: im0.x, z: im0.z, w: im0.w, d: im0.d, h: im0.h, etages: im0.etages } };
  return out;
})()
