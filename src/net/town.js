/* =====================================================================
   城镇同屏：同一个场景里的在线玩家互相可见（名字、等级、职业 / 转职、外观：武器与时装），位置插值平滑；点击玩家弹出菜单
   - 自己：进场景发 scene，城镇里 10Hz 发位置（静止时 1 秒一次），角色信息（hello）在进游戏 / 升级 / 转职 / 换装时发
   - 别人：NetPeer 放进 world.crowd（和路人一起按纵深排序绘制，不参与战斗），画法和路人一样（SpriteModel + 外观层），60fps 下每人只多几次 drawImage
   ===================================================================== */
const NET_INTERP_DELAY = 140;   // 插值延迟（毫秒）：位置 10Hz 更新，留 1.4 帧的缓冲，网络抖动时也平滑
class NetPeer {
  constructor(p) {
    Object.assign(this, { id: p.id, acct: p.name, name: p.name, job: '', char: null, x: p.x || 0, y: p.y || 100, z: 0, face: p.f || 1, st: p.s || 'idle', a: 0, fade: 1, buf: [], model: null, seed: Math.random() * 99, net: true, cls: null });
    this.pose = { __c: 'idle', __t: 0 };
    this.setChar(p.char); this.push(p.x, p.y, p.f, p.s);
  }
  setChar(ch) {
    if (!ch) return;
    const old = this.char; this.char = ch;
    // 名牌文字（world.js 的 drawCrowdLabels 按 name / guild 两行排版避让）：第一行 Lv + 角色名，上面一行职业 / 转职
    const J = ch.job && CLASSES[ch.cls] && CLASSES[ch.cls].jobs && CLASSES[ch.cls].jobs[ch.job];
    this.name = `Lv.${ch.lvl} ${ch.name}`; this.job = J ? J.name : (CLASSES[ch.cls] ? CLASSES[ch.cls].name : '');
    const lookSig = JSON.stringify(ch.look || {});
    if (old && old.cls === ch.cls && this.lookSig === lookSig && this.model) return;
    this.lookSig = lookSig; this.cls = CLASSES[ch.cls] && SPR_DATA[ch.cls] ? ch.cls : 'sword';
    const cls = this.cls, look = ch.look || null;
    const make = () => { if (this.cls !== cls) return; this.model = new SpriteModel(cls, SPR_FALLBACK, SPR_ANIMS[cls]); if (typeof avatarSetLook === 'function' && look) avatarSetLook(this.model, look); };
    if (typeof cashAttach === 'function') { try { cashAttach(this, look && look.cash || null); } catch (e) { /* 商城外观可选 */ } }
    if (IMG[`spr/${cls}/idle`] && IMG[`spr/${cls}/walk1`]) make(); else loadArtKeys(crowdFrames(cls)).then(make);
  }
  push(x, y, f, s) {
    if (typeof x !== 'number') return;
    this.buf.push({ t: performance.now(), x, y, f: f < 0 ? -1 : 1, s: s || 'idle' });
    if (this.buf.length > 30) this.buf.splice(0, this.buf.length - 30);
  }
  update(dt) {
    this.a = clamp(this.a + dt * 3 * this.fade, 0, 1);
    if (this.fade < 0 && this.a <= 0) { this.gone = true; return; }
    const B = this.buf, rt = performance.now() - NET_INTERP_DELAY;
    if (B.length) {
      while (B.length > 2 && B[1].t <= rt) B.shift();
      const A = B[0], N = B[1];
      let tx, ty;
      if (N && rt > A.t) { const k = clamp((rt - A.t) / Math.max(1, N.t - A.t), 0, 1); tx = lerp(A.x, N.x, k); ty = lerp(A.y, N.y, k); const s = k < 0.5 ? A : N; this.face = s.f; this.st = s.s; }
      else { tx = A.x; ty = A.y; this.face = A.f; this.st = A.s; }
      // 缓冲用完（包晚到）：按最后的速度最多外推 150 毫秒，别停一下再跳
      const L = B[B.length - 1], P0 = B[B.length - 2];
      if (rt > L.t && P0 && L.s !== 'idle') { const e = Math.min(150, rt - L.t) / Math.max(1, L.t - P0.t); tx = L.x + (L.x - P0.x) * e; ty = L.y + (L.y - P0.y) * e; }
      // 最后再平滑一下（纠正外推误差，不会瞬移；离太远就直接跳过去）
      if (Math.abs(tx - this.x) > 200 || Math.abs(ty - this.y) > 120) { this.x = tx; this.y = ty; }
      else { this.x = damp(this.x, tx, 25, dt); this.y = damp(this.y, ty, 25, dt); }
    }
    const want = this.st === 'run' ? 'run' : this.st === 'walk' ? 'walk' : 'idle';
    if (this.pose.__c !== want) { this.pose.__c = want; this.pose.__t = 0; } else this.pose.__t += dt;
  }
  drawShadow(c) { if (this.a <= 0) return; const X = sx(this.x), Y = sy(this.y); if (X < -60 || X > WW + 60) return; c.fillStyle = `rgba(0,0,0,${0.32 * this.a})`; c.beginPath(); c.ellipse(X, Y, 19, 6, 0, 0, TAU); c.fill(); }
  draw(c) {
    const X = sx(this.x), Y = sy(this.y); if (this.a <= 0 || X < -90 || X > WW + 90) return;
    if (this.model) { c.save(); c.globalAlpha = this.a; c.translate(X, Y); c.scale(this.face, 1); this.model.draw(c, this.pose, game.t + this.seed, NO_OPTS); c.restore(); }
  }
  // 名牌：所有角色画完后由 world.js 的 drawCrowdLabels 统一画（和路人、NPC 名牌互相避让）
  drawLabel(c, X, ny) { netNamePlate(c, X, ny, this.char, this.acct, this.id, this.a, netTown.hover === this); }
  // 名牌第二行（drawCrowdLabels 按它算宽度避让）：〈公会〉 + 职业 / 转职
  get guild() { const t = netTagOf(this.id); return t ? `<${t}> ${this.job}` : this.job; }
  hit(mx, my) { const X = this.x, top = FLOOR_Y + this.y - 112, bot = FLOOR_Y + this.y + 6; return Math.abs(mx - X) < 24 && my > top && my < bot; }
}
// 头顶名牌：Lv + 角色名（颜色：队友橙、好友绿、其他蓝）+ 小字职业 / 转职；鼠标悬停时加底框
// 名牌上的额外标签（公会名等）：其他组定义全局函数 netPlayerTag(userId) → 字符串 | null，画在职业那一行前面（绿色）
function netTagOf(id) { if (typeof netPlayerTag !== 'function') return null; try { const t = netPlayerTag(id); return t ? String(t).slice(0, 12) : null; } catch (e) { return null; } }
function netNamePlate(c, X, ny, ch, acct, id, a = 1, hot = false) {
  if (!ch) return;
  const J = ch.job && CLASSES[ch.cls] && CLASSES[ch.cls].jobs && CLASSES[ch.cls].jobs[ch.job];
  const col = netParty.has(id) ? '#ffb24a' : netFriends.isFriend(id) ? '#8aff9a' : '#9fdcff';
  const t1 = `Lv.${ch.lvl} ${ch.name}`, t2 = J ? J.name : (CLASSES[ch.cls] ? CLASSES[ch.cls].name : '');
  c.save(); c.globalAlpha = a; c.textAlign = 'center';
  c.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
  if (hot) { const w = c.measureText(t1).width + 14; c.fillStyle = 'rgba(10,8,14,.75)'; c.fillRect(X - w / 2, ny - 22, w, 27); c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(X - w / 2 + 0.5, ny - 21.5, w - 1, 26); }
  c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(t1, X, ny); c.fillStyle = col; c.fillText(t1, X, ny);
  const tag = netTagOf(id);
  if (tag) {   // 〈公会〉 职业：两段颜色，整体居中
    c.font = 'bold 8px "PingFang SC","Microsoft YaHei",sans-serif';
    const a1 = `<${tag}> `, w1 = c.measureText(a1).width, w2 = c.measureText(t2).width, x0 = X - (w1 + w2) / 2;
    c.textAlign = 'left'; c.strokeText(a1 + t2, x0, ny - 11); c.fillStyle = '#9aff7a'; c.fillText(a1, x0, ny - 11); c.fillStyle = '#e8dcc0'; c.fillText(t2, x0 + w1, ny - 11); c.textAlign = 'center';
  } else if (t2) { c.font = 'bold 8px "PingFang SC","Microsoft YaHei",sans-serif'; c.strokeText(t2, X, ny - 11); c.fillStyle = '#e8dcc0'; c.fillText(t2, X, ny - 11); }
  c.restore();
}
// 自己的角色信息（发给别人看的）
function netCharInfo() {
  const d = save.data, p = game.player; if (!d || !p || !save.live) return null;
  let look = null; try { look = typeof lookFromEquip === 'function' ? lookFromEquip(p.cls, inv.equip) : null; } catch (e) { look = null; }
  if (look && typeof cashLook === 'function') { try { look = { ...look, cash: cashLook(inv.equip) }; } catch (e) { /* 商城外观可选 */ } }
  return { name: d.name || CLASSES[p.cls].name, cls: p.cls, job: game.job || null, lvl: game.lvl, look, title: null, hp: p.hpMax ? clamp(p.hp / p.hpMax, 0, 1) : 1 };
}
const netTown = {
  peers: new Map(), scene: null, sent: null, sentT: 0, helloSig: '', hover: null, timer: 0,
  hello(force) {
    const ch = netCharInfo(); if (!ch || !net.connected) return;
    const sig = JSON.stringify({ ...ch, hp: 0 });
    if (!force && sig === this.helloSig) return;
    this.helloSig = sig; net.send({ t: 'hello', char: ch });
  },
  // 当前应该在哪个场景频道（只有城镇 / 区域场景）
  wantScene() { return netOn() && game.scene === 'town' && world && game.player && save.live && !game.duel ? world.S.id : null; },
  sync() {
    if (!net.connected) return;
    const want = this.wantScene();
    if (want) this.hello();
    if (want !== this.scene) {
      const p = game.player;
      this.scene = want; this.clear();
      net.send(want ? { t: 'scene', id: want, x: Math.round(p.x), y: Math.round(p.y), f: p.face } : { t: 'scene', id: null });
      this.sent = null;
    }
    if (!want) return;
    const p = game.player, s = p.st === 'run' ? 'run' : p.st === 'walk' ? 'walk' : 'idle', now = performance.now();
    const cur = { x: Math.round(p.x), y: Math.round(p.y), f: p.face < 0 ? -1 : 1, s };
    const L = this.sent, moved = !L || L.x !== cur.x || L.y !== cur.y || L.f !== cur.f || L.s !== cur.s;
    if (moved || now - this.sentT > 1000) { net.send({ t: 'pos', ...cur }); this.sent = cur; this.sentT = now; }
  },
  clear() { for (const P of this.peers.values()) P.gone = true; this.peers.clear(); this.hover = null; },
  add(p) {
    if (!world || world.S.id !== this.scene || (net.user && p.id === net.user.id)) return;
    let P = this.peers.get(p.id);
    if (P) { P.setChar(p.char); P.push(p.x, p.y, p.f, p.s); P.fade = 1; return; }
    P = new NetPeer(p); this.peers.set(p.id, P); world.crowd.push(P);
  },
  // 鼠标：悬停高亮 / 点击弹出玩家菜单（在 world.js 的 NPC 点击之前处理，点到玩家就不再当作点 NPC）
  pick(ev) {
    if (game.scene !== 'town' || !world || !this.peers.size || menus.modal()) return null;
    const r = wcan.getBoundingClientRect(), mx = (ev.clientX - r.left) / r.width * WW + cam.x, my = (ev.clientY - r.top) / r.height * WH;
    let best = null, bd = 1e9;
    for (const P of this.peers.values()) if (P.a > 0.3 && P.hit(mx, my)) { const d = Math.abs(P.x - mx); if (d < bd) { bd = d; best = P; } }
    return best;
  },
};
net.on('peers', m => { if (m.scene !== netTown.scene) return; netTown.clear(); for (const p of m.list) netTown.add(p); });
net.on('penter', m => netTown.add(m.p));
net.on('pleave', m => { const P = netTown.peers.get(m.id); if (P) { P.fade = -1; netTown.peers.delete(m.id); if (netTown.hover === P) netTown.hover = null; } });
net.on('pos', m => { const P = netTown.peers.get(m.id); if (P) P.push(m.x, m.y, m.f, m.s); });
net.on('pchar', m => { const P = netTown.peers.get(m.id); if (P) P.setChar(m.char); });
// 连上 / 重连：重新报到（服务端那边的场景状态已经清掉了）
bus.on('netOpen', () => { netTown.scene = null; netTown.helloSig = ''; netTown.hello(true); netTown.sync(); });
bus.on('netClose', () => { netTown.scene = null; netTown.clear(); });
bus.on('sceneEnter', () => { netTown.hello(); netTown.sync(); });
for (const ev of ['levelUp', 'jobChange', 'equip']) bus.on(ev, () => setTimeout(() => netTown.hello(), 50));
bus.on('charLeave', () => { netTown.helloSig = ''; setTimeout(() => netTown.sync(), 0); });
netTown.tick = 0;
netTown.timer = setInterval(() => { if (netOn()) { netTown.sync(); if (++netTown.tick % 20 === 0) netTown.hello(); } }, 100);
wcan.addEventListener('click', ev => {
  const P = netTown.pick(ev); if (!P) return;
  ev.stopImmediatePropagation(); sfx.click();
  netPlayerMenu({ id: P.id, name: P.acct, char: P.char }, ev);
}, true);
addEventListener('pointermove', ev => {
  if (game.scene !== 'town' || !netTown.peers.size) { netTown.hover = null; return; }
  const P = netTown.pick(ev); netTown.hover = P;
  if (P) wcan.style.cursor = 'pointer';
});
