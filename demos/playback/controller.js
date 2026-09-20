/*
 * L3 · 播放状态机：时间轴 DOM 的接线与播放循环，**所有带时间轴的图型与预览面共用**。
 *
 * ── 为什么会有这个模块 ────────────────────────────────────────────
 * 不是「可能有用所以先抽出来」：2026-09-20 之前，同一套状态机在 index.html 与
 * playground/sankey-preview.html 里**逐行重复了两遍**（三个状态变量、一条 await 链
 * while 循环、五个监听、一套 UI 回显）。第三个要播放的图型接进来就是第三遍。
 *
 * ── 职责边界（写在这里，否则半年后它又会长回 html 里）──────────────
 * 本模块**管**：查播放区 DOM、接五个监听、`isPlaying` / `disposed` /
 *   `transitionTargetIndex` 三态、await 链播放循环与帧间隔、UI 回显
 *   （range.value · ticks 的 is-current · output · prev/next 禁用 · toggle 的 is-playing）。
 * 本模块**不管**：图表实例、怎么拼配置、主题文案怎么选、宿主 state 长什么样、
 *   图表高度、舞台标题。这些全部经参数注入——**它不认识任何具体图型**。
 *
 * ⚠️ 没有 setInterval：帧间隔是 await 链里的一次 setTimeout，靠 disposed / isPlaying
 * 两个旗标在循环条件里自然退出，所以不需要 clear。宿主只要在销毁时调 dispose()。
 */

import { assertPlaybackCopy, playbackRangeTheme, runPlaybackUpdate } from './view.js';

/*
 * surface —— 播放区所在的容器（内部按 .chart-playback__* 查控件）
 * options：
 *   periods     [{ period, statusLabel?, shortPeriod?, timelinePeriod? }] 只读，内容不被解释
 *   copy        整套播放文案，进来先过 assertPlaybackCopy
 *   getIndex    () => number        宿主持有当前期序（index.html 是 state.periodIndex）
 *   setIndex    (i) => void
 *   applyPeriod (index, { animate }) => Promise<boolean>   **唯一的「怎么画一期」出口**
 *   pause       () => void          冻结当前帧（单图转调 chart.pause()，多图转调多次）
 *   onRender    ({ index, period, isPlaying }) => void     宿主侧回显（舞台标题 / 逻辑面板）
 *   scope       { theme, mode, platform } → 写进 range 的 dataset，供 CSS 分主题
 *   frameGap    期间帧间隔毫秒，缺省 120
 *   autoplay    是否进来就起播，**缺省 false**：一进页面就自动动起来，对前庭功能障碍
 *               用户与只想看某一帧的人都是打扰；播放键就在那里，要看的人会点
 * → { goTo, toggle, stop, isPlaying, dispose }
 */
export function createPlaybackController(surface, {
  periods,
  copy,
  getIndex,
  setIndex,
  applyPeriod,
  pause,
  onRender = () => {},
  scope = {},
  frameGap = 120,
  autoplay = false,
} = {}) {
  assertPlaybackCopy(copy, 'createPlaybackController');
  const list = Array.isArray(periods) ? periods : [];
  const range = surface.querySelector('.chart-playback__range');
  const ticks = surface.querySelector('.chart-playback__ticks');
  const toggle = surface.querySelector('.chart-playback__primary');
  const output = surface.querySelector('.chart-playback__period');
  const previous = surface.querySelector('.chart-playback__step--prev');
  const next = surface.querySelector('.chart-playback__step--next');
  if (!range || !ticks || !toggle || !output || !previous || !next) {
    throw new Error('createPlaybackController：播放区 DOM 不完整，先用 playbackMarkup 渲染它');
  }

  range.dataset.theme = playbackRangeTheme(scope.theme ?? 'ths');
  if (scope.mode) range.dataset.mode = scope.mode;
  if (scope.platform) range.dataset.platform = scope.platform;

  let playing = false;
  let disposed = false;
  let transitionTargetIndex = null;

  const clamp = (i) => Math.max(0, Math.min(list.length - 1, Number.isFinite(i) ? Math.round(i) : 0));

  const render = () => {
    if (disposed) return;
    const index = clamp(getIndex());
    const period = list[index];
    range.value = `${index}`;
    output.value = period?.period ?? '';
    surface.dataset.period = period?.period ?? '';
    toggle.classList.toggle('is-playing', playing);
    toggle.setAttribute('aria-label', playing ? copy.pause : copy.play);
    toggle.title = playing ? copy.pauseTitle : copy.playTitle;
    previous.disabled = index <= 0;
    next.disabled = index >= list.length - 1;
    ticks.querySelectorAll('[data-period-index]').forEach((tick) => {
      const isCurrent = Number(tick.dataset.periodIndex) === index;
      tick.classList.toggle('is-current', isCurrent);
      tick.setAttribute('aria-current', isCurrent ? 'true' : 'false');
    });
    onRender({ index, period, isPlaying: playing });
  };

  const stop = () => {
    playing = false;
    pause?.();
    render();
  };

  /* 先把序号推到目标、先回显控件，**再** await 图表动画——这正是
     「滑块切换开始时直接跳到目标刻度，不随图形中间帧滑动」（PLAYBACK-03）的实现方式：
     滑块与图形解耦、不共享进度。失败时回滚序号。 */
  const goTo = async (targetIndex, animate = true) => {
    if (disposed) return false;
    const previousIndex = getIndex();
    const target = clamp(targetIndex);
    transitionTargetIndex = target;
    setIndex(target);
    render();
    const completed = await runPlaybackUpdate(
      () => applyPeriod(target, { animate }),
      {
        onError: (error) => console.error('播放更新失败', error),
        onFailure: () => {
          setIndex(previousIndex);
          transitionTargetIndex = null;
          playing = false;
          render();
        },
      },
    );
    if (disposed) return false;
    if (completed) {
      transitionTargetIndex = null;
      render();
    }
    return completed;
  };

  const play = async () => {
    if (playing) { stop(); return; }
    playing = true;
    render();
    try {
      /* 上次被暂停在半途 → 先把那一跳补完，再继续往后走 */
      if (transitionTargetIndex !== null) {
        const done = await goTo(transitionTargetIndex, true);
        if (!done || !playing || disposed) return;
      }
      /* 已经在末期 → 回卷到第 0 期，且这一跳不动画（那是重置不是播放） */
      if (getIndex() >= list.length - 1) await goTo(0, false);
      while (!disposed && playing && getIndex() < list.length - 1) {
        const done = await goTo(getIndex() + 1, true);
        if (!done || !playing || disposed) break;
        await new Promise((resolve) => setTimeout(resolve, frameGap));
      }
    } catch (error) {
      console.error('播放流程失败', error);
    } finally {
      playing = false;
      render();
    }
  };

  const onToggle = () => { void play(); };
  const onRange = () => { const i = Number(range.value); stop(); void goTo(i); };
  const onPrevious = () => { stop(); void goTo(getIndex() - 1); };
  const onNext = () => { stop(); void goTo(getIndex() + 1); };
  const onTick = (event) => {
    const tick = event.target.closest('[data-period-index]');
    if (!tick) return;
    stop();
    void goTo(Number(tick.dataset.periodIndex));
  };

  toggle.addEventListener('click', onToggle);
  range.addEventListener('input', onRange);
  previous.addEventListener('click', onPrevious);
  next.addEventListener('click', onNext);
  ticks.addEventListener('click', onTick);
  render();
  if (autoplay) void play();

  return {
    goTo,
    toggle: onToggle,
    stop,
    isPlaying: () => playing,
    /* 幂等：重复调用安全。先置 disposed 再 pause，避免 in-flight 的 goTo 回调继续改 UI */
    dispose: () => {
      disposed = true;
      playing = false;
      pause?.();
      toggle.removeEventListener('click', onToggle);
      range.removeEventListener('input', onRange);
      previous.removeEventListener('click', onPrevious);
      next.removeEventListener('click', onNext);
      ticks.removeEventListener('click', onTick);
    },
  };
}
