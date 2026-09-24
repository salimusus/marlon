/* MARLON — original in-engine opening. Uses the playable character models. */
(function (root) {
  'use strict';
  const SHOTS = [
    { end: 6, label: 'TA VILLE. TES RÈGLES.', title: 'MARLON', sub: 'EMPIRE URBAIN', color: '#ffe36a' },
    { end: 12, label: '01 / PASSE À L’ACTION', title: 'Prends une longueur d’avance.', sub: 'Incarne ton personnage. Explore. Fais tes preuves.', color: '#67f4eb' },
    { end: 18, label: '02 / TROUVE TES ALLIÉS', title: 'Traverse la ville. Rassemble ton équipe.', sub: 'À pied ou au volant, prépare la conquête.', color: '#ff9bcd' },
    { end: 25, label: '03 / CONQUIERS LES TERRITOIRES', title: 'Chaque quartier change la donne.', sub: 'Relie tes positions. Sécurise tes revenus. Renforce tes défenses.', color: '#79ffbc' },
    { end: 32, label: '04 / CONTRÔLE LA VILLE', title: 'Fais grandir ton empire.', sub: 'Huit territoires. Une ville. À toi de jouer.', color: '#ffe36a' }
  ];
  root.MarlonIntro = { create(options) {
    const { THREE: T, renderer, sourceCanvas, makeAvatar, disposeAvatar, onClose } = options;
    const reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layer = document.createElement('section'); layer.id = 'marlonCinema';
    layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-label', 'Introduction de Marlon'); layer.setAttribute('aria-modal', 'true');
    layer.innerHTML = '<canvas aria-label="Cinématique : recruter son équipe, conquérir huit quartiers et contrôler la ville"></canvas><div class="cinemaControls"><button type="button" data-cinema="sound">Son : activé</button><button type="button" data-cinema="record">Exporter la vidéo</button><button type="button" data-cinema="skip">Passer · Entrée / A</button></div><p class="cinemaStatus" role="status"></p>';
    document.body.appendChild(layer);
    const canvas = layer.querySelector('canvas'), ctx = canvas.getContext('2d');
    canvas.width = 1920; canvas.height = 1080;
    // A compact, original city set. Geometry/materials are shared; no extra shadow pass.
    const linearColor = color => new T.Color(color).convertSRGBToLinear();
    const scene = new T.Scene(); scene.background = new T.Color('#f2a1ad'); scene.fog = new T.Fog(linearColor('#df8fac'), 32, 95);
    const camera = new T.PerspectiveCamera(49, 16 / 9, .1, 160);
    scene.add(new T.HemisphereLight(linearColor(0xccecff), linearColor(0x79608e), .55));
    const key = new T.DirectionalLight(linearColor(0xffd89d), .85); key.position.set(-8, 15, 9); scene.add(key);
    const rim = new T.DirectionalLight(linearColor(0x57baff), .4); rim.position.set(8, 7, -6); scene.add(rim);
    const geometry = new T.BoxGeometry(1, 1, 1), materials = [], extraGeometry = [];
    const material = (color, extra = {}) => { const m = new T.MeshPhongMaterial(Object.assign({ color: linearColor(color), shininess: 60 }, extra)); if (extra.specular) m.specular.convertSRGBToLinear(); materials.push(m); return m; };
    const glow = color => { const m = new T.MeshBasicMaterial({ color: linearColor(color) }); materials.push(m); return m; };
    const asphalt = material(0x293047), pavement = material(0x747498), dark = material(0x12203f), gold = glow(0xffde67), mint = glow(0x41f4d8), pink = glow(0xff67ba);
    const city = new T.Group(); city.name = 'cinema-city'; scene.add(city);
    const avenue = new T.Group(); avenue.name = 'cinema-avenue'; city.add(avenue);
    const box = (w, h, d, x, y, z, m, parent = city) => { const mesh = new T.Mesh(geometry, m); mesh.scale.set(w, h, d); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    const sphereGeometry = new T.SphereGeometry(1, 18, 12); extraGeometry.push(sphereGeometry);
    const sun = new T.Mesh(sphereGeometry, glow(0xffe59c)); sun.scale.set(11, 11, 2); sun.position.set(-14, 15, -66); scene.add(sun);
    box(94, .22, 130, 0, -.17, -20, asphalt);
    const facadePalette = [0x747bd2, 0xdf7b99, 0x4cb3bc, 0x596fc0, 0xf2a46d].map(color => material(color));
    for (const side of [-1, 1]) {
      box(6.2, .24, 108, side * 8, 0, -23, pavement, avenue);
      box(.16, .04, 108, side * 4.9, .15, -23, side < 0 ? pink : mint, avenue);
      for (let i = 0; i < 10; i++) {
        const z = 13 - i * 9.2, height = 4.2 + (i * 7 % 10), x = side * (13.2 + i % 2);
        const facade = facadePalette[(i + (side > 0 ? 2 : 0)) % facadePalette.length];
        box(6.5, height, 6.8, x, height / 2, z, facade, avenue);
        box(6.8, .24, 7, x, height + .12, z, dark, avenue);
        // Front and street-facing window strips give every moving camera a lit facade.
        for (let y = 2.8; y < height - .4; y += 1.65) {
          box(5.5, .5, .07, x, y, z + 3.44, i % 2 ? gold : mint, avenue);
          box(.07, .5, 5.7, x - side * 3.28, y, z, i % 2 ? mint : gold, avenue);
        }
        box(5.4, 1.65, .1, x, 1, z + 3.46, dark, avenue);
        box(5.8, .2, 1.3, x, 2.15, z + 3.7, i % 2 ? pink : gold, avenue);
        box(.2, 2.2, .2, side * 5.6, 1.15, z + 3, dark, avenue);
        box(.65, .15, .65, side * 5.6, 2.3, z + 3, gold, avenue);
      }
    }
    for (let i = 0; i < 36; i++) box(.12, .015, 1.5, 0, .006, 21 - i * 3, gold, avenue);
    const roadMark = glow(0xfff2dc);
    for (let i = -4; i < 5; i++) box(.65, .018, 2.8, i, .01, -6, roadMark, avenue);
    const stage = new T.Group(); stage.name = 'cinema-stage'; scene.add(stage);
    box(12, .28, 6.3, 0, .08, 0, dark, stage);
    box(12, .07, .08, 0, .27, 3.17, mint, stage);
    box(12, .07, .08, 0, .27, -3.17, pink, stage);
    // A low obstacle creates a readable vault rather than a run in place.
    const hurdle = new T.Group(); hurdle.name = 'cinema-vault'; scene.add(hurdle);
    box(5, .42, .65, 0, .25, .3, material(0xffb261), hurdle);
    box(5.1, .08, .7, 0, .51, .3, gold, hurdle);
    const avatars = [makeAvatar(0), makeAvatar(1), makeAvatar(2)];
    avatars.forEach((av, i) => { av.group.name = ['cinema-rival', 'cinema-player', 'cinema-ally'][i]; scene.add(av.group); if (av.tag) av.tag.visible = false; });
    // Contact decals follow moving characters and soften while they are airborne.
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
    const shadowContext = shadowCanvas.getContext('2d'), falloff = shadowContext.createRadialGradient(32, 32, 4, 32, 32, 31);
    falloff.addColorStop(0, 'rgba(0,0,0,.68)'); falloff.addColorStop(.45, 'rgba(0,0,0,.37)'); falloff.addColorStop(1, 'rgba(0,0,0,0)');
    shadowContext.fillStyle = falloff; shadowContext.fillRect(0, 0, 64, 64);
    const shadowTexture = new T.CanvasTexture(shadowCanvas), shadowGeometry = new T.PlaneGeometry(1.65, 1.1);
    const shadowMaterial = new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .72 });
    const contacts = avatars.map(() => { const shadow = new T.Mesh(shadowGeometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2; scene.add(shadow); return shadow; });
    const tireGeometry = new T.CylinderGeometry(.34, .34, .24, 12); extraGeometry.push(tireGeometry);
    const tireMaterial = material(0x10182a), glass = material(0x5ed0ee, { shininess: 110, specular: 0xffffff }), cars = [];
    [0xff528c, 0x27dfcd, 0xffc04c, 0x658bff].forEach((color, i) => {
      const group = new T.Group(); group.name = 'cinema-car-' + i; scene.add(group);
      const paint = material(color, { shininess: 110, specular: 0xfff2db });
      box(1.85, .45, 3.65, 0, .6, 0, paint, group);
      box(1.58, .59, 1.7, 0, 1.1, -.2, glass, group);
      box(1.7, .11, 1.9, 0, 1.42, -.2, paint, group);
      box(1.5, .12, .08, 0, .68, 1.86, gold, group);
      box(1.5, .1, .08, 0, .68, -1.86, pink, group);
      box(.08, .025, 2.7, -.91, .32, 0, mint, group); box(.08, .025, 2.7, .91, .32, 0, mint, group);
      const wheels = [];
      for (const x of [-.93, .93]) for (const z of [-1.13, 1.13]) { const wheel = new T.Mesh(tireGeometry, tireMaterial); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, .36, z); group.add(wheel); wheels.push(wheel); }
      const shadow = new T.Mesh(shadowGeometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .018; shadow.scale.set(1.7, 3.2, 1); group.add(shadow);
      cars.push({ group, wheels });
    });
    const tiles = [], links = [], map = new T.Group(); map.name = 'cinema-territories'; scene.add(map);
    const coords = [[-4.2, -2.5], [-1.4, -2.5], [1.4, -2.5], [4.2, -2.5], [4.2, .4], [1.4, .4], [-1.4, .4], [-4.2, .4]];
    const tileGeometry = new T.BoxGeometry(2.5, .25, 2.5), beamGeometry = new T.CylinderGeometry(.07, .3, 1, 12); extraGeometry.push(beamGeometry);
    box(12.5, .25, 7.9, 0, .1, -1.1, dark, map);
    const territoryColors = [0xff668e, 0xffbd58, 0xa88dff, 0x58c5ff, 0xff8ccb, 0x6687ff, 0x49d7c2, 0xffdc69];
    coords.forEach(([x, z], i) => {
      const tile = new T.Mesh(tileGeometry, material(territoryColors[i])); tile.position.set(x, .35, z); map.add(tile);
      const skyline = new T.Group(); skyline.position.set(x, .5, z); map.add(skyline);
      const skylineMaterial = material(territoryColors[i]);
      for (let j = 0; j < 4; j++) { const h = .3 + (i + j * 3) % 5 * .16; box(.48, h, .48, (j % 2 - .5) * .83, h / 2, (Math.floor(j / 2) - .5) * .83, skylineMaterial, skyline); }
      const beam = new T.Mesh(beamGeometry, new T.MeshBasicMaterial({ color: linearColor(0x76ffd5), transparent: true, opacity: .55, depthWrite: false })); materials.push(beam.material); beam.position.set(x, .8, z); map.add(beam);
      const flag = new T.Group(); flag.position.set(x + .62, .7, z + .6); map.add(flag); box(.035, .8, .035, 0, .4, 0, gold, flag); box(.44, .27, .035, .22, .66, 0, mint, flag);
      tiles.push({ tile, skyline, beam, flag, color: territoryColors[i] });
    });
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i], length = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const line = box(.09, .05, length, (a[0] + b[0]) / 2, .53, (a[1] + b[1]) / 2, mint, map); line.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); links.push(line);
    }
    const confetti = new T.Group(); confetti.name = 'cinema-confetti'; scene.add(confetti);
    for (let i = 0; i < 48; i++) box(.1, .18, .018, 0, 0, 0, [mint, pink, gold][i % 3], confetti);
    // Batch the repeated facades/windows into a dozen draws, not hundreds at 1080p.
    const cityBatches = new Map(); city.updateMatrixWorld(true);
    city.traverse(o => { if (o.isMesh) { if (!cityBatches.has(o.material)) cityBatches.set(o.material, []); cityBatches.get(o.material).push(o); } });
    cityBatches.forEach((parts, m) => {
      const batch = new T.InstancedMesh(geometry, m, parts.length); batch.frustumCulled = false;
      parts.forEach((part, i) => { batch.setMatrixAt(i, part.matrixWorld); part.parent.remove(part); });
      batch.instanceMatrix.needsUpdate = true; city.add(batch);
    });
    city.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
    stage.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
    let elapsed = 0, active = true, recorder = null, stream = null, audio = null, muted = !!options.muted, recording = false;
    const padButtons = new Map();
    const volume = Math.max(0, Math.min(1, Number.isFinite(options.volume) ? options.volume : 1)) * .16;
    const originalRatio = renderer.getPixelRatio(), originalSize = renderer.getSize(new T.Vector2());
    renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false);
    const status = layer.querySelector('.cinemaStatus'), recordButton = layer.querySelector('[data-cinema="record"]');
    const music = () => {
      if (audio || !(root.AudioContext || root.webkitAudioContext)) return;
      try {
        const ac = new (root.AudioContext || root.webkitAudioContext)(), master = ac.createGain(), dest = ac.createMediaStreamDestination();
        master.gain.value = muted ? 0 : volume; master.connect(ac.destination); master.connect(dest);
        audio = { ac, master, dest };
        // Original 120 BPM synth score: four-chord pulse, bass, kick and syncopated hats.
        // All envelopes end before closing; the same master feeds listening and export.
        const start = ac.currentTime + .05, chords = [[110, 130.81, 164.81], [87.31, 110, 130.81], [130.81, 164.81, 196], [98, 123.47, 146.83]];
        const note = (type, frequency, at, length, level, slide) => {
          const osc = ac.createOscillator(), gain = ac.createGain(); osc.type = type; osc.frequency.setValueAtTime(frequency, at);
          if (slide) osc.frequency.exponentialRampToValueAtTime(slide, at + length * .75);
          gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(level, at + .008); gain.gain.exponentialRampToValueAtTime(.0001, at + length);
          osc.connect(gain); gain.connect(master); osc.start(at); osc.stop(at + length + .01);
        };
        for (let beat = 0; beat < 64; beat++) {
          const t = start + beat * .5, chord = chords[Math.floor(beat / 8) % 4], energy = beat < 12 ? .7 : 1;
          note('triangle', chord[0] / 2, t, .36, .28 * energy);
          note('sine', 138, t, .2, .65 * energy, 38);
          if (beat % 2) { note('triangle', 190, t, .13, .17); note('square', 1500, t, .055, .045, 420); }
          for (let off = 0; off < 2; off++) {
            note('square', 7300 + off * 1100, t + off * .25, .027, off ? .027 : .018);
            note('triangle', chord[(beat + off) % 3] * (beat >= 36 ? 4 : 2), t + off * .25, .19, .095 * energy);
          }
          if (!(beat % 4)) chord.forEach(f => note('sine', f, t, 1.7, .085));
          if ([12, 24, 36, 50].includes(beat)) note('sine', 70, t, .7, .22, 330);
        }
        ac.resume().catch(() => {});
      } catch (_) { status.textContent = 'La vidéo reste disponible sans audio sur ce navigateur.'; }
    };
    music();
    function stopMusic() { if (audio) { audio.ac.close().catch(() => {}); audio = null; } }
    function stopRecording() {
      recording = false;
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); }
        catch (_) { if (stream) stream.getTracks().forEach(t => t.stop()); recordButton.disabled = false; }
      }
    }
    const visibility = () => {
      if (!active) return;
      if (audio) { const action = document.hidden ? 'suspend' : 'resume'; audio.ac[action]().catch(() => {}); }
      if (recording && recorder) {
        try {
          if (document.hidden && recorder.state === 'recording') recorder.pause();
          else if (!document.hidden && recorder.state === 'paused') recorder.resume();
        } catch (_) { stopRecording(); status.textContent = 'Enregistrement interrompu. Tu peux relancer l’export.'; }
      }
    };
    document.addEventListener('visibilitychange', visibility);
    function resize() { if (active) { renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false); } }
    root.addEventListener('resize', resize);
    if (root.visualViewport) root.visualViewport.addEventListener('resize', resize);
    function finish() {
      if (!active) return;
      if (recording) stopRecording();
      active = false; stopMusic(); root.removeEventListener('keydown', keydown, true);
      document.removeEventListener('visibilitychange', visibility); root.removeEventListener('resize', resize);
      if (root.visualViewport) root.visualViewport.removeEventListener('resize', resize);
      avatars.forEach(av => { scene.remove(av.group); disposeAvatar(av.group); });
      city.children.forEach(o => { if (o.isInstancedMesh) o.dispose(); });
      geometry.dispose(); tileGeometry.dispose(); extraGeometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      shadowTexture.dispose(); shadowGeometry.dispose(); shadowMaterial.dispose();
      renderer.setPixelRatio(originalRatio); renderer.setSize(root.innerWidth || originalSize.x, root.innerHeight || originalSize.y, false);
      layer.remove(); onClose();
    }
    const keydown = e => {
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(); return; }
      if (e.code === 'Tab') {
        const buttons = Array.from(layer.querySelectorAll('button')).filter(b => !b.disabled);
        const index = buttons.indexOf(document.activeElement), next = index < 0 ? (e.shiftKey ? buttons.length - 1 : 0) : (index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        e.preventDefault(); e.stopImmediatePropagation(); if (buttons[next]) buttons[next].focus(); return;
      }
      // Focused buttons keep their native Enter/Space activation; gameplay never receives it.
      if (['Enter', 'Space'].includes(e.code)) {
        e.stopImmediatePropagation();
        if (!e.target || e.target.tagName !== 'BUTTON' || !layer.contains(e.target)) { e.preventDefault(); finish(); }
        return;
      }
      e.stopImmediatePropagation();
    };
    root.addEventListener('keydown', keydown, true);
    layer.querySelector('[data-cinema="skip"]').onclick = finish;
    const soundButton = layer.querySelector('[data-cinema="sound"]');
    soundButton.textContent = 'Son : ' + (muted ? 'coupé' : 'activé'); soundButton.setAttribute('aria-pressed', String(!muted));
    soundButton.onclick = e => { muted = !muted; if (audio) { audio.ac.resume().catch(() => {}); audio.master.gain.setTargetAtTime(muted ? 0 : volume, audio.ac.currentTime, .03); } e.target.textContent = 'Son : ' + (muted ? 'coupé' : 'activé'); e.target.setAttribute('aria-pressed', String(!muted)); };
    recordButton.onclick = () => {
      if (recording) return;
      if (!root.MediaRecorder || !canvas.captureStream) { status.textContent = 'Export vidéo non pris en charge. La cinématique reste jouable.'; return; }
      try {
        elapsed = 0; stopMusic(); music(); tick(0);
        stream = canvas.captureStream(30); if (audio) audio.dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
        recorder = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 8000000 }, mimeType ? { mimeType } : {}));
        const currentRecorder = recorder, currentStream = stream, chunks = [];
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        let failed = false;
        recorder.onerror = () => { failed = true; if (recorder === currentRecorder) stopRecording(); currentStream.getTracks().forEach(t => t.stop()); recordButton.disabled = false; status.textContent = 'Enregistrement interrompu. Tu peux réessayer.'; };
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: currentRecorder.mimeType }), extension = currentRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
          currentStream.getTracks().forEach(t => t.stop());
          if (failed || !blob.size) { recordButton.disabled = false; if (!failed) status.textContent = 'Aucune image enregistrée. Relance l’export.'; return; }
          if (options.capture) {
            try { const response = await fetch('/__capture', { method: 'POST', body: blob }); if (!response.ok) throw new Error('capture'); status.textContent = 'Vidéo enregistrée dans les livrables.'; } catch (_) { status.textContent = 'Échec de l’enregistrement local.'; }
          } else {
            const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'MARLON-introduction.' + extension; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
            status.textContent = 'Vidéo exportée. Prêt à conquérir la ville.';
          }
          recordButton.disabled = false; recordButton.textContent = 'Exporter à nouveau';
        };
        recorder.start(1000); recording = true; recordButton.disabled = true; status.textContent = 'Enregistrement de l’introduction · 32 secondes';
      } catch (_) { recording = false; if (stream) stream.getTracks().forEach(t => t.stop()); recordButton.disabled = false; status.textContent = 'Export indisponible sur ce navigateur.'; }
    };
    function text(value, x, y, size, color, weight = 700, align = 'left') {
      ctx.font = weight + ' ' + size + 'px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
    }
    const clamp = n => Math.max(0, Math.min(1, n));
    const wrap = (n, length) => ((n % length) + length) % length;
    const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
    function pose(av, mode, time, jump = 0, variant = 0) {
      const r = av.rig, cycle = time * 13.5 + variant * .8, stride = Math.sin(cycle), lift = Math.max(0, jump);
      const rotate = (joint, x = 0, y = 0, z = 0) => { if (joint) joint.rotation.set(x, y, z); };
      rotate(r.head, mode === 'run' ? -.06 : 0, mode === 'hero' ? Math.sin(time * 1.1 + variant) * .1 : 0);
      if (mode === 'run') {
        rotate(r.armL, -.25 - stride * .85, 0, .13); rotate(r.armR, -.25 + stride * .85, 0, -.13);
        rotate(r.armL?.coude, -1.05); rotate(r.armR?.coude, -1.05);
        rotate(r.legL, stride * .8 - lift * .7); rotate(r.legR, -stride * .8 - lift * .2);
        rotate(r.legL?.genou, Math.max(0, -stride) * 1.25 + lift * .85); rotate(r.legR?.genou, Math.max(0, stride) * 1.25 + lift * .65);
        rotate(r.legL?.pied, -.15 - Math.max(0, -stride) * .4); rotate(r.legR?.pied, -.15 - Math.max(0, stride) * .4);
        av.group.rotation.x = .09 - lift * .2;
      } else {
        const flourish = mode === 'hero' ? ease((time - 25) / 1.4) : 0;
        rotate(r.armL, -.15, 0, .12 + flourish * (variant === 1 ? .22 : .07));
        rotate(r.armR, -flourish * (variant === 1 ? 2.1 : 1.45), 0, -.1 - flourish * .2);
        rotate(r.armL?.coude, -.4 - flourish * .2); rotate(r.armR?.coude, -.35 - flourish * .3 + (variant === 2 ? Math.sin(time * 4) * .2 * flourish : 0));
        rotate(r.legL, -.03, 0, .035); rotate(r.legR, .03, 0, -.035);
        rotate(r.legL?.genou, .05); rotate(r.legR?.genou, .05); rotate(r.legL?.pied); rotate(r.legR?.pied);
        av.group.rotation.x = 0;
      }
    }
    function tick(dt) {
      if (!active || document.hidden) return;
      elapsed = Math.min(32, elapsed + (Number.isFinite(dt) ? Math.min(.1, Math.max(0, dt)) : 0));
      const shot = Math.min(4, SHOTS.findIndex(s => elapsed < s.end) < 0 ? 4 : SHOTS.findIndex(s => elapsed < s.end)), s = SHOTS[shot];
      const start = shot ? SHOTS[shot - 1].end : 0, u = (elapsed - start) / (s.end - start);
      const move = reduced ? .5 : u, time = reduced ? start + (s.end - start) / 2 : elapsed;
      scene.userData.shot = shot; scene.userData.progress = u;
      city.visible = shot !== 3; sun.visible = shot !== 3; map.visible = shot === 3; stage.visible = shot === 4; hurdle.visible = shot === 1; confetti.visible = shot === 4 && !reduced;
      scene.background.set(shot === 3 ? '#6d78bb' : '#f2a1ad');
      avatars.forEach((av, i) => {
        av.group.visible = shot === 1 || shot === 2 || shot === 4;
        contacts[i].visible = av.group.visible;
        if (shot === 1) {
          const z = -7 + move * 15 - (i === 1 ? 0 : 1.3), leap = clamp(1 - Math.abs((z - .3) / 1.5));
          const height = Math.sin(leap * Math.PI / 2) * .88;
          av.group.position.set((i - 1) * 1.55, height + .05 + Math.abs(Math.sin(time * 13.5 + i)) * .05, z);
          av.group.rotation.y = 0; pose(av, 'run', time, leap, i);
          contacts[i].position.set(av.group.position.x, .018, z); contacts[i].scale.setScalar(1 + height * .2);
        } else if (shot === 2) {
          av.group.position.set(-6 - i * .95, .17 + Math.abs(Math.sin(time * 13.5 + i)) * .06, -12 + move * 34 - i * 1.9);
          av.group.rotation.y = 0; pose(av, 'run', time, 0, i);
          contacts[i].position.set(av.group.position.x, .135, av.group.position.z); contacts[i].scale.setScalar(1);
        } else {
          av.group.position.set((i - 1) * 2.1, .28 + (reduced ? 0 : Math.sin(time * 2 + i) * .012), i === 1 ? .7 : -.6);
          av.group.rotation.y = i === 0 ? .17 : i === 2 ? -.17 : 0; pose(av, 'hero', time, 0, i);
          contacts[i].position.set(av.group.position.x, .229, av.group.position.z); contacts[i].scale.setScalar(1);
        }
      });
      cars.forEach((car, i) => {
        car.group.visible = shot === 0 || shot === 2 || shot === 4;
        const speed = i % 2 ? -7 : 9, z = shot === 2 ? -12 + move * 34 + [0, -11, -9, 14][i] : wrap(time * speed + i * 21 + 160, 84) - 58;
        car.group.position.set(i % 2 ? -2.35 : 2.35, 0, shot === 4 ? -10 - wrap(time * speed + i * 21 + 160, 60) : z); car.group.rotation.y = i % 2 ? Math.PI : 0;
        // During the tracking shot the two central cars travel together, on their own lane.
        if (shot === 2 && i % 2) { car.group.position.z = 24 - move * 44 - i * 10; }
        car.wheels.forEach(w => { w.rotation.x = time * speed / .34; });
      });
      let controlled = 0;
      tiles.forEach(({ tile, skyline, beam, flag, color }, i) => {
        const local = clamp(u * 9.5 - i), owned = shot === 3 && local >= .55;
        if (owned) controlled++;
        tile.material.color.set(owned ? 0x49e9b2 : color).convertSRGBToLinear();
        skyline.scale.y = shot === 3 && !reduced ? .4 + ease(local) * .75 : 1;
        beam.visible = shot === 3 && !reduced && local > 0 && local < 1;
        beam.scale.y = .3 + (reduced ? 1 : Math.sin(local * Math.PI) * 3.3); beam.position.y = .55 + beam.scale.y / 2;
        flag.visible = owned; flag.scale.y = reduced ? 1 : ease((local - .55) / .45);
      });
      links.forEach((line, i) => { line.visible = shot === 3 && controlled > i + 1; });
      confetti.children.forEach((piece, i) => {
        const fall = (time * (1.6 + i % 4 * .2) + i * .67) % 10;
        piece.position.set(Math.sin(i * 2.399) * (3 + i % 4) + Math.sin(time * 1.5 + i) * .6, 8 - fall, -3 + Math.cos(i * 2.399) * 3);
        piece.rotation.set(time * 2 + i, time * 1.1 + i, time * 1.7);
      });
      if (shot === 0) { camera.position.set(7 - move * 8, 10 - move * 6.1, 19 - move * 24); camera.lookAt(0, 2.2, -25 - move * 8); }
      if (shot === 1) { const z = avatars[1].group.position.z; camera.position.set(3 - move * 3, 2.8, z + 7.9); camera.lookAt(0, 1.1, z - .4); }
      if (shot === 2) { const z = -12 + move * 34; camera.position.set(-9.8, 3.1, z + 9); camera.lookAt(-2, 1.1, z - 1); }
      if (shot === 3) { camera.position.set(7 - move * 5, 11.8, 12); camera.lookAt(0, 0, -1.2); }
      if (shot === 4) { camera.position.set(2.9 - move * 5.8, 2.4 + move * .45, 10 - move * 1.3); camera.lookAt(0, 1.2, 0); }
      renderer.setRenderTarget(null); renderer.render(scene, camera);
      ctx.fillStyle = '#12172b'; ctx.fillRect(0, 0, 1920, 1080); ctx.drawImage(sourceCanvas, 0, 0, 1920, 1080);
      const gradient = ctx.createLinearGradient(0, 605, 0, 1060); gradient.addColorStop(0, 'rgba(15,19,43,0)'); gradient.addColorStop(.65, 'rgba(15,19,43,.86)'); gradient.addColorStop(1, 'rgba(15,19,43,.97)'); ctx.fillStyle = gradient; ctx.fillRect(0, 605, 1920, 475);
      ctx.fillStyle = '#10152b'; ctx.fillRect(0, 0, 1920, 62); ctx.fillRect(0, 1018, 1920, 62);
      text('M / MARLON', 84, 41, 21, '#ffffff'); text('EMPIRE URBAIN', 1836, 41, 18, '#acb9d6', 600, 'right');
      // Typography stays on one protected lower third; action retains the full upper frame.
      const slide = reduced ? 0 : (1 - ease(u * 9)) * 38;
      text(s.label, 99 + slide, shot === 0 ? 750 : 796, 24, s.color, 750);
      text(s.title, 91 + slide, shot === 0 ? 903 : 876, shot === 0 ? 157 : 65, '#fff7ec', 850);
      text(s.sub, 99 + slide, 944, shot === 0 ? 30 : 27, '#dae3f5', 500);
      if (shot === 1) { text('TON PERSONNAGE  /  TES ALLIÉS  /  TES RIVAUX', 99, 141, 21, '#fff4dd', 700); }
      if (shot === 3) {
        text(String(controlled).padStart(2, '0') + ' / 08', 99, 207, 74, '#efffee', 800);
        text('TERRITOIRES CONTRÔLÉS', 102, 243, 21, '#c4ffe9', 700);
        text(controlled === 8 ? 'VILLE SOUS CONTRÔLE' : 'DÉPLOIEMENT EN COURS', 1818, 143, 21, '#c4ffe9', 700, 'right');
      }
      ctx.fillStyle = '#39425f'; ctx.fillRect(99, 985, 1720, 4); ctx.fillStyle = s.color; ctx.fillRect(99, 985, 1720 * elapsed / 32, 4);
      // Short film-style dip between shots, never a white strobe or camera shake.
      const fade = Math.min(1, (elapsed - start) / .23, (s.end - elapsed) / .18 + (shot === 4 ? 1 : 0));
      if (!reduced && fade < 1) { ctx.fillStyle = 'rgba(16,21,43,' + (1 - fade) + ')'; ctx.fillRect(0, 62, 1920, 956); }
      try {
        const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [], present = new Set();
        for (let slot = 0; slot < pads.length; slot++) {
          const pad = pads[slot]; if (!pad || pad.connected === false) continue;
          const id = slot + ':' + (pad.id || ''), down = [0, 1, 9].some(i => pad.buttons?.[i]?.pressed); present.add(id);
          // Newly connected pads must release first: reconnecting a held A must not skip.
          if (down && padButtons.has(id) && !padButtons.get(id) && elapsed > .6) { finish(); return; }
          padButtons.set(id, down);
        }
        for (const id of padButtons.keys()) if (!present.has(id)) padButtons.delete(id);
      } catch (_) {}
      if (elapsed >= 32 && recording) { recordButton.disabled = true; stopRecording(); }
      else if (elapsed >= 32 && !options.capture && !recorder) finish();
    }
    layer.querySelector('[data-cinema="skip"]').focus();
    return { get active() { return active; }, tick, finish };
  } };
})(window);
