/* =====================================================================
   诺斯玛尔 + 根特 5 个领主的机制常量（BOSS_PLAN B6）：机制 spec 里嵌套招式的要写成常量，组队时队员那边才有编号（BOSS_SPEC §7）
   用法见 gent.js 的 bosses；只有数据，没有钩子
   ===================================================================== */
const GENT_MZ_CHARGE = { use: 'stagger', windup: 3.2, need: 0.035, onBreak: 'groggy', say: '摩震蓄力了——打断它！',
  skill: { use: 'cone', ang: 110, len: 460, windup: 0.4, dur: 1.1, tick: 0.25, dmg: 0.5, status: 'curse', sdur: 5, col: '#b070ff' } };

const GENT_PIPER_NOTES = { use: 'stance', every: [11, 14], modes: [
  { id: 'orange', name: '橙色音符', col: '#ffa030', say: '橙色音符——鼠群冲锋！', atk: 1.12, skills: [
    { use: 'summon', id: 'rats', kind: 'giantRat', n: 3, max: 8, cd: [9, 12], w: 1.2, say: '♪ 过来吧，孩子们 ♪' },
    { use: 'lanes', id: 'ratrun', clip: 'sigA', kind: 'runner', runner: 'giantRat', lanes: 5, hit: 3, n: 2, gap: 1.0, speed: 900, windup: 1.1, cd: [9, 12], w: 1.4, say: '鼠群奔袭——找空道！' }] },
  { id: 'blue', name: '蓝色音符', col: '#6ab0ff', say: '蓝色音符——混乱之音！', speed: 0.85, skills: [
    { use: 'aoe', id: 'lullaby', shape: 'ring', at: 'self', r: 190, r0: 60, windup: 1.2, dmg: 1.0, status: 'confuse', sdur: 2, col: '#6ab0ff', cd: [7, 9], w: 1.6, say: '迷乱的旋律——跳出圈外' },
    { use: 'shot', id: 'confuseMoth', mode: 'homing', n: 3, spread: 60, speed: 230, turn: 2.2, dmg: 0.9, status: 'confuse', sdur: 1.5, col: '#8ac0ff', cd: [5, 7], w: 1.4 }] }] };

const GENT_SL_WHEELIE = { use: 'form', name: '竖轮', scale: 1.1, dur: 10, invulT: 0.6, say: '苏雷德竖起了前轮——留意脚下的圈！',
  skills: [{ use: 'leap', id: 'wheelie', clip: 'sigB', crouch: 0.25, up: 0.3, track: 0.5, fall: 0.5, r: 125, jump: true, dmg: 1.4, cd: [3.4, 4.4], say: '竖轮跳砸——跑出圈或跳起来！' }],
  land: { use: 'aoe', shape: 'circle', at: 'self', r: 150, windup: 0.9, dmg: 1.2 } };

const GENT_GT_STANCE = { use: 'stance', every: [12, 15], modes: [
  { id: 'move', name: '移动模式', col: '#ffb030', say: '移动模式：冲撞、乱射！', skills: ['ram', 'turret'] },
  { id: 'guard', name: '防御模式', col: '#6ab0ff', say: '防御模式：装甲大幅强化——量子爆弹锁定！', dmgTaken: 0.4, speed: 0.4, skills: ['quantum'] }] };
