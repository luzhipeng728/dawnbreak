/* =====================================================================
   浮空保护调试显示（开发用）：头顶画出连招会话——阶段、浮空点数 / 一级 / 二级保护线、保护等级、重力倍率、追击额度
   打开：网址加 ?jugdbg；或者控制台 jugDbg.toggle()；开发环境（本地文件 / localhost / ?dev）按 Shift+F9 切换
   - 刷图（怪物、地下城里的玩家）：读 t.js（engine/juggle_core.js 的 JUGGLE_CORE.debugInfo）
   - 决斗玩家：读 duel.js 的 duelDbgInfo（平推 / 一次浮空 / 起身 / 二次保护各占血条的百分比、第一次落地后过了几秒）
   ===================================================================== */
const jugDbg = {
  on: PARAMS.has('jugdbg'),
  toggle(v) { this.on = v === undefined ? !this.on : !!v; if (typeof toastMsg === 'function') toastMsg('浮空保护调试显示：' + (this.on ? '开' : '关')); return this.on; },
  // 一个实体要显示的几行字和进度条（没在连招里就返回 null）；测试也用这个
  info(e) {
    if (!e || e.dead || e.remove || e.ghost) return null;
    if (e.fighter && game.pvp) return typeof duelDbgInfo === 'function' ? duelDbgInfo(e) : null;
    if (!e.js && !(e.cmb && e.cmb.hits)) return null;
    const I = JUGGLE_CORE.debugInfo(e.js, jugProf(e), e.weight), col = I.lv >= 2 ? '#ffb060' : I.lv ? '#6ab0ff' : '#9fe8b0';
    return { lines: [`${I.phase} L${I.lv} 重力×${I.grav}`, `点数 ${I.pts} / ${I.p1} / ${I.p2}`, `追击 ${I.otg}/${I.otgMax} 挑空 ${I.launches}`], bar: { v: I.pts / I.p2, tick: I.p1 / I.p2, col }, raw: I };
  },
  draw(c) {
    if (!this.on) return;
    c.save(); c.font = '700 11px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)';
    for (const e of ents) {
      const I = this.info(e); if (!I) continue;
      const X = sx(e.x), Y = sy(e.y, e.z + (e.h || 100) + 30); if (X < -80 || X > WW + 80) continue;
      I.lines.forEach((t, i) => { const yy = Y - (I.lines.length - 1 - i) * 13; c.strokeText(t, X, yy); c.fillStyle = '#fff'; c.fillText(t, X, yy); });
      if (I.bar) { const w = 64, yy = Y + 5; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(X - w / 2, yy, w, 4); c.fillStyle = I.bar.col; c.fillRect(X - w / 2, yy, w * clamp(I.bar.v, 0, 1), 4); if (I.bar.tick) { c.fillStyle = '#fff'; c.fillRect(X - w / 2 + w * clamp(I.bar.tick, 0, 1) - 0.5, yy - 2, 1, 8); } }
    }
    c.restore();
  },
};
if (typeof window !== 'undefined') window.addEventListener('keydown', ev => {
  if (ev.code !== 'F9' || !ev.shiftKey) return;
  if (!(location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) || PARAMS.has('dev'))) return;
  jugDbg.toggle(); ev.preventDefault();
});
