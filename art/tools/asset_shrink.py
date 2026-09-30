#!/usr/bin/env python3
"""素材瘦身（docs/ASSET_AUDIT.md §6）：只重新压缩透明通道，彩色部分一个字节都不改，尺寸 / 锚点不变。
  python3 art/tools/asset_shrink.py [--dry] [--only 前缀,...] [-j 8]     瘦身 art/final，写尺寸报告
  python3 art/tools/asset_shrink.py compare [前缀,...]                   每类抽几张，和 git HEAD 的原图并排对比 → art/work/asset_audit/cmp_<分类>.jpg

透明通道（ALPH 块）重新无损压缩：先把几乎透明 / 几乎不透明的像素归到 0 / 255（<=4、>=251），
人物 / 图标 / 特效再把半透明值对齐到 8 的倍数；透明度误差最多 4/255（1.6%），比彩色部分有损压缩本身的误差还小
（特效光晕按叠加 / 正常两种混合方式在深色底上对比过，看不出色带：art/work/asset_audit/cmp_fx_blend.jpg）。
彩色部分（VP8 块）原样保留、字节不变；拼好后解码逐像素核对（颜色全等、透明度等于处理后的值），对不上就不改。
背景 / 城镇建筑（大片柔和阴影压在亮地面上，8 级台阶可能看得出）只做 0 / 255 归整。
不缩尺寸、不重压彩色：量过的屏幕放大倍数里没有成片画不到那么大的类别；彩色重压到 q82 只省 11~15%、却是第二代有损（docs/ASSET_AUDIT.md §6）。
幂等：处理过的透明度再跑一遍值不变，重新压缩不会更小就不写。
尺寸报告：art/work/asset_audit/shrink_report.json（每个文件第一次见到时的大小 → 现在的大小，按分类汇总）。
"""
import os, sys, io, json, struct, subprocess, collections
from multiprocessing import Pool
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINAL = os.path.join(HERE, 'final')
WORK = os.path.join(HERE, 'work', 'asset_audit')
REPORT = os.path.join(WORK, 'shrink_report.json')
# 透明度处理方式：q8 = 归整 + 半透明对齐到 8 的倍数；snap = 只归整
ALPHA_MODE = {'spr': 'q8', 'icon': 'q8', 'weapon': 'q8', 'cash': 'q8', 'pet': 'q8', 'avatar': 'q8', 'class': 'q8', 'job': 'q8', 'cutin': 'q8', 'fx': 'q8', 'aura': 'q8'}
ALPHA_DEFAULT = 'snap'


def chunks(b):
    if b[:4] != b'RIFF' or b[8:12] != b'WEBP': raise ValueError('not webp')
    i, out = 12, []
    while i < len(b):
        tag = b[i:i + 4]; n = struct.unpack('<I', b[i + 4:i + 8])[0]
        out.append((tag, b[i + 8:i + 8 + n])); i += 8 + n + (n & 1)
    return out


def build(ch):
    body = b''.join(t + struct.pack('<I', len(d)) + d + (b'\0' if len(d) & 1 else b'') for t, d in ch)
    return b'RIFF' + struct.pack('<I', 4 + len(body)) + b'WEBP' + body


def alph_chunk(a):
    """透明度平面 → ALPH 块（无损：透明度放在绿色通道里用 VP8L 压缩，去掉 5 字节的 VP8L 头）"""
    h, w = a.shape
    g = np.zeros((h, w, 4), np.uint8); g[..., 1] = a; g[..., 3] = 255
    buf = io.BytesIO(); Image.fromarray(g, 'RGBA').save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    vl = dict(chunks(buf.getvalue()))[b'VP8L']
    if vl[0] != 0x2f: raise ValueError('bad VP8L')
    return bytes([1]) + vl[5:]


def quant_alpha(a, mode):
    b = a.astype(np.int16)
    b[b <= 4] = 0; b[b >= 251] = 255
    if mode == 'q8':
        mid = (b > 0) & (b < 255)
        b[mid] = np.clip(np.round(b[mid] / 8) * 8, 8, 248)
    return b.astype(np.uint8)


def cat_of(key):
    return key.split('/')[0] if '/' in key else ''


def shrink_one(args):
    key, dry = args
    p = os.path.join(FINAL, key + '.webp')
    raw = open(p, 'rb').read(); size0 = len(raw); steps = []
    try:
        ch = chunks(raw)
    except ValueError:
        return key, size0, size0, 'skip:not-webp'
    im = Image.open(io.BytesIO(raw)); im.load()
    d = dict(ch)
    if b'ALPH' in d and b'VP8 ' in d:
        rgba0 = np.asarray(im.convert('RGBA'))
        a1 = quant_alpha(rgba0[..., 3], ALPHA_MODE.get(cat_of(key), ALPHA_DEFAULT))
        na = alph_chunk(a1)
        if len(na) < len(d[b'ALPH']):
            nb = build([(t, na if t == b'ALPH' else x) for t, x in ch])
            chk = np.asarray(Image.open(io.BytesIO(nb)).convert('RGBA'))
            if np.array_equal(chk[..., :3], rgba0[..., :3]) and np.array_equal(chk[..., 3], a1):
                raw = nb; steps.append('alpha')
            else:
                steps.append('alpha:verify-failed')
    if len(raw) < size0 and not dry:
        open(p, 'wb').write(raw)
    return key, size0, min(len(raw), size0), ','.join(steps)


def all_keys(only):
    out = []
    for dp, dn, fn in os.walk(FINAL):
        for f in fn:
            if f.endswith('.webp'):
                k = os.path.relpath(os.path.join(dp, f), FINAL)[:-5]
                if not only or any(k.startswith(o) for o in only): out.append(k)
    return sorted(out)


def main():
    argv = sys.argv[1:]
    if argv and argv[0] == 'compare': return compare(argv[1].split(',') if len(argv) > 1 else None)
    dry = '--dry' in argv
    only = argv[argv.index('--only') + 1].split(',') if '--only' in argv else None
    jobs = int(argv[argv.index('-j') + 1]) if '-j' in argv else max(1, (os.cpu_count() or 4) - 2)
    keys = all_keys(only)
    rep = json.load(open(REPORT)) if os.path.exists(REPORT) else {'files': {}}
    files = rep['files']
    changed = 0; fails = []
    with Pool(jobs) as pool:
        for i, (k, s0, s1, why) in enumerate(pool.imap_unordered(shrink_one, [(k, dry) for k in keys], chunksize=8)):
            if 'failed' in why: fails.append(k)
            if s1 < s0: changed += 1
            if not dry:
                e = files.get(k)
                files[k] = [e[0] if e else s0, s1]
            if (i + 1) % 1000 == 0: print(f'  {i + 1}/{len(keys)}', flush=True)
    if not dry:
        for k in list(files):
            if not os.path.exists(os.path.join(FINAL, k + '.webp')): del files[k]
        by = collections.defaultdict(lambda: [0, 0, 0])
        for k, (a, b) in files.items():
            c = 'spr' if k.startswith('spr/') else cat_of(k) or '(根目录)'; by[c][0] += 1; by[c][1] += a; by[c][2] += b
        rep['summary'] = {c: {'files': n, 'before': a, 'after': b, 'saved%': round(100 * (a - b) / a, 1)} for c, (n, a, b) in sorted(by.items(), key=lambda x: -x[1][1])}
        tot = [sum(v[i] for v in by.values()) for i in (1, 2)]
        rep['total'] = {'before': tot[0], 'after': tot[1], 'saved%': round(100 * (tot[0] - tot[1]) / tot[0], 1)}
        os.makedirs(WORK, exist_ok=True)
        with open(REPORT, 'w') as f:
            f.write('{\n "total": ' + json.dumps(rep['total'], ensure_ascii=False) + ',\n "summary": ' + json.dumps(rep['summary'], ensure_ascii=False) + ',\n "files": {\n')
            f.write(',\n'.join(f'  {json.dumps(k)}: {json.dumps(v)}' for k, v in sorted(files.items())) + '\n }\n}\n')
        for c, v in rep['summary'].items(): print(f'  {c:8s} {v["files"]:5d} 个  {v["before"] / 1048576:7.2f} → {v["after"] / 1048576:7.2f} MB（-{v["saved%"]}%）')
        print(f'合计 {tot[0] / 1048576:.2f} → {tot[1] / 1048576:.2f} MB（-{rep["total"]["saved%"]}%），这次改了 {changed} 个文件')
    else:
        print(f'试跑：{changed} 个文件会变小')
    if fails: print('核对失败（没改）：', fails[:20])


def compare(prefixes):
    """抽样对比：每类 6 张，原图（git HEAD）| 现在 | 差异 ×16，分别垫在棋盘格和深色底上"""
    import random
    os.makedirs(WORK, exist_ok=True)
    cats = prefixes or ['spr/', 'icon/', 'weapon/', 'world/', 'bg/', 'fx/', 'cutin/', 'job/', 'cash/', 'pet/', 'aura/']
    rep = json.load(open(REPORT)) if os.path.exists(REPORT) else {'files': {}}
    for pre in cats:
        ks = [k for k, (a, b) in rep['files'].items() if k.startswith(pre) and b < a]
        if not ks: continue
        random.seed(7); ks = sorted(ks, key=lambda k: rep['files'][k][1] - rep['files'][k][0])[:2] + random.sample(ks, min(2, len(ks))); ks = list(dict.fromkeys(ks))
        rows = []
        for k in ks:
            rel = 'art/final/' + k + '.webp'
            try: old = Image.open(io.BytesIO(subprocess.run(['git', 'show', 'HEAD:' + rel], cwd=os.path.dirname(HERE), capture_output=True, check=True).stdout)).convert('RGBA')
            except Exception: continue
            new = Image.open(os.path.join(FINAL, k + '.webp')).convert('RGBA')
            if new.size != old.size: old = old.resize(new.size, Image.LANCZOS)
            z = max(1, min(3, 200 // max(1, max(new.size))))
            W, H = new.width * z, new.height * z
            if max(W, H) > 240: s = 240 / max(W, H); W, H = int(W * s), int(H * s)
            def on(bg, im):
                base = bg.copy(); base.alpha_composite(im.resize((W, H), Image.NEAREST)); return base.convert('RGB')
            yy, xx = np.indices((H, W)); g = np.where((xx // 16 + yy // 16) % 2, 140, 200).astype(np.uint8)
            chk = Image.fromarray(np.dstack([g, g, g, np.full_like(g, 255)]), 'RGBA')
            dark = Image.new('RGBA', (W, H), (18, 14, 22, 255))
            diff = np.abs(np.asarray(on(dark, new)).astype(int) - np.asarray(on(dark, old)).astype(int)) * 16
            dimg = Image.fromarray(np.clip(diff, 0, 255).astype(np.uint8))
            row = Image.new('RGB', (W * 5 + 40, H + 22), (30, 30, 30))
            for i, im in enumerate([on(chk, old), on(chk, new), on(dark, old), on(dark, new), dimg]): row.paste(im, (i * (W + 10), 22))
            from PIL import ImageDraw
            a, b = rep['files'][k]
            ImageDraw.Draw(row).text((4, 4), f'{k}  {a} -> {b} B  (old|new on checker, old|new on dark, diff x16)', fill=(255, 230, 150))
            rows.append(row)
        if not rows: continue
        Wm = max(r.width for r in rows); sheet = Image.new('RGB', (Wm, sum(r.height + 6 for r in rows)), (30, 30, 30)); y = 0
        for r in rows: sheet.paste(r, (0, y)); y += r.height + 6
        out = os.path.join(WORK, 'cmp_' + pre.strip('/').replace('/', '_') + '.jpg')
        sheet.save(out, quality=72); print(out, sheet.size)


if __name__ == '__main__':
    main()
