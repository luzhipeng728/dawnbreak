#!/usr/bin/env python3
"""逐帧生成走 / 跑：每一帧单独一张图（角色立绘 + 单个小人姿势图），AI 只需照着一个姿势画，手脚更准。
  perframe.py 角色[,角色...] [--kinds walk,run] [-j 8]     输出 art/src/frames3/<角色>_<walk|run><1-8>.png
"""
import os, sys, time, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
from sheets import gi, upload, ROOT
from sheets2 import PLAYERS, hand_name
from poseguide import frame_text

def prompt(kind, i, hold):
    act = 'walking' if kind == 'walk' else 'running fast'
    return ('The FIRST image is the character. The SECOND image is a pose guide showing one simple mannequin. '
            f'Draw this exact chibi character {act}, as ONE full-body figure copying EXACTLY the pose of the mannequin: the same body lean, the same angle of every upper arm, forearm, thigh and shin, '
            'the same foot placement, the same size and the same position in the frame. '
            'The mannequin\'s BLUE arm and BLUE leg are the character\'s NEAR side (closer to the viewer, in front of the body); the RED arm and RED leg are the FAR side (behind the body). '
            f'In this frame: {frame_text(i * 45, kind == "run", hand_name(hold))}. '
            + (f'The character is {hold} in the near-side (blue) hand. ' if hold else '') +
            'Keep the character\'s own design, colors, clothing, proportions and cute art style with thick outlines exactly as in the first image; do NOT draw the mannequin colors. '
            'Strict side view facing RIGHT. Plain pure white background, no ground, no shadow, no text.')

def run(char, kind, i, base, key):
    out = os.path.join(ROOT, 'src', 'frames3', f'{char}_{kind}{i + 1}.png')
    if os.path.exists(out): return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    hold = PLAYERS[char]['hold'] if char in PLAYERS else None
    u1 = upload(base, key, os.path.join(ROOT, 'src', f'{char}_ref.png')); u2 = upload(base, key, os.path.join(ROOT, 'src', 'guides', f'{kind}{i + 1}.png'))
    payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': prompt(kind, i, hold), 'n': 1, 'size': '1024x1024', 'quality': 'high', 'response_format': 'b64_json', 'image': [u1, u2]}
    t = time.time(); err = ''
    for _ in range(4):
        try:
            resp = gi.post_json(f'{base}/images/generations', key, payload, 600); gi.save_images(resp, out, False, False)
            return f'ok   {os.path.basename(out)}  {time.time() - t:.0f}s'
        except SystemExit as e:
            err = str(e); time.sleep(65 if '429' in err else 8)
    return f'FAIL {os.path.basename(out)}: {err[:160]}'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('chars'); ap.add_argument('--kinds', default='walk,run'); ap.add_argument('-j', type=int, default=8); a = ap.parse_args()
    base, key, _ = gi.load_cfg()
    chars, kinds = a.chars.split(','), a.kinds.split(',')
    for c in chars: upload(base, key, os.path.join(ROOT, 'src', f'{c}_ref.png'))
    for k in kinds:
        for i in range(8): upload(base, key, os.path.join(ROOT, 'src', 'guides', f'{k}{i + 1}.png'))
    jobs = [(c, k, i) for c in chars for k in kinds for i in range(8)]
    print(len(jobs), 'frames', flush=True)
    with ThreadPoolExecutor(a.j) as ex:
        for f in as_completed([ex.submit(run, c, k, i, base, key) for c, k, i in jobs]): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
