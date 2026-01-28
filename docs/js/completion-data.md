# completion-data.js

**completion-data.js** - это модуль для генерации данных автодополнения (completions) и сниппетов (snippets) для SQL редактора. Модуль динамически создает данные на основе структуры базы данных, загруженной с сервера, обеспечивая контекстно-зависимые подсказки для таблиц, колонок, ключевых слов и функций SQL.

## Константы

### SQL_KEYWORDS
**Массив ключевых слов SQL для автодополнения**

```javascript
export const SQL_KEYWORDS = [
    // Основные операторы
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN',
    // Типы JOIN
    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
    // Логические операторы
    'AND', 'OR', 'NOT',
    // Операторы фильтрации и сортировки
    'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT',
    // Псевдонимы и операторы
    'AS', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE',
    // DDL операторы
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE',
    // Дополнительные операторы
    'UNION', 'ALL', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
];
```

**Особенности:**
- Все ключевые слова в верхнем регистре
- Сгруппированы по функциональности
- Используются для генерации `keywordCompletions`

### SQL_FUNCTIONS
**Массив SQL функций для автодополнения**

```javascript
export const SQL_FUNCTIONS = [
    // Агрегатные функции
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    // Функции даты и времени
    'NOW', 'CURDATE', 'CURTIME', 'DATE_FORMAT',
    // Строковые функции
    'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER', 'LOWER',
    // Математические функции
    'ROUND', 'CEIL', 'FLOOR',
    // Функции работы с NULL
    'COALESCE', 'IF', 'IFNULL', 'NULLIF'
];
```

**Особенности:**
- Общие SQL функции, поддерживаемые большинством СУБД
- Сгруппированы по категориям
- Используются для генерации `functionCompletions`

### SQL_BASE_SNIPPETS
**Базовые SQL сниппеты**

```javascript
export const SQL_BASE_SNIPPETS = [
    { 
        name: 'select', 
        content: `SELECT \${1:*} FROM \${2:table_name}`,
        tabTrigger: 'select',
        scope: 'sql'
    },
    { 
        name: 'select_where', 
        content: `SELECT \${1:*}\nFROM \${2:table_name}\nWHERE \${3:condition}`,
        tabTrigger: 'selectw',
        scope: 'sql'
    },
    { 
        name: 'insert', 
        content: 'INSERT INTO ${1:table_name} (${2:columns}) VALUES (${3:values})',
        tabTrigger: 'insert',
        scope: 'sql'
    },
    { 
        name: 'update', 
        content: 'UPDATE ${1:table_name} SET ${2:column} = ${3:value} WHERE ${4:condition}',
        tabTrigger: 'update',
        scope: 'sql'
    },
    { 
        name: 'delete', 
        content: 'DELETE FROM ${1:table_name} WHERE ${2:condition}',
        tabTrigger: 'delete',
        scope: 'sql'
    }
];
```

**Синтаксис сниппетов Ace Editor:**
- `${n:default}` - позиция курсора с индексом n и значением по умолчанию
- `tabTrigger` - последовательность символов для активации сниппета
- `scope` - область применения (всегда 'sql')
- `name` - уникальное имя сниппета

## Основные функции

### 1. `generateSqlSnippets(databaseTables, tableColumns)`
**Генерация SQL сниппетов на основе структуры базы данных**

```javascript
/**
 * @param {Array<TableInfo>} databaseTables - Массив таблиц
 * @param {Object<string, Array<ColumnInfo>>} tableColumns - Структуры таблиц
 * @returns {Array<Object>} Массив SQL сниппетов
 */
```

**Генерируемые типы сниппетов:**

#### 1. Базовые SQL сниппеты
```javascript
// Из SQL_BASE_SNIPPETS
{
    name: 'select',
    content: 'SELECT ${1:*} FROM ${2:table_name}',
    tabTrigger: 'select',
    scope: 'sql',
    description: 'Базовый SELECT запрос'
}
```

#### 2. Сниппеты имен таблиц (без префикса)
```javascript
// Для каждой таблицы (без префикса)
{
    name: 'modx_site_content → site_content',
    content: 'site_content', // clean_name без префикса
    tabTrigger: 'site_content',
    scope: 'sql',
    description: 'Таблица: modx_site_content',
    meta: 'table'
}
```

#### 3. Сниппеты имен таблиц (с префиксом)
```javascript
// Для каждой таблицы (полное имя)
{
    name: 'modx_site_content',
    content: 'modx_site_content', // полное имя с префиксом
    tabTrigger: 'modx_site_content',
    scope: 'sql',
    description: 'Таблица: modx_site_content (полное имя)',
    meta: 'table'
}
```

#### 4. Быстрые запросы SELECT (без префикса)
```javascript
// Для первых 8 таблиц (без префикса)
{
    name: 'select_from_site_content',
    content: 'SELECT * FROM site_content WHERE ${1:condition}',
    tabTrigger: 'sel_site_content',
    scope: 'sql',
    description: 'SELECT запрос для modx_site_content',
    meta: 'query'
}
```

#### 5. Быстрые запросы SELECT (с префиксом)
```javascript
// Для первых 8 таблиц (с префиксом)
{
    name: 'select_from_full_modx_site_content',
    content: 'SELECT * FROM modx_site_content WHERE ${1:condition}',
    tabTrigger: 'sel_modx_site_content',
    scope: 'sql',
    description: 'SELECT запрос для modx_site_content (полное имя)',
    meta: 'query'
}
```

**Особенности генерации:**
- Использует первые 8 таблиц для быстрых запросов (производительность)
- Создает два варианта для каждой таблицы (с префиксом и без)
- `tabTrigger` генерируется из имени таблицы в нижнем регистре

### 2. `generateSqlCompletions(databaseTables, tableColumns)`
**Генерация данных для автодополнения SQL**

```javascript
/**
 * @param {Array<TableInfo>} databaseTables - Массив таблиц
 * @param {Object<string, Array<ColumnInfo>>} tableColumns - Структуры таблиц
 * @returns {Object} Данные для автодополнения
 */
```

**Генерируемые типы completions:**

#### 1. Keyword Completions (ключевые слова)
```javascript
{
    name: 'SELECT',
    value: 'SELECT',
    score: 500, // Средний приоритет
    meta: 'keyword'
}
```

**Особенности:**
- Score: 500 (средний приоритет)
- Все ключевые слова из `SQL_KEYWORDS`

#### 2. Table Completions (таблицы)
```javascript
{
    name: 'modx_site_content',
    value: 'modx_site_content',
    score: 1000, // Высокий приоритет
    meta: 'table'
}
```

**Особенности:**
- Score: 1000 (высокий приоритет)
- Все таблицы из `databaseTables`
- Используется полное имя таблицы (с префиксом)

#### 3. Function Completions (функции)
```javascript
{
    name: 'COUNT',
    value: 'COUNT',
    score: 400, // Низкий приоритет
    meta: 'function'
}
```

**Особенности:**
- Score: 400 (низкий приоритет)
- Все функции из `SQL_FUNCTIONS`

#### 4. Column Completions (колонки)
```javascript
{
    name: 'site_content.pagetitle',
    value: 'site_content.pagetitle',
    score: 1200, // Очень высокий приоритет
    meta: 'column (varchar)',
    caption: 'site_content.pagetitle - varchar(255)',
    table: 'site_content'
}
```

**Особенности:**
- Score: 1200 (очень высокий приоритет)
- Формат: `table_name.column_name`
- Включает тип данных в meta
- Дополнительная информация в caption
- Ссылка на таблицу в table

**Возвращаемая структура:**
```javascript
{
    keywords: Array<CompletionItem>,  // Ключевые слова
    tables: Array<CompletionItem>,    // Таблицы
    functions: Array<CompletionItem>, // Функции
    columns: Array<CompletionItem>    // Колонки
}
```

## Вспомогательные функции

### `getTablePrefix(databaseTables)`
**Получение префикса таблиц из массива таблиц**

```javascript
/**
 * @param {Array<TableInfo>} databaseTables - Массив таблиц
 * @returns {string} Префикс таблиц
 * @private
 */
```

**Алгоритм:**
```javascript
1. Берем первую таблицу из массива
2. Если clean_name существует → вычисляем префикс
   Префикс = table.name.replace(table.clean_name, '')
3. Возвращаем префикс или пустую строку
```

**Пример:**
```javascript
const table = { name: 'modx_site_content', clean_name: 'site_content' };
getTablePrefix([table]); // → 'modx_'
```

## Структуры данных

### TableInfo (ожидаемая структура)
```javascript
{
    name: 'modx_site_content',       // Полное имя таблицы с префиксом
    clean_name: 'site_content',      // Имя таблицы без префикса
    rows: 150,                       // Количество строк (опционально)
    size: '1.5 MB',                  // Размер таблицы (опционально)
    // ... другие свойства
}
```

### ColumnInfo (ожидаемая структура)
```javascript
{
    field: 'pagetitle',              // Имя колонки
    type: 'varchar(255)',            // Тип данных
    caption: 'Page Title',           // Описание колонки (опционально)
    // ... другие свойства
}
```

### SnippetItem
```javascript
{
    name: string,           // Уникальное имя сниппета
    content: string,        // Содержимое сниппета (с переменными ${n})
    tabTrigger: string,     // Триггер для активации (без пробелов)
    scope: 'sql',           // Область применения
    description: string,    // Описание (опционально)
    meta: string           // Мета информация (опционально)
}
```

### CompletionItem
```javascript
{
    name: string,           // Отображаемое имя
    value: string,          // Значение для вставки
    score: number,          // Приоритет (чем выше, тем важнее)
    meta: string,           // Тип элемента (keyword/table/function/column)
    caption: string,        // Дополнительная информация (опционально)
    table: string           // Имя таблицы (для колонок, опционально)
}
```

## Примеры использования

### Интеграция с AceEditor
```javascript
// В AceEditor.js при настройке SQL автодополнения
import { generateSqlSnippets, generateSqlCompletions } from './completion-data.js';

async function setupSqlAutocompletion() {
    // Загрузка структуры БД с сервера
    const { databaseTables, tableColumns } = await loadDatabaseStructure();
    
    // Генерация сниппетов
    const sqlSnippets = generateSqlSnippets(databaseTables, tableColumns);
    
    // Генерация данных для автодополнения
    const sqlCompletions = generateSqlCompletions(databaseTables, tableColumns);
    
    // Настройка completer
    const sqlCompleter = {
        getCompletions: (editor, session, pos, prefix, callback) => {
            // Контекстная логика (упрощенная)
            const completions = [
                ...sqlCompletions.keywords,
                ...sqlCompletions.tables,
                ...sqlCompletions.functions,
                ...sqlCompletions.columns
            ];
            
            // Фильтрация по префиксу
            const filtered = completions.filter(item =>
                item.name.toLowerCase().includes(prefix.toLowerCase())
            );
            
            callback(null, filtered);
        }
    };
    
    // Регистрация completer
    langTools.addCompleter(sqlCompleter);
    
    // Регистрация сниппетов
    registerSnippets(snippetManager, sqlSnippets);
}
```

### Использование отдельных компонентов
```javascript
// Использование только сниппетов
const snippets = generateSqlSnippets(tables, columns);
snippets.forEach(snippet => {
    console.log(`Сниппет: ${snippet.name} → ${snippet.tabTrigger}`);
});

// Использование только completions
const completions = generateSqlCompletions(tables, columns);
console.log('Ключевые слова:', completions.keywords.length);
console.log('Таблицы:', completions.tables.length);
console.log('Колонки:', completions.columns.length);
```

### Кастомизация данных
```javascript
// Добавление пользовательских ключевых слов
const customKeywords = [...SQL_KEYWORDS, 'MATCH', 'AGAINST', 'FULLTEXT'];

// Добавление пользовательских функций
const customFunctions = [...SQL_FUNCTIONS, 'JSON_EXTRACT', 'JSON_ARRAY'];

// Кастомная генерация сниппетов
function generateCustomSnippets(tables, columns) {
    const baseSnippets = generateSqlSnippets(tables, columns);
    
    // Добавляем пользовательские сниппеты
    baseSnippets.push({
        name: 'custom_query',
        content: 'SELECT ${1:columns} FROM ${2:table} WHERE MATCH(${3:column}) AGAINST(${4:term})',
        tabTrigger: 'match',
        scope: 'sql',
        description: 'Full-text search query'
    });
    
    return baseSnippets;
}
```

## Обработка префиксов таблиц

### Стратегия работы с префиксами
```javascript
// Предположим, таблица: modx_site_content
const table = {
    name: 'modx_site_content',
    clean_name: 'site_content'
};

// Генерация вариантов:
// 1. Без префикса (clean_name) - для удобства
{
    name: 'site_content',
    value: 'site_content',
    tabTrigger: 'site_content'
}

// 2. С префиксом (full name) - для точности
{
    name: 'modx_site_content',
    value: 'modx_site_content',
    tabTrigger: 'modx_site_content'
}
```

### Определение префикса
```javascript
function getTablePrefix(tables) {
    if (!tables || tables.length === 0) return '';
    
    const firstTable = tables[0];
    if (firstTable.clean_name && firstTable.name.includes(firstTable.clean_name)) {
        return firstTable.name.replace(firstTable.clean_name, '');
    }
    
    return '';
}
```

## Производительность

### Оптимизации:
1. **Ограничение быстрых запросов** - только первые 8 таблиц
2. **Кэширование данных** - загрузка один раз при инициализации
3. **Ленивая генерация** - только при необходимости
4. **Предварительная фильтрация** - на уровне данных, а не UI

### Рекомендации по использованию:
```javascript
// Хорошо: кэширование загруженных данных
let cachedCompletions = null;

async function getSqlCompletions() {
    if (!cachedCompletions) {
        const { tables, columns } = await loadDatabaseStructure();
        cachedCompletions = generateSqlCompletions(tables, columns);
    }
    return cachedCompletions;
}

// Плохо: повторная загрузка и генерация при каждом запросе
async function getCompletionsForPrefix(prefix) {
    const { tables, columns } = await loadDatabaseStructure();
    const completions = generateSqlCompletions(tables, columns);
    // ... фильтрация
}
```

## Расширяемость

### Добавление новых типов completions
```javascript
// Пример: добавление completions для хранимых процедур
export function generateSqlCompletionsWithProcedures(tables, columns, procedures) {
    const baseCompletions = generateSqlCompletions(tables, columns);
    
    const procedureCompletions = procedures.map(proc => ({
        name: proc.name,
        value: proc.name,
        score: 600,
        meta: 'procedure',
        params: proc.params
    }));
    
    return {
        ...baseCompletions,
        procedures: procedureCompletions
    };
}
```

### Кастомизация приоритетов
```javascript
// Пример: изменение приоритетов
function generateCustomPriorities(tables, columns) {
    const completions = generateSqlCompletions(tables, columns);
    
    // Повышаем приоритет таблиц
    completions.tables.forEach(table => {
        table.score = 1500;
    });
    
    // Понижаем приоритет ключевых слов
    completions.keywords.forEach(keyword => {
        keyword.score = 300;
    });
    
    return completions;
}
```