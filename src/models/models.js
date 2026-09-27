/* =====================================================================
   04. 具体造型：剑士（玩家）、哥布林、盗贼、骷髅兵……
   部件 z：数值越小越先画（越靠后）
   ===================================================================== */
const PAL_SWORD = { skin: '#f3cfae', hair: '#e6e3ee', eye: '#c8323c', coat: '#2c3a66', coat2: '#1d2748', trim: '#d9b25a', scarf: '#c7283a', pants: '#3a3340', boot: '#5a3a28', glove: '#6a4a36', belt: '#6b4526', blade: '#cfd8e6', glow: '#6ad0ff' };

// 躯干（在“竖直”坐标里画：+x 前，-y 上，y=0 为胯部，y=-len 为肩）
function uprightTorso(fn) { return (c, m, o) => { c.rotate(Math.PI); fn(c, m, o); }; }

function buildSwordsman(pal = PAL_SWORD, opt = {}) {
  const O = { weapon: 'sword', scarf: true, pauldron: true, coatTail: true, hair: 'spiky', ...opt };
  const s = { ...HUMAN_DEF };
  const skel = humanoidSkeleton(s);
  const L = s.torso;
  const parts = [
    // 围巾后摆（飘在身后，随时间摆动）
    { z: 0, bone: 'torso', when: () => O.scarf, draw: uprightTorso((c, m) => {
      const t = m.t, w = Math.sin(t * 9) * 3, spd = (m.opts.speed || 0);
      c.beginPath(); c.moveTo(-3, -L - 2); c.quadraticCurveTo(-14 - spd * 6, -L + 2 + w, -22 - spd * 10, -L + 8 + w * 1.6);
      c.lineTo(-19 - spd * 9, -L + 12 + w * 1.4); c.quadraticCurveTo(-12, -L + 6 + w * 0.5, -2, -L + 3); c.closePath();
      fillStroke(c, shade(pal.scarf, -0.15), 1.2);
    }) },
    // 后臂
    { z: 1, bone: 'uaB', draw: (c) => drawLimb(c, s.ua, 5.4, 4.4, shade(pal.coat, -0.3)) },
    { z: 2, bone: 'faB', draw: (c) => drawLimb(c, s.fa, 4.4, 3.6, shade(pal.glove, -0.25)) },
    { z: 3, bone: 'hB', draw: (c) => drawFist(c, shade(pal.glove, -0.25)) },
    // 后腿
    { z: 4, bone: 'thB', draw: (c) => drawLimb(c, s.th, 7.4, 5.6, shade(pal.pants, -0.3)) },
    { z: 5, bone: 'shB', draw: (c) => { drawLimb(c, s.sh, 5.8, 4.9, shade(pal.boot, -0.3)); } },
    { z: 6, bone: 'ftB', draw: (c) => drawBootFoot(c, shade(pal.boot, -0.25)) },
    // 衣摆后片
    { z: 7, when: () => O.coatTail, draw: (c, m) => coatTail(c, m, pal, -1) },
    // 躯干（长外套 + 腰带 + 胸甲）
    { z: 8, bone: 'torso', draw: uprightTorso((c) => {
      polyPath(c, [-10, 2, 10, 2, 12.5, -12, 13.5, -23, 11, -L + 1, 3, -L - 2, -9, -L + 1, -12.5, -21, -11.5, -8]);
      fillStroke(c, gradX(c, -12, 13, pal.coat, -0.4, 0.2), 1.4);
      c.fillStyle = shade(pal.coat, -0.25); polyPath(c, [-10, 1, -3, 1, -5, -24, -9, -L + 2, -12, -20]); c.fill();   // 背侧暗面
      c.strokeStyle = pal.trim; c.lineWidth = 1.5; c.beginPath(); c.moveTo(9.5, 1); c.lineTo(12.5, -14); c.lineTo(12.5, -25); c.stroke();
      c.fillStyle = pal.belt; c.fillRect(-11, -6, 23, 5); c.strokeStyle = OUTLINE; c.lineWidth = 1; c.strokeRect(-11, -6, 23, 5);
      c.fillStyle = pal.trim; c.fillRect(6, -6, 5, 5); c.fillStyle = shade(pal.trim, -0.4); c.fillRect(7.5, -4.5, 2, 2);
      polyPath(c, [1, -15, 12.5, -17, 13, -26, 2, -29.5]); fillStroke(c, gradX(c, 1, 13, '#8f98ad', -0.35, 0.35), 1.1);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(9, -25, 2, 7);
    }) },
    // 前腿
    { z: 9, bone: 'thF', draw: (c) => drawLimb(c, s.th, 7.6, 5.8, pal.pants) },
    { z: 10, bone: 'shF', draw: (c) => { drawLimb(c, s.sh, 6, 5, pal.boot); c.beginPath(); c.ellipse(0.5, 1, 5, 4, 0, 0, TAU); fillStroke(c, gradX(c, -5, 5, '#8f98ad', -0.3, 0.35), 1.1); } },
    { z: 11, bone: 'ftF', draw: (c) => drawBootFoot(c, pal.boot) },
    { z: 12, when: () => O.coatTail, draw: (c, m) => coatTail(c, m, pal, 1) },
    // 头
    { z: 13, bone: 'head', draw: (c) => drawHead(c, s.headR, O.hair !== 'spiky' ? { skin: pal.skin, eye: pal.eye, ...HAIRS[O.hair](pal), headwear: O.hat ? HATS[O.hat](pal) : null } : {
      skin: pal.skin, eye: pal.eye,
      hairBack: spikyHair(pal.hair, [-1.1, -0.2, -1.6, 0.35, -1.05, 0.35, -1.35, 0.95, -0.6, 0.7, -0.4, 1.05, -0.1, 0.4, 0.3, -0.9, -0.5, -1.2]),
      hair: spikyHair(pal.hair, [-0.95, -0.2, -0.75, -1.2, 0.0, -1.42, 0.8, -1.12, 1.3, -0.62, 0.92, -0.5, 1.12, -0.05, 0.62, -0.3, 0.52, 0.2, 0.22, -0.28, -0.05, 0.25, -0.35, -0.3, -0.6, 0.15]),
    }) },
    // 领口围巾（在头下方）
    { z: 14, bone: 'torso', when: () => O.scarf, draw: uprightTorso((c) => {
      c.beginPath(); c.ellipse(1.5, -L + 0.5, 7.5, 3.6, -0.1, 0, TAU); fillStroke(c, gradX(c, -6, 9, pal.scarf, -0.3, 0.25), 1.2);
    }) },
    // 前臂 + 武器
    { z: 15, bone: 'uaF', draw: (c) => { drawLimb(c, s.ua, 5.6, 4.6, pal.coat); c.fillStyle = pal.trim; c.fillRect(-4.8, 12, 9.6, 1.6);
      if (O.pauldron) { c.beginPath(); c.ellipse(0, 2, 8, 6.5, 0, Math.PI, 0); c.lineTo(8, 5); c.quadraticCurveTo(0, 8, -8, 5); c.closePath(); fillStroke(c, gradX(c, -8, 8, '#8f98ad', -0.35, 0.4), 1.2); } } },   // 肩甲
    { z: 16, bone: 'faF', draw: (c) => { drawLimb(c, s.fa, 4.8, 4, pal.glove); c.fillStyle = shade(pal.glove, 0.3); c.fillRect(-4, 6, 8, 1.6); } },
    { z: 17, bone: 'wF', when: () => O.weapon === 'sword', draw: (c, m, o) => drawSword(c, pal, o) },
    { z: 17, bone: 'wF', when: () => O.weapon === 'hammer', draw: (c) => drawHammer(c) },
    { z: 17, bone: 'wF', when: () => O.weapon === 'staff', draw: (c) => drawStaff(c, pal) },
    { z: 17, bone: 'wF', when: () => O.weapon === 'gun', draw: (c, m, o) => drawGun(c, pal, o) },
    { z: 18, bone: 'hF', draw: (c) => drawFist(c, pal.glove) },
  ];
  return new Model(skel, parts, s);
}
// 外套下摆：从腰两侧沿大腿方向垂下，前后两片
function coatTail(c, m, pal, side) {
  const k = m.skel, th = side > 0 ? 'thF' : 'thB';
  const hip = k.point('root', 0, 0), a = k.point(th, 0, 19), wx = side > 0 ? 7 : -7;
  const w = Math.sin(m.t * 7 + side) * 1.2;
  c.beginPath(); c.moveTo(hip.x + wx * 0.2, hip.y - 3); c.lineTo(hip.x + wx + (side > 0 ? 2 : -1), hip.y - 3);
  c.quadraticCurveTo(a.x + (side > 0 ? 7 : -4), a.y - 2, a.x + (side > 0 ? 6 : -6) + w, a.y + 3);
  c.lineTo(a.x - (side > 0 ? 3 : -2) + w, a.y + 4); c.quadraticCurveTo(hip.x, hip.y + 8, hip.x + wx * 0.2, hip.y - 3); c.closePath();
  fillStroke(c, side > 0 ? pal.coat : shade(pal.coat, -0.3), 1.3);
  c.strokeStyle = pal.trim; c.lineWidth = 1; c.beginPath(); c.moveTo(a.x + (side > 0 ? 6 : -6) + w, a.y + 3); c.lineTo(a.x - (side > 0 ? 3 : -2) + w, a.y + 4); c.stroke();
}
// 太刀：局部 +y 为刀身方向（握把在原点附近）
function drawSword(c, pal, o = {}) {
  const len = o.bladeLen || 50;
  c.fillStyle = '#2a1e1a'; c.fillRect(-1.6, -9, 3.2, 10); c.strokeStyle = OUTLINE; c.lineWidth = 1; c.strokeRect(-1.6, -9, 3.2, 10);   // 握柄
  c.fillStyle = pal.trim; c.beginPath(); c.ellipse(0, 1.5, 4, 1.8, 0, 0, TAU); c.fill(); c.stroke();   // 护手
  c.beginPath(); c.moveTo(-1.8, 3); c.lineTo(1.9, 3); c.lineTo(2.2, len - 8); c.quadraticCurveTo(1.6, len - 2, -0.2, len + 2); c.lineTo(-1.8, len - 6); c.closePath();
  const g = c.createLinearGradient(-2, 0, 2.2, 0); g.addColorStop(0, shade(pal.blade, -0.35)); g.addColorStop(0.5, pal.blade); g.addColorStop(1, '#ffffff');
  fillStroke(c, g, 1.1);
  if (o.glow) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = shade(pal.glow, 0, o.glow * 0.8); c.lineWidth = 3; c.beginPath(); c.moveTo(0.3, 4); c.lineTo(0.5, len); c.stroke(); c.globalCompositeOperation = 'source-over'; }
}

/* ---- 哥布林：矮小、大头、尖耳、绿皮，拿木棒 ---- */
const PAL_GOB = { skin: '#6aa04a', skin2: '#4a7a34', eye: '#ffd040', cloth: '#7a5a3a', club: '#8a5a32', band: '#c8403a' };
function buildGoblin(pal = PAL_GOB, weapon = 'club') {
  const s = { ...HUMAN_DEF, hipY: 34, torso: 22, neck: 1, headR: 13, shX: 2, shDrop: 3, ua: 13, fa: 12, th: 16, sh: 16, hipX: 2.5, footH: 4 };
  const skel = humanoidSkeleton(s);
  const L = s.torso;
  const ear = (c, R, side) => { c.beginPath(); c.moveTo(-R * 0.3, -R * 0.1); c.quadraticCurveTo(-R * 1.6, -R * 0.9 * side, -R * 2.0, -R * 0.55); c.quadraticCurveTo(-R * 1.1, -R * 0.15, -R * 0.25, R * 0.3); c.closePath(); fillStroke(c, gradX(c, -R * 2, 0, pal.skin, -0.3, 0.15), 1.2); c.strokeStyle = shade(pal.skin, -0.4); c.lineWidth = 0.8; c.beginPath(); c.moveTo(-R * 0.5, 0); c.lineTo(-R * 1.6, -R * 0.55); c.stroke(); };
  const parts = [
    { z: 1, bone: 'uaB', draw: (c) => drawLimb(c, s.ua, 3.4, 2.8, pal.skin2) },
    { z: 2, bone: 'faB', draw: (c) => drawLimb(c, s.fa, 2.8, 2.4, pal.skin2) },
    { z: 3, bone: 'hB', draw: (c) => drawFist(c, pal.skin2, 2.8) },
    { z: 4, bone: 'thB', draw: (c) => drawLimb(c, s.th, 4.4, 3.2, pal.skin2) },
    { z: 5, bone: 'shB', draw: (c) => drawLimb(c, s.sh, 3.2, 2.6, pal.skin2) },
    { z: 6, bone: 'ftB', draw: (c) => drawBootFoot(c, pal.skin2, 9, 4) },
    { z: 8, bone: 'torso', draw: uprightTorso((c) => {
      smoothPolyPath(c, [-7, 1, 6, 1, 10, -8, 9, -L + 2, 1, -L - 2, -8, -L + 1, -10, -10]);
      fillStroke(c, gradX(c, -10, 10, pal.skin, -0.35, 0.2), 1.3);
      c.fillStyle = shade(pal.skin, 0.25, 0.6); c.beginPath(); c.ellipse(5, -9, 3.5, 5, 0, 0, TAU); c.fill();   // 肚子高光
      // 兽皮腰布
      polyPath(c, [-8, -3, 8, -3, 9, 5, 4, 9, 0, 5, -4, 9, -9, 5]); fillStroke(c, gradX(c, -9, 9, pal.cloth, -0.3, 0.2), 1.1);
      c.fillStyle = shade(pal.cloth, 0.35); c.fillRect(-7, -3, 15, 1.5);
    }) },
    { z: 9, bone: 'thF', draw: (c) => drawLimb(c, s.th, 4.6, 3.4, pal.skin) },
    { z: 10, bone: 'shF', draw: (c) => drawLimb(c, s.sh, 3.4, 2.8, pal.skin) },
    { z: 11, bone: 'ftF', draw: (c) => drawBootFoot(c, pal.skin, 9, 4) },
    { z: 13, bone: 'head', draw: (c) => drawHead(c, s.headR, {
      skin: pal.skin, eye: pal.eye, mouth: false, eyes: false,
      hairBack: (c, R) => ear(c, R, 1),
      face: (c, R, hy) => {
        // 大鼻子 + 獠牙 + 凶眼
        c.fillStyle = shade(pal.skin, -0.15); c.beginPath(); c.ellipse(R * 0.95, hy + R * 0.25, R * 0.3, R * 0.22, 0.3, 0, TAU); c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 1; c.stroke();
        c.fillStyle = pal.eye; c.beginPath(); c.ellipse(R * 0.45, hy - R * 0.05, R * 0.2, R * 0.16, -0.2, 0, TAU); c.fill(); c.fillStyle = OUTLINE; c.fillRect(Math.round(R * 0.5), Math.round(hy - R * 0.12), 2, 2);
        c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.beginPath(); c.moveTo(R * 0.15, hy - R * 0.35); c.lineTo(R * 0.75, hy - R * 0.2); c.stroke();
        c.strokeStyle = OUTLINE; c.lineWidth = 1.2; c.beginPath(); c.moveTo(R * 0.25, hy + R * 0.62); c.quadraticCurveTo(R * 0.6, hy + R * 0.75, R * 0.85, hy + R * 0.55); c.stroke();
        c.fillStyle = '#f4f0dc'; c.fillRect(Math.round(R * 0.55), Math.round(hy + R * 0.5), 2, 3);
      },
      hair: (c, R) => { c.save(); c.scale(-1, 1); c.restore(); if (pal.band) { c.fillStyle = pal.band; c.beginPath(); c.ellipse(-R * 0.05, -R * 0.55, R * 0.95, R * 0.28, -0.15, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(R * 0.8, -R * 0.45); c.quadraticCurveTo(0, -R * 0.2, -R * 0.9, -R * 0.35); c.closePath(); fillStroke(c, pal.band, 1); } },
      headwear: (c, R) => ear(c, R, -0.3),
    }) },
    { z: 15, bone: 'uaF', draw: (c) => drawLimb(c, s.ua, 3.6, 3, pal.skin) },
    { z: 16, bone: 'faF', draw: (c) => drawLimb(c, s.fa, 3, 2.6, pal.skin) },
    { z: 17, bone: 'wF', when: () => weapon === 'club', draw: (c) => drawClub(c, pal.club) },
    { z: 18, bone: 'hF', draw: (c) => drawFist(c, pal.skin, 3) },
  ];
  const m = new Model(skel, parts, s);
  return m;
}
function drawClub(c, col, len = 30) {
  c.beginPath(); c.moveTo(-1.8, -4); c.lineTo(1.8, -4); c.lineTo(4.5, len - 6); c.quadraticCurveTo(5, len + 2, 0, len + 2); c.quadraticCurveTo(-5, len + 2, -4.5, len - 6); c.closePath();
  fillStroke(c, gradX(c, -5, 5, col, -0.35, 0.25), 1.2);
  c.fillStyle = shade(col, -0.4); for (const [x, y] of [[-2, 14], [2, 20], [-1, 25]]) c.fillRect(x, y, 2, 2);
  c.fillStyle = '#c8c0b0'; for (const [x, y] of [[4, 18], [-4.5, 23], [3.5, 26]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sign(x) * 3, y + 1); c.lineTo(x, y + 2.5); c.fill(); }   // 钉子
}

/* ---- 其它发型 / 帽子 / 武器（NPC 与其它职业用） ---- */
const HAIRS = {
  short: (pal) => ({ hairBack: spikyHair(pal.hair, [-1.0, -0.3, -1.15, 0.45, -0.7, 0.5, -0.3, -0.1, 0.2, -0.95, -0.5, -1.15]), hair: spikyHair(pal.hair, [-0.95, -0.25, -0.6, -1.15, 0.2, -1.25, 0.95, -0.85, 1.05, -0.35, 0.6, -0.5, 0.2, -0.3, -0.3, -0.1]) }),
  long: (pal) => ({ hairBack: spikyHair(pal.hair, [-0.9, -0.6, -1.25, 0.2, -1.2, 1.4, -0.7, 1.6, -0.3, 1.2, -0.2, 0.2, 0.3, -0.9]), hair: spikyHair(pal.hair, [-0.95, -0.2, -0.6, -1.15, 0.2, -1.25, 0.95, -0.85, 1.05, -0.2, 0.75, -0.55, 0.3, -0.35, -0.2, 0.2, -0.5, 0.4]) }),
  bald: (pal) => ({ hair: (c, R) => { c.fillStyle = shade(pal.skin, -0.1); c.beginPath(); c.ellipse(-R * 0.1, -R * 0.55, R * 0.75, R * 0.35, 0, Math.PI, 0); c.fill(); } }),
  bun: (pal) => ({ hairBack: (c, R) => { c.beginPath(); c.arc(-R * 0.9, -R * 0.6, R * 0.45, 0, TAU); fillStroke(c, pal.hair, 1.2); spikyHair(pal.hair, [-1.0, -0.3, -1.1, 0.5, -0.6, 0.4, 0.2, -0.95, -0.5, -1.15])(c, R); }, hair: spikyHair(pal.hair, [-0.95, -0.25, -0.6, -1.15, 0.2, -1.25, 0.95, -0.85, 1.05, -0.3, 0.55, -0.5, 0.1, -0.3, -0.4, -0.05]) }),
};
const HATS = {
  bandana: (pal) => (c, R) => { c.beginPath(); c.ellipse(0, -R * 0.55, R * 1.02, R * 0.5, 0, Math.PI, 0); c.lineTo(R, -R * 0.4); c.lineTo(-R, -R * 0.4); c.closePath(); fillStroke(c, pal.hat || '#c83a3a', 1.2); },
  wizard: (pal) => (c, R) => { c.beginPath(); c.moveTo(-R * 1.4, -R * 0.45); c.lineTo(R * 1.4, -R * 0.45); c.lineTo(R * 0.6, -R * 0.75); c.lineTo(-R * 0.4, -R * 2.6); c.lineTo(-R * 0.7, -R * 0.75); c.closePath(); fillStroke(c, gradX(c, -R, R, pal.hat || '#4a3a8a', -0.3, 0.2), 1.3); c.fillStyle = pal.trim || '#d9b25a'; c.fillRect(-R * 0.75, -R * 0.85, R * 1.4, R * 0.18); },
  cap: (pal) => (c, R) => { c.beginPath(); c.ellipse(0, -R * 0.6, R * 1.0, R * 0.55, 0, Math.PI, 0); c.lineTo(R * 1.5, -R * 0.55); c.lineTo(R * 0.8, -R * 0.45); c.closePath(); fillStroke(c, pal.hat || '#3a5a3a', 1.2); },
};
function drawHammer(c) { c.fillStyle = '#6a4a30'; c.fillRect(-1.5, -6, 3, 26); c.strokeStyle = OUTLINE; c.lineWidth = 1; c.strokeRect(-1.5, -6, 3, 26); c.beginPath(); c.rect(-7, 18, 14, 9); fillStroke(c, gradX(c, -7, 7, '#8a8e96', -0.3, 0.3), 1.2); }
function drawStaff(c, pal) { c.fillStyle = '#7a5030'; c.fillRect(-1.5, -14, 3, 44); c.strokeStyle = OUTLINE; c.lineWidth = 1; c.strokeRect(-1.5, -14, 3, 44); c.beginPath(); c.arc(0, 33, 4.5, 0, TAU); fillStroke(c, pal.orb || '#6ad0ff', 1.2); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = shade(pal.orb || '#6ad0ff', 0.3, 0.5); c.beginPath(); c.arc(0, 33, 7, 0, TAU); c.fill(); c.restore(); }
function drawGun(c, pal, o = {}) {
  // 左轮：局部 +y 为枪管方向
  c.fillStyle = '#3a2a22'; c.beginPath(); c.moveTo(-2, -8); c.lineTo(2.5, -8); c.lineTo(3, 2); c.lineTo(-2.5, 2); c.closePath(); fillStroke(c, '#5a3a28', 1);
  c.beginPath(); c.rect(-2.8, 1, 5.6, 7); fillStroke(c, gradX(c, -3, 3, '#8a8e96', -0.3, 0.3), 1);
  c.beginPath(); c.rect(-1.6, 7, 3.2, 12); fillStroke(c, gradX(c, -2, 2, '#b8bec8', -0.3, 0.4), 1);
  if (o.muzzle) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,220,120,${o.muzzle})`; c.beginPath(); c.moveTo(0, 19); c.lineTo(5, 28); c.lineTo(0, 34); c.lineTo(-5, 28); c.closePath(); c.fill(); c.restore(); }
}
