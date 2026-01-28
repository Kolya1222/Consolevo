Как работает плагин:

```text
evolution.OnManagerTreePrerender
        ↓
Проверка: userID = 1 (только пользователь с ID 1)
        ↓
Чтение конфига: use_modx_popup (показывать в modx popup или как окно браузера)
        ↓
Рендеринг: tree-button.blade.php
        ↓
Вывод в дерево документов
```

Для нагляжности схема ниже:

```mermaid
graph TD
    A[Событие OnManagerTreePrerender] --> B{Пользователь = админ c id 1?}
    B -- Да --> C[Чтение конфига use_modx_popup]
    B -- Нет --> D[Выход]
    C --> E[Рендер tree-button.blade.php]
    E --> F[Вывод HTML в дерево]
```

Больше плагин ничего не делает. Его единственная задача это добавить иконку консоли в боковое меню админки.