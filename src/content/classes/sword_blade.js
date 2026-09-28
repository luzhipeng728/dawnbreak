/* =====================================================================
   转职：剑魂（鬼剑士，jobId blade）—— 国服现版对齐（docs/SKILLS_OFFICIAL_sword.md 第 3 节）
   里·鬼剑术（按武器变化的第二套普攻）、流心（架势 X 刺 / C 跃 / Z 升 / Space 狂）、武器奥义（各武器专属特效）、
   破军升龙击、拔刀斩（以自身为中心）、猛龙断空斩、破军斩龙击、幻影剑舞、自动格挡 / 破极兵刃 / 逆转反击，觉醒 极·鬼剑术（暴风式）
   ===================================================================== */
const flowMul = p => 1 + buffVal(p, 'flowDmg');
const swWt = p => wtypeOf(p) || 'katana';
const arcanaLv = p => skLv(p, 'wm_arcana');   // 武器奥义：各武器的专属特效（P0 每种武器一条，见 wmWeaponFx）

/* ---- 武器奥义的专属特效（剑魂 + 武器奥义）：
   太刀 刺伤（叠层，满 17 层或 3 秒后引爆）；光剑 感电；钝器 几率眩晕；巨剑 里·鬼剑术第 2 击可蓄力 + 霸体；短剑 普攻 / 里·鬼剑术放出小剑气 ---- */
function wmPierce(p, t) {
  if (t.dead || t.remove) return;
  const P = t._wmPierce || (t._wmPierce = { n: 0, src: p, gen: 0 });
  P.n++; P.src = p;
  const burst = () => { if (!P.n || t.dead || t.remove) { P.n = 0; return; } const n = P.n; P.n = 0; P.gen++;
    fxSpr('slashx', t.x, t.y, t.z + t.h * 0.5, { w: 50 + n * 4, dur: 0.3, col: '#ff7a7a', grow: [0.6, 1.1] });
    applyHit(p, t, { dmg: 0.1 * n, sure: true, hs: 0.02, col: '#ff8a8a', snd: 'stab', wmFx: true }, { proj: true }); };
  if (P.n >= 17) return burst();
  if (P.n === 1) { const g = P.gen; game.after(3, () => { if (P.gen === g) burst(); }); }
}
function wmWeaponFx(p, t, h, act) {
  if (!arcanaLv(p) || t.dead || h.wmFx) return;
  const w = swWt(p), job = act && act.skill && SKILLS[act.skill] && SKILLS[act.skill].job === 'blade';
  if (w === 'katana' && (job || (act && act.rk))) wmPierce(p, t);
  else if (w === 'lightsaber' && Math.random() < (act && act.rk ? 0.5 : 0.2)) {
    addStatus(t, 'shock', 1.5, { src: p });
  } else if (w === 'club' && (job || (act && act.rk)) && Math.random() < 0.15) addStatus(t, 'stun', 0.8, { src: p });
}

/* ---- 被动 ---- */
defSkill('wm_saber', { name: '光剑掌握', cls: 'sword', job: 'blade', lvReq: 15, mp: 0, cd: 0, type: 'phys', passive: true, maxLv: 10, col: '#ffe070',
  desc: '【被动】可以熟练使用光剑：装备光剑时攻击速度提高，除觉醒外所有技能的冷却时间最多减少 10%。', infoExtra: lv => [['攻击速度（光剑）', '+' + pct(0.02 + 0.004 * lv)], ['冷却减少（光剑）', pct(Math.min(0.1, 0.01 * lv))]] });
defSkill('wm_arcana', { name: '武器奥义', cls: 'sword', job: 'blade', lvReq: 15, mp: 0, cd: 0, type: 'phys', passive: true, maxLv: 10, col: '#d8c070',
  desc: '【被动】精通所有武器：攻击力提高，并按当前武器获得专属特效——太刀：技能附加刺伤（叠满 17 层或 3 秒后引爆）；光剑：几率感电；钝器：几率眩晕；巨剑：里·鬼剑术第 2 击可以蓄力并带霸体；短剑：普攻和里·鬼剑术放出小剑气。',
  infoExtra: lv => [['攻击力', '+' + pct(0.03 + 0.006 * lv)]] });
defSkill('wm_mind', { name: '无我剑气', cls: 'sword', job: 'blade', lvReq: 16, mp: 0, cd: 0, type: 'phys', passive: true, maxLv: 10, col: '#a8d8ff',
  desc: '【被动】心无杂念，剑气自成：技能攻击力提高。', infoExtra: lv => [['技能攻击力', '+' + pct(0.03 + 0.01 * lv)]] });

/* ---- 里·鬼剑术（现版）：用快捷键施放的“第二套普攻”，每种武器动作不同；再按技能键 / Z 接下一击，按 X 接回普攻（最后一击除外）；
   算作普攻（随时可以被技能取消）。段落表：[片段, 判定, 效果] ---- */
function rkSegs(w) {
  const S = (clip, box, dmg, o, slash) => ({ clip, box, dmg, o, slash });
  switch (w) {
    case 'shortsword': return [S('rk1', [0, 72, 28, 10, 110], 1.1, { stun: 0.35, knock: 50 }, [-2.4, 0.6]), S('rk2', [0, 72, 28, 10, 110], 1.1, { stun: 0.35, knock: 60 }, [0.8, -2.2]), S('rk1', [0, 76, 30, 10, 110], 1.4, { stun: 0.45, knock: 140 }, [-2.6, 0.9])];
    case 'greatsword': return [S('rk2', [-30, 96, 38, 0, 120], 1.6, { stun: 0.5, knock: -120, pull: true }, [0.8, -2.6]), S('rk4', [0, 104, 38, 0, 130], 2.6, { launch: 420, knock: 200, heavy: true, shake: 4, big: 1.5 }, [-2.8, 1.2])];
    case 'club': return [S('rk1', [0, 80, 30, 10, 110], 1.1, { stun: 0.45, knock: 140 }, [-2.2, 0.8]), S('rk2', [0, 80, 30, 10, 110], 1.1, { stun: 0.45, knock: 140 }, [0.8, -2.2]), S('rk1', [0, 80, 30, 10, 110], 1.1, { stun: 0.45, knock: 140 }, [-2.2, 0.8]), S('rk4', [0, 90, 32, 0, 120], 1.8, { knock: 320, stun: 0.6, heavy: true, shake: 3, big: 1.3 }, [-2.8, 1.2])];
    default: return [S('rk1', [0, 78, 30, 10, 110], 0.9, { stun: 0.35, knock: 40 }, [-2.4, 0.6]), S('rk2', [-10, 80, 30, 10, 110], 0.9, { stun: 0.35, knock: 50 }, [0.8, -2.4]),   // 太刀 / 光剑：二刀流式的 4 连斩
      S('rk3', [0, 78, 30, 0, 140], 1.1, { launch: 360, knock: 40 }, [1.4, -1.9]), S('rk4', [0, 84, 32, 0, 120], 1.5, { down: true, knock: 180, heavy: true, shake: 3, downHit: true }, [-2.8, 1.2])];
  }
}
function rkStage(lv, p, n) {
  const w = swWt(p), segs = rkSegs(w), s = segs[n - 1], last = n === segs.length, light = w === 'lightsaber' || w === 'katana';
  const gsCharge = w === 'greatsword' && last && arcanaLv(p) >= 1;
  const dmg = skillDmg(s.dmg, s.dmg * 0.1, lv) * (w === 'lightsaber' ? 0.9 : 1);
  const a = { name: 'rk' + n, clip: s.clip, dur: light ? 0.32 : w === 'greatsword' ? 0.5 : 0.4, basic: true, rk: true, speed: 'aspd', move: [[0.02, 0.1, s.o.pull ? 40 : 120]],
    follow: last ? null : () => rkStage(lv, p, n + 1), followWin: [0.1, 0.4], chain: last ? null : [0.12, 0.4], next: last ? null : n === 1 ? 'atk2' : 'atk3',
    hits: [HB(0.06, 0.14, s.box, dmg, { hs: 0.06, ...s.o, pull: undefined })],
    events: [slashAt(0.05, { a0: s.slash[0], a1: s.slash[1], r: w === 'greatsword' ? 76 : 60, w: w === 'greatsword' ? 22 : 16, off: [10, 56], heavy: !!s.o.heavy, col: w === 'lightsaber' ? '#fff0a0' : undefined })] };
  if (s.o.pull) a.events.push(evAt(0.04, e => { fxSpr('vortex', e.x + e.face * 70, e.y, e.z + 50, { w: 120, dur: 0.35, alpha: 0.7, grow: [0.6, 1.1] }); for (const t of ents) if (hittable(e, t) && !t.boss && Math.abs(t.y - e.y) < 50 && (t.x - e.x) * e.face > 0 && Math.abs(t.x - e.x) < 180) t.x = lerp(t.x, e.x + e.face * 50, 0.6); }));
  if (gsCharge) { a.dur = 0.62; a.superArmor = true; a.charge = { at: 0.04, max: 0.8, min: 0, dmg: 4.2, clip: 'charge', update: e => { if (Math.random() < 0.5) fxCharge(e, '#cfe6ff'); } }; a.hits[0].t0 += 0.04; a.hits[0].t1 += 0.04; }
  if (w === 'shortsword' && arcanaLv(p)) a.events.push(evAt(0.08, e => projWave(e, { speed: 520, life: 0.35, h: 60, hit: { dmg: dmg * 0.5, knock: 60, stun: 0.3 } })));
  return a;
}
defSkill('rikiken', { name: '里·鬼剑术', cls: 'sword', job: 'blade', lvReq: 15, mp: 0, cd: 0, type: 'phys', col: '#5a8ad0', noCmd: true,
  desc: '剑魂的第二套普攻（只能用快捷键施放）：再按技能键 / Z 接下一击，也可以按 X 接回普攻（最后一击除外），随时可以用技能取消。动作随武器变化——太刀 / 光剑 4 连斩（第 3 击浮空、第 4 击击倒），短剑 3 连斩，巨剑 2 击（旋风吸怪 + 重劈），钝器 4 连推。',
  pow: lv => skillDmg(4.4, 0.44, lv), cmdNote: '快捷键', ai: { kind: 'poke', r: [0, 80], dy: 20 },
  act: (lv, p) => rkStage(lv, p, 1) });

/* ---- 后跳斩：后跳中按 X，能打到倒地的敌人（地板连招起手）---- */
defSkill('backslash', { name: '后跳斩', cls: 'sword', job: 'blade', lvReq: 15, mp: 8, cd: 2, type: 'phys', air: true, col: '#3ab0d0',
  desc: '后跳中按 X：向后翻身的同时向前斩击，把敌人砸向地面，也能打到倒地的敌人。', cmdNote: '后跳中 X', pow: lv => skillDmg(2.0, 0.2, lv), ai: { kind: 'escape' },
  act: (lv, p) => ({ name: 'backslash', clip: 'backslash', dur: 0.5, noCounter: true, move: [[0, 0.3, -180]], lowGrav: 0.8,
    onStart: e => { if (e.z < 20) { e.vz = Math.max(e.vz, 260); e.z = Math.max(e.z, 1); } },
    hits: [HB(0.06, 0.2, [-10, 76, 30, -40, 100], skillDmg(2.0, 0.2, lv), { spike: 380, bounce: 0.5, knock: 60, hs: 0.08, shake: 2, big: 1.3, downHit: true, otgLift: 200 })],
    events: [slashAt(0.05, { a0: -2.6, a1: 1.4, r: 66, w: 20, off: [12, 50], heavy: true }),
      ...(p && swWt(p) === 'club' && arcanaLv(p) ? [evAt(0.18, e => { fxShock(e.x + e.face * 50, e.y, 80, '#cfe6ff'); blast(e, e.x + e.face * 50, e.y, 60, { dmg: skillDmg(0.8, 0.08, lv), launch: 300, knock: 40, hs: 0.05, downHit: true }, { zMax: 60 }); })] : [])],
    onLand: e => { e.vx *= 0.3; if (e.actT > 0.2) e.endAct(); } }) });

/* ---- 流心：进入架势（再按一次解除）；X 流心：刺、C 流心：跃、Z 流心：升、Space 流心：狂 ---- */
const FLOW_KEYS = [['cmdB', 'flow_frenzy'], ['attack', 'flow_stab'], ['jump', 'flow_leap'], ['cmd', 'flow_rise']];
function flowStance() {
  return { name: 'flow', clip: 'charge', dur: 5, noCounter: true, cancelable: true, cancelFrom: 0.05, flowStance: true,
    onStart: e => { fxAura(e, '#8fd8ff', 0.5); sfx.charge(); },
    update: e => { e.vx = 0; e.vy = 0; if (Math.random() < 0.08) fxCharge(e, '#8fd8ff'); },
    onInput: (e, I) => {
      if (e.act.key && e.actT > 0.15 && I.buffered(e.act.key)) { I.consume(e.act.key); e.endAct(); return true; }   // 再按一次流心键：解除
      for (const [key, id] of FLOW_KEYS) if (I.buffered(key) && hasSkill(e, id)) { I.consume(key); if (key === 'cmdB') I.consume('cmd'); e._flowKey = e.act.key; if (castSkill(e, id, false, key)) return true; }
      return false;
    } };
}
defSkill('flow', { name: '流心', cls: 'sword', job: 'blade', lvReq: 16, maxLv: 1, mp: 5, cd: 1, type: 'phys', col: '#3a8ab0',
  desc: '收剑凝神进入流心架势（再按一次解除）：按 X 流心：刺，按 C 流心：跃，按 Z 流心：升，按 Space 流心：狂。可以取消普攻、里·鬼剑术、三段刃和逆转反击。', ai: { kind: 'stance' },
  act: () => flowStance() });
defSkill('flow_stab', { name: '流心：刺', cls: 'sword', job: 'blade', lvReq: 16, mp: 15, cd: 8, type: 'phys', col: '#4aa0e0', cmdNote: '流心中 X',
  desc: '流心架势中按 X：向前强力突刺（方向键调整冲刺距离），判定上算作跑攻，之后可以按 X 接连突刺或接三段刃。太刀 / 光剑突刺 4 段；钝器附带眩晕；巨剑 / 短剑可以再按 Z 追加下劈。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'gap', r: [0, 170], dy: 20 },
  act: (lv, p) => {
    const w = swWt(p), n = w === 'katana' || w === 'lightsaber' ? 4 : 2, club = w === 'club', dist = e => { const d = e.pad.dx() * e.face; return d > 0 ? 760 : d < 0 ? 380 : 620; };
    return { name: 'flow_stab', clip: 'dash', dur: 0.46, noCounter: true, links: ['triple'], linkFrom: 0.2,
      follow: w === 'greatsword' || w === 'shortsword' ? () => ({ name: 'flow_chop', clip: 'a3slam', dur: 0.5, noCounter: true, move: [[0.02, 0.1, 120]],
        hits: [HB(0.1, 0.18, [0, 90, 32, 0, 120], skillDmg(1.6, 0.16, lv) * flowMul(p), { down: true, knock: 120, hs: 0.09, shake: 3, heavy: true, downHit: true })],
        events: [slashAt(0.09, { a0: -2.7, a1: 1.1, r: 70, w: 22, off: [10, 56], heavy: true })] }) : null, followWin: [0.22, 0.46],
      onStart: e => { e.act.move = [[0.02, 0.2, dist(e)]]; },
      onInput: (e, I) => { if (e.actT > 0.24 && I.buffered('attack') && hasSkill(e, 'dashthrust')) { I.consume('attack'); e.doAct(e.acts.dash2); return true; } return false; },
      hits: [HB(0.02, 0.24, [-10, 70, 28, 20, 100], skillDmg(1.2 / (n - 1), 0.12 / (n - 1), lv) * flowMul(p), { rep: 0.05, max: n - 1, stun: 0.35, knock: 30, hs: 0.03, snd: 'stab' }),
        HB(0.24, 0.3, [0, 70, 28, 20, 100], skillDmg(1.2, 0.12, lv) * flowMul(p) * (club ? 1.3 : 1), { knock: 220, stun: 0.5, hs: 0.08, heavy: true, shake: 2, onHit: club ? (a, t) => addStatus(t, 'stun', 3, { src: a }) : undefined })],
      events: [evAt(0.01, e => { fxAfterimage(e, '#8fd8ff'); fxStreak({ x: e.x - e.face * 30, y: e.y, z: e.z + 60, face: e.face, len: 190, w: 14, col: '#8fd8ff', dur: 0.24 }); sfx.iai(); })] };
  } });
defSkill('flow_leap', { name: '流心：跃', cls: 'sword', job: 'blade', lvReq: 17, mp: 20, cd: 4, type: 'phys', col: '#3a70c0', cmdNote: '流心中 C（腾空时按 X）',
  desc: '流心架势中按 C：低而快地向前跃出（可以用 ↑↓ 调整纵深），腾空时按 X 打出强力下斩，落地冲击使敌人倒地。不追加操作时落地回到流心架势。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'gap', r: [80, 240], dy: 40 },
  act: (lv, p) => ({ name: 'flow_leap', clip: 'leap', dur: 1.4, noCounter: true, superArmor: true,
    onStart: e => { e.vz = 380; e.z = Math.max(e.z, 1); e.vx = e.face * 340; sfx.jump(); fxDust(e.x, e.y, 5, 12); },
    onInput: (e, I) => { e.vy = I.dy() * 90; if (!e.act.dive && e.actT > 0.1 && I.buffered('attack')) { I.consume('attack'); e.act.dive = true; } return false; },
    update: e => { if (!e.act.diving && e.act.dive) { e.act.diving = true; e.vz = -1100; e.vx = e.face * 140; e.play('silver', true); sfx.swing(true); } },
    hits: [HB(0, 1.4, [-10, 50, 28, -40, 60], skillDmg(0.8, 0.08, lv) * flowMul(p), { stun: 0.3, spike: 420, bounce: 0.4, hs: 0.05 })],
    onLand: e => { e.vx = 0; e.vy = 0; e.act.hits = null; e.act.onLand = null;
      if (!e.act.diving) { e.doAct(flowStance(), { skill: 'flow', lv: 1, key: e._flowKey || null }); return; }   // 没追加操作：落地回到架势（沿用流心键，再按一次仍能解除）
      e.act.dur = e.actT + 0.32; e.play('leapLand', true); cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8);
      fxShock(e.x + e.face * 20, e.y, 140, '#8fd8ff'); fxDust(e.x, e.y, 10, 30);
      blast(e, e.x + e.face * 20, e.y, 100, { dmg: skillDmg(2.2, 0.22, lv) * flowMul(p), down: true, knock: 160, hs: 0.09, downHit: true, big: 1.4 }); } }) });
defSkill('flow_rise', { name: '流心：升', cls: 'sword', job: 'blade', lvReq: 18, mp: 20, cd: 4, type: 'phys', col: '#5ac0f0', cmdNote: '流心中 Z',
  desc: '流心架势中按 Z：高高跃起连续上斩，把敌人卷上高空。光剑 / 太刀多段；其他武器对浮空、霸体的敌人伤害提高。', pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'launch', r: [0, 70], dy: 22 },
  act: (lv, p) => { const w = swWt(p), multi = w === 'katana' || w === 'lightsaber';
    return { name: 'flow_rise', clip: 'up', dur: 0.62, noCounter: true, superArmor: [0, 0.3], move: [[0.04, 0.3, 50, w === 'greatsword' ? 240 : 300]], lowGrav: 0.6,
      hits: [HB(0.05, 0.32, [-10, 70, 30, -10, 150], skillDmg(multi ? 1.07 : 3.2, multi ? 0.107 : 0.32, lv) * flowMul(p), { rep: multi ? 0.09 : 1, max: multi ? 3 : 1, launch: 460, airLift: 420, knock: 20, hs: 0.04,
        onHit: multi ? undefined : (a, t) => { if (t.z > 2 || hasSA(t)) { const b = Math.round(t.lastDmg * 1.1); t.hp -= b; addNumber(b, t.x, t.y, t.z, {}); } } })],
      update: e => { if (e.actT < 0.32 && Math.random() < 0.5) fxSlashOn(e, { col: '#9fe8ff', a0: 1.2, a1: -1.6, r: rnd(44, 62), w: 10, off: [10, 50], dur: 0.12 }); },
      onLand: e => { if (e.actT > 0.1) e.endAct(); } }; } });
defSkill('flow_frenzy', { name: '流心：狂', cls: 'sword', job: 'blade', lvReq: 18, mp: 30, cd: 5, type: 'phys', buff: true, col: '#2a60c0', cmdNote: '流心中 Space',
  desc: '【BUFF】流心架势中按 Space（或用快捷键）：蓄气 0.3 秒，流心：刺 / 跃 / 升的伤害和暴击率提高，效果一直持续。', infoExtra: lv => [['流心技能伤害', '+' + pct(0.2 + 0.03 * lv)], ['暴击率', '+' + pct(0.02 + 0.004 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'flow_frenzy', clip: 'focus', dur: 0.4, noCounter: true, onStart: e => { e.buffs.flow_frenzy = { t: 9999, flowDmg: 0.2 + 0.03 * lv, crit: 0.02 + 0.004 * lv }; sfx.buff(); fxAura(e, '#6ac8ff', 1); } }) });

/* ---- BUFF 与反击 ---- */
defSkill('wm_autoguard', { name: '自动格挡', cls: 'sword', job: 'blade', lvReq: 17, mp: 30, cd: 30, type: 'phys', buff: true, col: '#6ab0e0',
  desc: '【BUFF】120 秒内被击时有几率自动格挡：挡下这次攻击，霸体 2 秒，并立刻上挑反击把敌人打飞。', infoExtra: lv => [['自动格挡几率', pct(Math.min(0.5, 0.05 * lv))], ['持续时间', '120 秒']], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'wm_autoguard', clip: 'guard', dur: 0.4, noCounter: true, onStart: e => { e.buffs.wm_autoguard = { t: 120, chance: Math.min(0.5, 0.05 * lv), lv }; sfx.buff(); fxAura(e, '#9fd8ff', 0.8); } }) });
defSkill('wm_edge', { name: '破极兵刃', cls: 'sword', job: 'blade', lvReq: 17, mp: 40, cd: 5, type: 'phys', buff: true, col: '#e0e8ff',
  desc: '【BUFF】磨砺剑刃，攻击力和物理暴击率提高，效果一直持续。', infoExtra: lv => [['攻击力', '+' + pct(0.04 + 0.008 * lv)], ['物理暴击率', '+' + pct(0.02 + 0.003 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'wm_edge', clip: 'focus', dur: 0.5, noCounter: true, onStart: e => { e.buffs.wm_edge = { t: 9999, atk: 0.04 + 0.008 * lv, crit: 0.02 + 0.003 * lv }; sfx.buff(); fxAura(e, '#e8f0ff', 1); fxSlashOn(e, { a0: -1.6, a1: 1.6, r: 50, w: 12, off: [6, 70], col: '#ffffff' }); } }) });
defSkill('wm_reverse', { name: '逆转反击', cls: 'sword', job: 'blade', lvReq: 18, mp: 20, cd: 15, type: 'phys', air: true, col: '#7ac0ff',
  desc: '从背后被攻击时按 Z：转身上挑，把背后的敌人打飞。反击时不会受到伤害，空中也能用。', cmdNote: '(被背击时) Z', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'escape' },
  whenHit: p => !!p._backHitT && game.t - p._backHitT < 1 && (p.st === 'hit' || p.st === 'air' || p.st === 'act' || p.free),
  act: (lv) => ({ name: 'wm_reverse', clip: 'up', dur: 0.46, noCounter: true, invul: [0, 0.36], links: ['flow'],
    onStart: e => { e.face = -e.face; e._backHitT = 0; e.vx = 0; fxAfterimage(e, '#9fd8ff'); },
    hits: [HB(0.06, 0.16, [-10, 80, 32, -20, 140], skillDmg(3.0, 0.3, lv), { launch: 520, knock: 80, hs: 0.1, shake: 3, big: 1.4, sure: true })],
    events: [slashAt(0.05, { a0: 1.4, a1: -1.9, r: 66, w: 20, off: [10, 50], heavy: true, col: '#bfe8ff' })] }) });

/* ---- 破军升龙击：肩撞前冲（霸体）推开敌人 → 单手上斩浮空（光剑肩撞多 2 段，太刀上斩多 1 段）---- */
defSkill('rise', { name: '破军升龙击', cls: 'sword', job: 'blade', lvReq: 18, mp: 45, cd: 10, type: 'phys', icon: 'rise', col: '#e0602a',
  desc: '霸体肩撞前冲把敌人推开，接着单手上斩把敌人打上高空。光剑肩撞多 2 段；太刀上斩多 1 段。', pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'launch', r: [0, 150], dy: 24 },
  act: (lv, p) => { const w = swWt(p);
    return { name: 'rise', clip: 'rush', dur: 1.0, superArmor: true, noCounter: true, move: [[0, 0.24, 480]],
      hits: [HB(0.02, 0.24, [-10, 60, 28, 10, 100], skillDmg(1.2, 0.12, lv) / (w === 'lightsaber' ? 3 : 1), { rep: w === 'lightsaber' ? 0.08 : 0, max: w === 'lightsaber' ? 3 : 0, knock: 90, stun: 0.5, hs: 0.05 })],
      update: e => {
        const a = e.act;
        if (!a.up && (e.actT >= 0.24 || e.hitsDone.size)) { a.up = true; a.upT = e.actT; e.vx = e.face * 50; e.vz = 560; e.z = Math.max(e.z, 1); e.play('rise', true); sfx.swing(true);
          const n = w === 'katana' ? 6 : 5;
          a.hits = [HB(a.upT, a.upT + 0.34, [-10, 66, 30, -10, 140], skillDmg(0.7, 0.07, lv) * 5 / n, { rep: 0.34 / n, max: n, airLift: 520, launch: 520, knock: 20, hs: 0.03 }),
            HB(a.upT + 0.38, a.upT + 0.44, [-10, 80, 32, -20, 150], skillDmg(1.4, 0.14, lv), { down: true, knock: 180, hs: 0.1, shake: 4, big: 1.4 })]; }
        if (a.up && e.actT - a.upT < 0.36 && Math.random() < 0.6) fxSlashOn(e, { col: '#ffa060', a0: 1.2, a1: -1.6, r: rnd(40, 60), w: 10, off: [10, 50], dur: 0.12 });
      },
      lowGrav: 0.5, onLand: e => { if (e.act.up && e.actT - e.act.upT > 0.1) e.endAct(); } }; } });

/* ---- 拔刀斩：约 0.5 秒拔刀预备（霸体），以自身为中心大范围斩击。巨剑（武器奥义）可按住蓄力；太刀 / 光剑（武器奥义）再按追加一斩 ---- */
defSkill('iai', { name: '拔刀斩', cls: 'sword', job: 'blade', lvReq: 19, mp: 60, cd: 15, type: 'phys', icon: 'iai', col: '#d8a02a',
  desc: '收刀凝神约 0.5 秒（霸体），瞬间拔刀，以自身为中心斩出大范围剑光。武器奥义：巨剑可以按住技能键蓄力；太刀 / 光剑可以再按技能键追加一斩。', pow: lv => skillDmg(6.5, 0.7, lv), ai: { kind: 'burst', r: [0, 150], dy: 40 },
  act: (lv, p) => { const w = swWt(p), ar = arcanaLv(p) > 0;
    const a = { name: 'iai', clip: 'iai', dur: 0.95, superArmor: true, noCounter: true,
      update: (e) => { if (!e.act.charging) e.drawOpts = { glow: e.actT < 0.4 ? e.actT / 0.4 : Math.max(0, 1 - (e.actT - 0.4) * 3) }; },
      onEnd: (e) => { e.drawOpts = {}; },
      events: [evAt(0.02, () => sfx.charge()), evAt(0.4, e => {
        cam.flash = 0.12; cam.flashCol = '#fff6d0'; cam.shake = 7; sfx.iai();
        fxShock(e.x, e.y, 170, '#ffd070'); fxSlashOn(e, { col: '#ffd070', a0: -3.1, a1: 3.1, r: 110, w: 30, off: [0, 50], squash: 0.45, dur: 0.3 });
        fxBurst(e.x, e.y, e.z + 50, 200, '#ffd070');
        instantHit(e, { box: [-150, 160, 44, 0, 130], dmg: skillDmg(6.5, 0.7, lv), down: true, knock: 260, radial: true, hs: 0.14, big: 1.8, col: '#ffe0a0', critBonus: 0.2, downHit: true });
      })] };
    if (w === 'greatsword' && ar) a.charge = { at: 0.3, max: 0.5, min: 0, dmg: 0.6, update: (e, dt, k) => { if (Math.random() < 0.5) fxCharge(e, '#ffd070'); e.drawOpts = { glow: 0.3 + k * 0.7 }; } };
    if ((w === 'katana' || w === 'lightsaber') && ar) { a.follow = () => ({ name: 'iai2', clip: 'rk1', dur: 0.45, noCounter: true, superArmor: true,
      hits: [HB(0.06, 0.14, [-20, 180, 40, 0, 130], skillDmg(2.4, 0.26, lv), { knock: 160, stun: 0.6, hs: 0.1, shake: 4, big: 1.4, col: w === 'lightsaber' ? '#fff38a' : '#ffb0b0' })],
      events: [evAt(0.05, e => { sfx.iai(); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 60, face: e.face, len: 220, w: 18, col: w === 'lightsaber' ? '#fff38a' : '#ff9a9a', dur: 0.25 }); })] }); a.followWin = [0.5, 0.95]; }
    return a; } });

/* ---- 猛龙断空斩：预备时 ↑↓ 选方向，化作剑光高速突进（现版 2 段，第 1 段后可再改方向），最后单手上斩浮空。突进中霸体 ---- */
defSkill('dragon', { name: '猛龙断空斩', cls: 'sword', job: 'blade', lvReq: 19, mp: 60, cd: 20, type: 'phys', col: '#2a6ad0',
  desc: '化作一道剑光高速突进斩击 2 次（每次都可以用方向键改变方向，包括纵深），最后单手上斩把敌人打上天。突进中霸体。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'gap', r: [0, 240], dy: 60 },
  act: (lv) => ({ name: 'dragon', clip: 'dragon', dur: 1.0, noCounter: true,
    onStart: e => { e.act.seg = -1; },
    update: e => {
      const a = e.act, SEG = 0.3, seg = Math.floor(e.actT / SEG);
      if (seg !== a.seg && seg < 2) {
        a.seg = seg; e.hitsDone.clear();
        let dx = e.pad.dx(), dy = e.pad.dy(); if (!dx && !dy) dx = e.face; if (dx) e.face = dx;
        if (e.pad !== input) { const t = nearestFoe(e, 400); if (t) { dx = Math.sign(t.x - e.x) || e.face; dy = Math.sign(t.y - e.y) * (Math.abs(t.y - e.y) > 10 ? 1 : 0); e.face = dx; } }
        const l = Math.hypot(dx, dy * 1.3) || 1; a.vx = dx / l * 720; a.vy = dy / l * 420;
        fxAfterimage(e, '#8fb8ff'); sfx.swing(true); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 58, face: e.face, len: 170, w: 14, col: '#8fb8ff', dur: 0.2 });
      }
      if (seg < 2) { const k = (e.actT % SEG) < 0.22; e.superArmor = Math.max(e.superArmor, k ? 0.02 : 0); e.vx = k ? a.vx : a.vx * 0.2; e.vy = k ? a.vy : a.vy * 0.2; }
      else if (!a.fin) { a.fin = true; e.vx = e.face * 60; e.vy = 0; e.play('up', true); fxSlashOn(e, { col: '#8fb8ff', a0: 1.4, a1: -1.9, r: 70, w: 22, off: [10, 50] }); sfx.swing(true);
        instantHit(e, { box: [-10, 84, 32, 0, 130], dmg: skillDmg(2.6, 0.26, lv), launch: 560, knock: 60, hs: 0.1, shake: 4, big: 1.5 }); }
    },
    hits: [HB(0, 0.6, [-20, 60, 30, 10, 100], skillDmg(2.2, 0.22, lv), { rep: 0.3, stun: 0.5, knock: 40, airLift: 200, hs: 0.04 })],
    onEnd: e => { e.vy = 0; } }) });

/* ---- 破军斩龙击：肩撞前冲推开并眩晕周围敌人 → 转身回冲连刺 → 把敌人聚到一处上挑浮空 ---- */
defSkill('wm_dragonrush', { name: '破军斩龙击', cls: 'sword', job: 'blade', lvReq: 19, mp: 55, cd: 25, type: 'phys', col: '#e0802a',
  desc: '霸体肩撞前冲，推开并眩晕沿途的敌人；随即转身回冲连续突刺，最后把敌人聚到一处上挑浮空。', pow: lv => skillDmg(8.0, 0.8, lv), ai: { kind: 'gap', r: [0, 200], dy: 30 },
  act: (lv) => ({ name: 'wm_dragonrush', clip: 'rush', dur: 1.35, superArmor: true, noCounter: true, move: [[0, 0.3, 560]],
    hits: [HB(0.02, 0.3, [-10, 64, 34, 10, 100], skillDmg(1.6, 0.16, lv), { knock: 60, stun: 0.9, hs: 0.05, onHit: (a, t) => addStatus(t, 'stun', 1.2, { src: a }) })],
    events: [evAt(0.34, e => { e.face = -e.face; e.play('flurry', true); fxAfterimage(e, '#ffb060'); sfx.swing(true); e.act.move = [[0.34, 0.8, 260]];
        e.act.hits = [HB(0.34, 0.8, [-10, 72, 30, 20, 100], skillDmg(0.55, 0.055, lv), { rep: 0.07, stun: 0.3, knock: 10, hs: 0.03, snd: 'stab', pull: true })]; }),
      evAt(0.82, e => { for (const t of ents) if (hittable(e, t) && !t.boss && Math.abs(t.x - e.x) < 200 && Math.abs(t.y - e.y) < 60) { t.x = lerp(t.x, e.x + e.face * 50, 0.8); t.y = lerp(t.y, e.y, 0.6); } fxSpr('vortex', e.x + e.face * 50, e.y, e.z + 50, { w: 120, dur: 0.3, alpha: 0.7 }); }),
      evAt(0.9, e => { e.play('up', true); fxSlashOn(e, { col: '#ffb060', a0: 1.4, a1: -1.9, r: 76, w: 24, off: [10, 50], heavy: true }); sfx.swing(true); cam.shake = Math.max(cam.shake, 4);
        instantHit(e, { box: [-10, 90, 36, 0, 140], dmg: skillDmg(2.6, 0.26, lv), launch: 540, knock: 60, hs: 0.1, big: 1.5 }); })],
    update: e => { if (e.actT > 0.34 && e.actT < 0.8 && Math.floor(e.actT / 0.07) !== e._wr) { e._wr = Math.floor(e.actT / 0.07); fxStreak({ x: e.x + e.face * 12, y: e.y + rnd(-4, 4), z: e.z + rnd(50, 70), face: e.face, len: rnd(45, 65), w: 5, col: '#ffb060', dur: 0.1 }); } } }) });

/* ---- 幻影剑舞：原地连斩（连打技能键 / X 加速），每斩飞出短剑气，最后放出巨大剑气（↑↓ 调方向）。霸体 ---- */
defSkill('phantom', { name: '幻影剑舞', cls: 'sword', job: 'blade', lvReq: 20, mp: 80, cd: 45, type: 'phys', col: '#4a50c8',
  desc: '原地舞出幻影般的连斩（太刀 / 光剑斩得更快更多），连打技能键或 X 可以加速，最后向前放出巨大剑气（↑↓ 调整方向）击飞敌人。全程霸体。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'burst', r: [0, 100], dy: 24 },
  act: (lv, p) => { const fast = ['katana', 'lightsaber'].includes(swWt(p)), step = fast ? 0.06 : 0.1;
    return { name: 'phantom', clip: 'phantom', dur: 2.0, superArmor: true, noCounter: true,
      onStart: e => { e.act.end = 1.3; e.act.rate = 1; },
      onInput: (e, I) => { if (I.buffered('attack') || (e.act.key && I.buffered(e.act.key))) { I.consume('attack'); if (e.act.key) I.consume(e.act.key); e.act.rate = Math.min(1.8, e.act.rate + 0.12); } e.vy = I.dy() * 60; return false; },
      update: (e, dt) => {
        const a = e.act; a.dur = a.end + 0.5; a.rate = Math.max(1, a.rate - dt * 0.6);   // 连打加速：斩击间隔按 rate 缩短
        a.tk = (a.tk || 0) + dt * a.rate;
        if (e.actT < a.end && a.tk >= step) { a.tk = 0; a.k = (a.k || 0) + 1; e.hitsDone.clear(); fxSlashOn(e, { col: '#b0c0ff', a0: rnd(-3, 0), a1: rnd(0, 3), r: rnd(50, 72), w: 10, off: [16, rnd(35, 70)], squash: rnd(0.4, 0.9), dur: 0.1, silent: a.k % 2 === 1 });
          if (a.k % 3 === 0) projWave(e, { speed: 480, life: 0.25, h: 50, hit: { dmg: skillDmg(0.15, 0.015, lv), knock: 20, stun: 0.25 } }); }
        if (e.actT >= a.end && !a.fin) { a.fin = true; e.play('atk3', true); sfx.iai(); cam.shake = Math.max(cam.shake, 5);
          projWave(e, { speed: 520, life: 0.6, hit: { dmg: skillDmg(3.0, 0.3, lv), launch: 460, knock: 200, hs: 0.1, big: 1.6, rep: 0 } }); }
      },
      hits: [HB(0, 2.4, [-20, 88, 34, 0, 120], skillDmg(0.3, 0.03, lv) * (fast ? 0.6 : 1), { rep: step, stun: 0.3, knock: 10, airLift: 140, hs: 0.02, snd: 'slash' })],
      onEnd: e => { e.vy = 0; } }; } });

/* ---- 一觉：极·鬼剑术（暴风式）（觉醒被动 / 更高等级技能见 P1）---- */
defSkill('awaken', { name: '极·鬼剑术（暴风式）', cls: 'sword', job: 'blade', lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'phys', awaken: true, icon: 'awaken', col: '#ffd23a',
  desc: '【觉醒】向空中和地面抛出 24 把剑组成剑阵，把敌人吸到阵中心反复斩击（连打技能键 / X 加速），最后上斩收尾引爆剑阵。施放中无敌。', pow: lv => skillDmg(22, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv) => ({ name: 'awaken', clip: 'awkB', dur: 2.9, superArmor: true, noCounter: true, invul: [0, 2.9],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '极·鬼剑术', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); e.act.cx = e.x + e.face * 130; e.act.cy = e.y; e.act.rate = 1; },
    onInput: (e, I) => { if (I.buffered('attack') || (e.act.key && I.buffered(e.act.key))) { I.consume('attack'); if (e.act.key) I.consume(e.act.key); e.act.rate = Math.min(1.6, e.act.rate + 0.1); } return false; },
    update: (e, dt) => {
      const a = e.act; if (e.actT < 0.95) return;
      a.rate = Math.max(1, a.rate - dt * 0.5);
      for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.5) < 280 && !(t.boss && hasSA(t))) { t.x = damp(t.x, a.cx, 4, dt); t.y = damp(t.y, a.cy, 4, dt); }
      a.tk = (a.tk || 0) + dt * a.rate;
      if (e.actT < 2.4 && a.tk >= 0.08) {
        a.tk = 0; a.k = (a.k || 0) + 1; const ang = a.k * 2.4, r = 70 + (a.k % 3) * 40;
        fxSpr('swordrain', a.cx + Math.cos(ang) * r, a.cy + Math.sin(ang) * r * 0.4, 30, { h: 110, dur: 0.35, ay: 1, grow: [1.2, 1], alpha: 0.9 });
        if (a.k % 2) { fxSlashX(a.cx + rnd(-60, 60), a.cy + rnd(-20, 20), rnd(40, 90), rnd(90, 140), '#bfe8ff'); sfx.swing(false); }
        blast(e, a.cx, a.cy, 170, { dmg: skillDmg(0.6, 0.18, lv), airLift: 160, stun: 0.3, knock: 0, hs: 0.02, downHit: true, sure: true }, { zMax: 260 });
      }
    },
    events: [evAt(0.95, e => { cam.flash = 0.2; cam.flashCol = '#dff4ff'; fxShock(e.act.cx, e.act.cy, 300, '#9fe8ff'); }),
      evAt(2.45, e => { const a = e.act; cam.flash = 0.35; cam.flashCol = '#ffffff'; cam.shake = 12; sfx.iai(); sfx.boom(1.2);
        fxBurst(a.cx, a.cy, 60, 320, '#bfe8ff'); fxShock(a.cx, a.cy, 280, '#ffffff');
        blast(e, a.cx, a.cy, 240, { dmg: skillDmg(8, 2.5, lv), launch: 520, knock: 200, hs: 0.2, big: 2.2, critBonus: 0.3, downHit: true, sure: true, col: '#ffe070' }, { zMax: 300 }); })] }) });

CLASSES.sword.jobs.blade = { art: 'job/blade', name: '剑魂', role: '近战 · 连击', armor: 'light', awaken: 'awaken', awakenName: '剑圣',
  desc: '专精剑术的鬼剑士，能驾驭所有武器。里·鬼剑术随武器变化，流心架势派生刺 / 跃 / 升 / 狂，拔刀斩、猛龙断空斩、幻影剑舞打出华丽的连招。',
  skills: ['wm_saber', 'wm_arcana', 'rikiken', 'backslash', 'wm_mind', 'flow', 'flow_stab', 'flow_leap', 'flow_rise', 'flow_frenzy', 'wm_autoguard', 'wm_edge', 'wm_reverse', 'rise', 'iai', 'dragon', 'wm_dragonrush', 'phantom', 'awaken'] };
CLASSES.sword.cmds.push(['du', 'wm_autoguard', 'buff'], ['ff', 'wm_edge', 'buff'], ['hit', 'wm_reverse'], ['bff', 'rise'], ['bdf', 'iai'], ['uff', 'dragon'], ['fbdf', 'wm_dragonrush'], ['fdf', 'phantom'], ['uudd', 'awaken']);
// 流心可以取消：普攻（强制，天然可以）、里·鬼剑术（算普攻）、三段刃、逆转反击
SKILLS.triple.links = ['flow'];
// 剑魂被动：光剑掌握（攻速）、武器奥义（攻击力）、无我剑气（技能伤害）
CLASSES.sword.passives.push(p => {
  const blade = jobOf(p) === 'blade', saber = blade && skLv(p, 'wm_saber') && swWt(p) === 'lightsaber';
  setPassive(p, 'wm_saber', !!saber, { aspd: 0.02 + 0.004 * skLv(p, 'wm_saber') });
  setPassive(p, 'wm_arcana', blade && arcanaLv(p) > 0, { atk: 0.03 + 0.006 * arcanaLv(p) });
  setPassive(p, 'wm_mind', blade && skLv(p, 'wm_mind') > 0, { dmg: 0.03 + 0.01 * skLv(p, 'wm_mind') });
});
// 逆转反击：记下被背击的时刻（whenHit 读）；自动格挡：被击时几率格挡 + 霸体 + 上挑反击
SWORD_HOOKS.onHurt.push((p, a, h) => { if (a && hasSkill(p, 'wm_reverse') && Math.sign(a.x - p.x || 1) !== p.face) p._backHitT = game.t; });
SWORD_HOOKS.beforeHurt.push((p, a, h, opt) => {
  const B = p.buffs.wm_autoguard; if (!B || jobOf(p) !== 'blade' || h.grab || h.sure || p.st === 'act' && p.act && p.act.skill === 'wm_autoguard') return null;
  if (Math.random() >= B.chance || (p._agCd || 0) > game.t) return null;
  p._agCd = game.t + 0.5; p.superArmor = Math.max(p.superArmor, 2); fxGuard(p); fxText('自动格挡', p.x, p.y, p.z + 10, { col: '#9fd8ff', size: 11 });
  if (a && !opt.proj && p.st !== 'hit') game.after(0.05, () => { if (p.dead) return; p.face = Math.sign(a.x - p.x) || p.face;
    p.doAct({ name: 'ag_counter', clip: 'up', dur: 0.4, noCounter: true, skill: 'wm_autoguard', hits: [HB(0.05, 0.14, [-10, 80, 32, -20, 140], skillDmg(2.0, 0.2, B.lv), { launch: 480, knock: 60, hs: 0.08, sure: true })],
      events: [slashAt(0.04, { a0: 1.4, a1: -1.9, r: 64, w: 18, off: [10, 50], col: '#bfe8ff' })] }); });
  return { block: true };
});
SWORD_HOOKS.onHit.push((p, t, h, dmg, act) => { if (jobOf(p) === 'blade') wmWeaponFx(p, t, h, act || p.act); });
