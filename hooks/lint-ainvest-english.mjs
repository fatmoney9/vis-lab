/*
 * 门禁 · 英文主题（demos/themes.js 里 locale: 'en' 的，当前只有 Ainvest）下图表内**内容**必须是英文。
 *
 * 遍历的是 locale 登记而不是写死 'ainvest'：L3 的语言判断已统一走 contentLocale()，
 * 守卫若仍只查一个 id，新登记的英文主题就会在没人检查的情况下上线。
 *
 * 口径（与 demos/chart-presentation.js 的文件头一致）：图表内部的可见业务文案——系列名、
 * 类目、图例、轴标题、扇区名、雷达维度、节点名、标注文字——在 Ainvest 下全部转英文。
 * 站点导航、示例标题与配置面板仍是中文，那些不进 cfg，本守卫也够不着。
 *
 * ── 为什么非要有这一份 ────────────────────────────────────────────
 * 翻译发生在 `buildConfig` 里的 `chartContentPresentation`。**只要有哪条路径绕开 buildConfig
 * 自己手拼 cfg，整条适配就在那条路径上失效**，而页面照样渲染、门禁照样全绿。
 * 2026-09-20 真实发生过：首页播放的 `applyPeriod` 手拼了 cfg，于是竞赛图在 Ainvest 下
 * 「静止时是 Banking，一点播放就变回银行」。
 *
 * 所以本守卫**必须同时走两条路**：静态配置，以及**逐期播放配置**。只查静态那条的话，
 * 上面那个 bug 一样漏过去——它当时就是静态英文、播放中文。
 */
import { examplesFor, buildConfig, playbackPeriodsOf, activePeriodExample } from '../demos/examples.js';
import { THEMES } from '../demos/themes.js';

/* CJK 统一表意文字 + 扩展 A + 常用中文标点。不含日文假名：本仓库没有日文面。 */
const CJK = /[一-鿿㐀-䶿、。《》「」（），：；]/;

/* 已知欠账：登记在这里的示例暂不拦截，**这张表只能变短、不能变长**。
   新增示例一律不得进这张表——那正是本守卫存在的意义。 */
const KNOWN_DEBT = new Set([]);

const collect = (value, path, out) => {
  if (typeof value === 'string') {
    if (CJK.test(value)) out.push(`${path} = ${JSON.stringify(value)}`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => collect(item, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      collect(item, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
};

const EN_THEMES = THEMES.filter((t) => t.locale === 'en').map((t) => t.id);
if (!EN_THEMES.length) {
  /* 空集 = 本守卫什么都没查却报通过；locale 登记被误删时必须当场红 */
  console.error('✗ [英文内容] demos/themes.js 没有任何 locale: \'en\' 的主题——守卫无对象可查');
  process.exit(1);
}
const failures = [];
let checkedConfigs = 0;

for (const theme of EN_THEMES) {
  const STATE = { theme, platform: 'pc' };
  for (const example of examplesFor('index')) {
    if (KNOWN_DEBT.has(example.id)) continue;
    const hits = [];

    /* ① 静态配置 */
    collect(buildConfig(example, STATE), '', hits);
    checkedConfigs += 1;

    /* ② 逐期播放配置——与 L3 的 applyPeriod 同一条路。 */
    const periods = playbackPeriodsOf(example, { theme });
    for (let i = 0; i < periods.length; i += 1) {
      collect(
        buildConfig(activePeriodExample(example, { periodIndex: i, theme }), STATE),
        `期${i}`,
        hits,
      );
      checkedConfigs += 1;
    }

    if (hits.length) failures.push({ id: `${theme}/${example.id}`, group: example.group, hits });
  }
}

if (failures.length) {
  console.error('✗ [英文内容] 以下示例在英文主题下，图表内容仍含中文（id 前缀为主题）：');
  for (const f of failures) {
    console.error(`    ${f.id}（${f.group}）共 ${f.hits.length} 处，例如：`);
    for (const hit of f.hits.slice(0, 4)) console.error(`      ${hit}`);
  }
  console.error('  修法：把业务词加进 demos/chart-presentation.js 的 AINVEST_TEXT 词表；');
  console.error('  若某条路径根本没走 buildConfig（手拼 cfg），修那条路径——翻译只在装配线上发生。');
  process.exit(1);
}

console.log(`✓ 英文内容守卫通过（${EN_THEMES.join(' / ')}：${checkedConfigs} 份配置含逐期播放；已知欠账 ${KNOWN_DEBT.size} 项）`);
