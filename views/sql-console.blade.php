@extends('consolevo::layouts.app')

@section('title', 'SQL Console - Evolution Console')

@section('styles')
    <link rel="stylesheet" href="{{ MODX_BASE_URL }}assets/plugins/consolevo/css/php-sql-console.css">
@endsection

@section('content')
<div class="console-container">
    {{-- Заголовок --}}
    @include('consolevo::partials.console-header', [
        'icon' => 'fas fa-database',
        'title' => 'SQL Console',
        'navigation' => [
            [
                'url' => route('consolevo.php'),
                'icon' => 'fab fa-php',
                'title' => 'PHP Console'
            ]
        ]
    ])

    {{-- Карточка консоли --}}
    @include('consolevo::partials.console-card', [
        'icon' => 'fas fa-database',
        'title' => 'Выполнение SQL запросов',
        'executeRoute' => route('consolevo.sql.execute'),
        'consoleType' => 'sql'
    ])

    {{-- Статус бар --}}
    @include('consolevo::partials.status-bar', [
        'items' => [
            [
                'icon' => 'fas fa-circle',
                'text' => 'База данных: ' . config('database.connections.mysql.database')
            ],
            [
                'icon' => 'fas fa-server',
                'text' => 'MySQL ' . (Illuminate\Support\Facades\DB::select('SELECT VERSION() as version')[0]->version ?? 'Unknown')
            ],
            [
                'icon' => 'far fa-clock',
                'text' => 'Время выполнения: ',
                'dynamic' => 'execution-time'
            ],
            [
                'icon' => 'fas fa-shield-alt',
                'text' => 'Защищённый режим'
            ]
        ]
    ])
</div>
@endsection

@section('scripts')
<!-- Ace Editor для SQL -->
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/ace.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/mode-sql.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/snippets/sql.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/ext-language_tools.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/ext-prompt.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/theme-tomorrow_night.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/theme-monokai.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/theme-github.js"></script>
<script src="{{ MODX_BASE_URL }}assets/plugins/consolevo/ace-editor/theme-chrome.js"></script>


<script type="module" src="{{ MODX_BASE_URL }}assets/plugins/consolevo/js/console.js"></script>
@endsection