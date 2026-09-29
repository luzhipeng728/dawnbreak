#!/bin/sh
# 线上运维一条命令（服务器 cc）。写操作前自动备份数据库；写存档另外留一份 save_history（可从管理员后台恢复）。
#   sh tools/admin/admin.sh users                                   列出所有账号 / 角色 / 点券
#   sh tools/admin/admin.sh cera <账号> <点券>                        发点券邮件（大于 1000 万会自动拆成多封）
#   sh tools/admin/admin.sh item <账号> <物品key> <数量> [标题]         发物品邮件（key 见 src/content，例 tk_enh10 = +10 强化券）
#   sh tools/admin/admin.sh maxout <账号> [职业=转职,...] [额外点券]    角色全部满级 / 任务全完成 / 三觉 / 技能学满 / 最强装备 +12
#       例：sh tools/admin/admin.sh maxout luzhipeng sword=soulbender 99999999
#   sh tools/admin/admin.sh maxout <账号> '' <点券> '职业:转职:等级:max|normal:名字,...'   新建角色（只处理新建的）
#       例：sh tools/admin/admin.sh maxout luzhipeng '' 999999 'sword:berserker:30:max:血狱狂战,sword:berserker:20:normal:狂战练级'
#       做完让玩家刷新页面；弹“存档冲突”时选“使用云端存档”
set -e
cd "$(dirname "$0")/../.."
HOST=cc DB=/opt/dawnbreak-server/data/dawnbreak.db NODE=/opt/dawnbreak-server/runtime/bin/node
W=${TMPDIR:-/tmp}/dnf-admin; mkdir -p "$W"
scp -q tools/admin/remote.js $HOST:/tmp/dnf-remote.js
R() { ssh $HOST "$NODE --disable-warning=ExperimentalWarning /tmp/dnf-remote.js $DB $*"; }
RW() { ssh $HOST "sudo /opt/dawnbreak-server/backup.sh && sudo -u dawnbreak $NODE --disable-warning=ExperimentalWarning /tmp/dnf-remote.js $DB $*"; }
case "$1" in
  users) R users ;;
  cera)
    left=$3
    while [ "$left" -gt 0 ]; do n=$left; [ $n -gt 10000000 ] && n=10000000; RW mail "$2" $n; left=$((left - n)); done ;;
  item)
    case "$2$4" in *[!A-Za-z0-9_.@-]*|'') echo "账号或数量不对（账号不能有空格，数量要是数字）：'$2' '$4'"; exit 1 ;; esac
    case "$4" in *[!0-9]*) echo "数量要是数字：$4"; exit 1 ;; esac
    grep -q "defCashUse('$3'\|defineItem('$3'\|^  $3:" -r src/content || { echo "物品库里没有 $3"; exit 1; }
    RW item "$2" "$3" "$4" "'${5:-物品补给}'" ;;
  maxout)
    R dump "$2" > "$W/cloud.json"
    node build.mjs | tail -1
    node tools/admin/maxout.mjs "$W" "$3" "${4:-0}" "$5"
    node tools/admin/verify_save.mjs "$W" | tail -3
    scp -q "$W/maxed.json" $HOST:/tmp/dnf-maxed.json
    RW put "$2" /tmp/dnf-maxed.json maxout
    ssh $HOST 'rm -f /tmp/dnf-maxed.json' ;;
  *) sed -n 2,9p "$0"; exit 1 ;;
esac
ssh $HOST 'rm -f /tmp/dnf-remote.js'
