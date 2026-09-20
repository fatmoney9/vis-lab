import test from 'node:test';
import assert from 'node:assert/strict';
import { barPath, barRadius } from '../charts/core/bar-geometry.js';

/*
 * 纵向两档用 **golden value 锁死**：它们是从 core/mark.js 原样迁入的，
 * 逐字符相同 = 「柱系几何下沉没有动 cartesian 任何一个像素」的可执行证据。
 * 这几个串在迁移**之前**从旧实现取得，不是从新实现反推的。
 *
 * 横向两档是新写的，**不锁字符串**——那等于把实现抄一遍当测试。
 * 改断言成品形状：包围盒、哪端是尖角哪端被圆掉、圆角怎么被夹。
 */

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* 只解析本模块用到的子集：M/H/V（绝对）· h/v/a（相对）· Z。
   圆弧只取端点——判包围盒与拐点够用，不需要真的画出弧。 */
function vertices(d) {
  const pts = [];
  let x = 0;
  let y = 0;
  const re = /([MHVhvaZ])([^MHVhvaZ]*)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    const nums = (m[2].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    switch (m[1]) {
      case 'M': [x, y] = nums; break;
      case 'H': [x] = nums; break;
      case 'V': [y] = nums; break;
      case 'h': x += nums[0]; break;
      case 'v': y += nums[0]; break;
      case 'a': x += nums[5]; y += nums[6]; break;   /* rx ry rot large sweep dx dy */
      default: continue;                              /* Z */
    }
    pts.push({ x, y });
  }
  return pts;
}

const bbox = (d) => {
  const p = vertices(d);
  return {
    x0: Math.min(...p.map((q) => q.x)),
    x1: Math.max(...p.map((q) => q.x)),
    y0: Math.min(...p.map((q) => q.y)),
    y1: Math.max(...p.map((q) => q.y)),
  };
};
const hasPoint = (d, x, y) => vertices(d).some((q) => near(q.x, x) && near(q.y, y));

test('BAR-01：纵向路径与迁移前逐字符相同（golden value，cartesian 零回归的证据）', () => {
  const golden = [
    ['正值圆顶', [10, 20, 16, 40, 2, 'top'], 'M10,60V22a2,2 0 0 1 2,-2h12a2,2 0 0 1 2,2V60Z'],
    ['负值圆底', [10, 20, 16, 40, 2, 'bottom'], 'M10,20V58a2,2 0 0 0 2,2h12a2,2 0 0 0 2,-2V20Z'],
    ['r=0 直角', [10, 20, 16, 40, 0, 'top'], 'M10,20h16v40h-16Z'],
    ['r 被柱宽夹到 w/2', [0, 0, 6, 40, 99, 'top'], 'M0,40V3a3,3 0 0 1 3,-3h0a3,3 0 0 1 3,3V40Z'],
    ['r 被柱高夹到 h', [0, 0, 40, 1.5, 99, 'top'], 'M0,1.5V1.5a1.5,1.5 0 0 1 1.5,-1.5h37a1.5,1.5 0 0 1 1.5,1.5V1.5Z'],
    ['r 负值归零', [10, 20, 16, 40, -5, 'top'], 'M10,20h16v40h-16Z'],
    ['小数坐标不取整', [10.5, 20.25, 16.5, 40.75, 2.5, 'top'], 'M10.5,61V22.75a2.5,2.5 0 0 1 2.5,-2.5h11.5a2.5,2.5 0 0 1 2.5,2.5V61Z'],
    ['h=0 退化为零高', [0, 0, 16, 0, 2, 'top'], 'M0,0h16v0h-16Z'],
  ];
  for (const [name, args, want] of golden) {
    assert.equal(barPath(...args), want, name);
  }
});

test('HBAR-02：横向条的包围盒恰是 (x,yTop,w,h)，路径闭合', () => {
  for (const side of ['right', 'left']) {
    for (const r of [0, 2, 99]) {
      const d = barPath(10, 20, 40, 16, r, side);
      assert.ok(d.startsWith('M') && d.endsWith('Z'), `${side} r=${r} 必须闭合`);
      const b = bbox(d);
      assert.ok(near(b.x0, 10) && near(b.x1, 50), `${side} r=${r} 横向范围应为 10..50，实际 ${b.x0}..${b.x1}`);
      assert.ok(near(b.y0, 20) && near(b.y1, 36), `${side} r=${r} 纵向范围应为 20..36，实际 ${b.y0}..${b.y1}`);
    }
  }
});

test('HBAR-02：圆角只在远离基线的那一端——另一端必须是尖角', () => {
  /* 正值横条：基线在左，圆角在右 ⇒ 左两角是原始尖角、右两角被圆掉 */
  const right = barPath(10, 20, 40, 16, 2, 'right');
  assert.ok(hasPoint(right, 10, 20) && hasPoint(right, 10, 36), '正值横条：左端两角必须是尖角');
  assert.ok(!hasPoint(right, 50, 20) && !hasPoint(right, 50, 36), '正值横条：右端两角必须被圆掉');

  /* 负值横条：基线在右，圆角在左 */
  const left = barPath(10, 20, 40, 16, 2, 'left');
  assert.ok(hasPoint(left, 50, 20) && hasPoint(left, 50, 36), '负值横条：右端两角必须是尖角');
  assert.ok(!hasPoint(left, 10, 20) && !hasPoint(left, 10, 36), '负值横条：左端两角必须被圆掉');

  /* 对照：纵向的尖角在基线那一端，方向正交 */
  const top = barPath(10, 20, 16, 40, 2, 'top');
  assert.ok(hasPoint(top, 10, 60) && hasPoint(top, 26, 60), '正值竖柱：底部两角必须是尖角');
  assert.ok(!hasPoint(top, 10, 20), '正值竖柱：顶部两角必须被圆掉');
});

test('HBAR-02：圆角夹取按方向换轴——横向夹条厚的一半与条长', () => {
  /* 条厚 6 ⇒ 半厚 3，r=99 应被夹到 3：右端圆弧的纵向跨度恰为 2×3 */
  const thin = barPath(0, 0, 40, 6, 99, 'right');
  assert.ok(hasPoint(thin, 37, 0), '条厚夹取：直边应止于 x = w − r = 37');
  /* 条长 1.5 ⇒ r 被长度夹到 1.5（而不是半厚 3） */
  const short = barPath(0, 0, 1.5, 40, 99, 'right');
  assert.ok(hasPoint(short, 0, 0), '条长夹取：r 取 min(半厚, 条长) 后直边长度为 0');
  const b = bbox(short);
  assert.ok(near(b.x1 - b.x0, 1.5), `条长夹取后包围盒仍是 1.5 宽，实际 ${b.x1 - b.x0}`);

  /* r=0 时横向与纵向走同一条直角退化路径（两个方向共用一行代码，别让它们分叉） */
  assert.equal(barPath(10, 20, 40, 16, 0, 'right'), barPath(10, 20, 40, 16, 0, 'top'));
});

test('HBAR-02：side 缺省为 top —— 迁移前 core/mark.js 的调用方全部显式传参，缺省只保护新调用方', () => {
  assert.equal(barPath(10, 20, 16, 40, 2), barPath(10, 20, 16, 40, 2, 'top'));
});

test('BAR-01：圆角按条厚分档，rMax<=0 的主题恒直角', () => {
  /* THS：rMax=2、rReduced=1、满档阈值 8、降档阈值 4 */
  assert.equal(barRadius(16, 2, 1, 8, 4), 2, '够宽 → 满档');
  assert.equal(barRadius(6, 2, 1, 8, 4), 1, '介于两阈值之间 → 降档');
  assert.equal(barRadius(3, 2, 1, 8, 4), 0, '低于降档阈值 → 直角');
  assert.equal(barRadius(8, 2, 1, 8, 4), 2, '恰在满档阈值上 → 满档（闭区间）');
  assert.equal(barRadius(4, 2, 1, 8, 4), 1, '恰在降档阈值上 → 降档（闭区间）');
  /* 降档值大于满档值时取小者，避免主题配错反而更圆 */
  assert.equal(barRadius(6, 2, 5, 8, 4), 2);
  /* iFinD / Ainvest：rMax=0 → 任何厚度都直角 */
  for (const t of [1, 16, 999]) assert.equal(barRadius(t, 0, 0, 8, 4), 0);
});
