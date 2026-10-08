// 奥兹玛区域接入测试：区域 spec 经 defineRegion 展开、运行时桥接（OZMA_RUNTIME）与规则会话创建
import fs from 'fs';
import vm from 'vm';
import { launch, URL_BASE } from './lib.mjs';

const coreSrc = fs.readFileSync(new URL('../src/game/ozma_core.js', import.meta.url), 'utf8') + '\nthis.OZMA_CORE = OZMA_CORE;';
const src = fs.readFileSync(new URL('../src/content/regions/ozma.js', import.meta.url), 'utf8') + '\nthis.OZMA_REGION_SPEC = OZMA_REGION_SPEC; this.OZMA_RUNTIME = OZMA_RUNTIME;';
let captured = null;
const ctx = {
  defineRegion(spec) { captured = spec; },
};
let loadErr = null;
try { vm.runInNewContext(coreSrc, ctx); vm.runInNewContext(src, ctx); } catch (e) { loadErr = e; }
const errors = [];
const ok = (v, msg) => { if (!v) errors.push(msg); };
ok(!loadErr, `区域 spec 加载失败：${loadErr && loadErr.message}`);
const spec = ctx.OZMA_REGION_SPEC;
ok(spec && captured === spec, '区域 spec 已交给 defineRegion 展开');
ok(spec && spec.id === 'ozma', '区域 id 为 ozma');
const runtimeBridge = ctx.OZMA_RUNTIME;
ok(runtimeBridge && runtimeBridge.region === 'ozma', '运行时桥接已注册');
ok(runtimeBridge && runtimeBridge.core('ruin_path') && runtimeBridge.core('ruin_path').boss === '毁灭之王卡赞', '运行时地图可回指 OZMA_CORE');
const bridgeState = runtimeBridge && runtimeBridge.create([{ uid: 'node-test', name: 'Node', cls: 'sword' }], 1000, { seed: 7 });
ok(bridgeState && bridgeState.raid === 'ozma', '运行时可创建奥兹玛规则会话');
const bridgeStart = bridgeState && runtimeBridge.apply(bridgeState, { t: 'start' }, 1000);
ok(bridgeStart && !bridgeStart.err && bridgeState.st === 'routes', '实际地图入口可推进核心会话');
ok(runtimeBridge && runtimeBridge.map('ozma_ruin_path') && runtimeBridge.map('ozma_p2_throne'), 'P1/P2 地图元数据均可读取');
ok(runtimeBridge && runtimeBridge.content('ruin_path')?.mechanics?.length, '运行时可读取逐图核心机制清单');
const ds = spec ? Object.values(spec.dungeons || {}) : [];
ok(ds.length === 18, `奥兹玛有 18 张可玩的地图（实际 ${ds.length}）`);
for (const [id, d] of Object.entries(spec?.dungeons || {})) {
  ok(d.gate && d.gate.scene === 'ozma_field', `${id} 有地图入口`);
  ok(Array.isArray(d.mobs) && d.mobs.length >= 3, `${id} 配置了小怪`);
  ok(d.preBoss && d.preBoss.kind, `${id} 配置了门将`);
  ok(d.boss && spec.bosses[d.boss], `${id} 配置了主 Boss`);
  ok(d.ozma && d.ozma.waves?.length >= 2 && d.ozma.phases?.length >= 2 && d.ozma.mechanics?.length > 0 && d.ozma.fail?.wipeLimit, `${id} 保留逐图波次/阶段/机制/失败条件`);
  ok(spec.bosses[d.boss] && Array.isArray(spec.bosses[d.boss].phases) && spec.bosses[d.boss].phases.length >= 2, `${id} 配置了 Boss 阶段`);
}
for (const [id, b] of Object.entries(spec?.bosses || {})) {
  ok(Array.isArray(b.phases) && b.phases.length >= 2, `${id} Boss 阶段不足`);
  ok(Array.isArray(b.mechs) && b.mechs.length > 0, `${id} 没有失败/协作机制`);
}
if (!errors.length) console.log(`spec 通过：${ds.length} 张地图、${Object.keys(spec.bosses).length} 个 Boss`);
else for (const e of errors) console.error('✗', e);
if (errors.length) process.exit(1);

/* Chrome smoke 是可选的；纯 Node 验收不能被并发浏览器进程拖垮。 */
if (process.env.OZMA_BROWSER === '1') {
  const { page, browser } = await launch({ width: 1280, height: 720 });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(`${URL_BASE}?test&mute&cls=sword&mon=msLab`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  const runtime = await page.evaluate(() => {
    const R = REGIONS.ozma;
    const ids = R ? R.dungeons : [];
    const rows = ids.map(id => {
      const d = DUNGEONS[id];
      return { id, d: !!d, boss: d && !!MON[d.boss.kind], mobs: d && d.mobs.every(x => !!MON[x[0]]), gate: Object.values(SCENES).some(s => s.gates.some(g => g.dungeon === id)) };
    });
    return { region: !!R, rows, scene: !!SCENES.ozma_field, entry: SCENES.siroco_town && SCENES.siroco_town.exits.some(x => x.to === 'ozma_town') };
  });
  ok(!pageErrors.length, `浏览器无 pageerror：${pageErrors.join(' | ')}`);
  ok(runtime.region && runtime.scene && runtime.entry, '奥兹玛区域、场景和希洛克出口已注册');
  ok(runtime.rows.length === 18 && runtime.rows.every(x => x.d && x.boss && x.mobs && x.gate), '18 张地图均已接入 DUNGEONS/MON/世界地图门');
  console.log(runtime);
  await browser.close();
} else console.log('浏览器 smoke 已跳过（设置 OZMA_BROWSER=1 执行）');
if (errors.length) process.exit(1);
