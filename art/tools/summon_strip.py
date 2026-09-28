#!/usr/bin/env python3
"""召唤兽的游戏内比例连拍：按 spr.json 的锚点和 res 把帧换算成游戏里的大小，站在城镇背景上排一排，最左边放魔法师站姿做对照。
  summon_strip.py [--bg 主题] <id...>   → <主仓库>/art/src/summon/_<id>_strip.png（换背景时文件名带 _<主题>）
帧顺序：待机 → 走路 → 攻击 → 施法（BUFF）→ 受击 → 倒地。
"""
import os, sys, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
OUT = os.path.join(MAIN, 'src', 'summon')
SEQ = ['idle', 'walk1', 'walk3', 'walk5', 'walk7', 'atk1', 'atk2', 'atk3', 'atk4', 'cast1', 'cast2', 'idle2', 'hit1', 'hit2', 'down']
ZOOM = 1.5   # 世界单位 → 输出像素

def frame(key, n):
    d = os.path.join(HERE, 'final', 'spr', key); meta = json.load(open(os.path.join(d, 'spr.json'))); F = meta['frames'].get(n)
    if not F: return None
    im = Image.open(os.path.join(d, n + '.webp')).convert('RGBA'); k = ZOOM / meta.get('res', 2.0)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS), F['ax'] * k, F['ay'] * k

def strip(name, theme='town', vs=('mage',), seq=SEQ):
    items = [(v, 'idle') for v in vs] + [(name, n) for n in seq]
    fr = [(k, n, frame(k, n)) for k, n in items]; fr = [x for x in fr if x[2]]
    gap = 26; W = sum(round(f[2][0].width) + gap for f in fr) + 60; H = 420
    bg = Image.new('RGBA', (W, H), (120, 150, 190, 255))
    try:
        far = Image.open(os.path.join(HERE, 'final', 'bg', f'{theme}_far.webp')).convert('RGBA'); floor = Image.open(os.path.join(HERE, 'final', 'bg', f'{theme}_floor.webp')).convert('RGBA')
        fh = 300; far = far.resize((round(far.width * fh / far.height), fh))
        for x in range(0, W, far.width): bg.paste(far, (x, 0))
        fl = floor.resize((round(floor.width * 140 / floor.height), 140))
        for x in range(0, W, fl.width): bg.paste(fl, (x, 290))
    except Exception as e: print('背景', e)
    dr = ImageDraw.Draw(bg); base = 340; x = 40
    for k, n, (im, ax, ay) in fr:
        cx = x + ax; bg.alpha_composite(im, (round(cx - ax), round(base - ay)))
        dr.text((round(x), base + 30), n if not k.startswith('mage') else k.replace('mage', '魔法师'), fill=(255, 255, 255, 255)); x += im.width + gap
    out = os.path.join(OUT, f'_{name}_strip.png' if theme == 'town' else f'_{name}_strip_{theme}.png'); bg.convert('RGB').save(out); print(out, bg.size)

if __name__ == '__main__':
    a = sys.argv[1:]; theme = 'town'
    if '--bg' in a: i = a.index('--bg'); theme = a[i + 1]; a = a[:i] + a[i + 2:]
    vs = ('mage',)
    if '--vs' in a: i = a.index('--vs'); vs = tuple(a[i + 1].split(',')); a = a[:i] + a[i + 2:]
    for n in a:
        if len(vs) > 1: strip(n, theme, vs, ['idle', 'walk3', 'atk2', 'cast1', 'idle2']); import shutil; shutil.move(os.path.join(OUT, f'_{n}_strip.png' if theme == 'town' else f'_{n}_strip_{theme}.png'), os.path.join(OUT, f'_{n}_vs.png')); print(os.path.join(OUT, f'_{n}_vs.png'))
        else: strip(n, theme)
