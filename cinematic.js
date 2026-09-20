/* MARLON — original in-engine opening. Uses the playable character models. */
(function (root) {
  'use strict';
  const SHOTS = [
    { end: 7, label: 'UNE VILLE. MILLE POSSIBILITÉS.', title: 'MARLON', sub: 'EMPIRE URBAIN' },
    { end: 15, label: '01 / RASSEMBLE TON ÉQUIPE', title: 'Personne ne règne seul.', sub: 'Rencontre les habitants. Recrute tes alliés. Prépare ton ascension.' },
    { end: 23, label: '02 / CONQUIERS LES TERRITOIRES', title: 'Chaque quartier compte.', sub: 'Relie tes positions. Sécurise tes revenus. Renforce tes défenses.' },
    { end: 32, label: '03 / CONTRÔLE LA VILLE', title: 'La ville attend son leader.', sub: 'Huit territoires. Un empire. À toi de jouer.' }
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
    const scene = new T.Scene(); scene.background = new T.Color('#091c2a'); scene.fog = new T.Fog('#091c2a', 20, 68);
    const camera = new T.PerspectiveCamera(45, 16 / 9, .1, 100);
    scene.add(new T.HemisphereLight(0xb6e4ff, 0x273746, 1.25));
    const key = new T.DirectionalLight(0xffd8a1, 2.3); key.position.set(-7, 12, 9); scene.add(key);
    const rim = new T.DirectionalLight(0x50dcca, 1.5); rim.position.set(8, 7, -6); scene.add(rim);
    const geometry = new T.BoxGeometry(1, 1, 1), materials = [];
    const material = (color, extra = {}) => { const m = new T.MeshPhongMaterial(Object.assign({ color, shininess: 28 }, extra)); materials.push(m); return m; };
    const asphalt = material(0x19323f), building = material(0x234955), gold = material(0xffcc87), mint = material(0x51dbc1);
    const windows = material(0xfbd898, { emissive: 0x7a5530 });
    const box = (w, h, d, x, y, z, m) => { const mesh = new T.Mesh(geometry, m); mesh.scale.set(w, h, d); mesh.position.set(x, y, z); scene.add(mesh); return mesh; };
    box(90, .2, 90, 0, -.15, 0, asphalt);
    for (let i = 0; i < 20; i++) {
      const x = -24 + i % 10 * 5.3, z = -12 - Math.floor(i / 10) * 11, height = 3 + (i * 7 % 12);
      box(3.9, height, 4, x, height / 2, z, building);
      for (let y = 1; y < height; y += 1.6) box(3.1, .23, .04, x, y, z + 2.03, windows);
    }
    for (let i = 0; i < 16; i++) box(.09, .012, 1, -4, .005, 9 - i * 2, gold);
    box(11, .24, 6, 0, 0, 1, building);
    const avatars = [makeAvatar(0), makeAvatar(1), makeAvatar(2)];
    avatars.forEach((av, i) => { scene.add(av.group); av.tag.visible = false; av.group.position.set((i - 1) * 2.5, .13, i === 1 ? 1.5 : 0); });
    // Three soft contact decals anchor the cast to the stage without any shadow-map pass.
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
    const shadowContext = shadowCanvas.getContext('2d'), falloff = shadowContext.createRadialGradient(32, 32, 4, 32, 32, 31);
    falloff.addColorStop(0, 'rgba(0,0,0,.68)'); falloff.addColorStop(.45, 'rgba(0,0,0,.37)'); falloff.addColorStop(1, 'rgba(0,0,0,0)');
    shadowContext.fillStyle = falloff; shadowContext.fillRect(0, 0, 64, 64);
    const shadowTexture = new T.CanvasTexture(shadowCanvas), shadowGeometry = new T.PlaneGeometry(1.65, 1.1);
    const shadowMaterial = new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .72 });
    const contacts = avatars.map(av => { const shadow = new T.Mesh(shadowGeometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.set(av.group.position.x, .125, av.group.position.z); scene.add(shadow); return shadow; });
    const tiles = [], links = [], map = new T.Group(); scene.add(map);
    const coords = [[-3, 0], [0, 0], [3, 0], [-3, 3], [0, 3], [3, 3], [0, 6], [3, 6]];
    const tileGeometry = new T.BoxGeometry(1.8, .18, 1.8);
    coords.forEach(([x, z]) => { const tile = new T.Mesh(tileGeometry, material(0x475869)); tile.position.set(x, .4, z - 2); map.add(tile); tiles.push(tile); });
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i], length = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const line = new T.Mesh(geometry, mint); line.scale.set(.06, .05, length); line.position.set((a[0] + b[0]) / 2, .32, (a[1] + b[1]) / 2 - 2); line.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); map.add(line); links.push(line);
    }
    let elapsed = 0, active = true, recorder = null, stream = null, audio = null, muted = !!options.muted, recording = false, padHeld = true;
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
        const start = ac.currentTime + .05, chords = [[110, 164.81, 220], [87.31, 130.81, 174.61], [130.81, 196, 261.63], [98, 146.83, 196]];
        for (let beat = 0; beat < 64; beat++) {
          const t = start + beat * .5, chord = chords[Math.floor(beat / 16)];
          const osc = ac.createOscillator(), gain = ac.createGain(); osc.type = 'triangle'; osc.frequency.value = chord[beat % 3];
          gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.15, t + .025); gain.gain.exponentialRampToValueAtTime(.001, t + .46);
          osc.connect(gain); gain.connect(master); osc.start(t); osc.stop(t + .5);
          if (!(beat % 2)) { const kick = ac.createOscillator(), kg = ac.createGain(); kick.frequency.setValueAtTime(100, t); kick.frequency.exponentialRampToValueAtTime(38, t + .18); kg.gain.setValueAtTime(.45, t); kg.gain.exponentialRampToValueAtTime(.001, t + .24); kick.connect(kg); kg.connect(master); kick.start(t); kick.stop(t + .25); }
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
      geometry.dispose(); tileGeometry.dispose(); materials.forEach(m => m.dispose());
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
    function tick(dt) {
      if (!active || document.hidden) return;
      elapsed = Math.min(32, elapsed + Math.min(.1, Math.max(0, dt)));
      const shot = Math.min(3, SHOTS.findIndex(s => elapsed < s.end) < 0 ? 3 : SHOTS.findIndex(s => elapsed < s.end)), s = SHOTS[shot];
      const start = shot ? SHOTS[shot - 1].end : 0, u = (elapsed - start) / (s.end - start);
      map.visible = shot === 2; avatars.forEach(av => { av.group.visible = shot !== 2; });
      contacts.forEach(shadow => { shadow.visible = shot !== 2; });
      avatars.forEach((av, i) => {
        const t = reduced ? 0 : elapsed;
        av.group.rotation.y = Math.sin(t * .22 + i) * .12;
        av.rig.head.rotation.y = Math.sin(t * .43 + i) * .1;
        av.rig.armL.rotation.z = .09 + Math.sin(t * 1.7 + i) * .025; av.rig.armR.rotation.z = -.09 - Math.sin(t * 1.7 + i) * .025;
      });
      const move = reduced ? .5 : u;
      if (shot === 0) { camera.position.set(14 - move * 8, 8 - move * 3, 20 - move * 5); camera.lookAt(0, 2, -3); }
      if (shot === 1) { camera.position.set(-3 + move * 5, 3.1, 10 - move); camera.lookAt(0, 1.5, .5); }
      if (shot === 2) { camera.position.set(9 - move * 4, 15, 14); camera.lookAt(0, 0, 1); tiles.forEach((tile, i) => tile.material.color.set(i <= Math.floor(u * 8) ? 0x51dbc1 : 0x475869)); }
      if (shot === 3) { camera.position.set(2 - move * 2, 3, 9 + move * 3); camera.lookAt(0, 1.5, .7); }
      renderer.setRenderTarget(null); renderer.render(scene, camera);
      ctx.fillStyle = '#06131e'; ctx.fillRect(0, 0, 1920, 1080); ctx.drawImage(sourceCanvas, 0, 0, 1920, 1080);
      const gradient = ctx.createLinearGradient(0, 450, 0, 1080); gradient.addColorStop(0, 'rgba(4,14,23,0)'); gradient.addColorStop(1, 'rgba(4,14,23,.97)'); ctx.fillStyle = gradient; ctx.fillRect(0, 450, 1920, 630);
      ctx.fillStyle = '#06131e'; ctx.fillRect(0, 0, 1920, 70); ctx.fillRect(0, 1010, 1920, 70);
      text('M / MARLON', 90, 45, 22, '#f2e5cd'); text('EMPIRE URBAIN', 1830, 45, 18, '#97b5bd', 500, 'right');
      text(s.label, 104, shot === 0 ? 704 : 752, 23, '#65dfc6');
      text(s.title, 96, shot === 0 ? 859 : 853, shot === 0 ? 152 : 74, '#fff4e1', 800);
      text(s.sub, 104, 920, shot === 0 ? 35 : 28, '#ccdde1', 500);
      if (shot === 1) { text('TES RIVAUX', 460, 643, 20, '#ffdaaa', 700, 'center'); text('TON PERSONNAGE', 965, 683, 20, '#65dfc6', 700, 'center'); text('TES ALLIÉS', 1455, 643, 20, '#ffdaaa', 700, 'center'); }
      ctx.fillStyle = '#27444e'; ctx.fillRect(104, 965, 1712, 3); ctx.fillStyle = '#65dfc6'; ctx.fillRect(104, 965, 1712 * elapsed / 32, 3);
      const fade = Math.min(1, u * 5, (1 - u) * 7 + (shot === 3 ? 1 : 0));
      if (!reduced && fade < 1) { ctx.fillStyle = 'rgba(6,19,30,' + (1 - fade) + ')'; ctx.fillRect(0, 70, 1920, 940); }
      try { const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [], down = pads.some(p => [0, 1, 9].some(i => p.buttons[i] && p.buttons[i].pressed)); if (down && !padHeld && elapsed > .6) { finish(); return; } padHeld = down; } catch (_) {}
      if (elapsed >= 32 && recording) { recordButton.disabled = true; stopRecording(); }
      else if (elapsed >= 32 && !options.capture && !recorder) finish();
    }
    layer.querySelector('[data-cinema="skip"]').focus();
    return { get active() { return active; }, tick, finish };
  } };
})(window);
