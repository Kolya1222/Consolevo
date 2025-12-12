import { 
    logger,
    safeJsonParse,
    isEmpty,
    debounce,
    formatTimestamp,
    filterByKeyword,
} from '../utils/helpers.js';

export default class CommandHistory {
    constructor(consoleType, maxSize = 50) {
        this.consoleType = consoleType;
        this.maxSize = maxSize;
        this.history = [];
        this.position = 0;
        this.tempCommand = ''; // ДЛЯ СОХРАНЕНИЯ ТЕКУЩЕЙ КОМАНДЫ
        this.log = logger('CommandHistory');
        this.config = {
            maxHistorySize: maxSize,
            storageKey: `consolevo_history_${consoleType}`,
            autoSaveDelay: 500,
            preserveCurrent: true
        };
        this.autoSave = debounce(() => this._save(), this.config.autoSaveDelay);
        
        this.load();
        
        this.log.info('Инициализирован', { 
            type: consoleType,
            maxSize: maxSize,
            loaded: this.history.length
        });
    }

    // ДОБАВЛЕНИЕ КОМАНДЫ С МЕТАДАННЫМИ
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

    // НАВИГАЦИЯ ПО ИСТОРИИ С СОХРАНЕНИЕМ ТЕКУЩЕЙ КОМАНДЫ
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

    // УСТАНОВКА ТЕКУЩЕЙ КОМАНДЫ (ДЛЯ СОХРАНЕНИЯ)
    setCurrentCommand(command) {
        this.tempCommand = command || '';
    }

    // ПОИСК ПО ИСТОРИИ
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

    // ПОЛУЧЕНИЕ ПОСЛЕДНИХ КОМАНД
    getRecent(limit = 10) {
        return this.history.slice(-limit).reverse();
    }

    // ПОЛУЧЕНИЕ ВСЕЙ ИСТОРИИ С ФИЛЬТРАЦИЕЙ
    getAll(filterFn = null) {
        let history = [...this.history];
        
        if (filterFn && typeof filterFn === 'function') {
            history = history.filter(filterFn);
        }
        
        return history.reverse(); // НОВЫЕ КОМАНДЫ ПЕРВЫМИ
    }

    // СТАТИСТИКА ИСТОРИИ
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

    // ЭКСПОРТ ИСТОРИИ
    export() {
        const data = {
            history: this.history,
            exportedAt: Date.now(),
            consoleType: this.consoleType,
            version: '1.0'
        };
        
        this.log.debug('История экспортирована', { 
            commands: this.history.length 
        });
        
        return JSON.stringify(data, null, 2);
    }

    // ИМПОРТ ИСТОРИИ
    import(jsonString) {
        try {
            const data = safeJsonParse(jsonString, null);
            if (!data || !Array.isArray(data.history)) {
                throw new Error('Неверный формат данных истории');
            }

            let imported = 0;
            data.history.forEach(entry => {
                if (entry.command && entry.command.trim()) {
                    this.add(entry.command, entry.metadata);
                    imported++;
                }
            });

            this.log.info('История импортирована', { 
                commands: imported 
            });
            
            return imported;
        } catch (error) {
            this.log.error('Ошибка импорта истории', { error: error.message });
            return 0;
        }
    }

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

    // ПРИВАТНЫЙ МЕТОД СОХРАНЕНИЯ
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

    // УТИЛИТЫ
    truncateCommand(command, maxLength = 50) {
        if (!command) return '';
        if (command.length <= maxLength) return command;
        return command.substring(0, maxLength) + '...';
    }

    formatCommandTime(timestamp) {
        return formatTimestamp(timestamp);
    }

    destroy() {
        this.log.info('CommandHistory уничтожен', { 
            commands: this.history.length 
        });
        
        // СОХРАНЯЕМ ПЕРЕД УНИЧТОЖЕНИЕМ
        this._save();
    }
}