#!/bin/sh
# 部署到线上（dnf.cc.l-hate.com）。前端：构建 → rsync dist/web（version.json 最后传）→ 核对首页和版本号一致；服务端：先备份数据库再装。
# 在线的页面每分钟拉一次 version.json，版本号变了就提示玩家更新（net/liveupdate.js）；更新说明默认取最近的 feat / fix 提交标题，可用 NOTES='…' sh tools/deploy.sh web 指定
#   sh tools/deploy.sh web        只发前端（大多数改动）
#   sh tools/deploy.sh server     只发服务端（改了 server/ 才需要，会重启服务，正在组队 / 决斗的人会自动恢复）
#   sh tools/deploy.sh all
# 注意：完整回归（test/all.sh）跑的时候不要重新构建，会把正在加载页面的测试弄超时。
# 前端只构建网页版（--web，不出 175 MB 的离线单文件 dist/dawnbreak.html，测试要用它时 quick.sh / all.sh 会自己重建）；不接 | tail，构建失败时 set -e 直接停下
set -e
cd "$(dirname "$0")/.."
web() {
  node build.mjs --web
  rsync -az --exclude version.json dist/web/ cc:/opt/dawnbreak/
  L=$(md5 -q dist/web/index.html 2>/dev/null || md5sum dist/web/index.html | cut -d' ' -f1)
  # 先在 cc 上核对静态文件；本机可能无法穿过公网代理访问 Caddy，不能因此
  # 在 version.json 上传前中止，留下“文件已更新、版本号仍旧”的半发布状态。
  R=$(ssh cc 'md5sum /opt/dawnbreak/index.html' | cut -d' ' -f1)
  [ "$L" = "$R" ] || { echo "前端首页和本地不一致（没有更新 version.json，玩家不会收到更新提示）"; exit 1; }
  # 首页和素材都到位了才发版本号：玩家收到提示时新文件一定已经在服务器上
  rsync -az dist/web/version.json cc:/opt/dawnbreak/version.json
  ID=$(node -p "require('./dist/web/version.json').id")
  RID=$(ssh cc 'node -p "require(\"/opt/dawnbreak/version.json\").id"')
  [ "$RID" = "$ID" ] || { echo "cc version.json 和本地（$ID）不一致"; exit 1; }
  if PUB=$(curl -fsS --max-time 15 "https://dnf.cc.l-hate.com/version.json?t=$(date +%s)" 2>/dev/null); then
    case "$PUB" in *"\"$ID\""*) ;; *) echo "公网 version.json 和本地（$ID）不一致"; exit 1 ;; esac
  else
    echo "公网回读不可用，已用 cc 本机文件和版本号完成校验"
  fi
  echo "前端已上线（首页一致，版本 $ID）"
}
server() {
  ssh cc 'sudo /opt/dawnbreak-server/backup.sh'
  rsync -az --delete --exclude node_modules --exclude data --exclude test server/ cc:/tmp/dawnbreak-server-src/
  rsync -az src/game/raid_core.js cc:/tmp/dawnbreak-server-src/lib/raid_core.js   # 团本规则核心：浏览器和服务端共用同一个文件（server/modules/raid.js 用 node:vm 加载）
  ssh cc 'NODE_MIRROR=https://npmmirror.com/mirrors/node sh /tmp/dawnbreak-server-src/deploy/install.sh /tmp/dawnbreak-server-src 2>&1 | tail -2'
  if ! curl -fsS --max-time 15 https://dnf.cc.l-hate.com/api/health; then
    echo "公网健康接口回读不可用，改用 cc 本机健康接口"
    ssh cc 'curl -fsS --max-time 10 http://127.0.0.1:18790/api/health'
  fi
  echo
}
case "$1" in web) web ;; server) server ;; all) server; web ;; *) sed -n 2,6p "$0"; exit 1 ;; esac
