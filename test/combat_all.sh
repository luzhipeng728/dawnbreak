#!/bin/sh
# 战斗与动作的全套回归：构建 → 机制 → 全部技能 → 决斗场 → 帧率 → 机器人通关。每项的结尾输出 EXIT=<退出码>
cd "$(dirname "$0")/.." || exit 1
node build.mjs | tail -1
echo "== combat";     node test/combat.mjs;                                                            echo "EXIT=$?"
echo "== classes";    node test/classes.mjs sword,gun,mage,sword:blade,sword:berserker,gun:ranger,gun:launcher,mage:elemental,mage:battlemage | grep -E "skills|LOGS"; echo "EXIT=$?"
echo "== skillshots"; node test/skillshots.mjs sword:blade,sword:berserker,gun:ranger,gun:launcher,mage:elemental,mage:battlemage 2; echo "EXIT=$?"
echo "== duel";       node test/duel.mjs sword:gun,gun:mage,mage:sword,sword:gun:berserker:launcher,mage:sword:battlemage:berserker 3; echo "EXIT=$?"
echo "== perf";       node test/perf.mjs sword,gun,mage 6;                                              echo "EXIT=$?"
echo "== botrun";     SPEED=3 node test/botrun.mjs lorien:5:0:sword,lorien:5:0:gun,lorien:5:0:mage | tail -6; echo "EXIT=$?"
