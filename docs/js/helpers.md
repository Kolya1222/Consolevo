# helpers.js

**helpers.js** - это модуль утилит, предоставляющий широкий набор вспомогательных функций для работы с веб-консолью Evolution CMS. Модуль содержит функции для безопасности, форматирования, работы с DOM, дебаунса/троттлинга, валидации кода и парсинга ошибок.

## Категории функций

### 1. **БЕЗОПАСНОСТЬ И ВАЛИДАЦИЯ**

#### `getCsrfToken()`
**Получение CSRF токена из meta-тега**

```javascript
/**
 * @returns {string} CSRF токен или пустая строка
 */
export function getCsrfToken() {
    try {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    } catch (error) {
        console.error('Ошибка получения CSRF токена:', error);
        return '';
    }
}
```

**Использование:**
- Для всех запросов к серверу через API
- Защита от CSRF атак
- Извлекается из `<meta name="csrf-token" content="...">`

#### `escapeHtml(text)`
**Экранирование HTML спецсимволов**

```javascript
/**
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
export function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

**Пример:**
```javascript
escapeHtml('<script>alert("xss")</script>');
// → '&lt;script&gt;alert("xss")&lt;/script&gt;'
```

#### `sanitizeHtml(html)`
**Безопасная санитизация HTML**

```javascript
/**
 * @param {string} html - HTML для санитизации
 * @returns {string} Безопасный HTML
 */
export function sanitizeHtml(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
}
```

**Отличие от `escapeHtml()`:**
- `escapeHtml()` - экранирует все спецсимволы
- `sanitizeHtml()` - безопасно отображает как HTML (через textContent)

#### `isValidJson(str)` и `safeJsonParse(str, defaultValue)`
**Безопасная работа с JSON**

```javascript
// Проверка валидности JSON
export function isValidJson(str) {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

// Безопасный парсинг с fallback
export function safeJsonParse(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch {
        return defaultValue;
    }
}
```

**Использование:**
```javascript
// В StateManager для загрузки состояния
const state = safeJsonParse(localStorage.getItem('state'), {});

// В PreferencesManager для настроек
const prefs = safeJsonParse(saved, DEFAULT_PREFERENCES);
```

### 2. **ДЕБАУНС И ТРОТТЛИНГ**

#### `debounce(func, wait, immediate = false)`
**Функция debounce для отложенного выполнения**

```javascript
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}
```

**Использование:**
```javascript
// В StateManager для автосохранения
this.autoSave = debounce(() => this._save(), 2000);

// В HistoryModal для поиска
this.searchHandler = debounce(this._performSearch.bind(this), 300);
```

**Параметры:**
- `func` - функция для выполнения
- `wait` - задержка в миллисекундах
- `immediate` - выполнить сразу, потом игнорировать

#### `throttle(func, limit)`
**Функция throttle для ограничения частоты выполнения**

```javascript
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
```

**Использование:**
```javascript
// В AceEditor для обработки ресайза
this.resizeHandler = throttle(this.resize.bind(this), 100);
```

### 3. **ФОРМАТИРОВАНИЕ**

#### `formatFileSize(bytes)`
**Форматирование размера файла**

```javascript
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

**Примеры:**
```javascript
formatFileSize(1024);      // → "1 KB"
formatFileSize(1048576);   // → "1 MB"
formatFileSize(1234567);   // → "1.18 MB"
```

#### `formatExecutionTime(milliseconds)`
**Форматирование времени выполнения**

```javascript
export function formatExecutionTime(milliseconds) {
    if (milliseconds < 1000) {
        return `${milliseconds.toFixed(2)} ms`;
    } else {
        return `${(milliseconds / 1000).toFixed(3)} s`;
    }
}
```

**Использование в OutputManager:**
```javascript
// При обработке результатов выполнения
const formattedTime = formatExecutionTime(data.execution_time * 1000);
this.add(`Время выполнения: ${formattedTime}`, 'info');
```

#### `formatMemoryUsage(bytes)`
**Форматирование использования памяти**

```javascript
export function formatMemoryUsage(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
```

#### `formatTimestamp(timestamp = Date.now())`
**Форматирование временной метки**

```javascript
export function formatTimestamp(timestamp = Date.now()) {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
```

**Пример:**
```javascript
formatTimestamp(1672531200000); // → "12:00:00"
```

### 4. **ACE EDITOR УТИЛИТЫ**

#### `detectLanguage(code)`
**Определение языка программирования по коду**

```javascript
export function detectLanguage(code) {
    if (code.includes('<?php') || code.includes('$') && code.includes(';')) {
        return 'php';
    }
    if (code.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i)) {
        return 'sql';
    }
    return 'text';
}
```

**Использование:**
- Автоматическое определение типа консоли
- Подсветка синтаксиса по содержимому

#### `getLineCount(code)` и `countWords(text)`
**Анализ текста**

```javascript
export function getLineCount(code) {
    return code.split('\n').length;
}

export function countWords(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
}
```

#### `estimateComplexity(code)`
**Оценка сложности кода**

```javascript
export function estimateComplexity(code) {
    const lines = getLineCount(code);
    const words = countWords(code);
    
    if (lines < 10 && words < 50) return 'low';
    if (lines < 50 && words < 200) return 'medium';
    return 'high';
}
```

### 5. **УТИЛИТЫ РАБОТЫ С ДАННЫМИ**

#### `deepClone(obj)` и `mergeObjects(target, source)`
**Работа с объектами**

```javascript
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export function mergeObjects(target, source) {
    return { ...target, ...source };
}
```

**Ограничения:**
- `deepClone()` не копирует функции и undefined
- Для сложных объектов лучше использовать structuredClone

#### `isEmpty(value)`
**Проверка на пустое значение**

```javascript
export function isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}
```

**Использование во многих модулях:**
- Проверка ввода пользователя
- Валидация данных
- Условия отображения

### 6. **ПОИСК И ФИЛЬТРАЦИЯ**

#### `filterByKeyword(items, keyword, fields = [])`
**Фильтрация массива по ключевому слову**

```javascript
export function filterByKeyword(items, keyword, fields = []) {
    if (!keyword) return items;
    
    const searchTerm = keyword.toLowerCase();
    return items.filter(item => {
        return fields.some(field => {
            const value = item[field];
            return value && String(value).toLowerCase().includes(searchTerm);
        });
    });
}
```

**Использование в CommandHistory:**
```javascript
// Поиск команд в истории
const results = filterByKeyword(this.history, query.toLowerCase(), ['command']);
```

#### `groupBy(array, key)`
**Группировка массива по ключу**

```javascript
export function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const group = item[key];
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
    }, {});
}
```

**Пример:**
```javascript
const commands = [
    { type: 'php', command: 'echo "test"', timestamp: 1 },
    { type: 'sql', command: 'SELECT 1', timestamp: 2 }
];
groupBy(commands, 'type');
// → { php: [...], sql: [...] }
```

### 7. **UI УТИЛИТЫ**

#### `createElement(tag, classes = '', content = '')`
**Безопасное создание DOM элементов**

```javascript
export function createElement(tag, classes = '', content = '') {
    const element = document.createElement(tag);
    if (classes) element.className = classes;
    if (content) element.textContent = content;
    return element;
}
```

**Использование в OutputManager:**
```javascript
// Создание строки вывода
const line = createElement('div', 'console-line fade-in');
```

#### `showNotification(message, type = 'info', duration = 3000)`
**Уведомления (заглушка)**

```javascript
export function showNotification(message, type = 'info', duration = 3000) {
    // Можно интегрировать с вашей системой уведомлений
    console.log(`[${type.toUpperCase()}] ${message}`);
}
```

#### `copyToClipboard(text)`
**Копирование в буфер обмена**

```javascript
export function copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
}
```

**Использование в HistoryModal:**
```javascript
copyToClipboard(command).then(success => {
    if (success) {
        this.showNotification('Команда скопирована в буфер обмена', 'success');
    }
});
```

### 8. **ЛОГГИНГ И ОТЛАДКА**

#### `logger(module)`
**Создание логгера с префиксом модуля**

```javascript
export function logger(module) {
    return {
        info: (message, data) => console.log(`[${module}] ${message}`, data || ''),
        warn: (message, data) => console.warn(`[${module}] ${message}`, data || ''),
        error: (message, data) => console.error(`[${module}] ${message}`, data || ''),
        debug: (message, data) => console.debug(`[${module}] ${message}`, data || '')
    };
}
```

**Использование во всех классах:**
```javascript
// В конструкторе класса
this.log = logger('ClassName');

// В методах
this.log.info('Инициализирован', { config: this.config });
this.log.error('Ошибка выполнения', { error: error.message });
```

### 9. **ТЕСТИРОВАНИЕ И ВАЛИДАЦИЯ**

#### `isPhpCode(code)` и `isSqlQuery(code)`
**Определение типа кода**

```javascript
export function isPhpCode(code) {
    return /<\?php|<\?=|\\$[a-zA-Z_]|\b(echo|function|class|namespace)\b/.test(code);
}

export function isSqlQuery(code) {
    return /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|UNION)\b/i.test(code);
}
```

#### `validateCode(code, type)`
**Валидация кода перед выполнением**

```javascript
export function validateCode(code, type) {
    if (!code.trim()) {
        return { valid: false, error: 'Код не может быть пустым' };
    }
    
    if (type === 'php' && !isPhpCode(code)) {
        return { valid: false, error: 'Не похоже на PHP код' };
    }
    
    if (type === 'sql' && !isSqlQuery(code)) {
        return { valid: false, error: 'Не похоже на SQL запрос' };
    }
    
    return { valid: true };
}
```

**Использование в ConsoleManager:**
```javascript
const validation = validateCode(code, this.config.consoleType);
if (!validation.valid) {
    this.addWarning(validation.error, 'Валидация');
    return;
}
```

#### `escapeSqlIdentifier(identifier)`
**Экранирование SQL идентификаторов**

```javascript
export function escapeSqlIdentifier(identifier) {
    if (!identifier) return '';
    return '`' + identifier.replace(/`/g, '``') + '`';
}
```

**Пример:**
```javascript
escapeSqlIdentifier('table.name'); // → '`table.name`'
```

### 10. **ПАРСИНГ ОШИБОК EVOLUTION CMS**

#### `parseEvolutionError(html)`
**Структурированный парсинг HTML ошибок Evolution CMS**

```javascript
export function parseEvolutionError(html) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Извлечение информации из HTML структуры ошибки
        // ...
        
        return {
            title: errorTitle,
            message: errorMessage,
            sqlError: sqlError,
            benchmarks: benchmarks,
            backtrace: backtrace.slice(0, 10),
            requestInfo: requestInfo,
            rawHtml: html,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        return {
            title: 'HTML Parse Error',
            message: 'Не удалось распарсить HTML ошибку',
            rawHtml: html.substring(0, 500) + '...',
            timestamp: new Date().toISOString()
        };
    }
}
```

**Использование в OutputManager:**
```javascript
const errorInfo = parseEvolutionError(html);
this.handleEvolutionError(errorInfo);
```

**Структура возвращаемого объекта:**
```javascript
{
    title: string,               // Заголовок ошибки
    message: string,             // Основное сообщение
    sqlError: string|null,       // SQL ошибка (если есть)
    benchmarks: Object,          // Бенчмарки выполнения
    backtrace: Array<string>,    // Backtrace (первые 10 строк)
    requestInfo: Object,         // Информация о запросе
    rawHtml: string,            // Оригинальный HTML для отладки
    timestamp: string           // Временная метка парсинга
}
```

## Примеры комплексного использования

### Интеграция в ConsoleManager
```javascript
import { 
    logger, 
    validateCode, 
    formatExecutionTime,
    formatMemoryUsage 
} from '../utils/helpers.js';

class ConsoleManager {
    constructor(config) {
        this.log = logger('ConsoleManager');
        // ...
    }
    
    async executeCode() {
        // Валидация кода
        const validation = validateCode(code, this.config.consoleType);
        if (!validation.valid) {
            this.addWarning(validation.error, 'Валидация');
            return;
        }
        
        // Логирование
        this.log.info('Отправка запроса выполнения кода', { 
            type: this.config.consoleType, 
            codeLength: code.length 
        });
        
        // Обработка результата
        if (result.execution_time) {
            const formattedTime = formatExecutionTime(result.execution_time * 1000);
            this.domElements.executionTime.textContent = formattedTime;
        }
    }
}
```

### Работа с OutputManager
```javascript
import { 
    createElement, 
    formatTimestamp,
    parseEvolutionError 
} from '../utils/helpers.js';

class OutputManager {
    addError(error, context = '') {
        const message = context ? `${context}: ${error}` : error;
        // Использует escapeHtml через PROMPT_SYMBOLS
        this.addSmart(message, 'error');
    }
    
    handleEvolutionError(html) {
        const errorInfo = parseEvolutionError(html);
        
        // Создание структурированного вывода ошибки
        const container = createElement('div', 'evolution-error-container');
        const title = createElement('h3', 'error-title', errorInfo.title);
        const message = createElement('div', 'error-message', errorInfo.message);
        
        container.appendChild(title);
        container.appendChild(message);
        this.outputElement.appendChild(container);
    }
}
```

## Лучшие практики использования

### 1. Импорт только нужных функций
```javascript
// Хорошо - tree-shaking friendly
import { logger, validateCode } from './helpers.js';

// Плохо - импорт всего модуля
import * as helpers from './helpers.js';
```

### 2. Использование logger для отладки
```javascript
// Всегда создавайте логгер в конструкторе
this.log = logger('ClassName');

// Используйте разные уровни логирования
this.log.info('Начало выполнения');
this.log.debug('Детали выполнения', { param1, param2 });
this.log.warn('Предупреждение', { reason });
this.log.error('Ошибка', { error: error.message, stack: error.stack });
```

### 3. Безопасная работа с пользовательским вводом
```javascript
// Всегда экранируйте HTML
const safeContent = escapeHtml(userInput);
element.innerHTML = safeContent; // Теперь безопасно

// Используйте safeJsonParse для ненадежных данных
const data = safeJsonParse(userJson, {});
```

### 4. Дебаунс для частых операций
```javascript
// Для автосохранения, поиска и других частых операций
this.saveHandler = debounce(() => this.save(), 2000);
this.searchHandler = debounce(() => this.search(), 300);
this.resizeHandler = throttle(() => this.resize(), 100);
```

## Расширение модуля

### Добавление новых утилит
```javascript
// Для работы с датами
export function formatDate(date, format = 'DD.MM.YYYY HH:mm') {
    const d = new Date(date);
    // ... реализация форматирования
}

// Для работы с URL
export function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Для анимаций
export function animate(element, animationClass, duration = 300) {
    element.classList.add(animationClass);
    setTimeout(() => element.classList.remove(animationClass), duration);
}
```

### Кастомизация существующих функций
```javascript
// Расширение logger для production
export function productionLogger(module) {
    const log = logger(module);
    
    return {
        info: (message, data) => {
            // В production только в консоль
            console.log(`[${module}] ${message}`, data);
        },
        error: (message, data) => {
            // В production отправляем в Sentry/LogRocket
            console.error(`[${module}] ${message}`, data);
            if (window.Sentry) {
                window.Sentry.captureException(new Error(message), { extra: data });
            }
        },
        // warn и debug можно отключить в production
        warn: () => {},
        debug: () => {}
    };
}
```