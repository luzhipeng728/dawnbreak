// 职业测试：测试房间里依次使用普攻连段 / 跑攻 / 跳攻 / 技能栏上的技能 / 指令，截图并收集报错
// node test/classes.mjs sword,gun,mage                 基础技能
// node test/classes.mjs sword:blade,gun:launcher,...    转职技能（技能栏换成该转职的主动技能）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/classes'; fs.mkdirSync(out, { recursive: true });
const items = (process.argv[2] || 'gun,mage').split(',');
const KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'ShiftLeft', 'KeyV'];   // 14 格技能栏的默认键（第 7 格 = 左 Shift）
let fail = 0;
for (const item of items) {
  const [cls, job] = item.split(':'), tag = job ? `${cls}-${job}` : cls;
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=7`);
  await page.waitForFunction(() => window.__READY);
  const kb = page.keyboard, wait = ms => page.waitForTimeout(ms);
  const tap = async (k, ms = 50) => { await kb.down(k); await wait(ms); await kb.up(k); };
  const info = () => page.evaluate(() => ({ hp: Math.round(__G.player.hp), mp: Math.round(__G.player.mp), st: __G.player.st, act: __G.player.act && __G.player.act.name, combo: game.maxCombo, mobs: __G.ents.filter(e => e.team === 'e' && !e.dead).length, fps: Math.round(fps) }));
  const n = await page.evaluate(job => {
    const p = __G.player; p.mpMax = p.mp = 99999;
    if (job) { game.job = job; const ids = CLASSES[p.cls].jobs[job].skills; for (const id of ids) game.skillLv[id] = 5; game.skillBar = ids.filter(id => !SKILLS[id].passive).concat(Array(14).fill(null)).slice(0, 14); }
    else game.skillBar = CLASSES[p.cls].skills.filter(id => !SKILLS[id].passive).concat(Array(14).fill(null)).slice(0, 14);
    setInterval(() => { p.hp = window.__lowHp ? Math.min(p.hp, p.hpMax * 0.3) : p.hpMax; p.mp = p.mpMax; p.invul = 99; for (const k in p.cool) p.cool[k] = 0; if (__G.ents.filter(e => e.team === 'e' && !e.dead).length < 3) for (let i = 0; i < 4; i++) __G.spawnMonster('goblin', p.x + 150 + i * 60, 40 + i * 40); }, 400);
    return game.skillBar.filter(Boolean).length;
  }, job || null);
  await wait(500);
  await kb.down('ArrowRight'); await wait(700); await kb.up('ArrowRight');
  await kb.down('KeyX'); await wait(1100); await kb.up('KeyX'); await page.screenshot({ path: `${out}/${tag}-00-basic.png` }); console.log(tag, 'basic', JSON.stringify(await info()));
  await tap('ArrowRight', 40); await wait(50); await kb.down('ArrowRight'); await wait(300); await tap('KeyX'); await kb.up('ArrowRight'); await wait(400);
  await tap('KeyC'); await wait(150); await tap('KeyX'); await wait(120); await tap('KeyX'); await wait(500);
  await page.screenshot({ path: `${out}/${tag}-01-dash-jump.png` }); console.log(tag, 'dash/jump', JSON.stringify(await info()));
  const cast = [];
  for (let i = 0; i < n; i++) {
    const id = await page.evaluate(i => game.skillBar[i], i);
    const air = await page.evaluate(id => !!SKILLS[id].airOnly, id);
    await page.waitForFunction(() => __G.player.free && __G.player.z === 0, null, { timeout: 9000 }).catch(() => { });   // 觉醒演出最长 5~6 秒（枪炮师一觉 5.4 秒），等它放完再判断前置条件、按下一个（上一个技能可能会消耗资源）
    // 有施放前置条件的技能：受击时才能放的（逆转反击等）跳过；HP 条件的（死亡抗拒）先把 HP 压到一半以下
    const pre = await page.evaluate(id => { const S = SKILLS[id], p = __G.player; if (S.whenHit) return 'skip'; if (!S.req || S.req(p) === true) return 'ok';
      window.__lowHp = true; p.hp = p.hpMax * 0.3; return S.req(p) === true ? 'ok' : 'skip'; }, id);
    if (pre === 'skip') { cast.push('~' + id); await page.evaluate(() => { window.__lowHp = false; }); continue; }
    if (air) { await tap('KeyC'); await wait(160); }
    // 受击时才能放的技能（S.whenHit：替身草人、心灵反击……）：先让角色进入受击硬直
    await page.evaluate(id => { const S = SKILLS[id], p = __G.player; if (typeof S.whenHit === 'function' ? S.whenHit(p) : S.whenHit) { p.setState('hit'); p.stun = 0.8; } }, id);
    await tap(KEYS[i]);
    const castCheck = () => page.waitForFunction(id => (__G.player.act && __G.player.act.skill === id) || (SKILLS[id].instant && __G.player.cool[id] > 0), id, { timeout: 1200 }).then(() => true).catch(() => false);   // 无动作施放（S.instant）的技能看冷却
    let ok = await castCheck();
    if (!ok) {   // 按键那一下刚好被怪打中硬直会吞掉按键：等能动了再按一次
      await page.waitForFunction(() => __G.player.free && __G.player.z === 0, null, { timeout: 3000 }).catch(() => { });
      if (air) { await tap('KeyC'); await wait(160); }
      await tap(KEYS[i]); ok = await castCheck();
    }
    if (!ok) console.log(tag, 'NOCAST', id, JSON.stringify(await page.evaluate(id => { const p = __G.player, S = SKILLS[id]; return { st: p.st, act: p.act && p.act.name, free: p.free, z: p.z, mp: p.mp, cool: p.cool[id], req: S.req ? S.req(p) : null, info: p.pmInfo, lv: skLv(p, id), bar: game.skillBar.indexOf(id) }; }, id)));
    cast.push(ok ? id : '✗' + id); if (!ok) fail++;
    await page.evaluate(() => { window.__lowHp = false; });
    const awk = await page.evaluate(id => !!SKILLS[id].awaken, id);
    await wait(awk ? 1300 : 350);
    await page.screenshot({ path: `${out}/${tag}-s${i}-${id}.png` });
    await wait(awk ? 1800 : 600);
    // 模式类技能（移动射击等：C 退出）放完就退出，免得占住后面的按键
    if (await page.evaluate(id => !!(SKILLS[id].ai && SKILLS[id].ai.kind === 'mode' && __G.player.act && __G.player.act.skill === id), id)) { await tap('KeyC'); await wait(400); }
  }
  console.log(tag, 'skills', cast.join(' '), JSON.stringify(await info()));
  if (!job) { for (const seq of [['ArrowDown', 'ArrowRight'], ['ArrowRight', 'ArrowDown'], ['ArrowLeft', 'ArrowRight'], ['ArrowDown', 'ArrowDown'], ['ArrowUp']]) { for (const k of seq) await tap(k, 30); await tap('KeyZ'); await wait(700); } console.log(tag, 'cmds', JSON.stringify(await info())); }
  const errs = logs.filter(l => l.type !== 'warning'); if (errs.length) fail++;
  console.log(tag, 'LOGS', JSON.stringify(errs.slice(0, 6), null, 1));
  await browser.close();
}
process.exit(fail ? 1 : 0);
