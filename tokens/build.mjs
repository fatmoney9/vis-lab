/*
 * L0 · 值 token 构建：tokens/<theme>.json → tokens/tokens.css
 * 用法：
 *   node tokens/build.mjs            一次性生成（校验失败退出码 1）
 *   node tokens/build.mjs --watch    守护 tokens/*.json，保存即重生成（校验失败只打印、不退出）
 *
 * 三条通道纪律（WORKFLOW §六）：
 *   1. 合同校验——三主题的「真实 token」（非 $ 前缀）key 集合必须完全一致，缺键即构建失败。
 *   2. 作用域矩阵——主题 × 端 × 明暗：
 *        [data-theme="X"]                                  基准 = pc + light
 *        [data-theme="X"][data-platform="mobile"]          端覆盖（仅端分叉的 token）
 *        [data-theme="X"][data-mode="dark"]                暗色覆盖（仅明暗分叉的 token）
 *        [data-theme="X"][data-platform="mobile"][data-mode="dark"]  两维同时分叉时的组合（更高特异性破平手）
 *      端默认 pc、明暗默认 light；只发生分叉的 token 才落进覆盖作用域，其余留在基准。
 *   3. 别名解析——值形如 "{token-name}" → 输出 var(--token-name)，运行时由 CSS 逐级解析（脚本不展开链）。
 *
 * 构建期校验（fail-fast）：合同 key 一致 · 分叉两键俱全 · 悬空别名 · 循环别名。
 * $meta / $section-* 等 $ 前缀键是文档分节，非 token：既不校验也不输出。
 */
import { readFileSync, writeFileSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const THEMES = ['ths', 'ifind-pc', 'ainvest'];
const ALIAS = /^\{([a-z0-9-]+)\}$/i;

/* 校验失败抛错——一次性模式在 main 里转退出码，watch 模式打印后继续守护 */
const fail = (msg) => { throw new Error(msg); };

/* 读入并剥掉 $ 前缀（$meta / $section-*）——只留真实 token */
const load = (t) =>
  Object.fromEntries(
    Object.entries(JSON.parse(readFileSync(join(DIR, `${t}.json`), 'utf8'))).filter(([k]) => !k.startsWith('$')),
  );

/* 值形态校验：叶值 | {mobile,pc} | {light,dark} | 二者嵌套；分叉必须两键俱全（不许只写 light 缺 dark） */
const FORK = { platform: ['mobile', 'pc'], mode: ['light', 'dark'] };
function assertShape(theme, name, v) {
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v);
    const isPlat = ks.includes('mobile') || ks.includes('pc');
    const isMode = ks.includes('light') || ks.includes('dark');
    if (isPlat && isMode) fail(`${theme}:${name} 分叉混用 mobile/pc 与 light/dark：[${ks}]`);
    const dim = isPlat ? 'platform' : isMode ? 'mode' : null;
    if (!dim) fail(`${theme}:${name} 未知分叉键 [${ks}]（仅允许 mobile/pc 或 light/dark）`);
    const [a, b] = FORK[dim];
    const bad = ks.filter((k) => k !== a && k !== b);
    if (bad.length) fail(`${theme}:${name} 含非法分叉键 [${bad}]（${dim} 维只允许 ${a}/${b}）`);
    if (!ks.includes(a) || !ks.includes(b)) fail(`${theme}:${name} ${dim} 分叉缺键：需同时有 ${a} 与 ${b}，实为 [${ks}]`);
    for (const k of ks) assertShape(theme, `${name}.${k}`, v[k]);
    return;
  }
  if (typeof v !== 'string' && typeof v !== 'number') fail(`${theme}:${name} 非法叶值类型 ${typeof v}`);
}

/* 别名校验：目标存在（悬空）+ 无直接/间接循环（a→b→a） */
const aliasTargets = (v) =>
  typeof v === 'string'
    ? (v.match(ALIAS) ? [v.match(ALIAS)[1]] : [])
    : v !== null && typeof v === 'object'
    ? Object.values(v).flatMap(aliasTargets)
    : [];

function assertAliases(theme, tokens) {
  const edges = new Map(Object.entries(tokens).map(([k, v]) => [k, aliasTargets(v)]));
  for (const [k, tgts] of edges) {
    for (const t of tgts) if (!(t in tokens)) fail(`${theme}:${k} 悬空别名 {${t}}（不是已定义 token）`);
  }
  const DONE = 1, ACTIVE = 0;
  const state = new Map();
  const path = [];
  const visit = (n) => {
    if (state.get(n) === DONE) return;
    if (state.get(n) === ACTIVE) fail(`${theme} 循环别名：${path.slice(path.indexOf(n)).concat(n).join(' → ')}`);
    state.set(n, ACTIVE);
    path.push(n);
    for (const t of edges.get(n)) visit(t);
    path.pop();
    state.set(n, DONE);
  };
  for (const k of edges.keys()) visit(k);
}

/* 归约到某个 (platform, mode) 角的标量 CSS 值；别名 {x} → var(--x)（形态/别名已在上方校验） */
function corner(value, platform, mode) {
  if (value !== null && typeof value === 'object') {
    if ('mobile' in value || 'pc' in value) return corner(value[platform] ?? value.pc, platform, mode);
    return corner(value[mode] ?? value.light, platform, mode);
  }
  const s = String(value);
  const m = s.match(ALIAS);
  return m ? `var(--${m[1]})` : s;
}
const fourCorners = (v) => ({
  pl: corner(v, 'pc', 'light'),
  ml: corner(v, 'mobile', 'light'),
  pd: corner(v, 'pc', 'dark'),
  md: corner(v, 'mobile', 'dark'),
});

const decl = (name, val) => `  --${name}: ${val};`;
const rule = (sel, body) => `${sel} {\n${body.join('\n')}\n}`;

/* 一个主题 → 四个作用域块（空块不发） */
function themeBlocks(theme, tokens) {
  const base = [], mobile = [], dark = [], combo = [];
  for (const [name, v] of Object.entries(tokens)) {
    const c = fourCorners(v);
    base.push(decl(name, c.pl));
    const variesPlatform = c.ml !== c.pl || c.md !== c.pd;
    const variesMode = c.pd !== c.pl || c.md !== c.ml;
    if (c.ml !== c.pl) mobile.push(decl(name, c.ml));
    if (c.pd !== c.pl) dark.push(decl(name, c.pd));
    if (variesPlatform && variesMode) combo.push(decl(name, c.md));
  }
  const S = (x) => `[data-theme="${theme}"]${x}`;
  const out = [rule(S(''), base)];
  if (mobile.length) out.push(rule(S('[data-platform="mobile"]'), mobile));
  if (dark.length) out.push(rule(S('[data-mode="dark"]'), dark));
  if (combo.length) out.push(rule(S('[data-platform="mobile"][data-mode="dark"]'), combo));
  return out.join('\n\n');
}

const HEADER = `/* ⚠️ 生成文件，请勿手改——改 tokens/<theme>.json 后运行 node tokens/build.mjs 重新生成。
   作用域开关：主题 [data-theme=ths|ifind-pc|ainvest] · 端 [data-platform=mobile]（默认 pc） · 明暗 [data-mode=dark]（默认 light）。
   别名 {x} 已转 var(--x)；三主题 key 集合经合同校验一致。源：tokens/*.json */`;

/* 全流程：载入 → 合同校验 → 形态/别名校验 → 生成 → 写盘。任一步失败抛错。 */
function build() {
  const data = Object.fromEntries(THEMES.map((t) => [t, load(t)]));

  const baseKeys = Object.keys(data[THEMES[0]]).sort();
  for (const t of THEMES.slice(1)) {
    const ks = Object.keys(data[t]).sort();
    const missing = baseKeys.filter((k) => !ks.includes(k));
    const extra = ks.filter((k) => !baseKeys.includes(k));
    if (missing.length || extra.length) {
      fail(`token 合同不一致：「${t}」缺 [${missing.join(', ')}] 多 [${extra.join(', ')}]（基准 ${THEMES[0]}）`);
    }
  }

  for (const t of THEMES) {
    for (const [name, v] of Object.entries(data[t])) assertShape(t, name, v);
    assertAliases(t, data[t]);
  }

  const css = [HEADER, ...THEMES.map((t) => themeBlocks(t, data[t]))].join('\n\n') + '\n';
  writeFileSync(join(DIR, 'tokens.css'), css);
  return baseKeys.length;
}

/* ── main ─────────────────────────────────────────────────────────── */
const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });
const runOnce = () => {
  try {
    const n = build();
    console.log(`✓ [${ts()}] tokens.css 生成成功：${THEMES.length} 主题 × ${n} token`);
    return true;
  } catch (e) {
    console.error(`✗ [${ts()}] ${e.message}`);
    return false;
  }
};

if (process.argv.includes('--watch')) {
  runOnce();
  console.log(`👀 watching tokens/*.json …（Ctrl-C 退出）`);
  let timer;
  watch(DIR, (_evt, file) => {
    if (!file || !file.endsWith('.json')) return; /* 只认源 JSON；写 tokens.css 不回环 */
    clearTimeout(timer);
    timer = setTimeout(runOnce, 100); /* 编辑器保存常触发多次事件，去抖 */
  });
} else if (!runOnce()) {
  process.exit(1); /* 一次性模式：校验/生成失败退出码 1，供 CI / git 钩子拦截 */
}
