import { 
    logger,
    debounce,
    formatTimestamp,
    createElement,
    escapeHtml,
} from '../utils/helpers.js';

/**
 * @typedef {Object} HistoryModalConfig
 * @property {number} animationDuration - Длительность анимации в миллисекундах
 * @property {number} searchDebounceDelay - Задержка дебаунса поиска в миллисекундах
 * @property {number} maxDisplayItems - Максимальное количество отображаемых элементов
 * @property {number} modalZIndex - Z-index модального окна
 */

/**
 * @typedef {Object} HistoryItem
 * @property {string} command - Текст команды
 * @property {number} timestamp - Временная метка создания
 * @property {Object} [metadata] - Дополнительные метаданные
 */

/**
 * @typedef {Function} UseCommandCallback
 * @param {string} command - Команда для использования
 * @returns {void}
 */

/**
 * @typedef {Function} ModalCallback
 * @returns {void}
 */

/**
 * Модальное окно для просмотра и управления историей команд
 * @class HistoryModal
 */
export default class HistoryModal {
    /**
     * Создает экземпляр модального окна истории
     * @param {CommandHistory} historyManager - Менеджер истории команд
     */
    constructor(historyManager) {
        /**
         * Менеджер истории команд
         * @type {CommandHistory}
         */
        this.historyManager = historyManager;
        
        /**
         * DOM элемент модального окна
         * @type {HTMLElement|null}
         */
        this.modal = null;
        
        /**
         * Флаг видимости модального окна
         * @type {boolean}
         */
        this.isVisible = false;
        
        /**
         * Логгер
         * @type {Object}
         */
        this.log = logger('HistoryModal');
        
        /**
         * Конфигурация модального окна
         * @type {HistoryModalConfig}
         */
        this.config = {
            animationDuration: 300,
            searchDebounceDelay: 300,
            maxDisplayItems: 50,
            modalZIndex: 10000
        };
        
        /**
         * Дебаунс функция для поиска
         * @type {Function}
         */
        this.searchHandler = debounce(this._performSearch.bind(this), this.config.searchDebounceDelay);
        
        /**
         * Колбэк при использовании команды
         * @type {UseCommandCallback|null}
         */
        this.onUseCommand = null;
        
        /**
         * Колбэк при закрытии модального окна
         * @type {ModalCallback|null}
         */
        this.onClose = null;
        
        /**
         * Колбэк при показе модального окна
         * @type {ModalCallback|null}
         */
        this.onShow = null;
        
        /**
         * Обработчик глобальных клавиш
         * @type {Function|null}
         */
        this.keyHandler = null;
        
        this.init();
        
        this.log.info('Инициализирован', { 
            hasHistoryManager: !!historyManager 
        });
    }

    /**
     * Инициализирует модальное окно
     * @returns {void}
     * @private
     */
    init() {
        this.createModal();
        this.setupGlobalListeners();
    }

    /**
     * Создает DOM структуру модального окна
     * @returns {void}
     * @private
     */
    createModal() {
        // СОЗДАЕМ МОДАЛЬНОЕ ОКНО С ПОМОЩЬЮ createElement
        this.modal = createElement('div', 'history-modal');
        this.modal.style.zIndex = this.config.modalZIndex;
        
        this.modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-history"></i>
                        История команд
                    </h3>
                    <div class="modal-controls">
                        <div class="search-box">
                            <input type="text" id="history-search" placeholder="Поиск по истории..." class="search-input">
                            <i class="fas fa-search search-icon"></i>
                        </div>
                        <button class="modal-close" title="Закрыть (Esc)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="modal-body">
                    <div class="history-stats" id="history-stats">
                        <span class="stats-text">Загрузка...</span>
                    </div>
                    
                    <div class="history-filters">
                        <button class="filter-btn active" data-filter="all">Все</button>
                        <button class="filter-btn" data-filter="recent">Недавние</button>
                    </div>
                    
                    <div class="history-list-container">
                        <div class="history-list" id="history-list"></div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div class="footer-actions">
                        <button class="btn btn-outline btn-sm" id="clear-history" title="Очистить историю">
                            <i class="fas fa-trash"></i> Очистить
                        </button>
                    </div>
                    <button class="btn btn-primary" id="close-history">
                        <i class="fas fa-times"></i> Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.setupEventListeners();
        
        this.log.debug('Модальное окно создано');
    }

    /**
     * Настраивает обработчики событий для элементов модального окна
     * @returns {void}
     * @private
     */
    setupEventListeners() {
        // ЗАКРЫТИЕ МОДАЛКИ
        const overlay = this.modal.querySelector('.modal-overlay');
        const closeBtn = this.modal.querySelector('.modal-close');
        const closeHistoryBtn = this.modal.querySelector('#close-history');

        [overlay, closeBtn, closeHistoryBtn].forEach(el => {
            el.addEventListener('click', () => this.hide());
        });

        // ОЧИСТКА ИСТОРИИ
        const clearHistoryBtn = this.modal.querySelector('#clear-history');
        clearHistoryBtn.addEventListener('click', () => {
            this.clearHistory();
        });

        // ПОИСК
        const searchInput = this.modal.querySelector('#history-search');
        searchInput.addEventListener('input', (e) => {
            this.searchHandler(e.target.value);
        });

        // ФИЛЬТРЫ
        const filterButtons = this.modal.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyFilter(e.target.dataset.filter);
                
                // АКТИВНЫЙ ФИЛЬТР
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        this.log.debug('Обработчики событий настроены');
    }

    /**
     * Настраивает глобальные обработчики событий (клавиши)
     * @returns {void}
     * @private
     */
    setupGlobalListeners() {
        // ГЛОБАЛЬНЫЕ КЛАВИШИ
        this.keyHandler = (e) => {
            if (!this.isVisible) return;
            
            switch(e.key) {
                case 'Escape':
                    e.preventDefault();
                    this.hide();
                    break;
            }
        };

        document.addEventListener('keydown', this.keyHandler);
    }

    /**
     * Показывает модальное окно истории
     * @returns {void}
     * @example
     * historyModal.show(); // Открывает модальное окно
     */
    show() {
        if (!this.historyManager) {
            this.log.warn('HistoryManager не доступен');
            return;
        }

        this.isVisible = true;
        this.modal.style.display = 'block';
        
        // АНИМАЦИЯ ПОЯВЛЕНИЯ
        requestAnimationFrame(() => {
            this.modal.classList.add('show');
        });

        this.updateHistoryList();
        this.focusSearchInput();
        
        this.log.debug('Модальное окно показано');
        
        // УВЕДОМЛЕНИЕ СЛУШАТЕЛЕЙ
        if (this.onShow) {
            this.onShow();
        }
    }

    /**
     * Скрывает модальное окно истории
     * @returns {void}
     * @example
     * historyModal.hide(); // Закрывает модальное окно
     */
    hide() {
        this.isVisible = false;
        this.modal.classList.remove('show');
        
        setTimeout(() => {
            if (!this.isVisible) {
                this.modal.style.display = 'none';
            }
        }, this.config.animationDuration);

        this.log.debug('Модальное окно скрыто');
        
        // УВЕДОМЛЕНИЕ СЛУШАТЕЛЕЙ
        if (this.onClose) {
            this.onClose();
        }
    }

    /**
     * Обновляет список истории команд
     * @param {HistoryItem[]} [filteredHistory=null] - Отфильтрованный список истории
     * @returns {void}
     * @private
     */
    updateHistoryList(filteredHistory = null) {
        const historyList = this.modal.querySelector('#history-list');
        const statsElement = this.modal.querySelector('#history-stats');
        
        if (!this.historyManager) {
            historyList.innerHTML = '<div class="history-empty">HistoryManager не доступен</div>';
            return;
        }

        const history = filteredHistory || this.historyManager.getRecent(this.config.maxDisplayItems);
        const stats = this.historyManager.getStats();
        
        // ОБНОВЛЯЕМ СТАТИСТИКУ
        statsElement.innerHTML = `
            <span class="stats-text">
                Показано: ${history.length} из ${stats.total} команд
                ${stats.today > 0 ? `• Сегодня: ${stats.today}` : ''}
            </span>
        `;

        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-inbox"></i>
                    <p>История команд пуста</p>
                    <small>Выполненные команды будут появляться здесь</small>
                </div>
            `;
            return;
        }

        // СОЗДАЕМ СПИСОК КОМАНД
        historyList.innerHTML = history.map((item, index) => `
            <div class="history-item" data-index="${index}" data-command="${this.escapeHtml(item.command)}">
                <div class="history-item-main">
                    <div class="history-number">${history.length - index}</div>
                    <div class="history-content">
                        <div class="history-command">${this.formatCommand(item.command)}</div>
                        <div class="history-meta">
                            ${this.formatHistoryMeta(item)}
                        </div>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="history-use-btn" title="Использовать эту команду (Enter)">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="history-copy-btn" title="Копировать команду">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.attachItemEventListeners(history);
        
        this.log.debug('Список истории обновлен', { 
            items: history.length,
            filtered: !!filteredHistory
        });
    }

    /**
     * Прикрепляет обработчики событий к элементам списка истории
     * @param {HistoryItem[]} history - Список элементов истории
     * @returns {void}
     * @private
     */
    attachItemEventListeners(history) {
        const historyList = this.modal.querySelector('#history-list');
        
        historyList.querySelectorAll('.history-use-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.useCommand(history[index].command);
            });
        });

        historyList.querySelectorAll('.history-copy-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.copyCommand(history[index].command);
            });
        });

        // ДВОЙНОЙ КЛИК И НАВИГАЦИЯ
        historyList.querySelectorAll('.history-item').forEach((item, index) => {
            item.addEventListener('dblclick', () => {
                this.useCommand(history[index].command);
            });
            
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.history-actions')) {
                    this.selectItem(item, index);
                }
            });
        });
    }

    /**
     * Выделяет выбранный элемент в списке
     * @param {HTMLElement} item - DOM элемент истории
     * @param {number} index - Индекс элемента
     * @returns {void}
     * @private
     */
    selectItem(item, index) {
        // Убираем выделение у всех элементов
        this.modal.querySelectorAll('.history-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Выделяем текущий элемент
        item.classList.add('selected');
        
        this.log.debug('Элемент истории выбран', { index });
    }

    /**
     * Выполняет поиск по истории команд
     * @param {string} query - Поисковый запрос
     * @returns {void}
     * @private
     */
    _performSearch(query) {
        if (!query.trim()) {
            this.updateHistoryList();
            return;
        }

        const results = this.historyManager.search(query, this.config.maxDisplayItems);
        this.updateHistoryList(results);
        
        this.log.debug('Выполнен поиск по истории', {
            query: query,
            results: results.length
        });
    }

    /**
     * Применяет фильтр к списку истории
     * @param {'all' | 'recent'} filterType - Тип фильтра
     * @returns {void}
     * @example
     * historyModal.applyFilter('recent'); // Показывает только недавние команды
     */
    applyFilter(filterType) {
        let filteredHistory = [];
        
        switch(filterType) {
            case 'recent':
                filteredHistory = this.historyManager.getRecent(20);
                break;
            default:
                filteredHistory = this.historyManager.getRecent(this.config.maxDisplayItems);
        }
        
        this.updateHistoryList(filteredHistory);
        
        this.log.debug('Применен фильтр истории', { 
            filter: filterType,
            items: filteredHistory.length
        });
    }

    /**
     * Использует команду из истории
     * @param {string} command - Команда для использования
     * @returns {void}
     * @private
     */
    useCommand(command) {
        if (this.onUseCommand && command) {
            this.log.debug('Использование команды из истории', {
                commandLength: command.length
            });
            
            this.onUseCommand(command);
            this.hide();
        }
    }

    /**
     * Копирует команду в буфер обмена
     * @param {string} command - Команда для копирования
     * @returns {void}
     * @example
     * historyModal.copyCommand('SELECT * FROM users'); // Копирует команду в буфер
     */
    copyCommand(command) {
        navigator.clipboard.writeText(command).then(() => {
            this.showNotification('Команда скопирована в буфер обмена', 'success');
        }).catch(() => {
            this.showNotification('Ошибка копирования команды', 'error');
        });
        
        this.log.debug('Команда скопирована', { commandLength: command.length });
    }

    /**
     * Очищает всю историю команд
     * @returns {void}
     * @example
     * historyModal.clearHistory(); // Очищает историю с подтверждением
     */
    clearHistory() {
        if (confirm('Вы уверены, что хотите очистить всю историю команд? Это действие нельзя отменить.')) {
            this.historyManager.clear();
            this.updateHistoryList();
            this.showNotification('История команд очищена', 'success');
            
            this.log.info('История команд очищена');
        }
    }

    /**
     * Скачивает контент как файл
     * @param {string} content - Содержимое файла
     * @param {string} filename - Имя файла
     * @returns {void}
     * @private
     */
    downloadAsFile(content, filename) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Форматирует команду для отображения (сокращает длинные команды)
     * @param {string} command - Исходная команда
     * @returns {string} Отформатированная команда
     * @private
     */
    formatCommand(command) {
        if (!command) return '';
        
        const maxLength = 200;
        if (command.length <= maxLength) {
            return this.escapeHtml(command);
        }
        
        return this.escapeHtml(command.substring(0, maxLength)) + 
               '<span class="ellipsis">...</span>';
    }

    /**
     * Форматирует метаданные истории для отображения
     * @param {HistoryItem} item - Элемент истории
     * @returns {string} Отформатированные метаданные
     * @private
     */
    formatHistoryMeta(item) {
        const meta = [];
        
        if (item.timestamp) {
            meta.push(formatTimestamp(item.timestamp));
        }
        
        if (item.metadata?.executionTime) {
            meta.push(`${item.metadata.executionTime.toFixed(3)}s`);
        }
        
        if (item.metadata?.success !== undefined) {
            meta.push(item.metadata.success ? '✓' : '✗');
        }
        
        return meta.join(' • ');
    }

    /**
     * Устанавливает фокус на поле поиска
     * @returns {void}
     * @private
     */
    focusSearchInput() {
        const searchInput = this.modal.querySelector('#history-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    /**
     * Показывает уведомление (заглушка)
     * @param {string} message - Текст сообщения
     * @param {'info' | 'success' | 'error'} [type='info'] - Тип уведомления
     * @returns {void}
     * @private
     */
    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * Экранирует HTML символы
     * @param {string} text - Текст для экранирования
     * @returns {string} Экранированный текст
     * @private
     */
    escapeHtml(text) {
        return escapeHtml(text);
    }

    /**
     * Уничтожает модальное окно и освобождает ресурсы
     * @returns {void}
     * @example
     * historyModal.destroy(); // Удаляет модальное окно из DOM
     */
    destroy() {
        this.log.info('HistoryModal уничтожен');
        
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }
        
        this.modal = null;
        this.historyManager = null;
        this.onUseCommand = null;
        this.onClose = null;
        this.onShow = null;
        this.keyHandler = null;
    }
}