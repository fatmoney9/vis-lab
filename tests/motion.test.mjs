import test from 'node:test';
import assert from 'node:assert/strict';

import { EASE_GROW, easeOutCubic, reducedMotion, runGrowth, runTween } from '../charts/core/motion.js';

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

/* ── [MOTION-08] runTween：可冻结的补间驱动 ────────────────────── */

test('MOTION-08：收尾不变量——最后一次回调恒为 (1,1) 且恰一次，promise resolve(true)', async () => {
  const clock = fakeClock();
  const seen = [];
  const { promise } = runTween(480, (eased, linear) => seen.push([eased, linear]), clock);

  clock.tick(120);
  clock.tick(120);
  assert.ok(seen.every(([, linear]) => linear < 1), '中途不得提前落终态');
  clock.tick(240);
  assert.deepEqual(seen.at(-1), [1, 1]);
  assert.equal(seen.filter(([, linear]) => linear === 1).length, 1);
  assert.equal(await promise, true);
  assert.equal(clock.pending, 0, '收尾后不得再排帧');
});

/*
 * 这一条是 runGrowth 与 runTween **契约差异的可执行定义**，比注释更难腐烂：
 * 同一时刻打断，入场驱动必须停在终态，播放驱动必须停在半路。
 * 谁哪天把两者合并成一个布尔开关，这里会先炸。
 */
test('MOTION-08 vs MOTION-04：同一时刻打断——runGrowth 落终态，runTween 就地冻结', async () => {
  const growClock = fakeClock();
  const grown = [];
  const cancelGrowth = runGrowth(480, (t) => grown.push(t), growClock);
  growClock.tick(120);
  cancelGrowth();
  assert.equal(grown.at(-1), 1, 'runGrowth 被打断后补一帧终态');

  const tweenClock = fakeClock();
  const tweened = [];
  const tween = runTween(480, (eased) => tweened.push(eased), tweenClock);
  tweenClock.tick(120);
  const midway = tweened.at(-1);
  tween.pause();
  assert.ok(midway > 0 && midway < 1, `冻结点应在半路，实际 ${midway}`);
  assert.equal(tweened.at(-1), midway, 'runTween 暂停后不得补终帧');
  assert.equal(await tween.promise, false, '被冻结 resolve(false)，不是 reject——暂停不是失败');
});

test('MOTION-08：暂停后不再有任何回调，且重复暂停幂等', async () => {
  const clock = fakeClock();
  const seen = [];
  const tween = runTween(480, (eased) => seen.push(eased), clock);
  clock.tick(120);
  const count = seen.length;
  tween.pause();
  tween.pause();
  clock.tick(480);
  assert.equal(seen.length, count, '暂停后推进时钟不得再产生回调');
  assert.equal(await tween.promise, false);
});

test('MOTION-08：delay 期间不调 onFrame，进度从 delay 结束才起算', async () => {
  const clock = fakeClock();
  const seen = [];
  const { promise } = runTween(480, (eased, linear) => seen.push(linear), { ...clock, delay: 120 });

  clock.tick(60);
  assert.deepEqual(seen, [], 'delay 未满时一帧都不画');
  clock.tick(60);                        /* 累计 120 = delay 刚满，进度仍为 0 */
  clock.tick(240);                       /* delay 后走了 240 / 480 */
  assert.ok(seen.length > 0, 'delay 结束后才开始推进');
  assert.ok(seen.at(-1) > 0.4 && seen.at(-1) < 0.6, `进度应从 delay 结束起算，实际 ${seen.at(-1)}`);
  clock.tick(240);
  assert.equal(await promise, true);
});

test('MOTION-08：delay 期间暂停同样 resolve(false) 且不补终帧', async () => {
  const clock = fakeClock();
  const seen = [];
  const tween = runTween(480, (eased) => seen.push(eased), { ...clock, delay: 200 });
  clock.tick(100);
  tween.pause();
  clock.tick(600);
  assert.deepEqual(seen, [], '连一帧都没画过，更不该补终帧');
  assert.equal(await tween.promise, false);
});

test('MOTION-08：时长 0 或环境无 rAF → 同步落终态、resolve(true)', async () => {
  const seen = [];
  const a = runTween(0, (eased, linear) => seen.push([eased, linear]), { raf: () => 0, cancel: () => {}, now: () => 0 });
  assert.deepEqual(seen, [[1, 1]]);
  assert.equal(await a.promise, true);

  const seen2 = [];
  const b = runTween(480, (eased, linear) => seen2.push([eased, linear]), { raf: undefined, now: () => 0 });
  assert.deepEqual(seen2, [[1, 1]], 'node 里没有 rAF，直接成图');
  assert.equal(await b.promise, true);
});
