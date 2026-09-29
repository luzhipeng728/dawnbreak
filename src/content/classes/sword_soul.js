/* =====================================================================
   转职：鬼泣（鬼剑士，jobId soulbender）—— 国服现版对齐（docs/SKILLS_OFFICIAL_sword.md 第 5 节）
   解开左臂的锁链、驾驭鬼神的剑士。魔法百分比，暗属性为主（萨亚为冰）。
   鬼神 = 召唤框架（src/game/summon.js）：萨亚 / 普戾蒙 / 罗刹 = field（同名只能有一个，再放会替换）；罗刹附身、卡洛冥炎、普戾蒙减益 = attach。
   鬼神解放（柔化）：攻击技能施放中按阵法技能键，不走动作直接放阵（落点随当前技能）。
   技能：鬼斩 / 月光斩 / 卡赞强化、封印解除、暗月降临、暗之亲和、残影之凯贾（改写普攻）、泯灭仪式、满月斩、鬼神解放、噬灵鬼斩、
   冰霜之萨亚、鬼影鞭、死亡墓碑、瘟疫之罗刹、鬼影闪、鬼影剑：狂怒、冥炎之卡洛（改写普攻）、冥炎剑，一觉 第7鬼神：怖拉修
   ===================================================================== */
const SB_COL = '#b08aff', SB_DARK = '#8a5aff', SB_ICE = '#9fe6ff';
const sbJob = p => jobOf(p) === 'soulbender';
const sbLv = (p, id) => (sbJob(p) ? skLv(p, id) : 0);
const sbUnseal = p => sbLv(p, 'sb_unseal') > 0;
const sbR = (p, r) => r * (sbUnseal(p) ? 1.15 : 1);   // 封印解除：阵法范围扩大
// 封印解除：卡赞、普戾蒙、鬼斩、萨亚、罗刹、卡洛技能等级 +1（只加在已学会的技能上）
const SB_UNSEAL_LV = new Set(['kazan', 'sb_plemon', 'ghost', 'sb_saya', 'sb_rasha', 'sb_karo']);
CLASSES.sword.lvBonus = (p, id) => jobOf(p) === 'soulbender' && SB_UNSEAL_LV.has(id) && lvOf(p, 'sb_unseal') > 0 ? 1 : 0;
// 当前技能决定柔化放阵的落点（官方：身前 100 / 自身 / 身后 100 / 身前 200）
const SB_FRONT2 = new Set(['sb_awaken', 'sb_purgatory', 'sb_descent', 'sb_awaken2', 'sb_ferry']);
function sbFieldAt(p) {
  const id = p.act && p.act.skill;
  const d = id === 'sb_tomb' ? 0 : id === 'sb_flash' ? -100 : SB_FRONT2.has(id) ? 200 : 100;
  return { x: p.x + p.face * d, y: p.y };
}
// 阵法技能：普通施放 = 施法动作后在身前放阵；学了鬼神解放后，在攻击技能中按键 = 不打断动作、直接放阵
const sbSoft = p => p.st === 'act' && p.act && p.act.skill && !p.act.basic && SKILLS[p.act.skill] && !SKILLS[p.act.skill].buff && sbLv(p, 'sb_release') > 0;
function sbFieldSkill(id, key, o) {
  defSkill(id, { ...o, cls: 'sword', job: 'soulbender', type: 'mag', elem: o.elem || 'dark', noForce: false,
    req: p => (p.st === 'act' && p.act && p.act.skill && !p.act.basic && !sbSoft(p)) ? '施放中' : true,
    act: lv => ({ name: id, clip: 'sbSummon', dur: 0.45, noCounter: true }),   // 只给 AI 选技能用；实际施放走 instant
    instant: (lv, p, extra) => {
      if (sbSoft(p)) { const at = sbFieldAt(p); fxSpr('ghost', at.x, at.y, 60, { w: 70, dur: 0.3, alpha: 0.6, col: o.col }); summon(p, key, { x: at.x, y: at.y, lv }); return; }
      p.doAct({ name: id, clip: 'sbSummon', dur: 0.45, noCounter: true, events: [evAt(0.18, e => { sfx.charge(); summon(e, key, { x: e.x + e.face * 100, y: e.y, lv }); })] }, extra);
    } });
}
// 地面的阵纹（每帧一次 drawImage + 旋转）与站立的鬼神形象（按 y 排序）。
// 可读性：阵会在玩家身边停很久，常驻部分保持低透明度（不挡怪物的红色预警）；鬼神形象只在放出时和结算（有敌人被命中）时亮起
const sbRing = (col, img = 'hexagram') => (c, s) => { const k = s.lifeT, al = Math.min(1, k * 4) * Math.min(1, (s.life - k) * 3), hi = k < 0.5 ? 0.6 : 0.3; drawSpr(c, fxTint(img, col), sx(s.x), sy(s.y, 0), s.r * 2.2, s.r * 0.8, { ground: true, rot: k * 0.5, alpha: hi * al }); };
const sbFigure = (img, h, col, steady = 0.3) => (c, s) => {
  const k = s.lifeT, end = Math.min(1, (s.life - k) * 3), flash = s.flashT ? Math.max(0, 1 - (game.t - s.flashT) / 0.3) : 0;
  const al = (k < 0.25 ? k / 0.25 * 0.9 : k < 0.9 ? 0.9 - (0.9 - steady) * (k - 0.25) / 0.65 : steady) + flash * 0.4;
  drawSpr(c, IMG['fx/' + img] ? img : fxTint('ghost', col), sx(s.x), sy(s.y, 0) + 4, 0, h * (0.92 + 0.08 * Math.sin(k * 3)), { ay: 1, alpha: Math.min(0.9, al) * end });
};

/* ---- 召唤物（鬼神）---- */
defSummon('sb_saya_f', { kind: 'field', tags: ['ghost', 'field'], max: 1, over: 'oldest', life: 5.1, r: 300, tick: 0.5, zMax: 160, type: 'mag', elem: 'ice',
  onSpawn: s => { s.r = sbR(s.owner, 300); sfx.ice(); fxShock(s.x, s.y, s.r * 1.2, SB_ICE); },
  onTick: (s, L) => { if (L.length) s.flashT = game.t; for (const t of L) { summonHit(s, t, { dmg: skillDmg(0.6, 0.06, s.lv), stun: 0.25, knock: 0, hs: 0.02, col: SB_ICE, elem: 'ice', type: 'mag' }); if (!t.dead && s.owner.sbSayaFreeze !== false && Math.random() < 0.5) addStatus(t, 'freeze', Math.min(3, 1.5 + 0.08 * (s.lv - 1)), { src: s.owner }); }
    if (Math.random() < 0.8) fxSpr('icespike', s.x + rnd(-s.r, s.r) * 0.7, s.y + rnd(-s.r, s.r) * 0.25, 0, { h: 50, dur: 0.35, ay: 1, grow: [0.2, 1] }); },
  draw: sbRing(SB_ICE), drawUpright: sbFigure('sb_saya', 150, SB_ICE) });
defSummon('sb_plemon_f', { kind: 'field', tags: ['ghost', 'field'], max: 1, over: 'oldest', life: 30, r: 300, tick: 0.5, zMax: 200, type: 'mag',
  onSpawn: s => { s.r = sbR(s.owner, 300); fxShock(s.x, s.y, s.r * 1.2, '#6aff9a'); },
  onTick: (s, L) => { for (const t of L) sbDebuff(s.owner, t, s.lv); },
  draw: sbRing('#6aff9a', 'rune'), drawUpright: sbFigure('sb_plemon', 130, '#6aff9a', 0.15) });
// 普戾蒙的减益：受到的伤害增加（离开阵后仍保留 30 秒），用挂在敌人身上的 attach 计时
defSummon('sb_plemon_on', { kind: 'attach', host: 'target', tags: ['ghost'], max: 60, over: 'oldest', life: 30,
  onSpawn: s => { const h = s.host; h.buffs = h.buffs || {}; h.buffs.sb_plemon = { t: 9999, taken: 0.2 + 0.02 * s.lv }; },
  onEnd: s => { const h = s.host; if (h && h.buffs) delete h.buffs.sb_plemon; },
  draw: (c, s) => { const h = s.host; if (!h || h.dead) return; drawSpr(c, fxTint('poison', '#6aff9a'), sx(h.x), sy(h.y, h.z + h.hurtH() + 10), 18, 0, { alpha: 0.7 }); } });
function sbDebuff(p, t, lv) { const S = summonsOf(p, 'sb_plemon_on').find(s => s.host === t); if (S) { S.lifeT = 0; return; } summon(p, 'sb_plemon_on', { target: t, lv }); }
defSummon('sb_rasha_f', { kind: 'field', tags: ['ghost', 'field'], max: 1, over: 'oldest', life: 5, r: 300, tick: 0.25, zMax: 160, type: 'mag',
  onSpawn: s => { s.r = sbR(s.owner, 300); fxShock(s.x, s.y, s.r * 1.2, '#c06aff'); },
  onTick: (s, L) => { for (const t of L) if (!summonsOf(s.owner, 'sb_rasha_on').some(a => a.host === t)) { summon(s.owner, 'sb_rasha_on', { target: t, lv: s.lv }); fxSpr('ghost', t.x, t.y, t.z + 50, { w: 50, dur: 0.3, col: '#c06aff' }); } },
  draw: sbRing('#c06aff', 'rune'), drawUpright: sbFigure('sb_rasha', 90, '#c06aff', 0.3) });
// 罗刹附身：10 秒内每秒腐蚀伤害，减速、降硬直，交替附加失明 / 诅咒
defSummon('sb_rasha_on', { kind: 'attach', host: 'target', tags: ['ghost'], max: 60, over: 'oldest', life: 10.5, tick: 1, hits: 10, type: 'mag',
  onTick: (s, h) => { summonHit(s, h, { dmg: skillDmg(0.35, 0.035, s.lv), stun: 0.05, knock: 0, hs: 0, col: '#c06aff', sure: true }); addStatus(h, 'slow', 1.2, { src: s.owner });
    if (s.hits % 3 === 0) addStatus(h, s.hits % 2 ? 'curse' : 'blind', 5, { src: s.owner }); },
  draw: (c, s) => { const h = s.host; if (!h || h.dead) return; drawSpr(c, IMG['fx/sb_rasha'] ? 'sb_rasha' : fxTint('ghost', '#c06aff'), sx(h.x + 8), sy(h.y, h.z + h.hurtH() * 0.7), 0, 34, { alpha: 0.75 }); } });
// 卡洛的冥炎：每秒 1 跳、共 5 跳；鬼影闪命中时一次引爆
defSummon('sb_karo_burn', { kind: 'attach', host: 'target', tags: ['ghost'], max: 60, over: 'oldest', life: 5.2, tick: 1, hits: 5, type: 'mag',
  onTick: (s, h) => summonHit(s, h, { dmg: skillDmg(0.25, 0.025, s.lv), stun: 0.02, knock: 0, hs: 0, col: '#9a5aff', sure: true }),
  draw: (c, s) => { const h = s.host; if (!h || h.dead) return; drawSpr(c, fxTint('flame', '#7a3aff'), sx(h.x), sy(h.y, h.z + h.hurtH() * 0.5), 0, 36, { rot: -1.57, alpha: 0.6 + 0.2 * Math.sin(game.t * 12) }); } });
function sbKaroBurn(p, t) { if (!t || t.dead || !sbJob(p)) return; const S = summonsOf(p, 'sb_karo_burn').find(s => s.host === t); if (S) { S.lifeT = 0; S.hits = 0; return; } summon(p, 'sb_karo_burn', { target: t, lv: sbLv(p, 'sb_karo') || 1 }); }
function sbKaroDetonate(p, t) { for (const S of summonsOf(p, 'sb_karo_burn').filter(s => s.host === t)) { const left = 5 - S.hits; dismissOne(S, 'cmd'); summonHit(S, t, { dmg: skillDmg(0.25, 0.025, S.lv) * left * 1.2, hs: 0.04, col: '#9a5aff', sure: true }); fxBurst(t.x, t.y, t.z + 40, 90, '#9a5aff'); } }

/* ---- 被动 ---- */
defSkill('sb_unseal', { name: '封印解除', cls: 'sword', job: 'soulbender', lvReq: 15, mp: 0, cd: 0, type: 'mag', passive: true, col: '#9a7aff',
  desc: '【被动】解开左臂的封印：魔法暴击率、施放速度提高，阵法（萨亚、普戾蒙、罗刹）范围扩大；卡赞、普戾蒙、鬼斩、萨亚、罗刹、卡洛的技能等级 +1。', infoExtra: lv => [['魔法暴击率', '+' + pct(0.01 + 0.004 * lv)], ['施放速度', '+20%'], ['阵法范围', '+15%']] });
defSkill('sb_darkmoon', { name: '暗月降临', cls: 'sword', job: 'soulbender', lvReq: 15, mp: 0, cd: 0, type: 'mag', passive: true, col: '#6a4ad8',
  desc: '【被动】暗月照临：暗属性强化提高（本作折算为技能伤害提高）。', infoExtra: lv => [['伤害', '+' + pct(0.02 + 0.004 * lv)]] });
defSkill('sb_dark', { name: '暗之亲和', cls: 'sword', job: 'soulbender', lvReq: 16, maxLv: 1, mp: 0, cd: 0, type: 'mag', passive: true, col: '#5a3ab0',
  desc: '【被动】与黑暗亲和：暗属性抗性 +20，光属性抗性 −10。' });
defSkill('sb_fullmoon', { name: '满月斩', cls: 'sword', job: 'soulbender', lvReq: 16, maxLv: 1, mp: 0, cd: 0, type: 'mag', passive: true, col: '#b0a0ff',
  desc: '【被动】月光斩的追加上斩之后，可以再按一次技能键追加一记双手上挑。' });
defSkill('sb_release', { name: '鬼神解放', cls: 'sword', job: 'soulbender', lvReq: 16, maxLv: 1, mp: 0, cd: 0, type: 'mag', passive: true, col: '#d08aff',
  desc: '【被动】施放攻击技能的过程中按下普戾蒙、萨亚、罗刹的技能键，不需要施放动作就能直接放出鬼神（不打断当前技能）。落点随当前技能：一般在身前，死亡墓碑在自身，鬼影闪在身后，一觉等大技能在更远的身前。' });
defSkill('sb_devour', { name: '噬灵鬼斩', cls: 'sword', job: 'soulbender', lvReq: 17, maxLv: 1, mp: 0, cd: 0, type: 'mag', passive: true, col: '#a06aff',
  desc: '【被动】鬼斩可以按住蓄力（很短）：蓄满时伤害提高、霸体并向前突进；鬼斩之后再按一次技能键，放出最后召唤的鬼神的冲击波（萨亚附带冰冻，普戾蒙附带睡眠，没有召唤过则是卡赞）。' });

/* ---- 残影之凯贾：自身 BUFF。暴击伤害、移速、回避提高；普攻变成 4 连暗属性魔法攻击，跑攻变成凯贾冲刺斩（冲刺开始时短暂无敌，冲刺中可以接鬼影闪）---- */
defSkill('sb_kaiga', { name: '残影之凯贾', cls: 'sword', job: 'soulbender', lvReq: 16, mp: 30, cd: 5, type: 'mag', buff: true, col: '#8a8aff',
  desc: '【BUFF · 持续时间无限】鬼神凯贾附身：暴击伤害、移动速度提高，身后跟着凯贾的鬼影；开始冲刺（跑动）时 1 秒无敌、身体变得半透明（每 3 秒最多一次）；普攻变为 4 连暗属性魔法攻击，跑动攻击变为凯贾冲刺斩（冲刺开始时短暂无敌，冲刺中可以接鬼影闪）。',
  ai: { kind: 'buff', core: true }, infoExtra: lv => [['暴击伤害', '+' + pct(0.05)], ['移动速度', '+' + pct(Math.min(0.33, 0.14 + 0.021 * (lv - 1)))], ['回避', '+5%']],
  act: (lv) => ({ name: 'sb_kaiga', clip: 'sbSummon', dur: 0.45, noCounter: true, onStart: e => { e.buffs.sb_kaiga = { t: 9999, critDmg: 0.05, mspd: Math.min(0.33, 0.14 + 0.021 * (lv - 1)), evade: 0.05, lv }; sfx.buff(); fxAura(e, '#8a8aff', 1); fxAfterimage(e, '#8a8aff'); } }) });
const sbHit = (t0, t1, box, dmg, o) => HB(t0, t1, box, dmg, { type: 'mag', elem: 'dark', hs: 0.05, ...o });
const SWORD_ACTS_KAIGA = { ...SWORD_ACTS,
  atk1: { name: 'atk1', dur: 0.32, basic: true, speed: 'aspd', chain: [0.12, 0.32], next: 'atk2', move: [[0.02, 0.08, 110]], type: 'mag',
    hits: [sbHit(0.06, 0.12, [0, 98, 34, 10, 110], 1.0, { stun: 0.3, knock: 50 })], events: [slashAt(0.05, { a0: -2.4, a1: 0.7, r: 74, w: 15, off: [14, 58], col: '#a89aff' })] },
  atk2: { name: 'atk2', dur: 0.32, basic: true, speed: 'aspd', chain: [0.12, 0.32], next: 'atk3', move: [[0.02, 0.08, 100]], type: 'mag',
    hits: [sbHit(0.06, 0.12, [0, 98, 34, 10, 110], 1.05, { stun: 0.32, knock: 55 })], events: [slashAt(0.05, { a0: 1.0, a1: -2.1, r: 72, w: 15, off: [12, 56], col: '#a89aff' })] },
  atk3: { name: 'atk3', dur: 0.4, basic: true, speed: 'aspd', chain: [0.18, 0.4], next: 'atk4', move: [[0.04, 0.12, 160]], type: 'mag',
    hits: [sbHit(0.1, 0.16, [0, 108, 36, 0, 120], 1.3, { stun: 0.45, knock: 120 })], events: [slashAt(0.09, { a0: -2.7, a1: 1.1, r: 84, w: 20, off: [10, 56], col: '#a89aff', heavy: true })] },
  atk4: { name: 'atk4', dur: 0.46, basic: true, speed: 'aspd', move: [[0.04, 0.14, 180]], type: 'mag',
    hits: [sbHit(0.08, 0.16, [0, 114, 38, 0, 120], 1.5, { stun: 0.5, knock: 200, heavy: true, shake: 2 })], events: [slashAt(0.07, { a0: -2.8, a1: 1.2, r: 90, w: 22, off: [10, 56], col: '#a89aff', heavy: true })] },
  dash: { name: 'dash', clip: 'dash', dur: 0.42, basic: true, speed: 'aspd', move: [[0, 0.24, 520]], type: 'mag', kaigaDash: true, invul: [0, 0.3], links: ['sb_flash'], noCounter: true,
    hits: [sbHit(0.02, 0.24, [-10, 88, 34, 10, 110], 1.4, { stun: 0.5, knock: 160, heavy: true })],
    events: [evAt(0.01, e => { fxAfterimage(e, '#8a8aff'); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 58, face: e.face, len: 160, w: 14, col: '#a89aff', dur: 0.22 }); sfx.swing(true); })] },
};
/* ---- 冥炎之卡洛：召唤卡洛飘在身后（持续时间无限）。普攻、跳攻、跑攻出手时卡洛额外发射分身（有凯贾时 3 连发），命中附加冥炎；
   再按一次切换冥炎 / 紫焰：紫焰的分身不附加冥炎（配合冥炎剑、鬼影闪引爆的节奏）。解锁冥炎剑 ---- */
defSkill('sb_karo', { name: '冥炎之卡洛', cls: 'sword', job: 'soulbender', lvReq: 20, mp: 40, cd: 3, type: 'mag', elem: 'dark', buff: true, col: '#7a3aff',
  desc: '【BUFF · 持续时间无限】召唤鬼神卡洛飘在身后：普攻、跳攻、跑攻出手时，卡洛额外向前发射分身（有残影之凯贾时一次 3 个），命中的敌人被附加冥炎（每秒 1 跳，共 5 跳，鬼影闪命中时一次引爆）。再按一次切换冥炎 / 紫焰：紫焰的分身不附加冥炎。只有卡洛在场时才能施放冥炎剑。',
  ai: { kind: 'buff', core: true }, pow: lv => skillDmg(0.8, 0.08, lv), infoExtra: lv => [['冥炎每跳', pct(skillDmg(0.25, 0.025, lv))]],
  act: (lv) => ({ name: 'sb_karo', clip: 'sbKaro', dur: 0.45, noCounter: true, onStart: e => { const B = e.buffs.sb_karo;
    if (B) { B.purple = !B.purple; B.lv = lv; fxText(B.purple ? '紫焰' : '冥炎', e.x, e.y, e.z + 24, { col: B.purple ? '#d08aff' : '#9a5aff', size: 12 }); sfx.buff(); fxAura(e, B.purple ? '#c06aff' : '#7a3aff', 0.6); }
    else { e.buffs.sb_karo = { t: 9999, lv, hl: '#8a3aff' }; sfx.buff(); fxAura(e, '#7a3aff', 1); }
    sbKaroFx(e); e.acts = swordActs(e); } }) });
// 卡洛飘在身后（紫焰模式变成亮紫色）；换房间清掉特效后由被动刷新补上
function sbKaroFx(e) {
  if (e._karoFx && fxList.includes(e._karoFx)) return;
  e._karoFx = addFx({ x: e.x - e.face * 40, y: e.y - 0.4, z: 0, dur: 1e9, add: true,
    update(dt) { this.x = damp(this.x, e.x - e.face * 40, 6, dt); this.y = e.y - 0.4; if (!e.buffs.sb_karo || e.dead || e.remove) this.t = this.dur; },
    draw(c) { const B = e.buffs.sb_karo, T = game.t; if (!B) return; drawSpr(c, B.purple ? fxTint('sb_karo', '#d08aff') : 'sb_karo', sx(this.x), sy(e.y, e.z + 100 + Math.sin(T * 3) * 5), 62, 0, { flip: e.face < 0, alpha: 0.9 }); } });
}
function sbKaroShot(e, n = 1) {
  const lv = (e.buffs.sb_karo && e.buffs.sb_karo.lv) || 1;
  for (let i = 0; i < n; i++) game.after(i * 0.06, () => { if (e.dead) return; sfx.swing(false);
    spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y + (i - (n - 1) / 2) * 8, z: e.z + 60, vx: e.face * 560, face: e.face, life: 0.55, w: 14, d: 14, h: 24, pierce: false,
      hit: { dmg: skillDmg(0.8, 0.08, lv) / Math.sqrt(n), stun: 0.25, knock: 40, hs: 0.03, type: 'mag', elem: 'dark', col: '#9a5aff' },
      onHitT: (pr, t) => { if (!pr.purple) sbKaroBurn(e, t); }, purple: !!(e.buffs.sb_karo && e.buffs.sb_karo.purple),
      draw(c, pr) { drawSpr(c, pr.purple ? fxTint('sb_karo', '#d08aff') : 'sb_karo', sx(pr.x), sy(pr.y, pr.z), 36, 0, { flip: pr.face < 0 }); } }); });
}
function sbKaroActs(kaiga) {   // 原来的普攻（或凯贾普攻）照常出手，出手瞬间卡洛额外发射分身
  const n = kaiga ? 3 : 1, base = kaiga ? SWORD_ACTS_KAIGA : SWORD_ACTS, out = { ...base };
  for (const k of ['atk1', 'atk2', 'atk3', 'atk4', 'dash', 'jatk', 'jatk2', 'jatk3']) if (base[k]) out[k] = { ...base[k], events: [...(base[k].events || []), evAt(0.05, e => sbKaroShot(e, n))] };
  return out;
}
const SWORD_ACTS_KARO = sbKaroActs(false), SWORD_ACTS_KARO_K = sbKaroActs(true);
SWORD_ACT_PICK.push(p => !sbJob(p) ? null : p.buffs.sb_karo ? (p.buffs.sb_kaiga ? SWORD_ACTS_KARO_K : SWORD_ACTS_KARO) : p.buffs.sb_kaiga ? SWORD_ACTS_KAIGA : null);
// 残影之凯贾（官方「前冲的一定时间内进入无敌状态」，无敌 1 秒）：凯贾附身时开始跑动 → 1 秒无敌（每 3 秒最多一次）。
// 外观（身后鬼影、残影、无敌半透明）在转职外观里（content/avatar/job_looks.js 的 soulbender）
CLASSES.sword.passives.push(p => {
  if (!sbJob(p) || !p.buffs.sb_kaiga || p.st !== 'run' || p.stT > 0.3 || game.t < (p._kgInvT || 0)) return;
  p._kgInvT = game.t + 3; p.invul = Math.max(p.invul, 1 - p.stT); fxAfterimage(p, '#8a8aff');
});

/* ---- 泯灭仪式：清除自己放出的普戾蒙、萨亚、罗刹 ---- */
defSkill('sb_purge', { name: '泯灭仪式', cls: 'sword', job: 'soulbender', lvReq: 16, maxLv: 1, mp: 5, cd: 1, type: 'mag', buff: true, col: '#6a5a9a',
  desc: '清除自己放出的普戾蒙、萨亚、罗刹之阵。', ai: { kind: 'buff' },
  act: () => ({ name: 'sb_purge', clip: 'sbSummon', dur: 0.15, noCounter: true, onStart: e => { for (const s of summonsOf(e, { tag: 'field' })) fxBurst(s.x, s.y, 30, 90, SB_COL); dismissSummons(e, { tag: 'field' }, 'cmd'); } }) });

/* ---- 阵法 ---- */
sbFieldSkill('sb_plemon', 'sb_plemon_f', { name: '侵蚀之普戾蒙', lvReq: 15, mp: 30, cd: 8, col: '#6aff9a',
  desc: '在身前召唤普戾蒙之阵（约 30 秒）：阵里的敌人受到的伤害增加，离开阵后减益仍保留 30 秒。同时只能有一个，再放会替换旧的。', ai: { kind: 'aoe', r: [0, 380], dy: 90, summon: 'sb_plemon_f' },
  infoExtra: lv => [['受到伤害', '+' + pct(0.2 + 0.02 * lv)]] });
sbFieldSkill('sb_saya', 'sb_saya_f', { name: '冰霜之萨亚', lvReq: 18, mp: 40, cd: 15, elem: 'ice', col: SB_ICE,
  desc: '在身前召唤萨亚之阵（5 秒）：每 0.5 秒对阵里的敌人造成冰属性魔法伤害，50% 几率冰冻。同时只能有一个。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [0, 380], dy: 90, summon: 'sb_saya_f' } });
sbFieldSkill('sb_rasha', 'sb_rasha_f', { name: '瘟疫之罗刹', lvReq: 19, mp: 45, cd: 20, col: '#c06aff',
  desc: '在身前生成瘟疫之阵（5 秒）：踩进阵里的敌人被罗刹的分身附身，之后 10 秒内（离开阵也不会掉）每秒受到腐蚀伤害并被减速，还会交替附加失明和诅咒。', pow: lv => skillDmg(3.5, 0.35, lv), ai: { kind: 'aoe', r: [0, 380], dy: 90, summon: 'sb_rasha_f' } });

/* ---- 鬼影鞭：像甩鞭一样挥剑两次，第二下把远处的敌人拉到身前；可以用普攻取消；卡洛附身时附加冥炎 ---- */
defSkill('sb_whip', { name: '鬼影鞭', cls: 'sword', job: 'soulbender', lvReq: 18, mp: 25, cd: 8, type: 'mag', elem: 'dark', col: '#a06aff',
  desc: '像甩鞭一样挥剑两次，第二下把远处的敌人拉到身前。可以用普攻取消后摇；卡洛附身时附加冥炎。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'poke', r: [0, 300], dy: 30 },
  act: (lv) => ({ name: 'sb_whip', clip: 'sbWhip', dur: 0.62, noCounter: true, chain: [0.36, 0.62], next: 'atk1',
    hits: [HB(0.1, 0.16, [0, 200, 34, 10, 110], skillDmg(1.2, 0.12, lv), { stun: 0.4, knock: 40, hs: 0.05, col: '#b08aff', onHit: (a, t) => { if (a.buffs.sb_karo) sbKaroBurn(a, t); } }),
      HB(0.3, 0.38, [20, 320, 38, 0, 120], skillDmg(2.8, 0.28, lv), { stun: 0.6, knock: 20, hs: 0.07, pull: true, col: '#b08aff', onHit: (a, t) => { t.x = a.x + a.face * 60; if (a.buffs.sb_karo) sbKaroBurn(a, t); } })],
    events: [evAt(0.08, e => { sfx.swing(true); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 200, w: 12, col: '#b08aff', dur: 0.16 }); }),
      evAt(0.28, e => { sfx.swing(true); fxStreak({ x: e.x + e.face * 20, y: e.y, z: e.z + 50, face: e.face, len: 310, w: 14, col: '#b08aff', dur: 0.2 }); })] }) });

/* ---- 死亡墓碑：以自身为中心，墓碑从天而降（1 秒），附加诅咒；霸体、不能移动，按跳跃中断；按 → 墓碑落在前方 ---- */
defSkill('sb_tomb', { name: '死亡墓碑', cls: 'sword', job: 'soulbender', lvReq: 19, mp: 45, cd: 18, type: 'mag', elem: 'dark', col: '#8a7aa0',
  desc: '以自身为中心召唤墓碑从天而降（约 1 秒，每秒 9 块），砸中的敌人被诅咒；落地的墓碑也有判定。施放中霸体、不能移动，按跳跃键中断；按 → 让墓碑落在前方。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [0, 180], dy: 70 },
  act: (lv) => ({ name: 'sb_tomb', clip: 'sbTomb', dur: 1.2, superArmor: true, noCounter: true,
    onStart: e => { e.act.off = e.pad.dx() * e.face > 0 ? 110 : 0; },
    onInput: (e, I) => { if (e.actT > 0.2 && I.buffered('jump')) { I.consume('jump'); e.endAct(); return true; } return false; },
    update: (e, dt) => { e.vx = 0; e.vy = 0; const a = e.act; a.tk = (a.tk || 0) + dt;
      if (e.actT > 0.1 && e.actT < 1.1 && a.tk >= 0.11) { a.tk = 0; const x = e.x + e.face * a.off + rnd(-150, 150), y = e.y + rnd(-40, 40);
        const img = IMG['fx/sb_tomb'] ? 'sb_tomb' : 'rock';
        addFx({ x, y: y + 0.4, z: 260, dur: 0.5, vz: -900, update(dt) { this.z = Math.max(0, this.z + this.vz * dt); }, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 0, 60, { ay: 1, add: false, alpha: k > 0.8 ? (1 - k) / 0.2 : 1 }); } });
        game.after(0.28, () => { if (e.dead) return; sfx.boom(0.3); fxDust(x, y, 3, 10); fxShock(x, y, 58, '#b0a0c0'); blast(e, x, y, 72, { dmg: skillDmg(0.6, 0.06, lv), stun: 0.35, knock: 30, hs: 0.03, type: 'mag', elem: 'dark', col: '#b0a0c0', downHit: true, onHit: (a2, t) => addStatus(t, 'curse', 12, { src: a2 }) }, { zMax: 120 }); }); } } }) });

/* ---- 鬼影闪：向前冲刺斩击，命中的敌人先被定住，随后暗属性爆发并强制倒地；引爆冥炎。二觉前只能在凯贾的冲刺中施放 ---- */
defSkill('sb_flash', { name: '鬼影闪', cls: 'sword', job: 'soulbender', lvReq: 19, mp: 45, cd: 20, type: 'mag', elem: 'dark', col: '#9a6aff',
  desc: '向前冲刺约 370 像素并斩击，命中的敌人先被短暂定住，随后暗属性爆发并强制倒地；会一次引爆敌人身上的冥炎。只能在残影之凯贾的冲刺斩（凯贾附身时的跑动攻击）中施放；学了御鬼之极后随时可用。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'gap', r: [0, 260], dy: 26 },
  req: p => (p.act && p.act.kaigaDash) || sbLv(p, 'sb_mastery') ? true : swordNeed(p, 'sb_kaiga', '凯贾的冲刺', `${swordHowTo(p, 'sb_kaiga')} 开启残影之凯贾，跑动攻击冲刺时再按`),
  act: (lv, p) => { const M = p && sbLv(p, 'sb_mastery') > 0; return { name: 'sb_flash', clip: 'dragon', dur: M ? 0.9 : 1.5, superArmor: true, noCounter: true, move: [[0, 0.2, 1260]], invul: [0, 0.2],   // 官方：没有御鬼之极时后摇约 2 秒、定住 0.3 秒；御鬼之极后后摇大减、定住更久
    onStart: e => { e.act.victims = []; e.act.hold = M ? 0.55 : 0.32; fxAfterimage(e, '#9a6aff'); sfx.iai(); cam.flash = Math.max(cam.flash || 0, 0.18); cam.flashCol = '#2a1250'; fxText('鬼影闪', e.x, e.y, e.z + 90, { col: '#c8a8ff', size: 14, dur: 0.6 }); },
    hits: [HB(0.02, 0.22, [-30, 78, 36, 0, 120], skillDmg(1.5, 0.15, lv), { stun: 1.0, knock: 0, hs: 0.04, col: '#b08aff', onHit: (a, t) => { if (a.act) a.act.victims.push(t); addStatus(t, 'root', a.act.hold, { src: a }); } })],
    events: [evAt(0.02, e => fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 420, w: 22, col: '#9a6aff', dur: 0.3 })),
      evAt(M ? 0.7 : 0.5, e => { cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9);
        for (const t of e.act.victims || []) { if (t.dead) continue; fxBurst(t.x, t.y, t.z + 40, 140, '#9a5aff'); applyHit(e, t, { dmg: skillDmg(5.5, 0.55, lv), down: true, knock: 60, hs: 0.1, big: 1.5, sure: true, type: 'mag', elem: 'dark', col: '#b08aff', downHit: true }, { proj: true }); sbKaroDetonate(e, t); } })] }; } });

/* ---- 鬼影剑：狂怒：剑中注入鬼神之力向前下劈，引发爆炸，单段高伤害 ---- */
defSkill('sb_fury', { name: '鬼影剑：狂怒', cls: 'sword', job: 'soulbender', lvReq: 19, mp: 50, cd: 20, type: 'mag', elem: 'dark', col: '#7a4aff',
  desc: '在剑中注入鬼神之力向前重重下劈，引发暗属性大爆炸（单段高伤害）。', pow: lv => skillDmg(8.0, 0.8, lv), ai: { kind: 'burst', r: [0, 220], dy: 40 },
  act: (lv) => ({ name: 'sb_fury', clip: 'a3slam', dur: 0.75, superArmor: true, noCounter: true,
    events: [evAt(0.05, e => { sfx.charge(); fxAura(e, '#7a4aff', 0.4); }), evAt(0.32, e => { const x = e.x + e.face * 100; cam.shake = Math.max(cam.shake, 8); sfx.boom(1.1); sfx.iai();
      fxSlashOn(e, { col: '#9a6aff', a0: -2.8, a1: 1.2, r: 100, w: 26, off: [10, 56], heavy: true }); fxSpr('explosion', x, e.y, 40, { w: 260, dur: 0.45, col: '#8a5aff', grow: [0.4, 1.1] }); fxShock(x, e.y, 220, '#8a5aff');
      blast(e, x, e.y, 150, { dmg: skillDmg(8.0, 0.8, lv), launch: 380, knock: 140, hs: 0.14, big: 1.8, type: 'mag', elem: 'dark', col: '#b08aff', downHit: true }, { zMax: 180 }); })] }) });

/* ---- 冥炎剑（仅卡洛附身中）：双持冥炎剑向前突进 4 段斩，伤害逐段递增，方向键调整距离，附加冥炎 ---- */
defSkill('sb_karoblade', { name: '冥炎剑', cls: 'sword', job: 'soulbender', lvReq: 20, mp: 55, cd: 45, type: 'mag', elem: 'dark', col: '#8a3aff', req: p => p.buffs && p.buffs.sb_karo ? true : swordNeed(p, 'sb_karo', '冥炎之卡洛'),
  desc: '【冥炎之卡洛附身中】召唤凝聚卡洛之力的冥炎剑，以二刀流向前突进 4 段连斩，伤害逐段递增，命中附加冥炎。方向键调整突进距离。', pow: lv => skillDmg(10.0, 1.0, lv), ai: { kind: 'gap', r: [0, 220], dy: 26 },
  act: (lv) => ({ name: 'sb_karoblade', clip: 'bzA1', dur: 1.2, superArmor: true, noCounter: true,
    onStart: e => { const d = e.pad.dx() * e.face; e.act.step = d > 0 ? 260 : d < 0 ? 60 : 160; },
    events: [0, 1, 2, 3].map(i => evAt(0.08 + i * 0.22, e => { e.play(['dual1', 'dual3', 'dual2', 'dual4'][i], true); e.vx = e.face * e.act.step * 3; sfx.swing(true);
      fxSlashOn(e, { col: '#9a4aff', a0: i % 2 ? 1.0 : -2.4, a1: i % 2 ? -2.4 : 1.0, r: 94, w: 20, off: [10, 56], heavy: i === 3 });
      game.after(0.06, () => { if (e.dead) return; e.vx = 0; instantHit(e, { box: [-10, 126, 40, 0, 120], dmg: skillDmg([0.84, 1.23, 2.64, 4.29][i], [0.084, 0.123, 0.264, 0.429][i], lv), stun: 0.5, knock: i === 3 ? 240 : 40, launch: i === 3 ? 300 : 0, hs: 0.06, type: 'mag', elem: 'dark', col: '#b08aff',
        onHit: (a, t) => sbKaroBurn(a, t) }); }); })) }) });

/* ---- 一觉：第7鬼神：怖拉修。沼泽在前方扩大 → 巨口鬼神破土而出（冲击波击倒）→ 合嘴吞噬（主要伤害）；场上每有一只鬼神伤害 +20%（最多 4 只）。施放中无敌 ---- */
defSkill('sb_awaken', { name: '第7鬼神：怖拉修', cls: 'sword', job: 'soulbender', lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'mag', elem: 'dark', awaken: true, col: '#5a2a9a',
  desc: '【觉醒】唤出禁断的第 7 鬼神怖拉修：挥剑砸地召出沼泽，沼泽逐渐扩大，巨口鬼神破土而出、张口放出冲击波，随即合嘴吞噬一切。命中的敌人被大幅减速，自身回避率提高 15 秒。场上每有一只鬼神（卡赞、普戾蒙、萨亚、罗刹、凯贾、卡洛），伤害提高 20%（最多 3 只，3 级起 4 只）。施放中无敌。',
  pow: lv => skillDmg(24, 6, lv), ai: { kind: 'awaken', r: [0, 420], dy: 90 },
  act: (lv) => ({ name: 'sb_awaken', clip: 'sbSummon', dur: 2.6, superArmor: true, noCounter: true, invul: [0, 2.6],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '第7鬼神：怖拉修', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act; a.cx = e.x + e.face * 200; a.cy = e.y;
      const n = Math.min(lv >= 3 ? 4 : 3, summonsOf(e, { tag: 'field' }).length + (e.buffs.kazan || sbLv(e, 'kazan') ? 1 : 0) + (e.buffs.sb_kaiga ? 1 : 0) + (e.buffs.sb_karo ? 1 : 0)); a.m = 1 + 0.2 * n;
      a.fx = addFx({ x: a.cx, y: a.cy - 50, z: 0, dur: 2.6, a, draw(c) { const A = this.a, k = this.t, sw = Math.min(1, k / 1.6);
        drawSpr(c, fxTint('darkorb', '#3a1a6a'), sx(A.cx), sy(A.cy, 0), 100 + 520 * sw, 40 + 180 * sw, { alpha: 0.8, add: false });
        if (k > 1.6) { const q = Math.min(1, (k - 1.6) * 3), bite = k > 2.1; drawSpr(c, IMG['fx/sb_brasha'] ? 'sb_brasha' : fxTint('ghost', '#7a3aff'), sx(A.cx), sy(A.cy, 0) + 10, 0, (bite ? 280 : 320) * q, { ay: 1, alpha: Math.min(1, (2.6 - k) * 3), add: !IMG['fx/sb_brasha'] }); } } }); },
    events: [evAt(1.6, e => { const a = e.act; cam.shake = Math.max(cam.shake, 10); sfx.boom(1.2); fxShock(a.cx, a.cy, 400, '#8a5aff');
        blast(e, a.cx, a.cy, 320, { dmg: skillDmg(10.2, 2.55, lv) * a.m, stun: 0.8, knock: 60, hs: 0.1, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { zMax: 260, status: 'slow', sdur: 6 });
        e.buffs.sb_blasha = { t: 15 }; fxAura(e, '#8a5aff', 0.8); }),
      evAt(2.1, e => { const a = e.act; cam.flash = 0.3; cam.flashCol = '#c8a8ff'; cam.shake = 14; sfx.boom(1.4); sfx.iai();
        for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.4) < 360) { t.x = lerp(t.x, a.cx, 0.6); t.y = lerp(t.y, a.cy, 0.6); }
        blast(e, a.cx, a.cy, 340, { dmg: skillDmg(13.8, 3.45, lv) * a.m, stun: 1.0, knock: 80, hs: 0.2, big: 2.2, critBonus: 0.2, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { zMax: 320, status: 'slow', sdur: 6 }); })] }) });
// 怖拉修的余威：15 秒内受到攻击时 15% 几率回避（官方：自身回避率提高）
SWORD_HOOKS.beforeHurt.push((p, a, h) => { if (!sbJob(p) || !p.buffs.sb_kaiga || h.sure || h.grab || Math.random() >= 0.05) return null; fxText('MISS', p.x, p.y, p.z, { col: '#d8d8d8', size: 12, dur: 0.5 }); return { block: true }; });
SWORD_HOOKS.beforeHurt.push((p, a, h) => { if (!p.buffs.sb_blasha || !sbJob(p) || h.sure || h.grab || Math.random() >= 0.15) return null; fxText('MISS', p.x, p.y, p.z, { col: '#d8d8d8', size: 12, dur: 0.5 }); return { block: true }; });

/* ---- 基础技能的鬼泣强化：鬼斩（噬灵鬼斩：蓄力 + 追加鬼神冲击波）、月光斩（普攻取消后摇 + 满月斩）、卡赞（转职后变被动）---- */
{
  const G = SKILLS.ghost, act0 = G.act;
  G.act = (lv, p) => {
    const a = act0(lv, p); if (!p || !sbJob(p)) return a;
    if (sbLv(p, 'sb_devour')) {
      a.charge = { at: 0.04, max: 0.15, min: 0, dmg: 0.4, update: e => { if (Math.random() < 0.6) fxCharge(e, SB_COL); }, onRelease: (e, k) => { if (k > 0.95) { e.superArmor = Math.max(e.superArmor, 1.5); e.vx = e.face * 420; fxAfterimage(e, SB_COL); } } };
      a.follow = () => sbGhostWave(lv, p); a.followWin = [0.3, 0.56];
    }
    return a;
  };
  G.act._sb = true;
}
function sbGhostWave(lv, p) {   // 噬灵鬼斩的追加：最后召唤的鬼神冲击波
  const last = summonsOf(p, { tag: 'field' }).slice(-1)[0], k = sbLv(p, 'sb_crown') ? 'sb_blade_f' : last ? last.skey : 'kazan';   // 鬼神冠冕（三觉被动）后固定为布雷德之气
  const col = k === 'sb_saya_f' ? SB_ICE : k === 'sb_plemon_f' ? '#6aff9a' : k === 'sb_rasha_f' ? '#c06aff' : k === 'sb_blade_f' ? '#cfd8ff' : '#ff5a4a';
  const back = p.pad.dx() * p.face < 0;
  return { name: 'sb_ghostwave', clip: 'sbSummon', dur: 0.45, noCounter: true, move: back ? [] : [[0.02, 0.1, 80]],
    events: [evAt(0.1, e => { sfx.boom(0.6); projWave(e, { speed: 520, life: 0.65, h: 125, col, hit: { dmg: skillDmg(2.0, 0.2, lv), knock: 160, launch: 240, hs: 0.06, downHit: true, type: 'mag', elem: k === 'sb_saya_f' ? 'ice' : 'dark',
      onHit: (a, t) => { if (Math.random() < 0.9) { if (k === 'sb_saya_f') addStatus(t, 'freeze', 1.9, { src: a }); else if (k === 'sb_plemon_f') addStatus(t, 'sleep', 5, { src: a }); }; } } }); })] };
}
{
  const M = SKILLS.moon, act0 = M.act;
  M.act = (lv, p) => {
    const a = act0(lv, p); if (!p || !sbJob(p)) return a;
    a.chain = [0.3, 0.46]; a.next = 'atk1';   // 鬼泣：普攻取消后摇
    if (sbLv(p, 'sb_fullmoon')) { const f0 = a.follow; a.follow = () => { const b = f0(); b.chain = [0.28, 0.44]; b.next = 'atk1'; b.follow = e => sbLv(e, 'sb_crown') ? sbCrownMoon(lv) : sbFullMoon(lv); b.followWin = [0.14, 0.44]; return b; }; }
    return a;
  };
}
function sbFullMoon(lv) {
  return { name: 'moon3', clip: 'rise', dur: 0.5, noCounter: true, move: [[0.02, 0.12, 100]],
    hits: [HB(0.08, 0.18, [-10, 104, 38, 0, 150], skillDmg(2.0, 0.2, lv), { launch: 520, knock: 30, hs: 0.09, shake: 3, type: 'mag', elem: 'dark' })],
    events: [slashAt(0.07, { a0: 1.4, a1: -1.9, r: 92, w: 24, off: [10, 50], col: '#d8c8ff', heavy: true })] };
}
// 满月斩（鬼神冠冕后）：上挑划出一轮满月 → 月亮被染黑 → 横斩击碎，碎片四散（打击在击碎那一下，附带失明见 onHit 钩子）
function sbCrownMoon(lv) {
  return { name: 'moon3', clip: 'rise', dur: 0.72, noCounter: true, move: [[0.02, 0.1, 60]],
    hits: [HB(0.42, 0.52, [0, 130, 44, 0, 170], skillDmg(2.4, 0.24, lv), { launch: 480, knock: 60, hs: 0.1, shake: 4, big: 1.4, type: 'mag', elem: 'dark' })],
    events: [slashAt(0.05, { a0: 1.4, a1: -1.9, r: 76, w: 20, off: [10, 50], col: '#e8e0ff' }),
      evAt(0.08, e => sbMoonFx(e, e.x + e.face * 70, e.y, e.z + 95, 0.62)),
      evAt(0.38, e => { e.play(e.clipOr('atk2', 'atk3'), true); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, a0: -0.9, a1: 0.8, r: 96, w: 26, off: [14, 70], col: '#b080ff', dur: 0.18 }); sfx.swing(true); }),
      evAt(0.44, e => { sfx.boom(0.5); cam.shake = Math.max(cam.shake, 4); fxBurst(e.x + e.face * 70, e.y, e.z + 95, 120, '#8a5ae0'); })] };
}
// 程序画的月亮：0~0.3 造月（淡金白的满月长出来）→ 0.3~0.58 染黑（黑影从一侧漫过去，只剩紫色的边）→ 0.58 起击碎（楔形碎片四散淡出）
function sbMoonFx(e, x, y, z, dur) {
  const R = 52, N = 10, shards = Array.from({ length: N }, (_, i) => { const a = (i + rnd(-0.3, 0.3)) * TAU / N; return { a, w: TAU / N * rnd(0.8, 1.1), v: rnd(160, 260), spin: rnd(-8, 8) }; });
  addFx({ x, y: y + 0.6, z, dur, face: e.face, draw(c) {
    const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, this.z);
    c.save();
    if (k < 0.58) {
      const g = clamp(k / 0.3, 0, 1), r = R * (0.25 + 0.75 * easeOut(g)), dk = clamp((k - 0.3) / 0.28, 0, 1);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * g;
      const halo = c.createRadialGradient(X, Y, r * 0.6, X, Y, r * 1.8); halo.addColorStop(0, dk > 0 ? 'rgba(170,110,255,0.8)' : 'rgba(255,245,210,0.8)'); halo.addColorStop(1, 'rgba(120,80,255,0)');
      c.fillStyle = halo; c.beginPath(); c.arc(X, Y, r * 1.8, 0, TAU); c.fill();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = g;
      const body = c.createRadialGradient(X - r * 0.3, Y - r * 0.3, r * 0.1, X, Y, r); body.addColorStop(0, '#fffbe8'); body.addColorStop(1, '#e8dcff');
      c.fillStyle = body; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fill();
      if (dk > 0) {   // 染黑：黑影从背对角色的一侧漫过整个月面
        c.save(); c.beginPath(); c.arc(X, Y, r, 0, TAU); c.clip();
        c.fillStyle = '#140a22'; c.beginPath(); c.arc(X + this.face * r * 2 * (1 - dk * dk * (3 - 2 * dk)), Y, r * 1.15, 0, TAU); c.fill(); c.restore();
        c.strokeStyle = `rgba(190,140,255,${0.5 + 0.5 * dk})`; c.lineWidth = 2.5; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.stroke();
      }
    } else {   // 击碎
      const q = (k - 0.58) / 0.42, d = easeOut(q);
      for (const s of shards) {
        c.save(); c.translate(X + Math.cos(s.a) * s.v * d * 0.5, Y + Math.sin(s.a) * s.v * d * 0.5 + 40 * q * q); c.rotate(s.spin * q);
        c.globalAlpha = 1 - q;
        c.fillStyle = '#1c0e30'; c.strokeStyle = '#c09aff'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R * (1 - 0.3 * q), s.a - s.w / 2, s.a + s.w / 2); c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - q) * 0.7; c.strokeStyle = '#d0b0ff'; c.lineWidth = 3;
      c.beginPath(); c.arc(X, Y, R * (1 + q * 1.6), 0, TAU); c.stroke();
    }
    c.restore();
  } });
}
{ const K = SKILLS.kazan, r0 = K.req; K.req = p => sbJob(p) ? '鬼泣已转为被动' : r0 ? r0(p) : true; }

/* =====================================================================
   鬼泣 P1（官方 48–100 级 → 本作 21–30 级）：恐惧光环、鬼斩：炼狱、冥祭之沼、御鬼之极（二觉被动）、幽魂之布雷德、幽魂降临：式、
   王者号令：吉格降临（二觉）、鬼神冠冕、鬼神剑·黄泉摆渡、黄泉之门：万鬼度灵（三觉）
   ===================================================================== */
const sbImg = (name, fb, col) => IMG['fx/' + name] ? name : fxTint(fb, col);
defSkill('sb_fear', { name: '恐惧光环', cls: 'sword', job: 'soulbender', lvReq: 21, mp: 0, cd: 0, type: 'mag', passive: true, col: '#7a5ab0',
  desc: '【被动 · 一觉】散发恐惧的气息：技能攻击力提高，每 2 秒让周围的敌人减速。', infoExtra: lv => [['技能攻击力', '+' + pct(0.04 + 0.008 * lv)]] });
defSkill('sb_mastery', { name: '御鬼之极', cls: 'sword', job: 'soulbender', lvReq: 26, maxLv: 1, mp: 0, cd: 0, type: 'mag', passive: true, col: '#9a6aff',
  desc: '【被动 · 二觉】驾驭鬼神达到极致：技能攻击力提高；鬼影闪随时可以施放；转职技能命中时自动附加普戾蒙的减益（受到的伤害增加）。' });
defSkill('sb_crown', { name: '鬼神冠冕', cls: 'sword', job: 'soulbender', lvReq: 29, mp: 0, cd: 0, type: 'mag', passive: true, col: '#c0a0ff',
  desc: '【被动 · 三觉】九大鬼神之王的冠冕：技能攻击力提高；满月斩改变形态——划出一轮满月，把它染黑后一刀击碎，附带失明。', infoExtra: lv => [['技能攻击力', '+' + pct(0.06 + 0.012 * lv)]] });

/* ---- 鬼斩：炼狱：斩裂地面，冥界之刃从地下升起定住敌人 2 秒，随后刀刃崩碎再斩一次（同一敌人最多 2 段；现版没有爆炸）---- */
defSkill('sb_purgatory', { name: '鬼斩：炼狱', cls: 'sword', job: 'soulbender', lvReq: 23, mp: 70, cd: 30, type: 'mag', elem: 'dark', col: '#8a3aff',
  desc: '斩裂前方的地面（斩击），6 把冥界之刃从地下升起，刺中的敌人被强制定住 2 秒，随后冥界之刃崩碎并爆炸（斩击 → 升剑 → 爆炸，同一个敌人最多命中 3 次）。', pow: lv => skillDmg(14, 1.4, lv), ai: { kind: 'aoe', r: [0, 380], dy: 60 },
  act: (lv) => ({ name: 'sb_purgatory', clip: 'a3slam', dur: 0.9, superArmor: true, noCounter: true,
    events: [evAt(0.3, e => { const x0 = e.x, f = e.face, y = e.y; cam.shake = 8; sfx.boom(1); fxShock(x0 + f * 100, y, 200, '#8a3aff');
      const L = [];
      for (const t of ents) if (hittable(e, t) && (t.x - x0) * f > 0 && Math.abs(t.x - x0) < 430 && Math.abs(t.y - y) < 62) applyHit(e, t, { dmg: skillDmg(1.7, 0.17, lv), stun: 0.2, knock: 0, hs: 0.03, sure: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { proj: true });   // 官方第 1 段：斩裂地面的斩击
      for (let i = 0; i < 6; i++) game.after(i * 0.05, () => { if (e.dead) return; const x = x0 + f * (60 + i * 64); fxSpr('swordrain', x, y, 0, { h: 180, dur: 2.1, ay: 1, col: '#9a4aff', grow: [0.2, 1], rot: Math.PI });
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - x) < 46 && Math.abs(t.y - y) < 62 && !L.includes(t)) { L.push(t); addStatus(t, 'root', 2, { src: e }); applyHit(e, t, { dmg: skillDmg(6.6, 0.66, lv), stun: 0.5, knock: 0, hs: 0.05, sure: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { proj: true }); } });
      game.after(2.0, () => { if (e.dead) return; cam.shake = Math.max(cam.shake, 9); sfx.boom(1.2); for (const t of L) if (!t.dead) { fxSlashX(t.x, t.y, t.z + 50, 180, '#9a4aff'); fxSpr('swordrain', t.x, t.y, 0, { h: 180, dur: 0.3, ay: 1, col: '#9a4aff', grow: [1, 0.2], rot: Math.PI }); fxSpr('explosion', t.x, t.y, 40, { w: 200, dur: 0.4, col: '#8a3aff', grow: [0.4, 1.1] }); applyHit(e, t, { dmg: skillDmg(5.7, 0.57, lv), launch: 420, knock: 100, hs: 0.12, big: 1.6, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { proj: true }); } }); })] }) });

/* ---- 冥祭之沼：身边升起 3 块封印墓碑，强开冥界之门把敌人往中心吸 5 秒；到时间或再按一次，墓碑自爆（按前 / 后方向键移动位置）---- */
defSummon('sb_swamp_f', { kind: 'field', tags: ['ghost', 'field'], max: 1, over: 'oldest', life: 5, r: 150, zMax: 200, type: 'mag',
  onSpawn: s => { fxShock(s.x, s.y, 300, '#6a3a9a'); sfx.boom(0.6); },
  // 官方：吸引 380px、5 秒，吸引本身没有伤害（伤害全在墓碑自爆）
  update: (s, dt) => { for (const t of ents) if (foe(s.owner, t) && !t.boss && t.invul <= 0 && t.st !== 'held' && Math.hypot(t.x - s.x, (t.y - s.y) * 1.6) < 400) { t.x = damp(t.x, s.x, 3, dt); t.y = damp(t.y, s.y, 3, dt); } },
  onEnd: (s, why) => { if (why === 'owner' || why === 'room') return; cam.shake = Math.max(cam.shake, 10); sfx.boom(1.3); for (let i = 0; i < 3; i++) { const a = i * TAU / 3; fxSpr('explosion', s.x + Math.cos(a) * 110, s.y + Math.sin(a) * 38, 30, { w: 220, dur: 0.45, col: '#9a5aff' }); } fxShock(s.x, s.y, 320, '#9a5aff');
    summonArea(s, s.x, s.y, 260, { dmg: skillDmg(10, 1, s.lv), launch: 460, knock: 120, hs: 0.14, big: 1.8, downHit: true, col: '#b08aff' }, { zMax: 260 }); },
  draw: (c, s) => drawSpr(c, fxTint('darkorb', '#3a1a5a'), sx(s.x), sy(s.y, 0), 500, 170, { alpha: 0.5, add: false, ground: true, rot: s.lifeT * 0.3 }),
  drawUpright: (c, s) => { for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5; drawSpr(c, sbImg('sb_tomb', 'rock', '#8a8a9a'), sx(s.x + Math.cos(a) * 120), sy(s.y + Math.sin(a) * 40, 0), 0, 74 * Math.min(1, s.lifeT * 4), { ay: 1, add: false }); } } });
defSkill('sb_swamp', { name: '冥祭之沼', cls: 'sword', job: 'soulbender', lvReq: 25, mp: 80, cd: 40, type: 'mag', elem: 'dark', col: '#6a3a9a', noHitCheck: true,
  desc: '身边升起 3 块封印墓碑，强行打开冥界之门，把 380 像素内的敌人往中心吸 5 秒；到时间或再按一次技能键，墓碑一起自爆。按前 / 后方向键把位置向前 / 向后移动。', pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'aoe', r: [0, 300], dy: 80, summon: 'sb_swamp_f' },
  recast: { ok: p => summonsOf(p, 'sb_swamp_f').length > 0, cd: 0.3, act: () => ({ name: 'sb_swamp2', clip: 'sbSummon', dur: 0.3, noCounter: true, onStart: e => dismissSummons(e, 'sb_swamp_f', 'cmd') }) },
  act: (lv) => ({ name: 'sb_swamp', clip: 'sbPlace', dur: 0.5, noCounter: true, events: [evAt(0.2, e => { const d = e.pad.dx() * e.face; summon(e, 'sb_swamp_f', { x: e.x + e.face * (d > 0 ? 100 : d < 0 ? -100 : 0), y: e.y, lv }); })] }) });

/* ---- 幽魂之布雷德：刀魂阵（8 秒），幽魂魔法斩多段攻击，僵直很高，最后一记强力终结斩；再按一次提前终结（至少间隔 1 秒）---- */
defSummon('sb_blade_f', { kind: 'field', tags: ['ghost', 'field'], max: 1, over: 'oldest', life: 8, r: 300, tick: 0.35, zMax: 200, type: 'mag',
  onSpawn: s => { s.r = sbR(s.owner, 300); fxShock(s.x, s.y, s.r * 1.2, '#b8c8e0'); },
  onTick: (s, L) => { if (L.length) s.flashT = game.t; for (const t of L) { summonHit(s, t, { dmg: skillDmg(0.6, 0.06, s.lv), stun: 0.6, knock: 0, hs: 0.03, col: '#dfe8ff' }); fxSlashX(t.x + rnd(-14, 14), t.y, t.z + 50, rnd(70, 100), '#cfe0ff'); } },
  onEnd: (s, why) => { if (why === 'owner' || why === 'room') return; cam.shake = Math.max(cam.shake, 8); sfx.iai(); fxSlashX(s.x, s.y, 60, 420, '#e8f0ff'); fxShock(s.x, s.y, s.r + 40, '#e8f0ff');
    summonArea(s, s.x, s.y, s.r + 20, { dmg: skillDmg(8, 0.8, s.lv), launch: 420, knock: 120, hs: 0.12, big: 1.6, downHit: true, col: '#e8f0ff' }, { zMax: 260 }); },
  draw: sbRing('#b8c8e0'), drawUpright: sbFigure('sb_blade', 180, '#b8c8e0', 0.35) });
defSkill('sb_blade', { name: '幽魂之布雷德', cls: 'sword', job: 'soulbender', lvReq: 26, mp: 90, cd: 40, type: 'mag', elem: 'dark', col: '#b8c8e0',
  desc: '在身前召唤刀魂布雷德之阵（8 秒）：幽魂斩击反复攻击阵里的敌人（僵直很高），结束时一记强力终结斩。再按一次技能键（放出 1 秒后）提前终结。同时只能有一个。', pow: lv => skillDmg(18, 1.8, lv), ai: { kind: 'aoe', r: [0, 380], dy: 90, summon: 'sb_blade_f' },
  recast: { ok: p => summonsOf(p, 'sb_blade_f').some(s => s.lifeT > 1), cd: 0.3, act: () => ({ name: 'sb_blade2', clip: 'sbSummon', dur: 0.3, noCounter: true, onStart: e => dismissSummons(e, 'sb_blade_f', 'cmd') }) },
  act: (lv) => ({ name: 'sb_blade', clip: 'sbSummon', dur: 0.5, noCounter: true, events: [evAt(0.2, e => summon(e, 'sb_blade_f', { x: e.x + e.face * 100, y: e.y, lv }))] }) });

/* ---- 幽魂降临：式：跃到空中让布雷德附身，射出灵剑斩向地面并爆炸（按 → 往前跳、按 ↓ 往后跳；空中可用）---- */
defSkill('sb_descent', { name: '幽魂降临：式', cls: 'sword', job: 'soulbender', lvReq: 26, mp: 90, cd: 45, type: 'mag', elem: 'dark', air: true, col: '#a0b0e0',
  desc: '跃到空中让布雷德附身，射出灵剑斩向地面并爆炸。按 → 往前跳，按 ↓ 往后跳；空中也能施放。', pow: lv => skillDmg(18, 1.8, lv), ai: { kind: 'aoe', r: [40, 330], dy: 70 },
  act: (lv) => ({ name: 'sb_descent', clip: 'sbDescent', dur: 1.2, superArmor: true, noCounter: true, lowGrav: 0.3,
    onStart: e => { const d = e.pad.dx() * e.face, back = e.pad.dy() > 0; e.vz = e.z > 2 ? 200 : 540; e.z = Math.max(e.z, 1); e.vx = e.face * (back ? -220 : d > 0 ? 260 : 60); sfx.jump(); fxSpr(sbImg('sb_blade', 'ghost', '#b8c8e0'), e.x, e.y, e.z + 20, { h: 160, dur: 0.5, alpha: 0.6 }); },
    events: [evAt(0.45, e => { const x = e.x + e.face * 160, y = e.y; e.vx = 0; sfx.iai();
      fxStreak({ x: e.x, y, z: e.z + 40, face: e.face, len: 180, w: 18, col: '#cfd8ff', dur: 0.2 });
      game.after(0.12, () => { if (e.dead) return; cam.shake = Math.max(cam.shake, 6); sfx.iai(); fxSpr('swordrain', x, y, 0, { h: 240, dur: 0.4, ay: 1, col: '#cfd8ff' }); fxSlashX(x, y, 50, 210, '#cfd8ff');
        blast(e, x, y, 170, { dmg: skillDmg(7.2, 0.72, lv), stun: 0.6, knock: 20, hs: 0.08, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#cfd8ff' }, { zMax: 260 }); });
      game.after(0.32, () => { if (e.dead) return; cam.shake = Math.max(cam.shake, 10); sfx.boom(1.2); fxShock(x, y, 300, '#b8c8e0'); fxBurst(x, y, 30, 300, '#9a8aff');
        blast(e, x, y, 220, { dmg: skillDmg(10.8, 1.08, lv), launch: 460, knock: 120, hs: 0.14, big: 1.8, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#cfd8ff' }, { zMax: 260 }); }); })],
    onLand: e => { if (e.actT > 0.5) e.endAct(); } }) });

/* ---- 王者号令：吉格降临（二觉）：召唤阵里魑魅魍魉攻击周围敌人、附加诅咒、把敌人吸向中心；吉格现身定住并攻击敌人、撕开地狱裂缝；
   最后吉格被拖回地下，同时处决 HP 低的敌人（普通 30% / 精英 10%，领主免疫）。全程无敌 ---- */
defSkill('sb_awaken2', { name: '王者号令：吉格降临', cls: 'sword', job: 'soulbender', lvReq: 27, maxLv: 3, mp: 180, cd: 170, pvp: 0.45, type: 'mag', elem: 'dark', awaken: true, col: '#7a2ab0',
  desc: '【二觉】展开召唤阵：魑魅魍魉攻击周围的敌人、附加诅咒并把它们吸向中心；神官吉格挣脱亡者之手现身，定住并攻击敌人，撕开地狱裂缝；最后吉格被拖回地下，同时处决 HP 较低的敌人（普通怪物 30% 以下、精英 10% 以下，领主免疫）。全程无敌。',
  pow: lv => skillDmg(34, 9, lv), ai: { kind: 'awaken', r: [0, 360], dy: 90 },
  act: (lv) => ({ name: 'sb_awaken2', clip: 'sbSummon', dur: 3.2, superArmor: true, noCounter: true, invul: [0, 3.2],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '王者号令：吉格降临', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act; a.cx = e.x + e.face * 200; a.cy = e.y;
      addFx({ x: a.cx, y: a.cy - 60, z: 0, dur: 3.2, a, draw(c) { const t = this.t; if (t < 0.9) return; const A = this.a, k = Math.min(1, (t - 0.9) * 3);
        drawSpr(c, fxTint('hexagram', '#7a2ab0'), sx(A.cx), sy(A.cy, 0), 540, 190, { ground: true, rot: t, alpha: 0.6 * k });
        if (t > 1.5) { const q = Math.min(1, (t - 1.5) * 3), sink = t > 2.6 ? (t - 2.6) * 300 : 0; drawSpr(c, sbImg('sb_jig', 'ghost', '#9a4aff'), sx(A.cx), sy(A.cy, 0) + 10 + sink, 0, 300 * q, { ay: 1, alpha: Math.min(1, (3.2 - t) * 3) }); } } }); },
    update: (e, dt) => { const a = e.act; if (e.actT > 0.95 && e.actT < 2.6) for (const t of ents) if (hittable(e, t) && !t.boss && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.4) < 400) { t.x = damp(t.x, a.cx, 1.5, dt); t.y = damp(t.y, a.cy, 1.5, dt); } },
    events: [...[1.0, 1.2, 1.4].map(t => evAt(t, e => { const a = e.act; for (let i = 0; i < 4; i++) fxSpr('ghost', a.cx + rnd(-300, 300), a.cy + rnd(-60, 60), rnd(40, 120), { w: 80, dur: 0.4, col: '#9a4aff' }); sfx.swing(false);
        blast(e, a.cx, a.cy, 380, { dmg: skillDmg(0.8, 0.24, lv), stun: 0.4, knock: 0, hs: 0.02, sure: true, type: 'mag', elem: 'dark', col: '#b08aff', onHit: (x, t) => addStatus(t, 'curse', 4, { src: x }) }, { zMax: 300 }); })),
      evAt(1.6, e => { const a = e.act; for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.4) < 380) addStatus(t, 'root', 1.5, { src: e }); cam.shake = 10; sfx.boom(1.2); fxShock(a.cx, a.cy, 400, '#9a4aff');
        blast(e, a.cx, a.cy, 380, { dmg: skillDmg(7.4, 2.2, lv), stun: 0.8, knock: 0, hs: 0.1, sure: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { zMax: 320 }); }),
      evAt(2.1, e => { const a = e.act; cam.shake = Math.max(cam.shake, 12); sfx.boom(1.3); fxShock(a.cx, a.cy, 420, '#5a1a8a'); for (let i = 0; i < 5; i++) fxSpr('ghost', a.cx + rnd(-260, 260), a.cy + rnd(-50, 50), rnd(30, 90), { w: 90, dur: 0.5, col: '#5a1a8a' });   // 地狱裂缝：亡者之手涌出
        blast(e, a.cx, a.cy, 400, { dmg: skillDmg(9.3, 2.8, lv), stun: 0.8, knock: 0, hs: 0.1, sure: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { zMax: 320 }); }),
      evAt(2.7, e => { const a = e.act; cam.flash = 0.35; cam.flashCol = '#c8a8ff'; cam.shake = 16; sfx.boom(1.5); fxShock(a.cx, a.cy, 460, '#9a4aff'); fxBurst(a.cx, a.cy, 40, 440, '#7a2ab0');
        for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.4) < 400) {
          const lim = t.boss ? 0 : t.elite ? 0.1 : 0.3;
          applyHit(e, t, { dmg: skillDmg(14.9, 4.2, lv), launch: 520, knock: 160, hs: 0.2, big: 2.2, critBonus: 0.2, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { proj: true });
          if (!t.dead && lim && t.hp <= t.hpMax * lim) { fxText('处决', t.x, t.y, t.z + 30, { col: '#ff6aff', size: 14 }); applyHit(e, t, { dmg: 1e6, sure: true, hs: 0.1, col: '#ff6aff' }, { proj: true }); } } })] }) });

/* ---- 鬼神剑·黄泉摆渡：挥动卡隆之剑划开通往冥界的裂缝，亡灵涌出前再用剑毁掉裂缝（含 5 段吸魂）---- */
defSkill('sb_ferry', { name: '鬼神剑·黄泉摆渡', cls: 'sword', job: 'soulbender', lvReq: 29, mp: 120, cd: 60, type: 'mag', elem: 'dark', col: '#5a2a8a',
  desc: '挥动卡隆之剑，内外两道空间斩划开通往冥界的裂缝，掷出卡隆之剑，5 段吸魂伤害，在亡灵涌出之前再用剑把裂缝连同敌人一起毁掉。', pow: lv => skillDmg(22, 2.2, lv), ai: { kind: 'burst', r: [0, 400], dy: 60 },
  act: (lv) => ({ name: 'sb_ferry', clip: 'sbFerry', dur: 1.6, superArmor: true, noCounter: true,
    onStart: e => { const a = e.act; a.cx = e.x + e.face * 190; a.cy = e.y; sfx.charge(); },
    events: [evAt(0.2, e => { const a = e.act; sfx.iai(); cam.shake = 8; fxSlashOn(e, { col: '#7a3aaa', a0: -2.9, a1: 0.6, r: 190, w: 34, off: [10, 60], squash: 0.5, dur: 0.3 });
        blast(e, a.cx, a.cy, 190, { dmg: skillDmg(4.3, 0.43, lv), stun: 0.5, knock: 0, hs: 0.06, sure: true, type: 'mag', elem: 'dark', col: '#c08aff' }, { zMax: 260 });   // 官方：内侧空间斩
        addFx({ x: a.cx, y: a.cy, z: 70, dur: 1.2, draw(c) { const k = this.t / this.dur, w = k < 0.2 ? k / 0.2 : 1; drawSpr(c, fxTint('slash', '#2a0a3a'), sx(a.cx), sy(a.cy, 70), 400 * w, 0, { add: false, alpha: 0.85 }); drawSpr(c, fxTint('slash', '#b06aff'), sx(a.cx), sy(a.cy, 70), 415 * w, 0, { alpha: 0.7 }); } }); }),
      evAt(0.3, e => { const a = e.act; sfx.iai(); fxSlashOn(e, { col: '#9a5aff', a0: 1.0, a1: -2.6, r: 200, w: 30, off: [10, 60], squash: 0.5, dur: 0.25 }); blast(e, a.cx, a.cy, 300, { dmg: skillDmg(4.3, 0.43, lv), stun: 0.5, knock: 0, hs: 0.06, sure: true, type: 'mag', elem: 'dark', col: '#c08aff' }, { zMax: 260 }); }),   // 外侧空间斩
      evAt(0.4, e => { const a = e.act; sfx.swing(true); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 190, w: 16, col: '#e0c8ff', dur: 0.2 }); blast(e, a.cx, a.cy, 130, { dmg: skillDmg(2.2, 0.22, lv), stun: 0.4, knock: 0, hs: 0.05, sure: true, type: 'mag', elem: 'dark', col: '#e0c8ff' }, { zMax: 260 }); }),   // 掷出卡隆之剑
      ...[0.55, 0.68, 0.81, 0.94, 1.05].map(t => evAt(t, e => { const a = e.act; fxSpr('ghost', a.cx + rnd(-160, 160), a.cy + rnd(-30, 30), 80, { w: 70, dur: 0.3, col: '#b06aff' }); sfx.swing(false);
        for (const x of ents) if (hittable(e, x) && Math.abs(x.x - a.cx) < 260 && Math.abs(x.y - a.cy) < 80) { x.x = damp(x.x, a.cx, 8, 1 / 60); applyHit(e, x, { dmg: skillDmg(0.66, 0.066, lv), stun: 0.5, knock: 0, hs: 0.03, sure: true, type: 'mag', elem: 'dark', col: '#c08aff' }, { proj: true }); } })),
      evAt(1.15, e => { const a = e.act; e.play('rk4', true); cam.flash = 0.2; cam.flashCol = '#c8a8ff'; cam.shake = 12; sfx.boom(1.3); fxBurst(a.cx, a.cy, 70, 380, '#9a4aff'); fxShock(a.cx, a.cy, 340, '#9a4aff');
        blast(e, a.cx, a.cy, 280, { dmg: skillDmg(7.7, 0.77, lv), launch: 480, knock: 160, hs: 0.14, big: 1.8, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#c08aff' }, { zMax: 260 }); })] }) });

/* ---- 黄泉之门：万鬼度灵（三觉）：穿上鬼神铠甲，用卡隆之剑召唤黄泉之门：门升起（8 段）→ 斩开结界 → 冥界亡灵倾泻而出（15 段，全屏）。无敌；与怖拉修共享冷却 ---- */
defSkill('sb_awaken3', { name: '黄泉之门：万鬼度灵', cls: 'sword', job: 'soulbender', lvReq: 30, maxLv: 3, mp: 250, cd: 135, pvp: 0.45, type: 'mag', elem: 'dark', awaken: true, col: '#4a1a7a',
  desc: '【三觉】以九大鬼神之王的身份穿上鬼神铠甲，用卡隆之剑召唤黄泉之门：门从地下升起（8 段），斩开门的结界后，冥界的亡灵倾泻而出席卷全屏（15 段）。全程无敌。与第 7 鬼神：怖拉修共享冷却。',
  pow: lv => skillDmg(48, 12, lv), ai: { kind: 'awaken', r: [0, 400], dy: 90 },
  act: (lv) => ({ name: 'sb_awaken3', clip: 'sbSummon', dur: 3.6, superArmor: true, noCounter: true, invul: [0, 3.6],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '黄泉之门：万鬼度灵', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); e.cool.sb_awaken = Math.max(e.cool.sb_awaken || 0, e.cool.sb_awaken3 || 0);
      const a = e.act; a.cx = e.x + e.face * 220; a.cy = e.y;
      addFx({ x: a.cx, y: a.cy - 80, z: 0, dur: 3.6, a, draw(c) { const t = this.t; if (t < 0.9) return; const A = this.a, rise = Math.min(1, (t - 0.9) / 0.9), fade = Math.min(1, (3.6 - t) * 3);
        drawSpr(c, sbImg('sb_gate', 'hexagram', '#6a2aa0'), sx(A.cx), sy(A.cy, 0) + 20, 0, 380 * rise, { ay: 1, alpha: fade, add: !IMG['fx/sb_gate'] }); } }); },
    events: [evAt(0.95, e => { const a = e.act; cam.shake = Math.max(cam.shake, 8); sfx.boom(0.8); fxShock(a.cx, a.cy, 340, '#6a2aa0');   // 官方第 1 段：召唤鬼门
        blast(e, a.cx, a.cy, 340, { dmg: skillDmg(2.4, 0.65, lv), stun: 0.5, knock: 0, hs: 0.03, sure: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { zMax: 320 }); }),
      ...Array.from({ length: 8 }, (_, i) => evAt(1.0 + i * 0.1, e => { const a = e.act; cam.shake = Math.max(cam.shake, 6); if (i % 2) sfx.boom(0.5);
        blast(e, a.cx, a.cy, 340, { dmg: skillDmg(0.9, 0.24, lv), stun: 0.5, knock: 0, hs: 0.02, sure: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { zMax: 320 }); })),
      evAt(1.9, e => { const a = e.act; e.play('sbFerry', true); cam.flash = 0.3; cam.flashCol = '#d8b8ff'; sfx.iai(); fxSlashX(a.cx, a.cy, 120, 320, '#e0c8ff');   // 官方：鬼门解除（斩开结界）是伤害段
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < WW) applyHit(e, t, { dmg: skillDmg(14.4, 3.9, lv), stun: 0.6, knock: 0, hs: 0.12, big: 1.4, sure: true, type: 'mag', elem: 'dark', col: '#e0c8ff' }, { proj: true }); }),
      ...Array.from({ length: 15 }, (_, i) => evAt(2.05 + i * 0.08, e => { const a = e.act; fxSpr('ghost', cam.x + rnd(60, WW - 60), rnd(20, DEPTH - 20), rnd(40, 160), { w: rnd(60, 110), dur: 0.5, col: i % 3 ? '#9a6aff' : '#6aff9a', flip: Math.random() < 0.5 }); if (i % 3 === 0) sfx.swing(true);
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < WW) applyHit(e, t, { dmg: skillDmg(0.64, 0.17, lv), stun: 0.4, airLift: 120, knock: 0, hs: 0.02, sure: true, type: 'mag', elem: 'dark', col: '#c08aff', downHit: true }, { proj: true }); })),
      evAt(3.3, e => { cam.flash = 0.4; cam.flashCol = '#ffffff'; cam.shake = 16; sfx.boom(1.6);
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < WW) applyHit(e, t, { dmg: skillDmg(14.4, 3.9, lv), launch: 560, knock: 200, hs: 0.22, big: 2.4, critBonus: 0.2, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#e0c8ff' }, { proj: true }); })] }) });
{ const A = SKILLS.sb_awaken, a0 = A.act; A.act = (lv, p) => { const a = a0(lv, p); if (p && p.cool) p.cool.sb_awaken3 = Math.max(p.cool.sb_awaken3 || 0, p.cool.sb_awaken || 0); return a; }; }
// 恐惧光环（每 2 秒周围减速）、御鬼之极（转职技能命中附加普戾蒙减益）、鬼神冠冕（满月斩失明）
CLASSES.sword.passives.push(p => {
  if (!sbJob(p)) return;
  setPassive(p, 'sb_fear', sbLv(p, 'sb_fear') > 0, { dmg: 0.04 + 0.008 * sbLv(p, 'sb_fear') });
  setPassive(p, 'sb_mastery', sbLv(p, 'sb_mastery') > 0, { dmg: 0.1 });
  setPassive(p, 'sb_crown', sbLv(p, 'sb_crown') > 0, { dmg: 0.06 + 0.012 * sbLv(p, 'sb_crown') });
  if (sbLv(p, 'sb_fear')) { p._sbFear = (p._sbFear ?? 2) - 0.25; if (p._sbFear <= 0) { p._sbFear = 2; for (const t of ents) if (hittable(p, t) && Math.hypot(t.x - p.x, (t.y - p.y) * 1.5) < 290) addStatus(t, 'slow', 2, { src: p }); } }
});
SWORD_HOOKS.onHit.push((p, t, h, dmg, act) => { if (!sbJob(p) || t.dead) return; const A = act || p.act, S = A && A.skill && SKILLS[A.skill];
  if (sbLv(p, 'sb_mastery') && S && S.job === 'soulbender') sbDebuff(p, t, sbLv(p, 'sb_plemon') || 1);
  if (sbLv(p, 'sb_crown') && A && A.name === 'moon3') addStatus(t, 'blind', 3, { src: p }); });

CLASSES.sword.jobs.soulbender = { art: 'job/soulbender', name: '鬼泣', role: '中距离 · 召唤', armor: 'cloth', awaken: 'sb_awaken', awakenName: '弑魂',
  desc: '解开左臂的锁链、驾驭鬼神的剑士。萨亚冰封、罗刹附身、普戾蒙侵蚀，凯贾与卡洛附身后连普攻都化作鬼神之力。',
  skills: ['sb_unseal', 'sb_darkmoon', 'sb_plemon', 'sb_dark', 'sb_kaiga', 'sb_purge', 'sb_fullmoon', 'sb_release', 'sb_devour', 'sb_saya', 'sb_whip', 'sb_tomb', 'sb_rasha', 'sb_flash', 'sb_fury', 'sb_karo', 'sb_karoblade', 'sb_awaken', 'sb_fear', 'sb_purgatory', 'sb_swamp', 'sb_mastery', 'sb_blade', 'sb_descent', 'sb_awaken2', 'sb_crown', 'sb_ferry', 'sb_awaken3'] };
CLASSES.sword.cmds.push(['dd', 'sb_plemon', 'buff'], ['ud', 'sb_kaiga', 'buff'], ['bdf', 'sb_purge', 'buff'], ['ff', 'sb_saya', 'buff'], ['duf', 'sb_whip'], ['ud', 'sb_tomb'], ['uf', 'sb_rasha', 'buff'],
  ['bff', 'sb_flash'], ['buf', 'sb_fury'], ['udd', 'sb_karo'], ['ff', 'sb_karoblade'], ['uudd', 'sb_awaken'],
  ['bdf', 'sb_purgatory'], ['fbuf', 'sb_swamp'], ['fbf', 'sb_blade'], ['dff', 'sb_descent'], ['duff', 'sb_awaken2'], ['udff', 'sb_ferry'], ['bufd', 'sb_awaken3']);

// 被动：封印解除（魔暴、施放速度）、暗月降临（暗强）、暗之亲和（抗性）、卡赞（鬼泣被动：技能攻击力）
CLASSES.sword.passives.push(p => {
  const on = sbJob(p);
  if (on && p.buffs.sb_karo) sbKaroFx(p);   // 卡洛飘在身后（换房间后补回）
  setPassive(p, 'sb_unseal', on && sbLv(p, 'sb_unseal') > 0, { crit: 0.01 + 0.004 * sbLv(p, 'sb_unseal'), cspd: 0.2 });
  setPassive(p, 'kazan_psv', on && sbLv(p, 'kazan') > 0, { dmg: 0.05 + 0.01 * (sbLv(p, 'kazan') - 1) });
  setPassive(p, 'sb_darkmoon', on && sbLv(p, 'sb_darkmoon') > 0, { dmg: 0.02 + 0.004 * sbLv(p, 'sb_darkmoon') });   // 暗属性强化 → 本作折算成伤害加成（鬼泣技能几乎全是暗属性）
});
// 暗之亲和：暗属性伤害 −10%、光属性伤害 +5%（相当于暗抗 +20、光抗 −10）
SWORD_HOOKS.beforeHurt.push((p, a, h, opt) => { if (!sbJob(p) || !sbLv(p, 'sb_dark')) return null; const e = h.elem || opt.elem || (a && a.act && a.act.elem); return e === 'dark' ? { mul: 0.9 } : e === 'light' ? { mul: 1.05 } : null; });
// 官方可用普攻取消后摇（DFO：Basic Attack Cancelable）
for (const [id, t] of [['sb_fury', 0.4], ['sb_purgatory', 0.45], ['sb_blade', 0.25], ['sb_descent', 0.65], ['sb_ferry', 1.2], ['sb_karoblade', 0.9], ['sb_awaken3', 3.35]]) swordAtkCancel(id, t);
swordFinalize();
