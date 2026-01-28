# PreferencesManager.js

**PreferencesManager** - это менеджер для управления пользовательскими настройками веб-консоли. Он обеспечивает безопасное хранение, загрузку и валидацию настроек в localStorage, предоставляет API для работы с индивидуальными и множественными настройками, а также поддерживает импорт/экспорт настроек.

## Конструктор и инициализация

### Параметры конструктора
```javascript
/**
 * Создает экземпляр менеджера настроек
 */
constructor()
```

### Свойства экземпляра
| Свойство | Тип | Описание |
|----------|-----|----------|
| `log` | `Object` | Логгер с методами debug/info/warn/error |


## Основные методы

### 1. `load()`
**Загружает настройки из localStorage**

```javascript
/**
 * @returns {Preferences} Объект настроек
 */
```

**Алгоритм загрузки:**
```javascript
1. Получить данные: localStorage.getItem('consolevo_preferences')
2. Если isEmpty(stored) → вернуть DEFAULT_PREFERENCES
3. Парсинг JSON через safeJsonParse() с дефолтным fallback
4. Валидация и мерж с дефолтами через validateAndMerge()
5. Логирование результата валидации
```

**Пример использования:**
```javascript
const prefs = preferencesManager.load();
console.log(prefs.theme); // 'ace/theme/tomorrow_night'
console.log(prefs.fontSize); // 14
```

### 2. `save(key, value)`
**Сохраняет отдельную настройку**

```javascript
/**
 * @param {keyof Preferences} key - Ключ настройки
 * @param {*} value - Значение настройки
 * @returns {boolean} true если настройка сохранена успешно
 */
```

**Процесс сохранения:**
```javascript
1. Преобразование строки в число для fontSize (если нужно)
2. Валидация значения через validateValue(key, value)
3. Загрузка текущих настроек
4. Проверка изменения значения (если не изменилось → return true)
5. Обновление значения в объекте настроек
6. Сохранение в localStorage
7. Логирование успешного сохранения
```

**Примеры использования:**
```javascript
// Сохранение темы
preferencesManager.save('theme', 'ace/theme/monokai');

// Сохранение размера шрифта (строку преобразует в число)
preferencesManager.save('fontSize', '16'); // станет 16
preferencesManager.save('fontSize', 16); // или сразу число

// Сохранение булевых значений
preferencesManager.save('wrapMode', true);
preferencesManager.save('enableAutocomplete', false);
```

### 3. `get(key, defaultValue)`
**Получает значение настройки**

```javascript
/**
 * @param {keyof Preferences} key - Ключ настройки
 * @param {*} [defaultValue=null] - Значение по умолчанию
 * @returns {*} Значение настройки
 */
```

**Логика получения:**
```javascript
1. Загрузка всех настроек через load()
2. Возврат preferences[key] ?? defaultValue
```

**Примеры использования:**
```javascript
// Получение темы
const theme = preferencesManager.get('theme');

// Получение с дефолтным значением
const fontSize = preferencesManager.get('fontSize', 14);

// Безопасное получение (если ключа нет в схеме)
const unknown = preferencesManager.get('unknownKey', 'default');
// → 'default' (но обычно проверяется через валидацию)
```

### 4. `getAll()`
**Получает все настройки**

```javascript
/**
 * @returns {Preferences} Все настройки
 */
```

**Использование:**
```javascript
const allPrefs = preferencesManager.getAll();
console.log(allPrefs);
// {
//   theme: 'ace/theme/tomorrow_night',
//   fontSize: 14,
//   wrapMode: false,
//   enableAutocomplete: true
// }
```

### 5. `clear()`
**Очищает все пользовательские настройки**

```javascript
/**
 * @returns {boolean} true если настройки успешно очищены
 */
```

**Действия:**
1. Удаление ключа из localStorage
2. Логирование операции
3. Возврат к DEFAULT_PREFERENCES при следующем load()

**Использование:**
```javascript
preferencesManager.clear(); // Возвращает настройки к дефолтным
```

### 6. `saveMultiple(updates)`
**Сохраняет несколько настроек одновременно**

```javascript
/**
 * @param {Object} updates - Объект с обновлениями настроек
 * @returns {boolean} true если настройки сохранены успешно
 */
```

**Алгоритм:**
```javascript
1. Загрузка текущих настроек
2. Итерация по updates:
   - Валидация каждого значения
   - Если валидно и изменилось → обновление
   - Если невалидно → лог предупреждения
3. Если были изменения → сохранение в localStorage
4. Логирование количества обновлений
```

**Пример использования:**
```javascript
// Массовое обновление настроек
preferencesManager.saveMultiple({
    theme: 'ace/theme/monokai',
    fontSize: 16,
    wrapMode: true,
    enableAutocomplete: false
});

// Частичное обновление
preferencesManager.saveMultiple({
    theme: 'ace/theme/solarized_dark'
});
```

## Вспомогательные методы

### `validateAndMerge(preferences)`
**Валидирует и объединяет настройки с дефолтами**

```javascript
/**
 * @param {Object} preferences - Загруженные настройки
 * @returns {Preferences} Валидированные настройки
 * @private
 */
```

**Логика валидации:**
```javascript
1. Начало с копии DEFAULT_PREFERENCES
2. Для каждого ключа в preferences:
   - Проверка через validateValue(key, value)
   - Если валидно → добавляем в результат
3. Логирование статистики валидации
4. Возврат объединенного объекта
```

### `validateValue(key, value)`
**Валидирует значение для указанного ключа**

```javascript
/**
 * @param {string} key - Ключ настройки
 * @param {*} value - Значение для проверки
 * @returns {boolean} true если значение валидно
 * @private
 */
```

**Процесс валидации:**
```javascript
1. Получение схемы: PREFERENCES_SCHEMA[key]
   - Если схемы нет → false + лог предупреждения
2. Преобразование строки в число для fontSize
3. Проверка типа: typeof value === schema.type
4. Проверка enum (если options существует): value в options
5. Проверка диапазона для чисел:
   - value >= schema.min (если min существует)
   - value <= schema.max (если max существует)
6. Возврат результата валидации
```

### `hasSavedPreferences()`
**Проверяет наличие сохраненных настроек**

```javascript
/**
 * @returns {boolean} true если есть сохраненные настройки
 */
```

**Использование:**
```javascript
if (preferencesManager.hasSavedPreferences()) {
    console.log('Пользовательские настройки найдены');
} else {
    console.log('Используются настройки по умолчанию');
}
```

## Методы импорта/экспорта

### `exportAsJson()`
**Экспортирует настройки как JSON строку**

```javascript
/**
 * @returns {string} JSON строка с настройками
 */
```

**Пример:**
```javascript
const json = preferencesManager.exportAsJson();
console.log(json);
// {
//   "theme": "ace/theme/tomorrow_night",
//   "fontSize": 14,
//   "wrapMode": false,
//   "enableAutocomplete": true
// }
```

**Использование для бэкапа:**
```javascript
// Сохранение настроек в файл
const json = preferencesManager.exportAsJson();
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// ... создание ссылки для скачивания
```

### `importFromJson(json)`
**Импортирует настройки из JSON строки**

```javascript
/**
 * @param {string} json - JSON строка с настройками
 * @returns {boolean} true если настройки успешно импортированы
 */
```

**Процесс импорта:**
```javascript
1. Безопасный парсинг JSON через safeJsonParse()
2. Проверка что результат - объект
3. Сохранение через saveMultiple()
```

**Пример использования:**
```javascript
// Импорт из JSON строки
const success = preferencesManager.importFromJson(
    '{"theme":"ace/theme/monokai","fontSize":16}'
);

// Импорт из файла
function importFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const success = preferencesManager.importFromJson(e.target.result);
        if (success) {
            console.log('Настройки импортированы');
        }
    };
    reader.readAsText(file);
}
```

## Примеры использования

### Базовое использование
```javascript
// Инициализация
const preferences = new PreferencesManager();

// Загрузка настроек
const prefs = preferences.load();

// Изменение и сохранение настроек
preferences.save('theme', 'ace/theme/monokai');
preferences.save('fontSize', 16);

// Получение отдельных значений
const currentTheme = preferences.get('theme');
const currentFontSize = preferences.get('fontSize', 14);

// Очистка настроек
preferences.clear();
```

### Интеграция с редактором
```javascript
// Применение настроек к Ace Editor
function applyPreferencesToEditor(editor, preferences) {
    const prefs = preferences.getAll();
    
    // Применение темы
    if (prefs.theme) {
        editor.setTheme(prefs.theme);
    }
    
    // Применение размера шрифта
    if (prefs.fontSize) {
        editor.setFontSize(`${prefs.fontSize}px`);
    }
    
    // Применение режима переноса
    if (prefs.wrapMode !== undefined) {
        editor.session.setUseWrapMode(prefs.wrapMode);
    }
    
    // Применение автодополнения
    if (prefs.enableAutocomplete !== undefined) {
        editor.setOptions({
            enableBasicAutocompletion: prefs.enableAutocomplete,
            enableLiveAutocompletion: prefs.enableAutocomplete
        });
    }
}

// Обновление настроек из UI
document.getElementById('theme-selector').addEventListener('change', (e) => {
    preferences.save('theme', e.target.value);
});

document.getElementById('font-size-input').addEventListener('change', (e) => {
    preferences.save('fontSize', parseInt(e.target.value));
});
```

### Расширенное использование
```javascript
// Сброс к дефолтным настройкам с подтверждением
function resetToDefaults() {
    if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
        preferences.clear();
        location.reload(); // или переприменение настроек
    }
}

// Экспорт настроек для поддержки
function exportForSupport() {
    const prefs = preferences.exportAsJson();
    const systemInfo = {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        consoleVersion: '1.0.0'
    };
    
    const supportData = {
        preferences: JSON.parse(prefs),
        system: systemInfo
    };
    
    return JSON.stringify(supportData, null, 2);
}

// Миграция настроек между версиями
function migratePreferences(oldKey, newKey, transformer) {
    const prefs = preferences.getAll();
    if (prefs[oldKey] !== undefined) {
        const newValue = transformer ? transformer(prefs[oldKey]) : prefs[oldKey];
        preferences.saveMultiple({
            [newKey]: newValue
        });
        // Можно удалить старый ключ, если нужно
    }
}
```

## Логирование

### Уровни логирования
```javascript
this.log.info('Инициализирован')
this.log.debug('Настройки валидированы', { total, valid })
this.log.debug('Настройка сохранена', { key, value })
this.log.debug('Несколько настроек сохранены', { updates })
this.log.warn('Неизвестная настройка', { key, value })
this.log.warn('Пропущена невалидная настройка', { key, value })
this.log.error('Ошибка загрузки настроек', { error })
this.log.error('Некорректное значение для сохранения', { key, value })
this.log.error('Ошибка сохранения настройки', { key, error })
this.log.error('Ошибка импорта настроек', { error })
this.log.error('Некорректный JSON для импорта')
```

### Контекст логирования
- `total`, `valid` - статистика валидации
- `key`, `value` - информация о настройках
- `updates` - количество обновленных настроек
- `error` - сообщения об ошибках

## Безопасность

### Меры защиты
1. **Безопасный парсинг JSON** - `safeJsonParse()` вместо `JSON.parse()`
2. **Валидация схемы** - проверка по `PREFERENCES_SCHEMA`
3. **Проверка типов** - строгая типизация значений
4. **Диапазон значений** - ограничение для числовых настроек
5. **Enum валидация** - только допустимые значения для enum настроек

### Защита от XSS/инъекций
- Все значения сохраняются как JSON (не как HTML)
- Парсинг через безопасный `safeJsonParse`
- Валидация перед сохранением
- Очистка невалидных значений

## Уничтожение

```javascript
/**
 * Уничтожает менеджер настроек
 * @returns {void}
 */
destroy() {
    this.log.info('PreferencesManager уничтожен');
}
```