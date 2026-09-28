// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И МУЛЬТИФОРМЫ
// ==========================================
let allForms = JSON.parse(localStorage.getItem('q_forms')) || {"def": {id: "def", name: "Главная форма", questions: []}};
let currentFormId = localStorage.getItem('q_curr_id') || "def";
if (!allForms[currentFormId]) currentFormId = Object.keys(allForms)[0] || "def";

let questions = allForms[currentFormId].questions;
let currentIndex = 0, userAnswers = [], currentTimerInterval = null, timeLeft = 0, isExplanationState = false, currentVoiceAnswer = null;
let editingIndex = null; // Индекс редактируемого вопроса
let learnFeedbackActive = false;

// ===== Custom dialogs (новинка) — без alert/confirm =====
function showOldDialog({ title, message, isInput, defaultValue, danger, okText, cancelText, hideCancel }) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('old-dialog-overlay');
        const titleEl = document.getElementById('old-dialog-title');
        const msgEl = document.getElementById('old-dialog-msg');
        const inputEl = document.getElementById('old-dialog-input');
        const okBtn = document.getElementById('old-dialog-ok');
        const cancelBtn = document.getElementById('old-dialog-cancel');
        const iconEl = document.getElementById('old-dialog-icon');
        if (!overlay) { resolve(isInput ? prompt(message, defaultValue || '') : confirm(message)); return; }

        titleEl.textContent = title || 'Сообщение';
        msgEl.textContent = message || '';
        okBtn.textContent = okText || 'OK';
        cancelBtn.textContent = cancelText || 'Отмена';
        cancelBtn.classList.toggle('hidden', !!hideCancel);
        if (danger) {
            okBtn.style.background = 'var(--danger)';
            iconEl.textContent = 'warning';
        } else {
            okBtn.style.background = '';
            iconEl.textContent = isInput ? 'edit' : 'info';
        }
        if (isInput) {
            inputEl.classList.remove('hidden');
            inputEl.value = defaultValue || '';
        } else {
            inputEl.classList.add('hidden');
            inputEl.value = '';
        }
        overlay.classList.remove('hidden');
        if (isInput) setTimeout(() => inputEl.focus(), 40);

        const cleanup = () => {
            overlay.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        };
        okBtn.onclick = () => { cleanup(); resolve(isInput ? inputEl.value : true); };
        cancelBtn.onclick = () => { cleanup(); resolve(isInput ? null : false); };
    });
}
async function oldAlert(message, title) {
    await showOldDialog({ title: title || 'Внимание', message, hideCancel: true });
}
async function oldConfirm(message, title) {
    return !!(await showOldDialog({ title: title || 'Подтверждение', message, danger: true }));
}
async function oldPrompt(message, defaultValue, title) {
    return await showOldDialog({ title: title || 'Ввод', message, isInput: true, defaultValue: defaultValue || '' });
}


const save = () => {
    localStorage.setItem('q_forms', JSON.stringify(allForms));
    localStorage.setItem('q_curr_id', currentFormId);
    questions = allForms[currentFormId].questions;
    renderTabs();
};

window.onload = async () => { 
    const urlParams = new URLSearchParams(window.location.search);
    const zipData = urlParams.get('zip');
    
    if (zipData) {
        try {
            let base64 = zipData.replace(/-/g, "+").replace(/_/g, "/");
            while (base64.length % 4) base64 += "=";
            
            const binaryStr = atob(base64);
            const byteArray = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                byteArray[i] = binaryStr.charCodeAt(i);
            }
            
            const stream = new Response(byteArray).body.pipeThrough(new DecompressionStream("deflate"));
            const jsonStr = await new Response(stream).text();
            const importedForm = JSON.parse(jsonStr);
            
            if (importedForm.questions && importedForm.questions.length > 0) {
                const sharedId = 'shared_' + Date.now();
                
                allForms[sharedId] = {
                    id: sharedId,
                    name: `⭐ ${importedForm.name || "Общая форма"}`,
                    questions: importedForm.questions
                };
                
                currentFormId = sharedId;
                
                const leaveBtn = document.getElementById('leave-shared-btn');
                if (leaveBtn) {
                    leaveBtn.classList.remove('hidden');
                    leaveBtn.href = window.location.origin + window.location.pathname;
                }
            }
        } catch (err) {
            console.error(err);
            oldAlert("Не удалось открыть форму. Ссылка повреждена или некорректна.");
        }
    }

    const savedTheme = localStorage.getItem('quiz_theme') || 'light';
    setTheme(savedTheme);
    save();
    loadProgressState();
    loadFormSettingsUI();
    updateModeBar();
    renderQuestion(); 
};

function renderTabs() {
    const box = document.getElementById('forms-tabs-list');
    if (!box) return;
    box.innerHTML = Object.keys(allForms).map(id => `
        <div class="form-tab ${id === currentFormId ? 'active-tab' : ''}" onclick="switchForm('${id}')">
            <span>${allForms[id].name}</span>
            <button class="edit-tab-btn" onclick="renameForm(event, '${id}')" title="Переименовать форму">
                <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="close-tab-btn" onclick="deleteForm(event, '${id}')" title="Удалить форму">
                <span class="material-symbols-rounded">close</span>
            </button>
        </div>
    `).join('');
}

const switchForm = id => { 
    if(currentFormId !== id) { 
        currentFormId = id; currentIndex = 0; userAnswers = [];
        save();
        loadProgressState();
        loadFormSettingsUI();
        updateModeBar();
        renderQuestion(); 
    }
};

async function createNewFormPrompt() {
    let name = await oldPrompt("Название новой формы:", "Новая форма", "Новая форма");
    if (!name || !name.trim()) return;
    let id = 'f_' + Date.now();
    allForms[id] = { id, name: name.trim(), questions: [], learnMode: false, saveProgress: true };
    currentFormId = id; currentIndex = 0; userAnswers = []; save(); renderQuestion();
}

async function renameForm(e, id) {
    e.stopPropagation();
    let oldName = allForms[id]?.name || "";
    let newName = await oldPrompt("Введите новое название формы:", oldName, "Переименовать");
    if (newName !== null && newName.trim() !== "") {
        allForms[id].name = newName.trim();
        save();
    }
}

async function deleteForm(e, id) {
    e.stopPropagation();
    const ok = await oldConfirm('Удалить форму «' + (allForms[id]?.name || '') + '» и все её вопросы?', 'Удаление');
    if (!ok) return;
    delete allForms[id];
    if (currentFormId === id) currentFormId = Object.keys(allForms)[0] || "def";
    if (!allForms[currentFormId]) allForms[currentFormId] = { id: currentFormId, name: "Главная форма", questions: [] };
    currentIndex = 0; userAnswers = []; localStorage.removeItem('q_progress_' + id); save(); renderQuestion();
}


// ===== Настройки формы (Learn + прогресс) — новинка =====
function getFormSettings() {
    const f = allForms[currentFormId] || {};
    return {
        learnMode: !!f.learnMode,
        saveProgress: f.saveProgress !== false // default true
    };
}
function saveFormSettings() {
    if (!allForms[currentFormId]) return;
    const learn = document.getElementById('form-learn-mode');
    const prog = document.getElementById('form-save-progress');
    if (learn) allForms[currentFormId].learnMode = !!learn.checked;
    if (prog) allForms[currentFormId].saveProgress = !!prog.checked;
    save();
    updateModeBar();
}
function loadFormSettingsUI() {
    const s = getFormSettings();
    const learn = document.getElementById('form-learn-mode');
    const prog = document.getElementById('form-save-progress');
    if (learn) learn.checked = s.learnMode;
    if (prog) prog.checked = s.saveProgress;
}
function updateModeBar() {
    const s = getFormSettings();
    const t = document.getElementById('mode-chip-test');
    const l = document.getElementById('mode-chip-learn');
    if (t) t.classList.toggle('active', !s.learnMode);
    if (l) l.classList.toggle('active', !!s.learnMode);
    const hint = document.getElementById('progress-hint');
    if (hint) {
        const key = progressKey();
        const has = !!localStorage.getItem(key);
        hint.textContent = (s.saveProgress && has) ? 'Есть сохранённый прогресс' : '';
    }
}
function progressKey() {
    return 'q_progress_' + currentFormId;
}
function saveProgressState() {
    const s = getFormSettings();
    if (!s.saveProgress) return;
    try {
        localStorage.setItem(progressKey(), JSON.stringify({
            currentIndex, userAnswers, ts: Date.now()
        }));
    } catch (e) {}
}
function loadProgressState() {
    const s = getFormSettings();
    if (!s.saveProgress) return false;
    try {
        const raw = localStorage.getItem(progressKey());
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.userAnswers)) return false;
        // only restore if same form still has questions
        if (!questions || !questions.length) return false;
        if (data.currentIndex > questions.length) return false;
        currentIndex = data.currentIndex || 0;
        userAnswers = data.userAnswers || [];
        return true;
    } catch (e) { return false; }
}
function clearSavedProgress() {
    localStorage.removeItem(progressKey());
    updateModeBar();
    oldAlert('Сохранённый прогресс этой формы очищен.', 'Готово');
}
function exportResultsTxt() {
    if (!userAnswers || !userAnswers.length) {
        oldAlert('Сначала пройдите тест — результатов пока нет.');
        return;
    }
    const name = (allForms[currentFormId] && allForms[currentFormId].name) || 'Форма';
    let lines = ['Результаты: ' + name, 'Дата: ' + new Date().toLocaleString('ru-RU'), ''];
    let ok = 0;
    userAnswers.forEach((a, i) => {
        if (a.finalStatus === 'correct') ok++;
        lines.push((i + 1) + '. ' + a.title);
        lines.push('   Ваш ответ: ' + (a.userAns || '[пусто]') + ' (' + a.finalStatus + ')');
        lines.push('   Верный: ' + (a.correctInfo || '—'));
        lines.push('');
    });
    lines.splice(2, 0, 'Итого: ' + ok + ' / ' + userAnswers.length, '');
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name.replace(/[^\wа-яА-ЯёЁ\- ]+/g, '') || 'results') + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ==========================================
// 2. ДВИЖОК ТЕСТИРОВАНИЯ
// ==========================================
function renderQuestion() {
    clearInterval(currentTimerInterval);
    isExplanationState = false;
    currentVoiceAnswer = null;
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) { nextBtn.innerText = "Далее"; nextBtn.disabled = false; nextBtn.classList.remove('hidden'); }

    if (!questions?.length) {
        document.getElementById('question-body').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <h3>У вас нет вопросов в этой форме 🤷‍♂️</h3><p style="color:var(--text-muted);">Создайте их через админку.</p>
                <button onclick="switchScreen('login')" style="width:auto; display:inline-block; padding:10px 20px;">Перейти в админку</button>
            </div>`;
        if (nextBtn) nextBtn.classList.add('hidden');
        document.getElementById('current-number').innerText = document.getElementById('total-number').innerText = "0";
        return;
    }
    
    const q = questions[currentIndex];
    document.getElementById('current-number').innerText = currentIndex + 1;
    document.getElementById('total-number').innerText = questions.length;
    document.getElementById('progress').style.width = `${(currentIndex / questions.length) * 100}%`;

    let html = `
        <h3 style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>${q.title}</span> ${q.required ? '<span style="color:red">*</span>' : ''}
            <button class="speak-btn" onclick="speakText('${q.title.replace(/'/g, "\\'")}')" title="Озвучить вопрос">
                <span class="material-symbols-rounded" style="font-size: 16px;">volume_up</span>
            </button>
        </h3>`;
    if (q.type === 'truefalse') {
        const opts = q.options && q.options.length ? q.options : ['Верно', 'Неверно'];
        html += '<div class="tf-options">';
        opts.forEach((opt, i) => {
            html += `<label class="option"><input type="radio" name="quiz_ans" value="${i}"> ${opt}</label>`;
        });
        html += '</div>';
    } else if (q.type === 'radio' || q.type === 'checkbox') {
        q.options.forEach((opt, i) => html += `<label class="option"><input type="${q.type}" name="quiz_ans" value="${i}"> ${opt}</label>`);
    } else if (q.type === 'select') {
        html += `<select id="quiz_select"><option value="">-- Выберите ответ --</option>` + q.options.map((opt, i) => `<option value="${i}">${opt}</option>`).join('') + `</select>`;
    } else if (q.type === 'text') {
        html += `<input type="text" id="quiz_text" class="admin-input" placeholder="Введите ваш ответ...">`;
    } else if (q.type === 'voice_card') {
        html += `
            <div class="voice-card" onclick="handleVoiceCardFail()">
                <h3>${q.title}</h3>
                <div style="display:flex; flex-direction:column; gap:8px; align-items:center;">
                    <button class="voice-btn" id="mic-btn" onclick="startVoiceRecognition(event, '${q.correctText?.join(',') || ''}')">
                        <span class="material-symbols-rounded">mic</span> Нажать и сказать
                    </button>
                    <button class="skip-voice-btn" onclick="event.stopPropagation(); handleVoiceCardFail('Не могу говорить');">
                        <span class="material-symbols-rounded" style="font-size:16px;">volume_off</span> Я не могу говорить
                    </button>
                </div>
                <div class="voice-status" id="voice-status">Скажите ответ или нажмите на карточку, чтобы посмотреть его.</div>
            </div>`;
    }
    document.getElementById('question-body').innerHTML = html + `<div id="explanation-container" class="hidden" style="margin-top:15px; padding:15px; border-radius:12px; background:#fff3cd; color:#333;"></div>`;

    const tDisplay = document.getElementById('timer-display');
    if (q.useTimer && q.timer > 0) {
        if (tDisplay) tDisplay.classList.remove('hidden');
        timeLeft = q.timer; document.getElementById('timer-seconds').innerText = timeLeft;
        currentTimerInterval = setInterval(() => {
            timeLeft--; document.getElementById('timer-seconds').innerText = timeLeft;
            if (timeLeft <= 0) { clearInterval(currentTimerInterval); nextStep(true); }
        }, 1000);
    } else { if(tDisplay) tDisplay.classList.add('hidden'); }
}

function nextStep(isTimeout = false) {
    if (!questions?.length) return;
    const q = questions[currentIndex];

    // After Learn highlight or explanation → go next
    if (isExplanationState || learnFeedbackActive) {
        isExplanationState = false;
        learnFeedbackActive = false;
        currentIndex++;
        saveProgressState();
        if (currentIndex < questions.length) renderQuestion(); else showResults();
        return;
    }

    let answers = [], rawValue = "", voiceStatus = null;

    if (!isTimeout) {
        if (q.type === 'radio' || q.type === 'truefalse') {
            let checked = document.querySelector('input[name="quiz_ans"]:checked');
            if (checked) {
                answers.push(parseInt(checked.value));
                const opts = q.options || ['Верно', 'Неверно'];
                rawValue = opts[checked.value];
            }
        } else if (q.type === 'checkbox') {
            let checkedBoxes = document.querySelectorAll('input[name="quiz_ans"]:checked');
            checkedBoxes.forEach(cb => answers.push(parseInt(cb.value)));
            rawValue = answers.map(i => q.options[i]).join(', ');
        } else if (q.type === 'select') {
            let sel = document.getElementById('quiz_select').value;
            if (sel !== "") { answers.push(parseInt(sel)); rawValue = q.options[sel]; }
        } else if (q.type === 'text') {
            rawValue = document.getElementById('quiz_text').value.trim();
        } else if (q.type === 'voice_card') {
            if (currentVoiceAnswer === null) { oldAlert("Ответьте голосом или откройте карточку!"); return; }
            rawValue = currentVoiceAnswer.text;
            voiceStatus = currentVoiceAnswer.status;
        }
        // timeout path skips required check; required only when not timeout
        if (q.required && answers.length === 0 && rawValue === "" && q.type !== 'voice_card') {
            oldAlert("Этот вопрос обязателен!");
            return;
        }
    } else {
        rawValue = "[Время истекло]";
        // do not block on required when timer hits 0
    }

    clearInterval(currentTimerInterval);
    let finalStatus = "incorrect"; 

    if (q.type === 'voice_card' && voiceStatus) {
        finalStatus = voiceStatus;
    } else if (q.type === 'text') {
        if (q.correctText) {
            let ok = q.correctText.some(t => t.toLowerCase().trim() === rawValue.toLowerCase().trim());
            finalStatus = ok ? "correct" : "incorrect";
        }
    } else if (q.type === 'truefalse' || q.type === 'radio' || q.type === 'checkbox' || q.type === 'select') {
        const opts = q.options || ['Верно', 'Неверно'];
        if (q.correct && q.correct.length === answers.length && answers.length > 0) {
            let ok = q.correct.every(v => answers.includes(v));
            finalStatus = ok ? "correct" : "incorrect";
        } else if (isTimeout) {
            finalStatus = "incorrect";
        }
        // correctInfo uses opts
        q._optsForReview = opts;
    }

    const correctInfo = (q.type === 'text' || q.type === 'voice_card')
        ? (q.correctText?.join(' / ') || '')
        : (q.correct?.map(i => (q.options || q._optsForReview || [])[i]).join(', ') || '');

    userAnswers.push({ 
        title: q.title, 
        userAns: rawValue, 
        finalStatus: finalStatus, 
        correctInfo: correctInfo
    });
    saveProgressState();

    const settings = getFormSettings();

    // Learn mode: highlight options, then wait for Далее
    if (settings.learnMode && !isTimeout && (q.type === 'radio' || q.type === 'truefalse' || q.type === 'checkbox' || q.type === 'select')) {
        learnFeedbackActive = true;
        document.querySelectorAll('.option').forEach(lab => {
            const inp = lab.querySelector('input');
            if (!inp) return;
            const idx = parseInt(inp.value, 10);
            const isCorrect = (q.correct || []).includes(idx);
            if (isCorrect) lab.classList.add('correct-highlight');
            else if (inp.checked) lab.classList.add('incorrect-highlight');
            inp.disabled = true;
        });
        const sel = document.getElementById('quiz_select');
        if (sel) sel.disabled = true;
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.innerText = "Продолжить";
        if (q.exp && q.exp.desc) {
            const expBox = document.getElementById('explanation-container');
            if (expBox) {
                expBox.classList.remove('hidden');
                expBox.innerHTML = `<strong>${q.exp.title || 'Объяснение'}:</strong> ${q.exp.desc}`;
            }
        }
        return;
    }

    if (q.exp && q.exp.desc && !isTimeout) {
        isExplanationState = true;
        const expBox = document.getElementById('explanation-container');
        if (expBox) {
            expBox.classList.remove('hidden'); 
            expBox.innerHTML = `<strong>${q.exp.title || 'Объяснение'}:</strong> ${q.exp.desc}`;
        }
        const nextBtn = document.getElementById('next-btn');
        if (q.exp.hold > 0 && nextBtn) {
            nextBtn.disabled = true; let holdTime = q.exp.hold; nextBtn.innerText = `Продолжить (${holdTime}s)`;
            let holdInterval = setInterval(() => {
                holdTime--; nextBtn.innerText = `Продолжить (${holdTime}s)`;
                if (holdTime <= 0) { clearInterval(holdInterval); nextBtn.disabled = false; nextBtn.innerText = "Продолжить"; }
            }, 1000);
        } else if (nextBtn) { nextBtn.innerText = "Продолжить"; }
        return;
    }

    currentIndex++;
    saveProgressState();
    if (currentIndex < questions.length) renderQuestion(); else showResults();
}

function showResults() {
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');
    // clear progress when finished
    try { localStorage.removeItem(progressKey()); } catch (e) {}
    updateModeBar();
    
    let correctCount = userAnswers.filter(a => a.finalStatus === "correct").length;
    document.getElementById('final-score').innerText = `${correctCount} / ${userAnswers.length}`;
    
    document.getElementById('review-box').innerHTML = userAnswers.map(a => {
        let itemClass = "incorrect-item", textClass = "text-danger", displayAns = a.userAns || '[Пусто]';
        if (a.finalStatus === "correct") { itemClass = "correct-item"; textClass = "text-success"; }
        else if (a.finalStatus === "skipped") { itemClass = "skipped-item"; textClass = "text-skipped"; }
        return `
            <div class="review-item ${itemClass}">
                <strong>${a.title}</strong><br>
                Ваш ответ: <span class="${textClass}">${displayAns}</span><br>
                Правильный: <span class="text-success">${a.correctInfo || '[Нет данных]'}</span>
            </div>`;
    }).join('');
}

function restartQuiz() {
    currentIndex = 0; userAnswers = [];
    try { localStorage.removeItem(progressKey()); } catch (e) {}
    document.getElementById('result-box').classList.add('hidden');
    document.getElementById('quiz-box').classList.remove('hidden');
    updateModeBar();
    renderQuestion();
}

// ==========================================
// 3. УПРАВЛЕНИЕ МИКРОФОНОМ И ТАПОМ ПО КАРТЕ
// ==========================================
function handleVoiceCardFail(reason = "Подсмотрел(-а)") {
    const status = document.getElementById('voice-status');
    const q = questions[currentIndex];
    const firstCorrectAnswer = q.correctText ? q.correctText[0] : '';
    const correctAnswersText = q.correctText ? q.correctText.join(' / ') : '';
    
    if (status) status.innerHTML = `⚠️ <strong>${reason}:</strong> За картой было слово: "${correctAnswersText}"`;
    
    if (firstCorrectAnswer) speakText(firstCorrectAnswer);
    
    currentVoiceAnswer = { text: `[${reason}]`, status: "skipped" };
    const card = document.querySelector('.voice-card');
    if (card) card.style.borderColor = 'var(--gray)';
    
    setTimeout(() => nextStep(), 1800);
}

function startVoiceRecognition(event, correctAnswersStr) {
    event.stopPropagation();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { oldAlert("Ваш браузер не поддерживает распознавание речи. Используйте Google Chrome."); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU'; recognition.interimResults = false;
    const btn = document.getElementById('mic-btn'), status = document.getElementById('voice-status'), card = document.querySelector('.voice-card');
    
    if (btn) { btn.classList.add('recording'); btn.innerText = "Слушаю..."; }
    if (status) status.innerText = "Говорите слово...";
    recognition.start();

    recognition.onresult = function(e) {
        const userSpeech = e.results[0][0].transcript.trim();
        if (status) status.innerText = `Вы сказали: "${userSpeech}"`;
        
        const allowed = correctAnswersStr.split(',').map(item => item.trim().toLowerCase());
        
        if (allowed.includes(userSpeech.toLowerCase())) {
            if (status) status.innerHTML = `🎉 <strong>Правильно!</strong> Вы сказали: "${userSpeech}"`;
            if (card) card.style.borderColor = 'var(--success)';
            currentVoiceAnswer = { text: userSpeech, status: "correct" };
        } else {
            if (status) status.innerHTML = `❌ <strong>Неверно.</strong> Вы сказали: "${userSpeech}".<br><small>Ожидалось: ${correctAnswersStr}</small>`;
            if (card) card.style.borderColor = 'var(--danger)';
            currentVoiceAnswer = { text: userSpeech, status: "incorrect" };
        }
    };

    recognition.onerror = () => { 
        if (status) status.innerText = "Ошибка работы микрофона."; 
        resetMic(btn); 
    };
    
    recognition.onend = () => resetMic(btn);
}

const resetMic = btn => { 
    if (btn) { 
        btn.classList.remove('recording'); 
        btn.innerHTML = '<span class="material-symbols-rounded">mic</span> Нажать и сказать'; 
    } 
};

// ==========================================
// 4. ОПЦИИ И ИНТЕРФЕЙС (ТЕМЫ И МЕНЮ)
// ==========================================
function setTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-theme'); 
    else document.body.classList.remove('dark-theme');
    localStorage.setItem('quiz_theme', theme);
}

function switchScreen(screen) {
    document.getElementById('quiz-screen').classList.toggle('hidden', screen !== 'quiz');
    document.getElementById('login-screen').classList.toggle('hidden', screen !== 'login');
    document.getElementById('admin-screen').classList.toggle('hidden', screen !== 'admin');
    if (screen === 'admin') { renderAdminQuestions(); loadFormSettingsUI(); }
}

function tryLogin() {
    if (document.getElementById('login-user').value === 'admin' && document.getElementById('login-pass').value === '1234') {
        switchScreen('admin');
        loadFormSettingsUI();
    } else { 
        oldAlert("Неверный логин или пароль!"); 
    }
}

function logout() { switchScreen('quiz'); }

// ==========================================
// 5. ПАНЕЛЬ АДМИНИСТРАТОРА И ЭКСПОРТ
// ==========================================
function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    const noChoices = (type === 'text' || type === 'voice_card' || type === 'truefalse');
    document.getElementById('admin-choices-fields').classList.toggle('hidden', noChoices);
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text' && type !== 'voice_card');

    // truefalse: compact correct choice field
    let tfBox = document.getElementById('admin-tf-fields');
    if (!tfBox) {
        tfBox = document.createElement('div');
        tfBox.id = 'admin-tf-fields';
        tfBox.className = 'hidden';
        tfBox.innerHTML = '<label>Правильный ответ (новинка):</label>' +
            '<select id="new-tf-correct"><option value="0">Верно</option><option value="1">Неверно</option></select>';
        const choices = document.getElementById('admin-choices-fields');
        if (choices && choices.parentNode) choices.parentNode.insertBefore(tfBox, choices.nextSibling);
    }
    tfBox.classList.toggle('hidden', type !== 'truefalse');
    
    const textLabel = document.getElementById('admin-text-fields')?.querySelector('label');
    if (textLabel) {
        if (type === 'voice_card') {
            textLabel.innerHTML = '🎤 Произносимое слово (можно через запятую для синонимов):';
            document.getElementById('new-correct-text').placeholder = 'привет, hello, хай';
        } else {
            textLabel.innerHTML = 'Правильный текст (через запятую для синонимов):';
            document.getElementById('new-correct-text').placeholder = 'ответ1, ответ2';
        }
    }
}

function resetAdminForm() {
    editingIndex = null;
    document.getElementById('new-title').value = '';
    document.getElementById('new-required').checked = true;
    document.getElementById('toggle-timer-input').checked = false;
    document.getElementById('timer-val-box').classList.add('hidden');
    document.getElementById('toggle-exp-input').checked = false;
    document.getElementById('exp-fields-box').classList.add('hidden');
    document.getElementById('new-exp-title').value = '';
    document.getElementById('new-exp-desc').value = '';
    document.getElementById('new-exp-timer').value = '0';
    document.getElementById('new-options').value = '';
    document.getElementById('new-correct-choices').value = '';
    document.getElementById('new-correct-text').value = '';
    
    const saveBtn = document.getElementById('save-question-btn');
    if (saveBtn) saveBtn.innerText = "Сохранить вопрос";
}

function addQuestion() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();
    const required = document.getElementById('new-required').checked;
    const useTimer = document.getElementById('toggle-timer-input').checked;
    const timer = parseInt(document.getElementById('new-timer').value) || 20;
    const useExp = document.getElementById('toggle-exp-input').checked;
    const expTitle = document.getElementById('new-exp-title').value.trim();
    const expDesc = document.getElementById('new-exp-desc').value.trim();
    const expHold = parseInt(document.getElementById('new-exp-timer').value) || 0;

    if (!title) { oldAlert("Введите текст вопроса!"); return; }
    let q = { type, title, required, useTimer, timer };
    if (useExp && expDesc) q.exp = { title: expTitle, desc: expDesc, hold: expHold };

    if (type === 'text' || type === 'voice_card') {
        const txt = document.getElementById('new-correct-text').value;
        if (!txt) { oldAlert("Укажите правильный ответ!"); return; }
        q.correctText = txt.split(',').map(s => s.trim());
    } else if (type === 'truefalse') {
        q.options = ['Верно', 'Неверно'];
        const tf = document.getElementById('new-tf-correct');
        q.correct = [parseInt(tf ? tf.value : '0', 10) || 0];
    } else {
        const opts = document.getElementById('new-options').value;
        const codes = document.getElementById('new-correct-choices').value;
        if (!opts || !codes) { oldAlert("Заполните варианты и индексы!"); return; }
        q.options = opts.split(',').map(s => s.trim()); 
        q.correct = codes.split(',').map(s => parseInt(s.trim()));
    }

    if (editingIndex !== null) {
        allForms[currentFormId].questions[editingIndex] = q;
        oldAlert("Изменения в вопросе сохранены!");
    } else {
        allForms[currentFormId].questions.push(q);
        oldAlert("Вопрос сохранен в текущую форму!");
    }

    save(); 
    resetAdminForm();
    renderAdminQuestions(); 
}

function renderAdminQuestions() {
    const list = document.getElementById('admin-questions-list');
    if (!list) return;
    
    list.innerHTML = (allForms[currentFormId].questions || []).map((q, i) => `
        <div class="question-list-item" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <span style="flex-grow:1;">${i + 1}. ${q.title} <strong>(${q.type})</strong></span>
            <div style="display:flex; gap:5px;">
                <button class="btn-secondary" onclick="editQuestion(${i})" style="margin:0; padding:6px 10px; font-size:12px; width:auto;"><span class="material-symbols-rounded" style="font-size:14px;">edit</span> Изменить</button>
                <button class="btn-danger" onclick="deleteQuestion(${i})" style="margin:0; padding:6px 10px; font-size:12px; width:auto;"><span class="material-symbols-rounded" style="font-size:14px;">delete</span></button>
            </div>
        </div>
    `).join('');
}

function editQuestion(i) {
    editingIndex = i;
    const q = allForms[currentFormId].questions[i];
    
    document.getElementById('new-type').value = q.type;
    document.getElementById('new-title').value = q.title;
    document.getElementById('new-required').checked = q.required || false;
    document.getElementById('toggle-timer-input').checked = q.useTimer || false;
    document.getElementById('new-timer').value = q.timer || 20;
    
    document.getElementById('timer-val-box').classList.toggle('hidden', !q.useTimer);

    if (q.exp) {
        document.getElementById('toggle-exp-input').checked = true;
        document.getElementById('exp-fields-box').classList.remove('hidden');
        document.getElementById('new-exp-title').value = q.exp.title || '';
        document.getElementById('new-exp-desc').value = q.exp.desc || '';
        document.getElementById('new-exp-timer').value = q.exp.hold || 0;
    } else {
        document.getElementById('toggle-exp-input').checked = false;
        document.getElementById('exp-fields-box').classList.add('hidden');
    }

    if (q.type === 'text' || q.type === 'voice_card') {
        document.getElementById('new-correct-text').value = q.correctText ? q.correctText.join(', ') : '';
    } else if (q.type === 'truefalse') {
        // fields created in toggleAdminFields
    } else {
        document.getElementById('new-options').value = q.options ? q.options.join(', ') : '';
        document.getElementById('new-correct-choices').value = q.correct ? q.correct.join(', ') : '';
    }

    toggleAdminFields();
    if (q.type === 'truefalse') {
        const tf = document.getElementById('new-tf-correct');
        if (tf) tf.value = String((q.correct && q.correct[0]) || 0);
    }
    
    const saveBtn = document.getElementById('save-question-btn');
    if (saveBtn) saveBtn.innerText = "Сохранить изменения";
    
    document.querySelector('.admin-box').scrollTop = 0;
}

async function deleteQuestion(i) {
    const ok = await oldConfirm("Удалить этот вопрос?");
    if (!ok) return;
    allForms[currentFormId].questions.splice(i, 1);
    save(); 
    renderAdminQuestions(); 
}

function exportFormToJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allForms[currentFormId]));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${allForms[currentFormId].name}.json`);
    dlAnchorElem.click();
}

function importFormFromJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.id || !imported.questions) { oldAlert("Неверный формат файла формы!"); return; }
            const newId = 'f_' + Date.now();
            allForms[newId] = { id: newId, name: imported.name || "Импортированная форма", questions: imported.questions };
            currentFormId = newId; 
            currentIndex = 0; 
            userAnswers = []; 
            save(); 
            renderQuestion();
            oldAlert("Форма успешно загружена!");
            switchScreen('quiz');
        } catch (err) { 
            oldAlert("Ошибка при чтении файла!"); 
        }
    };
    reader.readAsText(file);
}

// ==========================================
// 5.5 ОПЦИИ МЕНЮ И ФИЧА "BLACK SCREEN"
// ==========================================
function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('tools-menu');
    const btn = document.querySelector('.tools-btn');
    if (menu && !menu.classList.contains('hidden') && e.target !== menu && e.target !== btn && !btn?.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

function toggleBlackScreen() {
    let overlay = document.getElementById('black-screen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'black-screen-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = '#000000';
        overlay.style.zIndex = '99999';
        overlay.style.cursor = 'pointer';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.color = '#333';
        overlay.style.fontFamily = 'monospace';
        overlay.style.fontSize = '12px';
        overlay.innerHTML = '<span>A/V MUTE (Tap or CTRL+M to exit)</span>';
        
        overlay.onclick = () => overlay.classList.add('hidden');
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.add('hidden');
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        const overlay = document.getElementById('black-screen-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        } else {
            toggleBlackScreen();
        }
    }
});

async function generateShareLink() {
    try {
        const currentForm = allForms[currentFormId];
        if (!currentForm || !currentForm.questions || currentForm.questions.length === 0) {
            oldAlert("Нельзя поделиться пустой формой! Сначала добавьте вопросы.");
            return;
        }
        const jsonStr = JSON.stringify(currentForm);
        const byteArray = new TextEncoder().encode(jsonStr);
        const stream = new Response(byteArray).body.pipeThrough(new CompressionStream("deflate"));
        const compressedBuffer = await new Response(stream).arrayBuffer();
        const base64Str = btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)))
            .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            
        const shareUrl = `${window.location.origin}${window.location.pathname}?zip=${base64Str}`;
        await navigator.clipboard.writeText(shareUrl);
        oldAlert(`Форма "${currentForm.name}" сжата и скопирована в буфер обмена!`);
    } catch (e) {
        console.error(e);
        oldAlert("Ошибка сжатия. Используйте скачивание .json файла!");
    }
}

function speakText(text) {
    if (!('speechSynthesis' in window)) {
        oldAlert("Ваш браузер не поддерживает озвучку текста.");
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[a-zA-Z]/.test(text) ? 'en-US' : 'ru-RU';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}
