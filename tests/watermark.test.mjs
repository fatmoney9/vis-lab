import test from 'node:test';
import assert from 'node:assert/strict';

import { watermarkAnchor } from '../charts/core/watermark.js';

/* grid 绘图区（left/right/top/bottom 像素），各用例共用 */
const grid = { left: 0, right: 600, top: 0, bottom: 160 };

test('WATERMARK-02/03：右下角锚——右缘距 grid 右沿 36、底缘距底部网格线 24（THS / iFinD 36×10）', () => {
  const { x, y } = watermarkAnchor('bottom-right', grid, { w: 36, h: 10 }, { right: 36, bottom: 24 });
  assert.deepEqual({ x, y }, { x: 600 - 36 - 36, y: 160 - 24 - 10 }); /* 528, 126 */
});

test('WATERMARK-02/03：左下角锚——左缘距 grid 左沿 4、底缘距底部网格线 2（Ainvest 96×20）', () => {
  const { x, y } = watermarkAnchor('bottom-left', grid, { w: 96, h: 20 }, { left: 4, bottom: 2 });
  assert.deepEqual({ x, y }, { x: 4, y: 160 - 2 - 20 }); /* 4, 138 */
});

test('WATERMARK-02：偏移缺省即 0——右下角无 offset 时右/底缘贴 grid 边', () => {
  const { x, y } = watermarkAnchor('bottom-right', grid, { w: 36, h: 10 });
  assert.deepEqual({ x, y }, { x: 600 - 36, y: 160 - 10 }); /* 564, 150 */
});

test('WATERMARK-02：偏移随 grid 平移（锚相对 grid 物理边、非容器/数据框边）', () => {
  const shifted = { left: 40, right: 640, top: 12, bottom: 172 };
  const a = watermarkAnchor('bottom-left', shifted, { w: 96, h: 20 }, { left: 4, bottom: 2 });
  assert.deepEqual(a, { x: 44, y: 150 }); /* 40+4, 172-2-20 */
});
