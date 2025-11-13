/**
 * Данные для автодополнения редактора
 * @module CompletionData
 */

// Ключевые слова SQL
export const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN',
    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT',
    'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT',
    'AS', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE',
    'UNION', 'ALL', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
];

// SQL функции
export const SQL_FUNCTIONS = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'NOW', 'CURDATE', 'CURTIME',
    'DATE_FORMAT', 'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER', 'LOWER',
    'ROUND', 'CEIL', 'FLOOR', 'COALESCE', 'IF', 'IFNULL', 'NULLIF'
];

// Базовые SQL сниппеты
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

/**
 * Генерация SQL сниппетов на основе структуры базы данных
 * @param {Array<TableInfo>} databaseTables - Массив таблиц
 * @param {Object<string, Array<ColumnInfo>>} tableColumns - Структуры таблиц
 * @returns {Array<Object>} Массив SQL сниппетов
 */
export function generateSqlSnippets(databaseTables = [], tableColumns = {}) {
    const tablePrefix = getTablePrefix(databaseTables);
    
    const tableSnippetsNoPrefix = databaseTables.map(table => {
        const cleanName = table.clean_name || table.name.replace(tablePrefix, '');
        
        return {
            name: `${cleanName}`,
            content: table.clean_name,
            tabTrigger: cleanName.toLowerCase(),
            scope: 'sql',
            description: `Таблица: ${table.name}`,
            meta: 'table'
        };
    });
    
    const tableSnippetsWithPrefix = databaseTables.map(table => ({
        name: `${table.name}`,
        content: table.name,
        tabTrigger: table.name.toLowerCase(),
        scope: 'sql',
        description: `Таблица: ${table.name} (полное имя)`,
        meta: 'table'
    }));
    
    const quickQueriesNoPrefix = databaseTables.slice(0, 8).map(table => {
        const cleanName = table.clean_name || table.name.replace(tablePrefix, '');
        
        return {
            name: `select_from_${cleanName}`,
            content: `SELECT * FROM ${table.clean_name} WHERE \${1:condition}`,
            tabTrigger: `sel_${cleanName.toLowerCase()}`,
            scope: 'sql', 
            description: `SELECT запрос для ${table.name}`,
            meta: 'query'
        };
    });
    
    const quickQueriesWithPrefix = databaseTables.slice(0, 8).map(table => ({
        name: `select_from_full_${table.name}`,
        content: `SELECT * FROM ${table.name} WHERE \${1:condition}`,
        tabTrigger: `sel_${table.name.toLowerCase()}`,
        scope: 'sql', 
        description: `SELECT запрос для ${table.name} (полное имя)`,
        meta: 'query'
    }));
    
    return [
        ...SQL_BASE_SNIPPETS,
        ...tableSnippetsNoPrefix,
        ...tableSnippetsWithPrefix, 
        ...quickQueriesNoPrefix,
        ...quickQueriesWithPrefix
    ];
}

/**
 * Получение префикса таблиц
 * @param {Array<TableInfo>} databaseTables - Массив таблиц
 * @returns {string} Префикс таблиц
 */
function getTablePrefix(databaseTables) {
    const firstTable = databaseTables[0];
    if (!firstTable) return '';
    
    return firstTable.name?.replace(firstTable.clean_name, '') || '';
}

/**
 * Генерация данных для автодополнения SQL
 * @param {Array<TableInfo>} databaseTables - Массив таблиц
 * @param {Object<string, Array<ColumnInfo>>} tableColumns - Структуры таблиц
 * @returns {Object} Данные для автодополнения
 */
export function generateSqlCompletions(databaseTables = [], tableColumns = {}) {
    const keywordCompletions = SQL_KEYWORDS.map(word => ({
        name: word,
        value: word,
        score: 500,
        meta: 'keyword'
    }));

    const tableCompletions = databaseTables.map(table => ({
        name: table.name,
        value: table.name,
        score: 1000,
        meta: 'table'
    }));

    const functionCompletions = SQL_FUNCTIONS.map(func => ({
        name: func,
        value: func,
        score: 400,
        meta: 'function'
    }));

    // Генерация колонок для всех таблиц
    const columnCompletions = [];
    Object.keys(tableColumns).forEach(tableName => {
        tableColumns[tableName].forEach(column => {
            columnCompletions.push({
                name: `${tableName}.${column.field}`,
                value: `${tableName}.${column.field}`,
                score: 1200,
                meta: `column (${column.type})`,
                caption: `${tableName}.${column.field} - ${column.type}`,
                table: tableName
            });
        });
    });

    return {
        keywords: keywordCompletions,
        tables: tableCompletions,
        functions: functionCompletions,
        columns: columnCompletions
    };
}

export default {
    SQL_KEYWORDS,
    SQL_FUNCTIONS,
    SQL_BASE_SNIPPETS,
    generateSqlSnippets,
    generateSqlCompletions
};