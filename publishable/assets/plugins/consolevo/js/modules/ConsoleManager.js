import AceEditor from './AceEditor.js';
import OutputManager from './OutputManager.js';
import ApiClient from './ApiClient.js';
import PreferencesManager from './PreferencesManager.js';
import KeyboardManager from './KeyboardManager.js';
import ThemeManager from './ThemeManager.js';
import StateManager from './StateManager.js';
import CommandHistory from './CommandHistory.js';
import HistoryModal from './HistoryModal.js';
import { 
    logger,
    validateCode,
    formatExecutionTime,
    formatMemoryUsage,
    isEmpty
} from '../utils/helpers.js';
import {MODULES_CONFIG} from '../utils/constants.js'

/**
 * Интеллектуальный фасад для управления всеми модулями консоли
 * @class ConsoleManager
 */
export default class ConsoleManager {
    /**
     * Создает экземпляр менеджера консоли
     * @param {Object} config - Конфигурация консоли
     * @param {string} config.executeRoute - URL для выполнения кода
     * @param {string} config.consoleType - Тип консоли ('php' | 'sql')
     */
    constructor(config = {}) {
        /**
         * Конфигурация консоли
         * @type {Object}
         */
        this.config = {
            executeRoute: config.executeRoute,
            consoleType: config.consoleType,
        };
        
        /**
         * Коллекция модулей
         * @type {Object}
         */
        this.modules = {};
        
        /**
         * Флаг выполнения кода
         * @type {boolean}
         */
        this.isExecuting = false;
        
        /**
         * Модальное окно истории
         * @type {HistoryModal|null}
         */
        this.historyModal = null;
        
        /**
         * Кэшированные DOM элементы
         * @type {Object}
         */
        this.domElements = {};
        
        /**
         * Порядок инициализации модулей
         * @type {Array}
         */
        this.initSequence = MODULES_CONFIG.initializationOrder;
        
        /**
         * Идентификатор редактора в ThemeManager
         * @type {string|null}
         */
        this.editorId = null;
        
        // ИНИЦИАЛИЗАЦИЯ ЛОГГЕРА
        this.log = logger('ConsoleManager');
    }

    /**
     * Инициализирует консоль и все модули
     * @async
     * @returns {Promise<void>}
     */
    async init() {
        try {
            await this.initializeModules();
            this.cacheDOMElements();
            this.setupFacadeMethods();
            await this.setupModules();
            this.setupEventListeners();
            this.loadAndApplyPreferences();
            
            this.log.info('ConsoleManager успешно инициализирован');
        } catch (error) {
            this.log.error('Критическая ошибка инициализации', { error: error.message });
            this.handleInitError(error);
        }
    }

    /**
     * Настраивает фасадные методы для всех модулей
     */
    setupFacadeMethods() {
        // THEME MANAGER ПРОКСИ-МЕТОДЫ
        this.applyTheme = (themeId) => this.modules.theme?.applyTheme(themeId, this.editorId);
        this.cycleThemes = () => this.modules.theme?.cycleThemes(this.editorId);
        /**
         * Получает доступные темы с фильтрацией
         * @param {Object} filter - Объект фильтрации тем
         * @param {string} [filter.category] - Категория темы
         * @param {boolean} [filter.dark] - Только темные/светлые темы
         * @returns {Array<string>} Массив идентификаторов тем
         */
        this.getAvailableThemes = (filter = {}) => this.modules.theme?.getThemes(filter) || [];
        this.getActiveTheme = () => this.modules.theme?.getActiveTheme();
        this.resetTheme = () => this.modules.theme?.resetToDefault(this.editorId);
        this.getThemeInfo = (themeId) => this.modules.theme?.getThemeInfo(themeId);

        // OUTPUT MANAGER ПРОКСИ-МЕТОДЫ
        this.addError = (message, context = '') => this.modules.output?.addError(message, context);
        this.addWarning = (message, context = '') => this.modules.output?.addWarning(message, context);
        this.addInfo = (message, isHtml = false) => this.modules.output?.add(message, 'info', isHtml);
        this.addSuccess = (message, isHtml = false) => this.modules.output?.add(message, 'success', isHtml);
        this.addSeparator = () => this.modules.output?.addSeparator();
        this.clearOutput = () => this.modules.output?.clear();
        this.getOutputStats = () => this.modules.output?.getStats() || {};
        this.highlightOutput = (pattern, className) => this.modules.output?.highlightLines(pattern, className);

        // HISTORY MANAGER ПРОКСИ-МЕТОДЫ
        this.clearHistory = () => this.modules.history?.clear();
        this.exportHistory = () => this.modules.history?.export();
        this.getHistoryStats = () => this.modules.history?.getStats() || {};
        this.searchHistory = (pattern) => this.modules.history?.search(pattern) || [];

        // STATE MANAGER ПРОКСИ-МЕТОДЫ
        this.saveState = (key, data) => this.modules.state?.save(key, data);
        this.loadState = (key) => this.modules.state?.load(key);
        this.clearState = (key) => this.modules.state?.clear(key);
        this.getStateKeys = () => this.modules.state?.getKeys() || [];

        // EDITOR MANAGER ПРОКСИ-МЕТОДЫ
        this.getEditorValue = () => this.modules.editor?.getValue() || '';
        this.setEditorValue = (value) => this.modules.editor?.setValue(value);
        this.clearEditor = () => this.modules.editor?.clear();
        this.getEditorStats = () => this.modules.editor?.getStats() || {};

        // PREFERENCES MANAGER ПРОКСИ-МЕТОДЫ
        this.getPreference = (key) => this.modules.preferences?.get(key);
        this.setPreference = (key, value) => this.modules.preferences?.save(key, value);
        this.getAllPreferences = () => this.modules.preferences?.load() || {};
        this.resetPreferences = () => this.modules.preferences?.resetToDefault();

        this.log.info('Фасадные методы настроены для всех модулей');
    }

    /**
     * Инициализирует все модули в заданном порядке
     * @async
     * @returns {Promise<void>}
     */
    async initializeModules() {
        for (const moduleName of this.initSequence) {
            try {
                switch(moduleName) {
                    case 'preferences':
                        this.modules.preferences = new PreferencesManager();
                        this.log.debug('PreferencesManager инициализирован');
                        break;
                        
                    case 'theme':
                        if (!this.modules.preferences) {
                            throw new Error('PreferencesManager требуется для ThemeManager');
                        }
                        this.modules.theme = new ThemeManager(this.modules.preferences);
                        this.log.debug('ThemeManager инициализирован');
                        break;
                        
                    case 'state':
                        this.modules.state = new StateManager(this.config.consoleType);
                        this.log.debug('StateManager инициализирован');
                        break;
                        
                    case 'output':
                        this.modules.output = new OutputManager(this.config.consoleType);
                        this.log.debug('OutputManager инициализирован');
                        break;
                        
                    case 'api':
                        this.modules.api = new ApiClient(this.config.executeRoute, this.config.consoleType);
                        this.log.debug('ApiClient инициализирован');
                        break;
                        
                    case 'editor':
                        this.modules.editor = new AceEditor(this.config.consoleType);
                        await this.modules.editor.init();
                        this.log.debug('AceEditor инициализирован');
                        break;
                        
                    case 'history':
                        this.modules.history = new CommandHistory(this.config.consoleType);
                        this.log.debug('CommandHistory инициализирован');
                        break;
                        
                    case 'keyboard':
                        this.modules.keyboard = new KeyboardManager();
                        this.log.debug('KeyboardManager инициализирован');
                        break;
                        
                    default:
                        this.log.warn('Попытка инициализации неизвестного модуля', { module: moduleName });
                }
            } catch (error) {
                this.log.error(`Ошибка инициализации модуля ${moduleName}`, { error: error.message });
                throw error;
            }
        }
        
        // ИНИЦИАЛИЗАЦИЯ МОДАЛЬНОГО ОКНА ИСТОРИИ
        if (this.modules.history) {
            this.historyModal = new HistoryModal(this.modules.history);
            this.setupHistoryModal();
            this.log.debug('HistoryModal инициализирован');
        }
    }
    
    /**
     * Кэширует DOM элементы для быстрого доступа
     */
    cacheDOMElements() {
        this.domElements = {};
        Object.entries(MODULES_CONFIG.domSelectors).forEach(([key, selector]) => {
            this.domElements[key] = document.querySelector(selector);
        });
        const foundElements = Object.values(this.domElements).filter(Boolean).length;
        
        if (foundElements === 0) {
            this.log.warn('Не найдено ни одного DOM элемента');
        }
    }

    /**
     * Обрабатывает ошибки инициализации
     * @param {Error} error - Объект ошибки
     */
    handleInitError(error) {
        const errorMessage = `Ошибка инициализации консоли: ${error.message}`;
        // Используем прямой вывод в консоль, так как модули могут быть не инициализированы
        console.error(errorMessage);
        if (this.modules.output) {
            this.addError(errorMessage, 'Инициализация');
        }
    }

    /**
     * Настраивает модальное окно истории команд
     */
    setupHistoryModal() {
        if (!this.historyModal) return;
        
        this.historyModal.onUseCommand = (command) => {
            this.setEditorValue(command);
            this.log.debug('Команда из истории применена в редактор');
        };
        
        this.log.debug('HistoryModal настроен');
    }

    /**
     * Настраивает взаимодействие между модулями
     * @async
     * @returns {Promise<void>}
     */
    async setupModules() {
        // ИНТЕГРАЦИЯ КЛАВИАТУРЫ И РЕДАКТОРА
        if (this.modules.keyboard && this.modules.editor) {
            this.editorId = this.modules.keyboard.setupEditorShortcuts(
                this.modules.editor, 
                {
                    onExecute: () => this.executeCode(),
                    onClearConsole: () => this.clearOutput(),
                    onHistoryPrevious: () => this.navigateHistory(-1),
                    onHistoryNext: () => this.navigateHistory(1),
                    onFormatCode: () => this.formatCode(),
                    onClearAll: () => this.clearAll()
                },
                `editor_${this.config.consoleType}`
            );

            // НАСТРОЙКА ГЛОБАЛЬНЫХ ГОРЯЧИХ КЛАВИШ
            this.modules.keyboard.setupGlobalShortcuts({
                onShowHistory: () => this.showHistory(),
                onExport: () => this.exportData(),
                onHelp: () => this.showHelp(),
                onClearAll: () => this.clearAll(),
                onCycleTheme: () => this.cycleThemes()
            });
            
            this.log.debug('Интеграция KeyboardManager с Editor выполнена', { editorId: this.editorId });
        }

        // ИНТЕГРАЦИЯ ТЕМ И РЕДАКТОРА
        if (this.modules.theme && this.modules.editor && this.editorId) {
            const registeredId = this.modules.theme.registerEditor(this.modules.editor, this.editorId);
            
            if (!registeredId) {
                console.error('ThemeManager не зарегистрировал редактор!');
            }
        }

        // НАСТРОЙКА РЕАКТИВНОСТИ НАСТРОЕК
        this.setupPreferencesReactivity();
        
        this.log.info('Все модули успешно интегрированы');
    }

    /**
     * Настраивает реактивность изменений настроек
     */
    setupPreferencesReactivity() {
        if (!this.modules.preferences) {
            this.log.warn('Менеджер настроек недоступен для реактивности');
            return;
        }

        this.modules.preferences.addListener((key, newValue, oldValue) => {
            this.log.debug('Обнаружено изменение настройки', { key, newValue, oldValue });
            
            switch (key) {
                case 'theme':
                    this.handleThemeChange(newValue);
                    break;
                    
                case 'fontSize':
                    this.handleFontSizeChange(newValue);
                    break;
                    
                case 'wrapMode':
                    this.handleWrapModeChange(newValue);
                    break;
                    
                case 'enableAutocomplete':
                    this.handleAutocompleteChange(newValue);
                    break;
                    
                case 'showLineNumbers':
                    this.handleLineNumbersChange(newValue);
                    break;
                    
                case 'highlightActiveLine':
                    this.handleHighlightActiveLineChange(newValue);
                    break;
                    
                default:
                    this.log.debug('Необработанное изменение настройки', { key });
            }
        });
        
        this.log.debug('Реактивность настроек настроена');
    }

    /**
     * Обрабатывает изменение темы
     * @param {string} themeId - Идентификатор темы
     */
    handleThemeChange(themeId) {
        if (this.modules.theme) {
            this.applyTheme(themeId);
            this.log.debug('Тема применена через ThemeManager', { themeId });
        }
        if (this.domElements.themeSelector) {
            this.domElements.themeSelector.value = themeId;
        }
    }

    /**
     * Обрабатывает изменение размера шрифта
     * @param {string} fontSize - Размер шрифта
     */
    handleFontSizeChange(fontSize) {
        if (this.modules.editor) {
            this.modules.editor.changeFontSize(fontSize);
        }
        
        if (this.domElements.fontSizeSelector) {
            const fontSizeString = fontSize + 'px';
            this.domElements.fontSizeSelector.value = fontSizeString;
        } else {
            console.error('❌ fontSizeSelector не найден!');
        }
        this.log.debug('Размер шрифта изменен', { fontSize });
    }

    /**
     * Обрабатывает изменение режима переноса
     * @param {boolean} wrapMode - Включен ли перенос
     */
    handleWrapModeChange(wrapMode) {
        if (this.modules.editor) {
            this.modules.editor.toggleWrapMode(wrapMode);
            this.log.debug('Режим переноса изменен', { wrapMode });
        }
        if (this.domElements.wrapModeToggle) {
            this.domElements.wrapModeToggle.checked = wrapMode;
        }
    }

    /**
     * Обрабатывает изменение автодополнения
     * @param {boolean} enableAutocomplete - Включено ли автодополнение
     */
    handleAutocompleteChange(enableAutocomplete) {
        if (this.modules.editor) {
            this.modules.editor.toggleAutocomplete(enableAutocomplete);
            this.log.debug('Автодополнение изменено', { enableAutocomplete });
        }
    }

    /**
     * Обрабатывает изменение отображения номеров строк
     * @param {boolean} showLineNumbers - Показывать номера строк
     */
    handleLineNumbersChange(showLineNumbers) {
        if (this.modules.editor && this.modules.editor.editor) {
            this.modules.editor.editor.setOption('showLineNumbers', showLineNumbers);
            this.log.debug('Отображение номеров строк изменено', { showLineNumbers });
        }
    }

    /**
     * Обрабатывает изменение подсветки активной строки
     * @param {boolean} highlightActiveLine - Подсвечивать активную строку
     */
    handleHighlightActiveLineChange(highlightActiveLine) {
        if (this.modules.editor && this.modules.editor.editor) {
            this.modules.editor.editor.setOption('highlightActiveLine', highlightActiveLine);
            this.log.debug('Подсветка активной строки изменена', { highlightActiveLine });
        }
    }

    /**
     * Загружает и применяет настройки
     */
    loadAndApplyPreferences() {
        if (!this.modules.preferences || !this.modules.editor) {
            this.log.warn('Не удалось загрузить настройки - отсутствуют модули');
            return;
        }
        
        const prefs = this.modules.preferences.load();
        this.log.debug('Настройки загружены из хранилища', prefs);
        
        // Применяем настройки к редактору
        this.modules.editor.applyPreferences(prefs);
        
        // Применяем тему через ThemeManager
        if (prefs.theme && this.modules.theme) {
            this.applyTheme(prefs.theme);
        }
        
        this.updatePreferenceUI(prefs);
        
        this.log.info('Настройки применены ко всем модулям');
    }

    /**
     * Обновляет UI в соответствии с настройками
     * @param {Object} prefs - Объект настроек
     */
    updatePreferenceUI(prefs) {
        if (prefs.theme && this.domElements.themeSelector) {
            this.domElements.themeSelector.value = prefs.theme;
        }
        
        if (prefs.fontSize && this.domElements.fontSizeSelector) {
            this.domElements.fontSizeSelector.value = prefs.fontSize + 'px';
        }
        
        if (prefs.wrapMode !== undefined && this.domElements.wrapModeToggle) {
            this.domElements.wrapModeToggle.checked = prefs.wrapMode;
        }
        
        this.log.debug('UI обновлен в соответствии с настройками');
    }

    /**
     * Настраивает обработчики событий
     */
    setupEventListeners() {
        this.setupMainEventListeners();
        this.setupEditorSettingsListeners();
        this.setupHistoryButton();
        this.log.debug('Все обработчики событий настроены');
    }

    /**
     * Настраивает основные обработчики событий
     */
    setupMainEventListeners() {
        const { executeBtn, executeEditorBtn, clearConsoleBtn, clearEditorBtn } = this.domElements;
        
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeCode());
        }
        
        if (executeEditorBtn) {
            executeEditorBtn.addEventListener('click', () => this.executeCode());
        }
        
        if (clearConsoleBtn) {
            clearConsoleBtn.addEventListener('click', () => this.clearOutput());
        }
        
        if (clearEditorBtn) {
            clearEditorBtn.addEventListener('click', () => this.clearEditor());
        }
        
        this.log.debug('Основные обработчики событий настроены');
    }

    /**
     * Настраивает обработчики настроек редактора
     */
    setupEditorSettingsListeners() {
        const { themeSelector, fontSizeSelector, wrapModeToggle } = this.domElements;
        
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
                this.setPreference('theme', e.target.value);
            });
        }
        
        if (fontSizeSelector) {
            fontSizeSelector.addEventListener('change', (e) => {
                const fontSizeValue = parseInt(e.target.value);
                this.handleFontSizeChange(fontSizeValue);
                this.setPreference('fontSize', fontSizeValue);
            });
        }
        
        if (wrapModeToggle) {
            wrapModeToggle.addEventListener('change', (e) => {
                this.handleWrapModeChange(e.target.checked);
                this.setPreference('wrapMode', e.target.checked);
            });
        }
        
        this.log.debug('Обработчики настроек редактора настроены');
    }

    /**
     * Настраивает обработчик кнопки истории
     */
    setupHistoryButton() {
        const showHistoryBtn = this.domElements.showHistoryBtn;
        
        if (showHistoryBtn) {
            showHistoryBtn.addEventListener('click', () => {
                this.showHistory();
            });
            
            this.log.debug('Обработчик кнопки истории настроен');
        } else {
            this.log.warn('Кнопка show-history не найдена в DOM');
        }
    }

    /**
     * Обновляет статистику выполнения
     * @param {Object} data - Данные выполнения
     */
    updateStatistics(data) {
        if (data.execution_time && this.domElements.executionTime) {
            const formattedTime = formatExecutionTime(data.execution_time * 1000);
            this.domElements.executionTime.textContent = formattedTime;
            this.domElements.executionTime.style.color = data.execution_time > 1 ? 'var(--warning)' : 'var(--success)';
        }
        
        if (data.memory_usage && this.config.consoleType === 'php' && this.domElements.memoryUsage) {
            const formattedMemory = formatMemoryUsage(data.memory_usage);
            this.domElements.memoryUsage.textContent = formattedMemory;
            this.domElements.memoryUsage.style.color = data.memory_usage > 10 * 1024 * 1024 ? 'var(--warning)' : 'var(--success)';
        }
    }

    /**
     * Показывает модальное окно истории команд
     */
    showHistory() {
        if (this.historyModal) {
            this.historyModal.show();
            this.log.debug('Модальное окно истории показано');
        } else {
            this.addError('Модальное окно истории не инициализировано');
        }
    }

    /**
     * Навигация по истории команд
     * @param {number} direction - Направление (-1: назад, 1: вперед)
     */
    navigateHistory(direction) {
        if (!this.modules.history) {
            this.log.warn('Модуль истории недоступен для навигации');
            return;
        }
        
        const command = direction > 0 
            ? this.modules.history.getNext() 
            : this.modules.history.getPrevious();
        
        if (command !== undefined && command !== '') {
            this.setEditorValue(command);
            
            if (this.modules.editor && this.modules.editor.editor) {
                const lines = command.split('\n');
                this.modules.editor.editor.moveCursorTo(lines.length - 1, lines[lines.length - 1].length);
            }
            
            this.log.debug('Навигация по истории выполнена', { 
                direction, 
                lines: command.split('\n').length,
                commandLength: command.length 
            });
        }
    }

    /**
     * Выполняет код из редактора
     * @async
     * @returns {Promise<void>}
     */
    async executeCode() {
        if (this.isExecuting) {
            this.log.debug('Выполнение уже идет, повторный запрос игнорируется');
            return;
        }
        
        this.isExecuting = true;
        const code = this.getEditorValue();
        
        // ВАЛИДАЦИЯ КОДА ПЕРЕД ВЫПОЛНЕНИЕМ
        const validation = validateCode(code, this.config.consoleType);
        if (!validation.valid) {
            this.addWarning(validation.error, 'Валидация кода');
            this.isExecuting = false;
            return;
        }
        
        // Добавляем ввод в вывод
        this.modules.output.add(code, 'input');
        
        // Сохраняем в историю
        if (this.modules.history) {
            this.modules.history.add(code);
        }
        
        this.log.info('Начало выполнения кода', { 
            type: this.config.consoleType,
            length: code.length,
            lines: code.split('\n').length
        });

        try {
            const result = await this.modules.api.execute(code, {
                onProgress: (message) => {
                    this.addInfo(message);
                }
            });

            // СОХРАНЕНИЕ МЕТАДАННЫХ В ИСТОРИИ
            if (this.modules.history) {
                this.modules.history.add(code, {
                    executionTime: result?.execution_time,
                    success: result?.success,
                    timestamp: Date.now()
                });
            }

            this.handleExecutionResult(result);
            
        } catch (error) {
            this.log.error('Ошибка выполнения кода', { error: error.message });
            this.handleExecutionError(error);
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Обрабатывает результат выполнения кода
     * @param {Object} result - Результат выполнения
     */
    handleExecutionResult(result) {
        if (result && result.success) {
            this.log.info('Код выполнен успешно', { 
                executionTime: result.execution_time,
                hasOutput: !isEmpty(result.output)
            });
            
            if (this.modules.output) {
                this.modules.output.handleSuccess(result, this.config.consoleType);
            }
            
            if (result.execution_time) {
                this.updateStatistics(result);
            }
        } else {
            const errorMessage = result?.error || 'Произошла ошибка выполнения';
            this.log.warn('Ошибка выполнения кода', { 
                error: errorMessage,
                line: result?.line 
            });
            
            this.addError(errorMessage, 'Выполнение кода');
            
            if (result?.line && this.modules.editor) {
                this.modules.editor.addErrorMarker(result.line - 1, errorMessage);
            }
        }
    }

    /**
     * Обрабатывает ошибки выполнения
     * @param {Error} error - Объект ошибки
     */
    handleExecutionError(error) {
        if (error.error) {
            this.addError(`Ошибка выполнения: ${error.error}`);
        } else if (error.message) {
            this.addError(`Ошибка сети: ${error.message}`);
        } else {
            this.addError('Неизвестная ошибка выполнения');
        }
    }

    /**
     * Форматирует код в редакторе
     */
    formatCode() {
        this.log.info('Запрос форматирования кода');
        this.addInfo('Форматирование кода пока не реализовано');
    }

    /**
     * Экспортирует данные
     */
    exportData() {
        this.log.info('Экспорт данных');
        if (this.modules.history) {
            const historyData = this.exportHistory();
            this.addSuccess('История экспортирована (см. консоль разработчика)');
        }
    }

    /**
     * Показывает справку по горячим клавишам
     */
    showHelp() {
        this.log.info('Показ справки');
        const helpText = `
Доступные горячие клавиши:
• Alt+Enter - Выполнить код
• Alt+L - Очистить консоль  
• Alt+Shift+H - Показать историю
• Alt+N - Новая сессия
• Alt+E - Экспорт данных
• Alt+/ - Эта справка
• Alt+Стрелки ↑/↓ - Навигация по истории
• Alt+T - Переключить тему
        `;
        this.addInfo(helpText);
    }

    /**
     * Очищает все данные
     */
    clearAll() {
        this.log.info('Полная очистка всех данных');
        this.clearEditor();
        this.clearOutput();
        this.clearHistory();
        this.addSuccess('Все данные очищены');
    }

    /**
     * Получает общую статистику по всем модулям
     * @returns {Object} Объединенная статистика
     */
    getFullStats() {
        return {
            output: this.getOutputStats(),
            history: this.getHistoryStats(),
            editor: this.getEditorStats(),
            theme: this.modules.theme?.getStats() || {},
            preferences: this.getAllPreferences(),
            consoleType: this.config.consoleType,
            isExecuting: this.isExecuting
        };
    }

    /**
     * Уничтожает консоль и освобождает ресурсы
     */
    destroy() {
        this.log.info('Начало уничтожения ConsoleManager');
        
        // ОЧИСТКА МЕНЕДЖЕРА КЛАВИАТУРЫ
        if (this.modules.keyboard) {
            if (this.editorId) {
                this.modules.keyboard.destroyEditor(this.editorId);
            }
            this.modules.keyboard.destroy();
        }
        
        // ОЧИСТКА ВСЕХ МОДУЛЕЙ
        Object.entries(this.modules).forEach(([name, module]) => {
            if (module && typeof module.destroy === 'function') {
                try {
                    module.destroy();
                    this.log.debug('Модуль уничтожен', { module: name });
                } catch (error) {
                    this.log.error('Ошибка уничтожения модуля', { 
                        module: name, 
                        error: error.message 
                    });
                }
            }
        });
        
        // Очистка DOM слушателей
        Object.values(this.domElements).forEach(element => {
            if (element) {
                element.replaceWith(element.cloneNode(true));
            }
        });
        
        // Отписка от слушателей настроек
        if (this.modules.preferences) {
            this.modules.preferences.removeAllListeners();
        }
        
        // ОЧИСТКА ССЫЛОК
        this.modules = {};
        this.historyModal = null;
        this.domElements = {};
        
        this.log.info('ConsoleManager полностью уничтожен');
    }
}