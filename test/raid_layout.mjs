// 团本固定房间结构单测（不开浏览器）：genFixedLayout 的连通 / 准备房 / 随机领主房，希洛克团本每张图的官方房间数
import fs from 'fs'; import vm from 'vm';

const rd = f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const core = rd('engine/core.js'), mul = core.match(/function mulberry[^\n]+/)[0];
const ctx = {}; vm.runInNewContext(mul + '\n' + rd('game/dungeon.js') + '\nthis.genLayout = genLayout; this.genFixedLayout = genFixedLayout;', ctx);
// 内容文件：只要 defineDungeon 收到的数据（怪物 / 主题 / 美术这些全局用空函数顶替）
const DG = {}, stub = { regionTheme() {}, regionMonster() {}, MON_ART: {}, RAID_DEFS: { siroco: {} }, SIROCO_RAID_GEAR: [], defineDungeon: (id, d) => { DG[id] = { id, ...d }; } };
vm.runInNewContext(rd('content/raids/siroco_raid.js'), stub);
let fail = 0;
const ok = (c, msg, d) => { console.log((c ? '✓ ' : '✗ ') + msg + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 300))); if (!c) fail++; return c; };
const reach = L => { const seen = new Set([L.start]), q = [L.start]; while (q.length) { const r = q.shift(); for (const d in r.doors) if (!seen.has(r.doors[d])) { seen.add(r.doors[d]); q.push(r.doors[d]); } } return seen.size; };

// ---- 通用 ----
const line = ctx.genLayout({ fixed: { rooms: [{ at: [0, 0], prep: true }, { at: [1, 0] }, { at: [2, 0], type: 'elite', elite: 'x' }, { at: [3, 0], type: 'boss' }], start: 0, boss: 3 } }, 7);
ok(line.fixed && line.rooms.length === 4 && line.start.gx === 0 && line.boss.gx === 3 && line.boss.type === 'boss' && line.start.type === 'start', '直线：起点 / 领主房按写死的位置', line.rooms.map(r => r.type));
ok(line.rooms[1].doors.left === line.rooms[0] && line.rooms[1].doors.right === line.rooms[2] && !line.rooms[0].doors.left, '缺省按数组顺序串起来（左右门）');
ok(line.start.spec.prep && line.rooms[2].type === 'elite' && line.rooms[2].spec.elite === 'x', '房间参数（准备房 / 精英 kind）保留在 spec 上');
const one = ctx.genFixedLayout({ rooms: [{ at: [0, 0] }] }, 1);
ok(one.start === one.boss && one.boss.type === 'boss', '只有一个房间：进门就是领主房');
const same = s => { const L = ctx.genLayout({ fixed: { cols: 3, rows: 3, links: 'grid', rooms: Array.from({ length: 9 }, (_, i) => ({ at: [i % 3, Math.floor(i / 3)] })), start: [0, 2, 6, 8], boss: [1, 3, 5, 7] } }, s); return L.rooms.indexOf(L.start) + ':' + L.rooms.indexOf(L.boss); };
ok(same(42) === same(42) && new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(same)).size > 2, '同一个种子同一张图（组队全队一致），不同种子出生 / 领主房会变');

// ---- 希洛克团本每张图（docs/RAID_SIROCO.md §地图）----
const want = { raid_si_law: 5, raid_si_dawn: 5, raid_si_night: 10, raid_si_memory: 4, raid_si_mirror: 4, raid_si_gate_l: 3, raid_si_gate_r: 3, raid_si_sub: 8,
  raid_si_phantom: 7, raid_si_day: 5, raid_si_castle: 2, raid_si_deny: 3, raid_si_suppress: 16, raid_si_forget: 2, raid_si_truth_g: 3, raid_si_truth_l: 3, raid_si_truth_v: 3, raid_si_shadow: 1 };
for (const [id, n] of Object.entries(want)) {
  const D = DG[id]; if (!ok(D && D.fixed, `${id} 有固定房间结构`)) continue;
  const L = ctx.genLayout(D, 12345);
  ok(L.rooms.length === n && reach(L) === n, `${D.name}：${n} 个房间、全部连通`, { n: L.rooms.length, reach: reach(L) });
}
const law = ctx.genLayout(DG.raid_si_law, 3);
ok(law.start.spec.prep && law.rooms[2].type === 'elite' && law.rooms[2].spec.elite === 'siRaidMob_gate' && law.boss === law.rooms[4], '破坏之门：准备 / 小怪 / 门 / 小怪 / 守门人');
const nights = [...Array(60).keys()].map(s => ctx.genLayout(DG.raid_si_night, s * 977 + 1));
const starts = new Set(nights.map(L => L.rooms.indexOf(L.start))), bosses = new Set(nights.map(L => L.rooms.indexOf(L.boss)));
ok([...starts].every(i => [0, 4, 5, 9].includes(i)) && starts.size === 4, '噩梦之夜：出生在四角（1 / 5 / 6 / 10）', [...starts]);
ok([...bosses].every(i => [1, 2, 3, 6, 7, 8].includes(i)) && bosses.size >= 5, '噩梦之夜：领主随机在 2 / 3 / 4 / 7 / 8 / 9', [...bosses]);
ok(nights.every(L => L.hideBoss && L.rooms.filter(r => r.type === 'boss').length === 1), '噩梦之夜：只有一个领主房，小地图不提前标出');
ok(nights.every(L => L.rooms.filter(r => r.spec.prep).length === 4), '噩梦之夜：四角都是空房');
const gr = ctx.genLayout(DG.raid_si_gate_r, 1);
ok(gr.start.gx === 2 && gr.boss.gx === 0 && gr.start.doors.left, '无形之门 2（奈克斯）：左右镜像，从右往左走');
const ph = ctx.genLayout(DG.raid_si_phantom, 2);
ok(ph.rooms[2].type === 'elite' && ph.rooms[2].spec.elite === 'siRaidMob_kula' && ph.rooms[4].spec.elite === 'siRaidMob_tanna' && ph.boss === ph.rooms[6], '幻影之界：准备 / 小怪 / 崔拉 / 小怪 / 昙娜 / 小怪 / 崔拉 & 昙娜');
const sups = [...Array(40).keys()].map(s => ctx.genLayout(DG.raid_si_suppress, s * 53 + 7));
ok(sups.every(L => [3, 7, 11, 15, 14, 13, 12].includes(L.rooms.indexOf(L.boss)) && L.hideBoss) && new Set(sups.map(L => L.rooms.indexOf(L.boss))).size >= 5, '压抑：4×4 迷雾，领主随机在外圈“┛”的 7 个房间');
const sh = ctx.genLayout(DG.raid_si_shadow, 1);
ok(sh.rooms.length === 1 && sh.start === sh.boss, '阴影之棺：进门就是领主房');
const subs = [...Array(40).keys()].map(s => ctx.genLayout(DG.raid_si_sub, s * 31 + 5));
ok(subs.every(L => L.rooms.indexOf(L.start) === 0 && L.boss !== L.start) && new Set(subs.map(L => L.rooms.indexOf(L.boss))).size >= 5, '无欲之棺：领主每次进图随机，不在准备房');
const mobs = new Set(Object.values(DG).flatMap(D => (D.mobs || []).map(m => m[0])));
ok([...mobs].every(k => /^siRaidMob_(grimFollower|grimWarrior|grimElder|sirocoShard)$/.test(k)), '小怪池只有格里姆希克教徒系 + 希洛克的碎片', [...mobs]);
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
