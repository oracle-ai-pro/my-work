/* ==========================================================================
   ИНИЦИАЛИЗАЦИЯ И СОСТОЯНИЕ ПРИЛОЖЕНИЯ
   ========================================================================== */
const DEFAULT_DECKS = [
    {
        id: 'deck-1',
        title: 'Введение в проект',
        slides: [
            {
                type: 'title-slide',
                title: 'Добро пожаловать в Prestige HQ',
                subtitle: 'Интерактивная система презентаций и слайдов',
                notes: 'Приветствуйте аудиторию, представьтесь.'
            },
            {
                type: 'content',
                title: 'Основные возможности',
                bullets: 'Поддержка нескольких макетов слайдов\nВстроенный ИИ-генератор и чат\nПоддержка заметки докладчика\nЭкспорт и импорт в JSON',
                notes: 'Расскажите кратко о каждом пункте.'
            },
            {
                type: 'quote',
                title: 'Простота — залог успеха',
                subtitle: 'Лучший дизайн тот, в котором нет ничего лишнего.',
                quoteAuthor: 'Дизайн-команда Prestige',
                notes: 'Сделайте паузу для осмысления цитаты.'
            }
        ]
    }
];

let decks = JSON.parse(localStorage.getItem('prestige_decks')) || DEFAULT_DECKS;
let currentDeckId = localStorage.getItem('prestige_current_deck_id') || decks[0].id;
let currentSlideIndex = 0;
let isAdminLoggedIn = false;
let editingSlideIndex = null;
let currentMediaData = '';
let customPromptCallback = null;
let contextMenuDeckId = null;
let confirmModalCallback = null;

// ТАЙМЕР И РЕЖИМ ДОКЛАДЧИКА
let presenterTimerInterval = null;
let presenterSeconds = 0;
let isTimerPaused = false;
let presenterNotesFontSize = 16;
let currentMuteMode = null; // 'black', 'white' или null

/* ==========================================================================
   СОБЫТИЕ ЗАГРУЗКИ СТРАНИЦЫ И ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    const urlParams = new URLSearchParams(window.location.search);
    const deckIdFromUrl = urlParams.get('deckId');

    if (deckIdFromUrl) {
        const deckExists = decks.find(d => d.id === deckIdFromUrl);
        if (deckExists) {
            currentDeckId = deckIdFromUrl;
        }
    }

    renderTabsAndSelect();
    renderSlide();
    initSlideTouchAndClick();
    initPresentationContextMenu();
    if (typeof enhanceAllSelects === 'function') enhanceAllSelects();

    // Закрытие выпадающего меню инструментов при клике снаружи
    document.addEventListener('click', (e) => {
        const dropdown = document.querySelector('.tools-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            const toolsMenu = document.getElementById('tools-menu');
            if (toolsMenu) toolsMenu.classList.add('hidden');
        }
    });

    // Клавиатурная навигация и горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        
        // Горячие клавиши для A/V Mute (B = Black, W = White)
        if (e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И') {
            toggleScreenMute('black');
            return;
        }
        if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
            toggleScreenMute('white');
            return;
        }

        // Выход из затемнения экрана по Esc или любой клавише
        if (currentMuteMode !== null) {
            toggleScreenMute(null);
            return;
        }

        // Переключение слайдов
        if (e.key === 'ArrowRight' || e.key === 'Space' || e.key === 'PageDown') {
            e.preventDefault();
            nextSlide();
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            prevSlide();
        }
    });

    // Обновление часов в режиме докладчика
    setInterval(updatePresenterClock, 1000);
});

document.addEventListener('click', hideTabContextMenu);
document.addEventListener('scroll', hideTabContextMenu, true);

/* ==========================================================================
   УПРАВЛЕНИЕ ТЕМОЙ И ИНТЕРФЕЙСОМ
   ========================================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('prestige_theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('prestige_theme', theme);
}

function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.toggle('hidden');
}

function toggleSpeakerNotes() {
    const box = document.getElementById('speaker-notes-box');
    if (box) box.classList.toggle('hidden');
}

function toggleDeckLayout(isCompact) {
    const select = document.getElementById('slides-tabs-select');
    const tabsList = document.getElementById('slides-tabs-list');
    if (isCompact) {
        select.classList.remove('hidden');
        tabsList.classList.add('hidden');
    } else {
        select.classList.add('hidden');
        tabsList.classList.remove('hidden');
    }
}

/* ==========================================================================
   ТАПЫ И СВАЙПЫ ДЛЯ МОБИЛЬНЫХ И ПК
   ========================================================================== */
function initSlideTouchAndClick() {
    const slideBox = document.getElementById('slide-box');
    if (!slideBox) return;

    let touchStartX = 0;
    let touchStartY = 0;

    slideBox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    slideBox.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Порог свайпа по горизонтали
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
            if (diffX < 0) nextSlide();
            else prevSlide();
        }
    }, { passive: true });

    // Тап по левой / правой стороне экрана
    slideBox.addEventListener('click', (e) => {
        // Игнорируем клик по интерактивным элементам (кнопки, ссылки, видео)
        if (e.target.closest('button, a, input, textarea, select, video, .tools-icon-btn, .slide-context-menu')) return;

        const rect = slideBox.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        
        if (clickX < rect.width * 0.4) {
            prevSlide();
        } else {
            nextSlide();
        }
    });
}

/* ==========================================================================
   КОНТЕКСТНОЕ МЕНЮ ПРЕЗЕНТАЦИИ (ПО ПКМ ВО ВРЕМЯ ПОКАЗА)
   ========================================================================== */
function initPresentationContextMenu() {
    const presentationScreen = document.getElementById('presentation-screen');
    if (!presentationScreen) return;

    presentationScreen.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showPresentationContextMenu(e.clientX, e.clientY);
    });

    document.addEventListener('click', hidePresentationContextMenu);
}

function showPresentationContextMenu(x, y) {
    let menu = document.getElementById('presentation-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'presentation-context-menu';
        menu.className = 'slide-context-menu hidden';
        document.body.appendChild(menu);
    }

    menu.innerHTML = `
        <div class="slide-context-item" onclick="nextSlide()"><span class="material-symbols-rounded">navigate_next</span> Следующий</div>
        <div class="slide-context-item" onclick="prevSlide()"><span class="material-symbols-rounded">navigate_before</span> Предыдущий</div>
        <div class="slide-context-divider"></div>
        <div class="slide-context-item" onclick="openSlideGridModal()"><span class="material-symbols-rounded">grid_view</span> Просмотр всех слайдов</div>
        <div class="slide-context-item" onclick="openPresenterMode()"><span class="material-symbols-rounded">badge</span> Показать режим докладчика</div>
        <div class="slide-context-divider"></div>
        <div class="slide-context-item" onclick="toggleScreenMute('black')"><span class="material-symbols-rounded">desktop_access_disabled</span> Черный экран (B)</div>
        <div class="slide-context-item" onclick="toggleScreenMute('white')"><span class="material-symbols-rounded">light_mode</span> Белый экран (W)</div>
        <div class="slide-context-divider"></div>
        <div class="slide-context-item danger" onclick="exitFullscreenPresentation()"><span class="material-symbols-rounded">close</span> Завершить показ слайдов</div>
    `;

    menu.style.top = `${y}px`;
    menu.style.left = `${x}px`;
    menu.classList.remove('hidden');
}

function hidePresentationContextMenu() {
    const menu = document.getElementById('presentation-context-menu');
    if (menu) menu.classList.add('hidden');
}

/* ==========================================================================
   A/V MUTE (ЧЕРНЫЙ / БЕЛЫЙ ЭКРАН)
   ========================================================================== */
function toggleScreenMute(mode) {
    const overlay = document.getElementById('screen-mute-overlay');
    if (!overlay) return;

    if (mode === null || (currentMuteMode === mode && !overlay.classList.contains('hidden'))) {
        overlay.classList.add('hidden');
        overlay.className = 'screen-mute-overlay hidden';
        currentMuteMode = null;
    } else {
        currentMuteMode = mode;
        overlay.className = `screen-mute-overlay active ${mode}`;
        overlay.classList.remove('hidden');
    }
}

/* ==========================================================================
   ПЕРЕКЛЮЧЕНИЕ ПРЕЗЕНТАЦИЙ И ВКЛАДОК
   ========================================================================== */
function saveDecks() {
    localStorage.setItem('prestige_decks', JSON.stringify(decks));
    localStorage.setItem('prestige_current_deck_id', currentDeckId);
}

function getCurrentDeck() {
    return decks.find(d => d.id === currentDeckId) || decks[0];
}

function renderTabsAndSelect() {
    const tabsList = document.getElementById('slides-tabs-list');
    const select = document.getElementById('slides-tabs-select');
    
    if (!tabsList || !select) return;

    tabsList.innerHTML = '';
    select.innerHTML = '';

    decks.forEach(deck => {
        const tab = document.createElement('button');
        tab.className = `tab-btn ${deck.id === currentDeckId ? 'active' : ''}`;
        tab.innerText = deck.title;
        tab.onclick = () => switchDeck(deck.id);
        tab.oncontextmenu = (e) => showTabContextMenu(e, deck.id);

        tabsList.appendChild(tab);

        const option = document.createElement('option');
        option.value = deck.id;
        option.innerText = deck.title;
        if (deck.id === currentDeckId) option.selected = true;
        select.appendChild(option);
    });
}

function switchDeck(id) {
    currentDeckId = id;
    currentSlideIndex = 0;
    saveDecks();
    renderTabsAndSelect();
    renderSlide();
    if (isAdminLoggedIn) renderAdminSlidesList();
}

function switchDeckFromSelect(id) {
    switchDeck(id);
}

function createNewDeckPrompt() {
    showPrompt('Создать презентацию', 'Введите название новой презентации:', (title) => {
        if (!title || !title.trim()) return;
        const newDeck = {
            id: 'deck-' + Date.now(),
            title: title.trim(),
            slides: [{ type: 'title-slide', title: title.trim(), subtitle: 'Новая презентация' }]
        };
        decks.push(newDeck);
        switchDeck(newDeck.id);
    });
}

/* ==========================================================================
   ОТРИСОВКА И НАВИГАЦИЯ ПО СЛАЙДАМ
   ========================================================================== */
function generateSlideHTML(slide, opts) {
    opts = opts || {};
    if (!slide) return '<div style="text-align:center;">Пустой слайд</div>';

    var inner = '';
    switch (slide.type) {
        case 'title-slide':
            inner = `
                <div class="slide-title-layout">
                    <h1>${escapeHtml(slide.title || '')}</h1>
                    <p>${escapeHtml(slide.subtitle || '')}</p>
                </div>`;
            break;

        case 'content':
            var bulletsArr = (slide.bullets || '').split('\n').filter(function(b) { return b.trim(); });
            var bulletsHtml = bulletsArr.map(function(b) { return '<li>' + escapeHtml(b) + '</li>'; }).join('');
            inner = `
                <div class="slide-content-layout">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    ${slide.subtitle ? '<p style="color:var(--text-muted); margin-bottom:12px;">' + escapeHtml(slide.subtitle) + '</p>' : ''}
                    <ul class="slide-bullets">${bulletsHtml}</ul>
                </div>`;
            break;

        case 'two-column':
            inner = `
                <div class="slide-content-layout">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    <div class="slide-two-col">
                        <div>${escapeHtml(slide.bullets || '').replace(/\n/g, '<br>')}</div>
                        <div>${escapeHtml(slide.col2 || '').replace(/\n/g, '<br>')}</div>
                    </div>
                </div>`;
            break;

        case 'quote':
            inner = `
                <div class="slide-quote-layout">
                    <blockquote>“${escapeHtml(slide.title || slide.subtitle || '')}”</blockquote>
                    ${slide.quoteAuthor ? '<div class="slide-quote-author">— ' + escapeHtml(slide.quoteAuthor) + '</div>' : ''}
                </div>`;
            break;

        case 'media':
            var mediaUrl = slide.mediaUrl || currentMediaData;
            var mediaHtml = '';
            if (mediaUrl) {
                if (mediaUrl.indexOf('data:video') === 0 || String(mediaUrl).endsWith('.mp4')) {
                    mediaHtml = '<video src="' + mediaUrl + '" controls></video>';
                } else {
                    mediaHtml = '<img src="' + mediaUrl + '" alt="Slide Media">';
                }
            }
            inner = `
                <div class="slide-content-layout">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    <p>${escapeHtml(slide.subtitle || '')}</p>
                    <div class="slide-media-container">${mediaHtml}</div>
                </div>`;
            break;

        case 'code':
            inner = `
                <div class="slide-content-layout">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    <pre class="slide-code-block"><code>${escapeHtml(slide.bullets || '')}</code></pre>
                </div>`;
            break;

        default:
            inner = '<h3>' + escapeHtml(slide.title || '') + '</h3><p>' + escapeHtml(slide.subtitle || '') + '</p>';
    }

    // Background styles (saved on slide)
    var bgStyle = '';
    if (slide.bgColor) bgStyle += 'background-color:' + slide.bgColor + ';';
    if (slide.bgImage) {
        bgStyle += 'background-image:url(' + JSON.stringify(String(slide.bgImage)) + ');';
        bgStyle += 'background-size:cover;background-position:center;';
    }
    if (slide.bgOverlay) {
        // soft overlay for readability when image
    }

    if (opts.raw) return inner;

    if (bgStyle) {
        return '<div class="slide-bg-wrap" style="' + bgStyle + 'position:relative;width:100%;height:100%;min-height:100%;border-radius:inherit;">' +
            (slide.bgImage ? '<div class="slide-bg-scrim" style="position:absolute;inset:0;background:rgba(0,0,0,0.25);pointer-events:none;"></div>' : '') +
            '<div style="position:relative;z-index:1;width:100%;height:100%;">' + inner + '</div></div>';
    }
    return inner;
}

function renderSlide() {
    const deck = getCurrentDeck();
    const slides = deck ? deck.slides || [] : [];
    const body = document.getElementById('slide-body');
    
    if (!body) return;

    if (slides.length === 0) {
        body.innerHTML = '<div style="text-align:center;">Презентация пуста</div>';
        return;
    }

    if (currentSlideIndex >= slides.length) currentSlideIndex = slides.length - 1;
    if (currentSlideIndex < 0) currentSlideIndex = 0;

    const slide = slides[currentSlideIndex];
    
    const curNum = document.getElementById('current-slide-number');
    const totNum = document.getElementById('total-slides-number');
    const progress = document.getElementById('progress');
    const speakerText = document.getElementById('speaker-notes-text');

    if (curNum) curNum.innerText = currentSlideIndex + 1;
    if (totNum) totNum.innerText = slides.length;
    if (progress) progress.style.width = `${((currentSlideIndex + 1) / slides.length) * 100}%`;
    if (speakerText) speakerText.innerText = slide.notes || 'Нет заметок к этому слайду.';

    body.innerHTML = generateSlideHTML(slide);

    // Если открыт режим докладчика — обновляем и его
    updatePresenterModeUI();
}

function nextSlide() {
    const deck = getCurrentDeck();
    if (deck && currentSlideIndex < deck.slides.length - 1) {
        currentSlideIndex++;
        renderSlide();
        if (typeof applySlideTransition === 'function') applySlideTransition('next');
    }
}

function prevSlide() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        renderSlide();
        if (typeof applySlideTransition === 'function') applySlideTransition('prev');
    }
}

function goToSlide(index) {
    const deck = getCurrentDeck();
    if (deck && index >= 0 && index < deck.slides.length) {
        currentSlideIndex = index;
        renderSlide();
        closeSlideGridModal();
    }
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

function showPresentHint() {
    let overlay = document.getElementById('present-hint-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'present-hint-overlay';
        overlay.className = 'present-hint-overlay';
        document.body.appendChild(overlay);
    }

    const mobile = isMobileDevice();
    if (mobile) {
        overlay.innerHTML = `
            <div class="present-hint-card">
                <h3>Жесты управления</h3>
                <div class="present-hint-row">
                    <span class="material-symbols-rounded">swipe</span>
                    <span>Свайп влево — следующий слайд</span>
                </div>
                <div class="present-hint-row">
                    <span class="material-symbols-rounded">swipe_right</span>
                    <span>Свайп вправо — предыдущий</span>
                </div>
                <div class="present-hint-row">
                    <span class="material-symbols-rounded">touch_app</span>
                    <span>Тап справа / слева экрана</span>
                </div>
                <div class="hint-dismiss">Коснитесь экрана, чтобы начать</div>
            </div>`;
    } else {
        overlay.innerHTML = `
            <div class="present-hint-card">
                <h3>Клавиши управления</h3>
                <div class="present-hint-row">
                    <span class="present-hint-keys">
                        <span class="present-hint-key">→</span>
                        <span class="present-hint-key">Space</span>
                    </span>
                    <span>Следующий слайд</span>
                </div>
                <div class="present-hint-row">
                    <span class="present-hint-keys">
                        <span class="present-hint-key">←</span>
                    </span>
                    <span>Предыдущий слайд</span>
                </div>
                <div class="present-hint-row">
                    <span class="present-hint-keys">
                        <span class="present-hint-key">B</span>
                        <span class="present-hint-key">W</span>
                    </span>
                    <span>Чёрный / белый экран</span>
                </div>
                <div class="present-hint-row">
                    <span class="present-hint-keys">
                        <span class="present-hint-key">Esc</span>
                    </span>
                    <span>Выйти из показа</span>
                </div>
                <div class="hint-dismiss">Нажмите любую клавишу или кликните, чтобы начать</div>
            </div>`;
    }

    overlay.classList.add('visible');
    const dismiss = () => {
        overlay.classList.remove('visible');
        overlay.removeEventListener('click', dismiss);
        document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { dismiss(); };
    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
    // auto-hide after 4s
    setTimeout(() => {
        if (overlay.classList.contains('visible')) dismiss();
    }, 4500);
}

function enterPresentMode() {
    document.body.classList.add('is-presenting');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    showPresentHint();
}

function exitPresentMode() {
    document.body.classList.remove('is-presenting');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    const hint = document.getElementById('present-hint-overlay');
    if (hint) hint.classList.remove('visible');
}

function startFullscreenPresentation() {
    enterPresentMode();
    const elem = document.documentElement;
    const req = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
    if (req) {
        try { req.call(elem); } catch (e) {}
    }
}

function exitFullscreenPresentation() {
    exitPresentMode();
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

// Следим за выходом из fullscreen (Esc браузера)
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) exitPresentMode();
});
document.addEventListener('webkitfullscreenchange', () => {
    if (!document.webkitFullscreenElement) exitPresentMode();
});

/* ==========================================================================
   РЕЖИМ ДОКЛАДЧИКА (PRESENTER VIEW)
   ========================================================================== */
function openPresenterMode() {
    const modal = document.getElementById('presenter-view-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    startPresenterTimer();
    updatePresenterModeUI();
}

function closePresenterMode() {
    const modal = document.getElementById('presenter-view-modal');
    if (modal) modal.classList.add('hidden');
    if (presenterTimerInterval) clearInterval(presenterTimerInterval);
}

function updatePresenterModeUI() {
    const modal = document.getElementById('presenter-view-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    const deck = getCurrentDeck();
    const slides = deck ? deck.slides || [] : [];
    if (slides.length === 0) return;

    const currentSlide = slides[currentSlideIndex];
    const nextSlide = slides[currentSlideIndex + 1];

    // Отрисовка текущего слайда
    const curBody = document.getElementById('presenter-current-slide-body');
    if (curBody) curBody.innerHTML = generateSlideHTML(currentSlide);

    // Отрисовка превью следующего слайда
    const nextBody = document.getElementById('presenter-next-slide-body');
    if (nextBody) {
        if (nextSlide) {
            nextBody.innerHTML = generateSlideHTML(nextSlide);
        } else {
            nextBody.innerHTML = '<div style="text-align:center; padding-top:40px; color:#888;">Конец презентации</div>';
        }
    }

    // Заметки
    const notesText = document.getElementById('presenter-notes-text');
    if (notesText) {
        notesText.innerText = currentSlide.notes || 'Щелкните, чтобы добавить заметки';
        notesText.style.fontSize = `${presenterNotesFontSize}px`;
    }

    // Счетчики
    const curNum = document.getElementById('presenter-cur-num');
    const totNum = document.getElementById('presenter-tot-num');
    const prevBtn = document.getElementById('presenter-prev-btn');
    const nextBtn = document.getElementById('presenter-next-btn');

    if (curNum) curNum.innerText = currentSlideIndex + 1;
    if (totNum) totNum.innerText = slides.length;
    if (prevBtn) prevBtn.disabled = currentSlideIndex === 0;
    if (nextBtn) nextBtn.disabled = currentSlideIndex === slides.length - 1;
}

function startPresenterTimer() {
    if (presenterTimerInterval) clearInterval(presenterTimerInterval);
    presenterTimerInterval = setInterval(() => {
        if (!isTimerPaused) {
            presenterSeconds++;
            const display = document.getElementById('presenter-timer-display');
            if (display) {
                const h = Math.floor(presenterSeconds / 3600);
                const m = Math.floor((presenterSeconds % 3600) / 60);
                const s = presenterSeconds % 60;
                display.innerText = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
        }
    }, 1000);
}

function togglePresenterTimer() {
    isTimerPaused = !isTimerPaused;
    const btn = document.getElementById('presenter-pause-btn');
    if (btn) btn.innerHTML = isTimerPaused ? '<span class="material-symbols-rounded">play_arrow</span>' : '<span class="material-symbols-rounded">pause</span>';
}

function resetPresenterTimer() {
    presenterSeconds = 0;
    const display = document.getElementById('presenter-timer-display');
    if (display) display.innerText = '0:00:00';
}

function updatePresenterClock() {
    const clock = document.getElementById('presenter-clock-display');
    if (clock) {
        const now = new Date();
        clock.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

function changePresenterNotesFont(delta) {
    presenterNotesFontSize = Math.max(12, Math.min(32, presenterNotesFontSize + delta));
    const notesText = document.getElementById('presenter-notes-text');
    if (notesText) notesText.style.fontSize = `${presenterNotesFontSize}px`;
}

/* ==========================================================================
   СЕТКА ВСЕХ СЛАЙДОВ (SLIDE GRID MODAL)
   ========================================================================== */
function openSlideGridModal() {
    const modal = document.getElementById('slide-grid-modal');
    const container = document.getElementById('slide-grid-container');
    const deck = getCurrentDeck();

    if (!modal || !container || !deck) return;

    container.innerHTML = '';
    deck.slides.forEach((slide, idx) => {
        const card = document.createElement('div');
        card.className = `slide-grid-item ${idx === currentSlideIndex ? 'active' : ''}`;
        card.onclick = () => goToSlide(idx);
        card.innerHTML = `
            <div class="slide-grid-preview">${generateSlideHTML(slide)}</div>
            <div class="slide-grid-number">${idx + 1}</div>
        `;
        container.appendChild(card);
    });

    modal.classList.add('active');
}

function closeSlideGridModal() {
    const modal = document.getElementById('slide-grid-modal');
    if (modal) modal.classList.remove('active');
}

/* ==========================================================================
   АДМИНИСТРИРОВАНИЕ И РЕДАКТИРОВАНИЕ
   ========================================================================== */
function openLoginModal() {
    if (isAdminLoggedIn) {
        showAdminPanel();
    } else {
        document.getElementById('login-modal').classList.add('active');
    }
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
}

function tryLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (user === 'admin' && pass === '1234') {
        isAdminLoggedIn = true;
        closeLoginModal();
        showAdminPanel();
        showAlert('Успешно', 'Вы вошли в панель администратора!');
    } else {
        showAlert('Ошибка', 'Неверный логин или пароль!');
    }
}

function showAdminPanel() {
    document.getElementById('presentation-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.remove('hidden');
    renderAdminSlidesList();
}

function logout() {
    isAdminLoggedIn = false;
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('presentation-screen').classList.remove('hidden');
}

function toggleAddSlideForm() {
    const form = document.getElementById('admin-add-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
        resetAdminForm();
    }
}

function toggleAdminSlideFields() {
    const type = document.getElementById('new-slide-type').value;
    const col2Box = document.getElementById('admin-second-column-box');
    const quoteBox = document.getElementById('admin-quote-author-box');
    const mediaBox = document.getElementById('media-upload-box');

    col2Box.classList.add('hidden');
    quoteBox.classList.add('hidden');
    mediaBox.classList.add('hidden');

    if (type === 'two-column') col2Box.classList.remove('hidden');
    if (type === 'quote') quoteBox.classList.remove('hidden');
    if (type === 'media') mediaBox.classList.remove('hidden');
}

function handleBgImageUpload(input) {
    window._slideBgImageData = '';
    const preview = document.getElementById('bg-image-preview');
    if (preview) preview.innerHTML = '';
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            window._slideBgImageData = e.target.result;
            if (preview) preview.innerHTML = '<img src="' + e.target.result + '" style="max-height:60px;margin-top:6px;border-radius:6px;">';
            const urlInput = document.getElementById('new-slide-bg-image');
            if (urlInput) urlInput.value = '';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function clearSlideBackground() {
    window._slideBgImageData = '';
    const bgc = document.getElementById('new-slide-bg-color');
    if (bgc) bgc.value = '#ffffff';
    const bgi = document.getElementById('new-slide-bg-image');
    if (bgi) bgi.value = '';
    const file = document.getElementById('new-slide-bg-file');
    if (file) file.value = '';
    const preview = document.getElementById('bg-image-preview');
    if (preview) preview.innerHTML = '';
}

function handleMediaUploadPreview(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentMediaData = e.target.result;
            document.getElementById('media-preview-container').innerHTML = 
                `<img src="${currentMediaData}" style="max-height:100px; margin-top:8px; border-radius:6px;">`;
        };
        reader.readAsDataURL(file);
    }
}

function addSlide() {
    const deck = getCurrentDeck();
    const type = document.getElementById('new-slide-type').value;
    const title = document.getElementById('new-slide-title').value;
    const subtitle = document.getElementById('new-slide-subtitle').value;
    const bullets = document.getElementById('new-slide-bullets').value;
    const col2 = document.getElementById('new-slide-col2').value;
    const quoteAuthor = document.getElementById('new-quote-author').value;
    const mediaUrl = document.getElementById('new-media-url').value || currentMediaData;
    const notes = document.getElementById('new-speaker-notes').value;
    const transitionEl = document.getElementById('new-slide-transition');
    const transition = transitionEl ? transitionEl.value : 'inherit';
    const bgColorEl = document.getElementById('new-slide-bg-color');
    const bgColor = bgColorEl ? bgColorEl.value : '';
    let bgImage = '';
    const bgImageEl = document.getElementById('new-slide-bg-image');
    if (bgImageEl && bgImageEl.value.trim()) bgImage = bgImageEl.value.trim();
    else if (window._slideBgImageData) bgImage = window._slideBgImageData;
    else if (editingSlideIndex !== null) {
        const prev = deck.slides[editingSlideIndex];
        if (prev && prev.bgImage) bgImage = prev.bgImage;
    }

    const newSlideData = { type, title, subtitle, bullets, col2, quoteAuthor, mediaUrl, notes, transition, bgColor, bgImage };

    if (editingSlideIndex !== null) {
        deck.slides[editingSlideIndex] = newSlideData;
        editingSlideIndex = null;
    } else {
        deck.slides.push(newSlideData);
    }

    saveDecks();
    renderAdminSlidesList();
    renderSlide();
    resetAdminForm();
    document.getElementById('admin-add-form').classList.add('hidden');
}

function resetAdminForm() {
    document.getElementById('admin-form-title').innerText = 'Новый слайд';
    document.getElementById('new-slide-title').value = '';
    document.getElementById('new-slide-subtitle').value = '';
    document.getElementById('new-slide-bullets').value = '';
    document.getElementById('new-slide-col2').value = '';
    document.getElementById('new-quote-author').value = '';
    document.getElementById('new-media-url').value = '';
    document.getElementById('new-speaker-notes').value = '';
    document.getElementById('media-preview-container').innerHTML = '';
    currentMediaData = '';
    window._slideBgImageData = '';
    var bgc = document.getElementById('new-slide-bg-color');
    if (bgc) bgc.value = '#ffffff';
    var bgi = document.getElementById('new-slide-bg-image');
    if (bgi) bgi.value = '';
    var bgp = document.getElementById('bg-image-preview');
    if (bgp) bgp.innerHTML = '';
    editingSlideIndex = null;
    document.getElementById('cancel-edit-btn').classList.add('hidden');
}

function renderAdminSlidesList() {
    const list = document.getElementById('admin-slides-list');
    const deck = getCurrentDeck();
    if (!list || !deck) return;

    list.innerHTML = '';

    deck.slides.forEach((slide, idx) => {
        const item = document.createElement('div');
        item.className = 'admin-slide-item';
        item.innerHTML = `
            <div>
                <strong>${idx + 1}. ${escapeHtml(slide.title || 'Без названия')}</strong>
                <span style="font-size:12px; color:var(--text-muted);">(${slide.type})</span>
            </div>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="tools-icon-btn" onclick="moveSlide(${idx}, -1)" title="Вверх" ${idx === 0 ? 'disabled' : ''}><span class="material-symbols-rounded">arrow_upward</span></button>
                <button class="tools-icon-btn" onclick="moveSlide(${idx}, 1)" title="Вниз" ${idx === deck.slides.length - 1 ? 'disabled' : ''}><span class="material-symbols-rounded">arrow_downward</span></button>
                <button class="tools-icon-btn" onclick="duplicateSlide(${idx})" title="Дублировать"><span class="material-symbols-rounded">content_copy</span></button>
                <button class="tools-icon-btn" onclick="editSlide(${idx})" title="Редактировать"><span class="material-symbols-rounded">edit</span></button>
                <button class="tools-icon-btn" onclick="deleteSlide(${idx})" title="Удалить"><span class="material-symbols-rounded">delete</span></button>
            </div>
        `;
        list.appendChild(item);
    });
}

function editSlide(idx) {
    const deck = getCurrentDeck();
    const slide = deck.slides[idx];
    editingSlideIndex = idx;

    document.getElementById('admin-form-title').innerText = 'Редактирование слайда №' + (idx + 1);
    document.getElementById('new-slide-type').value = slide.type;
    if (typeof refreshEnhancedSelect === 'function') refreshEnhancedSelect(document.getElementById('new-slide-type'));
    document.getElementById('new-slide-title').value = slide.title || '';
    document.getElementById('new-slide-subtitle').value = slide.subtitle || '';
    document.getElementById('new-slide-bullets').value = slide.bullets || '';
    document.getElementById('new-slide-col2').value = slide.col2 || '';
    document.getElementById('new-quote-author').value = slide.quoteAuthor || '';
    document.getElementById('new-media-url').value = slide.mediaUrl || '';
    document.getElementById('new-speaker-notes').value = slide.notes || '';

    var tr = document.getElementById('new-slide-transition');
    if (tr) {
        tr.value = slide.transition || 'inherit';
        if (typeof refreshEnhancedSelect === 'function') refreshEnhancedSelect(tr);
    }
    var bgc = document.getElementById('new-slide-bg-color');
    if (bgc) bgc.value = slide.bgColor || '#ffffff';
    var bgi = document.getElementById('new-slide-bg-image');
    if (bgi) bgi.value = (slide.bgImage && String(slide.bgImage).indexOf('data:') !== 0) ? slide.bgImage : '';
    window._slideBgImageData = (slide.bgImage && String(slide.bgImage).indexOf('data:') === 0) ? slide.bgImage : '';
    var bgp = document.getElementById('bg-image-preview');
    if (bgp) {
        bgp.innerHTML = slide.bgImage
            ? '<img src="' + slide.bgImage + '" style="max-height:60px;margin-top:6px;border-radius:6px;">'
            : '';
    }

    toggleAdminSlideFields();
    document.getElementById('admin-add-form').classList.remove('hidden');
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
}

function cancelEditSlide() {
    resetAdminForm();
    document.getElementById('admin-add-form').classList.add('hidden');
}

function deleteSlide(idx) {
    const deck = getCurrentDeck();
    const title = (deck.slides[idx] && deck.slides[idx].title) || ('Слайд ' + (idx + 1));
    showConfirmModal('Удалить слайд?', '«' + title + '» будет удалён без восстановления.', function() {
        deck.slides.splice(idx, 1);
        if (currentSlideIndex >= deck.slides.length) currentSlideIndex = Math.max(0, deck.slides.length - 1);
        saveDecks();
        renderAdminSlidesList();
        renderSlide();
    });
}

function moveSlide(idx, dir) {
    const deck = getCurrentDeck();
    const t = idx + dir;
    if (!deck || t < 0 || t >= deck.slides.length) return;
    const tmp = deck.slides[idx];
    deck.slides[idx] = deck.slides[t];
    deck.slides[t] = tmp;
    if (currentSlideIndex === idx) currentSlideIndex = t;
    else if (currentSlideIndex === t) currentSlideIndex = idx;
    saveDecks();
    renderAdminSlidesList();
    renderSlide();
}

function duplicateSlide(idx) {
    const deck = getCurrentDeck();
    if (!deck || !deck.slides[idx]) return;
    const copy = JSON.parse(JSON.stringify(deck.slides[idx]));
    copy.title = (copy.title || 'Слайд') + ' — копия';
    deck.slides.splice(idx + 1, 0, copy);
    saveDecks();
    renderAdminSlidesList();
    renderSlide();
    showAlert('Готово', 'Слайд продублирован.');
}

function exportDeckToJSON() {
    const deck = getCurrentDeck();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(deck, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${deck.title.toLowerCase().replace(/\s+/g, '_')}_presentation.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importDeckFromJSON(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedDeck = JSON.parse(e.target.result);
            if (importedDeck && importedDeck.slides) {
                importedDeck.id = 'deck-' + Date.now();
                decks.push(importedDeck);
                switchDeck(importedDeck.id);
                showAlert('Успех', 'Презентация успешно импортирована!');
            } else {
                showAlert('Ошибка', 'Некорректный формат файла JSON.');
            }
        } catch (err) {
            showAlert('Ошибка', 'Ошибка чтения файла.');
        }
    };
    reader.readAsText(file);
}

function generateShareLink() {
    openShareModal();
}

function openShareModal() {
    updateShareLinkPreview();
    if (typeof enhanceAllSelects === 'function') enhanceAllSelects(document.getElementById('share-modal'));
    const m = document.getElementById('share-modal');
    if (m) m.classList.add('active');
}
function closeShareModal() {
    const m = document.getElementById('share-modal');
    if (m) m.classList.remove('active');
}
function buildShareUrl() {
    const deck = getCurrentDeck();
    if (!deck) return window.location.href;
    const url = new URL(window.location.href.split('?')[0].split('#')[0]);
    url.searchParams.set('deckId', deck.id);
    const expSel = document.getElementById('share-expiry-select');
    const days = expSel ? parseInt(expSel.value, 10) : 0;
    if (days > 0) url.searchParams.set('exp', String(Date.now() + days * 86400000));
    return url.toString();
}
function updateShareLinkPreview() {
    const input = document.getElementById('share-link-input');
    if (input) input.value = buildShareUrl();
}
function copyShareLink() {
    updateShareLinkPreview();
    const url = buildShareUrl();
    navigator.clipboard.writeText(url).then(function() {
        showAlert('Ссылка скопирована', 'Ссылка на презентацию в буфере обмена.');
    }).catch(function() {
        const input = document.getElementById('share-link-input');
        if (input) {
            input.select();
            try { document.execCommand('copy'); showAlert('Ссылка скопирована', ''); }
            catch (e) { showAlert('Скопируйте вручную', url); }
        }
    });
}

function printCurrentDeck() {
    const deck = getCurrentDeck();
    if (!deck || !deck.slides || deck.slides.length === 0) {
        showAlert('Ошибка', 'Нет слайдов для печати.');
        return;
    }

    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
        showAlert('Ошибка', 'Запрещены всплывающие окна! Разрешите их для печати.');
        return;
    }

    const slidesPayload = deck.slides.map(function(s, i) {
        return {
            index: i,
            title: s.title || '',
            html: generateSlideHTML(s),
            bgColor: s.bgColor || '',
            bgImage: s.bgImage || ''
        };
    });

    const deckTitle = deck.title || 'Презентация';
    const payloadJson = JSON.stringify(slidesPayload).replace(/</g, '\\u003c');
    const optionsHtml = slidesPayload.map(function(s, i) {
        return '<option value="' + i + '">Слайд ' + (i + 1) + '</option>';
    }).join('');

    printWindow.document.open();
    printWindow.document.write('<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Печать: ' +
        deckTitle.replace(/</g, '&lt;') + '</title><style>' +
        '*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#e8eaed;color:#1f1f1f}' +
        '.toolbar{position:sticky;top:0;z-index:50;background:#202124;color:#fff;padding:12px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;box-shadow:0 2px 12px rgba(0,0,0,.25)}' +
        '.toolbar label{font-size:11px;text-transform:uppercase;letter-spacing:.4px;opacity:.75;display:block;margin-bottom:4px}' +
        '.toolbar select{height:36px;border-radius:8px;border:1px solid #3c4043;background:#303134;color:#fff;padding:0 10px;font-size:13px;min-width:140px}' +
        '.toolbar .btn{height:36px;border:none;border-radius:8px;padding:0 16px;font-weight:600;font-size:13px;cursor:pointer}' +
        '.btn-print{background:#1a73e8;color:#fff}.btn-close{background:#5f6368;color:#fff}.btn-apply{background:#34a853;color:#fff}' +
        '.hint{font-size:12px;opacity:.7;width:100%;margin-top:4px}' +
        '.pages{padding:24px 16px 60px;max-width:900px;margin:0 auto}' +
        '.print-page{background:#fff;min-height:520px;margin-bottom:24px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.08);padding:40px;position:relative;page-break-after:always;outline:none}' +
        '.print-page.pos-top-left{display:flex;flex-direction:column;justify-content:flex-start;align-items:flex-start;text-align:left}' +
        '.print-page.pos-center{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}' +
        '.print-page.pos-bottom-right{display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-end;text-align:right}' +
        '.print-page .editable{width:100%;min-height:40px}' +
        '.print-page .slide-footer{position:absolute;bottom:12px;right:16px;font-size:11px;color:#888}' +
        '.print-page h1,.print-page h2{margin-top:0}.print-page ul{text-align:left}' +
        '@media print{body{background:#fff}.toolbar{display:none!important}.pages{padding:0;max-width:none}' +
        '.print-page{box-shadow:none;border-radius:0;margin:0;min-height:100vh;page-break-after:always}}' +
        '</style></head><body>' +
        '<div class="toolbar">' +
        '<div><label>Расположение текста</label><select id="pos-select">' +
        '<option value="top-left">Вверху слева</option>' +
        '<option value="center" selected>По середине</option>' +
        '<option value="bottom-right">Внизу справа</option></select></div>' +
        '<div><label>Применить к слайду</label><select id="target-select">' +
        '<option value="all">Ко всем</option>' + optionsHtml + '</select></div>' +
        '<button class="btn btn-apply" id="apply-btn">Применить</button>' +
        '<button class="btn btn-print" id="print-btn">Распечатать</button>' +
        '<button class="btn btn-close" id="close-btn">Закрыть</button>' +
        '<div class="hint">Можно править текст на страницах — правки только для печати, в презентацию не сохраняются.</div></div>' +
        '<div class="pages" id="pages"></div>' +
        '<script>' +
        'var slides=' + payloadJson + ';' +
        'var positions={};slides.forEach(function(_,i){positions[i]="center";});' +
        'function buildPageHtml(s,pos){' +
        'var extra="";if(s.bgColor)extra+="background-color:"+s.bgColor+";";' +
        'if(s.bgImage)extra+="background-image:url("+JSON.stringify(s.bgImage)+");background-size:cover;background-position:center;";' +
        'return \'<div class="print-page pos-\'+pos+\'" data-idx="\'+s.index+\'" contenteditable="true" style="\'+extra+\'">' +
        '<div class="editable">\'+s.html+\'</div><div class="slide-footer">Слайд \'+(s.index+1)+\' из \'+slides.length+\'</div></div>\';}' +
        'function renderAll(){document.getElementById("pages").innerHTML=slides.map(function(s){return buildPageHtml(s,positions[s.index]||"center");}).join("");}' +
        'document.getElementById("apply-btn").onclick=function(){' +
        'var pos=document.getElementById("pos-select").value;' +
        'var target=document.getElementById("target-select").value;' +
        'document.querySelectorAll(".print-page").forEach(function(page){' +
        'var idx=parseInt(page.getAttribute("data-idx"),10);var ed=page.querySelector(".editable");' +
        'if(ed&&slides[idx])slides[idx].html=ed.innerHTML;});' +
        'if(target==="all"){slides.forEach(function(_,i){positions[i]=pos;});}' +
        'else{positions[parseInt(target,10)]=pos;}renderAll();};' +
        'document.getElementById("print-btn").onclick=function(){window.print();};' +
        'document.getElementById("close-btn").onclick=function(){window.close();};' +
        'renderAll();' +
        '</' + 'script></body></html>');
    printWindow.document.close();
}

function showTabContextMenu(e, deckId) {
    e.preventDefault();
    contextMenuDeckId = deckId;

    let menu = document.getElementById('tab-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'tab-context-menu';
        menu.className = 'context-menu hidden';
        document.body.appendChild(menu);
    }

    menu.innerHTML = `
        <div class="context-menu-item" onclick="renameDeckFromContext()">
            <span class="material-symbols-rounded">edit</span> Изменить название
        </div>
        <div class="context-menu-item" onclick="editDeckPurposeFromContext()">
            <span class="material-symbols-rounded">psychology</span> Смысл слайдов
        </div>
        <div class="context-menu-item danger" onclick="deleteDeckFromContext()">
            <span class="material-symbols-rounded">delete</span> Удалить
        </div>
    `;

    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    menu.classList.remove('hidden');
}

function hideTabContextMenu() {
    const menu = document.getElementById('tab-context-menu');
    if (menu) menu.classList.add('hidden');
}

function renameDeckFromContext() {
    hideTabContextMenu();
    const deck = decks.find(d => d.id === contextMenuDeckId);
    if (!deck) return;

    showPrompt('Изменить название', 'Введите новое название презентации:', (newTitle) => {
        if (newTitle && newTitle.trim()) {
            deck.title = newTitle.trim();
            saveDecks();
            renderTabsAndSelect();
        }
    });
}

function editDeckPurposeFromContext() {
    hideTabContextMenu();
    const deck = decks.find(d => d.id === contextMenuDeckId);
    if (!deck) return;

    showPrompt(
        'Смысл слайдов', 
        'Опишите главную цель и суть этой презентации:', 
        (purpose) => {
            if (purpose !== null) {
                deck.purpose = purpose.trim();
                saveDecks();
                showAlert('Смысл сохранен', deck.purpose ? `Суть презентации: "${deck.purpose}"` : 'Описание очищено.');
            }
        }
    );

    const promptInput = document.getElementById('custom-prompt-input');
    if (promptInput && deck.purpose) {
        promptInput.value = deck.purpose;
    }
}

function deleteDeckFromContext() {
    hideTabContextMenu();
    const deckToDelete = decks.find(d => d.id === contextMenuDeckId);
    if (!deckToDelete) return;

    if (decks.length <= 1) {
        showAlert('Внимание', 'Нельзя удалить единственную презентацию!');
        return;
    }

    showConfirmModal(
        '⚠️ Удаление презентации',
        `Вы уверены, что хотите безвозвратно удалить "${escapeHtml(deckToDelete.title)}"?`,
        () => {
            decks = decks.filter(d => d.id !== contextMenuDeckId);
            if (currentDeckId === contextMenuDeckId) {
                currentDeckId = decks[0].id;
            }
            saveDecks();
            renderTabsAndSelect();
            renderSlide();
            if (isAdminLoggedIn) renderAdminSlidesList();
            showAlert('Удалено', 'Презентация была успешно удалена.');
        }
    );
}

function showConfirmModal(title, text, onConfirm) {
    let modal = document.getElementById('confirm-danger-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirm-danger-modal';
        modal.className = 'custom-alert-overlay';
        modal.innerHTML = `
            <div class="custom-alert-card">
                <h3 id="confirm-modal-title" style="margin-bottom:12px; color:#ef4444; font-size:18px;"></h3>
                <p id="confirm-modal-text" style="margin-bottom:20px; font-size:14px; color:var(--text-muted);"></p>
                <div style="display:flex; justify-content:center; gap:10px;">
                    <button class="btn" style="background:var(--border-color); color:var(--text-color);" onclick="closeConfirmModal(false)">Отмена</button>
                    <button class="btn" style="background:#ef4444;" onclick="closeConfirmModal(true)">Удалить</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-text').innerText = text;
    confirmModalCallback = onConfirm;
    modal.classList.add('active');
}

function closeConfirmModal(isConfirmed) {
    const modal = document.getElementById('confirm-danger-modal');
    if (modal) modal.classList.remove('active');
    if (isConfirmed && typeof confirmModalCallback === 'function') {
        confirmModalCallback();
    }
    confirmModalCallback = null;
}

/* ==========================================================================
   ИИ ПОМОЩНИК И ЧАТ
   ========================================================================== */
function openAiModal() {
    document.getElementById('ai-modal').classList.add('active');
}

function closeAiModal() {
    document.getElementById('ai-modal').classList.remove('active');
}

function switchAiMode(mode) {
    const genTab = document.getElementById('ai-tab-gen');
    const chatTab = document.getElementById('ai-tab-chat');
    const genContainer = document.getElementById('ai-mode-generate-container');
    const chatContainer = document.getElementById('ai-mode-chat-container');

    if (mode === 'generate') {
        genTab.classList.add('active');
        chatTab.classList.remove('active');
        genContainer.classList.remove('hidden');
        chatContainer.classList.add('hidden');
    } else {
        chatTab.classList.add('active');
        genTab.classList.remove('active');
        chatContainer.classList.remove('hidden');
        genContainer.classList.add('hidden');
    }
}

function generateAiSlides() {
    const prompt = document.getElementById('ai-prompt-input').value;
    const count = parseInt(document.getElementById('ai-slides-count').value) || 3;
    const status = document.getElementById('ai-status-msg');

    if (!prompt) {
        showAlert('Внимание', 'Введите тему презентации.');
        return;
    }

    status.innerText = 'ИИ генерирует слайды... Подождите.';
    status.classList.remove('hidden');

    setTimeout(() => {
        const generatedSlides = [
            { type: 'title-slide', title: prompt, subtitle: 'Сгенерировано ИИ-помощником' }
        ];

        for (let i = 1; i < count; i++) {
            generatedSlides.push({
                type: 'content',
                title: `Раздел ${i}: Аспект темы`,
                bullets: `Ключевая мысль ${i}.1\nВажная деталь ${i}.2\nВывод или следующий шаг`,
                notes: `Заметка для слайда ${i}`
            });
        }

        const newDeck = {
            id: 'deck-ai-' + Date.now(),
            title: prompt,
            slides: generatedSlides
        };

        decks.push(newDeck);
        switchDeck(newDeck.id);
        
        status.classList.add('hidden');
        closeAiModal();
        showAlert('Готово!', `Создана новая презентация с ${count} слайдами.`);
    }, 1500);
}

function sendAiChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const history = document.getElementById('ai-chat-history');
    const msg = input.value.trim();

    if (!msg) return;

    history.innerHTML += `<div style="text-align:right; color:var(--accent-color); font-weight:500;">Вы: ${escapeHtml(msg)}</div>`;
    input.value = '';

    setTimeout(() => {
        history.innerHTML += `<div style="text-align:left; color:var(--text-color);">🤖 ИИ: Отличный вопрос! Я могу помочь вам дополнить содержимое этих слайдов.</div>`;
        history.scrollTop = history.scrollHeight;
    }, 800);
}

/* ==========================================================================
   НАСТРОЙКИ И ЯЗЫК
   ========================================================================== */
function openSettingsModal() {
    document.getElementById('settings-modal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
}

function saveAiAndDbSettings() {
    showAlert('Успех', 'Параметры сохранены.');
}

function openLanguageModal() {
    document.getElementById('language-modal').classList.add('active');
}

function closeLanguageModal() {
    document.getElementById('language-modal').classList.remove('active');
}

function setLanguage(lang) {
    if (window.i18nLibrary && window.i18nLibrary[lang]) {
        closeLanguageModal();
        showAlert('Язык изменен', `Выбран язык: ${lang.toUpperCase()}`);
    } else {
        closeLanguageModal();
        showAlert('Информация', `Выбран язык: ${lang.toUpperCase()}`);
    }
}

/* ==========================================================================
   ВСПОМОГАТЕЛЬНЫЕ ОКНА (ALERT & PROMPT)
   ========================================================================== */
function showAlert(title, text) {
    document.getElementById('custom-alert-msg').innerHTML = `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(text)}`;
    document.getElementById('custom-alert').classList.add('active');
}

function closeAlert() {
    document.getElementById('custom-alert').classList.remove('active');
}

function showPrompt(title, placeholder, callback) {
    document.getElementById('custom-prompt-title').innerText = title;
    const input = document.getElementById('custom-prompt-input');
    input.placeholder = placeholder;
    input.value = '';
    customPromptCallback = callback;
    document.getElementById('custom-prompt').classList.add('active');
}

function closePrompt(isConfirm) {
    const inputVal = document.getElementById('custom-prompt-input').value;
    document.getElementById('custom-prompt').classList.remove('active');
    if (isConfirm && typeof customPromptCallback === 'function') {
        customPromptCallback(inputVal);
    }
    customPromptCallback = null;
}

function closeDetailsModal() {
    document.getElementById('slide-details-modal').classList.remove('active');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* Custom select */
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
function getSlideTransition(slide, deck) {
    if (slide && slide.transition && slide.transition !== 'inherit') return slide.transition;
    if (deck && deck.defaultTransition) return deck.defaultTransition;
    return 'fade';
}
function applySlideTransition(direction) {
    var body = document.getElementById('slide-body');
    if (!body) return;
    var deck = getCurrentDeck();
    var slide = deck && deck.slides ? deck.slides[currentSlideIndex] : null;
    var type = getSlideTransition(slide, deck);
    if (type === 'none') return;
    body.classList.remove('slide-anim-fade', 'slide-anim-slide-left', 'slide-anim-slide-right', 'slide-anim-zoom');
    void body.offsetWidth;
    if (type === 'fade') body.classList.add('slide-anim-fade');
    else if (type === 'slide') body.classList.add(direction === 'prev' ? 'slide-anim-slide-right' : 'slide-anim-slide-left');
    else if (type === 'zoom') body.classList.add('slide-anim-zoom');
}
function applyDeckDefaultTransition() {
    const deck = getCurrentDeck();
    if (!deck) return;
    const sel = document.getElementById('deck-default-transition');
    if (!sel) return;
    deck.defaultTransition = sel.value;
    saveDecks();
    showAlert('Сохранено', 'Переход по умолчанию применён.');
}
