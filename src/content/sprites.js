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
const SPR_ANIMS = {
  sword: { ...BASE_ANIMS,
    atk1: [['a1_1', 0], ['a1_2', 0.05], ['a1_3', 0.12]], atk2: [['a2_1', 0], ['a2_2', 0.05], ['a2_3', 0.14]], atk3: [['a3_1', 0], ['a3_2', 0.12]],
    atk4: [['a2_1', 0], ['atk4', 0.05], ['a1_3', 0.24]], dash: [['dash1', 0], ['dash2', 0.06]], flurry: { fps: 12.5, frames: ['stab1', 'stab2'] },
    jatk: [['jatk1', 0], ['jatk2', 0.06], ['jatk3', 0.16]], up: [['up1', 0], ['up2', 0.09], ['up3', 0.2]], rise: [['rise1', 0], ['rise2', 0.08]],
    a3slam: [['slam1', 0], ['slam2', 0.3]], iai: [['iai1', 0], ['iai2', 0.4]], focus: [['focus', 0]],
    ghost: [['ghost1', 0], ['ghost2', 0.13]], guard: [['guard', 0]], silver: [['silver', 0]], silverLand: [['slam2', 0]],
    aircut: [['jatk1', 0], ['jatk2', 0.03], ['jatk4', 0.13], ['jatk2', 0.23], ['jatk4', 0.33], ['jatk3', 0.43]],
    rip: [['rip1', 0], ['rip2', 0.2]], cross: [['cross1', 0], ['cross2', 0.15]],
    leap: [['leap1', 0]], leapLand: [['leap2', 0]], dragon: [['dragon', 0]], phantom: { fps: 14, frames: ['phantom1', 'phantom2', 'atk4'] }, backslash: [['backslash', 0]],
    awkB: [['awkB1', 0], ['awk1', 0.95], ['iai2', 1.2], ['awk2', 2.4]],
    roar: [['roar', 0]], soulhand: [['grab1', 0], ['grab2', 0.4]], outrage: [['charge', 0], ['burst', 0.18]], bloodblade: [['dash1', 0], ['dragon', 0.08], ['bladeW', 0.4]],
    quake: [['quake1', 0]], quakeLand: [['slam2', 0]], bzAwk: [['bzAwk1', 0], ['bzAwk2', 1.72]] },
  gun: { ...BASE_ANIMS,
    gshot: [['shoot1', 0], ['shoot2', 0.03], ['shoot1', 0.12]], gup: { fps: 14, frames: ['shootUp1', 'shootUp2'] }, gdown: [['jatk1', 0], ['jatk2', 0.03], ['jatk3', 0.14]],
    gaim: [['snipe', 0]], holster: [['reload', 0]], kick: [['kick1', 0], ['kick2', 0.08]], spinkick: { fps: 12, frames: ['sk1', 'sk2', 'kick3'] }, slide: [['slide1', 0], ['slide2', 0.06]],
    gthrow: [['throw1', 0], ['throw2', 0.26]], ghawk: [['hawk1', 0], ['hawk2', 0.3]], gatling: { fps: 20, frames: ['gat1', 'gat2'] }, gbuff: [['twirl', 0]],
    flame: [['flame', 0]], flashKick: [['knee1', 0], ['flash', 0.06]], stomp: [['stomp1', 0], ['stomp2', 0.12]], bbq: [['bbq', 0]],
    aimShot: [['multi', 0], ['shoot2', 0.3], ['shoot1', 0.4]], gunDance: { fps: 12, frames: ['rapid1', 'backshot', 'rapid2', 'dual'] },
    moveShot: { fps: 8, frames: ['move1', 'move2'] }, dualAim: [['dual', 0]],
    crazy: [['awk1', 0], ['crazy1', 0.9]], crazyAir: [['crazy2', 0]], crazyLand: [['crazy3', 0]],
    cannon: [['cannon1', 0]], cannonFire: [['cannon2', 0], ['cannon1', 0.25]], laser: [['laser1', 0]], laserFire: [['laser2', 0]], quantum: [['quantum', 0]],
    lAwk: [['lAwk1', 0]], lAwkFire: [['lAwk2', 0]] },
  mage: { ...BASE_ANIMS,
    atk1: [['m1_1', 0], ['m1_2', 0.06], ['m1_3', 0.14]], atk2: [['m2_1', 0], ['m2_2', 0.06], ['m2_3', 0.16]], dash: [['dash1', 0], ['dash2', 0.06]],
    mcast: [['cast1', 0], ['cast2', 0.12]], mup: [['castUp1', 0], ['castUp2', 0.1]], mdown: [['castDown1', 0], ['castDown2', 0.18]],
    mchan: { fps: 7, frames: ['chan1', 'chan2'] }, mjatk: [['jatk1', 0], ['jatk2', 0.08], ['jatk3', 0.2]],
    sky: [['sky1', 0], ['sky2', 0.11]], jack: [['jack1', 0], ['jack2', 0.2]], jackHold: [['jack1', 0]], eel: [['eel', 0]], fang: [['fang1', 0], ['fang2', 0.11]],
    cheer: [['cheer', 0]], cast3: [['cast3', 0]], summon: [['summon', 0]], palm: [['palm', 0], ['palm2', 0.09]],
    flameCast: [['castUp1', 0], ['flameC', 0.18]], void: [['void1', 0], ['void2', 0.25]], wall: [['wall', 0]], thunderCast: [['thunder', 0]], jackfall: [['jackfall', 0]],
    grip: [['palm', 0], ['grip', 0.15]], mAwk: [['awk', 0], ['mAwk1', 0.95], ['mAwk2', 1.6]],
    chaser: [['chaser', 0]], smash: [['smash1', 0]], smashDown: [['smash2', 0]], fangRush: { fps: 12, frames: ['fang2', 'fang1'] },
    raid: [['bmLeap2', 0]], bmLeap: [['bmLeap1', 0]], bmAwk: [['bmAwk', 0]] },
  monster: { ...BASE_ANIMS, run: seq('run', 8, 15), jumpUp: [['jump', 0]], jumpFall: [['jump', 0]], land: [['low1', 0]], back: [['jump', 0]],
    hit2: [['hit2', 0]], airUp: [['air', 0]], air: [['air', 0]], bounceUp: [['down', 0], ['air', 0.1]], down: [['down', 0]], held: [['hit2', 0]], tech: [['getup', 0]],
    club: [['atk1', 0], ['atk2', 0.15], ['atk3', 0.42], ['atk4', 0.6]], throw: [['atk1', 0], ['atk2', 0.15], ['atk3', 0.45], ['atk4', 0.6]],
    atk1: [['atk2', 0], ['atk3', 0.08], ['atk4', 0.18]], atk2: [['atk2', 0], ['atk3', 0.08], ['atk4', 0.18]],
    axe: [['atk1', 0], ['atk2', 0.2], ['atk3', 0.62], ['atk4', 0.85]], scratch: [['atk2', 0], ['atk3', 0.3], ['atk4', 0.45]], bite: [['atk2', 0], ['atk3', 0.3], ['atk4', 0.5]],
    slam: [['atk1', 0], ['atk2', 0.2], ['atk3', 0.7], ['atk4', 1.0]], pounce: [['low1', 0], ['jump', 0.35], ['low2', 0.6], ['atk4', 0.85]],
    chargeW: { fps: 3, frames: ['low1', 'low1'] }, charge: { fps: 8, frames: ['low2', 'low1'] }, roar: [['cast1', 0], ['cast2', 0.45]],
    cast: { fps: 5, frames: ['cast1', 'cast2'] }, heal: { fps: 5, frames: ['cast1', 'cast2'] } },
};
// 通用技能（后跳-强化等）挂到每个职业的技能表：这里所有职业 / 转职文件都已加载
addCommonSkills();
// 没有骨骼片段的动画自动补一个（时长覆盖所有帧，循环动画按帧数 / fps）
for (const c of ['sword', 'gun', 'mage']) {
  CLIPS[c] = CLIPS[c] || { ...HUMAN_CLIPS };
  for (const name in SPR_ANIMS[c]) {
    const A = SPR_ANIMS[c][name];
    if (!CLIPS[c][name]) CLIPS[c][name] = A.frames ? { dur: A.frames.length / A.fps, loop: true, keys: [k(0, POSE.idle)] } : { dur: A[A.length - 1][1] + 2, keys: [k(0, POSE.idle)] };
    else if (!A.frames && CLIPS[c][name].dur < A[A.length - 1][1] + 0.05) CLIPS[c][name] = { ...CLIPS[c][name], dur: A[A.length - 1][1] + 0.5 };
  }
}
// 怪物：重受击 / 被抓 / 上升浮空沿用已有的受击片段
for (const S of [GOB_CLIPS, BEAST_CLIPS]) { S.hit2 = S.hit2 || { ...S.hit }; S.held = S.held || { ...S.hit, dur: 9 }; S.airUp = S.airUp || { ...S.air }; S.bounceUp = S.bounceUp || { ...S.air }; }
// 兜底：姿势名 → 帧（没有列进动画表的片段用）
const SPR_FALLBACK = { idle: 'idle', idle2: 'idle', mIdle: 'idle', mIdle2: 'idle', hit: 'hit1', hit2: 'hit2', air: 'air', air2: 'air', down: 'down', getup: 'getup', tuck: 'roll', _: 'idle' };
for (const c of ['sword', 'gun', 'mage']) {
  const old = CLASSES[c].model;
  CLASSES[c].model = () => SPR_DATA[c] && IMG[`spr/${c}/idle`] ? new SpriteModel(c, SPR_FALLBACK, SPR_ANIMS[c]) : old();
}
for (const kk in MON_ART) {
  const [r, o] = MON_ART[kk]; if (!MON[kk] || !SPR_DATA[r]) continue;
  const old = MON[kk].model;
  MON[kk].model = () => IMG[`spr/${r}/idle`] ? new SpriteModel(r, { ...SPR_FALLBACK, cast: 'cast1', roar: 'cast2', crouch: 'low1' }, SPR_ANIMS.monster, o) : old();
}
