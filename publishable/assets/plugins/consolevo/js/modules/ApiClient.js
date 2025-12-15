import { API_CONFIG } from '../utils/constants.js';
import { 
    getCsrfToken, 
    logger, 
    safeJsonParse,
    formatExecutionTime,
} from '../utils/helpers.js';

/**
 * @typedef {Object} ExecuteOptions
 * @property {number} [timeout] - Таймаут запроса в миллисекундах
 * @property {number} [retries] - Количество повторов при ошибках
 * @property {(progress: string) => void} [onProgress] - Колбэк для уведомлений о прогрессе
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
 * @typedef {Object} HtmlError
 * @property {string} htmlContent - HTML содержимое ошибки
 * @property {boolean} isHtmlError - Флаг HTML ошибки
 * @property {number} status - HTTP статус код
 * @property {number} [attempts] - Количество попыток
 */

/**
 * Клиент для выполнения API запросов к серверу выполнения кода
 * @class ApiClient
 */
export default class ApiClient {
    /**
     * Создает экземпляр API клиента
     * @param {string} executeRoute - URL для выполнения кода
     * @param {'php' | 'sql'} consoleType - Тип консоли
     */
    constructor(executeRoute, consoleType) {
        /**
         * Маршрут выполнения кода
         * @type {string}
         */
        this.executeRoute = executeRoute;
        
        /**
         * Тип консоли
         * @type {'php' | 'sql'}
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
        
        /** 
         * Логгер
         * @type {Object}
         * @property {Function} debug - Метод отладки
         * @property {Function} info - Метод информации
         * @property {Function} warn - Метод предупреждения
         * @property {Function} error - Метод ошибки
         */
        this.log = logger('ApiClient');
        
        this.log.info('API клиент инициализирован', { 
            route: executeRoute, 
            type: consoleType,
            timeout: this.requestTimeout
        });
    }

    /**
     * Выполняет код на сервере
     * @async
     * @param {string} code - Код для выполнения
     * @param {ExecuteOptions} [options] - Дополнительные опции выполнения
     * @returns {Promise<PhpExecutionResult|SqlExecutionResult>} Результат выполнения
     * @throws {Error} Если произошла ошибка выполнения запроса
     * @example
     * // Выполнение PHP кода
     * const result = await apiClient.execute('echo "Hello";');
     * 
     * // Выполнение SQL запроса
     * const result = await apiClient.execute('SELECT * FROM users');
     */
    async execute(code, options = {}) {
        const {
            timeout = this.requestTimeout,
            retries = this.maxRetries,
            onProgress = null,
        } = options;

        const payload = this.buildPayload(code);
        
        this.log.info('Отправка запроса выполнения кода', { 
            type: this.consoleType, 
            codeLength: code.length 
        });

        const startTime = performance.now();

        try {
            const response = await this.makeRequest(payload, timeout, retries, onProgress);
            const validatedResponse = this.validateResponse(response);

            return validatedResponse;
            
        } catch (error) {
            const duration = performance.now() - startTime;
            
            // ОБРАБОТКА HTML ОШИБОК EVOLUTION CMS
            if (error.isHtmlError) {
                this.log.warn('Возвращаем HTML ошибку как результат', { 
                    htmlLength: error.htmlContent?.length 
                });
                
                return {
                    success: false,
                    output: error.htmlContent,
                    error: 'Evolution CMS Error',
                    execution_time: duration / 1000,
                    memory_usage: 0,
                    isHtmlError: true
                };
            }

            this.log.error('Ошибка выполнения API запроса', { 
                error: error.message,
                duration: formatExecutionTime(duration)
            });

            return {
                success: false,
                output: '',
                result: null,
                error: error.message,
                line: null,
                execution_time: duration / 1000,
                memory_usage: 0
            };
        }
    }

    /**
     * Строит payload для запроса
     * @param {string} code - Код для выполнения
     * @returns {Object} Объект payload
     * @private
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
     * Выполняет HTTP запрос с умными повторами
     * @async
     * @param {Object} payload - Данные запроса
     * @param {number} timeout - Таймаут в миллисекундах
     * @param {number} maxRetries - Максимальное количество повторов
     * @param {Function} [onProgress] - Колбэк прогресса
     * @returns {Promise<Object>} Ответ сервера
     * @private
     * @throws {Error} Если все попытки запроса завершились неудачей
     */
    async makeRequest(payload, timeout, maxRetries, onProgress) {
        /** @type {Error|HtmlError|null} */
        let lastError = null;
        let attempts = 0;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            attempts = attempt;
            
            try {
                if (onProgress) {
                    onProgress(`Выполнение... ${attempt}/${maxRetries}`);
                }

                this.log.debug(`Попытка запроса ${attempt}/${maxRetries}`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(this.executeRoute, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': payload._token,
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const error = await this.parseErrorResponse(response);
                    
                    // ПРОВЕРКА: СТОИТ ЛИ ПОВТОРЯТЬ ЗАПРОС?
                    if (!this.shouldRetry(error, response.status)) {
                        this.log.warn('Ошибка кода - не повторяем запрос', { 
                            error: error.message, 
                            status: response.status 
                        });
                        throw error;
                    }
                    
                    // Если ошибка временная - продолжаем цикл попыток
                    throw error;
                }

                const responseData = await response.text();
                return safeJsonParse(responseData, {});
                
            } catch (error) {
                lastError = error;
                lastError.attempts = attempts;
                
                // ОБРАБОТКА HTML ОШИБОК - НЕ ПОВТОРЯЕМ ЗАПРОС
                if (error.isHtmlError) {
                    this.log.warn('HTML ошибка Evolution CMS - пропускаем повторные попытки', { 
                        status: error.status
                    });
                    throw error;
                }
                
                // Ошибки таймаута МОЖНО повторять
                if (error.name === 'AbortError') {
                    this.log.warn('Таймаут запроса', { attempt, timeout });
                    if (attempt < maxRetries) {
                        await this.delay(this.retryDelay * attempt);
                        continue;
                    }
                    throw new Error(`Таймаут запроса (${timeout}ms) после ${attempt} попыток`);
                }
                
                // Если shouldRetry уже определил, что повторять не нужно
                if (error.noRetry) {
                    throw error;
                }

                // Все остальные ошибки - пробуем повторить
                if (attempt < maxRetries) {
                    this.log.warn(`Попытка ${attempt} не удалась`, { 
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
     * Определяет, стоит ли повторять запрос при данной ошибке
     * @param {Error} error - Объект ошибки
     * @param {number} statusCode - HTTP статус код
     * @returns {boolean} true - если запрос стоит повторить
     * @private
     */
    shouldRetry(error, statusCode) {
        // Список HTTP статусов, при которых НЕ нужно повторять запрос
        const noRetryStatuses = [400, 422, 500];
        
        // Проверяем сообщение об ошибке на признаки ошибки КОДА (не сервера)
        const errorMessage = error.message.toLowerCase();
        const codeErrorIndicators = [
            'syntax error',
            'parse error',
            'undefined function',
            'too few arguments',
            'too many arguments',
            'expects parameter',
            'unexpected',
            'invalid',
            'call to undefined',
            'class not found'
        ];
        
        // Если HTTP статус говорит об ошибке клиента/кода
        if (noRetryStatuses.includes(statusCode)) {
            // Проверяем, не является ли это временной ошибкой сервера
            // (иногда 500 может быть временным)
            if (statusCode === 500) {
                // Для 500 проверяем текст ошибки
                for (const indicator of codeErrorIndicators) {
                    if (errorMessage.includes(indicator)) {
                        error.noRetry = true; // Помечаем, что не нужно повторять
                        return false;
                    }
                }
                // Если это не ошибка кода, возможно, временная проблема сервера
                // Можно повторить (но с осторожностью)
                return true;
            }
            // Для 400 и 422 явно не повторяем
            error.noRetry = true;
            return false;
        }
        
        // Сетевые ошибки, таймауты, 5xx (кроме определенных выше) - повторяем
        return true;
    }

    /**
     * Парсит ошибку из ответа сервера
     * @async
     * @param {Response} response - Объект Response
     * @returns {Promise<Error|HtmlError>} Объект ошибки или HTML ошибки
     * @private
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
                /** @type {HtmlError} */
                const enhancedError = Object.assign(htmlError, {
                    htmlContent: errorData,
                    isHtmlError: true,
                    status: response.status
                });
                
                throw enhancedError;
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
        }
        
        return new Error(errorMessage);
    }

    /**
     * Валидирует ответ сервера
     * @param {Object} response - Ответ сервера
     * @returns {PhpExecutionResult|SqlExecutionResult} Валидированный ответ
     * @throws {Error} Если ответ некорректен
     * @private
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
     * Создает задержку
     * @param {number} ms - Время задержки в миллисекундах
     * @returns {Promise<void>} Promise который разрешится после задержки
     * @private
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Уничтожает клиент и освобождает ресурсы
     * @returns {void}
     */
    destroy() {
        this.log.info('API клиент уничтожен');
    }
}