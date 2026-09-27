/* 小工具：限流（令牌桶）、HTTP 错误、输入校验 */
export class HttpError extends Error {
  constructor(status, msg, data) { super(msg); this.status = status; this.data = data; }
}
export const err = (status, msg, data) => new HttpError(status, msg, data);

// 令牌桶限流：limiter(n, sec) → key => 是否放行（sec 秒内最多 n 次，允许一次性用完）
const limiters = new Set();
export function limiter(n, sec) {
  const m = new Map(), rate = n / sec;
  const f = key => {
    const now = Date.now(); let b = m.get(key);
    if (!b) { b = { tok: n, t: now }; m.set(key, b); }
    b.tok = Math.min(n, b.tok + (now - b.t) / 1000 * rate); b.t = now;
    if (b.tok < 1) return false;
    b.tok -= 1; return true;
  };
  f.map = m; f.n = n; f.sec = sec; limiters.add(f);
  return f;
}
// 定期清掉已经回满的桶，避免 Map 无限增长
setInterval(() => {
  const now = Date.now();
  for (const f of limiters) for (const [k, b] of f.map) if (now - b.t > f.sec * 1000 * 2) f.map.delete(k);
}, 60_000).unref();

// 用户名：2~16 个字符（汉字 / 字母 / 数字 / 下划线）；密码 6~64 个字符
export const USER_RE = /^[一-鿿A-Za-z0-9_]{2,16}$/;
export function checkUser(name) {
  if (typeof name !== 'string' || !name) return '请输入用户名';
  if (!USER_RE.test(name)) return '用户名只能用 2~16 个汉字、字母、数字或下划线';
  if (/^\d+$/.test(name)) return '用户名不能全是数字';
  return null;
}
export function checkPass(p) {
  if (typeof p !== 'string' || p.length < 6) return '密码至少 6 位';
  if (p.length > 64) return '密码最多 64 位';
  return null;
}
export const isNum = v => typeof v === 'number' && Number.isFinite(v);
export const clampNum = (v, a, b, d = a) => isNum(v) ? Math.min(b, Math.max(a, v)) : d;
export const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
export const now = () => Date.now();
export const ts = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().replace('T', ' ').slice(0, 19); };
