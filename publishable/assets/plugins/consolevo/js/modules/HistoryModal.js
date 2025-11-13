import { 
    logger,
    debounce,
    formatTimestamp,
    createElement,
    escapeHtml,
} from '../utils/helpers.js';

export default class HistoryModal {
    constructor(historyManager) {
        this.historyManager = historyManager;
        this.modal = null;
        this.isVisible = false;
        
        // ИСПОЛЬЗУЕМ ЛОГГЕР ИЗ HELPERS
        this.log = logger('HistoryModal');
        
        // КОНФИГУРАЦИЯ
        this.config = {
            animationDuration: 300,
            searchDebounceDelay: 300,
            maxDisplayItems: 50,
            modalZIndex: 10000
        };
        
        // ДЕБАУНС ДЛЯ ПОИСКА
        this.searchHandler = debounce(this._performSearch.bind(this), this.config.searchDebounceDelay);
        
        // КОЛБЭКИ
        this.onUseCommand = null;
        this.onClose = null;
        
        this.init();
        
        this.log.info('Инициализирован', { 
            hasHistoryManager: !!historyManager 
        });
    }

    init() {
        this.createModal();
        this.setupGlobalListeners();
    }

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
                        <button class="filter-btn" data-filter="successful">Успешные</button>
                    </div>
                    
                    <div class="history-list-container">
                        <div class="history-list" id="history-list"></div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div class="footer-actions">
                        <button class="btn btn-outline btn-sm" id="export-history" title="Экспорт истории">
                            <i class="fas fa-download"></i> Экспорт
                        </button>
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

        // ЭКСПОРТ ИСТОРИИ
        const exportHistoryBtn = this.modal.querySelector('#export-history');
        exportHistoryBtn.addEventListener('click', () => {
            this.exportHistory();
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

    setupGlobalListeners() {
        // ГЛОБАЛЬНЫЕ КЛАВИШИ
        this.keyHandler = (e) => {
            if (!this.isVisible) return;
            
            switch(e.key) {
                case 'Escape':
                    e.preventDefault();
                    this.hide();
                    break;
                case 'Enter':
                    if (document.activeElement.id === 'history-search') {
                        e.preventDefault();
                        this.useFirstSearchResult();
                    }
                    break;
                case 'ArrowUp':
                case 'ArrowDown':
                    if (document.activeElement.id === 'history-search') {
                        e.preventDefault();
                        this.navigateSearchResults(e.key === 'ArrowDown' ? 1 : -1);
                    }
                    break;
            }
        };

        document.addEventListener('keydown', this.keyHandler);
    }

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

    // ОБНОВЛЕНИЕ СПИСКА ИСТОРИИ
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

    // ПРИКРЕПЛЕНИЕ ОБРАБОТЧИКОВ К ЭЛЕМЕНТАМ
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

    // ВЫБОР ЭЛЕМЕНТА
    selectItem(item, index) {
        // Убираем выделение у всех элементов
        this.modal.querySelectorAll('.history-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Выделяем текущий элемент
        item.classList.add('selected');
        
        this.log.debug('Элемент истории выбран', { index });
    }

    // ПОИСК ПО ИСТОРИИ
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

    // ПРИМЕНЕНИЕ ФИЛЬТРА
    applyFilter(filterType) {
        let filteredHistory = [];
        
        switch(filterType) {
            case 'recent':
                filteredHistory = this.historyManager.getRecent(20);
                break;
            case 'successful':
                filteredHistory = this.historyManager.getAll(item => item.metadata?.success);
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

    // ИСПОЛЬЗОВАНИЕ КОМАНДЫ
    useCommand(command) {
        if (this.onUseCommand && command) {
            this.log.debug('Использование команды из истории', {
                commandLength: command.length
            });
            
            this.onUseCommand(command);
            this.hide();
        }
    }

    // КОПИРОВАНИЕ КОМАНДЫ
    copyCommand(command) {
        navigator.clipboard.writeText(command).then(() => {
            this.showNotification('Команда скопирована в буфер обмена', 'success');
        }).catch(() => {
            this.showNotification('Ошибка копирования команды', 'error');
        });
        
        this.log.debug('Команда скопирована', { commandLength: command.length });
    }

    // ОЧИСТКА ИСТОРИИ
    clearHistory() {
        if (confirm('Вы уверены, что хотите очистить всю историю команд? Это действие нельзя отменить.')) {
            this.historyManager.clear();
            this.updateHistoryList();
            this.showNotification('История команд очищена', 'success');
            
            this.log.info('История команд очищена');
        }
    }

    // ЭКСПОРТ ИСТОРИИ
    exportHistory() {
        if (!this.historyManager.export) {
            this.showNotification('Экспорт истории не поддерживается', 'warning');
            return;
        }

        const historyData = this.historyManager.export();
        this.downloadAsFile(historyData, `consolevo-history-${new Date().toISOString().split('T')[0]}.json`);
        
        this.showNotification('История экспортирована', 'success');
        this.log.info('История экспортирована');
    }

    // СКАЧИВАНИЕ ФАЙЛА
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

    // УТИЛИТЫ
    formatCommand(command) {
        if (!command) return '';
        
        const maxLength = 200;
        if (command.length <= maxLength) {
            return this.escapeHtml(command);
        }
        
        return this.escapeHtml(command.substring(0, maxLength)) + 
               '<span class="ellipsis">...</span>';
    }

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

    focusSearchInput() {
        const searchInput = this.modal.querySelector('#history-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    showNotification(message, type = 'info') {
        // МОЖНО ИНТЕГРИРОВАТЬ С СИСТЕМОЙ УВЕДОМЛЕНИЙ
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    destroy() {
        this.log.info('HistoryModal уничтожен');
        
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }
    }

    // Навигация по результатам поиска
    navigateSearchResults(direction) {
        const items = this.modal.querySelectorAll('.history-item');
        if (items.length === 0) return;

        const currentSelected = this.modal.querySelector('.history-item.selected');
        let currentIndex = currentSelected ? 
            Array.from(items).indexOf(currentSelected) : -1;

        let newIndex;
        if (direction === 1) { // Вниз
            newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else { // Вверх
            newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }

        this.selectItem(items[newIndex], newIndex);
        
        // Прокручиваем к выбранному элементу
        items[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Использование первого результата поиска
    useFirstSearchResult() {
        const firstItem = this.modal.querySelector('.history-item');
        if (firstItem) {
            const command = firstItem.dataset.command;
            this.useCommand(command);
        }
    }

    // Экранирование HTML (теперь использует импортированную функцию)
    escapeHtml(text) {
        return escapeHtml(text); // Используем импортированную функцию
    }
}