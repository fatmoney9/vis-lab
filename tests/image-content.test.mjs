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
  compact: { minWidth: 32, minHeight: 20, imageSize: 12, fontSize: 10 },
  presets: [
    { minWidth: 160, minHeight: 128, imageSize: 64, labelSize: 28, valueSize: 20 },
    { minWidth: 96, minHeight: 96, imageSize: 32, labelSize: 16, valueSize: 14 },
    { minWidth: 56, minHeight: 56, imageSize: 16, labelSize: 12, valueSize: 12 },
  ],
};

test('IMAGECONTENT-01：标准化合同不识别业务字段且允许无图片', () => {
  assert.deepEqual(normalizeImageContent({
    label: 'Entity', value: 12, details: [{ label: 'Metric', value: null }], ignored: 'business',
  }), {
    label: 'Entity', value: '12', image: null,
    details: [{ key: '0', label: 'Metric', value: '-' }],
  });
  assert.deepEqual(normalizeImageContent(null, { label: 'Fallback' }), {
    label: 'Fallback', value: null, image: null, details: [],
  });
});

test('IMAGECONTENT-02：图片、标题与数值按调用方尺寸档降级', () => {
  assert.deepEqual(fitImageContent({
    label: 'AAPL', value: '+7.23%', image: '/entity.png', width: 181, height: 137,
    metrics: METRICS,
  }), {
    imageSize: 64, labelSize: 28, valueSize: 20,
    showLabel: true, showValue: true, blockHeight: 120,
  });
  const medium = fitImageContent({
    label: 'TEAM', value: '-4.22%', image: '/entity.png', width: 117, height: 141,
    metrics: METRICS,
  });
  assert.equal(medium.imageSize, 32);
  assert.equal(medium.labelSize, 16);
  assert.equal(medium.valueSize, 14);
  const compact = fitImageContent({
    label: 'CSCO', value: '-0.21%', image: '/entity.png', width: 70, height: 65,
    metrics: METRICS,
  });
  assert.equal(compact.imageSize, 16);
  assert.equal(fitImageContent({
    label: 'AAPL', value: '+7.23%', image: '/entity.png', width: 31, height: 19,
    metrics: METRICS,
  }), null);
});

test('IMAGECONTENT-02：缺少图片时沿用同一布局合同但不预留图片高度', () => {
  const layout = fitImageContent({
    label: 'Entity', value: '12', image: null, width: 160, height: 128,
    metrics: METRICS,
  });
  assert.equal(layout.imageSize, 0);
  assert.equal(layout.blockHeight, 50);
});

test('IMAGECONTENT-02：紧凑空间优先保留实体图片，再按空间决定是否带标题', () => {
  assert.deepEqual(fitImageContent({
    label: 'CSCO', value: '-0.21%', image: '/entity.png', width: 42, height: 38,
    metrics: METRICS,
  }), {
    imageSize: 12, labelSize: 10, valueSize: null,
    showLabel: true, showValue: false, blockHeight: 28,
  });
  assert.deepEqual(fitImageContent({
    label: 'CSCO', value: '-0.21%', image: '/entity.png', width: 32, height: 20,
    metrics: METRICS,
  }), {
    imageSize: 12, labelSize: null, valueSize: null,
    showLabel: false, showValue: false, blockHeight: 12,
  });
  assert.deepEqual(fitImageContent({
    label: 'GOOG', value: '+0.80%', image: '/entity.png', width: 20, height: 30,
    metrics: METRICS,
  }), {
    imageSize: 12, labelSize: null, valueSize: null,
    showLabel: false, showValue: false, blockHeight: 12,
  });
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
});
