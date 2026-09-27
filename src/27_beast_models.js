/* =====================================================================
   27. 怪物造型：哥布林变体（头盔 / 法袍 / 炸弹）、猫妖、牛头人、僵尸
   ===================================================================== */
// 哥布林变体：在基础哥布林上加装备
function buildGoblinVariant(pal, o = {}) {
  const m = buildGoblin(pal, o.weapon || 'club');
  const extra = [];
  if (o.helmet) extra.push({ z: 14, bone: 'head', draw: (c) => { c.rotate(Math.PI); const R = 13, hy = -R * 0.9; c.beginPath(); c.ellipse(0, hy - R * 0.35, R * 1.02, R * 0.75, 0, Math.PI, 0); c.lineTo(R * 1.05, hy - R * 0.2); c.lineTo(-R * 1.05, hy - R * 0.2); c.closePath(); fillStroke(c, gradX(c, -R, R, '#8a8e96', -0.35, 0.35), 1.2); c.fillStyle = '#c83a3a'; c.beginPath(); c.moveTo(-2, hy - R * 1.1); c.quadraticCurveTo(-R * 1.2, hy - R * 1.9, -R * 1.5, hy - R * 0.9); c.lineTo(-R * 0.7, hy - R * 0.95); c.closePath(); c.fill(); } });
  if (o.robe) extra.push({ z: 12, bone: 'root', draw: (c) => { c.beginPath(); c.moveTo(-10, -6); c.lineTo(10, -6); c.lineTo(13, 30); c.quadraticCurveTo(0, 34, -13, 30); c.closePath(); fillStroke(c, gradX(c, -13, 13, o.robe, -0.35, 0.2), 1.3); c.fillStyle = shade(o.robe, 0.35); c.fillRect(-12, 26, 25, 2); } });
  if (o.weapon === 'sword') extra.push({ z: 17, bone: 'wF', draw: (c) => drawSword(c, { trim: '#8a6a3a', blade: '#c8ccd4', glow: '#fff' }, { bladeLen: 26 }) });
  if (o.weapon === 'scimitar') extra.push({ z: 17, bone: 'wF', draw: (c) => { c.beginPath(); c.moveTo(-1.5, 0); c.quadraticCurveTo(6, 16, 1, 30); c.quadraticCurveTo(0, 16, -3, 2); c.closePath(); fillStroke(c, gradX(c, -3, 6, '#dfe6f0', -0.3, 0.3), 1.1); } });
  if (o.weapon === 'staff') extra.push({ z: 17, bone: 'wF', draw: (c) => drawStaff(c, { orb: o.orb || '#ffe070' }) });
  if (o.weapon === 'bomb') extra.push({ z: 17, bone: 'hF', draw: (c) => { c.beginPath(); c.arc(0, 6, 5.5, 0, TAU); fillStroke(c, '#2a2a30', 1.2); c.strokeStyle = '#c8a060'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2, 1); c.quadraticCurveTo(5, -3, 3, -6); c.stroke(); c.fillStyle = Math.floor(Date.now() / 90) % 2 ? '#ffd23a' : '#ff6a2a'; c.fillRect(2, -8, 2, 2); } });
  m.parts.push(...extra); m.parts.sort((a, b) => a.z - b.z);
  return m;
}
/* ---- 猫妖：修长人形 + 猫头 + 尾巴 + 利爪 ---- */
function buildCat(pal) {
  pal = { fur2: shade(pal.fur, -0.2), ...pal };
  const s = { ...HUMAN_DEF, hipY: 46, torso: 26, neck: 2, headR: 11, shX: 2, shDrop: 4, ua: 15, fa: 14, th: 22, sh: 22, hipX: 2.5, footH: 4 };
  const skel = humanoidSkeleton(s), L = s.torso;
  const claw = (c, col) => { drawFist(c, col, 2.8); c.strokeStyle = '#f4f0e0'; c.lineWidth = 1.1; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 1.5, 3); c.lineTo(i * 2 + 1, 8); c.stroke(); } };
  const parts = [
    { z: 0, draw: (c, m) => { const hip = m.skel.point('root', 0, 0), w = Math.sin(m.t * 4) * 5; c.strokeStyle = OUTLINE; c.lineWidth = 5.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(hip.x - 4, hip.y - 2); c.bezierCurveTo(hip.x - 22, hip.y + 4, hip.x - 30, hip.y - 26 + w, hip.x - 20, hip.y - 40 + w); c.stroke(); c.strokeStyle = pal.fur; c.lineWidth = 3.5; c.stroke(); c.strokeStyle = pal.fur2; c.lineWidth = 3.5; c.beginPath(); c.moveTo(hip.x - 22, hip.y - 34 + w); c.lineTo(hip.x - 20, hip.y - 40 + w); c.stroke(); c.lineCap = 'butt'; } },
    { z: 1, bone: 'uaB', draw: (c) => drawLimb(c, s.ua, 3.4, 2.8, shade(pal.fur, -0.25)) },
    { z: 2, bone: 'faB', draw: (c) => drawLimb(c, s.fa, 2.8, 2.4, shade(pal.fur, -0.25)) },
    { z: 3, bone: 'hB', draw: (c) => claw(c, shade(pal.fur, -0.25)) },
    { z: 4, bone: 'thB', draw: (c) => drawLimb(c, s.th, 4.6, 3.4, shade(pal.fur, -0.3)) },
    { z: 5, bone: 'shB', draw: (c) => drawLimb(c, s.sh, 3.4, 2.6, shade(pal.fur, -0.3)) },
    { z: 6, bone: 'ftB', draw: (c) => drawBootFoot(c, shade(pal.fur, -0.3), 9, 4) },
    { z: 8, bone: 'torso', draw: uprightTorso((c) => {
      smoothPolyPath(c, [-6, 2, 6, 2, 8, -10, 7, -L + 2, 0, -L - 2, -7, -L + 1, -8, -12]);
      fillStroke(c, gradX(c, -8, 8, pal.fur, -0.35, 0.2), 1.3);
      c.fillStyle = pal.belly; c.beginPath(); c.ellipse(4, -12, 3.5, 9, 0.1, 0, TAU); c.fill();
      c.fillStyle = pal.cloth; polyPath(c, [-7, -2, 7, -2, 8, 5, -8, 5]); c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 1; c.stroke();
      c.strokeStyle = shade(pal.fur, -0.4); c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-6, -8 - i * 5); c.lineTo(-2, -9 - i * 5); c.stroke(); }
    }) },
    { z: 9, bone: 'thF', draw: (c) => drawLimb(c, s.th, 4.8, 3.6, pal.fur) },
    { z: 10, bone: 'shF', draw: (c) => drawLimb(c, s.sh, 3.6, 2.8, pal.fur) },
    { z: 11, bone: 'ftF', draw: (c) => drawBootFoot(c, pal.fur, 9, 4) },
    { z: 13, bone: 'head', draw: (c) => drawHead(c, s.headR, {
      skin: pal.fur, eyes: false, mouth: false, ear: false,
      hairBack: (c, R) => { for (const [x, sz] of [[-0.55, 0.55], [0.35, 0.6]]) { c.beginPath(); c.moveTo(R * (x - 0.35), -R * 0.55); c.lineTo(R * (x + 0.05), -R * (1.2 + sz)); c.lineTo(R * (x + 0.45), -R * 0.5); c.closePath(); fillStroke(c, pal.fur, 1.2); c.fillStyle = pal.ear; c.beginPath(); c.moveTo(R * (x - 0.15), -R * 0.65); c.lineTo(R * (x + 0.05), -R * (1.05 + sz * 0.7)); c.lineTo(R * (x + 0.25), -R * 0.62); c.closePath(); c.fill(); } },
      face: (c, R, hy) => {
        const glow = pal.eyeGlow;
        if (glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = shade(pal.eye, 0, 0.5); c.beginPath(); c.ellipse(R * 0.45, hy, R * 0.5, R * 0.3, 0, 0, TAU); c.fill(); c.restore(); }
        for (const [x, w] of [[R * 0.15, 0.26], [R * 0.7, 0.18]]) { c.fillStyle = pal.eye; c.beginPath(); c.ellipse(x, hy, R * w, R * 0.2, -0.15, 0, TAU); c.fill(); c.fillStyle = OUTLINE; c.fillRect(Math.round(x), Math.round(hy - R * 0.18), 1, Math.round(R * 0.36)); }
        c.fillStyle = '#f0a0a8'; c.beginPath(); c.moveTo(R * 0.85, hy + R * 0.35); c.lineTo(R * 1.02, hy + R * 0.32); c.lineTo(R * 0.93, hy + R * 0.45); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.8; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(R * 0.8, hy + R * (0.45 + i * 0.08)); c.lineTo(R * 1.35, hy + R * (0.35 + i * 0.14)); c.stroke(); }
        c.fillStyle = '#fff'; c.fillRect(Math.round(R * 0.75), Math.round(hy + R * 0.62), 1, 2);
      },
    }) },
    { z: 15, bone: 'uaF', draw: (c) => drawLimb(c, s.ua, 3.6, 3, pal.fur) },
    { z: 16, bone: 'faF', draw: (c) => drawLimb(c, s.fa, 3, 2.6, pal.fur) },
    { z: 18, bone: 'hF', draw: (c) => claw(c, pal.fur) },
  ];
  return new Model(skel, parts, s);
}
/* ---- 牛头人：魁梧人形 + 牛头 + 巨斧 ---- */
function buildTau(pal, o = {}) {
  const s = { ...HUMAN_DEF, hipY: 60, torso: 38, neck: 2, headR: 14, shX: 3, shDrop: 6, ua: 22, fa: 20, th: 28, sh: 28, hipX: 4, footH: 6 };
  const skel = humanoidSkeleton(s), L = s.torso;
  const parts = [
    { z: 1, bone: 'uaB', draw: (c) => drawLimb(c, s.ua, 7.5, 6, shade(pal.fur, -0.3)) },
    { z: 2, bone: 'faB', draw: (c) => drawLimb(c, s.fa, 6, 5, shade(pal.fur, -0.3)) },
    { z: 3, bone: 'hB', draw: (c) => drawFist(c, shade(pal.fur, -0.3), 5.5) },
    { z: 4, bone: 'thB', draw: (c) => drawLimb(c, s.th, 9, 7, shade(pal.fur, -0.35)) },
    { z: 5, bone: 'shB', draw: (c) => drawLimb(c, s.sh, 7, 5.5, shade(pal.fur, -0.35)) },
    { z: 6, bone: 'ftB', draw: (c) => { c.beginPath(); c.moveTo(-6, -2); c.lineTo(8, -2); c.lineTo(10, 6); c.lineTo(-7, 6); c.closePath(); fillStroke(c, '#2a2420', 1.3); } },
    { z: 8, bone: 'torso', draw: uprightTorso((c) => {
      smoothPolyPath(c, [-11, 3, 11, 3, 16, -12, 17, -L + 4, 6, -L - 5, -12, -L + 2, -16, -16]);
      fillStroke(c, gradX(c, -16, 17, pal.fur, -0.4, 0.2), 1.5);
      c.fillStyle = shade(pal.fur, 0.2, 0.7); c.beginPath(); c.ellipse(8, -24, 6, 7, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(9, -11, 5, 5, 0, 0, TAU); c.fill();   // 胸肌 / 腹肌
      c.fillStyle = pal.cloth; polyPath(c, [-12, -3, 12, -3, 14, 10, 5, 16, -2, 10, -9, 16, -14, 10]); fillStroke(c, gradX(c, -14, 14, pal.cloth, -0.35, 0.2), 1.2);
      c.fillStyle = '#c8b890'; c.fillRect(-12, -4, 25, 3);
      if (o.armor) { polyPath(c, [2, -L + 2, 16, -L + 6, 17, -20, 4, -22]); fillStroke(c, gradX(c, 2, 17, o.armor, -0.35, 0.35), 1.3); }
    }) },
    { z: 9, bone: 'thF', draw: (c) => drawLimb(c, s.th, 9.4, 7.4, pal.fur) },
    { z: 10, bone: 'shF', draw: (c) => drawLimb(c, s.sh, 7.4, 5.8, pal.fur) },
    { z: 11, bone: 'ftF', draw: (c) => { c.beginPath(); c.moveTo(-6, -2); c.lineTo(8, -2); c.lineTo(10, 6); c.lineTo(-7, 6); c.closePath(); fillStroke(c, '#3a3028', 1.3); c.fillStyle = '#1a1410'; c.fillRect(2, 1, 1, 5); } },
    { z: 13, bone: 'head', draw: (c) => {
      c.rotate(Math.PI); const R = 14, hy = -R * 0.8;
      // 牛角
      for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * R * 0.2 - R * 0.2, hy - R * 0.55); c.quadraticCurveTo(side * R * 1.3 - R * 0.2, hy - R * 1.0, side * R * 1.25 - R * 0.1, hy - R * 1.9); c.quadraticCurveTo(side * R * 0.9 - R * 0.2, hy - R * 1.0, side * R * 0.4 - R * 0.2, hy - R * 0.25); c.closePath(); fillStroke(c, gradX(c, -R, R, pal.horn, -0.3, 0.3), 1.3); }
      // 头 + 长吻
      c.beginPath(); c.ellipse(-R * 0.1, hy, R * 0.85, R * 0.9, 0, 0, TAU); fillStroke(c, gradX(c, -R, R, pal.fur, -0.35, 0.15), 1.4);
      c.beginPath(); c.ellipse(R * 0.62, hy + R * 0.35, R * 0.62, R * 0.48, 0.15, 0, TAU); fillStroke(c, gradX(c, 0, R * 1.2, pal.muzzle, -0.3, 0.2), 1.3);
      c.fillStyle = OUTLINE; c.beginPath(); c.ellipse(R * 0.95, hy + R * 0.28, R * 0.1, R * 0.07, 0, 0, TAU); c.fill();
      c.strokeStyle = '#d8c070'; c.lineWidth = 1.6; c.beginPath(); c.arc(R * 1.02, hy + R * 0.5, R * 0.18, -1.2, 1.4); c.stroke();   // 鼻环
      c.fillStyle = pal.eye; c.beginPath(); c.ellipse(R * 0.28, hy - R * 0.12, R * 0.16, R * 0.11, -0.2, 0, TAU); c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 1.6; c.beginPath(); c.moveTo(R * 0.05, hy - R * 0.35); c.lineTo(R * 0.55, hy - R * 0.2); c.stroke();
      c.fillStyle = shade(pal.fur, -0.35); c.beginPath(); c.ellipse(-R * 0.75, hy - R * 0.1, R * 0.28, R * 0.18, -0.6, 0, TAU); c.fill();   // 耳
      if (o.crown) { c.fillStyle = '#ffd23a'; polyPath(c, [-R * 0.7, hy - R * 0.72, R * 0.5, hy - R * 0.72, R * 0.55, hy - R * 1.2, R * 0.2, hy - R * 0.95, -R * 0.1, hy - R * 1.3, -R * 0.4, hy - R * 0.95, -R * 0.75, hy - R * 1.2]); c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 1; c.stroke(); }
    } },
    { z: 15, bone: 'uaF', draw: (c) => { drawLimb(c, s.ua, 7.8, 6.4, pal.fur); if (o.armor) { c.beginPath(); c.ellipse(0, 3, 11, 8, 0, Math.PI, 0); c.closePath(); fillStroke(c, gradX(c, -11, 11, o.armor, -0.35, 0.4), 1.3); } } },
    { z: 16, bone: 'faF', draw: (c) => { drawLimb(c, s.fa, 6.4, 5.4, pal.fur); c.fillStyle = '#6a4a30'; c.fillRect(-6, 10, 12, 4); } },
    { z: 17, bone: 'wF', when: () => o.weapon !== 'none', draw: (c) => drawAxe(c, o.big ? 1.35 : 1) },
    { z: 18, bone: 'hF', draw: (c) => drawFist(c, pal.fur, 6) },
  ];
  return new Model(skel, parts, s);
}
function drawAxe(c, k = 1) {
  c.save(); c.scale(k, k);
  c.fillStyle = '#5a3a24'; c.fillRect(-2.2, -10, 4.4, 50); c.strokeStyle = OUTLINE; c.lineWidth = 1.2; c.strokeRect(-2.2, -10, 4.4, 50);
  c.beginPath(); c.moveTo(1, 26); c.quadraticCurveTo(22, 20, 24, 36); c.quadraticCurveTo(22, 52, 1, 46); c.closePath(); fillStroke(c, gradX(c, 0, 24, '#9aa0a8', -0.35, 0.4), 1.3);
  c.strokeStyle = '#e8eef4'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(22, 24); c.quadraticCurveTo(26, 36, 22, 50); c.stroke();
  c.restore();
}
/* ---- 僵尸：灰绿皮肤、破衣服、弓背 ---- */
function buildZombie(pal) {
  const m = buildSwordsman({ skin: pal.skin, hair: pal.hair, eye: pal.eye, coat: pal.cloth, coat2: shade(pal.cloth, -0.3), trim: '#6a5a4a', scarf: '#3a2a2a', pants: pal.pants, boot: '#3a3430', glove: pal.skin, belt: '#3a2a20', blade: '#999', glow: '#fff' }, { weapon: 'none', scarf: false, pauldron: false, coatTail: true, hair: 'short' });
  m.parts.push({ z: 14, bone: 'torso', draw: uprightTorso((c) => { c.fillStyle = 'rgba(40,20,20,.55)'; for (const [x, y] of [[4, -20], [-6, -10], [8, -4]]) { c.beginPath(); c.ellipse(x, y, 3, 2, 0.5, 0, TAU); c.fill(); } }) });
  m.parts.sort((a, b) => a.z - b.z);
  return m;
}
