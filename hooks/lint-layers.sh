#!/bin/sh
# 分层硬守卫（L1/L2 依赖纪律）。被 hooks/pre-commit 调用，也可单独跑：sh hooks/lint-layers.sh
#
# 规则：
#   ① L1（charts/core/）不许 import L2（charts/charts/）——依赖方向只能向下（L3→L2→L1→L0）。
#   ② L2（charts/charts/ 下每个 .js）必须二选一：
#        · import 了 L1（.../core/…），即复用共享计算/渲染；或
#        · 显式标注 [L2-LOCAL]（图表专属、有意不下沉 L1，如分组/堆叠排布）。
#      → 杜绝「沉默的 L2 计算」：不复用 L1 又不声明专属 = 可能偷造 L1 / 放错层。
#
# 注：无法自动检测「语义重复」（把 L1 的算法照抄进 L2）——那仍靠 WORKFLOW §三 粒度尺 + review + spec ID。
fail=0

# ① 依赖方向：core(L1) 里出现 import 自 ../charts/（L2）即违规
hits=$(grep -rnE "from ['\"]\.\./charts/" charts/core/ 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "✗ [分层①] L1(core) 依赖了 L2——依赖方向只能向下：" >&2
  echo "$hits" | sed 's/^/    /' >&2
  fail=1
fi

# ② L2 每个 .js：调 L1 或标 [L2-LOCAL]
for f in $(find charts/charts -name '*.js' 2>/dev/null); do
  if ! grep -qE "^import.*/core/" "$f" && ! grep -q '\[L2-LOCAL\]' "$f"; then
    echo "✗ [分层②] $f 既没 import L1(core)、也没标 [L2-LOCAL]（图表专属）——二选一" >&2
    fail=1
  fi
done

if [ "$fail" = 0 ]; then echo "✓ 分层守卫通过（L1 不依赖 L2；L2 全部调 L1 或标注专属）"; fi
exit $fail
