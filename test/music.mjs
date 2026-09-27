// 音乐测试：逐首播放，采样 RMS / 峰值，检查无报错、不静音、不削波
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&mobs=0`);
await page.waitForFunction(() => window.__READY);
await page.mouse.click(400, 300); await page.waitForTimeout(300);
const rows = [];
for (const name of ['title', 'town', 'dungeon', 'dungeon2', 'dungeon3', 'abyss', 'boss', 'clear']) {
  await page.evaluate(n => music.play(n), name);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const a = sfx.analyser, buf = new Float32Array(a.fftSize); let sum = 0, n = 0, peak = 0, silent = 0;
    for (let i = 0; i < 60; i++) { a.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) { s += v * v; peak = Math.max(peak, Math.abs(v)); } const rms = Math.sqrt(s / buf.length); if (rms < 0.003) silent++; sum += rms; n++; await new Promise(r => setTimeout(r, 50)); }
    return { rms: +(sum / n).toFixed(4), peak: +peak.toFixed(3), silentFrames: silent };
  });
  rows.push({ name, ...r });
}
console.table(rows);
console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 5)));
await browser.close();
