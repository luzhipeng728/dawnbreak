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
const sbRing = (col, img = 'hexagram') => (c, s) => { const k = s.lifeT, al = Math.min(1, k * 4) * Math.min(1, (s.life - k) * 3), hi = k < 0.5 ? 0.6 : 0.3; drawSpr(c, fxTint(img, col), sx(s.x), sy(s.y, 0), s.r * 2.2, s.r * 0.8, { rot: k * 0.5, alpha: hi * al }); };
const sbFigure = (img, h, col, steady = 0.3) => (c, s) => {
  const k = s.lifeT, end = Math.min(1, (s.life - k) * 3), flash = s.flashT ? Math.max(0, 1 - (game.t - s.flashT) / 0.3) : 0;
  const al = (k < 0.25 ? k / 0.25 * 0.9 : k < 0.9 ? 0.9 - (0.9 - steady) * (k - 0.25) / 0.65 : steady) + flash * 0.4;
  drawSpr(c, IMG['fx/' + img] ? img : fxTint('ghost', col), sx(s.x), sy(s.y, 0) + 4, 0, h * (0.92 + 0.08 * Math.sin(k * 3)), { ay: 1, alpha: Math.min(0.9, al) * end });
};

/* ---- 召唤物（鬼神）---- */
defSummon('sb_saya_f', { kind: 'field', tags: ['ghost', 'field'], max: 1, over: 'oldest', life: 5, r: 110, tick: 0.5, zMax: 160, type: 'mag', elem: 'ice',
  onSpawn: s => { s.r = sbR(s.owner, 110); sfx.ice(); fxShock(s.x, s.y, s.r * 1.2, SB_ICE); },
  onTick: (s, L) => { if (L.length) s.flashT = game.t; for (const t of L) { summonHit(s, t, { dmg: skillDmg(0.6, 0.06, s.lv), stun: 0.25, knock: 0, hs: 0.02, col: SB_ICE, elem: 'ice', type: 'mag' }); if (!t.dead && s.owner.sbSayaFreeze !== false && Math.random() < 0.5) addStatus(t, 'freeze', 1.2, { src: s.owner }); }
    if (Math.random() < 0.8) fxSpr('icespike', s.x + rnd(-s.r, s.r) * 0.7, s.y + rnd(-s.r, s.r) * 0.25, 0, { h: 50, dur: 0.35, ay: 1, grow: [0.2, 1] }); },
  draw: sbRing(SB_ICE), drawUpright: sbFigure('sb_saya', 120, SB_ICE) });
defSummon('sb_plemon_f', { kind: 'field', tags: ['ghost', 'field'], max: 1, over: 'oldest', life: 30, r: 120, tick: 0.5, zMax: 200, type: 'mag',
  onSpawn: s => { s.r = sbR(s.owner, 120); fxShock(s.x, s.y, s.r * 1.2, '#6aff9a'); },
  onTick: (s, L) => { for (const t of L) sbDebuff(s.owner, t, s.lv); },
  draw: sbRing('#6aff9a', 'rune'), drawUpright: sbFigure('sb_plemon', 100, '#6aff9a', 0.15) });
// 普戾蒙的减益：受到的伤害增加（离开阵后仍保留 30 秒），用挂在敌人身上的 attach 计时
defSummon('sb_plemon_on', { kind: 'attach', host: 'target', tags: ['ghost'], max: 60, over: 'oldest', life: 30,
  onSpawn: s => { const h = s.host; h.buffs = h.buffs || {}; h.buffs.sb_plemon = { t: 9999, taken: 0.2 + 0.02 * s.lv }; },
  onEnd: s => { const h = s.host; if (h && h.buffs) delete h.buffs.sb_plemon; },
  draw: (c, s) => { const h = s.host; if (!h || h.dead) return; drawSpr(c, fxTint('poison', '#6aff9a'), sx(h.x), sy(h.y, h.z + h.hurtH() + 10), 18, 0, { alpha: 0.7 }); } });
function sbDebuff(p, t, lv) { const S = summonsOf(p, 'sb_plemon_on').find(s => s.host === t); if (S) { S.lifeT = 0; return; } summon(p, 'sb_plemon_on', { target: t, lv }); }
defSummon('sb_rasha_f', { kind: 'field', tags: ['ghost', 'field'], max: 1, over: 'oldest', life: 5, r: 120, tick: 0.25, zMax: 160, type: 'mag',
  onSpawn: s => { s.r = sbR(s.owner, 120); fxShock(s.x, s.y, s.r * 1.2, '#c06aff'); },
  onTick: (s, L) => { for (const t of L) if (!summonsOf(s.owner, 'sb_rasha_on').some(a => a.host === t)) { summon(s.owner, 'sb_rasha_on', { target: t, lv: s.lv }); fxSpr('ghost', t.x, t.y, t.z + 50, { w: 50, dur: 0.3, col: '#c06aff' }); } },
  draw: sbRing('#c06aff', 'rune'), drawUpright: sbFigure('sb_rasha', 70, '#c06aff', 0.3) });
// 罗刹附身：10 秒内每秒腐蚀伤害，减速、降硬直，交替附加失明 / 诅咒
defSummon('sb_rasha_on', { kind: 'attach', host: 'target', tags: ['ghost'], max: 60, over: 'oldest', life: 10.5, tick: 1, hits: 10, type: 'mag',
  onTick: (s, h) => { summonHit(s, h, { dmg: skillDmg(0.35, 0.035, s.lv), stun: 0.05, knock: 0, hs: 0, col: '#c06aff', sure: true }); addStatus(h, 'slow', 1.2, { src: s.owner });
    if (s.hits % 3 === 0) swStatus(h, s.hits % 2 ? 'curse' : 'blind', 2, { src: s.owner }); },
  draw: (c, s) => { const h = s.host; if (!h || h.dead) return; drawSpr(c, IMG['fx/sb_rasha'] ? 'sb_rasha' : fxTint('ghost', '#c06aff'), sx(h.x + 8), sy(h.y, h.z + h.hurtH() * 0.7), 0, 34, { alpha: 0.75 }); } });
// 卡洛的冥炎：每秒 1 跳、共 5 跳；鬼影闪命中时一次引爆
defSummon('sb_karo_burn', { kind: 'attach', host: 'target', tags: ['ghost'], max: 60, over: 'oldest', life: 5.2, tick: 1, hits: 5, type: 'mag',
  onTick: (s, h) => summonHit(s, h, { dmg: skillDmg(0.25, 0.025, s.lv), stun: 0.02, knock: 0, hs: 0, col: '#9a5aff', sure: true }),
  draw: (c, s) => { const h = s.host; if (!h || h.dead) return; drawSpr(c, fxTint('flame', '#7a3aff'), sx(h.x), sy(h.y, h.z + h.hurtH() * 0.5), 0, 36, { rot: -1.57, alpha: 0.6 + 0.2 * Math.sin(game.t * 12) }); } });
function sbKaroBurn(p, t) { if (!t || t.dead || !sbJob(p)) return; const S = summonsOf(p, 'sb_karo_burn').find(s => s.host === t); if (S) { S.lifeT = 0; S.hits = 0; return; } summon(p, 'sb_karo_burn', { target: t, lv: sbLv(p, 'sb_karo') || 1 }); }
function sbKaroDetonate(p, t) { for (const S of summonsOf(p, 'sb_karo_burn').filter(s => s.host === t)) { const left = 5 - S.hits; dismissOne(S, 'cmd'); summonHit(S, t, { dmg: skillDmg(0.25, 0.025, S.lv) * left * 1.2, hs: 0.04, col: '#9a5aff', sure: true }); fxBurst(t.x, t.y, t.z + 40, 90, '#9a5aff'); } }

/* ---- 被动 ---- */
defSkill('sb_unseal', { name: '封印解除', cls: 'sword', job: 'soulbender', lvReq: 15, mp: 0, cd: 0, type: 'mag', passive: true, col: '#9a7aff',
  desc: '【被动】解开左臂的封印：魔法暴击率、施放速度提高，阵法（萨亚、普戾蒙、罗刹）范围扩大。', infoExtra: lv => [['魔法暴击率', '+' + pct(0.01 + 0.004 * lv)], ['施放速度', '+20%'], ['阵法范围', '+15%']] });
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

/* ---- 残影之凯贾：自身 BUFF。暴击伤害、移速、回避提高；普攻变成 4 连暗属性魔法攻击 + 冲刺斩（冲刺开始时短暂无敌，可以接鬼影闪）---- */
defSkill('sb_kaiga', { name: '残影之凯贾', cls: 'sword', job: 'soulbender', lvReq: 16, mp: 30, cd: 5, type: 'mag', buff: true, col: '#8a8aff',
  desc: '【BUFF · 持续时间无限】鬼神凯贾附身：暴击伤害、移动速度提高；普攻变为 4 连暗属性魔法攻击，第 4 下是带短暂无敌的冲刺斩（冲刺中可以接鬼影闪）。',
  ai: { kind: 'buff', core: true }, infoExtra: lv => [['暴击伤害 / 移速', '+' + pct(0.05)]],
  act: (lv) => ({ name: 'sb_kaiga', clip: 'sbSummon', dur: 0.45, noCounter: true, onStart: e => { e.buffs.sb_kaiga = { t: 9999, critDmg: 0.05, mspd: 0.05, lv }; sfx.buff(); fxAura(e, '#8a8aff', 1); fxAfterimage(e, '#8a8aff'); } }) });
const sbHit = (t0, t1, box, dmg, o) => HB(t0, t1, box, dmg, { type: 'mag', elem: 'dark', hs: 0.05, ...o });
const SWORD_ACTS_KAIGA = { ...SWORD_ACTS,
  atk1: { name: 'atk1', dur: 0.32, basic: true, speed: 'aspd', chain: [0.12, 0.32], next: 'atk2', move: [[0.02, 0.08, 110]], type: 'mag',
    hits: [sbHit(0.06, 0.12, [0, 80, 30, 10, 110], 1.0, { stun: 0.3, knock: 50 })], events: [slashAt(0.05, { a0: -2.4, a1: 0.7, r: 58, w: 15, off: [14, 58], col: '#a89aff' })] },
  atk2: { name: 'atk2', dur: 0.32, basic: true, speed: 'aspd', chain: [0.12, 0.32], next: 'atk3', move: [[0.02, 0.08, 100]], type: 'mag',
    hits: [sbHit(0.06, 0.12, [0, 80, 30, 10, 110], 1.05, { stun: 0.32, knock: 55 })], events: [slashAt(0.05, { a0: 1.0, a1: -2.1, r: 56, w: 15, off: [12, 56], col: '#a89aff' })] },
  atk3: { name: 'atk3', dur: 0.4, basic: true, speed: 'aspd', chain: [0.18, 0.4], next: 'atk4', move: [[0.04, 0.12, 160]], type: 'mag',
    hits: [sbHit(0.1, 0.16, [0, 88, 32, 0, 120], 1.3, { stun: 0.45, knock: 120 })], events: [slashAt(0.09, { a0: -2.7, a1: 1.1, r: 66, w: 20, off: [10, 56], col: '#a89aff', heavy: true })] },
  atk4: { name: 'atk4', clip: 'dash', dur: 0.42, basic: true, speed: 'aspd', move: [[0, 0.24, 520]], type: 'mag', kaigaDash: true, invul: [0, 0.22], links: ['sb_flash'],
    hits: [sbHit(0.02, 0.24, [-10, 70, 30, 10, 110], 1.4, { stun: 0.5, knock: 160, heavy: true })],
    events: [evAt(0.01, e => { fxAfterimage(e, '#8a8aff'); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 58, face: e.face, len: 160, w: 14, col: '#a89aff', dur: 0.22 }); sfx.swing(true); })] },
};
/* ---- 冥炎之卡洛：开关 BUFF（再按一次解除）。普攻改为发射卡洛的分身（空中和后跳中也能发），命中附加冥炎；有凯贾时 3 连发。解锁冥炎剑 ---- */
defSkill('sb_karo', { name: '冥炎之卡洛', cls: 'sword', job: 'soulbender', lvReq: 20, mp: 40, cd: 3, type: 'mag', elem: 'dark', buff: true, col: '#7a3aff',
  desc: '【开关 BUFF · 再按一次解除】鬼神卡洛附身：普攻改为向前发射卡洛的分身（空中和后跳中也能发射），命中的敌人被附加冥炎（每秒 1 跳，共 5 跳，鬼影闪命中时一次引爆）。有残影之凯贾时一次发射 3 个。只有卡洛附身时才能施放冥炎剑。',
  ai: { kind: 'buff', core: true }, pow: lv => skillDmg(0.8, 0.08, lv), infoExtra: lv => [['冥炎每跳', pct(skillDmg(0.25, 0.025, lv))]],
  act: (lv) => ({ name: 'sb_karo', clip: 'sbKaro', dur: 0.45, noCounter: true, onStart: e => { if (toggleBuff(e, 'sb_karo', 9999, { lv })) { sfx.buff(); fxAura(e, '#7a3aff', 1); } e.acts = swordActs(e); } }) });
function sbKaroShot(e, n = 1) {
  const lv = (e.buffs.sb_karo && e.buffs.sb_karo.lv) || 1;
  for (let i = 0; i < n; i++) game.after(i * 0.06, () => { if (e.dead) return; sfx.swing(false);
    spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y + (i - (n - 1) / 2) * 8, z: e.z + 60, vx: e.face * 560, face: e.face, life: 0.55, w: 14, d: 14, h: 24, pierce: false,
      hit: { dmg: skillDmg(0.8, 0.08, lv) / Math.sqrt(n), stun: 0.25, knock: 40, hs: 0.03, type: 'mag', elem: 'dark', col: '#9a5aff' },
      onHitT: (pr, t) => sbKaroBurn(e, t),
      draw(c, pr) { drawSpr(c, IMG['fx/sb_karo'] ? 'sb_karo' : fxTint('fireball', '#7a3aff'), sx(pr.x), sy(pr.y, pr.z), 36, 0, { flip: pr.face < 0 }); } }); });
}
const karoAct = (name, n, next) => ({ name, clip: 'asOrb', dur: 0.3, basic: true, speed: 'aspd', chain: next ? [0.12, 0.3] : null, next, events: [evAt(0.08, e => sbKaroShot(e, n))] });
function sbKaroActs(kaiga) {
  const n = kaiga ? 3 : 1;
  return { ...(kaiga ? SWORD_ACTS_KAIGA : SWORD_ACTS), atk1: karoAct('atk1', n, 'atk2'), atk2: karoAct('atk2', n, 'atk3'), atk3: karoAct('atk3', n, null),
    jatk: { ...karoAct('jatk', n, null), airOnly: true, lowGrav: 0.6, clip: 'jatk' } };
}
const SWORD_ACTS_KARO = sbKaroActs(false), SWORD_ACTS_KARO_K = sbKaroActs(true);
SWORD_ACT_PICK.push(p => !sbJob(p) ? null : p.buffs.sb_karo ? (p.buffs.sb_kaiga ? SWORD_ACTS_KARO_K : SWORD_ACTS_KARO) : p.buffs.sb_kaiga ? SWORD_ACTS_KAIGA : null);

/* ---- 泯灭仪式：清除自己放出的普戾蒙、萨亚、罗刹 ---- */
defSkill('sb_purge', { name: '泯灭仪式', cls: 'sword', job: 'soulbender', lvReq: 16, maxLv: 1, mp: 5, cd: 1, type: 'mag', buff: true, col: '#6a5a9a',
  desc: '清除自己放出的普戾蒙、萨亚、罗刹之阵。', ai: { kind: 'buff' },
  act: () => ({ name: 'sb_purge', clip: 'sbSummon', dur: 0.3, noCounter: true, onStart: e => { for (const s of summonsOf(e, { tag: 'field' })) fxBurst(s.x, s.y, 30, 90, SB_COL); dismissSummons(e, { tag: 'field' }, 'cmd'); } }) });

/* ---- 阵法 ---- */
sbFieldSkill('sb_plemon', 'sb_plemon_f', { name: '侵蚀之普戾蒙', lvReq: 15, mp: 30, cd: 8, col: '#6aff9a',
  desc: '在身前召唤普戾蒙之阵（约 30 秒）：阵里的敌人受到的伤害增加，离开阵后减益仍保留 30 秒。同时只能有一个，再放会替换旧的。', ai: { kind: 'aoe', r: [0, 200], dy: 60, summon: 'sb_plemon_f' },
  infoExtra: lv => [['受到伤害', '+' + pct(0.2 + 0.02 * lv)]] });
sbFieldSkill('sb_saya', 'sb_saya_f', { name: '冰霜之萨亚', lvReq: 18, mp: 40, cd: 15, elem: 'ice', col: SB_ICE,
  desc: '在身前召唤萨亚之阵（5 秒）：每 0.5 秒对阵里的敌人造成冰属性魔法伤害，50% 几率冰冻。同时只能有一个。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [0, 200], dy: 60, summon: 'sb_saya_f' } });
sbFieldSkill('sb_rasha', 'sb_rasha_f', { name: '瘟疫之罗刹', lvReq: 19, mp: 45, cd: 20, col: '#c06aff',
  desc: '在身前生成瘟疫之阵（5 秒）：踩进阵里的敌人被罗刹的分身附身，之后 10 秒内（离开阵也不会掉）每秒受到腐蚀伤害并被减速，还会交替附加失明和诅咒。', pow: lv => skillDmg(3.5, 0.35, lv), ai: { kind: 'aoe', r: [0, 200], dy: 60, summon: 'sb_rasha_f' } });

/* ---- 鬼影鞭：像甩鞭一样挥剑两次，第二下把远处的敌人拉到身前；可以用普攻取消；卡洛附身时附加冥炎 ---- */
defSkill('sb_whip', { name: '鬼影鞭', cls: 'sword', job: 'soulbender', lvReq: 18, mp: 25, cd: 8, type: 'mag', elem: 'dark', col: '#a06aff',
  desc: '像甩鞭一样挥剑两次，第二下把远处的敌人拉到身前。可以用普攻取消后摇；卡洛附身时附加冥炎。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'poke', r: [0, 220], dy: 26 },
  act: (lv) => ({ name: 'sb_whip', clip: 'sbWhip', dur: 0.62, noCounter: true, chain: [0.36, 0.62], next: 'atk1',
    hits: [HB(0.1, 0.16, [0, 150, 30, 10, 110], skillDmg(1.8, 0.18, lv), { stun: 0.4, knock: 40, hs: 0.05, col: '#b08aff', onHit: (a, t) => { if (a.buffs.sb_karo) sbKaroBurn(a, t); } }),
      HB(0.3, 0.38, [20, 240, 34, 0, 120], skillDmg(2.2, 0.22, lv), { stun: 0.6, knock: 20, hs: 0.07, pull: true, col: '#b08aff', onHit: (a, t) => { t.x = a.x + a.face * 60; if (a.buffs.sb_karo) sbKaroBurn(a, t); } })],
    events: [evAt(0.08, e => { sfx.swing(true); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 150, w: 10, col: '#b08aff', dur: 0.16 }); }),
      evAt(0.28, e => { sfx.swing(true); fxStreak({ x: e.x + e.face * 20, y: e.y, z: e.z + 50, face: e.face, len: 240, w: 12, col: '#b08aff', dur: 0.2 }); })] }) });

/* ---- 死亡墓碑：以自身为中心，墓碑从天而降（1 秒），附加诅咒；霸体、不能移动，按跳跃中断；按 → 墓碑落在前方 ---- */
defSkill('sb_tomb', { name: '死亡墓碑', cls: 'sword', job: 'soulbender', lvReq: 19, mp: 45, cd: 18, type: 'mag', elem: 'dark', col: '#8a7aa0',
  desc: '以自身为中心召唤墓碑从天而降（约 1 秒，每秒 9 块），砸中的敌人被诅咒；落地的墓碑也有判定。施放中霸体、不能移动，按跳跃键中断；按 → 让墓碑落在前方。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [0, 120], dy: 50 },
  act: (lv) => ({ name: 'sb_tomb', clip: 'sbTomb', dur: 1.2, superArmor: true, noCounter: true,
    onStart: e => { e.act.off = e.pad.dx() * e.face > 0 ? 110 : 0; },
    onInput: (e, I) => { if (e.actT > 0.2 && I.buffered('jump')) { I.consume('jump'); e.endAct(); return true; } return false; },
    update: (e, dt) => { e.vx = 0; e.vy = 0; const a = e.act; a.tk = (a.tk || 0) + dt;
      if (e.actT > 0.1 && e.actT < 1.1 && a.tk >= 0.11) { a.tk = 0; const x = e.x + e.face * a.off + rnd(-90, 90), y = e.y + rnd(-30, 30);
        const img = IMG['fx/sb_tomb'] ? 'sb_tomb' : 'rock';
        addFx({ x, y: y + 0.4, z: 260, dur: 0.5, vz: -900, update(dt) { this.z = Math.max(0, this.z + this.vz * dt); }, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 0, 46, { ay: 1, add: false, alpha: k > 0.8 ? (1 - k) / 0.2 : 1 }); } });
        game.after(0.28, () => { if (e.dead) return; sfx.boom(0.3); fxDust(x, y, 3, 10); blast(e, x, y, 40, { dmg: skillDmg(0.6, 0.06, lv), stun: 0.35, knock: 30, hs: 0.03, type: 'mag', elem: 'dark', col: '#b0a0c0', downHit: true, onHit: (a2, t) => swStatus(t, 'curse', 3, { src: a2 }) }, { zMax: 120 }); }); } } }) });

/* ---- 鬼影闪：向前冲刺斩击，命中的敌人先被定住，随后暗属性爆发并强制倒地；引爆冥炎。二觉前只能在凯贾的冲刺中施放 ---- */
defSkill('sb_flash', { name: '鬼影闪', cls: 'sword', job: 'soulbender', lvReq: 19, mp: 45, cd: 20, type: 'mag', elem: 'dark', col: '#9a6aff',
  desc: '向前冲刺约 370 像素并斩击，命中的敌人先被短暂定住，随后暗属性爆发并强制倒地；会一次引爆敌人身上的冥炎。只能在残影之凯贾的冲刺斩（普攻第 4 下）中施放。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'gap', r: [0, 260], dy: 26 },
  req: p => (p.act && p.act.kaigaDash) || sbLv(p, 'sb_mastery') ? true : '需要凯贾的冲刺',
  act: (lv) => ({ name: 'sb_flash', clip: 'dragon', dur: 0.9, superArmor: true, noCounter: true, move: [[0, 0.2, 1100]], invul: [0, 0.2],
    onStart: e => { e.act.victims = []; fxAfterimage(e, '#9a6aff'); sfx.iai(); },
    hits: [HB(0.02, 0.22, [-30, 60, 32, 0, 120], skillDmg(1.5, 0.15, lv), { stun: 1.0, knock: 0, hs: 0.04, col: '#b08aff', onHit: (a, t) => { if (a.act) a.act.victims.push(t); asRootSafe(t, a, 0.6); } })],
    events: [evAt(0.02, e => fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 370, w: 20, col: '#9a6aff', dur: 0.3 })),
      evAt(0.6, e => { cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9);
        for (const t of e.act.victims || []) { if (t.dead) continue; fxBurst(t.x, t.y, t.z + 40, 140, '#9a5aff'); applyHit(e, t, { dmg: skillDmg(5.5, 0.55, lv), down: true, knock: 60, hs: 0.1, big: 1.5, sure: true, type: 'mag', elem: 'dark', col: '#b08aff', downHit: true }, { proj: true }); sbKaroDetonate(e, t); } })] }) });
const asRootSafe = (t, a, dur) => { if (typeof STATUS_NAME !== 'undefined' && STATUS_NAME.root) addStatus(t, 'root', dur, { src: a }); else addStatus(t, 'stun', dur, { src: a, force: true }); };

/* ---- 鬼影剑：狂怒：剑中注入鬼神之力向前下劈，引发爆炸，单段高伤害 ---- */
defSkill('sb_fury', { name: '鬼影剑：狂怒', cls: 'sword', job: 'soulbender', lvReq: 19, mp: 50, cd: 20, type: 'mag', elem: 'dark', col: '#7a4aff',
  desc: '在剑中注入鬼神之力向前重重下劈，引发暗属性大爆炸（单段高伤害）。', pow: lv => skillDmg(8.0, 0.8, lv), ai: { kind: 'burst', r: [0, 130], dy: 30 },
  act: (lv) => ({ name: 'sb_fury', clip: 'a3slam', dur: 0.75, superArmor: true, noCounter: true,
    events: [evAt(0.05, e => { sfx.charge(); fxAura(e, '#7a4aff', 0.4); }), evAt(0.32, e => { const x = e.x + e.face * 80; cam.shake = Math.max(cam.shake, 8); sfx.boom(1.1); sfx.iai();
      fxSlashOn(e, { col: '#9a6aff', a0: -2.8, a1: 1.2, r: 80, w: 26, off: [10, 56], heavy: true }); fxSpr('explosion', x, e.y, 40, { w: 170, dur: 0.45, col: '#8a5aff', grow: [0.4, 1.1] }); fxShock(x, e.y, 150, '#8a5aff');
      blast(e, x, e.y, 90, { dmg: skillDmg(8.0, 0.8, lv), launch: 380, knock: 140, hs: 0.14, big: 1.8, type: 'mag', elem: 'dark', col: '#b08aff', downHit: true }, { zMax: 180 }); })] }) });

/* ---- 冥炎剑（仅卡洛附身中）：双持冥炎剑向前突进 4 段斩，伤害逐段递增，方向键调整距离，附加冥炎 ---- */
defSkill('sb_karoblade', { name: '冥炎剑', cls: 'sword', job: 'soulbender', lvReq: 20, mp: 55, cd: 45, type: 'mag', elem: 'dark', col: '#8a3aff', req: p => p.buffs && p.buffs.sb_karo ? true : '需要冥炎之卡洛',
  desc: '【冥炎之卡洛附身中】召唤凝聚卡洛之力的冥炎剑，以二刀流向前突进 4 段连斩，伤害逐段递增，命中附加冥炎。方向键调整突进距离。', pow: lv => skillDmg(10.0, 1.0, lv), ai: { kind: 'gap', r: [0, 220], dy: 26 },
  act: (lv) => ({ name: 'sb_karoblade', clip: 'bzA1', dur: 1.2, superArmor: true, noCounter: true,
    onStart: e => { const d = e.pad.dx() * e.face; e.act.step = d > 0 ? 260 : d < 0 ? 60 : 160; },
    events: [0, 1, 2, 3].map(i => evAt(0.08 + i * 0.22, e => { e.play(['dual1', 'dual3', 'dual2', 'dual4'][i], true); e.vx = e.face * e.act.step * 3; sfx.swing(true);
      fxSlashOn(e, { col: '#9a4aff', a0: i % 2 ? 1.0 : -2.4, a1: i % 2 ? -2.4 : 1.0, r: 72, w: 20, off: [10, 56], heavy: i === 3 });
      game.after(0.06, () => { if (e.dead) return; e.vx = 0; instantHit(e, { box: [-10, 100, 36, 0, 120], dmg: skillDmg(1.5 + i * 0.5, 0.15 + i * 0.05, lv), stun: 0.5, knock: i === 3 ? 240 : 40, launch: i === 3 ? 300 : 0, hs: 0.06, type: 'mag', elem: 'dark', col: '#b08aff',
        onHit: (a, t) => sbKaroBurn(a, t) }); }); })) }) });

/* ---- 一觉：第7鬼神：怖拉修。沼泽在前方扩大 → 巨口鬼神破土而出（冲击波击倒）→ 合嘴吞噬（主要伤害）；场上每有一只鬼神伤害 +20%（最多 4 只）。施放中无敌 ---- */
defSkill('sb_awaken', { name: '第7鬼神：怖拉修', cls: 'sword', job: 'soulbender', lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'mag', elem: 'dark', awaken: true, col: '#5a2a9a',
  desc: '【觉醒】唤出禁断的第 7 鬼神怖拉修：前方的沼泽逐渐扩大，巨口鬼神破土而出把敌人震倒，随即合嘴吞噬一切。场上每有一只鬼神（卡赞、普戾蒙、萨亚、罗刹、凯贾、卡洛），伤害提高 20%（最多 4 只）。施放中无敌。',
  pow: lv => skillDmg(24, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv) => ({ name: 'sb_awaken', clip: 'sbSummon', dur: 2.6, superArmor: true, noCounter: true, invul: [0, 2.6],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '第7鬼神：怖拉修', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act; a.cx = e.x + e.face * 200; a.cy = e.y;
      const n = Math.min(4, summonsOf(e, { tag: 'field' }).length + (e.buffs.kazan || sbLv(e, 'kazan') ? 1 : 0) + (e.buffs.sb_kaiga ? 1 : 0) + (e.buffs.sb_karo ? 1 : 0)); a.m = 1 + 0.2 * n;
      a.fx = addFx({ x: a.cx, y: a.cy - 50, z: 0, dur: 2.6, a, draw(c) { const A = this.a, k = this.t, sw = Math.min(1, k / 1.6);
        drawSpr(c, fxTint('darkorb', '#3a1a6a'), sx(A.cx), sy(A.cy, 0), 80 + 320 * sw, 30 + 110 * sw, { alpha: 0.8, add: false });
        if (k > 1.6) { const q = Math.min(1, (k - 1.6) * 3), bite = k > 2.1; drawSpr(c, IMG['fx/sb_brasha'] ? 'sb_brasha' : fxTint('ghost', '#7a3aff'), sx(A.cx), sy(A.cy, 0) + 10, 0, (bite ? 230 : 260) * q, { ay: 1, alpha: Math.min(1, (2.6 - k) * 3), add: !IMG['fx/sb_brasha'] }); } } }); },
    events: [evAt(1.6, e => { const a = e.act; cam.shake = Math.max(cam.shake, 10); sfx.boom(1.2); fxShock(a.cx, a.cy, 300, '#8a5aff');
        blast(e, a.cx, a.cy, 230, { dmg: skillDmg(6, 1.5, lv) * a.m, down: true, knock: 60, hs: 0.1, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { zMax: 260 }); }),
      evAt(2.1, e => { const a = e.act; cam.flash = 0.3; cam.flashCol = '#c8a8ff'; cam.shake = 14; sfx.boom(1.4); sfx.iai();
        for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.4) < 260) { t.x = lerp(t.x, a.cx, 0.6); t.y = lerp(t.y, a.cy, 0.6); }
        blast(e, a.cx, a.cy, 250, { dmg: skillDmg(18, 4.5, lv) * a.m, launch: 520, knock: 120, hs: 0.2, big: 2.2, critBonus: 0.2, sure: true, downHit: true, type: 'mag', elem: 'dark', col: '#b08aff' }, { zMax: 320 }); })] }) });

/* ---- 基础技能的鬼泣强化：鬼斩（噬灵鬼斩：蓄力 + 追加鬼神冲击波）、月光斩（普攻取消后摇 + 满月斩）、卡赞（转职后变被动）---- */
{
  const G = SKILLS.ghost, act0 = G.act;
  G.act = (lv, p) => {
    const a = act0(lv, p); if (!p || !sbJob(p)) return a;
    if (sbLv(p, 'sb_devour')) {
      a.charge = { at: 0.04, max: 0.15, min: 0, dmg: 0.4, update: e => { if (Math.random() < 0.6) fxCharge(e, SB_COL); }, onRelease: (e, k) => { if (k > 0.95) { e.superArmor = Math.max(e.superArmor, 0.5); e.vx = e.face * 420; fxAfterimage(e, SB_COL); } } };
      a.follow = () => sbGhostWave(lv, p); a.followWin = [0.3, 0.56];
    }
    return a;
  };
  G.act._sb = true;
}
function sbGhostWave(lv, p) {   // 噬灵鬼斩的追加：最后召唤的鬼神冲击波
  const last = summonsOf(p, { tag: 'field' }).slice(-1)[0], k = last ? last.skey : 'kazan';
  const col = k === 'sb_saya_f' ? SB_ICE : k === 'sb_plemon_f' ? '#6aff9a' : k === 'sb_rasha_f' ? '#c06aff' : '#ff5a4a';
  const back = p.pad.dx() * p.face < 0;
  return { name: 'sb_ghostwave', clip: 'sbSummon', dur: 0.45, noCounter: true, move: back ? [] : [[0.02, 0.1, 80]],
    events: [evAt(0.1, e => { sfx.boom(0.6); projWave(e, { speed: 520, life: 0.5, h: 110, col, hit: { dmg: skillDmg(2.0, 0.2, lv), knock: 160, launch: 240, hs: 0.06, type: 'mag', elem: k === 'sb_saya_f' ? 'ice' : 'dark',
      onHit: (a, t) => { if (k === 'sb_saya_f') addStatus(t, 'freeze', 1.5, { src: a }); else if (k === 'sb_plemon_f') swStatus(t, 'sleep', 2, { src: a }); } } }); })] };
}
{
  const M = SKILLS.moon, act0 = M.act;
  M.act = (lv, p) => {
    const a = act0(lv, p); if (!p || !sbJob(p)) return a;
    a.chain = [0.3, 0.46]; a.next = 'atk1';   // 鬼泣：普攻取消后摇
    if (sbLv(p, 'sb_fullmoon')) { const f0 = a.follow; a.follow = () => { const b = f0(); b.chain = [0.28, 0.44]; b.next = 'atk1'; b.follow = () => sbFullMoon(lv); b.followWin = [0.14, 0.44]; return b; }; }
    return a;
  };
}
function sbFullMoon(lv) {
  return { name: 'moon3', clip: 'rise', dur: 0.5, noCounter: true, move: [[0.02, 0.12, 100]],
    hits: [HB(0.08, 0.18, [-10, 84, 34, 0, 150], skillDmg(2.0, 0.2, lv), { launch: 520, knock: 30, hs: 0.09, shake: 3, type: 'mag', elem: 'dark' })],
    events: [slashAt(0.07, { a0: 1.4, a1: -1.9, r: 76, w: 24, off: [10, 50], col: '#d8c8ff', heavy: true })] };
}
{ const K = SKILLS.kazan, r0 = K.req; K.req = p => sbJob(p) ? '鬼泣已转为被动' : r0 ? r0(p) : true; }

CLASSES.sword.jobs.soulbender = { art: 'job/soulbender', name: '鬼泣', role: '中距离 · 召唤', armor: 'cloth', awaken: 'sb_awaken', awakenName: '弑魂',
  desc: '解开左臂的锁链、驾驭鬼神的剑士。萨亚冰封、罗刹附身、普戾蒙侵蚀，凯贾与卡洛附身后连普攻都化作鬼神之力。',
  skills: ['sb_unseal', 'sb_darkmoon', 'sb_plemon', 'sb_dark', 'sb_kaiga', 'sb_purge', 'sb_fullmoon', 'sb_release', 'sb_devour', 'sb_saya', 'sb_whip', 'sb_tomb', 'sb_rasha', 'sb_flash', 'sb_fury', 'sb_karo', 'sb_karoblade', 'sb_awaken'] };
CLASSES.sword.cmds.push(['dd', 'sb_plemon', 'buff'], ['ud', 'sb_kaiga', 'buff'], ['bdf', 'sb_purge', 'buff'], ['ff', 'sb_saya', 'buff'], ['duf', 'sb_whip'], ['ud', 'sb_tomb'], ['uf', 'sb_rasha', 'buff'],
  ['bff', 'sb_flash'], ['buf', 'sb_fury'], ['udd', 'sb_karo'], ['ff', 'sb_karoblade'], ['uudd', 'sb_awaken']);

// 被动：封印解除（魔暴、施放速度）、暗月降临（暗强）、暗之亲和（抗性）、卡赞（鬼泣被动：技能攻击力）
CLASSES.sword.passives.push(p => {
  const on = sbJob(p);
  setPassive(p, 'sb_unseal', on && sbLv(p, 'sb_unseal') > 0, { crit: 0.01 + 0.004 * sbLv(p, 'sb_unseal'), cspd: 0.2 });
  setPassive(p, 'kazan_psv', on && sbLv(p, 'kazan') > 0, { dmg: 0.05 + 0.01 * (sbLv(p, 'kazan') - 1) });
  setPassive(p, 'sb_darkmoon', on && sbLv(p, 'sb_darkmoon') > 0, { dmg: 0.02 + 0.004 * sbLv(p, 'sb_darkmoon') });   // 暗属性强化 → 本作折算成伤害加成（鬼泣技能几乎全是暗属性）
});
// 暗之亲和：暗属性伤害 −10%、光属性伤害 +5%（相当于暗抗 +20、光抗 −10）
SWORD_HOOKS.beforeHurt.push((p, a, h, opt) => { if (!sbJob(p) || !sbLv(p, 'sb_dark')) return null; const e = h.elem || opt.elem || (a && a.act && a.act.elem); return e === 'dark' ? { mul: 0.9 } : e === 'light' ? { mul: 1.05 } : null; });
swordFinalize();
