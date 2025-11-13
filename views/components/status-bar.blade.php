{{-- components/status-bar.blade.php --}}
<div class="status-bar">
    @foreach($items as $item)
        <div class="status-item">
            <i class="{{ $item['icon'] }}"></i>
            <span>
                @if(isset($item['dynamic']))
                    <span id="{{ $item['dynamic'] }}">{{ $item['text'] }}</span>
                @else
                    {{ $item['text'] }}
                @endif
            </span>
        </div>
    @endforeach
</div>