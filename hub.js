/* My Work Hub v2 */
(function () {
  const REG_KEY = 'mywork_registry_v1';
  const TRASH_KEY = 'mywork_trash_v1';
  const SET_KEY = 'mywork_settings_v1';
  const API_KEY = 'mywork_ai_api_v1';
  const MIG_FLAG = 'mywork_mig_banner_dismissed_v2';

  const TYPE_META = {
    form:  { label: 'Форма', icon: 'assignment', cls: 'form', path: './forms/', pathLite: './forms-lite/', param: 'form' },
    doc:   { label: 'Документ', icon: 'article', cls: 'doc', path: './document/', param: 'doc' },
    slides:{ label: 'Презентация', icon: 'slideshow', cls: 'slides', path: './slides/', param: 'deck' },
    sheet: { label: 'Таблица', icon: 'table_chart', cls: 'sheet', path: './spreadsheets/', param: 'table' },
    keep:  { label: 'Заметка', icon: 'keep', cls: 'keep', path: './keeps/', param: 'keep' },
    mind:  { label: 'Ментальная карта', icon: 'account_tree', cls: 'mind', path: './mindmap/index.html', param: 'map' },
    board: { label: 'Доска', icon: 'draw', cls: 'board', path: './whiteboard/index.html', param: 'board' }
  };

  const WG_HINTS = ['Создать форму?', 'Нужна помощь с тестом?', 'Сгенерировать квиз?', 'Идея для урока?', 'Need your help?'];

  const TEMPLATES = [
    { id: 'tpl-quiz', type: 'form', title: 'Быстрый квиз', desc: '5 вопросов — для форм' },
    { id: 'tpl-lesson', type: 'form', title: 'Урок + тест', desc: 'Инфо и проверка знаний' },
    { id: 'tpl-report', type: 'doc', title: 'Отчёт', desc: 'Структура документа' },
    { id: 'tpl-pitch', type: 'slides', title: 'Питч 5 слайдов', desc: 'Титул → план' },
    { id: 'tpl-todo', type: 'keep', title: 'Список дел', desc: 'Чеклист на день' },
    { id: 'tpl-mind', type: 'mind', title: 'Мозговой штурм', desc: 'Центр + ветки' },
    { id: 'tpl-board', type: 'board', title: 'Пустая доска', desc: 'Whiteboard beta' }
  ];

  let registry = [];
  let trash = [];
  let settings = { theme: 'system', deviceMode: 'normal', largeUI: false };
  let chip = 'recent';
  let typeFilter = 'all';
  let searchQ = '';
  let pendingType = null;
  let searcherImage = null;
  let currentFolderId = null; // null = root This Work
  let places = [];
  let ctxProject = null;
  const PLACES_KEY = 'mywork_places_v1';
  let wgHint = WG_HINTS[Math.floor(Math.random() * WG_HINTS.length)];

  function uid() { return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function loadJSON(k, fb) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } }
  function saveJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  // Этот хаб = единый My Work PWA. Сервисы не должны показывать «установите My Work».
  try {
    localStorage.setItem('mywork_unified_pwa', '1');
    sessionStorage.setItem('mywork_unified_pwa', '1');
  } catch (e) {}

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }
  function openModal(id) { var m = document.getElementById(id); if (m) m.classList.add('active'); }
  function closeModal(id) { var m = document.getElementById(id); if (m) m.classList.remove('active'); }
  window.openModal = openModal;
  window.closeModal = closeModal;

  function applyTheme(t) {
    settings.theme = t || settings.theme || 'system';
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var light = settings.theme === 'light' || (settings.theme === 'system' && !dark);
    document.body.classList.toggle('light', light);
    document.querySelectorAll('[data-theme]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-theme') === settings.theme);
    });
  }
  function setTheme(t) { settings.theme = t; saveJSON(SET_KEY, settings); applyTheme(t); toast('Тема сохранена'); }
  function setDevice(m) {
    settings.deviceMode = m;
    localStorage.setItem('mywork_device_mode', m);
    saveJSON(SET_KEY, settings);
    document.querySelectorAll('[data-device]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-device') === m);
    });
    toast(m === 'weak' ? 'Слабое устройство · Form Lite' : 'Обычный режим');
  }
  function setLargeUI(on) {
    settings.largeUI = !!on;
    localStorage.setItem('mywork_ui_large', on ? '1' : '0');
    saveJSON(SET_KEY, settings);
    document.body.classList.toggle('ui-large', !!on);
    document.querySelectorAll('[data-ui]').forEach(function (b) {
      b.classList.toggle('active', (b.getAttribute('data-ui') === 'on') === !!on);
    });
    toast(on ? 'Крупный интерфейс' : 'Обычный размер');
  }
  window.setTheme = setTheme;
  window.setDevice = setDevice;
  window.setLargeUI = setLargeUI;

  function formatDate(ts) {
    if (!ts) return 'без даты';
    try { return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function projectParamValue(p) {
    if (!p) return null;
    if (p.legacyIndex != null && p.legacyIndex !== '') return String(p.legacyIndex);
    if (p.id != null) return String(p.id);
    return null;
  }
  function openUrlFor(p) {
    if (!p) return './';
    var m = TYPE_META[p.type] || TYPE_META.form;
    var v = projectParamValue(p);
    var q = function (name) { return v != null ? ('?' + name + '=' + encodeURIComponent(v)) : ''; };
    if (p.type === 'form' || p.type === 'forms') {
      var weak = settings.deviceMode === 'weak' || localStorage.getItem('mywork_device_mode') === 'weak';
      var base = weak ? (m.pathLite || './forms-lite/') : (m.path || './forms/');
      return base + q('form');
    }
    if (p.type === 'mind' || p.type === 'mindmap') return './mindmap/index.html' + q('map');
    if (p.type === 'board') return './whiteboard/index.html' + q('board');
    return (m.path || './') + (m.param ? q(m.param) : '');
  }
  function openProject(p) { var url = openUrlFor(p); if (url) location.href = url; }

  function isInIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  /** Не открывать превью внутри превью — иначе бесконечные iframe с хабом. */
  function previewProject(p) {
    var url = openUrlFor(p);
    if (!url) return;
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    var finalUrl = url + sep + 'preview=1';

    // Уже внутри iframe (вложенный хаб) — просим родителя открыть/закрыть, сами не плодим оверлей
    if (isInIframe()) {
      try {
        window.parent.postMessage({ type: 'mywork-preview-open', url: finalUrl }, '*');
      } catch (e) {}
      return;
    }

    var frame = document.getElementById('preview-frame');
    var overlay = document.getElementById('preview-overlay');
    if (!frame || !overlay) return;
    frame.src = finalUrl;
    overlay.classList.add('active');
  }

  function closePreview() {
    var overlay = document.getElementById('preview-overlay');
    var frame = document.getElementById('preview-frame');
    if (overlay) overlay.classList.remove('active');
    if (frame) frame.src = 'about:blank';
  }
  window.closePreview = closePreview;
  window.previewProject = previewProject;

  /** Закрыть превью + опционально toast (когда ← увёл iframe на хаб). */
  function closePreviewWithError() {
    closePreview();
    toast('Произошла ошибка');
  }

  // ← в iframe / postMessage: закрыть превью
  window.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'mywork-close-preview' || d.type === 'myform-preview-close') {
      // reason: 'hub-nav' = нажали ← и попали на index.html
      if (d.reason === 'hub-nav' || d.error) closePreviewWithError();
      else closePreview();
      return;
    }
    if (d.type === 'mywork-preview-open' && d.url && !isInIframe()) {
      var frame = document.getElementById('preview-frame');
      var overlay = document.getElementById('preview-overlay');
      if (frame && overlay) {
        frame.src = d.url;
        overlay.classList.add('active');
      }
    }
  });

  // Простой путь: index.html открылся ВНУТРИ iframe превью → просим родителя закрыть + toast
  (function guardNestedHubInPreview() {
    if (!isInIframe()) return;
    try {
      var path = location.pathname || '';
      var isHub = /\/(index\.html)?$/i.test(path) || /\/my-work\/?$/i.test(path);
      if (isHub && !/\/(forms|forms-lite|slides|document|keeps|spreadsheets|mindmap|whiteboard|WorkGens)\b/i.test(path)) {
        window.parent.postMessage({ type: 'mywork-close-preview', reason: 'hub-nav', error: true }, '*');
      }
    } catch (e) {}
  })();

  // Родитель: iframe загрузил хаб вместо файла → выключить превью + toast
  document.addEventListener('DOMContentLoaded', function () {
    var frame = document.getElementById('preview-frame');
    if (!frame) return;
    frame.addEventListener('load', function () {
      try {
        var href = frame.contentWindow && frame.contentWindow.location && frame.contentWindow.location.href;
        if (!href || href === 'about:blank') return;
        if (/index\.html(?:\?|$)/i.test(href) && !/\/(forms|forms-lite|slides|document|keeps|spreadsheets|mindmap|whiteboard)\//i.test(href)) {
          closePreviewWithError();
        }
      } catch (err) {}
    });
  });

  function matchesFilters(p) {
    if (!p || p.trashed) return false;
    var t = p.type || '';
    if (typeFilter !== 'all') {
      var map = {
        form: ['form', 'forms'], doc: ['doc', 'document'], slides: ['slides', 'slide'],
        mind: ['mind', 'mindmap'], keep: ['keep', 'keeps', 'note'], sheet: ['sheet', 'spreadsheet', 'table'],
        board: ['board', 'whiteboard']
      };
      if ((map[typeFilter] || []).indexOf(t) < 0) return false;
    }
    if (chip === 'fav' && !(p.favorite || p.pinned)) return false;
    if (chip === 'shared' && !p.sharedWithMe) return false;
    if (searchQ && String(p.title || '').toLowerCase().indexOf(searchQ.toLowerCase()) < 0) return false;
    return true;
  }
  function sorted(list) {
    return list.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  }

  function renderRow(p, opts) {
    opts = opts || {};
    var m = TYPE_META[p.type] || TYPE_META.form;
    var row = document.createElement('div');
    row.className = 'row' + (p.accentColor ? ' has-accent' : '');
    row.setAttribute('data-id', p.id || '');
    row.setAttribute('data-type', p.type || '');
    if (p.accentColor) row.style.setProperty('--row-accent', p.accentColor);
    row.innerHTML =
      '<div class="p-icon ' + m.cls + '"><span class="material-symbols-rounded">' + m.icon + '</span></div>' +
      '<div class="p-meta"><div class="p-title"></div><div class="p-sub"></div></div>' +
      '<button type="button" class="more" aria-label="Меню"><span class="material-symbols-rounded">more_vert</span></button>';
    row.querySelector('.p-title').textContent = p.title || 'Без названия';
    row.querySelector('.p-sub').textContent = m.label + ' · ' + formatDate(p.updatedAt);
    row.addEventListener('click', function (e) {
      if (e.target.closest('.more')) return;
      if (opts.trashMode) return;
      openProject(p);
    });
    row.querySelector('.more').onclick = function (e) {
      e.stopPropagation();
      openCtx(p, opts.trashMode, e);
    };
    return row;
  }

  function fillList(el, items, emptyTitle, emptyText, trashMode) {
    if (!el) return;
    el.innerHTML = '';
    if (!items.length) {
      el.innerHTML = '<div class="empty"><span class="material-symbols-rounded">folder_off</span><h3>' + emptyTitle + '</h3><p>' + emptyText + '</p></div>';
      return;
    }
    items.forEach(function (p) { el.appendChild(renderRow(p, { trashMode: trashMode })); });
  }

  function renderLists() {
    var active = sorted(registry.filter(function (p) { return !p.trashed; }));
    var homeItems = active.filter(function (p) { return p.type !== 'folder'; }).filter(matchesFilters);
    if (chip === 'recent' && typeFilter === 'all' && !searchQ) homeItems = homeItems.slice(0, 12);
    else homeItems = homeItems.slice(0, 40);
    var emptyHome = 'Эта папка пуста. Создайте новый проект кнопкой «Создать» (или вы более 30 дней сюда не заходили).';
    fillList(document.getElementById('home-list'), homeItems, 'Пока пусто', emptyHome, false);
    renderOpenPath();
    renderOpenList(active);
    renderPlaces();
    fillList(document.getElementById('trash-list'), sorted(trash), 'Корзина пуста', 'Удалённые проекты хранятся 30 дней.', true);
    var lib = document.getElementById('library-list');
    if (lib) {
      var day30 = Date.now() - 30 * 24 * 3600 * 1000;
      var recent = active.filter(function (p) { return (p.updatedAt || 0) >= day30; }).slice(0, 30);
      fillList(lib, recent, 'Нет файлов за 30 дней', 'Откройте или создайте проекты — они появятся здесь.', false);
    }
  }

  function renderTemplates() {
    var grid = document.getElementById('templates-grid');
    if (!grid) return;
    grid.innerHTML = '';
    TEMPLATES.forEach(function (tpl) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tpl-card';
      b.innerHTML = '<div class="t"></div><h4></h4><p></p>';
      b.querySelector('.t').textContent = tpl.type;
      b.querySelector('h4').textContent = tpl.title;
      b.querySelector('p').textContent = tpl.desc;
      b.onclick = function () { toast('Шаблон: ' + tpl.title); createProject(tpl.type); };
      grid.appendChild(b);
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.add('hidden'); });
    var panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(function (n) {
      n.classList.toggle('active', n.getAttribute('data-tab') === name);
    });
    if (name === 'home' || name === 'open' || name === 'trash' || name === 'searcher') renderLists();
    if (name === 'create') renderTemplates();
    if (name === 'settings') syncSettingsUI();
  }
  window.switchTab = switchTab;

  function setChip(c) {
    chip = c;
    document.querySelectorAll('[data-chip]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-chip') === c);
    });
    renderLists();
  }
  function setTypeFilter(v) {
    typeFilter = v || 'all';
    var map = { all: 'Все', form: 'Формы', doc: 'Документы', slides: 'Слайды', mind: 'Ментальные карты', keep: 'Заметки', sheet: 'Таблицы', board: 'Доски' };
    var lab = document.getElementById('type-filter-label');
    if (lab) lab.textContent = map[typeFilter] || 'Все';
    document.querySelectorAll('#type-filter .cselect-opt').forEach(function (o) {
      o.classList.toggle('active', o.getAttribute('data-val') === typeFilter);
    });
    var sel = document.getElementById('type-filter');
    if (sel) sel.classList.remove('open');
    renderLists();
  }
  function toggleSelect(id) {
    var el = document.getElementById(id);
    document.querySelectorAll('.cselect.open').forEach(function (x) { if (x.id !== id) x.classList.remove('open'); });
    if (el) el.classList.toggle('open');
  }
  window.setChip = setChip;
  window.setTypeFilter = setTypeFilter;
  window.toggleSelect = toggleSelect;

  function createProject(type) {
    pendingType = type;
    var inp = document.getElementById('create-name');
    if (inp) inp.value = '';
    openModal('create-modal');
    setTimeout(function () { if (inp) inp.focus(); }, 50);
  }
  function confirmCreate() {
    var type = pendingType || 'form';
    var title = ((document.getElementById('create-name') || {}).value || '').trim() || (TYPE_META[type] && TYPE_META[type].label) || 'Проект';
    var item = { id: uid(), type: type, title: title, updatedAt: Date.now() };
    if (type === 'form') {
      try {
        var forms = loadJSON('my_forms_data', []);
        forms.push({ title: title, questions: [], settings: { saveProgress: true }, id: item.id });
        localStorage.setItem('my_forms_data', JSON.stringify(forms));
        item.legacyKey = 'my_forms_data';
        item.legacyIndex = forms.length - 1;
      } catch (e) {}
    }
    registry.unshift(item);
    saveJSON(REG_KEY, registry);
    closeModal('create-modal');
    openProject(item);
  }
  window.createProject = createProject;
  window.confirmCreate = confirmCreate;

  function hideCtx() {
    var m = document.getElementById('ctx-menu');
    if (m) m.classList.remove('show');
  }
  function openCtx(p, trashMode, ev) {
    ctxProject = p;
    var menu = document.getElementById('ctx-menu');
    if (!menu) return;
    var html = '';
    if (trashMode) {
      html += '<button type="button" class="ctx-item" data-act="restore"><span class="material-symbols-rounded">restore_from_trash</span> Восстановить</button>';
      html += '<button type="button" class="ctx-item danger" data-act="purge"><span class="material-symbols-rounded">delete_forever</span> Удалить окончательно</button>';
    } else if (p.type === 'folder') {
      html += '<button type="button" class="ctx-item" data-act="open"><span class="material-symbols-rounded">folder_open</span> Открыть</button>';
      html += '<button type="button" class="ctx-item" data-act="rename"><span class="material-symbols-rounded">edit</span> Переименовать</button>';
      html += '<div class="ctx-sep"></div>';
      html += '<button type="button" class="ctx-item danger" data-act="delete-folder"><span class="material-symbols-rounded">delete</span> Удалить папку</button>';
    } else {
      html += '<button type="button" class="ctx-item" data-act="open"><span class="material-symbols-rounded">open_in_new</span> Открыть</button>';
      html += '<button type="button" class="ctx-item" data-act="preview"><span class="material-symbols-rounded">visibility</span> Предпросмотр</button>';
      html += '<button type="button" class="ctx-item" data-act="rename"><span class="material-symbols-rounded">edit</span> Изменить название</button>';
      html += '<button type="button" class="ctx-item" data-act="fav"><span class="material-symbols-rounded">star</span> ' + (p.favorite ? 'Убрать из избранного' : 'В избранное') + '</button>';
      html += '<button type="button" class="ctx-item" data-act="move"><span class="material-symbols-rounded">drive_file_move</span> Переместить в папку</button>';
      html += '<div class="ctx-sep"></div>';
      html += '<button type="button" class="ctx-item danger" data-act="delete"><span class="material-symbols-rounded">delete</span> В корзину</button>';
    }
    menu.innerHTML = html;
    menu.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.onclick = function () { runCtxAct(btn.getAttribute('data-act')); };
    });
    var x = 12, y = 12;
    if (ev) {
      x = ev.clientX || (ev.touches && ev.touches[0] && ev.touches[0].clientX) || x;
      y = ev.clientY || (ev.touches && ev.touches[0] && ev.touches[0].clientY) || y;
    }
    menu.classList.add('show');
    var rect = menu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    menu.style.left = Math.max(8, x) + 'px';
    menu.style.top = Math.max(8, y) + 'px';
  }
  function runCtxAct(act) {
    var p = ctxProject;
    hideCtx();
    if (!p) return;
    if (act === 'restore') {
      trash = trash.filter(function (x) { return x.id !== p.id; });
      p.trashed = false;
      registry.unshift(p);
      saveJSON(TRASH_KEY, trash);
      saveJSON(REG_KEY, registry);
      renderLists();
      toast('Восстановлено');
    } else if (act === 'purge') {
      if (!confirm('Удалить окончательно «' + (p.title || '') + '»?')) return;
      trash = trash.filter(function (x) { return x.id !== p.id; });
      saveJSON(TRASH_KEY, trash);
      renderLists();
      toast('Удалено');
    } else if (act === 'open') {
      if (p.type === 'folder') openFolder(p.id);
      else openProject(p);
    } else if (act === 'preview') previewProject(p);
    else if (act === 'rename') {
      openRename(p);
    } else if (act === 'fav') {
      p.favorite = !p.favorite;
      saveJSON(REG_KEY, registry);
      renderLists();
      toast(p.favorite ? 'В избранном' : 'Убрано из избранного');
    } else if (act === 'move') openMoveModal(p);
    else if (act === 'delete') {
      registry = registry.filter(function (x) { return x.id !== p.id; });
      p.trashed = true;
      p.deletedAt = Date.now();
      trash.unshift(p);
      saveJSON(REG_KEY, registry);
      saveJSON(TRASH_KEY, trash);
      renderLists();
      toast('В корзине');
    } else if (act === 'delete-folder') {
      var kids = registry.filter(function (x) { return !x.trashed && x.folderId === p.id; });
      if (kids.length) {
        toast('Сначала переместите или удалите файлы в папке');
        return;
      }
      if (!confirm('Удалить папку «' + (p.title || '') + '»?')) return;
      registry = registry.filter(function (x) { return x.id !== p.id; });
      saveJSON(REG_KEY, registry);
      if (currentFolderId === p.id) currentFolderId = p.folderId || null;
      renderLists();
      toast('Папка удалена');
    }
  }
  function openRename(p) {
    var n = window.prompt ? null : null;
    // custom-ish via modal reuse folder-modal fields briefly
    var name = prompt('Название', p.title || '');
    if (name == null) return;
    name = String(name).trim();
    if (!name) return;
    p.title = name;
    p.updatedAt = Date.now();
    saveJSON(REG_KEY, registry);
    renderLists();
  }

  function hasLegacyData() {
    var keys = ['my_forms_data', 'my_documents_data', 'documents_data', 'my_slides_data', 'slides_data', 'my_keeps_data', 'keeps_data', 'keeps_notes', 'my_spreadsheets_data'];
    return keys.some(function (k) {
      var raw = localStorage.getItem(k);
      return raw && raw !== '[]' && raw !== '{}';
    });
  }
  function importLegacyProjects() {
    var before = registry.length;
    try {
      var forms = loadJSON('my_forms_data', []);
      if (Array.isArray(forms)) {
        forms.forEach(function (f, i) {
          if (registry.some(function (p) { return p.legacyKey === 'my_forms_data' && p.legacyIndex === i; })) return;
          registry.push({
            id: uid(), type: 'form', title: (f && f.title) || ('Форма ' + (i + 1)),
            updatedAt: (f && f.updatedAt) || Date.now(),
            legacyKey: 'my_forms_data', legacyIndex: i
          });
        });
      }
      var singles = [
        ['my_documents_data', 'doc', 'Документ'], ['documents_data', 'doc', 'Документ'],
        ['my_slides_data', 'slides', 'Презентация'], ['slides_data', 'slides', 'Презентация'],
        ['my_spreadsheets_data', 'sheet', 'Таблица'], ['spreadsheets_data', 'sheet', 'Таблица'],
        ['my_keeps_data', 'keep', 'Заметки'], ['keeps_data', 'keep', 'Заметки'], ['keeps_notes', 'keep', 'Заметки']
      ];
      singles.forEach(function (row) {
        var key = row[0], type = row[1], title = row[2];
        var raw = localStorage.getItem(key);
        if (!raw || raw === '[]' || raw === '{}') return;
        if (registry.some(function (p) { return p.legacyKey === key && !p.trashed; })) return;
        registry.push({ id: uid(), type: type, title: title, updatedAt: Date.now(), legacyKey: key });
      });
      saveJSON(REG_KEY, registry);
      var ban = document.getElementById('mig-banner');
      if (ban) ban.classList.add('hidden');
      renderLists();
      toast(registry.length > before ? 'Успешно выполнено!' : 'Новых проектов не найдено');
    } catch (e) { toast('Ошибка импорта'); }
  }
  function dismissMigBanner() {
    localStorage.setItem(MIG_FLAG, '1');
    var ban = document.getElementById('mig-banner');
    if (ban) ban.classList.add('hidden');
  }
  window.importLegacyProjects = importLegacyProjects;
  window.dismissMigBanner = dismissMigBanner;

  function maybeShowMigBanner() {
    if (localStorage.getItem(MIG_FLAG)) return;
    if (registry.length === 0 && hasLegacyData()) {
      var ban = document.getElementById('mig-banner');
      if (ban) ban.classList.remove('hidden');
    }
  }

  function openThisComputer() { document.getElementById('pc-file-input').click(); }
  function addPlace() { toast('Облачные места — позже (нужен вход в аккаунт)'); }
  function setStorage() {}
  function importLocalFiles(input) {
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length) return;
    var n = 0;
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var type = 'form';
          if (file.name.indexOf('doc') >= 0 || data.doc) type = 'doc';
          if (file.name.indexOf('slide') >= 0 || data.deck) type = 'slides';
          if (file.name.indexOf('keep') >= 0 || data.keep) type = 'keep';
          if (file.name.indexOf('map') >= 0 || data.map) type = 'mind';
          if (file.name.indexOf('board') >= 0 || data.board) type = 'board';
          if (data.type) type = data.type;
          var title = data.title || (data.form && data.form.title) || file.name.replace(/\.[^.]+$/, '');
          if (type === 'form' && (data.form || data.questions)) {
            var forms = loadJSON('my_forms_data', []);
            var form = data.form || data;
            forms.push(form);
            localStorage.setItem('my_forms_data', JSON.stringify(forms));
            registry.unshift({ id: uid(), type: 'form', title: form.title || title, updatedAt: Date.now(), legacyKey: 'my_forms_data', legacyIndex: forms.length - 1 });
          } else {
            registry.unshift({ id: uid(), type: type, title: title, updatedAt: Date.now(), importName: file.name });
          }
          n++;
          saveJSON(REG_KEY, registry);
          renderLists();
          toast('Импортировано: ' + n);
        } catch (e) { toast('Не удалось прочитать ' + file.name); }
      };
      reader.readAsText(file);
    });
  }
  window.openThisComputer = openThisComputer;
  window.addPlace = addPlace;
  window.setStorage = setStorage;
  window.importLocalFiles = importLocalFiles;

  function getApiKey() {
    try {
      var s = loadJSON(API_KEY, {});
      return s.key || localStorage.getItem('workgens_api_key') || localStorage.getItem('gemini_api_key') || '';
    } catch (e) { return ''; }
  }
  function runSearcher() {
    var q = ((document.getElementById('searcher-query') || {}).value || '').trim();
    var st = document.getElementById('searcher-status');
    var out = document.getElementById('searcher-results');
    if (!q && !searcherImage) { toast('Введите запрос или прикрепите картинку'); return; }
    if (!getApiKey()) { if (st) st.textContent = 'API не подключён — локальный поиск по названиям.'; }
    else if (!q && searcherImage) { if (st) st.textContent = 'Только картинка: для точного поиска лучше добавить текст.'; }
    else if (st) st.textContent = 'Сканирование…';
    var ql = (q || 'image').toLowerCase();
    var hits = [];
    sorted(registry.filter(function (p) { return !p.trashed; })).forEach(function (p) {
      var score = 0;
      if (String(p.title || '').toLowerCase().indexOf(ql) >= 0) score += 5;
      ql.split(/\s+/).forEach(function (w) {
        if (w.length > 2 && JSON.stringify(p).toLowerCase().indexOf(w) >= 0) score++;
      });
      if (p.type === 'form' && p.legacyIndex != null) {
        try {
          var forms = loadJSON('my_forms_data', []);
          if (forms[p.legacyIndex] && JSON.stringify(forms[p.legacyIndex]).toLowerCase().indexOf(ql) >= 0) score += 4;
        } catch (e) {}
      }
      if (score > 0) hits.push({ p: p, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    out.innerHTML = '';
    if (!hits.length) {
      out.innerHTML = '<div class="empty"><p>Ничего не найдено' + (!q && searcherImage ? '. По одной картинке мало контекста — добавьте текст.' : '.') + '</p></div>';
      return;
    }
    hits.slice(0, 20).forEach(function (h) { out.appendChild(renderRow(h.p)); });
    if (st) st.textContent = 'Найдено: ' + hits.length;
  }
  window.runSearcher = runSearcher;

  function setupSearcher() {
    var ta = document.getElementById('searcher-query');
    var plus = document.getElementById('searcher-plus');
    var file = document.getElementById('searcher-file');
    var prev = document.getElementById('searcher-attach');
    if (!ta) return;
    function autosize() { ta.style.height = 'auto'; ta.style.height = Math.min(120, Math.max(24, ta.scrollHeight)) + 'px'; }
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSearcher(); }
    });
    if (plus) plus.onclick = function () { if (file) file.click(); };
    if (file) file.onchange = function () {
      var f = file.files && file.files[0];
      file.value = '';
      if (!f || !/^image\//.test(f.type)) return;
      var r = new FileReader();
      r.onload = function () {
        searcherImage = { name: f.name, dataUrl: r.result };
        if (prev) {
          prev.classList.remove('hidden');
          prev.innerHTML = '<img alt=""><button type="button" class="rm">×</button>';
          prev.querySelector('img').src = r.result;
          prev.querySelector('.rm').onclick = function () {
            searcherImage = null;
            prev.classList.add('hidden');
            prev.innerHTML = '';
          };
        }
      };
      r.readAsDataURL(f);
    };
  }

  function syncSettingsUI() {
    applyTheme(settings.theme);
    document.querySelectorAll('[data-device]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-device') === (settings.deviceMode || 'normal'));
    });
    document.querySelectorAll('[data-ui]').forEach(function (b) {
      b.classList.toggle('active', (b.getAttribute('data-ui') === 'on') === !!settings.largeUI);
    });
    var pct = parseInt(localStorage.getItem('wg_limit_pct') || '0', 10);
    if (isNaN(pct)) pct = 0;
    if (!getApiKey()) pct = 0;
    var lab = document.getElementById('limit-label');
    var bar = document.getElementById('limit-bar');
    if (lab) lab.textContent = pct + '%';
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
  function openApiModal() {
    var inp = document.getElementById('api-key');
    if (inp) inp.value = getApiKey() || '';
    openModal('api-modal');
  }
  function saveApi() {
    var key = ((document.getElementById('api-key') || {}).value || '').trim();
    saveJSON(API_KEY, { key: key, updatedAt: new Date().toISOString() });
    try {
      localStorage.setItem('workgens_api_key', key);
      if (key.indexOf('AIza') === 0) localStorage.setItem('gemini_api_key', key);
    } catch (e) {}
    closeModal('api-modal');
    toast('API сохранён');
    syncSettingsUI();
  }
  function exportAllJSON() {
    var snap = { exportedAt: new Date().toISOString(), registry: registry, trash: trash, settings: settings, forms: loadJSON('my_forms_data', []) };
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }));
    a.download = 'my-work-projects-backup.json';
    a.click();
    toast('JSON скачан');
  }
  function refreshStorage() {
    registry = loadJSON(REG_KEY, []);
    trash = loadJSON(TRASH_KEY, []);
    renderLists();
    toast('Хранилище обновлено');
  }
  window.openApiModal = openApiModal;
  window.saveApi = saveApi;
  window.exportAllJSON = exportAllJSON;
  window.refreshStorage = refreshStorage;

  function expandWg() {
    document.getElementById('wg-chip').classList.add('hidden');
    document.getElementById('wg-panel').classList.remove('hidden');
    var input = document.getElementById('wg-input');
    input.value = '';
    updateWgAction();
    input.focus();
  }
  function collapseWg() {
    var input = document.getElementById('wg-input');
    if (input && input.value.trim()) return;
    document.getElementById('wg-panel').classList.add('hidden');
    document.getElementById('wg-chip').classList.remove('hidden');
  }
  function updateWgAction() {
    var v = ((document.getElementById('wg-input') || {}).value || '').trim();
    var btn = document.getElementById('wg-action');
    if (btn) btn.textContent = v ? 'Отправить' : 'Open WorkGens';
  }
  function wgAction() {
    var v = ((document.getElementById('wg-input') || {}).value || '').trim();
    if (v) location.href = './WorkGens/index.html?q=' + encodeURIComponent(v) + '&autosend=1';
    else location.href = './WorkGens/index.html';
  }
  window.expandWg = expandWg;
  window.wgAction = wgAction;

  function openAeroExplorer() {
    var layer = document.getElementById('aero-layer');
    layer.innerHTML = '';
    var win = document.createElement('div');
    win.className = 'aero-win';
    win.innerHTML =
      '<div class="aero-title" data-drag><span>📁</span><span>Проводник</span>' +
      '<div class="aero-controls"><button type="button">_</button><button type="button">□</button><button type="button" data-close>✕</button></div></div>' +
      '<div class="aero-body"><div class="aero-tree">' +
      '<div data-folder="1">⭐ Избранное</div><div data-folder="1">🖥 Desktop</div>' +
      '<div data-folder="1">💻 Computer</div><div data-folder="1" style="padding-left:12px">💾 Local Disk (C:)</div>' +
      '<div data-folder="1" style="padding-left:24px">📁 Windows</div></div>' +
      '<div class="aero-files" id="aero-files"></div>' +
      '<div class="aero-deny" id="aero-deny"><strong>Доступ запрещён</strong><br>Администратор запретил все папки, кроме explorer.exe и notepad.exe для старта.</div></div>' +
      '<div class="aero-status"><span>Aero · My Work</span><span>C:\\Windows\\explorer.exe</span></div>';
    layer.appendChild(win);
    fillAeroFiles(win);
    bindDrag(win);
    win.querySelector('[data-close]').onclick = function () { layer.innerHTML = ''; };
    win.querySelectorAll('[data-folder]').forEach(function (el) {
      el.onclick = function () {
        var deny = win.querySelector('#aero-deny');
        deny.classList.add('show');
        setTimeout(function () { deny.classList.remove('show'); }, 2200);
      };
    });
  }
  function fillAeroFiles(win) {
    var box = win.querySelector('#aero-files');
    var items = [
      { name: 'explorer.exe', ok: true }, { name: 'notepad.exe', ok: true },
      { name: 'System32', ok: false }, { name: 'Fonts', ok: false }, { name: 'Logs', ok: false }
    ];
    box.innerHTML = items.map(function (it) {
      return '<div class="aero-file" data-ok="' + (it.ok ? '1' : '0') + '"><span>📄</span><span>' + it.name + '</span></div>';
    }).join('');
    box.querySelectorAll('.aero-file').forEach(function (el) {
      el.onclick = function () {
        if (el.getAttribute('data-ok') === '1') {
          if (el.textContent.indexOf('notepad') >= 0) openAeroNotepad();
          else toast('explorer.exe уже открыт');
        } else {
          win.querySelector('#aero-deny').classList.add('show');
          setTimeout(function () { win.querySelector('#aero-deny').classList.remove('show'); }, 2200);
        }
      };
    });
  }
  function openAeroNotepad() {
    var layer = document.getElementById('aero-layer');
    var win = document.createElement('div');
    win.className = 'aero-win';
    win.style.width = 'min(520px, 92vw)';
    win.style.height = 'min(360px, 60vh)';
    win.style.top = '18%';
    win.style.left = '20%';
    win.innerHTML =
      '<div class="aero-title" data-drag><span>📝</span><span>Блокнот</span>' +
      '<div class="aero-controls"><button type="button">_</button><button type="button">□</button><button type="button" data-close>✕</button></div></div>' +
      '<textarea class="aero-note" placeholder="Untitled - Notepad">Welcome to My Work Aero Notepad.\\nC:\\\\Windows\\\\notepad.exe</textarea>' +
      '<div class="aero-status"><span>Ln 1, Col 1</span><span>Windows Aero</span></div>';
    layer.appendChild(win);
    bindDrag(win);
    win.querySelector('[data-close]').onclick = function () { win.remove(); };
  }
  function bindDrag(win) {
    var bar = win.querySelector('[data-drag]');
    var ox = 0, oy = 0, drag = false;
    bar.addEventListener('pointerdown', function (e) {
      drag = true; ox = e.clientX - win.offsetLeft; oy = e.clientY - win.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', function (e) {
      if (!drag) return;
      win.style.left = Math.max(0, e.clientX - ox) + 'px';
      win.style.top = Math.max(0, e.clientY - oy) + 'px';
    });
    bar.addEventListener('pointerup', function () { drag = false; });
  }

  function initHomeSearch() {
    var input = document.getElementById('home-search');
    if (!input) return;
    input.addEventListener('input', function () {
      searchQ = (input.value || '').trim();
      var low = searchQ.toLowerCase();
      if (low === 'c:\\windows\\explorer.exe' || low === 'c:/windows/explorer.exe') openAeroExplorer();
      if (low === 'c:\\windows\\notepad.exe' || low === 'c:/windows/notepad.exe') openAeroNotepad();
      renderLists();
    });
  }


  function isFolder(p) { return p && p.type === 'folder'; }

  function renderOpenPath() {
    var bar = document.getElementById('open-path');
    if (!bar) return;
    bar.innerHTML = '';
    function crumb(label, id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'path-crumb';
      b.textContent = label;
      b.onclick = function () { openFolder(id); };
      return b;
    }
    bar.appendChild(crumb('This Work', null));
    if (currentFolderId) {
      var chain = [];
      var guard = 0;
      var id = currentFolderId;
      while (id && guard++ < 20) {
        var f = registry.find(function (x) { return x.id === id; });
        if (!f) break;
        chain.unshift(f);
        id = f.folderId || null;
      }
      chain.forEach(function (f) {
        var sep = document.createElement('span');
        sep.className = 'path-sep';
        sep.textContent = ' / ';
        bar.appendChild(sep);
        bar.appendChild(crumb(f.title || 'Папка', f.id));
      });
    }
  }

  function renderOpenList(active) {
    var el = document.getElementById('open-list');
    if (!el) return;
    var folders = active.filter(function (p) {
      return isFolder(p) && ((p.folderId || null) === (currentFolderId || null));
    });
    var files = active.filter(function (p) {
      return !isFolder(p) && ((p.folderId || null) === (currentFolderId || null));
    });
    var items = folders.concat(files);
    el.innerHTML = '';
    if (!items.length) {
      el.innerHTML = '<div class="empty"><span class="material-symbols-rounded">folder_off</span><h3>Папка пуста</h3><p>Создайте файл на вкладке «Создать» или перенесите сюда через ⋯ → Переместить в папку.</p></div>';
      return;
    }
    items.forEach(function (p) {
      var row = renderRow(p, { trashMode: false });
      if (isFolder(p)) {
        row.classList.add('folder-row');
        var icon = row.querySelector('.p-icon');
        if (icon) {
          icon.className = 'p-icon';
          icon.innerHTML = '<span class="material-symbols-rounded">folder</span>';
          icon.style.background = 'rgba(245,158,11,.15)';
          icon.style.color = '#f59e0b';
        }
        row.onclick = function (e) {
          if (e.target.closest('.more')) return;
          openFolder(p.id);
        };
      }
      el.appendChild(row);
    });
  }

  function openFolder(id) {
    currentFolderId = id || null;
    renderLists();
  }

  function createFolder() {
    var inp = document.getElementById('folder-name');
    if (inp) inp.value = '';
    openModal('folder-modal');
    setTimeout(function () { if (inp) inp.focus(); }, 50);
  }
  function confirmCreateFolder() {
    var name = ((document.getElementById('folder-name') || {}).value || '').trim() || 'Папка';
    registry.unshift({
      id: uid(),
      type: 'folder',
      title: name,
      folderId: currentFolderId || null,
      updatedAt: Date.now()
    });
    saveJSON(REG_KEY, registry);
    closeModal('folder-modal');
    renderLists();
    toast('Папка создана');
  }
  window.createFolder = createFolder;
  window.confirmCreateFolder = confirmCreateFolder;
  window.openFolder = openFolder;

  function openMoveModal(p) {
    ctxProject = p;
    var list = document.getElementById('move-folder-list');
    if (!list) return;
    var folders = sorted(registry.filter(function (x) { return !x.trashed && isFolder(x); }));
    list.innerHTML = '';
    if (!folders.length) {
      list.innerHTML = '<div class="empty"><p>Пока нет папок. Создайте на вкладке «Открыть».</p></div>';
    } else {
      folders.forEach(function (f) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'row';
        row.innerHTML = '<div class="p-icon" style="background:rgba(245,158,11,.15);color:#f59e0b"><span class="material-symbols-rounded">folder</span></div><div class="p-meta"><div class="p-title"></div><div class="p-sub">Папка</div></div>';
        row.querySelector('.p-title').textContent = f.title || 'Папка';
        row.onclick = function () { moveProjectTo(f.id); };
        list.appendChild(row);
      });
    }
    openModal('move-modal');
  }
  function moveProjectTo(folderId) {
    var p = ctxProject;
    closeModal('move-modal');
    if (!p || isFolder(p)) return;
    p.folderId = folderId || null;
    p.updatedAt = Date.now();
    saveJSON(REG_KEY, registry);
    renderLists();
    toast(folderId ? 'Перемещено в папку' : 'В корне This Work');
  }
  window.moveProjectTo = moveProjectTo;
  window.openMoveModal = openMoveModal;

  function renderPlaces() {
    var el = document.getElementById('places-list');
    if (!el) return;
    el.innerHTML = '';
    places.forEach(function (pl) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'storage-item';
      b.innerHTML = '<span class="material-symbols-rounded">cloud</span> ';
      b.appendChild(document.createTextNode(pl.name || 'Место'));
      b.onclick = function () { toast('«' + (pl.name || '') + '» — ярлык. Облачный вход позже.'); };
      el.appendChild(b);
    });
  }
  function addPlace() {
    var inp = document.getElementById('place-name');
    if (inp) inp.value = '';
    openModal('place-modal');
  }
  function confirmAddPlace() {
    var name = ((document.getElementById('place-name') || {}).value || '').trim();
    if (!name) { toast('Введите название'); return; }
    places.push({ id: uid(), name: name, createdAt: Date.now() });
    saveJSON(PLACES_KEY, places);
    closeModal('place-modal');
    renderPlaces();
    toast('Ярлык хранилища добавлен');
  }
  window.addPlace = addPlace;
  window.confirmAddPlace = confirmAddPlace;

  function loadAll() {
    registry = loadJSON(REG_KEY, []);
    trash = loadJSON(TRASH_KEY, []);
    places = loadJSON(PLACES_KEY, []);
    settings = Object.assign({ theme: 'system', deviceMode: 'normal', largeUI: false }, loadJSON(SET_KEY, {}));
    if (localStorage.getItem('mywork_device_mode')) settings.deviceMode = localStorage.getItem('mywork_device_mode');
    if (localStorage.getItem('mywork_ui_large') === '1') settings.largeUI = true;
    applyTheme(settings.theme);
    document.body.classList.toggle('ui-large', !!settings.largeUI);
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadAll();
    renderLists();
    renderTemplates();
    maybeShowMigBanner();
    initHomeSearch();
    setupSearcher();
    syncSettingsUI();
    registerSW();
    var hintEl = document.getElementById('wg-hint');
    if (hintEl) hintEl.textContent = wgHint;
    var wgInput = document.getElementById('wg-input');
    if (wgInput) {
      wgInput.addEventListener('input', updateWgAction);
      wgInput.addEventListener('keydown', function (e) {
        if (e.key === 'Tab' && !(wgInput.value || '').trim()) {
          e.preventDefault();
          wgInput.value = wgHint;
          updateWgAction();
        }
        if (e.key === 'Escape') collapseWg();
      });
    }
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.ctx-menu') && !e.target.closest('.more')) hideCtx();
      if (!e.target.closest('.wg-root')) collapseWg();
      if (!e.target.closest('.cselect')) document.querySelectorAll('.cselect.open').forEach(function (x) { x.classList.remove('open'); });
    });
    document.querySelectorAll('.overlay').forEach(function (ov) {
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('active'); });
    });
  });
})();
