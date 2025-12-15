import { 
    logger,
    safeJsonParse,
    isEmpty,
    debounce,
    filterByKeyword,
} from '../utils/helpers.js';

/**
 * @typedef {Object} HistoryEntryMetadata
 * @property {number} length - Длина команды в символах
 * @property {number} lines - Количество строк в команде
 * @property {*} [custom] - Пользовательские метаданные
 */

/**
 * @typedef {Object} HistoryEntry
 * @property {string} command - Текст команды
 * @property {number} timestamp - Временная метка создания
 * @property {'php' | 'sql'} consoleType - Тип консоли
 * @property {HistoryEntryMetadata} metadata - Метаданные команды
 */

/**
 * @typedef {Object} HistoryStats
 * @property {number} total - Общее количество команд в истории
 * @property {number} today - Количество команд добавленных сегодня
 * @property {number} maxSize - Максимальный размер истории
 * @property {'php' | 'sql'} consoleType - Тип консоли
 * @property {number} currentPosition - Текущая позиция навигации
 */

/**
 * @typedef {Object} CommandHistoryConfig
 * @property {number} maxHistorySize - Максимальное количество команд в истории
 * @property {string} storageKey - Ключ для хранения в localStorage
 * @property {number} autoSaveDelay - Задержка автосохранения в миллисекундах
 * @property {boolean} preserveCurrent - Сохранять ли текущую команду при навигации
 */

/**
 * Класс для управления историей команд
 * @class CommandHistory
 */
export default class CommandHistory {
    /**
     * Создает экземпляр истории команд
     * @param {'php' | 'sql'} consoleType - Тип консоли
     * @param {number} maxSize - Максимальное количество команд в истории
     */
    constructor(consoleType, maxSize = 50) {
        /** 
         * Тип консоли
         * @type {'php' | 'sql'}
         */
        this.consoleType = consoleType;
        
        /** 
         * Максимальный размер истории
         * @type {number}
         */
        this.maxSize = maxSize;
        
        /** 
         * Массив команд истории
         * @type {HistoryEntry[]}
         */
        this.history = [];
        
        /** 
         * Текущая позиция в истории при навигации
         * @type {number}
         */
        this.position = 0;
        
        /** 
         * Временное сохранение текущей команды при навигации
         * @type {string}
         */
        this.tempCommand = '';
        
        /** 
         * Логгер
         * @type {Object}
         */
        this.log = logger('CommandHistory');
        
        /** 
         * Конфигурация истории
         * @type {CommandHistoryConfig}
         */
        this.config = {
            maxHistorySize: maxSize,
            storageKey: `consolevo_history_${consoleType}`,
            autoSaveDelay: 500,
            preserveCurrent: true
        };
        
        /** 
         * Функция автосохранения с дебаунсом
         * @type {Function}
         */
        this.autoSave = debounce(() => this._save(), this.config.autoSaveDelay);
        
        // Загрузка сохраненной истории
        this.load();
        
        this.log.info('Инициализирован', { 
            type: consoleType,
            maxSize: maxSize,
            loaded: this.history.length
        });
    }

    /**
     * Добавляет команду в историю с метаданными
     * @param {string} command - Команда для добавления
     * @param {Object} [metadata={}] - Дополнительные метаданные
     * @returns {boolean} true если команда добавлена, false если пропущена (дубликат или пустая)
     * @example
     * const history = new CommandHistory('php');
     * history.add('echo "Hello"', { success: true, executionTime: 0.5 });
     */
    add(command, metadata = {}) {
        if (!command || !command.trim()) {
            this.log.debug('Попытка добавить пустую команду');
            return false;
        }

        const trimmedCommand = command.trim();
        
        // ПРОВЕРКА ДУБЛИКАТОВ И ПУСТЫХ КОМАНД
        const lastCommand = this.history[this.history.length - 1];
        if (lastCommand?.command === trimmedCommand) {
            this.log.debug('Дубликат команды, пропускаем', { 
                command: this.truncateCommand(trimmedCommand)
            });
            return false;
        }

        /** @type {HistoryEntry} */
        const historyEntry = {
            command: trimmedCommand,
            timestamp: Date.now(),
            consoleType: this.consoleType,
            metadata: {
                length: trimmedCommand.length,
                lines: trimmedCommand.split('\n').length,
                ...metadata
            }
        };

        this.history.push(historyEntry);
        
        // ОГРАНИЧЕНИЕ РАЗМЕРА ИСТОРИИ
        if (this.history.length > this.config.maxHistorySize) {
            const removed = this.history.shift();
            this.log.debug('Удалена старая команда из истории', {
                command: this.truncateCommand(removed.command),
                total: this.history.length
            });
        }
        
        this.position = this.history.length;
        this.autoSave();
        
        this.log.debug('Команда добавлена в историю', {
            command: this.truncateCommand(trimmedCommand),
            length: trimmedCommand.length,
            total: this.history.length
        });
        
        return true;
    }

    /**
     * Получает предыдущую команду из истории
     * @returns {string} Предыдущая команда или пустая строка если история пуста
     * @example
     * const prevCommand = history.getPrevious(); // Возвращает предыдущую команду
     */
    getPrevious() {
        if (this.history.length === 0) {
            return '';
        }

        // СОХРАНЯЕМ ТЕКУЩУЮ КОМАНДУ ПРИ ПЕРВОМ ПЕРЕХОДЕ
        if (this.position === this.history.length) {
            this.tempCommand = ''; // Можно сохранять текущий текст редактора
        }

        if (this.position > 0) {
            this.position--;
        }
        
        const command = this.history[this.position]?.command || '';
        
        this.log.debug('Навигация назад по истории', {
            position: this.position,
            total: this.history.length,
            command: this.truncateCommand(command)
        });
        
        return command;
    }

    /**
     * Получает следующую команду из истории
     * @returns {string} Следующая команда или пустая строка если достигнут конец истории
     * @example
     * const nextCommand = history.getNext(); // Возвращает следующую команду
     */
    getNext() {
        if (this.history.length === 0) {
            return '';
        }

        if (this.position < this.history.length - 1) {
            this.position++;
            const command = this.history[this.position]?.command || '';
            
            this.log.debug('Навигация вперед по истории', {
                position: this.position,
                total: this.history.length,
                command: this.truncateCommand(command)
            });
            
            return command;
        } else if (this.position === this.history.length - 1) {
            this.position = this.history.length;
            
            this.log.debug('Вернулись к текущей команде');
            
            // ВОЗВРАЩАЕМ СОХРАНЕННУЮ КОМАНДУ ИЛИ ПУСТУЮ СТРОКУ
            return this.tempCommand || '';
        }
        
        return '';
    }

    /**
     * Устанавливает текущую команду для временного сохранения
     * @param {string} command - Текущая команда для сохранения
     * @returns {void}
     */
    setCurrentCommand(command) {
        this.tempCommand = command || '';
    }

    /**
     * Поиск команд в истории по ключевому слову
     * @param {string} query - Поисковый запрос
     * @param {number} limit - Максимальное количество результатов
     * @returns {HistoryEntry[]} Массив найденных команд (от новых к старым)
     * @example
     * const results = history.search('SELECT', 5); // Поиск SQL запросов с SELECT
     */
    search(query, limit = 10) {
        if (!query || !query.trim()) {
            return this.getRecent(limit);
        }

        const results = filterByKeyword(this.history, query.toLowerCase(), ['command']);
        
        this.log.debug('Поиск по истории команд', {
            query: query,
            found: results.length,
            limit: limit
        });
        
        return results.slice(-limit).reverse();
    }

    /**
     * Получает последние команды из истории
     * @param {number} limit - Количество команд для получения
     * @returns {HistoryEntry[]} Массив последних команд (от новых к старым)
     * @example
     * const recent = history.getRecent(10); // 10 последних команд
     */
    getRecent(limit = 10) {
        return this.history.slice(-limit).reverse();
    }

    /**
     * Получает статистику по истории команд
     * @returns {HistoryStats} Статистика истории
     * @example
     * const stats = history.getStats();
     * console.log(stats.total); // Общее количество команд
     */
    getStats() {
        const today = new Date().setHours(0, 0, 0, 0);
        const todayCommands = this.history.filter(cmd => cmd.timestamp >= today);
        
        return {
            total: this.history.length,
            today: todayCommands.length,
            maxSize: this.config.maxHistorySize,
            consoleType: this.consoleType,
            currentPosition: this.position
        };
    }

    /**
     * Очищает историю команд
     * @returns {void}
     * @example
     * history.clear(); // Очищает всю историю
     */
    clear() {
        const count = this.history.length;
        this.history = [];
        this.position = 0;
        this.tempCommand = '';
        
        this._save();
        
        this.log.info('История очищена', { 
            commands: count 
        });
    }

    /**
     * Приватный метод сохранения истории в localStorage
     * @private
     * @returns {void}
     */
    _save() {
        try {
            const data = {
                history: this.history,
                savedAt: Date.now(),
                version: '1.0'
            };
            
            localStorage.setItem(this.config.storageKey, JSON.stringify(data));
            
            this.log.debug('История сохранена', { 
                commands: this.history.length 
            });
        } catch (error) {
            this.log.error('Ошибка сохранения истории', { error: error.message });
        }
    }

    /**
     * Загружает историю из localStorage
     * @returns {void}
     */
    load() {
        try {
            const saved = localStorage.getItem(this.config.storageKey);
            if (isEmpty(saved)) {
                this.log.debug('Нет сохраненной истории');
                return;
            }

            // ИСПОЛЬЗУЕМ safeJsonParse ИЗ HELPERS
            const data = safeJsonParse(saved, {});
            
            if (Array.isArray(data.history)) {
                this.history = data.history;
                this.position = this.history.length;
                
                this.log.debug('История загружена', { 
                    commands: this.history.length 
                });
            }
        } catch (error) {
            this.log.error('Ошибка загрузки истории', { error: error.message });
        }
    }

    /**
     * Обрезает длинную команду для логов
     * @param {string} command - Команда для обрезки
     * @param {number} maxLength - Максимальная длина
     * @returns {string} Обрезанная команда
     * @private
     */
    truncateCommand(command, maxLength = 50) {
        if (!command) return '';
        if (command.length <= maxLength) return command;
        return command.substring(0, maxLength) + '...';
    }

    /**
     * Уничтожает экземпляр истории команд
     * @returns {void}
     */
    destroy() {
        this.log.info('CommandHistory уничтожен', { 
            commands: this.history.length 
        });
        
        // СОХРАНЯЕМ ПЕРЕД УНИЧТОЖЕНИЕМ
        this._save();
    }
}