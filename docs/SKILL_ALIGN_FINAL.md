# 技能逐个对齐官方（最终轮）——各职业子智能体共用要求

用户原话：“每个职业的技能和官方的都不一样，我希望你一个一个去对，确保真正一模一样。每个职业一个子智能体，一个一个技能对齐，普通技能和转职技能，效果也要差不多才行。”

前几轮对过数值（冷却、段数）、流程和范围。这一轮是最严的：**逐个技能**对到和国服现版一样——
按键 / 指令、每一段的位移、段数和每段节奏、判定框大小和朝向、霸体 / 无敌时间段、浮空 / 击倒 / 抓取、再按 / 蓄力 / 按住机制、MP 消耗、冷却、Buff / 状态、以及**特效长什么样**（形状、大小、颜色、出现时机、残影 / 音效感觉）。

## 做法（每个技能都要过一遍）
1. 查官方：docs/skills/<职业>.json 和 docs/SKILLS_OFFICIAL_<职业>.md 已有摘要和出处；再用 WebFetch 看 wiki.dfo.world（技能页有指令、冷却、分段说明，常有演示视频链接）、namu.wiki、灰机 wiki。先读 docs/skills/<职业>_behavior.md 和 <职业>_range.md，看前几轮做了什么，别重复。
2. 每个技能写一小块“官方要点”，和我们的代码（act()、HB 判定、fx 调用）逐条对，记下不一致。
3. 能用现有引擎钩子和现有特效素材（fxSpr / fxShock / fxBeam 等）修的都修；特效必须一眼认得出和官方是同一种设计。缺素材 / 素材不对：用 gpt-image 技能（~/.claude/skills/gpt-image）先出一张样图自己审，再批量。剑类一律直刃直尖，不要弯钩。
4. 不改技能学习等级 / 最高等级；伤害倍率只在“确实不一致”时改，且整体强度别偏离现在太多。改完跑决斗平衡（`node test/pvp_balance.mjs 10`，所有职业 35%~65%），偏了只调自己职业的 PVP_JOB / pvpCd。
5. 产出 docs/skills/<职业>_final.md：每个技能一行：官方要点 | 改前 | 改后 | 状态（一致 / 近似 / 做不到及原因）。

## 验证
- `node test/skillshots.mjs <cls:job>`（连拍图，自己看）、`node test/skillaudit.mjs <cls:job> --compare`（0 项未说明）、该职业自己的测试、`node test/classes.mjs <cls:job>`、`node test/awkcancel.mjs`。
- 不要跑完整 quick.sh（合并后主线程统一跑），只单独跑自己的。

## 规则
- 先读 docs/PLAYBOOK.md §1。只改自己职业的文件和文档；共享引擎文件尽量不动，动了要在汇报里列出。
- 读文件读片段（grep 再 sed -n）；长任务用 run_in_background 等通知，不要 sleep 轮询；测试跑的时候不要重新打包 dist。
- 代码注释只放行尾或单独一行（行中间的 `//` 吞过好几次代码）。
- 提交用 Conventional Commits，结尾写 “Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>”。
- 汇报约 8 行中文：提交号、检查 / 改动了多少技能、改动最大的 5 个（改前 → 改后）、没对上的和原因、连拍图路径。汇报完就停。

## 补充（主线程，2026-09-30）：不能只凭文字说“没有不一致”
- wiki.dfo.world 的 WebFetch 常返回 403：改用 `curl -sL -A "Mozilla/5.0" <URL>`，或镜像 wiki.dfo-world.com、en.namu.wiki、灰机 wiki（dnfcn.huijiwiki.com）、dnf.qq.com。
- 技能页里有 YouTube 演示视频 ID：截图 https://i.ytimg.com/vi/<id>/hq1.jpg、hq2.jpg、hq3.jpg（3 个瞬间），本机有 ffmpeg（/opt/homebrew/bin/ffmpeg）。把官方帧和我们 skillshots 的帧并排看，比较特效的形状 / 大小 / 颜色 / 节奏。
- 汇报里必须写清每个技能是拿什么比的（文字 / 视频帧）；“没发现不一致”不算完成，除非逐个技能都有比对依据。
