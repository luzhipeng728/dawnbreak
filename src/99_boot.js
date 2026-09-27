/* ===================================================================== 99. 启动 ===================================================================== */
if (PARAMS.has('art')) loadAssets().then(() => { nameAllPoses(); artLab(); });
else {
  nameAllPoses();
  touch.init();
  // 先解码全部内嵌美术，再进入游戏
  loadAssets().then(() => {
    if (window.boot) boot(); else startTestRoom();
    requestAnimationFrame(frame);
    window.__READY = true;
  });
}
// 调试钩子（测试脚本使用）
window.__G = { game, ents, input, cam, get player() { return game.player; }, SKILLS, fxList, projs, drops, spawnMonster, startTestRoom };
