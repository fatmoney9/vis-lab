/*
 * [L2-LOCAL][CHORD-04..08/16/18]
 * 弦图跨主题不变的几何与动效参数。
 *
 * ── 什么进这里、什么进 tokens/*.json ────────────────────────────────
 * 判据：**能用比例或弧度表达、三主题必然同值 → 这里；是设计源逐主题标注的像素、
 * 颜色或透明度 → tokens**。来源是 pie / radar 的 MIN_RADIUS_RATIO 原话——
 * 「取比例不取像素，跟着各主题自己的 token 走，故不进 token」。
 *
 * 所以半径、环宽、字号、标签带、透明度全在 tokens 那边，这里只剩纯比例量。
 * ⚠️ 尤其**透明度不在这里**：它是会被某个主题单独调掉的取值（CHORD-17），
 * 与 opacity-radar-area 同类，故走 token。
 */
export const CHORD_SETTINGS = Object.freeze({
  geometry: Object.freeze({
    /* [CHORD-04] 实体之间的间隙（弧度）与它占整圈的封顶比例。
       封顶是硬要求不是保险：示例的实体数可调，n·pad 会线性增长。 */
    'pad-angle': 0.035,
    'pad-angle-max-share': 0.12,

    /* [CHORD-10] 半径收缩下限比例。与 pie / radar 同一个数、同一个理由：
       取比例不取像素，跟着各主题自己的 --size-chord-radius 走。 */
    'min-radius-ratio': 0.5,

    /* [CHORD-06] directed 档目标端收窄到源端的比例。纯比例量，三主题同值。
       用它而不是 <marker> 箭头：marker 要自带尺寸与颜色，等于多开两条 token 通道。 */
    'directed-taper': 0.55,

    /* [CHORD-18] 非零槽位的最小可见角（弧度）。SANKEY-12「最细非零边仍须可见」的角度版。
       0.004 rad 在 R=80 的内圆上约合 0.3px 弧长，叠加描边后恰好还看得见一丝。 */
    'min-slot-angle': 0.004,
  }),
  motion: Object.freeze({
    /* [CHORD-16] 弦顺时针依次生长：总时长固定，每条弦的出现时机由单一进度值派生，
       不给每条弦各自计时（弦数在 4–90 之间变动，各自计时必然漂）。 */
    'growth-duration': 720,
    'growth-stagger-share': 0.4,
    'growth-easing': 'cubic-out',
  }),
});

function validateSettings() {
  const { geometry, motion } = CHORD_SETTINGS;
  const positive = (v) => Number.isFinite(v) && v > 0;

  if (!positive(geometry['pad-angle'])) {
    throw new Error('Chord 配置：pad-angle 必须是正数（弧度）');
  }
  if (
    !positive(geometry['pad-angle-max-share'])
    || geometry['pad-angle-max-share'] >= 0.5
  ) {
    throw new Error('Chord 配置：pad-angle-max-share 必须落在 (0, 0.5)——间隙占掉半圈以上就没有图元了');
  }
  if (!positive(geometry['min-radius-ratio']) || geometry['min-radius-ratio'] >= 1) {
    throw new Error('Chord 配置：min-radius-ratio 必须落在 (0, 1)');
  }
  if (!positive(geometry['directed-taper']) || geometry['directed-taper'] > 1) {
    throw new Error('Chord 配置：directed-taper 必须落在 (0, 1]——taper=1 即不收窄');
  }
  if (!positive(geometry['min-slot-angle'])) {
    throw new Error('Chord 配置：min-slot-angle 必须是正数（弧度）');
  }
  if (!positive(motion['growth-duration'])) {
    throw new Error('Chord 配置：growth-duration 必须是正数');
  }
  if (
    !Number.isFinite(motion['growth-stagger-share'])
    || motion['growth-stagger-share'] < 0
    || motion['growth-stagger-share'] >= 1
  ) {
    throw new Error('Chord 配置：growth-stagger-share 必须落在 [0, 1)');
  }
  if (motion['growth-easing'] !== 'cubic-out') {
    throw new Error('Chord 配置：growth-easing 必须是 cubic-out');
  }
}

validateSettings();

export function resolveChordSettings(platform) {
  if (!['pc', 'mobile'].includes(platform)) {
    throw new TypeError("ChordChart：platform 仅支持 'pc' 或 'mobile'");
  }
  /* 本族目前没有按端分叉的几何量——端差异全部体现在 token 取值上（半径、字号、
     标签带宽），而那些不在本文件。故这里原样返回；保留 platform 校验是为了
     让非法值当场报错，而不是一路传到布局里变成 NaN。 */
  return {
    geometry: CHORD_SETTINGS.geometry,
    motion: CHORD_SETTINGS.motion,
  };
}
