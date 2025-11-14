{{-- components/console-card.blade.php --}}
<div class="console-card">
    <div class="card-header">
        <div class="card-title">
            <i class="{{ $icon }}"></i>
            {{ $title }}
        </div>
        <div class="card-actions flex gap-2">
            <button id="execute-code" class="btn btn-primary" title="Выполнить код (Alt+Enter)">
                <i class="fas fa-play"></i> Выполнить
            </button>
            <button id="clear-console" class="btn btn-outline" title="Очистить консоль (Alt+L)">
                <i class="fas fa-broom"></i> Очистить
            </button>
        </div>
    </div>

    {{-- Контейнер для редактора кода --}}
    <div class="editor-container">
        <div class="editor-toolbar">
            <button class="toolbar-btn" id="execute-editor" title="Выполнить (Alt+Enter)">
                <i class="fas fa-play"></i> Выполнить
            </button>
            <button class="toolbar-btn" id="clear-editor" title="Очистить редактор (Alt+L)">
                <i class="fas fa-eraser"></i> Очистить
            </button>
            <select class="theme-selector" id="theme-selector">
                <option value="ace/theme/tomorrow_night">Tomorrow Night</option>
                <option value="ace/theme/monokai">Monokai</option>
                <option value="ace/theme/github">GitHub</option>
                <option value="ace/theme/chrome">Chrome</option>
            </select>
            <select class="font-size-selector" id="font-size-selector">
                <option value="12px">12px</option>
                <option value="14px" selected>14px</option>
                <option value="16px">16px</option>
                <option value="18px">18px</option>
            </select>
            <label class="toggle-wrap">
                <input type="checkbox" id="wrap-mode-toggle">
                <i class="fas fa-text-width"></i> Перенос строк
            </label>
            <div class="editor-info">
                <span id="cursor-position">Строка 1, Колонка 1</span>
                <span id="file-size">0 символов</span>
            </div>
        </div>
        <div id="code-editor" 
            data-execute-route="{{ $executeRoute ?? '' }}"
            data-console-type="{{ $consoleType ?? 'php' }}">
        </div>
    </div>
    
    <div class="console-output" id="console-output">
        @foreach($initialMessages as $message)
            <div class="console-line">
                <span class="prompt {{ $message['type'] ?? 'info' }}">{{ $message['prompt'] ?? '>>' }}</span>
                <span>{{ $message['text'] }}</span>
            </div>
        @endforeach
    </div>

    <div class="shortcuts-hint">
        <small>Горячие клавиши: Alt+Enter - выполнить, Alt+L - очистить, Alt+? - справка</small>
    </div>
</div>