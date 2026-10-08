/* 奥兹玛团本规则与内容清单（纯 JS；浏览器 / 服务端 / Node 共用）。
   地图、每图小怪、门将、领主攻击和机制均是数据；状态机只负责推进、失败和协作校验。
   P1 为毁灭 / 绝望 / 恐怖三大区域，P2 为埃利诺、阿尔米斯、王座最终战。
   时间、随机和事件数据全部由调用方传入，便于服务端重放和纯 Node 测试。 */
const OZMA_CORE = (() => {
  const MAX = 12, PHASE_LIMIT = [1800, 1200], REGIONS = ['ruin', 'despair', 'terror'];
  const difficulty = Object.freeze({
    normal: { hp: 1, atk: 1, timer: 1, sanity: 1 },
    heroic: { hp: 1.35, atk: 1.2, timer: 0.9, sanity: 1.2 },
    legend: { hp: 1.75, atk: 1.45, timer: 0.8, sanity: 1.5 },
  });
  const map = (id, name, mobs, gatekeeper, boss, phases, mechanics, opt = {}) => ({ id, name, mobs, gatekeeper, boss,
    waves: opt.waves || [mobs.slice(0, 2), mobs.slice(2)], phases, mechanics, fail: { wipeLimit: 3, timeout: opt.timeout || 300, ...opt.fail } });
  // 官方地图名保留英文副标题，便于和当前版本攻略 / 服务器日志一一对应。
  const CONTENT = Object.freeze({
    areas: {
      ruin: { name: '毁灭区域 Ruin', camp: { id: 'ruin_camp', name: '毁灭营地' }, oracle: { id: 'oracle_ruin', name: 'Oracle Tower' }, maps: [
        map('ruin_path', '毁灭之路 · Path to Ruin', ['混沌骑士', '堕落祭司', '黑焰弓手'], '毁灭门将', '毁灭之王卡赞', [{ at: 1, name: '黑焰横扫', attacks: ['sweep', 'chain'] }, { at: .55, name: '地狱裂隙', attacks: ['rift', 'meteor'] }], [{ id: 'cross', prompt: '交叉站位躲避黑焰', punish: 'wipe' }, { id: 'chain', prompt: '切断锁链后进入破防', punish: 'groggy' }]),
        map('ruin_resting', '毁灭之路 · Resting Place', ['休眠尸骸', '深渊凝视者', '黑暗咏唱者'], '休眠门将', '沉睡的卡赞残影', [{ at: 1, name: '沉眠脉冲', attacks: ['pulse', 'orb'] }, { at: .5, name: '梦魇反转', attacks: ['reverse', 'fear'] }], [{ id: 'silence', prompt: '打断咏唱者，否则全队沉默', punish: 'sanity' }]),
        map('ruin_beyond', '毁灭之路 · Beyond Chaos Gate', ['超越者', '血刃卫士', '裂界幼体'], '超越门将', '超越者卡赞', [{ at: 1, name: '血刃三连', attacks: ['dash', 'slash'] }, { at: .4, name: '裂界爆发', attacks: ['portal', 'burst'] }], [{ id: 'portal', prompt: '两队同时关闭裂界', punish: 'revive' }]),
        map('ruin_gladden', '毁灭之路 · Gladden Plain of Ruin', ['狂欢恶魔', '黑羽猎犬', '混沌舞者'], '狂欢门将', '欢愉之阿斯特罗斯', [{ at: 1, name: '狂欢追击', attacks: ['chase', 'trap'] }, { at: .6, name: '黑羽雨', attacks: ['feather', 'floor'] }], [{ id: 'dance', prompt: '按顺序踩亮四个符文', punish: 'damage' }]),
        map('ruin_corridor', '毁灭之路 · Corridor of Dead', ['走廊守卫', '裂隙魔像', '暗影祭司'], '走廊门将', '毁灭终点守卫', [{ at: 1, name: '长廊炮击', attacks: ['laser', 'charge'] }, { at: .35, name: '终末封锁', attacks: ['seal', 'nova'] }], [{ id: 'seal', prompt: '分队同时站住两侧封印', punish: 'wipe' }]),
      ] },
      despair: { name: '绝望区域 Despair', camp: { id: 'despair_camp', name: '绝望营地' }, oracle: { id: 'oracle_despair', name: 'Oracle Tower' }, maps: [
        map('despair_crossroads', '绝望之路 · Crossroads of Despair', ['绝望行刑者', '迷途骑士', '腐化法师'], '十字门将', '绝望之阿斯特罗斯', [{ at: 1, name: '十字斩', attacks: ['cross', 'dash'] }, { at: .5, name: '绝望标记', attacks: ['mark', 'orb'] }], [{ id: 'mark', prompt: '被标记队员远离队伍', punish: 'damage' }]),
        map('despair_aventus', '绝望之路 · Aventus Cradle', ['阿文图斯卫兵', '炽焰术士', '绝望幼兽'], '阿文图斯门将', '阿文图斯', [{ at: 1, name: '炽焰轰击', attacks: ['flame', 'rain'] }, { at: .45, name: '焚城', attacks: ['wall', 'burn'] }], [{ id: 'flame', prompt: '把火种引到门将身上', punish: 'enrage' }]),
        map('despair_phylis', '绝望之路 · Phylis Path', ['菲利斯亡魂', '腐朽骑士', '悲鸣蝙蝠'], '菲利斯门将', '悲鸣之菲利斯', [{ at: 1, name: '亡魂召来', attacks: ['summon', 'scream'] }, { at: .5, name: '悲鸣锁链', attacks: ['chain', 'fear'] }], [{ id: 'scream', prompt: '躲入安全区再打断悲鸣', punish: 'sanity' }]),
        map('despair_lunen', '绝望之路 · Lunen Silent Forest', ['月蚀猎手', '黑月法师', '月影兽'], '月蚀门将', '月蚀之鲁恩', [{ at: 1, name: '月影切割', attacks: ['moon', 'slash'] }, { at: .35, name: '月蚀循环', attacks: ['dark', 'light'] }], [{ id: 'eclipse', prompt: '按光暗相反属性击破护罩', punish: 'heal' }]),
        map('despair_serha', '绝望之路 · Serha Grief Swamp', ['塞赫拉教徒', '破戒骑士', '混沌使徒'], '塞赫拉门将', '塞赫拉', [{ at: 1, name: '教团审判', attacks: ['judgement', 'orb'] }, { at: .25, name: '混沌宣言', attacks: ['nova', 'seal'] }], [{ id: 'judgement', prompt: '队伍分担审判光柱', punish: 'wipe' }]),
      ] },
      terror: { name: '恐怖区域 Terror', camp: { id: 'terror_camp', name: '恐怖营地' }, oracle: { id: 'oracle_terror', name: 'Oracle Tower' }, maps: [
        map('terror_land', '恐怖之路 · Land of Terror', ['恐怖掠夺者', '黑土魔像', '地狱花'], '大地门将', '恐怖之地', [{ at: 1, name: '大地震裂', attacks: ['quake', 'rock'] }, { at: .5, name: '地刺牢笼', attacks: ['spike', 'cage'] }], [{ id: 'quake', prompt: '跳跃躲开连续震波', punish: 'damage' }]),
        map('terror_grauben', '恐怖之路 · Grauben Sanctum', ['格劳本卫兵', '爆裂傀儡', '黑火炮台'], '格劳本门将', '格劳本', [{ at: 1, name: '炮台齐射', attacks: ['cannon', 'laser'] }, { at: .4, name: '傀儡自爆', attacks: ['summon', 'explode'] }], [{ id: 'cannon', prompt: '优先拆除炮台再输出 Boss', punish: 'damage' }]),
        map('terror_eldfell', '恐怖之路 · Eldfell Infernal Gorge', ['艾德菲尔火灵', '熔岩兽', '灰烬祭司'], '熔火门将', '艾德菲尔', [{ at: 1, name: '熔火洪流', attacks: ['lava', 'wave'] }, { at: .45, name: '灰烬陨落', attacks: ['meteor', 'burn'] }], [{ id: 'lava', prompt: '按队伍编号顺序踩灭熔岩点', punish: 'enrage' }]),
        map('terror_martyr', '恐怖之路 · Martyr’s Chapel', ['殉道者', '罪火骑士', '哭泣灵魂'], '殉道门将', '殉道者', [{ at: 1, name: '殉道誓言', attacks: ['sacrifice', 'chain'] }, { at: .3, name: '罪火审判', attacks: ['cross', 'fire'] }], [{ id: 'sacrifice', prompt: '由指定队员承受誓言伤害', punish: 'sanity' }]),
        map('terror_red_altar', '恐怖之路 · Red Altar of Paradise', ['红祭司', '血色魔像', '祭坛守卫'], '红色祭坛门将', '红色祭坛之主', [{ at: 1, name: '祭坛献祭', attacks: ['altar', 'drain'] }, { at: .2, name: '血色终焉', attacks: ['blood', 'nova'] }], [{ id: 'altar', prompt: '三队同时占领祭坛', punish: 'wipe' }]),
      ] },
    },
    final: [
      map('p2_elerinon', '埃利诺 Elerinon', ['埃利诺侍从', '混沌骑士', '黑雾祭司'], '埃利诺门将', '埃利诺', [{ at: 1, name: '黑雾连斩', attacks: ['slash', 'mist'] }, { at: .5, name: '内心世界', attacks: ['inner', 'fear'] }], [{ id: 'inner', prompt: '至少两队进入 Inner World 救援', punish: 'sanity' }]),
      map('p2_armis', '阿尔米斯 Armis', ['阿尔米斯卫兵', '毁灭炮手', '灵魂缚者'], '阿尔米斯门将', '阿尔米斯', [{ at: 1, name: '王座炮火', attacks: ['cannon', 'orb'] }, { at: .45, name: '灵魂锁定', attacks: ['lock', 'laser'] }], [{ id: 'lock', prompt: '队员互相打断锁定', punish: 'wipe' }]),
      map('p2_throne', '混沌王座 Throne', ['王座守卫', '混沌使徒', '奥兹玛残响'], '王座门将', '混沌之奥兹玛', [{ at: 1, name: '王座审判', attacks: ['judgement', 'nova'] }, { at: .6, name: '混沌领域', attacks: ['field', 'clone'] }, { at: .2, name: '终焉爆发', attacks: ['enrage', 'wipe'] }], [{ id: 'field', prompt: '三队分摊领域并轮换', punish: 'damage' }, { id: 'wipe', prompt: '同时打断终焉读条', punish: 'wipe' }], { timeout: 600 }),
    ],
  });
  const MAPS = Object.freeze([...REGIONS.flatMap(r => CONTENT.areas[r].maps), ...CONTENT.final]);
  const MAP_BY_ID = Object.fromEntries(MAPS.map(m => [m.id, m]));
  const REGION_BY_MAP = Object.fromEntries(REGIONS.flatMap(r => CONTENT.areas[r].maps.map(m => [m.id, r])));
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h | 0; };
  const rnd = S => { let t = S.seed = (S.seed + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const active = S => S.members.filter(m => m.online && !m.dead);
  const mapState = (S, id) => S.maps && S.maps[id];
  const openFirstMaps = S => { for (const id of REGIONS) { const M = CONTENT.areas[id].maps[0]; if (M && S.regions[id].st !== 'cleared') S.maps[M.id].st = 'open'; } };
  function init(members, now = 0, opt = {}) {
    if (!Array.isArray(members) || !members.length || members.length > MAX) throw new Error('奥兹玛团本需要 1~12 名队员');
    const diff = difficulty[opt.difficulty] ? opt.difficulty : 'normal';
    return { v: 2, raid: 'ozma', difficulty: diff, scale: difficulty[diff], st: 'lobby', phase: -1, phaseT0: 0, deadline: 0, created: now,
      members: members.map((m, i) => ({ uid: m.uid, name: m.name || '', cls: m.cls || null, job: m.job || null, role: m.role || null, online: m.online !== false, sanity: 100, inner: false, dead: false, ready: i === 0 })),
      regions: Object.fromEntries(REGIONS.map(id => [id, { st: 'locked', chaos: 0, clear: 0 }])),
      maps: Object.fromEntries(MAPS.map(m => [m.id, { st: 'locked', wave: 0, phase: 0, attack: 0, wipes: 0, opened: 0, clear: 0, mechanic: null }])),
      oracle: { uses: 0, last: 0 }, throne: { hp: 1, max: 1, enrage: false, groggy: 0, attack: 0 },
      sanity: 100, inner: false, innerCount: 0, phase2: false, seed: opt.seed == null ? hash(now) : opt.seed | 0,
      flips: [], rewardSeed: opt.rewardSeed || String(now), events: [] };
  }
  function start(S, now, out = []) {
    if (S.st !== 'lobby' || !S.members.every(m => m.ready)) return { err: '队员尚未准备好' };
    S.st = 'routes'; S.phase = 0; S.phaseT0 = now; S.deadline = now + PHASE_LIMIT[0] * 1000 / S.scale.timer; openFirstMaps(S);
    out.push({ kind: 'phase', phase: 1, deadline: S.deadline, sanity: 100, maps: MAPS.filter(m => S.maps[m.id].st === 'open').map(m => m.id) }); return { out };
  }
  function sanityLoss(S, n, out) {
    if (S.st === 'failed' || S.st === 'cleared') return;
    S.sanity = Math.max(0, S.sanity - Math.max(0, n) * S.scale.sanity);
    if (S.sanity > 0 || S.inner) return;
    S.inner = true; S.innerCount++; S.sanity = 50; out.push({ kind: 'inner', count: S.innerCount });
    for (const m of S.members) { m.inner = true; m.dead = false; }
    if (S.innerCount >= 2) { S.st = 'failed'; out.push({ kind: 'wipe', reason: 'sanity' }); }
  }
  function clearRegion(S, id, now, out, chaos) {
    const R = S.regions[id]; if (!R || R.st === 'cleared') return false;
    R.st = 'cleared'; R.clear = now; R.chaos = Math.min(3, Math.max(0, (chaos == null ? R.chaos : chaos) | 0));
    for (const M of CONTENT.areas[id].maps) { const Q = S.maps[M.id]; Q.st = 'cleared'; Q.clear = now; Q.wave = M.waves.length; Q.phase = M.phases.length; }
    out.push({ kind: 'region', id, chaos: R.chaos }); return true;
  }
  function failMap(S, M, Q, out, reason) {
    Q.wipes++; Q.mechanic = reason || null; S.sanity = Math.max(0, S.sanity - S.scale.sanity * 10);
    out.push({ kind: 'mapFail', id: M.id, wipes: Q.wipes, reason: reason || 'mechanic' });
    const region = REGION_BY_MAP[M.id]; if (Q.wipes >= M.fail.wipeLimit && region) { S.regions[region].chaos = Math.min(3, (S.regions[region].chaos || 0) + 1); out.push({ kind: 'chaos', id: region, value: S.regions[region].chaos }); }
    Q.st = 'open'; Q.wave = 0; Q.phase = 0;
  }
  function event(S, ev, now) {
    const out = [], fail = text => ({ out, err: text });
    if (!S || S.st === 'failed' || (S.st === 'cleared' && ev.t !== 'flip')) return fail('团本已结束');
    if (ev.t === 'start') return start(S, now, out);
    if (ev.t === 'sanity') { sanityLoss(S, ev.n || 0, out); return { out }; }
    if (ev.t === 'recover') { if (S.inner) S.inner = false; S.sanity = Math.min(100, S.sanity + Math.max(0, ev.n || 0)); out.push({ kind: 'sanity', value: S.sanity }); return { out }; }
    if (ev.t === 'clearRegion') { if (!REGIONS.includes(ev.id)) return fail('区域不可用'); if (!clearRegion(S, ev.id, now, out, ev.chaos)) return fail('区域不可用');
      if (S.phase === 0 && REGIONS.every(id => S.regions[id].st === 'cleared')) { S.phase = 1; S.phase2 = true; S.phaseT0 = now; S.deadline = now + PHASE_LIMIT[1] * 1000 / S.scale.timer; for (const M of CONTENT.final) S.maps[M.id].st = 'open'; out.push({ kind: 'phase', phase: 2, deadline: S.deadline }); } return { out }; }
    if (ev.t === 'enterMap') {
      const M = MAP_BY_ID[ev.id], Q = M && mapState(S, ev.id); if (!M || !Q || Q.st !== 'open') return fail('地图不可进入');
      if (M.id.startsWith('p2_') && !S.phase2) return fail('最终阶段尚未解锁');
      Q.st = 'busy'; Q.opened = now; Q.mechanic = null; out.push({ kind: 'mapEnter', id: M.id, mobs: M.mobs, gatekeeper: M.gatekeeper, boss: M.boss }); return { out };
    }
    if (ev.t === 'mapWave') {
      const M = MAP_BY_ID[ev.id], Q = M && mapState(S, ev.id); if (!M || !Q || Q.st !== 'busy') return fail('地图不在战斗中');
      if (ev.success === false) { failMap(S, M, Q, out, 'wave'); return { out }; }
      if (Q.wave >= M.waves.length) return fail('小怪波次已经清完');
      Q.wave++; out.push({ kind: 'wave', id: M.id, wave: Q.wave, total: M.waves.length, mobs: M.waves[Q.wave - 1] }); return { out };
    }
    if (ev.t === 'bossAttack') {
      const M = MAP_BY_ID[ev.id], Q = M && mapState(S, ev.id); if (!M || !Q || Q.st !== 'busy' || Q.wave < M.waves.length) return fail('请先清理小怪');
      const B = M.phases[Math.min(Q.phase, M.phases.length - 1)], attack = B.attacks[Q.attack++ % B.attacks.length]; out.push({ kind: 'bossAttack', id: M.id, phase: Q.phase + 1, name: B.name, attack }); return { out };
    }
    if (ev.t === 'bossPhase' || ev.t === 'mechanic') {
      const M = MAP_BY_ID[ev.id], Q = M && mapState(S, ev.id); if (!M || !Q || Q.st !== 'busy' || Q.wave < M.waves.length) return fail('请先清理小怪');
      const mech = M.mechanics[ev.mechanic || Q.phase] || M.mechanics[0]; if (!mech) return fail('机制不存在');
      if (ev.success === false) { failMap(S, M, Q, out, mech.punish); return { out }; }
      Q.mechanic = mech.id; Q.phase++; out.push({ kind: 'mechanic', id: M.id, mechanic: mech.id, phase: Q.phase, groggy: true }); return { out };
    }
    if (ev.t === 'mapClear') {
      const M = MAP_BY_ID[ev.id], Q = M && mapState(S, ev.id); if (!M || !Q || Q.st !== 'busy') return fail('地图不在战斗中');
      if (Q.wave < M.waves.length || Q.phase < M.phases.length) return fail('领主机制尚未完成');
      Q.st = 'cleared'; Q.clear = now; out.push({ kind: 'mapClear', id: M.id, boss: M.boss });
      const region = REGION_BY_MAP[M.id]; if (region) {
        const all = CONTENT.areas[region].maps.every(x => S.maps[x.id].st === 'cleared');
        if (all) clearRegion(S, region, now, out, S.regions[region].chaos);
        if (S.phase === 0 && REGIONS.every(id => S.regions[id].st === 'cleared')) {
          S.phase = 1; S.phase2 = true; S.phaseT0 = now; S.deadline = now + PHASE_LIMIT[1] * 1000 / S.scale.timer;
          for (const F of CONTENT.final) S.maps[F.id].st = 'open';
          out.push({ kind: 'phase', phase: 2, deadline: S.deadline });
        }
      }
      return { out };
    }
    if (ev.t === 'mapFail') { const M = MAP_BY_ID[ev.id], Q = M && mapState(S, ev.id); if (!M || !Q || Q.st !== 'busy') return fail('地图不在战斗中'); failMap(S, M, Q, out, ev.reason || 'wipe'); return { out }; }
    if (ev.t === 'oracle') {
      if (S.oracle.uses >= 3) return fail('Oracle Tower 已使用 3 次');
      S.oracle.uses++; S.oracle.last = now; out.push({ kind: 'oracle', uses: S.oracle.uses });
      if (S.oracle.uses === 3) { for (const id of REGIONS) if (S.regions[id].st === 'cleared') S.regions[id].st = 'open'; S.sanity = Math.max(S.sanity, 50); out.push({ kind: 'oracleReset' }); }
      return { out };
    }
    if (ev.t === 'bossDamage') {
      if (!S.phase2) return fail('最终 Boss 尚未解锁');
      const d = Math.max(0, Number(ev.amount) || 0) * (S.throne.groggy > now ? 1.6 : 1) / S.scale.hp;
      S.throne.hp = Math.max(0, S.throne.hp - d); out.push({ kind: 'bossHp', hp: S.throne.hp });
      if (!S.throne.hp) { S.st = 'cleared'; out.push({ kind: 'clear' }); } return { out };
    }
    if (ev.t === 'groggy') { S.throne.groggy = now + Math.max(1, ev.seconds || 10) * 1000; out.push({ kind: 'groggy', until: S.throne.groggy }); return { out }; }
    if (ev.t === 'flip') { if (S.st !== 'cleared' || S.flips.length >= 3) return fail('翻牌不可用'); const card = reward(S, S.flips.length); S.flips.push(card); out.push({ kind: 'flip', card }); return { out }; }
    return fail('未知团本事件');
  }
  function tick(S, now) {
    const out = []; if (!S || S.st === 'failed' || S.st === 'cleared') return { out };
    if (S.deadline && now >= S.deadline) { S.st = 'failed'; out.push({ kind: 'wipe', reason: 'timeout' }); return { out }; }
    if (S.phase2 && !S.throne.enrage && now - S.phaseT0 >= 900000 / S.scale.timer) { S.throne.enrage = true; out.push({ kind: 'enrage', damage: 1.35 * S.scale.atk }); }
    if (!active(S).length) { S.st = 'failed'; out.push({ kind: 'wipe', reason: 'party' }); }
    return { out };
  }
  function reward(S, i) { const r = rnd(S), pool = r < 0.55 ? 'chaos' : r < 0.82 ? 'material' : r < 0.96 ? 'epic' : 'mythic'; return { slot: i + 1, pool, amount: pool === 'material' ? 2 + Math.floor(rnd(S) * 4) : 1, seed: `${S.rewardSeed}:${i}` }; }
  return { MAX, PHASE_LIMIT, REGIONS, CONTENT, MAPS, MAP_BY_ID, difficulty, init, start, event, tick, reward };
})();
