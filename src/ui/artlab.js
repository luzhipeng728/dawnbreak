/* =====================================================================
   90. 美术实验室（?art）：把模型按姿势排一排画出来，调造型用
   ===================================================================== */
function artLab() {
  const models = {}; for (const k in CLASSES) models[k] = CLASSES[k].model ? CLASSES[k].model() : buildSwordsman();
  for (const k in SPR_DATA) if (!models[k]) models[k] = new SpriteModel(k, SPR_FALLBACK, SPR_ANIMS.monster);
  const list = (PARAMS.get('poses') || 'idle,idle2').split(',');
  const which = PARAMS.get('m') || 'sword';
  let t = 0;
  function frame() {
    t += 1 / 60;
    const c = wctx;
    c.setTransform(RS, 0, 0, RS, 0, 0);
    c.fillStyle = '#3a4a5a'; c.fillRect(0, 0, WW, WH);
    c.fillStyle = '#2a3440'; c.fillRect(0, 380, WW, 160);
    c.strokeStyle = '#8fa'; c.beginPath(); c.moveTo(0, 380.5); c.lineTo(WW, 380.5); c.stroke();
    if (PARAMS.has('anim')) {   // 动画连拍：一个片段按时间等分画 N 格
      const name = PARAMS.get('anim'), m = models[which], clip = (m.clipSet || CLIPS[which] || CLIPS.sword)[name] || BEAST_CLIPS[name], n = +(PARAMS.get('n') || 8);
      for (let i = 0; i < n; i++) { const tt = clip.dur * i / n, pose = samplePose(clip, tt, {}), x = 70 + i * (WW - 110) / Math.max(1, n - 1); c.save(); c.translate(x, 300); m.draw(c, pose, 0, {}); c.restore(); c.fillStyle = '#fff'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText(`${name} ${tt.toFixed(2)}s`, x, 318); }
      window.__ART_READY = true; requestAnimationFrame(frame); return;
    }
    if (PARAMS.has('lineup')) {   // 全员列队：每个手绘角色摆一个姿势
      const names = Object.keys(SPR_DATA), per = Math.ceil(names.length / 2), pose = POSE[PARAMS.get('lineup')] || POSE.idle;
      names.forEach((n, i) => { const x = 70 + (i % per) * (WW - 120) / Math.max(1, per - 1), y = i < per ? 240 : 500; c.save(); c.translate(x, y); models[n].draw(c, pose, t, {}); c.restore(); c.fillStyle = '#fff'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText(n, x, y + 14); });
      window.__ART_READY = true; requestAnimationFrame(frame); return;
    }
    list.forEach((name, i) => {
      const x = 80 + i * (WW - 120) / Math.max(1, list.length - 1 || 1);
      c.save(); c.translate(Math.round(x), 380);
      const clip = CLIPS[which] && CLIPS[which][name];
      const pose = clip ? samplePose(clip, t, {}) : POSE[name];
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 0, 22, 5, 0, 0, TAU); c.fill();
      if (PARAMS.has('flip') && i % 2) c.scale(-1, 1);
      models[which].draw(c, pose, t, { glow: 0.6 });
      c.restore();
      c.fillStyle = '#fff'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText(name, x, 400);
    });
    // 放大镜：把第一个角色放大 3 倍画在右上角，方便看细节
    if (PARAMS.has('zoom')) { c.imageSmoothingEnabled = false; c.drawImage(wcan, 20, 240, 140, 150, WW - 300, 10, 280, 300); }
    window.__ART_READY = true;
    requestAnimationFrame(frame);
  }
  frame();
}
