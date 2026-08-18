import { scaleLinear, scaleBand } from 'd3';

/*
 * L1 · 值 → 像素的比例尺（依赖 d3）。
 * **刻度三件套的纯数学不在这里**——它在零依赖的 `core/split.js`（`niceSplit` / `niceSplitDual`），
 * 拆开只为一件事：本文件 import d3，`node --test` 加载不了，整套刻度算法就一行都测不了。
 * 判例同 `legend-state.js` 从 `legend.js` 拆出。权威规范见 specs/axes.md SCALE-01/03/04。
 */

/* 数值 → 像素（Y 向下为正，故 range 反转） */
export function linearY(split, top, bottom) {
  return scaleLinear().domain([split.min, split.max]).range([bottom, top]);
}

/* 类目 → band 位置与宽度（柱状图及延伸图表的 X 轴）
   mode：
     'slot'   所有柱（单柱 / 分组 / 堆叠）：band = step（每格铺满、格间距最小 0）。侧白与组间距全部作为
              「容器 = min(step, 容器上限)」之外的残量——数据少→容器封顶、格间距（=step−容器内容）变大；
              数据多→容器缩小、格间距=0。组内/单柱的具体排布与留白见 layout.js（groupedBars / singleBar）
     'center' 纯折线等：点居 band 中心、两端留 1/6 inset */
export function bandX(categories, left, right, { mode = 'center' } = {}) {
  const [pi, po] = mode === 'slot' ? [0, 0] : [1 / 3, 1 / 6];
  return scaleBand().domain(categories).range([left, right]).paddingInner(pi).paddingOuter(po);
}
