/* MARLON · city art pass. Pure planning + three bounded, static geometry batches. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarlonCityDetail = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = Object.freeze({ markings: 10000, architecture: 3600, lights: 500 });
  const COLORS = { paint: 0xf3efe1, axis: 0xe9c669, stone: 0xe5d3b7, metal: 0x263e48, glass: 0x329ea6, copper: 0xc16a48, green: 0x478467, light: 0xffd886 };
  function overlap(a, b, pad = 0) {
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad;
  }
  function intervals(start, end, cuts) {
    let cursor = start; const out = [];
    for (const [a, b] of cuts.sort((x, y) => x[0] - y[0])) {
      if (a > cursor) out.push([cursor, Math.min(a, end)]);
      cursor = Math.max(cursor, b); if (cursor >= end) break;
    }
    if (cursor < end) out.push([cursor, end]);
    return out.filter(([a, b]) => b - a > .5);
  }
  function plan(city) {
    const markings = [], architecture = [], lights = [], clearances = [], arrows = [];
    const roads = (city.routes || []).filter(r => [r.x, r.z, r.w, r.d].every(Number.isFinite) && Math.min(r.w, r.d) > 0);
    const add = (list, kind, x, y, z, w, h, d, color, angle = 0) => {
      if (list.length >= LIMITS[kind]) return;
      list.push({ x, y, z, w, h, d, color, angle });
    };
    const paint = (x, y, z, w, d, color = COLORS.paint, angle = 0) => add(markings, 'markings', x, y, z, w, .009, d, color, angle);
    // Paint is clipped at each junction. Its height follows the road, including raised roads.
    roads.forEach((r, id) => {
      const alongZ = r.d >= r.w, width = alongZ ? r.w : r.d, length = alongZ ? r.d : r.w;
      const mid = alongZ ? r.z : r.x, axis = alongZ ? r.x : r.z, top = (r.top || .06) + .015;
      const cuts = [];
      roads.forEach((q, qi) => {
        if (id === qi || !overlap(r, q)) return;
        const same = (q.d >= q.w) === alongZ;
        // Overlapping parallel pieces belong to the first road; avoid duplicate paint.
        if (same && qi > id) return;
        const otherMid = alongZ ? q.z : q.x, otherLength = alongZ ? q.d : q.w;
        cuts.push([otherMid - otherLength / 2 - .65, otherMid + otherLength / 2 + .65]);
      });
      for (const [lo, hi] of intervals(mid - length / 2 + .5, mid + length / 2 - .5, cuts)) {
        if (hi - lo < 2) continue;
        // Edge lines stay inside the bitumen and stop before crossing roads.
        for (const side of [-1, 1]) {
          const lat = axis + side * (width / 2 - .32), m = (lo + hi) / 2;
          paint(alongZ ? lat : m, top, alongZ ? m : lat, alongZ ? .105 : hi - lo, alongZ ? hi - lo : .105);
        }
        for (let t = lo + 1; t < hi - .6; t += 5.5) {
          const dash = Math.min(2.7, hi - t - .2);
          paint(alongZ ? axis : t + dash / 2, top, alongZ ? t + dash / 2 : axis, alongZ ? .16 : dash, alongZ ? dash : .16, COLORS.axis);
        }
        if (hi - lo < 12 || width < 6) continue;
        for (const direction of [-1, 1]) {
          const lat = axis + (alongZ ? -direction : direction) * width / 4;
          const pos = direction > 0 ? hi - 5.5 : lo + 5.5;
          const x = alongZ ? lat : pos, z = alongZ ? pos : lat;
          // Standard right-hand lanes: +z uses the west lane, +x uses the south lane.
          const angle = alongZ ? (direction > 0 ? 0 : Math.PI) : (direction > 0 ? Math.PI / 2 : -Math.PI / 2);
          arrows.push({ x, z, angle, road: id, direction });
          const offset = (dx, dz) => [x + Math.cos(angle) * dx + Math.sin(angle) * dz, z - Math.sin(angle) * dx + Math.cos(angle) * dz];
          let p = offset(0, -.2); paint(p[0], top, p[1], .16, 1.6, COLORS.paint, angle);
          for (const s of [-1, 1]) { p = offset(s * .23, .43); paint(p[0], top, p[1], .15, .82, COLORS.paint, angle - s * .64); }
          // Approach line on the incoming lane, two metres before the open junction.
          const approach = direction > 0 ? hi - .6 : lo + .6;
          const isJunction = direction > 0 ? hi < mid + length / 2 - 1 : lo > mid - length / 2 + 1;
          if (isJunction) paint(alongZ ? lat : approach, top, alongZ ? approach : lat, alongZ ? width / 2 - .85 : .22, alongZ ? .22 : width / 2 - .85);
        }
      }
    });
    // Two-tone pavement inlays, all within the existing sidewalk footprint.
    for (const t of (city.trottoirs || [])) {
      const az = !!t.alongZ, length = az ? t.d : t.w;
      if (length < 3) continue;
      const side = t.side || 1, axis = az ? t.x : t.z, middle = az ? t.z : t.x;
      const edge = axis + side * (Math.min(t.w, t.d) / 2 - .14);
      const part = { x: az ? edge : middle, z: az ? middle : edge, w: az ? .18 : length - .2, d: az ? length - .2 : .18 };
      if (!roads.some(r => overlap(part, r, .04))) paint(part.x, .149, part.z, part.w, part.d, 0xbc9671);
    }
    // Upper-storey relief is inside each building footprint; entrances remain unchanged.
    for (const b of (city.batiments || []).filter(b => b.artFacade)) {
      const w = b.w + .5, d = b.d + .5, roof = b.toit, high = Math.max(.2, roof - 4);
      const theme = [COLORS.glass, COLORS.copper, COLORS.green][Math.abs(Math.round(b.x * 3 + b.z)) % 3];
      const box = (x, y, z, ww, hh, dd, col) => add(architecture, 'architecture', x, y, z, ww, hh, dd, col);
      for (const side of [-1, 1]) {
        for (const y of [4.05, roof - .15]) {
          box(b.x, y, b.z + side * (d / 2 - .1), w, .28, .3, COLORS.stone);
          box(b.x + side * (w / 2 - .1), y, b.z, .3, .28, d, COLORS.stone);
        }
        for (const corner of [-1, 1]) box(b.x + side * (w / 2 - .24), 4 + high / 2, b.z + corner * (d / 2 - .24), .48, high, .48, theme);
        for (let x = -w / 2 + 3; x < w / 2 - 1.5; x += 4.4) {
          box(b.x + x, 4 + high / 2, b.z + side * (d / 2 - .035), .18, high, .12, COLORS.stone);
          if (roof > 8) { box(b.x + x, 7, b.z + side * (d / 2 - .22), 1.75, .28, .45, theme); box(b.x + x, 7.22, b.z + side * (d / 2 - .22), 1.48, .2, .32, COLORS.green); }
        }
      }
      clearances.push({ kind: 'facade', x: b.x, z: b.z, w, d, bottom: 3.91 });
    }
    for (const b of (city.interieurs || []).filter(b => b.artShop)) {
      const s = b.artShop, angle = [0, -Math.PI / 2, Math.PI, Math.PI / 2][s.facing], cs = Math.cos(angle), sn = Math.sin(angle);
      const box = (lx, y, lz, w, h, d, color, lit) => add(lit ? lights : architecture, lit ? 'lights' : 'architecture', b.x + lx * cs + lz * sn, y, b.z - lx * sn + lz * cs, w, h, d, color, angle);
      const front = -s.d / 2 + .15, panel = (s.w - 2.2) / 2;
      // Recessed fascia, gold rails and fluted corner panels articulate every shop front.
      for (const side of [-1, 1]) {
        const px = side * (s.w / 2 - .28);
        box(px, 2.2, front + .02, .4, 4.1, .35, COLORS.metal);
        box(px, 2.2, front - .17, .07, 3.65, .035, COLORS.light, true);
        for (const y of [1.48, 3.6]) box(side * (1.1 + panel / 2), y, front - .09, panel - .1, .08, .05, COLORS.stone);
        box(side * (1.1 + panel / 2), 2.55, front - .08, .06, 2, .05, COLORS.metal);
        box(side * (1.1 + panel / 2), .7, front - .08, panel - .15, .72, .1, COLORS.metal);
        for (let i = 0; i < 4; i++) box(side * (1.1 + panel / 2) + (i - 1.5) * panel / 5, .7, front - .14, .035, .6, .03, s.color);
      }
      box(0, 4.19, front - .16, s.w - .5, .08, .06, COLORS.light, true);
      // Clear doorway, no columns or furniture in the 2.2 m interaction entrance.
      clearances.push({ kind: 'shop', x: b.x, z: b.z, w: b.w, d: b.d, doorway: 2.2 });
    }
    return { markings, architecture, lights, clearances, arrows, limits: LIMITS };
  }
  function geometry(THREE, boxes, flat) {
    const positions = [], normals = [], colors = [];
    const faces = flat ? [[[-1,0,-1],[-1,0,1],[1,0,1],[1,0,-1],[0,1,0]]] : [
      [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],
      [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]],
      [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1],[0,1,0]],
      [[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1],[0,-1,0]],
      [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]],
      [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]] ];
    for (const b of boxes) {
      const c = new THREE.Color(b.color), cs = Math.cos(b.angle), sn = Math.sin(b.angle);
      // Vertex colors are linear; encode the final image once in the renderer.
      if (c.convertSRGBToLinear) c.convertSRGBToLinear();
      for (const face of faces) for (const i of [0, 1, 2, 0, 2, 3]) {
        const p = face[i], nx = face[4][0], nz = face[4][2], x = p[0] * b.w / 2, z = p[2] * b.d / 2;
        positions.push(b.x + x * cs + z * sn, b.y + p[1] * b.h / 2, b.z - x * sn + z * cs);
        normals.push(nx * cs + nz * sn, face[4][1], -nx * sn + nz * cs);
        colors.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    g.computeBoundingSphere(); return g;
  }
  function build(THREE, city, parent) {
    const layout = plan(city), group = new THREE.Group(); group.name = 'Marlon · architecture et voirie';
    const addBatch = (parts, flat, lit) => {
      if (!parts.length) return;
      const mat = lit ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = new THREE.Mesh(geometry(THREE, parts, flat), mat);
      mesh.receiveShadow = !lit; mesh.castShadow = !flat && !lit; group.add(mesh);
    };
    addBatch(layout.markings, true, false); addBatch(layout.architecture, false, false); addBatch(layout.lights, false, true);
    parent.add(group);
    return { group, layout, batches: group.children.length, parts: layout.markings.length + layout.architecture.length + layout.lights.length };
  }
  return { plan, build, geometry, intervals, overlap, LIMITS };
});
