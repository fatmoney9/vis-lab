import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  aggregateValue,
  displayChildren,
  entryCells,
  fitTreemapLabel,
  pathNames,
  ratioShares,
  resolvePath,
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

test('TREEMAP-02：absolute 保持真实面积比例且总和为 1', () => {
  const shares = ratioShares([98, 1, 1], 'absolute');
  closeTo(shares[0], 0.98);
  closeTo(shares[1], 0.01);
  closeTo(shares[2], 0.01);
  closeTo(shares.reduce((sum, value) => sum + value, 0), 1);
});

test('TREEMAP-02：approximate 对极端跨度做同层统一压缩', () => {
  const shares = ratioShares([1_000_000, 1], 'approximate', 100);
  closeTo(shares[0] / shares[1], 100);
  closeTo(shares.reduce((sum, value) => sum + value, 0), 1);
  assert.deepEqual(ratioShares([0, 0], 'approximate', 100), [0, 0]);
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

test('TREEMAP-05：标题优先，安全空间内显示字号小 2px 的数值', () => {
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

test('TREEMAP-06：层级路径可解析并可回到任意祖先', () => {
  const root = {
    name: '全部',
    children: [{ name: '行业', children: [{ name: '子行业', value: 1 }] }],
  };
  assert.equal(resolvePath(root, [0, 0]).name, '子行业');
  assert.deepEqual(pathNames(root, [0, 0]), ['全部', '行业', '子行业']);
  assert.equal(resolvePath(root, [9]), root, '非法路径回落根节点');
});

test('TREEMAP-18：三主题共用单画布布局，behavior 只选择内容与颜色能力', () => {
  assert.deepEqual(BEHAVIOR.ths['treemap-profile'], {
    'color-mode': 'config', content: 'text', 'root-breadcrumb': true,
  });
  assert.deepEqual(BEHAVIOR['ifind-pc']['treemap-profile'], {
    'color-mode': 'series', content: 'text', 'root-breadcrumb': true,
  });
  assert.deepEqual(BEHAVIOR.ainvest['treemap-profile'], {
    'color-mode': 'semantic-binned', content: 'image', 'root-breadcrumb': false,
  });
  assert.deepEqual(
    ['xl', 'lg', 'md', 'sm'].map((size) => tokenNumber(
      THEME_TOKENS.ainvest,
      `size-treemap-block-${size}-image`,
    )),
    [64, 32, 16, 12],
  );
  assert.deepEqual(
    Object.values(THEME_TOKENS).map((tokens) => tokenNumber(tokens, 'size-treemap-local-height')),
    [160, 160, 160],
    '三主题通用矩形树图应使用相同画板高度',
  );
});

test('TREEMAP-18：图片与详情只消费通用 presentation 合同', () => {
  const item = {
    node: {
      name: 'Apple',
      presentation: {
        label: 'AAPL', value: '+7.23%', image: '/aapl.png', colorValue: 7.23,
        details: [{ key: 'metric', label: 'Metric', value: '203.98' }],
      },
    },
    displayValue: '+7.23%',
  };
  assert.deepEqual(itemPresentation(item), {
    label: 'AAPL', value: '+7.23%', image: '/aapl.png', colorValue: 7.23,
    details: [{ key: 'metric', label: 'Metric', value: '203.98' }],
  });
  item.presentation = itemPresentation(item);
  assert.deepEqual(detailTooltipContent(item), {
    title: 'AAPL',
    titleIcon: '/aapl.png',
    rows: [
      { key: 'metric', label: 'Metric', value: '203.98', showMarker: false },
    ],
  });
});
