// 1. Расширенный словарь на 6 языков
const translations = {
    ru: {
        select_language: "Выберите язык",
        share_link: "Поделиться ссылкой",
        print: "Распечатать",
        admin_panel: "Панель админа",
        legacy: "Загрузить Legacy",
        settings: "Настройки",
        next_btn: "Далее"
    },
    en: {
        select_language: "Select language",
        share_link: "Share link",
        print: "Print",
        admin_panel: "Admin Panel",
        legacy: "Load Legacy",
        settings: "Settings",
        next_btn: "Next"
    },
    de: {
        select_language: "Sprache wählen",
        share_link: "Link teilen",
        print: "Drucken",
        admin_panel: "Admin-Panel",
        legacy: "Legacy laden",
        settings: "Einstellungen",
        next_btn: "Weiter"
    },
    es: {
        select_language: "Seleccionar idioma",
        share_link: "Compartir enlace",
        print: "Imprimir",
        admin_panel: "Panel de control",
        legacy: "Cargar Legacy",
        settings: "Configuración",
        next_btn: "Siguiente"
    },
    fr: {
        select_language: "Choisir la langue",
        share_link: "Partager le lien",
        print: "Imprimer",
        admin_panel: "Panneau d'admin",
        legacy: "Charger Legacy",
        settings: "Paramètres",
        next_btn: "Suivant"
    },
    zh: {
        select_language: "选择语言",
        share_link: "分享链接",
        print: "打印",
        admin_panel: "管理面板",
        legacy: "加载旧版 (Legacy)",
        settings: "设置",
        next_btn: "下一步"
    }
};

const supportedLanguages = Object.keys(translations);

// 2. Умное определение языка с перебором массива navigator.languages
function getInitialLanguage() {
    const savedLang = localStorage.getItem('app_language');
    if (savedLang && translations[savedLang]) {
        return savedLang;
    }

    // Получаем массив всех предпочтительных языков пользователя
    const userLangs = navigator.languages 
        ? navigator.languages.map(lang => lang.slice(0, 2).toLowerCase())
        : [(navigator.language || 'en').slice(0, 2).toLowerCase()];

    // Ищем первое совпадение с поддерживаемыми языками
    const matchedLang = userLangs.find(lang => supportedLanguages.includes(lang));
    
    return matchedLang || 'en';
}

let currentLang = getInitialLanguage();

// 3. Безопасная замена текста и атрибутов (placeholder, title и т.д.)
function applyTranslations() {
    document.documentElement.lang = currentLang;
    
    // Переводим обычные элементы и атрибуты (data-i18n="key" или data-i18n-attr="placeholder:key")
    const elements = document.querySelectorAll('[data-i18n], [data-i18n-attr]');
    
    elements.forEach(el => {
        // Перевод внутреннего текста (textContent вместо innerText)
        const key = el.getAttribute('data-i18n');
        if (key && translations[currentLang]?.[key]) {
            el.textContent = translations[currentLang][key];
        }

        // Поддержка перевода атрибутов (пример HTML: data-i18n-attr="placeholder:select_language")
        const attrConfig = el.getAttribute('data-i18n-attr');
        if (attrConfig) {
            const [attrName, attrKey] = attrConfig.split(':');
            if (attrName && attrKey && translations[currentLang]?.[attrKey]) {
                el.setAttribute(attrName, translations[currentLang][attrKey]);
            }
        }
    });
}

// 4. Управление модальным окном
function openLanguageModal() {
    const modal = document.getElementById('language-modal');
    if (modal) modal.classList.add('active');
}

function closeLanguageModal() {
    const modal = document.getElementById('language-modal');
    if (modal) modal.classList.remove('active');
}

// 5. Установка нового языка
function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('app_language', currentLang);
        applyTranslations();
        closeLanguageModal();
    }
}

// Безопасная инициализация (учитывает статус загрузки DOM)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
} else {
    applyTranslations();
}