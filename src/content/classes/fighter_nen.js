/* =====================================================================
   格斗家转职：气功师（男，nenmaster）—— B4，按国服现版对齐（docs/SKILLS_OFFICIAL_fighter.md 第 4 节；逐技能对照见 docs/skills/fighter_nen_final.md）
   光属性魔法（J.dmgType:'mag'，技能全部 type:'mag' + elem:'light'），布甲。29 个技能到三觉：
     念气环绕：最多 5 颗念气珠绕身旋转（每 0.1 秒补 1 颗），碰到敌人就打（打中的那颗消失再补），每颗减伤、持续耗 MP；念气环绕：御 放大半径 / 加速
     念兽·龙虎啸：永久 BUFF，普攻变 5 段光属性魔法（虎爪），跑攻 / 跳攻也换，最后一段 / 跑攻 / 跳攻感电（FIGHTER_ACT_PICK）
     风雷能量（二觉，风雷引）：0~1000，技能命中积攒（每个技能各自的数值，namu 现版表 FN_GAIN），≥500 可以开风雷啸：大技能霸体 + 螺旋球（原技能 70%），每次施放耗能量；
       HUD 小条画在 MP 球上方（包一层 ui.drawPanel）；进地下城能量 500（禅意·万象：满，战斗中自动回复）
     念气罩：原地半球罩，罩里的自己和队友全部无敌（net/party_sync.js 的 partyCast 'fn_guard'，队友那边按同一房间 + 位置判断）
     一觉 念兽：审判之金雷虎（骑乘，方向键控制，跳 3 次）/ 二觉 月华万象（吸怪 + 连按加段，之后 10 秒能量全满）/ 三觉 禅意·归一（打坐升空，光轮爆炸）
   基础技能的改造：蓄念炮（按住念气波蓄力）和幻影爆碎（分身改成碰到就炸、再按收回合体爆炸）做成本转职自己的技能（指令同原技能、冷却 / 学习等级更高，
     按千海天规则抢占同一指令），B3 的 f_nenshot / f_clone 存在时再用 morph 把技能栏上的原技能换过去
   美术：人物帧由 B1 出（没出之前 J.anims 兜底到通用帧、矢量占位模型用下面的 fn* 骨骼片段）；特效复用 fx（chaser / orb / thunderbolt / pm_bubble / rune / hexagram / vortex / laser …）
     运行时染金色，念兽 / 光轮先程序画（fnBeast / fnRing，有 fx/fn_beast_* 素材时自动换成素材）
   ===================================================================== */
const NEN = 'nenmaster';
CLASSES.fighter.jobs.nenmaster = { art: 'job/nenmaster', name: '气功师', role: '中距离 · 念气（光属性魔法）', armor: 'cloth', dmgType: 'mag', growth: { int: 1.1, spr: 1.05 },
  awakenName: '狂虎帝', awakenName2: '念皇', awakenName3: '归元·气功师', ready: true,
  desc: '以念气为武器的格斗家。念气珠环绕周身自动出击，念兽·龙虎啸让普攻化为光属性魔法，二觉的风雷能量槽攒满后开启风雷啸；念气罩护住罩内的队友。光属性魔法伤害职业。',
  skills: [], anims: {} };
const NEN_COL = '#ffd23a', NEN_WHITE = '#fff4c8', NEN_DEEP = '#f0a020', NEN_BOLT = '#fff39a';
const fnIs = p => !!p && p.cls === 'fighter' && jobOf(p) === NEN;
const fnAlive = e => !!e && !e.dead && !e.remove && ents.indexOf(e) >= 0;
// 本转职的命中：光属性魔法；fnSk = 技能 id（投射物 / 地面效果 / 召唤物的命中也能认出是哪个技能，风雷能量按技能积攒）
const fnHit = (sk, o) => ({ type: 'mag', elem: 'light', col: NEN_COL, fnSk: sk, ...o });
function fnAfter(e, t, fn) { game.after(t, () => { if (fnAlive(e)) fn(); }); }
const fnRk = () => { const R = game.dungeon && game.dungeon.room; return R && R.gx !== undefined ? R.gx + ',' + R.gy : ''; };
const fnClampX = (x, pad = 40) => { const R = game.room; return R ? clamp(x, R.x0 + pad, R.x1 - pad) : x; };
// 素材换成念气的金色：色相旋转矩阵（tintImg，同 CSS hue-rotate）转大角度时会偏绿，fx.js 的 FX_BASE_HUE 又是粗略底色 → 按素材实测的角度转（离线算过：
// 旋转后饱和像素的平均色相落在 43~49°）。白色系（NEN_WHITE / NEN_BOLT）= 同一角度再降饱和；表里没有的素材照常走 fxTint（不改共享表）
const FN_GOLD_DEG = { laser: -174, hexagram: -174, rune: -168, pm_bubble: -162, thunderbolt: 177, thrust: -147, slash: -144, orb: 126, vortex: 147, pillar: 21, aura: 3, shock: 21, burst: 6, chaser: 0 };
function fnTint(name, col) {
  const deg = FN_GOLD_DEG[name]; if (deg === undefined || !IMG['fx/' + name]) return fxTint(name, col);
  const pale = hueOf(col).s < 0.45; return tintImg('fx/' + name, deg, pale ? 1.12 : 1, pale ? 0.4 : 1);
}
// 横向念气光束（金色激光素材，宽度随时间收缩）
function fnBeam(x, y, z, len, face, w, dur) { const img = fnTint('laser', NEN_COL); return addFx({ x, y: y + 1, z, dur, face, draw(c) { const k = this.t / this.dur, h = w * (k < 0.1 ? k / 0.1 : 1 - easeIn(Math.max(0, (k - 0.5) / 0.5)) * 0.9);
  drawSpr(c, img, sx(this.x), sy(this.y, this.z), len, h, { ax: 0, ay: 0.5, flip: this.face < 0, alpha: k > 0.8 ? (1 - k) / 0.2 : 1 }); drawSpr(c, 'spark', sx(this.x), sy(this.y, this.z), w * 1.6, 0, { alpha: 1 - k }); } }); }

/* ---- 程序画的特效构件 ---- */
function fnBoltPath(c, x0, y0, x1, y1, seg, amp) { c.beginPath(); c.moveTo(x0, y0); for (let i = 1; i < seg; i++) { const k = i / seg; c.lineTo(lerp(x0, x1, k) + rnd(-amp, amp), lerp(y0, y1, k) + rnd(-amp, amp)); } c.lineTo(x1, y1); }
// 锯齿电弧（屏幕坐标）：金色外芯 + 白色内芯
function fnBolt(c, x0, y0, x1, y1, o = {}) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= (o.alpha ?? 1) * FX_DIM; c.lineCap = 'round'; c.lineJoin = 'round';
  fnBoltPath(c, x0, y0, x1, y1, o.seg || 7, o.amp ?? 9); c.strokeStyle = o.col || NEN_COL; c.lineWidth = o.w || 4; c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = (o.w || 4) * 0.35; c.stroke();
  c.restore();
}
// 念气团（金色光球）
function fnBall(c, X, Y, s, alpha = 1) { drawSpr(c, fnTint('orb', NEN_COL), X, Y, s * 1.5, s * 1.5, { alpha: alpha * 0.55, rot: game.t * 3 }); drawSpr(c, 'chaser', X, Y, s, s, { alpha }); }
// 天降金雷（落雷素材染金 + 落点爆闪）
function fnStrike(x, y, o = {}) {
  const h = o.h || 300, w = o.w || 60;
  addFx({ x, y: y + 2, z: 0, dur: o.dur || 0.32, add: true, flip: Math.random() < 0.5, draw(c) {
    const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0), a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
    drawSpr(c, fnTint('thunderbolt', NEN_COL), X, Y + 6, w, h, { ay: 1, flip: this.flip !== (Math.floor(this.t * 40) % 2 === 1), alpha: a });
    drawSpr(c, 'spark', X, Y - 8, w * 1.4 * (0.6 + k), 0, { alpha: a });
  } });
  fxShock(x, y, o.ring || 70, NEN_COL);
}
// 虎爪：3 道平行的金色爪痕扫过（龙虎啸普攻）
function fnClaw(e, o = {}) {
  const { ox = 55, oz = 66, r = 58, a0 = -1.1, a1 = 0.9, rot = 0, big = 1, dur = 0.2 } = o;
  return addFx({ x: e.x + e.face * ox, y: e.y + 0.6, z: e.z + oz, face: e.face, dur, draw(c) {
    const k = this.t / this.dur, sw = easeOut(Math.min(1, k * 3)), X = sx(this.x), Y = sy(this.y, this.z);
    c.save(); c.translate(X, Y); c.scale(this.face * big, big); c.rotate(rot); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k * k) * FX_DIM; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { const rr = r + i * 11; c.beginPath(); c.arc(-rr * 0.4, 0, rr, a0, a0 + (a1 - a0) * sw); c.strokeStyle = NEN_COL; c.lineWidth = 8 - Math.abs(i) * 2.5; c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke(); }
    c.restore();
    if (k < 0.5) drawSpr(c, 'spark', X + this.face * r * 0.5 * big, Y, 36 * big, 0, { alpha: 1 - k * 2 });
  } });
}
/* 念兽剪影（金雷虎 / 獬豸 / 狂虎 / 狮头）：有素材 fx/fn_beast_<kind> 时画素材，没有时程序画一个发光的兽形（身体、四条腿、头、鬃毛、尾巴，腿按 t 摆动）
   (X, Y) = 脚底屏幕坐标，S = 高度像素，face = 朝向 */
// 念兽的身体借用万年雪山雪虎（spr/snTiger）的逐帧图：蓝白换成金色，先正常混合画半透明的身体，再叠加一层发光（没加载好时画下面的程序剪影）
const FN_BEAST = 'snTiger';
function fnBeastLoad() { if (fnBeastLoad.on || typeof loadBundles !== 'function') return; fnBeastLoad.on = true; loadBundles(['spr:' + FN_BEAST]).catch(() => { }); }
// 金色版（缓存）：蓝色条纹转成金色 → 整体罩一层金色；头像版（狮子吼 / 龙虎啸的虎头）用径向渐变只留下头部
const FN_GOLD = {}, FN_HEAD_AT = [0.74, 0.3];
function fnGold(key, head) {
  const ck = key + (head ? '|h' : ''); if (FN_GOLD[ck]) return FN_GOLD[ck];
  const im = IMG[key]; if (!im) return null;
  const [cv, x] = offCanvas(im.width, im.height); x.drawImage(tintImg(key, -168, 1.06, 1.15) || im, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,178,30,.52)'; x.fillRect(0, 0, im.width, im.height);
  if (head) { const cx = im.width * FN_HEAD_AT[0], cy = im.height * FN_HEAD_AT[1], g = x.createRadialGradient(cx, cy, 0, cx, cy, im.width * 0.3); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.65, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, im.width, im.height); }
  return (FN_GOLD[ck] = cv);
}
function fnBeastSpr(c, X, Y, S, face, kind, t, alpha) {
  const head = kind === 'head', f = head ? 'taunt' : kind === 'idle' ? 'idle' : 'run' + (1 + Math.floor(t * 12) % 8), key = `spr/${FN_BEAST}/${f}`;
  const SD = typeof SPR_DATA !== 'undefined' && SPR_DATA[FN_BEAST], D = SD && SD.frames[f], im = IMG[key];
  if (!im || !D) return false;
  const img = fnGold(key, head), H0 = (SD.frames.idle && SD.frames.idle.h) || im.height, k = S / H0 * (head ? 1.7 : 1);
  const ax = head ? im.width * FN_HEAD_AT[0] : D.ax * im.width / (D.w || im.width), ay = head ? im.height * FN_HEAD_AT[1] : D.ay * im.height / (D.h || im.height);
  c.save(); c.translate(X, head ? Y - S * 0.6 : Y); c.scale(face * k, k); c.globalAlpha *= alpha * 0.72; c.drawImage(img, -ax, -ay);   // 头像：和程序画的一样，头的中心在 Y 上方 0.6S
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha * 0.4 * FX_DIM; c.drawImage(img, -ax, -ay);
  c.restore();
  return true;
}
function fnBeast(c, X, Y, S, face, kind, t, alpha = 1) {
  const img = IMG['fx/fn_beast_' + kind];
  if (img) { drawSpr(c, img, X, Y, 0, S, { ay: 0.95, flip: face < 0, alpha }); return; }
  fnBeastLoad(); if (fnBeastSpr(c, X, Y, S, face, kind, t, alpha)) return;
  const head = kind === 'head', hs = head ? 1.8 : 1, hx = head ? 0 : 70, hy = head ? -60 : -80;
  const legs = [[-44, 0], [-26, Math.PI], [28, Math.PI * 0.5], [46, Math.PI * 1.5]];
  // 剪影路径：身体 + 四条腿 + 尾巴（线）+ 头 + 耳朵；鬃毛（狮 / 獬豸）是一圈尖刺
  const body = () => { c.beginPath(); if (!head) c.ellipse(0, -56, 70, 32, -0.06, 0, TAU); c.moveTo(hx + 34 * hs, hy); c.arc(hx, hy, 34 * hs, 0, TAU); };
  const limbs = w => { if (head) return; c.lineWidth = w; for (const [lx, ph] of legs) { const sw = Math.sin(t * 11 + ph) * 12; c.beginPath(); c.moveTo(lx, -46); c.lineTo(lx + sw * 0.5, -22); c.lineTo(lx + sw, 0); c.stroke(); }
    c.lineWidth = w * 0.6; c.beginPath(); c.moveTo(-66, -62); c.quadraticCurveTo(-96, -86 + Math.sin(t * 6) * 8, -88, -110); c.stroke(); };
  const mane = () => { if (kind === 'tiger') return; c.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + Math.sin(t * 5 + i) * 0.08; c.moveTo(hx + Math.cos(a - 0.22) * 28 * hs, hy + Math.sin(a - 0.22) * 28 * hs); c.lineTo(hx + Math.cos(a) * 54 * hs, hy + Math.sin(a) * 54 * hs); c.lineTo(hx + Math.cos(a + 0.22) * 28 * hs, hy + Math.sin(a + 0.22) * 28 * hs); } };
  c.save(); c.translate(X, Y); c.scale(face * S / 100, S / 100); c.globalAlpha *= alpha * FX_DIM; c.lineCap = 'round'; c.lineJoin = 'round';
  // 1) 半透明的金色实体（正常混合，亮背景上也看得见）
  c.fillStyle = 'rgba(236,160,30,.5)'; c.strokeStyle = 'rgba(236,160,30,.5)'; mane(); c.fill(); body(); c.fill(); limbs(12);
  // 2) 发光：内芯渐变 + 描边
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(head ? 0 : 10, head ? -60 : -60, 6, head ? 0 : 10, head ? -60 : -60, head ? 110 : 100); g.addColorStop(0, 'rgba(255,248,200,.7)'); g.addColorStop(0.6, 'rgba(255,200,60,.28)'); g.addColorStop(1, 'rgba(255,160,20,0)');
  c.fillStyle = g; body(); c.fill();
  c.strokeStyle = 'rgba(255,236,150,.95)'; c.lineWidth = 3; body(); c.stroke(); mane(); c.stroke(); limbs(3);
  // 3) 五官：眼睛、獠牙 / 嘴、耳朵、虎纹、獬豸的独角（白色细线）
  c.strokeStyle = '#ffffff'; c.lineWidth = 2.6 * hs; c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(hx - 14 * hs, hy - 26 * hs); c.lineTo(hx - 6 * hs, hy - 44 * hs); c.lineTo(hx + 2 * hs, hy - 28 * hs); c.moveTo(hx + 8 * hs, hy - 28 * hs); c.lineTo(hx + 18 * hs, hy - 42 * hs); c.lineTo(hx + 22 * hs, hy - 22 * hs); c.stroke();
  if (kind === 'haitai') { c.beginPath(); c.moveTo(hx + 6 * hs, hy - 30 * hs); c.lineTo(hx + 22 * hs, hy - 68 * hs); c.stroke(); }
  if (kind === 'tiger' || head) { c.lineWidth = 2.2 * hs; for (const yy of [-12, 0, 12]) { c.beginPath(); c.moveTo(hx - 30 * hs, hy + yy * hs); c.lineTo(hx - 16 * hs, hy + (yy + 4) * hs); c.stroke(); } if (!head) for (const bx of [-30, -8, 14]) { c.beginPath(); c.moveTo(bx, -86); c.lineTo(bx + 8, -64); c.stroke(); } }
  c.beginPath(); c.ellipse(hx + 14 * hs, hy - 8 * hs, 5 * hs, 3 * hs, 0.3, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(hx + 18 * hs, hy + 10 * hs); c.lineTo(hx + 40 * hs, hy + (6 + Math.sin(t * 9) * 4) * hs); c.lineTo(hx + 20 * hs, hy + 22 * hs); c.stroke();
  c.restore();
}
// 光轮（禅意·归一）：法阵素材染金 + 几圈发光环
function fnRing(c, X, Y, R, a, t) {
  if (R < 2) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= a * FX_DIM;
  const g = c.createRadialGradient(X, Y, R * 0.2, X, Y, R * 1.15); g.addColorStop(0, 'rgba(255,250,215,.55)'); g.addColorStop(0.7, 'rgba(255,205,70,.28)'); g.addColorStop(1, 'rgba(255,160,20,0)');
  c.fillStyle = g; c.beginPath(); c.arc(X, Y, R * 1.15, 0, TAU); c.fill();
  for (let i = 0; i < 3; i++) { c.strokeStyle = i === 1 ? '#ffffff' : NEN_COL; c.lineWidth = i === 1 ? 2 : 5; c.beginPath(); c.arc(X, Y, R * (0.72 + i * 0.14), 0, TAU); c.stroke(); }
  c.restore();
  drawSpr(c, fnTint('rune', NEN_COL), X, Y, R * 1.9, R * 1.9, { rot: t * 0.8, alpha: a * 0.9 });
}

/* ---- 矢量占位模型的骨骼片段（B1 出帧之前）+ 精灵动画表（出帧之后；帧名 fn_ 前缀，没有时兜底到格斗家通用帧） ---- */
POSE.fnPalm = P(POSE.idle, { torso: -10, head: 6, uaF: 92, faF: 0, wF: -90, uaB: -34, faB: 70, thF: 30, shF: -20, thB: -26, shB: -10 });
POSE.fnPalm2 = P(POSE.idle, { torso: -12, head: 6, uaF: 88, faF: 4, wF: -90, uaB: 84, faB: 8, thF: 34, shF: -24, thB: -28, shB: -8 });
POSE.fnSeal = P(POSE.idle, { torso: 2, head: 4, uaF: 40, faF: 112, wF: -60, uaB: 30, faB: 124 });
POSE.fnFocus = P(POSE.idle, { g: 0, r: [0, 8, 0], torso: 12, head: -6, uaF: 20, faF: 120, uaB: -10, faB: 120, thF: 50, shF: -60, thB: 20, shB: -50 });
POSE.fnMed = P(POSE.idle, { g: 0, r: [0, 34, 0], torso: -2, head: 2, thF: 92, shF: -160, ftF: 70, thB: 80, shB: -150, ftB: 70, uaF: 34, faF: 116, uaB: 26, faB: 126 });
POSE.fnRide = P(POSE.idle, { g: 0, r: [0, 22, 0], torso: -14, head: 8, thF: 70, shF: -80, thB: 40, shB: -70, uaF: 70, faF: 30, uaB: 110, faB: -20 });
POSE.fnStab = P(POSE.idle, { torso: -16, head: 8, uaF: 96, faF: -6, wF: -90, uaB: -60, faB: 40, thF: 46, shF: -30, thB: -34, shB: -14 });
POSE.fnUp = P(POSE.idle, { torso: -6, head: 10, uaF: 170, faF: 0, uaB: 160, faB: 10 });
CLIPS.fighter.fnPalm = { dur: 0.3, fps: 24, keys: [k(0, POSE.fnSeal, 'hold'), k(0.06, POSE.fnPalm, 'out'), k(0.3, POSE.fnPalm)] };
CLIPS.fighter.fnPalm2 = { dur: 0.3, fps: 24, keys: [k(0, POSE.fnSeal, 'hold'), k(0.06, POSE.fnPalm2, 'out'), k(0.3, POSE.fnPalm2)] };
CLIPS.fighter.fnSeal = { dur: 0.4, keys: [k(0, POSE.fnSeal)] };
CLIPS.fighter.fnFocus = { dur: 0.4, keys: [k(0, POSE.fnFocus)] };
CLIPS.fighter.fnMed = { dur: 0.4, keys: [k(0, POSE.fnMed)] };
CLIPS.fighter.fnRide = { dur: 0.4, keys: [k(0, POSE.fnRide)] };
CLIPS.fighter.fnStab = { dur: 0.3, fps: 24, keys: [k(0, POSE.fnSeal, 'hold'), k(0.08, POSE.fnStab, 'out'), k(0.3, POSE.fnStab)] };
CLIPS.fighter.fnUp = { dur: 0.3, keys: [k(0, POSE.fnSeal, 'hold'), k(0.1, POSE.fnUp, 'out'), k(0.3, POSE.fnUp)] };
CLIPS.fighter.fnAxe = CLIPS.fighter.atk4;
const fnTl = (tl, fb) => typeof SPR_DATA !== 'undefined' && SPR_DATA.fighter && SPR_DATA.fighter.frames[tl[0][0]] ? tl : fb;
const FN_ANIMS = {
  fnPalm: fnTl([['f_palm1', 0]], [['idle', 0]]), fnPalm2: fnTl([['f_palm2', 0]], fnTl([['f_palm1', 0]], [['idle', 0]])),
  fnSeal: fnTl([['f_seal', 0]], [['charge', 0]]), fnFocus: fnTl([['f_focus', 0]], [['charge', 0]]), fnAxe: fnTl([['f_axe1', 0], ['f_axe2', 0.1]], [['idle', 0]]),
  fnMed: fnTl([['fn_meditate', 0]], fnTl([['f_seal', 0]], [['charge', 0]])), fnRide: fnTl([['fn_ride', 0]], [['jump3', 0]]),
  fnStab: fnTl([['fn_thrust1', 0], ['fn_thrust2', 0.08]], fnTl([['f_palm1', 0]], [['idle', 0]])), fnUp: fnTl([['f_focus', 0], ['fb_chain1', 0.1]], fnTl([['f_focus', 0]], [['charge', 0]])),
};

/* ---- 风雷能量（风雷引 fn_absorb；namu 2026-07 现版：[命中获得, 风雷啸开启时施放消耗]）---- */
const FN_GAIN = { f_nenshot: [50, 0], fn_cannon: [50, 0], fn_legstrike: [70, 0], fn_nencannon2: [70, 0], fn_press: [80, 20], fn_stone: [100, 0], fn_blast: [90, 0], fn_tigerAtk: [14, 0],
  fn_roar: [100, 200], fn_thunderdrop: [100, 200], fn_field: [100, 200], fn_haitai: [120, 120], fn_spear: [120, 240], fn_pillar: [120, 120], fn_blade: [120, 10], fn_awaken: [140, 280], fn_tigerblast: [140, 280] };
const FN_EMAX = 1000, FN_EON = 500;
const fnHasGauge = p => skLv(p, 'fn_absorb') > 0;
const fnWS = p => !!(p && p.buffs && p.buffs.fn_windstorm);
function fnE(p) { if (p._fnE === undefined) p._fnE = FN_EON; return p._fnE; }
function fnGain(p, v) { if (!fnHasGauge(p) || !(v > 0)) return; p._fnE = clamp(fnE(p) + v, 0, FN_EMAX); }
function fnWSOff(p, why) { if (!p.buffs.fn_windstorm) return; delete p.buffs.fn_windstorm; fxText(why || '风雷啸结束', p.x, p.y, p.z + 20, { col: '#c8d0e0', size: 10 }); }
function fnWSOn(p) {
  if (!hasSkill(p, 'fn_windstorm')) return false;
  if (fnE(p) < FN_EON) { if (isHuman(p)) fxText('风雷能量不足', p.x, p.y, p.z + 30, { col: '#9ab', size: 10 }); return false; }
  const lv = Math.max(1, skLv(p, 'fn_windstorm'));
  p.buffs.fn_windstorm = { t: 1e9, lv, hl: NEN_COL, name: '风雷啸' }; sfx.zap(); fxAura(p, NEN_COL, 0.9); fnStrike(p.x, p.y, { w: 70, h: 260, ring: 110 });
  return true;
}
// 风雷啸开启时施放：扣能量（月华万象之后 10 秒不扣）；不够就关掉（这次施放照样生效）
function fnSpend(p, v) {
  if (!fnWS(p) || !(v > 0) || (p.buffs.fn_radiant)) return;
  const e = fnE(p); p._fnE = Math.max(0, e - v);
  if (e < v || p._fnE <= 0) fnWSOff(p, '风雷能量耗尽');
}
// 风雷啸：大技能附加螺旋球（原技能 70% 伤害，分 5 段）
defSummon('fn_wsball', { kind: 'field', life: 0.62, tick: 0.12, hits: 5, max: 12, over: 'oldest', keepRoom: false, type: 'mag', elem: 'light',
  onTick(s) { summonArea(s, s.x, s.y, s.r || 80, fnHit(s.sk || 'fn_windstorm', { dmg: s.dmg / 5, stun: 0.2, knock: 10, hs: 0.02, downHit: true, snd: 'crit' }), { zMax: 180 }); },
  drawUpright(c, s) { const k = s.lifeT / s.life, X = sx(s.x), Y = sy(s.y, 60), a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1, r = (s.r || 80);
    drawSpr(c, fnTint('vortex', NEN_COL), X, Y, r * 1.5, r * 1.5, { rot: -game.t * 9, alpha: a * 0.8 }); fnBall(c, X, Y, r * 0.55, a); } });
function fnWSBall(p, x, y, pow, sk, r = 80) { const s = summon(p, 'fn_wsball', { x, y }); if (s) { s.dmg = pow * 0.7; s.sk = sk; s.r = r; } return s; }

/* ---- 念气环绕（fn_spiral）/ 念气环绕：御（fn_stone）：念气珠状态和每帧逻辑（碰撞 / 补珠 / 耗 MP 在 updateGroundFx 里，只在地下城 / 测试场景跑）---- */
const FN_ORB_MAX = 5, FN_ORB_GEN = 0.1, FN_ORB_CD = 0.35;
function fnOrbs(p) { return p._fnOrb || (p._fnOrb = { on: [false, false, false, false, false], gen: 0, ang: 0, tgt: new Map(), n: 0 }); }
const fnOrbR = p => (p.buffs && p.buffs.fn_stone ? 78 : 52) * (fnWS(p) ? 1.15 : 1);
const fnOrbSize = p => (p.buffs && p.buffs.fn_stone ? 1.35 : 1) * (fnWS(p) ? 1.5 : 1);
const fnOrbDmg = p => skillDmg(0.2, 0.02, Math.max(1, skLv(p, 'fn_spiral'))) * (p.buffs && p.buffs.fn_stone ? 1.3 + 0.03 * Math.max(0, skLv(p, 'fn_stone') - 1) : 1);
function fnOrbPos(p, i) { const S = fnOrbs(p), a = S.ang + i * TAU / FN_ORB_MAX, R = fnOrbR(p); return { x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R * 0.32, z: p.z + 58 + Math.sin(a * 2 + game.t) * 6, back: Math.sin(a) < 0 }; }
function fnSpiralOn(p, lv) {
  p.buffs.fn_spiral = { t: 1e9, lv, dmg: 0.015 + 0.0015 * lv, name: '念气环绕' };
  const S = fnOrbs(p); S.on.fill(false); S.gen = 0; fnOrbFx(p);
}
function fnSpiralOff(p, why) { if (!p.buffs.fn_spiral) return; delete p.buffs.fn_spiral; fnOrbs(p).on.fill(false); if (why) fxText(why, p.x, p.y, p.z + 20, { col: '#c8d0e0', size: 10 }); }
function fnOrbTick(p, dt) {
  const S = fnOrbs(p);
  if (!p.buffs.fn_spiral || p.dead) { if (S.on.some(Boolean)) S.on.fill(false); S.n = 0; return; }
  const drain = (2.4 + 0.25 * (p.buffs.fn_spiral.lv || 1)) * dt;   // 持续耗 MP（官方女气功 1 级 2.6/秒，男版没写，按同量级）
  if (p.mp < drain) { fnSpiralOff(p, 'MP 不足，念气环绕关闭'); return; }
  p.mp -= drain;
  S.ang += dt * (p.buffs.fn_stone ? 5.2 : 3.2);
  S.gen += dt; if (S.gen >= FN_ORB_GEN) { S.gen = 0; const i = S.on.indexOf(false); if (i >= 0) S.on[i] = true; }
  S.n = S.on.filter(Boolean).length;
  if (p.st === 'held' || p.dead) return;
  const size = fnOrbSize(p);
  for (let i = 0; i < FN_ORB_MAX; i++) {
    if (!S.on[i]) continue;
    const o = fnOrbPos(p, i);
    for (const t of ents) {
      if (!foe(p, t) || t.invul > 0 || t.st === 'down' || game.t - (S.tgt.get(t.id) || -9) < FN_ORB_CD) continue;
      if (Math.abs(t.x - o.x) > t.w + 10 * size || Math.abs(t.y - o.y) > (t.d || 10) + 9 * size || o.z < t.z - 10 || o.z > t.z + t.hurtH() + 10) continue;
      S.tgt.set(t.id, game.t); S.on[i] = false; S.gen = 0;
      applyHit(p, t, fnHit('fn_spiral', { dmg: fnOrbDmg(p), stun: 0.06, knock: 0, hs: 0.01, snd: 'crit', sure: true }), { proj: true, src: { x: o.x, y: o.y, z: o.z, face: Math.sign(t.x - p.x) || p.face } });
      fxBurst(o.x, o.y, o.z, 34 * size, NEN_COL);
      break;
    }
  }
}
// 念气珠的画法：前半圈 / 后半圈分两个特效（按 y 排序时分别在人物前 / 后）
function fnOrbFx(p) {
  if (p._fnOrbFx && fxList.indexOf(p._fnOrbFx[0]) >= 0 && fxList.indexOf(p._fnOrbFx[1]) >= 0) return;
  const mk = back => addFx({ ent: p, y: p.y, dur: 1e9, back, update() { const e = this.ent; this.y = e.y + (this.back ? -0.6 : 0.6); if (e.dead || (ents.indexOf(e) < 0 && e !== game.player) || !e.buffs.fn_spiral) this.t = this.dur; },
    draw(c) { const e = this.ent, S = fnOrbs(e), sz = fnOrbSize(e); for (let i = 0; i < FN_ORB_MAX; i++) { if (!S.on[i]) continue; const o = fnOrbPos(e, i); if (o.back !== this.back) continue; fnBall(c, sx(o.x), sy(o.y, o.z), 17 * sz * (this.back ? 0.9 : 1), this.back ? 0.75 : 1); } } });
  p._fnOrbFx = [mk(true), mk(false)];
}

/* ---- 念兽·龙虎啸：普攻换成 5 段光属性魔法（虎爪），跑攻 / 跳攻也换；最后一段 / 跑攻 / 跳攻感电 7 秒（官方魔法武器攻击 160/180/200/220/240%、跑攻 262%、跳攻 349%，按本作普攻尺度等比）---- */
const fnShockOn = (a, t) => addStatus(t, 'shock', 7, { src: a, hitDmg: atkOf(a, 'mag') * 0.14 });
function fnTigerActsFor(F) {
  const R = b => [b[0], Math.round(b[1] * F.reach * 1.15), b[2] + 4, b[3], b[4]], S = s => +(s * F.stun).toFixed(3);   // 龙虎啸：攻击范围变大
  const H = (t0, t1, box, dmg, o) => HB(t0, t1, R(box), dmg, fnHit('fn_tigerAtk', { snd: 'blunt', ...o }));
  const claw = (t, o) => evAt(t, e => { fnClaw(e, o); if (Math.random() < 0.5) sfx.zap(); });
  return {
    atk1: { name: 'atk1', clip: 'atk1', dur: 0.26, basic: true, fnTiger: true, speed: 'aspd', chain: [0.1, 0.26], next: 'atk2', move: [[0.02, 0.06, 90]],
      hits: [H(0.05, 0.09, [0, 80, 30, 30, 110], 1.0, { stun: S(0.28), knock: 40, hs: 0.05 })], events: [claw(0.04, { a0: -1.0, a1: 0.8 })] },
    atk2: { name: 'atk2', clip: 'atk2', dur: 0.28, basic: true, fnTiger: true, speed: 'aspd', chain: [0.1, 0.28], next: 'atk3', move: [[0.02, 0.06, 80]],
      hits: [H(0.04, 0.08, [0, 86, 30, 0, 60], 1.1, { stun: S(0.3), knock: 40, hs: 0.05 })], events: [claw(0.03, { oz: 26, a0: 0.9, a1: -0.7, rot: 0.3 })] },
    atk3: { name: 'atk3', clip: 'atk3', dur: 0.32, basic: true, fnTiger: true, speed: 'aspd', chain: [0.12, 0.32], next: 'atk4', move: [[0.03, 0.08, 110]],
      hits: [H(0.07, 0.12, [0, 92, 32, 20, 100], 1.2, { stun: S(0.34), knock: 60, hs: 0.06 })], events: [claw(0.06, { a0: -0.6, a1: 1.1 })] },
    atk4: { name: 'atk4', clip: 'atk4', dur: 0.36, basic: true, fnTiger: true, speed: 'aspd', chain: [0.14, 0.36], next: 'atk5', move: [[0.03, 0.1, 110]],
      hits: [H(0.12, 0.17, [0, 90, 32, 0, 120], 1.3, { stun: S(0.36), knock: 70, hs: 0.06, downHit: true })], events: [claw(0.1, { a0: -1.6, a1: 0.4, rot: 0.2 })] },
    // 第 5 段：双掌推出虎头念气，感电
    atk5: { name: 'atk5', clip: 'fnPalm2', dur: 0.46, basic: true, fnTiger: true, speed: 'aspd', move: [[0.03, 0.1, 140]],
      hits: [H(0.1, 0.16, [0, 110, 36, 10, 130], 1.6, { stun: S(0.5), knock: 160, hs: 0.09, shake: 3, big: 1.3, heavy: true, onHit: fnShockOn })],
      events: [evAt(0.08, e => { fnClaw(e, { big: 1.4, ox: 60, a0: -1.2, a1: 1.2 }); fnHeadFx(e, 70, 70, 80); sfx.zap(); })] },
    dash: { name: 'dash', clip: 'dash', dur: 0.42, basic: true, fnTiger: true, speed: 'aspd', move: [[0, 0.24, 420]], noCounter: true, keyLinks: { attack: 'f_chain' }, linkFrom: 0.08,
      hits: [H(0.04, 0.24, [0, 70, 32, 20, 100], 1.6, { down: true, knock: 220, hs: 0.07, shake: 2, heavy: true, onHit: fnShockOn })], events: [evAt(0.02, e => { fxAfterimage(e, NEN_COL); fnHeadFx(e, 40, 60, 60); })] },
    jatk: { name: 'jatk', clip: 'jatk', dur: 0.34, basic: true, fnTiger: true, speed: 'aspd', airOnly: true, lowGrav: 0.75,
      hits: [H(0.06, 0.16, [0, 80, 32, -30, 80], 1.4, { stun: S(0.32), knock: 50, hs: 0.05, airLift: 160, onHit: fnShockOn })], events: [claw(0.05, { oz: 30, a0: -1.4, a1: 0.6, rot: 0.6 })] },
  };
}
// 虎头念气（一闪而过的兽头，龙虎啸第 5 段 / 跑攻）
function fnHeadFx(e, ox, oz, S) { addFx({ x: e.x + e.face * ox, y: e.y + 0.7, z: e.z + oz, face: e.face, dur: 0.3, draw(c) { const k = this.t / this.dur; fnBeast(c, sx(this.x), sy(this.y, this.z - S * 0.5), S * (0.8 + k * 0.4), this.face, 'head', game.t, 1 - k); } }); }
const FN_TIGER_ACTS = {}; for (const w in FIGHTER_FEEL) FN_TIGER_ACTS[w] = fnTigerActsFor(FIGHTER_FEEL[w]);
FIGHTER_ACT_PICK.push(p => fnIs(p) && p.buffs && p.buffs.fn_tiger ? FN_TIGER_ACTS[wtypeOf(p)] || FN_TIGER_ACTS.knuckle : null);
// 龙虎啸期间：拳头上的金色电光（人物身上的常驻小特效）
function fnTigerFx(p) {
  if (p._fnTgFx && fxList.indexOf(p._fnTgFx) >= 0) return;
  p._fnTgFx = addFx({ ent: p, y: p.y, dur: 1e9, update() { const e = this.ent; this.y = e.y + 0.8; if (e.dead || (ents.indexOf(e) < 0 && e !== game.player) || !e.buffs.fn_tiger) this.t = this.dur; },
    draw(c) { const e = this.ent; if (Math.floor(game.t * 20) % 3) return; const X = sx(e.x + e.face * 22), Y = sy(e.y, e.z + 62); fnBolt(c, X + rnd(-8, 8), Y + rnd(-10, 10), X + rnd(-16, 16), Y + rnd(-22, 22), { w: 2.2, seg: 4, amp: 5, alpha: 0.8 }); } });
}

/* ---- 被动（每 0.25 秒）：进地下城自动开龙虎啸 / 念气环绕、能量重置、光属性 / 抗性、风雷引自动学会、禅意·万象回能 ---- */
const FN_IMMUNE = { blind: true };
// 进地下城（换了地下城才算）：能量 500（禅意·万象：满），龙虎啸 / 念气环绕自动施放（官方：进地下城自动开启）
function fnEnter(p) {
  p._fnE = hasSkill(p, 'fn_nature') ? FN_EMAX : FN_EON; delete p.buffs.fn_windstorm; delete p.buffs.fn_radiant;
  if (hasSkill(p, 'fn_tiger') && !p.buffs.fn_tiger) fnTigerOn(p, skLv(p, 'fn_tiger'));
  if (hasSkill(p, 'fn_spiral') && !p.buffs.fn_spiral) fnSpiralOn(p, skLv(p, 'fn_spiral'));
}
function fnTattooVal(lv) { return { atk: 0.05 + 0.01 * lv, aspd: 0.05 + 0.005 * lv, cspd: 0.05 + 0.005 * lv, light: 8 + 2 * lv }; }
function fnPassive(p) {
  if (!fnIs(p)) return;
  fnHudHook(); fnBeastLoad();
  const dg = game.dungeon || null;
  if (p._fnDg !== dg) { p._fnDg = dg; if (dg) fnEnter(p); }
  if (isHuman(p) && !p.kit && game.skillLv && !(game.skillLv.fn_absorb > 0) && game.lvl >= SKILLS.fn_absorb.lvReq && tierUnlocked(2)) game.skillLv.fn_absorb = 1;   // 风雷引：二觉后自动学会
  // 念气感知：失明免疫（官方：失明抗性）
  if (hasSkill(p, 'fn_sense')) { if (!p.statusImmune) p.statusImmune = FN_IMMUNE; } else if (p.statusImmune === FN_IMMUNE) p.statusImmune = null;
  // 光之亲和：光抗 +20、暗抗 -10；念气流转：光属性强化（p.res / p.elem 由 recalcStats 重建，这里按重建后的基准值叠加）
  if (p.res && p.res !== p._fnResRef) { p._fnResRef = p.res; p._fnRes0 = { light: p.res.light, dark: p.res.dark }; }
  if (p.res && p._fnRes0) { const on = hasSkill(p, 'fn_lightaff'); p.res.light = p._fnRes0.light + (on ? 20 : 0); p.res.dark = p._fnRes0.dark - (on ? 10 : 0); }
  if (p.elem && p.elem !== p._fnElemRef) { p._fnElemRef = p.elem; p._fnElem0 = p.elem.light || 0; }
  if (p.elem && p._fnElemRef) p.elem.light = p._fnElem0 + (p.buffs.fn_tattoo ? p.buffs.fn_tattoo.light || 0 : 0);
  const cl = skLv(p, 'fn_cloth'), cn = skLv(p, 'fn_conduit'), na = skLv(p, 'fn_nature'), ws = skLv(p, 'fn_windstorm');
  setPassive(p, 'fn_cloth', cl > 0, { cspd: (0.01 + 0.002 * cl) * Math.min(5, p.masteryN ?? 5) / 5, crit: (0.005 + 0.001 * cl) * Math.min(5, p.masteryN ?? 5) / 5 });
  setPassive(p, 'fn_conduit', cn > 0, { crit: 0.04 + 0.01 * cn, critDmg: 0.05 + 0.012 * cn });
  setPassive(p, 'fn_nature', na > 0, { dmg: 0.1 + 0.01 * na });
  setPassive(p, 'fn_wsP', ws > 0, { dmg: 0.06 + 0.01 * ws, hide: true, name: '风雷啸（被动）' });
  if (fnHasGauge(p)) {
    if (p.buffs.fn_radiant) p._fnE = FN_EMAX;
    else if (na > 0 && (game.scene === 'dungeon' || game.scene === 'test') && !p.dead) fnGain(p, 2.5);   // 禅意·万象：战斗中每 0.2 秒回复 2 点
    if (fnWS(p) && fnE(p) <= 0) fnWSOff(p, '风雷能量耗尽');
    setPassive(p, 'fn_absorb', true, { n: Math.floor(fnE(p)), hide: true });
  } else if (fnWS(p)) delete p.buffs.fn_windstorm;
  if (p.buffs.fn_spiral) { const S = fnOrbs(p); p.buffs.fn_spiral.taken = -0.012 * S.n; fnOrbFx(p); }
  if (p.buffs.fn_tiger) fnTigerFx(p);
}
CLASSES.fighter.passives.push(fnPassive);
// 每帧逻辑（只在地下城 / 测试场景）：念气珠
{ const u0 = updateGroundFx; updateGroundFx = function (dt) { u0(dt); try { for (const e of ents) if (e.fighter && e.cls === 'fighter' && fnIs(e)) fnOrbTick(e, dt); } catch (err) { console.error('气功师', err); } }; }

/* ---- 钩子：施放计数 / 风雷能量（命中积攒、施放消耗）/ 念气感知 ---- */
FIGHTER_HOOKS.onCast.push((p, id, act, how) => {
  if (!fnIs(p)) return;
  const S = (p._fnSer = (p._fnSer || 0) + 1); (p._fnCast ||= {})[id] = S;
  if (id === 'f_nenshot') p._fnShotT = game.t;
  const G = FN_GAIN[id]; if (G && how !== 'recast') fnSpend(p, G[1]);
  if (id === 'fn_stone' && fnHasGauge(p)) fnGain(p, FN_GAIN.fn_stone[0]);   // 自己身上生效的技能：施放就积攒
});
FIGHTER_HOOKS.onHit.push((p, t, h, dmg, act, opt) => {
  if (!fnIs(p)) return;
  let sk = h.fnSk || (act && act.skill) || null;
  if (!sk && opt && opt.proj && game.t - (p._fnShotT ?? -9) < 1.5) sk = 'f_nenshot';   // B3 的念气波（投射物认不出技能，按施放时间认）
  if (sk === 'f_nenshot' && hasSkill(p, 'fn_sense') && Math.random() < 0.3) addStatus(t, 'shock', 5, { src: p });   // 念气感知：念气波感电几率提升
  if (!sk || !FN_GAIN[sk] || !fnHasGauge(p)) return;
  if (fnWS(p) && FN_GAIN[sk][1] > 0) return;   // 风雷啸开启后只有不耗能的小技能能积攒
  if (sk === 'fn_tigerAtk') { if (act && !act._fnG) { act._fnG = 1; fnGain(p, FN_GAIN[sk][0]); } return; }
  const ser = (p._fnCast || {})[sk]; if (!ser) return;
  const got = (p._fnGot ||= {}); if (got[sk] === ser) return; got[sk] = ser; fnGain(p, FN_GAIN[sk][0]);
});

/* ---- HUD：风雷能量小条（MP 球上方；触屏画在左上 BUFF 下面）---- */
function fnHudHook() {
  if (fnHudHook.on || typeof ui === 'undefined' || !ui || !ui.drawPanel) return; fnHudHook.on = true;
  const d0 = ui.drawPanel;
  ui.drawPanel = function (c) { d0.call(this, c); try { fnDrawGauge(c); } catch (e) { console.error('风雷能量条', e); } };
}
function fnDrawGauge(c) {
  const p = game.player; if (!fnIs(p) || !fnHasGauge(p)) return;
  const touchOn = typeof touch !== 'undefined' && touch.on, w = touchOn ? 400 : 190, h = touchOn ? 14 : 14;
  const x = touchOn ? (touch.hudX || 30) + 110 : HUD.mp.x - w / 2, y = touchOn ? 172 : HUD.y0 - 40;   // 触屏：放在 BUFF 行（y 100~150，含倒计时）下面，标题字不压住 BUFF
  const e = fnE(p), f = e / FN_EMAX, on = fnWS(p), full = e >= FN_EON;
  c.fillStyle = 'rgba(10,8,8,.8)'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
  const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#8a6010'); g.addColorStop(1, on ? '#fff6b0' : '#ffd23a');
  c.fillStyle = g; c.fillRect(x, y, w * clamp(f, 0, 1), h);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + w * 0.5 - 1, y - 2, 2, h + 4);   // 500：风雷啸的开启线
  if (on) { c.strokeStyle = `rgba(255,240,150,${0.6 + 0.4 * Math.sin(game.t * 8)})`; c.lineWidth = 2.5; c.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3); }
  uiText(`风雷 ${Math.floor(e)}`, x + w / 2, y - 5, { size: 15, align: 'center', color: on ? '#fff6b0' : full ? '#ffe070' : '#d8c8a0', sw: 3 });
}

/* =====================================================================
   技能（官方Lv→本作Lv 按 common.md 第 7 节；冷却写官方现版，刷图的冷却系数由 recalcStats 统一乘）
   ===================================================================== */
const fnDef = (id, S) => defSkill(id, { cls: 'fighter', job: NEN, type: 'mag', elem: S.passive ? undefined : 'light', col: NEN_COL, ...S });
// ---- 被动 ----
fnDef('fn_sense', { name: '念气感知', lvReq: 15, maxLv: 1, sp: 0, passive: true, col: '#e0c060',
  desc: '【被动，转职时自动学会】能感知念气的流动：失明免疫；念气波命中时感电的几率提高。' });
fnDef('fn_lightaff', { name: '光之亲和', lvReq: 15, maxLv: 1, sp: 0, passive: true, col: '#fff0a0',
  desc: '【被动，转职时自动学会】身体和光之念气相合：光属性抗性 +20，暗属性抗性 -10。' });
fnDef('fn_cloth', { name: '气功师布甲精通', lvReq: 15, passive: true, col: '#b89a70',
  desc: '【被动】穿布甲时施放速度、魔法暴击率提高（按身上精通布甲的件数，5 件全额）。', infoExtra: lv => [['施放速度', '+' + pct(0.01 + 0.002 * lv)], ['魔法暴击率', '+' + pct(0.005 + 0.001 * lv)]] });
fnDef('fn_conduit', { name: '念之奥义', tier: 1, lvReq: 21, passive: true, col: '#ffe070',
  desc: '【被动·一觉】对念气的理解更深一层：魔法暴击率、暴击伤害提高。', infoExtra: lv => [['魔法暴击率', '+' + pct(0.04 + 0.01 * lv)], ['暴击伤害', '+' + pct(0.05 + 0.012 * lv)]] });
fnDef('fn_absorb', { name: '风雷引', tier: 2, lvReq: 26, maxLv: 1, sp: 0, passive: true, col: '#ffd23a',
  desc: '【被动·二觉，自动学会】技能命中时积攒风雷能量（0~1000，屏幕下方的金色小条）。每个技能获得的量不同：念气波 / 蓄念炮 50、雷霆踏 / 雷霆念炮 70、念气环绕：袭 80、幻影爆碎 90、狮子吼 / 雷虎天降 / 螺旋念气场 100、猛虎震地 / 念之战矛 / 冲云念气场 / 奔雷螺旋击 120、金雷虎 / 禅语·形灭 140、龙虎啸普攻每次 14。进入地下城时能量 500。能量 500 以上可以开启风雷啸；开启后只有不耗能的小技能能积攒。' });
fnDef('fn_nature', { name: '禅意·万象', tier: 3, lvReq: 29, passive: true, col: '#fff4c8',
  desc: '【被动·三觉】与自然融为一体：技能攻击力提高；进入地下城时风雷能量全满，战斗中每 0.2 秒自动回复 2 点；蓄念炮施放即满蓄；念气环绕：袭 改为追到敌人身边直接爆炸。', infoExtra: lv => [['技能攻击力', '+' + pct(0.1 + 0.01 * lv)]] });
// ---- 念气流转：永久 BUFF（再按关闭）----
fnDef('fn_tattoo', { name: '念气流转', lvReq: 16, mp: 40, cd: 5, buff: true, col: '#f0a830',
  desc: '【BUFF · 再按关闭】在身上刻下念气纹身，强行改变念气的流向：魔法攻击力、光属性强化、攻击速度和施放速度提高；代价是体力下降（受到的伤害 +3%）。持续到关闭为止。',
  infoExtra: lv => { const T = fnTattooVal(lv); return [['魔法攻击力', '+' + pct(T.atk)], ['光属性强化', '+' + T.light], ['攻速 / 施放速度', '+' + pct(T.aspd)], ['受到的伤害', '+3%']]; }, ai: { kind: 'buff' },
  act: lv => ({ name: 'fn_tattoo', clip: 'fnSeal', dur: 0.4, noCounter: true, onStart: e => { if (toggleBuff(e, 'fn_tattoo', 1e9, { ...fnTattooVal(lv), taken: 0.03, name: '念气流转' })) { sfx.buff(); fxAura(e, NEN_DEEP, 0.9); fnStrike(e.x, e.y, { w: 50, h: 200, ring: 60 }); } } }) });
// ---- 念气环绕：开关 BUFF ----
fnDef('fn_spiral', { name: '念气环绕', lvReq: 16, mp: 20, cd: 4.2, buff: true, col: '#ffd23a',
  desc: '【开关 BUFF · 再按关闭，进地下城自动开启】每 0.1 秒生成一颗念气珠，最多 5 颗，绕着身体旋转；念气珠碰到敌人就造成光属性魔法伤害（打中的那颗消失，马上再补），不会让敌人硬直。每颗念气珠降低受到的伤害 1.2%，开启期间技能攻击力提高。开启期间持续消耗 MP，MP 不够时自动关闭。',
  pow: lv => skillDmg(0.2, 0.02, lv), infoExtra: lv => [['每颗念气珠', pct(skillDmg(0.2, 0.02, lv))], ['技能攻击力', '+' + pct(0.015 + 0.0015 * lv)], ['每颗减伤', '1.2%'], ['MP 消耗', `${(2.4 + 0.25 * lv).toFixed(1)} / 秒`]], ai: { kind: 'buff' },
  act: (lv, p) => { const off = !!(p && p.buffs && p.buffs.fn_spiral);
    return { name: 'fn_spiral', clip: 'fnSeal', dur: off ? 0.15 : 0.5, noCounter: true, onStart: e => { if (e.buffs.fn_spiral) { fnSpiralOff(e, '念气环绕 关闭'); return; } fnSpiralOn(e, lv); sfx.buff(); fxAura(e, NEN_COL, 0.6); } }; } });
// ---- 念气环绕：御（80 秒放大半径、加快转速、提高念气珠攻击力）----
fnDef('fn_stone', { name: '念气环绕：御', lvReq: 18, maxLv: 1, mp: 60, cd: 40, buff: true, col: '#e8b040', pre: { fn_spiral: 1 },
  desc: '【BUFF · 80 秒】念气珠的旋转半径变大、转速变快，攻击力提高 30%（需要念气环绕开启才看得到效果）。风雷啸开启时念气珠再变大 50%。',
  infoExtra: () => [['持续时间', '80 秒'], ['念气珠攻击力', '+30%'], ['旋转半径', '52 → 78']], ai: { kind: 'buff' },
  act: lv => ({ name: 'fn_stone', clip: 'fnSeal', dur: 0.5, noCounter: true, onStart: e => { e.buffs.fn_stone = { t: 80, name: '念气环绕：御' }; if (!e.buffs.fn_spiral && hasSkill(e, 'fn_spiral')) fnSpiralOn(e, skLv(e, 'fn_spiral')); sfx.buff(); fxShock(e.x, e.y, 150, NEN_COL); } }) });
// ---- 念兽·龙虎啸：永久 BUFF，普攻变 5 段魔法 ----
function fnTigerOn(p, lv) { p.buffs.fn_tiger = { t: 1e9, lv, mspd: 0.15, taken: -0.1, dmg: 0.03, name: '念兽·龙虎啸' }; p.acts = fighterActs(p); fnTigerFx(p); }
fnDef('fn_tiger', { name: '念兽·龙虎啸', lvReq: 18, mp: 60, cd: 5, buff: true, col: '#ffc830',
  desc: '【永久 BUFF，进地下城自动开启】召来雷虎附在身上：普攻变成 5 段，普攻 / 跑攻 / 跳攻全部变成光属性魔法攻击（虎爪，攻击范围变大），最后一段普攻、跑攻、跳攻让敌人感电 7 秒。移动速度 +15%，受到的伤害 -10%，技能攻击力 +3%。施放时间 1 秒，不能被其他技能取消（觉醒除外）。',
  infoExtra: () => [['普攻段数', '5 段（魔法）'], ['移动速度', '+15%'], ['受到的伤害', '-10%'], ['感电', '7 秒']], ai: { kind: 'buff' },
  act: lv => ({ name: 'fn_tiger', clip: 'fnFocus', dur: 1.0, noCounter: true, superArmor: [0, 1],
    events: [evAt(0.1, e => { sfx.charge(); fnCharge(e, 6); }), evAt(0.7, e => { fnTigerOn(e, lv); sfx.zap(); sfx.buff(); fnHeadFx(e, 0, 110, 120); fnStrike(e.x, e.y, { w: 80, h: 300, ring: 110 }); cam.shake = Math.max(cam.shake, 3); })] }) });
function fnCharge(e, n) { for (let i = 0; i < n; i++) fxCharge(e, i % 2 ? NEN_WHITE : NEN_COL, 1); }
// ---- 蓄念炮（念气波按住蓄力；本转职的念气波也走这里）----
const FN_SHOT_CD = 2.5;
function fnShot(e, lv, k) {
  const cannon = k >= 0, s = cannon ? 1 + k * 1.3 : 1, shLv = skLv(e, 'f_nenshot') || lv;
  const dmg = cannon ? skillDmg(1.8, 0.18, lv) * (1 + k * 1.5) : skillDmg(1.8, 0.18, shLv), shockP = (cannon ? 0.4 + 0.5 * k : 0.3) + (hasSkill(e, 'fn_sense') ? 0.3 : 0);
  const sk = cannon ? 'fn_cannon' : 'f_nenshot', big = cannon && k > 0.5;
  sfx.magic(); if (big) { sfx.zap(); sfx.boom(0.4); }
  return spawnProj({ owner: e, x: e.x + e.face * 34, y: e.y, z: e.z + 60, vx: e.face * (cannon ? 720 : 600), face: e.face, life: cannon ? 0.4 + 0.35 * k : 0.26, w: 12 * s, d: 14 * s, h: 20 * s, pierce: cannon,
    hit: fnHit(sk, { dmg, stun: 0.3, knock: cannon ? 110 : 50, hs: 0.04, snd: 'crit', ...(big ? { down: true, downLift: 180 } : {}), onHit: (a, t) => { if (Math.random() < shockP) addStatus(t, 'shock', 5, { src: a }); } }),
    update(q) { if (Math.random() < 0.5) addFx({ x: q.x - q.face * 8, y: q.y + 0.3, z: q.z, dur: 0.18, draw(c) { const kk = this.t / this.dur; drawSpr(c, 'spark', sx(this.x), sy(this.y, this.z), 18 * s * (1 - kk), 0, { alpha: 0.6 * (1 - kk) }); } }); },
    onEnd(q) { fxBurst(q.x, q.y, q.z, 70 * s, '#cfeeff'); if (big) fxShock(q.x, q.y, 90 * s, '#9fd8ff'); },
    draw(c, q) { drawSpr(c, 'quantum', sx(q.x), sy(q.y, q.z), 30 * s, 30 * s, { rot: q.t * 9 }); drawSpr(c, 'spark', sx(q.x), sy(q.y, q.z), 22 * s, 0, { alpha: 0.8 });   // 官方念气波 / 蓄念炮是蓝白色的念气团（视频 CDdyS8vhuAc）
      if (cannon && Math.floor(game.t * 30) % 2) fnBolt(c, sx(q.x) - q.face * 14 * s, sy(q.y, q.z) + rnd(-8, 8), sx(q.x) + q.face * 14 * s, sy(q.y, q.z) + rnd(-8, 8), { w: 2, seg: 4, amp: 6 }); } });
}
fnDef('fn_cannon', { name: '蓄念炮', lvReq: 16, mp: 20, cd: 6.5, col: '#ffe070', cmdNote: '↓→+Z 按住（念气波蓄力）',
  ...(SKILLS.f_nenshot ? { pre: { f_nenshot: 1 } } : {}),
  desc: '念气波可以按住技能键蓄力：蓄力越久念气团越大、攻击力 / 感电几率 / 射程越高，100% 穿透，蓄满时打中没有霸体的敌人必定击倒。蓄力后的冷却（6.5 秒）比普通念气波长；不蓄力（点一下）时就是普通念气波（冷却 2.5 秒）。学会禅意·万象后施放即满蓄。',
  pow: lv => skillDmg(1.8, 0.18, lv) * 2.5, infoExtra: lv => [['满蓄攻击力', pct(skillDmg(1.8, 0.18, lv) * 2.5)], ['蓄力时间', '最长 1 秒'], ['普通念气波冷却', FN_SHOT_CD + ' 秒']], ai: { kind: 'proj', r: [0, 420], dy: 26 },
  act: (lv, p) => { const full = !!(p && hasSkill(p, 'fn_nature'));
    return { name: 'fn_cannon', clip: 'fnPalm', dur: 0.4, noCounter: true,
      charge: { at: 0.06, max: full ? 0.02 : 1.0, min: 0, clip: 'fnFocus', dmg: 0, update: (e, dt, k) => { if (Math.random() < 0.4) fxCharge(e, NEN_COL, 1); }, onRelease: (e, k) => { e.act.k = full ? 1 : k; } },
      events: [evAt(0.1, e => { const k = e.act.k ?? 0; if (k < 0.15) { fnShot(e, lv, -1); e.cool.fn_cannon = FN_SHOT_CD * (e.cdMul || 1); } else fnShot(e, lv, k); })] }; } });
// ---- 雷霆踏：腿上聚雷下劈，落雷追加伤害，感电 100% ----
fnDef('fn_legstrike', { name: '雷霆踏', lvReq: 16, mp: 25, cd: 7, col: '#ffe070',
  desc: '腿上聚起雷电，向前踏出一小步（约 30px）下劈，同时落下一道金雷追加光属性伤害，命中的敌人 100% 感电 8 秒。能打倒地的敌人，可以在普攻中取消使用；积攒风雷能量的主力。',
  pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'poke', r: [0, 110], dy: 28 },
  act: lv => ({ name: 'fn_legstrike', clip: 'fnAxe', dur: 0.52, move: [[0.02, 0.12, 150]],   // 官方前踏约 30px（移动 15px + 之后滑行 15px）
    hits: [HB(0.15, 0.21, [0, 110, 32, 0, 130], skillDmg(2.2, 0.22, lv), fnHit('fn_legstrike', { stun: 0.45, knock: 60, hs: 0.07, downHit: true, snd: 'blunt' }))],
    events: [evAt(0.02, e => { sfx.charge(); fnLegFx(e, 0.2); }), evAt(0.2, e => { const x = e.x + e.face * 72; fnStrike(x, e.y, { w: 62, h: 280, ring: 80 }); sfx.zap(); cam.shake = Math.max(cam.shake, 2);
      blast(e, x, e.y, 72, fnHit('fn_legstrike', { dmg: skillDmg(2.0, 0.2, lv), stun: 0.4, knock: 30, hs: 0.04, downHit: true, sure: true }), { zMax: 160, status: 'shock', sdur: 8 }); })] }) });
function fnLegFx(e, dur) { addFx({ ent: e, y: e.y + 0.8, dur, draw(c) { const E = this.ent, X = sx(E.x + E.face * 30), Y = sy(E.y, E.z + 30); fnBolt(c, X - 16, Y + rnd(-6, 6), X + 16, Y - 40 + rnd(-6, 6), { w: 3, seg: 5, amp: 6 }); drawSpr(c, 'spark', X, Y - 20, 40, 0, { alpha: 0.7 }); } }); }
// ---- 念气罩：原地半球罩，罩里的自己和队友全部无敌（联机同步：partyCast 'fn_guard'）----
const FN_GUARD_R = lv => 178 + 8 * (lv - 1);   // 官方 165.5+7.5n px（×1.05）
defSummon('fn_guardzone', { kind: 'field', life: 1.9, max: 4, over: 'oldest', keepRoom: false,
  update(s) { const me = s.owner; if (!me.dead && inGround(me, s.x, s.y, s.r) && me.z < 300) me.invul = Math.max(me.invul, 0.06); },
  draw(c, s) { const k = s.lifeT / s.life, a = k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1; drawSpr(c, fnTint('hexagram', NEN_COL), sx(s.x), sy(s.y, 0), s.r * 2, s.r * 2 * GR, { ground: true, rot: game.t * 0.5, alpha: a * 0.55 }); },
  drawUpright(c, s) { const k = s.lifeT / s.life, a = k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1, pul = 1 + Math.sin(game.t * 6) * 0.02;
    drawSpr(c, fnTint('pm_bubble', NEN_COL), sx(s.x), sy(s.y, 0) + s.r * GR * 0.2, s.r * 2 * pul, s.r * 1.45 * pul, { ay: 0.9, alpha: a * 0.55 }); } });
partyOn('fn_guard', (me, d) => {
  const x = +d.x, y = +d.y, r = clamp(+d.r || 180, 40, 400), t = clamp(+d.t || 1.9, 0.1, 5);
  if (!isFinite(x) || !isFinite(y) || String(d.rk || '') !== fnRk() || me.dead) return;
  const s = summon(me, 'fn_guardzone', { x, y: clamp(y, 4, DEPTH - 4), life: t }); if (s) s.r = r;
});
fnDef('fn_guard', { name: '念气罩', lvReq: 17, maxLv: 1, mp: 40, cd: 10, col: '#ffe8a0', ...(SKILLS.f_clone ? { pre: { f_clone: 1 } } : {}),
  desc: '在原地张开一个半径约 180px 的半球形念气罩，持续 1.9 秒：罩里的自己和队友全部无敌（少数即死机制除外）。罩不跟着人走，放完就可以自由行动。组队时对同一房间里站在罩内的队友生效。',
  infoExtra: lv => [['半径', FN_GUARD_R(lv) + ' px'], ['持续时间', '1.9 秒']], ai: { kind: 'guard', r: [0, 200], dy: 80 },
  act: lv => ({ name: 'fn_guard', clip: 'fnPalm2', dur: 0.4, noCounter: true, invul: [0, 0.4],
    events: [evAt(0.1, e => { partyCast('fn_guard', { x: Math.round(e.x), y: Math.round(e.y), r: FN_GUARD_R(lv), t: 1.9, rk: fnRk() }, e); sfx.buff(); sfx.zap(); fxShock(e.x, e.y, FN_GUARD_R(lv), NEN_COL); })] }) });
// ---- 念气环绕：袭：强化念气珠射向前方的敌人，绕着敌人转 2 秒再飞回（禅意·万象：追到敌人身边直接爆炸）----
function fnPressOrb(e, t, lv, i, big) {
  const nat = hasSkill(e, 'fn_nature'), sz = big ? 1.5 : 1, per = skillDmg(2.8, 0.28, lv) / 8;
  return spawnProj({ owner: e, x: e.x + e.face * 20, y: e.y, z: e.z + 70, vx: e.face * 300, vz: 120 + i * 40, face: e.face, life: 4.5, w: 1, d: 1, h: 1, pierce: true, hit: null, ph: 'go', ot: 0, tt: 0,
    update(q, dt) {
      if (q.ph !== 'back' && (!t || t.dead || t.remove)) q.ph = 'back';
      if (q.ph === 'go') { const dx = t.x - q.x, dy = t.y - q.y, dz = t.z + t.hurtH() * 0.5 - q.z, l = Math.hypot(dx, dy * 2, dz) || 1, sp = 760;
        q.vx = damp(q.vx, dx / l * sp, 10, dt); q.vy = damp(q.vy, dy / l * sp, 10, dt); q.vz = damp(q.vz, dz / l * sp, 10, dt);
        if (l < 26) { if (nat) { q.ph = 'done'; q.t = q.life; fxBurst(t.x, t.y, t.z + 50, 120 * sz, NEN_COL); fxShock(t.x, t.y, 80 * sz, NEN_COL); sfx.boom(0.4);
            applyHit(e, t, fnHit('fn_press', { dmg: per * 8, stun: 0.4, knock: 40, hs: 0.05, snd: 'crit', sure: true }), { proj: true, src: { x: q.x, y: q.y, z: q.z, face: e.face } }); return; }
          q.ph = 'orbit'; q.ot = 0; q.tt = 0; } }
      else if (q.ph === 'orbit') { q.ot += dt; q.tt -= dt; const a = q.ot * 7 + i * TAU / 3; q.vx = q.vy = q.vz = 0; q.x = t.x + Math.cos(a) * 30; q.y = t.y + Math.sin(a) * 9; q.z = t.z + t.hurtH() * 0.55 + Math.sin(a * 2) * 6;
        if (q.tt <= 0) { q.tt = 0.25; applyHit(e, t, fnHit('fn_press', { dmg: per, stun: 0.12, knock: 0, hs: 0.02, snd: 'crit', sure: true }), { proj: true, src: { x: q.x, y: q.y, z: q.z, face: e.face } }); }
        if (q.ot >= 2) q.ph = 'back'; }
      else { const dx = e.x - q.x, dy = e.y - q.y, dz = e.z + 70 - q.z, l = Math.hypot(dx, dy * 2, dz) || 1; q.vx = dx / l * 700; q.vy = dy / l * 700; q.vz = dz / l * 700; if (l < 24 || e.dead) q.t = q.life; }
    },
    draw(c, q) { fnBall(c, sx(q.x), sy(q.y, q.z), 20 * sz); } });
}
fnDef('fn_press', { name: '念气环绕：袭', lvReq: 17, mp: 35, cd: 4.5, col: '#ffcf40',
  desc: '把强化的念气珠射向前方 600px 内的敌人（最多 3 个目标），念气珠绕着敌人旋转 2 秒持续打击，然后飞回身边。前方没有敌人时不能施放。风雷啸开启时念气珠变大 50%；学会禅意·万象后改为追到敌人身边直接爆炸。',
  pow: lv => skillDmg(2.8, 0.28, lv), ai: { kind: 'proj', r: [0, 600], dy: 120 },
  req: p => nearestFoe(p, 600, o => (o.x - p.x) * p.face > -30) ? true : '前方没有目标',
  act: lv => ({ name: 'fn_press', clip: 'fnPalm', dur: 0.32, noCounter: true,
    events: [evAt(0.08, e => { const L = ents.filter(o => foe(e, o) && (o.x - e.x) * e.face > -30 && Math.abs(o.x - e.x) < 600 && Math.abs(o.y - e.y) < 200).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, 3);
      if (!L.length) return; const big = fnWS(e); for (let i = 0; i < 3; i++) fnPressOrb(e, L[i % L.length], lv, i, big); sfx.magic(); })] }) });
// ---- 雷霆念炮（2022 新增）：聚气后向前轰出，4 段 + 感电 100%；轰出时把贴身、没有霸体的敌人推开 ----
fnDef('fn_nencannon2', { name: '雷霆念炮', lvReq: 17, mp: 35, cd: 7, col: '#fff08a',
  desc: '双掌聚起雷之念气后向前轰出一道金色雷光，4 段光属性魔法伤害并 100% 感电 3 秒；轰出的瞬间把贴身、没有霸体的敌人推开。积攒风雷能量的主力技能之一。',
  pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'poke', r: [0, 330], dy: 26 },
  act: lv => ({ name: 'fn_nencannon2', clip: 'fnPalm2', dur: 0.66, noCounter: true,
    events: [evAt(0.02, e => { sfx.charge(); fnCharge(e, 4); }),
      evAt(0.24, e => { instantHit(e, fnHit('fn_nencannon2', { box: [-10, 64, 34, 0, 130], dmg: 0.05, knock: 260, stun: 0.3, hs: 0.02, snd: 'blunt' })); sfx.zap(); fxBurst(e.x + e.face * 40, e.y, e.z + 62, 90, NEN_COL);
        fnBeam(e.x + e.face * 30, e.y + 1, e.z + 58, 340, e.face, 56, 0.4); fnBeamBolts(e, 340, 0.36); }),
      ...[0.26, 0.34, 0.42, 0.5].map(t => evAt(t, e => instantHit(e, fnHit('fn_nencannon2', { box: [20, 360, 28, 20, 110], dmg: skillDmg(1.05, 0.105, lv), stun: 0.3, knock: 20, hs: 0.03, snd: 'crit',
        onHit: (a, tt) => addStatus(tt, 'shock', 3, { src: a }) }))))] }) });
function fnBeamBolts(e, len, dur) { addFx({ x: e.x, y: e.y + 1.2, z: e.z + 58, face: e.face, dur, draw(c) { const k = this.t / this.dur, X = sx(this.x + this.face * 30), Y = sy(this.y, this.z); for (let i = 0; i < 2; i++) fnBolt(c, X, Y + rnd(-10, 10), X + this.face * len * (0.6 + 0.4 * Math.random()), Y + rnd(-14, 14), { w: 3, seg: 9, amp: 10, alpha: 1 - k }); } }); }
// ---- 幻影爆碎（改变分身）：分身碰到敌人就光属性爆炸；600px 内再按：分身化成念气球飞回身边合体爆炸（按分身数加伤 / 加范围）----
const fnCloneN = p => clamp(skLv(p, 'f_clone') || 1, 1, 3);
const fnClones = p => (p._fnClones || []).filter(q => projs.indexOf(q) >= 0 && q.hit);
function fnCloneBoom(e, x, y, lv) { fxBurst(x, y, 50, 120, NEN_COL); fxShock(x, y, 100, NEN_COL); sfx.boom(0.5); blast(e, x, y, 95, fnHit('fn_blast', { dmg: skillDmg(2.4, 0.24, lv), launch: 240, knock: 60, hs: 0.05, downHit: true, sure: true }), { zMax: 160 }); }
function fnCloneSpawn(e, lv) {
  const n = fnCloneN(e), cv = document.createElement('canvas'); cv.width = GHOST.W; cv.height = GHOST.H; cv.getContext('2d').drawImage(ghostSnap(e), 0, 0);
  const snapFace = e.face; e._fnClones = [];
  for (let i = 0; i < n; i++) {
    const q = spawnProj({ owner: e, x: fnClampX(e.x + e.face * (40 + i * 26)), y: clamp(e.y + (i - (n - 1) / 2) * 22, 6, DEPTH - 6), z: 0, face: e.face, life: 7, w: 16, d: 14, h: 96, pierce: false,
      hit: fnHit('fn_blast', { dmg: 0.1, stun: 0.4, knock: 20, hs: 0.02 }),
      update(q, dt) { const t = nearestFoe(e, 520, o => Math.abs(o.x - q.x) < 520); if (t) { const dx = t.x - q.x, dy = t.y - q.y, l = Math.hypot(dx, dy) || 1; q.vx = dx / l * 230; q.vy = dy / l * 120; q.face = Math.sign(dx) || q.face; } else { q.vx = damp(q.vx, 0, 6, dt); q.vy = damp(q.vy, 0, 6, dt); }
        if (q.hit) { const B = { x0: q.x - q.w, x1: q.x + q.w, y0: q.y - q.d, y1: q.y + q.d, z0: q.z, z1: q.z + q.h }; for (const o of ents) if (canHit(e, o, q.hit) && overlaps(B, o)) { q.boomed = true; q.hit = null; q.culled = true; q.t = q.life; fnCloneBoom(e, q.x, q.y, lv); break; } }
      },
      onHitT(q) { q.boomed = true; },
      onEnd(q) { if (q.culled) return; if (q.boomed) fnCloneBoom(e, q.x, q.y, lv); else fxBurst(q.x, q.y, 50, 60, NEN_COL); },
      draw(c, q) { const X = sx(q.x), Y = sy(q.y, 0), a = q.t < 0.15 ? q.t / 0.15 : q.life - q.t < 0.4 ? (q.life - q.t) / 0.4 : 1;
        c.save(); c.globalAlpha = 0.72 * a; c.translate(X, Y); if (q.face !== snapFace) c.scale(-1, 1); c.drawImage(cv, -GHOST.W / 2, -GHOST.FY); c.restore();
        drawSpr(c, fnTint('aura', NEN_COL), X, Y + 4, 0, 120, { ay: 1, alpha: a * 0.35 }); } });
    e._fnClones.push(q);
  }
  fxAfterimage(e, NEN_COL); sfx.magic();
}
// 再按：分身化成念气球飞回身边，0.35 秒后合体爆炸（每多一个分身 +10% 伤害、范围变大）
function fnCloneRecall(e) {
  const L = fnClones(e).filter(q => Math.abs(q.x - e.x) < 600), lv = Math.max(1, skLv(e, 'fn_blast')); if (!L.length) return false;
  for (const q of L) { const x0 = q.x, y0 = q.y; q.hit = null; q.culled = true; q.t = q.life;
    addFx({ x: x0, y: y0 + 0.5, z: 60, dur: 0.35, draw(c) { const k = easeIn(this.t / this.dur), X = sx(lerp(x0, e.x, k)), Y = sy(lerp(y0, e.y, k), 60 + Math.sin(k * Math.PI) * 60); fnBall(c, X, Y, 26); } }); }
  const n = L.length; sfx.charge();
  fnAfter(e, 0.35, () => { const R = 110 + 25 * n; fxBurst(e.x, e.y, 60, R * 1.6, NEN_COL); fxShock(e.x, e.y, R, NEN_COL); fxShock(e.x, e.y, R * 0.7, NEN_WHITE); cam.shake = Math.max(cam.shake, 4); sfx.boom(0.8);
    blast(e, e.x, e.y, R, fnHit('fn_blast', { dmg: skillDmg(2.4, 0.24, lv) * n * (1.2 + 0.1 * (n - 1)), launch: 300, knock: 90, hs: 0.08, downHit: true, sure: true }), { zMax: 200 }); });
  return true;
}
fnDef('fn_blast', { name: '幻影爆碎', lvReq: 16, mp: 40, cd: 12, col: '#ffcf60',
  desc: '【改变分身】分身改成念气分身：自己冲向附近的敌人，碰到就发生光属性爆炸（分身数 = 分身技能等级，最多 3 个）。分身在场时、600px 内再按一次技能键：分身化成念气球飞回身边合体爆炸，伤害和范围按分身数增加。可以在普攻中施放。',
  pow: lv => skillDmg(2.4, 0.24, lv), infoExtra: lv => [['每个分身爆炸', pct(skillDmg(2.4, 0.24, lv))], ['合体爆炸', '分身数 ×120%（每多一个 +10%）'], ['持续时间', '7 秒']], ai: { kind: 'aoe', r: [0, 400], dy: 60 },
  recast: { ok: p => fnClones(p).some(q => Math.abs(q.x - p.x) < 600), instant: true, cd: 0.3, act: (lv, p) => fnCloneRecall(p) },
  act: lv => ({ name: 'fn_blast', clip: 'fnPalm', dur: 0.3, noCounter: true, events: [evAt(0.06, e => fnCloneSpawn(e, lv))] }) });
// ---- 狮子吼：向前方狮吼，X 轴很长、Y 轴窄，伤害 + 眩晕；风雷啸开启时霸体 ----
function fnRoarFx(e, len) {
  addFx({ x: e.x, y: e.y + 1, z: e.z + 70, face: e.face, dur: 0.55, draw(c) { const k = this.t / this.dur, X = sx(this.x + this.face * 40), Y = sy(this.y, this.z);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const u = clamp(k * 1.6 - i * 0.18, 0, 1); if (u <= 0 || u >= 1) continue; const d = u * len, rr = 26 + u * 70;
      c.globalAlpha = (1 - u) * FX_DIM; c.strokeStyle = i % 2 ? NEN_WHITE : NEN_COL; c.lineWidth = 9 - u * 5; c.beginPath(); c.ellipse(X + this.face * d, Y, rr * 0.32, rr, 0, -Math.PI / 2, Math.PI / 2, this.face < 0); c.stroke(); }
    c.restore();
    fnBeast(c, X + this.face * 20, Y + 50, 110, this.face, 'head', game.t, (1 - k) * 0.9); } });
}
fnDef('fn_roar', { name: '狮子吼', lvReq: 19, mp: 60, cd: 17, col: '#ffb030',
  desc: '施放 0.3 秒后向前方发出灌注念气的狮吼：前方很远（X 轴很长）、纵深很窄的范围内造成光属性魔法伤害并眩晕 3 秒（眩晕几率很高）。风雷啸开启时施放全程霸体，并附加螺旋球。',
  pow: lv => skillDmg(7.5, 0.75, lv), infoExtra: () => [['眩晕', '3 秒']], ai: { kind: 'aoe', r: [0, 480], dy: 30 },
  act: (lv, p) => { const ws = fnWS(p);
    return { name: 'fn_roar', clip: 'fnPalm2', dur: 0.75, noCounter: true, superArmor: ws ? true : undefined, ws,
      events: [evAt(0.02, e => { sfx.charge(); fnCharge(e, 3); }), evAt(0.3, e => { fnRoarFx(e, 460); sfx.boom(0.6); cam.shake = Math.max(cam.shake, 5);
        const n = instantHit(e, fnHit('fn_roar', { box: [0, 490, 34, 0, 160], dmg: skillDmg(7.5, 0.75, lv), stun: 0.6, knock: 90, hs: 0.08, big: 1.4, snd: 'blunt',
          onHit: (a, t) => { if (Math.random() < 0.98) addStatus(t, 'stun', 3, { src: a }); } }));
        if (e.act.ws && n) { const t = nearestFoe(e, 500, o => (o.x - e.x) * e.face > 0 && Math.abs(o.y - e.y) < 40); if (t) fnWSBall(e, t.x, t.y, skillDmg(7.5, 0.75, lv), 'fn_roar'); } })] }; } });
// ---- 雷虎天降（2022 新增）：腿上聚成念兽形状下劈，大爆炸，原地留下念气再打 8 段 + 感电 ----
defSummon('fn_tdfield', { kind: 'field', life: 1.35, tick: 0.16, hits: 8, max: 3, over: 'oldest', keepRoom: false, type: 'mag', elem: 'light',
  onTick(s) { summonArea(s, s.x, s.y, 120, fnHit('fn_thunderdrop', { dmg: s.dmg, stun: 0.25, knock: 10, hs: 0.02, downHit: true, snd: 'crit' }), { zMax: 160, status: 'shock', sdur: 4 }); if (s.hits % 2 === 0) fnStrike(s.x + rnd(-50, 50), s.y + rnd(-14, 14), { w: 40, h: 200, ring: 40, dur: 0.22 }); },
  draw(c, s) { const k = s.lifeT / s.life; drawSpr(c, fnTint('shock', NEN_COL), sx(s.x), sy(s.y, 0), 280, 0, { alpha: 0.5 * (1 - k) }); },
  drawUpright(c, s) { const k = s.lifeT / s.life; drawSpr(c, fnTint('pillar', NEN_COL), sx(s.x), sy(s.y, 0) + 6, 110, 200 * (0.7 + 0.3 * Math.sin(game.t * 30)), { ay: 1, alpha: 0.6 * (1 - k) }); } });
fnDef('fn_thunderdrop', { name: '雷虎天降', lvReq: 19, mp: 60, cd: 17, col: '#ffd040', pre: { fn_legstrike: 1 },
  desc: '腿上的念气聚成猛虎的形状，跃起下劈（雷霆踏的动作），落点发生大爆炸把敌人挑起；原地留下的念气再打 8 段并 100% 感电 4 秒。风雷啸开启时附加螺旋球。',
  pow: lv => skillDmg(7.5, 0.75, lv), ai: { kind: 'aoe', r: [0, 170], dy: 40 },
  act: (lv, p) => ({ name: 'fn_thunderdrop', clip: 'fnAxe', dur: 0.8, move: [[0.04, 0.3, 110]], ws: fnWS(p),
    events: [evAt(0.02, e => { sfx.charge(); fnLegFx(e, 0.34); addFx({ ent: e, y: e.y + 0.9, dur: 0.34, draw(c) { const E = this.ent; fnBeast(c, sx(E.x + E.face * 60), sy(E.y, E.z + 20), 90, E.face, 'tiger', game.t, 0.7); } }); }),
      evAt(0.34, e => { const x = e.x + e.face * 80; sfx.boom(0.9); sfx.zap(); cam.shake = Math.max(cam.shake, 6); fxBurst(x, e.y, 40, 220, NEN_COL); fxShock(x, e.y, 170, NEN_COL); fnStrike(x, e.y, { w: 90, h: 340, ring: 150 });
        blast(e, x, e.y, 150, fnHit('fn_thunderdrop', { dmg: skillDmg(3.5, 0.35, lv), launch: 280, knock: 60, hs: 0.08, big: 1.5, downHit: true, sure: true }), { zMax: 160 });
        const s = summon(e, 'fn_tdfield', { x, y: e.y }); if (s) s.dmg = skillDmg(0.5, 0.05, lv);
        if (e.act.ws) fnWSBall(e, x, e.y, skillDmg(7.5, 0.75, lv), 'fn_thunderdrop', 100); })] }) });
// ---- 螺旋念气场：身边形成圆形念气场，14 段 + 感电 100%；风雷啸开启时霸体 ----
defSummon('fn_nenfield', { kind: 'field', life: 1.5, tick: 0.1, hits: 14, max: 2, over: 'oldest', keepRoom: false, type: 'mag', elem: 'light',
  onTick(s) { summonArea(s, s.x, s.y, s.r || 150, fnHit('fn_field', { dmg: s.dmg, stun: 0.2, knock: 6, hs: 0.015, downHit: true, snd: 'crit' }), { zMax: 200, status: 'shock', sdur: 3 }); },
  draw(c, s) { const k = s.lifeT / s.life, a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1; drawSpr(c, fnTint('rune', NEN_COL), sx(s.x), sy(s.y, 0), (s.r || 150) * 2, (s.r || 150) * 2 * GR, { ground: true, rot: -game.t * 1.5, alpha: a * 0.6 }); },
  drawUpright(c, s) { const k = s.lifeT / s.life, a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1, R = s.r || 150, X = sx(s.x), Y = sy(s.y, 0);
    drawSpr(c, fnTint('pm_bubble', NEN_COL), X, Y + R * GR * 0.2, R * 2, R * 1.3, { ay: 0.9, alpha: a * 0.42 });
    drawSpr(c, fnTint('vortex', NEN_COL), X, Y - R * 0.45, R * 1.4, R * 1.4, { rot: game.t * 6, alpha: a * 0.5 });
    if (Math.floor(game.t * 24) % 2) for (let i = 0; i < 2; i++) { const a0 = rnd(0, TAU); fnBolt(c, X + Math.cos(a0) * R * 0.3, Y - R * 0.45 + Math.sin(a0) * R * 0.2, X + Math.cos(a0) * R * 0.95, Y - R * 0.45 + Math.sin(a0) * R * 0.6, { w: 2.5, seg: 6, amp: 8, alpha: a }); } } });
fnDef('fn_field', { name: '螺旋念气场', lvReq: 19, mp: 55, cd: 20, col: '#ffe070',
  desc: '施放 0.3 秒后在身边形成一个圆形的螺旋念气场（半径约 150px，身后也打得到），1.5 秒内造成 14 段光属性魔法伤害并 100% 感电 3 秒。风雷啸开启时施放霸体，并附加螺旋球。',
  pow: lv => skillDmg(8.1, 0.81, lv), ai: { kind: 'aoe', r: [0, 140], dy: 60 },
  act: (lv, p) => { const ws = fnWS(p);
    return { name: 'fn_field', clip: 'fnSeal', dur: 0.45, noCounter: true, superArmor: ws ? true : undefined, ws,
      events: [evAt(0.02, e => { sfx.charge(); fnCharge(e, 4); }), evAt(0.3, e => { sfx.zap(); sfx.boom(0.5); fxShock(e.x, e.y, 160, NEN_COL); const s = summon(e, 'fn_nenfield', { x: e.x, y: e.y }); if (s) { s.dmg = skillDmg(8.1, 0.81, lv) / 14; s.r = 150; }
        if (e.act.ws) fnWSBall(e, e.x + e.face * 60, e.y, skillDmg(8.1, 0.81, lv), 'fn_field', 110); })] }; } });
// ---- 念兽：猛虎震地：放出獬豸形的念兽向前扑出，飞行中 4 段 + 落地爆炸；全程霸体 ----
fnDef('fn_haitai', { name: '念兽：猛虎震地', lvReq: 20, mp: 90, cd: 45, col: '#ffc020', pre: { fn_tiger: 1 },
  desc: '蓄气后从掌中放出獬豸形状的巨大念兽向前扑出：飞行中对路上的敌人造成 4 段光属性魔法伤害，最后落地爆炸把敌人炸飞。施放全程霸体，可以强制中断普攻施放（贴身的敌人也打得到）。风雷啸开启时念兽消失处留下念气球继续攻击。',
  pow: lv => skillDmg(14.4, 1.44, lv), ai: { kind: 'burst', r: [0, 520], dy: 50 },
  act: (lv, p) => ({ name: 'fn_haitai', clip: 'fnPalm2', dur: 0.9, noCounter: true, superArmor: true, ws: fnWS(p),
    events: [evAt(0.02, e => { sfx.charge(); fnCharge(e, 6); }), evAt(0.22, e => { sfx.zap(); sfx.boom(0.5); fnHaitai(e, lv, e.act.ws); })] }) });
function fnHaitai(e, lv, ws) {
  const x0 = e.x + e.face * 20, per = skillDmg(1.8, 0.18, lv);
  return spawnProj({ owner: e, x: x0, y: e.y, z: 0, vx: e.face * 760, face: e.face, life: 0.62, w: 60, d: 30, h: 150, pierce: true,
    hit: fnHit('fn_haitai', { dmg: per, stun: 0.5, knock: 30, hs: 0.03, rep: 0.12, max: 4, snd: 'crit', downHit: true }),
    // 扑中的敌人被念兽推着走（领主 / 很重的不推），最后一起吃落地爆炸
    update(q, dt) { if (Math.random() < 0.6) fxDust(q.x - q.face * 30, q.y, 1, 20, '#e8c070');
      for (const t of ents) if (q.hitMap.has(t.id) && !t.dead && !t.boss && t.weight < 3 && t.st !== 'held') { t.x = fnClampX(q.x + q.face * 36, t.w + 2); t.y = damp(t.y, q.y, 8, dt); } },
    onEnd(q) { cam.shake = Math.max(cam.shake, 7); sfx.boom(1); fxBurst(q.x, q.y, 60, 260, NEN_COL); fxShock(q.x, q.y, 190, NEN_COL); fxShock(q.x, q.y, 130, NEN_WHITE);
      blast(e, q.x, q.y, 160, fnHit('fn_haitai', { dmg: skillDmg(7.2, 0.72, lv), launch: 320, knock: 120, hs: 0.1, big: 1.6, downHit: true, sure: true }), { zMax: 200 });
      if (ws) for (let i = 0; i < 3; i++) fnWSBall(e, q.x + rnd(-70, 70), clamp(q.y + rnd(-30, 30), 6, DEPTH - 6), skillDmg(14.4, 1.44, lv) / 3, 'fn_haitai', 70); },
    draw(c, q) { const k = q.t / q.life; fnBeast(c, sx(q.x), sy(q.y, Math.sin(k * Math.PI) * 40), 150, q.face, 'haitai', game.t * 1.6, k < 0.1 ? k / 0.1 : 1); } });
}
// ---- 一觉：念兽：审判之金雷虎（骑乘，方向键控制，跳 3 次踩出冲击波，最后爆炸）----
const FN_RIDE_Z = 96;
fnDef('fn_awaken', { name: '念兽：审判之金雷虎', lvReq: 21, awaken: true, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, col: '#ffd23a',
  desc: '【一次觉醒】召唤巨大的念兽金雷虎并骑上去：用方向键控制方向，跳跃 3 次（身体撞到的敌人受到伤害，每次落地踩出冲击波），最后金雷虎爆炸。开始时霸体，骑乘期间无敌。可以强制中断普攻施放。',
  pow: lv => skillDmg(30, 8, lv), ai: { kind: 'awaken', r: [0, 420], dy: 120 },
  act: lv => ({ name: 'fn_awaken', clip: 'fnRide', dur: 3.6, noCounter: true, noAwk: true, superArmor: [0, 0.4], invul: [0.4, 3.6], lowGrav: 1e-6,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '念兽：审判之金雷虎', who: cutinWho(e, 1) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act; a.lz = 0; a.dir = { x: e.face, y: 0 }; a.jump = -1; a.rideOn = false; fnLionFx(e); },
    onInput: (e, I) => { const dx = I.dx(), dy = I.dy(); if (dx || dy) { e.act.dir = { x: dx, y: dy }; e.act.inT = e.actT; if (dx) e.face = dx; } return false; },
    // 每一跳起跳时定速度：这一跳按了方向键 = 按方向（横 340 / 纵 140 px/s）；没按 = 朝最近的敌人跳过去（本作辅助，官方没按时原地 / 向前跳）
    update: (e, dt) => { const a = e.act, T = e.actT, i = Math.floor((T - 0.55) / 0.75), u = (T - 0.55 - i * 0.75) / 0.7;
      if (T >= 0.55 && i >= 0 && i < 3 && u <= 1) { a.lz = Math.sin(u * Math.PI) * 150;
        if (a.jump !== i) { a.jump = i; sfx.jump(); fxDust(e.x, e.y, 6, 30, '#e8c070'); const js = 0.55 + i * 0.75, t = (a.inT ?? -9) >= js - 0.75 ? null : nearestFoe(e, 520);
          if (t) { a.jv = { x: clamp((t.x - e.x) / 0.7, -340, 340), y: clamp((t.y - e.y) / 0.7, -140, 140) }; if (Math.abs(t.x - e.x) > 4) e.face = Math.sign(t.x - e.x); } else a.jv = null; }
        if ((a.inT ?? -9) >= 0.55 + i * 0.75 - 0.75) a.jv = null;
        e.vx = a.jv ? a.jv.x : (a.dir.x || (a.dir.y ? 0 : e.face)) * 340; e.vy = a.jv ? a.jv.y : a.dir.y * 140; }
      else { a.lz = damp(a.lz, 0, 14, dt); e.vx = 0; e.vy = 0; }
      if (T >= 0.4) a.rideOn = true;
      e.z = (a.rideOn && T < 3.35 ? FN_RIDE_Z : 0) + a.lz; e.vz = 0; },
    onEnd: e => { if (e.z > 1) { e.z = 0; e.vz = 0; } },
    events: [evAt(0.3, e => { fxBurst(e.x, e.y, 60, 260, NEN_COL); fxShock(e.x, e.y, 200, NEN_COL); sfx.zap(); sfx.boom(0.6); }),
      ...[0, 1, 2].flatMap(i => [0.12, 0.42].map(o => evAt(0.55 + i * 0.75 + o, e => instantHit(e, fnHit('fn_awaken', { box: [-80, 110, 50, -FN_RIDE_Z - 200, 160], dmg: skillDmg(1.2, 0.3, lv), stun: 0.4, knock: 90, hs: 0.04, snd: 'blunt', sure: true }))))),
      ...[0, 1, 2].map(i => evAt(0.55 + i * 0.75 + 0.7, e => { cam.shake = Math.max(cam.shake, 7); sfx.boom(0.9); fxShock(e.x, e.y, 190, NEN_COL); fxShock(e.x, e.y, 130, NEN_WHITE); fxDust(e.x, e.y, 10, 60, '#e8c070'); fnStrike(e.x + e.face * 40, e.y, { w: 70, h: 300, ring: 100 });
        blast(e, e.x, e.y, 180, fnHit('fn_awaken', { dmg: skillDmg(3.2, 0.85, lv), launch: 260, knock: 80, hs: 0.08, big: 1.4, downHit: true, sure: true }), { zMax: 200 }); })),
      evAt(3.05, e => { const x = e.x + e.face * 60; cam.shake = 12; cam.flash = 0.25; cam.flashCol = '#fff2b0'; sfx.boom(1.4); fxBurst(x, e.y, 90, 420, NEN_COL); fxShock(x, e.y, 260, NEN_COL); fxShock(x, e.y, 170, '#ffffff');
        blast(e, x, e.y, 230, fnHit('fn_awaken', { dmg: skillDmg(13.2, 3.5, lv), launch: 420, knock: 160, hs: 0.14, big: 2, downHit: true, sure: true }), { zMax: 300 });
        if (fnWS(e)) fnWSBall(e, x, e.y, skillDmg(30, 8, lv) * 0.3, 'fn_awaken', 140); })] }) });
function fnLionFx(e) {
  const a0 = e.act;
  addFx({ ent: e, y: e.y - 0.5, dur: 3.6, update() { const E = this.ent; this.y = E.y - 0.5; if (E.act !== a0) this.t = Math.max(this.t, this.dur - 0.25); },
    draw(c) { const E = this.ent, k = this.t / this.dur, a = this.t < 0.4 ? this.t / 0.4 : k > 0.93 ? (1 - k) / 0.07 : 1, lz = a0.lz || 0;
      for (let i = 0; i < 3; i++) drawSpr(c, 'jv_flame', sx(E.x - E.face * (40 - i * 40)), sy(E.y, lz + 120 + Math.sin(game.t * 9 + i) * 6), 120, 0, { alpha: a * 0.55, flip: E.face < 0 });   // 官方金雷虎全身带橙金色火焰（视频 zUPYvmz18Bw）
      fnBeast(c, sx(E.x - E.face * 6), sy(E.y, lz), 170, E.face, a0.jump >= 0 && lz > 4 ? 'lion' : 'idle', game.t * 1.4, a);
      if (Math.floor(game.t * 20) % 2) fnBolt(c, sx(E.x) + rnd(-60, 60), sy(E.y, lz + 60) + rnd(-30, 30), sx(E.x) + rnd(-80, 80), sy(E.y, lz + 40) + rnd(-40, 40), { w: 2.5, seg: 5, amp: 8, alpha: a }); } });
}
// ---- 念之战矛：念气长矛刺前方，被刺的敌人钉住约 2 秒（超级抓取，霸体也有效）+ 感电，最后爆炸；能打倒地的敌人 ----
defSummon('fn_spearA', { kind: 'attach', host: 'target', life: 2, max: 8, over: 'oldest',
  onEnd(s, why) { const h = s.host; if (why !== 'life' || !h || h.dead) return; sfx.boom(0.8); fxBurst(h.x, h.y, h.z + 50, 180, NEN_COL); fxShock(h.x, h.y, 110, NEN_COL);
    summonArea(s, h.x, h.y, 90, fnHit('fn_spear', { dmg: s.dmg, launch: 300, knock: 60, hs: 0.1, big: 1.6, downHit: true, sure: true }), { zMax: 220 }); if (s.ws) fnWSBall(s.owner, h.x, h.y, s.pow, 'fn_spear'); },
  draw(c, s) { const h = s.host; if (!h) return; const X = sx(h.x), Y = sy(h.y, h.z + h.hurtH() * 0.55); drawSpr(c, fnTint('thrust', NEN_COL), X - s.face * 30, Y, 170, 34, { flip: s.face < 0, alpha: 0.9 });
    if (Math.floor(game.t * 20) % 2) fnBolt(c, X + rnd(-20, 20), Y + rnd(-20, 20), X + rnd(-30, 30), Y + rnd(-40, 40), { w: 2, seg: 4, amp: 6 }); } });
fnDef('fn_spear', { name: '念之战矛', tier: 1, lvReq: 23, mp: 80, cd: 30, col: '#ffe070',
  desc: '把念气凝成长矛向前刺出：被刺中的敌人被钉住约 2 秒（强制硬直，霸体也有效，领主缩短）并感电，之后长矛爆炸。施放时霸体，能打倒地的敌人。风雷啸开启时爆炸附加螺旋球。',
  pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'launch', r: [0, 220], dy: 30 },
  act: (lv, p) => ({ name: 'fn_spear', clip: 'fnStab', dur: 0.72, noCounter: true, superArmor: true, ws: fnWS(p),
    events: [evAt(0.02, e => { sfx.charge(); fnCharge(e, 3); }), evAt(0.16, e => { sfx.iai(); sfx.zap();
      addFx({ x: e.x, y: e.y + 1, z: e.z + 64, face: e.face, dur: 0.4, draw(c) { const k = this.t / this.dur; drawSpr(c, fnTint('thrust', NEN_COL), sx(this.x + this.face * 20), sy(this.y, this.z), 260 * easeOut(Math.min(1, k * 4)), 46, { ax: 0, flip: this.face < 0, alpha: 1 - k * k }); } });
      instantHit(e, fnHit('fn_spear', { box: [10, 250, 32, 0, 140], dmg: skillDmg(2.4, 0.24, lv), stun: 0.4, knock: 0, hs: 0.08, downHit: true, snd: 'stab', sure: true,
        onHit: (a, t) => { addStatus(t, 'hold', 2, { src: a }); addStatus(t, 'shock', 2, { src: a }); const s = summon(a, 'fn_spearA', { target: t }); if (s) { s.dmg = skillDmg(9.6, 0.96, lv); s.face = a.face; s.ws = !!(a.act && a.act.ws); s.pow = skillDmg(12, 1.2, lv); } } })); })] }) });
// ---- 冲云念气场：念气结晶砸向地面升起光柱，6 段 + 感电；施放前方向键左右调位置；风雷啸开启时吸怪 ----
fnDef('fn_pillar', { name: '冲云念气场', tier: 1, lvReq: 25, mp: 100, cd: 50, col: '#fff0a0',
  desc: '施放 0.7 秒：把念气结晶砸向前方地面，升起一道光柱，6 段光属性魔法伤害并 100% 感电 3 秒，把敌人挑到空中。结晶落下之前可以用 ← → 前后调整落点（60~330px）。施放时霸体；风雷啸开启时光柱把周围一小片的敌人吸过来，并附加螺旋球。',
  pow: lv => skillDmg(14.4, 1.44, lv), ai: { kind: 'launch', r: [60, 330], dy: 40 },
  act: (lv, p) => ({ name: 'fn_pillar', clip: 'fnUp', dur: 1.12, noCounter: true, superArmor: true, ws: fnWS(p),
    onStart: e => { const t = aimAhead(e, 150, 330, 60); e.act.px = clamp(Math.abs(t.x - e.x), 60, 330); e.act.py = e.y; fnPillarMark(e); sfx.charge(); },
    onInput: (e, I) => { if (e.actT < 0.55) { const dx = I.dx(); if (dx) e.act.px = clamp(e.act.px + dx * e.face * 420 / 60, 60, 330); } return false; },
    events: [evAt(0.5, e => { const a = e.act; a.cx = fnClampX(e.x + e.face * a.px); sfx.magic();
        addFx({ x: a.cx, y: a.py + 1, z: 0, dur: 0.16, draw(c) { const k = this.t / this.dur; fnBall(c, sx(this.x), sy(this.y, 260 * (1 - k)), 40); } }); }),
      evAt(0.66, e => { const a = e.act; sfx.boom(1); sfx.zap(); cam.shake = Math.max(cam.shake, 7); fxShock(a.cx, a.py, 170, NEN_COL); fxBurst(a.cx, a.py, 20, 200, NEN_COL); fnPillarFx(a.cx, a.py);
        if (a.ws) { for (const t of ents) if (foe(e, t) && !t.boss && t.weight < 5 && inGround(t, a.cx, a.py, 200)) { t.x = lerp(t.x, a.cx, 0.7); t.y = lerp(t.y, a.py, 0.7); } fnWSBall(e, a.cx, a.py, skillDmg(14.4, 1.44, lv), 'fn_pillar', 100); } }),
      ...[0, 1, 2, 3, 4, 5].map(i => evAt(0.68 + i * 0.07, e => { const a = e.act;
        blast(e, a.cx, a.py, 95, fnHit('fn_pillar', { dmg: skillDmg(2.4, 0.24, lv), ...(i === 0 ? { launch: 380 } : { airLift: 220 }), knock: 10, hs: 0.04, downHit: true, sure: true, snd: 'crit' }), { zMax: 360, status: 'shock', sdur: 3 }); }))] }) });
function fnPillarMark(e) { const a0 = e.act; addFx({ ent: e, y: e.y - 1, dur: 0.66, update() { if (this.ent.act !== a0) this.t = this.dur; }, draw(c) { const E = this.ent, x = E.x + E.face * a0.px, k = this.t / this.dur; drawSpr(c, fnTint('hexagram', NEN_COL), sx(x), sy(a0.py, 0), 190, 190 * GR, { ground: true, rot: game.t * 2, alpha: 0.35 + 0.4 * k }); } }); }
function fnPillarFx(x, y) { addFx({ x, y: y + 1, z: 0, dur: 0.75, draw(c) { const k = this.t / this.dur, g = easeOut(Math.min(1, k * 5)), a = k > 0.7 ? (1 - k) / 0.3 : 1, X = sx(this.x), Y = sy(this.y, 0);
  drawSpr(c, fnTint('aura', NEN_COL), X, Y + 6, 150, 460 * g, { ay: 1, alpha: a }); drawSpr(c, fnTint('pillar', NEN_WHITE), X, Y + 6, 80, 420 * g, { ay: 1, alpha: a * 0.8 });
  if (Math.floor(game.t * 24) % 2) fnBolt(c, X + rnd(-30, 30), Y - rnd(40, 120), X + rnd(-50, 50), Y - rnd(200, 380), { w: 3, seg: 7, amp: 12, alpha: a }); } }); }
// ---- 风雷啸（二觉）：能量 ≥500 开启，再按关闭；能量归零自动关闭 ----
fnDef('fn_windstorm', { name: '风雷啸', tier: 2, lvReq: 26, mp: 0, cd: 1, buff: true, col: '#fff6b0', pre: { fn_absorb: 1 }, cmdNote: '←↓→+Space（和念气环绕同指令，念气环绕优先；放进技能栏使用）',
  desc: '【开关 · 无动作施放】风雷能量 500 以上时开启，再按关闭，能量归零自动关闭。开启期间：狮子吼、螺旋念气场、奔雷螺旋击施放霸体；狮子吼、雷虎天降、螺旋念气场、猛虎震地、金雷虎、念之战矛、冲云念气场、奔雷螺旋击、禅语·形灭附加螺旋球（原技能 70% 伤害），冲云念气场吸怪、奔雷螺旋击可以按住延长；念气珠变大。这些技能每次施放消耗风雷能量（狮子吼 200、念之战矛 240、金雷虎 / 形灭 280 等）。另外学会后技能攻击力永久提高（不用开启）。',
  infoExtra: lv => [['技能攻击力（被动）', '+' + pct(0.06 + 0.01 * lv)], ['开启条件', '风雷能量 ≥ 500'], ['螺旋球', '原技能 70%']], ai: { kind: 'buff' },
  instant: (lv, p) => { if (fnWS(p)) { fnWSOff(p, '风雷啸 关闭'); return true; } return fnWSOn(p); } });
// ---- 奔雷螺旋击：手上生成雷电之刃刺进一个敌人，注入 1.5 秒雷能后引爆；风雷啸开启时霸体、按住技能键每 0.1 秒耗 8 能量延长（最多 2.5 秒）----
fnDef('fn_blade', { name: '奔雷螺旋击', tier: 2, lvReq: 26, mp: 100, cd: 42, col: '#fff39a',
  desc: '手上生成雷电之刃，刺进前方的一个敌人（钉住，领主缩短），注入 1.5 秒雷能后从体内引爆（注入时不造成伤害，判定很窄）。风雷啸开启时施放霸体，并且可以按住技能键延长注入：每 0.1 秒消耗 8 点风雷能量，最多延长 2.5 秒，期间周围生成螺旋球，引爆伤害随延长时间提高。',
  pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'burst', r: [0, 120], dy: 24 },
  act: (lv, p) => ({ name: 'fn_blade', clip: 'fnStab', dur: 2.3, noCounter: true, superArmor: fnWS(p) ? true : [0, 0.35], ws: fnWS(p),
    onStart: e => { const a = e.act; a.tgt = null; a.ext = 0; a.boomT = 1.75; a.extT = 0; a.ballT = 0; sfx.charge(); },
    update: (e, dt) => { const a = e.act, t = a.tgt;
      if (!t) return;
      if (t.dead || t.remove) { a.tgt = null; if (!a.boom) a.dur = Math.min(a.dur, e.actT + 0.3); return; }
      t.vx = 0; t.vy = 0;
      const held = isHuman(e) ? !!(e.pad && e.act.key && e.pad.is(e.act.key)) : fnE(e) > 300;
      if (a.ws && !a.boom && held && e.actT > 1.2 && a.ext < 2.5 && fnWS(e) && fnE(e) >= 8) { a.extT += dt; if (a.extT >= 0.1) { a.extT -= 0.1; e._fnE -= 8; a.ext += 0.1; a.boomT += 0.1; a.dur += 0.1; if (hasStatus(t, 'hold')) t.status.hold.t = Math.max(t.status.hold.t, 0.3);
        a.ballT -= 0.1; if (a.ballT <= 0) { a.ballT = 0.5; fnWSBall(e, t.x + rnd(-60, 60), clamp(t.y + rnd(-20, 20), 6, DEPTH - 6), skillDmg(16, 1.6, lv) * 0.2, 'fn_blade', 60); } } }
      if (!a.boom && e.actT >= a.boomT) { a.boom = true; a.dur = e.actT + 0.4; fnBladeBoom(e, t, lv, a.ext); } },
    events: [evAt(0.14, e => { const a = e.act; sfx.iai();
      let best = null, bd = 1e9; const B = atkBox(e, { box: [0, 125, 26, 10, 140] });
      for (const t of ents) if (canHit(e, t, { downHit: true }) && overlaps(B, t)) { const d = Math.abs(t.x - e.x); if (d < bd) { bd = d; best = t; } }
      if (!best) { a.dur = 0.55; fxBurst(e.x + e.face * 90, e.y, e.z + 70, 60, NEN_COL); return; }
      a.tgt = best; addStatus(best, 'hold', 1.9, { src: e }); addStatus(best, 'shock', 3, { src: e }); fnBladeFx(e); sfx.zap(); })] }) });
function fnBladeFx(e) { const a0 = e.act; addFx({ ent: e, y: e.y + 1, dur: 5, update() { if (this.ent.act !== a0 || a0.boom || !a0.tgt) this.t = this.dur; },
  draw(c) { const E = this.ent, t = a0.tgt; if (!t) return; const X0 = sx(E.x + E.face * 30), Y0 = sy(E.y, E.z + 64), X1 = sx(t.x), Y1 = sy(t.y, t.z + t.hurtH() * 0.55);
    drawSpr(c, fnTint('thrust', NEN_BOLT), (X0 + X1) / 2, (Y0 + Y1) / 2, Math.abs(X1 - X0) + 50, 30, { flip: E.face < 0 });
    for (let i = 0; i < 3; i++) fnBolt(c, X1, Y1, X1 + rnd(-50, 50), Y1 + rnd(-60, 40), { w: 2.5, seg: 5, amp: 8 });
    drawSpr(c, 'spark', X1, Y1, 60 + Math.sin(game.t * 30) * 12, 0, { alpha: 0.8 }); } }); }
function fnBladeBoom(e, t, lv, ext) {
  const m = 1 + ext * 0.4; cam.shake = Math.max(cam.shake, 9); sfx.boom(1.2); sfx.zap(); fxBurst(t.x, t.y, t.z + 50, 260 * Math.sqrt(m), NEN_COL); fxShock(t.x, t.y, 150, NEN_COL); fxShock(t.x, t.y, 100, '#ffffff'); fnStrike(t.x, t.y, { w: 90, h: 360, ring: 120 });
  applyHit(e, t, fnHit('fn_blade', { dmg: skillDmg(14, 1.4, lv) * m, launch: 340, knock: 80, hs: 0.14, big: 2, shake: 6, downHit: true, sure: true }), { proj: true, src: { x: t.x - e.face * 10, y: t.y, z: t.z, face: e.face } });
  for (const o of ents) if (o !== t && foe(e, o) && o.invul <= 0 && inGround(o, t.x, t.y, 110) && o.z < 220) applyHit(e, o, fnHit('fn_blade', { dmg: skillDmg(2, 0.2, lv) * m, launch: 240, knock: 90, hs: 0.06, downHit: true, sure: true, radial: true }), { proj: true, src: { x: t.x, y: t.y, z: t.z, face: e.face } });   // 周围的敌人吃余波（被刺的那个只吃一次大爆炸）
  if (e.act && e.act.ws) fnWSBall(e, t.x, t.y, skillDmg(16, 1.6, lv), 'fn_blade', 100);
}
// ---- 月辉念气破：大范围洒出月光般的念气，10 段；每段打中回复 7% 风雷能量（最多 70%）----
fnDef('fn_moon', { name: '月辉念气破', tier: 2, lvReq: 26, mp: 110, cd: 45, col: '#fff8e0',
  desc: '盘坐聚气后向四周大范围洒出月光般的念气（半径约 330px），1 秒内 10 段光属性魔法伤害。每一段打中敌人回复 7% 风雷能量（最多 70%）；风雷啸开启时也不消耗能量。',
  pow: lv => skillDmg(18, 1.8, lv), ai: { kind: 'aoe', r: [0, 320], dy: 120 },
  act: lv => ({ name: 'fn_moon', clip: 'fnSeal', dur: 1.35, noCounter: true, superArmor: [0, 1.2],
    events: [evAt(0.02, e => { sfx.charge(); fnCharge(e, 6); fnMoonFx(e); }), ...Array.from({ length: 10 }, (_, i) => evAt(0.25 + i * 0.1, e => {
      let n = 0; for (const t of ents) if (foe(e, t) && t.invul <= 0 && inGround(t, e.x, e.y, 330) && t.z < 260) n++;
      blast(e, e.x, e.y, 330, fnHit('fn_moon', { dmg: skillDmg(1.8, 0.18, lv), stun: 0.25, knock: 10, hs: 0.02, downHit: true, sure: true, snd: 'crit' }), { zMax: 260 });
      if (n && fnHasGauge(e)) fnGain(e, 70);
      if (i % 3 === 0) { sfx.zap(); fxShock(e.x, e.y, 330, NEN_WHITE); } }))] }) });
function fnMoonFx(e) { const x = e.x, y = e.y; addFx({ x, y: y - 2, z: 0, dur: 1.35, draw(c) { const k = this.t / this.dur, a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1, X = sx(this.x), Y = sy(y, 0);
  drawSpr(c, fnTint('hexagram', NEN_WHITE), X, Y, 660, 660 * GR, { ground: true, rot: game.t * 0.7, alpha: a * 0.55 });
  for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU + game.t * 1.5, r = 60 + ((this.t * 400 + i * 50) % 270); drawSpr(c, fnTint('slash', NEN_WHITE), X + Math.cos(ang) * r, Y + Math.sin(ang) * r * GR - 40, 90, 0, { rot: ang + Math.PI / 2, alpha: a * 0.7 }); } } }); }
// ---- 二觉：月华万象（吸怪 + 连按加段 + 爆炸；之后 10 秒风雷能量保持全满，风雷啸没开就自动开）----
fnDef('fn_awaken2', { name: '月华万象', tier: 2, lvReq: 27, awaken: true, maxLv: 3, mp: 200, cd: 170, pvp: 0.45, col: '#fff4c8',
  desc: '【二次觉醒】在前方生成巨大的念气罩状球体，收缩把周围的敌人吸到中心；期间连按技能键 / 攻击键追加雷光打击（最多 11 次），最后球体爆炸。之后 10 秒内风雷能量保持全满（风雷啸没开会自动开启）。施放全程无敌。',
  pow: lv => skillDmg(34, 9, lv), ai: { kind: 'awaken', r: [0, 420], dy: 140 },
  act: lv => ({ name: 'fn_awaken2', clip: 'fnSeal', dur: 2.9, noCounter: true, noAwk: true, invul: [0, 2.9],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '月华万象', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act; a.cx = fnClampX(e.x + e.face * 180, 90); a.cy = clamp(e.y, 30, DEPTH - 30); a.mash = isHuman(e) ? 0 : 6; fnSphereFx(e); },
    onInput: (e, I) => { let n = 0; for (const k of ['attack', 'cmd', 'cmdB']) while (I.consume(k)) n++; for (let i = 0; i < SKILL_SLOTS; i++) while (I.consume('s' + i)) n++; if (n) e.act.mash = Math.min(6, e.act.mash + n); return n > 0; },
    update: (e, dt) => { const a = e.act; if (e.actT < 0.3 || e.actT > 1.95) return;
      for (const t of ents) if (foe(e, t) && !t.dead && t.weight < 5 && inGround(t, a.cx, a.cy, 400)) { const s = t.boss ? 1.2 : 4; t.x = damp(t.x, a.cx, s, dt); t.y = damp(t.y, a.cy, s, dt); } },
    events: [...Array.from({ length: 11 }, (_, i) => evAt(0.45 + i * 0.13, e => { const a = e.act; if (i >= 5 + a.mash) return; sfx.zap();
        for (let j = 0; j < 3; j++) addFx({ x: a.cx, y: a.cy + 1, z: 120, dur: 0.18, draw(c) { const X = sx(this.x), Y = sy(this.y, this.z); fnBolt(c, X + rnd(-150, 150), Y + rnd(-120, 60), X + rnd(-40, 40), Y + rnd(-30, 30), { w: 3, seg: 7, amp: 12, alpha: 1 - this.t / this.dur }); } });
        blast(e, a.cx, a.cy, 260, fnHit('fn_awaken2', { dmg: skillDmg(1.0, 0.26, lv), stun: 0.3, knock: 0, hs: 0.03, downHit: true, sure: true, snd: 'crit' }), { zMax: 400 }); })),
      evAt(2.05, e => { const a = e.act; cam.shake = 14; cam.flash = 0.3; cam.flashCol = '#fffbe0'; sfx.boom(1.5); fxBurst(a.cx, a.cy, 120, 560, NEN_COL); fxShock(a.cx, a.cy, 420, NEN_COL); fxShock(a.cx, a.cy, 300, '#ffffff');
        for (let i = 0; i < 4; i++) fnStrike(a.cx + [-160, -60, 60, 160][i], a.cy, { w: 80, h: 380, ring: 90 });
        blast(e, a.cx, a.cy, 420, fnHit('fn_awaken2', { dmg: skillDmg(23, 6, lv), launch: 460, knock: 140, hs: 0.16, big: 2.2, downHit: true, sure: true }), { zMax: 420 }); }),
      evAt(2.3, e => fnRadiant(e))] }) });
function fnSphereFx(e) { const a0 = e.act; addFx({ ent: e, y: a0.cy + 2, dur: 2.2, draw(c) { const k = this.t / this.dur, X = sx(a0.cx), Y = sy(a0.cy, 130), sh = this.t < 0.3 ? easeOut(this.t / 0.3) : 1 - easeIn(clamp((this.t - 0.3) / 1.75, 0, 1)) * 0.55, a = this.t > 2.05 ? 0 : 1, R = 300 * sh;
  drawSpr(c, fnTint('pm_bubble', NEN_WHITE), X, Y, R * 1.6, R * 1.9, { alpha: a * 0.5 });
  drawSpr(c, fnTint('vortex', NEN_COL), X, Y, R * 1.2, R * 1.2, { rot: -game.t * 4, alpha: a * 0.45 });
  fnBall(c, X, Y, 70 + Math.sin(game.t * 16) * 8, a); } }); }
function fnRadiant(p) { p.buffs.fn_radiant = { t: 10, name: '月华', col: NEN_WHITE, hl: '#ffffff' }; if (fnHasGauge(p)) { p._fnE = FN_EMAX; if (!fnWS(p)) fnWSOn(p); } fxAura(p, NEN_WHITE, 1.2); }
// ---- 禅语·形灭：螺旋念气珠大范围旋转一段时间，最后化成狂虎形状爆炸（霸体）----
fnDef('fn_tigerblast', { name: '禅语·形灭', tier: 3, lvReq: 29, mp: 150, cd: 60, col: '#ffcf40', cmdNote: '↑↓→→+Z（和月华万象同指令，月华万象优先；放进技能栏使用）',
  desc: '以自然之力生成螺旋念气珠，在前方大范围螺旋旋转，10 段光属性魔法伤害，最后化成狂虎的形状爆炸。施放全程霸体（不是无敌）。风雷啸开启时范围更大，并附加螺旋球。',
  pow: lv => skillDmg(26, 2.6, lv), ai: { kind: 'aoe', r: [0, 460], dy: 140 },
  act: (lv, p) => { const ws = fnWS(p), R = ws ? 330 : 270;
    return { name: 'fn_tigerblast', clip: 'fnSeal', dur: 1.9, noCounter: true, superArmor: true, ws,
      onStart: e => { const a = e.act; a.cx = fnClampX(e.x + e.face * 190, 80); a.cy = e.y; sfx.charge(); fnSpiralFx(e, R); },
      events: [...Array.from({ length: 10 }, (_, i) => evAt(0.3 + i * 0.1, e => { const a = e.act; if (i % 3 === 0) sfx.zap();
          blast(e, a.cx, a.cy, R, fnHit('fn_tigerblast', { dmg: skillDmg(1.3, 0.13, lv), stun: 0.3, knock: 0, hs: 0.02, downHit: true, sure: true, snd: 'crit' }), { zMax: 300 }); })),
        evAt(1.42, e => { const a = e.act; cam.shake = 11; cam.flash = 0.2; cam.flashCol = '#fff2b0'; sfx.boom(1.3); fxBurst(a.cx, a.cy, 100, 420, NEN_COL); fxShock(a.cx, a.cy, R * 1.2, NEN_COL);
          addFx({ x: a.cx, y: a.cy + 3, z: 0, face: e.face, dur: 0.6, draw(c) { const k = this.t / this.dur; fnBeast(c, sx(this.x), sy(this.y, 60), 260 * (0.8 + k * 0.5), this.face, 'head', game.t, 1 - k); } });
          blast(e, a.cx, a.cy, R * 1.2, fnHit('fn_tigerblast', { dmg: skillDmg(13, 1.3, lv), launch: 420, knock: 140, hs: 0.12, big: 2, downHit: true, sure: true }), { zMax: 360 });
          if (a.ws) fnWSBall(e, a.cx, a.cy, skillDmg(26, 2.6, lv), 'fn_tigerblast', 150); })] }; } });
function fnSpiralFx(e, R) { const a0 = e.act; addFx({ ent: e, y: e.y + 2, dur: 1.45, draw(c) { const k = this.t / this.dur, X = sx(a0.cx), Y = sy(a0.cy, 70);
  for (let i = 0; i < 10; i++) { const ang = game.t * 7 + i * TAU / 10, rr = R * clamp(k * 1.3, 0.1, 1) * (0.4 + 0.6 * ((i % 2) ? 1 : 0.7)); fnBall(c, X + Math.cos(ang) * rr, Y + Math.sin(ang) * rr * GR, 24, k > 0.95 ? (1 - k) / 0.05 : 1); }
  drawSpr(c, fnTint('vortex', NEN_COL), X, Y, R * 1.6, R * 1.6 * GR, { rot: game.t * 5, alpha: 0.4 }); } }); }
// ---- 三觉：禅意·归一（身边生成念气后缓缓升空，盘腿打坐结印，把周围的念气珠合成巨大光轮，慢慢合掌，光轮爆炸）----
fnDef('fn_awaken3', { name: '禅意·归一', tier: 3, lvReq: 30, awaken: true, maxLv: 3, mp: 300, cd: 270, pvp: 0.45, col: '#fffbe0',
  desc: '【三次觉醒】身边生成 10 颗念气珠后缓缓升空，盘腿打坐结印：念气珠一边打击周围（6 段）一边汇聚成巨大的光轮，慢慢合掌，光轮爆炸。施放全程无敌。',
  pow: lv => skillDmg(46, 12, lv), ai: { kind: 'awaken', r: [0, 520], dy: 180 },
  act: lv => ({ name: 'fn_awaken3', clip: 'fnMed', dur: 3.9, noCounter: true, noAwk: true, invul: [0, 3.9], lowGrav: 1e-6,
    onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '禅意·归一', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); const a = e.act; a.cx = fnClampX(e.x + e.face * 120, 80); a.cy = e.y; a.z0 = e.z; fnHaloFx(e); },
    update: (e, dt) => { const T = e.actT; e.z = T < 3.3 ? 90 * easeOut(Math.min(1, T / 0.9)) : 90 * (1 - easeIn(Math.min(1, (T - 3.3) / 0.4))); e.vz = 0; e.vx = 0; e.vy = 0; },
    onEnd: e => { if (e.z > 1) { e.z = 0; e.vz = 0; } },
    events: [evAt(0.2, e => { sfx.charge(); fnCharge(e, 8); }),
      ...Array.from({ length: 6 }, (_, i) => evAt(1.1 + i * 0.22, e => { const a = e.act; sfx.zap();
        for (let j = 0; j < 2; j++) fnStrike(a.cx + rnd(-300, 300), clamp(a.cy + rnd(-50, 50), 6, DEPTH - 6), { w: 50, h: 280, ring: 60, dur: 0.25 });
        blast(e, a.cx, a.cy, 520, fnHit('fn_awaken3', { dmg: skillDmg(3, 0.8, lv), stun: 0.4, knock: 0, hs: 0.03, downHit: true, sure: true, snd: 'crit', airLift: 160 }), { zMax: 420 }); })),
      evAt(2.8, e => { const a = e.act; cam.shake = 16; cam.flash = 0.4; cam.flashCol = '#ffffff'; sfx.boom(1.6); sfx.boom(1.2); fxBurst(a.cx, a.cy, 150, 700, NEN_COL); fxShock(a.cx, a.cy, 600, NEN_COL); fxShock(a.cx, a.cy, 420, '#ffffff');
        blast(e, a.cx, a.cy, 600, fnHit('fn_awaken3', { dmg: skillDmg(28, 7.2, lv), launch: 520, knock: 180, hs: 0.18, big: 2.4, downHit: true, sure: true }), { zMax: 500 }); })] }) });
function fnHaloFx(e) { const a0 = e.act; addFx({ ent: e, y: e.y - 3, dur: 3.3, update() { if (this.ent.act !== a0) this.t = this.dur; },
  draw(c) { const E = this.ent, T = this.t, X = sx(E.x), Yb = sy(E.y, E.z + 70), Yr = sy(E.y, E.z + 150), conv = clamp((T - 0.4) / 1.8, 0, 1);
    for (let i = 0; i < 10; i++) { const ang = game.t * 2 + i * TAU / 10, rr = lerp(150, 0, easeIn(conv)), X1 = X + Math.cos(ang) * rr, Y1 = lerp(Yb + Math.sin(ang) * rr * 0.35, Yr, easeIn(conv)); if (conv < 1) fnBall(c, X1, Y1, 26, T < 0.3 ? T / 0.3 : 1); }
    const R = T < 1.2 ? 0 : 60 + 170 * easeOut(clamp((T - 1.2) / 1.2, 0, 1)), shrink = T > 2.5 ? 1 - easeIn(clamp((T - 2.5) / 0.3, 0, 1)) * 0.5 : 1, fade = T > 2.8 ? Math.max(0, 1 - (T - 2.8) / 0.3) : 1;
    fnRing(c, X, Yr, R * shrink, fade, game.t); } }); }

/* ---- 基础技能的转职改造：B3 的念气波 / 分身存在时，气功师技能栏上的原技能换成本转职的版本（指令本来就按千海天规则被本转职的技能抢占）---- */
if (SKILLS.f_nenshot && !SKILLS.f_nenshot.morph) SKILLS.f_nenshot.morph = p => fnIs(p) && hasSkill(p, 'fn_cannon') ? 'fn_cannon' : null;
if (SKILLS.f_clone && !SKILLS.f_clone.morph) SKILLS.f_clone.morph = p => fnIs(p) && hasSkill(p, 'fn_blast') ? 'fn_blast' : null;

/* ---- 登记 ---- */
Object.assign(CLASSES.fighter.jobs.nenmaster, {
  skills: ['fn_sense', 'fn_lightaff', 'fn_cloth', 'fn_tattoo', 'fn_cannon', 'fn_spiral', 'fn_legstrike', 'fn_blast', 'fn_guard', 'fn_press', 'fn_nencannon2', 'fn_stone', 'fn_tiger', 'fn_roar', 'fn_thunderdrop',
    'fn_field', 'fn_haitai', 'fn_conduit', 'fn_awaken', 'fn_spear', 'fn_pillar', 'fn_absorb', 'fn_windstorm', 'fn_blade', 'fn_moon', 'fn_awaken2', 'fn_nature', 'fn_tigerblast', 'fn_awaken3'],
  auto: ['fn_sense', 'fn_lightaff'], anims: FN_ANIMS });
// 指令（wiki.dfo.world 技能页的按键图；雷霆念炮 / 雷虎天降 2022 新增、查不到官方指令，本作自定）；同一指令按千海天规则：基础冷却长的优先（风雷啸 / 禅语·形灭 和 念气环绕 / 月华万象 同指令，只能放技能栏）
CLASSES.fighter.cmds.push(['uu', 'fn_tattoo', 'buff'], ['df', 'fn_cannon'], ['bdf', 'fn_spiral', 'buff'], ['f', 'fn_legstrike'], ['bff', 'fn_blast', 'buff'], ['bf', 'fn_guard', 'buff'], ['ud', 'fn_press', 'buff'],
  ['ud', 'fn_nencannon2'], ['du', 'fn_stone', 'buff'], ['fdf', 'fn_tiger', 'buff'], ['du', 'fn_roar'], ['uu', 'fn_thunderdrop'], ['bdf', 'fn_field'], ['uff', 'fn_haitai'], ['uudd', 'fn_awaken'],
  ['fbdf', 'fn_spear'], ['bfuf', 'fn_pillar'], ['bdf', 'fn_windstorm', 'buff'], ['fbf', 'fn_blade'], ['dff', 'fn_moon'], ['udff', 'fn_awaken2'], ['udff', 'fn_tigerblast'], ['bufd', 'fn_awaken3']);
