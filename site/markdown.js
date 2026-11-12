/*
 * L3 · 规范页的 Markdown → HTML（站点内渲染 specs/*.md 用）。
 *
 * 为什么自己写、不引第三方解析器：specs/ 只用到一小撮语法（标题 / 引用 / 表格 / 列表 / 勾选 /
 * 代码块 / 行内代码 / 粗体 / 链接 / 表格内 <br>），一个 CDN 依赖换来的是「CDN 挂了规范页也挂」，
 * 而这一小撮几十行就能写全。语法清单变了（比如有人开始用图片），在这里补，不要绕开。
 *
 * **安全口径：先整体转义，再放行唯一的 `<br>`**。规范正文里大量出现写成纯文本的 `<g>` `<text>`
 * `<marker>`（讲 SVG 结构），不转义就会被浏览器当成真标签吞掉、整段排版错乱。
 *
 * 纯函数、零 import、不碰 DOM，故可被 node --test 直接加载。
 */

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/*
 * 规则 ID 形如 `PIE-05`、`WORLD-HEATMAP-02`。站点给它挂锚点 `rule-<ID>`，详情页的规范徽标据此跳到那一条。
 * specs 里规则有三种写法，三处都认：表格首列（绝大多数）· 列表项开头的粗体（`- **WORLD-HEATMAP-01 · 输入**`）·
 * 标题开头（`## FORMAT-01 · 主题数值格式`）。
 */
export const RULE_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+$/;
const LEADING_ID = /^\**([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+)\b/;
const ruleAttr = (text) => {
  const m = LEADING_ID.exec(text.trim());
  return m ? ` id="rule-${m[1]}"` : '';
};

/* 标题锚点：保留中英文与数字，其余折成连字符 */
const slug = (text) => text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

/*
 * 行内：行内代码先抠出来占位（里面的 ** 与 [] 不该再被解析），再处理链接与粗体，最后放回。
 * resolveLink(href) → { href, external } 由调用方给：规范之间的相对链接要改成站内路由，
 * 指向仓库文件的要改成可浏览的地址——本模块不知道站点的路由长什么样。
 */
function inline(raw, resolveLink) {
  const codes = [];
  let s = raw.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s).replace(/&lt;br\s*\/?&gt;/g, '<br>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    const target = resolveLink(href.replace(/&amp;/g, '&'));
    const ext = target.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeHtml(target.href)}"${ext}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

/*
 * 切单元格时两种竖线不算分隔：
 *   ① 写成 `\|` 的（如 `color-price-{up\|down}`），切完还原成 |；
 *   ② 行内代码里的（如 `max(R, |y| + 块高/2)` 的绝对值记号）。GFM 本身会把②切坏，
 *      GitHub 上看那一行同样错列；站点这里宽松处理，免得规范作者为了渲染去改写公式。
 */
function splitRow(line) {
  const body = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  const cells = [];
  let cur = '';
  let inCode = false;
  for (let k = 0; k < body.length; k += 1) {
    const ch = body[k];
    if (ch === '\\' && body[k + 1] === '|') { cur += '|'; k += 1; continue; }
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}
const isTableSep = (line) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line ?? '');
const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

/*
 * 返回 { html, headings }。headings = [{ level, text, id }]，供站点渲染页内目录。
 * 表格行首列是规则 ID 时，<tr> 带 id="rule-<ID>"。
 */
export function renderMarkdown(md, { resolveLink = (href) => ({ href, external: /^https?:/.test(href) }) } = {}) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const headings = [];
  const ilx = (s) => inline(s, resolveLink);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const body = [];
      for (i += 1; i < lines.length && !/^```/.test(lines[i]); i += 1) body.push(lines[i]);
      i += 1;
      out.push(`<pre><code${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const html = ilx(h[2].trim());
      const rule = LEADING_ID.exec(h[2].trim());
      const id = rule ? `rule-${rule[1]}` : slug(h[2]);
      headings.push({ level, text: h[2].replace(/[`*]/g, ''), id });
      out.push(`<h${level} id="${id}">${html}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i += 1; continue; }

    if (/^>/.test(line)) {
      const body = [];
      for (; i < lines.length && /^>/.test(lines[i]); i += 1) body.push(lines[i].replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(body.join('\n'), { resolveLink }).html}</blockquote>`);
      continue;
    }

    if (/^\s*\|/.test(line) && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i += 1) rows.push(splitRow(lines[i]));
      const thead = `<thead><tr>${head.map((c) => `<th>${ilx(c)}</th>`).join('')}</tr></thead>`;
      const tbody = rows.map((row) => {
        /* 原文少写了尾列的行补成整行（同 GFM），否则这一行的底色与边框会在半截断掉 */
        const cells = row.length < head.length ? [...row, ...Array(head.length - row.length).fill('')] : row;
        const id = RULE_ID.test(cells[0]) ? ` id="rule-${cells[0]}"` : '';
        return `<tr${id}>${cells.map((c) => `<td>${ilx(c)}</td>`).join('')}</tr>`;
      }).join('');
      out.push(`<div class="md-table"><table>${thead}<tbody>${tbody}</tbody></table></div>`);
      continue;
    }

    if (LIST.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && (LIST.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const m = LIST.exec(lines[i]);
        if (m) items.push(m[3]);
        else items[items.length - 1] += ` ${lines[i].trim()}`; /* 续行并入上一项 */
        i += 1;
      }
      const lis = items.map((text) => {
        const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
        if (!task) return `<li${ruleAttr(text)}>${ilx(text)}</li>`;
        const done = task[1] !== ' ';
        return `<li class="md-task${done ? ' is-done' : ''}"><span class="md-task__box" aria-hidden="true">${done ? '✓' : ''}</span><span>${ilx(task[2])}</span></li>`;
      }).join('');
      out.push(ordered ? `<ol>${lis}</ol>` : `<ul>${lis}</ul>`);
      continue;
    }

    if (!line.trim()) { i += 1; continue; }

    /* 段落：首行无条件收下（以 | 开头却没有分隔行的「伪表格」也落在这里，否则会原地打转），
       之后遇到任何块级起始就停。 */
    const para = [line.trim()];
    for (i += 1; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|```|\s*\|)/.test(lines[i]) && !LIST.test(lines[i]); i += 1) para.push(lines[i].trim());
    out.push(`<p>${ilx(para.join(' '))}</p>`);
  }

  return { html: out.join('\n'), headings };
}
