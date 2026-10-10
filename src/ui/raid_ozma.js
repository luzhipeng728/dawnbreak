/* =====================================================================
   奥兹玛理智值 / 混沌等级 HUD（docs/RAID_OZMA.md §7）：
   - 屏幕边缘暗角（理智越低越黑越紫）+ 低于 50 后世界画布的扭曲滤镜（SVG feTurbulence + feDisplacementMap），理智条、混沌等级徽记；
   - 理智第一次归零（bus raidSanity { mini: true }，规则核心已经把理智恢复到 50）→ 弹「稳住心神」小游戏，按顺序点亮 5 个符文才能继续；第二次归零（dead）倒下；
   - 只在奥兹玛团本的副本里显示（raidNet.S.raid === 'ozma' 且 game.scene === 'dungeon'）；状态放在 OZMA_HUD 里供测试读取。
   依赖：net/raid.js（bus raidSanity / raidChaos、raidNet.S）。
   ===================================================================== */
const OZMA_HUD = { san: 100, max: 100, lv: 0, on: false, mini: null, minis: 0, dead: 0, root: null };
(() => {
  if (typeof document === 'undefined' || typeof bus === 'undefined') return;
  const ce = (tag, css, txt) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; };
  const live = () => typeof raidNet !== 'undefined' && raidNet.S && raidNet.S.raid === 'ozma' && typeof game !== 'undefined' && game.scene === 'dungeon';
  function ensure() {
    if (OZMA_HUD.root) return OZMA_HUD.root;
    const stage = document.getElementById('stage') || document.body;
    const root = ce('div', 'position:absolute;inset:0;pointer-events:none;z-index:6;display:none'); root.id = 'ozHud';
    const vig = ce('div', 'position:absolute;inset:0;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at center,rgba(20,0,40,0) 38%,rgba(40,0,70,.55) 70%,rgba(8,0,18,.96) 100%)'); vig.id = 'ozVig';
    const bar = ce('div', 'position:absolute;left:50%;top:6px;transform:translateX(-50%);width:200px;height:14px;border:1px solid #6a4a9a;background:rgba(10,0,24,.7);border-radius:7px;overflow:hidden;font:11px/14px sans-serif;color:#e8d8ff;text-align:center'); bar.id = 'ozSan';
    const fill = ce('div', 'position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(90deg,#7a3aff,#d070ff);transition:width .3s'); const lab = ce('div', 'position:relative;text-shadow:0 0 3px #000'); bar.append(fill, lab);
    const chip = ce('div', 'position:absolute;left:50%;top:24px;transform:translateX(-50%);padding:1px 10px;border-radius:9px;background:rgba(60,0,40,.75);border:1px solid #ff6ab0;color:#ffc0e0;font:12px/18px sans-serif'); chip.id = 'ozChaos';
    root.append(vig, bar, chip); stage.appendChild(root);
    // 扭曲滤镜：理智 < 50 时挂到世界画布上
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    svg.innerHTML = '<filter id="ozSanFx" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence id="ozTurb" type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="1" result="n"/><feDisplacementMap id="ozDisp" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.appendChild(svg);
    Object.assign(OZMA_HUD, { root, vig, fill, lab, chip, turb: svg.querySelector('#ozTurb'), disp: svg.querySelector('#ozDisp'), world: document.getElementById('world') });
    return root;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function apply() {
    const on = live(); OZMA_HUD.on = on;
    const root = ensure(); root.style.display = on ? 'block' : 'none';
    const W = OZMA_HUD.world;
    if (!on) { if (W) W.style.filter = ''; return; }
    const me = raidNet.mine && raidNet.mine(), S = raidNet.S;
    if (me && me.san != null) OZMA_HUD.san = me.san;
    const g = (S.gbuffs || []).reduce((a, b) => a + ((b.p && b.p.sanMax) || 0), 0); OZMA_HUD.max = 100 + g;
    OZMA_HUD.lv = (S.chaos && S.chaos.lv) || 0;
    const k = clamp(1 - OZMA_HUD.san / 100, 0, 1);
    OZMA_HUD.vig.style.opacity = String(clamp(0.1 + k * 1.1, 0, 1));
    OZMA_HUD.fill.style.width = clamp(OZMA_HUD.san / OZMA_HUD.max * 100, 0, 100) + '%';
    OZMA_HUD.lab.textContent = `理智 ${Math.round(OZMA_HUD.san)}`;
    OZMA_HUD.chip.textContent = `混沌等级 ${OZMA_HUD.lv}`; OZMA_HUD.chip.style.display = OZMA_HUD.lv ? 'block' : 'none';
    const dist = OZMA_HUD.san < 50 ? (50 - OZMA_HUD.san) / 50 * 16 : 0;
    OZMA_HUD.disp.setAttribute('scale', String(dist)); OZMA_HUD.dist = dist;
    if (W) W.style.filter = dist > 0 ? 'url(#ozSanFx)' : '';
  }
  // 小游戏：5 个符文随机散布，按 1→5 的顺序点；点错重来；做完恢复游戏
  function mini() {
    if (OZMA_HUD.mini) return; OZMA_HUD.minis++;
    const stage = document.getElementById('stage') || document.body, was = typeof game !== 'undefined' ? game.paused : false;
    if (typeof game !== 'undefined') game.paused = true;
    const box = ce('div', 'position:absolute;inset:0;z-index:30;background:rgba(10,0,24,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto'); box.id = 'ozMini';
    const title = ce('div', 'color:#e8d8ff;font:bold 20px sans-serif;margin-bottom:8px', '稳住心神'), sub = ce('div', 'color:#b8a0e0;font:13px sans-serif;margin-bottom:14px', '按 1 → 5 的顺序点亮混沌符文（理智会恢复到 50）');
    const field = ce('div', 'position:relative;width:420px;height:220px;border:1px solid #5a3a8a;border-radius:10px;background:radial-gradient(circle,#2a1050,#0a0018)');
    box.append(title, sub, field); stage.appendChild(box);
    const st = { next: 1, box, was, done: false, btns: [] }; OZMA_HUD.mini = st;
    const spots = [[40, 40], [320, 30], [180, 100], [60, 160], [330, 150]].sort(() => Math.random() - 0.5);
    for (let i = 1; i <= 5; i++) {
      const b = ce('button', `position:absolute;left:${spots[i - 1][0]}px;top:${spots[i - 1][1]}px;width:46px;height:46px;border-radius:50%;border:2px solid #c070ff;background:#3a1470;color:#fff;font:bold 18px sans-serif;cursor:pointer`, String(i)); b.dataset.n = i;
      b.onclick = () => {
        if (st.done) return;
        if (i === st.next) { b.style.background = '#7aff9a'; b.style.color = '#012'; b.disabled = true; st.next++; if (st.next > 5) finish(); }
        else { st.next = 1; sub.textContent = '符文顺序错了，重来！'; st.btns.forEach(x => { x.disabled = false; x.style.background = '#3a1470'; x.style.color = '#fff'; }); }
      };
      field.appendChild(b); st.btns.push(b);
    }
    function finish() { st.done = true; setTimeout(() => { box.remove(); OZMA_HUD.mini = null; if (typeof game !== 'undefined') game.paused = st.was; if (typeof toastMsg === 'function') toastMsg('心神稳住了：理智恢复到 50', '#c8a0ff'); }, 250); }
    st.solve = () => { st.btns.forEach(b => { if (!b.disabled) b.click(); }); };
  }
  OZMA_HUD.autoSolve = () => { const m = OZMA_HUD.mini; if (m) { for (let i = 1; i <= 5; i++) m.btns[i - 1] && m.btns.find(b => +b.dataset.n === i).click(); } };
  bus.on('raidSanity', p => {
    if (!live()) return;
    OZMA_HUD.san = p.v; apply();
    if (p.mini) mini();
    if (p.dead) { OZMA_HUD.dead++; if (typeof toastMsg === 'function') toastMsg('理智彻底归零：你倒下了', '#ff6a8a'); if (typeof game !== 'undefined' && game.player && typeof killEnt === 'function' && !game.player.dead) { game.player.hp = 0; try { killEnt(game.player, null, {}); } catch (e) { /* 已经倒下 */ } } }
  });
  bus.on('raidChaos', p => { OZMA_HUD.lv = p.lv; apply(); });
  setInterval(() => { apply(); if (OZMA_HUD.turb && OZMA_HUD.dist > 0) OZMA_HUD.turb.setAttribute('seed', String((Date.now() / 120 | 0) % 50)); }, 200);
})();
