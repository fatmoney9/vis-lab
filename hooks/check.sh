#!/bin/sh
# 质量门禁的**唯一清单**——README / CONTRIBUTING / TESTING / AGENTS / PR 模板 /
# hooks/pre-commit / CI 全部调用本脚本，不再各自抄一份。
#
# 起因：此前这七处各写各的，条数从 3 到 6 不等，除 CI 外全都漏了水印资源重建，
# 于是「文档说的」「提交时跑的」「线上判定的」三者互不相同。清单集中到这里之后，
# 加检查项只需改本文件一处。
#
# 用法：
#   sh hooks/check.sh            重建生成物 + 跑全部检查（本地）
#   sh hooks/check.sh --verify   额外核对生成物与提交内容一致，有差异即失败（CI）
#
# 两种模式的差别只在生成物：本地是「重建后由调用方 git add」（自动修好），
# CI 是「重建后要求零差异」（只验不改——CI 一旦能改仓库，这项检查就等于自己给自己盖章）。
set -e

cd "$(dirname "$0")/.."   # 允许从任意子目录调用

VERIFY=0
if [ "$1" = "--verify" ]; then VERIFY=1; fi

if ! command -v node >/dev/null 2>&1; then
  echo "✗ 未找到 node，无法重建 tokens.css / 水印资源模块（跳过校验会导致生成物漂移）。" >&2
  exit 1
fi

# 1/8 token 合同、分叉与悬空-循环别名校验，并重建 tokens.css（坏 JSON → 退出码 1）
node tokens/build.mjs
if [ "$VERIFY" = 1 ]; then git diff --exit-code -- tokens/tokens.css; fi

# 2/8 由 assets/watermarks/*.svg 重建水印 data URI 模块（缺资源 / 缺尺寸 → 退出码 1）
node assets/build-watermark-assets.mjs
if [ "$VERIFY" = 1 ]; then git diff --exit-code -- charts/core/watermark-assets.js; fi

# 3/8 语法检查——单测 import 不到的文件（渲染构件、预览外壳）只能靠它兜住
find charts hooks tokens tests assets -type f \( -name '*.js' -o -name '*.mjs' \) -print0 \
  | xargs -0 -n1 node --check

# 4/8 纯逻辑单测（零第三方依赖；.mjs 显式 ESM，兼容 node 20/24）
# 引号不能去：让 node 自己展开 **，shell 展开只匹配一层。写成 tests/*.mjs 时
# tests/ 子目录里的测试会被**静默跳过**——不报错、不警告，只是那些用例从此不再跑。
node --test "tests/**/*.test.mjs"

# 5/8 分层守卫（L1 不依赖 L2；L2 调 L1 或标 [L2-LOCAL]；L2 不重写 L1 已有能力）
sh hooks/lint-layers.sh

# 6/8 Spec ID 回引守卫（代码引用的 [ID] 必须在 specs 有定义）
node hooks/lint-spec-ids.mjs

# 7/8 测试卫生守卫（tests/ 不许把源码 / 样式当文本断言，见 TESTING.md 第三节）
node hooks/lint-test-hygiene.mjs

# 8/8 色值字面量守卫（charts/ 下不许写死颜色，拼接铁律 1）
node hooks/lint-color-literals.mjs

echo "✓ 质量门禁 8/8 全部通过"
