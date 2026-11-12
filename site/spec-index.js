/*
 * L3 · 站点「设计规范」的页面清单：哪些 specs/*.md 进站点、怎么分组、各自管哪些规则 ID 前缀。
 *
 * **只登记、不复述**：规则正文的唯一的家仍是 specs/*.md（WORKFLOW §一「规范只有一个家」），
 * 站点运行时按这里的 id 去取 `specs/<id>.md` 现场渲染；这里只有导航要用的短名。
 *
 * prefixes 的用途：详情页的规范徽标（如 `PIE-01 / COLOR-08`）要知道每个 ID 住在哪一页才能跳过去。
 * 由 hooks/lint-spec-index.mjs 双向核对——specs/ 下每个文件都要登记、登记的都要存在；
 * 每页实际出现的规则前缀都要声明；每个示例的规范徽标都要能跳到一条真实存在的规则。
 * 新增规范页漏登记，站点上就静默少一页，故交给门禁而不是靠记得。
 *
 * 纯数据 + 纯函数、零 import，可被 node 直接加载（门禁要 import 它）。
 */

export const REPO_BLOB_URL = 'https://github.com/fatmoney9/vis-lab/blob/main/';

export const SPEC_GROUPS = [
  {
    label: '通用规则',
    pages: [
      { id: 'color', label: '颜色', prefixes: ['COLOR', 'COLOR-ADR'] },
      { id: 'axes', label: '坐标轴与网格', prefixes: ['SCALE', 'GRID', 'AXIS'] },
      { id: 'axis-title', label: '轴标题', prefixes: ['AXISTITLE'] },
      { id: 'legend', label: '图例', prefixes: ['LEGEND'] },
      { id: 'data-label', label: '数据标签', prefixes: ['LABEL'] },
      { id: 'tooltip', label: '提示框', prefixes: ['TOOLTIP'] },
      { id: 'datazoom', label: '缩放轴', prefixes: ['DATAZOOM'] },
      { id: 'format', label: '数值格式', prefixes: ['FORMAT'] },
      { id: 'motion', label: '动效', prefixes: ['MOTION'] },
      { id: 'playback', label: '播放轴', prefixes: ['PLAYBACK'] },
      { id: 'watermark', label: '水印', prefixes: ['WATERMARK'] },
      { id: 'callout', label: '图表标注', prefixes: ['CALLOUT'] },
      { id: 'chart-text', label: '组件固定文案', prefixes: ['CHARTTEXT'] },
      { id: 'image-content', label: '图片内容块', prefixes: ['IMAGECONTENT'] },
    ],
  },
  {
    label: '图型规则',
    pages: [
      { id: 'bar', label: '柱状图', prefixes: ['BAR'] },
      { id: 'line', label: '折线图', prefixes: ['LINE'] },
      { id: 'hbar', label: '横向条形图', prefixes: ['HBAR'] },
      { id: 'pie', label: '饼图与环形图', prefixes: ['PIE'] },
      { id: 'radar', label: '雷达图', prefixes: ['RADAR'] },
      { id: 'treemap', label: '矩形树图', prefixes: ['TREEMAP'] },
      { id: 'sankey', label: '桑基图', prefixes: ['SANKEY'] },
      { id: 'waterfall', label: '瀑布图', prefixes: ['WATERFALL'] },
      { id: 'chord', label: '弦图', prefixes: ['CHORD'] },
      { id: 'world-heatmap', label: '全球热力图', prefixes: ['WORLD-HEATMAP'] },
    ],
  },
];

export const SPEC_PAGES = SPEC_GROUPS.flatMap((group) => group.pages);

export const specPage = (id) => SPEC_PAGES.find((page) => page.id === id) ?? null;

/* 规则 ID → 所在页。按「去掉末尾序号后的前缀」整段匹配，不做前缀包含——
   否则 `COLOR-ADR-01` 会被 `COLOR` 抢走，`WORLD-HEATMAP-02` 的前缀里本身就带连字符。 */
export function specPageOfRule(ruleId) {
  const prefix = String(ruleId).replace(/-\d+$/, '');
  return SPEC_PAGES.find((page) => page.prefixes.includes(prefix)) ?? null;
}

/* 示例的 spec 字段（`'PIE-01 / COLOR-08'`）拆成单个 ID */
export const ruleIdsOf = (specText) => String(specText ?? '').split('/').map((s) => s.trim()).filter(Boolean);

/* 站内路由：#spec · #spec/<页> · #spec/<页>/<锚点>（锚点 = 元素 id：规则为 rule-<ID>，章节为标题 slug） */
export const specHref = (pageId, anchor) => `#spec${pageId ? `/${pageId}` : ''}${anchor ? `/${encodeURIComponent(anchor)}` : ''}`;
export const ruleHref = (ruleId) => {
  const page = specPageOfRule(ruleId);
  return page ? specHref(page.id, `rule-${ruleId}`) : null;
};

export function parseSpecRoute(hash) {
  const m = /^spec(?:\/([\w-]+))?(?:\/(.+))?$/.exec(hash);
  if (!m) return null;
  return { page: m[1] ?? null, anchor: m[2] ? decodeURIComponent(m[2]) : null };
}
