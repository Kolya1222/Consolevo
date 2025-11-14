import { STATE_CONFIG } from '../utils/constants.js';
import { 
    logger,
    debounce,
    safeJsonParse,
    isEmpty,
    generateId,
    formatTimestamp
} from '../utils/helpers.js';

export default class StateManager {
    constructor(consoleType) {
        this.consoleType = consoleType;
        this.stateKey = `consolevo_state_${consoleType}`;

        this.log = logger('StateManager');
        
        // КОНФИГУРАЦИЯ
        this.config = STATE_CONFIG;
        
        this.autoSaveCleanup = null;
        this.stateId = generateId('state_');
        
        this.log.info('Инициализирован', { 
            type: consoleType,
            stateKey: this.stateKey
        });
    }

    // СОХРАНЕНИЕ С ВАЛИДАЦИЕЙ И СЖАТИЕМ (ОБНОВЛЕННОЕ)
    saveState(content, cursorPosition, selections = [], metadata = {}) {
        try {
            const state = {
                content: content || '',
                cursor: cursorPosition || { row: 0, column: 0 },
                selections: selections || [],
                timestamp: Date.now(),
                version: this.config.version,
                stateId: this.stateId,
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

    // ЗАГРУЗКА С ПРОВЕРКОЙ ЦЕЛОСТНОСТИ (БЕЗ ИЗМЕНЕНИЙ)
    loadState() {
        try {
            const saved = localStorage.getItem(this.stateKey);
            if (isEmpty(saved)) {
                this.log.debug('Нет сохраненного состояния');
                return null;
            }

            // ИСПОЛЬЗУЕМ safeJsonParse ИЗ HELPERS
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

    // ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ В РЕДАКТОР
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

    // АВТОСОХРАНЕНИЕ С ДЕБАУНСОМ
    createAutoSave(editor, delay = null) {
        if (!editor) {
            this.log.warn('Редактор не передан для автосохранения');
            return null;
        }

        const saveDelay = delay || this.config.autoSaveDelay;
        
        // ИСПОЛЬЗУЕМ ДЕБАУНС ИЗ HELPERS
        const autoSave = debounce(() => {
            if (!editor.getValue) return;
            
            const content = editor.getValue();
            
            // ИСПОЛЬЗУЕМ НОВЫЕ МЕТОДЫ ИЗ AceEditor
            const cursor = editor.getCursorPosition ? editor.getCursorPosition() : { row: 0, column: 0 };
            const selections = editor.getSelections ? editor.getSelections() : [];
            
            const metadata = {
                sessionId: this.stateId,
                autoSaved: true
            };
            
            this.saveState(content, cursor, selections, metadata);
        }, saveDelay);

        // ОБРАБОТЧИКИ СОБЫТИЙ
        const changeHandler = () => {
            if (editor.session && editor.session.getLength() > 0) {
                autoSave();
            }
        };

        const cursorHandler = () => {
            autoSave();
        };

        // ПОДПИСКА НА СОБЫТИЯ
        if (editor.session) {
            editor.session.on('change', changeHandler);
        }
        
        if (editor.selection) {
            editor.selection.on('changeCursor', cursorHandler);
        }

        this.log.debug('Автосохранение настроено', { 
            delay: saveDelay,
            hasGetSelections: !!editor.getSelections,
            hasGetCursorPosition: !!editor.getCursorPosition
        });

        // ФУНКЦИЯ ОЧИСТКИ
        this.autoSaveCleanup = () => {
            if (editor.session) {
                editor.session.off('change', changeHandler);
            }
            if (editor.selection) {
                editor.selection.off('changeCursor', cursorHandler);
            }
            this.log.debug('Автосохранение отключено');
        };

        return this.autoSaveCleanup;
    }

    //Проверка совместимости с редактором
    checkEditorCompatibility(editor) {
        return {
            hasGetCursorPosition: !!editor.getCursorPosition,
            hasGetSelections: !!editor.getSelections,
            hasMoveCursorToPosition: !!editor.moveCursorToPosition,
            hasRestoreSelections: !!editor.restoreSelections,
            hasSetValue: !!editor.setValue,
            hasGetValue: !!editor.getValue
        };
    }

    //Получение состояния из редактора
    getStateFromEditor(editor) {
        if (!editor) return null;
        
        try {
            const content = editor.getValue ? editor.getValue() : '';
            const cursor = editor.getCursorPosition ? editor.getCursorPosition() : { row: 0, column: 0 };
            const selections = editor.getSelections ? editor.getSelections() : [];
            
            return {
                content,
                cursor,
                selections,
                timestamp: Date.now(),
                version: this.config.version
            };
        } catch (error) {
            this.log.error('Ошибка получения состояния из редактора', { 
                error: error.message 
            });
            return null;
        }
    }

    clearState() {
        try {
            localStorage.removeItem(this.stateKey);
            
            // ОЧИСТКА АВТОСОХРАНЕНИЯ
            if (this.autoSaveCleanup) {
                this.autoSaveCleanup();
                this.autoSaveCleanup = null;
            }
            
            this.log.info('Состояние очищено', { stateKey: this.stateKey });
            return true;
        } catch (error) {
            this.log.error('Ошибка очистки состояния', { error: error.message });
            return false;
        }
    }

    // УТИЛИТЫ
    formatAge(timestamp) {
        const age = Date.now() - timestamp;
        const minutes = Math.floor(age / (1000 * 60));
        const hours = Math.floor(age / (1000 * 60 * 60));
        const days = Math.floor(age / (1000 * 60 * 60 * 24));
        
        if (days > 0) return `${days}д ${hours % 24}ч`;
        if (hours > 0) return `${hours}ч ${minutes % 60}м`;
        return `${minutes}м`;
    }

    getStateInfo() {
        const state = this.loadState();
        if (!state) return null;

        return {
            exists: true,
            age: this.formatAge(state.timestamp),
            contentLength: state.metadata?.contentLength || 0,
            lines: state.metadata?.lines || 0,
            selectionsCount: state.selections?.length || 0,
            timestamp: formatTimestamp(state.timestamp),
            version: state.version,
            truncated: state.metadata?.truncated || false
        };
    }

    // СТАТИСТИКА
    getStats() {
        const state = this.loadState();
        const exists = !!state;
        
        return {
            exists,
            stateKey: this.stateKey,
            consoleType: this.consoleType,
            hasAutoSave: !!this.autoSaveCleanup,
            ...(exists ? this.getStateInfo() : {})
        };
    }

    destroy() {
        this.log.info('StateManager уничтожен', { stateId: this.stateId });
        
        if (this.autoSaveCleanup) {
            this.autoSaveCleanup();
        }
    }
}