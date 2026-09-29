// 动作手感体检（docs/ANIMATION.md）：停掉 rAF，逐个 60Hz 逻辑步驱动固定的输入序列（走 / 起步 / 跑 / 停 / 转身 / 跳 / 普攻 1~3 / 跑攻），
// 每一步记下角色状态和所画的帧，算出：帧停留时长分布、身体（头部锚点）跳动、脚底打滑比、相机-角色相对抖动；
// 另外用合成的显示器时间戳（60 / 120 ProMotion / 144 / 90 / 75Hz + 抖动）驱动真实的 frame()，统计“0 步 / 2 步”帧和画面位置误差。
//   node test/animfeel.mjs [职业[:转职]] [输出名] [--town] [--pace] [--look=套装]
//   输出：test/shots/animfeel/<输出名>.json（指标）、<输出名>_<段>.png（逐步连拍，每格一个逻辑步）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const args = process.argv.slice(2), flags = new Set(args.filter(a => a.startsWith('--')).map(a => a.split('=')[0]));
const pos = args.filter(a => !a.startsWith('--')), [cls, job] = (pos[0] || 'sword').split(':'), tag = pos[1] || `${cls}${job ? '-' + job : ''}`;
const look = (args.find(a => a.startsWith('--look=')) || '').split('=')[1] || '';
const town = flags.has('--town'), out = 'test/shots/animfeel'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?${town ? 'town' : 'test'}&mute&cls=${cls}&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 180000 });
await page.evaluate(async ({ job, look }) => {
  if (game.scene === 'town') { await enterScene('hendon_myre', { x: 1100, y: 110, face: 1 }); await new Promise(r => setTimeout(r, 300)); }   // 城镇：换到够宽的赫顿玛尔（出生的房间只有 960 宽）
  window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 120));   // 停掉主循环，下面逐步手动驱动
  if (typeof menus !== 'undefined') for (const k of ['help', 'title']) if (menus.isOpen && menus.isOpen(k)) menus.close(k);
  const p = game.player; game.job = job || null; if (typeof recalcStats === 'function') recalcStats(p);
  if (job && typeof swordActs === 'function' && p.cls === 'sword') p.acts = swordActs(p);
  if (look && p.model.av) { const L = { ...defaultLook(p.cls), set: look }; avatarSetLook(p.model, L); await loadBundles([`spr:${p.cls}@${look}`]); avatarSetLook(p.model, L); }
  for (const e of ents) if (e.team === 'e') e.remove = true;
  p.x = game.scene === 'town' ? 1100 : 360; p.y = 110; p.face = 1; p.mpMax = p.mp = 9999;
  cam.x = clamp(p.x + 70 - WW / 2, game.room.x0, game.room.x1 - WW);
  const footCache = {};
  const feet = (m, f) => {   // 这一帧贴地的脚：锚点下方 6 像素内的不透明列，聚成块 → 相对锚点的世界坐标（朝右）
    if (footCache[f]) return footCache[f];
    const F = m.S.frames[f], im = m.img[f]; if (!F || !im) return (footCache[f] = []);
    const [cv, x] = offCanvas(im.width, im.height); x.drawImage(im, 0, 0);
    const y1 = Math.min(im.height, Math.round(F.ay) + 1), y0 = Math.max(0, Math.min(y1 - 1, Math.round(F.ay) - 6)), d = x.getImageData(0, y0, im.width, y1 - y0).data, W = im.width;
    const col = []; for (let i = 0; i < W; i++) { let on = false; for (let r = 0; r < y1 - y0; r++) if (d[(r * W + i) * 4 + 3] > 60) { on = true; break; } col.push(on); }
    const cl = []; let s = -1; for (let i = 0; i <= W; i++) { if (i < W && col[i]) { if (s < 0) s = i; } else if (s >= 0) { if (i - s >= 3) cl.push(((s + i - 1) / 2 - F.ax) / m.S.res); s = -1; } }
    return (footCache[f] = cl);
  };
  window.__af = { rec: [], crops: {}, seg: '' };
  // 一个逻辑步：写入本步按键（held = 按住，press = 本步按下）→ step → 画一帧 → 记录
  window.__afStep = (held, press, crop) => {
    input.virt = {}; for (const k of held) input.virt[k] = 1; for (const k of press) input.virt[k] = 2;
    step(1 / 60); renderWorld();
    const p = game.player, m = p.model, f = m.frameOf ? m.frameOf(p.pose) : '', F = m.S && m.S.frames[f], res = m.S ? m.S.res : 1;
    const X = sx(p.x), Y = sy(p.y, 0), r = { seg: __af.seg, st: p.st, clip: p.clipName, f, animT: +p.animT.toFixed(4), x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2), face: p.face, cam: +cam.x.toFixed(3), scr: X, act: p.act ? p.act.name : null };
    if (F && F.head) {   // 画出来的头部位置（相对实体锚点，朝右）：含循环动作的起伏修正和换帧缓动（新代码才有）
      let hx = F.head.x - F.ax, hy = F.head.y - F.ay;
      const A = m.anims && m.anims[p.pose.__c], N = typeof sprLoopNorm === 'function' && A && A.frames && SPR_LOOP_NORM[p.pose.__c] ? sprLoopNorm(m, p.pose.__c, A) : null;
      if (N && N[f]) { hx += N[f][0] * hy; hy *= N[f][1]; }
      r.hx = +(hx / res + (m.eo || 0)).toFixed(2); r.hy = +(hy / res).toFixed(2);
    }
    if (m.S) r.feet = feet(m, f).map(v => +v.toFixed(1));
    if (crop) {
      const cw = 150, ch = 160, [cv, x] = offCanvas(cw, ch);
      x.drawImage(wcan, (X - 75) * RS, (Y - 140) * RS, cw * RS, ch * RS, 0, 0, cw, ch);
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, cw, 11); x.fillStyle = '#fff'; x.font = '9px sans-serif'; x.fillText(`${__af.rec.length} ${f}`, 2, 9);
      (__af.crops[__af.seg] = __af.crops[__af.seg] || []).push(cv);
    }
    __af.rec.push(r);
  };
  window.__afSheet = (seg, cols = 12) => {
    const L = __af.crops[seg] || []; if (!L.length) return null;
    const cw = L[0].width, ch = L[0].height, rows = Math.ceil(L.length / cols), [cv, x] = offCanvas(cw * Math.min(cols, L.length), ch * rows);
    L.forEach((c, i) => x.drawImage(c, (i % cols) * cw, Math.floor(i / cols) * ch));
    return cv.toDataURL('image/png');
  };
}, { job, look });

// ---- 输入序列 ----
const S = async (seg, n, held = [], press = [], crop = true) => {
  await page.evaluate(({ seg, n, held, press, crop }) => { __af.seg = seg; for (let i = 0; i < n; i++) __afStep(held, i === 0 ? press : [], crop); }, { seg, n, held, press, crop });
};
await S('idle', 12, [], [], false);
await S('walk', 70, ['right'], ['right']);
await S('stop', 16);
await S('run', 1, [], ['right']); await S('run', 3); await S('run', 96, ['right'], ['right']);   // 双击跑
await S('runstop', 16);
await S('turn', 1, [], ['left']); await S('turn', 3); await S('turn', 40, ['left'], ['left']);   // 反向跑
await S('turn', 30, ['right'], ['right']);                                                       // 跑动中转身（变成走）
await S('jump', 50, [], ['jump']);
await S('settle', 12, [], [], false);
for (let i = 0; i < 3; i++) await S('combo', 14, [], ['attack']);
await S('combo', 24);
await S('dashatk', 1, [], ['right']); await S('dashatk', 3, [], [], false); await S('dashatk', 24, ['right'], ['right']); await S('dashatk', 36, ['right'], ['attack']);
await S('end', 20, [], [], false);
const rec = await page.evaluate(() => __af.rec);

// ---- 指标 ----
const bySeg = s => rec.filter(r => r.seg === s);
const holds = (R, clip) => { const h = []; let n = 0, prev = null; for (const r of R) { if (r.clip !== clip) { prev = null; n = 0; continue; } if (r.f === prev) n++; else { if (prev !== null) h.push(n); n = 1; prev = r.f; } } return h.slice(1); };   // 去掉头一个（片段开头可能不完整）
const hist = a => a.reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {});
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0, rms = a => Math.sqrt(mean(a.map(v => v * v)));
function loco(R, clip) {
  const L = R.filter(r => r.clip === clip), H = holds(R, clip);
  const pops = []; for (let i = 1; i < L.length; i++) if (L[i].hy !== undefined && L[i - 1].hy !== undefined) { const d = Math.hypot(L[i].hx - L[i - 1].hx, L[i].hy - L[i - 1].hy); if (d > 0.3) pops.push(d); }   // 每个逻辑步头部（相对锚点）的位移
  // 步幅匹配：相邻两张不同的帧之间，贴地的脚相对锚点往后挪了多少（= 画面上“地面被蹬过去”的距离），一圈加起来 / 同期身体走的距离（1 = 脚钉在地上，< 1 = 脚往前滑）
  let art = 0, body = 0, last = null;
  for (let i = 1; i < L.length; i++) {
    body += Math.hypot(L[i].x - L[i - 1].x, L[i].y - L[i - 1].y);
    if (L[i].f === L[i - 1].f) continue;
    const P = last || L[i - 1].feet || [], N = L[i].feet || [];
    let best = null; for (const a of P) for (const b of N) { const d = a - b; if (d >= -1 && d <= 36 && (best === null || d < best)) best = d; }
    if (best !== null) art += Math.max(0, best);
    last = N;
  }
  const hy = L.map(r => r.hy).filter(v => v !== undefined), hx = L.map(r => r.hx).filter(v => v !== undefined);
  return { ticks: L.length, holdHist: hist(H), holdMean: +mean(H).toFixed(2), holdCV: +(Math.sqrt(mean(H.map(v => (v - mean(H)) ** 2))) / (mean(H) || 1)).toFixed(3),
    headJumpMean: +mean(pops).toFixed(2), headJumpMax: +Math.max(0, ...pops).toFixed(2), headBobY: hy.length ? +(Math.max(...hy) - Math.min(...hy)).toFixed(2) : null, headSwayX: hx.length ? +(Math.max(...hx) - Math.min(...hx)).toFixed(2) : null,
    speed: +mean(L.slice(1).map((r, i) => Math.hypot(r.x - L[i].x, r.y - L[i].y) * 60)).toFixed(1), strideMatch: body ? +(art / body).toFixed(3) : null };
}
function camJitter(R) {   // 画面上角色（头部）位置的逐步二阶差分：越小越稳；另记背景滚动量的分布
  const hs = R.map(r => r.scr + (r.hx || 0) * r.face), d2 = []; for (let i = 2; i < hs.length; i++) d2.push(hs[i] - 2 * hs[i - 1] + hs[i - 2]);
  const scroll = R.slice(1).map((r, i) => +(r.cam - R[i].cam).toFixed(2)), ca = scroll.slice(1).map((v, i) => Math.abs(v - scroll[i]));   // 相机每步滚动量、滚动量的变化（相机加速度，突变 = 画面“甩一下”）
  return { headScreenD2rms: +rms(d2).toFixed(3), headScreenD2max: +Math.max(0, ...d2.map(Math.abs)).toFixed(2), scrollMin: Math.min(...scroll), scrollMax: Math.max(...scroll), camAccMax: +Math.max(0, ...ca).toFixed(2) };
}
function actPops(R) {   // 动作里相邻两帧身体（头部）的跳动，按动作名分组
  const o = {};
  for (let i = 1; i < R.length; i++) { const a = R[i], b = R[i - 1]; if (a.hy === undefined || b.hy === undefined || !a.act) continue; const d = Math.hypot(a.hx - b.hx, a.hy - b.hy); if (d > 0.3) (o[a.act] = o[a.act] || []).push(+d.toFixed(1)); }   // 每个逻辑步头部的位移（换帧瞬移 / 缓动都算）
  const seq = {}; for (const r of R) if (r.act) { const s = seq[r.act] = seq[r.act] || []; if (!s.length || s[s.length - 1][0] !== r.f) s.push([r.f, 1]); else s[s.length - 1][1]++; }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { jumps: v, max: Math.max(...v), frames: (seq[k] || []).map(([f, n]) => `${f}×${n}`).join(' ') }]));
}
const run = bySeg('run').slice(24), walk = bySeg('walk').slice(6);
const M = { cls, job: job || null, look: look || null, town, walk: loco(walk, 'walk'), run: loco(run, 'run'), turnRun: loco(bySeg('turn').slice(20, 44), 'run'),
  camRun: camJitter(run), camWalk: camJitter(walk), camStop: camJitter(bySeg('runstop')), camTurn: camJitter(bySeg('turn')),
  acts: actPops([...bySeg('combo'), ...bySeg('dashatk'), ...bySeg('jump')]) };

// ---- 帧节奏：合成显示器时间戳驱动真实的 frame()（限帧 + 累加器 + 渲染），统计每个画面走了几步、画面上的位置误差 ----
if (flags.has('--pace')) {
  M.pace = await page.evaluate(() => {
    const p = game.player, prof = { '60Hz': [16.667, 0.35, 0], '60Hz+忙': [16.667, 0.35, 0.04], '120Hz ProMotion': [8.333, 0.35, 0.02], '144Hz': [6.944, 0.3, 0], '90Hz': [11.111, 0.35, 0], '75Hz': [13.333, 0.3, 0] };
    const R = {}; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
    const rw = renderWorld; let shot = null;
    renderWorld = () => { rw(); shot = { t: game.t, cam: cam.x, px: p.x, scr: sx(p.x), bg: -(cam.x - game.room.x0) }; };
    for (const [name, [iv, jit, late]] of Object.entries(prof)) {
      p.x = 300; p.face = 1; cam.x = clamp(p.x + 70 - WW / 2, game.room.x0, game.room.x1 - WW); game.room.x1 = Math.max(game.room.x1, 9000);
      input.virt = { right: 1 }; input.runDir = 1; p.setState('run');
      for (let i = 0; i < 60; i++) { input.virt = { right: 1 }; input.runDir = 1; step(1 / 60); }   // 先跑到稳态（相机跟上）
      let now = 1e5, k = 0; lastT = now; lastFrameT = now - 20; acc = 0;
      const shots = [];
      for (let i = 0; i < 600; i++) {
        k++; now = 1e5 + k * iv + gauss() * jit; if (rnd() < late) { k++; now += iv; }   // 偶尔丢一个垂直同步（忙）
        input.virt = { right: 1 }; input.runDir = 1; shot = null; frame(now);
        if (shot) shots.push({ now, ...shot });
      }
      // 理想：画面内容随显示时刻匀速前进。用画出来的背景偏移对显示时刻做线性拟合，看残差
      const n = shots.length, T = shots.map(s => s.now / 1000), B = shots.map(s => s.bg), mt = T.reduce((a, b) => a + b) / n, mb = B.reduce((a, b) => a + b) / n;
      let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (T[i] - mt) * (B[i] - mb); sxx += (T[i] - mt) ** 2; }
      const v = sxy / sxx, resid = B.map((b, i) => b - (mb + v * (T[i] - mt)));
      const steps = shots.slice(1).map((s, i) => Math.round((s.t - shots[i].t) * 60)), sh = {}; for (const s of steps) sh[s] = (sh[s] || 0) + 1;
      const jerk = []; for (let i = 2; i < n; i++) { const d1 = (B[i] - B[i - 1]) / (T[i] - T[i - 1]), d0 = (B[i - 1] - B[i - 2]) / (T[i - 1] - T[i - 2]); jerk.push(Math.abs(d1 - d0) / Math.abs(v)); }
      R[name] = { frames: n, stepsPerFrame: sh, uneven: +(steps.filter(s => s !== Math.round(mean(steps))).length / steps.length).toFixed(3), bgErrRms: +Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / n).toFixed(2), bgErrMax: +Math.max(...resid.map(Math.abs)).toFixed(2), speedJerkP95: +jerk.sort((a, b) => a - b)[Math.floor(jerk.length * 0.95)].toFixed(3) };
    }
    renderWorld = rw; return R;
    function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
  });
}
fs.writeFileSync(`${out}/${tag}.json`, JSON.stringify({ metrics: M, rec }, null, 0));
for (const seg of ['walk', 'run', 'runstop', 'turn', 'jump', 'combo', 'dashatk']) {
  const url = await page.evaluate(s => __afSheet(s, 16), seg); if (url) fs.writeFileSync(`${out}/${tag}_${seg}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
const errs = logs.filter(l => l.type === 'pageerror');
console.log(JSON.stringify(M, null, 1).replace(/\n\s+(?=[\d\-"\]}])/g, ' '));
if (errs.length) { console.log('页面报错', errs.slice(0, 3)); process.exitCode = 1; }
await browser.close();
