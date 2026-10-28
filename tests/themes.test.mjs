/*
 * L3 主题清单的内容语言登记（demos/themes.js）：L3 判断「要不要英文」的唯一出处。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, contentLocale, isEnglishContent } from '../demos/themes.js';
import { THEMES as REEXPORTED } from '../demos/examples.js';
import { playbackCopy } from '../demos/playback/view.js';

test('每个主题都登记了内容语言，且当前只有 Ainvest 是英文', () => {
  for (const t of THEMES) assert.ok(['zh', 'en'].includes(t.locale), t.id);
  assert.deepEqual(THEMES.filter((t) => t.locale === 'en').map((t) => t.id), ['ainvest']);
});

test('未登记的 id 回落中文（桑基独立面自带的 ifind 等）', () => {
  assert.equal(contentLocale('ifind'), 'zh');
  assert.equal(contentLocale(undefined), 'zh');
  assert.equal(isEnglishContent('ainvest'), true);
});

test('examples.js 的 THEMES 是同一份清单，不是第二份副本', () => {
  assert.equal(REEXPORTED, THEMES);
});

test('播放件文案按 locale 走，不按主题 id', () => {
  assert.equal(playbackCopy({ theme: 'ainvest' }).previous, 'Previous');
  assert.notEqual(playbackCopy({ theme: 'ths' }).previous, 'Previous');
});
