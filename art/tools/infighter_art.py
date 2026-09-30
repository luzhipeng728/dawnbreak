#!/usr/bin/env python3
"""蓝拳圣使（男圣职者转职，转职 id monk，技能前缀 pi_ = Infighter）美术：技能图标（pi_*）、觉醒插图（cutin/monk{,2,3}）、转职立绘（job/monk）。
生图 / 切图函数全部复用 crusader_art.py（同一个人物参考、同一个等待别的生图请求的串行锁）。
  infighter_art.py icons [--only 表名前缀]   图标表 pi_icons_a（16 个）+ pd_icons_mix（圣骑士最后 1 个 + 蓝拳后 15 个）
  infighter_art.py iconcut [--only 表名]     切图标 → art/final/icon/<技能 id>.webp
  infighter_art.py cutin / cutinprep [--only 名字]   觉醒插图 → art/final/cutin/monk{,2,3}.webp
  infighter_art.py job / jobprep             转职立绘 → art/final/job/monk.webp
转职外观：蓝拳圣使 = 轻装（白蓝短背心、蓝腰带、深蓝宽裤、轻便皮靴）+ 双拳缠白色拳带、拳面一枚金色小十字，巨型十字架插在身后的地上（不拿在手里），蓝白色圣光拳气。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C
import crusader_art as CR

LOOK = ('the male priest now promoted to an INFIGHTER (a holy boxer monk): light gear only - a short sleeveless white-and-blue priest vest with gold trim, a blue sash belt, '
        'loose dark navy pants and light brown boots, both fists wrapped in white boxing hand wraps with a small gold cross on each knuckle, '
        'glowing blue-white holy energy around his fists, the giant cross weapon planted upright in the ground behind him (not held), lean athletic build, no helmet, no armor')

ICONS_A = [
    ('pi_body', 'a muscular arm flexing with blue-white energy radiating from the clenched fist and small speed lines'),
    ('pi_will', 'a giant silver-and-gold cross weapon plunged upright into the ground, a wide circle of blue light spreading on the ground around it'),
    ('pi_tech', 'two white-wrapped fists crossed in front of a blue technique gear emblem with small arrows around it'),
    ('pi_parry', 'a boxer silhouette leaning aside as a red punch misses him, white motion blur and a small sparkle'),
    ('pi_shadow', 'a boxer silhouette punching with a dark translucent shadow clone copying the punch just behind him'),
    ('pi_double', 'two dark translucent shadow clones behind a punching boxer silhouette, all three fists together'),
    ('pi_duck', 'a boxer ducking low and dashing forward with blue speed lines under him'),
    ('pi_sway', 'a boxer leaning back and sliding backward with curved white motion arcs'),
    ('pi_dstraight', 'a straight punch thrust out from a low crouch with a blue shockwave ring at the fist'),
    ('pi_dupper', 'a rising uppercut launching from a low crouch with a tall blue arc sweeping upward'),
    ('pi_dbody', 'a heavy body blow driving into a stomach with small yellow stun stars bursting out'),
    ('pi_crush', 'a fist punching down into the ground, a blue-white shockwave ring and flying rocks around the impact'),
    ('pi_side', 'a long stretched flicker jab reaching far forward with a long blue streak, curved arrow pulling back'),
    ('pi_gorgeous', 'a jab, a straight and a hook shown as three glowing blue fist impact bursts in a row'),
    ('pi_counter', 'a praying boxer with a glowing golden guard aura, a red enemy strike shattering against it'),
    ('pi_chop', 'an overhand hook smashing downward, the target bouncing up off the ground with a blue impact'),
]
ICONS_MIX = CR.ICONS_MIX_HEAD + [
    ('pi_mgjab', 'a flurry of dozens of fast blue jab afterimages in front of a fist, machine-gun style'),
    ('pi_cork', 'a fist twisting like a drill with a spinning blue whirlwind corkscrew around the arm'),
    ('pi_heavenly', 'a right hook, a left hook and a powerful straight punch glowing golden in sequence'),
    ('pi_hurricane', 'a boxer inside a spinning blue hurricane, many hooks around him and one big uppercut at the top'),
    ('pi_dry', 'a sweat drop evaporating from a focused boxer face, a sharp cyan cancel arrow chaining two fists together'),
    ('pi_awaken', 'a colossal straight punch releasing a big bang explosion of blue and white light'),
    ('pi_gatling', 'two fists firing countless rapid punches like a gatling gun with orange sparks and dust behind'),
    ('pi_demo', 'a furious upward hook launching an enemy into the air with a blue shockwave blast'),
    ('pi_death', 'a boxer fist glowing crimson and gold with a small skull shattering on impact, deadly finishing blow'),
    ('pi_nuke', 'a point-blank punch releasing a huge orange nuclear shockwave that blasts backward through enemies'),
    ('pi_atomic', 'an uppercut followed by a crushing downward fist smash, a huge blue impact crater'),
    ('pi_awaken2', 'a boxer dashing around in a ring of many blue afterimages punching in all directions, a huge explosion in the center'),
    ('pi_one', 'a glowing golden holy relic crest shaped like a fist-cross, radiant beams of justice'),
    ('pi_furious', 'a fist smashing down with holy light and then a golden hook knocking enemies flying, a spiral of gathered enemies'),
    ('pi_awaken3', 'a colossal radiant golden holy gauntlet delivering an uppercut from a glowing sanctuary circle, kneeling shadows around'),
]
C.ICON_SHEETS = {'pi_icons_a': ICONS_A, 'pi_icons_mix': ICONS_MIX}

CUTIN = {
    'monk': 'throwing a huge straight punch toward the viewer, his wrapped fist blazing with blue-white holy light and a big-bang shockwave burst, the giant cross planted in the ground behind him, fierce shout',
    'monk2': 'dashing through a storm of blue afterimages of himself punching in every direction, blue lightning streaks crossing the frame, intense focused glare',
    'monk3': 'a giant radiant golden holy gauntlet covering his right arm, raising it for a colossal uppercut, a glowing sanctuary magic circle behind him, solemn determined eyes',
}
JOB_PROMPT = (f'Using this exact chibi character ({CR.FACE}), draw a full-body standing portrait for a class selection screen of {LOOK}, cute chibi proportions, full body visible from head to boots, '
              'facing slightly right in three-quarter view, in a light-footed boxing guard with the wrapped fists raised, the giant cross planted in the ground beside him, confident smile. '
              'Plain pure white background, no text, no effects other than a faint blue glow on the fists.')
APPROVED = os.path.join(C.OUT, 'cutin', 'monk.png')

if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]; only = a[a.index('--only') + 1] if '--only' in a else ''
    if ph == 'icons': CR.run_jobs(CR.icon_jobs(C.ICON_SHEETS), only)
    elif ph == 'iconcut': CR.iconcut(only or 'pi_icons')
    elif ph == 'cutin': CR.run_jobs(CR.cutin_jobs(CUTIN, APPROVED, LOOK, 'He wears only light gear and fights bare-fisted with hand wraps. '), only)
    elif ph == 'cutinprep': CR.cutin_prep(CUTIN, only)
    elif ph == 'job': CR.run_jobs(CR.job_jobs('monk', JOB_PROMPT, APPROVED))
    elif ph == 'jobprep': CR.job_prep('monk')
    else: print(__doc__)
