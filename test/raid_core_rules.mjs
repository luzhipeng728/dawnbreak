// 团本核心规则单测（不开浏览器）：队长权限、拾取方式、掉落分配
import fs from 'fs'; import vm from 'vm';

const src = fs.readFileSync(new URL('../src/game/raid_core.js', import.meta.url), 'utf8') + '\nthis.RAID_CORE = RAID_CORE;';
const ctx = {}; vm.runInNewContext(src, ctx); const R = ctx.RAID_CORE; let fail = 0;
const ok = (v, m, x) => { console.log(v ? '  ✓' : '  ✗', m, x || ''); if (!v) fail++; };
const members = [{ uid: 1, cid: 'a', name: '队长' }, { uid: 2, cid: 'b', name: '队员' }];
const item = { key: 'ep_test', n: 1, kind: 'equip', slot: 'weapon' };

const S = R.init('siroco', members, 'guide', 0, { sid: 'loot-test', seed: 3 });
ok(R.setLootMode(S, 2, 'random').ok === false, '队员不能修改拾取方式');
ok(R.setLootMode(S, 1, 'leader').ok && R.lootMode(S) === 'leader', '队长分配模式可在开团前设置');
const leadOffer = R.lootOffer(S, item, 2, 1);
ok(leadOffer.ok && leadOffer.offer.status === 'pending', '队长分配的装备进入待分配池');
ok(R.lootAssign(S, 2, leadOffer.offer.id, 2, 2).ok === false, '队员不能替队长分配装备');
ok(R.lootAssign(S, 1, leadOffer.offer.id, 2, 2).offer.winner === 2, '队长可以把装备分给在线队员');

const A = R.init('siroco', members, 'guide', 0, { sid: 'auction-test', seed: 5, lootMode: 'auction' });
const auction = R.lootOffer(A, item, 1, 1).offer;
ok(auction.mode === 'auction' && R.lootBid(A, 1, auction.id, 100, 2).ok && R.lootBid(A, 2, auction.id, 200, 3).ok, '竞拍模式接受队内竞价');
const settled = R.lootResolve(A, auction.id, 4).offer;
ok(settled.status === 'awarded' && settled.winner === '2' && settled.price === 200, '竞拍按最高价结算给出价最高的队员');

const F = R.init('siroco', members, 'guide', 0, { sid: 'flip-test', seed: 7 });
F.res.phases = [1]; F.flip = { state: 'ready', phase: 1, openedAt: 0, closedAt: 0, cards: {} };
ok(R.flipOpen(F, 1, 1, 10).state === 'open', '阶段结算先显式打开翻牌阶段');
ok(R.flipPick(F, 1, 1, 0, 11, () => 0.2).ok, '翻开一张奖励牌');
ok(R.flipPick(F, 1, 1, 0, 12, () => 0.2).ok === false, '同一张牌不能重复翻开');
ok(R.flipClose(F, 1, 1, 13).ok && R.flipPick(F, 1, 1, 1, 14).ok === false, '关闭翻牌后不能继续取奖励');

// 失败结束仍保留最后一个已完成阶段的翻牌入口，未领取的阶段奖励不能被超时吞掉。
const failed = R.init('siroco', [{ uid: 1, name: '甲' }], 'guide', 0, { sid: 'failed-flip' });
failed.st = 'routes'; failed.phase = 0; failed.deadline = 1; failed.res.phases = [1];
R.tick(failed, 2);
ok(failed.st === 'failed' && failed.flip.phase === 1 && R.flipOpen(failed, 1, 1, 3).ok, '团本失败后仍可补领已完成阶段并进入翻牌');
const legacyFailed = R.init('siroco', [{ uid: 1, name: '甲' }], 'guide', 0, { sid: 'legacy-failed-flip' });
legacyFailed.st = 'failed'; legacyFailed.res.phases = [1]; legacyFailed.flip = { state: 'none', phase: 0, openedAt: 0, closedAt: 0, cards: {} };
ok(R.flipOpen(legacyFailed, 1, 1, 4).ok, '旧存档失败团本缺少翻牌状态时可按已完成阶段恢复');

console.log(fail ? `✗ ${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
