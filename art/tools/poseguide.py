#!/usr/bin/env python3
"""走 / 跑姿势参考图：3×3 格，第 1 格站立，其余 8 格是一个完整的步态循环。
蓝色 = 近侧（离观众近、画在身体前面）的手和腿，红色 = 远侧。手臂与腿严格反向摆动（近侧腿在前时远侧手在前）。
输出 art/src/guide_walk.png、guide_run.png（2048×2048，白底）"""
import math, os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 2048; CELL = S // 3
NEAR, FAR, BODY, HEAD, OUT = (40, 110, 235), (225, 55, 55), (150, 150, 158), (200, 200, 206), (30, 30, 36)
# 比例（像素，按 Q 版：大头）
HEAD_R, NECK, TORSO, UA, FA, TH, SH, FOOT, W = 88, 14, 120, 66, 60, 78, 74, 44, 30

def rad(d): return math.radians(d)
def seg(p, ang, length):   # 角度：0 = 竖直向下，正值 = 向前（面朝右）
    return (p[0] + math.sin(rad(ang)) * length, p[1] + math.cos(rad(ang)) * length)

def pose_at(phase, run):
    """phase：0 = 近侧腿在前刚着地。返回各段角度（度）与额外离地高度。"""
    A_TH, A_KNEE, A_ARM = (40, 105, 48) if run else (26, 58, 26)
    def leg(ph):
        ph %= 360
        th = A_TH * math.cos(rad(ph))
        knee = (10 if run else 6) * math.sin(rad(ph)) if ph < 180 else A_KNEE * math.sin(rad(ph - 180))
        return th, th - knee
    nth, nsh = leg(phase); fth, fsh = leg(phase + 180)
    arm = A_ARM * math.cos(rad(phase))
    fa_bend = 85 if run else 22
    return {'lean': 14 if run else 4, 'nth': nth, 'nsh': nsh, 'fth': fth, 'fsh': fsh,
            'nua': -arm, 'nfa': -arm + fa_bend, 'fua': arm, 'ffa': arm + fa_bend,
            'lift': (26 if run and phase % 180 == 90 else 0)}

def draw_figure(d, cx, base, P):
    # 先算关节，再整体平移到脚底着地
    hip = (0.0, 0.0)
    def chain(th, sh):
        k = seg(hip, th, TH); a = seg(k, sh, SH)
        toe = (a[0] + FOOT, a[1] + 4)
        return k, a, toe
    nk, na, nt = chain(P['nth'], P['nsh']); fk, fa_, ft = chain(P['fth'], P['fsh'])
    neck = seg(hip, 180 + P['lean'], TORSO)   # 躯干向上（前倾）
    head = seg(neck, 180 + P['lean'], NECK + HEAD_R)
    sho = seg(hip, 180 + P['lean'], TORSO - 16)
    def arm(ua, fa):
        e = seg(sho, ua, UA); h = seg(e, fa, FA); return e, h
    ne, nh = arm(P['nua'], P['nfa']); fe, fh = arm(P['fua'], P['ffa'])
    lowest = max(na[1], fa_[1]) + 10
    dx, dy = cx, base - lowest - P['lift']
    T = lambda p: (p[0] + dx, p[1] + dy)
    def limb(a, b, col, w=W):
        d.line([T(a), T(b)], fill=OUT, width=w + 8); d.line([T(a), T(b)], fill=col, width=w)
        for p in (a, b): x, y = T(p); d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)
    def foot(a, t, col): limb(a, t, col, 26)
    # 远侧（身后）：红
    limb(sho, fe, FAR); limb(fe, fh, FAR); x, y = T(fh); d.ellipse([x - 20, y - 20, x + 20, y + 20], fill=FAR, outline=OUT, width=4)
    limb(hip, fk, FAR); limb(fk, fa_, FAR); foot(fa_, ft, FAR)
    # 身体、头
    limb(hip, neck, BODY, 64)
    x, y = T(head); d.ellipse([x - HEAD_R, y - HEAD_R, x + HEAD_R, y + HEAD_R], fill=HEAD, outline=OUT, width=6)
    d.polygon([(x + HEAD_R - 6, y - 8), (x + HEAD_R + 26, y + 6), (x + HEAD_R - 6, y + 22)], fill=HEAD, outline=OUT)   # 鼻子：指示面朝右
    d.ellipse([x + 38, y - 18, x + 54, y + 2], fill=OUT)
    # 近侧（身前）：蓝
    limb(hip, nk, NEAR); limb(nk, na, NEAR); foot(na, nt, NEAR)
    limb(sho, ne, NEAR); limb(ne, nh, NEAR); x, y = T(nh); d.ellipse([x - 20, y - 20, x + 20, y + 20], fill=NEAR, outline=OUT, width=4)

def guide(run):
    im = Image.new('RGB', (S, S), (255, 255, 255)); d = ImageDraw.Draw(im)
    frames = [None] + [i * 45 for i in range(8)]
    for idx, ph in enumerate(frames):
        cx = (idx % 3) * CELL + CELL * 0.45; base = (idx // 3) * CELL + CELL * 0.9
        P = {'lean': 2, 'nth': 6, 'nsh': 6, 'fth': -6, 'fsh': -6, 'nua': 8, 'nfa': 20, 'fua': -8, 'ffa': 4, 'lift': 0} if ph is None else pose_at(ph, run)
        draw_figure(d, cx, base, P)
    return im

def single(run, phase, size=1024):
    """单帧姿势图：一个小人，固定比例与脚底位置（逐帧生成用）"""
    im = Image.new('RGB', (size, size), (255, 255, 255)); d = ImageDraw.Draw(im)
    draw_figure(d, size * 0.46, size * 0.86, pose_at(phase, run)); return im

def frame_text(phase, run, hand):
    """每帧的文字说明：拿武器的手（= 近侧手）与同侧的腿各自在前还是在后"""
    P = pose_at(phase, run)
    leg = 'forward' if P['nth'] > 8 else 'back' if P['nth'] < -8 else 'straight under the body'
    arm = 'swung FORWARD' if P['nua'] > 8 else 'swung BACK behind the hip' if P['nua'] < -8 else 'hanging down at the side'
    other = 'back' if P['nua'] > 8 else 'forward' if P['nua'] < -8 else 'at the side'
    air = ', both feet off the ground' if P['lift'] else ''
    return f'{hand} {arm} and the other hand {other}; the leg on the same side as {hand} is {leg}{air}'

if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'src', 'guides'), exist_ok=True)
    for name, run in (('walk', False), ('run', True)):
        for i in range(8): single(run, i * 45).save(os.path.join(ROOT, 'src', 'guides', f'{name}{i + 1}.png'))
    for name, run in (('walk', False), ('run', True)):
        guide(run).save(os.path.join(ROOT, 'src', f'guide_{name}.png'))
    print('ok')
