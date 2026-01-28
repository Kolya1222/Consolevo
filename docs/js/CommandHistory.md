# CommandHistory.js

**CommandHistory** - это класс для управления историей выполненных команд в веб-консоли. Поддерживает два типа консоли (PHP и SQL), реализует навигацию по истории, поиск команд, автоматическое сохранение в localStorage и статистику использования.

## Особенности реализации

### 1. **Интеллектуальная обработка дубликатов**
- Не добавляет команду, если она идентична последней добавленной
- Проверяет `trimmedCommand` для игнорирования пробелов
- Логирует пропущенные дубликаты

### 2. **Умная навигация по истории**
- Сохраняет текущее содержимое редактора при первом переходе назад
- Возвращает сохраненную команду при переходе вперед после конца истории
- Предотвращает выход за границы массива

### 3. **Автосохранение с debounce**
- Сохраняет в localStorage с задержкой 500ms
- Предотвращает частые записи при быстром добавлении команд
- Обрабатывает ошибки записи в localStorage

### 4. **Разделение по типам консоли**
- Разные ключи localStorage: `consolevo_history_php` и `consolevo_history_sql`
- Раздельные массивы истории для PHP и SQL
- Корректная работа в мультиконсольном режиме

### 5. **Ограничение размера истории**
- FIFO (First In, First Out) - удаляет самые старые команды
- Сохраняет `maxSize` самых новых команд
- Логирует удаление старых записей

## Конструктор и инициализация

### Параметры конструктора
```javascript
/**
 * Создает экземпляр истории команд
 * @param {'php' | 'sql'} consoleType - Тип консоли
 * @param {number} maxSize - Максимальное количество команд (по умолчанию 50)
 */
constructor(consoleType, maxSize = 50)
```

### Свойства экземпляра
| Свойство | Тип | Значение по умолчанию | Описание |
|----------|-----|-------------------|----------|
| `consoleType` | `'php' \| 'sql'` | - | Тип консоли для разделения историй |
| `maxSize` | `number` | 50 | Максимальное количество команд в истории |
| `history` | `HistoryEntry[]` | `[]` | Массив записей истории команд |
| `position` | `number` | 0 | Текущая позиция при навигации по истории |
| `tempCommand` | `string` | `''` | Временное хранение текущей команды редактора |
| `log` | `Object` | `logger('CommandHistory')` | Логгер с методами debug/info/warn/error |
| `config` | `CommandHistoryConfig` | настроенный объект | Конфигурация истории |

### Конфигурация по умолчанию
```javascript
this.config = {
    maxHistorySize: maxSize,                    // 50 команд максимум
    storageKey: `consolevo_history_${consoleType}`, // Уникальный ключ для типа
    autoSaveDelay: 500,                         // 500ms дебаунс для автосохранения
    preserveCurrent: true                       // Сохранять текущую команду при навигации
};

this.autoSave = debounce(() => this._save(), this.config.autoSaveDelay);
```

## Основные методы

### 1. `add(command, metadata)`
**Добавляет команду в историю с метаданными**

```javascript
/**
 * @param {string} command - Команда для добавления
 * @param {Object} [metadata={}] - Дополнительные метаданные
 * @returns {boolean} true если добавлена, false если пропущена
 */
```

**Логика добавления:**
```javascript
1. Проверка: пустая команда? → false
2. Обрезка пробелов: trimmedCommand
3. Проверка дубликатов: последняя команда !== trimmedCommand? → false
4. Создание HistoryEntry:
   - command: trimmedCommand
   - timestamp: Date.now()
   - consoleType: this.consoleType
   - metadata: { length, lines, ...metadata }
5. Добавление в массив history
6. Проверка размера: если > maxSize → удалить самую старую (shift)
7. Сброс position = history.length
8. Автосохранение (debounced)
```

**Пример использования:**
```javascript
// Базовая добавка
history.add('SELECT * FROM users');

// С метаданными
history.add('<?php echo "Hello"; ?>', {
    executionTime: 0.123,
    success: true,
    custom: { userId: 123 }
});

// Дубликаты не добавляются
history.add('SELECT 1');  // добавится
history.add('SELECT 1');  // НЕ добавится (дубликат)
```

### 2. `getPrevious()`
**Получает предыдущую команду из истории**

```javascript
/**
 * @returns {string} Предыдущая команда или пустая строка
 */
```

**Алгоритм навигации назад:**
```javascript
if (history пуста) → return ''

if (position === history.length) → 
    сохранить tempCommand (текущее содержимое редактора)

if (position > 0) → position--
return history[position].command
```

**Пример использования:**
```javascript
// Предположим история: ['cmd1', 'cmd2', 'cmd3']
// Позиция изначально: 3 (после последней команды)

history.getPrevious(); // → 'cmd3', позиция → 2
history.getPrevious(); // → 'cmd2', позиция → 1
history.getPrevious(); // → 'cmd1', позиция → 0
history.getPrevious(); // → 'cmd1', позиция остается 0
```

### 3. `getNext()`
**Получает следующую команду из истории**

```javascript
/**
 * @returns {string} Следующая команда или пустая строка
 */
```

**Алгоритм навигации вперед:**
```javascript
if (history пуста) → return ''

if (position < history.length - 1) → 
    position++
    return history[position].command

if (position === history.length - 1) → 
    position = history.length
    return tempCommand || ''  // возвращаем сохраненную команду

return ''
```

**Пример использования:**
```javascript
// История: ['cmd1', 'cmd2', 'cmd3']
// Позиция: 0 (после getPrevious)

history.getNext(); // → 'cmd2', позиция → 1
history.getNext(); // → 'cmd3', позиция → 2
history.getNext(); // → '' (tempCommand), позиция → 3
```

### 4. `setCurrentCommand(command)`
**Сохраняет текущую команду редактора для временного хранения**

```javascript
/**
 * @param {string} command - Текущая команда для сохранения
 * @returns {void}
 */
```

**Использование:**
```javascript
// Сохранить текущее содержимое редактора перед навигацией
history.setCurrentCommand(editor.getValue());

// Затем при getNext() после достижения конца истории
// вернется сохраненная команда
```

### 5. `search(query, limit)`
**Поиск команд в истории по ключевому слову**

```javascript
/**
 * @param {string} query - Поисковый запрос
 * @param {number} limit - Максимальное количество результатов (по умолчанию 10)
 * @returns {HistoryEntry[]} Массив найденных команд (от новых к старым)
 */
```

**Алгоритм поиска:**
```javascript
if (query пустой) → return getRecent(limit)

результаты = filterByKeyword(history, query.toLowerCase(), ['command'])
    - filterByKeyword ищет в поле 'command'
    - Регистронезависимый поиск
    - Возвращает все совпадения

return результаты.slice(-limit).reverse()
    - Ограничиваем количеством limit
    - Реверсируем (новые → старые)
```

**Пример использования:**
```javascript
// Поиск SQL запросов с SELECT
const sqlResults = history.search('SELECT', 5);
// → [{command: 'SELECT * FROM users', ...}, ...]

// Поиск PHP команд с echo
const phpResults = history.search('echo', 10);
```

### 6. `getRecent(limit)`
**Получает последние команды из истории**

```javascript
/**
 * @param {number} limit - Количество команд (по умолчанию 10)
 * @returns {HistoryEntry[]} Массив последних команд (от новых к старым)
 */
```

**Пример:**
```javascript
// Получить 5 последних команд
const recent = history.getRecent(5);
// → [самая новая, ..., пятая с конца]
```

### 7. `getStats()`
**Получает статистику по истории команд**

```javascript
/**
 * @returns {HistoryStats} Статистика истории
 */
```

**Возвращаемые данные:**
```javascript
{
    total: number,          // Общее количество команд
    today: number,          // Команд добавлено сегодня (с 00:00)
    maxSize: number,        // Максимальный размер истории (maxSize)
    consoleType: string,    // 'php' или 'sql'
    currentPosition: number // Текущая позиция навигации
}
```

**Пример использования:**
```javascript
const stats = history.getStats();
console.log(`Всего команд: ${stats.total}`);
console.log(`Сегодня: ${stats.today}`);
console.log(`Лимит: ${stats.maxSize}`);
```

### 8. `clear()`
**Очищает историю команд**

```javascript
/**
 * Очищает всю историю команд
 * @returns {void}
 */
```

**Что происходит:**
1. Сохраняется количество команд перед очисткой
2. `history = []` - очистка массива
3. `position = 0` - сброс позиции
4. `tempCommand = ''` - очистка временной команды
5. `_save()` - сохранение пустой истории в localStorage

### 9. `_save()`
**Приватный метод сохранения истории в localStorage**

```javascript
/**
 * @private
 * @returns {void}
 */
```

**Структура сохраняемых данных:**
```javascript
{
    history: HistoryEntry[],  // Массив команд
    savedAt: number,         // Временная метка сохранения
    version: '1.0'           // Версия формата
}
```

**Особенности:**
- Используется `localStorage.setItem()`
- Обработка ошибок через try-catch
- Логирование успешного сохранения
- Вызывается через `autoSave` (debounced)

### 10. `load()`
**Загружает историю из localStorage**

```javascript
/**
 * @returns {void}
 */
```

**Алгоритм загрузки:**
```javascript
1. Получить данные: localStorage.getItem(storageKey)
2. Проверить isEmpty(saved) → если пусто, выйти
3. safeJsonParse(saved, {}) → безопасный парсинг JSON
4. Проверить Array.isArray(data.history) → если да:
   - this.history = data.history
   - this.position = history.length
5. Логирование результата
```

**Обработка ошибок:**
- Невалидный JSON → лог ошибки, история остается пустой
- Отсутствие данных → нормальное состояние

## Вспомогательные методы

### `truncateCommand(command, maxLength)`
**Обрезает длинную команду для логов**

```javascript
/**
 * @param {string} command - Команда для обрезки
 * @param {number} maxLength - Максимальная длина (по умолчанию 50)
 * @returns {string} Обрезанная команда
 * @private
 */
```

**Пример:**
```javascript
truncateCommand('SELECT * FROM users WHERE id = 1', 20)
// → 'SELECT * FROM users WH...'
```

## Примеры использования

### Базовое использование
```javascript
// Инициализация
const phpHistory = new CommandHistory('php', 100); // 100 команд максимум
const sqlHistory = new CommandHistory('sql', 50);  // 50 команд максимум

// Добавление команд после выполнения
phpHistory.add('<?php echo "Hello World"; ?>', {
    executionTime: 0.045,
    success: true
});

// Навигация (в редакторе)
// При нажатии ↑
const prevCommand = phpHistory.getPrevious();
editor.setValue(prevCommand);

// При нажатии ↓
const nextCommand = phpHistory.getNext();
editor.setValue(nextCommand);
```

### Расширенное использование
```javascript
// Поиск в истории
const searchResults = sqlHistory.search('UPDATE', 5);
searchResults.forEach((entry, index) => {
    console.log(`${index + 1}: ${entry.command.substring(0, 50)}...`);
});

// Статистика
const stats = phpHistory.getStats();
console.log(`Использовано ${stats.today}/${stats.total} команд`);

// Экспорт истории (предполагаемый метод)
function exportHistory() {
    const historyData = sqlHistory.history;
    const json = JSON.stringify(historyData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    // ... создание ссылки для скачивания
}

// Очистка старых записей (ручная очистка)
if (sqlHistory.getStats().total > 40) {
    console.log('История почти заполнена');
    // Можно предложить пользователю очистить
}
```

### Интеграция с редактором
```javascript
class IntegratedEditor {
    constructor(history) {
        this.history = history;
        this.editor = ace.edit('editor');
        this.setupNavigation();
    }

    setupNavigation() {
        // Навигация стрелками
        this.editor.commands.addCommand({
            name: 'historyPrev',
            bindKey: { win: 'Up', mac: 'Up' },
            exec: () => {
                // Сохраняем текущее содержимое
                this.history.setCurrentCommand(this.editor.getValue());
                
                // Получаем предыдущую команду
                const prev = this.history.getPrevious();
                if (prev !== '') {
                    this.editor.setValue(prev, -1);
                }
            }
        });

        this.editor.commands.addCommand({
            name: 'historyNext',
            bindKey: { win: 'Down', mac: 'Down' },
            exec: () => {
                const next = this.history.getNext();
                if (next !== '') {
                    this.editor.setValue(next, -1);
                }
            }
        });
    }

    executeCode() {
        const code = this.editor.getValue();
        // ... выполнение кода
        const result = await api.execute(code);
        
        // Добавляем в историю с метаданными
        this.history.add(code, {
            success: result.success,
            executionTime: result.execution_time,
            timestamp: Date.now()
        });
    }
}
```

## Логирование

### Уровни логирования
```javascript
this.log.info('Инициализация', { type, maxSize, loaded })
this.log.debug('Команда добавлена', { commandPreview, length, total })
this.log.debug('Навигация', { position, total, commandPreview })
this.log.debug('Поиск', { query, found, limit })
this.log.debug('История сохранена', { commands })
this.log.error('Ошибка', { error })
```

### Контекст логирования
- `commandPreview` - обрезанная версия команды (truncateCommand)
- `length` - длина команды в символах
- `total` - текущее количество команд в истории
- `position` - текущая позиция навигации
- `found` - количество найденных команд при поиске

## Производительность

### Оптимизации
1. **Debounce автосохранения** - 500ms задержка
2. **Ограничение размера** - FIFO очередь с фиксированным размером
3. **Ленивая загрузка** - загрузка только при инициализации
4. **Эффективный поиск** - filterByKeyword с ограничением результатов

### Память
- Каждая запись: ~100-500 байт в зависимости от длины команды
- Максимум: `maxSize * 500` байт (~25KB для 50 команд)
- localStorage ограничение: обычно 5-10MB

## Безопасность

### Меры защиты
1. **Безопасный парсинг JSON** - safeJsonParse вместо eval
2. **Валидация входных данных** - проверка перед добавлением
3. **Изоляция по типам** - раздельные хранилища для PHP/SQL
4. **Ограничение длины** - предотвращение DoS через длинные команды

### Для консоли выполнения
- История содержит только пользовательский код
- Нет сохранения результатов выполнения или чувствительных данных
- Возможна очистка через UI или програмно

## Уничтожение

```javascript
/**
 * Уничтожает экземпляр истории команд
 * @returns {void}
 */
destroy() {
    this.log.info('CommandHistory уничтожен', { 
        commands: this.history.length 
    });
    
    // СОХРАНЯЕМ ПЕРЕД УНИЧТОЖЕНИЕМ
    this._save();
    
    // Очистка ссылок (опционально)
    this.history = null;
    this.autoSave = null;
}
```