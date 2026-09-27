/* =====================================================================
   34. 逐帧精灵：各职业 / 怪物的动画表（片段名 → 帧序列）；有素材时替换骨骼部件模型
   一次性动作写成 [[帧, 起始秒], ...]，循环动作写成 { fps, frames }
   ===================================================================== */
const seq = (pre, n, fps) => ({ fps, frames: Array.from({ length: n }, (_, i) => `${pre}${i + 1}`) });
const BASE_ANIMS = {
  idle: [['idle', 0]], walk: seq('walk', 8, 10), run: seq('run', 8, 16.7),
  jumpUp: [['jump2', 0]], jumpFall: [['jump3', 0], ['jump4', 0.12]], land: [['jump5', 0]], back: [['jump4', 0]],
  hit: [['hit1', 0], ['hit2', 0.1]], air: [['air', 0]], down: [['down', 0]], getup: [['down', 0], ['getup', 0.15]], roll: [['roll', 0]],
};
const SPR_ANIMS = {
  sword: { ...BASE_ANIMS,
    atk1: [['a1_1', 0], ['a1_2', 0.06], ['a1_3', 0.14]], atk2: [['a2_1', 0], ['a2_2', 0.06], ['a2_3', 0.16]], atk3: [['a3_1', 0], ['a3_2', 0.13]],
    dash: [['dash1', 0], ['dash2', 0.06]], jatk: [['jatk1', 0], ['jatk2', 0.07], ['jatk3', 0.18]],
    up: [['up1', 0], ['up2', 0.1], ['up3', 0.22]], rise: [['rise1', 0], ['rise2', 0.08]], a3slam: [['slam1', 0], ['slam2', 0.3]],
    iai: [['iai1', 0], ['iai2', 0.4]], awaken: [['awk1', 0], ['iai2', 0.95], ['awk2', 1.25]], flurry: { fps: 12.5, frames: ['stab1', 'stab2'] },
    spin: [['spin1', 0], ['spin2', 0.1], ['spin1', 0.3], ['spin2', 0.4]], focus: [['focus', 0]] },
  gun: { ...BASE_ANIMS,
    gshot: [['shoot1', 0], ['shoot2', 0.03], ['shoot1', 0.12]], gup: { fps: 14, frames: ['shootUp1', 'shootUp2'] }, gdown: [['jatk1', 0], ['jatk2', 0.03], ['jatk3', 0.14]],
    gaim: [['snipe', 0]], kick: [['kick1', 0], ['kick2', 0.08]], spinkick: { fps: 12, frames: ['sk1', 'sk2'] }, slide: [['slide1', 0], ['slide2', 0.06]],
    gthrow: [['throw1', 0], ['throw2', 0.26]], ghawk: [['hawk1', 0], ['hawk2', 0.3]], gatling: { fps: 20, frames: ['gat1', 'gat2'] }, gbuff: [['twirl', 0]],
    gawk: [['awk1', 0], ['awk2', 0.9]] },
  mage: { ...BASE_ANIMS,
    atk1: [['m1_1', 0], ['m1_2', 0.06], ['m1_3', 0.14]], atk2: [['m2_1', 0], ['m2_2', 0.06], ['m2_3', 0.16]], dash: [['dash1', 0], ['dash2', 0.06]],
    mcast: [['cast1', 0], ['cast2', 0.12]], mup: [['castUp1', 0], ['castUp2', 0.1]], mdown: [['castDown1', 0], ['castDown2', 0.18]],
    mchan: { fps: 7, frames: ['chan1', 'chan2'] }, mjatk: [['jatk1', 0], ['jatk2', 0.08], ['jatk3', 0.2]],
    mmeteor: [['castUp1', 0], ['meteor', 0.1]], mtornado: [['cast1', 0], ['tornado', 0.1]], mgrip: [['palm', 0], ['grip', 0.15]], mbuff: [['cheer', 0]],
    mawk: [['awk', 0], ['burst', 0.95]] },
  monster: { ...BASE_ANIMS, run: seq('run', 8, 15), jumpUp: [['jump', 0]], jumpFall: [['jump', 0]], land: [['low1', 0]], back: [['jump', 0]],
    club: [['atk1', 0], ['atk2', 0.15], ['atk3', 0.42], ['atk4', 0.6]], throw: [['atk1', 0], ['atk2', 0.15], ['atk3', 0.45], ['atk4', 0.6]],
    atk1: [['atk2', 0], ['atk3', 0.08], ['atk4', 0.18]], atk2: [['atk2', 0], ['atk3', 0.08], ['atk4', 0.18]],
    axe: [['atk1', 0], ['atk2', 0.2], ['atk3', 0.62], ['atk4', 0.85]], scratch: [['atk2', 0], ['atk3', 0.3], ['atk4', 0.45]], bite: [['atk2', 0], ['atk3', 0.3], ['atk4', 0.5]],
    slam: [['atk1', 0], ['atk2', 0.2], ['atk3', 0.7], ['atk4', 1.0]], pounce: [['low1', 0], ['jump', 0.35], ['low2', 0.6], ['atk4', 0.85]],
    chargeW: { fps: 3, frames: ['low1', 'low1'] }, charge: { fps: 8, frames: ['low2', 'low1'] }, roar: [['cast1', 0], ['cast2', 0.45]],
    cast: { fps: 5, frames: ['cast1', 'cast2'] }, heal: { fps: 5, frames: ['cast1', 'cast2'] } },
};
// 技能专属片段：让技能能选到自己的动作帧
CLIPS.sword.focus = { dur: 0.4, keys: [k(0, POSE.idle)] };
CLIPS.sword.rise = { ...CLIPS.sword.up };
CLIPS.sword.awaken = { ...CLIPS.sword.iai, dur: 1.6 };
CLIPS.gun.gbuff = { dur: 0.4, keys: [k(0, POSE.gAim)] };
CLIPS.gun.ghawk = { ...CLIPS.gun.gthrow };
CLIPS.gun.gawk = { dur: 2.5, keys: [k(0, POSE.gAim)] };
for (const [id, clip] of [['mmeteor', 'mup'], ['mtornado', 'mcast'], ['mgrip', 'mchan'], ['mbuff', 'mup'], ['mawk', 'mchan']]) CLIPS.mage[id] = { ...CLIPS.mage[clip], loop: false, dur: 2.6 };
const withClip = (id, clip) => { const fn = SKILLS[id].act; SKILLS[id].act = lv => ({ ...fn(lv), clip }); };
withClip('focus', 'focus'); withClip('rise', 'rise'); withClip('awaken', 'awaken'); withClip('g_buff', 'gbuff'); withClip('g_hawk', 'ghawk'); withClip('g_awaken', 'gawk');
withClip('mg_meteor', 'mmeteor'); withClip('mg_tornado', 'mtornado'); withClip('mg_hole', 'mgrip'); withClip('mg_buff', 'mbuff'); withClip('mg_awaken', 'mawk');
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
