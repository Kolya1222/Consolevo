<?php
use Illuminate\Support\Facades\Route;
use roilafx\Consolevo\Controllers\ConsoleController;
use roilafx\Consolevo\Controllers\PhpConsoleController;
use roilafx\Consolevo\Controllers\SqlConsoleController;
use roilafx\Consolevo\Controllers\AnalysisController;
use roilafx\Consolevo\Middleware\ConsoleVoAccess;
use EvolutionCMS\Middleware\VerifyCsrfToken;

Route::prefix('consolevo')->middleware([
    VerifyCsrfToken::class,
    ConsoleVoAccess::class
])->group(function () {
    // Главная страница
    Route::get('/', [ConsoleController::class, 'index'])->name('consolevo.index');
    
    // PHP консоль
    Route::get('/php', [PhpConsoleController::class, 'index'])->name('consolevo.php');
    Route::post('/php/execute', [PhpConsoleController::class, 'execute'])->name('consolevo.php.execute');
    
    // SQL консоль
    Route::get('/sql', [SqlConsoleController::class, 'index'])->name('consolevo.sql');
    Route::post('/sql/execute', [SqlConsoleController::class, 'execute'])->name('consolevo.sql.execute');
    Route::get('/sql/tables', [SqlConsoleController::class, 'getTablesForAutocomplete']);
    Route::get('/sql/database-info', [SqlConsoleController::class, 'getDatabaseInfo']);

    // Подсказки для PHP
    Route::get('/analysis/evo-data', [AnalysisController::class, 'getEvoCompletionData']);
    Route::get('/analysis/static-data', [AnalysisController::class, 'getStaticCompletionData']);
});