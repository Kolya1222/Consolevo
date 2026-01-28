# OutputManager.js

**OutputManager** - это менеджер вывода консоли, отвечающий за отображение всех сообщений, результатов выполнения кода (PHP/SQL), ошибок и уведомлений. Он обеспечивает форматированный вывод с поддержкой различных типов контента (текст, HTML, таблицы, ошибки Evolution CMS) и управляет историей вывода с ограничением по количеству строк.

## Конструктор и инициализация

### Параметры конструктора
```javascript
/**
 * Создает экземпляр менеджера вывода
 * @param {'php' | 'sql'} consoleType - Тип консоли
 */
constructor(consoleType)
```

### Свойства экземпляра
| Свойство | Тип | Значение по умолчанию | Описание |
|----------|-----|-------------------|----------|
| `consoleType` | `'php' \| 'sql'` | - | Тип консоли для адаптивного вывода |
| `outputElement` | `HTMLElement \| null` | `document.getElementById('console-output')` | DOM элемент контейнера вывода |
| `maxOutputLines` | `number` | 1000 | Максимальное количество строк вывода |
| `currentLines` | `number` | 0 | Текущее количество строк |
| `log` | `Object` | `logger('OutputManager')` | Логгер с методами debug/info/warn/error |
| `scrollToBottom` | `Function` | `debounce(this._scrollToBottom.bind(this), 50)` | Дебаунс функция прокрутки |

## Основные методы

### 1. `add(message, type, isHtml)`
**Добавляет сообщение в вывод консоли**

```javascript
/**
 * @param {string} message - Текст сообщения
 * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] - Тип сообщения
 * @param {boolean} [isHtml=false] - Является ли сообщение HTML
 * @returns {void}
 */
```

**Алгоритм добавления:**
```javascript
1. Проверка outputElement → если нет, лог и выход
2. Проверка лимита строк (maxOutputLines) → если превышен, удалить 100 старых строк
3. Создание DOM элемента через createOutputLine()
4. Добавление в outputElement
5. Инкремент currentLines
6. Логирование для ошибок и предупреждений
7. Автоматическая прокрутка к низу (через debounce)
```

**Примеры использования:**
```javascript
// Текстовое сообщение
output.add('Команда выполнена', 'success');

// HTML сообщение (с экранированием)
output.add('<b>Внимание:</b> проверьте синтаксис', 'warning', true);

// Сообщение об ошибке
output.add('Синтаксическая ошибка', 'error');
```

### 2. `addSmart(content, type)`
**Автоматически определяет тип контента и обрабатывает соответствующим образом**

```javascript
/**
 * @param {string} content - Контент для вывода
 * @param {string} [type='info'] - Базовый тип сообщения
 * @returns {void}
 */
```

**Типы контента и обработка:**
```javascript
1. Evolution CMS ошибки → handleEvolutionError() (парсинг, структурированный вывод)
2. HTML контент → addHtmlContent() (санитизация HTML)
3. Текстовый контент → add() (стандартный вывод)
```

**Использование:**
```javascript
// Автоопределение
output.addSmart('<div>Evolution CMS Parse Error...</div>'); // → обработается как ошибка
output.addSmart('<table><tr><td>data</td></tr></table>'); // → обработается как HTML
output.addSmart('Hello World'); // → обычный текст
```

### 3. `handleSuccess(data, consoleType)`
**Обрабатывает успешный результат выполнения кода**

```javascript
/**
 * @param {PhpResultData|SqlResultData} data - Данные результата
 * @param {'php' | 'sql'} consoleType - Тип консоли
 * @returns {void}
 */
```

**Для PHP:**
```javascript
1. Если есть output → addSmart(output, 'success')
2. Если есть result → вывод "Возвращаемое значение: ..."
3. Если пустой вывод → сообщение "Код выполнен успешно"
4. Форматирование времени выполнения (formatExecutionTime)
5. Форматирование использования памяти (formatMemoryUsage)
```

**Для SQL:**
```javascript
1. Статистика затронутых строк
2. Форматирование времени выполнения
3. Если есть данные → displayTable(data)
4. Если affected_rows → вывод операции
```

### 4. `displayTable(data)`
**Отображает таблицу с данными SQL запроса**

```javascript
/**
 * @param {Array<Object>} data - Массив объектов с данными
 * @returns {void}
 * @private
 */
```

**Особенности:**
- Ограничение 100 строк для производительности
- Определение заголовков из ключей первого объекта
- Специальная обработка NULL значений
- Обработка объектов (JSON.stringify)
- Информация о количестве показанных записей

**Пример вывода:**
```html
<div class="table-container fade-in">
    <table class="result-table" role="grid">
        <tr><th>id</th><th>name</th><th>email</th></tr>
        <tr><td>1</td><td>John</td><td>john@example.com</td></tr>
    </table>
    <div class="result-info">Показано записей: 1</div>
</div>
```

### 5. `handleEvolutionError(html)`
**Обрабатывает HTML ошибки Evolution CMS**

```javascript
/**
 * @param {string} html - HTML ошибка
 * @returns {void}
 * @private
 */
```

**Структурированный вывод ошибки:**
```javascript
1. Парсинг через parseEvolutionError() из helpers
2. Создание контейнера с заголовком
3. Отображение основного сообщения
4. Отображение SQL ошибки (если есть)
5. Отображение бенчмарков (benchmarks)
6. Отображение backtrace (ограничено 8 элементами)
```

**Определение ошибок Evolution CMS:**
```javascript
// Сигнатуры:
- 'Evolution CMS Parse Error'
- 'Evolution CMS Content Manager'
- 'SQLSTATE[' (SQL ошибки в контексте Evolution)
```

### 6. `clear()`
**Очищает весь вывод консоли**

```javascript
/**
 * Очищает всю историю вывода
 * @returns {void}
 */
```

**Действия:**
1. Очистка innerHTML outputElement
2. Сброс currentLines = 0
3. Логирование действия

### 7. `addError(error, context)`
**Добавляет сообщение об ошибке**

```javascript
/**
 * @param {string} error - Текст ошибки
 * @param {string} [context=''] - Контекст ошибки
 * @returns {void}
 */
```

**Пример:**
```javascript
output.addError('Undefined variable $user', 'PHP Error');
// Вывод: "PHP Error: Undefined variable $user"
```

### 8. `addWarning(warning, context)`
**Добавляет предупреждение**

```javascript
/**
 * @param {string} warning - Текст предупреждения
 * @param {string} [context=''] - Контекст предупреждения
 * @returns {void}
 */
```

## Вспомогательные методы

### `createOutputLine(message, type, isHtml)`
**Создает DOM элемент строки вывода**

```javascript
/**
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип сообщения
 * @param {boolean} isHtml - Является ли сообщение HTML
 * @returns {HTMLElement} DOM элемент строки
 * @private
 */
```

**Структура строки:**
```html
<div class="console-line fade-in" data-output-type="info|success|warning|error">
    <div class="line-wrapper">
        <span class="line-icon">{{icon}}</span>
        <span class="output-content">{{message}}</span>
    </div>
</div>
```

### `analyzeContentType(content)`
**Анализирует тип контента**

```javascript
/**
 * @param {string} content - Контент для анализа
 * @returns {ContentAnalysis} Информация о типе контента
 * @private
 */
```

**Определяет:**
1. `isHtml` - содержит ли HTML теги
2. `isEvolutionError` - является ли ошибкой Evolution CMS
3. `isSqlError` - является ли SQL ошибкой
4. `contentType` - текстовый, HTML или evolution-error

### `removeOldestLines(count)`
**Удаляет самые старые строки при превышении лимита**

```javascript
/**
 * @param {number} [count=50] - Количество строк для удаления
 * @returns {void}
 * @private
 */
```

**Особенности:**
- Удаляет `.console-line` и `.table-container` элементы
- Сохраняет текущее количество строк в currentLines
- Логирует удаление для отладки

## Примеры использования

### Базовое использование
```javascript
// Инициализация
const output = new OutputManager('php');

// Добавление сообщений
output.add('Консоль инициализирована', 'info');
output.add('Код выполнен успешно', 'success');
output.addWarning('Используется устаревшая функция', 'Deprecation');

// Очистка вывода
output.clear();

// Добавление ошибки
output.addError('Undefined function some_function()', 'Runtime Error');
```

### Работа с результатами выполнения
```javascript
// PHP результат
output.handleSuccess({
    success: true,
    output: 'Hello World',
    result: 42,
    execution_time: 0.123,
    memory_usage: 2048000
}, 'php');

// SQL результат
output.handleSuccess({
    success: true,
    data: [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' }
    ],
    count: 2,
    affected_rows: 0,
    execution_time: 0.045
}, 'sql');
```

### Обработка Evolution CMS ошибок
```javascript
// HTML ошибка будет автоматически распознана и обработана
const htmlError = `
    <div id="evo-error">
        <h2>Evolution CMS Parse Error</h2>
        <p>Undefined variable: $config</p>
        <div class="backtrace">...</div>
    </div>
`;

output.addSmart(htmlError, 'error');
// → Будет показана структурированная ошибка с backtrace
```

### Автоматическое управление выводом
```javascript
// При добавлении 1000 строк - автоматическое удаление старых
for (let i = 0; i < 1200; i++) {
    output.add(`Message ${i}`, 'info');
}
// → Будет удалено 100 старых строк после достижения лимита
```

## Логирование

### Уровни логирования
```javascript
this.log.info('Консоль очищена')
this.log.debug('Отображение таблицы', { rows, columns })
this.log.debug('Удаление старых строк', { current, removing })
this.log.warn('outputElement не доступен')
this.log.error('Ошибка добавления строки', { error })
this.log.error('Ошибка создания таблицы', { error })
this.log.error('Error processing Evolution error', { error })
this.log.error('Evolution CMS Error processed', { title, hasSqlError, backtraceLength })
```

### Контекст логирования
- `rows`, `columns` - размер таблицы данных
- `current`, `removing` - статистика удаления строк
- `type`, `message` - информация о сообщении
- `timestamp` - время для ошибок/предупреждений
- `title`, `hasSqlError`, `backtraceLength` - информация об ошибках Evolution

## Производительность

### Оптимизации
1. **Ограничение строк** - максимум 1000 строк вывода
2. **Пакетное удаление** - удаление 100 строк за раз при переполнении
3. **Debounce прокрутки** - 50ms задержка для предотвращения частых обновлений
4. **Ограничение таблиц** - максимум 100 строк в SQL результатах
5. **Кэширование DOM элементов** - создание через createElement

### Мониторинг
- Счетчик currentLines для контроля объема вывода
- Логирование операций удаления старых строк
- Отслеживание ошибок рендеринга

## Безопасность

### Меры защиты
1. **HTML санитизация** - `sanitizeHtml()` для пользовательского HTML
2. **Экранирование вывода** - `textContent` вместо `innerHTML` для текста
3. **Безопасный парсинг ошибок** - использование `parseEvolutionError()`
4. **Обработка JSON** - безопасный `JSON.stringify` с обработкой ошибок
5. **Проверка типов данных** - валидация входных параметров

### Особенности для Evolution CMS
- Структурированный парсинг HTML ошибок
- Извлечение полезной информации (backtrace, benchmarks)
- Безопасное отображение SQL ошибок в контексте CMS

## Уничтожение

```javascript
/**
 * Уничтожает менеджер вывода и освобождает ресурсы
 * @returns {void}
 */
destroy() {
    this.log.info('OutputManager уничтожен');
    this.outputElement = null;
    this.currentLines = 0;
}
```