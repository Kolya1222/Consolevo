# constants.js

**constants.js** - централизованный модуль констант и конфигураций для всей системы веб-консоли Evolution CE. Модуль содержит настройки редактора, API, состояний, предпочтений пользователя, DOM селекторов и символов для вывода.

## Структура модуля

### 1. **EDITOR_CONFIG** - Конфигурация Ace Editor
Настройки визуального оформления и поведения редактора кода.

```javascript
export const EDITOR_CONFIG = {
    fontSize: 14,                           // Размер шрифта
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace", // Шрифт
    showLineNumbers: true,                  // Показывать номера строк
    showGutter: true,                       // Показывать gutter (область слева)
    showPrintMargin: false,                 // Скрыть линию печати
    highlightActiveLine: true,              // Подсвечивать активную строку
    highlightSelectedWord: true,            // Подсвечивать выбранное слово
    highlightGutterLine: true,              // Подсвечивать строку в gutter
    cursorStyle: "smooth",                  // Стиль курсора
    enableMultiselect: true,                // Включить множественное выделение
    scrollPastEnd: 0.1,                     // Прокрутка за конец файла (10%)
    behavioursEnabled: true,                // Включить стандартное поведение
    wrapBehavioursEnabled: true,            // Включить перенос строк
    autoScrollEditorIntoView: true          // Автопрокрутка при фокусе
};
```

**Ключевые настройки:**
- `fontFamily`: 'Fira Code' поддерживает лигатуры для улучшения читаемости
- `showPrintMargin: false`: убирает вертикальную линию на 80 символов
- `scrollPastEnd: 0.1`: позволяет немного прокрутить после конца файла
- `enableMultiselect`: позволяет редактировать несколько мест одновременно

### 2. **THEMES** - Доступные темы редактора
```javascript
export const THEMES = {
    default: "ace/theme/tomorrow_night",  // Тема по умолчанию (темная)
    monokai: "ace/theme/monokai",         // Популярная темная тема
    github: "ace/theme/github",           // Светлая тема в стиле GitHub
    chrome: "ace/theme/chrome"            // Светлая тема в стиле Chrome devtools
};
```

**Использование:**
- Значения являются путями к темам Ace Editor
- Используются в PreferencesManager и AceEditor
- Можно расширять добавлением новых тем

### 3. **MODES** - Режимы подсветки синтаксиса
```javascript
export const MODES = {
    php: "ace/mode/php",  // Режим для PHP кода
    sql: "ace/mode/sql"   // Режим для SQL запросов
};
```

**Особенности:**
- Определяют правила подсветки синтаксиса
- Автоматически выбираются в зависимости от consoleType
- Поддерживают автодополнение и сниппеты для каждого языка

### 4. **API_CONFIG** - Конфигурация API клиента
```javascript
export const API_CONFIG = {
    timeout: 30000,      // Таймаут запроса: 30 секунд
    maxRetries: 3,       // Максимальное количество повторов
    retryDelay: 1000     // Задержка между повторами: 1 секунда
};
```

**Использование в ApiClient:**
- `timeout`: защита от зависаний при долгих запросах
- `maxRetries`: повышение надежности при временных ошибках
- `retryDelay`: экспоненциальный backoff начинается с этой величины

### 5. **DEFAULT_PREFERENCES** - Настройки по умолчанию
```javascript
export const DEFAULT_PREFERENCES = {
    theme: 'ace/theme/tomorrow_night',  // Тема по умолчанию
    fontSize: 14,                       // Размер шрифта
    wrapMode: true,                     // Включен перенос строк
    enableAutocomplete: true,           // Включено автодополнение
    enableSnippets: true,               // Включены сниппеты
    showLineNumbers: true,              // Показаны номера строк
    showInvisibles: false,              // Скрыты невидимые символы
    highlightActiveLine: true           // Подсвечена активная строка
};
```

**Назначение:**
- Используется при первом запуске или сбросе настроек
- Значения загружаются в PreferencesManager
- Могут быть переопределены пользователем

### 6. **PREFERENCES_SCHEMA** - Схема валидации настроек
```javascript
export const PREFERENCES_SCHEMA = {
    version: {
        type: 'string'
    },
    theme: {
        type: 'string',
        options: [  // Допустимые значения темы
            'ace/theme/tomorrow_night',
            'ace/theme/monokai', 
            'ace/theme/github',
            'ace/theme/chrome'
        ]
    },
    fontSize: {
        type: 'number',
        min: 8,     // Минимальный размер
        max: 24     // Максимальный размер
    },
    wrapMode: {
        type: 'boolean'
    },
    enableAutocomplete: {
        type: 'boolean'
    },
    enableSnippets: {
        type: 'boolean'
    },
    showLineNumbers: {
        type: 'boolean'
    },
    showInvisibles: {
        type: 'boolean'
    },
    highlightActiveLine: {
        type: 'boolean'
    }
};
```

**Использование в PreferencesManager:**
- `type`: тип данных для валидации
- `options`: допустимые значения (для enum)
- `min/max`: диапазон для числовых значений
- Отсутствующие в схеме настройки игнорируются

### 7. **STATE_CONFIG** - Конфигурация StateManager
```javascript
export const STATE_CONFIG = {
    autoSaveDelay: 2000,                           // Задержка автосохранения: 2 секунды
    maxStateAge: 7 * 24 * 60 * 60 * 1000,         // Макс. возраст: 7 дней
    maxStateSize: 1024 * 1024,                     // Макс. размер: 1MB
    version: '1.0'                                 // Версия формата
};
```

**Назначение параметров:**
- `autoSaveDelay`: используется для debounce автосохранения
- `maxStateAge`: автоматическое удаление устаревших состояний
- `maxStateSize`: защита от переполнения localStorage
- `version`: контроль версии формата данных

### 8. **MODULES_CONFIG** - Конфигурация модулей и DOM
```javascript
export const MODULES_CONFIG = {
    initializationOrder: [
        'preferences',  // 1. Настройки
        'state',        // 2. Состояние
        'output',       // 3. Вывод
        'api',          // 4. API клиент
        'editor',       // 5. Редактор
        'history'       // 6. История
    ],
    domSelectors: {
        themeSelector: '#theme-selector',
        fontSizeSelector: '#font-size-selector',
        wrapModeToggle: '#wrap-mode-toggle',
        executeBtn: '#execute-code',
        executeEditorBtn: '#execute-editor',
        clearConsoleBtn: '#clear-console',
        clearEditorBtn: '#clear-editor',
        showHistoryBtn: '#show-history',
        executionTime: '#execution-time',
        memoryUsage: '#memory-usage'
    }
};
```

**Использование в ConsoleManager:**
- `initializationOrder`: строгий порядок инициализации модулей
- `domSelectors`: централизованное управление селекторами DOM
- Упрощает рефакторинг и поддержку кода

### 9. **PROMPT_SYMBOLS** - Символы для вывода сообщений
```javascript
export const PROMPT_SYMBOLS = {
    info: { 
        symbol: '<i class="fas fa-info-circle"></i>', 
        class: 'prompt-info', 
        isHtml: true 
    },
    success: { 
        symbol: '<i class="fas fa-check-circle"></i>', 
        class: 'prompt-success', 
        isHtml: true 
    },
    warning: { 
        symbol: '<i class="fas fa-exclamation-triangle"></i>', 
        class: 'prompt-warning', 
        isHtml: true 
    },
    error: { 
        symbol: '<i class="fas fa-times-circle"></i>', 
        class: 'prompt-error', 
        isHtml: true 
    }
};
```

**Особенности:**
- Использует FontAwesome иконки
- `isHtml: true` - указывает на HTML содержимое
- CSS классы для стилизации в OutputManager
- Используется в `createOutputLine()` метода OutputManager

## Примеры использования

### В AceEditor
```javascript
import { EDITOR_CONFIG, THEMES, MODES } from './constants.js';

class AceEditor {
    applyBaseConfig() {
        this.editor.setOptions(EDITOR_CONFIG);
        this.editor.session.setMode(MODES[this.consoleType]);
        this.editor.setTheme(THEMES.default);
    }
}
```

### В PreferencesManager
```javascript
import { DEFAULT_PREFERENCES, PREFERENCES_SCHEMA } from './constants.js';

class PreferencesManager {
    load() {
        const stored = localStorage.getItem('preferences');
        if (!stored) {
            return DEFAULT_PREFERENCES; // Используем дефолтные настройки
        }
        // ... валидация по PREFERENCES_SCHEMA
    }
}
```

### В ConsoleManager
```javascript
import { MODULES_CONFIG } from './constants.js';

class ConsoleManager {
    constructor() {
        this.initSequence = MODULES_CONFIG.initializationOrder;
    }
    
    cacheDOMElements() {
        Object.entries(MODULES_CONFIG.domSelectors).forEach(([key, selector]) => {
            this.domElements[key] = document.querySelector(selector);
        });
    }
}
```

### В OutputManager
```javascript
import { PROMPT_SYMBOLS } from './constants.js';

class OutputManager {
    createOutputLine(message, type) {
        const iconHtml = PROMPT_SYMBOLS[type]?.symbol || PROMPT_SYMBOLS.info.symbol;
        // ... создание DOM элемента
    }
}
```

## Расширение констант

### Добавление новой темы
```javascript
// 1. Добавить в THEMES
export const THEMES = {
    // ... существующие темы
    solarized: "ace/theme/solarized_dark",
    dracula: "ace/theme/dracula"
};

// 2. Добавить в PREFERENCES_SCHEMA.options
theme: {
    type: 'string',
    options: [
        // ... существующие опции
        'ace/theme/solarized_dark',
        'ace/theme/dracula'
    ]
}
```

### Добавление нового DOM селектора
```javascript
export const MODULES_CONFIG = {
    domSelectors: {
        // ... существующие селекторы
        saveButton: '#save-snippet',
        exportButton: '#export-code'
    }
};
```

### Добавление нового типа сообщения
```javascript
export const PROMPT_SYMBOLS = {
    // ... существующие символы
    debug: { 
        symbol: '<i class="fas fa-bug"></i>', 
        class: 'prompt-debug', 
        isHtml: true 
    },
    system: { 
        symbol: '<i class="fas fa-server"></i>', 
        class: 'prompt-system', 
        isHtml: true 
    }
};
```

## Преимущества централизации

### 1. **Единая точка правки**
- Изменение селекторов DOM в одном месте
- Обновление настроек API для всех модулей
- Модификация цветовой схемы

### 2. **Типобезопасность и валидация**
- PREFERENCES_SCHEMA обеспечивает валидацию типов
- Константы импортируются с правильными типами
- Автодополнение в IDE

### 3. **Консистентность**
- Все модули используют одинаковые значения
- Единые стандарты оформления
- Согласованное поведение

### 4. **Упрощение рефакторинга**
- Легко находить и изменять настройки
- Минимизация magic strings
- Четкая структура конфигурации

## Лучшие практики использования

### 1. Всегда импортировать только нужные константы
```javascript
// Хорошо
import { EDITOR_CONFIG, THEMES } from './constants.js';

// Плохо
import * as constants from './constants.js'; // tree-shaking не сработает
```

### 2. Использовать деструктуризацию
```javascript
// Хорошо
const { default: defaultTheme, monokai } = THEMES;

// Плохо
const defaultTheme = THEMES.default;
const monokai = THEMES.monokai;
```

### 3. Не модифицировать константы
```javascript
// Запрещено
THEMES.custom = 'ace/theme/custom'; // TypeError в strict mode

// Разрешено (создание копии)
const customThemes = { ...THEMES, custom: 'ace/theme/custom' };
```

### 4. Использовать для дефолтных значений
```javascript
// Хорошо
function createEditor(config = EDITOR_CONFIG) {
    // ...
}

// Плохо
function createEditor(config = { fontSize: 14, showLineNumbers: true /*...*/ }) {
    // ...
}
```