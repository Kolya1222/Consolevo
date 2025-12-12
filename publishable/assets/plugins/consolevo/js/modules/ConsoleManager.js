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
 * Интеллектуальный фасад для управления всеми модулями консоли
 * @class ConsoleManager
 */
export default class ConsoleManager {
    constructor(config = {}) {
        this.config = {
            executeRoute: config.executeRoute,
            consoleType: config.consoleType,
        };
        
        this.modules = {};
        this.isExecuting = false;
        this.historyModal = null;
        this.domElements = {};
        this.initSequence = [
            'preferences',
            'state',
            'output', 
            'api',
            'editor',
            'history'
        ];
        this.log = logger('ConsoleManager');
    }

    async init() {
        try {
            await this.initializeModules();
            this.cacheDOMElements();
            this.setupFacadeMethods();
            this.loadAndApplyPreferences();
            await this.restoreEditorState();
            await this.setupPreferencesReactivity();
            this.setupEventListeners();
            this.log.info('ConsoleManager успешно инициализирован');
        } catch (error) {
            this.log.error('Критическая ошибка инициализации', { error: error.message });
            this.handleInitError(error);
        }
    }

    setupFacadeMethods() {
        this.applyTheme = (themeId) => {
            if (this.modules.editor) {
                this.modules.editor.setTheme(themeId);
                this.setPreference('theme', themeId);
                this.log.debug('Тема применена', { themeId });
                return true;
            }
            return false;
        };

        // OUTPUT MANAGER
        this.addError = (message, context = '') => this.modules.output?.addError(message, context);
        this.addWarning = (message, context = '') => this.modules.output?.addWarning(message, context);
        this.addInfo = (message, isHtml = false) => this.modules.output?.add(message, 'info', isHtml);
        this.addSuccess = (message, isHtml = false) => this.modules.output?.add(message, 'success', isHtml);
        this.addSeparator = () => this.modules.output?.addSeparator();
        this.clearOutput = () => this.modules.output?.clear();
        this.highlightOutput = (pattern, className) => this.modules.output?.highlightLines(pattern, className);
        this.addSmart = (content, type = 'info') => this.modules.output?.addSmart(content, type);

        // HISTORY MANAGER
        this.clearHistory = () => this.modules.history?.clear();
        this.exportHistory = () => this.modules.history?.export();
        this.searchHistory = (pattern) => this.modules.history?.search(pattern) || [];

        // STATE MANAGER
        this.saveEditorState = () => {
            if (!this.modules.state || !this.modules.editor) return false;
            
            const content = this.getEditorValue();
            const cursor = this.modules.editor.getCursorPosition?.();
            const selections = this.modules.editor.getSelections?.() || [];
            
            return this.modules.state.saveState(content, cursor, selections, {
                consoleType: this.config.consoleType
            });
        };
        
        this.clearEditorState = () => this.modules.state?.clearState();

        // EDITOR
        this.getEditorValue = () => this.modules.editor?.getValue() || '';
        this.setEditorValue = (value) => this.modules.editor?.setValue(value);
        this.clearEditor = () => this.modules.editor?.clear();

        // PREFERENCES
        this.getPreference = (key) => this.modules.preferences?.get(key);
        this.setPreference = (key, value) => this.modules.preferences?.save(key, value);
        this.getAllPreferences = () => this.modules.preferences?.load() || {};
        this.resetPreferences = () => this.modules.preferences?.resetToDefault();

        this.log.info('Фасадные методы настроены');
    }

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
    
    cacheDOMElements() {
        this.domElements = {};
        Object.entries(MODULES_CONFIG.domSelectors).forEach(([key, selector]) => {
            this.domElements[key] = document.querySelector(selector);
        });
    }

    handleInitError(error) {
        const errorMessage = `Ошибка инициализации: ${error.message}`;
        console.error(errorMessage);
        if (this.modules.output) {
            this.addError(errorMessage, 'Инициализация');
        }
    }

    setupHistoryModal() {
        if (!this.historyModal) return;
        
        this.historyModal.onUseCommand = (command) => {
            this.setEditorValue(command);
        };
    }

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

    async setupPreferencesReactivity() {
        if (!this.modules.preferences) return;

        this.modules.preferences.addListener((key, newValue) => {
            switch (key) {
                case 'theme':
                    if (this.modules.editor) {
                        this.modules.editor.setTheme(newValue);
                    }
                    if (this.domElements.themeSelector) {
                        this.domElements.themeSelector.value = newValue;
                    }
                    break;
                case 'fontSize':
                    if (this.modules.editor) {
                        this.modules.editor.changeFontSize(newValue);
                    }
                    if (this.domElements.fontSizeSelector) {
                        this.domElements.fontSizeSelector.value = newValue + 'px';
                    }
                    break;
                case 'wrapMode':
                    if (this.modules.editor) {
                        this.modules.editor.toggleWrapMode(newValue);
                    }
                    if (this.domElements.wrapModeToggle) {
                        this.domElements.wrapModeToggle.checked = newValue;
                    }
                    break;
                case 'enableAutocomplete':
                    if (this.modules.editor) {
                        this.modules.editor.toggleAutocomplete(newValue);
                    }
                    break;
                case 'showLineNumbers':
                case 'highlightActiveLine':
                    if (this.modules.editor && this.modules.editor.editor) {
                        this.modules.editor.editor.setOption(key, newValue);
                    }
                    break;
            }
        });
    }

    loadAndApplyPreferences() {
        if (!this.modules.preferences || !this.modules.editor) return;
        
        // Загружаем настройки
        const prefs = this.modules.preferences.load();
        
        const defaultPrefs = this.modules.preferences.getDefaultPreferences();
        const hasUserPreferences = Object.keys(prefs).some(key => 
            key !== 'version' && prefs[key] !== defaultPrefs[key]
        );
        
        if (hasUserPreferences) {
            this.modules.editor.applyPreferences(prefs);
            this.updatePreferenceUI(prefs);
            this.log.debug('Пользовательские настройки применены', {
                settings: Object.keys(prefs).filter(k => k !== 'version')
            });
        } else {
            this.log.debug('Применены только настройки по умолчанию');
        }
    }

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

    showHistory() {
        if (this.historyModal) {
            this.historyModal.show();
        } else {
            this.addError('История не доступна');
        }
    }

    navigateHistory(direction) {
        if (!this.modules.history) return;
        
        const command = direction > 0 
            ? this.modules.history.getNext() 
            : this.modules.history.getPrevious();
        
        if (command !== undefined && command !== '') {
            this.setEditorValue(command);
        }
    }

    async executeCode() {
        if (this.isExecuting) return;
        
        this.isExecuting = true;
        const code = this.getEditorValue();
        
        this.saveEditorState();
        
        const validation = validateCode(code, this.config.consoleType);
        if (!validation.valid) {
            this.addWarning(validation.error, 'Валидация');
            this.isExecuting = false;
            return;
        }
        
        this.modules.output.add(code, 'input');
        
        if (this.modules.history) {
            this.modules.history.add(code);
        }
        
        try {
            const result = await this.modules.api.execute(code);
            
            if (result && result.success) {
                this.modules.output.handleSuccess(result, this.config.consoleType);
                if (result.execution_time) {
                    this.updateStatistics(result);
                }
            } else {
                const errorMessage = result?.error || 'Ошибка выполнения';
                this.addError(errorMessage);
                if (result?.line && this.modules.editor) {
                    this.modules.editor.addErrorMarker(result.line - 1, errorMessage);
                }
            }
        } catch (error) {
            this.log.error('Ошибка выполнения', { error: error.message });
            this.addError(`Ошибка сети: ${error.message || 'неизвестная ошибка'}`);
        } finally {
            this.isExecuting = false;
        }
    }

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

    formatCode() {
        this.addInfo('Форматирование кода пока не реализовано');
    }

    exportData() {
        if (!this.modules.history) {
            this.addError('История не доступна');
            return;
        }

        try {
            const historyData = this.exportHistory();
            const dataStr = JSON.stringify(historyData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `console-history-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.addSuccess(`История экспортирована (${historyData.length} записей)`);
        } catch (error) {
            this.addError('Ошибка экспорта истории');
        }
    }

    showHelp() {
        const helpText = `
Горячие клавиши:
• Alt+Enter - Выполнить код
• Alt+L - Очистить консоль  
• Alt+Shift+H - История
• Alt+E - Экспорт
• Alt+/ - Справка
• Alt+Стрелки ↑/↓ - Навигация по истории
• Alt+T - Сменить тему
        `;
        this.addInfo(helpText);
    }

    clearAll() {
        this.clearEditor();
        this.clearOutput();
        this.clearHistory();
        this.clearEditorState();
        this.addSuccess('Все данные очищены');
    }

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