/*
 * hooks/lint-test-hygiene.mjs —— 测试卫生守卫。被 hooks/check.sh 调用，也可单独跑：
 *   node hooks/lint-test-hygiene.mjs
 *
 * 规则：tests/ 里不许把**源码 .js / 样式 .css** 当文本读进来做断言。
 * 依据 TESTING.md 第三节：「不断言内部实现步骤；断言规范可观察结果。」
 *
 * 为什么这条值得上守卫：断言源码文本锁死的是「代码长什么样」而不是「代码做什么」。
 * 一次纯格式调整（把链式调用并成一行、改缩进）行为完全不变、语法也合法，测试却会红；
 * 反过来真正的行为回归它未必抓得到。CSS 规则是否生效属于视觉回归的职责，
 * 用正则在样式表里找字符串只是看起来在测。
 *
 * 读 .json 是允许的——token 合同那类是**数据**不是实现；源码配置应直接导入其公开导出并断言行为。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (path.endsWith('.mjs')) acc.push(path);
  }
  return acc;
};

/* readFileSync(...) 之后的一小段里出现 .js / .css 字面量即判定——
   路径常写成多行的 new URL(...)，故按窗口扫而非按行。
   窗口必须在**下一个 readFileSync 之前**截断：否则读 .json 的那一处会把后面读 .css
   的参数吸进自己的窗口里，把合法的 token 校验误报成违规。 */
const WINDOW = 240;
const SOURCE_LITERAL = /['"`][^'"`]*\.(?:js|css)['"`]/;
const CALL = 'readFileSync(';

const offenders = new Map(); /* file → [行号] */
for (const file of walk('tests')) {
  const text = readFileSync(file, 'utf8');
  const lines = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(CALL, from);
    if (at === -1) break;
    from = at + 1;
    const next = text.indexOf(CALL, at + CALL.length);
    const end = next === -1 ? at + WINDOW : Math.min(at + WINDOW, next);
    if (!SOURCE_LITERAL.test(text.slice(at, end))) continue;
    lines.push(text.slice(0, at).split('\n').length);
  }
  if (lines.length) offenders.set(file, lines);
}

let failed = false;
for (const [file, lines] of offenders) {
  console.error(
    `✗ [测试卫生] ${file} 把源码 / 样式当文本读来断言（第 ${lines.join('、')} 行）——`
    + '请改为断言可观察行为，见 TESTING.md 第三节',
  );
  failed = true;
}

if (failed) process.exit(1);
console.log('✓ 测试卫生守卫通过（未把源码 / 样式当文本断言）');
