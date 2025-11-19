import { PROMPT_SYMBOLS } from '../utils/constants.js';
import {  
    sanitizeHtml, 
    formatExecutionTime, 
    formatMemoryUsage,
    formatTimestamp,
    createElement,
    logger,
    debounce,
    isEmpty,
    parseEvolutionError
} from '../utils/helpers.js';

/**
 * Менеджер вывода консоли - отвечает за отображение сообщений, результатов и управление историей вывода
 * @class OutputManager
 */
export default class OutputManager {
    /**
     * Создает экземпляр менеджера вывода
     * @param {string} consoleType - Тип консоли ('php' | 'sql')
     */
    constructor(consoleType) {
        /**
         * Тип консоли
         * @type {string}
         */
        this.consoleType = consoleType;
        
        /**
         * DOM элемент для вывода
         * @type {HTMLElement|null}
         */
        this.outputElement = document.getElementById('console-output');
        
        /**
         * Максимальное количество строк вывода
         * @type {number}
         */
        this.maxOutputLines = 1000;
        
        /**
         * Текущее количество строк
         * @type {number}
         */
        this.currentLines = 0;
        
        /**
         * Логгер для отладки
         * @type {Function}
         */
        this.log = logger('OutputManager');
        
        /**
         * Дебаунс функция для прокрутки
         * @type {Function}
         */
        this.scrollToBottom = debounce(this._scrollToBottom.bind(this), 50);
        
        this.init();
    }

    /**
     * Инициализирует менеджер вывода
     * @returns {void}
     */
    init() {
        const outputElement = document.getElementById('console-output');
        const initialMessages = outputElement?.dataset.initialMessages;
        
        if (initialMessages) {
            this.showInitialMessages(JSON.parse(initialMessages));
        } else {
            this.showWelcomeMessage();
        }
    }

    /**
     * Показывает приветственное сообщение в зависимости от типа консоли
     * @returns {void}
     */
    showWelcomeMessage() {
        if (this.consoleType === 'php') {
            const welcomeLine1 = this.createOutputLine(
                'PHP консоль готова к работе. Введите код для выполнения.', 
                'info'
            );
            
            const welcomeLine2 = this.createOutputLine(
                'Для выполнения кода нажмите Alt+Enter или кнопку "Выполнить".', 
                'info'
            );
            
            this.outputElement.innerHTML = '';
            this.outputElement.appendChild(welcomeLine1);
            this.outputElement.appendChild(welcomeLine2);
            this.currentLines = 2;
        } else {
            this.add('SQL консоль готова к работе. Введите запрос для выполнения.', 'info');
        }
    }

    /**
     * Добавляет сообщение в вывод консоли
     * @param {string} message - Текст сообщения
     * @param {string} [type='info'] - Тип сообщения ('info' | 'success' | 'warning' | 'error' | 'input')
     * @param {boolean} [isHtml=false] - Является ли сообщение HTML
     * @returns {void}
     */
    add(message, type = 'info', isHtml = false) {
        if (!this.outputElement) {
            this.log.warn('outputElement не доступен');
            return;
        }

        // Защита от переполнения
        if (this.currentLines >= this.maxOutputLines) {
            this.removeOldestLines(100);
        }

        try {
            const line = this.createOutputLine(message, type, isHtml);
            this.outputElement.appendChild(line);
            this.currentLines++;
            
            // Добавляем таймстамп для дебага
            if (type === 'error' || type === 'warning') {
                this.log[type === 'error' ? 'error' : 'warn']('Сообщение вывода', { 
                    type, 
                    message: message.substring(0, 100),
                    timestamp: formatTimestamp() 
                });
            }
            
            this.scrollToBottom();
        } catch (error) {
            this.log.error('Ошибка добавления строки', { error: error.message });
        }
    }

    /**
     * Создает DOM элемент строки вывода
     * @param {string} message - Текст сообщения
     * @param {string} type - Тип сообщения
     * @param {boolean} isHtml - Является ли сообщение HTML
     * @returns {HTMLElement} DOM элемент строки
     */
    createOutputLine(message, type, isHtml) {
        const line = createElement('div', 'console-line fade-in');
        
        const prompt = this.createPrompt(type);
        const content = this.createContent(message, isHtml);
        
        line.appendChild(prompt);
        line.appendChild(content);
        
        // Добавляем data-атрибуты для стилизации и тестирования
        line.setAttribute('data-output-type', type);
        line.setAttribute('data-timestamp', Date.now());
        
        return line;
    }

    /**
     * Создает элемент промпта для строки вывода
     * @param {string} type - Тип сообщения
     * @returns {HTMLElement} DOM элемент промпта
     */
    createPrompt(type) {
        const promptConfig = PROMPT_SYMBOLS[type] || PROMPT_SYMBOLS.info;
        
        const promptElement = createElement('span', `prompt ${promptConfig.class}`);
        
        if (promptConfig.isHtml) {
            promptElement.innerHTML = promptConfig.symbol;
        } else {
            promptElement.textContent = promptConfig.symbol;
        }
        
        promptElement.setAttribute('aria-label', `Тип сообщения: ${type}`);
        promptElement.setAttribute('title', `Тип: ${type}`);
        
        return promptElement;
    }

    /**
     * Создает элемент контента для строки вывода
     * @param {string} message - Текст сообщения
     * @param {boolean} isHtml - Является ли сообщение HTML
     * @returns {HTMLElement} DOM элемент контента
     */
    createContent(message, isHtml) {
        const contentElement = createElement('span', 'output-content');
        
        if (isHtml) {
            contentElement.innerHTML = sanitizeHtml(message);
        } else {
            contentElement.textContent = message;
        }
        
        return contentElement;
    }

    /**
     * Определяет тип контента и обрабатывает соответствующим образом
     * @param {string} content - Контент для анализа
     * @returns {Object} Информация о типе контента
     */
    analyzeContentType(content) {
        const analysis = {
            isHtml: false,
            isEvolutionError: false,
            isSqlError: false,
            contentType: 'text'
        };
        
        // Проверяем на HTML
        if (/<[a-z][\s\S]*>/i.test(content)) {
            analysis.isHtml = true;
            
            // Проверяем на ошибку Evolution CMS
            if (content.includes('Evolution CMS Parse Error') || 
                content.includes('Evolution CMS Content Manager') ||
                content.includes('SQLSTATE[')) {
                analysis.isEvolutionError = true;
                analysis.contentType = 'evolution-error';
            }
            
            // Проверяем на SQL ошибку
            if (content.includes('SQLSTATE') || content.includes('You have an error in your SQL syntax')) {
                analysis.isSqlError = true;
            }
        }
        
        return analysis;
    }
    
    /**
     * Обрабатывает вывод с автоматическим определением типа контента
     * @param {string} content - Контент для вывода
     * @param {string} [type='info'] - Базовый тип сообщения
     * @returns {void}
     */
    addSmart(content, type = 'info') {
        const analysis = this.analyzeContentType(content);
        
        if (analysis.isEvolutionError) {
            this.handleEvolutionError(content);
        } else if (analysis.isHtml) {
            this.addHtmlContent(content, type);
        } else {
            this.add(content, type);
        }
    }
    
    /**
     * Обрабатывает HTML ошибки Evolution CMS
     * @param {string} html - HTML ошибка
     * @returns {void}
     */
    handleEvolutionError(html) {
        try {
            // Парсим ошибку
            const errorInfo = parseEvolutionError(html);
            
            // Создаем контейнер для ошибки
            const errorContainer = createElement('div', 'evolution-error-container fade-in');
            errorContainer.setAttribute('data-error-type', 'evolution-cms');
            errorContainer.setAttribute('data-timestamp', errorInfo.timestamp);
            
            // Заголовок ошибки
            const header = createElement('div', 'error-header');
            const icon = createElement('span', 'error-icon');
            const title = createElement('h3', 'error-title', errorInfo.title);
            header.appendChild(icon);
            header.appendChild(title);
            errorContainer.appendChild(header);
            
            // Основное сообщение
            if (errorInfo.message) {
                const message = createElement('div', 'error-message', errorInfo.message);
                errorContainer.appendChild(message);
            }
            
            // SQL ошибка
            if (errorInfo.sqlError) {
                const sqlContainer = createElement('div', 'error-section');
                const sqlLabel = createElement('strong', '', 'SQL Error: ');
                const sqlText = createElement('code', 'sql-error', errorInfo.sqlError);
                sqlContainer.appendChild(sqlLabel);
                sqlContainer.appendChild(sqlText);
                errorContainer.appendChild(sqlContainer);
            }
            
            // Бенчмарки
            if (errorInfo.benchmarks && Object.keys(errorInfo.benchmarks).length > 0) {
                const benchmarksSection = this.createBenchmarksSection(errorInfo.benchmarks);
                errorContainer.appendChild(benchmarksSection);
            }
            
            // Backtrace
            if (errorInfo.backtrace && errorInfo.backtrace.length > 0) {
                const backtraceSection = this.createBacktraceSection(errorInfo.backtrace);
                errorContainer.appendChild(backtraceSection);
            }
            
            this.outputElement.appendChild(errorContainer);
            this.currentLines++;
            this.scrollToBottom();
            
            this.log.error('Evolution CMS Error processed', {
                title: errorInfo.title,
                hasSqlError: !!errorInfo.sqlError,
                backtraceLength: errorInfo.backtrace?.length || 0
            });
            
        } catch (error) {
            this.log.error('Error processing Evolution error', { error: error.message });
            this.add(`Ошибка обработки HTML ошибки: ${error.message}`, 'error');
        }
    }
    
    /**
     * Создает секцию с бенчмарками
     * @param {Object} benchmarks - Объект с бенчмарками
     * @returns {HTMLElement} DOM элемент секции
     */
    createBenchmarksSection(benchmarks) {
        const section = createElement('div', 'error-section');
        const title = createElement('h4', '', 'Benchmarks');
        section.appendChild(title);
        
        const list = createElement('dl', 'benchmarks-list');
        Object.entries(benchmarks).forEach(([key, value]) => {
            const dt = createElement('dt', '', key);
            const dd = createElement('dd', '', value);
            list.appendChild(dt);
            list.appendChild(dd);
        });
        
        section.appendChild(list);
        return section;
    }
    
    /**
     * Создает секцию с backtrace
     * @param {Array} backtrace - Массив строк backtrace
     * @returns {HTMLElement} DOM элемент секции
     */
    createBacktraceSection(backtrace) {
        const section = createElement('div', 'error-section');
        const title = createElement('h4', '', 'Backtrace');
        section.appendChild(title);
        
        const list = createElement('ol', 'backtrace-list');
        backtrace.slice(0, 8).forEach((trace, index) => {
            const li = createElement('li', 'backtrace-item');
            
            // Упрощаем backtrace для читаемости
            const simplifiedTrace = trace
                .replace(/<strong>.*?<\/strong>/g, '') // Убираем strong теги
                .replace(/\(.*?\) on line \d+/, '') // Упрощаем информацию о файле
                .substring(0, 150); // Ограничиваем длину
            
            li.textContent = simplifiedTrace + (trace.length > 150 ? '...' : '');
            li.setAttribute('title', trace); // Полный текст в tooltip
            
            list.appendChild(li);
        });
        
        section.appendChild(list);
        return section;
    }
    
    /**
     * Обрабатывает обычный HTML контент (не ошибки)
     * @param {string} html - HTML контент
     * @param {string} type - Тип сообщения
     * @returns {void}
     */
    addHtmlContent(html, type) {
        const container = createElement('div', 'html-content-container');
        container.innerHTML = sanitizeHtml(html); // Используем санитизацию для безопасности
        
        this.outputElement.appendChild(container);
        this.currentLines++;
        this.scrollToBottom();
    }

    /**
     * Обрабатывает успешный результат выполнения кода
     * @param {Object} data - Данные результата
     * @param {string} consoleType - Тип консоли
     * @returns {void}
     */
    handleSuccess(data, consoleType) {
        try {
            this.log.info('Обработка успешного результата', { 
                type: consoleType,
                hasOutput: !isEmpty(data.output),
                hasResult: !isEmpty(data.result),
                executionTime: data.execution_time 
            });

            if (consoleType === 'php') {
                this.handlePhpOutput(data);
            } else {
                this.handleSqlOutput(data);
            }
        } catch (error) {
            this.log.error('Ошибка обработки результата', { error: error.message });
            this.add(`Ошибка отображения результата: ${error.message}`, 'error');
        }
    }

    /**
     * Обрабатывает вывод PHP кода
     * @param {Object} data - Данные результата выполнения PHP
     * @returns {void}
     */
    handlePhpOutput(data) {
        let hasOutput = false;

        if (!isEmpty(data.output) && data.output !== 'Код выполнен успешно') {
            this.addSmart(data.output, 'success');
            hasOutput = true;
        }
        
        // Безопасная обработка результата
        if (!isEmpty(data.result) && data.result !== 'null') {
            let displayResult;
            
            if (typeof data.result === 'string') {
                displayResult = data.result;
            } else {
                try {
                    displayResult = JSON.stringify(data.result, null, 2);
                } catch {
                    displayResult = String(data.result);
                }
            }
            
            this.add(`Возвращаемое значение: ${displayResult}`, 'info');
            hasOutput = true;
        }
        
        // Сообщение если вывод пустой
        if (!hasOutput) {
            this.add('Код выполнен успешно (без вывода)', 'success');
        }

        // Форматирование времени и памяти
        if (data.execution_time) {
            const formattedTime = formatExecutionTime(data.execution_time * 1000);
            this.add(`Время выполнения: ${formattedTime}`, 'info');
        }
        
        if (data.memory_usage) {
            const formattedMemory = formatMemoryUsage(data.memory_usage);
            this.add(`Использовано памяти: ${formattedMemory}`, 'info');
        }
    }

    /**
     * Обрабатывает результат SQL запроса
     * @param {Object} data - Данные результата выполнения SQL
     * @returns {void}
     */
    handleSqlOutput(data) {
        const affectedRows = data.affected_rows || data.count || 0;
        this.add(`Запрос выполнен успешно. Затронуто строк: ${affectedRows}`, 'success');
        
        if (data.execution_time) {
            const formattedTime = formatExecutionTime(data.execution_time * 1000);
            this.add(`Время выполнения: ${formattedTime}`, 'info');
        }
        
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            this.displayTable(data.data);
        } else if (data.affected_rows > 0) {
            this.add(`Операция выполнена. Затронуто строк: ${data.affected_rows}`, 'info');
        }
    }

    /**
     * Отображает таблицу с данными SQL запроса
     * @param {Array<Object>} data - Массив объектов с данными
     * @returns {void}
     */
    displayTable(data) {
        try {
            if (!Array.isArray(data) || isEmpty(data)) {
                this.add('Нет данных для отображения', 'warning');
                return;
            }

            this.log.debug('Отображение таблицы', { 
                rows: data.length,
                columns: Object.keys(data[0] || {}).length 
            });

            // Ограничение размера таблицы для производительности
            const displayData = data.length > 100 ? data.slice(0, 100) : data;
            const isTruncated = data.length > 100;

            const container = createElement('div', 'table-container fade-in');
            
            const table = createElement('table', 'result-table');
            table.setAttribute('role', 'grid');
            table.setAttribute('aria-label', 'Результаты запроса');
            
            // Создание заголовков
            const headers = Object.keys(displayData[0] || {});
            const headerRow = createElement('tr');
            
            headers.forEach(header => {
                const th = createElement('th', '', header);
                th.setAttribute('scope', 'col');
                headerRow.appendChild(th);
            });
            
            table.appendChild(headerRow);
            
            // Заполнение данными
            displayData.forEach((row, index) => {
                const tr = createElement('tr');
                headers.forEach(header => {
                    const td = createElement('td');
                    const value = row[header];
                    
                    if (value === null) {
                        td.textContent = 'NULL';
                        td.className = 'null-value';
                    } else if (typeof value === 'object') {
                        td.textContent = JSON.stringify(value, null, 2);
                        td.className = 'json-value';
                    } else {
                        td.textContent = String(value);
                    }
                    
                    tr.appendChild(td);
                });
                table.appendChild(tr);
            });
            
            container.appendChild(table);
            
            // Информация о результате
            const countInfo = createElement('div', 'result-info');
            
            let infoText = `Показано записей: ${displayData.length}`;
            if (isTruncated) {
                infoText += ` (из ${data.length}, показаны первые 100)`;
            }
            
            countInfo.textContent = infoText;
            container.appendChild(countInfo);
            
            this.outputElement.appendChild(container);
            this.currentLines++;
            this.scrollToBottom();
            
        } catch (error) {
            this.log.error('Ошибка создания таблицы', { error: error.message });
            this.add('Ошибка отображения таблицы результатов', 'error');
        }
    }

    /**
     * Очищает весь вывод консоли
     * @returns {void}
     */
    clear() {
        if (!this.outputElement) return;

        this.outputElement.innerHTML = '';
        this.currentLines = 0;
        
        this.log.info('Консоль очищена');
    }

    /**
     * Удаляет самые старые строки вывода
     * @param {number} [count=50] - Количество строк для удаления
     * @returns {void}
     */
    removeOldestLines(count = 50) {
        if (!this.outputElement) return;

        const lines = this.outputElement.querySelectorAll('.console-line, .table-container');
        const removeCount = Math.min(count, lines.length);
        
        this.log.debug('Удаление старых строк', { 
            current: this.currentLines, 
            removing: removeCount 
        });
        
        for (let i = 0; i < removeCount; i++) {
            if (lines[i]) {
                lines[i].remove();
                this.currentLines--;
            }
        }
    }

    /**
     * Прокручивает вывод к нижней части
     * @private
     * @returns {void}
     */
    _scrollToBottom() {
        if (this.outputElement) {
            this.outputElement.scrollTo({
                top: this.outputElement.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    /**
     * Добавляет разделитель в вывод
     * @returns {void}
     */
    addSeparator() {
        const separator = createElement('div', 'output-separator');
        this.outputElement.appendChild(separator);
        this.currentLines++;
        this.scrollToBottom();
    }

    /**
     * Добавляет сообщение об ошибке
     * @param {string} error - Текст ошибки
     * @param {string} [context=''] - Контекст ошибки
     * @returns {void}
     */
    addError(error, context = '') {
        const message = context ? `${context}: ${error}` : error;
        this.addSmart(message, 'error');
    }

    /**
     * Добавляет предупреждение
     * @param {string} warning - Текст предупреждения
     * @param {string} [context=''] - Контекст предупреждения
     * @returns {void}
     */
    addWarning(warning, context = '') {
        const message = context ? `${context}: ${warning}` : warning;
        this.add(message, 'warning');
    }

    /**
     * Возвращает статистику использования вывода
     * @returns {Object} Объект со статистикой
     * @property {number} currentLines - Текущее количество строк
     * @property {number} maxLines - Максимальное количество строк
     * @property {string} usagePercent - Процент использования в формате строки
     * @property {string} consoleType - Тип консоли
     */
    getStats() {
        return {
            currentLines: this.currentLines,
            maxLines: this.maxOutputLines,
            usagePercent: ((this.currentLines / this.maxOutputLines) * 100).toFixed(1) + '%',
            consoleType: this.consoleType
        };
    }

    /**
     * Подсвечивает строки содержащие указанный паттерн
     * @param {string} pattern - Паттерн для поиска
     * @param {string} [className='highlight'] - CSS класс для подсветки
     * @returns {number} Количество подсвеченных строк
     */
    highlightLines(pattern, className = 'highlight') {
        if (!this.outputElement) return 0;
        
        const lines = this.outputElement.querySelectorAll('.output-content');
        let highlighted = 0;
        
        lines.forEach(line => {
            if (line.textContent.includes(pattern)) {
                line.classList.add(className);
                highlighted++;
            }
        });
        
        this.log.debug('Подсветка строк', { pattern, highlighted });
        return highlighted;
    }

    /**
     * Уничтожает менеджер вывода и освобождает ресурсы
     * @returns {void}
     */
    destroy() {
        this.log.info('OutputManager уничтожен');
        this.outputElement = null;
        this.currentLines = 0;
    }
}