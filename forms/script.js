/* ==========================================
   1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЯ
   ========================================== */
let allForms = [];
let currentFormIndex = 0;
let currentQuestionIndex = 0;
let userAnswers = {};
let timerInterval = null;
let currentTimerSeconds = 0;
let holdTimerInterval = null;
let uploadedMediaBase64 = null;
let promptCallback = null;
let editingQuestionIndex = null; 
let isExplanationShowing = false;
let userEmail = '';
let flashcardStats = { know: 0, dontKnow: 0 };
let previewMode = null; // null | { type: 'form'|'question', formIndex, questionIndex?, token }
const PREVIEW_TOKEN_KEY = 'my_forms_preview_tokens';

let currentThemeId = null;
let currentRealQuestionIndex = 0;
let editingThemeId = null;
let selectedThemeIcon = 'school';
const THEME_PROGRESS_KEY = 'my_forms_theme_progress';
const THEME_PROGRESS_DAYS = 30;
const SESSION_PROGRESS_KEY = 'my_forms_session_progress';
const SESSION_PROGRESS_DAYS = 30;
const THEME_ICONS = [
    'school','menu_book','science','calculate','history_edu','language',
    'psychology','biotech','public','palette','music_note','sports_soccer',
    'code','terminal','cloud','bolt','lightbulb','favorite','star','flag',
    'extension','quiz','assignment','checklist','layers','category'
];

const defaultForm = {
    title: "Тестовая форма — все типы",
    mode: "learn",
    settings: {
        saveProgress: true,
        showCorrect: true,
        showWrong: true,
        defaultRequired: false
    },
    questions: [
        {
            type: "radio",
            title: "Какой язык используется для стилизации веб-страниц?",
            description: "Выберите один наиболее точный вариант.",
            options: ["HTML", "CSS", "JavaScript", "Python"],
            correctChoices: [1],
            required: true,
            hasExplanation: true,
            explanationTitle: "Справка",
            explanationText: "CSS (Cascading Style Sheets) отвечает за оформление HTML-документов."
        },
        {
            type: "true-false",
            title: "JavaScript можно запускать только в браузере.",
            description: "Верно или неверно?",
            options: ["Верно", "Неверно"],
            correctChoices: [1],
            required: true
        },
        {
            type: "checkbox",
            title: "Какие из перечисленного — языки программирования?",
            description: "Можно выбрать несколько вариантов.",
            options: ["Python", "HTML", "CSS", "JavaScript"],
            correctChoices: [0, 3],
            required: true
        },
        {
            type: "select",
            title: "Где хранятся данные форм в My Form (без сервера)?",
            options: ["На сервере Google", "В localStorage браузера", "Только в оперативной памяти", "В файле на диске C:"],
            correctChoices: [1],
            required: true
        },
        {
            type: "text",
            title: "Я [input] купить продукты (в настоящее время).",
            description: "Вставьте форму глагола «хотеть».",
            useInlineInput: true,
            correctText: ["хочу"],
            required: true
        },
        {
            type: "fill-blank",
            title: "Столицы",
            fillBlankTemplate: "Столица Франции — [Париж|Paris], столица Италии — [Рим|Rome].",
            blanks: [["Париж", "Paris"], ["Рим", "Rome"]],
            fbCaseSensitive: false,
            fbTrimSpaces: true,
            fbAcceptAlts: true,
            required: true
        },
        {
            type: "flashcard",
            title: "JavaScript (JS)",
            flashcardAnswer: "Язык программирования для интерактивности на веб-страницах (и не только)."
        },
        {
            type: "puzzle-drag",
            title: "Расставьте по порядку: 1 → 2 → 3",
            options: ["Второй", "Первый", "Третий"],
            correctChoices: [1, 0, 2]
        },
        {
            type: "info-slide",
            title: "Инфо-слайд",
            description: "Сюда можно добавить картинку, видео, аудио или просто текст-объяснение. Это не оценивается баллами."
        },
        {
            type: "draw-annotate",
            title: "Обводка по картинке",
            description: "Ученик рисует или обводит области на изображении (как в Edvibe).",
            comingSoon: true,
            comingSoonLabel: "Рисование / обводка"
        },
        {
            type: "youtube-media",
            title: "Видео с YouTube",
            description: "Инфо-слайд со встроенным роликом по ссылке.",
            comingSoon: true,
            comingSoonLabel: "YouTube iframe"
        },
        {
            type: "match-pairs",
            title: "Соедини пары",
            description: "Слева термин — справа определение, соединить линиями.",
            comingSoon: true,
            comingSoonLabel: "Matching"
        },
        {
            type: "audio-response",
            title: "Голосовой ответ",
            description: "Запись короткого ответа с микрофона.",
            comingSoon: true,
            comingSoonLabel: "Аудио-ответ"
        },
        {
            type: "hotspot",
            title: "Клик по области на картинке",
            description: "Нужно нажать на правильную зону изображения.",
            comingSoon: true,
            comingSoonLabel: "Hotspot"
        }
    ]
};

/** Типы, которые ещё нельзя создать в админке (только демо / JSON) */
const COMING_SOON_TYPES = {
    'draw-annotate': 'Рисование / обводка',
    'youtube-media': 'YouTube iframe',
    'match-pairs': 'Соедини пары',
    'audio-response': 'Голосовой ответ',
    'hotspot': 'Hotspot на картинке'
};

function isComingSoonQuestion(q) {
    if (!q) return false;
    if (q.comingSoon) return true;
    return !!(COMING_SOON_TYPES[q.type]);
}

function comingSoonLabel(q) {
    if (!q) return 'Скоро';
    return q.comingSoonLabel || COMING_SOON_TYPES[q.type] || q.type || 'Скоро';
}


/* App splash removed */

/* ===== Hub integration: ?form= , picker, topbar ===== */
function getFormQueryIndex() {
    try {
        var q = new URLSearchParams(window.location.search);
        if (!q.has('form')) return null;
        var raw = q.get('form');
        if (raw == null || String(raw).trim() === '') return null;
        raw = String(raw).trim();

        // 1) numeric array index
        var n = parseInt(raw, 10);
        if (!isNaN(n) && String(n) === raw && n >= 0) {
            if (n < allForms.length) return n;
            if (allForms.length) return Math.min(n, allForms.length - 1);
            return n;
        }

        // 2) form.id inside my_forms_data
        for (var i = 0; i < allForms.length; i++) {
            if (allForms[i] && allForms[i].id != null && String(allForms[i].id) === raw) return i;
        }

        // 3) registry id → legacyIndex
        try {
            var reg = JSON.parse(localStorage.getItem('mywork_registry_v1') || '[]');
            if (Array.isArray(reg)) {
                for (var j = 0; j < reg.length; j++) {
                    var p = reg[j];
                    if (!p || (p.type !== 'form' && p.type !== 'forms')) continue;
                    if (String(p.id) !== raw) continue;
                    if (p.legacyKey === 'my_forms_data' && p.legacyIndex != null) {
                        var li = parseInt(p.legacyIndex, 10);
                        if (!isNaN(li) && li >= 0) {
                            if (li < allForms.length) return li;
                            if (allForms.length) return Math.min(li, allForms.length - 1);
                        }
                    }
                }
            }
        } catch (eReg) {}

        // 4) last resort: numeric parse even with suffix
        if (!isNaN(n) && n >= 0 && allForms.length) return Math.min(n, allForms.length - 1);
    } catch (e) {}
    return null;
}

/** Stable id for a form (for future ID system / deep links) */
function ensureFormStableId(form, index) {
    if (!form) return null;
    if (form.id != null && String(form.id).trim() !== '') return String(form.id);
    form.id = 'form_' + (index != null ? index : 0) + '_' + Date.now().toString(36);
    return String(form.id);
}

function isStandalonePwa() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true;
}

function goToMyWorkHub() {
    window.location.href = '../index.html';
}

function dismissPwaWorkModal() {
    // Только на эту сессию — в standalone снова напомним при следующем запуске
    try { sessionStorage.setItem('myform_pwa_work_notice_session', '1'); } catch (e) {}
    var m = document.getElementById('pwa-work-modal');
    if (m) m.classList.remove('active');
}

function maybeShowPwaWorkModal() {
    if (!isStandalonePwa()) return;
    // Больше не прячем «навсегда» — отдельный PWA My Form не поддерживается
    try {
        if (sessionStorage.getItem('myform_pwa_work_notice_session') === '1') return;
    } catch (e) {}
    var m = document.getElementById('pwa-work-modal');
    if (m) m.classList.add('active');
}

function enterHubFormMode(formIndex) {
    document.body.classList.add('hub-form-mode');
    if (formIndex != null && formIndex >= 0 && formIndex < allForms.length) {
        currentFormIndex = formIndex;
    }
    hideFormPicker();
    updateAppTopbarTitle();
    // move tools menu under topbar actions if needed
    try {
        var menu = document.getElementById('tools-menu');
        var dd = document.querySelector('.app-topbar .tools-dropdown');
        var oldDd = document.querySelector('.forms-toolbar-container .tools-dropdown');
        if (menu && dd && oldDd && !dd.contains(menu)) {
            dd.appendChild(menu);
        }
    } catch (e) {}
}

function exitHubFormMode() {
    document.body.classList.remove('hub-form-mode');
}

function updateAppTopbarTitle() {
    var input = document.getElementById('app-file-title');
    var form = allForms[currentFormIndex];
    if (input) {
        input.value = (form && form.title) ? form.title : ('Форма ' + (currentFormIndex + 1));
        input.readOnly = true;
        delete input.dataset.cancel;
    }
}

function startQuickRename() {
    var input = document.getElementById('app-file-title');
    if (!input) return;
    input.readOnly = false;
    input.focus();
    input.select();
}

function finishQuickRename() {
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
    if (!name) {
        updateAppTopbarTitle();
        return;
    }
    if (!allForms[currentFormIndex]) return;
    allForms[currentFormIndex].title = name;
    allForms[currentFormIndex].updatedAt = Date.now();
    saveFormsToStorage();
    try { syncRegistryFormTitle(currentFormIndex, name); } catch (e) {}
    updateAppTopbarTitle();
    try { renderAllFormsUI(); } catch (e) {}
    if (typeof showAlert === 'function') {
        /* silent toast prefer */
    }
}

function syncRegistryFormTitle(idx, title) {
    try {
        var reg = JSON.parse(localStorage.getItem('mywork_registry_v1') || '[]');
        if (!Array.isArray(reg)) return;
        reg.forEach(function(p) {
            if (p && p.type === 'form' && p.legacyKey === 'my_forms_data' && p.legacyIndex === idx) {
                p.title = title;
                p.updatedAt = Date.now();
            }
        });
        localStorage.setItem('mywork_registry_v1', JSON.stringify(reg));
    } catch (e) {}
}

function showFormPicker() {
    exitHubFormMode();
    var screen = document.getElementById('form-picker-screen');
    if (!screen) return;
    screen.classList.remove('hidden');
    renderFormPickerList();
}

function hideFormPicker() {
    var screen = document.getElementById('form-picker-screen');
    if (screen) screen.classList.add('hidden');
}

function renderFormPickerList() {
    var list = document.getElementById('form-picker-list');
    if (!list) return;
    list.innerHTML = '';
    if (!allForms.length) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">Нет форм. Нажмите + чтобы создать.</p>';
        return;
    }
    allForms.forEach(function(f, idx) {
        var row = document.createElement('div');
        row.className = 'form-picker-item';
        var qn = (f.questions && f.questions.length) || 0;
        row.innerHTML =
            '<div class="fp-icon"><span class="material-symbols-rounded">assignment</span></div>' +
            '<div class="fp-meta"><div class="fp-title"></div><div class="fp-sub"></div></div>' +
            '<div class="fp-actions">' +
            '<button type="button" class="fp-ren" title="Переименовать"><span class="material-symbols-rounded">edit</span></button>' +
            '<button type="button" class="fp-del danger" title="В корзину"><span class="material-symbols-rounded">delete</span></button>' +
            '</div>';
        row.querySelector('.fp-title').textContent = f.title || ('Форма ' + (idx + 1));
        row.querySelector('.fp-sub').textContent = qn + ' вопр.';
        row.addEventListener('click', function(e) {
            if (e.target.closest('.fp-actions')) return;
            openFormByIndex(idx);
        });
        row.querySelector('.fp-ren').onclick = function(e) {
            e.stopPropagation();
            renameFormFromPicker(idx);
        };
        row.querySelector('.fp-del').onclick = function(e) {
            e.stopPropagation();
            deleteFormFromPicker(idx);
        };
        list.appendChild(row);
    });
}

function openFormByIndex(idx) {
    if (idx < 0 || idx >= allForms.length) return;
    currentFormIndex = idx;
    try {
        var u = new URL(window.location.href);
        // Prefer stable form.id; fall back to array index (hub still uses legacyIndex)
        var form = allForms[idx];
        var linkVal = form && form.id != null && String(form.id).trim() !== '' ? String(form.id) : String(idx);
        if (form && (form.id == null || String(form.id).trim() === '')) {
            try { ensureFormStableId(form, idx); linkVal = String(form.id); saveFormsToStorage(); } catch (eId) {}
        }
        u.searchParams.set('form', linkVal);
        history.replaceState(null, '', u.toString());
    } catch (e) {}
    enterHubFormMode(idx);
    renderAllFormsUI();
    loadCurrentForm();
}

function renameFormFromPicker(idx) {
    var f = allForms[idx];
    if (!f) return;
    showPrompt('Название формы', f.title || '', function(name) {
        if (name === null) return;
        name = String(name).trim();
        if (!name) return;
        f.title = name;
        f.updatedAt = Date.now();
        saveFormsToStorage();
        try { syncRegistryFormTitle(idx, name); } catch (e) {}
        renderFormPickerList();
        try { renderAllFormsUI(); } catch (e) {}
    });
}

function deleteFormFromPicker(idx) {
    if (allForms.length <= 1) {
        showAlert('Нельзя удалить единственную форму', 'warning');
        return;
    }
    var f = allForms[idx];
    showConfirm('В корзину?', '«' + ((f && f.title) || 'Форма') + '» будет удалена из списка. На главной My Work можно будет убрать из реестра.', function() {
        // soft: remove form from array (hub trash is separate registry — here delete form data)
        allForms.splice(idx, 1);
        saveFormsToStorage();
        if (currentFormIndex >= allForms.length) currentFormIndex = allForms.length - 1;
        renderFormPickerList();
        try { renderAllFormsUI(); } catch (e) {}
        showAlert('Форма удалена', 'delete');
    });
}

function initHubFormRouting() {
    maybeShowPwaWorkModal();
    var idx = getFormQueryIndex();
    if (idx !== null) {
        if (idx >= allForms.length) idx = 0;
        enterHubFormMode(idx);
        currentFormIndex = idx;
        return { picker: false, index: idx };
    }
    // no ?form= → full screen picker
    showFormPicker();
    return { picker: true, index: null };
}


document.addEventListener('DOMContentLoaded', () => {
    loadFormsFromStorage();
    applyShareParamsFromUrl();
    var enteredPreview = applyPreviewFromUrl();
    initSettings();
    var hubRoute = { picker: false };
    if (!enteredPreview) {
        try { hubRoute = initHubFormRouting(); } catch (e) { console.warn(e); hubRoute = { picker: false }; }
        if (!hubRoute.picker) {
            renderAllFormsUI();
            loadCurrentForm();
        }
        checkOldDataMigration();
    }
    try { enhanceAllSelects(document); } catch (e) { console.warn('enhanceAllSelects', e); }

    // Предзагрузка голосов TTS
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    initOfflineManager();
    registerServiceWorker();
});

/* Проверка наличия старых данных при входе */
function checkOldDataMigration() {
    const oldData = localStorage.getItem('forms') || localStorage.getItem('quiz_data_old') || localStorage.getItem('app_forms');
    const alreadyMigrated = localStorage.getItem('is_migrated_to_new');

    if (oldData && !alreadyMigrated) {
        try {
            const parsedForms = JSON.parse(oldData);
            if (Array.isArray(parsedForms) && parsedForms.length > 0) {
                const listContainer = document.getElementById('migrationFormsList');
                if (listContainer) {
                    listContainer.innerHTML = parsedForms.map(f => `• ${f.title || 'Без названия'}`).join('<br>');
                }
                const modal = document.getElementById('migrationModal');
                if (modal) modal.classList.add('active');
            }
        } catch (e) {
            console.error('Ошибка при чтении старых данных:', e);
        }
    }
}

function performMigration() {
    try {
        const oldData = localStorage.getItem('forms') || localStorage.getItem('quiz_data_old') || localStorage.getItem('app_forms');
        if (oldData) {
            const parsedForms = JSON.parse(oldData);
            const mergedForms = [...allForms, ...parsedForms];
            
            allForms = mergedForms;
            saveFormsToStorage();
            localStorage.setItem('is_migrated_to_new', 'true');
            
            closeMigrationModal();
            renderAllFormsUI();
            loadCurrentForm();
            showAlert('Формы успешно перенесены в новую версию!', 'check_circle');
        }
    } catch (e) {
        showAlert('Ошибка при импорте: ' + e.message, 'error');
    }
}

function closeMigrationModal() {
    const modal = document.getElementById('migrationModal');
    if (modal) modal.classList.remove('active');
    localStorage.setItem('is_migrated_to_new', 'true');
}

/* ==========================================
   2. УПРАВЛЕНИЕ ХРАНИЛИЩЕМ (LOCALSTORAGE)
   ========================================== */
function loadFormsFromStorage() {
    const saved = localStorage.getItem('my_forms_data');
    if (saved) {
        try {
            allForms = JSON.parse(saved);
        } catch (e) {
            console.error("Ошибка чтения из localStorage", e);
            allForms = [JSON.parse(JSON.stringify(defaultForm))];
        }
    } else {
        allForms = [JSON.parse(JSON.stringify(defaultForm))];
        saveFormsToStorage();
    }
    if (!Array.isArray(allForms) || !allForms.length) {
        allForms = [JSON.parse(JSON.stringify(defaultForm))];
    }
    var changed = false;
    allForms.forEach(function(f, i) {
        if (f && (f.id == null || String(f.id).trim() === '')) {
            ensureFormStableId(f, i);
            changed = true;
        }
    });
    if (changed) {
        try { saveFormsToStorage(); } catch (e2) {}
    }
}

function saveFormsToStorage() {
    localStorage.setItem('my_forms_data', JSON.stringify(allForms));
    if (typeof markOfflineEditIfNeeded === 'function') markOfflineEditIfNeeded();
}

/* ==========================================
   3. НАСТРОЙКИ И МОДАЛЬНЫЕ ОКНА
   ========================================== */
function initSettings() {
    const savedTheme = localStorage.getItem('app_theme') || 'light';
    setTheme(savedTheme, false);

    const savedRadius = localStorage.getItem('app_radius') || 'rounded';
    setRadius(savedRadius, false);

    const isCompact = localStorage.getItem('compact_forms_mode') === 'true';
    const toggleInput = document.getElementById('toggle-compact-forms');
    if (toggleInput) toggleInput.checked = isCompact;
    applyFormsLayout(isCompact);

    const liquidOn = localStorage.getItem('liquid_glass_mode') === 'true';
    const liquidToggle = document.getElementById('toggle-liquid-glass');
    if (liquidToggle) liquidToggle.checked = liquidOn;
    applyLiquidGlass(liquidOn);
}

function toggleLiquidGlass(on) {
    localStorage.setItem('liquid_glass_mode', on ? 'true' : 'false');
    applyLiquidGlass(!!on);
}

function applyLiquidGlass(on) {
    document.body.classList.toggle('liquid-glass', !!on);
}

function setTheme(themeName, save = true) {
    if (themeName === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    if (save) localStorage.setItem('app_theme', themeName);
}

function setRadius(radiusName, save = true) {
    document.body.setAttribute('data-radius', radiusName);
    const radiusSelect = document.getElementById('settings-radius-select');
    if (radiusSelect) radiusSelect.value = radiusName;
    if (save) localStorage.setItem('app_radius', radiusName);
}

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        try { enhanceAllSelects(modal); } catch (e) {}
        modal.classList.add('active');
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
}

function toggleFormsLayout(isCompact) {
    localStorage.setItem('compact_forms_mode', isCompact);
    applyFormsLayout(isCompact);
}

function applyFormsLayout(isCompact) {
    const selectEl = document.getElementById('forms-select-wrapper');
    const listEl = document.getElementById('forms-tabs-list');

    if (isCompact) {
        if (selectEl) selectEl.classList.remove('hidden');
        if (listEl) listEl.classList.add('hidden');
    } else {
        if (selectEl) selectEl.classList.add('hidden');
        if (listEl) listEl.classList.remove('hidden');
    }
}

function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.toggle('hidden');
}

function toggleExplanationFields(checkbox) {
    const container = document.getElementById('explanationFieldsContainer');
    if (container) {
        container.style.display = checkbox.checked ? 'block' : 'none';
    }
}

function toggleAnswerExplanationsFields(checkbox) {
    const container = document.getElementById('answerExplanationsContainer');
    if (container) {
        container.style.display = checkbox.checked ? 'block' : 'none';
    }
}

function showAlert(message, icon = 'info') {
    const alertModal = document.getElementById('custom-alert');
    const alertMsg = document.getElementById('custom-alert-msg');
    const alertIcon = document.getElementById('custom-alert-icon');
    
    if (alertMsg) alertMsg.textContent = message;
    if (alertIcon) alertIcon.textContent = icon;
    if (alertModal) {
        // поверх всех модалок и сайдбаров
        alertModal.style.zIndex = '40000';
        alertModal.classList.add('active');
        try { document.body.appendChild(alertModal); } catch (e) {}
    }
}

function closeAlert() {
    const alertModal = document.getElementById('custom-alert');
    if (alertModal) alertModal.classList.remove('active');
}

function showConfirm(title, text, onConfirm) {
    const alertModal = document.getElementById('custom-alert');
    if (!alertModal) return;

    const card = alertModal.querySelector('.custom-alert-card');
    if (!card) return;

    const originalContent = card.innerHTML;

    card.innerHTML = `
        <h3 style="margin-bottom: 8px; font-size: 1.1rem; color: var(--text-color);">${title}</h3>
        <p style="margin-bottom: 20px; font-size: 0.95rem; color: var(--text-muted);">${text}</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="confirm-cancel-btn" class="q-action-btn" style="padding: 8px 16px;">Отмена</button>
            <button id="confirm-ok-btn" class="btn" style="padding: 8px 16px; background: #d32f2f;">Удалить</button>
        </div>
    `;

    alertModal.style.zIndex = '40000';
    try { document.body.appendChild(alertModal); } catch (e) {}
    alertModal.classList.add('active');

    const restoreAndClose = () => {
        alertModal.classList.remove('active');
        setTimeout(() => { card.innerHTML = originalContent; }, 200);
    };

    document.getElementById('confirm-cancel-btn').onclick = restoreAndClose;
    document.getElementById('confirm-ok-btn').onclick = () => {
        restoreAndClose();
        if (typeof onConfirm === 'function') onConfirm();
    };
}

function showInlineErrorModal(onDisable, onFix) {
    const alertModal = document.getElementById('custom-alert');
    if (!alertModal) return;

    const card = alertModal.querySelector('.custom-alert-card');
    if (!card) return;

    const originalContent = card.innerHTML;

    card.innerHTML = `
        <div style="text-align: center;">
            <span class="material-symbols-rounded" style="font-size: 48px; color: #f59e0b; margin-bottom: 8px;">warning</span>
            <h3 style="margin-bottom: 8px; font-size: 1.1rem; color: var(--text-color);">Ошибка метки [input]</h3>
            <p style="margin-bottom: 20px; font-size: 0.93rem; color: var(--text-muted); line-height: 1.4;">
                В данном вопросе отсутствует метка <code>[input]</code>, но включена опция инлайнового ввода.
            </p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button id="inline-disable-btn" class="q-action-btn" style="padding: 8px 14px;">Отключить Input</button>
                <button id="inline-fix-btn" class="btn" style="padding: 8px 14px;">Исправить самостоятельно</button>
            </div>
        </div>
    `;

    alertModal.classList.add('active');

    const restoreAndClose = () => {
        alertModal.classList.remove('active');
        setTimeout(() => { card.innerHTML = originalContent; }, 200);
    };

    document.getElementById('inline-disable-btn').onclick = () => {
        restoreAndClose();
        if (typeof onDisable === 'function') onDisable();
    };

    document.getElementById('inline-fix-btn').onclick = () => {
        restoreAndClose();
        if (typeof onFix === 'function') onFix();
    };
}

function showPrompt(title, defaultValue = '', callback) {
    const promptModal = document.getElementById('custom-prompt');
    const promptTitle = document.getElementById('custom-prompt-title');
    const promptInput = document.getElementById('custom-prompt-input');

    if (!promptModal || !promptInput) return;

    if (promptTitle) promptTitle.textContent = title;
    promptInput.value = defaultValue;
    promptCallback = callback;

    promptModal.classList.add('active');
    setTimeout(() => promptInput.focus(), 100);
}

function closePrompt(isConfirm) {
    const promptModal = document.getElementById('custom-prompt');
    const promptInput = document.getElementById('custom-prompt-input');

    if (promptModal) promptModal.classList.remove('active');

    if (promptCallback) {
        if (isConfirm) {
            promptCallback(promptInput.value);
        } else {
            promptCallback(null);
        }
        promptCallback = null;
    }
}

function switchFormFromSelect(index) { switchForm(index); }

/* ==========================================
   4. РЕНДЕР ВКЛАДОК И ВЫБОР ФОРМ
   ========================================== */
function getFormMode(form) {
    if (previewMode) return 'learn';
    var mode = (form && form.mode) ? form.mode : 'test';
    // Test недоступен офлайн — временно Learn (в storage mode не трогаем)
    if (mode === 'test' && typeof isOnline === 'function' && !isOnline()) {
        return 'learn';
    }
    return mode;
}

function setFormMode(index, mode) {
    if (!allForms[index]) return;
    if (mode === 'test' && typeof isOnline === 'function' && !isOnline()) {
        hideFormContextMenu();
        showAlert('Режим Test недоступен без интернета. Используйте Learn или FlashCards.', 'wifi_off');
        return;
    }
    allForms[index].mode = mode;
    saveFormsToStorage();
    renderAllFormsUI();
    if (index === currentFormIndex) loadCurrentForm();
    hideFormContextMenu();
    const names = { test: 'Test', learn: 'Learn', flashcards: 'FlashCards' };
    showAlert('Режим формы: ' + (names[mode] || mode), 'check_circle');
}

function showFormContextMenu(e, formIndex) {
    hideFormContextMenu();
    const menu = document.createElement('div');
    menu.id = 'form-context-menu';
    menu.className = 'form-context-menu';
    const currentMode = getFormMode(allForms[formIndex]);
    const offline = (typeof isOnline === 'function' && !isOnline());

    function item(mode, icon, title, small, enabled) {
        var active = currentMode === mode && (mode !== 'test' || !offline);
        var cls = 'ctx-item' + (active ? ' active' : '') + (!enabled ? ' ctx-item-disabled' : '');
        var el = document.createElement('div');
        el.className = cls;
        el.innerHTML = '<span class="material-symbols-rounded">' + icon + '</span> ' + title +
            '<small>' + small + '</small>';
        el.addEventListener('click', function(ev) {
            ev.stopPropagation();
            if (!enabled) {
                showAlert('Test только онлайн', 'wifi_off');
                return;
            }
            setFormMode(formIndex, mode);
        });
        return el;
    }

    var title = document.createElement('div');
    title.className = 'ctx-title';
    title.innerHTML = 'Режим формы' + (offline ? ' <span style="font-weight:500;text-transform:none;opacity:.8;">(офлайн)</span>' : '');
    menu.appendChild(title);
    menu.appendChild(item('test', 'quiz', 'Test', offline ? 'Нужен интернет' : 'Обычный тест (по умолчанию)', !offline));
    menu.appendChild(item('learn', 'school', 'Learn', 'Сразу показывать верный/неверный', true));
    menu.appendChild(item('flashcards', 'style', 'FlashCards', 'Карточки: знаю / не знаю', true));

    document.body.appendChild(menu);
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 220);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    setTimeout(() => {
        document.addEventListener('click', hideFormContextMenu, { once: true });
        document.addEventListener('contextmenu', hideFormContextMenu, { once: true });
    }, 10);
}

function hideFormContextMenu() {
    const m = document.getElementById('form-context-menu');
    if (m) m.remove();
}

function renderAllFormsUI() {
    const selectEl = document.getElementById('forms-tabs-select');
    const listEl = document.getElementById('forms-tabs-list');

    if (selectEl) selectEl.innerHTML = '';
    if (listEl) listEl.innerHTML = '';

    allForms.forEach((form, index) => {
        const formTitle = form.title || `Форма №${index + 1}`;
        const mode = getFormMode(form);
        const modeBadge = mode === 'test' ? '' : `<span class="mode-badge mode-${mode}">${mode === 'learn' ? 'Learn' : 'FC'}</span>`;

        if (selectEl) {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = formTitle + (mode !== 'test' ? ` [${mode}]` : '');
            if (index === currentFormIndex) opt.selected = true;
            selectEl.appendChild(opt);
        }

        if (listEl) {
            const tab = document.createElement('div');
            tab.className = `form-tab ${index === currentFormIndex ? 'active-tab' : ''}`;
            tab.dataset.formIndex = index;
            
            tab.innerHTML = `
                <span class="tab-title">${formTitle}</span>
                ${modeBadge}
                <button class="edit-tab-btn" onclick="renameForm(${index}, event)" title="Переименовать форму">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button class="delete-tab-btn" onclick="deleteForm(${index}, event)" title="Удалить форму">
                    <span class="material-symbols-rounded">close</span>
                </button>
            `;

            tab.onclick = (e) => {
                if (e.target.closest('.edit-tab-btn, .delete-tab-btn')) return;
                switchForm(index);
            };
            tab.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showFormContextMenu(e, index);
            };
            listEl.appendChild(tab);
        }
    });

    // обновить кастомный select после пересборки option
    try {
        var fs = document.getElementById('forms-tabs-select');
        if (fs) {
            if (fs.dataset.cselectDone === '1') {
                // пересоздать UI
                var old = fs.nextElementSibling;
                if (old && old.classList.contains('cselect')) old.remove();
                fs.dataset.cselectDone = '0';
                fs.classList.remove('cselect-native-hidden');
                fs.removeAttribute('aria-hidden');
                fs.tabIndex = 0;
            }
            enhanceNativeSelect(fs);
        }
    } catch (e) { console.warn(e); }
}

function renameForm(index, event) {
    if (event) event.stopPropagation();
    const form = allForms[index];
    if (!form) return;

    showPrompt("Введите новое название для формы:", form.title || `Форма №${index + 1}`, (newTitle) => {
        if (newTitle !== null && newTitle.trim() !== "") {
            allForms[index].title = newTitle.trim();
            saveFormsToStorage();
            renderAllFormsUI();
            if (!document.getElementById('admin-screen').classList.contains('hidden')) {
                renderAdminQuestionsList();
            }
            showAlert('Форма успешно переименована!', 'check_circle');
        }
    });
}

function deleteForm(index, event) {
    if (event) event.stopPropagation();

    if (allForms.length <= 1) {
        showAlert('Нельзя удалить единственную форму!', 'warning');
        return;
    }

    const formTitle = allForms[index].title || `Форму №${index + 1}`;

    showConfirm(`Удалить форму?`, `Вы действительно хотите удалить "${formTitle}"?`, () => {
        allForms.splice(index, 1);

        if (currentFormIndex >= allForms.length) {
            currentFormIndex = allForms.length - 1;
        } else if (currentFormIndex === index) {
            currentFormIndex = Math.max(0, index - 1);
        }

        saveFormsToStorage();
        renderAllFormsUI();
        loadCurrentForm();

        if (!document.getElementById('admin-screen').classList.contains('hidden')) {
            renderAdminQuestionsList();
        }

        showAlert('Форма успешно удалена!', 'delete');
    });
}

function switchForm(index) {
    currentFormIndex = parseInt(index);
    if (document.body.classList.contains('hub-form-mode')) {
        try {
            var u = new URL(window.location.href);
            u.searchParams.set('form', String(currentFormIndex));
            history.replaceState(null, '', u.toString());
        } catch (e) {}
        updateAppTopbarTitle();
    }
    renderAllFormsUI();
    loadCurrentForm();
}

/* ==========================================
   5. ДВИЖОК ТЕСТИРОВАНИЯ
   ========================================== */
function loadCurrentForm() {
    currentQuestionIndex = 0;
    userAnswers = {};
    isExplanationShowing = false;
    flashcardStats = { know: 0, dontKnow: 0 };
    if (typeof stopSpeaking === 'function') stopSpeaking();
    
    document.getElementById('quiz-screen').classList.remove('hidden');
    document.getElementById('quiz-box').classList.remove('hidden');
    document.getElementById('result-box').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    var _tc = document.getElementById('theme-complete-box');
    if (_tc) _tc.classList.add('hidden');

    const form = allForms[currentFormIndex];
    if (form) {
        ensureFormThemes(form);
        // восстановить ответы / позицию, если включено «Сохранять прохождения»
        if (isSaveProgressEnabled(form)) {
            var prog = restoreSessionProgress();
            if (prog) {
                userAnswers = prog.answers || {};
                if (prog.themeId) currentThemeId = prog.themeId;
                if (typeof prog.questionIndex === 'number') currentQuestionIndex = prog.questionIndex;
                if (typeof prog.realIndex === 'number') currentRealQuestionIndex = prog.realIndex;
                if (prog.flashcardStats) flashcardStats = prog.flashcardStats;
            }
        } else {
            // режим без сохранения: сбросить сессию и галочки тем этой формы
            clearSessionProgress(currentFormIndex);
            try {
                var map = loadThemeProgress();
                var prefix = currentFormIndex + '::';
                var changed = false;
                Object.keys(map).forEach(function(k) {
                    if (k.indexOf(prefix) === 0) { delete map[k]; changed = true; }
                });
                if (changed) saveThemeProgress(map);
            } catch (e) {}
        }
        initCurrentTheme();
        renderThemeUI();
    }
    const needsEmail = form && form.settings && form.settings.isTestMode && form.settings.teacherEmail;

    if (needsEmail && !userEmail) {
        showPrompt('Введите ваш email (для связи с преподавателем):', '', (email) => {
            if (email && email.trim()) {
                userEmail = email.trim();
            }
            renderQuestion();
        });
    } else {
        renderQuestion();
    }
}

function parseYouTubeId(url) {
    if (!url) return null;
    var s = String(url).trim();
    var m = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
}

function renderYouTubeEmbed(url) {
    var id = parseYouTubeId(url);
    if (!id) return '';
    var src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?rel=0';
    return '<div class="yt-embed-wrap"><iframe src="' + src + '" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
}

function renderMediaHTML(url, opts) {
    opts = opts || {};
    if (!url) return '';
    var yt = parseYouTubeId(url);
    if (yt || /youtube\.com|youtu\.be/i.test(url)) {
        return renderYouTubeEmbed(url) || '';
    }
    if (url.startsWith('data:video') || url.match(/\.(mp4|webm|ogv)$/i)) {
        return '<div style="text-align:center; margin-bottom:15px;"><video src="' + url + '" controls style="max-width:100%; border-radius:12px;"></video></div>';
    }
    if (url.startsWith('data:audio') || url.match(/\.(mp3|wav|ogg)$/i)) {
        return '<div style="text-align:center; margin-bottom:15px;"><audio src="' + url + '" controls style="width:100%;"></audio></div>';
    }
    // image (+ optional draw)
    if (opts.allowDraw) {
        var uid = 'draw-' + Date.now();
        return (
            '<div class="draw-toolbar" data-for="' + uid + '">' +
            '<button type="button" class="active" data-tool="pen" onclick="setDrawTool(this)"><span class="material-symbols-rounded" style="font-size:16px;">edit</span>Карандаш</button>' +
            '<button type="button" data-tool="eraser" onclick="setDrawTool(this)"><span class="material-symbols-rounded" style="font-size:16px;">ink_eraser</span>Ластик</button>' +
            '<button type="button" onclick="clearDrawCanvas(\'' + uid + '\')"><span class="material-symbols-rounded" style="font-size:16px;">delete</span>Очистить</button>' +
            '<span style="font-size:11px;color:var(--text-muted);align-self:center;">Сбросится после ответа</span>' +
            '</div>' +
            '<div class="draw-media-wrap" id="' + uid + '-wrap" style="text-align:center;">' +
            '<img id="' + uid + '-img" src="' + url + '" alt="" onload="initDrawCanvas(\'' + uid + '\')">' +
            '<canvas id="' + uid + '" class="draw-canvas"></canvas>' +
            '</div>'
        );
    }
    return '<div style="text-align:center; margin-bottom:15px;"><img src="' + url + '" style="max-width:100%; border-radius:12px;"></div>';
}

/* Drawing helpers (ephemeral — not saved) */
var _drawTool = 'pen';
var _drawColor = '#ea4335';
function setDrawTool(btn) {
    _drawTool = btn.getAttribute('data-tool') || 'pen';
    var bar = btn.parentElement;
    if (bar) bar.querySelectorAll('button[data-tool]').forEach(function(b){ b.classList.toggle('active', b === btn); });
}
function clearDrawCanvas(id) {
    var c = document.getElementById(id);
    if (!c) return;
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
}
function initDrawCanvas(id) {
    var canvas = document.getElementById(id);
    var img = document.getElementById(id + '-img');
    var wrap = document.getElementById(id + '-wrap');
    if (!canvas || !img) return;
    var w = img.clientWidth || img.naturalWidth;
    var h = img.clientHeight || img.naturalHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    var drawing = false;
    function pos(e) {
        var r = canvas.getBoundingClientRect();
        var t = e.touches && e.touches[0];
        var x = (t ? t.clientX : e.clientX) - r.left;
        var y = (t ? t.clientY : e.clientY) - r.top;
        return { x: x * (canvas.width / r.width), y: y * (canvas.height / r.height) };
    }
    function start(e) { e.preventDefault(); drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e) {
        if (!drawing) return;
        e.preventDefault();
        var p = pos(e);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (_drawTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 16;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = _drawColor;
            ctx.lineWidth = 3;
        }
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    }
    function end() { drawing = false; ctx.beginPath(); }
    canvas.onmousedown = start;
    canvas.onmousemove = move;
    canvas.onmouseup = end;
    canvas.onmouseleave = end;
    canvas.ontouchstart = start;
    canvas.ontouchmove = move;
    canvas.ontouchend = end;
}


function getFlashcardAnswerText(q) {
    if (!q) return '—';
    if (q.type === 'flashcard') return q.flashcardAnswer || 'Пояснение отсутствует';
    if (q.type === 'text') return (q.correctText || []).join(', ') || '—';
    if (q.type === 'info-slide') return q.description || 'Инфо-слайд';
    if (q.options && q.correctChoices) {
        return q.correctChoices.map(i => q.options[i]).filter(Boolean).join(', ') || '—';
    }
    return '—';
}

function renderFlashcardMode() {
    const form = allForms[currentFormIndex];
    var _active = resolveActiveQuestion();
    const q = _active.q;
    const total = _active.activeCount || ((form && form.questions) ? form.questions.length : 0);
    currentRealQuestionIndex = _active.realIdx;

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');

    if (!q) {
        document.getElementById('question-body').innerHTML = '<p style="text-align:center;color:var(--text-muted);">Нет вопросов для карточек.</p>';
        return;
    }

    document.getElementById('current-number').textContent = currentQuestionIndex + 1;
    document.getElementById('total-number').textContent = total;
    document.getElementById('progress').style.width = (total ? ((currentQuestionIndex + 1) / total) * 100 : 0) + '%';
    document.getElementById('timer-display').classList.add('hidden');
    document.getElementById('hint-btn').classList.add('hidden');
    document.getElementById('hint-box').classList.add('hidden');

    const answerText = getFlashcardAnswerText(q);
    const body = document.getElementById('question-body');
    const optsHtml = q.options
        ? '<div style="margin-top:12px; text-align:left; font-size:14px;">' + q.options.map(function(o) { return '<div>• ' + escapeHtml(String(o)) + '</div>'; }).join('') + '</div>'
        : '';

    body.innerHTML =
        '<div style="text-align:center; margin-bottom:8px; font-size:13px; color:var(--text-muted);">' +
            'FlashCards • ' + escapeHtml(q.type || '') + ' &nbsp;|&nbsp; ✓ ' + flashcardStats.know + ' &nbsp; ✗ ' + flashcardStats.dontKnow +
        '</div>' +
        '<div class="flashcard-container" id="fc-card" onclick="this.classList.toggle(\'flipped\')" style="min-height:240px;">' +
            '<div class="flashcard-inner">' +
                '<div class="flashcard-side flashcard-front">' +
                    '<span class="material-symbols-rounded" style="font-size:28px; color:var(--accent-color); margin-bottom:8px;">style</span>' +
                    '<p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Пробел или касание — перевернуть</p>' +
                    '<p style="font-size:17px; font-weight:600; margin:0; line-height:1.4;">' + escapeHtml(q.title || '') + '</p>' +
                    (q.description ? '<p style="font-size:13px; color:var(--text-muted); margin-top:10px;">' + escapeHtml(q.description) + '</p>' : '') +
                    optsHtml +
                '</div>' +
                '<div class="flashcard-side flashcard-back">' +
                    '<span class="material-symbols-rounded" style="font-size:28px; color:var(--accent-color); margin-bottom:8px;">lightbulb</span>' +
                    '<p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Ответ</p>' +
                    '<p style="font-size:16px; font-weight:500; margin:0; line-height:1.45;">' + escapeHtml(answerText) + '</p>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div style="display:flex; gap:12px; margin-top:20px;">' +
            '<button type="button" class="btn" id="fc-btn-dontknow" onclick="flashcardDontKnow()" style="flex:1; background:transparent; color:var(--text-color); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; gap:6px;">' +
                '<span class="material-symbols-rounded">arrow_back</span> Не знаю <kbd class="fc-kbd">←</kbd>' +
            '</button>' +
            '<button type="button" class="btn" id="fc-btn-know" onclick="flashcardKnow()" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">' +
                'Знаю <kbd class="fc-kbd">→</kbd> <span class="material-symbols-rounded">arrow_forward</span>' +
            '</button>' +
        '</div>' +
        '<p style="text-align:center; font-size:12px; color:var(--text-muted); margin-top:12px;">' +
            '<kbd class="fc-kbd">Space</kbd> перевернуть · <kbd class="fc-kbd">←</kbd> не знаю · <kbd class="fc-kbd">→</kbd> знаю' +
        '</p>';
}

function flashcardKnow() {
    flashcardStats.know++;
    userAnswers[currentRealQuestionIndex] = 'know';
    persistSessionProgress();
    var _al = getActiveQuestionList();
    if (currentQuestionIndex < _al.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        calculateResults();
    }
}

function flashcardDontKnow() {
    flashcardStats.dontKnow++;
    userAnswers[currentRealQuestionIndex] = 'dontknow';
    persistSessionProgress();
    var _al = getActiveQuestionList();
    if (currentQuestionIndex < _al.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        calculateResults();
    }
}

function flipFlashcard() {
    var card = document.getElementById('fc-card');
    if (card) card.classList.toggle('flipped');
}

function isFlashcardsModeActive() {
    var form = allForms[currentFormIndex];
    if (!form || getFormMode(form) !== 'flashcards') return false;
    var quiz = document.getElementById('quiz-box');
    if (!quiz || quiz.classList.contains('hidden')) return false;
    var result = document.getElementById('result-box');
    if (result && !result.classList.contains('hidden')) return false;
    return !!document.getElementById('fc-card');
}

document.addEventListener('keydown', function(e) {
    if (!isFlashcardsModeActive()) return;
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;

    // Space = flip
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        flipFlashcard();
        return;
    }
    // ← = Не знаю (dontKnow)
    if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
        e.preventDefault();
        flashcardDontKnow();
        return;
    }
    // → = Знаю (know)
    if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
        e.preventDefault();
        flashcardKnow();
        return;
    }
});


function resolveActiveQuestion() {
    var form = allForms[currentFormIndex];
    if (!form) return { form: null, q: null, list: [], realIdx: 0, activeCount: 0 };
    ensureFormThemes(form);
    var list = getActiveQuestionList();
    if (!list.length) return { form: form, q: null, list: list, realIdx: 0, activeCount: 0 };
    if (currentQuestionIndex >= list.length) currentQuestionIndex = Math.max(0, list.length - 1);
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;
    var item = list[currentQuestionIndex];
    return { form: form, q: item.q, list: list, realIdx: item.idx, activeCount: list.length };
}

function renderQuestion() {
    stopTimer();
    stopHoldTimer();
    stopSpeaking();
    isExplanationShowing = false;

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Далее';
    }

    var _active = resolveActiveQuestion();
    const form = _active.form;
    if (!form || !form.questions || form.questions.length === 0 || !_active.q) {
        document.getElementById('question-body').innerHTML = '<p style="text-align:center; color:var(--text-muted);">В этой теме пока нет вопросов. Войдите в Панель Админа, чтобы добавить их.</p>';
        document.getElementById('current-number').textContent = '0';
        document.getElementById('total-number').textContent = '0';
        document.getElementById('progress').style.width = '0%';
        if (nextBtn) nextBtn.classList.add('hidden');
        return;
    }

    // Режим FlashCards
    if (getFormMode(form) === 'flashcards') {
        renderFlashcardMode();
        return;
    }

    if (nextBtn) nextBtn.classList.remove('hidden');
    const q = _active.q;
    currentRealQuestionIndex = _active.realIdx;

    // Вопросы «Скоро» — заглушка, не ломаем квиз
    if (typeof isComingSoonQuestion === 'function' && isComingSoonQuestion(q)) {
        if (nextBtn) nextBtn.classList.remove('hidden');
        document.getElementById('current-number').textContent = currentQuestionIndex + 1;
        document.getElementById('total-number').textContent = _active.activeCount || form.questions.length;
        const progressPercent = ((currentQuestionIndex + 1) / (_active.activeCount || form.questions.length || 1)) * 100;
        document.getElementById('progress').style.width = progressPercent + '%';
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) timerDisplay.classList.add('hidden');
        const hintBtn = document.getElementById('hint-btn');
        const hintBox = document.getElementById('hint-box');
        if (hintBtn) hintBtn.classList.add('hidden');
        if (hintBox) hintBox.classList.add('hidden');
        const body = document.getElementById('question-body');
        const label = comingSoonLabel(q);
        body.innerHTML =
            '<div class="coming-soon-card">' +
            '<span class="coming-soon-badge">Скоро</span>' +
            '<h3 style="margin:12px 0 8px;font-weight:600;">' + escapeHtml(q.title || label) + '</h3>' +
            (q.description ? '<p style="color:var(--text-muted);font-size:0.92rem;line-height:1.45;margin:0 0 12px;">' + escapeHtml(q.description) + '</p>' : '') +
            '<div class="coming-soon-box">' +
            '<span class="material-symbols-rounded" style="font-size:36px;color:var(--accent-color);">construction</span>' +
            '<p style="margin:8px 0 0;font-weight:600;">Тип «' + escapeHtml(label) + '»</p>' +
            '<p style="margin:6px 0 0;font-size:13px;color:var(--text-muted);">Пока в разработке. В админке создать нельзя — только демо в этой тестовой форме. Нажмите «Далее».</p>' +
            '</div></div>';
        try { saveAnswer('coming-soon-skip'); } catch (e) {}
        return;
    }
    
    document.getElementById('current-number').textContent = currentQuestionIndex + 1;
    document.getElementById('total-number').textContent = _active.activeCount || form.questions.length;
    const progressPercent = ((currentQuestionIndex + 1) / (_active.activeCount || form.questions.length || 1)) * 100;
    document.getElementById('progress').style.width = `${progressPercent}%`;

    const timerDisplay = document.getElementById('timer-display');
    if (q.timer && q.timer > 0) {
        timerDisplay.classList.remove('hidden');
        startTimer(q.timer);
    } else {
        timerDisplay.classList.add('hidden');
    }

    const hintBtn = document.getElementById('hint-btn');
    const hintBox = document.getElementById('hint-box');
    hintBox.classList.add('hidden');
    if (q.hintText) {
        hintBtn.classList.remove('hidden');
        document.getElementById('hint-text').textContent = q.hintText;
    } else {
        hintBtn.classList.add('hidden');
    }

    const body = document.getElementById('question-body');
    const savedVal = userAnswers[currentRealQuestionIndex] !== undefined ? userAnswers[currentRealQuestionIndex] : '';
    
    // Кнопка озвучки
    const speakBtnHTML = `
        <button type="button" class="speak-btn tools-icon-btn" onclick="speakQuestion(allForms[currentFormIndex].questions[currentRealQuestionIndex])" title="Озвучить вопрос" style="margin-left:8px; vertical-align:middle;">
            <span class="material-symbols-rounded" style="font-size:20px;">volume_up</span>
        </button>
    `;

    if (q.type === 'fill-blank') {
        var fbHeading = '';
        var tpl0 = q.fillBlankTemplate || '';
        // заголовок показываем, только если он задан отдельно (не копия шаблона)
        if (q.title && tpl0 && q.title !== tpl0 && q.title !== (tpl0.length > 60 ? tpl0.slice(0, 57) + '…' : tpl0)) {
            fbHeading = q.title;
        } else if (q.title && !tpl0) {
            fbHeading = '';
        } else if (q.title && !String(q.title).includes('[')) {
            fbHeading = q.title;
        }
        body.innerHTML = '';
        if (fbHeading) {
            body.innerHTML = `<h3 style="margin-bottom: ${q.description ? '6px' : '12px'}; font-weight:600; display:flex; align-items:flex-start; gap:4px; flex-wrap:wrap;">
                <span style="flex:1;">${escapeHtml(fbHeading)}</span>${speakBtnHTML}
            </h3>`;
        } else {
            body.innerHTML = `<div style="display:flex;justify-content:flex-end;margin-bottom:4px;">${speakBtnHTML}</div>`;
        }
        if (q.description) {
            body.innerHTML += `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 12px; line-height: 1.4;">${escapeHtml(q.description)}</p>`;
        }
    } else if (q.type === 'text' && q.useInlineInput && q.title.includes('[input]')) {
        const inputHTML = `<input type="text" class="inline-quiz-input" value="${savedVal}" placeholder="..." oninput="saveAnswer(this.value.trim())">`;
        const formattedTitle = q.title.replace('[input]', inputHTML);
        
        body.innerHTML = `<h3 style="margin-bottom: ${q.description ? '6px' : '15px'}; font-weight:600; line-height: 1.6; display:flex; align-items:flex-start; gap:4px; flex-wrap:wrap;">
            <span style="flex:1;">${formattedTitle}</span>${speakBtnHTML}
        </h3>`;
        if (q.description) {
            body.innerHTML += `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 18px; line-height: 1.4;">${q.description}</p>`;
        }
    } else {
        body.innerHTML = `<h3 style="margin-bottom: ${q.description ? '6px' : '15px'}; font-weight:600; display:flex; align-items:flex-start; gap:4px; flex-wrap:wrap;">
            <span style="flex:1;">${q.title}</span>${speakBtnHTML}
        </h3>`;
        if (q.description) {
            body.innerHTML += `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 18px; line-height: 1.4;">${q.description}</p>`;
        }
    }

    switch (q.type) {
        case 'radio':
            q.options.forEach((opt, idx) => {
                body.innerHTML += `
                    <label class="option" id="opt-label-${idx}">
                        <input type="radio" name="q_opt" value="${idx}" ${savedVal === idx ? 'checked' : ''} onchange="saveAnswer(${idx}); showAnswerExplanation(${idx})">
                        <span>${opt}</span>
                    </label>
                `;
            });
            body.innerHTML += `<div id="answer-explanation-area" style="margin-top:12px;"></div>`;
            if (savedVal !== '' && savedVal !== undefined) setTimeout(() => showAnswerExplanation(savedVal), 30);
            break;

        case 'select':
            var _selSaved = (savedVal === '' || savedVal === undefined || savedVal === null) ? '' : String(savedVal);
            body.innerHTML += buildCustomSelect(q.options || [], _selSaved, function(val) {
                if (val === '') return;
                saveAnswer(parseInt(val, 10));
                showAnswerExplanation(parseInt(val, 10));
            }, '-- Выберите вариант --');
            body.innerHTML += '<div id="answer-explanation-area" style="margin-top:12px;"></div>';
            if (_selSaved !== '') setTimeout(function(){ showAnswerExplanation(parseInt(_selSaved,10)); }, 30);
            break;

        case 'checkbox':
            const checkedArr = Array.isArray(savedVal) ? savedVal : [];
            q.options.forEach((opt, idx) => {
                body.innerHTML += `
                    <label class="option">
                        <input type="checkbox" name="q_opt" value="${idx}" ${checkedArr.includes(idx) ? 'checked' : ''} onchange="saveCheckboxAnswer()">
                        <span>${opt}</span>
                    </label>
                `;
            });
            break;

        case 'text':
            if (!q.useInlineInput || !q.title.includes('[input]')) {
                const isMultiline = q.multiline || false;
                const allowFormat = q.allowFormat || false;
                const showSideNotes = q.sideNotes || false;

                let inputHTML = '';
                if (allowFormat) {
                    inputHTML = `
                        <div class="rich-text-toolbar" style="display:flex; gap:6px; margin-bottom:8px;">
                            <button type="button" class="q-action-btn" onclick="formatText('bold')"><b>B</b></button>
                            <button type="button" class="q-action-btn" onclick="formatText('italic')"><i>I</i></button>
                            <button type="button" class="q-action-btn" onclick="formatText('underline')"><u>U</u></button>
                        </div>
                        <div id="text-answer-editor" class="rich-text-editor admin-input" contenteditable="true" 
                             oninput="updateTextAnswerFromEditor()" style="min-height:${isMultiline ? '100px' : '48px'};">${savedVal || ''}</div>
                    `;
                } else if (isMultiline) {
                    inputHTML = `<textarea class="admin-input" id="text-answer-area" rows="4" placeholder="Введите ваш ответ..." 
                        oninput="saveAnswer(this.value); updateTextCounters(this)">${savedVal || ''}</textarea>`;
                } else {
                    inputHTML = `<input type="text" class="admin-input" id="text-answer-input" value="${savedVal || ''}" 
                        placeholder="Введите ваш ответ..." oninput="saveAnswer(this.value.trim()); updateTextCounters(this)">`;
                }

                body.innerHTML += `
                    <div class="text-answer-wrapper" style="display:flex; gap:12px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:200px;">
                            ${inputHTML}
                            <div class="text-counters" style="display:flex; gap:12px; font-size:12px; color:var(--text-muted); margin-top:6px;">
                                <span>Символов: <strong id="char-count">0</strong></span>
                                <span>Строк: <strong id="line-count">0</strong></span>
                            </div>
                        </div>
                        ${showSideNotes ? `
                        <div class="side-notes-box" style="flex:0 0 180px; background:var(--bg-color); border:1px dashed var(--border-color); border-radius:var(--radius-sm); padding:10px;">
                            <div style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:6px;"><span class="material-symbols-rounded" style="color:var(--accent-color); font-size:20px;">notes</span> Side Notes</div>
                            <textarea id="side-notes-area" class="admin-input" style="min-height:80px; font-size:13px; margin:0;" 
                                placeholder="Заметки..." oninput="userAnswers['side_'+currentRealQuestionIndex]=this.value">${userAnswers['side_'+currentRealQuestionIndex] || ''}</textarea>
                        </div>` : ''}
                    </div>
                `;
                setTimeout(() => {
                    const el = document.getElementById('text-answer-area') || document.getElementById('text-answer-input') || document.getElementById('text-answer-editor');
                    if (el) updateTextCounters(el);
                }, 50);
            }
            break;

        case 'true-false': {
            var opts = (q.options && q.options.length >= 2) ? q.options : ['Верно', 'Неверно'];
            var big = q.tfBigButtons ? ' tf-big' : '';
            var icons = ['check_circle', 'cancel'];
            body.innerHTML += '<div class="tf-row">';
            opts.forEach(function(opt, idx) {
                var sel = (savedVal === idx || savedVal === String(idx)) ? ' selected' : '';
                body.innerHTML += '<label class="tf-choice' + big + sel + '" id="opt-label-' + idx + '">' +
                    '<input type="radio" name="q_opt" value="' + idx + '"' + (sel ? ' checked' : '') +
                    ' onchange="saveAnswer(' + idx + '); document.querySelectorAll(\'.tf-choice\').forEach(function(el){el.classList.remove(\'selected\')}); this.closest(\'.tf-choice\').classList.add(\'selected\'); showAnswerExplanation(' + idx + ')">' +
                    '<span class="material-symbols-rounded tf-icon">' + icons[idx] + '</span>' +
                    '<span>' + escapeHtml(opt) + '</span></label>';
            });
            body.innerHTML += '</div><div id="answer-explanation-area" style="margin-top:12px;"></div>';
            if (savedVal !== '' && savedVal !== undefined) setTimeout(function(){ showAnswerExplanation(savedVal); }, 30);
            break;
        }

        case 'fill-blank': {
            var tpl = q.fillBlankTemplate || q.title || '';
            var savedArr = Array.isArray(savedVal) ? savedVal : [];
            var bi = 0;
            var passage = escapeHtml(tpl).replace(/\[([^\]]+)\]/g, function() {
                var val = savedArr[bi] != null ? escapeHtml(String(savedArr[bi])) : '';
                var idx = bi;
                bi++;
                return '<input type="text" class="fillblank-input" data-fb-idx="' + idx + '" value="' + val +
                    '" placeholder="…" autocomplete="off" oninput="saveFillBlankAnswers()">';
            });
            body.innerHTML += '<div class="fillblank-passage">' + passage + '</div>';
            if (bi === 0) {
                body.innerHTML += '<p style="color:var(--text-muted);font-size:13px;">В шаблоне нет пропусков [ответ]</p>';
            }
            break;
        }

        case 'flashcard':
            body.innerHTML += `
                <div class="flashcard-container" onclick="this.classList.toggle('flipped')">
                    <div class="flashcard-inner">
                        <div class="flashcard-side flashcard-front">
                            <span class="material-symbols-rounded" style="font-size:32px; color:var(--accent-color); margin-bottom:8px;">style</span>
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Нажмите, чтобы перевернуть 🔄</p>
                            <p style="font-size:18px; font-weight:600; margin:0;">${q.title}</p>
                        </div>
                        <div class="flashcard-side flashcard-back">
                            <span class="material-symbols-rounded" style="font-size:32px; color:var(--accent-color); margin-bottom:8px;">lightbulb</span>
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Оборотная сторона</p>
                            <p style="font-size:16px; font-weight:500; margin:0;">${q.flashcardAnswer || 'Пояснение отсутствует'}</p>
                        </div>
                    </div>
                </div>
            `;
            saveAnswer('viewed');
            break;

        case 'puzzle-drag':
            body.innerHTML += `<div id="puzzle-list"></div>`;
            const pList = document.getElementById('puzzle-list');
            
            let order = (Array.isArray(savedVal) && savedVal.length === q.options.length) 
                ? savedVal 
                : q.options.map((_, idx) => idx);

            order.forEach((idx) => {
                pList.innerHTML += `
                    <div class="puzzle-item" data-idx="${idx}">
                        <div class="puzzle-item-content">
                            <span class="material-symbols-rounded" style="color:var(--text-muted);">drag_indicator</span>
                            <span>${q.options[idx]}</span>
                        </div>
                        <div class="puzzle-controls">
                            <button type="button" class="tools-icon-btn" onclick="movePuzzleItem(this, -1)"><span class="material-symbols-rounded">arrow_upward</span></button>
                            <button type="button" class="tools-icon-btn" onclick="movePuzzleItem(this, 1)"><span class="material-symbols-rounded">arrow_downward</span></button>
                        </div>
                    </div>
                `;
            });
            savePuzzleAnswer();
            initPuzzleEvents();
            break;

        case 'info-slide':
            if (q.youtubeUrl) {
                body.innerHTML += renderYouTubeEmbed(q.youtubeUrl) || renderMediaHTML(q.youtubeUrl);
            }
            if (q.mediaUrl) {
                body.innerHTML += renderMediaHTML(q.mediaUrl, { allowDraw: !!q.allowDraw });
            }
            saveAnswer('viewed');
            break;

                case 'table': {
            body.innerHTML += '<span class="beta-pill-q">BETA</span>';
            body.innerHTML += '<p style="font-size:12px;color:var(--text-muted);margin:6px 0 10px;">Таблица (бета): заполните только подсвеченные ячейки.</p>';
            body.innerHTML += renderStudentTableHTML(q, savedVal);
            setTimeout(function() { bindStudentTableInputs(q); }, 0);
            break;
        }
default:
            body.innerHTML += `<p style="color:var(--text-muted);">Тип вопроса поддерживается в упрощенном режиме.</p>`;
            saveAnswer('viewed');
    }
}

function saveAnswer(val) {
    userAnswers[currentRealQuestionIndex] = val;
    persistSessionProgress();
}

function saveCheckboxAnswer() {
    const checked = Array.from(document.querySelectorAll('input[name="q_opt"]:checked')).map(el => parseInt(el.value));
    userAnswers[currentRealQuestionIndex] = checked;
    persistSessionProgress();
}

function savePuzzleAnswer() {
    const items = Array.from(document.querySelectorAll('.puzzle-item')).map(el => parseInt(el.getAttribute('data-idx')));
    userAnswers[currentRealQuestionIndex] = items;
    persistSessionProgress();
}

function movePuzzleItem(btn, direction) {
    const item = btn.closest('.puzzle-item');
    if (!item) return;
    if (direction === -1 && item.previousElementSibling) {
        item.parentNode.insertBefore(item, item.previousElementSibling);
    } else if (direction === 1 && item.nextElementSibling) {
        item.parentNode.insertBefore(item.nextElementSibling, item);
    }
    savePuzzleAnswer();
}

function initPuzzleEvents() {
    const list = document.getElementById('puzzle-list');
    if (!list) return;
    let dragItem = null;

    list.querySelectorAll('.puzzle-item').forEach(item => {
        item.draggable = true;
        item.addEventListener('dragstart', () => { dragItem = item; item.style.opacity = '0.5'; });
        item.addEventListener('dragend', () => { dragItem = null; item.style.opacity = '1'; savePuzzleAnswer(); });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const bounding = item.getBoundingClientRect();
            const offset = e.clientY - bounding.top - (bounding.height / 2);
            if (offset > 0) item.after(dragItem);
            else item.before(dragItem);
        });
    });
}


function saveFillBlankAnswers() {
    var inputs = document.querySelectorAll('#question-body .fillblank-input');
    var arr = [];
    inputs.forEach(function(inp) {
        arr[parseInt(inp.getAttribute('data-fb-idx'), 10) || 0] = inp.value;
    });
    saveAnswer(arr);
}

function normalizeFbAnswer(s, q) {
    var v = String(s == null ? '' : s);
    if (q && q.fbTrimSpaces !== false) v = v.trim().replace(/\s+/g, ' ');
    if (!(q && q.fbCaseSensitive)) v = v.toLowerCase();
    return v;
}

function isFillBlankCorrect(q, userAns) {
    if (!q || !Array.isArray(q.blanks)) return false;
    var ua = Array.isArray(userAns) ? userAns : [];
    for (var i = 0; i < q.blanks.length; i++) {
        var accepted = q.blanks[i] || [];
        if (!q.fbAcceptAlts && accepted.length) accepted = [accepted[0]];
        var got = normalizeFbAnswer(ua[i], q);
        var ok = accepted.some(function(a) { return normalizeFbAnswer(a, q) === got; });
        if (!ok) return false;
    }
    return q.blanks.length > 0;
}

function nextStep(force = false) {
    var _active = resolveActiveQuestion();
    const form = _active.form;
    const q = _active.q;
    if (q) currentRealQuestionIndex = _active.realIdx;
    if (!form || !q) {
        if (form && themesEnabled(form)) showThemeCompleteScreen();
        else calculateResults();
        return;
    }

    var ans = userAnswers[currentRealQuestionIndex];
    var answerIsEmpty = (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && (ans.length === 0 || ans.every(function(x){ return !String(x||'').trim(); }))));
    // Table BETA: empty if all editable cells blank
    if (q.type === 'table' && ans && typeof ans === 'object' && !Array.isArray(ans)) {
        var cells = q.tableCells || {};
        var keys = Object.keys(cells).filter(function(k) {
            return !!(q.tableAllowAllEdit || (cells[k] && cells[k].editable));
        });
        if (!keys.length) keys = Object.keys(ans);
        answerIsEmpty = !keys.length || keys.every(function(k) {
            return !String(ans[k] != null ? ans[k] : '').trim();
        });
    }
    if (!force && !isExplanationShowing && q.required && answerIsEmpty) {
        showAlert('Пожалуйста, ответьте на обязательный вопрос!', 'warning');
        return;
    }

    if (!isExplanationShowing && q.hasExplanation && (q.explanationText || q.explanationTitle)) {
        isExplanationShowing = true;
        stopTimer();
        
        const inputs = document.querySelectorAll('#question-body input, #question-body select, #question-body button, #question-body textarea, #question-body .cselect-trigger');
        inputs.forEach(el => { try { el.disabled = true; } catch(e) {} });

        const body = document.getElementById('question-body');
        const expTitle = q.explanationTitle ? q.explanationTitle : 'Разбор ответа';
        const expBody = q.explanationText || '';
        
        body.innerHTML += `
            <div class="explanation-card">
                <div class="explanation-title">
                    <span class="material-symbols-rounded">lightbulb</span> ${escapeHtml(expTitle)}
                </div>
                <div class="explanation-body">${escapeHtml(expBody)}</div>
            </div>
        `;

        const holdSeconds = parseInt(q.holdTimer) || 0;
        const nextBtn = document.getElementById('next-btn');

        if (holdSeconds > 0 && nextBtn) {
            nextBtn.disabled = true;
            let secondsLeft = holdSeconds;
            nextBtn.textContent = `Продолжить (${secondsLeft}s)`;

            holdTimerInterval = setInterval(() => {
                secondsLeft--;
                if (secondsLeft > 0) {
                    nextBtn.textContent = `Продолжить (${secondsLeft}s)`;
                } else {
                    stopHoldTimer();
                    nextBtn.disabled = false;
                    nextBtn.textContent = 'Продолжить';
                }
            }, 1000);
        } else if (nextBtn) {
            nextBtn.textContent = 'Продолжить';
        }
        return;
    }

    var activeLen = (_active && _active.activeCount) ? _active.activeCount : getActiveQuestionList().length;
    if (currentQuestionIndex < activeLen - 1) {
        currentQuestionIndex++;
    persistSessionProgress();;
        renderQuestion();
    } else {
        if (themesEnabled(form)) showThemeCompleteScreen();
        else calculateResults();
    }
}

function stopHoldTimer() {
    if (holdTimerInterval) {
        clearInterval(holdTimerInterval);
        holdTimerInterval = null;
    }
}

function getCorrectAnswerDisplay(q) {
    if (q && q.type === 'table') return getTableCorrectDisplay(q);
    if (!q) return '—';
    if (q.type === 'fill-blank' && Array.isArray(q.blanks)) {
        return q.blanks.map(function(alts) {
            return Array.isArray(alts) ? alts.join('|') : String(alts);
        }).join(' · ');
    }
    if (q.type === 'text' && q.correctText && q.correctText.length) {
        return q.correctText.join(' / ');
    }
    if (q.options && q.correctChoices && q.correctChoices.length) {
        return q.correctChoices.map(function(i) {
            return q.options[i] != null ? q.options[i] : ('#' + i);
        }).filter(Boolean).join(', ');
    }
    if (q.type === 'puzzle-drag' && q.options && q.correctChoices) {
        return q.correctChoices.map(function(i) {
            return q.options[i] != null ? q.options[i] : '';
        }).filter(Boolean).join(' → ');
    }
    return '—';
}

function getAnswerExplanationHtml(q, isCorrect, userAns) {
    if (!q) return '';
    var parts = [];

    // 1) Объяснение под верным / неверным (тумблер hasAnswerExplanations)
    if (q.hasAnswerExplanations) {
        var text = '';
        if (isCorrect) {
            text = q.answerExpCorrect || '';
        } else {
            var map = q.answerExpIncorrect || {};
            if (q.type === 'radio' || q.type === 'select' || q.type === 'true-false') {
                var n = parseInt(userAns, 10);
                if (!isNaN(n) && (map[n] != null || map[String(n)] != null)) {
                    text = map[n] != null ? map[n] : map[String(n)];
                } else {
                    text = map.default || map['*'] || '';
                }
            } else if (q.type === 'checkbox' && Array.isArray(userAns)) {
                // берём первое совпадение по выбранным индексам
                for (var i = 0; i < userAns.length; i++) {
                    var k = userAns[i];
                    if (map[k] != null || map[String(k)] != null) {
                        text = map[k] != null ? map[k] : map[String(k)];
                        break;
                    }
                }
                if (!text) text = map.default || map['*'] || '';
            } else {
                text = map.default || map['*'] || '';
            }
            // если для неверного нет текста — мягкий fallback
            if (!text) text = 'Ответ неверный.';
        }
        if (text) {
            parts.push('<div class="result-explanation ' + (isCorrect ? 'exp-ok' : 'exp-bad') + '">' +
                '<span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;">' +
                (isCorrect ? 'lightbulb' : 'info') + '</span> ' + escapeHtml(text) + '</div>');
        }
    }

    // 2) Общий блок объяснения (тумблер hasExplanation) — всегда в результатах, если включён
    if (q.hasExplanation && (q.explanationText || q.explanationTitle)) {
        parts.push('<div class="result-explanation exp-info">' +
            '<span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;">menu_book</span> ' +
            (q.explanationTitle ? '<b>' + escapeHtml(q.explanationTitle) + ':</b> ' : '') +
            escapeHtml(q.explanationText || '') + '</div>');
    }
    return parts.join('');
}


function renderFlashcardResults(form) {
    var list = getActiveQuestionList();
    var total = list.length || (form.questions || []).length;
    var know = flashcardStats.know || 0;
    var dont = flashcardStats.dontKnow || 0;
    if (know + dont === 0 && total) {
        // fallback count from userAnswers
        list.forEach(function(item) {
            var a = userAnswers[item.idx];
            if (a === 'know') know++;
            else if (a === 'dontknow') dont++;
        });
        flashcardStats.know = know;
        flashcardStats.dontKnow = dont;
    }

    document.getElementById('final-score').textContent = know + ' / ' + total;

    var titleEl = document.querySelector('#result-box h2');
    if (titleEl) {
        titleEl.innerHTML =
            '<span class="material-symbols-rounded" style="color:var(--accent-color); font-size:32px;">style</span> FlashCards завершены';
    }
    var sub = document.querySelector('#result-box > p');
    if (sub) sub.textContent = 'Карточки: знаю / всего';

    var pct = total ? Math.round((know / total) * 100) : 0;
    var html = '';
    html +=
        '<div class="fc-results-summary">' +
            '<div class="fc-stat fc-stat-know">' +
                '<span class="material-symbols-rounded">thumb_up</span>' +
                '<div><b>' + know + '</b><small>Знаю</small></div>' +
            '</div>' +
            '<div class="fc-stat fc-stat-dont">' +
                '<span class="material-symbols-rounded">thumb_down</span>' +
                '<div><b>' + dont + '</b><small>Не знаю</small></div>' +
            '</div>' +
            '<div class="fc-stat fc-stat-pct">' +
                '<span class="material-symbols-rounded">percent</span>' +
                '<div><b>' + pct + '%</b><small>усвоено</small></div>' +
            '</div>' +
        '</div>';

    html += '<p class="fc-results-hint">Ниже — разбор колоды. Это не оценка теста, а ваша отметка «знаю / не знаю».</p>';

    // Сначала «Не знаю» — полезнее повторить
    var sections = [
        { key: 'dontknow', title: 'Стоит повторить', cls: 'fc-review-dont', icon: 'replay' },
        { key: 'know', title: 'Уже знаю', cls: 'fc-review-know', icon: 'check_circle' }
    ];

    sections.forEach(function(sec) {
        var items = list.filter(function(item) {
            return userAnswers[item.idx] === sec.key;
        });
        if (!items.length) return;
        html += '<h4 class="fc-section-title"><span class="material-symbols-rounded">' + sec.icon + '</span> ' + sec.title + ' (' + items.length + ')</h4>';
        items.forEach(function(item) {
            var q = item.q;
            var answer = getFlashcardAnswerText(q);
            html +=
                '<div class="review-item ' + sec.cls + '">' +
                    '<strong>' + escapeHtml(q.title || '') + '</strong>' +
                    (q.type ? '<span class="fc-type-badge">' + escapeHtml(q.type) + '</span>' : '') +
                    '<p class="fc-answer-line"><span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;">lightbulb</span> ' +
                        escapeHtml(answer) +
                    '</p>' +
                '</div>';
        });
    });

    // Не отмеченные (если вдруг)
    var skipped = list.filter(function(item) {
        var a = userAnswers[item.idx];
        return a !== 'know' && a !== 'dontknow';
    });
    if (skipped.length) {
        html += '<h4 class="fc-section-title"><span class="material-symbols-rounded">help</span> Без отметки (' + skipped.length + ')</h4>';
        skipped.forEach(function(item) {
            var q = item.q;
            html +=
                '<div class="review-item grey-item">' +
                    '<strong>' + escapeHtml(q.title || '') + '</strong>' +
                    '<p class="fc-answer-line">' + escapeHtml(getFlashcardAnswerText(q)) + '</p>' +
                '</div>';
        });
    }

    document.getElementById('review-box').innerHTML = html;
}

function calculateResults() {
    stopTimer();
    stopHoldTimer();
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');
    // прохождение завершено — сбрасываем только черновик ответов (галочки тем остаются)
    try { clearSessionProgress(currentFormIndex); } catch (e) {}
    var tc = document.getElementById('theme-complete-box');
    if (tc) tc.classList.add('hidden');

    const form = allForms[currentFormIndex];
    const settings = (form && form.settings) ? form.settings : {};

    // ===== FlashCards: отдельный понятный итог (не «верно/неверно теста») =====
    if (getFormMode(form) === 'flashcards') {
        renderFlashcardResults(form);
        return;
    }

    // по умолчанию включено
    const showWrong = settings.showWrong !== false;
    const showCorrect = settings.showCorrect !== false;

    let score = 0;
    let maxPossibleScore = 0;
    let reviewHTML = '';

    form.questions.forEach((q, idx) => {
        const userAns = userAnswers[idx];

        if (q.type === 'flashcard' || q.type === 'info-slide' || (typeof isComingSoonQuestion === 'function' && isComingSoonQuestion(q))) {
            var infoExp = '';
            if (q.hasExplanation && q.explanationText) {
                infoExp = '<div class="result-explanation exp-info" style="margin-top:6px;">' +
                    (q.explanationTitle ? '<b>' + escapeHtml(q.explanationTitle) + ':</b> ' : '') +
                    escapeHtml(q.explanationText) + '</div>';
            }
            if (q.hasAnswerExplanations && q.answerExpCorrect) {
                infoExp += '<div class="result-explanation exp-ok" style="margin-top:4px;">' +
                    escapeHtml(q.answerExpCorrect) + '</div>';
            }
            reviewHTML += `
                <div class="review-item grey-item">
                    <strong>${escapeHtml(q.title || '')}</strong>
                    <p style="color:var(--text-muted); font-size:13px; margin-top:4px;">
                        Материал изучен ${q.flashcardAnswer ? '(Оборот: ' + escapeHtml(q.flashcardAnswer) + ')' : ''}
                    </p>
                    ${infoExp}
                </div>
            `;
            return;
        }

        maxPossibleScore++;
        let isCorrect = false;

        if (q.type === 'radio' || q.type === 'select' || q.type === 'true-false') {
            var ansNum = (userAns === '' || userAns === undefined || userAns === null) ? null : parseInt(userAns, 10);
            if (q.correctChoices && ansNum !== null && !isNaN(ansNum) && q.correctChoices.map(Number).includes(ansNum)) isCorrect = true;
        } else if (q.type === 'checkbox') {
            if (Array.isArray(userAns) && q.correctChoices) {
                var cc = q.correctChoices.map(Number).slice().sort();
                var ua = userAns.map(Number).slice().sort();
                if (cc.length === ua.length && cc.every(function(v, i) { return v === ua[i]; })) isCorrect = true;
            }
        } else if (q.type === 'true-false') {
            var ansNumTf = parseInt(userAns, 10);
            if (q.correctChoices && !isNaN(ansNumTf) && q.correctChoices.map(Number).includes(ansNumTf)) isCorrect = true;
        } else if (q.type === 'fill-blank') {
            if (isFillBlankCorrect(q, userAns)) isCorrect = true;
        } else if (q.type === 'text') {
            if (q.correctText && q.correctText.some(t => t.toLowerCase().trim() === String(userAns || '').toLowerCase().trim())) isCorrect = true;
        } else if (q.type === 'puzzle-drag') {
            if (Array.isArray(userAns) && q.correctChoices && JSON.stringify(userAns) === JSON.stringify(q.correctChoices)) isCorrect = true;
        } else if (q.type === 'table') {
            if (isTableAnswerCorrect(q, userAns)) isCorrect = true;
        }

        var displayTitle;
        if (q.type === 'fill-blank') {
            displayTitle = escapeHtml(String(q.fillBlankTemplate || q.title || '')).replace(/\[([^\]]+)\]/g, '<u>___</u>');
        } else if ((q.title || '').includes('[input]')) {
            displayTitle = escapeHtml(q.title || '').replace(/\[input\]/g, '<u>' + escapeHtml(String(userAns || '...')) + '</u>');
            // fallback if escape broke the token
            if (displayTitle.indexOf('[input]') >= 0) displayTitle = displayTitle.replace('[input]', '<u>' + escapeHtml(String(userAns || '...')) + '</u>');
        } else {
            displayTitle = escapeHtml(q.title || '');
        }

        var expHtml = getAnswerExplanationHtml(q, isCorrect, userAns);

        if (isCorrect) {
            score++;
            var correctExtra = '';
            if (showCorrect) {
                correctExtra = '<p class="text-success" style="font-size:13px; margin-top:2px;">✓ Правильный ответ: ' +
                    escapeHtml(getCorrectAnswerDisplay(q)) + '</p>';
            }
            reviewHTML += `
                <div class="review-item correct-item">
                    <strong>${displayTitle}</strong>
                    <p class="text-success" style="font-size:13px; margin-top:4px;">✓ Верно</p>
                    ${correctExtra}
                    ${expHtml}
                </div>
            `;
        } else {
            var shown = userAns;
            if (shown === undefined || shown === null || shown === '') shown = 'пусто';
            else if ((q.type === 'radio' || q.type === 'select' || q.type === 'true-false') && q.options) {
                var n = parseInt(shown, 10);
                shown = (!isNaN(n) && q.options[n] != null) ? q.options[n] : shown;
            } else if (q.type === 'checkbox' && Array.isArray(shown) && q.options) {
                shown = shown.map(function(i) { return q.options[i]; }).filter(Boolean).join(', ') || 'пусто';
            } else if (q.type === 'puzzle-drag' && Array.isArray(shown) && q.options) {
                shown = shown.map(function(i) { return q.options[i]; }).filter(Boolean).join(' → ') || 'пусто';
            } else if (q.type === 'fill-blank' && Array.isArray(shown)) {
                shown = shown.map(function(s) { return s == null || s === '' ? '…' : s; }).join(' · ');
            }
            var correctLine = '';
            if (showCorrect) {
                correctLine = '<p class="text-success" style="font-size:13px; margin-top:2px;">✓ Правильный ответ: ' +
                    escapeHtml(getCorrectAnswerDisplay(q)) + '</p>';
            }
            var wrongLine = showWrong
                ? '<p class="text-danger" style="font-size:13px; margin-top:4px;">✗ Неверно (Ваш ответ: "' + escapeHtml(String(shown)) + '")</p>'
                : '<p class="text-danger" style="font-size:13px; margin-top:4px;">✗ Неверно</p>';

            reviewHTML += `
                <div class="review-item incorrect-item">
                    <strong>${displayTitle}</strong>
                    ${wrongLine}
                    ${correctLine}
                    ${expHtml}
                </div>
            `;
        }
    });

    document.getElementById('final-score').textContent = score + ' / ' + maxPossibleScore;

    let emailBlock = '';
    if (userEmail) {
        emailBlock += '<p style="text-align:center; font-size:13px; color:var(--text-muted); margin-bottom:8px;">Ваш email: <b>' + escapeHtml(userEmail) + '</b></p>';
    }
    const teacherEmail = form.settings && form.settings.teacherEmail;
    if (teacherEmail) {
        const subject = encodeURIComponent('Результаты теста: ' + (form.title || 'Форма'));
        const body = encodeURIComponent(
            'Результаты теста "' + (form.title || 'Форма') + '"\n' +
            'Email ученика: ' + (userEmail || 'не указан') + '\n' +
            'Результат: ' + score + ' / ' + maxPossibleScore + '\n\n' +
            '---\nОтправлено из My Form'
        );
        emailBlock +=
            '<a href="mailto:' + teacherEmail + '?subject=' + subject + '&body=' + body + '" ' +
            'class="btn" style="display:block; text-align:center; margin-top:12px; text-decoration:none;">' +
            '📧 Отправить результаты преподавателю</a>';
    }

    if (!previewMode) {
        emailBlock +=
            '<button type="button" class="btn" style="width:100%;margin-top:12px;background:transparent;color:var(--text-color);border:1px solid var(--border-color);" onclick="exportStudentResultsJSON()">' +
            '<span class="material-symbols-rounded" style="font-size:18px;vertical-align:middle;">download</span> ' +
            'Скачать ответы (.json) </button>';
    }

    document.getElementById('review-box').innerHTML = emailBlock + reviewHTML;

    if (previewMode) {
        injectPreviewFinishUI();
    }
}

function restartQuiz() { 
    userEmail = '';
    var titleEl = document.querySelector('#result-box h2');
    if (titleEl) {
        titleEl.innerHTML = '<span class="material-symbols-rounded" style="color:var(--accent-color); font-size:32px;">emoji_events</span> Тест завершён!';
    }
    var sub = document.querySelector('#result-box > p');
    if (sub) sub.textContent = 'Ваш результат:';
    loadCurrentForm(); 
}

function startTimer(seconds) {
    currentTimerSeconds = seconds;
    document.getElementById('timer-seconds').textContent = currentTimerSeconds;
    timerInterval = setInterval(() => {
        currentTimerSeconds--;
        document.getElementById('timer-seconds').textContent = currentTimerSeconds;
        if (currentTimerSeconds <= 0) {
            stopTimer();
            nextStep(true); // force skip required check
        }
    }, 1000);
}

function stopTimer() { if (timerInterval) clearInterval(timerInterval); }
function toggleHintModal() { document.getElementById('hint-box').classList.toggle('hidden'); }

/* ==========================================
   6. ЭКСПОРТ И ИМПОРТ JSON
   ========================================== */
function exportFormToJSON() {
    const currentForm = allForms[currentFormIndex];
    if (!currentForm) return showAlert('Нет выбранной формы для экспорта', 'error');

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentForm, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentForm.title || 'form'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showAlert('Форма успешно экспортирована в файл JSON!', 'check_circle');
}

function triggerImportForm() {
    var el = document.getElementById('import-file-toolbar')
        || document.getElementById('import-file');
    if (!el) {
        showAlert('Поле импорта не найдено', 'error');
        return;
    }
    el.value = '';
    el.click();
}

function isStudentResultsPayload(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.kind === 'myform-student-results' || data.type === 'student-results') return true;
    // heuristic: answers map + no form questions array
    if (data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers)) {
        if (!Array.isArray(data.questions)) return true;
    }
    return false;
}

function importFormFromJSON(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // ===== Ветка: результаты ученика → сверка =====
            if (isStudentResultsPayload(importedData)) {
                openStudentResultsReview(importedData, file.name);
                input.value = '';
                return;
            }

            // ===== Обычная форма =====
            if (importedData && importedData.questions && Array.isArray(importedData.questions)) {
                allForms.push(importedData);
            } else if (Array.isArray(importedData)) {
                allForms.push(...importedData);
            } else {
                throw new Error('Файл не содержит форму и не похож на результаты ученика.');
            }

            saveFormsToStorage();
            currentFormIndex = allForms.length - 1;
            renderAllFormsUI();
            loadCurrentForm();
            if (!document.getElementById('admin-screen').classList.contains('hidden')) {
                renderAdminQuestionsList();
            }
            showAlert('Новая форма успешно импортирована!', 'check_circle');
        } catch (err) {
            showAlert('Ошибка импорта: ' + err.message, 'error');
        }
        input.value = '';
    };
    reader.readAsText(file);
}

/** Экспорт ответов ученика после прохождения (новинка) */
function exportStudentResultsJSON() {
    const form = allForms[currentFormIndex];
    if (!form) return showAlert('Нет формы', 'error');
    const questions = form.questions || [];
    if (!questions.length) return showAlert('Нет вопросов', 'error');

    // пересчёт score так же, как в showResults (упрощённо через уже отрисованный final-score)
    let score = 0, maxPossibleScore = 0;
    questions.forEach(function(q, idx) {
        if (q.type === 'flashcard' || q.type === 'info-slide') return;
        maxPossibleScore++;
        const userAns = userAnswers[idx];
        let isCorrect = false;
        if (q.type === 'radio' || q.type === 'select' || q.type === 'true-false') {
            var ansNum = (userAns === '' || userAns === undefined || userAns === null) ? null : parseInt(userAns, 10);
            if (q.correctChoices && ansNum !== null && !isNaN(ansNum) && q.correctChoices.map(Number).includes(ansNum)) isCorrect = true;
        } else if (q.type === 'checkbox') {
            if (Array.isArray(userAns) && q.correctChoices) {
                var cc = q.correctChoices.map(Number).slice().sort();
                var ua = userAns.map(Number).slice().sort();
                if (cc.length === ua.length && cc.every(function(v, i) { return v === ua[i]; })) isCorrect = true;
            }
        } else if (q.type === 'fill-blank') {
            if (typeof isFillBlankCorrect === 'function' && isFillBlankCorrect(q, userAns)) isCorrect = true;
        } else if (q.type === 'text') {
            if (q.correctText && userAns != null) {
                isCorrect = q.correctText.some(function(t) {
                    return String(t).toLowerCase().trim() === String(userAns).toLowerCase().trim();
                });
            }
        } else if (q.type === 'puzzle-drag') {
            if (Array.isArray(userAns) && q.correctChoices) {
                var cc2 = q.correctChoices.map(Number);
                if (cc2.length === userAns.length && cc2.every(function(v, i) { return v === Number(userAns[i]); })) isCorrect = true;
            }
        }
        if (isCorrect) score++;
    });

    // снимок вопросов без admin-only секретов не нужен — ключи нужны для сверки офлайн
    var snapshotQuestions = questions.map(function(q) {
        return {
            type: q.type,
            title: q.title,
            description: q.description,
            options: q.options,
            correctChoices: q.correctChoices,
            correctText: q.correctText,
            flashcardAnswer: q.flashcardAnswer,
            fillBlankText: q.fillBlankText,
            themeId: q.themeId,
            hasExplanation: q.hasExplanation,
            explanationTitle: q.explanationTitle,
            explanationText: q.explanationText,
            hasAnswerExplanations: q.hasAnswerExplanations,
            answerExpCorrect: q.answerExpCorrect,
            answerExpIncorrect: q.answerExpIncorrect
        };
    });

    var payload = {
        kind: 'myform-student-results',
        version: 1,
        exportedAt: new Date().toISOString(),
        formTitle: form.title || 'Форма',
        formId: form.id || null,
        studentEmail: userEmail || '',
        mode: getFormMode(form),
        score: score,
        maxScore: maxPossibleScore,
        answers: userAnswers || {},
        snapshot: { questions: snapshotQuestions }
    };

    var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    var a = document.createElement('a');
    a.setAttribute('href', dataStr);
    var safeName = String(form.title || 'results').replace(/[^\wа-яА-ЯёЁ\- ]+/g, '').trim() || 'results';
    a.setAttribute('download', safeName + '_answers.json');
    document.body.appendChild(a);
    a.click();
    a.remove();
    showAlert('Ответы сохранены в JSON. Передайте файл преподавателю.', 'check_circle');
}

function triggerStudentResultsImport() {
    var el = document.getElementById('import-student-results-file');
    if (!el) {
        el = document.createElement('input');
        el.type = 'file';
        el.id = 'import-student-results-file';
        el.accept = '.json,application/json';
        el.style.display = 'none';
        el.onchange = function() { importFormFromJSON(el); };
        document.body.appendChild(el);
    }
    el.value = '';
    el.click();
}

/** Сверка загруженных ответов ученика с эталоном */
function openStudentResultsReview(data, fileName) {
    var answers = data.answers || {};
    var snapQs = (data.snapshot && Array.isArray(data.snapshot.questions)) ? data.snapshot.questions : null;
    var form = allForms[currentFormIndex];
    var liveQs = (form && form.questions) ? form.questions : null;

    // предпочитаем текущую форму, если число вопросов совпадает; иначе snapshot
    var questions = null;
    var sourceLabel = '';
    if (liveQs && snapQs && liveQs.length === snapQs.length) {
        questions = liveQs;
        sourceLabel = 'текущая форма «' + (form.title || '') + '»';
    } else if (liveQs && !snapQs) {
        questions = liveQs;
        sourceLabel = 'текущая форма «' + (form.title || '') + '»';
    } else if (snapQs) {
        questions = snapQs;
        sourceLabel = 'снимок из файла ученика';
    } else if (liveQs) {
        questions = liveQs;
        sourceLabel = 'текущая форма (структура может не совпадать)';
    } else {
        showAlert('Не с чем сверить: нет вопросов в форме и нет снимка в файле', 'warning');
        return;
    }

    var score = 0, maxPossibleScore = 0;
    var rows = '';

    questions.forEach(function(q, idx) {
        var userAns = answers[idx];
        if (userAns === undefined) userAns = answers[String(idx)];

        if (q.type === 'flashcard' || q.type === 'info-slide') {
            rows += '<div class="review-item grey-item"><strong>' + escapeHtml(q.title || '') +
                '</strong><p style="color:var(--text-muted);font-size:13px;margin-top:4px;">Материал (без оценки)</p></div>';
            return;
        }

        maxPossibleScore++;
        var isCorrect = false;
        if (q.type === 'radio' || q.type === 'select' || q.type === 'true-false') {
            var ansNum = (userAns === '' || userAns === undefined || userAns === null) ? null : parseInt(userAns, 10);
            if (q.correctChoices && ansNum !== null && !isNaN(ansNum) && q.correctChoices.map(Number).includes(ansNum)) isCorrect = true;
        } else if (q.type === 'checkbox') {
            if (Array.isArray(userAns) && q.correctChoices) {
                var cc = q.correctChoices.map(Number).slice().sort();
                var ua = userAns.map(Number).slice().sort();
                if (cc.length === ua.length && cc.every(function(v, i) { return v === ua[i]; })) isCorrect = true;
            }
        } else if (q.type === 'fill-blank') {
            if (typeof isFillBlankCorrect === 'function' && isFillBlankCorrect(q, userAns)) isCorrect = true;
        } else if (q.type === 'text') {
            if (q.correctText && userAns != null) {
                isCorrect = q.correctText.some(function(t) {
                    return String(t).toLowerCase().trim() === String(userAns).toLowerCase().trim();
                });
            }
        } else if (q.type === 'puzzle-drag') {
            if (Array.isArray(userAns) && q.correctChoices) {
                var cc2 = q.correctChoices.map(Number);
                if (cc2.length === userAns.length && cc2.every(function(v, i) { return v === Number(userAns[i]); })) isCorrect = true;
            }
        }
        if (isCorrect) score++;

        var shown = userAns;
        if (shown === undefined || shown === null || shown === '') shown = 'пусто';
        else if ((q.type === 'radio' || q.type === 'select' || q.type === 'true-false') && q.options) {
            var n = parseInt(shown, 10);
            shown = (!isNaN(n) && q.options[n] != null) ? q.options[n] : shown;
        } else if (q.type === 'checkbox' && Array.isArray(shown) && q.options) {
            shown = shown.map(function(i) { return q.options[i]; }).filter(Boolean).join(', ') || 'пусто';
        } else if (q.type === 'puzzle-drag' && Array.isArray(shown) && q.options) {
            shown = shown.map(function(i) { return q.options[i]; }).filter(Boolean).join(' → ') || 'пусто';
        } else if (q.type === 'fill-blank' && Array.isArray(shown)) {
            shown = shown.map(function(s) { return s == null || s === '' ? '…' : s; }).join(' · ');
        }

        var correctDisp = (typeof getCorrectAnswerDisplay === 'function')
            ? getCorrectAnswerDisplay(q)
            : (q.correctChoices && q.options
                ? q.correctChoices.map(function(i) { return q.options[i]; }).join(', ')
                : (q.correctText || []).join(' / '));

        if (isCorrect) {
            rows += '<div class="review-item correct-item"><strong>' + escapeHtml(q.title || '') +
                '</strong><p class="text-success" style="font-size:13px;margin-top:4px;">✓ Верно — «' +
                escapeHtml(String(shown)) + '»</p></div>';
        } else {
            rows += '<div class="review-item incorrect-item"><strong>' + escapeHtml(q.title || '') +
                '</strong><p class="text-danger" style="font-size:13px;margin-top:4px;">✗ Ответ ученика: «' +
                escapeHtml(String(shown)) + '»</p>' +
                '<p class="text-success" style="font-size:13px;margin-top:2px;">✓ Эталон: ' +
                escapeHtml(String(correctDisp || '—')) + '</p></div>';
        }
    });

    var modal = document.getElementById('student-results-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'student-results-modal';
        modal.className = 'custom-alert-overlay active';
        modal.onclick = function(ev) { if (ev.target === modal) closeStudentResultsModal(); };
        document.body.appendChild(modal);
    }
    modal.classList.add('active');
    modal.innerHTML =
        '<div class="custom-alert-card student-results-card" style="max-width:560px;text-align:left;max-height:85vh;overflow:auto;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;">' +
                '<h3 style="margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                    '<span class="material-symbols-rounded" style="color:var(--accent-color);">grading</span>' +
                    'Сверка ответов ' +
                '</h3>' +
                '<button type="button" onclick="closeStudentResultsModal()" style="background:transparent;border:none;cursor:pointer;color:var(--text-color);display:flex;">' +
                    '<span class="material-symbols-rounded">close</span></button>' +
            '</div>' +
            '<p style="font-size:13px;color:var(--text-muted);margin:0 0 8px;line-height:1.45;">' +
                'Файл: <b>' + escapeHtml(fileName || 'results.json') + '</b><br>' +
                'Форма в файле: <b>' + escapeHtml(data.formTitle || '—') + '</b><br>' +
                'Ученик: <b>' + escapeHtml(data.studentEmail || 'не указан') + '</b><br>' +
                'Сверка по: ' + escapeHtml(sourceLabel) +
            '</p>' +
            '<div style="font-size:1.4rem;font-weight:700;text-align:center;margin:12px 0;">' +
                score + ' / ' + maxPossibleScore +
                (data.score != null ? ' <span style="font-size:12px;font-weight:500;color:var(--text-muted);">(в файле: ' +
                    escapeHtml(String(data.score)) + '/' + escapeHtml(String(data.maxScore != null ? data.maxScore : '—')) + ')</span>' : '') +
            '</div>' +
            '<div class="student-results-list">' + rows + '</div>' +
            '<button type="button" class="btn" style="width:100%;margin-top:16px;" onclick="closeStudentResultsModal()">Закрыть</button>' +
        '</div>';
}

function closeStudentResultsModal() {
    var modal = document.getElementById('student-results-modal');
    if (modal) modal.classList.remove('active');
}


/* ==========================================
   7. ПАНЕЛЬ АДМИНИСТРАТОРА (СОЗДАНИЕ & РЕДАКТИРОВАНИЕ)
   ========================================== */
function switchScreen(screen) {
    if (screen === 'login') {
        var login = document.getElementById('login-screen');
        if (login) {
            login.classList.remove('hidden');
            login.classList.add('active');
        }
    } else if (screen === 'admin') {
        var login = document.getElementById('login-screen');
        if (login) {
            login.classList.add('hidden');
            login.classList.remove('active');
        }
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('admin-screen').classList.remove('hidden');
        try {
            initCurrentTheme();
            renderThemeUI();
            renderAdminQuestionsList();
            enhanceAllSelects(document.getElementById('admin-screen'));
        } catch (e) { console.warn(e); }
    }
}

function closeLoginModal() {
    var login = document.getElementById('login-screen');
    if (login) {
        login.classList.add('hidden');
        login.classList.remove('active');
    }
}

function getFormAdminAuth(form) {
    if (!form) form = allForms[currentFormIndex];
    if (!form) return { u: 'admin', p: '1234' };
    // приоритет: form.adminAuth → settings.adminAuth → дефолт
    var auth = form.adminAuth || (form.settings && form.settings.adminAuth) || null;
    if (auth && auth.u != null && auth.p != null) {
        return { u: String(auth.u), p: String(auth.p) };
    }
    return { u: 'admin', p: '1234' };
}

function tryLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const form = allForms[currentFormIndex];
    const storedAuth = getFormAdminAuth(form);

    if (u === storedAuth.u && p === storedAuth.p) {
        switchScreen('admin');
    } else {
        showAlert('Неверный логин или пароль для этой формы!', 'lock');
    }
}


/* ===== Создать форму (модалка) + карта QR-входа ===== */
function createNewFormPrompt() {
    var m = document.getElementById('create-form-modal');
    var inp = document.getElementById('create-form-title');
    if (inp) inp.value = '';
    if (m) {
        m.classList.add('active');
        setTimeout(function() { if (inp) inp.focus(); }, 80);
    } else {
        // fallback
        showPrompt("Введите название новой формы:", "", function(title) {
            if (title && title.trim()) confirmCreateEmptyFormWithTitle(title.trim());
        });
    }
}
function closeCreateFormModal() {
    var m = document.getElementById('create-form-modal');
    if (m) m.classList.remove('active');
}
function confirmCreateEmptyForm() {
    var inp = document.getElementById('create-form-title');
    var title = (inp && inp.value || '').trim();
    if (!title) {
        showAlert('Введите название формы', 'edit');
        return;
    }
    confirmCreateEmptyFormWithTitle(title);
}
function confirmCreateEmptyFormWithTitle(title) {
    allForms.push({ title: title, questions: [], settings: { saveProgress: true, showCorrect: true, showWrong: true } });
    currentFormIndex = allForms.length - 1;
    saveFormsToStorage();
    renderAllFormsUI();
    loadCurrentForm();
    closeCreateFormModal();
    showAlert('Новая форма создана!', 'check_circle');
}

function openAccessCardWizard() {
    closeFormSettings();
    var m = document.getElementById('access-card-wizard');
    if (m) m.classList.add('active');
}
function closeAccessCardWizard() {
    var m = document.getElementById('access-card-wizard');
    if (m) m.classList.remove('active');
}

function buildAdminAccessPayload(formIndex) {
    var form = allForms[formIndex];
    var auth = getFormAdminAuth(form);
    // MFAD = MyForm Admin Device card v1
    return ['MFAD', 'v1', String(formIndex), String(auth.u), String(auth.p), (form && form.title) ? String(form.title).slice(0, 80) : ''].join('|');
}

function parseAdminAccessPayload(raw) {
    var s = String(raw || '').trim();
    // also accept URL-like
    if (s.indexOf('MFAD|') === -1 && s.indexOf('MFAD%7C') !== -1) {
        try { s = decodeURIComponent(s); } catch (e) {}
    }
    var i = s.indexOf('MFAD|');
    if (i > 0) s = s.slice(i);
    var parts = s.split('|');
    if (parts[0] !== 'MFAD' || parts[1] !== 'v1' || parts.length < 5) return null;
    return {
        formIndex: parseInt(parts[2], 10),
        login: parts[3],
        pass: parts[4],
        title: parts[5] || ''
    };
}

function printTeacherAccessCard() {
    closeAccessCardWizard();
    var fi = currentFormIndex;
    var form = allForms[fi];
    if (!form) {
        showAlert('Нет активной формы', 'error');
        return;
    }
    var auth = getFormAdminAuth(form);
    var payload = buildAdminAccessPayload(fi);
    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=M&data=' + encodeURIComponent(payload);
    var w = window.open('', '_blank');
    if (!w) {
        showAlert('Разрешите всплывающие окна для печати карты', 'warning');
        return;
    }
    var html = '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Карта доступа — ' +
        (form.title || 'Форма').replace(/</g, '') + '</title><style>' +
        'body{font-family:system-ui,Segoe UI,sans-serif;padding:24px;color:#111;max-width:480px;margin:0 auto;}' +
        '.card{border:2px solid #1a73e8;border-radius:16px;padding:20px;}' +
        'h1{font-size:18px;margin:0 0 8px;}' +
        '.warn{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:10px;font-size:13px;margin:12px 0;}' +
        '.row{margin:6px 0;font-size:14px;}' +
        '.qr{text-align:center;margin:16px 0;}' +
        'code{font-size:11px;word-break:break-all;background:#f3f4f6;padding:6px 8px;border-radius:6px;display:block;}' +
        '.hint{font-size:12px;color:#555;margin-top:12px;line-height:1.45;}' +
        '@media print{button{display:none!important;}}' +
        '</style></head><body>' +
        '<div class="card">' +
        '<h1>Карта преподавателя — My Form</h1>' +
        '<div class="row"><b>Форма:</b> ' + String(form.title || ('№' + (fi + 1))).replace(/</g, '') + '</div>' +
        '<div class="row"><b>Роль:</b> Вход в админ-панель</div>' +
        '<div class="row"><b>Логин:</b> ' + String(auth.u).replace(/</g, '') + '</div>' +
        '<div class="row"><b>Пароль:</b> ' + String(auth.p).replace(/</g, '') + '</div>' +
        '<div class="warn"><b>⚠ НИКОМУ НЕ ПОКАЗЫВАЙТЕ</b><br>Карта даёт полный доступ к редактированию этой формы. Не фотографируйте и не пересылайте посторонним.</div>' +
        '<div class="qr"><img src="' + qrUrl + '" width="240" height="240" alt="QR"><div style="font-size:12px;margin-top:6px;">Отсканируйте в «Войти по коду»</div></div>' +
        '<div class="hint"><b>Инструкция:</b> My Form → Вход для администратора → «Войти по коду» → наведите камеру на QR. Если камера недоступна — введите код вручную:</div>' +
        '<code>' + payload.replace(/</g, '') + '</code>' +
        '</div>' +
        '<p style="text-align:center;margin-top:16px;"><button onclick="window.print()" style="padding:10px 18px;border:none;border-radius:10px;background:#1a73e8;color:#fff;font-weight:600;cursor:pointer;">Печать</button></p>' +
        '<script>setTimeout(function(){try{window.print();}catch(e){}},600);<\/script>' +
        '</body></html>';
    w.document.open();
    w.document.write(html);
    w.document.close();
}

var _qrStream = null;
var _qrScanTimer = null;
var _qrDetector = null;

function openQrLoginScanner() {
    var m = document.getElementById('qr-login-modal');
    if (m) m.classList.add('active');
    var st = document.getElementById('qr-login-status');
    if (st) st.textContent = 'Запрос доступа к камере…';
    startQrCamera();
}
function closeQrLoginScanner() {
    stopQrCamera();
    var m = document.getElementById('qr-login-modal');
    if (m) m.classList.remove('active');
}
function stopQrCamera() {
    if (_qrScanTimer) { clearInterval(_qrScanTimer); _qrScanTimer = null; }
    if (_qrStream) {
        try { _qrStream.getTracks().forEach(function(t) { t.stop(); }); } catch (e) {}
        _qrStream = null;
    }
    var v = document.getElementById('qr-login-video');
    if (v) v.srcObject = null;
}
function startQrCamera() {
    var video = document.getElementById('qr-login-video');
    var st = document.getElementById('qr-login-status');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (st) st.textContent = 'Камера недоступна — вставьте код вручную ниже';
        return;
    }
    navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(function(stream) {
        _qrStream = stream;
        if (video) {
            video.srcObject = stream;
            video.setAttribute('playsinline', 'true');
            video.play().catch(function(){});
        }
        if (st) st.textContent = 'Наведите на QR карты…';
        if (window.BarcodeDetector) {
            try {
                _qrDetector = new BarcodeDetector({ formats: ['qr_code'] });
            } catch (e) { _qrDetector = null; }
        }
        if (_qrScanTimer) clearInterval(_qrScanTimer);
        _qrScanTimer = setInterval(scanQrFrame, 450);
    }).catch(function(err) {
        console.warn(err);
        if (st) st.textContent = 'Нет доступа к камере — введите код вручную';
        showAlert('Камера недоступна. Нужен HTTPS/localhost или разрешение. Можно ввести код с карты вручную.', 'videocam_off');
    });
}
function scanQrFrame() {
    var video = document.getElementById('qr-login-video');
    if (!video || video.readyState < 2) return;
    if (_qrDetector) {
        _qrDetector.detect(video).then(function(codes) {
            if (codes && codes.length) {
                var raw = codes[0].rawValue || codes[0].rawData || '';
                if (raw) onQrCodeDetected(String(raw));
            }
        }).catch(function(){});
        return;
    }
    // Без BarcodeDetector — только ручной ввод (локальный MVP)
}
function playQrBeep() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 880;
        g.gain.value = 0.08;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        setTimeout(function() { try { o.stop(); ctx.close(); } catch (e) {} }, 120);
    } catch (e) {}
}
function onQrCodeDetected(raw) {
    var data = parseAdminAccessPayload(raw);
    if (!data) return; // ignore other QR
    stopQrCamera();
    playQrBeep();
    applyQrAdminLogin(data);
}
function submitManualQrLogin() {
    var inp = document.getElementById('qr-login-manual');
    var raw = (inp && inp.value || '').trim();
    if (!raw) {
        showAlert('Вставьте код с карты', 'qr_code');
        return;
    }
    var data = parseAdminAccessPayload(raw);
    if (!data) {
        showAlert('Код не распознан. Нужен формат MFAD|v1|…', 'error');
        return;
    }
    playQrBeep();
    applyQrAdminLogin(data);
}
function applyQrAdminLogin(data) {
    if (!data || isNaN(data.formIndex) || data.formIndex < 0 || data.formIndex >= allForms.length) {
        // try match by title
        var found = -1;
        if (data && data.title) {
            for (var i = 0; i < allForms.length; i++) {
                if ((allForms[i].title || '') === data.title) { found = i; break; }
            }
        }
        if (found < 0) {
            showAlert('Форма из карты не найдена на этом устройстве. Сначала откройте/импортируйте ту же форму.', 'error');
            return;
        }
        data.formIndex = found;
    }
    currentFormIndex = data.formIndex;
    var form = allForms[currentFormIndex];
    var stored = getFormAdminAuth(form);
    if (String(data.login) === String(stored.u) && String(data.pass) === String(stored.p)) {
        closeQrLoginScanner();
        closeLoginModal();
        renderAllFormsUI();
        switchScreen('admin');
        showAlert('Вход по карте выполнен', 'check_circle');
    } else {
        showAlert('Код карты не совпадает с логином/паролем этой формы (пароль могли сменить).', 'lock');
        openQrLoginScanner();
    }
}



function logout() { loadCurrentForm(); }

function toggleAddQuestionForm() {
    const formEl = document.getElementById('admin-add-form');
    if (formEl.classList.contains('hidden')) {
        cancelEditQuestion();
        formEl.classList.remove('hidden');
    } else {
        formEl.classList.add('hidden');
    }
}


function formatQuestionTypeLabel(type) {
    var map = {
        'radio': 'Radio',
        'checkbox': 'Checkbox',
        'select': 'Select',
        'text': 'Текст',
        'true-false': 'Верно/Неверно ★',
        'fill-blank': 'Пропуски ★',
        'puzzle-drag': 'Пазл',
        'info-slide': 'Инфо',
        'flashcard': 'Флешкарта',
        'table': 'Таблица ★ BETA'
    };
    return map[type] || type;
}

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    
    document.getElementById('admin-choices-fields').classList.toggle('hidden', !['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type));
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text');
    var tfBox = document.getElementById('admin-truefalse-fields');
    if (tfBox) tfBox.classList.toggle('hidden', type !== 'true-false');
    var fbBox = document.getElementById('admin-fillblank-fields');
    if (fbBox) fbBox.classList.toggle('hidden', type !== 'fill-blank');
    document.getElementById('flashcard-answer-box').classList.toggle('hidden', type !== 'flashcard');
    document.getElementById('media-upload-box').classList.toggle('hidden', type !== 'info-slide');
    var tblBox = document.getElementById('admin-table-fields');
    if (tblBox) {
        tblBox.classList.toggle('hidden', type !== 'table');
        if (type === 'table') rebuildAdminTableGrid();
    }
    if (type !== 'info-slide') {
        var ytIn = document.getElementById('new-youtube-url');
        if (ytIn) ytIn.value = '';
        var adIn = document.getElementById('new-allow-draw');
        if (adIn) adIn.checked = false;
    }

    // Заголовок всегда виден; для fill-blank — опциональный
    var titleField = document.getElementById('new-title');
    var titleWrap = titleField ? titleField.closest('.admin-field') : null;
    if (titleWrap) titleWrap.classList.remove('hidden');
    if (titleField) {
        if (type === 'fill-blank') {
            titleField.placeholder = 'Заголовок (необязательно)…';
            var lab = titleWrap ? titleWrap.querySelector('label') : null;
            if (lab) lab.innerHTML = 'Заголовок вопроса <span style="color:var(--text-muted);font-weight:400;">(необязательно)</span>:';
        } else {
            titleField.placeholder = 'Введите заголовок...';
            var lab2 = titleWrap ? titleWrap.querySelector('label') : null;
            if (lab2) lab2.textContent = 'Заголовок вопроса:';
        }
    }
    if (type === 'true-false') updateTrueFalsePreview();
    if (type === 'fill-blank') {
        var ta = document.getElementById('new-fillblank-text');
        if (ta && !ta._fbBound) {
            ta.addEventListener('input', updateFillBlankAdminPreview);
            ta._fbBound = true;
        }
        updateFillBlankAdminPreview();
    }
}

function updateTrueFalsePreview() {
    var en = document.getElementById('tf-use-en');
    var useEn = en && en.checked;
    var t = document.getElementById('tf-label-true-preview');
    var f = document.getElementById('tf-label-false-preview');
    if (t) t.textContent = useEn ? 'True' : 'Верно';
    if (f) f.textContent = useEn ? 'False' : 'Неверно';
}

function parseFillBlankTemplate(text) {
    // [answer] or [a|b|c]
    var blanks = [];
    var re = /\[([^\]]+)\]/g;
    var m;
    var src = String(text || '');
    while ((m = re.exec(src)) !== null) {
        var raw = m[1].trim();
        var alts = raw.split('|').map(function(s) { return s.trim(); }).filter(Boolean);
        blanks.push({ raw: raw, answers: alts.length ? alts : [raw] });
    }
    return blanks;
}

function updateFillBlankAdminPreview() {
    var ta = document.getElementById('new-fillblank-text');
    var prev = document.getElementById('fillblank-preview');
    if (!ta || !prev) return;
    var text = ta.value || '';
    var blanks = parseFillBlankTemplate(text);
    if (!text.trim()) {
        prev.innerHTML = '';
        return;
    }
    var html = escapeHtml(text).replace(/\[([^\]]+)\]/g, function(_, inner) {
        return '<span class="fb-tag">' + escapeHtml(inner) + '</span>';
    });
    prev.innerHTML = '<div style="margin-bottom:4px;font-size:11px;font-weight:700;color:var(--text-muted);">Превью · пропусков: ' + blanks.length + '</div>' + html;
}

function toggleTextInputs(source) {
    const inline = document.getElementById('new-inline-input');
    const multiline = document.getElementById('new-multiline-input');
    
    if (source === 'inline' && inline.checked) multiline.checked = false;
    if (source === 'multiline' && multiline.checked) inline.checked = false;
    
    multiline.disabled = inline.checked;
    inline.disabled = multiline.checked;
}

function handleMediaUploadPreview(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedMediaBase64 = e.target.result;
        document.getElementById('media-preview-container').innerHTML = renderMediaHTML(uploadedMediaBase64);
    };
    reader.readAsDataURL(file);
}

function addQuestion() {
    const type = document.getElementById('new-type').value;
    let title = document.getElementById('new-title').value.trim();
    const useInlineEl = document.getElementById('new-inline-input');
    const useInline = (type === 'text' && useInlineEl) ? useInlineEl.checked : false;

    if (type === 'fill-blank') {
        var fbRaw = ((document.getElementById('new-fillblank-text') || {}).value || '').trim();
        if (!fbRaw) {
            showAlert('Введите текст с пропусками, например: Столица — [Париж]', 'warning');
            return;
        }
        // заголовок опционален; в title кладём шаблон (для списка/результатов)
        if (!title) title = fbRaw.length > 60 ? (fbRaw.slice(0, 57) + '…') : fbRaw;
    }
    if (!title) {
        showAlert('Введите текст вопроса!', 'warning');
        return;
    }

    if (type === 'text' && useInline && !title.includes('[input]')) {
        showInlineErrorModal(
            () => {
                if (useInlineEl) useInlineEl.checked = false;
                processSaveQuestion(type, title, false);
            },
            () => {
                const titleInput = document.getElementById('new-title');
                if (titleInput) titleInput.focus();
            }
        );
        return;
    }

    processSaveQuestion(type, title, useInline);
}

function processSaveQuestion(type, title, useInline) {
    const form = allForms[currentFormIndex];
    const descInput = document.getElementById('new-description');
    const description = descInput ? descInput.value.trim() : '';

    ensureFormThemes(form);
    if (!currentThemeId && form.themes && form.themes.length) {
        currentThemeId = form.themes[0].id;
    }

    const newQ = {
        type: type,
        title: title,
        required: document.getElementById('new-required').checked,
        themeId: currentThemeId || (form.themes && form.themes[0] && form.themes[0].id) || 'theme-default'
    };

    if (description) newQ.description = description;

    if (['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type)) {
        const opts = document.getElementById('new-options').value.split(',').map(s => s.trim()).filter(Boolean);
        const correct = document.getElementById('new-correct-choices').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        newQ.options = opts;
        newQ.correctChoices = correct;
    } else if (type === 'true-false') {
        var useEn = !!(document.getElementById('tf-use-en') && document.getElementById('tf-use-en').checked);
        newQ.options = useEn ? ['True', 'False'] : ['Верно', 'Неверно'];
        var corrEl = document.querySelector('input[name="tf-correct"]:checked');
        var corrIdx = corrEl ? parseInt(corrEl.value, 10) : 0;
        if (isNaN(corrIdx)) corrIdx = 0;
        newQ.correctChoices = [corrIdx];
        newQ.tfUseEn = useEn;
        newQ.tfBigButtons = !!(document.getElementById('tf-big-buttons') && document.getElementById('tf-big-buttons').checked);
    } else if (type === 'fill-blank') {
        var fbText = (document.getElementById('new-fillblank-text') || {}).value || '';
        fbText = String(fbText).trim();
        if (!fbText) {
            showAlert('Введите текст с пропусками [ответ]', 'warning');
            return;
        }
        var blanks = parseFillBlankTemplate(fbText);
        if (!blanks.length) {
            showAlert('Добавьте хотя бы один пропуск: [правильный ответ]', 'warning');
            return;
        }
        // title — короткий заголовок (если ввели), иначе кусок шаблона
        var heading = (document.getElementById('new-title') || {}).value || '';
        heading = String(heading).trim();
        newQ.fillBlankTemplate = fbText;
        newQ.title = heading || (fbText.length > 60 ? fbText.slice(0, 57) + '…' : fbText);
        newQ.blanks = blanks.map(function(b) { return b.answers; });
        newQ.fbCaseSensitive = !!(document.getElementById('fb-case-sensitive') && document.getElementById('fb-case-sensitive').checked);
        newQ.fbTrimSpaces = !(document.getElementById('fb-trim-spaces') && !document.getElementById('fb-trim-spaces').checked);
        newQ.fbAcceptAlts = !(document.getElementById('fb-accept-alts') && !document.getElementById('fb-accept-alts').checked);
    } else if (type === 'text') {
        newQ.correctText = document.getElementById('new-correct-text').value.split(',').map(s => s.trim()).filter(Boolean);
        if (useInline) newQ.useInlineInput = true;
        if (document.getElementById('new-multiline-input')?.checked) newQ.multiline = true;
        if (document.getElementById('new-allow-format')?.checked) newQ.allowFormat = true;
        if (document.getElementById('new-side-notes')?.checked) newQ.sideNotes = true;
    } else if (type === 'table') {
        var tr = parseInt((document.getElementById('table-rows') || {}).value, 10) || 3;
        var tc = parseInt((document.getElementById('table-cols') || {}).value, 10) || 3;
        tr = Math.min(25, Math.max(1, tr));
        tc = Math.min(25, Math.max(1, tc));
        newQ.tableRows = tr;
        newQ.tableCols = tc;
        newQ.tableAllowAllEdit = !!(document.getElementById('table-allow-all-edit') && document.getElementById('table-allow-all-edit').checked);
        newQ.tableCells = collectAdminTableCells(tr, tc, newQ.tableAllowAllEdit);
        newQ._beta = true;
    } else if (type === 'flashcard') {
        newQ.flashcardAnswer = document.getElementById('new-flashcard-answer').value.trim();
    } else if (type === 'info-slide') {
        if (uploadedMediaBase64) {
            newQ.mediaUrl = uploadedMediaBase64;
        } else if (editingQuestionIndex !== null && form.questions[editingQuestionIndex] && form.questions[editingQuestionIndex].mediaUrl) {
            newQ.mediaUrl = form.questions[editingQuestionIndex].mediaUrl;
        }
        var ytEl = document.getElementById('new-youtube-url');
        var yt = ytEl ? (ytEl.value || '').trim() : '';
        if (yt) newQ.youtubeUrl = yt;
        var ad = document.getElementById('new-allow-draw');
        if (ad && ad.checked) newQ.allowDraw = true;
        else newQ.allowDraw = false;
    }

    if (document.getElementById('toggle-hint-input').checked) {
        newQ.hintText = document.getElementById('new-hint-text').value.trim();
    }
    if (document.getElementById('toggle-timer-input').checked) {
        newQ.timer = parseInt(document.getElementById('new-timer').value) || 20;
    }

    const hasExpCheck = document.getElementById('questionHasExplanation');
    if (hasExpCheck && hasExpCheck.checked) {
        newQ.hasExplanation = true;
        newQ.explanationTitle = (document.getElementById('questionExplanationTitle') || {}).value || '';
        newQ.explanationTitle = String(newQ.explanationTitle).trim();
        newQ.explanationText = (document.getElementById('questionExplanationText') || {}).value || '';
        newQ.explanationText = String(newQ.explanationText).trim();
        var holdEl = document.getElementById('questionHoldTimer');
        newQ.holdTimer = holdEl ? (parseInt(holdEl.value, 10) || 0) : 0;
    } else {
        newQ.hasExplanation = false;
        newQ.explanationTitle = '';
        newQ.explanationText = '';
        newQ.holdTimer = 0;
    }

    const hasAnsExp = document.getElementById('questionHasAnswerExplanations');
    if (hasAnsExp && hasAnsExp.checked) {
        newQ.hasAnswerExplanations = true;
        newQ.answerExpCorrect = ((document.getElementById('answerExpCorrect') || {}).value || '').trim();
        const rawIncorrect = ((document.getElementById('answerExpIncorrect') || {}).value || '').trim();
        const incorrectMap = {};
        if (rawIncorrect) {
            rawIncorrect.split('|').forEach(function(part) {
                var m = part.trim().match(/^(\d+)\s*[:\-]\s*(.+)$/);
                if (m) incorrectMap[parseInt(m[1], 10)] = m[2].trim();
            });
        }
        newQ.answerExpIncorrect = incorrectMap;
    } else {
        newQ.hasAnswerExplanations = false;
        newQ.answerExpCorrect = '';
        newQ.answerExpIncorrect = {};
    }


    // Всегда привязываем к выбранной теме в админке
    ensureFormThemes(form);
    newQ.themeId = currentThemeId || form.themes[0].id;

    if (editingQuestionIndex !== null) {
        form.questions[editingQuestionIndex] = newQ;
        showAlert('Вопрос успешно обновлён!', 'check_circle');
    } else {
        form.questions.push(newQ);
        showAlert('Вопрос успешно сохранён!', 'check_circle');
    }

    saveFormsToStorage();
    cancelEditQuestion();
    renderAdminQuestionsList();
    if (typeof renderThemeUI === 'function') renderThemeUI();
}

function toggleSaveProgressWarning() {
    var el = document.getElementById('fs-save-progress');
    var warn = document.getElementById('fs-save-progress-warning');
    if (!warn) return;
    if (el && !el.checked) warn.classList.remove('hidden');
    else warn.classList.add('hidden');
}

function openFormSettings() {
    const form = allForms[currentFormIndex];
    if (!form) return;
    if (!form.settings) form.settings = { isTestMode: false, publishType: 'immediate', defaultPoints: 10, showWrong: true, showCorrect: true, showPoints: true };

    const modal = document.getElementById('form-settings-modal');
    if (!modal) {
        showAlert('Модалка настроек не найдена', 'error');
        return;
    }

    try {
        document.getElementById('fs-test-mode').checked = !!form.settings.isTestMode;
        const pub = document.getElementById('fs-publish-type');
        if (pub) {
            pub.value = form.settings.publishType || 'immediate';
            syncEnhancedSelect(pub);
        }
        document.getElementById('fs-default-points').value = form.settings.defaultPoints || 10;
        document.getElementById('fs-show-wrong').checked = form.settings.showWrong !== false;
        document.getElementById('fs-show-correct').checked = form.settings.showCorrect !== false;
        document.getElementById('fs-show-points').checked = form.settings.showPoints !== false;
        var lockEl = document.getElementById('fs-lock-themes');
        if (lockEl) lockEl.checked = !!form.settings.lockNextThemes;
        var defReq = document.getElementById('fs-default-required');
        if (defReq) defReq.checked = !!form.settings.defaultRequired;
        var emailEl = document.getElementById('fs-teacher-email');
        if (emailEl) emailEl.value = form.settings.teacherEmail || '';
        var saveProg = document.getElementById('fs-save-progress');
        if (saveProg) saveProg.checked = form.settings.saveProgress !== false;
        if (typeof toggleSaveProgressWarning === 'function') toggleSaveProgressWarning();

        toggleTestModeSettings();
        enhanceAllSelects(modal);
    } catch (e) {
        console.warn('openFormSettings fill error', e);
    }

    modal.classList.add('active');
}

function toggleTestModeSettings() {
    const isTest = document.getElementById('fs-test-mode') && document.getElementById('fs-test-mode').checked;
    const box = document.getElementById('fs-test-settings');
    if (box) box.classList.toggle('hidden', !isTest);
}

function saveFormSettings() {
    if (!allForms[currentFormIndex]) return;
    var prev = allForms[currentFormIndex].settings || {};
    var lockEl = document.getElementById('fs-lock-themes');
    var emailEl = document.getElementById('fs-teacher-email');
    var pub = document.getElementById('fs-publish-type');
    allForms[currentFormIndex].settings = Object.assign({}, prev, {
        isTestMode: !!(document.getElementById('fs-test-mode') && document.getElementById('fs-test-mode').checked),
        publishType: pub ? pub.value : (prev.publishType || 'immediate'),
        showWrong: !!(document.getElementById('fs-show-wrong') && document.getElementById('fs-show-wrong').checked),
        showCorrect: !!(document.getElementById('fs-show-correct') && document.getElementById('fs-show-correct').checked),
        showPoints: !!(document.getElementById('fs-show-points') && document.getElementById('fs-show-points').checked),
        defaultPoints: parseInt((document.getElementById('fs-default-points') || {}).value, 10) || 10,
        defaultRequired: !!(document.getElementById('fs-default-required') && document.getElementById('fs-default-required').checked),
        lockNextThemes: !!(lockEl && lockEl.checked),
        teacherEmail: emailEl ? (emailEl.value || '').trim() : (prev.teacherEmail || ''),
        saveProgress: !!(document.getElementById('fs-save-progress') && document.getElementById('fs-save-progress').checked)
    });
    // если сохранение выключили — чистим прогресс этой формы
    if (!allForms[currentFormIndex].settings.saveProgress) {
        try { clearSessionProgress(currentFormIndex); } catch (e) {}
        try {
            var map = loadThemeProgress();
            var prefix = currentFormIndex + '::';
            Object.keys(map).forEach(function(k) { if (k.indexOf(prefix) === 0) delete map[k]; });
            saveThemeProgress(map);
        } catch (e) {}
    }
    saveFormsToStorage();
    const modal = document.getElementById('form-settings-modal');
    if (modal) modal.classList.remove('active');
    if (typeof renderThemeUI === 'function') renderThemeUI();
    showAlert('Настройки формы применены!', 'check_circle');
}

function closeFormSettings() {
    const modal = document.getElementById('form-settings-modal');
    if (modal) modal.classList.remove('active');
}

function editQuestion(idx) {
    const q = allForms[currentFormIndex].questions[idx];
    if (!q) return;

    editingQuestionIndex = idx;

    const formEl = document.getElementById('admin-add-form');
    formEl.classList.remove('hidden');
    document.getElementById('admin-form-title').textContent = `Редактирование вопроса №${idx + 1}`;
    document.getElementById('save-question-btn').textContent = 'Сохранить изменения';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');

    document.getElementById('new-type').value = q.type;
    toggleAdminFields();

    document.getElementById('new-title').value = q.title || '';
    
    const descInput = document.getElementById('new-description');
    if (descInput) descInput.value = q.description || '';

    document.getElementById('new-required').checked = !!q.required;

    if (['radio', 'checkbox', 'select', 'puzzle-drag'].includes(q.type)) {
        document.getElementById('new-options').value = (q.options || []).join(', ');
        document.getElementById('new-correct-choices').value = (q.correctChoices || []).join(', ');
    } else if (q.type === 'true-false') {
        var useEn = !!q.tfUseEn;
        var enEl = document.getElementById('tf-use-en');
        if (enEl) enEl.checked = useEn;
        var bigEl = document.getElementById('tf-big-buttons');
        if (bigEl) bigEl.checked = !!q.tfBigButtons;
        updateTrueFalsePreview();
        var ci = (q.correctChoices && q.correctChoices[0] != null) ? Number(q.correctChoices[0]) : 0;
        var r0 = document.getElementById('tf-correct-true');
        var r1 = document.getElementById('tf-correct-false');
        if (r0 && r1) {
            r0.checked = ci === 0;
            r1.checked = ci === 1;
        }
    } else if (q.type === 'fill-blank') {
        var fbt = document.getElementById('new-fillblank-text');
        if (fbt) fbt.value = q.fillBlankTemplate || q.title || '';
        var cs = document.getElementById('fb-case-sensitive');
        if (cs) cs.checked = !!q.fbCaseSensitive;
        var tr = document.getElementById('fb-trim-spaces');
        if (tr) tr.checked = q.fbTrimSpaces !== false;
        var aa = document.getElementById('fb-accept-alts');
        if (aa) aa.checked = q.fbAcceptAlts !== false;
        updateFillBlankAdminPreview();
    } else if (q.type === 'text') {
        document.getElementById('new-correct-text').value = (q.correctText || []).join(', ');
        const inlineCheck = document.getElementById('new-inline-input');
        if (inlineCheck) inlineCheck.checked = !!q.useInlineInput;
        const multiCheck = document.getElementById('new-multiline-input');
        if (multiCheck) multiCheck.checked = !!q.multiline;
        const formatCheck = document.getElementById('new-allow-format');
        if (formatCheck) formatCheck.checked = !!q.allowFormat;
        const sideCheck = document.getElementById('new-side-notes');
        if (sideCheck) sideCheck.checked = !!q.sideNotes;
        if (typeof toggleTextInputs === 'function') toggleTextInputs(q.useInlineInput ? 'inline' : (q.multiline ? 'multiline' : ''));
    } else if (q.type === 'flashcard') {
        document.getElementById('new-flashcard-answer').value = q.flashcardAnswer || '';
    } else if (q.type === 'info-slide') {
        var ytIn = document.getElementById('new-youtube-url');
        if (ytIn) ytIn.value = q.youtubeUrl || '';
        var adIn = document.getElementById('new-allow-draw');
        if (adIn) adIn.checked = !!q.allowDraw;
    }
    if (q.type === 'info-slide' && q.mediaUrl) {
        document.getElementById('media-preview-container').innerHTML = renderMediaHTML(q.mediaUrl);
    }

    const timerToggle = document.getElementById('toggle-timer-input');
    if (q.timer) {
        timerToggle.checked = true;
        document.getElementById('timer-config').classList.remove('hidden');
        document.getElementById('new-timer').value = q.timer;
    } else {
        timerToggle.checked = false;
        document.getElementById('timer-config').classList.add('hidden');
    }

    const hintToggle = document.getElementById('toggle-hint-input');
    if (q.hintText) {
        hintToggle.checked = true;
        document.getElementById('hint-config').classList.remove('hidden');
        document.getElementById('new-hint-text').value = q.hintText;
    } else {
        hintToggle.checked = false;
        document.getElementById('hint-config').classList.add('hidden');
    }

    const hasExpCheck = document.getElementById('questionHasExplanation');
    if (q.hasExplanation) {
        if (hasExpCheck) hasExpCheck.checked = true;
        toggleExplanationFields(hasExpCheck);
        document.getElementById('questionExplanationTitle').value = q.explanationTitle || '';
        document.getElementById('questionExplanationText').value = q.explanationText || '';
        document.getElementById('questionHoldTimer').value = q.holdTimer || 0;
    } else {
        if (hasExpCheck) hasExpCheck.checked = false;
        toggleExplanationFields(hasExpCheck);
    }

    // Answer explanations
    const hasAnsExp = document.getElementById('questionHasAnswerExplanations');
    if (q.hasAnswerExplanations) {
        if (hasAnsExp) hasAnsExp.checked = true;
        toggleAnswerExplanationsFields(hasAnsExp);
        document.getElementById('answerExpCorrect').value = q.answerExpCorrect || '';
        const inc = q.answerExpIncorrect || {};
        const str = Object.keys(inc).map(k => `${k}: ${inc[k]}`).join(' | ');
        document.getElementById('answerExpIncorrect').value = str;
    } else {
        if (hasAnsExp) hasAnsExp.checked = false;
        toggleAnswerExplanationsFields(hasAnsExp);
        document.getElementById('answerExpCorrect').value = '';
        document.getElementById('answerExpIncorrect').value = '';
    }

    formEl.scrollIntoView({ behavior: 'smooth' });
}

function cancelEditQuestion() {
    editingQuestionIndex = null;
    uploadedMediaBase64 = null;

    document.getElementById('admin-form-title').textContent = 'Новый элемент';
    document.getElementById('save-question-btn').textContent = 'Сохранить вопрос';
    document.getElementById('cancel-edit-btn').classList.add('hidden');

    document.getElementById('new-title').value = '';
    
    const descInput = document.getElementById('new-description');
    if (descInput) descInput.value = '';

    document.getElementById('new-options').value = '';
    document.getElementById('new-correct-choices').value = '';
    document.getElementById('new-correct-text').value = '';
    var _fbt = document.getElementById('new-fillblank-text'); if (_fbt) _fbt.value = '';
    var _fbp = document.getElementById('fillblank-preview'); if (_fbp) _fbp.innerHTML = '';
    document.getElementById('new-flashcard-answer').value = '';
    document.getElementById('new-hint-text').value = '';
    // По умолчанию из настроек формы «Помечать новые вопросы обязательными»
    (function() {
        var form = allForms[currentFormIndex];
        var def = form && form.settings && form.settings.defaultRequired;
        document.getElementById('new-required').checked = !!def;
    })();
    
    const inlineCheck = document.getElementById('new-inline-input');
    if (inlineCheck) inlineCheck.checked = false;
    const multiCheck = document.getElementById('new-multiline-input');
    if (multiCheck) { multiCheck.checked = false; multiCheck.disabled = false; }
    const formatCheck = document.getElementById('new-allow-format');
    if (formatCheck) formatCheck.checked = false;
    const sideCheck = document.getElementById('new-side-notes');
    if (sideCheck) sideCheck.checked = false;

    document.getElementById('toggle-timer-input').checked = false;
    document.getElementById('timer-config').classList.add('hidden');
    document.getElementById('toggle-hint-input').checked = false;
    document.getElementById('hint-config').classList.add('hidden');
    
    const hasExpCheck = document.getElementById('questionHasExplanation');
    if (hasExpCheck) hasExpCheck.checked = false;
    toggleExplanationFields(hasExpCheck);
    document.getElementById('questionExplanationTitle').value = '';
    document.getElementById('questionExplanationText').value = '';
    document.getElementById('questionHoldTimer').value = 0;

    const hasAnsExp = document.getElementById('questionHasAnswerExplanations');
    if (hasAnsExp) hasAnsExp.checked = false;
    toggleAnswerExplanationsFields(hasAnsExp);
    document.getElementById('answerExpCorrect').value = '';
    document.getElementById('answerExpIncorrect').value = '';

    document.getElementById('media-preview-container').innerHTML = '';

    document.getElementById('new-type').value = 'radio';
    toggleAdminFields();
}

function viewQuestionDetails(idx) {
    const q = allForms[currentFormIndex].questions[idx];
    if (!q) return;

    const modal = document.getElementById('question-details-modal');
    const content = document.getElementById('question-details-content');

    let html = `
        <div class="detail-row">
            <strong>Текст вопроса:</strong>
            <div style="font-size:15px; margin-top:4px; font-weight:600;">${q.title}</div>
        </div>
    `;

    if (q.description) {
        html += `
            <div class="detail-row">
                <strong>Описание:</strong>
                <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">${q.description}</div>
            </div>
        `;
    }

    html += `
        <div class="detail-row">
            <strong>Тип элемента:</strong> <span class="detail-badge">${q.type}</span>
        </div>
        <div class="detail-row">
            <strong>Обязательный:</strong> ${q.required ? 'Да' : 'Нет'}
        </div>
    `;

    if (q.type === 'text') {
        html += `
            <div class="detail-row">
                <strong>Инлайновый Input:</strong> ${q.useInlineInput ? 'Да ([input])' : 'Нет'}
            </div>
            <div class="detail-row">
                <strong>Правильные варианты ввода:</strong>
                <div style="margin-top:4px;">${(q.correctText || []).map(t => `<span class="detail-badge correct">${t}</span>`).join(' ')}</div>
            </div>
        `;
    } else if (['radio', 'checkbox', 'select', 'puzzle-drag'].includes(q.type)) {
        html += `<div class="detail-row"><strong>Варианты ответов:</strong><ol style="margin-top:6px; padding-left:20px;">`;
        (q.options || []).forEach((opt, oIdx) => {
            const isCorrect = (q.correctChoices || []).includes(oIdx);
            html += `
                <li style="margin-bottom:4px;">
                    ${opt} ${isCorrect ? '<span class="detail-badge correct">✓ Правильный (индекс ' + oIdx + ')</span>' : ''}
                </li>
            `;
        });
        html += `</ol></div>`;
    } else if (q.type === 'flashcard') {
        html += `
            <div class="detail-row">
                <strong>Оборотная сторона карточки:</strong>
                <div style="margin-top:4px; color:var(--text-muted);">${q.flashcardAnswer || 'Не указано'}</div>
            </div>
        `;
    }

    if (q.hasExplanation) {
        html += `
            <div class="detail-row">
                <strong>Разбор ответа (Объяснение):</strong>
                <div style="margin-top:4px; font-weight:600;">${q.explanationTitle || 'Без заголовка'}</div>
                <div style="margin-top:2px; color:var(--text-muted);">${q.explanationText || 'Текст отсутствует'}</div>
                <div style="margin-top:2px; font-size:12px;">Удержание кнопки: ${q.holdTimer || 0} сек</div>
            </div>
        `;
    }

    if (q.timer) html += `<div class="detail-row"><strong>Таймер:</strong> ⏱️ ${q.timer} секунд</div>`;
    if (q.hintText) html += `<div class="detail-row"><strong>Подсказка:</strong> 💡 ${q.hintText}</div>`;
    if (q.mediaUrl) html += `<div class="detail-row"><strong>Прикреплённое медиа:</strong> <br>${renderMediaHTML(q.mediaUrl)}</div>`;

    content.innerHTML = html;
    modal.classList.add('active');
}

function closeDetailsModal() {
    document.getElementById('question-details-modal').classList.remove('active');
}

function renderAdminQuestionsList() {
    const list = document.getElementById('admin-questions-list');
    const form = allForms[currentFormIndex];
    if (!list || !form) return;
    ensureFormThemes(form);
    initCurrentTheme();
    renderAdminThemeTabs();
    var adminBar = document.getElementById('admin-themes-bar');
    if (adminBar) adminBar.classList.remove('hidden');

    const themeQs = getQuestionsForTheme(form, currentThemeId);
    const theme = getThemeById(form, currentThemeId);
    list.innerHTML = `<h3 style="margin-bottom: 12px;">Вопросы темы «${theme ? theme.title : ''}» (${themeQs.length} из ${form.questions.length}):</h3>`;

    themeQs.forEach(({ q, idx }, pos) => {
        const isFirst = pos === 0;
        const isLast = pos === themeQs.length - 1;

        list.innerHTML += `
            <div class="gcard admin-q-card" data-q-idx="${idx}">
                <div class="admin-q-card-main">
                    <strong>${idx + 1}. ${q.title}</strong>
                    ${q.description ? `<span style="font-size:12px; color:var(--text-muted); display:block; font-style: italic;">${q.description}</span>` : ''}
                    <span style="font-size:11px; color:var(--accent-color); display:block; margin-top:2px;">
                        Тип: ${formatQuestionTypeLabel(q.type)} ${q.useInlineInput ? '(Inline)' : ''} ${q.hasExplanation ? '(с Объяснением)' : ''}
                    </span>
                </div>
                <div class="admin-q-card-actions">
                    <button onclick="moveQuestionUp(${idx})" class="q-action-btn" title="Переместить вверх" ${isFirst ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                        <span class="material-symbols-rounded" style="font-size:18px;">arrow_upward</span>
                    </button>
                    <button onclick="moveQuestionDown(${idx})" class="q-action-btn" title="Переместить вниз" ${isLast ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                        <span class="material-symbols-rounded" style="font-size:18px;">arrow_downward</span>
                    </button>
                    <button onclick="viewQuestionDetails(${idx})" class="q-action-btn" title="Просмотреть все данные">
                        <span class="material-symbols-rounded" style="font-size:16px;">visibility</span> Инфо
                    </button>
                    <button onclick="openQuestionPreview(${idx})" class="q-action-btn preview-q-btn" title="Протестировать вопрос">
                        <span class="material-symbols-rounded" style="font-size:16px;">play_circle</span> Тест
                        
                    </button>
                    <button onclick="editQuestion(${idx})" class="q-action-btn" title="Изменить вопрос">
                        <span class="material-symbols-rounded" style="font-size:16px;">edit</span> Изменить
                    </button>
                    <button onclick="deleteQuestion(${idx})" class="q-action-btn delete-btn" title="Удалить вопрос">
                        <span class="material-symbols-rounded" style="font-size:16px;">delete</span>
                    </button>
                </div>
            </div>
        `;
    });
}

function moveQuestionUp(idx) {
    const form = allForms[currentFormIndex];
    if (!form) return;
    const themeQs = getQuestionsForTheme(form, currentThemeId);
    const pos = themeQs.findIndex(function(item) { return item.idx === idx; });
    if (pos <= 0) return;
    const otherIdx = themeQs[pos - 1].idx;
    const temp = form.questions[otherIdx];
    form.questions[otherIdx] = form.questions[idx];
    form.questions[idx] = temp;
    saveFormsToStorage();
    renderAdminQuestionsList();
    highlightMovedQuestionCards([idx, otherIdx]);
}

function moveQuestionDown(idx) {
    const form = allForms[currentFormIndex];
    if (!form) return;
    const themeQs = getQuestionsForTheme(form, currentThemeId);
    const pos = themeQs.findIndex(function(item) { return item.idx === idx; });
    if (pos < 0 || pos >= themeQs.length - 1) return;
    const otherIdx = themeQs[pos + 1].idx;
    const temp = form.questions[otherIdx];
    form.questions[otherIdx] = form.questions[idx];
    form.questions[idx] = temp;
    saveFormsToStorage();
    renderAdminQuestionsList();
    highlightMovedQuestionCards([idx, otherIdx]);
}

var _moveHighlightTimer = null;
function highlightMovedQuestionCards(indices) {
    if (_moveHighlightTimer) {
        clearTimeout(_moveHighlightTimer);
        _moveHighlightTimer = null;
    }
    document.querySelectorAll('.admin-q-card.card-highlight').forEach(function(el) {
        el.classList.remove('card-highlight');
    });
    var list = document.getElementById('admin-questions-list');
    if (!list) return;
    (indices || []).forEach(function(i) {
        var el = list.querySelector('.admin-q-card[data-q-idx="' + i + '"]');
        if (el) {
            el.classList.add('card-highlight');
            try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
        }
    });
    _moveHighlightTimer = setTimeout(function() {
        document.querySelectorAll('.admin-q-card.card-highlight').forEach(function(el) {
            el.classList.remove('card-highlight');
        });
        _moveHighlightTimer = null;
    }, 2000);
}

function deleteQuestion(idx) {
    showConfirm('Удаление вопроса', 'Вы действительно хотите удалить этот вопрос?', () => {
        allForms[currentFormIndex].questions.splice(idx, 1);
        saveFormsToStorage();
        renderAdminQuestionsList();
        showAlert('Вопрос успешно удалён', 'delete');
    });
}

/* ==========================================
   8. УПРАВЛЕНИЕ АВТОРИЗАЦИЕЙ И УТИЛИТЫ
   ========================================== */
function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    var auth = getFormAdminAuth(allForms[currentFormIndex]);
    var loginEl = document.getElementById('newAdminLogin');
    var passEl = document.getElementById('newAdminPass');
    var confEl = document.getElementById('confirmAdminPass');
    if (loginEl) loginEl.value = auth.u || '';
    if (passEl) passEl.value = '';
    if (confEl) confEl.value = '';
    var formTitle = (allForms[currentFormIndex] && allForms[currentFormIndex].title) || 'текущей формы';
    var hint = document.getElementById('auth-form-hint');
    if (hint) hint.textContent = 'Доступ к админке формы: «' + formTitle + '»';
    modal.classList.add('active');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
}

function saveAuthChange(e) {
    e.preventDefault();
    const login = document.getElementById('newAdminLogin').value.trim();
    const pass = document.getElementById('newAdminPass').value;
    const confirmPass = document.getElementById('confirmAdminPass').value;

    if (!login) {
        showAlert('Введите логин!', 'warning');
        return;
    }
    if (pass !== confirmPass) {
        showAlert('Пароли не совпадают!', 'warning');
        return;
    }

    const form = allForms[currentFormIndex];
    if (!form) {
        showAlert('Форма не найдена', 'error');
        return;
    }
    // Логин/пароль только для ТЕКУЩЕЙ формы (не глобально)
    form.adminAuth = { u: login, p: pass };
    if (!form.settings) form.settings = {};
    form.settings.adminAuth = { u: login, p: pass };
    saveFormsToStorage();
    closeAuthModal();
    showAlert('Логин и пароль сохранены только для формы «' + (form.title || 'Без названия') + '»', 'check_circle');
}

function formatText(command) {
    document.execCommand(command, false, null);
    updateTextAnswerFromEditor();
}

function updateTextAnswerFromEditor() {
    const editor = document.getElementById('text-answer-editor');
    if (editor) {
        saveAnswer(editor.innerHTML);
        updateTextCounters(editor);
    }
}

function updateTextCounters(el) {
    if (!el) return;
    let text = el.value !== undefined ? el.value : (el.innerText || el.textContent || '');
    const chars = text.length;
    const lines = text ? text.split(/\r\n|\r|\n/).length : 0;
    const charEl = document.getElementById('char-count');
    const lineEl = document.getElementById('line-count');
    if (charEl) charEl.textContent = chars;
    if (lineEl) lineEl.textContent = lines;
}

/* ==========================================
   SHARE MODAL
   ========================================== */
let shareState = { mode: 'test', access: 'link', expiryDays: 7 };

function generateShareLink() {
    openShareModal();
}

function openShareModal() {
    const form = allForms[currentFormIndex];
    if (!form) return showAlert('Нет формы', 'error');

    shareState.mode = getFormMode(form) || 'test';
    shareState.access = (form.settings && form.settings.shareAccess) || 'link';
    shareState.expiryDays = 7;

    document.querySelectorAll('.share-mode-btn').forEach(function(btn) {
        if (btn.classList.contains('disabled')) return;
        btn.classList.toggle('active', btn.dataset.mode === shareState.mode);
    });

    document.querySelectorAll('input[name="share-access"]').forEach(function(r) {
        r.checked = (r.value === shareState.access);
    });

    var expSel = document.getElementById('share-expiry-select');
    if (expSel) {
        expSel.value = String(shareState.expiryDays);
        try { syncEnhancedSelect(expSel); } catch (e) {}
    }

    updateShareLinkPreview();
    var modal = document.getElementById('share-modal');
    if (modal) {
        try { enhanceAllSelects(modal); } catch (e) {}
        if (expSel) try { syncEnhancedSelect(expSel); } catch (e) {}
        modal.classList.add('active');
    }
}

function closeShareModal() {
    var modal = document.getElementById('share-modal');
    if (modal) modal.classList.remove('active');
}

function setShareMode(mode) {
    if (mode === 'live') return;
    shareState.mode = mode;
    document.querySelectorAll('.share-mode-btn').forEach(function(btn) {
        if (btn.classList.contains('disabled')) return;
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    updateShareLinkPreview();
}

function setShareAccess(access) {
    shareState.access = access;
    var form = allForms[currentFormIndex];
    if (form) {
        if (!form.settings) form.settings = {};
        form.settings.shareAccess = access;
        form.settings.shareRestricted = (access === 'restrict');
        saveFormsToStorage();
    }
    updateShareLinkPreview();
}

function buildShareUrl() {
    var base = window.location.href.split('?')[0].split('#')[0];
    var params = new URLSearchParams();
    params.set('f', String(currentFormIndex));
    params.set('mode', shareState.mode || 'test');

    var days = parseInt(shareState.expiryDays, 10);
    var expSel = document.getElementById('share-expiry-select');
    if (expSel) days = parseInt(expSel.value, 10);
    shareState.expiryDays = days;

    if (days > 0) {
        var exp = Date.now() + days * 24 * 60 * 60 * 1000;
        params.set('exp', String(exp));
    }

    if (shareState.access === 'restrict') {
        params.set('access', 'restricted');
    } else if (shareState.access === 'open') {
        params.set('access', 'open');
    }

    return base + '?' + params.toString();
}

function updateShareLinkPreview() {
    var expSel = document.getElementById('share-expiry-select');
    if (expSel) shareState.expiryDays = parseInt(expSel.value, 10);

    var input = document.getElementById('share-link-input');
    if (input) input.value = buildShareUrl();
}

function copyShareLink() {
    updateShareLinkPreview();
    var url = buildShareUrl();
    var input = document.getElementById('share-link-input');
    if (input) input.value = url;

    var form = allForms[currentFormIndex];
    if (form) {
        if (!form.settings) form.settings = {};
        form.settings.shareAccess = shareState.access;
        form.settings.shareRestricted = (shareState.access === 'restrict');
        form.settings.lastShareMode = shareState.mode;
        saveFormsToStorage();
    }

    if (shareState.access === 'restrict') {
        showAlert('Доступ ограничен: ссылка помечена как недоступная', 'lock');
        return;
    }

    navigator.clipboard.writeText(url).then(function() {
        showAlert('Ссылка скопирована!', 'check_circle');
    }).catch(function() {
        if (input) {
            input.select();
            try {
                document.execCommand('copy');
                showAlert('Ссылка скопирована!', 'check_circle');
            } catch (e) {
                showAlert('Скопируйте ссылку вручную', 'info');
            }
        }
    });
}

/** При загрузке: применить mode / exp / access из URL */
function applyShareParamsFromUrl() {
    try {
        var params = new URLSearchParams(window.location.search);
        if (!params.has('f') && !params.has('mode') && !params.has('exp')) return;

        var f = params.get('f');
        if (f !== null && f !== '' && !isNaN(parseInt(f, 10))) {
            var idx = parseInt(f, 10);
            if (idx >= 0 && idx < allForms.length) {
                currentFormIndex = idx;
            }
        }

        var exp = params.get('exp');
        if (exp) {
            var expTs = parseInt(exp, 10);
            if (expTs && Date.now() > expTs) {
                showAlert('Срок действия ссылки истёк', 'schedule');
                return;
            }
        }

        var access = params.get('access');
        var form = allForms[currentFormIndex];
        if (form && form.settings && form.settings.shareRestricted) {
            showAlert('Доступ к этой форме ограничен автором', 'lock');
            return;
        }
        if (access === 'restricted') {
            showAlert('Доступ по этой ссылке ограничен', 'lock');
            return;
        }

        var mode = params.get('mode');
        if (mode && ['test', 'learn', 'flashcards'].indexOf(mode) >= 0 && form) {
            form.mode = mode;
            // session only — не обязательно save
        }
    } catch (e) {
        console.warn('share params', e);
    }
}


function printCurrentForm() {
    openPrintPreview();
}

/* ==========================================
   9. ОЗВУЧКА (TTS) И УЛУЧШЕННАЯ ПЕЧАТЬ
   ========================================== */
function speakQuestion(q) {
    if (!window.speechSynthesis) {
        showAlert('Озвучка не поддерживается в этом браузере', 'error');
        return;
    }
    window.speechSynthesis.cancel();

    let text = (q.title || '').replace(/\[input\]/gi, '...');
    if (q.description) text += '. ' + q.description;

    const hasCyrillic = /[а-яёА-ЯЁ]/.test(text);
    const lang = hasCyrillic ? 'ru-RU' : 'en-US';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith(lang.slice(0, 2)) && (v.name.includes('Google') || v.name.includes('Microsoft') || v.default));
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function showAnswerExplanation(selectedIdx) {
    const form = allForms[currentFormIndex];
    if (!form) return;
    var q = null;
    try {
        var act = resolveActiveQuestion();
        q = act && act.q ? act.q : null;
        if (act && typeof act.realIdx === 'number') currentRealQuestionIndex = act.realIdx;
    } catch (e) {}
    if (!q) q = form.questions[currentRealQuestionIndex] || form.questions[currentQuestionIndex];
    const area = document.getElementById('answer-explanation-area');
    if (!area || !q) {
        if (area) area.innerHTML = '';
        return;
    }

    var mode = getFormMode(form);
    // Test / FlashCards: не палим верно/неверно во время прохождения
    if (mode !== 'learn') {
        area.innerHTML = '';
        document.querySelectorAll('#question-body .option').forEach(function(lab) {
            lab.classList.remove('correct-highlight', 'incorrect-highlight');
        });
        return;
    }

    selectedIdx = parseInt(selectedIdx, 10);
    var correctSet = (q.correctChoices || []).map(Number);
    var isCorrect = !isNaN(selectedIdx) && correctSet.indexOf(selectedIdx) >= 0;
    var hlAlways = !!(previewMode && previewMode.highlightAlways);

    // Learn: подсветка. Если preview highlightAlways — верные зелёные даже без выбора.
    if (q.type === 'radio' || q.type === 'select') {
        document.querySelectorAll('#question-body .option').forEach(function(lab) {
            lab.classList.remove('correct-highlight', 'incorrect-highlight');
            var inp = lab.querySelector('input');
            if (!inp) return;
            var v = parseInt(inp.value, 10);
            if (correctSet.indexOf(v) >= 0 && (hlAlways || !isNaN(selectedIdx))) lab.classList.add('correct-highlight');
            else if (!isNaN(selectedIdx) && v === selectedIdx && correctSet.indexOf(v) < 0) lab.classList.add('incorrect-highlight');
        });
    } else if (q.type === 'true-false') {
        document.querySelectorAll('#question-body .tf-choice').forEach(function(lab) {
            lab.classList.remove('correct-highlight', 'incorrect-highlight', 'selected');
            var inp = lab.querySelector('input');
            if (!inp) return;
            var v = parseInt(inp.value, 10);
            if (!isNaN(selectedIdx) && v === selectedIdx) lab.classList.add('selected');
            if (correctSet.indexOf(v) >= 0 && ((typeof hlAlways !== 'undefined' && hlAlways) || !isNaN(selectedIdx))) lab.classList.add('correct-highlight');
            else if (!isNaN(selectedIdx) && v === selectedIdx) lab.classList.add('incorrect-highlight');
        });
    } else if (q.type === 'checkbox') {
        document.querySelectorAll('#question-body .option').forEach(function(lab) {
            lab.classList.remove('correct-highlight', 'incorrect-highlight');
            var inp = lab.querySelector('input');
            if (!inp) return;
            var v = parseInt(inp.value, 10);
            if (correctSet.indexOf(v) >= 0) lab.classList.add('correct-highlight');
            else if (inp.checked) lab.classList.add('incorrect-highlight');
        });
    }

    // Пояснение под ответом (тумблер «Объяснение под верным и неверным») — только Learn
    if (!q.hasAnswerExplanations) {
        area.innerHTML = '';
        return;
    }

    var text = '';
    var isOk = !!isCorrect;
    if (q.type === 'checkbox') {
        var ua = Array.isArray(userAnswers[currentRealQuestionIndex])
            ? userAnswers[currentRealQuestionIndex].map(Number).slice().sort()
            : [];
        var cc = correctSet.slice().sort();
        isOk = cc.length === ua.length && cc.every(function(v, i) { return v === ua[i]; });
    }
    if (isOk) {
        text = q.answerExpCorrect || 'Верно!';
    } else {
        var map = q.answerExpIncorrect || q.answerExplanations || {};
        text = map[selectedIdx] || map[String(selectedIdx)] || 'Неверно.';
    }

    area.innerHTML =
        '<div class="explanation-card" style="border-color:' + (isOk ? '#2e7d32' : '#d32f2f') +
        ';background:' + (isOk ? 'rgba(46,125,50,0.08)' : 'rgba(211,47,47,0.08)') + ';">' +
        '<div class="explanation-title" style="color:' + (isOk ? '#2e7d32' : '#d32f2f') + ';">' +
        '<span class="material-symbols-rounded">' + (isOk ? 'check_circle' : 'cancel') + '</span> ' +
        (isOk ? 'Верно' : 'Неверно') +
        '</div><div class="explanation-body">' + escapeHtml(text) + '</div></div>';
}

function openPrintPreview() {
    const form = allForms[currentFormIndex];
    if (!form) return showAlert('Нет формы для печати', 'error');

    const win = window.open('about:blank', '_blank');
    if (!win) {
        showAlert('Разрешите всплывающие окна для печати', 'warning');
        return;
    }

    const questionsHTML = (form.questions || []).map((q, i) => {
        let opts = '';
        if (q.options && q.options.length) {
            opts = '<ul style="margin:8px 0 0 20px;">' + q.options.map((o, oi) => {
                const isCorrect = (q.correctChoices || []).includes(oi);
                return `<li>${o}${isCorrect ? ' ✓' : ''}</li>`;
            }).join('') + '</ul>';
        }
        return `
            <div class="print-q" style="margin-bottom:24px; page-break-inside:avoid;">
                <div style="font-weight:600; font-size:16px; margin-bottom:6px;">${i + 1}. ${q.title}</div>
                ${q.description ? `<div style="color:#666; font-size:13px; margin-bottom:8px;">${q.description}</div>` : ''}
                ${opts}
                ${q.type === 'text' ? '<div style="border-bottom:1px solid #ccc; height:28px; margin-top:8px;"></div>'.repeat(2) : ''}
                ${q.type === 'flashcard' && q.flashcardAnswer ? `<div style="margin-top:6px; font-size:13px; color:#555;">Ответ: ${q.flashcardAnswer}</div>` : ''}
            </div>
        `;
    }).join('');

    win.document.write(`
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Печать: ${form.title || 'Форма'}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #222; }
  .toolbar {
    position: sticky; top: 0; z-index: 100;
    background: #1a73e8; color: #fff;
    padding: 12px 20px;
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .toolbar button, .toolbar select {
    background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4);
    color: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 14px;
  }
  .toolbar button:hover { background: rgba(255,255,255,0.35); }
  .toolbar select { background: #fff; color: #222; }
  .content {
    max-width: 800px; margin: 20px auto; padding: 32px;
    background: #fff; border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    min-height: 70vh;
  }
  body.plain .content { font-family: monospace; }
  body.plain .print-q { border-bottom: 1px dashed #ccc; padding-bottom: 12px; }
  body.styled .print-q { border-left: 4px solid #1a73e8; padding-left: 16px; background: #f8faff; border-radius: 0 8px 8px 0; }
  h1 { margin: 0 0 24px; font-size: 24px; }
  @media print {
    .toolbar { display: none !important; }
    body { background: #fff; }
    .content { box-shadow: none; margin: 0; padding: 0; max-width: none; }
  }
</style>
</head>
<body class="styled">
  <div class="toolbar">
    <strong style="flex:1;">${form.title || 'Форма'}</strong>
    <select id="styleSelect" onchange="document.body.className = this.value">
      <option value="styled">Текстовый с стилями</option>
      <option value="plain">Текстовый</option>
    </select>
    <button onclick="window.print()">🖨️ Печать</button>
    <button onclick="window.close()">Закрыть</button>
  </div>
  <div class="content" contenteditable="true">
    <h1>${form.title || 'Форма'}</h1>
    ${questionsHTML}
  </div>
</body>
</html>
    `);
    win.document.close();
}

/* ==========================================
   10. ТЕМЫ (КУСКИ ФОРМЫ)
   ========================================== */
function ensureFormThemes(form) {
    if (!form) return;
    if (!Array.isArray(form.themes) || form.themes.length === 0) {
        var id = 'theme-default';
        form.themes = [{ id: id, title: 'Тема 1', icon: 'school', description: '' }];
        (form.questions || []).forEach(function(q) { if (!q.themeId) q.themeId = id; });
    } else {
        var ids = {};
        form.themes.forEach(function(t) { ids[t.id] = true; });
        var fallback = form.themes[0].id;
        (form.questions || []).forEach(function(q) {
            if (!q.themeId || !ids[q.themeId]) q.themeId = fallback;
        });
    }
    if (!form.settings) form.settings = {};
}
function getFormThemes(form) { ensureFormThemes(form); return form.themes; }
function themesEnabled(form) { return getFormThemes(form).length >= 2; }
function getThemeById(form, themeId) {
    return getFormThemes(form).find(function(t) { return t.id === themeId; }) || getFormThemes(form)[0];
}
function getQuestionsForTheme(form, themeId) {
    ensureFormThemes(form);
    return (form.questions || []).map(function(q, idx) { return { q: q, idx: idx }; })
        .filter(function(item) { return item.q.themeId === themeId; });
}
function getActiveQuestionList() {
    var form = allForms[currentFormIndex];
    if (!form) return [];
    ensureFormThemes(form);
    // FlashCards: все темы = одна колода
    if (getFormMode(form) === 'flashcards') {
        return (form.questions || []).map(function(q, idx) { return { q: q, idx: idx }; });
    }
    if (!themesEnabled(form) || !currentThemeId) {
        return (form.questions || []).map(function(q, idx) { return { q: q, idx: idx }; });
    }
    return getQuestionsForTheme(form, currentThemeId);
}

/* ===== Сохранение прогресса прохождения (ответы + тема) ===== */
function isSaveProgressEnabled(form) {
    if (!form) form = allForms[currentFormIndex];
    if (!form) return true;
    if (!form.settings) return true;
    // по умолчанию ВКЛ; только явное false отключает
    return form.settings.saveProgress !== false;
}

function sessionProgressKey(formIndex) {
    var form = allForms[formIndex];
    var id = (form && (form.id || form.title)) ? String(form.id || form.title) : String(formIndex);
    return formIndex + '::' + id;
}

function loadSessionProgressMap() {
    try {
        var raw = localStorage.getItem(SESSION_PROGRESS_KEY);
        if (!raw) return {};
        var data = JSON.parse(raw);
        var now = Date.now();
        var maxAge = SESSION_PROGRESS_DAYS * 24 * 60 * 60 * 1000;
        var cleaned = {};
        Object.keys(data).forEach(function(k) {
            if (data[k] && (now - (data[k].ts || 0)) < maxAge) cleaned[k] = data[k];
        });
        localStorage.setItem(SESSION_PROGRESS_KEY, JSON.stringify(cleaned));
        return cleaned;
    } catch (e) { return {}; }
}

function saveSessionProgressMap(map) {
    localStorage.setItem(SESSION_PROGRESS_KEY, JSON.stringify(map));
}

function persistSessionProgress() {
    var form = allForms[currentFormIndex];
    if (!form || !isSaveProgressEnabled(form)) return;
    if (previewMode) return;
    var map = loadSessionProgressMap();
    var key = sessionProgressKey(currentFormIndex);
    map[key] = {
        answers: userAnswers || {},
        themeId: currentThemeId || null,
        questionIndex: currentQuestionIndex || 0,
        realIndex: currentRealQuestionIndex || 0,
        flashcardStats: flashcardStats || { know: 0, dontKnow: 0 },
        ts: Date.now()
    };
    saveSessionProgressMap(map);
}

function restoreSessionProgress() {
    var form = allForms[currentFormIndex];
    if (!form || !isSaveProgressEnabled(form)) return null;
    if (previewMode) return null;
    var map = loadSessionProgressMap();
    var key = sessionProgressKey(currentFormIndex);
    return map[key] || null;
}

function clearSessionProgress(formIndex) {
    if (formIndex == null) formIndex = currentFormIndex;
    var map = loadSessionProgressMap();
    var key = sessionProgressKey(formIndex);
    delete map[key];
    saveSessionProgressMap(map);
}


function loadThemeProgress() {
    try {
        var raw = localStorage.getItem(THEME_PROGRESS_KEY);
        if (!raw) return {};
        var data = JSON.parse(raw);
        var now = Date.now();
        var maxAge = THEME_PROGRESS_DAYS * 24 * 60 * 60 * 1000;
        var cleaned = {};
        Object.keys(data).forEach(function(k) {
            if (data[k] && (now - (data[k].ts || 0)) < maxAge) cleaned[k] = data[k];
        });
        localStorage.setItem(THEME_PROGRESS_KEY, JSON.stringify(cleaned));
        return cleaned;
    } catch (e) { return {}; }
}
function saveThemeProgress(map) { localStorage.setItem(THEME_PROGRESS_KEY, JSON.stringify(map)); }
function themeProgressKey(formIndex, themeId) { return formIndex + '::' + themeId; }
function isThemeCompleted(formIndex, themeId) {
    var map = loadThemeProgress();
    var k = themeProgressKey(formIndex, themeId);
    return !!(map[k] && map[k].done);
}
function markThemeCompleted(formIndex, themeId) {
    var form = allForms[formIndex];
    if (!isSaveProgressEnabled(form)) {
        // без сохранения прогресса — галочки тем не пишем в localStorage
        return;
    }
    var map = loadThemeProgress();
    map[themeProgressKey(formIndex, themeId)] = { done: true, ts: Date.now() };
    saveThemeProgress(map);
    persistSessionProgress();
}
function isThemeLocked(form, themeIndex) {
    if (!form.settings || !form.settings.lockNextThemes) return false;
    if (themeIndex <= 0) return false;
    var themes = getFormThemes(form);
    for (var i = 0; i < themeIndex; i++) {
        if (!isThemeCompleted(currentFormIndex, themes[i].id)) return true;
    }
    return false;
}
function initCurrentTheme() {
    var form = allForms[currentFormIndex];
    if (!form) return;
    ensureFormThemes(form);
    if (!currentThemeId || !form.themes.find(function(t) { return t.id === currentThemeId; })) {
        currentThemeId = form.themes[0].id;
    }
}
function renderThemeUI() {
    var form = allForms[currentFormIndex];
    if (!form) return;
    ensureFormThemes(form);
    var enabled = themesEnabled(form) && getFormMode(form) !== 'flashcards';
    var burger = document.getElementById('theme-burger-btn');
    var sidebar = document.getElementById('theme-sidebar');
    if (enabled) {
        document.body.classList.add('has-themes');
        if (burger) burger.classList.remove('hidden');
        renderThemeSidebar();
    } else {
        document.body.classList.remove('has-themes');
        if (burger) burger.classList.add('hidden');
        if (sidebar) { sidebar.classList.add('hidden'); sidebar.classList.remove('open'); }
        var ov = document.getElementById('theme-sidebar-overlay');
        if (ov) ov.classList.add('hidden');
    }
    var adminBar = document.getElementById('admin-themes-bar');
    if (adminBar) {
        var adm = document.getElementById('admin-screen');
        var inAdmin = adm && !adm.classList.contains('hidden');
        if (inAdmin) { adminBar.classList.remove('hidden'); renderAdminThemeTabs(); }
        else adminBar.classList.add('hidden');
    }
}
function renderThemeSidebar() {
    var form = allForms[currentFormIndex];
    var list = document.getElementById('theme-sidebar-list');
    var sidebar = document.getElementById('theme-sidebar');
    if (!list || !form) return;
    ensureFormThemes(form);
    if (!themesEnabled(form)) { if (sidebar) sidebar.classList.add('hidden'); return; }
    if (sidebar) sidebar.classList.remove('hidden');
    list.innerHTML = form.themes.map(function(t, i) {
        var count = getQuestionsForTheme(form, t.id).length;
        var locked = isThemeLocked(form, i);
        var done = isThemeCompleted(currentFormIndex, t.id);
        var active = t.id === currentThemeId;
        return '<div class="theme-card ' + (active ? 'active ' : '') + (locked ? 'locked ' : '') + (done ? 'done' : '') +
            '" onclick="selectTheme(\'' + t.id + '\', ' + i + ')">' +
            (locked ? '<span class="material-symbols-rounded theme-lock">lock</span>' : '') +
            '<div class="theme-card-top"><div class="theme-card-icon"><span class="material-symbols-rounded">' +
            (t.icon || 'school') + '</span></div><div class="theme-card-title">' + escapeHtml(t.title || 'Тема') +
            '</div></div><div class="theme-card-meta">' + count + ' вопр.</div>' +
            (t.description ? '<div class="theme-card-desc">' + escapeHtml(t.description) + '</div>' : '') + '</div>';
    }).join('');
}
function toggleThemeSidebar(force) {
    var sidebar = document.getElementById('theme-sidebar');
    var overlay = document.getElementById('theme-sidebar-overlay');
    if (!sidebar) return;
    var open = force === false ? false : force === true ? true : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    sidebar.classList.remove('hidden');
    if (overlay) overlay.classList.toggle('hidden', !open);
}
function selectTheme(themeId, themeIndex) {
    var form = allForms[currentFormIndex];
    if (!form) return;
    if (typeof themeIndex === 'number' && isThemeLocked(form, themeIndex)) {
        showAlert('Сначала пройдите предыдущие темы', 'lock');
        return;
    }
    currentThemeId = themeId;
    currentQuestionIndex = 0;
    // НЕ обнуляем userAnswers: ключи — глобальные индексы вопросов формы
    isExplanationShowing = false;
    persistSessionProgress();
    toggleThemeSidebar(false);
    renderThemeUI();
    document.getElementById('quiz-box').classList.remove('hidden');
    document.getElementById('result-box').classList.add('hidden');
    var tc = document.getElementById('theme-complete-box');
    if (tc) tc.classList.add('hidden');
    renderQuestion();
}
function renderAdminThemeTabs() {
    var form = allForms[currentFormIndex];
    var list = document.getElementById('admin-themes-list');
    if (!list || !form) return;
    ensureFormThemes(form);
    list.innerHTML = form.themes.map(function(t) {
        var count = getQuestionsForTheme(form, t.id).length;
        var active = t.id === currentThemeId;
        return '<div class="admin-theme-tab ' + (active ? 'active' : '') + '" onclick="selectAdminTheme(\'' + t.id + '\')">' +
            '<span class="material-symbols-rounded" style="font-size:16px;">' + (t.icon || 'school') + '</span>' +
            '<span>' + escapeHtml(t.title || 'Тема') + '</span>' +
            '<span style="opacity:0.7;font-size:11px;">(' + count + ')</span>' +
            '<span class="theme-tab-actions" onclick="event.stopPropagation()">' +
            '<button title="Изменить" onclick="openEditThemeModal(\'' + t.id + '\')"><span class="material-symbols-rounded" style="font-size:14px;">edit</span></button>' +
            '<button title="Копия" onclick="copyTheme(\'' + t.id + '\')"><span class="material-symbols-rounded" style="font-size:14px;">content_copy</span></button>' +
            '<button title="Удалить" onclick="deleteTheme(\'' + t.id + '\')"><span class="material-symbols-rounded" style="font-size:14px;">delete</span></button>' +
            '</span></div>';
    }).join('');
}
function selectAdminTheme(themeId) {
    currentThemeId = themeId;
    console.log('[themes] selected', themeId);
    renderAdminThemeTabs();
    renderAdminQuestionsList();
}
function openCreateThemeModal() {
    editingThemeId = null;
    selectedThemeIcon = 'school';
    document.getElementById('theme-modal-title').textContent = 'Новая тема';
    document.getElementById('theme-title-input').value = '';
    document.getElementById('theme-desc-input').value = '';
    document.getElementById('theme-icon-preview').textContent = 'school';
    document.getElementById('theme-icon-name').textContent = 'school';
    document.getElementById('theme-modal').classList.add('active');
}
function openEditThemeModal(themeId) {
    var form = allForms[currentFormIndex];
    var t = getThemeById(form, themeId);
    if (!t) return;
    editingThemeId = themeId;
    selectedThemeIcon = t.icon || 'school';
    document.getElementById('theme-modal-title').textContent = 'Редактировать тему';
    document.getElementById('theme-title-input').value = t.title || '';
    document.getElementById('theme-desc-input').value = t.description || '';
    document.getElementById('theme-icon-preview').textContent = selectedThemeIcon;
    document.getElementById('theme-icon-name').textContent = selectedThemeIcon;
    document.getElementById('theme-modal').classList.add('active');
}
function closeThemeModal() {
    document.getElementById('theme-modal').classList.remove('active');
    editingThemeId = null;
}
function saveThemeModal() {
    var form = allForms[currentFormIndex];
    ensureFormThemes(form);
    var title = document.getElementById('theme-title-input').value.trim();
    var desc = document.getElementById('theme-desc-input').value.trim();
    if (editingThemeId) {
        var t = form.themes.find(function(x) { return x.id === editingThemeId; });
        if (t) {
            t.title = title || t.title || 'Тема';
            t.description = desc;
            t.icon = selectedThemeIcon || 'school';
        }
    } else {
        if (!title) title = 'Тема ' + (form.themes.length + 1);
        var id = 'theme-' + Date.now();
        form.themes.push({ id: id, title: title, icon: selectedThemeIcon || 'school', description: desc });
        currentThemeId = id;
    }
    saveFormsToStorage();
    closeThemeModal();
    renderThemeUI();
    renderAdminQuestionsList();
    showAlert('Тема сохранена', 'check_circle');
}
function copyTheme(themeId) {
    var form = allForms[currentFormIndex];
    ensureFormThemes(form);
    var src = form.themes.find(function(t) { return t.id === themeId; });
    if (!src) return;
    var newId = 'theme-' + Date.now();
    form.themes.push({ id: newId, title: (src.title || 'Тема') + ' - копия', icon: src.icon || 'school', description: src.description || '' });
    var qs = form.questions.filter(function(q) { return q.themeId === themeId; }).map(function(q) {
        var c = JSON.parse(JSON.stringify(q));
        c.themeId = newId;
        return c;
    });
    form.questions = form.questions.concat(qs);
    saveFormsToStorage();
    currentThemeId = newId;
    renderThemeUI();
    renderAdminQuestionsList();
    showAlert('Тема скопирована', 'content_copy');
}
function deleteTheme(themeId) {
    var form = allForms[currentFormIndex];
    ensureFormThemes(form);
    if (form.themes.length <= 1) {
        showAlert('Нельзя удалить единственную тему', 'warning');
        return;
    }
    var t = form.themes.find(function(x) { return x.id === themeId; });
    showConfirm('Удалить тему?', 'Тема «' + (t ? t.title : '') + '» и все её вопросы будут удалены.', function() {
        form.questions = form.questions.filter(function(q) { return q.themeId !== themeId; });
        form.themes = form.themes.filter(function(x) { return x.id !== themeId; });
        if (currentThemeId === themeId) currentThemeId = form.themes[0].id;
        saveFormsToStorage();
        renderThemeUI();
        renderAdminQuestionsList();
        showAlert('Тема удалена', 'delete');
    });
}
function openIconPicker() {
    var grid = document.getElementById('icon-picker-grid');
    if (!grid) return;
    grid.innerHTML = THEME_ICONS.map(function(name) {
        return '<div class="icon-picker-item ' + (name === selectedThemeIcon ? 'selected' : '') +
            '" onclick="pickThemeIcon(\'' + name + '\')"><span class="material-symbols-rounded">' + name + '</span></div>';
    }).join('');
    document.getElementById('icon-picker-modal').classList.add('active');
}
function closeIconPicker() { document.getElementById('icon-picker-modal').classList.remove('active'); }
function pickThemeIcon(name) {
    selectedThemeIcon = name;
    document.getElementById('theme-icon-preview').textContent = name;
    document.getElementById('theme-icon-name').textContent = name;
    closeIconPicker();
}
function showThemeCompleteScreen() {
    var form = allForms[currentFormIndex];
    var theme = getThemeById(form, currentThemeId);
    markThemeCompleted(currentFormIndex, currentThemeId);
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.add('hidden');
    var box = document.getElementById('theme-complete-box');
    if (box) {
        box.classList.remove('hidden');
        document.getElementById('theme-complete-title').textContent = theme ? theme.title : 'Тема';
        document.getElementById('theme-complete-desc').textContent = (theme && theme.description) ? theme.description : 'Отличная работа!';
        var themes = getFormThemes(form);
        var idx = themes.findIndex(function(t) { return t.id === currentThemeId; });
        var nextBtn = document.getElementById('theme-next-btn');
        if (nextBtn) {
            if (idx >= 0 && idx < themes.length - 1) { nextBtn.classList.remove('hidden'); nextBtn.textContent = 'Следующая тема'; }
            else nextBtn.classList.add('hidden');
        }
    }
    renderThemeUI();
}
function goToNextTheme() {
    var form = allForms[currentFormIndex];
    var themes = getFormThemes(form);
    var idx = themes.findIndex(function(t) { return t.id === currentThemeId; });
    if (idx < 0 || idx >= themes.length - 1) { showThemeResults(); return; }
    if (isThemeLocked(form, idx + 1)) { showAlert('Следующая тема пока недоступна', 'lock'); return; }
    selectTheme(themes[idx + 1].id, idx + 1);
}
function showThemeResults() {
    var box = document.getElementById('theme-complete-box');
    if (box) box.classList.add('hidden');
    calculateResults();
}

/* ==========================================
   CUSTOM SELECT (без нативного <select> UI)
   ========================================== */
function buildCustomSelect(options, selectedValue, onChange, placeholder) {
    var opts = (options || []).map(function(o, i) {
        if (o && typeof o === 'object') return { value: String(o.value), label: o.label };
        return { value: String(i), label: String(o) };
    });
    var sel = (selectedValue === undefined || selectedValue === null || selectedValue === '') ? '' : String(selectedValue);
    var selectedLabel = placeholder || '-- Выберите --';
    opts.forEach(function(o) { if (o.value === sel) selectedLabel = o.label; });
    var uid = 'cs-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    var html = '<div class="cselect" id="' + uid + '" data-value="' + escapeHtml(sel) + '">' +
        '<button type="button" class="cselect-trigger" onclick="toggleCSelect(\'' + uid + '\')">' +
        '<span class="cselect-label">' + escapeHtml(selectedLabel) + '</span>' +
        '<span class="material-symbols-rounded cselect-arrow">expand_more</span></button>' +
        '<div class="cselect-dropdown hidden">' +
        (placeholder ? '<div class="cselect-option cselect-placeholder" data-value="" onclick="pickCSelect(\'' + uid + '\',\'\',\'' + escapeHtml(placeholder).replace(/'/g, "\\'") + '\')">' + escapeHtml(placeholder) + '</div>' : '') +
        opts.map(function(o) {
            var act = o.value === sel ? ' active' : '';
            return '<div class="cselect-option' + act + '" data-value="' + escapeHtml(o.value) + '" onclick="pickCSelect(\'' + uid + '\',\'' + escapeHtml(o.value).replace(/'/g, "\\'") + '\',\'' + escapeHtml(o.label).replace(/'/g, "\\'") + '\')">' + escapeHtml(o.label) + '</div>';
        }).join('') +
        '</div></div>';
    setTimeout(function() {
        var el = document.getElementById(uid);
        if (el) el._onChange = onChange;
    }, 0);
    return html;
}

function positionCSelectDropdown(el, dd) {
    if (!el || !dd) return;
    dd.classList.remove('drop-up');
    dd.style.maxHeight = '';
    var rect = el.getBoundingClientRect();
    var spaceBelow = window.innerHeight - rect.bottom - 12;
    var spaceAbove = rect.top - 12;
    var desired = Math.min(280, Math.max(Math.max(spaceBelow, spaceAbove), 120));
    dd.style.maxHeight = desired + 'px';
    if (spaceBelow < 140 && spaceAbove > spaceBelow) {
        dd.classList.add('drop-up');
    }
}

function toggleCSelect(uid) {
    var el = document.getElementById(uid);
    if (!el) return;
    var dd = el.querySelector('.cselect-dropdown');
    var open = dd && !dd.classList.contains('hidden');
    document.querySelectorAll('.cselect-dropdown').forEach(function(d) {
        d.classList.add('hidden');
        d.classList.remove('drop-up');
    });
    document.querySelectorAll('.cselect').forEach(function(c) { c.classList.remove('open'); });
    if (!open && dd) {
        dd.classList.remove('hidden');
        el.classList.add('open');
        positionCSelectDropdown(el, dd);
    }
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
    if (dd) {
        dd.classList.add('hidden');
        dd.classList.remove('drop-up');
    }
    el.classList.remove('open');

    var native = el._nativeSelect;
    if (native) {
        native.value = value;
        try {
            native.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            var ev = document.createEvent('HTMLEvents');
            ev.initEvent('change', true, false);
            native.dispatchEvent(ev);
        }
    }
    if (typeof el._onChange === 'function') el._onChange(value);
}

function syncEnhancedSelect(nativeSelect) {
    if (!nativeSelect || !nativeSelect._cselectId) return;
    var el = document.getElementById(nativeSelect._cselectId);
    if (!el) return;
    var value = String(nativeSelect.value);
    el.dataset.value = value;
    var label = '--';
    var opts = nativeSelect.options;
    for (var i = 0; i < opts.length; i++) {
        if (String(opts[i].value) === value) {
            label = opts[i].textContent;
            break;
        }
    }
    var lab = el.querySelector('.cselect-label');
    if (lab) lab.textContent = label;
    el.querySelectorAll('.cselect-option').forEach(function(o) {
        o.classList.toggle('active', o.getAttribute('data-value') === value);
    });
}

function enhanceNativeSelect(nativeSelect) {
    if (!nativeSelect || nativeSelect.tagName !== 'SELECT') return;
    if (nativeSelect.dataset.cselectDone === '1') {
        syncEnhancedSelect(nativeSelect);
        return;
    }
    if (nativeSelect.nextElementSibling && nativeSelect.nextElementSibling.classList.contains('cselect')) {
        nativeSelect.dataset.cselectDone = '1';
        nativeSelect._cselectId = nativeSelect.nextElementSibling.id;
        nativeSelect.nextElementSibling._nativeSelect = nativeSelect;
        syncEnhancedSelect(nativeSelect);
        return;
    }

    var opts = [];
    for (var i = 0; i < nativeSelect.options.length; i++) {
        var o = nativeSelect.options[i];
        opts.push({ value: o.value, label: o.textContent });
    }
    var selected = nativeSelect.value;
    var placeholder = null;
    if (opts.length && (opts[0].value === '' || (opts[0].label || '').indexOf('--') === 0)) {
        placeholder = opts[0].label;
    }

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildCustomSelect(opts, selected, null, placeholder);
    var csel = wrapper.firstElementChild;
    if (!csel) return;

    nativeSelect.classList.add('cselect-native-hidden');
    nativeSelect.setAttribute('aria-hidden', 'true');
    nativeSelect.tabIndex = -1;
    nativeSelect.dataset.cselectDone = '1';
    nativeSelect._cselectId = csel.id;
    csel._nativeSelect = nativeSelect;

    if (nativeSelect.parentNode) {
        nativeSelect.parentNode.insertBefore(csel, nativeSelect.nextSibling);
    }
}

function enhanceAllSelects(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var list = scope.querySelectorAll('select');
    for (var i = 0; i < list.length; i++) {
        try { enhanceNativeSelect(list[i]); } catch (e) { console.warn(e); }
    }
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.cselect')) {
        document.querySelectorAll('.cselect-dropdown').forEach(function(d) {
            d.classList.add('hidden');
            d.classList.remove('drop-up');
        });
        document.querySelectorAll('.cselect').forEach(function(c) { c.classList.remove('open'); });
    }
});

window.addEventListener('resize', function() {
    document.querySelectorAll('.cselect.open').forEach(function(el) {
        var dd = el.querySelector('.cselect-dropdown');
        if (dd && !dd.classList.contains('hidden')) positionCSelectDropdown(el, dd);
    });
});

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}


/* ==========================================
   PREVIEW / ПРОТЕСТИРОВАТЬ (форма и вопрос)
   ========================================== */
function createPreviewToken() {
    var token = 'pv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    var map = {};
    try { map = JSON.parse(localStorage.getItem(PREVIEW_TOKEN_KEY) || '{}') || {}; } catch (e) { map = {}; }
    map[token] = { ts: Date.now(), used: false };
    // чистим старше 2 часов
    var now = Date.now();
    Object.keys(map).forEach(function(k) {
        if (!map[k] || (now - (map[k].ts || 0)) > 2 * 60 * 60 * 1000) delete map[k];
    });
    localStorage.setItem(PREVIEW_TOKEN_KEY, JSON.stringify(map));
    return token;
}

function consumePreviewToken(token) {
    if (!token) return false;
    var map = {};
    try { map = JSON.parse(localStorage.getItem(PREVIEW_TOKEN_KEY) || '{}') || {}; } catch (e) { map = {}; }
    var entry = map[token];
    if (!entry) return false;
    if (Date.now() - (entry.ts || 0) > 2 * 60 * 60 * 1000) {
        delete map[token];
        localStorage.setItem(PREVIEW_TOKEN_KEY, JSON.stringify(map));
        return false;
    }
    // В iframe (оверлей) токен можно использовать повторно, пока сессия жива —
    // иначе перезагрузка iframe ломает превью. Одноразовость — для внешних ссылок.
    var inFrame = false;
    try { inFrame = window.parent && window.parent !== window; } catch (e) { inFrame = true; }
    if (entry.used && !inFrame) return false;
    entry.used = true;
    map[token] = entry;
    localStorage.setItem(PREVIEW_TOKEN_KEY, JSON.stringify(map));
    return true;
}

function buildPreviewUrl(type, formIndex, questionIndex) {
    var token = createPreviewToken();
    var url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('preview', type);
    url.searchParams.set('fi', String(formIndex));
    if (type === 'question' && questionIndex != null) {
        url.searchParams.set('q', String(questionIndex));
    }
    url.searchParams.set('token', token);
    return url.toString();
}

function openFormPreview() {
    var fi = currentFormIndex;
    if (!allForms[fi] || !(allForms[fi].questions || []).length) {
        showAlert('В форме нет вопросов для теста', 'warning');
        return;
    }
    openPreviewInOverlay(buildPreviewUrl('form', fi, null));
}

function openQuestionPreview(qIdx) {
    var fi = currentFormIndex;
    if (!allForms[fi] || !allForms[fi].questions[qIdx]) {
        showAlert('Вопрос не найден', 'warning');
        return;
    }
    openPreviewInOverlay(buildPreviewUrl('question', fi, qIdx));
}

/** Превью без popup: iframe-оверлей (браузер не блокирует) */
function openPreviewInOverlay(url) {
    closePreviewOverlay();
    var safeUrl = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var jsUrl = String(url).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var ov = document.createElement('div');
    ov.id = 'preview-overlay';
    ov.className = 'preview-overlay';
    var hlOn = localStorage.getItem('mf_preview_highlight_always') === '1';
    try {
        var uHl = new URL(url, window.location.href);
        if (hlOn) uHl.searchParams.set('hl', '1');
        else uHl.searchParams.delete('hl');
        url = uHl.toString();
        safeUrl = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        jsUrl = String(url).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    } catch (eHl) {}
    ov.innerHTML =
        '<div class="preview-overlay-bar">' +
            '<span class="material-symbols-rounded">science</span>' +
            '<span style="flex:1;font-weight:600;min-width:0;">Превью — без всплывающих окон</span>' +
            '<label class="preview-hl-toggle" title="Подсвечивать зелёным правильные ответы даже без выбора">' +
                '<input type="checkbox" id="preview-hl-always"' + (hlOn ? ' checked' : '') + ' onchange="onPreviewHighlightToggle(this.checked)">' +
                '<span class="hl-label-full">Подсвечивать зелёным правильные ответы даже без выбора</span>' +
                '<span class="hl-label-short">Верные всегда</span>' +
            '</label>' +
            '<button type="button" class="btn btn-ghost" style="width:auto;padding:6px 12px;margin:0;" onclick="openPreviewInNewTab(\'' + jsUrl + '\')">В новой вкладке</button>' +
            '<button type="button" class="btn" style="width:auto;padding:6px 14px;margin:0;" onclick="closePreviewOverlay()">Закрыть</button>' +
        '</div>' +
        '<iframe id="preview-iframe" class="preview-iframe" src="' + safeUrl + '" title="Превью"></iframe>';
    document.body.appendChild(ov);
    document.body.classList.add('preview-overlay-open');
}

function onPreviewHighlightToggle(on) {
    localStorage.setItem('mf_preview_highlight_always', on ? '1' : '0');
    var iframe = document.getElementById('preview-iframe');
    if (!iframe || !iframe.src) return;
    try {
        var u = new URL(iframe.src, window.location.href);
        if (on) u.searchParams.set('hl', '1');
        else u.searchParams.delete('hl');
        iframe.src = u.toString();
    } catch (e) {
        try { iframe.contentWindow.postMessage({ type: 'myform-preview-hl', on: !!on }, '*'); } catch (e2) {}
    }
}

function openPreviewInNewTab(url) {
    // Не обязательный путь: если браузер блокирует — открываем в этой вкладке
    var w = null;
    try { w = window.open(url, '_blank'); } catch (e) { w = null; }
    if (!w) {
        showAlert('Всплывающие окна заблокированы — открываю превью в этой вкладке', 'info');
        setTimeout(function() { window.location.href = url; }, 600);
    }
}

function closePreviewOverlay() {
    var ov = document.getElementById('preview-overlay');
    if (ov) ov.remove();
    document.body.classList.remove('preview-overlay-open');
}

window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'myform-preview-done' || e.data.type === 'myform-preview-close') {
        closePreviewOverlay();
    }
    if (e.data.type === 'myform-preview-hl' && previewMode) {
        previewMode.highlightAlways = !!e.data.on;
        try { showAnswerExplanation(NaN); } catch (err) {}
    }
});

function applyPreviewFromUrl() {
    try {
        var params = new URLSearchParams(window.location.search);
        var pv = params.get('preview');
        if (!pv || (pv !== 'form' && pv !== 'question')) return false;

        var token = params.get('token') || '';
        if (!consumePreviewToken(token)) {
            // токен уже использован или невалиден
            document.body.innerHTML = '<div style="max-width:420px;margin:40px auto;padding:24px;font-family:system-ui,sans-serif;text-align:center;">' +
                '<div style="font-size:40px;margin-bottom:12px;">🔒</div>' +
                '<h2 style="margin:0 0 8px;">Ссылка превью недействительна</h2>' +
                '<p style="color:#666;margin:0 0 16px;">Одноразовая ссылка уже использована или истекла. Откройте превью заново из админки.</p>' +
                '<button onclick="window.close()" style="padding:10px 18px;border:none;border-radius:10px;background:#1a73e8;color:#fff;font-weight:600;cursor:pointer;">Закрыть</button>' +
                '</div>';
            return true;
        }

        var fi = parseInt(params.get('fi'), 10);
        if (isNaN(fi) || fi < 0 || fi >= allForms.length) fi = 0;
        currentFormIndex = fi;

        var qIdx = params.get('q') != null ? parseInt(params.get('q'), 10) : null;
        var hlAlways = params.get('hl') === '1' || localStorage.getItem('mf_preview_highlight_always') === '1';
        previewMode = {
            type: pv,
            formIndex: fi,
            questionIndex: (pv === 'question' && !isNaN(qIdx)) ? qIdx : null,
            token: token,
            highlightAlways: hlAlways
        };

        document.body.classList.add('preview-mode');
        document.title = 'Превью | My Form';

        // скрыть хром
        [
            'forms-toolbar-container', 'footer-link', 'theme-burger-btn', 'theme-sidebar',
            'theme-sidebar-overlay', 'admin-screen', 'login-screen', 'tools-menu'
        ].forEach(function(sel) {
            var el = document.querySelector('.' + sel) || document.getElementById(sel);
            if (el) el.classList.add('hidden');
        });
        var toolbar = document.querySelector('.forms-toolbar-container');
        if (toolbar) toolbar.classList.add('hidden');
        var footer = document.getElementById('footer-link');
        if (footer) footer.classList.add('hidden');

        // баннер превью
        var banner = document.getElementById('preview-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'preview-banner';
            banner.className = 'preview-banner';
            banner.innerHTML = '<span class="material-symbols-rounded">science</span>' +
                '<span><b>Режим превью</b> — ответы сразу с подсветкой (Learn). Результаты не сохраняются.</span>' +
                '<button type="button" class="btn btn-ghost" style="width:auto;padding:6px 12px;margin:0;" onclick="closePreviewWindow()">Закрыть</button>';
            var container = document.querySelector('.container');
            if (container) container.insertBefore(banner, container.firstChild);
            else document.body.insertBefore(banner, document.body.firstChild);
        }

        // форма (режим Learn через getFormMode → previewMode, без записи в storage)
        var form = allForms[currentFormIndex];

        if (previewMode.type === 'question' && previewMode.questionIndex != null) {
            // один вопрос: временно сужаем questions
            var only = form.questions[previewMode.questionIndex];
            if (only) {
                previewMode._fullQuestions = form.questions;
                form.questions = [JSON.parse(JSON.stringify(only))];
                // без тем в превью одного вопроса
                form.themes = [{ id: 'theme-preview', title: 'Превью', icon: 'science', description: '' }];
                form.questions[0].themeId = 'theme-preview';
            }
        }

        currentQuestionIndex = 0;
        userAnswers = {};
        isExplanationShowing = false;
        currentThemeId = null;

        document.getElementById('quiz-screen').classList.remove('hidden');
        document.getElementById('quiz-box').classList.remove('hidden');
        document.getElementById('result-box').classList.add('hidden');
        document.getElementById('admin-screen').classList.add('hidden');
        var tc = document.getElementById('theme-complete-box');
        if (tc) tc.classList.add('hidden');

        ensureFormThemes(form);
        initCurrentTheme();
        // без бокового меню тем
        document.body.classList.remove('has-themes');
        var burger = document.getElementById('theme-burger-btn');
        if (burger) burger.classList.add('hidden');

        renderQuestion();
        if (previewMode && previewMode.highlightAlways) setTimeout(function(){ try { showAnswerExplanation(NaN); } catch(e){} }, 50);
        return true;
    } catch (e) {
        console.warn('applyPreviewFromUrl', e);
        return false;
    }
}

function injectPreviewFinishUI() {
    var box = document.getElementById('result-box');
    if (!box) return;
    var bar = document.getElementById('preview-finish-bar');
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.id = 'preview-finish-bar';
    bar.className = 'preview-finish-bar';
    bar.innerHTML =
        '<p style="text-align:center;color:var(--text-muted);font-size:13px;margin:0 0 10px;">Превью завершено. Окно закроется через <b id="preview-countdown">3</b> с</p>' +
        '<button class="btn" style="width:100%;" onclick="closePreviewWindow()">Закрыть сейчас</button>';
    box.appendChild(bar);

    // postMessage родителю / opener
    try {
        var msg = { type: 'myform-preview-done', formIndex: previewMode && previewMode.formIndex, token: previewMode && previewMode.token };
        if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*');
        if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
    } catch (e) {}

    var left = 3;
    var cd = document.getElementById('preview-countdown');
    var t = setInterval(function() {
        left--;
        if (cd) cd.textContent = String(left);
        if (left <= 0) {
            clearInterval(t);
            closePreviewWindow();
        }
    }, 1000);
}

function closePreviewWindow() {
    try {
        var msg = { type: 'myform-preview-close', token: previewMode && previewMode.token };
        if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*');
        if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
    } catch (e) {}
    if (previewMode && previewMode._fullQuestions && allForms[previewMode.formIndex]) {
        allForms[previewMode.formIndex].questions = previewMode._fullQuestions;
    }
    // В iframe просто сообщаем родителю — оверлей закроет сам
    var inFrame = false;
    try { inFrame = window.parent && window.parent !== window; } catch (e) { inFrame = true; }
    if (inFrame) return;
    try { window.close(); } catch (e) {}
    setTimeout(function() {
        if (!window.closed) {
            var u = new URL(window.location.href);
            u.search = '';
            window.location.href = u.toString();
        }
    }, 200);
}



/* ==========================================
   PWA / OFFLINE / MINI WORKGENS
   ========================================== */
const OFFLINE_EDITS_KEY = 'my_forms_offline_edits';

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
        navigator.serviceWorker.register('./sw.js').catch(function(e) {
            console.warn('SW register', e);
        });
    } catch (e) { console.warn(e); }
}

function isOnline() {
    return navigator.onLine !== false;
}

function initOfflineManager() {
    updateOnlineUI();
    window.addEventListener('online', function() {
        updateOnlineUI();
        showAlert('Сеть снова доступна', 'wifi');
    });
    window.addEventListener('offline', function() {
        updateOnlineUI();
        showAlert('Вы офлайн. Share, WorkGens и другие сервисы недоступны.', 'cloud_off');
    });
}

function updateOnlineUI() {
    var online = isOnline();
    var wasOffline = document.body.classList.contains('is-offline');
    document.body.classList.toggle('is-offline', !online);
    var btn = document.getElementById('offline-status-btn');
    if (btn) {
        if (!online || hasPendingOfflineEdits()) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
        btn.title = !online
            ? 'Офлайн — нажмите для справки'
            : 'Есть офлайн-правки — нажмите';
        var icon = btn.querySelector('.material-symbols-rounded');
        if (icon) icon.textContent = !online ? 'cloud_off' : 'sync_problem';
    }
    if (typeof renderAllFormsUI === 'function') {
        try { refreshOfflineDotsOnTabs(); } catch (e) {}
        try { renderAllFormsUI(); } catch (e) {}
    }
    // ушли в офлайн: Test → фактически Learn
    if (!online && !wasOffline) {
        var f = allForms[currentFormIndex];
        if (f && (f.mode === 'test' || !f.mode)) {
            try { if (typeof loadCurrentForm === 'function') loadCurrentForm(); } catch (e) {}
            showAlert('Офлайн: режим Test недоступен. Форма работает как Learn.', 'wifi_off');
        }
    }
    // вернулись онлайн — обновить бейджи режимов
    if (online && wasOffline) {
        try { if (typeof loadCurrentForm === 'function') loadCurrentForm(); } catch (e) {}
    }
}

function loadOfflineEditsMap() {
    try { return JSON.parse(localStorage.getItem(OFFLINE_EDITS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
}
function saveOfflineEditsMap(map) {
    localStorage.setItem(OFFLINE_EDITS_KEY, JSON.stringify(map));
}
function offlineEditKey(formIndex) {
    var form = allForms[formIndex];
    return formIndex + '::' + ((form && (form.id || form.title)) || formIndex);
}
function markOfflineEditIfNeeded() {
    if (isOnline()) return;
    if (previewMode) return;
    var map = loadOfflineEditsMap();
    map[offlineEditKey(currentFormIndex)] = { ts: Date.now(), formIndex: currentFormIndex };
    saveOfflineEditsMap(map);
    updateOnlineUI();
    refreshOfflineDotsOnTabs();
}
function hasPendingOfflineEdits() {
    var map = loadOfflineEditsMap();
    return Object.keys(map).length > 0;
}
function clearOfflineEditFlag(formIndex) {
    var map = loadOfflineEditsMap();
    var k = offlineEditKey(formIndex != null ? formIndex : currentFormIndex);
    delete map[k];
    // also try numeric-only keys
    Object.keys(map).forEach(function(key) {
        if (map[key] && map[key].formIndex === (formIndex != null ? formIndex : currentFormIndex)) delete map[key];
    });
    saveOfflineEditsMap(map);
    updateOnlineUI();
    refreshOfflineDotsOnTabs();
}
function refreshOfflineDotsOnTabs() {
    var map = loadOfflineEditsMap();
    document.querySelectorAll('.form-tab').forEach(function(tab) {
        var idx = parseInt(tab.dataset.formIndex, 10);
        var need = false;
        Object.keys(map).forEach(function(k) {
            if (map[k] && (map[k].formIndex === idx || k.indexOf(idx + '::') === 0)) need = true;
        });
        var dot = tab.querySelector('.offline-edit-dot');
        if (need && !dot) {
            dot = document.createElement('span');
            dot.className = 'offline-edit-dot';
            dot.title = 'Редактировалось офлайн';
            tab.insertBefore(dot, tab.firstChild);
        } else if (!need && dot) {
            dot.remove();
        }
    });
}

function onOfflineBadgeClick() {
    if (!isOnline()) {
        showAlert('Сейчас нет сети.\n\n• Формы и ответы сохраняются на этом устройстве\n• Поделиться ссылкой, WorkGens AI и другие сервисы недоступны\n• После появления интернета нажмите эту иконку снова, если были офлайн-правки', 'cloud_off');
        return;
    }
    if (hasPendingOfflineEdits()) {
        clearOfflineEditFlag(currentFormIndex);
        // clear all pending as "synced" to local (already in localStorage)
        saveOfflineEditsMap({});
        updateOnlineUI();
        refreshOfflineDotsOnTabs();
        showAlert('Офлайн-правки уже в localStorage этого устройства. Флаги сняты. Для другого устройства экспортируйте JSON.', 'check_circle');
    } else {
        showAlert('Сеть есть. Офлайн-правок нет.', 'wifi');
    }
}

function goOnlineFeature(url, action) {
    if (!isOnline()) {
        showAlert('Нужен интернет для этой функции', 'wifi_off');
        return;
    }
    if (action === 'share') {
        try { generateShareLink(); } catch (e) { showAlert('Не удалось открыть «Поделиться»', 'error'); }
        try { toggleToolsMenu(); } catch (e) {}
        return;
    }
    if (url) window.location.href = url;
}

/* ----- Mini WorkGens (локальная генерация форм) ----- */


/* ----- FormsGens AI (чат, 1 на форму, только онлайн) ----- */
const FORMSGENS_CHATS_KEY = 'formsgens_chats_v1';
// ключ API — общий с WorkGens (если сохранён)
function getWorkGensApiKey() {
    try {
        return localStorage.getItem('workgens_api_key')
            || localStorage.getItem('wg_api_key')
            || localStorage.getItem('openai_api_key')
            || localStorage.getItem('gemini_api_key')
            || '';
    } catch (e) { return ''; }
}
function formsgensFormKey(idx) {
    var f = allForms[idx != null ? idx : currentFormIndex];
    return (idx != null ? idx : currentFormIndex) + '::' + ((f && (f.id || f.title)) || 'form');
}
function loadFormsGensChats() {
    try { return JSON.parse(localStorage.getItem(FORMSGENS_CHATS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
}
function saveFormsGensChats(map) {
    localStorage.setItem(FORMSGENS_CHATS_KEY, JSON.stringify(map));
}
function getFormsGensMessages(idx) {
    var map = loadFormsGensChats();
    var k = formsgensFormKey(idx);
    return Array.isArray(map[k]) ? map[k] : [];
}
function setFormsGensMessages(idx, msgs) {
    var map = loadFormsGensChats();
    map[formsgensFormKey(idx)] = msgs.slice(-80);
    saveFormsGensChats(map);
}

function toggleMiniAI(force) {
    var panel = document.getElementById('mini-ai-panel');
    var bd = document.getElementById('mini-ai-backdrop');
    if (!panel) return;
    var open = force === true ? true : force === false ? false : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (bd) bd.classList.toggle('hidden', !open);
    document.body.classList.toggle('mini-ai-open', open);
    if (open) {
        refreshFormsGensUI();
        var ta = document.getElementById('mini-ai-prompt');
        if (ta && isOnline()) setTimeout(function(){ ta.focus(); }, 120);
    }
}

function toggleFormsGensMenu(e) {
    if (e) e.stopPropagation();
    var m = document.getElementById('formsgens-menu');
    if (!m) return;
    m.classList.toggle('hidden');
    if (!m.classList.contains('hidden')) {
        setTimeout(function() {
            document.addEventListener('click', function hide() {
                m.classList.add('hidden');
                document.removeEventListener('click', hide);
            }, { once: true });
        }, 10);
    }
}

function refreshFormsGensUI() {
    var label = document.getElementById('formsgens-form-label');
    var form = allForms[currentFormIndex];
    if (label) label.textContent = form ? ('Форма: ' + (form.title || ('№' + (currentFormIndex + 1)))) : 'Нет формы';
    var banner = document.getElementById('formsgens-offline-banner');
    if (banner) banner.classList.toggle('hidden', isOnline());
    renderFormsGensMessages();
}

function renderFormsGensMessages() {
    var box = document.getElementById('formsgens-messages');
    if (!box) return;
    var msgs = getFormsGensMessages(currentFormIndex);
    if (!msgs.length) {
        box.innerHTML = '<div class="fg-bubble system">Чат привязан к этой форме. Один чат на форму. Ключ API берётся из WorkGens (если сохранён). Только онлайн.</div>';
        return;
    }
    box.innerHTML = msgs.map(function(m) {
        var role = m.role === 'user' ? 'user' : (m.role === 'system' ? 'system' : 'assistant');
        var text = escapeHtml(m.text || '');
        var actions = '';
        if (m.applyForm && m.payload) {
            actions = '<div class="fg-actions"><button type="button" class="btn" style="width:auto;padding:6px 12px;font-size:12px;" onclick=\'applyFormsGensPayload(' + JSON.stringify(JSON.stringify(m.payload)) + ')\'>Применить к форме</button></div>';
        }
        return '<div class="fg-bubble ' + role + '">' + text.replace(/\n/g, '<br>') + actions + '</div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
}

function clearFormsGensChat() {
    setFormsGensMessages(currentFormIndex, []);
    renderFormsGensMessages();
    showAlert('Чат этой формы очищен', 'check_circle');
}

function showFormsGensLimits() {
    showAlert('Лимиты зависят от вашего ключа API в WorkGens. FormsGens использует тот же ключ. Локальных квот нет.', 'speed');
}
function showFormsGensAbout() {
    showAlert('FormsGens AI — встроенный помощник My Form. Генерирует и правит вопросы текущей формы. Один чат на форму. Полный WorkGens — через меню ⋮.', 'info');
}

function sendFormsGensMessage() {
    if (!isOnline()) {
        showAlert('FormsGens доступен только онлайн', 'wifi_off');
        return;
    }
    var ta = document.getElementById('mini-ai-prompt');
    var text = (ta && ta.value || '').trim();
    if (!text) return;
    var msgs = getFormsGensMessages(currentFormIndex);
    msgs.push({ role: 'user', text: text, ts: Date.now() });
    setFormsGensMessages(currentFormIndex, msgs);
    if (ta) ta.value = '';
    renderFormsGensMessages();

    // Попытка реального API; fallback — локальный генератор
    var key = getWorkGensApiKey();
    if (key) {
        callFormsGensApi(text, key).catch(function() {
            localFormsGensReply(text);
        });
    } else {
        localFormsGensReply(text);
    }
}

function localFormsGensReply(userText) {
    var form = miniAIBuildForm(userText);
    var reply = 'Предложил форму «' + form.title + '» (' + form.questions.length + ' вопр.). Нажмите «Применить к форме», чтобы добавить вопросы в текущую форму, или опишите правки.';
    var msgs = getFormsGensMessages(currentFormIndex);
    msgs.push({ role: 'assistant', text: reply, ts: Date.now(), applyForm: true, payload: form });
    setFormsGensMessages(currentFormIndex, msgs);
    renderFormsGensMessages();
}

async function callFormsGensApi(userText, key) {
    var form = allForms[currentFormIndex];
    var ctx = {
        title: form && form.title,
        questionsCount: form && form.questions ? form.questions.length : 0,
        types: (form && form.questions || []).slice(0, 12).map(function(q){ return q.type; })
    };
    var system = 'Ты FormsGens AI — помощник конструктора форм My Form. Отвечай кратко по-русски. Если пользователь просит создать/добавить вопросы, верни в конце блок JSON между маркерами <<<FORM и FORM>>> с полями title и questions (type, title, options, correctChoices и т.д.). Контекст формы: ' + JSON.stringify(ctx);
    // Gemini-style REST (часто ключ gemini)
    var endpoint = localStorage.getItem('workgens_api_endpoint') || '';
    try {
        var answer = '';
        if (!endpoint && (key.startsWith('AIza') || localStorage.getItem('gemini_api_key'))) {
            var model = localStorage.getItem('workgens_model') || 'gemini-2.0-flash';
            var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key);
            var res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: system + '\n\nЗапрос: ' + userText }] }]
                })
            });
            if (!res.ok) throw new Error('api ' + res.status);
            var data = await res.json();
            answer = (((data.candidates || [])[0] || {}).content || {}).parts;
            answer = Array.isArray(answer) ? answer.map(function(p){ return p.text || ''; }).join('') : '';
        } else {
            // OpenAI-compatible
            endpoint = endpoint || 'https://api.openai.com/v1/chat/completions';
            var res2 = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + key
                },
                body: JSON.stringify({
                    model: localStorage.getItem('workgens_model') || 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: userText }
                    ]
                })
            });
            if (!res2.ok) throw new Error('api ' + res2.status);
            var data2 = await res2.json();
            answer = (((data2.choices || [])[0] || {}).message || {}).content || '';
        }
        if (!answer) throw new Error('empty');
        var payload = null;
        var fm = answer.match(/<<<FORM([\s\S]*?)FORM>>>/);
        if (fm) {
            try { payload = JSON.parse(fm[1].trim()); } catch (e) {}
            answer = answer.replace(/<<<FORM[\s\S]*?FORM>>>/, '').trim();
        }
        var msgs = getFormsGensMessages(currentFormIndex);
        msgs.push({ role: 'assistant', text: answer || 'Готово.', ts: Date.now(), applyForm: !!payload, payload: payload });
        setFormsGensMessages(currentFormIndex, msgs);
        renderFormsGensMessages();
    } catch (e) {
        console.warn('FormsGens API', e);
        localFormsGensReply(userText);
    }
}

function applyFormsGensPayload(payloadStr) {
    try {
        var form = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
        if (typeof form === 'string') form = JSON.parse(form);
        if (!form || !Array.isArray(form.questions)) {
            showAlert('Нет данных формы для применения', 'error');
            return;
        }
        if (!allForms[currentFormIndex]) {
            allForms.push({ title: form.title || 'FormsGens', questions: form.questions, settings: { saveProgress: true } });
            currentFormIndex = allForms.length - 1;
        } else {
            if (form.title && !(allForms[currentFormIndex].questions || []).length) {
                allForms[currentFormIndex].title = form.title;
            }
            allForms[currentFormIndex].questions = (allForms[currentFormIndex].questions || []).concat(form.questions);
        }
        saveFormsToStorage();
        renderAllFormsUI();
        loadCurrentForm();
        showAlert('Добавлено вопросов: ' + form.questions.length, 'check_circle');
    } catch (e) {
        console.warn(e);
        showAlert('Не удалось применить', 'error');
    }
}

// legacy aliases
function runMiniAIGenerate() {
    sendFormsGensMessage();
}

function miniAIBuildForm(text) {
    var titleMatch = text.match(/(?:форма|тест|квиз)\s*[«"]?([^»"\n,.]+)/i);
    var title = titleMatch ? titleMatch[1].trim() : text.split(/[.\n]/)[0].slice(0, 48) || 'Форма от Mini WorkGens';

    var countMatch = text.match(/(\d+)\s*(?:вопрос|questions?)/i);
    var n = countMatch ? Math.min(20, Math.max(1, parseInt(countMatch[1], 10))) : 5;

    var wantRadio = /radio|один из|выбор/i.test(text);
    var wantCheck = /checkbox|несколько|множествен/i.test(text);
    var wantText = /текст|вставь|input|напишите/i.test(text);
    var wantFlash = /флеш|карточк|flashcard/i.test(text);
    var wantSelect = /select|выпадающ/i.test(text);

    var types = [];
    if (wantRadio) types.push('radio');
    if (wantCheck) types.push('checkbox');
    if (wantText) types.push('text');
    if (wantFlash) types.push('flashcard');
    if (wantSelect) types.push('select');
    if (!types.length) types = ['radio', 'radio', 'text', 'flashcard', 'radio'];

    // topic keywords
    var topic = title;
    var questions = [];
    for (var i = 0; i < n; i++) {
        var type = types[i % types.length];
        questions.push(miniAIMakeQuestion(type, topic, i));
    }
    return {
        title: title,
        questions: questions,
        settings: { saveProgress: true, showWrong: true, showCorrect: true }
    };
}

function miniAIMakeQuestion(type, topic, i) {
    var num = i + 1;
    if (type === 'radio' || type === 'select' || type === 'checkbox') {
        return {
            type: type,
            title: 'Вопрос ' + num + ' по теме «' + topic + '»',
            description: type === 'checkbox' ? 'Выберите все верные варианты' : 'Выберите один вариант',
            options: ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
            correctChoices: type === 'checkbox' ? [0, 2] : [0],
            required: true
        };
    }
    if (type === 'text') {
        return {
            type: 'text',
            title: 'Кратко ответьте (вопрос ' + num + '): что вы знаете о «' + topic + '»?',
            correctText: [],
            required: false
        };
    }
    if (type === 'flashcard') {
        return {
            type: 'flashcard',
            title: topic + ' — термин #' + num,
            flashcardAnswer: 'Определение для «' + topic + '» (отредактируйте в админке)'
        };
    }
    return {
        type: 'radio',
        title: 'Вопрос ' + num,
        options: ['Да', 'Нет'],
        correctChoices: [0],
        required: true
    };
}

// после renderAllFormsUI — точки офлайн
(function() {
    var _orig = null;
    function wrapRender() {
        if (typeof renderAllFormsUI !== 'function') return;
        if (renderAllFormsUI._offlineWrapped) return;
        var orig = renderAllFormsUI;
        renderAllFormsUI = function() {
            orig.apply(this, arguments);
            try { refreshOfflineDotsOnTabs(); } catch (e) {}
        };
        renderAllFormsUI._offlineWrapped = true;
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapRender);
    } else {
        wrapRender();
    }
})();


/* ===== Table question (BETA) ===== */
window.__adminTableState = window.__adminTableState || { cells: {}, ctxKey: null };

function clampTableSize(n) {
    n = parseInt(n, 10);
    if (isNaN(n) || n < 1) return 1;
    return Math.min(25, n);
}
function tableCellKey(r, c) { return r + ',' + c; }

function rebuildAdminTableGrid() {
    var wrap = document.getElementById('admin-table-grid-wrap');
    if (!wrap) return;
    var rows = clampTableSize((document.getElementById('table-rows') || {}).value || 3);
    var cols = clampTableSize((document.getElementById('table-cols') || {}).value || 3);
    var rowsEl = document.getElementById('table-rows');
    var colsEl = document.getElementById('table-cols');
    if (rowsEl) rowsEl.value = rows;
    if (colsEl) colsEl.value = cols;
    var allowAll = !!(document.getElementById('table-allow-all-edit') && document.getElementById('table-allow-all-edit').checked);
    var st = window.__adminTableState;
    if (!st.cells) st.cells = {};
    var html = '<table class="mf-table" id="admin-mf-table"><tbody>';
    for (var r = 0; r < rows; r++) {
        html += '<tr>';
        for (var c = 0; c < cols; c++) {
            var key = tableCellKey(r, c);
            var cell = st.cells[key] || { value: '', editable: allowAll, correct: '' };
            if (allowAll) cell.editable = true;
            st.cells[key] = cell;
            var cls = cell.editable ? 'mf-editable' : 'mf-locked';
            html += '<td class="' + cls + '" data-r="' + r + '" data-c="' + c + '" data-key="' + key + '">' +
                '<input class="mf-cell-inner" type="text" value="' + escapeHtml(cell.value || '') + '" ' +
                'oninput="onAdminTableCellInput(this)" data-key="' + key + '"></td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('td').forEach(function(td) {
        td.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openAdminTableCtx(e, td);
        });
    });
}

function onAdminTableCellInput(input) {
    var key = input.getAttribute('data-key');
    if (!key) return;
    var st = window.__adminTableState;
    if (!st.cells[key]) st.cells[key] = { value: '', editable: false, correct: '' };
    st.cells[key].value = input.value;
}

function onTableAllowAllChange() {
    var allowAll = !!(document.getElementById('table-allow-all-edit') && document.getElementById('table-allow-all-edit').checked);
    var st = window.__adminTableState;
    Object.keys(st.cells || {}).forEach(function(k) {
        if (allowAll) st.cells[k].editable = true;
    });
    rebuildAdminTableGrid();
}

function openAdminTableCtx(e, td) {
    var key = td.getAttribute('data-key');
    var st = window.__adminTableState;
    var cell = st.cells[key] || { value: '', editable: false, correct: '' };
    st.ctxKey = key;
    document.querySelectorAll('#admin-mf-table td').forEach(function(x) { x.classList.remove('mf-selected'); });
    td.classList.add('mf-selected');
    var menu = document.getElementById('admin-table-ctx');
    if (!menu) return;
    var ed = document.getElementById('atx-editable');
    var corr = document.getElementById('atx-correct');
    if (ed) ed.checked = !!cell.editable;
    if (corr) corr.value = cell.correct || '';
    menu.classList.remove('hidden');
    menu.style.left = Math.min(e.clientX, window.innerWidth - 280) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 180) + 'px';
}

function applyAdminTableCtx() {
    var st = window.__adminTableState;
    var key = st.ctxKey;
    if (!key) return;
    if (!st.cells[key]) st.cells[key] = { value: '', editable: false, correct: '' };
    var ed = document.getElementById('atx-editable');
    var corr = document.getElementById('atx-correct');
    st.cells[key].editable = !!(ed && ed.checked);
    st.cells[key].correct = corr ? String(corr.value || '') : '';
    var allowAll = document.getElementById('table-allow-all-edit');
    if (allowAll && !st.cells[key].editable) allowAll.checked = false;
    hideAdminTableCtx();
    rebuildAdminTableGrid();
}

function hideAdminTableCtx() {
    var menu = document.getElementById('admin-table-ctx');
    if (menu) menu.classList.add('hidden');
    window.__adminTableState.ctxKey = null;
}

document.addEventListener('click', function(e) {
    var menu = document.getElementById('admin-table-ctx');
    if (!menu || menu.classList.contains('hidden')) return;
    if (!e.target.closest('#admin-table-ctx')) hideAdminTableCtx();
});

function collectAdminTableCells(rows, cols, allowAll) {
    var st = window.__adminTableState;
    var out = {};
    for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
            var key = tableCellKey(r, c);
            var cell = (st.cells && st.cells[key]) || { value: '', editable: false, correct: '' };
            out[key] = {
                value: cell.value || '',
                editable: allowAll ? true : !!cell.editable,
                correct: cell.correct || ''
            };
        }
    }
    return out;
}

function renderStudentTableHTML(q, savedVal) {
    var rows = clampTableSize(q.tableRows || 3);
    var cols = clampTableSize(q.tableCols || 3);
    var cells = q.tableCells || {};
    var saved = (savedVal && typeof savedVal === 'object' && !Array.isArray(savedVal)) ? savedVal : {};
    var html = '<div class="student-table-wrap"><table class="mf-table" id="student-mf-table"><tbody>';
    for (var r = 0; r < rows; r++) {
        html += '<tr>';
        for (var c = 0; c < cols; c++) {
            var key = tableCellKey(r, c);
            var cell = cells[key] || { value: '', editable: !!q.tableAllowAllEdit, correct: '' };
            var editable = !!(q.tableAllowAllEdit || cell.editable);
            var val = editable && saved[key] != null ? saved[key] : (cell.value || '');
            if (editable) {
                html += '<td class="mf-editable"><input class="mf-cell-inner" type="text" data-key="' + key + '" value="' + escapeHtml(String(val)) + '"></td>';
            } else {
                html += '<td class="mf-locked"><span class="mf-cell-inner">' + escapeHtml(String(cell.value || '')) + '</span></td>';
            }
        }
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

function bindStudentTableInputs(q) {
    var table = document.getElementById('student-mf-table');
    if (!table) return;
    function persist() {
        var data = {};
        table.querySelectorAll('input.mf-cell-inner[data-key]').forEach(function(inp) {
            data[inp.getAttribute('data-key')] = inp.value;
        });
        saveAnswer(data);
    }
    table.querySelectorAll('input.mf-cell-inner[data-key]').forEach(function(inp) {
        inp.addEventListener('input', persist);
        inp.addEventListener('change', persist);
    });
    persist();
}

function isTableAnswerCorrect(q, userAns) {
    var cells = q.tableCells || {};
    var saved = (userAns && typeof userAns === 'object' && !Array.isArray(userAns)) ? userAns : {};
    var checked = 0;
    var keys = Object.keys(cells);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var correct = String((cells[key] && cells[key].correct) || '').trim();
        if (!correct) continue;
        checked++;
        var got = String(saved[key] != null ? saved[key] : '').trim();
        if (got.toLowerCase() !== correct.toLowerCase()) return false;
    }
    return true;
}

function getTableCorrectDisplay(q) {
    var cells = q.tableCells || {};
    var parts = [];
    Object.keys(cells).forEach(function(k) {
        if (String((cells[k] && cells[k].correct) || '').trim())
            parts.push(k + ' → ' + cells[k].correct);
    });
    return parts.length ? parts.join('; ') : '—';
}


/* ===== Legacy notice (button deprecated from 14.11.2026) ===== */
function openLegacyNoticeModal() {
    var m = document.getElementById('legacy-notice-modal');
    if (m) m.classList.remove('hidden');
}
function closeLegacyNoticeModal() {
    var m = document.getElementById('legacy-notice-modal');
    if (m) m.classList.add('hidden');
}
function goToLegacyVersion() {
    window.location.href = 'https://oracle-ai-pro.github.io/my-work/forms/index_old.html';
}


/** Открыть полный WorkGens с прикреплённой текущей формой */
function openWorkGensWithCurrentForm() {
    if (!navigator.onLine) {
        showAlert('WorkGens AI доступен только онлайн', 'warning');
        return;
    }
    var form = (typeof allForms !== 'undefined' && allForms[currentFormIndex]) ? allForms[currentFormIndex] : null;
    var payload = null;
    if (form) {
        try {
            payload = {
                source: 'my-form',
                attachedAt: Date.now(),
                formIndex: currentFormIndex,
                title: form.title || form.name || ('Форма ' + (currentFormIndex + 1)),
                form: form
            };
            sessionStorage.setItem('wg_attached_form', JSON.stringify(payload));
            localStorage.setItem('wg_attached_form_meta', JSON.stringify({
                title: payload.title,
                formIndex: currentFormIndex,
                attachedAt: payload.attachedAt
            }));
        } catch (e) {
            console.warn('attach form', e);
        }
    }
    var url = '../WorkGens/index.html?from=forms&attach=1';
    if (payload && payload.title) {
        url += '&formTitle=' + encodeURIComponent(payload.title);
    }
    window.location.href = url;
}

// FormsGens panel deprecated — redirect any old calls
function toggleMiniAI() { openWorkGensWithCurrentForm(); }
