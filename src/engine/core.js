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

/* ---- 键位（官方默认：方向键移动，X 攻击/拾取，C 跳跃（↓+C 后跳，倒地时 C 受身），Z/空格 指令键（方向+Z 放技能），ASDFGH/QWERTY 两排技能，1-6 消耗品栏；
   界面：I 物品栏、M 个人信息、K 技能、L/F1 任务（官方老版任务是 Q，本作 Q 给了第二排技能栏）、N 地图、O 设置、Esc 系统菜单、
   Tab 切换界面、Ctrl 掉落物名称、End 隐藏评价、F12 截图）。
   玩家可以在 设置 → 按键设置 里改键：改键时原地替换 KEYMAP[动作] 数组，所以 input.is/hit 等读法不变 ---- */
const KEYMAP_DEFAULT = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  attack: ['KeyX'], jump: ['KeyC'], cmd: ['KeyZ', 'Space'], cmdB: ['Space'], dodge: ['ShiftLeft', 'KeyV'],
  s0: ['KeyA'], s1: ['KeyS'], s2: ['KeyD'], s3: ['KeyF'], s4: ['KeyG'], s5: ['KeyH'],
  s6: ['KeyQ'], s7: ['KeyW'], s8: ['KeyE'], s9: ['KeyR'], s10: ['KeyT'], s11: ['KeyY'],
  i0: ['Digit1'], i1: ['Digit2'], i2: ['Digit3'], i3: ['Digit4'], i4: ['Digit5'], i5: ['Digit6'],
  inv: ['KeyI'], status: ['KeyM'], skills: ['KeyK'], quests: ['KeyL', 'F1'], map: ['KeyN'], settings: ['KeyO'], pvp: ['KeyP'],
  menu: ['Escape'], confirm: ['Enter', 'NumpadEnter'],
  uiMode: ['Tab'], dropNames: ['ControlLeft'], hideRank: ['End'], tipDetail: ['Backquote'], shot: ['F12'],
};
const KEYMAP = JSON.parse(JSON.stringify(KEYMAP_DEFAULT));
// 按键设置窗口的分组与中文名（顺序即显示顺序）
const KEY_GROUPS = [
  ['移动', ['left', 'right', 'up', 'down']],
  ['战斗', ['attack', 'jump', 'cmd', 'cmdB', 'dodge']],
  ['技能栏', ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11']],
  ['消耗品栏', ['i0', 'i1', 'i2', 'i3', 'i4', 'i5']],
  ['窗口', ['inv', 'status', 'skills', 'quests', 'map', 'settings', 'pvp']],
  ['其他', ['confirm', 'uiMode', 'dropNames', 'hideRank', 'tipDetail', 'shot']],
];
const ACTION_NAME = { left: '向左', right: '向右', up: '向上（纵深）', down: '向下（纵深）', attack: '普通攻击 / 拾取', jump: '跳跃', cmd: '指令键（技能）', cmdB: 'Buff 指令键', dodge: '闪避',
  s0: '技能栏 1', s1: '技能栏 2', s2: '技能栏 3', s3: '技能栏 4', s4: '技能栏 5', s5: '技能栏 6', s6: '扩展技能栏 1', s7: '扩展技能栏 2', s8: '扩展技能栏 3', s9: '扩展技能栏 4', s10: '扩展技能栏 5', s11: '扩展技能栏 6',
  i0: '消耗品 1', i1: '消耗品 2', i2: '消耗品 3', i3: '消耗品 4', i4: '消耗品 5', i5: '消耗品 6',
  inv: '物品栏', status: '个人信息', skills: '技能', quests: '任务', map: '地图', settings: '游戏设置', pvp: '决斗场', menu: '系统菜单',
  confirm: '确认', uiMode: '切换界面显示', dropNames: '显示掉落物名称', hideRank: '隐藏实时评价', tipDetail: '说明详细 / 简略', shot: '截图' };
const KEY_FIXED = new Set(['menu']);   // Esc 固定，避免把自己锁在菜单外
const KEY_SHARE = { cmd: ['cmdB'], cmdB: ['cmd'] };   // 可以共用同一个键的动作（官方：Space 既是指令键，也是 Buff 指令键）
const KEY_BANNED = new Set(['F5', 'F11', 'MetaLeft', 'MetaRight', 'ContextMenu', 'CapsLock', 'NumLock', 'PrintScreen']);
const KEY_LABEL = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc', Enter: 'Enter', NumpadEnter: '小键盘Enter', Tab: 'Tab', Backquote: '`',
  ShiftLeft: 'Shift', ShiftRight: '右Shift', ControlLeft: 'Ctrl', ControlRight: '右Ctrl', AltLeft: 'Alt', AltRight: '右Alt', Backspace: 'Backspace', Delete: 'Del', Insert: 'Ins',
  Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
function keyLabel(code) {
  if (!code) return '—';
  if (KEY_LABEL[code]) return KEY_LABEL[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return '小键盘' + code.slice(6);
  return code.replace(/^Numpad/, '小键盘');
}
// 动作当前绑定的按键文字（默认第一个键；all=true 时全部，用“/”隔开）
function keyName(a, all) { const ks = KEYMAP[a] || []; return all ? (ks.map(keyLabel).join(' / ') || '—') : keyLabel(ks[0]); }
function actionsOf(code) { const r = []; for (const a in KEYMAP) if (KEYMAP[a].includes(code)) r.push(a); return r; }

/* ---- 界面偏好（本机保存，与角色无关）：按键、音量、画面选项、窗口位置、手机按钮 ---- */
const UI_PREF_KEY = 'dawnbreak_ui_v1';
const PREF_DEFAULT = { music: 0.6, sfx: 0.9, dmgNum: true, shake: true, cutin: true, fps: false, dropNames: true, hideRank: false, tipDetail: true, hudMode: 'full', winPos: {}, touchSize: 1, touchAlpha: 1, touchSwap: false };
const uiPrefs = JSON.parse(JSON.stringify(PREF_DEFAULT));
function uiPref(k) { return k in uiPrefs ? uiPrefs[k] : PREF_DEFAULT[k]; }
function setPref(k, v) { uiPrefs[k] = v; savePrefs(); }
function savePrefs() {
  const keys = {};
  for (const a in KEYMAP) if (KEYMAP[a].join() !== (KEYMAP_DEFAULT[a] || []).join()) keys[a] = KEYMAP[a];
  try { localStorage.setItem(UI_PREF_KEY, JSON.stringify({ ...uiPrefs, keys })); } catch (e) { /* 无痕模式 / 存储已满 */ }
}
function loadPrefs() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(UI_PREF_KEY) || 'null'); } catch (e) { d = null; }
  if (!d || typeof d !== 'object') return;
  for (const k in PREF_DEFAULT) if (k in d && typeof d[k] === typeof PREF_DEFAULT[k]) uiPrefs[k] = d[k];
  const keys = d.keys || {};
  for (const a in keys) if (KEYMAP[a] && !KEY_FIXED.has(a) && Array.isArray(keys[a])) KEYMAP[a].splice(0, KEYMAP[a].length, ...keys[a].filter(c => typeof c === 'string').slice(0, 2));
}
// 改键：把 code 绑到动作 a 的第 slot 个位置（每个动作最多 2 个键）。同一个键只能属于一个动作（官方规则），被占用的动作会失去这个键；返回被抢走按键的动作列表
function bindKey(a, code, slot = 0) {
  if (!KEYMAP[a] || KEY_FIXED.has(a) || KEY_BANNED.has(code)) return null;
  const lost = [];
  for (const b in KEYMAP) { if (b === a || (KEY_SHARE[a] || []).includes(b)) continue; const i = KEYMAP[b].indexOf(code); if (i >= 0) { if (KEY_FIXED.has(b)) return null; KEYMAP[b].splice(i, 1); lost.push(b); } }
  const ks = KEYMAP[a], j = ks.indexOf(code);
  if (j >= 0 && j !== slot) ks.splice(j, 1);
  ks[Math.min(slot, ks.length)] = code;
  KEYMAP[a] = ks.filter(Boolean).slice(0, 2);
  savePrefs(); return lost;
}
function unbindKey(a, slot) { if (!KEYMAP[a] || KEY_FIXED.has(a)) return; KEYMAP[a].splice(slot, 1); savePrefs(); }
function resetKeys() { for (const a in KEYMAP_DEFAULT) KEYMAP[a] = [...KEYMAP_DEFAULT[a]]; savePrefs(); }
loadPrefs();
// 正在往输入框里打字（例如输入角色名）：键盘不再当作游戏操作
const isTyping = () => { const e = document.activeElement; return !!e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.isContentEditable) && e.type !== 'range' && e.type !== 'checkbox'; };
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
    for (const a of ['attack', 'jump', 'cmd', 'cmdB', 'dodge', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11']) if (this.hit(a)) this.buf.push({ a, t });
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
  if (isTyping()) return;
  // 游戏里用到的键不触发浏览器默认行为（空格滚动、Tab 切焦点、F1 帮助、F12 开发者工具等）
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F1'].includes(e.code) || (actionsOf(e.code).length && !e.ctrlKey && !e.metaKey && e.code !== 'Escape')) e.preventDefault();
  if (!e.repeat) { input.pressed.add(e.code); }
  input.down.add(e.code);
});
addEventListener('keyup', e => { input.down.delete(e.code); input.released.add(e.code); });
addEventListener('blur', () => input.clearAll());
