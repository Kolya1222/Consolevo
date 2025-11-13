import { THEMES } from '../utils/constants.js';
import { 
    logger,
    generateId,
    debounce
} from '../utils/helpers.js';

/**
 * Менеджер тем для управления темами редактора Ace Editor
 * @class ThemeManager
 */
export default class ThemeManager {
    /**
     * Создает экземпляр менеджера тем
     * @param {Object} preferencesManager - Менеджер настроек (опционально)
     */
    constructor(preferencesManager = null) {
        /**
         * Логгер для отслеживания событий
         * @type {Function}
         */
        this.log = logger('ThemeManager');
        
        /**
         * Менеджер настроек
         * @type {Object|null}
         */
        this.preferences = preferencesManager;
        
        /**
         * Доступные темы с метаданными
         * @type {Array}
         */
        this.availableThemes = this.normalizeThemes(THEMES);
        
        /**
         * Конфигурация менеджера
         * @type {Object}
         */
        this.config = {
            autoApply: true,
            defaultTheme: 'ace/theme/tomorrow_night',
            themeChangeDelay: 300,
            maxRetryAttempts: 2,
            retryDelay: 1000
        };
        
        /**
         * Дебаунс для предотвращения частых изменений
         * @type {Function}
         */
        this.applyThemeDebounced = debounce(this._applyTheme.bind(this), this.config.themeChangeDelay);
        
        /**
         * Хранилище редакторов и их состояния
         * @type {Map}
         */
        this.editors = new Map();
        
        /**
         * Кэш для предзагрузки тем
         * @type {Map}
         */
        this.themeLoadPromises = new Map();
        
        /**
         * Слушатели изменения тем
         * @type {Set}
         */
        this.listeners = new Set();
        
        this.log.info('Менеджер тем инициализирован', { 
            themesCount: this.availableThemes.length,
            hasPreferencesManager: !!this.preferences
        });
    }

    /**
     * Нормализует конфигурацию тем
     * @param {Object} themesConfig - Конфигурация тем
     * @returns {Array} Нормализованный список тем
     */
    normalizeThemes(themesConfig) {
        return Object.entries(themesConfig).map(([key, path]) => ({
            id: path,
            name: this.formatThemeName(key),
            type: this.detectThemeType(key),
            category: 'standard',
            description: this.getThemeDescription(key)
        }));
    }

    /**
     * Форматирует имя темы
     * @param {string} key - Ключ темы
     * @returns {string} Отформатированное имя
     */
    formatThemeName(key) {
        return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
    }

    /**
     * Определяет тип темы
     * @param {string} key - Ключ темы
     * @returns {string} Тип темы ('dark' | 'light')
     */
    detectThemeType(key) {
        const darkThemes = ['tomorrow_night', 'monokai'];
        return darkThemes.includes(key) ? 'dark' : 'light';
    }

    /**
     * Получает описание темы
     * @param {string} key - Ключ темы
     * @returns {string} Описание темы
     */
    getThemeDescription(key) {
        const descriptions = {
            tomorrow_night: 'Элегантная темная тема с хорошей контрастностью',
            monokai: 'Классическая тема в стиле Sublime Text',
            github: 'Светлая тема в стиле GitHub',
            chrome: 'Стандартная светлая тема'
        };
        return descriptions[key] || 'Тема редактора';
    }

    registerEditor(editor, editorId = null) {  
        if (!editor || typeof editor.setTheme !== 'function') {
            console.error('❌ Редактор невалиден!');
            this.log.warn('Попытка регистрации невалидного редактора', {
                hasEditor: !!editor,
                hasSetTheme: typeof editor?.setTheme === 'function'
            });
            return null;
        }

        const id = editorId || generateId('editor_');
        
        this.editors.set(id, {
            instance: editor,
            isInitialized: true,
            retryCount: 0,
            currentTheme: this.getCurrentTheme()
        });
        return id;
    }

    /**
     * Проверяет инициализацию редактора
     * @param {Object} editor - Экземпляр редактора
     * @returns {boolean} Результат проверки
     */
    checkEditorInitialized(editor) {
        return !!(editor && 
                editor.session && 
                typeof editor.setTheme === 'function' &&
                typeof editor.getValue === 'function' &&
                typeof editor.setValue === 'function');
    }

    /**
     * Применяет тему к редактору/редакторам
     * @param {string} themeId - Идентификатор темы
     * @param {string} editorId - Идентификатор конкретного редактора
     * @returns {boolean} Успех операции
     */
    applyTheme(themeId, editorId = null) {
        return this.applyThemeDebounced(themeId, editorId);
    }

    /**
     * Внутренний метод для применения темы с обработкой ошибок
     * @param {string} themeId - Идентификатор темы
     * @param {string} editorId - Идентификатор редактора
     * @returns {boolean} Успех операции
     */
    _applyTheme(themeId, editorId = null) {
        const theme = this.validateTheme(themeId);
        if (!theme) {
            this.log.warn('Попытка применения невалидной темы', { themeId });
            return false;
        }

        /**
         * Предзагрузка темы для улучшения производительности
         */
        this.preloadTheme(themeId);

        let successCount = 0;
        const targetEditors = this.getTargetEditors(editorId);
        
        targetEditors.forEach((editorData, id) => {
            if (this.applyThemeToEditor(editorData.instance, theme.id, id)) {
                successCount++;
                
                /**
                 * Обновляем состояние редактора
                 */
                editorData.isInitialized = true;
                editorData.retryCount = 0;
            } else if (editorData.retryCount < this.config.maxRetryAttempts) {
                /**
                 * Повторная попытка для неинициализированных редакторов
                 */
                editorData.retryCount++;
                this.log.debug('Запланирована повторная попытка применения темы', {
                    editorId: id,
                    attempt: editorData.retryCount
                });
                
                setTimeout(() => {
                    if (this.applyThemeToEditor(editorData.instance, theme.id, id)) {
                        editorData.isInitialized = true;
                        editorData.retryCount = 0;
                    }
                }, this.config.retryDelay);
            }
        });

        if (successCount > 0) {
            this.saveThemePreference(theme.id);
            this.notifyThemeChange(theme);
            
            this.log.info('Тема успешно применена', {
                theme: theme.name,
                affectedEditors: successCount,
                totalEditors: targetEditors.size
            });
            
            return true;
        }
        
        this.log.warn('Не удалось применить тему ни к одному редактору', {
            theme: theme.name,
            targetEditors: targetEditors.size
        });
        
        return false;
    }

    /**
     * Получает целевые редакторы для применения темы
     * @param {string} editorId - Идентификатор редактора
     * @returns {Map} Коллекция редакторов
     */
    getTargetEditors(editorId = null) {
        if (editorId && this.editors.has(editorId)) {
            return new Map([[editorId, this.editors.get(editorId)]]);
        }
        return new Map(this.editors);
    }

    /**
     * Применяет тему к конкретному редактору
     * @param {Object} editor - Экземпляр редактора
     * @param {string} themeId - Идентификатор темы
     * @param {string} editorId - Идентификатор редактора
     * @returns {boolean} Успех операции
     */
    applyThemeToEditor(editor, themeId, editorId = null) {
        try {
            // Пробуем разные варианты вызова
            if (typeof editor.changeTheme === 'function') {
                editor.changeTheme(themeId);  // ← ОСНОВНОЙ МЕТОД AceEditor
            } else if (typeof editor.setTheme === 'function') {
                editor.setTheme(themeId);     // ← РЕЗЕРВНЫЙ МЕТОД
            } else if (editor.editor && typeof editor.editor.setTheme === 'function') {
                editor.editor.setTheme(themeId); // ← ПРЯМОЙ ВЫЗОВ ACE
            } else {
                throw new Error('Нет метода для установки темы');
            }
            
            // Обновляем состояние
            if (editorId && this.editors.has(editorId)) {
                this.editors.get(editorId).currentTheme = themeId;
            }
            
            this.log.debug('Тема применена к редактору', { 
                editorId, 
                theme: themeId 
            });
            return true;
        } catch (error) {
            this.log.warn('Ошибка применения темы', { 
                editorId, 
                theme: themeId,
                error: error.message 
            });
            return false;
        }
    }

    /**
     * Предзагружает тему для улучшения производительности
     * @param {string} themeId - Идентификатор темы
     * @returns {Promise} Промис загрузки темы
     */
    async preloadTheme(themeId) {
        if (this.themeLoadPromises.has(themeId)) {
            return this.themeLoadPromises.get(themeId);
        }

        const loadPromise = new Promise((resolve) => {
            try {
                if (typeof ace !== 'undefined' && ace.require) {
                    ace.require([themeId], resolve);
                } else {
                    resolve();
                }
            } catch (error) {
                this.log.debug('Ошибка предзагрузки темы', { theme: themeId, error: error.message });
                resolve();
            }
        });

        this.themeLoadPromises.set(themeId, loadPromise);
        return loadPromise;
    }

    /**
     * Проверяет валидность темы
     * @param {string} themeId - Идентификатор темы
     * @returns {Object|null} Объект темы или null
     */
    validateTheme(themeId) {
        return this.availableThemes.find(theme => theme.id === themeId) || null;
    }

    /**
     * Получает текущую активную тему
     * @returns {string} Идентификатор темы
     */
    getCurrentTheme() {
        if (this.preferences) {
            return this.preferences.get('theme', this.config.defaultTheme);
        }
        
        /**
         * Резервное хранилище в localStorage
         */
        try {
            const prefs = JSON.parse(localStorage.getItem('consolevo_preferences') || '{}');
            return prefs.theme || this.config.defaultTheme;
        } catch (error) {
            this.log.warn('Ошибка чтения темы из localStorage', { error: error.message });
            return this.config.defaultTheme;
        }
    }

    /**
     * Сохраняет предпочтение темы
     * @param {string} themeId - Идентификатор темы
     * @returns {boolean} Успех операции
     */
    saveThemePreference(themeId) {
        if (this.preferences) {
            return this.preferences.save('theme', themeId);
        }
        
        try {
            const preferences = JSON.parse(localStorage.getItem('consolevo_preferences') || '{}');
            preferences.theme = themeId;
            localStorage.setItem('consolevo_preferences', JSON.stringify(preferences));
            return true;
        } catch (error) {
            this.log.error('Ошибка сохранения темы в localStorage', { error: error.message });
            return false;
        }
    }

    /**
     * Получает отфильтрованный список тем
     * @param {Object} filter - Параметры фильтрации
     * @returns {Array} Отфильтрованный список тем
     */
    getThemes(filter = {}) {
        let themes = [...this.availableThemes];
        
        if (filter.type) {
            themes = themes.filter(theme => theme.type === filter.type);
        }
        
        if (filter.category) {
            themes = themes.filter(theme => theme.category === filter.category);
        }
        
        if (filter.search) {
            const searchTerm = filter.search.toLowerCase();
            themes = themes.filter(theme => 
                theme.name.toLowerCase().includes(searchTerm) ||
                theme.description.toLowerCase().includes(searchTerm)
            );
        }
        
        return themes;
    }

    /**
     * Получает темы по типу
     * @param {string} type - Тип темы ('dark' | 'light')
     * @returns {Array} Список тем
     */
    getThemesByType(type) {
        return this.getThemes({ type });
    }

    /**
     * Получает информацию о текущей активной теме
     * @returns {Object} Объект темы
     */
    getActiveTheme() {
        const currentThemeId = this.getCurrentTheme();
        return this.validateTheme(currentThemeId) || 
               this.validateTheme(this.config.defaultTheme);
    }

    /**
     * Циклически переключает темы
     * @param {string} editorId - Идентификатор редактора
     * @returns {boolean} Успех операции
     */
    cycleThemes(editorId = null) {
        const themes = this.availableThemes;
        const currentThemeId = this.getCurrentTheme();
        const currentIndex = themes.findIndex(theme => theme.id === currentThemeId);
        const nextIndex = (currentIndex + 1) % themes.length;
        const nextTheme = themes[nextIndex];
        
        return this.applyTheme(nextTheme.id, editorId);
    }

    /**
     * Сбрасывает тему к значению по умолчанию
     * @param {string} editorId - Идентификатор редактора
     * @returns {boolean} Успех операции
     */
    resetToDefault(editorId = null) {
        return this.applyTheme(this.config.defaultTheme, editorId);
    }

    /**
     * Добавляет слушатель изменения темы
     * @param {Function} callback - Функция обратного вызова
     * @returns {Function} Функция для удаления слушателя
     */
    addThemeChangeListener(callback) {
        if (typeof callback !== 'function') {
            this.log.warn('Попытка добавления невалидного слушателя');
            return () => {};
        }
        
        this.listeners.add(callback);
        
        this.log.debug('Добавлен слушатель изменения темы', {
            totalListeners: this.listeners.size
        });
        
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Уведомляет слушателей об изменении темы
     * @param {Object} theme - Объект темы
     */
    notifyThemeChange(theme) {
        this.listeners.forEach(callback => {
            try {
                callback(theme);
            } catch (error) {
                this.log.error('Ошибка в слушателе изменения темы', { 
                    error: error.message 
                });
            }
        });
    }

    /**
     * Получает информацию о теме
     * @param {string} themeId - Идентификатор темы
     * @returns {Object|null} Объект темы
     */
    getThemeInfo(themeId) {
        return this.validateTheme(themeId);
    }

    /**
     * Получает статистику менеджера тем
     * @returns {Object} Объект статистики
     */
    getStats() {
        const initializedEditors = Array.from(this.editors.values())
            .filter(editor => editor.isInitialized).length;
            
        return {
            totalThemes: this.availableThemes.length,
            darkThemes: this.getThemesByType('dark').length,
            lightThemes: this.getThemesByType('light').length,
            registeredEditors: this.editors.size,
            initializedEditors: initializedEditors,
            currentTheme: this.getActiveTheme()?.name,
            hasPreferences: !!this.preferences,
            activeListeners: this.listeners.size
        };
    }

    /**
     * Удаляет редактор из управления
     * @param {string} editorId - Идентификатор редактора
     * @returns {boolean} Факт удаления
     */
    unregisterEditor(editorId) {
        const existed = this.editors.delete(editorId);
        if (existed) {
            this.log.debug('Редактор удален из управления темами', { editorId });
        }
        return existed;
    }

    /**
     * Очищает ресурсы менеджера тем
     */
    destroy() {
        this.log.info('Менеджер тем уничтожен', {
            editorsCount: this.editors.size,
            listenersCount: this.listeners.size
        });
        
        this.editors.clear();
        this.listeners.clear();
        this.themeLoadPromises.clear();
    }
}