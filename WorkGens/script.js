// --- WorkGens AI state ---
function readApiKey() {
  return localStorage.getItem('wg_api_key')
    || localStorage.getItem('mywork_ai_api_key')
    || localStorage.getItem('ai_api_key')
    || '';
}

const STATE = {
  theme: localStorage.getItem('wg_theme') || 'dark',
  apiKey: readApiKey(),
  provider: localStorage.getItem('wg_provider') || 'gemini',
  geminiModel: localStorage.getItem('wg_gemini_model') || 'gemini-3.8-flash',
  model: 'plan',
  limit: parseInt(localStorage.getItem('wg_limit'), 10) || 100,
  lastReset: parseInt(localStorage.getItem('wg_last_reset'), 10) || Date.now(),
  abortController: null,
  chats: JSON.parse(localStorage.getItem('wg_chats') || '[]'),
  activeChatId: null,
  isGenerating: false,
  lastPrompt: '',
  selectedContextChatId: null,
  recognition: null,
  attachedFile: null,
  studioContent: '',
  studioStructured: null, // { type, data }
  studioSlideIndex: 0,
  activeGenService: 'document'
};

const SYSTEM_PROMPT = `Ты — WorkGens AI, ассистент экосистемы My Work (Document, Forms, Spreadsheets, Slides, Keeps).
Отвечай на русском, четко и по делу.
Если пользователь просит документ, форму, таблицу, слайды или заметки — дай полезный готовый контент.
Для структурированных проектов (форма/документ/слайды/заметки/таблица) по возможности отдавай валидный JSON под формат WorkGens Studio.`;

const PLAN_SYSTEM_PROMPT = `Ты планировщик WorkGens. Составь только краткий пошаговый план (1, 2, 3...). Без готовых статей и кода.`;

const STUDIO_PROMPTS = {
  document: `Сгенерируй документ. Ответь ТОЛЬКО валидным JSON без markdown-обёрток:
{"type":"document","title":"...","blocks":[{"type":"a4-sheet","title":"...","htmlContent":"<h1>...</h1><p>...</p>"}]}
htmlContent — HTML с заголовками и абзацами. 2-4 блока.`,
  forms: `Сгенерируй тест/форму. Ответь ТОЛЬКО валидным JSON:
{"type":"forms","title":"...","questions":[{"type":"radio","title":"Вопрос?","options":["А","Б","В","Г"],"correctChoices":[0]},{"type":"text","title":"...","correctText":["ответ"]}]}
5-7 вопросов, correctChoices — индексы с 0.`,
  slides: `Сгенерируй презентацию. Ответь ТОЛЬКО валидным JSON:
{"type":"slides","title":"...","slides":[{"type":"title-slide","title":"...","subtitle":"...","notes":"..."},{"type":"content","title":"...","bullets":"пункт1\\nпункт2","notes":"..."}]}
5-7 слайдов. bullets через \\n.`,
  keeps: `Сгенерируй заметки. Ответь ТОЛЬКО валидным JSON:
{"type":"keeps","notes":[{"title":"...","content":"<p>...</p>","pinned":false}]}
3-5 заметок, content может быть HTML.`,
  spreadsheets: `Сгенерируй таблицу. Ответь ТОЛЬКО валидным JSON без markdown-обёрток:
{"type":"spreadsheets","title":"...","headers":["Колонка1","Колонка2","Колонка3"],"rows":[["a","b","c"],["d","e","f"]],"notes":"краткая подсказка"}
3-6 колонок, 4-10 строк с реалистичными данными.`
};

document.addEventListener('DOMContentLoaded', () => {
  // migrate shut-down Gemini model ids
  const DEAD_MODELS = [
    'gemini-2.0-flash', 'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite', 'gemini-2.0-flash-lite-001',
    'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'
  ];
  if (!STATE.geminiModel || DEAD_MODELS.includes(STATE.geminiModel)) {
    STATE.geminiModel = 'gemini-3.8-flash';
    localStorage.setItem('wg_gemini_model', STATE.geminiModel);
  }
  initTheme();
  initLimitsTimer();
  initSpeechRecognition();
  renderChatList();
  setupEventListeners();
  setupContextMenu();
  checkApiKeyOnStart();
  enhanceAllSelects();
  bootFromQueryParams();
});

function bootFromQueryParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || params.get('prompt') || '';
    const autosend = params.get('autosend') === '1' || params.get('send') === '1';
    if (!q) return;
    const input = document.getElementById('promptInput');
    if (input) input.value = q;
    // clean URL without reload
    try {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', clean);
    } catch (e) {}
    if (autosend) {
      // wait a tick so listeners & key UI are ready
      setTimeout(() => {
        if (typeof sendMessage === 'function') {
          // prefer agent mode for direct asks from hub
          STATE.model = 'agent';
          const ms = document.getElementById('modelModeSelect');
          if (ms) { ms.value = 'agent'; if (ms._cselectRebuild) ms._cselectRebuild(); }
          sendMessage(q);
          if (input) input.value = '';
        }
      }, 400);
    }
  } catch (err) {
    console.warn('bootFromQueryParams', err);
  }
}

function checkApiKeyOnStart() {
  const el = document.getElementById('onboardingModal');
  if (!el) return;
  el.classList.toggle('hidden', !!STATE.apiKey);
}

function initTheme() {
  document.documentElement.setAttribute('data-theme', STATE.theme);
}

function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', STATE.theme);
  localStorage.setItem('wg_theme', STATE.theme);
}

function initLimitsTimer() {
  const THREE = 3 * 60 * 60 * 1000;
  function tick() {
    const now = Date.now();
    if (now - STATE.lastReset >= THREE) {
      STATE.limit = 100;
      STATE.lastReset = now;
      localStorage.setItem('wg_limit', '100');
      localStorage.setItem('wg_last_reset', String(now));
    }
    const rem = THREE - ((now - STATE.lastReset) % THREE);
    const h = String(Math.floor(rem / 3600000)).padStart(2, '0');
    const m = String(Math.floor((rem % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
    const t = document.getElementById('limitTimer');
    if (t) t.innerText = 'Сброс: ' + h + ':' + m + ':' + s;
    const v = document.getElementById('limitValue');
    const f = document.getElementById('limitFill');
    if (v) v.innerText = STATE.limit + '%';
    if (f) f.style.width = STATE.limit + '%';
  }
  tick();
  setInterval(tick, 1000);
}

function consumeLimit(amount) {
  STATE.limit = Math.max(0, STATE.limit - amount);
  localStorage.setItem('wg_limit', String(STATE.limit));
  const v = document.getElementById('limitValue');
  const f = document.getElementById('limitFill');
  if (v) v.innerText = STATE.limit + '%';
  if (f) f.style.width = STATE.limit + '%';
}

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('micBtn');
  if (!SR || !micBtn) {
    if (micBtn) micBtn.style.display = 'none';
    return;
  }
  STATE.recognition = new SR();
  STATE.recognition.lang = 'ru-RU';
  STATE.recognition.continuous = false;
  STATE.recognition.onstart = () => micBtn.classList.add('recording');
  STATE.recognition.onend = () => micBtn.classList.remove('recording');
  STATE.recognition.onresult = (e) => {
    const input = document.getElementById('promptInput');
    const t = e.results[0][0].transcript;
    input.value = input.value ? input.value + ' ' + t : t;
  };
  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('recording')) STATE.recognition.stop();
    else STATE.recognition.start();
  });
}

function createNewChatState() {
  STATE.activeChatId = null;
  document.getElementById('chatWelcome').classList.remove('hidden');
  document.getElementById('chatMessages').classList.add('hidden');
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('activeChatTitle').innerText = 'Новый чат';
  renderChatList();
}

function saveChats() {
  localStorage.setItem('wg_chats', JSON.stringify(STATE.chats));
}

function renderChatList() {
  const list = document.getElementById('chatList');
  if (!list) return;
  list.innerHTML = '';
  STATE.chats.forEach(chat => {
    const li = document.createElement('li');
    li.dataset.id = chat.id;
    if (chat.id === STATE.activeChatId) li.classList.add('active');
    li.innerHTML = '<span class="material-symbols-rounded">chat_bubble</span><span class="item-text">' + escapeHtml(chat.title) + '</span>';
    li.addEventListener('click', () => openChat(chat.id));
    li.addEventListener('contextmenu', (e) => showContextMenu(e, chat.id));
    list.appendChild(li);
  });
}

function openChat(id) {
  const chat = STATE.chats.find(c => c.id === id);
  if (!chat) return;
  STATE.activeChatId = chat.id;
  document.getElementById('chatWelcome').classList.add('hidden');
  const box = document.getElementById('chatMessages');
  box.classList.remove('hidden');
  box.innerHTML = '';
  (chat.messages || []).forEach(m => appendMessage(m.text, m.sender, false));
  document.getElementById('activeChatTitle').innerText = chat.title;
  renderChatList();
}

function setupContextMenu() {
  const menu = document.getElementById('contextMenu');
  document.addEventListener('click', () => menu && menu.classList.add('hidden'));
  document.getElementById('ctxRename')?.addEventListener('click', async () => {
    const chat = STATE.chats.find(c => c.id === STATE.selectedContextChatId);
    if (!chat) return;
    const newTitle = await showCustomDialog({ title: 'Переименование', message: 'Новое название:', isInput: true, defaultValue: chat.title });
    if (newTitle) {
      chat.title = newTitle;
      saveChats();
      renderChatList();
      if (chat.id === STATE.activeChatId) document.getElementById('activeChatTitle').innerText = chat.title;
      showToast('Чат переименован', 'success');
    }
  });
  document.getElementById('ctxDelete')?.addEventListener('click', async () => {
    const ok = await showCustomDialog({ title: 'Удаление', message: 'Удалить этот чат?', danger: true });
    if (ok) {
      STATE.chats = STATE.chats.filter(c => c.id !== STATE.selectedContextChatId);
      saveChats();
      if (STATE.activeChatId === STATE.selectedContextChatId) createNewChatState();
      else renderChatList();
      showToast('Чат удалён', 'success');
    }
  });
}

function showContextMenu(e, chatId) {
  e.preventDefault();
  STATE.selectedContextChatId = chatId;
  const menu = document.getElementById('contextMenu');
  menu.style.top = e.clientY + 'px';
  menu.style.left = e.clientX + 'px';
  menu.classList.remove('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function handleFileSelect(file) {
  if (!file) return;
  const reader = new FileReader();
  if (file.type.startsWith('image/')) {
    reader.onload = (e) => {
      STATE.attachedFile = { name: file.name, type: file.type, isImage: true, data: e.target.result.split(',')[1] };
      showFilePreview(file.name);
    };
    reader.readAsDataURL(file);
  } else {
    reader.onload = (e) => {
      STATE.attachedFile = { name: file.name, type: file.type, isImage: false, content: e.target.result };
      showFilePreview(file.name);
    };
    reader.readAsText(file);
  }
}

function showFilePreview(name) {
  document.getElementById('attachedFileName').innerText = name;
  document.getElementById('attachedFilePreview').classList.remove('hidden');
  showToast('Файл прикреплён: ' + name, 'info');
}

function removeAttachedFile() {
  STATE.attachedFile = null;
  const fi = document.getElementById('fileInput');
  if (fi) fi.value = '';
  document.getElementById('attachedFilePreview').classList.add('hidden');
}

/* ===== Studio structured parse & preview ===== */
function extractJson(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try { return JSON.parse(t); } catch (e) { return null; }
}

function sendToStudio(content, structured) {
  STATE.studioContent = content || '';
  STATE.studioStructured = structured || extractJson(content);
  STATE.studioSlideIndex = 0;

  // Studio opens only manually (toggle / mobile tab) — no auto-open
  const badge = document.getElementById('studioTypeBadge');
  const type = (STATE.studioStructured && STATE.studioStructured.type) || 'markdown';
  badge.innerText = 'Тип: ' + type;

  // sync export select
  const exp = document.getElementById('exportServiceSelect');
  if (exp && type && type !== 'markdown') {
    const map = { document: 'document', forms: 'forms', slides: 'slides', keeps: 'keeps', spreadsheets: 'spreadsheets' };
    if (map[type]) {
      exp.value = map[type];
      if (typeof refreshEnhancedSelect === 'function') refreshEnhancedSelect(exp);
    }
  }

  renderStudioPreview();
  showToast('Проект в Студии', 'success');
}

function renderStudioPreview() {
  const preview = document.getElementById('studioPreview');
  const slideNav = document.getElementById('studioSlideNav');
  if (!preview) return;

  if (STATE.isGenerating) {
    if (slideNav) slideNav.classList.add('hidden');
    preview.innerHTML =
      '<div class="studio-generating">' +
      '<span class="material-symbols-rounded spin-slow">psychology</span>' +
      '<p>Генерация проекта…</p>' +
      '<div class="thinking-pulser"><div class="pulse-line"></div></div>' +
      '</div>';
    return;
  }

  const data = STATE.studioStructured;

  if (!data) {
    if (slideNav) slideNav.classList.add('hidden');
    if (window.marked && STATE.studioContent) {
      preview.innerHTML = '<div class="pv-doc-readable">' + marked.parse(STATE.studioContent) + '</div>';
    } else {
      preview.innerHTML = '<pre style="white-space:pre-wrap;font-size:13px;">' + escapeHtml(STATE.studioContent || '') + '</pre>';
    }
    return;
  }

  if (data.type === 'slides' && Array.isArray(data.slides)) {
    if (slideNav) slideNav.classList.remove('hidden');
    const slides = data.slides;
    if (STATE.studioSlideIndex >= slides.length) STATE.studioSlideIndex = Math.max(0, slides.length - 1);
    if (STATE.studioSlideIndex < 0) STATE.studioSlideIndex = 0;
    const s = slides[STATE.studioSlideIndex] || {};
    const counter = document.getElementById('studioSlideCounter');
    if (counter) counter.innerText = (STATE.studioSlideIndex + 1) + ' / ' + slides.length;
    let body = '';
    if (s.type === 'title-slide' || (!s.bullets && s.subtitle !== undefined)) {
      body = '<div class="pv-slide title"><h1>' + escapeHtml(s.title || '') + '</h1><p>' + escapeHtml(s.subtitle || '') + '</p></div>';
    } else {
      const bullets = (s.bullets || '').split('\n').filter(Boolean).map(b => '<li>' + escapeHtml(b) + '</li>').join('');
      body = '<div class="pv-slide"><h2>' + escapeHtml(s.title || '') + '</h2><ul>' + bullets + '</ul></div>';
    }
    if (s.notes) body += '<div class="pv-notes"><b>Заметки докладчика:</b> ' + escapeHtml(s.notes) + '</div>';
    preview.innerHTML = body;
    return;
  }

  if (slideNav) slideNav.classList.add('hidden');

  if (data.type === 'document') {
    const blocks = data.blocks || [];
    preview.innerHTML = '<div class="pv-doc-readable"><h2 class="pv-title">' + escapeHtml(data.title || 'Документ') + '</h2>' +
      blocks.map(b => '<article class="pv-block"><h3>' + escapeHtml(b.title || '') + '</h3><div class="pv-html">' + (b.htmlContent || b.description || '') + '</div></article>').join('') +
      '</div>';
    return;
  }

  if (data.type === 'forms') {
    const qs = data.questions || [];
    preview.innerHTML = '<div class="pv-forms-interactive"><h2 class="pv-title">' + escapeHtml(data.title || 'Форма') + '</h2>' +
      qs.map((q, i) => {
        const qid = 'pv-q-' + i;
        let opts = '';
        if (q.type === 'checkbox' && Array.isArray(q.options)) {
          opts = '<div class="pv-options">' + q.options.map((o, j) => {
            const ok = (q.correctChoices || []).includes(j);
            return '<label class="pv-opt"><input type="checkbox" name="' + qid + '" data-correct="' + (ok ? '1' : '0') + '"> <span>' + escapeHtml(o) + '</span></label>';
          }).join('') + '</div>';
        } else if (Array.isArray(q.options)) {
          opts = '<div class="pv-options">' + q.options.map((o, j) => {
            const ok = (q.correctChoices || []).includes(j);
            return '<label class="pv-opt"><input type="radio" name="' + qid + '" data-correct="' + (ok ? '1' : '0') + '"> <span>' + escapeHtml(o) + '</span></label>';
          }).join('') + '</div>';
        } else if (q.type === 'truefalse' || q.type === 'true-false') {
          opts = '<div class="pv-options">' +
            '<label class="pv-opt"><input type="radio" name="' + qid + '"> <span>Верно</span></label>' +
            '<label class="pv-opt"><input type="radio" name="' + qid + '"> <span>Неверно</span></label></div>';
        } else {
          opts = '<input type="text" class="pv-text-input" placeholder="Ваш ответ…">';
          if (q.correctText) opts += '<p class="pv-muted">Эталон: ' + escapeHtml((q.correctText || []).join(', ')) + '</p>';
        }
        return '<div class="pv-q" data-qi="' + i + '"><b>' + (i + 1) + '. ' + escapeHtml(q.title || '') + '</b>' + opts + '</div>';
      }).join('') +
      '<button type="button" class="secondary-btn ripple pv-check-btn" id="pvCheckAnswersBtn"><span class="material-symbols-rounded">check</span> Проверить ответы</button></div>';
    setTimeout(() => {
      const btn = document.getElementById('pvCheckAnswersBtn');
      if (btn) btn.onclick = checkStudioFormAnswers;
    }, 0);
    return;
  }

  if (data.type === 'keeps') {
    const notes = data.notes || [];
    preview.innerHTML = '<div class="pv-keeps">' + (notes.map(n =>
      '<div class="pv-note"><h3>' + escapeHtml(n.title || '') + '</h3><div class="pv-note-body">' + (n.content || '') + '</div></div>'
    ).join('') || '<p class="studio-placeholder">Нет заметок</p>') + '</div>';
    return;
  }

  if (data.type === 'spreadsheets') {
    const headers = data.headers || [];
    const rows = data.rows || [];
    let html = '<div class="pv-sheet"><h2 class="pv-title">' + escapeHtml(data.title || 'Таблица') + '</h2>';
    html += '<div class="pv-grid-wrap"><table class="pv-grid"><thead><tr><th class="pv-corner"></th>';
    headers.forEach((h, i) => {
      html += '<th>' + escapeHtml(String.fromCharCode(65 + i)) + '<div class="pv-col-label">' + escapeHtml(h) + '</div></th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach((r, ri) => {
      html += '<tr><th>' + (ri + 1) + '</th>';
      headers.forEach((_, ci) => {
        const val = (r && r[ci] != null) ? r[ci] : '';
        html += '<td contenteditable="true" spellcheck="false">' + escapeHtml(String(val)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    if (data.notes) html += '<p class="pv-muted">' + escapeHtml(data.notes) + '</p>';
    html += '</div>';
    preview.innerHTML = html;
    return;
  }

  if (window.marked) preview.innerHTML = marked.parse(STATE.studioContent || JSON.stringify(data, null, 2));
  else preview.innerText = STATE.studioContent;
}

function checkStudioFormAnswers() {
  const preview = document.getElementById('studioPreview');
  if (!preview) return;
  preview.querySelectorAll('.pv-opt').forEach(lab => {
    lab.classList.remove('pv-right', 'pv-wrong');
    const inp = lab.querySelector('input');
    if (!inp) return;
    const correct = inp.getAttribute('data-correct') === '1';
    if (inp.checked && correct) lab.classList.add('pv-right');
    else if (inp.checked && !correct) lab.classList.add('pv-wrong');
    else if (!inp.checked && correct) lab.classList.add('pv-right');
  });
  showToast('Ответы подсвечены (✓ зелёный, ✗ красный)', 'info');
}

function exportToService() {
  const service = document.getElementById('exportServiceSelect').value;
  let data = STATE.studioStructured;

  if (!data && STATE.studioContent) {
    // fallback: wrap markdown as document
    data = {
      type: 'document',
      title: 'Импорт из WorkGens',
      blocks: [{ type: 'a4-sheet', title: 'Содержимое', htmlContent: window.marked ? marked.parse(STATE.studioContent) : '<p>' + escapeHtml(STATE.studioContent) + '</p>' }]
    };
  }

  if (!data) {
    showToast('Нет данных для экспорта', 'error');
    return;
  }

  try {
    if (service === 'document') {
      const docs = JSON.parse(localStorage.getItem('myDocsData') || '[]');
      const doc = {
        id: Date.now(),
        title: data.title || 'Документ WorkGens',
        blocks: (data.blocks || []).map((b, i) => ({
          id: Date.now() + i,
          type: b.type || 'a4-sheet',
          title: b.title || 'Блок ' + (i + 1),
          description: b.description || '',
          htmlContent: b.htmlContent || '',
          required: false
        }))
      };
      if (!doc.blocks.length && STATE.studioContent) {
        doc.blocks = [{ id: Date.now(), type: 'a4-sheet', title: 'Текст', htmlContent: window.marked ? marked.parse(STATE.studioContent) : STATE.studioContent }];
      }
      docs.push(doc);
      localStorage.setItem('myDocsData', JSON.stringify(docs));
      showToast('Импортировано в My Document', 'success');
    } else if (service === 'forms') {
      const forms = JSON.parse(localStorage.getItem('my_forms_data') || '[]');
      const form = {
        id: 'form_' + Date.now(),
        title: data.title || 'Форма WorkGens',
        mode: 'test',
        questions: (data.questions || []).map((q, i) => ({
          id: Date.now() + i,
          type: q.type || 'radio',
          title: q.title || 'Вопрос',
          options: q.options || [],
          correctChoices: q.correctChoices || [],
          correctText: q.correctText || [],
          themeId: 1
        })),
        themes: [{ id: 1, name: 'Тема 1', icon: 'school', description: '' }],
        settings: { showWrong: true, showCorrect: true }
      };
      forms.push(form);
      localStorage.setItem('my_forms_data', JSON.stringify(forms));
      showToast('Импортировано в My Forms', 'success');
    } else if (service === 'slides') {
      const decks = JSON.parse(localStorage.getItem('prestige_decks') || '[]');
      const deck = {
        id: 'deck-wg-' + Date.now(),
        title: data.title || 'Презентация WorkGens',
        slides: (data.slides || []).map(s => ({
          type: s.type || 'content',
          title: s.title || '',
          subtitle: s.subtitle || '',
          bullets: s.bullets || '',
          notes: s.notes || '',
          quoteAuthor: s.quoteAuthor || '',
          col2: s.col2 || ''
        }))
      };
      if (!deck.slides.length) {
        deck.slides = [{ type: 'title-slide', title: data.title || 'Слайд', subtitle: 'Из WorkGens' }];
      }
      decks.push(deck);
      localStorage.setItem('prestige_decks', JSON.stringify(decks));
      localStorage.setItem('prestige_current_deck_id', deck.id);
      showToast('Импортировано в My Slides', 'success');
    } else if (service === 'keeps') {
      const notes = JSON.parse(localStorage.getItem('keeps_notes') || '[]');
      const list = data.notes || [{ title: data.title || 'Заметка', content: STATE.studioContent || '' }];
      list.forEach((n, i) => {
        notes.unshift({
          id: Date.now() + i,
          title: n.title || 'Заметка',
          content: n.content || '',
          bgColor: null,
          pinned: !!n.pinned,
          archived: false,
          reminder: null
        });
      });
      localStorage.setItem('keeps_notes', JSON.stringify(notes));
      showToast('Импортировано в My Keeps', 'success');
    } else if (service === 'spreadsheets') {
      // Unified spreadsheet storage used by My Spreadsheets
      const raw = localStorage.getItem('my_spreadsheets_data') || localStorage.getItem('prestige_spreadsheets') || '[]';
      let books = [];
      try { books = JSON.parse(raw); } catch (e) { books = []; }
      if (!Array.isArray(books)) books = [];
      const headers = data.headers || ['A', 'B', 'C'];
      const rows = data.rows || [];
      const colCount = Math.max(headers.length, 8);
      const rowCount = Math.max(rows.length + 5, 40);
      const cells = {};
      headers.forEach((h, ci) => {
        cells['0_' + ci] = { value: String(h), format: {} };
      });
      rows.forEach((r, ri) => {
        (r || []).forEach((v, ci) => {
          cells[(ri + 1) + '_' + ci] = { value: String(v), format: {} };
        });
      });
      const sheet = {
        id: 'sheet_' + Date.now(),
        name: 'Лист 1',
        rows: rowCount,
        cols: colCount,
        cells: cells
      };
      const book = {
        id: 'book_wg_' + Date.now(),
        title: data.title || 'Таблица WorkGens',
        sheets: [sheet],
        activeSheetId: sheet.id
      };
      books.push(book);
      localStorage.setItem('my_spreadsheets_data', JSON.stringify(books));
      localStorage.setItem('prestige_spreadsheets', JSON.stringify(books));
      showToast('Импортировано в My Spreadsheets', 'success');
    } else {
      showToast('Неизвестный сервис', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Ошибка экспорта: ' + err.message, 'error');
  }
}

function setupEventListeners() {
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('themeToggleMobile')?.addEventListener('click', toggleTheme);

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  document.getElementById('burgerBtn')?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
  document.getElementById('collapseBtn')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const ic = document.querySelector('#collapseBtn .material-symbols-rounded');
    if (ic) ic.textContent = sidebar.classList.contains('collapsed') ? 'left_panel_open' : 'left_panel_close';
  });
  document.getElementById('newChatBtn')?.addEventListener('click', createNewChatState);

  document.querySelectorAll('.service-link').forEach(li => {
    li.addEventListener('click', () => {
      const href = li.getAttribute('data-href') || '';
      // Tables under maintenance
      if (false && href.includes('spreadsheet')) {
        showToast('Таблицы на обслуживании. Данные сохранятся, скоро вернём.', 'info');
        setTimeout(() => { window.location.href = '../index.html'; }, 600);
        return;
      }
      if (href) window.location.href = href;
    });
  });

  document.querySelectorAll('.model-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.model = chip.dataset.model;
    });
  });

  document.querySelectorAll('.quick-cards .card').forEach(card => {
    card.addEventListener('click', () => {
      document.getElementById('promptInput').value = card.dataset.prompt;
      handleSendOrStop();
    });
  });

  const fileInput = document.getElementById('fileInput');
  document.getElementById('attachFileBtn')?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
  document.getElementById('removeFileBtn')?.addEventListener('click', removeAttachedFile);

  document.getElementById('toggleStudioBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openStudioManual();
  });
  document.getElementById('closeStudioBtn')?.addEventListener('click', () => {
    if (window.innerWidth < 1024) setMobileTab('chat');
    else {
      document.getElementById('studioSidebar')?.classList.add('hidden');
      document.getElementById('appMain')?.classList.remove('studio-open');
    }
  });

  document.getElementById('exportProjectBtn')?.addEventListener('click', exportToService);

  document.getElementById('studioSlidePrev')?.addEventListener('click', () => {
    STATE.studioSlideIndex--;
    renderStudioPreview();
  });
  document.getElementById('studioSlideNext')?.addEventListener('click', () => {
    STATE.studioSlideIndex++;
    renderStudioPreview();
  });

  document.querySelectorAll('.studio-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.activeGenService = btn.dataset.gen;
      const titles = {
        document: 'Сгенерировать документ',
        forms: 'Сгенерировать форму',
        slides: 'Сгенерировать слайды',
        keeps: 'Сгенерировать заметки',
        spreadsheets: 'Сгенерировать таблицу'
      };
      document.getElementById('studioGenTitle').innerText = titles[STATE.activeGenService] || 'Генерация';
      document.getElementById('studioGenPrompt').value = '';
      document.getElementById('studioGenModal').classList.remove('hidden');
    });
  });

  document.getElementById('closeStudioGenBtn')?.addEventListener('click', () => {
    document.getElementById('studioGenModal').classList.add('hidden');
  });

  document.getElementById('studioSubmitGenBtn')?.addEventListener('click', () => {
    const promptText = document.getElementById('studioGenPrompt').value.trim();
    if (!promptText) return;
    document.getElementById('studioGenModal').classList.add('hidden');
    STATE.model = 'agent';
    const ms = document.getElementById('modelModeSelect');
    if (ms) { ms.value = 'agent'; if (ms._cselectRebuild) ms._cselectRebuild(); }
    const sys = STUDIO_PROMPTS[STATE.activeGenService] || '';
    sendMessage(promptText, true, sys);
  });

  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    document.getElementById('apiKeyInput').value = STATE.apiKey;
    document.getElementById('modelSelect').value = STATE.geminiModel;
    document.getElementById('providerSelect').value = STATE.provider;
    enhanceAllSelects(document.getElementById('settingsModal'));
    document.getElementById('settingsModal').classList.remove('hidden');
  });
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
  });
  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    // API настраивается на главной My Work — здесь только закрываем
    document.getElementById('settingsModal').classList.add('hidden');
    showToast('Готово', 'success');
  });

  document.getElementById('saveOnboardingKeyBtn')?.addEventListener('click', () => {
    const key = document.getElementById('onboardingKeyInput').value.trim();
    if (!key) {
      showToast('Введите API Key', 'error');
      return;
    }
    STATE.apiKey = key;
    localStorage.setItem('wg_api_key', key);
    document.getElementById('onboardingModal').classList.add('hidden');
    showToast('API Key сохранён', 'success');
  });

  document.getElementById('sendBtn')?.addEventListener('click', () => handleSendOrStop());
  document.getElementById('promptInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendOrStop();
    }
  });
}

function handleSendOrStop() {
  if (STATE.isGenerating) stopGeneration();
  else sendMessage();
}

async function sendMessage(overrideText = null, isStudioGen = false, studioSystemExtra = '') {
  const input = document.getElementById('promptInput');
  let text = overrideText || (input && input.value.trim()) || '';

  if (!text && STATE.attachedFile) text = 'Что на этом изображении / в файле?';
  if (!text) return;

  if (!navigator.onLine) {
    showToast('Нужен интернет для WorkGens AI', 'error');
    return;
  }
  if (STATE.limit <= 0) {
    showToast('Лимит исчерпан. Дождитесь сброса.', 'error');
    return;
  }

  STATE.lastPrompt = text;
  var _formCtx = (typeof getAttachedFormContextForPrompt === 'function') ? getAttachedFormContextForPrompt() : '';
  if (_formCtx && !text.includes('[Прикреплённая форма')) {
    // context added in API call
  }
  const fileToSend = STATE.attachedFile;

  if (!overrideText && input) {
    input.value = '';
    removeAttachedFile();
  }

  if (!STATE.activeChatId) {
    const newChat = {
      id: 'chat_' + Date.now(),
      title: text.length > 22 ? text.substring(0, 22) + '...' : text,
      messages: []
    };
    STATE.chats.unshift(newChat);
    STATE.activeChatId = newChat.id;
    saveChats();
    renderChatList();
  }

  document.getElementById('chatWelcome').classList.add('hidden');
  document.getElementById('chatMessages').classList.remove('hidden');

  const userMsgText = fileToSend ? '[Файл: ' + fileToSend.name + ']\n' + text : text;
  appendMessage(userMsgText, 'user');

  const cost = STATE.model === 'plan' ? 2 : 10;
  consumeLimit(cost);
  setGenerationState(true);
  STATE.abortController = new AbortController();

  try {
    const responseText = await fetchAIResponse(
      text,
      fileToSend,
      STATE.abortController.signal,
      STATE.model === 'plan',
      studioSystemExtra || (isStudioGen ? STUDIO_PROMPTS[STATE.activeGenService] : '')
    );

    if (STATE.model === 'plan') {
      appendMessage('📋 **План:**\n\n' + responseText + '\n\n---\n💡 Переключитесь на **Agent**, чтобы реализовать план.', 'ai');
    } else {
      appendMessage(responseText, 'ai');
      const structured = extractJson(responseText);
      if (isStudioGen || structured) {
        sendToStudio(responseText, structured);
        if (structured) {
          appendStudioOpenButton();
        }
      }
    }
  } catch (err) {
    consumeLimit(-cost);
    if (err.name === 'AbortError') appendStoppedUI(text);
    else {
      appendErrorUI(err.message, text);
      showToast('Ошибка: ' + err.message, 'error');
    }
  } finally {
    setGenerationState(false);
  }
}

function appendStudioOpenButton() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const box = document.createElement('div');
  box.className = 'studio-open-row';
  box.innerHTML = '<button type="button" class="secondary-btn ripple studio-open-btn"><span class="material-symbols-rounded filled">auto_awesome</span> Открыть в Студии</button>';
  box.querySelector('button').addEventListener('click', () => {
    if (typeof openStudioManual === 'function') openStudioManual();
    else document.getElementById('studioSidebar')?.classList.remove('hidden');
  });
  container.appendChild(box);
  container.scrollTop = container.scrollHeight;
}

function stopGeneration() {
  if (STATE.abortController) STATE.abortController.abort();
}

function appendErrorUI(errorMessage, originalPrompt) {
  const container = document.getElementById('chatMessages');
  const errorBox = document.createElement('div');
  errorBox.className = 'stopped-action-box error-action-box';
  errorBox.innerHTML = '<div class="stopped-title"><span class="material-symbols-rounded">error_outline</span><span>' +
    escapeHtml(errorMessage) + '</span></div><div class="stopped-btns"><button type="button" class="secondary-btn retry-btn ripple"><span class="material-symbols-rounded">refresh</span> Повторить</button></div>';
  errorBox.querySelector('.retry-btn').addEventListener('click', () => {
    errorBox.remove();
    sendMessage(originalPrompt);
  });
  container.appendChild(errorBox);
  container.scrollTop = container.scrollHeight;
}

function setGenerationState(isGenerating) {
  STATE.isGenerating = isGenerating;
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    if (isGenerating) {
      sendBtn.classList.add('stop-mode');
      sendBtn.classList.remove('hidden');
      sendBtn.title = 'Остановить';
      sendBtn.innerHTML = '<span class="material-symbols-rounded filled">stop</span><span>Стоп</span>';
      showInlineThinking(true);
    } else {
      sendBtn.classList.remove('stop-mode');
      sendBtn.title = 'Отправить';
      sendBtn.innerHTML = '<span class="material-symbols-rounded filled" id="sendBtnIcon">arrow_upward</span>';
      showInlineThinking(false);
      updateSendButtonVisibility();
    }
  }
  // Update studio preview if already open; never auto-open
  const studio = document.getElementById('studioSidebar');
  const studioVisible = studio && !studio.classList.contains('hidden');
  if (isGenerating && studioVisible) {
    const badge = document.getElementById('studioTypeBadge');
    if (badge) badge.innerText = 'Тип: генерация…';
    renderStudioPreview();
  } else if (!isGenerating && STATE.studioStructured) {
    renderStudioPreview();
  } else if (!isGenerating) {
    const preview = document.getElementById('studioPreview');
    if (preview && preview.querySelector('.studio-generating') && !STATE.studioStructured && !STATE.studioContent) {
      preview.innerHTML = '<p class="studio-placeholder">Сгенерируйте проект в чате. Откройте Студию вручную.</p>';
    }
  }
  updateSendButtonVisibility();
}

function appendStoppedUI(originalPrompt) {
  const container = document.getElementById('chatMessages');
  const actionBox = document.createElement('div');
  actionBox.className = 'stopped-action-box';
  actionBox.innerHTML = '<div class="stopped-title"><span class="material-symbols-rounded">block</span><span>Генерация остановлена</span></div>' +
    '<div class="stopped-btns"><button type="button" class="secondary-btn retry-btn ripple">Повторить</button>' +
    '<button type="button" class="secondary-btn edit-btn ripple">Изменить</button></div>';
  actionBox.querySelector('.retry-btn').addEventListener('click', () => { actionBox.remove(); sendMessage(originalPrompt); });
  actionBox.querySelector('.edit-btn').addEventListener('click', () => {
    document.getElementById('promptInput').value = originalPrompt;
    actionBox.remove();
  });
  container.appendChild(actionBox);
  container.scrollTop = container.scrollHeight;
}

async function fetchAIResponse(userPrompt, fileData, signal, isPlanMode, studioExtra) {
  if (STATE.provider !== 'gemini') {
    throw new Error('Провайдер «' + STATE.provider + '» пока не подключён. Выберите Gemini в настройках.');
  }
  return fetchGeminiResponse(userPrompt, fileData, signal, isPlanMode, studioExtra);
}

async function fetchGeminiResponse(userPrompt, fileData, signal, isPlanMode, studioExtra) {
  const apiKey = STATE.apiKey;
  if (!apiKey) {
    checkApiKeyOnStart();
    throw new Error('Нет API Key. Добавьте ключ в настройках.');
  }

  const model = STATE.geminiModel || 'gemini-3.8-flash';
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(apiKey);

  const parts = [];
  if (fileData && fileData.isImage) {
    parts.push({ inline_data: { mime_type: fileData.type, data: fileData.data } });
  }

  let system = isPlanMode ? PLAN_SYSTEM_PROMPT : SYSTEM_PROMPT;
  if (studioExtra) system += '\n\n' + studioExtra;

  let textPayload = system + '\n\nЗапрос пользователя:\n' + userPrompt + ((typeof getAttachedFormContextForPrompt === 'function') ? getAttachedFormContextForPrompt() : '');
  if (fileData && !fileData.isImage) {
    textPayload = '[Файл ' + fileData.name + ']:\n' + String(fileData.content).slice(0, 12000) + '\n\n' + textPayload;
  }
  parts.push({ text: textPayload });

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: isPlanMode ? 512 : 4096,
      temperature: isPlanMode ? 0.2 : (studioExtra ? 0.4 : 0.7)
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 429) throw new Error('Лимит Google API (429). Подождите или смените ключ/модель.');
    if (res.status === 400 || res.status === 403) throw new Error(errData.error?.message || 'Неверный ключ или модель.');
    throw new Error(errData.error?.message || 'HTTP ' + res.status);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw new Error('Пустой ответ модели.');
  return text;
}

function appendMessage(text, sender, save = true) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  // clear is-last on previous user wraps
  if (sender === 'user') {
    container.querySelectorAll('.message-wrap.user.is-last').forEach(el => el.classList.remove('is-last'));
  }

  const wrap = document.createElement('div');
  wrap.className = 'message-wrap ' + sender + (sender === 'user' ? ' is-last' : '');
  wrap.dataset.sender = sender;
  wrap.dataset.text = text;

  const msgEl = document.createElement('div');
  msgEl.className = 'message ' + sender;
  if (sender === 'ai' && window.marked) {
    msgEl.innerHTML = marked.parse(text);
  } else {
    msgEl.innerText = text;
  }
  wrap.appendChild(msgEl);

  if (sender === 'user') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.innerHTML =
      '<button type="button" class="msg-action-btn msg-copy"><span class="material-symbols-rounded">content_copy</span> Копировать</button>' +
      '<button type="button" class="msg-action-btn msg-edit"><span class="material-symbols-rounded">edit</span> Изменить</button>';
    actions.querySelector('.msg-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(text).then(() => showToast('Скопировано', 'success')).catch(() => showToast('Не удалось скопировать', 'error'));
    });
    const editBtn = actions.querySelector('.msg-edit');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditLastRequest(wrap, text);
    });
    wrap.appendChild(actions);
    // Edit only on last user message (CSS also hides .msg-edit for non-last)
  }

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;

  if (save && STATE.activeChatId) {
    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (chat) {
      chat.messages.push({ text, sender });
      saveChats();
    }
  }
}

function showInlineThinking(show) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  let el = document.getElementById('thinkingInline');
  if (!show) {
    if (el) el.remove();
    return;
  }
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'thinkingInline';
  el.className = 'thinking-inline';
  el.innerHTML = '<div class="thinking-header"><span class="material-symbols-rounded spin-slow filled">psychology</span><span class="thinking-title">Думаю…</span></div><div class="thinking-pulser"><div class="pulse-line"></div></div>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function startEditLastRequest(wrapEl, text) {
  STATE.editMode = true;
  STATE.editOriginalText = text;
  document.body.classList.add('edit-request-mode');
  document.querySelectorAll('.message-wrap.editing-target').forEach(w => w.classList.remove('editing-target'));
  if (wrapEl) wrapEl.classList.add('editing-target');

  const input = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendBtn');
  const editBtn = document.getElementById('editCommitBtn');
  if (input) {
    input.value = text;
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
  }
  if (sendBtn) sendBtn.classList.add('hidden');
  if (editBtn) editBtn.classList.remove('hidden');
  updateSendButtonVisibility();
}

function cancelEditRequestMode() {
  STATE.editMode = false;
  STATE.editOriginalText = '';
  document.body.classList.remove('edit-request-mode');
  document.querySelectorAll('.message-wrap.editing-target').forEach(w => w.classList.remove('editing-target'));
  const editBtn = document.getElementById('editCommitBtn');
  if (editBtn) editBtn.classList.add('hidden');
  updateSendButtonVisibility();
}

function commitEditAndResend() {
  const input = document.getElementById('promptInput');
  const text = (input && input.value.trim()) || '';
  if (!text) return;

  // Update last user message in UI + storage
  const last = document.querySelector('.message-wrap.user.is-last, .message-wrap.user.editing-target');
  if (last) {
    last.dataset.text = text;
    const msg = last.querySelector('.message');
    if (msg) msg.innerText = text;
    // rebind copy
    const copyBtn = last.querySelector('.msg-copy');
    if (copyBtn) {
      const nb = copyBtn.cloneNode(true);
      copyBtn.parentNode.replaceChild(nb, copyBtn);
      nb.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(() => showToast('Скопировано', 'success'));
      });
    }
  }
  if (STATE.activeChatId) {
    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (chat && chat.messages && chat.messages.length) {
      for (let i = chat.messages.length - 1; i >= 0; i--) {
        if (chat.messages[i].sender === 'user') {
          chat.messages[i].text = text;
          break;
        }
      }
      // drop trailing AI after last user for clean resend
      while (chat.messages.length && chat.messages[chat.messages.length - 1].sender === 'ai') {
        chat.messages.pop();
      }
      saveChats();
    }
  }
  // remove AI messages after last user in DOM
  if (last) {
    let n = last.nextSibling;
    while (n) {
      const next = n.nextSibling;
      if (n.classList && (n.classList.contains('message-wrap') || n.id === 'thinkingInline' || n.classList.contains('stopped-action-box') || n.classList.contains('studio-open-row'))) {
        n.remove();
      }
      n = next;
    }
  }

  cancelEditRequestMode();
  if (input) input.value = '';
  sendMessage(text);
}

function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  const icon = type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info';
  toast.innerHTML = '<span class="material-symbols-rounded toast-icon">' + icon + '</span><span>' + escapeHtml(message) + '</span>';
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3500);
}

function showCustomDialog({ title, message, isInput, defaultValue, danger }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customDialogModal');
    document.getElementById('dialogTitle').innerText = title || 'Подтверждение';
    document.getElementById('dialogMessage').innerText = message || '';
    const inputEl = document.getElementById('dialogInput');
    const okBtn = document.getElementById('dialogOkBtn');
    const cancelBtn = document.getElementById('dialogCancelBtn');
    const iconEl = document.getElementById('dialogIcon');
    if (isInput) {
      inputEl.classList.remove('hidden');
      inputEl.value = defaultValue || '';
    } else {
      inputEl.classList.add('hidden');
      inputEl.value = '';
    }
    if (danger) {
      okBtn.style.background = 'var(--stop-red)';
      iconEl.style.color = 'var(--stop-red)';
      iconEl.innerText = 'warning';
    } else {
      okBtn.style.background = 'var(--accent)';
      iconEl.style.color = 'var(--accent)';
      iconEl.innerText = isInput ? 'edit' : 'help_outline';
    }
    modal.classList.remove('hidden');
    if (isInput) setTimeout(() => inputEl.focus(), 80);
    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    okBtn.onclick = () => { cleanup(); resolve(isInput ? inputEl.value.trim() : true); };
    cancelBtn.onclick = () => { cleanup(); resolve(isInput ? null : false); };
  });
}


/* Custom select — closed by default, flip up if no space below */
function toggleCSelect(uid) {
  const el = document.getElementById(uid);
  if (!el) return;
  const dd = el.querySelector('.cselect-dropdown');
  if (!dd) return;
  const isOpen = el.classList.contains('open') && !dd.classList.contains('hidden');

  // close all others first
  document.querySelectorAll('.cselect').forEach(c => {
    c.classList.remove('open', 'drop-up');
    const d = c.querySelector('.cselect-dropdown');
    if (d) d.classList.add('hidden');
  });

  if (isOpen) return; // was open → stay closed

  dd.classList.remove('hidden');
  el.classList.add('open');

  // position: open upward if not enough space below
  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    const ddH = dd.offsetHeight || 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < ddH + 8 && spaceAbove > spaceBelow) {
      el.classList.add('drop-up');
    } else {
      el.classList.remove('drop-up');
    }
  });
}

function pickCSelect(uid, value, label) {
  const el = document.getElementById(uid);
  if (!el) return;
  el.dataset.value = value;
  const lab = el.querySelector('.cselect-label');
  if (lab) lab.textContent = label || value;
  el.querySelectorAll('.cselect-option').forEach(o => {
    o.classList.toggle('active', o.getAttribute('data-value') === value);
  });
  el.querySelector('.cselect-dropdown')?.classList.add('hidden');
  el.classList.remove('open', 'drop-up');
  const nativeId = el.getAttribute('data-native-id');
  if (nativeId) {
    const sel = document.getElementById(nativeId);
    if (sel) {
      sel.value = value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.cselect')) {
    document.querySelectorAll('.cselect').forEach(c => {
      c.classList.remove('open', 'drop-up');
      const d = c.querySelector('.cselect-dropdown');
      if (d) d.classList.add('hidden');
    });
  }
});

function enhanceNativeSelect(selectEl) {
  if (!selectEl || selectEl.tagName !== 'SELECT') return;
  if (selectEl.dataset.cselectEnhanced === '1') {
    if (typeof selectEl._cselectRebuild === 'function') selectEl._cselectRebuild();
    return;
  }
  selectEl.dataset.cselectEnhanced = '1';
  selectEl.classList.add('cselect-native-hidden');
  const wrapper = selectEl.closest('.custom-select-wrapper');
  if (wrapper) {
    const icon = wrapper.querySelector('.select-icon');
    if (icon) icon.style.display = 'none';
  }
  const uid = 'cs-' + (selectEl.id || Math.random().toString(36).slice(2, 8));
  if (!selectEl.id) selectEl.id = uid + '-n';
  const box = document.createElement('div');
  box.className = 'cselect';
  box.id = uid;
  box.setAttribute('data-native-id', selectEl.id);

  function rebuild() {
    const opts = Array.from(selectEl.options).map(o => ({
      value: o.value,
      label: o.textContent,
      disabled: o.disabled
    }));
    let label = '—';
    opts.forEach(o => { if (o.value === selectEl.value) label = o.label; });
    box.innerHTML =
      '<button type="button" class="cselect-trigger" onclick="event.stopPropagation();toggleCSelect(\'' + uid + '\')">' +
      '<span class="cselect-label">' + escapeHtml(label) + '</span>' +
      '<span class="material-symbols-rounded cselect-arrow">expand_more</span></button>' +
      '<div class="cselect-dropdown hidden">' +
      opts.filter(o => !o.disabled).map(o => {
        const act = o.value === selectEl.value ? ' active' : '';
        return '<div class="cselect-option' + act + '" data-value="' + escapeHtml(o.value) +
          '" onclick="event.stopPropagation();pickCSelect(\'' + uid + '\',\'' +
          String(o.value).replace(/'/g, "\\'") + '\',\'' +
          String(o.label).replace(/'/g, "\\'") + '\')">' +
          escapeHtml(o.label) + '</div>';
      }).join('') + '</div>';
  }
  rebuild();
  selectEl._cselectRebuild = rebuild;
  if (wrapper) wrapper.appendChild(box);
  else selectEl.parentNode.insertBefore(box, selectEl.nextSibling);
}

function refreshEnhancedSelect(sel) {
  if (sel && typeof sel._cselectRebuild === 'function') sel._cselectRebuild();
}

function enhanceAllSelects(root) {
  (root || document).querySelectorAll('select').forEach(enhanceNativeSelect);
}



/* ===== Redesign helpers: composer, mobile tabs, model select ===== */
function updateSendButtonVisibility() {
  const input = document.getElementById('promptInput');
  const btn = document.getElementById('sendBtn');
  if (!btn) return;
  if (STATE.isGenerating) {
    btn.classList.remove('hidden');
    return;
  }
  const has = input && input.value.trim().length > 0;
  btn.classList.toggle('hidden', !has);
}

function setMobileTab(tab) {
  document.body.classList.toggle('tab-chat', tab === 'chat');
  document.body.classList.toggle('tab-studio', tab === 'studio');
  document.querySelectorAll('.mobile-tab').forEach(t => {
    const on = t.dataset.tab === tab;
    t.classList.toggle('active', on);
    const icon = t.querySelector('.material-symbols-rounded');
    if (icon) icon.classList.toggle('filled', on);
  });
  const studio = document.getElementById('studioSidebar');
  if (tab === 'studio') {
    if (studio) studio.classList.remove('hidden');
    renderStudioPreview();
  } else if (window.innerWidth < 1024 && studio) {
    studio.classList.add('hidden');
  }
}

function openStudioManual() {
  const studio = document.getElementById('studioSidebar');
  const main = document.getElementById('appMain');
  if (window.innerWidth < 1024) {
    setMobileTab('studio');
    if (studio) studio.classList.remove('hidden');
  } else {
    if (!studio) return;
    const willOpen = studio.classList.contains('hidden');
    studio.classList.toggle('hidden', !willOpen);
    if (main) main.classList.toggle('studio-open', willOpen);
    if (willOpen) renderStudioPreview();
  }
}

function syncModelFromSelect() {
  const sel = document.getElementById('modelModeSelect');
  if (!sel) return;
  STATE.model = sel.value === 'plan' ? 'plan' : 'agent';
}

function initRedesignUI() {
  // default mobile tab
  setMobileTab('chat');

  const input = document.getElementById('promptInput');
  if (input) {
    input.addEventListener('input', updateSendButtonVisibility);
    // single-line: Enter sends
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendOrStop();
      }
    });
  }
  updateSendButtonVisibility();

  document.getElementById('tabChat')?.addEventListener('click', () => setMobileTab('chat'));
  document.getElementById('tabStudio')?.addEventListener('click', () => setMobileTab('studio'));

  // model mode select
  const modeSel = document.getElementById('modelModeSelect');
  if (modeSel) {
    modeSel.value = STATE.model === 'plan' ? 'plan' : 'agent';
    modeSel.addEventListener('change', syncModelFromSelect);
  }

  // quick cards
  document.querySelectorAll('.card[data-prompt]').forEach(card => {
    card.addEventListener('click', () => {
      const p = card.getAttribute('data-prompt');
      if (!p) return;
      STATE.model = 'agent';
      const ms = document.getElementById('modelModeSelect');
      if (ms) { ms.value = 'agent'; if (ms._cselectRebuild) ms._cselectRebuild(); }
      sendMessage(p);
    });
  });

  // studio toggle bound in setupEventListeners via openStudioManual

  // lucide optional
  try {
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  } catch (e) {}
}

// Hook into existing DOMContentLoaded chain
const _origBoot = document.addEventListener;
document.addEventListener('DOMContentLoaded', () => {
  // re-read hub key if settings empty
  if (!STATE.apiKey) STATE.apiKey = readApiKey();
  initRedesignUI();
  enhanceAllSelects();
  const modeSel = document.getElementById('modelModeSelect');
  if (modeSel && modeSel._cselectRebuild) modeSel._cselectRebuild();
});

// Override appendStudioOpenButton to suggest manual open
function appendStudioOpenButton() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const box = document.createElement('div');
  box.className = 'studio-open-row';
  box.innerHTML = '<button type="button" class="secondary-btn ripple studio-open-btn"><span class="material-symbols-rounded filled">auto_awesome</span> Открыть в Студии</button>';
  box.querySelector('button').addEventListener('click', () => openStudioManual());
  container.appendChild(box);
  container.scrollTop = container.scrollHeight;
}


document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('libraryBtn')?.addEventListener('click', () => {
    document.getElementById('libraryModal')?.classList.remove('hidden');
  });
  document.getElementById('closeLibraryBtn')?.addEventListener('click', () => {
    document.getElementById('libraryModal')?.classList.add('hidden');
  });
  document.getElementById('libraryModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'libraryModal') e.target.classList.add('hidden');
  });
  document.querySelectorAll('.theme-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-theme-set');
      if (!t) return;
      STATE.theme = t;
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('wg_theme', t);
      showToast(t === 'dark' ? 'Тёмная тема' : 'Светлая тема', 'success');
    });
  });
  document.getElementById('editCommitBtn')?.addEventListener('click', () => commitEditAndResend());
  // Escape cancels edit mode
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && STATE.editMode) {
      cancelEditRequestMode();
      const input = document.getElementById('promptInput');
      if (input) input.value = '';
      updateSendButtonVisibility();
    }
  });
});


/* ===== Attached form from My Form ===== */
function loadAttachedFormFromForms() {
    try {
        var params = new URLSearchParams(window.location.search);
        if (params.get('attach') !== '1' && params.get('from') !== 'forms') {
            // still try session
        }
        var raw = sessionStorage.getItem('wg_attached_form');
        if (!raw) return;
        var data = JSON.parse(raw);
        if (!data || !data.form) return;
        STATE.attachedForm = data;
        renderAttachedFormChip(data);
    } catch (e) {
        console.warn('attached form', e);
    }
}

function renderAttachedFormChip(data) {
    var dock = document.getElementById('composerDock') || document.querySelector('.composer-dock') || document.querySelector('.input-area');
    if (!dock) return;
    var existing = document.getElementById('wg-form-attach');
    if (existing) existing.remove();
    var chip = document.createElement('div');
    chip.id = 'wg-form-attach';
    chip.className = 'wg-form-attach';
    chip.innerHTML =
        '<div class="wg-form-attach-main">' +
        '<span class="material-symbols-rounded filled">assignment</span>' +
        '<div class="wg-form-attach-meta">' +
        '<strong>Прикреплена форма</strong>' +
        '<span>' + escapeHtml((data && data.title) || 'Без названия') + '</span>' +
        '</div></div>' +
        '<button type="button" class="icon-btn" title="Открепить" id="wg-form-detach">' +
        '<span class="material-symbols-rounded">close</span></button>';
    dock.insertBefore(chip, dock.firstChild);
    document.getElementById('wg-form-detach')?.addEventListener('click', function() {
        try { sessionStorage.removeItem('wg_attached_form'); } catch (e) {}
        STATE.attachedForm = null;
        chip.remove();
        showToast('Форма откреплена', 'info');
    });
}

function getAttachedFormContextForPrompt() {
    if (!STATE.attachedForm || !STATE.attachedForm.form) return '';
    try {
        var f = STATE.attachedForm.form;
        var slim = {
            title: f.title || f.name,
            questions: (f.questions || []).map(function(q) {
                return {
                    type: q.type,
                    title: q.title,
                    options: q.options,
                    correctChoices: q.correctChoices,
                    correctText: q.correctText
                };
            })
        };
        return '\n\n[Прикреплённая форма My Form для анализа/правок]\n' + JSON.stringify(slim).slice(0, 12000);
    } catch (e) {
        return '';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadAttachedFormFromForms();
});


/* ===== Attach: My Work project OR file ===== */
function positionAttachMenu() {
  var menu = document.getElementById('attachSourceMenu');
  var btn = document.getElementById('attachFileBtn');
  if (!menu || !btn) return;
  var rect = btn.getBoundingClientRect();
  var top = rect.bottom + 8;
  var left = rect.left;
  menu.classList.remove('hidden');
  // measure after show
  requestAnimationFrame(function() {
    var mh = menu.offsetHeight || 120;
    if (top + mh > window.innerHeight - 12) {
      top = Math.max(12, rect.top - mh - 8);
    }
    if (left + menu.offsetWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - menu.offsetWidth - 12);
    }
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  });
}

function hideAttachSourceMenu() {
  var menu = document.getElementById('attachSourceMenu');
  if (menu) menu.classList.add('hidden');
}

function openAttachSourceMenu(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  var menu = document.getElementById('attachSourceMenu');
  if (!menu) {
    document.getElementById('fileInput')?.click();
    return;
  }
  if (!menu.classList.contains('hidden')) {
    hideAttachSourceMenu();
    return;
  }
  positionAttachMenu();
}

function openMwProjectPicker() {
  hideAttachSourceMenu();
  var modal = document.getElementById('mwProjectPickerModal');
  var list = document.getElementById('mwProjectPickerList');
  if (!modal || !list) return;
  list.innerHTML = '';
  var projects = [];
  try {
    var reg = JSON.parse(localStorage.getItem('mywork_registry_v1') || '[]');
    if (Array.isArray(reg)) projects = reg;
  } catch (e) {}
  // also forms from my_forms_data
  try {
    var forms = JSON.parse(localStorage.getItem('my_forms_data') || '[]');
    if (Array.isArray(forms)) {
      forms.forEach(function(f, i) {
        projects.push({
          id: 'form-local-' + i,
          type: 'form',
          title: f.title || f.name || ('Форма ' + (i + 1)),
          legacyIndex: i,
          legacyKey: 'my_forms_data',
          updatedAt: f.updatedAt || 0,
          _formData: f
        });
      });
    }
  } catch (e2) {}

  // dedupe by title+type roughly
  if (!projects.length) {
    list.innerHTML = '<p class="help-text" style="text-align:center;padding:16px;">Пока нет проектов в My Work на этом устройстве</p>';
  } else {
    projects.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    projects.slice(0, 40).forEach(function(p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mw-project-item';
      var icon = 'folder';
      if (p.type === 'form' || p.type === 'forms') icon = 'assignment';
      else if (p.type === 'document' || p.type === 'doc') icon = 'description';
      else if (p.type === 'slides' || p.type === 'slide') icon = 'slideshow';
      else if (p.type === 'spreadsheet' || p.type === 'table') icon = 'table_chart';
      else if (p.type === 'keeps' || p.type === 'note') icon = 'keep';
      else if (p.type === 'mindmap') icon = 'account_tree';
      btn.innerHTML =
        '<span class="material-symbols-rounded">' + icon + '</span>' +
        '<div class="mw-meta"><strong></strong><span></span></div>';
      btn.querySelector('strong').textContent = p.title || 'Без названия';
      btn.querySelector('span:last-child').textContent = (p.type || 'project') + (p.updatedAt ? ' · ' + new Date(p.updatedAt).toLocaleDateString() : '');
      btn.addEventListener('click', function() {
        attachMyWorkProject(p);
      });
      list.appendChild(btn);
    });
  }
  modal.classList.remove('hidden');
}

function closeMwProjectPicker() {
  document.getElementById('mwProjectPickerModal')?.classList.add('hidden');
}

function attachMyWorkProject(p) {
  closeMwProjectPicker();
  var formData = p._formData || null;
  if (!formData && (p.type === 'form' || p.type === 'forms') && p.legacyKey === 'my_forms_data' && p.legacyIndex != null) {
    try {
      var forms = JSON.parse(localStorage.getItem('my_forms_data') || '[]');
      formData = forms[p.legacyIndex] || null;
    } catch (e) {}
  }
  var payload = {
    source: 'my-work',
    attachedAt: Date.now(),
    type: p.type || 'project',
    title: p.title || 'Проект',
    projectId: p.id,
    form: formData,
    meta: p
  };
  try {
    sessionStorage.setItem('wg_attached_form', JSON.stringify(payload));
  } catch (e) {}
  STATE.attachedForm = payload;
  if (typeof renderAttachedFormChip === 'function') renderAttachedFormChip(payload);
  else showAttachedProjectFallback(payload);
  showToast('Проект прикреплён: ' + (payload.title || ''), 'success');
}

function showAttachedProjectFallback(data) {
  var dock = document.getElementById('composerDock') || document.querySelector('.composer-dock') || document.querySelector('.input-area');
  if (!dock) return;
  var existing = document.getElementById('wg-form-attach');
  if (existing) existing.remove();
  var chip = document.createElement('div');
  chip.id = 'wg-form-attach';
  chip.className = 'wg-form-attach';
  chip.innerHTML =
    '<div class="wg-form-attach-main">' +
    '<span class="material-symbols-rounded filled">folder_open</span>' +
    '<div class="wg-form-attach-meta"><strong>Прикреплён проект My Work</strong><span></span></div></div>' +
    '<button type="button" class="icon-btn" id="wg-form-detach"><span class="material-symbols-rounded">close</span></button>';
  chip.querySelector('.wg-form-attach-meta span').textContent = (data && data.title) || 'Проект';
  dock.insertBefore(chip, dock.firstChild);
  document.getElementById('wg-form-detach')?.addEventListener('click', function() {
    try { sessionStorage.removeItem('wg_attached_form'); } catch (e) {}
    STATE.attachedForm = null;
    chip.remove();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var attachBtn = document.getElementById('attachFileBtn');
  if (attachBtn) {
    // remove pure file-open listeners by cloning
    var neo = attachBtn.cloneNode(true);
    attachBtn.parentNode.replaceChild(neo, attachBtn);
    neo.id = 'attachFileBtn';
    neo.addEventListener('click', openAttachSourceMenu);
  }
  document.getElementById('attachFromFile')?.addEventListener('click', function() {
    hideAttachSourceMenu();
    document.getElementById('fileInput')?.click();
  });
  document.getElementById('attachFromMyWork')?.addEventListener('click', openMwProjectPicker);
  document.getElementById('closeMwPickerBtn')?.addEventListener('click', closeMwProjectPicker);
  document.getElementById('mwProjectPickerModal')?.addEventListener('click', function(e) {
    if (e.target.id === 'mwProjectPickerModal') closeMwProjectPicker();
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#attachSourceMenu') && !e.target.closest('#attachFileBtn')) {
      hideAttachSourceMenu();
    }
  });
});
