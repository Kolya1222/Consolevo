import { API_CONFIG } from '../utils/constants.js';
import { 
    getCsrfToken, 
    logger, 
    safeJsonParse, 
    debounce,
    formatExecutionTime,
    generateId
} from '../utils/helpers.js';

/**
 * Клиент для выполнения API запросов к серверу выполнения кода
 * @class ApiClient
 */
export default class ApiClient {
    /**
     * Создает экземпляр API клиента
     * @param {string} executeRoute - URL для выполнения кода
     * @param {string} consoleType - Тип консоли ('php' | 'sql')
     */
    constructor(executeRoute, consoleType) {
        /**
         * Маршрут выполнения кода
         * @type {string}
         */
        this.executeRoute = executeRoute;
        
        /**
         * Тип консоли
         * @type {string}
         */
        this.consoleType = consoleType;
        
        /**
         * Таймаут запросов
         * @type {number}
         */
        this.requestTimeout = API_CONFIG.timeout || 30000;
        
        /**
         * Максимальное количество повторов
         * @type {number}
         */
        this.maxRetries = API_CONFIG.maxRetries || 3;
        
        /**
         * Задержка между повторами
         * @type {number}
         */
        this.retryDelay = API_CONFIG.retryDelay || 1000;
        
        // ИНИЦИАЛИЗАЦИЯ ЛОГГЕРА
        this.log = logger('ApiClient');
        
        /**
         * История запросов для аналитики
         * @type {Array}
         */
        this.requestHistory = [];
        
        /**
         * Максимальный размер истории
         * @type {number}
         */
        this.maxHistorySize = 50;
        
        // ДЕБАУНС ДЛЯ ОПТИМИЗАЦИИ ЛОГГИНГА
        this.logRequest = debounce(this._logRequest.bind(this), 500);
        
        this.log.info('API клиент инициализирован', { 
            route: executeRoute, 
            type: consoleType,
            timeout: this.requestTimeout
        });
    }

    /**
     * @typedef {Object} ExecuteOptions
     * @property {number} [timeout] - Таймаут запроса в миллисекундах
     * @property {number} [retries] - Количество повторов при ошибках
     * @property {function(string): void} [onProgress] - Колбэк для уведомлений о прогрессе
     * @property {string} [requestId] - Уникальный идентификатор запроса
     */

    /**
     * @typedef {Object} PhpExecutionResult
     * @property {boolean} success - Статус выполнения
     * @property {string} output - Вывод кода
     * @property {*} [result] - Результат выполнения (если есть)
     * @property {string} [error] - Сообщение об ошибке
     * @property {number} [line] - Номер строки с ошибкой
     * @property {number} execution_time - Время выполнения в секундах
     * @property {number} memory_usage - Использование памяти в байтах
     */

    /**
     * @typedef {Object} SqlExecutionResult
     * @property {boolean} success - Статус выполнения запроса
     * @property {Array<Object>} [data] - Результирующие данные
     * @property {number} [count] - Количество строк
     * @property {number} [affected_rows] - Количество затронутых строк
     * @property {number} execution_time - Время выполнения в секундах
     * @property {string} [error] - Сообщение об ошибке SQL
     * @property {number} [line] - Номер строки с ошибкой
     */

    /**
     * Выполняет код на сервере
     * @async
     * @param {string} code - Код для выполнения
     * @param {ExecuteOptions} [options] - Дополнительные опции выполнения
     * @returns {Promise<PhpExecutionResult|SqlExecutionResult>} Результат выполнения
     */
    async execute(code, options = {}) {
        const {
            timeout = this.requestTimeout,
            retries = this.maxRetries,
            onProgress = null,
            requestId = generateId('req_')
        } = options;

        const payload = this.buildPayload(code);
        
        this.log.info('Отправка запроса выполнения кода', { 
            type: this.consoleType, 
            requestId,
            codeLength: code.length 
        });

        const startTime = performance.now();

        try {
            const response = await this.makeRequest(payload, timeout, retries, onProgress, requestId);
            const validatedResponse = this.validateResponse(response);
            
            const duration = performance.now() - startTime;
            
            this.logRequest({
                requestId,
                type: this.consoleType,
                success: true,
                duration,
                attempts: 1
            });

            return validatedResponse;
            
        } catch (error) {
            const duration = performance.now() - startTime;
            
            // ОБРАБОТКА HTML ОШИБОК EVOLUTION CMS
            if (error.isHtmlError) {
                this.log.warn('Возвращаем HTML ошибку как результат', { 
                    requestId,
                    htmlLength: error.htmlContent?.length 
                });
                
                // Создаем структурированный ответ с HTML ошибкой
                const htmlErrorResult = {
                    success: false,
                    output: error.htmlContent,
                    error: 'Evolution CMS Error',
                    execution_time: duration / 1000,
                    memory_usage: 0,
                    isHtmlError: true
                };
                
                this.logRequest({
                    requestId,
                    type: this.consoleType,
                    success: false,
                    duration,
                    error: 'Evolution CMS HTML Error',
                    attempts: error.attempts || 1
                });

                return htmlErrorResult;
            }
            
            this.logRequest({
                requestId,
                type: this.consoleType,
                success: false,
                duration,
                error: error.message,
                attempts: error.attempts || 1
            });

            this.log.error('Ошибка выполнения API запроса', { 
                requestId, 
                error: error.message,
                duration: formatExecutionTime(duration)
            });

            throw this.normalizeError(error);
        }
    }

    /**
     * Строит payload для запроса
     * @param {string} code - Код для выполнения
     * @returns {Object} Объект payload
     */
    buildPayload(code) {
        const basePayload = {
            _token: getCsrfToken(),
            timestamp: Date.now()
        };

        if (this.consoleType === 'php') {
            return {
                ...basePayload,
                code: code,
                type: 'php'
            };
        } else {
            return {
                ...basePayload,
                query: code,
                type: 'sql'
            };
        }
    }

    /**
     * Выполняет HTTP запрос с повторами
     * @async
     * @param {Object} payload - Данные запроса
     * @param {number} timeout - Таймаут
     * @param {number} maxRetries - Максимум повторов
     * @param {Function} onProgress - Колбэк прогресса
     * @param {string} requestId - ID запроса
     * @returns {Promise<Object>} Ответ сервера
     */
    async makeRequest(payload, timeout, maxRetries, onProgress, requestId) {
        let lastError;
        let attempts = 0;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            attempts = attempt;
            
            try {
                if (onProgress) {
                    onProgress(`Выполнение... ${attempt}/${maxRetries}`);
                }

                this.log.debug(`Попытка запроса ${attempt}/${maxRetries}`, { requestId });

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(this.executeRoute, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': payload._token,
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                        'X-Request-ID': requestId
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw await this.parseErrorResponse(response);
                }

                const responseData = await response.text();
                return safeJsonParse(responseData, {});
                
            } catch (error) {
                lastError = error;
                lastError.attempts = attempts;
                
                // ОБРАБОТКА HTML ОШИБОК - НЕ ПОВТОРЯЕМ ЗАПРОС
                if (error.isHtmlError) {
                    this.log.warn('HTML ошибка Evolution CMS - пропускаем повторные попытки', { 
                        requestId,
                        status: error.status
                    });
                    throw error;
                }
                
                if (error.name === 'AbortError') {
                    this.log.warn('Таймаут запроса', { requestId, attempt, timeout });
                    throw new Error(`Таймаут запроса (${timeout}ms)`);
                }

                if (attempt < maxRetries) {
                    this.log.warn(`Попытка ${attempt} не удалась`, { 
                        requestId, 
                        error: error.message,
                        nextRetry: this.retryDelay * attempt 
                    });
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }

        throw lastError;
    }

    /**
     * Парсит ошибку из ответа сервера
     * @async
     * @param {Response} response - Объект Response
     * @returns {Promise<Error>} Объект ошибки
     */
    async parseErrorResponse(response) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
            const errorData = await response.text();
            
            // ОБРАБОТКА HTML ОШИБОК EVOLUTION CMS
            if (errorData.includes('Evolution CMS') || errorData.includes('<!DOCTYPE html>')) {
                this.log.warn('Обнаружена HTML ошибка Evolution CMS', { 
                    status: response.status,
                    contentType: response.headers.get('content-type')
                });
                
                // Создаем специальную ошибку с HTML содержимым
                const htmlError = new Error('Evolution CMS HTML Error');
                htmlError.htmlContent = errorData;
                htmlError.isHtmlError = true;
                htmlError.status = response.status;
                throw htmlError;
            }
            
            if (errorData) {
                const parsedError = safeJsonParse(errorData, null);
                if (parsedError && parsedError.error) {
                    errorMessage = parsedError.error;
                } else {
                    errorMessage = errorData.substring(0, 200);
                }
            }
        } catch (parseError) {
            // Если это HTML ошибка - пробрасываем её дальше
            if (parseError.isHtmlError) {
                throw parseError;
            }
            // Используем стандартное сообщение если парсинг не удался
        }
        
        return new Error(errorMessage);
    }

    /**
     * Валидирует ответ сервера
     * @param {Object} response - Ответ сервера
     * @returns {PhpExecutionResult|SqlExecutionResult} Валидированный ответ
     * @throws {Error} Если ответ некорректен
     */
    validateResponse(response) {
        if (!response || typeof response !== 'object') {
            throw new Error('Некорректный формат ответа сервера');
        }

        if (response.success === undefined) {
            throw new Error('Отсутствует поле success в ответе');
        }

        // ВАЛИДАЦИЯ ДЛЯ PHP КОНСОЛИ
        if (this.consoleType === 'php') {
            return {
                success: response.success,
                output: response.output || '',
                result: response.result || null,
                error: response.error || null,
                line: response.line || null,
                execution_time: response.execution_time || 0,
                memory_usage: response.memory_usage || 0
            };
        }

        // ВАЛИДАЦИЯ ДЛЯ SQL КОНСОЛИ
        if (this.consoleType === 'sql') {
            if (response.success) {
                return {
                    success: true,
                    data: response.data || [],
                    count: response.count || 0,
                    affected_rows: response.affected_rows || 0,
                    execution_time: response.execution_time || 0
                };
            } else {
                return {
                    success: false,
                    error: response.error || 'Неизвестная ошибка SQL',
                    line: response.line || null
                };
            }
        }

        throw new Error(`Неизвестный тип консоли: ${this.consoleType}`);
    }

    /**
     * @typedef {Object} NormalizedError
     * @property {boolean} success - Всегда false для ошибок
     * @property {string} error - Сообщение об ошибке
     * @property {'timeout'|'network'|'http'|'unknown'} type - Тип ошибки
     * @property {number} attempts - Количество попыток выполнения
     */

    /**
     * Нормализует ошибку для единообразной обработки
     * @param {Error} error - Исходная ошибка
     * @returns {NormalizedError} Нормализованный объект ошибки
     */
    normalizeError(error) {
        const normalized = {
            success: false,
            error: error.message || 'Неизвестная ошибка',
            type: 'unknown',
            attempts: error.attempts || 1
        };

        if (error.name === 'AbortError') {
            normalized.error = 'Превышено время ожидания ответа от сервера';
            normalized.type = 'timeout';
        } else if (error.message.includes('Failed to fetch')) {
            normalized.error = 'Ошибка сети: невозможно подключиться к серверу';
            normalized.type = 'network';
        } else if (error.message.includes('HTTP')) {
            normalized.error = `Ошибка сервера: ${error.message}`;
            normalized.type = 'http';
        }

        return normalized;
    }

    /**
     * Создает задержку
     * @param {number} ms - Время задержки в миллисекундах
     * @returns {Promise} Promise который разрешится после задержки
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * @typedef {Object} RequestLogData
     * @property {string} requestId - ID запроса
     * @property {string} type - Тип консоли
     * @property {boolean} success - Статус выполнения
     * @property {number} duration - Длительность выполнения в ms
     * @property {number} attempts - Количество попыток
     * @property {string} [error] - Сообщение об ошибке (если есть)
     */

    /**
     * Логирует запрос в историю (с дебаунсом)
     * @private
     * @param {RequestLogData} requestData - Данные запроса для логирования
     */
    _logRequest(requestData) {
        this.requestHistory.unshift(requestData);
        
        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory = this.requestHistory.slice(0, this.maxHistorySize);
        }
        
        this.log.debug('Запрос завершен и залогирован', requestData);
    }

    /**
     * Тестирует соединение с сервером
     * @async
     * @returns {Promise<boolean>} Результат теста
     */
    async testConnection() {
        try {
            const response = await fetch(this.executeRoute, {
                method: 'HEAD',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            return response.ok;
        } catch (error) {
            this.log.error('Ошибка тестирования соединения', { error: error.message });
            return false;
        }
    }

    /**
     * Получает информацию о клиенте
     * @returns {Object} Информация о клиенте
     */
    getRequestInfo() {
        return {
            route: this.executeRoute,
            consoleType: this.consoleType,
            timeout: this.requestTimeout,
            maxRetries: this.maxRetries,
            recentRequests: this.requestHistory.length
        };
    }

    /**
     * @typedef {Object} PerformanceStats
     * @property {number} total - Общее количество запросов
     * @property {number} successful - Количество успешных запросов
     * @property {number} failed - Количество неудачных запросов
     * @property {string} successRate - Процент успешных запросов
     * @property {string} avgDuration - Средняя длительность выполнения
     */

    /**
     * Получает статистику производительности
     * @returns {PerformanceStats} Статистика производительности
     */
    getPerformanceStats() {
        const successful = this.requestHistory.filter(req => req.success);
        const failed = this.requestHistory.filter(req => !req.success);
        
        return {
            total: this.requestHistory.length,
            successful: successful.length,
            failed: failed.length,
            successRate: this.requestHistory.length ? 
                (successful.length / this.requestHistory.length * 100).toFixed(1) + '%' : '0%',
            avgDuration: successful.length ? 
                formatExecutionTime(successful.reduce((sum, req) => sum + req.duration, 0) / successful.length) : '0ms'
        };
    }

    /**
     * Обновляет конфигурацию клиента
     * @param {Object} newConfig - Новая конфигурация
     */
    updateConfig(newConfig) {
        if (newConfig.timeout) this.requestTimeout = newConfig.timeout;
        if (newConfig.maxRetries) this.maxRetries = newConfig.maxRetries;
        if (newConfig.retryDelay) this.retryDelay = newConfig.retryDelay;
        
        this.log.info('Конфигурация API клиента обновлена', newConfig);
    }

    /**
     * Очищает историю запросов
     */
    clearHistory() {
        this.requestHistory = [];
        this.log.info('История запросов API очищена');
    }

    /**
     * Уничтожает клиент и освобождает ресурсы
     */
    destroy() {
        this.log.info('API клиент уничтожен');
        this.requestHistory = [];
    }
}