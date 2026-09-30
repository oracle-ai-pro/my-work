/* ==========================================
   1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЯ
   ========================================== */
let allForms = [];
let currentFormIndex = 0;
let currentQuestionIndex = 0;
let userAnswers = {};
let timerInterval = null;
let currentTimerSeconds = 0;
let uploadedMediaBase64 = null;
let promptCallback = null;
let editingQuestionIndex = null; 

// Lite: без ИИ и Google API

const defaultForm = {
    title: "Тестовая форма",
    questions: [
        {
            type: "radio",
            title: "Какой язык используется для стилизации веб-страниц?",
            description: "Выберите один наиболее точный вариант из предложенных.",
            options: ["HTML", "CSS", "JavaScript", "Python"],
            correctChoices: [1],
            required: true
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
    initSettings();
    renderAllFormsUI();
    loadCurrentForm();
    checkOldDataMigration();
    initAiAndDbInputs();
});

function checkOldDataMigration() {
    const oldData = localStorage.getItem('forms') || localStorage.getItem('quiz_data_old');
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
                if (modal) modal.style.display = 'flex';
            }
        } catch (e) {
            console.error('Ошибка чтения старых данных:', e);
        }
    }
}

function performMigration() {
    try {
        const oldData = localStorage.getItem('forms') || localStorage.getItem('quiz_data_old');
        if (oldData) {
            const parsedForms = JSON.parse(oldData);
            let currentNewForms = JSON.parse(localStorage.getItem('my_forms_data') || '[]');
            const mergedForms = [...currentNewForms, ...parsedForms];
            
            localStorage.setItem('my_forms_data', JSON.stringify(mergedForms));
            localStorage.setItem('is_migrated_to_new', 'true');
            
            closeMigrationModal();
            showAlert('Формы успешно перенесены в новую версию!', 'check_circle');
            location.reload();
        }
    } catch (e) {
        alert('Ошибка при импорте: ' + e.message);
    }
}

function closeMigrationModal() {
    const modal = document.getElementById('migrationModal');
    if (modal) modal.style.display = 'none';
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
   3. НАСТРОЙКИ, ИИ И РЕЖИМЫ (ДИАЛОГ И ФОРМЫ)
   ========================================== */
function initSettings() {
    const savedTheme = localStorage.getItem('app_theme') || 'light';
    setTheme(savedTheme, false);
    setRadiusLite(localStorage.getItem('app_radius_lite') || 'rounded');

    const isCompact = localStorage.getItem('compact_forms_mode') === 'true';
    const toggleInput = document.getElementById('toggle-compact-forms');
    if (toggleInput) toggleInput.checked = isCompact;
    applyFormsLayout(isCompact);
}

function initAiAndDbInputs() { /* Lite: нет API */ }

function saveAiAndDbSettings() { showAlert('В Lite нет API-настроек', 'info'); }

function setRadiusLite(name) {
    document.body.setAttribute('data-radius', name || 'rounded');
    localStorage.setItem('app_radius_lite', name || 'rounded');
}
function setTheme(themeName, save = true) {
    if (themeName === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    if (save) localStorage.setItem('app_theme', themeName);
}

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('active');
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
}

function openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('active');
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('active');
}

function setLanguage(lang) {
    if (typeof translations !== 'undefined' && translations[lang]) {
        currentLang = lang;
        localStorage.setItem('app_language', lang);
        localStorage.setItem('app_language_user_set', '1');
        if (typeof applyTranslations === 'function') applyTranslations();
        closeLanguageModal();
    }
}

function openLanguageModal() {
    const modal = document.getElementById('language-modal');
    if (modal) modal.classList.add('active');
}

function closeLanguageModal() {
    const modal = document.getElementById('language-modal');
    if (modal) modal.classList.remove('active');
}

/* МОДАЛЬНОЕ ОКНО ИИ И ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ */
function openAiModal() { showAlert("В My Form Lite нет ИИ", "info"); }


function closeAiModal() { showAlert("В My Form Lite нет ИИ", "info"); }


function switchAiMode() { showAlert("В My Form Lite нет ИИ", "info"); }


/* ИИ ИНТЕГРАЦИЯ: РЕЖИМ СОЗДАНИЯ ВОПРОСОВ И РЕЖИМ ДИАЛОГА */
function generateAiQuestions() { showAlert("В My Form Lite нет ИИ", "info"); }


/* РЕЖИМ ДИАЛОГА (ЧАТ С ИИ) */
function sendAiChatMessage() { showAlert("В My Form Lite нет ИИ", "info"); }


function toggleFormsLayout(isCompact) {
    localStorage.setItem('compact_forms_mode', isCompact);
    applyFormsLayout(isCompact);
}

function applyFormsLayout(isCompact) {
    const selectEl = document.getElementById('forms-tabs-select');
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

function switchFormFromSelect(index) {
    switchForm(index);
}

/* ==========================================
   4. РЕНДЕР ВКЛАДОК И ВЫБОР ФОРМ
   ========================================== */
function renderAllFormsUI() {
    const selectEl = document.getElementById('forms-tabs-select');
    const listEl = document.getElementById('forms-tabs-list');

    if (selectEl) selectEl.innerHTML = '';
    if (listEl) listEl.innerHTML = '';

    allForms.forEach((form, index) => {
        const formTitle = form.title || `Форма №${index + 1}`;

        if (selectEl) {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = formTitle;
            if (index === currentFormIndex) opt.selected = true;
            selectEl.appendChild(opt);
        }

        if (listEl) {
            const tab = document.createElement('div');
            tab.className = `form-tab ${index === currentFormIndex ? 'active-tab' : ''}`;
            
            tab.innerHTML = `
                <span class="tab-title">${formTitle}</span>
                <button class="edit-tab-btn" onclick="renameForm(${index}, event)" title="Переименовать форму">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button class="delete-tab-btn" onclick="deleteForm(${index}, event)" title="Удалить форму">
                    <span class="material-symbols-rounded">close</span>
                </button>
            `;

            tab.onclick = () => switchForm(index);
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
   5. ДВИЖОК ТЕСТИРОВАНИЯ И БОНУСНЫЙ РАСЧЕТ
   ========================================== */
function loadCurrentForm() {
    currentQuestionIndex = 0;
    userAnswers = {};
    
    document.getElementById('quiz-screen')?.classList.remove('hidden');
    document.getElementById('quiz-box')?.classList.remove('hidden');
    document.getElementById('result-box')?.classList.add('hidden');
    document.getElementById('admin-screen')?.classList.add('hidden');
    
    closeLoginModal();

    renderQuestion();
}

function renderQuestion() {
    stopTimer();
    const form = allForms[currentFormIndex];
    if (!form || !form.questions || form.questions.length === 0) {
        document.getElementById('question-body').innerHTML = '<p style="text-align:center; color:var(--text-muted);">В этой форме пока нет вопросов. Войдите в панель администратора.</p>';
        document.getElementById('current-number').textContent = '0';
        document.getElementById('total-number').textContent = '0';
        document.getElementById('progress').style.width = '0%';
        document.getElementById('next-btn').classList.add('hidden');
        return;
    }

    document.getElementById('next-btn').classList.remove('hidden');
    const q = form.questions[currentQuestionIndex];
    
    document.getElementById('current-number').textContent = currentQuestionIndex + 1;
    document.getElementById('total-number').textContent = form.questions.length;
    const progressPercent = ((currentQuestionIndex + 1) / form.questions.length) * 100;
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
    const savedVal = userAnswers[currentQuestionIndex] !== undefined ? userAnswers[currentQuestionIndex] : '';
    
    if (q.type === 'text' && q.useInlineInput && q.title.includes('[input]')) {
        const inputHTML = `<input type="text" class="inline-quiz-input" value="${savedVal}" placeholder="..." oninput="saveAnswer(this.value.trim())">`;
        const formattedTitle = q.title.replace('[input]', inputHTML);
        
        body.innerHTML = `<h3 style="margin-bottom: ${q.description ? '6px' : '15px'}; font-weight:600; line-height: 1.6;">${formattedTitle}</h3>`;
        if (q.description) {
            body.innerHTML += `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 18px; line-height: 1.4;">${q.description}</p>`;
        }
    } else {
        body.innerHTML = `<h3 style="margin-bottom: ${q.description ? '6px' : '15px'}; font-weight:600;">${q.title}</h3>`;
        if (q.description) {
            body.innerHTML += `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 18px; line-height: 1.4;">${q.description}</p>`;
        }
    }

    switch (q.type) {
        case 'true-false':
            var tfOpts = q.options && q.options.length ? q.options : ['Верно', 'Неверно'];
            tfOpts.forEach(function(opt, i) {
                var checked = (savedVal !== '' && savedVal !== undefined && Number(savedVal) === i) ? 'checked' : '';
                body.innerHTML += '<label class="option"><input type="radio" name="q_opt" value="' + i + '" ' + checked + ' onchange="saveAnswer(parseInt(this.value,10))"> ' + opt + '</label>';
            });
            break;
        case 'radio':
            q.options.forEach((opt, idx) => {
                body.innerHTML += `
                    <label class="option">
                        <input type="radio" name="q_opt" value="${idx}" ${savedVal === idx ? 'checked' : ''} onchange="saveAnswer(${idx})">
                        <span>${opt}</span>
                    </label>
                `;
            });
            break;

        case 'select':
            let selectOptions = (q.options || []).map((opt, idx) => 
                `<option value="${idx}" ${savedVal === idx ? 'selected' : ''}>${opt}</option>`
            ).join('');
            body.innerHTML += `
                <select class="admin-input" style="margin-top: 10px; font-size:15px;" onchange="saveAnswer(parseInt(this.value))">
                    <option value="" disabled ${savedVal === '' ? 'selected' : ''}>-- Выберите вариант из списка --</option>
                    ${selectOptions}
                </select>
            `;
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
                body.innerHTML += `
                    <input type="text" class="admin-input" value="${savedVal}" placeholder="Введите ваш ответ..." oninput="saveAnswer(this.value.trim())">
                `;
            }
            break;

        
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
                        <span class="material-symbols-rounded" style="color:var(--text-muted);">drag_indicator</span>
                        <span>${q.options[idx]}</span>
                    </div>
                `;
            });
            savePuzzleAnswer();
            initPuzzleEvents();
            break;

        case 'info-slide':
            if (q.mediaUrl) {
                body.innerHTML += `<div style="text-align:center; margin-bottom:15px;"><img src="${q.mediaUrl}" style="max-width:100%; border-radius:12px;"></div>`;
            }
            saveAnswer('viewed');
            break;

        default:
            body.innerHTML += `<p style="color:var(--text-muted);">Тип вопроса поддерживается в упрощенном режиме.</p>`;
            saveAnswer('viewed');
    }
}

function saveAnswer(val) { userAnswers[currentQuestionIndex] = val; }

function saveCheckboxAnswer() {
    const checked = Array.from(document.querySelectorAll('input[name="q_opt"]:checked')).map(el => parseInt(el.value));
    userAnswers[currentQuestionIndex] = checked;
}

function savePuzzleAnswer() {
    const items = Array.from(document.querySelectorAll('.puzzle-item')).map(el => parseInt(el.getAttribute('data-idx')));
    userAnswers[currentQuestionIndex] = items;
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

function nextStep() {
    const form = allForms[currentFormIndex];
    const q = form.questions[currentQuestionIndex];

    if (q.required && (userAnswers[currentQuestionIndex] === undefined || userAnswers[currentQuestionIndex] === '')) {
        showAlert('Пожалуйста, ответьте на обязательный вопрос!', 'warning');
        return;
    }

    // Learn: один раз показать верно/неверно, потом дальше
    if ((form.mode === 'learn' || (form.settings && form.settings.learnMode)) && !q._liteLearnShown
        && q.type !== 'flashcard' && q.type !== 'info-slide') {
        q._liteLearnShown = true;
        var ok = isAnswerCorrectLite(q, userAnswers[currentQuestionIndex]);
        showAlert(ok ? 'Верно!' : 'Неверно. Можно смотреть правильный ответ в конце (если включено).', ok ? 'check_circle' : 'cancel');
        return;
    }

    if (currentQuestionIndex < form.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        calculateResults();
    }
}

function isAnswerCorrectLite(q, userAns) {
    if (!q) return false;
    if (q.type === 'radio' || q.type === 'select' || q.type === 'true-false') {
        return !!(q.correctChoices && q.correctChoices.map(Number).includes(Number(userAns)));
    }
    if (q.type === 'checkbox' && Array.isArray(userAns) && q.correctChoices) {
        var a = userAns.map(Number).slice().sort(), b = q.correctChoices.map(Number).slice().sort();
        return a.length === b.length && a.every(function(v, i) { return v === b[i]; });
    }
    if (q.type === 'text' && q.correctText) {
        return q.correctText.some(function(t) { return String(t).toLowerCase().trim() === String(userAns || '').toLowerCase().trim(); });
    }
    if (q.type === 'fill-blank') {
        return isFillBlankCorrect(q, userAns);
    }
    if (q.type === 'puzzle-drag' && Array.isArray(userAns) && q.correctChoices) {
        return JSON.stringify(userAns) === JSON.stringify(q.correctChoices);
    }
    return false;
}

/* РАСЧЕТ РЕЗУЛЬТАТОВ И БОНУСНОЙ СИСТЕМЫ */
function calculateResults() {
    stopTimer();
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');

    const form = allForms[currentFormIndex];
    let score = 0;
    let maxPossibleScore = 0;
    let reviewHTML = '';

    form.questions.forEach((q, idx) => {
        const userAns = userAnswers[idx];

        if (q.type === 'flashcard' || q.type === 'info-slide') {
            reviewHTML += `
                <div class="review-item grey-item">
                    <strong>${q.title}</strong>
                    <p style="color:var(--text-muted); font-size:13px; margin-top:4px;">
                        Материал изучен ${q.flashcardAnswer ? `(Оборот: ${q.flashcardAnswer})` : ''}
                    </p>
                </div>
            `;
            return;
        }

        maxPossibleScore++;
        let isCorrect = false;

        if (q.type === 'radio' || q.type === 'select' || q.type === 'true-false') {
            if (q.correctChoices && q.correctChoices.map(Number).includes(Number(userAns))) isCorrect = true;
        } else if (q.type === 'checkbox') {
            if (Array.isArray(userAns) && q.correctChoices &&
                userAns.length === q.correctChoices.length &&
                userAns.every(v => q.correctChoices.includes(v))) isCorrect = true;
        } else if (q.type === 'text') {
            if (q.correctText && q.correctText.some(t => t.toLowerCase().trim() === String(userAns || '').toLowerCase().trim())) isCorrect = true;
        } else if (q.type === 'fill-blank') {
            if (isFillBlankCorrect(q, userAns)) isCorrect = true;
        } else if (q.type === 'puzzle-drag') {
            if (Array.isArray(userAns) && q.correctChoices && JSON.stringify(userAns) === JSON.stringify(q.correctChoices)) isCorrect = true;
        }

        if (isCorrect) {
            score++;
            reviewHTML += `
                <div class="review-item correct-item">
                    <strong>${q.title.replace('[input]', `<u>${userAns || '...'}</u>`)}</strong>
                    <p class="text-success" style="font-size:13px; margin-top:4px;">✓ Верно</p>
                </div>
            `;
        } else {
            reviewHTML += `
                <div class="review-item incorrect-item">
                    <strong>${q.title.replace('[input]', `<u>${userAns || '...'}</u>`)}</strong>
                    <p class="text-danger" style="font-size:13px; margin-top:4px;">✗ Неверно (Ваш ответ: "${userAns || 'пусто'}")</p>
                </div>
            `;
        }
    });

    let bonusGranted = 0;
    if (score > 0) {
        if (score <= 10) {
            bonusGranted = 15;
        } else if (score <= 30) {
            bonusGranted = 30;
        } else if (score <= 70) {
            bonusGranted = 60;
        } else {
            bonusGranted = 120;
        }
    }

    document.getElementById('final-score').textContent = `${score} / ${maxPossibleScore}`;
    const bonusEl = document.getElementById('bonus-text');
    if (bonusEl) bonusEl.textContent = `Начислено бонусов: ${bonusGranted} из 120`;
    reviewHTML += '<button type="button" class="btn" style="width:100%;margin-top:12px;background:transparent;color:var(--text-color);border:1px solid var(--border-color);" onclick="exportStudentResultsJSON()">Скачать ответы (.json)</button>';
    document.getElementById('review-box').innerHTML = reviewHTML;
}

function restartQuiz() { loadCurrentForm(); }

function startTimer(seconds) {
    currentTimerSeconds = seconds;
    document.getElementById('timer-seconds').textContent = currentTimerSeconds;
    timerInterval = setInterval(() => {
        currentTimerSeconds--;
        document.getElementById('timer-seconds').textContent = currentTimerSeconds;
        if (currentTimerSeconds <= 0) {
            stopTimer();
            nextStep();
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
            
            if (isStudentResultsPayload(importedData)) {
                openStudentResultsReviewLite(importedData, file.name);
                input.value = '';
                return;
            }
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
   7. ПАНЕЛЬ АДМИНИСТРАТОРА И АВТОРИЗАЦИЯ
   ========================================== */
function switchScreen(screen) {
    if (screen === 'login') {
        openLoginModal();
    } else if (screen === 'admin') {
        closeLoginModal();
        document.getElementById('quiz-screen')?.classList.add('hidden');
        document.getElementById('admin-screen')?.classList.remove('hidden');
        renderAdminQuestionsList();
    }
}

function tryLogin() {
    const u = (document.getElementById('login-user').value || '').trim();
    const p = (document.getElementById('login-pass').value || '').trim();
    var form = allForms[currentFormIndex] || {};
    var auth = form.adminAuth || { login: 'admin', pass: '1234' };
    if (u === (auth.login || 'admin') && p === (auth.pass || '1234')) {
        if (typeof switchScreen === 'function') switchScreen('admin');
        else {
            document.getElementById('quiz-screen')?.classList.add('hidden');
            document.getElementById('admin-screen')?.classList.remove('hidden');
            renderAdminQuestionsList();
        }
        closeLoginModal();
    } else {
        showAlert('Неверный логин или пароль!', 'lock');
    }
}

function logout() { loadCurrentForm(); }

function toggleAddQuestionForm_applyDefaultRequired() {
    var form = allForms[currentFormIndex];
    var el = document.getElementById('new-required');
    if (el && form && form.settings && form.settings.defaultRequired && editingQuestionIndex === null) {
        el.checked = true;
    }
}
function toggleAddQuestionForm() {
    const formEl = document.getElementById('admin-add-form');
    if (formEl.classList.contains('hidden')) {
        cancelEditQuestion();
        formEl.classList.remove('hidden');
        try { toggleAddQuestionForm_applyDefaultRequired(); } catch (e) {}
    } else {
        formEl.classList.add('hidden');
    }
}


/* ===== Fill-blank (пропуски) ===== */
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function parseFillBlankTemplate(text) {
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
    if (!text.trim()) { prev.innerHTML = ''; return; }
    var html = escapeHtml(text).replace(/\[([^\]]+)\]/g, function(_, inner) {
        return '<span class="fb-tag">' + escapeHtml(inner) + '</span>';
    });
    prev.innerHTML = '<div style="margin-bottom:4px;font-size:11px;font-weight:700;color:var(--text-muted);">Превью · пропусков: ' + blanks.length + '</div>' + html;
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


function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    
    document.getElementById('admin-choices-fields').classList.toggle('hidden', !['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type));
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text');
    var tf = document.getElementById('admin-truefalse-fields');
    if (tf) tf.classList.toggle('hidden', type !== 'true-false');
    var fb = document.getElementById('admin-fillblank-fields');
    if (fb) fb.classList.toggle('hidden', type !== 'fill-blank');
    if (type === 'fill-blank') {
        try { updateFillBlankAdminPreview(); } catch (e) {}
        var titleLab = document.querySelector('label[for="new-title"]');
        if (titleLab) titleLab.textContent = 'Заголовок (необязательно):';
        var ti = document.getElementById('new-title');
        if (ti) ti.placeholder = 'Заголовок (необязательно)...';
    } else {
        var titleLab2 = document.querySelector('label[for="new-title"]');
        if (titleLab2) titleLab2.textContent = 'Заголовок вопроса:';
        var ti2 = document.getElementById('new-title');
        if (ti2 && ti2.placeholder.indexOf('необязательно') >= 0) ti2.placeholder = 'Введите заголовок...';
    }
    
    const inlineBox = document.getElementById('inline-input-box');
    if (inlineBox) {
        inlineBox.classList.toggle('hidden', type !== 'text');
    }

    document.getElementById('flashcard-answer-box').classList.toggle('hidden', type !== 'flashcard');
    document.getElementById('media-upload-box').classList.toggle('hidden', type !== 'info-slide');
}

function toggleExplanationFields(checkbox) {
    const container = document.getElementById('explanationFieldsContainer');
    if (container) {
        container.style.display = checkbox.checked ? 'block' : 'none';
    }
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

    const newQ = {
        type: type,
        title: title,
        required: document.getElementById('new-required').checked || !!(allForms[currentFormIndex] && allForms[currentFormIndex].settings && allForms[currentFormIndex].settings.defaultRequired)
    };

    if (description) newQ.description = description;

    if (type === 'true-false') {
        newQ.options = ['Верно', 'Неверно'];
        var tfEl = document.getElementById('new-tf-correct');
        newQ.correctChoices = [parseInt(tfEl ? tfEl.value : '0', 10) || 0];
    } else if (['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type)) {
        const opts = document.getElementById('new-options').value.split(',').map(s => s.trim()).filter(Boolean);
        const correct = document.getElementById('new-correct-choices').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        newQ.options = opts;
        newQ.correctChoices = correct;
    } else if (type === 'text') {
        newQ.correctText = document.getElementById('new-correct-text').value.split(',').map(s => s.trim()).filter(Boolean);
        if (useInline) newQ.useInlineInput = true;
    } else if (type === 'fill-blank') {
        var fbText = ((document.getElementById('new-fillblank-text') || {}).value || '').trim();
        if (!fbText) { showAlert('Введите текст с пропусками [ответ]', 'warning'); return; }
        var blanks = parseFillBlankTemplate(fbText);
        if (!blanks.length) { showAlert('Добавьте хотя бы один пропуск: [правильный ответ]', 'warning'); return; }
        var heading = ((document.getElementById('new-title') || {}).value || '').trim();
        newQ.fillBlankTemplate = fbText;
        newQ.title = heading || (fbText.length > 60 ? fbText.slice(0, 57) + '…' : fbText);
        newQ.blanks = blanks.map(function(b) { return b.answers; });
        newQ.fbCaseSensitive = !!(document.getElementById('fb-case-sensitive') && document.getElementById('fb-case-sensitive').checked);
        newQ.fbTrimSpaces = !(document.getElementById('fb-trim-spaces') && !document.getElementById('fb-trim-spaces').checked);
        newQ.fbAcceptAlts = !(document.getElementById('fb-accept-alts') && !document.getElementById('fb-accept-alts').checked);
    } else if (type === 'flashcard') {
        newQ.flashcardAnswer = document.getElementById('new-flashcard-answer').value.trim();
    } else if (type === 'info-slide') {
        if (uploadedMediaBase64) {
            newQ.mediaUrl = uploadedMediaBase64;
        } else if (editingQuestionIndex !== null && form.questions[editingQuestionIndex].mediaUrl) {
            newQ.mediaUrl = form.questions[editingQuestionIndex].mediaUrl;
        }
    }

    // Сохранение Объяснений
    const expCheck = document.getElementById('questionHasExplanation');
    if (expCheck && expCheck.checked) {
        newQ.explanation = {
            title: document.getElementById('questionExplanationTitle').value.trim(),
            text: document.getElementById('questionExplanationText').value.trim(),
            holdTimer: parseInt(document.getElementById('questionHoldTimer').value) || 0
        };
    }

    if (document.getElementById('toggle-hint-input').checked) {
        newQ.hintText = document.getElementById('new-hint-text').value.trim();
    }
    if (document.getElementById('toggle-timer-input').checked) {
        newQ.timer = parseInt(document.getElementById('new-timer').value) || 20;
    }

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

    if (q.type === 'true-false') {
        var tf = document.getElementById('new-tf-correct');
        if (tf) tf.value = String((q.correctChoices && q.correctChoices[0] != null) ? q.correctChoices[0] : 0);
    } else if (['radio', 'checkbox', 'select', 'puzzle-drag'].includes(q.type)) {
        document.getElementById('new-options').value = (q.options || []).join(', ');
        document.getElementById('new-correct-choices').value = (q.correctChoices || []).join(', ');
    } else if (q.type === 'text') {
        document.getElementById('new-correct-text').value = (q.correctText || []).join(', ');
        const inlineCheck = document.getElementById('new-inline-input');
        if (inlineCheck) inlineCheck.checked = !!q.useInlineInput;
    } else if (q.type === 'flashcard') {
        document.getElementById('new-flashcard-answer').value = q.flashcardAnswer || '';
    }
    if (q.type === 'fill-blank') {
        var fbt = document.getElementById('new-fillblank-text');
        if (fbt) fbt.value = q.fillBlankTemplate || q.title || '';
        var cs = document.getElementById('fb-case-sensitive');
        if (cs) cs.checked = !!q.fbCaseSensitive;
        var tr = document.getElementById('fb-trim-spaces');
        if (tr) tr.checked = q.fbTrimSpaces !== false;
        var aa = document.getElementById('fb-accept-alts');
        if (aa) aa.checked = q.fbAcceptAlts !== false;
        updateFillBlankAdminPreview();
    
    }

    // Редактирование объяснений
    const expCheck = document.getElementById('questionHasExplanation');
    if (expCheck) {
        if (q.explanation) {
            expCheck.checked = true;
            toggleExplanationFields(expCheck);
            document.getElementById('questionExplanationTitle').value = q.explanation.title || '';
            document.getElementById('questionExplanationText').value = q.explanation.text || '';
            document.getElementById('questionHoldTimer').value = q.explanation.holdTimer || 0;
        } else {
            expCheck.checked = false;
            toggleExplanationFields(expCheck);
        }
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
    var fbc = document.getElementById('new-fillblank-text');
    if (fbc) fbc.value = '';
    var fbp = document.getElementById('fillblank-preview');
    if (fbp) fbp.innerHTML = '';

    // Сброс полей объяснения
    const expCheck = document.getElementById('questionHasExplanation');
    if (expCheck) {
        expCheck.checked = false;
        toggleExplanationFields(expCheck);
    }
    document.getElementById('questionExplanationTitle').value = '';
    document.getElementById('questionExplanationText').value = '';
    document.getElementById('questionHoldTimer').value = '0';
    
    const inlineCheck = document.getElementById('new-inline-input');
    if (inlineCheck) inlineCheck.checked = false;

    document.getElementById('toggle-timer-input').checked = false;
    document.getElementById('timer-config').classList.add('hidden');
    document.getElementById('toggle-hint-input').checked = false;
    document.getElementById('hint-config').classList.add('hidden');
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

    if (q.explanation) {
        html += `
            <div class="detail-row" style="background:var(--border-color); padding:8px; border-radius:6px; margin-top:8px;">
                <strong>Объяснение:</strong> ${q.explanation.title ? `<i>(${q.explanation.title})</i>` : ''}
                <div style="margin-top:4px; font-size:13px;">${q.explanation.text || 'Без текста'}</div>
                ${q.explanation.holdTimer > 0 ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">⏱️ Задержка кнопки: ${q.explanation.holdTimer} сек.</div>` : ''}
            </div>
        `;
    }

    if (q.timer) {
        html += `<div class="detail-row"><strong>Таймер:</strong> ⏱️ ${q.timer} секунд</div>`;
    }
    if (q.hintText) {
        html += `<div class="detail-row"><strong>Подсказка:</strong> 💡 ${q.hintText}</div>`;
    }
    if (q.mediaUrl) {
        html += `<div class="detail-row"><strong>Прикреплённое медиа:</strong> <br><img src="${q.mediaUrl}" style="max-width:100%; border-radius:8px; margin-top:6px;"></div>`;
    }

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

    list.innerHTML = `<h3>Вопросы формы "${form.title}" (${form.questions.length}):</h3>`;

    form.questions.forEach((q, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === form.questions.length - 1;

        list.innerHTML += `
            <div class="gcard" style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <strong>${idx + 1}. ${q.title}</strong>
                    ${q.description ? `<span style="font-size:12px; color:var(--text-muted); display:block; font-style: italic;">${q.description}</span>` : ''}
                    <span style="font-size:11px; color:var(--accent-color); display:block; margin-top:2px;">Тип: ${q.type} ${q.useInlineInput ? '(Inline Input)' : ''}</span>
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
    if (idx === 0) return; 
    const form = allForms[currentFormIndex];
    const temp = form.questions[idx - 1];
    form.questions[idx - 1] = form.questions[idx];
    form.questions[idx] = temp;
    saveFormsToStorage();
    renderAdminQuestionsList();
}

function moveQuestionDown(idx) {
    const form = allForms[currentFormIndex];
    if (idx === form.questions.length - 1) return; 
    const temp = form.questions[idx + 1];
    form.questions[idx + 1] = form.questions[idx];
    form.questions[idx] = temp;
    saveFormsToStorage();
    renderAdminQuestionsList();
}

function deleteQuestion(idx) {
    showConfirm("Удалить вопрос?", "Вы уверены, что хотите удалить этот вопрос?", () => {
        allForms[currentFormIndex].questions.splice(idx, 1);
        saveFormsToStorage();
        renderAdminQuestionsList();
        showAlert('Вопрос успешно удален!', 'delete');
    });
}

function handleMediaUploadPreview(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedMediaBase64 = e.target.result;
            document.getElementById('media-preview-container').innerHTML = `<img src="${uploadedMediaBase64}" style="max-width:100px; margin-top:10px; border-radius:8px;">`;
        };
        reader.readAsDataURL(file);
    }
}

/* ==========================================
   8. ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ И ПЕЧАТЬ
   ========================================== */
function generateShareLink() {
    navigator.clipboard.writeText(window.location.href);
    showAlert('Ссылка скопирована. Расширенный «Поделиться» — только в полной My Form.', 'link');
}

function printCurrentForm() {
    const form = allForms[currentFormIndex];
    
    if (!form || !form.questions || form.questions.length === 0) {
        showAlert('В этой форме нет вопросов для печати!', 'warning');
        return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showAlert('Разрешите всплывающие окна в браузере для печати', 'error');
        return;
    }

    let questionsHtml = '';

    form.questions.forEach((q, idx) => {
        questionsHtml += `<div class="question-block">`;

        if (q.type === 'text' && q.useInlineInput && q.title.includes('[input]')) {
            const printTitle = q.title.replace('[input]', '____________________');
            questionsHtml += `<div class="question-title"><strong>${idx + 1}. ${printTitle}</strong></div>`;
        } else {
            questionsHtml += `<div class="question-title"><strong>${idx + 1}. ${q.title}</strong></div>`;
        }

        if (q.description) {
            questionsHtml += `<div style="font-size: 13px; color: #555; margin-bottom: 8px; font-style: italic;">${q.description}</div>`;
        }

        if (['radio', 'select'].includes(q.type)) {
            if (q.options && q.options.length > 0) {
                questionsHtml += `<div class="options-group">`;
                q.options.forEach(opt => {
                    questionsHtml += `
                        <div class="option-item">
                            <span class="radio-circle"></span>
                            <span>${opt}</span>
                        </div>
                    `;
                });
                questionsHtml += `</div>`;
            }
        } 
        else if (q.type === 'checkbox') {
            if (q.options && q.options.length > 0) {
                questionsHtml += `<div class="options-group">`;
                q.options.forEach(opt => {
                    questionsHtml += `
                        <div class="option-item">
                            <span class="checkbox-square"></span>
                            <span>${opt}</span>
                        </div>
                    `;
                });
                questionsHtml += `</div>`;
            }
        } 
        else if (q.type === 'text' && (!q.useInlineInput || !q.title.includes('[input]'))) {
            questionsHtml += `
                <div class="text-answer-line">
                    Ответ: __________________________________________________________________________________
                </div>
            `;
        } 
        else if (q.type === 'puzzle-drag') {
            questionsHtml += `<div style="font-size: 13px; color: #555; margin-bottom: 6px;">Укажите правильный порядок цифрами в скобках:</div>`;
            if (q.options && q.options.length > 0) {
                questionsHtml += `<div class="options-group">`;
                q.options.forEach(opt => {
                    questionsHtml += `
                        <div class="option-item">
                            <span style="font-family: monospace; font-size: 14px;">[ &nbsp; ]</span>
                            <span>${opt}</span>
                        </div>
                    `;
                });
                questionsHtml += `</div>`;
            }
        } 
        else if (q.type === 'flashcard' || q.type === 'info-slide') {
            if (q.mediaUrl) {
                questionsHtml += `<div style="margin: 8px 0;"><img src="${q.mediaUrl}" style="max-height: 180px; border-radius: 4px;"></div>`;
            }
            questionsHtml += `
                <div class="text-answer-line">
                    Заметки / Ответ: _________________________________________________________________________
                </div>
            `;
        }

        questionsHtml += `</div>`;
    });

    const printContent = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>Печать: ${form.title || 'Форма'}</title>
            <style>
                @page { size: A4; margin: 15mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; line-height: 1.5; margin: 0; padding: 10px; }
                .header-sheet { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 25px; }
                .header-sheet h1 { margin: 0 0 15px 0; font-size: 22px; text-align: center; }
                .student-info { display: flex; justify-content: space-between; font-size: 14px; font-weight: 500; }
                .question-block { margin-bottom: 22px; page-break-inside: avoid; }
                .question-title { font-size: 15px; margin-bottom: 8px; }
                .options-group { margin-left: 10px; display: flex; flex-direction: column; gap: 6px; }
                .option-item { font-size: 14px; display: flex; align-items: center; gap: 10px; }
                .radio-circle { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #000; border-radius: 50%; flex-shrink: 0; }
                .checkbox-square { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #000; border-radius: 2px; flex-shrink: 0; }
                .text-answer-line { margin-top: 8px; font-size: 14px; color: #333; word-break: break-all; }
            </style>
        </head>
        <body>
            <div class="header-sheet">
                <h1>${form.title || 'Тестовая форма'}</h1>
                <div class="student-info">
                    <span>Имя: ________________________________</span>
                    <span>Дата: _______________</span>
                </div>
            </div>

            ${questionsHtml}

            <script>
                window.onload = function() { window.print(); };
            </script>
        </body>
        </html>
    `;

    printWin.document.open();
    printWin.document.write(printContent);
    printWin.document.close();
}

/* ===== Lite: результаты ученика + настройки формы ===== */
function isStudentResultsPayload(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.kind === 'myform-student-results' || data.type === 'student-results') return true;
    if (data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers) && !Array.isArray(data.questions)) return true;
    return false;
}

function triggerStudentResultsImport() {
    var el = document.getElementById('import-file');
    if (el) { el.value = ''; el.click(); }
}

function exportStudentResultsJSON() {
    var form = allForms[currentFormIndex];
    if (!form) return showAlert('Нет формы', 'error');
    var scoreEl = document.getElementById('final-score');
    var payload = {
        kind: 'myform-student-results',
        version: 1,
        exportedAt: new Date().toISOString(),
        formTitle: form.title || 'Форма',
        answers: userAnswers || {},
        scoreText: scoreEl ? scoreEl.textContent : '',
        snapshot: {
            questions: (form.questions || []).map(function(q) {
                return {
                    type: q.type, title: q.title, options: q.options,
                    correctChoices: q.correctChoices, correctText: q.correctText,
                    flashcardAnswer: q.flashcardAnswer
                };
            })
        }
    };
    var a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    a.download = ((form.title || 'results').replace(/[^\wа-яА-ЯёЁ\- ]+/g, '') || 'results') + '_answers.json';
    document.body.appendChild(a); a.click(); a.remove();
    showAlert('Ответы сохранены в JSON', 'check_circle');
}

function openStudentResultsReviewLite(data, fileName) {
    var answers = data.answers || {};
    var questions = (data.snapshot && data.snapshot.questions) || (allForms[currentFormIndex] && allForms[currentFormIndex].questions) || [];
    var score = 0, max = 0, rows = '';
    questions.forEach(function(q, idx) {
        var userAns = answers[idx] !== undefined ? answers[idx] : answers[String(idx)];
        if (q.type === 'flashcard' || q.type === 'info-slide') {
            rows += '<div class="review-item grey-item"><strong>' + (q.title || '') + '</strong><p style="font-size:13px;color:var(--text-muted);">Без оценки</p></div>';
            return;
        }
        max++;
        var ok = false;
        if (q.type === 'radio' || q.type === 'select' || q.type === 'true-false') {
            if (q.correctChoices && q.correctChoices.map(Number).includes(parseInt(userAns, 10))) ok = true;
        } else if (q.type === 'checkbox' && Array.isArray(userAns) && q.correctChoices) {
            var a = userAns.map(Number).slice().sort(), b = q.correctChoices.map(Number).slice().sort();
            ok = a.length === b.length && a.every(function(v, i) { return v === b[i]; });
        } else if (q.type === 'text' && q.correctText) {
            ok = q.correctText.some(function(t) { return String(t).toLowerCase().trim() === String(userAns || '').toLowerCase().trim(); });
        } else if (q.type === 'puzzle-drag' && Array.isArray(userAns) && q.correctChoices) {
            ok = JSON.stringify(userAns) === JSON.stringify(q.correctChoices);
        }
        if (ok) score++;
        var shown = userAns;
        if ((q.type === 'radio' || q.type === 'select' || q.type === 'true-false') && q.options) {
            var n = parseInt(userAns, 10);
            if (!isNaN(n) && q.options[n] != null) shown = q.options[n];
        }
        var correct = '';
        if (q.options && q.correctChoices) correct = q.correctChoices.map(function(i) { return q.options[i]; }).join(', ');
        else if (q.correctText) correct = q.correctText.join(' / ');
        if (ok) rows += '<div class="review-item correct-item"><strong>' + (q.title || '') + '</strong><p class="text-success" style="font-size:13px;">✓ «' + String(shown) + '»</p></div>';
        else rows += '<div class="review-item incorrect-item"><strong>' + (q.title || '') + '</strong><p class="text-danger" style="font-size:13px;">✗ «' + String(shown == null || shown === '' ? 'пусто' : shown) + '»</p><p class="text-success" style="font-size:13px;">✓ ' + (correct || '—') + '</p></div>';
    });
    var modal = document.getElementById('custom-alert');
    var card = modal && modal.querySelector('.custom-alert-card');
    if (!modal || !card) { showAlert('Сверка: ' + score + '/' + max); return; }
    var original = card.innerHTML;
    card.innerHTML = '<h3 style="margin:0 0 8px;text-align:left;">Сверка ответов</h3><p style="font-size:13px;color:var(--text-muted);text-align:left;">Файл: ' + (fileName || '') + '<br>Форма: ' + (data.formTitle || '') + '</p><div style="font-size:1.3rem;font-weight:700;margin:10px 0;">' + score + ' / ' + max + '</div><div style="max-height:45vh;overflow:auto;text-align:left;">' + rows + '</div><button class="btn" style="width:100%;margin-top:12px;" id="lite-review-close">Закрыть</button>';
    modal.classList.add('active');
    document.getElementById('lite-review-close').onclick = function() {
        modal.classList.remove('active');
        setTimeout(function() { card.innerHTML = original; }, 200);
    };
}

function openLiteFormSettings() {
    var form = allForms[currentFormIndex] || {};
    var s = form.settings || {};
    var mode = form.mode === 'learn' || s.learnMode ? 'learn' : 'test';
    var t = document.getElementById('lite-mode-test');
    var l = document.getElementById('lite-mode-learn');
    if (t) t.checked = mode === 'test';
    if (l) l.checked = mode === 'learn';
    var sc = document.getElementById('lite-show-correct');
    var sw = document.getElementById('lite-show-wrong');
    var sp = document.getElementById('lite-save-progress');
    var dr = document.getElementById('lite-default-required');
    var em = document.getElementById('lite-teacher-email');
    if (sc) sc.checked = s.showCorrect !== false;
    if (sw) sw.checked = s.showWrong !== false;
    if (sp) sp.checked = s.saveProgress !== false;
    if (dr) dr.checked = !!s.defaultRequired;
    if (em) em.value = s.teacherEmail || form.teacherEmail || '';
    toggleLiteSaveProgressWarning();
    var m = document.getElementById('lite-form-settings-modal');
    if (m) m.classList.add('active');
}
function closeLiteFormSettings() {
    var m = document.getElementById('lite-form-settings-modal');
    if (m) m.classList.remove('active');
}
function saveLiteFormSettings() {
    var form = allForms[currentFormIndex];
    if (!form) return;
    form.settings = form.settings || {};
    var learn = document.getElementById('lite-mode-learn');
    form.settings.learnMode = !!(learn && learn.checked);
    form.mode = form.settings.learnMode ? 'learn' : 'test';
    form.settings.showCorrect = !!(document.getElementById('lite-show-correct') && document.getElementById('lite-show-correct').checked);
    form.settings.showWrong = !!(document.getElementById('lite-show-wrong') && document.getElementById('lite-show-wrong').checked);
    form.settings.saveProgress = !!(document.getElementById('lite-save-progress') && document.getElementById('lite-save-progress').checked);
    form.settings.defaultRequired = !!(document.getElementById('lite-default-required') && document.getElementById('lite-default-required').checked);
    var em = document.getElementById('lite-teacher-email');
    form.settings.teacherEmail = em ? em.value.trim() : '';
    form.teacherEmail = form.settings.teacherEmail;
    saveFormsToStorage();
    closeLiteFormSettings();
    showAlert('Настройки сохранены · режим ' + (form.mode === 'learn' ? 'Learn' : 'Test'), 'check_circle');
}

function toggleLiteSaveProgressWarning() {
    var sp = document.getElementById('lite-save-progress');
    var w = document.getElementById('lite-save-progress-warning');
    if (!w) return;
    var off = sp && !sp.checked;
    w.style.display = off ? 'block' : 'none';
    w.classList.toggle('hidden', !off);
}
function openAuthModalLite() {
    var form = allForms[currentFormIndex] || {};
    var a = form.adminAuth || {};
    var l = document.getElementById('lite-admin-login');
    var p = document.getElementById('lite-admin-pass');
    if (l) l.value = a.login || 'admin';
    if (p) p.value = a.pass || '';
    var m = document.getElementById('lite-auth-modal');
    if (m) m.classList.add('active');
}
function closeAuthModalLite() {
    var m = document.getElementById('lite-auth-modal');
    if (m) m.classList.remove('active');
}
function saveAuthLite() {
    var form = allForms[currentFormIndex];
    if (!form) return;
    form.adminAuth = {
        login: (document.getElementById('lite-admin-login').value || 'admin').trim(),
        pass: (document.getElementById('lite-admin-pass').value || '1234')
    };
    saveFormsToStorage();
    closeAuthModalLite();
    showAlert('Логин/пароль сохранены для этой формы', 'check_circle');
}

document.addEventListener('DOMContentLoaded', function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function(){});
  }
});
