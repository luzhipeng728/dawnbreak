/* =====================================================================
   26. 游戏流程：标题 → 城镇 ↔ 地下城
   ===================================================================== */
// 进城 / 进地下城之前先加载所需的美术分包（网页版按需下载，离线版瞬间完成）
const dungeonBundles = def => ['bg:' + def.theme, ...monBundles([...def.mobs.map(m => m[0]), def.boss.kind, def.elite].filter(Boolean))];
function startGame(cls) {
  return withLoading(['spr:' + cls], () => startGameNow(cls));
}
function startGameNow(cls) {
  game.player = makePlayer(cls);
  save.apply(); cmdLabel(cls);
  recalcStats(game.player); game.player.hp = game.player.hpMax; game.player.mp = game.player.mpMax;
  return goTown().then(() => afterEnterWorld());
}
function afterEnterWorld() {
  if (save.skillReset) { save.skillReset = false; toastMsg('版本更新：操作与技能按官方现版对齐——闪避改为 ↓+C 后跳（10 级可学后跳-强化）、受身改为蹲伏，技能栏 14 格；技能已初始化，SP 全部返还（按 K 重新加点）', '#8aff9a'); }
  if (save.migrated) { save.migrated = false; toastMsg('版本更新：角色变强了！获得 150 SP、1000 G 与药剂补给', '#8aff9a'); }
  if (!save.data.seenHelp) { save.data.seenHelp = true; menus.open('help'); }
}
function enterDungeon(id, diff) {
  const def = DUNGEONS[id];
  save.daily();
  if (save.data.fatigue < def.rooms) { toastMsg(`疲劳值不足：${def.name} 至少需要 ${def.rooms} 点疲劳`, '#ff6a6a'); sfx.error(); return false; }
  if (def.beforeEnter && def.beforeEnter(diff) === false) return false;   // 进图前的检查 / 消耗（深渊派对邀请函，content/abyss.js）
  game.maxCombo = 0; game.combo = 0;
  return withLoading(dungeonBundles(def), () => { new Dungeon(def, diff).start(); return true; });
}
function boot() {
  game.scene = 'title';
  const tcls = PARAMS.get('cls') || 'sword';
  if (PARAMS.has('test')) {
    const kinds = PARAMS.has('mon') ? PARAMS.get('mon').split(',') : ['goblin', 'goblinThrower'];
    return withLoading(['spr:' + tcls, 'bg:forest', ...monBundles(kinds)], () => { save.newGame(tcls); Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); /* 测试房间：一 / 二 / 三次觉醒都视为已完成觉醒任务 */ game.player = makePlayer(tcls); cmdLabel(tcls); for (const id of CLASSES[tcls].skills) game.skillLv[id] = Math.max(game.skillLv[id] || 0, 1); game.skillBar = CLASSES[tcls].skills.filter(id => !SKILLS[id].passive).concat(Array(SKILL_SLOTS).fill(null)).slice(0, SKILL_SLOTS); startTestRoom(); });
  }
  const alias = { path: 'lorien', deep: 'lorien_deep', shade: 'dark_woods', thunder: 'thunder_ruins', venom: 'venom_ruins', camp: 'graca', flame: 'blazing_graca', abyss: 'dark_thunder' };
  const devSave = () => { save.loadAll(); const i = PARAMS.has('cls') ? save.chars.findIndex(c => c.cls === tcls) : save.chars.length - 1; if (i >= 0) save.select(i); else save.newGame(tcls); save.apply(); };
  if (PARAMS.has('dungeon')) { devSave(); return startGame(save.data.cls).then(() => { if (menus.isOpen('help')) menus.close('help'); if (PARAMS.has('lv')) testLoadout(+PARAMS.get('lv')); const id = PARAMS.get('dungeon') || 'lorien'; return enterDungeon(alias[id] || id, +(PARAMS.get('diff') || 0)); }); }
  if (PARAMS.has('town')) { devSave(); return startGame(save.data.cls); }
  if (PARAMS.has('resume') && save.load()) { save.apply(); return startGame(save.data.cls); }   // 从决斗场回来：直接接着玩上次的角色（不用再经过标题和选角）
  // 标题画面背后是暮色林地的风景
  game.room = { x0: 0, x1: 1600, theme: 'forest', seed: 3 }; buildRoomArt(game.room); cam.x = 200;
  const title = () => { menus.open('title'); music.play('title'); };
  const lu = liveUpdate.take();   // 在线更新刷新回来：跳过标题和选角，回到刷新前的角色和位置（net/liveupdate.js）
  if (lu) return liveUpdate.resume(lu).then(ok => { if (!ok) title(); });
  title();
}
