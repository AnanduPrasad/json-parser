let parsedData = null;
let lineCounter = 0;
let showLineNums = true;
let debounceTimer;

// ── Line number toggle ────────────────────────────────────────────────────────

function toggleLineNums() {
  showLineNums = !showLineNums;
  document.body.classList.toggle('hide-lnums', !showLineNums);
  document.getElementById('lnumToggleBtn').classList.toggle('active', showLineNums);
}

// ── Left panel: textarea line numbers ────────────────────────────────────────

function updateLeftLineNums() {
  const ta = document.getElementById('input');
  const gutter = document.getElementById('lineNumsLeft');
  const count = (ta.value.match(/\n/g) || []).length + 1;
  const prev = gutter.children.length;
  if (count === prev) return;
  if (count > prev) {
    for (let i = prev + 1; i <= count; i++) {
      const s = document.createElement('span');
      s.textContent = i;
      gutter.appendChild(s);
    }
  } else {
    while (gutter.children.length > count) gutter.removeChild(gutter.lastChild);
  }
}

function syncLeftScroll() {
  document.getElementById('lineNumsLeft').scrollTop = document.getElementById('input').scrollTop;
}

// ── Auto-parse debounce ───────────────────────────────────────────────────────

function onInput() {
  const ta = document.getElementById('input');
  document.getElementById('charCount').textContent = ta.value.length.toLocaleString() + ' chars';
  updateLeftLineNums();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(parseJSON, 600);
}

// ── Parse ─────────────────────────────────────────────────────────────────────

function parseJSON() {
  const raw = document.getElementById('input').value.trim();
  const dot = document.getElementById('statusDot');
  const err = document.getElementById('errorBar');

  if (!raw) {
    dot.className = 'status-dot';
    err.className = 'error-bar';
    showEmpty();
    return;
  }

  try {
    parsedData = JSON.parse(raw);
    dot.className = 'status-dot ok';
    err.className = 'error-bar';
    computeStats(parsedData);
    renderTree(parsedData);
  } catch (e) {
    dot.className = 'status-dot err';
    err.textContent = '✕ ' + e.message;
    err.className = 'error-bar show';
    showEmpty();
    parsedData = null;
  }
}

function showEmpty() {
  document.getElementById('statsBar').style.display = 'none';
  document.getElementById('treeScroll').innerHTML =
    '<div class="empty-state">' +
      '<div class="empty-icon">{ }</div>' +
      '<p>Paste JSON on the left and click Parse</p>' +
      '<small>Supports objects, arrays, nested structures</small>' +
    '</div>';
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function computeStats(data) {
  let keys = 0, depth = 0, arrays = 0, objects = 0;

  function walk(v, d) {
    if (d > depth) depth = d;
    if (Array.isArray(v)) {
      arrays++;
      v.forEach(i => walk(i, d + 1));
    } else if (v !== null && typeof v === 'object') {
      objects++;
      Object.entries(v).forEach(([, val]) => { keys++; walk(val, d + 1); });
    }
  }

  walk(data, 0);

  const bar = document.getElementById('statsBar');
  bar.style.display = 'flex';
  document.getElementById('statKeys').textContent    = keys.toLocaleString();
  document.getElementById('statDepth').textContent   = depth;
  document.getElementById('statArrays').textContent  = arrays.toLocaleString();
  document.getElementById('statObjects').textContent = objects.toLocaleString();
  const bytes = new Blob([document.getElementById('input').value]).size;
  document.getElementById('statSize').textContent =
    bytes < 1024 ? bytes + 'B' : (bytes / 1024).toFixed(1) + 'KB';
}

// ── Tree render ───────────────────────────────────────────────────────────────

function renderTree(data) {
  lineCounter = 0;
  const scroll = document.getElementById('treeScroll');
  scroll.innerHTML = '';
  scroll.appendChild(buildNode(data, null, '$', 0));
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function makeLine(path) {
  lineCounter++;
  const line = document.createElement('div');
  line.className = 'node-line';
  line.dataset.path = path || '';

  const lnum = document.createElement('span');
  lnum.className = 'lnum';
  lnum.textContent = lineCounter;
  line.appendChild(lnum);

  if (path) {
    line.addEventListener('mouseenter', () => {
      document.getElementById('pathBar').innerHTML = '<span>' + escHtml(path) + '</span>';
    });
  }
  return line;
}

function buildNode(value, key, path, depth) {
  const type = typeOf(value);
  const container = document.createElement('div');
  container.className = 'node';

  const isComplex = type === 'object' || type === 'array';
  const line = makeLine(path);

  const indent = document.createElement('span');
  indent.className = 'indent';
  indent.style.width = (depth * 18) + 'px';
  line.appendChild(indent);

  let closedPreview, tag;

  if (isComplex) {
    const toggle = document.createElement('span');
    toggle.className = 'toggle-btn';
    toggle.textContent = '▾';
    toggle.title = 'Toggle collapse';
    toggle.onclick = e => {
      e.stopPropagation();
      const collapsed = container.classList.toggle('collapsed');
      toggle.textContent = collapsed ? '▸' : '▾';
      closedPreview.style.display = collapsed ? 'inline' : 'none';
      tag.style.display = collapsed ? 'none' : 'inline';
    };
    line.appendChild(toggle);
  } else {
    const spacer = document.createElement('span');
    spacer.style.cssText = 'width:20px;display:inline-block;';
    line.appendChild(spacer);
  }

  if (key !== null) {
    const keyEl = document.createElement('span');
    keyEl.className = 'k';
    keyEl.textContent = JSON.stringify(key);
    line.appendChild(keyEl);
    const colon = document.createElement('span');
    colon.className = 'colon';
    colon.textContent = ': ';
    line.appendChild(colon);
  }

  if (isComplex) {
    const count = type === 'array' ? value.length : Object.keys(value).length;
    const open  = type === 'array' ? '[' : '{';
    const close = type === 'array' ? ']' : '}';

    const openBr = document.createElement('span');
    openBr.className = 'bracket';
    openBr.textContent = open;
    line.appendChild(openBr);

    tag = document.createElement('span');
    tag.className = 'type-tag';
    tag.textContent = count + (type === 'array' ? ' items' : ' keys');
    line.appendChild(tag);

    closedPreview = document.createElement('span');
    closedPreview.className = 'bracket';
    closedPreview.textContent = ' …' + close;
    closedPreview.style.cssText = 'display:none;opacity:0.4;font-size:11px;';
    line.appendChild(closedPreview);

    const copy = document.createElement('span');
    copy.className = 'copy-val';
    copy.textContent = 'copy';
    copy.onclick = e => { e.stopPropagation(); copyToClip(JSON.stringify(value, null, 2)); };
    line.appendChild(copy);

    container.appendChild(line);

    const children = document.createElement('div');
    children.className = 'children';

    if (type === 'array') {
      value.forEach((item, i) =>
        children.appendChild(buildNode(item, i, path + '[' + i + ']', depth + 1)));
    } else {
      Object.entries(value).forEach(([k, v]) =>
        children.appendChild(buildNode(v, k, path + '.' + k, depth + 1)));
    }

    const closeLine = makeLine('');
    const closeIndent = document.createElement('span');
    closeIndent.className = 'indent';
    closeIndent.style.width = (depth * 18) + 'px';
    closeLine.appendChild(closeIndent);
    const spacer2 = document.createElement('span');
    spacer2.style.cssText = 'width:20px;display:inline-block;';
    closeLine.appendChild(spacer2);
    const closeBr = document.createElement('span');
    closeBr.className = 'bracket';
    closeBr.textContent = close;
    closeLine.appendChild(closeBr);

    container.appendChild(children);
    container.appendChild(closeLine);

  } else {
    const valEl = document.createElement('span');
    if      (type === 'string')  { valEl.className = 's';    valEl.textContent = JSON.stringify(value); }
    else if (type === 'number')  { valEl.className = 'n';    valEl.textContent = value; }
    else if (type === 'boolean') { valEl.className = 'b';    valEl.textContent = value; }
    else                         { valEl.className = 'null'; valEl.textContent = 'null'; }
    line.appendChild(valEl);

    const copy = document.createElement('span');
    copy.className = 'copy-val';
    copy.textContent = 'copy';
    copy.onclick = e => { e.stopPropagation(); copyToClip(String(value)); };
    line.appendChild(copy);

    container.appendChild(line);
  }

  return container;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Tree controls ─────────────────────────────────────────────────────────────

function expandAll() {
  document.querySelectorAll('.node.collapsed').forEach(n => {
    n.classList.remove('collapsed');
    const tb = n.querySelector(':scope > .node-line > .toggle-btn');
    if (tb) tb.textContent = '▾';
    const t = n.querySelector(':scope > .node-line > .type-tag');
    if (t) t.style.display = 'inline';
    const preview = n.querySelector(':scope > .node-line > .bracket:last-of-type');
    if (preview && preview.textContent.includes('…')) preview.style.display = 'none';
  });
}

function collapseAll() {
  document.querySelectorAll('.node').forEach(n => {
    if (!n.querySelector(':scope > .children')) return;
    n.classList.add('collapsed');
    const tb = n.querySelector(':scope > .node-line > .toggle-btn');
    if (tb) tb.textContent = '▸';
    const t = n.querySelector(':scope > .node-line > .type-tag');
    if (t) t.style.display = 'none';
    const preview = n.querySelector(':scope > .node-line > .bracket:last-of-type');
    if (preview && preview.textContent.includes('…')) preview.style.display = 'inline';
  });
}

function copyTree() {
  if (!parsedData) return toast('Nothing to copy');
  copyToClip(JSON.stringify(parsedData, null, 2));
}

function copyToClip(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied!'));
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ── Clear / Sample ────────────────────────────────────────────────────────────

function clearAll() {
  document.getElementById('input').value = '';
  document.getElementById('charCount').textContent = '0 chars';
  document.getElementById('statusDot').className = 'status-dot';
  document.getElementById('errorBar').className = 'error-bar';
  document.getElementById('searchInput').value = '';
  parsedData = null;
  updateLeftLineNums();
  showEmpty();
}

function loadSample() {
  const sample = {
    user: {
      id: 1042,
      name: 'Alex Chen',
      email: 'alex@example.com',
      verified: true,
      role: 'admin',
      metadata: {
        created: '2024-01-15',
        lastLogin: '2026-07-07T09:23:41Z',
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: { email: true, push: false, sms: false }
        }
      }
    },
    projects: [
      { id: 'p-001', title: 'Dashboard Redesign', status: 'active',    progress: 78,  tags: ['ui','react','design'] },
      { id: 'p-002', title: 'API Migration',       status: 'pending',   progress: 12,  tags: ['backend','node'] },
      { id: 'p-003', title: 'Mobile App',          status: 'completed', progress: 100, tags: ['ios','android'] }
    ],
    stats: {
      totalTasks: 142,
      completed: 98,
      pending: 31,
      overdue: 13,
      avgCompletionDays: 4.7
    },
    config: null
  };
  const ta = document.getElementById('input');
  ta.value = JSON.stringify(sample, null, 2);
  document.getElementById('charCount').textContent = ta.value.length.toLocaleString() + ' chars';
  updateLeftLineNums();
  parseJSON();
}

// ── Search ────────────────────────────────────────────────────────────────────

function onSearch() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  if (!parsedData) return;
  if (!q) { renderTree(parsedData); return; }

  renderTree(parsedData);

  document.querySelectorAll('.node-line').forEach(line => {
    if (!line.textContent.toLowerCase().includes(q)) return;
    line.classList.add('highlight-path');
    let p = line.closest('.node');
    while (p) {
      p.classList.remove('collapsed');
      const tb = p.querySelector(':scope > .node-line > .toggle-btn');
      if (tb) tb.textContent = '▾';
      p = p.parentElement && p.parentElement.closest('.node');
    }
  });
}

// ── Resize handle ─────────────────────────────────────────────────────────────

(function initResize() {
  const handle    = document.getElementById('resizeHandle');
  const leftPanel = document.getElementById('panelLeft');
  let isResizing  = false;

  handle.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const rect = document.getElementById('main').getBoundingClientRect();
    const w = Math.max(200, Math.min(e.clientX - rect.left, rect.width - 250));
    leftPanel.style.width = w + 'px';
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();