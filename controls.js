/* MARLON input core. Pure, deterministic, shared by the game and regression tests. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MarlonControls = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const COUNT = 18, HID_PS = [2, 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  function profile(gp) {
    if (!gp) return 'aucun';
    if (gp.mapping === 'standard') return 'standard';
    if (/dualsense|dualshock|playstation|054c|wireless controller/i.test(gp.id || '') &&
        (gp.buttons || []).length <= 15 && (gp.axes || []).length >= 6) return 'ps-hid';
    return 'brut';
  }
  function hat(value) {
    if (!Number.isFinite(value) || value < -1.001 || value > 1.001) return [0, 0];
    return [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]][Math.round((value + 1) * 3.5) % 8];
  }
  function hatAxis(gp, start = 4) {
    const axes = (gp && gp.axes) || [];
    for (let i = Math.min(axes.length - 1, 9); i >= start; i--) {
      const v = axes[i];
      if (!Number.isFinite(v)) continue;
      if (v > 1.001 || v < -1.001 || (Math.abs(v) > .05 && Math.abs(Math.round((v + 1) * 3.5) - (v + 1) * 3.5) < .02)) return i;
    }
    return -1;
  }
  function normalize(gp, previous) {
    const profil = profile(gp), a = (gp && gp.axes) || [], buttons = (gp && gp.buttons) || [];
    const axis = i => clamp(finite(a[i]), -1, 1);
    const value = i => { const b = buttons[i]; return typeof b === 'number' ? clamp(finite(b), 0, 1) : b ? clamp(finite(b.value, b.pressed ? 1 : 0), 0, 1) : 0; };
    const pressed = i => !!(buttons[i] && buttons[i].pressed) || value(i) > .5;
    const b = Array(COUNT).fill(false), v = Array(COUNT).fill(0);
    let lx = axis(0), ly = axis(1), rx = axis(2), ry = axis(3), l2, r2;
    if (profil === 'ps-hid') {
      ry = axis(5);
      l2 = (clamp(finite(a[3], -1), -1, 1) + 1) / 2;
      r2 = (clamp(finite(a[4], -1), -1, 1) + 1) / 2;
      HID_PS.forEach((target, i) => { b[target] = pressed(i); v[target] = value(i); });
      v[6] = Math.max(v[6], l2); v[7] = Math.max(v[7], r2);
    } else {
      for (let i = 0; i < COUNT; i++) { b[i] = pressed(i); v[i] = value(i); }
      l2 = v[6]; r2 = v[7];
    }
    let chapeau = -1;
    if (profil !== 'standard' && !b.slice(12, 16).some(Boolean)) {
      chapeau = hatAxis(gp, profil === 'ps-hid' ? 6 : 4);
      if (chapeau >= 0) {
        const [hx, hy] = hat(a[chapeau]);
        b[12] = hy > 0; b[13] = hy < 0; b[14] = hx < 0; b[15] = hx > 0;
        for (let i = 12; i < 16; i++) v[i] = b[i] ? 1 : 0;
      }
    }
    // Hysteresis: a noisy trigger near its threshold cannot repeatedly draw the weapon.
    b[6] = l2 > (previous && previous[6] ? .22 : .35);
    b[7] = r2 > (previous && previous[7] ? .22 : .35);
    return { profil, lx, ly, rx, ry, l2, r2, b, v, chapeau, brut: a };
  }
  function radial(x, y, deadzone = .10, aim = false) {
    x = clamp(finite(x), -1, 1); y = clamp(finite(y), -1, 1);
    deadzone = clamp(finite(deadzone, .10), .02, .4);
    const length = Math.hypot(x, y);
    if (length <= deadzone) return [0, 0];
    const travel = clamp((length - deadzone) / (1 - deadzone), 0, 1);
    const response = aim ? .35 * travel + .65 * travel * travel : Math.pow(travel, 1.2);
    return [x * response / length, y * response / length];
  }
  const trigger = value => clamp((finite(value) - .06) / .94, 0, 1);
  function createController() {
    let identity = null, context = null, previous = Array(COUNT).fill(false), rawPrevious = [], blocked = [], axesBlocked = [false, false], nav = null, navAt = 0, rearmer = false;
    // `rearmer` : on revient d'une coupure (perte de focus, manette debranchee). Ce qui est
    // deja enfonce a ce moment-la doit etre relache avant de compter. La PREMIERE manette
    // jamais vue, elle, n'a rien a rearmer — voir l'arbitrage r76 dans sample().
    function reset() { identity = context = null; previous.fill(false); rawPrevious = []; blocked = []; axesBlocked = [false, false]; nav = null; navAt = 0; rearmer = true; }
    function sample(gp, options = {}) {
      const id = gp ? String(gp.index) + ':' + gp.id : null;
      const current = options.context || 'blocked', nouvelleManette = id !== identity;
      const now = finite(options.now), changed = nouvelleManette || current !== context;
      const raw = normalize(gp, nouvelleManette ? null : rawPrevious);
      const leftMagnitude = Math.hypot(raw.lx, raw.ly), rightMagnitude = Math.hypot(raw.rx, raw.ry);
      const leftNeutral = Math.max(.18, finite(options.deadzone, .12)), rightNeutral = Math.max(.18, finite(options.lookDeadzone, .12));
      // ARBITRAGE r76 (fusion 0.10). Le principe de la 0.10 est bon : ce qui est enfonce au
      // moment d'une bascule ne doit pas agir de l'autre cote (sortir d'un menu avec ✕ tenu
      // ne doit pas degainer ; revenir d'un onglet avec R2 tenue ne doit pas mettre les gaz).
      // Mais elle l'appliquait AUSSI a la toute premiere lecture de la manette : le premier
      // appui et le premier coup de stick etaient alors perdus. Mesure : caméra a 0 rad/s
      // stick a fond et premiere arme sautee (tests 220, 224, 232, 265, 372). On distingue
      // donc trois cas — changement de CONTEXTE, retour de coupure (`rearmer`) et VOL de la
      // manette par une autre prise — de la toute premiere manette, qui, elle, repond tout
      // de suite. Les axes ne se rearment QUE sur un changement de contexte.
      // ARBITRAGE r76 (suite). La 0.10 rearmait a CHAQUE changement de contexte, y compris
      // entre deux situations de JEU : monter en voiture (game:foot → game:vehicle) rendait
      // le stick et R2 muets tant qu'on ne les relachait pas. Mesure : au volant, stick
      // maintenu, 0 rad de braquage au lieu de -0,96 (test 265) et gaz a 0 a fond (test 231).
      // Or l'enfant entre dans la voiture en poussant deja le stick et la gachette. Le
      // rearmement ne garde donc que les bascules qui passent par un MENU ou une pause —
      // celles ou un bouton tenu appartenait a l'ecran precedent (tests node de la 0.10).
      const enJeu = c => /^game:/.test(c || '');
      const changementContexte = context !== null && current !== context && !(enJeu(current) && enJeu(context));
      const entreeMenu = changementContexte && enJeu(context) && !enJeu(current);
      // La TOUTE PREMIERE lecture d'une manette, EN JEU, ne bloque rien : un navigateur ne
      // revele une manette qu'APRES un appui du joueur, donc cet appui-la est le sien et doit
      // compter (sinon le premier ✕, la premiere fleche et le premier coup de stick sont
      // toujours perdus — mesure : la premiere arme sautee au test 232). Dans un MENU on
      // rearme quand meme : un bouton tenu depuis l'ecran precedent ne doit rien valider.
      const premiereEnJeu = context === null && identity === null && !rearmer && /^game:/.test(current);
      const bloquerBoutons = !premiereEnJeu && (rearmer || changementContexte || nouvelleManette);
      if (changed) {
        if (bloquerBoutons) { blocked = raw.b.slice(); blocked[6] = raw.l2 > .08; blocked[7] = raw.r2 > .08; }
        // Each axis/button rearms independently. Holding a stick never blocks menu Back.
        // ARBITRAGE r76 (avec le poste CAMERA) : la quarantaine des AXES ne s'arme qu'en
        // ENTRANT dans un menu ou une pause. En SORTANT, l'enfant qui tient deja le stick doit
        // marcher tout de suite — il ne va pas relacher le pouce pour que le jeu veuille bien
        // repartir ; et au tout premier releve il n'y a rien a rearmer. Derriere un stick il
        // n'y a aucune action destructrice a retenir, contrairement aux boutons.
        if (entreeMenu) axesBlocked = [leftMagnitude > leftNeutral, rightMagnitude > rightNeutral];
        previous = Array(COUNT).fill(false); nav = null; navAt = 0; rearmer = false;
      }
      identity = id; context = current; rawPrevious = raw.b.slice();
      const enabled = !!gp && current !== 'blocked';
      const b = raw.b.map((down, i) => {
        const released = i === 6 ? raw.l2 <= .08 : i === 7 ? raw.r2 <= .08 : !down;
        if (released) blocked[i] = false;
        return enabled && down && !blocked[i];
      });
      if (leftMagnitude <= leftNeutral) axesBlocked[0] = false;
      if (rightMagnitude <= rightNeutral) axesBlocked[1] = false;
      const move = enabled && !axesBlocked[0] ? radial(raw.lx, raw.ly, options.deadzone) : [0, 0];
      const look = enabled && !axesBlocked[1] ? radial(raw.rx, raw.ry, options.lookDeadzone, true) : [0, 0];
      let direction = null;
      if (b[12]) direction = 'haut'; else if (b[13]) direction = 'bas'; else if (b[14]) direction = 'gauche'; else if (b[15]) direction = 'droite';
      else if (enabled && !axesBlocked[0]) {
        const threshold = nav ? .35 : .55;
        if (Math.max(Math.abs(raw.lx), Math.abs(raw.ly)) > threshold) {
          direction = Math.abs(raw.lx) > Math.abs(raw.ly) ? (raw.lx > 0 ? 'droite' : 'gauche') : (raw.ly > 0 ? 'bas' : 'haut');
        }
      }
      const navigation = direction && (direction !== nav || now >= navAt) ? direction : null;
      if (navigation) navAt = now + (direction !== nav ? 380 : 130);
      nav = direction;
      const frame = { raw, b, previous, changed, move, look, navigation,
        pressed: b.map((v, i) => v && !previous[i]), released: b.map((v, i) => !v && previous[i]),
        gaz: enabled && !blocked[7] ? trigger(raw.r2) : 0, frein: enabled && !blocked[6] ? trigger(raw.l2) : 0,
        neutralRequired: blocked.some(Boolean) || axesBlocked.some(Boolean) };
      previous = b.slice(); return frame;
    }
    return { sample, reset };
  }
  function createKeySources() {
    const held = new Map();
    return {
      // Return true only when the aggregate key changes. A pad release cannot cancel a keyboard hold.
      set(code, source, down) {
        let owners = held.get(code); const before = !!(owners && owners.size);
        if (down) { if (!owners) { owners = new Set(); held.set(code, owners); } owners.add(source); }
        else if (owners) { owners.delete(source); if (!owners.size) held.delete(code); }
        return before !== !!(held.get(code) && held.get(code).size);
      },
      has(code) { return held.has(code); },
      release(source) { const released = []; for (const [code, owners] of held) { owners.delete(source); if (!owners.size) { held.delete(code); released.push(code); } } return released; },
      clear() { held.clear(); }
    };
  }
  return { profile, hat, hatAxis, normalize, radial, trigger, createController, createKeySources };
});
