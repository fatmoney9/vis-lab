/*
 * L3 · 各图表类型支持哪些语义旋钮（决定预览面画哪几个开关），以及跟随旋钮的缺省值。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

export const INITIAL_ZOOM = { start: 0.35, end: 1 };

/*
 * 各图表类型支持哪些**语义旋钮**（≠ 样式参数，样式一律走 token）。
 * 预览面据此决定显示哪几个开关——新图表在这里声明，两面自动适配。
 *   zoom      缩放轴（DATAZOOM-01..07，需要类目轴）
 *   area      主线渐变面积（仅非堆叠且含折线的 cartesian 配置，见 supportsArea）
 *   dataLabel 数据标签开关（LABEL-05）——**只有直角坐标系声明**，开 = 按图表类型默认
 *   axisTitle 轴标题开关（AXISTITLE-01，默认不显示；开时注入 { y, y2, x } 文案）
 *   animation 入场生长开关（MOTION-01/07，**默认开**——与其他旋钮相反，关掉才落进 cfg）
 */
export const CHART_CAPABILITIES = {
  hbar: { density: true, animation: true },
  cartesian: { zoom: true, area: true, dataLabel: true, axisTitle: true, animation: true, legendSelect: true, yIndicator: true, callout: true },
  /* 饼 / 环无类目轴、无 Y 轴、无折线：zoom / area / axisTitle 一概不声明，
     两个预览面的对应旋钮据此自动不出现（见 specs/pie.md 活 demo 的验收点）。
     **不声明 dataLabel**：饼环的显隐与形态是同一件事（PIE-12「引线与标签强绑定」——
     「显示但没形态」不是合法状态），故合并进 labelLayout 一个三档旋钮，见 buildConfig。
     legend / labelLayout / labelAlign 是本族专属，cartesian 不声明。
     [LEGEND-06][LEGEND-14] legendSelect 只有 cartesian / pie 声明：它是「点击图例发生什么」的
     三档语义，前提是图例可点。桑基的图例是静态色卡（renderLegend 不接 onToggle/onHover，
     且标了 role="list"），没有点击可言，故本族不声明——不是漏了。 */
  pie: { animation: true, legend: true, labelLayout: true, labelAlign: true, legendSelect: true },
  /* [RADAR-07] 雷达无坐标轴、无 Y 轴、无折线：zoom / area / axisTitle / dataLabel 一概不声明
     （它已进 tests/examples.test.mjs 的 axisless 名单，那是被断言的契约、不是约定）。
     axisValue 是本族专属：轴标签是否带数值。**与交互无关**——基线 7.2 那条「展示数值时
     不可交互」已被 AInvest Figma 推翻（三组数据带数值且照常 hover），故它只是个显隐开关。
     [RADAR-03/05/07/14/18] 对外示例分标准 / 多数据 / 分区，但组件视觉变体仍只有 basic / rating：
     多数据是 series 数量不同，不是第三个 variant。网格、闭合轮廓与标签排列都可正交组合；
     editable 只开放给单系列示例，多系列示例不显示该能力。ratingStyle / ratingBandCount 只在
     rating 分类下有意义；后者只在分段档显示。 */
  radar: {
    animation: true, legendSelect: true, axisValue: true,
    radarGridShape: true, radarShape: true, ratingStyle: true, ratingBandCount: true,
    axisLabelLayout: true, radarEditable: true,
  },
  /* 桑基当前由节点 hover / 点击和季度播放 API 承担交互，不复用坐标轴或饼环旋钮。 */
  sankey: { density: false },
  /* [CHORD-05][CHORD-11][CHORD-19] 弦图无坐标轴、无 Y 轴、无折线：zoom / area / axisTitle /
     dataLabel 一概不声明。**不声明 legendSelect**：本族根本不渲染图例（CHORD-19 写明这是
     判断不是遗漏），没有图例可点。chordVariant / chordLabelLayout 是本族专属的两档形态语义。 */
  chord: { density: true, animation: true, chordVariant: true, chordLabelLayout: true },
  /* 矩形树图无轴、无图例；入口、通用与全局作为独立示例，共用本族能力。 */
  treemap: { animation: true, treemapColor: true, treemapImage: true },
  /* 瀑布图固定少量叙事项，不提供密度旋钮；仅颜色提供预览旋钮。
     X 轴内容与节点关系仍是实例语义配置，直接写在示例 cfg 中，不进入预览菜单。 */
  waterfall: { density: false, animation: true, waterfallColor: true },
  /* 全球热力图是固定完整世界视图；当前规范只开放数据与色调语义，不提供样式旋钮。 */
  'world-heatmap': { density: false },
};

/*
 * [PIE-09][PIE-12] 外侧引线档下**图例方位的建议默认值**。
 * 左右结构里右侧的标签带会把图例推得很远、整组重心偏掉，故切到引线时把图例默认拨到上下。
 * 只是预览面的**默认值联动**，用户仍可手动改回左右；组件的默认方位仍是 'right'（PIE-09 未变）。
 * 放这里而不是各写一遍：两个预览面共用，省得将来改了一处漏一处。
 */
export const suggestedLegend = (labelLayout) => (labelLayout === 'outside' ? 'bottom' : 'right');

/* [AXISTITLE-01] 轴标题旋钮打开时注入的通用文案；示例可用自己的 axisTitle 字段覆盖（给更贴切的文案）。
   文案是内容不是样式——两面共用这一份，避免各写各的。
   **y2 是否落进最终 cfg 由 buildConfig 按图表形态实判**（见那里的注释），不靠逐示例记得写。 */
export const AXIS_TITLES = { y: '单位：元', y2: '副轴', x: '交易日' };
