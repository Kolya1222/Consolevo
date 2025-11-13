@extends('consolevo::layouts.app')

@section('title', 'Evolution Console')

@section('styles')
    <link rel="stylesheet" href="{{ MODX_BASE_URL }}assets/plugins/consolevo/css/console.css">
@endsection

@section('content')
<div class="dashboard">
    <header class="header fade-in">
        <div class="logo">
            <i class="fas fa-terminal"></i>
            <span>Evolution Console</span>
        </div>
        <div class="status-item">
            <div class="status-dot"></div>
            <span>Система активна</span>
        </div>
    </header>

    <div class="nav-cards">
        <a href="{{ route('consolevo.php') }}" class="nav-card fade-in">
            <div class="nav-card-icon">
                <i class="fab fa-php"></i>
            </div>
            <div class="nav-card-title">PHP Консоль</div>
            <div class="nav-card-description">
                Выполнение PHP кода в реальном времени. Тестируйте скрипты, отлаживайте код и проверяйте функции прямо в браузере.
            </div>
        </a>

        <a href="{{ route('consolevo.sql') }}" class="nav-card fade-in">
            <div class="nav-card-icon">
                <i class="fas fa-database"></i>
            </div>
            <div class="nav-card-title">SQL Консоль</div>
            <div class="nav-card-description">
                Выполнение SQL запросов к базе данных. Просматривайте результаты, анализируйте данные и оптимизируйте запросы.
            </div>
        </a>
    </div>

    {{-- Статус бар --}}
    @include('consolevo::components.status-bar', [
        'items' => [
            [
                'icon' => 'fas fa-code-branch',
                'text' => 'PHP ' . PHP_VERSION
            ],
            [
                'icon' => 'fas fa-server',
                'text' => 'MySQL ' . (Illuminate\Support\Facades\DB::select('SELECT VERSION() as version')[0]->version ?? 'Unknown')
            ],
            [
                'icon' => 'fas fa-cube',
                'text' => 'Evolution CMS'
            ]
        ]
    ])
</div>
@endsection