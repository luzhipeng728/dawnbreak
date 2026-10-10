#!/usr/bin/env python3
"""团本专属美术流水线（希洛克 / 安徒恩 / 奥兹玛）：读 raid_art_spec.py 的角色 / 背景 / 图标设定，复用 region_art.py 的各阶段出图。
精灵名前缀 raidSi* / raidAn* / raidOz*；产物落 art/final/{spr,bg,icon}；最后 manifest 阶段写 docs/RAID_ART_MANIFEST.json 供代码工程师注册。

  raid_art.py <si|an|oz> <阶段,...> [--names a,b] [--kind boss|elite|mob] [--dry]
阶段：refs sheets cut norm review1 review bg edge bgcut icons manifest
  refs/sheets/cut/norm 同 region_art.py；review1 = 参考立绘总览（样图审图）；review = 切帧后按游戏比例的总览（含纯绿 / 品红检查）
  bg/edge/bgcut = 背景（远景 + 地面 → 交界带 → 裁切）；icons = 图标表（3×2）出图并切图；manifest = 汇总清单（可反复运行，只统计已有文件）
生图并发 ≤ 2（环境变量 PAR，默认 2），429 退避 90 秒；每步跳过已有输出，可断点续跑。
"""
import os, sys, json, argparse, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
import region_art as R
import sky_art as A
from raid_art_spec import RAIDS

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # art/
REPO = os.path.dirname(HERE)
SHEET_ST = ('walk', 'run', 'act', 'more')

# 新精灵取代 / 补充的现有注册（给代码工程师参考）
REPLACES = {
    'raidSiHanir': 'siroco_raid 领主「魅惑之哈妮尔」witCharm（原 art: assassin 换色）', 'raidSiVita': '慈悲之维塔 painVita（原 nex 换色）',
    'raidSiNexJustice': '公义之奈克斯 painNex（原 nex scale 1.32）', 'raidSiRodos': '洛多斯（原共用精灵换色）', 'raidSiGusdi': '古斯迪（原共用精灵换色）',
    'raidSiGulumi': '咕噜米（原共用精灵换色）', 'raidSiRena': '蕾娜（原共用精灵换色）', 'raidSiMinhao': '明皓（原共用精灵换色）',
    'raidSiKula': 'siRaidMob_kula（原 siPhantom 换色）', 'raidSiTanna': 'siRaidMob_tanna（原 siPhantom 换色）', 'raidSiCrone': '老妪（原共用精灵）',
    'raidSiGate': 'siRaidMob_gate（原 gatekeeper）', 'raidSiGenbu': 'siRaidMob_genbu（原 jailer）', 'raidSiDisguiser': 'siRaidMob_disguiser（原 voidcaster）',
    'raidSiGrimFollower': 'siRaidMob_grimFollower（原 voidcaster）', 'raidSiGrimWarrior': 'siRaidMob_grimWarrior（原 jailer）',
    'raidSiGrimElder': 'siRaidMob_grimElder（原 archbishop）', 'raidSiShard': 'siRaidMob_sirocoShard（原 siPhantom）',
}


def build_spec(key):
    r = RAIDS[key]; chars = {n: {k: v for k, v in d.items() if v is not None or k == 'hold'} for n, d in r['chars'].items()}
    for n, d in chars.items(): d.setdefault('hold', None)
    return {'id': r['id'], 'name': r['name'], 'art': {'chars': chars, 'gates': {}}, 'themes': {t: {'bg': list(b['bg']), 'floorW': b.get('floorW', 1700)} for t, b in r['bg'].items()},
            'dungeons': {}, 'monsters': {}, 'bosses': {}, 'npcs': {}}


def hold_fix(spec):
    for d in spec['art']['chars'].values():
        if d.get('hold') is None: d['hold'] = None


def prune(names):
    """只保留选中的角色（A.M），包括 norm 阶段重新 setup 之后"""
    orig = R.setup

    def wrapped(spec):
        orig(spec)
        if names: A.M = {k: v for k, v in A.M.items() if k in names}
    R.setup = wrapped
    return wrapped


def review_final(spec, key):
    """切帧后的游戏比例总览：每个角色 idle / walk3 / atk3 / cast2 / hit2 / down，按 1 世界单位 = 1.6 像素摆，蓝线 = 玩家身高 115"""
    K = 1.6; out_w = 2200; f = R.font(20); rows = []; warns = []
    spr = os.path.join(HERE, 'final', 'spr')
    for n, d in A.M.items():
        p = os.path.join(spr, n)
        if not os.path.exists(os.path.join(p, 'spr.json')): warns.append(f'{n}: 没有精灵'); continue
        meta = json.load(open(os.path.join(p, 'spr.json'))); res = meta.get('res', 2)
        boss = d['kind'] == 'boss'; H = round(300 * K * (1.2 if boss else 1)); row = Image.new('RGB', (out_w, H), (34, 30, 42)); dr = ImageDraw.Draw(row); x = 240; g = m = 0.0
        for fn in ('idle', 'walk3', 'run3', 'atk3', 'cast2', 'hit2', 'low2', 'down'):
            if fn not in meta['frames']: continue
            im = Image.open(os.path.join(p, fn + '.webp')).convert('RGBA'); F = meta['frames'][fn]
            s = K / res * (1 if not d.get('scale') else d['scale']); im2 = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
            base_y = round(H * 0.85)
            if x + im2.width > out_w: break
            row.paste(im2, (x, base_y - round(F['ay'] * s)), im2); x += im2.width + 24
            gg, mm = R.bad_colors(im); g, m = max(g, gg), max(m, mm)
        dr.text((10, 10), f'{d["cn"]} ({n}) {d["kind"]} h={d["h"]}', fill=(255, 230, 160) if boss else (230, 230, 240), font=f)
        if g > 0.004 or m > 0.004: dr.text((10, 40), f'纯绿 {g:.1%} 品红 {m:.1%}', fill=(255, 80, 80), font=f); warns.append(f'{n}: 纯绿 {g:.1%} 品红 {m:.1%}')
        dr.line([(200, round(H * 0.85)), (200, round(H * 0.85 - 115 * K))], fill=(120, 200, 255), width=3); dr.text((150, round(H * 0.85 - 115 * K) - 24), '玩家', fill=(120, 200, 255), font=f)
        rows.append(row)
    for t in spec['themes']:
        p = [os.path.join(HERE, 'final', 'bg', f'{t}_{k}.webp') for k in ('far', 'floor', 'edge')]
        if not os.path.exists(p[0]): continue
        far = Image.open(p[0]).convert('RGB'); row = Image.new('RGB', (out_w, 420), (0, 0, 0)); row.paste(far.resize((out_w, round(far.height * out_w / far.width))).crop((0, 0, out_w, 300)), (0, 0))
        if os.path.exists(p[1]): fl = Image.open(p[1]).convert('RGB'); row.paste(fl.resize((out_w, round(fl.height * out_w / fl.width))).crop((0, 0, out_w, 140)), (0, 280))
        if os.path.exists(p[2]): e = Image.open(p[2]).convert('RGBA'); e = e.resize((out_w, round(e.height * out_w / e.width))); row.paste(e, (0, 300 - e.height // 2), e)
        ImageDraw.Draw(row).text((10, 10), f'背景 {t}', fill=(255, 255, 255), font=f); rows.append(row)
    if not rows: print('没有可审的内容'); return
    sheet = Image.new('RGB', (out_w, sum(r.height + 8 for r in rows) + 60), (20, 18, 24)); dr = ImageDraw.Draw(sheet); dr.text((10, 14), f'{spec["name"]} · 游戏比例总审图', fill=(255, 230, 160), font=R.font(28)); y = 60
    for r in rows: sheet.paste(r, (0, y)); y += r.height + 8
    out = os.path.join(A.SRC, 'review_final.png'); sheet.save(out); print('->', out)
    # 过大时另存缩略版，方便人审
    th = sheet.copy(); th.thumbnail((2200, 6000)); th.convert('RGB').save(os.path.join(A.SRC, 'review_final.jpg'), quality=82)
    for w in warns: print('WARN', w)


def st_icons(spec, key, names):
    import gear_icons as G
    r = RAIDS[key]; G.SRC = os.path.join(A.SRC, 'icons'); G.SHEETS.update(r['icons'])
    sel = [n for n in r['icons'] if not names or n in names or any(k in names for k, _ in r['icons'][n])]
    if R.DRY: print('[dry] 图标表', sel); return
    G.cmd_gen(sel)
    for n in sel:
        p = os.path.join(G.SRC, n + '.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB'); d = ImageDraw.Draw(im); W, H = im.size
            for b in ((0, 0, W, 10), (0, H - 10, W, H), (0, 0, 10, H), (W - 10, 0, W, H)): d.rectangle(b, fill=(255, 255, 255))
            im.save(p)
        G.cut_sheet(n)


def icon_review(key):
    r = RAIDS[key]; keys = [k for v in r['icons'].values() for k, _ in v]; tiles = []
    for k in keys:
        p = os.path.join(HERE, 'final', 'icon', f'item_{k}.webp')
        if os.path.exists(p): tiles.append((k, Image.open(p).convert('RGBA')))
    if not tiles: return
    S = 128; per = 6; rows = (len(tiles) + per - 1) // per
    sh = Image.new('RGB', (per * (S + 20) + 20, rows * (S + 40) + 20), (44, 40, 52)); dr = ImageDraw.Draw(sh)
    for i, (k, im) in enumerate(tiles):
        im = im.resize((S, S), Image.LANCZOS); x = 20 + (i % per) * (S + 20); y = 20 + (i // per) * (S + 40); sh.paste(im, (x, y), im); dr.text((x, y + S + 4), k[5:], fill=(230, 230, 240))
    out = os.path.join(A.SRC, 'review_icons.png'); sh.save(out); print('->', out)


def manifest(selected=None):
    """汇总 docs/RAID_ART_MANIFEST.json：每项 {name, kind, raid, desc, files, frames, anchors, suggested}；只统计磁盘上已有的文件，其余 status=pending"""
    path = os.path.join(REPO, 'docs', 'RAID_ART_MANIFEST.json')
    items = []
    for key, r in RAIDS.items():
        for n, d in r['chars'].items():
            sd = os.path.join(HERE, 'final', 'spr', n); j = os.path.join(sd, 'spr.json'); e = {'name': n, 'kind': d['kind'], 'raid': r['raid'], 'cn': d['cn'], 'desc': d['desc'], 'status': 'pending'}
            if os.path.exists(j):
                meta = json.load(open(j)); F = meta['frames']; webps = sorted(x for x in os.listdir(sd) if x.endswith('.webp'))
                e.update(status='done', files=[f'art/final/spr/{n}/{x}' for x in webps] + [f'art/final/spr/{n}/spr.json'], frames={'res': meta.get('res', 2), 'count': len(F), 'names': list(F)},
                         anchors={'note': 'spr.json frames[name] = {w,h,ax,ay}（2x 像素；ax/ay = 脚底锚点）', 'idle': F.get('idle'), 'walk3': F.get('walk3')})
            e['suggested'] = {'use': d['use'], 'standH': d['h'], 'fly': bool(d.get('fly')), 'hover': d.get('hover', 0), 'cycle': d.get('cycle') and ('trot' if d.get('cycle') == 'trot' else d.get('cycle')) or 'biped',
                              'hint': {'boss': 'scale 1.15~1.5，art: 名字（无换色）', 'elite': 'scale 1.0~1.2', 'mob': 'scale 0.8~1.0'}[d['kind']], 'replaces': REPLACES.get(n)}
            e['suggested']['hint'] += ('；NOFX 精灵，招式特效由运行时画' if True else '')
            items.append(e)
        for t, b in r['bg'].items():
            files = [f'art/final/bg/{t}_{k}.webp' for k in ('far', 'floor', 'edge') if os.path.exists(os.path.join(HERE, 'final', 'bg', f'{t}_{k}.webp'))]
            items.append({'name': t, 'kind': 'bg', 'raid': r['raid'], 'desc': b['bg'][0], 'status': 'done' if len(files) == 3 else ('partial' if files else 'pending'), 'files': files,
                          'frames': None, 'anchors': {'floorW': b.get('floorW', 1700), 'note': 'far 1650 宽（截 22%~92%）、floor 470 高、edge 1400 宽底部渐隐；按 defineRegion themes.bg 的三件套使用'},
                          'suggested': {'use': {'raidAnFog': 'P1 阻截（苍穹贵族号 / 黑雾）', 'raidAnVolcano': 'P2 擎天之柱 / 黑色火山', 'raidAnHeart': '安徒恩的心脏', 'raidOzRuin': '毁灭区', 'raidOzDespair': '绝望区',
                                                  'raidOzHorror': '恐怖区', 'raidOzThrone': '混沌王座（奥兹玛）'}.get(t, '')}})
        for sh, lst in r['icons'].items():
            for k, desc in lst:
                p = f'art/final/icon/item_{k}.webp'; ok = os.path.exists(os.path.join(REPO, p))
                items.append({'name': k, 'kind': 'icon', 'raid': r['raid'], 'desc': desc, 'status': 'done' if ok else 'pending', 'files': [p] if ok else [], 'frames': None, 'anchors': None,
                              'suggested': {'use': '团本货币 / 谜题物件 / 融合装备图标（物品 key = ' + k + '，图标 = icon/item_' + k + '）'}})
    out = {'generated': time.strftime('%Y-%m-%d %H:%M:%S'), 'note': '团本专属美术清单。精灵走 NOFX，帧名同普通怪（idle walk1-8 run1-8 atk1-4 cast1-2 low1-2 hit1-2 down getup air jump），ax/ay 为 2x 像素的脚底锚点，res=2。',
           'counts': {k: sum(1 for i in items if i['kind'] == k and i['status'] == 'done') for k in ('boss', 'elite', 'mob', 'bg', 'icon')}, 'items': items}
    json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1); print('->', path, out['counts'])


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('raid'); ap.add_argument('stages'); ap.add_argument('--names', default=''); ap.add_argument('--kind', default='')
    ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    if a.raid == 'all' and a.stages == 'manifest': return manifest()
    spec = build_spec(a.raid); R.DRY = a.dry
    names = set(x for x in a.names.split(',') if x)
    if a.kind:
        ks = {n for n, d in spec['art']['chars'].items() if d['kind'] == a.kind}; names = (names & ks) if names else ks
    if any(x in a.stages.split(',') for x in ('cut', 'norm')):   # 只切四张表都齐的角色（cut 会清空精灵目录，缺表会切出残缺精灵）
        src = os.path.join(A.MAIN, 'src', 'regions', spec['id'], 'sheets2')
        full = {n for n in spec['art']['chars'] if all(os.path.exists(os.path.join(src, f'{n}_{sh}.png')) for sh in SHEET_ST)}
        names = (names & full) if names else full
        if not names: print('没有四张表齐全的角色，跳过'); return
    prune(names)
    R.setup(spec)
    if a.dry:
        R.STAGES.update({k: R.dry_skip(k) for k in ('review1', 'review', 'bgcut')})
    for st in a.stages.split(','):
        print(f'== {st}', flush=True); t = time.time()
        if st == 'review': review_final(spec, a.raid)
        elif st == 'icons': st_icons(spec, a.raid, names)
        elif st == 'icon_review': icon_review(a.raid)
        elif st == 'manifest': manifest()
        elif st == 'bg_sample': R.st_bg(spec, '', 'bg', first=True)
        else: R.STAGES[st](spec, '')
        print(f'== {st} done {time.time() - t:.0f}s', flush=True)


if __name__ == '__main__':
    main()
