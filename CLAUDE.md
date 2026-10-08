# 破晓地下城（Dawnbreak）· 项目地图

横版格斗刷图网页游戏，纯前端原生 JavaScript（无框架、无打包器），可选 Node 联机服务端。给人和 AI 助手共用：先看这一页，再按"去哪找"跳转。

## 目录

| 目录 | 是什么 |
|---|---|
| `src/` | 游戏源码。`engine` 引擎 · `models` 角色模型与外观层 · `game` 玩法 · `content` 内容数据（职业 / 技能 / 物品 / 区域 / 任务 / 商城）· `ui` 界面 · `net` 联机客户端 |
| `src/ORDER` | **构建拼接顺序**。所有源码共享同一个全局作用域，后面的文件可直接用前面定义的全局函数 / 常量；新增文件必须登记在这里 |
| `art/final/` | 最终美术素材（webp + `spr.json`），游戏运行只需要它 |
| `art/tools/` | 美术流水线脚本（Python）：生图、去底、切帧、锚点、武器、图标、区域 |
| `art/src/` 等 | AI 原图与中间文件，**不进 git**（见 `.gitignore`），只在主仓库本机存在 |
| `server/` | 联机服务端（Node ≥ 22.13，数据库用 `node:sqlite`，唯一依赖 `ws`）；`server/test/` 是它的测试 |
| `test/` | 端到端测试（Playwright + 本机 Chrome），公共部分在 `test/lib.mjs` |
| `tools/` | 部署、服务器管理、数据体检脚本 |
| `docs/` | 设计与开发文档，入口 [`docs/README.md`](docs/README.md) |
| `dist/` | 构建产物（不进 git） |

## 去哪找

- **某个文档在哪**：[`docs/README.md`](docs/README.md)（按用途分类，标明现行 / 过程记录）
- **某个脚本干什么、怎么用**：[`docs/SCRIPTS.md`](docs/SCRIPTS.md)（自动生成，按用途分类）
- **想加内容（职业 / 装备 / 区域 / 任务 / 武器装扮 / 美术）**：`README.md` 的"想加点东西？"表
- **踩过的坑与常用命令**：[`docs/PLAYBOOK.md`](docs/PLAYBOOK.md)，开工前先扫一眼

## 常用命令

```bash
node build.mjs                  # 构建：dist/web/（网页版）+ dist/dawnbreak.html（离线单文件）
node build.mjs --web            # 只出网页版（快）；--offline 只出离线版
cd server && npm install && npm start     # 本地联机服务端

node test/flow.mjs              # 全流程冒烟，必跑
node test/affected.mjs          # 按改动的文件挑测试跑（日常开发用这个）
node test/affected.mjs --dry    # 只看会跑哪些
sh test/quick.sh                # 快速回归（合并一批改动后）
sh test/all.sh                  # 完整回归（大阶段合并后；跑的时候不要重新构建）

node tools/gen_scripts_index.mjs --check    # 脚本索引是否最新、脚本是否都有文件头说明
sh tools/deploy.sh web|server|all           # 部署到线上，见下方"部署"
```

调试参数（加在页面网址后）：`?town&cls=gun` 进城、`?dungeon=lorien&lv=10` 进地下城、`?test&cls=mage&mon=goblin` 测试房间、`?fresh` 忽略存档、`?mute` 静音，完整表见 `README.md`"调试参数"。

## 约定（改代码前必读）

- **测试读构建产物**：测试默认加载 `dist/dawnbreak.html`，改了 `src/` 要先 `node build.mjs` 再跑测试。
- **测试串行**：同时开多个无头浏览器时，时序敏感的测试会偶发失败。`affected.mjs` / `quick.sh` / `boss.mjs` 共用并发名额（`test/testlock.mjs`，默认 3 套），不要绕过。
- **新增源码文件**：写进 `src/ORDER`，并放在它依赖的文件之后。
- **新增脚本**：文件最前面写一行说明（`.py` 用模块文档字符串，`.mjs` / `.sh` 用注释），然后 `node tools/gen_scripts_index.mjs` 更新 `docs/SCRIPTS.md`。
- **新增文档**：登记到 `docs/README.md` 对应分类，标明状态。
- **美术**：全部由 gpt-image 生成，走 `art/tools/` 流水线，不手改 `art/final/` 里的成品；流程见 `docs/ART_PIPELINE.md`。生图有速率限制，并发最多 2，遇 429 要退避。
- **存档兼容**：存档在浏览器 / 服务端数据库里，改存档结构要保证旧存档能迁移（`src/game/save.js`）。
- **部署**：`tools/deploy.sh` 直接影响线上玩家。动手前先读 `README.md`"部署"和 `server/deploy/DEPLOY.md`，确认目标环境；服务端部署会先备份数据库，但仍不要在没有明确要求时执行。
- **提交**：Conventional Commits（`feat(scope): ...` / `fix` / `chore` / `refactor` / `test` / `docs`），提交前跑相关测试。
