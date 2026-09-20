/*
 * 播放件的纯逻辑单测：模板、文案、主题映射与异步兜底。
 *
 * 2026-09-20 从 tests/sankey.test.mjs 迁出——这四条没有一行碰桑基，
 * 它们测的是 demos/playback/ 这个中性公用件（规则见 specs/playback.md）。
 * 留在桑基那份里，会让「改播放件」看起来像「改桑基」。
 *
 * 渲染与交互那一半在 tests/browser/playback.browser.mjs 与
 * tests/browser/playground-playback.browser.mjs——本文件不断言像素、不派发事件。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  playbackCopy,
  playbackMarkup,
  playbackRangeTheme,
  playbackTicksMarkup,
  runPlaybackUpdate,
} from '../demos/playback/view.js';

const THEME_TOKENS = Object.fromEntries(
  ['ths', 'ifind-pc', 'ainvest'].map((theme) => [
    theme,
    JSON.parse(readFileSync(new URL(`../tokens/${theme}.json`, import.meta.url), 'utf8')),
  ]),
);
const THEME_BEHAVIOR = JSON.parse(
  readFileSync(new URL('../tokens/behavior.json', import.meta.url), 'utf8'),
);

test('PLAYBACK-12：Ainvest 播放区的主题合同与方向资源完整', () => {
  assert.equal(THEME_BEHAVIOR.ainvest['datazoom-handle'].w, 32);
  assert.equal(THEME_BEHAVIOR.ainvest['datazoom-handle'].grip.h, 10);
  assert.equal(THEME_TOKENS.ths['radius-playback-step'], '{radius-4}');
  assert.equal(THEME_TOKENS['ifind-pc']['radius-playback-step'], '{radius-4}');
  assert.equal(THEME_TOKENS.ainvest['radius-playback-step'], '18px');
  assert.equal(
    existsSync(new URL('../assets/playback/ainvest-period-arrow-prev.svg', import.meta.url)),
    true,
  );
  assert.equal(
    existsSync(new URL('../assets/playback/ainvest-period-arrow-next.svg', import.meta.url)),
    true,
  );
});

test('PLAYBACK-01/08：三个 L3 入口复用同一份播放区 DOM 与动态刻度模板', () => {
  const periods = [
    { period: '2025 一季报', timelinePeriod: '2025 一季报', shortPeriod: '一季' },
    { period: '2025 半年报', timelinePeriod: '2025 半年报', shortPeriod: '半年' },
  ];
  const copy = playbackCopy({ theme: 'ths' });
  const ticks = playbackTicksMarkup(periods, 1);
  const markup = playbackMarkup({
    periods,
    currentIndex: 1,
    copy,
    playIconSrc: '../assets/playback/play.svg',
    idPrefix: 'test-playback',
  });

  assert.match(ticks, /style="left:100%"/);
  assert.match(ticks, /class="chart-playback__tick is-current"/);
  assert.match(markup, /id="test-playback-range"/);
  assert.match(markup, /--chart-playback-interval-count:1/);
  assert.match(markup, /2025 半年报/);
});

test('PLAYBACK-02：播放更新拒绝时统一回落并执行状态恢复', async () => {
  const failure = new Error('invalid period');
  let reported = null;
  let recovered = null;
  const completed = await runPlaybackUpdate(
    async () => { throw failure; },
    {
      onError: (error) => { reported = error; },
      onFailure: (error) => { recovered = error; },
    },
  );

  assert.equal(completed, false);
  assert.strictEqual(reported, failure);
  assert.strictEqual(recovered, failure);
});

test('PLAYBACK-13：iFinD 全端播放滑块复用 THS token 作用域', () => {
  assert.equal(playbackRangeTheme('ifind'), 'ths');
  assert.equal(playbackRangeTheme('ifind-pc'), 'ths');
  assert.equal(playbackRangeTheme('ths'), 'ths');
  assert.equal(playbackRangeTheme('ainvest'), 'ainvest');
});
