/* =====================================================================
   奥兹玛专属谜题原语（docs/RAID_OZMA.md §6）：往 RAID_MECH.PUZ 登记，不改 raid_mech.js（那是共享文件）。
   - doors 次元之门：阿斯特罗斯。三扇门，她依次穿过其中两扇（头顶显示 1、2），读条结束时只有站在她没穿过的那扇门里的人躲得过秒杀；
     至少一人躲进 = 解开（阿斯特罗斯虚弱），没有人躲进 = 失败（灭团）【原创：官方门的判定规则未核实】
   加载顺序：raid_mech.js 之后。
   ===================================================================== */
(() => {
  if (typeof RAID_MECH === 'undefined' || !RAID_MECH.PUZ) return;
  const { shuffle, gdist } = RAID_MECH, P = st => st.pl || (st.pl = {});
  const hurt = (st, who, frac, why) => st.out.push({ k: 'hurt', who, frac, why, down: true });
  RAID_MECH.PUZ.doors = { id: 'doors', survive: true, defaults: { windup: 6, r: 78, hurt: 1, peek: 3.2, dur: 6.2 }, name: '次元之门', hint: '躲进阿斯特罗斯最后没穿过的那扇门',
    init(p, R, C) {
      const safe = Math.floor(R() * 3), order = shuffle([0, 1, 2].filter(k => k !== safe), R);
      return { safe, order, done: false, marks: [0, 1, 2].map(k => ({ x: Math.round(C.W * (0.22 + 0.28 * k)), y: Math.round(C.D * 0.5), r: p.r, col: '#8a8aff', label: '门', on: true, k })) };
    },
    on(st, p, ev) { if (ev.k === 'pos') P(st)[ev.who] = { x: ev.x, y: ev.y }; },
    tick(st, p) {
      const show = st.t < p.peek;
      st.marks.forEach((m, k) => { const i = st.order.indexOf(k); m.label = show ? (i >= 0 ? `穿过 ${i + 1}` : '？') : '门'; m.col = show ? (i >= 0 ? '#ffb070' : '#8a8aff') : '#8a8aff'; });
      if (st.done || st.t < p.windup) return; st.done = true; let inn = 0;
      for (const w in P(st)) { if (gdist(st.pl[w], st.marks[st.safe]) < st.marks[st.safe].r) inn++; else hurt(st, w, p.hurt, 'doors'); }
      st.marks.forEach((m, k) => { m.col = k === st.safe ? '#7aff9a' : '#ff4a4a'; m.label = k === st.safe ? '安全' : '虚空'; });
      st.res = inn ? 'solve' : 'fail';
    },
    text: st => st.t < st.p.peek ? '记住她穿过的两扇门' : '躲进没穿过的那扇！' };
})();
