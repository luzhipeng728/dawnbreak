/* =====================================================================
   21. HUD（UI 层，逻辑 1920×1080）：底部面板（HP/MP 球、两排技能栏、物品栏、经验/疲劳条）、
   右上连击数、目标血条 / 领主多管血条、觉醒插图
   ===================================================================== */
const SKILL_KEYS = ['A', 'S', 'D', 'F', 'G', 'H', 'Q', 'W', 'E', 'R', 'T', 'Y'];
const iconCache = {};
function skillIcon(id, size = 64) {
  const key = id + size; if (iconCache[key]) return iconCache[key];
  const S = SKILLS[id], [cv, c] = offCanvas(size, size), s = size / 64;
  c.scale(s, s);
  const g = c.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, shade(S.col, 0.35)); g.addColorStop(0.5, S.col); g.addColorStop(1, shade(S.col, -0.55));
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
    default: c.font = '900 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(S.name[0], 32, 34);
  }
  c.shadowBlur = 0;
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.strokeRect(1, 1, 62, 62);
  iconCache[key] = cv; return cv;
}
const ui = {
  slotMsg: [], combo: { shown: 0, t: 0 },
  flashSlot(i, msg) { this.slotMsg[i] = { msg, t: 0.8 }; sfx.error(); },
  draw() {
    const c = uctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ucan.width, ucan.height);
    c.setTransform(uiScale, 0, 0, uiScale, 0, 0);
    if (game.scene === 'dungeon' || game.scene === 'test' || game.scene === 'town') this.drawPanel(c);
    if (game.scene === 'dungeon' || game.scene === 'test') { this.drawCombo(c); this.drawTarget(c); if (game.dungeon) game.dungeon.drawUI(c); }
    if (game.cutin) this.drawCutin(c);
    if (game.scene === 'town' && window.townUI) townUI(c);
    if (PARAMS.has('fps')) uiText(`${fps.toFixed(0)} fps · ents ${ents.length} fx ${fxList.length}`, 1900, 30, { size: 20, align: 'right' });
    menus.drawUI(c);
  },
  drawOrb(c, x, y, r, frac, colA, colB, label, val) {
    c.save();
    // 外框
    const rim = c.createLinearGradient(x - r, y - r, x + r, y + r); rim.addColorStop(0, '#d8b870'); rim.addColorStop(0.5, '#6a4a22'); rim.addColorStop(1, '#e8cf8a');
    c.fillStyle = rim; c.beginPath(); c.arc(x, y, r + 9, 0, TAU); c.fill();
    c.fillStyle = '#0a0608'; c.beginPath(); c.arc(x, y, r + 2, 0, TAU); c.fill();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    const top = y + r - frac * 2 * r;
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
  drawPanel(c) {
    const p = game.player; if (!p) return;
    const y0 = 952;
    // 面板底
    const g = c.createLinearGradient(0, y0, 0, 1080); g.addColorStop(0, 'rgba(34,26,22,.96)'); g.addColorStop(1, 'rgba(12,9,8,.98)');
    c.fillStyle = g; c.beginPath(); c.moveTo(430, 1080); c.lineTo(450, y0); c.lineTo(1470, y0); c.lineTo(1490, 1080); c.closePath(); c.fill();
    c.strokeStyle = '#b89450'; c.lineWidth = 3; c.beginPath(); c.moveTo(450, y0); c.lineTo(1470, y0); c.stroke();
    // 经验条
    const need = expNeed(game.lvl), ef = clamp(game.exp / need, 0, 1);
    c.fillStyle = '#1a1210'; c.fillRect(470, y0 + 8, 980, 10); c.fillStyle = '#ffd24a'; c.fillRect(470, y0 + 8, 980 * ef, 10);
    c.strokeStyle = '#5a4630'; c.lineWidth = 1.5; c.strokeRect(470, y0 + 8, 980, 10);
    for (let i = 1; i < 10; i++) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(470 + 98 * i, y0 + 8, 2, 10); }
    // 等级 / 疲劳
    uiText(`Lv.${game.lvl}`, 480, y0 - 10, { size: 26, color: '#ffe8a8' });
    uiText(`${(ef * 100).toFixed(1)}%`, 1440, y0 - 10, { size: 20, align: 'right', color: '#ffe8a8' });
    { const F = save.data.fatigue; c.fillStyle = '#1a1210'; c.fillRect(1500, 1060, 220, 10); c.fillStyle = '#6ad06a'; c.fillRect(1500, 1060, 220 * F / FATIGUE_MAX, 10); uiText(`疲劳 ${F}/${FATIGUE_MAX}`, 1720, 1052, { size: 16, align: 'right', color: '#bfe8bf', sw: 3 }); }
    // HP / MP 球
    this.drawOrb(c, 380, 990, 78, p.hp / p.hpMax, '#ff5a5a', '#8a0a14', 'HP', `${fmtNum(p.hp)}`);
    this.drawOrb(c, 1540, 990, 78, p.mp / p.mpMax, '#5ab0ff', '#0a2a8a', 'MP', `${fmtNum(p.mp)}`);
    // 技能栏 2×6
    for (let i = 0; i < 12; i++) {
      const row = Math.floor(i / 6), col = i % 6, x = 900 + col * 70, y = y0 + 26 + row * 64, id = game.skillBar[i];
      c.fillStyle = '#0c0908'; c.fillRect(x - 3, y - 3, 64, 64); c.strokeStyle = '#6a5436'; c.lineWidth = 2; c.strokeRect(x - 3, y - 3, 64, 64);
      if (id && SKILLS[id]) {
        const S = SKILLS[id], lv = game.skillLv[id] || 0;
        c.globalAlpha = lv > 0 ? 1 : 0.3; c.drawImage(skillIcon(id), x, y, 58, 58); c.globalAlpha = 1;
        const cd = (p.cool[id] || 0), cdMax = S.cd * (p.cdMul || 1);
        if (cd > 0) {
          c.fillStyle = 'rgba(0,0,0,.62)'; c.beginPath(); c.moveTo(x + 29, y + 29); c.arc(x + 29, y + 29, 42, -Math.PI / 2, -Math.PI / 2 + TAU * (cd / cdMax)); c.closePath();
          c.save(); c.beginPath(); c.rect(x, y, 58, 58); c.clip(); c.beginPath(); c.moveTo(x + 29, y + 29); c.arc(x + 29, y + 29, 42, -Math.PI / 2, -Math.PI / 2 + TAU * (cd / cdMax)); c.closePath(); c.fill(); c.restore();
          uiText(cd >= 1 ? Math.ceil(cd) + '' : cd.toFixed(1), x + 29, y + 38, { size: 22, align: 'center', color: '#fff', sw: 4 });
        } else if (p.mp < S.mp) { c.fillStyle = 'rgba(40,60,200,.45)'; c.fillRect(x, y, 58, 58); }
        const m = this.slotMsg[i]; if (m && m.t > 0) { m.t -= 1 / 60; c.fillStyle = `rgba(200,30,30,${m.t})`; c.fillRect(x, y, 58, 58); }
      }
      uiText(SKILL_KEYS[i], x + 3, y + 16, { size: 15, color: '#fff', sw: 3 });
    }
    // 物品栏 1–6
    for (let i = 0; i < 6; i++) {
      const x = 480 + (i % 3) * 64, y = y0 + 26 + Math.floor(i / 3) * 64;
      c.fillStyle = '#0c0908'; c.fillRect(x - 3, y - 3, 60, 60); c.strokeStyle = '#6a5436'; c.lineWidth = 2; c.strokeRect(x - 3, y - 3, 60, 60);
      if (window.drawQuickItem) drawQuickItem(c, i, x, y, 54);
      uiText(String(i + 1), x + 2, y + 15, { size: 14, color: '#fff', sw: 3 });
    }
    // 金币
    uiText(`${fmtNum(game.gold)} G`, 680 + 20, y0 + 70, { size: 20, color: '#ffd24a', sw: 4 });
    uiText(`复活币 ×${save.data.coins}`, 700, y0 + 100, { size: 16, color: '#ffe8c0', sw: 3 });
    // 闪避（Shift）：冷却转圈
    { const x = 848, y = y0 + 64, r = 30, cd = Math.max(0, p.dodgeCd || 0) / DODGE_CD, br = Math.max(0, p.breakCd || 0);
      c.fillStyle = '#0c0908'; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.fill();
      const g2 = c.createRadialGradient(x - 8, y - 10, 2, x, y, r); g2.addColorStop(0, '#9fe8ff'); g2.addColorStop(1, '#1a6aa8'); c.fillStyle = g2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      if (cd > 0) { c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * cd); c.closePath(); c.fill(); }
      c.strokeStyle = br > 0 ? '#6a5436' : '#ffe070'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 1, 0, TAU); c.stroke();
      uiText('闪避', x, y + 7, { size: 18, align: 'center', color: '#fff', sw: 4 }); uiText('Shift', x, y - r - 6, { size: 13, align: 'center', color: '#d8d0c0', sw: 3 }); }
    // BUFF 图标
    if (p.buffs) { let bx = 460; for (const k in p.buffs) { if (SKILLS[k]) { c.drawImage(skillIcon(k, 32), bx, y0 - 70, 32, 32); uiText(Math.ceil(p.buffs[k].t) + '', bx + 16, y0 - 30, { size: 14, align: 'center' }); bx += 38; } } }
  },
  drawCombo(c) {
    const n = game.combo;
    if (n >= 2) { this.combo.shown = n; this.combo.t = 0; } else this.combo.t += 1 / 60;
    const shown = this.combo.shown; if (shown < 2 || this.combo.t > 0.6) return;
    const a = n >= 2 ? 1 : 1 - this.combo.t / 0.6, col = shown >= 20 ? '#ff4040' : shown >= 10 ? '#ffd23a' : '#ffffff';
    c.save(); c.globalAlpha = a;
    const pop = game.comboT > 1.5 ? 1.15 : 1;
    uiText(`${shown}`, 1780, 250, { size: 72 * pop, align: 'right', color: col, sw: 8, font: '"Arial Black",Impact,sans-serif', weight: 900 });
    uiText('Hit Combo!', 1790, 290, { size: 28, align: 'right', color: col, sw: 5, font: '"Arial Black",sans-serif', weight: 900 });
    c.restore();
  },
  // 目标血条：最近被玩家打中的怪物（领主多管血条颜色循环 紫→蓝→绿→黄→红）
  drawTarget(c) {
    const t = game.lastTarget; if (!t || (t.dead && t.deadT > 1.0) || game.t - (game.lastTargetT || 0) > 6) return;
    const x = 560, y = 24, w = 800, h = 26, boss = t.boss;
    const bars = boss ? t.bars || 10 : 1, per = t.hpMax / bars, idx = Math.min(bars - 1, Math.floor(Math.max(0, t.hp - 1) / per)), frac = t.hp <= 0 ? 0 : ((t.hp - idx * per) / per);
    const cols = ['#b050e0', '#3a78ff', '#3ac060', '#f0c030', '#e83a3a'];
    c.fillStyle = 'rgba(10,8,12,.8)'; c.fillRect(x - 70, y - 6, w + 80, h + 32);
    c.fillStyle = '#2a2024'; c.fillRect(x - 64, y, 54, 54); c.strokeStyle = boss ? '#ffd23a' : '#8a7a6a'; c.lineWidth = 2; c.strokeRect(x - 64, y, 54, 54);
    uiText(boss ? '领' : t.elite ? '精' : '怪', x - 37, y + 38, { size: 28, align: 'center', color: boss ? '#ffd23a' : '#ddd' });
    if (boss && idx > 0) { c.fillStyle = cols[(idx - 1) % 5]; c.fillRect(x, y, w, h); }
    else { c.fillStyle = '#300'; c.fillRect(x, y, w, h); }
    c.fillStyle = boss ? cols[idx % 5] : '#e83a3a'; c.fillRect(x, y, w * frac, h);
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
    uiText(`Lv.${t.lvl} ${t.name}`, x + 6, y + h + 22, { size: 20, color: boss ? '#ffd23a' : '#fff', sw: 4 });
    if (boss) uiText(`×${idx + 1}`, x + w - 4, y + h + 24, { size: 24, align: 'right', color: '#fff', sw: 5 });
  },
  drawCutin(c) {
    const k = game.cutin.t / game.cutin.dur, a = k < 0.12 ? k / 0.12 : k > 0.85 ? (1 - k) / 0.15 : 1;
    c.save(); c.globalAlpha = a;
    // 斜向色带 + 速度线
    c.save(); c.translate(0, 540); c.transform(1, -0.08, 0, 1, 0, 0);
    const band = c.createLinearGradient(0, 0, 1920, 0); band.addColorStop(0, 'rgba(255,190,60,.95)'); band.addColorStop(0.35, 'rgba(120,40,10,.92)'); band.addColorStop(1, 'rgba(20,6,2,.9)');
    c.fillStyle = band; c.fillRect(-40, -150, 2000, 300);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) { const y = ((i * 97 + game.t * 900 * (i % 3 + 1)) % 300) - 150, x = (i * 331 + game.t * 2600) % 2400 - 300; c.fillStyle = `rgba(255,230,160,${0.08 + (i % 4) * 0.05})`; c.fillRect(x, y, 260 + (i % 5) * 80, 2 + (i % 3)); }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#ffe070'; c.fillRect(-40, -152, 2000, 4); c.fillRect(-40, 148, 2000, 4);
    // 立绘：放大的角色上半身（从左侧滑入）
    c.beginPath(); c.rect(-40, -150, 2000, 300); c.clip();
    const who = game.cutin.who, ease = easeOutBack(Math.min(1, k / 0.25)), art = who && IMG[`cutin/${who.cls}`];
    if (art) { const h = 520, w = art.width * h / art.height; c.drawImage(art, -260 + ease * 520 - w * 0.1, -h / 2 - 20, w, h); }   // 手绘觉醒立绘
    else { c.translate(-200 + ease * 620, 98 * 8 + 40); c.scale(8, 8); who.model.draw(c, P(POSE.idle, { uaF: 150, faF: 40, wF: 25, head: 2, torso: -4 }), game.t, { glow: 1 }); }
    c.restore();
    uiText(game.cutin.name, 1420 - (1 - ease) * 200, 575, { size: 104, align: 'center', color: '#fff4c0', sw: 12, stroke: '#3a1400', font: '"PingFang SC","Microsoft YaHei",serif', weight: 900 });
    uiText('AWAKENING', 1420, 625, { size: 30, align: 'center', color: '#ffd23a', sw: 5, font: '"Arial Black",sans-serif', weight: 900 });
    c.restore();
  },
};
