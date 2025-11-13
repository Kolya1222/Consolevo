import { DEFAULT_PREFERENCES, PREFERENCES_SCHEMA } from '../utils/constants.js';
import { 
    logger,
    safeJsonParse,
    isEmpty,
    debounce,
} from '../utils/helpers.js';

export default class PreferencesManager {
    constructor() {
        this.storageKey = 'consolevo_preferences';
        this.version = '1.0';
        this.currentSchema = PREFERENCES_SCHEMA;
        this.listeners = new Set();
        
        // ИСПОЛЬЗУЕМ ЛОГГЕР ИЗ HELPERS
        this.log = logger('PreferencesManager');
        
        // ДЕБАУНС ДЛЯ МАССОВОГО СОХРАНЕНИЯ
        this.batchSave = debounce(this._batchSave.bind(this), 500);
        this.batchUpdates = new Map();
        
        this.migrateIfNeeded();
        
        this.log.info('Инициализирован', { 
            version: this.version,
            storageKey: this.storageKey
        });
    }

    // МИГРАЦИЯ ДАННЫХ С ЛОГГИРОВАНИЕМ
    migrateIfNeeded() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) {
                this.log.debug('Нет сохраненных настроек, используются значения по умолчанию');
                return;
            }

            // ИСПОЛЬЗУЕМ safeJsonParse ИЗ HELPERS
            const data = safeJsonParse(stored, {});
            
            if (data.version !== this.version) {
                this.log.info('Миграция настроек', { 
                    from: data.version, 
                    to: this.version 
                });
                
                const migratedData = this.migrateData(data);
                this.saveAll(migratedData);
            }
        } catch (error) {
            this.log.error('Ошибка миграции настроек', { error: error.message });
        }
    }

    migrateData(oldData) {
        const migrated = { ...DEFAULT_PREFERENCES };
        
        Object.keys(oldData).forEach(key => {
            if (key in migrated && this.validateValue(key, oldData[key])) {
                migrated[key] = oldData[key];
            }
        });
        
        migrated.version = this.version;
        
        this.log.debug('Настройки мигрированы', {
            migratedKeys: Object.keys(migrated).length
        });
        
        return migrated;
    }

    // ЗАГРУЗКА С УЛУЧШЕННОЙ ОБРАБОТКОЙ ОШИБОК
    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (isEmpty(stored)) {
                return this.getDefaultPreferences();
            }

            // ИСПОЛЬЗУЕМ safeJsonParse ИЗ HELPERS
            const preferences = safeJsonParse(stored, this.getDefaultPreferences());
            return this.validateAndMerge(preferences);
            
        } catch (error) {
            this.log.error('Ошибка загрузки настроек', { error: error.message });
            return this.getDefaultPreferences();
        }
    }

    getDefaultPreferences() {
        return {
            ...DEFAULT_PREFERENCES,
            version: this.version
        };
    }

    validateAndMerge(preferences) {
        const validated = { ...DEFAULT_PREFERENCES };
        let validCount = 0;
        
        Object.keys(preferences).forEach(key => {
            if (this.validateValue(key, preferences[key])) {
                validated[key] = preferences[key];
                validCount++;
            }
        });
        
        validated.version = this.version;
        
        this.log.debug('Настройки валидированы', {
            total: Object.keys(preferences).length,
            valid: validCount
        });
        
        return validated;
    }

    validateValue(key, value) {
        const schema = this.currentSchema[key];
        if (!schema) {
            this.log.warn('Неизвестная настройка', { key, value });
            return false;
        }

        if (key === 'fontSize' && typeof value === 'string') {
            // Парсим '16px' -> 16
            const parsed = parseInt(value);
            if (!isNaN(parsed)) {
                value = parsed;
            }
        }

        // Проверка типа
        if (schema.type && typeof value !== schema.type) {
            this.log.warn('Неверный тип настройки', { 
                key, 
                expected: schema.type, 
                actual: typeof value 
            });
            return false;
        }

        // Проверка допустимых значений
        if (schema.options && !schema.options.includes(value)) {
            this.log.warn('Недопустимое значение настройки', { 
                key, 
                value, 
                allowed: schema.options 
            });
            return false;
        }

        // Проверка диапазона для чисел
        if (schema.type === 'number' && schema.min !== undefined && value < schema.min) {
            this.log.warn('Значение настройки слишком мало', { 
                key, 
                value, 
                min: schema.min 
            });
            return false;
        }

        if (schema.type === 'number' && schema.max !== undefined && value > schema.max) {
            this.log.warn('Значение настройки слишком велико', { 
                key, 
                value, 
                max: schema.max 
            });
            return false;
        }

        return true;
    }

    //  СОХРАНЕНИЕ С ПАКЕТНОЙ ОПТИМИЗАЦИЕЙ
    save(key, value) {
        try {
            
            if (key === 'fontSize' && typeof value === 'string') {
                const parsed = parseInt(value);
                if (!isNaN(parsed)) {
                    value = parsed;
                }
            }
            if (!this.validateValue(key, value)) {
                this.log.error('Некорректное значение для сохранения', { key, value });
                return false;
            }

            const preferences = this.load();
            const oldValue = preferences[key];
            
            //  ПРОВЕРКА ИЗМЕНЕНИЯ С isEmpty
            if (oldValue === value || (isEmpty(oldValue) && isEmpty(value))) {
                this.log.debug('Значение не изменилось, пропускаем сохранение', { key });
                return true;
            }

            preferences[key] = value;
            localStorage.setItem(this.storageKey, JSON.stringify(preferences));
            
            this.log.debug('Настройка сохранена', { key, value });
            
            // Уведомляем слушателей
            this.notifyListeners(key, value, oldValue);
            
            return true;
        } catch (error) {
            this.log.error('Ошибка сохранения настройки', { key, error: error.message });
            return false;
        }
    }

    // ПАКЕТНОЕ СОХРАНЕНИЕ (для нескольких изменений сразу)
    saveBatch(key, value) {
        this.batchUpdates.set(key, value);
        this.batchSave();
    }

    // ПРИВАТНЫЙ МЕТОД ДЛЯ ПАКЕТНОГО СОХРАНЕНИЯ
    _batchSave() {
        if (this.batchUpdates.size === 0) return;

        try {
            const preferences = this.load();
            const changes = [];

            this.batchUpdates.forEach((value, key) => {
                if (this.validateValue(key, value)) {
                    const oldValue = preferences[key];
                    if (oldValue !== value) {
                        preferences[key] = value;
                        changes.push({ key, value, oldValue });
                    }
                }
            });

            if (changes.length > 0) {
                localStorage.setItem(this.storageKey, JSON.stringify(preferences));
                
                this.log.debug('Пакетное сохранение настроек', { 
                    changes: changes.length 
                });
                
                // Уведомляем слушателей об изменениях
                changes.forEach(({ key, value, oldValue }) => {
                    this.notifyListeners(key, value, oldValue);
                });
            }

            this.batchUpdates.clear();
        } catch (error) {
            this.log.error('Ошибка пакетного сохранения', { error: error.message });
        }
    }

    saveAll(newPreferences) {
        try {
            const validated = this.validateAndMerge(newPreferences);
            localStorage.setItem(this.storageKey, JSON.stringify(validated));
            
            this.log.info('Все настройки сохранены', {
                total: Object.keys(validated).length
            });
            
            this.notifyListeners('*', validated, null);
            
            return true;
        } catch (error) {
            this.log.error('Ошибка массового сохранения настроек', { error: error.message });
            return false;
        }
    }

    get(key, defaultValue = null) {
        const preferences = this.load();
        return preferences[key] ?? defaultValue;
    }

    // СИСТЕМА СОБЫТИЙ С УЛУЧШЕННОЙ ОБРАБОТКОЙ
    addListener(callback) {
        this.listeners.add(callback);
        
        this.log.debug('Слушатель добавлен', { 
            totalListeners: this.listeners.size 
        });
        
        return () => {
            this.listeners.delete(callback);
            this.log.debug('Слушатель удален', { 
                totalListeners: this.listeners.size 
            });
        };
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners(key, newValue, oldValue) {
        this.log.debug('Уведомление слушателей', { 
            key, 
            listeners: this.listeners.size 
        });
        
        this.listeners.forEach(callback => {
            try {
                callback(key, newValue, oldValue);
            } catch (error) {
                this.log.error('Ошибка в слушателе настроек', { error: error.message });
            }
        });
    }

    // УТИЛИТЫ С ЛОГГИРОВАНИЕМ
    resetToDefaults() {
        const defaults = this.getDefaultPreferences();
        const result = this.saveAll(defaults);
        
        if (result) {
            this.log.info('Настройки сброшены к значениям по умолчанию');
        }
        
        return result;
    }

    export() {
        const data = this.load();
        this.log.debug('Настройки экспортированы', { 
            size: JSON.stringify(data).length 
        });
        
        return JSON.stringify(data, null, 2);
    }

    import(jsonString) {
        try {
            // safeJsonParse ИЗ HELPERS
            const imported = safeJsonParse(jsonString, null);
            
            if (!imported) {
                this.log.error('Ошибка импорта: неверный JSON');
                return false;
            }
            
            const result = this.saveAll(imported);
            
            if (result) {
                this.log.info('Настройки импортированы', {
                    keys: Object.keys(imported).length
                });
            }
            
            return result;
        } catch (error) {
            this.log.error('Ошибка импорта настроек', { error: error.message });
            return false;
        }
    }

    getAll() {
        return this.load();
    }

    clear() {
        try {
            const oldPreferences = this.load();
            localStorage.removeItem(this.storageKey);
            
            this.log.info('Все настройки очищены');
            
            this.notifyListeners('*', this.getDefaultPreferences(), oldPreferences);
            
            return true;
        } catch (error) {
            this.log.error('Ошибка очистки настроек', { error: error.message });
            return false;
        }
    }

    getInfo() {
        const prefs = this.load();
        return {
            version: this.version,
            totalSettings: Object.keys(prefs).length,
            storageKey: this.storageKey,
            hasListeners: this.listeners.size,
            schemaVersion: '1.0'
        };
    }

    // ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ
    has(key) {
        const prefs = this.load();
        return key in prefs;
    }

    getSize() {
        const data = localStorage.getItem(this.storageKey);
        return data ? new Blob([data]).size : 0;
    }

    getStorageInfo() {
        return {
            size: this.getSize(),
            keys: Object.keys(this.load()).length,
            listeners: this.listeners.size
        };
    }

    destroy() {
        this.log.info('PreferencesManager уничтожен');
        this.listeners.clear();
        this.batchUpdates.clear();
    }
}