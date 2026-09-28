/* =====================================================================
   公会窗口（guild，快捷键 J）：
   - 没有公会：公会列表（搜索 / 申请）、创建公会（名字 + 徽章：形状 × 颜色 × 一个字，消耗金币）、收到的邀请
   - 有公会：概况（等级 / 经验 / 公会技能 / 今日贡献 / 公告 / 设置）、成员（在线状态与位置、组队 / 私聊、任命 / 转让 / 请离、邀请、审批申请）、
     留言板、公会商店（个人贡献兑换）、公会排行
   ===================================================================== */
addStyle(`
.sxguild .ghead{display:flex;gap:.8em;align-items:center}
.sxguild .ghead img{width:4.2em;height:4.2em;flex:none}
.sxguild .ghead .nm{font-size:1.35em;font-weight:900;color:#9aff7a}
.sxguild .gexp{height:.7em;background:#1a1420;border-radius:.4em;overflow:hidden;border:.06em solid #3a3040;margin:.2em 0}
.sxguild .gexp i{display:block;height:100%;background:linear-gradient(90deg,#4aa05a,#bfff7a)}
.sxguild .perks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.3em}
.sxguild .perk{padding:.3em .45em;border-radius:.25em;background:#16111b;border:.06em solid #2e2838;font-size:.8em;opacity:.5}
.sxguild .perk.on{opacity:1;border-color:#4aa05a;background:rgba(74,160,90,.14)}
.sxguild .perk b{display:block;color:#bfff9a}
.sxguild .glist .gi{display:flex;gap:.6em;align-items:center;padding:.4em .5em;border-bottom:.06em solid #2a2230}
.sxguild .glist .gi img{width:2.6em;height:2.6em;flex:none}
.sxguild .glist .gi .t{flex:1;min-width:0}
.sxguild .glist .gi .t b{color:#9aff7a}
.sxguild .glist .gi .d{font-size:.78em;color:#9a8f7c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sxguild .bpick{display:flex;flex-wrap:wrap;gap:.25em}
.sxguild .bpick .o{cursor:pointer;border:.12em solid transparent;border-radius:.3em;padding:.1em;line-height:0}
.sxguild .bpick .o.on{border-color:#ffd23a;background:rgba(255,210,60,.15)}
.sxguild .bpick .o img{width:2.2em;height:2.2em}
.sxguild .bpick .sw{width:1.6em;height:1.6em;border-radius:.3em}
.sxguild .bpick .gl{min-width:1.6em;height:1.6em;line-height:1.6em;text-align:center;font-weight:900;font-size:.95em;background:#1a1420;border-radius:.25em;color:#fff2d0}
.sxguild .role{font-size:.78em;font-weight:900;padding:0 .4em;border-radius:.2em}
.sxguild .role.leader{background:#8a5a10;color:#ffe8a8}.sxguild .role.vice{background:#2a5a8a;color:#d8ecff}.sxguild .role.member{background:#3a3040;color:#c8c0b0}
.sxguild .on{color:#6aff8a}.sxguild .off{color:#8a806e}
.sxguild .posts{display:flex;flex-direction:column;gap:.3em;max-height:17em;overflow:auto}
.sxguild .post{padding:.35em .5em;border-radius:.25em;background:#16111b;font-size:.88em;line-height:1.5;position:relative}
.sxguild .post.sys{background:transparent;color:#9aff7a;font-size:.8em;padding:.1em .5em}
.sxguild .post .w{color:#fff3b0;font-weight:900;margin-right:.4em}.sxguild .post .tm{color:#6a6070;font-size:.8em;margin-left:.4em}
.sxguild .post .x{position:absolute;right:.4em;top:.3em;cursor:pointer;color:#8a806e}.sxguild .post .x:hover{color:#ff8a7a}
.sxguild .notice{white-space:pre-wrap;line-height:1.55;background:rgba(255,210,60,.07);border:.06em solid #6a5436;border-radius:.3em;padding:.45em .6em;font-size:.92em;min-height:2.4em}
.sxguild .shop{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.35em}
.sxguild .sitem{display:flex;gap:.5em;align-items:center;padding:.35em .45em;background:#16111b;border:.06em solid #2e2838;border-radius:.3em}
.sxguild .sitem.lock{opacity:.45}
.sxguild .sitem .t{flex:1;min-width:0;font-size:.85em}
.sxguild .sitem .t .c{color:#9aff7a;font-weight:900}
.sxguild .today{display:flex;gap:.6em;flex-wrap:wrap;font-size:.82em}
.sxguild .today span b{color:#9aff7a}
`);
const SXGD = { tab: 'info', ntab: 'list', q: '', badge: { s: 0, c: 0, g: '龙' }, name: '', list: null, rank: null };
const GUILD_JOIN = { apply: '需要审批', open: '自由加入', closed: '暂停招人' };
const sxgScene = id => { const S = id && typeof SCENES !== 'undefined' && SCENES[id]; return S ? `${S.name}${S.area && S.area !== S.name ? ' · ' + S.area : ''}` : ''; };
const sxgAgo = t => { if (!t) return '很久以前'; const m = Math.floor((Date.now() - t) / 60000); return m < 60 ? `${Math.max(1, m)} 分钟前` : m < 1440 ? `${Math.floor(m / 60)} 小时前` : `${Math.floor(m / 1440)} 天前`; };
Object.assign(menus, {
  w_guild() {
    if (!sxGate('公会')) return null;
    const el = sxWin('guild', '公会', {
      w: 50,
      load: async () => { const d = await guildRefresh(); if (!d) throw new Error('网络异常'); if (!d.guild) SXGD.list = (await sxApi('GET', '/api/guild/list')).list; return d; },
      render: (el, d) => d.guild ? sxgMine(el, d) : sxgNone(el, d),
    });
    el.classList.add('sxguild');
    return el;
  },
});
/* ---- 没有公会 ---- */
function sxgNone(el, d) {
  const tabs = h('div', { class: 'itabs' }, [['list', '公会列表'], ['create', '创建公会'], ['inv', `收到的邀请${d.invites.length ? `（${d.invites.length}）` : ''}`]].map(([id, nm]) => h('div', { class: 'itab' + (SXGD.ntab === id ? ' on' : ''), onclick: () => { SXGD.ntab = id; sfx.click(); el._render(); } }, nm)));
  let body;
  if (SXGD.ntab === 'create') body = sxgCreate(el, d);
  else if (SXGD.ntab === 'inv') body = h('div', { class: 'sxscroll glist', style: 'height:20em' }, d.invites.length ? d.invites.map(g => h('div', { class: 'gi' }, h('img', { src: guildBadgeSrc(g.badge) }),
    h('div', { class: 't' }, h('b', {}, g.name), ` Lv.${g.lvl}　${g.members}/${g.maxMembers} 人`, h('div', { class: 'd' }, `${g.by} 邀请你加入　${sxgAgo(g.at)}`)),
    h('button', { class: 'btn sm', onclick: () => guildDo('POST', '/api/guild/accept', { id: g.id }, `加入了公会「${g.name}」`).then(r => { if (r) { guildTagsRefresh(); el._reload(); } }) }, '加入'),
    h('button', { class: 'btn sm blue', onclick: () => guildDo('POST', '/api/guild/decline', { id: g.id }).then(() => el._reload()) }, '拒绝'))) : h('div', { class: 'sxload' }, '没有收到邀请'));
  else {
    const q = sxInput({ placeholder: '搜索公会名', value: SXGD.q, style: 'flex:1' });
    const go = async () => { SXGD.q = q.value.trim(); try { SXGD.list = (await sxApi('GET', '/api/guild/list?q=' + encodeURIComponent(SXGD.q))).list; } catch (e) { toastMsg(sxErrText(e), '#ff6a6a'); } el._render(); };
    q.addEventListener('keydown', ev => { if (ev.key === 'Enter') go(); });
    const L = SXGD.list || [];
    body = h('div', { class: 'col', style: 'gap:.35em' }, h('div', { class: 'row' }, q, h('button', { class: 'btn sm', onclick: go }, '搜索')),
      h('div', { class: 'sxscroll glist', style: 'height:19em', 'data-sk': 'gl' }, L.length ? L.map(g => h('div', { class: 'gi' }, h('img', { src: guildBadgeSrc(g.badge) }),
        h('div', { class: 't' }, h('b', {}, g.name), ` Lv.${g.lvl}　${g.members}/${g.maxMembers} 人　会长 ${g.leader}　`, h('span', { class: 'small dim' }, GUILD_JOIN[g.joinMode] || ''), h('div', { class: 'd' }, g.intro || '（没有介绍）')),
        g.applied ? h('button', { class: 'btn sm blue', onclick: () => guildDo('POST', '/api/guild/cancelApply', { id: g.id }, '已取消申请').then(() => el._reload()) }, '取消申请')
          : h('button', { class: 'btn sm' + (g.joinMode === 'closed' || g.members >= g.maxMembers ? ' off' : ''), onclick: () => menus.ask({ title: `申请加入「${g.name}」`, text: '给会长留句话（可以不写）：', input: { placeholder: '例如：Lv20 剑魂，每天晚上在线', max: 60 }, okText: '申请', ok: v => guildDo('POST', '/api/guild/apply', { id: g.id, msg: v }).then(r => { if (r) { toastMsg(r.joined ? `加入了公会「${g.name}」` : '申请已发出，等待会长审批', '#9aff7a'); if (r.joined) guildTagsRefresh(); el._reload(); } }) }) }, g.joinMode === 'open' ? '加入' : '申请'))) : h('div', { class: 'sxload' }, SXGD.q ? '没有找到' : '还没有人创建公会，来当第一个会长吧！')));
  }
  return [tabs, body];
}
function sxgCreate(el, d) {
  const B = SXGD.badge;
  const name = sxInput({ maxlength: 8, placeholder: '2~8 个汉字、字母或数字', value: SXGD.name, style: 'width:12em' });
  name.addEventListener('input', () => { SXGD.name = name.value.trim(); });
  const pick = (list, cur, mk, set) => h('div', { class: 'bpick' }, list.map((x, i) => h('span', { class: 'o' + (cur === i ? ' on' : ''), onclick: () => { set(i); sfx.click(); el._render(); } }, mk(x, i))));
  const glyph = sxInput({ maxlength: 1, value: GUILD_GLYPHS.includes(B.g) ? '' : B.g, placeholder: '自定', style: 'width:3em;text-align:center' });
  glyph.addEventListener('input', () => { const v = glyph.value.trim(); if (v) { B.g = [...v][0]; el._render(); } });
  const need = d.createGold, lv = d.createLvl, can = game.lvl >= lv && game.gold >= need;
  return h('div', { class: 'row', style: 'align-items:flex-start;gap:1em' },
    h('div', { class: 'col', style: 'align-items:center;width:9em' }, h('img', { src: guildBadgeSrc(B, 128), style: 'width:7em;height:7em' }), h('b', { style: 'color:#9aff7a;font-size:1.1em' }, SXGD.name || '公会名')),
    h('div', { class: 'col', style: 'flex:1;gap:.45em' },
      h('div', { class: 'row' }, h('span', { class: 'sxlbl' }, '公会名'), name),
      h('div', { class: 'sxlbl' }, '徽章形状'), pick(GUILD_SHAPES, B.s, (x, i) => h('img', { src: guildBadgeSrc({ s: i, c: B.c, g: B.g }, 48), title: x }), i => { B.s = i; }),
      h('div', { class: 'sxlbl' }, '颜色'), pick(GUILD_COLORS, B.c, x => h('span', { class: 'sw', style: `display:inline-block;background:${x}` }), i => { B.c = i; }),
      h('div', { class: 'sxlbl' }, '徽章上的字'), h('div', { class: 'row', style: 'flex-wrap:wrap;gap:.25em' }, pick(GUILD_GLYPHS, GUILD_GLYPHS.indexOf(B.g), x => h('span', { class: 'gl' }, x), i => { B.g = GUILD_GLYPHS[i]; }), glyph),
      h('div', { class: 'row' }, h('span', { class: 'small' }, `创建费用 `, h('b', { class: 'gold' }, `${fmtNum(need)} G`), `（持有 ${fmtNum(game.gold)} G）　需要 Lv.${lv}`), h('span', { class: 'sp' }),
        h('button', { class: 'btn' + (can ? '' : ' off'), onclick: () => {
          if (!SXGD.name) { toastMsg('请填写公会名', '#ffb0a0'); sfx.error(); return; }
          itemDialog(el, { title: '创建公会', msg: `创建公会「${escHtml(SXGD.name)}」，花费 <span class="gold">${fmtNum(need)} G</span>？`, okText: '创建', onOk: () => {
            guildCreate(SXGD.name, { ...B }).then(() => { sfx.levelUp(); toastMsg(`公会「${SXGD.name}」创建成功！`, '#9aff7a'); SXGD.tab = 'info'; el._reload(); })
              .catch(e => { toastMsg(e.message, '#ff6a6a'); sfx.error(); el._render(); });
          } });
        } }, '创建')),
      h('div', { class: 'ihint' }, '公会名创建后不能修改；徽章以后会长可以随时换。')));
}
/* ---- 有公会 ---- */
function sxgMine(el, d) {
  const G = d.guild, me = d.me, off = me.role !== 'member';
  const tabs = h('div', { class: 'itabs' }, [['info', '概况'], ['members', `成员 ${G.members}/${G.maxMembers}${d.reqs.length ? ` · 申请 ${d.reqs.length}` : ''}`], ['board', '留言板'], ['shop', '公会商店'], ['rank', '公会排行']].map(([id, nm]) => h('div', { class: 'itab' + (SXGD.tab === id ? ' on' : ''), onclick: () => { SXGD.tab = id; sfx.click(); if (id === 'rank') SXGD.rank = null; el._render(); } }, nm)));
  const R = { info: sxgInfo, members: sxgMembers, board: sxgBoard, shop: sxgShop, rank: sxgRank }[SXGD.tab] || sxgInfo;
  return [tabs, ...[].concat(R(el, d, G, me, off))];
}
function sxgInfo(el, d, G, me, off) {
  const cur = d.expTable[G.lvl - 1] || 0, nxt = d.expTable[G.lvl], pct = nxt ? Math.min(100, (G.exp - cur) / (nxt - cur) * 100) : 100;
  const T = d.today || {}, R = d.gainRule || {};
  const out = [h('div', { class: 'ghead' }, h('img', { src: guildBadgeSrc(G.badge, 128) }),
    h('div', { style: 'flex:1' }, h('div', {}, h('span', { class: 'nm' }, G.name), `　Lv.${G.lvl}　`, h('span', { class: 'role ' + me.role }, me.roleName)),
      h('div', { class: 'gexp' }, h('i', { style: `width:${pct}%` })),
      h('div', { class: 'small dim' }, nxt ? `公会经验 ${fmtNum(G.exp)} / ${fmtNum(nxt)}（升到 Lv.${G.lvl + 1}）` : `公会经验 ${fmtNum(G.exp)}（已满级）`, `　会长 ${G.leader}　成员 ${G.members}/${G.maxMembers}　${GUILD_JOIN[G.joinMode]}`),
      h('div', { class: 'small' }, '我的贡献 ', h('b', { style: 'color:#9aff7a' }, fmtNum(me.contrib)), `（累计 ${fmtNum(me.contribTotal)}）`)))];
  out.push(h('div', { class: 'today' }, h('span', { class: 'sxlbl' }, '今日贡献'),
    ...[['clear', '通关地下城'], ['abyss', '深渊派对'], ['coop', '组队通关'], ['signin', '每日签到']].map(([k, n]) => R[k] ? h('span', {}, `${n} +${R[k][0]}：`, h('b', {}, `${T[k] || 0}/${R[k][1]}`)) : null)));
  out.push(h('div', { class: 'sxlbl' }, '公会技能（随公会等级自动生效）'), h('div', { class: 'perks' }, d.perks.map(P => h('div', { class: 'perk' + (G.lvl >= P.lvl ? ' on' : '') }, h('b', {}, `Lv.${P.lvl} ${P.name}`), P.desc))));
  out.push(h('div', { class: 'row' }, h('span', { class: 'sxlbl' }, '公会公告'), h('span', { class: 'sp' }), off ? h('button', { class: 'btn sm', onclick: () => sxgEditNotice(el, G) }, '修改公告') : null), h('div', { class: 'notice' }, G.notice || '（会长还没写公告）'));
  const acts = h('div', { class: 'row' });
  if (off) acts.append(h('button', { class: 'btn sm', onclick: () => sxgSettings(el, G, me) }, '公会设置'));
  acts.append(h('span', { class: 'sp' }));
  if (me.role === 'leader') acts.append(h('button', { class: 'btn sm red', onclick: () => menus.ask({ title: '解散公会', danger: true, text: `解散后所有成员的贡献清零，公会等级和留言都会消失，<b>不能恢复</b>。<br>请输入公会名「${escHtml(G.name)}」确认：`, input: { placeholder: G.name, max: 12, check: v => v.toLowerCase() === G.name.toLowerCase() ? null : '公会名不对' }, okText: '解散', ok: v => guildDo('POST', '/api/guild/disband', { name: v }, '公会已解散').then(() => { guildTagsRefresh(); el._reload(); }) }) }, '解散公会'));
  if (me.role !== 'leader' || G.members <= 1) acts.append(h('button', { class: 'btn sm red', onclick: () => menus.ask({ title: '离开公会', danger: true, text: `离开后你的个人贡献（${fmtNum(me.contrib)}）会清零。确定离开「${escHtml(G.name)}」吗？`, okText: '离开', ok: () => guildDo('POST', '/api/guild/leave', { char: save.data && save.data.name }, '你离开了公会').then(() => { guildTagsRefresh(); el._reload(); }) }) }, '离开公会'));
  out.push(acts);
  return out;
}
function sxgEditNotice(el, G) {
  const ta = sxInput({ rows: 6, maxlength: 300, style: 'width:100%;box-sizing:border-box' }, 'textarea'); ta.value = G.notice || '';
  itemDialog(el, { title: '修改公会公告', body: ta, okText: '保存', onOk: () => { guildDo('POST', '/api/guild/notice', { text: ta.value }, '公告已更新'); } });
}
function sxgSettings(el, G, me) {
  const intro = sxInput({ maxlength: 60, value: G.intro || '', placeholder: '一句话介绍（显示在公会列表里）', style: 'width:100%;box-sizing:border-box' });
  const mode = sxInput({}, 'select'); for (const k in GUILD_JOIN) { const o = h('option', { value: k }, GUILD_JOIN[k]); if (k === G.joinMode) o.selected = true; mode.append(o); }
  const B = { ...G.badge };
  const prev = h('img', { src: guildBadgeSrc(B, 96), style: 'width:4em;height:4em' });
  const sel = (list, key) => { const s = sxInput({}, 'select'); list.forEach((x, i) => { const o = h('option', { value: i }, typeof x === 'string' && x.startsWith('#') ? `颜色 ${i + 1}` : x); if (B[key] === i) o.selected = true; s.append(o); }); s.addEventListener('change', () => { B[key] = +s.value; prev.src = guildBadgeSrc(B, 96); }); return s; };
  const gl = sxInput({ maxlength: 1, value: B.g, style: 'width:3em;text-align:center' }); gl.addEventListener('input', () => { if (gl.value.trim()) { B.g = [...gl.value.trim()][0]; prev.src = guildBadgeSrc(B, 96); } });
  const body = h('div', { class: 'col', style: 'gap:.45em' }, h('div', { class: 'sxlbl' }, '介绍'), intro, h('div', { class: 'row' }, h('span', { class: 'sxlbl' }, '加入方式'), mode),
    me.role === 'leader' ? h('div', { class: 'row' }, prev, h('div', { class: 'col', style: 'gap:.3em' }, h('div', { class: 'row' }, sel(GUILD_SHAPES, 's'), sel(GUILD_COLORS, 'c'), gl), h('span', { class: 'small dim' }, '徽章（只有会长能改）'))) : null);
  itemDialog(el, { title: '公会设置', body, okText: '保存', onOk: () => { guildDo('POST', '/api/guild/set', { intro: intro.value, joinMode: mode.value, ...(me.role === 'leader' ? { badge: B } : {}) }, '设置已保存'); } });
}
function sxgMembers(el, d, G, me, off) {
  const myId = net.user && net.user.id;
  const rows = d.members.map(m => {
    const J = m.char && m.char.cls ? sxClsName(m.char.cls, m.char.job) : '', loc = m.online ? (sxgScene(m.scene) || '冒险中') : `离线 · ${sxgAgo(m.lastOn)}`;
    const acts = [];
    if (m.id !== myId) {
      if (m.online) acts.push(h('button', { class: 'btn sm', title: '邀请组队', onclick: () => { if (typeof netPartyInvite === 'function') netPartyInvite(m.id, m.name); } }, '组队'), h('button', { class: 'btn sm blue', onclick: () => { if (typeof chat !== 'undefined') chat.whisper(m.name); } }, '私聊'));
      if (me.role === 'leader') {
        acts.push(h('button', { class: 'btn sm', onclick: () => guildDo('POST', '/api/guild/role', { user: m.name, role: m.role === 'vice' ? 'member' : 'vice' }) }, m.role === 'vice' ? '撤销副会长' : '任命副会长'));
        acts.push(h('button', { class: 'btn sm', onclick: () => menus.ask({ title: '转让会长', text: `把会长转让给 <b>${escHtml(m.char.name || m.name)}</b>？你会变成副会长。`, okText: '转让', ok: () => guildDo('POST', '/api/guild/transfer', { user: m.name, char: save.data && save.data.name }, '会长已转让') }) }, '转让'));
      }
      if (off && (me.role === 'leader' || m.role === 'member') && m.role !== 'leader') acts.push(h('button', { class: 'btn sm red', onclick: () => menus.ask({ title: '请离成员', danger: true, text: `把 <b>${escHtml(m.char.name || m.name)}</b> 请离公会？`, okText: '请离', ok: () => guildDo('POST', '/api/guild/kick', { user: m.name }, '已请离') }) }, '请离'));
    }
    return h('tr', { class: m.id === myId ? 'me' : '' },
      h('td', {}, h('span', { class: 'role ' + m.role }, m.roleName)),
      h('td', { style: 'font-weight:900' }, m.char.name || '—', h('div', { class: 'small dim' }, `${m.char.lvl ? 'Lv.' + m.char.lvl + ' ' : ''}${J}　${m.name}`)),
      h('td', { class: 'num', style: 'color:#9aff7a' }, fmtNum(m.contribTotal)),
      h('td', { class: 'small ' + (m.online ? 'on' : 'off') }, (m.online ? '● ' : '○ ') + loc),
      h('td', { style: 'white-space:nowrap' }, ...acts));
  });
  const out = [h('div', { class: 'sxscroll', style: 'max-height:15em', 'data-sk': 'gm' }, h('table', { class: 'sxtbl' }, h('thead', {}, h('tr', {}, ['职位', '角色', '累计贡献', '状态', ''].map(t => h('th', {}, t)))), h('tbody', {}, rows)))];
  if (off) {
    const inp = sxInput({ placeholder: '账号名或角色名', style: 'width:10em' });
    const fr = typeof netFriends !== 'undefined' ? netFriends.list.filter(f => !GD.tags.get(f.id)) : [];
    out.push(h('div', { class: 'row', style: 'flex-wrap:wrap' }, h('span', { class: 'sxlbl' }, '邀请加入'), inp, h('button', { class: 'btn sm', onclick: () => { const v = inp.value.trim(); if (v) guildInvite(v); } }, '邀请'),
      fr.length ? h('span', { class: 'small dim' }, '好友：') : null, ...fr.slice(0, 6).map(f => h('button', { class: 'btn sm blue', onclick: () => guildInvite(f.name) }, f.char && f.char.name ? f.char.name : f.name))));
    if (d.reqs.length) out.push(h('div', { class: 'sxlbl' }, `入会申请（${d.reqs.length}）`), h('div', { class: 'sxscroll', style: 'max-height:8em' }, h('table', { class: 'sxtbl' }, h('tbody', {}, d.reqs.map(q => h('tr', {},
      h('td', { style: 'font-weight:900' }, q.char ? q.char.name : q.name, h('span', { class: 'small dim' }, `　${q.char ? `Lv.${q.char.lvl} ${sxClsName(q.char.cls, q.char.job)}　` : ''}${q.name}`)),
      h('td', { class: 'small' }, q.msg || ''), h('td', { class: 'small dim' }, sxgAgo(q.at)),
      h('td', { style: 'white-space:nowrap' }, h('button', { class: 'btn sm', onclick: () => guildDo('POST', '/api/guild/approve', { user: q.name, ok: true, char: save.data && save.data.name }, `已批准 ${q.name} 加入`) }, '批准'), h('button', { class: 'btn sm blue', onclick: () => guildDo('POST', '/api/guild/approve', { user: q.name, ok: false }, '已拒绝') }, '拒绝'))))))));
    if (d.invited.length) out.push(h('div', { class: 'small dim' }, `已邀请、等待回应：${d.invited.map(x => x.name).join('、')}`));
  }
  return out;
}
function sxgBoard(el, d, G, me, off) {
  const myId = net.user && net.user.id;
  const inp = sxInput({ maxlength: 120, placeholder: '写点什么（最多 120 字）', style: 'flex:1' });
  const post = () => { const v = inp.value.trim(); if (!v) return; guildDo('POST', '/api/guild/post', { text: v, char: save.data && save.data.name }).then(r => { if (r) inp.value = ''; }); };
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') post(); });
  return [h('div', { class: 'notice' }, h('b', { style: 'color:#ffd23a' }, '【公告】'), G.notice || '（会长还没写公告）'),
    h('div', { class: 'posts', 'data-sk': 'gp' }, d.posts.length ? d.posts.map(p => p.sys ? h('div', { class: 'post sys' }, `◆ ${p.text}`, h('span', { class: 'tm' }, sxDate(p.at)))
      : h('div', { class: 'post' }, h('span', { class: 'w' }, p.char || p.user), p.text, h('span', { class: 'tm' }, sxDate(p.at)),
        p.uid === myId || off ? h('span', { class: 'x', title: '删除', onclick: () => guildDo('DELETE', `/api/guild/post/${p.id}`) }, '✕') : null)) : h('div', { class: 'sxload' }, '还没有留言')),
    h('div', { class: 'row' }, inp, h('button', { class: 'btn sm', onclick: post }, '留言')),
    h('div', { class: 'ihint' }, '聊天框里按 Tab 切到“公会”频道（或输入 /g 内容）可以和在线的成员聊天。')];
}
function sxgShop(el, d, G, me) {
  const items = d.shop.filter(S => ITEMS[S.key]);
  return [h('div', { class: 'row' }, h('span', {}, '个人贡献 ', h('b', { style: 'color:#9aff7a;font-size:1.15em' }, fmtNum(me.contrib))), h('span', { class: 'sp' }), h('span', { class: 'small dim' }, '每周一 06:00 刷新限购次数')),
    h('div', { class: 'shop', 'data-sk': 'gs' }, items.map(S => {
      const lock = G.lvl < S.lvl, lim = S.once ? 1 : S.week, left = lim ? lim - S.bought : null, can = !lock && me.contrib >= S.cost && (left === null || left > 0);
      const it = makeItem(S.key, S.n);
      return h('div', { class: 'sitem' + (lock ? ' lock' : '') }, itemSlot(it, { cmp: false }),
        h('div', { class: 't' }, h('div', { class: `q${it.rar || 0}`, style: 'font-weight:900' }, it.name + (S.n > 1 ? ` ×${S.n}` : '')),
          h('div', {}, h('span', { class: 'c' }, `${fmtNum(S.cost)} 贡献`), lock ? h('span', { style: 'color:#ff8a6a' }, `　公会 Lv.${S.lvl}`) : lim ? h('span', { class: 'dim' }, `　${S.once ? '限兑 1 次' : `本周 ${S.bought}/${lim}`}`) : null)),
        h('button', { class: 'btn sm' + (can ? '' : ' off'), onclick: () => itemDialog(el, { title: '兑换', msg: `用 <b style="color:#9aff7a">${fmtNum(S.cost)}</b> 贡献兑换 ${sxItemHtml({ ...it, n: S.n })}？`, okText: '兑换', onOk: () => { guildShopBuy(S).then(r => { toastMsg(`兑换了 ${(r.got || []).join('、')}`, '#ffe8a8'); }).catch(e => { toastMsg(e.message, '#ff6a6a'); sfx.error(); }); } }) }, '兑换'));
    }))];
}
function sxgRank(el) {
  if (!SXGD.rank) { sxApi('GET', '/api/guild/rank').then(r => { SXGD.rank = r.list; if (el.isConnected) el._render(); }).catch(e => toastMsg(sxErrText(e), '#ff6a6a')); return h('div', { class: 'sxload' }, '加载中……'); }
  return sxgRankTable(SXGD.rank);
}
