// 技能行为连拍（鬼剑士）：一次施放拍不到的流程——再按 / 方向键 / 吸血成形 / 三觉代替收尾 / 追加输入——按脚本逐帧推进并截图，拼成一张总览图。
// 暂停游戏循环（game.paused）后用 step(1/60) 推进（确定、不受机器快慢影响）；W.dx / W.dy 模拟按住方向键；cast(id) = 按快捷栏第 1 格。
// 用法：node test/skillseq.mjs [场景,...=全部] [输出=test/shots/skills/sword-seq.jpg]
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const atkN = n => `(() => { const p = game.player; for (let i = 0; i < ${n}; i++) { p.setState('idle'); p.act = null; p.doAct(p.acts[['atk1','atk2','atk3'][i % 3]]); run(22); } const s = summonsOf(p, 'bz_bloodsword')[0]; return s && s.blood; })()`;
const SCEN = {
  bzawk: { job: 'berserker', steps: [
    { js: `mob(470, 100); mob(560, 112); cast('bz_awaken'); run(40)` }, { shot: '施放' },
    { js: `run(90)` }, { shot: '背上血剑(空)' },
    { js: atkN(10) }, { shot: '吸血一半' },
    { js: atkN(12) }, { shot: '成形' },
    { js: `W.dx = 1; cast('bz_awaken'); W.dx = 0; run(12)` }, { shot: '拔剑' },
    { js: `run(12)` }, { shot: '甩下' },
    { js: `run(12)` }, { shot: '血浪' },
    { js: `run(20)` }, { shot: '血浪2' },
    { js: `run(40)` }, { shot: '结束' },
  ] },
  bzawk3: { job: 'berserker', steps: [
    { js: `mob(470, 100); cast('bz_awaken'); run(130)` }, { shot: '血剑' },
    { js: `game.skillBar[1] = 'bz_awaken3'; const r = castSkill(game.player, 'bz_awaken3', false, 's1'); run(60); return [r, summonsOf(game.player, 'bz_bloodsword').length, game.player.act && game.player.act.name]` }, { shot: '三觉代替收尾' },
    { js: `run(120)` }, { shot: '三觉' },
  ] },
  kazan: { job: 'blade', steps: [
    { js: `cast('kazan'); run(40)` }, { shot: '卡赞' },
    { js: `const p = game.player; p.face = -1; p.x -= 60; run(30)` }, { shot: '转身' },
  ] },
  tempest: { job: 'blade', steps: [
    { js: `mob(500, 100); mob(560, 80); mob(440, 125); cast('awaken'); run(60)` }, { shot: '剑魂珠' },
    { js: `run(20)` }, { shot: '吸起' },
    { js: `run(12)` }, { shot: '剑阵' },
    { js: `run(12)` }, { shot: '拔剑斩1' },
    { js: `run(12)` }, { shot: '拔剑斩2' },
    { js: `run(20)` }, { shot: '拔剑斩3' },
    { js: `run(40)` }, { shot: '回起点上挑' },
    { js: `run(20)` }, { shot: '结束' },
  ] },
  meteor: { job: 'blade', steps: [
    { js: `mob(470, 100); cast('wm_meteor'); run(30)` }, { shot: '跃起' },
    { js: `W.dx = 1; run(3); W.dx = 0; run(20)` }, { shot: '→ 右档', ox: 120 },
    { js: `run(40)` }, { shot: '流星', ox: 120 },
    { js: `run(40)` }, { shot: '落地', ox: 120 },
  ] },
  dragon: { job: 'blade', steps: [
    { js: `mob(520, 60); W.dy = -1; cast('dragon'); W.dy = 0; run(12)` }, { shot: '↑斜突进' }, { js: `run(18)` }, { shot: '第2段' }, { js: `run(20)` }, { shot: '上斩' },
    { js: `game.player.cool = {}; game.player.y = 100; run(60); W.dy = -1; cast('phantom'); run(60)` }, { shot: '剑舞(按住↑)' }, { js: `run(40)` }, { shot: '剑气斜飞' },
  ] },
  kaiga: { job: 'soulbender', steps: [
    { js: `mob(520, 100); cast('sb_kaiga'); run(40); const p = game.player; p._psvT = 0; run(2); p.act = null; p.setState('run'); p.doAct(p.acts.dash); run(4); return [p.act && p.act.kaigaDash]` }, { shot: '凯贾冲刺' },
    { js: `const r = cast('sb_flash'); run(20); return [r, game.player.act && game.player.act.skill]` }, { shot: '鬼影闪' },
    { js: `run(60); cast('sb_karo'); run(40); const p = game.player; p._psvT = 0; run(2); p.act = null; p.setState('idle'); p.doAct(p.acts.atk1); run(8)` }, { shot: '卡洛+普攻' },
    { js: `run(40); game.player.cool = {}; cast('sb_karo'); run(40); const p = game.player; p.act = null; p.setState('idle'); p.doAct(p.acts.atk2); run(8); return p.buffs.sb_karo` }, { shot: '紫焰' },
    { js: `run(40); game.player.cool = {}; cast('sb_awaken'); run(150)` }, { shot: '怖拉修张口' }, { js: `run(30)` }, { shot: '吞噬' },
  ] },
  ghost: { job: 'ghostblade', steps: [
    { js: `mob(470, 100); cast('gb_chain'); run(34)` }, { shot: '鬼连击3' }, { js: `run(8)` }, { shot: '极上挑' },
    { js: `run(40); game.player.cool = {}; cast('gb_dance'); run(40)` }, { shot: '乱舞' }, { js: `run(20)` }, { shot: '大回旋' }, { js: `run(34)` }, { shot: '终结' },
  ] },
  asura: { job: 'asura', steps: [
    { js: `mob(470, 100); cast('as_aura'); run(40); cast('as_awaken'); run(130); return !!game.player.buffs.as_domain` }, { shot: '领域' },
    { js: `game.skillBar[1] = 'as_awaken3'; const r = castSkill(game.player, 'as_awaken3', false, 's1'); run(90); return [r, !!game.player.buffs.as_domain, game.player.act && game.player.act.skill]` }, { shot: '万空代替收尾' },
    { js: `run(160); game.player.cool = {}; cast('as_mui'); run(8); W.dx = 1; run(3); W.dx = 0; run(20)` }, { shot: '无为法对侧' }, { js: `run(30)` }, { shot: '引爆' },
  ] },
  cross: { job: 'blade', steps: [
    { js: `mob(470, 100); cast('cross'); run(16)` }, { shot: '十字' }, { js: `run(8)` }, { shot: '血十字飞' },
  ] },
};
const names = (process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : Object.keys(SCEN).join(',')).split(','), outJpg = process.argv[3] || 'test/shots/skills/sword-seq.jpg';
const dir = 'test/shots/skills/sword-seq'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const rows = [];
for (const name of names) {
  const S = SCEN[name];
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&mute&cls=sword&mobs=0`); await page.waitForFunction(() => window.__READY);
  await page.evaluate(({ job }) => {
    const p = game.player; game.job = job || null; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
    if (typeof onJobChange === 'function' && job) try { onJobChange(p, job); } catch (e) { }
    for (const id of classSkills('sword', job)) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv || 5, 5));
    p.mpMax = p.mp = 99999; game.paused = true;
    p.x = 380; p.y = 100; p.face = 1; p.setState('idle'); p.act = null; p.cool = {}; p.buffs = {};
    window.W = { dx: 0, dy: 0 };
    const pad = p.pad, dx0 = pad.dx.bind(pad), dy0 = pad.dy.bind(pad); pad.dx = () => W.dx || dx0(); pad.dy = () => W.dy || dy0();
    window.mob = (x, y, kind = 'goblin') => { const m = spawnMonster(kind, x, y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; return m; };
    window.run = n => { for (let i = 0; i < n; i++) { step(1 / 60); const p = game.player; p.mp = p.mpMax; p.hp = Math.max(p.hp, p.hpMax * 0.8); } };
    window.cast = id => { const p = game.player; const i = 0; game.skillBar[i] = id; return castSkill(p, id, false, 's0'); };
  }, { job: S.job });
  const shots = [];
  for (const st of S.steps) {
    if (st.js) { const r = await page.evaluate(/^\s*\(\(\) =>/.test(st.js) || !st.js.includes("return") ? st.js : `(() => { ${st.js} })()`); if (r !== undefined && r !== null) console.log(name, st.js.slice(0, 40), '→', JSON.stringify(r)); }
    if (st.shot) {
      await page.waitForTimeout(60);
      const pos = await page.evaluate(() => { const p = __G.player; return { x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }; });
      const f = `${dir}/${name}-${shots.length}.png`, w = st.w || 560, h = st.h || 360;
      await page.screenshot({ path: f, clip: { x: Math.max(0, Math.min(1280 - w, pos.x - w * 0.4 + (st.ox || 0))), y: Math.max(0, Math.min(720 - h, pos.y - h * 0.75)), width: w, height: h } });
      shots.push({ f, label: st.shot });
    }
  }
  const errs = logs.filter(l => l.type === 'pageerror'); if (errs.length) console.log(name, 'ERR', errs.map(e => e.text.slice(0, 200)));
  rows.push({ name, shots });
  await browser.close();
}
fs.writeFileSync(`${dir}/rows.json`, JSON.stringify(rows));
execFileSync('python3', ['-c', `
import json, sys
from PIL import Image, ImageDraw, ImageFont
rows = json.load(open(sys.argv[1])); W, H = 280, 180
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 15)
N = max([len(r['shots']) for r in rows] + [1])
sheet = Image.new('RGB', (W * N, H * len(rows)), '#15131a'); d = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for i, s in enumerate(row['shots']):
        sheet.paste(Image.open(s['f']).convert('RGB').resize((W - 2, H - 2)), (i * W, r * H))
        d.text((i * W + 4, r * H + 3), row['name'] + ' ' + s['label'], fill='#ffe8a8', font=font)
sheet.save(sys.argv[2], quality=82)
`, `${dir}/rows.json`, outJpg]);
console.log('→', outJpg);
