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

# ③ L2 不许重写 L1 已有的能力。
#    只认能精确定位归属的信号——守卫宁可漏报，也不能误报：一旦开始吵，就会被绕过。
#      getComputedTextLength          → core/measure.js（[AXIS-08] 全库唯一测量源）
#      matchMedia                     → core/motion.js  reducedMotion（[MOTION-07]）
#      1 - (1 - x) ** 3               → core/motion.js  easeOutCubic（[MOTION-03]）
#    换个写法抄同一个算法（纯语义重复）本守卫查不出，靠 AGENTS.md「L1 能力索引」+ review 兜。
#
#    已知欠账：清掉一条就删一行；**新文件一律不得加进本列表**。
DEBT="charts/charts/sankey/index.js charts/charts/sankey/playback.js"
REWRITE_RE="getComputedTextLength|matchMedia|1 - \(1 - [A-Za-z0-9_.]+\) \*\* 3"

for f in $(find charts/charts -name '*.js' 2>/dev/null); do
  hits=$(grep -nE "$REWRITE_RE" "$f" 2>/dev/null || true)
  case " $DEBT " in
    *" $f "*)
      # 欠账清掉后要记得从列表里删——否则这份列表自己会变成过期副本
      if [ -z "$hits" ]; then
        echo "✗ [分层③] $f 已不再重写 L1，请从 hooks/lint-layers.sh 的 DEBT 列表里删除该行" >&2
        fail=1
      fi
      continue
      ;;
  esac
  if [ -n "$hits" ]; then
    echo "✗ [分层③] $f 重写了 L1 已有的能力——请改用 L1（见 AGENTS.md「L1 能力索引」）：" >&2
    echo "$hits" | sed 's/^/    /' >&2
    fail=1
  fi
done

if [ "$fail" = 0 ]; then echo "✓ 分层守卫通过（L1 不依赖 L2；L2 调 L1 或标注专属；未重写 L1 能力）"; fi
exit $fail
