# console.js

**console.js** - это точка входа и главный инициализатор веб-консоли Evolution CMS. Модуль отвечает за запуск и управление жизненным циклом всей системы, обеспечивая безопасную инициализацию, обработку ошибок и корректное уничтожение при необходимости.

## Детальный анализ

### 1. **Инициализация при загрузке DOM**

```javascript
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Получение конфигурации из DOM
    const consoleElement = document.getElementById('code-editor');
    const config = {
        executeRoute: consoleElement.dataset.executeRoute,
        consoleType: consoleElement.dataset.consoleType
    };
    
    try {
        // 2. Создание и инициализация ConsoleManager
        window.consoleManager = new ConsoleManager(config);
        await window.consoleManager.init();
        
        // 3. Настройка обработчиков событий
        setupEventListeners();
        
    } catch (error) {
        // 4. Обработка ошибок инициализации
        handleInitError(error);
    }
});
```

**Поток инициализации:**

#### Шаг 1: Получение конфигурации
```javascript
const consoleElement = document.getElementById('code-editor');
const config = {
    executeRoute: consoleElement.dataset.executeRoute,  // URL для выполнения кода
    consoleType: consoleElement.dataset.consoleType     // 'php' или 'sql'
};
```

**Источник данных:**
```html
<!-- Пример HTML структуры -->
<div id="code-editor" 
     data-execute-route="/api/execute-php"
     data-console-type="php"
     data-initial-messages='[{"message":"Консоль загружается...","type":"info"}]'>
</div>
```

#### Шаг 2: Создание ConsoleManager
```javascript
window.consoleManager = new ConsoleManager(config);
await window.consoleManager.init();
```

**Важные аспекты:**
- `window.consoleManager` - глобальная ссылка для отладки и управления
- `async/await` - асинхронная инициализация модулей
- Последовательная загрузка всех зависимостей

#### Шаг 3: Настройка обработчиков событий
```javascript
// Обработчик сообщений между окнами
window.addEventListener('message', function(event) {
    if (event.data.type === 'DESTROY_CONSOLE') {
        destroyConsole(event.source);
    }
});

// Очистка при выгрузке страницы
window.addEventListener('unload', function() {
    cleanupConsole();
});
```

### 2. **Обработка сообщений между окнами (PostMessage API)**

```javascript
window.addEventListener('message', function(event) {
    if (event.data.type === 'DESTROY_CONSOLE') {
        console.log('Получена команда уничтожения консоли');
        
        // 1. Уничтожение ConsoleManager
        if (window.consoleManager) {
            window.consoleManager.destroy();
            window.consoleManager = null;
        }

        // 2. Отправка подтверждения
        if (event.source) {
            event.source.postMessage({
                type: 'CONSOLE_DESTROYED',
                status: 'success'
            }, '*');
        }
    }
});
```

**Сценарии использования:**
1. **Родительское окно закрывает iframe с консолью**
2. **Админ-панель перезагружает консоль**
3. **Межоконная коммуникация в Evolution CMS**

**Типы сообщений:**
```javascript
// Команды, которые может получать консоль
{
    type: 'DESTROY_CONSOLE'    // Запрос на уничтожение
}

// Ответы, которые может отправлять консоль
{
    type: 'CONSOLE_DESTROYED', // Подтверждение уничтожения
    status: 'success' | 'error'
}
```

### 3. **Очистка при выгрузке страницы**

```javascript
window.addEventListener('unload', function() {
    if (window.consoleManager) {
        window.consoleManager.destroy();
        window.consoleManager = null;
    }
});
```

**Важность очистки:**
1. **Освобождение памяти** - удаление ссылок на DOM элементы
2. **Отписка от событий** - предотвращение утечек памяти
3. **Сохранение состояния** - финальное автосохранение
4. **Остановка таймеров** - debounce/throttle функции

### 4. **Обработка ошибок инициализации**

```javascript
try {
    // Инициализация ConsoleManager
    await window.consoleManager.init();
} catch (error) {
    console.error('Ошибка инициализации ConsoleManager:', error);
    
    // 1. Попытка безопасного уничтожения
    if (window.consoleManager) {
        try {
            window.consoleManager.destroy();
        } catch (e) {
            console.error('Ошибка при уничтожении после сбоя:', e);
        }
        window.consoleManager = null;
    }

    // 2. Отображение ошибки пользователю
    const outputElement = document.getElementById('console-output');
    if (outputElement) {
        outputElement.innerHTML += `
            <div class="console-line fade-in">
                <span class="prompt error">!!</span>
                <span>Ошибка инициализации: ${error.message}</span>
            </div>
            <div class="console-line fade-in">
                <span class="prompt info">>></span>
                <span>Проверьте консоль браузера для подробностей</span>
            </div>
        `;
    }
}
```

**Типы обрабатываемых ошибок:**
1. **Сеть** - недоступность API эндпоинтов
2. **Зависимости** - отсутствие Ace Editor или других библиотек
3. **DOM** - отсутствие необходимых элементов
4. **Конфигурация** - неверные параметры инициализации

**Fallback-отображение:**
- Используется прямой innerHTML (так как OutputManager может быть недоступен)
- Сохраняется стилистика консоли (классы .console-line, .prompt)
- Предоставляется полезная информация пользователю