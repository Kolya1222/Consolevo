import { 
    generateSqlSnippets,
    generateSqlCompletions 
} from '../utils/completion-data.js';
import { EDITOR_CONFIG, THEMES, MODES } from '../utils/constants.js';
import { 
    logger,
    getCsrfToken,
    debounce,
    getLineCount,
    throttle,
    escapeSqlIdentifier
} from '../utils/helpers.js';

import { 
    PHP_SNIPPETS,
    generatePhpCompletions,
    generateEvoSnippets 
} from '../utils/php-completion-data.js'

/**
 * @typedef {Object} TableInfo
 * @property {string} name - Полное имя таблицы
 * @property {string} clean_name - Имя без префикса
 */

/**
 * @typedef {Object} ColumnInfo  
 * @property {string} field - Имя колонки
 * @property {string} type - Тип данных
 * @property {string} [caption] - Описание колонки
 */

/**
 * Класс для работы с Ace Editor с расширенным функционалом
 * @class AceEditor
 */
export default class AceEditor {
    /**
     * Создает экземпляр редактора
     * @param {string} consoleType - Тип консоли ('php' | 'sql')
     */
    constructor(consoleType) {
        /** @type {string} Тип консоли */
        this.consoleType = consoleType;
        
        /** @type {ace.Editor|null} Экземпляр Ace Editor */
        this.editor = null;
        
        /** @type {Array<number>} Массив ID маркеров ошибок */
        this.errorMarkers = [];
        
        /** @type {boolean} Флаг инициализации */
        this.isInitialized = false;
        
        /** @type {Array<TableInfo>} Данные для автодополнения SQL */
        this.databaseTables = [];
        
        /** @type {Object<string, Array<ColumnInfo>>} Структуры таблиц */
        this.tableColumns = {};
        
        /** @type {Object|null} SQL completer */
        this.sqlCompleter = null;
        
        /** @type {Object} Логгер */
        this.log = logger('AceEditor');
        
        /** @type {Function|null} Колбэк для StateManager */
        this.stateManagerCallback = null;
        
        /** @type {Function} Обработчик изменений с дебаунсом */
        this.changeHandler = debounce(this._onChange.bind(this), 2000);
        
        /** @type {Function} Обработчик ресайза с троттлингом */
        this.resizeHandler = throttle(this.resize.bind(this), 100);
        
        /** @type {number} Счетчик изменений */
        this.changeCount = 0;
        
        /** @type {Map<string, Function>} Отслеживание событий для очистки */
        this._eventHandlers = new Map();
    }

    /**
     * Инициализация редактора
     * @returns {Promise<ace.Editor>} Экземпляр Ace Editor
     * @throws {Error} Если Ace не загружен или элемент не найден
     */
    async init() {
        try {
            if (!this.isAceLoaded()) {
                throw new Error('Ace Editor не загружен. Проверьте подключение скриптов.');
            }

            const editorElement = document.getElementById('code-editor');
            if (!editorElement) {
                throw new Error('Элемент #code-editor не найден в DOM');
            }

            this.editor = ace.edit('code-editor');
            this.applyBaseConfig();
            this.setInitialContent();
            
            if (this.consoleType === 'sql') {
                await this.loadDatabaseTables();
            }
            
            await this.enableAdvancedFeatures();
            
            this.setupChangeListener();
            this.updateEditorInfo();
            this.isInitialized = true;
            
            this.log.info('Успешно инициализирован', { 
                type: this.consoleType,
                theme: THEMES.default,
                hasTables: this.databaseTables.length
            });
            
            return this.editor;
        } catch (error) {
            this.log.error('Ошибка инициализации', { error: error.message });
            throw error;
        }
    }

    /**
     * Проверка загрузки Ace Editor
     * @returns {boolean}
     */
    isAceLoaded() {
        return typeof ace !== 'undefined' && 
               typeof ace.edit === 'function' &&
               typeof ace.require === 'function';
    }

    /**
     * Применение базовой конфигурации
     */
    applyBaseConfig() {
        if (!this.editor) return;

        this.editor.setOptions(EDITOR_CONFIG);
        this.editor.session.setMode(this.consoleType === 'php' ? MODES.php : MODES.sql);
        
        this.log.debug('Применена базовая конфигурация', {
            mode: this.consoleType === 'php' ? MODES.php : MODES.sql,
            theme: THEMES.default
        });
        if (this.consoleType === 'sql') {
            this.editor.session.setTabSize(2);
            this.editor.session.setUseSoftTabs(true);
        }
    }

    /**
     * Установка начального содержимого
     */
    setInitialContent() {
        if (!this.editor) return;
        
        const editorElement = document.getElementById('code-editor');
        const defaultCode = editorElement?.dataset.defaultCode;
        
        const initialContent = defaultCode || this.getDefaultContent();
        this.editor.setValue(initialContent, 1);
        
        // Позиционирование курсора
        this.positionInitialCursor();
        
        this.log.debug('Установлено начальное содержимое', { 
            type: this.consoleType,
            lines: getLineCount(initialContent)
        });
    }

    /**
     * Получение содержимого по умолчанию
     * @returns {string}
     */
    getDefaultContent() {
        const defaults = {
            php: `<?php\n\necho "Привет, мир!";\n\n?>`,
            sql: `SELECT TABLE_NAME, TABLE_ROWS \nFROM INFORMATION_SCHEMA.TABLES \nWHERE TABLE_SCHEMA = DATABASE()`
        };
        return defaults[this.consoleType] || '';
    }

    /**
     * Позиционирование курсора при инициализации
     */
    positionInitialCursor() {
        if (!this.editor) return;
        
        const positions = {
            php: { row: 2, column: 0 }, // После открывающего тега PHP
            sql: { row: 0, column: 0 }
        };
        
        const position = positions[this.consoleType];
        if (position) {
            this.editor.moveCursorTo(position.row, position.column);
        }
    }

    /**
     * Включение расширенных функций
     */
    async enableAdvancedFeatures() {
        try {
            if (typeof ace.require === 'undefined') {
                this.log.warn('Ace extensions не доступны');
                return;
            }

            await this.loadAceExtension('ace/ext/language_tools');
            this.setupAutocompletion();

            this.log.debug('Расширенные функции включены', {
                autocomplete: true,
                snippets: true,
                liveCompletion: true
            });

        } catch (error) {
            this.log.warn('Расширенные функции Ace недоступны', { error: error.message });
        }
    }

    /**
     * Загрузка расширения Ace
     * @param {string} extensionPath - Путь к расширению
     * @returns {Promise<void>}
     */
    async loadAceExtension(extensionPath) {
        return new Promise((resolve, reject) => {
            try {
                ace.require(extensionPath);
                resolve();
            } catch (error) {
                this.log.error('Ошибка загрузки расширения', { 
                    extension: extensionPath, 
                    error: error.message 
                });
                reject(error);
            }
        });
    }

    /**
     * Загрузка таблиц базы данных
     * @returns {Promise<void>}
     */
    async loadDatabaseTables() {
        if (this.consoleType !== 'sql') return;
        
        try {
            const headers = {
                'X-CSRF-TOKEN': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            };
            
            const response = await fetch('/consolevo/sql/tables', {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.databaseTables = data.tables || [];
                this.tableColumns = data.table_structures || {};
                
            } else {
                throw new Error(data.message || 'Неизвестная ошибка сервера');
            }
        } catch (error) {
            this.log.warn('Не удалось загрузить таблицы базы данных', { 
                error: error.message 
            });
        }
    }

    /**
     * Настройка автодополнения
     */
    async setupAutocompletion() {
        if (!this.editor || typeof ace.require === 'undefined') return;

        try {
            const snippetManager = ace.require("ace/snippets").snippetManager;
            const langTools = ace.require("ace/ext/language_tools");
            
            let snippets = [];
            
            if (this.consoleType === 'php') {
                // Загружаем динамические данные Evolution CMS
                const evoSnippets = await generateEvoSnippets();
                snippets = [
                    ...PHP_SNIPPETS,
                    ...evoSnippets
                ];
                await this.setupPhpCompleter(langTools);
            } else {
                snippets = generateSqlSnippets(this.databaseTables, this.tableColumns);
                this.setupSqlCompleter(langTools);
            }

            this.registerSnippets(snippetManager, snippets);

            this.editor.setOptions({
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true
            });

        } catch (error) {
            this.log.warn('Ошибка настройки автодополнения', { error: error.message });
        }
    }

    /**
     * Настройка PHP completer с динамическими данными
     */
    async setupPhpCompleter(langTools) {
        const evoCompletions = await generatePhpCompletions();
        
        const phpCompleter = {
            getCompletions: (editor, session, pos, prefix, callback) => {
                try {
                    const searchPrefix = prefix.toLowerCase();
                    
                    const completions = [
                        ...evoCompletions,
                        // Базовые PHP функции
                    ].filter(comp => {
                        if (!comp || !comp.name) return false;
                        if (searchPrefix.length > 0) {
                            return comp.name.toLowerCase().includes(searchPrefix);
                        }
                        return true;
                    });
                    
                    callback(null, completions);
                } catch (error) {
                    console.error('Error in PHP completer:', error);
                    callback(null, []);
                }
            }
        };

        langTools.addCompleter(phpCompleter);
    }

    /**
     * Проверка и отладка данных автодополнения
     */
    debugAutocompleteData() { 
        // Проверяем первую таблицу
        const firstTable = this.databaseTables[0];
        if (firstTable) {
            const firstTableColumns = this.tableColumns[firstTable.clean_name];
        }
        
        // Проверяем completer
        const langTools = ace.require("ace/ext/language_tools");
    }

    /**
     * Настройка SQL completer для динамических подсказок
     */
    setupSqlCompleter(langTools) {
        if (this.sqlCompleter) {
            langTools.removeCompleter(this.sqlCompleter);
        }

        this.sqlCompleter = {
            getCompletions: (editor, session, pos, prefix, callback) => {
                try {
                    const searchPrefix = prefix.toLowerCase();
                    const query = editor.getValue();
                    const line = session.getLine(pos.row);
                    const beforeCursor = line.substring(0, pos.column);

                    // ОПРЕДЕЛЯЕМ КОНТЕКСТ - УЛУЧШЕННАЯ ПРОВЕРКА
                    const isAfterTableDot = this.isAfterTableDot(beforeCursor);
                    const isAfterFrom = this.isAfterFrom(beforeCursor);
                    const isAfterSelect = this.isAfterSelect(beforeCursor);
                    const hasFromInQuery = query.includes('FROM');
                    const currentQueryTables = this.extractTablesFromQuery(query);

                    // ГЕНЕРИРУЕМ ДАННЫЕ АВТОДОПОЛНЕНИЯ
                    const completionsData = generateSqlCompletions(this.databaseTables, this.tableColumns);
                    
                    let completions = [];

                    // КОНТЕКСТНАЯ ФИЛЬТРАЦИЯ - ПРИОРИТЕТ ДЛЯ КОНТЕКСТА
                    if (isAfterTableDot) {
                        // ЕСЛИ ПОСЛЕ ТОЧКИ - ТОЛЬКО КОЛОНКИ ЭТОЙ ТАБЛИЦЫ
                        const tableName = this.extractTableBeforeDot(beforeCursor);

                        const columnCompletions = this.getColumnCompletionsForTable(tableName);
                        completions = columnCompletions;
                        
                    } else if (isAfterFrom) {
                        // ЕСЛИ ПОСЛЕ FROM - ТОЛЬКО ТАБЛИЦЫ
                        completions = completionsData.tables;
                        
                    } else if (isAfterSelect) {
                        // ЕСЛИ ПОСЛЕ SELECT - ЗАВИСИТ ОТ КОНТЕКСТА
                        if (hasFromInQuery && currentQueryTables.length > 0) {
                            // ЕСЛИ УЖЕ ЕСТЬ FROM В ЗАПРОСЕ - КОЛОНКИ ИЗ ТАБЛИЦ ЗАПРОСА
                            const contextualColumns = this.getContextualColumnCompletions(query);
                            completions = [
                                ...contextualColumns,
                                ...completionsData.functions
                            ];
                        } else {
                            // ЕСЛИ FROM ЕЩЕ НЕТ - ТОЛЬКО ФУНКЦИИ И КЛЮЧЕВЫЕ СЛОВА
                            completions = [
                                ...completionsData.functions,
                                ...completionsData.keywords.filter(k => 
                                    ['DISTINCT', 'ALL', 'TOP', 'AS'].includes(k.name)
                                )
                            ];
                        }
                        
                    } else if (currentQueryTables.length > 0) {
                        // ЕСЛИ ЕСТЬ ТАБЛИЦЫ В ЗАПРОСЕ - ПРЕДЛАГАЕМ КОЛОНКИ И ТАБЛИЦЫ
                        const contextualColumns = this.getContextualColumnCompletions(query);
                        completions = [
                            ...completionsData.keywords,
                            ...completionsData.tables,
                            ...contextualColumns,
                            ...completionsData.functions
                        ];
                        
                    } else {
                        // ОБЩИЙ СЛУЧАЙ - ВСЕ ПОДСКАЗКИ
                        completions = [
                            ...completionsData.keywords,
                            ...completionsData.tables,
                            ...completionsData.columns,
                            ...completionsData.functions
                        ];
                    }

                    // ФИЛЬТРАЦИЯ ПО ПРЕФИКСУ (только если не в специальном контексте)
                    let filteredCompletions = completions;
                    
                    if (searchPrefix.length > 0 && !isAfterFrom) {
                        // ФИЛЬТРУЕМ ПО ПРЕФИКСУ, КРОМЕ СЛУЧАЯ AFTER FROM
                        filteredCompletions = completions.filter(comp => {
                            return comp.name.toLowerCase().includes(searchPrefix);
                        });
                    }
                    
                    callback(null, filteredCompletions);
                } catch (error) {
                    console.error('Error in SQL completer:', error);
                    callback(null, []);
                }
            }
        };

        langTools.addCompleter(this.sqlCompleter);
    }

    /**
     * Проверяем, находимся ли после точки таблицы
     */
    isAfterTableDot(beforeCursor) {
        // Ищем паттерн: table. или alias.
        const tableDotPattern = /[\w$]+\s*\.\s*$/;
        return tableDotPattern.test(beforeCursor);
    }

    /**
     * Извлекаем имя таблицы перед точкой
     */
    extractTableBeforeDot(beforeCursor) {
        const match = beforeCursor.match(/([\w$]+)\s*\.\s*$/);
        return match ? match[1] : null;
    }

    /**
     * Проверяем, находимся ли после SELECT
     */
    isAfterSelect(beforeCursor) {
        // Ищем паттерн: SELECT ... (без FROM после)
        const selectPattern = /\bSELECT\b[^]*$/i;
        const fromAfterSelect = /\bSELECT\b[^]*\bFROM\b/i;
        return selectPattern.test(beforeCursor) && !fromAfterSelect.test(beforeCursor);
    }

    /**
     * УЛУЧШЕННАЯ проверка - находимся ли после FROM
     */
    isAfterFrom(beforeCursor) {
        // Ищем паттерн: FROM ... (без другого ключевого слова после)
        const fromPattern = /\bFROM\b[^]*$/i;
        const otherKeywordsAfterFrom = /\bFROM\b[^]*\b(WHERE|GROUP|ORDER|HAVING|LIMIT)\b/i;
        return fromPattern.test(beforeCursor) && !otherKeywordsAfterFrom.test(beforeCursor);
    }

    /**
     * Получение колонок для конкретной таблицы
     */
    getColumnCompletionsForTable(tableName) {
        if (!tableName) return [];
        
        // Пробуем найти таблицу в разных форматах
        const cleanTableName = this.extractCleanTableName(tableName);
        
        if (!this.tableColumns[cleanTableName]) {
            console.warn("❌ Table not found in structure:", cleanTableName);
            return [];
        }

        const columns = this.tableColumns[cleanTableName].map(column => ({
            name: column.field,
            value: column.field,
            score: 2000, // ОЧЕНЬ ВЫСОКИЙ ПРИОРИТЕТ для колонок после точки
            meta: `column (${column.type})`,
            caption: column.caption || `${column.field} - ${column.type}`,
            table: cleanTableName
        }));

        return columns;
    }

    /**
     * Регистрация сниппетов
     * @param {object} snippetManager - Менеджер сниппетов Ace
     * @param {Array<Object>} snippets - Массив сниппетов
     */
    registerSnippets(snippetManager, snippets) {
        const snippetData = {};
        
        snippets.forEach(snippet => {
            if (snippet?.name && snippet.content) {
                snippetData[snippet.name] = {
                    name: snippet.name,
                    content: snippet.content,
                    tabTrigger: snippet.tabTrigger || snippet.name,
                    scope: this.consoleType
                };
            }
        });

        snippetManager.register(snippetData, this.consoleType);
    }

    /**
     * Получение дополнений для колонок
     */
    getColumnCompletions(session, pos) {
        const line = session.getLine(pos.row);
        const beforeCursor = line.substring(0, pos.column);
        
        const tableMatch = beforeCursor.match(/([\w$]+)\.$/);
        if (!tableMatch) return [];

        const tableName = tableMatch[1];
        const cleanTableName = this.extractCleanTableName(tableName);
        
        if (!this.tableColumns[cleanTableName]) return [];

        const columns = this.tableColumns[cleanTableName].map(column => ({
            name: column.field,
            value: column.field,
            score: 1500, // ВЫСОКИЙ ПРИОРИТЕТ для колонок
            meta: `column (${column.type})`,
            caption: column.caption || `${column.field} - ${column.type}`
        }));
        return columns;
    }

    /**
     * Извлечение чистого имени таблицы (без префикса)
     * @private  
     * @param {string} tableName - Имя таблицы с префиксом
     * @returns {string} Чистое имя таблицы
     */
    extractCleanTableName(tableName) {
        // Ищем таблицу в loaded tables по полному имени
        const foundTable = this.databaseTables.find(table => 
            table.name === tableName || table.clean_name === tableName
        );
        
        if (foundTable) {
            return foundTable.clean_name;
        }
        
        // Если не нашли - пробуем убрать префикс
        const prefix = this.getTablePrefix();
        const cleanName = tableName.replace(prefix, '');
        return cleanName;
    }

    /**
     * Анализ SQL запроса для определения используемых таблиц
     * @param {string} query - SQL запрос
     * @returns {Array<string>} Массив имен таблиц
     */
    extractTablesFromQuery(query) {
        if (!query || this.consoleType !== 'sql') return [];
        
        const tables = new Set();
        
        // Простые паттерны для поиска таблиц
        const patterns = [
            /\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi, 
            /\bUPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            /\bINTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
        ];
        
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(query)) !== null) {
                const tableName = match[1];
                const cleanName = this.extractCleanTableName(tableName);
                if (this.tableColumns[cleanName]) {
                    tables.add(cleanName);
                }
            }
        });
        
        return Array.from(tables);
    }

    /**
     * Получение колонок для всех таблиц в текущем запросе
     * @param {string} query - Текущий SQL запрос
     * @returns {Array<Object>} Массив колонок
     */
    getContextualColumnCompletions(query) {
        const usedTables = this.extractTablesFromQuery(query);
        const columns = [];
        
        usedTables.forEach(tableName => {
            if (this.tableColumns[tableName]) {
                columns.push(...this.tableColumns[tableName].map(column => ({
                    name: `${tableName}.${column.field}`,
                    value: `${tableName}.${column.field}`,
                    score: 1200,
                    meta: `column (${column.type})`,
                    caption: `${tableName}.${column.field} - ${column.type}`,
                    table: tableName
                })));
            }
        });
        
        return columns;
    }

    /**
     * Экранирование имени таблицы
     * @param {string} tableName - Имя таблицы
     * @returns {string}
     */
    escapeTableName(tableName) {
        return escapeSqlIdentifier(tableName);
    }

    /**
     * Получение префикса таблиц
     * @returns {string}
     */
    getTablePrefix() {
        const firstTable = this.databaseTables[0];
        if (!firstTable) return '';
        
        return firstTable.name?.replace(firstTable.clean_name, '') || '';
    }

    /**
     * Настройка слушателей изменений
     */
    setupChangeListener() {
        if (!this.editor) return;

        // Слушатель изменений содержимого
        const changeHandler = () => {
            this.changeCount++;
            this.changeHandler();
            this.updateEditorInfo();
        };

        // Слушатель перемещения курсора
        const selectionHandler = () => {
            this.updateCursorPosition();
        };

        this.editor.on('change', changeHandler);
        this.editor.on('changeSelection', selectionHandler);

        // Сохраняем ссылки для очистки
        this._eventHandlers.set('change', changeHandler);
        this._eventHandlers.set('changeSelection', selectionHandler);

        // Слушатель ресайза окна
        window.addEventListener('resize', this.resizeHandler);
    }

    /**
     * Обновление позиции курсора
     */
    updateCursorPosition() {
        const cursorPositionElement = document.getElementById('cursor-position');
        if (!cursorPositionElement || !this.editor) return;

        const cursor = this.editor.getCursorPosition();
        cursorPositionElement.textContent = `Строка ${cursor.row + 1}, Колонка ${cursor.column + 1}`;
    }

    /**
     * Обновление информации редактора
     */
    updateEditorInfo() {
        this.updateCursorPosition();
        this.updateFileSize();
    }

    /**
     * Обновление информации о размере файла
     */
    updateFileSize() {
        const fileSizeElement = document.getElementById('file-size');
        if (!fileSizeElement || !this.editor) return;

        const content = this.editor.getValue();
        const size = content.length;
        const lines = content.split('\n').length;
        
        fileSizeElement.textContent = `${size} символов, ${lines} строк`;
    }

    /**
     * Обработчик изменений с дебаунсом
     * @private
     */
    _onChange() {
        if (!this.editor) return;
        if (this.stateManagerCallback) {
            this.stateManagerCallback();
        }
    }

    /**
     * Получение содержимого редактора
     * @returns {string}
     */
    getValue() {
        return this.editor ? this.editor.getValue().trim() : '';
    }

    /**
     * Установка содержимого редактора
     * @param {string} value - Новое содержимое
     * @param {number} cursorPosition - Позиция курсора
     */
    setValue(value, cursorPosition = 1) {
        if (this.editor) {
            this.clearErrorMarkers();
            this.editor.setValue(value, cursorPosition);
            this.updateEditorInfo();
            this.log.debug('Содержимое установлено', {
                length: value.length,
                lines: getLineCount(value),
                cursorPosition
            });
        }
    }

    /**
     * Очистка редактора
     */
    clear() {
        this.setValue('');
        this.clearErrorMarkers();
        this.log.debug('Редактор очищен');
    }

    /**
     * Изменение темы редактора
     * @param {string} themeName - Название темы Ace Editor (например, 'ace/theme/tomorrow_night')
     */
    setTheme(themeName) {
        try {
            if (this.editor) {
                this.editor.setTheme(themeName);
                this.log.debug('Тема изменена', { theme: themeName });
            }
        } catch (error) {
            this.log.warn('Ошибка установки темы', { 
                requested: themeName,
                error: error.message 
            });
        }
    }

    /**
     * Включение/отключение автодополнения
     * @param {boolean} enabled - Включить автодополнение
     */
    toggleAutocomplete(enabled) {
        if (!this.editor) return;
        
        this.editor.setOptions({
            enableBasicAutocompletion: enabled,
            enableLiveAutocompletion: enabled,
            enableSnippets: enabled
        });
        
        this.log.debug('Автодополнение', { enabled });
    }

    /**
     * Изменение размера шрифта
     * @param {number|string} size - Размер шрифта
     */
    changeFontSize(size) {
        if (this.editor) {
            this.editor.setFontSize(parseInt(size) + 'px');
            this.log.debug('Размер шрифта изменен', { size });
        }
    }

    /**
     * Переключение режима переноса строк
     * @param {boolean} enabled - Включить перенос строк
     */
    toggleWrapMode(enabled) {
        if (this.editor) {
            this.editor.session.setUseWrapMode(enabled);
            this.log.debug('Режим переноса строк', { enabled });
        }
    }

    /**
     * Добавление маркера ошибки
     * @param {number} line - Номер строки (0-based)
     * @param {string} message - Сообщение об ошибке
     */
    addErrorMarker(line, message) {
        if (!this.editor) return;

        const session = this.editor.session;
        this.clearErrorMarkers();
        
        const range = new ace.Range(line, 0, line, 1);
        const markerId = session.addMarker(range, "ace_error-marker", "fullLine");
        
        this.errorMarkers.push(markerId);
        
        session.setAnnotations([{
            row: line,
            column: 0,
            text: message,
            type: "error"
        }]);

        // Прокручиваем к ошибке (line уже 0-based)
        this.editor.gotoLine(line, 0, true);
        
        this.log.debug('Добавлен маркер ошибки', { line, message });
    }

    /**
     * Очистка маркеров ошибок
     */
    clearErrorMarkers() {
        if (!this.editor) return;

        const session = this.editor.session;
        this.errorMarkers.forEach(markerId => {
            session.removeMarker(markerId);
        });
        this.errorMarkers = [];
        session.clearAnnotations();
        
        this.log.debug('Маркеры ошибок очищены');
    }

    /**
     * Применение настроек
     * @param {object} preferences - Настройки редактора
     */
    applyPreferences(preferences) {
        if (!this.editor) return;

        if (preferences.theme) {
            this.setTheme(preferences.theme);
        }

        if (preferences.fontSize) {
            this.changeFontSize(preferences.fontSize);
        }
        if (preferences.wrapMode !== undefined) {
            this.toggleWrapMode(preferences.wrapMode);
        }
        if (preferences.enableAutocomplete !== undefined) {
            this.toggleAutocomplete(preferences.enableAutocomplete);
        }
        
        this.log.debug('Настройки применены', preferences);
    }

    /**
     * Получение позиции курсора для StateManager
     * @returns {Object|null}
     */
    getCursorPosition() {
        return this.editor ? this.editor.getCursorPosition() : null;
    }

    /**
     * Получение выделений для StateManager
     * @returns {Array}
     */
    getSelections() {
        return this.editor ? this.editor.selection.getAllRanges() : [];
    }

    /**
     * Перемещение курсора в позицию (для StateManager)
     * @param {Object} position - Позиция {row, column}
     */
    moveCursorToPosition(position) {
        if (this.editor && position) {
            this.editor.moveCursorTo(position.row, position.column);
            this.editor.clearSelection();
        }
    }

    /**
     * Восстановление выделений (для StateManager)
     * @param {Array} selections - Массив выделений
     */
    restoreSelections(selections) {
        if (!this.editor || !selections || !selections.length) return;
        
        selections.forEach(selection => {
            this.editor.selection.addRange(selection);
        });
    }

    /**
     * Установка колбэка для StateManager
     * @param {Function} callback - Функция обратного вызова StateManager
     */
    setStateManagerCallback(callback) {
        this.stateManagerCallback = callback;
        this.log.debug('Колбэк StateManager установлен');
    }

    /**
     * Перерисовка редактора
     */
    resize() {
        if (this.editor) {
            this.editor.resize();
            this.log.debug('Редактор перерисован');
        }
    }

    /**
     * Уничтожение редактора
     */
    destroy() {
        if (this.editor) {
            // Очистка слушателей событий
            this._eventHandlers.forEach((handler, event) => {
                this.editor.off(event, handler);
            });
            this._eventHandlers.clear();
            
            window.removeEventListener('resize', this.resizeHandler);
            
            // Отмена отложенных вызовов
            this.changeHandler.cancel?.();
            this.resizeHandler.cancel?.();
            
            // Очистка данных
            this.databaseTables = [];
            this.tableColumns = {};
            
            // Очистка колбэка StateManager
            this.stateManagerCallback = null;
            
            this.editor.destroy();
            this.editor = null;
            this.isInitialized = false;
            
            this.log.info('Редактор уничтожен');
        }
    }
}