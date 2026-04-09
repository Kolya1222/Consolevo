<?php
require_once __DIR__ . '/../src/Controllers/AnalysisController.php';

use roilafx\Consolevo\Controllers\AnalysisController;

$controller = new AnalysisController();

// Проверка существования метода
if (!method_exists($controller, 'getUnifiedData')) {
    echo "FAIL: Method getUnifiedData not found\n";
    exit(1);
}

echo "OK: All tests passed\n";