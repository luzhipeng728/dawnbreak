/* =====================================================================
   26. 游戏流程：标题 → 城镇 ↔ 地下城
   ===================================================================== */
// 进城 / 进地下城之前先加载所需的美术分包（网页版按需下载，离线版瞬间完成）
const dungeonBundles = def => ['bg:' + def.theme, ...monBundles([...def.mobs.map(m => m[0]), def.boss.kind, def.elite].filter(Boolean))];
function startGame(cls) {
  return withLoading(['spr:' + cls, 'npc', 'bg:town'], () => startGameNow(cls));
}
function startGameNow(cls) {
  game.player = makePlayer(cls);
  save.apply(); cmdLabel(cls);
  recalcStats(game.player); game.player.hp = game.player.hpMax; game.player.mp = game.player.mpMax;
  goTown();
  if (save.migrated) { save.migrated = false; toastMsg('版本更新：角色变强了！获得 150 SP、1000 G 与药剂补给，新增闪避（Shift）', '#8aff9a'); }
  if (!save.data.seenHelp) { save.data.seenHelp = true; menus.open('help'); }
}
function enterDungeon(id, diff) {
  const def = DUNGEONS[id];
  save.daily();
  if (save.data.fatigue < def.rooms) { toastMsg(`疲劳值不足：${def.name} 至少需要 ${def.rooms} 点疲劳`, '#ff6a6a'); sfx.error(); return false; }
  game.maxCombo = 0; game.combo = 0;
  return withLoading(dungeonBundles(def), () => { new Dungeon(def, diff).start(); return true; });
}
function boot() {
  game.scene = 'title';
  const tcls = PARAMS.get('cls') || 'sword';
  if (PARAMS.has('test')) {
    const kinds = PARAMS.has('mon') ? PARAMS.get('mon').split(',') : ['goblin', 'goblinThrower'];
    return withLoading(['spr:' + tcls, 'bg:forest', ...monBundles(kinds)], () => { save.newGame(tcls); game.player = makePlayer(tcls); cmdLabel(tcls); for (const id of CLASSES[tcls].skills) game.skillLv[id] = Math.max(game.skillLv[id] || 0, 1); game.skillBar = CLASSES[tcls].skills.concat([null, null]).slice(0, 12); startTestRoom(); });
  }
  const devSave = () => { if (!save.load() || (PARAMS.has('cls') && save.data.cls !== tcls)) save.newGame(tcls); save.apply(); };
  if (PARAMS.has('dungeon')) { devSave(); return startGame(save.data.cls).then(() => { if (menus.isOpen('help')) menus.close('help'); if (PARAMS.has('lv')) testLoadout(+PARAMS.get('lv')); return enterDungeon(PARAMS.get('dungeon') || 'path', +(PARAMS.get('diff') || 0)); }); }
  if (PARAMS.has('town')) { devSave(); return startGame(save.data.cls); }
  // 标题画面背后是暮色林地的风景
  game.room = { x0: 0, x1: 1600, theme: 'forest', seed: 3 }; buildRoomArt(game.room); cam.x = 200;
  menus.open('title'); music.play('title');
}
