/* =====================================================================
   蓝拳圣使（男）觉醒三段：一觉 神之手（官方 Lv48~70 → 本作 21~25）、二觉 正义仲裁者（75~85 → 26~27）、三觉 神启·蓝拳圣使（95~100 → 29~30）
   觉醒技：泯灭神击 / 制裁：怒火疾风 / 正义执行：雷米迪奥斯的圣座（三觉和一觉或二觉联动冷却）；完成觉醒任务自动学会（0 SP、等级随角色等级）并放进技能栏
   干涸之泉（一觉被动）：神击技能之间互相取消（3.5 秒一次，PRIEST_HOOKS.cancelHook）；俯冲系 / 破碎之锤不能被别的技能取消进去，仲裁怒击和觉醒放出来后不能再取消
   ===================================================================== */
// 干涸之泉：可以互相取消的“神击”技能（转职主动技能 + 虎袭 / 直拳冲击；幻影化身 / 意念驱动这类 BUFF 除外）
const PI_DRY_NOIN = new Set(['pi_duck', 'pi_sway', 'pi_dstraight', 'pi_dupper', 'pi_dbody', 'pi_chop', 'pi_will', 'pi_shadow', 'pi_counter']);
const PI_DRY_NOOUT = new Set(['pi_nuke', 'pi_awaken', 'pi_awaken2', 'pi_awaken3', 'pi_will', 'pi_shadow']);
const piDivine = id => !!SKILLS[id] && !SKILLS[id].passive && (SKILLS[id].job === PIJ || id === 'p_smasher' || id === 'p_lucky');
const piDryCd = p => 3.5 * (game.pvp ? 3 : 1);
const piDryReady = p => skLv(p, 'pi_dry') > 0 && game.t - (p._piDryT ?? -99) >= piDryCd(p);
PRIEST_HOOKS.cancelHook.push((p, a, id) => {
  if (!piOn(p) || !a.skill || !piDryReady(p)) return false;
  if (!piDivine(a.skill) || PI_DRY_NOOUT.has(a.skill) || !piDivine(id) || PI_DRY_NOIN.has(id) || SKILLS[id].awaken) return false;
  if (a.skill === id || p.actT < 0.05) return false;
  if (game.pvp && id === 'pi_hurricane') return false;   // 官方：决斗场里极速飓风拳不能用干涸之泉
  return true;
});
// 通用后摇取消（game/skill_cancel.js）在决斗里同样不能取消进极速飓风拳（和上面干涸之泉的官方限制一致）
SKILLS.pi_hurricane.pvpNoCancelInto = true;
PRIEST_HOOKS.softCommit.push((p, a, id) => { if (!piOn(p) || !skLv(p, 'pi_dry')) return; p._piDryT = game.t; if (p.act) p.act.piDry = true; fxText('干涸之泉', p.x, p.y, p.z + 16, { col: '#8ae8ff', size: 10, dur: 0.45 }); fxAfterimage(p, '#8ae8ff'); });
defSkill('pi_dry', { name: '干涸之泉', cls: 'priest', job: PIJ, tier: 1, lvReq: 21, sp: 30, mp: 0, cd: 0, type: 'phys', passive: true, col: '#8ae8ff', cmdNote: '神击技能中按另一个神击技能',
  desc: '【一觉被动，完成一次觉醒时自动学会 Lv1】神击系技能（转职主动技能、虎袭、直拳冲击）施放中可以强制中断、接另一个神击系技能，每 3.5 秒一次（HUD 图标亮起时可用；决斗场 10.5 秒）。俯冲系、破碎之锤不能被取消进去；仲裁怒击和觉醒放出来后不能再取消（觉醒本身随时能切入）。基本攻击 / 技能的打击攻击力提高。',
  infoExtra: lv => [['打击攻击力', '+' + pct(0.005 + 0.015 * lv)], ['取消间隔', '3.5 秒']] });
// 泯灭神击（一觉）：聚力右钩拳（Side!）→ 左钩拳（Chest!）→ 下劈（Stun!）→ 冲出一记强力直拳（Big! Bang!，按住技能键可以推迟出拳）；全程无敌；10 秒暴击率提高；幻影化身中 ×1.1
defSkill('pi_awaken', { name: '泯灭神击', cls: 'priest', job: PIJ, tier: 1, lvReq: 21, maxLv: 3, sp: 0, mp: 150, cd: 135, pvp: 0.45, type: 'phys', awaken: true, col: '#9fd8ff', req: piNeedWill,
  desc: '【一次觉醒「神之手」的觉醒技】完成一次觉醒任务时自动学会（不花 SP，等级随角色等级提升）并放进技能栏（↑↑↓↓+Z）。聚集力量：右钩拳（Side!）→ 左钩拳（Chest!）→ 下劈拳（Stun!）→ 向前冲出一记强力直拳（Big! Bang!，伤害一半以上在这一拳；按住技能键可以推迟出拳等敌人落下）。全程无敌，之后 10 秒物理暴击率提高；幻影化身中攻击力 ×1.1。',
  pow: lv => skillDmg(24, 6, lv), ai: { kind: 'awaken', r: [0, 200], dy: 40 }, infoExtra: lv => [['最后一击', pct(skillDmg(24, 6, lv) * 0.5)], ['之后暴击率', '+10%（10 秒）']],
  act: lv => { const T = skillDmg(24, 6, lv) * 1;
    const hit = (e, k, o) => instantHit(e, { box: [-40, o.r || 130, 46, 0, 150], dmg: T * k * (e.buffs.pi_shadow ? 1.1 : 1), sure: true, hs: 0.1, shake: 5, big: 1.8, heavy: true, snd: 'blunt', col: '#cfeaff', ...o.h });
    return { name: 'pi_awaken', clip: 'piHook', dur: 2.6, noCounter: true, invul: true, superArmor: true,
      charge: { at: 1.35, max: 1.0, min: 0, dmg: 0, update: e => { if (Math.random() < 0.5) fxCharge(e, '#9fd8ff', 2); } },
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '泯灭神击', who: cutinWho(e) }; game.timeStop = 0.7; sfx.awaken(); for (let i = 0; i < 3; i++) fxCharge(e, '#9fd8ff', 3); },
      events: [evAt(0.3, e => { e.play('piHook', true); piPunchFx(e, 110, true); fxText('Side!', e.x, e.y, e.z + 60, { col: '#cfeaff', size: 13, dur: 0.4 }); hit(e, 0.11, { h: { stun: 1.2, knock: 10 } }); piImpact(e.x + e.face * 80, e.y, 60, 1.6); }),
        evAt(0.65, e => { e.play('piJab', true); piPunchFx(e, 110, true); fxText('Chest!', e.x, e.y, e.z + 60, { col: '#cfeaff', size: 13, dur: 0.4 }); hit(e, 0.17, { h: { stun: 1.2, knock: 10 } }); piImpact(e.x + e.face * 80, e.y, 60, 1.8); }),
        evAt(1.0, e => { e.play('piChop', true); sfx.swing(true); fxText('Stun!', e.x, e.y, e.z + 60, { col: '#cfeaff', size: 13, dur: 0.4 }); hit(e, 0.22, { h: { stun: 1.8, knock: 10 } }); piImpact(e.x + e.face * 80, e.y, 40, 2); }),
        evAt(1.36, e => { e.play('piStraight', true); e.vx = e.face * 420; fxAfterimage(e, '#9fd8ff'); fxText('Big! Bang!', e.x, e.y, e.z + 70, { col: '#ffffff', size: 18, dur: 0.8 }); }),
        evAt(1.5, e => { e.vx = 0; cam.shake = 16; cam.flash = 0.2; cam.flashCol = '#cfeaff'; sfx.boom(1.5); const x = e.x + e.face * 110;
          fxSpr('burst', x, e.y, 60, { w: 420, dur: 0.55, col: '#cfeaff', grow: [0.3, 1.2] }); fxShock(x, e.y, 360, '#9fd8ff'); fxStreak({ x: e.x, y: e.y, z: e.z + 62, face: e.face, len: 480, w: 60, col: '#cfeaff', dur: 0.4 });
          hit(e, 0.5, { r: 230, h: { box: [-60, 230, 50, 0, 160], downHit: true, knock: 520, launch: 300, hs: 0.2, big: 2.6, critBonus: 0.1 } }); e.buffs.pi_bigbang = { t: 10, crit: 0.1, name: '泯灭神击', col: '#9fd8ff' }; })] }; } });
// 破碎之拳：双拳飞快连打 10 下（连按更快，按跳跃键直接终结），最后一拳往下砸 + 爆炸；技巧精通：把周围的敌人吸过来
const piGatDmg = lv => ({ blow: skillDmg(0.87, 0.087, lv), fin: skillDmg(2.18, 0.218, lv), boom: skillDmg(3.62, 0.362, lv) });
defSkill('pi_gatling', { name: '破碎之拳', cls: 'priest', job: PIJ, tier: 1, lvReq: 23, sp: 60, mp: 70, cd: 35, type: 'phys', col: '#ffb070', req: piNeedWill, pre: { pi_mgjab: 1 },
  desc: '双拳飞快地连续打出 10 下（“欧拉欧拉欧拉！”，连按攻击键 / 技能键打得更快，按跳跃键直接终结），最后一拳往下砸，前方爆炸。连打中霸体。学了技巧精通：连打时把周围（150px + 17px/级）的敌人吸到面前。',
  pow: lv => { const D = piGatDmg(lv); return D.blow * 10 + D.fin + D.boom; }, ai: { kind: 'burst', r: [0, 140], dy: 40 },
  act: (lv, p) => { const D = piGatDmg(lv), tl = skLv(p, 'pi_tech'), pullR = tl ? 150 + 17 * tl : 0;
    return { name: 'pi_gatling', clip: 'piRush', dur: 2.2, noCounter: true, superArmor: [0, 1.4],
      onStart: e => { const a = e.act; a.n = 0; a.next = 0.08; a.mash = -9; fxText('欧拉欧拉欧拉！', e.x, e.y, e.z + 60, { col: '#ffd0a0', size: 12, dur: 0.6 }); },
      onInput: (e, I) => { const a = e.act; if (a.fin) return false; if (I.buffered('jump')) { I.consume('jump'); a.n = 10; return true; }
        if ((a.key && I.buffered(a.key)) || I.buffered('attack')) { if (a.key) I.consume(a.key); I.consume('attack'); a.mash = e.actT; return true; } return false; },
      update: e => { const a = e.act;
        if (!a.fin && a.n < 10 && e.actT >= a.next) { a.n++; a.next = e.actT + (e.actT - a.mash < 0.3 ? 0.06 : 0.09); sfx.swing(a.n % 2 === 0); fxDust(e.x - e.face * 20, e.y, 1, 6);
          for (let i = 0; i < 2; i++) fxStreak({ x: e.x + e.face * 20, y: e.y + rnd(-10, 10), z: e.z + 50 + rnd(-16, 16), face: e.face, len: 80, w: 10, col: '#ffb070', dur: 0.08 });
          if (pullR) for (const t of ents) if (foe(e, t) && !t.dead && piMovable(t) && Math.abs(t.x - e.x) < pullR && Math.abs(t.y - e.y) < 90) { t.x = lerp(t.x, e.x + e.face * 75, 0.3); t.y = lerp(t.y, e.y, 0.3); }
          instantHit(e, { box: [0, 125, 44, 10, 130], dmg: D.blow, stun: 0.35, knock: 0, hs: 0.02, airLift: 100, snd: 'blunt', col: '#ffd0a0' }); }
        if (!a.fin && a.n >= 10) { a.fin = e.actT; e.play('piChop', true); sfx.swing(true); a.dur = e.actT + 0.6;
          instantHit(e, { box: [0, 130, 44, -10, 140], dmg: D.fin, spike: 300, knock: 40, hs: 0.1, heavy: true, downHit: true, snd: 'blunt', col: '#ffd0a0' });
          game.after(0.12, () => { if (e.dead) return; const x = e.x + e.face * 110; cam.shake = Math.max(cam.shake, 8); sfx.boom(1); fxSpr('explosion', x, e.y, 40, { w: 240, dur: 0.45, grow: [0.5, 1.1] }); fxShock(x, e.y, 200, '#ffb070');
            areaHit(e, x, e.y, 160, 0, { dmg: D.boom, launch: 380, knock: 120, hs: 0.1, downHit: true, col: '#ffd0a0' }, { zMax: 160 }); }); } } }; } });
// 破坏之拳：向上的强力钩拳（打中的敌人连霸体一起被拎起来：抓取判定，抓不住的只受伤害），打中后出冲击波挑高；俯冲 / 摆动中也能用
const piDemoDmg = lv => ({ hit: skillDmg(14.4, 1.44, lv), wave: skillDmg(1.6, 0.16, lv) });
defSkill('pi_demo', { name: '破坏之拳', cls: 'priest', job: PIJ, tier: 1, lvReq: 25, sp: 70, mp: 75, cd: 40, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { pi_dbody: 1 },
  desc: '朝上打出一记强力的钩拳（伤害大部分在这一拳）：连霸体的敌人也会被拎起来（抓取判定，领主等抓不住的只受伤害），打中后爆出冲击波把周围的敌人挑高。俯冲 / 摆动中也能用（指令：Space）。',
  pow: lv => piDemoDmg(lv).hit + piDemoDmg(lv).wave, ai: { kind: 'launch', r: [0, 130], dy: 30 },
  act: lv => { const D = piDemoDmg(lv);
    return { name: 'pi_demo', clip: 'piUpper', dur: 0.7, noCounter: true,
      events: [evAt(0.06, e => { piPunchFx(e, 90, true, '#cfeaff'); fxSlashOn(e, { a0: 1.7, a1: -1.5, r: 80, w: 20, off: [30, 50], col: '#cfeaff', heavy: true, silent: true }); })],
      hits: [HB(0.08, 0.16, [0, 110, 40, -10, 150], D.hit, { max: 1, launch: 620, knock: 40, throwHit: true, hs: 0.14, shake: 6, big: 2, heavy: true, snd: 'blunt', col: '#cfeaff',
        onHit: (a, t) => { const A = a.act; if (!A || A.name !== 'pi_demo' || A.waved) return; A.waved = true; const x = t.x, y = t.y;
          game.after(0.2, () => { if (a.dead) return; cam.shake = Math.max(cam.shake, 7); sfx.boom(0.9); fxShock(x, y, 200, '#9fd8ff'); fxSpr('burst', x, y, 90, { w: 220, dur: 0.4, col: '#cfeaff' });
            areaHit(a, x, y, 160, 0, { dmg: D.wave, launch: 500, knock: 40, hs: 0.06, downHit: true, col: '#cfeaff' }, { zMax: 260 }); }); } })] }; } });

/* ---- 二次觉醒：正义仲裁者 ---- */
defSkill('pi_death', { name: '正义惩戒', cls: 'priest', job: PIJ, tier: 2, lvReq: 26, sp: 45, mp: 0, cd: 0, type: 'phys', passive: true, col: '#ff8a6a',
  desc: '【二觉被动】为了实现正义把身体锻炼到极致：基本攻击力、技能攻击力和命中率提高（官方现版没有条件的单纯增伤被动）。', infoExtra: lv => [['技能攻击力', '+' + pct(0.02 * lv)]] });
// 仲裁怒击：一记致命的直拳（拳头打中才出冲击波）；冲击波穿过目标打到后面一大片；干涸之泉可以取消进来，但放出后不能再取消
const piNukeDmg = lv => ({ hit: skillDmg(11.2, 1.12, lv), wave: skillDmg(4.8, 0.48, lv) });
defSkill('pi_nuke', { name: '仲裁怒击', cls: 'priest', job: PIJ, tier: 2, lvReq: 26, sp: 80, mp: 85, cd: 40, type: 'phys', col: '#ffa04a', req: piNeedWill,
  desc: '向前方的敌人打出一记致命的重拳（“核拳！”），打中时产生巨大的冲击波，穿过目标打到后面一大片敌人（拳头没打中就没有冲击波）。拳的距离很短、后摇很长。干涸之泉可以取消进来，放出后不能再取消。',
  pow: lv => piNukeDmg(lv).hit + piNukeDmg(lv).wave, ai: { kind: 'burst', r: [0, 110], dy: 30 },
  act: lv => { const D = piNukeDmg(lv);
    return { name: 'pi_nuke', clip: 'piStraight', dur: 1.0, noCounter: true, superArmor: [0, 0.5],
      events: [evAt(0.02, e => { fxCharge(e, '#ffa04a', 3); sfx.charge(); }), evAt(0.26, e => { e.play('piStraight', true); piPunchFx(e, 120, true, '#ffa04a'); fxText('核拳！', e.x, e.y, e.z + 60, { col: '#ffa04a', size: 14, dur: 0.5 }); })],
      hits: [HB(0.28, 0.36, [0, 112, 38, 20, 135], D.hit, { max: 1, knock: 420, launch: 120, hs: 0.18, shake: 8, big: 2.2, heavy: true, snd: 'blunt', col: '#ffd0a0',
        onHit: (a, t) => { const A = a.act; if (!A || A.name !== 'pi_nuke' || A.waved) return; A.waved = true; const x = t.x, y = t.y; cam.flash = 0.12; cam.flashCol = '#ffd0a0'; sfx.boom(1.4);
          fxSpr('explosion', x, y, 60, { w: 260, dur: 0.5, grow: [0.4, 1.2] }); fxStreak({ x, y, z: 60, face: a.face, len: 520, w: 70, col: '#ffa04a', dur: 0.45 }); fxShock(x + a.face * 200, y, 320, '#ffa04a');
          for (const o of ents) if (o !== t && foe(a, o) && !o.dead && o.invul <= 0 && (o.x - x) * a.face > -40 && Math.abs(o.x - x) < 520 && Math.abs(o.y - y) < 110 && o.z < 200)
            applyHit(a, o, { dmg: D.wave, knock: 380, launch: 200, hs: 0.08, downHit: true, box: null, snd: 'blunt', col: '#ffd0a0' }, { proj: true, src: { x, y, z: 0, face: a.face } }); } })] }; } });
// 超重拳：上勾拳把敌人稍稍挑起，几乎同时一拳往下砸（1 : 4）；俯冲 / 摆动中施放时起手几乎是瞬间
const piAtomDmg = lv => ({ up: skillDmg(4, 0.4, lv), down: skillDmg(16, 1.6, lv) });
defSkill('pi_atomic', { name: '超重拳', cls: 'priest', job: PIJ, tier: 2, lvReq: 26, sp: 90, mp: 95, cd: 50, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { pi_chop: 1 },
  desc: '一记上勾拳把敌人稍稍挑起，几乎同时一拳往下猛砸（伤害大部分在下砸，砸地弹起）。俯冲 / 摆动中施放时起手几乎是瞬间。纵向判定比仲裁怒击宽得多。',
  pow: lv => piAtomDmg(lv).up + piAtomDmg(lv).down, ai: { kind: 'burst', r: [0, 130], dy: 40 },
  act: (lv, p) => { const D = piAtomDmg(lv), q = piFromDuck(p) ? 0.03 : 0.12;
    return { name: 'pi_atomic', clip: 'piUpper', dur: q + 0.62, noCounter: true, superArmor: [0, q + 0.3],
      events: [evAt(Math.max(0, q - 0.03), e => { e.play('piUpper', true); piPunchFx(e, 80, true); }), evAt(q + 0.1, e => { e.play('piChop', true); sfx.swing(true); fxSlashOn(e, { a0: -2.3, a1: 0.9, r: 90, w: 22, off: [30, 70], col: '#cfeaff', heavy: true, silent: true }); })],
      hits: [HB(q, q + 0.07, [0, 105, 40, -10, 170], D.up, { launch: 260, knock: 20, hs: 0.05, downHit: true, snd: 'blunt', col: PI_COL.fist }),
        HB(q + 0.12, q + 0.2, [0, 125, 46, -10, 220], D.down, { spike: 420, bounce: 0.9, knock: 60, hs: 0.16, shake: 8, big: 2.2, heavy: true, downHit: true, snd: 'blunt', col: '#cfeaff', onHit: (a, t) => { piImpact(t.x, t.y, 30, 2.6, '#cfeaff'); } })] }; } });
// 制裁：怒火疾风（二觉）：跳起砸地，然后用眼花缭乱的步法在 600px 内的敌人之间穿梭连打 19 下，消失在画面外把敌人聚到一起，再出现打出终结（2 下直接打击 + 覆盖全画面的大爆炸）
defSkill('pi_awaken2', { name: '制裁：怒火疾风', cls: 'priest', job: PIJ, tier: 2, lvReq: 27, maxLv: 3, sp: 0, mp: 200, cd: 170, pvp: 0.45, type: 'phys', awaken: true, cast: true, col: '#ff7a5a', req: piNeedWill,
  desc: '【二次觉醒「正义仲裁者」的觉醒技】完成二次觉醒任务时自动学会（不花 SP）并放进技能栏（↓↑→→+Z）。跳起砸地，然后用眼花缭乱的步法在周围 600px 的敌人之间穿梭，连打 19 下（每打一个敌人就以他为中心再找下一个），消失在画面外把敌人聚到一起，再出现打出破坏之拳 + 破碎之锤的终结，引发覆盖整个画面的大爆炸（伤害一半在爆炸）。全程无敌；干涸之泉可以取消进来，放出后不能取消。',
  pow: lv => skillDmg(32, 8, lv), ai: { kind: 'awaken', r: [0, 600], dy: 200 },
  act: lv => { const T = skillDmg(32, 8, lv);
    return { name: 'pi_awaken2', clip: 'piSlam', dur: 3.6, noCounter: true, invul: true, superArmor: true,
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '制裁：怒火疾风', who: cutinWho(e, 2) }; game.timeStop = 0.8; sfx.awaken(); fxText('Excidio!', e.x, e.y, e.z + 60, { col: '#ff9a7a', size: 14, dur: 0.7 }); const a = e.act; a.n = 0; a.cx = e.x; a.cy = e.y; },
      update: e => { const a = e.act, t = e.actT;
        if (!a.slam && t >= 0.35) { a.slam = true; cam.shake = Math.max(cam.shake, 8); sfx.boom(0.8); fxShock(e.x, e.y, 200, '#ff9a7a'); areaHit(e, e.x, e.y, 180, 0, { dmg: T * 0.03, sure: true, launch: 200, knock: 0, hs: 0.04, downHit: true }, { zMax: 120 }); }
        if (a.slam && a.n < 19 && t >= 0.5 + a.n * 0.08) { const L = ents.filter(o => foe(e, o) && !o.dead && Math.abs(o.x - a.cx) < 600 && Math.abs(o.y - a.cy) < 220 && o.z < 200);
          a.n++; if (!L.length) { a.n = 19; return; }
          const o = L[a.n % L.length], side = a.n % 2 ? 1 : -1, x0 = e.x, y0 = e.y; fxAfterimage(e, '#ff9a7a'); e.x = clamp(o.x + side * 56, game.room ? game.room.x0 + 20 : -1e9, game.room ? game.room.x1 - 20 : 1e9); e.y = o.y; e.face = -side; a.cx = o.x; a.cy = o.y;
          piBoltLite(x0, y0, e.x, e.y); e.play(a.n % 2 ? 'piHook' : 'piJab', true); sfx.swing(a.n % 3 === 0); piImpact(o.x, o.y, 60, 1.2, '#ffc0a0');
          applyHit(e, o, { dmg: T * 0.43 / 19, stun: 0.5, knock: 0, hs: 0.02, sure: true, downHit: true, box: null, snd: 'blunt', col: '#ffc0a0' }, { src: e }); }
        if (a.slam && a.n >= 19 && !a.gone) { a.gone = t; e.alpha = 0.001; e.hidden = true; const cx = e.x, cy = e.y; a.cx = cx; a.cy = cy;
          for (const o of ents) if (foe(e, o) && !o.dead && piMovable(o) && Math.abs(o.x - cx) < 900) { o.x = lerp(o.x, cx + e.face * 60, 0.85); o.y = lerp(o.y, cy, 0.8); addStatus(o, 'hold', 1.2, { src: e }); } }
        if (a.gone && !a.back && t >= a.gone + 0.45) { a.back = true; e.alpha = 1; e.hidden = false; e.x = a.cx - e.face * 70; fxAfterimage(e, '#ff9a7a'); e.play('piUpper', true); sfx.swing(true);
          for (let i = 0; i < 2; i++) game.after(i * 0.12, () => { if (e.dead) return; if (i) e.play('piChop', true); instantHit(e, { box: [-20, 150, 60, -10, 200], dmg: T * 0.035, sure: true, launch: i ? 0 : 300, spike: i ? 300 : 0, knock: 40, hs: 0.1, big: 1.8, downHit: true, snd: 'blunt', col: '#ffc0a0' }); });
          game.after(0.35, () => { if (e.dead) return; cam.shake = 20; cam.flash = 0.35; cam.flashCol = '#ffd0b0'; sfx.boom(1.6); fxText('Extremum!', a.cx, a.cy, 170, { col: '#ff9a7a', size: 20, dur: 1 });
            fxSpr('explosion', a.cx, a.cy, 60, { w: 620, dur: 0.7, grow: [0.3, 1.2] }); for (let i = 0; i < 3; i++) game.after(i * 0.1, () => fxShock(a.cx, a.cy, 400 + i * 200, '#ff9a7a'));
            for (const o of ents) if (foe(e, o) && !o.dead && Math.abs(o.x - a.cx) < WW) applyHit(e, o, { dmg: T * 0.5, sure: true, launch: 520, knock: 300, hs: 0.2, big: 2.6, downHit: true, box: null, snd: 'blunt', col: '#ffc0a0' }, { proj: true, src: { x: a.cx, y: a.cy, z: 0, face: e.face } }); });
          a.dur = t + 1.0; } },
      onEnd: e => { e.alpha = 1; e.hidden = false; } }; } });
// 穿梭的蓝色折线（怒火疾风 / 正义铁拳）
function piBoltLite(x0, y0, x1, y1) { fxStreak({ x: (x0 + x1) / 2, y: Math.max(y0, y1), z: 60, face: x1 >= x0 ? 1 : -1, len: Math.max(40, Math.abs(x1 - x0)), w: 6, col: '#ffc0a0', dur: 0.12 }); }

/* ---- 三次觉醒：神启·蓝拳圣使 ---- */
defSkill('pi_one', { name: '绝对正义', cls: 'priest', job: PIJ, tier: 3, lvReq: 29, sp: 60, mp: 0, cd: 0, type: 'phys', passive: true, col: '#ffe070',
  desc: '【三觉被动】信仰和信念传达给神、领悟真正正义的神启·蓝拳圣使，被光之圣遗物选中：基本攻击和转职技能攻击力提高。俯冲腹拳：打中后能用俯冲 / 摆动取消后摇。破碎之锤：不再出冲击波，改为在落点插下巨兵引发神圣爆炸（打不中也会爆，意念驱动跟着移过来）。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.03 * lv)]] });
// 正义铁拳：注入神圣力的拳头往下砸挑起敌人（冲击波），然后高速移动把周围的敌人聚到一处连打 15 下（连按更快，按跳跃键直接终结），最后一记强力钩拳把敌人打飞
const piFurDmg = lv => ({ slam: skillDmg(5.6, 0.56, lv), hit: skillDmg(0.42, 0.042, lv), fin: skillDmg(14.1, 1.41, lv) });
defSkill('pi_furious', { name: '正义铁拳', cls: 'priest', job: PIJ, tier: 3, lvReq: 29, sp: 100, mp: 110, cd: 60, type: 'phys', col: '#ffe070', req: piNeedWill,
  desc: '把神圣力注入拳头往下砸，冲击波把敌人挑起；接着高速左右移动，把周围的敌人聚到一处连打 15 下（“欧拉！欧~拉！”，连按攻击键 / 技能键更快，按跳跃键直接终结），最后一记强力钩拳（Justice!）把敌人打飞。伤害分布在整个过程里，中途被打断损失很大（本身霸体）。',
  pow: lv => { const D = piFurDmg(lv); return D.slam + D.hit * 15 + D.fin; }, ai: { kind: 'burst', r: [0, 300], dy: 80 },
  act: lv => { const D = piFurDmg(lv);
    return { name: 'pi_furious', clip: 'piSlam', dur: 3.0, noCounter: true, superArmor: true,
      onStart: e => { const a = e.act; a.n = 0; a.next = 0.45; a.mash = -9; a.cx = e.x + e.face * 90; a.cy = e.y; },
      onInput: (e, I) => { const a = e.act; if (a.fin) return false; if (I.buffered('jump') && a.n > 0) { I.consume('jump'); a.n = 15; return true; }
        if ((a.key && I.buffered(a.key)) || I.buffered('attack')) { if (a.key) I.consume(a.key); I.consume('attack'); a.mash = e.actT; return true; } return false; },
      update: e => { const a = e.act, t = e.actT;
        if (!a.slam && t >= 0.18) { a.slam = true; cam.shake = Math.max(cam.shake, 8); sfx.boom(0.9); fxShock(a.cx, a.cy, 220, '#ffe070'); fxSpr('burst', a.cx, a.cy, 30, { w: 200, dur: 0.35, col: '#ffe070' });
          areaHit(e, a.cx, a.cy, 170, 0, { dmg: D.slam, launch: 420, knock: 20, hs: 0.08, downHit: true, col: '#ffe8a0' }, { zMax: 120 }); }
        if (a.slam && !a.fin && a.n < 15 && t >= a.next) { a.n++; a.next = t + (t - a.mash < 0.3 ? 0.06 : 0.09); const side = a.n % 2 ? 1 : -1; fxAfterimage(e, '#ffe070');
          e.x = clamp(a.cx + side * 70, game.room ? game.room.x0 + 20 : -1e9, game.room ? game.room.x1 - 20 : 1e9); e.face = -side; e.play(a.n % 2 ? 'piHook' : 'piJab', true); if (a.n % 2) sfx.swing(false);
          for (const o of ents) if (foe(e, o) && !o.dead && piMovable(o) && Math.abs(o.x - a.cx) < 380 && Math.abs(o.y - a.cy) < 160) { o.x = lerp(o.x, a.cx, 0.35); o.y = lerp(o.y, a.cy, 0.35); o.z = Math.max(o.z, 30); o.vz = Math.max(o.vz, 60); }
          if (a.n % 3 === 0) fxText(a.n % 2 ? '欧拉！' : '欧~拉！', e.x, e.y, e.z + 60, { col: '#ffe8a0', size: 10, dur: 0.3 }); piImpact(a.cx, a.cy, 60, 1.1, '#ffe8a0');
          areaHit(e, a.cx, a.cy, 110, 0, { dmg: D.hit, stun: 0.4, knock: 0, airLift: 80, hs: 0.02, downHit: true, col: '#ffe8a0' }, { zMax: 200 }); }
        if (a.slam && !a.fin && a.n >= 15) { a.fin = true; e.face = Math.sign(a.cx - e.x) || e.face; e.play('piHook', true); cam.shake = 16; cam.flash = 0.18; cam.flashCol = '#fff2c0'; sfx.boom(1.4); fxText('Justice!', a.cx, a.cy, 150, { col: '#ffe070', size: 18, dur: 0.8 });
          fxSlashOn(e, { a0: -2.0, a1: 1.0, r: 120, w: 30, off: [30, 60], col: '#ffe070', heavy: true }); fxSpr('burst', a.cx, a.cy, 70, { w: 360, dur: 0.5, col: '#ffe070', grow: [0.4, 1.2] }); fxStreak({ x: a.cx, y: a.cy, z: 70, face: e.face, len: 460, w: 50, col: '#ffe070', dur: 0.4 });
          areaHit(e, a.cx, a.cy, 170, 0, { dmg: D.fin, knock: 560, launch: 260, hs: 0.18, big: 2.4, sure: true, downHit: true, col: '#ffe8a0' }, { zMax: 260 }); a.dur = t + 0.6; } } }; } });
// 正义执行：雷米迪奥斯的圣座（三觉）：划十字，巨兵移到身后；跃起，巨兵化为雷米迪奥斯的圣座；落地把周围宣告为圣域，敌人被拉到面前跪地忏悔（控制）；
// 在圣域中心的告解所祈祷，圣座现出真正的形态——神圣拳铠；注入神的意志一记上勾拳执行正义（2 段，1 : 1.5）
defSkill('pi_awaken3', { name: '正义执行：雷米迪奥斯的圣座', cls: 'priest', job: PIJ, tier: 3, lvReq: 30, maxLv: 3, sp: 0, mp: 300, cd: 270, pvp: 0.45, type: 'phys', awaken: true, col: '#ffe070', req: p => { const r = piNeedWill(p); if (r !== true) return r; const L = piLinkOf(p); return (p.cool[L] || 0) > 0 ? `联动的${SKILLS[L].name}冷却中` : true; },
  switchOpt: '联动觉醒', switchLabel: off => off ? '当前联动：制裁：怒火疾风（点击改为泯灭神击）' : '当前联动：泯灭神击（点击改为制裁：怒火疾风）',
  desc: '【三次觉醒「神启·蓝拳圣使」的觉醒技】完成三次觉醒任务时自动学会（不花 SP）并放进技能栏（←↑→↓+Z）。划下十字，把插着的巨兵移到身后，握住它跃起——巨兵化为光之圣遗物「雷米迪奥斯的圣座」；落地把周围宣告为圣域：圣域里的敌人被拉到面前双膝跪地忏悔（控制），你在圣域中心的告解所祈祷，圣座现出真正的形态——神圣拳铠，注入神的意志一记上勾拳执行正义（2 段，第 2 段更重，覆盖大范围）。全程无敌。和联动的觉醒共用冷却（默认联动泯灭神击，技能窗口里可以改成联动制裁：怒火疾风）。',
  pow: lv => skillDmg(44, 12, lv), ai: { kind: 'awaken', r: [0, 600], dy: 200 },
  act: lv => { const T = skillDmg(44, 12, lv);
    return { name: 'pi_awaken3', clip: 'piPray', dur: 3.4, noCounter: true, invul: true, superArmor: true, lowGrav: 0.8,
      onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '正义执行：雷米迪奥斯的圣座', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); fxText('雷米迪奥斯……', e.x, e.y, e.z + 70, { col: '#ffe070', size: 13, dur: 1 });
        const L = piLinkOf(e); if (SKILLS[L]) e.cool[L] = Math.max(e.cool[L] || 0, SKILLS[L].cd * (e.cdMul || 1)); if (e.piWill) { e.piWill.x = e.x - e.face * 40; e.piWill.y = e.y; } },
      events: [evAt(0.2, e => { fxSpr('crossx', e.x, e.y, e.z + 70, { w: 70, dur: 0.5, col: '#ffe070', rot: Math.PI / 4 }); }),
        evAt(0.5, e => { e.play('piLeap', true); e.vz = 620; e.z = Math.max(e.z, 1); sfx.jump(); fxSpr('aura', e.x, e.y, 0, { h: 260, ay: 1, dur: 0.8, col: '#ffe070' }); }),
        evAt(0.72, e => { e.vz = -900; }),
        evAt(1.05, e => { const cx = e.x, cy = e.y; e.act.cx = cx; e.act.cy = cy; cam.shake = 14; sfx.boom(1.2); pcCircle(cx, cy, 480, '#ffe070', 2.2, { spin: 0.4 }); fxShock(cx, cy, 600, '#ffe070');
          for (const o of ents) if (foe(e, o) && !o.dead && Math.abs(o.x - cx) < 700 && Math.abs(o.y - cy) < 260) { if (piMovable(o)) { o.x = lerp(o.x, cx + e.face * 90, 0.9); o.y = lerp(o.y, cy, 0.85); } addStatus(o, 'hold', 2.2, { src: e }); fxText('忏悔', o.x, o.y, o.z + 50, { col: '#ffe070', size: 10, dur: 0.6 }); }
          fxText('Dicite!', e.x, e.y, e.z + 60, { col: '#ffe070', size: 14, dur: 0.6 }); }),
        evAt(1.35, e => { e.play('piPray', true); pcPillar(e.x, e.y, { w: 120, h: 340, dur: 0.9, col: '#fff6c0' }); fxText('神的旨意！', e.x, e.y, e.z + 70, { col: '#fff6c0', size: 13, dur: 0.6 }); sfx.charge(); }),
        evAt(1.85, e => { fxSpr('burst', e.x + e.face * 30, e.y, 70, { w: 160, dur: 0.5, col: '#ffd24a' }); fxSpr('pm_hexshield', e.x + e.face * 40, e.y, 70, { w: 90, h: 120, dur: 0.6, col: '#ffd24a' }); fxText('神圣拳铠', e.x, e.y, e.z + 80, { col: '#ffd24a', size: 12, dur: 0.6 }); }),
        evAt(2.15, e => { const a = e.act, cx = a.cx ?? e.x; e.play('piUpper', true); cam.shake = 18; cam.flash = 0.2; cam.flashCol = '#fff2c0'; sfx.boom(1.4); fxText('Justitia!', e.x, e.y, e.z + 80, { col: '#ffe070', size: 20, dur: 0.9 });
          fxSlashOn(e, { a0: 1.7, a1: -1.6, r: 160, w: 40, off: [40, 80], col: '#ffe070', heavy: true }); fxSpr('burst', e.x + e.face * 90, e.y, 110, { w: 300, dur: 0.5, col: '#ffe070', grow: [0.4, 1.2] });
          for (const o of ents) if (foe(e, o) && !o.dead && o.invul <= 0 && Math.abs(o.x - cx) < 700) { if (o.status) delete o.status.hold; applyHit(e, o, { dmg: T * 0.4, sure: true, launch: 520, knock: 60, hs: 0.16, big: 2.2, downHit: true, box: null, snd: 'blunt', col: '#ffe8a0' }, { proj: true, src: { x: e.x, y: e.y, z: 0, face: e.face } }); } }),
        evAt(2.45, e => { const a = e.act, cx = a.cx ?? e.x; cam.shake = 22; cam.flash = 0.35; cam.flashCol = '#fff8e0'; sfx.boom(1.7);
          for (let i = 0; i < 5; i++) pcPillar(cx + (i - 2) * 140, e.y, { w: 120, h: 420, dur: 0.8, col: '#fff6c0' }); fxSpr('explosion', cx + e.face * 60, e.y, 80, { w: 560, dur: 0.7, grow: [0.3, 1.2] }); for (let i = 0; i < 3; i++) game.after(i * 0.1, () => fxShock(cx, e.y, 400 + i * 180, '#ffe070'));
          for (const o of ents) if (foe(e, o) && !o.dead && Math.abs(o.x - cx) < 800) applyHit(e, o, { dmg: T * 0.6, sure: true, launch: 600, knock: 280, hs: 0.22, big: 2.8, downHit: true, box: null, snd: 'blunt', col: '#fff2c0' }, { proj: true, src: { x: cx, y: e.y, z: 0, face: e.face } });
          if (e.piWill) { e.piWill.x = e.x + e.face * 40; e.piWill.y = e.y; } })] }; } });
const piLinkOf = p => isHuman(p) && pcSw('pi_awaken3') ? 'pi_awaken2' : 'pi_awaken';
for (const id of ['pi_awaken', 'pi_awaken2']) { const S = SKILLS[id], r0 = S.req; S.req = p => { const r = r0 ? r0(p) : true; if (r !== true) return r; return (piLinkOf(p) === id && (p.cool.pi_awaken3 || 0) > 0 && skLv(p, 'pi_awaken3') > 0) ? '正义执行冷却中（联动）' : true; }; }

/* =====================================================================
   觉醒自动学会、被动、登记
   ===================================================================== */
const PI_AUTO = [['pi_awaken', 1, true], ['pi_dry', 1, false], ['pi_awaken2', 2, true], ['pi_awaken3', 3, true]];
function piAutoAwaken(p) {
  if (p.kit || !game.skillLv || !game.skillBar || !isHuman(p)) return;
  const got = [];
  for (const [id, tier, grow] of PI_AUTO) { const S = SKILLS[id]; if (!S || !tierUnlocked(tier) || game.lvl < S.lvReq) continue;
    const cur = game.skillLv[id] || 0, want = grow ? Math.min(S.maxLv || 1, 1 + Math.floor((game.lvl - S.lvReq) / (S.lvStep || 1))) : 1;
    if (cur >= want) continue; game.skillLv[id] = want;
    if (!cur) { got.push(S.name); if (!S.passive && !game.skillBar.includes(id)) { const k = game.skillBar.indexOf(null); if (k >= 0) game.skillBar[k] = id; } } }
  if (got.length) { toastMsg(`觉醒：自动学会 ${got.join('、')}（主动技能已放进技能栏）`, '#9fd8ff'); if (typeof save !== 'undefined' && save.write) save.write(); }
}
CLASSES.priest.passives.push(p => {
  const ids = ['pi_body', 'pi_tech', 'pi_dry', 'pi_death', 'pi_one', 'pi_will'];
  if (!piOn(p)) { for (const id of ids) setPassive(p, id, false); return; }
  piAutoAwaken(p); piHideHandCross(p);
  if (piScene() && !p.dead) piEnsureWill(p);
  if (piWillOn(p)) piWillFx(p);
  const L = id => skLv(p, id);
  setPassive(p, 'pi_body', L('pi_body') > 0, { mspd: 0.15, aspd: 0.1, hide: true });
  setPassive(p, 'pi_tech', L('pi_tech') > 0, { dmg: 0.01 * L('pi_tech'), mspd: 0.01 * L('pi_tech'), hide: true });
  const dr = L('pi_dry'); setPassive(p, 'pi_dry', dr > 0, { dmg: 0.005 + 0.015 * dr, lab: piDryReady(p) ? '✓' : String(Math.ceil(piDryCd(p) - (game.t - (p._piDryT ?? -99)))), col: '#8ae8ff' });
  setPassive(p, 'pi_death', L('pi_death') > 0, { dmg: 0.02 * L('pi_death'), hide: true });
  setPassive(p, 'pi_one', L('pi_one') > 0, { dmg: 0.03 * L('pi_one'), hide: true });
  // 意念驱动的光环：在巨兵 750px 内刷新，离开后保留 30 秒
  const W = p.piWill, wl = L('pi_will');
  if (wl && W && W.room === game.room && Math.abs(p.x - W.x) < 750) { const V = piWillVal(wl); p.buffs.pi_will = { t: 30, crit: V.crit, critDmg: V.critDmg, name: '意念驱动', col: '#9fd8ff' }; }
  if (!piWillOn(p) && p.buffs.pi_shadow && !game.pvp) delete p.buffs.pi_shadow;
});
{ const J = CLASSES.priest.jobs.monk;
  Object.assign(J, { art: 'job/monk', role: '近身拳击 · 连打（物理）', awaken: 'pi_awaken', awaken2: 'pi_awaken2', awaken3: 'pi_awaken3', auto: ['pi_body', 'pi_will'],
    desc: '把巨兵插在地上（意念驱动），赤手空拳贴身连打的圣职者：俯冲 / 摆动闪避穿插各种拳击，神圣反击挡下攻击再打回去，影子分身追加打击；一觉后的干涸之泉让拳技之间互相取消。' });
  J.skills.push('pi_body', 'pi_will', 'pi_duck', 'pi_sway', 'pi_dstraight', 'pi_dupper', 'pi_tech', 'pi_dbody', 'pi_crush', 'pi_parry', 'pi_side', 'pi_gorgeous', 'pi_counter', 'pi_chop',
    'pi_shadow', 'pi_mgjab', 'pi_cork', 'pi_heavenly', 'pi_double', 'pi_hurricane', 'pi_dry', 'pi_awaken', 'pi_gatling', 'pi_demo', 'pi_death', 'pi_nuke', 'pi_atomic', 'pi_awaken2',
    'pi_one', 'pi_furious', 'pi_awaken3');
  Object.assign(J.anims, PI_ANIMS);
  // 指令（官方男蓝拳：wiki.dfo.world 各技能页）；俯冲系 / 破碎之锤是俯冲 / 摆动中的 X（技能自己的 onInput），直接按技能栏也能放
  CLASSES.priest.cmds.push(['ud', 'pi_will', 'buff'], ['bf', 'pi_shadow', 'buff'], ['', 'pi_duck'], ['dd', 'pi_sway', 'jump'], ['fu', 'pi_crush'], ['bf', 'pi_side'], ['ff', 'pi_gorgeous'], ['dd', 'pi_counter'],
    ['uff', 'pi_mgjab'], ['uf', 'pi_cork'], ['dff', 'pi_heavenly'], ['bdf', 'pi_hurricane'], ['uudd', 'pi_awaken'], ['fbdf', 'pi_gatling'], ['', 'pi_demo', 'buff'], ['fbf', 'pi_nuke'],
    ['bff', 'pi_atomic'], ['duff', 'pi_awaken2'], ['udff', 'pi_furious'], ['bufd', 'pi_awaken3']);
}
