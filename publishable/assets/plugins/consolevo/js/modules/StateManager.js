import { STATE_CONFIG } from '../utils/constants.js';
import { 
    logger,
    safeJsonParse,
    isEmpty,
    formatTimestamp
} from '../utils/helpers.js';

/**
 * @typedef {Object} CursorPosition
 * @property {number} row - Номер строки (0-based)
 * @property {number} column - Номер колонки (0-based)
 */

/**
 * @typedef {import('ace-builds').Ace.Range} AceRange
 */

/**
 * @typedef {Object} StateMetadata
 * @property {number} contentLength - Длина содержимого в символах
 * @property {number} lines - Количество строк
 * @property {number} selectionsCount - Количество выделений
 * @property {boolean} [truncated] - Было ли содержимое обрезано
 * @property {Object} [custom] - Пользовательские метаданные
 */

/**
 * @typedef {Object} EditorState
 * @property {string} content - Содержимое редактора
 * @property {CursorPosition} cursor - Позиция курсора
 * @property {AceRange[]} selections - Массив выделений
 * @property {number} timestamp - Временная метка сохранения
 * @property {string} version - Версия формата состояния
 * @property {'php' | 'sql'} consoleType - Тип консоли
 * @property {StateMetadata} metadata - Метаданные состояния
 */

/**
 * Менеджер для управления состоянием редактора (сохранение/восстановление)
 * @class StateManager
 */
export default class StateManager {
    /**
     * Создает экземпляр менеджера состояния
     * @param {'php' | 'sql'} consoleType - Тип консоли
     */
    constructor(consoleType) {
        /**
         * Тип консоли
         * @type {'php' | 'sql'}
         */
        this.consoleType = consoleType;
        
        /**
         * Ключ для хранения состояния в localStorage
         * @type {string}
         */
        this.stateKey = `consolevo_state_${consoleType}`;

        /**
         * Логгер
         * @type {Object}
         */
        this.log = logger('StateManager');
        
        /**
         * Конфигурация менеджера состояния
         * @type {Object}
         */
        this.config = STATE_CONFIG;
        
        this.log.info('Инициализирован', { 
            type: consoleType,
            stateKey: this.stateKey
        });
    }

    /**
     * Сохраняет состояние редактора с валидацией и сжатием
     * @param {string} content - Содержимое редактора
     * @param {CursorPosition} cursorPosition - Позиция курсора
     * @param {AceRange[]} selections - Массив выделений
     * @param {Object} metadata - Дополнительные метаданные
     * @returns {boolean} true если состояние сохранено успешно
     * @example
     * // Сохранение состояния редактора
     * stateManager.saveState(
     *   'echo "Hello World";',
     *   { row: 0, column: 4 },
     *   [],
     *   { success: true, executionTime: 0.5 }
     * );
     */
    saveState(content, cursorPosition, selections = [], metadata = {}) {
        try {
            /** @type {EditorState} */
            const state = {
                content: content || '',
                cursor: cursorPosition || { row: 0, column: 0 },
                selections: selections || [],
                timestamp: Date.now(),
                version: this.config.version,
                consoleType: this.consoleType,
                metadata: {
                    contentLength: content ? content.length : 0,
                    lines: content ? content.split('\n').length : 0,
                    selectionsCount: selections ? selections.length : 0,
                    ...metadata
                }
            };

            // ПРОВЕРКА РАЗМЕРА
            const stateSize = new Blob([JSON.stringify(state)]).size;
            if (stateSize > this.config.maxStateSize) {
                this.log.warn('Состояние слишком большое, сохраняем без содержимого', {
                    size: stateSize,
                    maxSize: this.config.maxStateSize
                });
                
                // Сохраняем только метаданные если контент слишком большой
                state.content = '';
                state.metadata.contentLength = 0;
                state.metadata.lines = 0;
                state.metadata.truncated = true;
            }

            localStorage.setItem(this.stateKey, JSON.stringify(state));
            
            this.log.debug('Состояние сохранено', {
                contentLength: state.metadata.contentLength,
                lines: state.metadata.lines,
                cursor: state.cursor,
                selections: state.selections.length,
                size: stateSize
            });
            
            return true;
        } catch (error) {
            this.log.error('Ошибка сохранения состояния', { 
                error: error.message,
                contentLength: content ? content.length : 0
            });
            return false;
        }
    }

    /**
     * Загружает состояние с проверкой целостности
     * @returns {EditorState|null} Состояние редактора или null если не удалось загрузить
     * @example
     * const state = stateManager.loadState();
     * if (state) {
     *   console.log('Состояние загружено:', state.content);
     * }
     */
    loadState() {
        try {
            const saved = localStorage.getItem(this.stateKey);
            if (isEmpty(saved)) {
                this.log.debug('Нет сохраненного состояния');
                return null;
            }

            const state = safeJsonParse(saved, null);
            if (!state) {
                this.log.warn('Неверный формат сохраненного состояния');
                this.clearState();
                return null;
            }

            // ПРОВЕРКА ВЕРСИИ
            if (state.version !== this.config.version) {
                this.log.warn('Версия состояния устарела', {
                    saved: state.version,
                    current: this.config.version
                });
                this.clearState();
                return null;
            }

            // ПРОВЕРКА ВРЕМЕНИ ЖИЗНИ
            const age = Date.now() - state.timestamp;
            if (age > this.config.maxStateAge) {
                this.log.debug('Состояние устарело', {
                    age: formatTimestamp(state.timestamp),
                    maxAge: '7 дней'
                });
                this.clearState();
                return null;
            }

            this.log.debug('Состояние загружено', {
                contentLength: state.metadata?.contentLength || 0,
                lines: state.metadata?.lines || 0,
                selections: state.selections?.length || 0,
                age: this.formatAge(age)
            });

            return state;
        } catch (error) {
            this.log.error('Ошибка загрузки состояния', { error: error.message });
            this.clearState();
            return null;
        }
    }

    /**
     * Восстанавливает состояние в редактор
     * @param {import('./AceEditor.js').default} editor - Экземпляр AceEditor
     * @param {EditorState} state - Состояние для восстановления
     * @returns {boolean} true если состояние восстановлено успешно
     * @example
     * const state = stateManager.loadState();
     * if (state) {
     *   stateManager.restoreToEditor(aceEditorInstance, state);
     * }
     */
    restoreToEditor(editor, state) {
        if (!editor || !state) {
            this.log.debug('Нет состояния для восстановления');
            return false;
        }

        try {
            // ВОССТАНАВЛИВАЕМ СОДЕРЖИМОЕ
            if (state.content && editor.setValue) {
                editor.setValue(state.content, 1);
            }

            // ВОССТАНАВЛИВАЕМ КУРСОР
            if (state.cursor) {
                if (editor.moveCursorToPosition) {
                    editor.moveCursorToPosition(state.cursor);
                } else if (editor.moveCursorTo) {
                    editor.moveCursorTo(state.cursor.row, state.cursor.column);
                }
            }

            // ВОССТАНАВЛИВАЕМ ВЫДЕЛЕНИЯ
            if (state.selections && state.selections.length > 0) {
                if (editor.restoreSelections) {
                    // Используем новый метод из AceEditor
                    editor.restoreSelections(state.selections);
                } else if (editor.selection && editor.selection.setSelectionRange) {
                    state.selections.forEach(selection => {
                        editor.selection.setSelectionRange(selection);
                    });
                }
            }

            this.log.info('Состояние восстановлено в редактор', {
                contentLength: state.metadata?.contentLength || 0,
                hasCursor: !!state.cursor,
                hasSelections: !!(state.selections && state.selections.length),
                selectionsCount: state.selections?.length || 0
            });

            return true;
        } catch (error) {
            this.log.error('Ошибка восстановления состояния в редактор', { 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * Очищает сохраненное состояние
     * @returns {boolean} true если состояние очищено успешно
     * @example
     * stateManager.clearState(); // Удаляет сохраненное состояние
     */
    clearState() {
        try {
            localStorage.removeItem(this.stateKey);
            
            this.log.info('Состояние очищено', { stateKey: this.stateKey });
            return true;
        } catch (error) {
            this.log.error('Ошибка очистки состояния', { error: error.message });
            return false;
        }
    }

    /**
     * Проверяет, есть ли сохраненное состояние
     * @returns {boolean} true если есть сохраненное состояние
     * @example
     * if (stateManager.hasSavedState()) {
     *   console.log('Есть сохраненное состояние');
     * }
     */
    hasSavedState() {
        const saved = localStorage.getItem(this.stateKey);
        return !isEmpty(saved);
    }

    /**
     * Получает информацию о сохраненном состоянии
     * @returns {Object|null} Информация о состоянии или null если нет состояния
     * @example
     * const info = stateManager.getStateInfo();
     * if (info) {
     *   console.log(`Состояние от ${info.timestamp}, размер: ${info.size} байт`);
     * }
     */
    getStateInfo() {
        const state = this.loadState();
        if (!state) return null;

        return {
            timestamp: state.timestamp,
            age: Date.now() - state.timestamp,
            size: new Blob([JSON.stringify(state)]).size,
            contentLength: state.metadata?.contentLength || 0,
            lines: state.metadata?.lines || 0,
            selectionsCount: state.selections?.length || 0,
            truncated: state.metadata?.truncated || false,
            consoleType: state.consoleType
        };
    }

    /**
     * Экспортирует состояние как JSON строку
     * @returns {string|null} JSON строка с состоянием или null если нет состояния
     * @example
     * const json = stateManager.exportState();
     * if (json) {
     *   console.log('Экспортированное состояние:', json);
     * }
     */
    exportState() {
        const state = this.loadState();
        if (!state) return null;

        return JSON.stringify(state, null, 2);
    }

    /**
     * Импортирует состояние из JSON строки
     * @param {string} json - JSON строка с состоянием
     * @returns {boolean} true если состояние успешно импортировано
     * @example
     * const success = stateManager.importState('{"content":"echo \\"test\\";","timestamp":...}');
     */
    importState(json) {
        try {
            const importedState = safeJsonParse(json, null);
            if (!importedState || typeof importedState !== 'object') {
                this.log.error('Некорректный формат JSON для импорта');
                return false;
            }

            // Добавляем обязательные поля если их нет
            const stateToSave = {
                ...importedState,
                timestamp: importedState.timestamp || Date.now(),
                version: importedState.version || this.config.version,
                consoleType: importedState.consoleType || this.consoleType
            };

            localStorage.setItem(this.stateKey, JSON.stringify(stateToSave));
            
            this.log.info('Состояние импортировано', {
                contentLength: stateToSave.content?.length || 0
            });
            
            return true;
        } catch (error) {
            this.log.error('Ошибка импорта состояния', { error: error.message });
            return false;
        }
    }

    /**
     * Форматирует возраст состояния в читаемый вид
     * @param {number} ageInMs - Возраст в миллисекундах
     * @returns {string} Отформатированный возраст
     * @private
     */
    formatAge(ageInMs) {
        const seconds = Math.floor(ageInMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} д.`;
        if (hours > 0) return `${hours} ч.`;
        if (minutes > 0) return `${minutes} мин.`;
        return `${seconds} сек.`;
    }

    /**
     * Уничтожает менеджер состояния
     * @returns {void}
     * @example
     * stateManager.destroy(); // Очищает ресурсы
     */
    destroy() {
        this.log.info('StateManager уничтожен', { stateKey: this.stateKey });
    }
}