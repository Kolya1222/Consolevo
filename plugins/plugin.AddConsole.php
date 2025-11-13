<?php
namespace roilafx\Consolevo;

use Illuminate\Support\Facades\Event;

$modx = evo();

Event::listen(['evolution.OnManagerTreePrerender'], function() use ($modx) {
    if (evo()->getLoginUserID('mgr') != 1) return;
    echo view('consolevo::tree-button')->render();
});