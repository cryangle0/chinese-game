/* Settlement hotspot editor — 1440×810 design space.
 * Expects window.SETTLEMENT_HOTSPOT_SCENE before load. */
(() => {
  const DESIGN_W = 1440;
  const DESIGN_H = 810;
  const scene = window.SETTLEMENT_HOTSPOT_SCENE;
  if (!scene) throw new Error('SETTLEMENT_HOTSPOT_SCENE missing');

  const storageKey = `writing-settlement-hotspots:${scene.id}`;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toCocos(box) {
    return {
      x: +(box.left + box.width / 2 - DESIGN_W / 2).toFixed(2),
      y: +(DESIGN_H / 2 - (box.top + box.height / 2)).toFixed(2),
      width: +Number(box.width).toFixed(2),
      height: +Number(box.height).toFixed(2),
    };
  }

  function loadHotspots() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved?.hotspots) return saved.hotspots;
    } catch {
      /* ignore */
    }
    return clone(scene.defaults);
  }

  let hotspots = loadHotspots();
  let selectedId = hotspots[0]?.id || '';
  let opacity = 100;
  let showGrid = true;
  let cursor = { x: 0, y: 0 };
  let drag = null;

  const root = document.getElementById('root');
  root.innerHTML = `
    <main class="app">
      <section class="workspace">
        <div class="toolbar">
          <strong>${scene.title}</strong>
          <button type="button" id="toggleGrid">网格</button>
          <span class="cursor" id="cursor">X 0 · Y 0</span>
        </div>
        <div class="frame-shell">
          <div class="frame" id="frame">
            <img class="reference" id="reference" alt="" src="${scene.reference}" />
            <div class="grid" id="grid"></div>
            <div class="cross-x"></div>
            <div class="cross-y"></div>
            <div id="layers"></div>
          </div>
        </div>
      </section>
      <aside class="sidebar">
        <div class="panel-title">可编辑热区</div>
        <div class="help">拖动色块移动，拖右下角缩放。坐标基于 1440×810。点「保存导出 JSON」下载文件。</div>
        <label class="control"><span>参考图透明度</span>
          <input id="opacity" type="range" min="20" max="100" value="100" />
        </label>
        <div class="list" id="list"></div>
        <div class="fields" id="fields"></div>
        <div class="actions">
          <button type="button" class="primary" id="save">保存导出 JSON</button>
          <button type="button" class="primary" id="copy">复制 JSON</button>
          <button type="button" id="reset">恢复默认</button>
        </div>
        <pre class="output" id="output"></pre>
      </aside>
    </main>
  `;

  const frame = document.getElementById('frame');
  const layers = document.getElementById('layers');
  const list = document.getElementById('list');
  const fields = document.getElementById('fields');
  const output = document.getElementById('output');
  const cursorEl = document.getElementById('cursor');
  const reference = document.getElementById('reference');
  const grid = document.getElementById('grid');

  function exportValue() {
    const mapped = {};
    hotspots.forEach((item) => {
      mapped[item.id] = {
        label: item.label,
        html: {
          left: +Number(item.left).toFixed(2),
          top: +Number(item.top).toFixed(2),
          width: +Number(item.width).toFixed(2),
          height: +Number(item.height).toFixed(2),
        },
        cocos: toCocos(item),
      };
    });
    return {
      scene: scene.id,
      sceneTitle: scene.sceneTitle,
      design: { width: DESIGN_W, height: DESIGN_H },
      nextLabel: scene.nextLabel,
      hotspots: mapped,
      ordered: hotspots.map((item) => item.id),
    };
  }

  function pointInDesign(event) {
    const rect = frame.getBoundingClientRect();
    return {
      x: Math.round((event.clientX - rect.left) * DESIGN_W / rect.width),
      y: Math.round((event.clientY - rect.top) * DESIGN_H / rect.height),
    };
  }

  function selected() {
    return hotspots.find((item) => item.id === selectedId) || hotspots[0];
  }

  function renderList() {
    list.innerHTML = hotspots.map((item) => `
      <button type="button" class="hotspot-item${item.id === selectedId ? ' active' : ''}" data-id="${item.id}">
        <i style="background:${item.color}"></i>
        <span>${item.label}</span>
      </button>
    `).join('');
  }

  function renderFields() {
    const item = selected();
    if (!item) {
      fields.innerHTML = '';
      return;
    }
    fields.innerHTML = `
      <div class="panel-subtitle">${item.label}</div>
      ${['left', 'top', 'width', 'height'].map((key) => `
        <label class="control">
          <span>${key}</span>
          <input data-key="${key}" type="number" step="0.25" value="${item[key]}" />
        </label>
      `).join('')}
    `;
  }

  function renderLayers() {
    layers.innerHTML = hotspots.map((item) => `
      <div class="hotspot${item.id === selectedId ? ' selected' : ''}"
        data-id="${item.id}"
        style="left:${item.left / DESIGN_W * 100}%;top:${item.top / DESIGN_H * 100}%;width:${item.width / DESIGN_W * 100}%;height:${item.height / DESIGN_H * 100}%;border-color:${item.color};background:${item.color}33">
        <span class="hotspot-label">${item.label}</span>
        <span class="resize" data-resize="1" title="缩放"></span>
      </div>
    `).join('');
  }

  function renderOutput() {
    output.textContent = JSON.stringify(exportValue(), null, 2);
  }

  function render() {
    renderList();
    renderFields();
    renderLayers();
    renderOutput();
    reference.style.opacity = String(opacity / 100);
    grid.style.display = showGrid ? 'block' : 'none';
    document.getElementById('toggleGrid').textContent = showGrid ? '关闭网格' : '显示网格';
  }

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-id]');
    if (!button) return;
    selectedId = button.dataset.id;
    render();
  });

  fields.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.key) return;
    const item = selected();
    if (!item) return;
    item[input.dataset.key] = Number(input.value);
    render();
  });

  layers.addEventListener('pointerdown', (event) => {
    const box = event.target.closest('.hotspot');
    if (!box) return;
    selectedId = box.dataset.id;
    const item = selected();
    const point = pointInDesign(event);
    drag = {
      mode: event.target.dataset.resize ? 'resize' : 'move',
      id: item.id,
      start: point,
      snapshot: { ...item },
    };
    box.setPointerCapture(event.pointerId);
    render();
  });

  frame.addEventListener('pointermove', (event) => {
    cursor = pointInDesign(event);
    cursorEl.textContent = `X ${cursor.x} · Y ${cursor.y}`;
    if (!drag) return;
    const item = hotspots.find((entry) => entry.id === drag.id);
    if (!item) return;
    const point = pointInDesign(event);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    if (drag.mode === 'move') {
      item.left = drag.snapshot.left + dx;
      item.top = drag.snapshot.top + dy;
    } else {
      item.width = Math.max(24, drag.snapshot.width + dx);
      item.height = Math.max(18, drag.snapshot.height + dy);
    }
    renderLayers();
    renderFields();
    renderOutput();
  });

  const endDrag = () => { drag = null; };
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);

  document.getElementById('opacity').addEventListener('input', (event) => {
    opacity = Number(event.target.value);
    reference.style.opacity = String(opacity / 100);
  });
  document.getElementById('toggleGrid').addEventListener('click', () => {
    showGrid = !showGrid;
    render();
  });
  document.getElementById('reset').addEventListener('click', () => {
    hotspots = clone(scene.defaults);
    selectedId = hotspots[0]?.id || '';
    localStorage.removeItem(storageKey);
    render();
  });
  document.getElementById('copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(exportValue(), null, 2));
    const button = document.getElementById('copy');
    button.textContent = '已复制';
    window.setTimeout(() => { button.textContent = '复制 JSON'; }, 1000);
  });
  document.getElementById('save').addEventListener('click', () => {
    const payload = exportValue();
    localStorage.setItem(storageKey, JSON.stringify({ hotspots }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `settlement-hotspots-${scene.id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  render();
})();
