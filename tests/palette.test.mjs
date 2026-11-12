import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* palette.js / theme.js 在模块顶层 fetch 自己的 JSON（浏览器语义）。Node 的 fetch 不认 file:，
   这里只把 file: 读本地文件补上，再动态 import——测的是真实模块与真实 palette.json。
   （被 stub 读的只有 tokens/*.json；源码是 import 进来执行的，不是当文本读。） */
const PALETTE_MODULE = new URL('../charts/core/palette.js', import.meta.url);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = new URL(url);
  if (u.protocol !== 'file:') return realFetch(url, init);
  const text = readFileSync(fileURLToPath(u), 'utf8');
  return { ok: true, json: async () => JSON.parse(text) };
};
const { normalizePalette, pickSeriesColors } = await import(PALETTE_MODULE);

const doc = JSON.parse(readFileSync(new URL('../tokens/palette.json', import.meta.url), 'utf8'));
const PALETTE = normalizePalette(doc);
const of = (type, n) => Array.from({ length: n }, () => ({ type }));
const distinct = (list) => new Set(list).size;

test('COLOR-01：未分叉的主题明暗同色（THS / iFinD 行为不变）', () => {
  for (const theme of ['ths', 'ifind-pc']) {
    for (const series of [of('bar', 9), of('pie', 12), [...of('bar', 3), ...of('line', 2)]]) {
      assert.deepEqual(pickSeriesColors(PALETTE[theme], series, 'dark'), pickSeriesColors(PALETTE[theme], series, 'light'));
    }
  }
});

test('COLOR-01：Ainvest 明暗各一份，同一槽位在两种模式下取不同色', () => {
  const light = pickSeriesColors(PALETTE.ainvest, of('bar', 22), 'light');
  const dark = pickSeriesColors(PALETTE.ainvest, of('bar', 22), 'dark');
  assert.equal(light.length, 22);
  light.forEach((hex, i) => assert.notEqual(hex, dark[i], `槽位 ${i + 1}`));
});

test('COLOR-03：单系列取主色，且与多系列的第 1 色一致', () => {
  for (const mode of ['light', 'dark']) {
    const [single] = pickSeriesColors(PALETTE.ainvest, of('bar', 1), mode);
    assert.equal(single, pickSeriesColors(PALETTE.ainvest, of('bar', 3), mode)[0]);
  }
});

test('COLOR-02：Ainvest 基础盘 22 色互不相同，第 23 个起一律是「其他」灰', () => {
  for (const mode of ['light', 'dark']) {
    const colors = pickSeriesColors(PALETTE.ainvest, of('bar', 30), mode);
    assert.equal(distinct(colors.slice(0, 22)), 22);
    const tail = colors.slice(22);
    assert.equal(distinct(tail), 1);
    assert.ok(!colors.slice(0, 22).includes(tail[0]), '「其他」不得与前 22 色撞色');
  }
});

test('COLOR-05：Ainvest 折柱组合——柱不含折线的黄，柱线两组无交集', () => {
  for (const mode of ['light', 'dark']) {
    const colors = pickSeriesColors(PALETTE.ainvest, [...of('bar', 7), ...of('line', 2)], mode);
    const bars = colors.slice(0, 7);
    const lines = colors.slice(7);
    assert.equal(distinct(bars), 7);
    assert.equal(distinct(lines), 2);
    assert.ok(lines.every((hex) => !bars.includes(hex)), '柱线色板禁交叉');
    /* 黄是基础盘第 4 色：纯柱会用到它，组合里的柱不得用 */
    const yellow = pickSeriesColors(PALETTE.ainvest, of('bar', 8), mode)[3];
    assert.ok(!bars.includes(yellow));
    assert.equal(lines[0], yellow);
  }
});

test('COLOR-08：Ainvest 饼环 22 色后回到第 2 色循环，主色蓝只出现一次、不用「其他」', () => {
  for (const mode of ['light', 'dark']) {
    const colors = pickSeriesColors(PALETTE.ainvest, of('pie', 50), mode);
    assert.equal(distinct(colors.slice(0, 22)), 22);
    assert.equal(colors[22], colors[1]);
    assert.equal(colors[43], colors[1], '第二轮循环长度是 21（2 → 22）');
    assert.equal(colors.filter((hex) => hex === colors[0]).length, 1);
    assert.equal(distinct(colors), 22, '不得出现色盘外的「其他」灰');
  }
});

test('排名盘：Ainvest 24 色互不相同，第 25 个起回到第 1 个；未声明的主题回落基础盘', () => {
  for (const mode of ['light', 'dark']) {
    const colors = pickSeriesColors(PALETTE.ainvest, of('rank', 30), mode);
    assert.equal(distinct(colors.slice(0, 24)), 24);
    assert.deepEqual(colors.slice(24), colors.slice(0, 6));
  }
  assert.deepEqual(pickSeriesColors(PALETTE.ths, of('rank', 10)), pickSeriesColors(PALETTE.ths, of('bar', 10)));
});

test('合同：明暗不等长、overflow 缺 other、restart 越界都在加载时抛错', () => {
  const base = { 'single-default': '#000000', 'line-multi': ['#000000'] };
  const bad = (ramp) => () => normalizePalette({ t: { ...base, 'bar-multi': ramp } });
  assert.throws(bad({ light: ['#000000', '#111111'], dark: ['#000000'] }), /长度不等/);
  assert.throws(bad({ colors: ['#000000'], overflow: 'other' }), /没声明 other/);
  assert.throws(bad({ colors: ['#000000', '#111111'], overflow: { restart: 2 } }), /restart/);
  assert.throws(() => normalizePalette({ t: { ...base, 'bar-multi': ['#000000'], 'dynamic-bar': ['#000000'] } }), /未知键/);
});
