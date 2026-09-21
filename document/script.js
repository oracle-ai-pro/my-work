// ==========================================
// 1. БАЗОВОЕ СОСТОЯНИЕ И ПЕРЕМЕННЫЕ
// ==========================================
let allDocs = [];
let currentDocIndex = 0;
let currentStep = 0;
let isAdmin = false;
let contextTargetIndex = null;
let promptCallback = null;

// Новое состояние для улучшения UX и функционала
let editingBlockIndex = null;       // Индекс редактируемого блока (null при добавлении)
let uploadedMediaData = '';         // Данные загруженного изображения (Base64)
let readTimerInterval = null;       // Интервал таймера чтения
let readTimerSeconds = 0;           // Остаток секунд таймера
let userAnswers = {};               // Ответы пользователя текущей сессии: { [docId_blockId]: answer }

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ И ИНИЦИАЛЬНЫЕ НАСТРОЙКИ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadDocs();
    applyShareParamsFromUrl();
    
    // Если пусто, создаем дефолтный приветственный документ
    if (allDocs.length === 0) {
        allDocs.push({
            id: Date.now(),
            title: 'Добро пожаловать',
            blocks: [
                {
                    id: Date.now() + 1,
                    type: 'a4-sheet',
                    title: 'Инструкция по использованию',
                    description: 'Добро пожаловать в систему My Document.',
                    htmlContent: '<h1>Добро пожаловать!</h1><p>Это ваш первый документ. Вы можете просматривать его страницы, переходить между разделами или войти в режим редактора для добавления новых блоков.</p>'
                }
            ]
        });
        saveDocs();
    }
    
    renderTabs();
    renderDocScreen();
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme, false);
    const savedRadius = localStorage.getItem('app_radius') || 'rounded';
    setRadius(savedRadius, false);
    enhanceAllSelects();
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    // Закрытие контекстного меню при клике вне его
    document.addEventListener('click', closeContextMenu);
});

// Экранирование спецсимволов HTML для защиты от XSS
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

// ==========================================
// 3. СИСТЕМА СОХРАНЕНИЯ (LOCALSTORAGE)
// ==========================================
function loadDocs() {
    const saved = localStorage.getItem('myDocsData');
    if (saved) {
        try {
            allDocs = JSON.parse(saved);
        } catch(e) {
            console.error("Ошибка чтения памяти documents", e);
        }
    }
}

function saveDocs() {
    localStorage.setItem('myDocsData', JSON.stringify(allDocs));
}

// ==========================================
// 4. ВКЛАДКИ ДОКУМЕНТОВ И КОНТЕКСТНОЕ МЕНЮ
// ==========================================
function renderTabs() {
    const list = document.getElementById('forms-tabs-list');
    const select = document.getElementById('forms-tabs-select');
    
    if (!list || !select) return;
    list.innerHTML = '';
    select.innerHTML = '';

    allDocs.forEach((doc, idx) => {
        // Рендер кнопок на ПК
        const btn = document.createElement('button');
        btn.className = `btn ${idx === currentDocIndex ? '' : 'btn-secondary'}`;
        btn.innerText = doc.title;
        btn.style.whiteSpace = 'nowrap';
        btn.onclick = () => switchDoc(idx);
        
        // ПКМ (Контекстное меню)
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            showContextMenu(e, idx);
        };

        list.appendChild(btn);

        // Рендер выпадающего списка на мобильных
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = doc.title;
        if (idx === currentDocIndex) opt.selected = true;
        select.appendChild(opt);
    });

    if (window.innerWidth < 600) {
        list.classList.add('hidden');
        select.classList.remove('hidden');
    } else {
        list.classList.remove('hidden');
        select.classList.add('hidden');
    }
    if (select.dataset.cselectEnhanced === '1') refreshEnhancedSelect(select);
    else if (!select.classList.contains('hidden')) enhanceNativeSelect(select);
}

function showContextMenu(e, idx) {
    contextTargetIndex = idx;
    const menu = document.getElementById('tab-context-menu');
    if (!menu) return;

    menu.classList.remove('hidden');

    // Проверка границ экрана, чтобы меню не вылезало за края
    let left = e.clientX;
    let top = e.clientY;
    const menuWidth = menu.offsetWidth || 180;
    const menuHeight = menu.offsetHeight || 100;

    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    document.getElementById('ctx-rename-btn').onclick = () => {
        closeContextMenu();
        renameDocAtIndex(contextTargetIndex);
    };

    document.getElementById('ctx-delete-btn').onclick = () => {
        closeContextMenu();
        deleteDocAtIndex(contextTargetIndex);
    };
}

function closeContextMenu() {
    const menu = document.getElementById('tab-context-menu');
    if (menu) menu.classList.add('hidden');
}

function switchDoc(idx) {
    currentDocIndex = parseInt(idx);
    currentStep = 0;
    renderTabs();
    if (isAdmin) renderAdminBlocksList();
    else renderDocScreen();
}

function switchDocFromSelect(idx) {
    switchDoc(idx);
}

// ==========================================
// 5. ИНТЕРФЕЙС ЧТЕНИЯ И ПРОСМОТРА
// ==========================================
function renderDocScreen() {
    clearInterval(readTimerInterval);
    const doc = allDocs[currentDocIndex];
    if (!doc) return;

    document.getElementById('doc-display-title').innerText = doc.title;
    const blocks = doc.blocks || [];
    
    document.getElementById('total-number').innerText = Math.max(1, blocks.length);
    document.getElementById('current-number').innerText = currentStep + 1;

    document.getElementById('doc-box').classList.remove('hidden');
    document.getElementById('result-box').classList.add('hidden');

    if (blocks.length === 0) {
        document.getElementById('document-body').innerHTML = '<p style="color:var(--text-muted);">В этом документе пока нет блоков. Войдите в панель редактора, чтобы добавить их.</p>';
        document.getElementById('progress').style.width = '100%';
        document.getElementById('next-btn').classList.add('hidden');
        document.getElementById('read-timer-display').classList.add('hidden');
        return;
    }

    const block = blocks[currentStep];
    const body = document.getElementById('document-body');
    const answerKey = `${doc.id}_${block.id}`;
    
    body.style.opacity = 0;
    setTimeout(() => {
        let content = `<h3>${escapeHTML(block.title)}</h3>`;

        if (block.description) {
            content += `<p>${escapeHTML(block.description).replace(/\n/g, '<br>')}</p>`;
        }

        // Рендеринг различных типов блоков
        switch (block.type) {
            case 'a4-sheet':
                content += `<div class="a4-paper-view">${block.htmlContent || ''}</div>`;
                break;

            case 'text-block':
                // Обычный текстовый блок (уже отрисован через title и description)
                break;

            case 'interactive-fields':
                const savedVal = userAnswers[answerKey] || '';
                content += `<input type="text" class="admin-input" id="interactive-input" placeholder="Введите ваш ответ..." value="${escapeHTML(savedVal)}" oninput="saveUserAnswer('${answerKey}', this.value)">`;
                break;

            case 'checklist':
                if (block.options && block.options.length > 0) {
                    const savedChecks = userAnswers[answerKey] || [];
                    block.options.forEach((opt, idx) => {
                        const isChecked = savedChecks.includes(idx) ? 'checked' : '';
                        content += `
                            <label style="display:block; margin-top:8px; cursor:pointer;">
                                <input type="checkbox" ${isChecked} onchange="toggleChecklistOption('${answerKey}', ${idx})"> ${escapeHTML(opt)}
                            </label>`;
                    });
                }
                break;

            case 'flashcard':
                content += `
                    <div class="flashcard-container" id="doc-fc-card" onclick="this.classList.toggle('flipped')">
                        <div class="flashcard-inner">
                            <div class="flashcard-side flashcard-front">
                                <span class="material-symbols-rounded" style="font-size:28px; color:var(--accent-color); margin-bottom:8px;">style</span>
                                <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Нажмите, чтобы перевернуть</p>
                                <p style="font-size:16px; font-weight:600; margin:0;">${escapeHTML(block.title)}</p>
                            </div>
                            <div class="flashcard-side flashcard-back">
                                <span class="material-symbols-rounded" style="font-size:28px; color:var(--accent-color); margin-bottom:8px;">lightbulb</span>
                                <p style="font-size:15px; font-weight:500; margin:0;">${escapeHTML(block.flashcardAnswer || 'Подсказка отсутствует.')}</p>
                            </div>
                        </div>
                    </div>`;
                break;

            case 'info-slide':
                if (block.mediaData) {
                    content += `
                        <div style="text-align:center; margin-top:15px;">
                            <img src="${block.mediaData}" style="max-width:100%; max-height:350px; border-radius:var(--radius-sm); border:1px solid var(--border-color); box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                        </div>`;
                }
                break;
        }

        body.innerHTML = content;
        body.style.transition = 'opacity 0.3s';
        body.style.opacity = 1;
    }, 100);

    // Запуск таймера чтения, если он включен в блоке
    if (block.timer && parseInt(block.timer) > 0) {
        startReadTimer(parseInt(block.timer));
    } else {
        document.getElementById('read-timer-display').classList.add('hidden');
    }

    const progressPercent = ((currentStep) / blocks.length) * 100;
    document.getElementById('progress').style.width = `${progressPercent}%`;

    document.getElementById('prev-btn').classList.toggle('hidden', currentStep === 0);
    document.getElementById('next-btn').innerText = (currentStep === blocks.length - 1) ? 'Завершить' : 'Далее';
    document.getElementById('next-btn').classList.remove('hidden');
}

// Забор и хранение ответов пользователя
function saveUserAnswer(key, val) {
    userAnswers[key] = val;
}

function toggleChecklistOption(key, optIdx) {
    if (!userAnswers[key]) userAnswers[key] = [];
    const idx = userAnswers[key].indexOf(optIdx);
    if (idx > -1) {
        userAnswers[key].splice(idx, 1);
    } else {
        userAnswers[key].push(optIdx);
    }
}

// Таймер чтения
function startReadTimer(seconds) {
    clearInterval(readTimerInterval);
    const timerDisplay = document.getElementById('read-timer-display');
    const timerSecs = document.getElementById('timer-seconds');
    
    readTimerSeconds = seconds;
    timerSecs.innerText = readTimerSeconds;
    timerDisplay.classList.remove('hidden');
    
    readTimerInterval = setInterval(() => {
        readTimerSeconds--;
        timerSecs.innerText = readTimerSeconds;
        if (readTimerSeconds <= 0) {
            clearInterval(readTimerInterval);
            timerDisplay.classList.add('hidden');
        }
    }, 1000);
}

function nextStep() {
    const doc = allDocs[currentDocIndex];
    const blocks = doc.blocks || [];
    const currentBlock = blocks[currentStep];

    // Проверка обязательности раздаточного материала
    if (currentBlock && currentBlock.required) {
        const answerKey = `${doc.id}_${currentBlock.id}`;
        const ans = userAnswers[answerKey];
        if (currentBlock.type === 'interactive-fields' && (!ans || !ans.trim())) {
            return showAlert('Пожалуйста, заполните обязательное поле перед переходом!');
        }
        if (currentBlock.type === 'checklist' && (!ans || ans.length === 0)) {
            return showAlert('Отметьте хотя бы один пункт чек-листа!');
        }
    }

    if (currentStep < blocks.length - 1) {
        currentStep++;
        renderDocScreen();
    } else {
        showResultsScreen();
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        renderDocScreen();
    }
}

function restartDocView() {
    currentStep = 0;
    renderDocScreen();
}

function showResultsScreen() {
    clearInterval(readTimerInterval);
    document.getElementById('doc-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');

    const doc = allDocs[currentDocIndex];
    const reviewBox = document.getElementById('review-box');
    reviewBox.innerHTML = '';

    let summaryHTML = '<div style="text-align:left; margin-top:15px;">';
    let hasAnswers = false;

    (doc.blocks || []).forEach((b, idx) => {
        const key = `${doc.id}_${b.id}`;
        if (userAnswers[key]) {
            hasAnswers = true;
            summaryHTML += `<div style="margin-bottom:10px; font-size:13px; border-bottom:1px solid var(--border-color); padding-bottom:5px;">`;
            summaryHTML += `<strong>${idx + 1}. ${escapeHTML(b.title)}:</strong> `;
            if (Array.isArray(userAnswers[key])) {
                const selectedOpts = userAnswers[key].map(i => b.options[i]).join(', ');
                summaryHTML += `<span>${escapeHTML(selectedOpts) || 'Ничего не выбрано'}</span>`;
            } else {
                summaryHTML += `<span>${escapeHTML(userAnswers[key])}</span>`;
            }
            summaryHTML += `</div>`;
        }
    });

    summaryHTML += '</div>';

    if (hasAnswers) {
        reviewBox.innerHTML = '<h4 style="margin-bottom:8px; text-align:center;">Ваши ответы:</h4>' + summaryHTML;
    } else {
        reviewBox.innerHTML = '';
    }
}

// ==========================================
// 6. ПЕЧАТЬ И ПРЕДПРОСМОТР (ABOUT:BLANK)
// ==========================================
function printCurrentDoc() {
    const doc = allDocs[currentDocIndex];
    if (!doc) return;

    let contentHTML = `<h1>${escapeHTML(doc.title)}</h1><hr style="border:none; border-top:2px solid #000; margin: 20px 0;">`;

    if (!doc.blocks || doc.blocks.length === 0) {
        contentHTML += `<p>Документ пуст.</p>`;
    } else {
        doc.blocks.forEach((block, idx) => {
            contentHTML += `<div style="margin-bottom: 30px;">`;
            contentHTML += `<h2>${idx + 1}. ${escapeHTML(block.title)}</h2>`;
            if (block.description) {
                contentHTML += `<p>${escapeHTML(block.description).replace(/\n/g, '<br>')}</p>`;
            }
            
            if (block.type === 'a4-sheet' && block.htmlContent) {
                contentHTML += `<div style="border:1px solid #ccc; padding:15px; margin-top:10px;">${block.htmlContent}</div>`;
            } else if (block.type === 'checklist' && block.options) {
                block.options.forEach(opt => {
                    contentHTML += `<div style="margin-top:5px;">☐ ${escapeHTML(opt)}</div>`;
                });
            } else if (block.type === 'flashcard' && block.flashcardAnswer) {
                contentHTML += `<div style="margin-top:5px; font-style:italic; color:#555;">Подсказка: ${escapeHTML(block.flashcardAnswer)}</div>`;
            } else if (block.type === 'info-slide' && block.mediaData) {
                contentHTML += `<div style="margin-top:10px;"><img src="${block.mediaData}" style="max-width:100%; max-height:300px;"></div>`;
            }
            contentHTML += `</div>`;
        });
    }

    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
        return showAlert('Браузер заблокировал всплывающее окно! Разрешите их для этого сайта.');
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>Печать: ${escapeHTML(doc.title)}</title>
            <style>
                body { font-family: 'Times New Roman', Times, serif; padding: 40px; background: #f0f0f0; margin: 0; }
                .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #333; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
                .btn-print { background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; }
                .btn-close { background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; }
                .sheet { background: white; max-width: 800px; margin: 60px auto 20px auto; padding: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); min-height: 1000px; outline: none; }
                @media print { .toolbar { display: none !important; } body { background: white; padding: 0; } .sheet { box-shadow: none; margin: 0; padding: 0; max-width: 100%; } }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <span>Предпросмотр перед печатью (текст ниже можно редактировать)</span>
                <div>
                    <button class="btn-print" onclick="window.print()">🖨️ Распечатать</button>
                    <button class="btn-close" onclick="window.close()">✕ Закрыть</button>
                </div>
            </div>
            <div class="sheet" contenteditable="true">
                ${contentHTML}
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ==========================================
// 7. УПРАВЛЕНИЕ ДОКУМЕНТОМ (ПЕРЕИМЕНОВАНИЕ / УДАЛЕНИЕ)
// ==========================================
function updateAdminDocName() {
    const docNameEl = document.getElementById('admin-current-doc-name');
    if (docNameEl && allDocs[currentDocIndex]) {
        docNameEl.innerText = allDocs[currentDocIndex].title;
    }
}

function renameDocAtIndex(index) {
    if (index < 0 || index >= allDocs.length) return;
    
    document.getElementById('custom-prompt-title').innerText = 'Новое название документа';
    document.getElementById('custom-prompt-input').value = allDocs[index].title;
    document.getElementById('custom-prompt').classList.remove('hidden');
    
    promptCallback = function(val) {
        if (val && val.trim() !== '') {
            allDocs[index].title = val.trim();
            saveDocs();
            renderTabs();
            updateAdminDocName();
            if (!isAdmin) renderDocScreen();
            showAlert('Документ успешно переименован!');
        }
    };
}

function deleteDocAtIndex(index) {
    if (allDocs.length <= 1) {
        return showAlert('Нельзя удалить единственный документ! Создайте новый перед удалением.');
    }
    
    showConfirm('Удалить документ?', 'Документ «' + allDocs[index].title + '» будет удалён без возможности восстановления.', function() {
        allDocs.splice(index, 1);
        if (currentDocIndex >= allDocs.length) {
            currentDocIndex = allDocs.length - 1;
        }
        saveDocs();
        renderTabs();
        if (isAdmin) renderAdminBlocksList();
        else renderDocScreen();
        showAlert('Документ удален!');
    });
}

// ==========================================
// 8. АДМИНКА И РЕДАКТОР БЛОКОВ
// ==========================================
function openLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
function closeLoginModal() { document.getElementById('login-modal').classList.add('hidden'); }

function tryLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    if (u === 'admin' && p === '1234') { 
        isAdmin = true;
        closeLoginModal();
        document.getElementById('doc-screen').classList.add('hidden');
        document.getElementById('admin-screen').classList.remove('hidden');
        renderAdminBlocksList();
        showAlert('Вход выполнен. Режим редактора активен.');
    } else {
        showAlert('Неверный логин или пароль (admin / 1234)');
    }
}

function logout() {
    isAdmin = false;
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('doc-screen').classList.remove('hidden');
    currentStep = 0;
    renderDocScreen();
}

function toggleAddBlockForm() {
    editingBlockIndex = null;
    document.getElementById('admin-form-title').innerText = 'Новый элемент документа';
    cancelEditBlock();
    document.getElementById('admin-add-form').classList.toggle('hidden');
}

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    
    document.getElementById('a4-editor-box').classList.toggle('hidden', type !== 'a4-sheet');
    document.getElementById('desc-field-box').classList.toggle('hidden', type === 'a4-sheet');
    document.getElementById('admin-choices-fields').classList.toggle('hidden', type !== 'checklist');
    document.getElementById('flashcard-answer-box').classList.toggle('hidden', type !== 'flashcard');
    document.getElementById('media-upload-box').classList.toggle('hidden', type !== 'info-slide');
}

function execEditorCmd(cmd, value = null) {
    document.execCommand(cmd, false, value);
}

// Загрузка медиа в base64
function handleMediaUploadPreview(input) {
    const container = document.getElementById('media-preview-container');
    container.innerHTML = '';
    uploadedMediaData = '';
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedMediaData = e.target.result;
            container.innerHTML = `<img src="${uploadedMediaData}" style="max-width:100%; max-height:150px; margin-top:10px; border-radius:8px; border:1px solid var(--border-color);">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Добавление или обновление существующего блока
function addBlock() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();
    const desc = document.getElementById('new-description').value.trim();

    if (!title) return showAlert('Введите заголовок!');

    const doc = allDocs[currentDocIndex];
    if (!doc.blocks) doc.blocks = [];

    const isTimerActive = document.getElementById('toggle-timer-input').checked;
    const timerVal = isTimerActive ? document.getElementById('new-timer').value : null;

    const blockData = {
        id: editingBlockIndex !== null ? doc.blocks[editingBlockIndex].id : Date.now(),
        type: type,
        title: title,
        description: type === 'a4-sheet' ? '' : desc,
        required: document.getElementById('new-required').checked,
        timer: timerVal
    };

    if (type === 'a4-sheet') {
        const a4HTML = document.getElementById('a4-editor-content').innerHTML;
        if (!a4HTML.trim()) return showAlert('Заполните содержимое Листа А4!');
        blockData.htmlContent = a4HTML;
    } else if (type === 'checklist') {
        blockData.options = document.getElementById('new-options').value.split(',').map(s => s.trim()).filter(Boolean);
    } else if (type === 'flashcard') {
        blockData.flashcardAnswer = document.getElementById('new-flashcard-answer').value.trim();
    } else if (type === 'info-slide') {
        blockData.mediaData = uploadedMediaData || (editingBlockIndex !== null ? doc.blocks[editingBlockIndex].mediaData : '');
    }

    if (editingBlockIndex !== null) {
        doc.blocks[editingBlockIndex] = blockData;
        showAlert('Блок успешно обновлен!');
    } else {
        doc.blocks.push(blockData);
        showAlert('Блок успешно добавлен!');
    }

    saveDocs();
    cancelEditBlock();
    renderAdminBlocksList();
}

function editBlock(index) {
    const doc = allDocs[currentDocIndex];
    const block = doc.blocks[index];
    if (!block) return;

    editingBlockIndex = index;
    document.getElementById('admin-form-title').innerText = 'Редактировать элемент документа';
    document.getElementById('new-type').value = block.type;
    refreshEnhancedSelect(document.getElementById('new-type'));
    toggleAdminFields();

    document.getElementById('new-title').value = block.title || '';
    document.getElementById('new-description').value = block.description || '';
    document.getElementById('new-required').checked = !!block.required;

    if (block.type === 'a4-sheet') {
        document.getElementById('a4-editor-content').innerHTML = block.htmlContent || '';
    } else if (block.type === 'checklist') {
        document.getElementById('new-options').value = (block.options || []).join(', ');
    } else if (block.type === 'flashcard') {
        document.getElementById('new-flashcard-answer').value = block.flashcardAnswer || '';
    } else if (block.type === 'info-slide') {
        uploadedMediaData = block.mediaData || '';
        const container = document.getElementById('media-preview-container');
        container.innerHTML = uploadedMediaData ? `<img src="${uploadedMediaData}" style="max-width:100%; max-height:150px; margin-top:10px; border-radius:8px;">` : '';
    }

    if (block.timer) {
        document.getElementById('toggle-timer-input').checked = true;
        document.getElementById('timer-config').classList.remove('hidden');
        document.getElementById('new-timer').value = block.timer;
    } else {
        document.getElementById('toggle-timer-input').checked = false;
        document.getElementById('timer-config').classList.add('hidden');
    }

    document.getElementById('admin-add-form').classList.remove('hidden');
}

function cancelEditBlock() {
    editingBlockIndex = null;
    uploadedMediaData = '';
    document.getElementById('new-title').value = '';
    document.getElementById('new-description').value = '';
    document.getElementById('a4-editor-content').innerHTML = ''; 
    document.getElementById('new-options').value = '';
    document.getElementById('new-flashcard-answer').value = '';
    document.getElementById('media-preview-container').innerHTML = '';
    document.getElementById('new-media-file').value = '';
    document.getElementById('new-required').checked = false;
    document.getElementById('toggle-timer-input').checked = false;
    document.getElementById('timer-config').classList.add('hidden');
    document.getElementById('admin-add-form').classList.add('hidden');
    toggleAdminFields();
}

function renderAdminBlocksList() {
    updateAdminDocName();
    
    const doc = allDocs[currentDocIndex];
    const list = document.getElementById('admin-questions-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (!doc || !doc.blocks || doc.blocks.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);">Нет блоков. Нажмите "+ Добавить блок".</p>';
        return;
    }

    doc.blocks.forEach((b, index) => {
        const item = document.createElement('div');
        item.className = 'gcard';
        item.style.padding = '15px';
        item.style.marginBottom = '10px';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${index + 1}. ${escapeHTML(b.title)}</strong> 
                    <span style="color:var(--text-muted); font-size:12px;">(${escapeHTML(b.type)})</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="moveBlock(${index}, -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="moveBlock(${index}, 1)" ${index === doc.blocks.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="editBlock(${index})">Изменить</button>
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; color:#e74c3c; border-color:#e74c3c;" onclick="deleteBlock(${index})">Удалить</button>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function moveBlock(index, direction) {
    const blocks = allDocs[currentDocIndex].blocks;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    
    const temp = blocks[index];
    blocks[index] = blocks[targetIndex];
    blocks[targetIndex] = temp;
    
    saveDocs();
    renderAdminBlocksList();
}

function deleteBlock(index) {
    const title = (allDocs[currentDocIndex].blocks[index] || {}).title || 'блок';
    showConfirm('Удалить блок?', '«' + title + '» будет удалён.', function() {
        allDocs[currentDocIndex].blocks.splice(index, 1);
        saveDocs();
        renderAdminBlocksList();
    });
}

// ==========================================
// 9. ВСПЛЫВАЮЩИЕ И МОДАЛЬНЫЕ ОКНА
// ==========================================
function toggleToolsMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }
function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

function setTheme(theme, save = true) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        document.documentElement.setAttribute('data-theme', 'light');
    }
    if (save) localStorage.setItem('theme', theme);
}

function setRadius(name, save = true) {
    document.body.setAttribute('data-radius', name);
    var sel = document.getElementById('settings-radius-select');
    if (sel) {
        sel.value = name;
        if (typeof refreshEnhancedSelect === 'function') refreshEnhancedSelect(sel);
    }
    if (save) localStorage.setItem('app_radius', name);
}

function speakCurrentBlock() {
    if (!window.speechSynthesis) return showAlert('Озвучка не поддерживается');
    window.speechSynthesis.cancel();
    const doc = allDocs[currentDocIndex];
    const block = (doc.blocks || [])[currentStep];
    if (!block) return;
    let text = (block.title || '') + '. ' + (block.description || '');
    if (block.flashcardAnswer) text += '. ' + block.flashcardAnswer;
    const hasCyr = /[а-яёА-ЯЁ]/.test(text);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = hasCyr ? 'ru-RU' : 'en-US';
    window.speechSynthesis.speak(u);
}

function showAlert(msg) {
    document.getElementById('custom-alert-msg').innerText = msg;
    document.getElementById('custom-alert').classList.remove('hidden');
}
function closeAlert() {
    document.getElementById('custom-alert').classList.add('hidden');
}

// Prompt модалка
function createNewDocPrompt() {
    document.getElementById('custom-prompt-title').innerText = 'Название нового документа';
    document.getElementById('custom-prompt-input').value = '';
    document.getElementById('custom-prompt').classList.remove('hidden');
    
    promptCallback = function(val) {
        if (val) {
            allDocs.push({ id: Date.now(), title: val, blocks: [] });
            currentDocIndex = allDocs.length - 1;
            saveDocs();
            renderTabs();
            if (isAdmin) renderAdminBlocksList();
            else renderDocScreen();
            showAlert(`Документ "${val}" создан!`);
        }
    };
}

function closePrompt(isConfirm) {
    document.getElementById('custom-prompt').classList.add('hidden');
    if (isConfirm && promptCallback) {
        promptCallback(document.getElementById('custom-prompt-input').value.trim());
    }
    promptCallback = null;
}

// ==========================================
// 10. ИМПОРТ И ЭКСПОРТ (JSON)
// ==========================================
function exportDocToJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allDocs, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "my_docs_export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showAlert('Все документы успешно скачаны!');
}

function importDocFromJSON(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                allDocs = imported;
                saveDocs();
                currentDocIndex = 0;
                renderTabs();
                if (isAdmin) renderAdminBlocksList();
                else renderDocScreen();
                showAlert('База документов успешно обновлена!');
            } else {
                showAlert('Неверный формат файла!');
            }
        } catch (err) {
            showAlert('Ошибка чтения файла!');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

function generateShareLink() {
    openShareModal();
}

let shareExpiryDays = 7;

function openShareModal() {
    updateShareLinkPreview();
    enhanceAllSelects(document.getElementById('share-modal'));
    document.getElementById('share-modal').classList.remove('hidden');
}
function closeShareModal() {
    document.getElementById('share-modal').classList.add('hidden');
}
function buildShareUrl() {
    var base = window.location.href.split('?')[0].split('#')[0];
    var params = new URLSearchParams();
    params.set('d', String(currentDocIndex));
    var expSel = document.getElementById('share-expiry-select');
    var days = expSel ? parseInt(expSel.value, 10) : shareExpiryDays;
    shareExpiryDays = days;
    if (days > 0) params.set('exp', String(Date.now() + days * 86400000));
    return base + '?' + params.toString();
}
function updateShareLinkPreview() {
    var input = document.getElementById('share-link-input');
    if (input) input.value = buildShareUrl();
}
function copyShareLink() {
    updateShareLinkPreview();
    var url = buildShareUrl();
    navigator.clipboard.writeText(url).then(function() {
        showAlert('Ссылка скопирована!');
    }).catch(function() {
        var input = document.getElementById('share-link-input');
        if (input) { input.select(); try { document.execCommand('copy'); showAlert('Ссылка скопирована!'); } catch(e) { showAlert('Скопируйте ссылку вручную'); } }
    });
}
function applyShareParamsFromUrl() {
    try {
        var params = new URLSearchParams(window.location.search);
        var d = params.get('d');
        if (d !== null && !isNaN(parseInt(d, 10))) {
            var idx = parseInt(d, 10);
            if (idx >= 0 && idx < allDocs.length) currentDocIndex = idx;
        }
        var exp = params.get('exp');
        if (exp && Date.now() > parseInt(exp, 10)) {
            showAlert('Срок действия ссылки истёк');
        }
    } catch (e) {}
}

function showConfirm(title, text, onConfirm) {
    var modal = document.getElementById('custom-alert');
    if (!modal) return;
    var card = modal.querySelector('.custom-alert-card');
    if (!card) return;
    var original = card.innerHTML;
    card.innerHTML =
        '<h3 style="margin-bottom:8px;font-size:1.1rem;color:var(--text-color);text-align:left;">' + escapeHTML(title) + '</h3>' +
        '<p style="margin-bottom:20px;font-size:0.95rem;color:var(--text-muted);text-align:left;">' + escapeHTML(text) + '</p>' +
        '<div style="display:flex;gap:10px;justify-content:center;">' +
        '<button id="confirm-cancel-btn" class="btn btn-secondary" style="flex:1;">Отмена</button>' +
        '<button id="confirm-ok-btn" class="btn" style="flex:1;background:#d32f2f;">Удалить</button></div>';
    modal.classList.remove('hidden');
    var restore = function() {
        modal.classList.add('hidden');
        setTimeout(function() { card.innerHTML = original; }, 200);
    };
    document.getElementById('confirm-cancel-btn').onclick = restore;
    document.getElementById('confirm-ok-btn').onclick = function() {
        restore();
        if (typeof onConfirm === 'function') onConfirm();
    };
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
document.addEventListener('click', function(e) {
    if (!e.target.closest('.cselect')) {
        document.querySelectorAll('.cselect-dropdown').forEach(function(d) { d.classList.add('hidden'); });
        document.querySelectorAll('.cselect').forEach(function(c) { c.classList.remove('open'); });
    }
});
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
            '<span class="cselect-label">' + escapeHTML(selectedLabel) + '</span>' +
            '<span class="material-symbols-rounded cselect-arrow">expand_more</span></button>' +
            '<div class="cselect-dropdown hidden">' +
            opts.map(function(o) {
                var act = o.value === sel ? ' active' : '';
                return '<div class="cselect-option' + act + '" data-value="' + escapeHTML(o.value) +
                    '" onclick="pickCSelect(\'' + uid + '\',\'' + escapeHTML(o.value).replace(/'/g, "\\'") +
                    '\',\'' + escapeHTML(o.label).replace(/'/g, "\\'") + '\')">' + escapeHTML(o.label) + '</div>';
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


// ==========================================
// 11. ИИ ГЕНЕРАТОР И ЧАТ (DEMO)
// ==========================================
function openAiModal() { document.getElementById('ai-modal').classList.remove('hidden'); }
function closeAiModal() { document.getElementById('ai-modal').classList.add('hidden'); }

function switchAiMode(mode) {
    document.getElementById('ai-tab-gen').classList.toggle('btn-secondary', mode !== 'generate');
    document.getElementById('ai-tab-chat').classList.toggle('btn-secondary', mode !== 'chat');
    document.getElementById('ai-mode-generate-container').classList.toggle('hidden', mode !== 'generate');
    document.getElementById('ai-mode-chat-container').classList.toggle('hidden', mode !== 'chat');
}

function generateAiDocument() {
    const promptInput = document.getElementById('ai-prompt-input').value.trim();
    if (!promptInput) return showAlert('Введите тему документа!');
    
    showAlert('ИИ генерирует структуру...');
    closeAiModal();
    
    setTimeout(() => {
        allDocs.push({
            id: Date.now(),
            title: `Сгенерировано: ${promptInput}`,
            blocks: [
                {
                    id: Date.now() + 1,
                    type: 'a4-sheet',
                    title: 'Общие положения',
                    htmlContent: `<h1>${escapeHTML(promptInput)}</h1><p>Этот документ был автоматически сгенерирован алгоритмом ИИ на основе вашего запроса. Вы можете свободно редактировать этот текст.</p><ul><li>Пункт 1</li><li>Пункт 2</li></ul>`
                }
            ]
        });
        currentDocIndex = allDocs.length - 1;
        saveDocs();
        renderTabs();
        if (isAdmin) renderAdminBlocksList();
        else renderDocScreen();
        showAlert('Документ успешно сгенерирован!');
    }, 1500);
}

function sendAiChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    const history = document.getElementById('ai-chat-history');
    history.innerHTML += `<div style="text-align:right; margin-bottom:10px;"><span style="background:var(--accent-color); color:#fff; padding:6px 12px; border-radius:12px; display:inline-block; font-size:13px;">${escapeHTML(msg)}</span></div>`;
    input.value = '';
    
    setTimeout(() => {
        history.innerHTML += `<div style="text-align:left; margin-bottom:10px;"><span style="background:var(--bg-color); border:1px solid var(--border-color); padding:6px 12px; border-radius:12px; display:inline-block; font-size:13px;">Я демо-версия ИИ. Для реальных ответов требуется подключение к API!</span></div>`;
        history.scrollTop = history.scrollHeight;
    }, 800);
}
