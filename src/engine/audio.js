/* =====================================================================
   07. 音效（WebAudio 实时合成）。原则：只有短促的瞬态音，不放任何持续的噪声底
   ===================================================================== */
const sfx = {
  ctx: null, muted: PARAMS.has('mute'), vol: { sfx: 0.9, music: 0.6 },
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running' && !document.hidden) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC({ latencyHint: 'interactive' });
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15; comp.connect(c.destination);
    this.master = this.g(this.muted ? 0 : 0.85, comp);
    this.bus = this.g(this.vol.sfx, this.master); this.mus = this.g(this.vol.music, this.master);
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024; comp.connect(this.analyser);
    this.lastHit = 0; this.voices = 0;
    music.start(); applyVolumes();
  },
  get ok() { return this.ctx && this.ctx.state === 'running'; },
  g(v, to) { const n = this.ctx.createGain(); n.gain.value = v; if (to) n.connect(to); return n; },
  f(type, freq, q) { const n = this.ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; if (q) n.Q.value = q; return n; },
  env(p, t, a, peak, d) { p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(0.0001, t + a + d); },
  done(src, nodes) { this.voices++; src.onended = () => { this.voices--; for (const x of nodes) x.disconnect(); }; },
  tone(type, f0, f1, dur, vol, { delay = 0, dest, attack = 0.004 } = {}) {
    if (!this.ok || this.voices > 90) return; const t = this.ctx.currentTime + 0.003 + delay;
    const g = this.g(0, dest || this.bus), o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
    o.connect(g); this.env(g.gain, t, attack, vol, dur); o.start(t); o.stop(t + attack + dur + 0.05); this.done(o, [g]);
  },
  // 混响总线（懒建）：接到这里的声音带约 2.4 秒的空间尾音，史诗掉落等“大场面”音效用
  rev() {
    if (this.revIn) return this.revIn;
    const c = this.ctx, n = Math.floor(c.sampleRate * 2.4), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    const cv = c.createConvolver(); cv.buffer = b; cv.connect(this.g(0.55, this.bus));
    this.revIn = this.g(1, this.bus); this.revIn.connect(cv);
    return this.revIn;
  },
  noise(type, f0, f1, dur, vol, q = 1, delay = 0, dest) {
    if (!this.ok || this.voices > 90) return; const t = this.ctx.currentTime + 0.003 + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; const fl = this.f(type, f0, q), g = this.g(0, dest || this.bus);
    fl.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(fl); fl.connect(g); this.env(g.gain, t, 0.003, vol, dur); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.06); this.done(s, [fl, g]);
  },
  // ---- 战斗 ----
  swing(heavy) {
    if (heavy) { this.noise('bandpass', 420, 1900, 0.2, 0.34, 1.4); this.tone('triangle', 380, 900, 0.16, 0.05); }
    else { this.noise('bandpass', 900, 3200, 0.11, 0.26, 1.6); this.tone('triangle', 700, 1500, 0.08, 0.035); }
  },
  hit(kind = 'slash', crit = false) {
    const now = this.ctx ? this.ctx.currentTime : 0; if (now - this.lastHit < 0.025) return; this.lastHit = now;   // 同一瞬间多目标命中只响一次
    if (kind === 'blunt') { this.tone('sine', 150, 55, 0.12, 0.55); this.noise('lowpass', 1400, 300, 0.07, 0.35, 0.8); }
    else if (kind === 'stab') { this.tone('sine', 220, 90, 0.06, 0.35); this.noise('highpass', 2600, 2600, 0.035, 0.22, 0.7); }
    else if (kind === 'fire') { this.noise('lowpass', 2400, 400, 0.18, 0.3, 0.7); this.tone('sine', 160, 60, 0.12, 0.4); }
    else { this.tone('sine', 190, 60, 0.09, 0.5); this.noise('highpass', 1800, 1800, 0.028, 0.28, 0.7); this.noise('bandpass', 3400, 2200, 0.06, 0.16, 2); }
    if (crit) { this.tone('sine', 2200, 2150, 0.28, 0.09); this.tone('sine', 3120, 3050, 0.22, 0.06); this.tone('sine', 120, 45, 0.16, 0.35); }
  },
  thud(v = 1) { this.tone('sine', 110, 45, 0.16, 0.4 * v); this.noise('lowpass', 500, 180, 0.12, 0.22 * v, 0.7); },
  jump() { this.noise('bandpass', 380, 900, 0.1, 0.1, 1.2); },
  step() { this.tone('sine', 140, 90, 0.04, 0.06); },
  boom(v = 1) { this.tone('sine', 95, 32, 0.55, 0.6 * v); this.noise('lowpass', 900, 120, 0.45, 0.35 * v, 0.7); },
  charge() { this.tone('sawtooth', 160, 700, 0.38, 0.05, { attack: 0.05 }); this.tone('sine', 320, 1400, 0.38, 0.06, { attack: 0.05 }); },
  iai() { this.tone('sine', 3200, 2400, 0.4, 0.12); this.tone('sine', 4700, 3900, 0.3, 0.06); this.noise('bandpass', 2500, 900, 0.28, 0.3, 1.2); this.tone('sine', 150, 50, 0.3, 0.5); },
  buff() { [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', 523 * Math.pow(2, s / 12), 0, 0.25, 0.1, { delay: i * 0.07 })); },
  awaken() { this.tone('sine', 80, 40, 1.2, 0.5); [0, 7, 12, 16, 19].forEach((s, i) => this.tone('sawtooth', 110 * Math.pow(2, s / 12), 0, 1.0, 0.035, { delay: 0.05 * i, attack: 0.2 })); this.noise('bandpass', 1200, 5000, 0.9, 0.08, 0.8); },
  // ---- 系统 ----
  coin() { this.tone('sine', 1900, 0, 0.06, 0.1); this.tone('sine', 2850, 0, 0.12, 0.08, { delay: 0.05 }); },
  pickup() { this.tone('triangle', 880, 1320, 0.08, 0.12); },
  drop(rar = 0) { const f = [700, 800, 900, 1000, 1100, 1200][rar] || 700; this.tone('triangle', f, f * 1.5, 0.12, 0.08); if (rar >= 5) this.epic(); },
  epic() { [0, 4, 7, 11, 14, 19].forEach((s, i) => { this.tone('sine', 784 * Math.pow(2, s / 12), 0, 0.5, 0.09, { delay: i * 0.09 }); this.tone('triangle', 392 * Math.pow(2, s / 12), 0, 0.4, 0.04, { delay: i * 0.09 }); }); },
  levelUp() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone('triangle', 523 * Math.pow(2, s / 12), 0, 0.22, 0.12, { delay: i * 0.06 })); },
  click() { this.tone('sine', 1500, 0, 0.03, 0.06); },
  open() { this.tone('triangle', 660, 990, 0.07, 0.06); },
  error() { this.tone('square', 220, 180, 0.12, 0.05); },
  door() { this.tone('sine', 300, 600, 0.3, 0.12); this.noise('bandpass', 500, 1500, 0.3, 0.08, 1); },
  clear() { [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone('triangle', 440 * Math.pow(2, s / 12), 0, 0.3, 0.1, { delay: i * 0.08 })); },
  enhanceOk() { [0, 7, 12, 19, 24].forEach((s, i) => this.tone('sine', 660 * Math.pow(2, s / 12), 0, 0.3, 0.1, { delay: i * 0.07 })); },
  enhanceFail() { this.tone('sawtooth', 300, 90, 0.5, 0.08); this.noise('lowpass', 800, 200, 0.4, 0.12, 0.7); },
  card() { this.tone('triangle', 1100, 1650, 0.1, 0.1); },
  gameOver() { [0, -3, -7, -12].forEach((s, i) => this.tone('triangle', 330 * Math.pow(2, s / 12), 0, 0.4, 0.1, { delay: i * 0.2 })); },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05); },
};
// 手机上（尤其 iOS）只有 touchend / click 这类手势才能解锁音频，全部挂上
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, () => sfx.init(), { passive: true });
// 切到后台时暂停声音，回来再继续
document.addEventListener('visibilitychange', () => { if (!sfx.ctx) return; if (document.hidden) sfx.ctx.suspend(); else sfx.ctx.resume(); });
