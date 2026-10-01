/* =====================================================================
   圣骑士（男）觉醒三段：一觉 天启者（官方 Lv48~70 → 本作 21~25）、二觉 神思者（75~85 → 26~27）、三觉 神启·圣骑士（95~100 → 29~30）
   觉醒技：天启之珠（一觉）/ 神圣洗礼：信仰之翼（二觉，守护路线）+ 惩罚（二觉的攻击，共用冷却）/ 生命礼赞：神威（三觉，和一觉或惩罚联动冷却）；
   完成对应的觉醒任务时自动学会（0 SP、等级随角色等级提升）并放进技能栏（照散打的做法，pcAutoAwaken）
   ===================================================================== */
// 天启之珠：天空打开，落雷和光之矛落下爆炸（12 段；战斗路线 16 段、覆盖整个画面、冷却 135 秒）；守护路线：光降到队友身上，33 秒所有速度提高、队友攻击力提高（自己不加攻击力）
const pcApocVal = (lv, k = 1) => ({ spd: (0.052 + 0.013 * lv) * k, atk: (0.15 + 0.03 * lv) * k });
function pcApocBuff(e, lv, k, id, t) {
  const V = pcApocVal(lv, k);
  for (const m of pcMembers(e, 2400)) pcGive(e, m, 'buff', { id, b: { t, aspd: V.spd, cspd: V.spd, mspd: V.spd, ...(m !== e ? { atk: V.atk } : {}), name: id === 'pc_judg' ? '神威·审判' : '天启之珠', col: '#fff0a0' }, aura: '#fff0a0' });
}
// 生命礼赞和天启之珠 / 惩罚的联动（三觉：用三觉会让联动的觉醒一起进冷却；联动的觉醒冷却中三觉不能用，三觉冷却中联动的觉醒也不能用）
const pcLinkOf = p => isHuman(p) && pcSw('pc_awaken3') ? 'pc_punish' : 'pc_awaken';
const pcLinkReq = id => p => (pcLinkOf(p) === id && (p.cool.pc_awaken3 || 0) > 0 && skLv(p, 'pc_awaken3') > 0) ? '生命礼赞：神威冷却中（联动）' : true;
defSkill('pc_awaken', { name: '天启之珠', cls: 'priest', job: PCJ, tier: 1, lvReq: 21, maxLv: 3, sp: 0, mp: 150, cd: 160, pvp: 0.45, type: 'indep', elem: 'light', awaken: true, col: '#fff0a0',
  desc: '【一次觉醒「天启者」的觉醒技】完成一次觉醒任务时自动学会（不花 SP，等级随角色等级提升）并放进技能栏（↑↑↓↓+Z）。解放神圣之力打开天空，落雷和光之长矛落到地面爆炸，审判敌人（12 段）；施放约 1 秒，全程无敌。守护路线：蕴含圣力的光降到队友身上，33 秒内所有人攻击 / 移动 / 施放速度提高，队友（不含自己）的攻击力提高。战斗路线（勇气恩赐）：不降下祝福之光，改为 16 段、覆盖整个画面，冷却缩短到 135 秒。',
  pow: lv => skillDmg(22, 6, lv), ai: { kind: 'awaken', r: [0, 600], dy: 160 }, req: pcLinkReq('pc_awaken'),
  infoExtra: lv => [['祝福：所有速度', '+' + pct(pcApocVal(lv).spd)], ['祝福：队友攻击力', '+' + pct(pcApocVal(lv).atk)], ['祝福持续', '33 秒'], ['战斗路线冷却', '135 秒']],
  act: (lv, p) => { const bat = !pcGuard(p), n = bat ? 16 : 12, T = skillDmg(22, 6, lv);
    return { name: 'pc_awaken', clip: 'pcRaise', dur: 1.2, noCounter: true, invul: true, superArmor: true,
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '天启之珠', who: cutinWho(e) }; game.timeStop = 0.8; sfx.awaken(); for (let i = 0; i < 3; i++) fxCharge(e, '#fff0a0', 3);
        const ox = e.x + e.face * 220; fxSpr('chaser', ox, e.y, 330, { w: 150, dur: 1.6, grow: [0.3, 1.2] }); fxSpr('aura', ox, e.y, 330, { w: 260, dur: 1.4, col: '#fff6c0', alpha: 0.6 });
        for (let i = 0; i < n; i++) game.after(0.35 + i * (bat ? 0.06 : 0.08), () => { if (e.dead) return;
          const F = ents.filter(t => foe(e, t) && !t.dead && (bat ? t.x > cam.x - 40 && t.x < cam.x + WW + 40 : (t.x - e.x) * e.face > -100 && Math.abs(t.x - e.x) < 640)), aim = F.length && Math.random() < 0.75 ? F[Math.floor(Math.random() * F.length)] : null;   // 大部分落在敌人身上
          const x = aim ? aim.x + rnd(-40, 40) : bat ? cam.x + rnd(60, WW - 60) : e.x + e.face * rnd(-60, 560), y = clamp(aim ? aim.y + rnd(-15, 15) : e.y + rnd(-70, 70), 4, DEPTH - 4);
          pcBoltFx(x, y, 320); pcSpearFx(x, y, 120, 150, Math.PI / 2, '#fff6c0', 0.25); fxShock(x, y, 110, '#fff0a0'); if (i % 3 === 0) { sfx.boom(0.5); cam.shake = Math.max(cam.shake, 6); }
          areaHit(e, x, y, bat ? 150 : 120, 0, { dmg: T / n, type: 'indep', elem: 'light', sure: true, launch: 200, knock: 40, hs: 0.04, downHit: true, col: '#fff2a0' }, { zMax: 240 }); });
        if (!bat) game.after(0.9, () => { if (e.dead) return; pcApocBuff(e, lv, 1, 'pc_apoc', 33); for (const m of pcMembers(e, 2400)) pcPillar(m.x, m.y, { w: 90, h: 320, dur: 0.8, col: '#fff6c0' }); pcHolyAdd(e, 1); }); },
      events: [evAt(0.3, e => { cam.flash = 0.12; cam.flashCol = '#fff8d8'; })] }; } });
defSkill('pc_aura', { name: '信念光环', cls: 'priest', job: PCJ, tier: 1, lvReq: 21, maxLv: 10, sp: 30, mp: 0, cd: 0, type: 'indep', passive: true, col: '#ffe070',
  desc: '【一觉被动】坚定的信念赋予天启者权威：基本攻击和技能攻击力提高（两条路线）。守护路线：身边 900px 产生光环，队员的力量 / 智力 / 体力 / 精神和攻击 / 移动 / 施放速度提高，队友（不含自己）的攻击力提高；战斗路线没有光环。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.01 + 0.012 * lv)], ['光环：所有速度', '+' + pct(0.03 + 0.005 * lv)], ['光环：队友攻击力', '+' + pct(0.03 + 0.003 * lv)], ['范围', '900px']] });
defSkill('pc_medit', { name: '冥想', cls: 'priest', job: PCJ, tier: 1, lvReq: 21, maxLv: 1, sp: 0, mp: 0, cd: 0, type: 'indep', passive: true, col: '#c8e0ff', pre: { pc_sacrifice: 1 },
  desc: '【一觉被动 · 守护路线】“神啊，请听我的祈祷。” 体力和精神、物理和魔法暴击率分别按较高的一方对齐（本作：物理暴击率提高到和魔法暴击率一样，圣骑士的独立攻击吃物理暴击）。', req: pcNeedGuard });
// 圣光突袭：带着神圣之力冲 240px（冲刺 3 段、把路上的敌人带着走），最后用巨兵上挑（冲刺 : 终结 ≈ 1 : 2.2）
const pcSplitDmg = lv => ({ run: skillDmg(1.35, 0.135, lv), fin: skillDmg(9, 0.9, lv) });
defSkill('pc_splitter', { name: '圣光突袭', cls: 'priest', job: PCJ, tier: 1, lvReq: 23, sp: 60, mp: 65, cd: 30, type: 'indep', elem: 'light', col: '#fff6c0',
  desc: '带着神圣之力向前突进 240px（突进中 3 段攻击，把路上的敌人一起带着走），然后挥起巨兵向上一击，把敌人打飞（浮空）。突进是瞬移判定，能穿过薄墙。',
  pow: lv => pcSplitDmg(lv).run * 3 + pcSplitDmg(lv).fin, ai: { kind: 'gap', r: [0, 280], dy: 50 }, infoExtra: lv => [['突进', pct(pcSplitDmg(lv).run) + ' × 3'], ['终结', pct(pcSplitDmg(lv).fin)], ['突进距离', '240px']],
  act: lv => { const D = pcSplitDmg(lv);
    return { name: 'pc_splitter', clip: 'pcDash', dur: 0.85, noCounter: true, move: [[0.03, 0.27, 720]],
      onStart: e => { e.act.drag = new Set(); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 260, w: 26, col: '#fff6c0', dur: 0.3 }); sfx.swing(true); },
      update: e => { const a = e.act; if (e.actT < 0.32) { if (Math.floor(e.actT / 0.04) !== a.ai) { a.ai = Math.floor(e.actT / 0.04); fxAfterimage(e, '#fff0b0'); } for (const t of a.drag) if (!t.dead && pcMovable(t)) { t.x = e.x + e.face * 60; t.y = lerp(t.y, e.y, 0.3); } }
        if (!a.up && e.actT >= 0.36) { a.up = true; e.play('pcUpper', true); sfx.swing(true); cam.shake = Math.max(cam.shake, 6); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, a0: 1.6, a1: -1.9, r: 110, w: 26, off: [30, 60], col: '#fff2a0', heavy: true }); pcCrossFx(e.x + e.face * 90, e.y, 110, 150, '#fff2a0', 0.4); } },
      hits: [HB(0.03, 0.32, [-10, 90, 56, 0, 130], D.run, { rep: 0.09, max: 3, stun: 0.5, knock: 0, hs: 0.03, downHit: true, col: '#fff6c0', onHit: (a, t) => { if (a.act && a.act.drag) a.act.drag.add(t); } }),
        HB(0.38, 0.47, [-20, 160, 62, 0, 200], D.fin, { launch: 560, knock: 90, hs: 0.12, shake: 6, big: 1.8, heavy: true, snd: 'blunt', col: '#fff2a0' })] }; } });
// 神圣之矛：造出远古的神圣之矛投向天空（投出时把贴身的敌人推到落点），矛垂直落下（落地 → 砸地 → 3 段爆炸）
const pcDoomDmg = lv => ({ land: skillDmg(0.4, 0.04, lv), hit: skillDmg(1.64, 0.164, lv), boom: skillDmg(4.65, 0.465, lv) });
defSkill('pc_doom', { name: '神圣之矛', cls: 'priest', job: PCJ, tier: 1, lvReq: 25, sp: 70, mp: 85, cd: 40, type: 'indep', elem: 'light', col: '#ffe8a0',
  desc: '造出远古的神圣之矛投出去：投出的瞬间把贴身的敌人推向落点，矛从空中垂直落在前方约 230px 处，砸地后连续爆炸 3 次（大部分伤害在爆炸）。动作很短，爆炸在动作结束后才落下。',
  pow: lv => { const D = pcDoomDmg(lv); return D.land + D.hit + D.boom * 3; }, ai: { kind: 'aoe', r: [60, 330], dy: 70 }, infoExtra: lv => [['爆炸', pct(pcDoomDmg(lv).boom) + ' × 3'], ['爆炸半径', '200px'], ['落点', '前方 230px']],
  act: lv => { const D = pcDoomDmg(lv);
    return { name: 'pc_doom', clip: 'pcThrow', dur: 0.5, noCounter: true,
      events: [evAt(0.12, e => { sfx.swing(true); pcSpearFx(e.x + e.face * 40, e.y, 150, 180, -e.face * 1.2, '#fff6c0', 0.3); const X = e.x + e.face * 230, Y = e.y;
        for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && Math.abs(t.x - e.x) < 90 && Math.abs(t.y - e.y) < 50 && pcMovable(t)) { t.x = X - e.face * 30; t.y = lerp(t.y, Y, 0.5); }
        addFx({ x: X, y: Y + 2, z: 0, dur: 0.45, add: true, img: fxTint('thrust', '#fff6c0'), draw(c) { const k = this.t / this.dur; drawSpr(c, this.img, sx(this.x), sy(this.y, 420 * (1 - k) + 60), 220, 40, { rot: Math.PI / 2 }); } });
        game.after(0.42, () => { if (e.dead) return; sfx.thud(1); fxDust(X, Y, 8, 30); areaHit(e, X, Y, 60, 0, { dmg: D.land, type: 'indep', elem: 'light', stun: 0.4, knock: 0, hs: 0.03, downHit: true }, { zMax: 150 });
          fxShock(X, Y, 160, '#ffe8a0'); areaHit(e, X, Y, 140, 0, { dmg: D.hit, type: 'indep', elem: 'light', stun: 0.5, knock: 30, hs: 0.05, downHit: true }, { zMax: 120 }); });
        for (let i = 0; i < 3; i++) game.after(0.6 + i * 0.12, () => { if (e.dead) return; cam.shake = Math.max(cam.shake, 8); sfx.boom(0.9); fxSpr('explosion', X, Y, 40 + i * 20, { w: 260 + i * 40, dur: 0.45, grow: [0.5, 1.1] }); fxSpr('burst', X, Y, 60, { w: 300, dur: 0.4, col: '#fff2a0' });
          areaHit(e, X, Y, 200, 0, { dmg: D.boom, type: 'indep', elem: 'light', launch: i === 2 ? 420 : 160, knock: 80, hs: 0.07, sure: true, downHit: true, col: '#fff2a0' }, { zMax: 220 }); }); })] }; } });

/* ---- 二次觉醒：神思者 ---- */
// 神圣之光：（被动）体力 / 精神提高；选 1800px 内一名队员（守护路线；战斗路线只能对自己），在他身上爆炸（对队友施放时爆炸伤害 +150%），他 0.8 秒内受到的伤害 −20%，
// 他和自己身上的守护徽章 / 荣誉祝福持续时间 +70 秒；神圣洗礼的圣力：对队友施放 = 信仰（圣力持续时间延长）
const pcFlashDmg = lv => skillDmg(8.5, 0.85, lv);
partyOn('pc_extend', (me, d) => { if (me.dead || !partyForMe(me, d) || !Array.isArray(d.ids)) return; for (const id of d.ids) { const b = partyIdOk(id) && me.buffs[id]; if (b) b.t = Math.min(900, b.t + clamp(+d.t || 0, 0, 120)); } });
partyOn('pc_cleanse', (me, d) => { if (!me.dead && partyForMe(me, d)) partyCleanse(me, clamp(+d.n || 1, 1, 20)); });
defSkill('pc_flash', { name: '神圣之光', cls: 'priest', job: PCJ, tier: 2, lvReq: 26, sp: 80, mp: 70, cd: 20, type: 'indep', elem: 'light', cast: true, col: '#fff6c0',
  desc: '（学会后体力 / 精神提高 → 最大 HP 提高）选择 1800px 内 HP 比例最低的一名队员（守护路线；战斗路线只能对自己），用神圣之光保护他并在他身上引发爆炸：他 0.8 秒内受到的伤害 −20%，他和自己身上的守护徽章 / 荣誉祝福持续时间 +70 秒。对队友施放时爆炸伤害 +150%。',
  pow: pcFlashDmg, ai: { kind: 'aoe', r: [0, 200], dy: 60 }, infoExtra: lv => [['对队友施放', '爆炸 ×2.5'], ['BUFF 延长', '+70 秒'], ['受到伤害', '−20%（0.8 秒）'], ['最大 HP（被动）', '+' + pct(0.02 + 0.002 * lv)], ['范围', '1800px']],
  act: lv => ({ name: 'pc_flash', clip: 'pcHeal', dur: 0.62, noCounter: true,
    events: [evAt(0.02, e => fxCharge(e, '#fff6c0', 2)), evAt(0.45, e => { const t = pcGuard(e) ? (pcPickMate(e, 1800, false) || e) : e, mate = t !== e;
      cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); fxSpr('burst', t.x, t.y, 60, { w: 280, dur: 0.45, col: '#fff6c0', grow: [0.4, 1.15] }); fxShock(t.x, t.y, 220, '#fff6c0'); pcPillar(t.x, t.y, { w: 110, h: 300, col: '#fffaf0' });
      blast(e, t.x, t.y, 160, { dmg: pcFlashDmg(lv) * (mate ? 2.5 : 1), type: 'indep', elem: 'light', launch: 360, knock: 160, hs: 0.1, downHit: true, col: '#fff6c0' }, { zMax: 200 });
      pcGive(e, t, 'buff', { id: 'pc_flash', b: { t: 0.8, taken: -0.2, name: '神圣之光', col: '#fff6c0' } });
      const ids = ['pc_sign', 'pc_honor', 'pc_honor_p']; if (pcGuard(e)) { partyCast('pc_extend', { ids, t: 70, to: pcUid(e, t) }, e); if (mate) partyCast('pc_extend', { ids, t: 70, to: partyMyUid() }, e); }
      if (mate && e.buffs.pc_holy) { e.buffs.pc_holy.t = Math.max(e.buffs.pc_holy.t, 55); fxText('信仰', t.x, t.y, t.z + 40, { col: '#fff6c0', size: 12 }); }
      pcHolyAdd(e, 1); })] }) });
// 圣佑结界：生成神圣法阵（约 1 秒内可以用方向键挪位置，再按技能键立即放下），法阵闪 5 次：每次把阵上的敌人推出去并造成伤害、回复阵里队员的 HP 并解除异常（最后一次伤害最高、纵向范围很大）；
// 法阵在场时再按技能键：立即引爆最后一击
const pcSanctDmg = lv => ({ tick: skillDmg(1.67, 0.167, lv), fin: skillDmg(8.3, 0.83, lv), heal: 0.05 + 0.004 * lv });
defSummon('pc_sanct_f', { kind: 'field', life: 2.4, max: 1, over: 'oldest', keepRoom: false, type: 'indep', elem: 'light', col: '#fff2a0',
  update(s, dt) { if (s.n < 5 && s.lifeT >= 0.3 + s.n * 0.35) pcSanctFlash(s); },
  draw(c, s) { const k = Math.min(1, s.lifeT / 0.2), a = s.n >= 5 ? Math.max(0, 1 - (s.lifeT - s.finT) / 0.4) : 1; drawSpr(c, fxTint('hexagram', '#ffe070'), sx(s.x), sy(s.y, 0), 360 * k, 360 * k * GR, { ground: true, rot: s.lifeT * 0.5, alpha: 0.85 * a }); } });
function pcSanctFlash(s, fin) {
  const e = s.owner, D = s.dmg, last = fin || s.n === 4; s.n = last ? 5 : s.n + 1;
  pcCircle(s.x, s.y, 180, last ? '#fff8d0' : '#ffe070', 0.4, { img: 'rune', spin: 2 }); fxShock(s.x, s.y, 200, '#fff2a0'); sfx.hit('crit', false);
  if (last) { s.finT = s.lifeT; s.life = s.lifeT + 0.45; cam.shake = Math.max(cam.shake, 8); sfx.boom(0.9); for (let i = 0; i < 3; i++) pcPillar(s.x + (i - 1) * 100, s.y, { w: 90, h: 360, dur: 0.6, col: '#fff6c0' }); }
  summonArea(s, s.x, s.y, last ? 250 : 180, last ? { dmg: D.fin, launch: 480, knock: 200, hs: 0.12, big: 1.8, radial: true, downHit: true, col: '#fff2a0' } : { dmg: D.tick, knock: 90, radial: true, stun: 0.3, hs: 0.04, downHit: true, col: '#fff2a0' }, { zMax: last ? 320 : 150 });
  for (const m of pcMembers(e, 3000)) if (inGround(m, s.x, s.y, 190)) { pcGive(e, m, 'heal', { pct: D.heal }); pcGive(e, m, 'pc_cleanse', { n: 5 }); fxSpr('heal', m.x, m.y, 0, { w: 60, h: 120, ay: 1, dur: 0.4, col: '#b8ffd0' }); }
}
function pcSanctPlace(e, lv) {
  const S = e._pcSanct; if (!S || S.placed) return; S.placed = true; if (S.mk) S.mk.dur = S.mk.t;
  const s = summon(e, 'pc_sanct_f', { x: S.x, y: S.y, lv }); if (s) Object.assign(s, { n: 0, dmg: pcSanctDmg(lv) }); sfx.buff(); pcHolyAdd(e, 1);
}
defSkill('pc_sanct', { name: '圣佑结界', cls: 'priest', job: PCJ, tier: 2, lvReq: 26, sp: 80, mp: 80, cd: 40, type: 'indep', elem: 'light', col: '#ffe070',
  desc: '生成神圣法阵：施放后约 1 秒内可以用方向键挪动法阵的位置（再按技能键立即放下；挪位置时被打断也照样放下）。法阵闪 5 次：每次把阵上的敌人推出阵外并造成光属性伤害，回复阵里队员的 HP（按最大 HP 比例）并解除异常状态；最后一次伤害最高、纵向范围很大。法阵在场时再按技能键立即引爆最后一击。可以在普攻中取消施放。',
  pow: lv => pcSanctDmg(lv).tick * 4 + pcSanctDmg(lv).fin, ai: { kind: 'aoe', r: [0, 300], dy: 80 }, infoExtra: lv => [['每次回复', pct(pcSanctDmg(lv).heal) + ' 最大 HP'], ['最后一击', pct(pcSanctDmg(lv).fin)], ['法阵半径', '180px']],
  recast: { ok: p => summonsOf(p, 'pc_sanct_f').some(s => s.n < 5), instant: true, cd: 0.2, mp: 0, act: (lv, p) => { for (const s of summonsOf(p, 'pc_sanct_f')) if (s.n < 5) pcSanctFlash(s, true); } },
  act: lv => ({ name: 'pc_sanct', clip: 'pcCast', dur: 1.0, noCounter: true,
    onStart: e => { const R = game.room, x = e.x + e.face * 170; e._pcSanct = { x: R ? clamp(x, R.x0 + 60, R.x1 - 60) : x, y: e.y, placed: false };
      e._pcSanct.mk = addFx({ x: 0, y: 0, z: 0, dur: 1.2, draw(c) { const S = e._pcSanct; if (!S) return; drawSpr(c, fxTint('hexagram', '#ffe070'), sx(S.x), sy(S.y, 0), 360, 360 * GR, { ground: true, rot: this.t * 2, alpha: 0.35 + 0.2 * Math.sin(this.t * 16) }); } }); },
    onInput: (e, I) => { const a = e.act; if (e.actT > 0.08 && a.key && I.buffered(a.key)) { I.consume(a.key); pcSanctPlace(e, lv); e.endAct(); return true; } return false; },
    update: (e, dt) => { const S = e._pcSanct, I = pcPad(e), R = game.room; if (!S || S.placed) return; S.x += I.dx() * 520 * (dt || 1 / 60); S.y = clamp(S.y + I.dy() * 260 * (dt || 1 / 60), 4, DEPTH - 4); if (R) S.x = clamp(S.x, R.x0 + 60, R.x1 - 60); if (S.mk) S.mk.y = S.y + 0.3; },
    onEnd: e => { pcSanctPlace(e, lv); e._pcSanct = null; } }) });
// 神罚之锤：装备至高神的武器「神罚之锤：朱庇特」（永久）：基本攻击和技能攻击力提高、普攻改写（光属性独立攻击，第 3 下 / 空斩打出圣光冲击，跑攻投出圣光雷枪）、落凤锤变成雷霆重击；
// 光之复仇不能手动放，改为施放神罚之锤时自动施放；施放动作前半段无敌
const pcJupVal = lv => 0.1 + 0.01 * lv;
defSkill('pc_jupiter', { name: '神罚之锤', cls: 'priest', job: PCJ, tier: 2, lvReq: 26, sp: 90, mp: 90, cd: 45, type: 'indep', elem: 'light', buff: true, noHitCheck: true, col: '#fff38a',
  desc: '【BUFF · 永久】召唤至高神的武器「神罚之锤：朱庇特」装备在手上：基本攻击和技能攻击力提高；普攻变成光属性独立攻击的巨锤连击（攻击距离更长，第 3 下和空斩打引发圣光冲击，跑攻投出 3 段圣光雷枪，跳攻范围变大）；落凤锤变成雷霆重击（落地多劈下 3 道圣光雷）。光之复仇改为施放神罚之锤时自动施放。施放动作前半段无敌。',
  ai: { kind: 'buff' }, infoExtra: lv => [['技能攻击力', '+' + pct(pcJupVal(lv))], ['持续', '永久']],
  act: lv => ({ name: 'pc_jupiter', clip: 'pcRaise', dur: 0.7, noCounter: true, invul: [0, 0.45], superArmor: true,
    events: [evAt(0.25, e => { e.buffs.pc_jupiter = { t: game.pvp ? 90 : 1e6, dmg: pcJupVal(lv), name: '神罚之锤', col: '#fff38a' }; pcBoltFx(e.x + e.face * 14, e.y, 320); pcHammerFx(e, e.x, { s: 0.8, dur: 0.4 });
      cam.shake = Math.max(cam.shake, 6); cam.flash = 0.08; cam.flashCol = '#fff6c0'; sfx.boom(0.8); fxText('神罚之锤：朱庇特', e.x, e.y, e.z + 30, { col: '#fff38a', size: 12 });
      if (skLv(e, 'pc_revenge') > 0) pcRevengeOn(e); })] }) });
// 神圣洗礼：信仰之翼（二觉觉醒技，守护路线）：发动后获得圣力（50 秒，最多 5 层，开始 1 层）；施放辅助技能 / 攻击技能打中时 +1 层；每层荣誉祝福效果 +5%；
// 对队友施放神圣之光 = 信仰（圣力持续时间延长）。勇气恩赐（战斗路线）时不能用，改用惩罚。和惩罚共用冷却
defSkill('pc_awaken2', { name: '神圣洗礼：信仰之翼', cls: 'priest', job: PCJ, tier: 2, lvReq: 27, maxLv: 3, sp: 0, mp: 200, cd: 170, pvp: 0.45, type: 'indep', elem: 'light', awaken: true, buff: true, noHitCheck: true, col: '#fffaf0',
  desc: '【二次觉醒「神思者」的觉醒技 · 守护路线】完成二次觉醒任务时自动学会（不花 SP）并放进技能栏（↓↑→→+Z）。在洗礼的光柱里张开信仰之翼，发动后获得「圣力」（50 秒，最多 5 层，开始 1 层）：施放辅助技能、攻击技能打中敌人时各 +1 层；每层让荣誉祝福的效果提高 5%。对队友施放神圣之光时获得「信仰」，圣力持续时间延长。战斗路线（勇气恩赐）不能用，改用惩罚攻击；和惩罚共用冷却。施放中无敌。',
  req: pcNeedGuard, ai: { kind: 'buff' }, infoExtra: () => [['圣力', '最多 5 层'], ['每层荣誉祝福', '+5%'], ['持续', '50 秒']],
  act: () => ({ name: 'pc_awaken2', clip: 'pcRaise', dur: 0.9, noCounter: true, invul: true, superArmor: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '神圣洗礼：信仰之翼', who: cutinWho(e, 2) }; game.timeStop = 0.6; sfx.awaken(); pcShareCd(e, 'pc_awaken2'); },
    events: [evAt(0.3, e => { e.buffs.pc_holy = { t: 50, n: 1, lab: '×1', name: '圣力', col: '#fffaf0' }; pcPillar(e.x, e.y, { w: 130, h: 360, dur: 0.9, col: '#fffaf0' });
      fxSpr('slash', e.x - e.face * 30, e.y, e.z + 90, { w: 170, dur: 0.9, col: '#fffaf0', rot: -0.5, flip: e.face > 0 }); fxSpr('slash', e.x - e.face * 30, e.y, e.z + 90, { w: 170, dur: 0.9, col: '#fffaf0', rot: 0.5, flip: e.face < 0 });
      for (let i = 0; i < 5; i++) fxSpr('chaser', e.x + Math.cos(i / 5 * TAU) * 70, e.y, e.z + 80 + Math.sin(i / 5 * TAU) * 40, { w: 40, dur: 0.9 }); sfx.buff(); })] }) });
// 二觉两招共用冷却
function pcShareCd(e, id) { const o = id === 'pc_awaken2' ? 'pc_punish' : 'pc_awaken2'; if (SKILLS[o]) e.cool[o] = Math.max(e.cool[o] || 0, e.cool[id] || 0); }
// 惩罚：神思者升到空中，对下方大范围降下圣光激光（24 发，越来越密，把敌人吸进范围），激光落完或按跳跃键时落地引发终结爆炸；全程无敌。战斗路线的二觉攻击
const pcPunishDmg = lv => ({ beam: skillDmg(0.7, 0.19, lv), fin: skillDmg(13.2, 3.5, lv) });
defSkill('pc_punish', { name: '惩罚', cls: 'priest', job: PCJ, tier: 2, lvReq: 27, maxLv: 3, sp: 0, mp: 200, cd: 170, pvp: 0.45, type: 'indep', elem: 'light', awaken: true, col: '#fff2a0',
  desc: '【二次觉醒的攻击 · 两条路线】完成二次觉醒任务时自动学会（不花 SP）并放进技能栏（↑↑+Z）。神思者升到空中，对下方大范围降下 24 道圣光激光（越来越密，把范围里的敌人往中间吸），激光落完或按跳跃键时落地，引发终结爆炸。全程无敌。和神圣洗礼：信仰之翼共用冷却（原本是信仰之翼的终结攻击，官方 2020 年分离成单独的技能）。',
  pow: lv => pcPunishDmg(lv).beam * 24 + pcPunishDmg(lv).fin, ai: { kind: 'awaken', r: [0, 560], dy: 140 }, req: pcLinkReq('pc_punish'),
  infoExtra: lv => [['圣光激光', pct(pcPunishDmg(lv).beam) + ' × 24'], ['终结爆炸', pct(pcPunishDmg(lv).fin)], ['范围', '前方 ±320px']],
  act: lv => { const D = pcPunishDmg(lv);
    return { name: 'pc_punish', clip: 'pcFloat', dur: 4, noCounter: true, invul: true, superArmor: true, lowGrav: 0.0001,
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '惩罚', who: cutinWho(e, 2) }; game.timeStop = 0.6; sfx.awaken(); const a = e.act; a.cx = e.x + e.face * 250; a.cy = e.y; a.n = 0; pcShareCd(e, 'pc_punish'); fxText('Discipline!', e.x, e.y, e.z + 60, { col: '#fff2a0', size: 13 }); },
      onInput: (e, I) => { const a = e.act; if (I.buffered('jump') && a.n > 0 && !a.fall) { I.consume('jump'); a.skip = true; return true; } return false; },
      update: e => { const a = e.act;
        if (!a.fall) { e.z = Math.min(150, e.actT * 420); e.vz = 0; e.vx = 0; }
        while (!a.fall && !a.skip && a.n < 24 && e.actT >= 0.4 + 2.3 * Math.pow(a.n / 24, 0.8)) { a.n++; const F = ents.filter(t => foe(e, t) && !t.dead && Math.abs(t.x - a.cx) < 340 && Math.abs(t.y - a.cy) < 100), aim = F.length && a.n % 8 !== 0 ? F[Math.floor(Math.random() * F.length)] : null;   // 大部分激光落在范围里的敌人身上（固定三发打偏，避免随机导致段数波动）
          const x = aim ? aim.x + rnd(-30, 30) : a.cx + rnd(-320, 320), y = clamp(aim ? aim.y + rnd(-12, 12) : a.cy + rnd(-80, 80), 4, DEPTH - 4);
          pcBeamFx(x, y); if (a.n % 3 === 0) sfx.hit('crit', false);
          for (const t of ents) if (foe(e, t) && !t.dead && pcMovable(t) && Math.abs(t.x - a.cx) < 380) { t.x = lerp(t.x, a.cx, 0.04); t.y = lerp(t.y, a.cy, 0.04); }
          areaHit(e, x, y, 80, 0, { dmg: D.beam, type: 'indep', elem: 'light', sure: true, stun: 0.3, knock: 0, hs: 0.02, downHit: true, col: '#fff2a0' }, { zMax: 220 }); }
        if (!a.fall && (a.skip || (a.n >= 24 && e.actT > 2.8))) { a.fall = true; e.vz = -1300; e.play('pcSlam', true); sfx.swing(true); fxText('Volstrecken!', e.x, e.y, e.z + 40, { col: '#fff2a0', size: 13 }); } },
      onLand: e => { const a = e.act; if (!a.fall) { e.vz = 0; e.z = Math.max(e.z, 1); return; } if (a.boom) return; a.boom = true; a.dur = e.actT + 0.6;
        cam.shake = 16; cam.flash = 0.2; cam.flashCol = '#fff8d8'; sfx.boom(1.5); fxSpr('burst', a.cx, a.cy, 50, { w: 460, dur: 0.6, col: '#fff2a0', grow: [0.4, 1.2] }); fxShock(a.cx, a.cy, 420, '#fff2a0'); pcCrossFx(a.cx, a.cy, 120, 320, '#fff2a0', 0.7);
        for (let i = 0; i < 5; i++) pcPillar(a.cx + (i - 2) * 120, a.cy, { w: 90, h: 360, dur: 0.6, col: '#fffaf0' });
        areaHit(e, a.cx, a.cy, 340, 0, { dmg: D.fin, type: 'indep', elem: 'light', sure: true, launch: 520, knock: 200, hs: 0.18, big: 2.4, downHit: true, col: '#fff2a0' }, { zMax: 300 }); } }; } });
// 从天而降的圣光激光（竖着画 laser 素材）
function pcBeamFx(x, y, col = '#ffc83a') {
  fxShock(x, y, 70, col);
  addFx({ x, y: y + 2, z: 0, dur: 0.35, add: true, img: fxTint('laser', col), draw(c) { const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0), w = 34 * (k < 0.15 ? k / 0.15 : 1 - easeIn(Math.max(0, (k - 0.5) / 0.5)) * 0.9);
    c.save(); c.translate(X, Y); c.rotate(-Math.PI / 2); drawSpr(c, this.img, 0, 0, Y + 40, w, { ax: 0, ay: 0.5 }); c.restore(); drawSpr(c, fxTint('spark', col), X, Y - 4, 70 * (0.6 + k), 0, { alpha: 1 - k }); } });
}

/* ---- 三次觉醒：神启·圣骑士 ---- */
defSkill('pc_agent', { name: '神之代行者', cls: 'priest', job: PCJ, tier: 3, lvReq: 29, sp: 60, mp: 0, cd: 0, type: 'indep', passive: true, col: '#8fd0ff',
  desc: '【三觉被动】被雷米迪奥斯选中的神启·圣骑士，用生命之圣遗物「雷米迪奥斯之泪」践行神的意志：基本攻击和转职技能攻击力、体力 / 精神提高。胜利之矛：直接以满蓄投出、矛变大 30%，矛插在地上时再按技能键立即引爆。圣光十字：十字架、爆炸和法阵变大，命中处的法阵也给 BUFF，没打中也在自己脚下生成法阵。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.03 * lv)], ['胜利之矛', '满蓄、变大、再按引爆'], ['圣光十字', '变大、命中处法阵有 BUFF']] });
// 神罚之锤：天怒：只能在装备神罚之锤时发动；划十字生成光之翼，把锤强化成天怒，高高跃起下劈：地面裂开出冲击波（冲击波 : 爆炸 ≈ 3 : 2）；
// 展开光翼时 900px 内队员的信仰延长（只在神圣洗礼发动中有 BUFF 效果）；按住 → 跳得更远
const pcAstraDmg = lv => ({ wave: skillDmg(15.6, 1.56, lv), boom: skillDmg(10.4, 1.04, lv) });
defSkill('pc_astrape', { name: '神罚之锤：天怒', cls: 'priest', job: PCJ, tier: 3, lvReq: 29, sp: 100, mp: 110, cd: 60, type: 'indep', elem: 'light', col: '#fff38a',
  desc: '只能在装备神罚之锤时发动：注入圣遗物之力划下十字，瞬间生成光之翼，把神罚之锤强化为天怒之锤；高高跃起下劈，地面裂开向前扩散冲击波，接着光芒喷出爆炸。按住 → 跳得更远。展开光翼时 900px 内队员的信仰 BUFF 延长（只在神圣洗礼：信仰之翼发动中生效）。',
  pow: lv => pcAstraDmg(lv).wave + pcAstraDmg(lv).boom, ai: { kind: 'burst', r: [60, 420], dy: 60 }, req: p => !!(p.buffs && p.buffs.pc_jupiter) || '需要装备神罚之锤',
  infoExtra: lv => [['冲击波', pct(pcAstraDmg(lv).wave)], ['光之爆炸', pct(pcAstraDmg(lv).boom)], ['信仰延长', (12 + 0.5 * lv).toFixed(1) + ' 秒']],
  act: (lv, p) => { const far = pcPad(p).is(p.face > 0 ? 'right' : 'left'), D = pcAstraDmg(lv);
    return { name: 'pc_astrape', clip: 'pcRaise', dur: 2.4, noCounter: true, superArmor: true,
      onStart: e => { pcCrossFx(e.x, e.y, e.z + 80, 90, '#fff38a', 0.5); fxText('Astrape!', e.x, e.y, e.z + 60, { col: '#fff38a', size: 13 }); sfx.charge(); },
      events: [evAt(0.25, e => { fxSpr('slash', e.x - e.face * 30, e.y, e.z + 90, { w: 190, dur: 0.8, col: '#fff6c0', rot: -0.5, flip: e.face > 0 }); fxSpr('slash', e.x - e.face * 30, e.y, e.z + 90, { w: 190, dur: 0.8, col: '#fff6c0', rot: 0.5, flip: e.face < 0 });
        pcBoltFx(e.x, e.y, 330); if (e.buffs.pc_holy) { e.buffs.pc_holy.t += 12 + 0.5 * lv; fxText('信仰延长', e.x, e.y, e.z + 30, { col: '#fff6c0', size: 11 }); } }),
        evAt(0.38, e => { e.vz = 760; e.z = Math.max(e.z, 1); e.vx = e.face * (far ? 560 : 260); e.play('pcLeap', true); sfx.jump(); }),
        evAt(0.78, e => { e.vz = -1500; e.play('pcSlam', true); sfx.swing(true); })],
      onLand: e => { const a = e.act; if (e.actT < 0.5) { e.vz = 0; return; } if (a.slam) return; a.slam = true; e.vx = 0; a.dur = e.actT + 0.7; cam.shake = 14; sfx.boom(1.3);
        const x = e.x + e.face * 30; pcHammerFx(e, e.x, { s: 1.4, dur: 0.3 }); fxDust(x, e.y, 10, 40); fxStreak({ x, y: e.y, z: 6, face: e.face, len: 420, w: 30, col: '#fff38a', dur: 0.4 });
        for (let i = 0; i < 5; i++) game.after(i * 0.05, () => { fxSpr('wave', x + e.face * (60 + i * 80), e.y, 20, { h: 120, dur: 0.35, col: '#fff38a' }); });
        instantHit(e, { box: [-120, 440, 70, 0, 160], dmg: D.wave, type: 'indep', elem: 'light', launch: 320, knock: 120, hs: 0.12, big: 2, sure: true, downHit: true, col: '#fff38a' });
        game.after(0.3, () => { if (e.dead) return; const bx = x + e.face * 180; cam.shake = Math.max(cam.shake, 12); cam.flash = 0.12; cam.flashCol = '#fff8d8'; sfx.boom(1.2);
          for (let i = 0; i < 4; i++) pcPillar(bx + (i - 1.5) * 90, e.y, { w: 100, h: 380, dur: 0.6, col: '#fff6c0' });
          fxSpr('burst', bx, e.y, 60, { w: 380, dur: 0.5, col: '#fff38a', grow: [0.4, 1.2] });
          areaHit(e, bx, e.y, 240, 0, { dmg: D.boom, type: 'indep', elem: 'light', launch: 460, knock: 160, hs: 0.14, big: 2, sure: true, downHit: true, col: '#fff38a' }, { zMax: 260 }); }); } }; } });
// 生命礼赞：神威（三觉）：划十字向神祈祷，释放生命之圣遗物的力量：8 段同等伤害的神圣之光覆盖全画面；
// 联动天启之珠（默认）：圣遗物化为神圣太阳，守护路线给全队天启之珠 BUFF ×(1.08+1%/级)、43 秒；联动惩罚：和天启之珠 BUFF 叠加 20 秒（23%+1%/级）；战斗路线固定「审判」演出、不给 BUFF
defSkill('pc_awaken3', { name: '生命礼赞：神威', cls: 'priest', job: PCJ, tier: 3, lvReq: 30, maxLv: 3, sp: 0, mp: 300, cd: 270, pvp: 0.45, type: 'indep', elem: 'light', awaken: true, col: '#bfe8ff', switchOpt: '联动天启之珠（关闭 = 联动惩罚）',
  desc: '【三次觉醒「神启·圣骑士」的觉醒技】完成三次觉醒任务时自动学会（不花 SP）并放进技能栏（←↑→↓+Z）。以圣十字之名向神祈祷，释放生命之圣遗物蕴含的力量：神圣之光与雷米迪奥斯的权能覆盖整个画面，对敌人造成 8 段同等的伤害（伤害在演出后段才落下）。和联动的觉醒共用冷却：放了三觉，联动的觉醒一起进冷却；联动的觉醒冷却中三觉不能用。默认联动天启之珠（技能窗口里可以改成联动惩罚）。守护路线：联动天启之珠 = 圣遗物化为神圣太阳，全队 43 秒天启之珠 BUFF（效果 ×108%+）；联动惩罚 = 20 秒额外的天启之珠 BUFF（23%+）。战斗路线：固定「审判」演出，不给 BUFF。全程无敌。',
  pow: lv => skillDmg(44, 12, lv), ai: { kind: 'awaken', r: [0, 700], dy: 200 },
  req: p => { const L = pcLinkOf(p); return (p.cool[L] || 0) > 0 ? `联动的${SKILLS[L].name}冷却中` : true; },
  infoExtra: lv => [['攻击', pct(skillDmg(44, 12, lv) / 8) + ' × 8'], ['联动天启之珠', 'BUFF ×' + pct(1.08 + 0.01 * lv) + '，43 秒'], ['联动惩罚', 'BUFF ' + pct(0.23 + 0.01 * lv) + '，20 秒']],
  act: (lv, p) => { const T = skillDmg(44, 12, lv), sup = pcGuard(p), link = pcLinkOf(p), sun = sup && link === 'pc_awaken';
    return { name: 'pc_awaken3', clip: 'pcPray', dur: 3.1, noCounter: true, invul: true, superArmor: true,
      onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '生命礼赞：神威', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); fxText('我的神，雷米迪奥斯……', e.x, e.y, e.z + 70, { col: '#bfe8ff', size: 12, dur: 1.2 });
        if (SKILLS[link]) e.cool[link] = Math.max(e.cool[link] || 0, SKILLS[link].cd * (e.cdMul || 1)); if (link === 'pc_punish') pcShareCd(e, 'pc_punish'); },
      events: [evAt(0.25, e => pcCrossFx(e.x, e.y, e.z + 70, 70, '#bfe8ff', 0.6)),
        evAt(0.5, e => { addFx({ x: e.x, y: e.y + 1, z: 0, dur: 0.8, add: true, draw(c) { const k = this.t / this.dur; drawSpr(c, fxTint('chaser', '#8fd0ff'), sx(this.x), sy(this.y, 70 + 230 * easeOut(k)), 40 + 60 * k, 0, {}); } }); sfx.charge(); }),
        evAt(1.1, e => { const L = skLv(e, 'pc_awaken') || 1, ox = e.x, oz = 300;
          if (sun) { fxSpr('chaser', ox, e.y, oz, { w: 240, dur: 1.4, grow: [0.6, 1.3] }); fxSpr('aura', ox, e.y, 0, { h: 420, ay: 1, dur: 1.4, col: '#fff6c0' }); pcApocBuff(e, L, 1.08 + 0.01 * lv, 'pc_apoc', 43); }
          else { pcBoltFx(ox, e.y, 420); pcHammerFx(e, ox, { s: 1.2, dur: 0.6 }); if (sup) pcApocBuff(e, L, 0.23 + 0.01 * lv, 'pc_judg', 20); }
          cam.flash = 0.35; cam.flashCol = '#ffffff'; sfx.boom(0.8); pcHolyAdd(e, 1); }),
        ...Array.from({ length: 8 }, (_, i) => evAt(1.7 + i * 0.12, e => { const x0 = cam.x + WW / 2;
          if (i === 0) { for (let j = 0; j < 6; j++) pcPillar(cam.x + 80 + j * (WW - 160) / 5, e.y + rnd(-40, 40), { w: 120, h: 420, dur: 1.2, col: sun ? '#fff6c0' : '#fff38a' }); cam.flash = 0.3; cam.flashCol = '#fff8e0'; }
          cam.shake = Math.max(cam.shake, 10); sfx.boom(0.8); fxShock(x0, e.y, 520, '#fff2a0');
          for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && Math.abs(t.x - x0) < WW * 0.75)
            applyHit(e, t, { dmg: T / 8, type: 'indep', elem: 'light', sure: true, launch: i === 7 ? 520 : 120, knock: i === 7 ? 200 : 20, hs: i === 7 ? 0.2 : 0.04, big: i === 7 ? 2.6 : 1.2, downHit: true, box: null, col: '#fff2a0' }, { proj: true, src: { x: t.x - e.face * 10, y: t.y, z: 0, face: e.face } }); }))] }; } });

/* =====================================================================
   觉醒自动学会、被动、登记
   ===================================================================== */
const PC_AUTO = [['pc_awaken', 1, true], ['pc_awaken2', 2, true], ['pc_punish', 2, true], ['pc_awaken3', 3, true]];
function pcAutoAwaken(p) {
  if (p.kit || !game.skillLv || !game.skillBar || !isHuman(p)) return;
  const got = [];
  for (const [id, tier, grow] of PC_AUTO) { const S = SKILLS[id]; if (!S || !tierUnlocked(tier) || game.lvl < S.lvReq) continue;
    const cur = game.skillLv[id] || 0, want = grow ? Math.min(S.maxLv || 1, 1 + Math.floor((game.lvl - S.lvReq) / (S.lvStep || 1))) : 1;
    if (cur >= want) continue; game.skillLv[id] = want;
    if (!cur) { got.push(S.name); if (!game.skillBar.includes(id) && !(id === 'pc_awaken2' && !pcGuard(p))) { const k = game.skillBar.indexOf(null); if (k >= 0) game.skillBar[k] = id; } } }
  if (got.length) { toastMsg(`觉醒：自动学会 ${got.join('、')}（能用的已放进技能栏）`, '#ffe070'); if (typeof save !== 'undefined' && save.write) save.write(); }
}
// 战斗路线（勇气恩赐）：天启之珠冷却 135 秒
PRIEST_HOOKS.onCast.push((p, id, act, how) => { if (id === 'pc_awaken' && how !== 'recast' && pcBattle(p) && p.cool.pc_awaken > 0) p.cool.pc_awaken = 135 * (p.cdMul || 1) * (game.pvp && SKILLS.pc_awaken.pvpCd ? SKILLS.pc_awaken.pvpCd : 1); });
// 死亡：灵魂牺牲（守护路线）全队回复；生命源泉的次数重置
function pcOnDeath(p) {
  p._pcFountN = 0;
  if (!pcGuard(p) || !(skLv(p, 'pc_sacrifice') > 0)) return;
  game.after(0.3, () => { fxSpr('aura', p.x, p.y, 0, { h: 260, ay: 1, dur: 1.2, col: '#b8ffd0' }); fxText('灵魂牺牲', p.x, p.y, p.z + 40, { col: '#b8ffd0', size: 13 });
    for (const m of pcMembers(p, 1600)) if (m !== p) pcGive(p, m, 'heal', { pct: 0.1, mp: 0.1 }); });
}
CLASSES.priest.passives.push(p => {
  const ids = ['pc_god', 'pc_courage', 'pc_guard', 'pc_firm', 'pc_sacrifice', 'pc_aura', 'pc_medit', 'pc_agent', 'pc_flash'];
  if (!pcOn(p)) { for (const id of ids) setPassive(p, id, false); return; }
  if (isHuman(p)) { const O = pcOpts(); if (O && !O.pcRouteInit) { O.pcRouteInit = 1; (O.swOff ??= {}).pc_guard = true; } }   // 第一次转职成圣骑士：默认战斗路线（守护恩赐关闭）
  pcAutoAwaken(p);
  if (!p._pcDeathHook) { p._pcDeathHook = true; const o = p.onDeath; p.onDeath = a => { if (o) o.call(p, a); pcOnDeath(p); }; }
  const G = pcGuard(p), solo = soloPlay(), L = id => skLv(p, id);
  if (L('pc_god') && p.status) for (const k in p.status) if (p.status[k].t > 0) p.status[k].t -= 0.25 * 0.05;
  setPassive(p, 'pc_courage', !G && L('pc_courage') > 0, { dmg: 0.08 + 0.012 * L('pc_courage'), hide: true });
  setPassive(p, 'pc_guard', G, { hpPct: 0.03 + 0.004 * L('pc_guard'), dmg: solo ? 0.12 + 0.01 * L('pc_guard') : 0, lab: '守护', col: '#a8d8ff' });
  setPassive(p, 'pc_firm', L('pc_firm') > 0, { dmg: 0.01 * L('pc_firm'), crit: 0.02 + 0.003 * L('pc_firm'), hide: true });
  setPassive(p, 'pc_sacrifice', G && L('pc_sacrifice') > 0, { mspd: 0.1, cspd: 0.15, dmg: 0.05, hide: true });
  setPassive(p, 'pc_aura', L('pc_aura') > 0, { dmg: 0.01 + 0.012 * L('pc_aura'), hide: true });
  setPassive(p, 'pc_medit', G && L('pc_medit') > 0, { crit: Math.max(0, (p.baseMcrit || 0) - (p.baseCrit || 0)), hide: true });
  setPassive(p, 'pc_agent', L('pc_agent') > 0, { dmg: 0.03 * L('pc_agent'), hpPct: 0.02, hide: true });
  setPassive(p, 'pc_flash', L('pc_flash') > 0, { hpPct: 0.02 + 0.002 * L('pc_flash'), hide: true });
  if (G && p.buffs.pc_mace) delete p.buffs.pc_mace;   // 切到守护路线：圣灵之槌失效
  if (p.buffs.pc_holy) p.buffs.pc_holy.lab = '×' + p.buffs.pc_holy.n;
  // 信念光环（守护路线）：每 2 秒给 900px 内的队员刷新
  if (G && L('pc_aura') > 0 && game.t - (p._pcAuraT ?? -9) >= 2) { p._pcAuraT = game.t; const a = L('pc_aura'), s = 0.03 + 0.005 * a;
    for (const m of pcMembers(p, 900)) pcGive(p, m, 'buff', { id: 'pc_aura_b', b: { t: 3, aspd: s, cspd: s, mspd: s, ...(m !== p ? { atk: 0.03 + 0.003 * a } : {}), name: '信念光环', col: '#ffe070' } }); }
  // 守护恩赐：敌人身上的属性伤害提高计时（怪物的 buffs 没有全局计时，这里减）
  for (const t of ents) { const b = t.team !== p.team && t.buffs && t.buffs.pc_vuln; if (b && (b.t -= 0.25) <= 0) delete t.buffs.pc_vuln; }
});
{ const J = CLASSES.priest.jobs.crusader;
  Object.assign(J, { art: 'job/crusader', role: '神圣审判（独立攻击）/ 辅助', awaken: 'pc_awaken', awaken2: 'pc_awaken2', awaken3: 'pc_awaken3', auto: ['pc_god', 'pc_courage', 'pc_guard'],
    desc: '身披板甲、以十字架和神圣之力战斗的圣职者。默认走战斗路线（勇气恩赐 + 圣灵之槌），光属性独立攻击的神圣审判；在技能窗口开启「守护恩赐」切换成纯辅助：全队祝福、治疗、护盾、生命源泉复活。' });
  J.skills.push('pc_god', 'pc_courage', 'pc_guard', 'pc_revenge', 'pc_mace', 'pc_spear', 'pc_sacrifice', 'pc_light', 'pc_sign', 'pc_fastheal', 'pc_cross', 'pc_firm', 'pc_honor', 'pc_wall', 'pc_pwall',
    'pc_sphere', 'pc_shrapnel', 'pc_haptism', 'pc_hammer', 'pc_fountain', 'pc_judge', 'pc_wind', 'pc_aura', 'pc_awaken', 'pc_medit', 'pc_splitter', 'pc_doom',
    'pc_flash', 'pc_sanct', 'pc_jupiter', 'pc_awaken2', 'pc_punish', 'pc_agent', 'pc_astrape', 'pc_awaken3');
  Object.assign(J.anims, PC_ANIMS);
  // 指令（官方男圣骑士：wiki.dfo.world 各技能页；Space = 辅助类）
  CLASSES.priest.cmds.push(['fd', 'pc_revenge', 'buff'], ['uff', 'pc_mace', 'buff'], ['fu', 'pc_light', 'buff'], ['df', 'pc_sign', 'buff'], ['bff', 'pc_honor', 'buff'], ['uuf', 'pc_fountain', 'buff'], ['fbf', 'pc_wind', 'buff'],
    ['fu', 'pc_spear'], ['bf', 'pc_wall'], ['ff', 'pc_sphere'], ['fd', 'pc_haptism'], ['fdf', 'pc_hammer'], ['bdf', 'pc_judge'], ['ddf', 'pc_cross'],
    ['uudd', 'pc_awaken'], ['fbdf', 'pc_splitter'], ['ddd', 'pc_doom'], ['fbf', 'pc_flash'], ['duf', 'pc_sanct'], ['dff', 'pc_jupiter'], ['duff', 'pc_awaken2'], ['uu', 'pc_punish'],
    ['udff', 'pc_astrape'], ['bufd', 'pc_awaken3']);
}
