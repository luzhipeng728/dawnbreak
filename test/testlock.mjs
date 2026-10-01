// 测试并发名额（2026-10-01 用户：电脑全给你用，可以同时跑 3 套测试）：test/affected.mjs、test/boss.mjs、test/quick.sh 共用
// 名额 = $TMPDIR/dawnbreak-tests.slot.<1..N> 目录（里面写 pid），N = 环境变量 TEST_SLOTS（默认 3）。名额都占满时排队；占名额的进程死了自动回收。
// 已经在占着名额的套件里面跑（名额的 pid 是自己的祖先进程）就不再占，免得自己等自己。
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

export const SLOTS = Math.max(1, +(process.env.TEST_SLOTS || 3));
const slotDir = i => path.join(os.tmpdir(), `dawnbreak-tests.slot.${i}`);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
const pidOf = d => { try { return +(fs.readFileSync(path.join(d, 'pid'), 'utf8').trim() || 0); } catch (e) { return 0; } };
const ancestors = () => { const L = []; let p = process.ppid; for (let i = 0; i < 12 && p > 1; i++) { L.push(p); try { p = +execFileSync('ps', ['-o', 'ppid=', '-p', String(p)], { encoding: 'utf8' }).trim(); } catch (e) { break; } } return L; };

export async function acquireSlot() {
  const anc = ancestors();
  for (let i = 1; i <= SLOTS; i++) if (anc.includes(pidOf(slotDir(i)))) return () => {};   // 在上层套件的名额里
  let said = false;
  for (;;) {
    for (let i = 1; i <= SLOTS; i++) {
      const d = slotDir(i);
      try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); const release = () => { if (pidOf(d) === process.pid) fs.rmSync(d, { recursive: true, force: true }); }; process.on('exit', release); return release; } catch (e) { /* 占用中 */ }
      const pid = pidOf(d); if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true });
    }
    if (!said) { console.log(`测试名额（${SLOTS} 个）都在用，排队等……`); said = true; }
    await new Promise(r => setTimeout(r, 3000));
  }
}
