/* =====================================================================
   城镇：艾尔文防线 / 赫顿玛尔 / 西海岸 与 NPC
   新增 NPC：defineNpc(id, { name, title, art, h, services, lines })，再放进某个场景的 npcs
     services：quest（任务）、shop:<商店id>、storage（仓库）、repair（修理）、enhance（强化）、disassemble（分解）、job（转职）、cure（解除虚弱）
   新增城镇：defineScene(id, { kind: 'town', ... })，用 exits 和其他场景连起来
   ===================================================================== */
const START_SCENE = 'elvenguard';

defineNpc('seria', { name: '赛丽亚', title: '新手引导', art: 'world/npc_seria', h: 112, services: ['quest', 'shop:seria', 'storage'],
  lines: ['欢迎回来，勇士。今天也要去格兰之森吗？', '累了就回旅馆休息吧，我会一直在这里等你。', '不知道为什么，我总觉得自己知道很多事情……', '格兰之森的哥布林越来越多了，出门要小心。'] });
defineNpc('linus', { name: '林纳斯', title: '铁匠', art: 'world/npc_linus', h: 124, services: ['quest', 'shop:linus', 'repair', 'enhance', 'disassemble'],
  lines: ['武器坏了就拿来修，别拿命开玩笑。', '想要变强？先把手里的家伙练熟再说。', '我年轻的时候也是帝国有名的剑客……算了，不提了。', '强化这种事，看的是运气，也看的是胆量。'] });
defineNpc('kiri', { name: '凯丽', title: '强化 · 神枪手导师', art: 'world/npc_kiri', h: 114, services: ['quest', 'enhance', 'job'], jobFor: 'gun',
  lines: ['来自天界的技术，可比你们地上的铁匠厉害多了！', '想让装备闪闪发光？交给凯丽吧~', '枪械的奥秘，可不是随便谁都能掌握的哦。'] });
defineNpc('gsd', { name: 'G.S.D', title: '鬼剑士导师', art: 'world/npc_gsd', h: 120, services: ['quest', 'job'], jobFor: 'sword',
  lines: ['……你的左臂，在哭泣。', '剑，不是用眼睛看的，是用心。', '被鬼神附身的人，要么驾驭它，要么被它吞噬。'] });
defineNpc('sharan', { name: '莎兰', title: '魔法师导师', art: 'world/npc_sharan', h: 120, services: ['quest', 'job'], jobFor: 'mage',
  lines: ['魔力的流动，你感觉到了吗？', '暗精灵的魔法学识，可不会轻易传授给别人。', '元素也好，战斗也好，都只是魔法的一种形态。'] });
defineNpc('grandis', { name: '歌兰蒂斯', title: '大圣堂', art: 'world/npc_grandis', h: 124, services: ['quest', 'cure'],
  lines: ['愿神的光辉指引你。', '受了伤就来大圣堂吧，这里的祈祷能驱散虚弱。', '赫顿玛尔的人们，都在等待勇士的到来。'] });
defineNpc('fengzhen', { name: '风振', title: '格斗家导师', art: 'world/npc_fengzhen', h: 114, services: ['quest'],
  lines: ['拳头，才是最诚实的武器。', '风拳流的修行，没有捷径。', '……你的身法还欠火候。（格斗家职业尚未开放）'] });
defineNpc('paris', { name: '帕丽丝', title: '时装 · 称号', art: 'world/npc_paris', h: 114, services: ['shop:paris'],
  lines: ['勇士也要穿得漂亮才行！', '这些称号可是很受欢迎的哦~', '看看新到的款式吧！'] });
defineNpc('skadi', { name: '斯卡迪女王', title: '赫顿玛尔女王', art: 'world/npc_skadi', h: 120, services: ['quest'],
  lines: ['欢迎来到赫顿玛尔，勇士。', '格兰之森的异变，让我寝食难安。', '王国需要像你这样的冒险家。'] });
defineNpc('roget', { name: '罗杰', title: '港口', art: 'world/npc_roget', h: 118, services: ['quest', 'shop:roget'],
  lines: ['海风的味道，闻起来就像冒险！', '船上来了些稀罕货，要不要看看？', '西海岸的魔法学院，就在前面那座塔里。'] });

/* ---- 艾尔文防线：赛丽亚旅馆在中间，出门往左是林纳斯的铁匠铺；向右出城到格兰之森，向左通往赫顿玛尔 ---- */
defineScene('elvenguard', { name: '艾尔文防线', area: '艾尔文防线', kind: 'town', width: 2600, theme: 'elvenguard', bgm: 'town', spawn: { x: 1260, y: 60 },
  props: [{ art: 'world/b_elfhouse', x: 250, h: 190 }, { art: 'world/b_forge', x: 760, h: 230 }, { art: 'world/b_inn', x: 1300, h: 290 }, { art: 'world/b_elfhouse', x: 1900, h: 180 }, { art: 'world/b_signpost', x: 2470, h: 110 }],
  npcs: [{ npc: 'linus', x: 820, y: 44 }, { npc: 'seria', x: 1380, y: 40 }],
  exits: [{ side: 'left', to: 'hendon_myre' }, { side: 'right', to: 'gf_lorien' }] });
/* ---- 赫顿玛尔：王国的首都 ---- */
defineScene('hendon_myre', { name: '赫顿玛尔', area: '赫顿玛尔', kind: 'town', width: 3600, theme: 'town', bgm: 'town',
  props: [{ art: 'world/b_workshop', x: 450, h: 240 }, { art: 'world/b_boutique', x: 1080, h: 220 }, { art: 'world/b_dojo', x: 1720, h: 220 }, { art: 'world/b_cathedral', x: 2400, h: 300 }, { art: 'world/b_palace', x: 3150, h: 290 }],
  npcs: [{ npc: 'kiri', x: 520, y: 44 }, { npc: 'paris', x: 1140, y: 40 }, { npc: 'gsd', x: 1640, y: 46 }, { npc: 'fengzhen', x: 1820, y: 42 }, { npc: 'grandis', x: 2440, y: 44 }, { npc: 'skadi', x: 3180, y: 40 }],
  exits: [{ side: 'right', to: 'elvenguard' }, { side: 'left', to: 'west_coast' }] });
/* ---- 西海岸：港口与暗精灵的魔法学院 ---- */
defineScene('west_coast', { name: '西海岸', area: '西海岸', kind: 'town', width: 2300, theme: 'westcoast', bgm: 'town',
  props: [{ art: 'world/b_academy', x: 560, h: 300 }, { art: 'world/b_harbor', x: 1500, h: 220 }],
  npcs: [{ npc: 'sharan', x: 640, y: 44 }, { npc: 'roget', x: 1560, y: 42 }],
  exits: [{ side: 'right', to: 'hendon_myre' }] });
