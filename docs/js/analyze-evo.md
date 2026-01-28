# analyze-evo.js

**analyze-evo.js** - это модуль для динамического анализа структуры Evolution CMS и генерации данных для автодополнения (completions) и сниппетов (snippets) на основе данных, загружаемых с сервера в реальном времени. Модуль не содержит статических данных и всегда загружает актуальную информацию с сервера.

## Основные функции

### 1. `analyzeEvolutionCMS()`
**Асинхронная загрузка данных структуры Evolution CMS с сервера**

```javascript
/**
 * @async
 * @returns {Promise<Object>} Объект с данными анализа
 */
```

**Структура запроса:**
```javascript
// Endpoint: GET /consolevo/analysis/unified-data
// Headers:
// - X-CSRF-TOKEN: getCsrfToken()
// - X-Requested-With: XMLHttpRequest
// - Accept: application/json
// Credentials: include (cookies)
```

**Ожидаемый ответ сервера:**
```javascript
{
    "success": true,
    "source": "php-reflection", // или другой источник
    "data": {
        "methods": Array<MethodInfo>,     // Методы Evolution CMS
        "properties": Array<string>,      // Свойства
        "constants": Array<string>,       // Константы
        "functions": Array<FunctionInfo>, // Функции
        "snippets": Array<SnippetInfo>    // Сниппеты
    }
}
```

**Обработка ошибок:**
- При ошибке сети или сервера возвращает fallback объект
- Fallback содержит пустые массивы и информацию об ошибке
- Логирует ошибку в консоль

**Пример использования:**
```javascript
// Загрузка данных при инициализации редактора
async function initEditor() {
    const analysis = await analyzeEvolutionCMS();
    console.log('Загружено методов:', analysis.methods.length);
    console.log('Источник данных:', analysis.source);
    
    if (analysis.error) {
        console.warn('Ошибка загрузки:', analysis.error);
    }
}
```

### 2. `generateEvoCompletionsFromAnalysis(analysis)`
**Генерация данных автодополнения из анализа**

```javascript
/**
 * @param {Object} analysis - Результат анализа Evolution CMS
 * @returns {Array<CompletionItem>} Массив элементов автодополнения
 */
```

**Типы генерируемых completions:**

#### 1. Методы Evolution CMS (`$modx`, `$evo`)
```javascript
// Для каждого метода в analysis.methods:
{
    name: '$evo->getDocumentObject',      // Отображаемое имя
    value: '$evo->getDocumentObject',     // Значение для вставки
    score: 1000,                         // Приоритет (высокий)
    meta: 'evo method',                  // Тип
    description: 'Метод getDocumentObject',
    params: [                            // Параметры (если есть)
        { name: 'id', default: 'null' },
        { name: 'fields', default: '*' }
    ],
    docHTML: '<div>Документация...</div>' // HTML документация
}
```

#### 2. Свойства Evolution CMS
```javascript
{
    name: '$evo->documentObject',
    value: '$evo->documentObject',
    score: 900,
    meta: 'evo property',
    description: 'Свойство Evolution CMS'
}
```

#### 3. Функции Evolution CMS
```javascript
{
    name: 'getResources',
    value: 'getResources',
    score: 800,
    meta: 'evo function',
    description: 'Функция getResources',
    params: [...]
}
```

#### 4. Константы Evolution CMS
```javascript
{
    name: 'MODX_BASE_PATH',
    value: 'MODX_BASE_PATH',
    score: 700,
    meta: 'evo constant',
    description: 'Константа Evolution CMS'
}
```

**Особенности генерации:**
- `score` определяет приоритет в списке автодополнения
- Для методов используется короткое имя (без неймспейса)
- Добавляется документация через `generateMethodDocHTML()`

### 3. `generateEvoSnippetsFromAnalysis(analysis)`
**Генерация сниппетов из анализа**

```javascript
/**
 * @param {Object} analysis - Результат анализа Evolution CMS
 * @returns {Array<SnippetItem>} Массив сниппетов
 */
```

**Структура сниппетов:**
```javascript
{
    name: 'getResources snippet',      // Имя сниппета
    content: `getResources([
    'parents' => 0,
    'tpl' => '@CODE:[[+pagetitle]]'
]);`,                                 // Содержимое сниппета
    tabTrigger: 'getresources',        // Триггер для активации
    description: 'Snippet for getResources',
    meta: 'evo'                        // Мета информация
}
```

**Источник данных:**
- Сниппеты загружаются напрямую с сервера
- Сервер может предоставлять предопределенные сниппеты
- Формат и содержимое контролируются сервером

## Вспомогательные функции

### `generateMethodDocHTML(methodName, params, fullSignature)`
**Генерация HTML документации для методов**

```javascript
/**
 * @param {string} methodName - Имя метода
 * @param {Array} params - Параметры метода
 * @param {string} fullSignature - Полная сигнатура
 * @returns {string} HTML строка с документацией
 * @private
 */
```

**Генерируемая HTML структура:**
```html
<div class="ace_doc-tooltip">
    <div class="ace_doc-title">getDocumentObject</div>
    <div class="ace_doc-signature">getDocumentObject(int $id, string $fields = '*')</div>
    <div class="ace_doc-section">
        <div class="ace_doc-section-title">Параметры:</div>
        <div class="ace_doc-param">
            <span class="ace_doc-param-name">id</span>
        </div>
        <div class="ace_doc-param">
            <span class="ace_doc-param-name">fields</span>
            <span class="ace_doc-param-default"> = '*'</span>
        </div>
    </div>
</div>
```

## Примеры использования

### Интеграция с AceEditor
```javascript
// В AceEditor.js при настройке автодополнения для PHP
async function setupPhpCompleter() {
    // Загрузка данных с сервера
    const analysis = await analyzeEvolutionCMS();
    
    // Генерация completions
    const evoCompletions = generateEvoCompletionsFromAnalysis(analysis);
    
    // Генерация snippets
    const evoSnippets = generateEvoSnippetsFromAnalysis(analysis);
    
    // Настройка completer для Ace Editor
    const phpCompleter = {
        getCompletions: (editor, session, pos, prefix, callback) => {
            // Фильтрация по префиксу
            const filtered = evoCompletions.filter(item => 
                item.name.toLowerCase().includes(prefix.toLowerCase())
            );
            callback(null, filtered);
        }
    };
    
    // Регистрация completer и snippets
    langTools.addCompleter(phpCompleter);
    registerSnippets(snippetManager, evoSnippets);
}
```

### Использование в ConsoleManager
```javascript
// При инициализации PHP консоли
async function initPhpConsole() {
    const editor = new AceEditor('php');
    await editor.init();
    
    // Загрузка и применение динамических данных
    const analysis = await analyzeEvolutionCMS();
    if (!analysis.error) {
        console.log('Динамические данные загружены:', {
            methods: analysis.methods.length,
            snippets: analysis.snippets.length
        });
    }
}
```

### Кастомизация данных
```javascript
// Дополнительная обработка данных перед использованием
async function getEnhancedCompletions() {
    const analysis = await analyzeEvolutionCMS();
    
    // Добавление кастомных completions
    const completions = generateEvoCompletionsFromAnalysis(analysis);
    
    // Дополнительные пользовательские completions
    completions.push({
        name: '$modx->myCustomMethod',
        value: '$modx->myCustomMethod',
        score: 950,
        meta: 'custom method',
        description: 'Пользовательский метод'
    });
    
    // Сортировка по score (приоритету)
    return completions.sort((a, b) => b.score - a.score);
}
```

## Обработка ошибок и fallback

### Ситуации fallback:
1. **Сервер недоступен** - возвращаются пустые массивы
2. **Невалидный JSON** - возвращаются пустые массивы
3. **Ошибка CSRF** - логируется, возвращаются пустые массивы
4. **Пустой ответ** - возвращается объект с source: 'error'

### Fallback объект:
```javascript
{
    methods: [],
    properties: [],
    constants: [],
    functions: [],
    snippets: [],
    source: 'error',
    error: 'Error message here'
}
```

## Производительность

### Оптимизации:
1. **Единый запрос** - все данные загружаются одним запросом
2. **Кэширование на сервере** - сервер кэширует анализ структуры
3. **Ленивая загрузка** - только при инициализации PHP консоли
4. **Минимальная обработка** - клиент только форматирует данные