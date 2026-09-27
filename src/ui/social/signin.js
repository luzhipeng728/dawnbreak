/* =====================================================================
   每日签到窗口（signin）：本月签到日历（按服务器时间，北京时间 06:00 换日）+ 第 N 次签到的奖励 + 连续签到奖励
   签到后奖励以系统邮件发出，这里立即自动领取；背包满了就留在邮箱里
   ===================================================================== */
addStyle(`
.sxsign .scal{display:grid;grid-template-columns:repeat(7,1fr);gap:.2em;font-size:.8em;text-align:center}
.sxsign .scal .wd{color:#c8a870;font-weight:900}
.sxsign .scal .d{padding:.25em 0;border-radius:.2em;background:#16111b;color:#8a806e}
.sxsign .scal .d.on{background:linear-gradient(#5a8a3a,#2a4a1a);color:#eaffd8;font-weight:900}
.sxsign .scal .d.today{outline:.12em solid #ffd23a}
.sxsign .rgrid{display:grid;grid-template-columns:repeat(8,1fr);gap:.3em}
.sxsign .rc{position:relative;display:flex;flex-direction:column;align-items:center;gap:.1em;padding:.25em .1em;border-radius:.3em;background:#16111b;border:.08em solid #2e2838;font-size:.72em}
.sxsign .rc .n{color:#9a8f7c;font-weight:900}
.sxsign .rc .v{font-weight:900;white-space:nowrap}
.sxsign .rc .islot{width:2.5em;height:2.5em}
.sxsign .rc.done{opacity:.5}.sxsign .rc.done::after{content:'✔';position:absolute;right:.2em;top:0;color:#6aff7a;font-size:1.3em;font-weight:900;text-shadow:0 0 .2em #000}
.sxsign .rc.next{border-color:#ffd23a;box-shadow:0 0 .6em rgba(255,210,60,.45);background:#2a2010}
.sxsign .stk{display:flex;gap:.4em;flex-wrap:wrap;align-items:center;font-size:.85em}
.sxsign .stk .m{padding:.15em .5em;border-radius:1em;border:.08em solid #4a3c2c;background:#18121e}
.sxsign .stk .m.ok{border-color:#6aa04a;color:#baff9a}
.sxsign .coin{display:grid;place-items:center;width:2.5em;height:2.5em;border-radius:.2em;background:#1e1a24;font-weight:900}
`);
// 奖励条目 → 小卡片内容
function sxRewardEls(r) {
  const out = [];
  if (r.gold) out.push(h('div', { class: 'coin gold' }, 'G'), h('div', { class: 'v gold' }, fmtNum(r.gold)));
  if (r.cera) out.push(ITEMS.cera ? sxEntrySlot({ key: 'cera', n: r.cera }) : h('div', { class: 'coin cera' }, '券'), h('div', { class: 'v cera' }, `点券 ${fmtNum(r.cera)}`));
  for (const e of r.items || []) out.push(sxEntrySlot(e), h('div', { class: 'v' }, `${ITEMS[e.key] ? ITEMS[e.key].name : e.key}${e.n > 1 ? ' ×' + e.n : ''}`));
  return out;
}
const sxRewardText = r => [r.gold ? `${fmtNum(r.gold)} G` : '', r.cera ? `点券 ${fmtNum(r.cera)}` : '', ...(r.items || []).map(e => `${ITEMS[e.key] ? ITEMS[e.key].name : e.key}${e.n > 1 ? ' ×' + e.n : ''}`)].filter(Boolean).join('、');
Object.assign(menus, {
  w_signin() {
    if (!sxGate('每日签到')) return null;
    const el = sxWin('signin', '每日签到', {
      w: 42,
      load: () => sxApi('GET', '/api/signin'),
      render: (el, s) => {
        SX.signed = s.signed; SX.signinState = s;
        const today = +s.today.slice(8);
        const cal = h('div', { class: 'scal' }, ['日', '一', '二', '三', '四', '五', '六'].map(w => h('div', { class: 'wd' }, w)),
          Array.from({ length: s.firstWeekday }, () => h('div')), Array.from({ length: s.daysInMonth }, (_, i) => h('div', { class: 'd' + (s.days.includes(i + 1) ? ' on' : '') + (i + 1 === today ? ' today' : '') }, String(i + 1))));
        const cards = h('div', { class: 'rgrid', 'data-sk': 'rg' }, s.rewards.slice(0, s.daysInMonth).map((r, i) => h('div', { class: 'rc' + (i < s.count ? ' done' : '') + (!s.signed && i === s.count ? ' next' : '') }, h('div', { class: 'n' }, `第 ${i + 1} 天`), ...sxRewardEls(r))));
        const nextStreak = s.signed ? s.streak : s.streak + 1;
        const stk = h('div', { class: 'stk' }, h('b', {}, `连续签到 ${s.streak} 天`), ...Object.keys(s.streakRewards).map(k => h('span', { class: 'm' + (s.streak >= +k ? ' ok' : ''), title: sxRewardText(s.streakRewards[k]) }, `${k} 天：${sxRewardText(s.streakRewards[k])}`)));
        const btn = h('button', { class: 'btn big' + (s.signed ? ' off' : ''), onclick: () => sxSignin(el, btn) }, s.signed ? '今天已签到' : `签到（第 ${s.count + 1} 天${s.streakRewards[nextStreak] ? `，连续 ${nextStreak} 天有额外奖励` : ''}）`);
        const left = Math.max(0, s.nextReset - s.now);
        return [h('div', { class: 'row', style: 'align-items:flex-start;gap:.8em' },
          h('div', { class: 'sxbox', style: 'width:13em;flex:none' }, h('div', { class: 'sxlbl', style: 'margin-bottom:.3em' }, `${s.month.replace('-', ' 年 ')} 月 · 本月已签 ${s.count} 天`), cal,
            h('div', { class: 'small dim', style: 'margin-top:.4em;line-height:1.5' }, `服务器日期 ${s.today}`, h('br'), `${Math.floor(left / 3600000)} 小时 ${Math.floor(left / 60000) % 60} 分后换日（每天 06:00）`)),
          h('div', { class: 'col', style: 'flex:1;min-width:0;gap:.45em' }, h('div', { class: 'sxlbl' }, '本月奖励（按本月第几次签到发放）'), cards)),
          stk, h('div', { class: 'row' }, h('span', { class: 'ihint' }, '奖励通过邮件发放，签到后自动领取；背包满了会留在邮箱里。'), h('span', { class: 'sp' }), btn)];
      },
    });
    el.classList.add('sxsign');
    return el;
  },
});
async function sxSignin(el, btn) {
  if (SX.signing) return;
  SX.signing = true; if (btn) btn.classList.add('off');
  try {
    const r = await sxApi('POST', '/api/signin');
    SX.signed = true; sfx.levelUp();
    toastMsg(`签到成功（本月第 ${r.count} 天${r.bonus ? `，连续 ${r.streak} 天` : ''}）`, '#8aff9a');
    // 奖励邮件：立即领取（背包满了就留在邮箱）
    const inbox = await sxApi('GET', '/api/mail'); sxSetCounts(inbox);
    const m = inbox.list.find(x => x.id === r.mailId);
    if (m && m.att && !m.claimed) {
      try { const c = await sxMailClaim(m); toastMsg(`签到奖励：${(c.got || []).join('、')}`, '#ffe8a8'); }
      catch (e) { toastMsg(`${e.message}，签到奖励留在邮箱里了`, '#ffb070'); }
    }
    if (el && el.isConnected) { el._data = { ...r.state }; el._render(); }
  } catch (e) { toastMsg(sxErrText(e), '#ff6a6a'); sfx.error(); if (el && el.isConnected) el._reload(); }
  finally { SX.signing = false; }
}
