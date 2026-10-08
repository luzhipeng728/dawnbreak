// 团本拾取规则单测（不开浏览器）：队长分配 / 随机分配 / 竞拍三种拾取方式的权限与结算
import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync(new URL('../src/game/raid_core.js', import.meta.url), 'utf8') + '\nthis.RAID_CORE = RAID_CORE;';
const ctx = {};
vm.runInNewContext(src, ctx);
const R = ctx.RAID_CORE;
let failed = 0;
const ok = (v, msg) => { if (!v) { failed++; console.error('  ✗', msg); } else console.log('  ✓', msg); };

const S = R.init('siroco', [{ uid: 1, name: '队长' }, { uid: 2, name: '队员' }], 'normal', 0, { sid: 'test' });
ok(R.setLootMode(S, 2, 'random').code === 'leader', '只有队长可改拾取方式');
ok(R.setLootMode(S, 1, 'leader').ok && R.lootMode(S) === 'leader', '队长分配模式写入大厅');
const leaderDrop = R.lootOffer(S, { key: 'ep_test', n: 1 }, 1, 1);
ok(leaderDrop.ok && leaderDrop.offer.status === 'pending', '队长分配掉落进入待分配池');
ok(R.lootAssign(S, 2, leaderDrop.offer.id, 2, 2).code === 'leader', '队员不能越权分配');
ok(R.lootAssign(S, 1, leaderDrop.offer.id, 2, 2).offer.winner === 2, '队长可将掉落分给指定队员');
ok(R.setLootMode(S, 1, 'random').ok, '随机分配模式可切换');
const randomDrop = R.lootOffer(S, { key: 'ep_random', n: 1 }, 1, 3);
ok(randomDrop.offer.status === 'awarded' && [1, 2].includes(randomDrop.offer.winner), '随机分配立即决定在线队员');
ok(R.setLootMode(S, 1, 'auction').ok, '竞拍模式可切换');
const auction = R.lootOffer(S, { key: 'ep_auction', n: 1 }, 1, 4);
R.lootBid(S, 1, auction.offer.id, 30, 5); R.lootBid(S, 2, auction.offer.id, 50, 6);
ok(R.lootResolve(S, auction.offer.id, 7).offer.winner === '2', '竞拍按最高出价归属');
ok(R.setLootMode(S, 1, 'owner').ok, '归属模式可切换');

S.res.phases = [1]; S.flip = { state: 'ready', phase: 1, openedAt: 0, closedAt: 0, cards: {} };
ok(R.flipOpen(S, 1, 1, 10).ok, 'P1 翻牌窗口可打开');
ok(R.flipPick(S, 1, 1, 0, 11, () => 0.1).ok, 'P1 可选择第一张牌');
ok(R.flipPick(S, 1, 1, 1, 12, () => 0.1).code === 'limit', 'P1 只能选择 1 张牌');
ok(R.flipClose(S, 1, 1, 13).ok, 'P1 选满后才能关闭翻牌');
ok(R.flipOpen(S, 2, 1, 14).ok, '队友可在另一名队员关闭后继续翻牌');
ok(R.flipPick(S, 2, 1, 1, 15, () => 0.1).ok && R.flipClose(S, 2, 1, 16).ok, '队友完成自己的 P1 翻牌后再共同锁定');
S.res.phases = [1, 2]; S.flip = { state: 'ready', phase: 2, openedAt: 0, closedAt: 0, cards: {} };
ok(R.flipOpen(S, 1, 2, 20).ok, 'P2 翻牌窗口可打开');
ok(R.flipPick(S, 1, 2, 0, 21, () => 0.2).ok && R.flipPick(S, 1, 2, 1, 22, () => 0.2).ok, 'P2 可选择两张牌');
ok(!R.flipPick(S, 1, 2, 2, 23, () => 0.2).ok, 'P2 超过 2 张被拒绝');
ok(R.flipClose(S, 1, 2, 24).ok && S.flip.cards['1'].closedAt, 'P2 选满后关闭自己的翻牌');

console.log(failed ? `✗ ${failed} 项失败` : '全部通过');
process.exit(failed ? 1 : 0);
