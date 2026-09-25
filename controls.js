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
  // LE STICK DE LA CAMERA — UNE SEULE IMPLEMENTATION (arbitrage r77, poste CAMERA). Le regard
  // avait deux chemins : `frame.look` ici, et `padVisee` dans le jeu, avec des reglages
  // differents. Deux chemins pour la meme chose, dont un seul etait branche : le prochain qui
  // corrigeait l'un laissait l'autre en place. C'est desormais la seule implementation, et le
  // jeu la consomme par `frame.look`.
  //   deadzone : zone morte RONDE (la course utile repart de zero juste apres).
  //   squelch  : silence CARRE par axe — une DualSense usee derive de 5 a 8 % sur chaque axe,
  //              et 8 % sur les deux font 11 % en diagonale, donc au-dela de la zone ronde.
  // La courbe est celle de la VISEE (aim = true) : lineaire pres du centre, carree au bord.
  function look(x, y, deadzone = .075, squelch = 0) {
    const sq = finite(squelch, 0);
    if (sq > 0 && Math.max(Math.abs(finite(x)), Math.abs(finite(y))) < sq) return [0, 0];
    return radial(x, y, deadzone, true);
  }
  const trigger = value => clamp((finite(value) - .06) / .94, 0, 1);
  function createController() {
    let identity = null, context = null, previous = Array(COUNT).fill(false), rawPrevious = [], blocked = [], axesBlocked = [false, false], nav = null, navAt = 0, rearmer = false, l2Precedent = 0, r2Precedent = 0;
    // `rearmer` : on revient d'une coupure (perte de focus, manette debranchee). Ce qui est
    // deja enfonce a ce moment-la doit etre relache avant de compter. La PREMIERE manette
    // jamais vue, elle, n'a rien a rearmer — voir l'arbitrage r76 dans sample().
    function reset() { identity = context = null; previous.fill(false); rawPrevious = []; blocked = []; axesBlocked = [false, false]; nav = null; navAt = 0; rearmer = true; l2Precedent = r2Precedent = 0; }
    function sample(gp, options = {}) {
      const id = gp ? String(gp.index) + ':' + gp.id : null;
      const current = options.context || 'blocked', nouvelleManette = id !== identity;
      const now = finite(options.now), changed = nouvelleManette || current !== context;
      const raw = normalize(gp, nouvelleManette ? null : rawPrevious);
      const leftMagnitude = Math.hypot(raw.lx, raw.ly);   // le stick DROIT n'a plus de quarantaine (voir l'arbitrage r77 plus bas)
      const leftNeutral = Math.max(.18, finite(options.deadzone, .12));
      // ============ ARBITRAGE r76 : QUI EST « REARME » ET QUAND (fusion avec la 0.10) ======
      // Le principe de la 0.10 est bon : ce qui est deja TENU au moment d'une bascule ne doit
      // pas agir de l'autre cote (fermer la boutique avec ✕ ne doit pas degainer ; revenir
      // d'un onglet avec R2 tenue ne doit pas mettre les gaz). Trois defauts mesures :
      //  1. elle rearmait aussi a la TOUTE PREMIERE lecture : or un navigateur ne revele une
      //     manette qu'APRES un appui, donc ce premier appui est bien celui du joueur et il
      //     etait systematiquement avale (premiere arme sautee, test 232 ; ✕ de l'accueil, 372).
      //  2. elle rearmait entre deux situations de JEU : monter en voiture en poussant deja le
      //     stick et la gachette rendait les deux muets (0 rad de braquage au test 265, gaz a 0
      //     au test 231) — alors que l'enfant entre dans la caisse le pouce deja sur le stick.
      //  3. elle rearmait TOUT ce qui etait enfonce a l'image de la bascule, y compris un
      //     bouton qu'on venait juste d'appuyer. On ne retient plus que ce qui etait DEJA tenu
      //     a la lecture precedente : c'est exactement « ca appartenait a l'ecran d'avant ».
      // Les AXES, eux, ne se rearment qu'en ENTRANT dans un menu (voir plus bas).
      const enJeu = c => /^game:/.test(c || '');
      const premierReleve = identity === null;   // jamais lue encore, ou retour d'une coupure
      const changementContexte = context !== null && current !== context && !(enJeu(current) && enJeu(context));
      const entreeMenu = changementContexte && enJeu(context) && !enJeu(current);
      // en JEU, une manette qu'on decouvre repond tout de suite ; dans un menu on rearme
      const premiereEnJeu = premierReleve && !rearmer && enJeu(current);
      const rearmeTout = (premierReleve || rearmer) && !premiereEnJeu;   // on ignore tout du passe
      const rearmeTenus = changementContexte;                            // seulement le DEJA tenu
      if (changed) {
        if (rearmeTout || rearmeTenus) {
          const retenir = (enfonce, avant) => enfonce && (rearmeTout || avant);
          blocked = raw.b.map((down, i) => retenir(down, !!rawPrevious[i]));
          blocked[6] = retenir(raw.l2 > .08, l2Precedent > .08);
          blocked[7] = retenir(raw.r2 > .08, r2Precedent > .08);
        }
        // Each axis/button rearms independently. Holding a stick never blocks menu Back.
        // ARBITRAGE r76 (avec le poste CAMERA) : la quarantaine des AXES ne s'arme qu'en
        // ENTRANT dans un menu ou une pause. En SORTANT, l'enfant qui tient deja le stick doit
        // marcher tout de suite — il ne va pas relacher le pouce pour que le jeu veuille bien
        // repartir ; et au tout premier releve il n'y a rien a rearmer. Derriere un stick il
        // n'y a aucune action destructrice a retenir, contrairement aux boutons.
        // ARBITRAGE r77 : SEUL LE STICK GAUCHE EST MIS EN QUARANTAINE. Le stick DROIT ne
        // declenche rien de destructeur — il ne fait que tourner l'image — et le bloquer en
        // sortie de menu laissait la camera morte tant que l'enfant n'avait pas relache le
        // pouce. Le jeu contournait deja la regle en lisant les axes bruts (padVisee) : la
        // quarantaine du droit ne protegeait donc plus rien, elle ne faisait que rendre
        // `frame.look` faux. axesBlocked[1] n'existe plus.
        if (entreeMenu) axesBlocked = [leftMagnitude > leftNeutral, false];
        // ======= DEFAUT 104 : UN BOUTON TENU N'EST JAMAIS UN NOUVEL APPUI =======
        // `previous` etait remis a zero des que `changed` etait vrai — donc AUSSI pour la
        // bascule game:foot -> game:vehicle, que `changementContexte` ecarte pourtant exprès
        // (arbitrage r76, point 2). Consequence mesuree : l'enfant appuie sur △ devant une
        // voiture, il monte, le contexte devient game:vehicle, la lecture suivante voit
        // `changed` et efface le passe, donc le MEME bouton toujours enfonce est reannonce
        // comme un nouvel appui — qui le fait redescendre, ce qui rechange le contexte, etc.
        // Un appui de 200 ms (24 lectures a 120 Hz) donnait 24 allers-retours dedans/dehors,
        // autant de claquements de portiere et de demarrages moteur, et l'etat final ne
        // dependait que de la PARITE du nombre de lectures : 6 appuis sur 12 finissaient au
        // volant. `previous` ne s'efface donc plus qu'a une VRAIE frontiere — nouvelle
        // manette, rearmement complet, ou changement de contexte hors jeu (jeu <-> menu) —
        // c'est-a-dire exactement quand une quarantaine s'arme. Entre deux situations de JEU
        // on garde l'etat precedent : le bouton reste « tenu », et le banc `gamepad.js` le
        // verifie desormais A TRAVERS un changement de contexte (c'etait le trou du banc).
        if (nouvelleManette || rearmeTout || rearmeTenus) previous = Array(COUNT).fill(false);
        nav = null; navAt = 0; rearmer = false;
      }
      identity = id; context = current; rawPrevious = raw.b.slice(); l2Precedent = raw.l2; r2Precedent = raw.r2;
      const enabled = !!gp && current !== 'blocked';
      const b = raw.b.map((down, i) => {
        const released = i === 6 ? raw.l2 <= .08 : i === 7 ? raw.r2 <= .08 : !down;
        if (released) blocked[i] = false;
        return enabled && down && !blocked[i];
      });
      if (leftMagnitude <= leftNeutral) axesBlocked[0] = false;
      const move = enabled && !axesBlocked[0] ? radial(raw.lx, raw.ly, options.deadzone) : [0, 0];
      const lookAxes = enabled ? look(raw.rx, raw.ry, options.lookDeadzone, options.lookSquelch) : [0, 0];
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
      const frame = { raw, b, previous, changed, move, look: lookAxes, navigation,
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
  return { profile, hat, hatAxis, normalize, radial, look, trigger, createController, createKeySources };
});
