/*
 * L3 · 预览面的主题清单，以及每个主题的**图表内容语言**。
 *
 * 语言是主题的一个属性，不是主题身份本身：L3 各处问的都是「这个主题的图表内容用英文吗」，
 * 曾经各写一遍 `theme === 'ainvest'`——那等于把「品牌」当「语言」用，一旦出现同语言的
 * 第二个主题 id（或预览面另起的 id），这些判断会静默落回中文、而英文守卫只认 'ainvest' 照样全绿。
 * 现在只在这里登记一次，各处走 contentLocale()。
 *
 * 独立成文件而不是留在 examples.js：chart-presentation / sankey-presentation / waterfall-presentation /
 * playback/view 都要读它，而 examples.js 反过来 import 它们——放在 examples.js 会成环。
 * examples.js 仍 re-export THEMES，既有 import 不用改。
 */
export const THEMES = [
  { id: 'ths', label: 'THS', dot: '#3366FF', locale: 'zh' },
  { id: 'ifind-pc', label: 'iFinD PC', dot: '#4D5999', locale: 'zh' },
  { id: 'ainvest', label: 'Ainvest', dot: '#265FFC', locale: 'en' },
];

/* 未登记的 id（如桑基独立面自己的 'ifind'）回落中文——与改造前「只有 ainvest 是英文」逐项同值 */
export const contentLocale = (theme) => THEMES.find((t) => t.id === theme)?.locale ?? 'zh';

export const isEnglishContent = (theme) => contentLocale(theme) === 'en';
