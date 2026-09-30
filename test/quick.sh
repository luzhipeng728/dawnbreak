#!/bin/sh
# 快速回归（阶段交付 / 日常合并用，约 2 分钟）：只挑一分钟以内的核心测试，分 6 组并行跑。
#   - 每组内部串行，同一时间每组只开 1 个浏览器（共 3 个）
#   - 联机测试对时序敏感，全部放在第 6 组串行跑
#   - 慢的全量测试（bestiary / botrun / sky / behemoth / world / 全转职 classes / duel……）只在大阶段合并后由主线程跑 test/all.sh
# 用法：sh test/quick.sh          新增的职业测试放进 g2（文件不存在时自动跳过）
cd "$(dirname "$0")/.." || exit 1
node build.mjs | tail -1
[ -d server/node_modules ] || npm ci --prefix server --no-audit --no-fund >/dev/null 2>&1
LOG=test/shots/quick; mkdir -p $LOG; rm -f $LOG/summary-*.txt
run() { g=$1; name=$2; shift 2
  for a in "$@"; do case $a in *test/*.mjs) [ -f "$a" ] || return 0 ;; esac; done   # 测试文件不存在（别的组还没合进来）就跳过
  start=$(date +%s); "$@" > $LOG/$name.log 2>&1; code=$?
  if [ $code -eq 0 ] && grep -qE '"type": ?"pageerror"|✗' $LOG/$name.log; then code=99; fi
  printf '== %-12s %s  %ss\n' "$name" "$([ $code -eq 0 ] && echo PASS || echo "FAIL($code)")" $(( $(date +%s) - start )) >> $LOG/summary-$g.txt; }
# 6 组并行（用户允许多开并发，约 2 分钟）；每组内部串行，每组同一时间只开 1 个浏览器；联机测试对时序敏感，全部放在第 6 组串行跑
g1() { for t in flow ui mobile mobile_buff mobile_fighter polish quests60 admin_console; do run 1 $t node test/$t.mjs; done; }
g2() { for t in items compare bulk gear guide quickquest levelcap; do run 2 $t node test/$t.mjs; done; run 2 gear60 node test/gear60.mjs core; run 2 gear60j node test/gear60.mjs jobs; run 2 cdr60 node test/cdr60.mjs; run 2 gearsim node test/gear_sim.mjs 40; run 2 jobvisuals node test/jobvisuals.mjs; run 2 fstriker node test/fighter_striker.mjs; run 2 fgrappler node test/fighter_grappler.mjs; run 2 grappler node test/grappler.mjs; run 2 brawler node test/brawler.mjs; run 2 fbrawler node test/fighter_brawler.mjs; run 2 fighter_nen node test/fighter_nenmaster.mjs; run 2 nenmaster node test/nenmaster.mjs; run 2 autolearn node test/skill_autolearn.mjs; run 2 flooks node test/fighter_looks.mjs; }
g3() { for t in combat summon avatar shop acct bag skyguide epicfx; do run 3 $t node test/$t.mjs; done
  run 3 skillsa node test/skill_sa.mjs; run 3 shopecon node test/shop_econ.mjs; run 3 shopsynth node test/shop_synth.mjs; run 3 vanity node test/vanity.mjs; run 3 juggle node test/juggle.mjs; }
g4() { for t in sword gunner mage enchantress summoner awkcancel; do run 4 $t node test/$t.mjs; done
  run 4 region node test/region.mjs siroco data,skills,mechs,scenes,quest,abyss; }   # 区域流水线的快速部分（怪物逐个 / 机器人通关在 all.sh）
g5() { for t in paramedic witch spitfire mechanic fighter fighter_quests fighter_pvp fighter_launch duel_rules; do run 5 $t node test/$t.mjs; done; run 5 duelwake node test/duel_wakeup.mjs asura,aura; run 5 classes node test/classes.mjs sword,gun,mage; }
g6() { run 6 serverapi node server/test/api.mjs; run 6 restore node --disable-warning=ExperimentalWarning server/test/restore.mjs; run 6 arenasrv node --disable-warning=ExperimentalWarning server/test/arena.mjs; run 6 adminsrv node --disable-warning=ExperimentalWarning server/test/admin.mjs
  run 6 netacct node test/net_account.mjs; run 6 svcapi node test/svc_api.mjs; run 6 svcplay node test/svc_play.mjs
  run 6 mptown node test/mp_town.mjs; run 6 mpcoop node test/mp_coop.mjs 2; run 6 mpfighter node test/mp_fighter.mjs; run 6 mpmore node test/mp_coop_more.mjs; run 6 mpabyss node test/mp_abyss.mjs A,HA
  run 6 findfriend node test/findfriend.mjs; run 6 partyhud node test/mp_party_hud.mjs; run 6 inspect node test/inspect.mjs; }
t0=$(date +%s)
g1 & g2 & g3 & g4 & g5 & g6 & wait
cat $LOG/summary-[1-6].txt | tee $LOG/summary.txt
fails=$(grep -c FAIL $LOG/summary.txt); total=$(grep -c '^==' $LOG/summary.txt)
echo "快速回归：$((total - fails))/$total 通过，用时 $(( $(date +%s) - t0 ))s（详情 $LOG/<名字>.log）"
[ "$fails" -eq 0 ]
