

/* ===== Hub Tables: ?table= ===== */
function getTableQueryIndex() {
    try {
        var q = new URLSearchParams(window.location.search);
        if (q.has('table')) {
            var n = parseInt(q.get('table'), 10);
            if (!isNaN(n) && n >= 0) return n;
        }
    } catch (e) {}
    return null;
}
function isStandalonePwa() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true;
}
function dismissPwaWorkModal() {
    localStorage.setItem('tables_pwa_work_notice_v1', '1');
    var m = document.getElementById('pwa-work-modal');
    if (m) m.classList.add('hidden');
}
function maybeShowPwaWorkModal() {
    if (!isStandalonePwa()) return;
    if (localStorage.getItem('tables_pwa_work_notice_v1')) return;
    var m = document.getElementById('pwa-work-modal');
    if (m) m.classList.remove('hidden');
}
function enterHubTableMode(idx) {
    document.body.classList.add('hub-table-mode');
    if (idx != null && idx >= 0 && idx < allTables.length) currentTableIndex = idx;
    hideTablePicker();
    updateAppTopbarTitle();
}
function exitHubTableMode() {
    document.body.classList.remove('hub-table-mode');
}
function updateAppTopbarTitle() {
    var input = document.getElementById('app-file-title');
    var t = allTables[currentTableIndex];
    if (input) {
        input.value = (t && t.title) ? t.title : ('Таблица ' + (currentTableIndex + 1));
        input.readOnly = true;
        delete input.dataset.cancel;
    }
    var ft = document.getElementById('table-title');
    if (ft && t) ft.textContent = t.title || 'Таблица';
}
function startQuickRenameTable() {
    var input = document.getElementById('app-file-title');
    if (!input) return;
    input.readOnly = false;
    input.focus();
    input.select();
}
function finishQuickRenameTable() {
    var input = document.getElementById('app-file-title');
    if (!input || input.readOnly) return;
    if (input.dataset.cancel === '1') {
        delete input.dataset.cancel;
        input.readOnly = true;
        updateAppTopbarTitle();
        return;
    }
    var name = (input.value || '').trim();
    input.readOnly = true;
    if (!name || !allTables[currentTableIndex]) {
        updateAppTopbarTitle();
        return;
    }
    allTables[currentTableIndex].title = name;
    saveTablesToStorage();
    try { syncRegistryTableTitle(currentTableIndex, name); } catch (e) {}
    updateAppTopbarTitle();
    renderTabs();
}
function syncRegistryTableTitle(idx, title) {
    try {
        var reg = JSON.parse(localStorage.getItem('mywork_registry_v1') || '[]');
        if (!Array.isArray(reg)) return;
        reg.forEach(function(p) {
            if (p && (p.type === 'spreadsheet' || p.type === 'table') && p.legacyIndex === idx) {
                p.title = title;
                p.updatedAt = Date.now();
            }
        });
        localStorage.setItem('mywork_registry_v1', JSON.stringify(reg));
    } catch (e) {}
}
function showTablePicker() {
    exitHubTableMode();
    var screen = document.getElementById('table-picker-screen');
    if (!screen) return;
    screen.classList.remove('hidden');
    renderTablePickerList();
}
function hideTablePicker() {
    var screen = document.getElementById('table-picker-screen');
    if (screen) screen.classList.add('hidden');
}
function renderTablePickerList() {
    var list = document.getElementById('table-picker-list');
    if (!list) return;
    list.innerHTML = '';
    if (!allTables.length) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">Нет таблиц</p>';
        return;
    }
    allTables.forEach(function(t, idx) {
        var row = document.createElement('div');
        row.className = 'table-picker-item';
        var rn = (t.rows && t.rows.length) || 0;
        var cn = (t.headers && t.headers.length) || 0;
        row.innerHTML =
            '<div class="tp-icon"><span class="material-symbols-rounded">table_chart</span></div>' +
            '<div class="tp-meta"><div class="tp-title"></div><div class="tp-sub"></div></div>' +
            '<div class="tp-actions">' +
            '<button type="button" class="tp-ren" title="Переименовать"><span class="material-symbols-rounded">edit</span></button>' +
            '<button type="button" class="tp-del danger" title="Удалить"><span class="material-symbols-rounded">delete</span></button>' +
            '</div>';
        row.querySelector('.tp-title').textContent = t.title || ('Таблица ' + (idx + 1));
        row.querySelector('.tp-sub').textContent = rn + ' × ' + cn;
        row.addEventListener('click', function(e) {
            if (e.target.closest('.tp-actions')) return;
            openTableByIndex(idx);
        });
        row.querySelector('.tp-ren').onclick = function(e) {
            e.stopPropagation();
            renameTable(idx, e);
        };
        row.querySelector('.tp-del').onclick = function(e) {
            e.stopPropagation();
            deleteTable(idx, e);
            setTimeout(renderTablePickerList, 100);
        };
        list.appendChild(row);
    });
}
function openTableByIndex(idx) {
    if (idx < 0 || idx >= allTables.length) return;
    currentTableIndex = idx;
    try {
        var u = new URL(window.location.href);
        u.searchParams.set('table', String(idx));
        history.replaceState(null, '', u.toString());
    } catch (e) {}
    enterHubTableMode(idx);
    renderTabs();
    renderCurrentTable();
}
function initHubTableRouting() {
    maybeShowPwaWorkModal();
    var idx = getTableQueryIndex();
    if (idx !== null) {
        if (idx >= allTables.length) idx = 0;
        enterHubTableMode(idx);
        currentTableIndex = idx;
        return { picker: false, index: idx };
    }
    showTablePicker();
    return { picker: true, index: null };
}

function openSettingsModal() {
    var m = document.getElementById('settings-modal');
    if (m) m.classList.remove('hidden');
}
function closeSettingsModal() {
    var m = document.getElementById('settings-modal');
    if (m) m.classList.add('hidden');
}



/* Formula bar + selection UX */
document.addEventListener('DOMContentLoaded', function() {
    var fi = document.getElementById('formula-input');
    if (fi) {
        fi.addEventListener('change', function() {
            if (!activeCell.element) return;
            activeCell.element.textContent = fi.value;
            if (activeCell.row === -1) updateHeaderData(activeCell.col, fi.value);
            else if (activeCell.row != null) updateCellData(activeCell.row, activeCell.col, fi.value);
        });
        fi.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); fi.blur(); }
        });
    }
});

function updateAddressBox() {
    var box = document.getElementById('active-cell-address');
    if (!box) return;
    if (activeCell.row == null || activeCell.col == null) {
        box.textContent = '—';
        return;
    }
    var colLetter = String.fromCharCode(65 + (activeCell.col % 26));
    if (activeCell.row === -1) box.textContent = colLetter;
    else box.textContent = colLetter + (activeCell.row + 1);
    var fi = document.getElementById('formula-input');
    if (fi && activeCell.element) fi.value = activeCell.element.textContent || '';
}


/* ==========================================
   1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ДАННЫЕ
   ========================================== */
let allTables = [];
let currentTableIndex = 0;
let activeCell = { row: null, col: null, element: null };
let promptCallback = null;
let aiApiKey = localStorage.getItem('ai_api_key') || '';

const defaultTable = {
    title: "Тестовая таблица",
    headers: ["ID", "Наименование", "Категория", "Цена (₽)", "Статус"],
    rows: [
        ["1", "Ноутбук Pro", "Электроника", "120 000", "В наличии"],
        ["2", "Беспроводная мышь", "Аксессуары", "3 500", "В наличии"],
        ["3", "Механическая клавиатура", "Аксессуары", "8 900", "Под заказ"]
    ]
};

/* ==========================================
   2. ИНИЦИАЛИЗАЦИЯ И ХРАНИЛИЩЕ
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadTablesFromStorage();
    initSettings();
    var hubRoute = { picker: false };
    try { hubRoute = initHubTableRouting(); } catch (e) { console.warn(e); }
    if (!hubRoute.picker) {
        renderTabs();
        renderCurrentTable();
        updateAppTopbarTitle();
    }
    initContextMenu();
});

function loadTablesFromStorage() {
    const saved = localStorage.getItem('my_tables_data');
    if (saved) {
        try {
            allTables = JSON.parse(saved);
        } catch (e) {
            allTables = [defaultTable];
        }
    } else {
        allTables = [defaultTable];
        saveTablesToStorage();
    }
}

function saveTablesToStorage() {
    localStorage.setItem('my_tables_data', JSON.stringify(allTables));
}

function initSettings() {
    const savedTheme = localStorage.getItem('app_theme') || 'light';
    setTheme(savedTheme, false);
    const aiKeyInput = document.getElementById('ai-api-key-input');
    if (aiKeyInput) aiKeyInput.value = aiApiKey;
}

function setTheme(themeName, save = true) {
    document.documentElement.setAttribute('data-theme', themeName === 'dark' ? 'dark' : 'light');
    if (themeName === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
    if (save) localStorage.setItem('app_theme', themeName);
}

/* ==========================================
   3. РЕНДЕРИНГ ВКЛАДОК И ТАБЛИЦЫ
   ========================================== */
function renderTabs() {
    const listEl = document.getElementById('forms-tabs-list');
    const selectEl = document.getElementById('forms-tabs-select');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (selectEl) selectEl.innerHTML = '';

    allTables.forEach((table, index) => {
        const title = table.title || `Таблица №${index + 1}`;

        if (selectEl) {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = title;
            if (index === currentTableIndex) opt.selected = true;
            selectEl.appendChild(opt);
        }

        const tab = document.createElement('div');
        tab.className = `form-tab ${index === currentTableIndex ? 'active-tab' : ''}`;
        tab.innerHTML = `
            <span>${title}</span>
            <button class="edit-tab-btn" onclick="renameTable(${index}, event)" title="Переименовать">
                <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="delete-tab-btn" onclick="deleteTable(${index}, event)" title="Удалить">
                <span class="material-symbols-rounded">close</span>
            </button>
        `;
        tab.onclick = () => switchTable(index);
        listEl.appendChild(tab);
    });
}

function renderCurrentTable() {
    const tableData = allTables[currentTableIndex];
    if (!tableData) return;

    document.getElementById('table-title').textContent = tableData.title;

    const thead = document.getElementById('table-head');
    const tbody = document.getElementById('table-body');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Рендер заголовков
    const headRow = document.createElement('tr');
    tableData.headers.forEach((headerText, colIndex) => {
        const th = document.createElement('th');
        th.contentEditable = true;
        th.textContent = headerText;
        th.dataset.col = colIndex;
        th.dataset.type = 'header';
        
        th.oninput = (e) => updateHeaderData(colIndex, e.target.textContent);
        th.oncontextmenu = (e) => openContextMenu(e, -1, colIndex, th);
        th.onfocus = () => {
            activeCell = { row: -1, col: colIndex, element: th };
            document.querySelectorAll('.custom-table td, .custom-table th').forEach(el => el.classList.remove('selected-cell'));
            th.classList.add('selected-cell');
            try { updateAddressBox(); } catch (e) {}
        };
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    // Рендер строк данных
    tableData.rows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        row.forEach((cellValue, colIndex) => {
            const td = document.createElement('td');
            td.contentEditable = true;
            td.textContent = cellValue;
            td.dataset.row = rowIndex;
            td.dataset.col = colIndex;
            td.dataset.type = 'cell';

            td.oninput = (e) => updateCellData(rowIndex, colIndex, e.target.textContent);
            td.oncontextmenu = (e) => openContextMenu(e, rowIndex, colIndex, td);
            td.onfocus = () => {
                activeCell = { row: rowIndex, col: colIndex, element: td };
                document.querySelectorAll('.custom-table td, .custom-table th').forEach(el => el.classList.remove('selected-cell'));
                td.classList.add('selected-cell');
                try { updateAddressBox(); } catch (e) {}
            };
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function updateCellData(r, c, val) {
    allTables[currentTableIndex].rows[r][c] = val;
    saveTablesToStorage();
}

function updateHeaderData(c, val) {
    allTables[currentTableIndex].headers[c] = val;
    saveTablesToStorage();
}

/* ==========================================
   4. КОНТЕКСТНОЕ МЕНЮ И УПРАВЛЕНИЕ ПКМ
   ========================================== */
function initContextMenu() {
    document.addEventListener('click', () => hideContextMenu());
}

function openContextMenu(e, row, col, element) {
    e.preventDefault();
    activeCell = { row, col, element };

    // Сброс выделения со всех ячеек
    document.querySelectorAll('.custom-table td, .custom-table th').forEach(el => el.classList.remove('selected-cell'));
    if (element) element.classList.add('selected-cell');
    try { updateAddressBox(); } catch (e) {}

    const menu = document.getElementById('context-menu');
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add('active'); menu.classList.remove('hidden');
}

function hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) { menu.classList.remove('active'); menu.classList.add('hidden'); }
}

/* Операции со строками и столбцами */
function addRowAboveSelected() {
    const table = allTables[currentTableIndex];
    const targetRow = activeCell.row >= 0 ? activeCell.row : 0;
    const newRow = new Array(table.headers.length).fill('');
    table.rows.splice(targetRow, 0, newRow);
    saveAndReload();
}

function addRowBelowSelected() {
    const table = allTables[currentTableIndex];
    const targetRow = activeCell.row >= 0 ? activeCell.row + 1 : table.rows.length;
    // on edge button without selection → add 5 rows at end
    if (activeCell.row == null || activeCell.row === undefined) {
        for (let i = 0; i < 5; i++) table.rows.push(new Array(table.headers.length).fill(''));
    } else {
        const newRow = new Array(table.headers.length).fill('');
        table.rows.splice(targetRow, 0, newRow);
    }
    saveAndReload();
}

function deleteSelectedRow() {
    const table = allTables[currentTableIndex];
    if (activeCell.row < 0 || table.rows.length <= 1) {
        showAlert('Нельзя удалить единственную или несуществующую строку!', 'warning');
        return;
    }
    table.rows.splice(activeCell.row, 1);
    saveAndReload();
}

function addColumnLeftSelected() {
    const table = allTables[currentTableIndex];
    const targetCol = activeCell.col >= 0 ? activeCell.col : 0;
    table.headers.splice(targetCol, 0, 'Новый столбец');
    table.rows.forEach(row => row.splice(targetCol, 0, ''));
    saveAndReload();
}

function addColumnRightSelected() {
    const table = allTables[currentTableIndex];
    const targetCol = activeCell.col >= 0 ? activeCell.col + 1 : table.headers.length;
    table.headers.splice(targetCol, 0, 'Новый столбец');
    table.rows.forEach(row => row.splice(targetCol, 0, ''));
    saveAndReload();
}

function deleteSelectedColumn() {
    const table = allTables[currentTableIndex];
    if (table.headers.length <= 1) {
        showAlert('Нельзя удалить единственный столбец!', 'warning');
        return;
    }
    const targetCol = activeCell.col >= 0 ? activeCell.col : 0;
    table.headers.splice(targetCol, 1);
    table.rows.forEach(row => row.splice(targetCol, 1));
    saveAndReload();
}

function clearSelectedCell() {
    if (!activeCell.element) return;
    activeCell.element.textContent = '';
    if (activeCell.row === -1) {
        updateHeaderData(activeCell.col, '');
    } else {
        updateCellData(activeCell.row, activeCell.col, '');
    }
}

function saveAndReload() {
    saveTablesToStorage();
    renderCurrentTable();
    hideContextMenu();
}

/* ==========================================
   5. УПРАВЛЕНИЕ ВКЛАДКАМИ И ФОРМАМИ
   ========================================== */
function switchTable(index) {
    currentTableIndex = parseInt(index);
    if (document.body.classList.contains('hub-table-mode')) {
        try {
            var u = new URL(window.location.href);
            u.searchParams.set('table', String(currentTableIndex));
            history.replaceState(null, '', u.toString());
        } catch (e) {}
        updateAppTopbarTitle();
    }
    renderTabs();
    renderCurrentTable();
}

function createNewTablePrompt() {
    showPrompt("Введите название новой таблицы:", "", (title) => {
        if (title && title.trim()) {
            allTables.push({
                title: title.trim(),
                headers: ["Столбец 1", "Столбец 2", "Столбец 3"],
                rows: [["", "", ""]]
            });
            currentTableIndex = allTables.length - 1;
            saveTablesToStorage();
            renderTabs();
            renderCurrentTable();
        }
    });
}

function renameTable(index, event) {
    if (event) event.stopPropagation();
    showPrompt("Новое название таблицы:", allTables[index].title, (newTitle) => {
        if (newTitle && newTitle.trim()) {
            allTables[index].title = newTitle.trim();
            saveTablesToStorage();
            renderTabs();
            renderCurrentTable();
        }
    });
}

function deleteTable(index, event) {
    if (event) event.stopPropagation();
    if (allTables.length <= 1) {
        showAlert('Нельзя удалить единственную таблицу!', 'warning');
        return;
    }
    allTables.splice(index, 1);
    currentTableIndex = Math.max(0, index - 1);
    saveTablesToStorage();
    renderTabs();
    renderCurrentTable();
}

/* ==========================================
   6. ИИ ГЕНЕРАТОР ТАБЛИЦ
   ========================================== */
async function generateAiTable() {
    const promptInput = document.getElementById('ai-prompt-input');
    const promptText = promptInput ? promptInput.value.trim() : '';

    if (!promptText) {
        showAlert('Введите описание для генерации!', 'warning');
        return;
    }

    const aiStatus = document.getElementById('ai-status-msg');
    if (aiStatus) {
        aiStatus.classList.remove('hidden');
        aiStatus.textContent = '⏳ ИИ генерирует таблицу... Пожалуйста, подождите...';
    }

    try {
        let generatedTable = null;

        if (aiApiKey) {
            const systemPrompt = `Сгенерируй таблицу по теме: "${promptText}".
Ответ должен быть СТРОГО в формате JSON объекта вида:
{
  "title": "Название таблицы",
  "headers": ["Заголовок1", "Заголовок2", "Заголовок3"],
  "rows": [
    ["значение1", "значение2", "значение3"],
    ["значение4", "значение5", "значение6"]
  ]
}`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'system', content: systemPrompt }]
                })
            });

            const data = await response.json();
            const textContent = data.choices[0].message.content.trim().replace(/```json/g, '').replace(/```/g, '').trim();
            generatedTable = JSON.parse(textContent);
        } else {
            await new Promise(r => setTimeout(r, 600));
            generatedTable = {
                title: promptText,
                headers: ["Параметр", "Значение", "Примечание"],
                rows: [
                    ["Пример 1", "Данные A", "ОК"],
                    ["Пример 2", "Данные B", "В процессе"]
                ]
            };
        }

        if (generatedTable && generatedTable.headers && generatedTable.rows) {
            allTables.push(generatedTable);
            currentTableIndex = allTables.length - 1;
            saveTablesToStorage();
            renderTabs();
            renderCurrentTable();
            closeAiModal();
            if (aiStatus) aiStatus.classList.add('hidden');
            showAlert('Таблица успешно сгенерирована!', 'check_circle');
        }
    } catch (e) {
        if (aiStatus) aiStatus.textContent = '❌ Ошибка генерации: ' + e.message;
    }
}

/* ==========================================
   7. ЭКСПОРТ, ИМПОРТ И ВСПУГАЮЩИЕ ОКНА
   ========================================== */
function exportTableToJSON() {
    const table = allTables[currentTableIndex];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(table, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `${table.title || 'table'}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
}

function importTableFromJSON(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.headers && imported.rows) {
                allTables.push(imported);
                currentTableIndex = allTables.length - 1;
                saveTablesToStorage();
                renderTabs();
                renderCurrentTable();
                showAlert('Таблица импортирована!', 'check_circle');
            }
        } catch (err) {
            showAlert('Ошибка чтения файла!', 'error');
        }
    };
    reader.readAsText(file);
}

function showPrompt(title, defaultVal, callback) {
    document.getElementById('custom-prompt-title').textContent = title;
    const inp = document.getElementById('custom-prompt-input');
    inp.value = defaultVal;
    promptCallback = callback;
    document.getElementById('custom-prompt').classList.remove('hidden');
    setTimeout(() => inp.focus(), 100);
}

function closePrompt(isConfirm) {
    const inp = document.getElementById('custom-prompt-input');
    document.getElementById('custom-prompt').classList.add('hidden');
    if (promptCallback) {
        promptCallback(isConfirm ? inp.value : null);
        promptCallback = null;
    }
}

function showAlert(msg, icon = 'info') {
    document.getElementById('custom-alert-msg').textContent = msg;
    document.getElementById('custom-alert-icon').textContent = icon;
    document.getElementById('custom-alert').classList.remove('hidden');
}
function printCurrentTable() {
    const table = allTables[currentTableIndex];
    if (!table) return;

    // 1. Открываем чистое окно about:blank
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
        showAlert('Не удалось открыть окно печати. Разрешите всплывающие окна в браузере.', 'error');
        return;
    }

    // 2. Генерируем HTML-разметку заголовков и строк
    const headersHtml = table.headers
        .map(h => `<th style="border: 1px solid #000; padding: 8px 12px; background: #f2f2f2; text-align: left; font-weight: bold;">${h}</th>`)
        .join('');

    const rowsHtml = table.rows
        .map(row => {
            const cells = row.map(c => `<td style="border: 1px solid #000; padding: 8px 12px;">${c}</td>`).join('');
            return `<tr>${cells}</tr>`;
        })
        .join('');

    // 3. Формируем полный документ для страницы печати
    const printDocumentHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>Печать — ${table.title}</title>
            <style>
                body {
                    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                    padding: 20px;
                    color: #000;
                    background: #fff;
                }
                h1 {
                    font-size: 22px;
                    margin-bottom: 16px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <h1>${table.title}</h1>
            <table>
                <thead><tr>${headersHtml}</tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </body>
        </html>
    `;

    // 4. Записываем содержимое в about:blank и вызываем диалог печати
    printWindow.document.open();
    printWindow.document.write(printDocumentHtml);
    printWindow.document.close();

    // Запуск печати после полной загрузки документа
    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
    };

    // Резервный вызов для браузеров с мгновенной загрузкой
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 300);
}

function closeAlert() { document.getElementById('custom-alert').classList.add('hidden'); }
function openAiModal() { document.getElementById('ai-modal').classList.remove('hidden'); }
function closeAiModal() { document.getElementById('ai-modal').classList.add('hidden'); }
function openSettingsModal() { document.getElementById('settings-modal').classList.add('active'); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.remove('active'); }
function openLanguageModal() { document.getElementById('language-modal').classList.add('active'); }
function closeLanguageModal() { document.getElementById('language-modal').classList.remove('active'); }
function toggleToolsMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }
function saveSettings() {
    const key = document.getElementById('ai-api-key-input').value.trim();
    aiApiKey = key;
    localStorage.setItem('ai_api_key', key);
    closeSettingsModal();
    showAlert('Настройки сохранены!', 'check_circle');
}
