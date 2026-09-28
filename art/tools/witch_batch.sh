#!/bin/sh
# 魔道学者美术批量（两路并发，每路串行）：
#   sh art/tools/witch_batch.sh a   图标 / 一觉机械 / 觉醒插图 / 助手立绘（witch_art2.py）
#   sh art/tools/witch_batch.sh b   二觉 / 三觉的机械与召唤物：参考立绘 → 动作表（witch_art.py），最后是四个助手的动作表
cd "$(dirname "$0")/../.." || exit 1
if [ "$1" = a ]; then
  python3 art/tools/witch_art2.py helpers
  python3 art/tools/witch_art2.py icons --only wt_icons_a
  python3 art/tools/witch_art2.py awk
  python3 art/tools/witch_art2.py cutin
  python3 art/tools/witch_art2.py icons --only wt_icons_b
else
  for n in rabbit shaved trickjack ouro coaster candyDoll; do python3 art/tools/witch_art.py refs --only $n; done
  for n in rabbit shaved trickjack ouro coaster candyDoll; do python3 art/tools/witch_art.py sheets --only $n --sheets act; done
  for n in helperJack helperSnow helperEel helperCat; do
    while [ ! -f "/Users/luzhipeng/projects/dawnbreak/art/src/witch/${n}_ref.png" ]; do sleep 20; done
    python3 art/tools/witch_art.py sheets --only $n --sheets act
  done
fi
echo "batch $1 done"
