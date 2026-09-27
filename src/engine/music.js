/* =====================================================================
   08. 背景音乐：WebAudio 实时合成的步进音序器（16 分音符网格，提前 0.25 s 排程）
   曲目（全部原创）：title 钢琴 / town 田园吉他+长笛（艾尔文防线）/ field 区域地图 / dungeon 明快冒险 / dungeon2 摇滚 / dungeon3 部落战鼓 / abyss 阴森钟声 / boss 高压 / clear 胜利号角
     城镇：seria 八音盒（赛丽亚的房间）/ hendon 王都进行曲（赫顿玛尔）/ backstreet 小酒馆爵士（后街）/ westcoast 水手小调（西海岸）/ guild 竖琴与钟声（魔法师公会）
   只用有音高的乐器与短促的鼓点，不放任何持续噪声
   ===================================================================== */
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const music = {
  cur: null, song: null, out: null, step: 0, nextT: 0, timer: null,
  start() {
    const c = sfx.ctx; if (!c) return;
    if (!this.rev) {
      // 简单混响：程序生成的衰减脉冲响应
      const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      this.rev = c.createConvolver(); this.rev.buffer = ir; this.wet = sfx.g(0.22, sfx.mus); this.rev.connect(this.wet);
      this.dist = c.createWaveShaper(); const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cv[i] = Math.tanh(x * 4) * 0.8; } this.dist.curve = cv;
    }
    if (!this.timer) this.timer = setInterval(() => this.pump(), 40);
    if (this.cur && !this.song) this.switchTo(this.cur);
  },
  play(name) { if (name === this.cur) return; this.cur = name; if (sfx.ctx) this.switchTo(name); },
  stop() { this.cur = null; this.switchTo(null); },
  switchTo(name) {
    const c = sfx.ctx; if (!c) return;
    if (this.out) { const o = this.out, sn = this.send; o.gain.cancelScheduledValues(c.currentTime); o.gain.setValueAtTime(o.gain.value, c.currentTime); o.gain.linearRampToValueAtTime(0, c.currentTime + 0.7); setTimeout(() => { o.disconnect(); sn.disconnect(); }, 1500); }
    this.song = name ? SONGS[name] : null; this.out = null;
    if (!this.song) return;
    this.out = sfx.g(this.song.vol || 1, sfx.mus); this.send = sfx.g(this.song.wet ?? 1, this.rev); this.out.connect(this.send);
    this.step = 0; this.nextT = c.currentTime + 0.12;
  },
  pump() {
    const c = sfx.ctx, S = this.song; if (!c || !S || c.state !== 'running') return;
    const sd = 60 / S.bpm / 4;
    // 主线程卡顿 / 标签页挂起后：跳过已经错过的拍子，而不是把它们挤在一起补播
    if (this.nextT < c.currentTime) { const miss = Math.ceil((c.currentTime - this.nextT) / sd); this.nextT += miss * sd; this.step += miss; }
    while (this.nextT < c.currentTime + 0.25) {
      const total = S.chords.length * 16;
      if (S.once && this.step >= total) { this.song = null; return; }
      const s = this.step % total, bi = s >> 4, pos = s & 15, [cr, q] = S.chords[bi];
      const root = S.root + cr, tones = q === 'm' ? [0, 3, 7, 12, 15] : q === 'd' ? [0, 3, 6, 12, 15] : [0, 4, 7, 12, 16];
      for (const P of S.parts) P(this.nextT, bi, pos, root, tones, sd, S);
      this.nextT += sd; this.step++;
    }
  },
  // ---- 乐器 ----
  osc(type, f, t, dur, peak, { a = 0.005, dest, detune = 0, curve = 'exp', lp, lpEnd, q = 0.7 } = {}) {
    const c = sfx.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    let head = o; const nodes = [g];
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q; fl.frequency.setValueAtTime(lp, t); if (lpEnd) fl.frequency.exponentialRampToValueAtTime(lpEnd, t + dur); o.connect(fl); head = fl; nodes.push(fl); }
    head.connect(g); g.connect(dest || this.out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    else { g.gain.setValueAtTime(peak, t + Math.max(a, dur - 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06); }
    o.start(t); o.stop(t + a + dur + 0.1); o.onended = () => { o.disconnect(); for (const n of nodes) n.disconnect(); };
    return o;
  },
  vib(o, t, d, depth = 6, rate = 5.5, delay = 0.18) { const c = sfx.ctx, l = c.createOscillator(), g = c.createGain(); l.frequency.value = rate; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(depth, t + delay + 0.2); l.connect(g); g.connect(o.detune); l.start(t); l.stop(t + d + 0.2); l.onended = () => { l.disconnect(); g.disconnect(); }; },
  noiseHit(t, type, f, dur, v, q = 1) { const c = sfx.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = sfx.noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); fl.connect(g); g.connect(this.out); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); s.onended = () => { s.disconnect(); fl.disconnect(); g.disconnect(); }; },
};
const MI = {
  pluck: (t, m, v, d) => { music.osc('triangle', mtof(m), t, Math.max(0.35, d * 1.6), v, { a: 0.003, lp: 3200, lpEnd: 700 }); music.osc('square', mtof(m), t, 0.12, v * 0.12, { a: 0.002, lp: 2400, lpEnd: 600 }); },
  piano: (t, m, v, d) => { music.osc('triangle', mtof(m), t, 1.6, v, { a: 0.003 }); music.osc('sine', mtof(m + 12), t, 0.9, v * 0.35, { a: 0.003 }); music.osc('sine', mtof(m), t, 2.2, v * 0.5, { a: 0.003 }); },
  flute: (t, m, v, d) => { const o = music.osc('sine', mtof(m), t, d, v, { a: 0.04, curve: 'lin' }); music.vib(o, t, d, 9); music.osc('triangle', mtof(m + 12), t, d, v * 0.12, { a: 0.05, curve: 'lin' }); },
  lead: (t, m, v, d) => { const o = music.osc('square', mtof(m), t, d, v, { a: 0.01, curve: 'lin', lp: 2600, q: 1.2 }); music.vib(o, t, d, 10); const o2 = music.osc('sawtooth', mtof(m), t, d, v * 0.35, { a: 0.01, curve: 'lin', lp: 1800, detune: 7 }); music.vib(o2, t, d, 10); },
  synlead: (t, m, v, d) => { for (const dt of [-9, 9]) { const o = music.osc('sawtooth', mtof(m), t, d, v * 0.5, { a: 0.012, curve: 'lin', lp: 3400, q: 2, detune: dt }); music.vib(o, t, d, 14, 6); } },
  horn: (t, m, v, d) => { const o = music.osc('sawtooth', mtof(m), t, d, v, { a: 0.06, curve: 'lin', lp: 700, lpEnd: 1500, q: 1.5 }); music.vib(o, t, d, 6, 5); music.osc('sawtooth', mtof(m - 12), t, d, v * 0.4, { a: 0.07, curve: 'lin', lp: 500 }); },
  bass: (t, m, v, d) => { music.osc('triangle', mtof(m), t, d, v, { a: 0.005 }); music.osc('sine', mtof(m - 12), t, d, v * 0.8, { a: 0.005 }); },
  sawbass: (t, m, v, d) => { music.osc('sawtooth', mtof(m), t, d, v, { a: 0.004, lp: 900, lpEnd: 220, q: 3 }); music.osc('sine', mtof(m - 12), t, d, v * 0.7, { a: 0.004 }); },
  pad: (t, ms, v, d) => { for (const m of ms) for (const dt of [-8, 8]) music.osc('sawtooth', mtof(m), t, d, v, { a: Math.min(0.5, d * 0.3), curve: 'lin', lp: 1100, detune: dt }); },
  strings: (t, ms, v, d) => { for (const m of ms) { const o = music.osc('sawtooth', mtof(m), t, d, v, { a: Math.min(0.25, d * 0.2), curve: 'lin', lp: 2200, detune: rnd(-6, 6) }); music.vib(o, t, d, 8, 5.2, 0.1); } },
  bell: (t, m, v, d) => { music.osc('sine', mtof(m), t, 2.8, v, { a: 0.002 }); music.osc('sine', mtof(m) * 2.76, t, 1.4, v * 0.35, { a: 0.002 }); music.osc('sine', mtof(m) * 5.4, t, 0.6, v * 0.15, { a: 0.002 }); },
  brass: (t, m, v, d) => { for (const dt of [-6, 6]) music.osc('sawtooth', mtof(m), t, d, v * 0.5, { a: 0.03, curve: 'lin', lp: 900, lpEnd: 2400, q: 1 }); },
  kick: (t, v) => { const o = music.osc('sine', 150, t, 0.28, v, { a: 0.002 }); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); },
  snare: (t, v) => { music.noiseHit(t, 'bandpass', 1900, 0.14, v * 0.8, 0.9); const o = music.osc('triangle', 200, t, 0.08, v * 0.5, { a: 0.002 }); o.frequency.exponentialRampToValueAtTime(150, t + 0.06); },
  hat: (t, v, open) => music.noiseHit(t, 'highpass', 7500, open ? 0.14 : 0.035, v, 0.7),
  shaker: (t, v) => music.noiseHit(t, 'bandpass', 6500, 0.05, v, 1.5),
  crash: (t, v) => music.noiseHit(t, 'highpass', 5000, 1.2, v, 0.5),
  tom: (t, v, f = 110) => { const o = music.osc('sine', f, t, 0.35, v, { a: 0.003 }); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.25); music.noiseHit(t, 'lowpass', 900, 0.05, v * 0.25); },
};
// 失真吉他：锯齿波 → 失真 → 低通（每个音单独建链，避免共享节点互相影响）
MI.power = (t, m, v, d) => {
  const c = sfx.ctx, g = c.createGain(), fl = c.createBiquadFilter(), ws = c.createWaveShaper(); ws.curve = music.dist.curve;
  fl.type = 'lowpass'; fl.frequency.value = d < 0.2 ? 1400 : 2800; fl.Q.value = 0.8;
  const pre = c.createGain(); pre.gain.value = 0.5; pre.connect(ws); ws.connect(fl); fl.connect(g); g.connect(music.out);
  const oscs = [[0, -7], [7, 7], [12, 0]].map(([iv, dt]) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + iv); o.detune.value = dt; o.connect(pre); o.start(t); o.stop(t + d + 0.12); return o; });
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.setValueAtTime(v, t + Math.max(0.01, d - 0.04)); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.08);
  oscs[0].onended = () => { for (const o of oscs) o.disconnect(); pre.disconnect(); ws.disconnect(); fl.disconnect(); g.disconnect(); };
};
/* ---- 编曲零件：每个返回 (t, 小节, 小节内位置, 和弦根音, 和弦音, 16分音符时长, 曲目) => void ---- */
const hits = (p, pos) => p[pos] && p[pos] !== '.';
function partBass(pat, inst = 'bass', oct = -24, vol = 0.22) {
  return (t, bi, pos, root, tones, sd) => { const ch = pat[pos]; if (!ch || ch === '.') return; let len = 1; while (pos + len < 16 && pat[pos + len] === '.') len++; const iv = ch === '5' ? 7 : ch === 'o' ? 12 : ch === '3' ? tones[1] : 0; MI[inst](t, root + oct + iv, vol, len * sd * 0.95); };
}
function partArp(seq, every, inst = 'pluck', oct = -12, vol = 0.1) {
  return (t, bi, pos, root, tones, sd) => { if (pos % every) return; const i = seq[(pos / every) % seq.length]; if (i < 0) return; MI[inst](t, root + oct + tones[i], vol, every * sd); };
}
function partPad(inst = 'pad', oct = -12, vol = 0.03, every = 16) {
  return (t, bi, pos, root, tones, sd) => { if (pos % every) return; MI[inst](t, tones.slice(0, 3).map(x => root + oct + x), vol, every * sd); };
}
function partChug(pat, oct = -24, vol = 0.1) {
  return (t, bi, pos, root, tones, sd) => { const ch = pat[pos]; if (!ch || ch === '.') return; let len = 1; while (pos + len < 16 && pat[pos + len] === '.') len++; MI.power(t, root + oct, vol, ch === 'X' ? len * sd : sd * 0.8); };
}
function partDrums(D, vol = 1) {
  return (t, bi, pos, root, tones, sd, S) => {
    if (D.k && hits(D.k, pos)) MI.kick(t, 0.5 * vol);
    if (D.s && hits(D.s, pos)) MI.snare(t, (D.s[pos] === 'g' ? 0.08 : 0.3) * vol);
    if (D.h && hits(D.h, pos)) MI.hat(t, (D.h[pos] === 'o' ? 0.08 : 0.05) * vol, D.h[pos] === 'o');
    if (D.sh && hits(D.sh, pos)) MI.shaker(t, 0.035 * vol);
    if (D.t && hits(D.t, pos)) MI.tom(t, 0.4 * vol, D.t[pos] === 'h' ? 150 : D.t[pos] === 'l' ? 80 : 110);
    if (D.crash && pos === 0 && bi % D.crash === 0) MI.crash(t, 0.06 * vol);
  };
}
// 旋律：每个记号占 unit 个 16 分音符；数字 = 调内音级（可带 # b，可为负或 ≥7），'.' 延长，'-' 休止
function partMel(mel, inst, oct = 0, vol = 0.1, unit = 2) {
  const toks = mel.trim().split(/\s+/), ev = [];
  toks.forEach((tk, i) => { if (tk === '.') { if (ev.length && ev[ev.length - 1].open) ev[ev.length - 1].len++; return; } if (ev.length) ev[ev.length - 1].open = false; if (tk === '-') return; const m = tk.match(/^(-?\d+)([#b]?)$/); ev.push({ i, d: +m[1], acc: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, len: 1, open: true }); });
  const at = new Map(ev.map(e => [e.i, e])), n = toks.length;
  return (t, bi, pos, root, tones, sd, S) => {
    if (pos % unit) return; const idx = ((bi * 16 + pos) / unit) % n, e = at.get(idx); if (!e) return;
    const sc = S.scale, d = ((e.d % 7) + 7) % 7, m = S.root + oct + sc[d] + 12 * Math.floor(e.d / 7) + e.acc;
    MI[inst](t, m, vol, e.len * unit * sd * 0.92);
  };
}
// 阴森：稀疏的不协和钟声（伪随机，但每轮一样）
function partBells(vol = 0.07) {
  const R = mulberry(1234), plan = Array.from({ length: 16 }, () => R() < 0.35 ? [0, 1, 3, 6, 8, 11, 13][Math.floor(R() * 7)] : null);
  return (t, bi, pos, root, tones, sd, S) => { if (pos % 4) return; const iv = plan[(bi * 4 + pos / 4) % 16]; if (iv === null) return; MI.bell(t, S.root + 12 + iv, vol, 2); };
}
const SONGS = {
  title: { bpm: 76, root: 57, scale: MINOR, vol: 1, chords: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [0, 'm'], [8, 'M'], [10, 'M'], [7, 'M']],
    parts: [partArp([0, 2, 3, 4, 3, 2, 3, 2], 2, 'piano', -12, 0.07), partBass('x.......x.......', 'bass', -24, 0.12),
      partMel('4 . . 3 4 . 7 . 5 . . 4 2 . . . 2 . 4 . 9 . 7 . 6 . . . 8 . . . 7 . . 8 9 . 7 . 10 . 9 . 7 . 5 . 6 . 8 . 11 . 10 . 8 . . 6# 8 . . .', 'piano', 12, 0.1)] },
  town: { bpm: 100, root: 62, scale: MAJOR, chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [5, 'M'], [0, 'M'], [2, 'm'], [7, 'M']],
    parts: [partArp([0, 2, 3, 2, 1, 2, 3, 2], 2, 'pluck', -12, 0.085), partBass('x.......x...5...', 'bass', -24, 0.14), partPad('pad', -12, 0.012),
      partMel('4 . 2 . 0 . 2 4 8 . 6 . 4 . . - 5 . 7 . 9 . 7 5 3 . 4 5 4 . 2 . 7 . . 5 3 . 5 7 9 . 7 . 4 . . - 8 7 5 . 4 . 3 . 6 . 5 . 4 . . -', 'flute', 12, 0.075),
      partDrums({ k: 'x.......x.......', sh: '..x...x...x...x.', s: '....g.......g...' }, 0.8)] },
  field: { bpm: 112, root: 57, scale: MAJOR, chords: [[0, 'M'], [5, 'M'], [7, 'M'], [0, 'M'], [9, 'm'], [5, 'M'], [2, 'm'], [7, 'M']],   // 格兰之森林间小路：轻快的冒险感
    parts: [partArp([0, 1, 2, 3, 2, 1, 2, 1], 2, 'pluck', -12, 0.07), partBass('x.....x.x.......', 'bass', -24, 0.12), partPad('strings', -12, 0.012, 8),
      partMel('4 . . 5 7 . 4 . 2 . . 0 2 . . - 5 . 4 . 2 . 4 5 7 . . . 9 . 7 . 4 . . 5 7 . 9 . 11 . 9 . 7 . . - 9 . 7 . 5 . 4 . 2 . 4 . 2 . 0 .', 'flute', 12, 0.07),
      partDrums({ k: 'x.......x.x.....', sh: 'x.x.x.x.x.x.x.x.', s: '....g.......g...' }, 0.7)] },
  dungeon: { bpm: 124, root: 62, scale: MAJOR, chords: [[0, 'M'], [10, 'M'], [5, 'M'], [0, 'M'], [9, 'm'], [5, 'M'], [7, 'M'], [7, 'M']],
    parts: [partBass('x.x.x.x.x.x.o.x.', 'sawbass', -24, 0.11), partPad('strings', -12, 0.018, 8), partArp([0, 1, 2, 3, 2, 1, 2, 3], 1, 'pluck', 0, 0.035),
      partMel('4 . . 7 . . 6 7 8 . 7 . 6b . 4 . 3 . 4 . 5 . 7 . 4 . . . . . - - 5 . . 4 5 . 7 . 9 . 8 . 7 . 5 . 8 . . 7 6 . 4 . 6 . 7 . 8 . . -', 'lead', 0, 0.06),
      partDrums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo', crash: 4 })] },
  dungeon2: { bpm: 140, root: 52, scale: MINOR, chords: [[0, 'm'], [8, 'M'], [10, 'M'], [0, 'm'], [0, 'm'], [8, 'M'], [10, 'M'], [7, 'M']],
    parts: [partChug('x.xxx.xxX...x.x.', -12, 0.06), partBass('x.x.x.x.x.x.x.x.', 'sawbass', -12, 0.1),
      partMel('7 . . 6 7 . 9 . 11 . 9 . 7 . 5 . 8 . . 6 8 . 10 . 7 . . . . . - - 4 . 7 . 9 . 11 . 12 . 11 9 . . 7 . 10 . 9 8 . . 6 . 8 . . 6# . . 4 .', 'synlead', 12, 0.055),
      partDrums({ k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', crash: 4 })] },
  dungeon3: { bpm: 132, root: 50, scale: MINOR, chords: [[0, 'm'], [10, 'M'], [8, 'M'], [10, 'M'], [0, 'm'], [10, 'M'], [8, 'M'], [7, 'M']],
    parts: [partBass('x..x..x.x..x..5.', 'sawbass', -12, 0.1), partPad('pad', 0, 0.012),
      partMel('0 . . 2 4 . . . 3 . 2 . 1 . . . 2 . . 3 5 . 4 . 4 . . . 1 . . . 7 . . 6 7 . 9 . 8 . 7 . 6 . 4 . 5 . . 4 5 . 7 . 8 . . . 6# . 4 .', 'horn', 12, 0.07),
      partDrums({ t: 'l..h..l.l.h.m...', k: 'x.....x.x.......', s: '............x...', sh: '..x...x...x...x.' })] },
  abyss: { bpm: 70, root: 49, scale: MINOR, wet: 1.6, chords: [[0, 'm'], [0, 'm'], [1, 'M'], [0, 'd']],
    parts: [partPad('pad', -12, 0.016), partBass('x...............', 'bass', -24, 0.12), partBells(0.06), partDrums({ k: 'x..x............' }, 0.5)] },
  boss: { bpm: 152, root: 47, scale: MINOR, chords: [[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M'], [8, 'M'], [10, 'M'], [0, 'm'], [7, 'M']],
    parts: [partChug('xxxxxxxxX.x.x.x.', -12, 0.055), partBass('xxxxxxxxxxxxxxxx', 'sawbass', -12, 0.08), partArp([0, 1, 2, 3], 1, 'pluck', 12, 0.025),
      partMel('7 . 7 6 7 . 9 . 8b . 7 . 8b . 11 . 9 . 8 . 7 . 4 . 6 . . . . . 8 9 10 . 9 . 7 . 9 . 11 . 10 . 9 . 8 . 7 . 11 . 14 . 11 . 11 . 13# . 15 . 13# .', 'synlead', 12, 0.055),
      partDrums({ k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', crash: 2 })] },
  clear: { bpm: 120, root: 60, scale: MAJOR, once: true, chords: [[0, 'M'], [7, 'M'], [0, 'M'], [0, 'M']],
    parts: [partMel('0 2 4 7 . . 4 7 11 . . . 9 . 10 . 14 . . . . . . . - - - - - - - -', 'brass', 0, 0.1), partPad('strings', -12, 0.02, 16), partDrums({ t: 'l.l.h...........', crash: 1 }, 0.8)] },
};
// 各城镇的曲目（场景 bgm 字段）：艾尔文防线沿用 town（田园吉他 + 长笛）
Object.assign(SONGS, {
  seria: { bpm: 84, root: 65, scale: MAJOR, wet: 1.3, chords: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M'], [0, 'M'], [4, 'm'], [5, 'M'], [7, 'M']],   // 赛丽亚的房间：八音盒摇篮曲
    parts: [partArp([0, 2, 3, 2, 1, 2, 3, 2], 2, 'bell', 12, 0.028), partBass('x.......x.......', 'bass', -24, 0.09), partPad('pad', -12, 0.009),
      partMel('7 . 6 . 4 . 2 . 5 . 4 . 2 . . . 3 . 4 . 5 . 7 . 6 . . . 4 . . . 7 . 9 . 8 . 7 . 6 . 4 . 2 . 4 . 5 . 3 . 1 . 3 . 4 . . . - . . .', 'piano', 12, 0.075)] },
  hendon: { bpm: 108, root: 60, scale: MAJOR, chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [0, 'M'], [7, 'M'], [5, 'M'], [7, 'M']],   // 赫顿玛尔：热闹的王都进行曲
    parts: [partBass('x...5...x...5...', 'bass', -24, 0.13), partPad('strings', -12, 0.013, 8), partArp([0, 1, 2, 1], 2, 'pluck', 0, 0.045),
      partMel('4 . 4 5 7 . 4 . 8 . 7 . 6 . 4 . 5 . 5 6 7 . 5 . 3 . . . 2 . . . 4 . 4 5 7 . 9 . 8 . 7 . 6 . 8 . 10 . 9 . 8 . 5 . 4 . . . - . . .', 'flute', 12, 0.07),
      partDrums({ k: 'x.......x.......', s: '....x.......x...', sh: '..x...x...x...x.' }, 0.6)] },
  backstreet: { bpm: 96, root: 57, scale: MINOR, chords: [[0, 'm'], [5, 'm'], [10, 'M'], [3, 'M'], [8, 'M'], [2, 'd'], [7, 'M'], [0, 'm']],   // 后街：慵懒的小酒馆爵士
    parts: [partBass('x...3...5...o...', 'bass', -24, 0.13), partArp([0, 2, 1, 2], 4, 'piano', -12, 0.045),
      partMel('4 . 2 . 0 . - 2 3 . 5 . 7 . 5 . 6 . 4 . 1 . - 4 2 . . . - . . . 5 . 4 . 2 . 0 . 1 . 3 . 5 . 3 . 6# . 8 . 10 . 8 . 7 . . . - . . .', 'piano', 12, 0.075),
      partDrums({ k: 'x.......x.......', s: '....g.......g...', h: 'x..xx..xx..xx..x' }, 0.55)] },
  westcoast: { bpm: 116, root: 62, scale: MAJOR, chords: [[0, 'M'], [5, 'M'], [0, 'M'], [7, 'M'], [0, 'M'], [5, 'M'], [7, 'M'], [0, 'M']],   // 西海岸：港口水手小调
    parts: [partBass('x...5...x...5...', 'bass', -24, 0.13), partArp([0, 1, 2, 1, 0, 1, 2, 1], 2, 'pluck', -12, 0.07),
      partMel('0 . 2 4 4 . 4 . 5 . 3 . 5 . 7 . 4 . 2 . 0 . 2 . 1 . . . -1 . . . 0 . 2 4 4 . 4 . 5 . 3 . 5 . 7 . 8 . 6 . 4 . 1 . 0 . . . - . . .', 'lead', 0, 0.045),
      partDrums({ k: 'x.......x.......', sh: 'x.x.x.x.x.x.x.x.', s: '....g.......g...' }, 0.6)] },
  guild: { bpm: 80, root: 57, scale: MINOR, wet: 1.4, chords: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [0, 'm'], [5, 'm'], [7, 'M'], [0, 'm']],   // 魔法师公会：神秘的竖琴与钟声
    parts: [partArp([0, 1, 2, 3, 4, 3, 2, 1], 1, 'pluck', 0, 0.03), partPad('pad', -12, 0.013), partBells(0.035),
      partMel('4 . 7 6 5 . . 4 2 . 4 5 6 . . . 7 . 9 8 7 . 5 3 4 . 6# . 7 . . -', 'flute', 12, 0.07, 4)] },
});
