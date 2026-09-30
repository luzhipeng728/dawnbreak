#!/bin/sh
# 破晓地下城联机服务端：安装 / 更新脚本（在 cc 服务器上用 root 运行，可重复执行）
# 用法：sudo sh install.sh <仓库里的 server 目录>
#   例：sudo sh /tmp/dawnbreak/server/deploy/install.sh /tmp/dawnbreak/server
# 做的事：
#   1. 没有便携版 Node 22 就下载到 /opt/dawnbreak-server/runtime（系统 Node 18 不动）
#   2. 同步代码到 /opt/dawnbreak-server/app（不碰 data 目录和 .env），npm ci 装依赖（只有 ws）
#   3. 建系统用户 dawnbreak、数据目录，首次安装时生成 .env 模板（需要手动改管理员）
#   4. 安装 / 重启 systemd 服务，检查 /api/health
set -eu
SRC=${1:?用法：sh install.sh <server 目录>}
BASE=/opt/dawnbreak-server
NODE_VER=${NODE_VER:-v22.22.0}
NODE_MIRROR=${NODE_MIRROR:-https://nodejs.org/dist}   # 国内慢可以用 https://npmmirror.com/mirrors/node
ARCH=linux-x64

mkdir -p "$BASE/app" "$BASE/data" "$BASE/runtime"
id dawnbreak >/dev/null 2>&1 || useradd --system --home "$BASE" --shell /usr/sbin/nologin dawnbreak

if [ ! -x "$BASE/runtime/bin/node" ] || ! "$BASE/runtime/bin/node" -e "require('node:sqlite')" >/dev/null 2>&1; then
  echo "下载 Node $NODE_VER ..."
  TMP=$(mktemp -d)
  curl -fL "$NODE_MIRROR/$NODE_VER/node-$NODE_VER-$ARCH.tar.xz" -o "$TMP/node.tar.xz"
  rm -rf "$BASE/runtime" && mkdir -p "$BASE/runtime"
  tar -xJf "$TMP/node.tar.xz" -C "$BASE/runtime" --strip-components=1
  rm -rf "$TMP"
fi
echo "Node: $("$BASE/runtime/bin/node" -v)"

# 同步代码（保留 node_modules 以外的旧文件不删；data / .env 在 app 目录之外，不会被覆盖）
cp -R "$SRC/index.js" "$SRC/package.json" "$SRC/package-lock.json" "$SRC/lib" "$SRC/core" "$BASE/app/"
mkdir -p "$BASE/app/modules" && cp -R "$SRC/modules/." "$BASE/app/modules/" 2>/dev/null || true
cd "$BASE/app" && PATH="$BASE/runtime/bin:$PATH" npm ci --omit=dev --no-audit --no-fund

if [ ! -f "$BASE/dawnbreak.env" ]; then
  cp "$SRC/deploy/dawnbreak.env.example" "$BASE/dawnbreak.env"
  echo "!!! 已生成 $BASE/dawnbreak.env，请先改好 DNF_ADMIN 再重启服务"
fi
chmod 600 "$BASE/dawnbreak.env"
chown -R dawnbreak:dawnbreak "$BASE/data" "$BASE/app" "$BASE/dawnbreak.env"

cp "$SRC/deploy/dawnbreak-server.service" /etc/systemd/system/dawnbreak-server.service
systemctl daemon-reload
systemctl enable dawnbreak-server >/dev/null 2>&1 || true
systemctl restart dawnbreak-server
sleep 2
systemctl --no-pager --lines=5 status dawnbreak-server || true
curl -fsS http://127.0.0.1:18790/api/health && echo && echo "安装完成"
