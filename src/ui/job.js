/* =====================================================================
   转职（窗口 job）：在职业导师处转职（鬼剑士 → G.S.D，神枪手 → 凯丽，魔法师 → 莎兰）
   - 条件：Lv.15 + 完成该职业的转职试炼任务链（q_job_<职业>_final）+ 还没有转职
   - 数据：CLASSES[cls].jobs = { jobId: { name, desc, skills, awaken, awakenName, awaken2?, awakenName2?, awaken3?, awakenName3?, role?, art?,
             quests?（专属转职任务线，content/quests/job.js 登记）, trial?（最后一步任务 id：没完成不能转成这个方向）} }
   - 4 个以上方向（神枪手 5 个）：上面一排小卡片，下面是选中方向的详情
   - 执行：game.job = id → bus.emit('jobChange', { job }) → onJobChange(p, job)（若定义）→ save.write()，然后播放转职演出
   ===================================================================== */
const JOB_LVL = 15;
const JOB_MENTOR = { sword: 'gsd', gun: 'kiri', mage: 'sharan' };
const jobsOf = cls => (CLASSES[cls] && CLASSES[cls].jobs) || null;
const jobTrialDone = cls => !QUESTS['q_job_' + cls + '_final'] || questDone('q_job_' + cls + '_final');
// 这个方向的专属转职任务（J.trial）做完没有（任务没定义 = 没有这道门槛）
const jobTrialOk = J => !J || ((J.direct || jobTrialDone(qPlayerCls())) && (!J.trial || !QUESTS[J.trial] || questDone(J.trial)));
// 接某个方向的转职任务线：换方向时放弃旧任务线里进行中的那一步（已完成的步骤保留）；能接的第一步直接接上
function jobPickSet(cls, id) {
  const jobs = jobsOf(cls), old = jobPickOf(), J = jobs && jobs[id]; if (!J || !save.data) return;
  if (old && old !== id && jobs[old] && jobs[old].quests) for (const [qid] of jobs[old].quests) if (questRec(qid)) questAbandon(qid);
  save.data.jobPick = id;
  const first = (J.quests || []).map(x => x[0]).find(q => questState(q) === 'avail');
  if (first) questAccept(first); else toastMsg(`已选择「${J.name}」的转职任务`, '#ffd23a');
  save.write();
}
// 转职任务提示：接了 / 没接 / 只有试炼
function jobTrialText(cls, id) {
  const J = jobsOf(cls)[id], T = QUESTS[J.trial], F = QUESTS['q_job_' + cls + '_final'];
  if (!J.direct && !jobTrialDone(cls)) return `需要先完成转职试炼${F ? `「${F.name}」` : ''}`;
  if (!T) return '';
  if (J.quests) {
    if (jobPickOf() !== id) return `需要先完成「${J.name}」的转职任务（${J.quests.length} 步）`;
    const cur = J.quests.map(x => QUESTS[x[0]]).find(q => q && !questDone(q.id));
    return cur ? `转职任务进行中：「${cur.name}」（${qNpcWhere(cur.npc)}）` : '';
  }
  return `专属试炼：「${T.name}」（找 ${qNpcName(T.npc)} 接取）`;
}
// 觉醒之路：一觉 / 二觉 / 三觉名称和等级（等级按觉醒任务数据）
function jobAwakenText(cls, J) {
  const lv = n => { const q = QUESTS[n === 1 ? `q_awaken_${cls}_1` : `q_awaken${n}_${cls}_1`]; return q ? `（Lv.${q.lvl}）` : ''; };
  const L = [[1, J.awakenName], [2, J.awakenName2 || J.awaken2Name], [3, J.awakenName3 || J.awaken3Name]].filter(x => x[1]).map(([n, nm]) => nm + lv(n));
  return L.length ? `觉醒：${L.join(' → ')}` : '';
}
// 导师 NPC 是否显示「转职」按钮
function jobAvailable(N) {
  const cls = qPlayerCls();
  if (!N || N.jobFor !== cls || game.job || !jobsOf(cls)) return false;
  return game.lvl >= JOB_LVL && (jobTrialDone(cls) || Object.values(jobsOf(cls)).some(J => J.direct));   // J.direct：官方没有转职任务的方向（协战师），不用先做职业的转职试炼
}
// 转职立绘：jobs[id].art → job/<jobId>（本组生成的立绘）→ 职业插图 cutin/<职业> → 职业立绘
const jobArtKey = (cls, id) => { const J = jobsOf(cls) && jobsOf(cls)[id]; return [J && J.art, 'job/' + id].find(k => k && IMG[k]) || null; };
const jobArt = (cls, id) => IMG[jobArtKey(cls, id)] || IMG['cutin/' + cls] || IMG['class/' + cls] || null;
// 立绘单独分包（build.mjs 里 job/ → 'job'）：打开导师对话 / 转职窗口时再加载；分包不存在时这些图已在 core 里
function jobArtPreload(then) { if (typeof loadBundles !== 'function') return; const p = loadBundles(['job']); if (then) p.then(then); }
bus.on('npcTalk', e => { const N = NPCS[e.id]; if (N && N.jobFor) jobArtPreload(); });
function jobName(cls = qPlayerCls(), job = game.job) { const J = job && jobsOf(cls) && jobsOf(cls)[job]; return J ? J.name : null; }
function doJobChange(jobId) {
  const cls = qPlayerCls(), J = jobsOf(cls) && jobsOf(cls)[jobId];
  if (!J || game.job || !jobTrialOk(J)) return false;
  game.job = jobId; if (save.data) { save.data.job = jobId; delete save.data.jobPick; }
  bus.emit('jobChange', { job: jobId });
  if (typeof onJobChange === 'function') onJobChange(game.player, jobId);
  else if (game.player) recalcStats(game.player);
  save.write();
  return true;
}
addStyle(`
.jobwin{display:flex;flex-direction:column;gap:.8em;width:54em;position:relative}
.jobwin .intro{display:flex;gap:1em;align-items:center;background:rgba(0,0,0,.25);border-radius:.3em;padding:.5em .8em;line-height:1.6}
.jobwin .intro img{width:4.2em;height:4.2em;object-fit:cover;object-position:top;border-radius:50%;border:.1em solid #a88040;flex:none}
.jobcards{display:flex;gap:1em;justify-content:center}
.jobcard{flex:1;max-width:25em;display:flex;flex-direction:column;gap:.5em;padding:.8em;border-radius:.4em;cursor:pointer;background:linear-gradient(180deg,rgba(40,30,44,.9),rgba(16,12,20,.95));border:.12em solid #4a3a2a;transition:transform .15s,border-color .15s,box-shadow .15s}
.jobcard:hover{transform:translateY(-.2em);border-color:#a88040}
.jobcard.sel{border-color:#ffd23a;box-shadow:0 0 1.2em rgba(255,210,60,.35),inset 0 0 1.5em rgba(255,210,60,.08)}
.jobcard .art{height:15em;border-radius:.3em;overflow:hidden;background:radial-gradient(ellipse at 50% 80%,rgba(255,200,90,.25),rgba(0,0,0,0) 70%),#120e16;display:flex;align-items:flex-end;justify-content:center}
.jobcard .art img{max-height:100%;max-width:100%;object-fit:contain}
.jobcard .nm{font-size:1.5em;font-weight:900;color:#ffe8a8;letter-spacing:.1em}
.jobcard .role{font-size:.8em;color:#8fd8ff;font-weight:800}
.jobcard .desc{font-size:.88em;line-height:1.6;color:#d8ccb8;min-height:4.8em}
.jobcard .sks{display:flex;gap:.4em;flex-wrap:wrap}
.jobcard .sk{display:flex;flex-direction:column;align-items:center;gap:.15em;width:4.2em;font-size:.68em;color:#c8bca8;text-align:center}
.jobcard .sk img{width:3.2em;height:3.2em;border-radius:.25em;border:.08em solid #6a5436}
.jobcard .aw{font-size:.82em;color:#ff9a5a;font-weight:800}
.jobcard.lock{opacity:.55}
.jobcard.lock.sel{opacity:.85}
.jobcard .trial,.jobdet .trial{font-size:.78em;color:#ffb07a;font-weight:700;line-height:1.45}
.jobwin.many{width:66em}
.jobcards.many{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5em,1fr));gap:.6em}
.jobcards.many .jobcard{max-width:none;padding:.5em;gap:.3em}
.jobcards.many .jobcard .art{height:9.5em}
.jobcards.many .jobcard .nm{font-size:1.15em;letter-spacing:.04em}
.jobcards.many .jobcard .role{font-size:.72em}
.jobdet{display:flex;flex-direction:column;gap:.45em;padding:.7em .9em;border-radius:.4em;background:rgba(0,0,0,.28);border:.1em solid #4a3a2a;min-height:9em}
.jobdet .hd{display:flex;gap:.8em;align-items:baseline}
.jobdet .nm{font-size:1.4em;font-weight:900;color:#ffe8a8;letter-spacing:.08em}
.jobdet .role{font-size:.8em;color:#8fd8ff;font-weight:800}
.jobdet .desc{font-size:.88em;line-height:1.6;color:#d8ccb8}
.jobdet .sks{display:flex;gap:.4em;flex-wrap:wrap}
.jobdet .sk{display:flex;flex-direction:column;align-items:center;gap:.15em;width:4.2em;font-size:.68em;color:#c8bca8;text-align:center}
.jobdet .sk img{width:3.2em;height:3.2em;border-radius:.25em;border:.08em solid #6a5436}
.jobdet .aw{font-size:.82em;color:#ff9a5a;font-weight:800}
.jobask{position:absolute;inset:-.4em;background:rgba(6,4,8,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1em;border-radius:.3em;z-index:2}
.jobask .big{font-size:1.4em;font-weight:900;color:#ffe8a8}
.jobask .warn{color:#ff9a8a;font-weight:700}
/* ---- 转职演出 ---- */
.jobfx{position:absolute;inset:0;overflow:hidden;z-index:40;cursor:pointer;animation:jfIn .5s both}
@keyframes jfIn{from{opacity:0}to{opacity:1}}
.jobfx .bg{position:absolute;inset:0;background:radial-gradient(ellipse at 40% 55%,rgba(60,40,10,.86),rgba(0,0,0,.97) 70%)}
.jobfx canvas{position:absolute;inset:0;width:100%;height:100%}
.jobfx .rays{position:absolute;left:50%;top:50%;width:140vmax;height:140vmax;margin:-70vmax 0 0 -70vmax;background:repeating-conic-gradient(rgba(255,210,100,.16) 0 5deg,rgba(0,0,0,0) 5deg 15deg);-webkit-mask:radial-gradient(circle,#000 5%,transparent 45%);mask:radial-gradient(circle,#000 5%,transparent 45%);animation:jfSpin 16s linear infinite,jfRays 1.2s .5s both}
@keyframes jfSpin{to{transform:rotate(360deg)}}
@keyframes jfRays{from{opacity:0;transform:scale(.3)}to{opacity:1}}
.jobfx .ring{position:absolute;left:50%;top:52%;width:34em;height:34em;margin:-17em 0 0 -17em;opacity:0;filter:drop-shadow(0 0 1em #ffb030) sepia(1) saturate(4) hue-rotate(-10deg) brightness(1.3);animation:jfRing 1.4s .15s cubic-bezier(.2,1.4,.4,1) forwards}
.jobfx .ring img{width:100%;height:100%;animation:jfSpin 8s linear infinite}
@keyframes jfRing{from{opacity:0;transform:scale(2.4) rotate(-90deg)}to{opacity:.85;transform:scale(1) rotate(0)}}
.jobfx .flash{position:absolute;inset:0;background:#fff;opacity:0;animation:jfFlash .7s .85s both}
@keyframes jfFlash{0%{opacity:0}15%{opacity:.95}100%{opacity:0}}
.jobfx .art{position:absolute;left:1%;top:50%;width:60%;max-height:84%;object-fit:contain;opacity:0;margin-top:-20%;-webkit-mask:radial-gradient(ellipse 50% 50% at 50% 50%,#000 62%,transparent 100%);mask:radial-gradient(ellipse 50% 50% at 50% 50%,#000 62%,transparent 100%);animation:jfArt 1s 1s cubic-bezier(.2,1,.3,1) forwards}
.jobfx .art.full{-webkit-mask:none;mask:none;top:auto;bottom:0;margin:0;height:90%;width:auto;max-width:60%;filter:drop-shadow(0 0 1.5em rgba(255,200,80,.6))}
@keyframes jfArt{from{opacity:0;transform:translateX(-30%) scale(1.1)}to{opacity:1;transform:none}}
.jobfx .txt{position:absolute;right:7%;top:28%;text-align:right;display:flex;flex-direction:column;gap:.3em;align-items:flex-end}
.jobfx .t1{font:900 1.6em "PingFang SC",sans-serif;letter-spacing:.8em;color:#e8c26a;opacity:0;animation:jfUp .6s 1.3s both}
.jobfx .t2{font:900 6em "PingFang SC","Microsoft YaHei",serif;letter-spacing:.12em;background:linear-gradient(180deg,#fffbe0,#ffd23a 45%,#d07a10 80%,#8a4a08);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 .1em 0 #2a1400) drop-shadow(0 0 .4em rgba(255,190,60,.7));opacity:0;animation:jfStamp .55s 1.6s cubic-bezier(.2,1.6,.4,1) both}
@keyframes jfStamp{from{opacity:0;transform:scale(2.6)}to{opacity:1;transform:none}}
@keyframes jfUp{from{opacity:0;transform:translateY(1em)}to{opacity:1;transform:none}}
.jobfx .t3{max-width:26em;font-size:1.05em;line-height:1.7;color:#f0e2c0;opacity:0;animation:jfUp .6s 2.1s both}
.jobfx .t4{margin-top:.6em;font-size:.95em;color:#ff9a5a;font-weight:800;opacity:0;animation:jfUp .6s 2.4s both}
.jobfx .cont{position:absolute;left:50%;bottom:5%;transform:translateX(-50%);color:#c8bca8;font-size:1em;opacity:0;animation:jfUp .6s 3s both,npcmore .9s 3.6s ease-in-out infinite alternate}
`);
Object.assign(menus, {
  w_job(arg) {
    if (arg && arg.fx) return jobCeremony(arg.fx);
    const N = arg, cls = qPlayerCls(), jobs = jobsOf(cls), C = CLASSES[cls];
    const ui = this.jobUI || (this.jobUI = { sel: null, ask: false });
    const body = h('div', { class: 'jobwin' });
    body.append(h('div', { class: 'intro' }, N && IMG[N.art] ? h('img', { src: IMG[N.art].src }) : null,
      h('div', {}, h('b', { class: 'gold' }, N ? N.name : '导师'), '：', game.job ? `你已经是一名${jobName()}了。` : !jobs ? '转职的道路……还没有完全准备好，过些日子再来吧。（转职数据尚未就绪）' : `${save.data.name || '勇士'}，你已经证明了自己的实力。${C.name}的道路在这里分成了 ${Object.keys(jobs).length} 条——选择吧。一旦踏上，就再也不能回头。`)));
    if (!jobs || game.job) { const el = this.win('转职', body, { w: 56, block: true }); el._arg = N; return el; }
    const ids = Object.keys(jobs), many = ids.length > 3; if (!ids.includes(ui.sel)) ui.sel = null;
    if (many) body.classList.add('many');
    if (ids.some(id => !jobArtKey(cls, id))) jobArtPreload(() => { if (this.isOpen('job') && !ids.some(id => !jobArtKey(cls, id))) this.refresh('job', N); });
    const skIcons = (J, n) => (J.skills || []).filter(s => SKILLS[s] && !SKILLS[s].awaken && !SKILLS[s].hidden).sort((a, b) => (SKILLS[a].passive ? 1 : 0) - (SKILLS[b].passive ? 1 : 0)).slice(0, n)   // 主动技能优先
      .map(s => h('div', { class: 'sk' }, h('img', { src: skillIcon(s).toDataURL() }), SKILLS[s].name));
    body.append(h('div', { class: 'jobcards' + (many ? ' many' : '') }, ids.map(id => {
      const J = jobs[id], own = jobArtKey(cls, id), art = jobArt(cls, id), lock = !jobTrialOk(J), aw = jobAwakenText(cls, J);
      return h('div', { class: 'jobcard' + (ui.sel === id ? ' sel' : '') + (lock ? ' lock' : ''), onclick: () => { ui.sel = id; sfx.click(); this.refresh('job', N); } },
        h('div', { class: 'art' }, art ? h('img', { src: art.src, style: own ? '' : `filter:hue-rotate(${ids.indexOf(id) * 140}deg) saturate(1.1)` }) : null),
        h('div', { class: 'nm' }, J.name), h('div', { class: 'role' }, J.role ? `定位：${J.role}` : `${C.name} · 转职`),
        many ? null : [h('div', { class: 'desc' }, J.desc || ''), h('div', { class: 'sks' }, skIcons(J, 3)), aw ? h('div', { class: 'aw' }, aw) : null],
        lock && !many ? h('div', { class: 'trial' }, jobTrialText(cls, id)) : null);
    })));
    const J = ui.sel && jobs[ui.sel], pick = jobPickOf(), ok = jobTrialOk(J);
    if (many) body.append(J ? h('div', { class: 'jobdet' },
      h('div', { class: 'hd' }, h('span', { class: 'nm' }, J.name), h('span', { class: 'role' }, J.role ? `定位：${J.role}` : `${C.name} · 转职`)),
      h('div', { class: 'desc' }, J.desc || ''), h('div', { class: 'sks' }, skIcons(J, 6)),
      jobAwakenText(cls, J) ? h('div', { class: 'aw' }, jobAwakenText(cls, J)) : null,
      ok ? null : h('div', { class: 'trial' }, jobTrialText(cls, ui.sel))) : h('div', { class: 'jobdet' }, h('div', { class: 'desc' }, '点上面的卡片查看每个方向的介绍。')));
    // 主按钮：转职 / 接转职任务 / 等任务完成
    let label = '请选择一个转职方向', go = null;
    if (J && ok) { label = `转职为「${J.name}」`; go = () => { ui.ask = true; }; }
    else if (J && !J.direct && !jobTrialDone(cls)) label = '需要先完成转职试炼';
    else if (J && J.quests && pick !== ui.sel) { label = `接受「${J.name}」的转职任务`; go = () => { if (pick && pick !== ui.sel && jobs[pick] && jobs[pick].quests && !jobTrialOk(jobs[pick])) ui.askPick = true; else jobPickSet(cls, ui.sel); }; }
    else if (J && QUESTS[J.trial]) label = `完成「${QUESTS[J.trial].name}」后才能转职`;
    body.append(h('div', { class: 'row', style: 'justify-content:center' },
      h('button', { class: 'btn big' + (go ? '' : ' off'), onclick: () => { if (!go) return; go(); sfx.click(); this.refresh('job', N); } }, label),
      h('button', { class: 'btn blue', onclick: () => { sfx.click(); this.close('job'); } }, '再想想')));
    if (ui.ask && J && ok) body.append(h('div', { class: 'jobask' },
      h('div', { class: 'big' }, `确定要转职为「${J.name}」吗？`),
      h('div', { class: 'warn' }, '转职不可逆，之后无法更改为其他方向。'),
      h('div', { class: 'row' },
        h('button', { class: 'btn big', onclick: () => { ui.ask = false; const id = ui.sel; ui.sel = null; this.close('job'); this.open('job', { fx: id }); } }, '确定转职'),
        h('button', { class: 'btn blue', onclick: () => { ui.ask = false; sfx.click(); this.refresh('job', N); } }, '取消'))));
    if (ui.askPick && J && pick && jobs[pick]) body.append(h('div', { class: 'jobask' },
      h('div', { class: 'big' }, `改接「${J.name}」的转职任务？`),
      h('div', { class: 'warn' }, `「${jobs[pick].name}」转职任务里进行中的那一步会被放弃（已经完成的步骤保留）。`),
      h('div', { class: 'row' },
        h('button', { class: 'btn big', onclick: () => { ui.askPick = false; jobPickSet(cls, ui.sel); sfx.click(); this.refresh('job', N); } }, '确定'),
        h('button', { class: 'btn blue', onclick: () => { ui.askPick = false; sfx.click(); this.refresh('job', N); } }, '取消'))));
    const el = this.win(`${N ? N.name + ' · ' : ''}转职`, body, { w: many ? 68 : 56, block: true }); el._arg = N; return el;
  },
});
// 转职演出：全屏特效 + 立绘 + 音效；演出 0.9 秒（白闪）时真正执行转职
function jobCeremony(jobId) {
  const cls = qPlayerCls(), J = jobsOf(cls) && jobsOf(cls)[jobId]; if (!J) return null;
  const own = jobArtKey(cls, jobId), art = jobArt(cls, jobId);
  const cv = h('canvas', { width: 960, height: 540 });
  const el = h('div', { class: 'jobfx', 'data-block': '1', 'data-hud': 'hide' },
    h('div', { class: 'bg' }), h('div', { class: 'rays' }), cv,
    IMG['fx/rune'] ? h('div', { class: 'ring' }, h('img', { src: IMG['fx/rune'].src })) : null,
    art ? h('img', { class: 'art' + (own ? ' full' : ''), src: art.src }) : null,
    h('div', { class: 'txt' }, h('div', { class: 't1' }, `${CLASSES[cls].name} · 转职`), h('div', { class: 't2' }, J.name), h('div', { class: 't3' }, J.desc || ''), J.awakenName ? h('div', { class: 't4' }, `觉醒之路：${J.awakenName}`) : null),
    h('div', { class: 'flash' }), h('div', { class: 'cont' }, '点击任意处继续'));
  const t0 = performance.now();
  let done = false;
  const close = () => { if (performance.now() - t0 < 2600) return; menus.close('job'); };
  el.addEventListener('click', close);
  el._key = e => { if (['KeyX', 'Space', 'Enter', 'Escape'].includes(e.code)) close(); };
  addEventListener('keydown', el._key);
  setTimeout(() => { if (!el.isConnected) removeEventListener('keydown', el._key); }, 60000);
  // 音效：低音蓄力 → 白闪时的和弦
  sfx.charge(); setTimeout(() => sfx.awaken(), 350);
  setTimeout(() => {
    if (done) return; done = true;
    if (!doJobChange(jobId)) return;
    const p = game.player; if (p) { if (typeof fxAura === 'function') fxAura(p, '#ffd23a', 2.5); if (typeof fxBurst === 'function') fxBurst(p.x, p.y, p.z + 60, 320, '#ffd23a'); }
    cam.flash = 0.2; cam.flashCol = '#fff';
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => sfx.tone('triangle', 392 * Math.pow(2, s / 12), 0, 0.5, 0.1, { delay: i * 0.07 }));
    [0, 7, 12].forEach(s => sfx.tone('sawtooth', 98 * Math.pow(2, s / 12), 0, 1.6, 0.04, { attack: 0.05, delay: 0.1 }));
    toastMsg(`转职成功！你成为了「${J.name}」`, '#ffd23a', 'log');   // 转职演出本身就会大字展示，横幅会叠在演出上，只记到系统消息
  }, 900);
  // 粒子：金色光点从下往上飘，白闪时向外炸开
  const c = cv.getContext('2d'), P = [];
  for (let i = 0; i < 140; i++) P.push({ x: Math.random() * 960, y: 540 + Math.random() * 540, v: 30 + Math.random() * 90, r: 0.6 + Math.random() * 2.2, ph: Math.random() * TAU });
  const burst = []; let lastT = t0;
  const loop = now => {
    if (!el.isConnected) { removeEventListener('keydown', el._key); return; }
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (t > 0.9 && !burst.length) for (let i = 0; i < 220; i++) { const a = Math.random() * TAU, s = 120 + Math.random() * 520; burst.push({ x: 480, y: 290, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 + Math.random() }); }
    c.clearRect(0, 0, 960, 540); c.globalCompositeOperation = 'lighter';
    for (const p of P) { p.y -= p.v * dt; p.x += Math.sin(t * 2 + p.ph) * 0.4; if (p.y < -10) { p.y = 550; p.x = Math.random() * 960; } const a = 0.35 + 0.35 * Math.sin(t * 4 + p.ph); c.fillStyle = `rgba(255,${200 + (p.r * 20 | 0)},120,${a})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
    for (const b of burst) { if (b.life <= 0) continue; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.96; b.vy = b.vy * 0.96 + 30 * dt; c.fillStyle = `rgba(255,230,150,${Math.max(0, b.life) * 0.8})`; c.fillRect(b.x, b.y, 2.5, 2.5); }
    c.globalCompositeOperation = 'source-over';
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  el._arg = { fx: jobId };
  return el;
}
