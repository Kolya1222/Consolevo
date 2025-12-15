import { DEFAULT_PREFERENCES, PREFERENCES_SCHEMA } from '../utils/constants.js';
import { 
    logger,
    safeJsonParse,
    isEmpty,
} from '../utils/helpers.js';

/**
 * @typedef {Object} PreferenceSchema
 * @property {string} type - Тип значения (string, number, boolean)
 * @property {Array} [options] - Допустимые значения (для enum)
 * @property {number} [min] - Минимальное значение (для чисел)
 * @property {number} [max] - Максимальное значение (для чисел)
 * @property {string} [description] - Описание настройки
 * @property {*} [default] - Значение по умолчанию
 */

/**
 * @typedef {Object} Preferences
 * @property {string} theme - Тема интерфейса
 * @property {number} fontSize - Размер шрифта
 * @property {boolean} wrapMode - Включен ли перенос строк
 * @property {boolean} enableAutocomplete - Включено ли автодополнение
 */

/**
 * Менеджер для управления настройками пользователя
 * @class PreferencesManager
 */
export default class PreferencesManager {
    constructor() {
        /**
         * Логгер
         * @type {Object}
         */
        this.log = logger('PreferencesManager');
        
        this.log.info('Инициализирован');
    }

    /**
     * Загружает настройки из localStorage
     * @returns {Preferences} Объект настроек
     * @example
     * const prefs = preferencesManager.load();
     * console.log(prefs.theme); // 'ace/theme/tomorrow_night'
     * console.log(prefs.fontSize); // 14
     */
    load() {
        try {
            const stored = localStorage.getItem('consolevo_preferences');
            if (isEmpty(stored)) {
                return DEFAULT_PREFERENCES;
            }

            const preferences = safeJsonParse(stored, DEFAULT_PREFERENCES);
            return this.validateAndMerge(preferences);
            
        } catch (error) {
            this.log.error('Ошибка загрузки настроек', { error: error.message });
            return DEFAULT_PREFERENCES;
        }
    }

    /**
     * Валидирует и объединяет настройки с значениями по умолчанию
     * @param {Object} preferences - Загруженные настройки
     * @returns {Preferences} Валидированные настройки
     * @private
     */
    validateAndMerge(preferences) {
        const validated = { ...DEFAULT_PREFERENCES };
        let validCount = 0;
        
        Object.keys(preferences).forEach(key => {
            if (this.validateValue(key, preferences[key])) {
                validated[key] = preferences[key];
                validCount++;
            }
        });
        
        this.log.debug('Настройки валидированы', {
            total: Object.keys(preferences).length,
            valid: validCount
        });
        
        return validated;
    }

    /**
     * Валидирует значение для указанного ключа настроек
     * @param {string} key - Ключ настройки
     * @param {*} value - Значение для проверки
     * @returns {boolean} true если значение валидно
     * @private
     */
    validateValue(key, value) {
        const schema = PREFERENCES_SCHEMA[key];
        if (!schema) {
            this.log.warn('Неизвестная настройка', { key, value });
            return false;
        }

        // Преобразование строки в число для fontSize
        if (key === 'fontSize' && typeof value === 'string') {
            const parsed = parseInt(value);
            if (!isNaN(parsed)) {
                value = parsed;
            }
        }

        // Проверка типа
        if (schema.type && typeof value !== schema.type) {
            return false;
        }

        // Проверка допустимых значений
        if (schema.options && !schema.options.includes(value)) {
            return false;
        }

        // Проверка диапазона для чисел
        if (schema.type === 'number' && schema.min !== undefined && value < schema.min) {
            return false;
        }

        if (schema.type === 'number' && schema.max !== undefined && value > schema.max) {
            return false;
        }

        return true;
    }

    /**
     * Сохраняет настройку
     * @param {keyof Preferences} key - Ключ настройки
     * @param {*} value - Значение настройки
     * @returns {boolean} true если настройка сохранена успешно
     * @example
     * // Сохранение темы
     * preferencesManager.save('theme', 'ace/theme/tomorrow_night');
     * 
     * // Сохранение размера шрифта
     * preferencesManager.save('fontSize', 16);
     * 
     * // Сохранение режима переноса строк
     * preferencesManager.save('wrapMode', true);
     */
    save(key, value) {
        try {
            // Преобразование строки в число для fontSize
            if (key === 'fontSize' && typeof value === 'string') {
                const parsed = parseInt(value);
                if (!isNaN(parsed)) {
                    value = parsed;
                }
            }
            
            // Валидация значения
            if (!this.validateValue(key, value)) {
                this.log.error('Некорректное значение для сохранения', { key, value });
                return false;
            }

            const preferences = this.load();
            const oldValue = preferences[key];
            
            // Если значение не изменилось, не сохраняем
            if (oldValue === value) {
                return true;
            }

            // Сохраняем новое значение
            preferences[key] = value;
            localStorage.setItem('consolevo_preferences', JSON.stringify(preferences));
            
            this.log.debug('Настройка сохранена', { key, value });
            
            return true;
        } catch (error) {
            this.log.error('Ошибка сохранения настройки', { key, error: error.message });
            return false;
        }
    }

    /**
     * Получает значение настройки
     * @param {keyof Preferences} key - Ключ настройки
     * @param {*} [defaultValue=null] - Значение по умолчанию если настройка не найдена
     * @returns {*} Значение настройки или значение по умолчанию
     * @example
     * const theme = preferencesManager.get('theme'); // Получает тему
     * const fontSize = preferencesManager.get('fontSize', 14); // Получает размер шрифта с дефолтом
     */
    get(key, defaultValue = null) {
        const preferences = this.load();
        return preferences[key] ?? defaultValue;
    }

    /**
     * Получает все настройки
     * @returns {Preferences} Все настройки
     * @example
     * const allPrefs = preferencesManager.getAll();
     */
    getAll() {
        return this.load();
    }

    /**
     * Очищает все настройки (возвращает к значениям по умолчанию)
     * @returns {boolean} true если настройки успешно очищены
     * @example
     * preferencesManager.clear(); // Удаляет все пользовательские настройки
     */
    clear() {
        try {
            localStorage.removeItem('consolevo_preferences');
            this.log.info('Все настройки очищены');
            return true;
        } catch (error) {
            this.log.error('Ошибка очистки настроек', { error: error.message });
            return false;
        }
    }

    /**
     * Сохраняет несколько настроек одновременно
     * @param {Object} updates - Объект с обновлениями настроек
     * @returns {boolean} true если все настройки сохранены успешно
     * @example
     * preferencesManager.saveMultiple({
     *   theme: 'ace/theme/tomorrow_night',
     *   fontSize: 16,
     *   wrapMode: true
     * });
     */
    saveMultiple(updates) {
        try {
            const preferences = this.load();
            let hasChanges = false;
            
            // Применяем все обновления
            Object.entries(updates).forEach(([key, value]) => {
                if (this.validateValue(key, value)) {
                    if (preferences[key] !== value) {
                        preferences[key] = value;
                        hasChanges = true;
                    }
                } else {
                    this.log.warn('Пропущена невалидная настройка', { key, value });
                }
            });
            
            // Сохраняем только если были изменения
            if (hasChanges) {
                localStorage.setItem('consolevo_preferences', JSON.stringify(preferences));
                this.log.debug('Несколько настроек сохранены', {
                    updates: Object.keys(updates).length
                });
            }
            
            return true;
        } catch (error) {
            this.log.error('Ошибка сохранения нескольких настроек', { error: error.message });
            return false;
        }
    }

    /**
     * Проверяет, есть ли сохраненные настройки
     * @returns {boolean} true если есть сохраненные настройки
     * @example
     * const hasPrefs = preferencesManager.hasSavedPreferences();
     */
    hasSavedPreferences() {
        const stored = localStorage.getItem('consolevo_preferences');
        return !isEmpty(stored);
    }

    /**
     * Экспортирует настройки как строку JSON
     * @returns {string} JSON строка с настройками
     * @example
     * const json = preferencesManager.exportAsJson();
     * console.log(json); // '{"theme":"ace/theme/tomorrow_night","fontSize":14,...}'
     */
    exportAsJson() {
        const preferences = this.load();
        return JSON.stringify(preferences, null, 2);
    }

    /**
     * Импортирует настройки из JSON строки
     * @param {string} json - JSON строка с настройками
     * @returns {boolean} true если настройки успешно импортированы
     * @example
     * const success = preferencesManager.importFromJson('{"theme":"ace/theme/monokai"}');
     */
    importFromJson(json) {
        try {
            const parsed = safeJsonParse(json, null);
            if (!parsed || typeof parsed !== 'object') {
                this.log.error('Некорректный JSON для импорта');
                return false;
            }
            
            return this.saveMultiple(parsed);
        } catch (error) {
            this.log.error('Ошибка импорта настроек', { error: error.message });
            return false;
        }
    }

    /**
     * Уничтожает менеджер настроек
     * @returns {void}
     * @example
     * preferencesManager.destroy(); // Очищает ресурсы
     */
    destroy() {
        this.log.info('PreferencesManager уничтожен');
    }
}