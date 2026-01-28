# ApiClient.js

**ApiClient** - это клиент для выполнения кода на сервере. Класс обрабатывает два типа консоли (PHP и SQL), реализует механизм повторных попыток с задержкой, обрабатывает различные типы ошибок (включая HTML ошибки Evolution CMS) и предоставляет валидацию ответов.

## Конструктор и инициализация

### Параметры конструктора
```javascript
/**
 * Создает экземпляр API клиента
 * @param {string} executeRoute - URL для выполнения кода
 * @param {'php' | 'sql'} consoleType - Тип консоли
 */
constructor(executeRoute, consoleType)
```

### Свойства экземпляра
| Свойство | Тип | Значение по умолчанию | Описание |
|----------|-----|-------------------|----------|
| `executeRoute` | `string` | - | Endpoint для выполнения кода |
| `consoleType` | `'php' \| 'sql'` | - | Тип консоли (определяет логику) |
| `requestTimeout` | `number` | `API_CONFIG.timeout` (30000) | Таймаут запроса в мс |
| `maxRetries` | `number` | `API_CONFIG.maxRetries` (3) | Макс. количество повторений |
| `retryDelay` | `number` | `API_CONFIG.retryDelay` (1000) | Базовая задержка между попытками |
| `log` | `Object` | `logger('ApiClient')` | Логгер с методами debug/info/warn/error |

## Основные методы

### 1. `execute(code, options)`
**Основной метод выполнения кода на сервере**

```javascript
/**
 * @async
 * @param {string} code - Код для выполнения
 * @param {ExecuteOptions} [options] - Дополнительные опции
 * @returns {Promise<PhpExecutionResult|SqlExecutionResult>} Результат выполнения
 * @throws {Error} Если произошла ошибка выполнения запроса
 */
```

**Поток выполнения:**
```javascript
1. buildPayload(code) → создание объекта запроса
2. makeRequest(payload, timeout, retries, onProgress) → отправка с повторными попытками
3. validateResponse(response) → валидация и форматирование ответа
4. Обработка ошибок:
   - HTML ошибки Evolution CMS → возвращаются как результат
   - Другие ошибки → логирование и возврат ошибки
```

**Пример использования:**
```javascript
// PHP консоль
const phpResult = await apiClient.execute('<?php echo "Hello"; ?>', {
    timeout: 10000,
    retries: 2,
    onProgress: (msg) => console.log(msg)
});

// SQL консоль
const sqlResult = await apiClient.execute('SELECT * FROM users', {
    timeout: 15000
});
```

### 2. `buildPayload(code)`
**Создание payload для запроса**

```javascript
/**
 * @param {string} code - Код для выполнения
 * @returns {Object} Объект payload
 */
```

**Структура payload:**
```javascript
// Общие поля:
{
    _token: getCsrfToken(),  // CSRF токен
    timestamp: Date.now()    // Метка времени
}

// Для PHP:
{
    code: string,    // PHP код
    type: 'php'      // Тип запроса
}

// Для SQL:
{
    query: string,   // SQL запрос
    type: 'sql'      // Тип запроса
}
```

### 3. `makeRequest(payload, timeout, maxRetries, onProgress)`
**Выполнение HTTP запроса с механизмом повторных попыток**

```javascript
/**
 * @async
 * @param {Object} payload - Данные запроса
 * @param {number} timeout - Таймаут в мс
 * @param {number} maxRetries - Максимальное количество повторов
 * @param {Function} [onProgress] - Колбэк прогресса
 * @returns {Promise<Object>} Ответ сервера
 */
```

**Алгоритм повторных попыток:**
```javascript
for (attempt = 1; attempt <= maxRetries; attempt++):
    try:
        1. onProgress(`Выполнение... ${attempt}/${maxRetries}`)
        2. fetch() с AbortController для таймаута
        3. Проверка response.ok
        4. Парсинг ответа как JSON
        5. Если успех → return responseData
        6. Если ошибка → parseErrorResponse()
           - Проверка shouldRetry()
           - Если не retry → throw error
    catch (error):
        1. HTML ошибки → throw immediately (не повторяем)
        2. AbortError (таймаут) → wait & retry
        3. Другие ошибки → wait & retry с экспоненциальной задержкой

Если все попытки неудачны → throw lastError
```

### 4. `shouldRetry(error, statusCode)`
**Определяет, нужно ли повторять запрос**

```javascript
/**
 * @param {Error} error - Объект ошибки
 * @param {number} statusCode - HTTP статус код
 * @returns {boolean} true - если запрос стоит повторить
 */
```

**Логика принятия решения:**
```javascript
// НЕ ПОВТОРЯЕМ для:
1. HTTP статусы 400, 422 (ошибки клиента)
2. HTTP 500 с признаками ошибки КОДА:
   - 'syntax error', 'parse error'
   - 'undefined function', 'class not found'
   - 'expects parameter', 'too few/many arguments'
   - 'unexpected', 'invalid', 'call to undefined'

// ПОВТОРЯЕМ для:
1. Сетевые ошибки
2. Таймауты (AbortError)
3. HTTP 5xx без признаков ошибки кода
4. HTTP 429 (Too Many Requests) - с backoff

// Особый случай: error.noRetry = true
Метод помечает ошибки, которые не нужно повторять
```

### 5. `parseErrorResponse(response)`
**Парсит ошибки из ответа сервера**

```javascript
/**
 * @async
 * @param {Response} response - Объект Response
 * @returns {Promise<Error|HtmlError>} Объект ошибки
 */
```

**Обработка типов ошибок:**
```javascript
1. HTML ошибки Evolution CMS:
   - Содержит 'Evolution CMS' или '<!DOCTYPE html>'
   - Создает HtmlError с полями:
     * htmlContent: полный HTML
     * isHtmlError: true
     * status: HTTP статус
   - НЕ ПОВТОРЯЕТСЯ

2. JSON ошибки:
   - Парсит JSON ответ
   - Извлекает error из parsedError.error
   - Или первые 200 символов текста

3. Текстовые ошибки:
   - Первые 200 символов ответа
```

### 6. `validateResponse(response)`
**Валидация и форматирование ответа сервера**

```javascript
/**
 * @param {Object} response - Ответ сервера
 * @returns {PhpExecutionResult|SqlExecutionResult} Валидированный ответ
 * @throws {Error} Если ответ некорректен
 */
```

**Для PHP консоли:**
```javascript
{
    success: boolean,          // true/false
    output: string,            // Вывод кода (stdout)
    result: any,               // Результат (если есть)
    error: string|null,        // Сообщение об ошибке
    line: number|null,         // Номер строки с ошибкой
    execution_time: number,    // Время выполнения в секундах
    memory_usage: number       // Использование памяти в байтах
}
```

**Для SQL консоли (успех):**
```javascript
{
    success: true,
    data: Array<Object>,       // Результирующие строки
    count: number,             // Количество строк
    affected_rows: number,     // Затронутые строки (UPDATE/DELETE)
    execution_time: number     // Время выполнения
}
```

**Для SQL консоли (ошибка):**
```javascript
{
    success: false,
    error: string,            // Сообщение об ошибке SQL
    line: number|null         // Номер строки с ошибкой
}
```

## Обработка ошибок

### Типы обрабатываемых ошибок

#### 1. **HTML ошибки Evolution CMS**
```javascript
// Признаки:
- Содержит 'Evolution CMS' в тексте
- Содержит '<!DOCTYPE html>' или HTML структуру
- Content-Type: text/html вместо application/json

// Обработка:
- Преобразуется в HtmlError объект
- Возвращается как результат (не как исключение)
- Не повторяется (isHtmlError = true)

// Пример результата:
{
    success: false,
    output: "<html>...Evolution CMS Error...</html>",
    error: 'Evolution CMS Error',
    isHtmlError: true,
    execution_time: duration / 1000
}
```

#### 2. **Ошибки таймаута (AbortError)**
```javascript
// Причины:
- Сервер не ответил за timeout
- Сетевая проблема

// Обработка:
- Экспоненциальная задержка между попытками
- Формирование понятного сообщения

// Задержка: retryDelay * attempt (экспоненциальный backoff)
```

#### 3. **Ошибки кода (не повторяемые)**
```javascript
// Признаки:
- HTTP 400/422
- HTTP 500 с сообщениями об ошибках PHP/SQL
- Конкретные тексты ошибок (syntax error, parse error и т.д.)

// Обработка:
- Помечаются error.noRetry = true
- Не повторяются
- Возвращаются как ошибка выполнения
```

#### 4. **Сетевые ошибки**
```javascript
// Причины:
- NetworkError, TypeError
- CORS проблемы

// Обработка:
- Повторяются с backoff
- После maxRetries → окончательная ошибка
```

### Механизм повторных попыток

```javascript
// Алгоритм:
Попытка 1: immediate
Попытка 2: через retryDelay * 1 (1000ms)
Попытка 3: через retryDelay * 2 (2000ms)
...

// Экспоненциальный backoff с джиттером:
const delay = this.retryDelay * attempt * (0.5 + Math.random() * 0.5);

// Максимальное время ожидания: timeout * maxRetries
```

## Конфигурация и константы

### Из API_CONFIG
```javascript
// Пример конфигурации:
{
    timeout: 30000,      // 30 секунд таймаут
    maxRetries: 3,       // 3 попытки
    retryDelay: 1000     // 1 секунда базовая задержка
}
```

### Headers запросов
```javascript
{
    'Content-Type': 'application/json',
    'X-CSRF-TOKEN': payload._token,        // CSRF защита
    'X-Requested-With': 'XMLHttpRequest',  // AJAX флаг
    'Accept': 'application/json'           // Ожидаемый формат
}
```

## Примеры использования

### Базовое использование
```javascript
// Инициализация
const apiClient = new ApiClient('/api/execute-code', 'php');

// Простое выполнение
const result = await apiClient.execute('<?php echo "Hello"; ?>');

if (result.success) {
    console.log('Вывод:', result.output);
    console.log('Время:', result.execution_time, 'сек');
} else {
    if (result.isHtmlError) {
        // Обработка HTML ошибки Evolution CMS
        document.getElementById('error-container').innerHTML = result.output;
    } else {
        console.error('Ошибка:', result.error);
    }
}
```

### Расширенное использование с опциями
```javascript
const result = await apiClient.execute(
    `<?php
    // Сложный PHP код
    for($i = 0; $i < 1000000; $i++) {
        // долгая операция
    }
    ?>`,
    {
        timeout: 60000,      // 60 секунд таймаут
        retries: 5,          // 5 попыток
        onProgress: (progress) => {
            // Обновление UI прогресса
            document.getElementById('progress').textContent = progress;
        }
    }
);
```

### Обработка специфических ошибок
```javascript
try {
    const result = await apiClient.execute(code);
    
    if (result.isHtmlError) {
        // Evolution CMS упал с HTML страницей
        this.showHtmlError(result.output);
        return;
    }
    
    if (!result.success) {
        if (result.line) {
            this.editor.highlightErrorLine(result.line);
        }
        this.showError(result.error);
    } else {
        this.showSuccess(result.output, result.execution_time);
    }
    
} catch (error) {
    // Критические ошибки (сеть, таймауты после всех попыток)
    this.showCriticalError('Не удалось соединиться с сервером');
}
```

## Логирование

### Уровни логирования
```javascript
this.log.info('Инициализация', { route, type, timeout })
this.log.debug('Попытка запроса', { attempt, maxRetries })
this.log.warn('HTML ошибка', { status, htmlLength })
this.log.error('Ошибка API', { error, duration })
```

### Контекст логирования
- `codeLength` - длина отправляемого кода
- `attempt/maxRetries` - прогресс попыток
- `duration` - время выполнения запроса
- `status` - HTTP статус код
- `htmlLength` - размер HTML ошибки

## Производительность и оптимизация

### Оптимизации
1. **AbortController** для таймаутов
2. **Exponential backoff** для повторных попыток
3. **Ранний выход** при ошибках кода (не повторяем)
4. **Минимальный парсинг** HTML ошибок
5. **Кэширование CSRF токена**

### Метрики
```javascript
// Измеряемые показатели:
const startTime = performance.now();
// ... выполнение запроса ...
const duration = performance.now() - startTime;

// Логирование метрик:
- Общее время выполнения
- Количество попыток
- HTTP статусы
- Размеры ответов
```

## Безопасность

### Меры защиты
1. **CSRF токены** - обязательный заголовок X-CSRF-TOKEN
2. **Валидация входных данных** - проверка payload
3. **Таймауты** - защита от зависаний
4. **Лимит попыток** - защита от DoS
5. **Экранирование** - безопасный парсинг JSON

### Для Evolution CMS
- Специальная обработка HTML ошибок
- Сохранение контекста ошибок CMS
- Безопасное отображение HTML ошибок

## Уничтожение и очистка

```javascript
/**
 * Уничтожает клиент и освобождает ресурсы
 */
destroy() {
    this.log.info('API клиент уничтожен');
    // В будущем: очистка pending запросов
}
```