const DEMO_NOTES = [
    {
        id: 101,
        title: "📌 Добро пожаловать в Keeps!",
        content: "<p>Это ваш личный блокнот. Можно использовать <b>жирный текст</b> и списки:</p><ul><li>Первый пункт</li><li>Второй пункт</li></ul>",
        bgColor: null,
        pinned: true,
        reminder: null
    },
    {
        id: 102,
        title: "↗️ Экспертные фичи",
        content: "<div class=\"task-item\"><input type=\"checkbox\" class=\"task-checkbox\" checked=\"\"><label>Настраивать индивидуальные цвета</label></div><div class=\"task-item\"><input type=\"checkbox\" class=\"task-checkbox\"><label>Отправлять документы в сервисы</label></div>",
        bgColor: null,
        pinned: false,
        reminder: null
    }
];

let state = {
    notes: JSON.parse(localStorage.getItem('keeps_notes')) || DEMO_NOTES,
    theme: localStorage.getItem('keeps_theme') || 'dark',
    radius: localStorage.getItem('keeps_radius') || 'rounded',
    aiKey: localStorage.getItem('keeps_ai_key') || '',
    activeNoteId: null,
    openMenuId: null,
    reminderNoteId: null,
    createBgColor: null, // Хранит colorId
    editBgColor: null,   // Хранит colorId
    pendingDelete: null,
    undoTimer: null,
    undoSecondsLeft: 5
};

// Палитры матовых цветов с ID
const MATTE_COLORS_DARK = [
    { id: null, name: 'Прозрачный', value: null },
    { id: 'coral', name: 'Коралловый', value: '#77172E' },
    { id: 'peach', name: 'Персиковый', value: '#692B17' },
    { id: 'sand', name: 'Песочный', value: '#7C4A03' },
    { id: 'mint', name: 'Мятный', value: '#264D3B' },
    { id: 'gray-green', name: 'Серо-Зелёный', value: '#256377' },
    { id: 'gray', name: 'Серый', value: '#284255' },
    { id: 'purple', name: 'Фиолетовый', value: '#472E5B' },
    { id: 'pink', name: 'Розовый', value: '#6C394F' },
    { id: 'terracotta', name: 'Терракотовый', value: '#4B443A' }
];

const MATTE_COLORS_LIGHT = [
    { id: null, name: 'Прозрачный', value: null },
    { id: 'coral', name: 'Коралловый', value: '#FAD4D8' },
    { id: 'peach', name: 'Персиковый', value: '#FDE2D1' },
    { id: 'sand', name: 'Песочный', value: '#FFF0C2' },
    { id: 'mint', name: 'Мятный', value: '#D1E7DD' },
    { id: 'gray-green', name: 'Серо-Зелёный', value: '#CCE5FF' },
    { id: 'gray', name: 'Серый', value: '#E2E3E5' },
    { id: 'purple', name: 'Фиолетовый', value: '#E2D9F3' },
    { id: 'pink', name: 'Розовый', value: '#F8D7DA' },
    { id: 'terracotta', name: 'Терракотовый', value: '#E9E3D8' }
];

// Динамический выбор палитры
function getCurrentPalette() {
    return state.theme === 'dark' ? MATTE_COLORS_DARK : MATTE_COLORS_LIGHT;
}

// Получение HEX по ID цвета и текущей теме (с поддержкой старых HEX)
function getHexByColorId(colorVal) {
    if (!colorVal) return null;

    const palette = getCurrentPalette();
    const foundById = palette.find(c => c.id === colorVal);
    if (foundById) return foundById.value;

    // Резервная поддержка старых HEX-значений
    const darkMatch = MATTE_COLORS_DARK.find(c => c.value === colorVal);
    if (darkMatch) {
        const item = palette.find(c => c.id === darkMatch.id);
        return item ? item.value : colorVal;
    }

    const lightMatch = MATTE_COLORS_LIGHT.find(c => c.value === colorVal);
    if (lightMatch) {
        const item = palette.find(c => c.id === lightMatch.id);
        return item ? item.value : colorVal;
    }

    return colorVal;
}

// Рендеринг кнопок палитры
function renderColorPalette(containerId, onSelectCallback, activeId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const currentPalette = getCurrentPalette();
    const active = activeId !== undefined ? activeId : (
        containerId === 'create-color-palette' ? state.createBgColor : state.editBgColor
    );

    currentPalette.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-swatch-btn' + (c.id === active || (c.id === null && !active) ? ' active' : '');
        btn.title = c.name;
        btn.style.backgroundColor = c.value || 'var(--card-bg)';
        if (!c.value) {
            btn.style.backgroundImage = 'linear-gradient(45deg, transparent 46%, var(--border-color) 46%, var(--border-color) 54%, transparent 54%)';
        }
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectCallback(c.id);
            renderColorPalette(containerId, onSelectCallback, c.id);
        };
        container.appendChild(btn);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applySettings();
    renderNotes();
    renderColorPalette('create-color-palette', changeCreateCardColor);
    if (typeof enhanceAllSelects === 'function') enhanceAllSelects();
    try {
        const params = new URLSearchParams(window.location.search);
        const noteId = params.get('note');
        if (noteId) {
            const nid = parseInt(noteId, 10);
            if (state.notes.some(n => n.id === nid)) setTimeout(() => openNoteModal(nid), 200);
        }
    } catch (err) {}

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tools-dropdown')) {
            const toolsMenu = document.getElementById('tools-menu');
            if (toolsMenu) toolsMenu.classList.add('hidden');
        }
        if (!e.target.closest('.note-menu-wrapper')) {
            if (state.openMenuId !== null) {
                state.openMenuId = null;
                renderNotes();
            }
        }
        if (!e.target.closest('.cselect')) {
            document.querySelectorAll('.cselect-dropdown').forEach(d => d.classList.add('hidden'));
            document.querySelectorAll('.cselect').forEach(c => c.classList.remove('open'));
        }
    });
});

/* ВСТАВКА ЧЕКБОКСА */
function insertCheckbox(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    editor.focus();
    const checkboxHtml = `<div class="task-item"><input type="checkbox" class="task-checkbox"><label>&nbsp;Пункт списка</label></div>`;
    document.execCommand('insertHTML', false, checkboxHtml);
}

/* ФОРМАТИРОВАНИЕ ТЕКСТА */
function execFormat(command, value = null) {
    document.execCommand(command, false, value);
}

/* ИЗМЕНЕНИЕ ЦВЕТА КАРТОЧЕК */
function changeCreateCardColor(colorId) {
    state.createBgColor = colorId;
    const card = document.getElementById('create-note-card');
    const hex = getHexByColorId(colorId);
    if (card) card.style.backgroundColor = hex || 'var(--card-bg)';
}

function changeEditCardColor(colorId) {
    state.editBgColor = colorId;
    const card = document.getElementById('edit-modal-card');
    const hex = getHexByColorId(colorId);
    if (card) card.style.backgroundColor = hex || 'var(--card-bg)';
}

function toggleToolsMenu(e) {
    e.stopPropagation();
    document.getElementById('tools-menu').classList.toggle('hidden');
}

function renderNotes() {
    const grid = document.getElementById('notes-grid');
    const emptyState = document.getElementById('empty-state');
    const searchEl = document.getElementById('search-input');
    const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
    
    if (!grid) return;
    grid.innerHTML = '';

    const sortedNotes = [...state.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    const filtered = sortedNotes.filter(n => 
        (n.title && n.title.toLowerCase().includes(query)) || 
        (n.content && n.content.toLowerCase().includes(query))
    );

    if (emptyState) {
        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            const titleEl = emptyState.querySelector('h2');
            const descEl = emptyState.querySelector('p');
            const restoreBtn = emptyState.querySelector('button');

            if (query.length > 0) {
                if (titleEl) titleEl.innerText = "Ничего не найдено";
                if (descEl) descEl.innerText = `По запросу «${query}» заметок не обнаружено.`;
                if (restoreBtn) restoreBtn.classList.add('hidden');
            } else {
                if (titleEl) titleEl.innerText = "Заметок пока нет";
                if (descEl) descEl.innerText = "Создайте заметку выше или восстановите обучающие материалы.";
                if (restoreBtn) restoreBtn.classList.remove('hidden');
            }
        } else {
            emptyState.classList.add('hidden');
        }
    }

    filtered.forEach(note => {
        const card = document.createElement('div');
        card.className = `note-card ${note.pinned ? 'is-pinned' : ''}`;
        
        const currentHex = getHexByColorId(note.bgColor);
        if (currentHex) {
            card.style.backgroundColor = currentHex;
        } else {
            card.style.backgroundColor = 'var(--card-bg)';
        }

        card.onclick = (e) => {
            if (e.target.closest('.note-menu-wrapper') || e.target.classList.contains('task-checkbox')) return;
            openNoteModal(note.id);
        };

        const isMenuOpen = state.openMenuId === note.id;

        let reminderHtml = '';
        if (note.reminder) {
            const dateStr = new Date(note.reminder).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            reminderHtml = `
                <div class="reminder-tag">
                    <span class="material-symbols-rounded" style="font-size: 14px;">notifications</span>
                    ${dateStr}
                </div>
            `;
        }

        card.innerHTML = `
            <div>
                <div class="note-card-header">
                    <div class="note-title">${escapeHtml(note.title || 'Без названия')}</div>
                    
                    <div class="note-menu-wrapper">
                        <button class="tools-icon-btn ${note.pinned ? 'pinned' : ''}" onclick="togglePin(event, ${note.id})" title="${note.pinned ? 'Открепить' : 'Закрепить'}">
                            <span class="material-symbols-rounded" style="font-size: 18px;">push_pin</span>
                        </button>
                        <button class="tools-icon-btn" onclick="toggleNoteMenu(event, ${note.id})" title="Опции">
                            <span class="material-symbols-rounded" style="font-size: 18px;">more_vert</span>
                        </button>

                        <div class="note-menu ${isMenuOpen ? '' : 'hidden'}">
                            <div class="tools-item" onclick="openReminderModal(event, ${note.id})">
                                <span class="material-symbols-rounded" style="color: var(--accent-color);">notifications</span> Напоминание
                            </div>
                            <div style="border-top: 1px solid var(--border-color); margin: 2px 0;"></div>
                            <div class="tools-item" onclick="exportNote(event, ${note.id}, 'doc')">
                                <span class="material-symbols-rounded">description</span> В Документы
                            </div>
                            <div class="tools-item" onclick="exportToTxt(event, ${note.id})">
                                <span class="material-symbols-rounded">download</span> Скачать (.txt)
                            </div>
                            <div class="tools-item" onclick="copyNoteLink(event, ${note.id})">
                                <span class="material-symbols-rounded">link</span> Копировать ссылку
                            </div>
                            <div style="border-top: 1px solid var(--border-color); margin: 2px 0;"></div>
                            <div class="tools-item delete" onclick="startDeleteNote(event, ${note.id})">
                                <span class="material-symbols-rounded" style="color: #d32f2f;">delete</span> Удалить
                            </div>
                        </div>
                    </div>
                </div>
                <div class="note-content" style="margin-top: 8px;">${note.content}</div>
                ${reminderHtml}
            </div>
        `;
        grid.appendChild(card);

        const noteIdForCb = note.id;
        card.querySelectorAll('.task-checkbox').forEach(cb => {
            cb.addEventListener('click', (ev) => ev.stopPropagation());
            cb.addEventListener('change', () => {
                const n = state.notes.find(x => x.id === noteIdForCb);
                if (!n) return;
                const contentEl = card.querySelector('.note-content');
                if (contentEl) {
                    n.content = contentEl.innerHTML;
                    saveNotes();
                }
            });
        });
    });
}

function togglePin(e, id) {
    e.stopPropagation();
    const note = state.notes.find(n => n.id === id);
    if (note) {
        note.pinned = !note.pinned;
        saveNotes();
        renderNotes();
    }
}

function toggleNoteMenu(e, id) {
    e.stopPropagation();
    state.openMenuId = state.openMenuId === id ? null : id;
    renderNotes();
}

function openNoteModal(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    state.activeNoteId = id;
    state.editBgColor = note.bgColor || null;

    const modalCard = document.getElementById('edit-modal-card');
    const currentHex = getHexByColorId(note.bgColor);
    if (modalCard) modalCard.style.backgroundColor = currentHex || 'var(--card-bg)';

    document.getElementById('edit-note-title').value = note.title || '';
    document.getElementById('edit-note-content').innerHTML = note.content || '';
    
    renderColorPalette('edit-color-palette', changeEditCardColor);

    document.getElementById('view-note-modal').classList.add('active');
}

function closeNoteModal() {
    document.getElementById('view-note-modal').classList.remove('active');
    state.activeNoteId = null;
    state.editBgColor = null;
}

function saveActiveNote() {
    if (!state.activeNoteId) return;
    const note = state.notes.find(n => n.id === state.activeNoteId);
    if (note) {
        note.title = document.getElementById('edit-note-title').value.trim();
        note.content = document.getElementById('edit-note-content').innerHTML.trim();
        note.bgColor = state.editBgColor;
        saveNotes();
        renderNotes();
    }
    closeNoteModal();
}

/* 5-СЕКУНДНЫЙ ТАЙМЕР */
function startDeleteNote(e, id) {
    if (e) e.stopPropagation();
    state.openMenuId = null;

    if (state.pendingDelete) {
        commitDelete();
    }

    const index = state.notes.findIndex(n => n.id === id);
    if (index === -1) return;

    state.pendingDelete = {
        note: state.notes[index],
        index: index
    };

    state.notes.splice(index, 1);
    renderNotes();

    state.undoSecondsLeft = 5;
    const toast = document.getElementById('undo-toast');
    const timerSpan = document.getElementById('undo-timer');
    if (timerSpan) timerSpan.innerText = state.undoSecondsLeft;
    if (toast) toast.classList.remove('hidden');

    state.undoTimer = setInterval(() => {
        state.undoSecondsLeft--;
        if (state.undoSecondsLeft > 0) {
            if (timerSpan) timerSpan.innerText = state.undoSecondsLeft;
        } else {
            commitDelete();
        }
    }, 1000);
}

function commitDelete() {
    clearInterval(state.undoTimer);
    state.undoTimer = null;
    state.pendingDelete = null;
    const toast = document.getElementById('undo-toast');
    if (toast) toast.classList.add('hidden');
    saveNotes();
}

function undoDelete() {
    if (!state.pendingDelete) return;

    clearInterval(state.undoTimer);
    state.undoTimer = null;

    state.notes.splice(state.pendingDelete.index, 0, state.pendingDelete.note);
    state.pendingDelete = null;

    const toast = document.getElementById('undo-toast');
    if (toast) toast.classList.add('hidden');
    saveNotes();
    renderNotes();
}

/* НАПОМИНАНИЯ */
function openReminderModal(e, id) {
    e.stopPropagation();
    state.openMenuId = null;
    renderNotes();

    state.reminderNoteId = id;
    const note = state.notes.find(n => n.id === id);
    const datetimeInput = document.getElementById('reminder-datetime');

    if (datetimeInput) {
        datetimeInput.value = (note && note.reminder) ? note.reminder : '';
    }

    document.getElementById('reminder-modal').classList.add('active');
}

function closeReminderModal() {
    document.getElementById('reminder-modal').classList.remove('active');
    state.reminderNoteId = null;
}

function saveReminder() {
    const val = document.getElementById('reminder-datetime').value;
    if (!state.reminderNoteId) return;

    const note = state.notes.find(n => n.id === state.reminderNoteId);
    if (note) {
        note.reminder = val || null;
        saveNotes();
        renderNotes();
    }
    closeReminderModal();
}

function clearReminder() {
    if (!state.reminderNoteId) return;

    const note = state.notes.find(n => n.id === state.reminderNoteId);
    if (note) {
        note.reminder = null;
        saveNotes();
        renderNotes();
    }
    closeReminderModal();
}

/* СОЗДАНИЕ ЗАМЕТКИ */
function createNote() {
    const title = document.getElementById('note-title-input').value.trim();
    const content = document.getElementById('note-text-input').innerHTML.trim();

    if (!title && !content) return;

    const newNote = { 
        id: Date.now(), 
        title, 
        content, 
        bgColor: state.createBgColor, 
        pinned: false, 
        reminder: null 
    };

    state.notes.unshift(newNote);
    saveNotes();
    renderNotes();

    document.getElementById('note-title-input').value = '';
    document.getElementById('note-text-input').innerHTML = '';
    const createCard = document.getElementById('create-note-card');
    if (createCard) createCard.style.backgroundColor = 'var(--card-bg)';
    state.createBgColor = null;
    renderColorPalette('create-color-palette', changeCreateCardColor, null);
}

function restoreDemoNotes() {
    state.notes = [...DEMO_NOTES];
    saveNotes();
    renderNotes();
}

function saveNotes() {
    localStorage.setItem('keeps_notes', JSON.stringify(state.notes));
}

function exportNote(e, id, type) {
    e.stopPropagation();
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    localStorage.setItem(`keeps_export_${type}`, JSON.stringify(note));
    showAlert('cloud_upload', `Заметка подготовлена к отправке в ${type.toUpperCase()}!`);
    state.openMenuId = null;
    renderNotes();
}

function exportToTxt(e, id) {
    e.stopPropagation();
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const plainText = tempDiv.innerText || tempDiv.textContent || '';

    const blob = new Blob([`${note.title}\n\n${plainText}`], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${note.title || 'Note'}.txt`;
    link.click();

    state.openMenuId = null;
    renderNotes();
}

function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const newNote = {
            id: Date.now(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            content: `<p>${escapeHtml(event.target.result)}</p>`,
            bgColor: null,
            pinned: false,
            reminder: null
        };
        state.notes.unshift(newNote);
        saveNotes();
        renderNotes();
        const toolsMenu = document.getElementById('tools-menu');
        if (toolsMenu) toolsMenu.classList.add('hidden');
    };
    reader.readAsText(file);
}

/* ОБУЧЕНИЕ И ИИ */
function openTutorialModal() {
    document.getElementById('tools-menu').classList.add('hidden');
    document.getElementById('tutorial-modal').classList.add('active');
}

function closeTutorialModal() {
    document.getElementById('tutorial-modal').classList.remove('active');
}

function checkAI() {
    document.getElementById('tools-menu').classList.add('hidden');
    window.location.href = '../WorkGens/index.html';
}

function saveAiKey() {
    const val = document.getElementById('ai-key-input').value.trim();
    if (val.endsWith(')')) {
        state.aiKey = val;
        localStorage.setItem('keeps_ai_key', val);
        showAlert('check_circle', 'ИИ ключ успешно сохранен!');
    } else {
        showAlert('warning', 'Ошибка: Ключ должен оканчиваться на символ ")"!');
    }
}

function openSettingsModal() {
    document.getElementById('tools-menu').classList.add('hidden');
    document.getElementById('theme-select').value = state.theme;
    document.getElementById('radius-select').value = state.radius;
    document.getElementById('ai-key-input').value = state.aiKey;
    if (typeof enhanceAllSelects === 'function') enhanceAllSelects(document.getElementById('settings-modal'));
    if (typeof refreshEnhancedSelect === 'function') {
        refreshEnhancedSelect(document.getElementById('theme-select'));
        refreshEnhancedSelect(document.getElementById('radius-select'));
    }
    document.getElementById('settings-modal').classList.add('active');
}

function copyNoteLink(e, id) {
    if (e) e.stopPropagation();
    const url = window.location.href.split('?')[0].split('#')[0] + '?note=' + id;
    navigator.clipboard.writeText(url).then(() => {
        showAlert('link', 'Ссылка на заметку скопирована');
    }).catch(() => {
        showAlert('link', url);
    });
    state.openMenuId = null;
    renderNotes();
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
}

function saveSettings() {
    state.theme = document.getElementById('theme-select').value;
    state.radius = document.getElementById('radius-select').value;

    localStorage.setItem('keeps_theme', state.theme);
    localStorage.setItem('keeps_radius', state.radius);

    applySettings();
    
    // Перерисовываем палитры и заметки под актуальную тему
    renderColorPalette('create-color-palette', changeCreateCardColor);
    if (state.activeNoteId) {
        renderColorPalette('edit-color-palette', changeEditCardColor);
        changeEditCardColor(state.editBgColor);
    }
    changeCreateCardColor(state.createBgColor);
    renderNotes();

    closeSettingsModal();
}

function applySettings() {
    if (state.theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    document.body.setAttribute('data-radius', state.radius);
}

function showAlert(icon, msg) {
    document.getElementById('custom-alert-icon').innerText = icon;
    document.getElementById('custom-alert-msg').innerText = msg;
    document.getElementById('custom-alert').classList.add('active');
}

function closeAlert() {
    document.getElementById('custom-alert').classList.remove('active');
}

function escapeHtml(text) {
    return text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
}

/* ===== Custom select ===== */
function toggleCSelect(uid) {
    var el = document.getElementById(uid);
    if (!el) return;
    var dd = el.querySelector('.cselect-dropdown');
    var open = dd && !dd.classList.contains('hidden');
    document.querySelectorAll('.cselect-dropdown').forEach(function(d) { d.classList.add('hidden'); });
    document.querySelectorAll('.cselect').forEach(function(c) { c.classList.remove('open'); });
    if (!open && dd) { dd.classList.remove('hidden'); el.classList.add('open'); }
}
function pickCSelect(uid, value, label) {
    var el = document.getElementById(uid);
    if (!el) return;
    el.dataset.value = value;
    var lab = el.querySelector('.cselect-label');
    if (lab) lab.textContent = label || value || '--';
    el.querySelectorAll('.cselect-option').forEach(function(o) {
        o.classList.toggle('active', o.getAttribute('data-value') === value);
    });
    var dd = el.querySelector('.cselect-dropdown');
    if (dd) dd.classList.add('hidden');
    el.classList.remove('open');
    var nativeId = el.getAttribute('data-native-id');
    if (nativeId) {
        var sel = document.getElementById(nativeId);
        if (sel) {
            sel.value = value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}
function enhanceNativeSelect(selectEl) {
    if (!selectEl || selectEl.tagName !== 'SELECT') return;
    if (selectEl.dataset.cselectEnhanced === '1') {
        refreshEnhancedSelect(selectEl);
        return;
    }
    selectEl.dataset.cselectEnhanced = '1';
    selectEl.classList.add('cselect-native-hidden');
    var wrapper = selectEl.closest('.custom-select-wrapper');
    if (wrapper) {
        var icon = wrapper.querySelector('.select-icon');
        if (icon) icon.style.display = 'none';
    }
    var uid = 'cs-native-' + (selectEl.id || ('auto' + Math.random().toString(36).slice(2, 8)));
    if (!selectEl.id) selectEl.id = uid + '-native';
    var box = document.createElement('div');
    box.className = 'cselect cselect-from-native';
    box.id = uid;
    box.setAttribute('data-native-id', selectEl.id);
    function rebuild() {
        var opts = Array.from(selectEl.options).map(function(o) {
            return { value: o.value, label: o.textContent };
        });
        var sel = selectEl.value;
        var selectedLabel = opts.length ? '--' : '—';
        opts.forEach(function(o) { if (o.value === sel) selectedLabel = o.label; });
        box.innerHTML =
            '<button type="button" class="cselect-trigger" onclick="toggleCSelect(\'' + uid + '\')">' +
            '<span class="cselect-label">' + escapeHtml(selectedLabel) + '</span>' +
            '<span class="material-symbols-rounded cselect-arrow">expand_more</span></button>' +
            '<div class="cselect-dropdown hidden">' +
            opts.map(function(o) {
                var act = o.value === sel ? ' active' : '';
                return '<div class="cselect-option' + act + '" data-value="' + escapeHtml(o.value) +
                    '" onclick="pickCSelect(\'' + uid + '\',\'' + String(o.value).replace(/'/g, "\\'") +
                    '\',\'' + String(o.label).replace(/'/g, "\\'") + '\')">' + escapeHtml(o.label) + '</div>';
            }).join('') + '</div>';
        box.dataset.value = sel;
    }
    rebuild();
    selectEl._cselectRebuild = rebuild;
    if (wrapper) wrapper.appendChild(box);
    else selectEl.parentNode.insertBefore(box, selectEl.nextSibling);
}
function refreshEnhancedSelect(selectEl) {
    if (selectEl && typeof selectEl._cselectRebuild === 'function') selectEl._cselectRebuild();
}
function enhanceAllSelects(root) {
    (root || document).querySelectorAll('select').forEach(function(sel) {
        enhanceNativeSelect(sel);
    });
}
