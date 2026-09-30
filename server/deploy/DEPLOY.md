# 联机服务端部署（cc 服务器，dnf.cc.l-hate.com）

进程只监听 `127.0.0.1:18790`，Caddy 把 `/api/*`、`/ws` 和 `/admin`（后台管理页面）反代过去；网页版静态文件照旧由 Caddy 托管 `dist/web`。

## 为什么用便携版 Node 22
- 数据库用 Node 22 内置的 `node:sqlite`，没有原生模块：不需要在服务器上编译，也不用下载和 Node 18 ABI 对应的 better-sqlite3 预编译包。
- 便携版 Node 放在 `/opt/dawnbreak-server/runtime/`，系统自带的 Node 18 不受影响。
- 唯一的 npm 依赖是 `ws`（纯 JS）。

## 目录
| 路径 | 内容 |
|---|---|
| `/opt/dawnbreak-server/runtime/` | 便携版 Node 22 |
| `/opt/dawnbreak-server/app/` | 服务端代码（`server/` 目录的内容） |
| `/opt/dawnbreak-server/app/admin/` | 后台管理页面（`server/admin/`：index.html / admin.css / admin.js） |
| `/opt/dawnbreak-server/data/` | SQLite 数据库（**要备份的只有这个目录**）；`data/backups/` 是后台“删除账号”前自动做的整库备份 |
| `/opt/dawnbreak-server/dawnbreak.env` | 配置：管理员（权限 600） |

## 第一次部署
1. 把仓库的 `server/` 目录传到服务器，例如 `/tmp/dawnbreak/server`（不需要 `node_modules`）。
2. `sudo sh /tmp/dawnbreak/server/deploy/install.sh /tmp/dawnbreak/server`
   - 国内下载 Node 慢的话：`sudo NODE_MIRROR=https://npmmirror.com/mirrors/node sh …/install.sh …`
   - npm 源慢的话先 `export npm_config_registry=https://registry.npmmirror.com`。
3. 编辑 `/opt/dawnbreak-server/dawnbreak.env`：
   - 注册不需要邀请码；
   - `DNF_ADMIN`：管理员的用户名（逗号分隔，不区分大小写）。**注册是开放的，一定要先在游戏里注册这个名字、再写进 `DNF_ADMIN`**——写进去但还没注册的名字，谁先注册谁就是管理员（服务端启动时会打一行“警告：DNF_ADMIN 里的「xx」还没有注册”）；
   - `DNF_CATALOG=/opt/dawnbreak/catalog.json`：网页版的物品目录，后台发物品邮件时用它校验 key（不设也能用，只校验格式）。
   
   然后执行 `sudo systemctl restart dawnbreak-server`。
4. Caddy：把 `deploy/Caddyfile.snippet` 里的 `@dnfnet` / `handle` 段加进 dnf.cc.l-hate.com 的站点块（放在 file_server 之前）。匹配里要有 `/admin /admin/*`（后台管理页面由服务端托管，不在 dist/web 里）。reload 前先按 cc 服务器的说明加载 relay-proxy.env，然后执行 `caddy reload`。
5. 验证：
   - `curl -s http://127.0.0.1:18790/api/health` → `{"ok":true,...}`
   - `curl -s https://dnf.cc.l-hate.com/api/health` → 同上（说明反代通了）
   - 浏览器打开 https://dnf.cc.l-hate.com ，标题画面出现“登录 / 注册 / 不登录直接玩”。
   - WebSocket：登录后按 Esc →“账号信息”显示“在线（延迟 xx ms）”。
6. 前端：照常 `node build.mjs --web`，把 `dist/web` 发布上去。页面和服务端的联机协议版本（`NET_VER`）不一致时，客户端会提示刷新页面。

## 后台管理（/admin）
- 地址：https://dnf.cc.l-hate.com/admin/ 。用 `DNF_ADMIN` 里的游戏账号和密码登录（不是管理员的账号会被拒绝）；账号密码不写进仓库。
- 加一个管理员：先在游戏里注册这个用户名 → 把名字加进 `/opt/dawnbreak-server/dawnbreak.env` 的 `DNF_ADMIN`（逗号分隔）→ `sudo systemctl restart dawnbreak-server`。去掉管理员同理（去掉名字再重启）。
- 能做的事：概况（注册 / 在线 / 职业分布 / 报错 / 服务器）、账号（搜索 / 排序 / 详情：角色、装备、邮件、登录会话、日志；封禁 / 解封、踢下线、重设密码、删除 / 恢复）、注册记录（注册 IP，同一个 IP 注册 3 个以上标红）、发邮件（金币 / 点券 / 物品带强化，点券超过 1000 万自动拆成多封，先预览再发，发送记录带领取进度）、全服公告、在线玩家、客户端报错、操作日志。接口见 docs/NETWORK.md「后台管理」。
- 删除账号是软删除：输入完整用户名确认后，先把整库 `VACUUM INTO` 备份到 `data/backups/dawnbreak-<时间>-pre-delete-<id>.db`，再停用 + 标记删除（存档、邮件都留着，在“已删除”里可以恢复）。一般用封禁就够了。备份文件不会自动清理，空间紧张时手动删旧的。
- 所有写操作（封禁、踢下线、重设密码、删除、发邮件、公告）都记在操作日志（svc_log，谁 / 做了什么 / 什么时候）。
- 物品选择器用网页版构建时生成的 `/catalog.json`（`tools/item_catalog.mjs`，`node build.mjs` 自动生成，随 `deploy.sh web` 一起发布）。
- 游戏里的“管理”窗口照旧能用（发放 / 在线 / 公告 / 日志 / 拍卖行），邀请码页签已去掉。

## 更新
- 只改了前端：发布 `dist/web` 即可。
- 改了服务端：重新执行第 2 步（会保留 data 和 .env），脚本最后会重启服务并检查健康状态。`server/admin/`（后台页面）也在这一步更新。
- 队伍和地下城 / 决斗房间只存在内存里，但状态其实在队长（决斗发起方）的客户端上：重启服务后客户端自动重连，发现服务端启动编号变了，就由队长把队伍和房间重新登记回来（队员认领队长，双方对上才算数），组队刷图和决斗接着打，不回城。`DNF_RESTORE_MS`（默认 60 秒）内没回来的成员当作掉线离开。

## 日常
- 日志：`journalctl -u dawnbreak-server -f`
- 备份：`sqlite3 /opt/dawnbreak-server/data/dawnbreak.db ".backup /root/dawnbreak-$(date +%F).db"`（或者停服后直接复制 data 目录）。
- 每个账号的云存档自动保留最近 20 份历史，管理员接口：`GET /api/admin/saves/<用户名>/history`、`POST /api/admin/saves/<用户名>/restore {id}`。
- 限流：每个 IP 10 秒 120 个请求；登录 10 分钟 20 次；注册 1 小时 6 次；WS 每条连接 3 秒 300 条消息、单条 64 KB。
