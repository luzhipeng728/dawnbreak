// 技能连拍体检：测试房间里对着木桩（冻结的哥布林）逐个施放某职业 / 转职的全部主动技能，
// 每个技能按动作时长均匀截 N 张角色附近的图，拼成一张总览图（每行一个技能，行首写技能名和问题标记），并自动检查：
//   ✗放不出   按键后没有进入这个技能的动作（非“无动作施放”技能）
//   ✗卡住     放完 2 秒后还不能行动 / 还浮在空中 / 跑出房间
//   ✗没打中   伤害类技能对面前木桩一次都没打中（BUFF、召唤、位移类不查）
//   △缺动作   动作片段在职业动画表里不存在（会用默认姿势代替）
//   △缺图标   技能图标还是程序画的占位图
//   ✗报错     施放过程中页面报错
// 输出：test/shots/skills/<职业>-<转职>.png（总览）、<职业>-<转职>.json（问题清单）
// 用法：node test/skillshots.mjs sword:soulbender,gun:ranger [每个技能的张数=6]；all = 全部 18 个（基础职业 + 15 个转职）
import { launch, URL_BASE, openLists } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const out = 'test/shots/skills'; fs.mkdirSync(out, { recursive: true });
const arg = process.argv[2] || 'sword:soulbender', N = +(process.argv[3] || 6);
// all = 已开放的基础职业 + 转职（读 CLASSES，跳过 ready:false）
const list = arg === 'all' ? await openLists().then(L => [...L.classes, ...L.jobs]) : arg.split(',');
const SKILLS_AIR_DELAY = new Set(['silver', 'aircut']);
let fail = 0;
const SPEC = {}; for (const c of new Set(list.map(x => x.split(':')[0]))) { try { SPEC[c] = JSON.parse(fs.readFileSync(`docs/skills/${c}.json`, 'utf8')); } catch (e) { /* 还没有规格 */ } }
for (const item of list) {
  const [cls, job] = item.split(':'), tag = `${cls}-${job || 'base'}`;
  const dir = `${out}/${tag}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=0`); await page.waitForFunction(() => window.__READY);
  const ids = await page.evaluate(({ cls, job }) => {
    const p = game.player; game.job = job || null; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
    if (typeof onJobChange === 'function' && job) try { onJobChange(p, job); } catch (e) { /* 部分转职没有这个钩子 */ }
    const ids = classSkills(cls, job).filter(id => SKILLS[id].act && !SKILLS[id].passive);
    for (const id of classSkills(cls, job)) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv || 5, 5));
    p.mpMax = p.mp = 99999; setInterval(() => { p.mp = p.mpMax; p.hp = p.hpMax; }, 200);
    window.__dummy = () => { for (const e of ents) if (e.team === 'e') e.remove = true; const m = spawnMonster('goblin', p.x + 72, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; return m; };
    window.__hits = 0; const oh = game.onPlayerHit; game.onPlayerHit = function () { window.__hits++; return oh.apply(this, arguments); };
    return ids.map(id => ({ id, name: SKILLS[id].name }));
  }, { cls, job });
  const rows = [];
  for (const { id, name } of ids) {
    const nErr0 = logs.filter(l => l.type === 'pageerror').length;
    // 前置技能（规格 docs/skills/<职业>.json 的 pre，例：狂暴之力、无尽波动）：先放出来再拍
    const SS = (SPEC[cls] || {}).skills || {}, pre = (SS[`${id}@${job}`] || SS[id] || {}).pre;
    if (pre) { await page.evaluate(pre => { const p = game.player; p.buffs = {}; p.cool = {}; if (typeof summonsOf === 'function') for (const s of summonsOf(p) || []) dismissOne(s, 'round'); for (const k of pre) { p.setState('idle'); p.act = null; castSkill(p, k, false, null); } }, pre);
      await page.waitForTimeout(700); await page.waitForFunction(() => game.player.st !== 'act' && !(game.timeStop > 0), null, { timeout: 5000 }).catch(() => { }); await page.waitForTimeout(300); }   // 前置是觉醒召唤（卡西利亚斯等）时要等召唤兽真正出场
    const setup = await page.evaluate(({ id, keep }) => {
      const p = game.player; p.x = 380; p.y = 100; p.z = 0; p.vz = 0; p.face = 1; p.setState('idle'); p.act = null; p.cool = {}; if (!keep) p.buffs = {}; p.chasers = [];
      for (let i = 0; i < game.skillBar.length; i++) game.skillBar[i] = null; game.skillBar[0] = id; __dummy(); projs.length = 0; window.__hits = 0;
      if (typeof summonsOf === 'function' && !keep) for (const s of summonsOf(p) || []) dismissOne(s, 'round');   // 有前置时保留前置放出的召唤兽（咒令类技能要它在场）
      p.summonMode = null;   // 上一行技能留下的“伺机而动 / 跟随 / 集火”开关不带到下一行
      const S = SKILLS[id];
      if (S.airOnly) { p.vz = 420; p.z = 1; p.setState('jump'); }
      if (typeof S.whenHit === 'function' ? S.whenHit(p) : S.whenHit) { p.setState('hit'); p.stun = 0.8; }
      if (S.req && S.req(p) !== true) return { pre: true };   // 前置条件不满足（例：咒令要求召唤兽在场），跳过
      const icon = !!(IMG['icon/' + id] || (S.icon && IMG['icon/' + S.icon]));
      // 不直接打人的技能不查“没打中”：BUFF / 召唤 / 位移 / 格挡架势 / 减益阵 / 必须接在别的动作后面的追加技
      const a0 = typeof S.act === 'function' ? (() => { try { return S.act(game.skillLv[id] || 1); } catch (e) { return {}; } })() : {};
      const noHit = !!(S.buff || S.summon || S.move || S.noHitCheck || a0.guard || S.debuffOnly || S.from || S.after || /guard|plemon|silver/.test(id));
      return { instant: !!S.instant, icon, buff: noHit };
    }, { id, keep: !!pre });
    if (setup.pre) { rows.push({ id, name, flags: ['-前置条件'], frames: [] }); continue; }
    if (SKILLS_AIR_DELAY.has(id)) await page.waitForTimeout(160);
    await page.keyboard.down('KeyA'); await page.waitForTimeout(40); await page.keyboard.up('KeyA');
    await page.waitForFunction(id => game.player.act && game.player.act.skill === id, id, { timeout: 600 }).catch(() => { });
    const info = await page.evaluate(({ cls }) => { const a = game.player.act; return a ? { skill: a.skill, dur: a.dur || 0.6, clip: a.clip || null, hasClip: !a.clip || !!(CLIPS[cls] && CLIPS[cls][a.clip]) } : null; }, { cls });
    const span = await page.evaluate(id => (SKILLS[id] && SKILLS[id].shotSpan) || 0, id), dur = Math.min(3.8, Math.max(0.4, span, info ? info.dur : 0.8)), t0 = await page.evaluate(() => game.t);
    const frames = [];
    for (let i = 0; i < N; i++) {
      const at = t0 + dur * (i + 0.5) / N;
      await page.waitForFunction(at => game.t >= at, at, { timeout: 6000 }).catch(() => { });
      const pos = await page.evaluate(() => { const p = __G.player; return { x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }; });
      const f = `${dir}/${id}-${i}.png`;
      await page.screenshot({ path: f, clip: { x: Math.max(0, Math.min(1280 - 480, pos.x - 170)), y: Math.max(0, Math.min(720 - 320, pos.y - 250)), width: 480, height: 320 } });
      frames.push(f);
    }
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => { const p = game.player, R = game.room; if (game.timeStop > 0) return { st: 'timestop' }; return { st: p.st, z: p.z, out: R ? p.x < R.x0 - 5 || p.x > R.x1 + 5 : false, hits: window.__hits }; });
    const flags = [];
    const cast = info && info.skill === id;
    if (!cast && !setup.instant) flags.push('✗放不出' + (info ? `(出的是 ${info.skill})` : ''));
    if (!['idle', 'jump', 'walk', 'run', 'act', 'timestop'].includes(after.st) || after.z > 4 || after.out) flags.push(`✗卡住[${after.st}${after.z > 4 ? ' 浮空' : ''}${after.out ? ' 出界' : ''}]`);
    if ((cast || setup.instant) && !setup.buff && !after.hits) flags.push('✗没打中');
    if (info && !info.hasClip) flags.push(`△缺动作(${info.clip})`);
    if (!setup.icon) flags.push('△缺图标');
    const errs = logs.filter(l => l.type === 'pageerror').slice(nErr0);
    if (errs.length) flags.push('✗报错:' + errs[0].text.slice(0, 80));
    if (flags.some(x => x.startsWith('✗'))) fail++;
    rows.push({ id, name, flags, frames, hits: after.hits });
  }
  await browser.close();
  fs.writeFileSync(`${out}/${tag}.json`, JSON.stringify(rows.map(({ frames, ...r }) => r), null, 1));
  // 总览图：每行一个技能（左边技能名 + 问题），右边 N 张连拍
  const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
rows = json.load(open(sys.argv[1])); N = int(sys.argv[3]); W, H, LW = 240, 160, 250
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'
try: font = ImageFont.truetype(FONT, 18); small = ImageFont.truetype(FONT, 14)
except Exception: font = small = ImageFont.load_default()
sheet = Image.new('RGB', (LW + W * N, H * max(1, len(rows))), '#15131a'); d = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    y = r * H; bad = any(f.startswith('\\u2717') for f in row['flags'])
    d.rectangle([0, y, LW - 4, y + H - 4], fill='#3a1414' if bad else '#1f1c26')
    d.text((8, y + 8), row['name'], fill='#ffe8a8', font=font); d.text((8, y + 34), row['id'], fill='#9a8f7c', font=small)
    for k, f in enumerate(row['flags'][:5]): d.text((8, y + 58 + k * 19), f[:22], fill='#ff8a7a' if f.startswith('\\u2717') else '#ffd27a', font=small)
    for i, fp in enumerate(row['frames']):
        try: sheet.paste(Image.open(fp).convert('RGB').resize((W - 4, H - 4)), (LW + i * W, y))
        except Exception: pass
sheet.save(sys.argv[2], quality=80)
`;
  fs.writeFileSync(`${dir}/rows.json`, JSON.stringify(rows));
  execFileSync('python3', ['-c', py, `${dir}/rows.json`, `${out}/${tag}.jpg`, String(N)]);
  const bad = rows.filter(r => r.flags.some(f => f.startsWith('✗'))), warn = rows.filter(r => r.flags.length && !r.flags.some(f => f.startsWith('✗')));
  console.log(`${tag}: ${rows.length} 个技能，问题 ${bad.length}，提醒 ${warn.length}  → ${out}/${tag}.jpg`);
  for (const r of rows) if (r.flags.length) console.log(`  ${r.name}(${r.id}) ${r.flags.join(' ')}`);
}
process.exit(fail ? 1 : 0);
