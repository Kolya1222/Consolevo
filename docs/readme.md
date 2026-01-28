# Общие схемы работы

1. Пользователь → Кнопка в Evolution CE → Загружается Consolevo
2. Blade шаблоны → Рендерят интерфейс → Загружают JS
3. ConsoleManager → Инициализирует модули → Настраивает Ace Editor
4. Пользователь → Вводит код → Нажимает "Выполнить"
5. ConsoleManager → Получает код → Отправляет через ApiClient
6. Контроллер → Выполняет код → Возвращает результат
7. OutputManager → Форматирует результат → Показывает пользователю
8. StateManager → Сохраняет состояние → Для будущих сессий


## Контроллеры

```text
ConsoleController
    └── index() → Главная страница (дашборд)

PhpConsoleController
    ├── index() → Страница PHP консоли
    └── execute() → Выполнение PHP кода

SqlConsoleController
    ├── index() → Страница SQL консоли
    ├── execute() → Выполнение SQL запросов
    └── getTablesForAutocomplete() → Структура БД

AnalysisController
    └── getUnifiedData() → Данные Evo CMS для автодополнения
```

# Всеобщая схема работы

```mermaid
graph TB
    %% Ядро системы
    EVO[Evolution CMS] --> SP[ConsolevoServiceProvider]
    
    %% Бэкенд слои
    SP --> RT[routes.php]
    RT --> CTRL[Контроллеры]
    
    CTRL --> CC[ConsoleController<br/>- Главная страница]
    CTRL --> PCC[PhpConsoleController<br/>- PHP выполнение]
    CTRL --> SCC[SqlConsoleController<br/>- SQL выполнение]
    CTRL --> AC[AnalysisController<br/>- Анализ Evo CMS]
    
    PCC --> PHP_SEC[Безопасность PHP<br/>• Проверка опасного кода<br/>• Ограничение времени/памяти<br/>• Изоляция контекста]
    
    SCC --> SQL_SEC[Безопасность SQL<br/>• Валидация синтаксиса<br/>• Блокировка опасных операций<br/>• Автопрефиксы таблиц]
    
    AC --> EA[EvoAnalyzer<br/>• Сканирование классов<br/>• Извлечение методов/свойств<br/>• Парсинг параметров]
    
    %% Фронтенд слои
    RT --> VIEWS[Blade Views]
    
    VIEWS --> LAYOUT[layouts/app.blade.php<br/>- Базовый макет]
    VIEWS --> CONSOLE[console.blade.php<br/>- Дашборд]
    VIEWS --> PHP_VIEW[php-console.blade.php<br/>- PHP редактор]
    VIEWS --> SQL_VIEW[sql-console.blade.php<br/>- SQL редактор]
    
    LAYOUT --> PARTIALS[Partial Components<br/>• console-card<br/>• console-header<br/>• status-bar]
    
    %% JavaScript архитектура
    VIEWS --> JS[JavaScript Modules]
    
    JS --> CM[ConsoleManager<br/>Фасад системы]
    
    CM --> AE[AceEditor<br/>• Подсветка синтаксиса<br/>• Автодополнение<br/>• Сниппеты]
    CM --> APIC[ApiClient<br/>• HTTP запросы<br/>• Повторы/таймауты<br/>• Обработка ошибок]
    CM --> OM[OutputManager<br/>• Умный вывод<br/>• Форматирование<br/>• Таблицы SQL]
    CM --> SM[StateManager<br/>• Сохранение состояния<br/>• LocalStorage]
    CM --> PM[PreferencesManager<br/>• Настройки пользователя]
    CM --> CH[CommandHistory<br/>• История команд]
    
    %% Вспомогательные модули
    JS --> UTILS[Utils]
    UTILS --> CONSTANTS[constants.js]
    UTILS --> HELPERS[helpers.js]
    UTILS --> COMPLETION[completion-data.js]
    UTILS --> ANALYZE_EVO[analyze-evo.js]
    
    %% Интеграция с Evolution
    SP --> PLUGIN[plugin.AddConsole.php]
    PLUGIN --> EVO_BTN[Кнопка в дереве Evolution<br/>• modx.popup / window.open<br/>• Конфиг use_modx_popup]
    
    %% Стили
    VIEWS --> CSS[CSS Assets<br/>• Дизайн-система<br/>• Анимации<br/>• Адаптивность]
    
    %% Потоки данных
    PCC -.->|JSON API| APIC
    SCC -.->|JSON API| APIC
    AC -.->|JSON API| APIC
    EA -.->|Данные анализа| AC
    ANALYZE_EVO -.->|Запрос данных| AC
    COMPLETION -.->|Генерация подсказок| SCC
```