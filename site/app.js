/* 对外站点（index.html）的页面逻辑：画廊、详情页、旋钮与播放。由 index.html 以模块脚本加载。
   ⚠️ 本文件在 site/ 下：import 路径相对本文件（../demos/…），而写进 DOM 的 src / href 相对页面（./assets/…），两者基准不同。
   正文保留了从 index.html 搬来时的 4 格缩进：模板字符串里拼的是 HTML，去缩进会改变 DOM 里的空白文本节点。 */

    import { mountExample } from '../demos/registry.js';
    import { examplesFor, familiesFor, suggestedLegend, THEMES, capabilitiesOf, defaultDensityOf, defaultDensityCountOf, densitySliderOf, densityUnitOf, clampDensity, describeConfig, buildConfig, radarGridShapeOf, radarShapeOf, radarEditableOf, radarAxisLabelLayoutOf, playbackPeriodsOf as sharedPlaybackPeriodsOf, clampPeriodIndex as sharedClampPeriodIndex, activePeriodExample } from '../demos/examples.js';
    import { createPlaybackController } from '../demos/playback/controller.js';
    import { densitiesOf } from '../charts/core/theme.js';
    import { contentLocale } from '../demos/themes.js';
    /* 分类图标住在 demos/nav-icons.js（门禁要 import 它核对缺图标的族，见 hooks/lint-nav-icon.mjs）。 */
    import { NAV_ICONS } from '../demos/nav-icons.js';
    import { renderSpecView, scrollSpecAnchor } from './specs-view.js';
    import { parseSpecRoute, ruleIdsOf, ruleHref } from './spec-index.js';
    import {
      playbackCopy,
      applyPlaybackViewport,
      resolvePlaybackCanvasHeight,
      playbackMarkup as sharedPlaybackMarkup,
    } from '../demos/playback/view.js';

    document.documentElement.dataset.ready = '1'; /* 走到这里说明 d3 与全部模块都已加载成功 */
    /* 示例定义、数据生成函数、主题与密度档位全部来自 demos/examples.js —— 与 playground 同一份数据源，
       加示例只加那一处。本页只负责「怎么展示」：画廊 + 详情页、单主题切换。 */
    const EXAMPLES = examplesFor('index');
    /* 分类导航按**图表族**分节（一个 L2 组件 = 一族），族内再列分类。
       族与族名都从 demos/examples.js 派生，接新组件时本页一行不改。 */
    const FAMILIES = familiesFor('index');
    const ALL = '全部示例';
    /* 移动端只有 375px 这一档，且**只给图表净宽**：高度不预设，交给组件自己的高度 token。
       chartWidth = 375 - 16 × 2 = 343；演示外壳的 padding / border 不得再吃掉这段净宽。
       只有一个取值，所以不做成旋钮——一个只能选它自己的下拉框是假的选择。
       将来真要多档（比如 390 / 430），把它改回数组并重新接一个 segment 即可。 */
    const MOBILE_VIEWPORT = { label: '375px', chartWidth: 343 };

    const state = {
      group: ALL,
      query: '',
      detail: null,
      /* 设计规范视图：{ page, anchor } 或 null。与 detail 互斥——同一时刻只看一样东西。 */
      spec: null,
      theme: 'ths',
      platform: 'pc',
      mode: 'light',
      uiDensity: 'standard', /* 版式密度（data-density）：与上面的数据「项数」density 无关，见 tokens/README.md「密度覆盖层」 */
      density: 4,            /* 连续档：本站的项数是一根滑杆，存的是**数**不是档位 id；
                                进详情时由 defaultDensityCountOf 换成该示例的默认值 */
      treemapColor: 'intensity',
      treemapImage: false,    /* [TREEMAP-18] 公司标识，默认关 */
      axisValue: false,       /* [RADAR-07] 轴标签数值，默认关；与交互无关 */
      radarGridShape: 'auto', /* [RADAR-03] 圆形 / 多边形网格；auto 保留示例默认 */
      radarShape: 'auto',    /* [RADAR-05] 直线 / 曲线轮廓；auto 保留示例默认 */
      radarEditable: 'off',  /* [RADAR-18] 编辑是可叠加能力，不是第三类雷达图 */
      seriesCount: 0,        /* index 专属示例控件：增减假数据 series，不进入图表能力或组件 cfg */
      ratingStyle: 'gradient', /* [RADAR-15] 分区雷达默认连续渐变，可切离散色带 */
      ratingBandCount: '6',  /* [RADAR-15] 分段档同时控制图内环带与底部说明，默认 6 段 */
      axisLabelLayout: 'auto', /* [RADAR-07/14] 常规横排、可调节环绕；点选后显式覆盖 */
      waterfallColor: 'primary',
      chordVariant: 'undirected', /* [CHORD-05/06] 无向一条带 / 有向每向一条 */
      chordLabelLayout: 'arc',    /* [CHORD-11] 环绕弧字 / 径向横排 */
      dataLabel: 'auto',      /* [LABEL-05] 开关的「开」= 按图表类型默认，不落进 cfg */
      labelLayout: 'off',     /* [PIE-12] 饼环显隐 + 形态合一：关 / 引线 / 扇区内，默认关 */
      labelAlign: 'anchor',   /* [PIE-13] 默认就近；仅引线档生效 */
      legend: 'right',        /* [PIE-09] 默认左右；切到引线时由 suggestedLegend 拨到上下 */
      legendSelect: 'multi',  /* [LEGEND-06][LEGEND-14] 图例点击语义：多选显隐 / 单选保留 / 强调，默认多选 */
      area: false,
      zoom: false,
      axisTitle: false,
      callout: false,  /* [CALLOUT-01] 同 axisTitle：默认不显示，打开才注入示例自带的标注 */
      animation: true, /* [MOTION-07] 与其他旋钮相反：默认开 */
      periodIndex: 0,
    };

    const main = document.getElementById('main-content');
    const workspace = document.getElementById('workspace');
    const categoryNav = document.getElementById('category-nav');
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    let charts = [];
    let chartCleanups = [];

    /* 仅 index 详情页消费的示例数据控件。范围声明跟示例夹具住在一起，但它不是
       CHART_CAPABILITIES，也不会作为 seriesCount 参数传进任何 L2 组件。 */
    function indexSeriesControlOf(example) {
      const range = example?.indexSeriesRange;
      if (!range) return null;
      const min = Math.max(1, Math.round(Number(range.min) || 1));
      const max = Math.max(min, Math.round(Number(range.max) || min));
      const value = Math.max(min, Math.min(max, Math.round(Number(range.default) || min)));
      return { label: '数据组数', hint: '系列数量', unit: '组数据', min, max, value };
    }

    function clampIndexSeriesCount(example, count) {
      const control = indexSeriesControlOf(example);
      if (!control) return 0;
      const value = Math.round(Number(count));
      return Number.isFinite(value) ? Math.max(control.min, Math.min(control.max, value)) : control.value;
    }

    const defaultIndexSeriesCountOf = (example) => indexSeriesControlOf(example)?.value ?? 0;

    function destroyCharts() {
      chartCleanups.splice(0).forEach((cleanup) => cleanup());
      charts.forEach((chart) => chart.destroy());
      charts = [];
    }

    /* 搜索的命中集**只按关键词收**，不掺分类筛选：导航要用它（分类是导航自己的一级，
       再叠一层就只剩当前分类了），画廊在它之上再叠分类。两者同源，搜索框因此
       既是画廊的筛子，也是导航的快速跳转。 */
    function matchedExamples() {
      const query = state.query.trim().toLowerCase();
      if (!query) return EXAMPLES;
      return EXAMPLES.filter((example) =>
        `${example.title}${example.description}${example.spec}`.toLowerCase().includes(query));
    }

    function filteredExamples() {
      return matchedExamples().filter((example) => state.group === ALL || example.group === state.group);
    }


    function renderNavigation() {
      const pool = matchedExamples();
      /* 分类的「选中」只在画廊里有意义（它筛的就是画廊）；进了详情页画廊没在显示，
         再把某个分类标成选中就是假信息——那时改标 --current：只说明当前这张图属于哪一节。 */
      const item = (group, chart) => {
        const active = !state.detail && state.group === group;
        const current = state.detail?.group === group;
        const icon = NAV_ICONS[group] ?? NAV_ICONS[chart] ?? '';
        return `<button class="nav-item${active ? ' nav-item--active' : ''}${current ? ' nav-item--current' : ''}"
          type="button" data-group="${group}">${icon}<span>${group}</span></button>`;
      };
      /* 示例是 <a href="#id">：走的还是既有的 hash 路由，故详情页内点它 = 直接换图，
         不经画廊；旋钮状态留在 state 里不动，换图后主题/明暗/动效原样保持。 */
      const leaf = (example) =>
        `<a class="nav-example${state.detail?.id === example.id ? ' nav-example--active' : ''}"
          href="#${example.id}" title="${example.title}"><span>${example.title}</span></a>`;
      /* 「全部示例」独立在最上，不归任何一族——它是跨族的入口 */
      categoryNav.innerHTML = item(ALL, '__all') + '<div class="nav-divider"></div>' + FAMILIES.map((family) => {
        /* 只保留当前命中集里还有示例的分类；整族筛空就整段不出 */
        const hits = family.groups
          .map((g) => [g, pool.filter((e) => e.group === g)])
          .filter(([, items]) => items.length);
        if (!hits.length) return '';
        const groups = hits
          .map(([g, items]) => item(g, family.chart) + `<div class="nav-examples">${items.map(leaf).join('')}</div>`)
          .join('');
        /* 族名恒出：它是「一个 L2 组件 = 一族」这条分层事实的可见处，
           哪怕族内只有一个分类，少了它就看不出雷达和饼是两个组件。 */
        return `<div class="nav-family"><span class="nav-family__title">${family.label}</span></div>${groups}`;
      }).join('');
      /* 20 个示例撑得比侧栏高，重画后当前那条常落在滚动区外——「我现在在哪」看不见，
         一步换图的好处就废了一半。`nearest` 只动最近的可滚动祖先（即本导航），不牵动整页。 */
      categoryNav.querySelector('.nav-example--active')?.scrollIntoView({ block: 'nearest' });
    }

    /* 配置装配与组件挂载都走 demos/ 共享模块：cfg 怎么拼、哪个旋钮对哪种图表生效，
       两个预览面用同一份实现（铁律3：面不自己拼装）。新图表类型只需在 registry 登记。 */
    function mountChart(host, example, overrides = {}) {
      const { instance, cfg } = mountExample(host, example, { ...state, ...overrides });
      charts.push(instance);
      return { instance, cfg };
    }

    function renderGallery() {
      const items = filteredExamples();
      const sections = state.group === ALL && !state.query
        ? [...new Set(items.map((item) => item.group))].map((group) => ({
          group,
          items: items.filter((item) => item.group === group),
        }))
        : [{ group: state.group === ALL ? '搜索结果' : state.group, items }];

      main.innerHTML = `<div class="gallery">
        <header class="page-head">
          <div>
            <h1>图表示例</h1>
            <p>按图表族浏览已验证能力。进入详情后，可编辑主题、终端、明暗、数据密度与缩放窗口等语义配置。</p>
          </div>
          <span class="page-head__meta">${items.length} 个结果</span>
        </header>
        ${items.length ? sections.map((section) => `<section class="gallery-section">
          <h2 class="section-title">${section.group}</h2>
          <div class="example-grid">${section.items.map((item) => `<a class="example-card" href="#${item.id}" data-id="${item.id}" data-chart="${item.chart}">
            <div class="example-card__preview" data-theme="ths" data-platform="pc" data-mode="light"><div class="chart-host"></div></div>
            <div class="example-card__body"><span class="example-card__title">${item.title}</span><span class="example-card__tag">${item.spec.split(' / ')[0]}</span></div>
          </a>`).join('')}</div>
        </section>`).join('') : '<div class="empty-state">没有匹配的图表示例</div>'}
      </div>`;

      const mountCard = (card) => {
        const example = EXAMPLES.find((item) => item.id === card.dataset.id);
        mountChart(card.querySelector('.chart-host'), example, {
          density: defaultDensityOf(example), theme: 'ths', platform: 'pc', area: false, zoom: false, axisTitle: false, callout: false,
          animation: true, compact: true,
        });
      };
      /* 卡片滚动到视口附近才挂载：一次挂齐全部示例是首页最大的开销，入场动效也会在看不见的地方播完。
         预览区有固定最小高度，未挂载的卡片不会让页面跳动。 */
      const cards = [...main.querySelectorAll('.example-card')];
      if (!('IntersectionObserver' in window)) { cards.forEach(mountCard); return; }
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          mountCard(entry.target);
        });
      }, { rootMargin: '300px 0px' });
      cards.forEach((card) => observer.observe(card));
      chartCleanups.push(() => observer.disconnect());
    }

    /* disabled = 该旋钮当前不生效（如「标签对齐」在非引线档下）——置灰而不是隐藏：
       藏起来会让「这一档才有对齐可言」这件事变得不可见，用户只会以为功能没做。 */
    function segment(name, options, value, disabled = false) {
      return `<div class="segment${disabled ? ' segment--disabled' : ''}" data-segment="${name}"${disabled ? ' aria-disabled="true"' : ''}>${options.map(([id, label]) =>
        `<button class="segment__item${value === id ? ' segment__item--active' : ''}" type="button" data-value="${id}"${disabled ? ' disabled' : ''}>${label}</button>`).join('')}</div>`;
    }

    /* 三个读取器住在 demos/examples.js（三面共用，铁律3：面不自己拼配置）；
       这里只是把本页的 state 绑上去的薄包装。 */
    const playbackPeriodsOf = (example) => sharedPlaybackPeriodsOf(example, { theme: state.theme });
    const clampPeriodIndex = (example, index = state.periodIndex) => (
      sharedClampPeriodIndex(example, index, { theme: state.theme })
    );

    function activeExample(example, periodIndex = state.periodIndex) {
      const active = activePeriodExample(example, { periodIndex, theme: state.theme });
      const seriesControl = indexSeriesControlOf(active);
      if (!seriesControl) return active;
      const sourceCfg = active.cfg;
      const seriesCount = clampIndexSeriesCount(active, state.seriesCount);
      /* 第二参数只选示例假数据；返回给组件的仍是普通 cfg，没有 seriesCount 字段。 */
      return { ...active, cfg: (density) => sourceCfg(density, seriesCount) };
    }

    function playbackMarkup(example) {
      const periods = playbackPeriodsOf(example);
      if (!periods.length) return '<div class="chart-host"></div>';
      const copy = playbackCopy({ theme: state.theme });
      const currentIndex = clampPeriodIndex(example);
      /* 声明了 viewport 的图型（桑基：SANKEY-23 的固定外框）用算好的固定高；
         没声明的按内容撑高——否则会沿用桑基那档 243px，行数少时下方留出大片空白。 */
      const autoHeight = !example.playback?.viewport;
      return `<div class="chart-playback-layout${autoHeight ? ' chart-playback-layout--auto' : ''}">
        <div class="chart-host"></div>
        ${sharedPlaybackMarkup({
          periods,
          currentIndex,
          copy,
          playIconSrc: './assets/playback/play.svg',
        })}
      </div>`;
    }

    /* 完整配置由 demos/examples.js 的同一个 buildConfig 生成，故这里展示的
       与真正传进组件的是同一份 cfg；数组及嵌套数据不折叠（铁律3：面不自己拼配置，
       也不自己猜配置的形状）。
       只有**不进 cfg** 的三项单列在前：主题 / 明暗写在容器的 data-* 上走 CSS 级联，
       机型视口只决定外壳尺寸、不传给组件。platform 由 describeConfig 从 cfg 带出。
       cfg 里没有的字段（如未开的 zoom、默认开的 animation）照实不显示 = 走组件默认。 */
    function currentConfig(example) {
      return {
        theme: state.theme,
        ...(state.platform === 'mobile' ? { viewport: MOBILE_VIEWPORT.label } : {}),
        mode: state.mode,
        ...describeConfig(activeExample(example), state),
      };
    }

    /* 详情页的一次装配：**图表实例与播放接线同生同灭**。
       ⚠️ 三个调用点（首次渲染 / 旋钮重渲 / 滑杆重挂）都必须走这里。
       2026-09-20 之前 remountDetailFromSlider 只挂图不挂播放——它先 destroyCharts()
       抽干 chartCleanups（播放接线一并 dispose），之后只 mountChart，
       于是拖一次数据量滑杆播放按钮就永久失灵。今天看不见，只因为唯一的播放示例
       桑基声明了 density:false、根本没有滑杆；第一个同时要滑杆和播放的图型会当场踩到。 */
    function mountStage(host, example, overrides = {}) {
      const { instance } = mountChart(host, activeExample(example), overrides);
      const surface = main.querySelector('.stage__surface');
      if (surface && playbackPeriodsOf(example).length) {
        chartCleanups.push(mountPlayback(surface, example, instance));
      }
      return instance;
    }

    /* 播放状态机住在 demos/playback/controller.js（三面共用）。这里只注入「怎么画一期」
       与宿主侧回显：控制器不认识 SankeyChart，也不认识 state 长什么样。 */
    function mountPlayback(surface, example, chart) {
      const periods = playbackPeriodsOf(example, { theme: state.theme });
      const controller = createPlaybackController(surface, {
        periods,
        copy: playbackCopy({ theme: state.theme }),
        scope: { theme: state.theme, mode: state.mode, platform: state.platform },
        getIndex: () => state.periodIndex,
        setIndex: (i) => { state.periodIndex = i; },
        pause: () => chart.pause(),
        /* 逐期同样走 **buildConfig**——与首屏挂载、与 playground 三卡是同一条装配线。
           ⚠️ 这里曾经手拼 cfg 绕开 buildConfig，于是**整条主题内容适配在播放时失效**：
           chartContentPresentation（Ainvest 全英文）只在 buildConfig 里跑，
           症状是「静止时是 Banking，一播放就变回银行」。2026-09-20 实测如此。
           绕开装配线就会漏掉装配线上的每一道工序，不只是翻译这一道。 */
        applyPeriod: (index, { animate }) => chart.update(
          buildConfig(activeExample(example, index), state),
          { animate },
        ),
        onRender: ({ period }) => {
          const stagePeriod = main.querySelector('[data-stage-period]');
          /* statusLabel 是桑基特有的业务状态（「已发布」之类），别的图型没有 —— 缺就只显示期数 */
          if (stagePeriod && period) {
            stagePeriod.textContent = period.statusLabel ? `${period.period} · ${period.statusLabel}` : period.period;
          }
          const logicConfig = document.getElementById('logic-config');
          if (logicConfig) logicConfig.textContent = JSON.stringify(currentConfig(example), null, 2);
        },
      });
      return controller.dispose;
    }

    function renderDetail() {
      const example = state.detail;
      state.periodIndex = clampPeriodIndex(example);
      const theme = THEMES.find((item) => item.id === state.theme);
      /* 切到没声明紧凑档的主题时不清 uiDensity，只是不生效——切回 Ainvest 仍保持上次的选择 */
      const compact = state.uiDensity === 'compact' && densitiesOf(state.theme).includes('compact');
      const hasPlayback = playbackPeriodsOf(example).length > 0;
      const currentPeriod = hasPlayback ? playbackPeriodsOf(example)[state.periodIndex] : null;
      const metaCopy = playbackCopy({ theme: state.theme });
      const densitySlider = densitySliderOf(example);
      const densityLabel = `${state.density} ${densitySlider.unit}`;
      const seriesControl = indexSeriesControlOf(example);
      const seriesLabel = seriesControl
        ? `${clampIndexSeriesCount(example, state.seriesCount)} ${seriesControl.unit}`
        : '';
      const exampleSummary = example.summaryByLocale?.[contentLocale(state.theme)] ?? example.summary;
      /* 只注初始宽度，高度不注——高度归 --size-chart-region-height（按主题分化）自然撑开 */
      const surfaceVariables = [
        ...(example.preferredWidth ? [`--chart-preferred-width:${example.preferredWidth}px`] : []),
        ...(state.platform === 'mobile'
          ? [`--mobile-chart-width:${MOBILE_VIEWPORT.chartWidth}px`]
          : []),
      ];
      const surfaceStyle = surfaceVariables.length
        ? ` style="${surfaceVariables.join(';')}"`
        : '';
      /* 旋钮按图表类型能力显隐——接入饼 / 环等无类目轴的图表时，缩放轴等开关自动不出现 */
      const caps = capabilitiesOf(example);
      const effectiveRadarGridShape = radarGridShapeOf(example, state.radarGridShape);
      const effectiveRadarShape = radarShapeOf(example, state.radarShape);
      const effectiveRadarEditable = radarEditableOf(example, state.radarEditable);
      const effectiveAxisLabelLayout = radarAxisLabelLayoutOf(example, state.axisLabelLayout, state.radarEditable);
      const areaAvailable = caps.area;

      main.innerHTML = `<div class="detail">
        <div class="detail__main">
          <header class="detail-head">
            <nav class="breadcrumb" aria-label="面包屑导航">
              <a class="breadcrumb__link" href="#all">图表示例</a>
              <span class="breadcrumb__separator" aria-hidden="true">/</span>
              <span class="breadcrumb__current" aria-current="page">${example.title}</span>
            </nav>
            <div class="detail-title-row">
              <div><h1>${example.title}</h1><p>${example.description}</p></div>
              <span class="spec-chip">${ruleIdsOf(example.spec).map((id) => {
                /* 规范徽标的每个 ID 都能点到规范页的那一条（门禁保证 ID 真实存在，见 hooks/lint-spec-index.mjs） */
                const href = ruleHref(id);
                return href ? `<a class="spec-chip__link" href="${href}">${id}</a>` : id;
              }).join(' / ')}</span>
            </div>
          </header>
          <section class="stage">
            <div class="stage__bar">
              <span class="stage__theme">${theme.label}${compact ? ' · 紧凑' : ''}</span>
              <span class="stage__meta">${currentPeriod ? `<span class="stage__period" data-stage-period>${currentPeriod.statusLabel ? `${currentPeriod.period} · ${currentPeriod.statusLabel}` : currentPeriod.period}</span> · ` : ''}${state.platform === 'pc' ? 'PC' : `${metaCopy.mobile} ${MOBILE_VIEWPORT.label}`} · ${state.mode === 'light' ? metaCopy.light : metaCopy.dark} · ${caps.density ? `<span data-stage-density>${densityLabel}</span>` : (exampleSummary ?? densityLabel)}</span>
            </div>
            <div class="stage__canvas">
              <div class="stage__surface" data-chart="${example.chart}" data-theme="${state.theme}"${compact ? ' data-density="compact"' : ''} data-platform="${state.platform}" data-mode="${state.mode}" data-playback="${hasPlayback}"${surfaceStyle}>
                ${playbackMarkup(example)}
              </div>
            </div>
          </section>
        </div>
        <aside class="settings" aria-label="示例配置">
          <div class="tab"><div class="tab__list">
            <button class="tab__item tab__item--active" type="button" role="tab" aria-selected="true" data-panel="settings-panel">参数<span class="tab__indicator"></span></button>
            <button class="tab__item" type="button" role="tab" aria-selected="false" data-panel="logic-panel">逻辑<span class="tab__indicator"></span></button>
          </div></div>
          <div class="settings__panel" id="settings-panel">
            <!-- 主题用分段而非下拉：只有三个值，下拉要「点开 + 再点一次」，分段一次就切完；
                 换示例时 state.theme 不重置，所以选定的主题会跟着你一路看下去。 -->
            <div class="field"><div class="field__copy"><span class="field__label">主题</span><span class="field__hint">data-theme · 换示例后保持不变</span></div>${segment('theme', THEMES.map((item) => [item.id, item.label]), state.theme)}</div>
            <div class="field"><span class="field__label">终端</span><span class="field__hint">参与主题行为解析</span>${segment('platform', [['pc', 'PC'], ['mobile', '移动端']], state.platform)}</div>
            <div class="field"><span class="field__label">明暗</span><span class="field__hint">切换整套颜色 token</span>${segment('mode', [['light', '浅色'], ['dark', '深色']], state.mode)}</div>
            ${densitiesOf(state.theme).includes('compact') ? `<div class="field"><span class="field__label">版式</span><span class="field__hint">data-density · 同品牌更紧凑的尺寸档</span>${segment('uiDensity', [['standard', '标准'], ['compact', '紧凑']], state.uiDensity)}</div>` : ''}
            ${caps.density ? `<div class="field">
              <div class="field__row">
                <div class="field__copy"><span class="field__label">${densitySlider.label}</span><span class="field__hint">${densitySlider.hint}</span></div>
                <output class="slider__value" id="density-value">${densityLabel}</output>
              </div>
              <input class="slider" id="density-slider" type="range" step="1"
                min="${densitySlider.min}" max="${densitySlider.max}" value="${state.density}"
                aria-label="${densitySlider.label}" />
              <div class="slider__ends"><span>${densitySlider.min}</span><span>${densitySlider.max}</span></div>
            </div>` : ''}
            ${seriesControl ? `<div class="field">
              <div class="field__row">
                <div class="field__copy"><span class="field__label">${seriesControl.label}</span><span class="field__hint">${seriesControl.hint}</span></div>
                <output class="slider__value" id="series-value">${seriesLabel}</output>
              </div>
              <input class="slider" id="series-slider" type="range" step="1"
                min="${seriesControl.min}" max="${seriesControl.max}" value="${clampIndexSeriesCount(example, state.seriesCount)}"
                aria-label="${seriesControl.label}" />
              <div class="slider__ends"><span>${seriesControl.min}</span><span>${seriesControl.max}</span></div>
            </div>` : ''}
            ${caps.treemapColor && state.theme === 'ths' ? `<div class="field"><span class="field__label">颜色模式</span><span class="field__hint">THS · 程度五档 / 涨跌三档 / 涨跌无档位</span>${segment('treemapColor', [['intensity', '程度'], ['semantic-binned', '涨跌（分档）'], ['semantic-flat', '涨跌（不分档）']], state.treemapColor)}</div>` : ''}
            ${caps.treemapImage && state.theme === 'ainvest' ? `<div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">公司标识</span><span class="field__hint">TREEMAP-18 · 默认不显示；开启后单元格与 Tooltip 显示企业首字母占位</span></div><label class="switch" aria-label="公司标识"><input id="treemap-image-switch" type="checkbox"${state.treemapImage ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>` : ''}
            ${caps.radarGridShape ? `<div class="field"><span class="field__label">网格形态</span><span class="field__hint">RADAR-03 · 圆形或正多边形</span>${segment('radarGridShape', [['circle', '圆形'], ['polygon', '多边形']], effectiveRadarGridShape)}</div>` : ''}
            ${caps.radarShape ? `<div class="field"><span class="field__label">闭合轮廓</span><span class="field__hint">RADAR-05 · 直线或曲线</span>${segment('radarShape', [['straight', '直线'], ['curve', '曲线']], effectiveRadarShape)}</div>` : ''}
            ${caps.ratingStyle ? `<div class="field"><span class="field__label">分区</span><span class="field__hint">RADAR-15 · 默认连续渐变，可切离散色带</span>${segment('ratingStyle', [['gradient', '渐变'], ['bands', '分段']], state.ratingStyle)}</div>` : ''}
            ${caps.ratingBandCount && state.ratingStyle === 'bands' ? `<div class="field"><span class="field__label">分段数量</span><span class="field__hint">RADAR-15 · 同时控制雷达色带与底部说明</span>${segment('ratingBandCount', [['5', '5 段'], ['6', '6 段']], state.ratingBandCount)}</div>` : ''}
            ${caps.chordVariant ? `<div class="field"><span class="field__label">方向语义</span><span class="field__hint">CHORD-05/06 · 无向一条带或有向每向一条</span>${segment('chordVariant', [['undirected', '无向'], ['directed', '有向']], state.chordVariant)}</div>` : ''}
            ${caps.chordLabelLayout ? `<div class="field"><span class="field__label">实体标签排列</span><span class="field__hint">CHORD-11 · 沿弧环绕或径向横排</span>${segment('chordLabelLayout', [['arc', '环绕'], ['horizontal', '横排']], state.chordLabelLayout)}</div>` : ''}
            ${caps.axisLabelLayout ? `<div class="field"><span class="field__label">维度标签排列</span><span class="field__hint">RADAR-07/14 · 横排或沿外围圆弧环绕</span>${segment('axisLabelLayout', [['horizontal', '横排'], ['arc', '环绕']], effectiveAxisLabelLayout)}</div>` : ''}
            ${caps.radarEditable ? `<div class="field"><span class="field__label">可调节能力</span><span class="field__hint">RADAR-18 · 开启后使用单系列径向手柄</span>${segment('radarEditable', [['off', '关'], ['on', '开']], effectiveRadarEditable ? 'on' : 'off')}</div>` : ''}
            ${caps.axisValue && !effectiveRadarEditable && effectiveAxisLabelLayout === 'horizontal' ? `<div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">轴标签数值</span><span class="field__hint">RADAR-07 · 名称下方加一行数值；不影响 hover</span></div><label class="switch" aria-label="轴标签数值"><input id="axis-value-switch" type="checkbox"${state.axisValue ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>` : ''}
            ${caps.waterfallColor ? `<div class="field"><span class="field__label">瀑布颜色</span><span class="field__hint">WATERFALL-10 · 统一主色 / 涨跌语义色</span>${segment('waterfallColor', [['primary', '主色'], ['semantic', '语义色']], state.waterfallColor)}</div>` : ''}
            ${caps.dataLabel ? `<div class="field"><span class="field__label">数据标签</span><span class="field__hint">LABEL-05 · 默认 = 各图表自己的规则；强开 = 分组柱 / 堆叠也画</span>${segment('dataLabel', [['auto', '默认'], ['on', '强开']], state.dataLabel)}</div>` : ''}
            ${caps.labelLayout ? `<div class="field"><span class="field__label">标签形态</span><span class="field__hint">PIE-12 · 引线与标签强绑定，故显隐与形态是同一个选择</span>${segment('labelLayout', [['off', '关'], ['outside', '引线'], ['inside', '扇区内']], state.labelLayout)}</div>` : ''}
            ${caps.labelAlign ? `<div class="field"><span class="field__label">标签对齐</span><span class="field__hint">PIE-13 · 仅引线档生效</span>${segment('labelAlign', [['anchor', '就近'], ['column', '成列'], ['edge', '贴边']], state.labelAlign, state.labelLayout !== 'outside')}</div>` : ''}
            ${caps.legend ? `<div class="field"><span class="field__label">图例布局</span><span class="field__hint">PIE-09 · 切到引线时默认拨到上下，可改回</span>${segment('legend', [['right', '左右'], ['bottom', '上下']], state.legend)}</div>` : ''}
            ${caps.legendSelect ? `<div class="field"><span class="field__label">图例点击</span><span class="field__hint">LEGEND-06/14 · 前两档改数据构成，强调档不改、只压不透明度</span>${segment('legendSelect', [['multi', '多选'], ['single', '单选'], ['focus', '强调']], state.legendSelect)}</div>` : ''}
            ${caps.zoom ? `<div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">缩放轴</span><span class="field__hint">DATAZOOM-01..07 · 初始后 65%</span></div><label class="switch" aria-label="缩放轴"><input id="zoom-switch" type="checkbox"${state.zoom ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>` : ''}
            ${caps.axisTitle ? `<div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">轴标题</span><span class="field__hint">AXISTITLE-01..06 · 默认不显示</span></div><label class="switch" aria-label="轴标题"><input id="axis-title-switch" type="checkbox"${state.axisTitle ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>` : ''}
            ${caps.callout ? `<div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">标注</span><span class="field__hint">CALLOUT-01..16 · 默认不显示；环 + 曲线引线 + 说明文字，位置自动避让</span></div><label class="switch" aria-label="标注"><input id="callout-switch" type="checkbox"${state.callout ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>` : ''}
            ${caps.animation ? `<div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">入场动效</span><span class="field__hint">MOTION-01..07 · 默认开 · 仅首次挂载</span></div><label class="switch" aria-label="入场动效"><input id="animation-switch" type="checkbox"${state.animation ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>` : ''}
            ${areaAvailable ? `<div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">主线渐变面积</span><span class="field__hint">非堆叠折线语义配置</span></div><label class="switch" aria-label="主线渐变面积"><input id="area-switch" type="checkbox"${state.area ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>` : ''}
            <button class="button" id="reset-button" type="button">恢复默认配置</button>
          </div>
          <div class="settings__panel" id="logic-panel" hidden>
            <pre class="code-block" id="logic-config">${JSON.stringify(currentConfig(example), null, 2)}</pre>
            <p class="logic-note">${example.logicNote ?? '缩放窗口通过语义参数进入 L2；主题同时控制值 token、behavior 与恒开水印。'}</p>
          </div>
        </aside>
      </div>`;

      const surface = main.querySelector('.stage__surface');
      const stageHost = surface.querySelector('.chart-host');
      const playbackViewport = hasPlayback
        ? example.playback?.viewport?.[state.platform]
        : null;
      if (playbackViewport) {
        applyPlaybackViewport(
          stageHost.closest('.chart-playback-layout'),
          surface,
          playbackViewport,
          '--chart-playback-chart-height',
        );
        stageHost.addEventListener('dv:sankey-layout', (event) => {
          const legendHeight = Number(event.detail?.legendReservedHeight);
          if (!Number.isFinite(legendHeight) || legendHeight <= 0) return;
          stageHost.closest('.chart-playback-layout')?.style.setProperty(
            '--chart-playback-chart-height',
            `${resolvePlaybackCanvasHeight(surface, playbackViewport) + legendHeight}px`,
          );
        });
      }
      mountStage(stageHost, example);
      /* 外壳默认「高度由图表撑开」，用户一旦从右下角拖动就切成「容器说了算」——
         host 转 height:100%，组件的 ResizeObserver 接手重排。与 playground 的卡片同一套。
         判定用右下 18px 热区：resize 手柄本身不派发独立事件，只能靠这个位置推断。 */
      surface.addEventListener('pointerdown', (event) => {
        const rect = surface.getBoundingClientRect();
        if (rect.right - event.clientX <= 18 && rect.bottom - event.clientY <= 18) surface.classList.add('is-resized');
      });
      wireDetail();
    }

    /* 动一个旋钮会把 .detail 整块重建（旋钮之间会互相改显隐与置灰，局部更新反而更难说清），
       于是两个滚动容器的 scrollTop 双双归零——面板底部那几个旋钮点一下就被弹回顶部，
       连点两个就得重新滚两次。这里跨重建把位置接回去。
       ⚠️ 只有 rerenderDetail 该保留：换示例走的是 render()，那时回到顶部才是对的。 */
    function rerenderDetail() {
      const keep = ['.settings', '.detail__main']
        .map((sel) => [sel, main.querySelector(sel)?.scrollTop ?? 0]);
      destroyCharts();
      renderDetail();
      keep.forEach(([sel, top]) => {
        const el = main.querySelector(sel);
        /* 重建后内容可能变矮（某个旋钮档位少了一栏），浏览器会自行夹到可滚范围内 */
        if (el && top) el.scrollTop = top;
      });
    }

    /* 滑杆专用：**只换图表，不重建参数面板**。
       ① 整页重建会在拖动途中把 <input type="range"> 换成新节点，指针当场脱手；
       ② 十来个旋钮每帧重排也没必要。读数与填充条同步走，重绘合并到下一帧。
       动效恒关：这不是「入场」，拖一格重播一次生长会看得人眼晕，
       「入场动效」那个旋钮管的是首次挂载，两者不是一回事。 */
    let detailSliderFrame = 0;
    function remountDetailFromSlider(example) {
      cancelAnimationFrame(detailSliderFrame);
      detailSliderFrame = requestAnimationFrame(() => {
        const host = main.querySelector('.stage__surface .chart-host');
        if (!host) return;
        destroyCharts();
        host.innerHTML = '';
        mountStage(host, example, { animation: false });
        const logicConfig = document.getElementById('logic-config');
        if (logicConfig) logicConfig.textContent = JSON.stringify(currentConfig(example), null, 2);
      });
    }

    function applyDensity(value) {
      const example = state.detail;
      state.density = clampDensity(example, value);
      const slider = main.querySelector('#density-slider');
      const readout = main.querySelector('#density-value');
      const unit = densityUnitOf(example);
      if (readout) readout.textContent = `${state.density} ${unit}`;
      if (slider) {
        const span = Number(slider.max) - Number(slider.min);
        const ratio = span > 0 ? (state.density - Number(slider.min)) / span : 0;
        slider.style.setProperty('--fill', `${ratio * 100}%`);
      }
      const stageDensity = main.querySelector('[data-stage-density]');
      if (stageDensity) stageDensity.textContent = `${state.density} ${unit}`;

      remountDetailFromSlider(example);
    }

    function applySeriesCount(value) {
      const example = state.detail;
      const control = indexSeriesControlOf(example);
      if (!control) return;
      state.seriesCount = clampIndexSeriesCount(example, value);
      const slider = main.querySelector('#series-slider');
      const readout = main.querySelector('#series-value');
      if (readout) readout.textContent = `${state.seriesCount} ${control.unit}`;
      if (slider) {
        const span = Number(slider.max) - Number(slider.min);
        const ratio = span > 0 ? (state.seriesCount - Number(slider.min)) / span : 0;
        slider.style.setProperty('--fill', `${ratio * 100}%`);
      }
      remountDetailFromSlider(example);
    }

    function wireDetail() {
      const densitySlider = document.getElementById('density-slider');
      if (densitySlider) {
        densitySlider.addEventListener('input', (event) => applyDensity(Number(event.target.value)));
        applyDensity(state.density);   /* 首屏把填充条对上当前值 */
      }
      const seriesSlider = document.getElementById('series-slider');
      if (seriesSlider) {
        seriesSlider.addEventListener('input', (event) => applySeriesCount(Number(event.target.value)));
        applySeriesCount(state.seriesCount);
      }
      document.getElementById('zoom-switch')?.addEventListener('change', (event) => {
        state.zoom = event.target.checked;
        rerenderDetail();
      });
      document.getElementById('area-switch')?.addEventListener('change', (event) => {
        state.area = event.target.checked;
        rerenderDetail();
      });
      document.getElementById('axis-title-switch')?.addEventListener('change', (event) => {
        state.axisTitle = event.target.checked;
        rerenderDetail();
      });
      document.getElementById('callout-switch')?.addEventListener('change', (event) => {
        state.callout = event.target.checked;
        rerenderDetail();
      });
      document.getElementById('animation-switch')?.addEventListener('change', (event) => {
        state.animation = event.target.checked;
        rerenderDetail();
      });
      document.getElementById('treemap-image-switch')?.addEventListener('change', (event) => {
        state.treemapImage = event.target.checked;
        rerenderDetail();
      });
      document.getElementById('axis-value-switch')?.addEventListener('change', (event) => {
        state.axisValue = event.target.checked;
        rerenderDetail();
      });
      document.getElementById('reset-button').addEventListener('click', () => {
        Object.assign(state, {
          theme: 'ths', platform: 'pc', mode: 'light', uiDensity: 'standard', density: defaultDensityCountOf(state.detail),
          dataLabel: 'auto', labelLayout: 'off', labelAlign: 'anchor', legend: 'right',
          legendSelect: 'multi',
          treemapColor: 'intensity', treemapImage: false, axisValue: false,
          radarGridShape: 'auto', radarShape: 'auto', radarEditable: 'off', seriesCount: defaultIndexSeriesCountOf(state.detail), ratingStyle: 'gradient', ratingBandCount: '6',
          axisLabelLayout: 'auto', waterfallColor: 'primary',
          chordVariant: 'undirected', chordLabelLayout: 'arc',
          area: false, zoom: false, axisTitle: false, callout: false, animation: true, periodIndex: 0,
        });
        rerenderDetail();
      });
      main.querySelectorAll('[data-segment]').forEach((control) => {
        control.addEventListener('click', (event) => {
          const button = event.target.closest('button');
          if (!button || button.disabled) return;
          const key = control.dataset.segment;
          state[key] = button.dataset.value;
          /* [PIE-09][PIE-12] 切标签形态时把图例方位拨到该形态的建议默认值——
             只改**默认**，用户随后仍可手动改回（映射在 demos/examples.js，两个面共用）。 */
          if (key === 'labelLayout') state.legend = suggestedLegend(state.labelLayout);
          rerenderDetail();
        });
      });
      main.querySelectorAll('.tab__item').forEach((tab) => {
        tab.addEventListener('click', () => {
          main.querySelectorAll('.tab__item').forEach((item) => {
            const active = item === tab;
            item.classList.toggle('tab__item--active', active);
            item.setAttribute('aria-selected', String(active));
          });
          ['settings-panel', 'logic-panel'].forEach((id) => {
            document.getElementById(id).hidden = id !== tab.dataset.panel;
          });
        });
      });
    }

    /* 顶栏两个入口的选中态跟着视图走（index.html 里写死的初始态只对首屏成立） */
    const topnavItems = [...document.querySelectorAll('.topnav__item[data-view]')];
    function syncTopnav() {
      const view = state.spec ? 'spec' : 'examples';
      topnavItems.forEach((a) => a.classList.toggle('topnav__item--active', a.dataset.view === view));
    }

    function render() {
      destroyCharts();
      workspace.classList.toggle('workspace--detail', Boolean(state.detail));
      workspace.classList.toggle('workspace--spec', Boolean(state.spec));
      syncTopnav();
      if (state.spec) {
        renderSpecView(main, categoryNav, state.spec);
        return;
      }
      renderNavigation();
      if (state.detail) renderDetail();
      else renderGallery();
    }

    categoryNav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-group]');
      if (!button) return;
      state.group = button.dataset.group;
      state.detail = null;
      window.history.pushState({}, '', '#all');
      render();
    });
    /* 详情页里搜索**只收窄左侧导航**：不把人踢回画廊，也不逐个按键重挂当前图表
       （renderDetail 会 destroy + 重建，那样打字就是一串闪烁）。画廊里才整页重画。 */
    function applyQuery(value) {
      state.query = value;
      searchClear.classList.toggle('is-visible', Boolean(state.query));
      if (state.detail) renderNavigation();
      else render();
    }
    searchInput.addEventListener('input', (event) => applyQuery(event.target.value));
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.focus();
      applyQuery('');
    });

    /* [快速切换] ←/→ 在当前命中集里前后跳一张。窄屏左栏让位后这条仍在，是唯一不依赖布局的路径。
       输入框内、带修饰键时一律不接管，免得抢走搜索框与浏览器自身的快捷键。 */
    window.addEventListener('keydown', (event) => {
      if (!state.detail || event.metaKey || event.ctrlKey || event.altKey) return;
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      const target = event.target;
      if (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const pool = matchedExamples();
      const index = pool.findIndex((example) => example.id === state.detail.id);
      if (index < 0) return;
      event.preventDefault();
      window.location.hash = `#${pool[(index + step + pool.length) % pool.length].id}`;
    });

    function syncRoute() {
      const id = window.location.hash.slice(1);
      const nextSpec = parseSpecRoute(id);
      if (nextSpec) {
        const samePage = state.spec && state.spec.page === nextSpec.page;
        state.spec = nextSpec;
        state.detail = null;
        /* 同一页内换锚点只滚动，不重取原文、不重画 */
        if (samePage) scrollSpecAnchor(main, nextSpec.anchor);
        else render();
        return;
      }
      const leavingSpec = Boolean(state.spec);
      state.spec = null;
      const nextDetail = EXAMPLES.find((example) => example.id === id) || null;
      if (!leavingSpec && (state.detail?.id || null) === (nextDetail?.id || null)) return;
      state.detail = nextDetail;
      state.density = defaultDensityCountOf(nextDetail);
      state.seriesCount = defaultIndexSeriesCountOf(nextDetail);
      render();
    }

    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    state.spec = parseSpecRoute(window.location.hash.slice(1));
    state.detail = state.spec ? null : EXAMPLES.find((example) => example.id === window.location.hash.slice(1)) || null;
    state.density = defaultDensityCountOf(state.detail);
    state.seriesCount = defaultIndexSeriesCountOf(state.detail);
    render();
