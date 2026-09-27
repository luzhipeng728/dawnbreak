/* =====================================================================
   00. 基础：数学工具、随机数、输入（键盘状态 / 按下边沿 / 双击 / 指令缓冲）、时间
   ===================================================================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smooth = (a, b, x) => { const t = invLerp(a, b, x); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const sign = v => v < 0 ? -1 : 1;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t;
const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const PARAMS = new URLSearchParams(location.search);
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const fmtNum = n => Math.round(n).toLocaleString('en-US');

/* ---- 键位（贴近原作默认：方向键移动，X 攻击/拾取，C 跳跃（↓+C 后跳，倒地时 C 受身），Z/空格 指令键（方向+Z 放技能），ASDFGH/QWERTY 两排技能，1-6 物品栏） ---- */
const KEYMAP = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  attack: ['KeyX'], jump: ['KeyC'], cmd: ['KeyZ', 'Space'], dodge: ['ShiftLeft', 'ShiftRight', 'KeyV'],
  s0: ['KeyA'], s1: ['KeyS'], s2: ['KeyD'], s3: ['KeyF'], s4: ['KeyG'], s5: ['KeyH'],
  s6: ['KeyQ'], s7: ['KeyW'], s8: ['KeyE'], s9: ['KeyR'], s10: ['KeyT'], s11: ['KeyY'],
  i0: ['Digit1'], i1: ['Digit2'], i2: ['Digit3'], i3: ['Digit4'], i4: ['Digit5'], i5: ['Digit6'],
  inv: ['KeyI'], skills: ['KeyK'], status: ['KeyM'], map: ['KeyN'], menu: ['Escape'], confirm: ['Enter', 'NumpadEnter'],
};
const input = {
  down: new Set(), pressed: new Set(), released: new Set(), virt: {},   // virt：触屏/手柄的虚拟按键
  lastTap: { left: -9, right: -9 }, runDir: 0, buf: [], dirHist: [], t: 0,
  is(a) { if (this.virt[a]) return true; for (const k of KEYMAP[a] || []) if (this.down.has(k)) return true; return false; },
  hit(a) { if (this.virt[a] === 2) return true; for (const k of KEYMAP[a] || []) if (this.pressed.has(k)) return true; return false; },
  up(a) { for (const k of KEYMAP[a] || []) if (this.released.has(k)) return true; return false; },
  dx() { return (this.is('right') ? 1 : 0) - (this.is('left') ? 1 : 0); },
  dy() { return (this.is('down') ? 1 : 0) - (this.is('up') ? 1 : 0); },
  // 每帧开始：记录方向键历史（用于 ↓→ 之类的指令）与双击跑步
  frame(t) {
    this.t = t;
    for (const [a, d] of [['left', -1], ['right', 1]]) if (this.hit(a)) { if (t - this.lastTap[a] < 0.26) this.runDir = d; this.lastTap[a] = t; }
    if (this.runDir && !this.is(this.runDir < 0 ? 'left' : 'right')) this.runDir = 0;
    for (const a of ['left', 'right', 'up', 'down']) if (this.hit(a)) this.dirHist.push({ a, t });
    while (this.dirHist.length && t - this.dirHist[0].t > 0.6) this.dirHist.shift();
    for (const a of ['attack', 'jump', 'cmd', 'dodge', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11']) if (this.hit(a)) this.buf.push({ a, t });
    while (this.buf.length && t - this.buf[0].t > 0.3) this.buf.shift();
  },
  // 指令判定：seq 为方向序列（相对朝向：'f' 前 'b' 后 'd' 下 'u' 上），facing 为当前朝向
  command(seq, facing, span = 0.45) {
    // 从最近的方向输入往前找，按顺序匹配 seq；最后一个方向要在 0.25 s 内，整串在 span 秒内
    const map = { f: facing > 0 ? 'right' : 'left', b: facing > 0 ? 'left' : 'right', d: 'down', u: 'up' };
    let i = seq.length - 1, first = null;
    const H = this.dirHist; if (!H.length || this.t - H[H.length - 1].t > 0.25) return false;
    for (let k = H.length - 1; k >= 0 && i >= 0; k--) { if (this.t - H[k].t > span) break; if (H[k].a === map[seq[i]]) { i--; first = H[k]; } else return false; }
    return i < 0;
  },
  consume(a) { const k = this.buf.findIndex(b => b.a === a); if (k >= 0) { this.buf.splice(k, 1); return true; } return false; },
  buffered(a) { return this.buf.some(b => b.a === a); },
  endFrame() { this.pressed.clear(); this.released.clear(); for (const k in this.virt) if (this.virt[k] === 2) this.virt[k] = 1; },
  clearAll() { this.down.clear(); this.pressed.clear(); this.buf.length = 0; this.dirHist.length = 0; this.runDir = 0; this.virt = {}; },
};
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (!e.repeat) { input.pressed.add(e.code); }
  input.down.add(e.code);
});
addEventListener('keyup', e => { input.down.delete(e.code); input.released.add(e.code); });
addEventListener('blur', () => input.clearAll());
