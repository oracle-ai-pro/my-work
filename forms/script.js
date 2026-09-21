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
let currentThemeId = null;
let currentRealQuestionIndex = 0;
let editingThemeId = null;
let selectedThemeIcon = 'school';
const THEME_PROGRESS_KEY = 'my_forms_theme_progress';
const THEME_PROGRESS_DAYS = 30;
const THEME_ICONS = [
    'school','menu_book','science','calculate','history_edu','language',
    'psychology','biotech','public','palette','music_note','sports_soccer',
    'code','terminal','cloud','bolt','lightbulb','favorite','star','flag',
    'extension','quiz','assignment','checklist','layers','category'
];

const defaultForm = {
    title: "Тестовая форма",
    questions: [
        {
            type: "radio",
            title: "Какой язык используется для стилизации веб-страниц?",
            description: "Выберите один наиболее точный вариант из предложенных.",
            options: ["HTML", "CSS", "JavaScript", "Python"],
            correctChoices: [1],
            required: true,
            hasExplanation: true,
            explanationTitle: "Справка по веб-разработке",
            explanationText: "CSS (Cascading Style Sheets) отвечает за оформление и стилизацию HTML-документов."
        },
        {
            type: "text",
            title: "Я [input] купить продукты (в настоящее время).",
            description: "Вставьте правильную форму глагола «хотеть».",
            useInlineInput: true,
            correctText: ["хочу"],
            required: true
        },
        {
            type: "flashcard",
            title: "JavaScript (JS)",
            flashcardAnswer: "Мультипарадигменный язык программирования, используемый для создания интерактивности на веб-страницах."
        },
        {
            type: "puzzle-drag",
            title: "Расставьте слова по порядку (Цифры 1, 2, 3):",
            options: ["Второй", "Первый", "Третий"],
            correctChoices: [1, 0, 2]
        }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    loadFormsFromStorage();
    applyShareParamsFromUrl();
    initSettings();
    renderAllFormsUI();
    loadCurrentForm();
    checkOldDataMigration();

    // Предзагрузка голосов TTS
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
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
            allForms = [defaultForm];
        }
    } else {
        allForms = [defaultForm];
        saveFormsToStorage();
    }
}

function saveFormsToStorage() {
    localStorage.setItem('my_forms_data', JSON.stringify(allForms));
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
    if (modal) modal.classList.add('active');
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
    if (alertModal) alertModal.classList.add('active');
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
    return (form && form.mode) ? form.mode : 'test';
}

function setFormMode(index, mode) {
    if (!allForms[index]) return;
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
    menu.innerHTML = `
        <div class="ctx-title">Режим формы</div>
        <div class="ctx-item ${currentMode === 'test' ? 'active' : ''}" onclick="setFormMode(${formIndex}, 'test')">
            <span class="material-symbols-rounded">quiz</span> Test
            <small>Обычный тест (по умолчанию)</small>
        </div>
        <div class="ctx-item ${currentMode === 'learn' ? 'active' : ''}" onclick="setFormMode(${formIndex}, 'learn')">
            <span class="material-symbols-rounded">school</span> Learn
            <small>Сразу показывать верный/неверный</small>
        </div>
        <div class="ctx-item ${currentMode === 'flashcards' ? 'active' : ''}" onclick="setFormMode(${formIndex}, 'flashcards')">
            <span class="material-symbols-rounded">style</span> FlashCards
            <small>Карточки: знаю / не знаю</small>
        </div>
    `;
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
    renderAllFormsUI();
    loadCurrentForm();
}

function createNewFormPrompt() {
    showPrompt("Введите название новой формы:", "", (title) => {
        if (title && title.trim()) {
            allForms.push({
                title: title.trim(),
                questions: []
            });
            currentFormIndex = allForms.length - 1;
            saveFormsToStorage();
            renderAllFormsUI();
            loadCurrentForm();
            showAlert('Новая форма успешно создана!', 'check_circle');
        }
    });
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

function renderMediaHTML(url) {
    if (!url) return '';
    if (url.startsWith('data:video') || url.match(/\.(mp4|webm|ogv)$/i)) {
        return `<div style="text-align:center; margin-bottom:15px;"><video src="${url}" controls style="max-width:100%; border-radius:12px;"></video></div>`;
    } else if (url.startsWith('data:audio') || url.match(/\.(mp3|wav|ogg)$/i)) {
        return `<div style="text-align:center; margin-bottom:15px;"><audio src="${url}" controls style="width:100%;"></audio></div>`;
    } else {
        return `<div style="text-align:center; margin-bottom:15px;"><img src="${url}" style="max-width:100%; border-radius:12px;"></div>`;
    }
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
    const q = form.questions[currentQuestionIndex];
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');

    document.getElementById('current-number').textContent = currentQuestionIndex + 1;
    document.getElementById('total-number').textContent = form.questions.length;
    document.getElementById('progress').style.width = `${((currentQuestionIndex + 1) / form.questions.length) * 100}%`;
    document.getElementById('timer-display').classList.add('hidden');
    document.getElementById('hint-btn').classList.add('hidden');
    document.getElementById('hint-box').classList.add('hidden');

    const answerText = getFlashcardAnswerText(q);
    const body = document.getElementById('question-body');

    body.innerHTML = `
        <div style="text-align:center; margin-bottom:8px; font-size:13px; color:var(--text-muted);">
            FlashCards • ${q.type} &nbsp;|&nbsp; ✓ ${flashcardStats.know} &nbsp; ✗ ${flashcardStats.dontKnow}
        </div>
        <div class="flashcard-container" id="fc-card" onclick="this.classList.toggle('flipped')" style="min-height:240px;">
            <div class="flashcard-inner">
                <div class="flashcard-side flashcard-front">
                    <span class="material-symbols-rounded" style="font-size:28px; color:var(--accent-color); margin-bottom:8px;">style</span>
                    <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Нажмите, чтобы перевернуть</p>
                    <p style="font-size:17px; font-weight:600; margin:0; line-height:1.4;">${q.title}</p>
                    ${q.description ? `<p style="font-size:13px; color:var(--text-muted); margin-top:10px;">${q.description}</p>` : ''}
                    ${q.options ? `<div style="margin-top:12px; text-align:left; font-size:14px;">${q.options.map(o => `<div>• ${o}</div>`).join('')}</div>` : ''}
                </div>
                <div class="flashcard-side flashcard-back">
                    <span class="material-symbols-rounded" style="font-size:28px; color:var(--accent-color); margin-bottom:8px;">lightbulb</span>
                    <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Ответ</p>
                    <p style="font-size:16px; font-weight:500; margin:0; line-height:1.45;">${answerText}</p>
                </div>
            </div>
        </div>
        <div style="display:flex; gap:12px; margin-top:20px;">
            <button class="btn" onclick="flashcardDontKnow()" style="flex:1; background:transparent; color:var(--text-color); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; gap:6px;">
                <span class="material-symbols-rounded">arrow_back</span> Не знаю
            </button>
            <button class="btn" onclick="flashcardKnow()" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">
                Знаю <span class="material-symbols-rounded">arrow_forward</span>
            </button>
        </div>
    `;
}

function flashcardKnow() {
    flashcardStats.know++;
    userAnswers[currentRealQuestionIndex] = 'know';
    const form = allForms[currentFormIndex];
    var _al = getActiveQuestionList();
    if (currentQuestionIndex < _al.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        if (themesEnabled(form)) showThemeCompleteScreen();
        else calculateResults();
    }
}

function flashcardDontKnow() {
    // Как в Quizlet: «Не знаю» = крестик и дальше, переворот только касанием карточки
    flashcardStats.dontKnow++;
    userAnswers[currentRealQuestionIndex] = 'dontknow';
    const form = allForms[currentFormIndex];
    var _al = getActiveQuestionList();
    if (currentQuestionIndex < _al.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        if (themesEnabled(form)) showThemeCompleteScreen();
        else calculateResults();
    }
}


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

    if (q.type === 'text' && q.useInlineInput && q.title.includes('[input]')) {
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
            if (q.mediaUrl) {
                body.innerHTML += renderMediaHTML(q.mediaUrl);
            }
            saveAnswer('viewed');
            break;

        default:
            body.innerHTML += `<p style="color:var(--text-muted);">Тип вопроса поддерживается в упрощенном режиме.</p>`;
            saveAnswer('viewed');
    }
}

function saveAnswer(val) { userAnswers[currentRealQuestionIndex] = val; }

function saveCheckboxAnswer() {
    const checked = Array.from(document.querySelectorAll('input[name="q_opt"]:checked')).map(el => parseInt(el.value));
    userAnswers[currentRealQuestionIndex] = checked;
}

function savePuzzleAnswer() {
    const items = Array.from(document.querySelectorAll('.puzzle-item')).map(el => parseInt(el.getAttribute('data-idx')));
    userAnswers[currentRealQuestionIndex] = items;
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
    var answerIsEmpty = (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0));
    if (!force && !isExplanationShowing && q.required && answerIsEmpty) {
        showAlert('Пожалуйста, ответьте на обязательный вопрос!', 'warning');
        return;
    }

    if (!isExplanationShowing && q.hasExplanation && q.explanationText) {
        isExplanationShowing = true;
        stopTimer();
        
        const inputs = document.querySelectorAll('#question-body input, #question-body select, #question-body button');
        inputs.forEach(el => el.disabled = true);

        const body = document.getElementById('question-body');
        const expTitle = q.explanationTitle ? q.explanationTitle : 'Разбор ответа';
        
        body.innerHTML += `
            <div class="explanation-card">
                <div class="explanation-title">
                    <span class="material-symbols-rounded">lightbulb</span> ${expTitle}
                </div>
                <div class="explanation-body">${q.explanationText}</div>
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
    if (!q) return '—';
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
    if (!q || !q.hasAnswerExplanations) return '';
    var text = '';
    if (isCorrect) {
        text = q.answerExpCorrect || '';
    } else {
        var map = q.answerExpIncorrect || {};
        if (q.type === 'radio' || q.type === 'select') {
            var n = parseInt(userAns, 10);
            if (!isNaN(n) && (map[n] != null || map[String(n)] != null)) {
                text = map[n] != null ? map[n] : map[String(n)];
            } else {
                text = map.default || map['*'] || '';
            }
        } else {
            text = map.default || map['*'] || '';
        }
        // fallback: show correct explanation tip if no per-wrong text
        if (!text && q.answerExpCorrect) {
            text = ''; // only show wrong-specific if set
        }
    }
    // Also show general post-answer explanation if hasExplanation
    var parts = [];
    if (text) {
        parts.push('<div class="result-explanation ' + (isCorrect ? 'exp-ok' : 'exp-bad') + '">' +
            '<span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;">' +
            (isCorrect ? 'lightbulb' : 'info') + '</span> ' + escapeHtml(text) + '</div>');
    }
    if (q.hasExplanation && q.explanationText) {
        parts.push('<div class="result-explanation exp-info">' +
            '<span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;">menu_book</span> ' +
            (q.explanationTitle ? '<b>' + escapeHtml(q.explanationTitle) + ':</b> ' : '') +
            escapeHtml(q.explanationText) + '</div>');
    }
    return parts.join('');
}

function calculateResults() {
    stopTimer();
    stopHoldTimer();
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');
    var tc = document.getElementById('theme-complete-box');
    if (tc) tc.classList.add('hidden');

    const form = allForms[currentFormIndex];
    const settings = (form && form.settings) ? form.settings : {};
    // по умолчанию включено
    const showWrong = settings.showWrong !== false;
    const showCorrect = settings.showCorrect !== false;

    let score = 0;
    let maxPossibleScore = 0;
    let reviewHTML = '';

    form.questions.forEach((q, idx) => {
        const userAns = userAnswers[idx];

        if (q.type === 'flashcard' || q.type === 'info-slide') {
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

        if (q.type === 'radio' || q.type === 'select') {
            var ansNum = (userAns === '' || userAns === undefined || userAns === null) ? null : parseInt(userAns, 10);
            if (q.correctChoices && ansNum !== null && !isNaN(ansNum) && q.correctChoices.map(Number).includes(ansNum)) isCorrect = true;
        } else if (q.type === 'checkbox') {
            if (Array.isArray(userAns) && q.correctChoices &&
                userAns.length === q.correctChoices.length &&
                userAns.every(v => q.correctChoices.includes(v))) isCorrect = true;
        } else if (q.type === 'text') {
            if (q.correctText && q.correctText.some(t => t.toLowerCase().trim() === String(userAns || '').toLowerCase().trim())) isCorrect = true;
        } else if (q.type === 'puzzle-drag') {
            if (Array.isArray(userAns) && q.correctChoices && JSON.stringify(userAns) === JSON.stringify(q.correctChoices)) isCorrect = true;
        }

        const displayTitle = q.title.includes('[input]')
            ? q.title.replace('[input]', '<u>' + escapeHtml(String(userAns || '...')) + '</u>')
            : escapeHtml(q.title || '');

        var expHtml = getAnswerExplanationHtml(q, isCorrect, userAns);

        if (isCorrect) {
            score++;
            reviewHTML += `
                <div class="review-item correct-item">
                    <strong>${displayTitle}</strong>
                    <p class="text-success" style="font-size:13px; margin-top:4px;">✓ Верно</p>
                    ${showCorrect && q.type !== 'text' ? '' : ''}
                    ${expHtml}
                </div>
            `;
        } else {
            var shown = userAns;
            if (shown === undefined || shown === null || shown === '') shown = 'пусто';
            else if ((q.type === 'radio' || q.type === 'select') && q.options) {
                var n = parseInt(shown, 10);
                shown = (!isNaN(n) && q.options[n] != null) ? q.options[n] : shown;
            } else if (q.type === 'checkbox' && Array.isArray(shown) && q.options) {
                shown = shown.map(function(i) { return q.options[i]; }).filter(Boolean).join(', ') || 'пусто';
            } else if (q.type === 'puzzle-drag' && Array.isArray(shown) && q.options) {
                shown = shown.map(function(i) { return q.options[i]; }).filter(Boolean).join(' → ') || 'пусто';
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

    const mode = getFormMode(form);
    if (mode === 'flashcards') {
        reviewHTML = `
            <div class="review-item grey-item" style="text-align:center;">
                <strong>Статистика FlashCards</strong>
                <p style="margin-top:8px; font-size:15px;">
                    ✓ Знаю: <b>${flashcardStats.know}</b> &nbsp;&nbsp; ✗ Не знаю: <b>${flashcardStats.dontKnow}</b>
                </p>
            </div>
        ` + reviewHTML;
        document.getElementById('final-score').textContent = flashcardStats.know + ' / ' + form.questions.length;
    } else {
        document.getElementById('final-score').textContent = score + ' / ' + maxPossibleScore;
    }

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

    document.getElementById('review-box').innerHTML = emailBlock + reviewHTML;
}

function restartQuiz() { 
    userEmail = '';
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

function importFormFromJSON(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData && importedData.questions && Array.isArray(importedData.questions)) {
                allForms.push(importedData);
            } else if (Array.isArray(importedData)) {
                allForms.push(...importedData);
            } else {
                throw new Error('Файл не содержит корректных вопросов.');
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

function tryLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const storedAuth = JSON.parse(localStorage.getItem('admin_auth') || '{"u":"admin","p":"1234"}');

    if (u === storedAuth.u && p === storedAuth.p) {
        switchScreen('admin');
    } else {
        showAlert('Неверный логин или пароль!', 'lock');
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

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    
    document.getElementById('admin-choices-fields').classList.toggle('hidden', !['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type));
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text');
    document.getElementById('flashcard-answer-box').classList.toggle('hidden', type !== 'flashcard');
    document.getElementById('media-upload-box').classList.toggle('hidden', type !== 'info-slide');
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
    const title = document.getElementById('new-title').value.trim();
    const useInlineEl = document.getElementById('new-inline-input');
    const useInline = (type === 'text' && useInlineEl) ? useInlineEl.checked : false;

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
    } else if (type === 'text') {
        newQ.correctText = document.getElementById('new-correct-text').value.split(',').map(s => s.trim()).filter(Boolean);
        if (useInline) newQ.useInlineInput = true;
        if (document.getElementById('new-multiline-input')?.checked) newQ.multiline = true;
        if (document.getElementById('new-allow-format')?.checked) newQ.allowFormat = true;
        if (document.getElementById('new-side-notes')?.checked) newQ.sideNotes = true;
    } else if (type === 'flashcard') {
        newQ.flashcardAnswer = document.getElementById('new-flashcard-answer').value.trim();
    } else if (type === 'info-slide') {
        if (uploadedMediaBase64) {
            newQ.mediaUrl = uploadedMediaBase64;
        } else if (editingQuestionIndex !== null && form.questions[editingQuestionIndex].mediaUrl) {
            newQ.mediaUrl = form.questions[editingQuestionIndex].mediaUrl;
        }
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
        newQ.explanationTitle = document.getElementById('questionExplanationTitle').value.trim();
        newQ.explanationText = document.getElementById('questionExplanationText').value.trim();
        newQ.holdTimer = parseInt(document.getElementById('questionHoldTimer').value) || 0;
    }

    const hasAnsExp = document.getElementById('questionHasAnswerExplanations');
    if (hasAnsExp && hasAnsExp.checked) {
        newQ.hasAnswerExplanations = true;
        newQ.answerExpCorrect = document.getElementById('answerExpCorrect').value.trim();
        const rawIncorrect = document.getElementById('answerExpIncorrect').value.trim();
        const incorrectMap = {};
        if (rawIncorrect) {
            rawIncorrect.split('|').forEach(part => {
                const m = part.trim().match(/^(\d+)\s*[:\-]\s*(.+)$/);
                if (m) incorrectMap[parseInt(m[1])] = m[2].trim();
            });
        }
        newQ.answerExpIncorrect = incorrectMap;
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

function openFormSettings() {
    const form = allForms[currentFormIndex];
    if (!form.settings) form.settings = { isTestMode: false, publishType: 'immediate', defaultPoints: 10, showWrong: true, showCorrect: true, showPoints: true };
    
    document.getElementById('fs-test-mode').checked = !!form.settings.isTestMode;
    document.getElementById('fs-publish-type').value = form.settings.publishType || 'immediate';
    document.getElementById('fs-default-points').value = form.settings.defaultPoints || 10;
    document.getElementById('fs-show-wrong').checked = form.settings.showWrong !== false;
    document.getElementById('fs-show-correct').checked = form.settings.showCorrect !== false;
    document.getElementById('fs-show-points').checked = form.settings.showPoints !== false;
    var lockEl = document.getElementById('fs-lock-themes');
    if (lockEl) lockEl.checked = !!form.settings.lockNextThemes;
    var defReq = document.getElementById('fs-default-required');
    if (defReq) defReq.checked = !!form.settings.defaultRequired;
    
    toggleTestModeSettings();
    enhanceAllSelects(document.getElementById('form-settings-modal'));
    document.getElementById('form-settings-modal').classList.add('active');
}

function toggleTestModeSettings() {
    const isTest = document.getElementById('fs-test-mode').checked;
    document.getElementById('fs-test-settings').classList.toggle('hidden', !isTest);
}

function saveFormSettings() {
    var prev = allForms[currentFormIndex].settings || {};
    var lockEl = document.getElementById('fs-lock-themes');
    allForms[currentFormIndex].settings = Object.assign({}, prev, {
        isTestMode: document.getElementById('fs-test-mode').checked,
        publishType: document.getElementById('fs-publish-type').value,
        showWrong: document.getElementById('fs-show-wrong').checked,
        showCorrect: document.getElementById('fs-show-correct').checked,
        showPoints: document.getElementById('fs-show-points').checked,
        defaultPoints: parseInt(document.getElementById('fs-default-points').value) || 10,
        defaultRequired: document.getElementById('fs-default-required').checked,
        lockNextThemes: !!(lockEl && lockEl.checked)
    });
    saveFormsToStorage();
    document.getElementById('form-settings-modal').classList.remove('active');
    if (typeof renderThemeUI === 'function') renderThemeUI();
    showAlert('Настройки формы применены!', 'check_circle');
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
    } else if (q.type === 'info-slide' && q.mediaUrl) {
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
    document.getElementById('new-flashcard-answer').value = '';
    document.getElementById('new-hint-text').value = '';
    document.getElementById('new-required').checked = false;
    
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
            <div class="gcard" style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <strong>${idx + 1}. ${q.title}</strong>
                    ${q.description ? `<span style="font-size:12px; color:var(--text-muted); display:block; font-style: italic;">${q.description}</span>` : ''}
                    <span style="font-size:11px; color:var(--accent-color); display:block; margin-top:2px;">
                        Тип: ${q.type} ${q.useInlineInput ? '(Inline)' : ''} ${q.hasExplanation ? '(с Объяснением)' : ''}
                    </span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button onclick="moveQuestionUp(${idx})" class="q-action-btn" title="Переместить вверх" ${isFirst ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                        <span class="material-symbols-rounded" style="font-size:18px;">arrow_upward</span>
                    </button>
                    <button onclick="moveQuestionDown(${idx})" class="q-action-btn" title="Переместить вниз" ${isLast ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                        <span class="material-symbols-rounded" style="font-size:18px;">arrow_downward</span>
                    </button>
                    <button onclick="viewQuestionDetails(${idx})" class="q-action-btn" title="Просмотреть все данные">
                        <span class="material-symbols-rounded" style="font-size:16px;">visibility</span> Инфо
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
    if (modal) modal.classList.add('active');
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

    if (pass !== confirmPass) {
        showAlert('Пароли не совпадают!', 'warning');
        return;
    }

    localStorage.setItem('admin_auth', JSON.stringify({ u: login, p: pass }));
    closeAuthModal();
    showAlert('Логин и пароль администратора успешно изменены!', 'check_circle');
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
    if (expSel) expSel.value = String(shareState.expiryDays);

    updateShareLinkPreview();
    var modal = document.getElementById('share-modal');
    if (modal) modal.classList.add('active');
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
    const q = form.questions[currentRealQuestionIndex] || form.questions[currentQuestionIndex];
    const area = document.getElementById('answer-explanation-area');
    if (!area || !q || !q.hasAnswerExplanations) {
        if (area) area.innerHTML = '';
        return;
    }

    const isCorrect = q.correctChoices && q.correctChoices.includes(selectedIdx);
    let text = '';
    let isOk = false;

    if (isCorrect) {
        text = q.answerExpCorrect || 'Верно!';
        isOk = true;
    } else {
        const map = q.answerExpIncorrect || {};
        text = map[selectedIdx] || map[String(selectedIdx)] || 'Неверно.';
        isOk = false;
    }

    area.innerHTML = `
        <div class="explanation-card" style="border-color: ${isOk ? '#2e7d32' : '#d32f2f'}; background: ${isOk ? 'rgba(46,125,50,0.08)' : 'rgba(211,47,47,0.08)'};">
            <div class="explanation-title" style="color: ${isOk ? '#2e7d32' : '#d32f2f'};">
                <span class="material-symbols-rounded">${isOk ? 'check_circle' : 'cancel'}</span>
                ${isOk ? 'Верно' : 'Неверно'}
            </div>
            <div class="explanation-body">${text}</div>
        </div>
    `;
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
    if (!themesEnabled(form) || !currentThemeId) {
        return form.questions.map(function(q, idx) { return { q: q, idx: idx }; });
    }
    return getQuestionsForTheme(form, currentThemeId);
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
    var map = loadThemeProgress();
    map[themeProgressKey(formIndex, themeId)] = { done: true, ts: Date.now() };
    saveThemeProgress(map);
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
    var enabled = themesEnabled(form);
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
    userAnswers = {};
    isExplanationShowing = false;
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
    // options: [{value, label}] or string array
    var opts = (options || []).map(function(o, i) {
        if (o && typeof o === 'object') return { value: String(o.value), label: o.label };
        return { value: String(i), label: String(o) };
    });
    var sel = (selectedValue === undefined || selectedValue === null || selectedValue === '') ? '' : String(selectedValue);
    var selectedLabel = placeholder || '-- Выберите --';
    opts.forEach(function(o) { if (o.value === sel) selectedLabel = o.label; });
    var uid = 'cs-' + Date.now() + '-' + Math.floor(Math.random()*10000);
    var html = '<div class="cselect" id="'+uid+'" data-value="'+escapeHtml(sel)+'">' +
        '<button type="button" class="cselect-trigger" onclick="toggleCSelect(\''+uid+'\')">' +
        '<span class="cselect-label">'+escapeHtml(selectedLabel)+'</span>' +
        '<span class="material-symbols-rounded cselect-arrow">expand_more</span></button>' +
        '<div class="cselect-dropdown hidden">' +
        (placeholder ? '<div class="cselect-option cselect-placeholder" data-value="" onclick="pickCSelect(\''+uid+'\',\'\',\''+escapeHtml(placeholder).replace(/'/g,"\\'")+'\')">'+escapeHtml(placeholder)+'</div>' : '') +
        opts.map(function(o) {
            var act = o.value === sel ? ' active' : '';
            return '<div class="cselect-option'+act+'" data-value="'+escapeHtml(o.value)+'" onclick="pickCSelect(\''+uid+'\',\''+escapeHtml(o.value).replace(/'/g,"\\'")+'\',\''+escapeHtml(o.label).replace(/'/g,"\\'")+'\')">'+escapeHtml(o.label)+'</div>';
        }).join('') +
        '</div></div>';
    // store callback
    setTimeout(function() {
        var el = document.getElementById(uid);
        if (el) el._onChange = onChange;
    }, 0);
    return html;
}
function toggleCSelect(uid) {
    var el = document.getElementById(uid);
    if (!el) return;
    var dd = el.querySelector('.cselect-dropdown');
    var open = dd && !dd.classList.contains('hidden');
    document.querySelectorAll('.cselect-dropdown').forEach(function(d){ d.classList.add('hidden'); });
    document.querySelectorAll('.cselect').forEach(function(c){ c.classList.remove('open'); });
    if (!open && dd) {
        dd.classList.remove('hidden');
        el.classList.add('open');
    }
}
function pickCSelect(uid, value, label) {
    var el = document.getElementById(uid);
    if (!el) return;
    el.dataset.value = value;
    var lab = el.querySelector('.cselect-label');
    if (lab) lab.textContent = label || value || '--';
    el.querySelectorAll('.cselect-option').forEach(function(o){
        o.classList.toggle('active', o.getAttribute('data-value') === value);
    });
    var dd = el.querySelector('.cselect-dropdown');
    if (dd) dd.classList.add('hidden');
    el.classList.remove('open');
    if (typeof el._onChange === 'function') el._onChange(value);
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('.cselect')) {
        document.querySelectorAll('.cselect-dropdown').forEach(function(d){ d.classList.add('hidden'); });
        document.querySelectorAll('.cselect').forEach(function(c){ c.classList.remove('open'); });
    }
});

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
