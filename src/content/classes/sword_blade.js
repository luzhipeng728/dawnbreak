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
  const dmg = skillDmg(s.dmg, s.dmg * 0.1, lv) * (w === 'lightsaber' ? 0.9 : 1), n2 = w === 'katana' || (w === 'lightsaber' && n <= 2) ? 2 : 1;   // 官方：太刀二刀流 4 动作共 8 hit，光剑共 6 hit
  const a = { name: 'rk' + n, clip: s.clip, dur: light ? 0.32 : w === 'greatsword' ? 0.5 : 0.4, basic: true, rk: true, speed: 'aspd', move: [[0.02, 0.1, s.o.pull ? 40 : 120]],
    follow: last ? null : () => rkStage(lv, p, n + 1), followWin: [0.1, 0.4], chain: last ? null : [0.12, 0.4], next: last ? null : n === 1 ? 'atk2' : 'atk3',
    hits: [HB(0.06, n2 > 1 ? 0.18 : 0.14, s.box, dmg / n2, { hs: 0.06, ...s.o, pull: undefined, ...(n2 > 1 ? { rep: 0.06, max: 2 } : {}) })],
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
defSkill('flow', { name: '流心', cls: 'sword', job: 'blade', lvReq: 16, maxLv: 1, mp: 5, cd: 1, type: 'phys', col: '#3a8ab0', noHitCheck: true,
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
defSkill('flow_leap', { name: '流心：跃', cls: 'sword', job: 'blade', lvReq: 17, mp: 20, cd: 7, type: 'phys', col: '#3a70c0', cmdNote: '流心中 C（腾空时按 X）',
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
defSkill('flow_rise', { name: '流心：升', cls: 'sword', job: 'blade', lvReq: 18, mp: 20, cd: 9, type: 'phys', col: '#5ac0f0', cmdNote: '流心中 Z',
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
  whenHit: true, hitStates: ['hit', 'air'], hitWin: 1, req: p => p._backHitT && game.t - p._backHitT < 1 ? true : '需要被背击',
  act: (lv) => ({ name: 'wm_reverse', clip: 'up', dur: 0.46, noCounter: true, invul: [0, 0.36], links: ['flow'],
    onStart: e => { e.face = -e.face; e._backHitT = 0; e.vx = 0; fxAfterimage(e, '#9fd8ff'); },
    hits: [HB(0.06, 0.16, [-10, 80, 32, -20, 140], skillDmg(3.0, 0.3, lv), { launch: 520, knock: 80, hs: 0.1, shake: 3, big: 1.4, sure: true })],
    events: [slashAt(0.05, { a0: 1.4, a1: -1.9, r: 66, w: 20, off: [10, 50], heavy: true, col: '#bfe8ff' })] }) });

/* ---- 破军升龙击：肩撞前冲（霸体）推开敌人 → 单手上斩浮空（光剑肩撞多 2 段，太刀上斩多 1 段）---- */
defSkill('rise', { name: '破军升龙击', cls: 'sword', job: 'blade', lvReq: 18, mp: 45, cd: 10, type: 'phys', icon: 'rise', col: '#e0602a',
  desc: '霸体肩撞前冲把敌人推开，接着单手上斩把敌人打上高空。光剑肩撞多 2 段；太刀上斩多 1 段。', pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'launch', r: [0, 150], dy: 24 },
  act: (lv, p) => { const w = swWt(p);
    return { name: 'rise', clip: 'rush', dur: 1.0, superArmor: [0, 0.26], noCounter: true, move: [[0, 0.24, 480]],
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

/* ---- 猛龙断空斩：施放时按 ↑↓ 调整突进的斜向角度，化作剑光沿同一方向高速突进 2 段（现版），最后单手上斩浮空。突进中霸体 ---- */
defSkill('dragon', { name: '猛龙断空斩', cls: 'sword', job: 'blade', lvReq: 19, mp: 60, cd: 20, type: 'phys', col: '#2a6ad0',
  desc: '化作一道剑光高速突进斩击 2 次（施放时按住 ↑↓ 可以斜着往纵深突进），最后单手上斩把敌人打上天。突进中霸体。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'gap', r: [0, 240], dy: 60 },
  act: (lv) => ({ name: 'dragon', clip: 'dragon', dur: 1.0, noCounter: true,
    onStart: e => { e.act.seg = -1; },
    update: e => {
      const a = e.act, SEG = 0.3, seg = Math.floor(e.actT / SEG);
      if (seg !== a.seg && seg < 2) {
        a.seg = seg; e.hitsDone.clear();
        if (seg === 0) {   // 方向只在起手时定（←→ 已在施放时转向，↑↓ 斜向），第 2 段沿同一方向继续
          let dx = e.face, dy = e.pad.dy();
          if (e.pad !== input) { const t = nearestFoe(e, 400); if (t) { dx = Math.sign(t.x - e.x) || e.face; dy = Math.sign(t.y - e.y) * (Math.abs(t.y - e.y) > 10 ? 1 : 0); e.face = dx; } }
          const l = Math.hypot(1, dy * 1.3); a.vx = dx / l * 720; a.vy = dy / l * 420; }
        fxAfterimage(e, '#8fb8ff'); sfx.swing(true); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 58, face: e.face, len: 170, w: 14, col: '#8fb8ff', dur: 0.2 });
      }
      if (seg < 2) { const k = (e.actT % SEG) < 0.22; e.superArmor = Math.max(e.superArmor, k ? 0.02 : 0); e.vx = k ? a.vx : a.vx * 0.2; e.vy = k ? a.vy : a.vy * 0.2;
        for (const t of a.drag || []) if (!t.dead && !t.boss && t.weight <= 2 && t.st !== 'down' && t.st !== 'held') { t.x = e.x + e.face * 40; t.y = damp(t.y, e.y, 10, 1 / 60); } }
      else if (!a.fin) { a.fin = true; e.vx = e.face * 60; e.vy = 0; e.play('up', true); fxSlashOn(e, { col: '#8fb8ff', a0: 1.4, a1: -1.9, r: 70, w: 22, off: [10, 50] }); sfx.swing(true);
        instantHit(e, { box: [-10, 84, 32, 0, 130], dmg: skillDmg(2.6, 0.26, lv), launch: 560, knock: 60, hs: 0.1, shake: 4, big: 1.5 }); }
    },
    hits: [HB(0, 0.6, [-20, 60, 30, 10, 100], skillDmg(2.2, 0.22, lv), { rep: 0.3, stun: 0.5, knock: 40, airLift: 200, hs: 0.04, onHit: (a, t) => { const A = a.act; if (A && A.name === 'dragon') (A.drag = A.drag || new Set()).add(t); } })],
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

/* ---- 幻影剑舞：原地连斩（连打技能键 / X 加速，约 5 次到顶），每斩飞出短剑气，最后放出巨大剑气（按住 ↑↓ 斜着往纵深飞；人不动）。霸体 ---- */
defSkill('phantom', { name: '幻影剑舞', cls: 'sword', job: 'blade', lvReq: 20, mp: 80, cd: 45, type: 'phys', col: '#4a50c8',
  desc: '原地舞出幻影般的连斩（太刀 / 光剑斩得更快更多），连打技能键或 X 可以加速（连打约 5 次就到最快），最后向前放出巨大剑气击飞敌人（放出前按住 ↑↓ 让剑气斜着往纵深飞）。全程霸体。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'burst', r: [0, 100], dy: 24 },
  act: (lv, p) => { const fast = ['katana', 'lightsaber'].includes(swWt(p)), step = fast ? 0.06 : 0.1;
    return { name: 'phantom', clip: 'phantom', dur: 2.0, superArmor: true, noCounter: true,
      onStart: e => { e.act.end = 1.3; e.act.rate = 1; },
      onInput: (e, I) => { if (I.buffered('attack') || (e.act.key && I.buffered(e.act.key))) { I.consume('attack'); if (e.act.key) I.consume(e.act.key); e.act.rate = Math.min(1.8, e.act.rate + 0.16); } e.act.aim = I.dy(); return false; },
      update: (e, dt) => {
        const a = e.act; a.dur = a.end + 0.5; a.rate = Math.max(1, a.rate - dt * 0.6);   // 连打加速：斩击间隔按 rate 缩短
        a.tk = (a.tk || 0) + dt * a.rate;
        if (e.actT < a.end && a.tk >= step) { a.tk = 0; a.k = (a.k || 0) + 1; e.hitsDone.clear(); fxSlashOn(e, { col: '#b0c0ff', a0: rnd(-3, 0), a1: rnd(0, 3), r: rnd(50, 72), w: 10, off: [16, rnd(35, 70)], squash: rnd(0.4, 0.9), dur: 0.1, silent: a.k % 2 === 1 });
          if (a.k % 3 === 0) projWave(e, { speed: 480, life: 0.25, h: 50, hit: { dmg: skillDmg(0.15, 0.015, lv), knock: 20, stun: 0.25 } }); }
        if (e.actT >= a.end && !a.fin) { a.fin = true; e.play('atk3', true); sfx.iai(); cam.shake = Math.max(cam.shake, 5);
          projWave(e, { speed: 520, vy: (a.aim || 0) * 190, life: 0.6, hit: { dmg: skillDmg(3.0, 0.3, lv), down: true, downLift: 240, knock: 260, hs: 0.1, big: 1.6, rep: 0 } }); }   // 收尾巨大剑气把敌人吹倒（不浮空）；↑↓ 调纵深角度
      },
      hits: [HB(0, 2.4, [-20, 88, 34, 0, 120], skillDmg(0.3, 0.03, lv) * (fast ? 0.6 : 1), { rep: step, stun: 0.3, knock: 10, airLift: 140, hs: 0.02, snd: 'slash' })],
      onEnd: e => { e.vy = 0; } }; } });

/* ---- 一觉：极·鬼剑术（暴风式）。施放中无敌：抬手放出 8 颗剑魂珠，把范围里的敌人吸起定住 → 珠子炸开化成 24 把剑（一半插在地上、一半悬在空中）→
   本体在剑阵里来回闪身，一把一把拔剑斩击（光剑 → 短剑 → 太刀 → 巨剑 → 钝器轮换），敌人被吸向阵中心；连打技能键 / X 加速（最多约 2 倍）→
   24 把剑拔完后回到起点，上斩收尾引爆剑阵 ---- */
const WM_TEMPEST_COL = ['#fff38a', '#e8f4ff', '#ff9a9a', '#bfe8ff', '#e8d8b8'];   // 光剑、短剑、太刀、巨剑、钝器
const WM_TEMPEST_CLIP = ['rk1', 'rk2', 'dual1', 'rk4', 'dual3'];
defSkill('awaken', { name: '极·鬼剑术（暴风式）', cls: 'sword', job: 'blade', lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'phys', awaken: true, icon: 'awaken', col: '#ffd23a',
  desc: '【觉醒】放出 8 颗剑魂珠把敌人吸起定住，珠子炸开化成 24 把剑组成剑阵；随后在剑阵里来回闪身，一把一把拔剑斩击（光剑、短剑、太刀、巨剑、钝器轮换，连打技能键 / X 加速），敌人被吸向阵中心；拔完 24 把剑后回到起点，上斩引爆剑阵。施放中无敌。',
  pow: lv => skillDmg(22, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv) => ({ name: 'awaken', clip: 'awkB', dur: 3.0, superArmor: true, noCounter: true, invul: [0, 3.0],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '极·鬼剑术', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act;
      a.cx = e.x + e.face * 130; a.cy = e.y; a.x0 = e.x; a.y0 = e.y; a.f0 = e.face; a.rate = 1; a.n = 0; a.swords = []; },
    onInput: (e, I) => { if (I.buffered('attack') || (e.act.key && I.buffered(e.act.key))) { I.consume('attack'); if (e.act.key) I.consume(e.act.key); e.act.rate = Math.min(2, e.act.rate + 0.2); } return false; },
    update: (e, dt) => {
      const a = e.act; if (e.actT < 0.95) return;
      for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.5) < 280 && !(t.boss && hasSA(t))) { t.x = damp(t.x, a.cx, 4, dt); t.y = damp(t.y, a.cy, 4, dt); }
      if (e.actT < 1.25 || a.done) return;
      a.rate = Math.max(1, a.rate - dt * 0.8); a.tk = (a.tk || 0) + dt * a.rate;
      if (a.tk < 0.05) return; a.tk = 0;
      const i = a.n++, s = a.swords[i]; if (!s) return;
      const w = Math.floor(i / 5) % 5, col = WM_TEMPEST_COL[w], side = Math.sign(s.x - a.cx) || 1;   // 每 5 刀换一种武器
      fxAfterimage(e, col); const ox = e.x;
      e.x = a.cx + side * Math.max(50, Math.abs(s.x - a.cx) - 20); e.y = clamp(s.y, 6, DEPTH - 6); e.face = -side; s.taken = true;
      fxStreak({ x: ox, y: e.y, z: e.z + 58, face: Math.sign(e.x - ox) || e.face, len: Math.abs(e.x - ox) + 20, w: 8, col, dur: 0.12 });
      e.play(WM_TEMPEST_CLIP[w], true); fxSlashOn(e, { col, a0: i % 2 ? 1.0 : -2.4, a1: i % 2 ? -2.4 : 1.0, r: rnd(60, 80), w: 16, off: [10, 56], dur: 0.12, silent: i % 2 === 1 });
      fxSlashX(lerp(e.x, a.cx, 0.6), a.cy + rnd(-12, 12), rnd(50, 90), rnd(90, 130), col); if (i % 2 === 0) sfx.swing(false);
      blast(e, a.cx, a.cy, 170, { dmg: skillDmg(0.45, 0.135, lv), airLift: 160, stun: 0.3, knock: 0, hs: 0.02, downHit: true, sure: true, col }, { zMax: 260 });
      if (a.n >= 24) { a.done = true; game.after(0.12, () => wmTempestEnd(e, lv, a)); }
    },
    events: [evAt(0.95, e => { const a = e.act; sfx.charge(); cam.flash = 0.06; cam.flashCol = '#dff4ff';   // 8 颗剑魂珠：吸起并定住敌人
        a.orbs = addFx({ x: a.cx, y: a.cy + 0.5, z: 0, dur: 0.32, draw(c) { const k = this.t / this.dur; for (let j = 0; j < 8; j++) { const g = j * TAU / 8 + k * 2;
          drawSpr(c, fxTint('orb', '#b88aff'), sx(a.cx + Math.cos(g) * 150 * (0.4 + k * 0.6)), sy(a.cy + Math.sin(g) * 50, 60 + k * 60), 36, 0, { alpha: 0.95 }); } } });
        for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.5) < 280) { if (!t.boss) addStatus(t, 'root', 1.4, { src: e }); }
        blast(e, a.cx, a.cy, 240, { dmg: skillDmg(0.8, 0.2, lv), launch: 200, stun: 0.6, knock: 0, hs: 0.04, sure: true, downHit: true, col: '#d8c8ff' }, { zMax: 260 }); }),
      evAt(1.22, e => { const a = e.act; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); fxShock(a.cx, a.cy, 300, '#9fe8ff');   // 珠子炸开 → 24 把剑的剑阵
        for (let j = 0; j < 24; j++) { const air = j % 2 === 1, g = j * TAU / 24 + (air ? 0.13 : 0), r = air ? 120 : 160;
          a.swords.push({ x: a.cx + Math.cos(g) * r, y: clamp(a.cy + Math.sin(g) * r * 0.32, 6, DEPTH - 6), z: air ? 130 + (j % 4) * 14 : 0, rot: air ? 0 : rnd(-0.25, 0.25) }); }
        const L = a.swords.filter(s => s.x < a.cx), R = a.swords.filter(s => s.x >= a.cx); a.swords = []; for (let j = 0; j < 24; j++) {   // 左右交替着拔
          const s = (j % 2 ? L : R).shift() || L.shift() || R.shift(); if (s) a.swords.push(s); }
        for (const s of a.swords) fxBurst(s.x, s.y, s.z + 30, 60, '#bfe8ff');
        a.fx = addFx({ x: a.cx, y: a.cy - 60, z: 0, dur: 1.9, draw(c) { for (const s of a.swords) if (!s.taken) drawSpr(c, 'swordrain', sx(s.x), sy(s.y, s.z), 0, s.z ? 96 : 110, { ay: s.z ? 0.5 : 0.9, rot: s.rot, alpha: 0.9 }); } }); })],
    onEnd: e => { const a = e.act; if (a && a.fx) a.fx.t = a.fx.dur; } }) });
function wmTempestEnd(e, lv, a) {   // 回到起点，上斩引爆剑阵
  if (e.dead || e.act !== a) return;
  fxAfterimage(e, '#ffe070'); e.x = a.x0; e.y = a.y0; e.face = a.f0; e.play('up', true); a.dur = e.actT + 0.55; if (a.fx) a.fx.t = a.fx.dur;
  cam.flash = 0.35; cam.flashCol = '#ffffff'; cam.shake = 12; sfx.iai(); sfx.boom(1.2);
  fxSlashOn(e, { col: '#ffe070', a0: 1.4, a1: -1.9, r: 90, w: 26, off: [10, 50], heavy: true });
  for (const s of a.swords) fxSpr('swordrain', s.x, s.y, s.z, { h: 150, dur: 0.4, ay: 0.9, grow: [1.2, 0.6], col: '#ffe070' });
  fxBurst(a.cx, a.cy, 60, 320, '#bfe8ff'); fxShock(a.cx, a.cy, 280, '#ffffff');
  blast(e, a.cx, a.cy, 240, { dmg: skillDmg(8, 2.5, lv), launch: 520, knock: 200, hs: 0.2, big: 2.2, critBonus: 0.3, downHit: true, sure: true, col: '#ffe070' }, { zMax: 300 });
}

/* =====================================================================
   剑魂 P1（官方 48–100 级 → 本作 21–30 级）：斩铁式、流星落、破空拔刀斩、极·神剑术（二觉被动）、破空斩、瞬斩、
   万剑归宗（二觉）、无形剑意、无形斩、万剑极诣·开天斩（三觉，和暴风式共享冷却）
   ===================================================================== */
const wmShin = p => skLv(p, 'wm_shinken') > 0;   // 二觉被动：继承前辈剑士的技法
defSkill('wm_zantetsu', { name: '极·鬼剑术（斩铁式）', cls: 'sword', job: 'blade', lvReq: 21, mp: 0, cd: 0, type: 'phys', passive: true, col: '#d8e0f0',
  desc: '【被动 · 一觉】斩断钢铁的剑意：技能攻击力提高。', infoExtra: lv => [['技能攻击力', '+' + pct(0.05 + 0.01 * lv)]] });
defSkill('wm_shinken', { name: '极·神剑术', cls: 'sword', job: 'blade', lvReq: 26, maxLv: 1, mp: 0, cd: 0, type: 'phys', passive: true, col: '#ffe8a0',
  desc: '【被动 · 二觉】继承前辈剑士的技法：流心系列获得霸体，流心：狂之后刺 / 跃 / 升可以直接互接（X / C / Z）；后跳斩放出剑气；破军升龙击的收尾追加暴风式冲击波；猛龙断空斩的收尾卷起飓风；幻影剑舞的最后追加幻影斩；流星落最后多投 3 把定身的天剑；破空斩追加以最强敌人为中心的极限之十字刃。' });
defSkill('wm_formless', { name: '无形剑意', cls: 'sword', job: 'blade', lvReq: 29, mp: 0, cd: 0, type: 'phys', passive: true, col: '#e0f0ff',
  desc: '【被动 · 三觉】技能攻击力提高；流心：刺 / 跃 / 升命中后按武器追加无形剑斩击（短剑：刺、跃；太刀：跃、升；钝器：刺、跃；巨剑：刺、升；光剑：跃、升）。', infoExtra: lv => [['技能攻击力', '+' + pct(0.06 + 0.012 * lv)]] });
const WM_FORMLESS = { shortsword: ['flow_stab', 'flow_leap'], katana: ['flow_leap', 'flow_rise'], club: ['flow_stab', 'flow_leap'], greatsword: ['flow_stab', 'flow_rise'], lightsaber: ['flow_leap', 'flow_rise'] };
function wmFormlessHit(e, lv) { const x = e.x + e.face * 60; fxSpr('swordrain', x, e.y, 90, { h: 120, dur: 0.3, col: '#e8f4ff', rot: -0.6 * e.face, alpha: 0.7 }); fxSlashX(x, e.y, 60, 120, '#e8f4ff');
  blast(e, x, e.y, 70, { dmg: skillDmg(1.4, 0.2, lv), stun: 0.4, knock: 60, hs: 0.05, col: '#e8f4ff', sure: true }, { zMax: 200 }); }

/* ---- 流星落：带冲击波高高跃起，在空中按 ←→ 把落点在左 / 中 / 右三档之间切换，约 38 把流星剑落向落点，最后自己砸下 ---- */
defSkill('wm_meteor', { name: '极·神剑术（流星落）', cls: 'sword', job: 'blade', lvReq: 23, mp: 80, cd: 35, type: 'phys', col: '#9fd0ff',
  desc: '带着冲击波高高跃起，在空中按 ←→ 把落点在左 / 中 / 右三档之间切换，约 38 把流星剑接连落向落点，最后自己挥剑砸下。跃起期间无敌。学了极·神剑术，最后再投下 3 把定住敌人的天剑。', pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'aoe', r: [60, 260], dy: 60 },
  act: (lv) => ({ name: 'wm_meteor', clip: 'meteorAim', dur: 2.4, superArmor: true, noCounter: true, invul: [0, 1.6],
    onStart: e => { const a = e.act, c = e.x + e.face * 90; a.slots = [c - 230, c, c + 230]; a.si = 1; a.rx = c; a.ry = e.y; e.vz = 760; e.z = Math.max(e.z, 1); sfx.jump(); fxShock(e.x, e.y, 130, '#9fd0ff');
      blast(e, e.x, e.y, 100, { dmg: skillDmg(1.2, 0.12, lv), launch: 300, knock: 60, hs: 0.05 }, { zMax: 80 });
      addFx({ x: a.rx, y: a.ry, z: 0, dur: 1.7, a, update() { this.x = this.a.rx; this.y = this.a.ry - 0.5; }, draw(c) { const A = this.a;   // 三档落点：选中的一档是亮的准星
        for (const x of A.slots) drawSpr(c, fxTint('rune', '#9fd0ff'), sx(x), sy(A.ry, 0), 110, 40, { ground: true, rot: -game.t, alpha: 0.18 });
        drawSpr(c, fxTint('rune', '#9fd0ff'), sx(A.rx), sy(A.ry, 0), 150, 56, { ground: true, rot: game.t * 2, alpha: 0.75 }); } }); },
    onInput: (e, I) => { const a = e.act, d = Math.sign(I.dx()); if (e.actT < 1.5 && d !== a.lastD) { a.lastD = d; if (d) a.si = clamp(a.si + d, 0, 2); } return false; },   // 按一下 ←→ 换一档
    update: (e, dt) => { const a = e.act;
      if (e.actT > 0.35 && e.actT < 1.5) { e.vz = 0; e.vx = 0; }
      if (e.pad !== input && e.actT < 1.5) { const t = nearestFoe(e, 500); if (t) { a.si = [0, 1, 2].reduce((b, i) => Math.abs(a.slots[i] - t.x) < Math.abs(a.slots[b] - t.x) ? i : b, 1); a.ry = damp(a.ry, t.y, 4, dt); } }
      if (e.actT < 1.5) a.rx = damp(a.rx, a.slots[a.si], 12, dt);
      a.tk = (a.tk || 0) + dt;
      if (e.actT > 0.35 && e.actT < 1.5 && a.tk >= 0.03) { a.tk = 0; a.n = (a.n || 0) + 1; const x = a.rx + rnd(-80, 80), y = clamp(a.ry + rnd(-26, 26), 6, DEPTH - 6), n = a.n;
        addFx({ x, y: y + 0.5, z: 320, dur: 0.22, vz: -1500, update(d) { this.z = Math.max(0, this.z + this.vz * d); }, draw(c) { drawSpr(c, 'swordrain', sx(this.x), sy(this.y, this.z), 0, 90, { ay: 1, alpha: 0.9 }); } });
        game.after(0.2, () => { if (e.dead) return; fxDust(x, y, 2, 8, '#cfe6ff'); blast(e, x, y, 44, { dmg: skillDmg(0.22, 0.022, lv), stun: 0.3, knock: 10, airLift: 120, hs: 0.02, sure: true, downHit: true }, { zMax: 160 }); if (n % 4 === 0) sfx.hit('slash', false); }); }
      if (e.actT >= 1.5 && !a.dive) { a.dive = true; e.vz = -1500; e.vx = clamp((a.rx - e.x) * 4, -900, 900); e.vy = clamp((a.ry - e.y) * 4, -400, 400); e.play('silver', true); sfx.swing(true);
        if (wmShin(e)) for (let i = 0; i < 3; i++) game.after(0.08 * i, () => { const x = a.rx + (i - 1) * 60; fxSpr('swordrain', x, a.ry, 0, { h: 180, dur: 0.6, ay: 1, col: '#ffe8a0', grow: [1.3, 1] });
          blast(e, x, a.ry, 60, { dmg: skillDmg(1.0, 0.1, lv), stun: 0.6, knock: 0, hs: 0.05, sure: true, col: '#ffe8a0', onHit: (x2, t) => addStatus(t, 'root', 1.25, { src: x2 }) }, { zMax: 200 }); }); } },
    onLand: e => { const a = e.act; if (!a.dive) return; a.onLand = null; e.vx = e.vy = 0; a.dur = e.actT + 0.4; e.play('silverLand', true); cam.shake = Math.max(cam.shake, 10); sfx.boom(1.2);
      fxShock(e.x, e.y, 220, '#9fd0ff'); fxBurst(e.x, e.y, 30, 220, '#cfe6ff');
      blast(e, e.x, e.y, 140, { dmg: skillDmg(4.0, 0.4, lv), launch: 460, knock: 120, hs: 0.12, big: 1.8, sure: true, downHit: true }, { zMax: 200 }); } }) });

/* ---- 破空拔刀斩：按住蓄力；大范围拔刀斩，同时向前射出圆形剑气（约 850 像素），被拔刀斩中的敌人不再吃剑气 ---- */
defSkill('wm_kuubatto', { name: '破空拔刀斩', cls: 'sword', job: 'blade', lvReq: 25, mp: 90, cd: 50, type: 'phys', col: '#ffd070',
  desc: '收刀蓄势（按住技能键可以蓄力），瞬间拔刀，斩出以自身为中心的大范围剑光，同时向前射出一道圆形剑气（约 850 像素）。被拔刀斩中的敌人不会再被剑气打到。蓄势期间霸体。', pow: lv => skillDmg(14, 1.4, lv), ai: { kind: 'burst', r: [0, 600], dy: 40 },
  act: (lv) => ({ name: 'wm_kuubatto', clip: 'iai', dur: 1.0, superArmor: true, noCounter: true,
    charge: { at: 0.3, max: 0.8, min: 0, dmg: 0.5, update: (e, dt, k) => { if (Math.random() < 0.5) fxCharge(e, '#ffd070'); e.drawOpts = { glow: 0.3 + k * 0.7 }; } },
    onEnd: e => { e.drawOpts = {}; },
    events: [evAt(0.02, () => sfx.charge()), evAt(0.4, e => { cam.flash = 0.15; cam.flashCol = '#fff6d0'; cam.shake = 9; sfx.iai(); sfx.boom(0.8);
      fxSlashOn(e, { col: '#ffd070', a0: -3.1, a1: 3.1, r: 130, w: 34, off: [0, 50], squash: 0.45, dur: 0.3 }); fxShock(e.x, e.y, 200, '#ffd070');
      const hit = new Set(); for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - e.x, (t.y - e.y) * 1.8) < 170) { hit.add(t.id); applyHit(e, t, { dmg: skillDmg(8, 0.8, lv), knock: 200, down: true, radial: true, hs: 0.14, big: 1.8, col: '#ffe0a0', downHit: true }, {}); }
      const w = swWt(e), col = w === 'lightsaber' ? '#fff38a' : '#ffd070';
      const pr = spawnProj({ owner: e, x: e.x + e.face * 60, y: e.y, z: 20, vx: e.face * 620, face: e.face, life: 1.37, w: 50, d: 40, h: 150, pierce: true,
        hit: { dmg: skillDmg(6, 0.6, lv), knock: 160, launch: 260, hs: 0.1, big: 1.6, col },
        onHitT: (q, t) => { if (w === 'katana' && arcanaLv(e)) wmPierce(e, t); else if (w === 'lightsaber') addStatus(t, 'shock', 2, { src: e }); },
        draw(c, q) { const k = q.t / q.life, al = k > 0.85 ? (1 - k) / 0.15 : 1; drawSpr(c, fxTint('slash', col), sx(q.x), sy(q.y, q.z + 60), 170, 0, { rot: q.t * 16 * q.face, alpha: al }); drawSpr(c, fxTint('shock', col), sx(q.x), sy(q.y, 0), 150, 0, { alpha: 0.5 * al }); } });
      for (const id of hit) pr.hitMap.set(id, 0);   // 被拔刀斩中的敌人不再吃剑气
    })] }) });

/* ---- 破空斩：进入预备架势（无敌），感知前方的敌人并标记（按住技能键可以延后出手），然后瞬斩所有被标记的敌人并引爆 ---- */
function wmHakuuMark(e) { const a = e.act; a.marks = a.marks || new Set(); for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -20 && Math.abs(t.x - e.x) < 380 && Math.abs(t.y - e.y) < 70 && !a.marks.has(t)) { a.marks.add(t); fxSpr('rune', t.x, t.y, t.z + t.h * 0.6, { w: 40, dur: 0.4, col: '#bfe8ff' }); } }
defSkill('wm_hakuu', { name: '极·神剑术（破空斩）', cls: 'sword', job: 'blade', lvReq: 26, mp: 100, cd: 40, type: 'phys', col: '#bfe8ff',
  desc: '进入预备架势（无敌），感知前方一片区域里的敌人并标记（按住技能键可以延后出手），随即瞬斩所有被标记的敌人，片刻后一起爆炸。学了极·神剑术，最后追加以最强敌人为中心的极限之十字刃。', pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'burst', r: [0, 380], dy: 50 },
  act: (lv) => ({ name: 'wm_hakuu', clip: 'hakuu', dur: 1.3, noCounter: true, invul: true,
    charge: { at: 0.15, max: 1.0, min: 0.2, dmg: 0, update: e => wmHakuuMark(e) },
    events: [evAt(0.02, () => sfx.charge()), evAt(0.2, e => { wmHakuuMark(e); const L = [...e.act.marks].filter(t => !t.dead);
      e.play('iaiSpin', true); cam.flash = 0.12; cam.flashCol = '#eaf6ff'; sfx.iai(); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 380, w: 22, col: '#bfe8ff', dur: 0.3 });
      L.forEach((t, i) => game.after(i * 0.04, () => { if (t.dead) return; fxSlashX(t.x, t.y, t.z + 50, 140, '#bfe8ff'); applyHit(e, t, { dmg: skillDmg(9, 0.9, lv), stun: 1.0, knock: 20, hs: 0.08, sure: true, col: '#dff0ff' }, { proj: true }); }));
      game.after(0.45, () => { if (e.dead) return; cam.shake = Math.max(cam.shake, 10); sfx.boom(1.1);
        for (const t of L) if (!t.dead) { fxBurst(t.x, t.y, t.z + 40, 140, '#bfe8ff'); applyHit(e, t, { dmg: skillDmg(7, 0.7, lv), launch: 380, knock: 80, hs: 0.1, sure: true, big: 1.6, downHit: true }, { proj: true }); }
        if (wmShin(e) && L.length) { const val = t => (t.boss ? 2e12 : t.elite ? 1e12 : 0) + t.hp, c = L.reduce((b, t) => val(t) > val(b) ? t : b, L[0]);
          fxSpr('crossx', c.x, c.y, 60, { w: 260, dur: 0.6, grow: [0.5, 1.1], col: '#ffe8a0' });
          blast(e, c.x, c.y, 160, { dmg: skillDmg(6, 0.6, lv), launch: 420, knock: 120, hs: 0.12, sure: true, big: 1.8, col: '#ffe8a0', downHit: true }, { zMax: 260 }); } }); })] }) });

/* ---- 瞬斩：拔出专用飞剑向前冲斩（无敌），被斩中的敌人再吃 5 段剑气 ---- */
defSkill('wm_shunzan', { name: '极·神剑术（瞬斩）', cls: 'sword', job: 'blade', lvReq: 26, mp: 90, cd: 40, type: 'phys', col: '#8fe0ff',
  desc: '拔出专用的飞剑向前冲斩（无敌），被斩中的敌人随后再受到 5 段剑气追击。', pow: lv => skillDmg(15, 1.5, lv), ai: { kind: 'gap', r: [0, 320], dy: 30 },
  act: (lv) => ({ name: 'wm_shunzan', clip: 'dragon', dur: 0.95, noCounter: true, invul: [0, 0.95], move: [[0.08, 0.26, 1300]],
    onStart: e => { e.act.victims = []; sfx.charge(); },
    hits: [HB(0.08, 0.28, [-30, 70, 34, 0, 130], skillDmg(6, 0.6, lv), { stun: 1.0, knock: 10, hs: 0.06, col: '#bfe8ff', onHit: (a, t) => { if (a.act && a.act.victims) a.act.victims.push(t); } })],
    events: [evAt(0.08, e => { fxAfterimage(e, '#8fe0ff'); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 380, w: 20, col: '#8fe0ff', dur: 0.3 }); sfx.iai(); }),
      ...[0.38, 0.46, 0.54, 0.62, 0.7].map((tt, i) => evAt(tt, e => { for (const t of e.act.victims || []) if (!t.dead) { fxSlashX(t.x + rnd(-10, 10), t.y, t.z + 50, 110, '#8fe0ff'); applyHit(e, t, { dmg: skillDmg(1.8, 0.18, lv), stun: 0.6, knock: i === 4 ? 180 : 10, launch: i === 4 ? 300 : 0, hs: 0.04, sure: true, col: '#bfe8ff' }, { proj: true }); } if (i % 2 === 0) sfx.swing(false); }))] }) });

/* ---- 万剑归宗（二觉）：召唤 5 把念力飞剑约 40 秒（期间普攻 / 跳攻 / 跑攻和部分技能命中时射出穿云刺）；再按一次或时间到 → 御剑术：飞剑按领主 > 精英 > 高 HP 抓住目标乱斩 → 万剑诀爆炸 ---- */
defSummon('wm_swords', { kind: 'attach', host: 'owner', tags: ['sword'], max: 1, over: 'refresh', life: 40,
  onEnd: (s, why) => { if (why === 'life' && !s.owner.dead) wmSwordFinale(s.owner, s.lv); },
  draw: (c, s) => { const p = s.host, T = game.t; for (let i = 0; i < 5; i++) { const a = T * 1.6 + i * TAU / 5; drawSpr(c, 'swordrain', sx(p.x - p.face * 20 + Math.cos(a) * 34), sy(p.y + Math.sin(a) * 8, p.z + 90 + Math.sin(a * 2) * 6), 0, 38, { alpha: 0.75, rot: 0.3 * Math.cos(a) }); } } });
const WM_THRUST = new Set(['triple', 'dragon', 'flow_stab', 'flow_leap', 'flow_rise', 'phantom', 'wm_hakuu', 'wm_dragonrush']);
function wmSwordFinale(e, lv) {   // 御剑术 → 万剑诀
  const val = t => (t.boss ? 2e12 : t.elite ? 1e12 : 0) + t.hp;
  const L = ents.filter(t => hittable(e, t) && Math.abs(t.x - e.x) < 700).sort((a, b) => val(b) - val(a)).slice(0, 6);
  sfx.charge(); cam.flash = 0.15; cam.flashCol = '#dff4ff';
  L.forEach((t, j) => { addStatus(t, 'root', 1.6, { src: e });
    for (let i = 0; i < 8; i++) game.after(0.1 + i * 0.1 + j * 0.02, () => { if (t.dead) return; fxSpr('swordrain', t.x + rnd(-40, 40), t.y, t.z + 140, { h: 110, dur: 0.25, rot: rnd(-2.6, 2.6), alpha: 0.9 }); fxSlashX(t.x, t.y, t.z + 50, 90, '#bfe8ff');
      applyHit(e, t, { dmg: skillDmg(1.6, 0.4, lv), stun: 0.5, knock: 0, hs: 0.03, sure: true, col: '#dff0ff' }, { proj: true }); if (i % 2) sfx.hit('slash', false); }); });
  game.after(1.05, () => { if (e.dead) return; cam.shake = 14; cam.flash = 0.3; cam.flashCol = '#ffffff'; sfx.boom(1.4); sfx.iai();
    for (let i = 0; i < 12; i++) fxSpr('swordrain', e.x + e.face * (60 + i * 60), e.y + rnd(-30, 30), 0, { h: 160, dur: 0.5, ay: 1, grow: [1.3, 1] });
    for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -100 && Math.abs(t.x - e.x) < 820) applyHit(e, t, { dmg: skillDmg(10, 3, lv), launch: 520, knock: 200, hs: 0.2, big: 2.2, critBonus: 0.2, sure: true, downHit: true, col: '#ffe070' }, { proj: true }); });
}
defSkill('wm_awaken2', { name: '万剑归宗', cls: 'sword', job: 'blade', lvReq: 27, maxLv: 3, mp: 180, cd: 170, pvp: 0.45, type: 'phys', awaken: true, noHitCheck: true, col: '#bfe8ff',
  desc: '【二觉】召唤 5 把念力飞剑约 40 秒：期间普攻、跳攻、跑攻以及三段刃、猛龙、流心、剑舞、破空斩、破军斩龙击命中时，飞剑射出穿云刺追击。再按一次技能键（或时间到）→ 御剑术：飞剑按领主 > 精英 > 高 HP 的顺序抓住目标乱斩，最后万剑诀爆炸横扫前方。',
  pow: lv => skillDmg(30, 9, lv), ai: { kind: 'awaken', r: [0, 400], dy: 90 },
  recast: { ok: p => summonsOf(p, 'wm_swords').length > 0, cd: 0.5, act: lv => ({ name: 'wm_swordsend', clip: 'awkB', dur: 1.4, superArmor: true, noCounter: true, invul: [0, 1.4],
    onStart: e => { const s = summonsOf(e, 'wm_swords')[0], L = s ? s.lv : lv; dismissSummons(e, 'wm_swords', 'cmd'); wmSwordFinale(e, L); } }) },
  act: (lv) => ({ name: 'wm_awaken2', clip: 'awkB', dur: 1.2, superArmor: true, noCounter: true, invul: [0, 1.2],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '万剑归宗', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.95, e => { summon(e, 'wm_swords', { lv }); fxBurst(e.x, e.y, e.z + 90, 200, '#bfe8ff'); for (let i = 0; i < 16; i++) fxSpr('swordrain', e.x + rnd(-120, 120), e.y + rnd(-30, 30), rnd(40, 200), { h: 70, dur: 0.5, rot: rnd(-3, 3), alpha: 0.8 }); })] }) });
SWORD_HOOKS.onHit.push((p, t, h, dmg, act) => {
  if (h.wmThrust || jobOf(p) !== 'blade' || !act || t.dead) return;
  const S = summonsOf(p, 'wm_swords')[0]; if (!S || !(act.basic || WM_THRUST.has(act.skill)) || (p._wmThrustT || 0) > game.t) return;
  p._wmThrustT = game.t + 0.18; const x0 = p.x - p.face * 30, z0 = p.z + 110;
  spawnProj({ owner: p, x: x0, y: t.y, z: z0, vx: (t.x - x0) * 4, vz: (t.z + 50 - z0) * 4, face: Math.sign(t.x - x0) || p.face, life: 0.3, w: 14, d: 16, h: 30, pierce: false,
    hit: { dmg: skillDmg(0.8, 0.25, S.lv), stun: 0.2, knock: 10, hs: 0.02, col: '#bfe8ff', wmThrust: true },
    draw(c, q) { drawSpr(c, 'swordrain', sx(q.x), sy(q.y, q.z), 0, 60, { rot: Math.atan2(q.vx, -q.vz), alpha: 0.9 }); } });
});

/* ---- 无形斩：强力拔刀，射出看不见的无形剑，在前方区域连续斩击后爆炸；被斩中的敌人离开区域也会被追斩 ---- */
defSkill('wm_mukei', { name: '极·神剑术（无形斩）', cls: 'sword', job: 'blade', lvReq: 29, mp: 120, cd: 60, type: 'phys', col: '#e8f4ff',
  desc: '强力拔刀，射出看不见的无形剑：前方区域里的敌人被连续斩击，最后一起爆炸；被斩中过的敌人即使离开区域也会被追斩。', pow: lv => skillDmg(22, 2.2, lv), ai: { kind: 'burst', r: [60, 300], dy: 50 },
  act: (lv) => ({ name: 'wm_mukei', clip: 'iai', dur: 1.9, superArmor: true, noCounter: true,
    events: [evAt(0.02, () => sfx.charge()), evAt(0.4, e => { const a = e.act; a.cx = e.x + e.face * 180; a.cy = e.y; a.vic = new Set(); sfx.iai(); cam.shake = Math.max(cam.shake, 6);
        fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 200, w: 18, col: '#e8f4ff', dur: 0.2 }); fxShock(a.cx, a.cy, 180, '#e8f4ff'); }),
      ...Array.from({ length: 10 }, (_, i) => evAt(0.5 + i * 0.1, e => { const a = e.act; for (const t of ents) if (hittable(e, t) && (a.vic.has(t) || Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.6) < 150)) { a.vic.add(t);
        fxSlashX(t.x + rnd(-20, 20), t.y, t.z + 50, rnd(80, 120), '#e8f4ff'); applyHit(e, t, { dmg: skillDmg(1.3, 0.13, lv), stun: 0.5, knock: 0, hs: 0.02, sure: true, col: '#f0f8ff' }, { proj: true }); } if (i % 2) sfx.swing(false); })),
      evAt(1.6, e => { const a = e.act; cam.flash = 0.2; cam.flashCol = '#ffffff'; cam.shake = 10; sfx.boom(1.2); fxBurst(a.cx, a.cy, 50, 260, '#e8f4ff');
        for (const t of a.vic) if (!t.dead) applyHit(e, t, { dmg: skillDmg(9, 0.9, lv), launch: 460, knock: 160, hs: 0.14, big: 1.8, sure: true, downHit: true, col: '#ffffff' }, { proj: true }); })] }) });

/* ---- 万剑极诣·开天斩（三觉）：钝器砸地 → 巨剑重斩 → 跃起放短剑 / 太刀剑气 → 落地多段斩 → 光剑终结大爆炸。无敌；和暴风式共享冷却 ---- */
defSkill('wm_awaken3', { name: '万剑极诣·开天斩', cls: 'sword', job: 'blade', lvReq: 30, maxLv: 3, mp: 250, cd: 135, pvp: 0.45, type: 'phys', awaken: true, col: '#fff0a0',
  desc: '【三觉】无形剑依次化为五种武器：钝器砸地 → 巨剑重斩（大地碎裂）→ 跃起用短剑、太刀放出剑气 → 落地多段斩 → 凝聚成光剑的终结一击大爆炸。施放中无敌。与极·鬼剑术（暴风式）共享冷却；万剑归宗的飞剑还在时施放，会代替御剑术作为收尾。',
  pow: lv => skillDmg(45, 12, lv), ai: { kind: 'awaken', r: [0, 360], dy: 90 },
  act: (lv) => ({ name: 'wm_awaken3', clip: 'awkB', dur: 3.6, superArmor: true, noCounter: true, invul: [0, 3.6],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '万剑极诣·开天斩', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); e.cool.awaken = Math.max(e.cool.awaken || 0, e.cool.wm_awaken3 || 0); e.act.cx = e.x + e.face * 150; e.act.cy = e.y; },
    events: [
      evAt(1.0, e => { const a = e.act; e.play('a3slam', true); cam.shake = 10; sfx.boom(1.1); fxShock(a.cx, a.cy, 200, '#c8b090'); fxDust(a.cx, a.cy, 14, 40, '#8a7a6a');   // 钝器
        blast(e, a.cx, a.cy, 170, { dmg: skillDmg(6, 1.6, lv), stun: 1.0, launch: 240, knock: 20, hs: 0.1, sure: true, downHit: true, col: '#e8d8b8' }, { zMax: 200 }); }),
      evAt(1.4, e => { const a = e.act; e.play('rk4', true); cam.shake = 12; sfx.iai(); sfx.boom(1.2); fxSlashOn(e, { col: '#cfe6ff', a0: -2.9, a1: 1.3, r: 150, w: 40, off: [20, 70], heavy: true, dur: 0.3 });   // 巨剑
        for (let i = 0; i < 5; i++) fxSpr('lava', a.cx + rnd(-120, 120), a.cy + rnd(-20, 20), 0, { w: 110, dur: 0.5, ay: 0.85, col: '#b8c8e0' });
        blast(e, a.cx, a.cy, 190, { dmg: skillDmg(8, 2, lv), launch: 420, knock: 40, hs: 0.14, sure: true, big: 1.8, downHit: true }, { zMax: 260 }); }),
      evAt(1.8, e => { e.vz = 620; e.z = Math.max(e.z, 1); e.play('meteorAim', true); sfx.jump(); }),   // 跃起：短剑 / 太刀剑气
      ...[1.95, 2.05, 2.15, 2.25].map((t, i) => evAt(t, e => { const a = e.act, x = a.cx + rnd(-80, 80); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: Math.sign(x - e.x) || e.face, len: Math.abs(x - e.x) + 60, w: 12, col: i % 2 ? '#9fe6ff' : '#ffb0b0', dur: 0.18 }); sfx.swing(true);
        blast(e, x, a.cy, 90, { dmg: skillDmg(2.5, 0.6, lv), stun: 0.5, airLift: 260, knock: 10, hs: 0.05, sure: true, col: i % 2 ? '#bfefff' : '#ffc0c0' }, { zMax: 320 }); })),
      evAt(2.45, e => { const a = e.act; e.vz = -1500; e.x = a.cx - e.face * 40; }),
      ...[2.55, 2.63, 2.71, 2.79, 2.87].map(t => evAt(t, e => { const a = e.act; fxSlashX(a.cx + rnd(-60, 60), a.cy + rnd(-16, 16), rnd(40, 120), rnd(120, 180), '#dff0ff'); sfx.swing(false);   // 落地多段斩
        blast(e, a.cx, a.cy, 160, { dmg: skillDmg(1.6, 0.4, lv), stun: 0.5, airLift: 200, knock: 0, hs: 0.03, sure: true, downHit: true }, { zMax: 320 }); })),
      evAt(3.05, e => { const a = e.act; e.play('iaiSpin', true); cam.flash = 0.4; cam.flashCol = '#fff6c0'; cam.shake = 16; sfx.iai(); sfx.boom(1.5);   // 光剑终结
        fxSpr('swordrain', a.cx, a.cy, 0, { h: 360, dur: 0.6, ay: 1, col: '#fff38a', grow: [0.4, 1.1] }); fxBurst(a.cx, a.cy, 60, 360, '#fff38a'); fxShock(a.cx, a.cy, 340, '#ffffff');
        blast(e, a.cx, a.cy, 280, { dmg: skillDmg(18, 5, lv), launch: 560, knock: 200, hs: 0.22, big: 2.4, critBonus: 0.3, sure: true, downHit: true, elem: 'light', col: '#fff38a' }, { zMax: 360 }); })] }) });
// 万剑归宗的飞剑还在时放三觉：开天斩代替御剑术 / 万剑诀收尾，飞剑被收走（官方）
swordAwk3Finish('wm_awaken3', p => summonsOf(p, 'wm_swords').length > 0, e => dismissSummons(e, 'wm_swords', 'cmd'));
{ // 暴风式与开天斩共享冷却
  const A = SKILLS.awaken, a0 = A.act; A.act = (lv, p) => { const a = a0(lv, p); if (p && p.cool) p.cool.wm_awaken3 = Math.max(p.cool.wm_awaken3 || 0, p.cool.awaken || 0); return a; };
}
// 二觉被动（极·神剑术）对已有技能的强化、三觉被动（无形剑意）的追加斩：包在技能 act 外面
{
  const wrap = (id, f) => { const S = SKILLS[id], a0 = S.act; S.act = (lv, p) => { const a = a0(lv, p); return p && jobOf(p) === 'blade' ? f(a, lv, p) || a : a; }; };
  for (const id of ['flow_stab', 'flow_leap', 'flow_rise']) wrap(id, (a, lv, p) => {
    if (wmShin(p)) { a.superArmor = true; if (p.buffs.flow_frenzy) { a.keyLinks = { attack: 'flow_stab', jump: 'flow_leap', cmd: 'flow_rise' }; a.linkFrom = 0.18; } }
    const fl = skLv(p, 'wm_formless'); if (fl && (WM_FORMLESS[swWt(p)] || []).includes(id)) (a.events = a.events || []).push(evAt(0.3, e => wmFormlessHit(e, fl)));
  });
  { const f0 = flowStance; flowStance = () => { const a = f0(); const s0 = a.onStart; a.onStart = e => { if (jobOf(e) === 'blade' && wmShin(e)) e.act.superArmor = true; s0(e); }; return a; }; }
  wrap('backslash', (a, lv, p) => { if (wmShin(p)) a.events.push(evAt(0.14, e => projWave(e, { speed: 560, life: 0.4, h: 90, hit: { dmg: skillDmg(1.5, 0.15, lv), knock: 120, stun: 0.4, downHit: true } }))); });
  wrap('rise', (a, lv, p) => { if (wmShin(p)) (a.events = a.events || []).push(evAt(0.7, e => { fxShock(e.x, e.y, 160, '#ffe070'); fxSpr('tornado', e.x + e.face * 40, e.y, 0, { h: 150, dur: 0.4, ay: 1, col: '#ffd070' });
    blast(e, e.x + e.face * 40, e.y, 110, { dmg: skillDmg(2.5, 0.25, lv), launch: 360, knock: 80, hs: 0.08, sure: true }, { zMax: 260 }); })); });
  wrap('dragon', (a, lv, p) => { if (wmShin(p)) (a.events = a.events || []).push(evAt(0.66, e => { const x = e.x + e.face * 60; fxSpr('tornado', x, e.y, 0, { h: 190, dur: 0.6, ay: 1, col: '#9fc8ff', spin: 4 });
    for (const t of ents) if (hittable(e, t) && !t.boss && Math.abs(t.x - x) < 160 && Math.abs(t.y - e.y) < 60) t.x = lerp(t.x, x, 0.6);
    blast(e, x, e.y, 110, { dmg: skillDmg(3, 0.3, lv), launch: 420, knock: 20, hs: 0.08, sure: true }, { zMax: 300 }); })); });
  wrap('phantom', (a, lv, p) => { if (wmShin(p)) { const u0 = a.update; a.update = (e, dt) => { u0(e, dt); const A = e.act; if (A.fin && !A.shinDone) { A.shinDone = true;
    for (let i = 0; i < 6; i++) game.after(0.06 * i, () => { const x = e.x + e.face * (60 + i * 30); fxSlashX(x, e.y, 60, 130, '#c0c8ff'); blast(e, x, e.y, 60, { dmg: skillDmg(0.8, 0.08, lv), stun: 0.4, knock: 20, hs: 0.03, sure: true }, { zMax: 200 }); }); } }; } });
}

CLASSES.sword.jobs.blade = { art: 'job/blade', name: '剑魂', role: '近战 · 连击', armor: 'light', awaken: 'awaken', awakenName: '剑圣',
  desc: '专精剑术的鬼剑士，能驾驭所有武器。里·鬼剑术随武器变化，流心架势派生刺 / 跃 / 升 / 狂，拔刀斩、猛龙断空斩、幻影剑舞打出华丽的连招。',
  skills: ['wm_saber', 'wm_arcana', 'rikiken', 'backslash', 'wm_mind', 'flow', 'flow_stab', 'flow_leap', 'flow_rise', 'flow_frenzy', 'wm_autoguard', 'wm_edge', 'wm_reverse', 'rise', 'iai', 'dragon', 'wm_dragonrush', 'phantom', 'awaken', 'wm_zantetsu', 'wm_meteor', 'wm_kuubatto', 'wm_shinken', 'wm_hakuu', 'wm_shunzan', 'wm_awaken2', 'wm_formless', 'wm_mukei', 'wm_awaken3'] };
CLASSES.sword.cmds.push(['du', 'wm_autoguard', 'buff'], ['ff', 'wm_edge', 'buff'], ['hit', 'wm_reverse'], ['bff', 'rise'], ['bdf', 'iai'], ['uff', 'dragon'], ['fbdf', 'wm_dragonrush'], ['fdf', 'phantom'], ['uudd', 'awaken'],
  ['dff', 'wm_meteor'], ['fbuf', 'wm_kuubatto'], ['fbf', 'wm_hakuu'], ['duf', 'wm_shunzan'], ['duff', 'wm_awaken2'], ['udff', 'wm_mukei'], ['bufd', 'wm_awaken3']);
// 流心可以取消：普攻（强制，天然可以）、里·鬼剑术（算普攻）、三段刃、逆转反击
SKILLS.triple.links = ['flow'];
// 武器精通阈值（SKILLS_OFFICIAL_sword.md 3.2）：太刀 / 光剑 5 级 → 三段刃 +2 斩（共 7 段）
{ const tn0 = tripleN; tripleN = p => p && jobOf(p) === 'blade' && ['katana', 'lightsaber'].includes(swWt(p)) && skLv(p, 'wm_arcana') >= 5 ? TRIPLE_N + 2 : tn0(p); }
// 剑魂被动：光剑掌握（攻速）、武器奥义（攻击力）、无我剑气（技能伤害）
CLASSES.sword.passives.push(p => {
  const blade = jobOf(p) === 'blade', saber = blade && skLv(p, 'wm_saber') && swWt(p) === 'lightsaber';
  setPassive(p, 'wm_saber', !!saber, { aspd: 0.02 + 0.004 * skLv(p, 'wm_saber') });
  setPassive(p, 'wm_arcana', blade && arcanaLv(p) > 0, { atk: 0.03 + 0.006 * arcanaLv(p) });
  setPassive(p, 'wm_mind', blade && skLv(p, 'wm_mind') > 0, { dmg: 0.03 + 0.01 * skLv(p, 'wm_mind') });
  setPassive(p, 'wm_zantetsu', blade && skLv(p, 'wm_zantetsu') > 0, { dmg: 0.05 + 0.01 * skLv(p, 'wm_zantetsu') });
  setPassive(p, 'wm_formless', blade && skLv(p, 'wm_formless') > 0, { dmg: 0.06 + 0.012 * skLv(p, 'wm_formless') });
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
