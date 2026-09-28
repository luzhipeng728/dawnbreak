#!/bin/sh
# 部署到线上（dnf.cc.l-hate.com）。前端：构建 → rsync dist/web → 核对首页一致；服务端：先备份数据库再装。
#   sh tools/deploy.sh web        只发前端（大多数改动）
#   sh tools/deploy.sh server     只发服务端（改了 server/ 才需要，会重启服务，正在组队 / 决斗的人会自动恢复）
#   sh tools/deploy.sh all
# 注意：完整回归（test/all.sh）跑的时候不要重新构建，会把正在加载页面的测试弄超时。
set -e
cd "$(dirname "$0")/.."
web() {
  node build.mjs | tail -1
  rsync -az dist/web/ cc:/opt/dawnbreak/
  L=$(md5 -q dist/web/index.html 2>/dev/null || md5sum dist/web/index.html | cut -d' ' -f1)
  R=$(curl -s https://dnf.cc.l-hate.com/ | (md5 -q 2>/dev/null || md5sum | cut -d' ' -f1))
  [ "$L" = "$R" ] && echo "前端已上线（首页一致）" || { echo "前端首页和本地不一致"; exit 1; }
}
server() {
  ssh cc 'sudo /opt/dawnbreak-server/backup.sh'
  rsync -az --delete --exclude node_modules --exclude data --exclude test server/ cc:/tmp/dawnbreak-server-src/
  ssh cc 'NODE_MIRROR=https://npmmirror.com/mirrors/node sh /tmp/dawnbreak-server-src/deploy/install.sh /tmp/dawnbreak-server-src 2>&1 | tail -2'
  curl -s https://dnf.cc.l-hate.com/api/health; echo
}
case "$1" in web) web ;; server) server ;; all) server; web ;; *) sed -n 2,6p "$0"; exit 1 ;; esac
