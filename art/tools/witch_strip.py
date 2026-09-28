#!/usr/bin/env python3
"""魔道学者的机械 / 召唤物：游戏内比例连拍（复用 summon_strip.py，帧顺序按各自的帧名），最左边放魔法师站姿做对照。
  witch_strip.py [--bg 主题] <id...>   → <主仓库>/art/src/witch/_<id>_strip.png
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import summon_strip as S

S.OUT = os.path.join(S.MAIN, 'src', 'witch')
SEQ = {
    'shululu': ['idle', 'walk1', 'walk3', 'walk5', 'walk7', 'taunt1', 'taunt2', 'swell1', 'swell2', 'hop1', 'hop2', 'sad', 'idle2'],
    'furnace': ['build', 'idle', 'pump1', 'pump2', 'fire1', 'fire2', 'fail', 'boom'],
    'drill': ['idle', 'drive1', 'drive2', 'drill1', 'drill2', 'turn', 'fail', 'big'],
    'tesla': ['build', 'idle', 'spin1', 'spin2', 'zap1', 'zap2', 'fail', 'boom'],
    'antigrav': ['build', 'idle', 'on1', 'on2', 'on3', 'off', 'fail', 'boom'],
    'rabbit': ['build', 'idle', 'charge', 'zap1', 'zap2', 'hop', 'fail', 'boom'],
    'shaved': ['build', 'idle', 'spin1', 'spin2', 'spin3', 'fail', 'boom'],
    'trickjack': ['idle', 'walk1', 'walk2', 'walk3', 'walk4', 'spray1', 'spray2', 'turn'],
    'ouro': ['build', 'idle', 'move1', 'move2', 'grab1', 'grab2', 'boom'],
    'coaster': ['ride1', 'ride2', 'derail'],
    'wtAwk': ['field1', 'field2', 'pumpkin1', 'pumpkin2', 'snow1', 'snow2', 'cat1', 'cat2'],
}

if __name__ == '__main__':
    a = sys.argv[1:]; theme = 'town'
    if '--bg' in a: i = a.index('--bg'); theme = a[i + 1]; a = a[:i] + a[i + 2:]
    for n in a: S.strip(n, theme, ('mage',), SEQ.get(n, S.SEQ))
