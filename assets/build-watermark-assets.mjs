/*
 * L0 · 水印资源构建：assets/watermarks/*.svg → charts/core/watermark-assets.js
 * 用法：
 *   node assets/build-watermark-assets.mjs        一次性生成（校验失败退出码 1）
 *
 * 为什么要生成而不是运行时加载：本仓库无打包器、原生 ESM，import 不能读 .svg 文本；
 * CartesianChart 是可嵌入引擎，不该耦合相对资源路径。故把真实 SVG 内联成
 * data:image/svg+xml,<encodeURIComponent> 供组件同步取用（file:// / 跨域 / CSP 均安全，
 * 见 specs/watermark.md WATERMARK-01）。.svg 文件是唯一可编辑源，本脚本按需重生成派生物。
 *
 * 契约（仿 tokens/build.mjs）：每个资源 light/dark 两份俱全、根 <svg> 必须带 width/height；
 * 缺文件 / 缺尺寸即构建失败、退出码 1，供 CI 与 git 钩子拦截漂移。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, '..', 'charts', 'core', 'watermark-assets.js');
const MODES = ['light', 'dark'];

/* 资源清单：id → 文件名前缀。iFinD-PC 复用 ths（见 behavior.json watermark.asset），故此处只列真实资源 */
const ASSETS = [
  { id: 'ths', base: 'ths-watermark' },
  { id: 'ainvest', base: 'ainvest-watermark' },
];

const fail = (msg) => { throw new Error(msg); };

/* 从根 <svg> 读固有像素尺寸；两值缺一即失败（尺寸与资源绑定、不在别处写死） */
function sizeOf(svg, file) {
  const w = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)"/);
  const h = svg.match(/<svg\b[^>]*\bheight="([\d.]+)"/);
  if (!w || !h) fail(`${file}：根 <svg> 缺 width/height`);
  return { w: Number(w[1]), h: Number(h[1]) };
}

/* SVG 文本 → data URI（encodeURIComponent，与 watermark.md 推荐一致） */
const dataUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;

function build() {
  const entries = ASSETS.map(({ id, base }) => {
    const rec = { w: 0, h: 0 };
    for (const mode of MODES) {
      const file = `watermarks/${base}-${mode}.svg`;
      let svg;
      try {
        svg = readFileSync(join(DIR, file), 'utf8');
      } catch {
        fail(`缺资源 assets/${file}`);
      }
      const { w, h } = sizeOf(svg, file);
      if (rec.w && (rec.w !== w || rec.h !== h)) fail(`${base}：light/dark 尺寸不一致`);
      rec.w = w; rec.h = h;
      rec[mode] = dataUri(svg);
    }
    return [id, rec];
  });

  const body = entries
    .map(([id, r]) =>
      `  ${id}: {\n` +
      `    w: ${r.w}, h: ${r.h},\n` +
      `    light: '${r.light}',\n` +
      `    dark: '${r.dark}',\n` +
      `  },`)
    .join('\n');

  const out =
    `/* ⚠️ 生成文件，请勿手改——改 assets/watermarks/*.svg 后运行\n` +
    `   node assets/build-watermark-assets.mjs 重新生成。源：assets/watermarks/*.svg\n` +
    `   每项 { w, h, light, dark }：固有尺寸(px) + 明暗两份 data URI（见 specs/watermark.md WATERMARK-01/04）。 */\n` +
    `export const WATERMARKS = {\n${body}\n};\n`;

  writeFileSync(OUT, out);
  return entries.length;
}

const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });
try {
  const n = build();
  console.log(`✓ [${ts()}] watermark-assets.js 生成成功：${n} 资源 × ${MODES.length} 明暗`);
} catch (e) {
  console.error(`✗ [${ts()}] ${e.message}`);
  process.exit(1);
}
