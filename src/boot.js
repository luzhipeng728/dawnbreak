/* =====================================================================
   启动：先加载公共美术分包，再按启动参数进入标题 / 城镇 / 地下城 / 测试房间；全部就绪后才标记 __READY（测试脚本以此为准）
   ===================================================================== */
nameAllPoses();
if (PARAMS.has('art')) loadBundles(allBundles()).then(() => artLab());
else {
  touch.init();
  loadBundles(['core']).then(() => {
    requestAnimationFrame(frame);
    return PARAMS.has('duel') ? bootDuel() : boot();   // ?duel=…：决斗场（game/duel.js）
  }).then(() => { window.__READY = true; });
}
// 调试钩子（测试脚本使用）
window.__G = { game, ents, input, cam, get player() { return game.player; }, SKILLS, fxList, projs, drops, spawnMonster, startTestRoom };
