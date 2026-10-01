/* =====================================================================
   34. 逐帧精灵：各职业 / 怪物的动画表（片段名 → 帧序列）；有素材时替换骨骼部件模型
   一次性动作写成 [[帧, 起始秒], ...]（按动作内的时间选帧，最后一帧保持），循环动作写成 { fps, frames }
   新增一个动画：在 SPR_ANIMS[职业] 里加一条，动作定义里写 clip: '片段名' 即可（没有骨骼片段的会自动补一个）
   ===================================================================== */
const seq = (pre, n, fps) => ({ fps, frames: Array.from({ length: n }, (_, i) => `${pre}${i + 1}`) });
// 通用：移动、跳跃、受击（轻 / 重）、浮空（上升 / 翻滚 / 下落）、倒地（弹地 → 躺地）、起身、受身、被抓、蓄力、翻滚
const BASE_ANIMS = {
  idle: [['idle', 0]], walk: seq('walk', 8, 10), run: seq('run', 8, 16.7),
  jumpUp: [['jump2', 0]], jumpFall: [['jump3', 0], ['jump4', 0.12]], land: [['jump5', 0]], back: [['jump4', 0]],
  hit: [['hit1', 0], ['hit2', 0.1]], hit2: [['hit2', 0], ['hit3', 0.05]],
  airUp: [['airUp', 0]], air: [['tumble', 0], ['air', 0.14]], bounceUp: [['bounce', 0], ['air', 0.12]], down: [['bounce', 0], ['down', 0.1]],
  getup: [['down', 0], ['getup', 0.15]], tech: [['tech', 0]], held: [['held', 0]], charge: [['charge', 0]], roll: [['roll', 0]],
};
// 新动作帧还没进素材时，先用已有的帧顶上（出了素材自动换成新帧）
const sprHas = (c, f) => !!(typeof SPR_DATA !== 'undefined' && SPR_DATA[c] && SPR_DATA[c].frames[f]);
const sprOr = (c, f, fallback) => sprHas(c, f) ? [[f, 0]] : fallback;
// 多帧版：时间轴的第一帧有素材就整条用，否则用兜底（格斗家 B1 分批出帧）
const sprTl = (c, tl, fallback) => sprHas(c, tl[0][0]) ? tl : fallback;
const fAnim = (tl, fb = [['idle', 0]]) => sprTl('fighter', tl, fb);
const pAnim = (tl, fb = [['idle', 0]]) => sprTl('priest', tl, fb);
const SPR_ANIMS = {
  sword: { ...BASE_ANIMS,
    atk1: [['a1_1', 0], ['a1_2', 0.05], ['a1_3', 0.12]], atk2: [['a2_1', 0], ['a2_2', 0.05], ['a2_3', 0.14]], atk3: [['a3_1', 0], ['a3_2', 0.12]],
    atk4: [['a2_1', 0], ['atk4', 0.05], ['a1_3', 0.24]], dash: [['dash1', 0], ['dash2', 0.06]], flurry: { fps: 12.5, frames: ['stab1', 'stab2'] },
    jatk: [['jatk1', 0], ['jatk2', 0.06], ['jatk3', 0.16]], up: [['up1', 0], ['up2', 0.09], ['up3', 0.2]], rise: [['rise1', 0], ['rise2', 0.08]],
    a3slam: [['slam1', 0], ['slam2', 0.3]], focus: [['focus', 0]],
    ghost: [['ghost1', 0], ['ghost2', 0.13]], guard: [['guard', 0]], silver: [['silver', 0]], silverLand: [['slam2', 0]],
    aircut: [['jatk1', 0], ['jatk2', 0.03], ['jatk4', 0.13], ['jatk2', 0.23], ['jatk4', 0.33], ['jatk3', 0.43]],
    rip: [['rip1', 0], ['rip2', 0.2]], cross: [['cross1', 0], ['cross2', 0.15]],
    leap: [['leap1', 0]], leapLand: [['leap2', 0]], dragon: [['dragon', 0]], phantom: { fps: 14, frames: ['phantom1', 'phantom2', 'atk4'] }, backslash: [['backslash', 0]],
    awkB: [['awkB1', 0], ['awk1', 0.95], ['iai2', 1.2], ['awk2', 2.4]],
    roar: [['roar', 0]], soulhand: [['grab1', 0], ['grab2', 0.4]], outrage: [['charge', 0], ['burst', 0.18]], bloodblade: [['dash1', 0], ['dragon', 0.08], ['bladeW', 0.4]],
    quake: [['quake1', 0]], quakeLand: [['slam2', 0]], bzAwk: [['bzAwk1', 0], ['bzAwk2', 1.72]],
    // 官方对齐（剑士第 1 阶段）：空之连刃、剑魂里·鬼剑术 / 肩撞 / 拔刀回旋、狂战士二刀流与新技能
    jatkB: [['jatk2', 0], ['jatk4', 0.04]], jatkC: [['jatk1', 0], ['jatk3', 0.07]],
    rk1: [['a1_1', 0], ['rk1', 0.04]], rk2: [['rk1', 0], ['rk2', 0.04]], rk3: [['a3_1', 0], ['rk3', 0.05]], rk4: [['rk3', 0], ['rk4', 0.07]],
    rush: [['rush1', 0]], iai: [['iai1', 0], ['iaiSpin', 0.4]], meteorAim: [['meteorAim', 0]], hakuu: [['hakuu', 0]],
    bzA1: [['dual3', 0], ['dual1', 0.05]], bzA2: [['dual1', 0], ['dual2', 0.05]], bzA3: [['dual2', 0], ['dual3', 0.06]], bzA4: [['dual3', 0], ['dual4', 0.07]],
    dual1: [['dual1', 0]], dual2: [['dual2', 0]], whirl: [['whirl', 0]], thirst: [['thirst', 0]], twister: [['twister', 0]], enrage: [['enrage', 0], ['dual4', 0.12]],
    // 阿修罗
    asBurst: [['asBurst', 0]], asOrb: [['asOrb1', 0], ['asOrb2', 0.2]], asPlant: [['asPlant', 0]], asEvil: [['rk1', 0], ['asEvil', 0.08]], asPull: [['asPull', 0]], asSeal: [['asSeal', 0]], asAura: [['asAura', 0]],
    // 鬼泣
    sbSummon: [['sbSummon', 0]], sbPlace: [['sbPlace', 0]], sbWhip: [['sbWhip1', 0], ['sbWhip2', 0.26]], sbTomb: [['sbTomb', 0]], sbKaro: [['sbKaro', 0]], sbDescent: [['sbDescent', 0]], sbFerry: [['sbFerry', 0]] },
  gun: { ...BASE_ANIMS,
    gshot: [['shoot1', 0], ['shoot2', 0.03], ['shoot1', 0.12]], gup: { fps: 14, frames: ['shootUp1', 'shootUp2'] }, gdown: [['jatk1', 0], ['jatk2', 0.03], ['jatk3', 0.14]],
    gaim: [['snipe', 0]], holster: [['reload', 0]], kick: [['kick1', 0], ['kick2', 0.08]], spinkick: { fps: 12, frames: ['sk1', 'sk2', 'kick3'] }, slide: [['slide1', 0], ['slide2', 0.06]],
    gthrow: [['throw1', 0], ['throw2', 0.26]], ghawk: [['hawk1', 0], ['hawk2', 0.3]], gatling: { fps: 20, frames: ['gat1', 'gat2'] }, gbuff: [['twirl', 0]],
    flame: [['flame', 0]], flashKick: [['knee1', 0], ['flash', 0.06]], stomp: [['stomp1', 0], ['stomp2', 0.12]], bbq: [['bbq', 0]],
    aimShot: [['multi', 0], ['shoot2', 0.3], ['shoot1', 0.4]], gunDance: { fps: 12, frames: ['rapid1', 'backshot', 'rapid2', 'dual'] },
    moveShot: { fps: 8, frames: ['move1', 'move2'] }, dualAim: [['dual', 0]],
    crazy: [['awk1', 0], ['crazy1', 0.9]], crazyAir: [['crazy2', 0]], crazyLand: [['crazy3', 0]],
    cannon: [['cannon1', 0]], cannonFire: [['cannon2', 0], ['cannon1', 0.25]], laser: [['laser1', 0]], laserFire: [['laser2', 0]], quantum: [['quantum', 0]],
    lAwk: [['lAwk1', 0]], lAwkFire: [['lAwk2', 0]],
    // 漫游枪手（官方对齐第 2 阶段）
    headShot: [['shoot2', 0], ['shoot1', 0.1]],
    rainbow: sprOr('gun', 'rainbow', [['tumble', 0], ['jatk2', 0.25]]), airBlade: sprOr('gun', 'airBlade', [['jatk4', 0]]), rushBlade: sprOr('gun', 'rushBlade', [['kick2', 0]]),
    chainSnatch: sprOr('gun', 'chainSnatch', [['throw2', 0]]), carnival: sprOr('gun', 'carnival1', [['rapid1', 0]]), carnival2: sprOr('gun', 'carnival2', [['kick2', 0]]),
    bloodDance: sprOr('gun', 'bloodDance', [['rapid1', 0], ['backshot', 0.12]]), garden: sprOr('gun', 'garden', [['awk2', 0]]),
    // 枪炮师（官方对齐第 2 阶段）
    lancerUp: sprOr('gun', 'lancerUp', [['cannon1', 0]]), plasma: sprOr('gun', 'plasma', [['flame', 0]]), ptFwd: sprOr('gun', 'ptFwd', [['cannon2', 0]]), ptDown: sprOr('gun', 'ptDown', [['quantum', 0]]),
    armorOn: sprOr('gun', 'armor1', [['lAwk1', 0]]), armorFire: sprOr('gun', 'armor2', [['lAwk2', 0]]), finalWeapon: sprOr('gun', 'final1', [['gat1', 0]]), finalWeapon2: sprOr('gun', 'final2', [['gat2', 0]]) },
  mage: { ...BASE_ANIMS,
    atk1: [['m1_1', 0], ['m1_2', 0.06], ['m1_3', 0.14]], atk2: [['m2_1', 0], ['m2_2', 0.06], ['m2_3', 0.16]], dash: [['dash1', 0], ['dash2', 0.06]],
    mcast: [['cast1', 0], ['cast2', 0.12]], mup: [['castUp1', 0], ['castUp2', 0.1]], mdown: [['castDown1', 0], ['castDown2', 0.18]],
    mchan: { fps: 7, frames: ['chan1', 'chan2'] }, mjatk: [['jatkS1', 0], ['jatkS2', 0.07]], atk3: [['m3_1', 0], ['m3_2', 0.11]],
    whip: [['m1_1', 0], ['whip', 0.06]], cower: [['cower', 0]], showtime: [['showtime', 0]], dispel: [['cast1', 0], ['dispel', 0.3]],
    sky: [['sky1', 0], ['sky2', 0.11]], jack: [['jack1', 0], ['jack2', 0.2]], jackHold: [['jack1', 0]], eel: [['eel', 0]], fang: [['fang1', 0], ['fang2', 0.11]],
    cheer: [['cheer', 0]], cast3: [['cast3', 0]], summon: [['summon', 0]], palm: [['palm', 0], ['palm2', 0.09]],
    flameCast: [['castUp1', 0], ['flameC', 0.18]], void: [['void1', 0], ['void2', 0.25]], wall: [['wall', 0]], thunderCast: [['thunder', 0]], jackfall: [['jackfall', 0]],
    grip: [['palm', 0], ['grip', 0.15]], mAwk: [['awk', 0], ['mAwk1', 0.95], ['mAwk2', 1.6]],
    chaser: [['chaser', 0]], smash: [['smash1', 0]], smashDown: [['smash2', 0]], fangRush: { fps: 12, frames: ['fang2', 'fang1'] },
    raid: [['bmLeap2', 0]], bmLeap: [['bmLeap1', 0]], bmAwk: [['bmAwk', 0]],
    bmSweep: [['bmSweep1', 0], ['bmSweep2', 0.11]], bmSpin: { fps: 14, frames: ['bmSpin', 'bmSweep2'] }, bmDouble: [['bmSweep1', 0], ['bmDouble2', 0.1], ['bmDouble1', 0.3], ['bmDouble2', 0.62]],
    bmThrow: [['fang2', 0], ['bmThrow1', 0.14], ['bmThrow2', 0.56]], bmCall: [['bmCall', 0]],
    smCmd: [['smPoint', 0]], smThrow: [['smThrow1', 0], ['smThrow2', 0.12]], smSac: [['smSac', 0]], smSummon: [['smCircle1', 0], ['smCircle2', 0.2]],
    smAwk: [['smCircle2', 0], ['smAwk1', 0.9], ['smAwk2', 1.3]],
    // P1：元素师 / 战斗法师的二觉、三觉段
    elCurtain: [['elCurtain', 0]], elQuake: [['mup', 0], ['elQuake', 0.2]], elCrystal: [['elCrystal', 0]], elGate: [['elGate', 0]], elSixth: [['elSixth1', 0], ['elSixth2', 2.75]], elBeam: [['elBeam', 0]], elCosmos: [['elCosmos', 0]],
    bmFlashSmash: [['bmFlash', 0], ['bmSpin', 0.1], ['bmFlash', 0.2], ['bmSpin', 0.3], ['bmSweep1', 0.4], ['bmSweep2', 0.5]], bmDescent: [['bmLeapUp', 0], ['bmLeapDown', 0.42]],
    bmDance: [['bmDance', 0]], bmApostle: [['bmApostle', 0], ['bmSweep2', 1.48]], bmLunge: [['bmApostle', 0], ['bmLunge', 0.48]], bmPose: [['bmPose', 0]],
    bmGalaxy: [['bmPose', 0], ['bmSweep1', 0.98], ['bmSweep2', 1.06], ['bmFlash', 1.18], ['bmSweep2', 1.3], ['bmFlash', 1.42], ['bmLunge', 1.55], ['bmThrow2', 1.85], ['bmKick', 2.1], ['bmLeapDown', 2.22], ['bmSweep1', 2.6], ['bmSweep2', 2.74], ['bmPose', 3.25]],
    // 魔道学者（mage_witch.js）：骑扫把、失败演出、道具
    brIdle: [['brIdle', 0]], brDash: [['brDash', 0]], brFall: [['brFall', 0]], brAtk: [['brAtk1', 0]], brAtkB: [['brAtk2', 0]], brSpin: [['brSpin', 0]],
    faceplant: [['faceplant', 0]], sooty: [['sooty', 0]], potion: [['potion1', 0], ['potion2', 0.14]], potionHold: [['potion1', 0]],
    swat: [['swat1', 0], ['swat2', 0.18]], swatAir: [['brAtk2', 0], ['swat2', 0.12]], fling: [['fling', 0]], hammer: [['hammer', 0]], hammerRun: { fps: 10, frames: ['hammer', 'run3', 'hammer', 'run7'] },
    candy: [['candy1', 0], ['potion2', 0.36]], wtCheer: [['wtCheer', 0]] },
  // 格斗家（男）：B0 定的片段名契约（docs/CLASS_PLAN_FIGHTER.md §3.2），B1 按这些帧名出帧（art/final/spr/fighter/<帧>.webp），没出之前用通用帧兜底。
  // 通用骨架帧和鬼剑士同名（BASE_ANIMS）；职业自己的帧一律 f_ 前缀，转职的帧用 fn_ / fs_ / fb_ / fg_ 前缀写进各自的 J.anims
  fighter: { ...BASE_ANIMS,
    atk1: fAnim([['f_jab1', 0], ['f_jab2', 0.05]]), atk2: fAnim([['f_low1', 0], ['f_low2', 0.04]]), atk3: fAnim([['f_mid1', 0], ['f_mid2', 0.07]]), atk4: fAnim([['f_axe1', 0], ['f_axe2', 0.14]]),
    dash: fAnim([['f_shoulder1', 0], ['f_shoulder2', 0.05]], [['run3', 0]]), jatk: fAnim([['f_jkick1', 0], ['f_jkick2', 0.06]], [['jump2', 0]]),
    highkick: fAnim([['f_high1', 0], ['f_high2', 0.08]]), hammer: fAnim([['f_mid1', 0], ['f_mid2', 0.07]]), crouch: fAnim([['f_crouch', 0]], [['charge', 0]]),
    grab: fAnim([['f_grab', 0]]), knee: fAnim([['f_grab', 0], ['f_knee', 0.06]]), lift: fAnim([['f_lift', 0]]), slam: fAnim([['f_slam', 0]]),
    spinkick: sprHas('fighter', 'f_spin1') ? { fps: 16, frames: ['f_spin1', 'f_spin2'] } : [['idle', 0]], stomp: fAnim([['f_stomp', 0]], [['jump3', 0]]), dive: fAnim([['f_dive', 0]], [['jump3', 0]]),
    flykick: fAnim([['f_flykick', 0]], [['jump2', 0]]), palm: fAnim([['f_palm1', 0]]), palm2: fAnim([['f_palm2', 0]]), focus: fAnim([['f_focus', 0]], [['charge', 0]]), seal: fAnim([['f_seal', 0]], [['charge', 0]]),
    quake: fAnim([['f_quake', 0]]), smash: fAnim([['f_smash', 0]]) },
  // 圣职者（男）：B0 定的片段名契约（docs/CLASS_PLAN_PRIEST.md §3），美术块按这些帧名出帧（art/final/spr/priest/<帧>.webp），没出之前用通用帧兜底（出了第一帧整条自动换）。
  // 巨兵是拿在手上的武器（帧里画绿色占位棒、切帧记 wpn 握点，和鬼剑士 / 魔法师一样）；基础普攻沿用通用帧名，其余职业帧用 p_ 前缀，转职帧用 pc_ / pi_ / pe_ / pa_ 前缀写进各自的 J.anims
  priest: { ...BASE_ANIMS,
    atk1: pAnim([['a1_1', 0], ['a1_2', 0.06]]), atk2: pAnim([['a2_1', 0], ['a2_2', 0.06]]), atk3: pAnim([['a3_1', 0], ['a3_2', 0.14]]),
    dash: pAnim([['dash1', 0], ['dash2', 0.08]], [['run3', 0]]), jatk: pAnim([['jatk1', 0], ['jatk2', 0.06]], [['jump2', 0]]),
    up: pAnim([['p_up1', 0], ['p_up2', 0.08]]), upper: pAnim([['p_jab1', 0], ['p_jabEnd', 0.06]]),
    grab: pAnim([['p_grab', 0]]), carry: pAnim([['p_tiger', 0]], [['run3', 0]]), throw: pAnim([['p_tiger', 0], ['p_grab', 0.06]]),
    jab: pAnim([['p_jab1', 0], ['p_jab2', 0.05]]), straight: pAnim([['p_jab1', 0], ['p_jabEnd', 0.05]]),
    pray: pAnim([['p_pray1', 0], ['p_pray2', 0.15]], [['charge', 0]]), cast: pAnim([['p_focus', 0]], [['charge', 0]]), cross: pAnim([['p_guard', 0], ['p_focus', 0.08]]),
    leap: pAnim([['p_slamUp', 0]], [['jump2', 0]]), thrust: pAnim([['p_slamUp', 0], ['p_slamDown', 0.06]], [['jump5', 0]]), rapture: pAnim([['p_focus', 0]], [['charge', 0]]) },
  monster: { ...BASE_ANIMS, run: seq('run', 8, 15), jumpUp: [['jump', 0]], jumpFall: [['jump', 0]], land: [['low1', 0]], back: [['jump', 0]],
    hit2: [['hit2', 0]], airUp: [['air', 0]], air: [['air', 0]], bounceUp: [['down', 0], ['air', 0.1]], down: [['down', 0]], held: [['hit2', 0]], tech: [['getup', 0]],
    club: [['atk1', 0], ['atk2', 0.15], ['atk3', 0.42], ['atk4', 0.6]], throw: [['atk1', 0], ['atk2', 0.15], ['atk3', 0.45], ['atk4', 0.6]],
    atk1: [['atk2', 0], ['atk3', 0.08], ['atk4', 0.18]], atk2: [['atk2', 0], ['atk3', 0.08], ['atk4', 0.18]],
    axe: [['atk1', 0], ['atk2', 0.2], ['atk3', 0.62], ['atk4', 0.85]], scratch: [['atk2', 0], ['atk3', 0.3], ['atk4', 0.45]], bite: [['atk2', 0], ['atk3', 0.3], ['atk4', 0.5]],
    slam: [['atk1', 0], ['atk2', 0.2], ['atk3', 0.7], ['atk4', 1.0]], pounce: [['low1', 0], ['jump', 0.35], ['low2', 0.6], ['atk4', 0.85]],
    chargeW: { fps: 3, frames: ['low1', 'low1'] }, charge: { fps: 8, frames: ['low2', 'low1'] }, roar: [['cast1', 0], ['cast2', 0.45]],
    cast: { fps: 5, frames: ['cast1', 'cast2'] }, heal: { fps: 5, frames: ['cast1', 'cast2'] },
    sigA: [['atk1', 0], ['atk2', 0.2], ['atk3', 0.7], ['atk4', 1.0]], sigB: [['cast1', 0], ['cast2', 0.3], ['atk3', 0.7], ['atk4', 0.9]], rage: [['cast1', 0], ['cast2', 0.45]] },
};
// 领主招牌动作（docs/BOSS_SPEC.md §5）：每个领主可以多一张 3×3 的 sig 动作表，帧名 sigA1~4（招牌 A）/ sigB1~4（招牌 B）/ rage（狂暴 / 变身）；
// 技能写 clip: 'sigA' | 'sigB' | 'rage'。这个精灵有 sig 帧就用自己的，没有就退回上面的 atk / cast 帧（先写数据、后出图也能跑）
const SIG_ANIMS = { sigA: [['sigA1', 0], ['sigA2', 0.18], ['sigA3', 0.45], ['sigA4', 0.7]], sigB: [['sigB1', 0], ['sigB2', 0.18], ['sigB3', 0.45], ['sigB4', 0.7]], rage: [['rage', 0]] };
const MON_ANIM_CACHE = {};
function msMonAnims(r) {
  if (MON_ANIM_CACHE[r]) return MON_ANIM_CACHE[r];
  const A = { ...SPR_ANIMS.monster };
  for (const k in SIG_ANIMS) if (sprHas(r, SIG_ANIMS[k][0][0])) A[k] = SIG_ANIMS[k];
  return (MON_ANIM_CACHE[r] = A);
}
// 通用技能（后跳-强化等）挂到每个职业的技能表：这里所有职业 / 转职文件都已加载
addCommonSkills();
// 转职自带的动作片段（CLASSES[cls].jobs[job].anims，职业文件比这里早加载、碰不到 SPR_ANIMS）；帧名各转职用自己的前缀，不要互相覆盖
for (const c in SPR_ANIMS) { const C = CLASSES[c]; if (C && C.jobs) for (const J of Object.values(C.jobs)) if (J.anims) Object.assign(SPR_ANIMS[c], J.anims); }
// 玩家职业的走 / 跑（docs/ANIMATION.md）：每帧停留整数个 60Hz 逻辑步（走 5 步 = 12fps、跑 3 步 = 20fps，原来跑 16.7fps 是 3 / 4 步交替，节奏发瘸）；
// v = 这个 fps 对应的移动速度（职业基础移速），实际速度不同（移速装备 / BUFF、城镇移速、路人）时按比例加快 / 放慢，见 SpriteModel.loopRate
const SPR_PLAYER_CLS = Object.keys(SPR_ANIMS).filter(c => CLASSES[c]);   // 有动画表的玩家职业（sword / gun / mage / fighter / priest）
for (const c of SPR_PLAYER_CLS) { SPR_ANIMS[c].walk = { ...seq('walk', 8, 12), v: CLASSES[c].speed }; SPR_ANIMS[c].run = { ...seq('run', 8, 20), v: CLASSES[c].runSpeed }; }
// 没有骨骼片段的动画自动补一个（时长覆盖所有帧，循环动画按帧数 / fps）
for (const c of SPR_PLAYER_CLS) {
  CLIPS[c] = CLIPS[c] || { ...HUMAN_CLIPS };
  for (const name in SPR_ANIMS[c]) {
    const A = SPR_ANIMS[c][name];
    if (!CLIPS[c][name]) CLIPS[c][name] = A.frames ? { dur: A.frames.length / A.fps, loop: true, keys: [k(0, POSE.idle)] } : { dur: A[A.length - 1][1] + 2, keys: [k(0, POSE.idle)] };
    else if (!A.frames && CLIPS[c][name].dur < A[A.length - 1][1] + 0.05) CLIPS[c][name] = { ...CLIPS[c][name], dur: A[A.length - 1][1] + 0.5 };
    else if (A.frames && CLIPS[c][name].loop && Math.abs(CLIPS[c][name].dur - A.frames.length / A.fps) > 1e-3) CLIPS[c][name] = { ...CLIPS[c][name], dur: A.frames.length / A.fps };   // 循环长度 = 帧数 / fps（骨骼片段的时长对不上时会在一轮中间绕回第 1 帧）
  }
}
// 怪物：重受击 / 被抓 / 上升浮空沿用已有的受击片段
for (const S of [GOB_CLIPS, BEAST_CLIPS]) { S.hit2 = S.hit2 || { ...S.hit }; S.held = S.held || { ...S.hit, dur: 9 }; S.airUp = S.airUp || { ...S.air }; S.bounceUp = S.bounceUp || { ...S.air }; }
// 招牌动作的骨骼片段（没有精灵的程序模型用；时长覆盖 sig 帧的时间轴）
for (const S of [GOB_CLIPS, BEAST_CLIPS]) { S.sigA = S.sigA || { ...(S.slam || S.club), dur: 1.3 }; S.sigB = S.sigB || { ...(S.roar || S.cast || S.club), dur: 1.2 }; S.rage = S.rage || { ...(S.roar || S.club), dur: 1.2 }; }
// 兜底：姿势名 → 帧（没有列进动画表的片段用）
const SPR_FALLBACK = { idle: 'idle', idle2: 'idle', mIdle: 'idle', mIdle2: 'idle', hit: 'hit1', hit2: 'hit2', air: 'air', air2: 'air', down: 'down', getup: 'getup', tuck: 'roll', _: 'idle' };
for (const c of SPR_PLAYER_CLS) {
  const old = CLASSES[c].model;
  CLASSES[c].model = () => SPR_DATA[c] && IMG[`spr/${c}/idle`] ? new SpriteModel(c, SPR_FALLBACK, SPR_ANIMS[c]) : old();
}
for (const kk in MON_ART) {
  const [r, o] = MON_ART[kk]; if (!MON[kk] || !SPR_DATA[r]) continue;
  const old = MON[kk].model;
  MON[kk].model = () => IMG[`spr/${r}/idle`] ? new SpriteModel(r, { ...SPR_FALLBACK, cast: 'cast1', roar: 'cast2', crouch: 'low1' }, msMonAnims(r), o) : old();
}
