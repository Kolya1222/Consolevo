<?php
namespace roilafx\Consolevo;

use Illuminate\Support\Facades\Event;

$modx = evo();

Event::listen(['evolution.OnManagerTreePrerender'], function() use ($modx) {
    if (evo()->getLoginUserID('mgr') != 1) return;
    
    // Получаем значение конфига
    $useModxPopup = config('consolevo.use_modx_popup', 1);
    
    // Передаем конфиг в шаблон
    echo view('consolevo::tree-button', [
        'useModxPopup' => $useModxPopup
    ])->render();
});