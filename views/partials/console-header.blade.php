{{-- components/console-header.blade.php --}}
<header class="header">
    <div class="logo">
        <i class="{{ $icon }}"></i>
        <span>{{ $title }}</span>
    </div>
    <div class="nav-buttons">
        <a href="{{ route('consolevo.index') }}" class="btn btn-outline">
            <i class="fas fa-arrow-left"></i> Назад
        </a>
        
        {{-- Динамические кнопки навигации --}}
        @foreach($navigation as $nav)
            <a href="{{ $nav['url'] }}" class="btn btn-outline">
                <i class="{{ $nav['icon'] }}"></i> {{ $nav['title'] }}
            </a>
        @endforeach
        <button class="btn btn-outline btn-sm" id="show-history" title="Показать историю (Alt+Shift+H)">
            <i class="fas fa-history"></i> История
        </button>
    </div>
</header>