#!/bin/sh
# 快速回归（主线程合并一批后用，约 9 分钟；平时开发只跑受影响的测试：node test/affected.mjs）：只挑一分钟以内的核心测试，分 6 组并行跑。
#   - 每组内部串行，同一时间每组只开 1 个浏览器（共 3 个）
#   - 联机测试对时序敏感，全部放在第 6 组串行跑
#   - 慢的全量测试（bestiary / botrun / sky / behemoth / world / 全转职 classes / duel……）只在大阶段合并后由主线程跑 test/all.sh
# 用法：sh test/quick.sh          新增的职业测试放进 g2（文件不存在时自动跳过）
cd "$(dirname "$0")/.." || exit 1
# 并发名额（和 test/affected.mjs、boss.mjs 共用，test/testlock.mjs）：默认同时 3 套测试，名额满了排队
N=${TEST_SLOTS:-3}; said=; LOCK=
while [ -z "$LOCK" ]; do
  i=1; while [ $i -le $N ]; do d=${TMPDIR:-/tmp}/dawnbreak-tests.slot.$i
    if mkdir "$d" 2>/dev/null; then echo $$ > "$d/pid"; LOCK=$d; break; fi
    pid=$(cat "$d/pid" 2>/dev/null); if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then rm -rf "$d"; continue; fi
    i=$((i + 1)); done
  [ -z "$LOCK" ] && { [ -z "$said" ] && echo "测试名额（$N 个）都在用，排队等……" && said=1; sleep 3; }
done
trap 'rm -rf "$LOCK"' EXIT INT TERM
LOG=test/shots/quick; mkdir -p $LOG; rm -f $LOG/summary-*.txt
if ! node build.mjs > $LOG/build.log 2>&1; then cat $LOG/build.log; exit 1; fi
tail -1 $LOG/build.log
if [ ! -d server/node_modules ] && ! npm ci --prefix server --no-audit --no-fund > $LOG/npm-ci.log 2>&1; then cat $LOG/npm-ci.log; exit 1; fi
run() { g=$1; name=$2; shift 2
  for a in "$@"; do case $a in *test/*.mjs) [ -f "$a" ] || return 0 ;; esac; done   # 测试文件不存在（别的组还没合进来）就跳过
  start=$(date +%s); nice -n 10 "$@" > $LOG/$name.log 2>&1; code=$?
  if [ $code -eq 0 ] && grep -qE '"type": ?"pageerror"|✗' $LOG/$name.log; then code=99; fi
  printf '== %-12s %s  %ss\n' "$name" "$([ $code -eq 0 ] && echo PASS || echo "FAIL($code)")" $(( $(date +%s) - start )) >> $LOG/summary-$g.txt; }
# 6 组并行（用户允许多开并发，约 2 分钟）；每组内部串行，每组同一时间只开 1 个浏览器；联机测试对时序敏感，全部放在第 6 组串行跑
g1() { for t in flow ui skill_layout mobile mobile_buff mobile_fighter polish quests60 admin_console; do run 1 $t node test/$t.mjs; done; }
g2() { for t in items compare bulk gear guide quickquest levelcap; do run 2 $t node test/$t.mjs; done; run 2 gear60 node test/gear60.mjs core; run 2 gear60j node test/gear60.mjs jobs; run 2 cdr60 node test/cdr60.mjs; run 2 gearsim node test/gear_sim.mjs 40; run 2 contract_rules node test/contract_rules.mjs; run 2 raid_auction node test/raid_auction.mjs; run 2 raid_core_rules node test/raid_core_rules.mjs; run 2 raid_rewards node test/raid_rewards.mjs; run 2 raid_layout node test/raid_layout.mjs; run 2 raid_siroco_rules node test/raid_siroco_rules.mjs; run 2 raid_mech_core node test/raid_mech_core.mjs; run 2 ozma_core node test/ozma_core.mjs; run 2 ozma_maps node test/ozma_maps.mjs; run 2 ozma_runtime node test/ozma_runtime.mjs; run 2 jobvisuals node test/jobvisuals.mjs; run 2 fstriker node test/fighter_striker.mjs; run 2 fgrappler node test/fighter_grappler.mjs; run 2 grappler node test/grappler.mjs; run 2 brawler node test/brawler.mjs; run 2 fbrawler node test/fighter_brawler.mjs; run 2 fighter_nen node test/fighter_nenmaster.mjs; run 2 nenmaster node test/nenmaster.mjs; run 2 autolearn node test/skill_autolearn.mjs; run 2 flooks node test/fighter_looks.mjs; }
g3() { for t in combat summon avatar shop acct bag skyguide epicfx; do run 3 $t node test/$t.mjs; done
  run 3 skillsa node test/skill_sa.mjs; run 3 shopecon node test/shop_econ.mjs; run 3 shopsynth node test/shop_synth.mjs; run 3 vanity node test/vanity.mjs; run 3 juggle node test/juggle.mjs; run 3 juggle_core node test/juggle_core.mjs; }
g4() { for t in sword gunner mage enchantress summoner awkcancel; do run 4 $t node test/$t.mjs; done
  run 4 region node test/region.mjs siroco data,skills,mechs,scenes,quest,abyss   # 区域流水线的快速部分（怪物逐个 / 机器人通关在 all.sh）
  run 4 raidmech node test/raid_mech_lab.mjs   # 团本领主机制运行时（docs/RAID_SIROCO.md §10）：每个谜题真的刷物件 / 标记、能解开、灭团掉血
  run 4 bossprims node test/boss_prims.mjs   # 领主差异化原语（docs/BOSS_SPEC.md）：挨打 / 生路、解开 / 失败、特性、defineBossKit、领主房
  run 4 boss node test/boss.mjs graca,skasa_nest data,phases,skills,mechs; }   # 领主专项的快速样本：一个手写领主 + 一个 4 阶段区域领主（全部 59 个 + 机器人在 all.sh）
g5() { for t in paramedic witch spitfire mechanic fighter fighter_quests fighter_pvp fighter_launch priest infighter priest_infighter infighter_contract contract duel_rules; do run 5 $t node test/$t.mjs; done; run 5 duelwake node test/duel_wakeup.mjs asura,aura; run 5 classes node test/classes.mjs sword,gun,mage; }
g6() { run 6 serverapi node server/test/api.mjs; run 6 restore node --disable-warning=ExperimentalWarning server/test/restore.mjs; run 6 arenasrv node --disable-warning=ExperimentalWarning server/test/arena.mjs; run 6 adminsrv node --disable-warning=ExperimentalWarning server/test/admin.mjs
  run 6 netacct node test/net_account.mjs; run 6 svcapi node test/svc_api.mjs; run 6 svcplay node test/svc_play.mjs
  run 6 mptown node test/mp_town.mjs; run 6 mpcoop node test/mp_coop.mjs 2; run 6 mpfighter node test/mp_fighter.mjs; run 6 mpmore node test/mp_coop_more.mjs; run 6 mpabyss node test/mp_abyss.mjs A,HA
  run 6 findfriend node test/findfriend.mjs; run 6 partyhud node test/mp_party_hud.mjs; run 6 inspect node test/inspect.mjs; run 6 raidui node test/raid_ui.mjs; run 6 mpraid node test/mp_raid.mjs; run 6 srvraid node --disable-warning=ExperimentalWarning server/test/raid.mjs; run 6 coopmail node test/coop_mail.mjs; }
t0=$(date +%s)
# 默认 3 条并行（3 个浏览器）：电脑不卡，约 9 分钟；QUICK_J=6 sh test/quick.sh 恢复 6 条全并行（约 7 分钟，很占 CPU）
if [ "${QUICK_J:-3}" -ge 6 ]; then g1 & g2 & g3 & g4 & g5 & g6 & wait
else { g6; } & { g2; g4; } & { g3; g1; g5; } & wait; fi
cat $LOG/summary-[1-6].txt | tee $LOG/summary.txt
fails=$(grep -c FAIL $LOG/summary.txt); total=$(grep -c '^==' $LOG/summary.txt)
echo "快速回归：$((total - fails))/$total 通过，用时 $(( $(date +%s) - t0 ))s（详情 $LOG/<名字>.log）"
[ "$fails" -eq 0 ]
