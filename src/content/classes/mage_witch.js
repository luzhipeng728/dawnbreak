/* =====================================================================
   转职：魔道学者（魔法师）—— 按国服现版对齐（docs/SKILLS_OFFICIAL_mage.md 3.4）
   伤害类型：独立攻击（智力型）。四只使魔：杰克（火）/ 雪人（冰）/ 光电鳗（光）/ 夜猫（暗）
   成功率：rollCraft(p, fam) → 'fail' | 'ok' | 'great'；失败有搞笑演出（熏黑 / 摔倒 / 触电），苦涩的棒棒糖：按住技能键 0.15 秒强制失败，失败伤害 +50%
   扫把掌握：跳跃中骑扫把（空中 6 连击、缓降、空中冲刺——冲刺 / 缓降需要通用组的 airControl 钩子）
   搭乘机械（加热炉 / 钻孔车 / 电塔）：机械是召唤框架的 follower，魔道学者用自己的帧（带时装）坐在上面；期间免疫异常、受到伤害 −60%，按跳跃（引爆实验）当场引爆
   ===================================================================== */
const WT = 'witch';
const FAM_COL = { jack: '#ff9a50', snow: '#bfefff', eel: '#fff38a', cat: '#c79aff' };
const FAM_NAME = { jack: '杰克', snow: '雪人', eel: '光电鳗', cat: '夜猫' };
const CRAFT_TXT = { fail: '失败…', ok: '成功', great: '大成功！' };
// 成功率：基础 失败 25% / 成功 50% / 大成功 25%；法米利尔亲和、幸运棒棒糖、成功预感（糖果）提高
function rollCraft(p, fam, o = {}) {
  let fail = 0.25, great = 0.25;
  const af = skLv(p, 'wt_affinity'), lu = skLv(p, 'wt_lucky');
  fail -= 0.015 * af + 0.01 * lu; great += 0.02 * af + 0.015 * lu;
  if (p.buffs.wt_candy) { fail = 0; great += 0.35; delete p.buffs.wt_candy; }
  fail = Math.max(0.02, fail); great = Math.min(0.85, great);
  let r = o.force || (Math.random() < fail ? 'fail' : Math.random() < great / (1 - fail) ? 'great' : 'ok');
  // 成功预感：成功后有几率在头顶出现糖果，下一个技能必定成功、更容易大成功
  if (r !== 'fail' && hasSkill(p, 'wt_premonition') && Math.random() < 0.3) { p.buffs.wt_candy = { t: 30 }; fxText('糖果！', p.x, p.y, p.z + 60, { col: '#ff9ad0', size: 10 }); }
  craftPop(p, fam, r);
  return r;
}
// 头顶弹出使魔的结果表情：有图标用图标（icon/wt_fam_<使魔>_<结果>），没有就画一个带颜色的小圆牌
function craftPop(p, fam, r) {
  const col = FAM_COL[fam] || '#fff', key = `icon/wt_fam_${fam}_${r}`;
  addFx({ ent: p, y: p.y + 0.5, dur: 0.9, draw(c) { const e = this.ent, k = this.t / this.dur, X = sx(e.x), Y = sy(e.y, e.z + 118 + k * 16), a = k > 0.75 ? (1 - k) / 0.25 : 1; c.save(); c.globalAlpha = a;
    if (IMG[key]) c.drawImage(IMG[key], X - 16, Y - 16, 32, 32);
    else { c.fillStyle = r === 'fail' ? '#555a66' : r === 'great' ? '#ffd23a' : col; c.beginPath(); c.arc(X, Y, 11, 0, TAU); c.fill(); c.fillStyle = '#222'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText(r === 'fail' ? '×' : r === 'great' ? '★' : '○', X, Y + 4); }
    c.fillStyle = r === 'fail' ? '#b0b8c8' : r === 'great' ? '#ffe070' : '#ffffff'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText(`${FAM_NAME[fam] || ''}${CRAFT_TXT[r]}`, X, Y - 16); c.restore(); } });
}
// 失败演出：熏黑 / 摔倒（播一小段自己的帧，时装一致）
function witchOops(e, kind) { const clip = kind === 'fall' ? 'faceplant' : 'sooty'; e.play(clip, true); sfx.boom(0.3); fxText(kind === 'fall' ? '哎哟！' : '咳咳…', e.x, e.y, e.z + 50, { col: '#c8c8d0', size: 11, dur: 0.8 }); }
const bitter = (p, e) => hasSkill(p, 'wt_bitter') && e.act && (e.act.chargeK || 0) >= 0.99;   // 苦涩的棒棒糖：按住 0.15 秒 = 强制失败
const wtCharge = () => ({ at: 0.04, max: 0.15, min: 0, dmg: 0, clip: 'potion1' });
// ---- 被动 / BUFF ----
defSkill('wt_broom', { name: '扫把掌握', cls: 'mage', job: WT, lvReq: 15, passive: true, type: 'indep', col: '#b08a5a',
  desc: '【被动】骑扫把飞行：跳跃中空中攻击最多 6 次，下落变慢；空中左右双击方向键冲刺、按住跳跃缓降（各 2 次）。施放速度、命中率提高。', infoExtra: lv => [['施放速度', '+' + pct(0.1 + 0.015 * lv)], ['命中率', '+5%']] });
defSkill('wt_affinity', { name: '法米利尔亲和', cls: 'mage', job: WT, lvReq: 15, passive: true, type: 'indep', col: '#e0a060', desc: '【被动】四只使魔的技能更不容易失败，更容易大成功；机械类技能的施放时间缩短。' });
defSkill('wt_book', { name: '远古魔法书', cls: 'mage', job: WT, lvReq: 15, mp: 30, cd: 5, type: 'indep', buff: true, col: '#8a6ad0', ai: { kind: 'buff' },
  desc: '【BUFF】翻开古代图书馆的魔法书，永久提高普攻和技能攻击力。', infoExtra: lv => [['攻击力', '+' + pct(0.08 + 0.01 * lv)]],
  act: (lv) => ({ name: 'wt_book', clip: 'cheer', dur: 0.6, noCounter: true, onStart: e => { e.buffs.wt_book = { t: 1e9, dmg: 0.08 + 0.01 * lv }; sfx.buff(); fxAura(e, '#b89aff'); } }) });
defSkill('wt_lucky', { name: '幸运棒棒糖', cls: 'mage', job: WT, lvReq: 17, passive: true, type: 'indep', col: '#ff8ac0', desc: '【被动】提高成功和大成功的几率，同时提高攻击力。', infoExtra: lv => [['攻击力', '+' + pct(0.03 + 0.01 * lv)]] });
defSkill('wt_bitter', { name: '苦涩的棒棒糖', cls: 'mage', job: WT, lvReq: 19, maxLv: 1, passive: true, type: 'indep', col: '#8a5a3a',
  desc: '【被动】熔岩药瓶、暴炎加热炉、冰霜钻孔车按住技能键 0.15 秒即强制失败，失败时伤害 +50%，把拖沓的持续伤害压缩成一次爆发。' });
defSkill('wt_detonate', { name: '引爆实验', cls: 'mage', job: WT, lvReq: 19, maxLv: 1, passive: true, type: 'indep', col: '#e05a3a', desc: '【被动】搭乘或放置机械时按跳跃键，当场引爆机械并结束技能。' });
defSkill('wt_premonition', { name: '成功预感', cls: 'mage', job: WT, lvReq: 21, passive: true, type: 'indep', col: '#ffd070',
  desc: '【被动·一觉】技能成功后有几率在头顶出现糖果，下一个技能必定成功、更容易大成功；同时提高暴击率和暴击伤害。', infoExtra: lv => [['暴击率', '+' + pct(0.05 + 0.005 * lv)], ['暴击伤害', '+' + pct(0.05 + 0.01 * lv)]] });
// 扫把粉末：← 寒冰粉（几率冰冻）/ → 猛毒粉（中毒）；普攻、跑攻、跳攻变成独立攻击，硬直更长
defSkill('wt_powder', { name: '扫把粉末', cls: 'mage', job: WT, lvReq: 16, mp: 30, cd: 5, type: 'indep', buff: true, col: '#6ac0a0', ai: { kind: 'buff' },
  desc: '【BUFF】给扫把撒上魔法粉末（施放时按 ← 选寒冰粉：几率冰冻；按 → 选猛毒粉：中毒）。普攻、跑攻、跳攻变成独立攻击，范围变大、硬直更长。',
  act: (lv) => ({ name: 'wt_powder', clip: 'cheer', dur: 0.5, noCounter: true, onStart: e => { const dx = e.pad ? e.pad.dx() : 0, kind = dx === -e.face ? 'ice' : dx === e.face ? 'poison' : ((e.buffs.wt_powder && e.buffs.wt_powder.kind) || 'poison');
    e.buffs.wt_powder = { t: 1e9, kind, lv }; sfx.buff(); fxAura(e, kind === 'ice' ? '#bfefff' : '#8adf6a'); fxText(kind === 'ice' ? '寒冰粉' : '猛毒粉', e.x, e.y, e.z + 40, { col: kind === 'ice' ? '#bfefff' : '#8adf6a', size: 11 }); } }) });
// ---- 召唤类 ----
// 改良舒露露：往前走的挑衅人偶（杰克扮的），嘲讽周围的敌人，时间到 / 再按一次技能键爆炸；失败：跟着你走、不爆炸；大成功：爆炸更大
defSummon('wt_shululu', { kind: 'follower', bundle: 'shululu', model: () => summonSprite('shululu', {}, '#ff9a50'), w: 11, d: 10, h: 64, speed: 50, runSpeed: 50, pref: 0, sight: 0, life: 8, max: 1, col: '#ff9a50', attacks: [],
  ai: (s, dt) => { const o = s.owner; if (s.fail) { const gx = o.x - o.face * 50; s.vx = Math.sign(gx - s.x) * Math.min(160, Math.abs(gx - s.x) * 3); s.vy = (o.y - s.y) * 3; s.setState(Math.abs(s.vx) > 5 ? 'walk' : 'idle'); if (s.vx) s.face = Math.sign(s.vx); return; }
    s.vx = s.face * 50; s.vy = 0; s.setState('walk'); s.tauntT = (s.tauntT || 0) - dt;
    if (s.tauntT <= 0) { s.tauntT = 0.5; for (const t of ents) if (foe(o, t) && Math.hypot(t.x - s.x, (t.y - s.y) * 2) < 330 && (!t.boss || s.lv >= 5)) addStatus(t, 'taunt', 0.8, { src: s }); } },
  onEnd: (s, why) => { if (s.fail) return; const big = s.great ? 1.5 : 1; sfx.boom(0.5 * big); fxBurst(s.x, s.y, 30, 150 * big, '#ffb060'); fxShock(s.x, s.y, 120 * big, '#ffb060');
    summonArea(s, s.x, s.y, 90 * big, { dmg: s.dmg * big, launch: 360, knock: 120, hs: 0.1, big: 1.4, elem: 'fire', type: 'indep', downHit: true }, { zMax: 200 }); } });
defSkill('wt_shululu', { name: '改良舒露露', cls: 'mage', job: WT, lvReq: 15, mp: 30, cd: 16, type: 'indep', elem: 'fire', col: '#ff9a50', cast: true, air: true,
  desc: '扔出挑衅人偶舒露露（杰克扮的）：它慢慢往前走，嘲讽周围的敌人（技能 5 级起连领主也嘲讽），8 秒后或再按一次技能键时爆炸。失败：它只会跟着你走，不爆炸；大成功：爆炸更大。可以空中施放。',
  pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'buff', summon: 'wt_shululu' },
  recast: { ok: p => summonsOf(p, 'wt_shululu').some(s => !s.fail), cd: 0.3, mp: 0, act: () => ({ name: 'wt_boom', clip: 'cast3', dur: 0.25, noCounter: true, onStart: e => dismissSummons(e, 'wt_shululu', 'cmd') }) },
  act: (lv) => ({ name: 'wt_shululu', clip: 'potion2', dur: 0.45, cancelFrom: 0.3, events: [evAt(0.15, e => { const r = rollCraft(e, 'jack'); const s = summon(e, 'wt_shululu', { lv, x: e.x + e.face * 40 }); if (!s) return; s.dmg = skillDmg(3.0, 0.3, lv); s.fail = r === 'fail'; s.great = r === 'great'; s.face = e.face; })] }) });
// 变异苍蝇拍：召唤的变异怪（成功：友方哥布林弓手；大成功：友方牛头兽；失败：敌方猎人）
defSummon('wt_mut_gob', { kind: 'follower', bundle: 'goblin', model: () => summonSprite('goblin', { hue: 60, sat: 0.9 }, '#8adf6a'), clips: GOB_CLIPS, w: 11, d: 11, h: 72, speed: 120, pref: 160, life: 30, max: 4, tagMax: { mutant: 4 }, tags: ['mutant'], col: '#8adf6a',
  attacks: [{ clip: 'throw', range: [60, 320], dy: 40, cd: [1.4, 2.2], act: { dur: 0.9, events: [evAt(0.45, s => smShot(s, { dmg: 0.35, col: '#c0a070', img: 'rock', speed: 460 }))] } }] });
defSummon('wt_mut_tau', { kind: 'follower', bundle: 'tau', model: () => summonSprite('tau', { hue: 40 }, '#e0a060'), w: 16, d: 13, h: 118, speed: 110, pref: 50, life: 30, max: 4, tagMax: { mutant: 4 }, tags: ['mutant'], col: '#e0a060',
  attacks: [{ clip: 'axe', range: [0, 80], dy: 20, cd: [1.6, 2.4], act: { dur: 1.25, hits: [{ t0: 0.62, t1: 0.72, box: [0, 80, 26, 0, 120], dmg: 0.8, stun: 0.5, knock: 160, hs: 0.07, snd: 'blunt' }] } }] });
function swatter(e, lv, big) {
  const r = rollCraft(e, 'cat');
  const hit = HB(0, 1, big ? [-60, 150, 60, -30, 160] : [-30, 110, 44, -20, 140], skillDmg(big ? 5 : 2.2, big ? 0.5 : 0.22, lv), { stun: 0.5, knock: 60, hs: 0.1, big: 1.5, shake: 3, snd: 'blunt', downHit: true, type: 'indep', elem: 'dark',
    onHit: (a, t) => { if (Math.random() < 0.2) addStatus(t, 'curse', 4, { src: a }); if (t.status && t.status.blind) t.hp -= 0; } });
  instantHit(e, hit); cam.shake = Math.max(cam.shake, big ? 6 : 3); sfx.boom(big ? 0.8 : 0.4); fxShock(e.x + e.face * 60, e.y, big ? 200 : 130, '#c79aff');
  if (hasSkill(e, 'wt_swatlock') && e.buffs.wt_swatlock) return;
  if (Math.random() < (big ? 0.4 : 0.3)) { const x = e.x + e.face * 70;
    if (r === 'fail') { const m = spawnMonster('goblin', x, e.y, { lvl: Math.max(1, (game.lvl || 10) - 3) }); fxText('糟了！', x, e.y, 60, { col: '#ff6a5a', size: 11 }); if (m) m.exp = 0; }
    else summon(e, r === 'great' ? 'wt_mut_tau' : 'wt_mut_gob', { x, lv, mul: lvMul(lv, 0.1) }); }
}
defSkill('wt_swatter', { name: '变异苍蝇拍', cls: 'mage', job: WT, lvReq: 17, mp: 25, cd: 6.4, type: 'indep', elem: 'dark', col: '#8a5ab0', air: true,
  desc: '霸体抡起大苍蝇拍从身后拍下，有几率诅咒。命中时有几率召出变异怪（最多 4 只、30 秒）：成功 = 友方哥布林弓手，大成功 = 友方牛头兽，失败 = 敌方的哥布林。可以空中施放。',
  pow: lv => skillDmg(2.2, 0.22, lv), ai: { kind: 'poke', r: [0, 110], dy: 30 },
  act: (lv) => ({ name: 'wt_swatter', clip: 'swat', dur: 0.55, superArmor: true, cancelFrom: 0.4, events: [evAt(0.22, e => swatter(e, lv, false))] }) });
defSkill('wt_swatlock', { name: '苍蝇拍：禁锢', cls: 'mage', job: WT, lvReq: 18, maxLv: 1, mp: 0, cd: 1, type: 'indep', buff: true, col: '#6a6a80', ai: null,
  desc: '【开关】开启后，苍蝇拍不再召唤变异怪。', act: () => ({ name: 'wt_swatlock', clip: 'cheer', dur: 0.3, noCounter: true, onStart: e => toggleBuff(e, 'wt_swatlock', 1e9, {}) }) });
// ---- 投掷 / 放置 ----
// 改良魔法星弹：追踪弹，范围内每个敌人各打 1 次后跳到下一个；大成功附加感电和连锁闪电
defSkill('wt_missile', { name: '改良魔法星弹', cls: 'mage', job: WT, lvReq: 15, mp: 20, cd: 5.4, type: 'indep', elem: 'light', col: '#fff38a', cast: true, air: true,
  desc: '射出追踪弹，命中后跳到下一个敌人，范围内每个敌人各打 1 次。大成功时附加感电和连锁闪电。可以空中施放。', pow: lv => skillDmg(1.3, 0.13, lv) * 4, ai: { kind: 'proj', r: [0, 400], dy: 60 },
  act: (lv) => ({ name: 'wt_missile', clip: 'mcast', dur: 0.36, cancelFrom: 0.2, events: [evAt(0.1, e => { const r = rollCraft(e, 'eel'), hitSet = new Set(), max = r === 'fail' ? 2 : r === 'great' ? 8 : 5; let n = 0;
    const hop = (x, y, z) => { const t = nearestFoe({ ...e, x, y }, 380, o => !hitSet.has(o)); if (!t || n >= max) return; n++; hitSet.add(t);
      spawnProj({ owner: e, x, y, z, face: Math.sign(t.x - x) || e.face, life: 1.2, w: 10, d: 12, h: 14, pierce: true, hit: null, tgt: t,
        update(q) { const tt = q.tgt; if (!tt || tt.dead) { q.t = q.life; return; } const dx = tt.x - q.x, dy = tt.y - q.y, dz = tt.z + 50 - q.z, l = Math.hypot(dx, dy * 2, dz) || 1; q.vx = dx / l * 700; q.vy = dy / l * 700; q.vz = dz / l * 700;
          if (l < 26 && !q.done) { q.done = true; q.t = q.life; applyHit(e, tt, { dmg: skillDmg(1.3, 0.13, lv), stun: 0.35, knock: 30, hs: 0.04, type: 'indep', elem: 'light', col: '#fff6a0', snd: 'crit', sure: true }, { proj: true, src: q });
            if (r === 'great') { addStatus(tt, 'shock', 4, { src: e }); lightningStrike({ x: tt.x, y: tt.y }); } } },
        onEnd(q) { if (q.done) hop(q.x, q.y, q.z); },
        draw(c, q) { drawSpr(c, fxTint('orb', '#fff38a'), sx(q.x), sy(q.y, q.z), 22, 22, { rot: q.t * 10 }); } }); };
    sfx.magic(); hop(e.x + e.face * 20, e.y, e.z + 60); })] }) });
// 暗影斗篷：黑斗篷卷住前方的敌人（抓取，能抓霸体和格挡中的敌人），几率致盲；施放中无敌
defSkill('wt_cloak', { name: '暗影斗篷', cls: 'mage', job: WT, lvReq: 16, mp: 25, cd: 7, type: 'indep', elem: 'dark', col: '#4a2a6a',
  desc: '甩出一件巨大的黑斗篷卷住前方的敌人（抓取，能抓霸体和格挡中的敌人），有几率致盲。施放中无敌。', pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'grab', r: [0, 90], dy: 20 },
  act: (lv) => ({ name: 'wt_cloak', clip: 'fling', dur: 0.8, noCounter: true, invul: [0.05, 0.75],
    hits: [HB(0.08, 0.16, [0, 95, 26, 0, 120], 0.3, { grab: true, stun: 0.4, hs: 0.04, type: 'indep', elem: 'dark' })],
    hold: (e, t) => { t.x = e.x + e.face * 70; t.y = e.y + 0.5; t.z = 10 + Math.sin(e.actT * 20) * 3; },
    update: e => { const t = e.grabbed; if (t) addFx({ x: t.x, y: t.y + 0.5, z: t.z, dur: 0.02, draw(c) { drawSpr(c, fxTint('darkorb', '#3a1a5a'), sx(this.x), sy(this.y, this.z + 45), 110 + Math.sin(game.t * 30) * 6, 90, { add: false, alpha: 0.9 }); } }); },
    events: [evAt(0.12, e => { sfx.swing(true); rollCraft(e, 'cat'); }), evAt(0.3, e => { const t = e.grabbed; if (t) applyHit(e, t, { dmg: skillDmg(1.2, 0.12, lv), stun: 0.3, hs: 0.04, type: 'indep', elem: 'dark', sure: true }, { proj: true }); }),
      evAt(0.62, e => { const t = e.grabbed; if (!t) return; if (Math.random() < 0.3) addStatus(t, 'blind', 3, { src: e }); throwGrab(e, { dmg: skillDmg(2.0, 0.2, lv), launch: 300, knock: 120, hs: 0.08, type: 'indep', elem: 'dark' }); })] }) });
// 熔岩药瓶：扔出药瓶，地面生成 6 秒熔岩区（减速、每秒灼烫）；大成功范围更大并灼伤；失败：瓶子当场炸开、主角被熏黑
defSummon('wt_lava', { kind: 'field', r: 80, tick: 1, life: 6, max: 2, col: '#ff7a2a',
  onTick(s, foes) { for (const t of foes) { summonHit(s, t, { dmg: s.dmg, stun: 0.2, knock: 0, hs: 0.02, elem: 'fire', type: 'indep', sure: true }); addStatus(t, 'slow', 1.2, { src: s.owner }); if (s.great) addStatus(t, 'burn', 2, { src: s.owner, dps: atkOf(s.owner, 'indep') * 0.06 }); } },
  draw(c, s) { const k = s.lifeT / s.life, a = k < 0.1 ? k * 10 : k > 0.85 ? (1 - k) / 0.15 : 1; c.save(); c.globalAlpha = 0.8 * a; drawSpr(c, 'lava', sx(s.x), sy(s.y, 0), (s.sdef.r * 2) * (s.big || 1), (s.sdef.r * 0.8) * (s.big || 1), { add: false }); c.restore(); } });
defSkill('wt_lava', { name: '熔岩药瓶', cls: 'mage', job: WT, lvReq: 18, mp: 40, cd: 20, type: 'indep', elem: 'fire', col: '#e0602a', cast: true, air: true,
  desc: '扔出药瓶，地面生成持续 6 秒的熔岩区：每秒灼烫并减速范围内的敌人。大成功：范围更大并灼伤。失败：瓶子当场炸开把周围敌人炸飞，主角被熏黑。按住技能键 0.15 秒（学会苦涩的棒棒糖）强制失败，失败伤害 +50%。可以空中施放。',
  pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'aoe', r: [60, 300], dy: 60 },
  act: (lv, p) => ({ name: 'wt_lava', clip: 'potion2', dur: 0.5, cancelFrom: 0.36, charge: p && hasSkill(p, 'wt_bitter') ? wtCharge() : undefined,
    events: [evAt(0.12, e => { const forced = bitter(e, e); const r = rollCraft(e, 'jack', { force: forced ? 'fail' : null });
      if (r === 'fail') { const x = e.x + e.face * 30; fxBurst(x, e.y, 60, 140, '#ffb060'); sfx.boom(0.6); blast(e, x, e.y, 90, { dmg: skillDmg(4.0, 0.4, lv) * (forced ? 1.5 : 1), launch: 380, knock: 140, hs: 0.1, big: 1.5, elem: 'fire', type: 'indep', downHit: true }, { zMax: 150 }); witchOops(e, 'soot'); e.act.dur = Math.max(e.act.dur, 0.9); return; }
      const at = aimAhead(e, 180, 300); sfx.swing(false);
      lobProj(e, at.x, at.y, 0.45, { img: 'fireball', h: 14, onLand: pr => { sfx.hit('fire', false); fxBurst(pr.x, pr.y, 10, 90, '#ffb060'); const f = summon(e, 'wt_lava', { x: pr.x, y: pr.y }); if (f) { f.dmg = skillDmg(0.6, 0.06, lv); f.great = r === 'great'; f.big = r === 'great' ? 1.3 : 1; } } }); })] }) });
// 魔道酸雨云：召出一朵下酸雨的云，持续 6 秒；大成功时附带闪电硬直
defSummon('wt_acid', { kind: 'field', r: 90, tick: 0.5, life: 6, max: 1, col: '#9adf6a',
  onTick(s, foes) { for (const t of foes) { summonHit(s, t, { dmg: s.dmg, stun: 0.15, knock: 0, hs: 0.02, elem: 'ice', type: 'indep', sure: true }); if (s.great && Math.random() < 0.15) { lightningStrike({ x: t.x, y: t.y }); addStatus(t, 'stun', 0.6, { src: s.owner }); } } },
  drawUpright(c, s) { const X = sx(s.x), Y = sy(s.y, 130), k = s.lifeT / s.life, a = k < 0.1 ? k * 10 : k > 0.9 ? (1 - k) / 0.1 : 1; c.save(); c.globalAlpha = a;
    drawSpr(c, fxTint('poison', '#7a8a7a'), X, Y, 190, 80, { add: false }); c.strokeStyle = 'rgba(160,230,110,.7)'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { const x = X - 80 + ((i * 37 + game.t * 90) % 160), y0 = Y + 20 + ((game.t * 300 + i * 53) % 90); c.beginPath(); c.moveTo(x, y0); c.lineTo(x - 3, y0 + 12); c.stroke(); } c.restore(); } });
defSkill('wt_acid', { name: '魔道酸雨云', cls: 'mage', job: WT, lvReq: 18, mp: 40, cd: 20, type: 'indep', elem: 'ice', col: '#8adf6a', cast: true, air: true,
  desc: '在前方召出一朵下酸雨的云，持续 6 秒，持续伤害下方的敌人。大成功时附带闪电，打出硬直。可以空中施放。', pow: lv => skillDmg(3.6, 0.36, lv), ai: { kind: 'aoe', r: [60, 300], dy: 60 },
  act: (lv) => ({ name: 'wt_acid', clip: 'cheer', dur: 0.45, cancelFrom: 0.32, events: [evAt(0.15, e => { const r = rollCraft(e, 'snow'), at = aimAhead(e, 170, 300); const f = summon(e, 'wt_acid', { x: at.x, y: at.y });
    if (f) { f.dmg = skillDmg(0.3, 0.03, lv) * (r === 'fail' ? 0.5 : 1); f.great = r === 'great'; } })] }) });
// 旋转扫把：空中 = 骑扫把旋转俯冲（落地冲击波，然后自己摔个狗吃屎）；地面 = 陀螺一样旋转，可以移动并吸怪
defSkill('wt_spin', { name: '旋转扫把', cls: 'mage', job: WT, lvReq: 19, mp: 45, cd: 12, type: 'indep', elem: 'light', col: '#e0c040', air: true,
  desc: '地面：像陀螺一样带着扫把旋转，可以移动，把周围的敌人卷进来。空中：骑扫把旋转俯冲，落地时放出冲击波（然后自己摔个狗吃屎）。收招时霸体。',
  pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [0, 110], dy: 40 },
  act: (lv, p) => {
    if (p && p.z > 2) return { name: 'wt_spin', clip: 'brSpin', dur: 1.4, superArmor: true, noCounter: true, lowGrav: 0.3,
      onStart: e => { e.vz = -120; e.vx = e.face * 220; rollCraft(e, 'eel'); },
      hits: [HB(0, 1.4, [-40, 60, 34, -40, 90], skillDmg(0.4, 0.04, lv), { rep: 0.1, max: 12, stun: 0.3, knock: 20, hs: 0.02, type: 'indep', elem: 'light', snd: 'crit' })],
      onLand: e => { cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7); fxShock(e.x, e.y, 170, '#ffe070'); blast(e, e.x, e.y, 110, { dmg: skillDmg(2.0, 0.2, lv), launch: 300, knock: 120, hs: 0.08, type: 'indep', elem: 'light', downHit: true }, { zMax: 120 });
        e.act.hits = []; e.vz = 0; e.vx = 0; witchOops(e, 'fall'); e.act.dur = e.actT + 0.7; e.act.superArmor = false; } };
    return { name: 'wt_spin', clip: 'brSpin', dur: 1.3, superArmor: [1.0, 1.3], noCounter: true,
      onInput: (e, I) => { e.vx = I.dx() * 160; e.vy = I.dy() * 90; return false; },
      update: e => { if (Math.random() < 0.5) fxStreak({ x: e.x, y: e.y, z: e.z + 40, face: Math.random() < 0.5 ? 1 : -1, len: 60, w: 6, col: '#ffe090', dur: 0.1 }); for (const t of ents) if (foe(e, t) && Math.hypot(t.x - e.x, (t.y - e.y) * 2) < 160 && !t.boss) { t.x = damp(t.x, e.x, 1.5, 1 / 60); t.y = damp(t.y, e.y, 1.5, 1 / 60); } },
      onStart: e => rollCraft(e, 'eel'),
      hits: [HB(0, 1.2, [-50, 60, 38, 0, 110], skillDmg(0.45, 0.045, lv), { rep: 0.1, max: 12, stun: 0.3, knock: 10, hs: 0.02, type: 'indep', elem: 'light', snd: 'crit' })] };
  } });
// ---- 搭乘 / 放置机械（follower，魔道学者坐在上面） ----
const MACH = { furnace: 110, drill: 100, tesla: 130, antigrav: 60 };
for (const k in MACH) defSummon('wt_' + k, { kind: 'follower', bundle: k, model: () => summonSprite(k, {}, '#e0b060'), w: 20, d: 14, h: MACH[k], speed: 0, pref: 0, sight: 0, life: 12, max: 1, col: '#e0b060', attacks: [],
  ai: (s) => { s.vx = s.vy = 0; if (!s.busy && s.clipName !== (s.want || 'idle')) s.play(s.want || 'idle'); } });
const mClip = (s, c) => { if (s && !s.gone) { s.want = c; s.play(c); } };
// 搭乘：放出机械，自己坐上去；期间免疫异常、受到伤害 −60%；按跳跃（引爆实验）当场引爆
const RIDE_IMMUNE = ['stun', 'freeze', 'sleep', 'root', 'bind', 'confuse', 'slow'];
function rideMachine(e, key, sitZ) {
  const m = summon(e, key, { x: e.x + e.face * 36, y: e.y }); if (!m) return null; m.face = e.face; mClip(m, 'build');
  e.act.m = m; e.act.sit = sitZ; e.statusImmune = { ...(e.statusImmune || {}) }; for (const k of RIDE_IMMUNE) e.statusImmune[k] = true; e.buffs.wt_ride = { t: 1e9, taken: -0.6 };
  return m;
}
function leaveMachine(e, boom, lv, o = {}) {
  const a = e.act, m = a && a.m; delete e.buffs.wt_ride; if (e.statusImmune) for (const k of RIDE_IMMUNE) delete e.statusImmune[k];
  if (!m || m.gone) return;
  if (boom) { sfx.boom(0.9); cam.shake = Math.max(cam.shake, 6); fxBurst(m.x, m.y, 50, 200, '#ffb060'); fxShock(m.x, m.y, 170, '#ffb060');
    blast(e, m.x, m.y, 110, { dmg: o.dmg || skillDmg(3.0, 0.3, lv), launch: 380, knock: 160, hs: 0.1, big: 1.6, type: 'indep', elem: o.elem, downHit: true }, { zMax: 200 }); }
  dismissOne(m, 'cmd'); e.z = Math.max(e.z, 1); e.vz = 200; e.setState('jump');
}
// 暴炎加热炉：坐在风箱上拉风箱（霸体），喷出会爆炸的火石；连按 Z / X 喷得更快，←→ 控制方向；时间到或按跳跃时炉子爆炸（击倒）；失败：主角摔下来，炉口朝天喷熔岩柱
defSkill('wt_furnace', { name: '暴炎加热炉', cls: 'mage', job: WT, lvReq: 19, mp: 60, cd: 25, type: 'indep', elem: 'fire', col: '#e0602a', cast: true,
  desc: '放下加热炉，坐上去拉风箱（霸体），喷出会爆炸的火石；连按 Z / X 喷得更快，←→ 控制方向。时间到或按跳跃键时炉子爆炸（击倒）。失败：主角从炉上摔下来，炉口朝天喷出熔岩柱。学会苦涩的棒棒糖后按住技能键 0.15 秒强制失败，失败伤害 +50%。',
  pow: lv => skillDmg(9, 0.9, lv), ai: { kind: 'aoe', r: [40, 320], dy: 60 },
  act: (lv, p) => ({ name: 'wt_furnace', clip: 'brIdle', dur: 4.2, superArmor: true, noCounter: true, charge: p && hasSkill(p, 'wt_bitter') ? wtCharge() : undefined,
    onStart: e => { e.act.fireT = 0.9; e.act.aim = 0; },
    onInput: (e, I) => { const a = e.act; if (!a.m) return false; e.vx = e.vy = 0; if (I.buffered('jump')) { I.consume('jump'); a.dur = e.actT; return true; }
      if (I.buffered('attack') || I.buffered('cmd')) { I.consume('attack'); I.consume('cmd'); a.fast = 0.35; } a.aim = clamp(a.aim + I.dx() * e.face * 0.05, -1, 1); return true; },
    update: (e, dt) => { const a = e.act; if (!a.chargeDone) return; if (!a.m) { const forced = bitter(e, e); a.r = rollCraft(e, 'jack', { force: forced ? 'fail' : null }); a.forced = forced; if (!rideMachine(e, 'wt_furnace', 90)) { a.dur = 0; return; } a.t0 = e.actT; }
      const m = a.m; if (!m || m.gone) { a.dur = 0; return; } const k = e.actT - a.t0;
      if (a.r !== 'fail' || !a.fell) { e.x = m.x - e.face * 4; e.y = m.y + 0.2; e.z = a.sit; e.vz = 0; }
      if (k < 0.4) return; if (k < 0.45) mClip(m, 'pump1');
      if (a.r === 'fail') { if (!a.fell) { a.fell = true; e.z = 0; e.x = m.x - e.face * 50; witchOops(e, 'fall'); mClip(m, 'fail'); }
        if (Math.floor(k * 6) !== a.lk) { a.lk = Math.floor(k * 6); blast(e, m.x, m.y, 60, { dmg: skillDmg(0.9, 0.09, lv) * (a.forced ? 1.5 : 1), stun: 0.5, launch: 300, hs: 0.05, type: 'indep', elem: 'fire', downHit: true }, { zMax: 260 }); fxSpr('flame', m.x, m.y, 60, { w: 70, dur: 0.3 }); }
        if (k > 1.6) a.dur = e.actT; return; }
      a.fast = Math.max(0, (a.fast || 0) - dt); a.fireT -= dt * (a.fast > 0 ? 2.2 : 1);
      if (a.fireT <= 0) { a.fireT = 0.5; mClip(m, Math.random() < 0.5 ? 'fire1' : 'fire2'); sfx.hit('fire', false); const n = a.r === 'great' ? 3 : 2;
        for (let i = 0; i < n; i++) { const tx = m.x + e.face * (140 + i * 60 + a.aim * 80), ty = clamp(m.y + rnd(-40, 40), 6, DEPTH - 6);
          lobProj(m, tx, ty, 0.45, { img: 'rock', h: 16, onLand: pr => { fxBurst(pr.x, pr.y, 10, 90, '#ff9a50'); sfx.boom(0.3); blast(e, pr.x, pr.y, 55, { dmg: skillDmg(0.6, 0.06, lv), launch: 240, knock: 60, hs: 0.05, type: 'indep', elem: 'fire' }, { zMax: 120 }); } }); } }
      else if (a.fireT < 0.25) mClip(m, 'pump2'); },
    onEnd: (e) => { const a = e.act; if (a && a.m) leaveMachine(e, a.r !== 'fail', lv, { elem: 'fire', dmg: skillDmg(3.0, 0.3, lv) }); } }) });
// 冰霜钻孔车：坐进去用方向键驾驶约 5.5 秒；连按 X 钻得更快并吸怪；Z 掉头；能打倒地的敌人；失败：钻进地里爆炸
defSkill('wt_drill', { name: '冰霜钻孔车', cls: 'mage', job: WT, lvReq: 20, mp: 80, cd: 45, type: 'indep', elem: 'ice', col: '#6ac0e8', cast: true,
  desc: '钻孔车从天而降（落地冲击波），坐进去用方向键驾驶约 5.5 秒；连按 X 钻得更快并把敌人吸过来，按 Z 掉头，能打到倒地的敌人。大成功换装巨型冰钻头。失败：钻进地里爆炸。学会苦涩的棒棒糖后按住技能键 0.15 秒强制失败，失败伤害 +50%。',
  pow: lv => skillDmg(14, 1.4, lv), ai: { kind: 'burst', r: [0, 200], dy: 30 },
  act: (lv, p) => ({ name: 'wt_drill', clip: 'brDash', dur: 6.2, superArmor: true, noCounter: true, charge: p && hasSkill(p, 'wt_bitter') ? wtCharge() : undefined,
    onInput: (e, I) => { const a = e.act; if (!a.m || a.m.gone) return false; if (I.buffered('jump')) { I.consume('jump'); a.dur = e.actT; return true; }
      if (I.buffered('cmd')) { I.consume('cmd'); a.m.face = -a.m.face; e.face = a.m.face; mClip(a.m, 'turn'); }
      if (I.buffered('attack')) { I.consume('attack'); a.fast = 0.3; } a.mx = I.dx(); a.my = I.dy(); return true; },
    update: (e, dt) => { const a = e.act; if (!a.chargeDone) return; if (!a.m) { const forced = bitter(e, e); a.r = rollCraft(e, 'snow', { force: forced ? 'fail' : null }); a.forced = forced; const m = rideMachine(e, 'wt_drill', 58); if (!m) { a.dur = 0; return; } a.t0 = e.actT;
        fxShock(m.x, m.y, 160, '#bfefff'); sfx.boom(0.6); blast(e, m.x, m.y, 100, { dmg: skillDmg(2.0, 0.2, lv), launch: 260, knock: 80, hs: 0.06, type: 'indep' }, { zMax: 120 }); }
      const m = a.m; if (!m || m.gone) { a.dur = 0; return; } const k = e.actT - a.t0;
      if (!isHuman(e)) { const t = nearestFoe(m, 500); a.mx = t ? Math.sign(t.x - m.x) : 0; a.my = t ? Math.sign(t.y - m.y) * (Math.abs(t.y - m.y) > 8) : 0; if (a.mx) m.face = a.mx; }
      if (a.r === 'fail' && k > 0.5) { mClip(m, 'fail'); if (!a.boomed) { a.boomed = true; game.after(0.6, () => { if (e.act === a) a.dur = e.actT; }); } e.x = m.x; e.y = m.y + 0.2; e.z = 30; e.vz = 0; return; }
      if (k > 5.5) { a.dur = e.actT; return; }
      const sp = 170 * (a.fast > 0 ? 1.6 : 1); a.fast = Math.max(0, (a.fast || 0) - dt); m.x += (a.mx || 0) * sp * dt; m.y = clamp(m.y + (a.my || 0) * 110 * dt, 6, DEPTH - 6); if (game.room) m.x = clamp(m.x, game.room.x0 + 30, game.room.x1 - 30);
      mClip(m, a.fast > 0 ? 'drill1' : (a.r === 'great' ? 'big' : (a.mx ? 'drive1' : 'drill2'))); e.x = m.x - m.face * 10; e.y = m.y + 0.2; e.z = a.sit; e.vz = 0; e.face = m.face;
      if (Math.floor(k / (a.fast > 0 ? 0.08 : 0.14)) !== a.hk) { a.hk = Math.floor(k / (a.fast > 0 ? 0.08 : 0.14)); const r = a.r === 'great' ? 70 : 52;
        summonArea(m, m.x + m.face * 60, m.y, r, { dmg: skillDmg(0.35, 0.035, lv), stun: 0.3, knock: -30, hs: 0.02, elem: 'ice', type: 'indep', downHit: true }, { zMax: 120 });
        if (a.fast > 0) for (const t of ents) if (foe(e, t) && Math.abs(t.x - m.x) < 160 && Math.abs(t.y - m.y) < 60 && !t.boss) t.x = damp(t.x, m.x + m.face * 60, 4, 1 / 60); } },
    onEnd: (e) => { const a = e.act; if (a && a.m) leaveMachine(e, true, lv, { elem: 'ice', dmg: skillDmg(a.r === 'fail' ? 4.0 * (a.forced ? 1.5 : 1) : 2.5, 0.25, lv) }); } }) });
// 电鳗碰撞机：钻进仓鼠轮发电，反复放出闪电（每次 5 道，大成功 8 道并感电），把范围内的敌人电到硬直；失败时漏电电到自己，只放 1 道；按跳跃提前引爆
defSkill('wt_tesla', { name: '电鳗碰撞机', cls: 'mage', job: WT, lvReq: 19, mp: 60, cd: 25, type: 'indep', elem: 'light', col: '#e0d040', cast: true,
  desc: '搭起电塔，钻进仓鼠轮里发电：约 6 秒内反复放出闪电（每次 5 道，大成功 8 道并感电），把范围内的敌人电到硬直。失败：漏电电到自己，只放 1 道。按跳跃键提前引爆。',
  pow: lv => skillDmg(10, 1.0, lv), ai: { kind: 'aoe', r: [0, 260], dy: 80 },
  act: (lv) => ({ name: 'wt_tesla', clip: 'brIdle', dur: 6.4, superArmor: true, noCounter: true,
    onInput: (e, I) => { const a = e.act; if (!a.m) return false; e.vx = e.vy = 0; if (I.buffered('jump')) { I.consume('jump'); a.dur = e.actT; } return true; },
    update: (e, dt) => { const a = e.act; if (!a.m) { a.r = rollCraft(e, 'eel'); if (!rideMachine(e, 'wt_tesla', 12)) { a.dur = 0; return; } a.t0 = e.actT; a.zapT = 0.8; }
      const m = a.m; if (!m || m.gone) { a.dur = 0; return; } const k = e.actT - a.t0; e.x = m.x - m.face * 16; e.y = m.y - 0.3; e.z = a.sit; e.vz = 0;
      if (k < 0.5) return; a.zapT -= dt;
      if (a.r === 'fail') { if (!a.oops) { a.oops = true; mClip(m, 'fail'); lightningStrike({ x: m.x + e.face * 80, y: m.y }); summonArea(m, m.x + e.face * 80, m.y, 60, { dmg: skillDmg(1.0, 0.1, lv), stun: 0.6, launch: 200, hs: 0.05, elem: 'light', type: 'indep' }); e.hp = Math.max(1, e.hp - Math.round(e.hpMax * 0.03)); fxText('麻麻的…', e.x, e.y, e.z + 60, { col: '#fff38a', size: 11 }); } if (k > 1.6) a.dur = e.actT; return; }
      mClip(m, a.zapT < 0.2 ? 'zap1' : (Math.floor(k * 8) % 2 ? 'spin1' : 'spin2'));
      if (a.zapT <= 0) { a.zapT = 1.2; const n = a.r === 'great' ? 8 : 5; sfx.zap(); const L = ents.filter(t => foe(e, t) && Math.abs(t.x - m.x) < 300 && Math.abs(t.y - m.y) < 90);
        for (let i = 0; i < n; i++) { const t = L[i % Math.max(1, L.length)]; const x = t ? t.x : m.x + rnd(-200, 200), y = t ? t.y : clamp(m.y + rnd(-60, 60), 6, DEPTH - 6);
          game.after(i * 0.05, () => { lightningStrike({ x, y }); summonArea(m, x, y, 40, { dmg: skillDmg(0.35, 0.035, lv), stun: 1.2, knock: 0, hs: 0.03, elem: 'light', type: 'indep', downHit: true }, { zMax: 220, status: a.r === 'great' ? 'shock' : null, sdur: 4 }); }); } } },
    onEnd: (e) => { const a = e.act; if (a && a.m) leaveMachine(e, true, lv, { elem: 'light', dmg: skillDmg(3.0, 0.3, lv) }); } }) });
// 反重力装置：地面装置把范围内的敌人抬到空中，上升和落地各打一次；失败时敌人不浮空；大成功落地有冲击波
defSkill('wt_antigrav', { name: '反重力装置', cls: 'mage', job: WT, lvReq: 19, mp: 50, cd: 20, type: 'indep', elem: 'dark', col: '#8a5ad0', cast: true,
  desc: '在前方放下反重力装置，把范围内的敌人抬到空中，上升和落地各造成一次伤害。失败时敌人不会浮空；大成功时落地还有冲击波。', pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'aoe', r: [40, 260], dy: 70 },
  act: (lv) => ({ name: 'wt_antigrav', clip: 'hammer', dur: 0.7, cancelFrom: 0.5, events: [evAt(0.25, e => { const r = rollCraft(e, 'cat'), at = aimAhead(e, 150, 260); const m = summon(e, 'wt_antigrav', { x: at.x, y: at.y, life: 2.2 }); if (!m) return; mClip(m, 'build');
    game.after(0.4, () => { if (m.gone) return; mClip(m, r === 'fail' ? 'fail' : 'on2'); sfx.charge();
      summonArea(m, m.x, m.y, 110, { dmg: skillDmg(2.0, 0.2, lv), launch: r === 'fail' ? 0 : 520, stun: 0.5, knock: 0, hs: 0.05, elem: 'dark', type: 'indep' }, { zMax: 400 });
      game.after(1.1, () => { if (m.gone) return; mClip(m, 'off'); summonArea(m, m.x, m.y, 120, { dmg: skillDmg(3.0, 0.3, lv), launch: 200, knock: 60, hs: 0.08, elem: 'dark', type: 'indep', downHit: true }, { zMax: 60 });
        if (r === 'great') { fxShock(m.x, m.y, 200, '#b080ff'); summonArea(m, m.x, m.y, 170, { dmg: skillDmg(1.5, 0.15, lv), knock: 160, hs: 0.06, type: 'indep', radial: true, downHit: true }); } }); }); })] }) });
// ---- 普攻：学会扫把掌握后，跳跃中骑扫把（空中 6 连击、慢慢下落）；扫把粉末开着时普攻变成独立攻击，附带寒冰 / 猛毒 ----
const WITCH_ACTS = { ...MAGE_ACTS,
  jatk: { name: 'jatk', clip: 'brAtk', dur: 0.3, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.25,
    hits: [HB(0.07, 0.15, [0, 64, 24, -50, 80], 0.75, { stun: 0.34, knock: 50, airLift: 160, hs: 0.05, snd: 'blunt', type: 'phys', downHit: true })], events: [slashAt(0.06, { a0: -1.2, a1: 1.3, r: 46, w: 9, off: [8, 30] })] } };
const powderize = A => { const O = {}; for (const k in A) { const a = A[k]; O[k] = a.hits && a.basic ? { ...a, hits: a.hits.map(h => ({ ...h, type: 'indep', stun: (h.stun || 0.3) * 2.1, box: h.box && [h.box[0], h.box[1] * 1.25, h.box[2] * 1.2, h.box[3], h.box[4]], powder: true })) } : a; } return O; };
const WITCH_ACTS_P = powderize(WITCH_ACTS);
// 命中钩子（和战斗法师的钩子串起来）：扫把粉末的状态
{ const prev = CLASSES.mage.onHit; CLASSES.mage.onHit = (p, t, h, dmg, act, opt) => { if (prev) prev(p, t, h, dmg, act, opt); if (jobOf(p) !== WT || !h.powder) return; const P = p.buffs.wt_powder; if (!P) return;
  if (P.kind === 'ice') { if (Math.random() < 0.08 + 0.01 * (P.lv || 1)) addStatus(t, 'freeze', 1.2, { src: p }); } else addStatus(t, 'poison', 4, { src: p, dps: atkOf(p, 'indep') * (0.04 + 0.004 * (P.lv || 1)) }); }; }
// 扫把飞行：跳跃中用骑扫把的帧；空中冲刺 / 缓降（通用组的 airControl 钩子）
function witchModel(p) {
  const m = p.model; if (!m || m._wt || typeof m.frameOf !== 'function') return; m._wt = true; const f0 = m.frameOf.bind(m);
  m.frameOf = pose => { if (p._broom && p.st === 'jump') { const c = pose.__c; if (c === 'jumpUp' || c === 'jumpFall' || c === 'back') return p._airDash > 0 ? 'brDash' : 'brIdle'; } return f0(pose); };
}
CLASSES.mage.airControl = (p, I, dt) => {
  if (jobOf(p) !== WT || !hasSkill(p, 'wt_broom')) return false;
  if (p._airDash > 0) { p._airDash -= dt; p.vz = Math.max(p.vz, -30); }
  const rd = I.runDir ? I.runDir() : 0;
  if (rd && (p._dashN || 0) < 2 && !(p._airDash > 0)) { p._dashN = (p._dashN || 0) + 1; p._airDash = 0.3; p.face = rd; p.vx = rd * 420; p.vz = Math.max(p.vz, 60); fxStreak({ x: p.x, y: p.y, z: p.z + 50, face: -rd, len: 80, w: 10, col: '#e0c0ff', dur: 0.2 }); sfx.swing(false); return true; }
  if (I.is('jump') && p.vz < 0 && (p._glideN || 0) < 2) { if (!p._gliding) { p._gliding = true; p._glideN = (p._glideN || 0) + 1; } p.vz = Math.max(p.vz, -60); } else p._gliding = false;
  return false;
};
CLASSES.mage.jobs.witch = { art: 'job/witch', name: '魔道学者', role: '远程 · 机械', armor: 'leather', awaken: null, awakenName: '魔术师',
  desc: '好奇心旺盛、迷恋科学的魔法师。骑扫把从空中袭击，扔药瓶、放酸雨、搭乘自己发明的魔道机械作战；技能有失败 / 成功 / 大成功，失败了会被熏黑、摔倒。',
  skills: ['wt_broom', 'wt_affinity', 'wt_book', 'wt_shululu', 'wt_missile', 'wt_cloak', 'wt_powder', 'wt_lucky', 'wt_swatter', 'wt_lava', 'wt_acid', 'wt_swatlock', 'wt_spin', 'wt_tesla', 'wt_bitter', 'wt_furnace', 'wt_antigrav', 'wt_detonate', 'wt_drill', 'wt_premonition'] };
CLASSES.mage.cmds.push(['uu', 'wt_shululu'], ['fdf', 'wt_missile'], ['fd', 'wt_cloak'], ['df', 'wt_powder', 'buff'], ['ud', 'wt_book', 'buff'], ['bdf', 'wt_swatter'], ['udu', 'wt_lava'], ['udd', 'wt_acid'], ['dd', 'wt_spin'],
  ['bff', 'wt_tesla'], ['uff', 'wt_furnace'], ['dfd', 'wt_antigrav'], ['fuf', 'wt_drill']);
// ---- 被动刷新（每 0.25 秒）----
CLASSES.mage.passives.push(p => {
  const wt = jobOf(p) === WT;
  if (wt && p.buffs.wt_powder) { if (p.acts !== WITCH_ACTS_P) p.acts = WITCH_ACTS_P; } else if (wt) { if (p.acts !== WITCH_ACTS) p.acts = WITCH_ACTS; } else if (p.acts === WITCH_ACTS || p.acts === WITCH_ACTS_P) p.acts = MAGE_ACTS;
  if (!wt) return;
  const br = skLv(p, 'wt_broom'); p._broom = br > 0; p.airBonus = br > 0 ? 5 : 0; setPassive(p, 'wt_broom', br > 0, { cspd: 0.1 + 0.015 * br }); if (p._broom) witchModel(p);
  if (p.z <= 0.01) { p._dashN = 0; p._glideN = 0; }
  const lu = skLv(p, 'wt_lucky'); setPassive(p, 'wt_lucky', lu > 0, { dmg: 0.03 + 0.01 * lu });
  const pr = skLv(p, 'wt_premonition'); setPassive(p, 'wt_premonition', pr > 0, { crit: 0.05 + 0.005 * pr, critDmg: 0.05 + 0.01 * pr });
});
// 机械 / 舒露露的美术：魔道学者进城 / 进地下城时预先加载
function wtPreload() { const p = game.player; if (!p || p.cls !== 'mage' || jobOf(p) !== WT || typeof loadBundles !== 'function') return; const need = ['shululu', 'furnace', 'drill', 'tesla', 'antigrav', 'goblin', 'tau'].filter(b => !IMG[`spr/${b}/idle`]).map(b => 'spr:' + b); if (need.length) loadBundles(need).catch(() => { }); }
bus.on('sceneEnter', wtPreload); bus.on('dungeonEnter', wtPreload); bus.on('jobChange', wtPreload);
