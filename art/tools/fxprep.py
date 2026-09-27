#!/usr/bin/env python3
"""特效素材：发光类（黑底）→ 亮度转透明度（alpha = 最亮通道，颜色反预乘），裁到内容，按用途缩放；实体类（白底）→ 抠图。输出 art/final/fx/*.webp"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 名字: 最长边像素（游戏世界按 2 倍像素渲染，按最大显示尺寸 ×2 取）
GLOW = {'slash': 320, 'thrust': 384, 'slashx': 320, 'spark': 192, 'crit': 256, 'explosion': 320, 'pillar': 384, 'fireball': 192,
        'icespike': 224, 'frost': 448, 'lightning': 512, 'orb': 128, 'tornado': 384, 'vortex': 320, 'wave': 256, 'shock': 448,
        'muzzle': 128, 'meteor': 288, 'heal': 320, 'poison': 256, 'rune': 384, 'hexagram': 384, 'aura': 320, 'burst': 384, 'bullet': 192}
SOLID = {'dust': 128, 'rock': 64, 'grenade': 64, 'bomb': 72}

def glow_to_rgba(im, floor=14):
    a = np.array(im.convert('RGB')).astype(np.float32)
    a = np.clip((a - floor) * 255 / (255 - floor), 0, 255)          # 压掉接近黑色的底噪
    al = a.max(-1)
    rgb = np.where(al[..., None] > 0, a * 255 / np.maximum(al[..., None], 1), 0)
    return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')

def fit(im, m):
    bb = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
    if bb: im = im.crop(bb)
    s = m / max(im.size)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

# 战斗组新增的技能特效（原图在主仓库 art/src/combat/fx，生成见 combatgen.py）
COMBAT_GLOW = {'ghost': 320, 'crossx': 256, 'swordrain': 256, 'bloodwave': 320, 'bloodhand': 320, 'bloodpillar': 384, 'lava': 320, 'dragonfang': 384,
               'chaser': 96, 'laser': 512, 'flame': 256, 'shell': 128, 'quantum': 256, 'darkorb': 192, 'eel': 128, 'petal': 256, 'thunderbolt': 512, 'elemmeteor': 256}
COMBAT_SOLID = {'icewall': 192, 'jack': 96, 'jackbig': 256, 'snowman': 128}

def main():
    """fxprep.py            处理 art/src/fx 下的特效原图
       fxprep.py --combat   处理战斗组的特效原图（主仓库 art/src/combat/fx）"""
    out = os.path.join(ROOT, 'final', 'fx'); os.makedirs(out, exist_ok=True); tot = 0
    glow, src = GLOW, os.path.join(ROOT, 'src', 'fx')
    todo = {**GLOW, **SOLID}
    if '--combat' in sys.argv:
        from combatgen import OUT
        glow, src, todo = COMBAT_GLOW, os.path.join(OUT, 'fx'), {**COMBAT_GLOW, **COMBAT_SOLID}
    for n, m in todo.items():
        p = os.path.join(src, f'{n}.png')
        if not os.path.exists(p): print('missing', n); continue
        im = glow_to_rgba(Image.open(p)) if n in glow else remove_bg(Image.open(p))
        im = fit(im, m); f = os.path.join(out, f'{n}.webp'); im.save(f, 'WEBP', quality=80, method=6)
        tot += os.path.getsize(f); print(f'{n:10s} {im.size}  {os.path.getsize(f) // 1024}K')
    print('total', tot // 1024, 'KB')

if __name__ == '__main__':
    main()
