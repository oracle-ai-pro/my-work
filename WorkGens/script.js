// --- WorkGens AI state ---
const STATE = {
  theme: localStorage.getItem('wg_theme') || 'dark',
  apiKey: localStorage.getItem('wg_api_key') || '',
  provider: localStorage.getItem('wg_provider') || 'gemini',
  geminiModel: localStorage.getItem('wg_gemini_model') || 'gemini-3.6-flash',
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

const SYSTEM_PROMPT = `Ты — WorkGens AI, ассистент экосистемы My Work (Document, Forms, Slides, Keeps; Spreadsheets временно недоступны).
Отвечай на русском, четко и по делу.
Если пользователь просит документ/форму/слайды/заметки — дай полезный готовый контент.
ВАЖНО: сервис «Таблицы» (My Spreadsheets) сейчас на техническом обслуживании (примерно 2–3 дня). Данные пользователей не теряются. Не предлагай открывать или импортировать таблицы. Если просят таблицу — кратко объясни, что сервис на ТО, предложи альтернативу (форма, документ или заметка) или общую структуру «на будущее», без экспорта в Spreadsheets.`;

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
  spreadsheets: `Сервис My Spreadsheets сейчас на техническом обслуживании. НЕ генерируй JSON таблиц для импорта.
Ответь обычным текстом на русском: что таблицы временно недоступны (2–3 дня), данные сохранятся, извините за неудобства.
По желанию предложи структуру таблицы «на будущее» простым текстом (колонки, пример строк) без JSON и без экспорта.`
};

document.addEventListener('DOMContentLoaded', () => {
  // migrate deprecated Gemini models
  if (!STATE.geminiModel || STATE.geminiModel === 'gemini-2.0-flash') {
    STATE.geminiModel = 'gemini-3.6-flash';
    localStorage.setItem('wg_gemini_model', 'gemini-3.6-flash');
  }
  initTheme();
  initLimitsTimer();
  initSpeechRecognition();
  renderChatList();
  setupEventListeners();
  setupContextMenu();
  checkApiKeyOnStart();
  enhanceAllSelects();
});

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

  const studio = document.getElementById('studioSidebar');
  studio.classList.remove('hidden');

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
  const data = STATE.studioStructured;

  if (!data) {
    slideNav.classList.add('hidden');
    if (window.marked && STATE.studioContent) {
      preview.innerHTML = marked.parse(STATE.studioContent);
    } else {
      preview.innerHTML = '<pre style="white-space:pre-wrap;font-size:13px;">' + escapeHtml(STATE.studioContent || '') + '</pre>';
    }
    return;
  }

  if (data.type === 'slides' && Array.isArray(data.slides)) {
    slideNav.classList.remove('hidden');
    const slides = data.slides;
    if (STATE.studioSlideIndex >= slides.length) STATE.studioSlideIndex = slides.length - 1;
    if (STATE.studioSlideIndex < 0) STATE.studioSlideIndex = 0;
    const s = slides[STATE.studioSlideIndex] || {};
    document.getElementById('studioSlideCounter').innerText = (STATE.studioSlideIndex + 1) + ' / ' + slides.length;
    let body = '';
    if (s.type === 'title-slide' || !s.bullets) {
      body = '<div class="pv-slide title"><h1>' + escapeHtml(s.title || '') + '</h1><p>' + escapeHtml(s.subtitle || '') + '</p></div>';
    } else {
      const bullets = (s.bullets || '').split('\n').filter(Boolean).map(b => '<li>' + escapeHtml(b) + '</li>').join('');
      body = '<div class="pv-slide"><h2>' + escapeHtml(s.title || '') + '</h2><ul>' + bullets + '</ul></div>';
    }
    if (s.notes) body += '<div class="pv-notes"><b>Заметки:</b> ' + escapeHtml(s.notes) + '</div>';
    preview.innerHTML = body;
    return;
  }

  slideNav.classList.add('hidden');

  if (data.type === 'document') {
    const blocks = data.blocks || [];
    preview.innerHTML = '<h2 class="pv-title">' + escapeHtml(data.title || 'Документ') + '</h2>' +
      blocks.map(b => '<div class="pv-block"><h3>' + escapeHtml(b.title || '') + '</h3><div class="pv-html">' + (b.htmlContent || b.description || '') + '</div></div>').join('');
    return;
  }

  if (data.type === 'forms') {
    const qs = data.questions || [];
    preview.innerHTML = '<h2 class="pv-title">' + escapeHtml(data.title || 'Форма') + '</h2>' +
      qs.map((q, i) => {
        let opts = '';
        if (q.options) opts = '<ul>' + q.options.map((o, j) => {
          const ok = (q.correctChoices || []).includes(j);
          return '<li' + (ok ? ' class="pv-correct"' : '') + '>' + escapeHtml(o) + (ok ? ' ✓' : '') + '</li>';
        }).join('') + '</ul>';
        if (q.type === 'text' && q.correctText) opts = '<p class="pv-muted">Ответ: ' + escapeHtml((q.correctText || []).join(', ')) + '</p>';
        return '<div class="pv-q"><b>' + (i + 1) + '. ' + escapeHtml(q.title || '') + '</b>' + opts + '</div>';
      }).join('');
    return;
  }

  if (data.type === 'keeps') {
    const notes = data.notes || [];
    preview.innerHTML = notes.map(n =>
      '<div class="pv-note"><h3>' + escapeHtml(n.title || '') + '</h3><div>' + (n.content || '') + '</div></div>'
    ).join('') || '<p class="studio-placeholder">Нет заметок</p>';
    return;
  }

  if (data.type === 'spreadsheets') {
    const headers = data.headers || [];
    const rows = data.rows || [];
    let table = '<table class="pv-table"><thead><tr>' + headers.map(h => '<th>' + escapeHtml(h) + '</th>').join('') + '</tr></thead><tbody>';
    rows.forEach(r => { table += '<tr>' + (r || []).map(c => '<td>' + escapeHtml(String(c)) + '</td>').join('') + '</tr>'; });
    table += '</tbody></table>';
    preview.innerHTML = '<h2 class="pv-title">' + escapeHtml(data.title || 'Таблица') + '</h2>' + table +
      (data.notes ? '<p class="pv-muted">' + escapeHtml(data.notes) + '</p>' : '');
    return;
  }

  if (window.marked) preview.innerHTML = marked.parse(STATE.studioContent || JSON.stringify(data, null, 2));
  else preview.innerText = STATE.studioContent;
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
          reminder: null
        });
      });
      localStorage.setItem('keeps_notes', JSON.stringify(notes));
      showToast('Импортировано в My Keeps', 'success');
    } else if (service === 'spreadsheets') {
      showToast('Таблицы на обслуживании. Импорт недоступен 2–3 дня, данные не потеряются.', 'error');
      return;
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
  document.getElementById('collapseBtn')?.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
  document.getElementById('newChatBtn')?.addEventListener('click', createNewChatState);

  document.querySelectorAll('.service-link').forEach(li => {
    li.addEventListener('click', () => {
      const href = li.getAttribute('data-href') || '';
      // Tables under maintenance
      if (href.includes('spreadsheet')) {
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

  document.getElementById('toggleStudioBtn')?.addEventListener('click', () => {
    document.getElementById('studioSidebar').classList.toggle('hidden');
  });
  document.getElementById('closeStudioBtn')?.addEventListener('click', () => {
    document.getElementById('studioSidebar').classList.add('hidden');
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
    document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.model-chip[data-model="agent"]')?.classList.add('active');
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
    STATE.apiKey = document.getElementById('apiKeyInput').value.trim();
    STATE.geminiModel = document.getElementById('modelSelect').value;
    STATE.provider = document.getElementById('providerSelect').value;
    localStorage.setItem('wg_api_key', STATE.apiKey);
    localStorage.setItem('wg_gemini_model', STATE.geminiModel);
    localStorage.setItem('wg_provider', STATE.provider);
    document.getElementById('settingsModal').classList.add('hidden');
    showToast('Настройки сохранены', 'success');
    checkApiKeyOnStart();
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

  if (STATE.limit <= 0) {
    showToast('Лимит исчерпан. Дождитесь сброса.', 'error');
    return;
  }

  STATE.lastPrompt = text;
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
  const box = document.createElement('div');
  box.className = 'studio-open-row';
  box.innerHTML = '<button type="button" class="secondary-btn ripple studio-open-btn"><span class="material-symbols-rounded">auto_awesome</span> Открыть в Студии</button>';
  box.querySelector('button').addEventListener('click', () => {
    document.getElementById('studioSidebar').classList.remove('hidden');
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
  const thinkingBlock = document.getElementById('thinkingBlock');
  if (!sendBtn) return;
  if (isGenerating) {
    sendBtn.classList.add('stop-mode');
    sendBtn.title = 'Остановить';
    sendBtn.innerHTML = '<span class="material-symbols-rounded">stop</span><span>Стоп</span>';
    thinkingBlock?.classList.remove('hidden');
  } else {
    sendBtn.classList.remove('stop-mode');
    sendBtn.title = 'Отправить';
    sendBtn.innerHTML = '<span class="material-symbols-rounded" id="sendBtnIcon">arrow_upward</span>';
    thinkingBlock?.classList.add('hidden');
  }
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

  const model = STATE.geminiModel || 'gemini-3.6-flash';
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(apiKey);

  const parts = [];
  if (fileData && fileData.isImage) {
    parts.push({ inline_data: { mime_type: fileData.type, data: fileData.data } });
  }

  let system = isPlanMode ? PLAN_SYSTEM_PROMPT : SYSTEM_PROMPT;
  if (studioExtra) system += '\n\n' + studioExtra;

  let textPayload = system + '\n\nЗапрос пользователя:\n' + userPrompt;
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
  const msgEl = document.createElement('div');
  msgEl.className = 'message ' + sender;
  if (sender === 'ai' && window.marked) {
    msgEl.innerHTML = marked.parse(text);
  } else {
    msgEl.innerText = text;
  }
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;

  if (save && STATE.activeChatId) {
    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (chat) {
      chat.messages.push({ text, sender });
      saveChats();
    }
  }
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
