# StateManager.js

**StateManager** - это менеджер для управления состоянием редактора кода. Он обеспечивает сохранение, загрузку и восстановление состояния редактора (содержимое, позиция курсора, выделения) с автоматической валидацией, сжатием и контролем версий. Все данные хранятся в localStorage с ограничениями по размеру и времени жизни.

## Конструктор и инициализация

### Параметры конструктора
```javascript
/**
 * Создает экземпляр менеджера состояния
 * @param {'php' | 'sql'} consoleType - Тип консоли
 */
constructor(consoleType)
```

### Свойства экземпляра
| Свойство | Тип | Описание |
|----------|-----|----------|
| `consoleType` | `'php' \| 'sql'` | Тип консоли для разделения состояний |
| `stateKey` | `string` | Ключ для localStorage (`consolevo_state_${consoleType}`) |
| `log` | `Object` | Логгер с методами debug/info/warn/error |
| `config` | `Object` | Конфигурация из STATE_CONFIG |

## Основные методы

### 1. `saveState(content, cursorPosition, selections, metadata)`
**Сохраняет состояние редактора с валидацией и сжатием**

```javascript
/**
 * @param {string} content - Содержимое редактора
 * @param {CursorPosition} cursorPosition - Позиция курсора
 * @param {AceRange[]} selections - Массив выделений
 * @param {Object} metadata - Дополнительные метаданные
 * @returns {boolean} true если состояние сохранено успешно
 */
```

**Процесс сохранения:**
```javascript
1. Создание объекта состояния:
   - content: содержимое редактора
   - cursor: позиция курсора (или {row: 0, column: 0})
   - selections: массив выделений
   - timestamp: текущее время
   - version: версия из config
   - consoleType: тип консоли
   - metadata: метаданные + пользовательские метаданные

2. Проверка размера:
   - Если размер > maxStateSize (100KB):
     * Лог предупреждения
     * Сохраняем без содержимого (content = '')
     * Помечаем truncated = true в метаданных

3. Сохранение в localStorage

4. Логирование результата
```

**Пример использования:**
```javascript
// Сохранение состояния после выполнения кода
stateManager.saveState(
    '<?php echo "Hello World"; ?>',
    { row: 0, column: 4 },
    [],
    { executionTime: 0.123, success: true }
);

// Сохранение только с курсором
stateManager.saveState(
    editor.getValue(),
    editor.getCursorPosition(),
    editor.getSelections()
);
```

### 2. `loadState()`
**Загружает состояние с проверкой целостности**

```javascript
/**
 * @returns {EditorState|null} Состояние редактора или null
 */
```

**Процесс загрузки:**
```javascript
1. Получение данных из localStorage
2. Проверка isEmpty() → если пусто, return null
3. Безопасный парсинг JSON через safeJsonParse()
4. Валидация состояния:
   - Проверка версии (state.version === config.version)
     * Если не совпадает → clearState() и return null
   - Проверка возраста (Date.now() - state.timestamp < maxStateAge)
     * Если устарело → clearState() и return null
5. Логирование информации о состоянии
6. Возврат состояния
```

**Пример использования:**
```javascript
const state = stateManager.loadState();
if (state) {
    console.log('Загружено состояние от:', new Date(state.timestamp));
    console.log('Содержимое:', state.content.substring(0, 50));
}
```

### 3. `restoreToEditor(editor, state)`
**Восстанавливает состояние в редактор**

```javascript
/**
 * @param {AceEditor} editor - Экземпляр AceEditor
 * @param {EditorState} state - Состояние для восстановления
 * @returns {boolean} true если состояние восстановлено успешно
 */
```

**Процесс восстановления:**
```javascript
1. Проверка editor и state
2. Восстановление содержимого:
   - editor.setValue(state.content, 1)
3. Восстановление курсора:
   - editor.moveCursorToPosition(state.cursor)
   - или editor.moveCursorTo(row, column)
4. Восстановление выделений:
   - editor.restoreSelections(state.selections)
   - или через editor.selection.setSelectionRange()
5. Логирование результата
```

**Пример использования:**
```javascript
// Восстановление загруженного состояния
const state = stateManager.loadState();
if (state) {
    stateManager.restoreToEditor(aceEditor, state);
}

// Или напрямую при инициализации
function initEditor() {
    const editor = new AceEditor('php');
    await editor.init();
    
    const state = stateManager.loadState();
    if (state) {
        stateManager.restoreToEditor(editor, state);
    }
}
```

### 4. `clearState()`
**Очищает сохраненное состояние**

```javascript
/**
 * @returns {boolean} true если состояние очищено успешно
 */
```

**Использование:**
```javascript
// Ручная очистка состояния
stateManager.clearState();

// При логике "Новый файл"
function createNewFile() {
    if (confirm('Создать новый файл? Текущие изменения будут потеряны.')) {
        stateManager.clearState();
        editor.setValue('');
    }
}
```

### 5. `hasSavedState()`
**Проверяет наличие сохраненного состояния**

```javascript
/**
 * @returns {boolean} true если есть сохраненное состояние
 */
```

**Использование:**
```javascript
// Показать кнопку восстановления только если есть состояние
if (stateManager.hasSavedState()) {
    showRestoreButton();
}

// Автоматическое восстановление при загрузке
window.addEventListener('load', () => {
    if (stateManager.hasSavedState()) {
        const state = stateManager.loadState();
        // ... восстановление
    }
});
```

### 6. `getStateInfo()`
**Получает информацию о сохраненном состоянии**

```javascript
/**
 * @returns {Object|null} Информация о состоянии
 */
```

**Возвращаемые данные:**
```javascript
{
    timestamp: number,        // Временная метка
    age: number,              // Возраст в миллисекундах
    size: number,             // Размер в байтах
    contentLength: number,    // Длина содержимого
    lines: number,            // Количество строк
    selectionsCount: number,  // Количество выделений
    truncated: boolean,       // Было ли обрезано
    consoleType: string       // Тип консоли
}
```

**Пример использования:**
```javascript
const info = stateManager.getStateInfo();
if (info) {
    console.log(`Состояние от: ${new Date(info.timestamp).toLocaleString()}`);
    console.log(`Размер: ${info.size} байт`);
    console.log(`Строк: ${info.lines}`);
}
```

## Методы импорта/экспорта

### `exportState()`
**Экспортирует состояние как JSON строку**

```javascript
/**
 * @returns {string|null} JSON строка с состоянием
 */
```

**Использование:**
```javascript
// Экспорт для бэкапа
const json = stateManager.exportState();
if (json) {
    const blob = new Blob([json], { type: 'application/json' });
    // ... создание ссылки для скачивания
}

// Экспорт для отправки по API
function sendStateToServer() {
    const stateJson = stateManager.exportState();
    if (stateJson) {
        fetch('/api/save-state', {
            method: 'POST',
            body: stateJson
        });
    }
}
```

### `importState(json)`
**Импортирует состояние из JSON строки**

```javascript
/**
 * @param {string} json - JSON строка с состоянием
 * @returns {boolean} true если состояние успешно импортировано
 */
```

**Процесс импорта:**
```javascript
1. Безопасный парсинг JSON через safeJsonParse()
2. Проверка что результат - объект
3. Добавление обязательных полей (timestamp, version, consoleType)
4. Сохранение в localStorage
5. Логирование успешного импорта
```

**Пример использования:**
```javascript
// Импорт из файла
function importStateFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const success = stateManager.importState(e.target.result);
        if (success) {
            console.log('Состояние импортировано');
            // Можно автоматически восстановить
            const state = stateManager.loadState();
            stateManager.restoreToEditor(editor, state);
        }
    };
    reader.readAsText(file);
}

// Импорт из API
async function loadStateFromServer() {
    const response = await fetch('/api/get-state');
    const json = await response.text();
    const success = stateManager.importState(json);
    if (success) {
        showNotification('Состояние загружено с сервера');
    }
}
```

## Вспомогательные методы

### `formatAge(ageInMs)`
**Форматирует возраст состояния в читаемый вид**

```javascript
/**
 * @param {number} ageInMs - Возраст в миллисекундах
 * @returns {string} Отформатированный возраст
 * @private
 */
```

**Форматирование:**
```javascript
> 1 день → "1 д."
> 5 часов → "5 ч."
> 30 минут → "30 мин."
> 45 секунд → "45 сек."
```

## Примеры использования

### Базовое использование
```javascript
// Инициализация
const stateManager = new StateManager('php');

// Автосохранение при изменениях (debounced)
editor.on('change', debounce(() => {
    stateManager.saveState(
        editor.getValue(),
        editor.getCursorPosition(),
        editor.getSelections()
    );
}, 2000));

// Автоматическое восстановление при загрузке
window.addEventListener('load', () => {
    const state = stateManager.loadState();
    if (state) {
        stateManager.restoreToEditor(editor, state);
        console.log('Состояние восстановлено');
    }
});

// Очистка при выходе
window.addEventListener('beforeunload', () => {
    stateManager.saveState(
        editor.getValue(),
        editor.getCursorPosition(),
        editor.getSelections()
    );
});
```

### Расширенное использование
```javascript
// Сохранение с дополнительными метаданными
function saveWithMetadata() {
    const metadata = {
        lastAction: 'execute',
        executionResult: result.success,
        fileType: 'php',
        custom: {
            project: 'My Project',
            version: '1.0.0'
        }
    };
    
    stateManager.saveState(
        editor.getValue(),
        editor.getCursorPosition(),
        editor.getSelections(),
        metadata
    );
}

// Управление несколькими состояниями
class MultiStateManager {
    constructor() {
        this.phpState = new StateManager('php');
        this.sqlState = new StateManager('sql');
    }
    
    saveAll() {
        this.phpState.saveState(phpEditor.getValue(), phpEditor.getCursorPosition());
        this.sqlState.saveState(sqlEditor.getValue(), sqlEditor.getCursorPosition());
    }
    
    restoreAll() {
        const phpState = this.phpState.loadState();
        const sqlState = this.sqlState.loadState();
        
        if (phpState) this.phpState.restoreToEditor(phpEditor, phpState);
        if (sqlState) this.sqlState.restoreToEditor(sqlEditor, sqlState);
    }
}

// Резервное копирование состояния
function createBackup() {
    const stateJson = stateManager.exportState();
    if (stateJson) {
        // Сохранить в IndexedDB
        saveToIndexedDB('state_backup', {
            timestamp: Date.now(),
            state: JSON.parse(stateJson)
        });
        
        // Или отправить на сервер
        fetch('/api/backup-state', {
            method: 'POST',
            body: stateJson
        });
    }
}

// Восстановление из резервной копии
async function restoreFromBackup() {
    // Из IndexedDB
    const backup = await getFromIndexedDB('state_backup');
    if (backup) {
        const success = stateManager.importState(JSON.stringify(backup.state));
        if (success) {
            const state = stateManager.loadState();
            stateManager.restoreToEditor(editor, state);
        }
    }
    
    // Или с сервера
    const response = await fetch('/api/get-latest-state');
    const json = await response.text();
    stateManager.importState(json);
}
```

## Логирование

### Уровни логирования
```javascript
this.log.info('Инициализирован', { type, stateKey })
this.log.debug('Состояние сохранено', { contentLength, lines, cursor, selections, size })
this.log.debug('Состояние загружено', { contentLength, lines, selections, age })
this.log.debug('Нет сохраненного состояния')
this.log.warn('Состояние слишком большое', { size, maxSize })
this.log.warn('Неверный формат сохраненного состояния')
this.log.warn('Версия состояния устарела', { saved, current })
this.log.info('Состояние восстановлено в редактор', { contentLength, hasCursor, hasSelections, selectionsCount })
this.log.info('Состояние очищено', { stateKey })
this.log.info('Состояние импортировано', { contentLength })
this.log.error('Ошибка сохранения состояния', { error, contentLength })
this.log.error('Ошибка загрузки состояния', { error })
this.log.error('Ошибка восстановления состояния в редактор', { error })
this.log.error('Ошибка очистки состояния', { error })
this.log.error('Ошибка импорта состояния', { error })
this.log.error('Некорректный формат JSON для импорта')
```

### Контекст логирования
- `contentLength`, `lines` - информация о содержимом
- `cursor`, `selections` - состояние редактора
- `size` - размер состояния в байтах
- `age` - возраст состояния
- `type`, `stateKey` - конфигурация
- `error` - сообщения об ошибках

## Безопасность

### Меры защиты
1. **Безопасный парсинг JSON** - `safeJsonParse()` вместо `JSON.parse()`
2. **Проверка версии** - предотвращение использования устаревших форматов
3. **Ограничение размера** - предотвращение DoS через большие состояния
4. **Ограничение времени жизни** - автоматическая очистка устаревших состояний
5. **Валидация структуры** - проверка обязательных полей

### Защита от переполнения localStorage
- Максимальный размер состояния: 100KB
- При превышении: сохранение только метаданных
- Автоматическая очистка устаревших данных (7 дней)

## Уничтожение

```javascript
/**
 * Уничтожает менеджер состояния
 * @returns {void}
 */
destroy() {
    this.log.info('StateManager уничтожен', { stateKey: this.stateKey });
}
```