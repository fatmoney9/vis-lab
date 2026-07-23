import { CartesianChart } from '../charts/charts/cartesian/index.js';

const K = (arr) => arr.map((v) => (v == null ? null : v * 1000));
const seq = (n) => Array.from({ length: n }, (_, i) => `${i + 1}`);
const wave = (n, p = 0) => K(Array.from({ length: n }, (_, i) => Math.round(560 + 360 * Math.sin(i * 0.6 + p) + 140 * Math.cos(i * 1.7 + p))));
const signedWave = (n) => {
  const values = wave(n, 0.8).map((v) => v - 500000);
  if (n > 2) values[2] = 0;
  if (n > 4) values[4] = null;
  return values;
};
const posSeries = (n, names) => names.map((name, index) => ({ name, data: wave(n, index * 0.9) }));
const negWave = (n) => wave(n, 2).map((v) => -Math.round(v * 0.4));
const lineWave = (n) => {
  const values = wave(n, 0.4).map((v) => (n > 13 ? v - 500000 : v));
  values[Math.floor(n / 3)] = null;
  return values;
};
const growth = (n) => Array.from({ length: n }, (_, i) => Math.round(12 + 9 * Math.sin(i * 0.5)));

const EXAMPLES = [
  {
    group: '柱状图', id: 'basic', title: '基础柱状图', spec: 'BAR-01 / BAR-03',
    description: '单系列柱状图，覆盖正负值、0 值占位与 null 断口。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '营业收入', data: signedWave(n) }] }),
  },
  {
    group: '柱状图', id: 'grouped3', title: '三系列分组柱', spec: 'BAR-02',
    description: '三系列分组排布，系列颜色固定槽位，隐藏后重新居中。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']) }),
  },
  {
    group: '柱状图', id: 'grouped6', title: '多系列分组柱', spec: 'BAR-02 / COLOR-04',
    description: '六系列场景，用于检查色板循环、图例换行与显隐逻辑。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润', '税费', '研发投入', '现金流']) }),
  },
  {
    group: '堆叠图', id: 'stack', title: '普通堆叠柱', spec: 'BAR-05',
    description: '正值逐段累计，段间直角，仅整根堆叠外端保留主题圆角。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']), stack: 'normal' }),
  },
  {
    group: '堆叠图', id: 'stackNeg', title: '正负堆叠柱', spec: 'BAR-05',
    description: '正值向上累计、负值向下累计，分别闭合。',
    cfg: (n) => ({ categories: seq(n), stack: 'normal', series: [...posSeries(n, ['主营利润', '投资收益']), { name: '净亏损项', data: negWave(n) }] }),
  },
  {
    group: '堆叠图', id: 'percent', title: '归一化堆叠柱', spec: 'BAR-06',
    description: '每个类目归一到 100%，隐藏系列后占比重新计算。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']), stack: 'percent' }),
  },
  {
    group: '折线图', id: 'line', title: '基础折线图', spec: 'LINE-01',
    description: '折线直连，null 处断开；数据点显隐随密度分档。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '指数', data: lineWave(n), type: 'line' }] }),
  },
  {
    group: '折线图', id: 'line-multi', title: '多折线图', spec: 'LINE-01 / COLOR-05',
    description: '主线保持标准线宽，其余线使用多折线细线 token。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['沪深300', '中证500', '创业板指']).map((s) => ({ ...s, type: 'line' })) }),
  },
  {
    group: '折线图', id: 'line-stack', title: '堆叠折线图', spec: 'LINE-01',
    description: '折线沿累计基线绘制，并在折线与基线之间填充同色区域。',
    cfg: (n) => ({ categories: seq(n), stack: 'normal', series: posSeries(n, ['沪深300', '中证500', '创业板指']).map((s) => ({ ...s, type: 'line' })) }),
  },
  {
    group: '组合图', id: 'combo', title: '折柱组合 · 双 Y', spec: 'BAR-07 / SCALE-04',
    description: '柱走主轴、线走副轴，两轴共享网格并保持 0 轴对齐。',
    cfg: (n) => ({ categories: seq(n), series: [
      { name: '营业收入', data: wave(n), type: 'bar', axis: 'primary' },
      { name: '成本', data: wave(n, 0.9), type: 'bar', axis: 'primary' },
      { name: '营收增速', data: growth(n), type: 'line', axis: 'secondary' },
    ] }),
  },
];

const GROUPS = ['全部示例', ...new Set(EXAMPLES.map((item) => item.group))];
const THEMES = [
  { id: 'ths', label: 'THS 同花顺' },
  { id: 'ifind-pc', label: 'iFinD PC' },
  { id: 'ainvest', label: 'Ainvest' },
];
const DENSITY = { few: 4, mid: 16, many: 36 };
const INITIAL_ZOOM = { start: 0.35, end: 1 };
const state = {
  group: '全部示例', query: '', detail: null,
  theme: 'ths', platform: 'pc', mode: 'light', density: 'few',
  area: false, showXSplit: false, zoom: false,
};

/* 详情面板只透出当前图表真实可消费的语义配置；后续能力落地后在此集中开放。 */
function supportsConfig(example, configName) {
  const cfg = example.cfg(4);
  if (configName === 'area') {
    return cfg.stack == null && cfg.series.some((series) => series.type === 'line');
  }
  return true;
}

const main = document.getElementById('main-content');
const workspace = document.getElementById('workspace');
const categoryNav = document.getElementById('category-nav');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
let charts = [];

function destroyCharts() {
  charts.forEach((chart) => chart.destroy());
  charts = [];
}

function filteredExamples() {
  const query = state.query.trim().toLowerCase();
  return EXAMPLES.filter((item) =>
    (state.group === '全部示例' || item.group === state.group)
    && (!query || `${item.title}${item.description}${item.spec}`.toLowerCase().includes(query)));
}

function renderNavigation() {
  categoryNav.innerHTML = GROUPS.map((group) => {
    const count = group === '全部示例' ? EXAMPLES.length : EXAMPLES.filter((item) => item.group === group).length;
    const active = state.group === group ? ' nav-item--active' : '';
    return `<button class="nav-item${active}" type="button" data-group="${group}"><span>${group}</span><span class="nav-item__count">${count}</span></button>`;
  }).join('');
}

function mountChart(host, example, overrides = {}) {
  const n = DENSITY[overrides.density || state.density];
  const cfg = { ...example.cfg(n), platform: overrides.platform || state.platform, showXSplit: overrides.showXSplit ?? state.showXSplit };
  if (overrides.zoom ?? state.zoom) cfg.zoom = { ...INITIAL_ZOOM };
  if (supportsConfig(example, 'area') && (overrides.area ?? state.area)) {
    const mainLine = cfg.series.find((series) => series.type === 'line');
    if (mainLine) mainLine.area = true;
  }
  charts.push(CartesianChart(host, cfg));
  return cfg;
}

function renderGallery() {
  const items = filteredExamples();
  const sections = state.group === '全部示例' && !state.query
    ? [...new Set(items.map((item) => item.group))].map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    : [{ group: state.group === '全部示例' ? '搜索结果' : state.group, items }];

  main.innerHTML = `<div class="gallery">
    <header class="page-head">
      <div class="page-head__copy">
        <h1>图表示例</h1>
        <p>按图表族浏览已验证能力。选择任一示例后，可单独编辑主题、终端、明暗、数据密度与参考线等语义配置。</p>
      </div>
      <span class="page-head__meta">${items.length} 个结果</span>
    </header>
    ${items.length ? sections.map((section) => `<section class="gallery-section">
      <h2 class="section-title">${section.group}</h2>
      <div class="example-grid">${section.items.map((item) => `<a class="example-card" href="#${item.id}" data-id="${item.id}" aria-label="查看${item.title}详情">
        <div class="example-card__preview" data-theme="ths" data-platform="pc" data-mode="light"><div class="chart-host"></div></div>
        <div class="example-card__body"><span class="example-card__title">${item.title}</span><span class="example-card__tag">${item.spec.split(' / ')[0]}</span></div>
      </a>`).join('')}</div>
    </section>`).join('') : '<div class="empty-state">没有匹配的图表示例</div>'}
  </div>`;

  main.querySelectorAll('.example-card').forEach((card) => {
    const item = EXAMPLES.find((example) => example.id === card.dataset.id);
    mountChart(card.querySelector('.chart-host'), item, {
      density: 'few', platform: 'pc', showXSplit: false, area: false, zoom: false,
    });
  });
}

function segment(name, options, value) {
  return `<div class="segment" data-segment="${name}">${options.map(([id, label]) => `<button class="segment__item${value === id ? ' segment__item--active' : ''}" type="button" data-value="${id}">${label}</button>`).join('')}</div>`;
}

function currentConfig(example) {
  const cfg = example.cfg(DENSITY[state.density]);
  return {
    theme: state.theme,
    platform: state.platform,
    mode: state.mode,
    categories: `Array(${cfg.categories.length})`,
    series: cfg.series.map((series) => ({ name: series.name, type: series.type || 'bar', axis: series.axis || 'primary' })),
    stack: cfg.stack || 'none',
    showXSplit: state.showXSplit,
    zoom: state.zoom ? INITIAL_ZOOM : false,
    ...(supportsConfig(example, 'area') ? { area: state.area } : {}),
  };
}

function renderDetail() {
  const example = state.detail;
  const theme = THEMES.find((item) => item.id === state.theme);
  const config = currentConfig(example);
  const supportsArea = supportsConfig(example, 'area');

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
          <span class="spec-chip">${example.spec}</span>
        </div>
      </header>
      <section class="stage">
        <div class="stage__bar"><span class="stage__theme">${theme.label}</span><span class="stage__meta">${state.platform === 'pc' ? 'PC' : '移动端'} · ${state.mode === 'light' ? '浅色' : '深色'} · ${DENSITY[state.density]} 类目</span></div>
        <div class="stage__canvas"><div class="stage__surface" data-theme="${state.theme}" data-platform="${state.platform}" data-mode="${state.mode}"><div class="chart-host"></div></div></div>
      </section>
      <section class="logic-card"><h2>配置边界</h2><p>面板只编辑数据与语义配置。颜色、字号、线宽、圆角和主题形态仍由 token 与 behavior 统一控制，不作为实例样式参数暴露；水印是主题规范的恒开能力，不提供实例开关。</p></section>
    </div>
    <aside class="settings" aria-label="示例配置">
      <div class="tab" role="tablist">
        <div class="tab__list">
          <button class="tab__item tab__item--active" type="button" role="tab" aria-selected="true" data-panel="settings-panel">参数<span class="tab__indicator"></span></button>
          <button class="tab__item" type="button" role="tab" aria-selected="false" data-panel="logic-panel">逻辑<span class="tab__indicator"></span></button>
        </div>
      </div>
      <div class="settings__panel" id="settings-panel">
        <div class="field"><div class="field__row"><div class="field__copy"><label class="field__label" for="theme-select">主题</label><span class="field__hint">data-theme</span></div><select class="select" id="theme-select">${THEMES.map((item) => `<option value="${item.id}"${state.theme === item.id ? ' selected' : ''}>${item.label}</option>`).join('')}</select></div></div>
        <div class="field"><span class="field__label">终端</span><span class="field__hint">参与主题行为解析</span>${segment('platform', [['pc', 'PC'], ['mobile', '移动端']], state.platform)}</div>
        <div class="field"><span class="field__label">明暗</span><span class="field__hint">切换整套颜色 token</span>${segment('mode', [['light', '浅色'], ['dark', '深色']], state.mode)}</div>
        <div class="field"><div class="field__row"><div class="field__copy"><label class="field__label" for="density-select">数据密度</label><span class="field__hint">检查碰撞与点显隐</span></div><select class="select" id="density-select"><option value="few"${state.density === 'few' ? ' selected' : ''}>少 · 4</option><option value="mid"${state.density === 'mid' ? ' selected' : ''}>中 · 16</option><option value="many"${state.density === 'many' ? ' selected' : ''}>多 · 36</option></select></div></div>
        <div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">缩放轴</span><span class="field__hint">DATAZOOM-01..07 · 初始后 65%</span></div><label class="switch" aria-label="缩放轴"><input id="zoom-switch" type="checkbox"${state.zoom ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>
        <div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">X 轴参考线</span><span class="field__hint">GRID-02 · 类目分割线</span></div><label class="switch" aria-label="X 轴参考线"><input id="x-split-switch" type="checkbox"${state.showXSplit ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>
        ${supportsArea ? `<div class="field"><div class="field__row"><div class="field__copy"><span class="field__label">主线渐变面积</span><span class="field__hint">非堆叠折线语义配置</span></div><label class="switch" aria-label="主线渐变面积"><input id="area-switch" type="checkbox"${state.area ? ' checked' : ''}><span class="switch__track"><span class="switch__knob"></span></span></label></div></div>` : ''}
        <button class="button" id="reset-button" type="button">恢复默认配置</button>
      </div>
      <div class="settings__panel" id="logic-panel" hidden>
        <pre class="code-block">${JSON.stringify(config, null, 2)}</pre>
        <p class="logic-note">主题同时控制值 token 与 behavior；参考线和缩放窗口通过语义参数进入 L2，共享 Grid 与 DataZoom 构件负责渲染；水印按主题 behavior 恒开。</p>
      </div>
    </aside>
  </div>`;

  mountChart(main.querySelector('.stage .chart-host'), example);
  wireDetail(example);
}

function rerenderDetail() {
  destroyCharts();
  renderDetail();
}

function wireDetail(example) {
  document.getElementById('theme-select').addEventListener('change', (event) => { state.theme = event.target.value; rerenderDetail(); });
  document.getElementById('density-select').addEventListener('change', (event) => { state.density = event.target.value; rerenderDetail(); });
  document.getElementById('zoom-switch').addEventListener('change', (event) => { state.zoom = event.target.checked; rerenderDetail(); });
  document.getElementById('x-split-switch').addEventListener('change', (event) => { state.showXSplit = event.target.checked; rerenderDetail(); });
  document.getElementById('area-switch')?.addEventListener('change', (event) => { state.area = event.target.checked; rerenderDetail(); });
  document.getElementById('reset-button').addEventListener('click', () => {
    Object.assign(state, {
      theme: 'ths', platform: 'pc', mode: 'light', density: 'few',
      area: false, showXSplit: false, zoom: false,
    });
    rerenderDetail();
  });
  main.querySelectorAll('[data-segment]').forEach((control) => {
    control.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      state[control.dataset.segment] = button.dataset.value;
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
      ['settings-panel', 'logic-panel'].forEach((id) => { document.getElementById(id).hidden = id !== tab.dataset.panel; });
    });
  });
  state.detail = example;
}

function render() {
  destroyCharts();
  workspace.classList.toggle('workspace--detail', Boolean(state.detail));
  renderNavigation();
  if (state.detail) renderDetail(); else renderGallery();
}

categoryNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-group]');
  if (!button) return;
  state.group = button.dataset.group;
  state.detail = null;
  window.history.pushState({}, '', '#all');
  render();
});
searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  searchClear.classList.toggle('is-visible', Boolean(state.query));
  state.detail = null;
  render();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  state.query = '';
  searchClear.classList.remove('is-visible');
  render();
});
function syncRoute() {
  const id = window.location.hash.slice(1);
  const nextDetail = EXAMPLES.find((item) => item.id === id) || null;
  if ((state.detail?.id || null) === (nextDetail?.id || null)) return;
  state.detail = nextDetail;
  render();
}
window.addEventListener('popstate', syncRoute);
window.addEventListener('hashchange', syncRoute);

const initialId = window.location.hash.slice(1);
state.detail = EXAMPLES.find((item) => item.id === initialId) || null;
render();
