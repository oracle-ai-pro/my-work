/* My Spreadsheets — multi-table + range + fill */
const STORAGE_KEY = 'my_sheets_v2';
const OFFLINE_KEY = 'my_sheets_offline_flag';
const DEFAULT_ROWS = 40;
const DEFAULT_COLS = 20;

let store = { tables: [] };
let currentTable = 0;
let currentSheet = 0;
let selected = { r: 0, c: 0 };
let rangeEnd = { r: 0, c: 0 }; // selection range
let isDragging = false;
let editing = false;
let autosave = true;
let ctxTableIndex = null;
let ctxSheetIndex = null;
let ctxCell = null;
let promptCallback = null;
let confirmCallback = null;

function colName(i) {
    let s = '';
    i += 1;
    while (i > 0) {
        const m = (i - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        i = Math.floor((i - 1) / 26);
    }
    return s;
}
function cellKey(r, c) { return colName(c) + (r + 1); }
function colToIndex(col) {
    col = String(col).toUpperCase();
    let n = 0;
    for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
    return n - 1;
}

function emptySheet(name) {
    return { id: Date.now() + Math.random(), name: name || 'Лист 1', rows: DEFAULT_ROWS, cols: DEFAULT_COLS, cells: {} };
}
function emptyTable(name) {
    return { id: Date.now() + Math.random(), name: name || 'Таблица 1', sheets: [emptySheet('Лист 1')] };
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            store = JSON.parse(raw);
            if (!store.tables || !store.tables.length) store.tables = [emptyTable()];
        } else {
            // migrate v1
            const old = localStorage.getItem('my_sheets_v1');
            if (old) {
                const wb = JSON.parse(old);
                store = { tables: [{ id: Date.now(), name: 'Таблица 1', sheets: (wb.sheets || [emptySheet()]).map(function(s) {
                    return { id: s.id || Date.now(), name: s.name || 'Лист', rows: s.rows || DEFAULT_ROWS, cols: s.cols || DEFAULT_COLS, cells: s.cells || {} };
                }) }] };
            } else {
                store = { tables: [emptyTable('Таблица 1')] };
            }
            save();
        }
        store.tables.forEach(function(t) {
            if (!t.sheets || !t.sheets.length) t.sheets = [emptySheet()];
            t.sheets.forEach(function(s) {
                if (!s.rows) s.rows = DEFAULT_ROWS;
                if (!s.cols) s.cols = DEFAULT_COLS;
                if (!s.cells) s.cells = {};
            });
        });
    } catch (e) {
        store = { tables: [emptyTable('Таблица 1')] };
    }
    autosave = localStorage.getItem('sheets_autosave') !== 'false';
}

function save() {
    if (!autosave) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    if (!navigator.onLine) localStorage.setItem(OFFLINE_KEY, String(Date.now()));
    updateOnlineUI();
}

function table() { return store.tables[currentTable]; }
function sheet() { return table().sheets[currentSheet]; }
function maxRows() { return sheet().rows || DEFAULT_ROWS; }
function maxCols() { return sheet().cols || DEFAULT_COLS; }

function getCell(r, c) { return sheet().cells[cellKey(r, c)] || null; }

function ensureCell(r, c) {
    const k = cellKey(r, c);
    if (!sheet().cells[k]) sheet().cells[k] = { v: '' };
    return sheet().cells[k];
}

function setCell(r, c, value, formula) {
    const k = cellKey(r, c);
    const existing = sheet().cells[k] || {};
    const v = String(value == null ? '' : value);
    if (!v && !formula && !existing.bg && !existing.bold) {
        delete sheet().cells[k];
    } else {
        const cell = { v: v };
        if (formula) cell.f = formula;
        if (existing.bg) cell.bg = existing.bg;
        if (existing.bold) cell.bold = true;
        sheet().cells[k] = cell;
    }
    save();
}

function setCellStyle(r, c, style) {
    const cell = ensureCell(r, c);
    if (style.bg !== undefined) {
        if (style.bg) cell.bg = style.bg;
        else delete cell.bg;
    }
    if (style.bold !== undefined) {
        if (style.bold) cell.bold = true;
        else delete cell.bold;
    }
    if (style.borders !== undefined) {
        if (style.borders && (style.borders.t || style.borders.b || style.borders.l || style.borders.r)) {
            cell.borders = {
                t: !!style.borders.t,
                b: !!style.borders.b,
                l: !!style.borders.l,
                r: !!style.borders.r
            };
        } else {
            delete cell.borders;
        }
    }
    if (!cell.v && !cell.f && !cell.bg && !cell.bold && !cell.borders) {
        delete sheet().cells[cellKey(r, c)];
    }
    save();
}

function borderClass(cell) {
    if (!cell || !cell.borders) return '';
    var s = '';
    if (cell.borders.t) s += ' b-t';
    if (cell.borders.b) s += ' b-b';
    if (cell.borders.l) s += ' b-l';
    if (cell.borders.r) s += ' b-r';
    return s;
}

function applyBorderMode(mode) {
    var b = rangeBounds();
    forEachInRange(function(r, c) {
        var borders = { t: false, b: false, l: false, r: false };
        if (mode === 'none') {
            setCellStyle(r, c, { borders: null });
            return;
        }
        if (mode === 'all') {
            borders = { t: true, b: true, l: true, r: true };
        } else if (mode === 'outer') {
            borders.t = (r === b.r1);
            borders.b = (r === b.r2);
            borders.l = (c === b.c1);
            borders.r = (c === b.c2);
        } else if (mode === 'top') borders.t = true;
        else if (mode === 'bottom') borders.b = true;
        else if (mode === 'left') borders.l = true;
        else if (mode === 'right') borders.r = true;
        else if (mode === 'horizontal') { borders.t = true; borders.b = true; }
        else if (mode === 'vertical') { borders.l = true; borders.r = true; }
        // merge with existing for single-side modes
        if (['top','bottom','left','right'].indexOf(mode) >= 0) {
            var existing = getCell(r, c);
            var prev = (existing && existing.borders) ? existing.borders : { t:false,b:false,l:false,r:false };
            borders = {
                t: mode === 'top' ? true : prev.t,
                b: mode === 'bottom' ? true : prev.b,
                l: mode === 'left' ? true : prev.l,
                r: mode === 'right' ? true : prev.r
            };
        }
        setCellStyle(r, c, { borders: borders });
    });
    document.getElementById('border-picker').classList.add('hidden');
    renderGrid();
}

function toggleBorderPicker() {
    document.getElementById('fill-picker').classList.add('hidden');
    document.getElementById('border-picker').classList.toggle('hidden');
}

/* Range helpers */
function rangeBounds() {
    return {
        r1: Math.min(selected.r, rangeEnd.r),
        r2: Math.max(selected.r, rangeEnd.r),
        c1: Math.min(selected.c, rangeEnd.c),
        c2: Math.max(selected.c, rangeEnd.c)
    };
}
function forEachInRange(fn) {
    const b = rangeBounds();
    for (let r = b.r1; r <= b.r2; r++) {
        for (let c = b.c1; c <= b.c2; c++) fn(r, c);
    }
}
function rangeLabel() {
    const b = rangeBounds();
    if (b.r1 === b.r2 && b.c1 === b.c2) return cellKey(b.r1, b.c1);
    return cellKey(b.r1, b.c1) + ':' + cellKey(b.r2, b.c2);
}

/* Formulas */
function evalCell(r, c, stack) {
    const cell = getCell(r, c);
    if (!cell) return '';
    if (!cell.f) return cell.v || '';
    const key = cellKey(r, c);
    stack = stack || new Set();
    if (stack.has(key)) return '#CYCLE!';
    stack.add(key);
    try { return String(evalFormula(cell.f, stack)); }
    catch (e) { return '#ERR!'; }
}
function evalFormula(f, stack) {
    let expr = String(f).trim();
    if (expr.startsWith('=')) expr = expr.slice(1);
    expr = expr.replace(/SUM\(([^)]+)\)/gi, function(_, args) {
        let total = 0;
        args.split(',').forEach(function(p) {
            p = p.trim();
            if (p.indexOf(':') >= 0) rangeValues(p, stack).forEach(function(n) { total += n; });
            else total += num(refValue(p, stack));
        });
        return String(total);
    });
    expr = expr.replace(/\b([A-Z]+)(\d+)\b/gi, function(_, col, row) {
        return String(num(evalCell(parseInt(row, 10) - 1, colToIndex(col), stack)));
    });
    if (!/^[\d\s+\-*/().]+$/.test(expr)) throw new Error('bad');
    return Function('"use strict"; return (' + expr + ')')();
}
function num(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}
function refValue(ref, stack) {
    const m = String(ref).trim().match(/^([A-Z]+)(\d+)$/i);
    if (!m) return 0;
    return evalCell(parseInt(m[2], 10) - 1, colToIndex(m[1]), stack);
}
function rangeValues(range, stack) {
    const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
    if (!m) return [];
    const c1 = colToIndex(m[1]), r1 = parseInt(m[2], 10) - 1;
    const c2 = colToIndex(m[3]), r2 = parseInt(m[4], 10) - 1;
    const out = [];
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
            out.push(num(evalCell(r, c, stack)));
    return out;
}

/* Structure ops */
function remapCells(mapper) {
    const old = sheet().cells;
    const next = {};
    Object.keys(old).forEach(function(k) {
        const m = k.match(/^([A-Z]+)(\d+)$/i);
        if (!m) return;
        const mapped = mapper(parseInt(m[2], 10) - 1, colToIndex(m[1]), old[k]);
        if (mapped) next[cellKey(mapped.r, mapped.c)] = mapped.cell;
    });
    sheet().cells = next;
}
function insertRowAt(at) {
    remapCells(function(r, c, cell) {
        return r >= at ? { r: r + 1, c: c, cell: cell } : { r: r, c: c, cell: cell };
    });
    sheet().rows = maxRows() + 1;
    if (selected.r >= at) selected.r++;
    if (rangeEnd.r >= at) rangeEnd.r++;
    save(); renderGrid();
}
function insertColAt(at) {
    remapCells(function(r, c, cell) {
        return c >= at ? { r: r, c: c + 1, cell: cell } : { r: r, c: c, cell: cell };
    });
    sheet().cols = maxCols() + 1;
    if (selected.c >= at) selected.c++;
    if (rangeEnd.c >= at) rangeEnd.c++;
    save(); renderGrid();
}
function deleteRowAt(at) {
    if (maxRows() <= 1) { showAlert('Нельзя удалить последнюю строку'); return; }
    remapCells(function(r, c, cell) {
        if (r === at) return null;
        return r > at ? { r: r - 1, c: c, cell: cell } : { r: r, c: c, cell: cell };
    });
    sheet().rows = Math.max(1, maxRows() - 1);
    selected.r = Math.min(selected.r, maxRows() - 1);
    rangeEnd = { r: selected.r, c: selected.c };
    save(); renderGrid();
}
function deleteColAt(at) {
    if (maxCols() <= 1) { showAlert('Нельзя удалить последний столбец'); return; }
    remapCells(function(r, c, cell) {
        if (c === at) return null;
        return c > at ? { r: r, c: c - 1, cell: cell } : { r: r, c: c, cell: cell };
    });
    sheet().cols = Math.max(1, maxCols() - 1);
    selected.c = Math.min(selected.c, maxCols() - 1);
    rangeEnd = { r: selected.r, c: selected.c };
    save(); renderGrid();
}
function addRows(n) { sheet().rows = maxRows() + (n || 40); save(); renderGrid(); }
function addColumns(n) { sheet().cols = maxCols() + (n || 40); save(); renderGrid(); }

/* Tables */
function renderTableTabs() {
    const el = document.getElementById('table-tabs');
    el.innerHTML = '';
    store.tables.forEach(function(t, i) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'table-tab' + (i === currentTable ? ' active' : '');
        b.textContent = t.name;
        b.onclick = function() { switchTable(i); };
        b.oncontextmenu = function(e) {
            e.preventDefault(); e.stopPropagation();
            showTableCtx(e, i);
        };
        el.appendChild(b);
    });
}
function switchTable(i) {
    if (editing) commitEdit();
    currentTable = i;
    currentSheet = 0;
    selected = { r: 0, c: 0 };
    rangeEnd = { r: 0, c: 0 };
    renderTableTabs();
    renderSheetTabs();
    renderGrid();
}
function addTable() {
    const n = store.tables.length + 1;
    store.tables.push(emptyTable('Таблица ' + n));
    currentTable = store.tables.length - 1;
    currentSheet = 0;
    save();
    renderTableTabs();
    renderSheetTabs();
    renderGrid();
}
function renameTableAt(i) {
    if (i == null || !store.tables[i]) return;
    showPrompt('Имя таблицы', store.tables[i].name, function(val) {
        if (val && val.trim()) {
            store.tables[i].name = val.trim();
            save(); renderTableTabs();
        }
    });
}
function deleteTableAt(i) {
    if (i == null || !store.tables[i]) return;
    if (store.tables.length <= 1) { showAlert('Нельзя удалить единственную таблицу'); return; }
    showConfirm('Удалить таблицу?', '«' + store.tables[i].name + '» и все её листы будут удалены.', function() {
        store.tables.splice(i, 1);
        if (currentTable >= store.tables.length) currentTable = store.tables.length - 1;
        currentSheet = 0;
        save(); renderTableTabs(); renderSheetTabs(); renderGrid();
    });
}

/* Sheets */
function renderSheetTabs() {
    const el = document.getElementById('sheet-tabs');
    el.innerHTML = '';
    table().sheets.forEach(function(s, i) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sheet-tab' + (i === currentSheet ? ' active' : '');
        b.textContent = s.name;
        b.onclick = function() { switchSheet(i); };
        b.oncontextmenu = function(e) {
            e.preventDefault(); e.stopPropagation();
            showSheetCtx(e, i);
        };
        el.appendChild(b);
    });
}
function switchSheet(i) {
    if (editing) commitEdit();
    currentSheet = i;
    selected = { r: 0, c: 0 };
    rangeEnd = { r: 0, c: 0 };
    renderSheetTabs();
    renderGrid();
}
function addSheet() {
    const n = table().sheets.length + 1;
    table().sheets.push(emptySheet('Лист ' + n));
    currentSheet = table().sheets.length - 1;
    save(); renderSheetTabs(); renderGrid();
}
function renameSheetAt(i) {
    if (i == null || !table().sheets[i]) return;
    showPrompt('Имя листа', table().sheets[i].name, function(val) {
        if (val && val.trim()) {
            table().sheets[i].name = val.trim();
            save(); renderSheetTabs(); renderGrid();
        }
    });
}
function deleteSheetAt(i) {
    if (i == null || !table().sheets[i]) return;
    if (table().sheets.length <= 1) { showAlert('Нельзя удалить единственный лист'); return; }
    showConfirm('Удалить лист?', '«' + table().sheets[i].name + '» будет удалён.', function() {
        table().sheets.splice(i, 1);
        if (currentSheet >= table().sheets.length) currentSheet = table().sheets.length - 1;
        save(); renderSheetTabs(); renderGrid();
    });
}

/* Grid render */
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function(ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
}

function renderGrid() {
    const thead = document.getElementById('sheet-thead');
    const tbody = document.getElementById('sheet-tbody');
    const rows = maxRows(), cols = maxCols();
    const b = rangeBounds();

    let head = '<tr><th class="corner"></th>';
    for (let c = 0; c < cols; c++) head += '<th data-col="' + c + '">' + colName(c) + '</th>';
    head += '</tr>';
    thead.innerHTML = head;

    let body = '';
    for (let r = 0; r < rows; r++) {
        body += '<tr><th data-row="' + r + '">' + (r + 1) + '</th>';
        for (let c = 0; c < cols; c++) {
            const cell = getCell(r, c);
            const isSel = (selected.r === r && selected.c === c);
            const inRange = r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2;
            let cls = '';
            if (isSel) cls += ' selected';
            if (inRange && !(b.r1 === b.r2 && b.c1 === b.c2)) cls += ' in-range';
            if (cell && cell.bold) cls += ' bold';
            cls += borderClass(cell);
            const style = (cell && cell.bg) ? ' style="background:' + escapeHtml(cell.bg) + '"' : '';
            const display = escapeHtml(String(evalCell(r, c)));
            body += '<td class="' + cls.trim() + '" data-r="' + r + '" data-c="' + c + '"' + style + '>' + display + '</td>';
        }
        body += '</tr>';
    }
    tbody.innerHTML = body;

    tbody.querySelectorAll('td').forEach(function(td) {
        const r = parseInt(td.dataset.r, 10), c = parseInt(td.dataset.c, 10);
        td.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            if (editing) commitEdit();
            isDragging = true;
            selected = { r: r, c: c };
            rangeEnd = { r: r, c: c };
            updateSelectionUI();
            syncFormulaBar();
        });
        td.addEventListener('mouseenter', function() {
            if (!isDragging) return;
            rangeEnd = { r: r, c: c };
            updateSelectionUI();
            syncFormulaBar();
        });
        td.addEventListener('dblclick', function() { startEdit(r, c); });
        td.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            if (!(r >= rangeBounds().r1 && r <= rangeBounds().r2 && c >= rangeBounds().c1 && c <= rangeBounds().c2)) {
                selected = { r: r, c: c };
                rangeEnd = { r: r, c: c };
                updateSelectionUI();
            }
            showCellCtx(e, r, c);
        });
    });

    tbody.querySelectorAll('th[data-row]').forEach(function(th) {
        th.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            const r = parseInt(th.dataset.row, 10);
            selected = { r: r, c: selected.c };
            rangeEnd = { r: r, c: selected.c };
            showCellCtx(e, r, selected.c);
        });
    });
    thead.querySelectorAll('th[data-col]').forEach(function(th) {
        th.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            const c = parseInt(th.dataset.col, 10);
            selected = { r: selected.r, c: c };
            rangeEnd = { r: selected.r, c: c };
            showCellCtx(e, selected.r, c);
        });
    });

    syncFormulaBar();
    document.getElementById('status-text').textContent =
        table().name + ' / ' + sheet().name + ' · ' + Object.keys(sheet().cells).length + ' яч. · ' + rows + '×' + cols;
}

function updateSelectionUI() {
    const b = rangeBounds();
    document.querySelectorAll('.sheet-table td').forEach(function(td) {
        const r = parseInt(td.dataset.r, 10), c = parseInt(td.dataset.c, 10);
        const isSel = selected.r === r && selected.c === c;
        const inRange = r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2;
        td.classList.toggle('selected', isSel);
        td.classList.toggle('in-range', inRange && !(b.r1 === b.r2 && b.c1 === b.c2));
    });
    document.getElementById('status-sel').textContent = rangeLabel();
    document.getElementById('cell-ref').textContent = rangeLabel();
}

function selectCell(r, c) {
    if (editing) commitEdit();
    selected = { r: r, c: c };
    rangeEnd = { r: r, c: c };
    updateSelectionUI();
    syncFormulaBar();
}

function syncFormulaBar() {
    document.getElementById('cell-ref').textContent = rangeLabel();
    const cell = getCell(selected.r, selected.c);
    const input = document.getElementById('formula-input');
    if (document.activeElement !== input) {
        input.value = cell ? (cell.f || cell.v || '') : '';
    }
    document.getElementById('status-sel').textContent = rangeLabel();
    const sw = document.getElementById('fill-swatch');
    if (sw) sw.style.background = (cell && cell.bg) ? cell.bg : 'transparent';
}

function startEdit(r, c) {
    selectCell(r, c);
    editing = true;
    const td = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
    if (!td) return;
    const cell = getCell(r, c);
    const val = cell ? (cell.f || cell.v || '') : '';
    td.classList.add('editing');
    td.innerHTML = '<input type="text" value="' + escapeHtml(val).replace(/"/g, '&quot;') + '">';
    const inp = td.querySelector('input');
    inp.focus(); inp.select();
    inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); commitEdit(); selectCell(Math.min(maxRows() - 1, r + 1), c); }
        if (e.key === 'Escape') { e.preventDefault(); editing = false; renderGrid(); }
        if (e.key === 'Tab') { e.preventDefault(); commitEdit(); selectCell(r, Math.min(maxCols() - 1, c + 1)); }
    });
    inp.addEventListener('blur', function() { if (editing) commitEdit(); });
}

function commitEdit() {
    if (!editing) return;
    const td = document.querySelector('td.editing');
    if (!td) { editing = false; return; }
    const inp = td.querySelector('input');
    const raw = inp ? inp.value : '';
    const r = selected.r, c = selected.c;
    editing = false;
    if (raw.trim().startsWith('=')) {
        setCell(r, c, '', raw.trim());
        setCell(r, c, evalCell(r, c), raw.trim());
    } else {
        setCell(r, c, raw, null);
    }
    renderGrid();
}

/* Format */
function applyFill(color) {
    forEachInRange(function(r, c) { setCellStyle(r, c, { bg: color || null }); });
    document.getElementById('fill-picker').classList.add('hidden');
    renderGrid();
}
function toggleBold() {
    const first = getCell(selected.r, selected.c);
    const next = !(first && first.bold);
    forEachInRange(function(r, c) { setCellStyle(r, c, { bold: next }); });
    renderGrid();
}
function clearFormat() {
    forEachInRange(function(r, c) {
        const cell = getCell(r, c);
        if (!cell) return;
        delete cell.bg;
        delete cell.bold;
        delete cell.borders;
        if (!cell.v && !cell.f) delete sheet().cells[cellKey(r, c)];
    });
    save(); renderGrid();
}
function toggleFillPicker() {
    document.getElementById('fill-picker').classList.toggle('hidden');
}

/* Context menus */
function placeMenu(menu, e) {
    menu.classList.remove('hidden');
    const pad = 8;
    let x = e.clientX, y = e.clientY;
    const w = menu.offsetWidth || 220, h = menu.offsetHeight || 200;
    if (x + w > window.innerWidth - pad) x = window.innerWidth - w - pad;
    if (y + h > window.innerHeight - pad) y = window.innerHeight - h - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}
function hideAllCtx() {
    ['table-ctx', 'sheet-ctx', 'cell-ctx'].forEach(function(id) {
        document.getElementById(id).classList.add('hidden');
    });
}
function showTableCtx(e, i) {
    hideAllCtx();
    ctxTableIndex = i;
    const menu = document.getElementById('table-ctx');
    const del = menu.querySelector('[data-action="delete"]');
    if (store.tables.length <= 1) del.classList.add('ctx-disabled');
    else del.classList.remove('ctx-disabled');
    placeMenu(menu, e);
}
function showSheetCtx(e, i) {
    hideAllCtx();
    ctxSheetIndex = i;
    const menu = document.getElementById('sheet-ctx');
    const del = menu.querySelector('[data-action="delete"]');
    if (table().sheets.length <= 1) del.classList.add('ctx-disabled');
    else del.classList.remove('ctx-disabled');
    placeMenu(menu, e);
}
function showCellCtx(e, r, c) {
    hideAllCtx();
    ctxCell = { r: r, c: c };
    placeMenu(document.getElementById('cell-ctx'), e);
}

function bindCtxMenus() {
    document.getElementById('table-ctx').addEventListener('click', function(e) {
        const item = e.target.closest('.ctx-item');
        if (!item || item.classList.contains('ctx-disabled')) return;
        hideAllCtx();
        if (item.dataset.action === 'rename') renameTableAt(ctxTableIndex);
        if (item.dataset.action === 'delete') deleteTableAt(ctxTableIndex);
    });
    document.getElementById('sheet-ctx').addEventListener('click', function(e) {
        const item = e.target.closest('.ctx-item');
        if (!item || item.classList.contains('ctx-disabled')) return;
        hideAllCtx();
        if (item.dataset.action === 'rename') renameSheetAt(ctxSheetIndex);
        if (item.dataset.action === 'delete') deleteSheetAt(ctxSheetIndex);
    });
    document.getElementById('cell-ctx').addEventListener('click', function(e) {
        const item = e.target.closest('.ctx-item');
        if (!item) return;
        const action = item.dataset.action;
        hideAllCtx();
        if (!ctxCell) return;
        const r = ctxCell.r, c = ctxCell.c;
        if (action === 'insert-row-above') insertRowAt(r);
        if (action === 'insert-row-below') insertRowAt(r + 1);
        if (action === 'insert-col-left') insertColAt(c);
        if (action === 'insert-col-right') insertColAt(c + 1);
        if (action === 'delete-row') deleteRowAt(r);
        if (action === 'delete-col') deleteColAt(c);
        if (action === 'fill') toggleFillPicker();
        if (action === 'clear') {
            forEachInRange(function(rr, cc) { setCell(rr, cc, '', null); setCellStyle(rr, cc, { bg: null, bold: false }); });
            renderGrid();
        }
    });
    document.getElementById('fill-picker').addEventListener('click', function(e) {
        const sw = e.target.closest('.swatch');
        if (!sw) return;
        applyFill(sw.getAttribute('data-color') || '');
    });
    var bp = document.getElementById('border-picker');
    if (bp) bp.addEventListener('click', function(e) {
        var opt = e.target.closest('.border-opt');
        if (!opt) return;
        applyBorderMode(opt.getAttribute('data-border'));
    });
}

/* Modals */
function showAlert(msg) {
    document.getElementById('alert-msg').textContent = msg;
    document.getElementById('alert-modal').classList.remove('hidden');
}
function closeAlert() { document.getElementById('alert-modal').classList.add('hidden'); }
function showPrompt(title, value, cb) {
    document.getElementById('prompt-title').textContent = title;
    document.getElementById('prompt-input').value = value || '';
    promptCallback = cb;
    document.getElementById('prompt-modal').classList.remove('hidden');
    setTimeout(function() {
        const inp = document.getElementById('prompt-input');
        inp.focus(); inp.select();
    }, 50);
}
function closePrompt(ok) {
    document.getElementById('prompt-modal').classList.add('hidden');
    if (ok && promptCallback) promptCallback(document.getElementById('prompt-input').value);
    promptCallback = null;
}
function showConfirm(title, text, cb) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    confirmCallback = cb;
    document.getElementById('confirm-modal').classList.remove('hidden');
}
function closeConfirm(ok) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (ok && confirmCallback) confirmCallback();
    confirmCallback = null;
}

function toggleMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }
function hideMenu() { document.getElementById('tools-menu').classList.add('hidden'); }

function exportJSON() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my_spreadsheets.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showAlert('Экспорт готов');
}
function importJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && Array.isArray(data.tables)) {
                store = data;
            } else if (data && Array.isArray(data.sheets)) {
                store = { tables: [{ id: Date.now(), name: 'Импорт', sheets: data.sheets }] };
            } else { showAlert('Неверный формат JSON'); return; }
            currentTable = 0; currentSheet = 0;
            save(); renderTableTabs(); renderSheetTabs(); renderGrid();
            showAlert('Импорт выполнен');
        } catch (err) { showAlert('Ошибка чтения файла'); }
    };
    reader.readAsText(file);
    input.value = '';
}

function openSettings() {
    document.getElementById('toggle-autosave').checked = autosave;
    document.getElementById('toggle-liquid').checked = localStorage.getItem('liquid_glass_mode') === 'true';
    document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }
function setTheme(t) {
    document.body.classList.toggle('dark-theme', t === 'dark');
    localStorage.setItem('app_theme', t);
}
function initTheme() {
    setTheme(localStorage.getItem('app_theme') || 'light');
    applyLiquid(localStorage.getItem('liquid_glass_mode') === 'true');
}
function toggleLiquid(on) {
    localStorage.setItem('liquid_glass_mode', on ? 'true' : 'false');
    applyLiquid(on);
}
function applyLiquid(on) { document.body.classList.toggle('liquid-glass', !!on); }
function toggleAutosave(on) {
    autosave = !!on;
    localStorage.setItem('sheets_autosave', autosave ? 'true' : 'false');
    if (autosave) save();
}

function isOnline() { return navigator.onLine !== false; }
function initOffline() {
    updateOnlineUI();
    window.addEventListener('online', updateOnlineUI);
    window.addEventListener('offline', function() {
        updateOnlineUI();
        showAlert('Офлайн: данные на этом устройстве. WorkGens недоступен.');
    });
}
function updateOnlineUI() {
    document.body.classList.toggle('is-offline', !isOnline());
    const btn = document.getElementById('btn-offline');
    if (btn) {
        const icon = btn.querySelector('.material-symbols-rounded');
        if (icon) icon.textContent = isOnline() ? 'cloud' : 'cloud_off';
    }
}
function onOfflineClick() {
    showAlert(isOnline() ? 'Сеть есть. Данные в localStorage.' : 'Нет сети. Данные локально.');
}
function goOnline(url) {
    if (!isOnline()) { showAlert('Нужен интернет'); return; }
    window.location.href = url;
}

/* ===== Share ===== */
function openShareModal() {
    updateSharePreview();
    document.getElementById('share-modal').classList.remove('hidden');
}
function closeShareModal() {
    document.getElementById('share-modal').classList.add('hidden');
}
function buildShareUrl() {
    var base = window.location.href.split('?')[0].split('#')[0];
    var params = new URLSearchParams();
    params.set('t', String(currentTable));
    params.set('s', String(currentSheet));
    var expSel = document.getElementById('share-expiry');
    var days = expSel ? parseInt(expSel.value, 10) : 7;
    if (days > 0) params.set('exp', String(Date.now() + days * 86400000));
    return base + '?' + params.toString();
}
function updateSharePreview() {
    var input = document.getElementById('share-link-input');
    if (input) input.value = buildShareUrl();
}
function copyShareLink() {
    updateSharePreview();
    var url = buildShareUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
            showAlert('Ссылка скопирована');
        }).catch(function() { fallbackCopy(url); });
    } else fallbackCopy(url);
}
function fallbackCopy(url) {
    var input = document.getElementById('share-link-input');
    if (input) { input.select(); try { document.execCommand('copy'); showAlert('Ссылка скопирована'); } catch(e) { showAlert('Скопируйте ссылку вручную'); } }
}
function applyShareParamsFromUrl() {
    try {
        var params = new URLSearchParams(window.location.search);
        var t = params.get('t');
        var s = params.get('s');
        if (t !== null && !isNaN(parseInt(t, 10))) {
            var ti = parseInt(t, 10);
            if (ti >= 0 && ti < store.tables.length) currentTable = ti;
        }
        if (s !== null && !isNaN(parseInt(s, 10))) {
            var si = parseInt(s, 10);
            if (si >= 0 && si < table().sheets.length) currentSheet = si;
        }
        var exp = params.get('exp');
        if (exp && Date.now() > parseInt(exp, 10)) {
            showAlert('Срок действия ссылки истёк');
        }
    } catch (e) {}
}

/* ===== Print ===== */
function openPrintModal() {
    var list = document.getElementById('print-sheets-list');
    list.innerHTML = '';
    table().sheets.forEach(function(s, i) {
        var id = 'print-sheet-' + i;
        var label = document.createElement('label');
        label.className = 'print-sheet-item';
        label.innerHTML = '<input type="checkbox" id="' + id + '" data-idx="' + i + '"' +
            (i === currentSheet ? ' checked' : '') + '>' +
            '<span>' + escapeHtml(s.name) + '</span>';
        list.appendChild(label);
    });
    document.getElementById('print-modal').classList.remove('hidden');
}
function closePrintModal() {
    document.getElementById('print-modal').classList.add('hidden');
}
function printSelectAll(on) {
    document.querySelectorAll('#print-sheets-list input[type=checkbox]').forEach(function(cb) {
        cb.checked = !!on;
    });
}
function doPrintSheets() {
    var indices = [];
    document.querySelectorAll('#print-sheets-list input[type=checkbox]').forEach(function(cb) {
        if (cb.checked) indices.push(parseInt(cb.getAttribute('data-idx'), 10));
    });
    if (!indices.length) {
        showAlert('Выберите хотя бы один лист');
        return;
    }
    closePrintModal();
    printSheetsToBlank(indices);
}
function printSheetsToBlank(indices) {
    var tbl = table();
    var html = '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Печать: ' +
        escapeHtml(tbl.name) + '</title><style>' +
        'body{font-family:Segoe UI,system-ui,sans-serif;padding:20px;background:#f0f0f0;margin:0;}' +
        '.toolbar{position:fixed;top:0;left:0;right:0;background:#1e293b;color:#fff;padding:10px 16px;' +
        'display:flex;justify-content:space-between;align-items:center;gap:12px;z-index:10;box-shadow:0 2px 10px rgba(0,0,0,.3);}' +
        '.toolbar button{background:#1a73e8;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;}' +
        '.toolbar button.secondary{background:transparent;border:1px solid rgba(255,255,255,.3);}' +
        '.page{margin:60px auto 30px;background:#fff;padding:24px;max-width:1000px;box-shadow:0 2px 12px rgba(0,0,0,.1);}' +
        'h1{font-size:18px;margin:0 0 8px;}' +
        'h2{font-size:14px;color:#555;margin:0 0 12px;font-weight:600;}' +
        'table{border-collapse:collapse;width:100%;font-size:12px;}' +
        'th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;min-width:48px;}' +
        'th{background:#f5f5f5;font-weight:600;}' +
        'td.bold{font-weight:700;}' +
        '@media print{.toolbar{display:none!important;}.page{margin:0;box-shadow:none;page-break-after:always;}}' +
        '</style></head><body>';
    html += '<div class="toolbar"><span>Печать · ' + escapeHtml(tbl.name) + '</span><div>' +
        '<button onclick="window.print()">Печать</button> ' +
        '<button class="secondary" onclick="window.close()">Закрыть</button></div></div>';

    indices.forEach(function(si) {
        var sh = tbl.sheets[si];
        if (!sh) return;
        var rows = sh.rows || 40, cols = sh.cols || 20;
        // find used area
        var maxR = 0, maxC = 0;
        Object.keys(sh.cells || {}).forEach(function(k) {
            var m = k.match(/^([A-Z]+)(\d+)$/i);
            if (!m) return;
            var r = parseInt(m[2], 10) - 1;
            var c = colToIndex(m[1]);
            if (r > maxR) maxR = r;
            if (c > maxC) maxC = c;
        });
        maxR = Math.min(rows - 1, Math.max(maxR, 5));
        maxC = Math.min(cols - 1, Math.max(maxC, 5));

        html += '<div class="page"><h1>' + escapeHtml(tbl.name) + '</h1>';
        html += '<h2>Лист: ' + escapeHtml(sh.name) + '</h2><table><thead><tr><th></th>';
        for (var c = 0; c <= maxC; c++) html += '<th>' + colName(c) + '</th>';
        html += '</tr></thead><tbody>';
        for (var r = 0; r <= maxR; r++) {
            html += '<tr><th>' + (r + 1) + '</th>';
            for (var c = 0; c <= maxC; c++) {
                var cell = (sh.cells || {})[cellKey(r, c)];
                var val = '';
                if (cell) {
                    if (cell.f) {
                        // show cached value
                        val = cell.v || '';
                    } else val = cell.v || '';
                }
                var cls = (cell && cell.bold) ? ' class="bold"' : '';
                var st = (cell && cell.bg) ? ' style="background:' + escapeHtml(cell.bg) + '"' : '';
                html += '<td' + cls + st + '>' + escapeHtml(String(val)) + '</td>';
            }
            html += '</tr>';
        }
        html += '</tbody></table></div>';
    });

    html += '</body></html>';
    var w = window.open('about:blank', '_blank');
    if (!w) {
        showAlert('Разрешите всплывающие окна для печати');
        return;
    }
    w.document.write(html);
    w.document.close();
}


function registerSW() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function() {});
}

document.addEventListener('DOMContentLoaded', function() {
    load();
    applyShareParamsFromUrl();
    initTheme();
    initOffline();
    registerSW();
    bindCtxMenus();
    renderTableTabs();
    renderSheetTabs();
    renderGrid();

    document.addEventListener('mouseup', function() { isDragging = false; });

    const fi = document.getElementById('formula-input');
    fi.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const raw = fi.value;
            if (raw.trim().startsWith('=')) {
                setCell(selected.r, selected.c, '', raw.trim());
                setCell(selected.r, selected.c, evalCell(selected.r, selected.c), raw.trim());
            } else setCell(selected.r, selected.c, raw, null);
            renderGrid();
            selectCell(Math.min(maxRows() - 1, selected.r + 1), selected.c);
        }
    });

    document.addEventListener('keydown', function(e) {
        if (editing) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (!document.getElementById('prompt-modal').classList.contains('hidden')) {
            if (e.key === 'Enter') { e.preventDefault(); closePrompt(true); }
            if (e.key === 'Escape') { e.preventDefault(); closePrompt(false); }
            return;
        }
        const { r, c } = selected;
        const shift = e.shiftKey;
        function move(nr, nc) {
            nr = Math.max(0, Math.min(maxRows() - 1, nr));
            nc = Math.max(0, Math.min(maxCols() - 1, nc));
            if (shift) {
                rangeEnd = { r: nr, c: nc };
                updateSelectionUI();
                syncFormulaBar();
            } else selectCell(nr, nc);
        }
        if (e.key === 'ArrowUp') { e.preventDefault(); move(r - 1, c); }
        if (e.key === 'ArrowDown') { e.preventDefault(); move(r + 1, c); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); move(r, c - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); move(r, c + 1); }
        if (e.key === 'Enter') { e.preventDefault(); startEdit(r, c); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            forEachInRange(function(rr, cc) { setCell(rr, cc, '', null); });
            renderGrid();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleBold();
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            startEdit(r, c);
            setTimeout(function() {
                const inp = document.querySelector('td.editing input');
                if (inp) inp.value = e.key;
            }, 0);
        }
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.tools-menu') && !e.target.closest('[onclick*="toggleMenu"]')) hideMenu();
        if (!e.target.closest('.ctx-menu')) hideAllCtx();
        if (!e.target.closest('.fill-picker-wrap')) {
            document.getElementById('fill-picker').classList.add('hidden');
        }
        if (!e.target.closest('.border-picker-wrap')) {
            var bp = document.getElementById('border-picker');
            if (bp) bp.classList.add('hidden');
        }
    });

    document.getElementById('prompt-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); closePrompt(true); }
        if (e.key === 'Escape') { e.preventDefault(); closePrompt(false); }
    });
});
