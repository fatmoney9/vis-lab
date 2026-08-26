import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fitImageContent,
  imageContentTooltip,
  normalizeImageContent,
} from '../charts/core/image-content.js';

const METRICS = {
  padding: 4,
  imageGap: 6,
  textGap: 2,
  valueFontDeviation: 0,
  image: { min: 12, max: 64 },
  label: { min: 11, max: 28 },
  value: { min: 11, max: 20 },
};
const testMeasure = (content, size) => String(content).length * size * 0.62;
const fitContent = (options) => fitImageContent({
  ...options,
  measureLabel: options.measureLabel ?? testMeasure,
  measureValue: options.measureValue ?? options.measureLabel ?? testMeasure,
});

test('IMAGECONTENT-01：标准化合同不识别业务字段且允许无图片', () => {
  assert.deepEqual(normalizeImageContent({
    label: 'Entity', value: 12, details: [{ label: 'Metric', value: null }], ignored: 'business',
  }), {
    label: 'Entity', value: '12', image: null, imageFallback: null,
    details: [{ key: '0', label: 'Metric', value: '-' }],
  });
  assert.deepEqual(normalizeImageContent(null, { label: 'Fallback' }), {
    label: 'Fallback', value: null, image: null, imageFallback: null, details: [],
  });
});

test('IMAGECONTENT-01/02：无实体图片时首字母兜底占用同一图片槽位', () => {
  assert.deepEqual(normalizeImageContent({
    label: 'Microsoft', value: '+2.03%', imageFallback: 'M',
  }), {
    label: 'Microsoft', value: '+2.03%', image: null, imageFallback: 'M', details: [],
  });
  assert.deepEqual(fitContent({
    label: 'MSFT', value: '+2.03%', image: null, imageFallback: 'M',
    width: 181, height: 137, metrics: METRICS,
  }), {
    imageSize: 64,
    imageFallbackSize: 28,
    labelSize: 28,
    valueSize: 20,
    showLabel: true,
    showValue: true,
    blockHeight: 120,
  });
  assert.deepEqual(fitContent({
    label: 'MSFT', value: '+2.03%', image: null, imageFallback: 'M',
    width: 32, height: 20, metrics: METRICS,
  }), {
    imageSize: 12,
    imageFallbackSize: 11,
    labelSize: null,
    valueSize: null,
    showLabel: false,
    showValue: false,
    blockHeight: 12,
  });
});

test('IMAGECONTENT-02：图片、标题与数值在上下限内按实际空间连续适配', () => {
  assert.deepEqual(fitContent({
    label: 'AAPL', value: '+7.23%', image: '/entity.png', width: 181, height: 137,
    metrics: METRICS,
  }), {
    imageSize: 64, labelSize: 28, valueSize: 20,
    showLabel: true, showValue: true, blockHeight: 120,
  });
  const fitted = fitContent({
    label: 'TEAM', value: '-4.22%', image: '/entity.png', width: 117, height: 85,
    metrics: METRICS,
  });
  assert.deepEqual(fitted, {
    imageSize: 33, labelSize: 18, valueSize: 18,
    showLabel: true, showValue: true, blockHeight: 77,
  });
  const smaller = fitContent({
    label: 'CSCO', value: '-0.21%', image: '/entity.png', width: 70, height: 65,
    metrics: METRICS,
  });
  assert.deepEqual(smaller, {
    imageSize: 21, labelSize: 14, valueSize: 14,
    showLabel: true, showValue: true, blockHeight: 57,
  });
  assert.equal(fitContent({
    label: 'AAPL', value: '+7.23%', image: '/entity.png', width: 31, height: 19,
    metrics: METRICS,
  }), null);
});

test('IMAGECONTENT-02：数值优先字号取名称适配字号减主题差值', () => {
  const metrics = {
    ...METRICS,
    image: { min: 12, max: 12 },
    label: { min: 11, max: 20 },
    value: { min: 11, max: 20 },
  };
  const fit = (valueFontDeviation) => fitContent({
    label: 'AAPL',
    value: '+7.23%',
    image: '/entity.png',
    width: 180,
    height: 100,
    metrics: { ...metrics, valueFontDeviation },
  });
  assert.equal(fit(2).valueSize, fit(2).labelSize - 2, 'THS/iFinD 使用名称字号减 2px');
  assert.equal(fit(0).valueSize, fit(0).labelSize, 'AInvest 使用名称字号减 0px');
});

test('IMAGECONTENT-02：缺少图片时沿用同一布局合同但不预留图片高度', () => {
  const layout = fitContent({
    label: 'Entity', value: '12', image: null, width: 160, height: 128,
    metrics: METRICS,
  });
  assert.equal(layout.imageSize, 0);
  assert.equal(layout.blockHeight, 50);
});

test('IMAGECONTENT-02：紧凑空间优先保留实体图片，再按空间决定是否带标题', () => {
  assert.deepEqual(fitContent({
    label: 'CSCO', value: '-0.21%', image: '/entity.png', width: 42, height: 38,
    metrics: METRICS,
  }), {
    imageSize: 13, labelSize: 11, valueSize: null,
    showLabel: true, showValue: false, blockHeight: 30,
  });
  assert.deepEqual(fitContent({
    label: 'CSCO', value: '-0.21%', image: '/entity.png', width: 32, height: 20,
    metrics: METRICS,
  }), {
    imageSize: 12, labelSize: null, valueSize: null,
    showLabel: false, showValue: false, blockHeight: 12,
  });
  assert.deepEqual(fitContent({
    label: 'GOOG', value: '+0.80%', image: '/entity.png', width: 20, height: 30,
    metrics: METRICS,
  }), {
    imageSize: 12, labelSize: null, valueSize: null,
    showLabel: false, showValue: false, blockHeight: 12,
  });
  assert.equal(fitContent({
    label: 'GOOG', value: '+0.80%', image: '/entity.png', width: 19, height: 30,
    metrics: METRICS,
  }), null);
});

test('IMAGECONTENT-02：无图片时依次回落到标题或数值', () => {
  assert.deepEqual(fitContent({
    label: 'Entity', value: '12', image: null, width: 50, height: 30,
    metrics: METRICS,
  }), {
    imageSize: 0, labelSize: 11, valueSize: null,
    showLabel: true, showValue: false, blockHeight: 11,
  });
  assert.deepEqual(fitContent({
    label: 'Entity', value: '12', image: null, width: 30, height: 20,
    metrics: METRICS,
  }), {
    imageSize: 0, labelSize: null, valueSize: 11,
    showLabel: false, showValue: true, blockHeight: 11,
  });
});

test('IMAGECONTENT-02：布局必须由 L1 注入真实文字测量能力', () => {
  assert.throws(() => fitImageContent({
    label: 'Entity', value: '12', image: null, width: 100, height: 100,
    metrics: METRICS,
  }), /必须注入 L1 文字测量函数/);
});

test('IMAGECONTENT-04：详情内容直接转换为共享 Tooltip 合同', () => {
  assert.deepEqual(imageContentTooltip({
    label: 'Entity', value: '12', image: '/entity.png',
    details: [{ key: 'metric', label: 'Metric', value: '203.98' }],
  }), {
    title: 'Entity',
    titleIcon: '/entity.png',
    rows: [{ key: 'metric', label: 'Metric', value: '203.98', showMarker: false }],
  });
  assert.deepEqual(imageContentTooltip({
    label: 'Microsoft', value: '+2.03%', imageFallback: 'M',
  }), {
    title: 'Microsoft',
    titleIcon: null,
    titleIconFallback: 'M',
    rows: [{ key: 'value', label: 'Microsoft', value: '+2.03%', showMarker: false }],
  });
});
