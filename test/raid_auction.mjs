// 团本拍卖行规则单测（不开浏览器）：src/game/raid_core.js 的竞价、底价与离线队员处理
import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync(new URL('../src/game/raid_core.js', import.meta.url), 'utf8') + '\nthis.RAID_CORE = RAID_CORE;';
const ctx = {};
vm.runInNewContext(src, ctx);
const R = ctx.RAID_CORE;
let failed = 0;
const ok = (v, msg, detail) => { if (!v) { failed++; console.error('  ✗', msg, detail || ''); } else console.log('  ✓', msg); };
const item = { key: 'ep_auction', n: 1, kind: 'equip', minBid: 1_000_000 };
const members = [{ uid: 1, name: '队长' }, { uid: 2, name: '队员' }, { uid: 3, name: '离线队员' }];

const S = R.init('siroco', members, 'normal', 0, {
  sid: 'official-auction', lootMode: 'auction',
  wallets: {
    1: { gold: 10_000_000, vault: 0, cap: 2_000_000_000 },
    2: { gold: 10_000_000, vault: 0, cap: 2_000_000_000 },
    3: { gold: 10_000_000, vault: 0, cap: 2_000_000_000 },
  },
});
S.members.find(m => m.uid === 3).online = false;
const O = R.lootOffer(S, item, 1, 1).offer;
const first = R.lootBid(S, 1, O.id, 1_000_000, 2);
ok(first.ok && R.lootWallet(S, 1).gold === 9_000_000, '出价时立即从角色金币托管扣除');
ok(R.lootBid(S, 1, O.id, 1_100_000, 3).code === 'highest', '最高价者不能追加出价');
ok(R.lootBid(S, 2, O.id, 1_000_000, 4).code === 'minimum', '新出价必须高于当前最高价');
ok(R.lootBid(S, 2, O.id, 2_000_000_001, 4).code === 'cap', '单笔出价不能超过角色金币携带上限');
const second = R.lootBid(S, 2, O.id, 2_000_000, 5);
ok(second.ok && R.lootWallet(S, 1).gold === 10_000_000 && R.lootWallet(S, 2).gold === 8_000_000, '被超价后原托管立即退回，新最高价立即扣除');
ok(R.lootBid(S, 2, O.id, 2_100_000, 6).code === 'highest', '新的最高价者同样不能追加出价');
const settled = R.lootResolve(S, O.id, 7).offer;
ok(settled.status === 'awarded' && settled.winner === '2' && settled.price === 2_000_000, '竞拍按最高价结算给最高出价者');
ok(settled.delivery === 'mail' && settled.fee === 100_000 && settled.pool === 1_900_000, '成交物品邮件发放，扣除 5% 服务费后分红');
ok(Object.values(settled.settlement.shares).reduce((a, n) => a + n, 0) === settled.pool && R.lootWallet(S, 1).mail.some(m => m.reason === 'raid-auction-share'), '成交价扣除手续费后向所有参战队员邮件分红');

const overflow = R.init('siroco', [{ uid: 1, name: '甲' }, { uid: 2, name: '乙' }], 'normal', 0, {
  sid: 'refund-mail', lootMode: 'auction',
  wallets: { 1: { gold: 1_999_999_999, vault: 1_000_000, cap: 2_000_000_000 }, 2: { gold: 10_000_000, cap: 2_000_000_000 } },
});
const OO = R.lootOffer(overflow, item, 1, 10).offer;
ok(R.lootBid(overflow, 1, OO.id, 1_000_000, 11, { source: 'vault' }).ok, '竞拍可从账号金库取款');
const overbid = R.lootBid(overflow, 2, OO.id, 2_000_000, 12);
ok(overbid.ok && overbid.effects.some(e => e.kind === 'refund-mail' && e.mail && e.mail.amount === 1_000_000), '退回金额超过携带上限时整笔邮件退回');
ok(R.lootWallet(overflow, 1).gold === 1_999_999_999 && R.lootWallet(overflow, 1).mail.some(m => m.reason === 'raid-auction-refund'), '超上限退回不截断、不改变角色金币');

const none = R.init('siroco', [{ uid: 1, name: '甲' }], 'guide', 0, { sid: 'no-bid', lootMode: 'auction' });
const noBid = R.lootOffer(none, item, 1, 20).offer;
ok(R.lootResolve(none, noBid.id, 21).offer.status === 'destroyed', '无人竞价时物品销毁，不生成虚假归属');

// 翻牌是阶段边界：倒计时结束也不能自动进入下一阶段，必须所有有奖励队员完成翻牌。
const F = R.init('siroco', [{ uid: 1, name: '甲' }, { uid: 2, name: '乙' }], 'normal', 0, { sid: 'flip-gate' });
F.st = 'rest'; F.phase = 0; F.restUntil = 10; F.res.phases = [1]; F.flip = { state: 'ready', phase: 1, openedAt: 0, closedAt: 0, cards: {} };
ok(R.tick(F, 100).S.st === 'rest', '翻牌未完成时休整不会自动推进');
const blockedStart = R.event(F, { t: 'start', uid: 1 }, 101);
ok(blockedStart.err && blockedStart.err.code === 'flip', '翻牌未完成时团长不能强行开始下一阶段');
for (const uid of [1, 2]) {
  ok(R.flipOpen(F, uid, 1, 110 + uid).ok, `队员 ${uid} 可打开自己的翻牌窗口`);
  ok(R.flipPick(F, uid, 1, 0, 120 + uid).ok, `队员 ${uid} 选择规定数量的牌`);
  ok(R.flipClose(F, uid, 1, 130 + uid).ok, `队员 ${uid} 完成翻牌后锁定`);
}
ok(R.flipComplete(F) && R.tick(F, 200).S.st === 'routes' && F.phase === 1, '全员完成翻牌后才进入下一阶段');

console.log(failed ? `✗ ${failed} 项失败` : '全部通过');
process.exit(failed ? 1 : 0);
