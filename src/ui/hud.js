/* =====================================================================
   21. HUD（UI 层，逻辑 1920×1080）：底部面板（HP/MP 球、经验条、消耗品栏 1~6、两排技能栏各 7 格、疲劳条、金币、后跳-强化冷却）、
   Buff 图标、左下系统消息、右上连击数、目标血条 / 领主多管血条、觉醒插图、任务追踪（任务组 drawQuestTracker）
   - 技能栏 / 消耗品栏支持拖入（dnd.canvas）、拖出清空、右键清空；悬停显示提示框
   - hudSkillSlotAt(x, y) / hudQuickSlotAt(x, y)：UW×UH 逻辑坐标 → 格子下标或 -1（布局可能会变，别写死坐标）
   - uiPref('hudMode')：'full' 完整 / 'lite' 简洁（Tab 切换）
   ===================================================================== */
const SKILL_KEYS = ['A', 'S', 'D', 'F', 'G', 'H', 'Q', 'W', 'E', 'R', 'T', 'Y', 'Shift', 'V'];   // 旧常量（默认键位），显示请用 keyName('s' + i)
const iconCache = {};
function skillIcon(id, size = 64) {
  const key = id + size; if (iconCache[key]) return iconCache[key];
  const S = SKILLS[id] || { col: '#5a5a6a', name: '?' }, [cv, c] = offCanvas(size, size), s = size / 64;
  c.scale(s, s);
  const g = c.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, shade(S.col || '#5a5a6a', 0.35)); g.addColorStop(0.5, S.col || '#5a5a6a'); g.addColorStop(1, shade(S.col || '#5a5a6a', -0.55));
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  c.strokeStyle = 'rgba(255,255,255,.95)'; c.fillStyle = '#fff'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 5;
  const arc = (x, y, r, a0, a1, w = 6) => { c.lineWidth = w; c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); };
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 4;
  const art = IMG[`icon/${id}`];
  if (art) { c.shadowBlur = 0; c.drawImage(art, -2, -2, 68, 68); iconCache[key] = cv; return cv; }   // 手绘技能图标
  if (S.drawIcon) S.drawIcon(c, arc); else switch (S.icon) {
    case 'up': arc(40, 44, 26, Math.PI * 0.55, Math.PI * 1.45); c.beginPath(); c.moveTo(20, 22); c.lineTo(14, 32); c.lineTo(26, 30); c.fill(); break;
    case 'triple': for (let i = 0; i < 3; i++) { c.lineWidth = 4; c.beginPath(); c.moveTo(10 + i * 12, 50 - i * 6); c.lineTo(34 + i * 12, 16 - i * 2); c.stroke(); } break;
    case 'wave': for (let i = 0; i < 3; i++) { c.lineWidth = 4 - i; c.beginPath(); c.moveTo(8 + i * 14, 54); c.quadraticCurveTo(20 + i * 14, 10 + i * 6, 34 + i * 14, 54); c.stroke(); } break;
    case 'slam': c.beginPath(); c.moveTo(32, 8); c.lineTo(32, 40); c.stroke(); c.beginPath(); c.moveTo(22, 30); c.lineTo(32, 42); c.lineTo(42, 30); c.stroke(); arc(32, 52, 20, Math.PI * 1.1, Math.PI * 1.9, 4); break;
    case 'iai': c.lineWidth = 3; c.beginPath(); c.moveTo(6, 40); c.lineTo(58, 26); c.stroke(); c.lineWidth = 8; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(6, 40); c.lineTo(58, 26); c.stroke(); c.globalAlpha = 1; break;
    case 'flurry': for (let i = 0; i < 5; i++) { c.lineWidth = 3; c.beginPath(); c.moveTo(10, 14 + i * 9); c.lineTo(56, 18 + i * 8); c.stroke(); } break;
    case 'spin': arc(32, 34, 20, 0, Math.PI * 1.7); c.beginPath(); c.moveTo(52, 26); c.lineTo(56, 40); c.lineTo(44, 36); c.fill(); break;
    case 'rise': c.beginPath(); c.moveTo(32, 56); c.lineTo(32, 10); c.stroke(); c.beginPath(); c.moveTo(20, 22); c.lineTo(32, 8); c.lineTo(44, 22); c.stroke(); arc(32, 40, 14, Math.PI * 0.2, Math.PI * 0.8, 3); break;
    case 'focus': c.beginPath(); c.arc(32, 32, 16, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(32, 6); c.lineTo(32, 58); c.moveTo(6, 32); c.lineTo(58, 32); c.lineWidth = 2; c.stroke(); break;
    case 'awaken': c.fillStyle = '#fff6c0'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 26, a = i / 10 * TAU - Math.PI / 2; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } c.closePath(); c.fill(); break;
    default: c.font = '900 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((S.name || '?')[0], 32, 34);
  }
  c.shadowBlur = 0;
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.strokeRect(1, 1, 62, 62);
  iconCache[key] = cv; return cv;
}
/* ---- Buff 图标（64×64，按来源缓存）：技能 → 技能图标；装备特效 → 来源装备的物品图标（套装取第一件）；消耗品 → 物品图标；
   其余画矢量图标：护盾 / 燃斗 / 按增益属性（攻击 / 速度 / 暴击 / 伤害） ---- */
const buffIconCache = {};
function buffIcon(k, b) {
  if (SKILLS[k]) return skillIcon(k, 64);
  const src = b.src || (k.startsWith('item_') ? k.slice(5) : ''), setId = src.split(':')[0];
  const itemKey = ITEMS[src] ? src : SETS[setId] && SETS[setId].pieces.find(x => ITEMS[x]) || null;
  const ck = k + '|' + (itemKey || '') + '|' + (itemKey ? !!IMG[itemArtKey({ ...ITEMS[itemKey], key: itemKey })] : ''); if (buffIconCache[ck]) return buffIconCache[ck];
  const [cv, c] = offCanvas(64, 64), col = b.col || (itemKey && ITEMS[itemKey].col) || '#6a8aff';
  const g = c.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.65));
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  if (itemKey) { c.save(); c.translate(32, 32); drawItemIcon(c, { ...ITEMS[itemKey], key: itemKey }, 52); c.restore(); }
  else {
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 4;   // 只画一次（缓存），不在每帧里
    const has = s => b[s] != null && b[s] !== 0;
    if (k === 'gear_shield') { c.beginPath(); c.moveTo(32, 8); c.lineTo(52, 16); c.quadraticCurveTo(52, 44, 32, 57); c.quadraticCurveTo(12, 44, 12, 16); c.closePath(); c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1; c.stroke(); }
    else if (k === 'burn_mode') { c.beginPath(); c.moveTo(32, 6); c.quadraticCurveTo(50, 26, 46, 40); c.quadraticCurveTo(42, 58, 32, 58); c.quadraticCurveTo(18, 58, 18, 42); c.quadraticCurveTo(18, 30, 28, 22); c.quadraticCurveTo(28, 34, 34, 36); c.quadraticCurveTo(38, 22, 32, 6); c.fill(); }
    else if (has('aspd') || has('cspd') || has('mspd') || has('spd')) { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(12 + i * 6, 18 + i * 14); c.lineTo(46 + i * 6, 18 + i * 14); c.stroke(); } c.beginPath(); c.moveTo(40, 12); c.lineTo(56, 32); c.lineTo(40, 52); c.stroke(); }
    else if (has('crit') || has('critDmg')) { c.beginPath(); c.arc(32, 32, 17, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(32, 6); c.lineTo(32, 58); c.moveTo(6, 32); c.lineTo(58, 32); c.lineWidth = 3; c.stroke(); }
    else if (has('atk') || has('matk')) { c.beginPath(); c.moveTo(14, 50); c.lineTo(48, 16); c.stroke(); c.beginPath(); c.moveTo(20, 36); c.lineTo(28, 44); c.stroke(); c.beginPath(); c.moveTo(12, 52); c.lineTo(18, 46); c.stroke(); c.beginPath(); c.moveTo(44, 10); c.lineTo(54, 10); c.lineTo(54, 20); c.stroke(); }
    else { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 25, a = i / 10 * TAU - Math.PI / 2; c.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r); } c.closePath(); c.fill(); }
  }
  c.shadowBlur = 0; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.strokeRect(1, 1, 62, 62);
  return (buffIconCache[ck] = cv);
}
/* ---- 底栏布局（逻辑坐标） ---- */
const HUD = {
  y0: 940, x0: 452, x1: 1468,                      // 面板上沿 / 左右边
  hp: { x: 372, y: 994, r: 78 }, mp: { x: 1548, y: 994, r: 78 },
  quick: { x: 478, y: 962, s: 52, gap: 58 },       // 消耗品栏 1~6：一排
  skill: { x: 1040, y: 962, s: 52, gap: 60, row: 58 },   // 技能栏 2×7：第 1 排 s0..s5 + s12（左 Shift），第 2 排 s6..s11 + s13
  dodge: { x: 912, y: 1018, r: 30 },                    // 后跳-强化的冷却（原来的闪避位置；字段名保留，别的模块可能在读）
};
// 右上角小地图有 4 行时比较高：连击数和地下城里的任务追踪栏跟着往下挪，不和小地图重叠（小地图见 dungeon.drawUI：y0=70，格子 34）
const hudComboDy = () => { const L = game.dungeon && game.dungeon.layout; return L ? Math.max(0, 70 + L.rows * 34 + 22 - 186) : 0; };
const hudQuickRect = i => ({ x: HUD.quick.x + i * HUD.quick.gap, y: HUD.quick.y, s: HUD.quick.s });
const hudSkillRect = i => { const col = i < 12 ? i % 6 : 6, row = i < 12 ? Math.floor(i / 6) : i - 12; return { x: HUD.skill.x + col * HUD.skill.gap, y: HUD.skill.y + row * HUD.skill.row, s: HUD.skill.s }; };
const hudInRect = (R, x, y, pad = 3) => x >= R.x - pad && x <= R.x + R.s + pad && y >= R.y - pad && y <= R.y + R.s + pad;
function hudSkillSlotAt(x, y) { if (!ui.panelOn()) return -1; for (let i = 0; i < SKILL_SLOTS; i++) if (hudInRect(hudSkillRect(i), x, y)) return i; return -1; }
function hudQuickSlotAt(x, y) { if (!ui.panelOn()) return -1; for (let i = 0; i < 6; i++) if (hudInRect(hudQuickRect(i), x, y)) return i; return -1; }
/* ---- 技能栏 / 消耗品栏的写入（窗口和 HUD 共用） ---- */
function skillBarPut(i, id, from) {
  const B = game.skillBar; if (i < 0 || i >= B.length || !id) return;
  if (from !== undefined && from !== null && from >= 0) { B[from] = B[i] ?? null; B[i] = id; }
  else { const j = B.indexOf(id); if (j >= 0 && j !== i) B[j] = B[i] ?? null; B[i] = id; }
  if (save.data) save.write();
}
function skillBarClear(i) { if (game.skillBar[i] !== undefined) { game.skillBar[i] = null; if (save.data) save.write(); } }
function quickPut(i, key, from) {
  const Q = inv.quick; if (i < 0 || i >= 6 || !key) return;
  if (from !== undefined && from !== null && from >= 0) { Q[from] = Q[i] ?? null; Q[i] = key; }
  else { const j = Q.indexOf(key); if (j >= 0 && j !== i) Q[j] = Q[i] ?? null; Q[i] = key; }
  if (save.data) save.write();
}
function quickClear(i) { if (inv.quick[i] !== undefined) { inv.quick[i] = null; if (save.data) save.write(); } }
const quickIconSrc = key => { try { if (typeof itemIconSrc === 'function') return itemIconSrc(key); } catch (e) { /* 回退 */ } return itemIconURL({ kind: 'use', key }); };
/* ---- 伤害数字开关（设置 → 画面）：包一层兜底，战斗组在 fx.js 原生支持后这层不冲突；屏幕震动由主线程在 game.js 的 updateCamera 里原生判断 uiPref('shake') ---- */
{ const dn = drawNumbers; drawNumbers = function (c) { if (uiPref('dmgNum')) return dn.apply(this, arguments); }; }
const ui = {
  slotMsg: [], combo: { shown: 0, t: 0 }, log: [], lastNow: 0,
  flashSlot(i, msg) { this.slotMsg[i] = { msg, t: 0.8 }; sfx.error(); },
  inGame() { return !!game.player && !!save.data && (game.scene === 'dungeon' || game.scene === 'test' || game.scene === 'town'); },   // 登出 / 切换角色的瞬间 save.data 为空，不画面板
  panelOn() { return this.inGame() && !menus.hudHidden(); },
  draw() {
    const c = uctx, now = performance.now(), rdt = Math.min(0.1, (now - (this.lastNow || now)) / 1000); this.lastNow = now;
    if (!this.inputReady) this.initInput();
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ucan.width, ucan.height);
    c.setTransform(uiScale, 0, 0, uiScale, 0, 0); toastBarFrame(false);
    if (save.data && game.player && game.scene !== 'title' && !game.paused) save.data.playTime = (save.data.playTime || 0) + rdt;   // 角色选择界面显示的游戏时间
    const fight = game.scene === 'dungeon' || game.scene === 'test';
    if (this.panelOn()) { this.drawLog(c, rdt); this.drawPanel(c); }
    if (fight) { this.drawCombo(c); this.drawTarget(c); if (game.dungeon) game.dungeon.drawUI(c); if (typeof drawQuestTracker === 'function') drawQuestTracker(c); }
    if (game.scene === 'town' && world) worldUI(c);
    if (game.cutin && uiPref('cutin')) this.drawCutin(c);
    if (game.scene === 'title') drawToastBanner(c, 120);
    if (PARAMS.has('fps') || uiPref('fps')) uiText(`${fps.toFixed(0)} fps · ents ${ents.length} fx ${fxList.length}`, 1900, 30, { size: 20, align: 'right' });
    menus.drawUI(c); toastBarFrame(true);
  },
  /* ---- 左下系统消息（获得物品 / 金币 / 任务进度的滚动记录；toastMsg 的 'log' 类消息写到这里，横幅类不重复记录） ---- */
  pushLog(msg, col = '#e8e0d0') { this.log.push({ msg, col, t: 0 }); if (this.log.length > 30) this.log.shift(); },
  // 连续捡到的金币合并成一条
  logGold(n) { const L = this.log[this.log.length - 1]; if (L && L.gold && L.t < 2) { L.gold += n; L.msg = `获得 ${fmtNum(L.gold)} G`; L.t = 0; } else { this.pushLog(`获得 ${fmtNum(n)} G`, '#ffd24a'); this.log[this.log.length - 1].gold = n; } },
  drawLog(c, dt) {
    const N = 6, list = this.log.slice(-N), lite = uiPref('hudMode') === 'lite';
    let y = 842;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i]; m.t += dt; const a = m.t > 10 ? Math.max(0, 1 - (m.t - 10) / 2) : 1; if (a <= 0) continue;
      c.globalAlpha = a * (lite ? 0.7 : 1);
      c.fillStyle = 'rgba(8,6,10,.45)'; c.font = '700 19px "PingFang SC","Microsoft YaHei",sans-serif'; const w = Math.min(600, c.measureText(m.msg).width + 20); c.fillRect(20, y - 21, w, 27);
      uiText(m.msg, 30, y, { size: 19, color: m.col, sw: 3 }); y -= 30; c.globalAlpha = 1;
    }
  },
  drawOrb(c, x, y, r, frac, colA, colB, label, val) {
    c.save();
    const rim = c.createLinearGradient(x - r, y - r, x + r, y + r); rim.addColorStop(0, '#d8b870'); rim.addColorStop(0.5, '#6a4a22'); rim.addColorStop(1, '#e8cf8a');
    c.fillStyle = rim; c.beginPath(); c.arc(x, y, r + 9, 0, TAU); c.fill();
    c.fillStyle = '#0a0608'; c.beginPath(); c.arc(x, y, r + 2, 0, TAU); c.fill();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    const top = y + r - clamp(frac, 0, 1) * 2 * r;
    const g = c.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, colA); g.addColorStop(1, colB);
    c.fillStyle = g; c.beginPath(); c.moveTo(x - r, y + r);
    for (let i = 0; i <= 20; i++) { const xx = x - r + i * r / 10; c.lineTo(xx, top + Math.sin(game.t * 3 + i * 0.7) * 2.5); }
    c.lineTo(x + r, y + r); c.closePath(); c.fill();
    const hl = c.createRadialGradient(x - r * 0.35, y - r * 0.45, 2, x - r * 0.2, y - r * 0.3, r); hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(0.35, 'rgba(255,255,255,.08)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
    uiText(val, x, y + 8, { size: 22, align: 'center', color: '#fff', sw: 5 });
    uiText(label, x, y - r * 0.35, { size: 16, align: 'center', color: 'rgba(255,255,255,.8)', sw: 4 });
  },
  slotBox(c, x, y, s, hot) {
    c.fillStyle = '#0c0908'; c.fillRect(x - 3, y - 3, s + 6, s + 6);
    c.strokeStyle = hot ? '#ffd23a' : '#6a5436'; c.lineWidth = hot ? 3 : 2; c.strokeRect(x - 3, y - 3, s + 6, s + 6);
  },
  drawPanel(c) {
    const p = game.player; if (!p) return;
    const { y0, x0, x1 } = HUD, lite = uiPref('hudMode') === 'lite', hot = this.hot || {};
    if (!lite) {
      const g = c.createLinearGradient(0, y0, 0, 1080); g.addColorStop(0, 'rgba(34,26,22,.96)'); g.addColorStop(1, 'rgba(12,9,8,.98)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x0 - 22, 1080); c.lineTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1 + 22, 1080); c.closePath(); c.fill();
      c.strokeStyle = '#b89450'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.stroke();
    }
    // 经验条（10 格）
    const need = expNeed(game.lvl), ef = clamp(game.exp / need, 0, 1), ey = lite ? 1070 : y0 + 6, ew = x1 - x0 - 36;
    c.fillStyle = '#1a1210'; c.fillRect(x0 + 18, ey, ew, 9); c.fillStyle = '#ffd24a'; c.fillRect(x0 + 18, ey, ew * ef, 9);
    c.strokeStyle = '#5a4630'; c.lineWidth = 1.5; c.strokeRect(x0 + 18, ey, ew, 9);
    for (let i = 1; i < 10; i++) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x0 + 18 + ew / 10 * i, ey, 2, 9); }
    uiText(`Lv.${game.lvl}`, x0 + 22, y0 - 12, { size: 26, color: '#ffe8a8' });
    uiText(`EXP ${(ef * 100).toFixed(1)}%`, x1 - 20, y0 - 12, { size: 18, align: 'right', color: '#ffe8a8', sw: 4 });
    // HP / MP 球
    this.drawOrb(c, HUD.hp.x, HUD.hp.y, HUD.hp.r, p.hp / p.hpMax, '#ff5a5a', '#8a0a14', 'HP', `${fmtNum(Math.max(0, p.hp))}`);
    this.drawOrb(c, HUD.mp.x, HUD.mp.y, HUD.mp.r, p.mp / p.mpMax, '#5ab0ff', '#0a2a8a', 'MP', `${fmtNum(Math.max(0, p.mp))}`);
    // 消耗品栏 1~6
    for (let i = 0; i < 6; i++) {
      const R = hudQuickRect(i); this.slotBox(c, R.x, R.y, R.s, hot.kind === 'quick' && hot.i === i);
      if (typeof drawQuickItem === 'function') drawQuickItem(c, i, R.x, R.y, R.s);
      uiText(keyName('i' + i), R.x + 2, R.y + 14, { size: 13, color: '#fff', sw: 3 });
    }
    // 技能栏 2×7
    for (let i = 0; i < SKILL_SLOTS; i++) {
      const R = hudSkillRect(i), x = R.x, y = R.y, s = R.s, id = game.skillBar[i];
      this.slotBox(c, x, y, s, hot.kind === 'skill' && hot.i === i);
      if (id && SKILLS[id]) {
        const S = SKILLS[id], lv = game.skillLv[id] || 0, jobOk = !S.job || S.job === game.job;
        c.globalAlpha = lv > 0 && jobOk ? 1 : 0.3; c.drawImage(skillIcon(id), x, y, s, s); c.globalAlpha = 1;
        const cd = (p.cool[id] || 0), cdMax = (S.cd || 1) * (p.cdMul || 1);
        if (cd > 0) {
          const cx = x + s / 2, cy = y + s / 2;
          c.save(); c.beginPath(); c.rect(x, y, s, s); c.clip(); c.fillStyle = 'rgba(0,0,0,.62)'; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, s, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(cd / cdMax, 0, 1)); c.closePath(); c.fill(); c.restore();
          uiText(cd >= 1 ? Math.ceil(cd) + '' : cd.toFixed(1), cx, cy + 8, { size: 20, align: 'center', color: '#fff', sw: 4 });
        } else if (p.mp < (S.mp || 0)) { c.fillStyle = 'rgba(40,60,200,.45)'; c.fillRect(x, y, s, s); }
        if (S.charges) { const q = p.charges && p.charges[id], n = q ? q.n : S.charges; uiText('×' + n, x + s - 3, y + s - 4, { size: 14, align: 'right', color: n > 0 ? '#ffe070' : '#ff8a7a', sw: 3 }); }   // 装填次数（G-14 手雷等）
        if (S.recast && lv > 0 && S.recast.ok(p)) { c.strokeStyle = '#6aff6a'; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3); }   // 召唤物在场，可以再按
        if (typeof cmdLocked === 'function' && cmdLocked(id)) { c.fillStyle = '#a02020'; c.fillRect(x + s - 14, y, 14, 14); uiText('锁', x + s - 7, y + 12, { size: 11, align: 'center', color: '#fff', sw: 0 }); }
        const m = this.slotMsg[i]; if (m && m.t > 0) { m.t -= 1 / 60; c.fillStyle = `rgba(200,30,30,${m.t})`; c.fillRect(x, y, s, s); if (m.msg) uiText(m.msg, x + s / 2, y - 6, { size: 15, align: 'center', color: '#ffb0a0', sw: 3 }); }
      }
      uiText(keyName('s' + i), x + 2, y + 14, { size: 13, color: '#fff', sw: 3 });
    }
    // 后跳-强化（↓+C：技能中强制后跳 / 受击中脱身，共用冷却）：学会后才亮，冷却转圈
    { const { x, y, r } = HUD.dodge, has = (game.skillLv.c_bsup || 0) > 0, cd = Math.max(0, p.bsCd || 0), cdMax = cd > 30 ? 40 : 30;
      c.globalAlpha = has ? 1 : 0.35;
      c.fillStyle = '#0c0908'; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.fill();
      const g2 = c.createRadialGradient(x - 8, y - 10, 2, x, y, r); g2.addColorStop(0, '#9fe8ff'); g2.addColorStop(1, '#1a6aa8'); c.fillStyle = g2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      if (cd > 0) { c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(cd / cdMax, 0, 1)); c.closePath(); c.fill(); }
      c.strokeStyle = has && cd <= 0 ? '#ffe070' : '#6a5436'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 1, 0, TAU); c.stroke();
      uiText(cd > 0 ? Math.ceil(cd) + '' : '后跳', x, y + 7, { size: 18, align: 'center', color: '#fff', sw: 4 }); uiText(`↓+${keyName('jump')}`, x, y - r - 6, { size: 13, align: 'center', color: '#d8d0c0', sw: 3 });
      c.globalAlpha = 1; }
    if (!lite) {
      // 疲劳条 + 金币 / 复活币 / SP
      const F = save.data.fatigue, fx = HUD.quick.x, fy = 1030, fw = HUD.quick.gap * 5 + HUD.quick.s;
      c.fillStyle = '#1a1210'; c.fillRect(fx, fy, fw, 10); c.fillStyle = '#6ad06a'; c.fillRect(fx, fy, fw * clamp(F / FATIGUE_MAX, 0, 1), 10);
      c.strokeStyle = '#3a4a30'; c.lineWidth = 1.5; c.strokeRect(fx, fy, fw, 10);
      uiText(`疲劳 ${F}/${FATIGUE_MAX}`, fx, fy - 4, { size: 15, color: '#bfe8bf', sw: 3 });
      uiText(`${fmtNum(game.gold)} G`, fx, 1068, { size: 20, color: '#ffd24a', sw: 4 });
      uiText(`复活币 ×${save.data.coins}`, fx + fw, 1068, { size: 16, align: 'right', color: '#ffe8c0', sw: 3 });
      uiText(`SP ${fmtNum(game.sp || 0)}`, HUD.dodge.x, 1072, { size: 16, align: 'center', color: (game.sp || 0) > 0 ? '#8aff9a' : '#c8c0b0', sw: 3 });
    }
    // BUFF 图标（剩余秒数）
    if (p.buffs) { let bx = x0 + 10; for (const k in p.buffs) { const b = p.buffs[k]; if (!b || b.hide) continue; c.drawImage(buffIcon(k, b), bx, y0 - 84, 34, 34); c.strokeStyle = '#ffd23a'; c.lineWidth = 1.5; c.strokeRect(bx, y0 - 84, 34, 34); if (b.n > 1) uiText('×' + b.n, bx + 33, y0 - 53, { size: 13, align: 'right', color: '#fff6c0', sw: 3 }); if (b.t < 900) uiText(Math.ceil(b.t) + '', bx + 17, y0 - 38, { size: 14, align: 'center', sw: 3 }); bx += 40; } }
  },
  drawCombo(c) {
    const n = game.combo;
    if (n >= 2) { this.combo.shown = n; this.combo.t = 0; } else this.combo.t += 1 / 60;
    const shown = this.combo.shown; if (shown < 2 || this.combo.t > 0.6) return;
    const a = n >= 2 ? 1 : 1 - this.combo.t / 0.6, col = shown >= 20 ? '#ff4040' : shown >= 10 ? '#ffd23a' : '#ffffff';
    c.save(); c.globalAlpha = a;
    const pop = game.comboT > 1.5 ? 1.15 : 1, dy = hudComboDy();
    uiText(`${shown}`, 1780, 250 + dy, { size: 72 * pop, align: 'right', color: col, sw: 8, font: '"Arial Black",Impact,sans-serif', weight: 900 });
    uiText('Hit Combo!', 1790, 290 + dy, { size: 28, align: 'right', color: col, sw: 5, font: '"Arial Black",sans-serif', weight: 900 });
    c.restore();
  },
  // 目标血条：最近被玩家打中的怪物（领主多管血条颜色循环 紫→蓝→绿→黄→红，旁边显示剩余管数 ×N）
  drawTarget(c) {
    const t = game.lastTarget; if (!t || (t.dead && t.deadT > 1.0) || game.t - (game.lastTargetT || 0) > 6) return;
    const x = 560, y = 24, w = 800, hh = 26, boss = t.boss;
    const bars = boss ? t.bars || 10 : 1, per = t.hpMax / bars, idx = Math.min(bars - 1, Math.floor(Math.max(0, t.hp - 1) / per)), frac = t.hp <= 0 ? 0 : ((t.hp - idx * per) / per);
    const cols = ['#b050e0', '#3a78ff', '#3ac060', '#f0c030', '#e83a3a'];
    c.fillStyle = 'rgba(10,8,12,.8)'; c.fillRect(x - 70, y - 6, w + 80, hh + 32);
    c.fillStyle = '#2a2024'; c.fillRect(x - 64, y, 54, 54); c.strokeStyle = boss ? '#ffd23a' : '#8a7a6a'; c.lineWidth = 2; c.strokeRect(x - 64, y, 54, 54);
    uiText(boss ? '领' : t.elite ? '精' : game.pvp ? '敌' : '怪', x - 37, y + 38, { size: 28, align: 'center', color: boss ? '#ffd23a' : '#ddd' });
    if (boss && idx > 0) { c.fillStyle = cols[(idx - 1) % 5]; c.fillRect(x, y, w, hh); }
    else { c.fillStyle = '#300'; c.fillRect(x, y, w, hh); }
    // 掉血拖尾（白色）
    const tf = this.trail && this.trail.t === t && this.trail.idx === idx ? this.trail.f : frac;
    this.trail = { t, idx, f: Math.max(frac, tf - 0.012) };
    if (tf > frac) { c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x + w * frac, y, w * (tf - frac), hh); }
    c.fillStyle = boss ? cols[idx % 5] : '#e83a3a'; c.fillRect(x, y, w * frac, hh);
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x, y, w, hh);
    uiText(`Lv.${t.lvl ?? ''} ${t.name || ''}`, x + 6, y + hh + 22, { size: 20, color: boss ? '#ffd23a' : '#fff', sw: 4 });
    if (boss) uiText(`×${idx + 1}`, x + w - 4, y + hh + 24, { size: 24, align: 'right', color: '#fff', sw: 5 });
  },
  drawCutin(c) {
    const k = game.cutin.t / game.cutin.dur, a = k < 0.12 ? k / 0.12 : k > 0.85 ? (1 - k) / 0.15 : 1;
    c.save(); c.globalAlpha = a;
    c.save(); c.translate(0, 540); c.transform(1, -0.08, 0, 1, 0, 0);
    const band = c.createLinearGradient(0, 0, 1920, 0); band.addColorStop(0, 'rgba(255,190,60,.95)'); band.addColorStop(0.35, 'rgba(120,40,10,.92)'); band.addColorStop(1, 'rgba(20,6,2,.9)');
    c.fillStyle = band; c.fillRect(-40, -150, 2000, 300);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) { const y = ((i * 97 + game.t * 900 * (i % 3 + 1)) % 300) - 150, x = (i * 331 + game.t * 2600) % 2400 - 300; c.fillStyle = `rgba(255,230,160,${0.08 + (i % 4) * 0.05})`; c.fillRect(x, y, 260 + (i % 5) * 80, 2 + (i % 3)); }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#ffe070'; c.fillRect(-40, -152, 2000, 4); c.fillRect(-40, 148, 2000, 4);
    c.beginPath(); c.rect(-40, -150, 2000, 300); c.clip();
    const who = game.cutin.who, ease = easeOutBack(Math.min(1, k / 0.25)), art = who && IMG[`cutin/${who.cls}`];
    if (art) { const hh = 520, w = art.width * hh / art.height; c.drawImage(art, -260 + ease * 520 - w * 0.1, -hh / 2 - 20, w, hh); }   // 手绘觉醒立绘
    else if (who) { c.translate(-200 + ease * 620, 98 * 8 + 40); c.scale(8, 8); who.model.draw(c, P(POSE.idle, { uaF: 150, faF: 40, wF: 25, head: 2, torso: -4 }), game.t, { glow: 1 }); }
    c.restore();
    uiText(game.cutin.name, 1420 - (1 - ease) * 200, 575, { size: 104, align: 'center', color: '#fff4c0', sw: 12, stroke: '#3a1400', font: '"PingFang SC","Microsoft YaHei",serif', weight: 900 });
    uiText('AWAKENING', 1420, 625, { size: 30, align: 'center', color: '#ffd23a', sw: 5, font: '"Arial Black",sans-serif', weight: 900 });
    c.restore();
  },
  /* ---- HUD 的鼠标操作：悬停提示、拖出、右键清空、拖入（dnd.canvas）；城镇里右键 / 双击 NPC 对话 ---- */
  infoAt(x, y) {
    const p = game.player; if (!p || !this.panelOn()) return null;
    const inOrb = O => Math.hypot(x - O.x, y - O.y) < O.r + 6;
    if (inOrb(HUD.hp)) return `<b style="color:#ff8a8a">HP</b> ${fmtNum(p.hp)} / ${fmtNum(p.hpMax)}<br><span class="small dim">4 秒没受伤会自动回复</span>`;
    if (inOrb(HUD.mp)) return `<b style="color:#8ac8ff">MP</b> ${fmtNum(p.mp)} / ${fmtNum(p.mpMax)}<br><span class="small dim">释放技能消耗 MP，会随时间回复</span>`;
    const { y0, x0, x1 } = HUD, lite = uiPref('hudMode') === 'lite', ey = lite ? 1070 : y0 + 6;
    if (x > x0 + 18 && x < x1 - 18 && y > ey - 6 && y < ey + 15) { const need = expNeed(game.lvl); return `<b>Lv.${game.lvl}</b> 经验 ${fmtNum(game.exp)} / ${fmtNum(need)}（${(game.exp / need * 100).toFixed(2)}%）`; }
    const fw = HUD.quick.gap * 5 + HUD.quick.s;
    if (!lite && save.data && x > HUD.quick.x && x < HUD.quick.x + fw && y > 1016 && y < 1044) return `<b>疲劳值</b> ${save.data.fatigue} / ${FATIGUE_MAX}<br><span class="small dim">进入新房间消耗 1 点，每天 06:00 恢复</span>`;
    if (p.buffs) { let bx = x0 + 10; for (const k in p.buffs) { const b = p.buffs[k]; if (!b || b.hide) continue; if (x >= bx && x <= bx + 34 && y >= y0 - 84 && y <= y0 - 50) return `<b>${SKILLS[k] ? SKILLS[k].name : (b.name || k)}</b><br>剩余 ${Math.ceil(b.t)} 秒`; bx += 40; } }
    return null;
  },
  toUI(ev) { const r = stage.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * UW, (ev.clientY - r.top) / r.height * UH]; },
  slotAt(ev) {
    const [x, y] = this.toUI(ev); let i = hudSkillSlotAt(x, y); if (i >= 0) return { kind: 'skill', i, id: game.skillBar[i] };
    i = hudQuickSlotAt(x, y); if (i >= 0) return { kind: 'quick', i, id: inv.quick[i] };
    return null;
  },
  initInput() {
    this.inputReady = true;
    const payloadOf = s => s.kind === 'skill' ? { type: 'skill', id: s.id, from: 'bar', slot: s.i, onVoid: () => { skillBarClear(s.i); menus.refresh('skills'); } }
      : { type: 'item', key: s.id, item: inv.items.find(it => it.key === s.id) || null, from: 'quick', slot: s.i, onVoid: () => quickClear(s.i) };
    const iconOf = s => s.kind === 'skill' ? skillIcon(s.id, 64).toDataURL() : quickIconSrc(s.id);
    wcan.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      const s = this.slotAt(ev); if (!s || !s.id) return;
      ev.preventDefault(); ev.stopPropagation();
      const x0 = ev.clientX, y0 = ev.clientY; let on = false;
      const mv = e => { if (!on && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) { on = true; dnd.begin(payloadOf(s), e, iconOf(s)); } if (on) dnd.moveTo(e); };
      const up = e => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); if (on) dnd.end(e); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
    wcan.addEventListener('click', ev => { const [x, y] = this.toUI(ev); if (this.panelOn() && y > HUD.y0 - 20 && x > HUD.hp.x - 100 && x < HUD.mp.x + 100) ev.stopImmediatePropagation(); }, true);   // 点在底栏上不算点世界（NPC）
    wcan.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      const s = this.slotAt(ev);
      if (s) { if (s.kind === 'skill') { skillBarClear(s.i); menus.refresh('skills'); } else quickClear(s.i); sfx.click(); return; }
      if (game.scene === 'town' && typeof worldPointer === 'function') worldPointer(ev, true);   // 右键 NPC 对话
    });
    wcan.addEventListener('dblclick', ev => { if (game.scene === 'town' && !this.slotAt(ev) && typeof worldPointer === 'function' && !menus.isOpen('npc')) worldPointer(ev, true); });
    const itemName = key => (typeof ITEMS !== 'undefined' && ITEMS[key] && ITEMS[key].name) || (typeof CONSUMABLES !== 'undefined' && CONSUMABLES[key] && CONSUMABLES[key].name) || key;
    wcan.addEventListener('pointermove', ev => {
      if (dnd.cur) return;
      const s = this.slotAt(ev), prev = this.hot; this.hot = s;
      if (s && s.id) {
        if (s.kind === 'skill' && SKILLS[s.id] && typeof skillTipHtml === 'function') menus.showTip(skillTipHtml(s.id), ev);
        else if (s.kind === 'quick') { const it = inv.items.find(x => x.key === s.id); menus.showTip(it && typeof itemTip === 'function' ? itemTip(it) : it ? menus.itemTip(it) : `<b>${itemName(s.id)}</b><br><span class="small dim">背包里没有了</span>`, ev); }
        wcan.style.cursor = 'grab'; this.infoHot = false; return;
      }
      if (prev && prev.id) { menus.hideTip(); wcan.style.cursor = ''; }
      const info = this.infoAt(...this.toUI(ev));   // HP / MP 球、经验条、疲劳条、Buff 图标的说明
      if (info) { menus.showTip(info, ev); this.infoHot = true; } else if (this.infoHot) { menus.hideTip(); this.infoHot = false; }
    });
    wcan.addEventListener('pointerleave', () => { this.hot = null; });
    dnd.canvas((p, x, y) => {
      const si = hudSkillSlotAt(x, y);
      if (si >= 0 && p.type === 'skill') {
        const S = SKILLS[p.id]; if (!S) return false;
        if (S.passive) { toastMsg('被动技能不用放进技能栏', '#ffd0a0'); return true; }
        skillBarPut(si, p.id, p.from === 'bar' ? p.slot : undefined); sfx.click(); menus.refresh('skills'); return true;
      }
      const qi = hudQuickSlotAt(x, y);
      if (qi >= 0 && p.type === 'item') {
        const key = p.key || (p.item && p.item.key), kind = p.item ? p.item.kind : 'use';
        if (!key || kind !== 'use') { toastMsg('只有消耗品可以放进快捷栏', '#ffd0a0'); sfx.error(); return true; }
        quickPut(qi, key, p.from === 'quick' ? p.slot : undefined); sfx.click(); return true;
      }
      return false;
    });
  },
};
bus.on('gold', e => { if (e && e.n > 0) ui.logGold(e.n); });
