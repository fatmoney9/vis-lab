import test from 'node:test';
import assert from 'node:assert/strict';

import { EASE_GROW, easeOutCubic, reducedMotion, runGrowth } from '../charts/core/motion.js';

/* 假时钟 + 假 rAF：手动推进时间并逐帧驱动，使动画循环的收尾不变量可确定性验证 */
function fakeClock() {
  let t = 0;
  const queue = [];
  return {
    now: () => t,
    raf: (cb) => { queue.push(cb); return queue.length; },
    cancel: () => {},
    /* 推进 ms 并跑完当前排队的一帧 */
    tick(ms) { t += ms; const pending = queue.splice(0); pending.forEach((cb) => cb()); },
    get pending() { return queue.length; },
  };
}

test('MOTION-03：缓动是 easeOutCubic，端点精确、单调不减、先快后慢', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(0.5), 0.875); /* 1 - 0.5³ —— 一半时间已走完 87.5% 路程 */
  for (let i = 1; i <= 20; i++) assert.ok(easeOutCubic(i / 20) >= easeOutCubic((i - 1) / 20));
  assert.equal(easeOutCubic(-1), 0); /* 越界钳制 */
  assert.equal(easeOutCubic(2), 1);
});

test('MOTION-03：缓动曲线系数即 cubic-bezier(0.33, 1, 0.68, 1)（跨端实现的对齐口径）', () => {
  assert.deepEqual([...EASE_GROW], [0.33, 1, 0.68, 1]);
});

test('MOTION-01：逐帧推进最终恰好落在 t=1，且终帧只来一次', () => {
  const clock = fakeClock();
  const seen = [];
  let done = 0;
  runGrowth(480, (t) => seen.push(t), { ...clock, onDone: () => { done++; } });

  clock.tick(120);
  clock.tick(120);
  assert.ok(seen.every((t) => t < 1), '中途不得提前落终态');
  clock.tick(240);                       /* 累计 480 = 时长满 */
  assert.equal(seen.at(-1), 1);
  assert.equal(seen.filter((t) => t === 1).length, 1);
  assert.equal(done, 1);
  assert.equal(clock.pending, 0, '收尾后不得再排帧');
});

test('MOTION-04：被打断即刻落终态，此后不再有任何回调', () => {
  const clock = fakeClock();
  const seen = [];
  let done = 0;
  const cancel = runGrowth(480, (t) => seen.push(t), { ...clock, onDone: () => { done++; } });

  clock.tick(160);
  const mid = seen.length;
  cancel();
  assert.equal(seen.at(-1), 1, '打断也要停在终态，不半途回退');
  assert.equal(done, 1);

  cancel();                              /* 重复取消幂等 */
  clock.tick(1000);                      /* 已排队的帧不得再喂进 onFrame */
  assert.equal(seen.length, mid + 1);
  assert.equal(done, 1);
});

test('MOTION-07：时长 0 或环境无 rAF（如 node）→ 同步落终态，不排帧', () => {
  const seen = [];
  const noop = runGrowth(0, (t) => seen.push(t), { raf: () => 0, cancel: () => {}, now: () => 0 });
  assert.deepEqual(seen, [1]);
  assert.equal(typeof noop, 'function');

  const seen2 = [];
  runGrowth(480, (t) => seen2.push(t), { raf: undefined, now: () => 0 });
  assert.deepEqual(seen2, [1]);
});

test('MOTION-07：无 matchMedia 的环境不误判为“减弱动态效果”', () => {
  assert.equal(reducedMotion({}), false);
  assert.equal(reducedMotion({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(reducedMotion({ matchMedia: () => ({ matches: false }) }), false);
});
