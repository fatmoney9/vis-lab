import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  aggregateValue,
  displayChildren,
  entryCells,
  fitTreemapLabel,
  ratioShares,
  treemapPlotHeight,
} from '../charts/charts/treemap/geometry.js';
import {
  detailTooltipContent,
  itemPresentation,
} from '../charts/charts/treemap/content.js';

const THEME_TOKENS = Object.fromEntries(
  ['ths', 'ifind-pc', 'ainvest'].map((theme) => [
    theme,
    JSON.parse(readFileSync(new URL(`../tokens/${theme}.json`, import.meta.url), 'utf8')),
  ]),
);
const BEHAVIOR = JSON.parse(
  readFileSync(new URL('../tokens/behavior.json', import.meta.url), 'utf8'),
);

function tokenNumber(tokens, name) {
  const value = tokens[name];
  const alias = typeof value === 'string' ? value.match(/^\{([\w-]+)\}$/) : null;
  if (alias) return tokenNumber(tokens, alias[1]);
  const number = Number.parseFloat(value);
  assert.ok(Number.isFinite(number), `${name} 应解析为数值 token`);
  return number;
}

const THS_LABEL_METRICS = {
  padding: tokenNumber(THEME_TOKENS.ths, 'spacing-4'),
  gap: tokenNumber(THEME_TOKENS.ths, 'spacing-2'),
  nameMax: tokenNumber(THEME_TOKENS.ths, 'font-size-treemap-local-label-name'),
  nameMin: tokenNumber(THEME_TOKENS.ths, 'font-size-treemap-local-label-name-min'),
  valueMax: tokenNumber(THEME_TOKENS.ths, 'font-size-treemap-local-label-value'),
  valueMin: tokenNumber(THEME_TOKENS.ths, 'font-size-treemap-local-label-value-min'),
  lineExtra: tokenNumber(THEME_TOKENS.ths, 'spacing-4'),
  valueFontDeviation: tokenNumber(THEME_TOKENS.ths, 'size-treemap-value-font-deviation'),
  measureName: (text, size) => Array.from(String(text)).length * size,
};

const closeTo = (actual, expected, epsilon = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} 应接近 ${expected}`);
};

test('TREEMAP-01：父节点递归汇总有效叶子，0 保留，null 与负值过滤', () => {
  const root = {
    name: '全部',
    children: [
      { name: 'A', children: [{ name: 'A1', value: 12 }, { name: 'A2', value: 0 }] },
      { name: 'B', value: null },
      { name: 'C', value: -2 },
      { name: 'D', value: 8 },
    ],
  };
  assert.equal(aggregateValue(root), 20);
  assert.deepEqual(displayChildren(root).map(({ index, value }) => ({ index, value })), [
    { index: 0, value: 12 },
    { index: 3, value: 8 },
  ]);
});

test('TREEMAP-02：保持真实面积比例且总和为 1', () => {
  const shares = ratioShares([98, 1, 1]);
  closeTo(shares[0], 0.98);
  closeTo(shares[1], 0.01);
  closeTo(shares[2], 0.01);
  closeTo(shares.reduce((sum, value) => sum + value, 0), 1);
});

test('TREEMAP-02：极端跨度不使用无来源的面积压缩上限', () => {
  const shares = ratioShares([1_000_000, 1]);
  closeTo(shares[0] / shares[1], 1_000_000, 1e-6);
  closeTo(shares.reduce((sum, value) => sum + value, 0), 1);
  assert.deepEqual(ratioShares([0, 0]), [0, 0]);
});

test('TREEMAP-11：6 项入口型形成 3×2 等面积布局', () => {
  const cells = entryCells(6, 300, 160);
  assert.equal(cells.length, 6);
  cells.forEach((cell) => {
    closeTo(cell.x1 - cell.x0, 100);
    closeTo(cell.y1 - cell.y0, 80);
  });
  assert.deepEqual(cells[0], { index: 0, x0: 0, x1: 100, y0: 0, y1: 80 });
  assert.deepEqual(cells[5], { index: 5, x0: 200, x1: 300, y0: 80, y1: 160 });
});

test('TREEMAP-08/12：容器高度优先并只扣实际显示的面包屑', () => {
  /* [TREEMAP-08] 单层展示、容器内无附加带，故图面高恒等于容器高，两条来源口径一致。 */
  assert.equal(treemapPlotHeight({
    hostHeight: 300, fallbackHeight: 160, useContainerHeight: true,
  }), 300, '容器给了高就全部给图面');
  assert.equal(treemapPlotHeight({
    hostHeight: 0, fallbackHeight: 200, useContainerHeight: false,
  }), 200, 'auto 高宿主退到主题 token --size-chart-region-height');
  assert.equal(treemapPlotHeight({
    hostHeight: 0, fallbackHeight: 0, useContainerHeight: false,
  }), 0, '既无容器高也无主题 token 时必须暴露配置缺失');
});

test('TREEMAP-05：标题优先，THS 数值从名称字号减 2px 开始适配', () => {
  const fit = fitTreemapLabel({
    name: '化学制品', value: '1234', width: 56, height: 52, ...THS_LABEL_METRICS,
  });
  assert.deepEqual(fit.nameLines, ['化学制品']);
  assert.equal(fit.nameSize, 12);
  assert.equal(fit.valueSize, 10);
});

test('TREEMAP-05：标题先换成两行，数值再独立缩小', () => {
  const fit = fitTreemapLabel({
    name: '化学制品', value: '123', width: 32, height: 56, ...THS_LABEL_METRICS,
  });
  assert.deepEqual(fit.nameLines, ['化学', '制品']);
  assert.equal(fit.nameSize, 12);
  assert.equal(fit.valueSize, 8);
});

test('TREEMAP-05：不足两个最小字号字符宽度时整组文字隐藏', () => {
  assert.equal(fitTreemapLabel({
    name: '化学制品', value: '1', width: 23, height: 80, ...THS_LABEL_METRICS,
  }), null);
});

test('TREEMAP-05：高度只容纳标题时隐藏数值', () => {
  const fit = fitTreemapLabel({
    name: '业务', value: '123', width: 40, height: 26, ...THS_LABEL_METRICS,
  });
  assert.deepEqual(fit.nameLines, ['业务']);
  assert.equal(fit.valueText, null);
});

test('TREEMAP-05：L2 标签布局必须由 L1 注入文字测量能力', () => {
  assert.throws(() => fitTreemapLabel({
    name: '业务', value: '123', width: 40, height: 40,
    ...THS_LABEL_METRICS,
    measureName: null,
  }), /L1 注入文字测量函数/);
});

test('TREEMAP-18：三主题共用单画布布局，behavior 只选择内容与颜色能力', () => {
  /* [TREEMAP-06] 三主题都只有 color-mode 与 content 两个键——层级下钻与顶部路径
     已按产品决定整体移除，`root-breadcrumb` 一并退场，不留残键。 */
  assert.deepEqual(BEHAVIOR.ths['treemap-profile'], {
    'color-mode': 'config', content: 'text',
  });
  assert.deepEqual(BEHAVIOR['ifind-pc']['treemap-profile'], {
    'color-mode': 'series', content: 'text',
  });
  assert.deepEqual(BEHAVIOR.ainvest['treemap-profile'], {
    'color-mode': 'semantic-binned', content: 'image',
  });
  assert.deepEqual(
    Object.values(THEME_TOKENS).map((tokens) => tokenNumber(
      tokens,
      'size-treemap-value-font-deviation',
    )),
    [2, 2, 0],
    'THS/iFinD 沿用文本树图 -2px 规则，AInvest 原稿没有该逻辑',
  );
  assert.deepEqual([
    tokenNumber(THEME_TOKENS.ainvest, 'size-treemap-content-image-max'),
    tokenNumber(THEME_TOKENS.ainvest, 'size-treemap-content-image-min'),
    tokenNumber(THEME_TOKENS.ainvest, 'font-size-treemap-local-label-name'),
    tokenNumber(THEME_TOKENS.ainvest, 'font-size-treemap-local-label-name-min'),
    tokenNumber(THEME_TOKENS.ainvest, 'font-size-treemap-local-label-value'),
    tokenNumber(THEME_TOKENS.ainvest, 'font-size-treemap-local-label-value-min'),
    tokenNumber(THEME_TOKENS.ainvest, 'font-weight-treemap-name'),
    tokenNumber(THEME_TOKENS.ainvest, 'font-weight-data-label'),
  ], [64, 12, 28, 11, 20, 11, 600, 500]);
  assert.deepEqual({
    down1: THEME_TOKENS.ainvest['color-price-down-gradient-1'],
    down2: THEME_TOKENS.ainvest['color-price-down-gradient-2'],
    down3: THEME_TOKENS.ainvest['color-price-down-gradient-3'],
    even: THEME_TOKENS.ainvest['color-price-even-gradient'],
    up3: THEME_TOKENS.ainvest['color-price-up-gradient-3'],
    up2: THEME_TOKENS.ainvest['color-price-up-gradient-2'],
    up1: THEME_TOKENS.ainvest['color-price-up-gradient-1'],
  }, {
    down1: { light: '#F77C7C', dark: '#4D1209' },
    down2: { light: '#F05045', dark: '#991A12' },
    down3: { light: '#981400', dark: '#E03838' },
    even: { light: '#B8B8B8', dark: '#333333' },
    up3: { light: '#04663D', dark: '#00A15E' },
    up2: { light: '#009959', dark: '#005C36' },
    up1: { light: '#2CBD80', dark: '#003821' },
  }, 'AInvest 三档涨跌色应保持 Figma 范围条的变量和值');
  assert.deepEqual({
    down1: THEME_TOKENS.ths['color-price-down-gradient-1'],
    down2: THEME_TOKENS.ths['color-price-down-gradient-2'],
    down3: THEME_TOKENS.ths['color-price-down-gradient-3'],
    up1: THEME_TOKENS.ths['color-price-up-gradient-1'],
    up2: THEME_TOKENS.ths['color-price-up-gradient-2'],
    up3: THEME_TOKENS.ths['color-price-up-gradient-3'],
  }, {
    down1: '{color-price-down}',
    down2: 'rgba(7, 171, 75, 0.75)',
    down3: 'rgba(7, 171, 75, 0.55)',
    up1: '{color-price-up}',
    up2: 'rgba(255, 36, 54, 0.75)',
    up3: 'rgba(255, 36, 54, 0.55)',
  }, 'THS 三档色应直接包含 100% / 75% / 55% 透明度，不由 core 叠加');
  Object.values(THEME_TOKENS).forEach((tokens) => {
    assert.equal(tokens['ratio-visualization-semantic-bin-1'], undefined);
    assert.equal(tokens['ratio-visualization-semantic-bin-2'], undefined);
    assert.equal(tokens['size-treemap-entry-height'], undefined);
    assert.equal(tokens['size-treemap-local-height'], undefined);
    assert.equal(tokens['size-treemap-overall-height'], undefined);
    assert.equal(tokens['font-weight-semibold'], undefined);
  });
});

test('TREEMAP-18：图片与详情只消费通用 presentation 合同', () => {
  const item = {
    node: {
      name: 'Apple',
      presentation: {
        label: 'AAPL', value: '+7.23%', image: '/aapl.png', imageFallback: 'A', colorValue: 7.23,
        details: [{ key: 'metric', label: 'Metric', value: '203.98' }],
      },
    },
    displayValue: '+7.23%',
  };
  assert.deepEqual(itemPresentation(item), {
    label: 'AAPL', value: '+7.23%', image: '/aapl.png', imageFallback: 'A', colorValue: 7.23,
    details: [{ key: 'metric', label: 'Metric', value: '203.98' }],
  });
  item.presentation = itemPresentation(item);
  assert.deepEqual(detailTooltipContent(item), {
    title: 'AAPL',
    titleIcon: '/aapl.png',
    titleIconFallback: 'A',
    rows: [
      { key: 'metric', label: 'Metric', value: '203.98', showMarker: false },
    ],
  });
});

test('TREEMAP-17：缺失或非法 colorValue 保持为空，不伪装成平盘', () => {
  assert.equal(itemPresentation({ node: { name: 'Missing' } }).colorValue, null);
  assert.equal(itemPresentation({
    node: { name: 'Invalid', presentation: { colorValue: 'not-a-number' } },
  }).colorValue, null);
});
