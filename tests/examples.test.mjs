import test from 'node:test';
import assert from 'node:assert/strict';

import { EXAMPLES, buildConfig } from '../demos/examples.js';

/*
 * demos/examples.js 是纯数据 + 配置装配（不 import d3、不碰 DOM），故可被 node 直接加载。
 * 本组守卫防的是**示例声明与图表形态不匹配**这一类静默错误：装配出的 cfg 与示例真实形态
 * 对不上时，预览面不会报错、只会少画点东西（曾漏过：双 Y 示例没写 y2 → 副轴标题静默不出）。
 */

const isDual = (example) => example.cfg(4).series.some((s) => s.axis === 'secondary');

test('AXISTITLE-01：默认不显示——旋钮不开时 cfg 里没有 axisTitle', () => {
  for (const e of EXAMPLES) {
    assert.equal(buildConfig(e, {}).axisTitle, undefined, `示例「${e.id}」默认不该带 axisTitle`);
  }
});

test('AXISTITLE-03：声明了副轴的示例，开轴标题后必有 y2（漏写由兜底按形态自动补）', () => {
  const duals = EXAMPLES.filter(isDual);
  assert.ok(duals.length > 0, 'EXAMPLES 里应至少有一个双 Y 示例，否则本守卫形同虚设');
  for (const e of duals) {
    const { axisTitle } = buildConfig(e, { axisTitle: true });
    assert.ok(axisTitle?.y2, `示例「${e.id}」是真·双量纲，但装配出的 axisTitle 缺 y2`);
  }
});

test('AXISTITLE-03：非双量纲示例不带 y2（误写也会被剔掉）', () => {
  for (const e of EXAMPLES.filter((x) => !isDual(x))) {
    const { axisTitle } = buildConfig(e, { axisTitle: true });
    assert.equal(axisTitle.y2, undefined, `示例「${e.id}」不是双量纲，cfg 不该出现 y2`);
  }
});

/* 动效与其他旋钮方向相反：组件默认就播，故「cfg 里没有 animation」= 开，只有关才落进 cfg。
   写反了不会报错、只会让预览面永远不播（或永远播），是典型的静默错误。 */
test('MOTION-07：默认开——不传旋钮时 cfg 里没有 animation（= 走组件默认）', () => {
  for (const e of EXAMPLES) {
    assert.equal(buildConfig(e, {}).animation, undefined, `示例「${e.id}」默认不该显式带 animation`);
    assert.equal(buildConfig(e, { animation: true }).animation, undefined, `示例「${e.id}」开着时也不必写进 cfg`);
  }
});

test('MOTION-07：关掉时必须显式落进 cfg，否则组件仍会播', () => {
  for (const e of EXAMPLES) {
    assert.equal(buildConfig(e, { animation: false }).animation, false, `示例「${e.id}」关动效没落进 cfg`);
  }
});

test('AXISTITLE-01：主轴与 X 标题恒有文案（兜底或示例自带）', () => {
  for (const e of EXAMPLES) {
    const { axisTitle } = buildConfig(e, { axisTitle: true });
    assert.ok(axisTitle.y && axisTitle.x, `示例「${e.id}」开轴标题后 y / x 文案不全`);
  }
});
