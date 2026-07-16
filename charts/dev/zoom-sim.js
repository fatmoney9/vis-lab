import { select, drag } from 'd3';

/*
 * 开发夹具：axes navigator（缩放轴）模拟器。
 * 仅用于验收 [SCALE-02]（可见窗口变化 → Y 轴按可见数据重算）；
 * 不是 datazoom 组件的规范实现（轨道/把手规格另有规范，见 specs/axes.md 待办）。
 */
export function zoomSim(host, { width, initial = [0.6, 1], minSpan = 0.05, onChange } = {}) {
  const H = 20;
  const R = 7;
  const PAD = R + 1;
  let [s0, s1] = initial;
  const W = Math.max(120, width ?? host.clientWidth ?? 320);
  const track = { x: PAD, w: W - PAD * 2 };

  const svg = select(host).append('svg').attr('width', W).attr('height', H);
  svg
    .append('rect')
    .attr('x', track.x).attr('y', H / 2 - 2)
    .attr('width', track.w).attr('height', 4).attr('rx', 2)
    .attr('fill', 'var(--color-background-weak)');
  const selRect = svg
    .append('rect')
    .attr('y', H / 2 - 2).attr('height', 4).attr('rx', 2)
    .attr('fill', 'var(--color-visualization-datazoom-filler)');

  const mkHandle = () => {
    const g = svg.append('g').attr('cursor', 'ew-resize');
    g.append('circle')
      .attr('cy', H / 2).attr('r', R)
      .attr('fill', 'var(--color-text-inverse)')
      .attr('stroke', 'var(--color-grey-03)').attr('stroke-width', 1);
    return g;
  };
  const hL = mkHandle();
  const hR = mkHandle();

  const px = (s) => track.x + s * track.w;
  const toS = (x) => Math.max(0, Math.min(1, (x - track.x) / track.w));

  function update(fire) {
    selRect.attr('x', px(s0)).attr('width', Math.max(0, px(s1) - px(s0)));
    hL.select('circle').attr('cx', px(s0));
    hR.select('circle').attr('cx', px(s1));
    if (fire && onChange) onChange([s0, s1]);
  }

  hL.call(drag().on('drag', (e) => { s0 = Math.min(toS(e.x), s1 - minSpan); update(true); }));
  hR.call(drag().on('drag', (e) => { s1 = Math.max(toS(e.x), s0 + minSpan); update(true); }));
  update(false);

  return { get: () => [s0, s1] };
}
