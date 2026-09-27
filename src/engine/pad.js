/* =====================================================================
   10c. 控制器（虚拟手柄）：角色逻辑只通过 p.pad 读输入，键盘、触屏、AI、以后的网络对战都往 pad 里写按键
   - 键盘 / 触屏：全局 input（engine/core.js），game.step 每帧调用 input.frame
   - AI / 网络：new Pad()，每个逻辑帧先 hold(a) / tap(a) 写入本帧按键，再 frame(t) 结算（按下沿、指令缓冲、双击跑）
   接口与 input 相同：is / hit / up / dx / dy / command / buffered / consume / runDir
   ===================================================================== */
class Pad {
  constructor() {
    this.cur = {}; this.prev = {}; this.want = {};
    this.lastTap = { left: -9, right: -9 }; this.runDir = 0; this.buf = []; this.dirHist = []; this.t = 0;
  }
  hold(a) { if (!this.want[a]) this.want[a] = 1; }         // 本帧按住
  tap(a) { this.want[a] = 2; }                             // 本帧按下（即使上一帧也按着）
  is(a) { return !!this.cur[a]; }
  hit(a) { const v = this.cur[a]; return v === 2 || (!!v && !this.prev[a]); }
  up(a) { return !this.cur[a] && !!this.prev[a]; }
  frame(t) {
    const old = this.prev; this.prev = this.cur; this.cur = this.want; this.want = old;
    for (const k in old) delete old[k];
    input.frame.call(this, t);
  }
  endFrame() { }
  clearAll() { for (const o of [this.cur, this.prev, this.want]) for (const k in o) delete o[k]; this.buf.length = 0; this.dirHist.length = 0; this.runDir = 0; }
}
for (const k of ['dx', 'dy', 'command', 'consume', 'buffered']) Pad.prototype[k] = input[k];
