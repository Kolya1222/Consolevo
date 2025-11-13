@extends('consolevo::layouts.app')

@section('title', 'PHP Console - Evolution Console')

@section('styles')
    <link rel="stylesheet" href="{{ MODX_BASE_URL }}assets/plugins/consolevo/css/php-sql-console.css?v={{ time() }}">
@endsection

@section('content')
<div class="console-container">
    {{-- Заголовок --}}
    @include('consolevo::components.console-header', [
        'icon' => 'fab fa-php',
        'title' => 'PHP Console',
        'navigation' => [
            [
                'url' => route('consolevo.sql'),
                'icon' => 'fas fa-database',
                'title' => 'SQL Console'
            ]
        ]
    ])

    {{-- Карточка консоли --}}
    @include('consolevo::components.console-card', [
        'icon' => 'fas fa-code',
        'title' => 'Выполнение PHP кода',
        'executeRoute' => route('consolevo.php.execute'),
        'consoleType' => 'php'
    ])

    {{-- Статус бар --}}
    @include('consolevo::components.status-bar', [
        'items' => [
            [
                'icon' => 'fas fa-code-branch',
                'text' => 'PHP ' . PHP_VERSION
            ],
            [
                'icon' => 'fas fa-microchip',
                'text' => 'Память: ',
                'dynamic' => 'memory-usage'
            ],
            [
                'icon' => 'far fa-clock',
                'text' => 'Время выполнения: ',
                'dynamic' => 'execution-time'
            ],
            [
                'icon' => 'fas fa-shield-alt',
                'text' => 'Безопасный режим'
            ]
        ]
    ])
</div>
@endsection

@section('scripts')
<!-- Ace Editor для PHP -->
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/ace.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/mode-php.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/snippets/php.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/ext-language_tools.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/ext-prompt.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/theme-tomorrow_night.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/theme-monokai.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/theme-github.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/theme-chrome.js"></script>

<script type="module" src="{{ MODX_BASE_URL }}assets/plugins/consolevo/js/console.js?v={{ time() }}"></script>
@endsection