// 领主曲测试：每个区域的领主房选到自己的曲目（bossTrack），12 首领主曲逐首播放——不静音、不削波、无报错
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&mobs=0`);
await page.waitForFunction(() => window.__READY);
await page.mouse.click(400, 300); await page.waitForTimeout(300);
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('✗', msg); } };

const pick = await page.evaluate(() => {
  const out = {}, seen = new Set();
  for (const id in DUNGEONS) { const d = DUNGEONS[id]; out[id] = { track: bossTrack(d), abyss: !!d.abyss, region: d.region || '' }; seen.add(out[id].track); }
  return { out, songs: Object.keys(SONGS).filter(k => k.startsWith('boss_')), tracks: [...seen] };
});
const EXPECT = { lorien: 'boss_grand', graca: 'boss_grand', dragon_tower: 'boss_sky', floating_castle: 'boss_sky', second_spine: 'boss_behemoth', forbidden_land: 'boss_behemoth',
  shallow_haunt: 'boss_darkelf', ridge: 'boss_snow', fallen_bandits: 'boss_gent', hamelin: 'boss_gent', gent_outskirts: 'boss_gent', gent_east: 'boss_gent', gent_south: 'boss_raid',
  sea_pirates: 'boss_train', grand_fire: 'boss_timegate', law_gate: 'boss_siroco' };
for (const [id, want] of Object.entries(EXPECT)) ok(pick.out[id] && pick.out[id].track === want, `${id}: 领主房曲目 ${pick.out[id] && pick.out[id].track}，应为 ${want}`);
const ab = Object.entries(pick.out).filter(([, v]) => v.abyss);
ok(ab.length > 0 && ab.every(([, v]) => v.track === 'boss_abyss'), `深渊地下城都用 boss_abyss（${ab.length} 个）`);
for (const [id, v] of Object.entries(pick.out)) ok(SONGS_HAS(v.track), `${id}: 曲目 ${v.track} 不存在`);
function SONGS_HAS(t) { return t === 'boss' || pick.songs.includes(t); }
console.log(`领主曲 ${pick.songs.length} 首：${pick.songs.join(' ')}；地下城用到 ${pick.tracks.length} 种`);
ok(pick.songs.length >= 12, `领主曲应至少 12 首（现有 ${pick.songs.length}）`);

const rows = [];
for (const name of pick.songs) {
  await page.evaluate(n => music.play(n), name);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const a = sfx.analyser, buf = new Float32Array(a.fftSize); let sum = 0, n = 0, peak = 0, silent = 0;
    for (let i = 0; i < 60; i++) { a.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) { s += v * v; peak = Math.max(peak, Math.abs(v)); } const rms = Math.sqrt(s / buf.length); if (rms < 0.003) silent++; sum += rms; n++; await new Promise(r => setTimeout(r, 25)); }
    return { rms: +(sum / n).toFixed(4), peak: +peak.toFixed(3), silentFrames: silent };
  });
  rows.push({ name, ...r });
  ok(r.peak < 0.98, `${name} 削波（峰值 ${r.peak}）`);
  ok(r.rms > 0.004 && r.silentFrames < 40, `${name} 几乎静音（rms ${r.rms}，静音帧 ${r.silentFrames}/60）`);
}
console.table(rows);
const errs = logs.filter(l => l.type !== 'warning');
ok(!errs.length, `页面报错 ${JSON.stringify(errs.slice(0, 3))}`);
await browser.close();
console.log(fail ? `music_bosses: ${fail} 项失败` : 'music_bosses: 全部通过');
process.exit(fail ? 1 : 0);
