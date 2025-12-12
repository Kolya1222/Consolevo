// БЕЗОПАСНОСТЬ И ВАЛИДАЦИЯ
export function getCsrfToken() {
    try {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    } catch (error) {
        console.error('Ошибка получения CSRF токена:', error);
        return '';
    }
}

export function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function sanitizeHtml(html) {
    if (!html) return '';
    
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
}

export function isValidJson(str) {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

export function safeJsonParse(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch {
        return defaultValue;
    }
}

// ДЕБАУНС И ТРОТТЛИНГ
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ФОРМАТИРОВАНИЕ
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatExecutionTime(milliseconds) {
    if (milliseconds < 1000) {
        return `${milliseconds.toFixed(2)} ms`;
    } else {
        return `${(milliseconds / 1000).toFixed(3)} s`;
    }
}

export function formatMemoryUsage(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTimestamp(timestamp = Date.now()) {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ACE EDITOR УТИЛИТЫ
export function detectLanguage(code) {
    if (code.includes('<?php') || code.includes('$') && code.includes(';')) {
        return 'php';
    }
    if (code.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i)) {
        return 'sql';
    }
    return 'text';
}

export function getLineCount(code) {
    return code.split('\n').length;
}

export function countWords(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function estimateComplexity(code) {
    const lines = getLineCount(code);
    const words = countWords(code);
    
    if (lines < 10 && words < 50) return 'low';
    if (lines < 50 && words < 200) return 'medium';
    return 'high';
}

// УТИЛИТЫ РАБОТЫ С ДАННЫМИ
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export function mergeObjects(target, source) {
    return { ...target, ...source };
}

export function isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

// ПОИСК И ФИЛЬТРАЦИЯ
export function filterByKeyword(items, keyword, fields = []) {
    if (!keyword) return items;
    
    const searchTerm = keyword.toLowerCase();
    return items.filter(item => {
        return fields.some(field => {
            const value = item[field];
            return value && String(value).toLowerCase().includes(searchTerm);
        });
    });
}

export function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const group = item[key];
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
    }, {});
}

// UI УТИЛИТЫ
export function createElement(tag, classes = '', content = '') {
    const element = document.createElement(tag);
    if (classes) element.className = classes;
    if (content) element.textContent = content;
    return element;
}

export function showNotification(message, type = 'info', duration = 3000) {
    // Можно интегрировать с вашей системой уведомлений
    console.log(`[${type.toUpperCase()}] ${message}`);
}

export function copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
}

// ЛОГГИНГ И ОТЛАДКА
export function logger(module) {
    return {
        info: (message, data) => console.log(`[${module}] ℹ️ ${message}`, data || ''),
        warn: (message, data) => console.warn(`[${module}] ⚠️ ${message}`, data || ''),
        error: (message, data) => console.error(`[${module}] ❌ ${message}`, data || ''),
        debug: (message, data) => console.debug(`[${module}] 🔍 ${message}`, data || '')
    };
}

// ТЕСТИРОВАНИЕ И ВАЛИДАЦИЯ
export function isPhpCode(code) {
    return /<\?php|<\?=|\\$[a-zA-Z_]|\b(echo|function|class|namespace)\b/.test(code);
}

export function isSqlQuery(code) {
    return /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|UNION)\b/i.test(code);
}

export function validateCode(code, type) {
    if (!code.trim()) {
        return { valid: false, error: 'Код не может быть пустым' };
    }
    
    if (type === 'php' && !isPhpCode(code)) {
        return { valid: false, error: 'Не похоже на PHP код' };
    }
    
    if (type === 'sql' && !isSqlQuery(code)) {
        return { valid: false, error: 'Не похоже на SQL запрос' };
    }
    
    return { valid: true };
}

export function escapeSqlIdentifier(identifier) {
    if (!identifier) return '';
    return '`' + identifier.replace(/`/g, '``') + '`';
}

/**
 * Безопасно парсит HTML ошибки Evolution CMS и извлекает информацию
 * @param {string} html - HTML строка с ошибкой
 * @returns {Object} Структурированная информация об ошибке
 */
export function parseEvolutionError(html) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Извлекаем основную информацию об ошибке
        const errorTitle = doc.querySelector('h2')?.textContent?.trim() || 'Evolution CMS Error';
        const errorMessage = doc.querySelector('h3')?.textContent?.trim() || 'Unknown error';
        
        // Извлекаем SQL ошибку
        let sqlError = null;
        const sqlMatch = errorMessage.match(/SQLSTATE\[.*?\]:\s*(.*?)(?:<br>|$)/);
        if (sqlMatch) {
            sqlError = sqlMatch[1].trim();
        }
        
        // Извлекаем бенчмарки
        const benchmarks = {};
        const benchmarkTables = doc.querySelectorAll('table.grid');
        if (benchmarkTables.length >= 2) {
            const benchmarkTable = benchmarkTables[benchmarkTables.length - 1];
            benchmarkTable.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length === 2) {
                    const key = cells[0].textContent.trim();
                    const value = cells[1].textContent.trim();
                    benchmarks[key] = value;
                }
            });
        }
        
        // Извлекаем backtrace
        const backtrace = [];
        const backtraceTable = doc.querySelector('table.grid:last-of-type');
        if (backtraceTable) {
            backtraceTable.querySelectorAll('tr').forEach(row => {
                const trace = row.querySelector('td')?.textContent?.trim();
                if (trace && !trace.includes('Backtrace')) {
                    backtrace.push(trace);
                }
            });
        }
        
        // Извлекаем информацию о запросе
        const requestInfo = {};
        const requestTables = doc.querySelectorAll('table.grid');
        if (requestTables.length > 0) {
            requestTables[0].querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length === 2) {
                    const key = cells[0].textContent.trim();
                    const value = cells[1].textContent.trim();
                    requestInfo[key] = value;
                }
            });
        }
        
        return {
            title: errorTitle,
            message: errorMessage,
            sqlError: sqlError,
            benchmarks: benchmarks,
            backtrace: backtrace.slice(0, 10), // Ограничиваем backtrace
            requestInfo: requestInfo,
            rawHtml: html, // Сохраняем оригинал для дебага
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        // Если парсинг не удался, возвращаем базовую информацию
        return {
            title: 'HTML Parse Error',
            message: 'Не удалось распарсить HTML ошибку',
            rawHtml: html.substring(0, 500) + '...',
            timestamp: new Date().toISOString()
        };
    }
}