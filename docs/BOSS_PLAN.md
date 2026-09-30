# 领主差异化规划（BOSS_PLAN）

> 2026-09-30 · 数据来自 `d8cfe62` 的代码导出（在 Node vm 里把全部内容跑一遍，读 DUNGEONS / MON / MON_ART / REGIONS / ABYSS / QUESTS）。
> 机器可读版：`docs/boss_inventory.json`（每张图：现状、重复度、官方对照、目标、所属块；另有 `summary` / `primitives` / `blocks`）。
> 本文件只做调研和规划，不含实现。子智能体领活时读 §3.2（原语）+ §4（自己的块）+ §2 里自己那几行。

## 0. 结论

- 69 个地下城（普通 59 + 深渊 10），59 个领主。领主的名字和底图大多不同（55 种底图），**重复的主要是玩法和表现**：
  1. **机制是一个模板**：31~62 级的 37 个领主都用同一套 13 个技能和 9 个机制拼成。37 个全有破招槽，34 个有地面圈，33 个有近战挥砍，24 个会召唤，23 个会落陨石或落雷，15 个有“站进光圈”的安全区。有 7 组领主机制组合完全相同，最大的一组有 5 张图。另有 4 对领主的招式相似度 ≥ 0.83。
  2. **动作是一套帧**：所有怪物的挥砍、砸地、投掷、斧劈都播 atk1→atk4，施法和咆哮都播 cast1→cast2。换了外形，出招动作仍然一样。
  3. **音乐和场地一样**：38 个区域地下城全部用同一首 `boss` 曲，领主房都是同一块 1400 宽的平地。雪山的背景 snRidge 被 4 张图共用。
  4. **撞脸的领主**：最严重的是利库和歌利亚，利库只是歌利亚换色，招式相似度也有 0.88。其余 4 组：年轻的斯卡萨和斯卡萨、冰霜克拉赫和烈焰彼诺修、暗咒猫妖和毒猫王，以及昔日悲鸣的凯恩和悲鸣洞穴的精英凯恩。精英撞脸更严重：卡勒特士兵这张底图做了根特和列车共 6 张图的精英；牛头重甲底图出现在 6 张图里，有领主也有精英。
  5. **深渊重复**：10 个深渊的领主房都是原图领主，深渊领主从本区域的领主里随机抽。31~60 级的 7 个深渊，循环机制全是护盾或场地危害再加安全区。
- **官方对照**：官方每个领主都有 2~4 个好认的招牌，比如利库的投冰车、无头骑士的梦魇奔袭、王的遗迹五骑士、熔岩穴三兄弟、GT-9600 双模式、安祖变身机械、艾丽丝的木偶乐团。领主名字大多已经对上，只有 6 处要改，外加希洛克四门的对调（§2）。
- **做法**：先补约 20 个可复用的“机制原语”（Phase 0），之后每张图只写数据。补完以后 59 个领主里有 43 个是纯配置（SIMPLE，可以交给便宜模型），16 个要组合新原语、调手感或出新图（COMPLEX）。
- **生图**：核心约 79 张，其中 4 个新领主或形态 18 张、49 个领主各 1 张招牌动作表、4 个领主房背景 12 张。可选约 30 张。
- **待拍板**：见 §5，共 9 项。最要紧的三项：希洛克四门是否按官方对调；招牌动作表是否全做；深渊是否改成“每个区域一个固定词条”。

## 1. 现状清单（代码导出）

### 1.1 总数
| 项 | 数 | 说明 |
|---|---|---|
| 地下城 | 69 | 普通 59（格兰 10、天空 6、天帷 6、暗精灵 7、雪山 7、诺斯玛尔 + 根特 5、远古 2、列车 4、时空之门 8、希洛克 4）+ 深渊 10 |
| 领主 | 59 | 每张普通图一个自己的领主；深渊的领主房复用原图领主 |
| 引擎 | 手写 22（1~30 级：`bestiary.js` / `monsters/sky_castle.js` / `monsters/behemoth.js`）+ 区域 spec 37（31~62 级） | 手写领主没有阶段和机制，只有当深渊领主时才被挂上机制（`abyssLordMechs`） |
| 领主底图 | 55 种 | catKing、flameMage、deGiant、snSkasa 各被两个领主共用；wcKain 同时是精英凯恩和昔日悲鸣的领主 |
| 阶段数（区域领主） | 2 阶段 18、3 阶段 16、4 阶段 3 | |
| 领主曲 | 1 首 | 区域地下城 38/38 用 `boss`；段落曲只有 dungeon / dungeon2 / dungeon3 / abyss |
| 动作帧 | 1 套 | 怪物帧名固定：idle、walk×8、run×8、atk1~4、cast1~2、low1~2、hit、down、getup、air、jump、taunt（`content/sprites.js` 的 `SPR_ANIMS.monster`） |

### 1.2 重复最严重的几组（“好多关卡都是同一个 boss”）
| # | 类型 | 哪些图 | 证据 |
|---|---|---|---|
| 1 | 同图又同招 | 熔岩穴 歌利亚 ↔ 利库天井 利库 | 同一张 deGiant，利库只改了 hue −170；技能种类完全相同（swipe grab aoe rain summon），相似度 0.88 |
| 2 | 机制模板 | 31~62 级全部 37 个 | 破招 37/37；地面圈 34；挥砍 33；召唤 24；落陨石 / 落雷 23（陨石 18、落雷 6，有的两样都有）；安全区 15 |
| 3 | 机制组合完全相同 | 破招 + 场地危害：浅栖之地、利库天井、根特外围、根特东门、列车上的海贼（5 张）；破招 + 无敌：蜘蛛洞穴、堕落的盗贼、比尔马克、悲鸣洞穴（4 张）；诺伊佩拉 = 斯卡萨之巢（5 个机制全同）；瘟疫之源 ≈ 暗黑圣战（0.89）；冰心少年 ≈ 法则之门（0.88） | json 的 `dup` / `summary.identicalMechSets` |
| 4 | 动作相同 | 全部 59 个 | 挥砍、砸地、投掷、斧劈都播 atk1→atk4；施法、咆哮都播 cast1/2 |
| 5 | 换色领主 | 年轻的斯卡萨 ← 斯卡萨；冰霜克拉赫 ← 烈焰彼诺修；暗咒猫妖 ← 毒猫王；昔日悲鸣凯恩 ← 悲鸣洞穴精英凯恩；艾克洛索 ← 毒蜘蛛（放大到 1.9 倍） | MON_ART |
| 6 | 精英撞脸 | gtSoldier ×6（根特 3 张 + 列车 3 张的精英）；tauArmored ×6（洛兰深处领主 + 5 个精英或前哨）；tau ×5（格兰之森）；snBantu ×3（山脊领主 + 2 个精英） | 精英、前哨、领主按底图计数 |
| 7 | 场景和音乐 | snRidge ×4（利库天井、山脊、布万加、凛冬）；deCave、deTomb、gtGate、bmLab、wcCave 各被 2 张图用；领主曲只有一首 | DUNGEONS.theme |
| 8 | 深渊 | 10 个深渊的领主房就是原图领主；31~60 级 7 个深渊的循环机制都是护盾或场地危害再加安全区 | `content/abyss.js` |

### 1.3 全部普通地下城
列的含义：
- 底图：`*` 表示换色，⚠ 表示和别的领主共用。
- 高：视觉高度，等于 h×scale；玩家约 115。
- 机制、技能：区域领主写技能库里的技能种类；手写领主写招牌招式。
- 深渊：这个领主是哪个深渊的深渊领主。

| 图 | Lv | 房 | 领主 | 底图 | 高 | 阶段 | 机制 | 技能 / 招牌 | 精英 · 前哨 · 机关 | 深渊 |
|---|---|---|---|---|---|---|---|---|---|---|
| **格兰之森** ||||||||||
| lorien 洛兰 | 1~2 | 3 | 投掷哥布林首领 `goblinChief` | goblinChief | 145 | 0 | — | 投石 ×2、跳砸倒地、召唤哥布林 |  |  |
| lorien_deep 洛兰深处 | 2~3 | 4 | 牛头兵首领 `tauSoldierBoss` | tauArmored | 147 | 0 | — | 霸体斧击、冲撞、吼叫眩晕 | 哥布林十夫长 |  |
| dark_woods 幽暗密林 | 3~5 | 5 | 牛头巨兽 `tauBeast` | tau* | 182 | 0 | — | 砸地、咆哮 | 牛头兵 |  |
| dark_woods_deep 幽暗密林深处 | 4~7 | 6 | 暗咒猫妖 `catCurse` | catKing* ⚠ | 120 | 0 | — | 抓、扑、咬（减速 + 致盲） | 牛头先锋 |  |
| thunder_ruins 雷鸣废墟 | 6~9 | 6 | 落雷 凯诺 `goblinShaman` | goblinShaman | 113 | 0 | — | 光剑、落雷图案 | 猫妖 |  |
| venom_ruins 猛毒雷鸣废墟 | 8~11 | 7 | 毒猫王 `catKing` | catKing ⚠ | 125 | 0 | — | 毒爪、扑、毒云（被暴击也放） | 毒爪猫妖 | gf |
| frozen_woods 冰霜幽暗密林 | 9~12 | 5 隐 | 冰霜 克拉赫 `frostMage` | flameMage* ⚠ | 120 | 0 | — | 冰斩、冰弹、冰箭环、召冰霜哥布林 | 牛头护卫 |  |
| graca 格拉卡 | 11~14 | 6 | 牛头王 萨乌塔 `tauKing` | tauKing | 210 | 0 | — | 斧劈、冲撞、蓄力震地（可打断） | 牛头巨兽 | gf |
| blazing_graca 烈焰格拉卡 | 12~16 | 7 | 烈焰 彼诺修 `flameMage` | flameMage ⚠ | 120 | 0 | — | 火球、陨石图案、召自爆哥布林 | 牛头巨兽 | gf |
| dark_thunder 暗黑雷鸣废墟 | 14~20 | 7 隐 | 盗尸者 骨狱息 `boneLord` | boneLord | 162 | 0 | — | 吸血咬、冰霜图案、三连冰弹 | 卡尔扎克 | gf |
| **天空之城** ||||||||||
| dragon_tower 龙人之塔 | 14~16 | 6 | 鲁卡斯 `lucas` | lucas | 149 | 0 | — | 放电、囚笼、分身、龙之雕像（房间） | 米尼乌斯 · 领主房两座龙之雕像 |  |
| puppet_hall 人偶玄关 | 15~17 | 6 | 人偶之王 道格里 `dogrey` | dogrey | 149 | 0 | — | 三连石柱、提线拉扯、石化石弹 | 岩石人偶师 |  |
| golem_tower 石巨人塔 | 16~19 | 7 | 黄金巨人 普拉塔尼 `platani` | platani | 161 | 0 | — | 连续冲撞 + 过热、地刺列 / 圈 | 石巨人操纵师 · 杀操纵师→石巨人崩裂 | sky |
| dark_corridor 黑暗玄廊 | 18~21 | 6 | 天之驱逐者 `skyExpeller` | skyExpeller | 146 | 0 | — | 双剑斩、1~3 列落雷（留缝）、长冲刺 | 斧之驱逐者 · 夜视镜卡格关灯 | sky |
| lord_palace 城主宫殿 | 20~23 | 7 | 光之城主 赛格哈特 `seghart` | seghart | 151 | 0 | — | 甩发、光环、雷电密布（环）、激光 | 雷环休斯 | sky |
| floating_castle 悬空城 | 21~24 | 7 隐 | 罪恶之眼 `sinEye` | sinEye | 136 | 0 | — | 冲击波、追踪光柱、激光、石化眼球列（留缝） | 侍剑骑兵 · 侍剑骑兵石像 | sky |
| **天帷巨兽** ||||||||||
| temple_outskirts 神殿外围 | 24~25 | 6 | GBL教大主教 `gblArchbishop` | archbishop | 143 | 0 | — | 杖击、圣光柱、圣光环、召信徒、大祭司护盾（房间） | GBL教主教 · 大祭司护盾 | forbidden |
| treant_jungle 树精丛林 | 25~26 | 6 | 巨树守护者 罗丁 `rodin` | rodin | 173 | 0 | — | 横扫、根须突刺、果实雨、混乱花 | 园丁鲁尔 | spine |
| purgatory 炼狱 | 26~27 | 7 | 夜叉王 `yakshaKing` | yakshaKing | 145 | 0 | — | 双斩、瞬斩、业火斩、震地咆哮（跳躲） | 夜叉 | spine |
| polar_day 极昼 | 27~28 | 7 | 多尼尔（EX） `donnierEX` | donnierEX | 125 | 0 | — | 炮击、地毯轰炸、激光扫射、追踪导弹、空投信徒 | 锯角撞车 | spine |
| second_spine 第二脊椎 | 28~30 | 7 | 长脚罗特斯 `lotus` | lotus | 175 | 0 | — | 触手横扫、触手连砸、喷墨、召小八爪、不挨打回血 | 巨型黑章鱼 · 前哨巨型黑章鱼 | spine forbidden |
| forbidden_land 天帷禁地 | 29~30 | 7 隐 | 审判者马塞尔 `marcel` | marcel | 140 | 0 | — | 三连飞刀、拔刀刺、震飞、血色护罩、复活教徒 | 复活的GBL主教 | forbidden |
| **暗精灵地区** ||||||||||
| shallow_haunt 浅栖之地 | 31~32 | 6 | 怨恨之摩根 `morgan` | deMorgan | 129 | 2 | groggy hazard | aoe buff shot summon swipe | 骸骨投掷兵 | darkelf |
| spider_cave 蜘蛛洞穴 | 32~33 | 7 | 艾克洛索 `ekloso` | deSpider* | 171 | 2 | groggy invuln | aoe dash shot summon swipe | 毒蜘蛛 | darkelf |
| darkelf_tomb 暗精灵墓地 | 33~34 | 6 | 邪龙斯皮兹 `spiz` | deSpiz | 156 | 2 | groggy safezone | aoe laser rain summon swipe | 岩石骷髅 | darkelf |
| lava_cave 熔岩穴 | 34~35 | 7 | 歌利亚 `goliath` | deGiant ⚠ | 180 | 2 | groggy hazard tether | aoe grab rain summon swipe | 油桶欧力克 |  |
| king_ruins 王的遗迹 | 35~36 | 4 隐 | 锤王波罗丁 `boroding` | deBoroding | 152 | 3 | element enrage groggy shield | aoe dash guard rain swipe | 光之沃德咯斯 |  |
| darkcity_gate 暗黑城入口 | 36~37 | 7 | 无头骑士 `headlessKnight` | deHeadless | 147 | 2 | clones groggy | blink dash seq swipe | 谨慎的仃高 · 前哨 hempley | darkelf |
| neipera 诺伊佩拉 | 38~38 | 4 | 狄瑞吉的幻影 `diregie` | deDiregie | 182 | 4 | enrage groggy hazard invuln safezone | aoe rain shot summon swipe | 吞灵者 · 前哨 brokenGoliath |  |
| **万年雪山** ||||||||||
| frozen_heart 冰心少年 | 36~37 | 6 | 查理 `charlie` | snCharlie | 161 | 2 | groggy shield | aoe shot summon swipe | 狂暴型玩具士兵 | snow |
| lik_well 利库天井 | 37~38 | 7 | 寒冰巨人利库 `lik` | deGiant* ⚠ | 195 | 2 | groggy hazard | aoe grab rain summon swipe | 哥布林投石车指挥官 | snow |
| ridge 山脊 | 38~39 | 6 | 野兽师鲁乌格 `ruug` | snBantu* | 133 | 2 | enrage groggy tether | buff shot summon swipe | 野蛮牛族勇士巴斯图鲁 · 前哨 bullEmuli |  |
| white_ruins 白色废墟 | 39~40 | 7 | 塞斯奇 `seski` | snYeti* | 217 | 2 | groggy safezone | aoe grab summon swipe | 雪崩拉比纳 | snow |
| bwanga_dojo 布万加的修炼场 | 40~41 | 4 隐 | 布万加 `bwanga` | snBwanga | 152 | 2 | enrage groggy safezone | aoe blink dash guard seq swipe | 班图精锐卫士 · 前哨 tulusElite |  |
| ice_palace 冰雪宫殿 | 41~42 | 7 | 冰雪女王洛丝 `rose` | snRose | 143 | 3 | clones groggy hazard tether | aoe blink laser shot swipe | 图卢斯族精英战士 | snow |
| skasa_nest 斯卡萨之巢 | 42~42 | 4 | 冰龙斯卡萨 `skasa` | snSkasa ⚠ | 210 | 4 | enrage groggy hazard invuln safezone | aoe laser rain summon swipe | 冰影阿奎利斯 |  |
| **诺斯玛尔 + 根特** ||||||||||
| fallen_bandits 堕落的盗贼 | 44~45 | 6 | 犬使魔震 `mozhen` | nmDogman* | 169 | 2 | groggy invuln | aoe buff dash rain summon swipe | 犬人哈多 · 前哨 shiningSaji | norsemar |
| hamelin 「迷乱之村」哈穆林 | 46~47 | 7 | 魔笛使者皮特 `piper` | nmPiper | 133 | 3 | clones enrage groggy invuln | aoe blink shot summon | 鼠头人西乌 · 前哨 rokusha | norsemar |
| gent_outskirts 根特外围 | 48~49 | 6 | 纵火犯本汀克 `bentink` | gtBentink | 138 | 2 | groggy hazard | aoe blink explode rain seq shot swipe | 炙炎魔团团员 | norsemar |
| gent_east 根特东门 | 49~50 | 7 | 机动队长苏雷德 `suleide` | gtSuleide | 143 | 2 | groggy hazard | aoe blink dash laser rain seq summon | 卡勒特强化先锋卫队 |  |
| gent_south 根特南门 | 51~52 | 4 | GT-9600 `gt9600` | gtMech | 210 | 3 | enrage groggy safezone shield | aoe dash rain summon swipe | 腐蚀弹头团团员 · 前哨 heavenCannon |  |
| **远古** ||||||||||
| bilmark 比尔马克帝国试验场 | 44~45 | 6 隐 | 牛头械王 `mechKing` | bmMechTau | 195 | 3 | groggy invuln | aoe dash rain swipe | 牛头统帅 · 6 房机关（伊凡 / 柱子 / 保护模式） |  |
| wailing_cave 悲鸣洞穴 | 49~50 | 6 隐 | 虫王戮蛊 `bugKing` | wcBugKing | 286 | 3 | groggy invuln | aoe rain shot summon swipe | 骷髅凯恩 · 6 房机关（法阵 / 幼虫吞噬） |  |
| **海上列车** ||||||||||
| sea_pirates 列车上的海贼 | 52~53 | 6 | 黑鳞莫贝尼 `mobeni` | trMobeni | 161 | 2 | groggy hazard | aoe blink seq shot summon swipe | 副船长鳄鱼 | train |
| west_line 夺回西部线 | 53~54 | 7 | 烈焰盾波迪尔 `podir` | trPodir | 156 | 2 | groggy hazard shield | aoe dash guard rain summon | 卡勒特盾卫 | train |
| heis 雾都赫伊斯 | 54~55 | 7 | 范·弗拉丁 `fladin` | trFladin | 151 | 3 | clones groggy safezone | aoe blink laser rain swipe | 狙击手艾丽格 · 前哨 pierre | train |
| arden 决战阿登高地 | 55~56 | 4 | 黎明之眼 安祖·塞弗 `anzu` | trAnzu | 174 | 3 | element enrage groggy safezone shield | blink dash laser rain seq summon swipe | 双枪哈斯 · 前哨 berner |  |
| **时空之门** ||||||||||
| grand_fire 格兰之火 | 55~56 | 6 | 兽王乌塔拉 `utara` | tgUtara | 170 | 3 | enrage groggy hazard invuln | aoe dash rain summon swipe | 焚烬的哥布林酋长 |  |
| plague_source 瘟疫之源 | 55~56 | 6 | 骷髅骑士 `skelKnight` | tgSkelKnight | 161 | 3 | groggy invuln safezone | aoe dash rain summon swipe | 染疫的无头骑士 |  |
| kartel_origin 卡勒特之初 | 56~57 | 6 | 沙影贝利特 `belit` | tgBelit | 146 | 3 | clones groggy hazard | aoe blink dash rain seq shot swipe | 沙漠骑手 |  |
| holy_war 暗黑圣战 | 56~57 | 6 | 尼尔巴斯·格拉西亚 `nilbas` | tgNilbas | 156 | 3 | groggy invuln safezone | aoe dash rain swipe | 混沌祭司 | timegate |
| secret_zone 绝密区域 | 57~58 | 6 | 地狱三头犬 `cerberus` | tgCerberus | 162 | 3 | groggy hazard shield | aoe dash seq summon swipe | 试验型战斗兵器 |  |
| old_wail 昔日悲鸣 | 57~58 | 7 | 凯恩 `kainPast` | wcKain* | 202 | 3 | groggy hazard invuln safezone | aoe blink dash seq summon swipe | 噩梦中的剑士 | timegate |
| old_winter 凛冬 | 58~59 | 7 | 年轻的斯卡萨 `youngSkasa` | snSkasa* ⚠ | 132 | 3 | groggy hazard safezone shield | aoe dash rain swipe | 冰原巨猿 | timegate |
| iris_raid 谜之觉悟 | 58~59 | 4 | 吟游诗人艾丽丝 `irisBard` | tgIris | 166 | 3 | clones enrage groggy invuln safezone | aoe blink laser rain shot summon | 过去的回响 · 前哨 riftKeeper |  |
| **魔界 · 希洛克** ||||||||||
| law_gate 法则之门 | 60~61 | 6 | 奈克斯 `nex` | nex | 140 | 2 | groggy shield | aoe rain shot summon swipe | 碎颅狱卒 | siroco |
| wit_gate 知性之门 | 60~61 | 7 | 暗杀者 `assassin` | assassin | 129 | 2 | clones enrage groggy | aoe blink dash seq shot swipe | 灵魂拘束者 | siroco |
| pain_gate 痛苦之门 | 60~61 | 7 | 守门人 `gatekeeper` | gatekeeper | 152 | 2 | element groggy safezone | aoe guard laser swipe | 魔界猎犬 | siroco |
| siroco_coffin 无形棺柩 | 61~62 | 4 | 潜行者 希洛克 `siroco` | siroco | 189 | 4 | clones enrage groggy hazard invuln safezone tether | aoe blink laser rain seq shot swipe | 碎颅狱卒 |  |

深渊共 10 个，每个 5 房。领主房是原图领主，另外还会降临一个随机的“深渊领主”：

| 深渊 | Lv | 领主房 | 深渊领主池 | 降临时的机制 | 循环机制 |
|---|---|---|---|---|---|
| abyss_gf 格兰之森深渊 | 16~19 | 盗尸者 骨狱息 | boneLord flameMage tauKing catKing | groggy | safezone |
| abyss_sky 天空之城深渊 | 23~26 | 罪恶之眼 | sinEye seghart skyExpeller platani | groggy | shield safezone |
| abyss_spine 第二脊椎深渊 | 29~30 | 长脚罗特斯 | lotus yakshaKing donnierEX rodin | groggy enrage | hazard safezone |
| abyss_forbidden 天帷禁地深渊 | 30~30 | 审判者马塞尔 | marcel lotus gblArchbishop | groggy enrage | hazard shield |
| abyss_darkelf 暗黑城深渊 | 37~38 | 无头骑士 | morgan ekloso spiz headlessKnight | enrage | shield safezone |
| abyss_snow 万年雪山深渊 | 41~42 | 冰雪女王洛丝 | charlie lik seski rose | enrage | hazard safezone |
| abyss_norsemar 诺斯玛尔深渊 | 47~48 | 魔笛使者皮特 | mozhen piper bentink | enrage | shield safezone |
| abyss_train 海上列车深渊 | 55~56 | 范·弗拉丁 | mobeni podir fladin | enrage | shield safezone |
| abyss_timegate 时空之门深渊 | 58~59 | 凯恩 | kainPast youngSkasa nilbas | enrage | shield safezone |
| abyss_siroco 魔界深渊 | 60~61 | 奈克斯 | nex assassin gatekeeper | enrage | hazard safezone |

## 2. 官方对照 + 每个领主的目标

官方资料由 3 个调研子智能体用 curl 查询（来源代号见表后）。“近似”表示凭推断或只有弱来源。
“目标招牌”是本作要做的样子：尽量贴官方，查不到的写“本作设计”。原语见 §3.2，美术规则见 §3.3。

### 格兰之森

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| lorien | 投掷哥布林 · 小型绿皮哥布林，持石 | 只有投石普攻（新手图）。房间：全是哥布林 | 部分 | 投石三连（落点圈）；召唤投掷哥布林小队（已有） | kit | keep | SIMPLE · B1 | 近似 · 17173GF, BAIKE |
| lorien_deep | 牛头兵 · 中型牛头人，持斧 | 霸体斧击；近战普攻。房间：哥布林、投掷哥布林 | 部分 | 霸体斧击；冲撞撞墙自己眩晕 2 秒（反击窗口） | dash.wallStun kit | keep | SIMPLE · B1 | 近似 · 17173GF |
| dark_woods | 牛头巨兽 · 巨型牛头人，体型是牛头兵三倍 | 眩晕咆哮；锤击 + 冲击波；起身冲击波；出招慢。房间：牛头兵（霸体角撞）、十夫长 | 一致 | 锤击冲击波（贴地扩散，跳起躲）；起身冲击波；眩晕咆哮 | trait.onGetup kit | recolor+scale 1.6 | SIMPLE · B1 | 确认 · 17173GF-2, DFO:Mirkwood |
| dark_woods_deep | 库罗猫妖 Kurogaru · 黑色猫妖，敏捷 | 2 段爪 + 跳跃爪；飞扑抓咬（连按挣脱）；咬中后自身属性提升。房间：猫妖、投掷十夫长 | 不同（暗咒猫妖 → 库罗猫妖） | 飞扑抓咬：被抓连按挣脱；咬中后自身加速加攻（可见光环） | grab.mash kit | recolor（黑猫，和毒猫王拉开） | SIMPLE · B1 | 确认 · 17173GF-3, QQBOOK |
| thunder_ruins | 落雷 凯诺 · 白皮老哥布林，持光剑 | 黄圈落雷；直线 6 连雷；圆形 10 连雷；身周雷圈；命令哥布林自爆。房间：牛头前锋、希罗猫妖（群体治疗） | 一致 | 直线 6 连雷（留一条纵深安全）；圆形 10 连雷；身周雷圈；命令哥布林自爆 | lanes kit | keep | SIMPLE · B1 | 确认 · 17173GF-4, DFO:Thunderland |
| venom_ruins | 毒猫王 Penril · 暗紫毒气缠身的大猫妖 | 带毒冲刺 2 连爪；暗属性跳爪；受击几率喷毒雾；半血后攻速移速上升。房间：猫妖、库罗猫妖 | 一致 | 受击喷毒雾（地面残留）；半血狂暴加速 | pool kit | keep | SIMPLE · B1 | 确认 · 17173GF-5, DFO:Poison_Thunderland |
| frozen_woods | 冰霜 克拉赫 Keraha · 浮空蓝装女法师，持杖（彼诺修的妹妹） | 黄圈冰柱落地，冰柱残留可打碎；4 连冰柱 / 四方冰柱；召唤哥布林突击兵；低血冰气加速，受击冰冻。房间：牛头护卫（绝对防御）、园丁鲁尔 | 一致 | 冰柱落地后残留成障碍（可打碎）；四方冰柱；低血冰气：近身冻结 | plant stance kit | recolor（姐妹同模）+ 浮空；现图是哥布林法师，官方是女法师，可选重画 | SIMPLE · B1 | 确认 · 17173GF-6, DFO:Mirkwood_Frost |
| graca | 牛头王 萨乌塔 · 最大的牛头王，持巨斧 | 霸体斧击；低头突进（出血）；蓄力斧 + 半屏冲击波；会格挡。房间：牛头全家 | 一致 | 蓄力斧：破招窗口（打够伤害打断→破招）；低头突进；格挡反击 | stagger kit | keep | SIMPLE · B1 | 确认 · 17173GF-7, DFO:Grakqarak |
| blazing_graca | 烈焰 彼诺修 Binoche · 浮空红装女法师 | 六芒星预警斜飞陨石；升空召 2 颗陨石；召哥布林突击兵；身缠火焰，近身灼伤。房间：同格拉卡，哥布林更多 | 一致 | 升空阶段：浮空不可近战 + 陨石；火焰光环：贴身持续灼伤 | form(fly) kit | keep | SIMPLE · B1 | 确认 · 17173GF-8, DFO:Blazing_Grakqarak |
| dark_thunder | 盗尸者 骨狱昔 Ghoulguish · 僵尸王，周身冰气 | 常驻冰气光环（约 10 秒一次范围冰冻并加伤）；出血高速啃咬。房间：丛林 / 饥饿僵尸（暗球致盲） | 部分（昔 / 息）（骨狱息 → 骨狱昔） | 每 10 秒冰气爆发（范围冰冻，预警 1.2 秒）；出血啃咬吸血 | kit | keep | SIMPLE · B1 | 确认 · 17173GF-9, DFO:Shadow_Thunderland |

### 天空之城

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| dragon_tower | 鲁卡斯 Lakius · 龙人蜥蜴，持长矛，电光缠身 | 蓄力突刺（按最大 HP 扣 30%~80%）；起身放电圈；笼子困人；低血分身。房间：龙人、冰人偶师杜莎 | 一致 | 蓄力突刺：长预警、按最大 HP 结算（躲不开就残血）；笼子 + 放电；低血分身（已有） | dash.frac kit | keep | SIMPLE · B2 | 确认 · DFO:Lakius, 17173SKY-5 |
| puppet_hall | 人偶之王 道格里 · 绿皮操偶师 | 脚下绿圈落“天空果实”；霸体混乱抓取（只能被抓取技能破）；红光预警爆炸石柱。房间：五职业石像、各色人偶师 | 一致 | 天空果实（绿圈落地爆）；提线抓取：霸体只怕抓取技 | trait.grabOnly kit | keep | SIMPLE · B2 | 确认 · DFO:Puppet_Museum, 52PK |
| golem_tower | 黄金巨人 普拉塔尼 · 金色巨人，移速快 | 不浮空不倒地、投掷无效；冲撞；落 3 块岩石；残血霸体；几率反射远程。房间：铜 / 泥 / 石巨人、傀儡师 | 部分 | 连续冲撞 + 过热（已有）；落 3 块岩石；反射远程（护罩亮起时） | trait.reflectRanged kit | keep | SIMPLE · B2 | 确认 · 17173SKY-6, DFO:Golem_Tower |
| dark_corridor | 天之驱逐者（电骑士） · 伪装成空铠甲的骑士 | 伪装铠甲（打出 1 伤害的就是它）；霸体雷电挥剑；高速多段突刺；1~3 方向 6 连雷。房间：驱逐者、伪装盔甲 | 一致 | 伪装：领主混进空铠甲里，打中显示 1 的是真身；落雷列（已有） | clones.disguise kit | keep | SIMPLE · B2 | 确认 · 17173SKY-4, DFO:Vestibule_of_Darkness |
| lord_palace | 光之城主 赛格哈特 · 长发光属性骑士 | 甩发 + 光圈；全房激光；周身雷电密布；血低张屏障，提升移速防御。房间：前几图杂兵大集合 | 一致 | 低血光之屏障（护盾 + 加速）；雷电密布 / 激光（已有） | stance kit | keep | SIMPLE · B2 | 确认 · 17173SKY-7, DFO:Castellan's_Chamber |
| floating_castle | 罪恶之眼（左眼 / 右眼） · 两只巨眼，固定不动 | 霸体冲击波；石化激光；跟踪激光 / 9 连追踪；黑暗投掷。房间：彼诺修、克拉赫当精英 | 部分 | 左右双眼同场（各自血条，一只倒下另一只狂暴）；石化激光 + 眼球列（已有） | duo trait.rooted kit | mirror 一只（hue） | COMPLEX · B2 | 确认 · DFO:Floating_Castle, 52PK |

### 天帷巨兽

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| temple_outskirts | GBL教大主教 + GBL教大祭司（双领主） · GBL 教士，长袍 | 大主教落雷感电；召雷沃斯（闪现背后眩晕）；大祭司召瑟冥特克。房间：信徒（自杀召章鱼）、龙头炮 | 部分 | 双领主各自血条（现在大祭司只是保护者）；雷沃斯：闪到背后眩晕 | duo kit | keep | SIMPLE · B3 | 近似 · 17173BH-2, DFO:Outer_Temple_Wall |
| treant_jungle | 巨树守护者 罗丁 · 黑色巨树精 | 扎根后一排木刺（只能大跳躲）；霸体喷种子（失明）；打背后可打断。房间：树精、藤蔓草地（站 3 秒缠身） | 一致 | 扎根木刺列（跳起躲）；扇形喷种子致盲；打背后打断大招 | cone trait.back kit | keep | SIMPLE · B3 | 确认 · 17173BH-3, DFO:Dendroid_Jungle |
| purgatory | 夜叉王（后期版本为 Master Hunter） · 黑色狼人首领 | 霸体流血爪；直线 / 扇形喷毒；高跳践踏 + 冲击波；起身龙之吼击倒；血低加速。房间：祭坛 + 花瓶隔断 | 一致 | 高跳践踏（跟随落点）；扇形喷毒；起身龙之吼 | leap cone trait.onGetup kit | keep | SIMPLE · B3 | 确认 · 17173BH-4, DFO:Purgatorium |
| polar_day | 多尼尔 EX（空艇之王） · 黑色大炮艇，悬浮 | 霸体压地前冲；前后双机枪；不断扔 GBL 信徒（自爆）。房间：小空艇、龙头炮、锯角撞车 | 部分 | 前后双机枪（两侧同时扫）；空投自爆信徒（已有） | lanes kit | keep | SIMPLE · B3 | 确认 · 17173BH-5, DFO:Silver_Night |
| second_spine | 长脚罗特斯（第八使徒） · 藏在建筑里，只露触手 | 长脚刺（2/3 屏）；横扫一条直线；天花板伸脚刺 / 卷住（黄圈）；震落石块夹章鱼。房间：蓝章鱼、章鱼蛋（黏液） | 一致 | 天花板触手卷住（黄圈后抓取）；震落石块夹小章鱼 | kit | keep | SIMPLE · B3 | 确认 · 17173BH-7, DFO:Second_Spine |
| forbidden_land | 审判者 马塞尔 · GBL 教高阶暗杀首领，持匕首 | 常驻霸体（仅抓取有效）；黑烟；三连扩散飞刀；屏障；召不死主教；起身击退光环。房间：不死 GBL 教徒 | 一致 | 全程霸体：只有抓取技能能打出硬直；黑烟致盲区；起身击退光环 | trait.grabOnly pool trait.onGetup kit | keep | SIMPLE · B3 | 确认 · DFO:Arbitrator_Marcellus |

### 暗精灵地区

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| shallow_haunt | 怨恨之摩根 · 暗精灵亡灵，灰紫色 | 死亡诅咒：头顶骷髅标记，1.5 秒后半屏一击（跳起 / 走开躲）；连扔 3 个骷髅头，数秒后爆炸；起身震击；被背击喷毒雾。房间：盗尸者、骸骨投掷兵钻地 | 一致 | 死亡诅咒标记；骷髅头炸弹（可打掉）；背击喷毒雾 | mark plant trait.back | keep + sig | SIMPLE · B4 | 确认 · HK66 |
| spider_cave | 艾克洛索 · 巨型蜘蛛，污绿色 | 蜘蛛导弹（跳起躲）；喷网 3 连（束缚）；升天后追踪落下（黄圈 + 电流）；弹珠式连续弹射；召唤小蜘蛛。房间：冤魂远程蝙蝠；小蜘蛛贴地抓人 | 一致 | 升天追踪落下（带电圈）；弹珠弹射冲撞；喷网束缚 3 连 | leap dash.bounce | keep（体型 1.9 已和小蜘蛛拉开）+ sig | SIMPLE · B4 | 确认 · HK68 |
| darkelf_tomb | 邪龙斯皮兹的头部 · 骨龙巨首，囚在小室 | 吐“邪龙的牺牲者”追人自爆；嘴边毒雾（黄圈，持续伤害）；铁链成排；吼叫眩晕。房间：五巨头（绿名精英）、吞灵者 | 部分（邪龙斯皮兹 →（可选）邪龙斯皮兹的头部） | 固定不动（锁链缚住的龙首）；牺牲者：追人自爆的小怪；毒雾残留 | trait.rooted pool | keep（加锁链场景物）+ sig | SIMPLE · B4 | 确认 · HK69, 52PK |
| lava_cave | 歌利亚 / 泰坦 / 阿特拉斯（三兄弟） · 火红石巨人 | 歌利亚火属性，低血召吞灵者 / 亚德炎；泰坦眩晕，低血霸体并驱散增益；阿特拉斯撒网束缚、减速，低血暴走；三兄弟最终同场。房间：三兄弟先在不同房间露面；岩浆地面灼伤 | 部分 | 三兄弟同场（三条血条，倒一个其余狂暴）；泰坦驱散 / 阿特拉斯撒网；岩浆地砖 | duo arena.tiles | recolor ×3（官方同模三兄弟） | COMPLEX · B4 | 确认 · HK67 |
| king_ruins | 不灭之王 波罗丁 · 持锤王者，亡灵铠甲 | 移动快，眩晕连击；三连震（跳起躲）。房间：五骑士依次：风（隐身）、守护（红反物理 / 蓝反魔法）、冰（地面冰刀冻结）、炎（受击叠炸弹，满 6 爆）、光（全屏闪电 + 5 小弟） | 部分（锤王波罗丁 → 不灭之王 波罗丁） | 五骑士车轮战（每人一个招牌）；三连震（跳起躲） | gauntlet stance trait.stacks pool | recolor ×5（deElf） | COMPLEX · B4 | 确认 · HK72 |
| darkcity_gate | 无头骑士 · 骑黑色梦魇的无头骑士 | 全程霸体不浮空；召唤 4 只影之梦魇直线奔走；冲撞把人顶到墙边多段；低血满图狂奔回血，濒死数秒无敌。房间：仃高（盾挡 90%，抓技可破）、亨普利 | 一致 | 梦魇奔袭（纵深分道，留缺口）；顶墙冲撞；低血狂奔回血（输出检查） | lanes dash.carry stance | NEW（骑马轮廓；现在的步战骑士图给瘟疫之源精英用） | COMPLEX · B4 | 确认 · HK70 |
| neipera | 狄瑞吉的幻影 · 狄瑞吉邪念所化，流体 | 流动身体多种强攻；低血分裂。房间：搜捕团祭司（互射虚无球计数）、伪装者（靠祭司复活） | 一致 | 低血分裂成 3 团（共享击杀）；祭司双人：互相复活 | split duo | keep + sig | COMPLEX · B4 | 确认 · HK73 |

### 万年雪山

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| frozen_heart | 查理 · 冰巨人，身边有玩具士兵（外形近似） | 发射拳头；霸体冲撞；空中降冰块；召唤玩具士兵。房间：保护查理的心脏；坚硬玩具只受 1 点伤害 | 一致 | 火箭拳；坚硬玩具（固定 6 下打碎）；保护心脏：玩具摸到心脏 → 查理回血 | trait.hitHp protect | keep + sig | SIMPLE · B5 | 确认 · HK57 |
| lik_well | 寒冰巨人 利库 · 冰蓝石巨人，似黄金巨人 | 向前霸体抓取；霜之新星（冻结身边）；前冲（中距离最危险）；不断召唤石头怪。房间：冰哥布林驾驶的投冰车（杀操作者毁车） | 一致 | 霜之新星冻结；霸体抓取；投冰车（有操作员的物件） | plant stagger | NEW（样板 S2：冰晶石巨人，和歌利亚彻底分开） | COMPLEX · P0.5 | 确认 · HK59, NEWTON |
| ridge | 野兽师鲁乌格 + 冰齿沙凡特（双领主） · 班图驯兽师 + 白色雪虎 | 上勾拳、召寒冰虎、加攻速；沙凡特出血飞跃、爪击突进；两者被远程打都会霸体。房间：雪崩拉比纳 | 一致 | 人虎双领主（两条血条）；被远程打就霸体（逼近战）；沙凡特出血飞跃 | duo trait.saVsRanged leap | keep（沙凡特已有 snTiger） | SIMPLE · B5 | 确认 · HK58 |
| white_ruins | 赛斯奇 · 巨型雪魈，白毛 | 近身抓到头顶狂扁；双掌震地，直线长距离雪波；召唤小雪魈；血量很多。房间：修罗 APC、雪球噜噜伊、库尼图腾（红 / 蓝） | 一致 | 头顶狂扁抓取；沿纵深推进的雪波；库尼图腾（房间物件） | lanes plant | keep + sig | SIMPLE · B5 | 确认 · HK60 |
| bwanga_dojo | 班图族长 布万加 · 高大班图族长，持族长图腾 | 挥图腾眩晕击退；消失后背后击飞；起跳 2 秒后砸地（跳起躲）；长霸体。房间：四勇士：马拉加（冰块）、莱里特拉里（旋风）、美杜莎莎（石化）、霍克伊（召鸟） | 一致 | 四勇士车轮战；起跳砸地（跳起躲）；背后突现击飞 | gauntlet leap facing | recolor ×4（snBantu）+ 新场景 | COMPLEX · B5 | 确认 · HK63, NEWTON |
| ice_palace | 冰雪女王 洛丝 · 雪花少女，与冰晶王座融为一体 | 冰魔法；坐在王座上指挥；不能移动。房间：雷剑克鲁斯（APC）、五宫女（混乱 / 召唤 / 回复加速 / 踢 / 击飞）、洛丝的壁钟 | 一致 | 王座固定 + 五宫女（先杀回复的）；壁钟：钟响时躲到王座后；克鲁斯连线（已有） | trait.rooted gauntlet form | NEW 形态（王座上的洛丝） | COMPLEX · B5 | 确认（本体技能资料少） · HK61 |
| skasa_nest | 冰龙斯卡萨 · 巨大冰龙，蓝白 | 前爪拍地（跳起躲）；极寒龙息（多段）；吹气眩晕；龙蛋孵出幼龙。房间：图卢斯精英、寒冰潜伏者 | 一致 | 扇形龙息 + 破招窗口；龙蛋（不打掉就孵化）；起飞阶段：空中冰雨后落地；吹气（推开 + 眩晕） | cone stagger plant form(fly) pull | keep + sig | COMPLEX · P0.5 | 确认（细节近似） · HK62 |

### 诺斯玛尔 + 根特

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| fallen_bandits | 犬使 摩震 · 戴面具的犬使忍者 | 近战 + 3 向飞刀；替身草人（被打时换位并召猎犬）；猎犬群突击；让一件防具暂时失效。房间：市政厅召盗贼、闪灵萨吉 | 部分（魔 / 摩）（犬使魔震 → 犬使摩震） | 替身术：挨重击留草人闪走；猎犬群分道突击；破甲（防御下降） | trait.substitute lanes | keep（精英 dogmanHado 改色拉开）+ sig | SIMPLE · B6 | 确认 · HK64 |
| hamelin | 魔笛使者 皮特 · 吹笛小丑，身边鼠群 | 笛攻击；粉色蛾状物；倒数攻击；头顶音符橙 / 蓝切模式（蓝色带混乱并清召唤物）。房间：食人鼠、疯狂盗贼 | 一致 | 橙 / 蓝音符双模式；倒数攻击（头顶 3-2-1）；蛾群追踪 | stance mark | keep + sig | SIMPLE · B6 | 确认 · HK65 |
| gent_outskirts | 纵火犯 本汀克 · 防火服 + 喷火器 | 移动时滴汽油；汽油瓶 + 轰爆弹：油着火连环爆；喷火器吐息。房间：卡勒特各兵种 | 一致 | 汽油轨迹 + 点燃连爆；喷火器扇形 | pool.ignite cone | keep + sig | SIMPLE · B6 | 近似 · 9GAME, 233 |
| gent_east | 机动队长 苏雷德 · 骑摩托的卡勒特队长 | 前冲 / 旋转摩托；竖前轮转轮（会跳）；激光和火箭；召 RX-78。房间：暴风雷兄弟 APC、TMH 空投 | 一致 | 旋转摩托冲撞；竖轮跳砸；火箭齐射 | dash.spin leap | keep + sig | SIMPLE · B6 | 确认 · ZL-dongmen |
| gent_south | GT-9600 · 卡勒特战斗机甲 | 移动模式：前冲、四周乱射、导弹、冲击波；防御模式：大幅加防，锁定目标投量子爆弹，掀机体砸人。房间：先锋队长巴希克、巨枪多里安、天堂炮、掩体 | 一致 | 移动 / 防御双模式；量子爆弹锁定（跑开） | stance mark | keep + sig | SIMPLE · B6 | 确认 · ZL-nanmen |

### 远古

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| bilmark | 牛头械王 · 机械改造牛头人，持斧 | 喷火眩晕接斧劈；扇形三道闪电；击飞抛掷；护盾无敌 + 3 机器人（不杀变牛头统帅）。房间：伊凡房、牛头统帅房、哈尼克房 | 一致 | 喷火眩晕 → 斧劈（连招）；抓取抛掷；保护模式（已有） | cone | keep + sig | SIMPLE · B7 | 确认 · 233 |
| wailing_cave | 虫王 戮蛊 · 巨型白虫 | 钻地突袭，出土旋转骨刺并反弹远程；粘液炸弹；吐幼虫 / 吞幼虫回血。房间：布法罗队长、阿波菲斯、骷髅凯恩、20 只幼虫房 | 一致 | 出土骨刺风暴：反弹远程；粘液残留 | trait.reflectRanged pool | keep + sig | SIMPLE · B7 | 近似（房间顺序） · SKYIBIS |

### 海上列车

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| sea_pirates | 黑鳞莫贝尼 · 鱼人系海盗船长（外形近似） | 召鳄鱼鸟；插鳄鱼柱：被掐住不能动，过段时间爆炸；多段旋转斩；大跳；不吃冰冻。房间：美人鱼、炮弹海龟；空空伊 10% 替换领主 | 一致 | 鳄鱼柱（定身 + 定时爆，可打掉）；大跳；空空伊：10% 换成稀有领主 | plant leap bossAlt | keep + sig | SIMPLE · B8 | 确认 · GB:liechehaizei, DFO |
| west_line | 烈焰盾 波迪尔 · 火焰海龟 / 厚壳（外形近似） | 火加速：无敌加速冲撞；瞬移后火扇风多段；全屏击飞加眩晕。房间：独眼夏娜、蓝影马萨乔（冰分身） | 一致 | 火加速（无敌冲撞，只能躲）；瞬移火扇；全屏重拳（跳起躲） | stance cone | keep + sig | SIMPLE · B8 | 确认（外形近似） · GB:xibuxian, DFO |
| heis | 范·弗拉丁 · 卡勒特干部，机车帮头目 | 散弹枪；无线电叫暴走族扔炸弹；定时炸弹；乱射（高伤）。房间：派普·乔（打掉舵轮才死）、狙击手艾丽格（红瞄准镜，躲砖堆）、兜风皮埃尔；雾 | 一致 | 浓雾视野；狙击红点：躲到掩体后；暴走族分道飞车扔炸弹；定时炸弹 | arena.fog arena.cover mark lanes | keep + sig | COMPLEX · B8 | 确认 · GB:heiz, 17173, DFO |
| arden | 黎明之眼 安祖·赛弗 · 人类步枪手，后变机械形态 | 枪托挑飞后扫射；霸体斜线突进；低血变身机械（变身无敌）：火箭感电、磁场黑洞 + 全图落雷、导弹。房间：双枪哈斯、告密者特雷克（地雷束缚） | 一致（塞 / 赛）（安祖·塞弗 → 安祖·赛弗） | 低血变身机械形态；磁场黑洞吸人 + 全图落雷；斜线突进 | form pull | NEW 形态（机械安祖） | COMPLEX · B8 | 确认 · GB:aldan, DFO |

### 时空之门

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| grand_fire | 兽王 乌塔拉 · 巨型有角兽人，红棕 | 咆哮把人吹向火堆；抛投眩晕；地锤 3~4 下全图；爆炸（打断也会炸）。房间：纵火犯（火瓶空中打掉不燃） | 一致 | 咆哮吹人：推向火堆；三连地锤（跳起躲）；必炸的蓄力爆炸（只能跑远） | pull plant stagger | keep + sig | SIMPLE · B9 | 确认（没查到“灭火”机制） · GB:huozai, DFO:The_Great_Blaze |
| plague_source | 骷髅骑士 · 披甲骷髅持枪，暗紫 | 枪矛旋转（出血击飞）+ 召小怪；突进；暴走：黑暗闪电、地面蓝色残骸、降抗减速气场。房间：重做后：小怪死留毒潭，2 分 30 秒内找针管解毒 | 一致 | 瘟疫倒计时：捡针管解毒；旋转枪矛；地面残骸 | debuff dash.spin pool | keep + sig | COMPLEX · B9 | 确认 · GB:chuanranbing, DFO:Epidemic |
| kartel_origin | 年轻的沙影 贝利特 · 西部牛仔枪手，沙黄 | 旋风（可叠加、诱导）；爆头 + 肘击；抛沙；低血沙暴：沙中隐身 / 无敌。房间：岩石不断生成沙暴和沙坑，毁掉两块岩石禁用沙暴 | 部分（沙影贝利特 → 年轻的沙影 贝利特） | 沙暴隐身（打掉两块岩石才停）；追踪旋风；爆头狙击 | stance plant mark | keep + sig | SIMPLE · B9 | 确认 · GB:juecheng, DFO |
| holy_war | 尼尔巴斯·格拉西亚 · 堕落女牧师，黑色 | 地雷阵（X 轴爆炸浮空）；处刑：用大招时被处死；暴走龙吼霸体。房间：护送 4 个牧师到第七房，沙皮罗助战；被污染灵魂碰到即死 | 一致 | 护送牧师（到了领主房就助战）；地雷阵；处刑：发光时别放大招 | protect lanes stance | keep + sig | COMPLEX · B9 | 确认 · GB:heise, DFO:Black_Crusade |
| secret_zone | 地狱三头犬 Cerberus · 三头犬，黑红，大型 | 霸体突进；出血咬；注视者之眼：站着不动持续掉血；召唤角壳。房间：领主房左侧笼子到时放出大量哈尼克 | 一致（中文名未核实） | 注视者之眼：必须一直跑；定时笼子（提前打坏）；三连扑咬 | mark.move plant | keep + sig | SIMPLE · B9 | 确认 · GB:jimi, DFO |
| old_wail | 凯恩 Kane · 人类剑客刺客 | 飞刀；2 个幻影分身直线冲击；欲望的沼泽；频繁瞬移、蓝色减速气场；低血必杀连斩。房间：异界之风：强制向左漂移 | 一致 | 异界之风（场地推力）；幻影直线冲击；欲望沼泽 | arena.wind lanes pool | recolor（同一个凯恩，可接受）+ sig | SIMPLE · B9 | 确认 · GB:old_beiming, DFO |
| old_winter | 年轻的斯卡萨 · 冰蓝巨龙（年轻） | 三次全图锤击；地面龙息扫整条 X 轴并留冰晶阵；空中龙息（有盲区，几乎必死）；免疫眩晕冰冻。房间：希斯玛、斯皮拉齐幼龙 | 一致 | 地面龙息扫一整条纵深 + 冰晶；空中龙息：只有龙身下是安全区；三连锤击 | lanes plant form(fly) | recolor + 缩小 + 新场景 | SIMPLE · B9 | 确认 · GB:lindong, DFO:Naissance |
| iris_raid | 吟游诗人 艾丽丝 · 少女歌者，人偶乐团 | 支配协奏曲：复活木偶；木偶全灭则领主大受伤（此时无敌）；水龙 / 火怪 / 雷鸣三首歌。房间：玩具士兵、混沌心魔（变身成玩家） | 一致 | 木偶乐团：全灭才破无敌，会复活；三首歌（换招 + 颜色） | gauntlet stance | keep + sig | SIMPLE · B9 | 确认 · GB:juewu, DFO |

### 魔界 · 希洛克

| 图 | 官方领主 · 外形 | 官方招牌机制 · 房间 | 名字 | 目标招牌（≥2） | 原语 | 美术 | 级别 · 块 | 可信度 · 来源 |
|---|---|---|---|---|---|---|---|---|
| law_gate | 遗忘姓名的守门人 · 人形守卫（外形近似） | 领主吸收 1~4 个紫球，数量决定击杀顺序。房间：四门同开 | 不同（官方是守门人）（奈克斯 → 守门人（和痛苦之门对调）） | 紫球计数：按顺序打倒 / 打碎 | order | 换领主：用 gatekeeper 图 | COMPLEX · B10 | 机制确认 · QQNEWS, 163, NAMU |
| wit_gate | 魅惑之哈妮尔 等 · （未查到） | 四个副本连锁，通关一个会重置 / 强化另一个；降防、致盲、召怪。 | 不同（暗杀者 → 魅惑之哈妮尔（近似）） | 魅惑（混乱）；连锁强化：精英活着领主变强 | stance | keep（改名，外形近似） | SIMPLE · B10 | 近似 · 163, NAMU |
| pain_gate | 公义之奈克斯 + 慈悲之维塔 · 奈克斯黑、维塔白（推断） | 苏醒之路：强制读条才解除无敌；黑门移动地板 / 白门断层地板；死亡试炼：头顶掉球 + 20 秒读条。房间：走位失败重置 | 不同（守门人 → 奈克斯 & 维塔） | 黑白双领主；移动地板 / 断层地板；头顶掉球（接住） | duo arena.tiles mark | 奈克斯 + 维塔（nex 白色换色） | COMPLEX · B10 | 机制确认，外形近似 · QQNEWS, 163, NAMU |
| siroco_coffin | 潜行者 希洛克（拉维切 / 莱斯特 / 吉里） · 无定形能量体；吉里可化动物 | 拉维切：左右次元，进紫色残影侧安全；精神支配；莱斯特：频繁无敌；吉里：化蛇后灵魂出窍；唤醒卢克西后希洛克虚弱 25 秒。房间：三个意识之棺血量共享 | 一致 | 三形态轮换（拉维切 / 莱斯特 / 吉里）；次元左右分边；凝视 / 卢克西（已有） | form arena.tiles | form ×2（换色 + 缩放；吉里动物形态可选新图） | COMPLEX · B10 | 机制确认，外形近似 · QQNEWS, 17173, DFO:Sirocco |

**来源代号**
- DFO：`wiki.dfo.world/view/<页面>`
- 17173GF / 17173SKY / 17173BH：`dnf.17173.com/ditu/{maer,xihaian,jushou},N.shtml`，国服早期怪物表，采信度最高；天空之城的地名是按领主推断对上的
- HK<n>：`dnf.hk.cn/oiw/dungeons/<n>.html`（怀旧服资料库）
- GB:<slug>：`dnf.gamebogam.com/monster/<slug>.asp`（国服怪物数据站）
- ZL-dongmen / nanmen：`m.dnfziliao.com/monster/<>.asp`
- 52PK：`dnf.52pk.com/zl/732006.shtml`、`/737828.shtml`、`/737850.shtml`
- 233：`233leyuan.com/post-detail/1965297869155551938` 等
- QQBOOK：`dnf.qq.com/book2011/gdc/10023/10036/43.shtml`
- QQNEWS：`news.qq.com/rain/a/20200930A05S8C00`
- 163：`163.com/dy/article/FNB1018305462LLY.html`
- NAMU：namu.wiki「무형의 시로코 레이드」
- NEWTON：newton.com.tw 百科
- 9GAME：9game 4576531
- SKYIBIS：悲鸣洞穴手游攻略
- BAIKE：`baike.baidu.com/item/洛兰`
- 深渊派对：`dnf.qq.com/act/chapter5/party.htm`

**已经和官方对上的**
- 天空之城和天帷巨兽：落雷留缝、石化眼球、普拉塔尼过热、触手、马塞尔护罩、大主教和大祭司的保护关系。
- 远古两张：牛头械王的保护模式和机器人变牛头统帅；虫王的钻地、吞幼虫、幼虫互吞。
- 希洛克的凝视和卢克西。
- 名字：59 个领主里 43 个一致、12 个部分一致（差一个字或少了“年轻的”“EX”这类前后缀）、4 个不同（库罗猫妖和希洛克三门）。

**差距最大的**
- 31~60 级多数领主是通用套路，缺官方的招牌：
  - 多领主：熔岩穴三兄弟、山脊人虎、神殿外围双主教、悬空城双眼、苦难之境黑白双领主。
  - 车轮战：王的遗迹五骑士、布万加四勇士、冰雪宫殿五宫女、艾丽丝木偶。
  - 形态：安祖变身机械、斯卡萨起飞。
  - 场地：赫伊斯的雾和掩体、昔日悲鸣的异界之风、瘟疫针管、护送牧师、投冰车、鳄鱼柱、笼子。

**要改名的**
- 暗咒猫妖 → 库罗猫妖
- 骨狱息 → 骨狱昔
- 锤王波罗丁 → 不灭之王 波罗丁
- 犬使魔震 → 犬使摩震
- 安祖·塞弗 → 安祖·赛弗
- 沙影贝利特 → 年轻的沙影 贝利特
- 可选：邪龙斯皮兹 → 邪龙斯皮兹的头部
- 希洛克四门对调，见 D1

**查不到的**
- 格兰之火的“灭火”：官方资料里没有，不做。
- 雾都赫伊斯的雾：只知道是地图主题，按本作设计做成视野雾。
- 希洛克知性之境：领主机制不详。
- 查理和波迪尔的外形：属于近似，沿用现有图。

**深渊（官方）**：官方的深渊派对不是每张图固定一个领主，而是随机出高难度怪物或 APC，按等级和地区决定出什么。60 版以前的旧深渊才是“地区对应固定深渊领主”。

## 3. 哪些能配置、哪些要写代码、哪些要出图

### 3.1 现在就能纯配置的（区域 spec）
| 能改的 | 写在哪 | 说明 |
|---|---|---|
| 招式：13 个技能库技能 + 参数 | spec `skills` / `phases[].skills` | windup、n、shape、mode、status、say、col、`then`、`seq` 连招，以及 `hp` / `phase` / `adds` 条件 |
| 阶段 | `phases[].at / enter` | 血量门槛、进场台词、咆哮、回血、召唤、机制 |
| 机制：9 个机制库机制 + 参数 | `mechs` / `enter.mechs` / `{use:'mech'}` | 破招、无敌（水晶 / 小怪 / 撑过）、护盾、安全区、场地危害、狂暴、分身、属性、连线 |
| 特性 | `traits` | sa、immune、onDeath explode、regen、reflect（只反近战） |
| 体型和手感 | `size scale weight speed hardness arch tier elem` | |
| 外形变体（不用出图） | `art: ['底图', { hue, sat, bright, only }]` + `scale` | 例：年轻的斯卡萨 = 斯卡萨缩小并变淡 |
| 地下城 | `layout theme mobs elite preBoss bossAdds bgm bossBgm drops desc` | preBoss 保证领主房前一个房间刷出命名精英 |
| 深渊 | `abyss.lords`、`lord.mechs / cycle` | |
| 名字、台词、颜色 | spec | |
| 老领主（1~30 级） | ✗ 现在不行 | 手写 AI，只能改代码；P0 的 `defineBossKit` 覆盖层做好后变成配置 |
| 领主曲 | ✗ 现在只有 5 首可选 | 新曲是 `SONGS.<名字>` 的和弦数据，不用生图（B12） |
| 领主房单独的背景和摆设 | ✗ | P0 的 `bossRoom` 做好后可配置；新背景要出图 |

### 3.2 要新写的原语（Phase 0）
规则：
- 原语只有被 ≥2 个领主用到才进库。只有 1 个领主用的（split、debuff、order），先写在所属区域的 `_bosses.js` 钩子里。
- 每个原语都要有预警、留生路、写组队 mirror，并能在 `test/boss.mjs` 里触发和解开。

| 原语 | 类型 | 作用 · 参数 | 用到的图 | 组队同步 | 放在 |
|---|---|---|---|---|---|
| `leap` 跳砸 / 升空追踪落地 | skill | { use:'leap', up:0.5, track:1.2, r:110, dmg, ring:[r0,r1], jump:true, n:1 }：起跳（不可选中）→ 地面圈跟目标 track 秒后锁定 → 落地圆形 / 双环冲击 | spider_cave bwanga_dojo purgatory sea_pirates ridge gent_east | 落点由主机算好发 hook | P0-B |
| `cone` 扇形吐息 / 喷射 | skill | { use:'cone', ang:70, len:260, dur:1.2, tick:0.2, windup:0.9, status, sweep:0 }：扇形预警 → 持续多段；sweep 让扇形转动 | skasa_nest gent_outskirts bilmark purgatory treant_jungle west_line heis | 招式编号重播（朝向由主机定） | P0-B |
| `lanes` 纵深分道奔袭 / 齐射 | skill | { use:'lanes', lanes:4, hit:3, kind:'bolt'/'runner'/'wave'/'shot', runner:怪物 id, speed, windup:1.0, from:'side' }：挑 hit 条纵深（永远留一条）从一侧扫过去 | thunder_ruins darkcity_gate fallen_bandits white_ruins heis old_wail old_winter holy_war 等 9 个 | 选中的纵深由主机发 hook | P0-B |
| `mark` 头顶标记延迟结算 | skill | { use:'mark', delay:1.5, r:120, mode:'burst'/'share'/'move'/'cover', dmg/frac, jump:true }：头顶倒数图标；burst 以玩家为中心爆；share 队友分摊；move 站着不动持续掉血；cover 躲到掩体后 | shallow_haunt gent_south hamelin heis kartel_origin secret_zone pain_gate | 标记目标 + 倒数主机发 hook，各自判定自己 | P0-B |
| `plant` 可破坏物件（图腾 / 蛋 / 炸弹 / 投石车 / 笼子） | skill | { use:'plant', kind:物件怪物 id, n, at:'target'/'self'/'spots', fuse:6, hp/hits, onFuse:'explode'/'hatch:<kind>'/'heal'/'buff'/'release:<kind>xN', root:true, operator:<kind> }：到时触发，打掉就没事 | shallow_haunt lik_well white_ruins skasa_nest sea_pirates grand_fire kartel_origin secret_zone 等 10 个 | 物件是怪（刷怪已同步），引信到点主机发 hook | P0-B |
| `pool` 地面残留区（毒 / 油 / 冰 / 沼泽） | skill | { use:'aoe', ..., linger:6, zone:'poison'/'oil'/'ice'/'slow'/'blind' } + 交互：zone oil 被 fire 命中 → 连环爆；trail:true = 领主走过留下 | venom_ruins darkelf_tomb gent_outskirts plague_source old_wail wailing_cave forbidden_land king_ruins | 区域位置主机发；踩中各自判定 | P0-B |
| `dash+` 冲刺变体 | skill | dash 加参数：carry（顶着玩家走、撞墙多段）、spin（旋转多段）、bounces:n（撞墙反弹）、wallStun（撞墙自己眩晕 = 反击窗口）、frac（按最大 HP 结算） | darkcity_gate gent_east plague_source spider_cave lorien_deep dragon_tower | 招式编号重播 | P0-B |
| `pull` 吸 / 推 | skill | { use:'pull', mode:'in'/'out'/'toward:<物件>', r:400, force:260, dur:1.5 }：黑洞吸人 / 咆哮吹人（推向火堆） | arden grand_fire skasa_nest | 各自按同一参数本地算 | P0-B |
| `traits` 特性补充 | trait | hitHp:n（固定 n 下打碎 / 伤害恒为 1）、saVsRanged（被远程打自动霸体）、reflectRanged:{window}、rooted（不移动）、back:{do/interrupt}（背击反应）、onGetup:{skill}（起身反击）、grabOnly（霸体只怕抓取）、stacks:{n, on:'hit', do}（受击叠层满了爆）、substitute（挨重击留替身闪走） | frozen_heart ridge golem_tower wailing_cave darkelf_tomb ice_palace shallow_haunt treant_jungle 等 14 个 | 各自按同一规则本地判定；替身 / 叠层爆由主机发 hook | P0-B |
| `form` 形态切换 | mech | { use:'form', art:'<精灵>'/[base,{hue}], scale, fly:hover, skills:[...], invulT:1.5, say }：阶段进入时换精灵 / 体型 / 浮空 / 招式表（过渡无敌），组队发 form 事件 | arden ice_palace skasa_nest blazing_graca siroco_coffin old_winter | mech start 带形态；队员给傀儡换精灵 / 体型 | P0-A |
| `stance` 模式轮换（不换图） | mech | { use:'stance', modes:[{ id, say, aura, skills:[招式 id], dmgTaken, reflect:'phys'/'magic', invis, speed }], every:[12,16] / at:血量 }：换招式子集 + 光环颜色提示 | gent_south hamelin west_line kartel_origin iris_raid holy_war lord_palace frozen_woods 等 11 个 | mech ev mode | P0-A |
| `duo` 多领主同场 | mech | { use:'duo', with:[kind...], bars:true, window:0, onPartnerDown:'enrage'/'revive' }：搭档也算领主（全倒才结算），血条叠两条；window>0 = 必须 n 秒内一起倒否则复活 | lava_cave ridge temple_outskirts floating_castle pain_gate neipera | 搭档按普通怪同步，结算只在主机 | P0-A |
| `gauntlet` 车轮战 | mech | { use:'gauntlet', waves:[{ kind, say, mechs }], boss:'watch'/'hide', revive:false }：命名精英依次上场（各带自己的招牌），打完领主才下场 / 解除无敌 | king_ruins bwanga_dojo ice_palace iris_raid | 波次由主机刷怪 | P0-A |
| `split` 分裂 | mech | { use:'split', at:0.3, n:3, scale:0.6, share:true }：领主分成 n 份（血量均分、全灭才算） | neipera | 主机分裂 = 刷怪 | B4 钩子（1 个用户） |
| `stagger` 蓄力破招窗口 | mech | { use:'stagger', windup:3, need:0.04 / hits:12, skill:<大招>, onBreak:'groggy', onFail:<技能 spec> }：蓄力条显示在头顶，打够就打断 + 破招，没打够放大招 | graca skasa_nest lik_well grand_fire dragon_tower | 蓄力条走 netState，破没破主机发 ev | P0-A |
| `arena` 场地规则 | mech | { use:'arena', kind:'fog'(r 视野)/'wind'(推力 vx)/'tiles'(岩浆 / 移动 / 断层地砖，安全格)/'cover'(掩体物件)/'slide'(冰面) } | heis old_wail lava_cave pain_gate siroco_coffin | start 带参数；风 / 雾本地算，地砖布局主机发 | P0-A |
| `debuff` 叠层减益 + 净化 | mech | { use:'debuff', kind:'plague'/'freeze'/'burn', t:150, stack, cleanse:{ pickup:<道具>/zone/object } }：全场倒计时 / 叠层，捡针管 / 站火盆清除 | plague_source | 倒计时走 netState，净化各自判定 | B9 钩子（1 个用户） |
| `protect` 保护 / 护送 | mech | { use:'protect', kind:<物件 / NPC>, hp, onLose:'heal'/'enrage'/'fail', escort:{ to:'boss' } } | frozen_heart holy_war | 物件是怪，已同步 | P0-A |
| `order` 顺序谜题 | mech | { use:'order', n:4, kind:<水晶 / 小怪>, show:'orbs' }：头顶显示顺序，打错重置 + 惩罚 | law_gate | 顺序主机发 | B10 钩子（1 个用户） |
| `facing` 朝向判定（凝视泛化） | mech | { use:'facing', mode:'away'/'toward', windup:1.8, frac, status:'petrify' }：希洛克凝视改成机制库通用版 | bwanga_dojo siroco_coffin | 同凝视的 mirror | P0-A |
| `sigAnim` 招牌动作帧 | engine | 新增第 5 张动作表 sig（9 帧：sigA1-4 / sigB1-4 / rage）；技能写 clip:'sigA'；SPR_ANIMS 按精灵覆盖 | 所有 31~60 领主 + 天空之城 / 天帷巨兽 | 纯表现 | P0-A |
| `bossKit` 老领主套件覆盖层 | engine | defineBossKit(kind, { mechs, phases:[{ at, say, mechs, skills }], skills, traits })：把机制库 / 技能库挂到手写 AI 的老领主上（泛化 abyssLordMechs） | B1 B2 B3 | 老领主的 AI 已按 aiBase 重播 | P0-A |
| `bossRoom` 领主房配置 | engine | 地下城 bossTheme（领主房单独背景）、bossProps（王座 / 锁链 / 笼子）、bossAlt:{ kind, chance }（稀有领主替换）、bossBgm 用区域自己的曲子 | lik_well bwanga_dojo old_winter darkelf_tomb ice_palace sea_pirates | 进图时随地下城定义下发 | P0-A |

组队同步有两种写法：
- 技能：主机发招式编号，队员按编号重播（已有）。技能里的随机结果（选哪几条纵深、落点、物件位置、标记谁）由主机算好，用 `msNetEv(m, null, 'hook', {h, ...})` 发出去，队员在 `MS_MIRROR[h]` 里重放，和现在虫王钻地一样。
- 机制：写 `net(m, st, p)` + `mirror`（REGION_PIPELINE §4）。

### 3.3 美术
**可以换色加缩放**：同一角色的不同时期或亲属，官方本来就是同一个模型。
- 年轻的斯卡萨（缩到 1.1，偏淡）
- 克拉赫 / 彼诺修（姐妹）
- 熔岩穴三兄弟
- 昔日悲鸣的凯恩
- 罪恶之眼左右眼
- 维塔（奈克斯的白色版）
- 五骑士、四勇士、宫女等精英

换色时 spec 写 `variantOf: '<原领主>'`，查重工具就放行。

**必须出新图**：轮廓要变的。
- 利库：冰晶石巨人，现在是歌利亚换色。
- 无头骑士：骑梦魇的轮廓；现在的步战图留给瘟疫之源的精英。
- 洛丝：坐在冰晶王座上的形态。
- 安祖：机械形态。

可选：摩震（和精英同图）、斯皮兹的头部、希洛克的吉里动物形态。

**招牌动作表 `sig`**：每个领主加 1 张 3×3，9 帧 = sigA 4 帧 + sigB 4 帧 + 狂暴 1 帧。最有辨识度的两招用专属动作，其余招式仍用 atk / cast。

| 项 | 个数 | 每个几张 | 合计 |
|---|---|---|---|
| 新领主 / 形态：利库、骑马无头骑士、机械安祖 | 3 | 5（参考图 1 + walk / run / act / more 4 张） | 15 |
| 洛丝王座形态（不走路，只要参考图 + act + more） | 1 | 3 | 3 |
| 招牌动作表：31~62 级 37 个 + 天空之城和天帷巨兽 12 个 | 49 | 1 | 49 |
| 领主房背景：利库天井、布万加修炼场、凛冬、王的遗迹 | 4 | 3（远景 / 地面 / 交界带） | 12 |
| **核心合计** | | | **79** |
| 可选：摩震 5、斯皮兹头部 3、吉里 2 形态 10、再换 4 个背景 12 | | | ≈30 |

- **生图速度**：并发 2，429 后退避 90 秒；按每张 1~2 分钟算，核心 79 张约需 1~1.5 小时纯生图，另加返工。
- **只许一个美术队列生图**：同一账号 3 路并发就会 429。
- **格兰之森领主不出招牌动作表**：它们是低等级的小领主，靠机制区分就够了。

## 4. 规划

### 4.1 领主 spec 写法（P0 做完以后）
```js
// 区域领主：技能 / 机制全用库里的原语，招牌招式用 sig 动作
skasa: { name: '冰龙斯卡萨', tier: 'raid', art: 'snSkasa', scale: 1.5, elem: 'ice', traits: { immune: ['freeze'] },
  mechs: [{ use: 'groggy', max: 120 }],
  phases: [
    { at: 1, skills: [
      { use: 'swipe', clip: 'sigA', reach: 130, windup: 0.9, dmg: 1.3, down: true, say: '前爪拍地！' },
      { use: 'cone', clip: 'sigB', ang: 60, len: 320, dur: 1.4, tick: 0.2, windup: 1.0, status: 'freeze' },
      { use: 'pull', mode: 'out', force: 300, status: 'stun', say: '吹气！' },
      { use: 'plant', kind: 'skasaEgg', n: 3, at: 'spots', fuse: 12, onFuse: 'hatch:babySkasa', cd: [20, 24] }] },
    { at: 0.6, enter: { say: '斯卡萨蓄起了寒气！' }, skills: [
      { use: 'mech', mech: { use: 'stagger', windup: 3, need: 0.04, onBreak: 'groggy',
        skill: { use: 'cone', ang: 120, len: 420, dmg: 2.4, status: 'freeze' } } }] },
    { at: 0.3, enter: { mechs: [{ use: 'form', fly: 160, dur: 14, say: '斯卡萨飞上了天空！', skills: [{ use: 'rain', kind: 'ice', n: 8 }] }] } }] },
// 老领主（手写 AI 不动）：覆盖层挂阶段 / 机制 / 库技能
defineBossKit('tauKing', { mechs: [{ use: 'groggy', max: 80 }],
  phases: [{ at: 0.5, say: '萨乌塔举起了巨斧！', skills: [{ use: 'mech', mech: { use: 'stagger', windup: 3, need: 0.05, onBreak: 'groggy', skill: { use: 'aoe', shape: 'circle', at: 'front', r: 150, dmg: 2 } } }] }] });
```
- 地下城加字段：`bossTheme`（领主房单独背景）、`bossProps`（王座 / 锁链 / 笼子）、`bossAlt: { kind, chance }`（稀有领主替换）、`bossBgm: 'boss_<区域>'`。
- 美术（`art.chars.<名字>`）加字段：`sig: ['招式 A 的动作描述', '招式 B 的动作描述']`、`forms: { <形态>: { desc, h, sheets } }`。

### 4.2 Phase 0：引擎原语 + 工具（3 个智能体并行，都是 COMPLEX）
| 块 | 负责文件（不重叠） | 交付 | 验收 | 预计 |
|---|---|---|---|---|
| P0-A 引擎 + 机制 | `game/mon_skills.js`、`game/region.js`、`game/dungeon.js`、`game/monsters.js`、`content/sprites.js`、`content/abyss.js`、`net/coop_mech.js` | 机制：form、stance、duo、gauntlet、stagger、arena、protect、facing（希洛克凝视泛化）；引擎：sig 动作按精灵覆盖、`defineBossKit`（由 `abyssLordMechs` 泛化）、`bossTheme` / `bossProps` / `bossAlt`、多领主结算 + 多血条、`MS_TRAIT_HOOKS` 钩子点 | `test/region.mjs mechs` 全绿；每个新机制在 `test/boss.mjs` 的样品怪上能触发、能解、组队 mirror 一一对应 | 1.5~2 天 |
| P0-B 技能 + 特性 | 新文件 `game/mon_skills_ext.js`（ORDER 里放在 mon_skills.js 后面） | 技能：leap、cone、lanes、mark、plant、pool（linger / trail / ignite）、dash 变体、pull；特性：hitHp、saVsRanged、reflectRanged、rooted、back、onGetup、grabOnly、stacks、substitute | `test/region.mjs skills` 全绿（msLab 会自动放新技能）；每招有预警、能躲，组队重播一致 | 1 天 |
| P0-C 工具 + 测试 | `test/boss.mjs`、`tools/boss_inventory.mjs`、`art/tools/region_art.py`、`docs/REGION_PIPELINE.md` §3~5 | 见下 | 对现有 59 个领主各跑一遍，出基线表（用时 / 被击 / 招式数 / 相似度） | 1 天 |

**P0-C 的三件工具**（2026-09-30 已交付，用法见 REGION_PIPELINE §3~§6，基线见 §4.5.1）

`test/boss.mjs <地下城,...> [data,phases,skills,mechs,bot,coop]` 是通用领主测试：
- 进图后直接传到领主房（调试钩子）。
- 逐个设血量触发每个阶段；用 `monForceSkill` 逐招放一遍，检查每招有预警、会命中。
- 每个机制都要能启动、也能解开，判定方法照抄 `region.mjs mechs`。
- `bot`：机器人打一遍领主房，记录用时、被击、死亡。
- `coop`：用 `net_lib.mjs` 开两个客户端，对比双方的预警和机制事件，做法同 `mp_bosses.mjs`。
- 页面报错就算失败。
- 输出一张每招一帧的总览图，给主线程看。

`tools/boss_inventory.mjs` 把本文的导出脚本正式化，重新生成 `docs/boss_inventory.json`，并做查重：
- 两个领主机制组合完全相同 → 警告。
- 招式相似度（技能种类 + 机制的 Jaccard）≥ 0.7 → 警告。
- 底图相同但没写 `variantOf` → 警告。
- 招牌少于 2 个 → 报错。

`region_art.py` 加两类出图：
- `sig` 阶段：每个领主 1 张。
- `forms` 角色：第二套精灵，命名为 `<领主>_<形态>`。
- `--only` 用法不变。

**P0-A 和 P0-B 的接口（开工前约定好）**
- 特性钩子：P0-A 在 `msOnSpawn`、`msOnDamaged`、`regionAI`、起身的地方调用 `MS_TRAIT_HOOKS[名字].{spawn, damaged, update, getup}`（有注册才调）。P0-B 只往 `MS_TRAIT_HOOKS` 里注册，不改 mon_skills.js。
- 物件：技能刷出来的物件一律是 `msObj` 怪。物件活着，房间就不算清完；机器人要不要打它用 `botSkip` 控制。
- 招式子集：stance 和 form 切换招式时按技能的 `id` 过滤，技能 spec 可以写 `id`；过滤由 P0-A 在 `regionAI` 里做。

### 4.3 Phase 0.5：样板（先审再批量）
| 样板 | 看什么 | 谁审 |
|---|---|---|
| S1 机制样板：斯卡萨之巢 | 用到 cone（龙息）+ stagger（蓄力龙息）+ plant（龙蛋）+ form（起飞）+ pull（吹气）；看 `test/boss.mjs` 的总览图，再自己打一把、组队打一把 | 主线程 |
| S2 美术样板：利库天井 | 新的冰晶巨人（参考图 + 4 张动作表 + sig = 6 张）+ 利库天井领主房背景；按 PLAYBOOK“样图 → 主线程审 → 批量” | 主线程 |

两个都通过后，SIMPLE 块全部开工，美术队列开始批量出图。

### 4.4 Phase 1：按区域分块并行
| 块 | 负责文件（互不重叠） | 领主（目标见 §2） | SIMPLE / COMPLEX | 依赖 | 预计 |
|---|---|---|---|---|---|
| B1 格兰之森 | 新 `content/bosses/grand_flores.js`；bestiary.js 里 10 个领主条目（只改名 / 改色） | 10 | SIMPLE 10（便宜模型） | P0 | 0.5 天 |
| B2 天空之城 | 新 `content/bosses/sky_castle.js` | 6 | SIMPLE 5 + COMPLEX 1（悬空城双眼） | P0 | 0.5 天 |
| B3 天帷巨兽 | 新 `content/bosses/behemoth.js` | 6 | SIMPLE 6 | P0 | 0.5 天 |
| B4 暗精灵 | `regions/darkelf.js` + 新 `darkelf_bosses.js` | 7 | SIMPLE 3（浅栖、蜘蛛、墓地）+ COMPLEX 4（熔岩穴三兄弟、王的遗迹五骑士、无头骑士新图、诺伊佩拉分裂 split 钩子） | P0、美术队列 | 1.5 天 |
| B5 雪山（余 5） | `regions/snow.js` + `snow_bosses.js`（P0.5 建的） | 5 | SIMPLE 3（冰心、山脊、白色废墟）+ COMPLEX 2（布万加四勇士、冰雪宫殿王座 + 宫女） | P0.5、美术队列 | 1 天 |
| B6 诺斯玛尔 + 根特 | `regions/gent.js` + 新 `gent_bosses.js` | 5 | SIMPLE 5 | P0 | 0.5 天 |
| B7 远古 | `regions/ancient.js` + `ancient_rooms.js` | 2 | SIMPLE 2 | P0 | 0.3 天 |
| B8 海上列车 | `regions/train.js` + 新 `train_bosses.js` | 4 | SIMPLE 2（海贼、西部线）+ COMPLEX 2（赫伊斯雾 + 掩体、阿登机械形态） | P0、美术队列 | 1 天 |
| B9 时空之门 | `regions/timegate.js` + 新 `timegate_bosses.js` | 8 | SIMPLE 6 + COMPLEX 2（瘟疫 debuff 钩子、圣战护送） | P0 | 1 天 |
| B10 希洛克 | `regions/siroco.js` + `siroco_bosses.js` | 4 | SIMPLE 1（知性）+ COMPLEX 3（法则顺序 order 钩子、苦难双领主 + 地砖、希洛克三形态） | P0、D1 | 1 天 |
| B11 深渊词条 | `content/abyss.js`（P0-A 交付后移交） | 10 个深渊 | SIMPLE | B4~B10 | 0.3 天 |
| B12 领主曲 | 新 `content/music_bosses.js` | 每个区域 1 首 + 攻坚 1 首，约 12 首 | SIMPLE | 无（可以马上做） | 0.3 天 |
| ART 美术队列 | `art/final/spr/<新名字>`、`art/final/bg/<新主题>` | 18 + 49 + 12 张 | COMPLEX | P0-C、样板审过 | 生图约 1.5 小时 + 切帧 / 审图 |

- **合计**：59 个领主中 SIMPLE 43、COMPLEX 16，逐个列在 `boss_inventory.json` 的 `target.complexity / block` 里。
- **区域块只写描述，不生图**：只在 spec 的 `art.chars` 里写 `sig` / `forms` 描述，生图交给美术队列。美术队列按块的顺序串行出图，每个块出完就把总览图发给主线程。
- **SIMPLE 任务怎么派**：给子智能体 §2 自己那几行 + §4.1 的写法 + `test/boss.mjs <图>`，不用读引擎。

### 4.5 每个领主的验收标准
1. **辨识度**：
   - 底图不和别的领主相同；如果是换色，要缩放 ≥ 15%，并写 `variantOf`（只允许官方同模的）。
   - 两招招牌用 sig 专属动作（格兰之森除外）。
2. **≥2 个招牌机制**：
   - 来自 §2 的目标列。
   - `tools/boss_inventory.mjs` 查重通过：机制组合不和任何领主完全相同，招式相似度 < 0.7。
3. **预警看得清**：
   - 每个伤害招式都有预警，领主 0.9~1.6 秒（CONTENT_GUIDE 的规定）。
   - 每个大招都留生路。
   - 新机制在头顶或 HUD 有文字提示。
   - 主线程看总览图能分出每一招。
4. **组队同步**（`test/boss.mjs <图> coop`）：
   - 双方的预警一一对应：同类型、同半径，时间差 < 0.3 秒。
   - 机制事件和钩子事件一一对应。
   - 队员会被机制打到。
   - 两边页面都没有报错。
5. **用时在带内**（按 §4.5.1 的基线定，2026-09-30）：
   - 口径和 `region.mjs bot` 相同：机器人用各图自己的等级、全身 +12 史诗；从领主房门口开始计时，到领主倒下为止；用 `BOTCLS=all` 四个职业各打一次，取平均。
   - 领主房用时：**普通 20~75 秒，攻坚 40~150 秒**。下限 = 基线中位数（普通 21、攻坚 41）：现在一半领主撑不到这么久，招牌和阶段还没放完就倒了，重做后要靠阶段 / 机制 / `bossPower` 撑到下限；上限 ≈ 基线 P90 的 2 倍（普通）/ 3.5 倍（攻坚，车轮战、多领主会拉长）：机制可以让战斗变长，但不能变成磨血。
   - 领主房里死亡 0；**被击 ≤ 20，攻坚 ≤ 40**（基线 P90 10 / 11，最多 18 / 30；上限 ≈ 用时上限 × 基线的被击速度 0.25 次/秒）。
   - 检查：`BOTCLS=all node test/boss.mjs <图> bot --strict`（`test/boss.mjs` 的 `BANDS`）。
6. **每个阶段、每个机制在一场里至少触发一次**（`MS_STATS`）；领主能打死；机器人能按机制打（物件标了 `botSkip`）。`--strict` 时机器人那一场逐项查。

### 4.5.1 基线（P0-T，2026-09-30，`e294c1d` 上的现有 59 个领主）
怎么重跑：`BOTCLS=all node test/boss.mjs all`（分三个进程并行约 55 分钟；只跑 `data,phases,skills,mechs` 约 20 分钟），再 `node test/boss.mjs table` 出下表；总览图 `test/shots/boss/<图>.jpg`；查重 `node tools/boss_inventory.mjs --baseline`。

**结论**
- 用时（4 个职业平均）：普通 51 个中位 21 秒（P10 14、P25 17、P75 28、P90 38）；攻坚 8 个中位 41 秒（P25 36、P75 42）。最快：幽暗密林 牛头巨兽 6 秒、幽暗密林深处 暗咒猫妖 12 秒，第二脊椎 / 洛兰 / 冰霜幽暗密林 / 树精丛林 14 秒；最慢：希洛克（无形棺柩 118、痛苦之门 114、知性之门 76、法则之门 75 秒），其次是攻坚 GT-9600 42、艾丽丝 43 和远古两张 41 秒。
- 按新定的带：普通 23/51 个低于 20 秒下限、2 个高于 75 秒上限（知性之门 76、痛苦之门 114）；攻坚 3/8 个低于 40 秒（王的遗迹、布万加、阿登）。被击都在上限内。
- 被击：普通中位 5（P90 10），攻坚中位 7（P90 11）；最多的是无形棺柩 30、痛苦之门 18。0 死亡。
- 招式：225 个伤害招式里 141 个有地面预警（其余靠头顶“!”），7 个站在出手距离里也打不中（天之驱逐者、赛格哈特、普拉塔尼、克拉赫、道格里各 1 招，多是故意留生路的图案；马塞尔的护罩、毒猫王的毒云各 1 招，不直接打人）。126 个机制全部能启动、能解开；37 个区域领主的阶段全部压血能进。
- 组队（8 个代表：格拉卡、罪恶之眼、长脚罗特斯、无头骑士、斯卡萨、牛头械王、安祖、希洛克）：见下面“组队对照”。
- 查重（`tools/boss_inventory.mjs --baseline`）：报错 59 条（招牌 < 2：56 个 0 个，牛头械王 / 虫王 / 希洛克各 1 个，只有钩子）；警告 33 条：机制组合完全相同 7 组（最大一组 groggy+hazard 5 张：浅栖之地、利库天井、根特外围、根特东门、列车上的海贼）、相似度 ≥ 0.7 16 对（最高 熔岩穴↔利库天井 0.88、瘟疫之源↔暗黑圣战 0.88、冰心少年↔法则之门 0.86、诺伊佩拉↔斯卡萨之巢 0.82）、共用底图没写 `variantOf` 10 个。
- 顺手发现：暗黑雷鸣废墟的领主（骨狱息 Lv19）比地下城最高等级（20）低 1 级（B1 改名时一起改）。

机器人：各图自己的等级、全身 +12 史诗，从领主房门口打到领主倒下；sword / gun / mage / fighter 各打一次，用时 / 被击写“平均（最少~最多）”。招式 = 招式表的招数（其中伤害招式）；地面预警 / 打得中按伤害招式算。

| 图 | 领主 | 类型 | 招式 | 机制 | 招牌 | 最相似 | 地面预警 | 打得中 | 领主房用时 s | 被击 | 死亡 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| lorien 洛兰 | 投掷哥布林首领 | 普通 | 3（2） | — | 0 | — | 0/2 | 2/2 | 14（9~25） | 4（2~8） | 0 |
| lorien_deep 洛兰深处 | 牛头兵首领 | 普通 | 3（3） | — | 0 | — | 1/3 | 3/3 | 19（12~29） | 5（3~9） | 0 |
| dark_woods 幽暗密林 | 牛头巨兽 | 普通 | 2（2） | — | 0 | — | 0/2 | 2/2 | 6（5~7） | 1（1~2） | 0 |
| dark_woods_deep 幽暗密林深处 | 暗咒猫妖 | 普通 | 3（3） | — | 0 | — | 0/3 | 3/3 | 12（9~13） | 4（1~6） | 0 |
| thunder_ruins 雷鸣废墟 | 落雷 凯诺 | 普通 | 2（2） | — | 0 | — | 1/2 | 2/2 | 16（14~18） | 2（0~3） | 0 |
| venom_ruins 猛毒雷鸣废墟 | 毒猫王 | 普通 | 3（3） | — | 0 | — | 0/3 | 2/3 | 18（12~21） | 2（1~3） | 0 |
| frozen_woods 冰霜幽暗密林 | 冰霜 克拉赫 | 普通 | 4（3） | — | 0 | — | 1/3 | 2/3 | 14（11~17） | 3（2~4） | 0 |
| graca 格拉卡 | 牛头王 萨乌塔 | 普通 | 3（3） | — | 0 | — | 2/3 | 3/3 | 17（12~24） | 4（3~6） | 0 |
| blazing_graca 烈焰格拉卡 | 烈焰 彼诺修 | 普通 | 3（2） | — | 0 | — | 1/2 | 2/2 | 25（20~30） | 5（3~7） | 0 |
| dark_thunder 暗黑雷鸣废墟 | 盗尸者 骨狱息 | 普通 | 3（3） | — | 0 | — | 1/3 | 3/3 | 21（16~27） | 5（2~8） | 0 |
| dragon_tower 龙人之塔 | 鲁卡斯 | 普通 | 4（3） | — | 0 | — | 2/3 | 3/3 | 24（21~29） | 1（0~3） | 0 |
| puppet_hall 人偶玄关 | 人偶之王 道格里 | 普通 | 4（4） | — | 0 | — | 2/4 | 3/4 | 24（20~32） | 2（1~3） | 0 |
| golem_tower 石巨人塔 | 黄金巨人 普拉塔尼 | 普通 | 6（6） | — | 0 | — | 5/6 | 5/6 | 19（16~21） | 3（1~4） | 0 |
| dark_corridor 黑暗玄廊 | 天之驱逐者 | 普通 | 4（3） | — | 0 | — | 2/3 | 2/3 | 17（9~24） | 3（0~6） | 0 |
| lord_palace 城主宫殿 | 光之城主 赛格哈特 | 普通 | 4（4） | — | 0 | — | 3/4 | 3/4 | 17（13~20） | 2（1~3） | 0 |
| floating_castle 悬空城 | 罪恶之眼 | 普通 | 5（4） | — | 0 | — | 3/4 | 4/4 | 22（11~37） | 3（1~7） | 0 |
| temple_outskirts 神殿外围 | GBL教大主教 | 普通 | 4（3） | — | 0 | — | 2/3 | 3/3 | 20（15~24） | 1（0~2） | 0 |
| treant_jungle 树精丛林 | 巨树守护者 罗丁 | 普通 | 4（3） | — | 0 | — | 2/3 | 3/3 | 14（12~16） | 1（0~3） | 0 |
| purgatory 炼狱 | 夜叉王 | 普通 | 4（4） | — | 0 | — | 1/4 | 4/4 | 15（11~25） | 3（2~4） | 0 |
| polar_day 极昼 | 多尼尔（EX） | 普通 | 5（4） | — | 0 | — | 4/4 | 4/4 | 22（12~33） | 5（3~9） | 0 |
| second_spine 第二脊椎 | 长脚罗特斯 | 普通 | 5（4） | — | 0 | — | 3/4 | 4/4 | 14（9~18） | 2（1~3） | 0 |
| forbidden_land 天帷禁地 | 审判者马塞尔 | 普通 | 5（4） | — | 0 | — | 2/4 | 3/4 | 16（14~19） | 4（2~5） | 0 |
| shallow_haunt 浅栖之地 | 怨恨之摩根 | 普通 | 6（3） | groggy hazard | 0 | sea_pirates 0.67 | 2/3 | 3/3 | 21（17~27） | 5（4~6） | 0 |
| spider_cave 蜘蛛洞穴 | 艾克洛索 | 普通 | 5（4） | groggy invuln | 0 | fallen_bandits 0.67 | 2/4 | 4/4 | 22（16~25） | 2（1~3） | 0 |
| darkelf_tomb 暗精灵墓地 | 邪龙斯皮兹 | 普通 | 6（4） | groggy safezone | 0 | skasa_nest 0.7 | 3/4 | 4/4 | 19（17~23） | 4（3~5） | 0 |
| lava_cave 熔岩穴 | 歌利亚 | 普通 | 5（4） | groggy hazard tether | 0 | lik_well 0.88 | 2/4 | 4/4 | 29（23~35） | 6（4~8） | 0 |
| king_ruins 王的遗迹 | 锤王波罗丁 | 攻坚 | 5（5） | element enrage groggy shield | 0 | gent_south 0.64 | 4/5 | 5/5 | 21（13~32） | 5（2~8） | 0 |
| darkcity_gate 暗黑城入口 | 无头骑士 | 普通 | 4（3） | clones groggy | 0 | wit_gate 0.67 | 2/3 | 3/3 | 16（11~30） | 7（4~13） | 0 |
| neipera 诺伊佩拉 | 狄瑞吉的幻影 | 攻坚 | 6（4） | enrage groggy hazard invuln safezone | 0 | skasa_nest 0.82 | 2/4 | 4/4 | 41（31~50） | 7（6~8） | 0 |
| frozen_heart 冰心少年 | 查理 | 普通 | 6（3） | groggy shield | 0 | law_gate 0.86 | 2/3 | 3/3 | 18（14~26） | 4（3~5） | 0 |
| lik_well 利库天井 | 寒冰巨人利库 | 普通 | 5（4） | groggy hazard | 0 | lava_cave 0.88 | 2/4 | 4/4 | 15（9~22） | 2（1~3） | 0 |
| ridge 山脊 | 野兽师鲁乌格 | 普通 | 4（2） | enrage groggy tether | 0 | shallow_haunt 0.56 | 0/2 | 2/2 | 18（15~22） | 4（2~6） | 0 |
| white_ruins 白色废墟 | 塞斯奇 | 普通 | 6（4） | groggy safezone | 0 | darkelf_tomb 0.63 | 2/4 | 4/4 | 17（16~19） | 5（2~6） | 0 |
| bwanga_dojo 布万加的修炼场 | 布万加 | 攻坚 | 5（4） | enrage groggy safezone | 0 | wit_gate 0.64 | 2/4 | 4/4 | 19（15~25） | 3（2~5） | 0 |
| ice_palace 冰雪宫殿 | 冰雪女王洛丝 | 普通 | 6（4） | clones groggy hazard tether | 0 | kartel_origin 0.58 | 2/4 | 4/4 | 25（17~30） | 5（3~8） | 0 |
| skasa_nest 斯卡萨之巢 | 冰龙斯卡萨 | 攻坚 | 6（4） | enrage groggy hazard invuln safezone | 0 | neipera 0.82 | 3/4 | 4/4 | 42（34~49） | 7（6~7） | 0 |
| fallen_bandits 堕落的盗贼 | 犬使魔震 | 普通 | 6（4） | groggy invuln | 0 | plague_source 0.78 | 3/4 | 4/4 | 31（15~53） | 5（3~8） | 0 |
| hamelin 「迷乱之村」哈穆林 | 魔笛使者皮特 | 普通 | 5（2） | clones enrage groggy invuln | 0 | iris_raid 0.73 | 1/2 | 2/2 | 36（27~52） | 10（7~11） | 0 |
| gent_outskirts 根特外围 | 纵火犯本汀克 | 普通 | 5（5） | groggy hazard | 0 | kartel_origin 0.73 | 4/5 | 5/5 | 19（13~23） | 4（1~6） | 0 |
| gent_east 根特东门 | 机动队长苏雷德 | 普通 | 6（5） | groggy hazard | 0 | kartel_origin 0.58 | 5/5 | 5/5 | 25（19~33） | 7（5~9） | 0 |
| gent_south 根特南门 | GT-9600 | 攻坚 | 7（4） | enrage groggy safezone shield | 0 | plague_source 0.7 | 3/4 | 4/4 | 42（29~59） | 9（4~18） | 0 |
| bilmark 比尔马克帝国试验场 | 牛头械王 | 普通 | 4（4） | groggy invuln | 1 | holy_war 0.67 | 3/4 | 4/4 | 41（33~48） | 11（8~13） | 0 |
| wailing_cave 悲鸣洞穴 | 虫王戮蛊 | 普通 | 6（5） | groggy invuln | 1 | spider_cave 0.6 | 3/5 | 5/5 | 41（35~49） | 4（4~4） | 0 |
| sea_pirates 列车上的海贼 | 黑鳞莫贝尼 | 普通 | 6（5） | groggy hazard | 0 | gent_outskirts 0.7 | 3/5 | 5/5 | 26（18~31） | 5（3~8） | 0 |
| west_line 夺回西部线 | 烈焰盾波迪尔 | 普通 | 6（4） | groggy hazard shield | 0 | secret_zone 0.6 | 4/4 | 4/4 | 23（15~30） | 5（1~9） | 0 |
| heis 雾都赫伊斯 | 范·弗拉丁 | 普通 | 7（4） | clones groggy safezone | 0 | darkelf_tomb 0.67 | 3/4 | 4/4 | 28（22~45） | 5（4~7） | 0 |
| arden 决战阿登高地 | 黎明之眼 安祖·塞弗 | 攻坚 | 8（5） | element enrage groggy safezone shield | 0 | gent_south 0.62 | 4/5 | 5/5 | 36（35~37） | 11（7~20） | 0 |
| grand_fire 格兰之火 | 兽王乌塔拉 | 普通 | 5（4） | enrage groggy hazard invuln | 0 | neipera 0.73 | 3/4 | 4/4 | 38（28~49） | 10（7~13） | 0 |
| plague_source 瘟疫之源 | 骷髅骑士 | 普通 | 7（5） | groggy invuln safezone | 0 | holy_war 0.88 | 4/5 | 5/5 | 28（24~31） | 6（2~9） | 0 |
| kartel_origin 卡勒特之初 | 沙影贝利特 | 普通 | 6（5） | clones groggy hazard | 0 | gent_outskirts 0.73 | 3/5 | 5/5 | 33（28~44） | 8（4~13） | 0 |
| holy_war 暗黑圣战 | 尼尔巴斯·格拉西亚 | 普通 | 6（5） | groggy invuln safezone | 0 | plague_source 0.88 | 4/5 | 5/5 | 27（23~29） | 8（4~10） | 0 |
| secret_zone 绝密区域 | 地狱三头犬 | 普通 | 6（4） | groggy hazard shield | 0 | old_wail 0.64 | 3/4 | 4/4 | 22（14~27） | 5（3~8） | 0 |
| old_wail 昔日悲鸣 | 凯恩 | 普通 | 6（4） | groggy hazard invuln safezone | 0 | sea_pirates 0.64 | 3/4 | 4/4 | 31（28~34） | 8（7~9） | 0 |
| old_winter 凛冬 | 年轻的斯卡萨 | 普通 | 6（4） | groggy hazard safezone shield | 0 | gent_south 0.7 | 3/4 | 4/4 | 19（18~20） | 5（3~8） | 0 |
| iris_raid 谜之觉悟 | 吟游诗人艾丽丝 | 攻坚 | 8（4） | clones enrage groggy invuln safezone | 0 | hamelin 0.73 | 3/4 | 4/4 | 43（33~49） | 10（5~13） | 0 |
| law_gate 法则之门 | 奈克斯 | 普通 | 6（4） | groggy shield | 0 | frozen_heart 0.86 | 2/4 | 4/4 | 75（56~94） | 10（7~13） | 0 |
| wit_gate 知性之门 | 暗杀者 | 普通 | 5（4） | clones enrage groggy | 0 | kartel_origin 0.73 | 2/4 | 4/4 | 76（49~99） | 13（3~18） | 0 |
| pain_gate 痛苦之门 | 守门人 | 普通 | 5（4） | element groggy safezone | 0 | darkelf_tomb 0.56 | 3/4 | 4/4 | 114（74~157） | 18（12~27） | 0 |
| siroco_coffin 无形棺柩 | 潜行者 希洛克 | 攻坚 | 9（7） | clones enrage groggy hazard invuln safezone tether | 1 | iris_raid 0.59 | 4/7 | 7/7 | 118（101~152） | 30（22~40） | 0 |

**组队对照**（`node test/boss.mjs <图,...> coop`：主机逐招强制放 + 逐阶段压血，队员站在出手距离里）
| 图 | 段数 | 地面预警（队员配上 / 主机） | 最大时间差 ms | 机制启动（两边一致） | 钩子事件 | 机制 / 钩子两边一致 | 队员被打中 |
|---|---|---|---|---|---|---|---|
| graca 牛头王 萨乌塔 | 3 | 2/2 | 1 | — | — | 是 | 2 |
| floating_castle 罪恶之眼 | 5 | **6/7** | 2 | — | — | 是 | 8 |
| second_spine 长脚罗特斯 | 5 | 5/5 | 4 | — | — | 是 | 4 |
| darkcity_gate 无头骑士 | 5 | 10/10 | 48 | clones×2 | — | 是 | 2 |
| skasa_nest 冰龙斯卡萨 | 7 | 20/21（1 个在段末 0.5 秒内，不算） | 4 | safezone×1 hazard×2 invuln×1 | — | 是 | 13 |
| bilmark 牛头械王 | 5 | 9/9 | 60 | invuln×2 | eyeL×2 roar×2 | 是 | 5 |
| arden 黎明之眼 安祖·塞弗 | 9 | 10/10 | 7 | shield×1 safezone×2 element×1 | — | 是 | 14 |
| siroco_coffin 潜行者 希洛克 | 10 | 21/21 | 60 | clones×1 safezone×1 hazard×2 invuln×1 tether×1 | gaze×3 | 是 | 15 |

罪恶之眼少的那一个是真 bug：`net/coop.js` 的 `monAct` 对手写领主按“片段 + 时长”找招（`D.attacks.findIndex(A => A.clip === def.clip && A.act.dur === def.dur)`），罪恶之眼的第 1 招（追踪光柱）和第 2 招（激光）都是 cast / 1.8 秒，主机放激光、队员那边重播成追踪光柱。同样撞车的还有普通怪 plague、kargoGoggle（throw / 0.9）。归 P0-E（或改 coop.js 的人）：手写招式按下标发。

### 4.6 时间
| 阶段 | 并行 | 日历时间 |
|---|---|---|
| P0 | 3 个智能体 | 1.5~2 天 |
| P0 合并 | 主线程：合并 + `sh test/quick.sh` | 0.5 天 |
| P0.5 样板 | 1 个智能体 + 主线程审 | 0.5 天 |
| Phase 1 | 12 个块并行（SIMPLE 用便宜模型）；美术队列同时串行出图 | 1~1.5 天 |
| 收尾 | 主线程：合并、quick.sh、后台跑一次全量回归、部署 | 0.5 天 |
| **合计** | | **约 4~5 天** |

## 5. 风险与决策（需要主线程拍板）
| # | 决策 / 风险 | 建议 |
|---|---|---|
| D1 | 希洛克四门的名字和官方不对：官方法则之境是守门人，苦难之境是奈克斯 + 维塔，知性之境是哈妮尔等 | 按官方对调：law_gate 和 pain_gate 换领主；维塔用奈克斯的白色换色；暗杀者改名“魅惑之哈妮尔”，标近似。任务按 kind 引用，改 kind 时 B10 要同步任务文本和掉落表 |
| D2 | 招牌动作表 49 张要不要全做 | 做。只加招式不加动作，玩家仍会觉得是“同一个人换了技能”。先做样板 1 张看效果；效果不好就只给攻坚图和隐藏图的领主做，约 12 张 |
| D3 | 深渊：官方是“随机怪物 / APC + 地区固定”，我们是“本区域领主随机 + 通用循环” | 随机领主保留（掉落和保底都绑在它上面）；把通用循环换成每个区域一个“深渊词条”，用新原语，例如暗精灵 = 诅咒标记、雪山 = 冻结叠层、列车 = 雾、时空之门 = 异界之风。归 B11，SIMPLE |
| D4 | 加约 20 个原语，mon_skills 会变胖，组队同步风险也大 | 拆文件（P0-A / P0-B）；每个原语自带 mirror 和 coop 测试；只有 1 个领主用的原语（split、debuff、order）先写成区域钩子 |
| D5 | 难度会上升：龙息、分道、标记普遍更难躲，而用户以前嫌难 | 大招都留生路，预警 ≥ 0.9 秒；按基线的用时和被击带验收；普通难度下 stagger 失败和 mark 的惩罚打折（按难度系数） |
| D6 | 并行冲突：ORDER、sprites.js（MON_ART）、quick.sh | 区域块只改自己的 spec 和钩子文件；ORDER 只在新建文件时加行，冲突时两边都保留；MON_ART 写在 spec 的 `art` 里，不碰 sprites.js |
| D7 | 生图账号会 429 | 只有美术队列生图（PAR 2）；样板通过后再批量 |
| D8 | 改老领主（1~30 级）的 AI 代码有风险 | 手写 AI 不动，只用 `defineBossKit` 往上挂阶段和机制，所以 B1~B3 是 SIMPLE |
| D9 | 改名（6 处 + 希洛克）会影响任务文本和图鉴 | 只改 MON 的 `name`（任务用 kind）；再 grep 一遍旧名，把任务描述也改掉 |

## 6. 重新生成清单
- P0-C 交付前：本文的 json 由一个临时脚本生成，做法是把 `src/ORDER` 的文件拼起来，照 `tools/item_catalog.mjs` 的方式在 vm 里跑，再读 DUNGEONS / MON / MON_ART / REGIONS / ABYSS / QUESTS。
- P0-C 交付后：改用 `node tools/boss_inventory.mjs`，官方对照和目标从这份 json 里保留。
- json 字段：`dungeons[].boss`（kind、art.base / recolor、artSharedWith、visualH、phases、mechSet、skillUses、signature）、`dup`（sameMechSet、sameSkillSet、mostSimilar）、`official`、`target`、`abyssLordOf`、`quests`。

## 7. 主线程定稿（2026-09-30）
- 决策 D1~D9 全部按建议执行（希洛克四门按官方对调；招牌动作表先做 1 张样板再批量；深渊改成区域词条；普通难度惩罚打折；老领主只挂 `defineBossKit` 覆盖层）。
- 用户要求：子智能体不要开太多，按区域一个。原计划 3 + 12 + 1 块合并成下面 8 块，区域块等 P0 合并后再开：

| 块 | 合并自 | 模型 | 说明 |
|---|---|---|---|
| P0-E 引擎 + 技能 | P0-A + P0-B | Opus | 一个负责人写全部原语、特性、`defineBossKit`、多领主结算、组队同步；顺带做 S1 机制样板（斯卡萨之巢） |
| P0-T 工具 + 测试 | P0-C | Opus | `test/boss.mjs`、`tools/boss_inventory.mjs`（查重）、`region_art.py` 的 sig / forms；跑 59 个领主基线，定验收用时区间 |
| ART 美术队列 | ART | Opus | 唯一生图的块，一次一张；先出 S2 美术样板（利库），审过再按区域顺序批量 |
| R1 西部 | B1 格兰之森 + B2 天空之城 + B3 天帷巨兽 + B7 远古 | Sonnet 5.5 | 几乎全 SIMPLE；悬空城双眼若原语不够，交回 P0-E |
| R2 暗精灵 + 雪山 | B4 + B5 | Opus | COMPLEX 为主 |
| R3 诺斯玛尔 + 根特 + 深渊 + 领主曲 | B6 + B11 + B12 | Sonnet 5.5 | 全 SIMPLE；深渊词条等 R2 / R4 / R5 的钩子合并后做 |
| R4 海上列车 + 时空之门 | B8 + B9 | Opus | |
| R5 希洛克 | B10（含 D1 四门对调） | Opus | |
