/*
 * L3 · 站点的「设计规范」视图：左栏页面目录 + 正文现场渲染 specs/<id>.md。
 *
 * 正文**运行时取 .md 原文**，不预生成 HTML、不在站点里另存一份——规范改了，站点下次打开就是新的，
 * 不存在「忘了重新生成」这种漂移（WORKFLOW §一）。代价是规范页需要 HTTP 访问，与站点其余部分相同。
 */
import { renderMarkdown } from './markdown.js';
import { SPEC_GROUPS, SPEC_PAGES, REPO_BLOB_URL, specPage, specHref } from './spec-index.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cache = new Map();
const loadSpec = (id) => {
  if (!cache.has(id)) {
    cache.set(id, fetch(`./specs/${id}.md`).then((res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      return res.text();
    }).catch((error) => {
      cache.delete(id); /* 失败不缓存，下次进来重取 */
      throw error;
    }));
  }
  return cache.get(id);
};

/*
 * 规范里的链接有三种去向：
 *   pie.md / pie.md#xx          → 站内规范路由
 *   ../charts/… ../tokens/…     → 仓库文件，指到 GitHub 上可浏览的那份（站点上没有渲染它们的地方）
 *   https://…                   → 原样外链
 */
const resolveLink = (href) => {
  if (/^https?:/.test(href)) return { href, external: true };
  const [path, frag] = href.split('#');
  const md = /^(?:\.\/)?([\w-]+)\.md$/.exec(path);
  if (md && specPage(md[1])) return { href: specHref(md[1], frag || null), external: false };
  if (!path) return { href: frag ? `#${frag}` : '#', external: false };
  const repoPath = new URL(path, 'https://x/specs/').pathname.slice(1);
  return { href: `${REPO_BLOB_URL}${repoPath}${frag ? `#${frag}` : ''}`, external: true };
};

/* 左栏：分组 → 页；当前页下展开它的二级标题，作页内目录。
   页是落点，故套「示例行」的样式（.nav-example，有底色）；分组只是小标题，套族标题。 */
export function renderSpecNav(nav, { page, headings = [] }) {
  nav.innerHTML = `<a class="nav-item${page ? '' : ' nav-item--active'}" href="${specHref()}"><span>规范总览</span></a>
    <div class="nav-divider"></div>
    ${SPEC_GROUPS.map((group) => `<div class="nav-family"><span class="nav-family__title">${group.label}</span></div>
      ${group.pages.map((p) => `<a class="nav-example${p.id === page ? ' nav-example--active' : ''}" href="${specHref(p.id)}"><span>${p.label}</span></a>
        ${p.id === page && headings.length ? `<div class="nav-spec-toc">${headings.map((h) =>
          `<a href="${specHref(p.id, h.id)}" title="${esc(h.text)}">${esc(h.text)}</a>`).join('')}</div>` : ''}`).join('')}`).join('')}`;
  nav.querySelector('.nav-example--active')?.scrollIntoView({ block: 'nearest' });
}

function renderIndex(main) {
  main.innerHTML = `<div class="gallery spec-index">
    <header class="page-head">
      <div>
        <h1>设计规范</h1>
        <p>每条规则一个稳定 ID，代码注释通过 ID 回引。本页内容现场读取仓库里的规范原文，与代码同一份。</p>
      </div>
      <span class="page-head__meta">${SPEC_PAGES.length} 篇</span>
    </header>
    ${SPEC_GROUPS.map((group) => `<section class="gallery-section">
      <h2 class="section-title">${group.label}</h2>
      <div class="spec-grid">${group.pages.map((p) => `<a class="spec-card" href="${specHref(p.id)}">
        <span class="spec-card__title">${p.label}</span>
        <span class="spec-card__ids">${p.prefixes.map((x) => `${x}-*`).join(' · ')}</span>
      </a>`).join('')}</div>
    </section>`).join('')}
  </div>`;
}

/* 跳到锚点并短暂高亮那一条。锚点不存在时停在页首，不报错——旧链接里的规则可能已改号。 */
function focusAnchor(main, anchor) {
  if (!anchor) { window.scrollTo(0, 0); return; }
  const el = main.querySelector(`[id="${CSS.escape(anchor)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  main.querySelectorAll('.is-target').forEach((n) => n.classList.remove('is-target'));
  el.classList.add('is-target');
}

/*
 * 渲染一页规范。返回 Promise（取原文是异步的）；token 用来丢弃过期结果——
 * 快速连点两页时，先发出的请求可能后回来，不能让它盖掉当前页。
 */
let renderToken = 0;
export async function renderSpecView(main, nav, { page, anchor }) {
  const token = ++renderToken;
  if (!page || !specPage(page)) {
    renderSpecNav(nav, { page: null });
    renderIndex(main);
    return;
  }
  const meta = specPage(page);
  renderSpecNav(nav, { page });
  main.innerHTML = `<div class="spec-doc"><p class="spec-doc__status">正在读取 specs/${page}.md …</p></div>`;
  let text;
  try {
    text = await loadSpec(page);
  } catch (error) {
    if (token !== renderToken) return;
    main.innerHTML = `<div class="spec-doc"><p class="spec-doc__status">规范原文读取失败（${error.message}）。请检查网络后刷新页面。</p></div>`;
    return;
  }
  if (token !== renderToken) return;
  const { html, headings } = renderMarkdown(text, { resolveLink });
  main.innerHTML = `<div class="spec-doc">
    <nav class="breadcrumb" aria-label="面包屑导航">
      <a class="breadcrumb__link" href="${specHref()}">设计规范</a>
      <span class="breadcrumb__separator" aria-hidden="true">/</span>
      <span class="breadcrumb__current" aria-current="page">${meta.label}</span>
      <a class="spec-doc__source" href="${REPO_BLOB_URL}specs/${page}.md" target="_blank" rel="noopener noreferrer">查看原文</a>
    </nav>
    <article class="markdown">${html}</article>
  </div>`;
  renderSpecNav(nav, { page, headings: headings.filter((h) => h.level === 2) });
  focusAnchor(main, anchor);
}

/* 同一页内换锚点：不重取、不重画，只滚动 */
export const scrollSpecAnchor = focusAnchor;
