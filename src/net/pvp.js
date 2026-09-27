/* =====================================================================
   好友决斗（1v1 PK）：邀请 / 接受 / 拒绝 / 超时
   ===================================================================== */
const netDuel = { asking: null };
function netDuelAsk(p) {
  if (!p || !net.connected) { toastMsg('没有连上服务器', '#ff9a6a'); return; }
  if (game.scene !== 'town') { toastMsg('在城镇里才能发起决斗', '#ffd0a0'); return; }
  if (typeof coop !== 'undefined' && coop.active()) { toastMsg('地下城里不能发起决斗', '#ffd0a0'); return; }
  netDuel.asking = { id: p.id, name: p.name, t: Date.now() };
  net.send({ t: 'duel:ask', to: p.id });
}
net.on('duel:asked', m => {
  const f = m.from, busy = game.scene !== 'town' || (typeof coop !== 'undefined' && coop.active()) || !game.player;
  if (busy) { net.send({ t: 'duel:decline', from: f.id, why: 'busy' }); chatSys(`${f.name} 向你发起了决斗（你正忙，已自动拒绝）`); return; }
  const warn = f.build && f.build !== netBuild();
  sfx.open && sfx.open();
  netAsk('duelask', { title: '决斗邀请', block: false, timeout: 19000,
    text: `<b>${escHtml(f.char ? f.char.name : f.name)}</b>（${escHtml(f.char ? netCharLine(f.char) : '')}，账号 ${escHtml(f.name)}）向你发起决斗！<br><span class="small dim">三局两胜，每局 60 秒；双方属性由天平系统统一。</span>` +
      (warn ? '<br><span style="color:#ffb08a">对方的游戏版本和你不一样，请双方刷新页面后再决斗。</span>' : ''),
    okText: '接受决斗', cancelText: '拒绝',
    ok: () => net.send({ t: 'duel:accept', from: f.id }), cancel: () => net.send({ t: 'duel:decline', from: f.id }) });
});
net.on('duel:cancelled', () => { if (menus.isOpen('nd_duelask')) menus.close('nd_duelask'); chatSys('对方取消了决斗邀请'); });
net.on('duel:declined', m => { netDuel.asking = null; const t = m.why === 'timeout' ? `${m.by} 没有回应决斗邀请` : m.why === 'busy' ? `${m.by} 正忙，没法决斗` : `${m.by} 拒绝了决斗`; chatSys(t); toastMsg(t, '#ffb08a'); });
