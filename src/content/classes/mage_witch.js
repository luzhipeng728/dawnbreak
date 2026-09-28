/* =====================================================================
   转职：魔道学者（魔法师）—— 按国服现版对齐（docs/SKILLS_OFFICIAL_mage.md 3.4）
   伤害类型：独立攻击（智力型）。四只使魔：杰克（火）/ 雪人（冰）/ 光电鳗（光）/ 夜猫（暗）
   成功率 rollCraft(p, 使魔) → 'fail' | 'ok' | 'great'（学了贤者之石后 'fail' | 'great' | 'super'）：头顶弹出使魔表情；
     失败有搞笑演出（熏黑 sooty / 摔倒 faceplant / 触电），苦涩的棒棒糖：熔岩药瓶 / 加热炉 / 钻孔车按住技能键 0.15 秒强制失败，失败伤害 +50%
   扫把掌握：装备扫把时跳跃中骑扫把（空中 6 连击、←← / →→ 空中冲刺 2 次、按住 C 缓降 2 次、空中施放技能后冲刺次数刷新），走 game/player.js 的 CLASSES.mage.airControl 钩子
   搭乘机械（加热炉 / 钻孔车 / 电塔 / 光电兔 / 刨冰机）：机械是召唤框架的 follower（src/game/summon.js），魔道学者用自己的帧（带时装）坐在上面；
     期间免疫异常、受到伤害 −60%，学了引爆实验按跳跃当场引爆
   觉醒：技艺融合（一觉 21）/ 乌洛波洛斯之环（二觉 27）/ 糖果大作战：精怪乐园（三觉 30）
   ===================================================================== */
const WT = 'witch';
const FAM = { jack: { n: '杰克', col: '#ff9a50', el: 'fire' }, snow: { n: '雪人', col: '#bfefff', el: 'ice' }, eel: { n: '光电鳗', col: '#fff38a', el: 'light' }, cat: { n: '夜猫', col: '#c79aff', el: 'dark' } };
const CRAFT_TXT = { fail: '失败…', ok: '成功', great: '大成功！', super: '超大成功！！' };
const CRAFT_K = { fail: 0.7, ok: 1, great: 1.3, super: 1.6 };   // 结果档位对范围 / 伤害的倍率
const isWitch = p => !!p && p.cls === 'mage' && jobOf(p) === WT;
/* ---- 成功率：基础 失败 25% / 成功 50% / 大成功 25%；法米利尔亲和、幸运棒棒糖提高；成功预感的糖果让下一个技能必定成功 ---- */
function craftOdds(p) {
  const af = skLv(p, 'wt_affinity'), lu = skLv(p, 'wt_lucky');
  let fail = 0.25 - 0.015 * af - 0.01 * lu, great = 0.25 + 0.02 * af + 0.015 * lu;
  if (p.buffs && p.buffs.wt_candy) { fail = 0; great += 0.35; }
  return { fail: clamp(fail, p.buffs && p.buffs.wt_candy ? 0 : 0.02, 1), great: clamp(great, 0, 0.92) };
}
// o.force = 强制结果（苦涩的棒棒糖）；p.wtForce 给测试用
function rollCraft(p, fam, o = {}) {
  const force = o.force || p.wtForce, O = craftOdds(p);
  let r = force || (() => { const x = Math.random(); return x < O.fail ? 'fail' : x < O.fail + O.great ? 'great' : 'ok'; })();
  if (!force && p.buffs.wt_candy) { delete p.buffs.wt_candy; fxText('糖果生效', p.x, p.y, p.z + 70, { col: '#ff9ad0', size: 10 }); }
  if (hasSkill(p, 'wt_stone') && r !== 'fail') r = r === 'great' || r === 'super' ? 'super' : 'great';   // 贤者之石：失败 / 大成功 / 超大成功
  const pr = skLv(p, 'wt_premonition');   // 成功预感：成功后有几率在头顶出现糖果，30 秒内下一个技能必定成功
  if (r !== 'fail' && pr && !p.buffs.wt_candy && Math.random() < 0.2 + 0.02 * pr) { p.buffs.wt_candy = { t: 30 }; fxText('糖果！', p.x, p.y, p.z + 80, { col: '#ff9ad0', size: 11 }); }
  p._craft = r; craftPop(p, fam, r);
  return r;
}
const craftOk = r => r !== 'fail', craftBig = r => r === 'great' || r === 'super';
// 头顶弹出使魔的结果表情：有图标用图标（icon/wt_fam_<使魔>_<结果>），没有就画一个带颜色的小圆牌
function craftPop(p, fam, r) {
  const F = FAM[fam] || FAM.jack, key = `icon/wt_fam_${fam}_${r}`;
  addFx({ ent: p, y: p.y + 0.6, dur: 1.0, update() { this.y = this.ent.y + 0.6; }, draw(c) {
    const e = this.ent, k = this.t / this.dur, X = sx(e.x), Y = sy(e.y, e.z + 124 + easeOut(Math.min(1, k * 4)) * 14), a = k > 0.75 ? (1 - k) / 0.25 : 1, s = k < 0.1 ? 0.6 + k * 4 : 1;
    c.save(); c.globalAlpha = a;
    if (IMG[key]) c.drawImage(IMG[key], X - 17 * s, Y - 17 * s, 34 * s, 34 * s);
    else { c.fillStyle = r === 'fail' ? '#555a66' : r === 'super' ? '#ff9ad0' : r === 'great' ? '#ffd23a' : F.col; c.strokeStyle = '#2a1a10'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 12 * s, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#2a1a10'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText(r === 'fail' ? '×' : r === 'ok' ? '○' : '★', X, Y + 4); }
    c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#1a0806'; const t = `${F.n}${CRAFT_TXT[r]}`;
    c.strokeText(t, X, Y - 20); c.fillStyle = r === 'fail' ? '#b0b8c8' : r === 'super' ? '#ffb0e0' : r === 'great' ? '#ffe070' : '#ffffff'; c.fillText(t, X, Y - 20); c.restore(); } });
}
// 失败演出：熏黑 / 摔倒（播一小段自己的帧，时装一致）；dur 秒后恢复原来的动作帧
function witchOops(e, kind, dur = 0.7) {
  const clip = kind === 'fall' ? 'faceplant' : 'sooty';
  e.play(clip, true); e._oopsT = dur; e._oopsClip = clip;
  if (kind !== 'zap') sfx.boom(0.3);
  fxText(kind === 'fall' ? '哎哟！' : kind === 'zap' ? '麻麻的…' : '咳咳…', e.x, e.y, e.z + 50, { col: kind === 'zap' ? '#fff38a' : '#c8c8d0', size: 11, dur: 0.8 });
  if (kind === 'soot') fxDust(e.x, e.y, 6, 16, '#3a3a40');
}
// 苦涩的棒棒糖：学会后，这几个技能的动作带一个 0.15 秒的“按住”判定；按满 = 强制失败
const bitterCharge = p => p && hasSkill(p, 'wt_bitter') ? { at: 0.03, max: 0.15, min: 0, dmg: 0, clip: 'potionHold' } : undefined;
const bitterOn = e => !!(e.act && e.act.charge && (e.act.chargeK || 0) >= 0.99);
const wtLv = (lv, base, per) => skillDmg(base, per, lv);
// 空中施放技能后，扫把的空中冲刺次数刷新
const airRefresh = e => { if (e.z > 2) { e._dashN = 0; e._glideN = 0; } };
/* =====================================================================
   扫把飞行（扫把掌握）
   ===================================================================== */
// 骑扫把的条件：魔道学者、学了扫把掌握且没关掉、装备扫把（AI 格斗者没有武器信息时默认有扫把）
function witchRides(p) {
  if (!isWitch(p) || !(lvOf(p, 'wt_broom') > 0) || (p.buffs && p.buffs.wt_broomOff)) return false;
  const w = wtypeOf(p); return w === 'broom' || (!w && !isHuman(p));
}
// 模型：跳跃中换成骑扫把的帧（冲刺 / 缓降各有一帧）；素材没加载完时照旧
function witchModel(p) {
  const m = p.model; if (!m || m._wt || typeof m.frameOf !== 'function') return; m._wt = true; const f0 = m.frameOf.bind(m);
  m.frameOf = pose => {
    if (p._ride && m.img && m.img.brIdle) { const c = pose.__c; if (c === 'jumpUp' || c === 'jumpFall' || c === 'back' || (c === 'land' && p.z > 0.5)) return p._airDashT > 0 ? 'brDash' : p._gliding ? 'brFall' : 'brIdle'; }
    return f0(pose);
  };
}
const AIR_DASH = { n: 2, t: 0.26, v: 470 }, GLIDE = { n: 2, vz: -75 };
// 空中钩子：←← / →→ 冲刺（每次跳跃 2 次）、按住 C 缓降（2 次）；冲刺中返回 true（空中 X 自己处理）
function witchAir(p, I, dt) {
  if (!p._ride) return false;
  const st = p.st, act = st === 'act' && p.act;
  if (p._airDashT > 0) p._airDashT -= dt;
  // 缓降：下落中按住 C（每次按住算一次）
  if ((st === 'jump' || (act && act.airOnly)) && I.is('jump') && p.vz < 0) {
    if (!p._gliding && (p._glideN || 0) < GLIDE.n) { p._gliding = true; p._glideN = (p._glideN || 0) + 1; }
    if (p._gliding) p.vz = Math.max(p.vz, GLIDE.vz);
  } else p._gliding = false;
  if (st !== 'jump') return false;
  // 空中冲刺：同一方向快速按两次
  for (const [key, d] of [['left', -1], ['right', 1]]) if (I.hit && I.hit(key) && I.runDir === d && (p._dashN || 0) < AIR_DASH.n && !(p._airDashT > 0)) {
    p._dashN = (p._dashN || 0) + 1; p._airDashT = AIR_DASH.t; p._dashDir = d; p.face = d; p.vz = Math.max(p.vz, 40);
    fxStreak({ x: p.x, y: p.y, z: p.z + 50, face: -d, len: 90, w: 10, col: '#e0c0ff', dur: 0.22 }); sfx.swing(false);
  }
  if (p._airDashT > 0) {
    p.vx = p._dashDir * AIR_DASH.v * mspdOf(p); p.vz = Math.max(p.vz, -20); p.vy = I.dy() * p.speed * 0.4;
    if (I.buffered('attack') && p.airAtk < airMaxOf(p)) { I.consume('attack'); p.airAtk++; p._airDashT = 0; p.doAct(p.acts.jatk); }
    return true;
  }
  return false;
}
CLASSES.mage.airControl = witchAir;
/* ---- 普攻：骑扫把时空中攻击换成扫把连击（最多 6 下，低空能打到倒地的敌人，下落很慢）；扫把粉末开着时普攻变成独立攻击，附带寒冰 / 猛毒 ---- */
const WITCH_JATK = { name: 'jatk', clip: 'brAtk', dur: 0.3, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.22,
  onStart: e => { if (!e._ride) { e.play('mjatk', true); e.act.lowGrav = 0.75; return; } e.play(e.airAtk % 2 ? 'brAtk' : 'brAtkB', true); e.vz = Math.max(e.vz, -40); },
  hits: [HB(0.07, 0.15, [0, 66, 26, -60, 80], 0.8, { stun: 0.34, knock: 50, airLift: 150, hs: 0.05, snd: 'blunt', type: 'phys', downHit: true })],
  events: [slashAt(0.06, { a0: -1.3, a1: 1.3, r: 48, w: 9, off: [8, 30] })] };
const WITCH_ACTS = { ...MAGE_ACTS, jatk: WITCH_JATK };
// 扫把粉末：普攻类（含天击 / 龙牙）改成独立攻击、范围 +25%、硬直 ×2.14，命中附带寒冰（几率冰冻）/ 猛毒（中毒）
const powderHit = h => ({ ...h, type: 'indep', stun: (h.stun || 0.3) * 2.14, box: h.box && [h.box[0], h.box[1] * 1.25, h.box[2] * 1.2, h.box[3], h.box[4]], powder: true });
const powderize = A => { const O = {}; for (const k in A) { const a = A[k]; O[k] = a && a.hits && a.basic ? { ...a, hits: a.hits.map(powderHit) } : a; } return O; };
const WITCH_ACTS_P = powderize(WITCH_ACTS);
for (const id of ['mg_sky', 'mg_fang']) { const S = SKILLS[id]; if (!S || !S.act) continue; const f = S.act; S.act = (lv, p) => { const a = f(lv, p); if (p && isWitch(p) && p.buffs && p.buffs.wt_powder && a.hits) a.hits = a.hits.map(powderHit); return a; }; }
{ const prev = CLASSES.mage.onHit; CLASSES.mage.onHit = (p, t, h, dmg, act, opt) => { if (prev) prev(p, t, h, dmg, act, opt); if (!h.powder || !isWitch(p)) return; const P = p.buffs.wt_powder; if (!P) return;
  if (P.kind === 'ice') { if (Math.random() < 0.15 + 0.012 * (P.lv || 1)) addStatus(t, 'freeze', 1.5, { src: p }); } else addStatus(t, 'poison', 5, { src: p, dps: atkOf(p, 'indep') * (0.05 + 0.005 * (P.lv || 1)) }); }; }
/* =====================================================================
   机械与召唤物的美术：自定义帧名的逐帧精灵（art/final/spr/<id>/，witch_art.py 切帧）
   ===================================================================== */
const MACH_ANIMS = {
  furnace: { idle: [['idle', 0]], build: [['build', 0]], pump1: [['pump1', 0]], pump2: [['pump2', 0]], fire1: [['fire1', 0], ['fire2', 0.12]], fire2: [['fire2', 0]], fail: [['fail', 0]], boom: [['boom', 0]] },
  drill: { idle: [['idle', 0]], drive: { fps: 10, frames: ['drive1', 'drive2'] }, drill: { fps: 14, frames: ['drill1', 'drill2'] }, turn: [['turn', 0]], fail: [['fail', 0]], big: { fps: 10, frames: ['big', 'drill2'] }, build: [['idle', 0]] },
  tesla: { idle: [['idle', 0]], build: [['build', 0]], spin: { fps: 8, frames: ['spin1', 'spin2'] }, zap: [['zap1', 0], ['zap2', 0.25]], fail: [['fail', 0]], boom: [['boom', 0]] },
  antigrav: { idle: [['idle', 0]], build: [['build', 0]], on: { fps: 6, frames: ['on1', 'on2', 'on3'] }, off: [['off', 0]], fail: [['fail', 0]], boom: [['boom', 0]] },
  shululu: { idle: [['idle2', 0]], walk: { fps: 8, frames: ['walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7', 'walk8'] }, taunt: { fps: 4, frames: ['taunt1', 'taunt2'] },
    swell: { fps: 8, frames: ['swell1', 'swell2'] }, hop: [['hop1', 0], ['hop2', 0.2]], sad: [['sad', 0]] },
  // 觉醒段
  rabbit: { idle: [['idle', 0]], build: [['build', 0]], zap: { fps: 12, frames: ['zap1', 'zap2'] }, charge: [['charge', 0]], hop: [['hop', 0]], fail: [['fail', 0]], boom: [['boom', 0]] },
  shaved: { idle: [['idle', 0]], build: [['build', 0]], spin: { fps: 10, frames: ['spin1', 'spin2', 'spin3'] }, fail: [['fail', 0]], boom: [['boom', 0]] },
  ouro: { idle: [['idle', 0]], build: [['build', 0]], move: { fps: 10, frames: ['move1', 'move2'] }, grab: { fps: 8, frames: ['grab1', 'grab2'] }, boom: [['boom', 0]] },
  trickjack: { idle: [['idle', 0]], walk: { fps: 8, frames: ['walk1', 'walk2', 'walk3', 'walk4'] }, spray: [['spray1', 0], ['spray2', 0.1]], turn: [['turn', 0]] },
  candyDoll: { idle: [['idle', 0]], walk: { fps: 12, frames: ['walk1', 'walk2', 'walk3', 'walk4'] }, hop: [['hop1', 0], ['hop2', 0.2]], pop: [['pop', 0]] },
};
// 四个助手共用一套片段名（助手的招式：throw 投掷 / cast 施法 / scratch 抓挠）
for (const id of ['helperJack', 'helperSnow', 'helperEel', 'helperCat']) MACH_ANIMS[id] = { idle: [['idle', 0]], walk: { fps: 8, frames: ['walk1', 'walk2', 'walk3', 'walk4'] },
  throw: [['atk1', 0], ['atk2', 0.35]], cast: [['cast1', 0]], scratch: [['atk1', 0], ['atk2', 0.25]] };
// 片段表（Ent 需要 CLIPS 形式的片段：只用来计时，帧由 SpriteModel 按片段名选）
function wtClips(anims) {
  const C = {}, mk = (n, A) => { const c = A && A.frames ? { dur: A.frames.length / A.fps, loop: true, keys: [k(0, POSE.idle)] } : { dur: 30, keys: [k(0, POSE.idle)] }; Object.defineProperty(c, '__name', { value: n }); return c; };
  for (const n of ['idle', 'walk', 'run', 'hit', 'hit2', 'air', 'airUp', 'down', 'getup', 'held', 'jumpUp', 'jumpFall', 'land']) C[n] = mk(n, anims[n === 'run' ? 'walk' : n] || anims.idle);
  for (const n in anims) C[n] = mk(n, anims[n]);
  if (anims.walk) C.walk = mk('walk', anims.walk), C.run = mk('run', anims.walk);
  return C;
}
const WT_CLIPS = {}; for (const id in MACH_ANIMS) WT_CLIPS[id] = wtClips(MACH_ANIMS[id]);
// 模型：素材已加载 → 逐帧精灵；否则一个带颜色的光球（summonLoadArt 加载完会自动换）
function wtSprite(id, col) {
  if (typeof SPR_DATA !== 'undefined' && SPR_DATA[id] && IMG[`spr/${id}/idle`]) { const A = MACH_ANIMS[id], map = { _: 'idle' }; if (A && A.walk) for (const n of ['run', 'walk']) map[n] = 'walk1'; const m = new SpriteModel(id, map, A || {}); if (id === 'shululu' && !SPR_DATA[id].frames.idle) m.map._ = 'idle2'; return m; }
  const img = () => fxTint('orb', col || '#e0b060');
  return { draw(c, pose, t) { drawSpr(c, img(), 0, -40 + Math.sin(t * 4) * 3, 34, 34, {}); } };
}
// 机械：不走默认 AI，状态固定成 act（片段由技能动作控制，不会被 idle 覆盖）
function machDef(key, o) {
  return defSummon('wt_' + key, { kind: 'follower', name: o.name, bundle: key, model: () => wtSprite(key, o.col), clips: WT_CLIPS[key], w: o.w || 22, d: o.d || 14, h: o.h || 100, scale: o.scale || 1, speed: 0, pref: 0, sight: 0,
    life: o.life || 14, max: o.max || 1, col: o.col, type: 'indep', attacks: [], shadowR: o.shadowR || 30, tags: ['machine'].concat(o.tags || []),
    onSpawn: s => { s.setState('act'); s.act = null; s.play('build', true); if (o.onSpawn) o.onSpawn(s); }, ai: () => { }, onEnd: o.onEnd,
    update: (s, dt) => { if (s.auto) s.auto(s, dt); if (o.update) o.update(s, dt); } });
}
const mClip = (m, c) => { if (m && !m.gone && m.clipName !== c) m.play(c, true); };
machDef('furnace', { name: '暴炎加热炉', h: 112, w: 26, col: '#ff9a50' });
machDef('drill', { name: '冰霜钻孔车', h: 104, w: 30, col: '#9fe6ff' });
machDef('tesla', { name: '电鳗碰撞机', h: 170, w: 26, col: '#fff38a', scale: 1 });
machDef('antigrav', { name: '反重力装置', h: 64, w: 22, col: '#c79aff', life: 3 });
/* =====================================================================
   搭乘：放出机械，自己坐上去；期间免疫异常、受到伤害 −60%；学了引爆实验按跳跃当场引爆
   ===================================================================== */
const RIDE_IMMUNE = ['stun', 'freeze', 'sleep', 'root', 'bind', 'confuse', 'slow', 'blind', 'curse', 'taunt'];
function rideOn(e, m) {
  e.act.m = m; e._wtRide = m; e.statusImmune = { ...(e.statusImmune || {}) }; for (const k of RIDE_IMMUNE) e.statusImmune[k] = true;
  e.buffs.wt_ride = { t: 30, taken: -0.6 };
}
function rideOff(e) {
  delete e.buffs.wt_ride; if (e.statusImmune) for (const k of RIDE_IMMUNE) delete e.statusImmune[k];
  e._wtRide = null; e.drawFlip = false;
}
// 机械爆炸（结束 / 引爆）：o = { dmg, elem, r }
function machBoom(e, m, lv, o = {}) {
  if (!m || m.gone) return;
  const r = o.r || 120; sfx.boom(0.9); cam.shake = Math.max(cam.shake, 6); fxBurst(m.x, m.y, 50, r * 1.8, o.col || '#ffb060'); fxShock(m.x, m.y, r * 1.4, o.col || '#ffb060'); fxSpr('explosion', m.x, m.y, 30, { w: r * 1.6, dur: 0.5, ay: 0.8 });
  summonArea(m, m.x, m.y, r, { dmg: o.dmg, launch: 380, knock: 160, hs: 0.1, big: 1.6, type: 'indep', elem: o.elem, downHit: true, shake: 4 }, { zMax: 200 });
}
// 骑乘中的通用输入：按跳跃（学了引爆实验）= 当场引爆
const detonate = (e, I) => { if (!e.act.m || !hasSkill(e, 'wt_detonate') || !I.buffered('jump')) return false; I.consume('jump'); e.act.detonated = true; e.act.dur = e.actT; fxText('引爆！', e.x, e.y, e.z + 70, { col: '#ff9a50', size: 12 }); return true; };
// 组装时间：法米利尔亲和让机械类技能的施放时间 −20%
const buildT = e => 0.42 * (hasSkill(e, 'wt_affinity') ? 0.8 : 1);
/* =====================================================================
   被动 / BUFF
   ===================================================================== */
defSkill('wt_broom', { name: '扫把掌握', cls: 'mage', job: WT, lvReq: 15, mp: 0, cd: 0.5, sp: 15, type: 'indep', buff: true, air: true, col: '#b08a5a', ai: null, cmdNote: '开关',
  desc: '【被动 · 可开关】施放速度、命中率提高。装备扫把时，跳跃中骑上扫把：空中攻击最多 6 次、下落变慢；空中快速按两次 ← / → 冲刺，下落中按住跳跃键缓降（每次跳跃各 2 次）；空中施放技能后冲刺次数刷新；低空的空中攻击能打到倒地的敌人。在技能栏上按一下可以关闭 / 打开骑扫把。',
  infoExtra: lv => [['施放速度', '+' + pct(0.1 + 0.015 * lv)], ['命中率', '+5%'], ['空中攻击次数', '6']],
  instant: (lv, p) => { if (toggleBuff(p, 'wt_broomOff', 1e9, {})) fxText('不骑扫把', p.x, p.y, p.z + 40, { col: '#ccc', size: 10 }); else fxText('骑扫把', p.x, p.y, p.z + 40, { col: '#e0c0ff', size: 10 }); } });
defSkill('wt_affinity', { name: '法米利尔亲和', cls: 'mage', job: WT, lvReq: 15, passive: true, type: 'indep', col: '#e0a060',
  desc: '【被动】和四只使魔更亲近：技能更不容易失败、更容易大成功；机械类技能的组装时间缩短 20%。', infoExtra: lv => [['失败几率', '-' + pct(0.015 * lv)], ['大成功几率', '+' + pct(0.02 * lv)]] });
defSkill('wt_book', { name: '远古魔法书', cls: 'mage', job: WT, lvReq: 15, mp: 40, cd: 5, type: 'indep', buff: true, col: '#8a6ad0', ai: { kind: 'buff' },
  desc: '【BUFF】翻开古代图书馆的魔法书，普攻和技能的攻击力提高（一直持续到死亡或离开地下城）。', infoExtra: lv => [['攻击力', '+' + pct(0.08 + 0.01 * lv)]],
  act: (lv) => ({ name: 'wt_book', clip: 'wtCheer', dur: 0.5, noCounter: true, onStart: e => { e.buffs.wt_book = { t: 1e9, dmg: 0.08 + 0.01 * lv }; sfx.buff(); fxAura(e, '#b89aff'); fxSpr('rune', e.x, e.y, e.z + 70, { w: 60, dur: 0.6, col: '#b89aff', grow: [0.4, 1.1] }); } }) });
defSkill('wt_lucky', { name: '幸运棒棒糖', cls: 'mage', job: WT, lvReq: 17, passive: true, type: 'indep', col: '#ff8ac0',
  desc: '【被动】含着幸运的棒棒糖：成功和大成功的几率提高，攻击力提高。', infoExtra: lv => [['攻击力', '+' + pct(0.03 + 0.01 * lv)], ['失败几率', '-' + pct(0.01 * lv)], ['大成功几率', '+' + pct(0.015 * lv)]] });
defSkill('wt_bitter', { name: '苦涩的棒棒糖', cls: 'mage', job: WT, lvReq: 19, maxLv: 1, passive: true, type: 'indep', col: '#8a5a3a',
  desc: '【被动】熔岩药瓶、暴炎加热炉、冰霜钻孔车按住技能键 0.15 秒即强制失败，失败时伤害 +50%——把拖沓的持续伤害压缩成一次爆发。' });
defSkill('wt_detonate', { name: '引爆实验', cls: 'mage', job: WT, lvReq: 19, maxLv: 1, passive: true, type: 'indep', col: '#e05a3a',
  desc: '【被动】搭乘或操作机械（暴炎加热炉、冰霜钻孔车、电鳗碰撞机）时按跳跃键，当场引爆机械并结束技能。' });
defSkill('wt_premonition', { name: '成功预感', cls: 'mage', job: WT, lvReq: 21, passive: true, type: 'indep', col: '#ffd070',
  desc: '【被动 · 一觉】技能成功后有几率在头顶出现糖果，30 秒内下一个技能必定成功、更容易大成功；同时提高暴击率和暴击伤害。',
  infoExtra: lv => [['糖果几率', pct(0.2 + 0.02 * lv)], ['暴击率', '+' + pct(0.05 + 0.005 * lv)], ['暴击伤害', '+' + pct(0.05 + 0.01 * lv)]] });
// 扫把粉末：← 寒冰粉（几率冰冻）/ → 猛毒粉（中毒）
defSkill('wt_powder', { name: '扫把粉末', cls: 'mage', job: WT, lvReq: 16, mp: 30, cd: 5, type: 'indep', buff: true, col: '#6ac0a0', ai: { kind: 'buff' },
  desc: '【BUFF】给扫把撒上魔法粉末（施放时按住 ← 选寒冰粉：几率冰冻；按住 → 选猛毒粉：中毒；不按方向键沿用上一次，默认猛毒粉）。普攻、跑攻、跳攻、天击、龙牙变成独立攻击，范围变大、硬直 +114%。一直持续到死亡或离开地下城。',
  infoExtra: lv => [['寒冰粉冰冻几率', pct(0.15 + 0.012 * lv)], ['猛毒粉每秒伤害', pct(0.05 + 0.005 * lv)]],
  act: (lv) => ({ name: 'wt_powder', clip: 'wtCheer', dur: 0.45, noCounter: true, onStart: e => { const dx = e.pad ? e.pad.dx() : 0, old = e.buffs.wt_powder, kind = dx < 0 ? 'ice' : dx > 0 ? 'poison' : (old && old.kind) || 'poison';
    e.buffs.wt_powder = { t: 1e9, kind, lv }; sfx.buff(); const col = kind === 'ice' ? '#bfefff' : '#8adf6a'; fxAura(e, col); fxText(kind === 'ice' ? '寒冰粉' : '猛毒粉', e.x, e.y, e.z + 40, { col, size: 11 }); } }) });
// 苍蝇拍：禁锢（开关）
defSkill('wt_swatlock', { name: '苍蝇拍：禁锢', cls: 'mage', job: WT, lvReq: 18, maxLv: 1, mp: 0, cd: 0.5, sp: 15, type: 'indep', buff: true, air: true, col: '#6a6a80', ai: null, cmdNote: '开关',
  desc: '【开关】开启后，变异苍蝇拍 / 超级苍蝇拍不再召唤变异怪。', instant: (lv, p) => { const on = toggleBuff(p, 'wt_swatlock', 1e9, {}); fxText(on ? '禁锢：开' : '禁锢：关', p.x, p.y, p.z + 40, { col: '#c8c8e0', size: 10 }); } });
/* =====================================================================
   主动技能（P0：官方 Lv15～48 → 本作 Lv15～21）
   ===================================================================== */
// 地面 / 空中两用的动作：空中版用骑扫把的帧、慢慢下落，落地结束；空中施放后冲刺次数刷新
function airOr(p, ground, air) {
  if (!(p && p.z > 2)) return ground;
  const A = { ...ground, clip: 'brAtkB', airOnly: true, lowGrav: 0.3, ...air };
  const s0 = A.onStart; A.onStart = e => { airRefresh(e); if (!e._ride) e.play('mjatk', true); if (s0) s0(e); };
  return A;
}
// ---- 改良舒露露：往前走的挑衅人偶（杰克扮的），嘲讽周围的敌人；时间到 / 被打爆 / 再按一次技能键时爆炸 ----
defSummon('wt_shululu', { kind: 'follower', name: '舒露露', bundle: 'shululu', model: () => wtSprite('shululu', '#ff9a50'), clips: WT_CLIPS.shululu, w: 11, d: 10, h: 64, speed: 45, pref: 0, sight: 0,
  life: 8, max: 1, col: '#ff9a50', type: 'indep', attacks: [], hp: o => o.hpMax * 0.35, shadowR: 12,
  ai: (s, dt) => { const o = s.owner, R = game.room;
    if (s.fail) { const gx = o.x - o.face * 50, dx = gx - s.x; s.vx = Math.abs(dx) > 8 ? Math.sign(dx) * Math.min(170, Math.abs(dx) * 3) : 0; s.vy = (o.y - s.y) * 3; s.setState(s.vx ? 'walk' : 'idle'); if (s.vx) s.face = Math.sign(s.vx); return; }
    const edge = R && ((s.face > 0 && s.x > R.x1 - 40) || (s.face < 0 && s.x < R.x0 + 40));
    s.vx = edge ? 0 : s.face * 45; s.vy = 0; s.setState(edge ? 'idle' : 'walk');
    s.tauntT = (s.tauntT || 0) - dt;
    if (s.tauntT <= 0) { s.tauntT = 0.5; for (const t of ents) if (foe(o, t) && !t.dead && Math.hypot(t.x - s.x, (t.y - s.y) * 2) < 400 && (!t.boss || s.lv >= 5)) addStatus(t, 'taunt', 0.9, { src: s }); } },
  onEnd: (s, why) => { if (s.fail || why === 'room' || why === 'owner' || why === 'round') return; const K = CRAFT_K[s.r] || 1;
    sfx.boom(0.5 * K); fxBurst(s.x, s.y, 30, 160 * K, '#ffb060'); fxShock(s.x, s.y, 130 * K, '#ffb060'); fxSpr('explosion', s.x, s.y, 20, { w: 130 * K, dur: 0.5, ay: 0.8 });
    summonArea(s, s.x, s.y, 95 * K, { dmg: s.dmg * (K > 1 ? 1.2 : 1), launch: 360, knock: 120, hs: 0.1, big: 1.4, elem: 'fire', type: 'indep', downHit: true, shake: 3 }, { zMax: 200 }); } });
defSkill('wt_shululu', { name: '改良舒露露', cls: 'mage', job: WT, lvReq: 15, mp: 35, cd: 16, type: 'indep', elem: 'fire', col: '#ff9a50', cast: true, air: true,
  desc: '扔出挑衅人偶舒露露（杰克扮的）：它慢慢往前走，嘲讽周围的敌人（技能 5 级起领主也会被嘲讽），8 秒后、被打爆或再按一次技能键时爆炸。失败：它只会跟着你走，不爆炸；大成功：爆炸更大。可以空中施放。',
  pow: lv => wtLv(lv, 5.0, 0.5), ai: { kind: 'buff', summon: 'wt_shululu' },
  recast: { ok: p => summonsOf(p, 'wt_shululu').some(s => !s.fail), cd: 0.3, mp: 0, act: () => ({ name: 'wt_boom', clip: 'fling', dur: 0.22, noCounter: true, onStart: e => dismissSummons(e, 'wt_shululu', 'cmd') }) },
  act: (lv, p) => airOr(p, { name: 'wt_shululu', clip: 'potion', dur: 0.45, cancelFrom: 0.32, events: [evAt(0.15, e => { const r = rollCraft(e, 'jack');
    const s = summon(e, 'wt_shululu', { lv, x: e.x + e.face * 46, y: e.y }); if (!s) return; s.dmg = wtLv(lv, 5.0, 0.5); s.r = r; s.fail = r === 'fail'; s.face = e.face; s.z = e.z; s.play(s.fail ? 'sad' : 'taunt', true);
    fxBurst(s.x, s.y, s.z + 30, 70, '#ffb060'); })] }) });
// ---- 改良魔法星弹：追踪弹，命中后跳到下一个敌人（范围内每个敌人各打 1 次）；大成功附加感电和连锁闪电 ----
defSkill('wt_missile', { name: '改良魔法星弹', cls: 'mage', job: WT, lvReq: 15, mp: 25, cd: 5.4, type: 'indep', elem: 'light', col: '#fff38a', cast: true, air: true,
  desc: '射出追踪星弹，命中后跳向附近下一个没打过的敌人。成功 5 跳、大成功 8 跳并附加感电和连锁闪电、失败只有 2 跳。可以空中施放。', pow: lv => wtLv(lv, 0.8, 0.08) * 5, ai: { kind: 'proj', r: [0, 420], dy: 80 },
  act: (lv, p) => airOr(p, { name: 'wt_missile', clip: 'mcast', dur: 0.36, cancelFrom: 0.22, events: [evAt(0.1, e => wtMissile(e, lv))] }) });
function wtMissile(e, lv) {
  const r = rollCraft(e, 'eel'), max = { fail: 2, ok: 5, great: 8, super: 10 }[r], hitSet = new Set(); let n = 0;
  const hit1 = { dmg: wtLv(lv, 0.8, 0.08), stun: 0.35, knock: 30, hs: 0.04, type: 'indep', elem: 'light', col: '#fff6a0', snd: 'crit', sure: true };
  const hop = (x, y, z) => {
    const t = nearestFoe({ ...e, x, y }, 420, o => !hitSet.has(o) && !o.dead); if (!t || n >= max) return; n++; hitSet.add(t);
    spawnProj({ owner: e, x, y, z, face: Math.sign(t.x - x) || e.face, life: 1.4, w: 10, d: 12, h: 14, pierce: true, hit: null, tgt: t,
      update(q) { const tt = q.tgt; if (!tt || tt.dead || tt.remove) { q.t = q.life; return; } const dx = tt.x - q.x, dy = tt.y - q.y, dz = tt.z + 45 - q.z, l = Math.hypot(dx, dy * 2, dz) || 1; q.vx = dx / l * 720; q.vy = dy / l * 720; q.vz = dz / l * 720;
        if (l < 26 && !q.done) { q.done = true; q.t = q.life; applyHit(e, tt, hit1, { proj: true, src: q });
          if (craftBig(r)) { addStatus(tt, 'shock', 4, { src: e }); lightningStrike({ x: tt.x, y: tt.y }); applyHit(e, tt, { ...hit1, dmg: wtLv(lv, 0.3, 0.03), stun: 0.3, knock: 0, hs: 0.02 }, { proj: true, src: q }); } } },
      onEnd(q) { if (q.done) hop(q.x, q.y, q.z); },
      draw(c, q) { drawSpr(c, fxTint('orb', '#fff38a'), sx(q.x), sy(q.y, q.z), 24, 24, { rot: q.t * 10 }); } });
  };
  sfx.magic(); hop(e.x + e.face * 20, e.y, e.z + 60);
  if (!n) spawnProj({ owner: e, x: e.x + e.face * 24, y: e.y, z: e.z + 60, face: e.face, vx: e.face * 620, life: 0.6, w: 10, d: 12, h: 14, pierce: false, hit: { ...hit1, sure: false },
    draw(c, q) { drawSpr(c, fxTint('orb', '#fff38a'), sx(q.x), sy(q.y, q.z), 24, 24, { rot: q.t * 10 }); } });
}
// ---- 暗影斗篷：黑斗篷把身前一片敌人一起卷住、强制拖到身前（特殊抓取，能抓霸体和格挡中的敌人），命中致盲；施放中无敌（官方没有成功率判定）----
defSkill('wt_cloak', { name: '暗影斗篷', cls: 'mage', job: WT, lvReq: 16, mp: 30, cd: 7, type: 'indep', elem: 'dark', col: '#4a2a6a',
  desc: '甩出一件巨大的黑斗篷，把身前一大片敌人一起卷住、强制拖到你面前（特殊抓取，能抓霸体和格挡中的敌人），命中必定致盲。施放中无敌。', pow: lv => wtLv(lv, 3.4, 0.34), ai: { kind: 'grab', r: [0, 130], dy: 34 },
  infoExtra: () => [['致盲', '100%（6 秒）']],
  act: (lv, p) => p && hasSkill(p, 'wt_pink') ? catHelperAct(lv) : ({ name: 'wt_cloak', clip: 'fling', dur: 0.8, noCounter: true, invul: [0.04, 0.78],
    onStart: e => { e.act.tg = []; e.act.gx = e.x + e.face * 72; sfx.swing(true); },
    update: (e, dt) => { const a = e.act; if (!a.tg.length) return; a.gx = e.x + e.face * 72;
      for (const t of a.tg) { if (t.dead) continue; if (!t.boss) { t.x = damp(t.x, a.gx + (t.id % 3 - 1) * 10, 9, dt); t.y = damp(t.y, e.y + 0.5, 9, dt); } addStatus(t, 'root', 0.25, { src: e, force: true }); }
      if (Math.random() < 0.7) addFx({ x: a.gx, y: e.y + 0.6, z: 0, dur: 0.05, n: a.tg.length, draw(c) { drawSpr(c, fxTint('darkorb', '#3a1a5a'), sx(this.x), sy(this.y, 50), 120 + Math.min(4, this.n) * 20 + Math.sin(game.t * 30) * 8, 100, { add: false, alpha: 0.85 }); } }); },
    events: [evAt(0.1, e => { const a = e.act;   // 卷：身前宽范围里的敌人全部卷进斗篷
        for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && (t.x - e.x) * e.face > -10 && Math.abs(t.x - e.x) < 135 && Math.abs(t.y - e.y) < 34 && t.z < 130) a.tg.push(t);
        if (a.tg.length) { sfx.hit('slash', false); fxBurst(a.gx, e.y, 40, 120, '#5a2a8a'); } }),
      evAt(0.3, e => { for (const t of e.act.tg) if (!t.dead) applyHit(e, t, { dmg: wtLv(lv, 1.2, 0.12), stun: 0.3, hs: 0.04, type: 'indep', elem: 'dark', sure: true }, { proj: true }); }),
      evAt(0.62, e => { const a = e.act; if (!a.tg.length) return; sfx.boom(0.4); fxBurst(a.gx, e.y, 40, 150, '#8a5ab0');
        for (const t of a.tg) if (!t.dead) { unroot(t); addStatus(t, 'blind', 6, { src: e }); applyHit(e, t, { dmg: wtLv(lv, 2.2, 0.22), launch: 300, knock: 120, hs: 0.08, type: 'indep', elem: 'dark', sure: true }, { proj: true, src: { x: e.x, y: e.y, z: 0, face: e.face } }); } })] }) });
// ---- 变异苍蝇拍：霸体抡起大苍蝇拍从身后拍下（地面 180°、空中 120°）；几率诅咒，打致盲的敌人伤害更高；几率召出变异怪 ----
function mutantModel(kind, hue) {
  const A = typeof MON_ART !== 'undefined' && MON_ART[kind]; if (!A || typeof SPR_DATA === 'undefined' || !SPR_DATA[A[0]] || !IMG[`spr/${A[0]}/idle`]) return MON[kind].model();
  const o = { ...(A[1] || {}) }; o.hue = (o.hue || 0) + hue; o.sat = (o.sat || 1) * 1.15; return new SpriteModel(A[0], { ...SPR_FALLBACK, cast: 'cast1', roar: 'cast2', crouch: 'low1' }, SPR_ANIMS.monster, o);
}
function wtShot(s, o) {
  const t = summonTarget(s) || nearestFoe(s, 500); if (!t) return; const T = clamp(Math.abs(t.x - s.x) / 300, 0.4, 0.9);
  lobProj(s, t.x, t.y, T, { img: 'rock', h: 14, z0: 50, vz: 200, hit: { dmg: o.dmg * s.mul, stun: 0.3, knock: 60, hs: 0.04, snd: 'blunt', type: 'indep' }, onLand: pr => fxDust(pr.x, pr.y, 3, 5, '#9a8a70') });
}
defSummon('wt_mut_gob', { kind: 'follower', name: '变异哥布林弓手', bundle: 'goblin', model: () => mutantModel('goblinThrower', 170), clips: GOB_CLIPS, w: 11, d: 11, h: 72, speed: 110, runSpeed: 240, pref: 170, sight: 520,
  life: 30, max: 4, tags: ['mutant'], tagMax: { mutant: 4 }, col: '#b08aff', type: 'indep',
  attacks: [{ clip: 'throw', range: [50, 340], dy: 50, cd: [1.3, 2.0], act: { dur: 0.9, events: [evAt(0.45, s => wtShot(s, { dmg: 0.45 }))] } }] });
defSummon('wt_mut_tau', { kind: 'follower', name: '变异牛头兽', bundle: 'tau', model: () => mutantModel('tauBeast', 200), clips: BEAST_CLIPS, w: 18, d: 14, h: 130, scale: 1.1, speed: 100, runSpeed: 220, pref: 60, sight: 520,
  life: 30, max: 4, tags: ['mutant'], tagMax: { mutant: 4 }, col: '#b08aff', type: 'indep',
  attacks: [{ clip: 'slam', range: [0, 100], dy: 22, cd: [1.8, 2.8], act: { dur: 1.1, superArmor: true, hits: [{ t0: 0.6, t1: 0.7, box: [-20, 105, 34, 0, 100], dmg: 1.2, down: true, knock: 200, hs: 0.08, snd: 'blunt', shake: 3, type: 'indep' }],
    events: [evAt(0.62, s => { fxDust(s.x + s.face * 50, s.y, 10, 30); sfx.boom(0.5); })] } }] });
// 召唤变异怪：失败 = 敌方的变异哥布林（没有经验和金币）；成功 = 友方哥布林弓手；大成功 = 友方牛头兽；超大成功 = 魔道学助手（学了的话）
function swatMutant(e, r, lv, chance) {
  if (e.buffs.wt_swatlock || Math.random() >= chance) return;
  const R = game.room, x = R ? clamp(e.x + e.face * 70, R.x0 + 20, R.x1 - 20) : e.x + e.face * 70;
  fxSigil('hexagram', x, e.y, 0, { w: 90, dur: 0.6, ay: 0.5, grow: [0.3, 1], col: r === 'fail' ? '#ff6a5a' : '#b08aff' }); fxBurst(x, e.y, 40, 90, r === 'fail' ? '#ff6a5a' : '#b08aff');
  if (r === 'fail') { if (game.pvp) return; const m = spawnMonster('goblin', x, e.y, { lvl: Math.max(1, (game.lvl || 10) - 2) }); if (m) { m.exp = 0; m.gold = [0, 0]; m.name = '变异哥布林'; } fxText('糟了！', x, e.y, 60, { col: '#ff6a5a', size: 11 }); return; }
  if (r === 'super' && hasSkill(e, 'wt_helper')) { helperSpawn(e, lv, x); return; }
  summon(e, r === 'ok' ? 'wt_mut_gob' : 'wt_mut_tau', { x, y: e.y, lv, mul: lvMul(lv, 0.1) });
}
function swatHit(e, lv, big) {
  const r = rollCraft(e, 'cat'), air = e.z > 2, K = Math.min(CRAFT_K[r], 1.25), base = big ? wtLv(lv, 8.0, 0.8) : wtLv(lv, 3.2, 0.32);
  const box = air ? [-30, (big ? 170 : 125) * K, big ? 70 : 46, -140, 60] : [-(big ? 120 : 90), (big ? 180 : 130) * K, big ? 70 : 46, -10, big ? 200 : 150];
  const n = instantHit(e, HB(0, 1, box, base * (r === 'fail' ? 0.7 : 1), { stun: 0.6, knock: 60, down: true, downLift: 120, hs: 0.1, big: big ? 2 : 1.5, shake: big ? 6 : 3, snd: 'blunt', downHit: true, type: 'indep', elem: 'dark', col: '#c79aff',
    onHit: (a, t) => { if (Math.random() < (craftBig(r) ? 0.35 : 0.2)) addStatus(t, 'curse', 5, { src: a }); if (hasStatus(t, 'blind') && !t.dead) applyHit(a, t, { dmg: base * 0.3, stun: 0, knock: 0, hs: 0, sure: true, type: 'indep', elem: 'dark' }, { proj: true }); } }));
  cam.shake = Math.max(cam.shake, big ? 6 : 3); sfx.boom(big ? 0.9 : 0.45); fxShock(e.x + e.face * (big ? 70 : 50), e.y, big ? 240 : 150, '#c79aff'); fxDust(e.x + e.face * 60, e.y, big ? 12 : 6, big ? 50 : 26);
  if (n) swatMutant(e, r, lv, big ? 0.4 : 0.3);
  return r;
}
defSkill('wt_swatter', { name: '变异苍蝇拍', cls: 'mage', job: WT, lvReq: 17, mp: 30, cd: 6.4, type: 'indep', elem: 'dark', col: '#8a5ab0', air: true,
  desc: '带霸体抡起大苍蝇拍从身后拍下（地面 180°、空中向前下方 120°），能打到倒地的敌人，有几率诅咒，拍致盲的敌人伤害更高。命中时有 30% 几率召出变异怪（最多 4 只、30 秒）：成功 = 友方哥布林弓手，大成功 = 友方牛头兽，失败 = 敌方的变异哥布林。可以空中施放。',
  pow: lv => wtLv(lv, 3.2, 0.32), ai: { kind: 'poke', r: [0, 120], dy: 36 },
  act: (lv, p) => airOr(p, { name: 'wt_swatter', clip: 'swat', dur: 0.56, superArmor: true, cancelFrom: 0.42, events: [evAt(0.2, e => swatHit(e, lv, false))] }, { clip: 'swatAir', lowGrav: 0.2 }) });
// ---- 熔岩药瓶：扔出药瓶，地面生成 6 秒熔岩（减速、每秒灼烫）；大成功范围更大并灼伤；失败：瓶子当场炸开、主角被熏黑 ----
defSummon('wt_lava', { kind: 'field', r: 80, tick: 1, life: 6, max: 2, col: '#ff7a2a', type: 'indep', elem: 'fire',
  onTick(s, foes) { for (const t of ents) { if (!foe(s.owner, t) || t.invul > 0 || t.z > 40 || !inGround(t, s.x, s.y, 80 * s.K)) continue; summonHit(s, t, { dmg: s.dmg, stun: 0.25, knock: 0, hs: 0.02, elem: 'fire', type: 'indep', sure: true, downHit: true }); addStatus(t, 'slow', 1.3, { src: s.owner }); if (craftBig(s.r)) addStatus(t, 'burn', 2, { src: s.owner, dps: atkOf(s.owner, 'indep') * 0.05 }); }
    if (Math.random() < 0.8) fxSpr('flame', s.x + rnd(-50, 50) * s.K, s.y + rnd(-14, 14), 0, { w: 34, dur: 0.5, ay: 1, grow: [0.5, 1] }); },
  draw(c, s) { const k = s.lifeT / s.life, a = k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1, R = 80 * s.K; c.save(); c.globalAlpha = 0.85 * a; drawSpr(c, 'lava', sx(s.x), sy(s.y, 0), R * 2.2, R * 2.2 * GR, { add: false }); c.restore(); } });
defSkill('wt_lava', { name: '熔岩药瓶', cls: 'mage', job: WT, lvReq: 18, mp: 45, cd: 20, type: 'indep', elem: 'fire', col: '#e0602a', cast: true, air: true,
  desc: '扔出药瓶，地面生成持续 6 秒的熔岩：每秒灼烫并减速范围内的敌人。大成功：范围更大并灼伤。失败：瓶子当场炸开，炸飞身边的敌人，主角被熏黑。学会苦涩的棒棒糖后，按住技能键 0.15 秒强制失败，失败伤害 +50%。可以空中施放。',
  pow: lv => wtLv(lv, 1.0, 0.1) * 6, ai: { kind: 'aoe', r: [60, 300], dy: 60 },
  act: (lv, p) => airOr(p, { name: 'wt_lava', clip: 'potion', dur: 0.5, cancelFrom: 0.36, charge: bitterCharge(p), events: [evAt(0.12, e => wtLava(e, lv))] }, { charge: undefined }) });
function wtLava(e, lv) {
  const forced = bitterOn(e), r = rollCraft(e, 'jack', { force: forced ? 'fail' : null }), total = wtLv(lv, 1.0, 0.1) * 6;
  if (r === 'fail') { const x = e.x + e.face * 46; fxBurst(x, e.y + 1, e.z + 40, 110, '#ffb060'); fxSpr('explosion', x, e.y + 1, e.z, { w: 96, dur: 0.35, ay: 0.8 }); sfx.boom(0.7); cam.shake = Math.max(cam.shake, 4);
    blast(e, x, e.y, 100, { dmg: total * 0.6 * (forced ? 1.5 : 1), launch: 380, knock: 160, hs: 0.1, big: 1.6, elem: 'fire', type: 'indep', downHit: true, sure: true }, { zMax: 160 + e.z });
    witchOops(e, 'soot', 0.8); if (e.act && !e.act.airOnly) e.act.dur = Math.max(e.act.dur, e.actT + 0.7); return; }
  const at = aimAhead(e, 170, 320); sfx.swing(false);
  lobProj(e, at.x, at.y, 0.42, { img: 'fireball', h: 16, onLand: pr => { sfx.hit('fire', false); fxBurst(pr.x, pr.y, 10, 100, '#ffb060');
    const f = summon(e, 'wt_lava', { x: pr.x, y: pr.y }); if (f) { f.dmg = wtLv(lv, 1.0, 0.1); f.r = r; f.K = r === 'ok' ? 1 : CRAFT_K[r]; f.tickT = 0.9; } } });
}
// ---- 魔道酸雨云：召出一朵下酸雨的云，持续 6 秒；大成功时附带闪电硬直（学了粉红糖果：冰霜云，会追着敌人走）----
defSummon('wt_acid', { kind: 'field', r: 95, tick: 0.5, life: 6, max: 1, col: '#9adf6a', type: 'indep', elem: 'ice', zMax: 200,
  update(s, dt) { if (!s.frost) return; const t = strongestFoe({ ...s.owner, x: s.x, y: s.y }, 600); if (t) { s.x = damp(s.x, t.x, 1.4, dt); s.y = damp(s.y, t.y, 1.4, dt); } },   // 冰霜云：追着附近最强的敌人走
  onTick(s, foes) { for (const t of ents) { if (!foe(s.owner, t) || t.invul > 0 || t.z > 200 || !inGround(t, s.x, s.y, 95 * s.K)) continue;
    summonHit(s, t, { dmg: s.dmg, stun: 0.2, knock: 0, hs: 0.02, elem: 'ice', type: 'indep', sure: true });
    if (s.frost) { addStatus(t, 'slow', 1, { src: s.owner }); if (Math.random() < 0.1) addStatus(t, 'freeze', 1.5, { src: s.owner }); fxSpr('icespike', t.x + rnd(-14, 14), t.y + 0.5, t.z + 40, { w: 26, dur: 0.25, rot: Math.PI / 2 }); }   // 冰雹和冰锥：10% 冰冻
    if (craftBig(s.r) && Math.random() < 0.15) { lightningStrike({ x: t.x, y: t.y }); summonHit(s, t, { dmg: s.dmg, stun: 0.8, knock: 0, hs: 0.04, elem: 'light', type: 'indep', sure: true }); } } },
  drawUpright(c, s) { const X = sx(s.x), Y = sy(s.y, 150), k = s.lifeT / s.life, a = k < 0.1 ? k * 10 : k > 0.9 ? (1 - k) / 0.1 : 1, W = 200 * s.K; c.save(); c.globalAlpha = a;
    const img = IMG[s.frost ? 'fx/wt_frostcloud' : 'fx/wt_cloud'] || fxTint('poison', s.frost ? '#bfefff' : '#7a8a7a'); drawSpr(c, img, X, Y, W, W * 0.42, { add: false });
    c.strokeStyle = s.frost ? 'rgba(200,240,255,.75)' : 'rgba(160,230,110,.7)'; c.lineWidth = 2;
    for (let i = 0; i < 10; i++) { const x = X - W * 0.4 + ((i * 37 + game.t * 90) % (W * 0.8)), y0 = Y + 18 + ((game.t * 300 + i * 53) % 110); c.beginPath(); c.moveTo(x, y0); c.lineTo(x - 3, y0 + 12); c.stroke(); } c.restore(); } });
defSkill('wt_acid', { name: '魔道酸雨云', cls: 'mage', job: WT, lvReq: 18, mp: 45, cd: 20, type: 'indep', elem: 'ice', col: '#8adf6a', cast: true, air: true,
  desc: '在前方召出一朵下酸雨的云，持续 6 秒，不断伤害下方的敌人。大成功：云更大，并不时劈下闪电打出硬直。失败：云很小、伤害减半。可以空中施放。', pow: lv => wtLv(lv, 0.5, 0.05) * 12, ai: { kind: 'aoe', r: [60, 300], dy: 60 },
  act: (lv, p) => airOr(p, { name: 'wt_acid', clip: 'mup', dur: 0.45, cancelFrom: 0.32, events: [evAt(0.15, e => { const r = rollCraft(e, 'snow'), at = aimAhead(e, 170, 320), f = summon(e, 'wt_acid', { x: at.x, y: at.y });
    if (f) { f.dmg = wtLv(lv, 0.5, 0.05) * (r === 'fail' ? 0.5 : 1); f.r = r; f.K = r === 'fail' ? 0.6 : r === 'ok' ? 1 : CRAFT_K[r]; f.frost = hasSkill(e, 'wt_pink'); if (f.frost) f.life = 8; sfx.magic(); } })] }) });
// ---- 旋转扫把（按住 ↓ + Z）：空中 = 骑扫把旋转俯冲（连按最多 12 段），落地放冲击波后自己摔个狗吃屎；
//      地面 = 原地像陀螺一样旋转（方向键移动、把敌人卷进来、连按转得更快，按跳跃中断），转完头晕摔倒放冲击波。
//      摔倒时可以接熔岩药瓶 / 酸雨云 / 魔法星弹 / 反重力装置 / 舒露露 / 捣蛋杰克 / 机械类技能；有小几率晕乎乎地回复一点 HP / MP ----
const spinHit = (lv, max, b = 0.42) => HB(0, 3, [-46, 64, 36, -50, 110], wtLv(lv, b, b / 10), { rep: 0.09, max, stun: 0.3, knock: 10, hs: 0.02, type: 'indep', elem: 'light', snd: 'crit', downHit: true,
  onHit: (a, t) => { if (Math.random() < 0.1) addStatus(t, 'shock', 3, { src: a }); } });
const spinMash = (e, I) => { const a = e.act, sl = barOf(e).indexOf('wt_spin'); if ((sl >= 0 && I.buffered('s' + sl)) || I.buffered('cmd') || I.buffered('attack')) { if (sl >= 0) I.consume('s' + sl); I.consume('cmd'); I.consume('attack'); a.hits[0].max = Math.min(12, a.hits[0].max + 1); a.hits[0].rep = Math.max(0.06, a.hits[0].rep - 0.004); a.mash = (a.mash || 0) + 1; return true; } return false; };
const SPIN_LINKS = ['wt_lava', 'wt_acid', 'wt_missile', 'wt_antigrav', 'wt_shululu', 'wt_trickjack', 'wt_tesla', 'wt_furnace', 'wt_drill', 'wt_rabbit', 'wt_shaved'];
// 头晕摔倒：落地冲击波 + 狗吃屎；从这一刻起可以接 SPIN_LINKS 里的技能
function spinFall(e, lv, dmg) {
  const a = e.act, K = CRAFT_K[e._wtR] || 1; a.fell = true; a.hits = []; a.linkFrom = e.actT; e.vz = 0; e.vx = e.vy = 0; e.drawFlip = false; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7); fxShock(e.x, e.y, 180 * K, '#ffe070'); fxDust(e.x, e.y, 10, 40);
  blast(e, e.x, e.y, 115 * K, { dmg: dmg * (e._wtR === 'fail' ? 0.7 : 1), launch: 300, knock: 120, hs: 0.08, type: 'indep', elem: 'light', downHit: true }, { zMax: 120 });
  a.dur = e.actT + 0.75; witchOops(e, 'fall', 0.75);
  if (Math.random() < 0.05) { if (!game.pvp) { e.hp = Math.min(e.hpMax, e.hp + Math.round(e.hpMax * 0.05)); e.mp = Math.min(e.mpMax, e.mp + Math.round(e.mpMax * 0.05)); } fxText('晕乎乎～', e.x, e.y, e.z + 70, { col: '#ff8ae0', size: 11 }); }
}
defSkill('wt_spin', { name: '旋转扫把', cls: 'mage', job: WT, lvReq: 19, mp: 45, cd: 12, type: 'indep', elem: 'light', col: '#e0c040', air: true,
  desc: '地面：原地像陀螺一样带着扫把旋转，方向键移动，把周围的敌人卷进来，连按技能键 / Z / X 转得更快，按跳跃键中断；转完头晕摔倒，放出冲击波。空中：骑扫把旋转俯冲，连按增加段数（最多 12 段），落地放出冲击波，然后摔个狗吃屎。命中有几率感电；摔倒时可以直接接熔岩药瓶、酸雨云、魔法星弹、反重力装置、舒露露、捣蛋杰克和机械类技能；有小几率晕乎乎地回复一点 HP / MP。旋转中霸体。',
  pow: lv => wtLv(lv, 0.3, 0.03) * 12 + wtLv(lv, 1.5, 0.15), ai: { kind: 'aoe', r: [0, 110], dy: 40 },
  act: (lv, p) => {
    if (p && p.z > 2) return { name: 'wt_spin', clip: 'brSpin', dur: 2.6, superArmor: true, noCounter: true, lowGrav: 0.35, hits: [spinHit(lv, 6)], links: SPIN_LINKS, linkFrom: 99,
      onStart: e => { e._wtR = rollCraft(e, 'eel'); airRefresh(e); e.vz = Math.min(e.vz, -60); sfx.swing(true); },
      onInput: (e, I) => { if (e.act.fell) return false; if (spinMash(e, I)) e.vz = Math.max(e.vz, -70); return false; },
      update: (e, dt) => { const a = e.act; if (a.fell) return; e.vx = e.face * 210; e.drawFlip = Math.floor(e.actT * 14) % 2 === 1; if (Math.random() < 0.5) fxStreak({ x: e.x, y: e.y, z: e.z + 50, face: Math.random() < 0.5 ? 1 : -1, len: 60, w: 6, col: '#ffe090', dur: 0.1 }); },
      onLand: e => { if (!e.act.fell) { spinFall(e, lv, wtLv(lv, 2.4, 0.24)); e.act.superArmor = false; } },
      onEnd: e => { e.drawFlip = false; } };
    return { name: 'wt_spin', clip: 'brSpin', dur: 2.1, superArmor: true, noCounter: true, hits: [spinHit(lv, 12, 0.3)], links: SPIN_LINKS, linkFrom: 99,
      onStart: e => { e._wtR = rollCraft(e, 'eel'); sfx.swing(true); },
      onInput: (e, I) => { const a = e.act; if (a.fell) { e.vx = e.vy = 0; return false; }
        if (I.buffered('jump')) { I.consume('jump'); a.dur = e.actT; e.vx = e.vy = 0; return true; }
        spinMash(e, I); const K = e._wtR === 'fail' ? 0.6 : 1; e.vx = I.dx() * 170 * K; e.vy = I.dy() * 100 * K; return false; },
      update: (e, dt) => { const a = e.act; if (a.fell) return; if (e.actT >= 1.4 - Math.min(0.3, (a.mash || 0) * 0.03)) { spinFall(e, lv, wtLv(lv, 1.5, 0.15)); return; }   // 连按转得快，也更早转完
        e.drawFlip = Math.floor(e.actT * 14) % 2 === 1; const R = 170 * (CRAFT_K[e._wtR] || 1); if (Math.random() < 0.5) fxStreak({ x: e.x, y: e.y, z: e.z + 40, face: Math.random() < 0.5 ? 1 : -1, len: 70, w: 6, col: '#ffe090', dur: 0.1 });
        for (const t of ents) if (foe(e, t) && !t.boss && !t.dead && t.st !== 'held' && Math.hypot(t.x - e.x, (t.y - e.y) * 2) < R) { t.x = damp(t.x, e.x, 2.2, dt); t.y = damp(t.y, e.y, 2.2, dt); } },
      onEnd: e => { e.drawFlip = false; } };
  } });
// 连按：技能键 / Z / X 任意一个按下就算一次（消耗掉按键，免得动作结束后误放技能）
// 定身中的目标不会被击飞 / 击倒（bestiary.js）：收尾一击前先解开自己加的定身
const unroot = t => { if (t.status && t.status.root) delete t.status.root; };
const wtMash = (e, I, id) => { const sl = barOf(e).indexOf(id), k = sl >= 0 && I.buffered('s' + sl); if (!k && !I.buffered('cmd') && !I.buffered('attack')) return false; if (k) I.consume('s' + sl); I.consume('cmd'); I.consume('attack'); return true; };
/* ---- 搭乘类技能的通用动作：组装 → 坐上去 → 持续输出 → 爆炸
   S = { id, key（机械 summon key）, fam（使魔）, bitter（苦涩的棒棒糖能强制失败）, dur / failDur（秒）, seat(e, a, m) → [前后偏移, 高度, 缩放?], pose（坐着的片段）,
         start(e, a, m), ride(e, a, m, k, dt), fail(e, a, m, k, dt), input(e, I, a), boom(e, a) → { dmg, elem, col, r } } ---- */
function rideAct(lv, p, S) {
  return { name: S.id, clip: 'hammer', dur: 30, superArmor: true, noCounter: true, lowGrav: 0.001, charge: S.bitter ? bitterCharge(p) : undefined,
    onStart: e => { e._wtA = e.act; e.act.lv = lv; },
    onInput: (e, I, dt) => { const a = e.act; if (!a.m) return false; e.vx = e.vy = 0; if (detonate(e, I)) return true; if (S.input && !a.fell) S.input(e, I, a, dt); return true; },
    update: (e, dt) => {
      const a = e.act; if (!a.chargeDone) return;
      if (!a.started) {
        a.started = true; const forced = S.bitter && bitterOn(e); a.forced = forced; a.r = rollCraft(e, S.fam, { force: forced ? 'fail' : S.noFail ? 'great' : null }); a.K = CRAFT_K[a.r];
        const R = game.room, x = R ? clamp(e.x + e.face * (S.dx ?? 36), R.x0 + 40, R.x1 - 40) : e.x + e.face * (S.dx ?? 36);
        const m = summon(e, S.key, { x, y: e.y, lv }); if (!m) { a.dur = e.actT; return; }
        m.face = e.face; rideOn(e, m); a.t0 = e.actT; a.bt = buildT(e); airRefresh(e); if (S.start) S.start(e, a, m); sfx.charge && sfx.charge();
      }
      const m = a.m; if (!m || m.gone) { a.dur = e.actT; return; }
      const k = e.actT - a.t0;
      if (k < a.bt) { if (S.building) S.building(e, a, m, k / a.bt, dt); else mClip(m, 'build'); if (e.clipName !== 'hammer') e.play('hammer'); if (Math.random() < 0.3) fxDust(m.x + rnd(-20, 20), m.y, 1, 6, '#b8a48a'); return; }
      const kk = k - a.bt;
      if (!a.seated) { a.seated = true; if (!S.building) mClip(m, 'idle'); sfx.hit('blunt', false); fxDust(m.x, m.y, 6, 30); }
      if (a.r === 'fail') { if (S.fail) S.fail(e, a, m, kk, dt); if (kk >= (S.failDur || 1.4)) a.dur = e.actT; }
      else { S.ride(e, a, m, kk, dt); if (kk >= S.dur) a.dur = e.actT; }
      if (!a.fell) { const s = S.seat(e, a, m); e.x = m.x + s[0] * m.face; e.y = m.y + 0.4; e.z = s[1]; e.vx = e.vy = e.vz = 0; e.face = m.face; e.scale = s[2] || 1; const pc = S.pose ? S.pose(e, a, m, kk) : 'brIdle'; if (e.clipName !== pc && !(e._oopsT > 0)) e.play(pc); }
    },
    onEnd: (e) => { const a = e._wtA; e._wtA = null; e.scale = 1; if (!a) return; const m = a.m;
      if (!a.fell) { e.z = Math.max(e.z, 1); e.vz = 240; e.vx = -e.face * 90; }
      if (m && !m.gone) { const B = S.boom ? S.boom(e, a) : {}; rideEnd(e, a, B); } else rideOff(e); } };
}
function rideEnd(e, a, B = {}) { const m = a.m; rideOff(e); if (!m || m.gone) return; if (B.boom !== false) { mClip(m, 'boom'); machBoom(e, m, a.lv, B); } dismissOne(m, 'cmd'); a.m = null; }
// ---- 电鳗碰撞机（电塔）：钻进仓鼠轮里发电，反复放出闪电（每次 5 道，大成功 8 道并感电），被电到的敌人长时间硬直；失败：漏电电到自己 ----
// 学了魔道学助手：由助手放置，放完就可以走开（放置版，机械自己放电）
// st.fast > 0：连按发电（放电间隔缩短一半多）；st.max：助手操作，一直全速
function teslaZap(owner, m, st, lv, dt) {
  st.fast = Math.max(0, (st.fast || 0) - dt); const quick = st.max || st.fast > 0;
  st.zapT -= dt * (quick ? 2.2 : 1); mClip(m, st.zapT < 0.25 ? 'zap' : 'spin');
  if (st.zapT > 0) return; st.zapT = 1.2; if (quick) fxSpr('lightning', m.x + rnd(-20, 20), m.y, m.h * 0.5, { w: 40, h: 50, dur: 0.15, col: '#fff38a' });
  const n = { ok: 5, great: 8, super: 10 }[st.r] || 5; sfx.zap(); fxSpr('lightning', m.x, m.y, m.h * (m.scale || 1) * 0.9, { w: 60, h: 60, dur: 0.25, col: '#fff38a' });
  const L = ents.filter(t => foe(owner, t) && !t.dead && Math.abs(t.x - m.x) < 320 && Math.abs(t.y - m.y) < 100);
  for (let i = 0; i < n; i++) { const t = L[i % Math.max(1, L.length)], x = t ? t.x + rnd(-10, 10) : m.x + rnd(-220, 220), y = t ? t.y : clamp(m.y + rnd(-60, 60), 6, DEPTH - 6);
    game.after(i * 0.06, () => { if (m.gone) return; lightningStrike({ x, y }); summonArea(m, x, y, 42, { dmg: wtLv(lv, 0.42, 0.042), stun: 1.4, knock: 0, hs: 0.03, elem: 'light', type: 'indep', downHit: true }, { zMax: 240, status: craftBig(st.r) ? 'shock' : null, sdur: 4 }); }); }
}
const TESLA_SEAT = [26, 6, 0.6];   // 仓鼠轮的中心（相对机械的前后偏移、高度、缩放）
defSkill('wt_tesla', { name: '电鳗碰撞机', cls: 'mage', job: WT, lvReq: 19, mp: 60, cd: 25, type: 'indep', elem: 'light', col: '#e0d040', cast: true,
  desc: '搭起电塔，钻进仓鼠轮里踩轮子发电：约 5 秒内不断放出闪电（每次 5 道，大成功 8 道并感电），被电到的敌人长时间硬直；连按技能键 / Z / X 踩得更快、放电更频繁。失败：漏电电到自己，只放 1 道。学了引爆实验可以按跳跃键提前引爆；学了魔道学助手后由助手全速操作（持续时间变短），你可以直接走开。',
  pow: lv => wtLv(lv, 0.42, 0.042) * 20 + wtLv(lv, 1.5, 0.15), ai: { kind: 'aoe', r: [0, 280], dy: 90 },
  act: (lv, p) => p && hasSkill(p, 'wt_helper') ? helperPlace(lv, 'wt_tesla', 'eel') : rideAct(lv, p, { id: 'wt_tesla', key: 'wt_tesla', fam: 'eel', dur: 4.8, failDur: 1.6, dx: -10,
    seat: () => TESLA_SEAT, pose: () => 'run',
    start: (e, a) => { a.zapT = 0.6; },
    input: (e, I, a) => { if (wtMash(e, I, 'wt_tesla')) a.fast = 0.35; },
    ride: (e, a, m, k, dt) => teslaZap(e, m, a, lv, dt),
    fail: (e, a, m, k) => { if (k < 0.5 || a.oops) return; a.oops = true; mClip(m, 'fail'); lightningStrike({ x: m.x, y: m.y });
      summonArea(m, m.x + m.face * 80, m.y, 60, { dmg: wtLv(lv, 1.0, 0.1), stun: 0.6, launch: 200, hs: 0.05, elem: 'light', type: 'indep' });
      if (!game.pvp) e.hp = Math.max(1, e.hp - Math.round(e.hpMax * 0.03)); a.fell = true; e.scale = 1; e.z = 0; e.x = m.x - m.face * 46; witchOops(e, 'zap', 1.0); },
    boom: (e, a) => ({ dmg: wtLv(lv, 1.5, 0.15), elem: 'light', col: '#fff38a', r: 120 }) }) });
// ---- 暴炎加热炉：坐在风箱上拉风箱（霸体），喷出会爆炸的火石；连按 Z / X 喷得更快，←→ 控制远近；时间到或引爆时炉子爆炸（击倒）；
//      失败：从炉上摔下来，炉口朝天喷出熔岩柱 ----
const FURNACE_SEAT = [-12, 78];
defSkill('wt_furnace', { name: '暴炎加热炉', cls: 'mage', job: WT, lvReq: 19, mp: 60, cd: 25, type: 'indep', elem: 'fire', col: '#e0602a', cast: true,
  desc: '放下加热炉，坐上去拉风箱（霸体），喷出落地爆炸的火石；连按 Z / X 喷得更快，←→ 控制落点远近。约 4 秒后或按跳跃键（引爆实验）时炉子爆炸，把敌人炸倒。大成功每次多喷 1 块。失败：主角从风箱上摔下来，炉口朝天喷出熔岩柱。学会苦涩的棒棒糖后，按住技能键 0.15 秒强制失败，失败伤害 +50%。',
  pow: lv => wtLv(lv, 0.55, 0.055) * 16 + wtLv(lv, 3.0, 0.3), ai: { kind: 'aoe', r: [60, 320], dy: 60 },
  act: (lv, p) => rideAct(lv, p, { id: 'wt_furnace', key: 'wt_furnace', fam: 'jack', bitter: true, dur: 4, failDur: 1.3, dx: 30,
    seat: (e, a) => [FURNACE_SEAT[0], FURNACE_SEAT[1] - (a.pumpK || 0) * 8], pose: () => 'hammer',
    start: (e, a) => { a.fireT = 0.3; a.aim = 0; },
    input: (e, I, a) => { if (I.buffered('attack') || I.buffered('cmd')) { I.consume('attack'); I.consume('cmd'); a.fast = 0.4; } a.aim = clamp(a.aim + I.dx() * e.face * 0.04, -1, 1); },
    ride: (e, a, m, k, dt) => {
      a.fast = Math.max(0, (a.fast || 0) - dt); a.fireT -= dt * (a.fast > 0 ? 2.3 : 1); a.pumpK = Math.max(0, Math.sin(Math.min(1, 1 - a.fireT / 0.5) * Math.PI));
      mClip(m, a.fireT < 0.12 ? 'fire1' : a.fireT < 0.3 ? 'pump2' : 'pump1');
      if (a.fireT > 0) return; a.fireT = 0.5; sfx.hit('fire', false); fxBurst(m.x + m.face * 40, m.y, 50, 70, '#ffb060');
      const n = { ok: 2, great: 3, super: 4 }[a.r] || 2;
      for (let i = 0; i < n; i++) { const tx = m.x + m.face * (95 + i * 55 + a.aim * 90 + rnd(-15, 15)), ty = clamp(m.y + rnd(-45, 45), 6, DEPTH - 6);
        lobProj(m, tx, ty, 0.45, { img: IMG['fx/wt_firestone'] ? 'wt_firestone' : 'fireball', h: 18, z0: 60, onLand: pr => { fxBurst(pr.x, pr.y, 10, 100, '#ff9a50'); sfx.boom(0.3); summonArea(m, pr.x, pr.y, 58, { dmg: wtLv(lv, 0.55, 0.055), stun: 0.35, knock: 25, hs: 0.05, type: 'indep', elem: 'fire', downHit: true }, { zMax: 120 }); } }); } },
    fail: (e, a, m, k, dt) => {
      if (!a.fell) { a.fell = true; mClip(m, 'fail'); e.scale = 1; e.z = 0; e.x = m.x - m.face * 55; e.y = m.y; witchOops(e, 'fall', 1.3); }
      const i = Math.floor(k / 0.2); if (i === a.lk || i > 5) return; a.lk = i;
      fxSpr('pillar', m.x + m.face * 10, m.y, 0, { w: 70, h: 190, dur: 0.35, ay: 1, col: '#ff7a2a' }); sfx.hit('fire', false);
      summonArea(m, m.x, m.y, 70, { dmg: wtLv(lv, 1.2, 0.12) * (a.forced ? 1.5 : 1), stun: 0.5, launch: 320, hs: 0.05, type: 'indep', elem: 'fire', downHit: true }, { zMax: 260 }); },
    boom: (e, a) => { for (const q of projs) if (q && q.owner === a.m) { q.onEnd = null; q.t = q.life; }   // 炉子爆炸时还在空中的火石一起消失（不再补打把被炸飞的敌人压下来）
      return { dmg: wtLv(lv, 3.0, 0.3), elem: 'fire', r: 125, boom: a.r !== 'fail' }; } }) });
// ---- 冰霜钻孔车：从天而降（落地冲击波），坐进去用方向键驾驶约 5.5 秒；连按 X 钻得更快并把敌人吸过来，按 Z 掉头，能打到倒地的敌人；
//      大成功换装巨型冰钻头；失败：钻进地里爆炸 ----
const DRILL_SEAT = [-16, 46];
defSkill('wt_drill', { name: '冰霜钻孔车', cls: 'mage', job: WT, lvReq: 20, mp: 80, cd: 45, type: 'indep', elem: 'ice', col: '#6ac0e8', cast: true,
  desc: '钻孔车从天而降（落地冲击波），坐进去用方向键驾驶约 5.5 秒：钻头不断伤害前方的敌人（能打到倒地的敌人）；连按技能键 / X 钻得更快，并把前方的敌人吸过来；按 Z 掉头。结束时爆炸。大成功换装巨型冰钻头。失败：钻进地里爆炸。学会苦涩的棒棒糖后，按住技能键 0.15 秒强制失败，失败伤害 +50%。',
  pow: lv => wtLv(lv, 0.3, 0.03) * 40 + wtLv(lv, 2.0, 0.2) + wtLv(lv, 2.5, 0.25), ai: { kind: 'burst', r: [0, 220], dy: 40 },
  act: (lv, p) => rideAct(lv, p, { id: 'wt_drill', key: 'wt_drill', fam: 'snow', bitter: true, dur: 5.5, failDur: 1.3, dx: 40,
    seat: () => DRILL_SEAT, pose: () => 'brIdle',
    building: (e, a, m, u) => { mClip(m, 'idle'); m.z = 240 * (1 - u * u); if (u > 0.9 && !a.landedD) { a.landedD = true; m.z = 0; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.6); fxShock(m.x, m.y, 170, '#bfefff'); fxSpr('frost', m.x, m.y, 0, { w: 160, dur: 0.5, ay: 0.75 });
      summonArea(m, m.x, m.y, 110, { dmg: wtLv(lv, 2.0, 0.2), launch: 260, knock: 80, hs: 0.06, type: 'indep', elem: 'ice', downHit: true }, { zMax: 120 }); } },
    input: (e, I, a) => { if (I.buffered('cmd')) { I.consume('cmd'); a.m.face = -a.m.face; mClip(a.m, 'turn'); a.turnT = 0.2; } const sl = barOf(e).indexOf('wt_drill');
      if (I.buffered('attack') || (sl >= 0 && I.buffered('s' + sl))) { I.consume('attack'); if (sl >= 0) I.consume('s' + sl); a.fast = 0.3; } a.mx = I.dx(); a.my = I.dy(); },
    ride: (e, a, m, k, dt) => {
      m.z = 0; if (!isHuman(e)) { const t = nearestFoe(m, 520); a.mx = t ? Math.sign(t.x - m.x) * (Math.abs(t.x - m.x) > 30 ? 1 : 0) : 0; a.my = t ? Math.sign(t.y - m.y) * (Math.abs(t.y - m.y) > 8 ? 1 : 0) : 0; if (a.mx && a.mx !== m.face) m.face = a.mx; if (t && Math.random() < 0.05) a.fast = 0.3; }
      a.fast = Math.max(0, (a.fast || 0) - dt); a.turnT = Math.max(0, (a.turnT || 0) - dt);
      const sp = 170 * (a.fast > 0 ? 1.5 : 1), R = game.room; m.x += (a.mx || 0) * sp * dt; m.y = clamp(m.y + (a.my || 0) * 110 * dt, 6, DEPTH - 6); if (R) m.x = clamp(m.x, R.x0 + 30, R.x1 - 30);
      if (!(a.turnT > 0)) mClip(m, a.fast > 0 || a.mx ? (craftBig(a.r) ? 'big' : 'drill') : 'drive');
      const step = a.fast > 0 ? 0.08 : 0.14, i = Math.floor(k / step);
      if (i !== a.hk) { a.hk = i; const rr = craftBig(a.r) ? 72 : 54; summonArea(m, m.x + m.face * 62, m.y, rr, { dmg: wtLv(lv, 0.3, 0.03), stun: 0.3, knock: -20, hs: 0.02, elem: 'ice', type: 'indep', downHit: true }, { zMax: 120 });
        if (Math.random() < 0.4) fxSpr('icespike', m.x + m.face * 70, m.y, 20, { w: 40, dur: 0.2, rot: rnd(-1, 1) }); }
      if (a.fast > 0) for (const t of ents) if (foe(e, t) && !t.boss && !t.dead && Math.abs(t.x - m.x) < 180 && Math.abs(t.y - m.y) < 60) { t.x = damp(t.x, m.x + m.face * 60, 4, dt); t.y = damp(t.y, m.y, 4, dt); } },
    fail: (e, a, m, k) => { m.z = 0; if (!a.dove) { a.dove = true; mClip(m, 'fail'); sfx.boom(0.4); fxDust(m.x + m.face * 40, m.y, 10, 30, '#dff4ff'); } if (k > 0.6 && !a.fell) { a.fell = true; e.z = 40; e.vz = 260; e.x = m.x - m.face * 50; witchOops(e, 'soot', 0.9); } },
    boom: (e, a) => ({ dmg: a.r === 'fail' ? wtLv(lv, 4.0, 0.4) * (a.forced ? 1.5 : 1) : wtLv(lv, 2.5, 0.25), elem: 'ice', col: '#bfefff', r: 130 }) }) });
// ---- 反重力装置：地面装置把范围内的敌人抬到空中，上升和落地各打一次；失败时敌人不会浮空；大成功时被抬起的敌人落地各自砸出冲击波，打到周围没被抬起的敌人。地面 / 空中都能放 ----
function antigravRun(owner, m, r, lv) {
  const K = CRAFT_K[r] || 1; mClip(m, 'build');
  game.after(0.35, () => { if (m.gone) return; mClip(m, r === 'fail' ? 'fail' : 'on'); sfx.charge(); fxSigil('hexagram', m.x, m.y, 0, { w: 220 * K, dur: 1.2, ay: 0.5, col: '#c79aff', grow: [0.5, 1] });
    const up = new Set(ents.filter(t => foe(owner, t) && !t.dead && t.invul <= 0 && inGround(t, m.x, m.y, 115 * K) && t.z < 400));
    summonArea(m, m.x, m.y, 115 * K, { dmg: wtLv(lv, 2.2, 0.22), launch: r === 'fail' ? 0 : 560, stun: 0.6, knock: 0, hs: 0.05, elem: 'dark', type: 'indep', downHit: true }, { zMax: 400 });
    game.after(1.1, () => { if (m.gone) return; mClip(m, 'off'); summonArea(m, m.x, m.y, 125 * K, { dmg: wtLv(lv, 3.0, 0.3), launch: 160, knock: 60, hs: 0.08, elem: 'dark', type: 'indep', downHit: true, shake: 3 }, { zMax: 80 });
      if (!craftBig(r)) return;
      for (const u of up) { if (u.dead) continue; fxShock(u.x, u.y, 140, '#b080ff'); fxDust(u.x, u.y, 6, 24);
        for (const t of ents) if (!up.has(t) && foe(owner, t) && !t.dead && inGround(t, u.x, u.y, 90) && t.z < 60) summonHit(m, t, { dmg: wtLv(lv, 1.5, 0.15), knock: 120, launch: 180, hs: 0.06, type: 'indep', elem: 'dark', downHit: true }); } }); });
}
defSkill('wt_antigrav', { name: '反重力装置', cls: 'mage', job: WT, lvReq: 19, mp: 50, cd: 20, type: 'indep', elem: 'dark', col: '#8a5ad0', cast: true, air: true,
  desc: '在前方敲出反重力装置，把范围内的敌人抬到空中，上升和落地各造成一次伤害。失败：敌人不会浮空；大成功：范围更大，被抬起的敌人落地时各自砸出冲击波，打到周围没被抬起的敌人。地面、空中都能放。学了魔道学助手后由助手放置。', pow: lv => wtLv(lv, 5.2, 0.52), ai: { kind: 'aoe', r: [40, 260], dy: 70 },
  act: (lv, p) => airOr(p, p && hasSkill(p, 'wt_helper') ? helperPlace(lv, 'wt_antigrav', 'cat') : { name: 'wt_antigrav', clip: 'hammer', dur: 0.62, cancelFrom: 0.5, events: [evAt(0.24, e => { const r = rollCraft(e, 'cat'), at = aimAhead(e, 150, 260);
    sfx.hit('blunt', false); const m = summon(e, 'wt_antigrav', { x: at.x, y: at.y, life: 2.4, lv }); if (m) antigravRun(e, m, r, lv); })] }) });
/* =====================================================================
   觉醒段（P1：官方 Lv50～100 → 本作 Lv21～30）
   ===================================================================== */
// 觉醒插图：二觉 / 三觉有自己的插图（cutin/witch2、cutin/witch3）就用，没有就用一觉的
const wtCutin = (e, name, n) => { const who = n && IMG['cutin/witch' + n] ? { cls: 'witch' + n, model: e.model, x: e.x } : cutinWho(e); game.cutin = { t: 0, dur: 1.0, name, who }; game.timeStop = 0.9; sfx.awaken(); };
// 用逐帧精灵的某一帧画一个“站立形象”（机械 / 助手的演出用；没素材时画一个带颜色的光球）
function wtFrame(c, id, f, x, y, z, sc, face = 1, o = {}) {
  const S = typeof SPR_DATA !== 'undefined' && SPR_DATA[id], F = S && S.frames[f], im = F && IMG[`spr/${id}/${f}`];
  const X = sx(x), Y = sy(y, z);
  if (!im) { const h = (o.fh || 60) * sc; drawSpr(c, fxTint('orb', o.col || '#e0b060'), X, Y - h * 0.5, h * 0.6, h * 0.6, { alpha: o.alpha }); return; }
  const k = sc / S.res; c.save(); if (o.alpha !== undefined) c.globalAlpha *= o.alpha; c.translate(X, Y); if (o.rot) c.rotate(o.rot); c.scale(face * k, k); c.drawImage(im, -F.ax, -F.ay); c.restore();
}
// ---- 魔道学助手：四只使魔改造成的人造人（跟随作战 30 秒；替你放置电塔 / 反重力装置）----
const HELPER_SPR = { jack: 'helperJack', snow: 'helperSnow', eel: 'helperEel', cat: 'helperCat' };
const HELPER_ATK = {
  jack: { clip: 'throw', range: [60, 320], dy: 60, cd: [1.4, 2.2], act: { dur: 0.8, events: [evAt(0.4, s => { const t = summonTarget(s); if (!t) return; lobProj(s, t.x, t.y, 0.45, { img: 'jack', h: 22, z0: 40, onLand: pr => { sfx.boom(0.3); fxBurst(pr.x, pr.y, 10, 90, '#ffb060'); summonArea(s, pr.x, pr.y, 60, { dmg: 0.7 * s.mul, launch: 240, knock: 60, hs: 0.05, type: 'indep', elem: 'fire' }, { zMax: 100 }); } }); })] } },
  snow: { clip: 'cast', range: [40, 360], dy: 40, cd: [1.2, 1.8], act: { dur: 0.7, events: [evAt(0.35, s => { sfx.ice(); spawnProj({ owner: s, x: s.x + s.face * 20, y: s.y, z: 40, vx: s.face * 480, face: s.face, life: 0.8, w: 12, d: 14, h: 18, pierce: false,
    hit: { dmg: 0.6 * s.mul, stun: 0.35, knock: 50, hs: 0.04, type: 'indep', elem: 'ice', onHit: (a, t) => addStatus(t, 'slow', 2, { src: s.owner }) }, draw(c, q) { drawSpr(c, 'snowman', sx(q.x), sy(q.y, q.z), 0, 26, { add: false, rot: q.t * 8 }); } }); })] } },
  eel: { clip: 'cast', range: [0, 360], dy: 80, cd: [1.6, 2.4], act: { dur: 0.8, events: [evAt(0.4, s => { const t = summonTarget(s); if (!t) return; lightningStrike({ x: t.x, y: t.y }); summonArea(s, t.x, t.y, 50, { dmg: 0.9 * s.mul, stun: 0.8, knock: 0, hs: 0.04, type: 'indep', elem: 'light' }, { zMax: 200 }); })] } },
  cat: { clip: 'scratch', range: [0, 70], dy: 20, cd: [0.9, 1.4], act: { dur: 0.6, hits: [{ t0: 0.3, t1: 0.4, box: [0, 70, 24, 0, 80], dmg: 0.7, stun: 0.4, knock: 60, hs: 0.05, snd: 'slash', type: 'indep', elem: 'dark' }] } },
};
for (const fam in HELPER_SPR) defSummon('wt_helper_' + fam, { kind: 'follower', name: FAM[fam].n + '助手', bundle: HELPER_SPR[fam], model: () => wtSprite(HELPER_SPR[fam], FAM[fam].col), clips: WT_CLIPS[HELPER_SPR[fam]],
  w: 10, d: 10, h: 70, speed: 150, runSpeed: 300, pref: fam === 'cat' ? 40 : 150, sight: 560, life: 30, max: 1, tags: ['helper'], tagMax: { helper: 4 }, col: FAM[fam].col, type: 'indep', attacks: [HELPER_ATK[fam]],
  onSpawn: s => { fxSigil('hexagram', s.x, s.y, 0, { w: 90, dur: 0.6, ay: 0.5, grow: [0.3, 1], col: FAM[fam].col }); } });
function helperSpawn(e, lv, x, fam) { fam = fam || pick(Object.keys(HELPER_SPR)); return summon(e, 'wt_helper_' + fam, { x, y: e.y, lv, mul: lvMul(lv, 0.1) }); }
// 助手放置机械（电塔 / 反重力装置）：放完你就可以走开，机械自己运转
function helperPlace(lv, key, fam) {
  return { name: key, clip: 'wtCheer', dur: 0.45, cancelFrom: 0.3, events: [evAt(0.15, e => {
    const r = rollCraft(e, fam), at = key === 'wt_tesla' ? { x: e.x + e.face * 90, y: e.y } : aimAhead(e, 150, 260), R = game.room, x = R ? clamp(at.x, R.x0 + 40, R.x1 - 40) : at.x;
    const m = summon(e, key, { x, y: at.y, lv, life: key === 'wt_tesla' ? 6 : 2.4 }); if (!m) return; m.face = e.face; m.helper = HELPER_SPR[fam];
    fxSigil('hexagram', x, at.y, 0, { w: 110, dur: 0.6, ay: 0.5, grow: [0.3, 1], col: FAM[fam].col });
    if (key === 'wt_antigrav') { antigravRun(e, m, r, lv); return; }
    const st = { r, zapT: 0.8, t: 0, max: true };   // 助手全速操作：放电快，但持续时间短
    m.auto = (s, dt) => { st.t += dt; if (st.t < 0.45) { mClip(s, 'build'); return; }
      if (r === 'fail') { if (!st.oops) { st.oops = true; mClip(s, 'fail'); lightningStrike({ x: s.x, y: s.y }); summonArea(s, s.x + s.face * 80, s.y, 60, { dmg: wtLv(lv, 1.0, 0.1), stun: 0.6, launch: 200, hs: 0.05, elem: 'light', type: 'indep' }); } if (st.t > 1.6) { dismissOne(s, 'life'); } return; }
      teslaZap(s.owner, s, st, lv, dt); if (st.t > 2.8) { machBoom(s.owner, s, lv, { dmg: wtLv(lv, 1.5, 0.15), elem: 'light', col: '#fff38a', r: 120 }); dismissOne(s, 'life'); } }; })] };
}
// ---- 粉红糖果（三觉被动）：暗影斗篷进化成夜猫助手——夜猫扑到身前变成斗篷卷住敌人，再向四面伸出长腿，把斗篷外面够得着的敌人全拖进斗篷里 ----
function catHelperAct(lv) {
  return { name: 'wt_cloak', clip: 'fling', dur: 0.9, noCounter: true, invul: [0.04, 0.86],
    onStart: e => { const a = e.act, R = game.room; a.cx = R ? clamp(e.x + e.face * 130, R.x0 + 30, R.x1 - 30) : e.x + e.face * 130; a.cy = e.y; a.tg = new Set(); sfx.swing(true);
      a.fx = addFx({ x: a.cx, y: a.cy + 0.5, z: 0, dur: 0.9, face: e.face, a, draw(c) { const t = this.t, A = this.a, X = sx(A.cx), Y = sy(A.cy, 0);
        if (t < 0.18) { wtFrame(c, 'helperCat', 'atk1', A.cx - this.face * 130 * (1 - easeOut(t / 0.18)), A.cy, 0, 1, this.face, { col: '#c79aff', fh: 70 }); return; }
        if (t < 0.8) { c.save(); c.strokeStyle = '#2a1238'; c.lineWidth = 7; c.lineCap = 'round';   // 伸出去的猫腿（连到被拖住的敌人）
          for (const m of A.tg) if (!m.dead) { const mx = sx(m.x), my = sy(m.y, m.z + 30); c.beginPath(); c.moveTo(X, Y - 46); c.quadraticCurveTo((X + mx) / 2, Math.min(Y, my) - 50, mx, my); c.stroke(); } c.restore();
          drawSpr(c, fxTint('darkorb', '#3a1a5a'), X, Y - 50, 130 + Math.sin(game.t * 26) * 8, 104, { add: false, alpha: 0.9 }); wtFrame(c, 'helperCat', 'cast1', A.cx, A.cy, 62, 0.7, this.face, { col: '#c79aff', fh: 70 }); } } }); },
    update: (e, dt) => { const a = e.act; if (e.actT < 0.18 || e.actT > 0.72) return; const R = e.actT < 0.34 ? 95 : 240;   // 先卷住斗篷附近的，再伸腿够远处的
      for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && t.z < 180 && inGround(t, a.cx, a.cy, R)) a.tg.add(t);
      for (const t of a.tg) { if (t.dead) continue; addStatus(t, 'root', 0.3, { src: e, force: true }); if (!t.boss) { t.x = damp(t.x, a.cx + (t.id % 3 - 1) * 12, 7, dt); t.y = damp(t.y, a.cy + 0.5, 7, dt); } } },
    events: [evAt(0.34, e => { sfx.hit('slash', false); for (const t of e.act.tg) if (!t.dead) applyHit(e, t, { dmg: wtLv(lv, 1.4, 0.14), stun: 0.6, knock: 0, hs: 0.04, type: 'indep', elem: 'dark', sure: true }, { proj: true, src: { x: e.act.cx, y: e.act.cy, z: 0, face: e.face } }); }),
      evAt(0.72, e => { const a = e.act; sfx.boom(0.6); fxBurst(a.cx, a.cy, 40, 220, '#8a5ab0'); fxShock(a.cx, a.cy, 200, '#8a5ab0');
        for (const t of a.tg) if (!t.dead) { unroot(t); addStatus(t, 'blind', 6, { src: e }); applyHit(e, t, { dmg: wtLv(lv, 2.6, 0.26), launch: 320, knock: 120, hs: 0.08, type: 'indep', elem: 'dark', sure: true, downHit: true }, { proj: true, src: { x: a.cx - e.face * 20, y: a.cy, z: 0, face: e.face } }); } })] };
}
// ---- 技艺融合（一觉）：拿着锤子在战场上跑来跑去，依次组装 4 台机械，装好的机械一直工作到最后：
//      电场装置（把敌人拖过来定住、光属性多段）→ 南瓜工厂（一圈圈放出南瓜跑者）→ 雪人旋转机（喷出一大堆雪人头和杂物）→ 巨型夜猫机（张嘴打出暗属性重拳，
//      一路把前面装好的机械全砸爆、把敌人轰飞）。南瓜工厂和雪人旋转机出来后，连按技能键 / X 加快跑者和雪人头的产出；
//      重拳打出时主角“阿咕咕”一声扑倒，正好躲过重拳。没有成功率判定 ----
const AWK_BUILD = [0.35, 1.3, 2.2, 3.1], AWK_PUNCH = 3.55;
const AWK_M = [['field1', 'field2', 1, '#fff38a'], ['pumpkin1', 'pumpkin2', 1.05, '#ff9a50'], ['snow1', 'snow2', 1, '#bfefff'], ['cat1', 'cat2', 1.45, '#c79aff']];
function awkMachine(e, M, n) { const [f1, f2, S, col] = AWK_M[n];
  return addFx({ x: M.x, y: M.y - 0.5, z: 0, dur: 30, face: M.face, M, draw(c) { const pop = Math.min(1, this.t / 0.18), f = this.M.boom ? f2 : Math.floor(this.t * 5) % 2 ? f2 : f1;
    wtFrame(c, 'wtAwk', f, this.x, this.y, 0, S * (0.3 + 0.7 * easeOutBack(pop)), this.face, { col, fh: 110 }); } }); }
defSkill('wt_awaken', { name: '技艺融合', cls: 'mage', job: WT, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'indep', awaken: true, col: '#ffd23a',
  desc: '【觉醒】拿着锤子在战场上跑来跑去，依次组装 4 台机械，装好的一直工作到最后：电场装置（把敌人拖过来定住，光属性多段）→ 南瓜工厂（一圈圈放出南瓜跑者）→ 雪人旋转机（喷出一大堆雪人头和杂物）→ 巨型夜猫机（张嘴打出暗属性重拳，把前面的机械全砸爆、把敌人轰飞）。南瓜工厂和雪人旋转机出来后，连按技能键 / X 加快跑者和雪人头的产出。施放中无敌。',
  pow: lv => wtLv(lv, 30, 8), ai: { kind: 'awaken', r: [0, 340], dy: 90 },
  act: (lv) => ({ name: 'wt_awaken', clip: 'hammerRun', dur: 4.8, superArmor: true, invul: true, noCounter: true,
    onStart: e => { wtCutin(e, '技艺融合'); const a = e.act, at = aimAhead(e, 220, 380); a.cx = at.x; a.cy = at.y; a.f0 = e.face; a.ms = []; a.fast = 0; e._wtAwk = a; },
    onInput: (e, I) => { const a = e.act; if (a.ms.length >= 2 && wtMash(e, I, 'wt_awaken')) a.fast = 0.3; return false; },
    update: (e, dt) => { const a = e.act, t = e.actT, D = wtLv(lv, 30, 8), F = a.f0, R = game.room;   // 机械的摆位和出拳方向按施放时的朝向（主角跑来跑去会转身）
      a.fast = Math.max(0, a.fast - dt); const quick = a.fast > 0 ? 1.8 : 1;
      // 组装：到点就在下一个位置敲出一台机械
      const n = a.ms.length;
      if (n < 4 && t >= AWK_BUILD[n]) { const side = [0, 1, -1, -1.5][n], x = clamp(a.cx + side * [0, 110, 90, 95][n] * F, R ? R.x0 + 60 : -1e9, R ? R.x1 - 60 : 1e9), y = clamp(a.cy + [0, 30, -30, 0][n], 10, DEPTH - 10);
        const M = { x, y, face: F, k: n, T: 0 }; M.fx = awkMachine(e, M, n); a.ms.push(M); sfx.hit('blunt', false); fxDust(x, y, 8, 30); cam.shake = Math.max(cam.shake, 3); }
      // 主角拿着锤子跑向下一台机械的位置（全部装完后站到夜猫机后面）
      const nx = a.ms.length < 4 ? AWK_BUILD[a.ms.length] : 99, tgt = a.ms.length < 4 && t > nx - 0.5 ? { x: clamp(a.cx + [0, 110, -90, -142][a.ms.length] * F, R ? R.x0 + 60 : -1e9, R ? R.x1 - 60 : 1e9), y: a.cy } : a.ms[a.ms.length - 1];
      if (!a.punch && tgt) { const gx = tgt.x - e.face * 50; e.vx = clamp((gx - e.x) * 6, -420, 420); e.vy = clamp((tgt.y - e.y) * 5, -200, 200); if (Math.abs(e.vx) > 30) e.face = Math.sign(e.vx) || e.face; }
      if (a.punch) { e.vx = e.vy = 0; return; }
      for (const M of a.ms) { M.T += dt;
        if (M.k === 0) {   // 电场装置：拖过来、定住，0.3 秒一段
          for (const m of ents) if (foe(e, m) && !m.dead && inGround(m, M.x, M.y, 280)) { if (!m.boss) { m.x = damp(m.x, M.x, 3, dt); m.y = damp(m.y, M.y, 3, dt); } if (inGround(m, M.x, M.y, 200)) addStatus(m, 'root', 0.35, { src: e, force: true }); }
          if (Math.random() < 0.4) fxSpr('lightning', M.x + rnd(-80, 80), M.y + rnd(-20, 20), 0, { w: 40, h: 120, dur: 0.15, ay: 1 });
          if ((M.hT = (M.hT ?? 0.1) - dt) <= 0) { M.hT = 0.3; summonAreaOwner(e, M.x, M.y, 200, { dmg: D * 0.02, stun: 0.8, knock: 0, hs: 0.02, elem: 'light' }, 220); } }
        else if (M.k === 1) {   // 南瓜工厂：一圈 4 个南瓜跑者
          if ((M.hT = (M.hT ?? 0.15) - dt * quick) <= 0) { M.hT = 0.4; M.v = (M.v || 0) + 1; for (let i = 0; i < 4; i++) { const ang = (M.v * 4 + i) * TAU / 12 + 0.3; wtRunner(e, M.x, M.y, Math.cos(ang), Math.sin(ang), D * 0.012); } } }
        else if (M.k === 2) {   // 雪人旋转机：朝前方喷雪人头 / 石头 / 冰锥
          if ((M.hT = (M.hT ?? 0.05) - dt * quick) <= 0) { M.hT = 0.11; const ang = rnd(-0.9, 0.9); spawnProj({ owner: e, x: M.x, y: M.y, z: 60, vx: F * Math.cos(ang) * 260, vy: Math.sin(ang) * 140 + (a.cy - M.y) * 2.5, vz: rnd(80, 240), grav: 900, face: F, life: 0.8, w: 10, d: 12, h: 12, pierce: true,
            hit: { dmg: D * 0.008, stun: 0.3, knock: 40, hs: 0.02, type: 'indep', elem: 'ice', rep: 9, downHit: true }, img: pick(['rock', 'snowman', 'icespike']), update(q) { if (q.z <= 0 && q.vz < 0) q.t = q.life; }, onEnd(q) { summonAreaOwner(e, q.x, q.y, 30, { dmg: D * 0.008, stun: 0.3, knock: 20, hs: 0.02, elem: 'ice' }, 60); }, draw(c, q) { drawSpr(c, q.img, sx(q.x), sy(q.y, q.z), 20, 20, { rot: q.t * 12, add: q.img === 'icespike' }); } }); } } }
      // 巨型夜猫机的重拳：一路砸爆前面的机械，把敌人轰飞；主角扑倒躲过去
      if (t >= AWK_PUNCH && a.ms.length === 4) { a.punch = true; const P = a.ms[3], x = P.x, y = P.y; for (const m of ents) if (foe(e, m)) unroot(m); e.face = F; cam.shake = 12; cam.flash = 0.2; cam.flashCol = '#d0a0ff'; sfx.boom(1.2);
        fxBeam(x, y, 70, 460, F, { col: '#c79aff', w: 110, dur: 0.6 }); fxBurst(x + F * 220, y, 60, 320, '#8a5ab0');
        for (const m of ents) if (foe(e, m) && !m.dead && (m.x - x) * F > -40 && Math.abs(m.x - x) < 480 && Math.abs(m.y - y) < 90) applyHit(e, m, { dmg: D * 0.36, launch: 700, knock: 420, hs: 0.14, big: 2.4, shake: 8, type: 'indep', elem: 'dark', sure: true, downHit: true }, { proj: true, src: { x, y, z: 0, face: F } });
        a.ms.slice(0, 3).forEach((M, i) => game.after(0.06 + i * 0.07, () => { M.boom = true; M.fx.t = M.fx.dur; sfx.boom(0.6); fxSpr('explosion', M.x, M.y, 20, { w: 170, dur: 0.5, ay: 0.8 }); fxBurst(M.x, M.y, 40, 160, AWK_M[M.k][3]);
          summonAreaOwner(e, M.x, M.y, 120, { dmg: D * 0.02, launch: 360, knock: 120, hs: 0.06, elem: ['light', 'fire', 'ice'][M.k] }, 200); }));
        e.x = x - F * 40; e.y = y; witchOops(e, 'fall', 1.2); } },
    onEnd: e => { e.vx = e.vy = 0; const a = e._wtAwk; e._wtAwk = null; if (a) for (const M of a.ms) if (M.fx) M.fx.t = M.fx.dur; } }) });
function summonAreaOwner(e, x, y, r, h, zMax = 120) { for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && inGround(t, x, y, r) && t.z < zMax && (t.st !== 'down' || h.downHit !== false)) applyHit(e, t, { type: 'indep', sure: true, downHit: true, ...h, box: null }, { proj: true, src: { x: x - e.face * 10, y, z: 0, face: e.face } }); }
// 南瓜跑者：沿地面向外跑，碰到敌人爆炸
function wtRunner(e, x, y, dx, dy, dmg) {
  spawnProj({ owner: e, x, y, z: 0, vx: dx * 300, vy: dy * 150, face: dx >= 0 ? 1 : -1, life: 1.1, w: 12, d: 12, h: 30, pierce: false, hit: { dmg, launch: 260, knock: 60, hs: 0.04, type: 'indep', elem: 'fire', col: '#ffb060' },
    onEnd(q) { fxBurst(q.x, q.y, 20, 80, '#ffb060'); summonAreaOwner(e, q.x, q.y, 50, { dmg: dmg * 0.6, launch: 200, knock: 40, hs: 0.03, elem: 'fire' }); },
    draw(c, q) { drawSpr(c, IMG['fx/jack'] ? 'jack' : 'fireball', sx(q.x), sy(q.y, 14 + Math.abs(Math.sin(q.t * 18)) * 8), 0, 30, { add: false, flip: q.face < 0 }); } });
}
// ---- 超级苍蝇拍：更大的苍蝇拍，单次攻击；召唤几率 40% ----
defSkill('wt_superswat', { name: '超级苍蝇拍', cls: 'mage', job: WT, lvReq: 23, mp: 90, cd: 25, type: 'indep', elem: 'dark', col: '#6a3a9a', air: true,
  desc: '抡起巨大的苍蝇拍狠狠拍下（霸体，身后到前方的大范围，能打到倒地的敌人），有几率诅咒。命中时有 40% 几率召出变异怪（超大成功且学了魔道学助手时召出助手）。可以空中施放。',
  pow: lv => wtLv(lv, 8.0, 0.8), ai: { kind: 'burst', r: [0, 170], dy: 60 },
  act: (lv, p) => airOr(p, { name: 'wt_superswat', clip: 'swat', dur: 0.75, superArmor: true, cancelFrom: 0.6, onStart: e => fxCharge(e, '#c79aff', 6), events: [evAt(0.28, e => swatHit(e, lv, true))] }, { clip: 'swatAir', lowGrav: 0.15 }) });
// ---- 光电兔：操纵兔子造型的机械放出高压电（多段攻击 + 强硬直），结束时爆炸 ----
machDef('rabbit', { name: '光电兔', h: 118, w: 26, col: '#fff38a' });
const RABBIT_SEAT = [-14, 64];
defSkill('wt_rabbit', { name: '光电兔', cls: 'mage', job: WT, lvReq: 25, mp: 110, cd: 50, type: 'indep', elem: 'light', col: '#f0e060', cast: true,
  desc: '坐上兔子造型的机械，朝前方放出高压电（多段攻击 + 强硬直，命中必定感电），方向键可以慢慢移动，约 3.5 秒后爆炸。大成功电流更粗、范围更大。失败：短路，只放出一小段电。学了引爆实验可以按跳跃键提前引爆。',
  pow: lv => wtLv(lv, 0.4, 0.04) * 28 + wtLv(lv, 3.0, 0.3), ai: { kind: 'burst', r: [0, 240], dy: 40 },
  act: (lv, p) => rideAct(lv, p, { id: 'wt_rabbit', key: 'wt_rabbit', fam: 'eel', dur: 3.5, failDur: 1.2, dx: 30,
    seat: () => RABBIT_SEAT, pose: () => 'brIdle',
    input: (e, I, a) => { a.mx = I.dx(); a.my = I.dy(); },
    ride: (e, a, m, k, dt) => { const R = game.room; if (!isHuman(e)) { const t = nearestFoe(m, 400); a.my = t ? Math.sign(t.y - m.y) * (Math.abs(t.y - m.y) > 8 ? 1 : 0) : 0; }
      m.x += (a.mx || 0) * 70 * dt; m.y = clamp(m.y + (a.my || 0) * 70 * dt, 6, DEPTH - 6); if (R) m.x = clamp(m.x, R.x0 + 30, R.x1 - 30); if (a.mx && a.mx !== m.face && k > 0.2) m.face = a.mx;
      mClip(m, 'zap'); const i = Math.floor(k / 0.125); if (i === a.hk) return; a.hk = i; const W = craftBig(a.r) ? 1.3 : 1;
      fxBeam(m.x + m.face * 30, m.y, 70, 260 * W, m.face, { col: '#fff38a', w: 44 * W, dur: 0.14 }); if (i % 3 === 0) sfx.zap();
      for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && (t.x - m.x) * m.face > 0 && Math.abs(t.x - m.x) < 290 * W && Math.abs(t.y - m.y) < 36 * W && t.z < 150 && summonHit(m, t, { dmg: wtLv(lv, 0.4, 0.04), stun: 1.2, knock: 0, hs: 0.02, type: 'indep', elem: 'light', downHit: true }) && !hasStatus(t, 'shock')) addStatus(t, 'shock', 3, { src: e }); },   // 高压电：命中必定感电
    fail: (e, a, m, k) => { if (a.oops) return; a.oops = true; mClip(m, 'fail'); fxBeam(m.x + m.face * 30, m.y, 70, 120, m.face, { col: '#fff38a', w: 30, dur: 0.3 }); summonArea(m, m.x + m.face * 80, m.y, 60, { dmg: wtLv(lv, 2.0, 0.2), stun: 0.8, hs: 0.04, type: 'indep', elem: 'light' }); witchOops(e, 'zap', 1.0); },
    boom: (e, a) => ({ dmg: wtLv(lv, 3.0, 0.3), elem: 'light', col: '#fff38a', r: 130 }) }) });
// ---- 贤者之石（二觉被动）：结果档位变成 失败 / 大成功 / 超大成功；魔法秀变为永久生效 ----
defSkill('wt_stone', { name: '贤者之石', cls: 'mage', job: WT, lvReq: 26, maxLv: 1, passive: true, type: 'indep', col: '#ff5a8a',
  desc: '【被动 · 二觉】炼成了贤者之石：技能的结果档位变成“失败 / 大成功 / 超大成功”（原来的成功都变成大成功，大成功变成超大成功）；魔法秀变为永久生效。' });
{ const S = SKILLS.mg_showtime; if (S && S.act) { const f = S.act; S.act = (lv, p) => { const a = f(lv, p), s0 = a.onStart; a.onStart = e => { if (s0) s0(e); if (isWitch(e) && hasSkill(e, 'wt_stone') && e.buffs.mg_showtime) e.buffs.mg_showtime.t = 1e9; }; return a; }; } }
// ---- 魔道学助手（二觉被动）----
defSkill('wt_helper', { name: '魔道学助手', cls: 'mage', job: WT, lvReq: 26, maxLv: 1, passive: true, type: 'indep', col: '#e0a0ff',
  desc: '【被动 · 二觉】四只使魔被改造成人造人助手：电鳗碰撞机、反重力装置改由助手放置（放完你就可以走开）；变异苍蝇拍 / 超级苍蝇拍超大成功时召出一只助手协同作战 30 秒。' });
// ---- 雪人刨冰：刨冰机冻住范围内的敌人并拉到中心，主角抓着摇杆跟机器一起转（无敌），约 5 秒后爆炸 ----
machDef('shaved', { name: '雪人刨冰机', h: 120, w: 28, col: '#bfefff' });
defSkill('wt_shaved', { name: '雪人刨冰', cls: 'mage', job: WT, lvReq: 26, mp: 120, cd: 40, type: 'indep', elem: 'ice', col: '#9fe6ff', cast: true,
  desc: '放下雪人刨冰机：冻住范围内的敌人并把它们拉到中心，刀片不断切削（连按技能键 / Z / X 转得更快），刨出的冰沙四处飞溅砸到周围的敌人；主角抓着摇杆跟机器一起转（无敌），约 5 秒后爆炸。大成功范围更大。失败：刨冰机卡住，只喷出一小团冰。',
  pow: lv => wtLv(lv, 0.5, 0.05) * 20 + wtLv(lv, 4.0, 0.4), ai: { kind: 'aoe', r: [0, 220], dy: 80 },
  act: (lv, p) => { const A = rideAct(lv, p, { id: 'wt_shaved', key: 'wt_shaved', fam: 'snow', dur: 5, failDur: 1.2, dx: 60,
    seat: (e, a, m) => [Math.cos(game.t * 9) * 36, 30], pose: () => 'brSpin',
    start: (e, a, m) => { a.frz = new Set(); },
    ride: (e, a, m, k, dt) => { mClip(m, 'spin'); e.drawFlip = Math.cos(game.t * 9) < 0; const Rr = 220 * (craftBig(a.r) ? 1.25 : 1);
      for (const t of ents) if (foe(e, t) && !t.dead && inGround(t, m.x, m.y, Rr)) { if (!t.boss) { t.x = damp(t.x, m.x + Math.cos(t.id) * 30, 2.5, dt); t.y = damp(t.y, m.y + Math.sin(t.id) * 12, 2.5, dt); } if (!a.frz.has(t)) { a.frz.add(t); addStatus(t, 'freeze', 1.5, { src: e }); } }
      if (Math.random() < 0.4) fxSpr('frost', m.x + rnd(-80, 80), m.y + rnd(-20, 20), 0, { w: 50, dur: 0.4, ay: 0.75 });
      a.fast = Math.max(0, (a.fast || 0) - dt); a.bT = (a.bT || 0) + dt * (a.fast > 0 ? 1.8 : 1);   // 连按：刀片转得更快
      if (a.bT >= 0.25) { a.bT -= 0.25; summonArea(m, m.x, m.y, Rr * 0.7, { dmg: wtLv(lv, 0.5, 0.05), stun: 0.4, knock: 0, hs: 0.02, type: 'indep', elem: 'ice', downHit: true }, { zMax: 160 }); }
      a.iceT = (a.iceT ?? 0.4) - dt; if (a.iceT <= 0) { a.iceT = 0.6;   // 刨出来的冰沙四处飞溅，砸到周围的敌人
        for (let n = 0; n < 3; n++) { const ang = rnd(0, TAU), d = Rr * rnd(0.6, 1.25), tx = m.x + Math.cos(ang) * d, ty = clamp(m.y + Math.sin(ang) * d * 0.45, 6, DEPTH - 6);
          lobProj(m, tx, ty, 0.5, { img: 'icespike', h: 16, z0: 90, vz: 220, onLand: pr => { fxSpr('frost', pr.x, pr.y, 0, { w: 50, dur: 0.35, ay: 0.75 }); summonArea(m, pr.x, pr.y, 50, { dmg: wtLv(lv, 0.3, 0.03), stun: 0.3, knock: 30, hs: 0.02, type: 'indep', elem: 'ice', downHit: true }, { zMax: 100 }); } }); } } },
    input: (e, I, a) => { if (wtMash(e, I, 'wt_shaved')) a.fast = 0.35; },
    fail: (e, a, m, k) => { if (a.oops) return; a.oops = true; mClip(m, 'fail'); fxSpr('frost', m.x, m.y, 0, { w: 120, dur: 0.5, ay: 0.75 }); summonArea(m, m.x, m.y, 100, { dmg: wtLv(lv, 2.0, 0.2), stun: 0.6, hs: 0.04, type: 'indep', elem: 'ice' }); a.fell = true; e.scale = 1; e.z = 0; e.x = m.x - m.face * 60; witchOops(e, 'soot', 1.0); },
    boom: (e, a) => ({ dmg: wtLv(lv, 4.0, 0.4), elem: 'ice', col: '#bfefff', r: 170 }) });
    A.invul = true; return A; } });
// ---- 超级棒棒糖（糖拍）：巨型棒棒糖砸下，每命中一个敌人生成一个糖果人偶（最多 10 个）：黑色 = 暗属性 + 致盲，白色 = 光属性 + 感电；人偶自动追敌自爆，会跟着进下一个房间 ----
defSummon('wt_candy', { kind: 'follower', name: '糖果人偶', bundle: 'candyDoll', model: () => candyModel(false), clips: WT_CLIPS.candyDoll, w: 9, d: 9, h: 46, speed: 220, runSpeed: 300, pref: 0, sight: 600,
  life: 25, max: 10, col: '#ff9ad0', type: 'indep', attacks: [], shadowR: 10,
  ai: (s, dt) => { s.arm = (s.arm ?? 0.7) - dt; if (s.arm > 0) { s.vx = s.vy = 0; s.setState('idle'); s.z = Math.max(0, Math.sin(s.arm / 0.7 * Math.PI) * 30); return; } const t = nearestFoe(s, 700); if (!t) { const o = s.owner, gx = o.x - o.face * (40 + (s.slot % 5) * 12), dx = gx - s.x; s.vx = Math.abs(dx) > 10 ? Math.sign(dx) * 200 : 0; s.vy = (o.y - s.y) * 2; s.setState(s.vx ? 'walk' : 'idle'); if (s.vx) s.face = Math.sign(s.vx); return; }
    const dx = t.x - s.x, dy = t.y - s.y, l = Math.hypot(dx, dy * 1.4) || 1; s.vx = dx / l * 230; s.vy = dy / l * 160; s.face = Math.sign(dx) || s.face; s.setState('run');
    if (l < 30 && !s.pop) { s.pop = true; const w = s.white; fxBurst(s.x, s.y, 30, 110, w ? '#fff6c0' : '#8a5ab0'); sfx.boom(0.35);
      summonArea(s, s.x, s.y, s.big ? 110 : 64, { dmg: s.dmg, launch: 260, knock: 80, hs: 0.05, type: 'indep', elem: w ? 'light' : 'dark', downHit: true }, { zMax: 140, status: w ? 'shock' : 'blind', sdur: 4 }); dismissOne(s, 'cmd'); } } });
defSkill('wt_lollipop', { name: '超级棒棒糖', cls: 'mage', job: WT, lvReq: 26, mp: 130, cd: 45, type: 'indep', elem: 'dark', col: '#ff7ac0', air: true,
  desc: '举起巨型棒棒糖狠狠砸下（地面、空中都能放）。每命中一个敌人就生成一个糖果人偶，被这一下砸死的敌人再多变出一个（领主 / 精英变成更强的大号暗黑人偶），最多 10 个：黑色人偶是暗属性、附带致盲，白色人偶是光属性、附带感电。人偶会自动追着敌人自爆，还会跟着你进下一个房间。',
  pow: lv => wtLv(lv, 7.0, 0.7) + wtLv(lv, 1.0, 0.1) * 5, ai: { kind: 'burst', r: [0, 190], dy: 60 },
  act: (lv, p) => airOr(p, { name: 'wt_lollipop', clip: 'candy', dur: 0.85, superArmor: true, cancelFrom: 0.7,
    events: [evAt(0.34, e => { const r = rollCraft(e, 'cat'), K = Math.min(CRAFT_K[r], 1.3), air = e.z > 2, gx = e.x + e.face * 110; cam.shake = Math.max(cam.shake, 8); sfx.boom(1);
      fxSpr(IMG['fx/wt_lollipop'] ? 'wt_lollipop' : 'orb', gx, e.y, 0, { w: 190 * K, dur: 0.5, ay: 0.95, add: !IMG['fx/wt_lollipop'], col: IMG['fx/wt_lollipop'] ? null : '#ff9ad0', grow: [1.2, 1] }); fxShock(gx, e.y, 240 * K, '#ff9ad0');
      const hit = []; instantHit(e, HB(0, 1, [-20, 200 * K, 60 * K, air ? -e.z - 20 : -10, 220], wtLv(lv, 7.0, 0.7) * (r === 'fail' ? 0.7 : 1), { launch: 300, knock: 120, hs: 0.12, big: 2, shake: 6, snd: 'blunt', downHit: true, type: 'indep', elem: 'dark', onHit: (A, t) => hit.push(t) }));
      // 命中的每个敌人 1 个；被砸死的再加 1 个（领主 / 精英 = 大号暗黑人偶，算 3 个）
      const L = hit.slice(0, r === 'fail' ? Math.ceil(hit.length / 2) : hit.length).map(t => ({ t, big: false }));
      for (const t of hit) if (t.dead) L.push({ t, big: !!(t.boss || t.elite) });
      let room = 10 - summonsOf(e, 'wt_candy').reduce((n, s) => n + (s.big ? 3 : 1), 0), i = 0;
      for (const d of L) { const w = d.big ? 3 : 1; if (room < w) continue; room -= w;
        const s = summon(e, 'wt_candy', { x: (d.t.dead ? d.t.x : gx - e.face * rnd(0, 70)), y: clamp((d.t.dead ? d.t.y : e.y) + rnd(-20, 20), 6, DEPTH - 6), lv }); if (!s) continue;
        s.big = d.big; s.white = !d.big && i++ % 2 === 1; s.dmg = wtLv(lv, 1.0, 0.1) * (d.big ? 2.3 : 1); s.model = candyModel(s.white); if (d.big) s.scale = 1.6; } })] }) });
// 糖果人偶的模型：黑色 = 原图，白色 = 提亮去饱和（同一套帧）
function candyModel(white) { if (typeof SPR_DATA === 'undefined' || !SPR_DATA.candyDoll || !IMG['spr/candyDoll/idle']) return wtSprite('', white ? '#fff6c0' : '#8a5ab0');
  return new SpriteModel('candyDoll', { _: 'idle', walk: 'walk1', run: 'walk1' }, MACH_ANIMS.candyDoll, white ? { sat: 0.15, bright: 1.9 } : {}); }
// ---- 乌洛波洛斯之环（二觉）：衔尾蛇造型的环形履带载具，四只助手坐在上面；方向键移动，吸附并强控范围内的敌人，结束时爆炸 ----
machDef('ouro', { name: '乌洛波洛斯之环', h: 150, w: 44, d: 20, col: '#ff5a8a', life: 10 });
const OURO_SPARK = [['fire', '#ff9a50'], ['ice', '#bfefff'], ['light', '#fff38a'], ['dark', '#c79aff']];   // 四只助手各放自己属性的火花
defSkill('wt_awaken2', { name: '乌洛波洛斯之环', cls: 'mage', job: WT, lvReq: 27, maxLv: 3, mp: 200, cd: 170, pvp: 0.45, type: 'indep', awaken: true, col: '#ff5a8a',
  desc: '【觉醒 · 二觉】召出衔尾蛇造型的环形履带载具，四只助手坐在上面驾驶。方向键上下左右移动，把附近的敌人拖到环中央抓住（不能动弹）、不断碾压，助手们还会朝周围放出火 / 冰 / 光 / 暗四色火花；连按 X 转得更快。约 7 秒后、再按一次技能键或按跳跃键时大爆炸。施放中无敌。',
  pow: lv => wtLv(lv, 50, 12), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv, p) => { const D = wtLv(lv, 50, 12), A = rideAct(lv, p, { id: 'wt_awaken2', key: 'wt_ouro', fam: 'cat', noFail: true, dur: 7, dx: 40,
    seat: () => [0, 104], pose: () => 'brIdle',
    start: (e, a, m) => wtCutin(e, '乌洛波洛斯之环', 2),
    input: (e, I, a) => { a.mx = I.dx(); a.my = I.dy(); const sl = barOf(e).indexOf('wt_awaken2');
      if (I.buffered('attack')) { I.consume('attack'); a.fast = 0.35; }
      const early = e.actT - (a.t0 || 0) < 1.0;   // 开头 1 秒内的连按不算（防止双击觉醒键直接结束）
      if (I.buffered('jump') || (sl >= 0 && I.buffered('s' + sl))) { I.consume('jump'); if (sl >= 0) I.consume('s' + sl); if (!early) a.dur = e.actT; } },
    ride: (e, a, m, k, dt) => { const R = game.room; if (!isHuman(e)) { const t = nearestFoe(m, 500); a.mx = t ? Math.sign(t.x - m.x) * (Math.abs(t.x - m.x) > 40 ? 1 : 0) : 0; a.my = t ? Math.sign(t.y - m.y) * (Math.abs(t.y - m.y) > 10 ? 1 : 0) : 0; }
      m.x += (a.mx || 0) * 190 * dt; m.y = clamp(m.y + (a.my || 0) * 120 * dt, 6, DEPTH - 6); if (R) m.x = clamp(m.x, R.x0 + 50, R.x1 - 50); if (a.mx) m.face = a.mx;
      a.fast = Math.max(0, (a.fast || 0) - dt); mClip(m, a.mx || a.my || a.fast > 0 ? 'move' : 'grab');
      for (const t of ents) if (foe(e, t) && !t.dead && inGround(t, m.x, m.y, 190)) { if (!t.boss) { t.x = damp(t.x, m.x, 4, dt); t.y = damp(t.y, m.y, 4, dt); } addStatus(t, 'root', 0.3, { src: e, force: true }); }
      a.cT = (a.cT || 0) + dt * (a.fast > 0 ? 1.5 : 1);   // 碾压：平时 0.21 秒一段，连按 X 0.14 秒一段
      if (a.cT >= 0.21) { a.cT -= 0.21; a.cn = (a.cn || 0) + 1; summonArea(m, m.x, m.y, 150, { dmg: D * 0.012, stun: 0.4, knock: 0, hs: 0.02, type: 'indep', elem: 'dark', downHit: true, sure: true }, { zMax: 200 }); if (a.cn % 4 === 0) fxShock(m.x, m.y, 150, '#ff9ad0'); }
      a.sT = (a.sT ?? 0.3) - dt; if (a.sT <= 0) { a.sT = 0.45;   // 四色火花：每只助手各挑一个不同的敌人
        const L = ents.filter(t => foe(e, t) && !t.dead && t.invul <= 0 && Math.abs(t.x - m.x) < 340 && Math.abs(t.y - m.y) < 110).sort(() => Math.random() - 0.5);
        OURO_SPARK.forEach(([el, col], n) => { const t = L[n], tx = t ? t.x : m.x + rnd(-260, 260), ty = t ? t.y : clamp(m.y + rnd(-70, 70), 6, DEPTH - 6);
          lobProj(m, tx, ty, 0.3, { img: fxTint('orb', col), add: true, h: 18, z0: 120, vz: 160, onLand: pr => { fxBurst(pr.x, pr.y, 10, 50, col); if (t) summonArea(m, pr.x, pr.y, 36, { dmg: D * 0.006, stun: 0.3, knock: 10, hs: 0.02, type: 'indep', elem: el, downHit: true }, { zMax: 120 }); } }); }); } },
    boom: (e, a) => { for (const t of ents) if (foe(e, t)) unroot(t); return { dmg: D * 0.45, elem: 'dark', col: '#ff9ad0', r: 240 }; } });
    A.invul = true; return A; } });
// ---- 粉红糖果（三觉被动）：暗影斗篷进化成夜猫助手；魔道酸雨云进化成会追击敌人的冰霜云 ----
defSkill('wt_pink', { name: '粉红糖果', cls: 'mage', job: WT, lvReq: 29, maxLv: 1, passive: true, type: 'indep', col: '#ff9ad0',
  desc: '【被动 · 三觉】把贤者之石加工成粉红糖果喂给使魔：暗影斗篷进化成夜猫助手（扑到身前变成斗篷卷住敌人，再向四面伸出长腿，把斗篷外面够得着的敌人也拖进来）；魔道酸雨云进化成冰霜云（追着附近最强的敌人走，落下冰雹和冰锥，附带减速、几率冰冻，持续 8 秒）。' });
// ---- 糖果大作战：捣蛋杰克：巨型南瓜助手跟在身后，朝它面朝的方向喷岩浆；再按一次技能键让它转身 ----
defSummon('wt_trickjack', { kind: 'follower', name: '捣蛋杰克', bundle: 'trickjack', model: () => wtSprite('trickjack', '#ff9a50'), clips: WT_CLIPS.trickjack, w: 24, d: 16, h: 140, speed: 200, runSpeed: 320, pref: 0, sight: 0,
  life: 10, max: 1, col: '#ff9a50', type: 'indep', attacks: [], shadowR: 30, keepRoom: false,
  onSpawn: s => { s.dir = s.owner.face; s.fireT = 0.5; },
  ai: (s, dt) => { const o = s.owner, gx = o.x - s.dir * 70, dx = gx - s.x; s.vx = Math.abs(dx) > 10 ? clamp(dx * 4, -320, 320) : 0; s.vy = (o.y - 4 - s.y) * 4; s.face = s.dir;
    s.fireT -= dt; if (s.clipName !== 'spray') s.play(s.vx ? 'walk' : 'idle'); if (s.fireT > 0) return; s.fireT = 0.35; s.play('spray', true); sfx.flame ? sfx.flame() : sfx.hit('fire', false);
    fxBeam(s.x + s.face * 40, s.y, 80, 280, s.face, { img: 'flame', col: '#ff7a2a', w: 70, dur: 0.3 });
    const G = hitGroup(0.3); for (let i = 1; i <= 3; i++) summonArea(s, s.x + s.face * (70 * i), s.y, 60, { dmg: s.dmg, stun: 0.3, launch: i === 3 ? 180 : 0, knock: 40, hs: 0.03, type: 'indep', elem: 'fire', downHit: true }, { zMax: 140, hitGroup: G }); } });
defSkill('wt_trickjack', { name: '糖果大作战：捣蛋杰克', cls: 'mage', job: WT, lvReq: 29, mp: 150, cd: 40, type: 'indep', elem: 'fire', col: '#ff8a3a', cast: true,
  desc: '召出巨型南瓜助手捣蛋杰克，10 秒内跟在你身后，不断朝它面朝的方向喷出岩浆。再按一次技能键让它转身。大成功喷得更凶。',
  pow: lv => wtLv(lv, 0.5, 0.05) * 3 * 28, ai: { kind: 'buff', summon: 'wt_trickjack' },
  recast: { ok: p => summonsOf(p, 'wt_trickjack').length > 0, cd: 0.4, mp: 0, act: () => ({ name: 'wt_turn', clip: 'wtCheer', dur: 0.2, noCounter: true, onStart: e => { for (const s of summonsOf(e, 'wt_trickjack')) { s.dir = -s.dir; s.play('turn', true); } } }) },
  act: (lv) => ({ name: 'wt_trickjack', clip: 'wtCheer', dur: 0.5, cancelFrom: 0.36, events: [evAt(0.18, e => { const r = rollCraft(e, 'jack'), s = summon(e, 'wt_trickjack', { x: e.x - e.face * 70, y: e.y, lv });
    if (s) { s.dmg = wtLv(lv, 0.5, 0.05) * (r === 'fail' ? 0.6 : craftBig(r) ? 1.25 : 1); fxSigil('hexagram', s.x, s.y, 0, { w: 150, dur: 0.6, ay: 0.5, grow: [0.3, 1], col: '#ff9a50' }); } })] }) });
// ---- 糖果大作战：精怪乐园（三觉）：过山车“精怪号”——夜猫铺轨道，雪人开车、光电鳗供电、杰克拉杆；列车横穿整个画面一路往四处喷熔岩（每个敌人约 8 段），
//      冲到画面边上飞上高空，再一头扎下来脱轨，在最强的敌人头上砸出 4 连彩色爆炸；主角头朝下插进了地里 ----
const COASTER_T = { lay: 0.9, go: 1.5, climb: 3.5, dive: 4.0, crash: 4.5 };
defSkill('wt_awaken3', { name: '糖果大作战：精怪乐园', cls: 'mage', job: WT, lvReq: 30, maxLv: 3, mp: 250, cd: 270, pvp: 0.45, type: 'indep', awaken: true, col: '#ff5ab0',
  desc: '【觉醒 · 三觉】过山车“精怪号”发车：夜猫铺好轨道，雪人开车、光电鳗供电、杰克拉杆，列车横穿整个画面一路往四处喷熔岩，冲到尽头飞上高空，再一头扎下来脱轨，砸出 4 连彩色大爆炸（落在最强的敌人头上）。施放中无敌（结束时主角头朝下插进了地里）。',
  pow: lv => wtLv(lv, 80, 20), ai: { kind: 'awaken', r: [0, 480], dy: 110 },
  act: (lv) => ({ name: 'wt_awaken3', clip: 'wtCheer', dur: 5.9, superArmor: true, invul: true, noCounter: true,
    onStart: e => { wtCutin(e, '精怪乐园', 3); const R = game.room, a = e.act; a.y = e.y; a.x0 = R ? Math.max(R.x0, cam.x) - 120 : e.x - 600; a.x1 = R ? Math.min(R.x1, cam.x + WW) + 120 : e.x + 600; if (e.face < 0) [a.x0, a.x1] = [a.x1, a.x0]; a.dir = Math.sign(a.x1 - a.x0) || 1; a.hk = -1;
      a.fx = addFx({ y: a.y - 3, dur: 5.9, a, draw(c) { const A = this.a, t = this.t, T = COASTER_T, k = clamp((t - T.lay) / 0.5, 0, 1), Y = sy(A.y, 0);
        // 轨道（夜猫铺出来的）
        if (t > T.lay && !(t > T.crash)) { c.save(); c.strokeStyle = '#6a4a2a'; c.lineWidth = 5; c.beginPath(); c.moveTo(sx(A.x0), Y - 4); c.lineTo(sx(A.x0 + (A.x1 - A.x0) * k), Y - 4); c.stroke(); c.strokeStyle = '#c0a060'; c.lineWidth = 2; for (let x = 0; x < Math.abs(A.x1 - A.x0) * k; x += 26) { const X = sx(A.x0 + A.dir * x); c.beginPath(); c.moveTo(X, Y - 10); c.lineTo(X, Y + 2); c.stroke(); } c.restore();
          if (k < 1) wtFrame(c, 'helperCat', 'walk' + (1 + Math.floor(t * 12) % 4), A.x0 + (A.x1 - A.x0) * k, A.y, 0, 1, A.dir, { col: '#c79aff', fh: 60 }); }
        // 列车：横穿 → 爬升 → 俯冲 → 脱轨爆炸
        if (A.cx === undefined) return;
        const f = t < T.climb ? 'ride' + (1 + Math.floor(t * 10) % 3) : t < T.dive ? 'climb' : t < T.crash ? 'dive' : t < T.crash + 0.25 ? 'derail' : 'boom';
        if (t < T.crash + 0.7) wtFrame(c, 'coaster', f, A.cx, A.cy ?? A.y, A.cz, 1, A.cf || A.dir, { col: '#ff9ad0', fh: 130, rot: t >= T.crash && t < T.crash + 0.25 ? (t - T.crash) * 3 : 0 }); } }); },
    update: (e, dt) => { const a = e.act, t = e.actT, T = COASTER_T, D = wtLv(lv, 80, 20); e.vx = e.vy = 0;
      if (t >= T.go && t < T.climb) { const u = (t - T.go) / (T.climb - T.go); a.cx = a.x0 + (a.x1 - a.dir * 260 - a.x0) * u; a.cz = 10 + Math.abs(Math.sin(t * 14)) * 4; a.cf = a.dir;
        const i = Math.floor((t - T.go) / 0.25); if (i !== a.hk) { a.hk = i;   // 熔岩往四处喷：轨道一带的敌人每 0.25 秒一段
          const lo = Math.min(a.x0, a.x1), hi = Math.max(a.x0, a.x1);
          for (const m of ents) if (foe(e, m) && !m.dead && m.invul <= 0 && m.x > lo && m.x < hi && Math.abs(m.y - a.y) < 150 && m.z < 260) applyHit(e, m, { dmg: D * 0.03, stun: 0.35, launch: 120, knock: 30 * a.dir, hs: 0.02, type: 'indep', elem: 'fire', sure: true, downHit: true }, { proj: true, src: { x: a.cx, y: a.y, z: 0, face: a.dir } });
          for (let n = 0; n < 3; n++) { const tx = a.cx + a.dir * rnd(-260, 320), ty = clamp(a.y + rnd(-120, 120), 6, DEPTH - 6);
            spawnProj({ owner: e, x: a.cx, y: a.y, z: 90, vx: (tx - a.cx) / 0.5, vy: (ty - a.y) / 0.5, vz: 300, grav: 1560, life: 0.5, w: 8, d: 8, h: 10, face: a.dir, pierce: true, hit: null,
              onEnd(q) { fxSpr('flame', q.x, q.y, 0, { w: 60, dur: 0.6, ay: 1 }); }, draw(c, q) { drawSpr(c, 'fireball', sx(q.x), sy(q.y, q.z), 0, 20, { add: true }); } }); } } }
      if (t >= T.climb && t < T.dive) { const v = (t - T.climb) / (T.dive - T.climb); a.cx = a.x1 - a.dir * 260 * (1 - v); a.cz = 10 + 340 * v * v; if (!a.aim) { const S = strongestFoe(e, 900); a.xc = S ? S.x : (a.x0 + a.x1) / 2; a.yc = S ? S.y : a.y; a.aim = true; } }
      if (t >= T.dive && t < T.crash) { const v = (t - T.dive) / (T.crash - T.dive); a.cx = a.x1 + (a.xc - a.x1) * v; a.cy = a.y + (a.yc - a.y) * v; a.cz = 350 * (1 - v * v); a.cf = Math.sign(a.xc - a.x1) || -a.dir; }
      if (t >= T.crash && !a.crash) { a.crash = true; a.cx = a.xc; a.cy = a.yc; a.cz = 0; cam.shake = 14; cam.flash = 0.3; cam.flashCol = '#ffd0e0'; witchOops(e, 'fall', 1.3);
        ['#ff9ad0', '#fff38a', '#8ae0ff', '#c79aff'].forEach((col, n) => game.after(n * 0.12, () => { sfx.boom(n === 3 ? 1.4 : 0.9); fxBurst(a.xc + rnd(-60, 60), a.yc, 60, 300 + n * 40, col); fxSpr('explosion', a.xc + rnd(-40, 40), a.yc, 0, { w: 260 + n * 40, dur: 0.6, ay: 0.85 });
          for (const m of ents) if (foe(e, m) && !m.dead && Math.abs(m.x - a.xc) < 330 && Math.abs(m.y - a.yc) < 140) applyHit(e, m, { dmg: D * 0.095, stun: 0.5, launch: n === 3 ? 720 : 200, knock: n === 3 ? 260 : 40, hs: n === 3 ? 0.14 : 0.05, big: n === 3 ? 2.4 : 1.2, type: 'indep', elem: ['fire', 'light', 'ice', 'dark'][n], sure: true, downHit: true }, { proj: true, src: { x: a.xc, y: a.yc, z: 0, face: e.face } }); })); } } }) });
/* =====================================================================
   转职登记、指令、被动刷新、素材预加载
   ===================================================================== */
CLASSES.mage.jobs.witch = { art: 'job/witch', name: '魔道学者', role: '中距离 · 机械 / 使魔', armor: 'leather', awaken: 'wt_awaken', awakenName: '魔术师', trial: 'q_job_witch_2',
  desc: '好奇心旺盛、迷恋科学的魔法师。骑扫把从空中袭击，扔药瓶、放酸雨、搭乘自己发明的魔道机械作战；技能有失败 / 成功 / 大成功，失败了会被熏黑、摔个狗吃屎。伤害是独立攻击。',
  skills: ['wt_broom', 'wt_affinity', 'wt_book', 'wt_shululu', 'wt_missile', 'wt_cloak', 'wt_powder', 'wt_lucky', 'wt_swatter', 'wt_lava', 'wt_acid', 'wt_swatlock', 'wt_spin', 'wt_tesla', 'wt_bitter', 'wt_furnace',
    'wt_antigrav', 'wt_detonate', 'wt_drill', 'wt_premonition', 'wt_awaken', 'wt_superswat', 'wt_rabbit', 'wt_stone', 'wt_helper', 'wt_shaved', 'wt_lollipop', 'wt_awaken2', 'wt_pink', 'wt_trickjack', 'wt_awaken3'] };
CLASSES.mage.cmds.push(['uu', 'wt_shululu'], ['fdf', 'wt_missile'], ['fd', 'wt_cloak'], ['ud', 'wt_powder', 'buff'], ['dd', 'wt_book', 'buff'], ['bdf', 'wt_swatter'], ['udu', 'wt_lava'], ['udd', 'wt_acid'], ['holdd', 'wt_spin'],
  ['bff', 'wt_tesla'], ['uff', 'wt_furnace'], ['dfd', 'wt_antigrav'], ['fuf', 'wt_drill'], ['uudd', 'wt_awaken'], ['bfb', 'wt_superswat'], ['dbf', 'wt_rabbit'], ['fdb', 'wt_shaved'], ['ffd', 'wt_lollipop'], ['dduu', 'wt_awaken2'],
  ['bdb', 'wt_trickjack'], ['uuddf', 'wt_awaken3']);
// ---- 被动刷新（每 0.25 秒）----
CLASSES.mage.passives.push(p => {
  const wt = isWitch(p);
  if (wt) { const want = p.buffs.wt_powder ? WITCH_ACTS_P : WITCH_ACTS; if (p.acts !== want) p.acts = want; }
  else if (p.acts === WITCH_ACTS || p.acts === WITCH_ACTS_P) p.acts = MAGE_ACTS;
  p._ride = wt && witchRides(p);
  if (!wt) { p.airBonus = p._wtAir ? 0 : p.airBonus; p._wtAir = false; return; }
  witchModel(p);
  const br = skLv(p, 'wt_broom'); setPassive(p, 'wt_broom', br > 0, { cspd: 0.1 + 0.015 * br }); if (br > 0) p.hitRate = Math.max(p.hitRate || 0, 0.05);
  p.airBonus = p._ride ? 5 : 0; p._wtAir = true;
  if (p.z <= 0.01) { p._dashN = 0; p._glideN = 0; p._gliding = false; }
  const lu = skLv(p, 'wt_lucky'); setPassive(p, 'wt_lucky', lu > 0, { dmg: 0.03 + 0.01 * lu });
  const pr = skLv(p, 'wt_premonition'); setPassive(p, 'wt_premonition', pr > 0, { crit: 0.05 + 0.005 * pr, critDmg: 0.05 + 0.01 * pr });
  if (p._oopsT > 0) { p._oopsT -= 0.25; if (p._oopsT <= 0 && p.st === 'act' && p.act && p.clipName === p._oopsClip) p.play(p.act.clip || p.act.name); }
  if (p.buffs.wt_candy && !p._candyFx) p._candyFx = addFx({ y: p.y, dur: 1e9, p, update() { const P = this.p; this.y = P.y + 0.7; if (!P.buffs.wt_candy || P.dead) { this.t = this.dur; P._candyFx = null; } },
    draw(c) { const P = this.p, X = sx(P.x), Y = sy(P.y, P.z + 138 + Math.sin(game.t * 4) * 3); if (IMG['icon/wt_candy']) c.drawImage(IMG['icon/wt_candy'], X - 11, Y - 11, 22, 22); else drawSpr(c, fxTint('orb', '#ff9ad0'), X, Y, 18, 18, {}); } });
});
// ---- 美术预加载：魔道学者进城 / 进地下城时加载机械、召唤物的精灵分包 ----
const WT_BUNDLES = ['shululu', 'furnace', 'drill', 'tesla', 'antigrav', 'rabbit', 'shaved', 'ouro', 'trickjack', 'candyDoll', 'coaster', 'wtAwk', 'helperJack', 'helperSnow', 'helperEel', 'helperCat', 'goblin', 'tau'];
function wtPreload() { const p = game.player; if (!isWitch(p) || typeof loadBundles !== 'function' || typeof ASSET_BUNDLE === 'undefined') return; const have = new Set(Object.values(ASSET_BUNDLE));
  const need = WT_BUNDLES.filter(b => have.has('spr:' + b) && !IMG[`spr/${b}/idle`] && !IMG[`spr/${b}/build`]).map(b => 'spr:' + b); if (need.length) loadBundles(need).catch(() => { }); }
bus.on('sceneEnter', wtPreload); bus.on('dungeonEnter', wtPreload);
// ---- 转职成魔道学者：送一把扫把（不拿扫把就不能飞）----
bus.on('jobChange', e => { if (!e || e.job !== WT) return; wtPreload();
  if (typeof inv === 'undefined' || typeof makeItem !== 'function' || !game.player || game.player.cls !== 'mage') return;
  const has = (inv.equip.weapon && inv.equip.weapon.wtype === 'broom') || inv.items.some(it => it && it.wtype === 'broom'); if (has) return;
  const key = Object.keys(ITEMS).filter(k => /^broom_\d+_[01]$/.test(k) && ITEMS[k].lvl <= Math.max(1, game.lvl)).sort((a, b) => ITEMS[b].lvl - ITEMS[a].lvl || ITEMS[b].rar - ITEMS[a].rar)[0];
  const it = key && makeItem(key); if (it && inv.add(it)) toastMsg(`莎兰送给你一把扫把：${it.name}（装备扫把才能骑着飞）`, '#e0c0ff'); });
