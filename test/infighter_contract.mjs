// 气功师·念气 转职契约检查（不开浏览器）：技能 id、源码与 docs/skills/priest_infighter_final.md 三方对齐
import fs from 'node:fs';
import assert from 'node:assert/strict';
const core = fs.readFileSync('src/content/classes/priest_infighter.js', 'utf8');
const p1 = fs.readFileSync('src/content/classes/priest_infighter_p1.js', 'utf8');
const doc = fs.readFileSync('docs/skills/priest_infighter_final.md', 'utf8');
const ids = ['pi_body','pi_will','pi_tech','pi_parry','pi_duck','pi_sway','pi_dstraight','pi_dupper','pi_dbody','pi_crush','pi_side','pi_gorgeous','pi_counter','pi_chop','pi_shadow','pi_double','pi_mgjab','pi_cork','pi_heavenly','pi_hurricane','pi_dry','pi_awaken','pi_gatling','pi_demo','pi_death','pi_nuke','pi_atomic','pi_awaken2','pi_one','pi_furious','pi_awaken3'];
for (const id of ids) { assert.match(core + p1, new RegExp(`defSkill\\(['"]${id}['"]`), `missing skill ${id}`); assert.match(doc, new RegExp(`\\b${id}\\b`), `docs omit ${id}`); }
assert.match(core, /name: 'pi_duck'[\s\S]*?invul: \[0, 0\.25\]/); assert.match(core, /name: 'pi_sway'[\s\S]*?invul: \[0, 0\.25\]/); assert.match(core, /name: 'pi_duck'[\s\S]*?onInput:/); assert.match(core, /name: 'pi_sway'[\s\S]*?onInput:/); assert.match(core, /name: 'pi_duck'[\s\S]*?links:/); assert.match(core, /name: 'pi_sway'[\s\S]*?links:/); assert.match(p1, /const piLinkOf/); assert.match(core, /p\.piWill/); assert.match(core, /pi_shadow/); assert.match(p1, /PRIEST_HOOKS\.cancelHook\.push/); assert.match(p1, /PI_DRY_NOIN/); assert.match(p1, /PI_DRY_NOOUT/); assert.match(p1, /game\.pvp && id === 'pi_hurricane'/); assert.match(p1, /onInput:/);
console.log(`蓝拳结构契约通过：${ids.length} 技能、俯冲/摆动无敌连段、干涸之泉取消钩子、幻影/觉醒联动`);
