# 联机服务端部署（cc 服务器，dnf.cc.l-hate.com）

进程只监听 `127.0.0.1:18790`，Caddy 把 `/api/*` 和 `/ws` 反代过去；网页版静态文件照旧由 Caddy 托管 `dist/web`。

## 为什么用便携版 Node 22
- 数据库用 Node 22 内置的 `node:sqlite`，没有原生模块：不需要在服务器上编译，也不用下载和 Node 18 ABI 对应的 better-sqlite3 预编译包。
- 便携版 Node 放在 `/opt/dawnbreak-server/runtime/`，系统自带的 Node 18 不受影响。
- 唯一的 npm 依赖是 `ws`（纯 JS）。

## 目录
| 路径 | 内容 |
|---|---|
| `/opt/dawnbreak-server/runtime/` | 便携版 Node 22 |
| `/opt/dawnbreak-server/app/` | 服务端代码（`server/` 目录的内容） |
| `/opt/dawnbreak-server/data/` | SQLite 数据库（**要备份的只有这个目录**） |
| `/opt/dawnbreak-server/dawnbreak.env` | 配置：邀请码、管理员（权限 600） |

## 第一次部署
1. 把仓库的 `server/` 目录传到服务器，例如 `/tmp/dawnbreak/server`（不需要 `node_modules`）。
2. `sudo sh /tmp/dawnbreak/server/deploy/install.sh /tmp/dawnbreak/server`
   - 国内下载 Node 慢的话：`sudo NODE_MIRROR=https://npmmirror.com/mirrors/node sh …/install.sh …`
   - npm 源慢的话先 `export npm_config_registry=https://registry.npmmirror.com`。
3. 编辑 `/opt/dawnbreak-server/dawnbreak.env`：
   - `DNF_INVITE`：注册邀请码（发给朋友）；
   - `DNF_ADMIN`：房主的用户名（用邀请码注册这个名字后就是管理员）。
   
   然后执行 `sudo systemctl restart dawnbreak-server`。
4. Caddy：把 `deploy/Caddyfile.snippet` 里的 `@dnfnet` / `handle` 段加进 dnf.cc.l-hate.com 的站点块（放在 file_server 之前）。reload 前先按 cc 服务器的说明加载 relay-proxy.env，然后执行 `caddy reload`。
5. 验证：
   - `curl -s http://127.0.0.1:18790/api/health` → `{"ok":true,...}`
   - `curl -s https://dnf.cc.l-hate.com/api/health` → 同上（说明反代通了）
   - 浏览器打开 https://dnf.cc.l-hate.com ，标题画面出现“登录 / 注册 / 不登录直接玩”。
   - WebSocket：登录后按 Esc →“账号信息”显示“在线（延迟 xx ms）”。
6. 前端：照常 `node build.mjs --web`，把 `dist/web` 发布上去。页面和服务端的联机协议版本（`NET_VER`）不一致时，客户端会提示刷新页面。

## 更新
- 只改了前端：发布 `dist/web` 即可。
- 改了服务端：重新执行第 2 步（会保留 data 和 .env），脚本最后会重启服务并检查健康状态。
- 队伍和地下城 / 决斗房间只存在内存里，但状态其实在队长（决斗发起方）的客户端上：重启服务后客户端自动重连，发现服务端启动编号变了，就由队长把队伍和房间重新登记回来（队员认领队长，双方对上才算数），组队刷图和决斗接着打，不回城。`DNF_RESTORE_MS`（默认 60 秒）内没回来的成员当作掉线离开。

## 日常
- 日志：`journalctl -u dawnbreak-server -f`
- 备份：`sqlite3 /opt/dawnbreak-server/data/dawnbreak.db ".backup /root/dawnbreak-$(date +%F).db"`（或者停服后直接复制 data 目录）。
- 每个账号的云存档自动保留最近 20 份历史，管理员接口：`GET /api/admin/saves/<用户名>/history`、`POST /api/admin/saves/<用户名>/restore {id}`。
- 限流：每个 IP 10 秒 120 个请求；登录 10 分钟 20 次；注册 1 小时 6 次；WS 每条连接 3 秒 300 条消息、单条 64 KB。
