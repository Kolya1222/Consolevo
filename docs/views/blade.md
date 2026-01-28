# Общая структура blade

```text
                     ┌────────────────────────────────────────────┐
                     │                Evolution CE                │──┐
                     └────────────────────┬───────────────────────┘  │
                                          │                          │
                     ┌────────────────────▼───────────────────────┐  │
                     │         ConsolevoServiceProvider           │  │
                     └────────────┬───────────────────────────────┘  │
                                  │                   ┌──────────────┘
                                  │                   │
                           ┌──────▼──────┐   ┌────────▼───────┐
                           │   Шаблоны   │   │    Событие     │
                           └──────┬──────┘   └───────┬────────┘
                                  │                  │
                                  │                  │
                     ┌────────────▼──────────────────▼────────────┐
                     │                Blade Views                 │
                     │  ┌──────────────────────────────────────┐  │
                     │  │  layouts/app.blade.php (БАЗОВЫЙ)     │  │
                     │  │  - CSS переменные (дизайн-система)   │  │
                     │  │  - Анимации                          │  │
                     │  │  - Глобальные стили                  │  │
                     │  └─────────┬────────────────────────────┘  │
                     │            │ extends                       │
                     │  ┌─────────▼────────────────────────────┐  │
                     │  │  partials/ (КОМПОНЕНТЫ)              │  │
                     │  │  • console-header.blade.php          │  │
                     │  │  • console-card.blade.php            │  │
                     │  │  • status-bar.blade.php              │  │
                     │  └──────────────────────────────────────┘  │
                     │            │ include/@include              │
                     │  ┌─────────▼────────────────────────────┐  │
                     │  │  Основные views (СТРАНИЦЫ)           │  │
                     │  │  • console.blade.php     (главная)   │  │
                     │  │  • php-console.blade.php (PHP)       │  │
                     │  │  • sql-console.blade.php (SQL)       │  │
                     │  │  • tree-button.blade.php (кнопка)    │  │
                     │  └──────────────────────────────────────┘  │
                     └────────────────────────────────────────────┘
```

## Базовый макет (app.blade.php)

**Назначение:** Корневой HTML-шаблон для всех страниц консоли

### Ключевые компоненты:

- CSS (Переменные, Анимации, Кастомный скроллбар)
- Мета-теги (CSRF токен, кодировка, viewport)
- Подключение FontAwesome
- Структура макета консоли

### Структура макета консоли:

```text
app.blade.php
        │
        ├─ @yield('title') - название страницы
        ├─ @yield('styles') - дополнительные стили
        ├─ @yield('content') - основное содержимое
        └─ @yield('scripts') - дополнительный JavaScript
```

## Частички (partials)

### Карточка редактора (console-card.blade.php)

**Назначение:** Универсальная карточка для редактора кода с панелью инструментов.

#### Структура карточки редактора:

```
console-card.blade.php
├── Заголовок карточки (иконка + название)
├── Панель инструментов:
│   ├─ Кнопка выполнения (execute-editor)
│   ├─ Кнопка очистки редактора (clear-editor)
│   ├─ Кнопка очистки вывода (clear-console)
│   ├─ Выбор темы (theme-selector)
│   ├─ Выбор размера шрифта (font-size-selector)
│   ├─ Переключатель переноса строк (wrap-mode-toggle)
│   └─ Информация о редакторе (курсор, размер)
├── Контейнер для Ace Editor (code-editor)
│   └─ data-атрибуты для маршрутов
└── Контейнер вывода (console-output)
```

#### Контекст использования:

Используется в php-console.blade.php и sql-console.blade.php
Переменные: $icon, $title, $executeRoute, $consoleType, $initialMessages

### Шапка консоли (console-header.blade.php)

**Назначение:** Навигационная шапка с кнопками и логотипом

#### Контекст использования:

Используется в php-console.blade.php и sql-console.blade.php
Переменные: $icon, $title, $navigation

#### Особенности:
- Динамические кнопки навигации через ```@foreach```
- Кнопка "Назад" на главную 
- Кнопка "История" (id="show-history")

### Статус бар

**Назначение:** Отображение статусной информации внизу страницы

#### Структура данных:

```php
$items = [
    ['icon' => 'fas fa-code', 'text' => 'Готов', 'dynamic' => 'status-text'],
    ['icon' => 'fas fa-database', 'text' => 'MySQL 8.0'],
    // ...
]
```

#### Динамическое обновление:

- Поддержка динамического контента через id="{{ $item['dynamic'] }}"
- Используется для обновления статуса выполнения

## Основные шаблоны

### Главная панель управления (console.blade.php)

**Назначение:** Дашборд с навигацией по функциям консоли

#### Структура панели управления:

```text
@extends('consolevo::layouts.app')
    ↓
@section('title', 'Evolution Console')
    ↓
@section('styles') → подключает console.css
    ↓
@section('content')
    ├── Header (логотип + статус)
    ├── Nav Cards (карточки навигации)
    │   ├── PHP Консоль → route('consolevo.php')
    │   └── SQL Консоль → route('consolevo.sql')
    └── @include('status-bar')
```

### PHP редактор (php-console.blade.php)

**Назначение:** Полнофункциональная PHP консоль с Ace Editor

#### Структура и зависимости:

```text
@extends('consolevo::layouts.app')
    ↓
@section('title', 'PHP Console - Evolution Console')
    ↓
@section('styles') → подключает php-sql-console.css
    ↓
@section('content')
    ├── @include('console-header') с навигацией на SQL
    ├── @include('console-card') с параметрами:
    │   ├── executeRoute: route('consolevo.php.execute')
    │   └── consoleType: 'php'
    └── @include('status-bar') с динамическими элементами
        ↓
@section('scripts')
    ├── Ace Editor core
    ├── mode-php.js, snippets/php.js
    ├── темы (4 варианта)
    └── console.js (главный JS файл)
```

JavaScript указанный в шаблоне:

```text
ace.js                      // ядро редактора
mode-php.js                 // подсветка PHP синтаксиса
snippets/php.js             // сниппеты PHP
ext-language_tools.js       // автодополнение
ext-prompt.js               // расширения
*.theme.js                  // темы оформления
console.js                  // основной скрипт приложения
```

### SQL редактор (sql-console.blade.php)

**Назначение:** SQL консоль с автодополнением таблиц. 

Аналогична PHP, но подключены немного другие js файлы. (Для SQL в место php mode-sql.js и snippets/sql.js)  Во всем остальном можно смотреть, что было описано выше. 

### Интеграция с боковым меню (tree-button.blade.php)

**Назначение:** Добавление кнопки в дерево документов.

#### Логика работы скрипта:

```text
Найти #treeMenu → Создать кнопку → Добавить обработчик click →openConsole() →
→ Проверить конфиг useModxPopup →  Использовать modx.popup() / window.open()
```

*Более подробно про работу скрипта можете посмотреть в разделе с Плагином.*