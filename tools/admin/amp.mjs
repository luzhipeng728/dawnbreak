// 把某个角色身上的装备（武器 / 防具 / 首饰 / 特殊装备，不含称号和时装）全部改成“增幅 +N、红字 = 主属性”，耐久补满
// 用法（一般由 admin.sh amp 调用）：node tools/admin/amp.mjs <工作目录> <角色名> <等级> [红字 str|int|vit|spr]
//   <工作目录>/cloud.json（{ data }）→ <工作目录>/maxed.json
// 规则同游戏：增幅过的装备不能再强化，增幅等级同时提供同级强化的加成 + 红字（src/game/gear.js）
import fs from 'fs';
const [W, name, lvArg, statArg] = process.argv.slice(2);
const lv = +lvArg, stat = statArg || 'str';
if (!W || !name || !(lv >= 1 && lv <= 16) || !['str', 'int', 'vit', 'spr'].includes(stat)) { console.error('用法：amp.mjs <工作目录> <角色名> <1~16> [str|int|vit|spr]'); process.exit(1); }
const cloud = JSON.parse(fs.readFileSync(W + '/cloud.json', 'utf8')), d = cloud.data;
const c = (d.chars || []).find(x => x && x.name === name);
if (!c) { console.error('没有这个角色：' + name + '（现有：' + d.chars.map(x => x.name).join('、') + '）'); process.exit(1); }
const SKIP = s => s === 'title' || s.startsWith('av_');
const changed = [];
for (const [slot, it] of Object.entries(c.equip || {})) {
  if (!it || SKIP(slot)) continue;
  it.dim = it.dim || stat; it.enh = Math.max(it.enh || 0, lv);
  if (it.durMax) it.dur = it.durMax;
  changed.push(`${slot}:${it.key}+${it.enh}(${it.dim})`);
}
fs.writeFileSync(W + '/maxed.json', JSON.stringify(d));
console.log(`${name}：${changed.length} 件 → ${changed.join('，')}`);
