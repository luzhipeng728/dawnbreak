#!/bin/sh
# 快速回归（阶段交付 / 日常合并用，目标 3~5 分钟）：只挑一分钟以内的核心测试，分 3 组并行跑。
#   - 每组内部串行，同一时间每组只开 1 个浏览器（共 3 个）
#   - 联机测试对时序敏感，全部放在第 3 组串行跑
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
g1() { for t in flow ui items compare bulk gear guide quickquest polish mobile; do run 1 $t node test/$t.mjs; done; run 1 gearsim node test/gear_sim.mjs 20; }
g2() { for t in combat summon avatar shop acct bag skyguide sword gunner mage enchantress summoner paramedic witch; do run 2 $t node test/$t.mjs; done
  run 2 skillsa node test/skill_sa.mjs; run 2 shopecon node test/shop_econ.mjs; run 2 shopsynth node test/shop_synth.mjs
  run 2 classes node test/classes.mjs sword,gun,mage; }
g3() { run 3 serverapi node server/test/api.mjs; run 3 restore node --disable-warning=ExperimentalWarning server/test/restore.mjs
  run 3 netacct node test/net_account.mjs; run 3 svcapi node test/svc_api.mjs; run 3 svcplay node test/svc_play.mjs
  run 3 mptown node test/mp_town.mjs; run 3 mpcoop node test/mp_coop.mjs 2; run 3 mpmore node test/mp_coop_more.mjs
  run 3 findfriend node test/findfriend.mjs; run 3 partyhud node test/mp_party_hud.mjs; }
t0=$(date +%s)
g1 & g2 & g3 & wait
cat $LOG/summary-1.txt $LOG/summary-2.txt $LOG/summary-3.txt | tee $LOG/summary.txt
fails=$(grep -c FAIL $LOG/summary.txt); total=$(grep -c '^==' $LOG/summary.txt)
echo "快速回归：$((total - fails))/$total 通过，用时 $(( $(date +%s) - t0 ))s（详情 $LOG/<名字>.log）"
[ "$fails" -eq 0 ]
