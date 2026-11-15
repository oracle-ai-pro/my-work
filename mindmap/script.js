/* My Mindmap — Prestige HQ (Beta)
   Simple UI · advanced core: tree layout, drag, zoom/pan, collapse, colors, multi-map hub
*/

const STORAGE_KEY = 'mywork_mindmaps_v1';
const COLORS = [
    '#1a73e8', '#0d9488', '#7c3aed', '#db2777', '#ea580c',
    '#ca8a04', '#16a34a', '#2563eb', '#4f46e5', '#64748b'
];

const uid = () => 'n_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function defaultRoot(text) {
    return {
        id: uid(),
        text: text || 'Центральная идея',
        color: COLORS[0],
        collapsed: false,
        children: [
            { id: uid(), text: 'Ветка 1', color: COLORS[1], collapsed: false, children: [] },
            { id: uid(), text: 'Ветка 2', color: COLORS[2], collapsed: false, children: [] },
            { id: uid(), text: 'Ветка 3', color: COLORS[3], collapsed: false, children: [] }
        ]
    };
}

function defaultMap(title) {
    return {
        id: 'map_' + Date.now(),
        title: title || 'Новая карта',
        root: defaultRoot(title || 'Центральная идея'),
        camera: { x: 0, y: 0, zoom: 1 },
        updatedAt: Date.now()
    };
}

/* ---------- State ---------- */
let maps = [];
let currentMapId = null;
let selectedId = null;
let layoutCache = new Map(); // id -> {x,y,w,h}
let dragging = null; // { id, startX, startY, ox, oy }
let panning = null;
let spaceDown = false;
let confirmCb = null;
let promptCb = null;

const svg = () => document.getElementById('mind-svg');
const viewport = () => document.getElementById('viewport');
const linksLayer = () => document.getElementById('links-layer');
const nodesLayer = () => document.getElementById('nodes-layer');

function currentMap() {
    return maps.find(m => m.id === currentMapId) || maps[0];
}

function save() {
    try {
        const m = currentMap();
        if (m) m.updatedAt = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ maps, currentMapId }));
        syncRegistry();
    } catch (e) {
        console.warn(e);
    }
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            maps = Array.isArray(data.maps) ? data.maps : [];
            currentMapId = data.currentMapId || (maps[0] && maps[0].id);
        }
    } catch (e) {
        maps = [];
    }
    if (!maps.length) {
        const m = defaultMap('Моя первая карта');
        maps = [m];
        currentMapId = m.id;
        save();
    }
}

function syncRegistry() {
    try {
        let reg = JSON.parse(localStorage.getItem('mywork_registry_v1') || '[]');
        if (!Array.isArray(reg)) reg = [];
        const type = 'mindmap';
        maps.forEach(m => {
            // Prefer stable registry id: mind-<internal> so hub links ?map=mind-… resolve
            const internal = String(m.id);
            const id = internal.startsWith('mind-') || internal.startsWith('mindmap-')
                ? internal
                : ('mind-' + internal.replace(/^map_/, ''));
            const existing = reg.find(p =>
                p && p.type === type && (
                    String(p.id) === id ||
                    String(p.id) === 'mindmap-' + internal ||
                    String(p.legacyId) === internal ||
                    String(p.id) === internal
                )
            );
            if (existing) {
                existing.title = m.title;
                existing.updatedAt = m.updatedAt || Date.now();
                existing.legacyId = m.id;
                existing.id = existing.id || id;
            } else {
                reg.push({
                    id,
                    type,
                    title: m.title,
                    updatedAt: m.updatedAt || Date.now(),
                    legacyId: m.id,
                    legacyKey: STORAGE_KEY
                });
            }
        });
        // remove orphan mindmaps from registry that no longer exist
        const ids = new Set(maps.map(m => m.id));
        reg = reg.filter(p => p.type !== type || ids.has(p.legacyId));
        localStorage.setItem('mywork_registry_v1', JSON.stringify(reg));
    } catch (e) {}
}

/* ---------- Tree helpers ---------- */
function findNode(root, id, parent = null) {
    if (root.id === id) return { node: root, parent };
    for (const ch of root.children || []) {
        const r = findNode(ch, id, root);
        if (r) return r;
    }
    return null;
}

function countNodes(node) {
    let n = 1;
    (node.children || []).forEach(c => { n += countNodes(c); });
    return n;
}

/* ---------- Layout (horizontal mind map) ---------- */
const NODE_H = 36;
const NODE_PAD_X = 16;
const H_GAP = 56;
const V_GAP = 14;

function measureText(text) {
    const t = String(text || '…');
    // approximate width
    return Math.min(260, Math.max(72, 10 + t.length * 8.2));
}

function layoutTree(root) {
    layoutCache = new Map();

    function subtreeHeight(node) {
        if (node.collapsed || !node.children || !node.children.length) return NODE_H;
        let h = 0;
        node.children.forEach((c, i) => {
            h += subtreeHeight(c);
            if (i < node.children.length - 1) h += V_GAP;
        });
        return Math.max(NODE_H, h);
    }

    function place(node, x, yCenter) {
        const w = measureText(node.text) + NODE_PAD_X * 2;
        const h = NODE_H;
        layoutCache.set(node.id, { x, y: yCenter - h / 2, w, h, node });

        if (node.collapsed || !node.children || !node.children.length) return;

        const totalH = subtreeHeight(node);
        let cy = yCenter - totalH / 2;
        node.children.forEach(ch => {
            const chH = subtreeHeight(ch);
            const mid = cy + chH / 2;
            place(ch, x + w + H_GAP, mid);
            cy += chH + V_GAP;
        });
    }

    const rootW = measureText(root.text) + NODE_PAD_X * 2;
    place(root, -rootW / 2, 0);
}

/* ---------- Render ---------- */
function cubicPath(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function render() {
    const map = currentMap();
    if (!map) return;
    layoutTree(map.root);

    const links = linksLayer();
    const nodes = nodesLayer();
    links.innerHTML = '';
    nodes.innerHTML = '';

    function walk(node) {
        const L = layoutCache.get(node.id);
        if (!L) return;

        if (!node.collapsed && node.children) {
            node.children.forEach(ch => {
                const C = layoutCache.get(ch.id);
                if (!C) return;
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('class', 'mm-link');
                path.setAttribute('d', cubicPath(
                    L.x + L.w, L.y + L.h / 2,
                    C.x, C.y + C.h / 2
                ));
                path.style.stroke = ch.color || COLORS[0];
                path.style.opacity = '0.55';
                links.appendChild(path);
                walk(ch);
            });
        }

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'mm-node' + (node.id === map.root.id ? ' root' : '') + (selectedId === node.id ? ' selected' : ''));
        g.setAttribute('data-id', node.id);
        g.setAttribute('transform', `translate(${L.x}, ${L.y})`);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'node-shape');
        rect.setAttribute('width', L.w);
        rect.setAttribute('height', L.h);
        rect.setAttribute('rx', 8);
        rect.setAttribute('ry', 8);
        rect.setAttribute('fill', node.color || COLORS[0]);
        rect.setAttribute('filter', 'url(#node-shadow)');
        g.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'node-text');
        text.setAttribute('x', L.w / 2);
        text.setAttribute('y', L.h / 2 + 1);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.textContent = node.text || '…';
        g.appendChild(text);

        if (node.children && node.children.length) {
            const cg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            cg.setAttribute('class', 'collapse-btn');
            cg.setAttribute('transform', `translate(${L.w - 2}, ${L.h / 2})`);
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('r', 9);
            cg.appendChild(c);
            const ct = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            ct.setAttribute('text-anchor', 'middle');
            ct.setAttribute('dominant-baseline', 'middle');
            ct.setAttribute('y', 1);
            ct.textContent = node.collapsed ? String(node.children.length) : '−';
            cg.appendChild(ct);
            cg.addEventListener('mousedown', e => e.stopPropagation());
            cg.addEventListener('click', e => {
                e.stopPropagation();
                node.collapsed = !node.collapsed;
                save();
                render();
            });
            g.appendChild(cg);
        }

        g.addEventListener('mousedown', onNodePointerDown);
        g.addEventListener('touchstart', onNodePointerDown, { passive: false });
        g.addEventListener('dblclick', e => {
            e.stopPropagation();
            startEdit(node.id);
        });
        g.addEventListener('click', e => {
            e.stopPropagation();
            selectNode(node.id);
        });

        nodes.appendChild(g);
    }

    walk(map.root);
    applyCamera();
    updateTitleUI();
}

function applyCamera() {
    const map = currentMap();
    if (!map) return;
    const { x, y, zoom } = map.camera;
    viewport().setAttribute('transform', `translate(${x}, ${y}) scale(${zoom})`);
    const zl = document.getElementById('zoom-label');
    if (zl) zl.textContent = Math.round(zoom * 100) + '%';
}

function updateTitleUI() {
    const map = currentMap();
    const input = document.getElementById('map-title');
    if (input && map && input !== document.activeElement) {
        input.value = map.title || 'Карта';
        input.readOnly = true;
    }
}

/* ---------- Selection / edit ---------- */
function selectNode(id) {
    selectedId = id;
    render();
}

function startEdit(id) {
    const map = currentMap();
    const found = findNode(map.root, id);
    if (!found) return;
    selectedId = id;
    render();

    const L = layoutCache.get(id);
    if (!L) return;
    const ed = document.getElementById('node-editor');
    const rect = svg().getBoundingClientRect();
    const cam = map.camera;
    const sx = rect.left + cam.x + L.x * cam.zoom;
    const sy = rect.top + cam.y + L.y * cam.zoom;

    ed.classList.remove('hidden');
    ed.value = found.node.text || '';
    ed.style.left = Math.max(8, sx) + 'px';
    ed.style.top = Math.max(8, sy) + 'px';
    ed.style.width = Math.max(120, L.w * cam.zoom) + 'px';
    ed.focus();
    ed.select();

    const finish = (commit) => {
        ed.classList.add('hidden');
        if (commit) {
            found.node.text = ed.value.trim() || found.node.text;
            save();
            render();
        }
        ed.onblur = null;
        ed.onkeydown = null;
    };
    ed.onblur = () => finish(true);
    ed.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    };
}

/* ---------- Mutations ---------- */
function addChild() {
    const map = currentMap();
    const id = selectedId || map.root.id;
    const found = findNode(map.root, id);
    if (!found) return;
    found.node.collapsed = false;
    const child = {
        id: uid(),
        text: 'Новый узел',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        collapsed: false,
        children: []
    };
    found.node.children = found.node.children || [];
    found.node.children.push(child);
    selectedId = child.id;
    save();
    render();
    setTimeout(() => startEdit(child.id), 30);
}

function addSibling() {
    const map = currentMap();
    if (!selectedId || selectedId === map.root.id) {
        addChild();
        return;
    }
    const found = findNode(map.root, selectedId);
    if (!found || !found.parent) return;
    const child = {
        id: uid(),
        text: 'Новый узел',
        color: found.node.color || COLORS[0],
        collapsed: false,
        children: []
    };
    const idx = found.parent.children.findIndex(c => c.id === selectedId);
    found.parent.children.splice(idx + 1, 0, child);
    selectedId = child.id;
    save();
    render();
    setTimeout(() => startEdit(child.id), 30);
}

function deleteSelected() {
    const map = currentMap();
    if (!selectedId || selectedId === map.root.id) return;
    showConfirm('Удалить узел?', 'Узел и все дочерние элементы будут удалены.', () => {
        const found = findNode(map.root, selectedId);
        if (!found || !found.parent) return;
        found.parent.children = found.parent.children.filter(c => c.id !== selectedId);
        selectedId = found.parent.id;
        save();
        render();
    });
}

function toggleCollapseSelected() {
    const map = currentMap();
    const id = selectedId || map.root.id;
    const found = findNode(map.root, id);
    if (!found || !found.node.children || !found.node.children.length) return;
    found.node.collapsed = !found.node.collapsed;
    save();
    render();
}

function setSelectedColor(color) {
    const map = currentMap();
    if (!selectedId) return;
    const found = findNode(map.root, selectedId);
    if (!found) return;
    found.node.color = color;
    save();
    render();
}

/* ---------- Camera ---------- */
function setZoom(z, cx, cy) {
    const map = currentMap();
    const svgEl = svg();
    const rect = svgEl.getBoundingClientRect();
    cx = cx ?? rect.width / 2;
    cy = cy ?? rect.height / 2;
    const prev = map.camera.zoom;
    const next = Math.min(2.5, Math.max(0.25, z));
    // zoom around cursor
    map.camera.x = cx - (cx - map.camera.x) * (next / prev);
    map.camera.y = cy - (cy - map.camera.y) * (next / prev);
    map.camera.zoom = next;
    applyCamera();
    save();
}

function fitView() {
    const map = currentMap();
    if (!layoutCache.size) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    layoutCache.forEach(L => {
        minX = Math.min(minX, L.x);
        minY = Math.min(minY, L.y);
        maxX = Math.max(maxX, L.x + L.w);
        maxY = Math.max(maxY, L.y + L.h);
    });
    const svgEl = svg();
    const rect = svgEl.getBoundingClientRect();
    const pad = 60;
    const w = maxX - minX || 100;
    const h = maxY - minY || 100;
    const zoom = Math.min(1.4, Math.max(0.35, Math.min(
        (rect.width - pad * 2) / w,
        (rect.height - pad * 2) / h
    )));
    map.camera.zoom = zoom;
    map.camera.x = rect.width / 2 - (minX + w / 2) * zoom;
    map.camera.y = rect.height / 2 - (minY + h / 2) * zoom;
    applyCamera();
    save();
}

function centerRoot() {
    const map = currentMap();
    const L = layoutCache.get(map.root.id);
    if (!L) return;
    const rect = svg().getBoundingClientRect();
    map.camera.x = rect.width / 2 - (L.x + L.w / 2) * map.camera.zoom;
    map.camera.y = rect.height / 2 - (L.y + L.h / 2) * map.camera.zoom;
    applyCamera();
    save();
}

/* ---------- Pointer: pan / drag node ---------- */
function clientPoint(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

function onNodePointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    selectNode(id);
    const p = clientPoint(e);
    const L = layoutCache.get(id);
    const map = currentMap();
    dragging = {
        id,
        startX: p.x,
        startY: p.y,
        // visual only offset while dragging (layout is structural — we don't free-position permanently for tree consistency)
        moved: false
    };
    // For tree maps, free drag of individual nodes breaks hierarchy layout.
    // We use drag on empty canvas for pan; node drag starts edit on small move threshold via long-press alternative.
    // Implement: slight drag = pan if on node with space, else select only.
}

function onStagePointerDown(e) {
    if (e.target.closest && e.target.closest('.mm-node')) return;
    hidePalette();
    const p = clientPoint(e);
    const map = currentMap();
    panning = {
        x: p.x,
        y: p.y,
        camX: map.camera.x,
        camY: map.camera.y
    };
    svg().classList.add('panning');
    selectedId = null;
    render();
}

function onPointerMove(e) {
    if (!panning) return;
    e.preventDefault();
    const p = clientPoint(e);
    const map = currentMap();
    map.camera.x = panning.camX + (p.x - panning.x);
    map.camera.y = panning.camY + (p.y - panning.y);
    applyCamera();
}

function onPointerUp() {
    if (panning) {
        panning = null;
        svg().classList.remove('panning');
        save();
    }
    dragging = null;
}

/* ---------- Maps CRUD / Hub ---------- */
function getMapQuery() {
    try {
        const q = new URLSearchParams(location.search);
        const raw = q.get('map') || q.get('mindmap') || q.get('id');
        return raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
    } catch (e) {
        return null;
    }
}

/** Resolve hub registry id / prefixes to internal map id */
function resolveMapId(query) {
    if (!query) return null;
    const q = String(query).trim();

    // 1) exact internal id
    let m = maps.find(x => x && String(x.id) === q);
    if (m) return m.id;

    // 2) strip common hub prefixes: mindmap-, mind-, map-
    const stripped = q.replace(/^(mindmap-|mind-|map-)/i, '');
    m = maps.find(x => x && (String(x.id) === stripped || String(x.id) === 'map_' + stripped || String(x.id) === q));
    if (m) return m.id;

    // match map_${timestamp} when query is mind-TIMESTAMP or mindmap-TIMESTAMP
    m = maps.find(x => {
        if (!x || x.id == null) return false;
        const id = String(x.id);
        return id === stripped || id.endsWith(stripped) || id.replace(/^map_/, '') === stripped;
    });
    if (m) return m.id;

    // 3) registry lookup (mywork_registry_v1)
    try {
        const reg = JSON.parse(localStorage.getItem('mywork_registry_v1') || '[]');
        if (Array.isArray(reg)) {
            for (let i = 0; i < reg.length; i++) {
                const p = reg[i];
                if (!p || (p.type !== 'mindmap' && p.type !== 'map')) continue;
                if (String(p.id) === q || String(p.id) === 'mindmap-' + stripped || String(p.id) === 'mind-' + stripped) {
                    if (p.legacyId) {
                        const byLegacy = maps.find(x => x && String(x.id) === String(p.legacyId));
                        if (byLegacy) return byLegacy.id;
                    }
                    // sometimes registry id embeds map id
                    if (p.legacyId == null && stripped) {
                        const byStrip = maps.find(x => x && (String(x.id) === stripped || String(x.id) === 'map_' + stripped));
                        if (byStrip) return byStrip.id;
                    }
                }
                if (p.legacyId != null && (String(p.legacyId) === q || String(p.legacyId) === stripped)) {
                    const byLegacy = maps.find(x => x && String(x.id) === String(p.legacyId));
                    if (byLegacy) return byLegacy.id;
                }
            }
        }
    } catch (e) {}

    // 4) numeric index into maps array
    const n = parseInt(q, 10);
    if (!isNaN(n) && String(n) === q && n >= 0 && n < maps.length) {
        return maps[n].id;
    }

    return null;
}

function openMap(id) {
    const resolved = resolveMapId(id) || id;
    if (!maps.some(m => m.id === resolved)) return;
    id = resolved;
    currentMapId = id;
    selectedId = null;
    try {
        const u = new URL(location.href);
        u.searchParams.set('map', id);
        history.replaceState(null, '', u.toString());
    } catch (e) {}
    hidePicker();
    save();
    render();
    requestAnimationFrame(fitView);
}

function showPicker() {
    document.getElementById('picker-screen').classList.remove('hidden');
    renderPicker();
}

function hidePicker() {
    document.getElementById('picker-screen').classList.add('hidden');
}

function renderPicker() {
    const list = document.getElementById('picker-list');
    list.innerHTML = '';
    if (!maps.length) {
        list.innerHTML = '<p style="text-align:center;color:var(--muted);padding:24px;">Нет карт</p>';
        return;
    }
    const sorted = [...maps].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    sorted.forEach(m => {
        const row = document.createElement('div');
        row.className = 'picker-item';
        const n = countNodes(m.root);
        row.innerHTML =
            `<div class="pi-icon"><span class="material-symbols-rounded">account_tree</span></div>
             <div class="pi-meta"><div class="pi-title"></div><div class="pi-sub"></div></div>
             <div class="pi-actions">
                <button type="button" class="pi-ren" title="Переименовать"><span class="material-symbols-rounded">edit</span></button>
                <button type="button" class="pi-del danger" title="Удалить"><span class="material-symbols-rounded">delete</span></button>
             </div>`;
        row.querySelector('.pi-title').textContent = m.title || 'Карта';
        row.querySelector('.pi-sub').textContent = n + ' узлов · ' + new Date(m.updatedAt || Date.now()).toLocaleString();
        row.addEventListener('click', e => {
            if (e.target.closest('.pi-actions')) return;
            openMap(m.id);
        });
        row.querySelector('.pi-ren').onclick = e => {
            e.stopPropagation();
            showPrompt('Название карты', m.title || '', val => {
                if (!val || !val.trim()) return;
                m.title = val.trim();
                save();
                renderPicker();
                updateTitleUI();
            });
        };
        row.querySelector('.pi-del').onclick = e => {
            e.stopPropagation();
            if (maps.length <= 1) {
                alertLike('Нельзя удалить единственную карту');
                return;
            }
            showConfirm('Удалить карту?', '«' + (m.title || 'Карта') + '» будет удалена.', () => {
                maps = maps.filter(x => x.id !== m.id);
                if (currentMapId === m.id) currentMapId = maps[0].id;
                save();
                renderPicker();
            });
        };
        list.appendChild(row);
    });
}

function createMap() {
    showPrompt('Новая карта', 'Новая карта', val => {
        const title = (val && val.trim()) || 'Новая карта';
        const m = defaultMap(title);
        m.root.text = title;
        maps.unshift(m);
        save();
        openMap(m.id);
    });
}

function exportMap() {
    const map = currentMap();
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ((map.title || 'mindmap') + '.json').replace(/[^\wа-яА-ЯёЁ\- .]+/g, '_');
    a.click();
}

function importMap(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data.root) throw new Error('Нет root');
            data.id = data.id || ('map_' + Date.now());
            data.title = data.title || 'Импорт';
            data.updatedAt = Date.now();
            data.camera = data.camera || { x: 0, y: 0, zoom: 1 };
            maps.unshift(data);
            save();
            openMap(data.id);
        } catch (e) {
            alertLike('Не удалось импортировать файл');
        }
    };
    reader.readAsText(file);
}

/* ---------- Modals ---------- */
function showConfirm(title, text, onOk) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    document.getElementById('confirm-modal').classList.remove('hidden');
    confirmCb = onOk;
}
function hideConfirm() {
    document.getElementById('confirm-modal').classList.add('hidden');
    confirmCb = null;
}
function showPrompt(title, value, cb) {
    document.getElementById('prompt-title').textContent = title;
    const input = document.getElementById('prompt-input');
    input.value = value || '';
    document.getElementById('prompt-modal').classList.remove('hidden');
    promptCb = cb;
    setTimeout(() => { input.focus(); input.select(); }, 50);
}
function hidePrompt(commit) {
    const input = document.getElementById('prompt-input');
    document.getElementById('prompt-modal').classList.add('hidden');
    if (commit && promptCb) promptCb(input.value);
    promptCb = null;
}
function alertLike(msg) {
    showConfirm('Сообщение', msg, () => {});
    document.getElementById('confirm-ok').textContent = 'OK';
    document.getElementById('confirm-ok').className = 'btn btn-primary';
}

/* ---------- Palette ---------- */
function showPalette(anchorBtn) {
    const pal = document.getElementById('color-palette');
    if (!selectedId) {
        alertLike('Сначала выберите узел');
        return;
    }
    pal.innerHTML = '';
    COLORS.forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.background = c;
        b.onclick = () => {
            setSelectedColor(c);
            hidePalette();
        };
        pal.appendChild(b);
    });
    const rect = anchorBtn.getBoundingClientRect();
    pal.classList.remove('hidden');
    pal.style.left = Math.min(window.innerWidth - 200, rect.left) + 'px';
    pal.style.top = (rect.bottom + 6) + 'px';
}
function hidePalette() {
    document.getElementById('color-palette').classList.add('hidden');
}

/* ---------- Theme ---------- */
function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('mindmap_theme', next);
    const icon = document.querySelector('#btn-theme .material-symbols-rounded');
    if (icon) icon.textContent = next === 'dark' ? 'dark_mode' : 'light_mode';
}

/* ---------- Init ---------- */
function initHubRouting() {
    const q = getMapQuery();
    if (q) {
        const resolved = resolveMapId(q);
        if (resolved) {
            currentMapId = resolved;
            try {
                const u = new URL(location.href);
                // normalize URL to internal id so reloads are stable
                u.searchParams.set('map', resolved);
                history.replaceState(null, '', u.toString());
            } catch (e) {}
            hidePicker();
            return { picker: false };
        }
        console.warn('[mindmap] ?map= not found:', q, 'maps:', maps.map(m => m.id));
    }
    // without param → picker
    showPicker();
    return { picker: true };
}

function bindUI() {
    document.getElementById('btn-add-child').onclick = addChild;
    document.getElementById('btn-add-sibling').onclick = addSibling;
    document.getElementById('btn-delete').onclick = deleteSelected;
    document.getElementById('btn-collapse').onclick = toggleCollapseSelected;
    document.getElementById('btn-fit').onclick = fitView;
    document.getElementById('btn-center').onclick = centerRoot;
    document.getElementById('btn-new-map').onclick = createMap;
    document.getElementById('btn-maps').onclick = showPicker;
    document.getElementById('picker-new').onclick = createMap;
    document.getElementById('btn-export').onclick = exportMap;
    document.getElementById('btn-import').onclick = () => document.getElementById('import-file').click();
    document.getElementById('import-file').onchange = e => {
        const f = e.target.files && e.target.files[0];
        if (f) importMap(f);
        e.target.value = '';
    };
    document.getElementById('btn-theme').onclick = toggleTheme;
    document.getElementById('btn-color').onclick = (e) => showPalette(e.currentTarget);
    document.getElementById('zoom-in').onclick = () => setZoom(currentMap().camera.zoom * 1.15);
    document.getElementById('zoom-out').onclick = () => setZoom(currentMap().camera.zoom / 1.15);

    document.getElementById('confirm-cancel').onclick = hideConfirm;
    document.getElementById('confirm-close').onclick = hideConfirm;
    document.getElementById('confirm-ok').onclick = () => {
        const cb = confirmCb;
        hideConfirm();
        document.getElementById('confirm-ok').textContent = 'Удалить';
        document.getElementById('confirm-ok').className = 'btn btn-danger';
        if (cb) cb();
    };
    document.getElementById('prompt-cancel').onclick = () => hidePrompt(false);
    document.getElementById('prompt-ok').onclick = () => hidePrompt(true);
    document.getElementById('prompt-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') hidePrompt(true);
        if (e.key === 'Escape') hidePrompt(false);
    });

    const title = document.getElementById('map-title');
    title.addEventListener('click', () => {
        if (title.readOnly) {
            title.readOnly = false;
            title.focus();
            title.select();
        }
    });
    title.addEventListener('blur', () => {
        const map = currentMap();
        if (!title.readOnly && map) {
            const v = title.value.trim();
            if (v) map.title = v;
            title.readOnly = true;
            save();
            updateTitleUI();
        }
    });
    title.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
        if (e.key === 'Escape') { title.readOnly = true; updateTitleUI(); title.blur(); }
    });

    const stage = document.getElementById('stage-wrap');
    stage.addEventListener('mousedown', onStagePointerDown);
    stage.addEventListener('touchstart', onStagePointerDown, { passive: false });
    window.addEventListener('mousemove', onPointerMove, { passive: false });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    stage.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = svg().getBoundingClientRect();
        const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
        setZoom(currentMap().camera.zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    // pinch zoom
    let pinch = null;
    stage.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            pinch = { dist: d, zoom: currentMap().camera.zoom };
        }
    }, { passive: false });
    stage.addEventListener('touchmove', e => {
        if (pinch && e.touches.length === 2) {
            e.preventDefault();
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setZoom(pinch.zoom * (d / pinch.dist));
        }
    }, { passive: false });
    stage.addEventListener('touchend', () => { pinch = null; });

    window.addEventListener('keydown', e => {
        if (e.target.matches('input, textarea')) return;
        if (e.key === 'Tab') { e.preventDefault(); addChild(); }
        else if (e.key === 'Enter') { e.preventDefault(); addSibling(); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
        else if (e.key === 'F2') { e.preventDefault(); if (selectedId) startEdit(selectedId); }
        else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
        else if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); fitView(); }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('mindmap_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.querySelector('#btn-theme .material-symbols-rounded');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';

    load();
    bindUI();
    const route = initHubRouting();
    if (!route.picker) {
        render();
        requestAnimationFrame(fitView);
    }
});
