# AceEditor.js

**AceEditor** - это класс-обертка для Ace Editor, предоставляющий расширенную функциональность для веб-консоли Evolution CMS. Класс поддерживает два режима: PHP и SQL, с контекстным автодополнением, подсветкой синтаксиса и интеграцией с системой.

## Архитектура модуля

```text
AceEditor (класс)
├── Конструктор → инициализация по consoleType (php/sql)
├── Основные компоненты:
│   ├── Editor (ace.edit) - ядро редактора
│   ├── Автодополнение (language_tools) - контекстные подсказки
│   ├── Сниппеты (snippets) - готовые шаблоны кода
│   ├── Обработка ошибок (error markers) - визуализация ошибок
│   ├── Интеграция с StateManager - сохранение состояния
│   └── Кэширование данных - таблицы БД, структуры
└── Ключевые возможности:
    ├── Подсветка синтаксиса (PHP/SQL)
    ├── Динамическое контекстное автодополнение
    ├── Умное позиционирование курсора
    ├── Событийная модель с debounce/throttle
    ├── UI статус-бар (позиция курсора, размер файла)
    └── Полная интеграция с системой консоли
```

## Конструктор и инициализация

### Параметры конструктора
```javascript
/**
 * @param {'php' | 'sql'} consoleType - Тип консоли
 * @throws {Error} Если тип консоли не поддерживается
 */
constructor(consoleType)
```

### Свойства экземпляра
| Свойство | Тип | Назначение |
|----------|-----|------------|
| `consoleType` | `'php' \| 'sql'` | Тип консоли (определяет логику) |
| `editor` | `Ace.Editor \| null` | Экземпляр Ace Editor |
| `errorMarkers` | `Array<number>` | ID маркеров ошибок |
| `databaseTables` | `Array<TableInfo>` | Кэш таблиц БД (для SQL) |
| `tableColumns` | `Object<string, ColumnInfo[]>` | Структуры таблиц |
| `sqlCompleter` | `Ace.Completer \| null` | SQL автодополнитель |
| `changeHandler` | `Function` | Обработчик изменений (debounce 2s) |
| `stateManagerCallback` | `Function \| null` | Колбэк для StateManager |

### Методы инициализации

#### 1. `init()`
**Основная точка входа для инициализации**
```javascript
/**
 * @async
 * @returns {Promise<Ace.Editor>} Экземпляр Ace Editor
 * @throws {Error} Если Ace не загружен или элемент не найден
 */
async init()
```

**Последовательность вызовов:**
1. `isAceLoaded()` - проверка загрузки Ace
2. Создание `ace.edit('code-editor')`
3. `applyBaseConfig()` - базовая конфигурация
4. `setInitialContent()` - начальное содержимое
5. `enableAdvancedFeatures()` - расширенные возможности
6. `setupChangeListener()` - отслеживание изменений
7. `updateEditorInfo()` - обновление UI
8. Для SQL: `loadDatabaseTables()` - загрузка таблиц БД

#### 2. `applyBaseConfig()`
**Применение базовых настроек Ace Editor**
```javascript
// Из EDITOR_CONFIG:
{
    showLineNumbers: true,
    showGutter: true,
    highlightActiveLine: true,
    showPrintMargin: false,
    useWorker: true,
    fontSize: "14px"
}

// Установка режима:
- PHP: "ace/mode/php"
- SQL: "ace/mode/sql"
```

#### 3. `enableAdvancedFeatures()`
**Включение расширенных возможностей**
- Загрузка `ace/ext/language_tools`
- Настройка автодополнения через `setupAutocompletion()`
- Включение сниппетов и live autocompletion

## Работа с содержимым

### Основные методы

| Метод | Параметры | Возвращает | Назначение |
|-------|-----------|------------|------------|
| `getValue()` | - | `string` | Текущее содержимое (trimmed) |
| `setValue(value, cursorPosition)` | `value: string`, `cursorPosition: number = 1` | `void` | Установка нового содержимого |
| `clear()` | - | `void` | Очистка редактора и маркеров ошибок |
| `getCursorPosition()` | - | `CursorPosition \| null` | Текущая позиция курсора |
| `moveCursorToPosition(position)` | `position: CursorPosition` | `void` | Перемещение курсора |
| `getSelections()` | - | `Array<AceRange>` | Все текущие выделения |
| `restoreSelections(selections)` | `selections: Array<AceRange>` | `void` | Восстановление выделений |

### Особенности
- `setValue()` автоматически очищает маркеры ошибок
- `clear()` также очищает error markers
- Все методы проверяют наличие `this.editor`
- Логирование изменений через `logger`

## Автодополнение и сниппеты

### Архитектура автодополнения

#### Для PHP:
```javascript
// Источники данных:
1. analyzeEvolutionCMS() - анализ структуры Evolution CMS
2. generateEvoCompletionsFromAnalysis() - генерация подсказок
3. generateEvoSnippetsFromAnalysis() - генерация сниппетов

// Логика completer:
getCompletions(editor, session, pos, prefix, callback)
    → фильтрация по префиксу (case-insensitive)
    → возврат отфильтрованного массива CompletionItem
```

#### Для SQL:
```javascript
// Источники данных:
1. loadDatabaseTables() - таблицы БД (/consolevo/sql/tables)
2. generateSqlCompletions() - генерация подсказок из таблиц
3. generateSqlSnippets() - генерация сниппетов SQL

// Контекстная логика completer:
Определение контекста:
- isAfterTableDot() - после точки таблицы
- isAfterFrom() - после ключевого слова FROM
- isAfterSelect() - после SELECT (без FROM)
- extractTablesFromQuery() - таблицы в текущем запросе

Контекстные подсказки:
1. После таблицы. → только колонки этой таблицы
2. После FROM → только имена таблиц
3. После SELECT → колонки + функции (зависит от контекста)
4. Общий случай → все подсказки (keywords, tables, columns, functions)
```

### Методы автодополнения

| Метод | Назначение | Особенности |
|-------|------------|-------------|
| `setupAutocompletion()` | Основная настройка | Вызывает setupPhpCompleter() или setupSqlCompleter() |
| `setupPhpCompleter(langTools, analysis)` | PHP completer | Динамические подсказки из анализа Evolution CMS |
| `setupSqlCompleter(langTools)` | SQL completer | Контекстное автодополнение с приоритетами |
| `registerSnippets(snippetManager, snippets)` | Регистрация сниппетов | Регистрация в Ace snippetManager |

### Вспомогательные методы для SQL completer

| Метод | Назначение | Возвращает |
|-------|------------|------------|
| `isAfterTableDot(beforeCursor)` | Проверка контекста "таблица." | `boolean` |
| `extractTableBeforeDot(beforeCursor)` | Извлечение имени таблицы | `string \| null` |
| `isAfterFrom(beforeCursor)` | Проверка контекста "FROM ..." | `boolean` |
| `isAfterSelect(beforeCursor)` | Проверка контекста "SELECT ..." | `boolean` |
| `extractTablesFromQuery(query)` | Извлечение таблиц из запроса | `Array<string>` |
| `getColumnCompletionsForTable(tableName)` | Колонки конкретной таблицы | `Array<CompletionItem>` |
| `getContextualColumnCompletions(query)` | Колонки таблиц из запроса | `Array<CompletionItem>` |
| `extractCleanTableName(tableName)` | Имя таблицы без префикса | `string` |

### Приоритеты подсказок (score)
```javascript
{
    КОЛОНКИ ПОСЛЕ ТОЧКИ: 2000,  // table. → columns
    ОБЫЧНЫЕ КОЛОНКИ: 1500,       // обычные колонки
    КОНТЕКСТНЫЕ КОЛОНКИ: 1200,   // из таблиц запроса
    ТАБЛИЦЫ: 1000,               // имена таблиц
    ФУНКЦИИ: 800,                // SQL функции
    КЛЮЧЕВЫЕ СЛОВА: 500          // SQL keywords
}
```

## Работа с ошибками

### Маркеры ошибок
```javascript
/**
 * Добавление маркера ошибки на строку
 * @param {number} line - Номер строки (0-based)
 * @param {string} message - Сообщение об ошибке
 */
addErrorMarker(line, message)
```

**Что происходит:**
1. `clearErrorMarkers()` - очистка предыдущих маркеров
2. Создание `ace.Range` для всей строки
3. `session.addMarker()` с классом `"ace_error-marker"`
4. `session.setAnnotations()` для отображения сообщения
5. `editor.gotoLine()` - прокрутка к ошибке
6. Сохранение `markerId` в `this.errorMarkers`

### Очистка маркеров
```javascript
/**
 * Очистка всех маркеров ошибок
 */
clearErrorMarkers()
```
- Удаляет все маркеры из сессии
- Очищает аннотации
- Сбрасывает `this.errorMarkers = []`

## UI и настройки

### Управление внешним видом

| Метод | Параметры | Эффект |
|-------|-----------|--------|
| `setTheme(themeName)` | `themeName: string` | Изменение темы Ace Editor |
| `changeFontSize(size)` | `size: number \| string` | Изменение размера шрифта |
| `toggleWrapMode(enabled)` | `enabled: boolean` | Включение/отключение переноса строк |
| `toggleAutocomplete(enabled)` | `enabled: boolean` | Включение/отключение автодополнения |
| `applyPreferences(preferences)` | `preferences: EditorPreferences` | Применение всех настроек |

### Информационная панель
```javascript
// Элементы DOM:
cursor-position → "Строка X, Колонка Y"
file-size → "N символов, M строк"

// Обновление:
updateEditorInfo() → updateCursorPosition() + updateFileSize()
updateCursorPosition() → обновление из editor.getCursorPosition()
updateFileSize() → расчет длины и количества строк
```

## Интеграция с системой

### StateManager интеграция
```javascript
/**
 * Установка колбэка для StateManager
 * @param {Function} callback - Функция обратного вызова
 */
setStateManagerCallback(callback)
```

**Использование:**
1. StateManager вызывает `setStateManagerCallback(saveStateFunction)`
2. При изменениях в редакторе (с debounce 2s) вызывается callback
3. StateManager сохраняет состояние в localStorage

### Событийная модель

#### Обработчики событий
```javascript
// Настроенные события:
{
    'change': () => {
        this.changeCount++;
        this.changeHandler(); // debounced
        this.updateEditorInfo();
    },
    'changeSelection': () => this.updateCursorPosition()
}

// Debounce/throttle:
changeHandler = debounce(this._onChange.bind(this), 2000)
resizeHandler = throttle(this.resize.bind(this), 100)

// Очистка в destroy():
_eventHandlers.forEach((handler, event) => {
    this.editor.off(event, handler);
})
```

### Загрузка данных для SQL

#### `loadDatabaseTables()`
**Загрузка структуры БД для автодополнения**
```javascript
// Endpoint: GET /consolevo/sql/tables
// Headers: X-CSRF-TOKEN, X-Requested-With, Accept: application/json
// Response: { success: true, tables: [], table_structures: {} }

// Сохраняется в:
this.databaseTables = data.tables;      // Array<TableInfo>
this.tableColumns = data.table_structures; // Object<string, ColumnInfo[]>
```

## Особые возможности

### Умное позиционирование курсора
```javascript
// При инициализации:
positionInitialCursor()
- PHP: строка 2 (после открывающего тега)
- SQL: строка 0 (начало)

// При восстановлении состояния:
moveCursorToPosition(position) - из StateManager
```

### Динамическое обновление
```javascript
// При ресайзе окна:
window.addEventListener('resize', this.resizeHandler)
this.resize() → editor.resize()

// При изменении содержимого:
updateEditorInfo() → обновление cursor-position и file-size
```

### Префиксы таблиц
```javascript
// Для работы с Evolution CMS префиксами:
getTablePrefix() - определение префикса таблиц
extractCleanTableName(tableName) - удаление префикса
escapeTableName(tableName) - экранирование идентификаторов
```

## Обработка ошибок и логирование

### Уровни логирования
```javascript
this.log = logger('AceEditor');

// Уровни:
info()  - успешная инициализация, уничтожение
debug() - изменение настроек, установка содержимого
warn()  - недоступность расширений, ошибки загрузки
error() - критические ошибки инициализации
```

### Обработка ошибок в методах
```javascript
try {
    // основная логика
} catch (error) {
    this.log.error('Ошибка в методе X', { 
        error: error.message,
        context: additionalData 
    });
    throw error; // или возврат по умолчанию
}
```

## Уничтожение и очистка

### Метод `destroy()`
**Полная очистка ресурсов**
```javascript
1. Очистка слушателей событий Ace
2. Удаление обработчиков window.resize
3. Отмена debounce/throttle таймеров
4. Очистка кэша данных (таблицы, колонки)
5. Удаление колбэка StateManager
6. Вызов editor.destroy()
7. Сброс флагов (isInitialized = false)
```

## Примеры использования

### Базовое использование
```javascript
const editor = new AceEditor('php');
await editor.init();

// Работа с содержимым
editor.setValue('<?php\necho "Hello";\n?>');
const code = editor.getValue();

// Управление UI
editor.setTheme('ace/theme/monokai');
editor.changeFontSize(16);
```

### Расширенное использование
```javascript
// Интеграция с StateManager
editor.setStateManagerCallback(() => {
    stateManager.saveEditorState();
});

// Работа с ошибками
editor.addErrorMarker(2, 'Syntax error: unexpected token');
setTimeout(() => editor.clearErrorMarkers(), 5000);

// Кастомизация автодополнения
editor.toggleAutocomplete(true);
```

### Для SQL консоли
```javascript
const sqlEditor = new AceEditor('sql');
await sqlEditor.init();

// После загрузки будут доступны:
// - Контекстное автодополнение таблиц/колонок
// - SQL сниппеты
// - Динамические подсказки на основе структуры БД
```

## Производительность и оптимизация

### Оптимизации
1. **Debounce изменений** - 2 секунды для StateManager
2. **Throttle ресайза** - 100ms для resize()
3. **Кэширование таблиц** - однократная загрузка
4. **Ленивая загрузка** - расширения загружаются по необходимости

### Мониторинг
- `changeCount` - счетчик изменений
- Логирование важных операций
- Обработка ошибок с контекстом