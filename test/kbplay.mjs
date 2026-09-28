// 真实按键试玩的公共部分：像玩家一样用键盘 / 鼠标操作（只读游戏状态来“看屏幕”，不改状态）
// 用法：const P = kbPlayer(page, { out }); await P.walkTo(x, y); await P.talk('seria'); await P.fightDungeon();
import fs from 'fs';

export function kbPlayer(page, { out = 'test/shots/kb', log = console.log } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const kb = page.keyboard, wait = ms => page.waitForTimeout(ms);
  const held = new Set();
  let shotN = 0;
  const P = {
    notes: [], wait,
    note(msg) { P.notes.push(msg); log('  [问题] ' + msg); },
    async shot(name) { const f = `${out}/${String(++shotN).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); log('  📷 ' + f); return f; },
    async tap(k, ms = 55) { await kb.down(k); await wait(ms); await kb.up(k); held.delete(k); },
    async hold(keys) {   // 只保持 keys 这些键按下，其余松开
      const want = new Set(keys);
      for (const k of [...held]) if (!want.has(k)) { await kb.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await kb.down(k); held.add(k); }
    },
    async release() { await P.hold([]); },
    st: () => page.evaluate(() => {
      const p = game.player, D = game.dungeon;
      const R = { scene: game.scene, sid: world && world.S && world.S.id, menus: menus.stack.slice(), lvl: game.lvl, gold: game.gold,
        p: p && { x: p.x, y: p.y, z: p.z, st: p.st, face: p.face, hp: p.hp, hpMax: p.hpMax, mp: p.mp, mpMax: p.mpMax, dodgeCd: p.dodgeCd || 0 } };
      if (D && game.scene === 'dungeon') {
        R.d = { state: D.state, open: D.doorsOpen, trans: !!D.transition, x1: game.room.x1, boss: D.room.type === 'boss', hurt: D.hurt, route: D.doorsOpen ? bot.route(D) : null };
        R.en = ents.filter(e => e.team === 'e' && !e.dead && !e.remove && !e.hidden).map(e => ({ x: e.x, y: e.y, w: e.w, boss: !!e.boss, kind: e.kind }));
        const inLine = g => { const a = g.x, b = g.x + g.len * g.face; return Math.abs(p.y - g.y) < (g.hw || 10) + 12 && p.x > Math.min(a, b) - 20 && p.x < Math.max(a, b) + 20; };
        R.danger = groundFx.filter(g => !g.friendly && g.fire && (g.kind === 'line' ? inLine(g) : inGround(p, g.x, g.y, g.r + 14))).map(g => ({ x: g.x, y: g.y, r: g.r, line: g.kind === 'line' }));
        R.items = drops.filter(d => d.kind !== 'gold' && d.t > 0.45).map(d => ({ x: d.x, y: d.y }));
        R.ready = []; for (let i = 0; i < 12; i++) { const id = game.skillBar[i], S = id && SKILLS[id]; if (S && (game.skillLv[id] || 0) > 0 && (p.cool[id] || 0) <= 0 && p.mp >= (S.mp || 0) && !S.passive && (!S.buff || !p.buffs[id])) R.ready.push(i); }
        R.pot = { cd: inv.potCd || 0, hp: inv.count(inv.quick[0]), mp: inv.count(inv.quick[1]) };
      }
      return R;
    }),
    // 走到 (x, y)：按住方向键，距离远时双击跑
    async walkTo(x, y, { tol = 14, ytol = 8, maxMs = 15000, run = true } = {}) {
      const t0 = Date.now(); let running = false;
      while (Date.now() - t0 < maxMs) {
        const s = await P.st(); if (!s.p) break;
        if (s.menus.some(n => ['npc', 'dungeon', 'result', 'job', 'npcquest'].includes(n))) break;
        const dx = x - s.p.x, dy = y - s.p.y;
        const h = Math.abs(dx) > tol ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null, v = Math.abs(dy) > ytol ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : null;
        if (!h && !v) break;
        if (h && run && !running && Math.abs(dx) > 300) { await P.release(); await P.tap(h, 40); await wait(40); running = true; }
        if (!h) running = false;
        await P.hold([h, v].filter(Boolean)); await wait(45);
      }
      await P.release();
      return P.st();
    },
    async closeAll() { for (let i = 0; i < 6; i++) { const m = await page.evaluate(() => menus.stack.slice()); if (!m.length || m.includes('result')) break; await P.tap('Escape'); await wait(200); } const m = await page.evaluate(() => menus.stack.slice()); if (m.includes('system')) await P.tap('Escape'); },
    npcPos: id => page.evaluate(id => { const e = world.npcs.find(x => x.npc.id === id); return e && { x: e.x, y: e.y }; }, id),
    // 走到 NPC 跟前按 X 对话
    async talk(id) {
      const n = await P.npcPos(id); if (!n) { P.note(`当前场景找不到 NPC ${id}`); return false; }
      let ok = false;
      for (let k = 0; k < 3 && !ok; k++) {
        const n2 = await P.npcPos(id); await P.walkTo(n2.x - 40 + k * 8, n2.y + 2, { tol: 8, ytol: 5 }); await wait(150);
        const s = await page.evaluate(() => ({ near: world.near && world.near.npc.id, p: [Math.round(game.player.x), Math.round(game.player.y)], m: menus.stack.slice() }));
        await P.tap('KeyX'); await wait(500);
        ok = await page.evaluate(() => menus.isOpen('npc'));
        if (!ok) P.note(`走到 ${id} 旁边按 X 没打开对话（第 ${k + 1} 次，near=${s.near} 位置 ${s.p} 窗口 ${s.m.join(',')}）`);
      }
      return ok;
    },
    // 对话里按 X 一路推进，直到出现可点的按钮（接受 / 完成任务），点它
    async dialogTo(labels = ['接受', '完成任务'], maxPress = 30) {
      for (let i = 0; i < maxPress; i++) {
        const b = await page.evaluate(labels => { const w = menus.wins.npc; if (!w) return null; const btn = [...w.querySelectorAll('.qbtns .btn')].find(b => labels.includes(b.textContent.trim())); return btn ? btn.textContent.trim() : null; }, labels);
        if (b) { await page.click(`.npcwin .qbtns .btn:has-text("${b}")`); await wait(450); return b; }
        await P.tap('KeyX'); await wait(220);
      }
      return null;
    },
    // 点 NPC 右侧任务列表里的某个任务
    async pickQuest(name) { const el = page.locator('.npcmenu .qitem', { hasText: name }).first(); if (!(await el.count())) return false; await el.click(); await wait(300); return true; },
    async npcService(label) { const el = page.locator('.npcmenu .btn', { hasText: label }).first(); if (!(await el.count())) { P.note(`NPC 菜单里没有「${label}」`); return false; } await el.click(); await wait(500); return true; },
    // 走出场景边缘 / 后墙门，等待进入新场景
    async exitTo(sceneId, { maxMs = 20000 } = {}) {
      const ex = await page.evaluate(to => { const e = world.S.exits.find(e => e.to === to); return e && { side: e.side, x: e.x, w: world.S.width }; }, sceneId);
      if (!ex) { P.note(`${await page.evaluate(() => world.S.id)} 没有通往 ${sceneId} 的出口`); return false; }
      const t0 = Date.now();
      if (ex.side === 'left' || ex.side === 'right') await P.walkTo(ex.side === 'left' ? 120 : ex.w - 120, 60, { maxMs });
      else await P.walkTo(ex.x, ex.side === 'up' ? 30 : 150, { maxMs });
      const k = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }[ex.side];
      await P.hold([k]);
      while (Date.now() - t0 < maxMs) { if (await page.evaluate(id => world && world.S.id === id && game.scene === 'town', sceneId)) break; await wait(100); }
      await P.release(); await wait(700);
      const ok = await page.evaluate(id => world.S.id === id, sceneId);
      if (!ok) P.note(`没能走到 ${sceneId}`);
      return ok;
    },
    // 走到地下城门口，弹出选择窗口
    async toGate(dg) {
      const g = await page.evaluate(id => { const g = world.S.gates.find(g => g.dungeon === id); return g && { x: g.x }; }, dg);
      if (!g) { P.note(`找不到 ${dg} 的门`); return false; }
      await P.walkTo(g.x, 40); await P.hold(['ArrowUp']);
      for (let i = 0; i < 40 && !(await page.evaluate(() => menus.isOpen('dungeon'))); i++) await wait(100);
      await P.release();
      return page.evaluate(() => menus.isOpen('dungeon'));
    },
    async enterDungeon(diffName) {
      if (diffName) { const d = page.locator('.diff', { hasText: diffName }).first(); if (await d.count()) await d.click(); else P.note(`没有难度 ${diffName}`); await wait(200); }
      await page.click('text=进入地下城');
      await page.waitForFunction(() => game.scene === 'dungeon' && game.dungeon && game.dungeon.state === 'play', null, { timeout: 20000 });
      await wait(600);
    },
    // 用键盘打完整个地下城：找怪、对齐、普攻 / 技能、躲预警、捡东西、按路线走门；返回结算信息
    async fightDungeon({ maxMs = 420000, skillRate = 0.18, onRoom, dodgeWarn = true, potAt = 0.35 } = {}) {
      const t0 = Date.now(); let lastRoom = null, atkPh = 0, runDir = null, stuck = { x: 0, t: Date.now() }, deaths = 0, wasDead = false;
      while (Date.now() - t0 < maxMs) {
        const s = await P.st();
        if (s.menus.includes('result')) { await P.release(); break; }
        if (s.scene !== 'dungeon' || !s.d) { await P.release(); if (s.scene === 'town') break; await wait(100); continue; }
        const { p, d } = s;
        if (d.trans) { await P.release(); await wait(80); continue; }
        const roomKey = `${Math.round(d.x1)}:${d.boss}:${s.en.length}`;
        if (onRoom && roomKey !== lastRoom && s.en.length) { lastRoom = roomKey; await onRoom(s); }
        if (d.state === 'dead') { if (!wasDead) deaths++; wasDead = true; await P.release(); await P.tap('KeyX'); await wait(300); continue; }
        wasDead = false;
        if (p.st === 'down') { await P.release(); await P.tap('KeyC'); await wait(60); continue; }
        // 喝药
        if (p.hp < p.hpMax * potAt && s.pot && s.pot.cd <= 0 && s.pot.hp) await P.tap('Digit1');
        else if (p.mp < p.mpMax * 0.15 && s.pot && s.pot.cd <= 0 && s.pot.mp) await P.tap('Digit2');
        // 1) 地面预警：往纵深方向离开，偶尔闪避
        if (dodgeWarn && s.danger.length) {
          const g = s.danger[0], up = g.line ? (p.y < g.y ? p.y > 24 : p.y > 172) : g.y > 98;   // DEPTH=196：危险在下半边就往上躲；冲撞线往远离中线的方向让
          const v = up ? 'ArrowUp' : 'ArrowDown', h = p.x >= g.x ? 'ArrowRight' : 'ArrowLeft';
          if (p.dodgeCd <= 0 && Math.random() < 0.4) { await P.hold([v]); await P.tap('ShiftLeft', 40); }
          else await P.hold([v, h]);
          await wait(60); continue;
        }
        // 2) 打怪
        let tgt = null, best = 1e9;
        for (const e of s.en) { const dd = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2 + (e.boss ? -150 : 0); if (dd < best) { best = dd; tgt = e; } }
        if (tgt) {
          const reach = 46 + tgt.w, ax = Math.abs(tgt.x - p.x), ay = Math.abs(tgt.y - p.y), side = p.x < tgt.x ? -1 : 1;
          if (ax < reach + 36 && ay < 14) {
            const want = tgt.x > p.x ? 'ArrowRight' : 'ArrowLeft';
            if ((tgt.x > p.x ? 1 : -1) !== p.face) { await P.hold([want]); await wait(40); await P.release(); continue; }
            await P.release();
            if (s.ready.length && Math.random() < skillRate) await P.tap(['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'][s.ready[Math.floor(Math.random() * s.ready.length)]], 50);
            else { await P.tap('KeyX', 45); atkPh++; }
            await wait(40); continue;
          }
          const tx = tgt.x + side * reach * 0.8, ty = tgt.y, dx = tx - p.x, dy = ty - p.y;
          const h = Math.abs(dx) > 10 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null, v = Math.abs(dy) > 5 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : null;
          if (h && Math.abs(dx) > 280 && runDir !== h) { await P.release(); await P.tap(h, 35); await wait(35); runDir = h; }
          if (!h || Math.abs(dx) < 120) runDir = null;
          await P.hold([h, v].filter(Boolean)); await wait(55); continue;
        }
        runDir = null;
        // 3) 捡东西（走过去按 X）
        if (s.items.length) {
          const it = s.items.reduce((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) < Math.abs(b.x - p.x) + Math.abs(b.y - p.y) ? a : b);
          if (Math.abs(it.x - p.x) < 16 && Math.abs(it.y - p.y) < 10) { await P.release(); await P.tap('KeyX'); await wait(120); continue; }
          const h = Math.abs(it.x - p.x) > 8 ? (it.x > p.x ? 'ArrowRight' : 'ArrowLeft') : null, v = Math.abs(it.y - p.y) > 5 ? (it.y > p.y ? 'ArrowDown' : 'ArrowUp') : null;
          await P.hold([h, v].filter(Boolean)); await wait(50); continue;
        }
        // 4) 走向下一扇门
        if (d.open && d.route) {
          const pos = { left: [0, 98], right: [d.x1, 98], up: [d.x1 / 2, 0], down: [d.x1 / 2, 200] }[d.route];   // 上下的门在房间正中
          const dx = pos[0] - p.x, dy = pos[1] - p.y, side = d.route === 'left' || d.route === 'right';
          const h = side ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : Math.abs(dx) > 30 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null;
          const v = !side ? (Math.abs(dx) < 90 ? (d.route === 'up' ? 'ArrowUp' : 'ArrowDown') : null) : Math.abs(dy) > 8 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : null;
          if (Date.now() - stuck.t > 6000) { if (Math.abs(p.x - stuck.x) + Math.abs(p.y - (stuck.y ?? p.y)) < 20) P.note(`过门卡住：房间 x1=${d.x1} 方向 ${d.route} 玩家 (${Math.round(p.x)},${Math.round(p.y)})`); stuck = { x: p.x, y: p.y, t: Date.now() }; }
          await P.hold([h, v].filter(Boolean)); await wait(60); continue;
        }
        await P.release(); await wait(80);
      }
      await P.release();
      return { ms: Date.now() - t0, deaths, ...(await page.evaluate(() => { const D = game.dungeon; return D ? { hurt: D.hurt, state: D.state, rank: D.result && D.result.rank } : { state: 'gone' }; })) };
    },
    // 结算翻牌：先翻一张免费卡，再点返回城镇
    async flipAndReturn(again = false) {
      await page.waitForFunction(() => menus.isOpen('result'), null, { timeout: 30000 });
      await wait(1200);
      await page.click('#result .card >> nth=0'); await wait(900);
      const f = await P.shot('result-flip');
      await page.click(again ? 'text=再次挑战' : 'text=返回城镇');
      await page.waitForFunction(() => game.scene === 'town' || (game.scene === 'dungeon' && game.dungeon && game.dungeon.state === 'play'), null, { timeout: 20000 }); await wait(900);
      return f;
    },
  };
  return P;
}
