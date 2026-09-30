# 破晓地下城 · AI 美术流水线（gpt-image）

游戏里的角色、动作帧、时装、武器、图标、觉醒插图、场景背景和怪物，**全部由 gpt-image 生成**，再由 `art/tools/` 里的 Python 脚本切成游戏素材。没有手绘，也没有用官方素材。

这份文档讲清楚三件事：怎么让 AI 画出**同一个角色**的几百帧动作、怎么把图变成能用的精灵，以及想加一个新角色 / 职业时**一步步照着做**。

![角色流水线：设定图 → 姿势引导 → 3×3 动作表 → 武器换成标记棒 → 切帧与锚点 → 逐帧素材 → 游戏里](img/art/pipeline_character.webp)

**现有规模**（`art/final/`，全部 webp，共 9124 个文件、约 115 MB）：

| 类别 | 数量 |
|---|---|
| 逐帧精灵 | 6758 帧，169 套（3 个职业 × 原装 + 6 套时装，以及全部怪物、领主、召唤物） |
| 武器 | 388 张（15 类武器：普通、稀有、神器、传说、史诗、武器装扮） |
| 图标 | 1293 个（技能、装备、道具、商城） |
| 场景 | 183 张背景层，163 张城镇建筑、门、NPC 立绘 |
| 觉醒插图 | 38 张（15 个转职 × 一觉、二觉、三觉） |

AI 原图约 2500 张、8 GB，放在 `art/src/`，**不进仓库**；游戏运行只需要 `art/final/`。

---

## 1. 核心思路

1. **画风锁死**：一段固定的风格描述（`CHIBI`）和一套固定的收尾句（`REF_TAIL`）出现在所有角色提示词里，画风才不会跑偏。
2. **先定设定图，后面全部以它为参考**：每个角色先出一张 1024×1536 的全身设定图。之后的动作表、时装、插图都是**图生图**，参考图就是这张设定图，提示词开头统一写 `Using this exact chibi character (same design, same colors, same proportions…)`。
3. **一张图画 9 格动作**：同一张 2048×2048 的 3×3 表里，AI 画出来的角色比例、配色、画风自然一致。第 1 格固定画标准站姿，切图时用它把整张表缩放到统一身高。
4. **走路、跑步先给火柴人**：程序先画一张“姿势引导”（蓝色是近侧手脚，红色是远侧手脚），和设定图一起作为参考图，AI 照着火柴人摆姿势，步态才连贯。
5. **武器不画进身体帧**：先出带武器的动作表，再用图生图把武器换成一根**纯绿色（#00FF00）标记棒**。切图时从绿棒读出每一帧的握点、角度和长度，运行时再按这条轨迹画任意一把武器。所以 388 把武器能配所有动作，不用重画。
6. **时装 = 整张表重画**：拿“带标记棒的动作表 + 时装参考图”图生图，让 AI 给 9 格换衣服、姿势和标记棒不动，再逐帧对齐到原装。
7. **特效不进帧**：烟、火花、光束、动作线都在运行时画。提示词里明确写 `no motion lines / no sparks / no smoke`。
8. **人审在前，批量在后**：先出一张样图，拼成总览图给主线程审，通过后一次跑完整批，不“多抽几张挑一张”。

---

## 2. 生图接口：gpt-image 怎么用

所有脚本都调用本机的 gpt-image 技能脚本 `~/.claude/skills/gpt-image/scripts/gpt_image.py`。它是 Claude Code 的一个技能，不在本仓库里；换成任何兼容 OpenAI Images API 的封装都可以。**接口地址和密钥按 gpt-image 技能的说明配置在本机**（配置文件或环境变量），不要写进仓库。

### 2.1 模型与参数

| 参数 | 本项目用法 |
|---|---|
| `model` | `gpt-image-2.5-sunburst`（质量档）：角色设定图、动作表、时装、武器、觉醒插图、头饰<br>`gpt-image-2.5-flare`（默认档，更快）：背景、图标、特效 |
| `size` | `1024x1536`：设定图、时装参考图<br>`2048x2048`：3×3 动作表<br>`1536x1024`：单把武器、觉醒插图<br>`2048x1152`：图标表<br>`3840x2160`：远景背景。最长边不超过 3840 |
| `quality` | `high` |
| `n` | `1`：一次一张。要备选就重跑，不要一次出多张 |
| `response_format` | `b64_json` |
| `image` | 参考图列表（图生图 / 改图）。设定图放第一张，姿势引导或时装参考放第二张 |

请求体示例（`art/tools/sheets.py`、`avatar_gen.py` 里就是这样拼的）：

```python
payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': prompt, 'n': 1, 'size': '2048x2048',
           'quality': 'high', 'response_format': 'b64_json', 'image': [ref_design_sheet, pose_guide]}
```

### 2.2 命令行

```bash
GI=~/.claude/skills/gpt-image/scripts/gpt_image.py
python3 $GI gen  "<提示词>" -m gpt-image-2.5-sunburst -s 1024x1536 -q high -o hero_ref.png          # 文生图
python3 $GI edit "<提示词>" -i hero_ref.png -i guide_walk.png -s 2048x2048 -o hero_walk.png        # 图生图，可以传多张参考
python3 $GI rmbg -i hero_ref.png --crop                                                             # 本地去纯色底（不调接口）
python3 $GI grid -i sheet.png --rows 3 --cols 3 --out-dir tiles                                     # 本地按格切
python3 $GI batch jobs.json -c 4                                                                    # 按清单并发跑
```

### 2.3 经验

- **透明背景一律本地做**：接口的 `background: transparent` 不可用。提示词统一写 `Plain pure white background`，再由脚本去白底。也不要把带透明通道的 PNG 当参考图传进去，边缘会发黑。
- **参考图直接传本地文件**：脚本里写成 `'local:' + 绝对路径`，由技能脚本自己上传。早期“上传一次、缓存 URL”的做法有两个坑：缓存的地址会过期（生图 404），多线程同时写缓存文件会把 JSON 写坏。
- **并发与退避**：同一个账号同时跑 2~4 路就够了。遇到 429 先等 65~90 秒再重试，其他错误等 8~20 秒；HTTP 400 不重试（多半是提示词被拒）。各脚本的默认值见下表，几个美术组同时出图时合计不超过 4 路。

  | 脚本 | 默认并发 | 429 退避 |
  |---|---|---|
  | `sheets2.py` / `jobs.py` | `-j 8`（早期） | 65 秒 |
  | `avatar_gen.py` | 最多 2 | 70 秒 |
  | `weapon_gen.py` | `-j 2`（最多 6） | 由技能脚本重试 |
  | `region_art.py` / `sky_art.py` / `cash_art.py` | 环境变量 `PAR`，默认 2 | 65~90 秒 |
  | `gear_icons.py` | 2 | 70 秒 |

- **耗时参考**：2048² 高质量一张 35~46 秒；带 1~2 张参考图的改图 23~42 秒；4K 背景约 50 秒。
- **可断点续跑**：所有脚本在输出文件已存在时自动跳过，中断后重跑同一条命令，只会补齐缺的那些。

---

## 3. 做一个新角色 / 新职业：一步步来

以现有鬼剑士为例。下面的命令都能直接运行；新职业可以照 `art/tools/spitfire_art.py` 写一个 `<职业>_art.py`，把这些步骤包成子命令，复用下面这些函数，不改公共脚本里的表。

原图默认写到主仓库的 `art/src/`。在 git worktree 里跑时，设置 `ART_MAIN=<主仓库>/art`（部分脚本用 `ART_SRC_ROOT`）。

### 3.1 设定图（1 张 → 定画风、定人设）

提示词由三段常量拼成，定义在 `art/tools/jobs.py`：

```text
CHIBI    = cute chibi / super-deformed (Q-version) 2D side-scrolling mobile game art, about 3 heads tall with a big head
           and big expressive eyes, thick clean dark outlines, bright flat colors with simple soft shading, very cute and polished
POSE     = Strict side view profile facing RIGHT, neutral relaxed standing pose, arms hanging slightly away from the body
           and legs slightly apart so every limb is clearly separated and visible.
REF_TAIL = Art style: {CHIBI}. Plain pure white background, isolated single character, full body visible, no ground shadow, no text.

设定图 = "Full-body character design image for a 2D side-scrolling beat-em-up game. {POSE} {角色描述} {REF_TAIL}"
```

角色描述写外观，不写动作。例如鬼剑士（`jobs.py` 的 `CHARS['sword']`）：

```text
An original young swordsman hero: spiky silver-white hair, red eyes, navy-blue knee-length coat with gold trim and high collar,
long red scarf, dark trousers, brown leather gloves and boots, a slim katana held in the front hand pointing down.
```

- 尺寸 `1024x1536`，模型 `gpt-image-2.5-sunburst`。命令：`python3 art/tools/jobs.py refs --only <名字>`。
- **严格侧面、朝右、四肢分开**。后面所有动作都朝右画，游戏里朝左时水平翻转；四肢分开，切图和锚点才好找。
- **审这一张最重要**：和现有角色站在一起的比例、Q 版头身比、服装是否保守、有没有用到纯绿或品红（这两种颜色是切图工具的标记色）。

### 3.2 姿势引导（程序画，不花钱）

```bash
python3 art/tools/poseguide.py     # → art/src/guide_walk.png、guide_run.png（2048²，3×3），以及 guides/walk1-8.png、run1-8.png（单格）
```

- 火柴人按 Q 版比例画：头半径 88，躯干 120。蓝色（近侧）手脚在身体前面，红色（远侧）手脚在身体后面，鼻子三角指向右边。
- 第 1 格是站姿，第 2~9 格是步态相位 0°~315°，每格相差 45°。
- 走路和跑步只差幅度：大腿 / 膝盖 / 手臂摆幅，走路 26 / 58 / 26，跑步 40 / 105 / 48；前倾 4 对 14；跑步在 90° 和 270° 相位离地 26 像素。
- 每格的文字说明来自 `poseguide.frame_text`，例如 `the hand holding the katana swung FORWARD and the other hand back`，会逐格写进提示词。

### 3.3 动作表（每张 1 次生图 → 8 帧）

```bash
python3 art/tools/sheets2.py --only sword_walk -j 2      # → art/src/sheets2/sword_walk.png
```

普通动作表的提示词（`sheets2.py` 的 `prompt`）：

```text
Using this exact chibi character (same design, same colors, same proportions and the same cute art style with thick outlines),
draw a professional 2D game SPRITE ANIMATION SHEET: 9 full-body frames of this SAME character at exactly the SAME scale,
every frame in strict side view FACING RIGHT, arranged in a grid of 3 columns and 3 rows, with wide empty white gaps so that
no frame touches or overlaps another; the feet of grounded frames in each row sit on the same baseline.
The character is holding the katana in the front hand in EVERY frame unless the frame says otherwise.
Frames in reading order (left to right, top to bottom): (1) standing idle reference pose; (2) slash 1 wind-up: katana drawn back
high over the shoulder; (3) slash 1 strike: …; … (9) ….
Consecutive frames must be clearly different poses so the animation reads smoothly.
Plain pure white background, no ground, no shadows, no text, no numbers, no motion lines outside the character.
```

走路 / 跑步表多一张参考图（姿势引导），提示词换成 `guide_prompt`，要点如下：

```text
The FIRST image is the character. The SECOND image is a pose guide: 9 simple mannequin figures in a 3x3 grid. …
redraw the character from the first image 9 times, in exactly the same 3x3 layout as the pose guide, each copy copying EXACTLY
the pose of the mannequin in the same cell: the same body lean, the same angle of every upper arm, forearm, thigh and shin, …
In the pose guide the BLUE arm and BLUE leg are the character's NEAR side … and the RED arm and RED leg are the FAR side …
the arms always swing opposite to the legs … do NOT draw the mannequin colors on the character.
```

**为什么是 3×3、每张 8 帧：**

- 2048² 的图每格约 680 像素，游戏里一帧只要约 150×200，清晰度绰绰有余。
- 同一张图里 AI 保持人设的能力，远好于分 8 次单独生成。
- 第 1 格的站姿当“标尺”，每张表都按它缩放，所以不同表之间身高一致。
- 格数再多，格子之间容易粘连。格斗家计划试 4×4 一张 15 帧（见 [CLASS_PLAN_FIGHTER.md §3](CLASS_PLAN_FIGHTER.md)）。

**每个职业的表**（`sheets2.py` 的 `PLAYERS`）：`walk / run / jump / combo / react / skillA / skillB` 7 张基础表，加上每个转职 1~3 张技能表（`combatgen.py sheets`、`<转职>_art.py sheets`）。现有规模：鬼剑士 15 张 / 121 帧，神枪手 16 / 129，魔法师 19 / 153。

帧的描述写成**动作分解**，例如 `slash 2 wind-up: katana held low behind at the hip`、`knocked into the air: body horizontal tumbling backward mid-air`。技能特效另外做，提示词末尾加一句：

```text
NOFX = The weapon is drawn plain: NO muzzle flash, NO beam, NO projectile, NO smoke, NO sparks, NO debris (all effects are added later in game).
```

### 3.4 武器换成绿色标记棒（每张表再改 1 次）

```bash
python3 art/tools/avatar_gen.py wpn --only sword_ -j 2     # → art/src/avatar/sheets/sword_*.png
```

对整张表做改图，只改一件事（`avatar_gen.py` 的 `wpn_prompt`）：

```text
This image is a 2D game sprite animation sheet of a chibi character in a 3x3 grid (9 frames). Edit it with ONE change only:
in EVERY frame, completely remove the katana and replace it with a plain, perfectly straight, rigid stick held by the same hand
at the same position and the same angle. The stick is painted in ONE flat pure green color (#00FF00): no outline, no shading,
no highlight, no texture, no guard, no decoration, uniform thickness about as wide as two fingers.
The fist grips the stick close to one end, exactly where the katana hilt was … The fingers wrap around the stick and are drawn in front of it.
IMPORTANT: also erase the round golden sword guard (tsuba) …
Keep EVERYTHING else exactly the same: the character design, every pose, arms, legs, clothing, colors, the position of each frame
in the grid, and the plain white background. Do not add anything else.
```

- 魔法师的法杖头换成一个纯品红（#FF00FF）小球，切图时靠它判断杖头朝向。神枪手要把整把左轮都擦掉，双枪的帧两把都换。
- 技能道具不是武器（手雷、加特林、南瓜炸弹），要在 `NOTES` 里单独写一句“保持原样”。

### 3.5 切帧、去底、锚点

```bash
python3 art/tools/avatar_frames.py sword_                  # 切帧 → art/final/spr/sword/*.webp + spr.json
python3 art/tools/avatar_head.py sword                     # 头部锚点（头饰、帽子贴在这里）
python3 art/tools/avatar_cuts.py sword --preview           # 腰线 / 脚踝分割线（时装上下装混搭用）
python3 art/tools/avatar_hands.py sword                    # 副手锚点
python3 art/tools/avatar_hatcheck.py gun mage              # 原装帧有没有丢默认帽子（有问题退出码 1）
python3 art/tools/marker_check.py sword_walk 1 2 3         # 逐格数绿 / 品红像素，看标记有没有残留
```

`avatar_frames.py` 做了这些事：

1. **去白底**：从图像边缘向内泛洪，近白判定为 `min ≥ 233` 且 `max − min ≤ 14`。边缘 2 像素做半透明过渡，并去掉白边。被身体围住的白色小洞另外填掉（`fill_holes`）。
2. **按连通块切格**：小碎块并到 150 像素内最近的大块，否则当噪点丢掉。每行必须切出 3 个，否则打印 `<-- CHECK`。
3. **统一身高**：`缩放 = 角色身高 × 1.8 / 第 1 格站姿高度`。身高鬼剑士 118、神枪手 112、魔法师 116（世界单位）。
4. **脚底锚点**：走 / 跑帧的 `ax` 取身体 15%~55% 高度处不透明像素的中位 x；`ay` 取这一行共同的脚底基线，所以跳起来的帧保留离地高度。其他帧取底部 12% 的中位 x 和最低不透明行。
5. **读出武器轨迹**：
   - 用主成分分析求绿棒的轴线；两段绿色夹角小于 14°、偏移小于 26 像素就合并成一根。
   - 找握拳：沿轴线找被手挡住的缺口（约 0.35~2.2 个拳头宽）。
   - 判断前后：绿棒被身体挡住的长度不到 10% 时，武器画在身前。
   - 结果写进 `spr.json` 每帧的 `wpn: {gx, gy, ang, len, front, hand[]}`；双持时另有 `wpn2`。
6. **修补**：绿棒原来挡住的身体像素用周围颜色扩散补齐，残留的绿色压掉（G 通道不超过 max(R, B)）。
7. **手动修正**：个别帧写进 `art/tools/avatar_fix.json`（`front` / `flip` / `grip` / `wpn{…}`），重跑即可。

头部锚点（`avatar_head.py`）的做法：拿站姿帧头部（上 40%）当模板，在每一帧里做旋转和平移匹配，找出头的位置和转角。脸被挡住的帧会标出来，这些帧不画脸部配件。

### 3.6 武器（一把一张图）

```bash
python3 art/tools/weapon_gen.py katana_r3 --show           # 只打印提示词和参考图，不生图
python3 art/tools/weapon_gen.py ep_gs_,greatsword -j 3     # 按前缀出图 → art/src/avatar/weapons2/<key>.png
python3 art/tools/avatar_weapons.py ep_gs_                 # 切图 → art/final/weapon/<key>.webp，并生成 src/content/avatar/weapon_art.js
python3 art/tools/weapon_review.py k1,k2 <旧目录> <新目录> out.jpg   # 改前改后对比图
node test/weapons.mjs                                      # 每款武器 15 种类型都有图
```

![武器：风格参考 + 单把生成 → 切图；觉醒插图：原图 → 游戏里的横幅](img/art/weapon_cutin.webp)

- 参考图 1 是 `weapons2/style_ref.png`：三个职业的设定图拼成一张，只用来对齐线条和上色风格。
- 稀有 / 神器 / 传说外观再加一张同类型的普通版当“家族”参考，所以普通版要先出。
- 提示词骨架（`weapon_gen.py` 的 `STYLE`）：

  ```text
  Premium 2D game weapon art for a cute chibi (Q-style) action RPG … Draw exactly ONE weapon, alone, lying perfectly HORIZONTAL
  in strict side view …, the grip / handle / stock at the LEFT end and the blade tip / muzzle / head pointing to the RIGHT,
  centered and spanning about 85% of the image width. {武器类型 + 设计 + 比例要求}
  Rendering: thick clean dark outline …, crisp cel shading with one light and one dark tone plus sharp white highlights …;
  any glowing runes, energy or crystal light is painted INSIDE the weapon …
  Match the line weight, colors and cel shading of the chibi characters in the first image (they are only a style reference …).
  No hands, no character, no text, no frame, no cast shadow, no glow halo or aura outside the silhouette, no sparks, no particles …
  Do not use pure neon green (#00FF00) or pure magenta (#FF00FF) anywhere. Plain pure white background.
  ```

- **比例写死**（`THICK`）：巨剑写 `the blade is a huge thick slab about one quarter as wide as the whole weapon is long`，太刀写 `about one ninth`，所有刀剑都写 `STRAIGHT … NO hook`。不写的话，模型会把巨剑画成普通长剑、太刀画成一根线，刀尖还会卷成钩子。
- 切图后存成 3 倍尺寸，游戏里按类型放大（`HAND`：左轮 1.6，太刀 / 短剑 1.35，巨剑 1.25）再画到握点上。枪身要用亮色，全黑的枪在 1 倍画面里看不清。

### 3.7 时装（每套：1 张参考图 + 每张动作表 1 次）

![同一帧 × 6 套时装：整张动作表按时装参考图重画，逐帧对齐](img/art/costumes.webp)

```bash
python3 art/tools/avatar_gen.py ref --only sword@summer    # 时装参考图（改设定图的衣服）→ art/src/avatar/refs/sword@summer.png
python3 art/tools/avatar_gen.py set --only summer/sword_   # 每张标记棒表 × 这套时装 → art/src/avatar/sets/summer/sword_*.png
python3 art/tools/avatar_frames.py --set summer sword_     # 切帧 → art/final/spr/sword@summer/
python3 art/tools/avatar_align.py summer --apply           # 和原装逐帧对齐（尺度 0.84~1.16、位置）
python3 art/tools/avatar_head.py sword@summer              # 时装帧的头部锚点
python3 art/tools/avatar_flicker.py summer                 # 同一动作里衣服细节会不会逐帧闪
python3 art/tools/avatar_check.py summer                   # 武器角度 / 前后 / 身高和原装差太多就报出来
python3 art/tools/avatar_review.py summer                  # 出审图
```

时装表的提示词（`set_prompt`）：

```text
The FIRST image is a 2D game sprite animation sheet (3x3 grid, 9 frames) of a chibi character holding a flat pure green stick.
The SECOND image shows the same character in a new outfit. Redraw the FIRST image exactly: the same 3x3 layout, the same poses,
the same positions and sizes of every frame, the same flat pure green (#00FF00) sticks held in exactly the same way …,
but dress the character in EVERY frame in the outfit of the second image: {时装描述}
Keep the face, the hair and the art style. No hat, no glasses, no hair ornament. Plain pure white background, no text.
```

- **每张动作表都要有时装版**，缺一张，这组动作播放时就会在两套衣服之间闪。鬼剑士 6 套时装共 96 张。
- 衣服图案逐帧不一样（闪烁）时，用 `avatar_gen.py unify` 再改一遍：提示词要求 9 格衣服 `IDENTICAL`。`avatar_unify_pick.py` 只在闪烁指标下降、轮廓 IoU 不变差时才采用新图。
- 帽子、发饰、眼镜不画进身体帧：单独出一张配件表（`avatar_gen.py acc` → `avatar_acc.py`），运行时贴在头部锚点上。转职头饰同理（`job_head_art.py gen <id> -j 3` → `prep`），转职发色是运行时染色，见 [JOB_VISUALS.md](JOB_VISUALS.md)。
- 运行时的叠放顺序：身体帧（原装或时装整套替换，混搭时按腰线 / 脚踝分三段拼）→ 身后武器 → 身体 → 身前武器 + 握拳像素盖回去 → 头部配件 → 转职外观 → 强化光效。

### 3.8 修一格而不是重出一整张

一张表里只有一两格不对（手指多了、武器方向反了）时，不要整张重出：

```bash
python3 art/tools/avatar_gen.py touch --sheet <表.png> --cells 0,3,7 --prompt "<这一格要改什么>"   # 裁出这一格 → 放大到 1024 → 改图 → 按身体高度缩回 → 脚底对齐贴回
python3 art/tools/avatar_gen.py recell --only summer/mage_react2 --cells 8                      # 时装表的某一格按原装那一格重画
python3 art/tools/witch_cellfix.py <表.png> 4 "<改动>"                                           # 同类小工具
```

改之前的原图会备份到 `_pre/`。换了姿势就加 `--keep`，这时不按身体高度缩放。

### 3.9 技能图标、觉醒插图、转职立绘

```bash
python3 art/tools/combatgen.py icons --only <表名>         # 图标表：4 列网格、每张 8~16 个 → icons.py 切成 104px webp
python3 art/tools/icons.py --combat --only <表名>
python3 art/tools/combatgen.py cutin --only blade          # 觉醒插图 1536×1024 → cutinprep 去底、缩到 720×480
python3 art/tools/combatgen.py cutinprep --only blade
python3 art/tools/job_art.py                               # 转职立绘 → art/final/job/<转职>.webp
```

- 图标风格（`ICON_STYLE`）：`cute cartoon mobile RPG icon style, bold clean outlines, bright saturated colors, soft shading, glossy and polished; every icon is a rounded square tile with its own colored background and a thick dark border`。
- 图标表提示词：`A sprite sheet of {n} separate game icons arranged in a grid of 4 columns … evenly spaced with generous white gaps between icons, no icon touching another … (1) … No text, no numbers, no labels.`
- 觉醒插图提示词：`Using this exact chibi character (same design, same colors, same cute art style), draw a dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {动作}. Plain pure white background, no text.` 其中动作如 `summoning a storm of glowing spectral swords around him, katana raised, cyan sword light`。
- 装备图标（`gear_icons.py list | gen <表> | cut <表|all>`）：3×2 一张 6 件，用已有的史诗图标表当画风参考。发光的金边去白底后变成半透明的金色，不留白边。

### 3.10 怪物、领主、召唤物、区域背景

新区域一条命令出齐（区域数据和美术共用一份 spec，见 [REGION_PIPELINE.md](REGION_PIPELINE.md)）：

```bash
python3 art/tools/region_art.py <id> refs,bg,review1 --sample   # 先出设定图 + 一张远景 → review_refs.png 给主线程审
PAR=4 python3 art/tools/region_art.py <id>                      # 通过后跑完整条：refs, bg, review1, sheets, cut, norm, outline, edge, bgcut, world, icons, review
```

- 怪物设定图提示词和玩家一样，只多一句 `NOFX`：`No visual effects at all … Do not use pure green or magenta anywhere.`。四足怪用 `QUAD_POSE`，走路改用小跑 / 滚动 / 爬行的步态描述。
- **白色角色要写 `holes: false`**，否则去洞会把白毛当成背景挖掉。
- 精灵名是全局的，工具发现和已有角色重名会停下，改个名字就行。
- 大量怪物是**已有精灵换色**（色相 / 饱和度 / 亮度），不重新生图。灰色底的精灵换色效果接近随机，要逐个看。
- 背景分三层：远景 3840×2160、地面贴图、前景边缘条（`edge_prompt` 以远景为参考，只画在底部 35%）。`bgs.py` 切成游戏用的尺寸。
- 召唤物：`summon_art.py` → `summon_scale.py --apply`（和玩家比例对齐）→ `summon_strip.py`（出一张和角色同屏的审图）。

---

## 4. 审图：先样图，再批量

1. **样图**：每一类新东西先出 1 张（设定图、1 张动作表、1 把武器、1 张图标表），不要“多抽几张比较”。
2. **拼总览图审**：多张图先用 PIL 拼成一张再看，比如 `review_refs.png`、`weapon_review.py` 的对比图，或者 `node test/skillshots.mjs <职业:转职>` 的技能连拍总览。审图的人只看这一张。
3. **看什么**：
   - 画风和现有 Q 版一致，和角色站在一起的比例对。
   - 时装版本逐帧对得上。
   - **没有烘焙特效**（烟、火花、光束、动作线、眩晕圈都应该是运行时特效）。
   - 道具没有用纯绿或品红，衣着保守。
4. **通过后一次批量**：同一条命令去掉 `--sample` / `--only`，已有的图自动跳过。
5. **进游戏验证**：
   - `node test/avatar.mjs`：换装和锚点。
   - `node test/weapons.mjs shots <keys> <out.jpg>`：武器拿在手里的样子。
   - `node test/jobvisuals.mjs heads`：转职头饰。
   - `WEB=1 node test/animfeel.mjs <职业> <名>`：跑动手感，看帧停留、身体跳动、脚底打滑。

常见打回：召唤物和玩家撞色、领主不够大、写实画风（不是 Q 版）、巨剑不够宽、刀尖带钩。

---

## 5. 成本（生图次数）

| 项目 | 生图次数 |
|---|---|
| 一个基础职业 | 设定图 3~4 + 动作表 15~19 + 标记棒版 15~19 + 时装（6 张参考 + 表数 × 6，鬼剑士 96）+ 每转职图标 2~3 表 + 觉醒插图 3 + 转职立绘 1 |
| 新职业（男格斗家计划） | 老做法约 230 次；推荐做法约 **130 次**（4×4 表、原装直接画标记棒；见 [CLASS_PLAN_FIGHTER.md §3.3](CLASS_PLAN_FIGHTER.md)） |
| 武器 v2 | 163 把，约 180 次（一把一张）；样图 10 把一次过审 |
| 一款武器装扮 | 15 种武器类型各 1 张，约 40 分钟（大部分时间在等生图） |
| 一个 60 版本区域 | 60~75 次（设定图 + 动作表 + 背景 + 图标）；两个区域 12 个新角色约 110 次（6 路并发） |
| 深渊 | 2 个图标，1 次 |
| 转职外观（15 个转职） | 头饰 14 张；状态特效全部复用已有素材 |

---

## 6. 踩过的坑

| 现象 | 原因 / 解法 |
|---|---|
| 同一角色每张表比例不一样 | 每张表第 1 格画标准站姿，切图时按它统一缩放；表里写 `exactly the SAME scale` |
| 走路顺拐、手脚同侧 | 姿势引导用蓝 / 红区分近 / 远侧，提示词写明 `the arms always swing opposite to the legs` |
| 跑步第 3、7 帧站直、步幅太短 | 目前运行时做归一和缓动补救（[ANIMATION.md](ANIMATION.md)），根本解决要重画长步幅、腾空帧 |
| 改图后金色护手 / 戒指还在 | 在提示词里点名擦掉（`EXTRA` / `RING`） |
| 手雷、加特林被当成武器换掉 | `NOTES` 里写一句 “NOT the revolver: keep it exactly as it is” |
| 举过头顶的武器伸进上一行的格子 | 绿棒按“和哪个身体相连”分配，不按最近的格子 |
| 白色衣服、翅膀、白毛被挖掉 | 1/8 分辨率泛洪（缝隙要宽于 8 像素才会漏）+ 和原装表对比；怪物写 `holes: false` |
| 时装细节逐帧闪 | `unify` 再改一遍 + 闪烁指标（`avatar_flicker.py`） |
| 重画后默认帽子没了 | `avatar_hatcheck.py` 统计帽子特有的颜色 |
| 新加的技能帧不显示帽子 | 新帧没有头部锚点，跑 `avatar_head.py … --frames …` 和 `avatar_cuts.py` |
| 巨剑像长剑、太刀像一根线、刀尖带钩 | `THICK` 写死比例和 STRAIGHT；批量后先拼缩略图扫一遍再切 |
| 一张 6 把钝器粘在一起切不开 | 大头武器改成一张 3 把，后来改成一把一张 |
| 多把一张表缩到游戏里只剩 75 像素 | 改成一把一张 1536×1024，切图存 3 倍 |
| 粉色宝石高光里夹着纯品红 | 切图时 `demarker` 压一点蓝 |
| “坐在锤头上的黄色小雷精”被安全审核拒 | 描述太像某个知名角色，换一种写法 |
| 图标表边缘有一条深色边框，切出来只剩碎片 | 切之前把表的四边刷白（`region_art.py icons` 已内置） |
| 精灵名和已有角色重名，被覆盖 | `region_art.py` 发现重名就停下 |
| 插图去白底后留白斑 | `clear_holes` 放宽阈值 + 保护区（白衬衫、月亮）恢复原 alpha |
| 缓存的参考图地址过期、缓存 JSON 被写坏 | 参考图直接传本地路径（`'local:' + 路径`） |

---

## 7. 多智能体协作

这套美术是 AI 智能体团队在 1 天内做出来的，分工方式如下（详见 [PLAYBOOK.md](PLAYBOOK.md)）：

- **主线程**：拆任务、写每个子任务的范围和验收标准、**审图**（只看总览图）、合并、统一跑测试、部署。
- **子智能体**：每个职业 / 转职 / 区域 / 系统一个，各自在独立的 **git worktree** 里干活。原图共享主仓库的 `art/src/`（`ART_MAIN`），产物各自提交到自己的分支。
- **规则**：
  - 只改自己范围内的文件，共享文件找负责人。
  - 样图 → 主线程审 → 一次批量出齐。
  - 并发按账号总量分配，几个美术组合计不超过 4 路。
  - 汇报 10 行以内，做完就停。
- **可复现**：提示词常量、设计描述、切图参数都在 `art/tools/*.py` 里；原图丢了，同一条命令可以重出（AI 每次画得不完全一样，重出后需要重新审）。
- **沉淀**：每做完一件事，把流程、命令和踩过的坑写进 PLAYBOOK；一次性脚本放进 `art/tools/` 或 `tools/`。
