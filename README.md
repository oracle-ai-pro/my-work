# Prestige HQ WorkSuite (My Work)

**Prestige HQ WorkSuite** — лёгкая автономная веб-экосистема офисных и учебных инструментов, работающая прямо в браузере.  
Чистый стек: **Vanilla JavaScript · HTML5 · CSS3**, без обязательного бэкенда и тяжёлых фреймворков.

Данные хранятся в `localStorage`. Обмен проектами — через JSON. ИИ (WorkGens) подключается к **Google Gemini API** (нужен интернет и API-ключ).

---

## Состав экосистемы

| Сервис | Папка | Кратко |
|--------|--------|--------|
| **Хаб** | `/` (`index.html`) | Выбор сервиса, тема, карточки |
| **Документы** | `/document` | Редактор блоков, печать, темы |
| **Формы** | `/forms` | Тесты, Learn, FlashCards, темы уроков |
| **Слайды** | `/slides` | Презентации, докладчик, переходы |
| **Таблицы** | `/spreadsheets` | Сетка, листы, книги, формулы |
| **Keeps** | `/keeps` | Заметки, чеклисты, архив |
| **WorkGens AI** | `/WorkGens` | Чат + Студия генерации проектов |

---

### Документы (`/document`)
- Блоки контента (текст, callout, steps, quote, code, divider, video и др.)
- Вкладки документов, кастомные select/модалки
- Темы, Liquid Glass (beta), скругления, масштаб UI
- Печать / share, PWA + офлайн-оболочка

### Формы (`/forms`)
- Типы вопросов: radio, checkbox, text, select, true/false, fill-blank, flashcards и др.
- Режимы: **Test**, **Learn**, **FlashCards**
- Темы (категории) с боковым меню, прогресс, обязательные вопросы
- Объяснения к ответам, таймеры, озвучка, превью формы
- Админка (логин), share-ссылка, печать бланка
- PWA, офлайн-индикатор, Liquid Glass

### Слайды (`/slides`)
- Макеты: title, content, quote, media, code, KPI, timeline, comparison, checklist…
- Показ, полноэкран, свайпы/клавиши, переходы
- **Режим докладчика:** заметки, таймеры, превью, hotkeys
- Темы, Liquid Glass, UI-scale, PWA

### Таблицы (`/spreadsheets`)
- Книги → листы → сетка ячеек
- Выделение диапазона, заливка, границы, ПКМ (строки/столбцы)
- +40 строк / +40 столбцов, переименование/удаление листов
- Share и печать (выбор листов в about:blank)
- Дизайн в стиле остальной экосистемы, PWA

### Keeps (`/keeps`)
- Заметки с rich-text, чекбоксы, цвета, закрепление
- Напоминания, архив, фильтры, вид **сетка / список**
- Дублирование, экспорт .txt / .md, автосохранение
- Liquid Glass, UI-scale, PWA

### WorkGens AI (`/WorkGens`)
- Чат с Gemini (`gemini-3.8-flash` и др.)
- Режимы Plan / Agent, вложения, голос
- **Студия:** живой превью (формы кликабельны, таблица-сетка, слайды ←→, документы, заметки)
- Импорт сгенерированного в Forms / Document / Slides / Keeps / Spreadsheets
- Нужен интернет и API-ключ Google AI Studio

---

## Ключевые особенности

- **Единый хаб** — навигация между сервисами
- **Автономность** — логика на клиенте, `localStorage`
- **Импорт / экспорт** JSON (и обмен через WorkGens)
- **Темы** светлая / тёмная, пресеты скругления
- **Liquid Glass (beta)** — стекломорфизм
- **Кастомные** select, модалки, скроллы, ПКМ
- **PWA** — manifest + service worker (офлайн-оболочка; онлайн-фичи вроде AI/share отключаются без сети)
- **Адаптив** — телефон / планшет / ПК

---

## Структура репозитория

```text
my-work/
├── index.html                 # Хаб Prestige HQ
├── README.md
├── document/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── manifest.webmanifest
│   └── sw.js
├── forms/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── forms.png
│   ├── manifest.webmanifest
│   └── sw.js
├── slides/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── slides.png
│   ├── manifest.webmanifest
│   └── sw.js
├── spreadsheets/
│   ├── index.html
│   ├── style.css
│   ├── script.js              # или src/*.js
│   ├── spreadsheets.png
│   ├── manifest.webmanifest
│   └── sw.js
├── keeps/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── keeps.png
│   ├── manifest.webmanifest
│   └── sw.js
└── WorkGens/                  # (или workgens/)
    ├── index.html
    ├── style.css
    ├── script.js
    └── icon.png
```

Иконки (`*.png`) и `MY Work.png` для хаба положите рядом с соответствующими `index.html`.

---

## Запуск

1. Откройте папку через **VS Code Live Server**, **npx serve**, nginx или любой static-host.
2. Зайдите на `index.html` хаба.
3. Для **WorkGens AI**: [Google AI Studio → API Key](https://aistudio.google.com/apikey) → вставьте ключ в настройках.  
   Рекомендуемая модель: **`gemini-3.8-flash`**.

> PWA и service worker требуют **HTTPS** или `localhost`.

---

## Данные (localStorage, кратко)

| Ключ (примеры) | Сервис |
|----------------|--------|
| `my_forms_data` | Forms |
| `prestige_decks` | Slides |
| `keeps_notes` | Keeps |
| `myDocsData` | Document |
| `my_spreadsheets_data` | Spreadsheets |
| `wg_api_key`, `wg_chats`, `wg_gemini_model` | WorkGens |

Перед публикацией чужим людям не отдавайте формы с кастомным админ-логином без предупреждения (см. UI форм).

---

## Статус к публикации

| Модуль | Готовность |
|--------|------------|
| Хаб | ✅ |
| Forms | ✅ |
| Document | ✅ |
| Slides | ✅ |
| Spreadsheets | ✅ |
| Keeps | ✅ |
| WorkGens AI | ✅ (нужен ключ Gemini) |

Перед релизом имеет смысл: прогнать smoke-тест каждого сервиса, проверить иконки PWA и пути `../forms`, `../spreadsheets` и т.д. на вашем хостинге.

---

## Лицензия / авторство

Prestige HQ · WorkSuite (My Work).  
Используйте и дорабатывайте под свои задачи.
