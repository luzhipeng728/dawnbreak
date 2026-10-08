// 竞拍邮件单测（不开浏览器）：在 Node VM 里抽出 src/net/coop.js 的 coop 对象，验证金币 / 物品竞拍邮件的持久化、领取与背包满时保留
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/net/coop.js', import.meta.url), 'utf8');
const start = source.indexOf('const coop = {');
if (start < 0) throw new Error('coop object not found');
const open = source.indexOf('{', start);
let depth = 0, quote = null, escaped = false, line = false, block = false, end = -1;
for (let i = open; i < source.length; i++) {
  const c = source[i], n = source[i + 1];
  if (line) { if (c === '\n') line = false; continue; }
  if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
  if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = null; continue; }
  if (c === '/' && n === '/') { line = true; i++; continue; }
  if (c === '/' && n === '*') { block = true; i++; continue; }
  if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
  if (c === '{') depth++;
  else if (c === '}' && --depth === 0) { end = i; break; }
}
if (end < 0) throw new Error('coop object end not found');

const added = [], ctx = {
  net: { user: { id: 7 } },
  game: { gold: 100 },
  bank: { gold: 0, load() {}, write() {} },
  RAID_CORE: { AUCTION_GOLD_CAP: 1000 },
  save: { live: true, data: { coopAuctionMail: [
    { sig: 'g1', kind: 'gold', amount: 250, claimed: false },
    { sig: 'i1', kind: 'item', item: { key: 'mail_sword', n: 1 }, claimed: false },
    { sig: 'done', kind: 'gold', amount: 9, claimed: true },
  ] }, writes: 0, write() { this.writes++; } },
  makeItem: (key, n, opt) => ({ key, n, ...opt }),
  inv: { add(it) { added.push(it); return true; } },
  bus: { emit() {} }, menus: { refresh() {} }, toastMsg() {},
};
vm.runInNewContext(`const coop = ${source.slice(open, end + 1)}; this.coop = coop;`, ctx);
const ok = (v, msg) => { if (!v) throw new Error(msg); console.log('✓', msg); };
ok(ctx.coop.auctionMailPending().length === 2, '竞拍邮件持久化后仍显示未领取条目');
ok(ctx.coop.claimAuctionMail('g1') && ctx.game.gold === 350, '金币竞拍邮件可领取到当前角色');
ok(ctx.coop.claimAuctionMail('i1') && added[0].key === 'mail_sword', '物品竞拍邮件可领取到背包');
ok(ctx.coop.auctionMailPending().length === 0 && ctx.save.writes === 2, '领取后邮件幂等标记并写入存档');
ctx.save.data.coopAuctionMail.push({ sig: 'full', kind: 'item', item: { key: 'mail_armor', n: 1 }, claimed: false });
ctx.inv.add = () => false;
ok(!ctx.coop.claimAuctionMail('full') && ctx.coop.auctionMailPending().some(x => x.sig === 'full'), '背包满时保留未领取邮件');
console.log('全部通过');
