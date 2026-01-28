# HistoryModal.js

**HistoryModal** - это модальное окно для просмотра, поиска и управления историей выполненных команд. Позволяет пользователям просматривать выполненные команды, искать по истории, использовать старые команды и управлять историей.

## Конструктор и инициализация

### Параметры конструктора
```javascript
/**
 * Создает экземпляр модального окна истории
 * @param {CommandHistory} historyManager - Менеджер истории команд
 */
constructor(historyManager)
```

### Свойства экземпляра
| Свойство | Тип | Описание |
|----------|-----|----------|
| `historyManager` | `CommandHistory` | Ссылка на менеджер истории |
| `modal` | `HTMLElement \| null` | DOM элемент модального окна |
| `isVisible` | `boolean` | Флаг видимости окна |
| `log` | `Object` | Логгер с методами debug/info/warn/error |
| `config` | `HistoryModalConfig` | Конфигурация модального окна |
| `searchHandler` | `Function` | Дебаунс-функция для поиска |
| `onUseCommand` | `UseCommandCallback \| null` | Колбэк при использовании команды |
| `onClose` | `ModalCallback \| null` | Колбэк при закрытии окна |
| `onShow` | `ModalCallback \| null` | Колбэк при показе окна |
| `keyHandler` | `Function \| null` | Обработчик глобальных клавиш |

### Конфигурация по умолчанию
```javascript
this.config = {
    animationDuration: 300,      // 300ms для анимации
    searchDebounceDelay: 300,    // 300ms дебаунс поиска
    maxDisplayItems: 50,         // Макс. 50 элементов в списке
    modalZIndex: 10000           // Высокий z-index поверх всего
};

this.searchHandler = debounce(this._performSearch.bind(this), this.config.searchDebounceDelay);
```

## Структура DOM

### HTML структура модального окна
```html
<div class="history-modal">
    <div class="modal-overlay"></div>
    <div class="modal-content">
        <!-- Заголовок с поиском -->
        <div class="modal-header">
            <h3><i class="fas fa-history"></i> История команд</h3>
            <div class="modal-controls">
                <div class="search-box">
                    <input type="text" id="history-search" placeholder="Поиск по истории...">
                    <i class="fas fa-search search-icon"></i>
                </div>
                <button class="modal-close" title="Закрыть (Esc)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        
        <!-- Тело модалки -->
        <div class="modal-body">
            <!-- Статистика -->
            <div class="history-stats" id="history-stats">...</div>
            
            <!-- Фильтры -->
            <div class="history-filters">
                <button class="filter-btn active" data-filter="all">Все</button>
                <button class="filter-btn" data-filter="recent">Недавние</button>
            </div>
            
            <!-- Список истории -->
            <div class="history-list-container">
                <div class="history-list" id="history-list"></div>
            </div>
        </div>
        
        <!-- Футер с действиями -->
        <div class="modal-footer">
            <div class="footer-actions">
                <button class="btn btn-outline btn-sm" id="clear-history">
                    <i class="fas fa-trash"></i> Очистить
                </button>
            </div>
            <button class="btn btn-primary" id="close-history">
                <i class="fas fa-times"></i> Закрыть
            </button>
        </div>
    </div>
</div>
```

## Основные методы

### 1. `show()`
**Отображает модальное окно истории**

```javascript
/**
 * @returns {void}
 */
```

**Последовательность действий:**
```javascript
1. Проверка historyManager → если нет, лог и выход
2. Установка isVisible = true
3. Показ modal через style.display = 'block'
4. Анимация появления через requestAnimationFrame
5. Обновление списка команд: updateHistoryList()
6. Фокус на поле поиска: focusSearchInput()
7. Вызов колбэка onShow() если установлен
```

### 2. `hide()`
**Скрывает модальное окно истории**

```javascript
/**
 * @returns {void}
 */
```

**Последовательность действий:**
```javascript
1. Установка isVisible = false
2. Запуск анимации скрытия (удаление класса .show)
3. Через animationDuration (300ms) скрытие modal
4. Вызов колбэка onClose() если установлен
```

### 3. `updateHistoryList(filteredHistory)`
**Обновляет список команд в модальном окне**

```javascript
/**
 * @param {HistoryItem[]} [filteredHistory=null] - Отфильтрованный список
 * @returns {void}
 * @private
 */
```

**Логика отображения:**
```javascript
1. Получение элементов DOM: historyList, statsElement
2. Проверка historyManager → если нет, показ ошибки
3. Получение данных:
   - history = filteredHistory или getRecent(maxDisplayItems)
   - stats = getStats() из historyManager
4. Обновление статистики:
   - Формат: "Показано: X из Y команд • Сегодня: Z"
5. Если история пуста → показ пустого состояния
6. Генерация списка команд:
   - Нумерация в обратном порядке (новые → старые)
   - Форматирование команд через formatCommand()
   - Метаданные через formatHistoryMeta()
   - Кнопки действий (использовать, копировать)
7. Прикрепление обработчиков: attachItemEventListeners()
```

### 4. `_performSearch(query)`
**Выполняет поиск по истории команд**

```javascript
/**
 * @param {string} query - Поисковый запрос
 * @returns {void}
 * @private
 */
```

**Алгоритм:**
```javascript
if (query пустой) → updateHistoryList() // сброс поиска
else:
    results = historyManager.search(query, maxDisplayItems)
    updateHistoryList(results) // показ результатов
```

**Особенности:**
- Использует `debounce(300ms)` для предотвращения частых поисков
- Передает запрос в `historyManager.search()`
- Показывает отфильтрованные результаты

### 5. `applyFilter(filterType)`
**Применяет фильтр к списку истории**

```javascript
/**
 * @param {'all' | 'recent'} filterType - Тип фильтра
 * @returns {void}
 */
```

**Доступные фильтры:**
- `'all'` - все команды (до maxDisplayItems)
- `'recent'` - только 20 последних команд

**Использование:**
```javascript
historyModal.applyFilter('recent'); // Показывает 20 последних команд
```

### 6. `useCommand(command)`
**Использует команду из истории**

```javascript
/**
 * @param {string} command - Команда для использования
 * @returns {void}
 * @private
 */
```

**Логика:**
```javascript
if (onUseCallback && command) {
    log.debug('Использование команды')
    onUseCallback(command) // Передача команды редактору
    hide() // Автоматическое закрытие модалки
}
```

### 7. `copyCommand(command)`
**Копирует команду в буфер обмена**

```javascript
/**
 * @param {string} command - Команда для копирования
 * @returns {void}
 */
```

**Использование:**
```javascript
// При клике на кнопку копирования
historyModal.copyCommand('SELECT * FROM users');
// → команда копируется в буфер обмена
```

### 8. `clearHistory()`
**Очищает всю историю команд**

```javascript
/**
 * @returns {void}
 */
```

**Процесс очистки:**
1. Подтверждение через `confirm()`
2. Вызов `historyManager.clear()`
3. Обновление списка: `updateHistoryList()`
4. Показ уведомления: `showNotification()`
5. Логирование действия

## Вспомогательные методы

### `formatCommand(command)`
**Форматирует команду для отображения**

```javascript
/**
 * @param {string} command - Исходная команда
 * @returns {string} Отформатированная команда
 * @private
 */
```

**Правила форматирования:**
- Команды длиной ≤ 200 символов → отображаются полностью
- Команды длиной > 200 символов → обрезаются + "..."
- HTML экранирование через `escapeHtml()`

### `formatHistoryMeta(item)`
**Форматирует метаданные для отображения**

```javascript
/**
 * @param {HistoryItem} item - Элемент истории
 * @returns {string} Отформатированные метаданные
 * @private
 */
```

**Формат метаданных:**
```javascript
"12.01.2023 14:30 • 0.123s • ✓"
// где:
// - formatTimestamp(timestamp)
// - executionTime (если есть)
// - success (✓ или ✗)
```

### `attachItemEventListeners(history)`
**Прикрепляет обработчики к элементам списка**

```javascript
/**
 * @param {HistoryItem[]} history - Список элементов истории
 * @returns {void}
 * @private
 */
```

**Настраиваемые события:**
1. **Кнопка "Использовать"** → `useCommand()`
2. **Кнопка "Копировать"** → `copyCommand()`
3. **Двойной клик на элементе** → `useCommand()`
4. **Клик на элементе** → `selectItem()` (выделение)

## Обработчики событий

### DOM события
| Элемент | Событие | Действие |
|---------|---------|----------|
| `.modal-overlay` | `click` | `hide()` |
| `.modal-close` | `click` | `hide()` |
| `#close-history` | `click` | `hide()` |
| `#clear-history` | `click` | `clearHistory()` |
| `#history-search` | `input` | `searchHandler(value)` |
| `.filter-btn` | `click` | `applyFilter(data-filter)` |
| `.history-use-btn` | `click` | `useCommand(command)` |
| `.history-copy-btn` | `click` | `copyCommand(command)` |
| `.history-item` | `dblclick` | `useCommand(command)` |
| `.history-item` | `click` | `selectItem(item)` |

### Глобальные события
```javascript
// Обработка клавиатуры
document.addEventListener('keydown', this.keyHandler);

// В keyHandler:
if (e.key === 'Escape' && this.isVisible) {
    e.preventDefault();
    this.hide();
}
```

## Интеграция с системой

### Использование колбэков
```javascript
// Пример интеграции с редактором
historyModal.onUseCommand = (command) => {
    editor.setValue(command);
    editor.focus();
};

historyModal.onShow = () => {
    console.log('История открыта');
};

historyModal.onClose = () => {
    console.log('История закрыта');
};
```

### Интеграция с CommandHistory
```javascript
// Создание и связывание
const historyManager = new CommandHistory('php');
const historyModal = new HistoryModal(historyManager);

// Передача в ConsoleManager
consoleManager.modules.history = historyManager;
consoleManager.historyModal = historyModal;
```

## Примеры использования

### Базовое использование
```javascript
// Инициализация
const historyManager = new CommandHistory('php', 100);
const historyModal = new HistoryModal(historyManager);

// Открытие модалки
document.getElementById('show-history').addEventListener('click', () => {
    historyModal.show();
});

// Использование команды из истории
historyModal.onUseCommand = (command) => {
    document.getElementById('code-editor').value = command;
};

// Автоматическое добавление в историю
function executeCode(code) {
    // ... выполнение кода
    historyManager.add(code, {
        executionTime: result.time,
        success: result.success
    });
}
```

### Расширенная конфигурация
```javascript
const historyModal = new HistoryModal(historyManager);

// Кастомизация колбэков
historyModal.onUseCommand = (command) => {
    // Вставка в редактор с позиционированием
    const editor = ace.edit('editor');
    editor.setValue(command, 1);
    editor.focus();
    editor.moveCursorTo(0, 0);
};

// Дополнительные действия
historyModal.onShow = () => {
    analytics.track('history_opened');
    document.body.classList.add('modal-open');
};

historyModal.onClose = () => {
    analytics.track('history_closed');
    document.body.classList.remove('modal-open');
};
```

### Поиск и фильтрация
```javascript
// Программный поиск
function searchInHistory(query) {
    historyModal.show();
    const searchInput = document.querySelector('#history-search');
    searchInput.value = query;
    searchInput.dispatchEvent(new Event('input'));
}

// Применение фильтров
function showRecentCommands() {
    historyModal.show();
    historyModal.applyFilter('recent');
}
```

## Логирование

### Уровни логирования
```javascript
this.log.info('Инициализация', { hasHistoryManager: !!historyManager })
this.log.debug('Модальное окно создано')
this.log.debug('Модальное окно показано')
this.log.debug('Список истории обновлен', { items, filtered })
this.log.debug('Выполнен поиск по истории', { query, results })
this.log.debug('Применен фильтр истории', { filter, items })
this.log.debug('Команда скопирована', { commandLength })
this.log.warn('HistoryManager не доступен')
this.log.info('История команд очищена')
```

### Контекст логирования
- `items` - количество отображаемых команд
- `filtered` - флаг фильтрации
- `query` - поисковый запрос
- `results` - количество найденных команд
- `commandLength` - длина скопированной команды

## Производительность

### Оптимизации
1. **Debounce поиска** - 300ms для предотвращения частых обновлений
2. **Лимит отображаемых элементов** - максимум 50 команд
3. **Единоразовое создание DOM** - при инициализации
4. **Event delegation** - обработчики на контейнере (через прикрепление)
5. **Экранирование HTML** - безопасное отображение команд

### Память
- DOM элементы создаются один раз при инициализации
- События очищаются при уничтожении
- Ссылки освобождаются при destroy()

## Безопасность

### Меры защиты
1. **HTML экранирование** - `escapeHtml()` для всех пользовательских команд
2. **Безопасный парсинг** - использование `escapeHtml()` из helpers
3. **Подтверждение деструктивных действий** - confirm() для очистки истории
4. **Изоляция данных** - только чтение из historyManager

### Для отображения команд
```javascript
// Безопасное отображение
this.escapeHtml(command); // вместо innerHTML = command
```

## Уничтожение

```javascript
/**
 * Уничтожает модальное окно и освобождает ресурсы
 * @returns {void}
 */
destroy() {
    this.log.info('HistoryModal уничтожен');
    
    // Удаление из DOM
    if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
    }
    
    // Очистка глобальных обработчиков
    if (this.keyHandler) {
        document.removeEventListener('keydown', this.keyHandler);
    }
    
    // Очистка ссылок
    this.modal = null;
    this.historyManager = null;
    this.onUseCommand = null;
    this.onClose = null;
    this.onShow = null;
    this.keyHandler = null;
}
```