#!/bin/sh
# 全套回归（主线程合并验收用）：依次运行所有测试，逐个记录退出码，最后汇总。
# 必须串行跑：同时开多个无头浏览器时，时序敏感的测试会偶发失败。
# 用法：sh test/all.sh [quick]   —— quick 只跑核心的几项
cd "$(dirname "$0")/.." || exit 1
node build.mjs | tail -1
[ -d server/node_modules ] || npm ci --prefix server --no-audit --no-fund >/dev/null 2>&1   # 联机测试要用真实服务端（本机临时库）
LOG=test/shots/all; mkdir -p $LOG; : > $LOG/summary.txt
run() { name=$1; shift; printf '== %-12s ' "$name"; start=$(date +%s); "$@" > $LOG/$name.log 2>&1; code=$?
  # 输出里出现页面错误也算失败（有些测试只打印 LOGS 不设退出码）
  if [ $code -eq 0 ] && grep -qE '"type": ?"pageerror"|✗' $LOG/$name.log; then code=99; fi
  echo "$([ $code -eq 0 ] && echo PASS || echo "FAIL($code)")  $(( $(date +%s) - start ))s" | tee -a $LOG/summary.txt; }
run flow      node test/flow.mjs
run ui        node test/ui.mjs
run items     node test/items.mjs
run compare   node test/compare.mjs
run bulk      node test/bulk.mjs
run gear      node test/gear.mjs
run gearsim   node test/gear_sim.mjs 20
run quests    node test/quests.mjs
run guide     node test/guide.mjs
run quickquest node test/quickquest.mjs
run world     node test/world.mjs
run polish    node test/polish.mjs
run combat    node test/combat.mjs
run skillsa   node test/skill_sa.mjs
run avatar    node test/avatar.mjs
run shop      node test/shop.mjs
run shopecon  node test/shop_econ.mjs
run classes   node test/classes.mjs sword,gun,mage,sword:blade,sword:berserker,gun:ranger,gun:launcher,mage:elemental,mage:battlemage
[ "$1" = quick ] && exit 0
run bestiary  node test/bestiary.mjs
run sky       node test/sky.mjs
run skyroute  node test/sky_route.mjs
run behemoth  node test/behemoth.mjs
run bhmroute  node test/behemoth_route.mjs
run duel      node test/duel.mjs sword:gun,gun:mage,mage:sword 3
run mobile    node test/mobile.mjs
run botrun    env SPEED=3 node test/botrun.mjs lorien:3:0:sword,lorien_deep:4:0:gun,dark_woods:6:0:mage,dark_woods_deep:8:0:sword,thunder_ruins:10:0:gun,venom_ruins:11:0:mage,graca:14:0:sword,blazing_graca:16:0:gun,frozen_woods:12:0:mage,dark_thunder:19:0:sword,dragon_tower:15:0:gun,puppet_hall:16:0:mage,golem_tower:17:0:sword,dark_corridor:19:0:gun,lord_palace:21:0:mage,floating_castle:22:0:sword
run serverapi node server/test/api.mjs
run restore   node --disable-warning=ExperimentalWarning server/test/restore.mjs
run netacct   node test/net_account.mjs
# 社交组、联机组后续的测试加在这里
run svcapi    node test/svc_api.mjs
run svcplay   node test/svc_play.mjs
run svcguildapi node test/svc_guild_api.mjs
run svcguild  node test/svc_guild.mjs
run webflow   env WEB=1 node test/flow.mjs
# 联机（本机临时服务端 + 2~3 个无头页面，测完即关）
run mptown    node test/mp_town.mjs
run mpcoop    node test/mp_coop.mjs 2
run mpdrop    node test/mp_coop_drop.mjs
run mpduel    node test/mp_duel.mjs
run mpmore    node test/mp_coop_more.mjs
run mprestart node test/mp_restart.mjs
echo; cat $LOG/summary.txt
