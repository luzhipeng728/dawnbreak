// 面子系统测试：node test/vanity.mjs [shots]（先 node build.mjs）
//   1. 武器光效阶梯：+10 / +12 / +13 有光效且各不相同；增幅和强化不同；+10 起相邻等级的参数都不一样
//   2. 城镇移速：无装扮 / 3 件 / 8 件高级套 / 8 件天空套；地下城（测试场景）和决斗里为 0
//   3. 联机：自己发出去的 look 带 glow；其他玩家（NetPeer）收到后外观层有光效
//   4. 帧率：城镇里 8 个穿天空套、+13~+16 武器的玩家走来走去 + 自己，要稳定 55fps 以上
//   shots：把 +7~+16、增幅 +10/+13/+16、天空套两套、挥砍拖尾、提示框 / 状态窗口拼成一张总览图 test/shots/vanity/sheet.png
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const SHOTS = process.argv.includes('shots');
const out = 'test/shots/vanity'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, msg, x = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + msg, x); if (!c) fail++; };

const HELP = () => {
  window.__v = {
    weapon(lv, amp) { inv.ensure(); const w = inv.equip.weapon; w.enh = lv; if (amp) w.dim = 'str'; else delete w.dim; bus.emit('enhance', { item: w, ok: true, lvl: lv }); return w; },
    strip() { inv.ensure(); for (const s of AV_SLOTS) delete inv.equip[s]; recalcStats(game.player); bus.emit('unequip', {}); },
    wear(set, n = 8) { for (const s of AV_PIECE_SLOTS.slice(0, n)) { const it = makeItem(avKey(set, s)); inv.add(it); inv.wear(it); } },
    peer(i, look, x, y) { const P = new NetPeer({ id: 900 + i, name: 'p' + i, x, y, f: 1, s: 'idle' }); P.setChar({ name: '勇士' + i, cls: 'sword', lvl: 70, look }); P.a = 1; world.crowd.push(P); return P; },
    // 按住方向键若干帧后读水平速度
    async vx(dir = 'right', ms = 300) { input.virt[dir] = 1; await new Promise(r => setTimeout(r, ms)); const v = Math.abs(game.player.vx); delete input.virt[dir]; return v; },
  };
};

const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(600);
await page.evaluate(HELP);
await page.evaluate(async () => { enterScene('hm_plaza'); for (let i = 0; i < 60 && !(world.S.id === 'hm_plaza' && world.crowd.length); i++) await new Promise(r => setTimeout(r, 100)); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });

console.log('1. 武器光效阶梯');
const r1 = await page.evaluate(() => {
  const at = (lv, amp) => { const w = __v.weapon(lv, amp); return { look: lookFromEquip('sword', inv.equip).glow, row: vanityGlowRow(vanityGlowOf(w)) }; };
  const e = {}; for (const lv of [4, 9, 10, 12, 13, 16]) e[lv] = at(lv, 0);
  const a13 = at(13, 1);
  const sig = R => JSON.stringify([R.col, R.col2, R.a, R.r, R.pulse, R.spark, R.trail, R.flare, R.ground, R.arcs]);
  const diff = T => { const bad = []; for (let lv = 10; lv < 16; lv++) if (sig(T[lv]) === sig(T[lv + 1])) bad.push(lv); return bad; };
  // 自己的外观层真的拿到了光效（画一帧）
  __v.weapon(13, 0); const m = game.player.model; renderWorld(); const own = m.av && m.av.glow && m.av.glow.lv;
  return { e4: e[4].look, e10: e[10].row && e[10].row.nm, e12: e[12].row && e[12].row.nm, e13: e[13].row && e[13].row.nm, look13: e[13].look,
    s10: sig(e[10].row), s12: sig(e[12].row), s13: sig(e[13].row), a13: sig(a13.row), a13look: a13.look, enhBad: diff(GLOW_ENH), ampBad: diff(GLOW_AMP),
    trail13: e[13].row.trail, flare13: e[13].row.flare, flare12: e[12].row.flare, ground15: GLOW_ENH[15].ground, arcs16: GLOW_ENH[16].arcs, own };
});
ok(r1.e4 === null, '+4 没有光效（只有名字颜色）', JSON.stringify(r1.e4));
ok(r1.e10 && r1.e12 && r1.e13, `+10 / +12 / +13 都有光效：${r1.e10} / ${r1.e12} / ${r1.e13}`);
ok(new Set([r1.s10, r1.s12, r1.s13]).size === 3, '+10 / +12 / +13 三档参数各不相同');
ok(r1.a13 !== r1.s13 && r1.a13look && r1.a13look.amp === 1, '增幅 +13 和强化 +13 光效不同，look 里标了 amp', JSON.stringify(r1.a13look));
ok(!r1.enhBad.length && !r1.ampBad.length, '+10 起相邻等级（强化 / 增幅）视觉参数都不一样', JSON.stringify([r1.enhBad, r1.ampBad]));
ok(r1.trail13 > 0 && r1.flare13 > 0 && !r1.flare12 && r1.ground15 && r1.arcs16, '+13 起待机爆闪、+15 脚下光环、+16 电弧');
ok(r1.look13 && r1.look13.lv === 13 && r1.own === 13, '自己的外观层拿到 +13 光效', JSON.stringify(r1.look13));

console.log('2. 城镇移速');
const r2 = await page.evaluate(async () => {
  const res = {}, p = game.player;
  __v.strip(); res.none = vanityTownSpd(inv.equip); res.vNone = await __v.vx(); res.base = p.speed;
  __v.wear('av_spring', 3); res.three = vanityTownSpd(inv.equip);
  __v.strip(); __v.wear('av_spring', 8); res.adv8 = vanityTownSpd(inv.equip);
  __v.strip(); __v.wear('av_sky1', 8); res.sky8 = vanityTownSpd(inv.equip); res.mulTown = vanityTownMul(); res.vSky = await __v.vx('left');
  res.inStats = 'townSpd' in (p.stats || {}); res.desc = SETS.av_sky1.bonus[8].desc; res.line = vanityStatusLine().textContent;
  return res;
});
ok(r2.none === 0 && Math.abs(r2.vNone - r2.base) < 1, '无装扮：+0%，城镇走路速度不变', `${r2.vNone}/${r2.base}`);
ok(r2.three === 0.06, '3 件高级装扮：+6%', r2.three);
ok(r2.adv8 === 0.3, '8 件高级装扮套：+30%', r2.adv8);
ok(r2.sky8 === 0.6 && Math.abs(r2.mulTown - 1.6) < 1e-6, '8 件天空套：+60%', r2.sky8);
ok(Math.abs(r2.vSky - r2.base * 1.6) < 2, '城镇里实际走路速度 ×1.6', `${r2.vSky.toFixed(1)} vs ${r2.base}`);
ok(!r2.inStats && /城镇移动速度 \+36%/.test(r2.desc) && /\+60%/.test(r2.line), '不进面板属性；套装说明 / 状态窗口写了城镇移速', r2.line);

console.log('3. 联机外观');
const r3 = await page.evaluate(async () => {
  __v.weapon(16, 1); const ch = netCharInfo();
  const P = __v.peer(0, ch.look, game.player.x + 80, game.player.y);
  for (let i = 0; i < 60 && !(P.model && P.model.av && P.model.av.glow); i++) { renderWorld(); await new Promise(r => setTimeout(r, 50)); }
  const g = P.model && P.model.av && P.model.av.glow;
  const r = { sent: ch.look.glow, sky: ch.look.cash && ch.look.cash.sky8, peer: g && [g.lv, g.amp], attached: !!cashAttached.get(P) };
  world.crowd.splice(world.crowd.indexOf(P), 1); cashDetach(P); return r;
});
ok(r3.sent && r3.sent.lv === 16 && r3.sent.amp === 1, '自己发出去的 look 带光效等级', JSON.stringify(r3.sent));
ok(r3.peer && r3.peer[0] === 16 && r3.peer[1] === 1, '其他玩家收到后外观层画出增幅 +16', JSON.stringify(r3.peer));
ok(r3.sky === 'av_sky1' && r3.attached, '天空套 8 件标记同步给其他玩家');

console.log('4. 地下城 / 决斗里不生效');
{
  const pg = await browser.newPage(); await pg.goto(`${URL_BASE}?test&mute&cls=sword`); await pg.waitForFunction(() => window.__READY); await pg.evaluate(HELP);
  const r = await pg.evaluate(async () => {
    const p = game.player; __v.strip(); const v0 = await __v.vx(); __v.wear('av_sky2', 8); const v1 = await __v.vx('left');
    return { scene: game.scene, mul: vanityTownMul(), v0, v1, want: p.speed * mspdOf(p) };
  });
  const r2d = await pg.evaluate(() => { const s = game.scene; game.scene = 'dungeon'; const a = vanityTownMul(); game.scene = 'town'; game.pvp = true; const b = vanityTownMul(); game.pvp = false; game.scene = s; return [a, b]; });
  ok(r.mul === 1 && r2d[0] === 1 && r2d[1] === 1, '测试场景 / 地下城 / 决斗：城镇移速倍率 = 1', JSON.stringify([r.mul, ...r2d]));
  ok(Math.abs(r.v1 - r.want) < 2, '测试场景里穿 8 件天空套：速度只有原来的移速属性（鞋 / 套装 mspd），没有城镇移速', `${r.v0.toFixed(1)} → ${r.v1.toFixed(1)}（面板 ${r.want.toFixed(1)}）`);
  await pg.close();
}

console.log('5. 帧率：城镇 8 人（天空套 + 高强化武器）');
const r5 = await page.evaluate(async () => {
  const p = game.player; __v.weapon(16, 0); __v.strip(); __v.wear('av_sky1', 8);
  const lv = [13, 14, 15, 16, 13, 14, 15, 16], P = [];
  for (let i = 0; i < 8; i++) {
    const eq = { weapon: { slot: 'weapon', enh: lv[i], dim: i % 3 === 0 ? 'str' : undefined } }; for (const s of AV_PIECE_SLOTS) eq[s] = { set: i % 2 ? 'av_sky2' : 'av_sky1' };
    const look = { ...lookFromEquip('sword', { weapon: inv.equip.weapon }), glow: vanityGlowOf(eq.weapon), cash: cashLook(eq) };
    P.push(__v.peer(10 + i, look, p.x - 420 + i * 110, 30 + (i % 4) * 30));
  }
  await new Promise(r => setTimeout(r, 1500));   // 等模型 / 时装分包加载
  let k = 0; const iv = setInterval(() => { k++; P.forEach((q, i) => { const x = p.x - 420 + i * 110 + Math.sin(k / 12 + i) * 90; q.push(x, 30 + (i % 4) * 30, Math.cos(k / 12 + i) > 0 ? 1 : -1, i % 2 ? 'run' : 'walk'); }); input.virt[k % 40 < 20 ? 'right' : 'left'] = 1; delete input.virt[k % 40 < 20 ? 'left' : 'right']; }, 100);
  const r0 = window.renderWorld; let rs = 0, rn = 0, rmax = 0; window.renderWorld = () => { const t = performance.now(); r0(); const d = performance.now() - t; rs += d; rn++; rmax = Math.max(rmax, d); };
  const secs = 6; let frames = 0, gap = 0, last = performance.now(); const t0 = last;
  await new Promise(res => { const f = () => { const n = performance.now(); gap = Math.max(gap, n - last); last = n; frames++; if (n - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  clearInterval(iv); delete input.virt.left; delete input.virt.right; window.renderWorld = r0;
  const glowing = P.filter(q => q.model && q.model.av && q.model.av.glow).length, sky = P.filter(q => q._cash && q._cash.skyFx).length;
  return { fps: +(frames / secs).toFixed(1), maxFrame: +gap.toFixed(1), renderMs: +(rs / rn).toFixed(2), renderMax: +rmax.toFixed(1), glowing, sky, fx: __G.fxList.length };
});
ok(r5.glowing === 8 && r5.sky === 8, '8 个玩家都画出了武器光效和天空套特效', `${r5.glowing}/${r5.sky}`);
ok(r5.fps >= 55, `帧率 ${r5.fps} fps，最长一帧 ${r5.maxFrame} ms，渲染平均 ${r5.renderMs} ms / 最长 ${r5.renderMax} ms`, JSON.stringify(r5));

if (SHOTS) {
  console.log('6. 总览图');
  const K = 1280 / 960, tiles = [];   // 游戏像素 → 页面像素
  // 在城镇里摆好一排排角色，截一张图，按每个角色切成小图（脚底往上 150 游戏像素，含名牌）
  const stage = async (list, wait = 1400) => {
    const pos = await page.evaluate(async ({ list, wait }) => {
      for (const q of [...world.crowd]) { if (q.net) cashDetach(q); } world.crowd.length = 0; world.npcs.length = 0; for (let i = ents.length - 1; i >= 0; i--) if (ents[i] !== game.player) ents.splice(i, 1);   // 路人 / NPC 也先清掉，别挡住
      while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]);
      const p = game.player; p.x = 30; p.y = 100; p.vx = p.vy = 0;
      const base = lookFromEquip('sword', inv.equip), sky = set => { const eq = {}; for (const s of AV_PIECE_SLOTS) eq[s] = { set }; return cashLook(eq); };
      const P = list.map((o, i) => __v.peer(300 + i, { ...base, glow: o.glow || null, cash: o.sky ? sky(o.sky) : null }, o.x, o.y));
      let k = 0; const iv = setInterval(() => { k++; list.forEach((o, i) => { if (o.walk) P[i].push(o.x - 60 + (k % 24) * 6, o.y, 1, 'walk'); }); }, 100);
      await new Promise(r => setTimeout(r, wait)); clearInterval(iv);
      return P.map(q => ({ x: sx(q.x), y: sy(q.y, 0) }));
    }, { list, wait });
    const f = `${out}/stage${tiles.length}.png`; await page.screenshot({ path: f });
    list.forEach((o, i) => tiles.push({ f, label: o.label, row: o.row, box: [(pos[i].x - 80) * K, (pos[i].y - 150) * K, 160 * K, 172 * K].map(Math.round) }));
  };
  const X = [170, 335, 500, 665, 830], E = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  await page.evaluate(() => { __v.strip(); __v.weapon(0, 0); });
  for (const half of [E.slice(0, 5), E.slice(5)]) await stage(half.map((lv, i) => ({ glow: { lv, amp: 0 }, x: X[i], y: 70, label: `强化 +${lv}`, row: 0 })));
  await stage([10, 13, 16].map((lv, i) => ({ glow: { lv, amp: 1 }, x: X[i], y: 70, label: `增幅 +${lv}`, row: 1 }))
    .concat([{ sky: 'av_sky1', x: X[3], y: 70, label: '天穹圣翼 站立', row: 1 }, { sky: 'av_sky2', x: X[4], y: 70, label: '炎龙之魂 站立', row: 1 }]), 2000);
  await stage([{ sky: 'av_sky1', glow: { lv: 12, amp: 0 }, walk: 1, x: X[1], y: 70, label: '天穹圣翼 走动 +12', row: 1 }, { sky: 'av_sky2', glow: { lv: 13, amp: 1 }, walk: 1, x: X[3], y: 70, label: '炎龙之魂 走动 增幅+13', row: 1 }], 2000);
  await page.evaluate(() => { for (const q of [...world.crowd]) if (q.net) cashDetach(q); world.crowd.length = 0; });
  // 挥砍拖尾：测试场景里普攻
  const pg = await browser.newPage(); await pg.setViewportSize({ width: 1280, height: 720 });
  await pg.goto(`${URL_BASE}?test&mute&cls=sword`); await pg.waitForFunction(() => window.__READY); await pg.evaluate(HELP);
  for (const [lv, amp] of [[16, 0], [13, 1], [12, 0]]) {
    await pg.evaluate(({ lv, amp }) => { __v.weapon(lv, amp); input.virt.attack = 2; }, { lv, amp }); await pg.waitForTimeout(110);
    const b = await pg.evaluate(() => ({ x: sx(game.player.x), y: sy(game.player.y, 0) })); const f = `${out}/swing_${lv}${amp ? 'a' : ''}.png`;
    await pg.screenshot({ path: f }); tiles.push({ f, label: `挥砍 ${amp ? '增幅' : '强化'} +${lv}`, row: 2, box: [(b.x - 110) * K, (b.y - 150) * K, 220 * K, 172 * K].map(Math.round) });
    await pg.evaluate(() => { delete input.virt.attack; }); await pg.waitForTimeout(1000);
  }
  await pg.close();
  // 提示框 + 状态窗口
  const tipBox = await page.evaluate(async () => { const w = __v.weapon(13, 0); __v.wear('av_sky2', 8); showItemTip(w, { clientX: 500, clientY: 40 }); await new Promise(r => setTimeout(r, 300)); const r = document.getElementById('itip').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); });
  await page.screenshot({ path: `${out}/tip.png` }); tiles.push({ f: `${out}/tip.png`, label: '提示框', row: 2, box: tipBox });
  const stBox = await page.evaluate(async () => { menus.hideTip && menus.hideTip(); menus.open('status'); await new Promise(r => setTimeout(r, 500)); const box = el => { const r = el.getBoundingClientRect(); return [r.left - 4, r.top - 4, r.width + 8, r.height + 8].map(Math.round); };
    return [box(document.querySelector('.avcv')), box(document.querySelector('.stsets'))]; });
  await page.screenshot({ path: `${out}/status.png` });
  tiles.push({ f: `${out}/status.png`, label: '状态窗口立绘', row: 2, box: stBox[0] }, { f: `${out}/status.png`, label: '状态窗口：套装 + 城镇移速', row: 2, box: stBox[1] });
  fs.writeFileSync(`${out}/tiles.json`, JSON.stringify(tiles));
  const py = `
import json
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18); T = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 22)
tiles = json.load(open('${out}/tiles.json')); W = 2200; rows = {}
for t in tiles:
    x, y, w, h = t['box']; im = Image.open(t['f']).convert('RGB').crop((x, y, x + w, y + h))
    if t['row'] == 2 and h > 300: im = im.resize((int(w * 300 / h), 300), Image.LANCZOS)
    cell = Image.new('RGB', (im.width, im.height + 26), (18, 16, 22)); cell.paste(im, (0, 26)); ImageDraw.Draw(cell).text((6, 2), t['label'], font=F, fill=(255, 226, 160))
    rows.setdefault(t['row'], []).append(cell)
titles = ['强化 +7 ~ +16（同一把太刀，城镇光照，原始大小）', '增幅 +10 / +13 / +16 · 天空套 8 件（站立：光翼 / 火环；走动：脚印）', '挥砍拖尾 · 提示框（发光名字 + 光效说明）· 状态窗口']
out = []
for r in sorted(rows):
    cells = rows[r]; lines = [[]]; cw = 0
    for c in cells:
        if cw + c.width + 6 > W and lines[-1]: lines.append([]); cw = 0
        lines[-1].append(c); cw += c.width + 6
    hd = Image.new('RGB', (W, 34), (40, 30, 24)); ImageDraw.Draw(hd).text((10, 4), titles[r], font=T, fill=(255, 240, 200)); out.append(hd)
    for ln in lines:
        h = max(c.height for c in ln); im = Image.new('RGB', (W, h + 6), (10, 8, 12)); x = 0
        for c in ln: im.paste(c, (x, 0)); x += c.width + 6
        out.append(im)
sheet = Image.new('RGB', (W, sum(o.height for o in out))); y = 0
for o in out: sheet.paste(o, (0, y)); y += o.height
sheet.save('${out}/sheet.png')
`;
  execFileSync('python3', ['-c', py]); console.log('  总览图', `${out}/sheet.png`);
}

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error');
ok(!errs.length, '没有页面错误', errs.slice(0, 3).map(e => e.text).join(' | '));
await browser.close();
console.log(fail ? `✗ ${fail} 项失败` : '✓ 全部通过');
process.exit(fail ? 1 : 0);
