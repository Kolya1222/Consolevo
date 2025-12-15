import AceEditor from './AceEditor.js';
import OutputManager from './OutputManager.js';
import ApiClient from './ApiClient.js';
import PreferencesManager from './PreferencesManager.js';
import StateManager from './StateManager.js';
import CommandHistory from './CommandHistory.js';
import HistoryModal from './HistoryModal.js';
import { 
    logger,
    validateCode,
    formatExecutionTime,
    formatMemoryUsage
} from '../utils/helpers.js';
import { MODULES_CONFIG } from '../utils/constants.js';

/**
 * @typedef {Object} ConsoleManagerConfig
 * @property {string} executeRoute - URL для выполнения кода
 * @property {'php' | 'sql'} consoleType - Тип консоли
 */

/**
 * @typedef {Object} ConsoleManagerModules
 * @property {PreferencesManager} preferences - Менеджер настроек
 * @property {StateManager} state - Менеджер состояния
 * @property {OutputManager} output - Менеджер вывода
 * @property {ApiClient} api - API клиент
 * @property {AceEditor} editor - Редактор кода
 * @property {CommandHistory} history - История команд
 */

/**
 * @typedef {Object} DOMElements
 * @property {HTMLButtonElement|null} executeBtn - Кнопка выполнения
 * @property {HTMLButtonElement|null} executeEditorBtn - Кнопка выполнения в редакторе
 * @property {HTMLButtonElement|null} clearConsoleBtn - Кнопка очистки консоли
 * @property {HTMLButtonElement|null} clearEditorBtn - Кнопка очистки редактора
 * @property {HTMLSelectElement|null} themeSelector - Селектор темы
 * @property {HTMLSelectElement|null} fontSizeSelector - Селектор размера шрифта
 * @property {HTMLInputElement|null} wrapModeToggle - Переключатель переноса строк
 * @property {HTMLButtonElement|null} showHistoryBtn - Кнопка показа истории
 * @property {HTMLElement|null} executionTime - Элемент времени выполнения
 * @property {HTMLElement|null} memoryUsage - Элемент использования памяти
 */

/**
 * Интеллектуальный фасад для управления всеми модулями консоли
 * @class ConsoleManager
 */
export default class ConsoleManager {
    /**
     * Создает экземпляр менеджера консоли
     * @param {ConsoleManagerConfig} config - Конфигурация менеджера
     */
    constructor(config = {}) {
        /**
         * Конфигурация менеджера
         * @type {ConsoleManagerConfig}
         */
        this.config = {
            executeRoute: config.executeRoute,
            consoleType: config.consoleType,
        };
        
        /**
         * Загруженные модули
         * @type {ConsoleManagerModules}
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
         * @type {DOMElements}
         */
        this.domElements = {};
        
        /**
         * Последовательность инициализации модулей
         * @type {string[]}
         */
        this.initSequence = [
            'preferences',
            'state',
            'output', 
            'api',
            'editor',
            'history'
        ];
        
        /**
         * Логгер
         * @type {Object}
         */
        this.log = logger('ConsoleManager');
    }

    /**
     * Инициализирует ConsoleManager и все его модули
     * @async
     * @returns {Promise<void>}
     * @throws {Error} При критической ошибке инициализации
     * @example
     * const consoleManager = new ConsoleManager({
     *   executeRoute: '/api/execute',
     *   consoleType: 'php'
     * });
     * await consoleManager.init();
     */
    async init() {
        try {
            this.setupFacadeMethods();
            await this.initializeModules();
            this.cacheDOMElements();
            this.loadAndApplyPreferences();
            await this.restoreEditorState();
            this.setupEventListeners();
            this.log.info('ConsoleManager успешно инициализирован');
        } catch (error) {
            this.log.error('Критическая ошибка инициализации', { error: error.message });
            this.handleInitError(error);
        }
    }

    /**
     * Настраивает фасадные методы для удобного доступа к функциональности модулей
     * @returns {void}
     * @private
     */
    setupFacadeMethods() {
        // EDITOR METHODS
        /**
         * Применяет тему к редактору
         * @method ConsoleManager#applyTheme
         * @param {string} themeId - Идентификатор темы
         * @returns {boolean} true если тема применена успешно
         */
        this.applyTheme = (themeId) => {
            if (this.modules.editor) {
                this.modules.editor.setTheme(themeId);
                this.setPreference('theme', themeId);
                this.log.debug('Тема применена', { themeId });
                return true;
            }
            return false;
        };

        // OUTPUT MANAGER METHODS
        /**
         * Добавляет сообщение об ошибке
         * @method ConsoleManager#addError
         * @param {string} message - Сообщение об ошибке
         * @param {string} [context=''] - Контекст ошибки
         * @returns {void}
         */
        this.addError = (message, context = '') => this.modules.output?.addError(message, context);
        
        /**
         * Добавляет предупреждение
         * @method ConsoleManager#addWarning
         * @param {string} message - Текст предупреждения
         * @param {string} [context=''] - Контекст предупреждения
         * @returns {void}
         */
        this.addWarning = (message, context = '') => this.modules.output?.addWarning(message, context);
        
        /**
         * Добавляет информационное сообщение
         * @method ConsoleManager#addInfo
         * @param {string} message - Текст сообщения
         * @param {boolean} [isHtml=false] - Является ли сообщение HTML
         * @returns {void}
         */
        this.addInfo = (message, isHtml = false) => this.modules.output?.add(message, 'info', isHtml);
        
        /**
         * Добавляет сообщение об успехе
         * @method ConsoleManager#addSuccess
         * @param {string} message - Текст сообщения
         * @param {boolean} [isHtml=false] - Является ли сообщение HTML
         * @returns {void}
         */
        this.addSuccess = (message, isHtml = false) => this.modules.output?.add(message, 'success', isHtml);
        
        /**
         * Очищает вывод консоли
         * @method ConsoleManager#clearOutput
         * @returns {void}
         */
        this.clearOutput = () => this.modules.output?.clear();

        // HISTORY MANAGER METHODS
        /**
         * Очищает историю команд
         * @method ConsoleManager#clearHistory
         * @returns {void}
         */
        this.clearHistory = () => this.modules.history?.clear();
        
        /**
         * Экспортирует историю команд
         * @method ConsoleManager#exportHistory
         * @returns {void}
         */
        this.exportHistory = () => this.modules.history?.export();

        // STATE MANAGER METHODS
        /**
         * Сохраняет состояние редактора
         * @method ConsoleManager#saveEditorState
         * @returns {boolean} true если состояние сохранено успешно
         */
        this.saveEditorState = () => {
            if (!this.modules.state || !this.modules.editor) return false;
            
            const content = this.getEditorValue();
            const cursor = this.modules.editor.getCursorPosition?.();
            const selections = this.modules.editor.getSelections?.() || [];
            
            return this.modules.state.saveState(content, cursor, selections, {
                consoleType: this.config.consoleType
            });
        };
        
        /**
         * Очищает состояние редактора
         * @method ConsoleManager#clearEditorState
         * @returns {void}
         */
        this.clearEditorState = () => this.modules.state?.clearState();

        // EDITOR METHODS
        /**
         * Получает содержимое редактора
         * @method ConsoleManager#getEditorValue
         * @returns {string} Содержимое редактора или пустая строка
         */
        this.getEditorValue = () => this.modules.editor?.getValue() || '';
        
        /**
         * Устанавливает содержимое редактора
         * @method ConsoleManager#setEditorValue
         * @param {string} value - Новое содержимое редактора
         * @returns {void}
         */
        this.setEditorValue = (value) => this.modules.editor?.setValue(value);
        
        /**
         * Очищает редактор
         * @method ConsoleManager#clearEditor
         * @returns {void}
         */
        this.clearEditor = () => this.modules.editor?.clear();

        // PREFERENCES METHODS
        /**
         * Сохраняет настройку
         * @method ConsoleManager#setPreference
         * @param {string} key - Ключ настройки
         * @param {*} value - Значение настройки
         * @returns {void}
         */
        this.setPreference = (key, value) => this.modules.preferences?.save(key, value);

        this.log.info('Фасадные методы настроены');
    }

    /**
     * Инициализирует все модули в определенной последовательности
     * @async
     * @returns {Promise<void>}
     * @private
     * @throws {Error} Если не удалось инициализировать модуль
     */
    async initializeModules() {
        for (const moduleName of this.initSequence) {
            try {
                switch(moduleName) {
                    case 'preferences':
                        this.modules.preferences = new PreferencesManager();
                        break;
                    case 'state':
                        this.modules.state = new StateManager(this.config.consoleType);
                        break;
                    case 'output':
                        this.modules.output = new OutputManager(this.config.consoleType);
                        break;
                    case 'api':
                        this.modules.api = new ApiClient(this.config.executeRoute, this.config.consoleType);
                        break;
                    case 'editor':
                        this.modules.editor = new AceEditor(this.config.consoleType);
                        await this.modules.editor.init();
                        break;
                    case 'history':
                        this.modules.history = new CommandHistory(this.config.consoleType);
                        break;
                    default:
                        this.log.warn('Неизвестный модуль', { module: moduleName });
                }
            } catch (error) {
                this.log.error(`Ошибка инициализации ${moduleName}`, { error: error.message });
                throw error;
            }
        }
        
        if (this.modules.history) {
            this.historyModal = new HistoryModal(this.modules.history);
            this.setupHistoryModal();
        }
    }
    
    /**
     * Кэширует DOM элементы для быстрого доступа
     * @returns {void}
     * @private
     */
    cacheDOMElements() {
        this.domElements = {};
        Object.entries(MODULES_CONFIG.domSelectors).forEach(([key, selector]) => {
            this.domElements[key] = document.querySelector(selector);
        });
    }

    /**
     * Обрабатывает ошибки инициализации
     * @param {Error} error - Объект ошибки
     * @returns {void}
     * @private
     */
    handleInitError(error) {
        const errorMessage = `Ошибка инициализации: ${error.message}`;
        console.error(errorMessage);
        if (this.modules.output) {
            this.addError(errorMessage, 'Инициализация');
        }
    }

    /**
     * Настраивает модальное окно истории
     * @returns {void}
     * @private
     */
    setupHistoryModal() {
        if (!this.historyModal) return;
        
        this.historyModal.onUseCommand = (command) => {
            this.setEditorValue(command);
        };
    }

    /**
     * Восстанавливает состояние редактора из сохраненного состояния
     * @async
     * @returns {Promise<boolean>} true если состояние восстановлено успешно
     * @private
     */
    async restoreEditorState() {
        if (!this.modules.state || !this.modules.editor) {
            return false;
        }
        
        try {
            const state = this.modules.state.loadState();
            if (!state) return false;

            const restored = this.modules.state.restoreToEditor(
                this.modules.editor.editor, 
                state
            );
            
            return restored;
        } catch (error) {
            this.log.error('Ошибка восстановления состояния', { error: error.message });
            return false;
        }
    }

    /**
     * Загружает и применяет настройки
     * @returns {void}
     * @private
     */
    loadAndApplyPreferences() {
        if (!this.modules.preferences || !this.modules.editor) return;

        const prefs = this.modules.preferences.load();
        this.modules.editor.applyPreferences(prefs);
        this.updatePreferenceUI(prefs);
        this.log.debug('Настройки применены', {
            settingsCount: Object.keys(prefs).length
        });
    }

    /**
     * Обновляет UI элементов настроек
     * @param {Object} prefs - Объект настроек
     * @returns {void}
     * @private
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
    }

    /**
     * Настраивает обработчики событий для DOM элементов
     * @returns {void}
     * @private
     */
    setupEventListeners() {
        const { executeBtn, executeEditorBtn, clearConsoleBtn, clearEditorBtn } = this.domElements;
        
        if (executeBtn) executeBtn.addEventListener('click', () => this.executeCode());
        if (executeEditorBtn) executeEditorBtn.addEventListener('click', () => this.executeCode());
        if (clearConsoleBtn) clearConsoleBtn.addEventListener('click', () => this.clearOutput());
        if (clearEditorBtn) clearEditorBtn.addEventListener('click', () => this.clearEditor());

        // Настройки редактора
        const { themeSelector, fontSizeSelector, wrapModeToggle } = this.domElements;
        
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
            });
        }
        
        if (fontSizeSelector) {
            fontSizeSelector.addEventListener('change', (e) => {
                const fontSizeValue = parseInt(e.target.value);
                if (this.modules.editor) {
                    this.modules.editor.changeFontSize(fontSizeValue);
                }
                this.setPreference('fontSize', fontSizeValue);
            });
        }
        
        if (wrapModeToggle) {
            wrapModeToggle.addEventListener('change', (e) => {
                if (this.modules.editor) {
                    this.modules.editor.toggleWrapMode(e.target.checked);
                }
                this.setPreference('wrapMode', e.target.checked);
            });
        }

        // Кнопка истории
        const showHistoryBtn = this.domElements.showHistoryBtn;
        if (showHistoryBtn) {
            showHistoryBtn.addEventListener('click', () => this.showHistory());
        }
    }

    /**
     * Показывает модальное окно истории команд
     * @returns {void}
     * @example
     * consoleManager.showHistory(); // Открывает окно истории
     */
    showHistory() {
        if (this.historyModal) {
            this.historyModal.show();
        } else {
            this.addError('История не доступна');
        }
    }

    /**
     * Обновляет состояние кнопки выполнения
     * @param {boolean} isExecuting - Флаг выполнения
     * @private
     */
    updateExecuteButtonState(isExecuting) {
        const { executeBtn, executeEditorBtn } = this.domElements;
        
        const updateButton = (btn) => {
            if (!btn) return;
            
            if (isExecuting) {
                // Сохраняем оригинальный текст
                if (!btn.dataset.originalText) {
                    btn.dataset.originalText = btn.innerHTML;
                }
                
                // Блокируем кнопку
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
                
                // Добавляем спиннер
                const spinnerHtml = '<span class="execution-spinner"></span>';
                const textSpan = btn.querySelector('.btn-text') || document.createElement('span');
                
                if (!btn.querySelector('.btn-text')) {
                    textSpan.className = 'btn-text';
                    textSpan.textContent = btn.textContent;
                    btn.innerHTML = '';
                }
                
                btn.innerHTML = `${spinnerHtml}<span class="btn-text">Выполняется...</span>`;
                btn.classList.add('btn-executing');
                
            } else {
                // Восстанавливаем оригинальный текст
                const originalHtml = btn.dataset.originalText;
                if (originalHtml) {
                    btn.innerHTML = originalHtml;
                }
                
                // Разблокируем кнопку
                btn.disabled = false;
                btn.removeAttribute('aria-disabled');
                btn.classList.remove('btn-executing');
            }
        };
        
        [executeBtn, executeEditorBtn].forEach(updateButton);
    }

    /**
     * Показывает/скрывает индикатор выполнения в выводе
     * @param {boolean} show - Показать индикатор
     * @private
     */
    showExecutionIndicator(show = true) {
        if (!this.modules.output || !this.modules.output.outputElement) {
            this.log.warn('Контейнер вывода не доступен');
            return;
        }
        
        const outputElement = this.modules.output.outputElement;
        const indicatorId = 'execution-indicator';
        
        if (show) {
            // Убираем существующий индикатор (на всякий случай)
            const existingIndicator = outputElement.querySelector(`#${indicatorId}`);
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            // Создаем индикатор
            const indicator = document.createElement('div');
            indicator.id = indicatorId;
            indicator.className = 'execution-indicator fade-in';
            indicator.innerHTML = `
                <div class="execution-progress">
                    <div class="execution-progress-bar"></div>
                </div>
                <div class="execution-message">
                    <span class="execution-spinner"></span>
                    <span>Выполнение кода...</span>
                </div>
            `;
            
            // Добавляем в вывод
            outputElement.appendChild(indicator);
            
            // Прокручиваем к индикатору
            this.modules.output.scrollToBottom();
            
            this.log.debug('Индикатор выполнения показан');
        } else {
            // Убираем индикатор
            const indicator = outputElement.querySelector(`#${indicatorId}`);
            if (indicator) {
                // Добавляем анимацию исчезновения
                indicator.classList.add('fade-out');
                
                // Удаляем после анимации
                setTimeout(() => {
                    if (indicator.parentNode === outputElement) {
                        indicator.remove();
                    }
                }, 300);
            }
        }
    }

    /**
     * Обновляет прогресс выполнения
     * @param {number} progress - Прогресс от 0 до 100
     * @private
     */
    updateExecutionProgress(progress) {
        if (!this.modules.output || !this.modules.output.outputElement) return;
        
        const outputElement = this.modules.output.outputElement;
        const indicator = outputElement.querySelector('#execution-indicator');
        if (!indicator) return;
        
        const progressBar = indicator.querySelector('.execution-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
    }
    /**
     * Навигация по истории команд
     * @param {number} direction - Направление навигации (1 - вперед, -1 - назад)
     * @returns {void}
     * @example
     * consoleManager.navigateHistory(-1); // Перейти к предыдущей команде
     * consoleManager.navigateHistory(1); // Перейти к следующей команде
     */
    navigateHistory(direction) {
        if (!this.modules.history) return;
        
        const command = direction > 0 
            ? this.modules.history.getNext() 
            : this.modules.history.getPrevious();
        
        if (command !== undefined && command !== '') {
            this.setEditorValue(command);
        }
    }

    /**
     * Выполняет код из редактора
     * @async
     * @returns {Promise<void>}
     */
    async executeCode() {
        if (this.isExecuting) {
            this.addWarning('Код уже выполняется', 'ConsoleManager');
            return;
        }
        
        this.isExecuting = true;
        const code = this.getEditorValue();
        
        if (!code.trim()) {
            this.addWarning('Введите код для выполнения', 'ConsoleManager');
            this.isExecuting = false;
            return;
        }
        
        // Показываем индикаторы
        this.updateExecuteButtonState(true);
        this.showExecutionIndicator(true);
        this.updateExecutionProgress(10); // Начальный прогресс
        
        this.saveEditorState();
        
        const validation = validateCode(code, this.config.consoleType);
        if (!validation.valid) {
            this.addWarning(validation.error, 'Валидация');
            this.isExecuting = false;
            this.updateExecuteButtonState(false);
            this.showExecutionIndicator(false);
            return;
        }
        
        if (this.modules.history) {
            this.modules.history.add(code);
        }
        
        try {
            this.updateExecutionProgress(30); // Прогресс после валидации
            
            const result = await this.modules.api.execute(code);
            this.updateExecutionProgress(70); // Прогресс после получения результата
            
            if (result && result.success) {
                this.modules.output.handleSuccess(result, this.config.consoleType);
                if (result.execution_time) {
                    this.updateStatistics(result);
                }
                this.updateExecutionProgress(100); // Полное завершение
                
                // Небольшая задержка чтобы показать 100% прогресс
                await new Promise(resolve => setTimeout(resolve, 200));
            } else {
                const errorMessage = result?.error || 'Ошибка выполнения';
                this.addError(errorMessage, 'Выполнение');
                if (result?.line && this.modules.editor) {
                    this.modules.editor.addErrorMarker(result.line - 1, errorMessage);
                }
                this.updateExecutionProgress(0); // Сброс при ошибке
            }
        } catch (error) {
            this.log.error('Ошибка выполнения', { error: error.message });
            this.addError(`Ошибка сети: ${error.message || 'неизвестная ошибка'}`, 'Выполнение');
            this.updateExecutionProgress(0); // Сброс при ошибке
        } finally {
            // Небольшая задержка для плавности
            setTimeout(() => {
                this.isExecuting = false;
                this.updateExecuteButtonState(false);
                this.showExecutionIndicator(false);
            }, 300);
        }
    }

    /**
     * Обновляет статистику выполнения
     * @param {Object} data - Данные результата выполнения
     * @param {number} data.execution_time - Время выполнения в секундах
     * @param {number} [data.memory_usage] - Использование памяти в байтах (только для PHP)
     * @returns {void}
     * @private
     */
    updateStatistics(data) {
        if (data.execution_time && this.domElements.executionTime) {
            const formattedTime = formatExecutionTime(data.execution_time * 1000);
            this.domElements.executionTime.textContent = formattedTime;
        }
        
        if (data.memory_usage && this.config.consoleType === 'php' && this.domElements.memoryUsage) {
            const formattedMemory = formatMemoryUsage(data.memory_usage);
            this.domElements.memoryUsage.textContent = formattedMemory;
        }
    }

    /**
     * Форматирует код в редакторе (заглушка)
     * @returns {void}
     * @example
     * consoleManager.formatCode(); // Форматирует текущий код
     */
    formatCode() {
        this.addInfo('Форматирование кода пока не реализовано');
    }

    /**
     * Очищает все данные: редактор, вывод, историю и состояние
     * @returns {void}
     * @example
     * consoleManager.clearAll(); // Очищает все данные
     */
    clearAll() {
        this.clearEditor();
        this.clearOutput();
        this.clearHistory();
        this.clearEditorState();
        this.addSuccess('Все данные очищены');
    }

    /**
     * Уничтожает ConsoleManager и все его модули
     * @returns {void}
     * @example
     * consoleManager.destroy(); // Очищает все ресурсы
     */
    destroy() {
        this.log.info('Уничтожение ConsoleManager');
        
        if (this.modules.state) {
            this.saveEditorState();
        }
        
        Object.entries(this.modules).forEach(([name, module]) => {
            if (module && typeof module.destroy === 'function') {
                try {
                    module.destroy();
                } catch (error) {
                    this.log.error('Ошибка уничтожения модуля', { module: name });
                }
            }
        });
        
        this.modules = {};
        this.historyModal = null;
        this.domElements = {};
    }
}