import { 
    logger,
    debounce,
    throttle,
    generateId
} from '../utils/helpers.js';

/**
 * @typedef {Object} EditorCallbacks
 * @property {Function} [onExecute] - Выполнение кода
 * @property {Function} [onClearConsole] - Очистка консоли
 * @property {Function} [onHistoryPrevious] - Предыдущая команда из истории
 * @property {Function} [onHistoryNext] - Следующая команда из истории
 * @property {Function} [onFormatCode] - Форматирование кода
 * @property {Function} [onClearAll] - Очистка всего
 */

/**
 * @typedef {Object} GlobalCallbacks
 * @property {Function} [onExecute] - Выполнение кода
 * @property {Function} [onClearConsole] - Очистка консоли
 * @property {Function} [onShowHistory] - Показать историю
 * @property {Function} [onNewSession] - Новая сессия
 * @property {Function} [onExport] - Экспорт
 * @property {Function} [onHelp] - Помощь
 * @property {Function} [onClearAll] - Очистка всего
 * @property {Function} [onCycleTheme] - Переключение темы
 */

/**
 * @typedef {Object} OutputShortcuts
 * @property {Function} [onClearOutput] - Очистка вывода
 * @property {Function} [onExportOutput] - Экспорт вывода
 * @property {Function} [onSearchOutput] - Поиск по выводу
 * @property {Function} [onIncreaseFont] - Увеличить шрифт
 * @property {Function} [onDecreaseFont] - Уменьшить шрифт
 * @property {Function} [onToggleWrap] - Переключение переноса текста
 */

/**
 * @typedef {Object} KeyboardConfig
 * @property {number} debounceDelay - Задержка дебаунса в мс
 * @property {number} throttleDelay - Задержка троттлинга в мс
 * @property {number} maxShortcutLength - Максимальная длина комбинации клавиш
 */

/**
 * Менеджер горячих клавиш для управления редактором и приложением
 * @class KeyboardManager
 */
export default class KeyboardManager {
    /**
     * Создает экземпляр KeyboardManager
     */
    constructor() {
        /** @type {Object} Логгер */
        this.log = logger('KeyboardManager');
        
        /** @type {KeyboardConfig} Конфигурация менеджера */
        this.config = {
            debounceDelay: 100,
            throttleDelay: 50,
            maxShortcutLength: 3
        };
        
        /** @type {Map<string, Function>} Зарегистрированные команды */
        this.commands = new Map();
        
        /** @type {Set<Function>} Глобальные обработчики событий */
        this.globalHandlers = new Set();
        
        /** @type {Map<string, Object>} Экземпляры редакторов */
        this.editorInstances = new Map();
        
        /** @type {OutputShortcuts|null} Горячие клавиши для управления выводом */
        this.outputShortcuts = null;
        
        this.log.info('Инициализирован');
    }

    /**
     * Регистрирует горячие клавиши для управления выводом
     * @param {OutputShortcuts} callbacks - Колбэки для управления выводом
     * @returns {boolean} Успешность регистрации
     */
    registerOutputShortcuts(callbacks) {
        this.outputShortcuts = callbacks;
        
        this.log.debug('Зарегистрированы горячие клавиши для вывода', {
            hasClear: !!callbacks.onClearOutput,
            hasExport: !!callbacks.onExportOutput,
            hasSearch: !!callbacks.onSearchOutput,
            hasFontControls: !!callbacks.onIncreaseFont
        });

        return true;
    }

    /**
     * Настраивает горячие клавиши для редактора
     * @param {Object} editor - Экземпляр редактора
     * @param {EditorCallbacks} callbacks - Колбэки редактора
     * @param {string} [editorId=null] - ID редактора
     * @returns {string} ID редактора
     */
    setupEditorShortcuts(editor, callbacks, editorId = null) {
        if (!editor || !editor.editor) {
            this.log.warn('Редактор не передан для настройки горячих клавиш');
            return;
        }

        const editorKey = editorId || generateId('editor_');
        const commands = editor.editor.commands;
        
        this.log.debug('Настройка горячих клавиш редактора', { editorId: editorKey });

        this.cleanupEditorCommands(editorKey);

        const editorCommands = [];

        // ВЫПОЛНЕНИЕ КОДА
        if (callbacks.onExecute) {
            const executeCommand = {
                name: `executeCode_${editorKey}`,
                bindKey: { win: 'Alt-Enter', mac: 'Alt-Enter' },
                exec: this.createDebouncedHandler(callbacks.onExecute, 'execute')
            };
            
            commands.addCommand(executeCommand);
            editorCommands.push(executeCommand.name);
        }

        // ОЧИСТКА КОНСОЛИ
        if (callbacks.onClearConsole) {
            const clearCommand = {
                name: `clearConsole_${editorKey}`,
                bindKey: { win: 'Alt-L', mac: 'Alt-L' },
                exec: callbacks.onClearConsole
            };
            
            commands.addCommand(clearCommand);
            editorCommands.push(clearCommand.name);
        }

        // ИСТОРИЯ КОМАНД
        if (callbacks.onHistoryPrevious) {
            const historyPrevCommand = {
                name: `historyPrevious_${editorKey}`,
                bindKey: { win: 'Alt-Up', mac: 'Alt-Up' },
                exec: this.createThrottledHandler(callbacks.onHistoryPrevious, 'history_prev')
            };
            
            commands.addCommand(historyPrevCommand);
            editorCommands.push(historyPrevCommand.name);
        }

        if (callbacks.onHistoryNext) {
            const historyNextCommand = {
                name: `historyNext_${editorKey}`,
                bindKey: { win: 'Alt-Down', mac: 'Alt-Down' },
                exec: this.createThrottledHandler(callbacks.onHistoryNext, 'history_next')
            };
            
            commands.addCommand(historyNextCommand);
            editorCommands.push(historyNextCommand.name);
        }

        // ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ
        if (callbacks.onFormatCode) {
            const formatCommand = {
                name: `formatCode_${editorKey}`,
                bindKey: { win: 'Ctrl-Shift-F', mac: 'Command-Shift-F' },
                exec: callbacks.onFormatCode
            };
            
            commands.addCommand(formatCommand);
            editorCommands.push(formatCommand.name);
        }

        //ОЧИСТКА ВСЕГО
        if (callbacks.onClearAll) {
            const clearAllCommand = {
                name: `clearAll_${editorKey}`,
                bindKey: { win: 'Alt-Shift-L', mac: 'Alt-Shift-L' },
                exec: callbacks.onClearAll
            };
            
            commands.addCommand(clearAllCommand);
            editorCommands.push(clearAllCommand.name);
        }

        this.editorInstances.set(editorKey, {
            editor,
            commands: editorCommands,
            callbacks
        });

        this.log.info('Горячие клавиши редактора настроены', { 
            editor: editorKey,
            commands: editorCommands.length
        });

        return editorKey;
    }

    /**
     * Настраивает глобальные горячие клавиши
     * @param {GlobalCallbacks} callbacks - Колбэки глобальных команд
     */
    setupGlobalShortcuts(callbacks) {
        this.log.debug('Настройка глобальных горячих клавиш');

        const globalHandler = (e) => {
            if (this.shouldIgnoreEvent(e)) {
                return;
            }

            const key = e.key.toLowerCase();
            const isCtrl = e.ctrlKey || e.metaKey;
            const isShift = e.shiftKey;
            const isAlt = e.altKey;

            const useAlt = isAlt && !isCtrl;

            // ОСНОВНЫЕ КОМАНДЫ РЕДАКТОРА
            if (useAlt && key === 'enter' && callbacks.onExecute) {
                e.preventDefault();
                this.log.debug('Глобальная команда: выполнить код');
                callbacks.onExecute();
                return;
            }

            if (useAlt && key === 'l' && callbacks.onClearConsole) {
                e.preventDefault();
                this.log.debug('Глобальная команда: очистить консоль');
                callbacks.onClearConsole();
                return;
            }

            if (useAlt && isShift && key === 'h' && callbacks.onShowHistory) {
                e.preventDefault();
                this.log.debug('Глобальная команда: показать историю');
                callbacks.onShowHistory();
                return;
            }

            if (useAlt && key === 'n' && callbacks.onNewSession) {
                e.preventDefault();
                this.log.debug('Глобальная команда: новая сессия');
                callbacks.onNewSession();
                return;
            }

            if (useAlt && key === 'e' && callbacks.onExport) {
                e.preventDefault();
                this.log.debug('Глобальная команда: экспорт');
                callbacks.onExport();
                return;
            }

            if (useAlt && key === '/' && callbacks.onHelp) {
                e.preventDefault();
                this.log.debug('Глобальная команда: помощь');
                callbacks.onHelp();
                return;
            }

            if (useAlt && isShift && key === 'l' && callbacks.onClearAll) {
                e.preventDefault();
                this.log.debug('Глобальная команда: очистить всё');
                callbacks.onClearAll();
                return;
            }

            // ПЕРЕКЛЮЧЕНИЕ ТЕМ
            if (useAlt && key === 't' && callbacks.onCycleTheme) {
                e.preventDefault();
                this.log.debug('Глобальная команда: переключить тему');
                callbacks.onCycleTheme();
                return;
            }

            // КОМАНДЫ ДЛЯ OUTPUT MANAGER (ВСЕ НА ALT)
            if (this.outputShortcuts) {
                // Alt+L - Очистка вывода
                if (useAlt && key === 'l' && this.outputShortcuts.onClearOutput) {
                    e.preventDefault();
                    this.log.debug('Глобальная команда: очистить вывод (Alt+L)');
                    this.outputShortcuts.onClearOutput();
                    return;
                }

                // Alt+E - Экспорт вывода
                if (useAlt && key === 'e' && this.outputShortcuts.onExportOutput) {
                    e.preventDefault();
                    this.log.debug('Глобальная команда: экспорт вывода');
                    this.outputShortcuts.onExportOutput();
                    return;
                }

                // Alt+F - Поиск по выводу
                if (useAlt && key === 'f' && this.outputShortcuts.onSearchOutput) {
                    e.preventDefault();
                    this.log.debug('Глобальная команда: поиск по выводу');
                    this.outputShortcuts.onSearchOutput();
                    return;
                }

                // Alt+Plus - Увеличить шрифт вывода
                if (useAlt && (key === '+' || key === '=') && this.outputShortcuts.onIncreaseFont) {
                    e.preventDefault();
                    this.log.debug('Глобальная команда: увеличить шрифт вывода');
                    this.outputShortcuts.onIncreaseFont();
                    return;
                }

                // Alt+Minus - Уменьшить шрифт вывода
                if (useAlt && key === '-' && this.outputShortcuts.onDecreaseFont) {
                    e.preventDefault();
                    this.log.debug('Глобальная команда: уменьшить шрифт вывода');
                    this.outputShortcuts.onDecreaseFont();
                    return;
                }

                // Alt+W - Переключение переноса текста
                if (useAlt && key === 'w' && this.outputShortcuts.onToggleWrap) {
                    e.preventDefault();
                    this.log.debug('Глобальная команда: переключить перенос текста');
                    this.outputShortcuts.onToggleWrap();
                    return;
                }
            }
        };

        document.addEventListener('keydown', globalHandler);
        this.globalHandlers.add(globalHandler);

        this.log.info('Глобальные горячие клавиши настроены', {
            handlers: this.globalHandlers.size,
            hasOutputShortcuts: !!this.outputShortcuts
        });
    }

    /**
     * Возвращает информацию о зарегистрированных командах
     * @returns {Object} Информация о командах
     */    
    getCommandsInfo() {
        const info = {
            globalHandlers: this.globalHandlers.size,
            editorInstances: this.editorInstances.size,
            hasOutputShortcuts: !!this.outputShortcuts,
            config: this.config
        };

        const editors = {};
        this.editorInstances.forEach((data, key) => {
            editors[key] = {
                commands: data.commands.length,
                hasCallbacks: !!data.callbacks
            };
        });

        info.editors = editors;

        if (this.outputShortcuts) {
            info.outputShortcuts = {
                hasClear: !!this.outputShortcuts.onClearOutput,
                hasExport: !!this.outputShortcuts.onExportOutput,
                hasSearch: !!this.outputShortcuts.onSearchOutput,
                hasFontControls: !!this.outputShortcuts.onIncreaseFont,
                hasWrapToggle: !!this.outputShortcuts.onToggleWrap
            };
        }

        return info;
    }

    /**
     * Добавляет пользовательскую команду к редактору
     * @param {string} editorKey - ID редактора
     * @param {Object} commandConfig - Конфигурация команды
     * @param {string} commandConfig.name - Название команды
     * @param {Object} commandConfig.bindKey - Сочетание клавиш {win: string, mac: string}
     * @param {Function} commandConfig.exec - Функция-исполнитель
     * @returns {string|boolean} ID команды или false при ошибке
     */
    addCustomCommand(editorKey, commandConfig) {
        const editorData = this.editorInstances.get(editorKey);
        if (!editorData) {
            this.log.warn('Попытка добавить команду к несуществующему редактору', { editorKey });
            return false;
        }

        try {
            const commandName = `custom_${generateId('cmd_')}`;
            const command = {
                name: commandName,
                ...commandConfig
            };

            editorData.editor.editor.commands.addCommand(command);
            editorData.commands.push(commandName);

            this.log.debug('Добавлена кастомная команда', {
                editor: editorKey,
                command: commandConfig.bindKey,
                name: commandName
            });

            return commandName;
        } catch (error) {
            this.log.error('Ошибка добавления кастомной команды', {
                editor: editorKey,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Очищает все команды редактора
     * @param {string} editorKey - ID редактора
     */
    cleanupEditorCommands(editorKey) {
        const editorData = this.editorInstances.get(editorKey);
        if (!editorData) return;

        const commands = editorData.editor.editor.commands;
        
        editorData.commands.forEach(commandName => {
            this.removeCommand(commands, commandName);
        });

        editorData.commands = [];
        
        this.log.debug('Команды редактора очищены', { editor: editorKey });
    }

    /**
     * Удаляет команду из менеджера команд редактора
     * @param {Object} commands - Менеджер команд Ace Editor
     * @param {string} name - Название команды для удаления
     */
    removeCommand(commands, name) {
        try {
            commands.removeCommand(name);
        } catch (error) {
            this.log.debug('Команда не найдена при удалении', { command: name });
        }
    }

    /**
     * Создает обработчик с дебаунсом
     * @param {Function} handler - Оригинальный обработчик
     * @param {string} actionName - Название действия для логирования
     * @returns {Function} Обработчик с дебаунсом
     */
    createDebouncedHandler(handler, actionName) {
        return debounce((...args) => {
            this.log.debug('Выполнение команды (дебаунс)', { action: actionName });
            handler(...args);
        }, this.config.debounceDelay);
    }

    /**
     * Создает обработчик с троттлингом
     * @param {Function} handler - Оригинальный обработчик
     * @param {string} actionName - Название действия для логирования
     * @returns {Function} Обработчик с троттлингом
     */
    createThrottledHandler(handler, actionName) {
        return throttle((...args) => {
            this.log.debug('Выполнение команды (троттлинг)', { action: actionName });
            handler(...args);
        }, this.config.throttleDelay);
    }

    /**
     * Проверяет, нужно ли игнорировать событие клавиатуры
     * @param {KeyboardEvent} e - Событие клавиатуры
     * @returns {boolean} true если событие нужно игнорировать
     */
    shouldIgnoreEvent(e) {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        const isInput = tagName === 'input' || tagName === 'textarea';
        const isContentEditable = target.isContentEditable;
        
        return isInput || isContentEditable;
    }

    /**
     * Уничтожает редактор и все связанные с ним команды
     * @param {string} editorKey - ID редактора
     */
    destroyEditor(editorKey) {
        this.cleanupEditorCommands(editorKey);
        this.editorInstances.delete(editorKey);
        
        this.log.debug('Редактор удален из KeyboardManager', { editor: editorKey });
    }

    /**
     * Полностью уничтожает KeyboardManager, очищая все обработчики и команды
     */
    destroy() {
        this.log.info('Уничтожение KeyboardManager');
        
        this.editorInstances.forEach((_, key) => {
            this.destroyEditor(key);
        });

        this.globalHandlers.forEach(handler => {
            document.removeEventListener('keydown', handler);
        });
        this.globalHandlers.clear();

        this.outputShortcuts = null;

        this.log.info('KeyboardManager уничтожен');
    }
}