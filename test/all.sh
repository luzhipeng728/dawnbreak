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
run gear60    node test/gear60.mjs core
run gear60mig node test/gear60.mjs migrate
run gearsim   node test/gear_sim.mjs 20
run cdr60     node test/cdr60.mjs
run quests    node test/quests.mjs
run guide     node test/guide.mjs
run quickquest node test/quickquest.mjs
run quests60  node test/quests60.mjs
run levelcap  node test/levelcap.mjs
run world     node test/world.mjs
run polish    node test/polish.mjs
run combat    node test/combat.mjs
run skillsa   node test/skill_sa.mjs
run sword     node test/sword.mjs
run auditsw   node test/skillaudit.mjs sword,sword:blade,sword:berserker,sword:asura,sword:soulbender,sword:ghostblade --compare   # 鬼剑士技能机制 vs 官方规格 docs/skills/sword.json
run summon    node test/summon.mjs
run gunner    node test/gunner.mjs
run mage      node test/mage.mjs
run awkcancel node test/awkcancel.mjs   # 觉醒取消：15 个转职每个技能放到 30% 切觉醒
run summoner  node test/summoner.mjs
run paramedic node test/paramedic.mjs
run enchant   node test/enchantress.mjs
run witch     node test/witch.mjs
run fighter   node test/fighter.mjs   # 格斗家 B0：存档安全（未知 / 没开放职业的角色不丢）、id 预留、武器手感、开放开关、?fighter=1 建角色进地下城
# 格斗家 B8：风振的转职任务链、四个转职各自的转职任务线、一觉剧情、一 / 二 / 三觉；没开放时老职业看不到
run fquests   node test/fighter_quests.mjs
run striker   node test/striker.mjs   # 散打（B5）：柔化肌肉 / 霸体护甲 / 烈焰焚步 / 双重施放 / 强袭拳·闪步 / 锁定最强敌人 / 范围 + 游戏内截图
run fgrappler node test/fighter_grappler.mjs   # 柔道家（B7）：登记、28 个技能逐个能放
run grappler  node test/grappler.mjs   # 柔道家机制：抓轰炮 / 暴力抓取 / 滑行 / 连环 / 二觉预约 / 领主不卡死
run brawler   node test/brawler.mjs   # 格斗家 B6 街霸：投掷物装填 / 强化投掷 / 两连投 / 异常加伤 / 抓取 / 锁链 / 三个觉醒
run fbrawler  node test/fighter_brawler.mjs
run spitfire  node test/spitfire.mjs
run mechanic  node test/mechanic.mjs
run gunjobs   node test/gunner_jobs.mjs
run audit_gun node test/skillaudit.mjs gun,gun:ranger,gun:launcher,gun:mechanic,gun:spitfire,gun:paramedic --compare   # 神枪手技能对官方规格 docs/skills/gun.json
run avatar    node test/avatar.mjs
run weapons   node test/weapons.mjs   # 武器外观：史诗 / 品级外观齐全、握点、品级选择、联机外观
run hatcheck  python3 art/tools/avatar_hatcheck.py   # 神枪手 / 魔法师原装帧不能把帽子画丢
run shop      node test/shop.mjs
run shopecon  node test/shop_econ.mjs
run shopsynth node test/shop_synth.mjs
run vanity    node test/vanity.mjs   # 强化 / 增幅武器光效、时装城镇移速、天空套特效、城镇 8 人帧率
run jobvisuals node test/jobvisuals.mjs   # 转职外观（鬼手 / 红眼 / 凯贾鬼影 / 狂暴血焰）、无敌半透明、光效在刀身后面、帧率
run acct      node test/acct.mjs
run bag       node test/bag.mjs
run skyguide  node test/skyguide.mjs
run epicfx    node test/epicfx.mjs
run maxlv     node test/maxlv.mjs
run maxlvacct node test/maxlv_acct.mjs
run box100    node test/box100.mjs
run repair    node test/repair.mjs
run classes   node test/classes.mjs sword,gun,mage,sword:blade,sword:berserker,sword:asura,sword:soulbender,sword:ghostblade,gun:ranger,gun:launcher,gun:mechanic,gun:spitfire,gun:paramedic,mage:elemental,mage:battlemage,mage:summoner,mage:witch,mage:enchantress
run audit_mage node test/skillaudit.mjs mage,mage:elemental,mage:battlemage,mage:summoner,mage:witch,mage:enchantress --compare   # 魔法师技能对官方规格 docs/skills/mage.json
[ "$1" = quick ] && exit 0
run bestiary  node test/bestiary.mjs
run sky       node test/sky.mjs
run skyroute  node test/sky_route.mjs
run behemoth  node test/behemoth.mjs
run bhmroute  node test/behemoth_route.mjs
run region    node test/region.mjs siroco   # 区域流水线：数据 / 技能库 / 机制库 / 怪物 / 场景 / 任务 / 机器人通关（约 25 分钟）
run duel      node test/duel.mjs sword:gun,gun:mage,mage:sword 3
run pvpbal    node test/pvp_balance.mjs 4 all
run juggle    node test/juggle.mjs
run mobile    node test/mobile.mjs
run botrun    env SPEED=3 node test/botrun.mjs lorien:3:0:sword,lorien_deep:4:0:gun,dark_woods:6:0:mage,dark_woods_deep:8:0:sword,thunder_ruins:10:0:gun,venom_ruins:11:0:mage,graca:14:0:sword,blazing_graca:16:0:gun,frozen_woods:12:0:mage,dark_thunder:19:0:sword,dragon_tower:15:0:gun,puppet_hall:16:0:mage,golem_tower:17:0:sword,dark_corridor:19:0:gun,lord_palace:21:0:mage,floating_castle:22:0:sword
run serverapi node server/test/api.mjs
run restore   node --disable-warning=ExperimentalWarning server/test/restore.mjs
run arenasrv  node --disable-warning=ExperimentalWarning server/test/arena.mjs
run netacct   node test/net_account.mjs
run liveupd   node test/liveupdate.mjs
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
run duellag   env MAXMS=33 node test/mp_duel_lag.mjs 4 0,120   # 决斗：对方按键到自己出招（本地模拟，往返 120ms 下 ≤ 33ms）、不重播、位置一致
run arena     node test/arena.mjs
run mpmore    node test/mp_coop_more.mjs
run mpabyss   node test/mp_abyss.mjs   # 组队深渊：满级狂战士 + 冷却 ×0.34 打完两轮和三种深渊领主，两边不报错、每帧都画；队员逐招重播领主出招、会被打到；逐帧出错安全网
run mprestart node test/mp_restart.mjs
run findfriend node test/findfriend.mjs
run partyhud  node test/mp_party_hud.mjs
run inspect   node test/inspect.mjs
echo; cat $LOG/summary.txt
