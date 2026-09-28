#!/usr/bin/env python3
"""区域美术流水线：读区域 spec（src/content/regions/<id>.js，经 region_spec.mjs 导出成 JSON），一条命令批量出图。
复用 sky_art.py（生图 / 动作表 / 切帧 / 背景裁切）、jobs.py（画风常量与背景提示词）、worldprep.py（NPC / 门去背）、
gear_icons.py（史诗图标画风与切图）、summon_scale.py（比例校正）、summon_outline.py（描边），不修改它们。

  region_art.py <id> [阶段] [--only 前缀]
阶段（不写 = all，按顺序全跑；每一步都跳过已存在的输出，可以断点续跑）：
  refs     怪物 / 领主参考立绘            → <主仓库>/art/src/regions/<id>/<名字>_ref.png
  bg       背景远景 + 地面（每个主题）      → <主仓库>/art/src/regions/<id>/bg/<主题>_{far,floor}.png
  review1  第一次审图：所有参考立绘 + 一张背景样例 → <主仓库>/art/src/regions/<id>/review_refs.png
  sheets   动作表 walk / run / act / more → .../sheets2/<名字>_<表>.png
  cut      切帧 → art/final/spr/<名字>/*.webp + spr.json（预览 .../cut/）
  norm     比例校正（act / more 表和走路表比例不一致时缩放，summon_scale.py 的判定）
  outline  描边（spec 里写了 outline 颜色的角色，只跑一次）
  edge     交界带（以远景为参考）         → .../bg/<主题>_edge.png
  bgcut    背景裁切 → art/final/bg/<主题>_{far,floor,edge}.webp
  world    NPC 立绘 + 地下城门 → <主仓库>/art/src/world/*.png → art/final/world/*.webp
  icons    史诗 / 任务道具图标（每 6 个一张表）→ art/final/icon/
  review   最终审图：游戏比例的整张区域联系表 + 纯绿 / 品红检查 → .../review_final.png
生图并发最多 2；429 退避。规则：帧里不画特效（烟、火花、光束、速度线都由游戏运行时画），任何地方不用纯绿和品红。
"""
import os, sys, json, subprocess, argparse, time, colorsys
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import sky_art as A

TOOLS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(TOOLS))
A.PAR = 2
A.BACKOFF = 90
NOFX = (' No visual effects at all: no smoke, no sparks, no magic glow trails, no beams, no motion lines or speed lines (the game adds effects at runtime).'
        ' Do not use pure green or magenta anywhere.')
QUAD_POSE = 'Strict side view profile facing RIGHT, standing on all four legs in a neutral relaxed pose, every leg clearly separated and visible.'
CYCLES = {   # 没有两条腿的角色：自定义走 / 跑循环（spec 里 cycle: 名字）
    'trot': {'walk': ['walking on four legs, front near leg and back far leg stepping forward', 'walking on four legs, body lowest, weight on the front legs', 'walking on four legs, legs passing under the body',
                      'walking on four legs, body highest', 'walking on four legs, front far leg and back near leg stepping forward', 'walking on four legs, body lowest again',
                      'walking on four legs, legs passing under the body again', 'walking on four legs, body highest again'],
             'run': ['galloping, front legs reaching forward, back legs pushing off behind', 'galloping, all four legs gathered under the body', 'galloping, body stretched fully in mid-air',
                     'galloping, front legs landing', 'galloping, front legs reaching forward again', 'galloping, legs gathered under the body again', 'galloping, stretched in mid-air again', 'galloping, front legs landing again']},
}


def load_spec(rid):
    r = subprocess.run(['node', os.path.join(TOOLS, 'region_spec.mjs'), rid, '--write'], capture_output=True, text=True, cwd=REPO)
    if r.returncode: sys.exit(r.stderr)
    return json.loads(r.stdout)


def setup(spec):
    """把 spec 灌进 sky_art 的全局表（M / BG / FLOOR_W / HOVER / SRC），后面直接用 sky_art 的函数。"""
    A.PAR, A.BACKOFF = 2, 90
    A.SRC = os.path.join(A.MAIN, 'src', 'regions', spec['id'])
    os.makedirs(A.SRC, exist_ok=True)
    A.M = {}
    for n, d in spec['art']['chars'].items():
        m = dict(d)
        if isinstance(m.get('cycle'), str): m['cycle'] = CYCLES[m['cycle']]
        A.M[n] = m
    A.HOVER = {n: d['hover'] for n, d in spec['art']['chars'].items() if d.get('hover')}
    A.BG = {t: tuple(d['bg']) for t, d in spec['themes'].items() if d.get('bg')}
    A.FLOOR_W = {t: d.get('floorW', 1700) for t, d in spec['themes'].items()}
    A.EDGE_HOLES = {t for t, d in spec['themes'].items() if d.get('edgeHoles')}   # 交界带里被包住的白底也去掉（栏杆 / 锁链 / 笼子）


def spr_guard(n, rid):
    """精灵目录名是全局的（art/final/spr/<名字>）：已存在且不是本区域切出来的就停下，避免覆盖别的角色（spec 里换个名字）"""
    j = os.path.join(A.HERE, 'final', 'spr', n, 'spr.json')
    if os.path.isdir(os.path.dirname(j)) and (not os.path.exists(j) or json.load(open(j)).get('region') != rid):
        sys.exit(f'精灵名 {n} 和已有的 art/final/spr/{n} 冲突（不是区域 {rid} 生成的），请在 spec 的 art.chars 里改名')


def st_cut(spec, only):
    for n in A.M:
        if not n.startswith(only): continue
        spr_guard(n, spec['id']); A.cut(n)
        j = os.path.join(A.HERE, 'final', 'spr', n, 'spr.json'); meta = json.load(open(j)); meta['region'] = spec['id']; json.dump(meta, open(j, 'w'), indent=1)


def run_jobs(L):
    print(f'{len(L)} jobs, {A.PAR} parallel', flush=True)
    with ThreadPoolExecutor(A.PAR) as ex:
        for f in as_completed([ex.submit(A.gen, *j) for j in L]): print(f.result(), flush=True)


def st_refs(spec, only):
    import jobs
    L = []
    for n, d in A.M.items():
        if not n.startswith(only): continue
        pose = QUAD_POSE if d.get('cycle') is CYCLES['trot'] else jobs.POSE
        L.append((os.path.join(A.SRC, f'{n}_ref.png'), f'Full-body character design image for a 2D side-scrolling beat-em-up game. {pose} {d["desc"]}{NOFX} {jobs.REF_TAIL}', '1024x1536', 'gpt-image-2.5-sunburst', ()))
    run_jobs(L)


def st_bg(spec, only, phase='bg', first=False):
    import jobs
    L = []
    for t, d in A.BG.items():
        if not t.startswith(only): continue
        jobs.BG[t] = d
        b = os.path.join(A.SRC, 'bg', t)
        if phase == 'bg':
            L.append((b + '_far.png', jobs.far_prompt(t) + NOFX, '3840x2160', None, ()))
            if not first: L.append((b + '_floor.png', jobs.floor_prompt(t) + NOFX, '3840x2160', None, ()))
        else: L.append((b + '_edge.png', jobs.edge_prompt(t) + NOFX, '3840x2160', None, (b + '_far.png',)))
        if first: break
    run_jobs(L)


def st_sheets(spec, only):
    L = []
    for n, d in A.M.items():
        if not n.startswith(only): continue
        for sh in d.get('sheets', ('walk', 'run', 'act', 'more')):
            out, prompt, refs = A.sheet_job(n, sh); L.append((out, prompt + NOFX, '2048x2048', 'gpt-image-2.5-sunburst', refs))
    run_jobs(L)


def st_norm(spec, only):
    import summon_scale
    for n in A.M:
        if n.startswith(only) and os.path.isdir(os.path.join(A.HERE, 'final', 'spr', n)): summon_scale.check(n, True, 0.08)
    setup(spec)   # summon_scale 会 import summon_art，它会改掉 sky_art 的全局表（SRC / M / PAR），这里重新灌回来


def st_outline(spec, only):
    for n, d in A.M.items():
        if not n.startswith(only) or not d.get('outline'): continue
        meta = json.load(open(os.path.join(A.HERE, 'final', 'spr', n, 'spr.json')))
        if meta.get('outline'): print('已描边', n); continue
        subprocess.run(['python3', os.path.join(TOOLS, 'summon_outline.py'), n, '--col', d['outline'], '--px', '3', '--alpha', '0.8'])


def st_world(spec, only):
    import jobs
    wsrc = os.path.join(A.MAIN, 'src', 'world'); L = []
    for n, d in spec.get('npcs', {}).items():
        if d.get('look') and ('npc_' + n).startswith(only or 'npc_'):
            L.append((os.path.join(wsrc, f'npc_{n}.png'), f'Full-body NPC character illustration for a 2D side-scrolling fantasy RPG town. {d["look"]}.{NOFX} {jobs.NPC_TAIL2}', '1024x1536', 'gpt-image-2.5-sunburst', ()))
    for g, d in spec['art'].get('gates', {}).items():
        if ('g_' + g).startswith(only or 'g_'): L.append((os.path.join(wsrc, f'g_{g}.png'), f'{d}.{NOFX} {jobs.GATE}', '1536x1024', None, ()))
    run_jobs(L)
    names = [os.path.basename(j[0])[:-4] for j in L if os.path.exists(j[0])]
    if names: subprocess.run(['python3', os.path.join(TOOLS, 'worldprep.py'), *names], env={**os.environ, 'ART_SRC_ROOT': A.MAIN})


def icon_items(spec):
    I = spec.get('items', {}); L = [(e['key'], e['look']) for e in I.get('epics', []) if e.get('look')]
    for s in I.get('sets', []): L += [(p['key'], p['look']) for p in s['pieces'] if p.get('look')]
    L += [(q['key'], q['look']) for q in I.get('quest', [])]
    return L


def st_icons(spec, only):
    import gear_icons as G
    G.SRC = os.path.join(A.SRC, 'icons')
    items = icon_items(spec); sheets = {}
    for i in range(0, len(items), 6):
        chunk = items[i:i + 6]; chunk += [('gear_spare', 'a small plain round glass potion bottle with a violet cork')] * (6 - len(chunk))
        sheets[f'{spec["id"]}_icons{i // 6 + 1}'] = chunk
    G.SHEETS.update(sheets)
    G.cmd_gen(list(sheets))
    for n in sheets: G.cut_sheet(n)
    icon = os.path.join(A.HERE, 'final', 'icon')
    for k, _ in items:   # 任务道具的图标名是 q_*（不带 item_ 前缀）
        if k.startswith('q_') and os.path.exists(os.path.join(icon, f'item_{k}.webp')): os.replace(os.path.join(icon, f'item_{k}.webp'), os.path.join(icon, f'{k}.webp'))


def font(sz):
    for f in ('/System/Library/Fonts/PingFang.ttc', '/System/Library/Fonts/STHeiti Medium.ttc', '/Library/Fonts/Arial Unicode.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def bad_colors(im):
    """纯绿（色相 105~135°）/ 品红（285~315°）且高饱和高亮度的像素占比"""
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255; rgb, al = a[..., :3], a[..., 3] > 0.5
    mx, mn = rgb.max(-1), rgb.min(-1); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    hot = al & (s > 0.8) & (mx > 0.65); n = max(1, al.sum())
    return float((hot & (h > 105) & (h < 135)).sum() / n), float((hot & (h > 285) & (h < 315)).sum() / n)


def st_review1(spec, only):
    """第一次审图：参考立绘（缩到同一高度）+ 第一个主题的远景"""
    refs = [(n, os.path.join(A.SRC, f'{n}_ref.png')) for n in A.M if os.path.exists(os.path.join(A.SRC, f'{n}_ref.png'))]
    H = 420; tiles = []
    for n, p in refs:
        im = Image.open(p).convert('RGB'); im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS); tiles.append((n, im))
    per = 5; rows = [tiles[i:i + per] for i in range(0, len(tiles), per)]
    W = max(sum(t.width for _, t in r) + 20 * (len(r) + 1) for r in rows) if rows else 800
    far = [p for p in (os.path.join(A.SRC, 'bg', f'{t}_far.png') for t in A.BG) if os.path.exists(p)]
    bgim = Image.open(far[0]).convert('RGB') if far else None
    bh = round(bgim.height * W / bgim.width) if bgim else 0
    sheet = Image.new('RGB', (W, 40 + len(rows) * (H + 50) + bh + 20), (40, 36, 48)); dr = ImageDraw.Draw(sheet); f = font(26)
    dr.text((20, 6), f'{spec["name"]} · 参考立绘 + 背景样例', fill=(255, 230, 160), font=f)
    y = 40
    for r in rows:
        x = 20
        for n, t in r: sheet.paste(t, (x, y)); dr.text((x + 4, y + H + 6), f'{n}  h={A.M[n]["h"]}', fill=(230, 230, 240), font=font(22)); x += t.width + 20
        y += H + 50
    if bgim: sheet.paste(bgim.resize((W, bh), Image.LANCZOS), (0, y))
    out = os.path.join(A.SRC, 'review_refs.png'); sheet.save(out); print('->', out)


def st_review(spec, only):
    """最终审图：每个怪物 / 领主的 站立 / 走 / 攻击 / 施法 帧按游戏比例（1 世界单位 = 1.6 像素）摆在它所在地下城的地面上；
    下面是每个主题的背景合成、NPC、门、图标；超标的纯绿 / 品红像素标红。"""
    K = 1.6; out_w = 2200; f = font(20); rows = []; warns = []
    spr = os.path.join(A.HERE, 'final', 'spr'); bgd = os.path.join(A.HERE, 'final', 'bg')
    theme_of = {}
    for did, D in spec['dungeons'].items():
        for k, _ in D['mobs']: theme_of.setdefault(k, D['theme'])
        theme_of.setdefault(D['boss'], D['theme']); theme_of.setdefault(D.get('elite'), D['theme'])
    mons = [(k, M, False) for k, M in spec['monsters'].items()] + [(k, M, True) for k, M in spec['bosses'].items()]
    for k, M, boss in mons:
        art = M['art'] if isinstance(M['art'], str) else M['art'][0]; tint = {} if isinstance(M['art'], str) else (M['art'][1] if len(M['art']) > 1 else {})
        d = os.path.join(spr, art)
        if not os.path.exists(os.path.join(d, 'spr.json')): warns.append(f'{k}: 没有精灵 {art}'); continue
        meta = json.load(open(os.path.join(d, 'spr.json'))); res = meta.get('res', 2); scale = M.get('scale', 1.15 if boss else 1)
        frames = [n for n in ('idle', 'walk3', 'atk3', 'cast2', 'hit2', 'down') if n in meta['frames']]
        th = theme_of.get(k, 'siroCoffin'); floor = os.path.join(bgd, f'{th}_floor.webp')
        H = round(260 * K * (1.25 if boss else 1)); row = Image.new('RGB', (out_w, H), (30, 26, 36))
        if os.path.exists(floor): fl = Image.open(floor).convert('RGB'); row.paste(fl.resize((out_w, round(fl.height * out_w / fl.width))).crop((0, 0, out_w, H)), (0, round(H * 0.55)))
        dr = ImageDraw.Draw(row); x = 240
        g, m = 0.0, 0.0
        for n in frames:
            im = Image.open(os.path.join(d, n + '.webp')).convert('RGBA'); F = meta['frames'][n]
            if tint: im = hue_tint(im, tint)
            s = K * scale / res; im2 = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
            base_y = round(H * 0.8); row.paste(im2, (x, base_y - round(F['ay'] * s)), im2); x += im2.width + 30
            gg, mm = bad_colors(im); g, m = max(g, gg), max(m, mm)
        label = f'{M["name"]} ({k}) {"领主" if boss else M.get("tier", "")} h={M.get("size", [0, 0, 0])[2]}×{scale}'
        dr.text((10, 10), label, fill=(255, 230, 160) if boss else (230, 230, 240), font=f)
        if g > 0.004 or m > 0.004: dr.text((10, 40), f'纯绿 {g:.1%} 品红 {m:.1%}', fill=(255, 80, 80), font=f); warns.append(f'{k}: 纯绿 {g:.1%} 品红 {m:.1%}')
        # 玩家身高参照线（约 115 世界单位）
        dr.line([(200, round(H * 0.8)), (200, round(H * 0.8 - 115 * K))], fill=(120, 200, 255), width=3); dr.text((150, round(H * 0.8 - 115 * K) - 24), '玩家', fill=(120, 200, 255), font=f)
        rows.append(row)
    for t in spec['themes']:
        p = [os.path.join(bgd, f'{t}_{k}.webp') for k in ('far', 'floor', 'edge')]
        if not os.path.exists(p[0]): warns.append(f'{t}: 没有背景'); continue
        far = Image.open(p[0]).convert('RGB'); row = Image.new('RGB', (out_w, 420), (0, 0, 0)); row.paste(far.resize((out_w, round(far.height * out_w / far.width))).crop((0, 0, out_w, 300)), (0, 0))
        if os.path.exists(p[1]): fl = Image.open(p[1]).convert('RGB'); row.paste(fl.resize((out_w, round(fl.height * out_w / fl.width))).crop((0, 0, out_w, 140)), (0, 280))
        if os.path.exists(p[2]): e = Image.open(p[2]).convert('RGBA'); e = e.resize((out_w, round(e.height * out_w / e.width))); row.paste(e, (0, 300 - e.height // 2), e)
        ImageDraw.Draw(row).text((10, 10), f'背景 {t}', fill=(255, 255, 255), font=f); rows.append(row)
    extras = [os.path.join(A.HERE, 'final', 'world', f'npc_{n}.webp') for n in spec.get('npcs', {})] + [os.path.join(A.HERE, 'final', 'world', f'g_{g}.webp') for g in spec['art'].get('gates', {})]
    icons = [os.path.join(A.HERE, 'final', 'icon', (k if k.startswith('q_') else f'item_{k}') + '.webp') for k, _ in icon_items(spec)]
    row = Image.new('RGB', (out_w, 300), (44, 40, 52)); x = 10
    for p in extras + icons:   # NPC / 门 / 图标（图标缩到 96）
        if not os.path.exists(p): warns.append(f'缺少 {os.path.basename(p)}'); continue
        im = Image.open(p).convert('RGBA'); h = 280 if 'world' in p else 96; im = im.resize((max(1, round(im.width * h / im.height)), h)); row.paste(im, (x, 10 if h > 200 else 90), im); x += im.width + (16 if 'world' in p else 8)
    rows.append(row)
    sheet = Image.new('RGB', (out_w, sum(r.height + 8 for r in rows) + 60), (20, 18, 24)); dr = ImageDraw.Draw(sheet)
    dr.text((10, 14), f'{spec["name"]} · 游戏比例总审图（1 单位 = {K} 像素；蓝线 = 玩家身高）', fill=(255, 230, 160), font=font(28)); y = 60
    for r in rows: sheet.paste(r, (0, y)); y += r.height + 8
    out = os.path.join(A.SRC, 'review_final.png'); sheet.save(out); print('->', out)
    for w in warns: print('WARN', w)


def hue_tint(im, t):
    """近似 MON_ART 的染色（色相 hue°、饱和度 sat、亮度 bright），只用于审图"""
    a = np.asarray(im).astype(np.float32) / 255; rgb = a[..., :3]
    import colorsys as cs
    hsv = np.vectorize(cs.rgb_to_hsv, otypes=[np.float32, np.float32, np.float32])(rgb[..., 0], rgb[..., 1], rgb[..., 2])
    sel = np.ones_like(hsv[0], bool) if 'only' not in t else (hsv[0] * 360 >= t['only'][0]) & (hsv[0] * 360 <= t['only'][1])
    h = np.where(sel, (hsv[0] + t.get('hue', 0) / 360) % 1, hsv[0]); s = np.where(sel, np.clip(hsv[1] * t.get('sat', 1), 0, 1), hsv[1]); v = np.where(sel, np.clip(hsv[2] * t.get('bright', 1), 0, 1), hsv[2])
    r, g, b = np.vectorize(cs.hsv_to_rgb, otypes=[np.float32, np.float32, np.float32])(h, s, v)
    return Image.fromarray((np.dstack([r, g, b, a[..., 3]]) * 255).astype(np.uint8), 'RGBA')


STAGES = {
    'refs': st_refs, 'bg': st_bg, 'review1': st_review1, 'sheets': st_sheets, 'cut': st_cut,
    'norm': st_norm, 'outline': st_outline, 'edge': lambda s, o: st_bg(s, o, 'edge'), 'bgcut': lambda s, o: [A.bgcut(t) for t in A.BG if t.startswith(o)],
    'world': st_world, 'icons': st_icons, 'review': st_review,
}
ORDER = ['refs', 'bg', 'review1', 'sheets', 'cut', 'norm', 'outline', 'edge', 'bgcut', 'world', 'icons', 'review']

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('stage', nargs='?', default='all'); ap.add_argument('--only', default='')
    ap.add_argument('--sample', action='store_true', help='bg 阶段只出第一个主题的远景（给第一次审图用）')
    a = ap.parse_args(); spec = load_spec(a.id); setup(spec)
    for st in (ORDER if a.stage == 'all' else a.stage.split(',')):
        print(f'== {st}', flush=True); t = time.time()
        if st == 'bg' and a.sample: st_bg(spec, a.only, 'bg', first=True)
        else: STAGES[st](spec, a.only)
        print(f'== {st} done {time.time() - t:.0f}s', flush=True)
